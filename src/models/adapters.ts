import { pipeline } from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { Model } from "./catalog";
export interface ModelAdapter {
  load(
    model: Model,
    device: "wasm" | "webgpu",
    progress: (p: unknown) => void,
  ): Promise<void>;
  transcribe(pcm: Float32Array): Promise<string>;
  dispose(): Promise<void>;
}
abstract class PipelineAdapter implements ModelAdapter {
  protected pipeline: AutomaticSpeechRecognitionPipeline | null = null;
  abstract dtype: "q8" | "q4";
  abstract options: Record<string, unknown>;
  async load(
    model: Model,
    device: "wasm" | "webgpu",
    progress: (p: unknown) => void,
  ) {
    if (model.family === "cohere" && device !== "webgpu") {
      throw new Error("Cohere Transcribeのこの配布形式にはWebGPUが必要です。");
    }
    const create = pipeline as (
      task: "automatic-speech-recognition",
      model: string,
      options: Record<string, unknown>,
    ) => Promise<AutomaticSpeechRecognitionPipeline>;
    this.pipeline = await create("automatic-speech-recognition", model.repo, {
      revision: model.revision,
      device,
      dtype: this.dtype,
      // 固定したWhisper q8グラフはORT 1.26のQDQ最適化と互換性がない。
      // 同じ重みで実行できるよう、Whisperだけグラフ最適化を無効にする。
      ...(model.family === "whisper"
        ? { session_options: { graphOptimizationLevel: "disabled" } }
        : {}),
      progress_callback: progress,
    });
  }
  async transcribe(pcm: Float32Array) {
    if (!this.pipeline) throw new Error("Model is not ready");
    const result = await this.pipeline(pcm, {
      ...this.options,
      max_new_tokens: 128,
    });
    return Array.isArray(result) ? result[0].text : result.text;
  }
  async dispose() {
    await this.pipeline?.dispose();
    this.pipeline = null;
  }
}
class WhisperAdapter extends PipelineAdapter {
  dtype = "q8" as const;
  options = {
    language: "japanese",
    task: "transcribe",
    return_timestamps: false,
  };
}
class CohereAdapter extends PipelineAdapter {
  dtype = "q4" as const;
  options = { language: "ja" };
}
export function createAdapter(model: Model): ModelAdapter {
  return model.family === "cohere" ? new CohereAdapter() : new WhisperAdapter();
}
