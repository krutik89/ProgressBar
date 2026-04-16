import path from 'path';
import { fileURLToPath } from 'url';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production entries — one per component (widget + config panel)
const COMPONENTS = {
  ProgressBar: './src/components/ProgressBar/index.ts',
  ProgressBarConfiguration: './src/components/ProgressBarConfiguration/index.ts',
};

export default (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    mode: isProd ? 'production' : 'development',

    // Dev: App.tsx harness. Prod: widget + config entries only.
    entry: isProd
      ? COMPONENTS
      : { app: './src/index.tsx' },

    output: {
      path: path.resolve(__dirname, isProd ? 'dist-bundle' : 'dist'),
      filename: isProd ? '[name].bundle.js' : '[name].js',
      globalObject: 'this',
      clean: true,
    },

    // Prod: React is external (Lens provides it globally).
    // Design-sdk is NOT external — must be bundled (Lens does not provide it).
    externals: isProd
      ? {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM',
          'react-dom/server': 'ReactDOMServer',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'react/jsx-dev-runtime': 'ReactJSXRuntime',
        }
      : {},

    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },

    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
        {
          test: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/[name][ext]' },
        },
      ],
    },

    plugins: [
      ...(isProd
        ? [new MiniCssExtractPlugin({ filename: '[name].bundle.css' })]
        : [
            new HtmlWebpackPlugin({
              template: './public/index.html',
              filename: 'index.html',
            }),
          ]),
    ],

    ...(!isProd && {
      devServer: {
        static: path.resolve(__dirname, 'dist'),
        port: 3000,
        hot: true,
        open: false,
        historyApiFallback: true,
      },
    }),
  };
};
