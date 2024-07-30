/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import md5 from 'md5';
import throwError from '../../utils/throw-error.ts';
import { isHtml } from './helper';
import * as utils from '../../utils';
import { idLogger } from '../../module/log';

const TYPE = {
  TEMPLATE: 'TEMPLATE',
  STRING: 'STRING',
  JSX: 'JSX',
  HTML: 'HTML',
};

class Ast {
  constructor(props) {
    this.props = props;
    this.path = props.path || '';
    // 语法树
    this.ast = null;
    this.excludeFunc = props.excludeFunc || [];
    this.componentName = props.componentName;
    this.componentPath = props.componentPath;
    this.separator = props.separator;
    this.moduleName = props.moduleName;
    this.updateNodeCallback = props.updateNodeCallback;
    this.i18nDirName = props.i18nDirName;
    this.autoCompleteImport = props.autoCompleteImport;
    this.i18nMethod = props.i18nMethod;
    this.filePath = props.filePath;

    // 检查是否引入组件
    this.hasImportComponent = false;
    // 是否引入i18n配置
    this.hasImportI18n = false;
    // 此文件是否进行i18n转换
    this.hasFileTranslate = false;
    // 忽略行号
    this.ignoreLine = [];

    // eslint配置
  }
  parse(code) {
    this.ast = parser.parse(code, {
      sourceType: 'module', // 识别ES Module
      plugins: [
        'jsx', // enable jsx
        'classProperties',
        'dynamicImport',
        'optionalChaining',
        'decorators-legacy',
        'typescript',
        'asyncGenerators',
        'objectRestSpread',
        'partialApplication',
      ],
    });
  }
  traverse() {
    const { componentPath, componentName, excludeFunc, ignoreLine } = this;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    traverse(this.ast, {
      Program(path) {
        // 解析注释跳过某些行
        const { comments } = path.container;
        comments.forEach((item) => {
          if (/@i18n-ignore/.test(item.value)) {
            // 记录所在行 忽略下一行 TODO 是不是最优方案？
            ignoreLine.push(item.loc.start.line);
          }
        });
      },
      StringLiteral(path) {
        const { node } = path;
        if (node) {
          const text = node.value;
          if (/[\u4E00-\u9FA5\uF900-\uFA2D]/.test(text)) {
            // 对象的键为中文不需要替换
            if (
              t.isObjectProperty(path.parent) &&
              path.parent.key.value === text
            ) {
              return;
            }
            if (t.isCallExpression(path.parent)) {
              const parentNode = path.parent;
              const callName = utils.getCallExpressionName(parentNode);
              self.reConfirm(callName, text);

              // 如果是函数调用是排除项里的，排除
              if (!excludeFunc.includes(callName)) {
                self.updateNode(TYPE.STRING, { path, text });
              }
            } else if (t.isJSXAttribute(path.container)) {
              // 如果是JSXAttribute 期待 JSXElement","JSXFragment","StringLiteral","JSXExpressionContainer"
              self.updateNode(TYPE.JSX, { path, text });
            } else {
              self.updateNode(TYPE.STRING, { path, text });
            }
          }
        }
      },
      JSXText(path) {
        const { node } = path;
        const text = node.value.trim();
        if (/[\u4E00-\u9FA5\uF900-\uFA2D]/.test(text)) {
          self.updateNode(TYPE.JSX, { path, text });
        }
      },
      ImportDeclaration(path) {
        // 判断是否是导入节点
        if (path.node.source.value === componentPath) {
          self.hasImportComponent = true;
          // 检查已经引入就不重复引入
          if (
            path.node.specifiers &&
            !path.node.specifiers.find(
              (node) => node.local.name === componentName
            )
          ) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const ImportSpecifier = t.ImportSpecifier(
              t.Identifier(componentName),
              t.Identifier(componentName)
            );
            path.node.specifiers.push(ImportSpecifier);
          }
        }
        // 是否引入i18n配置
        if (path.node.source.value === `./${self.i18nDirName}`) {
          self.hasImportI18n = true;
        }
      },
    });
    // 字符串模板放在后面转换，防止模板中有字符串没有替换
    traverse(this.ast, {
      TemplateLiteral(path) {
        // 如果模板函数表用参数判断是不是忽略范围内
        if (
          (t.isCallExpression(path.parent) &&
            excludeFunc.includes(utils.getCallExpressionName(path.parent))) ||
          ignoreLine.includes(path.node.loc.start.line - 1)
        ) {
          return;
        }

        // 分析模板字符串比较繁琐 直接替换花括号内容
        const { code } = generate(path.node, {
          jsescOption: { minimal: true },
        });

        // 没有中文直接跳过
        if (!/[\u4E00-\u9FA5\uF900-\uFA2D]/.test(code)) {
          return;
        }

        // 如果有中文 且是html模板
        if (/[\u4E00-\u9FA5\uF900-\uFA2D]/.test(code)) {
          // 如果是一个html模板，只筛选 > < 之间的中文替换，不走下面模板的替换
          if (isHtml(code)) {
            const matchArr = code.match(/(?<=>).+?(?=<)/g) || [];
            const codeArr = matchArr.filter(
              (item) =>
                /[\u4E00-\u9FA5\uF900-\uFA2D]/.test(item) &&
                /^(?!\$\{).*(?<!\})$/.test(item)
            );
            // 提取的词条
            codeArr.length &&
              self.updateNode(TYPE.HTML, { path, text: codeArr, code });
            return;
          }
        }
        // 把${}之间内容筛选出来，记录key值，
        let index = 0;
        const replaceCode = code
          .replace(/\$\{[^}]+\}/g, () => {
            // 把${xx}替换成{{xx}}
            // const result = str.match(/(?<=\$\{).+?(?=\})/g)[0].replace(/\./g, '@');
            index += 1;
            return `{{${index}}}`;
          })
          .replace(/`/g, '');
        const matchArr = code.match(/(?<=\$\{).+?(?=\})/g) || [];
        const params = matchArr.reduce(
          (prev, cur, index) => `${prev}'${index + 1}': ${cur},`,
          ''
        );
        if (matchArr) {
          self.updateNode(TYPE.TEMPLATE, { path, text: replaceCode, params });
        }
      },
    });

    this.autoAddImport();
  }
  autoAddImport() {
    const { componentPath, componentName } = this;
    // 没有组件 引入
    if (this.isNeedImportComponent()) {
      const nodes = this.ast.program.body;
      for (let i = 0; i < nodes.length; i++) {
        if (!t.isImportDeclaration(nodes[i])) {
          const importDefaultSpecifier = [
            t.ImportDefaultSpecifier(t.Identifier(`{${componentName}}`)),
          ];
          const importDeclaration = t.ImportDeclaration(
            importDefaultSpecifier,
            t.StringLiteral(componentPath)
          );
          // 在i处插入import
          this.ast.program.body.splice(i, 0, importDeclaration);
          break;
        }
      }
    }
    // 没有引入i18n配置的 引入一下
    if (this.isNeedImportConfig()) {
      const nodes = this.ast.program.body;
      for (let i = 0; i < nodes.length; i++) {
        if (!t.isImportDeclaration(nodes[i])) {
          const importDeclaration = t.ImportDeclaration(
            [],
            t.StringLiteral(`./${this.i18nDirName}`)
          );
          // 在i处插入import
          this.ast.program.body.splice(i, 0, importDeclaration);
          break;
        }
      }
    }
  }
  isNeedImportComponent() {
    return (
      !this.hasImportComponent &&
      this.autoCompleteImport &&
      this.hasFileTranslate
    );
  }
  isNeedImportConfig() {
    return (
      !this.hasImportI18n && this.autoCompleteImport && this.hasFileTranslate
    );
  }
  updateNode(type, { path, text, params, code }) {
    if (this.ignoreLine.includes(path.node.loc.start.line - 1)) {
      return;
    }
    const {
      updateNodeCallback,
      separator,
      componentName,
      moduleName,
      i18nMethod,
    } = this;
    const id = utils.getMd5Id(text);

    if (type === TYPE.TEMPLATE) {
      path.replaceWith(
        t.Identifier(
          `${componentName}.${i18nMethod}(\`${moduleName}:${id}${separator}${text}\`, {${params}})`
        )
      );
      updateNodeCallback?.({ id, text, moduleName, note: params });
    } else if (type === TYPE.JSX || t.isJSXAttribute(path.container)) {
      // 加花括号
      path.replaceWith(
        t.jsxExpressionContainer(
          t.Identifier(
            `${componentName}.${i18nMethod}('${moduleName}:${id}${separator}${text}')`
          )
        )
      );
      updateNodeCallback?.({ id, text, moduleName });
    } else if (type === TYPE.HTML) {
      let result = code;
      const idMap = new Map(); // { id: i18n文案 }
      const textMap = new Map(); // { item: id }
      text.forEach((item) => {
        const id = utils.getMd5Id(item);
        const regexp = new RegExp(item, 'g');
        // result 先把文案替换为 id
        // 再把id 换成模板
        const temp = `$\{${componentName}.${i18nMethod}('${moduleName}:${id}${separator}${item}')}`;
        result = result.replace(regexp, id);
        idMap.set(id, temp);
        textMap.set(item, id);
        updateNodeCallback?.({ id, text: item, moduleName });
      });
      text.forEach((item) => {
        const id = textMap.get(item);
        const temp = idMap.get(id);
        result = result.replace(id, temp);
      });

      path.replaceWith(t.Identifier(result));
    } else {
      path.replaceWith(
        t.Identifier(
          `${componentName}.${i18nMethod}('${moduleName}:${id}${separator}${text}')`
        )
      );
      updateNodeCallback?.({ id, text, moduleName });
    }
    // 如果转换过才需要创建json文件 否则不需要
    this.hasFileTranslate = true;
  }
  astToCode(eslintConfig) {
    const result = generate(this.ast, {
      retainLines: true,
      jsescOption: { minimal: true, compact: false },
    });
    try {
      return utils.prettierCode(result.code, eslintConfig, this.filePath);
    } catch (e) {
      throwError(e);
    }
  }

  // 记录已有词条，方便标识冗余词条
  //
  reConfirm(callName, text) {
    const { i18nMethod, componentName, separator } = this;
    const { record, getData } = this.props;
    const methodName = `${componentName}.${i18nMethod}`;
    if (callName !== methodName) return;
    const [module, id] = text.split(separator);
    if (!id) return;
    // 记录
    if (module === this.moduleName) record(id);
    // 查看当前id是否还有在词条库中
    const item = getData(id, module);
    if (!item || !item.zh) {
      idLogger.error(`${id} 不存在词条库中, ${text}`);
    }
  }
}

export default Ast;
