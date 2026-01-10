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

import ForceGraph3D from '3d-force-graph';
import { hierarchy, tree } from 'd3-hierarchy';
import * as THREE from 'three';

const CONFIG = Object.freeze({
  axes: Object.freeze({
    enabled: false,
    size: 110,
  }),
  camera: Object.freeze({
    clickDistance: 140,
    clickMs: 600,
    initialDistanceBase: 160,
    initialXFactor: -0.55,
    initialYFactor: 0.35,
  }),
  colors: Object.freeze({
    pair: '#000000',
    binder: '#FF2DAA',
    slot: '#2D0A5B',
    symbol: '#111111',
    empty: '#BDBDBD',
    focus: '#FF2DAA',
    childLink: 'rgba(0, 0, 0, 0.72)',
    childLinkFolded: 'rgba(0, 0, 0, 0.78)',
    reentryLink: 'rgba(255, 45, 170, 0.42)',
    valueLink: 'rgba(45, 10, 91, 0.42)',
    historyLink: 'rgba(0, 0, 0, 0.26)',
    expandLink: 'rgba(0, 0, 0, 0.72)',
  }),
  geometry: Object.freeze({
    linkRadialSegments: 8,
    sphereSegments: 18,
  }),
  graph: Object.freeze({
    backgroundColor: '#ffffff',
    controlType: 'orbit',
    linkOpacity: 1,
    numDimensions: 2,
  }),
  history: Object.freeze({
    dash: Object.freeze({
      color: 0x000000,
      dashSize: 2.2,
      gapSize: 1.4,
      opacity: 0.28,
    }),
    stubFactor: 0.4,
  }),
  layout: Object.freeze({
    modeDefault: 'constrained',
    hierarchyNodeSizeX: 18,
    hierarchyNodeSizeY: 26,
    pairConstraintStrength: 1,
    pairLeg: 42,
    pointerPoints: 24,
    valueConstraintStrength: 0.22,
    zstack: Object.freeze({
      pointerLiftMax: 42,
      sliceDistance: 63,
    }),
  }),
  links: Object.freeze({
    radii: Object.freeze({
      child: 0.22,
      childFolded: 0.3,
      default: 0.18,
      focus: 0.36,
      pointer: 0.16,
      value: 0.16,
    }),
    widths: Object.freeze({
      child: 1.6,
      childFolded: 2.4,
      default: 2.6,
      focus: 4,
      history: 0,
      pointer: 0,
    }),
  }),
  nodes: Object.freeze({
    collision: Object.freeze({
      binder: 1.7,
      default: 1.2,
      empty: 0.6,
      slot: 1.1,
    }),
    sizes: Object.freeze({
      binder: 1.4,
      default: 1,
      empty: 0.35,
      focus: 2.5,
      slot: 0.8,
    }),
  }),
  physics: Object.freeze({
    chargeStrength: 0,
    centerStrength: 0,
    collisionAlphaFactor: 0.5,
    collisionIterations: 2,
    collisionStrength: 0.08,
    historyLinkStrength: 0.12,
  }),
  ui: Object.freeze({
    labelsEnabled: true,
    linkThickness: Object.freeze({
      default: 1,
      max: 6,
      min: 0.25,
      step: 0.05,
    }),
  }),
  timingMs: Object.freeze({
    step: 900,
    transition: 500,
  }),
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
  showAxes: document.getElementById('show-axes'),
  layoutMode: document.getElementById('layout-mode'),
  linkThickness: document.getElementById('link-thickness'),
  showLabels: document.getElementById('show-labels'),
  file: document.getElementById('file'),
  focus: document.getElementById('focus'),
};

const PAIR_OFFSET = CONFIG.layout.pairLeg / Math.SQRT2;
const HISTORY_STUB = CONFIG.layout.pairLeg * CONFIG.history.stubFactor;

let trace = [];
let playing = false;
let playTimer = null;
let lastGraphData = null;
let activeTransition = null;
let pinnedNodeId = null;
let labelsEnabled = CONFIG.ui.labelsEnabled;
let linkThicknessScale = CONFIG.ui.linkThickness.default;
let activeLayoutMode = CONFIG.layout.modeDefault;
const viewOffset = { x: 0, y: 0 };

// Keep stable object identities across snapshot updates so node positions
// don't "jump" between steps.
const nodeCache = new Map(); // id -> node object (mutated by the engine)
let historyLinks = [];
const structureForce = makeStructureForce();
const collisionForce = makeCollisionForce(node => {
  const appear = Number.isFinite(node.__appear) ? node.__appear : 1;
  const collide = Number.isFinite(node.__collide) ? node.__collide : 1;
  return collisionRadiusForNode(node) * appear * collide;
});

const HISTORY_DASH_MATERIAL = new THREE.LineDashedMaterial({
  color: CONFIG.history.dash.color,
  transparent: true,
  opacity: CONFIG.history.dash.opacity,
  dashSize: CONFIG.history.dash.dashSize,
  gapSize: CONFIG.history.dash.gapSize,
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

function initUiControls() {
  if (elements.layoutMode) {
    elements.layoutMode.value = CONFIG.layout.modeDefault;
  }

  if (elements.linkThickness) {
    const slider = elements.linkThickness;
    slider.min = String(CONFIG.ui.linkThickness.min);
    slider.max = String(CONFIG.ui.linkThickness.max);
    slider.step = String(CONFIG.ui.linkThickness.step);
    slider.value = String(CONFIG.ui.linkThickness.default);
  }

  if (elements.showLabels) {
    elements.showLabels.checked = CONFIG.ui.labelsEnabled;
  }

  if (elements.showAxes) {
    elements.showAxes.checked = CONFIG.axes.enabled;
  }

  labelsEnabled = elements.showLabels?.checked ?? CONFIG.ui.labelsEnabled;
  linkThicknessScale =
    Number(elements.linkThickness?.value) || CONFIG.ui.linkThickness.default;
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

    if (
      node.kind === 'pair' &&
      Array.isArray(node.children) &&
      node.children.length === 2
    ) {
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
  if (node.__focus) return CONFIG.colors.focus;
  return CONFIG.colors[node.kind] ?? CONFIG.colors.symbol;
}

function sizeForNode(node) {
  if (node.__focus) return CONFIG.nodes.sizes.focus;
  return CONFIG.nodes.sizes[node.kind] ?? CONFIG.nodes.sizes.default;
}

function collisionRadiusForNode(node) {
  return CONFIG.nodes.collision[node.kind] ?? CONFIG.nodes.collision.default;
}

function makeCollisionForce(radiusForNode) {
  let nodes = [];

  function force(alpha) {
    const k = CONFIG.physics.collisionStrength *
      alpha *
      CONFIG.physics.collisionAlphaFactor;
    if (!k) return;

    for (let iter = 0; iter < CONFIG.physics.collisionIterations; iter += 1) {
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
      return link.__folded
        ? CONFIG.colors.childLinkFolded
        : CONFIG.colors.childLink;
    case 'reentry':
      return CONFIG.colors.reentryLink;
    case 'value':
      return CONFIG.colors.valueLink;
    case 'history':
      return CONFIG.colors.historyLink;
    default:
      return CONFIG.colors.expandLink;
  }
}

function arrowLengthForLink(link) {
  return 0;
}

function widthForLink(link) {
  if (link.__focus) return CONFIG.links.widths.focus;
  if (link.kind === 'history') return CONFIG.links.widths.history;
  if (isPointerLink(link)) return CONFIG.links.widths.pointer;
  if (link.kind === 'child') {
    return link.__folded
      ? CONFIG.links.widths.childFolded
      : CONFIG.links.widths.child;
  }
  return CONFIG.links.widths.default;
}

const NODE_GEOMETRY = new THREE.SphereGeometry(
  1,
  CONFIG.geometry.sphereSegments,
  CONFIG.geometry.sphereSegments,
);
const LINK_GEOMETRY = new THREE.CylinderGeometry(
  1,
  1,
  1,
  CONFIG.geometry.linkRadialSegments,
  1,
);
const LINK_MATERIALS = new Map();
const UP_VECTOR = new THREE.Vector3(0, 1, 0);
const TMP_DIR = new THREE.Vector3();
const TMP_QUATERNION = new THREE.Quaternion();

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
  const material = new THREE.MeshLambertMaterial({
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
  const z = node && Number.isFinite(node.__z) ? node.__z : 0;
  nodeObject.position.set(
    coords.x + viewOffset.x,
    coords.y + viewOffset.y,
    z,
  );
  if (node) node.z = z;
  const appear = Number.isFinite(node.__appear) ? node.__appear : 1;
  const radius = sizeForNode(node) * appear;
  nodeObject.scale.set(radius, radius, radius);
  nodeObject.material.color.set(colorForNode(node));
  return true;
}

function normalizeLinkEndpoint(pos) {
  const z = Number.isFinite(pos.z) ? pos.z : 0;
  return {
    x: pos.x + viewOffset.x,
    y: pos.y + viewOffset.y,
    z,
  };
}

function pointerLiftZ(start, end, link) {
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const rawLift = dist / 2;
  const maxLift = activeLayoutMode === 'zstack'
    ? CONFIG.layout.zstack.pointerLiftMax
    : rawLift;
  const lift = Math.min(rawLift, maxLift);
  const sign = link.kind === 'value' ? -1 : 1;
  return sign * lift;
}

function pointAlongPointerArc(start, end, liftZ, fraction) {
  const t = clamp01(fraction);
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(dist) || dist <= 0) return { ...start };

  const radius = dist / 2;
  const sign = Math.sign(liftZ) || 1;
  const startZ = Number.isFinite(start.z) ? start.z : 0;
  const endZ = Number.isFinite(end.z) ? end.z : 0;
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
    z: lerp(startZ, endZ, t) + sign * radius * sin,
  };
}

function baseRadiusForLink(link) {
  if (link.__focus) return CONFIG.links.radii.focus;
  if (isPointerLink(link)) return CONFIG.links.radii.pointer;
  if (link.kind === 'value') return CONFIG.links.radii.value;
  if (link.kind === 'child') {
    return link.__folded
      ? CONFIG.links.radii.childFolded
      : CONFIG.links.radii.child;
  }
  return CONFIG.links.radii.default;
}

function radiusForLink(link) {
  return baseRadiusForLink(link) * linkThicknessScale;
}

function updateCylinderMesh(mesh, start, end, radius, material) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(length) || length <= 1e-6 || radius <= 0) {
    mesh.visible = false;
    return;
  }

  mesh.visible = true;
  mesh.material = material;
  mesh.position.set(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );

  TMP_DIR.set(dx / length, dy / length, dz / length);
  TMP_QUATERNION.setFromUnitVectors(UP_VECTOR, TMP_DIR);
  mesh.quaternion.copy(TMP_QUATERNION);
  mesh.scale.set(radius, length, radius);
}

function makeLinkObject(link) {
  if (link.kind === 'history') return makeHistoryDashedLine();
  const segmentCount = isPointerLink(link)
    ? Math.max(1, CONFIG.layout.pointerPoints - 1)
    : 1;
  const group = new THREE.Group();
  group.frustumCulled = false;
  group.__segments = [];

  for (let i = 0; i < segmentCount; i += 1) {
    const mesh = new THREE.Mesh(LINK_GEOMETRY, linkMaterialFor(link));
    mesh.frustumCulled = false;
    group.add(mesh);
    group.__segments.push(mesh);
  }

  return group;
}

function updateLinkObject(linkObject, endpoints, link) {
  const start = normalizeLinkEndpoint(endpoints.start);
  const end = normalizeLinkEndpoint(endpoints.end);
  const appear = Number.isFinite(link.__appear) ? link.__appear : 1;

  if (link.kind === 'history') {
    let shownEnd = lerpPos(start, end, appear);
    const dist = Math.hypot(
      shownEnd.x - start.x,
      shownEnd.y - start.y,
      shownEnd.z - start.z,
    );
    if (dist < 1e-3) {
      shownEnd = {
        x: start.x + HISTORY_STUB,
        y: start.y + HISTORY_STUB,
        z: start.z,
      };
    }
    updateHistoryDashedLine(linkObject, start, shownEnd);
    return true;
  }

  const segments = linkObject.__segments;
  if (!Array.isArray(segments) || !segments.length) return true;
  const material = linkMaterialFor(link);
  const radius = radiusForLink(link);

  if (isPointerLink(link)) {
    const liftZ = pointerLiftZ(start, end, link);
    const points = Math.max(2, CONFIG.layout.pointerPoints);
    const path = [];
    for (let i = 0; i < points; i += 1) {
      const t = points === 1 ? appear : (i / (points - 1)) * appear;
      path.push(pointAlongPointerArc(start, end, liftZ, t));
    }

    const segmentCount = Math.min(segments.length, path.length - 1);
    for (let i = 0; i < segmentCount; i += 1) {
      updateCylinderMesh(segments[i], path[i], path[i + 1], radius, material);
    }
    for (let i = segmentCount; i < segments.length; i += 1) {
      segments[i].visible = false;
    }
    return true;
  } else {
    const shownEnd = lerpPos(start, end, appear);
    updateCylinderMesh(segments[0], start, shownEnd, radius, material);
    for (let i = 1; i < segments.length; i += 1) {
      segments[i].visible = false;
    }
  }

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
    if (
      !binder ||
      binder.kind !== 'binder' ||
      typeof binder.valueId !== 'string'
    ) {
      return currentId;
    }
    currentId = binder.valueId;
  }
  return currentId;
}

function snapshotToGraphData(snapshot, stepIndex) {
  const graph = snapshot?.graph ?? snapshot;
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error(
      'Trace must contain snapshots with { graph: { nodes, links } }',
    );
  }
  const nodes = graph.nodes.map(internNode);

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const slotLabels = computeSlotIndexLabels(
    snapshot?.rootId ?? graph.rootId,
    nodeById,
  );
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
      const binder =
        typeof node.binderId === 'string' ? nodeById.get(node.binderId) : null;
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

function viewOffsetForPin(pinId) {
  if (typeof pinId !== 'string') return { x: 0, y: 0 };
  const pinned = nodeCache.get(pinId);
  if (!pinned || !hasFinitePosition(pinned)) return { x: 0, y: 0 };
  return { x: -pinned.x, y: -pinned.y };
}

function pinNodeInPlace(pinId, nodes) {
  if (typeof pinId !== 'string') return;
  const node = nodeCache.get(pinId);
  if (!node) return;

  if (pinnedNodeId && pinnedNodeId !== pinId) {
    const prev = nodeCache.get(pinnedNodeId);
    if (prev) {
      prev.fx = undefined;
      prev.fy = undefined;
    }
  }
  pinnedNodeId = pinId;

  if (!hasFinitePosition(node)) {
    node.x = 0;
    node.y = 0;
    node.vx = 0;
    node.vy = 0;
  }
  node.fx = node.x;
  node.fy = node.y;
  node.vx = 0;
  node.vy = 0;

  nodes?.forEach(other => {
    if (other === node) return;
    if (!Number.isFinite(other.vx)) other.vx = 0;
    if (!Number.isFinite(other.vy)) other.vy = 0;
  });
}

function pinNodeToOrigin(nodeId, nodes, options = {}) {
  if (typeof nodeId !== 'string') return;
  const node = nodeCache.get(nodeId);
  if (!node) return;

  const releasePrevious = options.releasePrevious ?? true;
  if (releasePrevious && pinnedNodeId && pinnedNodeId !== nodeId) {
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

function primaryPairParentByChild(nodes, allowedIds) {
  const primary = new Map(); // childId -> {parentId, index}

  function allowed(id) {
    return !allowedIds || allowedIds.has(id);
  }

  nodes.forEach(node => {
    if (node.kind !== 'pair') return;
    if (!Array.isArray(node.children) || node.children.length !== 2) return;
    if (!allowed(node.id)) return;

    node.children.forEach((childId, index) => {
      if (typeof childId !== 'string') return;
      if (!allowed(childId)) return;
      const candidate = { parentId: node.id, index };
      const existing = primary.get(childId);
      if (!existing || String(candidate.parentId) < String(existing.parentId)) {
        primary.set(childId, candidate);
      }
    });
  });

  return primary;
}

function buildStructureConstraints(nodes, allowedIds) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const primaryParent = primaryPairParentByChild(nodes, allowedIds);
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
      strength: CONFIG.layout.pairConstraintStrength,
    });
  });

  nodes.forEach(node => {
    if (node.kind !== 'binder') return;
    if (typeof node.valueId !== 'string') return;
    if (allowedIds && !allowedIds.has(node.id)) return;
    if (allowedIds && !allowedIds.has(node.valueId)) return;
    const value = nodeById.get(node.valueId);
    if (!value) return;

    const parentEntry = primaryParent.get(node.id);
    const offset = parentEntry
      ? pairOffsetForIndex(parentEntry.index)
      : { x: 0, y: -CONFIG.layout.pairLeg };
    constraints.push({
      parent: node,
      child: value,
      dx: offset.x,
      dy: offset.y,
      strength: CONFIG.layout.valueConstraintStrength,
    });
  });

  return constraints;
}

function hasFinitePosition(node) {
  return (
    node &&
    Number.isFinite(node.x) &&
    Number.isFinite(node.y)
  );
}

function seedPositionsFromConstraints(nodes, constraints) {
  if (!Array.isArray(nodes) || !nodes.length) return;
  if (!Array.isArray(constraints) || !constraints.length) return;

  function seedNode(child, parent, offset) {
    if (!child || !parent || !offset) return false;
    if (!hasFinitePosition(parent)) return false;
    if (hasFinitePosition(child)) return false;
    child.x = parent.x + offset.dx;
    child.y = parent.y + offset.dy;
    child.vx = 0;
    child.vy = 0;
    return true;
  }

  let seeded = true;
  for (let pass = 0; pass < 32 && seeded; pass += 1) {
    seeded = false;
    constraints.forEach(constraint => {
      if (seedNode(constraint.child, constraint.parent, constraint)) {
        seeded = true;
      }
    });
  }

  nodes.forEach(node => {
    if (hasFinitePosition(node)) return;
    node.x = 0;
    node.y = 0;
    node.vx = 0;
    node.vy = 0;
  });
}

function layoutModeFromUi() {
  const value = elements.layoutMode?.value;
  if (value === 'hierarchy') return 'hierarchy';
  if (value === 'zstack') return 'zstack';
  return 'constrained';
}

function releaseFixedPositions(nodes) {
  nodes.forEach(node => {
    node.fx = undefined;
    node.fy = undefined;
  });
}

function fixToCurrentPositions(nodes) {
  nodes.forEach(node => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    node.fx = node.x;
    node.fy = node.y;
  });
}

function topmostAncestorId(nodeId, primaryParent) {
  if (typeof nodeId !== 'string') return null;
  let current = nodeId;
  const seen = new Set();
  for (let i = 0; i < 256; i += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const parentId = primaryParent.get(current)?.parentId;
    if (typeof parentId !== 'string') break;
    current = parentId;
  }
  return current;
}

function hierarchyData(rootId, nodeById, primaryParent) {
  const seen = new Set();

  function childrenFor(nodeId) {
    const node = nodeById.get(nodeId);
    if (node?.kind !== 'pair') return [];
    if (!Array.isArray(node.children) || node.children.length !== 2) return [];
    return node.children.filter(childId => {
      if (typeof childId !== 'string') return false;
      return primaryParent.get(childId)?.parentId === nodeId;
    });
  }

  function build(nodeId) {
    const data = { id: nodeId };
    if (seen.has(nodeId)) return data;
    seen.add(nodeId);
    const children = childrenFor(nodeId).map(build);
    if (children.length) data.children = children;
    return data;
  }

  if (typeof rootId !== 'string') return null;
  return build(rootId);
}

function applyHierarchyLayout(pinId, nodes) {
  structureForce.setConstraints([]);
  const primaryParent = primaryPairParentByChild(nodes);
  const rootId = topmostAncestorId(pinId, primaryParent);
  if (typeof rootId !== 'string') return false;

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const data = hierarchyData(rootId, nodeById, primaryParent);
  if (!data) return false;

  const root = hierarchy(data);
  const layout = tree().nodeSize([
    CONFIG.layout.hierarchyNodeSizeX,
    CONFIG.layout.hierarchyNodeSizeY,
  ]);
  layout(root);

  root.each(entry => {
    const node = nodeById.get(entry.data.id);
    if (!node) return;
    node.x = entry.x;
    node.y = -entry.y;
  });

  nodes.forEach(node => {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) return;
    node.x = 0;
    node.y = 0;
  });

  pinNodeToOrigin(pinId, nodes, { releasePrevious: false });
  fixToCurrentPositions(nodes);
  nodes.forEach(node => {
    node.__collide = 1;
    node.__zTarget = 0;
  });
  return true;
}

function applyConstrainedLayout(pinId, nodes) {
  releaseFixedPositions(nodes);
  if (typeof pinId === 'string') {
    const pinned = nodeCache.get(pinId);
    if (pinned && !hasFinitePosition(pinned)) {
      pinned.x = 0;
      pinned.y = 0;
      pinned.vx = 0;
      pinned.vy = 0;
    }
  }
  const constraints = buildStructureConstraints(nodes);
  seedPositionsFromConstraints(nodes, constraints);
  structureForce.setConstraints(constraints);
  nodes.forEach(node => {
    node.__collide = 1;
    node.__zTarget = 0;
  });
}

function rootIdFromSnapshot(snapshot) {
  const graph = snapshot?.graph ?? snapshot;
  const rootId = snapshot?.rootId ?? graph?.rootId;
  return typeof rootId === 'string' ? rootId : null;
}

function liveIdsFromRoot(rootId, nodeById) {
  const live = new Set();
  if (typeof rootId !== 'string') return live;

  const queue = [rootId];
  while (queue.length) {
    const nodeId = queue.pop();
    if (typeof nodeId !== 'string') continue;
    if (live.has(nodeId)) continue;
    live.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) continue;

    if (
      node.kind === 'pair' &&
      Array.isArray(node.children) &&
      node.children.length === 2
    ) {
      node.children.forEach(childId => queue.push(childId));
    }
    if (node.kind === 'binder' && typeof node.valueId === 'string') {
      queue.push(node.valueId);
    }
    if (node.kind === 'slot' && typeof node.binderId === 'string') {
      queue.push(node.binderId);
    }
  }

  return live;
}

function applyZStackLayout(pinId, nodes, snapshot, stepIndex) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const rootId = rootIdFromSnapshot(snapshot);
  const live = liveIdsFromRoot(rootId, nodeById);
  if (typeof pinId === 'string') live.add(pinId);

  if (typeof pinId === 'string') {
    const pinned = nodeById.get(pinId);
    if (pinned && !hasFinitePosition(pinned)) {
      pinned.x = 0;
      pinned.y = 0;
      pinned.vx = 0;
      pinned.vy = 0;
    }
  }

  nodes.forEach(node => {
    const isLive = live.has(node.id);
    node.__live = isLive;
    node.__collide = isLive ? 1 : 0;

    if (isLive) {
      node.__lastLiveStep = stepIndex;
      node.__frozenX = undefined;
      node.__frozenY = undefined;
      if (node.id !== pinId) {
        node.fx = undefined;
        node.fy = undefined;
      }
      node.__zTarget = 0;
      return;
    }

    if (typeof node.__lastLiveStep !== 'number') {
      node.__lastLiveStep = stepIndex;
    }
    node.__frozenX = Number.isFinite(node.x) ? node.x : 0;
    node.__frozenY = Number.isFinite(node.y) ? node.y : 0;
    node.fx = node.__frozenX;
    node.fy = node.__frozenY;
    node.vx = 0;
    node.vy = 0;

    const lastLive =
      typeof node.__lastLiveStep === 'number' ? node.__lastLiveStep : stepIndex;
    const age = Math.max(0, stepIndex - lastLive);
    node.__zTarget = -CONFIG.layout.zstack.sliceDistance * age;
  });

  const constraints = buildStructureConstraints(nodes, live);
  seedPositionsFromConstraints(nodes, constraints);
  structureForce.setConstraints(constraints);
}

function computeZMoves(nodes) {
  const moves = [];
  nodes.forEach(node => {
    const target = Number.isFinite(node.__zTarget) ? node.__zTarget : 0;
    const current = Number.isFinite(node.__z) ? node.__z : target;
    if (!Number.isFinite(node.__z)) node.__z = current;
    if (current === target) return;
    moves.push({ node, from: current, to: target });
  });
  return moves;
}

function startStepTransition(nextGraphData, nextViewOffset, zMoves) {
  if (!lastGraphData) {
    nextGraphData.nodes.forEach(node => {
      node.__appear = 1;
    });
    nextGraphData.links.forEach(link => {
      link.__appear = 1;
    });
    if (Array.isArray(zMoves)) {
      zMoves.forEach(({ node, to }) => {
        node.__z = to;
      });
    }
    if (nextViewOffset) {
      viewOffset.x = nextViewOffset.x;
      viewOffset.y = nextViewOffset.y;
    }
    activeTransition = null;
    return;
  }

  const prevNodeIds = new Set(
    (lastGraphData?.nodes ?? []).map(node => node.id),
  );
  const prevLinkIds = new Set(
    (lastGraphData?.links ?? []).map(link => link.id),
  );

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
    zMoves: Array.isArray(zMoves) ? zMoves : [],
    viewFrom: { ...viewOffset },
    viewTo: nextViewOffset ? { ...nextViewOffset } : { ...viewOffset },
  };
}

function tickStepTransition(nowMs) {
  if (!activeTransition) return;
  const t = clamp01(
    (nowMs - activeTransition.startMs) / CONFIG.timingMs.transition,
  );
  activeTransition.nodes.forEach(node => {
    node.__appear = t;
  });
  activeTransition.links.forEach(link => {
    link.__appear = t;
  });
  activeTransition.zMoves?.forEach(move => {
    move.node.__z = lerp(move.from, move.to, t);
  });
  if (activeTransition.viewFrom && activeTransition.viewTo) {
    viewOffset.x = lerp(
      activeTransition.viewFrom.x,
      activeTransition.viewTo.x,
      t,
    );
    viewOffset.y = lerp(
      activeTransition.viewFrom.y,
      activeTransition.viewTo.y,
      t,
    );
  }
  if (t >= 1) activeTransition = null;
}

function initialCameraOffset(nodeCount) {
  const n = Math.max(1, Number(nodeCount) || 1);
  const distance = CONFIG.camera.initialDistanceBase * Math.cbrt(n);
  return {
    x: CONFIG.camera.initialXFactor * distance,
    y: CONFIG.camera.initialYFactor * distance,
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

  const firstNodeCount = trace[0]?.graph?.nodes?.length;
  resetCamera(firstNodeCount);
}

function updateHud(stepIndex, snapshot) {
  const total = trace.length;
  const note = snapshot?.note ? String(snapshot.note) : '';
  const expr = snapshot?.expression ? String(snapshot.expression) : '';
  const stepText = `${Math.min(stepIndex + 1, total)} / ${total}`;
  elements.stepLabel.textContent = stepText;
  elements.noteLabel.textContent = [note, expr].filter(Boolean).join(' • ');
  if (snapshot?.focus) {
    elements.focus.textContent = JSON.stringify(snapshot.focus, null, 2);
  } else {
    elements.focus.textContent = '';
  }
}

function configureForcesForCurrentSimulation() {
  // Keep the layout deterministic relative to the pinned focus/root.
  // The default d3 `center` force recenters the *center-of-mass*, which moves
  // the focus away from the origin.
  Graph.d3Force('center', null);

  const chargeForce = Graph.d3Force('charge');
  if (chargeForce && typeof chargeForce.strength === 'function') {
    chargeForce.strength(CONFIG.physics.chargeStrength);
  }

  const linkForce = Graph.d3Force('link');
  if (linkForce && typeof linkForce.strength === 'function') {
    linkForce
      .strength(link => {
        return link.kind === 'history'
          ? CONFIG.physics.historyLinkStrength
          : 0;
      })
      .distance(() => CONFIG.layout.pairLeg);
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
  const layoutMode = layoutModeFromUi();
  activeLayoutMode = layoutMode;
  if (layoutMode === 'hierarchy') {
    const ok = applyHierarchyLayout(pinId, graphData.nodes);
    if (!ok) {
      applyConstrainedLayout(pinId, graphData.nodes);
      pinNodeInPlace(pinId, graphData.nodes);
    }
  } else if (layoutMode === 'zstack') {
    applyZStackLayout(pinId, graphData.nodes, snapshot, clamped);
    pinNodeInPlace(pinId, graphData.nodes);
  } else {
    applyConstrainedLayout(pinId, graphData.nodes);
    pinNodeInPlace(pinId, graphData.nodes);
  }
  const focused = focusIdsFromSnapshot(snapshot);
  focused.forEach(id => {
    const node = nodeCache.get(id);
    if (node) node.__focus = true;
  });
  graphData.links.forEach(link => {
    if (focused.has(link.from) || focused.has(link.to)) link.__focus = true;
  });

  const nextViewOffset = viewOffsetForPin(pinId);
  const zMoves = computeZMoves(graphData.nodes);
  startStepTransition(graphData, nextViewOffset, zMoves);
  Graph.graphData(graphData);
  configureForcesForCurrentSimulation();
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
  elements.playPause.textContent = 'Pause';
  playTimer = setInterval(() => {
    const next = Number(elements.step.value) + 1;
    if (next >= trace.length) {
      stopPlaying();
      return;
    }
    renderStep(next);
  }, CONFIG.timingMs.step);
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
    const message = [
      `Failed to load trace.json (${err.message}).`,
      'Serve from repo root.',
    ].join(' ');
    elements.noteLabel.textContent = message;
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
    elements.layoutMode,
  ].forEach(control => {
    if (!control) return;
    control.addEventListener('change', () => {
      stopPlaying();
      renderStep(Number(elements.step.value));
    });
  });

  elements.showAxes?.addEventListener('change', () => {
    axesHelper.visible = elements.showAxes.checked;
  });

  elements.showLabels?.addEventListener('change', () => {
    labelsEnabled = elements.showLabels.checked;
    Graph.refresh();
  });

  elements.linkThickness?.addEventListener('input', () => {
    linkThicknessScale =
      Number(elements.linkThickness.value) || CONFIG.ui.linkThickness.default;
    Graph.refresh();
  });
}

initUiControls();

const Graph = ForceGraph3D({
  controlType: CONFIG.graph.controlType,
})(elements.graph)
  .backgroundColor(CONFIG.graph.backgroundColor)
  .nodeId('id')
  .numDimensions(CONFIG.graph.numDimensions)
  .nodeThreeObject(makeNodeObject)
  .nodePositionUpdate(updateNodeObject)
  .nodeLabel(node => {
    if (!labelsEnabled) return '';
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
  .linkOpacity(CONFIG.graph.linkOpacity)
  .onEngineTick(() => {
    const nowMs = performance.now();
    tickStepTransition(nowMs);
  })
  .onNodeClick(node => {
    stopPlaying();
    // Smoothly aim the camera at clicked nodes for inspection.
    const distance = CONFIG.camera.clickDistance;
    const target = {
      x: (node.x || 0) + viewOffset.x,
      y: (node.y || 0) + viewOffset.y,
      z: Number.isFinite(node.z) ? node.z : 0,
    };
    const distRatio = 1 + distance / Math.max(1e-6, Math.hypot(
      target.x,
      target.y,
    ));
    Graph.cameraPosition(
      {
        x: target.x * distRatio,
        y: target.y * distRatio,
        z: distance,
      },
      target,
      CONFIG.camera.clickMs,
    );
  });

const axesHelper = new THREE.AxesHelper(CONFIG.axes.size);
axesHelper.visible = elements.showAxes?.checked ?? CONFIG.axes.enabled;
Graph.scene().add(axesHelper);

Graph.d3Force('structure', structureForce);
Graph.d3Force(
  'collide',
  collisionForce,
);

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
