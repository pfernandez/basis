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
 * Hooks for compile-time conveniences, such as resolving symbol names into
 * precompiled subgraphs.
 *
 * @typedef {{
 *   resolveSymbol?: (
 *     graph: import('./graph.js').Graph,
 *     name: string
 *   ) => ({ graph: import('./graph.js').Graph, nodeId: string } | null)
 * }} CompileHooks
 */

/**
 * Internal marker used when desugaring `(defn ...)` forms.
 *
 * For named parameters, we want to compile variable occurrences directly into
 * `slot -> binder` pointers without an intermediate De Bruijn rewrite.
 *
 * @typedef {{ kind: 'lambda-marker', name: string }} LambdaMarker
 */

/**
 * @typedef {{ id: string, name?: string }} BinderStackEntry
 */

/**
 * @param {any} expr
 * @returns {boolean}
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

/**
 * @param {any} value
 * @returns {value is LambdaMarker}
 */
function isLambdaMarker(value) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    value.kind === 'lambda-marker' &&
    typeof value.name === 'string'
  );
}

/**
 * @param {any} marker
 * @returns {boolean}
 */
function isLambdaForm(marker) {
  return (
    (Array.isArray(marker) && marker.length === 0) ||
    isLambdaMarker(marker)
  );
}

/**
 * @param {any} expr
 * @returns {number | null}
 */
function parseDeBruijn(expr) {
  if (typeof expr !== 'string') return null;
  if (!/^#\d+$/.test(expr)) return null;
  return Number(expr.slice(1));
}

/**
 * @param {BinderStackEntry[]} stack
 * @param {string} name
 * @returns {BinderStackEntry | null}
 */
function findNamedBinder(stack, name) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const entry = stack[i];
    if (entry?.name === name) return entry;
  }
  return null;
}

/**
 * @param {import('./graph.js').Graph} graph
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
function compileEmpty(graph) {
  const { graph: nextGraph, id } = addNode(graph, { kind: 'empty' });
  return { graph: nextGraph, nodeId: id };
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} binderId
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
function compileSlot(graph, binderId) {
  const { graph: nextGraph, id } = addNode(graph, { kind: 'slot', binderId });
  return { graph: nextGraph, nodeId: id };
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {any} value
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
function compileSymbol(graph, value) {
  const { graph: nextGraph, id } = addNode(graph, {
    kind: 'symbol',
    label: String(value),
  });
  return { graph: nextGraph, nodeId: id };
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} leftId
 * @param {string} rightId
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
function compilePair(graph, leftId, rightId) {
  const { graph: nextGraph, id } = addNode(graph, {
    kind: 'pair',
    children: [leftId, rightId],
  });
  return { graph: nextGraph, nodeId: id };
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {any} bodyExpr
 * @param {BinderStackEntry[]} stack
 * @param {string | null} binderName
 * @param {CompileHooks} hooks
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
function compileLambda(graph, bodyExpr, stack, binderName, hooks) {
  const binder = addNode(graph, { kind: 'binder', valueId: null });
  const binderId = binder.id;
  const nextStack = [...stack, { id: binderId, name: binderName ?? undefined }];
  const body = buildGraphFromSexpr(binder.graph, bodyExpr, nextStack, hooks);
  return compilePair(body.graph, binderId, body.nodeId);
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {any} leftExpr
 * @param {any} rightExpr
 * @param {BinderStackEntry[]} stack
 * @param {CompileHooks} hooks
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
function compileApplication(graph, leftExpr, rightExpr, stack, hooks) {
  const left = buildGraphFromSexpr(graph, leftExpr, stack, hooks);
  const right = buildGraphFromSexpr(left.graph, rightExpr, stack, hooks);
  return compilePair(right.graph, left.nodeId, right.nodeId);
}

/**
 * Build the graph representation for an expression.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {any} expr
 * @param {BinderStackEntry[]} stack
 * @param {CompileHooks} [hooks]
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
export function buildGraphFromSexpr(graph, expr, stack, hooks = {}) {
  if (isNil(expr)) return compileEmpty(graph);

  if (Array.isArray(expr)) {
    invariant(expr.length === 2, 'Pairs must have exactly two elements');
    const marker = expr[0];

    if (isLambdaForm(marker)) {
      const binderName = isLambdaMarker(marker) ? marker.name : null;
      return compileLambda(graph, expr[1], stack, binderName, hooks);
    }

    return compileApplication(graph, expr[0], expr[1], stack, hooks);
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

    if (typeof hooks.resolveSymbol === 'function') {
      const resolved = hooks.resolveSymbol(graph, expr);
      if (resolved) return resolved;
    }
  }

  return compileSymbol(graph, expr);
}
