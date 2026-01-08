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
