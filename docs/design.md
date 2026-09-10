# フロントエンド デザイン仕様

frontend (Next.js / Tailwind CSS) における配色・角丸・shadow・余白・タイポグラフィのルール。
既存コードから抽出した規約を正準化したもの。新規UI実装・既存UIの改修時はこれに従う。

`tailwind.config.js` の `theme.extend` は空（カスタムトークンなし）のため、
ここに書かれたクラスの組み合わせ自体が唯一のデザインシステム。

## 1. カラーパレット

| 用途 | 色 | 代表クラス |
|---|---|---|
| プライマリ（操作・ヘッダー・リンク） | indigo | `bg-indigo-700`(ヘッダーバー) / `bg-indigo-600 hover:bg-indigo-700`(主要ボタン) / `text-indigo-600` |
| 確定・成功 | emerald | `bg-emerald-50/100` `text-emerald-700` `border-emerald-200/300` |
| 希望・未確定・保留 | amber | `bg-amber-50/100` `text-amber-700` `border-amber-200` |
| 調整・警告（軽め） | orange | `bg-orange-100 text-orange-600` |
| エラー・危険・日曜 | red | `bg-red-50 border-red-200 text-red-700`（バナー） / `text-red-500`（日曜） / `border-red-400`（本日強調） |
| 土曜・情報 | blue | `text-blue-500`（土曜） / `bg-blue-50 border-blue-200`（情報バナー） |
| ニュートラル | gray | `bg-gray-50`（ページ背景） / `border-gray-200`（カード枠） / `text-gray-400〜900`（階層） |

**ステータス系の三点セットパターン**: `bg-{color}-50 border-{color}-200 text-{color}-700`（バナー）、
または `bg-{color}-100 text-{color}-700`（バッジ/ピル）。同じ色相で濃淡を揃える。

> 旧ファイルに残る `green-*` / `yellow-*` は emerald/amber への移行対象（既存の見た目を壊す改修は伴わない範囲で、新規実装は emerald/amber を使う）。

## 2. 角丸（border-radius）

| 要素 | クラス |
|---|---|
| 外側カードコンテナ | `rounded-2xl` |
| サブカード・統計タイル・詳細パネル | `rounded-xl` |
| カレンダー日付セル | `rounded-xl` |
| バッジ・ピル | `rounded-full` |
| インラインの小タグ・凡例スウォッチ | `rounded` |
| ボタン・入力欄 | `rounded-lg` |

> 旧ページの `rounded-lg`（カードコンテナ）は `rounded-2xl` への移行対象。

## 3. シャドウ

| 強さ | クラス | 使う場所 |
|---|---|---|
| 最大 | `shadow-xl` | ページ最上位のカード・コンテナ（基本これを使う） |
| 中 | `shadow-md` | 提出ボタン、選択中のカレンダーセル、強調ボタン |
| 小 | `shadow-sm` | 入力欄、リスト行 |
| なし〜極小 | `shadow` | コンパクトな統計タイル |

## 4. ボーダー

- デフォルト: `border border-gray-200`（カード）、`border-gray-300`（入力欄）、`border-gray-100`（カード内の区切り線）。
- 強調・状態あり要素: `border-2`（カレンダーセル、アウトラインボタン）。
- 空状態: `border border-dashed border-gray-300`。
- セクション区切り: `border-t` / `border-b`。
- 色付きボーダーは上記カラーパレットの三点セットに従う。

## 5. 余白・スペーシング

- カードのpadding: `p-6`（標準）。
- カード内ヘッダーバー: `px-6 py-4`。
- リスト行: `px-6 py-4` または `py-3`。
- カレンダーグリッドのgap: `gap-0.5`。
- 一般的なgap: `gap-3`（標準）、`gap-6`（2カラムレイアウト間）。
- フォーム等の縦リズム: `space-y-4`。
- ページ外側のpadding: `p-4 sm:p-6`。
- カレンダーセルのpadding: `p-2`。

## 6. タイポグラフィ

- 太さ: 見出し・数字は `font-bold`、ラベル・バッジ・サブボタンは `font-semibold`、フォームラベル・キャプションは `font-medium`。
- サイズ階層: `text-2xl`（ページ見出し・大きな数字）→ `text-xl`（カードのセクション見出し）→ `text-base`（サブ見出し）→ `text-sm`（本文・ボタンの標準）→ `text-xs`（キャプション・バッジ・テーブルヘッダー、`uppercase tracking-wide` を伴うことが多い）。
- 文字色（グレー階層）: `text-gray-900`（主見出し）→ `text-gray-700`（本文・ラベル）→ `text-gray-500`（キャプション）→ `text-gray-400`（プレースホルダー・空状態）。

## 7. コンポーネントパターン

```
カードコンテナ:
bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden

カード内ヘッダーバー:
bg-indigo-700 text-white px-6 py-4

主要ボタン:
bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg

アウトラインボタン:
border-2 border-indigo-400 text-indigo-600 hover:bg-indigo-50 rounded-lg
（ニュートラル版: border border-gray-300 text-gray-700 hover:bg-gray-50）

バッジ/ピル:
px-2.5 py-1 rounded-full text-xs font-semibold bg-{color}-100 text-{color}-700

空状態:
border border-dashed border-gray-300 rounded-xl py-10〜12 text-center text-gray-400 text-sm
（絵文字・アイコンは付けない。テキストのみ）

エラー表示:
p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center
```

## 8. レイアウト

- ページラッパー: `min-h-screen bg-gray-50`。
- カレンダーのグリッド: `grid grid-cols-7`。
- 2カラムレスポンシブ分割: `flex flex-col lg:flex-row gap-6`、左 `w-full lg:w-3/5`、右 `w-full lg:w-2/5`。

## 9. テキストに関するルール

- **絵文字は使用しない。** ステータス・ボタン・メッセージはテキストのみで表現する（色・バッジ・アイコンコンポーネントで意味を補強する場合は `lucide-react` 等のアイコンを検討してもよいが、絵文字文字は不可）。

## 10. admin / staff カレンダーの統一方針

- 外枠（カードコンテナ・ヘッダーバー・曜日見出し・セルの角丸/枠線/グリッドgap）は admin・staff で共通にする。
- セル内部の表示内容（ステータステキストの位置、バッジの有無など）は各画面の機能要件に応じて異なってよい。
- 配色は本仕様の三点セット（emerald=確定、amber=希望、red=日曜・警告、blue=土曜）に従う。

## 既知の不整合（将来的に解消する／新規実装では踏襲しない）

1. カードの角丸: 旧ページの `rounded-lg` → `rounded-2xl` に統一していく。
2. ステータス色: 旧ファイルの `green-*`/`yellow-*` → `emerald-*`/`amber-*` に統一していく。
3. エラーバナーの濃淡: `bg-red-50/border-red-200` と `bg-red-100/border-red-300` が混在 → `bg-red-50/border-red-200` を正とする。
4. ページ背景: ほぼ全て `bg-gray-50` だが一部 `bg-gray-100` が混在 → `bg-gray-50` を正とする。
5. `frontend/app/shifts/[date]/_ShiftViewClient.tsx` はTailwindを使わずインラインstyle+生hexで実装されている → 触る際はTailwindへ移行する。
