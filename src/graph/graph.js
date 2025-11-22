import { createIdGenerator, invariant, buildParentIndex, replaceNode } from '../utils.js';

/**
 * @typedef {Object} GraphNode
 * @property {string} id Unique identifier for the node
 * @property {string} kind One of: pair | binder | slot | symbol | empty
 * @property {string} label Human-readable label rendered in the UI
 * @property {string[]} [children] Child node IDs (for pair nodes)
 * @property {string} [anchorKey] Stable key used by slots to re-enter this binder
 * @property {string} [aliasKey] Stable key referencing the binder a slot belongs to
 */

/**
 * @typedef {Object} GraphLink
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} kind
 */

/**
 * @typedef {Object} Graph
 * @property {GraphNode[]} nodes
 * @property {GraphLink[]} links
 */

const nextNodeId = createIdGenerator('n');
const nextLinkId = createIdGenerator('l');

/**
 * Create an empty graph.
 * @returns {Graph}
 */
export function createGraph() {
  return { nodes: [], links: [] };
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
 * Add a link (typically slot→binder) to the graph.
 * @param {Graph} graph
 * @param {Partial<GraphLink>} link
 * @returns {{ graph: Graph, id: string }}
 */
export function addLink(graph, link) {
  const id = link.id ?? nextLinkId();
  const record = { ...link, id };
  return {
    graph: { ...graph, links: [...graph.links, record] },
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
 * Replace a child reference on a pair node.
 * @param {Graph} graph
 * @param {string} parentId
 * @param {string} oldChildId
 * @param {string} newChildId
 * @returns {Graph}
 */
export function replaceChild(graph, parentId, oldChildId, newChildId) {
  return updateNode(graph, parentId, node => {
    if (!node.children) return node;
    return {
      ...node,
      children: node.children.map(child => (child === oldChildId ? newChildId : child)),
    };
  });
}

/**
 * Remove a node and any incident links.
 * @param {Graph} graph
 * @param {string} nodeId
 * @returns {Graph}
 */
export function removeNode(graph, nodeId) {
  return {
    nodes: graph.nodes.filter(node => node.id !== nodeId),
    links: graph.links.filter(link => link.from !== nodeId && link.to !== nodeId),
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
    const clone = addNode(workingGraph, { ...source, id: undefined, children });
    workingGraph = clone.graph;
    nodeMap.set(id, clone.id);
    return clone.id;
  }

  const newRootId = cloneNode(rootId);
  let finalGraph = workingGraph;
  sourceGraph.links
    .filter(link => nodeMap.has(link.from) && nodeMap.has(link.to))
    .forEach(link => {
      finalGraph = addLink(finalGraph, {
        kind: link.kind,
        from: nodeMap.get(link.from),
        to: nodeMap.get(link.to),
      }).graph;
    });

  return { graph: finalGraph, rootId: newRootId };
}

/**
 * Replace every slot targeting `binderKey` with the provided subtree root.
 *
 * @param {Graph} graph
 * @param {string} binderKey
 * @param {string} replacementRootId
 * @returns {Graph}
 */
export function replaceSlotsWith(graph, binderKey, replacementRootId) {
  const parentIndex = buildParentIndex(graph.nodes);
  const slotIds = graph.nodes
    .filter(node => node.kind === 'slot' && node.aliasKey === binderKey)
    .map(node => node.id);

  let nextGraph = graph;
  slotIds.forEach(slotId => {
    const parents = parentIndex.get(slotId) ?? [];
    parents.forEach(parentId => {
      nextGraph = replaceChild(nextGraph, parentId, slotId, replacementRootId);
    });
    nextGraph = removeNode(nextGraph, slotId);
  });
  return nextGraph;
}
