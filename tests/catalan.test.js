import test from 'node:test';
import assert from 'node:assert/strict';
import { dyck, pairs, motzkin } from '../src/catalan/catalan.js';
import { dyckToTree, renderTree } from '../src/catalan/bijection.js';

const catalanNumbers = [1, 1, 2, 5, 14, 42];
const motzkinNumbers = [1, 1, 2, 4, 9, 21];

function verifySequence(generator, expectedCounts, description) {
  expectedCounts.forEach((count, n) => {
    const produced = generator(n);
    assert.equal(
      produced.length,
      count,
      `${description} count mismatch at n=${n}`,
    );
    assert.equal(
      new Set(produced).size,
      produced.length,
      `${description} duplicates detected at n=${n}`,
    );
  });
}

test('Dyck enumerator matches Catalan numbers for n = 0..5', () => {
  verifySequence(dyck, catalanNumbers, 'dyck');
  assert.deepEqual(dyck(0), ['']);
});

test('Catalan tree enumerator matches pairs counts for n = 0..5', () => {
  verifySequence(pairs, catalanNumbers, 'pairs');
  assert.deepEqual(pairs(0), ['()']);
});

test('pairs enumeration matches dyck-induced order for n = 0..6', () => {
  for (let n = 0; n <= 6; n += 1) {
    const mapped = dyck(n).map(word => renderTree(dyckToTree(word)));
    assert.deepEqual(pairs(n), mapped, `pairs order mismatch at n=${n}`);
  }
});

test('Motzkin enumerator matches Motzkin numbers for n = 0..5', () => {
  verifySequence(motzkin, motzkinNumbers, 'motzkin');
  assert.deepEqual(motzkin(2), ['((()))', '(()())']);
});
