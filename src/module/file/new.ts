import fs from 'fs-extra';
import { IKey, ICollectorOutput } from '../collector';
import { CELL } from '../../utils/constant';
import { getConfig } from '../../config/index';
import _ from 'lodash';

const config = getConfig();

class File {
  static generateI18nConfig(result: ICollectorOutput) {
    Object.keys(result).forEach((module) => {
      const i18nConfig: any = {
        namespace: module,
        langs: {},
      };
      const langs = [CELL.ZH, CELL.EN];
      const filterKey = [
        IKey.KEY_ADD,
        IKey.NO_CHANGE,
        IKey.KEY_UPDATE,
        IKey.NO_MATCH,
      ];
      // 是否移除冗余
      if (!config.removeRedundant) {
        filterKey.push(IKey.KEY_DELETE);
      }
      const mergeWords = _.uniqBy(
        filterKey.reduce(
          (prev, cur: string) => [...prev, ...(result[module][cur] || [])],
          []
        ),
        'id'
      );
      // 去重 排序
      const moduleAllWords = _.sortBy(
        _.filter(mergeWords, (item) =>
          config.outputOnlyUsed ? item.isRecord : true
        ),
        ['id']
      );
      langs.forEach((lang) => {
        if (_.isEmpty(i18nConfig.langs[lang])) {
          i18nConfig.langs[lang] = {};
        }
        moduleAllWords.forEach((record) => {
          const { id } = record;
          i18nConfig.langs[lang][id] = record[lang];

          // 手动拼复数
          if (lang === CELL.EN && record[CELL.EN_PLURAL]) {
            i18nConfig.langs[lang][`${id}_plural`] = record[CELL.EN_PLURAL];
          }
          if (lang === CELL.ZH && record[CELL.ZH_PLURAL]) {
            i18nConfig.langs[lang][`${id}_plural`] = record[CELL.ZH_PLURAL];
          }
        });
      });
      fs.ensureDirSync(config.i18nConfigPath);
      // 输出i18n配置
      if (!_.isEmpty(i18nConfig.langs[CELL.ZH])) {
        let outputPath = `${config.i18nConfigPath}/${module}.json`;
        if (typeof config.i18nConfigOutputPath === 'function') {
          outputPath = config.i18nConfigOutputPath(module);
        }
        fs.ensureFileSync(outputPath);
        fs.writeFileSync(outputPath, JSON.stringify(i18nConfig, null, 2));
      }
    });
  }
  static generateI18nStore(result: ICollectorOutput) {
    Object.keys(result).forEach((module) => {
      const filterKey = [
        IKey.KEY_ADD,
        IKey.NO_CHANGE,
        IKey.KEY_UPDATE,
        IKey.NO_MATCH,
      ];
      // 是否移除冗余
      if (!config.removeRedundant) {
        filterKey.push(IKey.KEY_DELETE);
      }
      // 去重 排序
      const mergeWords = _.uniqBy(
        filterKey.reduce(
          (prev, cur: string) => [...prev, ...(result[module][cur] || [])],
          []
        ),
        'id'
      );

      const moduleAllWords = _.sortBy(
        _.filter(mergeWords, (item) =>
          config.outputOnlyUsed ? item.isRecord : true
        ),
        ['id']
      );

      fs.ensureDirSync(config.i18nStorePath);
      // 输出词条存档
      if (!_.isEmpty(moduleAllWords)) {
        let outputPath = `${config.i18nStorePath}/${module}.json`;
        if (typeof config.i18nStoreOutputPath === 'function') {
          outputPath = config.i18nStoreOutputPath(module);
        }
        fs.ensureFileSync(outputPath);
        fs.writeFileSync(outputPath, JSON.stringify(moduleAllWords, null, 2));
      }
    });
  }
}
export default File;
