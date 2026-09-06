import { env } from "@huggingface/transformers";
import { createAdapter } from "./adapters";
import type { ModelAdapter } from "./adapters";
import { models, CACHE } from "./catalog";
env.allowLocalModels = false;
env.useBrowserCache = true;
env.useCustomCache = true;
env.customCache = {
  match: async (request: RequestInfo | URL) => {
    try {
      return await (await caches.open(CACHE)).match(request);
    } catch {
      return undefined;
    }
  },
  put: async (request: RequestInfo | URL, response: Response) => {
    try {
      await (await caches.open(CACHE)).put(request, response);
    } catch {
      /* キャッシュ不足でも推論は可能 */
    }
  },
};
// ランタイムのWASMもViteで固定版から配信する。
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url";
import wasmModuleUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url";
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = { wasm: wasmUrl, mjs: wasmModuleUrl };
  env.backends.onnx.wasm.numThreads = 1;
}
let recognizer: ModelAdapter | null = null;
self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      const m = models.find((m) => m.id === msg.model);
      if (!m) throw new Error("Unknown model");
      if (recognizer) await recognizer.dispose();
      recognizer = createAdapter(m);
      await recognizer.load(m, msg.device, (p) =>
        self.postMessage({ type: "progress", progress: p }),
      );
      self.postMessage({ type: "ready" });
    } else if (msg.type === "run") {
      if (!recognizer) throw new Error("Not ready");
      const text = await recognizer.transcribe(msg.pcm);
      self.postMessage({ type: "result", text });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      detail: msg.debug && error instanceof Error ? error.message : undefined,
    });
  }
};
