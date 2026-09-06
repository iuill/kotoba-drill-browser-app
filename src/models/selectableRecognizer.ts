import { BrowserSpeechRecognizer } from "./browserSpeech";
import { RecognizerUnavailableError, WorkerRecognizer } from "./recognition";
import type { Recognizer } from "./recognition";

export class SelectableRecognizer implements Recognizer {
  private current: Recognizer | null = null;
  async load(
    model: string,
    device: "wasm" | "webgpu",
    progress: (text: string) => void,
  ) {
    this.dispose();
    const recognizer =
      model === "browser"
        ? new BrowserSpeechRecognizer()
        : new WorkerRecognizer();
    this.current = recognizer;
    try {
      await recognizer.load(model, device, progress);
    } catch (error) {
      if (this.current === recognizer) this.dispose();
      throw error;
    }
  }
  run(blob: Blob) {
    if (!this.current)
      return Promise.reject(
        new RecognizerUnavailableError("音声認識の再準備が必要です。"),
      );
    return this.current.run(blob);
  }
  dispose() {
    this.current?.dispose();
    this.current = null;
  }
}
