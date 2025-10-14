#!/bin/sh

# 1. PythonでDB接続を待機し、接続後にテーブル作成を実行
echo "Running Python script to wait for DB and initialize it..."
# wait_for_db()を実行し、その後 init_db() を実行する
python -c "from app import app, init_db, wait_for_db; with app.app_context(): wait_for_db(); init_db()"

# 2. Gunicorn サーバーを起動
echo "Starting Gunicorn server..."
exec gunicorn -w 4 -b 0.0.0.0:${PORT} app:app