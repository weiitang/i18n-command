/*
 * @Description: 主要对 ast-helper 做测试
 */

import AstHelper from '../ast/ast-helper';

describe('拼接string与expressions', () => {
  test('只有strings', () => {
    const list = AstHelper.linkAsts({
      strings: ['文案'],
    });
    expect(list).toEqual(['文案']);
  });

  test('文案 + 单个变量', () => {
    const strings = ['文案 ', ''];
    const expressions = ['$0'];
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });
    expect(list).toEqual(['文案 ', '$0']);
  });

  test('首尾文案 + 不间断变量', () => {
    const strings = ['文案', '', '文案'];
    const expressions = ['$0', '$1'];
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });
    expect(list).toEqual(['文案', '$0', '$1', '文案']);
  });

  test('文案 + 多个不间断变量', () => {
    const strings = ['文案 ', '', '', ''];
    const expressions = ['$0', '$1', '$2'];
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });
    expect(list).toEqual(['文案 ', '$0', '$1', '$2']);
  });

  test('多个不间断 + 文案', () => {
    const strings = ['', '', '', '文案'];
    const expressions = ['$0', '$1', '$2'];
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });
    expect(list).toEqual(['$0', '$1', '$2', '文案']);
  });

  test('首位变量', () => {
    const strings = ['', '文案', '', ''];
    const expressions = ['$0', '$1', '$2'];
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });
    expect(list).toEqual(['$0', '文案', '$1', '$2']);
  });

  test('文案 变量混合', () => {
    const strings = ['', '文案', '', '', '文案'];
    const expressions = ['$0', '$1', '$2', '$3'];
    const list = AstHelper.linkAsts({
      strings,
      expressions,
    });
    expect(list).toEqual(['$0', '文案', '$1', '$2', '$3', '文案']);
  });
});
