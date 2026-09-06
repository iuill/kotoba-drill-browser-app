import { pcm16k } from "../audio/browserAudio";
import { DownloadProgress } from "./downloadProgress";
export interface RecognitionJob {
  id: string;
  blob: Blob;
}
export class LatestQueue<T extends { id: string }> {
  private active = false;
  private waiting: T | undefined;
  private generation = 0;
  constructor(
    private run: (job: T) => Promise<void>,
    private skipped: (id: string, reason: "backlog" | "interrupted") => void,
  ) {}
  push(job: T) {
    if (this.active) {
      if (this.waiting) this.skipped(this.waiting.id, "backlog");
      this.waiting = job;
    } else void this.execute(job);
  }
  private async execute(job: T) {
    this.active = true;
    const generation = this.generation;
    try {
      await this.run(job);
    } finally {
      if (generation !== this.generation) return;
      this.active = false;
      const next = this.waiting;
      this.waiting = undefined;
      if (next) void this.execute(next);
    }
  }
  clear() {
    if (this.waiting) this.skipped(this.waiting.id, "interrupted");
    this.waiting = undefined;
    this.generation++;
    this.active = false;
  }
}
export interface Recognizer {
  load(
    model: string,
    device: "wasm" | "webgpu",
    progress: (text: string) => void,
  ): Promise<void>;
  run(blob: Blob): Promise<string>;
  dispose(): void;
}
export class RecognitionError extends Error {}
export class RecognizerUnavailableError extends Error {}
export class WorkerRecognizer implements Recognizer {
  private worker: Worker | null = null;
  private pending: ((e: MessageEvent) => void) | null = null;
  private rejectPending: ((error: Error) => void) | null = null;
  private generation = 0;
  private request(
    message: object,
    transfers: Transferable[] = [],
    progress?: (s: string) => void,
  ) {
    return new Promise<string>((resolve, reject) => {
      const downloadProgress = new DownloadProgress();
      if (!this.worker) {
        reject(
          new RecognizerUnavailableError("認識モデルの再準備が必要です。"),
        );
        return;
      }
      const timeout = () =>
        this.dispose(
          new RecognizerUnavailableError(
            progress
              ? "モデル取得・準備が5分間進みませんでした。再試行してください。"
              : "認識がタイムアウトしました。再試行してください。",
          ),
        );
      let timer = setTimeout(timeout, 300000);
      const loaded = new Map<string, number>();
      const cleanup = () => {
        clearTimeout(timer);
        this.pending = null;
        this.rejectPending = null;
      };
      this.rejectPending = (e) => {
        cleanup();
        reject(e);
      };
      this.pending = (e) => {
        if (e.data.type === "progress") {
          const p = e.data.progress;
          const key = p.file ?? "total";
          if (
            progress &&
            typeof p.loaded === "number" &&
            p.loaded > (loaded.get(key) ?? 0)
          ) {
            loaded.set(key, p.loaded);
            clearTimeout(timer);
            timer = setTimeout(timeout, 300000);
          }
          const text = downloadProgress.update(e.data.progress);
          if (text) progress?.(text);
        } else {
          cleanup();
          if (e.data.type === "error")
            reject(
              new Error(
                "モデル処理に失敗しました。再試行、処理方式の変更、または評価なしで練習できます。",
              ),
            );
          else resolve(e.data.text ?? "");
        }
      };
      this.worker.postMessage(message, transfers);
    });
  }
  async load(
    model: string,
    device: "wasm" | "webgpu",
    progress: (s: string) => void,
  ) {
    this.dispose();
    const generation = this.generation;
    if (model === "cohere" && device !== "webgpu")
      throw new Error(
        "Cohere TranscribeはWebGPUを選択してください。CPUでは使えません。",
      );
    if (device === "webgpu") {
      const gpu = (
        navigator as Navigator & {
          gpu?: { requestAdapter: () => Promise<unknown> };
        }
      ).gpu;
      if (!gpu || !(await gpu.requestAdapter()))
        throw new Error(
          "WebGPUを利用できません。対応するEdge／ChromeとGPUを確認するか、WhisperのCPU方式を選んでください。",
        );
    }
    if (generation !== this.generation)
      throw new Error("認識準備を中断しました。");
    this.worker = new Worker(
      new URL("./recognition.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (e) => this.pending?.(e);
    this.worker.onerror = () =>
      this.dispose(
        new RecognizerUnavailableError(
          "認識Workerが停止しました。再試行してください。",
        ),
      );
    await this.request({ type: "load", model, device }, [], progress);
  }
  async run(blob: Blob) {
    if (!this.worker)
      throw new RecognizerUnavailableError("認識モデルの再準備が必要です。");
    const generation = this.generation;
    const pcm = await pcm16k(blob);
    if (generation !== this.generation) throw new Error("認識を中断しました。");
    return this.request({ type: "run", pcm }, [pcm.buffer]);
  }
  dispose(error = new Error("認識を中断しました。")) {
    this.generation++;
    this.rejectPending?.(error);
    this.worker?.terminate();
    this.worker = null;
  }
}
