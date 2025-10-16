// frontend/postcss.config.js

module.exports = {
  plugins: [
    // Tailwind CSS v4のPostCSSプラグインを直接 require で読み込む
    require('@tailwindcss/postcss'), 
    // Autoprefixerも同様に require で読み込む
    require('autoprefixer'),
  ],
};
