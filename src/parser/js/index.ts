/* eslint-disable @typescript-eslint/no-unused-vars */
import * as ts from 'typescript';
import fs from 'fs-extra';
import { logger } from '../../module/log';
import Transformer from './transformer';
import * as helper from './helper';
import { getCommentAtPosition } from 'tsutils';
import { IPathItem, getMd5Id } from '../../utils/index';
import collector from '../../module/collector/index';
import md5 from 'md5';
interface JsParseProps {
  path: string;
}
class JsParser {
  path: string;
  module: string;
  code: string;
  ast: ts.SourceFile;
  transformer: any;

  constructor(props: IPathItem) {
    this.path = props.filePath;
    this.module = props.module;
    this.code = '';
    this.ast = null;
  }
  // 编译
  parse() {
    this.code = fs.readFileSync(this.path, 'utf-8');
    this.ast = ts.createSourceFile(
      this.path,
      this.code,
      ts.ScriptTarget.Latest,
      true
      // ts.ScriptKind.TSX,
    );
    return this.ast;
  }
  // 遍历 + 转换
  transform() {
    this.transformer = new Transformer(this.ast);
    const newAst = ts.transform(this.ast, [this.transformer.nodeVisitor()]);
    this.ast = newAst.transformed?.[0];
  }
  // 提取
  extract() {
    this.transformer.newWordList.forEach((word: string) => {
      const id = getMd5Id(word);
      collector.add(this.module, { id, zh: word, module: this.module });
    });
    this.transformer.existIdList.forEach(({ id, module }: any) => {
      collector.record(module, id);
    });
  }
  // 输出
  generate() {
    // const printer = ts.createPrinter({
    //   removeComments: false,
    //   newLine: ts.NewLineKind.CarriageReturnLineFeed,
    // });
    let newCode = this.code;
    this.transformer.needUpdateNodeList
      .sort((a: any, b: any) => b.start - a.start)
      .forEach((node: any) => {
        if (!node.code) return true;
        // printFile中文会转换为unicode，这里需要转换回来

        const parseCode = unescape(node.code.replace(/\\u/g, '%u'));
        newCode =
          newCode.substr(0, node.start) + parseCode + newCode.substr(node.end);
      });
    // let newCode = printer.printFile(this.ast);
    fs.writeFileSync(this.path, newCode);
  }
}

export default JsParser;
interface DocEntry {
  name?: string;
  fileName?: string;
  documentation?: string;
  type?: string;
  constructors?: DocEntry[];
  parameters?: DocEntry[];
  returnType?: string;
}
