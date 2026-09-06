import { beforeEach, test, expect } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { Engine } from "../../src/core/engine";
import { Store, initialPreferences } from "../../src/storage/store";
import type { AudioPort, Capture } from "../../src/audio/browserAudio";
import { aborted } from "../../src/audio/browserAudio";
import type { Settings } from "../../src/core/types";
import type { Recognizer } from "../../src/models/recognition";
const until = async (fn: () => boolean) => {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error("condition timeout");
};
class FakeAudio implements AudioPort {
  samples: string[] = [];
  repetitions: number[] = [];
  captureSettings?: Settings;
  recordings = 0;
  plays = 0;
  resolve: ((c: Capture) => void) | undefined;
  holdPlayback = false;
  endPlayback: (() => void) | undefined;
  async speak(
    text: string,
    _s: Settings,
    signal: AbortSignal,
    _cue?: "start" | "next",
    repetitions = 1,
  ) {
    if (signal.aborted) throw aborted();
    this.samples.push(text);
    this.repetitions.push(repetitions);
  }
  async play(_blob: Blob, _s: Settings, signal: AbortSignal) {
    this.plays++;
    if (this.holdPlayback)
      await new Promise<void>((resolve, reject) => {
        this.endPlayback = resolve;
        signal.addEventListener("abort", () => reject(aborted()), {
          once: true,
        });
      });
  }
  async capture(
    s: Settings,
    signal: AbortSignal,
    _level: unknown,
    onRecording: () => void,
  ) {
    this.recordings++;
    this.captureSettings = s;
    onRecording();
    return new Promise<Capture>((resolve, reject) => {
      this.resolve = resolve;
      signal.addEventListener("abort", () => reject(aborted()), { once: true });
    });
  }
  complete(limit = false) {
    this.resolve?.({
      blob: new Blob(["voice"], { type: "audio/webm" }),
      seconds: 1,
      limit,
    });
  }
  finish() {
    this.complete();
  }
  stop() {}
}
class FakeRecognizer implements Recognizer {
  loads = 0;
  resolve: ((s: string) => void) | undefined;
  async load() {
    this.loads++;
  }
  async run() {
    return new Promise<string>((r) => (this.resolve = r));
  }
  dispose() {
    this.resolve?.("cancelled");
  }
}
beforeEach(() => (globalThis.indexedDB = new IDBFactory()));
async function setup(extra: Partial<Settings> = {}) {
  const store = await Store.open(),
    audio = new FakeAudio(),
    recognizer = new FakeRecognizer(),
    prefs = initialPreferences();
  prefs.settings = {
    ...prefs.settings,
    sounds: ["か", "き"],
    random: false,
    delay: 0,
    ...extra,
  };
  const engine = new Engine(audio, recognizer, store, prefs);
  await engine.start();
  await until(() => engine.getSnapshot().phase === "recording");
  return { store, audio, recognizer, engine, prefs };
}
test("一時停止は途中録音を回数・履歴に含めず、再開は見本設定に従う", async () => {
  const { engine, audio, store, recognizer } = await setup({
    sample: "changed",
  });
  engine.pause();
  audio.complete();
  await new Promise((r) => setTimeout(r, 5));
  expect(await store.history()).toEqual([]);
  expect(engine.getSnapshot().count).toBe(0);
  await engine.resume();
  await until(() => engine.getSnapshot().phase === "recording");
  expect(audio.samples).toEqual(["か"]);
  expect(recognizer.loads).toBe(0);
  engine.dispose();
  store.close();
});
test("毎回設定は再開時も再生し、手動・オフは再生しない", async () => {
  for (const sample of ["always", "manual", "off"] as const) {
    const { engine, audio, store } = await setup({ sample });
    engine.pause();
    await engine.resume();
    await until(() => audio.recordings === 2);
    expect(audio.samples.length).toBe(sample === "always" ? 2 : 0);
    engine.dispose();
    store.close();
  }
});
test("戻ると繰り返し・完了した発声のみ数える", async () => {
  const { engine, audio, store } = await setup();
  audio.complete();
  await until(() => audio.recordings === 2);
  expect(engine.getSnapshot().prompt?.reading).toBe("き");
  engine.back();
  expect(engine.getSnapshot().phase).toBe("paused");
  expect(engine.getSnapshot().prompt?.reading).toBe("か");
  expect(engine.getSnapshot().repeat).toBe(true);
  await engine.resume();
  await until(() => audio.recordings === 3);
  audio.complete();
  await until(() => audio.recordings === 4);
  expect(engine.getSnapshot().prompt?.reading).toBe("か");
  expect(engine.getSnapshot().count).toBe(2);
  engine.dispose();
  store.close();
});
test("遅れて届く結果のお題へ戻り、途中録音を捨てて繰り返し、次の順序を保つ", async () => {
  const { engine, audio, recognizer, store } = await setup({
    evaluation: true,
    sounds: ["か", "き", "く"],
    sample: "changed",
  });
  audio.complete();
  await until(() => audio.recordings === 2);
  const id = engine.getSnapshot().recent[0].id;
  // 結果を待たず2つ先へ進む。
  engine.next();
  await until(() => audio.recordings === 3);
  expect(engine.getSnapshot().prompt?.reading).toBe("く");
  recognizer.resolve?.("かかか");
  await until(() => engine.getSnapshot().recent[0].evaluation === "done");
  const interrupted = audio.resolve;
  engine.retry(id);
  expect(engine.getSnapshot().phase).toBe("paused");
  expect(engine.getSnapshot().prompt?.reading).toBe("か");
  expect(engine.getSnapshot().repeat).toBe(true);
  interrupted?.({ blob: new Blob(["discard"]), seconds: 1, limit: false });
  await engine.resume();
  await until(() => audio.recordings === 4);
  expect(audio.samples).toEqual(["か", "き", "く", "か"]);
  audio.complete();
  await until(() => audio.recordings === 5);
  expect(engine.getSnapshot().prompt?.reading).toBe("か");
  expect(engine.getSnapshot().count).toBe(2);
  expect(await store.history()).toHaveLength(2);
  engine.next();
  await until(() => audio.recordings === 6);
  expect(engine.getSnapshot().prompt?.reading).toBe("き");
  expect(engine.getSnapshot().repeat).toBe(false);
  engine.dispose();
  store.close();
});
test("結果から戻る操作は設定変更・区切り・終了・別セッションの境界を守る", async () => {
  const { engine, audio, prefs, store } = await setup({
    limit: "count",
    limitValue: 1,
  });
  audio.complete();
  await until(() => engine.getSnapshot().phase === "boundary");
  const id = engine.getSnapshot().recent[0].id;
  expect(engine.canRetry(id)).toBe(false);
  engine.retry(id);
  expect(engine.getSnapshot().phase).toBe("boundary");
  engine.continue();
  await until(() => audio.recordings === 2);
  expect(engine.canRetry(id)).toBe(true);
  await engine.apply({
    ...prefs,
    settings: { ...prefs.settings, sounds: ["さ"] },
  });
  expect(engine.canRetry(id)).toBe(false);
  engine.retry(id);
  expect(engine.getSnapshot().prompt?.reading).toBe("さ");
  engine.end();
  expect(engine.canRetry(id)).toBe(false);
  await engine.start(prefs);
  expect(engine.canRetry(id)).toBe(false);
  engine.dispose();
  store.close();
});
test("区切りは聞き返し完了を待ち、同じ区切り分継続", async () => {
  const { engine, audio, store } = await setup({
    limit: "count",
    limitValue: 1,
  });
  audio.holdPlayback = true;
  audio.complete();
  await until(() => engine.getSnapshot().phase === "playback");
  expect(engine.getSnapshot().phase).not.toBe("boundary");
  audio.endPlayback?.();
  await until(() => engine.getSnapshot().phase === "boundary");
  engine.continue();
  await until(() => audio.recordings === 2);
  audio.complete();
  await until(() => audio.plays === 2);
  audio.endPlayback?.();
  await until(() => engine.getSnapshot().phase === "boundary");
  expect(engine.getSnapshot().count).toBe(2);
  engine.dispose();
  store.close();
});
test("上限録音は保存して同じお題に一時停止する", async () => {
  const { engine, audio, store } = await setup();
  audio.complete(true);
  await until(() => engine.getSnapshot().phase === "paused");
  expect(engine.getSnapshot().prompt?.reading).toBe("か");
  expect(engine.getSnapshot().message).toContain("録音上限");
  expect((await store.history()).length).toBe(1);
  engine.dispose();
  store.close();
});
test("遅延認識は元のお題の履歴のみ更新する", async () => {
  const { engine, audio, store, recognizer } = await setup({
    evaluation: true,
  });
  audio.complete();
  await until(() => audio.recordings === 2);
  expect(engine.getSnapshot().prompt?.reading).toBe("き");
  recognizer.resolve?.("か、か、か");
  await until(() => engine.getSnapshot().recent[0]?.evaluation === "done");
  expect(engine.getSnapshot().recent[0].prompt.reading).toBe("か");
  expect(engine.getSnapshot().recent[0].comparison).toBe("match");
  expect(engine.getSnapshot().prompt?.reading).toBe("き");
  engine.dispose();
  store.close();
});
test("設定適用は途中録音を破棄し、新しい条件で停止", async () => {
  const { engine, audio, store, prefs } = await setup();
  await engine.apply({
    ...prefs,
    settings: { ...prefs.settings, sounds: ["しゃ"] },
  });
  audio.complete();
  await new Promise((r) => setTimeout(r, 5));
  expect(engine.getSnapshot().phase).toBe("paused");
  expect(engine.getSnapshot().prompt?.reading).toBe("しゃ");
  expect(await store.history()).toEqual([]);
  engine.dispose();
  store.close();
});

test("時間の区切りは準備・一時停止を除き、発声と聞き返し完了後に到達", async () => {
  const store = await Store.open(),
    audio = new FakeAudio(),
    recognizer = new FakeRecognizer(),
    prefs = initialPreferences();
  let now = 0;
  prefs.settings = {
    ...prefs.settings,
    limit: "minutes",
    limitValue: 1,
    delay: 0,
    sample: "off",
    evaluation: true,
  };
  let loaded: () => void = () => {};
  recognizer.load = async () => {
    await new Promise<void>((r) => (loaded = r));
  };
  const engine = new Engine(audio, recognizer, store, prefs, () => now);
  const starting = engine.start();
  expect(engine.getSnapshot().phase).toBe("preparing");
  now = 120000;
  loaded();
  await starting;
  await until(() => audio.recordings === 1);
  now += 30000;
  engine.pause();
  expect(engine.getSnapshot().elapsed).toBe(30);
  now += 120000;
  await engine.resume();
  await until(() => audio.recordings === 2);
  now += 31000;
  audio.holdPlayback = true;
  audio.complete();
  await until(() => engine.getSnapshot().phase === "playback");
  expect(engine.getSnapshot().phase).not.toBe("boundary");
  audio.endPlayback?.();
  await until(() => engine.getSnapshot().phase === "boundary");
  expect(engine.getSnapshot().elapsed).toBe(61);
  engine.dispose();
  store.close();
});
test("モデル準備失敗から評価なしで再開すると、現在・次のお題と見本が1回になる", async () => {
  const store = await Store.open(),
    audio = new FakeAudio(),
    recognizer = new FakeRecognizer(),
    prefs = initialPreferences();
  prefs.settings = {
    ...prefs.settings,
    evaluation: true,
    sounds: ["か", "き"],
    random: false,
    sample: "always",
    delay: 0,
  };
  recognizer.load = async () => {
    recognizer.loads++;
    throw new Error("load failed");
  };
  const engine = new Engine(audio, recognizer, store, prefs);
  await engine.start();
  expect(engine.getSnapshot().phase).toBe("paused");
  expect(audio.recordings).toBe(0);
  expect(engine.getSnapshot().prompt?.repetitions).toBe(3);
  await engine.withoutEvaluation();
  await until(() => audio.recordings === 1);
  expect(engine.getSnapshot().prompt?.repetitions).toBeUndefined();
  expect(audio.repetitions).toEqual([1]);
  audio.complete();
  await until(() => engine.getSnapshot().count === 1);
  expect(engine.getSnapshot().recent[0].evaluation).toBe("off");
  expect(engine.getSnapshot().recent[0].prompt.repetitions).toBeUndefined();
  await until(() => audio.recordings === 2);
  expect(engine.getSnapshot().prompt?.reading).toBe("き");
  expect(engine.getSnapshot().prompt?.repetitions).toBeUndefined();
  expect(audio.repetitions).toEqual([1, 1]);
  expect(recognizer.loads).toBe(1);
  engine.dispose();
  store.close();
});
test("復元前にリセットすれば遅延結果が置換後の同一IDを書き換えない", async () => {
  const { store, audio, recognizer, engine } = await setup({
    evaluation: true,
  });
  audio.complete();
  await until(() => engine.getSnapshot().count === 1);
  const h = (await store.history())[0];
  engine.reset();
  await store.restore({
    format: "kotoba-drill",
    version: 1,
    preferences: initialPreferences(),
    history: [{ ...h, evaluation: "off", model: null }],
    includesRecordings: false,
    recordings: [],
  });
  recognizer.resolve?.("late");
  await new Promise((r) => setTimeout(r, 5));
  expect((await store.history())[0].evaluation).toBe("off");
  expect(engine.getSnapshot().recent).toEqual([]);
  engine.dispose();
  store.close();
});

test("画面外の履歴を読み出している間に復元しても遅延評価を書き込まない", async () => {
  const { store, audio, recognizer, engine } = await setup({
    evaluation: true,
  });
  audio.complete();
  await until(() => engine.getSnapshot().count === 1);
  const h = (await store.history())[0];
  engine.forget([h.id]);
  const original = store.history.bind(store);
  let requested = false;
  let release: (rows: (typeof h)[]) => void = () => {};
  store.history = async () => {
    requested = true;
    return new Promise((resolve) => (release = resolve));
  };
  recognizer.resolve?.("古い結果");
  await until(() => requested);
  engine.reset();
  await store.restore({
    format: "kotoba-drill",
    version: 1,
    preferences: initialPreferences(),
    history: [{ ...h, evaluation: "off", model: null }],
    includesRecordings: false,
    recordings: [],
  });
  release([h]);
  await new Promise((r) => setTimeout(r, 5));
  store.history = original;
  expect((await store.history())[0].evaluation).toBe("off");
  expect((await store.history())[0].recognized).toBeUndefined();
  engine.dispose();
  store.close();
});

test("モデル準備が完了するまで見本（開始合図を含む）を再生しない", async () => {
  const store = await Store.open();
  const audio = new FakeAudio();
  const recognizer = new FakeRecognizer();
  let ready!: () => void;
  recognizer.load = () =>
    new Promise<void>((resolve) => {
      ready = resolve;
    });
  const prefs = initialPreferences();
  prefs.settings.evaluation = true;
  const engine = new Engine(audio, recognizer, store, prefs);
  const started = engine.start();
  await until(() => engine.getSnapshot().phase === "preparing");
  expect(audio.samples).toHaveLength(0);
  ready();
  await until(() => audio.samples.length === 1);
  engine.pause();
  await started;
});

test("認識が追いつかない省略と、終了による中断を履歴に区別して保存する", async () => {
  const { engine, audio, store } = await setup({ evaluation: true });
  for (let n = 1; n <= 3; n++) {
    audio.complete();
    await until(() => audio.recordings === n + 1);
  }
  await until(() =>
    engine.getSnapshot().recent.some((h) => h.skipReason === "backlog"),
  );
  const skipped = (await store.history()).filter(
    (h) => h.skipReason === "backlog",
  );
  expect(skipped).toHaveLength(1);
  engine.end();
  await until(
    () =>
      engine.getSnapshot().recent.filter((h) => h.skipReason === "interrupted")
        .length === 2,
  );
  const backup = await store.export(false);
  const { validateBackup } = await import("../../src/storage/store");
  expect(() => validateBackup(backup)).not.toThrow();
  expect(
    backup.history.filter((h) => h.skipReason === "interrupted"),
  ).toHaveLength(2);
  engine.dispose();
  store.close();
});

test("受付の合図が終わるまで録音を始めず、合図中の一時停止でも始めない", async () => {
  const { engine, audio, store } = await setup();
  engine.pause();
  let finishCue!: () => void;
  const port: AudioPort = audio;
  port.readyCue = (_s, signal) =>
    new Promise<void>((resolve, reject) => {
      finishCue = resolve;
      signal.addEventListener("abort", () => reject(aborted()), { once: true });
    });
  const count = audio.recordings;
  void engine.resume();
  await until(
    () => engine.getSnapshot().message === "合図のあと、声を出してください",
  );
  expect(audio.recordings).toBe(count);
  finishCue();
  await until(() => audio.recordings === count + 1);
  engine.pause();
  const resumed = engine.resume();
  await until(
    () => engine.getSnapshot().message === "合図のあと、声を出してください",
  );
  engine.pause();
  await resumed;
  expect(audio.recordings).toBe(count + 1);
  engine.dispose();
  store.close();
});

test("未開始と終了済みセッションは補助操作で再開せず、開始操作でIDを発行する", async () => {
  const store = await Store.open(),
    audio = new FakeAudio(),
    recognizer = new FakeRecognizer(),
    prefs = initialPreferences();
  prefs.settings.sample = "off";
  const engine = new Engine(audio, recognizer, store, prefs);
  await engine.apply(prefs);
  engine.pause();
  engine.next();
  engine.back();
  await engine.resume();
  expect(engine.getSnapshot().phase).toBe("idle");
  expect(audio.recordings).toBe(0);
  engine.togglePause();
  await until(() => audio.recordings === 1);
  const session = engine.getSnapshot().session;
  expect(session).not.toBe("");
  engine.end();
  engine.pause();
  engine.next();
  engine.back();
  await engine.sample();
  await engine.apply(prefs);
  await engine.resume();
  expect(engine.getSnapshot().phase).toBe("review");
  expect(audio.recordings).toBe(1);
  engine.togglePause();
  await until(() => audio.recordings === 2);
  expect(engine.getSnapshot().session).not.toBe(session);
  engine.dispose();
  store.close();
});

test("再調整した感度と再生直前の音量を反映する", async () => {
  const { engine, audio, store } = await setup();
  engine.pause();
  let threshold = 0,
    volume = 0;
  const capture = audio.capture.bind(audio),
    play = audio.play.bind(audio);
  audio.capture = (s, ...args) => {
    threshold = s.threshold;
    return capture(s, ...args);
  };
  audio.play = (blob, s, signal) => {
    volume = s.volume;
    return play(blob, s, signal);
  };
  engine.updateThreshold(0.008);
  await engine.resume();
  await until(() => audio.recordings === 2);
  expect(threshold).toBe(0.008);
  engine.live(0.12, 0.5, false);
  audio.complete();
  await until(() => audio.plays === 1);
  expect(volume).toBe(0.12);
  engine.dispose();
  store.close();
});

test("認識器を失った場合は再試行で再ロードし、単発エラーは再ロードしない", async () => {
  const { RecognizerUnavailableError } = await import(
    "../../src/models/recognition"
  );
  for (const fatal of [false, true]) {
    const { engine, audio, recognizer, store } = await setup({
      evaluation: true,
    });
    recognizer.run = async () => {
      throw fatal
        ? new RecognizerUnavailableError("lost")
        : new Error("one recording");
    };
    audio.complete();
    await until(() => engine.getSnapshot().recent[0]?.evaluation === "error");
    engine.pause();
    await engine.resume();
    expect(recognizer.loads).toBe(fatal ? 2 : 1);
    engine.dispose();
    store.close();
  }
});

test("声と速度だけの変更はお題・繰り返し・準備済みモデルを保ち、途中録音は破棄する", async () => {
  const { engine, prefs, audio, store, recognizer } = await setup({
    evaluation: true,
    sample: "changed",
  });
  engine.next();
  await until(
    () =>
      engine.getSnapshot().phase === "recording" &&
      engine.getSnapshot().prompt?.reading === "き",
  );
  engine.toggleRepeat();
  const prompt = engine.getSnapshot().prompt;
  await engine.apply({
    ...prefs,
    settings: { ...prefs.settings, voice: "voicevox-tsumugi", rate: 1.1 },
  });
  expect(engine.getSnapshot().phase).toBe("paused");
  expect(engine.getSnapshot().prompt).toEqual(prompt);
  expect(engine.getSnapshot().repeat).toBe(true);
  expect(await store.history()).toEqual([]);
  await engine.resume();
  await until(() => engine.getSnapshot().phase === "recording");
  expect(recognizer.loads).toBe(1);
  expect(audio.samples.at(-1)).toBe("き");
  engine.next();
  await until(
    () =>
      engine.getSnapshot().phase === "recording" &&
      engine.getSnapshot().prompt?.reading === "か",
  );
  engine.dispose();
  store.close();
});

test("1音は見本も3回で、短い間を保って1録音・1件・1回として記録する", async () => {
  const { engine, audio, store } = await setup({
    evaluation: true,
    silence: 200,
  });
  expect(audio.repetitions).toEqual([3]);
  expect(audio.captureSettings?.silence).toBe(1100);
  expect(audio.captureSettings?.maxSeconds).toBe(10);
  audio.complete();
  await until(() => audio.recordings === 2);
  expect(engine.getSnapshot().count).toBe(1);
  const history = await store.history();
  expect(history).toHaveLength(1);
  expect(history[0].prompt.repetitions).toBe(3);
  engine.pause();
  await engine.sample();
  expect(audio.repetitions.at(-1)).toBe(3);
  engine.dispose();
  store.close();
  const pair = await setup({ kind: "pair", silence: 200 });
  expect(pair.audio.repetitions).toEqual([1]);
  expect(pair.audio.captureSettings?.silence).toBe(200);
  pair.engine.dispose();
  pair.store.close();
});

test("1音の認識オン・オフ切替は出題と見本の回数を更新し、保存済み履歴を変えない", async () => {
  const { engine, audio, store, prefs } = await setup({ silence: 200 });
  expect(audio.repetitions).toEqual([1]);
  expect(audio.captureSettings?.silence).toBe(200);
  audio.complete();
  await until(() => audio.recordings === 2);
  const once = (await store.history())[0];
  expect(once.prompt.repetitions).toBeUndefined();
  const recognized = {
    ...prefs,
    settings: { ...prefs.settings, evaluation: true },
  };
  await engine.apply(recognized);
  expect(engine.getSnapshot().phase).toBe("paused");
  expect(engine.getSnapshot().prompt?.repetitions).toBe(3);
  await engine.resume();
  await until(() => audio.recordings === 3);
  expect(audio.repetitions.at(-1)).toBe(3);
  expect(audio.captureSettings?.silence).toBe(1100);
  audio.complete();
  await until(() => audio.recordings === 4);
  const repeated = (await store.history()).find((h) => h.id !== once.id)!;
  expect(repeated.prompt.repetitions).toBe(3);
  await engine.apply(prefs);
  expect(engine.getSnapshot().prompt?.repetitions).toBeUndefined();
  await engine.resume();
  await until(() => audio.recordings === 5);
  expect(audio.repetitions.at(-1)).toBe(1);
  expect(audio.captureSettings?.silence).toBe(200);
  const history = await store.history();
  expect(
    history.find((h) => h.id === once.id)?.prompt.repetitions,
  ).toBeUndefined();
  expect(history.find((h) => h.id === repeated.id)?.prompt.repetitions).toBe(3);
  engine.dispose();
  store.close();
});
