---
name: sbi-pr-create
description: push済みのブランチから .github/pull_request_template.md に沿ってPRを作成する（コミットやpushは行わない）。TRIGGER — 「PR作って」「PR出して」など、PR作成だけを頼まれたとき。SKIP: 未pushの変更がある場合は先に sbi-push で確認してからこのスキルを使う。
---

# SBI PR作成

## 実行契約

1. `git status` で現在のブランチがpush済みか確認する。未pushのコミットがあればユーザーに確認する（push自体は sbi-push の範囲）。
2. 紐づくSBI issue番号から `gh issue view <SBI番号>` で親PBI番号を取得する。
3. PR作成前に、共有システムに影響する操作である旨をユーザーに伝えて確認する。ユーザーの依頼がこの時点で明示的に「PR作成」と指示している場合は、それ自体を承認とみなしてよい。
4. `.github/pull_request_template.md` の構成でPR本文を組み立てる:
   - `Closes #<SBI番号>` / `関連PBI: #<PBI番号>`
   - 変更内容・動作確認内容は実際に行った内容のみを書く
   - DoDチェックリストは実際に確認できた項目だけチェックし、未確認の項目は空欄のまま残す
5. `gh pr create --title "..." --body "..."` で作成し、URLを報告する。`claude-code-review` ワークフローが自動でレビューコメントを投稿する旨も伝える。
6. PR作成で止まる。マージは行わない（マージはユーザー自身、または明示の指示があるときのみ）。

## Fail-safe

- SBI issueが特定できない/紐づくPBIが不明な場合は、Closes行を空欄のまま作成せずユーザーに確認する。
- 対象ブランチがmain/developの場合はPRを作成しない（作業ブランチが無い状態のため、先にブランチを切るべきか確認する）。
