/**
 * Simulation layout helpers (pure)
 * --------------------------------
 *
 * Produces deterministic, browser-safe initial node positions from the graph.
 * This is shared by both the Jolt backend and the deterministic (no-physics)
 * observer-sheet renderer.
 */

import { hierarchy, tree } from 'd3-hierarchy';

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

/**
 * Collect `child` edges into a parent → [left,right] map.
 *
 * @param {VisGraph} graph
 * @returns {Map<string, (string | null)[]>}
 */
export function childAdjacency(graph) {
  const childrenByParent = new Map();

  graph.forEachEdge((edgeKey, attrs, source, target) => {
    if (attrs?.kind !== 'child') return;
    const index = attrs?.index;
    if (index !== 0 && index !== 1) return;

    const existing = childrenByParent.get(source) ?? [null, null];
    const next = [...existing];
    next[index] = target;
    childrenByParent.set(source, next);
  });

  return childrenByParent;
}

/**
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {string} id
 * @returns {[number, number]}
 */
function unitJitter2(id) {
  const hash = hashString(id);
  const angle = (hash % 3600) / 3600 * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle)];
}

/**
 * @param {string} kind
 * @param {number} spacing
 * @returns {number}
 */
function zOffsetForChildKind(kind, spacing) {
  if (kind === 'binder') return -spacing * 0.7;
  if (kind === 'slot') return spacing * 0.7;
  return 0;
}

/**
 * @param {{
 *   kind: string,
 *   index?: number
 * }} edge
 * @param {string} targetId
 * @param {number} spacing
 * @returns {[number, number, number]}
 */
function offsetForEdge(edge, targetId, spacing) {
  const [jx, jz] = unitJitter2(targetId);
  const jitter = spacing * 0.2;

  if (edge.kind === 'reentry') {
    return [jx * jitter, spacing * 0.35, -spacing * 0.9 + jz * jitter];
  }

  if (edge.kind === 'value') {
    return [jx * jitter, -spacing * 0.35, spacing * 0.9 + jz * jitter];
  }

  if (edge.kind === 'child') {
    const sign = edge.index === 0 ? -1 : 1;
    return [
      sign * spacing * 0.85 + jx * jitter,
      -spacing * 0.85,
      jz * jitter,
    ];
  }

  return [jx * jitter, 0, jz * jitter];
}

/**
 * Translate all positions so that the root sits at the origin.
 *
 * @param {Map<string, [number, number, number]>} positions
 * @param {string} rootId
 * @returns {Map<string, [number, number, number]>}
 */
function normalizePositionsToRoot(positions, rootId) {
  const root = positions.get(rootId) ?? [0, 0, 0];
  const [rx, ry, rz] = root;
  const next = new Map();

  positions.forEach((pos, nodeId) => {
    next.set(nodeId, [pos[0] - rx, pos[1] - ry, pos[2] - rz]);
  });

  return next;
}

/**
 * @typedef {{ id: string, children?: ChildTreeNode[] }} ChildTreeNode
 */

/**
 * Build a d3-hierarchy input structure from Graphology `child` edges.
 *
 * @param {Map<string, (string | null)[]>} childrenByParent
 * @param {string} rootId
 * @returns {ChildTreeNode}
 */
function buildChildTreeData(childrenByParent, rootId) {
  const visited = new Set();

  /**
   * @param {string} nodeId
   * @returns {ChildTreeNode | null}
   */
  function build(nodeId) {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const children = childrenByParent.get(nodeId) ?? [null, null];
    const [left, right] = children;
    const nextChildren = [];
    if (left) {
      const built = build(left);
      if (built) nextChildren.push(built);
    }
    if (right) {
      const built = build(right);
      if (built) nextChildren.push(built);
    }

    if (!nextChildren.length) return { id: nodeId };
    return { id: nodeId, children: nextChildren };
  }

  const built = build(rootId);
  if (!built) return { id: rootId };
  return built;
}

/**
 * Produce deterministic initial positions from the reachable graph.
 *
 * @param {VisGraph} graph
 * @param {string} rootId
 * @param {number} nodeRadius
 * @returns {Map<string, [number, number, number]>}
 */
export function layoutGraphPositions(graph, rootId, nodeRadius) {
  const spacing = Math.max(1.6, nodeRadius * 8);
  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  const childrenByParent = childAdjacency(graph);

  const rootData = buildChildTreeData(childrenByParent, rootId);
  const rootHierarchy = hierarchy(rootData, node => node.children);
  const layout = tree().nodeSize([spacing, spacing]);
  layout(rootHierarchy);

  let minX = Infinity;
  let maxX = -Infinity;
  rootHierarchy.each(node => {
    const x = node.x ?? 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  });
  const centerX = Number.isFinite(minX) && Number.isFinite(maxX)
    ? (minX + maxX) / 2
    : 0;

  rootHierarchy.each(node => {
    const nodeId = node.data.id;
    const kind = String(graph.getNodeAttributes(nodeId)?.kind ?? '');
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    positions.set(nodeId, [
      x - centerX,
      -y,
      zOffsetForChildKind(kind, spacing),
    ]);
  });

  /** @type {{ kind: string, index?: number, from: string, to: string }[]} */
  const edges = [];
  graph.forEachEdge((edgeKey, attrs, source, target) => {
    const kind = attrs?.kind;
    if (kind !== 'child' && kind !== 'reentry' && kind !== 'value') return;
    edges.push({
      kind,
      index: typeof attrs?.index === 'number' ? attrs.index : undefined,
      from: source,
      to: target,
    });
  });

  const maxPasses = 6;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let placedAny = false;

    edges.forEach(edge => {
      if (!positions.has(edge.from) || positions.has(edge.to)) return;
      const [fx, fy, fz] = positions.get(edge.from) ?? [0, 0, 0];
      const [dx, dy, dz] = offsetForEdge(edge, edge.to, spacing);
      positions.set(edge.to, [fx + dx, fy + dy, fz + dz]);
      placedAny = true;
    });

    edges.forEach(edge => {
      if (!positions.has(edge.to) || positions.has(edge.from)) return;
      const [tx, ty, tz] = positions.get(edge.to) ?? [0, 0, 0];
      const [dx, dy, dz] = offsetForEdge(edge, edge.to, spacing);
      positions.set(edge.from, [tx - dx, ty - dy, tz - dz]);
      placedAny = true;
    });

    if (!placedAny) break;
  }

  const root = positions.get(rootId) ?? [0, 0, 0];
  graph.forEachNode(nodeId => {
    if (positions.has(nodeId)) return;
    const [jx, jz] = unitJitter2(nodeId);
    const radius = spacing * 1.25;
    positions.set(
      nodeId,
      [
        root[0] + jx * radius,
        root[1] - spacing * 0.6,
        root[2] + jz * radius,
      ],
    );
  });

  return normalizePositionsToRoot(positions, rootId);
}
