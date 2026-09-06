import { VoiceGate } from "./voiceGate";
import type { Settings } from "../core/types";
import { recordedFile, recordedVoice } from "./sampleVoices";
import {
  AudioSpectrum,
  type SpectrumKind,
  type SpectrumScope,
} from "./spectrum";
export interface Capture {
  blob: Blob;
  seconds: number;
  limit: boolean;
}
export interface AudioPort {
  prepareCapture?(s: Settings, signal: AbortSignal): Promise<void>;
  speak(
    text: string,
    s: Settings,
    signal: AbortSignal,
    cue?: "start" | "next",
    repetitions?: 1 | 3,
  ): Promise<void>;
  play(blob: Blob, s: Settings, signal: AbortSignal): Promise<void>;
  readyCue?(s: Settings, signal: AbortSignal): Promise<void>;
  capture(
    s: Settings,
    signal: AbortSignal,
    onLevel: (level: number, voiced: boolean) => void,
    onRecording: () => void,
  ): Promise<Capture>;
  feedback?(volume: number, signal: AbortSignal): Promise<void>;
  finish(): void;
  stop(): void;
}
export const aborted = () => new DOMException("中断", "AbortError");
export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(aborted());
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      reject(aborted());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}
export function japaneseVoices() {
  return typeof speechSynthesis === "undefined"
    ? []
    : speechSynthesis
        .getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith("ja"));
}
export class BrowserAudio implements AudioPort {
  constructor(
    readonly spectrum = new AudioSpectrum(),
    private readonly compare = true,
  ) {}
  private monitor(
    context: AudioContext,
    source: AudioNode,
    kind: SpectrumKind,
    scope?: SpectrumScope,
  ) {
    try {
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      const clear = this.spectrum.attach(kind, analyser, scope);
      return () => {
        clear();
        source.disconnect(analyser);
        analyser.disconnect();
      };
    } catch {
      return this.spectrum.attach("unavailable");
    }
  }
  private prepared: {
    stream: MediaStream;
    context: AudioContext;
    signal: AbortSignal;
    microphone: string;
    release: () => void;
  } | null = null;
  private finishCapture: () => void = () => {};
  private activeStop: () => void = () => {};
  finish() {
    this.finishCapture();
  }
  stop() {
    this.prepared?.release();
    this.activeStop();
  }
  async speak(
    text: string,
    s: Settings,
    signal: AbortSignal,
    cue?: "start" | "next",
    repetitions: 1 | 3 = 1,
  ) {
    if (signal.aborted) throw aborted();
    const file = recordedFile(text, s.voice);
    // 読み込みを済ませてから合図を鳴らし、合図直後に見本を開始する。
    const recorded = file ? await this.loadSample(file, signal) : undefined;
    const voices = japaneseVoices();
    if (!recorded && !voices.length)
      throw new Error(
        recordedVoice(s.voice)
          ? "このお題は未収録です。ブラウザの日本語音声を追加するか、見本をオフにしてください。"
          : "日本語の見本音声がありません。収録音声を選ぶか、OSに音声を追加してください。",
      );
    if (cue)
      await this.playCue(
        cue === "start" ? "practice-start.ogg" : "practice-next.ogg",
        s,
        signal,
      );
    if (signal.aborted) throw aborted();
    const scope = this.compare ? this.spectrum.beginReference(text) : undefined;
    for (let i = 0; i < repetitions; i++) {
      if (i > 0) await wait(300, signal);
      if (signal.aborted) throw aborted();
      if (recorded)
        await this.playAudio(
          recorded,
          s,
          signal,
          s.rate,
          "見本音声",
          "sample",
          scope,
        );
      else await this.speakBrowser(text, s, signal, voices);
    }
  }
  private speakBrowser(
    text: string,
    s: Settings,
    signal: AbortSignal,
    voices: SpeechSynthesisVoice[],
  ) {
    return new Promise<void>((resolve, reject) => {
      const clearSpectrum = this.spectrum.attach("browser");
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.voice = voices.find((v) => v.voiceURI === s.voice) ?? voices[0];
      u.rate = s.rate;
      u.volume = s.volume;
      const cleanup = () => {
        clearSpectrum();
        u.onend = null;
        u.onerror = null;
        signal.removeEventListener("abort", stop);
        clearTimeout(timer);
        if (this.activeStop === stop) this.activeStop = () => {};
      };
      const stop = () => {
        cleanup();
        speechSynthesis.cancel();
        reject(aborted());
      };
      const timer = setTimeout(() => {
        cleanup();
        speechSynthesis.cancel();
        reject(
          new Error(
            "見本音声が応答しません。再試行または見本オフを選んでください。",
          ),
        );
      }, 30000);
      u.onend = () => {
        cleanup();
        resolve();
      };
      u.onerror = () => {
        cleanup();
        reject(new Error("見本音声を再生できませんでした。"));
      };
      this.activeStop = stop;
      signal.addEventListener("abort", stop, { once: true });
      speechSynthesis.speak(u);
    });
  }
  private async loadSample(file: string, signal: AbortSignal) {
    const controller = new AbortController();
    const stop = () => controller.abort();
    this.activeStop = stop;
    const timer = setTimeout(
      () => controller.abort(new Error("読み込み時間超過")),
      30000,
    );
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${file}`, {
        signal: AbortSignal.any([signal, controller.signal]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } catch (error) {
      if (
        signal.aborted ||
        (controller.signal.aborted &&
          controller.signal.reason?.name === "AbortError")
      )
        throw aborted();
      throw new Error(
        "収録した見本音声を読み込めませんでした。再試行するか、ブラウザ音声を選んでください。",
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
      if (this.activeStop === stop) this.activeStop = () => {};
    }
  }
  private async playCue(file: string, s: Settings, signal: AbortSignal) {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/${file}`, {
      signal,
    });
    if (!response.ok) throw new Error("合図の音を読み込めませんでした。");
    await this.playAudio(
      await response.blob(),
      { ...s, volume: s.volume * 0.55 },
      signal,
      1,
      "合図",
      null,
    );
  }
  async readyCue(s: Settings, signal: AbortSignal) {
    await this.playCue("record-ready-chime.ogg", s, signal);
  }
  async play(blob: Blob, s: Settings, signal: AbortSignal) {
    return this.playAudio(
      blob,
      s,
      signal,
      1,
      "録音",
      "playback",
      this.spectrum.playbackScope(blob),
    );
  }
  private async playAudio(
    blob: Blob,
    s: Settings,
    signal: AbortSignal,
    rate = 1,
    name = "録音",
    kind: SpectrumKind | null = "playback",
    scope?: SpectrumScope,
  ) {
    if (signal.aborted) throw aborted();
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = s.volume;
      audio.playbackRate = rate;
      audio.preservesPitch = true;
      let context: AudioContext | undefined;
      let source: MediaElementAudioSourceNode | undefined;
      let ownsContext = false;
      let clearSpectrum = () => {};
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearSpectrum();
        source?.disconnect();
        if (ownsContext && context?.state !== "closed") void context?.close();
        audio.onended = null;
        audio.onerror = null;
        clearTimeout(timer);
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(url);
        signal.removeEventListener("abort", stop);
        if (this.activeStop === stop) this.activeStop = () => {};
      };
      const stop = () => {
        cleanup();
        reject(aborted());
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${name}の再生が完了しませんでした。`));
      }, 65000);
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error(`${name}を再生できませんでした。`));
      };
      signal.addEventListener("abort", stop, { once: true });
      this.activeStop = stop;
      let ready = Promise.resolve();
      if (kind) {
        try {
          context = this.prepared?.context ?? new AudioContext();
          ownsContext = context !== this.prepared?.context;
          source = context.createMediaElementSource(audio);
          source.connect(context.destination);
          clearSpectrum = this.monitor(context, source, kind, scope);
          ready = context.resume();
        } catch {
          if (source) {
            cleanup();
            reject(new Error(`${name}の再生経路を準備できませんでした。`));
            return;
          }
          // 解析用の経路を作れない場合も、通常の音声再生は残す。
          if (ownsContext) void context?.close();
          context = undefined;
          clearSpectrum = this.spectrum.attach("unavailable");
        }
      }
      ready
        .then(() => {
          if (!settled) return audio.play();
        })
        .catch(() => {
          if (settled) return;
          cleanup();
          reject(
            new Error(
              "再生を開始できませんでした。再開ボタンを押してください。",
            ),
          );
        });
    });
  }
  async prepareCapture(s: Settings, signal: AbortSignal) {
    if (
      this.prepared?.signal === signal &&
      this.prepared.microphone === s.microphone &&
      !signal.aborted
    )
      return;
    this.prepared?.release();
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("マイクにはlocalhostまたはHTTPS接続が必要です。");
    if (signal.aborted) throw aborted();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: s.microphone ? { exact: s.microphone } : undefined,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    if (signal.aborted) {
      stream.getTracks().forEach((t) => t.stop());
      throw aborted();
    }
    const context = new AudioContext();
    try {
      await context.resume();
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      await context.close();
      throw e;
    }
    if (signal.aborted) {
      stream.getTracks().forEach((t) => t.stop());
      await context.close();
      throw aborted();
    }

    const release = () => {
      signal.removeEventListener("abort", release);
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      if (this.prepared?.stream === stream) this.prepared = null;
    };
    this.prepared = {
      stream,
      context,
      signal,
      microphone: s.microphone,
      release,
    };
    signal.addEventListener("abort", release, { once: true });
  }
  async capture(
    s: Settings,
    signal: AbortSignal,
    onLevel: (level: number, voiced: boolean) => void,
    onRecording: () => void,
  ): Promise<Capture> {
    await this.prepareCapture(s, signal);
    signal.throwIfAborted();
    const ready = this.prepared!;
    this.prepared = null;
    signal.removeEventListener("abort", ready.release);
    const { stream, context } = ready;
    return new Promise<Capture>((resolve, reject) => {
      const source = context.createMediaStreamSource(stream),
        analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      // 検知より150ms遅らせて録音することで、開始判断前の子音も取り込む。
      // スピーカーには接続しない。待機中の録音ファイルは作らない。
      const delay = context.createDelay(0.2);
      delay.delayTime.value = 0.15;
      const recordingDestination = context.createMediaStreamDestination();
      source.connect(delay);
      delay.connect(recordingDestination);
      const data = new Float32Array(analyser.fftSize);
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(recordingDestination.stream, {
          ...(mime ? { mimeType: mime } : {}),
          audioBitsPerSecond: 96000,
        });
      } catch (e) {
        source.disconnect();
        delay.disconnect();
        recordingDestination.stream.getTracks().forEach((t) => t.stop());
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
        reject(e);
        return;
      }
      const chunks: Blob[] = [];
      const scope = this.compare ? this.spectrum.beginRecording() : undefined;
      const clearSpectrum = this.monitor(context, source, "microphone", scope);
      let started = 0,
        finishedAt = 0,
        limited = false,
        settled = false;
      let drainTimer: ReturnType<typeof setTimeout> | undefined;
      const gate = new VoiceGate(s, performance.now());
      const cleanup = () => {
        clearSpectrum();
        clearInterval(timer);
        clearTimeout(drainTimer);
        signal.removeEventListener("abort", stop);
        this.finishCapture = () => {};
        this.activeStop = () => {};
        source.disconnect();
        delay.disconnect();
        recordingDestination.stream.getTracks().forEach((t) => t.stop());
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
        onLevel(0, false);
      };
      const stop = () => {
        if (settled) return;
        settled = true;
        if (recorder.state !== "inactive") recorder.stop();
        cleanup();
        reject(aborted());
      };
      const finish = () => {
        if (!started || finishedAt || recorder.state !== "recording") return;
        finishedAt = performance.now();
        clearInterval(timer);
        // 正常終了は遅延ノード内の末尾を送り切る。中断時は即座に破棄する。
        drainTimer = setTimeout(() => {
          if (!settled && recorder.state === "recording") recorder.stop();
        }, 180);
      };
      const begin = () => {
        if (started) return;
        started = performance.now();
        gate.begin(started);
        recorder.start(200);
        onRecording();
      };
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("録音に失敗しました。マイクを確認してください。"));
      };
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        const seconds = ((finishedAt || performance.now()) - started) / 1000;
        cleanup();
        const blob = new Blob(chunks, { type: recorder.mimeType });
        this.spectrum.tagRecording(blob, scope);
        resolve({
          blob,
          seconds,
          limit: limited,
        });
      };
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        const level = Math.sqrt(
          data.reduce((n, v) => n + v * v, 0) / data.length,
        );
        const voiced = level >= s.threshold;
        onLevel(level, voiced);
        const now = performance.now();
        const action = gate.update(now, level);
        if (action === "start") begin();
        else if (action === "limit") {
          limited = true;
          finish();
        } else if (action === "finish") finish();
        else if (action === "no-speech") {
          settled = true;
          cleanup();
          reject(
            new Error(
              "30秒間、発声がありませんでした。同じお題から再開できます。",
            ),
          );
        }
      }, 40);
      signal.addEventListener("abort", stop, { once: true });
      this.activeStop = stop;
      this.finishCapture = () => {
        if (started) finish();
        else begin();
      };
    });
  }
  async feedback(volume: number, signal: AbortSignal) {
    const context = new AudioContext();
    try {
      await context.resume();
      if (signal.aborted) throw aborted();
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.frequency.value = 520;
      gain.gain.setValueAtTime(volume * 0.05, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.1);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      await wait(150, signal);
    } finally {
      await context.close();
    }
  }
  async calibrate(
    microphone: string,
    signal: AbortSignal,
    onLevel: (n: number) => void,
    onRemaining?: (milliseconds: number) => void,
  ) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: microphone ? { exact: microphone } : undefined,
        autoGainControl: false,
        noiseSuppression: false,
      },
    });
    if (signal.aborted) {
      stream.getTracks().forEach((t) => t.stop());
      throw aborted();
    }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream),
      analyser = ctx.createAnalyser();
    src.connect(analyser);
    const data = new Float32Array(1024);
    analyser.fftSize = 1024;
    let max = 0;
    try {
      await ctx.resume();
      signal.throwIfAborted();
      onRemaining?.(3000);
      for (let i = 0; i < 60; i++) {
        analyser.getFloatTimeDomainData(data);
        const n = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        max = Math.max(max, n);
        onLevel(n);
        await wait(50, signal);
        onRemaining?.((59 - i) * 50);
      }
      return Math.min(0.5, Math.max(0.008, max * 2.5));
    } finally {
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close();
    }
  }
}
export async function pcm16k(blob: Blob) {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * 16000),
      16000,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    await ctx.close();
  }
}
