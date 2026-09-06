# 開発・配信ガイド

[READMEに戻る](../README.md)

## 開発環境

React＋TypeScript＋Vite、Bunを使用します。標準環境はLinuxのDev Containerです。WindowsではWSL2上のLinuxファイルシステムにチェックアウトし、DockerのWSL連携を有効にします。

VS Codeで「Reopen in Container」を実行します。既定の構成はホストのCodex standaloneを必要とします。下の「補助CLIの共有」を参照してください。Dockerfile等の変更後は「Rebuild Container」で再構築します。

ホストからDev Container CLIを使う場合：

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

コンテナ内のリポジトリ直下で実行します。

```bash
bun install --frozen-lockfile
bun run dev
```

ホストのブラウザから `http://localhost:25173` を開きます。本番ビルドのプレビューは `http://localhost:24173` です。

### 補助CLIを使わずに起動する

同じ[Dockerfile](../.devcontainer/Dockerfile)と[Compose定義](../compose.yaml)を直接使えます。この起動方法では、Dev Container側のCodexチェック・認証マウント・初期設定フックは実行されません。

Compose単独起動では、ホストに合わせたコンテナユーザーのUID/GID自動調整も行いません。Linuxのバインドマウントではホスト側の所有者・権限が適用されるため、コンテナの `node` ユーザーがチェックアウト先へ書き込めることが前提です。UID/GIDが異なり書き込めない場合は、ユーザーIDやグループ権限を合わせてから依存をインストールしてください。[Dev ContainerのUID/GID調整](https://code.visualstudio.com/remote/advancedcontainers/add-nonroot-user)も参照できます。

```bash
docker compose up -d --build
docker compose exec --user node --workdir /workspaces/main dev bash
```

開いたシェルで上記の `bun install --frozen-lockfile` と `bun run dev` を実行します。停止はホストから `docker compose down` です。

### ポートとHTTPS

コンテナ内の5173／4173番を、ホストのループバック25173／24173番へ公開します。`.env.example` を `.env` にコピーし、必要な項目を変更してからコンテナを再作成してください。

| 変数 | 用途 |
| --- | --- |
| `KOTOBA_DEV_PORT` | 開発サーバーのホスト側ポート |
| `KOTOBA_PREVIEW_PORT` | プレビューのホスト側ポート |
| `COMPOSE_PROJECT_NAME` | 複数チェックアウトを同時起動するときの識別名 |
| `KOTOBA_HTTPS_HOST` | HTTPSプロキシ経由で使うホスト名をViteへ許可 |

Composeはリポジトリ直下の `.env` を読みます。シェルでexportした同名の値があれば、そちらが優先されます。
別ホストからマイクを使う場合はHTTPSを用意し、ブラウザでマイクを許可してください。`KOTOBA_HTTPS_HOST` 自体はTLSやプロキシを設定しません。

### 補助CLIの共有

既定の[devcontainer.json](../.devcontainer/devcontainer.json)は、ホストの `~/.codex/packages/standalone/` を読み取り専用で共有します。`current/bin/codex` が実行できない場合は起動前チェックで停止します。Codexの導入・更新はホスト側で行います。

ホストの `~/.codex/auth.json`、`~/.claude/.credentials.json`、`~/.config/gh/` は書き込み可能で共有され、認証更新はホストにも反映されます。共有元がなければ初期ファイル・ディレクトリを作成しますが、ログインは行いません。Codex・Claudeの設定や履歴全体は共有しません。
Claude CodeとGitHub CLIは固定版をコンテナへ導入します。アプリのビルド・テストにこれらの認証は不要です。

[CI用Dev Container](../.devcontainer/ci/devcontainer.json)は同じDockerfileを使い、ホストのCodex・認証共有・ポート公開を必要としません。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `bun run dev` | 開発サーバー |
| `bun run typecheck` | 型チェック |
| `bun run build` | 型チェックと `dist/` への本番ビルド |
| `bun run preview` | ビルド済みアプリの確認 |
| `bun run test:install` | 固定Playwrightに対応するChromiumを取得 |
| `bun run test` | 単体テスト |
| `bun run test:browser` | ビルド済みアプリのブラウザテスト |
| `bun run check` | ライセンス照合・型チェック・ビルド・単体・ブラウザテスト |
| `bun run check:dependencies` | ロック内の依存の公開日を照合 |
| `bun run generate:licenses` | ライセンス表示を再生成 |
| `bun run check:licenses` | ライセンス表示の更新漏れを検出 |
| `bun run generate:voices` | 見本音声を生成 |

テストの使い分けは[テスト方針](testing.md)、依存の更新は[依存関係の管理](dependencies.md)を参照してください。

## 見本音声の再生成

通常の起動・ビルド・テストは同梱音声を使い、合成エンジンを必要としません。教材や声を変更するときだけ生成します。

1. [音声の適用規約](../public/audio/samples/README.md)を確認します。
2. [固定版とSHA-256](dependencies.md#音声生成ツール)に従ってLinux CPU版のvvppを取得・照合し、`unzip` で `.local/nemo/engine/` と `.local/voicevox/engine/` に展開します。FFmpegはコンテナに含まれます。
3. 以下をそれぞれ別のターミナルで起動します。

```bash
.local/nemo/engine/run --host 127.0.0.1 --port 50121 --cpu_num_threads 1 --disable_mutable_api
```

```bash
.local/voicevox/engine/run --host 127.0.0.1 --port 50122 --cpu_num_threads 1 --disable_mutable_api
```

```bash
bun run generate:voices
# 一部の声だけ生成する例
SAMPLE_VOICES=nemo-female-1,voicevox-metan bun run generate:voices
```

声・スタイルIDは[sampleVoices.ts](../src/audio/sampleVoices.ts)を参照します。`NEMO_URL`／`VOICEVOX_URL` でlocalhostのポート、`FFMPEG` で実行パスを変更できます。異なる声は別プロセスで生成できます。同じエンジンへの要求は並列化しても速くなるとは限りません。

### 生成条件と管理するファイル

- ノーマルの声を音量・速度1.0、24kHzモノラル、Opus 48kbps CBRで生成します。1音の母音長は最低0.40秒、前後余白は各0.20秒。他は前0.06秒・後0.12秒です。1音の調整は短すぎる見本を避けるためのもので、自然な発話の長さの基準ではありません。
- 単音・無意味2音はカナ記法でモーラを指定します。単語は辞書の読みを照合し、必要な補正は[sample-reading-overrides.ts](../scripts/sample-reading-overrides.ts)に記載します。長音の表記差・じ／ぢ・ず／づ以外の読み違いは生成を中断します。
- [sample-timing.ts](../scripts/sample-timing.ts)の条件は生成キャッシュの署名に含まれます。変更時は対象の1音だけ再生成し、同じ読みの単語も音源を共有します。3回再生はクライアント側で同じファイルを繰り返します。
- `.local/sample-voices/` は生成クエリと再開用キャッシュです。条件とチェックサムが一致する音声は再生成しません。
- `public/audio/samples/` の音声・各声の `checksums.json`・[マニフェスト](../src/audio/sample-voices-manifest.json)を一緒に管理します。エンジン・モデル・生成途中のファイルはGitへ追加しません。
- 変更後は `bun run generate:licenses` と `bun run check` を実行し、アプリで聞きやすさ・読み・アクセントを確認します。

## 静的配信と公開用リポジトリ

[ワークフロー](../.github/workflows/check.yml)はPR・mainへのpush・手動実行で検証し、公開リポジトリのmainへのpushで成功した成果物をGitHub Pagesへ配信します。プライベートの間は検証だけを行い、Pages用成果物のアップロードと配信はスキップします。リポジトリのPages設定で「GitHub Actions」を選び、利用プラン・公開範囲がPagesの利用条件を満たすことを確認してください。検証の成功とdeployの成功は別です。

Viteの `base: './'` によりリポジトリ配下のURLでも配信できます。他のWebサーバーでは `bun run build` 後の `dist/` 全体をHTTPSで配信します。アプリは起動中のページを強制再読み込みしません。

新しいリポジトリへ移す場合は、必要な変更をコミットしたリビジョンから `git archive` 等で追跡ファイルだけを取り出します。作業ディレクトリ全体のコピーは避け、次を確認します。

- `src/`、`public/`、`index.html`、パッケージ・ロック・ビルド設定を含める。音声、チェックサム、モデルカタログを一緒に持ち込む。
- `scripts/`、`tests/`、`.github/`、`.devcontainer/`、Compose・編集規約・環境変数の例、README・開発規約・`docs/` を含める。再生成・検証・配信に必要です。
- `LICENSE`、`docs/licenses/` の原文、`public/licenses.*`、音声の出典・適用規約を保持する。生成済み音声にアプリ本体のMITを一律適用しない。
- 古い `.git/`、`.env`、認証ファイル、`.local/`、録音・バックアップ、`node_modules/`、`dist/`、テスト成果物を持ち込まない。追跡ファイルにも機微情報がないか、差分と検索で確認する。
- 初回コミット前に、移行先のGit設定の名前・メールアドレスが公開用の値であることを確認する。必要に応じてリポジトリ単位で[GitHubのnoreplyアドレス](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)を設定し、push前に実際のコミットの著者・コミッター情報も確認する。
- 移行先でCIを実行し、Pages設定・deploy・公開URLでの基本操作を確認する。READMEへ公開URLを案内する場合は、配信確認後に記載する。
