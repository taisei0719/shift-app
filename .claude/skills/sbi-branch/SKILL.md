---
name: sbi-branch
description: SBI issueの実装に着手するとき、developを最新化してからSBIブランチを作成し、即座にリモートへも同名ブランチをpushする。TRIGGER — 「SBI #Nを実装しよう」「#Nから着手」「ブランチを切って」など、SBIの実装を開始するとき。SKIP: 既にブランチが存在し実装の続きを頼まれた場合は使わない。
---

# SBIブランチ作成

[docs/workflow.md](../../../docs/workflow.md) 2章3に従い、SBIごとの作業ブランチをdevelopから作成し、リモートにも即座に反映する。

## 実行契約

1. `git status` で未コミットの変更が無いか確認する。残っていれば、今のブランチでコミットするか、新しいSBIブランチに持ち越すかをユーザーに確認する。
2. 現在のブランチが `develop` でない場合、また `git status` が「behind」を示す場合は `git checkout develop && git pull` で最新化する。
3. `git checkout -b {issue番号}-{kebab-caseの概要}` でブランチを作成する（命名規約は3章参照、`#`は使わない）。
4. 作成したら即座に `git push -u origin <branch>` でリモートにも同名ブランチを作成し、upstreamを設定する。ローカルにしか存在しないブランチを残さない。
5. 完了を報告し、実装に進んでよいか確認する。

## Fail-safe

- pushが拒否された場合（同名の既存リモートブランチと衝突する等）は無理に上書きせず、状況をユーザーに伝える。
- 未コミットの変更を持ち越す場合は、その旨を明示してから進める（誤って握りつぶさない）。
