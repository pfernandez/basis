/**
 * Precompilation helpers
 * ---------------------
 *
 * Provides symbol-inlining compilation so evaluation can start from the fully
 * expanded pointer-graph substrate (no "expand symbol" steps in the trace).
 */

import { buildGraphFromSexpr } from './compile.js';

/**
 * Build a graph by inlining all known symbols from `env`.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {any} ast
 * @param {Map<string, any>} env
 * @returns {{ graph: import('./graph.js').Graph, nodeId: string }}
 */
export function buildGraphInlinedFromSexpr(graph, ast, env) {
  const compiled = new Map(); // name -> rootId
  const compiling = new Set(); // cycle guard

  /**
   * @param {import('./graph.js').Graph} graphValue
   * @param {string} name
   * @returns {{
   *   graph: import('./graph.js').Graph,
   *   nodeId: string
   * } | null}
   */
  function resolveSymbol(graphValue, name) {
    if (!env.has(name)) return null;

    const cached = compiled.get(name);
    if (typeof cached === 'string') {
      return { graph: graphValue, nodeId: cached };
    }

    if (compiling.has(name)) {
      throw new Error(`Recursive definition: ${name}`);
    }

    compiling.add(name);
    const built = buildGraphFromSexpr(graphValue, env.get(name), [], {
      resolveSymbol,
    });
    compiling.delete(name);

    compiled.set(name, built.nodeId);
    return built;
  }

  return buildGraphFromSexpr(graph, ast, [], { resolveSymbol });
}

