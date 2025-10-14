# backend/start.sh
#!/bin/bash

# 1. データベースのテーブル作成と初期データ投入を実行
# app.py 内の init_db() 関数を実行する
python -c "from app import app, init_db; with app.app_context(): init_db()"

# 2. Gunicorn サーバーを起動
# $PORT 環境変数は Render が自動で設定してくれる
exec gunicorn -w 4 -b 0.0.0.0:${PORT} app:app