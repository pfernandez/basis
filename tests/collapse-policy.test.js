import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollapsePolicy, COLLAPSE_MODES } from '../src/catalan/collapse-policy.js';

const Leaf = null;
const Node = (L, R) => ({ L, R });
const countPairs = (t) => (t ? 1 + countPairs(t.L) + countPairs(t.R) : 0);

const bigLeft = Node(Node(Leaf, Leaf), Leaf); // left size 2, right size 1

const balanced = Node(Node(Leaf, Leaf), Node(Leaf, Leaf));

const randomHigh = () => 0.99;
const randomLow = () => 0.0;

test('heavier policy keeps the larger subtree and occasionally the lighter one', () => {
  const collapse = createCollapsePolicy(countPairs, {
    mode: COLLAPSE_MODES.HEAVIER,
    lighterChance: 0,
    random: randomHigh,
  });
  const result = collapse(bigLeft);
  assert.equal(result, bigLeft.L);

  const collapseLighter = createCollapsePolicy(countPairs, {
    mode: COLLAPSE_MODES.HEAVIER,
    lighterChance: 1,
    random: randomLow,
  });
  const lighterResult = collapseLighter(bigLeft);
  assert.equal(lighterResult, bigLeft.R);
});

test('left/right policies deterministically choose a side', () => {
  const leftPolicy = createCollapsePolicy(countPairs, { mode: COLLAPSE_MODES.LEFT });
  const rightPolicy = createCollapsePolicy(countPairs, { mode: COLLAPSE_MODES.RIGHT });
  assert.equal(leftPolicy(bigLeft), bigLeft.L);
  assert.equal(rightPolicy(bigLeft), bigLeft.R);
});

test('freezeBalanced keeps nodes whose children are within the threshold', () => {
  const freezePolicy = createCollapsePolicy(countPairs, {
    freezeBalanced: true,
    balanceThreshold: 0,
  });
  assert.equal(freezePolicy(balanced), balanced);
});
