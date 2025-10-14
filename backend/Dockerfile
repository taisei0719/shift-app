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

RUN chmod +x start.sh

# Flaskのデフォルトポート5000番を公開
EXPOSE 10000

CMD ["./start.sh"]