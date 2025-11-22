import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Leaf,
  Node,
  factorDyck,
  parseTree,
  serialize,
  etaNormalizeTree,
  catalog,
  buildCoreHistogram,
  generateDyck,
  stripEtaText,
  countPairs,
} from '../src/catalan/dyck-tools.js';

const sampleTrees = [
  Leaf,
  Node(Leaf, Leaf),
  Node(Node(Leaf, Leaf), Leaf),
  Node(Leaf, Node(Leaf, Leaf)),
  Node(Node(Leaf, Leaf), Node(Leaf, Leaf)),
];

test('factorDyck splits forests and rejects imbalance', () => {
  assert.deepEqual(
    factorDyck('()()(()())'),
    ['()', '()', '(()())'],
  );
  assert.throws(() => factorDyck('(()'), /Unbalanced/);
});

test('parseTree and serialize are inverses on canonical trees', () => {
  sampleTrees.forEach((tree) => {
    const word = serialize(tree);
    const reparsed = parseTree(word);
    assert.equal(serialize(reparsed), word);
  });
});

test('countPairs reports the number of internal nodes', () => {
  const expected = [0, 1, 2, 2, 3];
  sampleTrees.forEach((tree, idx) => {
    assert.equal(countPairs(tree), expected[idx]);
  });
});

test('etaNormalizeTree removes left-empty wrappers recursively', () => {
  const wrapped = Node(Leaf, Node(Leaf, Node(Leaf, Leaf)));
  const normalized = etaNormalizeTree(wrapped);
  assert.equal(
    serialize(normalized),
    serialize(Node(Leaf, Leaf)),
  );
});

test('catalog returns primitives and η-normalized cores', () => {
  const summary = catalog('(()(()))()');
  assert.deepEqual(summary.primitives, ['(()(()))', '()']);
  assert.deepEqual(summary.coreSizes, [1, 0]);
});

test('buildCoreHistogram groups cores by size', () => {
  const words = ['()', '(())', '()()'];
  const hist = buildCoreHistogram(words);
  assert.deepEqual(hist, [
    { size: 0, count: 3 },
    { size: 1, count: 1 },
  ]);
});

test('generateDyck enumerates Catalan counts up to n=4', () => {
  const catalan = [1, 1, 2, 5, 14];
  catalan.forEach((count, n) => {
    assert.equal(generateDyck(n).length, count);
  });
});

test('stripEtaText removes textual η-wrappers for simple cases', () => {
  assert.equal(stripEtaText('(()(()()))'), '(()())');
});
