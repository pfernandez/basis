/**
 * Graph evaluator (core)
 * ---------------------
 *
 * Browser-safe orchestration for:
 * - `compile.js`: syntax → pointer-graph substrate
 * - `machine.js`: observer (`o`) + local rewrites (apply/collapse)
 * - `trace.js`: view-only snapshots for visualization/debugging
 */

import { createGraph } from './graph.js';
import { parseSexpr } from './parser.js';
import { buildGraphFromSexpr } from './compile.js';
import { buildGraphInlinedFromSexpr } from './precompile.js';
import { runUntilStuck } from './runner.js';
import { snapshotFromGraph } from './trace.js';

/**
 * @param {((snapshot: object) => void) | null} tracer
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {string} note
 * @param {string | null} focus
 * @returns {void}
 */
function emitSnapshot(tracer, graph, rootId, note, focus = null) {
  if (typeof tracer !== 'function') return;
  tracer(snapshotFromGraph(graph, rootId, note, focus));
}

/**
 * @param {Map<string, any>} env
 * @returns {{
 *   canExpandSymbol: (name: string) => boolean,
 *   expandSymbol: (
 *     graph: import('./graph.js').Graph,
 *     name: string
 *   ) => { graph: import('./graph.js').Graph, nodeId: string }
 * }}
 */
function makeExpansionHooks(env) {
  return {
    canExpandSymbol: name => env.has(name),
    expandSymbol: (graphValue, name) =>
      buildGraphFromSexpr(graphValue, env.get(name), []),
  };
}

/**
 * Evaluate an expression against the provided environment.
 *
 * @param {string | any[]} expr
 * @param {Map<string, any>} env
 * @param {{
 *   tracer?: (snapshot: object) => void,
 *   maxSteps?: number,
 *   cloneArguments?: boolean,
 *   precompile?: boolean
 * }} [options]
 * @returns {{ graph: import('./graph.js').Graph, rootId: string }}
 */
export function evaluateExpression(expr, env, options = {}) {
  const tracer = options.tracer ?? null;
  const maxSteps = options.maxSteps ?? 10_000;
  const cloneArguments = options.cloneArguments ?? true;
  const precompile = options.precompile ?? false;
  const hooks = precompile ? {} : makeExpansionHooks(env);
  const onStep =
    typeof tracer === 'function'
      ? step => {
          emitSnapshot(
            tracer,
            step.graph,
            step.rootId,
            step.note ?? 'step',
            step.focus ?? null,
          );
        }
      : null;

  const ast = typeof expr === 'string' ? parseSexpr(expr) : expr;
  const graph = createGraph();
  const compiled = precompile
    ? buildGraphInlinedFromSexpr(graph, ast, env)
    : buildGraphFromSexpr(graph, ast, []);
  emitSnapshot(tracer, compiled.graph, compiled.nodeId, 'init');

  // Phase 1: weak reduction (do not reduce inside lambda bodies).
  const weak = runUntilStuck(compiled.graph, compiled.nodeId, {
    maxSteps,
    reduceUnderLambdas: false,
    cloneArguments,
  }, hooks, onStep);

  // Phase 2: full reduction (normalize under lambdas).
  const full = runUntilStuck(weak.graph, weak.rootId, {
    maxSteps,
    reduceUnderLambdas: true,
    cloneArguments,
  }, hooks, onStep);

  emitSnapshot(tracer, full.graph, full.rootId, 'final');
  return { graph: full.graph, rootId: full.rootId };
}
