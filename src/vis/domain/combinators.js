/**
 * Domain: combinator evaluation state (Graphology)
 * -----------------------------------------------
 *
 * This module is intentionally pure: given program sources + an expression, it
 * returns immutable snapshots as Graphology graphs.
 *
 * We reuse the existing pointer-machine prototype in `src/graph/` to preserve
 * the repo's nonstandard evaluation strategy (binding via pointers, not
 * substitution).
 */

import { MultiDirectedGraph } from 'graphology';
import { bfsFromNode } from 'graphology-traversal/bfs';

import { parseSexpr } from '../../graph/parser.js';
import { createGraph } from '../../graph/graph.js';
import { runUntilStuck } from '../../graph/runner.js';
import { snapshotFromGraph } from '../../graph/trace.js';
import { serializeGraph } from '../../graph/serializer.js';
import { parseDefinitionsSource } from '../../graph/definitions.js';
import { buildGraphInlinedFromSexpr } from '../../graph/precompile.js';

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

/**
 * @typedef {{
 *   graph: VisGraph,
 *   rootId: string,
 *   note: string,
 *   expr: string,
 *   stepIndex: number
 * }} VisState
 */

/**
 * @typedef {{
 *   past: VisState[],
 *   present: VisState,
 *   future: VisState[]
 * }} VisHistory
 */

export { parseDefinitionsSource };

/**
 * Step the pointer machine, collecting a trace of reachable snapshots.
 *
 * @param {import('../../graph/graph.js').Graph} graph
 * @param {string} rootId
 * @param {{
 *   phase: 'weak' | 'full',
 *   reduceUnderLambdas: boolean,
 *   cloneArguments: boolean,
 *   maxSteps: number
 * }} options
 * @param {number} startIndex
 * @returns {{
 *   graph: import('../../graph/graph.js').Graph,
 *   rootId: string,
 *   states: VisState[],
 *   nextIndex: number
 * }}
 */
function traceUntilStuck(graph, rootId, options, startIndex) {
  let index = startIndex;
  /** @type {VisState[]} */
  const states = [];

  const result = runUntilStuck(
    graph,
    rootId,
    options,
    {},
    step => {
      const note = `${options.phase}:${step.note ?? 'step'}`;
      const expr = serializeGraph(step.graph, step.rootId);
      const snapshot = snapshotFromGraph(
        step.graph,
        step.rootId,
        note,
        step.focus ?? null,
      );

      states.push({
        graph: graphologyFromSnapshot(snapshot),
        rootId: step.rootId,
        note,
        expr,
        stepIndex: index,
      });
      index += 1;
    },
  );

  return {
    graph: result.graph,
    rootId: result.rootId,
    states,
    nextIndex: index,
  };
}

/**
 * Clone a node record into stable Graphology node attributes.
 *
 * @param {any} node
 * @returns {Record<string, unknown>}
 */
function attributesFromSnapshotNode(node) {
  if (node?.kind === 'pair') {
    return { ...node, children: [...node.children] };
  }
  return { ...node };
}

/**
 * Convert a `snapshotFromGraph` structure into a Graphology multi-digraph.
 *
 * @param {ReturnType<typeof snapshotFromGraph>} snapshot
 * @returns {VisGraph}
 */
function graphologyFromSnapshot(snapshot) {
  const graph = new MultiDirectedGraph({ allowSelfLoops: true });

  snapshot.graph.nodes.forEach(node => {
    graph.addNode(node.id, attributesFromSnapshotNode(node));
  });

  snapshot.graph.edges.forEach(edge => {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) return;
    const attrs = { ...edge };
    graph.addDirectedEdgeWithKey(edge.id, edge.from, edge.to, attrs);
  });

  const reachable = new Set();
  bfsFromNode(
    graph,
    snapshot.rootId,
    nodeId => {
      reachable.add(nodeId);
    },
    { mode: 'outbound' },
  );

  /** @type {string[]} */
  const toDrop = [];
  graph.forEachNode(nodeId => {
    if (!reachable.has(nodeId)) toDrop.push(nodeId);
  });
  toDrop.forEach(nodeId => {
    graph.dropNode(nodeId);
  });

  return graph;
}

/**
 * Build the "Hello World" domain trace for `(((S a) b) c)`.
 *
 * This trace:
 * - starts from an inlined (preexpanded) `S` definition
 * - steps the reducer event-by-event (apply/collapse)
 *
 * @param {string} programSource
 * @returns {{ states: VisState[] }}
 */
export function createHelloWorldStates(programSource) {
  const env = parseDefinitionsSource(programSource);
  const ast = parseSexpr('(((S a) b) c)');

  const compiled = buildGraphInlinedFromSexpr(createGraph(), ast, env);
  const initialExpr = serializeGraph(compiled.graph, compiled.nodeId);
  const initSnapshot = snapshotFromGraph(
    compiled.graph,
    compiled.nodeId,
    'init',
  );
  const initial = {
    graph: graphologyFromSnapshot(initSnapshot),
    rootId: compiled.nodeId,
    note: 'init',
    expr: initialExpr,
    stepIndex: 0,
  };

  const maxSteps = 5_000;
  const weakTrace = traceUntilStuck(compiled.graph, compiled.nodeId, {
    phase: 'weak',
    reduceUnderLambdas: false,
    cloneArguments: true,
    maxSteps,
  }, 1);

  const fullTrace = traceUntilStuck(weakTrace.graph, weakTrace.rootId, {
    phase: 'full',
    reduceUnderLambdas: true,
    cloneArguments: true,
    maxSteps,
  }, weakTrace.nextIndex);

  return { states: [initial, ...weakTrace.states, ...fullTrace.states] };
}

/**
 * Snapshot a state for storage in history.
 *
 * Graphology graphs are mutable, so we store a defensive `graph.copy()` to
 * keep undo/redo stable under accidental downstream mutation.
 *
 * @param {VisState} state
 * @returns {VisState}
 */
function snapshotState(state) {
  return { ...state, graph: state.graph.copy() };
}

/**
 * Create an empty undo/redo history from an initial state.
 *
 * @param {VisState} initial
 * @returns {VisHistory}
 */
export function createHistory(initial) {
  return { past: [], present: snapshotState(initial), future: [] };
}

/**
 * Commit a new present state, clearing redo history.
 *
 * @param {VisHistory} history
 * @param {VisState} next
 * @returns {VisHistory}
 */
export function commit(history, next) {
  return {
    past: [...history.past, snapshotState(history.present)],
    present: snapshotState(next),
    future: [],
  };
}

/**
 * @param {VisHistory} history
 * @returns {boolean}
 */
export function canUndo(history) {
  return history.past.length > 0;
}

/**
 * @param {VisHistory} history
 * @returns {boolean}
 */
export function canRedo(history) {
  return history.future.length > 0;
}

/**
 * Undo one step if possible.
 *
 * @param {VisHistory} history
 * @returns {VisHistory}
 */
export function undo(history) {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  return {
    past,
    present: snapshotState(previous),
    future: [snapshotState(history.present), ...history.future],
  };
}

/**
 * Redo one step if possible.
 *
 * @param {VisHistory} history
 * @returns {VisHistory}
 */
export function redo(history) {
  if (!canRedo(history)) return history;
  const [next, ...future] = history.future;
  return {
    past: [...history.past, snapshotState(history.present)],
    present: snapshotState(next),
    future,
  };
}
