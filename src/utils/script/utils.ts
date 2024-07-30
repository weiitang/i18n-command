import path from 'path';
import fs from 'fs-extra';
import { I18N_STORE_KEYS } from '../constant';

import type { RecordList } from '../../types/type';

// id相同则 newData 覆盖 oldData
export function merge(oldData: RecordList, newData: RecordList) {
  const idMap = new Map();
  const finalData: RecordList = [];
  oldData.forEach((item, index) => {
    const { id } = item;
    idMap.set(id, index);
    finalData.push(item);
  });
  newData.forEach((item) => {
    const { id } = item;
    const index = idMap.get(id);
    if (index !== undefined) {
      finalData[index] = Object.assign(oldData[index], item);
    } else {
      finalData.push(item);
    }
  });
  return finalData;
}

/**
 * mergeType:
 * - excel: excel 覆盖json
 * - json: json 覆盖excel
 */
export function createJSON({
  data,
  module,
  outputPath,
  mergeType,
}: {
  data: RecordList;
  module: string;
  outputPath: string;
  mergeType: 'excel' | 'json';
}) {
  let dir = outputPath;
  if (!path.isAbsolute(dir)) {
    dir = path.resolve(process.cwd(), outputPath);
  }

  const filePath = path.resolve(outputPath, `${module}.json`);
  let finalData = data;
  if (fs.pathExistsSync(filePath)) {
    const oldData = fs.readJsonSync(filePath);
    if (mergeType === 'excel') finalData = merge(oldData, data);
    else finalData = merge(data, oldData);
  } else {
    fs.ensureFileSync(filePath);
  }
  // 只提取对应的字段
  finalData = formatJSON(finalData);
  fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
}

// 排除json干扰性
export function formatJSON(data: RecordList) {
  return data.map((item: any) => {
    const obj: any = {};
    I18N_STORE_KEYS.forEach((key) => {
      const value = item[key];
      // 去除 && value !== ''，因为确实有一些可能中文有意思，英文不需要翻译出来
      if (typeof value !== 'undefined') obj[key] = item[key];
    });
    return obj;
  });
}
