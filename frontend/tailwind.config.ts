// frontend/tailwind.config.ts

import type { Config } from 'tailwindcss';

const config: Config = {
  // Next.js App Routerの推奨パスを使用
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // (もしあれば、カスタムテーマ設定などをここに記述)
    },
  },
  plugins: [],
};

export default config;