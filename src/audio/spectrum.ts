export type SpectrumKind =
  | "idle"
  | "sample"
  | "playback"
  | "microphone"
  | "browser"
  | "unavailable";
export type SpectrumSlot = "reference" | "recording";
export interface SpectrumScope {
  key: string;
  slot?: SpectrumSlot;
}
export const spectrumBands = 48;

export class AudioSpectrum {
  private kind: SpectrumKind = "idle";
  private frame: {
    analyser: AnalyserNode;
    values: Float32Array<ArrayBuffer>;
    bands: Float32Array<ArrayBuffer>;
    sampleRate: number;
    fftSize: number;
    scope?: SpectrumScope;
  } | null = null;
  private listeners = new Set<() => void>();
  private generation = 0;
  private version = 0;
  private key = "";
  private reading = "";
  private peaks: Record<SpectrumSlot, Float32Array | null> = {
    reference: null,
    recording: null,
  };
  private recordings = new WeakMap<Blob, string>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.kind;
  getVersion = () => this.version;
  private notify() {
    this.version++;
    this.listeners.forEach((listener) => listener());
  }
  setContext(key: string, reading: string) {
    if (key === this.key && reading === this.reading) return;
    this.key = key;
    this.reading = reading;
    this.peaks = { reference: null, recording: null };
    // 再生中にお題を変えても、前のお題の観測を新しい比較へ入れない。
    if (this.frame) this.frame.scope = undefined;
    this.notify();
  }
  beginReference(reading: string): SpectrumScope | undefined {
    if (!this.key || reading !== this.reading) return;
    this.peaks = { reference: null, recording: null };
    this.notify();
    return { key: this.key, slot: "reference" };
  }
  beginRecording(): SpectrumScope | undefined {
    if (!this.key) return;
    this.peaks.recording = null;
    this.notify();
    return { key: this.key };
  }
  tagRecording(blob: Blob, scope?: SpectrumScope) {
    if (scope) this.recordings.set(blob, scope.key);
  }
  playbackScope(blob: Blob): SpectrumScope | undefined {
    const key = this.recordings.get(blob);
    if (!key || key !== this.key) return;
    this.peaks.recording = null;
    this.notify();
    return { key, slot: "recording" };
  }
  getPeaks() {
    if (this.kind !== "idle" && this.frame?.scope?.key !== this.key)
      return { reference: null, recording: null };
    return this.peaks;
  }
  attach(kind: SpectrumKind, analyser?: AnalyserNode, scope?: SpectrumScope) {
    const generation = ++this.generation;
    const frame = analyser
      ? {
          analyser,
          values: new Float32Array(analyser.frequencyBinCount).fill(-Infinity),
          bands: new Float32Array(spectrumBands).fill(-Infinity),
          sampleRate: analyser.context.sampleRate,
          fftSize: analyser.fftSize,
          scope,
        }
      : null;
    this.frame = frame;
    this.kind = kind;
    // 観測周期は描画・動きを減らす設定から独立。音声参照は終了時に解放する。
    const timer = frame
      ? setInterval(() => {
          if (
            this.frame !== frame ||
            frame.analyser.context.state !== "running"
          )
            return;
          frame.analyser.getFloatFrequencyData(frame.values);
          const bin = frame.sampleRate / frame.fftSize;
          for (let i = 0; i < spectrumBands; i++) {
            const low = 50 * 160 ** (i / spectrumBands);
            const high = 50 * 160 ** ((i + 1) / spectrumBands);
            const from = Math.max(1, Math.ceil(low / bin));
            const to = Math.min(
              frame.values.length,
              Math.max(from + 1, Math.ceil(high / bin)),
            );
            let peak = -Infinity;
            for (let j = from; j < to; j++)
              peak = Math.max(peak, frame.values[j]);
            frame.bands[i] = peak;
          }
          const slot = frame.scope?.slot;
          if (
            slot &&
            frame.scope?.key === this.key &&
            frame.bands.some((n) => n > -90)
          ) {
            const first = !this.peaks[slot];
            const held =
              this.peaks[slot] ??
              new Float32Array(spectrumBands).fill(-Infinity);
            for (let i = 0; i < spectrumBands; i++)
              held[i] = Math.max(held[i], frame.bands[i]);
            this.peaks[slot] = held;
            if (first) this.notify();
          }
        }, 50)
      : undefined;
    this.notify();
    return () => {
      clearInterval(timer);
      if (generation !== this.generation) return;
      this.frame = null;
      this.kind = "idle";
      this.notify();
    };
  }
  read() {
    if (!this.frame || this.frame.analyser.context.state === "closed")
      return null;
    return this.frame;
  }
}
