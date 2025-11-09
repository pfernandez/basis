#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * SK Lab
 * ------
 * Experimental interpreter that tags every empty pair with a "slot" identifier
 * so we can keep future branches entangled. The goal is to explore slot/binder
 * strategies without destabilising src/sk.js.
 */

const EMPTY = { kind: 'empty' };

function isEmpty(node) {
  return node === EMPTY || (node && (node.kind === 'empty' || node.kind === 'binder'));
}

function makePair(left, right, meta = {}) {
  return { kind: 'pair', left, right, ...meta };
}

function makeSymbol(name) {
  return { kind: 'symbol', name };
}

function makeSlot(id, binder, path) {
  return { kind: 'slot', id, binder, path };
}

function makeBinder(id, path) {
  return { kind: 'binder', id, path };
}

function canonicalS() {
  const aSlot = makeSlot(1, 1, 'a-slot');
  const bSlot = makeSlot(2, 2, 'b-slot');
  const cSlotL = makeSlot(3, 3, 'c-slot-left');
  const cSlotR = makeSlot(4, 3, 'c-slot-right');

  const left = makePair(aSlot, cSlotL);
  const right = makePair(bSlot, cSlotR);
  const body = makePair(left, right);

  const lambdaC = makePair(makeBinder(3, 'binder-c'), body);
  const lambdaB = makePair(makeBinder(2, 'binder-b'), lambdaC);
  const lambdaA = makePair(makeBinder(1, 'binder-a'), lambdaB);
  return lambdaA;
}

function treeToString(node) {
  if (!node || isEmpty(node)) return '()';
  if (node.kind === 'symbol') return node.name;
  if (node.kind === 'slot') return `⟨slot:${node.id}@${node.binder ?? '-'}⟩`;
  if (node.kind === 'binder') return `⟨binder:${node.id}⟩`;
  return `(${treeToString(node.left)} ${treeToString(node.right)})`;
}

function tokenize(source) {
  const stripped = source.replace(/;.*$/gm, '');
  return stripped.match(/[()]|[^\s()]+/g) ?? [];
}

function parseTokens(tokens) {
  if (tokens.length === 0) throw new Error('Unexpected EOF');
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')' && tokens.length) {
      list.push(parseTokens(tokens));
    }
    if (tokens.shift() !== ')') throw new Error('Missing )');
    return list;
  }
  if (token === ')') throw new Error('Unexpected )');
  return token;
}

function parseSexpr(source) {
  const tokens = tokenize(source);
  if (!tokens.length) return null;
  const expr = parseTokens(tokens);
  if (tokens.length) throw new Error('Extra tokens after expression');
  return expr;
}

function buildTemplate(expr, path = '0', state) {
  if (expr === null || expr === undefined) return EMPTY;
  if (Array.isArray(expr)) {
    if (expr.length === 0) {
      const binder = state.stack.at(-1) ?? null;
      return makeSlot(state.nextSlot++, binder, path);
    }
    if (expr.length !== 2) {
      throw new Error('Pairs must have exactly two elements');
    }
    const [leftExpr, rightExpr] = expr;
    if (Array.isArray(leftExpr) && leftExpr.length === 0) {
      const binderId = state.nextBinder++;
      state.stack.push(binderId);
      const body = buildTemplate(rightExpr, `${path}R`, state);
      state.stack.pop();
      return makePair(makeBinder(binderId, `${path}L`), body);
    }
    const left = buildTemplate(leftExpr, `${path}L`, state);
    const right = buildTemplate(rightExpr, `${path}R`, state);
    return makePair(left, right);
  }
  return makeSymbol(expr);
}

function cloneTree(node) {
  if (!node) return EMPTY;
  if (node.kind === 'symbol') return makeSymbol(node.name);
  if (node.kind === 'slot') return makeSlot(node.id, node.binder, node.path);
  if (node.kind === 'binder') return makeBinder(node.id, node.path);
  if (node.kind === 'pair') return makePair(cloneTree(node.left), cloneTree(node.right));
  return EMPTY;
}

function expandDefinitions(node, env) {
  if (!node) return EMPTY;
  if (node.kind === 'symbol') {
    if (env.has(node.name)) {
      return cloneTree(env.get(node.name));
    }
    return makeSymbol(node.name);
  }
  if (node.kind === 'pair') {
    return makePair(
      expandDefinitions(node.left, env),
      expandDefinitions(node.right, env),
    );
  }
  if (node.kind === 'slot') return makeSlot(node.id, node.binder, node.path);
  if (node.kind === 'binder') return makeBinder(node.id, node.path);
  return EMPTY;
}

function findNextBinder(node, current = null) {
  if (!node) return current;
  if (node.kind === 'slot' && node.binder !== null) {
    if (current === null || node.binder < current) return node.binder;
    return current;
  }
  if (node.kind === 'pair') {
    const left = findNextBinder(node.left, current);
    return findNextBinder(node.right, left);
  }
  return current;
}

function substituteBinder(node, binderId, argument) {
  if (!node) return node;
  if (node.kind === 'slot' && node.binder === binderId) {
    return cloneTree(argument);
  }
  if (node.kind === 'pair') {
    return makePair(
      substituteBinder(node.left, binderId, argument),
      substituteBinder(node.right, binderId, argument),
    );
  }
  if (node.kind === 'symbol') return makeSymbol(node.name);
  if (node.kind === 'slot') return makeSlot(node.id, node.binder, node.path);
  return node;
}

function apply(tree, argument) {
  const binderId = findNextBinder(tree, null);
  if (binderId === null) {
    return makePair(tree, argument);
  }
  return substituteBinder(tree, binderId, argument);
}

function collapse(node) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === 'pair') {
    const left = collapse(node.left);
    const right = collapse(node.right);
    if (isEmpty(left)) return right;
    return makePair(left, right);
  }
  return node;
}

function resolveSymbol(node, env) {
  if (!node || node.kind !== 'symbol') return node;
  if (!env.has(node.name)) return node;
  return cloneTree(env.get(node.name));
}

function evaluate(node, env) {
  if (!node || node.kind === 'empty') return EMPTY;
  if (node.kind === 'symbol') return resolveSymbol(node, env);
  if (node.kind === 'pair') {
    const op = evaluate(node.left, env);
    const arg = evaluate(node.right, env);
    const applied = apply(op, arg);
    return collapse(applied);
  }
  return node;
}

function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  const tokens = tokenize(source);
  const env = new Map();
  while (tokens.length) {
    const form = parseTokens(tokens);
    if (!Array.isArray(form) || form[0] !== 'def') {
      throw new Error('Expected (def name body)');
    }
    const [, name, body] = form;
    const state = { nextSlot: 1, nextBinder: 1, stack: [] };
    const tree = buildTemplate(body, '0', state);
    const expanded = expandDefinitions(tree, env);
    env.set(name, expanded);
  }
  return env;
}

function runCli() {
  const args = process.argv.slice(2);
  const canonical = args.includes('--canonical-s');
  const expr = args.find(arg => !arg.startsWith('--')) ?? '(((S a) b) c)';

  const defsPath = fileURLToPath(new URL('../programs/sk-basis.lisp', import.meta.url));
  const env = loadDefinitions(defsPath);
  if (canonical) {
    env.set('S', canonicalS());
  }
  const parsed = parseSexpr(expr);
  const tree = buildTemplate(parsed, '0', { nextSlot: 1, nextBinder: 1, stack: [] });
  const result = evaluate(tree, env);
  console.log('Input :', expr, canonical ? '(canonical S)' : '');
  console.log('Output:', treeToString(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}

export {
  tokenize,
  parseSexpr,
  buildTemplate,
  loadDefinitions,
  evaluate,
  treeToString,
};
