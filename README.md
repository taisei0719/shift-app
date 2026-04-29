# BestShift - シフト管理・自動調整システム

飲食店でのアルバイト経験から着想を得た、シフト希望の提出から自動調整・確定までを一気通貫で行うフルスタックWebアプリケーションです。
店長・オーナーがシフト調整に費やす時間と労力を大幅に削減することを目指しています。

## リンク

- **デモサイト**: <https://shift-app-iota.vercel.app>

## テストアカウント

|username|role     |password|
|:-------|:--------|:-------|
|admin   |オーナー(管理者)|pass    |
|yamada  |スタッフ     |pass    |
|sato    |スタッフ     |pass    |
|suzuki  |スタッフ     |pass    |
|taro	   |スタッフ	|pass|
|hanako	|スタッフ	|pass|
|jiro	   |スタッフ	|pass|
|sakura	|スタッフ	|pass|
|akira	|スタッフ	|pass|
|yuki	|スタッフ	|pass|
|hana	|スタッフ	|pass|


> バックエンドはRenderの無料プランで稼働しているため、初回アクセス時に起動まで数十秒かかる場合があります。

-----

## 主な機能

### スタッフ向け

- **シフト希望提出**: カレンダーUIから直感的にシフト希望を提出
- **確定シフト確認**: 月次サマリーで確定シフト・労働時間を一覧表示
- **店舗参加**: 店舗コードを入力してオーナーに参加リクエストを送信

### 管理者(オーナー)向け

- **シフト状況カレンダー**: 月単位で各日の希望提出状況を色分け表示
  - 🟢 確定済み / 🟡 希望提出済み(未確定) / 🔴 希望なし
- **シフト調整・確定**: ガントチャートUIでスタッフのシフトを視覚的に調整・確定
- **シフト自動調整**: 時間帯別定員・スタッフ優先度・累積棄却率を考慮した自動割り当て
- **棄却履歴管理**: スタッフごとの希望採用率を記録し、長期的な公平性を担保
- **参加リクエスト承認**: スタッフの店舗参加リクエストを承認/拒否

### 共通

- **JWT認証**: Flask-JWT-Extendedによるセキュアな認証管理
- **アカウント管理**: プロフィール編集・アカウント削除

-----

## 技術スタック

### フロントエンド

|技術                     |用途        |
|:----------------------|:---------|
|Next.js 15 (App Router)|フレームワーク   |
|TypeScript             |言語        |
|Tailwind CSS v4        |スタイリング    |
|React Context API      |状態管理      |
|Axios                  |HTTPクライアント|
|date-fns               |日付処理      |

### バックエンド

|技術                |用途        |
|:-----------------|:---------|
|Flask (Python)    |フレームワーク   |
|Flask-JWT-Extended|JWT認証     |
|SQLAlchemy        |ORM       |
|PostgreSQL        |データベース(本番)|
|SQLite            |データベース(開発)|
|Gunicorn          |WSGIサーバー  |

### モバイル

|技術       |用途        |
|:--------|:---------|
|Flutter  |フレームワーク   |
|Dart     |言語        |
|Riverpod |状態管理      |
|go_router|ルーティング    |
|Dio      |HTTPクライアント|

### インフラ

|技術                     |用途            |
|:----------------------|:-------------|
|Vercel                 |フロントエンドホスティング |
|Render                 |バックエンドホスティング  |
|Render PostgreSQL      |データベースホスティング  |
|Docker / Docker Compose|コンテナ化・ローカル開発環境|

-----

## 技術的な工夫点

### 自動調整アルゴリズム

単純な優先度順ではなく、**累積棄却率**を考慮した貪欲法を実装しています。

```
ソート基準:
1. 優先度（高い順）
2. 同優先度内 → 累積棄却率（高い順）= 過去に多く棄却されたスタッフを優先
3. 同棄却率 → ランダム（毎回同じスタッフが有利にならないように）
```

これにより長期的なシフト割り当ての公平性を担保しています。

### JWT認証 + Cookie管理

モバイルアプリ（Authorizationヘッダー）とWebアプリ（Cookie）の両方に対応するため、`JWT_TOKEN_LOCATION = ["headers", "cookies"]` を設定し、どちらからのリクエストにも対応できる構成にしています。

### マルチプラットフォーム対応

同一バックエンドAPIをWeb（Next.js）とモバイル（Flutter）の両方から利用できる設計にしており、APIのレスポンス形式を統一しています。

-----

## プロジェクト構成

```
shift-app/
├── frontend/          # Next.js (Vercel)
│   ├── app/
│   │   ├── admin/     # 管理者画面
│   │   ├── shifts/    # スタッフ向けシフト画面
│   │   ├── shop/      # 店舗管理画面
│   │   └── context/   # React Context (認証状態管理)
│   └── components/    # 共通コンポーネント
├── backend/           # Flask (Render)
│   ├── app.py         # APIエンドポイント
│   ├── models.py      # DBモデル定義
│   └── start.sh       # Gunicorn起動スクリプト
├── mobile/            # Flutter (開発中)
│   └── lib/
│       ├── screens/   # 各画面
│       ├── widgets/   # 共通ウィジェット
│       └── repositories/ # API通信層
└── docker-compose.yml # ローカル開発環境
```

-----

## ローカル環境でのセットアップ

### 前提条件

- Docker / Docker Compose がインストールされていること

### 起動手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/taisei0719/shift-app.git
cd shift-app

# 2. 起動
docker compose up -d --build

# 3. アクセス
# フロントエンド: http://localhost:3000
# バックエンド:   http://localhost:5000
```

### 初期データ

起動時に以下のデータが自動生成されます。

- テスト店舗（teststore1）
- テストユーザー（admin, yamada, sato, suzuki ほか）
- 30日分のランダムなシフト希望データ
- 自動調整用の定員設定

-----

## API エンドポイント一覧

|メソッド    |エンドポイント                                |説明       |権限    |
|:-------|:--------------------------------------|:--------|:-----|
|POST    |`/api/login`                           |ログイン     |-     |
|POST    |`/api/logout`                          |ログアウト    |-     |
|POST    |`/api/register`                        |ユーザー登録   |-     |
|GET     |`/api/session`                         |セッション確認  |-     |
|GET     |`/api/shifts/month/:year/:month`       |月別シフト取得  |ログイン済み|
|POST    |`/api/shifts/submit_request`           |シフト希望提出  |ログイン済み|
|GET     |`/api/admin/shifts/status/:year/:month`|月別シフト状況取得|管理者   |
|GET     |`/api/admin/shifts/:date`              |日別シフト取得  |管理者   |
|POST    |`/api/admin/shifts/confirm`            |シフト確定    |管理者   |
|POST    |`/api/admin/shifts/auto_adjust/:date`  |シフト自動調整  |管理者   |
|GET/POST|`/api/shop/:id/auto_adjust/config`     |自動調整設定   |管理者   |
|GET     |`/api/shop/:id/rejection_history`      |棄却履歴取得   |管理者   |

-----

## 今後の実装予定

- [ ] モバイルアプリ（Flutter）の完成
- [ ] ポジション別の定員設定
- [ ] 給与計算・人件費管理機能
- [ ] プッシュ通知（シフト確定時）
- [ ] 複数店舗への所属対応
- [ ] セキュリティ強化（CSRF対策など）