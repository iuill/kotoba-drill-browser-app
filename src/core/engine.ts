import type { AudioPort } from "../audio/browserAudio";
import { wait } from "../audio/browserAudio";
import type { Recognizer, RecognitionJob } from "../models/recognition";
import {
  LatestQueue,
  RecognitionError,
  RecognizerUnavailableError,
} from "../models/recognition";
import { compare, candidates, Deck } from "./materials";
import type { History, Phase, Preferences, Prompt } from "./types";
import type { Store } from "../storage/store";
import { temporary } from "../storage/store";
export interface Snapshot {
  phase: Phase;
  prompt?: Prompt;
  repeat: boolean;
  count: number;
  elapsed: number;
  level: number;
  voiced: boolean;
  message: string;
  recent: History[];
  session: string;
  error?: "audio" | "model-load" | "recognition" | "storage";
}
export class Engine {
  private state: Snapshot = {
    phase: "idle",
    repeat: false,
    count: 0,
    elapsed: 0,
    level: 0,
    voiced: false,
    message: "準備ができたら始めましょう",
    recent: [],
    session: "",
  };
  private listeners = new Set<() => void>();
  private controller = new AbortController();
  private token = 0;
  private deck: Deck | null = null;
  private prefs: Preferences;
  private played = "";
  private cuePlayed = false;
  private activeSince: number | null = null;
  private elapsedBefore = 0;
  private nextBoundary = 0;
  private tick: ReturnType<typeof setInterval> | undefined;
  private queue: LatestQueue<RecognitionJob>;
  private modelGeneration = 0;
  private pending = new Set<string>();
  private ready = false;
  private sessionActive = false;
  constructor(
    private audio: AudioPort,
    private recognizer: Recognizer,
    private store: Store,
    prefs: Preferences,
    private now: () => number = () => performance.now(),
  ) {
    this.prefs = prefs;
    this.queue = new LatestQueue(
      async (job) => {
        const generation = this.modelGeneration;
        try {
          const text = await this.recognizer.run(job.blob);
          if (generation !== this.modelGeneration) return;
          const h = this.state.recent.find((h) => h.id === job.id);
          const all = h ? null : await this.store.history();
          if (generation !== this.modelGeneration) return;
          const original = h ?? all?.find((h) => h.id === job.id);
          if (original)
            await this.updateResult(job.id, {
              evaluation: "done",
              recognized: text,
              comparison: compare(text, original.prompt, this.prefs.words),
            });
        } catch (error) {
          if (generation === this.modelGeneration) {
            if (error instanceof RecognizerUnavailableError) {
              this.ready = false;
              this.queue.clear();
            }
            this.emit({ error: "recognition" });
            await this.updateResult(job.id, {
              evaluation: "error",
              ...(error instanceof RecognitionError
                ? { recognitionMessage: error.message }
                : {}),
            });
          }
        } finally {
          this.pending.delete(job.id);
        }
      },
      (id, skipReason) => {
        this.pending.delete(id);
        void this.updateResult(id, { evaluation: "skipped", skipReason });
      },
    );
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private emit(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((f) => f());
  }
  private async updateResult(id: string, update: Partial<History>) {
    try {
      await this.store.result(id, update);
      this.emit({
        recent: this.state.recent.map((h) =>
          h.id === id ? { ...h, ...update } : h,
        ),
      });
    } catch {
      this.emit({
        error: "storage",
        message:
          "履歴の保存に失敗しました。空き容量を確認しバックアップしてください。",
      });
    }
  }
  private elapsed() {
    return (
      this.elapsedBefore +
      (this.activeSince === null ? 0 : (this.now() - this.activeSince) / 1000)
    );
  }
  private startClock() {
    if (this.activeSince === null) this.activeSince = this.now();
    clearInterval(this.tick);
    this.tick = setInterval(() => this.emit({ elapsed: this.elapsed() }), 250);
  }
  private stopClock() {
    this.elapsedBefore = this.elapsed();
    this.activeSince = null;
    clearInterval(this.tick);
    this.emit({ elapsed: this.elapsedBefore });
    const latest = this.state.recent.find(
      (h) => h.session === this.state.session,
    );
    if (latest)
      void this.updateResult(latest.id, { elapsed: this.elapsedBefore });
  }
  private cancel() {
    this.token++;
    this.controller.abort();
    this.controller = new AbortController();
    this.audio.stop();
    this.stopClock();
    this.emit({ level: 0, voiced: false });
  }
  private disposeModel() {
    this.ready = false;
    this.modelGeneration++;
    this.queue.clear();
    for (const id of this.pending)
      void this.updateResult(id, {
        evaluation: "skipped",
        skipReason: "interrupted",
      });
    this.pending.clear();
    this.recognizer.dispose();
  }
  async start(prefs = this.prefs) {
    this.cancel();
    this.disposeModel();
    this.prefs = prefs;
    temporary.clear();
    this.played = "";
    this.cuePlayed = false;
    this.deck = new Deck(
      candidates(prefs.settings, prefs.words),
      prefs.settings.random,
    );
    const prompt = this.deck.next();
    this.sessionActive = !!prompt;
    this.elapsedBefore = 0;
    this.nextBoundary =
      prefs.settings.limit === "minutes"
        ? prefs.settings.limitValue * 60
        : prefs.settings.limitValue;
    this.emit({
      phase: "idle",
      prompt,
      repeat: false,
      count: 0,
      elapsed: 0,
      recent: [],
      session: crypto.randomUUID(),
      error: undefined,
    });
    if (!prompt) {
      this.emit({
        message:
          "この条件に合う教材がありません。音や位置を変えるか単語を追加してください。",
      });
      return;
    }
    await this.resume();
  }
  async resume() {
    if (
      !this.sessionActive ||
      !this.state.session ||
      !this.state.prompt ||
      !["paused", "idle"].includes(this.state.phase)
    )
      return;
    if (this.prefs.settings.evaluation && !this.ready) {
      this.emit({
        phase: "preparing",
        message:
          this.prefs.settings.model === "browser"
            ? "ブラウザの音声認識を準備中"
            : "モデルを準備中",
      });
      const token = this.token;
      try {
        await this.recognizer.load(
          this.prefs.settings.model,
          this.prefs.settings.device,
          (message) => {
            if (token === this.token) this.emit({ message });
          },
        );
        if (token !== this.token) return;
        this.ready = true;
      } catch (e) {
        if (token !== this.token) return;
        this.emit({
          error: "model-load",
          phase: "paused",
          message:
            e instanceof Error ? e.message : "モデルを読み込めませんでした。",
        });
        return;
      }
    }
    this.startClock();
    void this.cycle();
  }
  pause(message = "一時停止中。同じお題から再開できます。") {
    if (!this.sessionActive || this.state.phase === "boundary") return;
    const preparing = this.state.phase === "preparing";
    this.cancel();
    if (preparing) this.disposeModel();
    if (this.state.prompt) this.emit({ phase: "paused", message });
  }
  togglePause() {
    if (!this.sessionActive) {
      void this.start();
      return;
    }
    if (this.state.phase === "paused" || this.state.phase === "idle")
      void this.resume();
    else if (!["review", "boundary"].includes(this.state.phase)) this.pause();
  }
  toggleRepeat() {
    if (!this.sessionActive) return;
    this.emit({ repeat: !this.state.repeat });
  }
  back() {
    if (!this.sessionActive || !this.deck || this.state.phase === "boundary")
      return;
    this.pause();
    this.emit({
      prompt: this.deck.back() ?? this.state.prompt,
      repeat: true,
      message: "ひとつ戻りました。繰り返しで再開します。",
    });
  }
  canRetry(id: string) {
    const h = this.state.recent.find((h) => h.id === id);
    return !!(
      this.sessionActive &&
      this.state.phase !== "boundary" &&
      h?.session === this.state.session &&
      this.deck?.canReturnTo(h.prompt)
    );
  }
  retry(id: string) {
    if (!this.canRetry(id)) return;
    const h = this.state.recent.find((h) => h.id === id)!;
    this.pause();
    this.played = "";
    this.emit({
      prompt: this.deck!.returnTo(h.prompt),
      repeat: true,
      message: "このお題に戻りました。「再開」で繰り返し練習できます。",
    });
  }
  next() {
    if (!this.sessionActive || !this.deck || this.state.phase === "boundary")
      return;
    this.pause();
    this.emit({ prompt: this.deck.next(), repeat: false });
    void this.resume();
  }
  finishRecording() {
    this.audio.finish();
  }
  async sample() {
    if (
      !this.sessionActive ||
      !this.state.prompt ||
      this.state.phase === "boundary" ||
      this.prefs.settings.sample === "off"
    )
      return;
    this.pause();
    const token = this.token;
    try {
      if (this.audio.prepareCapture) {
        this.emit({ phase: "delay", message: "マイクを準備しています" });
        await this.audio.prepareCapture(
          this.prefs.settings,
          this.controller.signal,
        );
        if (token !== this.token) return;
      }
      this.emit({ phase: "sample", message: "見本を再生中" });
      await this.audio.speak(
        this.state.prompt.reading,
        this.prefs.settings,
        this.controller.signal,
        this.cuePlayed ? "next" : "start",
        this.state.prompt.repetitions,
      );
      if (token === this.token) {
        this.cuePlayed = true;
        this.played = this.state.prompt.id;
        this.emit({
          phase: "paused",
          message: "見本を再生しました。再開できます。",
        });
      }
    } catch (e) {
      if (token === this.token)
        this.pause(
          e instanceof Error ? e.message : "見本を再生できませんでした。",
        );
    } finally {
      if (token === this.token) this.audio.stop();
    }
  }
  async apply(prefs: Preferences) {
    const exercise = ({ settings: s, words }: Preferences) =>
      JSON.stringify([
        s.kind,
        s.kind === "single" && s.evaluation,
        s.sounds,
        s.vowels,
        s.pairOrder,
        s.positions,
        s.random,
        words,
      ]);
    const keepPrompt = !!this.deck && exercise(this.prefs) === exercise(prefs);
    const onlyVoice =
      JSON.stringify({
        ...prefs,
        settings: {
          ...prefs.settings,
          voice: this.prefs.settings.voice,
          rate: this.prefs.settings.rate,
        },
      }) === JSON.stringify(this.prefs);
    const sameLimit =
      prefs.settings.limit === this.prefs.settings.limit &&
      prefs.settings.limitValue === this.prefs.settings.limitValue;
    const ended = this.state.phase === "review";
    this.cancel();
    this.pause("設定を適用しました。新しい条件で再開できます。");
    if (!onlyVoice) this.disposeModel();
    this.prefs = prefs;
    this.played = "";
    if (!keepPrompt) {
      this.deck = new Deck(
        candidates(prefs.settings, prefs.words),
        prefs.settings.random,
      );
    }
    const prompt = keepPrompt ? this.state.prompt : this.deck!.next();
    this.emit({
      phase: ended ? "review" : this.sessionActive ? "paused" : "idle",
      prompt,
      repeat: keepPrompt ? this.state.repeat : false,
      ...(!prompt
        ? {
            message:
              "この条件に合う教材がありません。音や位置を変えるか単語を追加してください。",
          }
        : {}),
    });
    if (!keepPrompt || !sameLimit)
      this.nextBoundary =
        (prefs.settings.limit === "minutes"
          ? this.elapsed()
          : this.state.count) +
        (prefs.settings.limit === "minutes"
          ? prefs.settings.limitValue * 60
          : prefs.settings.limitValue);
  }
  async withoutEvaluation() {
    await this.apply({
      ...this.prefs,
      settings: { ...this.prefs.settings, evaluation: false },
    });
    await this.resume();
  }
  live(volume: number, effect: number, soundEffect: boolean) {
    this.prefs = {
      ...this.prefs,
      settings: { ...this.prefs.settings, volume, effect, soundEffect },
    };
  }
  updateThreshold(threshold: number) {
    this.prefs = {
      ...this.prefs,
      settings: { ...this.prefs.settings, threshold },
    };
  }
  continue() {
    if (this.state.phase !== "boundary") return;
    const s = this.prefs.settings;
    this.nextBoundary =
      (s.limit === "minutes" ? this.elapsed() : this.state.count) +
      (s.limit === "minutes" ? s.limitValue * 60 : s.limitValue);
    if (!this.state.repeat) this.emit({ prompt: this.deck?.next() });
    this.emit({ phase: "paused" });
    void this.resume();
  }
  end() {
    this.cancel();
    this.disposeModel();
    this.sessionActive = false;
    this.emit({
      phase: "review",
      message: "おつかれさまでした。録音を聞き返して振り返りましょう。",
    });
  }
  dispose() {
    this.cancel();
    this.disposeModel();
    this.listeners.clear();
  }
  reset() {
    this.cancel();
    this.disposeModel();
    this.deck = null;
    this.sessionActive = false;
    this.elapsedBefore = 0;
    this.emit({
      phase: "idle",
      prompt: undefined,
      session: "",
      recent: [],
      count: 0,
      elapsed: 0,
    });
  }
  forget(ids: string[]) {
    this.emit({ recent: this.state.recent.filter((h) => !ids.includes(h.id)) });
  }
  private async cycle() {
    const token = this.token,
      signal = this.controller.signal,
      prompt = this.state.prompt;
    if (!prompt) return;
    const s = this.prefs.settings;
    try {
      if (this.audio.prepareCapture) {
        this.emit({ phase: "delay", message: "マイクを準備しています" });
        await this.audio.prepareCapture(s, signal);
        if (token !== this.token) return;
      }
      if (
        s.sample === "always" ||
        (s.sample === "changed" && this.played !== prompt.id)
      ) {
        this.emit({ phase: "sample", message: "見本を再生中" });
        await this.audio.speak(
          prompt.reading,
          { ...s, volume: this.prefs.settings.volume },
          signal,
          this.cuePlayed ? "next" : "start",
          prompt.repetitions,
        );
        if (token !== this.token) return;
        this.cuePlayed = true;
        this.played = prompt.id;
      }
      if (s.delay > 0) {
        this.emit({ phase: "delay", message: "もうすぐ、あなたの番" });
        await wait(s.delay, signal);
      }
      if (this.audio.readyCue) {
        this.emit({
          phase: "delay",
          message: "合図のあと、声を出してください",
        });
        await this.audio.readyCue(
          { ...s, volume: this.prefs.settings.volume },
          signal,
        );
        if (token !== this.token) return;
      }
      this.emit({
        phase: "waiting",
        message: s.manual
          ? "録音開始を押してください"
          : "あなたの番。声を出してください",
      });
      const capture = await this.audio.capture(
        prompt.repetitions === 3
          ? { ...s, silence: Math.max(s.silence, 1100) }
          : s,
        signal,
        (level, voiced) => {
          if (token === this.token) this.emit({ level, voiced });
        },
        () => {
          if (token === this.token)
            this.emit({ phase: "recording", message: "録音中" });
        },
      );
      if (token !== this.token) return;
      const h: History = {
        id: crypto.randomUUID(),
        session: this.state.session,
        date: new Date().toISOString(),
        prompt: structuredClone(prompt),
        duration: capture.seconds,
        elapsed: this.elapsed(),
        model: s.evaluation
          ? s.model === "browser"
            ? "browser"
            : `${s.model}/${s.device}`
          : null,
        evaluation: s.evaluation ? "pending" : "off",
      };
      const modelGeneration = this.modelGeneration;
      await this.store.putHistory(h);
      if (h.session !== this.state.session) {
        if (s.evaluation)
          await this.updateResult(h.id, {
            evaluation: "skipped",
            skipReason: "interrupted",
          });
        return;
      }
      temporary.put(h.id, capture.blob);
      this.emit({
        count: this.state.count + 1,
        recent: [h, ...this.state.recent].slice(0, 20),
      });
      if (s.evaluation) {
        if (modelGeneration === this.modelGeneration && this.ready) {
          this.pending.add(h.id);
          this.queue.push({ id: h.id, blob: capture.blob });
        } else
          await this.updateResult(h.id, {
            evaluation: "skipped",
            skipReason: "interrupted",
          });
      }
      if (token !== this.token) return;
      if (s.soundEffect && this.audio.feedback)
        await this.audio.feedback(this.prefs.settings.volume, signal);
      if (s.playback) {
        this.emit({ phase: "playback", message: "あなたの声を聞き返し中" });
        await this.audio.play(
          capture.blob,
          { ...s, volume: this.prefs.settings.volume },
          signal,
        );
      }
      if (token !== this.token) return;
      if (capture.limit) {
        this.pause(
          `録音上限${s.maxSeconds}秒に達しました。同じお題で一時停止しました。`,
        );
        return;
      }
      if (
        (s.limit === "count" && this.state.count >= this.nextBoundary) ||
        (s.limit === "minutes" && this.elapsed() >= this.nextBoundary)
      ) {
        this.stopClock();
        this.emit({ phase: "boundary", message: "区切りに到達しました" });
        return;
      }
      if (!this.state.repeat) this.emit({ prompt: this.deck?.next() });
      void this.cycle();
    } catch (e) {
      if (token === this.token) {
        this.emit({ error: "audio" });
        this.pause(
          e instanceof Error ? e.message : "音声処理を完了できませんでした。",
        );
      }
    }
  }
}
