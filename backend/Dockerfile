# backend/Dockerfile
# Pythonの公式イメージを使う
FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係のファイルをコンテナにコピー
COPY requirements.txt .

# 依存関係をインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションのコードをコンテナにコピー
COPY . .

# Flaskのデフォルトポート5000番を公開
EXPOSE 10000

# Gunicornを使ってアプリを起動
# ホスト0.0.0.0でリッスンさせるのが大事
CMD gunicorn -w 4 -b 0.0.0.0:${PORT} app:app