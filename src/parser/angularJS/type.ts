import type { Record } from '../../types/type';
export type { Record } from '../../types/type';

export type ITextParams = Pick<
  AngularJSParserOptions,
  | 'createRecord'
  | 'getData'
  | 'getLegacyI18nData'
  | 'module'
  | 'angularFilterName'
> & {
  originString: string;
  attrName?: string;
  tag?: string;
  stringCode?: string;
  isExpression?: boolean;
};

export type StringType =
  | StringTypeExpression
  | StringTypeMixin
  | StringTypeString;
export type StringTypeExpression = 'expression';
export type StringTypeMixin = 'string';
export type StringTypeString = 'mixin';

export interface AngularJSParserOptions {
  // 是否需要替换，主要为单个文件的时候重新写入文件
  shouldReplace?: boolean;
  // html模板路径
  filePath?: string;
  // html 字符串
  html?: string;
  // 单个文件或单段文案解析完成后的回调，只会调用一次
  callback?: (dicts: Record[], newHTML: string) => void;
  // 模块名
  module: string;
  // angular filter 标识
  angularFilterName: string;
  // 输出时是否需要prettier格式化
  shouldPrettier?: boolean;
  // prettier 配置
  prettierOptions?: any;
  // 记录函数
  record?: (id: string) => void;
  // 获取记录，主要为了确定是否需要更新
  getData: GetData;
  // 获取旧版i18next写法的多语言数据
  getLegacyI18nData?: GetLegacyI18nData;
  // 新增一个能力，手动新建一条词条
  // 旧的i18next转为新的i18next2,此时词库里面只有一条旧数据，会导致后面想取新的md5值，取不到这条id
  createRecord: (item: Record) => void;
}

// 把获取数据的逻辑抽离成getData，可能一些多语言是在别的模块上才有的
export type GetData = (id: string, module: string) => Record;

// 根据 namespace 和 key 获取旧的多语言数据
export type GetLegacyI18nData = (params: {
  namespace: string;
  i18nKey: string;
}) => Record;
