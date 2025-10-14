#!/bin/sh

# 1. PostgreSQLが起動するのを待つため、数秒間待機する (RenderのFree Tierで安定させるため)
echo "Waiting 5 seconds for PostgreSQL to be fully ready..."
sleep 5

# 2. データベースのテーブル作成と初期データ投入を実行
echo "Running database initialization (init_db)..."
python -c "from app import app, init_db; with app.app_context(): init_db()"

# 3. Gunicorn サーバーを起動
echo "Starting Gunicorn server..."
exec gunicorn -w 4 -b 0.0.0.0:${PORT} app:app