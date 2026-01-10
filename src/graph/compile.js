/**
 * S-expression compiler (syntax → substrate)
 * -----------------------------------------
 *
 * This module translates a minimal S-expression AST into the pointer-graph
 * substrate defined in `graph.js`.
 *
 * This is *not* part of the core machine dynamics. It is a convenience layer
 * that lets us author terms as lists/atoms and compile them into nodes with
 * explicit binder/slot pointers.
 */

import { addNode } from './graph.js';
import { invariant } from '../utils.js';

/**
 * Internal marker used when desugaring `(defn ...)` forms.
 *
 * For named parameters, we want to compile variable occurrences directly into
 * `slot -> binder` pointers without an intermediate De Bruijn rewrite.
 *
 * @typedef {{ kind: 'lambda-marker', name: string }} LambdaMarker
 */

function isNil(expr) {
  return expr === null || (Array.isArray(expr) && expr.length === 0);
}

/**
 * @param {string} name
 * @returns {LambdaMarker}
 */
export function lambdaMarker(name) {
  return { kind: 'lambda-marker', name };
}

function isLambdaMarker(value) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    value.kind === 'lambda-marker' &&
    typeof value.name === 'string'
  );
}

function isLambdaForm(marker) {
  return (
    (Array.isArray(marker) && marker.length === 0) ||
    isLambdaMarker(marker)
  );
}

function parseDeBruijn(expr) {
  if (typeof expr !== 'string') return null;
  if (!/^#\d+$/.test(expr)) return null;
  return Number(expr.slice(1));
}

function findNamedBinder(stack, name) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const entry = stack[i];
    if (entry?.name === name) return entry;
  }
  return null;
}

function compileEmpty(graph) {
  const { graph: nextGraph, id } = addNode(graph, { kind: 'empty' });
  return { graph: nextGraph, nodeId: id };
}

function compileSlot(graph, binderId) {
  const { graph: nextGraph, id } = addNode(graph, { kind: 'slot', binderId });
  return { graph: nextGraph, nodeId: id };
}

function compileSymbol(graph, value) {
  const { graph: nextGraph, id } = addNode(graph, {
    kind: 'symbol',
    label: String(value),
  });
  return { graph: nextGraph, nodeId: id };
}

function compilePair(graph, leftId, rightId) {
  const { graph: nextGraph, id } = addNode(graph, {
    kind: 'pair',
    children: [leftId, rightId],
  });
  return { graph: nextGraph, nodeId: id };
}

function compileLambda(graph, bodyExpr, stack, binderName) {
  const binder = addNode(graph, { kind: 'binder', valueId: null });
  const binderId = binder.id;
  const nextStack = [...stack, { id: binderId, name: binderName ?? undefined }];
  const body = buildGraphFromSexpr(binder.graph, bodyExpr, nextStack);
  return compilePair(body.graph, binderId, body.nodeId);
}

function compileApplication(graph, leftExpr, rightExpr, stack) {
  const left = buildGraphFromSexpr(graph, leftExpr, stack);
  const right = buildGraphFromSexpr(left.graph, rightExpr, stack);
  return compilePair(right.graph, left.nodeId, right.nodeId);
}

/**
 * Build the graph representation for an expression.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {any} expr
 * @param {{ id: string, name?: string }[]} stack
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
export function buildGraphFromSexpr(graph, expr, stack) {
  if (isNil(expr)) return compileEmpty(graph);

  if (Array.isArray(expr)) {
    invariant(expr.length === 2, 'Pairs must have exactly two elements');
    const marker = expr[0];

    if (isLambdaForm(marker)) {
      const binderName = isLambdaMarker(marker) ? marker.name : null;
      return compileLambda(graph, expr[1], stack, binderName);
    }

    return compileApplication(graph, expr[0], expr[1], stack);
  }

  if (typeof expr === 'string') {
    const depth = parseDeBruijn(expr);
    if (typeof depth === 'number') {
      const binder = stack[stack.length - 1 - depth];
      invariant(binder, `Unbound slot reference ${expr}`);
      return compileSlot(graph, binder.id);
    }

    const named = findNamedBinder(stack, expr);
    if (named) return compileSlot(graph, named.id);
  }

  return compileSymbol(graph, expr);
}
