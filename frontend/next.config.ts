import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
        return [
            {
                // /api/ で始まる全てのリクエストを捕捉
                source: "/api/:path*", 
                
                // 転送先のPythonバックエンドのURLを指定
                // ※ ここはあなたのFlaskサーバーのポートに合わせて変更してください！
                //     (例: 5000, 8000, 8080 など)
                destination: "http://127.0.0.1:5000/api/:path*",
            },
        ];
    },
};

export default nextConfig;
