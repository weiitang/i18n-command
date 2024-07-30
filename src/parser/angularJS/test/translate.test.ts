/*
 * @Description: 模版格式转换
 * 将表达式模版转换为普通模版
 * @Example: vm.name + 'wei' => {{vm.name}}wei
 */
import translateExpression2String from '../ast/translate-expression-to-string';

function create(args: any) {
  const isString = typeof args === 'string';
  const defaultParams = {
    tag: 'tim-demo',
    attrName: 'placeholder',
  };
  const params = isString
    ? {
        ...defaultParams,
        originString: args,
      }
    : {
        ...defaultParams,
        ...args,
      };
  return translateExpression2String(params);
}

describe('translateExpression2String', () => {
  test('普通字符串', () => {
    const stringCode = create('"文案"');
    expect(stringCode).toBe('文案');
  });

  test('单个无文案三元', () => {
    // 没有文案不属于处理类型
    const stringCode = create('vm.count? vm.d: vm.c');
    expect(stringCode).toBe('vm.count? vm.d: vm.c');
  });

  test('单个有文案三元', () => {
    const stringCode = create('vm.count? "文案": vm.c');
    expect(stringCode).toBe('{{vm.count?"文案":vm.c}}');
  });

  test('文案+普通三元', () => {
    const stringCode = create('"文案" + (vm.count?vm.d:vm.c)');
    expect(stringCode).toBe('文案{{vm.count?vm.d:vm.c}}');
  });

  test('文案+有文案三元', () => {
    const stringCode = create('"文案" + (vm.count? "A":"B")');
    expect(stringCode).toBe('文案{{vm.count?"A":"B"}}');
  });

  test('函数调用字符串参数', () => {
    const stringCode = create('vm.handleClick("中文")');
    expect(stringCode).toBe('{{vm.handleClick("中文")}}');
  });

  test('函数调用对象参数', () => {
    const stringCode = create('handleClick({a:"中文"})');
    expect(stringCode).toBe('{{handleClick({a: "中文"})}}');
  });

  test('函数调用多个参数', () => {
    const stringCode = create(
      'vm.a.b.c.handleClick({a:"中文"}, "wei", vm.ddd, item)'
    );
    expect(stringCode).toBe(
      '{{vm.a.b.c.handleClick({a: "中文"}, "wei", vm.ddd, item)}}'
    );
  });
});
