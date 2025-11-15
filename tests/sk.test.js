import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  loadDefinitions,
  evaluateExpression,
  treeToString,
  structuralPotential,
  parseSexpr,
  sexprToTree,
} from '../src/sk.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load a single shared environment so every test exercises the same pointer
// graphs produced from `programs/sk-basis.lisp`.
const env = loadDefinitions(join(__dirname, '../programs/sk-basis.lisp'));

function evaluateCollapsed(expr) {
  const { collapsed } = evaluateExpression(expr, env);
  return treeToString(collapsed);
}

test('I returns its argument', () => {
  assert.equal(evaluateCollapsed('(I a)'), 'a');
});

test('K exposes its first argument at the focus', () => {
  assert.equal(evaluateCollapsed('((K a) b)'), 'a');
});

test('S duplicates the context structure', () => {
  assert.equal(evaluateCollapsed('(((S a) b) c)'), '((a c) (b c))');
});

test('TRUE and FALSE select the expected branch', () => {
  assert.equal(evaluateCollapsed('((TRUE a) b)'), 'a');
  assert.equal(evaluateCollapsed('((FALSE a) b)'), 'b');
});

// `defn` is just syntactic sugar; these assertions prove parameter naming and
// repeated argument references survive the desugaring step.
test('defn sugar handles positional and repeated arguments', () => {
  assert.equal(evaluateCollapsed('((LEFT a) b)'), 'a');
  assert.equal(evaluateCollapsed('((RIGHT a) b)'), 'b');
  assert.equal(evaluateCollapsed('(SELF a)'), 'a');
});

test('structural potential counts internal pairs (gravitational U)', () => {
  const expr = '(() (() ()))';
  const tree = sexprToTree(parseSexpr(expr));
  assert.equal(structuralPotential(tree), 2);
});

test('gravity trace describes why (() x) collapses to x', () => {
  const logs = [];
  evaluateExpression('(I x)', env, {
    traceGravity: true,
    logger: message => logs.push(message),
  });
  assert.ok(
    logs.some(line => line.includes('-> bound argument')),
    `expected gravity trace to mention collapse event, saw: ${logs.join('\n')}`,
  );
});
