/**
 * Graph serializer (debug/test readout)
 * ------------------------------------
 *
 * Converts a pointer graph back into a Lisp-ish S-expression string.
 *
 * Notes:
 * - `binder` and `empty` render as `()` because binders are operational-only.
 * - Slots normally render as `#n` computed from the surrounding lambda
 *   structure, but if a slot's binder is bound (`valueId`), we serialize the
 *   bound value
 *   instead. This matches indirection-based binding (call-by-need style) and
 *   keeps tests readable.
 * - Cycles serialize as `#cycle` to avoid infinite recursion while debugging.
 */

import { getNode } from './graph.js';
import { isLambdaPair, pairChildren } from './patterns.js';
import { invariant } from '../utils.js';

function slotIndex(binderStack, binderId) {
  const index = binderStack.lastIndexOf(binderId);
  if (index === -1) return null;
  return binderStack.length - 1 - index;
}

function nodeToAst(graph, nodeId, binderStack, seenNodeIds) {
  if (seenNodeIds.has(nodeId)) return '#cycle';

  const nextSeen = new Set(seenNodeIds);
  nextSeen.add(nodeId);

  const node = getNode(graph, nodeId);
  switch (node.kind) {
    case 'pair': {
      const [leftId, rightId] = pairChildren(node);
      if (isLambdaPair(graph, nodeId)) {
        // Lambda pair: `(() body)` where the binder itself is operational-only.
        const body = nodeToAst(
          graph,
          rightId,
          [...binderStack, leftId],
          nextSeen,
        );
        return [[], body];
      }
      return [
        nodeToAst(graph, leftId, binderStack, nextSeen),
        nodeToAst(graph, rightId, binderStack, nextSeen),
      ];
    }
    case 'symbol':
      return node.label ?? '#sym';
    case 'slot': {
      const binderId = node.binderId;
      if (typeof binderId !== 'string') return '#free';

      const binder = getNode(graph, binderId);
      if (binder.kind === 'binder' && typeof binder.valueId === 'string') {
        return nodeToAst(graph, binder.valueId, binderStack, nextSeen);
      }

      const index = slotIndex(binderStack, binderId);
      return typeof index === 'number' ? `#${index}` : '#free';
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
  invariant(
    graph && typeof graph === 'object',
    'serializeGraph requires a graph',
  );
  invariant(typeof rootId === 'string', 'serializeGraph requires a rootId');
  return astToString(nodeToAst(graph, rootId, [], new Set()));
}
