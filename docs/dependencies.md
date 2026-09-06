# 依存関係の管理

新規導入・更新は、直接・間接依存とも公開後14日以上の版に限定します。バージョン番号だけでなく公開日時を確認します。緊急セキュリティ更新以外の例外は認めません。現在、例外はありません。

## 固定値と更新手順

| 対象 | 正とするファイル・確認方法 |
| --- | --- |
| アプリ・テスト依存 | [package.json](../package.json)と[bun.lock](../bun.lock)。npm公式レジストリの `time` と照合 |
| 依存の公開日制限 | [bunfig.toml](../bunfig.toml)の `minimumReleaseAge = 1209600`（14日） |
| Bun・Node.js・Claude Code・OSパッケージ | [.devcontainer/Dockerfile](../.devcontainer/Dockerfile)。公式リリースと配布日時を確認 |
| GitHub CLI | [.devcontainer/devcontainer.json](../.devcontainer/devcontainer.json)のFeature設定 |
| CI・Actions | [.github/workflows/check.yml](../.github/workflows/check.yml)。CLIは版、ActionsはコミットSHAで固定 |
| テスト用ブラウザ | 固定Playwrightが指定するブラウザ一覧。最新ブラウザを別途解決しない |

Bunは既存のロック済み依存を公開日で再判定しません。更新後・ロックの取り込み時は `bun run check:dependencies` で、別プラットフォーム向けの任意依存を含めて照合します。公開日が不明な依存やnpm以外の配布物は、出典と公開日を個別に確認します。

開発CLIのnpm導入はDockerfile・CIの `--before` を維持し、更新時に直接・間接依存が14日以上になる日時を指定します。ブラウザ・音声用のOS依存はDockerfileのDebianスナップショットで配布時点を固定します。Codex standaloneはホストで管理し、プロジェクトから導入・更新しません。

Transformers.js 4.2.0が固定するONNX Runtime Webは `1.26.0-dev.20260416-b7804b056c` です。上流が要求する開発版の間接依存ですが、公開後14日以上を満たしており、年齢制限の例外ではありません。

更新時はライセンス生成・[変更に応じたテスト](testing.md)も実行し、ロックファイルを一緒に変更します。緊急更新の例外を適用する場合は、対象と版、公開日時、公式アドバイザリ、影響範囲、14日を待たない理由をこの文書へ記録します。制限の一律解除や恒久的な除外は行いません。

## 音声生成ツール

通常の起動・ビルドでは使わず、[見本音声の再生成](development.md#見本音声の再生成)に使用します。配布アーカイブ全体を固定し、同梱ライブラリもその配布時点のものを使います。

| ツール | 固定版・公開日 | 取得元・SHA-256 |
| --- | --- | --- |
| VOICEVOX Nemo Engine Linux CPU x64 | 0.24.0 / 2025-06-30 | [公式vvpp](https://github.com/VOICEVOX/voicevox_nemo_engine/releases/download/0.24.0/voicevox_engine-linux-cpu-x64-0.24.0.vvpp) / `8e8409d0b6cbd035ec9c5cc8f22e35563b2df8de7aba095859eb15cebf446ee3` |
| VOICEVOX Engine Linux CPU x64 | 0.25.2 / 2026-04-30 | [公式vvpp](https://github.com/VOICEVOX/voicevox_engine/releases/download/0.25.2/voicevox_engine-linux-cpu-x64-0.25.2.vvpp) / `024ce70140d2028638a00014c037b97b82f83f4efd8442cc421bd555e2f122e6` |
| FFmpeg | Debian `7:5.1.9-0+deb12u1` | Dockerfileと同じ `20260821T000000Z` スナップショット。間接依存も同じインデックスで照合 |

エンジン・モデルは `.local/` に置き、Git・配信物に含めません。これらの固定版は公開後14日以上で選定しています。音声の利用条件は[収録音声の説明](../public/audio/samples/README.md)を参照してください。
