import prettier from 'prettier';
import fs from 'fs-extra';
import { logger } from '../../../module/log';

export const defaultPrettierOptions = {
  parser: 'html',
  arrowParens: 'always',
  bracketSpacing: true,
  htmlWhitespaceSensitivity: 'ignore',
  insertPragma: false,
  // jsxBracketSameLine: false,
  jsxSingleQuote: false,
  printWidth: 80,
  proseWrap: 'preserve',
  quoteProps: 'as-needed',
  requirePragma: false,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: true, // app 用空格，pc用tab....
  vueIndentScriptAndStyle: false,
} as const;

export function prettierHtmlStr(
  htmlStr: string,
  prettierOptions: prettier.Options = defaultPrettierOptions
) {
  const prettierHtml = prettier.format(htmlStr, prettierOptions);
  return prettierHtml;
}

export function prettierHtmlFile(
  filePath: string,
  prettierOptions: prettier.Options = {}
) {
  const htmlStr = fs.readFileSync(filePath, 'utf-8');
  try {
    const prettierHtml = prettierHtmlStr(htmlStr, prettierOptions);
    fs.writeFileSync(filePath, prettierHtml);
  } catch (e) {
    logger.error('格式化失败', filePath);
    throw e;
  }
}

/**
 * 文件中tab和空格并用，所以加一个函数来判断是用哪种缩进
 * @param html
 */
export function getIsUseTab(html: string) {
  const tabsCount = html.match(/\n\t/g) || [];
  const spaceCount = html.match(/\n /g) || [];
  return tabsCount.length > spaceCount.length;
}

export function getPrettierOptions(
  html: string,
  options: prettier.Options = {}
) {
  const prettierOptions = {
    ...defaultPrettierOptions,
    ...options,
    useTabs: getIsUseTab(html),
  };
  return prettierOptions;
}
