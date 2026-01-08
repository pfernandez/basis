/**
 * Graph substrate (persistent node store)
 * --------------------------------------
 *
 * This module defines the minimal in-memory representation used by the evaluator:
 * a flat node store plus immutable update helpers.
 *
 * Important design choices:
 * - Nodes are stored in an array; there is no adjacency list and no stored "links".
 *   Any non-tree edges (e.g. slot→binder, binder→value) are derived for tracing.
 * - Updates are persistent: `updateNode` returns a new graph value.
 * - `cloneSubgraph` clones only the *tree* reachable via `pair.children`.
 *   Pointer edges (`slot.binderId`, `binder.valueId`) are preserved as references.
 *
 * Node kinds:
 * - `pair`: binary cons/application node with exactly two children.
 * - `binder`: lambda binder (parameter) holding an optional bound value pointer.
 * - `slot`: variable occurrence pointing to its binder.
 * - `symbol`: named reference used only for definition expansion (`env`).
 * - `empty`: the distinguished empty leaf `()`.
 */

import { createIdGenerator, invariant, replaceNode } from '../utils.js';

/**
 * @typedef {Object} GraphNode
 * @property {string} id Unique identifier for the node
 * @property {string} kind One of: pair | binder | slot | symbol | empty
 * @property {string} label Human-readable label rendered in the UI
 * @property {string[]} [children] Child node IDs (for pair nodes)
 * @property {string} [binderId] Node ID of the binder owning this slot (slot nodes)
 * @property {string | null} [valueId] Node ID bound by a binder (binder nodes)
 */

/**
 * @typedef {Object} Graph
 * @property {GraphNode[]} nodes
 */

const nextNodeId = createIdGenerator('n');

/**
 * Create an empty graph.
 * @returns {Graph}
 */
export function createGraph() {
  return { nodes: [] };
}

/**
 * Add a node to the graph.
 * @param {Graph} graph
 * @param {Partial<GraphNode>} node
 * @returns {{ graph: Graph, id: string }}
 */
export function addNode(graph, node) {
  const id = node.id ?? nextNodeId();
  const record = { ...node, id };
  return {
    graph: { ...graph, nodes: [...graph.nodes, record] },
    id,
  };
}

/**
 * Lookup a node by ID with invariant checking.
 * @param {Graph} graph
 * @param {string} id
 * @returns {GraphNode}
 */
export function getNode(graph, id) {
  const node = graph.nodes.find(node => node.id === id);
  invariant(Boolean(node), `Unknown node ${id}`);
  return node;
}

/**
 * Update a single node immutably.
 * @param {Graph} graph
 * @param {string} id
 * @param {(node: GraphNode) => GraphNode} updater
 * @returns {Graph}
 */
export function updateNode(graph, id, updater) {
  return {
    ...graph,
    nodes: replaceNode(graph.nodes, id, updater),
  };
}

/**
 * Clone a subgraph rooted at the provided node.
 *
 * @param {Graph} graph
 * @param {string} rootId
 * @returns {{ graph: Graph, rootId: string }}
 */
export function cloneSubgraph(graph, rootId) {
  const nodeMap = new Map();
  const sourceGraph = graph;
  let workingGraph = graph;

  function cloneNode(id) {
    if (nodeMap.has(id)) return nodeMap.get(id);
    const source = getNode(sourceGraph, id);
    const children = source.children?.map(childId => cloneNode(childId));

    const cloneRecord = { ...source, id: undefined, children };
    if (source.kind === 'slot' && source.binderId) {
      cloneRecord.binderId = nodeMap.get(source.binderId) ?? source.binderId;
    }
    if (source.kind === 'binder' && source.valueId) {
      cloneRecord.valueId = nodeMap.get(source.valueId) ?? source.valueId;
    }

    const clone = addNode(workingGraph, cloneRecord);
    workingGraph = clone.graph;
    nodeMap.set(id, clone.id);
    return clone.id;
  }

  const newRootId = cloneNode(rootId);
  return { graph: workingGraph, rootId: newRootId };
}
