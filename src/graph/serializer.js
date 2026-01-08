/**
 * Graph serializer (debug/test readout)
 * ------------------------------------
 *
 * This converts a pointer graph back into a Lisp-ish S-expression string.
 *
 * Notes:
 * - `binder` and `empty` are rendered as `()` since binders are not part of the
 *   surface syntax (they are structural/operational).
 * - Slots normally render as `#n`, but if a slot's binder is bound (`valueId`),
 *   we serialize the bound value instead. This matches how the evaluator uses
 *   binders as indirections (call-by-need style) and keeps tests readable.
 * - Cycles are serialized as `#cycle` to avoid infinite recursion in debugging.
 */

import { getNode } from './graph.js';
import { invariant } from '../utils.js';

function nodeToAst(graph, nodeId, stack = new Set()) {
  if (stack.has(nodeId)) return '#cycle';
  const nextStack = new Set(stack);
  nextStack.add(nodeId);
  const node = getNode(graph, nodeId);
  switch (node.kind) {
    case 'pair':
      invariant(
        Array.isArray(node.children) && node.children.length === 2,
        'pair nodes must have two children',
      );
      return node.children.map(child => nodeToAst(graph, child, nextStack));
    case 'symbol':
      return node.label;
    case 'slot': {
      const binderId = node.binderId;
      if (typeof binderId === 'string') {
        const binder = getNode(graph, binderId);
        if (binder.kind === 'binder' && typeof binder.valueId === 'string') {
          return nodeToAst(graph, binder.valueId, nextStack);
        }
      }
      return node.label;
    }
    case 'binder':
    case 'empty':
      return [];
    default:
      throw new Error(`Unsupported node kind: ${node.kind}`);
  }
}

function astToString(ast) {
  if (Array.isArray(ast)) {
    if (ast.length === 0) return '()';
    return `(${ast.map(astToString).join(' ')})`;
  }
  return String(ast);
}

export function serializeGraph(graph, rootId) {
  invariant(graph && typeof graph === 'object', 'serializeGraph requires a graph object');
  invariant(typeof rootId === 'string', 'serializeGraph requires a rootId');
  return astToString(nodeToAst(graph, rootId));
}
