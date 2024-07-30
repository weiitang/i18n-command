import fs from 'fs';
import posthtml from 'posthtml';
import type {
  Node as posthtmlNode,
  Options as posthtmlOptions,
} from 'posthtml';
import parseAttrs from 'posthtml-attrs-parser';

import { i18next2Plugin, legacyPlugin } from './plugins';
import type { IPlugin } from './plugins';
import minifier from './utils/minifier';
import { prettierHtmlStr, getPrettierOptions } from './utils/prettier';
import type { AngularJSParserOptions, Record } from './type';

interface Node extends posthtmlNode {
  type?: 'text';
  body?: string | any;
  ignoreI18n?: boolean;
}

/**
 * 解析angular模板
 * 传入参数，调用 traverse 方法，在callback 参数中获取对应的属性
 */
export class AngularTemplateParser {
  props: AngularJSParserOptions;
  dictionaries: Record[] = [];
  html = '';
  plugins: IPlugin[] = [legacyPlugin, i18next2Plugin];

  constructor(props: AngularJSParserOptions) {
    this.props = {
      ...this.getDefaultProps(),
      ...props,
    };
    this.initHtml();
  }

  /**
   * 转换词条，callback回传新生成的html
   */
  traverse() {
    const {
      callback,
      shouldReplace,
      filePath,
      shouldPrettier,
      prettierOptions,
    } = this.props;
    // @ts-ignore
    const { html } = posthtml()
      .use((tree) => this.postHtmlPluginI18n(tree))
      .process(this.html, {
        sync: true,
        xmlMode: true,
        recognizeSelfClosing: true,
      } as posthtmlOptions);

    const prettierHtml: string = shouldPrettier
      ? prettierHtmlStr(html, getPrettierOptions(html, prettierOptions))
      : html;
    callback?.(this.dictionaries, prettierHtml);
    if (shouldReplace && filePath) {
      fs.writeFileSync(filePath, prettierHtml, 'utf-8');
    }
  }

  /**
   * posthtml plugin
   * 处理抽离问题
   * @param tree
   */
  private postHtmlPluginI18n(tree: posthtmlNode) {
    const process = (node: Node) => {
      if (node.type === 'text') {
        return this.handleText(node);
      }
      if (node.attrs) {
        return this.handleAttrs(node);
      }
      return node;
    };

    this.formatTree(tree);

    return tree.walk(process);
  }

  // 主要为了 text content 的类型也支持 i18n-ignore
  private formatTree(tree: posthtmlNode) {
    const stack = [];
    stack.push(...(Array.isArray(tree) ? tree : [tree]));
    let cur;
    while ((cur = stack.pop())) {
      if (!cur.content) continue;
      cur.content = cur.content.map((content: Node) => {
        if (typeof content === 'string') {
          return {
            type: 'text',
            body: content,
          };
        }
        stack.push(content);
        return content;
      });
    }
  }

  /**
   * 为每个属性替换
   * @param node
   * @returns
   */
  private handleAttrs(node: Node) {
    const item: Record[] = [];
    const attrs = parseAttrs(node.attrs);
    const attrKeys = Object.keys(attrs);

    // 是否属于ignore
    if (
      attrKeys.includes('i18n-ignore') ||
      attrKeys.includes('i18n-ignore-children') ||
      node.ignoreI18n
    ) {
      this.ignoreChildren(node, attrKeys.includes('i18n-ignore-children'));
      return node;
    }

    Object.entries(attrs).forEach(([attrName, originAttrValue]) => {
      if (typeof originAttrValue !== 'string') return;
      const attrValue = originAttrValue;

      const { newStringCode, dicts } = this.applyPlugin({
        code: attrValue,
        attrName,
        tag: node.tag || '',
        type: 'attr',
        originCode: originAttrValue,
      });

      attrs[attrName] = newStringCode;
      item.push(...dicts);
    });

    this.dictionaries.push(...item);
    // eslint-disable-next-line no-param-reassign
    node.attrs = attrs.compose();
    return node;
  }

  /**
   * 为单个文案替换text
   * @param node
   * @returns
   */
  private handleText(node: Node) {
    const text = node.body;
    const minifyText = minifier(text);
    // 是否需要忽略
    if (node.ignoreI18n) {
      return text;
    }

    const { newStringCode, dicts } = this.applyPlugin({
      code: minifyText,
      tag: node.tag || '',
      type: 'text',
      originCode: text,
    });
    this.dictionaries.push(...dicts);
    return newStringCode;
  }

  private applyPlugin({
    code,
    tag,
    type,
    originCode,
    attrName,
  }: {
    attrName?: string;
    code: string;
    tag: string;
    type: 'text' | 'attr';
    originCode: string;
  }) {
    return this.plugins.reduce(
      (prev, plugin) =>
        plugin(
          {
            attrName,
            code: prev.newStringCode,
            tag,
            type,
            originCode,
            props: this.props,
          },
          prev
        ),
      {
        newStringCode: code,
        dicts: [],
      }
    );
  }

  /**
   * 预处理html
   * 如果传的是filePath，读取文件，否则用html
   */
  private initHtml() {
    const { filePath, html } = this.props;
    if (!filePath && !html) {
      throw Error('filePath or html is required');
    }
    let originHtml = '';
    if (filePath) {
      originHtml = fs.readFileSync(filePath, 'utf-8');
    } else {
      originHtml = html;
    }
    this.html = originHtml;
  }

  private getDefaultProps(): Partial<AngularJSParserOptions> {
    return {
      shouldReplace: true,
      filePath: '',
      html: '',
      callback: () => {},
      module: '',
      angularFilterName: 'i18next2',
      shouldPrettier: true,
      prettierOptions: {},
      record: () => {},
    };
  }

  /**
   * 处理 i18n-ignore 和 i18n-ignore-children
   */
  private ignoreChildren(node: Node, deep = false) {
    if (!node.content) return;
    node.content.forEach((item) => {
      const child = item;
      if (typeof child === 'string') return;
      // @ts-ignore
      child.ignoreI18n = true;
      if (deep) {
        this.ignoreChildren(child, deep);
      }
    });
  }
}
