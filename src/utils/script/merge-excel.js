/**
 * 合并两个excel文件
 * 基本上后面不会用了，因为后面只会维护json数据，excel全json生成
 */

// 说明sheet直接取的最后一个替换
const xlsx = require('xlsx');
const fs = require('fs');

// 生成合并后的数据及表信息
function generateMergeData(workPath) {
  const excelArray = [];
  const sheetInfoList = [];
  workPath.forEach((path) => {
    const excelBuffer = fs.readFileSync(path);
    // 解析数据
    const workbook = xlsx.read(excelBuffer);
    const jsonData = {};

    // 维护一套sheet name
    workbook.SheetNames.forEach((name) => {
      const had = sheetInfoList.find((n) => n.name === name);
      if (!had) {
        sheetInfoList.push({
          name,
        });
      }
    });

    Object.entries(workbook.Sheets).forEach(([sheetName, sheetData]) => {
      jsonData[sheetName] = xlsx.utils.sheet_to_json(sheetData, {
        range: 0,
        blankrows: false,
      });
      const sheetInfo = sheetInfoList.find((i) => i.name === sheetName);
      sheetInfo.header = getHeaderRow(sheetData);
    });
    excelArray.push(jsonData);
  });

  const sheetData = {};
  for (let i = 0; i < excelArray.length; i++) {
    const sheetItem = excelArray[i];

    Object.entries(sheetItem).forEach(([moduleName, moduleData]) => {
      if (isDoc(null, moduleName)) {
        sheetData[moduleName] = moduleData;
      } else {
        sheetData[moduleName] = [
          ...(sheetData[moduleName] || []),
          ...moduleData,
        ];
      }
    });
  }

  Object.entries(sheetData).forEach(([key, values]) => {
    if (isDoc(values)) return;
    sheetData[key] = union(values, 'id');
  });

  return [sheetData, sheetInfoList];
}

// 获取表头
function getHeaderRow(sheet) {
  const headers = [];
  const range = xlsx.utils.decode_range(sheet['!ref']);
  let C;
  const R = range.s.r; /* start in the first row */
  /* walk every column in the range */
  for (C = range.s.c; C <= range.e.c; ++C) {
    const cell =
      sheet[
        xlsx.utils.encode_cell({ c: C, r: R })
      ]; /* find the cell in the first row */

    let hdr = `UNKNOWN ${C}`; // <-- replace with your desired default
    if (cell && cell.t) hdr = xlsx.utils.format_cell(cell);

    headers.push(hdr);
  }
  return headers;
}

// 按顺序替换式排重
function union(data, key) {
  const result = [];
  const indexMap = new Map();
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const item = data[i];
    const id = item[key];
    const shouldUpdate = indexMap.has(id);
    if (shouldUpdate) {
      const index = indexMap.get(id);
      result.splice(index, 1, item);
    } else {
      indexMap.set(id, result.length);
      result.push(item);
    }
  }
  return result;
}

// 判断是否是说明的sheet
function isDoc(sheetData, name) {
  return (Array.isArray(sheetData) && !sheetData[1].id) || name === '使用说明';
}

// 整合函数
function merge(workPath, outputPath) {
  const [sheetData, sheetInfoList] = generateMergeData(workPath);
  const workBook = xlsx.utils.book_new();
  // 并解析json为excel可以用的格式
  sheetInfoList.forEach(({ name }) => {
    const sheetItem = sheetData[name];
    const sheetItemData = xlsx.utils.json_to_sheet(sheetItem);
    xlsx.utils.book_append_sheet(workBook, sheetItemData, name);
  });
  xlsx.writeFile(workBook, outputPath);
}

const workPath = [
  '/Users/wei/project/temporary/excel-demo/pc-trans-list-0809.xlsx',
  '/Users/wei/project/temporary/excel-demo/pc-trans-list-0810.xlsx',
  '/Users/wei/project/temporary/excel-demo/pc-trans-list-0811.xlsx',
];

const outputPath =
  '/Users/wei/project/temporary/excel-demo/pc-trans-list-0812.xlsx';

merge(workPath, outputPath);

module.exports = merge;
