import fs from "node:fs";
const checkOnly = process.argv.includes("--check");
function writeOrCheck(path, content) {
  if (checkOnly) {
    if (!fs.existsSync(path) || fs.readFileSync(path, "utf8") !== content) {
      throw new Error(
        `${path} が最新ではありません。bun run generate:licenses を実行してください。`,
      );
    }
  } else {
    fs.writeFileSync(path, content);
  }
}
const packages = [
  "react",
  "react-dom",
  "scheduler",
  "@huggingface/transformers",
  "@huggingface/jinja",
  "@huggingface/tokenizers",
  "onnxruntime-web",
  "onnxruntime-common",
  "flatbuffers",
  "protobufjs",
  "long",
];
let output =
  "ことばドリル — ライセンス・出典\n\n開始・切り替え効果音: Kenney Interface Sounds 1.0 (CC0)、Audio/confirmation_004.ogg、Audio/confirmation_001.ogg、Audio/question_002.oggを無加工で使用。\nhttps://kenney.nl/assets/interface-sounds\n原文ライセンス: audio/kenney-license.txt\n\n内蔵教材は本プロジェクトで独自作成しました。\n本体: MIT (LICENSE)\n\nモデル配信: https://huggingface.co/onnx-community/whisper-tiny\nhttps://huggingface.co/onnx-community/whisper-base\nONNX変換: ONNX Community。元モデル: OpenAI Whisper Tiny / Base / Small。\nWhisper Small ONNX: https://huggingface.co/onnx-community/whisper-small\nWhisper Small元モデル: https://huggingface.co/openai/whisper-small\nKotoba-Whisper v2.2 (Apache-2.0): https://huggingface.co/kotoba-tech/kotoba-whisper-v2.2\nKotoba-Whisper ONNX: https://huggingface.co/onnx-community/kotoba-whisper-v2.2-ONNX\nHugging Faceの元モデルカードはApache-2.0表記です。\nhttps://huggingface.co/openai/whisper-tiny\nhttps://huggingface.co/openai/whisper-base\nWhisper原実装: https://github.com/openai/whisper (MIT)\nCohere Transcribe (Apache-2.0): https://huggingface.co/CohereLabs/cohere-transcribe-03-2026\nONNX版: https://huggingface.co/onnx-community/cohere-transcribe-03-2026-ONNX\nモデルは指定リビジョンから取得し、本リポジトリには同梱しません。\n\n";
output += fs.readFileSync("public/audio/samples/README.md", "utf8") + "\n\n";
output += fs.readFileSync("LICENSE", "utf8") + "\n";
for (const name of packages) {
  const dir = "node_modules/" + name;
  const pkg = JSON.parse(fs.readFileSync(dir + "/package.json", "utf8"));
  output += `\n========== ${name} ${pkg.version} (${pkg.license}) ==========\n`;
  let found = false;
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => /^(license|notice|thirdpartynotices)(\.|$)/i.test(f))) {
    if (fs.statSync(dir + "/" + file).isFile()) {
      output += fs.readFileSync(dir + "/" + file, "utf8") + "\n";
      found = true;
    }
  }
  if (!found && name.startsWith("onnxruntime-")) {
    output +=
      fs.readFileSync("docs/licenses/onnxruntime-LICENSE", "utf8") +
      "\n" +
      fs.readFileSync(
        "docs/licenses/onnxruntime-ThirdPartyNotices.txt",
        "utf8",
      ) +
      "\n";
    found = true;
  }
  if (!found) throw new Error("ライセンス原文がありません: " + name);
}
output = output.trimEnd() + "\n";
writeOrCheck("public/licenses.txt", output);
const escaped = output
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
writeOrCheck(
  "public/licenses.html",
  `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ライセンス・出典 — ことばドリル</title>
<style>
body { margin: 0 auto; padding: 2rem 1rem; max-width: 70rem; font-family: system-ui, sans-serif; line-height: 1.7; color: #30313c; background: #f5f4f2; --license-line: #e1dfe6; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
a { color: #5c539a; }
@media (prefers-color-scheme: dark) { body { color: #e8e7ee; background: #191a21; color-scheme: dark; --license-line: #3b3c49; } a { color: #c2baf3; } }
details { margin-top: 2rem; border-top: 1px solid var(--license-line); padding-top: 1rem; }
summary { cursor: pointer; font-weight: 600; }
li { margin: 0.7rem 0; }
</style>
</head>
<body>
<a href="./">ことばドリルに戻る</a>
<main>
<h1>ライセンス・出典</h1>
<p>ことばドリルで使用しているソフトウェア・モデル・音源です。</p>
<ul>
<li><strong>アプリ本体・教材</strong>：ことばドリル（MIT）。内蔵教材は本プロジェクトで作成しています。</li>
<li><strong>効果音</strong>：<a href="https://kenney.nl/assets/interface-sounds">Kenney Interface Sounds</a>（CC0）。</li>
<li><strong>見本音声</strong>：<a href="https://voicevox.hiroshiba.jp/nemo/term/">VOICEVOX Nemo</a>（女声1・男声1）、<a href="https://www.zunko.jp/con_ongen_kiyaku.html">VOICEVOX:四国めたん・VOICEVOX:東北ずん子・VOICEVOX:東北きりたん</a>、<a href="https://tsumugi-official.studio.site/rule">VOICEVOX:春日部つむぎ</a>、<a href="https://frontier.creatia.cc/fanclubs/413/posts/4507">VOICEVOX:剣崎雌雄</a>。生成音声には各提供元の利用規約が適用されます。</li>
<li><strong>認識モデル</strong>：<a href="https://github.com/openai/whisper">OpenAI Whisper</a>、<a href="https://huggingface.co/kotoba-tech/kotoba-whisper-v2.2">Kotoba-Whisper</a>、<a href="https://huggingface.co/CohereLabs/cohere-transcribe-03-2026">Cohere Transcribe</a>。ONNX版の配布は<a href="https://huggingface.co/onnx-community">ONNX Community</a>。</li>
<li><strong>主な使用ライブラリ</strong>：React、Transformers.js、ONNX Runtime Webなど。</li>
</ul>
<details>
<summary>ライセンス全文・著作権表示を読む</summary>
<p>各ライブラリに付属する第三者の通知も含みます。</p>
<pre>${escaped}</pre>
</details>
</main>
</body>
</html>
`,
);
