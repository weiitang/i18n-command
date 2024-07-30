/*
 * 普通文案的情景
 */
import { BasicText } from './basic-text';
import AstHelper from './ast-helper';
import Helper from '../utils/helper';
import type { ITextClass } from '.';
import type { IClassExample } from './basic-text';
import type { ITextParams } from '../type';

export default class NormalText extends BasicText implements ITextClass {
  static example: IClassExample[] = [
    {
      expression: '文案',
      zh: ['文案'],
    },
    {
      expression: '文案。',
      zh: ['文案。'],
    },
  ];

  static wrongExample = [
    '文案{{vm.count}}',
    '文案 {{ vm.name ? "jsonz": "demo" }}',
  ];

  static verify(originString: string, params?: ITextParams) {
    let str = originString;
    // 如果是 LiteralPrimitive，先转换
    if (AstHelper.isLiteralPrimitive(originString)) {
      str = AstHelper.getLiteralPrimitiveValue(originString);
    }

    // 没中文，或者有 {{}}
    if (!Helper.hasHans(str) || str.includes('{{')) return false;

    try {
      const node = BasicText.parse(str, params);
      if (AstHelper.isText(node)) return true;
    } catch (e) {
      return false;
    }
    return false;
  }

  extract() {
    const { stringCode } = this;
    let zhCn = '';
    if (AstHelper.isLiteralPrimitive(stringCode)) {
      zhCn = AstHelper.getLiteralPrimitiveValue(stringCode);
    }

    zhCn = stringCode.trim();
    return [zhCn];
  }

  replace() {
    const { isExpression } = this;
    const zh = this.extract()[0];
    const i18nextExpression = this.getI18nExpression(zh);
    if (isExpression) {
      return `(${i18nextExpression})`;
    }
    return `{{ ${i18nextExpression} }}`;
  }
}
