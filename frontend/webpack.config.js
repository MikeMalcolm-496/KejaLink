/**
 * webpack.config.js: how the React code is bundled for the browser.
 *
 *   npm start      development server on http://localhost:3000 with live reload;
 *                  calls to /api and /uploads are forwarded to the Express API on :5000
 *   npm run build  optimised files in /dist, served by the Express server in production
 *
 * Babel turns modern JavaScript + JSX into code every browser understands.
 */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const production = argv.mode === 'production';
  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: production ? 'js/[name].[contenthash:8].js' : 'js/[name].js',
      publicPath: '/',
      clean: true,
    },
    devtool: production ? false : 'eval-source-map',
    resolve: { extensions: ['.js', '.jsx'] },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]] } },
        },
        { test: /\.css$/, use: [production ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'] },
        { test: /\.(woff2?|ttf|eot)$/, type: 'asset/resource', generator: { filename: 'fonts/[name][ext]' } },
        { test: /\.(png|jpe?g|svg)$/, type: 'asset/resource', generator: { filename: 'img/[name].[contenthash:8][ext]' } },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html', favicon: './public/favicon.svg' }),
      new CopyWebpackPlugin({ patterns: [{ from: 'public/seed', to: 'seed' }, { from: 'public/logo.svg', to: 'logo.svg' }] }),
      ...(production ? [new MiniCssExtractPlugin({ filename: 'css/[name].[contenthash:8].css' })] : []),
    ],
    devServer: {
      port: 3000,
      historyApiFallback: true,                       // let React Router handle every URL
      proxy: [{ context: ['/api', '/uploads'], target: 'http://localhost:5000' }],
      static: { directory: path.join(__dirname, 'public') },
    },
    performance: { hints: false },
  };
};
