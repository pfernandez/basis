import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphFromSexpr } from '../src/graph/compile.js';
import { createGraph, getNode } from '../src/graph/graph.js';
import {
  applyMachineEvent,
  collectEnabledEvents,
  createObserver,
  observeNormalOrder,
  stepNormalOrder,
} from '../src/graph/machine.js';
import { pairChildren } from '../src/graph/patterns.js';
import { parseSexpr } from '../src/graph/parser.js';

/**
 * Deep-freeze a value so accidental mutation throws in strict mode.
 *
 * @param {any} value
 * @param {Set<any>} [seen]
 * @returns {any}
 */
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  Object.getOwnPropertyNames(value).forEach(key => {
    deepFreeze(value[key], seen);
  });

  return Object.freeze(value);
}

/**
 * Compile an S-expression string into the pointer-graph substrate.
 *
 * @param {string} expr
 * @returns {{ graph: import('../src/graph/graph.js').Graph, rootId: string }}
 */
function compileExpr(expr) {
  const ast = parseSexpr(expr);
  const compiled = buildGraphFromSexpr(createGraph(), ast, []);
  return { graph: compiled.graph, rootId: compiled.nodeId };
}

test('observeNormalOrder never calls expandSymbol', () => {
  const compiled = compileExpr('(I z)');
  deepFreeze(compiled.graph);

  const hooks = {
    canExpandSymbol: () => true,
    expandSymbol: () => {
      throw new Error('expandSymbol should not be called by observer');
    },
  };

  const observed = observeNormalOrder(
    createObserver(compiled.rootId),
    compiled.graph,
    { reduceUnderLambdas: false },
    hooks,
  );

  assert.equal(observed.event?.kind, 'expand');
  assert.equal(observed.event?.name, 'I');
});

test('collectEnabledEvents never calls expandSymbol', () => {
  const compiled = compileExpr('(I z)');
  deepFreeze(compiled.graph);

  const hooks = {
    canExpandSymbol: () => true,
    expandSymbol: () => {
      throw new Error('expandSymbol should not be called by observer');
    },
  };

  const events = collectEnabledEvents(
    compiled.graph,
    compiled.rootId,
    { reduceUnderLambdas: false },
    hooks,
  );

  assert.equal(events[0]?.kind, 'expand');
  assert.equal(events[0]?.name, 'I');
});

test(
  'observer does not special-case symbols when expansion is disabled',
  () => {
  const compiled = compileExpr('(((S a) b) c)');
  deepFreeze(compiled.graph);

  const hooks = {
    canExpandSymbol: () => false,
    expandSymbol: () => {
      throw new Error('expandSymbol should never be called');
    },
  };

  const observed = observeNormalOrder(
    createObserver(compiled.rootId),
    compiled.graph,
    { reduceUnderLambdas: false },
    hooks,
  );

  assert.equal(observed.event, null);

  const events = collectEnabledEvents(
    compiled.graph,
    compiled.rootId,
    { reduceUnderLambdas: false },
    hooks,
  );
  assert.equal(events.length, 0);
  },
);

test('stepNormalOrder does not mutate the input graph', () => {
  const compiled = compileExpr('((() #0) a)');
  deepFreeze(compiled.graph);

  const stepped = stepNormalOrder(
    compiled.graph,
    compiled.rootId,
    { reduceUnderLambdas: false, cloneArguments: true },
    createObserver(compiled.rootId),
    {},
  );

  assert.equal(stepped.didStep, true);
  assert.notStrictEqual(stepped.graph, compiled.graph);
});

test('applyMachineEvent rejects invalid collapse events', () => {
  const compiled = compileExpr('((a b) c)');
  deepFreeze(compiled.graph);

  const root = getNode(compiled.graph, compiled.rootId);
  assert.equal(root.kind, 'pair');
  const replacementId = pairChildren(root)[1];

  /** @type {import('../src/graph/machine.js').CollapseEvent} */
  const event = {
    kind: 'collapse',
    nodeId: compiled.rootId,
    replacementId,
    path: [],
  };

  assert.throws(() => {
    applyMachineEvent(
      compiled.graph,
      compiled.rootId,
      event,
      { cloneArguments: true },
      {},
    );
  });
});

test('applyMachineEvent rejects inconsistent paths (teleportation)', () => {
  const compiled = compileExpr('((() a) (() b))');
  deepFreeze(compiled.graph);

  const root = getNode(compiled.graph, compiled.rootId);
  assert.equal(root.kind, 'pair');

  const [leftId, rightId] = pairChildren(root);
  const right = getNode(compiled.graph, rightId);
  assert.equal(right.kind, 'pair');

  /** @type {import('../src/graph/machine.js').CollapseEvent} */
  const event = {
    kind: 'collapse',
    nodeId: leftId,
    replacementId: pairChildren(right)[1],
    path: [{ kind: 'pair', parentId: compiled.rootId, index: 1 }],
  };

  assert.throws(() => {
    applyMachineEvent(
      compiled.graph,
      compiled.rootId,
      event,
      { cloneArguments: true },
      {},
    );
  });
});

test('events collected by the observer apply without extra meaning', () => {
  const compiled = compileExpr('((() #0) (I z))');
  deepFreeze(compiled.graph);

  const hooks = {
    canExpandSymbol: name => name === 'I',
    expandSymbol: (graphValue, name) => {
      if (name !== 'I') throw new Error(`Unexpected symbol: ${name}`);
      const ast = parseSexpr('(() #0)');
      return buildGraphFromSexpr(graphValue, ast, []);
    },
  };

  const events = collectEnabledEvents(
    compiled.graph,
    compiled.rootId,
    { reduceUnderLambdas: false },
    hooks,
  );

  assert.ok(events.length > 0, 'expected at least one enabled event');

  events.forEach(event => {
    assert.doesNotThrow(() => {
      applyMachineEvent(
        compiled.graph,
        compiled.rootId,
        event,
        { cloneArguments: true },
        hooks,
      );
    });
  });
});
