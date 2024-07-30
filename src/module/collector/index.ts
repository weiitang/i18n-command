/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
// 词条收集器
import globby from 'globby';
import { getConfig } from '../../config/index';
import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import md5 from 'md5';
import { logger } from '../../module/log';
import Rainbow, { getCurrentVersion, setCurrentVersion } from '../rainbow';
import { getMd5Id } from '../../utils/index';

const config = getConfig();

enum initType {
  json = 'json',
  rainbow = 'rainbow',
}

export const IKey = {
  NO_CHANGE: 'NO_CHANGE', // 未更改
  KEY_ADD: 'KEY_ADD', // 新增
  KEY_DELETE: 'KEY_DELETE', // 冗余
  KEY_UPDATE: 'KEY_UPDATE', // 更新
  NO_MATCH: 'NO_MATCH', // id和zh不匹配
};
export interface ICollectorOutput {
  [key: string]: {
    [key: string]: ICollectorItem[];
  };
}

export type ICollectorItem = {
  _auto_id?: string;
  id: string;
  module: string;
  zh?: string;
  zh_plural?: string;
  en?: string;
  en_plural?: string;
  note?: string;
  status?: string;
  newId?: string;
  isChanged?: boolean;
};

class Collector {
  collectors: {
    [namespace: string]: Map<string, CollectorItem>;
  };
  error: any[];
  modules: Set<string>;
  allWordsById: Map<string, ICollectorItem>;
  allWordsByIdAndModule: Map<string, ICollectorItem>;
  migrations: any;
  rainbow: any;

  constructor() {
    // 词条收集，最后输出的词条集合
    this.collectors = {};
    // id为key的全部词条的池子 用于新词条填充翻译
    this.allWordsById = new Map();
    // id+module为key的全部词条的池子 用于新词条填充翻译
    this.allWordsByIdAndModule = new Map();
    // 异常词条
    this.error = [];
    // 需要处理的模块
    this.modules = new Set();
    // 需迁移的词条
    this.migrations = {};
  }
  _setWord(_collector: ICollectorItem) {
    const { id, module } = _collector;
    this.allWordsById.set(id, _collector);
    this.allWordsByIdAndModule.set(`${id}_${module}`, _collector);
  }
  _getWord(id: string, module?: string) {
    if (module) {
      const idAndModuleResult = this.allWordsByIdAndModule.get(
        `${id}_${module}`
      );
      if (idAndModuleResult) {
        return idAndModuleResult;
      }
    }
    const idResult = this.allWordsById.get(id);
    if (idResult) {
      return {
        id,
        module,
        zh: idResult?.zh,
        zh_plural: idResult?.zh_plural || '',
        en: idResult?.en,
        en_plural: idResult?.en_plural || '',
        note: idResult?.note,
      };
    }
    return null;
  }
  async init(type: string, collectModule?: string[]) {
    this.modules = new Set(collectModule);
    if (type === initType.rainbow) {
      this.rainbow = Rainbow.getInstance();
    }
    // 读取数据源获取词条
    await this.initI18nStore(type);

    // 读取现有i18n配置，判断已有词条状态
    await this.initI18nConfig(type);

    // 需迁移词条方法执行
    await this.initMigrations();

    logger.info('词条初始化完成');
  }
  async initI18nStore(type: string) {
    if (type === initType.rainbow) {
      // 通过石头获取词条
      const allDatas = await this.rainbow.queryAllDatas();
      allDatas.forEach((data: any) => {
        const item = new CollectorItem(data);
        this._setWord(item.data);
        if (!this.collectors[data.module]) {
          this.collectors[data.module] = new Map();
        }
        this.collectors[data.module].set(data.id, item);
      });
    } else if (type === initType.json) {
      // 通过读取本地json文件获取词条
      const files = globby.sync(`${config.i18nStorePath}/*.json`, {
        ignore: ['**/index.js'],
        absolute: true,
      });
      for (const filePath of files) {
        const { name } = path.parse(filePath);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const data: [string, CollectorItem][] = content.map(
          (item: ICollectorItem) => {
            const newItem = new CollectorItem(item);
            this._setWord(newItem.data);
            return [item.id, newItem];
          }
        );
        this.collectors[name] = new Map(data);
      }
    }
  }
  async initI18nConfig(type: string) {
    const configFiles = globby.sync(`${config.i18nConfigPath}/**/*.json`, {
      ignore: ['**/index.js'],
      absolute: true,
    });

    let rainbowVersion = '';
    const configVersion = getCurrentVersion();

    if (type === initType.rainbow) {
      const groupInfo = await this.rainbow.queryGroupInfo();
      rainbowVersion = groupInfo.version_info.version_name;
      // 更新version到和蓝盾同一个版本
      setCurrentVersion(rainbowVersion);
    }

    for (const filePath of configFiles) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result: any = {};

      Object.keys(content.langs).forEach((rawLangKey) => {
        Object.keys(content.langs[rawLangKey]).forEach((rawKey) => {
          const key = rawKey.replace('_plural', '');
          const langKey = rawKey.includes('_plural')
            ? `${rawLangKey}_plural`
            : rawLangKey;
          if (!result[key]) {
            result[key] = {
              module: content.namespace,
              id: key,
              [langKey]: content.langs[rawLangKey][rawKey],
            };
          } else {
            result[key][langKey] = content.langs[rawLangKey][rawKey];
          }
        });
      });
      if (!self.collectors[content.namespace]) {
        self.collectors[content.namespace] = new Map();
      }

      Object.keys(result).forEach((key) => {
        const getWordResult = self._getWord(key, content.namespace);
        // 合并store中和config配置中的数据，优先使用config配置的内容
        let data = { ...(getWordResult || {}), ...result[key] };
        // 判断数据源版本
        // 如果是石头，版本不匹配说明石头有更新优先使用石头；版本匹配优先使用本地数据
        // 如果是json数据源则词条都是同步更新，优先使用config中的数据
        if (type === initType.rainbow) {
          if (configVersion !== rainbowVersion) {
            data = getWordResult;
          }
        }
        if (type === initType.json && config.i18nStoreFirst) {
          const idAndModuleResult = self.allWordsByIdAndModule.get(
            `${key}_${content.namespace}`
          );
          if (idAndModuleResult) {
            data = getWordResult;
          }
        }
        if (!data) {
          logger.info(
            `没有在store中找到key:${key}的词条，使用config的配置${result[key]}`
          );
          data = result[key];
        }
        const item = new CollectorItem(data);
        self.collectors[content.namespace].set(result[key].id, item);
        self._setWord(item.data);
      });
    }
  }
  async initMigrations() {
    if (_.isFunction(config.migrateFunc)) {
      const migrations = await config.migrateFunc();
      if (!_.isEmpty(migrations)) {
        this.migrations = migrations;
      }
    }
  }
  add(namespace: string, item: ICollectorItem) {
    const { id } = item;
    const getWord = this._getWord(id, namespace);
    const result = {
      ...item,
      zh: item?.zh || getWord?.zh || '',
      zh_plural: item?.zh_plural || getWord?.zh_plural || '',
      en: item?.en || getWord?.en || item?.zh || getWord?.zh || '',
      en_plural: item?.en_plural || getWord?.en_plural || '',
    };
    if (this.collectors[namespace]) {
      if (this.collectors[namespace].has(id)) {
        this.collectors[namespace].get(id)?.update(result);
      } else {
        this.collectors[namespace].set(
          id,
          new CollectorItem(result, IKey.KEY_ADD)
        );
      }
    } else {
      this.collectors[namespace] = new Map([
        [id, new CollectorItem(result, IKey.KEY_ADD)],
      ]);
    }
    // 记录词条
    this._setWord(result);
    // 记录操作过的模块
    this.modules.add(namespace);
  }
  // 标记词条为已有状态
  record(namespace: string, id: string, item?: ICollectorItem) {
    if (!this.collectors[namespace] || !this.collectors[namespace].has(id)) {
      this.error.push({ ...item, namespace });
      return;
    }
    this.collectors[namespace].get(id)?.record();
    // 记录操作过的模块
    this.modules.add(namespace);
  }
  // 获取module下id对应信息
  get(id: string, namespace?: string) {
    if (!namespace) {
      return this._getWord(id);
    }
    const result =
      this.collectors?.[namespace]?.get(id)?.data ||
      this._getWord(id, namespace);

    let tmp = null;
    // 初始化modules为目前转换涉及的模块，如果module和namespace不一致 且module在本次转换涉及的模块内，则在该namespace下添加该id
    if (result && result.module !== namespace && this.modules.has(namespace)) {
      tmp = new CollectorItem({
        ...result,
        module: namespace,
        id,
      });
    }
    // 在需要迁移的词条库中寻找
    if (this.migrations[`${namespace}:${id}`]) {
      tmp = new CollectorItem(this.migrations[`${namespace}:${id}`]);
    }
    if (tmp) {
      this.add(tmp.data.module, { ...tmp.data });
      return {
        ...tmp.data,
        status: tmp.status,
      };
    }
    return result
      ? {
          ...result,
          status: this.collectors?.[namespace]?.get(id)?.status,
        }
      : null;
  }
  // 输出每个类型的词条 add update init delete
  output() {
    const result: ICollectorOutput = {};
    Object.keys(this.collectors)
      // 只输出遍历过的模块
      .filter((item) => this.modules.has(item))
      .forEach((namespace) => {
        this.collectors[namespace].forEach((value: CollectorItem) => {
          const { status } = value;
          result[namespace] = result[namespace] || {};
          result[namespace][status] = result[namespace][status] || [];
          const collecterItem = {
            ...value.data,
            status,
            // 如果词条没有变化过不需要提交到石头
            isChanged: value.isChanged,
            isRecord: value.isRecord,
          };
          // 如果不匹配就把id换成新的id输出
          if (status === IKey.NO_MATCH && value.data?.newId) {
            collecterItem.id = value.data?.newId;
          }
          // 如果没有记录过就标记冗余
          if (!value.isRecord && status === IKey.NO_CHANGE) {
            collecterItem.status = IKey.KEY_DELETE;
          }
          result[namespace][status].push(collecterItem);
        });
      });
    Object.keys(result).forEach((namespace) => {
      Object.keys(result[namespace]).forEach((status) => {
        // 去重
        result[namespace][status] = _.uniqBy(result[namespace][status], 'id');
      });
    });
    return result;
  }
}
class CollectorItem {
  data: ICollectorItem;
  rawData: ICollectorItem;
  status: string;
  // 标记词条有没有被更改过 没有auto_id认为是新加入词条，更改过
  isChanged: boolean;
  // 标记词条有没有被使用过
  isRecord: boolean;
  constructor(props: ICollectorItem, status?: string) {
    // 填充缺失的props
    const tmpProps = {
      _auto_id: props._auto_id,
      module: props.module,
      id: `${props.id}`,
      zh: props.zh,
      zh_plural: props.zh_plural || '',
      en: props.en || props.zh, // 缺少英文暂时使用中文
      en_plural: props.en_plural || '',
      note: props.note,
      status: props.status,
      newId: '',
    };
    let newStatus = status || IKey.NO_CHANGE;
    let isChanged = !tmpProps._auto_id;

    // 首先判断是否有中文
    if (!tmpProps.zh) {
      tmpProps.zh = tmpProps.en;
      logger.info(
        `词条缺少中文：${tmpProps.module}:${tmpProps.id}，已补充中文：${tmpProps.zh}`
      );
      isChanged = true;
    }
    // 判断是否缺id 缺少id则自动生成
    const id = getMd5Id(tmpProps.zh);
    if (!tmpProps.id) {
      tmpProps.id = id;
      logger.info(
        `词条缺少id：${tmpProps.module}:${tmpProps.zh}, 已补充id：${id}`
      );
      isChanged = true;
    }
    if (tmpProps.id && tmpProps.zh && `${tmpProps.id}` !== id) {
      logger.info(
        `词条id不匹配：${tmpProps.module}:${tmpProps.zh}, 已更新${tmpProps.id}->${id}`
      );
      logger.info(`词条id不匹配：${tmpProps.zh}`);
      tmpProps.newId = id;
      newStatus = IKey.NO_MATCH;
      isChanged = true;
    }

    this.rawData = props;
    this.data = tmpProps;
    this.status = newStatus;
    this.isChanged = isChanged;
    // add需要记录词条
    this.isRecord = newStatus === IKey.KEY_ADD;
  }
  update(item?: ICollectorItem) {
    this.data = {
      ...this.data,
      ...item,
    };
    if (item.zh) {
      // 判断更新前后id和汉字md5是否一致，不一致更改md5
      const id = getMd5Id(item.zh);
      if (id !== this.data.id) {
        this.data.id = id;
      }
    }
    this.status = IKey.KEY_UPDATE;
    this.isChanged = true;
    this.isRecord = true;
  }
  record() {
    if (this.status !== this.rawData.status) {
      this.isChanged = true;
    }
    this.isRecord = true;
  }
}

export default new Collector();
