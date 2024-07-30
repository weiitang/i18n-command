/*
 * @Description:
 * 原则: 只维护json
 * 同步xlsx到json要手动执行
 */

import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import glob from 'glob';
import importJSON from '../../utils/import-json';
import throwError from '../../utils/throw-error';
import { CELL } from '../../utils/constant';
import { redundantLogger } from '../log';
import { formatJSON } from '../../utils/script/utils';
import type {
  Record,
  RecordList,
  RecordListMap,
  RecordMap,
} from '../../types/type';

interface FileProps {
  i18nStoreDir: string;
  filePath: string;
  i18nDirName?: string;
  jsonPathMapping: {
    [module: string]: string;
  };
  rootPath: string;
  module: string;
  removeRedundant?: boolean;
}

const jsonPathMappingCache = new Map();
let rawCacheData: RecordMap = null; // { [id]: record }
let i18nDataCache: RecordListMap = null; // { [module]: [record, record]}

/**
 * i18nStoreDir: 存放i18n.json的文件夹位置
 * filePath: 用来确定生成的i18n.js应该放在哪里
 * jsonPathMapping: i18n.js 的 mapping
 * i18nDirName: i18n.js dirName
 * rootPath
 * module: 当前的模块
 * removeRedundant: 是否移除没有用到的词条
 * + setData
 * + generateFile 生成i18n.json, i18n.js, excel
 */
class File {
  static formatData(data: RecordList) {
    return [...data].reduce((pre, cur) => {
      const { id } = cur;
      // eslint-disable-next-line no-param-reassign
      pre[id] = {
        ...(pre[id] || {}),
        ...cur,
      };
      return pre;
    }, {} as RecordMap);
  }

  props: FileProps;
  // 当前module下的词条 { [id]: record }
  moduleData: RecordMap = {};
  // 所有词条 { [id]: record }
  allRawDataMap: RecordMap = {};
  // 所有module下的词条 { [module]: { [id]: record } }
  allModuleDataMap: RecordListMap = {};
  jsonPath = '';
  recorded = new Set<string>();

  constructor(props: FileProps) {
    this.props = props;
    this.init();
  }

  init() {
    this.loadRawData();
    this.loadModuleData();
    this.jsonPath = this.getJsonPath();
  }

  loadRawData() {
    const { i18nStoreDir } = this.props;
    if (!rawCacheData) {
      const data = i18nDataCache || (importJSON(i18nStoreDir) as RecordListMap);
      i18nDataCache = data;

      rawCacheData = File.formatData(Object.values(data).flat());
    }
    this.allRawDataMap = rawCacheData;
    this.allModuleDataMap = i18nDataCache;
  }

  loadModuleData() {
    const { module } = this.props;
    const moduleRawData = i18nDataCache[module] || [];
    this.moduleData = File.formatData(moduleRawData.flat());
  }

  // map > module > fileDir
  getJsonPath() {
    const { filePath, jsonPathMapping, module } = this.props;
    let { rootPath } = this.props;
    if (!rootPath) rootPath = process.cwd();
    let standby = filePath;
    // 取module
    const moduleIndex = filePath.lastIndexOf(module);
    if (moduleIndex !== -1) {
      standby = filePath.slice(0, moduleIndex + module.length);
    }

    if (_.isEmpty(jsonPathMapping)) return standby;
    let result;

    for (const key of Object.keys(jsonPathMapping)) {
      const mapReg = new RegExp(`${key}\\b`);
      if (!filePath.includes(key) || !mapReg.test(filePath)) continue;
      const outputPath = jsonPathMapping[key];
      if (jsonPathMappingCache.has(outputPath)) {
        [result] = jsonPathMappingCache.get(outputPath);
      } else {
        const fileArray =
          glob
            .sync(`${rootPath}/!(node_modules)/**/*${outputPath}`)
            .filter((item) => !item.includes('node_modules')) || [];
        jsonPathMappingCache.set(outputPath, fileArray);
        if (fileArray.length) [result] = fileArray;
      }
      if (result) break;
    }
    return result || standby;
  }

  record(id: string) {
    this.recorded.add(id);
  }

  // 添加词条
  setData(record: Partial<Record>) {
    const { id } = record;
    const { module } = this.props;
    if (!id) throwError('缺少id', record);
    const trans = _.pick(rawCacheData[id] || {}, [CELL.ORIGIN, CELL.NOTE]);
    const oldRecord = this.moduleData[id];
    const nextRecord = {
      ...trans,
      ...oldRecord,
      ...record,
      module,
    };
    this.moduleData[id] = nextRecord;
    this.record(id);
  }

  // 生成 module/_i18n/index.js
  // 生成i18n/[module].json
  // 更新cache
  generateFile() {
    const { module, i18nDirName, i18nStoreDir, removeRedundant } = this.props;
    const i18nConfig: any = {};
    const langs = [CELL.ZH, CELL.EN];

    // 模块中没有找到的id，一般是需求改动被删除的文案
    const redundantModuleData = []; // 冗余的词条
    const finalModuleData: RecordList = []; // 现在module中有的词条
    let allModuleData = []; // 所有词条，带有 isRedundant标识

    for (const id of Object.keys(this.moduleData)) {
      const record = this.moduleData[id];
      if (!this.recorded.has(id)) {
        record.isRedundant = true;
        redundantModuleData.push(record);
      } else {
        finalModuleData.push(record);
      }
      allModuleData.push(record);
    }

    langs.forEach((lang) => {
      i18nConfig[lang] = {};
      finalModuleData.forEach((record) => {
        const { id } = record;
        i18nConfig[lang][id] = record[lang];

        // 手动拼复数
        if (lang === CELL.EN && record[CELL.EN_PLURAL]) {
          i18nConfig[lang][`${id}_plural`] = record[CELL.EN_PLURAL];
        }
      });
    });

    const i18nIndexTemplate = `import i18next from 'i18next';
import config from './i18n.json';
const namespace = 'NAME_SPACE';

Object.keys(config).forEach((key) => {
  i18next.addResources(key, namespace, config[key]);
});
    
    `.replace(/NAME_SPACE/, module);

    const indexDir = `${this.jsonPath}/${i18nDirName}`;
    const i18nPath = path.resolve(indexDir, 'i18n.json');
    const indexPath = path.resolve(indexDir, 'index.js');
    const i18nDataPath = path.resolve(i18nStoreDir, `${module}.json`);
    fs.ensureDirSync(indexDir);

    fs.writeFileSync(i18nPath, JSON.stringify(i18nConfig, null, 2));
    fs.writeFileSync(indexPath, i18nIndexTemplate);

    // 需要移除冗余词条
    if (removeRedundant) {
      allModuleData = finalModuleData;
    }

    // 统一obj.key的顺序，见 I18N_STORE_KEYS，减少git diff干扰性
    const formatData = formatJSON(allModuleData);
    fs.ensureFileSync(i18nDataPath);
    fs.writeFileSync(i18nDataPath, JSON.stringify(formatData, null, 2));

    // 更新缓存
    i18nDataCache[module] = allModuleData;
    rawCacheData = {
      ...rawCacheData,
      ...this.moduleData,
    };

    // 处理被删除的词条
    this.appendData(redundantModuleData);
  }

  appendData(data: RecordList) {
    if (!data.length) return;
    const { rootPath, module, removeRedundant } = this.props;

    if (!removeRedundant) {
      redundantLogger.info(
        `模块${module}共有${data.length}条冗余词条，可以配置 config.removeRedundant 删除`
      );
      return;
    }

    const filePath = path.resolve(rootPath, 'ghost-i18n.json');
    fs.ensureFileSync(filePath);
    const oldStringData = fs.readFileSync(filePath).toString();
    const oldData = oldStringData ? JSON.parse(oldStringData) : {};
    const newData = _.uniqBy([...(oldData[module] || []), ...data], 'id');

    redundantLogger.info(
      `模块${module}共有${data.length}条词条被删除，请检查: ${filePath}`
    );

    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          ...oldData,
          [module]: newData,
        },
        null,
        2
      )
    );
  }

  getData() {
    return (id: string, module: string) => {
      if (this.moduleData[id]) {
        return this.moduleData[id];
      }
      let item = this.allRawDataMap[id];
      if (item.module !== module) {
        item = this.allModuleDataMap[module].find((i) => i.id === id);
      }
      if (!item || !item.zh) return null;
      return item;
    };
  }
}

export default File;
