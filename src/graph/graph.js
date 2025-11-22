import { createIdGenerator, invariant, buildParentIndex, replaceNode } from '../utils.js';

/**
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {string} kind
 * @property {string} label
 * @property {string[]} [children]
 * @property {string} [anchorKey]
 * @property {string} [aliasKey]
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

export function createGraph() {
  return { nodes: [], links: [] };
}

export function addNode(graph, node) {
  const id = node.id ?? nextNodeId();
  const record = { ...node, id };
  return {
    graph: { ...graph, nodes: [...graph.nodes, record] },
    id,
  };
}

export function addLink(graph, link) {
  const id = link.id ?? nextLinkId();
  const record = { ...link, id };
  return {
    graph: { ...graph, links: [...graph.links, record] },
    id,
  };
}

export function getNode(graph, id) {
  const node = graph.nodes.find(node => node.id === id);
  invariant(Boolean(node), `Unknown node ${id}`);
  return node;
}

export function updateNode(graph, id, updater) {
  return {
    ...graph,
    nodes: replaceNode(graph.nodes, id, updater),
  };
}

export function replaceChild(graph, parentId, oldChildId, newChildId) {
  return updateNode(graph, parentId, node => {
    if (!node.children) return node;
    return {
      ...node,
      children: node.children.map(child => (child === oldChildId ? newChildId : child)),
    };
  });
}

export function removeNode(graph, nodeId) {
  return {
    nodes: graph.nodes.filter(node => node.id !== nodeId),
    links: graph.links.filter(link => link.from !== nodeId && link.to !== nodeId),
  };
}

export function cloneSubgraph(graph, rootId) {
  const nodeMap = new Map();
  const cloneLinks = [];

  function cloneNode(id) {
    if (nodeMap.has(id)) return nodeMap.get(id);
    const source = getNode(graph, id);
    const clonedId = nextNodeId();
    let children = source.children;
    if (children && children.length) {
      children = children.map(childId => cloneNode(childId));
    }
    const cloneRecord = { ...source, id: clonedId, children };
    nodeMap.set(id, clonedId);
    graph = { ...graph, nodes: [...graph.nodes, cloneRecord] };
    return clonedId;
  }

  graph.links
    .filter(link => nodeMap.has(link.from) || nodeMap.has(link.to))
    .forEach(link => {
      const from = nodeMap.get(link.from) ?? link.from;
      const to = nodeMap.get(link.to) ?? link.to;
      cloneLinks.push({ ...link, id: nextLinkId(), from, to });
    });

  const newRootId = cloneNode(rootId);
  graph = { ...graph, links: [...graph.links, ...cloneLinks] };
  return { graph, rootId: newRootId };
}

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
