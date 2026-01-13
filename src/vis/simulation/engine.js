/**
 * Simulation: Jolt physics engine
 * ------------------------------
 *
 * Builds a physics world where graph nodes are spheres. Edges become
 * DistanceConstraints.
 *
 * Re-entrant pointer edges can form cycles (e.g. fixpoint combinators). Those
 * constraints are treated as springs to keep the solver stable.
 */

import initJolt from 'jolt-physics/wasm';
import joltWasmUrl from 'jolt-physics/jolt-physics.wasm.wasm?url';

import { invariant } from '../../utils.js';

let joltModulePromise = null;

/**
 * Load (and cache) the Jolt WASM module.
 *
 * @returns {Promise<any>}
 */
function loadJolt() {
  if (!joltModulePromise) {
    joltModulePromise = initJolt({ locateFile: () => joltWasmUrl });
  }
  return joltModulePromise;
}

/**
 * @typedef {import('graphology').MultiDirectedGraph} VisGraph
 */

/**
 * @typedef {{
 *   kind: string,
 *   fromIndex: number,
 *   toIndex: number
 * }} Segment
 */

/**
 * @typedef {{
 *   nodeIds: string[],
 *   nodeIndexById: Map<string, number>,
 *   positions: Float32Array,
 *   segments: Segment[],
 *   step: (deltaSeconds: number) => void,
 *   dispose: () => void
 * }} PhysicsEngine
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} az
 * @param {number} bx
 * @param {number} by
 * @param {number} bz
 * @returns {number}
 */
function distance(ax, ay, az, bx, by, bz) {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Collect `child` edges into a parent → [left,right] map.
 *
 * @param {VisGraph} graph
 * @returns {Map<string, (string | null)[]>}
 */
function childAdjacency(graph) {
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
 * @param {string} kind
 * @param {number} step
 * @returns {number}
 */
function zOffsetForChildKind(kind, step) {
  if (kind === 'binder') return -step * 0.7;
  if (kind === 'slot') return step * 0.7;
  return 0;
}

/**
 * Produce deterministic initial positions from the reachable graph.
 *
 * @param {VisGraph} graph
 * @param {string} rootId
 * @returns {Map<string, [number, number, number]>}
 */
function layoutGraphPositions(graph, rootId) {
  const spacing = 2.2;
  const positions = new Map();
  const childrenByParent = childAdjacency(graph);

  const queue = [{ nodeId: rootId, x: 0, y: 0, z: 0, depth: 0 }];
  positions.set(rootId, [0, 0, 0]);

  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    const children = childrenByParent.get(item.nodeId);
    if (!children) continue;

    const depthScale = 1 / (1 + item.depth * 0.35);
    const step = spacing * depthScale;
    const nextY = item.y - step;

    const [left, right] = children;
    if (left) {
      const x = item.x - step;
      const kind = String(graph.getNodeAttributes(left)?.kind ?? '');
      const z = item.z + zOffsetForChildKind(kind, step);
      if (!positions.has(left)) {
        positions.set(left, [x, nextY, z]);
        queue.push({
          nodeId: left,
          x,
          y: nextY,
          z,
          depth: item.depth + 1,
        });
      }
    }

    if (right) {
      const x = item.x + step;
      const kind = String(graph.getNodeAttributes(right)?.kind ?? '');
      const z = item.z + zOffsetForChildKind(kind, step);
      if (!positions.has(right)) {
        positions.set(right, [x, nextY, z]);
        queue.push({
          nodeId: right,
          x,
          y: nextY,
          z,
          depth: item.depth + 1,
        });
      }
    }
  }

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

  return positions;
}

/**
 * Build adjacency over pointer edges (`reentry` + `value`) for cycle checks.
 *
 * @param {VisGraph} graph
 * @returns {Map<string, Set<string>>}
 */
function pointerAdjacency(graph) {
  const adjacency = new Map();

  graph.forEachEdge((edgeKey, attrs, source, target) => {
    const kind = attrs?.kind;
    if (kind !== 'reentry' && kind !== 'value') return;
    const set = adjacency.get(source) ?? new Set();
    set.add(target);
    adjacency.set(source, set);
  });

  return adjacency;
}

/**
 * Check whether `start` can reach `goal` via `adjacency`.
 *
 * @param {Map<string, Set<string>>} adjacency
 * @param {string} start
 * @param {string} goal
 * @returns {boolean}
 */
function hasPath(adjacency, start, goal) {
  if (start === goal) return true;

  const visited = new Set([start]);
  const queue = [start];

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    const next = adjacency.get(current);
    if (!next) continue;
    for (const neighbor of next) {
      if (neighbor === goal) return true;
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return false;
}

/**
 * Decide whether an edge should be treated as a spring rather than rigid.
 *
 * This heuristic approximates "Y-like" self reference: a re-entry edge that
 * participates in a pointer cycle.
 *
 * @param {VisGraph} graph
 * @param {string} edgeKey
 * @param {Map<string, Set<string>>} adjacency
 * @returns {boolean}
 */
function edgeIsSpring(graph, edgeKey, adjacency) {
  const attrs = graph.getEdgeAttributes(edgeKey);
  if (attrs?.kind !== 'reentry') return false;

  const source = graph.source(edgeKey);
  const target = graph.target(edgeKey);
  return hasPath(adjacency, target, source);
}

/**
 * Create a physics engine for the provided graph state.
 *
 * @param {{
 *   graph: VisGraph,
 *   rootId: string,
 *   nodeRadius?: number
 * }} params
 * @returns {Promise<PhysicsEngine>}
 */
export async function createPhysicsEngine(params) {
  const nodeRadius = params.nodeRadius ?? 0.18;
  const graph = params.graph;
  const rootId = params.rootId;

  invariant(typeof rootId === 'string', 'rootId must be a string');
  invariant(graph && typeof graph === 'object', 'graph is required');

  const Jolt = await loadJolt();

  const layerNonMoving = 0;
  const layerMoving = 1;
  const bpLayerNonMoving = 0;
  const bpLayerMoving = 1;
  const numObjectLayers = 2;
  const numBroadPhaseLayers = 2;

  const objectLayerPairFilter = new Jolt.ObjectLayerPairFilterTable(
    numObjectLayers,
  );
  objectLayerPairFilter.EnableCollision(layerNonMoving, layerMoving);
  objectLayerPairFilter.EnableCollision(layerMoving, layerMoving);

  const broadPhaseLayerInterface = new Jolt.BroadPhaseLayerInterfaceTable(
    numObjectLayers,
    numBroadPhaseLayers,
  );
  broadPhaseLayerInterface.MapObjectToBroadPhaseLayer(
    layerNonMoving,
    new Jolt.BroadPhaseLayer(bpLayerNonMoving),
  );
  broadPhaseLayerInterface.MapObjectToBroadPhaseLayer(
    layerMoving,
    new Jolt.BroadPhaseLayer(bpLayerMoving),
  );

  const objectVsBroadPhaseLayerFilter =
    new Jolt.ObjectVsBroadPhaseLayerFilterTable(
      broadPhaseLayerInterface,
      numBroadPhaseLayers,
      objectLayerPairFilter,
      numObjectLayers,
    );

  const settings = new Jolt.JoltSettings();
  settings.mMaxBodies = 10_000;
  settings.mMaxBodyPairs = 10_000;
  settings.mMaxContactConstraints = 10_000;
  settings.mBroadPhaseLayerInterface = broadPhaseLayerInterface;
  settings.mObjectVsBroadPhaseLayerFilter = objectVsBroadPhaseLayerFilter;
  settings.mObjectLayerPairFilter = objectLayerPairFilter;

  const joltInterface = new Jolt.JoltInterface(settings);
  const physicsSystem = joltInterface.GetPhysicsSystem();
  physicsSystem.SetGravity(new Jolt.Vec3(0, 0, 0));
  const bodyInterface = physicsSystem.GetBodyInterface();

  const floorShape = new Jolt.BoxShape(new Jolt.Vec3(25, 0.5, 25));
  const floorBodySettings = new Jolt.BodyCreationSettings(
    floorShape,
    new Jolt.RVec3(0, -8, 0),
    new Jolt.Quat(0, 0, 0, 1),
    Jolt.EMotionType_Static,
    layerNonMoving,
  );
  const floorBody = bodyInterface.CreateBody(floorBodySettings);
  bodyInterface.AddBody(floorBody.GetID(), Jolt.EActivation_Activate);
  Jolt.destroy(floorBodySettings);

  const nodeIds = graph.nodes();
  const nodeIndexById = new Map(
    nodeIds.map((nodeId, index) => [nodeId, index]),
  );
  const positions = new Float32Array(nodeIds.length * 3);
  const initialPositions = layoutGraphPositions(graph, rootId);
  const sphereShape = new Jolt.SphereShape(nodeRadius);

  const bodies = new Map();
  nodeIds.forEach(nodeId => {
    const position = initialPositions.get(nodeId) ?? [0, 0, 0];
    const [x, y, z] = position;

    const motionType =
      nodeId === rootId ? Jolt.EMotionType_Static : Jolt.EMotionType_Dynamic;
    const layer = motionType === Jolt.EMotionType_Static
      ? layerNonMoving
      : layerMoving;

    const bodySettings = new Jolt.BodyCreationSettings(
      sphereShape,
      new Jolt.RVec3(x, y, z),
      new Jolt.Quat(0, 0, 0, 1),
      motionType,
      layer,
    );
    bodySettings.mGravityFactor = 0;
    bodySettings.mLinearDamping = 0.25;
    bodySettings.mAngularDamping = 0.25;

    const body = bodyInterface.CreateBody(bodySettings);
    bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    bodies.set(nodeId, body);
    Jolt.destroy(bodySettings);
  });

  const pointerCycles = pointerAdjacency(graph);
  const constraints = [];
  const segments = [];

  graph.forEachEdge((edgeKey, attrs, source, target) => {
    const kind = attrs?.kind;
    if (kind !== 'child' && kind !== 'reentry' && kind !== 'value') return;

    const bodyA = bodies.get(source);
    const bodyB = bodies.get(target);
    if (!bodyA || !bodyB) return;

    const aPos = initialPositions.get(source) ?? [0, 0, 0];
    const bPos = initialPositions.get(target) ?? [0, 0, 0];
    const rest = Math.max(0.4, distance(...aPos, ...bPos));
    const isPointer = kind === 'reentry' || kind === 'value';
    const isCycle = isPointer && edgeIsSpring(graph, edgeKey, pointerCycles);

    const constraintSettings = new Jolt.DistanceConstraintSettings();
    constraintSettings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    constraintSettings.mPoint1 = new Jolt.RVec3(...aPos);
    constraintSettings.mPoint2 = new Jolt.RVec3(...bPos);

    if (isPointer) {
      constraintSettings.mMinDistance = rest * 0.8;
      constraintSettings.mMaxDistance = rest * 1.2;

      const spring = constraintSettings.mLimitsSpringSettings;
      spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
      spring.mFrequency = isCycle ? 1.5 : 4.0;
      spring.mDamping = isCycle ? 0.9 : 0.75;
    } else {
      constraintSettings.mMinDistance = rest;
      constraintSettings.mMaxDistance = rest;
    }

    const constraint = constraintSettings.Create(bodyA, bodyB);
    physicsSystem.AddConstraint(constraint);
    constraints.push(constraint);
    Jolt.destroy(constraintSettings);

    const fromIndex = nodeIndexById.get(source);
    const toIndex = nodeIndexById.get(target);
    if (typeof fromIndex === 'number' && typeof toIndex === 'number') {
      segments.push({ kind, fromIndex, toIndex });
    }
  });

  /**
   * @returns {void}
   */
  function syncPositions() {
    nodeIds.forEach((nodeId, index) => {
      const body = bodies.get(nodeId);
      if (!body) return;
      const position = body.GetPosition();
      const base = index * 3;
      positions[base] = position.GetX();
      positions[base + 1] = position.GetY();
      positions[base + 2] = position.GetZ();
    });
  }

  syncPositions();

  /**
   * @param {number} deltaSeconds
   * @returns {void}
   */
  function step(deltaSeconds) {
    const dt = clamp(deltaSeconds, 0, 1 / 15);
    joltInterface.Step(dt, 1);
    syncPositions();
  }

  /**
   * @returns {void}
   */
  function dispose() {
    constraints.forEach(constraint => {
      physicsSystem.RemoveConstraint(constraint);
    });

    bodies.forEach(body => {
      const bodyId = body.GetID();
      bodyInterface.RemoveBody(bodyId);
      bodyInterface.DestroyBody(bodyId);
    });

    bodyInterface.RemoveBody(floorBody.GetID());
    bodyInterface.DestroyBody(floorBody.GetID());

    Jolt.destroy(joltInterface);
  }

  return {
    nodeIds,
    nodeIndexById,
    positions,
    segments,
    step,
    dispose,
  };
}
