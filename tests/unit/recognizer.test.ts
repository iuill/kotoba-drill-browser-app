import { test, expect } from "bun:test";
import {
  WorkerRecognizer,
  RecognizerUnavailableError,
} from "../../src/models/recognition";

test("モデル取得は進捗で期限を延長し、停止時・Worker喪失時には再準備を要求する", async () => {
  const OriginalWorker = globalThis.Worker;
  const originalSet = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout;
  const deadlines = new Map<number, () => void>();
  let next = 1;
  class WorkerStub {
    static latest: WorkerStub;
    onmessage?: (event: { data: unknown }) => void;
    onerror?: () => void;
    terminated = false;
    constructor() {
      WorkerStub.latest = this;
    }
    postMessage() {}
    terminate() {
      this.terminated = true;
    }
  }
  globalThis.Worker = WorkerStub as unknown as typeof Worker;
  globalThis.setTimeout = ((fn: () => void, ms: number, ...args: unknown[]) => {
    if (ms === 300000) {
      const id = next++;
      deadlines.set(id, fn);
      return id;
    }
    return originalSet(fn, ms, ...args);
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => {
    if (!deadlines.delete(id)) originalClear(id);
  }) as typeof clearTimeout;
  const recognizer = new WorkerRecognizer();
  try {
    const loaded = recognizer.load("tiny", "wasm", () => {});
    const rejected = loaded.catch((error: unknown) => error);
    const worker = WorkerStub.latest;
    const first = [...deadlines.keys()][0];
    worker.onmessage?.({
      data: {
        type: "progress",
        progress: {
          status: "progress",
          file: "model",
          loaded: 100,
          total: 1000,
        },
      },
    });
    expect(deadlines.has(first)).toBe(false);
    const second = [...deadlines.keys()][0];
    worker.onmessage?.({
      data: {
        type: "progress",
        progress: {
          status: "progress",
          file: "model",
          loaded: 100,
          total: 1000,
        },
      },
    });
    expect([...deadlines.keys()]).toEqual([second]);
    deadlines.get(second)!();
    expect(await rejected).toBeInstanceOf(RecognizerUnavailableError);
    expect(worker.terminated).toBe(true);
    const retry = recognizer.load("tiny", "wasm", () => {});
    WorkerStub.latest.onmessage?.({ data: { type: "ready" } });
    await retry;
    WorkerStub.latest.onerror?.();
    expect(WorkerStub.latest.terminated).toBe(true);
    await expect(recognizer.run(new Blob())).rejects.toBeInstanceOf(
      RecognizerUnavailableError,
    );
  } finally {
    recognizer.dispose();
    globalThis.Worker = OriginalWorker;
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});
