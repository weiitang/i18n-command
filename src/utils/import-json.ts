/*
 * @Description:
 * 1. 读取一个dir下所有的json文件
 * 2. 格式加载一个obj
 */
import glob from 'glob';
import path from 'path';
import type { RecordListMap } from '../types/type';

function importI18nData(jsonDir: string) {
  let dir = jsonDir;
  if (!path.isAbsolute(jsonDir)) {
    dir = path.resolve(process.cwd(), dir);
  }

  const jsonFiles = glob.sync(`${dir}/**/*.json`);
  const i18nData: RecordListMap = {};
  jsonFiles?.forEach((file) => {
    const key = path.parse(file).name;
    // eslint-disable-next-line
    i18nData[key] = require(file);
  });
  return i18nData;
}

export default importI18nData;
