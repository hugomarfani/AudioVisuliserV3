/**
 * Builds the DLL for development electron renderer process
 */

import webpack from 'webpack';
import path from 'path';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import { dependencies } from '../../package.json';
import checkNodeEnv from '../scripts/check-node-env';

checkNodeEnv('development');

const dist = webpackPaths.dllPath;

// Import the renderer dev config to use its module rules
const rendererDevConfig = require('./webpack.config.renderer.dev').default;
const rendererModule = rendererDevConfig.module;

// Append rules to relax fully specified resolution for node-hue-api ESM files
rendererModule.rules.push(
  {
    test: /\.mjs$/,
    include: /node_modules[\\\/]node-hue-api[\\\/]dist[\\\/]esm/,
    type: 'javascript/auto',
    resolve: {
      fullySpecified: false,
    },
  },
  {
    test: /\.js$/,
    include: /node_modules[\\\/]node-hue-api[\\\/]dist[\\\/]esm/,
    resolve: {
      fullySpecified: false,
    },
  }
);

const configuration: webpack.Configuration = {
  context: webpackPaths.rootPath,
  devtool: 'eval',
  mode: 'development',
  target: 'electron-renderer',
  externals: ['fsevents', 'crypto-browserify'],
  module: rendererModule,
  entry: {
    renderer: Object.keys(dependencies || {}),
  },
  output: {
    path: dist,
    filename: '[name].dev.dll.js',
    library: {
      name: 'renderer',
      type: 'var',
    },
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(dist, '[name].json'),
      name: '[name]',
    }),
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),
    new webpack.LoaderOptionsPlugin({
      debug: true,
      options: {
        context: webpackPaths.srcPath,
        output: {
          path: webpackPaths.dllPath,
        },
      },
    }),
  ],
};

export default merge(baseConfig, configuration);
