import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  format,
  reduce,
} from '../src/sk.js';

function reduceToString(source) {
  const { expr } = reduce(parse(source));
  return format(expr);
}

test('I returns its argument', () => {
  assert.equal(reduceToString('(I a)'), 'a');
});

test('K discards its second argument', () => {
  assert.equal(reduceToString('((K a) b)'), 'a');
});

test('S K K behaves like I when applied', () => {
  assert.equal(reduceToString('(((S K) K) x)'), 'x');
});

test('Parser handles multi-argument application', () => {
  assert.equal(format(parse('(S K K x)')), '(((S K) K) x)');
});
