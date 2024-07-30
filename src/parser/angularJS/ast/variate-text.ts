/**
 * 包含变量的情景
 */
import type { PropertyRead } from '@angular/compiler';
import { BasicText } from './basic-text';
import Helper from '../utils/helper';
import AstHelper from './ast-helper';
import type { IClassExample } from './basic-text';
import type { ITextClass } from './';
import type { ITextParams } from '../type';

export default class TextWithVariate extends BasicText implements ITextClass {
  static example: IClassExample[] = [
    {
      expression: '文案 {{vm.count}}',
      zh: ['文案 {{$0}}'],
    },
    {
      expression: '文案 {{vm.count}} 文案 {{vm.count}}',
      zh: ['文案 {{$0}} 文案 {{$0}}'],
    },
    {
      expression: '文案 {{vm.count}} {{vm.c}}',
      zh: ['文案 {{$0}} {{$1}}'],
    },
    {
      expression: '文案 {{vm.count}}{{vm.a}} {{vm.d}}文案{{vm.d}}',
      zh: ['文案 {{$0}}{{$1}} {{$2}}文案{{$2}}'],
    },
  ];

  static wrongExample = [
    '文案 {{ vm.count? true: false }}',
    '文案 {{ vm.count | filter }}',
  ];

  static verify(originString: string, params?: ITextParams) {
    const stringCode = params?.stringCode;
    const code = stringCode || originString;
    // 没中文，或者没有 {{
    if (!Helper.hasHans(code) || !code.includes('{{')) return false;
    try {
      const { ast } = BasicText.parse(code, params);

      const { expressions } = ast;
      // 是否只包含变量的情况
      const isOnlyVariate = expressions.every((exp: any) =>
        AstHelper.isPropertyRead(exp)
      );
      return isOnlyVariate;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  variateMap = new Map<string, string>();

  extract() {
    const { parseResult, variateMap } = this;
    const { ast } = parseResult;
    const { strings, expressions } = ast;
    expressions.forEach((exp: PropertyRead, index: number) => {
      const key = AstHelper.getPropertyName(exp);
      if (variateMap.has(key)) return;
      const placeholder = `$${index}`;
      const value = `{{${placeholder}}}`;
      variateMap.set(key, value);
    });

    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });

    const str = list
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (AstHelper.isPropertyRead(item)) {
          const key = AstHelper.getPropertyName(item);
          return variateMap.get(key);
        }
        return '';
      })
      .join('');

    return [str];
  }

  replace() {
    const { isExpression, variateMap } = this;
    const zh = this.extract()[0];
    let paramsStr = '';
    const i18nextExpression = this.getI18nExpression(zh);
    if (variateMap.size) {
      paramsStr += ' : {';
      for (const [property, placeholder] of variateMap.entries()) {
        const key = /\{\{(.+)\}\}/.exec(placeholder)[1];
        paramsStr += `'${key}': ${property},`;
      }
      paramsStr += '}';
    }

    if (isExpression) {
      return `(${i18nextExpression}${paramsStr})`;
    }
    return `{{ ${i18nextExpression}${paramsStr} }}`;
  }

  getData2Save() {
    const defaultData = super.getData2Save();
    const params = Array.from(this.variateMap.entries()).reduce(
      (acc, [variate, placeholder]) => {
        acc[placeholder] = variate;
        return acc;
      },
      {} as any
    );
    return [
      {
        ...defaultData[0],
        params,
      },
    ];
  }
}
