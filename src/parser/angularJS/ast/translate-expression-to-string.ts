import * as ngCompiler from '@angular/compiler';
import Helper from './../utils/helper';
import { generator } from './generator';
import type { ITextParams } from '../type';

/**
 * 将表达式类型的代码转为普通的字符串类型
 * @param params
 */
function translateExpression2String(params: ITextParams): string {
  const { originString } = params;
  if (!Helper.getIsExpressionType(params)) return originString;

  // 先把表达式转给compiler，然后根据ast生成字符串
  const transString = originString.replace(/'/g, '"');
  const fakeCode = `<div [e]='${transString}'></div>`;
  // @ts-ignore
  const parseResult = ngCompiler.parseTemplate(fakeCode, {
    preserveWhitespaces: false,
  });
  if (parseResult.errors?.length) {
    return originString;
  }
  // @ts-ignore
  const expression = parseResult.nodes[0].inputs[0].value;
  const { ast } = expression;
  const result = generator(ast, {
    isInExpression: false,
  });
  return result || originString;
}

export default translateExpression2String;
