import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDefinitions, evaluateExpression } from '../src/graph/evaluator.js';
import { getNode } from '../src/graph/graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadDefinitions(join(__dirname, '../programs/sk-basis.lisp'));

function focus(expr) {
  const { graph, rootId } = evaluateExpression(expr, env);
  return getNode(graph, rootId).label;
}

function serialize(graph, nodeId) {
  const node = getNode(graph, nodeId);
  switch (node.kind) {
    case 'pair':
      return `(${serialize(graph, node.children[0])} ${serialize(graph, node.children[1])})`;
    case 'symbol':
      return node.label;
    case 'empty':
      return '()';
    default:
      return node.label ?? node.kind;
  }
}

test('identity returns its argument', () => {
  assert.equal(focus('(I z)'), 'z');
});

test('K discards the second argument', () => {
  assert.equal(focus('((K a) b)'), 'a');
});

test('S duplicates the context structure', () => {
  const { graph, rootId } = evaluateExpression('(((S a) b) c)', env);

  console.log(JSON.stringify({ graph, rootId }, null, 2));

  assert.equal(serialize(graph, rootId), '((a c) (b c))');
});
