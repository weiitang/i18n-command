/* eslint-disable no-param-reassign */
/**
 * 三元运算符的情境
 */
import { BasicText } from './basic-text';
import Helper from '../utils/helper';
import AstHelper from './ast-helper';
import { generator } from './generator';
import type { IClassExample } from './basic-text';
import type { ITextClass } from '.';
import type { ITextParams } from '../type';

export default class TextWithConditional
  extends BasicText
  implements ITextClass
{
  static stringType = 0 as const;
  static expressionType = 1 as const;

  static example: IClassExample[] = [
    {
      expression: '文案 {{ vm.count ? vm.d: vm.c }}',
      zh: ['文案'],
    },
    {
      expression: '文案 {{ vm.count ? vm.d: "2" }}',
      zh: ['文案', '2'],
    },
    {
      expression: '文案 {{vm.count? "1": "2"}}',
      zh: ['文案1', '文案2'],
    },
    {
      expression: '{{vm.count? "我": "你" }} 吃饭',
      zh: ['我吃饭', '你吃饭'],
    },
    {
      expression: '今晚 {{vm.count? "我": "你" }} 吃饭',
      zh: ['今晚我吃饭', '今晚你吃饭'],
    },
    {
      expression: '{{vm.dd? vm.d: vm.s}} 你好{{vm.c? "嗯" : "啊" }}',
      zh: ['你好嗯', '你好啊'],
    },
    {
      expression:
        '{{vm.dd? vm.d: vm.s}} 你好{{vm.d?d:d}}{{vm.c? "嗯" : "啊" }}',
      zh: ['你好', '嗯', '啊'],
    },
  ];

  static wrongExample = [
    '文案',
    '文案 {{vm.count}}',
    '文案{{vm.count | filterName}}',
    '文案 {{vm.count || "文案2"}}',
    '文案 {{ vm.count? "我" : "你" }} 吃饭 {{vm.count}}',
    /* 两个的情况不处理，不然正交太多情况 */
    '{{vm.count ? "我": "你"}} 吃 {{vm.d? "饭": "菜"}} ',
  ];

  static verify(originString: string, params?: ITextParams) {
    const code = params?.stringCode || originString;
    if (!Helper.hasHans(code) || !code.includes('{{')) return false;
    try {
      const { ast } = BasicText.parse(code, params);
      const { expressions } = ast;

      // 是否只有三元表达式，不包含其他表达式，如果包含的话，正交的情况太多了
      const isOnlyConditional = expressions.every((exp: any) =>
        AstHelper.isConditional(exp)
      );
      // 带有变量或其他表达式情况
      if (!isOnlyConditional) return false;
      // 只有一个简单三元，返回true
      if (isOnlyConditional && expressions.length === 1) {
        const { trueExp, falseExp } = expressions[0];
        // 如果是多重嵌套的三元，直接按照老逻辑处理,类似这种
        // {{ vm.a? 'a': vm.b? 'b': vm.c? 'c': 'd' }}
        if (
          AstHelper.isSimpleExpression(trueExp) &&
          AstHelper.isSimpleExpression(falseExp)
        )
          return true;

        return false;
      }

      // 有多个三元的情况下，判断是否有多个三元带文案，是的话，返回false，不然太多文案不好拼接
      // true: 最多只能有一个三元是带文案
      const results = expressions
        .map((exp: any) => {
          const { trueExp, falseExp } = exp;
          const hasLiteral = [trueExp, falseExp].some((e) =>
            AstHelper.isLiteralPrimitive(e)
          );
          return hasLiteral;
        })
        .filter(Boolean);
      return results.length < 2;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  zhList: {
    type: 0 | 1;
    string: string;
  }[] = [];
  newCode = '';

  extract() {
    this.generateZhListWithNewCode();
    return this.zhList.map((i) => i.string);
  }

  generateZhListWithNewCode(force = false) {
    if (this.zhList.length && this.newCode && !force) return this.newCode;

    const {
      parseResult: { ast },
      isExpression,
    } = this;

    // new list 抽离zh && 生成新代码
    const zhList: {
      type: 0 | 1;
      string: string;
    }[] = [];
    const newCode: string[] = [];
    const { strings, expressions } = ast;
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    })
      .map((i) => (typeof i === 'string' ? i.trim() : i))
      .filter((i) => i !== '');

    const newList: any[] = [];

    list.forEach((item, index) => {
      if (typeof item === 'string') {
        newList.push(item);
        return;
      }

      if (AstHelper.isConditional(item)) {
        const { trueExp, falseExp } = item;
        const isTrueExpLiteral = AstHelper.isLiteralPrimitive(trueExp);
        const isFalseExpLiteral = AstHelper.isLiteralPrimitive(falseExp);
        item.isTrueExpLiteral = isTrueExpLiteral;
        item.isFalseExpLiteral = isFalseExpLiteral;
        if (!isTrueExpLiteral || !isFalseExpLiteral) {
          newList.push(item);
          return;
        }

        const isPrevString = typeof list[index - 1] === 'string';
        const isNextString = typeof list[index + 1] === 'string';

        const next = isNextString ? list[index + 1] : '';
        const prev = isPrevString ? newList.pop() : '';
        if (next) list.splice(index + 1, 1);

        if (isTrueExpLiteral) {
          let str = prev + AstHelper.getLiteralPrimitiveValue(trueExp);
          next && (str += next);
          item.trueExp.value = str;
        }

        if (isFalseExpLiteral) {
          let str = prev + AstHelper.getLiteralPrimitiveValue(falseExp);
          next && (str += next);
          item.falseExp.value = str;
        }
        newList.push(item);
        return;
      }
      newList.push(item);
    });

    newList.forEach((item) => {
      if (typeof item === 'string') {
        zhList.push({
          string: item,
          type: TextWithConditional[
            isExpression ? 'expressionType' : 'stringType'
          ],
        });
        newCode.push(generateCode(item));
        return;
      }

      if (AstHelper.isConditional(item)) {
        if (!item.isTrueExpLiteral && !item.isFalseExpLiteral) {
          newCode.push(generateCode(item));
          return;
        }

        if (item.isTrueExpLiteral && item.trueExp.value) {
          zhList.push({
            string: item.trueExp.value,
            type: TextWithConditional.expressionType,
          });
        }
        if (item.isFalseExpLiteral && item.falseExp.value) {
          zhList.push({
            string: item.falseExp.value,
            type: TextWithConditional.expressionType,
          });
        }
        newCode.push(generateCode(item));
        return;
      }

      newCode.push(generateCode(item));
      return;
    });

    function generateCode(code: string) {
      return generator(code, {
        isInExpression: isExpression,
      });
    }

    let codeString = newCode.join(isExpression ? '+' : '');
    // hack
    if (newCode.length === 1 && /^\(.+\)$/.test(codeString)) {
      codeString = codeString.slice(1, -1);
    }
    this.zhList = zhList;
    this.newCode = codeString;
    return codeString;
  }

  replace(): string {
    this.generateZhListWithNewCode();

    const { newCode, zhList } = this;
    let resultString = newCode;

    zhList.sort((a, b) => b.string.length - a.string.length);
    const idMapReplaceStr = new Map<string, string>();
    zhList.forEach((zh) => {
      const { type, string } = zh;
      const id = Helper.getMd5Id(string);
      let i18nextExpression = this.getI18nExpression(string);
      const stringRegexp = Helper.getSafelyStringRegExp(string);
      const regexpValue = `(["'])?${stringRegexp}\\1`;

      const regexp = new RegExp(regexpValue, 'gm');
      if (type === TextWithConditional.stringType) {
        i18nextExpression = `{{ ${i18nextExpression} }}`;
      } else if (type === TextWithConditional.expressionType) {
        i18nextExpression = `(${i18nextExpression})`;
      }
      idMapReplaceStr.set(id, i18nextExpression);
      resultString = resultString.replace(regexp, id);
    });

    // 先用idMap 再替换，是防止替换的过程中有一些文案被重复替换了
    // 比如：投中项目-项目 可能项目会被match替换两次
    [...idMapReplaceStr].forEach(([id, i18nextExpression]) => {
      resultString = resultString.replace(id, i18nextExpression);
    });

    // 防止替换后的文案中有多种类型的引号
    const quotation = Helper.getQuotation(
      this.props.originString,
      zhList[0].string
    );
    const replaceQuotation = quotation === "'" ? '"' : "'";
    const regexpValue = `${replaceQuotation}`;
    resultString = resultString.replace(
      new RegExp(regexpValue, 'g'),
      quotation
    );

    return resultString;
  }
}
