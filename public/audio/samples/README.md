# 収録した見本音声

このフォルダは「ことばドリル」のお題再生に使う生成済み音声です。
アプリ本体のMITライセンスとは別に、以下の音声利用規約が適用されます。
素材集としての再配布や別作品への転用を一律に許諾するものではありません。
再利用する場合は、提供元の規約を確認し、必要なクレジットを表示してください。

## クレジット・利用規約

- **VOICEVOX Nemo**（女声1・男声1）：https://voicevox.hiroshiba.jp/nemo/term/
- **VOICEVOX:四国めたん**、**VOICEVOX:東北ずん子**、**VOICEVOX:東北きりたん**：https://www.zunko.jp/con_ongen_kiyaku.html
- **VOICEVOX:春日部つむぎ**：https://tsumugi-official.studio.site/rule
- **VOICEVOX:剣崎雌雄**：https://frontier.creatia.cc/fanclubs/413/posts/4507
- VOICEVOX共通：https://voicevox.hiroshiba.jp/term/

適用規約の確認日：2026-09-06。以下は本アプリへの同梱・再利用に関係する条件の要点です。
Nemoは機械学習への利用を禁止しています。ずん子等には政治・宗教活動等の禁止用途があります。
春日部つむぎは二次配布禁止の記載がある一方、公式FAQで自作アプリへの音声利用を明示的に認めています。
https://tsumugi-official.studio.site/rule2
本アプリのお題を再生するために同梱し、声素材の独立した配布機能は設けません。
公開リポジトリでも音声は各提供元の規約に従うアプリ用素材として扱い、MITによる自由な再配布・機械学習への利用を許諾するものではありません。
上記は規約全文の代わりではありません。改変・再配布時も各規約に従ってください。

剣崎雌雄はクレジットを表示して利用します。公式イラストは使用しません。公開報告は任意です。政治運動等の勧誘や、故意の誤った医療知識の流布などの禁止用途も規約で確認してください。

## 生成元と管理情報

- VOICEVOX Nemo Engine 0.24.0、VOICEVOX Engine 0.25.2のLinux CPU版で生成。すべてノーマルの声です。
- 音量・速度1.0、24kHzモノラル、FFmpeg 5.1.9でOpus 48kbps CBRへ変換。1音は母音の長さと前後余白を調整しています。
- 読みとファイル名の対応は `src/audio/sample-voices-manifest.json`、実ファイルのSHA-256は各声の `checksums.json` に記録します。
- 再生成は `scripts/generate-sample-voices.ts`、長さの条件は `scripts/sample-timing.ts`、辞書読みの補正は `scripts/sample-reading-overrides.ts` で管理します。3回再生は同じ1音ファイルをクライアント側で繰り返します。
- 声のモデル・エンジン・利用者の録音は同梱しません。

固定ツールの取得・生成手順と条件は、ソースリポジトリの `docs/development.md`「見本音声の再生成」を参照してください。
