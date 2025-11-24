import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDefinitions, evaluateExpression } from '../src/graph/evaluator.js';
import { serializeGraph } from '../src/graph/serializer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadDefinitions(join(__dirname, '../programs/sk-basis.lisp'));

function render(expr) {
  const { graph, rootId } = evaluateExpression(expr, env);
  return serializeGraph(graph, rootId);
}

test('identity returns its argument', () => {
  assert.equal(render('(I z)'), 'z');
});

test('K discards the second argument', () => {
  assert.equal(render('((K a) b)'), 'a');
});

test('TRUE selects the first argument', () => {
  assert.equal(render('((true a) b)'), 'a');
});

test('FALSE selects the second argument', () => {
  assert.equal(render('((false a) b)'), 'b');
});

test('NOT flips booleans', () => {
  assert.equal(render('(((not true) a) b)'), 'b');
  assert.equal(render('(((not false) a) b)'), 'a');
});

test('AND and OR behave like boolean algebra', () => {
  assert.equal(render('((((and true) false) a) b)'), 'b');
  assert.equal(render('((((or false) true) a) b)'), 'a');
});

test('LEFT returns its left operand', () => {
  assert.equal(render('((left foo) bar)'), 'foo');
});

test('RIGHT returns its right operand', () => {
  assert.equal(render('((right foo) bar)'), 'bar');
});

test('SELF returns its argument', () => {
  assert.equal(render('(self z)'), 'z');
});

test('C flips argument order and W duplicates arguments', () => {
  assert.equal(render('(((flip K) a) b)'), 'b');
  assert.equal(render('((split K) a)'), 'a');
});

test('ADD composes numerals (1 + 2 = 3)', () => {
  assert.equal(render('((((add one) two) f) x)'), '(f (f (f x)))');
});

test('SUCC and MUL terminate under full reduction', () => {
  assert.doesNotThrow(() => render('(((succ zero) f) x)'));
  assert.doesNotThrow(() => render('((((mul two) two) f) x)'));
});

test('S duplicates the context structure', () => {
  assert.equal(render('(((S a) b) c)'), '((a c) (b c))');
});

test('B threads arguments (B K SELF a -> K (SELF a))', () => {
  assert.equal(render('(((B K) self) a)'), '(() a)');
});

test('PAIR, FIRST, and SECOND encode and decode data', () => {
  assert.equal(render('(((pair a) b) left)'), 'a');
  assert.equal(render('(((pair a) b) right)'), 'b');
  assert.equal(render('(first ((pair a) b))'), 'a');
  assert.equal(render('(second ((pair a) b))'), 'b');
});

test('curry and uncurry bridge pairs and binary functions', () => {
  assert.equal(render('(((curry first) a) b)'), 'a');
  assert.equal(render('((uncurry left) ((pair a) b))'), 'a');
  assert.equal(render('(((curry second) a) b)'), 'b');
  assert.equal(render('((uncurry right) ((pair a) b))'), 'b');
});

test('Church numerals evaluate to expected action counts', () => {
  assert.equal(render('((zero f) x)'), 'x');
  assert.equal(render('((one f) x)'), '(f x)');
  assert.equal(render('((two f) x)'), '(f (f x))');
});

test('is-zero on numerals', () => {
  assert.equal(render('(((is-zero zero) a) b)'), 'a');
  assert.equal(render('(((is-zero one) a) b)'), 'b');
});

test('thunked if selects only one branch', () => {
  assert.equal(render('((((if true) (K a)) (K b)) z)'), 'a');
  assert.equal(render('((((if false) (K a)) (K b)) z)'), 'b');
});

test('APPLY-SELF and THETA behave under applicative order', () => {
  assert.equal(render('((apply-self K) a)'), '(() (() #1))'); // K
  assert.equal(render('((theta (K a)) b)'), 'a');
});

test('Z builds an applicative fixpoint for contractive functions', () => {
  assert.equal(render('(fix (K a))'), 'a');
  assert.equal(render('((fix (K a)) b)'), '(a b)');
});

test('trace snapshots capture re-entry links', () => {
  const snapshots = [];
  evaluateExpression('(I a)', env, {
    tracer: snapshot => snapshots.push(snapshot),
  });
  assert.ok(
    snapshots.some(snap => Array.isArray(snap.graph.links) && snap.graph.links.length > 0),
    'expected at least one snapshot with re-entry links',
  );
});
