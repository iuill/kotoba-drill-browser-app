# 音声認識

音声認識は任意の実験的機能です。初期状態はオフ、認識方式の初期選択はブラウザ標準です。結果は発音の採点に使いません。1音・無意味2音・単語で精度が異なり、大きなモデルほどこの用途に適するとは限りません。

## ブラウザ標準（Web Speech API）

APIキーやアプリ側のモデル取得は不要です。録音音声がブラウザの認識サービスへ送信される場合があります。利用者のブラウザ設定・サービスの利用条件が適用され、アプリから認識先のローカル／リモートは指定しません。

[browserSpeech.ts](../src/models/browserSpeech.ts)で、聞き返しと同じ録音を16kHzモノラルへ変換し、スピーカーへ出さない音声トラックを[`SpeechRecognition.start(audioTrack)`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start)に渡します。別のマイク入力は開きません。日本語 `ja-JP`、連続認識・確定結果のみを使い、お題をヒントには渡しません。

入力フレームを継続させ、`audiostart`後に500msの無音を挟んでから録音を流し、末尾の無音1秒を経て停止します。音声入力開始と認識サービスの準備は同時とは限らないため、短い録音を `start` 直後に流さない構成です。録音時間と前後の無音、サービス処理分の待ち時間が生じます。

アプリは録音トラック入力に対応するPC版Chrome／Edge 135以降を対象とし、スマートフォン・Safariではこの方式を提供しません。APIと版の確認は、認識サービスの利用可能性を保証しません。通信・権限エラーや文字が返らない場合も、別の方式へ自動変更しません。

入力仕様の参考：[MDNの互換性データ](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json)、[Chromiumの認識処理](https://chromium.googlesource.com/chromium/src/+/refs/tags/135.0.7049.6/content/browser/speech/speech_recognizer_impl.cc)、[Edgeの音声認識ポリシー](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/speechrecognitionenabled)。

## 端末内モデル

初回にHugging Faceからモデル・設定を取得し、認識はWorkerで実行します。ランタイムのJS/WASMはアプリと同じ静的配信元から取得します。GPU搭載のゲーミングPCを推奨します。

| モデル | 配布元・固定リビジョン | 取得の目安 | 形式・処理方式 |
| --- | --- | --- | --- |
| Whisper Tiny | [ONNX Community](https://huggingface.co/onnx-community/whisper-tiny/tree/ff4177021cc41f7db950912b73ea4fdf7d01d8e7) | 約70MB | q8・WASM / WebGPU |
| Whisper Base | [ONNX Community](https://huggingface.co/onnx-community/whisper-base/tree/1846881b6b3a3024392c1eea3ad983695bc23925) | 約110MB | q8・WASM / WebGPU |
| Whisper Small | [ONNX Community](https://huggingface.co/onnx-community/whisper-small/tree/36050c46d777d46dc4b5f43f6d90574fc38f8732) | 約280MB | q8・WASM / WebGPU |
| Kotoba-Whisper v2.2 | [ONNX Community](https://huggingface.co/onnx-community/kotoba-whisper-v2.2-ONNX/tree/6da07195e83145e4fca2a8a1ba6f4c2e837b3798) | 約1,100MB | q8・WASM / WebGPU |
| Cohere Transcribe | [ONNX Community](https://huggingface.co/onnx-community/cohere-transcribe-03-2026-ONNX/tree/31b1c6211c9000d76b077ddd23b74c9090badeba) | 約2,200MB | q4・WebGPU専用 |

容量はランタイムを含めた概算です。選択可能な方式と、実機での速度・認識品質は別です。設定・モデル管理には[src/models/catalog.ts](../src/models/catalog.ts)の定義を使います。任意URLの登録や、履歴の別モデルによる再評価は提供していません。

- [adapters.ts](../src/models/adapters.ts)にモデル固有の設定を分離します。Whisperは日本語文字起こし、Cohereは言語コード `ja` を指定し、出力は最大128トークンに制限します。KotobaのPython版の話者分離・句読点補完は組み込みません。
- デコード・16kHzモノラルへの変換はメインスレッド、特徴量抽出・推論・後処理はWorkerで行います。切り替え・中止ではWorkerを終了します。
- 固定Whisper q8グラフはORT 1.26のQDQ最適化でscale不足エラーになるため、Whisperアダプターのグラフ最適化を無効にしています。ランタイムやモデルを更新するときは、この互換性対応の要否も確認します。
- キャッシュは `kotoba-models-v1`。モデル単位で容量表示・削除でき、ブラウザによって削除される場合もあります。キャッシュできなくても取得・推論を試みます。

### 接続上の未解決事項

上記の固定リビジョンには、認識精度とは別に、読み込み・推論の完了を確認できていない組み合わせがあります。

- Kotoba-Whisper v2.2のWASM：読み込み中にChromiumが異常終了する問題の原因は未特定で、推論完了を確認できていません。
- Cohere TranscribeのソフトウェアWebGPU：読み込み中の描画プロセス終了により、読み込み・推論完了を確認できていません。実GPUでの動作可否とは区別します。

これらを全環境共通の失敗や、モデルの認識品質の評価とは扱いません。利用する処理方式で、取得・読み込み・推論まで完了することを確認してください。

## 結果と検証

読みの比較はNFKC、カタカナ→ひらがな、句読点除去、教材辞書を使います。未知の漢字・複数読みは「読みは要確認」とします。汎用の形態素解析や、お題からの結果補完はしません。

認識を使う1音練習は同じ音を3回発声し、1つの録音をそのまま認識します。録音の複製ではありません。認識オフは1回、2音・単語も1回です。短い単音で文字が返らない場合への対策であり、改善を保証するものではありません。

キュー・中断・履歴との対応は[現行設計](design.md)、自動テスト・実モデルの接続確認・実機確認は[テスト方針](testing.md)を参照してください。通常CIはモデルを取得せず、無音の推論成功も日本語の認識精度の検証とは扱いません。

## 利用条件と出典

- Transformers.js、Hugging Face Tokenizers：Apache-2.0。Hugging Face Jinja：MIT。
- ONNX Runtime Web：MIT。配布物のThirdPartyNoticesも同梱します。
- Whisper原実装：MIT。Hugging Faceの元モデルカードはApache-2.0と記載されています。
- Kotoba-Whisper v2.2、Cohere Transcribe：Apache-2.0。ONNX Communityによる変換版を使用します。

原文・第三者通知は[ライセンス一覧](../public/licenses.txt)と、アプリの「ライセンス・出典」に掲載します。`bun run generate:licenses` で再生成し、全文を省略せず保持します。
ONNX Runtimeのnpmパッケージにない原文は、配布物の `__commit.txt` に対応するMicrosoft/onnxruntimeのリビジョンから[docs/licenses/](licenses/)へ収録しています。
