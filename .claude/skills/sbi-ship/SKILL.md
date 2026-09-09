---
name: sbi-ship
description: SBI実装が一段落したときの、コミット→push→PR作成までを docs/workflow.md と .github/pull_request_template.md に沿って行う。TRIGGER — 「コミットして」「pushして」「PR作って」「SBI終わったから出して」など、実装後の提出作業を頼まれたとき。SKIP: コミットのみ/pushのみを明示的に頼まれた場合はその範囲で止め、先の工程は勝手に進めない。
---

# SBI提出（commit → push → PR）

[docs/workflow.md](../../../docs/workflow.md) の「1 SBI = 1ブランチ = 1PR」運用と `.github/pull_request_template.md` のDoDチェックリストに沿って、実装済みの変更をPRまで提出する。

## 実行契約

1. `git branch --show-current` で現在のブランチを確認する。`#{issue番号}-{概要}` 命名規約に沿っているか確認し、main/developで直接作業している場合は先に正しいブランチを切るべきか確認する。ブランチ名の `#` はシェルのコメント開始文字になるため、ブランチ名を使うコマンドは必ずクォートする（例: `git checkout "#13-branch-protection"`）。
2. `git status` / `git diff` で変更内容を確認し、紐づくSBI issue（`gh issue view <SBI番号>`）のDefinition of Doneと突き合わせる。満たしていない項目があれば作業を止めてユーザーに伝える。
3. 意味のある単位でコミットする。メッセージは `#<issue番号> <type>: <説明>` 形式で書く（[docs/workflow.md](../../../docs/workflow.md) 参照）。
   - `<issue番号>` は紐づくSBI issue番号（PBI番号ではない）
   - `<type>` は `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `style` / `perf` から変更内容に最も近いものを選ぶ
   - `<説明>` は「なぜ」に触れた簡潔な日本語
   - 例: `#13 feat: mainブランチにPR必須の保護ルールを追加`
   - Co-Authored-By / Claude-Session の付与指示がconversation内にあればそれに従う。
4. push前に、pushとPR作成は共有システムに影響する操作である旨をユーザーに伝え、実行してよいか確認する。ただしユーザーの依頼が「コミットしてPRまで出して」のように既に一連の作業として明示されている場合は、その依頼自体を承認とみなしてよい。
5. push する（force pushはしない。upstream未設定なら `git push -u origin "<branch>"`。ブランチ名はクォートする）。
6. `.github/pull_request_template.md` の構成でPR本文を組み立てる:
   - `Closes #<SBI番号>` / `関連PBI: #<PBI番号>`（PBI番号はSBI issueの「親PBI」欄から取得）
   - 変更内容・動作確認内容は実際に行った内容のみを書く
   - DoDチェックリストは実際に確認できた項目だけチェックし、確認していない項目（実機確認・design.md準拠など）は未チェックのまま残す
7. `gh pr create --title "..." --body "..."` でPRを作成し、URLをユーザーに報告する。`claude-code-review` ワークフローが自動でレビューコメントを投稿する旨も伝える。

## Fail-safe

- 未コミットの変更に加えて、意図しないファイル（.env等の機密情報が疑われるもの）が含まれていないか `git status` の結果を確認してからstageする。
- SBI issueが特定できない/紐づくPBIが不明な場合は、PRのCloses行を空欄のまま作成せず、ユーザーに確認する。
- pre-commit/CIフックが失敗した場合は `--no-verify` 等で回避せず、原因を修正してから再コミットする。
- 対象ブランチがmain/developの場合はpushやPR作成を行わず、まずSBIブランチを切るようユーザーに確認する。
