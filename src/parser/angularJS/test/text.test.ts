/*
 * @Description: 对各种提取用例进行测试
 * 主要测试 提取和替换后的文本
 */
// @ts-nocheck
import { createText } from '../ast';

function getParams(params) {
  return {
    angularFilterName: 'i18next',
    module: 'kickoff',
    ...params,
  };
}

function create(params) {
  return createText(getParams(params));
}

describe('string形式', () => {
  test('普通文本', () => {
    const d = create({
      originString: '普通文本',
    });

    expect(d.extract()).toEqual(['普通文本']);
    expect(d.replace()).toEqual("{{ 'kickoff:7f3aa4b8:普通文本' | i18next }}");
  });

  test('带其他符号的普通文本', () => {
    const d = create({
      originString: '普通 文本 带空格， 和变.!{量}',
    });
    expect(d.extract()).toEqual(['普通 文本 带空格， 和变.!{量}']);
    expect(d.replace()).toEqual(
      "{{ 'kickoff:22127820:普通 文本 带空格， 和变.!{量}' | i18next }}"
    );
  });

  test('带单个变量的形式', () => {
    const d = create({
      originString: '单个变量{{vm.count}}',
    });

    expect(d.extract()).toEqual(['单个变量{{$0}}']);
    expect(d.replace()).toEqual(
      "{{ 'kickoff:86a880d3:单个变量[$0]' | i18next : {'$0': vm.count,} }}"
    );
  });

  test('带多个变量的形式', () => {
    const d = create({
      originString: '多个{{vm.count}}变量{{vm.ddd}}',
    });
    expect(d.extract()).toEqual(['多个{{$0}}变量{{$1}}']);
    expect(d.replace()).toEqual(
      "{{ 'kickoff:d78de61e:多个[$0]变量[$1]' | i18next : {'$0': vm.count,'$1': vm.ddd,} }}"
    );
  });

  test('单个三元表达式', () => {
    const d = create({
      originString: "{{ vm.count? '有签署': '暂无数据' }} ",
    });
    expect(d.extract()).toEqual(['有签署', '暂无数据']);
    expect(d.replace()).toEqual(
      "{{vm.count?('kickoff:a9f715c7:有签署' | i18next):('kickoff:21efd88b:暂无数据' | i18next)}}"
    );
  });

  test('普通属性', () => {
    const d = create({
      originString: '请填写xxx',
      tag: 'input',
      attrName: 'placeholder',
    });
    expect(d.extract()).toEqual(['请填写xxx']);
    expect(d.replace()).toEqual("{{ 'kickoff:66a8e0e1:请填写xxx' | i18next }}");
  });
});

describe('string混合形式', () => {
  test('文案+普通三元', () => {
    const d = create({
      originString: '文案 {{vm.count? vm.d: vm.ddd}}',
    });
    expect(d.extract()).toEqual(['文案']);
  });

  test('文案 + 三元文案', () => {
    const d = create({
      originString: '你吃 {{ vm.count? "饭": "菜" }}',
    });
    expect(d.extract()).toEqual(['你吃饭', '你吃菜']);
  });

  test('文案 + 三元 + 文案', () => {
    const d = create({
      originString: '你吃 {{ vm.count? "饭": "菜" }} 吗',
    });
    expect(d.extract()).toEqual(['你吃饭吗', '你吃菜吗']);
  });

  test('文案+ 普通过滤器', () => {
    const d = create({
      originString: '文案 {{ vm.count | number: 2}}',
    });
    expect(d.extract()).toEqual(['文案']);
  });

  test('文案+ 过滤器参数', () => {
    const d = create({
      originString: '文案 {{ vm.count | number: "参数"}}',
    });
    d.replace();
    expect(d.extract()).toEqual(expect.arrayContaining(['文案', '参数']));
  });

  test('文案 + 过滤器入参 + 过滤器参数', () => {
    create({
      originString: '文案 {{ "参数1" | number: "参数2"}} ',
    });
    expect(['文案', '参数1', '参数2']).toEqual(['文案', '参数1', '参数2']);
  });
});

describe('expression 形式', () => {
  test('普通字符串', () => {
    const d = create({
      originString: "'签署'",
      tag: 'div',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['签署']);
    expect(d.replace()).toEqual("('kickoff:a26a888d:签署' | i18next)");
  });

  test('字符串带单个变量', () => {
    const d = create({
      originString: '"签 署" + vm.count',
      tag: 'tim-demo',
      attrName: 'output',
    });

    expect(d.extract()).toEqual(['签 署{{$0}}']);
    expect(d.replace()).toEqual(
      '("kickoff:8b6e7b00:签 署[$0]" | i18next : {\'$0\': vm.count,})'
    );
  });

  test('字符串带多个变量', () => {
    const d = create({
      originString: '"奇巧 " + vm.count + "计 程 " + vm.ddd + "车"',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['奇巧 {{$0}}计 程 {{$1}}车']);
    expect(d.replace()).toEqual(
      "(\"kickoff:b5c28ce5:奇巧 [$0]计 程 [$1]车\" | i18next : {'$0': vm.count,'$1': vm.ddd,})"
    );
  });

  test('三元带字符串形式', () => {
    const d = create({
      originString: "vm.count? '有签署' : '暂无数据'",
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['有签署', '暂无数据']);
    expect(d.replace()).toEqual(
      "vm.count?('kickoff:a9f715c7:有签署' | i18next):('kickoff:21efd88b:暂无数据' | i18next)"
    );
  });

  test('过滤器入参字符串', () => {
    const d = create({
      originString: '"测试" | limitTo:3',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['测试']);
    expect(d.replace()).toEqual(
      '("kickoff:db06c78d:测试" | i18next) | limitTo:3'
    );
  });

  test('过滤器参数形式', () => {
    const d = create({
      originString: 'vm.count | limitTo: "参数2"',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['参数2']);
    expect(d.replace()).toEqual(
      'vm.count | limitTo: ("kickoff:e3881850:参数2" | i18next)'
    );
  });

  test('过滤器参数与入参', () => {
    const d = create({
      originString: '"入参1" | limitTo: "参数2"',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['入参1', '参数2']);
    expect(d.replace()).toEqual(
      '("kickoff:76659f50:入参1" | i18next) | limitTo: ("kickoff:e3881850:参数2" | i18next)'
    );
  });

  test('函数调用字符串', () => {
    const d = create({
      originString: 'handleClick("这是弹窗信息")',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['这是弹窗信息']);
    expect(d.replace()).toEqual(
      'handleClick(("kickoff:f5bbfbc5:这是弹窗信息" | i18next))'
    );
  });

  test("文案中有'情况", () => {
    const d = create({
      originString: "这是文案'有引号",
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(["这是文案'有引号"]);
    expect(d.replace()).toEqual(
      "{{ 'kickoff:f85ee610:这是文案有引号' | i18next }}"
    );
  });

  test('文案中有"情况', () => {
    const d = create({
      originString: '这是文案"有引号',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['这是文案"有引号']);
    expect(d.replace()).toEqual(
      "{{ 'kickoff:8dfa58f8:这是文案有引号' | i18next }}"
    );
  });
});

describe('expression 混合形式', () => {
  test('文案 + 普通三元', () => {
    const d = create({
      originString: '"文案" + (vm.count? vm.name: vm.ddd)',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['文案']);
    expect(d.replace()).toEqual(
      '("kickoff:f4b06bd9:文案" | i18next)+(vm.count?vm.name:vm.ddd)'
    );
  });

  test('文案 + 三元文案', () => {
    const d = create({
      originString: '"你吃" + (vm.count? "饭": "菜")',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['你吃饭', '你吃菜']);
    expect(d.replace()).toEqual(
      'vm.count?("kickoff:4704f5c1:你吃饭" | i18next):("kickoff:11feab7d:你吃菜" | i18next)'
    );
  });

  test('三元单个文案 + 文案', () => {
    const d = create({
      originString: '{{item.attachments? item.attachments: 0}} 附件',
      tag: 'div',
    });
    expect(d.extract()).toEqual(['附件']);
    expect(d.replace()).toEqual(
      "{{item.attachments?item.attachments:0}}{{ 'kickoff:c9a6ee90:附件' | i18next }}"
    );
  });

  test('文案 + 三元 + 文案', () => {
    const d = create({
      originString: '"你吃" + (vm.count? "饭": "菜") + "吗"',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['你吃饭吗', '你吃菜吗']);
    expect(d.replace()).toEqual(
      'vm.count?("kickoff:88fd84d6:你吃饭吗" | i18next):("kickoff:32c50abe:你吃菜吗" | i18next)'
    );
  });

  test('文案+ 普通过滤器', () => {
    const d = create({
      originString: '"文案" + (vm.count | number: 2)',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['文案']);
    expect(d.replace()).toEqual(
      '("kickoff:f4b06bd9:文案" | i18next) + (vm.count | number: 2)'
    );
  });

  test('文案+ 过滤器参数', () => {
    const d = create({
      originString: '"文案" + (vm.count | number: "参数")',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['文案', '参数']);
    expect(d.replace()).toEqual(
      '("kickoff:f4b06bd9:文案" | i18next) + (vm.count | number: ("kickoff:3d0a2df9:参数" | i18next))'
    );
  });

  test('文案 + 过滤器入参 + 过滤器参数', () => {
    const d = create({
      originString: '"文案" + ("参数1" | number: "参数2") ',
      tag: 'tim-demo',
      attrName: 'output',
    });
    expect(d.extract()).toEqual(['文案', '参数1', '参数2']);
    expect(d.replace()).toEqual(
      '("kickoff:f4b06bd9:文案" | i18next) + (("kickoff:c6da0fa3:参数1" | i18next) | number: ("kickoff:e3881850:参数2" | i18next)) '
    );
  });
});

// 和上面会有重叠，只是加载这里当做后面check list
describe('替换时发现的一些问题', () => {
  test('文案 ===', () => {
    // 但是 === 真的需要替换多语言标签吗 ？
    const d = create({
      originString: 'vm.demo === "文案"',
      tag: 'tim-web',
      attrName: 'disabled',
    });
    expect(d.extract()).toEqual(['文案']);
    expect(d.replace()).toEqual(
      'vm.demo === ("kickoff:f4b06bd9:文案" | i18next)'
    );
  });

  test('文案 ==', () => {
    const d = create({
      originString: 'vm.demo == "文案"',
      tag: 'tim-web',
      attrName: 'disabled',
    });
    expect(d.extract()).toEqual(['文案']);
    expect(d.replace()).toEqual(
      'vm.demo == ("kickoff:f4b06bd9:文案" | i18next)'
    );
  });

  test('文案 === ', () => {
    const d = create({
      originString: "ctrl.addUserAlert.title === '编辑用户'",
      tag: 'ng-xx',
      attrName: 'xx',
    });
    expect(d.extract()).toEqual(['编辑用户']);
    expect(d.replace()).toEqual(
      "ctrl.addUserAlert.title === ('kickoff:5a0346c4:编辑用户' | i18next)"
    );
  });

  test('文案加 表达式中||操作符', () => {
    const d = create({
      originString: '文案 {{ vm.count || "呆毛" }}',
      tag: 'span',
      attrName: 'wei',
    });
    expect(d.extract()).toEqual(expect.arrayContaining(['文案', '呆毛']));
    expect(d.replace()).toEqual(
      '{{ "kickoff:f4b06bd9:文案" | i18next }} {{ vm.count || ("kickoff:c510c2bc:呆毛" | i18next) }}'
    );
  });

  test('文案加三元', () => {
    const d = create({
      originString: '文案 {{ vm.count? "饭": "菜" }}',
      tag: 'span',
    });
    expect(d.extract()).toEqual(['文案饭', '文案菜']);
    expect(d.replace()).toEqual(
      '{{vm.count?("kickoff:38a3c173:文案饭" | i18next):("kickoff:c5f65590:文案菜" | i18next)}}'
    );
  });

  test('三元 + 符号', () => {
    const d = create({
      originString: " {{response.company.is_fund ? '阶段' : '融资轮次'}}：",
    });

    expect(d.extract()).toEqual(['阶段：', '融资轮次：']);
    expect(d.replace()).toEqual(
      "{{response.company.is_fund?('kickoff:83d4ceab:阶段：' | i18next):('kickoff:8c2358d6:融资轮次：' | i18next)}}"
    );
  });

  test('三元 + 变量', () => {
    const d = create({
      originString:
        "{{user.type === 'contact' ? '公司联系人' : '录入负责人'}} {{user.name}}（ {{user.email}} ）",
    });
    expect(d.extract()).toEqual(['公司联系人', '录入负责人']);
    expect(d.replace()).toEqual(
      "{{user.type === 'contact' ? ('kickoff:5a09a8c7:公司联系人' | i18next) : ('kickoff:a11b94dc:录入负责人' | i18next)}} {{user.name}}（ {{user.email}} ）"
    );
  });

  test('符号 + 三元', () => {
    const d = create({
      originString:
        "({{contact.contact_position | uppercase | empty:'职位未知'}})",
    });
    expect(d.extract()).toEqual(['职位未知']);
    expect(d.replace()).toEqual(
      "({{contact.contact_position | uppercase | empty:('kickoff:87ba54fe:职位未知' | i18next)}})"
    );
  });

  test('函数调用 + 文案', () => {
    const d = create({
      originString:
        '{{formatDate(historyDetailData.range.start_day)}} 至 {{formatDate(historyDetailData.range.end_day)}}',
    });
    expect(d.extract()).toEqual(['至']);
    expect(d.replace()).toEqual(
      "{{formatDate(historyDetailData.range.start_day)}} {{ 'kickoff:981cbe31:至' | i18next }} {{formatDate(historyDetailData.range.end_day)}}"
    );
  });

  test('字符串数组', () => {
    const d = create({
      originString: "['支票', '电汇', '银行转账']",
      tag: 'div',
      attrName: 'picker-source',
    });
    expect(d.extract()).toEqual(['["支票","电汇","银行转账"]']);
    // eslint-disable-next-line quotes
    expect(d.replace()).toEqual(
      "('kickoff:374aa1e2:[支票,电汇,银行转账]' | i18next)"
    );
    // "[(支票 | i18next), (电汇 | i18next), (银行转账 | i18next)]"
  });

  test('多个三元替换中文案', () => {
    const d = create({
      originString:
        "{{ vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.EDIT_HISTORY ? '编辑项目' : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.RETRIEVE ? '提交补录' : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.DATA_REVIEW ? '提交数据审核' : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.EDIT ? '编辑项目' : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.CONVERT ? '转化项目' : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.APPEND ? '新增执行' : '提交项目' }}",
    });
    expect(d.extract()).toEqual([
      '编辑项目',
      '提交补录',
      '提交数据审核',
      '编辑项目',
      '转化项目',
      '新增执行',
      '提交项目',
    ]);
    expect(d.replace()).toEqual(
      "{{ vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.EDIT_HISTORY ? ('kickoff:bd49bc19:编辑项目' | i18next) : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.RETRIEVE ? ('kickoff:4550e5e9:提交补录' | i18next) : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.DATA_REVIEW ? ('kickoff:02811b98:提交数据审核' | i18next) : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.EDIT ? ('kickoff:bd49bc19:编辑项目' | i18next) : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.CONVERT ? ('kickoff:4ac6e4e6:转化项目' | i18next) : vm.kickoffModel.edit_mode === vm.configs.EDIT_MODE.APPEND ? ('kickoff:de44e76e:新增执行' | i18next) : ('kickoff:3d680998:提交项目' | i18next) }}"
    );
  });

  test('三元0与字符串问题', () => {
    const d = create({
      originString: '{{vm.item? vm.item.length: 0}}个',
    });
    expect(d.extract()).toEqual(['个']);
    expect(d.replace()).toEqual(
      "{{vm.item?vm.item.length:0}}{{ 'kickoff:930882bb:个' | i18next }}"
    );
  });

  test('三元与文案问题', () => {
    const d = create({
      originString:
        "文件审批表{{ isNeedPmReview.value.value !== 1 ?'(必填，上传PM审批记录，若是IC Deal则上传IC审批记录)' : '' }}",
    });
    expect(d.extract()).toEqual([
      '文件审批表(必填，上传PM审批记录，若是IC Deal则上传IC审批记录)',
      '文件审批表',
    ]);
    expect(d.replace()).toEqual(
      "{{(isNeedPmReview.value.value!==1)?('kickoff:06a2c92b:文件审批表(必填，上传PM审批记录，若是IC Deal则上传IC审批记录)' | i18next):('kickoff:cdc6d37d:文件审批表' | i18next)}}"
    );
  });
});
