/**
 * Graph substrate (persistent node store)
 * --------------------------------------
 *
 * This module defines the minimal in-memory representation used by the reducer:
 * a flat node store plus immutable update helpers.
 *
 * Design choices:
 * - Nodes are stored in an array; we do not store derived "links" or adjacency.
 * - Updates are persistent: `updateNode` returns a new graph value.
 * - `cloneSubgraph` clones only the *tree* reachable via `pair.children`.
 *   Pointer edges (`slot.binderId`, `binder.valueId`) are preserved as
 *   references (or remapped if the target was cloned).
 */

import { createIdGenerator, invariant, replaceNode } from '../utils.js';

/**
 * @typedef {object} GraphNode
 * @property {string} id Unique identifier for the node
 * @property {string} kind One of: pair | binder | slot | symbol | empty
 * @property {string} [label] Required only for `symbol` nodes
 * @property {string[]} [children] Required only for `pair` nodes
 * @property {string} [binderId] Required only for `slot` nodes
 * @property {string | null} [valueId] Required only for `binder` nodes
 */

/**
 * @typedef {object} Graph
 * @property {GraphNode[]} nodes
 */

const NODE_KIND_KEYS = Object.freeze({
  pair: ['id', 'kind', 'children'],
  binder: ['id', 'kind', 'valueId'],
  slot: ['id', 'kind', 'binderId'],
  symbol: ['id', 'kind', 'label'],
  empty: ['id', 'kind'],
});

const nextNodeId = createIdGenerator('n');

/**
 * @param {any} node
 * @returns {void}
 */
function assertOnlyExpectedKeys(node) {
  const allowed = NODE_KIND_KEYS[node.kind];
  invariant(
    Array.isArray(allowed),
    `Unknown node kind: ${String(node.kind)}`,
  );

  const allowedSet = new Set(allowed);
  Object.keys(node).forEach(key => {
    invariant(
      allowedSet.has(key),
      `Unexpected property "${key}" on ${node.kind} node ${node.id ?? '?'}`,
    );
  });

  allowed.forEach(key => {
    invariant(
      key in node,
      `Missing required property "${key}" on ` +
        `${node.kind} node ${node.id ?? '?'}`,
    );
  });
}

/**
 * Assert that a node record has the exact expected shape for its `kind`.
 *
 * This enforces a strict separation between the substrate (pointers only) and
 * any presentation/debug metadata (which must live outside the node store).
 *
 * @param {any} node
 * @returns {void}
 */
export function assertValidNode(node) {
  invariant(node && typeof node === 'object', 'Graph nodes must be objects');
  invariant(
    typeof node.id === 'string' && node.id.length > 0,
    'Graph nodes must have a string id',
  );
  invariant(
    typeof node.kind === 'string',
    `Graph node ${node.id} is missing kind`,
  );

  assertOnlyExpectedKeys(node);

  switch (node.kind) {
    case 'pair': {
      invariant(
        Array.isArray(node.children) && node.children.length === 2,
        `pair ${node.id} must have 2 children`,
      );
      node.children.forEach((childId, index) => {
        invariant(
          typeof childId === 'string',
          `pair ${node.id} child[${index}] must be a string id`,
        );
      });
      return;
    }
    case 'binder': {
      invariant(
        node.valueId === null || typeof node.valueId === 'string',
        `binder ${node.id} valueId must be string|null`,
      );
      return;
    }
    case 'slot': {
      invariant(
        typeof node.binderId === 'string',
        `slot ${node.id} binderId must be a string id`,
      );
      return;
    }
    case 'symbol': {
      invariant(
        typeof node.label === 'string',
        `symbol ${node.id} label must be a string`,
      );
      return;
    }
    case 'empty': {
      return;
    }
    default:
      throw new Error(`Unknown node kind: ${node.kind}`);
  }
}

/**
 * @param {Partial<GraphNode>} node
 * @returns {{ record: GraphNode, id: string }}
 */
function withFreshId(node) {
  const id = node.id ?? nextNodeId();
  const record = /** @type {GraphNode} */ ({ ...node, id });
  assertValidNode(record);
  return { record, id };
}

/**
 * @param {Map<string, string>} nodeMap
 * @param {string | null | undefined} maybeId
 * @returns {string | null}
 */
function clonedPointer(nodeMap, maybeId) {
  if (typeof maybeId !== 'string') return null;
  return nodeMap.get(maybeId) ?? maybeId;
}

/**
 * @param {GraphNode} source
 * @param {Map<string, string>} nodeMap
 * @returns {Partial<GraphNode>}
 */
function cloneNonPairNodeRecord(source, nodeMap) {
  switch (source.kind) {
    case 'binder':
      return {
        kind: 'binder',
        valueId: clonedPointer(nodeMap, source.valueId),
      };
    case 'slot':
      invariant(
        typeof source.binderId === 'string',
        `slot ${source.id} binderId must be a string id`,
      );
      return {
        kind: 'slot',
        binderId: nodeMap.get(source.binderId) ?? source.binderId,
      };
    case 'symbol':
      return { kind: 'symbol', label: source.label };
    case 'empty':
      return { kind: 'empty' };
    default:
      throw new Error(`Unsupported node kind: ${source.kind}`);
  }
}

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
  const { record, id } = withFreshId(node);
  return { graph: { ...graph, nodes: [...graph.nodes, record] }, id };
}

/**
 * Lookup a node by ID with invariant checking.
 * @param {Graph} graph
 * @param {string} id
 * @returns {GraphNode}
 */
export function getNode(graph, id) {
  const node = graph.nodes.find(node => node.id === id);
  invariant(node, `Unknown node ${id}`);
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
    nodes: replaceNode(graph.nodes, id, node => {
      const updated = updater(node);
      assertValidNode(updated);
      return updated;
    }),
  };
}

/**
 * Clone a subgraph rooted at `rootId`.
 *
 * Only the tree reachable via `pair.children` is cloned. Pointer edges are
 * preserved as references (or remapped if the target was already cloned).
 *
 * @param {Graph} graph
 * @param {string} rootId
 * @returns {{ graph: Graph, rootId: string }}
 */
export function cloneSubgraph(graph, rootId) {
  const sourceGraph = graph;
  const nodeMap = new Map(); // sourceId -> cloneId

  /**
   * @param {Graph} graphValue
   * @param {string} nodeId
   * @returns {{ graph: Graph, nodeId: string }}
   */
  function cloneNode(graphValue, nodeId) {
    const existing = nodeMap.get(nodeId);
    if (existing) return { graph: graphValue, nodeId: existing };

    const source = getNode(sourceGraph, nodeId);

    if (source.kind === 'pair') {
      const children = source.children;
      invariant(children, `pair ${source.id} missing children`);
      const [leftId, rightId] = children;
      const left = cloneNode(graphValue, leftId);
      const right = cloneNode(left.graph, rightId);
      const pair = addNode(right.graph, {
        kind: 'pair',
        children: [left.nodeId, right.nodeId],
      });
      nodeMap.set(nodeId, pair.id);
      return { graph: pair.graph, nodeId: pair.id };
    }

    const cloneRecord = cloneNonPairNodeRecord(source, nodeMap);
    const created = addNode(graphValue, cloneRecord);
    nodeMap.set(nodeId, created.id);
    return { graph: created.graph, nodeId: created.id };
  }

  const cloned = cloneNode(graph, rootId);
  return { graph: cloned.graph, rootId: cloned.nodeId };
}
