---
name: sbi-pr-create
description: push済みのブランチから .github/pull_request_template.md に沿ってPRを作成する（コミットやpushは行わない）。また、ユーザーから「マージした」と報告されたときのマージ後フォローアップ（ローカルdevelop同期・issue close・PBIチェックリスト更新）もこのスキルの範囲。TRIGGER — 「PR作って」「PR出して」などPR作成を頼まれたとき、または「マージした」とマージ完了を報告されたとき。SKIP: 未pushの変更がある場合は先に sbi-push で確認してからこのスキルを使う。
---

# SBI PR作成とマージ後フォローアップ

## PR作成の実行契約

1. `git status` で現在のブランチがpush済みか確認する。未pushのコミットがあればユーザーに確認する（push自体は sbi-push の範囲）。
2. 紐づくSBI issue番号から `gh issue view <SBI番号>` で親PBI番号を取得する。
3. PR作成前に、共有システムに影響する操作である旨をユーザーに伝えて確認する。ユーザーの依頼がこの時点で明示的に「PR作成」と指示している場合は、それ自体を承認とみなしてよい。
4. `.github/pull_request_template.md` の構成でPR本文を組み立てる:
   - `Closes #<SBI番号>` / `関連PBI: #<PBI番号>`
   - 変更内容・動作確認内容は実際に行った内容のみを書く
   - DoDチェックリストは実際に確認できた項目だけチェックし、未確認の項目は空欄のまま残す
5. `gh pr create --base develop --title "..." --body "..."` で作成し、URLを報告する。GitHub Copilot code reviewがPR作成・push毎に自動でレビューコメントを投稿する旨も伝える（深掘りが必要なら `/code-review` または `claude-code-review.yml` の手動実行）。
6. PR作成直後に、今月のCopilot AI Credits消費量を確認して報告する:
   `gh api "users/$(gh api user -q .login)/settings/billing/usage?year=<現在の年>&month=<現在の月>" -q '[.usageItems[] | select(.product=="copilot" and .sku=="Copilot AI Credits")] | (map(.quantity) | add) // 0'`
   月200クレジットが上限（Copilot Studentプラン、additional usageはdisabled）。消費量が上限に近い（目安: 8割=160クレジット超）場合は、Copilot自動レビューが今月中に止まる可能性がある旨をユーザーに伝える。
7. PR作成で止まる。マージは行わない（マージはユーザー自身、または明示の指示があるときのみ）。

## マージ後フォローアップの実行契約

ユーザーから「マージした」と報告されたら、`gh pr view <PR番号> --json state,mergedAt` でマージ済みを確認したうえで、以下を行う（[docs/workflow.md](../../../docs/workflow.md) 2章7参照）。

1. `git checkout develop && git pull` でローカルの `develop` をリモートに追従させる（GitHub側で既にマージ済みのため、ローカルで改めて `git merge` する必要はない。pullでfast-forwardするだけでよい）。
2. `Closes #` はデフォルトブランチ（`main`）へのマージでしか自動発火しないため、`develop` へのマージではSBI issueは自動クローズされない。`gh issue close <SBI番号>` で手動クローズする。
3. 親PBI issueの「関連SBI」チェックリストで該当SBIにチェックを付ける（`gh issue edit`）。すべての子SBIがクローズされたら、PBI issue自体を手動でクローズしてよいか確認する。
4. マージ済みのローカル作業ブランチを `git branch -d <branch>` で削除する（安全のためmergeされていないと削除できないコマンドを使う。`-D` は使わない）。リモート側はリポジトリ設定 `Automatically delete head branches` により自動削除されるため、`git push origin --delete` は不要。

## Fail-safe

- SBI issueが特定できない/紐づくPBIが不明な場合は、Closes行を空欄のまま作成せずユーザーに確認する。
- 対象ブランチがmain/developの場合はPRを作成しない（作業ブランチが無い状態のため、先にブランチを切るべきか確認する）。
- マージ後フォローアップの手順1を飛ばすと、ローカル`develop`が古いままになり、次のSBIブランチを誤って古い地点から切ってしまう（実際に発生した事故）。マージ報告を受けたら必ずこの手順を実行する。
