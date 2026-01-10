/**
 * 3D trace viewer (ForceGraph3D)
 * -----------------------------
 *
 * Reads `trace.json` emitted by `src/cli/sk.js --trace=src/vis/trace.json` and
 * animates snapshots using the `3d-force-graph` physics layout.
 *
 * This intentionally does not attempt "pretty layout": the point is to watch
 * local pointer rewrites happen in a way that is easy to inspect.
 */

/* global ForceGraph3D */

import * as THREE from '/node_modules/three/build/three.module.js';

const COLORS = Object.freeze({
  pair: '#000000', // base (structure)
  binder: '#FF2DAA', // hot pink
  slot: '#2D0A5B', // deep purple
  symbol: '#111111', // black-ish
  empty: '#BDBDBD', // neutral
  focus: '#FF2DAA', // highlight
  childLink: 'rgba(0, 0, 0, 0.72)',
  reentryLink: 'rgba(255, 45, 170, 0.42)',
  valueLink: 'rgba(45, 10, 91, 0.42)',
  historyLink: 'rgba(0, 0, 0, 0.26)',
  expandLink: 'rgba(0, 0, 0, 0.72)',
});

const elements = {
  graph: document.getElementById('graph'),
  loadTrace: document.getElementById('load-trace'),
  playPause: document.getElementById('play-pause'),
  step: document.getElementById('step'),
  stepLabel: document.getElementById('step-label'),
  noteLabel: document.getElementById('note-label'),
  showTree: document.getElementById('show-tree'),
  showPointers: document.getElementById('show-pointers'),
  foldSlots: document.getElementById('fold-slots'),
  file: document.getElementById('file'),
  focus: document.getElementById('focus'),
};

const STEP_MS = 900;
const STEP_TRANSITION_MS = 500;

const PAIR_LEG = 42;
const PAIR_OFFSET = PAIR_LEG / Math.SQRT2;
const PAIR_CONSTRAINT_STRENGTH = 0.18;
const VALUE_CONSTRAINT_STRENGTH = 0.22;
const COLLISION_STRENGTH = 0.08;
const COLLISION_ITERATIONS = 2;
const HISTORY_STUB = PAIR_LEG * 0.4;

let trace = [];
let playing = false;
let playTimer = null;
let lastGraphData = null;
let activeTransition = null;
let pinnedNodeId = null;

// Keep stable object identities across snapshot updates so node positions
// don't "jump" between steps.
const nodeCache = new Map(); // id -> node object (mutated by the engine)
let historyLinks = [];
const structureForce = makeStructureForce();
const collisionForce = makeCollisionForce(node => {
  const appear = Number.isFinite(node.__appear) ? node.__appear : 1;
  return collisionRadiusForNode(node) * appear;
});

const HISTORY_DASH_MATERIAL = new THREE.LineDashedMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.28,
  dashSize: 2.2,
  gapSize: 1.4,
});

function defaultLabelForKind(kind) {
  switch (kind) {
    case 'pair':
      return '·';
    case 'binder':
      return 'λ';
    case 'slot':
      return '#';
    case 'empty':
      return '()';
    default:
      return '';
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPos(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function isPointerLink(link) {
  return link.kind === 'reentry';
}

function makeHistoryDashedLine() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(6), 3),
  );
  const line = new THREE.Line(geometry, HISTORY_DASH_MATERIAL);
  line.computeLineDistances();
  return line;
}

function updateHistoryDashedLine(line, start, end) {
  const startZ = Number.isFinite(start.z) ? start.z : 0;
  const endZ = Number.isFinite(end.z) ? end.z : 0;
  const positions = line.geometry.attributes.position.array;
  positions[0] = start.x;
  positions[1] = start.y;
  positions[2] = startZ;
  positions[3] = end.x;
  positions[4] = end.y;
  positions[5] = endZ;
  line.geometry.attributes.position.needsUpdate = true;
  line.computeLineDistances();
  line.geometry.computeBoundingSphere();
}

function computeSlotIndexLabels(rootId, nodeById) {
  const labels = new Map(); // slotId -> "#n"
  if (typeof rootId !== 'string') return labels;

  const seen = new Set();
  function walk(nodeId, binderStack) {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) return;

    if (node.kind === 'pair' && Array.isArray(node.children) && node.children.length === 2) {
      const [leftId, rightId] = node.children;
      const left = nodeById.get(leftId);
      if (left?.kind === 'binder') {
        walk(rightId, [...binderStack, leftId]);
      } else {
        walk(leftId, binderStack);
        walk(rightId, binderStack);
      }
      return;
    }

    if (node.kind === 'slot' && typeof node.binderId === 'string') {
      const index = binderStack.lastIndexOf(node.binderId);
      if (index !== -1) {
        labels.set(nodeId, `#${binderStack.length - 1 - index}`);
      }
    }
  }

  walk(rootId, []);
  return labels;
}

function colorForNode(node) {
  if (node.__focus) return COLORS.focus;
  return COLORS[node.kind] ?? '#111111';
}

function sizeForNode(node) {
  if (node.__focus) return 2.5;
  switch (node.kind) {
    case 'empty':
      return 0.35;
    case 'slot':
      return 0.8;
    case 'binder':
      return 1.4;
    default:
      return 1.0;
  }
}

function collisionRadiusForNode(node) {
  switch (node.kind) {
    case 'empty':
      return 0.6;
    case 'slot':
      return 1.1;
    case 'binder':
      return 1.7;
    default:
      return 1.2;
  }
}

function makeCollisionForce(radiusForNode) {
  let nodes = [];

  function force(alpha) {
    const k = COLLISION_STRENGTH * alpha * 0.5;
    if (!k) return;

    for (let iter = 0; iter < COLLISION_ITERATIONS; iter += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        const ra = radiusForNode(a);
        if (!Number.isFinite(ra) || ra <= 0) continue;
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const rb = radiusForNode(b);
          if (!Number.isFinite(rb) || rb <= 0) continue;
          if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;

          const minDist = ra + rb;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (!dist) {
            const angle = ((i * 53 + j * 97) % 360) * (Math.PI / 180);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            dist = 1;
          }

          const overlap = minDist - dist;
          if (overlap <= 0) continue;
          const ux = dx / dist;
          const uy = dy / dist;
          const push = overlap * k;
          a.vx -= ux * push;
          a.vy -= uy * push;
          b.vx += ux * push;
          b.vy += uy * push;
        }
      }
    }
  }

  force.initialize = nextNodes => {
    nodes = Array.isArray(nextNodes) ? nextNodes : [];
  };

  return force;
}

function colorForLink(link) {
  switch (link.kind) {
    case 'child':
      return link.__folded ? 'rgba(0, 0, 0, 0.78)' : COLORS.childLink;
    case 'reentry':
      return COLORS.reentryLink;
    case 'value':
      return COLORS.valueLink;
    case 'history':
      return COLORS.historyLink;
    default:
      return COLORS.expandLink;
  }
}

function arrowLengthForLink(link) {
  return 0;
}

function widthForLink(link) {
  if (link.__focus) return 4;
  if (link.kind === 'history') return 0;
  if (isPointerLink(link)) return 0;
  if (link.kind === 'child') return link.__folded ? 2.4 : 1.6;
  return 2.6;
}

const NODE_GEOMETRY = new THREE.SphereGeometry(1, 18, 18);
const LINK_MATERIALS = new Map();

function parseCssColor(css) {
  if (typeof css !== 'string') {
    return { color: new THREE.Color('#000000'), opacity: 1 };
  }
  const rgba = css.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/,
  );
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const a = Number(rgba[4]);
    return {
      color: new THREE.Color(`rgb(${r}, ${g}, ${b})`),
      opacity: Number.isFinite(a) ? clamp01(a) : 1,
    };
  }
  return { color: new THREE.Color(css), opacity: 1 };
}

function linkMaterialFor(link) {
  const css = colorForLink(link);
  const key = `${link.kind}:${css}`;
  const cached = LINK_MATERIALS.get(key);
  if (cached) return cached;
  const { color, opacity } = parseCssColor(css);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  });
  LINK_MATERIALS.set(key, material);
  return material;
}

function makeNodeObject(node) {
  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(colorForNode(node)),
  });
  const mesh = new THREE.Mesh(NODE_GEOMETRY, material);
  const appear = Number.isFinite(node.__appear) ? node.__appear : 1;
  const radius = sizeForNode(node) * appear;
  mesh.scale.set(radius, radius, radius);
  return mesh;
}

function updateNodeObject(nodeObject, coords, node) {
  nodeObject.position.set(coords.x, coords.y, 0);
  if (node) node.z = 0;
  const appear = Number.isFinite(node.__appear) ? node.__appear : 1;
  const radius = sizeForNode(node) * appear;
  nodeObject.scale.set(radius, radius, radius);
  nodeObject.material.color.set(colorForNode(node));
  return true;
}

function normalizeLinkEndpoint(pos) {
  return {
    x: pos.x,
    y: pos.y,
    z: 0,
  };
}

function pointerLiftZ(start, end, link) {
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const lift = dist / 2;
  const sign = link.kind === 'value' ? -1 : 1;
  return sign * lift;
}

function pointAlongPointerArc(start, end, liftZ, fraction) {
  const t = clamp01(fraction);
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(dist) || dist <= 0) return { ...start };

  const radius = dist / 2;
  const sign = Math.sign(liftZ) || 1;
  const ux = (end.x - start.x) / dist;
  const uy = (end.y - start.y) / dist;
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;

  const theta = Math.PI * t;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  return {
    x: cx - radius * cos * ux,
    y: cy - radius * cos * uy,
    z: sign * radius * sin,
  };
}

function makeLinkObject(link) {
  if (link.kind === 'history') return makeHistoryDashedLine();
  const points = isPointerLink(link) ? 24 : 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(points * 3), 3),
  );
  const line = new THREE.Line(geometry, linkMaterialFor(link));
  line.frustumCulled = false;
  line.__points = points;
  return line;
}

function updateLinkObject(linkObject, endpoints, link) {
  const start = normalizeLinkEndpoint(endpoints.start);
  const end = normalizeLinkEndpoint(endpoints.end);
  const appear = Number.isFinite(link.__appear) ? link.__appear : 1;

  if (link.kind === 'history') {
    let shownEnd = lerpPos(start, end, appear);
    const dist = Math.hypot(shownEnd.x - start.x, shownEnd.y - start.y);
    if (dist < 1e-3) {
      shownEnd = {
        x: start.x + HISTORY_STUB,
        y: start.y + HISTORY_STUB,
        z: 0,
      };
    }
    updateHistoryDashedLine(linkObject, start, shownEnd);
    return true;
  }

  const positions = linkObject.geometry.attributes.position.array;
  const points = Number(linkObject.__points) || positions.length / 3;

  if (isPointerLink(link)) {
    const liftZ = pointerLiftZ(start, end, link);
    for (let i = 0; i < points; i += 1) {
      const t = points === 1 ? appear : (i / (points - 1)) * appear;
      const p = pointAlongPointerArc(start, end, liftZ, t);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
  } else {
    for (let i = 0; i < points; i += 1) {
      const t = points === 1 ? appear : (i / (points - 1)) * appear;
      positions[i * 3] = lerp(start.x, end.x, t);
      positions[i * 3 + 1] = lerp(start.y, end.y, t);
      positions[i * 3 + 2] = lerp(start.z, end.z, t);
    }
  }

  linkObject.geometry.attributes.position.needsUpdate = true;
  linkObject.geometry.computeBoundingSphere();
  return true;
}

function internNode(raw) {
  const existing = nodeCache.get(raw.id);
  if (existing) {
    Object.assign(existing, raw);
    return existing;
  }
  const node = { ...raw };
  nodeCache.set(raw.id, node);
  return node;
}

function internLink(raw) {
  const id = raw.id ?? `${raw.kind}:${raw.from}->${raw.to}`;
  // Important: do NOT cache/reuse link objects across steps.
  //
  // `3d-force-graph` mutates link records while (re)initializing the physics
  // simulation. If we reuse and mutate link objects ourselves between steps,
  // we can race the library's async update and end up with links that reference
  // nodes that "don't exist" in the currently-initializing simulation.
  return { ...raw, id };
}

function clearFocusFlags() {
  nodeCache.forEach(node => {
    node.__focus = false;
  });
}

function focusIdsFromSnapshot(snapshot) {
  const ids = new Set();
  if (!snapshot?.rootId) return ids;
  ids.add(snapshot.rootId);
  const focus = snapshot.focus;
  if (!focus || typeof focus !== 'object') return ids;
  ['nodeId', 'lambdaId', 'argId', 'replacementId'].forEach(key => {
    const value = focus[key];
    if (typeof value === 'string') ids.add(value);
  });
  return ids;
}

function ensureEdges(graph) {
  const nodes = graph.nodes ?? [];
  const explicitEdges = graph.edges;
  const pointerLinks = Array.isArray(graph.links) ? graph.links : [];
  if (Array.isArray(explicitEdges)) return explicitEdges;

  const treeEdges = [];
  nodes.forEach(node => {
    if (node.kind !== 'pair') return;
    if (!Array.isArray(node.children) || node.children.length !== 2) return;
    treeEdges.push({
      id: `t:${node.id}:0`,
      kind: 'child',
      from: node.id,
      to: node.children[0],
      index: 0,
    });
    treeEdges.push({
      id: `t:${node.id}:1`,
      kind: 'child',
      from: node.id,
      to: node.children[1],
      index: 1,
    });
  });
  return [...treeEdges, ...pointerLinks];
}

function normalizeTrace(data) {
  if (Array.isArray(data)) {
    return data.flatMap(entry => {
      if (entry && Array.isArray(entry.snapshots)) {
        return entry.snapshots.map(snapshot => ({
          ...snapshot,
          expression: entry.expression ?? snapshot.expression,
        }));
      }
      return [entry];
    });
  }
  if (data && Array.isArray(data.snapshots)) return data.snapshots;
  return [data];
}

function replacementIdFromFocus(snapshot, nodeById) {
  const graph = snapshot?.graph ?? snapshot;
  const rootId = snapshot?.rootId ?? graph?.rootId;
  const focus = snapshot?.focus;
  if (!focus || typeof focus !== 'object') return null;
  if (!Array.isArray(focus.path)) return null;
  if (!focus.path.length) return typeof rootId === 'string' ? rootId : null;

  const frame = focus.path[focus.path.length - 1];
  if (frame?.kind === 'pair') {
    const parent = nodeById.get(frame.parentId);
    if (!parent || parent.kind !== 'pair') return null;
    if (!Array.isArray(parent.children) || parent.children.length !== 2)
      return null;
    return parent.children[frame.index];
  }
  if (frame?.kind === 'binder-value') {
    const binder = nodeById.get(frame.binderId);
    if (!binder || binder.kind !== 'binder') return null;
    return typeof binder.valueId === 'string' ? binder.valueId : null;
  }
  return null;
}

function computeHistoryLink(snapshot, index) {
  const graph = snapshot?.graph ?? snapshot;
  const nodes = graph?.nodes ?? [];
  const focus = snapshot?.focus;
  if (!focus || typeof focus !== 'object') return null;
  if (typeof focus.nodeId !== 'string') return null;

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const to = replacementIdFromFocus(snapshot, nodeById);
  if (typeof to !== 'string') return null;
  if (to === focus.nodeId) return null;
  if (!nodeById.has(focus.nodeId) || !nodeById.has(to)) return null;

  return {
    id: `h:${index}:${focus.nodeId}->${to}`,
    kind: 'history',
    from: focus.nodeId,
    to,
  };
}

function ensureHistoryLinks(nextTrace) {
  historyLinks = new Array(nextTrace.length).fill(null);
  nextTrace.forEach((snapshot, index) => {
    historyLinks[index] = computeHistoryLink(snapshot, index);
  });
}

function historyLinksUpTo(stepIndex) {
  return historyLinks.slice(0, stepIndex + 1).filter(Boolean);
}

function resolveBoundSlotTarget(nodeId, nodeById) {
  let currentId = nodeId;
  const seen = new Set();
  for (let i = 0; i < 64; i += 1) {
    if (seen.has(currentId)) return currentId;
    seen.add(currentId);
    const node = nodeById.get(currentId);
    if (!node || node.kind !== 'slot') return currentId;
    const binderId = node.binderId;
    if (typeof binderId !== 'string') return currentId;
    const binder = nodeById.get(binderId);
    if (!binder || binder.kind !== 'binder' || typeof binder.valueId !== 'string') return currentId;
    currentId = binder.valueId;
  }
  return currentId;
}

function snapshotToGraphData(snapshot, stepIndex) {
  const graph = snapshot?.graph ?? snapshot;
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error('Trace must contain snapshots with { graph: { nodes, links } }');
  }
  const nodes = graph.nodes.map(internNode);

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const slotLabels = computeSlotIndexLabels(snapshot?.rootId ?? graph.rootId, nodeById);
  nodes.forEach(node => {
    if (node.kind === 'symbol') {
      node.__displayLabel = String(node.label ?? node.id);
      return;
    }
    if (node.kind === 'slot') {
      const computed = slotLabels.get(node.id);
      if (computed) {
        node.__displayLabel = computed;
        return;
      }
      const binder = typeof node.binderId === 'string' ? nodeById.get(node.binderId) : null;
      if (binder?.kind === 'binder' && typeof binder.valueId === 'string') {
        node.__displayLabel = 'bound';
        return;
      }
      node.__displayLabel = 'slot';
      return;
    }
    node.__displayLabel = defaultLabelForKind(node.kind);
  });
  const baseEdges = ensureEdges({ ...graph, nodes });
  const spineEdges =
    typeof stepIndex === 'number' ? historyLinksUpTo(stepIndex) : [];

  const view = {
    showTree: elements.showTree?.checked ?? true,
    showPointers: elements.showPointers?.checked ?? true,
    foldSlots: elements.foldSlots?.checked ?? false,
  };

  const edges = [...baseEdges, ...spineEdges]
    .filter(edge => {
      if (edge.kind === 'child') return view.showTree;
      if (edge.kind === 'history') return true;
      return view.showPointers;
    })
    .map(edge => {
      // Always normalize `__folded` so cached link objects don't carry
      // stale folding flags across view toggle changes.
      if (edge.kind !== 'child') return { ...edge, __folded: false };
      if (!view.foldSlots) return { ...edge, __folded: false };
      const resolvedTo = resolveBoundSlotTarget(edge.to, nodeById);
      if (resolvedTo === edge.to) return { ...edge, __folded: false };
      return { ...edge, to: resolvedTo, __folded: true };
    });

  const links = edges.map(internLink);
  return { nodes, links };
}

function makeStructureForce() {
  let constraints = [];

  function applyConstraint(constraint, alpha) {
    const parent = constraint.parent;
    const child = constraint.child;
    if (!parent || !child) return;

    if (!Number.isFinite(parent.x) || !Number.isFinite(parent.y)) return;
    if (!Number.isFinite(child.x) || !Number.isFinite(child.y)) return;

    const targetX = parent.x + constraint.dx;
    const targetY = parent.y + constraint.dy;
    const errorX = child.x - targetX;
    const errorY = child.y - targetY;
    const k = constraint.strength * alpha;

    child.vx -= errorX * k;
    child.vy -= errorY * k;
    parent.vx += errorX * k;
    parent.vy += errorY * k;
  }

  function force(alpha) {
    constraints.forEach(constraint => applyConstraint(constraint, alpha));
  }

  force.setConstraints = next => {
    constraints = Array.isArray(next) ? next : [];
  };

  return force;
}

function pairOffsetForIndex(index) {
  if (index === 0) return { x: -PAIR_OFFSET, y: -PAIR_OFFSET };
  return { x: PAIR_OFFSET, y: -PAIR_OFFSET };
}

function pinIdFromSnapshot(snapshot) {
  const focusId = snapshot?.focus?.nodeId;
  if (typeof focusId === 'string') return focusId;
  const rootId = snapshot?.rootId ?? snapshot?.graph?.rootId;
  return typeof rootId === 'string' ? rootId : null;
}

function pinNodeToOrigin(nodeId, nodes) {
  if (typeof nodeId !== 'string') return;
  const node = nodeCache.get(nodeId);
  if (!node) return;

  if (pinnedNodeId && pinnedNodeId !== nodeId) {
    const prev = nodeCache.get(pinnedNodeId);
    if (prev) {
      prev.fx = undefined;
      prev.fy = undefined;
    }
  }

  pinnedNodeId = nodeId;

  const dx = Number.isFinite(node.x) ? node.x : 0;
  const dy = Number.isFinite(node.y) ? node.y : 0;
  if (dx !== 0 || dy !== 0) {
    nodes.forEach(other => {
      if (Number.isFinite(other.x)) other.x -= dx;
      if (Number.isFinite(other.y)) other.y -= dy;
      if (Number.isFinite(other.fx)) other.fx -= dx;
      if (Number.isFinite(other.fy)) other.fy -= dy;
    });
  }

  node.x = 0;
  node.y = 0;
  node.vx = 0;
  node.vy = 0;
  node.fx = 0;
  node.fy = 0;
}

function primaryPairParentByChild(nodes) {
  const primary = new Map(); // childId -> {parentId, index}

  nodes.forEach(node => {
    if (node.kind !== 'pair') return;
    if (!Array.isArray(node.children) || node.children.length !== 2) return;

    node.children.forEach((childId, index) => {
      if (typeof childId !== 'string') return;
      const candidate = { parentId: node.id, index };
      const existing = primary.get(childId);
      if (!existing || String(candidate.parentId) < String(existing.parentId)) {
        primary.set(childId, candidate);
      }
    });
  });

  return primary;
}

function buildStructureConstraints(nodes) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const primaryParent = primaryPairParentByChild(nodes);
  const constraints = [];

  primaryParent.forEach(({ parentId, index }, childId) => {
    const parent = nodeById.get(parentId);
    const child = nodeById.get(childId);
    if (!parent || !child) return;
    const offset = pairOffsetForIndex(index);
    constraints.push({
      parent,
      child,
      dx: offset.x,
      dy: offset.y,
      strength: PAIR_CONSTRAINT_STRENGTH,
    });
  });

  nodes.forEach(node => {
    if (node.kind !== 'binder') return;
    if (typeof node.valueId !== 'string') return;
    const value = nodeById.get(node.valueId);
    if (!value) return;

    const parentEntry = primaryParent.get(node.id);
    const offset = parentEntry ? pairOffsetForIndex(parentEntry.index) : { x: 0, y: -PAIR_LEG };
    constraints.push({
      parent: node,
      child: value,
      dx: offset.x,
      dy: offset.y,
      strength: VALUE_CONSTRAINT_STRENGTH,
    });
  });

  return constraints;
}

function startStepTransition(nextGraphData) {
  if (!lastGraphData) {
    nextGraphData.nodes.forEach(node => {
      node.__appear = 1;
    });
    nextGraphData.links.forEach(link => {
      link.__appear = 1;
    });
    activeTransition = null;
    return;
  }

  const prevNodeIds = new Set((lastGraphData?.nodes ?? []).map(node => node.id));
  const prevLinkIds = new Set((lastGraphData?.links ?? []).map(link => link.id));

  const newNodes = [];
  nextGraphData.nodes.forEach(node => {
    if (prevNodeIds.has(node.id)) {
      node.__appear = 1;
      return;
    }
    node.__appear = 0;
    newNodes.push(node);
  });

  const newLinks = [];
  nextGraphData.links.forEach(link => {
    if (prevLinkIds.has(link.id)) {
      link.__appear = 1;
      return;
    }
    link.__appear = 0;
    newLinks.push(link);
  });

  activeTransition = {
    startMs: performance.now(),
    nodes: newNodes,
    links: newLinks,
  };
}

function tickStepTransition(nowMs) {
  if (!activeTransition) return;
  const t = clamp01((nowMs - activeTransition.startMs) / STEP_TRANSITION_MS);
  activeTransition.nodes.forEach(node => {
    node.__appear = t;
  });
  activeTransition.links.forEach(link => {
    link.__appear = t;
  });
  if (t >= 1) activeTransition = null;
}

function initialCameraOffset(nodeCount) {
  const n = Math.max(1, Number(nodeCount) || 1);
  const distance = 160 * Math.cbrt(n);
  return {
    x: -0.55 * distance,
    y: 0.35 * distance,
    z: distance,
  };
}

function resetCamera(nodeCount) {
  const offset = initialCameraOffset(nodeCount);
  Graph.cameraPosition(offset, { x: 0, y: 0, z: 0 }, 0);
}

function setTrace(nextTrace) {
  nodeCache.clear();
  trace = nextTrace;
  ensureHistoryLinks(trace);
  lastGraphData = null;
  activeTransition = null;
  pinnedNodeId = null;
  structureForce.setConstraints([]);
  stopPlaying();
  elements.step.min = 0;
  elements.step.max = Math.max(0, trace.length - 1);
  elements.step.value = 0;
  renderStep(0);
}

function updateHud(stepIndex, snapshot) {
  const total = trace.length;
  const note = snapshot?.note ? String(snapshot.note) : '';
  const expr = snapshot?.expression ? String(snapshot.expression) : '';
  elements.stepLabel.textContent = `${Math.min(stepIndex + 1, total)} / ${total}`;
  elements.noteLabel.textContent = [note, expr].filter(Boolean).join(' • ');
  if (snapshot?.focus) {
    elements.focus.textContent = JSON.stringify(snapshot.focus, null, 2);
  } else {
    elements.focus.textContent = '';
  }
}

function renderStep(index) {
  if (!trace.length) return;
  const clamped = Math.max(0, Math.min(index, trace.length - 1));
  elements.step.value = clamped;
  const snapshot = trace[clamped];

  clearFocusFlags();
  const graphData = snapshotToGraphData(snapshot, clamped);
  const pinId = pinIdFromSnapshot(snapshot);
  pinNodeToOrigin(pinId, graphData.nodes);
  structureForce.setConstraints(buildStructureConstraints(graphData.nodes));
  const focused = focusIdsFromSnapshot(snapshot);
  focused.forEach(id => {
    const node = nodeCache.get(id);
    if (node) node.__focus = true;
  });
  graphData.links.forEach(link => {
    if (focused.has(link.from) || focused.has(link.to)) link.__focus = true;
  });

  startStepTransition(graphData);
  Graph.graphData(graphData);
  Graph.d3ReheatSimulation();
  lastGraphData = graphData;

  updateHud(clamped, snapshot);
}

function stopPlaying() {
  playing = false;
  elements.playPause.textContent = 'Play';
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

function startPlaying() {
  if (!trace.length) return;
  playing = true;
  const snapshot = trace[Number(elements.step.value)];
  resetCamera(snapshot?.graph?.nodes?.length);
  elements.playPause.textContent = 'Pause';
  playTimer = setInterval(() => {
    const next = Number(elements.step.value) + 1;
    if (next >= trace.length) {
      stopPlaying();
      return;
    }
    renderStep(next);
  }, STEP_MS);
}

function togglePlaying() {
  if (playing) stopPlaying();
  else startPlaying();
}

async function loadTraceJson(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return normalizeTrace(data);
}

async function loadDefaultTrace() {
  try {
    const snapshots = await loadTraceJson('./trace.json');
    setTrace(snapshots);
  } catch (err) {
    setTrace([]);
    elements.stepLabel.textContent = '0 / 0';
    elements.noteLabel.textContent = `Failed to load trace.json (${err.message}). Serve from repo root.`;
  }
}

function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    };
    reader.readAsText(file);
  });
}

function setupEvents() {
  elements.loadTrace.addEventListener('click', () => {
    loadDefaultTrace();
  });

  elements.playPause.addEventListener('click', () => {
    togglePlaying();
  });

  elements.step.addEventListener('input', event => {
    stopPlaying();
    renderStep(Number(event.target.value));
  });

  elements.file.addEventListener('change', async event => {
    stopPlaying();
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFileAsJson(file);
      setTrace(normalizeTrace(data));
    } catch (err) {
      elements.noteLabel.textContent = `Failed to load file (${err.message})`;
    }
  });

  window.addEventListener('keydown', event => {
    if (event.key === ' ') {
      event.preventDefault();
      togglePlaying();
      return;
    }
    if (!trace.length) return;
    if (event.key === 'ArrowLeft') {
      stopPlaying();
      renderStep(Number(elements.step.value) - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      stopPlaying();
      renderStep(Number(elements.step.value) + 1);
      return;
    }
  });

  [
    elements.showTree,
    elements.showPointers,
    elements.foldSlots,
  ].forEach(control => {
    if (!control) return;
    control.addEventListener('change', () => {
      stopPlaying();
      renderStep(Number(elements.step.value));
    });
  });
}

const Graph = ForceGraph3D({
  controlType: 'orbit',
})(elements.graph)
  .backgroundColor('#ffffff')
  .nodeId('id')
  .numDimensions(2)
  .nodeThreeObject(makeNodeObject)
  .nodePositionUpdate(updateNodeObject)
  .nodeLabel(node => {
    const displayLabel =
      typeof node.__displayLabel === 'string'
        ? node.__displayLabel
        : typeof node.label === 'string'
          ? node.label
          : defaultLabelForKind(node.kind);
    const parts = [`${node.kind}: ${displayLabel}`, node.id];
    if (node.kind === 'slot' && typeof node.binderId === 'string')
      parts.push(`binderId=${node.binderId}`);
    if (node.kind === 'binder' && typeof node.valueId === 'string')
      parts.push(`valueId=${node.valueId}`);
    return parts.join('<br>');
  })
  .linkSource('from')
  .linkTarget('to')
  .linkWidth(widthForLink)
  .linkDirectionalArrowLength(arrowLengthForLink)
  .linkDirectionalArrowColor(colorForLink)
  .linkDirectionalArrowRelPos(1)
  .linkThreeObject(makeLinkObject)
  .linkPositionUpdate((linkObject, { start, end }, link) =>
    updateLinkObject(linkObject, { start, end }, link),
  )
  .linkOpacity(1)
  .onEngineTick(() => {
    const nowMs = performance.now();
    tickStepTransition(nowMs);
  })
  .onNodeClick(node => {
    stopPlaying();
    // Smoothly aim the camera at clicked nodes for inspection.
    const distance = 140;
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0);
    Graph.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio,
        z: distance,
      },
      node,
      600,
    );
  });

Graph.d3Force('structure', structureForce);
Graph.d3Force(
  'collide',
  collisionForce,
);

const linkForce = Graph.d3Force('link');
if (linkForce && typeof linkForce.strength === 'function') {
  linkForce
    .strength(link => {
      return link.kind === 'history' ? 0.12 : 0;
    })
    .distance(link => {
      return link.kind === 'history' ? PAIR_LEG : PAIR_LEG;
    });
}

function resizeGraphToContainer() {
  const rect = elements.graph.getBoundingClientRect();
  Graph.width(Math.max(1, Math.floor(rect.width)));
  Graph.height(Math.max(1, Math.floor(rect.height)));
}

window.addEventListener('resize', () => {
  resizeGraphToContainer();
});

if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(() => resizeGraphToContainer());
  observer.observe(elements.graph);
}

resizeGraphToContainer();

setupEvents();
loadDefaultTrace();
