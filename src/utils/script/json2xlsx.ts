/*
 * @Description:
 * 根据jsonDir下的所有json文件，生成xlsx文件
 * 每个json文件对应一个sheet，如果原来已经有excel，也会直接覆盖
 * 前端只会维护json文件，不会维护xlsx文件，xlsx只会生成后发给供应商翻译
 */
import xlsx from 'xlsx';
import importI18nData from '../import-json';
import { DEFAULT_HEADER } from '../constant';

function translate(
  xlsxPath: string,
  i18nDir: string,
  {
    filter,
  }: {
    filter?: (item: any) => boolean;
  } = {}
) {
  const i18nData = importI18nData(i18nDir);
  if (filter) {
    Object.entries(i18nData).forEach(([key, values]) => {
      i18nData[key] = values.filter(filter);
    });
  }
  const wb = xlsx.utils.book_new();
  Object.entries(i18nData).forEach(([sheetName, sheetValue]) => {
    if (sheetValue.length === 0) return;
    const ws = xlsx.utils.json_to_sheet(sheetValue, {
      header: DEFAULT_HEADER as any,
    });
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
  });

  xlsx.writeFile(wb, xlsxPath);
}

export default translate;
