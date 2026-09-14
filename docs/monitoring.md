# エラー監視（Sentry）

backend（Flask）・frontend（Next.js）ともに[Sentry](https://sentry.io)でエラー監視している（PBI #47 / SBI #60）。

## 構成

- Sentry organization: `bestshift-gs`（データ保存先: US）
- プロジェクト: `python-flask`（backend）、`javascript-nextjs`（frontend）
- 通知: Sentry上でSlack連携を設定済み。両プロジェクトとも新規Issue発生時などに`#bestshift-dev`へ通知される（Sentryダッシュボードの Settings > Integrations > Slack、および Alerts で設定。コードには含まれない）

## 環境変数

| 変数名 | 対象 | 用途 |
| --- | --- | --- |
| `SENTRY_DSN` | backend | `backend/app.py`で`sentry_sdk.init()`に使用。未設定ならSentryは初期化されない |
| `NEXT_PUBLIC_SENTRY_DSN` | frontend | `instrumentation-client.ts`・`sentry.server.config.ts`・`sentry.edge.config.ts`で使用。`NEXT_PUBLIC_`接頭辞のためビルド時にクライアントバンドルへ埋め込まれる（`frontend/Dockerfile`のARG/ENVを参照） |

DSNの値自体は秘匿情報ではない（クライアントに露出する前提の識別子）が、`.env`・Renderの環境変数・Vercelの環境変数にそれぞれ設定する。

- backend: `backend/.env`（ローカル）、Render本番環境変数
- frontend: `docker-compose_dev.yml` / `docker-compose.yml`（ローカル）、Vercel本番環境変数

## 個人情報の扱い

backendの`sentry_sdk.init()`は`send_default_pii=False`にしている。デフォルトの`True`だとスタッフのIPアドレスやリクエストヘッダー等が外部のSentryへ送られてしまうため、明示的なデータ取り扱いポリシーが無い現状では無効化している（CodeRabbitの指摘を受けて対応）。

## テストでSentryが動かない理由

`backend/conftest.py`で`SENTRY_DSN`を空文字に固定している。pytest実行のたびに実際のSentryプロジェクトへテスト由来のイベントが飛ぶのを防ぐため（`load_dotenv()`は既存の環境変数を上書きしないため、`os.environ.pop`ではなく空文字での固定が必要）。

## 動作確認方法

- backend: `sentry_sdk.init()`後に例外を発生させるエンドポイントを叩き、[Sentryダッシュボード](https://bestshift-gs.sentry.io/issues/?project=python-flask)にIssueが記録されることを確認する
- frontend: ブラウザのコンソールで未定義関数を呼び出すなどしてエラーを発生させ、[Sentryダッシュボード](https://bestshift-gs.sentry.io/issues/?project=javascript-nextjs)にIssueが記録されることを確認する
- どちらも`#bestshift-dev`にSlack通知が届くことも合わせて確認する

## 既知の制約

- frontendは`next.config.ts`を`withSentryConfig`でラップしていないため、本番ビルドのソースマップはSentryにアップロードされない（スタックトレースが難読化されたまま表示される）。ソースマップアップロードには`SENTRY_AUTH_TOKEN`の発行・管理が追加で必要なため、今回のSBIではスコープ外とした。必要になれば別途対応する
