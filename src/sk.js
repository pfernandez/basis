#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

/*
 * SK collapse playground
 * ----------------------
 * We model the classic SK basis using the same Dyck encodings that appear
 * elsewhere in the project:
 *   I ≡ (()())
 *   K ≡ ((()())())
 *   S ≡ (((()())())())
 *
 * Expressions are written in a tiny Lisp syntax. `(f a b c)` means
 * (((f a) b) c) and identifiers other than I/K/S are treated as variables.
 * Reduction uses normal-order SK rules so we can demonstrate identities such
 * as K a b → a and S K K → I.
 */

const DYCK_COMBINATORS = Object.freeze({
  I: '(()())',
  K: '((()())())',
  S: '(((()())())())',
});

const COMBINATOR_NAMES = new Set(Object.keys(DYCK_COMBINATORS));

const TYPE = {
  APP: 'app',
  COMB: 'comb',
  VAR: 'var',
};

const App = (fn, arg) => ({ type: TYPE.APP, fn, arg });
const Comb = (name) => ({ type: TYPE.COMB, name });
const Var = (name) => ({ type: TYPE.VAR, name });

function tokenize(input) {
  return input.match(/[()]|[^\s()]+/g) ?? [];
}

function parse(source) {
  const tokens = tokenize(source);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume(expected) {
    const token = tokens[index++];
    if (expected && token !== expected) {
      throw new Error(`Expected ${expected} but found ${token ?? 'EOF'}`);
    }
    return token;
  }

  function parseExpr() {
    const token = consume();
    if (token === undefined) {
      throw new Error('Unexpected end of input');
    }
    if (token === '(') {
      const items = [];
      while (peek() !== ')' && peek() !== undefined) {
        items.push(parseExpr());
      }
      consume(')');
      if (items.length === 0) {
        throw new Error('Application needs at least one item');
      }
      return items.slice(1).reduce((acc, item) => App(acc, item), items[0]);
    }
    if (token === ')') {
      throw new Error('Unexpected )');
    }
    return COMBINATOR_NAMES.has(token) ? Comb(token) : Var(token);
  }

  const expr = parseExpr();
  if (index < tokens.length) {
    throw new Error(`Unexpected token: ${tokens[index]}`);
  }
  return expr;
}

function format(expr) {
  switch (expr.type) {
    case TYPE.APP:
      return `(${format(expr.fn)} ${format(expr.arg)})`;
    case TYPE.COMB:
    case TYPE.VAR:
      return expr.name;
    default:
      throw new Error(`Unknown expression type: ${expr.type}`);
  }
}

function collectArgs(expr, needed) {
  const args = [];
  let current = expr;
  while (needed > 0 && current.type === TYPE.APP) {
    args.unshift(current.arg);
    current = current.fn;
    needed -= 1;
  }
  return { head: current, args, saturated: needed === 0 };
}

function isComb(expr, name) {
  return expr.type === TYPE.COMB && expr.name === name;
}

function step(expr) {
  if (expr.type !== TYPE.APP) {
    return { expr, changed: false };
  }

  const fnStep = step(expr.fn);
  if (fnStep.changed) {
    return { expr: App(fnStep.expr, expr.arg), changed: true };
  }

  const redex = matchRedex(expr);
  if (redex) {
    return { expr: redex, changed: true };
  }

  const argStep = step(expr.arg);
  if (argStep.changed) {
    return { expr: App(expr.fn, argStep.expr), changed: true };
  }

  return { expr, changed: false };
}

function matchRedex(expr) {
  const matchI = collectArgs(expr, 1);
  if (matchI.saturated && isComb(matchI.head, 'I')) {
    return matchI.args[0];
  }

  const matchK = collectArgs(expr, 2);
  if (matchK.saturated && isComb(matchK.head, 'K')) {
    return matchK.args[0];
  }

  const matchS = collectArgs(expr, 3);
  if (matchS.saturated && isComb(matchS.head, 'S')) {
    const [x, y, z] = matchS.args;
    return App(App(x, z), App(y, z));
  }

  return null;
}

function reduce(expr, maxSteps = 1000) {
  let current = expr;
  for (let stepCount = 0; stepCount < maxSteps; stepCount += 1) {
    const { expr: next, changed } = step(current);
    if (!changed) {
      return { expr: current, steps: stepCount };
    }
    current = next;
  }
  throw new Error('Exceeded reduction limit');
}

function expressionsEqual(a, b) {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case TYPE.COMB:
    case TYPE.VAR:
      return a.name === b.name;
    case TYPE.APP:
      return expressionsEqual(a.fn, b.fn) && expressionsEqual(a.arg, b.arg);
    default:
      return false;
  }
}

function dyckFor(expr) {
  if (expr.type === TYPE.COMB && DYCK_COMBINATORS[expr.name]) {
    return DYCK_COMBINATORS[expr.name];
  }
  return null;
}

function runCli() {
  const samples = process.argv.slice(2);
  const programs = samples.length ? samples : [
    '(I x)',
    '((K x) y)',
    '(((S K) K) z)',
    '(((S (K S)) K) x)',
  ];

  programs.forEach((source) => {
    const ast = parse(source);
    const { expr: result, steps } = reduce(ast, 2000);
    const dyck = dyckFor(result);
    console.log(`Input: ${source}`);
    console.log(`  => ${format(result)}  (steps=${steps}${dyck ? `, dyck=${dyck}` : ''})`);
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runCli();
}

export {
  parse,
  format,
  reduce,
  expressionsEqual,
  App,
  Comb,
  Var,
  DYCK_COMBINATORS,
};
