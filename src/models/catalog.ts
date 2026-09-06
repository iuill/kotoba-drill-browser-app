export const models = [
  {
    id: "tiny",
    family: "whisper",
    name: "Whisper Tiny",
    repo: "onnx-community/whisper-tiny",
    revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
    mb: 70,
    description: "軽量・速度優先。",
  },
  {
    id: "base",
    family: "whisper",
    name: "Whisper Base",
    repo: "onnx-community/whisper-base",
    revision: "1846881b6b3a3024392c1eea3ad983695bc23925",
    mb: 110,
    description: "Tinyより大きい比較候補。",
  },
  {
    id: "small",
    family: "whisper",
    name: "Whisper Small",
    repo: "onnx-community/whisper-small",
    revision: "36050c46d777d46dc4b5f43f6d90574fc38f8732",
    mb: 280,
    description: "Tiny／Baseより大きい比較候補。日本語指定、q8版。",
  },
  {
    id: "kotoba",
    family: "whisper",
    name: "Kotoba-Whisper v2.2",
    repo: "onnx-community/kotoba-whisper-v2.2-ONNX",
    revision: "6da07195e83145e4fca2a8a1ba6f4c2e837b3798",
    mb: 1100,
    description: "日本語向けWhisperの比較候補。取得約1.1GB。",
  },
  {
    id: "cohere",
    family: "cohere",
    name: "Cohere Transcribe",
    repo: "onnx-community/cohere-transcribe-03-2026-ONNX",
    revision: "31b1c6211c9000d76b077ddd23b74c9090badeba",
    mb: 2200,
    description:
      "Whisper以外の比較候補。日本語対応、q4版。取得約2.2GB。WebGPU専用。",
  },
] as const;
export type Model = (typeof models)[number];
export const CACHE = "kotoba-models-v1";
export async function cacheSizes() {
  if (!("caches" in globalThis)) return new Map<string, number>();
  const cache = await caches.open(CACHE);
  const result = new Map<string, number>();
  for (const key of await cache.keys()) {
    const model = models.find((m) => key.url.includes(m.repo));
    if (model) {
      const response = await cache.match(key);
      const size =
        Number(response?.headers.get("content-length")) ||
        (await response?.blob())?.size ||
        0;
      result.set(model.id, (result.get(model.id) ?? 0) + size);
    }
  }
  return result;
}
export async function deleteModel(id: string) {
  const m = models.find((m) => m.id === id);
  if (!m) return;
  const cache = await caches.open(CACHE);
  for (const key of await cache.keys())
    if (key.url.includes(m.repo)) await cache.delete(key);
}
