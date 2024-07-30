import path from 'path';
import { DATASOURCE_TYPE } from '../utils/constant';
import { IPathItem } from '../utils';

export interface IConfig {
  entryFile?: string;
  rootPath: string;
  includePath: string[];
  excludePath: string[];
  fileType: string[];
  autoCompleteImport?: boolean;
  i18nStorePath: string;
  i18nStoreOutputPath?: (filename: string) => string;
  i18nStoreFirst?: boolean;
  outputOnlyUsed?: boolean;
  i18nConfigPath: string;
  i18nConfigOutputPath?: (filename: string) => string;
  tsConfigPath?: string;
  angularFilterName: string;
  i18nDataSource?: string;
  i18nObject: string;
  i18nMethod: string;
  i18nObjectPath: string;
  excludeFunc: string[];
  separator: string;
  transformOldI18nWord?: string;
  getModuleName?: (str: string) => string;
  extraOutput?: (allPath: IPathItem[]) => void;
  migrateFunc?: () => Promise<any>;
  removeRedundant: boolean;
  logDir: string;
  prettierOptions: any;
  rainbow: {
    config?: any;
    appID?: string;
    userID?: string;
    secretKey?: string;
    signMethod?: string;
    tableId?: number;
    groupId?: number;
    group?: string;
    creator?: string;
    envName?: string;
  };
}

const defaultConfig: IConfig = {
  // 项目的入口文件，如果配置 可以根据入口文件 分析依赖 只解析依赖中includePath包含的文件
  entryFile: '',
  // 项目目录 @由项目配置提供
  rootPath: path.resolve('./../../../'),
  // 需要遍历的目录，rootPath的相对路径，minimatch语法： https://github.com/isaacs/minimatch#usage
  includePath: [],
  // 转换排除的路径 https://github.com/isaacs/minimatch#usage
  excludePath: [],
  // 需要转换文件的类型, 类型续满足fileType要求，如果在includePath中已定义文件格式，这里可为空
  fileType: ['.js', '.jsx', '.ts', '.tsx', '.html'],
  // 获取模块名方法，也就是i18n中namespace的值，入参为filepath，默认为filepath的basename
  getModuleName: (path: string): string => {
    console.log(defaultConfig.rootPath);
    const moduleName = path
      .replace(defaultConfig.rootPath, '')
      .split('/')
      .filter(Boolean)[0];
    return moduleName;
  },
  // 读取现有i18n配置自定义方法，便于迁移词条时寻找到老词条，接收一个object {[module-id]: {zh, en, module,zh_plarul, en_plarul}}
  migrateFunc: () => Promise.resolve(null),
  // 配置的数据源 json / rainbow
  // 如果是json需指定i18nStorePath，如果是rainbow需指定rainbowConfig
  i18nDataSource: DATASOURCE_TYPE.JSON,
  // i18n-store目录 @由项目配置提供
  i18nStorePath: path.resolve(__dirname, '../example/i18n-store'),
  // 输出i18n-store文件时重命名
  i18nStoreOutputPath: null,
  // 优先使用i18nstore中的词条配置，用于批量词条导入时需要该功能
  i18nStoreFirst: false,
  // 只输出国际化脚本覆盖到的词条
  outputOnlyUsed: false,
  // 石头配置
  rainbow: {
    config: {}, // 石头初始化配置
    signMethod: 'sha1',
  },
  // i18n-store目录 @由项目配置提供
  i18nConfigPath: path.resolve(__dirname, '../example/i18n-config'),
  // 输出i18n-config文件时重命名
  i18nConfigOutputPath: null,
  // tscogfig配置文件的path，在entryfile依赖分析时需要
  tsConfigPath: '',
  // angular 模板i18n过滤器名字
  angularFilterName: 'i18next2',
  // i18n组件的名字
  i18nObject: 'I18n',
  // i18n 调用方法
  i18nMethod: 't',
  // 引用i18n组件的引入目录
  // TODO 目前不能根据当前路径替换为相对路径，只能是alias写法
  i18nObjectPath: '@pc/components',
  // 不需要转换的方法名，比如console.log内的文字就不需要国际化
  excludeFunc: [
    'dayjs.format',
    'i18n.t2',
    'i18n.t',
    'history.push',
    'console.log',
    '$i18next.t',
    '$i18next.t2',
    'date.format',
    'moment.format',
  ],
  // 提取 原有i18n配置 需要提取的方法名
  transformOldI18nWord: null,
  // 分隔符 转换后i18n key与中文的分割符 如 module:key:中文
  separator: ':',
  // 检查是否引入国际化i18nObject 并自动补充
  autoCompleteImport: false,
  // 是否清除冗余数据
  removeRedundant: false,
  // prettier 配置，主要 pc和app的html缩进类型不一样，app一直用空格，pc一直用tab
  prettierOptions: {},
  // 存放log文件的目录
  logDir: path.resolve(__dirname, '../logs'),
  // 输出文件时额外要输出的内容
  extraOutput: () => {},
};

export default defaultConfig;
