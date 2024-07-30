import path from 'path';
import { babel } from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import pkg from './package.json';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve';
import { uglify } from 'rollup-plugin-uglify';
import eslint from '@rollup/plugin-eslint';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const extensions = ['.js', '.ts'];

const resolve = function (...args) {
  return path.resolve(__dirname, ...args);
};
const isDev = process.env.NODE_ENV !== 'prod';

const outputs = [
  {
    file: resolve('dist/index.cjs.js'),
    format: 'cjs',
  },
  {
    file: resolve('dist/index.es.js'),
    format: 'es',
  },
  {
    file: resolve('dist/index.js'),
    format: 'umd',
    name: 'index',
  },
  {
    file: resolve('dist/index.min.js'),
    format: 'umd',
    isUglify: true,
    name: 'index.min',
  },
  {
    file: resolve('dist/bin/i18n-command.js'),
    format: 'cjs',
    isBin: true,
    banner: '#!/usr/bin/env node',
  },
].map((i) => {
  i.sourcemap = isDev; // 开发模式：开启sourcemap文件的生成
  return i;
});
const len = outputs.length;

const config = outputs.map((output, i) => {
  const isUglify = output.isUglify && !isDev;
  return {
    input: output.isBin
      ? resolve('./src/index.bin.ts')
      : resolve('./src/index.ts'),
    output,
    plugins: [
      // rollup-plugin-commonjs应该用在其他插件转换你的模块之前 - 这是为了防止其他插件的改变破坏CommonJS的检测
      // 作用：将CommonJS模块转换为 ES2015 供 Rollup 处理
      commonjs({ transformMixedEsModules: true, ignoreDynamicRequires: true }),
      // 作用：告诉 Rollup 如何查找外部模块
      nodeResolve({
        extensions,
        modulesOnly: true,
        preferBuiltins: true,
        browser: true,
        jsnext: true,
        main: true,
        customResolveOptions: {
          moduleDirectories: ['node_modules'],
        },
      }),
      nodePolyfills(),
      eslint({
        include: ['src/**'],
        throwOnError: true,
        throwOnWarning: false,
      }),
      babel({
        extensions,
        exclude: 'node_modules/**', // 只编译我们的源代码
        babelHelpers: 'runtime',
      }),
      ...(isDev && i === len - 1
        ? [
            serve({
              // 使用开发服务插件
              port: 3001,
              // 设置 exmaple的访问目录和dist的访问目录
              contentBase: [resolve('example'), resolve('dist')],
            }),
          ]
        : []),
      ...(isUglify ? [uglify()] : []),
      // 作用：处理json格式文件
      json(),
    ],
    // 作用：指出应将哪些模块视为外部模块，否则会被打包进最终的代码里
    external: output.isBin
      ? []
      : [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
          ...['path', 'fs', 'typescript'],
        ],
  };
});

module.exports = config;
