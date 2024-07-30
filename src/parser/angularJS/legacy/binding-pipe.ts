/* eslint-disable @typescript-eslint/quotes */
import type { BindingPipe, AST } from '@angular/compiler';
import { cloneDeep } from 'lodash';
import { BasicText } from '../ast/basic-text';
import AstHelper from '../ast/ast-helper';
import Helper from '../utils/helper';
import { generator } from '../ast/generator';
import type { ITextParams, Record } from '../type';
import throwError from '../../../utils/throw-error';
import { idLogger } from '../../../module/log';

export class BindingPipeClass extends BasicText {
  // 校验是否是处理的类型
  static verify(code: string, params: ITextParams) {
    if (Helper.isHtmlComment(code)) return false;
    const { ast } = BasicText.parse(code, params);
    const { expressions } = ast;
    return expressions.some((expression: AST) => {
      if (!AstHelper.isBindingPipe(expression)) return false;

      return !!this.findI18nextPipe(expression);
    });
  }

  static findI18nextPipe(expression: BindingPipe): AST {
    const { name, exp } = expression;
    if (name === 'i18next') return expression;

    if (AstHelper.isBindingPipe(exp)) {
      return this.findI18nextPipe(exp);
    }
    return null;
  }

  newCode: string;
  saveData: Record[] = [];
  ast: any;
  private i18nExpressionKey: { key: string; oldValue: string }[] = [];
  private complete = 0;

  constructor(props: ITextParams) {
    super(props);
    if (!BindingPipeClass.verify(props.originString, props)) {
      throwError('not a valid text');
    }
    this.conduct();
  }

  conduct() {
    if (this.newCode && this.saveData.length) return;

    const {
      parseResult: { ast: originAst },
      isExpression,
      props,
    } = this;
    const { originString } = props;

    // clone 一个，避免影响到原来的ast
    const ast = cloneDeep(originAst);
    this.ast = ast;
    const { expressions } = ast;

    // 找出所有符合的 pipe ast
    const i18nextPipes = expressions
      .filter((exp: AST) => AstHelper.isBindingPipe(exp))
      .map((expression: BindingPipe) =>
        BindingPipeClass.findI18nextPipe(expression)
      )
      .filter(Boolean);

    i18nextPipes.forEach((expression: BindingPipe) => {
      const { name, exp } = expression;

      // eslint-disable-next-line no-param-reassign
      if (name === 'i18next') expression.name = 'i18next2';
      this.changeLegacyI18nKey(exp);
    });

    // 如果没有完成，则不做修改，比如找不到一些此条数据时不做完成操作
    if (this.complete !== i18nextPipes.length) {
      this.newCode = originString;
      return;
    }

    const newCodeAst = AstHelper.linkAsts(this.ast);
    const newCode = newCodeAst
      .map((ast) => {
        let codeFragment = generator(ast, { isInExpression: isExpression });
        // 处理引号嵌套问题
        const key = this.i18nExpressionKey.find(({ key }) =>
          codeFragment.includes(key)
        );
        if (key) {
          const quotation = Helper.getQuotation(originString, key.oldValue);
          codeFragment = Helper.replaceQuotation({
            quotation,
            oldQuotation: '"',
            str: codeFragment,
          });
        }
        return codeFragment;
      })
      .join(' ');

    this.newCode = newCode;
  }

  replace() {
    this.conduct();
    return this.newCode;
  }

  getData2Save() {
    this.conduct();
    return this.saveData;
  }

  private changeLegacyI18nKey(exp: AST) {
    const { props } = this;
    const { createRecord, getLegacyI18nData } = props;

    if (AstHelper.isLiteralPrimitive(exp)) {
      // 'namespace:key'
      const oldValue = AstHelper.getLiteralPrimitiveValue(exp);
      const [namespace, i18nKey] = oldValue.split(':');

      const legacyI18nData = getLegacyI18nData({ namespace, i18nKey });
      if (!legacyI18nData?.zh) {
        idLogger.error(`缺少i18n词条：${namespace}:${i18nKey}`);
        // throwError(`缺少i18n词条：${namespace}:${i18nKey}`);
        return;
      }
      const { zh, module: storeModule } = legacyI18nData;

      // generator new namespace:key:hint
      const id = Helper.getMd5Id(zh);
      const hint = Helper.getZhCnForI18nHint(zh);
      const key = `${storeModule}:${id}:${hint}`;
      this.i18nExpressionKey.push({
        key,
        oldValue,
      });
      // eslint-disable-next-line no-param-reassign
      exp.value = key;
      // 完成ast修改

      // 把转换后的i18next2: namespace:md5 记录到词条库中，方便后面的插件使用
      const record: Record = {
        ...legacyI18nData,
        id, // md5
        zh,
        module: storeModule,
      };
      createRecord(record);
      this.saveData.push(record);
      this.complete += 1;
    } else if (AstHelper.isBindingPipe(exp)) {
      this.changeLegacyI18nKey(exp.exp);
    }
  }
}
