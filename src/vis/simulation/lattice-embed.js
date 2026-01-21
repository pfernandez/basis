/**
 * Simulation: lattice embedding (pure)
 * -----------------------------------
 *
 * Attempt to embed the graph onto a cubic lattice of integer coordinates
 * (grid vertices) so every constrained edge has equal length.
 *
 * This is intended for the `edges: lattice` visual mode: vertices are unique
 * (no two nodes share the same grid point), and we search for a solution that
 * uses as little Z displacement as possible.
 */

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

/**
 * Integer lattice coordinate in grid steps.
 *
 * @typedef {[number, number, number]} GridSteps
 */

/**
 * @typedef {{
 *   positions: Map<string, GridSteps>,
 *   maxAbsZ: number
 * }} LatticeEmbedding
 */

/**
 * @param {GridSteps} steps
 * @returns {string}
 */
function stepsKey(steps) {
  return `${steps[0]},${steps[1]},${steps[2]}`;
}

/**
 * @param {GridSteps} a
 * @param {GridSteps} b
 * @returns {GridSteps}
 */
function addSteps(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * @param {GridSteps} a
 * @param {GridSteps} b
 * @returns {GridSteps}
 */
function diffSteps(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * @param {GridSteps} steps
 * @returns {number}
 */
function absZ(steps) {
  return Math.abs(steps[2]);
}

/**
 * @param {GridSteps} steps
 * @returns {number}
 */
function absManhattan(steps) {
  return Math.abs(steps[0]) + Math.abs(steps[1]) + Math.abs(steps[2]);
}

/**
 * Generate integer step vectors with the requested squared length.
 *
 * @param {number} edgeSquaredSteps
 * @returns {GridSteps[]}
 */
function stepVectors(edgeSquaredSteps) {
  const squared = Math.max(1, Math.floor(edgeSquaredSteps));
  const limit = Math.floor(Math.sqrt(squared));
  /** @type {GridSteps[]} */
  const vectors = [];

  for (let x = -limit; x <= limit; x += 1) {
    for (let y = -limit; y <= limit; y += 1) {
      for (let z = -limit; z <= limit; z += 1) {
        if (x === 0 && y === 0 && z === 0) continue;
        if (x * x + y * y + z * z !== squared) continue;
        vectors.push([x, y, z]);
      }
    }
  }

  return vectors;
}

/**
 * @param {VisGraph} graph
 * @param {Set<string>} edgeKinds
 * @returns {Map<string, Set<string>>}
 */
function constraintAdjacency(graph, edgeKinds) {
  /** @type {Map<string, Set<string>>} */
  const adjacency = new Map();

  /**
   * @param {string} a
   * @param {string} b
   * @returns {void}
   */
  function link(a, b) {
    if (a === b) return;
    const setA = adjacency.get(a) ?? new Set();
    setA.add(b);
    adjacency.set(a, setA);
    const setB = adjacency.get(b) ?? new Set();
    setB.add(a);
    adjacency.set(b, setB);
  }

  graph.forEachEdge((_edgeKey, attrs, source, target) => {
    const kind = String(attrs?.kind ?? '');
    if (!edgeKinds.has(kind)) return;
    link(source, target);
  });

  graph.forEachNode(nodeId => {
    if (!adjacency.has(nodeId)) adjacency.set(nodeId, new Set());
  });

  return adjacency;
}

/**
 * @param {Map<string, Set<string>>} adjacency
 * @returns {string[][]}
 */
function connectedComponents(adjacency) {
  const unvisited = new Set(adjacency.keys());
  /** @type {string[][]} */
  const components = [];

  while (unvisited.size) {
    const start = unvisited.values().next().value;
    if (typeof start !== 'string') break;
    unvisited.delete(start);

    /** @type {string[]} */
    const component = [start];
    /** @type {string[]} */
    const queue = [start];

    while (queue.length) {
      const current = queue.shift();
      if (typeof current !== 'string') continue;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      neighbors.forEach(neighbor => {
        if (!unvisited.has(neighbor)) return;
        unvisited.delete(neighbor);
        component.push(neighbor);
        queue.push(neighbor);
      });
    }

    components.push(component);
  }

  return components;
}

/**
 * @param {GridSteps[]} vectors
 * @returns {Set<string>}
 */
function vectorKeySet(vectors) {
  const set = new Set();
  vectors.forEach(vector => set.add(stepsKey(vector)));
  return set;
}

/**
 * @param {GridSteps} steps
 * @param {number} maxAbsZ
 * @param {number} maxAbsXY
 * @returns {boolean}
 */
function withinBounds(steps, maxAbsZ, maxAbsXY) {
  if (Math.abs(steps[0]) > maxAbsXY) return false;
  if (Math.abs(steps[1]) > maxAbsXY) return false;
  if (Math.abs(steps[2]) > maxAbsZ) return false;
  return true;
}

/**
 * @param {GridSteps} steps
 * @param {GridSteps | null} hint
 * @returns {number}
 */
function hintDistanceSq(steps, hint) {
  if (!hint) return 0;
  const dx = steps[0] - hint[0];
  const dy = steps[1] - hint[1];
  const dz = steps[2] - hint[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Attempt to place the component with bounded Z extent.
 *
 * @param {string[]} nodeIds
 * @param {Map<string, Set<string>>} adjacency
 * @param {string} rootId
 * @param {GridSteps} rootSteps
 * @param {GridSteps[]} vectors
 * @param {Set<string>} vectorKeys
 * @param {Map<string, GridSteps>} hints
 * @param {number} maxAbsZ
 * @param {number} maxAbsXY
 * @param {number} maxCalls
 * @returns {Map<string, GridSteps> | null}
 */
function embedComponent(
  nodeIds,
  adjacency,
  rootId,
  rootSteps,
  vectors,
  vectorKeys,
  hints,
  maxAbsZ,
  maxAbsXY,
  maxCalls,
) {
  /** @type {Map<string, GridSteps>} */
  const placed = new Map();
  /** @type {Set<string>} */
  const occupied = new Set();

  let calls = 0;

  /**
   * @param {string} nodeId
   * @returns {GridSteps[]}
   */
  function candidatesFor(nodeId) {
    const neighbors = adjacency.get(nodeId);
    if (!neighbors) return [];
    const placedNeighbors = [];
    neighbors.forEach(neighbor => {
      if (placed.has(neighbor)) placedNeighbors.push(neighbor);
    });
    if (!placedNeighbors.length) return [];

    const firstNeighborId = placedNeighbors[0];
    const firstSteps = placed.get(firstNeighborId);
    if (!firstSteps) return [];

    /** @type {GridSteps[]} */
    let candidates = vectors.map(vector => addSteps(firstSteps, vector));

    for (let i = 1; i < placedNeighbors.length; i += 1) {
      const neighborId = placedNeighbors[i];
      const neighborSteps = placed.get(neighborId);
      if (!neighborSteps) continue;

      candidates = candidates.filter(candidate => {
        const delta = diffSteps(candidate, neighborSteps);
        return vectorKeys.has(stepsKey(delta));
      });
      if (!candidates.length) break;
    }

    candidates = candidates.filter(candidate => {
      if (!withinBounds(candidate, maxAbsZ, maxAbsXY)) return false;
      return !occupied.has(stepsKey(candidate));
    });

    const hint = hints.get(nodeId) ?? null;
    candidates.sort((a, b) => {
      const az = absZ(a);
      const bz = absZ(b);
      if (az !== bz) return az - bz;
      const ha = hintDistanceSq(a, hint);
      const hb = hintDistanceSq(b, hint);
      if (ha !== hb) return ha - hb;
      return absManhattan(a) - absManhattan(b);
    });

    return candidates;
  }

  /**
   * @returns {boolean}
   */
  function placeNext() {
    calls += 1;
    if (calls > maxCalls) return false;

    if (placed.size === nodeIds.length) return true;

    /** @type {{ id: string, candidates: GridSteps[] } | null} */
    let chosen = null;

    nodeIds.forEach(nodeId => {
      if (placed.has(nodeId)) return;
      const neighbors = adjacency.get(nodeId);
      if (!neighbors) return;

      let hasPlacedNeighbor = false;
      neighbors.forEach(neighborId => {
        if (placed.has(neighborId)) hasPlacedNeighbor = true;
      });
      if (!hasPlacedNeighbor) return;

      const candidates = candidatesFor(nodeId);
      if (!candidates.length) {
        chosen = { id: nodeId, candidates };
        return;
      }

      if (!chosen) {
        chosen = { id: nodeId, candidates };
        return;
      }

      if (candidates.length !== chosen.candidates.length) {
        if (candidates.length < chosen.candidates.length) {
          chosen = { id: nodeId, candidates };
        }
        return;
      }

      const degree = adjacency.get(nodeId)?.size ?? 0;
      const chosenDegree = adjacency.get(chosen.id)?.size ?? 0;
      if (degree !== chosenDegree) {
        if (degree > chosenDegree) chosen = { id: nodeId, candidates };
        return;
      }

      if (nodeId < chosen.id) chosen = { id: nodeId, candidates };
    });

    if (!chosen) return false;
    if (!chosen.candidates.length) return false;

    const nodeId = chosen.id;
    const neighbors = adjacency.get(nodeId) ?? new Set();

    for (let index = 0; index < chosen.candidates.length; index += 1) {
      const candidate = chosen.candidates[index];
      const key = stepsKey(candidate);
      placed.set(nodeId, candidate);
      occupied.add(key);

      let ok = true;
      neighbors.forEach(neighborId => {
        if (!ok) return;
        if (placed.has(neighborId)) return;
        if (!candidatesFor(neighborId).length) ok = false;
      });

      if (ok && placeNext()) return true;

      placed.delete(nodeId);
      occupied.delete(key);
    }

    return false;
  }

  placed.set(rootId, rootSteps);
  occupied.add(stepsKey(rootSteps));

  return placeNext() ? placed : null;
}

/**
 * Compute a lattice embedding for the graph.
 *
 * The solution uses integer grid vertices and ensures no two node IDs share a
 * vertex. Z is introduced only when required by the constraints, by searching
 * in increasing Z bounds (`|z| <= 0`, then `|z| <= 1`, ...).
 *
 * @param {VisGraph} graph
 * @param {string} rootId
 * @param {{
 *   edgeKinds?: string[],
 *   edgeSquaredSteps?: number,
 *   maxZ?: number,
 *   maxCalls?: number,
 *   hints?: Map<string, [number, number, number]>
 * }} [options]
 * @returns {LatticeEmbedding | null}
 */
export function embedGraphToLattice(graph, rootId, options = {}) {
  const edgeKinds = new Set(options.edgeKinds ?? ['child', 'reentry', 'value']);
  const edgeSquaredSteps = options.edgeSquaredSteps ?? 2;
  const vectors = stepVectors(edgeSquaredSteps);
  const vectors2D = vectors.filter(vector => vector[2] === 0);
  const vectorKeys = vectorKeySet(vectors);
  const vectorKeys2D = vectorKeySet(vectors2D);

  const adjacency = constraintAdjacency(graph, edgeKinds);
  const components = connectedComponents(adjacency)
    .map(component => component.slice().sort())
    .sort((a, b) => {
      const hasRootA = a.includes(rootId);
      const hasRootB = b.includes(rootId);
      if (hasRootA !== hasRootB) return hasRootA ? -1 : 1;
      const a0 = a[0] ?? '';
      const b0 = b[0] ?? '';
      return a0.localeCompare(b0);
    });

  const nodeCount = adjacency.size;
  const maxZ = Math.max(0, Math.floor(options.maxZ ?? nodeCount));
  const maxCalls = Math.max(5_000, Math.floor(options.maxCalls ?? 250_000));
  const maxAbsXY = Math.max(4, nodeCount * 3);
  const componentGap = maxAbsXY * 2 + 8;
  /** @type {Map<string, GridSteps>} */
  const hints = new Map();
  options.hints?.forEach((value, nodeId) => {
    hints.set(nodeId, [
      Math.round(value[0]),
      Math.round(value[1]),
      Math.round(value[2]),
    ]);
  });

  /** @type {Map<string, GridSteps>} */
  const combined = new Map();

  let componentIndex = 0;
  for (const componentNodes of components) {
    const componentRoot = componentNodes.includes(rootId)
      ? rootId
      : componentNodes[0] ?? rootId;

    const rootSteps = /** @type {GridSteps} */ ([0, 0, 0]);
    const offsetX = componentNodes.includes(rootId)
      ? 0
      : componentIndex * componentGap;

    let embedded = null;

    for (let zLimit = 0; zLimit <= maxZ; zLimit += 1) {
      const use2D = zLimit === 0;
      const chosenVectors = use2D ? vectors2D : vectors;
      const chosenKeys = use2D ? vectorKeys2D : vectorKeys;
      embedded = embedComponent(
        componentNodes,
        adjacency,
        componentRoot,
        rootSteps,
        chosenVectors,
        chosenKeys,
        hints,
        zLimit,
        maxAbsXY,
        maxCalls,
      );
      if (embedded) break;
    }

    if (!embedded) return null;

    embedded.forEach((steps, nodeId) => {
      combined.set(nodeId, [steps[0] + offsetX, steps[1], steps[2]]);
    });

    componentIndex += 1;
  }

  let maxAbsZValue = 0;
  combined.forEach(steps => {
    const z = absZ(steps);
    if (z > maxAbsZValue) maxAbsZValue = z;
  });

  return { positions: combined, maxAbsZ: maxAbsZValue };
}
