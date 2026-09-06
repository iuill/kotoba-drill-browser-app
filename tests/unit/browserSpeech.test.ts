import { test, expect } from "bun:test";
import {
  BrowserSpeechRecognizer,
  supportsRecordedSpeech,
  type BrowserSpeech,
} from "../../src/models/browserSpeech";
import {
  RecognitionError,
  RecognizerUnavailableError,
} from "../../src/models/recognition";
import { SelectableRecognizer } from "../../src/models/selectableRecognizer";

async function fixture(
  run: (env: ReturnType<typeof install>) => Promise<void>,
) {
  const env = install();
  try {
    await run(env);
  } finally {
    env.restore();
  }
}
function install() {
  const keys = [
    "SpeechRecognition",
    "webkitSpeechRecognition",
    "navigator",
    "AudioContext",
    "setTimeout",
    "clearTimeout",
    "Worker",
  ] as const;
  const originals = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let id = 0;
  const track = {
    kind: "audio",
    readyState: "live",
    stop() {
      this.readyState = "ended";
    },
  };
  const source = {
    buffer: null as unknown,
    onended: null as (() => void) | null,
    starts: 0,
    scheduledAt: -1,
    stops: 0,
    disconnected: false,
    connected: null as unknown,
    start(when: number) {
      this.scheduledAt = when;
      this.starts++;
    },
    stop() {
      this.stops++;
    },
    connect(dest: unknown) {
      this.connected = dest;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
  const silence = {
    offset: { value: 1 },
    starts: 0,
    stops: 0,
    disconnected: false,
    connected: null as unknown,
    connect(node: unknown) {
      this.connected = node;
    },
    start() {
      this.starts++;
    },
    stop() {
      this.stops++;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
  const destination = {
    stream: { getTracks: () => [track], getAudioTracks: () => [track] },
  };
  let releaseDecode: (() => void) | undefined;
  let delayDecode = false;
  class Context {
    static latest: Context;
    state = "running";
    currentTime = 32;
    constructor(readonly options?: AudioContextOptions) {
      Context.latest = this;
    }
    async decodeAudioData() {
      if (delayDecode)
        await new Promise<void>((resolve) => {
          releaseDecode = resolve;
        });
      return {};
    }
    async resume() {}
    createConstantSource() {
      return silence;
    }
    createBufferSource() {
      return source;
    }
    createMediaStreamDestination() {
      return destination;
    }
    async close() {
      this.state = "closed";
    }
  }
  class Speech implements BrowserSpeech {
    static latest: Speech | undefined;
    lang = "";
    continuous = false;
    interimResults = true;
    maxAlternatives = 0;
    processLocally = true;
    onstart: BrowserSpeech["onstart"] = null;
    onaudiostart: BrowserSpeech["onaudiostart"] = null;
    onresult: BrowserSpeech["onresult"] = null;
    onerror: BrowserSpeech["onerror"] = null;
    onend: BrowserSpeech["onend"] = null;
    input: unknown;
    stops = 0;
    aborted = false;
    constructor() {
      Speech.latest = this;
    }
    start(input: MediaStreamTrack) {
      this.input = input;
    }
    stop() {
      this.stops++;
    }
    abort() {
      this.aborted = true;
    }
  }
  const values = {
    SpeechRecognition: Speech,
    webkitSpeechRecognition: undefined,
    navigator: { userAgent: "Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36" },
    AudioContext: Context,
    setTimeout: (fn: () => void, ms: number) => {
      const key = ++id;
      timers.set(key, { fn, ms });
      return key;
    },
    clearTimeout: (key: number) => timers.delete(key),
    Worker: class {
      constructor() {
        throw Error("ブラウザ認識ではWorkerを作らない");
      }
    },
  };
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  return {
    Speech,
    Context,
    source,
    silence,
    destination,
    track,
    timers,
    delayDecode() {
      delayDecode = true;
    },
    releaseDecode() {
      releaseDecode?.();
    },
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
const result = (text: string, isFinal = true) => ({
  isFinal,
  0: { transcript: text },
});

test("ブラウザ認識は録音トラックだけを日本語で認識し、最終結果を重複させず資源を解放", async () =>
  fixture(async (env) => {
    const recognizer = new SelectableRecognizer();
    await recognizer.load("browser", "webgpu", () => {});
    const pending = recognizer.run(new Blob(["recording"]));
    await flush();
    const speech = env.Speech.latest!;
    expect(speech.input).toBe(env.track);
    expect(env.Context.latest.options?.sampleRate).toBe(16000);
    expect(env.silence.starts).toBe(1);
    expect(env.silence.offset.value).toBe(0);
    expect(env.silence.connected).toBe(env.destination);
    expect(speech.lang).toBe("ja-JP");
    expect(speech.processLocally).toBe(false);
    expect(speech.continuous).toBe(true);
    expect(speech.interimResults).toBe(false);
    expect(env.source.connected).toBe(env.destination);
    expect(env.source.starts).toBe(0);
    speech.onstart?.();
    expect(env.source.starts).toBe(0);
    speech.onaudiostart?.();
    expect(env.source.starts).toBe(1);
    expect(env.source.scheduledAt).toBe(32.5);
    speech.onresult?.({ results: [result("か"), result("仮", false)] });
    speech.onresult?.({ results: [result("か"), result("さ")] });
    env.source.onended?.();
    [...env.timers.values()].find((timer) => timer.ms === 1000)!.fn();
    expect(speech.stops).toBe(1);
    speech.onend?.();
    expect(await pending).toBe("かさ");
    expect(env.track.readyState).toBe("ended");
    expect(env.Context.latest.state).toBe("closed");
    expect(env.source.disconnected).toBe(true);
    expect(env.silence.stops).toBe(1);
    expect(env.silence.disconnected).toBe(true);
    expect(env.source.buffer).toBeNull();
    expect(speech.aborted).toBe(true);
    expect(env.timers.size).toBe(0);
    recognizer.dispose();
  }));

test("旧版・モバイル・APIなしでは開始せず、意図しないマイク入力へフォールバックしない", async () =>
  fixture(async () => {
    for (const ua of [
      "Chrome/134.0",
      "Android Chrome/145.0",
      "iPhone CriOS/145.0",
      "Version/18.0 Safari/605.1",
    ])
      expect(supportsRecordedSpeech(ua)).toBe(false);
    expect(supportsRecordedSpeech("Chrome/145.0 Edg/145.0")).toBe(true);
    Reflect.deleteProperty(globalThis, "SpeechRecognition");
    const recognizer = new BrowserSpeechRecognizer();
    await expect(
      recognizer.load("browser", "wasm", () => {}),
    ).rejects.toBeInstanceOf(RecognizerUnavailableError);
  }));

test("通信・権限・発声未検出を区別し、次の認識を開始できる", async () =>
  fixture(async (env) => {
    const recognizer = new BrowserSpeechRecognizer();
    await recognizer.load("browser", "wasm", () => {});
    for (const [error, message] of [
      ["network", "接続できませんでした"],
      ["not-allowed", "許可されていません"],
    ]) {
      const pending = recognizer.run(new Blob()).catch((error) => error);
      await flush();
      env.Speech.latest!.onerror?.({ error });
      const failure = await pending;
      expect(failure).toBeInstanceOf(RecognitionError);
      expect(failure.message).toContain(message);
      expect(env.timers.size).toBe(0);
    }
    const silence = recognizer.run(new Blob()).catch((error) => error);
    await flush();
    env.Speech.latest!.onerror?.({ error: "no-speech" });
    expect((await silence).message).toContain("発声を検出できませんでした");
    recognizer.dispose();
  }));

test("ブラウザ認識のタイムアウトと破棄で待ちを解放し、遅延イベントを無視", async () =>
  fixture(async (env) => {
    const recognizer = new BrowserSpeechRecognizer();
    await recognizer.load("browser", "wasm", () => {});
    const pending = recognizer.run(new Blob()).catch((error) => error);
    await flush();
    const late = env.Speech.latest!.onresult!;
    [...env.timers.values()].find((timer) => timer.ms === 90000)!.fn();
    expect((await pending).message).toContain("時間内");
    late({ results: [result("古い結果")] });
    const next = recognizer.run(new Blob()).catch((error) => error);
    await flush();
    recognizer.dispose();
    expect((await next).name).toBe("AbortError");
    expect(env.Speech.latest!.aborted).toBe(true);
    expect(env.timers.size).toBe(0);
  }));

test("デコード中に設定を変えた場合、後から認識サービスを開始しない", async () =>
  fixture(async (env) => {
    env.delayDecode();
    const recognizer = new BrowserSpeechRecognizer();
    await recognizer.load("browser", "wasm", () => {});
    const pending = recognizer.run(new Blob()).catch((error) => error);
    await flush();
    recognizer.dispose();
    env.releaseDecode();
    await flush();
    expect((await pending).name).toBe("AbortError");
    expect(env.Speech.latest).toBeUndefined();
    expect(env.Context.latest.state).toBe("closed");
    expect(env.timers.size).toBe(0);
  }));

test("入力開始前・音声送信途中・結果なしの終了を区別する", async () =>
  fixture(async (env) => {
    const recognizer = new BrowserSpeechRecognizer();
    await recognizer.load("browser", "wasm", () => {});
    for (const phase of ["before", "during", "after"]) {
      const pending = recognizer.run(new Blob()).catch((error) => error);
      await flush();
      const speech = env.Speech.latest!;
      if (phase !== "before") speech.onaudiostart?.();
      if (phase === "after") env.source.onended?.();
      speech.onend?.();
      const error = await pending;
      expect(error).toBeInstanceOf(RecognitionError);
      expect(error.message).toContain(
        phase === "before"
          ? "入力が始まる前"
          : phase === "during"
            ? "送り終える前"
            : "文字が返りませんでした",
      );
      expect(env.timers.size).toBe(0);
    }
    recognizer.dispose();
  }));

test("入力開始を待つ期限と無音準備中の中断で音声・タイマーを解放", async () =>
  fixture(async (env) => {
    const recognizer = new BrowserSpeechRecognizer();
    await recognizer.load("browser", "wasm", () => {});
    const stalled = recognizer.run(new Blob()).catch((error) => error);
    await flush();
    [...env.timers.values()].find((timer) => timer.ms === 10000)!.fn();
    expect((await stalled).message).toContain("音声入力が始まりませんでした");
    const next = recognizer.run(new Blob()).catch((error) => error);
    await flush();
    const lateStart = env.Speech.latest!.onaudiostart!;
    env.Speech.latest!.onaudiostart?.();
    expect(env.source.scheduledAt).toBeGreaterThan(
      env.Context.latest.currentTime,
    );
    recognizer.dispose();
    lateStart();
    expect((await next).name).toBe("AbortError");
    expect(env.source.starts).toBe(1);
    expect(env.source.stops).toBe(2);
    expect(env.timers.size).toBe(0);
  }));
