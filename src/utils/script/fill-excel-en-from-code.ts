// @Description: 提取pc端原有的i18n，然后判断excel中有没有，有的话，写进去
import path from 'path';
import xlsx from 'xlsx';
import fs from 'fs-extra';
import glob from 'glob';
import requireEsm from 'esm';
import { DEFAULT_HEADER } from '../constant';

const requireEs = requireEsm(module);
const pcI18nPath = '/Users/jsonz/work/@tim/tim-web/src/pc/src/i18n';
const zhCnPattern = path.resolve(pcI18nPath, './zh-cn/**/*.js');
const enPattern = path.resolve(pcI18nPath, './en/**/*.js');
const excelPath = '/Users/jsonz/work/@timkit/i18n-auto/src/pc-trans-list.xlsx';

const zhMap: I18nMap = {};
const enMap: I18nMap = {};
interface I18nMap {
  [key: string]: string;
}

glob.sync(zhCnPattern).forEach((file) => {
  const itemFile = requireEs(file).default;
  Object.assign(zhMap, itemFile);
});
glob.sync(enPattern).forEach((file) => {
  const itemFile = requireEs(file).default;
  Object.assign(enMap, itemFile);
});

// { 你好: 'hello' }
const zhMapEn: I18nMap = {};
Object.entries(zhMap).forEach(([key, zh]: [string, string]) => {
  if (enMap[key]) {
    zhMapEn[zh] = enMap[key];
  }
});

const excel = fs.readFileSync(excelPath);
const workbook = xlsx.read(excel);

const checked = [];

Object.entries(workbook.Sheets).forEach(([key, value]) => {
  if (key === '使用说明') return;
  const sheetData = xlsx.utils.sheet_to_json(value) as any;
  sheetData.forEach((item: any) => {
    if (item.zh && zhMapEn[item.zh] && !item.en) {
      // eslint-disable-next-line no-param-reassign
      item.en = zhMapEn[item.zh];
      checked.push(item);
    }
  });

  xlsx.utils.sheet_add_json(workbook.Sheets[key], sheetData, {
    // @TODO 取消类型的readonly
    header: DEFAULT_HEADER as any,
  });
});

console.log(`处理成功, 总共处理了: ${checked.length} 条`);

xlsx.writeFile(workbook, excelPath);
