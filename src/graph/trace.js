/**
 * Trace snapshots (debug/presentation)
 * -----------------------------------
 *
 * Converts the substrate graph into a snapshot suitable for JSON traces and
 * visualization. This is view-only: it does not affect evaluation.
 */

/**
 * @param {any} node
 * @returns {any}
 */
function cloneNodeForSnapshot(node) {
  if (node.kind !== 'pair') return { ...node };
  return { ...node, children: [...node.children] };
}

/**
 * @param {any} node
 * @returns {object[]}
 */
function pointerLinksForNode(node) {
  if (node.kind === 'slot' && typeof node.binderId === 'string') {
    return [
      {
        id: `reentry:${node.id}`,
        kind: 'reentry',
        from: node.id,
        to: node.binderId,
      },
    ];
  }
  if (node.kind === 'binder' && typeof node.valueId === 'string') {
    return [
      {
        id: `value:${node.id}`,
        kind: 'value',
        from: node.id,
        to: node.valueId,
      },
    ];
  }
  return [];
}

/**
 * @param {any} node
 * @returns {object[]}
 */
function treeLinksForNode(node) {
  if (node.kind !== 'pair') return [];
  const [leftId, rightId] = node.children;
  return [
    {
      id: `t:${node.id}:0`,
      kind: 'child',
      from: node.id,
      to: leftId,
      index: 0,
    },
    {
      id: `t:${node.id}:1`,
      kind: 'child',
      from: node.id,
      to: rightId,
      index: 1,
    },
  ];
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {string} note
 * @param {object | null} focus
 * @returns {object}
 */
export function snapshotFromGraph(graph, rootId, note, focus = null) {
  const nodes = graph.nodes.map(cloneNodeForSnapshot);
  const links = nodes.flatMap(pointerLinksForNode);
  const edges = [...nodes.flatMap(treeLinksForNode), ...links];

  return {
    graph: { nodes, links, edges },
    rootId,
    note,
    focus,
  };
}
