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
3. **ブランチ作成**: SBI issueから `sbi/{issue番号}-{kebab-caseの概要}` の名前でブランチを切る（例: `sbi/13-position-capacity`）。
4. **実装**: Claude Codeとのペアプロで実装を進める。SBIのDefinition of Doneを満たすまで作業する。
5. **PR作成**: `.github/pull_request_template.md` に従い、`Closes #<SBI番号>` を含めてPRを作成する。PR作成・更新をトリガーに `claude-code-review` ワークフローが自動でレビューコメントを投稿する。
6. **人間レビュー**: Claudeの自動レビューコメントを確認し、必要な修正を行う。人間のレビュアーが最終承認する。
7. **マージ**: マージ後、SBI issueは自動クローズ（`Closes #`）される。すべての子SBIがクローズされたら、PBI issueを手動でクローズする。

## 3. ブランチ命名規約

```
sbi/{issue番号}-{kebab-caseの概要}
```

例: `sbi/13-position-capacity`, `sbi/27-fix-shift-overlap`

PBI自体はブランチを持たない（トラッキング用のissueのみ）。

## 4. Claude自動レビュー

- `.github/workflows/claude-code-review.yml` により、PR作成・更新時に自動でコードレビューコメントが投稿される。
- 初期設定はコメントのみでマージをブロックしない。必要に応じてリポジトリのブランチ保護ルールで必須チェック化を検討する。
- 自動レビューとは別に、手動で `/code-review` （高効果度が必要な場合は `ultra`）を実行して深掘りレビューを行ってもよい。

## 5. Definition of Done（共通）

- [ ] SBIに書かれた受け入れ条件を満たしている
- [ ] 実機/ローカル環境で動作確認済み
- [ ] UI変更を含む場合、[docs/design.md](design.md) に準拠している
- [ ] テキストに絵文字を使用していない
- [ ] Claude自動レビューのコメントを確認済み
