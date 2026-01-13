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

import { parseMany, parseSexpr } from '../../graph/parser.js';
import { buildGraphFromSexpr, lambdaMarker } from '../../graph/compile.js';
import { createGraph } from '../../graph/graph.js';
import { createObserver, stepNormalOrder } from '../../graph/machine.js';
import { snapshotFromGraph } from '../../graph/trace.js';
import { serializeGraph } from '../../graph/serializer.js';
import { invariant } from '../../utils.js';

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

/**
 * @typedef {{
 *   graph: VisGraph,
 *   rootId: string,
 *   note: string,
 *   expr: string
 * }} VisState
 */

/**
 * @typedef {{
 *   past: VisState[],
 *   present: VisState,
 *   future: VisState[]
 * }} VisHistory
 */

/**
 * Desugar `(defn name (x y …) body)` into nested lambdas `λx.λy.… body`.
 *
 * Lambdas are represented in S-expression skeletons as `[[], body]` where the
 * empty list is a lambda marker.
 *
 * @param {any[]} params
 * @param {any} body
 * @returns {any}
 */
function desugarParamsToLambdas(params, body) {
  invariant(Array.isArray(params), 'defn params must be a list');
  if (!params.length) return body;

  const [first, ...rest] = params;
  return [lambdaMarker(first), desugarParamsToLambdas(rest, body)];
}

/**
 * Normalize a `(def …)` or `(defn …)` form into `{ name, body }`.
 *
 * @param {any[]} form
 * @returns {{ name: string, body: any }}
 */
function normalizeDefinitionForm(form) {
  if (!Array.isArray(form) || form.length < 3) {
    throw new Error('Each form must be (def name body)');
  }

  if (form[0] === 'def') {
    const [, name, body] = form;
    return { name, body };
  }

  if (form[0] === 'defn') {
    const [, name, params, body] = form;
    return { name, body: desugarParamsToLambdas(params, body) };
  }

  throw new Error(`Unsupported form ${String(form[0])}`);
}

/**
 * Parse a program source containing `(def …)` / `(defn …)` forms.
 *
 * @param {string} source
 * @returns {Map<string, any>} Map of name → S-expression template
 */
export function parseDefinitionsSource(source) {
  const forms = parseMany(source);
  const env = new Map();
  forms.forEach(form => {
    const normalized = normalizeDefinitionForm(form);
    env.set(normalized.name, normalized.body);
  });
  return env;
}

/**
 * Build symbol expansion hooks for the pointer machine.
 *
 * @param {Map<string, any>} env
 * @returns {import('../../graph/machine.js').MachineHooks}
 */
function makeExpansionHooks(env) {
  return {
    canExpandSymbol: name => env.has(name),
    expandSymbol: (graph, name) =>
      buildGraphFromSexpr(graph, env.get(name), []),
  };
}

/**
 * Run deterministic leftmost-outermost reduction until no local rewrite
 * remains enabled.
 *
 * @param {import('../../graph/graph.js').Graph} graph
 * @param {string} rootId
 * @param {Map<string, any>} env
 * @param {{
 *   reduceUnderLambdas: boolean,
 *   cloneArguments: boolean,
 *   maxSteps: number
 * }} options
 * @returns {{ graph: import('../../graph/graph.js').Graph, rootId: string }}
 */
function reduceUntilStuck(graph, rootId, env, options) {
  const hooks = makeExpansionHooks(env);
  let state = { graph, rootId, observer: createObserver(rootId) };

  for (let step = 0; step < options.maxSteps; step += 1) {
    const stepped = stepNormalOrder(
      state.graph,
      state.rootId,
      options,
      state.observer,
      hooks,
    );

    if (!stepped.didStep) {
      return { graph: state.graph, rootId: state.rootId };
    }

    state = {
      graph: stepped.graph,
      rootId: stepped.rootId,
      observer: stepped.observer,
    };
  }

  throw new Error(`Reduction exceeded maxSteps=${options.maxSteps}`);
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
  const reachable = reachableNodeIds(snapshot, snapshot.rootId);
  const graph = new MultiDirectedGraph({ allowSelfLoops: true });

  snapshot.graph.nodes.forEach(node => {
    if (!reachable.has(node.id)) return;
    graph.addNode(node.id, attributesFromSnapshotNode(node));
  });

  snapshot.graph.edges.forEach(edge => {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) return;
    const attrs = { ...edge };
    graph.addDirectedEdgeWithKey(edge.id, edge.from, edge.to, attrs);
  });

  return graph;
}

/**
 * Compute the set of nodes reachable from the root via snapshot edges.
 *
 * This prunes "garbage" nodes that remain in the persistent store but are no
 * longer reachable from the current root after reductions.
 *
 * @param {ReturnType<typeof snapshotFromGraph>} snapshot
 * @param {string} rootId
 * @returns {Set<string>}
 */
function reachableNodeIds(snapshot, rootId) {
  const adjacency = new Map();

  snapshot.graph.edges.forEach(edge => {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  });

  const reachable = new Set([rootId]);
  const queue = [rootId];

  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId) break;
    const outgoing = adjacency.get(nodeId) ?? [];
    outgoing.forEach(targetId => {
      if (reachable.has(targetId)) return;
      reachable.add(targetId);
      queue.push(targetId);
    });
  }

  return reachable;
}

/**
 * Build the "Hello World" domain states:
 * - initial pointer-graph for `(((S a) b) c)`
 * - reduced form after one S-combinator macro step: `((a c) (b c))`
 *
 * @param {string} programSource
 * @returns {{ states: VisState[] }}
 */
export function createHelloWorldStates(programSource) {
  const env = parseDefinitionsSource(programSource);
  const ast = parseSexpr('(((S a) b) c)');

  const compiled = buildGraphFromSexpr(createGraph(), ast, []);
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
  };

  const maxSteps = 5_000;
  const weak = reduceUntilStuck(compiled.graph, compiled.nodeId, env, {
    reduceUnderLambdas: false,
    cloneArguments: true,
    maxSteps,
  });

  const full = reduceUntilStuck(weak.graph, weak.rootId, env, {
    reduceUnderLambdas: true,
    cloneArguments: true,
    maxSteps,
  });

  const reducedExpr = serializeGraph(full.graph, full.rootId);
  const reducedSnapshot = snapshotFromGraph(full.graph, full.rootId, 'reduced');
  const reduced = {
    graph: graphologyFromSnapshot(reducedSnapshot),
    rootId: full.rootId,
    note: 'reduced',
    expr: reducedExpr,
  };

  return { states: [initial, reduced] };
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
