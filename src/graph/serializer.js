import { getNode } from './graph.js';
import { invariant } from '../utils.js';

function nodeToAst(graph, nodeId) {
  const node = getNode(graph, nodeId);
  switch (node.kind) {
    case 'pair':
      invariant(
        Array.isArray(node.children) && node.children.length === 2,
        'pair nodes must have two children',
      );
      return node.children.map(child => nodeToAst(graph, child));
    case 'symbol':
    case 'slot':
      return node.label;
    case 'cell':
      return node.valueId ? nodeToAst(graph, node.valueId) : [];
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
