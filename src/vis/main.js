/**
 * Visualizer entry point (Vite)
 * ----------------------------
 *
 * "Hello World" target:
 * - build a graph for `(((S a) b) c)`
 * - inline `S` then step reducer events
 * - render a deterministic observer sheet (Jolt optional)
 */

import programSource from '../../programs/sk-basis.lisp?raw';

import {
  canStepForward,
  actionLog,
  createHelloWorldSession,
  setCompaction,
  present,
  presentFrame,
  stepBack,
  stepForward,
  totals,
} from './domain/session.js';

import { createScene } from './view/scene.js';

/**
 * @typedef {'direct' | 'path'} TransitionStyle
 */

/**
 * @typedef {'layout' | 'unit' | 'lattice'} EdgeLengthMode
 */

/**
 * @typedef {'none' | 'xy' | 'xz' | 'yz' | 'xyz'} GridMode
 */

/**
 * @param {string | null} value
 * @returns {'normal-order' | 'multiway-rng'}
 */
function parseModeParam(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (
    normalized === 'multiway' ||
    normalized === 'multi' ||
    normalized === 'rng' ||
    normalized === 'random' ||
    normalized === 'stochastic'
  ) {
    return 'multiway-rng';
  }
  return 'normal-order';
}

/**
 * @param {string | null} value
 * @returns {'sheet' | 'jolt'}
 */
function parseBackendParam(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (normalized === 'jolt' || normalized === 'physics') return 'jolt';
  return 'sheet';
}

/**
 * @param {string | null} value
 * @returns {import('../graph/compact.js').GraphCompaction}
 */
function parseCompactParam(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (normalized === 'full' || normalized === 'readback') {
    return 'full';
  }
  if (
    normalized === 'intern' ||
    normalized === 'compact' ||
    normalized === 'min' ||
    normalized === '1' ||
    normalized === 'true'
  ) {
    return 'intern';
  }
  return 'none';
}

/**
 * @param {string | null} value
 * @returns {TransitionStyle}
 */
function parseTransitionParam(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (
    normalized === 'direct' ||
    normalized === 'lerp' ||
    normalized === 'linear' ||
    normalized === 'straight'
  ) {
    return 'direct';
  }
  if (
    normalized === 'path' ||
    normalized === 'route' ||
    normalized === 'travel'
  ) {
    return 'path';
  }
  return 'path';
}

/**
 * @param {string | null} value
 * @returns {EdgeLengthMode}
 */
function parseEdgesParam(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (
    normalized === 'lattice' ||
    normalized === 'grid' ||
    normalized === 'snap'
  ) {
    return 'lattice';
  }
  if (
    normalized === 'unit' ||
    normalized === 'equal' ||
    normalized === 'rigid' ||
    normalized === '1' ||
    normalized === 'true'
  ) {
    return 'unit';
  }
  return 'layout';
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatError(error) {
  if (error instanceof Error) {
    return String(error.stack ?? error.message);
  }
  return String(error);
}

/**
 * @param {string | null} value
 * @returns {number}
 */
function parseSeedParam(value) {
  const seed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(seed) ? seed : 1;
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function mustGetElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

/**
 * @param {HTMLElement} hud
 * @param {string} text
 * @returns {void}
 */
function setHudText(hud, text) {
  hud.textContent = text;
}

/**
 * @param {import('./domain/session.js').VisState} state
 * @param {{
 *   initial: number,
 *   reduced: number | null,
 *   lastStep: number | null
 * }} totalsValue
 * @param {{ isPlaying: boolean }} playback
 * @param {import('./domain/session.js').VisSession} session
 * @param {'sheet' | 'jolt'} backend
 * @param {TransitionStyle} transitionStyle
 * @param {EdgeLengthMode} edgeLengthMode
 * @param {'perspective' | 'orthographic'} cameraMode
 * @returns {string}
 */
function hudForPresent(
  state,
  totalsValue,
  playback,
  session,
  backend,
  transitionStyle,
  edgeLengthMode,
  cameraMode,
) {
  const lastStep = totalsValue.lastStep ?? '?';
  const reduced = totalsValue.reduced ?? '?';
  const seed = session.seed === null ? '' : ` seed=${session.seed}`;
  const frame = presentFrame(session);
  const decision = frame.decision;
  const candidateCount = decision?.candidateCount ?? 0;
  const picked =
    typeof decision?.choiceIndex === 'number'
      ? decision.choiceIndex + 1
      : null;
  const choice =
    picked === null ? `-/${candidateCount}` : `${picked}/${candidateCount}`;
  const rngState =
    typeof frame.stepperState?.schedulerState === 'number'
      ? ` rng=${frame.stepperState.schedulerState}`
      : '';
  /** @type {string[]} */
  const lines = [
    '3D Combinator Visualizer (Hello World)',
    '',
    `step: ${state.stepIndex}/${lastStep}`,
    `state: ${state.note}`,
    `play: ${playback.isPlaying ? 'playing' : 'paused'}`,
    `backend: ${backend}`,
    `mode: ${session.mode}${seed}`,
    `compact: ${session.compactGraph}`,
    `transition: ${transitionStyle}`,
    `camera: ${cameraMode}`,
  ];
  if (backend === 'jolt') lines.push(`edges: ${edgeLengthMode}`);
  lines.push(
    `choice: ${choice}  scheduler: ${session.schedulerId}${rngState}`,
    `source: ${session.sourceExpr}`,
    `expr: ${state.expr}`,
    'play/pause: Space',
    'step: ←/→',
    'curl: C',
    'camera: O',
    'mode: M',
    'compact: N',
    'transition: T',
  );
  if (backend === 'jolt') lines.push('edges: E');
  lines.push(
    'log: L',
    '',
    `nodes: ${state.graph.order}  edges: ${state.graph.size}`,
    `init nodes: ${totalsValue.initial}`,
    `reduced nodes: ${reduced}`,
  );
  return lines.join('\n');
}

/**
 * @returns {Promise<void>}
 */
async function start() {
  const app = mustGetElement('app');
  const hud = mustGetElement('hud');

  const params = new URLSearchParams(window.location.search);
  let mode = parseModeParam(params.get('mode'));
  const backend = parseBackendParam(params.get('backend'));
  const seed = parseSeedParam(params.get('seed'));
  let compactGraph = parseCompactParam(params.get('compact'));
  let transitionStyle = parseTransitionParam(params.get('transition'));
  let edgeLengthMode = parseEdgesParam(params.get('edges'));
  /** @type {GridMode} */
  let gridMode = 'xy';
  /** @type {'perspective' | 'orthographic'} */
  let cameraMode = 'orthographic';

  const pointerStyle = backend === 'jolt' ? 'lines' : 'arcs';

  /** @type {import('./domain/session.js').VisSession} */
  let session = createHelloWorldSession(programSource, {
    mode,
    seed,
    compactGraph,
  });
  const gridDimensions = session.gridDimensions;

  /** @type {import('./types.js').SimulationEngine | null} */
  let engine = null;

  const vis = createScene({
    container: app,
    pointerStyle,
    gridDimensions,
  });
  vis.setGridMode(gridMode);

  let didFit = false;
  let isPlaying = false;
  let isLoading = false;

  let pointerFold = 0;
  let pointerFoldTarget = 0;

  /** @type {{
   *   engine: import('./types.js').SimulationEngine,
   *   positions: Float32Array,
   *   frame: import('./domain/session.js').Frame
   * } | null} */
  let lastRendered = null;

	  /**
	   * @typedef {{
	   *   kind: 'lerp',
	   *   from: Float32Array,
	   *   to: Float32Array,
	   *   buffer: Float32Array,
	   *   elapsedSeconds: number,
	   *   durationSeconds: number
	   * }} LerpTransition
	   */

	  /**
	   * @typedef {{
	   *   frame: import('./domain/session.js').Frame,
	   *   engine: import('./types.js').SimulationEngine,
	   *   spawnOrigins: Map<string, [number, number, number]>,
	   *   fallback: [number, number, number],
	   *   fit: boolean,
	   *   settleSeconds: number
	   * }} StagedSwap
	   */

	  /**
		   * @typedef {{
		   *   kind: 'travel',
		   *   paths: Float32Array[],
		   *   distances: Float32Array[],
		   *   buffer: Float32Array,
		   *   elapsedSeconds: number,
		   *   durationSeconds: number,
		   *   stagedSwap: StagedSwap
	   * }} TravelTransition
	   */

	  /**
	   * @typedef {LerpTransition | TravelTransition} LayoutTransition
	   */

  /** @type {LayoutTransition | null} */
  let layoutTransition = null;

  const secondsPerStep = 0.8;
  let stepAccumulatorSeconds = 0;
  const curlDurationSeconds = 1;
  const layoutTransitionScale = 1.5;

  /** @type {{
   *   from: number,
   *   to: number,
   *   elapsedSeconds: number
   * } | null} */
  let curlAnimation = null;

  /**
   * @param {number} fold
   * @returns {number}
   */
  function pointerLinkOpacity(fold) {
    const clamped = Math.max(0, Math.min(1, fold));
    const base = pointerStyle === 'lines' ? 0.8 : 0.4;
    return base * (1 - clamped);
  }

  /**
   * @param {import('./domain/session.js').VisState | null} state
   * @returns {void}
   */
	  function renderHud(state = null) {
	    const effectiveState = state ?? present(session);
	    const totalsValue = totals(session);
	    setHudText(
	      hud,
	      hudForPresent(
	        effectiveState,
	        totalsValue,
	        { isPlaying },
	        session,
	        backend,
	        transitionStyle,
	        edgeLengthMode,
	        cameraMode,
	      ),
	    );
	  }

  /**
   * @param {string[]} nodeIds
   * @param {Float32Array} positions
   * @returns {Map<string, [number, number, number]>}
   */
  function positionsById(nodeIds, positions) {
    const map = new Map();
    nodeIds.forEach((nodeId, index) => {
      const base = index * 3;
      map.set(nodeId, [
        positions[base],
        positions[base + 1],
        positions[base + 2],
      ]);
    });
    return map;
  }

  /**
   * @param {Float32Array} out
   * @param {Float32Array} from
   * @param {Float32Array} to
   * @param {number} t
   * @returns {void}
   */
  function lerpPositions(out, from, to, t) {
    const alpha = clamp01(t);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = from[i] + (to[i] - from[i]) * alpha;
    }
  }

  /**
   * @param {Float32Array} out
   * @param {Float32Array[]} paths
   * @param {Float32Array[]} distances
   * @param {number} t
   * @returns {void}
   */
  function sampleWaypointPaths(out, paths, distances, t) {
    const alpha = clamp01(t);
    paths.forEach((path, index) => {
      const pointCount = path.length / 3;
      if (pointCount <= 1) {
        if (path.length < 3) return;
        const outBase = index * 3;
        out[outBase] = path[0];
        out[outBase + 1] = path[1];
        out[outBase + 2] = path[2];
        return;
      }

      const cumulative = distances[index];
      if (!cumulative || cumulative.length !== pointCount) {
        const outBase = index * 3;
        out[outBase] = path[0];
        out[outBase + 1] = path[1];
        out[outBase + 2] = path[2];
        return;
      }

      const totalDistance = cumulative[pointCount - 1] ?? 0;
      if (!(totalDistance > 0)) {
        const outBase = index * 3;
        out[outBase] = path[0];
        out[outBase + 1] = path[1];
        out[outBase + 2] = path[2];
        return;
      }

      const targetDistance = alpha * totalDistance;
      let segment = 0;
      while (
        segment < pointCount - 2 &&
        (cumulative[segment + 1] ?? 0) < targetDistance
      ) {
        segment += 1;
      }
      const fromDistance = cumulative[segment] ?? 0;
      const toDistance = cumulative[segment + 1] ?? fromDistance;
      const span = toDistance - fromDistance;
      const localT = span > 0 ? (targetDistance - fromDistance) / span : 0;
      const fromBase = segment * 3;
      const toBase = (segment + 1) * 3;
      const outBase = index * 3;
      out[outBase] = path[fromBase] +
        (path[toBase] - path[fromBase]) * localT;
      out[outBase + 1] = path[fromBase + 1] +
        (path[toBase + 1] - path[fromBase + 1]) * localT;
      out[outBase + 2] = path[fromBase + 2] +
        (path[toBase + 2] - path[fromBase + 2]) * localT;
    });
  }

  /**
   * @param {[number, number, number]} a
   * @param {[number, number, number]} b
   * @returns {boolean}
   */
  function positionsEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  /**
   * @param {Float32Array} positions
   * @param {number} index
   * @returns {[number, number, number]}
   */
  function tripletAtIndex(positions, index) {
    const base = index * 3;
    return [positions[base], positions[base + 1], positions[base + 2]];
  }

  /**
   * @param {[number, number, number]} start
   * @param {Array<[number, number, number]>} midpoints
   * @param {[number, number, number]} end
   * @returns {Float32Array}
   */
  function buildWaypointPath(start, midpoints, end) {
    /** @type {Array<[number, number, number]>} */
    const points = [start];
    midpoints.forEach(point => {
      const last = points[points.length - 1];
      if (last && positionsEqual(last, point)) return;
      points.push(point);
    });
    const last = points[points.length - 1];
    if (!last || !positionsEqual(last, end)) points.push(end);

    const result = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      const base = index * 3;
      result[base] = point[0];
      result[base + 1] = point[1];
      result[base + 2] = point[2];
    });
    return result;
  }

  /**
   * @param {Float32Array} path
   * @returns {Float32Array}
   */
  function cumulativeWaypointDistances(path) {
    const pointCount = path.length / 3;
    if (pointCount <= 0) return new Float32Array(0);

    const distances = new Float32Array(pointCount);
    let total = 0;
    distances[0] = 0;

    for (let index = 1; index < pointCount; index += 1) {
      const fromBase = (index - 1) * 3;
      const toBase = index * 3;
      const dx = path[toBase] - path[fromBase];
      const dy = path[toBase + 1] - path[fromBase + 1];
      const dz = path[toBase + 2] - path[fromBase + 2];
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
      distances[index] = total;
    }

    return distances;
  }

  /**
   * @param {Map<string, string[]>} adjacency
   * @param {string} startId
   * @param {string} goalId
   * @param {number} maxDepth
   * @returns {string[] | null}
   */
  function shortestNodePath(adjacency, startId, goalId, maxDepth) {
    if (startId === goalId) return [startId];
    if (!adjacency.has(startId) || !adjacency.has(goalId)) return null;

    const queue = [startId];
    let cursor = 0;
    const visited = new Set([startId]);
    const previous = new Map();
    const depth = new Map([[startId, 0]]);

    while (cursor < queue.length) {
      const current = queue[cursor];
      cursor += 1;
      if (!current) continue;

      const currentDepth = depth.get(current) ?? 0;
      if (currentDepth >= maxDepth) continue;

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        previous.set(neighbor, current);
        const nextDepth = currentDepth + 1;
        depth.set(neighbor, nextDepth);

        if (neighbor === goalId) {
          const path = [goalId];
          let back = goalId;
          while (back !== startId) {
            const step = previous.get(back);
            if (!step) return null;
            back = step;
            path.push(back);
          }
          path.reverse();
          return path;
        }

        queue.push(neighbor);
      }
    }

    return null;
  }

  /**
   * @param {import('graphology').MultiDirectedGraph} graph
   * @param {boolean} includePointers
   * @returns {Map<string, string[]>}
   */
  function undirectedAdjacency(graph, includePointers) {
    /** @type {Map<string, Set<string>>} */
    const adjacency = new Map();

    /**
     * @param {string} from
     * @param {string} to
     * @returns {void}
     */
    function link(from, to) {
      const fromSet = adjacency.get(from) ?? new Set();
      fromSet.add(to);
      adjacency.set(from, fromSet);
      const toSet = adjacency.get(to) ?? new Set();
      toSet.add(from);
      adjacency.set(to, toSet);
    }

    graph.forEachNode((nodeId, attrs) => {
      const kind = String(attrs?.kind ?? '');

      if (kind === 'pair') {
        const children = Array.isArray(attrs?.children) ? attrs.children : null;
        const leftId = children?.[0];
        const rightId = children?.[1];
        if (typeof leftId === 'string') link(nodeId, leftId);
        if (typeof rightId === 'string') link(nodeId, rightId);
      }

      if (includePointers && kind === 'slot') {
        const binderId = attrs?.binderId;
        if (typeof binderId === 'string') link(nodeId, binderId);
      }

      if (includePointers && kind === 'binder') {
        const valueId = attrs?.valueId;
        if (typeof valueId === 'string') link(nodeId, valueId);
      }
    });

    /** @type {Map<string, string[]>} */
    const result = new Map();
    adjacency.forEach((neighbors, nodeId) => {
      result.set(nodeId, [...neighbors]);
    });
    return result;
  }

  /**
   * @param {Map<string, string[]>} adjacency
   * @param {string} startId
   * @param {number} maxNodes
   * @returns {Set<string>}
   */
  function reachableNodeIds(adjacency, startId, maxNodes) {
    const reachable = new Set();
    const queue = [startId];
    let cursor = 0;

    while (cursor < queue.length && reachable.size < maxNodes) {
      const current = queue[cursor];
      cursor += 1;
      if (reachable.has(current)) continue;
      reachable.add(current);
      const neighbors = adjacency.get(current) ?? [];
      neighbors.forEach(neighbor => {
        queue.push(neighbor);
      });
    }

    return reachable;
  }

  /**
   * @param {import('graphology').MultiDirectedGraph} graph
   * @param {string} rootId
   * @param {any[]} path
   * @returns {string | null}
   */
  function replacementIdAtPath(graph, rootId, path) {
    if (!Array.isArray(path) || !path.length) return rootId;
    const last = path[path.length - 1];
    const kind = String(last?.kind ?? '');

    if (kind === 'pair') {
      const parentId = last?.parentId;
      const index = last?.index;
      if (typeof parentId !== 'string') return null;
      if (index !== 0 && index !== 1) return null;
      if (!graph.hasNode(parentId)) return null;
      const attrs = graph.getNodeAttributes(parentId);
      if (String(attrs?.kind ?? '') !== 'pair') return null;
      if (!Array.isArray(attrs?.children)) return null;
      const childId = attrs.children[index];
      return typeof childId === 'string' ? childId : null;
    }

    if (kind === 'binder-value') {
      const binderId = last?.binderId;
      if (typeof binderId !== 'string') return null;
      if (!graph.hasNode(binderId)) return null;
      const attrs = graph.getNodeAttributes(binderId);
      if (String(attrs?.kind ?? '') !== 'binder') return null;
      const valueId = attrs?.valueId;
      return typeof valueId === 'string' ? valueId : null;
    }

    return null;
  }

  /**
   * @param {import('graphology').MultiDirectedGraph} graph
   * @param {string} rootId
   * @param {string} binderId
   * @returns {string | null}
   */
  function firstSlotInSubtree(graph, rootId, binderId) {
    const visited = new Set();
    const queue = [rootId];
    let cursor = 0;
    const maxVisits = 2_000;

    while (cursor < queue.length && visited.size < maxVisits) {
      const current = queue[cursor];
      cursor += 1;
      if (typeof current !== 'string') continue;
      if (visited.has(current)) continue;
      visited.add(current);
      if (!graph.hasNode(current)) continue;

      const attrs = graph.getNodeAttributes(current);
      const kind = String(attrs?.kind ?? '');

      if (kind === 'slot' && attrs?.binderId === binderId) {
        return current;
      }

      if (kind === 'pair' && Array.isArray(attrs?.children)) {
        const leftId = attrs.children[0];
        const rightId = attrs.children[1];
        if (typeof leftId === 'string') queue.push(leftId);
        if (typeof rightId === 'string') queue.push(rightId);
      }
    }

    return null;
  }

  /**
   * @param {import('./types.js').SimulationEngine} engineValue
   * @param {Float32Array} positions
   * @param {import('./domain/session.js').Frame} frame
   * @returns {void}
   */
  function renderNow(engineValue, positions, frame) {
    vis.update(positions);
    lastRendered = { engine: engineValue, positions, frame };
  }

  /**
   * @param {StagedSwap} stagedSwap
   * @param {Float32Array} travelPositions
   * @returns {void}
   */
  function commitStagedSwap(stagedSwap, travelPositions) {
    const previousEngine = engine;
    if (!previousEngine) return;

    const previousById = positionsById(previousEngine.nodeIds, travelPositions);
    previousEngine.dispose();

    engine = stagedSwap.engine;
    const nextEngine = stagedSwap.engine;

    const startPositions = new Float32Array(nextEngine.positions.length);
    nextEngine.nodeIds.forEach((nodeId, index) => {
      const base = index * 3;
      const previous = previousById.get(nodeId);
      const spawned = stagedSwap.spawnOrigins.get(nodeId);
      const source = previous ?? spawned ?? stagedSwap.fallback;
      startPositions[base] = source[0];
      startPositions[base + 1] = source[1];
      startPositions[base + 2] = source[2];
    });

    layoutTransition = {
      kind: 'lerp',
      from: startPositions,
      to: nextEngine.positions,
      buffer: new Float32Array(startPositions),
      elapsedSeconds: 0,
      durationSeconds: stagedSwap.settleSeconds,
    };

    const state = stagedSwap.frame.state;
    vis.setGraph({
      graph: state.graph,
      nodeIds: nextEngine.nodeIds,
      segments: nextEngine.segments,
    });
    vis.setCurl(pointerFold);
    vis.setPointerLinkOpacity(pointerLinkOpacity(pointerFold));
    renderNow(nextEngine, layoutTransition.buffer, stagedSwap.frame);

    if (stagedSwap.fit && !didFit) {
      vis.fitToPositions(nextEngine.positions);
      didFit = true;
    }

    vis.render();
    renderHud(state);
  }

  /**
   * @param {import('./domain/session.js').Frame} frame
   * @param {{ fit: boolean }} options
   * @returns {Promise<void>}
   */
  async function loadFrameNow(frame, options) {
    const state = frame.state;
    const previousEngine = engine;
    const displayedFrame =
      previousEngine && lastRendered?.engine === previousEngine
        ? lastRendered.frame
        : null;
    const displayedPositions =
      previousEngine && lastRendered?.engine === previousEngine
        ? lastRendered.positions
        : previousEngine?.positions ?? null;
    const displayedById =
      previousEngine && displayedPositions
        ? positionsById(previousEngine.nodeIds, displayedPositions)
        : null;

    if (layoutTransition?.kind === 'travel') {
      layoutTransition.stagedSwap.engine.dispose();
    }
    layoutTransition = null;

    /**
     * Create a simulation engine for the requested state.
     *
     * @param {import('./domain/session.js').VisState} nextState
     * @returns {Promise<import('./types.js').SimulationEngine>}
     */
    async function createEngineForState(nextState) {
      if (backend === 'jolt') {
        return await import('./simulation/engine.js')
          .then(module => module.createPhysicsEngine({
            graph: nextState.graph,
            rootId: nextState.rootId,
            edgeLengthMode,
          }));
      }

      return await import('./simulation/static-engine.js')
        .then(module => module.createStaticEngine({
          graph: nextState.graph,
          rootId: nextState.rootId,
        }));
    }

    const action = frame.action;
    if (
      transitionStyle === 'path' &&
      (
        backend === 'sheet' ||
        (backend === 'jolt' && edgeLengthMode === 'lattice')
      ) &&
      previousEngine &&
      displayedFrame &&
      displayedPositions &&
      displayedById &&
      typeof displayedFrame.state.stepIndex === 'number' &&
      state.stepIndex === displayedFrame.state.stepIndex + 1 &&
      action &&
      action.kind === 'pointer-machine'
    ) {
      const stageEngine = previousEngine;
      const stageById = displayedById;
      const previousGraph = displayedFrame.state.graph;
      const event = action.event;

      const nextEngine = await createEngineForState(state);

      const rootIndex = nextEngine.nodeIndexById.get(state.rootId) ?? 0;
      const rootBase = rootIndex * 3;
      /** @type {[number, number, number]} */
      const fallback = [
        nextEngine.positions[rootBase],
        nextEngine.positions[rootBase + 1],
        nextEngine.positions[rootBase + 2],
      ];

      /** @type {Map<string, [number, number, number]>} */
      const spawnOrigins = new Map();

      const path = Array.isArray(event.path) ? event.path : [];
      const insertedRootId = replacementIdAtPath(
        state.graph,
        state.rootId,
        path,
      );

      if (event.kind === 'apply' && insertedRootId) {
        const lambdaAttrs = previousGraph.hasNode(event.lambdaId)
          ? previousGraph.getNodeAttributes(event.lambdaId)
          : null;
        const bodyPrevId = Array.isArray(lambdaAttrs?.children)
          ? lambdaAttrs.children[1]
          : null;
        const origin =
          typeof bodyPrevId === 'string' ? stageById.get(bodyPrevId) : null;
        if (origin) {
          const adjacency = undirectedAdjacency(state.graph, true);
          const reachable = reachableNodeIds(adjacency, insertedRootId, 12_000);
          reachable.forEach(nodeId => {
            if (stageById.has(nodeId)) return;
            spawnOrigins.set(nodeId, origin);
          });
        }
      }

	      const travelBuffer = new Float32Array(displayedPositions);
	      const travelPaths = stageEngine.nodeIds.map((_nodeId, index) => {
	        const start = tripletAtIndex(travelBuffer, index);
	        return buildWaypointPath(start, [], start);
	      });
	      const travelDistances = travelPaths.map(pathValue =>
	        cumulativeWaypointDistances(pathValue),
	      );

	      const childAdjacency = undirectedAdjacency(previousGraph, false);
	      const fullAdjacency = undirectedAdjacency(previousGraph, true);

      /**
       * @param {string} startId
       * @param {string} goalId
       * @returns {string[] | null}
       */
      function preferredPath(startId, goalId) {
        return shortestNodePath(childAdjacency, startId, goalId, 40) ??
          shortestNodePath(fullAdjacency, startId, goalId, 40);
      }

      /**
       * @param {string[][]} parts
       * @returns {string[]}
       */
      function concatPaths(parts) {
        /** @type {string[]} */
        const combined = [];
        parts.forEach(part => {
          part.forEach((nodeId, index) => {
            if (combined.length && index === 0) {
              if (combined[combined.length - 1] === nodeId) return;
            }
            combined.push(nodeId);
          });
        });
        return combined;
      }

      /**
       * @param {string} nodeId
       * @param {string[]} nodePath
       * @returns {void}
       */
      function setNodePath(nodeId, nodePath) {
        const nodeIndex = stageEngine.nodeIndexById.get(nodeId);
        if (typeof nodeIndex !== 'number') return;
        const start = tripletAtIndex(travelBuffer, nodeIndex);

        /** @type {Array<[number, number, number]>} */
        const midpoints = [];
        nodePath.slice(1).forEach(pathNodeId => {
          const pos = stageById.get(pathNodeId);
          if (!pos) return;
          const last = midpoints[midpoints.length - 1];
          if (last && positionsEqual(last, pos)) return;
          midpoints.push(pos);
        });

	        const goal = midpoints[midpoints.length - 1] ?? start;
	        travelPaths[nodeIndex] = buildWaypointPath(start, midpoints, goal);
	        travelDistances[nodeIndex] = cumulativeWaypointDistances(
	          travelPaths[nodeIndex],
	        );
	      }

      if (event.kind === 'collapse') {
        const nodePath = preferredPath(event.replacementId, event.nodeId);
        if (nodePath) setNodePath(event.replacementId, nodePath);
      }

	      if (event.kind === 'apply') {
	        const lambdaAttrs = previousGraph.hasNode(event.lambdaId)
	          ? previousGraph.getNodeAttributes(event.lambdaId)
	          : null;
	        const binderId = Array.isArray(lambdaAttrs?.children)
	          ? lambdaAttrs.children[0]
	          : null;
	        const bodyPrevId = Array.isArray(lambdaAttrs?.children)
	          ? lambdaAttrs.children[1]
	          : null;
	        const slotId =
	          typeof binderId === 'string' && typeof bodyPrevId === 'string'
	            ? firstSlotInSubtree(previousGraph, bodyPrevId, binderId)
	            : null;

	        const toPair = preferredPath(event.argId, event.nodeId) ??
	          [event.argId, event.nodeId];
	        const toLambda = preferredPath(event.nodeId, event.lambdaId) ??
	          [event.nodeId, event.lambdaId];
	        /** @type {string[][]} */
	        const parts = [toPair, toLambda];

	        if (typeof binderId === 'string') {
	          parts.push(
	            preferredPath(event.lambdaId, binderId) ??
	              [event.lambdaId, binderId],
	          );

	          if (typeof slotId === 'string') {
	            parts.push(
	              shortestNodePath(fullAdjacency, binderId, slotId, 40) ??
	                [binderId, slotId],
	            );
	          }
	        } else if (typeof slotId === 'string') {
	          parts.push(
	            preferredPath(event.lambdaId, slotId) ??
	              [event.lambdaId, slotId],
	          );
	        }

	        const combined = concatPaths(parts);
	        setNodePath(event.argId, combined);
	      }

      const maxSegments = travelPaths.reduce((maxValue, pathValue) => {
        const segments = Math.max(0, pathValue.length / 3 - 1);
        return Math.max(maxValue, segments);
      }, 0);

      if (maxSegments > 0) {
        const hopSeconds = 0.11 * layoutTransitionScale;
        const travelSeconds = hopSeconds * maxSegments;
        const settleSeconds = 0.45 * layoutTransitionScale;

	        layoutTransition = {
	          kind: 'travel',
	          paths: travelPaths,
	          distances: travelDistances,
	          buffer: travelBuffer,
	          elapsedSeconds: 0,
	          durationSeconds: travelSeconds,
	          stagedSwap: {
            frame,
            engine: nextEngine,
            spawnOrigins,
            fallback,
            fit: options.fit,
            settleSeconds,
          },
        };

        renderHud(displayedFrame.state);
        return;
      }

      nextEngine.dispose();
    }

    engine = null;
    if (previousEngine) previousEngine.dispose();

    const nextEngine = await createEngineForState(state);
    engine = nextEngine;

    const rootIndex = nextEngine.nodeIndexById.get(state.rootId) ?? 0;
    const rootBase = rootIndex * 3;
    const fallback = [
      nextEngine.positions[rootBase],
      nextEngine.positions[rootBase + 1],
      nextEngine.positions[rootBase + 2],
    ];

    const shouldAnimate =
      (backend !== 'jolt' || edgeLengthMode === 'lattice') &&
      Boolean(displayedById) &&
      nextEngine.positions.length > 0;

    const startPositions = shouldAnimate
      ? new Float32Array(nextEngine.positions.length)
      : nextEngine.positions;

    if (shouldAnimate && displayedById) {
      nextEngine.nodeIds.forEach((nodeId, index) => {
        const base = index * 3;
        const previous = displayedById.get(nodeId);
        const source = previous ?? fallback;
        startPositions[base] = source[0];
        startPositions[base + 1] = source[1];
        startPositions[base + 2] = source[2];
      });

      layoutTransition = {
        kind: 'lerp',
        from: startPositions,
        to: nextEngine.positions,
        buffer: new Float32Array(startPositions),
        elapsedSeconds: 0,
        durationSeconds: 0.55 * layoutTransitionScale,
      };
    }

    vis.setGraph({
      graph: state.graph,
      nodeIds: nextEngine.nodeIds,
      segments: nextEngine.segments,
    });
    vis.setCurl(pointerFold);
    vis.setPointerLinkOpacity(pointerLinkOpacity(pointerFold));
    renderNow(
      nextEngine,
      layoutTransition ? layoutTransition.buffer : startPositions,
      frame,
    );

    if (options.fit && !didFit) {
      vis.fitToPositions(nextEngine.positions);
      didFit = true;
    }

    vis.render();
    renderHud(state);
  }

  /** @type {{
   *   frame: import('./domain/session.js').Frame,
   *   options: { fit: boolean }
   * } | null} */
  let pendingLoad = null;

  /**
   * @returns {Promise<void>}
   */
  async function flushPendingLoads() {
    while (pendingLoad) {
      const { frame, options } = pendingLoad;
      pendingLoad = null;
      await loadFrameNow(frame, options);
    }
    isLoading = false;
  }

  /**
   * @param {import('./domain/session.js').Frame} frame
   * @param {{ fit: boolean }} options
   * @returns {void}
   */
  function queueLoadFrame(frame, options) {
    pendingLoad = { frame, options };
    if (isLoading) return;
    isLoading = true;

    void flushPendingLoads().catch(error => {
      pendingLoad = null;
      isLoading = false;
      isPlaying = false;
      setHudText(hud, formatError(error));
      console.error(error);
    });
  }

  await loadFrameNow(presentFrame(session), { fit: true });

  /**
   * @returns {void}
   */
  function applyPointerFold() {
    vis.setCurl(pointerFold);
    vis.setPointerLinkOpacity(pointerLinkOpacity(pointerFold));
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * @param {number} fold
   * @returns {void}
   */
  function setPointerFoldNow(fold) {
    pointerFold = clamp01(fold);
    applyPointerFold();
  }

  /**
   * @returns {void}
   */
  function toggleCurl() {
    pointerFoldTarget = pointerFoldTarget < 0.5 ? 1 : 0;
    curlAnimation = {
      from: pointerFold,
      to: pointerFoldTarget,
      elapsedSeconds: 0,
    };
    renderHud(null);
  }

  /**
   * @param {number} deltaSeconds
   * @returns {void}
   */
  function updateCurlAnimation(deltaSeconds) {
    if (!curlAnimation) return;

    curlAnimation.elapsedSeconds += deltaSeconds;
    const t = clamp01(curlAnimation.elapsedSeconds / curlDurationSeconds);
    const next = curlAnimation.from +
      (curlAnimation.to - curlAnimation.from) * t;
    setPointerFoldNow(next);

    if (t >= 1) {
      setPointerFoldNow(curlAnimation.to);
      curlAnimation = null;
    }
  }

  /**
   * @returns {void}
   */
  function pausePlayback() {
    isPlaying = false;
    stepAccumulatorSeconds = 0;
    renderHud(null);
  }

  /**
   * @param {1 | -1} direction
   * @returns {void}
   */
  function stepFrame(direction) {
    pausePlayback();
    const beforeIndex = session.index;

    try {
      if (direction === -1) {
        session = stepBack(session);
      } else {
        session = stepForward(session, null);
      }
    } catch (error) {
      isPlaying = false;
      setHudText(hud, formatError(error));
      console.error(error);
      return;
    }

    if (session.index !== beforeIndex) {
      queueLoadFrame(presentFrame(session), { fit: false });
      return;
    }

    renderHud(null);
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  function onKeyDown(event) {
    if (event.key === ' ') {
      event.preventDefault();
      if (isPlaying) {
        pausePlayback();
        return;
      }

      if (!canStepForward(session)) return;

      isPlaying = true;
      stepAccumulatorSeconds = 0;
      renderHud(null);
      return;
    }

    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      pausePlayback();
      mode = mode === 'normal-order' ? 'multiway-rng' : 'normal-order';
      session = createHelloWorldSession(programSource, {
        mode,
        seed,
        compactGraph,
        gridDimensions,
      });
      queueLoadFrame(presentFrame(session), { fit: false });
      return;
    }

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      pausePlayback();
      compactGraph =
        compactGraph === 'none'
          ? 'intern'
          : compactGraph === 'intern'
            ? 'full'
            : 'none';
      session = setCompaction(session, compactGraph);
      queueLoadFrame(presentFrame(session), { fit: false });
      return;
    }

	    if (event.key === 't' || event.key === 'T') {
	      event.preventDefault();
	      pausePlayback();
	      transitionStyle = transitionStyle === 'direct' ? 'path' : 'direct';
	      renderHud(null);
	      return;
	    }

	    if (event.key === 'e' || event.key === 'E') {
	      event.preventDefault();
	      pausePlayback();
	      edgeLengthMode =
	        edgeLengthMode === 'layout'
	          ? 'lattice'
	          : edgeLengthMode === 'lattice'
	            ? 'unit'
	            : 'layout';
	      queueLoadFrame(presentFrame(session), { fit: false });
	      return;
	    }

	    if (event.key === 'l' || event.key === 'L') {
	      event.preventDefault();
	      console.log(JSON.stringify(actionLog(session), null, 2));
	      return;
	    }

    if (event.key === 'g' || event.key === 'G') {
      event.preventDefault();
      gridMode =
        gridMode === 'none'
          ? 'xy'
          : gridMode === 'xy'
            ? 'xz'
            : gridMode === 'xz'
              ? 'yz'
              : gridMode === 'yz'
                ? 'xyz'
                : 'none';
      vis.setGridMode(gridMode);
      return;
    }

    if (event.key === 'o' || event.key === 'O') {
      event.preventDefault();
      cameraMode =
        cameraMode === 'perspective' ? 'orthographic' : 'perspective';
      vis.setCameraMode(cameraMode);
      renderHud(null);
      return;
    }

    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      toggleCurl();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepFrame(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepFrame(1);
      return;
    }

    if (event.key === 'z' || event.key === 'Z') {
      event.preventDefault();
      stepFrame(-1);
      return;
    }

    if (event.key === 'y' || event.key === 'Y') {
      event.preventDefault();
      stepFrame(1);
    }
  }

  window.addEventListener('keydown', onKeyDown);

  let lastTimeMs = performance.now();

  /**
   * @param {number} nowMs
   * @returns {void}
   */
  function animate(nowMs) {
    const dt = (nowMs - lastTimeMs) / 1000;
    lastTimeMs = nowMs;

    updateCurlAnimation(dt);

    if (isPlaying && !isLoading) {
      stepAccumulatorSeconds += dt;
      if (stepAccumulatorSeconds >= secondsPerStep && !layoutTransition) {
        stepAccumulatorSeconds = 0;
        const beforeIndex = session.index;
        try {
          session = stepForward(session, null);
        } catch (error) {
          isPlaying = false;
          setHudText(hud, formatError(error));
          console.error(error);
          return;
        }

        if (session.index === beforeIndex) {
          pausePlayback();
        } else {
          queueLoadFrame(presentFrame(session), { fit: false });
        }
      }
    }

    if (engine && vis) {
      if (layoutTransition) {
        layoutTransition.elapsedSeconds += dt;
        if (layoutTransition.kind === 'lerp') {
          const elapsedSeconds = layoutTransition.elapsedSeconds;
          const t = elapsedSeconds / layoutTransition.durationSeconds;
          lerpPositions(
            layoutTransition.buffer,
            layoutTransition.from,
            layoutTransition.to,
            t,
          );
          if (t >= 1) layoutTransition = null;
        } else {
          const elapsedSeconds = layoutTransition.elapsedSeconds;
          const t = elapsedSeconds / layoutTransition.durationSeconds;
	          sampleWaypointPaths(
	            layoutTransition.buffer,
	            layoutTransition.paths,
	            layoutTransition.distances,
	            t,
	          );
          if (t >= 1) {
            const { stagedSwap, buffer } = layoutTransition;
            layoutTransition = null;
            commitStagedSwap(stagedSwap, buffer);
          }
        }
      }
      engine.step(dt);
      const positions = layoutTransition
        ? layoutTransition.buffer
        : engine.positions;
      const frame = lastRendered?.engine === engine ? lastRendered.frame : null;
      if (frame) renderNow(engine, positions, frame);
      vis.render();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

start().catch(error => {
  const hud = document.getElementById('hud');
  if (hud) {
    hud.textContent = formatError(error);
  }
  console.error(error);
});
