import type { AST, BindingPipe, LiteralPrimitive } from '@angular/compiler';
import type { GetData } from './../type';

type IGetStoreDataItem = (
  { id, module }: { id: string; module: string },
  getData: GetData
) => {
  module: string;
  id: string;
};

type Node = any;

export type IClassType =
  | 'Text'
  | 'Conditional'
  | 'BoundText'
  | 'ASTWithSource'
  | 'PropertyRead'
  | 'LiteralPrimitive'
  | 'BindingPipe'
  | 'Binary'
  | 'LiteralMap'
  | 'MethodCall'
  | 'PrefixNot'
  | 'LiteralArray'
  | 'ImplicitReceiver';

const ClassType: IClassType[] = [
  'Text',
  'Conditional',
  'BoundText',
  'ASTWithSource',
  'PropertyRead',
  'LiteralPrimitive',
  'BindingPipe',
  'Binary',
  'LiteralMap',
  'MethodCall',
  'PrefixNot',
  'LiteralArray',
  'ImplicitReceiver',
];

// 获取当前ast node构造函数的名字
function getConstructorName(node: Node) {
  return node.constructor.name;
}

// 获取 propertyRead的表达式
// @TODO: HACK
function getPropertyName(node: Node) {
  let cur = node;
  const property = [cur.name];
  while (cur.receiver.name || cur.receiver.key) {
    const { key, receiver } = cur.receiver;
    cur = cur.receiver;
    if (key) {
      if (receiver.name) {
        property.unshift(`${receiver.name}[${key.value}]`);
        cur = cur.receiver;
      } else {
        property.unshift(`[${key.value}]`);
      }
    } else if (cur.name) {
      property.unshift(cur.name);
    }
  }
  const expression = property.join('.');
  return expression;
}

// 获取 LiterPrimitive 的值
function getLiteralPrimitiveValue(node: Node) {
  return node.value;
}

// 拼接 ast中的 strings 和 expression
function linkAsts({
  strings = [],
  expressions = [],
}: {
  strings: any[];
  expressions?: any[];
}): any[] {
  const list = [];
  let expIndex = 0;

  function nextExp(onlyRead = false) {
    const has = typeof expressions[expIndex] !== 'undefined';
    if (onlyRead) return has;
    if (has) {
      // eslint-disable-next-line no-plusplus
      return expressions[expIndex++];
    }
    return '';
  }

  for (let i = 0; i < strings.length; i++) {
    const pre = strings[i - 1];
    const str = strings[i];
    const next = strings[i + 1];

    if (str === '' && pre && next) {
      list.push(nextExp());
    }

    if (pre && str && nextExp(true)) {
      list.push(nextExp());
    }

    if (str === '') {
      list.push(nextExp());
    } else {
      if (next === undefined && nextExp(true)) {
        list.push(nextExp());
      }
      list.push(str);
    }
  }
  return list.filter((item) => item !== '');
}

// 是否是简单的表达式
function isSimpleExpression(node: Node) {
  const name = getConstructorName(node);
  return [
    'LiteralPrimitive',
    'PropertyRead',
    'PrefixNot',
    'ImplicitReceiver',
  ].includes(name);
}

interface IAstHelper {
  linkAsts: typeof linkAsts;
  isSimpleExpression: typeof isSimpleExpression;
  getLiteralPrimitiveValue: typeof getLiteralPrimitiveValue;
  getPropertyName: typeof getPropertyName;
  ClassType: typeof ClassType;
  getConstructorName: typeof getConstructorName;
  isBindingPipe: (node: AST) => node is BindingPipe;
  isLiteralPrimitive: (node: AST | string) => node is LiteralPrimitive;
  getStoreDataItem: IGetStoreDataItem;
  [key: string]: any;
}

const AstHelper = {
  linkAsts,
  isSimpleExpression,
  getLiteralPrimitiveValue,
  getConstructorName,
  getPropertyName,
  ClassType,
  getStoreDataItem({ id, module }, getData?) {
    const fallback = { module, id };
    if (getData) {
      const item = getData(id, module);
      if (!item) return fallback;
      return {
        module: item.module ?? module,
        id: item.id ?? id,
      };
    }
    return fallback;
  },
} as IAstHelper;

AstHelper.ClassType.forEach((type) => {
  AstHelper[`is${type}`] = (node: Node) => getConstructorName(node) === type;
});

export default AstHelper;
