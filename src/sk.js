#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * SK collapse interpreter
 * -----------------------
 * Syntax: only binary pairing plus `(def name body)` definitions.
 * Evaluation: repeatedly apply the structural rewrite `(() x) → x`.
 * A combinator such as `K` or `S` is just a tree. Application means
 * substituting the tree, collapsing, and reading the left spine (“focus”).
 * This file exposes the machinery so it is clear where the lone rule fires.
 */

/** Sentinel node used everywhere the theory refers to the raw void `()`. */
const EMPTY = { kind: 'empty' };

const NODE_TYPES = {
  BINDER: 'binder',
  SLOT: 'slot',
  PAIR: 'pair',
  SYMBOL: 'symbol',
};

let binderCounter = 1;
/** Create a unique binder node so slots can point back to the same identity. */
function makeBinder() {
  return { kind: NODE_TYPES.BINDER, token: Symbol('binder'), label: binderCounter++ };
}

/** Create a slot that re-enters the supplied binder when collapse occurs. */
function makeSlot(binder) {
  return { kind: NODE_TYPES.SLOT, binder };
}

/** Return true if a node is the empty sentinel. */
function isEmpty(node) {
  return node === EMPTY || (node && node.kind === 'empty');
}

/** Construct a structural pair (left applies to right). */
function makePair(left, right) {
  return { kind: 'pair', left, right };
}

/** Wrap a bare symbol (variable). */
function makeSymbol(name) {
  return { kind: 'symbol', name };
}

/**
 * Convert an expression that still contains friendly parameter names into
 * explicit De Bruijn slots. Once desugared, every reference becomes `#n`, which
 * the template builder can translate directly into pointer-equal slots.
 */
function convertExprToDeBruijn(expr, context) {
  if (expr === null || expr === undefined) return expr;
  if (Array.isArray(expr)) {
    return expr.map(part => convertExprToDeBruijn(part, context));
  }
  if (typeof expr === 'string') {
    if (expr.startsWith('#')) return expr;
    const index = context.lastIndexOf(expr);
    if (index !== -1) {
      const depth = context.length - 1 - index;
      return `#${depth}`;
    }
  }
  return expr;
}

/**
 * Recursively wrap a body with as many binder pairs as there are parameters.
 * Each step pushes the new name into `context` so the body rewrite can locate
 * the right binder depth.
 */
function wrapParamsWithBinders(params, bodyExpr, context = []) {
  if (!params.length) {
    return convertExprToDeBruijn(bodyExpr, context);
  }
  const [first, ...rest] = params;
  if (typeof first !== 'string') {
    throw new Error('Parameter names must be symbols');
  }
  const nextContext = [...context, first];
  const inner = wrapParamsWithBinders(rest, bodyExpr, nextContext);
  return [[], inner];
}

/**
 * Transform `(defn name (params) body)` into the plain `(def name body)` form
 * using the De Bruijn conversion helpers above.
 */
function desugarDefnForm(form) {
  if (form.length !== 4) {
    throw new Error('(defn name (params) body) requires exactly 4 elements');
  }
  const [, name, paramsExpr, bodyExpr] = form;
  if (!Array.isArray(paramsExpr)) {
    throw new Error('Function parameters must be a list');
  }
  const lambdaExpr = wrapParamsWithBinders(paramsExpr, bodyExpr, []);
  return ['def', name, lambdaExpr];
}

/** Count the number of internal pairs (structural potential / U) in a tree. */
/** Measure how much “tension” lives inside a tree by counting internal pairs. */
function structuralPotential(node) {
  if (!node || isEmpty(node) || node.kind === NODE_TYPES.SYMBOL) return 0;
  if (node.kind === NODE_TYPES.PAIR) {
    return 1 + structuralPotential(node.left) + structuralPotential(node.right);
  }
  return 0;
}

/** Deep-clone a tree so named definitions can be reused safely. */
/** Deep copy a tree while preserving binder identity for every slot. */
function cloneTree(node, binderMap = new Map()) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === NODE_TYPES.SYMBOL) return makeSymbol(node.name);
  if (node.kind === NODE_TYPES.BINDER) {
    const clone = makeBinder();
    binderMap.set(node, clone);
    return clone;
  }
  if (node.kind === NODE_TYPES.SLOT) {
    const mappedBinder = binderMap.get(node.binder);
    if (!mappedBinder) {
      throw new Error('Encountered slot before binder while cloning');
    }
    return makeSlot(mappedBinder);
  }
  if (node.kind === NODE_TYPES.PAIR) {
    const leftClone = cloneTree(node.left, binderMap);
    const rightClone = cloneTree(node.right, binderMap);
    return makePair(leftClone, rightClone);
  }
  return node;
}

/**
 * Apply the Catalan rule recursively: drop neutral wrappers `(() x) → x`.
 * Any remaining structure is rebuilt as a pair of collapsed children.
 */
/**
 * Apply the single Catalan rewrite `(() x) → x`. The rest of the interpreter is
 * just scaffolding for building the trees this rule acts upon.
 */
function collapse(node, options = {}) {
  if (!node || isEmpty(node)) return EMPTY;

  if (node.kind === NODE_TYPES.PAIR) {
    const leftOriginal = node.left;
    const rightOriginal = node.right;
    const left = collapse(leftOriginal, options);
    const right = collapse(rightOriginal, options);

    if (options.traceCollapseLog && isEmpty(left)) {
      const logger = options.logger ?? console.log;
      const leftOriginalPotential = structuralPotential(leftOriginal);
      const rightOriginalPotential = structuralPotential(rightOriginal);
      const leftCollapsedPotential = structuralPotential(left);
      const rightCollapsedPotential = structuralPotential(right);
      const snapshot = `(${treeToString(leftOriginal)} ${treeToString(rightOriginal)})`;
      logger(
        `[collapse-log] ${snapshot} -> left collapsed (U_after=${leftCollapsedPotential}) so right survives (before: L=${leftOriginalPotential}, R=${rightOriginalPotential}; after: L=${leftCollapsedPotential}, R=${rightCollapsedPotential})`,
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
/** Keep following the left spine until the surviving focus is found. */
function focus(node) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === 'pair') return focus(node.left);
  return node;
}

/** Serialize a collapsed tree back into S-expression form. */
/** Convert an internal tree back into printable S-expression form. */
function treeToString(node) {
  if (!node || isEmpty(node)) return '()';
  if (node.kind === NODE_TYPES.SLOT) return '()';
  if (node.kind === NODE_TYPES.BINDER) return '()';
  if (node.kind === NODE_TYPES.SYMBOL) return node.name;
  return `(${treeToString(node.left)} ${treeToString(node.right)})`;
}

/** Tokenize a definition file, stripping comments and splitting on parens. */
/** Strip comments and break a definition file into the tokens we need. */
function tokenize(source) {
  const stripped = source.replace(/;.*$/gm, '');
  return stripped.match(/[()]|[^\s()]+/g) ?? [];
}

/** Recursively parse tokens into an S-expression list. */
/** Standard recursive-descent parser for balanced parentheses. */
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
/** Parse a whole source string into one S-expression. */
function parseSexpr(source) {
  const tokens = tokenize(source);
  if (tokens.length === 0) return null;
  const expr = parseTokens(tokens);
  if (tokens.length !== 0) {
    throw new Error('Extra input after expression');
  }
  return expr;
}

/** Convert an S-expression into a plain binary tree (used for utilities). */
/** Utility for tests: turn a parsed S-expression into a plain tree. */
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

/** Track the binder stack while translating parsed expressions into trees. */
function createTemplateState() {
  return {
    stack: [],
  };
}

/**
 * Translate an S-expression into binder/slot aware nodes. This is where `#n`
 * markers get converted into real pointers.
 */
function buildTemplate(expr, state = createTemplateState()) {
  if (expr === null || expr === undefined) return EMPTY;
  if (Array.isArray(expr)) {
    if (expr.length === 0) return EMPTY;
    if (expr.length !== 2) {
      throw new Error('Pairs must have exactly two elements');
    }
    const [leftExpr, rightExpr] = expr;
    if (Array.isArray(leftExpr) && leftExpr.length === 0) {
      const binder = makeBinder();
      state.stack.push(binder);
      const body = buildTemplate(rightExpr, state);
      state.stack.pop();
      return makePair(binder, body);
    }
    return makePair(buildTemplate(leftExpr, state), buildTemplate(rightExpr, state));
  }
  if (typeof expr === 'string' && expr.startsWith('#')) {
    const depth = Number(expr.slice(1));
    if (Number.isNaN(depth)) {
      throw new Error(`Invalid binder reference: ${expr}`);
    }
    const index = state.stack.length - 1 - depth;
    if (index < 0) {
      throw new Error(`Binder reference ${expr} exceeds scope`);
    }
    const binder = state.stack[index];
    return makeSlot(binder);
  }
  return makeSymbol(expr);
}

/** Replace named symbols with their definitions by cloning from env. */
/** Load `(def name body)` forms and build the environment of trees. */
/** Read every `(def …)` (or `(defn …)`) form and materialize binder graphs. */
function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  const tokens = tokenize(source);
  const env = new Map();

  while (tokens.length) {
    let form = parseTokens(tokens);
    if (Array.isArray(form) && form[0] === 'defn') {
      form = desugarDefnForm(form);
    }
    if (!Array.isArray(form) || form[0] !== 'def' || form.length !== 3) {
      throw new Error('Each form must be (def name body)');
    }
    const [, name, body] = form;
    const tree = buildTemplate(body, createTemplateState());
    const value = evaluateNode(tree, env, {});
    env.set(name, value);
  }
  return env;
}

/** Parse, substitute, collapse, and return both the collapsed tree and focus. */
/** Evaluate a user expression against the environment, returning collapse+focus. */
function evaluateExpression(exprSource, env, options = {}) {
  const parsed = parseSexpr(exprSource);
  const tree = buildTemplate(parsed, createTemplateState());
  const collapsed = evaluateNode(tree, env, options);
  const resultFocus = focus(collapsed);
  return { collapsed, focus: resultFocus };
}

/** Normal-order evaluation that substitutes named trees and applies collapse. */
function evaluateNode(node, env, options) {
  if (!node || isEmpty(node)) return EMPTY;
  if (node.kind === NODE_TYPES.SYMBOL) {
    if (env.has(node.name)) {
      return cloneTree(env.get(node.name));
    }
    return node;
  }
  if (node.kind === NODE_TYPES.PAIR) {
    if (node.left && node.left.kind === NODE_TYPES.BINDER) {
      // This is a lambda; leave it unevaluated (normal order).
      return node;
    }
    const leftVal = evaluateNode(node.left, env, options);
    const rightVal = evaluateNode(node.right, env, options);
    const applied = bindArgument(leftVal, rightVal, options);
    return collapse(applied, options);
  }
  return node;
}

/**
 * Apply an argument: find the next binder along the evaluation spine, replace
 * all matching slots with the cloned argument, then recur on the remainder.
 */
function bindArgument(tree, argument, options) {
  const binder = findNextBinder(tree);
  if (!binder) {
    return makePair(tree, argument);
  }
  if (process.env.SK_DEBUG_BINDER === '1') {
    console.warn('bindArgument tree', treeToString(tree));
  }
  const result = substituteBinder(tree, binder, argument, options);
  if (process.env.SK_DEBUG_BINDER === '1') {
    console.warn('bindArgument result snapshot', treeToString(result));
  }
  return result;
}

/** Locate the next binder awaiting an argument along the application spine. */
function findNextBinder(node) {
  if (!node || isEmpty(node)) return null;
  if (node.kind === NODE_TYPES.PAIR) {
    if (node.left && node.left.kind === NODE_TYPES.BINDER) {
      return node.left;
    }
    const leftSearch = findNextBinder(node.left);
    if (leftSearch) return leftSearch;
    return findNextBinder(node.right);
  }
  return null;
}

/** Replace every slot tied to `binder` with the provided argument tree. */
function substituteBinder(node, binder, argument, options) {
  if (!node) return node;
  if (node.kind === NODE_TYPES.SLOT) {
    if (node.binder === binder) {
      return cloneTree(argument);
    }
    return node;
  }
  if (node.kind === NODE_TYPES.PAIR) {
    if (node.left === binder) {
      if (options?.traceCollapseLog) {
        const logger = options.logger ?? console.log;
        const snapshot = `(${treeToString(node.left)} ${treeToString(node.right)})`;
        logger(`[collapse-log] ${snapshot} -> bound argument`);
      }
      return substituteBinder(node.right, binder, argument, options);
    }
    return makePair(
      substituteBinder(node.left, binder, argument, options),
      substituteBinder(node.right, binder, argument, options),
    );
  }
  return node;
}

/** Demo runner: load definitions, evaluate sample expressions, show collapse. */
/** CLI helper: read the default basis file and evaluate supplied expressions. */
function runCli() {
  const args = process.argv.slice(2);
  const defsArg = args.find(arg => arg.startsWith('--defs='));
  const traceCollapseLog = args.includes('--trace-collapse');
  const defsPath = defsArg
    ? defsArg.slice('--defs='.length)
    : fileURLToPath(new URL('../programs/sk-basis.lisp', import.meta.url));

  const env = loadDefinitions(defsPath);
  const inputs = args.filter(arg => !arg.startsWith('--defs=') && arg !== '--trace-collapse');

  const samples = inputs.length ? inputs : [
    '(I x)',
    '((K x) y)',
    '(((K K) K) z)',
  ];

  samples.forEach((expr) => {
    try {
      const { collapsed, focus: value } = evaluateExpression(expr, env, { traceCollapseLog });
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
