/**
 * 第一版的处理逻辑
 * 基于正则表达式的处理方式
 * 现在还可以继续用在一些比较复杂的情况下做不怎么智能的提取替换
 */
import Helper from '../utils/helper';
import _ from 'lodash';
import throwError from '../../../utils/throw-error';
import AstHelper from './ast-helper';
import type { Record, ITextParams } from '../type';
import type { ITextClass } from '.';

class BaseText {
  isAttr = false;
  get zhCn(): string[] {
    return [];
  }

  props: ITextParams;
  isAttributeExpression: boolean;
  storeModule: string; // 有可能出现props 与 props.module 不同的情况

  constructor(props: ITextParams) {
    this.props = props;
    if (props.attrName) this.isAttr = true;
    this.isAttributeExpression = Helper.getIsExpressionType(props);
  }

  getData2Save() {
    const { zhCn } = this;
    if (!zhCn) return [];

    const zhCnList = Array.isArray(zhCn) ? zhCn : [zhCn];
    return zhCnList.map((zh) => this.getData2SaveItem(zh));
  }

  getId(str: string) {
    return Helper.getMd5Id(str);
  }

  getData2SaveItem(zh: string): Record {
    const id = this.getId(zh);
    const { storeModule } = this;
    const { module, originString } = this.props;
    return {
      id,
      zh,
      module: storeModule || module,
      origin: originString,
    };
  }

  extract() {
    return this.zhCn;
  }

  getStoreDataItem(id: string, module: string): { module: string } {
    const {
      props: { getData },
    } = this;
    const storeModuleItem = AstHelper.getStoreDataItem({ id, module }, getData);
    const { module: storeModule } = storeModuleItem;
    this.storeModule = storeModule;
    return storeModuleItem;
  }
}

/**
 * 单个普通文案
 */
class NormalText extends BaseText implements ITextClass {
  static verify(originString: string): boolean {
    return /[\u4e00-\u9fa5]+(.*?[\u4e00-\u9fa5])*/g.test(originString);
  }

  // 中文：{{ xxx }}
  // 匹配出非 {{ }} 中的其他文案
  // input: 你好: {{ xxx }} 中文
  // output: ['你好:', '中文']
  get zhCn() {
    const { originString } = this.props;
    if (this.isAttributeExpression) return [originString.slice(1, -1)];
    const list = originString
      .split(/{{.*?}}/)
      .map((i) => i.trim())
      .filter(Boolean);
    return list;
  }

  replace() {
    const { module, angularFilterName, originString } = this.props;
    const { zhCn, isAttributeExpression, isAttr } = this;

    let resultString = originString;
    zhCn.forEach((zhItem) => {
      const id = this.getId(zhItem);
      // 中文提示
      const zhHint = Helper.getZhCnForI18nHint(zhItem);
      let i18nKey = '';
      const quotation = Helper.getQuotation(originString, zhItem);
      let replaceItem: string | RegExp = zhItem;

      const { module: storeModule } = this.getStoreDataItem(id, module);

      if (isAttributeExpression && isAttr) {
        i18nKey = `("${storeModule}:${id}:${zhHint}" | ${angularFilterName})`;
        const regexpString = Helper.getSafelyStringRegExp(zhItem);
        const regexpV = `(['"])${regexpString}\\1`;
        replaceItem = new RegExp(regexpV, 'g');
      } else {
        i18nKey = `{{ "${storeModule}:${id}:${zhHint}" | ${angularFilterName} }}`;
      }

      i18nKey = Helper.replaceQuotation({
        quotation,
        oldQuotation: '"',
        str: i18nKey,
      });

      resultString = resultString.replace(replaceItem, i18nKey);
    });
    return resultString;
  }
}

/**
 * 表达式类型的字符串
 * 没有智能拆解，只能实现抽取中文字符串
 * 函数调用，过滤器，三元，两元表达式等
 */
class ExpressText extends BaseText implements ITextClass {
  // 这里不用断言了，不然匹配不出 ""和 ''
  // 匹配出 "" 或 '' 中间包含了中文的一整串
  static regexp = /(['"])[^"']*?[\u4e00-\u9fa5]+[^"']*?\1/g;
  static stringType = 'string' as const;
  static expressionType = 'expression' as const;

  static verifyIsExpress(str: string): boolean {
    // 函数调用
    const isCaller = /\w+\(.*?\)/.test(str);
    if (isCaller) return true;
    // 过滤器
    const isFilter = /[^'"]+\|[^'"]+/.test(str);
    if (isFilter) return true;
    // 三元
    const isConditional = /.+\?.+?:.+/.test(str);
    if (isConditional) return true;
    // == ===
    const isEqualOperation = /.+(==|===).+/.test(str);
    if (isEqualOperation) return true;
    return false;
  }

  static verify(originString: string, params: ITextParams): boolean {
    const isAttrExpress = Helper.getIsExpressionType(params);
    if (isAttrExpress) {
      return ExpressText.verifyIsExpress(originString);
    }
    // 改规则，只要有 {{}} 且内部有一些标志性的符号就可以算是表达式，比如 ?: 或 | 或 || 等等
    if (!originString.includes('{{')) return false;
    const expressionMatch = originString.match(/(?<=\{\{)(.*)(?=\}\})/gm);
    if (!expressionMatch.length) return false;
    return expressionMatch.some((item) => ExpressText.verifyIsExpress(item));
  }

  get zhCnWithType(): { string: string; type: 'string' | 'expression' }[] {
    const { isAttributeExpression } = this;
    const { originString } = this.props;

    // 表达式中的中文
    const expressionZhCn = originString.match(ExpressText.regexp) || [];
    let normalZh: string[] = [];
    if (!isAttributeExpression) {
      const normalText = new NormalText(_.cloneDeep(this.props));
      const extractText = normalText.extract();
      const extractList = Array.isArray(extractText)
        ? extractText
        : [extractText];
      normalZh = extractList.filter((d) => Helper.hasHans(d)) || [];
    }
    if (expressionZhCn.length || normalZh.length) {
      return [
        ...expressionZhCn.map((item) => ({
          string: item.slice(1, -1),
          type: ExpressText.expressionType,
        })),
        ...normalZh.map((item) => ({
          string: item,
          type: ExpressText.stringType,
        })),
      ];
    }
    return [
      {
        string: originString,
        type: 'string',
      },
    ];
  }

  get zhCn() {
    return this.zhCnWithType.map((item) => item.string);
  }

  replace() {
    const { zhCnWithType } = this;
    const { angularFilterName, originString, module } = this.props;
    let newStr = originString;

    zhCnWithType.forEach((item) => {
      const { string: zhCnItem, type } = item;
      const isString = type === 'string';
      const id = this.getId(zhCnItem);
      const { module: storeModule } = this.getStoreDataItem(id, module);
      const zhHint = Helper.getZhCnForI18nHint(zhCnItem);
      const zhCnItemStringRegexp = Helper.getSafelyStringRegExp(zhCnItem);
      const regexpValue = isString
        ? zhCnItemStringRegexp
        : `["']${zhCnItemStringRegexp}["']`;
      const quotation = Helper.getQuotation(originString, zhCnItemStringRegexp);
      const regexp = new RegExp(regexpValue);
      const i18nextExpression = `"${storeModule}:${id}:${zhHint}" | ${angularFilterName}`;
      const replaceString = isString
        ? `{{ ${i18nextExpression} }}`
        : `(${i18nextExpression})`;
      newStr = newStr.replace(regexp, replaceString);

      newStr = Helper.replaceQuotation({
        str: newStr,
        oldQuotation: '"',
        quotation,
      });
    });

    return newStr;
  }
}

/**
 * 含变量类型字符串
 */
class VariateText extends BaseText implements ITextClass {
  static variateRegexp = /(?<=\{\{\s*)([^{])*(?=\s*\}\})/g;

  static verify(originString: string, params: ITextParams): boolean {
    const isAttrExpress = Helper.getIsExpressionType(params);
    if (isAttrExpress && originString.includes('+')) {
      return true;
    }
    return /(\{\{[^|]+\}\})/g.test(originString);
  }

  keyMap = {};

  get zhCn() {
    const { originString } = this.props;
    const { isAttributeExpression } = this;
    let str = '';
    if (isAttributeExpression) {
      // input: "你好" + vm.count + "世界"
      // output: 你好{{vm@count}}世界
      str = Helper.variateString2ExpressionString(originString);
    } else {
      str = originString;
    }
    const variateList = this.getVariate(str);
    variateList.forEach((key, index) => {
      str = str.replace(key, `$${index}`);
    });
    return [str];
  }

  getVariate(str: string): string[] {
    const { isAttributeExpression } = this;
    if (isAttributeExpression) {
      const arr = str.match(VariateText.variateRegexp);

      if (!arr) {
        const { originString, tag, attrName } = this.props;
        throwError(`解析错误 ${originString}, ${tag}, ${attrName}`);
      }
      return arr.map((item) => Helper.translateKey2Variate(item));
    }
    return str.match(VariateText.variateRegexp);
  }

  replace() {
    const { originString, module, angularFilterName } = this.props;
    const { zhCn: zhCnList, isAttributeExpression } = this;
    const zhCn = zhCnList[0];
    const str = originString;

    const id = this.getId(zhCn);
    const { module: storeModule } = this.getStoreDataItem(id, module);
    const quotation = Helper.getQuotation(originString, zhCn);
    const zhHint = Helper.getZhCnForI18nHint(zhCn);
    let variateList = [];
    if (isAttributeExpression) {
      variateList = this.getVariate(Helper.variateString2ExpressionString(str));
    } else {
      variateList = this.getVariate(str);
    }

    // 拼变量
    let variateStr = '';
    if (variateList.length) {
      variateStr += ':{';
      for (let i = 0; i < variateList.length; i++) {
        const cur = variateList[i];
        const key = `$${i}`;
        variateStr += `"${cur}":${key}, `;
      }
      variateStr += '} ';
    }
    let i18nStr;
    if (isAttributeExpression) {
      i18nStr = `("${storeModule}:${id}:${zhHint}" | ${angularFilterName}${variateStr})`;
    } else {
      i18nStr = `{{ "${storeModule}:${id}:${zhHint}" | ${angularFilterName}${variateStr} }}`;
    }

    return Helper.replaceQuotation({
      str: i18nStr,
      oldQuotation: '"',
      quotation,
    });
  }
}

export function createOldTextClass(params: ITextParams): ITextClass | null {
  // 顺序强要求，严格 => 宽松
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const TextClass = [ExpressText, VariateText, NormalText].find((item) =>
    item.verify(params.originString, params)
  );
  if (TextClass) return new TextClass(params);
  return null;
}
