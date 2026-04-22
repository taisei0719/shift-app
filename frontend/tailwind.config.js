// frontend/tailwind.config.js

// dummy: true,

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwindにスキャンするファイルを教える
  content: [
    "./**/*.{js,ts,jsx,tsx,mdx}", // すべてのディレクトリをスキャン
  ],

  theme: {
    extend: {
      // (もしあれば、カスタムテーマ設定などをここに記述)
    },
  },
  plugins: [],
};