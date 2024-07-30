/* eslint-disable quotes */
/*
 * @Description: ast-text
 * 各个astText实例的测试
 */

import { isEqual } from 'lodash';
import VariateText from '../ast/variate-text';
import NormalText from '../ast/normal-text';
import ConditionalText from '../ast/conditional-text';
import { createAstText as createAstTextOrigin } from '../ast';
import type { ITextParams, Record } from '../type';

describe('test', () => {
  test('demo', () => {
    expect('1').toEqual('1');
  });
});

function createAstText(params: Partial<ITextParams>) {
  return createAstTextOrigin(getParams(params));
}

function getParams(params: Partial<ITextParams>): ITextParams {
  return {
    originString: '',
    module: 'demo',
    angularFilterName: 'i18next2',
    attrName: '',
    tag: '',
    stringCode: '',
    createRecord: () => {},
    getData: () => ({} as Record),
    ...params,
  };
}

function getExample(c: any) {
  const { example, wrongExample } = c;
  return [example, wrongExample].map((i) => (Array.isArray(i) ? i : [i]));
}

function verify(c: any) {
  const [example, wrongExample] = getExample(c);
  const exampleResult = example.every((item) => c.verify(item.expression));
  const wrongResult = wrongExample.every((item) => c.verify(item));

  return [exampleResult, wrongResult];
}

function extractZh(C: any) {
  const { example } = C;
  return example.every((item: { expression: string; zh: string[] }) => {
    const { expression, zh } = item;
    const result = new C({
      originString: expression,
    }).extract();
    const expect = zh;
    return isEqual(result, expect);
  });
}

describe('类型判断', () => {
  test('NormalText', () => {
    const [truthy, falsy] = verify(NormalText);

    expect(truthy).toBeTruthy();
    expect(falsy).toBeFalsy();
  });

  test('VariateText', () => {
    const [truthy, falsy] = verify(VariateText);
    expect(truthy).toBeTruthy();
    expect(falsy).toBeFalsy();
  });

  test('ConditionalText', () => {
    const [truthy, falsy] = verify(ConditionalText);
    expect(truthy).toBeTruthy();
    expect(falsy).toBeFalsy();
  });
});

describe('中文提取判断', () => {
  test('NormalText', () => {
    expect(extractZh(NormalText)).toBeTruthy();
  });

  test('Text 表达式类型', () => {
    const a = new NormalText(
      getParams({
        originString: '"文案"',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(a.extract()).toEqual(['文案']);

    const b = new NormalText(
      getParams({
        originString: "'文案'",
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(b.extract()).toEqual(['文案']);
  });

  test('VariateText', () => {
    expect(extractZh(VariateText)).toBeTruthy();
  });

  test('VariateText 表达式类型: 单个文案 + 单个变量', () => {
    const t = new VariateText(
      getParams({
        originString: '"文案" + vm.count',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['文案{{$0}}']);
  });

  test('VariateText 表达式类型: 单个文案 + 多个变量', () => {
    const t = new VariateText(
      getParams({
        originString: 'vm.a + "文案" + vm.count',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['{{$0}}文案{{$1}}']);
  });

  test('VariateText 表达式类型: 多个文案 + 多个变量', () => {
    const t = new VariateText(
      getParams({
        originString: 'vm.a + "文案" + vm.a + "A" + vm.b + "C"',
        tag: 'tim-demo',
        attrName: 'placeholder)',
      })
    );
    expect(t.extract()).toEqual(['{{$0}}文案{{$0}}A{{$2}}C']);
  });

  test('ConditionalText', () => {
    const results = ConditionalText.example.every(({ expression, zh }) => {
      const t = new ConditionalText(
        getParams({
          originString: expression,
        })
      );
      const result = t.extract();
      return isEqual(result, zh);
    });

    expect(results).toBeTruthy();
  });

  test('ConditionalText 其他操作符', () => {
    const t = new ConditionalText(
      getParams({
        originString:
          "{{vm.model.operators.length > 0 ? '替换' : '添加'}}运营人员",
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['替换运营人员', '添加运营人员']);
    expect(t.replace()).toEqual(
      "{{(vm.model.operators.length>0)?('demo:590b02b5:替换运营人员' | i18next2):('demo:050cdb55:添加运营人员' | i18next2)}}"
    );
  });

  test('ConditionalText 表达式类型: 单个文案+普通三元', () => {
    const t = new ConditionalText(
      getParams({
        originString: '"文案" + (vm.count? vm.a: vm.b)',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['文案']);
  });

  test('ConditionalText 表达式类型：单个文案+单边三元', () => {
    const t = new ConditionalText(
      getParams({
        originString: '"文案" + (vm.count? "A": b)',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['文案', 'A']);
  });

  test('ConditionalText 表达式类型：多个文案+双边文案三元', () => {
    const t = new ConditionalText(
      getParams({
        originString: '"文案" + (vm.count? "A": "B")+"吃"',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['文案A吃', '文案B吃']);
  });

  test('ConditionalText 表达式类型：混合', () => {
    const t = new ConditionalText(
      getParams({
        originString:
          '"文案"+(vm.count? "我": "你")+"吃饭"+(vm.c?d:c)+"单独的"',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.extract()).toEqual(['文案我吃饭', '文案你吃饭', '单独的']);
  });

  test('ConditionalText 表达式类型：复杂三元', () => {
    const t = new ConditionalText(
      getParams({
        originString:
          "{{(projectsOverview.original_valuation && projectsOverview.original_valuation != projectsOverview.valuation) ? '减值后估值: ' : '估值: '}}",
        tag: 'span',
      })
    );
    expect(t.extract()).toEqual(['减值后估值: ', '估值: ']);
  });
});

describe('create text类型判断', () => {
  test('普通文案', () => {
    const c = createAstText({
      originString: '普通文案',
    });
    expect(c instanceof NormalText).toBeTruthy();
  });

  test('三元运算符', () => {
    const c = createAstText({
      originString: '文案 {{vm.count? cm.d: vm.d}}',
    });
    expect(c instanceof ConditionalText).toBeTruthy();
  });
});

describe('Text 替换', () => {
  test('普通文案', () => {
    const t = new NormalText(
      getParams({
        module: 'kickoff',
        originString: '普通文案',
      })
    );
    expect(t.replace()).toBe("{{ 'kickoff:961c514e:普通文案' | i18next2 }}");
  });

  test('普通文案带符号等特殊符号', () => {
    const t = new NormalText(
      getParams({
        module: 'kickoff',
        originString: '普通.wen文案,":',
      })
    );
    expect(t.replace()).toBe(
      "{{ 'kickoff:f0da7640:普通.wen文案,:' | i18next2 }}"
    );
  });

  test('表达式类型的文案', () => {
    const a = new NormalText(
      getParams({
        module: 'kickoff',
        originString: '"普通文案"',
        tag: 'div-demo',
        attrName: 'placeholder',
      })
    );
    expect(a.replace()).toBe('("kickoff:961c514e:普通文案" | i18next2)');

    const b = new NormalText(
      getParams({
        module: 'kickoff',
        originString: "'普通文案'",
        tag: 'div-demo',
        attrName: 'placeholder',
      })
    );
    expect(b.replace()).toBe("('kickoff:961c514e:普通文案' | i18next2)");
  });
});

describe('VariateText 替换', () => {
  test('单个变量', () => {
    const t = new VariateText(
      getParams({
        module: 'kickoff',
        originString: '文案 {{vm.count}}',
      })
    );
    expect(t.replace()).toBe(
      "{{ 'kickoff:f9e13344:文案 [$0]' | i18next2 : {'$0': vm.count,} }}"
    );
  });

  test('多个相同变量', () => {
    const t = new VariateText(
      getParams({
        module: 'kickoff',
        originString: '{{vm.c}}文案 {{vm.count}} {{vm.c}}',
      })
    );
    expect(t.replace()).toBe(
      "{{ 'kickoff:f590ef60:[$0]文案 [$1] [$0]' | i18next2 : {'$0': vm.c,'$1': vm.count,} }}"
    );
  });

  test('表达式单个变量', () => {
    const t = new VariateText(
      getParams({
        module: 'kickoff',
        tag: 'tim-demo',
        attrName: 'placeholder',
        originString: '("文案" + vm.count)',
      })
    );
    expect(t.replace()).toBe(
      '("kickoff:be4be84a:文案[$0]" | i18next2 : {\'$0\': vm.count,})'
    );
  });

  test('表达式多个变量', () => {
    const t = new VariateText(
      getParams({
        module: 'kickoff',
        tag: 'tim-demo',
        attrName: 'placeholder',
        originString: "vm.c + '文案' + vm.count + vm.c",
      })
    );
    expect(t.replace()).toBe(
      "('kickoff:3655acba:[$0]文案[$1][$0]' | i18next2 : {'$0': vm.c,'$1': vm.count,})"
    );
  });

  test('hotfix-0110问题', () => {
    const t = new VariateText(
      getParams({
        module: 'kickoff',
        tag: 'span',
        attrName: '',
        originString:
          '协调：{{vm.meeting.model.coordinator.value[0].user_name_en}}',
      })
    );

    expect(t.replace()).toBe(
      "{{ 'kickoff:141cd811:协调：[$0]' | i18next2 : {'$0': vm.meeting.model.coordinator.value[0].user_name_en,} }}"
    );
  });
});

describe('ConditionalText 替换', () => {
  test('普通文案 + 无文案三元', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '文案 {{vm.count? cm.d: vm.d}}',
      })
    );
    expect(t.replace()).toBe(
      "{{ 'kickoff:f4b06bd9:文案' | i18next2 }}{{vm.count?cm.d:vm.d}}"
    );
  });

  test('单边有文案的三元', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '{{vm.count? "文案": vm.d}}',
      })
    );
    expect(t.replace()).toBe(
      '{{vm.count?("kickoff:f4b06bd9:文案" | i18next2):vm.d}}'
    );
  });

  test('普通文案 + 单边有文案三元', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '文案 {{vm.count? "A": vm.d}}',
      })
    );
    expect(t.replace()).toBe(
      "{{ 'kickoff:f4b06bd9:文案' | i18next2 }}{{vm.count?('kickoff:7fc56270:A' | i18next2):vm.d}}"
    );
  });

  test('普通文案 + 双边三元文案', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '文案 {{vm.count? "A": "B"}}',
      })
    );
    expect(t.replace()).toBe(
      "{{vm.count?('kickoff:9b3823ef:文案A' | i18next2):('kickoff:94b416a4:文案B' | i18next2)}}"
    );
  });

  test('三元文案+一个空字符串', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '{{vm.count? "文案": ""}}',
      })
    );
    expect(t.replace()).toBe(
      '{{vm.count?("kickoff:f4b06bd9:文案" | i18next2):""}}'
    );
  });

  test('多个文案交叉', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '今晚 {{vm.count? "我": "你" }} 吃饭',
      })
    );
    expect(t.replace()).toBe(
      '{{vm.count?("kickoff:843539bd:今晚我吃饭" | i18next2):("kickoff:65ceb1b3:今晚你吃饭" | i18next2)}}'
    );
  });

  test('表达式类型：普通文案 + 无文案三元', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '"文案" + (vm.count? d: c)',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.replace()).toBe(
      '("kickoff:f4b06bd9:文案" | i18next2)+(vm.count?d:c)'
    );
  });

  test('表达式类型：普通文案 + 单边文案三元', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '"文案" + (vm.count? "A": d)',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.replace()).toBe(
      '("kickoff:f4b06bd9:文案" | i18next2)+(vm.count?("kickoff:7fc56270:A" | i18next2):d)'
    );
  });

  test('表达式类型：普通文案 + 双边三元文案', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '"文案" + (vm.count? "A": "B")',
        tag: 'tim-demo',
        attrName: 'placeholder',
      })
    );
    expect(t.replace()).toBe(
      'vm.count?("kickoff:9b3823ef:文案A" | i18next2):("kickoff:94b416a4:文案B" | i18next2)'
    );
  });

  // A?'投后估值':'估值' 替换不会重复替换"估值"字段
  test('重叠三元文案替换问题', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString: '{{A?"投后估值": "估值"}}',
        tag: 'span',
      })
    );
    expect(t.replace()).toBe(
      '{{A?("kickoff:6c7ab119:投后估值" | i18next2):("kickoff:59df8b98:估值" | i18next2)}}'
    );
  });

  test('重叠三元文案替换问题2', () => {
    const t = new ConditionalText(
      getParams({
        module: 'kickoff',
        originString:
          "文件审批表{{ isNeedPmReview.value.value !== 1 ?'(必填，上传PM审批记录，若是IC Deal则上传IC审批记录)' : '' }}",
        tag: 'span',
      })
    );
    expect(t.replace()).toBe(
      "{{(isNeedPmReview.value.value!==1)?('kickoff:06a2c92b:文件审批表(必填，上传PM审批记录，若是IC Deal则上传IC审批记录)' | i18next2):('kickoff:cdc6d37d:文件审批表' | i18next2)}}"
    );
  });
});
