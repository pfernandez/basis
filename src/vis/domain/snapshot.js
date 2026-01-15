/**
 * Domain: snapshot → Graphology conversion
 * ---------------------------------------
 *
 * The pointer-machine evaluator emits view-only "snapshots" (plain JSON-ish
 * objects). This module converts them into Graphology graphs for layout,
 * simulation, and rendering.
 */

import { MultiDirectedGraph } from 'graphology';
import { bfsFromNode } from 'graphology-traversal/bfs';

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

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
 * The result is pruned to nodes reachable from `snapshot.rootId` so that
 * unreachable garbage (created by cloning) does not destabilize layout/physics.
 *
 * @param {any} snapshot
 * @returns {VisGraph}
 */
export function graphologyFromSnapshot(snapshot) {
  const graph = new MultiDirectedGraph({ allowSelfLoops: true });

  snapshot.graph.nodes.forEach(node => {
    graph.addNode(node.id, attributesFromSnapshotNode(node));
  });

  snapshot.graph.edges.forEach(edge => {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) return;
    graph.addDirectedEdgeWithKey(edge.id, edge.from, edge.to, { ...edge });
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

