/**
 * Graph compaction (reachability + slot interning)
 * -----------------------------------------------
 *
 * This module provides optional, semantics-preserving graph compaction.
 *
 * The pointer machine treats `binder` nodes as the only stateful cells.
 * `slot` nodes are inert re-entry pointers (variable occurrences). When we
 * want a smaller substrate for visualization/debugging, we can safely:
 * - drop unreachable garbage, and
 * - intern `slot` nodes by `binderId` (one slot per binder), and
 * - intern `symbol` nodes by `label`, and
 * - intern all `empty` nodes, and
 * - inline bound slots whose values are stable.
 *
 * This intentionally does *not* merge `pair` or `binder` nodes: both
 * participate in causal update semantics (pair child rewrites and
 * binder.valueId updates).
 */

import { assertValidNode, getNode } from './graph.js';
import { isLambdaPair } from './patterns.js';
import { invariant } from '../utils.js';

/**
 * @typedef {import('./graph.js').Graph} Graph
 * @typedef {import('./graph.js').GraphNode} GraphNode
 */

/**
 * @typedef {'none' | 'intern' | 'full'} GraphCompaction
 */

/**
 * @param {Graph} graph
 * @param {string} rootId
 * @returns {Set<string>}
 */
function reachableNodeIds(graph, rootId) {
  const visited = new Set();
  const stack = [rootId];

  while (stack.length) {
    const currentId = stack.pop();
    if (typeof currentId !== 'string') continue;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = getNode(graph, currentId);
    if (node.kind === 'pair') {
      const children = node.children ?? [];
      children.forEach(childId => stack.push(childId));
    }

    if (node.kind === 'slot' && typeof node.binderId === 'string') {
      stack.push(node.binderId);
    }

    if (node.kind === 'binder' && typeof node.valueId === 'string') {
      stack.push(node.valueId);
    }
  }

  return visited;
}

/**
 * @param {GraphNode} node
 * @returns {string | null}
 */
function internKey(node) {
  if (node.kind === 'empty') return 'empty';
  if (node.kind === 'symbol') return `symbol:${String(node.label ?? '')}`;
  if (node.kind === 'slot') return `slot:${String(node.binderId ?? '')}`;
  return null;
}

/**
 * @param {Map<string, string>} redirects
 * @param {string} nodeId
 * @returns {string}
 */
function resolveRedirect(redirects, nodeId) {
  let currentId = nodeId;
  const seen = new Set();

  for (;;) {
    const nextId = redirects.get(currentId);
    if (typeof nextId !== 'string') return currentId;
    if (seen.has(nextId)) return currentId;
    seen.add(nextId);
    currentId = nextId;
  }
}

/**
 * Decide whether a bound value is stable enough to inline.
 *
 * Stable values will never be replaced at the root by the machine's local
 * rewrites (apply/collapse/expand).
 *
 * @param {Graph} graph
 * @param {string} nodeId
 * @param {{ canExpandSymbol?: (name: string) => boolean }} options
 * @returns {boolean}
 */
function valueRootIsStable(graph, nodeId, options) {
  const node = getNode(graph, nodeId);
  if (node.kind === 'empty') return true;

  if (node.kind === 'symbol') {
    const label = String(node.label ?? '');
    if (typeof options.canExpandSymbol === 'function') {
      return !options.canExpandSymbol(label);
    }
    return true;
  }

  if (node.kind === 'pair') {
    return isLambdaPair(graph, nodeId);
  }

  return false;
}

/**
 * Compact the graph by pruning unreachable nodes and interning inert nodes.
 *
 * The `intern` mode merges:
 * - all `empty` nodes,
 * - all `symbol` nodes with the same `label`,
 * - all `slot` nodes with the same `binderId` (one slot per binder).
 *
 * The `full` mode additionally inlines bound slots when the bound value is
 * stable and cannot be replaced at its root (e.g. symbols, empty, lambdas).
 *
 * @param {Graph} graph
 * @param {string} rootId
 * @param {{
 *   mode?: GraphCompaction,
 *   canExpandSymbol?: (name: string) => boolean
 * }} [options]
 * @returns {{ graph: Graph, rootId: string }}
 */
export function compactGraph(graph, rootId, options = {}) {
  const mode = options.mode ?? 'none';
  invariant(typeof rootId === 'string', 'compactGraph requires a rootId');

  if (mode === 'none') {
    const reachable = reachableNodeIds(graph, rootId);
    const nodes = graph.nodes.filter(node => reachable.has(node.id));
    nodes.forEach(assertValidNode);
    return { graph: { ...graph, nodes }, rootId };
  }

  if (mode !== 'intern' && mode !== 'full') {
    throw new Error(`Unknown compaction mode: ${String(mode)}`);
  }

  const reachable = reachableNodeIds(graph, rootId);
  /** @type {Map<string, string>} */
  const canonicalByKey = new Map();
  /** @type {Map<string, string>} */
  const redirects = new Map();

  graph.nodes.forEach(node => {
    if (!reachable.has(node.id)) return;
    const key = internKey(node);
    if (!key) return;
    const existing = canonicalByKey.get(key);
    if (typeof existing === 'string') {
      redirects.set(node.id, existing);
      return;
    }
    canonicalByKey.set(key, node.id);
  });

  if (mode === 'full') {
    graph.nodes.forEach(node => {
      if (!reachable.has(node.id)) return;
      if (node.kind !== 'slot') return;
      invariant(
        typeof node.binderId === 'string',
        'slot binderId must be a string',
      );

      const binder = getNode(graph, node.binderId);
      if (binder.kind !== 'binder') return;
      if (typeof binder.valueId !== 'string') return;

      const boundValueId = resolveRedirect(redirects, binder.valueId);
      if (!valueRootIsStable(graph, boundValueId, options)) return;

      const canonicalSlotId = resolveRedirect(redirects, node.id);
      redirects.set(canonicalSlotId, boundValueId);
    });
  }

  const canonicalRootId = resolveRedirect(redirects, rootId);

  /** @type {GraphNode[]} */
  const nodes = [];
  graph.nodes.forEach(node => {
    if (!reachable.has(node.id)) return;
    const canonicalId = resolveRedirect(redirects, node.id);
    if (canonicalId !== node.id) return;

    if (node.kind === 'pair') {
      const children = node.children ?? [];
      const nextChildren = [
        resolveRedirect(redirects, children[0]),
        resolveRedirect(redirects, children[1]),
      ];
      const next = { ...node, children: nextChildren };
      assertValidNode(next);
      nodes.push(next);
      return;
    }

    if (node.kind === 'binder') {
      const valueId =
        typeof node.valueId === 'string'
          ? resolveRedirect(redirects, node.valueId)
          : null;
      const next = { ...node, valueId };
      assertValidNode(next);
      nodes.push(next);
      return;
    }

    if (node.kind === 'slot') {
      invariant(
        typeof node.binderId === 'string',
        'slot binderId must be a string',
      );
      const binderId = resolveRedirect(redirects, node.binderId);
      const next = { ...node, binderId };
      assertValidNode(next);
      nodes.push(next);
      return;
    }

    const next = { ...node };
    assertValidNode(next);
    nodes.push(next);
  });

  const compactedGraph = { ...graph, nodes };
  if (mode !== 'full') {
    return { graph: compactedGraph, rootId: canonicalRootId };
  }

  const reachableAfter = reachableNodeIds(compactedGraph, canonicalRootId);
  const pruned = compactedGraph.nodes.filter(node =>
    reachableAfter.has(node.id)
  );
  pruned.forEach(assertValidNode);

  return { graph: { ...graph, nodes: pruned }, rootId: canonicalRootId };
}
