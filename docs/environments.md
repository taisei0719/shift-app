# 環境構成（dev / stg / prod）

shift-appの環境は **dev（PRごとのプレビュー）/ stg（`develop`ブランチ）/ prod（`main`ブランチ）** の3段階とする。

## 1. 方針: stg環境は独立させず、`develop`ブランチをstg兼dev基盤として扱う

- Renderの無料プランでは、単一サービスの「PR Previews（Service Previews）」はベースサービスと同じ課金レートで動く。ベースのWebサービス（backend）が無料プランなら、そのPR previewも無料。
- 一方、DBを含む複数サービスをまるごと複製する「Preview Environments」（Blueprintベース）はフル機能を使うには実質有料ワークスペース（Proプラン, $25/月〜）が前提になる。DB込みの独立stg環境を作るとコストが発生する。
- 現状は開発者1名でコストをかけられる段階でもないため、**独立したstg環境（別Renderサービス・別DB）は持たない**。代わりに以下の2層構成で運用する。
  - **dev**: SBIのPRごとに、Vercel/Renderが自動生成するプレビュー環境で確認する。
  - **stg**: `develop`ブランチに複数のSBIがマージされた状態を、`develop`を継続デプロイしている環境（Vercelのブランチデプロイ + Renderの`develop`追跡サービス）で確認する。実質的に「マージ後の結合確認用の共有環境」としてstgを兼ねる。
  - **prod**: `main`ブランチ。本番。
- 開発体制が拡大し、DB分離やチーム間の同時並行検証が必要になったタイミングで、独立したstg環境（別Renderサービス+別DB、Proワークスペースへの切り替え）を再検討する。

## 2. 各環境のプレビュー確認方法

### dev（PRごとのプレビュー）

- **フロントエンド（Vercel）**: PRを作成すると、Vercelが自動でプレビューデプロイを作成し、PRにコメントでURLを投稿する。URLの形式は `https://shift-app-<hash>-taiseis-projects-dc838d86.vercel.app`（コミットごと）。
- **バックエンド（Render）**: Renderのサービス設定で「PR Previews」を有効化しておくと、PRごとにbackendサービスのプレビューが自動作成される（backendが無料プランのWebサービスなら追加料金なし）。**未設定の場合はRenderダッシュボードでの手動設定が必要**（このSBIの範囲では未設定。設定はSBI外のインフラ作業として別途行う）。
- 注意: dev previewのbackendはDBを分離しない想定（本番/developと同じDBに接続する）。PRでのテストデータ投入・削除は既存データに影響しうるため、破壊的な操作を伴う確認は避ける。

### stg（`develop`ブランチ）

- **フロントエンド（Vercel）**: `develop`にpushされるたびに、Vercelのブランチデプロイが更新される。URLは `https://shift-app-git-develop-taiseis-projects-dc838d86.vercel.app`。
- **バックエンド（Render）**: `develop`ブランチを追跡するRenderサービスを使う（本番サービスとは別サービスとして、`develop`ブランチを自動デプロイ対象に設定する。**未作成の場合は作成が必要**、このSBIの範囲では未確認）。
- 人間レビュー前後の結合確認・デモ用に使う。

### prod（`main`ブランチ）

- **フロントエンド（Vercel）**: `main`へのマージで本番URLに反映される。
- **バックエンド（Render）**: `main`を追跡する本番Renderサービス + Render PostgreSQL。

## 3. 未確認・要フォローアップ

- Renderダッシュボード側で、backendサービスの「PR Previews」トグルが現在有効になっているかは未確認（Render管理画面での確認が必要）。
- `develop`ブランチを追跡する独立したRenderサービスが既に存在するか未確認。無ければ新規作成が必要（追加のRenderサービス1つ分のリソースを消費するが、無料プランの範囲内であれば追加コストなし）。
