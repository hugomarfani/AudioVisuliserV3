/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import { dependencies as externals } from '../../release/app/package.json';
import path from 'path';

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
            },
          },
        },
      },
      {
        // Support for MP3 files
        test: /\.(mp3|wav)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/audio/[name][ext]', // Store MP3 files in assets/audio
        },
      },
      {
        // Support for images (PNG, JPEG, SVG, GIF)
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]', // Store images in assets/images
        },
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.css'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
    // Add fallbacks for Node.js core modules
    fallback: {
      "vm": require.resolve("vm-browserify"),
      "child_process": false,
      "fs": false,
      "path": false,
      "os": false,
      "crypto": false,
      "stream": false,
      "http": false,
      "https": false,
      "zlib": false,
      "util": false,
      "url": false,
      "net": false,
      "tls": false,
      "assert": false,
      "buffer": false
    },
    alias: {
      // Add aliases for problematic modules
      'node-aead-crypto': path.resolve(__dirname, '../../src/mocks/node-aead-crypto.js'),
      'node-dtls-client': path.resolve(__dirname, '../../src/mocks/node-dtls-client.js'),
      'node-dtls-client/build/lib/AEADCrypto': path.resolve(__dirname, '../../src/mocks/dtls-crypto.js'),
      'phea': path.resolve(__dirname, '../../src/mocks/phea.js'),
      'phea/build/hue-dtls': path.resolve(__dirname, '../../src/mocks/hue-dtls.js'),
    },
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
    // Ignore all native modules
    new webpack.IgnorePlugin({
      resourceRegExp: /\.node$/,
    }),
    // Provide empty implementations for any remaining problematic modules
    new webpack.NormalModuleReplacementPlugin(
      /phea\/build\/hue-dtls/,
      'lodash/noop'
    ),
    // Add explicit rules for any modules that might still cause issues
    new webpack.NormalModuleReplacementPlugin(
      /phea\/build\/(.*)/,
      (resource) => {
        // Try to use our mocks for any phea submodule
        const mockPath = path.resolve(__dirname, `../../src/mocks/${resource.request.split('/').pop()}.js`);
        try {
          require.resolve(mockPath);
          resource.request = mockPath;
        } catch (e) {
          // If no specific mock exists, use the main phea mock
          resource.request = path.resolve(__dirname, '../../src/mocks/phea.js');
        }
      }
    ),
  ],
};

export default configuration;
