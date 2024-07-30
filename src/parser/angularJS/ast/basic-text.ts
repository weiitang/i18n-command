import * as ngCompiler from '@angular/compiler';
import Helper from '../utils/helper';
import AstHelper from './ast-helper';
import translateExpression2String from './translate-expression-to-string';
import type { ITextParams, Record } from '../type';

export interface IClassExample {
  zh: string[];
  expression: string;
}

export class Basic {
  static defaultProps = {
    stringCode: '',
    module: '',
    originString: '',
    tag: '',
    attrName: '',
    angularFilterName: 'i18next2',
  };

  static parse(code: string, params?: ITextParams) {
    const stringCode = params ? translateExpression2String(params) : code;
    const fakeCode = `<div>${stringCode}</div>`;
    // @ts-ignore
    const result = ngCompiler.parseTemplate(fakeCode);
    // @ts-ignore
    const node = result.nodes[0].children[0];
    if (AstHelper.isBoundText(node)) return node.value;
    return node;
  }

  props: ITextParams;
  isExpression: boolean;
  stringCode: string;
  parseResult: any;

  constructor(props: ITextParams) {
    this.props = {
      ...Basic.defaultProps,
      ...props,
    };

    this.isExpression =
      typeof props.isExpression === 'undefined'
        ? Helper.getIsExpressionType({
            ...props,
            originString: props.originString,
          })
        : props.isExpression;
    this.stringCode = this.isExpression
      ? translateExpression2String(props)
      : props.originString;
    this.parseResult = Basic.parse(props.originString, props);
  }
}

export class BasicText extends Basic {
  private storeModule: string;
  /**
   * 获取中文对应的i18n表达式
   * @param zh 要转换的中文
   * @returns i18n 表达式
   */
  getI18nExpression(zh: string): string {
    const {
      module: propsModule,
      angularFilterName,
      originString,
      getData,
    } = this.props;

    const id = Helper.getMd5Id(zh);
    const { module } = AstHelper.getStoreDataItem(
      {
        id,
        module: propsModule,
      },
      getData
    );
    this.storeModule = module;

    const hint = Helper.getZhCnForI18nHint(zh);
    const quotation = Helper.getQuotation(originString, zh);
    let key = `"${module}:${id}:${hint}" | ${angularFilterName}`;
    key = Helper.replaceQuotation({
      quotation,
      oldQuotation: '"',
      str: key,
    });
    return key;
  }

  getData2Save(): Record[] {
    const { module, originString } = this.props;
    // @ts-ignore
    const zh = this.extract();
    const zhList = Array.isArray(zh) ? zh : [zh];
    return zhList.map((zhItem) => {
      const id = Helper.getMd5Id(zhItem);
      return {
        zh: zhItem,
        id,
        module: this.storeModule || module,
        originString,
      };
    });
  }
}
