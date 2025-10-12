// next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
        return [
            {
                // /api/ で始まる全てのリクエストを捕捉
                source: "/api/:path*",                 
                // 転送先のPythonバックエンドのURLを指定
                destination: "http://shift_app_backend:5000/api/:path*",
            },
        ];
    },
};

export default nextConfig;