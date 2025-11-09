#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * SK collapse interpreter
 * -----------------------
 * This implementation mirrors the “pure” Catalan rule described in the docs:
 *   - The only syntax is the binary pairing operation `(left right)` plus
 *     top-level `def` forms for naming trees.
 *   - Evaluation consists solely of recursively applying the blind rewrite
 *     `(() x) → x`. No symbol ever inspects what lives inside an argument; the
 *     result is whatever remains in the focus (left spine) after collapse.
 *   - A combinator such as `K` or `S` is therefore nothing more than a Dyck
 *     tree. When we “apply” it, we substitute its definition into the larger
 *     tree, collapse, and read the focus. Direction of causality (which branch
 *     survives) is encoded entirely by the tree’s geometry.
 *
 * The code exposes this structure explicitly so the reader can see where the
 * single rule fires and how the `car` (focus) is extracted afterward.
 */

/** Sentinel object used for empty leaves. */
const EMPTY = { kind: 'empty' };

function makeBinder(id, path = '0') {
  return { kind: 'binder', id, path };
}

function makeSlot(id, binder = null, path = '0') {
  return { kind: 'slot', id, binder, path };
}

/** Return true if a node is the empty sentinel. */
function isEmpty(node) {
  return node === EMPTY || (node && (node.kind === 'empty' || node.kind === 'binder'));
}

/** Construct a structural pair (left applies to right). */
function makePair(left, right) {
  return { kind: 'pair', left, right };
}

/** Wrap a bare symbol (variable). */
function makeSymbol(name) {
  return { kind: 'symbol', name };
}

/** Count the number of internal pairs (structural potential / U) in a tree. */
function structuralPotential(node) {
  if (!node || isEmpty(node) || node.kind === 'symbol') return 0;
  if (node.kind === 'pair') {
    return 1 + structuralPotential(node.left) + structuralPotential(node.right);
  }
  return 0;
}

/** Deep-clone a tree so named definitions can be reused safely. */
function cloneTree(node) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === 'symbol') return makeSymbol(node.name);
  if (node.kind === 'slot') return makeSlot(node.id, node.binder, node.path);
  if (node.kind === 'binder') return makeBinder(node.id, node.path);
  if (node.kind === 'pair') {
    return makePair(cloneTree(node.left), cloneTree(node.right));
  }
  return EMPTY;
}

/**
 * Apply the Catalan rule recursively: drop neutral wrappers `(() x) → x`.
 * Any remaining structure is rebuilt as a pair of collapsed children.
 */
function collapse(node, options = {}) {
  if (!node || isEmpty(node)) return EMPTY;

  if (node.kind === 'pair') {
    const leftOriginal = node.left;
    const rightOriginal = node.right;
    const left = collapse(leftOriginal, options);
    const right = collapse(rightOriginal, options);

    if (options.traceGravity && isEmpty(left)) {
      const logger = options.logger ?? console.log;
      const leftOriginalPotential = structuralPotential(leftOriginal);
      const rightOriginalPotential = structuralPotential(rightOriginal);
      const leftCollapsedPotential = structuralPotential(left);
      const rightCollapsedPotential = structuralPotential(right);
      const snapshot = `(${treeToString(leftOriginal)} ${treeToString(rightOriginal)})`;
      logger(
        `[gravity] ${snapshot} -> left collapsed (U_after=${leftCollapsedPotential}) so right survives (before: L=${leftOriginalPotential}, R=${rightOriginalPotential}; after: L=${leftCollapsedPotential}, R=${rightCollapsedPotential})`,
      );
    }

    if (isEmpty(left)) {
      return right;
    }
    return makePair(left, right);
  }
  return node;
}

/** Repeatedly take `car` (left child) until a symbol/empty node is found. */
function focus(node) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === 'pair') return focus(node.left);
  return node;
}

/** Serialize a collapsed tree back into S-expression form. */
function treeToString(node) {
  if (!node || isEmpty(node)) return '()';
  if (node.kind === 'slot') return '()';
  if (node.kind === 'symbol') return node.name;
  return `(${treeToString(node.left)} ${treeToString(node.right)})`;
}

/** Tokenize a definition file, stripping comments and splitting on parens. */
function tokenize(source) {
  const stripped = source.replace(/;.*$/gm, '');
  return stripped.match(/[()]|[^\s()]+/g) ?? [];
}

/** Recursively parse tokens into an S-expression list. */
function parseTokens(tokens) {
  if (tokens.length === 0) {
    throw new Error('Unexpected EOF while parsing');
  }
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')' && tokens.length) {
      list.push(parseTokens(tokens));
    }
    if (tokens.shift() !== ')') {
      throw new Error('Missing )');
    }
    return list;
  }
  if (token === ')') {
    throw new Error('Unexpected )');
  }
  return token;
}

/** Parse a single S-expression from a source string. */
function parseSexpr(source) {
  const tokens = tokenize(source);
  if (tokens.length === 0) return null;
  const expr = parseTokens(tokens);
  if (tokens.length !== 0) {
    throw new Error('Extra input after expression');
  }
  return expr;
}

/** Convert an S-expression into our tree structure. */
function sexprToTree(expr) {
  if (expr === null || expr === undefined) return EMPTY;
  if (Array.isArray(expr)) {
    if (expr.length === 0) return EMPTY;
    if (expr.length !== 2) {
      throw new Error('Pairs must have exactly two elements');
    }
    return makePair(sexprToTree(expr[0]), sexprToTree(expr[1]));
  }
  return makeSymbol(expr);
}

function buildTemplate(expr, path = '0', state = { nextSlot: 1, nextBinder: 1, stack: [] }) {
  if (expr === null || expr === undefined) return EMPTY;
  if (Array.isArray(expr)) {
    if (expr.length === 0) {
      const binder = state.stack[state.stack.length - 1] ?? null;
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

/** Replace named symbols with their definitions by cloning from env. */
function substituteDefinitions(node, env) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === 'symbol') {
    if (env.has(node.name)) {
      return cloneTree(env.get(node.name));
    }
    return node;
  }
  if (node.kind === 'slot') return makeSlot(node.id, node.binder, node.path);
  if (node.kind === 'binder') return makeBinder(node.id, node.path);
  if (node.kind === 'pair') {
    return makePair(
      substituteDefinitions(node.left, env),
      substituteDefinitions(node.right, env),
    );
  }
  return node;
}

function findNextBinder(node, current = null) {
  if (!node) return current;
  if (node.kind === 'slot' && node.binder !== null) {
    if (current === null || node.binder < current) {
      return node.binder;
    }
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
  if (node.kind === 'binder') return makeBinder(node.id, node.path);
  return node;
}

function bindArgument(tree, argument) {
  const binderId = findNextBinder(tree, null);
  if (binderId === null) {
    return makePair(tree, argument);
  }
  return substituteBinder(tree, binderId, argument);
}

/** Load `(def name body)` forms and build the environment of trees. */
function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  const tokens = tokenize(source);
  const env = new Map();

  while (tokens.length) {
    const form = parseTokens(tokens);
    if (!Array.isArray(form) || form[0] !== 'def' || form.length !== 3) {
      throw new Error('Each form must be (def name body)');
    }
    const [, name, body] = form;
    const templateState = { nextSlot: 1, nextBinder: 1, stack: [] };
    const tree = buildTemplate(body, '0', templateState);
    const expanded = substituteDefinitions(tree, env);
    env.set(name, expanded);
  }

  env.set('S', canonicalS());
  return env;
}

// Canonical λa.λb.λc.((a c)(b c)) so the third argument re-enters both branches.
function canonicalS() {
  const binderA = 1;
  const binderB = 2;
  const binderC = 3;

  const left = makePair(
    makeSlot(1, binderA, 'a'),
    makeSlot(3, binderC, 'c-left'),
  );
  const right = makePair(
    makeSlot(2, binderB, 'b'),
    makeSlot(4, binderC, 'c-right'),
  );

  const body = makePair(left, right);
  const lambdaC = makePair(makeBinder(binderC, 'c'), body);
  const lambdaB = makePair(makeBinder(binderB, 'b'), lambdaC);
  const lambdaA = makePair(makeBinder(binderA, 'a'), lambdaB);
  return lambdaA;
}

function resolveSymbol(node, env) {
  if (!node || node.kind !== 'symbol') return node;
  if (env.has(node.name)) {
    return cloneTree(env.get(node.name));
  }
  return node;
}

function evaluateNode(node, env, options) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === 'symbol') {
    return resolveSymbol(node, env);
  }
  if (node.kind === 'pair') {
    const leftVal = evaluateNode(node.left, env, options);
    const rightVal = evaluateNode(node.right, env, options);
    const applied = bindArgument(leftVal, rightVal);
    return collapse(applied, options);
  }
  if (node.kind === 'slot') return makeSlot(node.id, node.binder, node.path);
  if (node.kind === 'binder') return makeBinder(node.id, node.path);
  return node;
}

/** Parse, substitute, collapse, and return both the collapsed tree and focus. */
function evaluateExpression(exprSource, env, options = {}) {
  const parsed = parseSexpr(exprSource);
  const tree = sexprToTree(parsed);
  const evaluated = evaluateNode(tree, env, options);
  const resultFocus = focus(evaluated);
  return { collapsed: evaluated, focus: resultFocus };
}

/** Demo runner: load definitions, evaluate sample expressions, show collapse. */
function runCli() {
  const args = process.argv.slice(2);
  const defsArg = args.find(arg => arg.startsWith('--defs='));
  const traceGravity = args.includes('--trace-gravity');
  const defsPath = defsArg
    ? defsArg.slice('--defs='.length)
    : fileURLToPath(new URL('../programs/sk-basis.lisp', import.meta.url));

  const env = loadDefinitions(defsPath);
  const inputs = args.filter(arg => !arg.startsWith('--defs=') && arg !== '--trace-gravity');

  const samples = inputs.length ? inputs : [
    '(I x)',
    '((K x) y)',
    '(((K K) K) z)',
  ];

  samples.forEach((expr) => {
    try {
      const { collapsed, focus: value } = evaluateExpression(expr, env, { traceGravity });
      console.log(`Input: ${expr}`);
      console.log(`  Collapsed: ${treeToString(collapsed)}`);
      console.log(`  Focus: ${treeToString(value)}`);
    } catch (err) {
      console.error(`Error evaluating ${expr}: ${err.message}`);
    }
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runCli();
}

export {
  tokenize,
  parseSexpr,
  sexprToTree,
  loadDefinitions,
  evaluateExpression,
  treeToString,
  collapse,
  structuralPotential,
  focus,
};
