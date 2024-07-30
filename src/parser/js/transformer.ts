/* eslint-disable @typescript-eslint/no-unused-vars */
import ts from 'typescript';
import { logger, idLogger } from '../../module/log';
import { hasWordWithLeadingComment } from '../../utils';
// import { nodeType } from './constants';
import * as helper from './helper';
import { getConfig } from '../../config/index';
import Collector, { IKey } from '../../module/collector/index';
import _ from 'lodash';

const config = getConfig();

// eslint-disable-next-line @typescript-eslint/naming-convention
type nodeType =
  | ts.Node
  | ts.Expression
  | ts.StringLiteral
  | ts.JsxText
  | ts.JsxExpression
  | ts.JsxAttribute
  | ts.TemplateExpression;

interface ICollection {
  start: number;
  end: number;
  code: string;
}

class Transformer {
  path: string;
  needUpdateNodeList: ICollection[];
  newWordList: Set<string>;
  existImport: Set<string>;
  needImportFile: Set<string>;
  existIdList: Set<{ id: string; module: string }>;

  constructor(public ast: ts.SourceFile) {
    this.ast = ast;
    this.path = ast.fileName;
    // 更新节点列表
    this.needUpdateNodeList = [];
    // 新词条列表
    this.newWordList = new Set();
    // 已存在词条列表
    this.existIdList = new Set();
    // 已经添加过import的文件 避免重复添加
    this.existImport = new Set();
    // 记录需要自动import的文件名
    this.needImportFile = new Set();
  }
  nodeVisitor<T extends ts.Node>(): ts.TransformerFactory<T> {
    return (context) => {
      const visit: ts.Visitor = (node) => {
        if (isIgnore(node)) {
          // logger.info('需要忽略的节点：', node.getText());
          return node;
        }
        this.transformer(node, context);
        return ts.visitEachChild(node, (child) => visit(child), context);
      };
      return (rootNode) => ts.visitNode(rootNode, visit);
    };
  }
  recordNodeList(node: ts.Node, start: number, end: number, newLine?: boolean) {
    if (!node) return;
    this.needImportFile.add(this.ast.fileName);

    const newCode = ts.createPrinter().printNode(4, node, this.ast);
    this.needUpdateNodeList.push({
      code: newCode + (newLine ? '\n' : ''),
      start,
      end,
    });
  }
  // i18n方法ast节点
  createI18nFunctionNode(
    text?: string,
    params?: { key: string; value: ts.Expression }[]
  ) {
    // 添加词条进入收集器
    this.newWordList.add(text);
    // 创建词条节点
    const string = helper.generateI18nText(
      text,
      config.getModuleName(this.path),
      config.separator
    );
    const node = params
      ? [
          ts.factory.createStringLiteral(string, true),
          ts.factory.createObjectLiteralExpression(
            params.map((param) =>
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier(param.key),
                param.value
              )
            ),
            false
          ),
        ]
      : [ts.factory.createStringLiteral(string, true)];

    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(config.i18nObject),
        ts.factory.createIdentifier(config.i18nMethod)
      ),
      undefined,
      node
    );
  }

  // 总方法 直接返回新node节点方式，对源码格式影响较大，改为返回原节点 记录更新节点位置 最后统一更新
  transformer(node: any, context?: ts.TransformationContext): nodeType {
    if (!isNeedTransform(node)) {
      return node;
    }
    switch (node.kind) {
      case ts.SyntaxKind.JsxText:
        this.jsxTextTransformer(node, context);
        break;
      // case ts.SyntaxKind.JsxAttribute:
      //   this.jsxAttributeTransformer(node, context);
      //   break;
      case ts.SyntaxKind.TemplateExpression:
        this.templateTransformer(node, context);
        break;
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        this.noSubstitutionTemplateTransformer(node, context);
        break;
      case ts.SyntaxKind.StringLiteral:
        this.stringTransformer(node, context);
        break;
      // case ts.SyntaxKind.JsxExpression:
      //   this.jsxExpressionTransformer(node, context);
      //   break;
      case ts.SyntaxKind.CallExpression:
        this.callExpressionTransformer(node, context);
        break;
    }
    // 检查import 自动补充
    this.autoAddImport(this.ast);
    return node;
  }

  // 字符串方法
  stringTransformer(
    node: ts.StringLiteral,
    context?: ts.TransformationContext
  ) {
    // 对象的键为中文不需要替换
    if (helper.isObjectProperty(node)) return node;
    // 如果是国际化方法中的不需要替换
    if (
      ts.isCallExpression(node.parent) &&
      node.parent?.expression
        ?.getText()
        ?.endsWith(`${config.i18nObject}.${config.i18nMethod}`)
    )
      return node;

    // logger.info('更新节点:', 'string', node.getText());
    let newNode = this.createI18nFunctionNode(node.text);
    // 如果是jsx属性中的加花括号
    if (ts.isJsxAttribute(node.parent)) {
      // @ts-ignore
      newNode = ts.factory.createJsxExpression(
        undefined,
        this.createI18nFunctionNode(node.text)
      );
    }
    this.recordNodeList(newNode, node.getStart(), node.end);
    // return this.createI18nFunctionNode(node.text);
  }
  // 模板方法
  templateTransformer(
    node: ts.TemplateExpression,
    context?: ts.TransformationContext
  ) {
    // logger.info('更新节点:', 'template', node.getText());
    const allText = node.getText();
    // 如果是一段html 不可以直接转换为一个变量
    if (helper.isHtml(allText)) {
      this.htmlTransformer(node, context);
      return;
    }
    // 如果template中有literal为中文才走转换，否则不转换
    if (
      !/[\u4E00-\u9FA5\uF900-\uFA2D]/.test(node.head.text) &&
      !node?.templateSpans?.some((span) =>
        /[\u4E00-\u9FA5\uF900-\uFA2D]/.test(span?.literal?.text)
      )
    ) {
      return;
    }
    const headText = node.head.text;
    let text = headText;
    const params: { key: string; value: ts.Expression }[] = [];
    node.templateSpans.forEach((span: ts.TemplateSpan, index) => {
      text = `${text}{{_${index}}}${span.literal.text}`;
      params.push({
        key: `_${index}`,
        value: span.expression,
      });
    });
    const newNode = this.createI18nFunctionNode(text, params);
    this.recordNodeList(newNode, node.getStart(), node.end);
  }
  // jsx 字符串方法
  jsxTextTransformer(node: ts.JsxText, context?: ts.TransformationContext) {
    // logger.info('更新节点:', 'jsx text', node.getText());
    const newNode = ts.factory.createJsxExpression(
      undefined,
      this.createI18nFunctionNode(node.text.trim())
    );
    this.recordNodeList(newNode, node.getStart(), node.end);
  }
  // jsx表达式方法
  jsxExpressionTransformer(
    node: ts.JsxExpression,
    context?: ts.TransformationContext
  ) {
    // let newNode = null;
    if (node.expression.kind === ts.SyntaxKind.StringLiteral) {
      // 如果子节点是字符串直接交由字符串方法去解析
      // newNode = ts.factory.createJsxExpression(
      //   undefined,
      //   // @ts-ignore
      //   this.createI18nFunctionNode(node.expression.text),
      // );
      return;
    }
    if (ts.isCallExpression(node.expression)) {
      // 是函数表达式跳过，交由下次函数解析方法
      // this.callExpressionTransformer(node.expression, context);
      return;
    }
    if (node.expression.kind === ts.SyntaxKind.TemplateExpression) {
      // 交由字符串解析方法去解析
      // newNode = ts.factory.createJsxExpression(
      //   undefined,
      //   // @ts-ignore
      //   this.templateTransformer(node.expression),
      // );
      return;
    }
    // this.recordNodeList(newNode, node.getStart(), node.end);
  }
  // 函数调用方法
  callExpressionTransformer(
    node: ts.CallExpression,
    context?: ts.TransformationContext
  ) {
    // 现存新国际化方法
    if (
      node.expression
        .getText()
        ?.endsWith(`${config.i18nObject}.${config.i18nMethod}`)
    ) {
      // @ts-ignore
      const text = node.arguments[0]?.text;
      const module = text.split(config.separator)?.[0];
      const id = text.split(config.separator)?.[1];
      const info = Collector.get(id, module);
      if (info?.status === IKey.NO_MATCH) {
        const newNode = ts.factory.createCallExpression(
          node.expression,
          undefined,
          [
            ts.factory.createStringLiteral(
              `${module}${config.separator}${info.newId}${config.separator}${info.zh}`,
              true
            ),
            ...(node.arguments?.[1] ? node.arguments.slice(1) : []),
          ]
        );
        this.recordNodeList(newNode, node.getStart(), node.end);
        // logger.info('节点信息不匹配，已更新:', 'call express', node.getText(), info);
      } else {
        Collector.record(module, id);
      }
      if (!info) {
        // idLogger.warn('缺失词条信息:', node.getText(), 'path:', this.path);
      }
      id && this.existIdList.add({ id, module });
      // logger.info('更新节点:', 'call express', node.getText());
    }
    // 老方法i18n方法迁移
    if (
      config.transformOldI18nWord &&
      node.expression.getText()?.endsWith(config.transformOldI18nWord)
    ) {
      // @ts-ignore
      const text = node.arguments[0]?.text;
      const module = text?.split(config.separator)?.[0];
      const id = text?.split(config.separator)?.[1];
      const info = Collector.get(id, module);
      if (info) {
        const newNode = ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier(config.i18nObject),
            ts.factory.createIdentifier(config.i18nMethod)
          ),
          undefined,
          [
            ts.factory.createStringLiteral(
              `${info.module}${config.separator}${info.id}${config.separator}${info.zh}`,
              true
            ),
            ...(node.arguments?.[1] ? node.arguments.slice(1) : []),
          ]
        );
        this.recordNodeList(newNode, node.getStart(), node.end);
        id && this.existIdList.add({ id, module: info.module });
      } else {
        // 标记转换不了的词条
        // idLogger.warn('缺失词条信息:', node.getText(), 'path:', this.path);
      }
      // logger.info('更新节点:', 'call express', node.getText());
    }
  }
  // jsx 属性方法
  jsxAttributeTransformer(
    node: ts.JsxAttribute,
    context?: ts.TransformationContext
  ) {
    // 直接把属性值值继续转换
    this.transformer(node.initializer, context);
    // const newNode = ts.factory.createJsxAttribute(
    //   ts.factory.createIdentifier(node.name.text),
    //   // @ts-ignore
    //   this.transformer(node.initializer, context),
    // );
    // this.recordNodeList(newNode, node.getStart(), node.end);
  }
  // 模板字符串方法
  noSubstitutionTemplateTransformer(
    node: ts.NoSubstitutionTemplateLiteral,
    context?: ts.TransformationContext
  ) {
    if (helper.isHtml(node.text)) {
      this.htmlTransformer(node, context);
      return;
    }
    // 纯模板字符串 按照string转换
    const newNode = this.createI18nFunctionNode(node.text);
    this.recordNodeList(newNode, node.getStart(), node.end);
    return node;
  }
  // 字符串为html的方法
  htmlTransformer(
    node: ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression,
    context?: ts.TransformationContext
  ) {
    const string = node.getText();
    let startIndex = 0;
    const matchArr = string.match(/(?<=>)[^<>]+(?=<)/g) || [];
    const codeArr = matchArr.filter(
      (item) =>
        /[\u4E00-\u9FA5\uF900-\uFA2D]/.test(item) &&
        /^(?!\$\{).*(?<!\})$/.test(item)
    );
    codeArr?.forEach((item) => {
      // 添加词条进入收集器
      this.newWordList.add(item);
      const i18nString = helper.generateI18nText(
        item,
        config.getModuleName(this.path),
        config.separator
      );
      const newNode = ts.factory.createIdentifier(
        `${'$'}{${config.i18nObject}.${config.i18nMethod}('${i18nString}')}`
      );
      // 有可能有相同文案所以必须匹配><之间的文案
      const start =
        node.getStart() + string.indexOf(`>${item}<`, startIndex) + 1;
      const end = start + item.length;
      // string = string.replace(regexp, `${'$'}{${config.i18nObject}.${config.i18nMethod}('${i18nString}')}`);
      this.recordNodeList(newNode, start, end);
      // 记录下一个查找的起始位置
      startIndex = string.indexOf(item) + 1;
    });
    // const newNode = ts.factory.createNoSubstitutionTemplateLiteral(string);
  }
  autoAddImport(node: ts.SourceFile) {
    // 不需要自动添加import
    if (!config.autoCompleteImport) {
      return;
    }
    // 如果已经有了import
    if (this.existImport.has(node.fileName)) {
      return;
    }
    // 判断是否需要引入
    if (!this.needImportFile.has(node.fileName)) {
      return;
    }
    const importList = node.statements.filter((node) =>
      ts.isImportDeclaration(node)
    );
    const matchedImportIdx = importList.findIndex(
      (s) =>
        ts.isImportDeclaration(s) &&
        (s.moduleSpecifier as ts.StringLiteral).text === config.i18nObjectPath
    );

    const createImport = (node?: ts.NodeArray<ts.ImportSpecifier>) =>
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports([
            ...(node || []),
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier(config.i18nObject)
            ),
          ])
        ),
        ts.factory.createStringLiteral(config.i18nObjectPath, true)
      );
    // 没找到就添加
    if (matchedImportIdx === -1) {
      const firstImportNode = importList[0];

      const newNode = createImport();
      this.recordNodeList(
        newNode,
        firstImportNode?.getStart() || 0,
        firstImportNode?.getStart() || 0,
        true
      );
      this.existImport.add(node.fileName);
    } else {
      // 有就添加元素成员
      const findImportNode = importList[
        matchedImportIdx
      ] as ts.ImportDeclaration;
      const haveImport = (
        findImportNode.importClause?.namedBindings as ts.NamedImports
      )?.elements?.find((item) => item.name.escapedText === config.i18nObject);
      const newNode = createImport(
        (findImportNode.importClause?.namedBindings as ts.NamedImports)
          ?.elements
      );
      !haveImport &&
        this.recordNodeList(
          newNode,
          findImportNode.pos,
          findImportNode.end,
          true
        );
    }
  }
}
export default Transformer;

// 需要转换的节点
function isNeedTransform(node: ts.Node) {
  const text = node?.getText();
  const hasChinese = /[\u4E00-\u9FA5\uF900-\uFA2D]/.test(text);
  // 存在中文
  if (
    hasChinese &&
    [
      ts.SyntaxKind.StringLiteral,
      ts.SyntaxKind.JsxText,
      ts.SyntaxKind.JsxExpression,
      ts.SyntaxKind.JsxAttribute,
      ts.SyntaxKind.NoSubstitutionTemplateLiteral,
      ts.SyntaxKind.TemplateExpression,
    ].includes(node?.kind)
  ) {
    if (
      node?.kind === ts.SyntaxKind.JsxExpression &&
      !(node as ts.JsxExpression)?.expression
    ) {
      return false;
    }
    return true;
  }
  // 现存国际化方法
  if (node?.kind === ts.SyntaxKind.CallExpression) {
    if (
      (node as ts.CallExpression)?.expression
        .getText()
        ?.endsWith(`${config.i18nObject}.${config.i18nMethod}`)
    ) {
      return true;
    }
    if (
      config.transformOldI18nWord &&
      (node as ts.CallExpression)?.expression
        .getText()
        ?.endsWith(config.transformOldI18nWord)
    ) {
      return true;
    }
  }
  return false;
}

// 忽略规则
function isIgnore(node: ts.Node) {
  // 忽略文件
  if (helper.ignoreAllfile(node)) {
    return true;
  }
  // 忽略下一行
  if (helper.ignoreNextLine(node)) {
    return true;
  }
  // 忽略的调用方法
  if (
    ts.isCallExpression(node) &&
    [...config.excludeFunc].includes(node.expression.getText())
  ) {
    return true;
  }
  // jsx中忽略的方法
  if (
    ts.isJsxExpression(node) &&
    node?.expression &&
    isIgnore(node.expression)
  ) {
    return true;
  }
  // 忽略类型声明
  if (
    ts.isEnumDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node)
  ) {
    return true;
  }
  // Error忽略
  if (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'Error'
  ) {
    return true;
  }
  return false;
}
