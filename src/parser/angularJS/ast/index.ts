import { createOldTextClass } from './legacyText';
import translateExpression2String from './translate-expression-to-string';
import VariateText from './variate-text';
import NormalText from './normal-text';
import ConditionalText from './conditional-text';
import type { ITextParams, Record } from '../type';

export interface ITextClass {
  getData2Save(): Record[];
  replace(): string;
  extract(): string[];
}

export function createAstText(params: ITextParams) {
  const { originString } = params;

  const stringCode = translateExpression2String(params);
  // eslint-disable-next-line no-param-reassign
  params.stringCode = stringCode;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const TextClass = [VariateText, ConditionalText, NormalText].find((c) =>
    c.verify(originString, params)
  );
  let instance = null;
  if (TextClass) {
    instance = new TextClass(params);
  }
  return instance;
}

export function createText(params: ITextParams) {
  let instance: ITextClass = createAstText(params);
  if (!instance) {
    instance = createOldTextClass(params);
  }
  return instance;
}
