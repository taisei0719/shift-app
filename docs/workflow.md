# 開発フロー（スクラム + AIDLC）

shift-appの開発は、プロダクトバックログを **PBI → SBI** に分解して進めるスクラム駆動開発を採用する。
各フェーズでClaudeを活用する **AIDLC (AI-Driven Development Life Cycle)** の考え方に基づき、バックログ分解・実装・レビューにAIを組み込む。

## 1. PBI / SBI の定義

- **PBI (Product Backlog Item)**: ユーザーに価値をもたらす機能単位。README「今後の実装予定」やヒアリングから積む。ブランチは持たない。
- **SBI (Sprint Backlog Item)**: PBIをスプリントで実行可能な粒度（半日〜数日）に分解した実装タスク。**1 SBI = 1ブランチ = 1PR** で完結させる。

PBI issueには `type:pbi`、SBI issueには `type:sbi` ラベルを付与する（`.github/ISSUE_TEMPLATE/` のテンプレートを使うと自動付与される）。

## 2. スプリントの流れ

1. **PBI起票**: `[PBI] ` テンプレートでissueを作成し、ユーザーストーリー・受け入れ条件・優先度を書く。
2. **スプリントプランニング**: PBIをSBIに分解する。分解の壁打ちにClaudeを使ってよい（AIDLCの「Intent capture → Unit-level design」フェーズ）。各SBIは `[SBI] ` テンプレートで起票し、親PBI番号を紐づける。PBI側の「関連SBI」欄にもチェックリストとして追記する。
3. **ブランチ作成**: SBI issueから `{issue番号}-{kebab-caseの概要}` の名前でブランチを切る（例: `13-position-capacity`）。
4. **実装**: Claude Codeとのペアプロで実装を進める。SBIのDefinition of Doneを満たすまで作業する。
5. **PR作成**: SBIブランチから **`develop` 向けに** `.github/pull_request_template.md` に従い、`Closes #<SBI番号>` を含めてPRを作成する。PR作成・更新をトリガーに `claude-code-review` ワークフローが自動でレビューコメントを投稿する。
6. **人間レビュー**: Claudeの自動レビューコメントを確認し、必要な修正を行う。人間のレビュアーが最終承認する。
7. **マージ**: `develop` にマージする。GitHubの `Closes #` はリポジトリのデフォルトブランチ（`main`）へのマージでしか自動発火しないため、`develop` へのマージではSBI issueは自動クローズされない。マージ後に手動で `gh issue close <SBI番号>` する。すべての子SBIがクローズされたら、PBI issueを手動でクローズする。`develop` から `main` へのリリースマージ時には、そこに含まれるSBI issueの `Closes #` が自動発火する場合がある（すでに手動クローズ済みなら影響なし）。

## 3. ブランチ命名規約

```
{issue番号}-{kebab-caseの概要}
```

例: `13-position-capacity`, `27-fix-shift-overlap`

PBI自体はブランチを持たない（トラッキング用のissueのみ）。

ブランチ名に `#` を使わない。`#13-position-capacity` のように issue番号の前に `#` を付けると、GitHub側のPR head追跡が壊れ、pushしても `claude-code-review` の `synchronize` イベントが発火しなくなる不具合を実際に確認した（SBI #13、PR #16 → #17参照）。issue番号は `#` なしでそのまま先頭に置く。

## 4. Claude自動レビュー

- `.github/workflows/claude-code-review.yml` により、PR作成・更新時に自動でコードレビューコメントが投稿される。
- 認証はClaude Pro/MaxのOAuthトークン（`claude setup-token` で発行し `CLAUDE_CODE_OAUTH_TOKEN` としてリポジトリSecretsに登録）を使用する。サブスクリプションのレート制限を消費するため、頻繁に上限に達する場合は `ANTHROPIC_API_KEY`（従量課金API）方式への切り替えを検討する。
- 初期設定はコメントのみでマージをブロックしない。必要に応じてリポジトリのブランチ保護ルールで必須チェック化を検討する。
- 自動レビューとは別に、手動で `/code-review` （高効果度が必要な場合は `ultra`）を実行して深掘りレビューを行ってもよい。

## 5. コミットメッセージ規約

```
#{issue番号} {type}: {説明}
```

- `{issue番号}`: 対応するSBI issue番号（PBI番号ではない）
- `{type}`: `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `style` / `perf` のいずれか
- `{説明}`: 変更内容を簡潔な日本語で

例: `#13 feat: mainブランチにPR必須の保護ルールを追加`

## 6. ブランチ保護とマージ権限

- `main`(prod)・`develop`(dev/stg相当)ともに以下のブランチ保護ルールを設定済み:
  - 直接push禁止（PRを経由しないと変更できない）
  - PRの作成が必須（レビュー承認自体は必須にしていない。現状は開発者1名のため、承認必須にすると自分のPRをマージできなくなるのを避けるための判断）
  - force push禁止・ブランチ削除禁止
  - `enforce_admins` はOFF（管理者はブランチ保護をバイパス可能。緊急時のセルフマージ用の逃げ道として維持する）
- **マージ権限**: 現状の開発者（リポジトリ管理者）が、main/developへのマージを単独で承認・実行する。Claude自動レビュー（`claude-code-review`）のコメントを確認したうえでマージする運用とする。
- ステータスチェックの必須化はまだ行っていない。`claude-code-review` はコメント投稿のみでマージをブロックしない設計（4章）と一致させるため。チェックが安定して走ることを確認できたら、必須化を再検討する。
- 開発者が増えた場合は、承認必須（`required_approving_review_count` を1以上）に切り替えることを検討する。

## 7. Definition of Done（共通）

- [ ] SBIに書かれた受け入れ条件を満たしている
- [ ] 実機/ローカル環境で動作確認済み
- [ ] UI変更を含む場合、[docs/design.md](design.md) に準拠している
- [ ] テキストに絵文字を使用していない
- [ ] Claude自動レビューのコメントを確認済み
