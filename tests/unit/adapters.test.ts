import { test, expect, mock } from "bun:test";
const loaded: Record<string, unknown>[] = [];
const calls: Record<string, unknown>[] = [];
let disposed = 0;
mock.module("@huggingface/transformers", () => ({
  pipeline: async (
    _task: string,
    _repo: string,
    options: Record<string, unknown>,
  ) => {
    loaded.push(options);
    return Object.assign(
      async (_pcm: Float32Array, options: Record<string, unknown>) => {
        calls.push(options);
        return { text: "聞き取り" };
      },
      {
        dispose: async () => {
          disposed++;
        },
      },
    );
  },
}));
const { createAdapter } = await import("../../src/models/adapters");
const { models } = await import("../../src/models/catalog");
test("モデル別アダプターが言語・量子化・固定版を指定し、お題は渡さない", async () => {
  for (const model of models) {
    const adapter = createAdapter(model);
    await adapter.load(
      model,
      model.family === "cohere" ? "webgpu" : "wasm",
      () => {},
    );
    expect(loaded.at(-1)?.revision).toBe(model.revision);
    expect(await adapter.transcribe(new Float32Array(1))).toBe("聞き取り");
    expect(calls.at(-1)?.language).toBe(
      model.family === "cohere" ? "ja" : "japanese",
    );
    expect(calls.at(-1)?.prompt).toBeUndefined();
    expect(loaded.at(-1)?.dtype).toBe(model.family === "cohere" ? "q4" : "q8");
    await adapter.dispose();
  }
  expect(disposed).toBe(models.length);
  const cohere = createAdapter(models.find((m) => m.id === "cohere")!);
  await expect(
    cohere.load(models.find((m) => m.id === "cohere")!, "wasm", () => {}),
  ).rejects.toThrow("WebGPU");
});
