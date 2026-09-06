// 通常CIには含めない。明示実行時のみ、モデルを取得し無音で配線を確認する。
import { chromium } from "@playwright/test";
import { readdir } from "node:fs/promises";
const workerFile = (await readdir("dist/assets")).find((f) =>
  /^recognition.worker-.*\.js$/.test(f),
);
const device = process.env.SMOKE_DEVICE ?? "wasm";
const browser = await chromium.launch({
  args:
    device === "webgpu"
      ? ["--enable-unsafe-webgpu", "--use-angle=swiftshader"]
      : [],
});
try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error")
      console.log("browser error:", m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.goto(process.env.SMOKE_URL ?? "http://127.0.0.1:4174");
  for (const model of (process.env.SMOKE_MODELS ?? "tiny,base").split(",")) {
    console.log("Loading", model);
    const result = await page.evaluate(
      async ({ workerFile, model, device }) => {
        const worker = new Worker(`/assets/${workerFile}`, { type: "module" });
        const started = performance.now();
        let loaded = 0;
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error("model timeout"));
          }, 240000);
          worker.onerror = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error(e.message));
          };
          worker.onmessage = (e) => {
            if (e.data.type === "ready") {
              loaded = performance.now();
              worker.postMessage({
                type: "run",
                pcm: new Float32Array(16000),
                debug: true,
              });
            } else if (e.data.type === "result") {
              clearTimeout(timeout);
              worker.terminate();
              resolve({
                loadSeconds: (loaded - started) / 1000,
                inferenceSeconds: (performance.now() - loaded) / 1000,
                output: e.data.text,
              });
            } else if (e.data.type === "error") {
              clearTimeout(timeout);
              worker.terminate();
              reject(new Error(e.data.detail ?? "Worker model error"));
            }
          };
          worker.postMessage({ type: "load", model, device, debug: true });
        });
      },
      { workerFile, model, device },
    );
    console.log(model, JSON.stringify(result));
  }
  const size = await page.evaluate(async () => {
    const cache = await caches.open("kotoba-models-v1");
    const keys = await cache.keys();
    return {
      files: keys.length,
      bytes: (
        await Promise.all(
          keys.map(async (key) => (await (await cache.match(key)).blob()).size),
        )
      ).reduce((a, b) => a + b, 0),
    };
  });
  console.log("cache", size);
} finally {
  await browser.close();
}
