# シフト管理・自動調整システム (Shift App)

このアプリケーションは、店舗のシフト希望の提出から、時間帯別の必要人数に基づいたシフトの自動調整、および管理までを一気通貫で行うフルスタックWebアプリケーションです。

### テストユーザー
| username | role | password |
| :--- | :--- | :--- |
| admin | admin | pass |
| yamada | staff | pass |
| sato | staff | pass |
| suzuki | staff | pass |

## 主な機能

- **ユーザー認証**: JWT（JSON Web Token）を使用したセキュアなログイン管理。
- **店舗管理**: 店舗コードによるスタッフの紐付け。
- **シフト提出**: カレンダーUIからの直感的なシフト希望提出機能。
- **シフト自動調整(未実装)**: 時間帯別の定員設定（AutoAdjustConfig）に基づいたシフト割り当て。
- **管理者ダッシュボード**: 店舗全体の設定、確定シフトの公開管理。

## 技術スタック

### フロントエンド
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Axios

### バックエンド
- **Framework**: Flask (Python)
- **Database**: SQLite (開発時)
- **Database**: PostgleSQL (実運用時)
- **Auth**: Flask-JWT-Extended
- **Web Server**: Gunicorn

### モバイル
- **Framework**: Flutter
- **Language**: Dart

### インフラ・運用
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Render
- **Database Hosting**: Render (PostgreSQL)
- **Container**: Docker / Docker Compose

## セットアップ・実行方法

### プリセット
- Docker および Docker Compose がインストールされていること。

### 起動手順
1. リポジトリをクローンします。
2. プロジェクトのルートディレクトリで以下のコマンドを実行します。
   ```bash
   docker compose up -d --build




