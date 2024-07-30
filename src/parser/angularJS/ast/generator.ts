import type {
  Binary,
  LiteralPrimitive,
  PropertyRead,
  Conditional,
  BindingPipe,
  LiteralMap,
  MethodCall,
  PrefixNot,
  LiteralArray,
  KeyedRead,
} from '@angular/compiler';
import AstHelper from './ast-helper';

interface GeneratorParams {
  isInExpression?: boolean;
}

// 普通文本字符串
export function handleText(text: string, params: GeneratorParams) {
  const { isInExpression } = params;
  return isInExpression ? `"${text}"` : text;
}

// 二元运算符 + || && > < == === != !== 等等
export function handleBinary(node: Binary, params: GeneratorParams) {
  const { left, right, operation } = node;
  const { isInExpression } = params;
  switch (operation) {
    case '+': {
      const l = generator(left, params);
      const r = generator(right, params);
      return isInExpression ? `${l}+${r}` : `${l}${r}`;
    }

    case '||':
    case '&&': {
      const l = generator(left, params);
      const r = generator(right, params);
      const result = `${l}${operation}${r}`;
      return isInExpression ? result : `{{${result}}}`;
    }

    case '<':
    case '>': {
      const l = generator(left, params);
      const r = generator(right, params);
      return `(${l}${operation}${r})`;
    }

    case '==':
    case '===':
    case '!=':
    case '!==': {
      const params = { isInExpression: true };
      const l = generator(left, params);
      const r = generator(right, params);
      const code = `${l}${operation}${r}`;
      return isInExpression ? `(${code})` : `{{${code}}}`;
    }

    default: {
      console.warn('未知类型: ', operation);
      const l = generator(left, params);
      const r = generator(right, params);
      return `(${l}${operation}${r})`;
    }
  }
}

// 文字或数字类型
export function handleLiteral(node: LiteralPrimitive, params: GeneratorParams) {
  const { value } = node;
  const { isInExpression } = params;
  if (typeof value === 'number') return value;
  return isInExpression ? `"${value}"` : value;
}

// vm.name
export function handleProperty(node: PropertyRead, params: GeneratorParams) {
  const { isInExpression } = params;
  const expression = AstHelper.getPropertyName(node);
  return isInExpression ? expression : `{{${expression}}}`;
}

// 三元运算符
export function handleConditional(node: Conditional, params: GeneratorParams) {
  const { condition, trueExp, falseExp } = node;
  const generatorParams = {
    isInExpression: true,
  };
  const conditionStr = generator(condition, generatorParams);
  const trueStr = generator(trueExp, generatorParams);
  const falseStr = generator(falseExp, generatorParams);
  const code = `${conditionStr}?${trueStr}:${falseStr}`;
  return params.isInExpression ? `(${code})` : `{{${code}}}`;
}

// 单个pipe
export function handleBindingPipeItem(
  node: BindingPipe,
  params: GeneratorParams
) {
  const { name, args } = node;
  let code = '';
  code += name;

  // 参数处理
  let argCode = '';
  if (args.length) {
    const argList: string[] = [];
    args.forEach((arg) => {
      argList.push(generator(arg, params));
    });
    argCode = argList.join(' : ');
    code += ` : ${argCode} `;
  }
  return code;
}

// pipe处理
export function handleBindingPipe(node: BindingPipe, params: GeneratorParams) {
  const filters = [];
  let exp = node;
  const itemParams = {
    isInExpression: true,
  };

  while (exp) {
    let code;
    if (AstHelper.isBindingPipe(exp)) {
      code = handleBindingPipeItem(exp, itemParams);
    } else {
      code = generator(exp, itemParams);
    }
    filters.unshift(code);
    // @ts-ignore
    exp = exp.exp;
  }
  const filterCode = filters.join(' | ');
  return params.isInExpression ? `(${filterCode})` : `{{${filterCode}}}`;
}

// 对象 {{ x | filter { key1: value1 } }}
export function handleLiteralMap(node: LiteralMap, params: GeneratorParams) {
  const { keys, values } = node;
  const codeList: { key: string; value: string }[] = [];
  keys.forEach((k, index) => {
    const v = values[index];
    const { key, quoted } = k;
    const kCode = quoted ? `"${key}"` : key;
    codeList.push({
      key: kCode,
      value: generator(v, params),
    });
  });

  const newCode = codeList.map(({ key, value }) => `${key}: ${value}`);

  return `{${newCode.join(', ')}}`;
}

// 函数调用
export function handleMethodCall(node: MethodCall, params: GeneratorParams) {
  const { isInExpression } = params;
  const { receiver, args, name } = node;
  let exp = receiver;
  const caller: string[] = [];
  name && caller.push(name);
  while (exp) {
    const code = generator(exp, { isInExpression: true });
    code && caller.unshift(code);
    // @ts-ignore
    exp = exp.exp;
  }

  let argsCode = '';
  if (args.length) {
    const argList: string[] = [];
    args.forEach((arg) => {
      argList.push(generator(arg, { isInExpression: true }));
    });
    argsCode = argList.join(', ');
  }
  const expression = `${caller.join('.')}(${argsCode})`;
  const code = isInExpression ? `${expression}` : `{{${expression}}}`;
  return code;
}

// 取反操作 !vm.name
export function handlePrefixNot(node: PrefixNot, params: GeneratorParams) {
  const { isInExpression } = params;
  const exp = generator(node.expression, { isInExpression: true });
  return isInExpression ? `!${exp}` : `{{!${exp}}}`;
}

// 数组
export function handleLiteralArray(node: LiteralArray) {
  const { expressions: expressionsNode } = node;
  const expressions = expressionsNode.map((node) =>
    generator(node, { isInExpression: true })
  );
  return `[${expressions.join(',')}]`;
}

// vm.demo['jsonz']
export function handleKeyedRead(node: KeyedRead, params: GeneratorParams) {
  const { receiver, key } = node;
  const receiverCode = generator(receiver, { isInExpression: true });
  const keyCode = generator(key, { isInExpression: true });
  const expression = `${receiverCode}[${keyCode}]`;
  return params.isInExpression ? expression : `{{${expression}}}`;
}

/**
 * 生成器
 * @param node AST节点
 * @param params 是否是表达式类型
 * @returns newCode
 */
export function generator(node: any, params: GeneratorParams = {}): string {
  if (typeof node === 'string') return handleText(node, params);

  const name = AstHelper.getConstructorName(node);
  switch (name) {
    case 'Binary':
      return handleBinary(node, params);
    case 'LiteralPrimitive':
      return handleLiteral(node, params);
    case 'PropertyRead':
      return handleProperty(node, params);
    case 'Conditional':
      return handleConditional(node, params);
    case 'BindingPipe':
      return handleBindingPipe(node, params);
    case 'LiteralMap':
      return handleLiteralMap(node, params);
    case 'MethodCall':
      return handleMethodCall(node, params);
    case 'PrefixNot':
      return handlePrefixNot(node, params);
    case 'LiteralArray':
      return handleLiteralArray(node);
    case 'KeyedRead':
      return handleKeyedRead(node, params);
    case 'ImplicitReceiver':
      break;
    default:
      debugger;
      console.error(`类型未做处理${name}: ${JSON.stringify(node)}`);
  }
}
