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
  assert.equal(render('((TRUE a) b)'), 'a');
});

test('FALSE selects the second argument', () => {
  assert.equal(render('((FALSE a) b)'), 'b');
});

test('NOT flips booleans', () => {
  assert.equal(render('(((NOT TRUE) a) b)'), 'b');
  assert.equal(render('(((NOT FALSE) a) b)'), 'a');
});

test('AND and OR behave like boolean algebra', () => {
  assert.equal(render('((((AND TRUE) FALSE) a) b)'), 'b');
  assert.equal(render('((((OR FALSE) TRUE) a) b)'), 'a');
});

test('LEFT returns its left operand', () => {
  assert.equal(render('((LEFT foo) bar)'), 'foo');
});

test('RIGHT returns its right operand', () => {
  assert.equal(render('((RIGHT foo) bar)'), 'bar');
});

test('SELF returns its argument', () => {
  assert.equal(render('(SELF z)'), 'z');
});

test('C flips argument order and W duplicates arguments', () => {
  assert.equal(render('(((C K) a) b)'), 'b');
  assert.equal(render('((W K) a)'), 'a');
});

test('ADD composes numerals (1 + 2 = 3)', () => {
  assert.equal(render('((((ADD ONE) TWO) f) x)'), '(f (f (f x)))');
});

test('SUCC and MUL terminate under full reduction', () => {
  assert.doesNotThrow(() => render('(((SUCC ZERO) f) x)'));
  assert.doesNotThrow(() => render('((((MUL TWO) TWO) f) x)'));
});

test('SUCC increments numerals', () => {
  assert.equal(render('(((SUCC ONE) f) x)'), '(f (f x))');
  assert.equal(render('(((SUCC ZERO) f) x)'), '(f x)');
});

test('MUL multiplies numerals (2 * 2 = 4)', () => {
  assert.equal(render('((((MUL TWO) TWO) f) x)'), '(f (f (f (f x))))');
});

test('S duplicates the context structure', () => {
  assert.equal(render('(((S a) b) c)'), '((a c) (b c))');
});

test('B threads arguments (B K SELF a -> K (SELF a))', () => {
  assert.equal(render('(((B K) SELF) a)'), '(() a)');
});

test('PAIR, FIRST, and SECOND encode and decode data', () => {
  assert.equal(render('(((PAIR a) b) LEFT)'), 'a');
  assert.equal(render('(((PAIR a) b) RIGHT)'), 'b');
  assert.equal(render('(FIRST ((PAIR a) b))'), 'a');
  assert.equal(render('(SECOND ((PAIR a) b))'), 'b');
});

test('Church numerals evaluate to expected action counts', () => {
  assert.equal(render('((ZERO f) x)'), 'x');
  assert.equal(render('((ONE f) x)'), '(f x)');
  assert.equal(render('((TWO f) x)'), '(f (f x))');
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
