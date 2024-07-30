import md5 from 'md5';
import escapeStringRegexp from 'escape-string-regexp';
import type { StringType } from '../type';

const ignoreAttrs = ['ng-if'];

// 生成md5
function getMd5Id(str: string, len = 8) {
  return md5(str).slice(0, len);
}

// 是否包含汉字 "你好"
function hasHans(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

// 获取引号内的中文
function getHansString(str: string) {
  // 匹配引号内的中文 `'你"好`  `"你'好"` `'你好'`
  return str.match(
    /("[^"]*?[\u4e00-\u9fa5]+[^"]*?")|('[^']*?[\u4e00-\u9fa5]+[^']*?')/g
  );
}

// 是否含有引号内的字符： "'common'"
function hasQuoteString(str: string): boolean {
  return /(["']).+?\1/.test(str);
}

// 是否是html注释
function isHtmlComment(str: string): boolean {
  return /^\s*<!--/.test(str);
}

// 是否是i18n的表达式
function isI18n(
  str: string,
  i18nextExpression: string[] = ['i18next']
): boolean {
  const i18nextExpressions = Array.isArray(i18nextExpression)
    ? i18nextExpression
    : [i18nextExpression];
  return i18nextExpressions.some((regexpValue) =>
    new RegExp(regexpValue).test(str)
  );
}

// 是否是需要忽略的属性
function isIgnoreAttr(attrName?: string): boolean {
  // text node 情况
  if (attrName === null || attrName === undefined) return false;
  return ignoreAttrs.includes(attrName);
}

export interface IStringTypeParams {
  tag?: string;
  attrName?: string;
  originString: string;
}

/**
 * 获取放在i18n模版的中文，需要做一些处理，比如 '" 的转换
 * 比如 {{ }} => []
 * 你好'{{jsonz}} => 你好[jsonz]
 * @param params
 * @returns
 */
function getZhCnForI18nHint(zhCn: string) {
  // 汉字提示里的引号，直接去掉
  // eslint-disable-next-line no-useless-escape
  return zhCn
    .replace(/(["'])/g, '')
    .replace(/\{\{/g, '[')
    .replace(/\}\}/g, ']');
}

function isQuotation(str: string): str is IQuotation {
  return str === "'" || str === '"';
}

/**
 * 获取当前字段在原文本中被包裹的引号，替换后需要保持一致
 * 不然会出现多个双引号等语法错误
 * @param params
 * @returns
 */
type IQuotation = "'" | '"';

function getQuotation(originString: string, targetString: string): IQuotation {
  const regexp = new RegExp(`(['"])${getSafelyStringRegExp(targetString)}`);
  const m = originString.match(regexp);
  if (Array.isArray(m) && m[1] && isQuotation(m[1])) return m[1];
  // 匹配不到的情况，可能是zh和原来的不一样
  // 比如 (vm.c? "你": "我") + "吃饭"
  // ["你吃饭", "我吃饭"]
  const hansList = getHansString(originString);
  const hans = Array.isArray(hansList) ? hansList[0] : '';
  if (isQuotation(hans[0])) return hans[0];
  return "'";
}

/**
 * 替换引号
 * @param quotation 新引号
 * @param oldQuotation 原来的引号
 * @param str 原始字符串
 * @returns 新字符串
 */
function replaceQuotation({
  quotation,
  oldQuotation,
  str,
}: {
  quotation: IQuotation;
  oldQuotation: IQuotation;
  str: string;
}) {
  const r = new RegExp(oldQuotation, 'gm');
  return str.replace(r, quotation);
}

/**
 * 安全正则匹配
 * @param string
 * @returns
 */
function getSafelyStringRegExp(str: string) {
  return escapeStringRegexp(str);
}

/**
 * 获取传入的字符串类型
 * @param params
 * @returns
 */
function getStringType(params: IStringTypeParams): StringType {
  const { tag, attrName, originString } = params;
  if (!tag || !attrName || /\{\{.*\}\}/.test(originString)) return 'string';

  if (hasQuoteString(originString)) return 'expression';
  return 'mixin';
}

/**
 * @param key vm.jsonz.user_name
 * @return vm@jsonz@user_name
 */
function translateKey2Variate(key: string) {
  return key.replace(/@/g, '.');
}

/**
 * 老class的处理，新class都是用ast generator生成的
 */
function variateString2ExpressionString(str: string) {
  let index = 0;
  let curChar = '';
  let newStr = '';
  let isString: boolean | string = false;
  let isVariate = false;
  // eslint-disable-next-line no-plusplus
  while ((curChar = str[index++])) {
    if (
      (curChar === '"' || curChar === "'") &&
      (curChar === isString || !isString)
    ) {
      if (isString === curChar) isString = false;
      else isString = curChar;
      continue;
    }
    if (isString) {
      newStr += curChar;
      continue;
    }

    if (curChar === ' ') continue;

    if (curChar === '+') {
      newStr += isVariate ? '}}' : '{{';
      isVariate = !isVariate;
      continue;
    }

    if (isVariate) {
      if (curChar === '.') {
        newStr += '.';
      } else {
        newStr += curChar;
      }
      continue;
    }
  }
  if (isVariate) newStr += '}}';
  return newStr;
}

/**
 * * 判断是不是表达式的类型
 * 比如 attr="'name' + vm.name" 属于表达式的类型
 * attr = 'name{{vm.name}}' 不属于表达式的类型
 */

function getIsExpressionType(params: IStringTypeParams): boolean {
  return getStringType(params) === 'expression';
}

/**
 * 是否需要创建text，含有中文，非注释等条件
 * @returns
 */
function shouldCreateText({
  str,
  attr = '',
  i18nextExpression,
}: {
  str: string;
  attr?: string;
  i18nextExpression: string;
}) {
  let i18nextList: string[] = [];
  if (i18nextExpression) {
    i18nextList = Array.isArray(i18nextExpression)
      ? i18nextExpression
      : [i18nextExpression];
  }
  if (!i18nextList.includes('i18next')) {
    i18nextList.push('i18next');
  }

  return (
    hasHans(str) &&
    !isHtmlComment(str) &&
    !isI18n(str, i18nextList) &&
    !isIgnoreAttr(attr)
  );
}

function isStrictI18n(str: string, i18nextExpression: string) {
  const reg = getStrictExpressionRegExp(i18nextExpression);
  const realStr = str.replace(/<!--.*?-->/gm, '');
  return reg.test(realStr);
}

// 严格匹配已经用脚本替换的字符串 i18next2 方案
function getStrictExpressionRegExp(i18nextExpression: string) {
  return new RegExp(
    `(["\\'])\\w+:\\w{8}:[\\s\\S]*?\\1[\\s\\S]*?${i18nextExpression}`,
    'gim'
  );
}

export default {
  shouldCreateText,

  hasHans,
  hasQuoteString,
  isHtmlComment,
  isI18n,
  isStrictI18n,
  isIgnoreAttr,

  getSafelyStringRegExp,
  getMd5Id,

  getHansString,
  getIsExpressionType,
  getZhCnForI18nHint,
  getQuotation,
  replaceQuotation,
  variateString2ExpressionString,
  translateKey2Variate,
};
