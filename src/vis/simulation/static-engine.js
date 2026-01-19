/**
 * Simulation: deterministic observer sheet
 * ---------------------------------------
 *
 * Provides a stable, reversible pose for a graph without physics. The renderer
 * is free to embed these 2D sheet coordinates into 3D (curling/portals).
 */

import { invariant } from '../../utils.js';
import { layoutGraphPositions } from './layout.js';

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

/**
 * @typedef {import('../types.js').Segment} Segment
 */

/**
 * @typedef {{
 *   nodeIds: string[],
 *   nodeIndexById: Map<string, number>,
 *   positions: Float32Array,
 *   segments: Segment[],
 *   setPointerFold: (fold: number) => void,
 *   step: (deltaSeconds: number) => void,
 *   dispose: () => void
 * }} StaticEngine
 */

/**
 * @param {VisGraph} graph
 * @param {Map<string, number>} nodeIndexById
 * @returns {Segment[]}
 */
function segmentsFromGraph(graph, nodeIndexById) {
  /** @type {Segment[]} */
  const segments = [];

  graph.forEachEdge((edgeKey, attrs, source, target) => {
    const kind = attrs?.kind;
    if (kind !== 'child' && kind !== 'reentry' && kind !== 'value') return;

    const fromIndex = nodeIndexById.get(source);
    const toIndex = nodeIndexById.get(target);
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') return;

    segments.push({ kind, fromIndex, toIndex });
  });

  return segments;
}

/**
 * Create a deterministic engine for the provided graph state.
 *
 * @param {{
 *   graph: VisGraph,
 *   rootId: string,
 *   nodeRadius?: number
 * }} params
 * @returns {StaticEngine}
 */
export function createStaticEngine(params) {
  const nodeRadius = params.nodeRadius ?? 0.18;
  const graph = params.graph;
  const rootId = params.rootId;

  invariant(typeof rootId === 'string', 'rootId must be a string');
  invariant(graph && typeof graph === 'object', 'graph is required');

  const nodeIds = graph.nodes();
  const nodeIndexById = new Map(
    nodeIds.map((nodeId, index) => [nodeId, index]),
  );
  const positions = new Float32Array(nodeIds.length * 3);
  const initialPositions = layoutGraphPositions(graph, rootId, nodeRadius);

  nodeIds.forEach((nodeId, index) => {
    const position = initialPositions.get(nodeId) ?? [0, 0, 0];
    const base = index * 3;
    positions[base] = position[0];
    positions[base + 1] = position[1];
    positions[base + 2] = 0;
  });

  const segments = segmentsFromGraph(graph, nodeIndexById);

  /**
   * @param {number} _fold
   * @returns {void}
   */
  function setPointerFold(_fold) {}

  /**
   * @param {number} _deltaSeconds
   * @returns {void}
   */
  function step(_deltaSeconds) {}

  /**
   * @returns {void}
   */
  function dispose() {}

  return {
    nodeIds,
    nodeIndexById,
    positions,
    segments,
    setPointerFold,
    step,
    dispose,
  };
}

