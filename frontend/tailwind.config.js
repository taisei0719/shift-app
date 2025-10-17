// frontend/tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwindにスキャンするファイルを教える
  content: [
    "**/*.{js,ts,jsx,tsx,mdx}", // app/ディレクトリをスキャン
    "./pages/**/*.{js,ts,jsx,tsx,mdx}", // pages/ディレクトリをスキャン
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // components/ディレクトリをスキャン
  ],

  theme: {
    extend: {
      // (もしあれば、カスタムテーマ設定などをここに記述)
    },
  },
  plugins: [],
};