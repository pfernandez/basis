#!/usr/bin/env node
import { readFileSync } from 'node:fs';
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
 * In this version, those Dyck shapes are loaded from an external Lisp file so
 * that we can experiment with deriving everything from the base leaf `()`.
 * See `programs/sk-basis.lisp` for the canonical construction using only
 * `(node … …)` and the leaf. Expressions are written in a tiny Lisp syntax:
 * `(f a b c)` means (((f a) b) c) and identifiers other than I/K/S are treated
 * as variables.
 * Reduction uses normal-order SK rules so we can demonstrate identities such
 * as K a b → a and S K K → I.
 */

const combinatorDyck = new Map();

const COMBINATOR_NAMES = new Set(['I', 'K', 'S']);

const TYPE = {
  APP: 'app',
  COMB: 'comb',
  VAR: 'var',
};

const App = (fn, arg) => ({ type: TYPE.APP, fn, arg });
const Comb = (name) => ({ type: TYPE.COMB, name });
const Var = (name) => ({ type: TYPE.VAR, name });

const Leaf = null;
const Node = (L, R) => ({ L, R });

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
  if (expr.type === TYPE.COMB && combinatorDyck.has(expr.name)) {
    return combinatorDyck.get(expr.name);
  }
  return null;
}

function serializeTree(tree) {
  if (tree === Leaf) return '()';
  return `(${serializeTree(tree.L)}${serializeTree(tree.R)})`;
}

function sanitizeSource(source) {
  return source.replace(/;.*$/gm, '').trim();
}

function tokenizeDefs(source) {
  return sanitizeSource(source).match(/[()]|[^\s()]+/g) ?? [];
}

function readAllForms(tokens) {
  const forms = [];
  let index = 0;

  function read() {
    const token = tokens[index++];
    if (token === undefined) {
      throw new Error('Unexpected end of definitions while reading');
    }
    if (token === '(') {
      const list = [];
      while (tokens[index] !== ')' && index < tokens.length) {
        list.push(read());
      }
      if (tokens[index] !== ')') {
        throw new Error('Missing ) in definition');
      }
      index += 1; // consume ')'
      return list;
    }
    if (token === ')') {
      throw new Error('Unexpected ) in definition');
    }
    return token;
  }

  while (index < tokens.length) {
    forms.push(read());
  }
  return forms;
}

function evalTreeExpr(expr, env) {
  if (Array.isArray(expr)) {
    if (expr.length === 0) {
      return Leaf; // () literal
    }
    const [op, ...rest] = expr;
    if (op === 'node') {
      if (rest.length !== 2) {
        throw new Error('(node left right) expects exactly two arguments');
      }
      const left = evalTreeExpr(rest[0], env);
      const right = evalTreeExpr(rest[1], env);
      return Node(left, right);
    }
    if (op === 'def') {
      throw new Error('Nested def is not allowed');
    }
    throw new Error(`Unknown operator in definition: ${op}`);
  }
  if (expr === 'leaf') return Leaf;
  if (env.has(expr)) return env.get(expr);
  throw new Error(`Unknown symbol in definition: ${expr}`);
}

function loadCombinatorDefinitions(path, { reset = true } = {}) {
  const source = readFileSync(path, 'utf8');
  const tokens = tokenizeDefs(source);
  const forms = readAllForms(tokens);
  const env = new Map();

  if (reset) combinatorDyck.clear();

  forms.forEach((form) => {
    if (!Array.isArray(form) || form.length !== 3 || form[0] !== 'def') {
      throw new Error('Each top-level form must be (def NAME EXPR)');
    }
    const [, name, expr] = form;
    const tree = evalTreeExpr(expr, env);
    env.set(name, tree);
    combinatorDyck.set(name, serializeTree(tree));
  });

  return env;
}

function runCli() {
  const defsArg = process.argv.find(arg => arg.startsWith('--defs='));
  const defsPath = defsArg
    ? defsArg.slice('--defs='.length)
    : fileURLToPath(new URL('../programs/sk-basis.lisp', import.meta.url));
  loadCombinatorDefinitions(defsPath);

  const samples = process.argv
    .slice(2)
    .filter(arg => !arg.startsWith('--defs='));
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
  loadCombinatorDefinitions,
  combinatorDyck,
};
