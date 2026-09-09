# shift-app

## デザイン規約

frontend (Next.js / Tailwind) のUI・デザインに関わる変更を行う前に、必ず [docs/design.md](docs/design.md) を読んで配色・角丸・shadow・余白・タイポグラフィのルールに従うこと。admin/staffで見た目を揃える際もこの仕様を基準にする。

テキストに絵文字は使用しない（docs/design.md 9章）。

## 開発フロー

PBI/SBIの起票、ブランチ命名規約、PR作成〜Claudeレビューの運用は [docs/workflow.md](docs/workflow.md) に従うこと。SBI実装のブランチは `sbi/{issue番号}-{概要}` 形式で作成し、PRは `.github/pull_request_template.md` のDoDチェックリストを満たしてから作成する。
