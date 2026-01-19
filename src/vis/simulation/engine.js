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

import { childAdjacency, layoutGraphPositions } from './layout.js';

import { invariant } from '../../utils.js';
import { getPhysicsRuntime } from './runtime.js';

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
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Exponentially approach `target` from `current`.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} dt
 * @param {number} rate
 * @returns {number}
 */
function approach(current, target, dt, rate) {
  const alpha = 1 - Math.exp(-Math.max(0, dt) * Math.max(0, rate));
  return current + (target - current) * alpha;
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
 * Cast a `Constraint` wrapper to a `DistanceConstraint` wrapper.
 *
 * The WebIDL bindings return `Constraint` from `Create`, so `castObject`
 * produces a second wrapper. We drop the base wrapper from the cache to avoid
 * leaking it (the returned wrapper is used for the engine lifetime).
 *
 * @param {any} Jolt
 * @param {any} baseConstraint
 * @returns {any}
 */
function castDistanceConstraint(Jolt, baseConstraint) {
  const distanceConstraint = Jolt.castObject(
    baseConstraint,
    Jolt.DistanceConstraint,
  );
  const cache = Jolt.getCache(baseConstraint.oDa);
  delete cache[baseConstraint.nDa];
  return distanceConstraint;
}

/**
 * @param {Map<string, [number, number, number]>} positions
 * @returns {number}
 */
function layoutRadiusFromPositions(positions) {
  let radius = 0;
  positions.forEach(pos => {
    const [x, y, z] = pos;
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length > radius) radius = length;
  });
  return radius;
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

  const runtime = await getPhysicsRuntime();
  const Jolt = runtime.Jolt;
  const joltInterface = runtime.joltInterface;
  const physicsSystem = runtime.physicsSystem;
  const bodyInterface = runtime.bodyInterface;
  const layerNonMoving = runtime.layerNonMoving;
  const layerMoving = runtime.layerMoving;

  const nodeIds = graph.nodes();
  const nodeIndexById = new Map(
    nodeIds.map((nodeId, index) => [nodeId, index]),
  );
  const positions = new Float32Array(nodeIds.length * 3);
  const initialPositions = layoutGraphPositions(graph, rootId, nodeRadius);
  const layoutRadius = layoutRadiusFromPositions(initialPositions);
  const sphereShape = new Jolt.SphereShape(nodeRadius);
  sphereShape.AddRef();
  const zeroVelocity = new Jolt.Vec3(0, 0, 0);
  const identityRotation = new Jolt.Quat(0, 0, 0, 1);

  const bodies = new Map();
  nodeIds.forEach(nodeId => {
    const position = initialPositions.get(nodeId) ?? [0, 0, 0];
    const [x, y, z] = position;

    const motionType =
      nodeId === rootId ? Jolt.EMotionType_Static : Jolt.EMotionType_Dynamic;
    const layer = motionType === Jolt.EMotionType_Static
      ? layerNonMoving
      : layerMoving;

    const positionVec = new Jolt.RVec3(x, y, z);
    const bodySettings = new Jolt.BodyCreationSettings(
      sphereShape,
      positionVec,
      identityRotation,
      motionType,
      layer,
    );
    bodySettings.mGravityFactor = 0;
    bodySettings.mLinearDamping = 0.7;
    bodySettings.mAngularDamping = 0.7;
    bodySettings.mFriction = 0;
    bodySettings.mRestitution = 0;
    bodySettings.mMaxLinearVelocity = 25;
    bodySettings.mMaxAngularVelocity = 25;
    bodySettings.mAllowSleeping = false;

    const body = bodyInterface.CreateBody(bodySettings);
    bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    bodies.set(nodeId, body);
    Jolt.destroy(bodySettings);
    Jolt.destroy(positionVec);
  });

  const anchorBodies = new Map();
  nodeIds.forEach(nodeId => {
    if (nodeId === rootId) return;
    const position = initialPositions.get(nodeId) ?? [0, 0, 0];

    const anchorPosition = new Jolt.RVec3(...position);
    const anchorSettings = new Jolt.BodyCreationSettings(
      sphereShape,
      anchorPosition,
      identityRotation,
      Jolt.EMotionType_Static,
      layerNonMoving,
    );
    anchorSettings.mGravityFactor = 0;

    const anchorBody = bodyInterface.CreateBody(anchorSettings);
    bodyInterface.AddBody(
      anchorBody.GetID(),
      Jolt.EActivation_DontActivate,
    );
    anchorBodies.set(nodeId, anchorBody);
    Jolt.destroy(anchorSettings);
    Jolt.destroy(anchorPosition);
  });

  const pointerCycles = pointerAdjacency(graph);
  const childFrequency = 8.0;
  const childDamping = 0.88;
  const childRange = 0.03;
  const siblingFrequency = 4.5;
  const siblingDamping = 0.92;
  const siblingRange = 0.06;
  /** @type {any[]} */
  const constraints = [];
  /** @type {Segment[]} */
  const segments = [];
  /** @type {{
   *   kind: 'reentry' | 'value',
   *   constraint: any,
   *   rest: number,
   *   baseFrequency: number,
   *   baseDamping: number
   * }[]} */
  const pointerConstraints = [];
  /** @type {{
   *   constraint: any
   * }[]} */
  const anchorConstraints = [];

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
    const baseFrequency = isCycle ? 1.5 : 4.0;
    const baseDamping = isCycle ? 0.9 : 0.75;

    const constraintSettings = new Jolt.DistanceConstraintSettings();
    constraintSettings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    const point1 = new Jolt.RVec3(...aPos);
    const point2 = new Jolt.RVec3(...bPos);
    constraintSettings.mPoint1 = point1;
    constraintSettings.mPoint2 = point2;

    if (isPointer) {
      constraintSettings.mMinDistance = rest * 0.8;
      constraintSettings.mMaxDistance = rest * 1.2;

      const spring = constraintSettings.mLimitsSpringSettings;
      spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
      spring.mFrequency = baseFrequency;
      spring.mDamping = baseDamping;
    } else {
      constraintSettings.mMinDistance = Math.max(0, rest * (1 - childRange));
      constraintSettings.mMaxDistance = rest * (1 + childRange);

      const spring = constraintSettings.mLimitsSpringSettings;
      spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
      spring.mFrequency = childFrequency;
      spring.mDamping = childDamping;
    }

    const baseConstraint = constraintSettings.Create(bodyA, bodyB);
    const distanceConstraint = castDistanceConstraint(Jolt, baseConstraint);
    distanceConstraint.AddRef();
    physicsSystem.AddConstraint(distanceConstraint);
    constraints.push(distanceConstraint);
    Jolt.destroy(constraintSettings);
    Jolt.destroy(point1);
    Jolt.destroy(point2);

    if (isPointer) {
      pointerConstraints.push({
        kind,
        constraint: distanceConstraint,
        rest,
        baseFrequency,
        baseDamping,
      });
    }

    const fromIndex = nodeIndexById.get(source);
    const toIndex = nodeIndexById.get(target);
    if (typeof fromIndex === 'number' && typeof toIndex === 'number') {
      segments.push({ kind, fromIndex, toIndex });
    }
  });

  const childrenByParent = childAdjacency(graph);
  childrenByParent.forEach(children => {
    const leftId = children[0];
    const rightId = children[1];
    if (!leftId || !rightId) return;

    const bodyA = bodies.get(leftId);
    const bodyB = bodies.get(rightId);
    if (!bodyA || !bodyB) return;

    const aPos = initialPositions.get(leftId) ?? [0, 0, 0];
    const bPos = initialPositions.get(rightId) ?? [0, 0, 0];
    const rest = Math.max(0.4, distance(...aPos, ...bPos));

    const constraintSettings = new Jolt.DistanceConstraintSettings();
    constraintSettings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    const point1 = new Jolt.RVec3(...aPos);
    const point2 = new Jolt.RVec3(...bPos);
    constraintSettings.mPoint1 = point1;
    constraintSettings.mPoint2 = point2;
    constraintSettings.mMinDistance = Math.max(0, rest * (1 - siblingRange));
    constraintSettings.mMaxDistance = rest * (1 + siblingRange);

    const spring = constraintSettings.mLimitsSpringSettings;
    spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
    spring.mFrequency = siblingFrequency;
    spring.mDamping = siblingDamping;

    const baseConstraint = constraintSettings.Create(bodyA, bodyB);
    const distanceConstraint = castDistanceConstraint(Jolt, baseConstraint);
    distanceConstraint.AddRef();
    physicsSystem.AddConstraint(distanceConstraint);
    constraints.push(distanceConstraint);
    Jolt.destroy(constraintSettings);
    Jolt.destroy(point1);
    Jolt.destroy(point2);
  });

  const anchorTight = 0;
  const anchorLoose = Math.max(layoutRadius * 2, nodeRadius * 80, 12);
  const anchorBaseFrequency = 14;
  const anchorMinFrequency = 0.4;
  const anchorDamping = 0.95;

  nodeIds.forEach(nodeId => {
    if (nodeId === rootId) return;
    const body = bodies.get(nodeId);
    const anchor = anchorBodies.get(nodeId);
    if (!body || !anchor) return;

    const position = initialPositions.get(nodeId) ?? [0, 0, 0];
    const constraintSettings = new Jolt.DistanceConstraintSettings();
    constraintSettings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    const point1 = new Jolt.RVec3(...position);
    const point2 = new Jolt.RVec3(...position);
    constraintSettings.mPoint1 = point1;
    constraintSettings.mPoint2 = point2;
    constraintSettings.mMinDistance = 0;
    constraintSettings.mMaxDistance = anchorLoose;

    const spring = constraintSettings.mLimitsSpringSettings;
    spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
    spring.mFrequency = anchorBaseFrequency;
    spring.mDamping = anchorDamping;

    const baseConstraint = constraintSettings.Create(body, anchor);
    const distanceConstraint = castDistanceConstraint(Jolt, baseConstraint);
    distanceConstraint.AddRef();
    physicsSystem.AddConstraint(distanceConstraint);
    constraints.push(distanceConstraint);
    anchorConstraints.push({ constraint: distanceConstraint });
    Jolt.destroy(constraintSettings);
    Jolt.destroy(point1);
    Jolt.destroy(point2);
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

  let pointerFoldTarget = 0;
  let pointerFoldCurrent = 0;
  const foldResponse = 10;
  let snappedAtRest = false;

  /**
   * @param {number} fold
   * @returns {void}
   */
  function applyPointerFold(fold) {
    const clamped = clamp(fold, 0, 1);
    const collapsedBase = nodeRadius * 2.2;
    const range = lerp(0.2, 0.05, clamped);

    pointerConstraints.forEach(entry => {
      const collapsed = Math.min(entry.rest, collapsedBase);
      const target = lerp(entry.rest, collapsed, clamped);
      const minDistance = Math.max(0, target * (1 - range));
      const maxDistance = target * (1 + range);

      entry.constraint.SetDistance(minDistance, maxDistance);

      const spring = entry.constraint.GetLimitsSpringSettings();
      spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
      spring.mFrequency = lerp(
        entry.baseFrequency,
        entry.baseFrequency * 1.8,
        clamped,
      );
      spring.mDamping = lerp(entry.baseDamping, 0.95, clamped);
      entry.constraint.SetLimitsSpringSettings(spring);
      bodyInterface.ActivateConstraint(entry.constraint);
    });

    const anchorMaxDistance = lerp(anchorTight, anchorLoose, clamped);
    const anchorFrequency = lerp(
      anchorBaseFrequency,
      anchorMinFrequency,
      clamped,
    );

    anchorConstraints.forEach(entry => {
      entry.constraint.SetDistance(0, anchorMaxDistance);
      const spring = entry.constraint.GetLimitsSpringSettings();
      spring.mMode = Jolt.ESpringMode_FrequencyAndDamping;
      spring.mFrequency = anchorFrequency;
      spring.mDamping = anchorDamping;
      entry.constraint.SetLimitsSpringSettings(spring);
      bodyInterface.ActivateConstraint(entry.constraint);
    });
  }

  /**
   * @param {number} fold
   * @returns {void}
   */
  function setPointerFold(fold) {
    pointerFoldTarget = clamp(fold, 0, 1);
  }

  applyPointerFold(pointerFoldCurrent);

  /**
   * @returns {void}
   */
  function snapToInitialPose() {
    nodeIds.forEach(nodeId => {
      if (nodeId === rootId) return;
      const body = bodies.get(nodeId);
      if (!body) return;
      const position = initialPositions.get(nodeId) ?? [0, 0, 0];
      const target = new Jolt.RVec3(...position);
      bodyInterface.SetPositionRotationAndVelocity(
        body.GetID(),
        target,
        identityRotation,
        zeroVelocity,
        zeroVelocity,
      );
      Jolt.destroy(target);
    });
  }

  /**
   * @returns {void}
   */
  function maybeSnapAtRest() {
    const epsilon = 1e-3;
    const resting =
      pointerFoldTarget <= epsilon && pointerFoldCurrent <= epsilon;
    if (!resting) {
      snappedAtRest = false;
      return;
    }
    if (snappedAtRest) return;
    snappedAtRest = true;
    snapToInitialPose();
  }

  /**
   * @param {number} deltaSeconds
   * @returns {void}
   */
  function step(deltaSeconds) {
    const dt = clamp(deltaSeconds, 0, 1 / 30);
    const nextFold = approach(
      pointerFoldCurrent,
      pointerFoldTarget,
      dt,
      foldResponse,
    );
    if (Math.abs(nextFold - pointerFoldCurrent) > 1e-4) {
      pointerFoldCurrent = nextFold;
      applyPointerFold(pointerFoldCurrent);
    }

    const subSteps = 4;
    joltInterface.Step(dt, subSteps);
    maybeSnapAtRest();
    syncPositions();
  }

  /**
   * @returns {void}
   */
  function dispose() {
    constraints.forEach(constraint => {
      physicsSystem.RemoveConstraint(constraint);
      constraint.Release();
    });

    bodies.forEach(body => {
      const bodyId = body.GetID();
      bodyInterface.RemoveBody(bodyId);
      bodyInterface.DestroyBody(bodyId);
    });

    anchorBodies.forEach(body => {
      const bodyId = body.GetID();
      bodyInterface.RemoveBody(bodyId);
      bodyInterface.DestroyBody(bodyId);
    });

    sphereShape.Release();
    Jolt.destroy(zeroVelocity);
    Jolt.destroy(identityRotation);
  }

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
