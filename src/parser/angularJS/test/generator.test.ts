/*
 * @Description: 对生成代码进行测试
 * @Example: {{vm.name}}=>{{vm.name}}
 */
import * as ngCompiler from '@angular/compiler';
import { generator } from '../ast/generator';

function generateAst(stringCode: string) {
  const code = `<div>${stringCode}</div>`;
  const result = ngCompiler.parseTemplate(code, '');
  // @ts-ignore
  return result.nodes[0].children[0].value.ast.expressions[0];
}

describe('generator', () => {
  test('取反操作: !!', () => {
    const code = '{{!!demo?"jsonz":"test"}}';
    const ast = generateAst(code);
    const result = generator(ast);
    expect(result).toBe(code);
  });

  test('字符串数组: ["name", vm.name, "age"]', () => {
    const code = '{{vm.a.b.c.click(["name",vm.name,"age"])}}';
    const ast = generateAst(code);
    const result = generator(ast);
    expect(result).toBe(code);
  });

  test('三元大小比较数字: vm.name > 0', () => {
    const code = '{{(vm.count>0)?"替换":"添加"}}';
    const ast = generateAst(code);
    const result = generator(ast);
    expect(result).toBe(code);
  });

  test('key读取: vm.demo["原币"]', () => {
    // eslint-disable-next-line quotes
    const code = '{{vm.demo["原币"]}}';
    const ast = generateAst(code);
    const result = generator(ast, {
      isInExpression: false,
    });
    expect(result).toBe(code);
  });

  test('key读取: vm.demo["原币"]', () => {
    const fakeCode = '<div [e]=\'vm.demo["原币"]\'></div>';
    const result = ngCompiler.parseTemplate(fakeCode, '');
    // @ts-ignore
    const { ast } = result.nodes[0].inputs[0].value;
    const generatorCode = generator(ast, {
      isInExpression: true,
    });
    expect(generatorCode).toBe('vm.demo["原币"]');
  });

  test('管道带参数', () => {
    const code = '{{"测试" | pipe : {name: vm.user, code: "jsonz"} }}';
    const ast = generateAst(code);
    const result = generator(ast, {
      isInExpression: false,
    });
    expect(result).toBe(code);
  });

  test('hotfix-0110: propertyRead with keyedRead', () => {
    const code = '{{vm.meeting.model.coordinator.value[0].user_name_en}}';
    const ast = generateAst(code);
    const result = generator(ast, {
      isInExpression: false,
    });
    expect(result).toBe(code);
  });
});
