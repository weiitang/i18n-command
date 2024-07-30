import type { AngularJSParserOptions, Record } from './../type';

export * from './i18next2';
export * from './legacy';

export interface IPluginParams {
  code: string;
  originCode: string;
  attrName?: string;
  tag: string;
  props: AngularJSParserOptions;
  type: 'text' | 'attr';
}

export interface IPluginResult {
  newStringCode: string;
  dicts: Record[];
}

export type IPlugin = (
  params: IPluginParams,
  prev: IPluginResult
) => IPluginResult;
