import globby from 'globby';
import path from 'path';
import ts from 'typescript';
import htmlTags from 'html-tags';
import { getMd5Id } from '../../utils/index';

export interface IPathItem {
  filePath: string; // 路径
  module: string; // 模块
  fileType: string; // 扩展名
  fileName: string; // 文件名
}
// 生成i18n 词条
export function generateI18nText(
  text: string,
  moduleName: string,
  separator: string
) {
  const id = getMd5Id(text);
  return `${moduleName}:${id}${separator}${text}`;
}

// 获取所有路径
export const getAllFiles = (
  includePath: string[],
  excludePath?: string[],
  fileType?: string[],
  getModuleName?: (str: string) => string
): IPathItem[] => {
  const files = globby.sync(includePath, {
    ignore: excludePath,
    absolute: true,
  });
  const result = fileType
    ? files.filter((item: string) => {
        const { ext } = path.parse(item);
        return fileType.includes(ext);
      })
    : files;

  return result.map((item: string) => {
    const module = getModuleName?.(item) || 'module';
    const { ext } = path.parse(item);
    return {
      fileType: ext,
      fileName: path.basename(item),
      filePath: item,
      module,
    };
  });
};

// 上方注释是否包含某个值
export const hasWordWithLeadingComment = (node: ts.Node, word: string) => {
  const commentRanges = ts.getLeadingCommentRanges(
    node.getFullText(),
    node.pos
  );
  // 上方有注释
  const result = commentRanges?.some(({ pos, end }) => {
    const comment = node.getFullText().substring(pos, end);
    return comment.includes(word);
  });
  const leadingTrivia = node
    .getFullText()
    .substr(0, node.getLeadingTriviaWidth());
  return result || leadingTrivia.includes(word);
};

// 是否是键值对的键
export function isObjectProperty(node: ts.Node) {
  return ts.isPropertyAssignment(node.parent) && node.parent.name === node;
}

export function ignoreAllfile(node: ts.Node) {
  if (ts.isSourceFile(node)) {
    return hasWordWithLeadingComment(node, '@i18n-ignore-all');
  }
  return false;
}

export function ignoreNextLine(node: ts.Node) {
  if (!ts.isSourceFile(node)) {
    return hasWordWithLeadingComment(node, '@i18n-ignore-line');
  }
  return false;
}

// 问题：https://github.com/microsoft/TypeScript/issues/843
// 解决：https://stackoverflow.com/questions/51353988/typescript-ast-transformation-removes-all-blank-lines
const defaultEmptyLineMarker = '!--empty-line--!';
const defaultNewLine = '\r\n';
export function encodeEmptyLines(
  text: string,
  emptyLineMarker?: string,
  newLine?: string
) {
  const marker = toComment(emptyLineMarker || defaultEmptyLineMarker);

  const lines = text.split(/\r?\n/);
  const commentedLines = lines.map((line) =>
    line.trim() === '' ? marker : line
  );

  return commentedLines.join(newLine || defaultNewLine);
}

export function decodeEmptyLines(
  text: string,
  emptyLineMarker?: string,
  newLine?: string
) {
  const marker = toComment(emptyLineMarker || defaultEmptyLineMarker);

  const lines = text.split(/\r?\n/);
  const uncommentedLines = lines
    .filter((line) => line !== '')
    .map((line) => (line?.trim() === marker ? '' : line));

  return uncommentedLines.join(newLine || defaultNewLine);
}

function toComment(marker: string) {
  return `/*${marker}*/`;
}

export function isHtml(string: string) {
  const basic = /\s?<!doctype html>|(<html\b[^>]*>|<body\b[^>]*>|<x-[^>]+>)+/i;
  const full = new RegExp(
    htmlTags.map((tag) => `<${tag}\\b[^>]*>`).join('|'),
    'i'
  );
  const loose = /<\w+.*?>(.*)<\/\w+>/i;
  // We limit it to a reasonable length to improve performance.
  const testString = string.trim().slice(0, 1000);

  return (
    basic.test(testString) || full.test(testString) || loose.test(testString)
  );
}
