/*
 * @Description:
 * 把一个xlsx文件转化为 json，一个Sheet转为一个json
 * 如果原先存在该json，会合并原来的
 */
import xlsx from 'xlsx';
import { createJSON } from './utils';
import type { RecordList } from '../../types/type';
const docSheetName = '使用说明';

function translate(
  xlsxPath: string,
  outputDir: string,
  {
    mergeType,
  }: {
    mergeType: 'excel' | 'json';
  } = { mergeType: 'excel' }
) {
  const book = xlsx.readFile(xlsxPath);
  Object.entries(book.Sheets).forEach(([sheetName, sheetData]) => {
    if (sheetName === docSheetName) return;
    const jsonData = xlsx.utils.sheet_to_json(sheetData) as RecordList;
    createJSON({
      data: jsonData,
      module: sheetName,
      outputPath: outputDir,
      mergeType,
    });
  });
}
export default translate;
