/** A runtime property value that can be read by a display condition. */
export interface ConditionPropertyValue {
  value: boolean | number | string | null;
}

/** Property values available to a Wallpaper Engine display condition. */
export type ConditionValues = Record<string, ConditionPropertyValue | undefined>;

type Primitive = boolean | number | string | null;

type TokenKind
  = | 'and'
    | 'eof'
    | 'equal'
    | 'greater'
    | 'greaterEqual'
    | 'less'
    | 'lessEqual'
    | 'not'
    | 'notEqual'
    | 'openParen'
    | 'closeParen'
    | 'or'
    | 'reference'
    | 'strictEqual'
    | 'strictNotEqual'
    | 'value';

interface Token {
  kind: TokenKind;
  value?: Primitive | string;
}

type Expression
  = | { type: 'binary'; left: Expression; operator: TokenKind; right: Expression }
    | { type: 'literal'; value: Primitive }
    | { key: string; type: 'reference' }
    | { expression: Expression; type: 'not' };

const MAX_EXPRESSION_LENGTH = 2048;
const MAX_TOKENS = 256;
const parsedExpressions = new Map<string, Expression>();
const invalidExpressions = new Set<string>();
const warnedExpressions = new Set<string>();

/**
 * Evaluates the documented, comparison-only subset of Wallpaper Engine display
 * conditions without executing author-provided JavaScript.
 *
 * Invalid expressions and missing property references stay visible so authors
 * can correct them in the simulator.
 */
export function isConditionVisible(
  condition: string | undefined,
  values: ConditionValues,
): boolean {
  if (!condition)
    return true;

  try {
    const expression = getExpression(condition);
    return Boolean(evaluate(expression, values));
  }
  catch (error) {
    warnOnce(condition, error);
    return true;
  }
}

function getExpression(source: string): Expression {
  const cached = parsedExpressions.get(source);
  if (cached)
    return cached;
  if (invalidExpressions.has(source))
    throw new Error('The expression could not be parsed.');

  try {
    const parser = new Parser(tokenize(source));
    const expression = parser.parse();
    parsedExpressions.set(source, expression);
    return expression;
  }
  catch (error) {
    invalidExpressions.add(source);
    throw error;
  }
}

function evaluate(expression: Expression, values: ConditionValues): Primitive {
  switch (expression.type) {
    case 'literal':
      return expression.value;
    case 'reference': {
      const property = values[expression.key];
      if (!property)
        throw new Error(`Property "${expression.key}" is not available.`);
      return property.value;
    }
    case 'not':
      return !evaluate(expression.expression, values);
    case 'binary':
      return evaluateBinary(expression, values);
  }
}

function evaluateBinary(expression: Extract<Expression, { type: 'binary' }>, values: ConditionValues): boolean {
  const left = evaluate(expression.left, values);
  if (expression.operator === 'and')
    return Boolean(left) && Boolean(evaluate(expression.right, values));
  if (expression.operator === 'or')
    return Boolean(left) || Boolean(evaluate(expression.right, values));

  const right = evaluate(expression.right, values);
  switch (expression.operator) {
    case 'equal': return looselyEqual(left, right);
    case 'notEqual': return !looselyEqual(left, right);
    case 'strictEqual': return left === right;
    case 'strictNotEqual': return left !== right;
    case 'greater': return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'greaterEqual': return typeof left === 'number' && typeof right === 'number' && left >= right;
    case 'less': return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lessEqual': return typeof left === 'number' && typeof right === 'number' && left <= right;
    default:
      throw new Error('Unsupported comparison operator.');
  }
}

// This mirrors JavaScript's equality coercion for the only values this parser
// accepts, without executing the author-provided condition.
function looselyEqual(left: Primitive, right: Primitive): boolean {
  if (typeof left === typeof right)
    return left === right;
  if (left === null || right === null)
    return false;
  if (typeof left === 'boolean')
    return looselyEqual(Number(left), right);
  if (typeof right === 'boolean')
    return looselyEqual(left, Number(right));
  if (typeof left === 'number' && typeof right === 'string')
    return left === Number(right);
  if (typeof left === 'string' && typeof right === 'number')
    return Number(left) === right;
  return false;
}

function warnOnce(condition: string, error: unknown): void {
  if (warnedExpressions.has(condition))
    return;
  warnedExpressions.add(condition);
  console.warn('[WE Dev] Unable to evaluate property display condition; leaving it visible.', {
    condition,
    error,
  });
}

function tokenize(source: string): Token[] {
  if (source.length > MAX_EXPRESSION_LENGTH)
    throw new Error('The expression is too long.');

  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index]!)) {
      index++;
      continue;
    }
    if (tokens.length >= MAX_TOKENS)
      throw new Error('The expression contains too many tokens.');

    const rest = source.slice(index);
    const operator = matchOperator(rest);
    if (operator) {
      tokens.push(operator.token);
      index += operator.length;
      continue;
    }
    const quote = source[index]!;
    if (quote === '\'' || quote === '"') {
      const string = readString(source, index, quote);
      tokens.push({ kind: 'value', value: string.value });
      index = string.nextIndex;
      continue;
    }
    const number = /^(?:\d+\.\d*|\.\d+|\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (number) {
      tokens.push({ kind: 'value', value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const reference = /^([A-Za-z_$][\w$]*)\.value\b/.exec(rest);
    if (reference) {
      tokens.push({ kind: 'reference', value: reference[1]! });
      index += reference[0].length;
      continue;
    }
    const literal = /^(true|false|null)\b/.exec(rest);
    if (literal) {
      tokens.push({
        kind: 'value',
        value: literal[1] === 'true' ? true : literal[1] === 'false' ? false : null,
      });
      index += literal[0].length;
      continue;
    }
    throw new Error(`Unexpected token at character ${index + 1}.`);
  }
  tokens.push({ kind: 'eof' });
  return tokens;
}

function matchOperator(source: string): { length: number; token: Token } | undefined {
  const operators: Array<[string, TokenKind]> = [
    ['===', 'strictEqual'],
    ['!==', 'strictNotEqual'],
    ['>=', 'greaterEqual'],
    ['<=', 'lessEqual'],
    ['==', 'equal'],
    ['!=', 'notEqual'],
    ['&&', 'and'],
    ['||', 'or'],
    ['>', 'greater'],
    ['<', 'less'],
    ['!', 'not'],
    ['(', 'openParen'],
    [')', 'closeParen'],
  ];
  const match = operators.find(([operator]) => source.startsWith(operator));
  return match ? { length: match[0].length, token: { kind: match[1] } } : undefined;
}

function readString(source: string, start: number, quote: string): { nextIndex: number; value: string } {
  let value = '';
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]!;
    if (character === quote)
      return { nextIndex: index + 1, value };
    if (character === '\\') {
      const escaped = source[++index];
      if (escaped === undefined)
        break;
      value += escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped === 't' ? '\t' : escaped;
    }
    else {
      value += character;
    }
  }
  throw new Error('Unterminated string literal.');
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Expression {
    const expression = this.parseOr();
    if (this.current.kind !== 'eof')
      throw new Error('Unexpected trailing condition content.');
    return expression;
  }

  private parseOr(): Expression {
    return this.parseBinary(() => this.parseAnd(), ['or']);
  }

  private parseAnd(): Expression {
    return this.parseBinary(() => this.parseEquality(), ['and']);
  }

  private parseEquality(): Expression {
    return this.parseBinary(() => this.parseComparison(), ['equal', 'notEqual', 'strictEqual', 'strictNotEqual']);
  }

  private parseComparison(): Expression {
    return this.parseBinary(() => this.parseUnary(), ['greater', 'greaterEqual', 'less', 'lessEqual']);
  }

  private parseBinary(parseOperand: () => Expression, operators: TokenKind[]): Expression {
    let expression = parseOperand();
    while (operators.includes(this.current.kind)) {
      const operator = this.advance().kind;
      expression = { type: 'binary', left: expression, operator, right: parseOperand() };
    }
    return expression;
  }

  private parseUnary(): Expression {
    if (this.current.kind === 'not') {
      this.advance();
      return { type: 'not', expression: this.parseUnary() };
    }
    if (this.current.kind === 'openParen') {
      this.advance();
      const expression = this.parseOr();
      this.expect('closeParen');
      return expression;
    }
    const token = this.advance();
    if (token.kind === 'reference')
      return { type: 'reference', key: token.value as string };
    if (token.kind === 'value')
      return { type: 'literal', value: token.value as Primitive };
    throw new Error('Expected a property reference, literal, or parenthesized expression.');
  }

  private expect(kind: TokenKind): void {
    if (this.current.kind !== kind)
      throw new Error(`Expected ${kind}.`);
    this.advance();
  }

  private advance(): Token {
    const token = this.current;
    this.index++;
    return token;
  }

  private get current(): Token {
    return this.tokens[this.index] ?? { kind: 'eof' };
  }
}
