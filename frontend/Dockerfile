# frontend/Dockerfile
# Next.jsアプリのビルド用にNode.jsのイメージを使う
FROM node:22-slim AS builder

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピーして依存関係をインストール
COPY package*.json ./
RUN npm install

# 全てのファイルをコピー
COPY . .

# Next.jsアプリを本番用にビルド
RUN npm run build

# --- 本番環境用の軽量なイメージ ---
FROM node:22-slim

# 作業ディレクトリを設定
WORKDIR /app

# builderステージから必要なファイルのみコピー
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Next.jsのデフォルトポート3000番を公開
EXPOSE 3000

# Next.jsアプリを本番モードで起動
CMD ["npm", "start"]