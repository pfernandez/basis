import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  loadDefinitions,
  evaluateExpression,
} from '../src/graph/evaluator-node.js';
import { parseSexpr } from '../src/graph/parser.js';
import { createGraph } from '../src/graph/graph.js';
import { buildGraphInlinedFromSexpr } from '../src/graph/precompile.js';
import { createObserver, stepNormalOrder } from '../src/graph/machine.js';
import { serializeGraph } from '../src/graph/serializer.js';
import { compactGraph } from '../src/graph/compact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadDefinitions(join(__dirname, '../programs/sk-basis.lisp'));

/**
 * @param {import('../src/graph/graph.js').Graph} graph
 * @returns {Map<string, number>}
 */
function slotCountsByBinder(graph) {
  const counts = new Map();
  graph.nodes.forEach(node => {
    if (node.kind !== 'slot') return;
    counts.set(node.binderId, (counts.get(node.binderId) ?? 0) + 1);
  });
  return counts;
}

/**
 * @param {import('../src/graph/graph.js').Graph} graph
 * @param {string} rootId
 * @returns {{ graph: import('../src/graph/graph.js').Graph, rootId: string }}
 */
function reduceWithInterning(graph, rootId) {
  const maxSteps = 5_000;
  let state = { graph, rootId, observer: createObserver(rootId) };

  /** @type {boolean[]} */
  const phases = [false, true];
  for (const reduceUnderLambdas of phases) {
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      const stepped = stepNormalOrder(
        state.graph,
        state.rootId,
        { reduceUnderLambdas, cloneArguments: false },
        state.observer,
        {},
      );
      if (!stepped.didStep) break;

      const compacted = compactGraph(stepped.graph, stepped.rootId, {
        mode: 'intern',
      });

      state = {
        graph: compacted.graph,
        rootId: compacted.rootId,
        observer: createObserver(compacted.rootId),
      };
    }
  }

  return { graph: state.graph, rootId: state.rootId };
}

test('compactGraph interns slots by binderId', () => {
  const ast = parseSexpr('(((S a) b) c)');
  const compiled = buildGraphInlinedFromSexpr(createGraph(), ast, env);

  const stepped = stepNormalOrder(
    compiled.graph,
    compiled.nodeId,
    { reduceUnderLambdas: false, cloneArguments: false },
    createObserver(compiled.nodeId),
    {},
  );
  assert.equal(stepped.didStep, true);

  const beforeExpr = serializeGraph(stepped.graph, stepped.rootId);
  const beforeCounts = slotCountsByBinder(stepped.graph);
  const hadDuplicateSlots = [...beforeCounts.values()].some(c => c > 1);
  assert.equal(hadDuplicateSlots, true);

  const compacted = compactGraph(stepped.graph, stepped.rootId, {
    mode: 'intern',
  });
  assert.ok(compacted.graph.nodes.length < stepped.graph.nodes.length);
  assert.equal(serializeGraph(compacted.graph, compacted.rootId), beforeExpr);

  const afterCounts = slotCountsByBinder(compacted.graph);
  afterCounts.forEach(count => {
    assert.ok(count <= 1, 'expected one slot per binderId');
  });
});

test('interning compaction preserves evaluator results', () => {
  const baseline = evaluateExpression('(((S a) b) c)', env, {
    precompile: true,
  });
  const baselineExpr = serializeGraph(baseline.graph, baseline.rootId);

  const ast = parseSexpr('(((S a) b) c)');
  const compiled = buildGraphInlinedFromSexpr(createGraph(), ast, env);
  const reduced = reduceWithInterning(compiled.graph, compiled.nodeId);
  const compactExpr = serializeGraph(reduced.graph, reduced.rootId);

  assert.equal(compactExpr, baselineExpr);
});

