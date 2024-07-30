/* eslint-disable @typescript-eslint/quotes */
/*
 * @Description: 遗留的 i18next 转为现在的 i18next2
 */

import { BindingPipeClass } from '../legacy/binding-pipe';
import type { ITextParams } from '../type';
function translate({
  code,
  ...rest
}: {
  code: string;
} & Partial<ITextParams>) {
  const pipeClass = new BindingPipeClass({
    originString: code,
    module: 'test',
    angularFilterName: 'i18next2',
    // @ts-ignore
    getLegacyI18nData: ({ namespace, i18nKey }) => ({
      module: 'test',
      zh: namespace,
      en: i18nKey,
    }),
    createRecord() {},
    ...rest,
  });
  return {
    newStringCode: pipeClass.replace(),
    dicts: pipeClass.getData2Save(),
  };
}

describe('内容过滤符 pipeline', () => {
  test('单个pipe', () => {
    const code = `{{ 'common:check_btn' | i18next }}`;
    const { newStringCode, dicts } = translate({
      code,
    });
    expect(newStringCode).toEqual(`{{'test:9efab239:common' | i18next2}}`);
    expect(dicts).toEqual([
      {
        id: '9efab239',
        module: 'test',
        zh: 'common',
        en: 'check_btn',
      },
    ]);
  });

  test('单个pipe带参数', () => {
    const code = `{{ 'common:check_btn' | i18next : { start: vm.demo, end: 'demo' } }}`;
    const { newStringCode, dicts } = translate({
      code,
    });
    expect(newStringCode).toEqual(
      `{{'test:9efab239:common' | i18next2 : {start: vm.demo, end: 'demo'} }}`
    );
    expect(dicts).toEqual([
      {
        en: 'check_btn',
        id: '9efab239',
        module: 'test',
        zh: 'common',
      },
    ]);
  });

  test('多个pipe1', () => {
    const code = `{{ 'common:check_btn' | i18next | empty }}`;
    const { newStringCode } = translate({
      code,
    });
    expect(newStringCode).toEqual(
      `{{'test:9efab239:common' | i18next2 | empty}}`
    );
  });

  test('多个pipe2', () => {
    const code = `{{ 'common:check_btn' | empty | i18next }}`;
    const { newStringCode } = translate({
      code,
    });
    expect(newStringCode).toEqual(
      `{{'test:9efab239:common' | empty | i18next2}}`
    );
  });
});

describe('expression 模式', () => {
  test('单个pipe', () => {
    const code = `'componentDecisions:terminate_confirm' | i18next`;
    const attrName = 'ng-bind-html';
    const tag = 'div';
    const { newStringCode } = translate({
      code,
      tag,
      attrName,
    });
    expect(newStringCode).toEqual(
      `('test:a0d70846:componentDecisions' | i18next2)`
    );
  });

  test('多个pipe', () => {
    const code = `'componentDecisions:terminate_confirm' | i18next | empty`;
    const attrName = 'ng-bind-html';
    const tag = 'div';
    const { newStringCode } = translate({
      code,
      tag,
      attrName,
    });
    expect(newStringCode).toEqual(
      `('test:a0d70846:componentDecisions' | i18next2 | empty)`
    );
  });

  test('多个pipe带参数', () => {
    const code = `'componentDecisions:terminate_confirm' | empty | i18next : { start: vm.demo, end: 'demo' }`;
    const attrName = 'ng-bind-html';
    const tag = 'div';
    const { newStringCode } = translate({
      code,
      tag,
      attrName,
    });
    expect(newStringCode).toEqual(
      `('test:a0d70846:componentDecisions' | empty | i18next2 : {start: vm.demo, end: 'demo'} )`
    );
  });

  test('带引号的属性', () => {
    const code = `{{'componentCompanyFromEdit:enter_empty' | i18next}}{{'componentCompanyFromEdit:company_profile' | i18next}}`;
    const attrName = 'placeholder';
    const tag = 'div';
    const { newStringCode } = translate({
      code,
      tag,
      attrName,
    });
    expect(newStringCode).toEqual(
      "{{'test:36aab1d8:componentCompanyFromEdit' | i18next2}} {{'test:36aab1d8:componentCompanyFromEdit' | i18next2}}"
    );
  });
});
