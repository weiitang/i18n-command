// 配置初始化及根据配置
import defaultConfig, { IConfig } from './config-default';
import chalk from 'chalk';
import path from 'path';
import { IS_TEST } from './../utils/env-util';
import minimist from 'minimist';

export function getConfig(): IConfig {
  let userConfig: any = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // userConfig = require(path.resolve(__dirname, '../src/config/config-user.js'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    userConfig = require(path.resolve(process.cwd(), './.i18n-auto.js'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports, max-len
    // userConfig = require(path.resolve('/Users/miaoyicheng/WebstormProjects/ma3-frontend/packages/web/.i18n-auto.js'));
  } catch (error) {
    // 判断了 dev 环境才输出，不想跑测试脚本的时候一直有多余的console
    if (!IS_TEST) {
      console.error(error);
      console.log(chalk.red('未找到config-user.js文件'));
      throw new Error('未找到config-user.js文件');
    }
  }
  const result = {
    ...defaultConfig,
    ...userConfig,
  };

  const params = minimist(process.argv.slice(2));
  Object.keys(params)
    .filter((key) => key !== '_')
    .forEach((key) => {
      result.rainbow[key] =
        params[key] === 'undefined' ? undefined : params[key];
    });

  return result;
}
export default defaultConfig;
