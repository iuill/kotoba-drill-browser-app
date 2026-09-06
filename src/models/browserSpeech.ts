import { RecognitionError, RecognizerUnavailableError } from "./recognition";
import type { Recognizer } from "./recognition";

interface SpeechResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
export interface BrowserSpeech {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(track: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}
export type SpeechConstructor = new () => BrowserSpeech;
function constructor() {
  const browser = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export function supportsRecordedSpeech(userAgent = navigator.userAgent) {
  // 古いstart()は引数を無視してマイクを開くため、音声トラック対応版に限定する。
  // MDN BCD: PC版Chromium 135以降。モバイル/Safariは対象外。
  const version = /(?:Chrome|Chromium)\/(\d+)/.exec(userAgent);
  return (
    !!constructor() &&
    !!version &&
    Number(version[1]) >= 135 &&
    !/Android|iPhone|iPad|Mobile/i.test(userAgent)
  );
}
const unavailable =
  "このブラウザでは録音音声のブラウザ認識を利用できません。PC版Chrome／Edge 135以降を使うか、端末内モデルを選んでください。";
const errors: Record<string, string> = {
  "not-allowed":
    "ブラウザの音声認識が許可されていません。サイトの権限とブラウザの設定を確認してください。",
  "service-not-allowed":
    "ブラウザの音声認識サービスを利用できません。別の対応ブラウザか端末内モデルを試してください。",
  "language-not-supported":
    "このブラウザの認識サービスは日本語を利用できません。別の対応ブラウザか端末内モデルを試してください。",
  network:
    "音声認識サービスへ接続できませんでした。通信環境を確認して、もう一度発声してください。",
  "audio-capture":
    "録音音声を認識サービスへ渡せませんでした。ブラウザを確認するか、端末内モデルを試してください。",
  aborted: "ブラウザの音声認識が中断されました。もう一度発声してください。",
};

export class BrowserSpeechRecognizer implements Recognizer {
  private ready = false;
  private cancel: (() => void) | null = null;
  async load(
    _model: string,
    _device: "wasm" | "webgpu",
    progress: (text: string) => void,
  ) {
    this.dispose();
    if (!supportsRecordedSpeech())
      throw new RecognizerUnavailableError(unavailable);
    progress("ブラウザの音声認識を準備しました");
    this.ready = true;
  }
  run(blob: Blob): Promise<string> {
    const Speech = constructor();
    if (!this.ready || !Speech)
      return Promise.reject(new RecognizerUnavailableError(unavailable));
    if (this.cancel)
      return Promise.reject(
        new RecognitionError("音声認識の前の処理が残っています。"),
      );
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      let context: AudioContext | undefined;
      let source: AudioBufferSourceNode | undefined;
      let silence: ConstantSourceNode | undefined;
      let destination: MediaStreamAudioDestinationNode | undefined;
      let speech: BrowserSpeech | undefined;
      let drain: ReturnType<typeof setTimeout> | undefined;
      let inputDeadline: ReturnType<typeof setTimeout> | undefined;
      let inputStarted = false;
      let inputFinished = false;
      let transcript = "";
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(drain);
        clearTimeout(inputDeadline);
        this.cancel = null;
        if (speech) {
          speech.onstart =
            speech.onaudiostart =
            speech.onresult =
            speech.onerror =
            speech.onend =
              null;
          try {
            speech.abort();
          } catch {
            /* 終了済みの場合もある */
          }
        }
        if (source) {
          source.onended = null;
          try {
            source.stop();
          } catch {
            /* 開始前の場合もある */
          }
          source.disconnect();
          source.buffer = null;
        }
        if (silence) {
          try {
            silence.stop();
          } catch {
            /* 開始前に失敗した場合もある */
          }
          silence.disconnect();
        }
        destination?.stream.getTracks().forEach((track) => track.stop());
        if (context && context.state !== "closed")
          void context.close().catch(() => {});
        if (error) reject(error);
        else resolve(transcript.trim());
      };
      // 録音上限60秒の実時間入力と結果待ちを含む。応答しないサービスは解放する。
      const timer = setTimeout(
        () =>
          finish(
            new RecognitionError(
              "ブラウザの音声認識が時間内に完了しませんでした。もう一度発声するか、端末内モデルを試してください。",
            ),
          ),
        90000,
      );
      this.cancel = () =>
        finish(new DOMException("認識を中断しました。", "AbortError"));
      void (async () => {
        const bytes = await blob.arrayBuffer();
        if (settled) return;
        // decodeAudioDataでリサンプリングし、入力機器による周波数の差をなくす。
        context = new AudioContext({ sampleRate: 16000 });
        const buffer = await context.decodeAudioData(bytes);
        if (settled) return;
        await context.resume();
        if (settled) return;
        source = context.createBufferSource();
        source.buffer = buffer;
        destination = context.createMediaStreamDestination();
        destination.channelCount = 1;
        // スピーカーには接続しない。認識へ渡すのは終了済みの録音だけ。
        source.connect(destination);
        // 無音も実データとして流す。単に待つだけではsource終了後の
        // トラックに音声フレームが届かず、認識開始・末尾の判定を妨げる。
        silence = context.createConstantSource();
        silence.offset.value = 0;
        silence.connect(destination);
        silence.start();
        speech = new Speech();
        speech.lang = "ja-JP";
        speech.continuous = true;
        speech.interimResults = false;
        speech.maxAlternatives = 1;
        if ("processLocally" in speech) speech.processLocally = false;
        speech.onaudiostart = () => {
          if (settled) return;
          speech!.onaudiostart = null;
          clearTimeout(inputDeadline);
          inputStarted = true;
          try {
            // startは音声入力の準備完了ではない。audiostart後もChromiumの
            // 背景音推定（300ms）を無音で通し、短い発声の先頭を保つ。
            source!.start(context!.currentTime + 0.5);
          } catch {
            finish(
              new RecognitionError(
                "録音音声を認識サービスへ渡せませんでした。",
              ),
            );
          }
        };
        speech.onresult = (event) => {
          if (settled) return;
          transcript = Array.from(event.results)
            .filter((result) => result.isFinal)
            .map((result) => result[0].transcript)
            .join("");
        };
        speech.onerror = (event) => {
          if (event.error === "no-speech")
            finish(
              new RecognitionError(
                "認識サービスが発声を検出できませんでした。録音を聞き返して確認してください。",
              ),
            );
          else
            finish(
              new RecognitionError(
                errors[event.error] ??
                  "ブラウザの音声認識を完了できませんでした。もう一度発声するか、端末内モデルを試してください。",
              ),
            );
        };
        speech.onend = () => {
          if (transcript.trim()) finish();
          else
            finish(
              new RecognitionError(
                !inputStarted
                  ? "認識サービスの音声入力が始まる前に終了しました。もう一度試してください。"
                  : !inputFinished
                    ? "録音音声を送り終える前に認識が終了しました。もう一度試してください。"
                    : "認識サービスから文字が返りませんでした。録音を聞き返し、単語でも試してください。",
              ),
            );
        };
        source.onended = () => {
          inputFinished = true;
          if (!settled)
            drain = setTimeout(() => {
              if (settled) return;
              try {
                speech!.stop();
              } catch {
                finish(
                  new RecognitionError(
                    "ブラウザの音声認識を終了できませんでした。",
                  ),
                );
              }
            }, 1000);
        };
        inputDeadline = setTimeout(
          () =>
            finish(
              new RecognitionError(
                "認識サービスの音声入力が始まりませんでした。もう一度試してください。",
              ),
            ),
          10000,
        );
        speech.start(destination.stream.getAudioTracks()[0]);
      })().catch(() =>
        finish(
          new RecognitionError(
            "録音音声のブラウザ認識を開始できませんでした。再開して発声するか、端末内モデルを試してください。",
          ),
        ),
      );
    });
  }
  dispose() {
    this.ready = false;
    this.cancel?.();
  }
}
