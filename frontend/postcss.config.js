// frontend/postcss.config.js

const config = {
  plugins: {   
    'tailwindcss': {},  // PostCSSにTailwind CSSプラグインを読み込ませる（キーは文字列 'tailwindcss'）   
    'autoprefixer': {},  // ベンダープレフィックス自動追加用のAutoprefixerも追加するのが標準
  },
}

module.exports = config;