# 開発フロー（スクラム + AIDLC）

shift-appの開発は、プロダクトバックログを **PBI → SBI** に分解して進めるスクラム駆動開発を採用する。
各フェーズでClaudeを活用する **AIDLC (AI-Driven Development Life Cycle)** の考え方に基づき、バックログ分解・実装・レビューにAIを組み込む。

環境構成（dev/stg/prod）とプレビュー確認方法は [docs/environments.md](environments.md) を参照。

## 1. PBI / SBI の定義

- **PBI (Product Backlog Item)**: ユーザーに価値をもたらす機能単位。README「今後の実装予定」やヒアリングから積む。ブランチは持たない。
- **SBI (Sprint Backlog Item)**: PBIをスプリントで実行可能な粒度（半日〜数日）に分解した実装タスク。**1 SBI = 1ブランチ = 1PR** で完結させる。

PBI issueには `type:pbi`、SBI issueには `type:sbi` ラベルを付与する（`.github/ISSUE_TEMPLATE/` のテンプレートを使うと自動付与される）。

## 2. スプリントの流れ

1. **PBI起票**: `[PBI] ` テンプレートでissueを作成し、ユーザーストーリー・受け入れ条件・優先度を書く。
2. **スプリントプランニング**: PBIをSBIに分解する。分解の壁打ちにClaudeを使ってよい（AIDLCの「Intent capture → Unit-level design」フェーズ）。各SBIは `[SBI] ` テンプレートで起票し、親PBI番号を紐づける。PBI側の「関連SBI」欄にもチェックリストとして追記する。
3. **ブランチ作成**: 最新化した `develop`（後述7を終えた状態）から、SBI issueに対応する `{issue番号}-{kebab-caseの概要}` の名前でブランチを切る（例: `13-position-capacity`）。古いブランチのHEADから続けて切ると履歴が枝分かれしたまま進むため避ける。作成したら `git push -u origin <branch>` で即座にリモートにも同名ブランチを作成し、upstreamを設定する（後続のpushで都度 `-u` を付け直さずに済む）。
4. **実装**: Claude Codeとのペアプロで実装を進める。SBIのDefinition of Doneを満たすまで作業する。
5. **PR作成**: SBIブランチから **`develop` 向けに** `.github/pull_request_template.md` に従い、`Closes #<SBI番号>` を含めてPRを作成する。PR作成・push毎に、リポジトリのRulesetによりGitHub Copilot code reviewが自動でレビューコメントを投稿する（4章）。
6. **人間レビュー**: Copilotの自動レビューコメント（必要なら `/code-review` の深掘りレビューも）を確認し、必要な修正を行う。人間のレビュアーが最終承認する。
7. **マージ後の後始末**: `develop` にマージする（マージ自体はGitHub上で完結する）。マージが確認できたら、必ず以下を行ってから次のSBIに進む。
   - ローカルで `git checkout develop && git pull` し、リモートに追従させる（**ローカルで改めて `git merge` する必要はない**。GitHub側で既にマージ済みのため、pullでfast-forwardするだけでよい）。これを飛ばすとローカルの`develop`だけ取り残され、次のブランチを古い地点から切ってしまう。
   - リモートのSBIブランチはリポジトリ設定 `Automatically delete head branches`（ON済み）によりマージ後に自動削除される。ローカルのSBIブランチは `git branch -d <branch>` で手動削除する。
   - GitHubの `Closes #` はリポジトリのデフォルトブランチ（`main`）へのマージでしか自動発火しないため、`develop` へのマージではSBI issueは自動クローズされない。手動で `gh issue close <SBI番号>` する。
   - すべての子SBIがクローズされたら、PBI issueを手動でクローズする。
   - `develop` から `main` へのリリースマージ時には、そこに含まれるSBI issueの `Closes #` が自動発火する場合がある（すでに手動クローズ済みなら影響なし）。

## 3. ブランチ命名規約

```
{issue番号}-{kebab-caseの概要}
```

例: `13-position-capacity`, `27-fix-shift-overlap`

PBI自体はブランチを持たない（トラッキング用のissueのみ）。

ブランチ名に `#` を使わない。`#13-position-capacity` のように issue番号の前に `#` を付けると、GitHub側のPR head追跡が壊れ、pushしても `claude-code-review` の `synchronize` イベントが発火しなくなる不具合を実際に確認した（SBI #13、PR #16 → #17参照）。issue番号は `#` なしでそのまま先頭に置く。

## 4. 自動レビュー

- **一次レビュー（自動・PR作成時の1回のみ）**: GitHub Copilot code reviewを使う。リポジトリのRuleset（`develop`ブランチ向け、`copilot_code_review`ルール）で、PR作成時に自動でレビューされるよう設定済み。GitHub Education（学生特典）のCopilot Studentプランで利用でき、月200 AI Creditsの枠内で動く（1レビューあたり約13クレジット消費するため、`review_on_push`はOFFにしてpush毎の再レビューを止めている。無条件に誰でも使えるわけではなく、GitHub Educationの学生認定が前提）。
- **再レビュー・深掘りレビュー（手動）**: 修正後にもう一度Copilotレビューが欲しい場合はPRの「Reviewers」からCopilotを手動リクエストする。より深いレビューが欲しい場合は以下のいずれかを使う。
  - Claude Codeで `/code-review` （高効果度が必要な場合は `ultra`）を実行する。
  - `.github/workflows/claude-code-review.yml` をActionsタブから手動実行（`workflow_dispatch`、対象PR番号を入力）する。認証はClaude Pro/MaxのOAuthトークン（`claude setup-token` で発行し `CLAUDE_CODE_OAUTH_TOKEN` としてリポジトリSecretsに登録）を使用する。
- `claude-code-review.yml` は元々PR作成のたびに自動実行していたが、Claude Pro/Maxのレート制限（サブスクリプション上限）を頻繁に使い切ったため、自動トリガーを廃止し手動実行のみに変更した（SBI #20）。従量課金の `ANTHROPIC_API_KEY` 方式への切り替えも選択肢としてはあるが、Copilotが無料で使える間はそちらを優先する。
- どちらのレビューもコメントのみでマージをブロックしない。必要に応じてリポジトリのブランチ保護ルールで必須チェック化を検討する。

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
- **マージ権限**: 現状の開発者（リポジトリ管理者）が、main/developへのマージを単独で承認・実行する。Copilot自動レビュー（必要なら手動の深掘りレビューも）のコメントを確認したうえでマージする運用とする。
- ステータスチェックの必須化はまだ行っていない。自動レビューはコメント投稿のみでマージをブロックしない設計（4章）と一致させるため。チェックが安定して走ることを確認できたら、必須化を再検討する。
- 開発者が増えた場合は、承認必須（`required_approving_review_count` を1以上）に切り替えることを検討する。

## 7. Definition of Done（共通）

- [ ] SBIに書かれた受け入れ条件を満たしている
- [ ] 実機/ローカル環境で動作確認済み
- [ ] UI変更を含む場合、[docs/design.md](design.md) に準拠している
- [ ] テキストに絵文字を使用していない
- [ ] 自動レビュー（Copilot、必要なら手動の深掘りレビューも）のコメントを確認済み
