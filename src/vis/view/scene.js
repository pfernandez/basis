/**
 * View: Three.js scene
 * -------------------
 *
 * Uses InstancedMesh for node rendering (single draw call for spheres).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  LineSegments2,
} from 'three/addons/lines/LineSegments2.js';
import {
  LineSegmentsGeometry,
} from 'three/addons/lines/LineSegmentsGeometry.js';

/**
 * @typedef {import('../types.js').Segment} Segment
 */

/**
 * @typedef {{
 *   container: HTMLElement,
 *   nodeRadius?: number,
 *   gridDimensions?: import('../types.js').GridDimensions,
 *   pointerStyle?: 'arcs' | 'lines'
 * }} SceneParams
 */

/**
 * @typedef {{
 *   graph: import('graphology').MultiDirectedGraph,
 *   nodeIds: string[],
 *   segments: Segment[]
 * }} SceneGraph
 */

/**
 * @typedef {{
 *   setGraph: (graph: SceneGraph) => void,
 *   update: (positions: Float32Array) => void,
 *   fitToPositions: (positions: Float32Array) => void,
 *   setCameraMode: (mode: 'perspective' | 'orthographic') => void,
 *   setGridMode: (mode: 'none' | 'xy' | 'xz' | 'yz' | 'xyz') => void,
 *   setCurl: (fold: number) => void,
 *   setPointerLinkOpacity: (opacity: number) => void,
 *   render: () => void,
 *   dispose: () => void
 * }} VisScene
 */

/**
 * @param {string} kind
 * @returns {number}
 */
function colorForKind(kind) {
  switch (kind) {
    case 'pair':
      return 0x000000;
    case 'symbol':
      return 0x93c5fd;
    case 'binder':
      return 0x6ee7b7;
    case 'slot':
      return 0xfcd34d;
    case 'empty':
      return 0x9ca3af;
    default:
      return 0xffffff;
  }
}

/**
 * @param {string} kind
 * @returns {number}
 */
function scaleForKind(kind) {
  switch (kind) {
    case 'pair':
      return 0.35;
    case 'symbol':
      return 1.1;
    case 'binder':
      return 0.85;
    case 'slot':
      return 0.85;
    case 'empty':
      return 0.75;
    default:
      return 1.0;
  }
}

/**
 * @param {Record<string, unknown>} attrs
 * @returns {{ text: string, className: string } | null}
 */
function labelForNode(attrs) {
  const kind = String(attrs.kind ?? '');
  if (kind === 'symbol') {
    return {
      text: String(attrs.label ?? '?'),
      className: 'node-label--symbol',
    };
  }
  if (kind === 'binder') {
    return { text: 'λ', className: 'node-label--binder' };
  }
  if (kind === 'slot') {
    return { text: '#', className: 'node-label--slot' };
  }
  return null;
}

const EDGE_LINE_WIDTH = 1.5;
const POINTER_ARC_STEPS = 32;

/**
 * Create an XYZ lattice using line segments.
 *
 * `dimensions` are half-extents in grid steps from the origin.
 *
 * @param {import('../types.js').GridDimensions} dimensions
 * @param {number} spacing
 * @param {number} color
 * @param {number} opacity
 * @returns {THREE.LineSegments}
 */
function createXYZGrid(dimensions, spacing, color, opacity) {
  const safeSpacing =
    spacing > 0 && Number.isFinite(spacing) ? spacing : 1;
  const xExtent = Math.max(1, Math.floor(dimensions.x));
  const yExtent = Math.max(1, Math.floor(dimensions.y));
  const zExtent = Math.max(1, Math.floor(dimensions.z));

  const halfX = xExtent * safeSpacing;
  const halfY = yExtent * safeSpacing;
  const halfZ = zExtent * safeSpacing;
  const pointsX = xExtent * 2 + 1;
  const pointsY = yExtent * 2 + 1;
  const pointsZ = zExtent * 2 + 1;

  const linesX = pointsY * pointsZ;
  const linesY = pointsX * pointsZ;
  const linesZ = pointsX * pointsY;
  const buffer = new Float32Array((linesX + linesY + linesZ) * 2 * 3);

  const coordsX = new Float32Array(pointsX);
  const coordsY = new Float32Array(pointsY);
  const coordsZ = new Float32Array(pointsZ);

  for (let i = 0; i < pointsX; i += 1) {
    coordsX[i] = -halfX + i * safeSpacing;
  }
  for (let i = 0; i < pointsY; i += 1) {
    coordsY[i] = -halfY + i * safeSpacing;
  }
  for (let i = 0; i < pointsZ; i += 1) {
    coordsZ[i] = -halfZ + i * safeSpacing;
  }

  let cursor = 0;
  for (let yi = 0; yi < pointsY; yi += 1) {
    const y = coordsY[yi];
    for (let zi = 0; zi < pointsZ; zi += 1) {
      const z = coordsZ[zi];
      buffer[cursor] = -halfX;
      buffer[cursor + 1] = y;
      buffer[cursor + 2] = z;
      buffer[cursor + 3] = halfX;
      buffer[cursor + 4] = y;
      buffer[cursor + 5] = z;
      cursor += 6;
    }
  }

  for (let xi = 0; xi < pointsX; xi += 1) {
    const x = coordsX[xi];
    for (let zi = 0; zi < pointsZ; zi += 1) {
      const z = coordsZ[zi];
      buffer[cursor] = x;
      buffer[cursor + 1] = -halfY;
      buffer[cursor + 2] = z;
      buffer[cursor + 3] = x;
      buffer[cursor + 4] = halfY;
      buffer[cursor + 5] = z;
      cursor += 6;
    }
  }

  for (let xi = 0; xi < pointsX; xi += 1) {
    const x = coordsX[xi];
    for (let yi = 0; yi < pointsY; yi += 1) {
      const y = coordsY[yi];
      buffer[cursor] = x;
      buffer[cursor + 1] = y;
      buffer[cursor + 2] = -halfZ;
      buffer[cursor + 3] = x;
      buffer[cursor + 4] = y;
      buffer[cursor + 5] = halfZ;
      cursor += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

/**
 * @param {Segment[]} segments
 * @param {number} color
 * @returns {{
 *   object: LineSegments2,
 *   buffer: Float32Array,
 *   segments: Segment[]
 * }}
 */
function createLineSegments(segments, color) {
  const buffer = new Float32Array(segments.length * 2 * 3);
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(buffer);

  const material = new LineMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    linewidth: EDGE_LINE_WIDTH,
  });

  return {
    object: new LineSegments2(geometry, material),
    buffer,
    segments,
  };
}

/**
 * Pointer links are rendered as sampled arcs (polyline segments).
 *
 * @param {Segment[]} segments
 * @param {number} color
 * @returns {{
 *   object: LineSegments2,
 *   buffer: Float32Array,
 *   segments: Segment[],
 *   steps: number,
 *   layers: Int32Array | null
 * }}
 */
function createArcLines(segments, color) {
  const steps = POINTER_ARC_STEPS;
  const segmentsPerArc = Math.max(1, steps - 1);
  const buffer = new Float32Array(segments.length * segmentsPerArc * 6);
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(buffer);

  const material = new LineMaterial({
    color,
    transparent: true,
    opacity: 0.4,
    linewidth: EDGE_LINE_WIDTH,
  });

  return {
    object: new LineSegments2(geometry, material),
    buffer,
    segments,
    steps,
    layers: null,
  };
}

/**
 * @param {Float32Array} positions
 * @returns {{ center: THREE.Vector3, radius: number } | null}
 */
function boundsFromPositions(positions) {
  if (positions.length < 3) return null;

  const box = new THREE.Box3();
  const temp = new THREE.Vector3();
  box.makeEmpty();

  for (let i = 0; i < positions.length; i += 3) {
    temp.set(positions[i], positions[i + 1], positions[i + 2]);
    box.expandByPoint(temp);
  }

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  if (!Number.isFinite(sphere.radius)) return null;

  return { center: sphere.center, radius: sphere.radius };
}

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
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} x
 * @returns {number}
 */
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Weight for lifting arcs: 0 near endpoints, 1 across the interior.
 *
 * @param {number} t
 * @returns {number}
 */
function arcPlateauWeight(t) {
  const ramp = 0.15;
  return smoothstep(0, ramp, t) * smoothstep(0, ramp, 1 - t);
}

/**
 * 2D segment intersection test (strict; ignores colinear overlaps).
 *
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} cx
 * @param {number} cy
 * @param {number} dx
 * @param {number} dy
 * @returns {boolean}
 */
function segmentsIntersect2D(ax, ay, bx, by, cx, cy, dx, dy) {
  const eps = 1e-9;

  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const adx = dx - ax;
  const ady = dy - ay;

  const cdx = dx - cx;
  const cdy = dy - cy;
  const cax = ax - cx;
  const cay = ay - cy;
  const cbx = bx - cx;
  const cby = by - cy;

  const o1 = abx * acy - aby * acx;
  const o2 = abx * ady - aby * adx;
  const o3 = cdx * cay - cdy * cax;
  const o4 = cdx * cby - cdy * cbx;

  if (Math.abs(o1) < eps || Math.abs(o2) < eps) return false;
  if (Math.abs(o3) < eps || Math.abs(o4) < eps) return false;

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

/**
 * Assign pointer arcs to layers so arcs in the same layer don't cross when
 * projected onto the observer sheet.
 *
 * @param {Segment[]} segments
 * @param {Float32Array} positions
 * @returns {Int32Array}
 */
function arcLayersForSegments(segments, positions) {
  const layers = new Int32Array(segments.length);
  layers.fill(-1);

  const order = segments
    .map((segment, index) => {
      const a = segment.fromIndex * 3;
      const b = segment.toIndex * 3;
      const dx = positions[a] - positions[b];
      const dy = positions[a + 1] - positions[b + 1];
      return { index, lengthSq: dx * dx + dy * dy };
    })
    .sort((left, right) => right.lengthSq - left.lengthSq);

  /** @type {number[][]} */
  const usedByLayer = [];

  order.forEach(entry => {
    const segment = segments[entry.index];
    const aIndex = segment.fromIndex;
    const bIndex = segment.toIndex;
    const ax = positions[aIndex * 3];
    const ay = positions[aIndex * 3 + 1];
    const bx = positions[bIndex * 3];
    const by = positions[bIndex * 3 + 1];

    let layer = 0;
    while (true) {
      const members = usedByLayer[layer] ?? [];
      const intersects = members.some(otherIndex => {
        const other = segments[otherIndex];
        if (
          other.fromIndex === aIndex ||
          other.toIndex === aIndex ||
          other.fromIndex === bIndex ||
          other.toIndex === bIndex
        ) {
          return false;
        }

        const cIndex = other.fromIndex;
        const dIndex = other.toIndex;
        const cx = positions[cIndex * 3];
        const cy = positions[cIndex * 3 + 1];
        const dx = positions[dIndex * 3];
        const dy = positions[dIndex * 3 + 1];
        return segmentsIntersect2D(ax, ay, bx, by, cx, cy, dx, dy);
      });

      if (!intersects) {
        layers[entry.index] = layer;
        if (!usedByLayer[layer]) usedByLayer[layer] = [];
        usedByLayer[layer].push(entry.index);
        break;
      }

      layer += 1;
    }
  });

  return layers;
}

/**
 * Keep slot nodes on the camera-facing side of the observer sheet.
 *
 * The sheet curl rotates local Z offsets by `theta`. When `cos(theta) < 0`,
 * the local normal flips away from the camera; we mirror slot offsets so they
 * remain in positive Z rather than curling behind the sheet.
 *
 * @param {string} kind
 * @param {number} z
 * @param {number} cos
 * @returns {number}
 */
function zOffsetForCurl(kind, z, cos) {
  if (kind !== 'slot') return z;

  const sign = Math.sign(cos);
  if (sign === 0) return z;
  return z * sign;
}

/**
 * Parameters for the deterministic observer-sheet curl embedding.
 *
 * @typedef {{
 *   maxAbsX: number,
 *   radius: number,
 *   maxAngle: number
 * }} CurlParams
 */

/**
 * @param {Float32Array} positions
 * @returns {CurlParams}
 */
function curlParamsFromPositions(positions) {
  let maxAbsX = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const absX = Math.abs(positions[i]);
    if (absX > maxAbsX) maxAbsX = absX;
  }

  const maxAngle = Math.PI * 0.85;
  const safeMaxAbsX = Math.max(1e-3, maxAbsX);
  const radius = safeMaxAbsX / maxAngle;

  return { maxAbsX: safeMaxAbsX, radius, maxAngle };
}

/**
 * Compute per-node curl weights so only the local binder/slot neighborhood
 * participates fully in the sheet curl.
 *
 * The neighborhood is defined over undirected `child` connectivity, seeded by:
 * - all `binder` + `slot` nodes, and
 * - any parent `pair` node that directly contains a binder/slot.
 *
 * @param {Segment[]} childSegments
 * @param {string[]} kindByIndex
 * @param {number} nodeCount
 * @returns {Float32Array}
 */
function curlWeightsFromGraph(childSegments, kindByIndex, nodeCount) {
  const maxDepth = 5;
  const anchors = new Set();

  for (let index = 0; index < nodeCount; index += 1) {
    const kind = kindByIndex[index] ?? '';
    if (kind === 'binder' || kind === 'slot') anchors.add(index);
  }

  childSegments.forEach(seg => {
    const childKind = kindByIndex[seg.toIndex] ?? '';
    if (childKind !== 'binder' && childKind !== 'slot') return;
    anchors.add(seg.fromIndex);
  });

  const weights = new Float32Array(nodeCount);
  if (!anchors.size) {
    weights.fill(1);
    return weights;
  }

  /** @type {number[][]} */
  const adjacency = new Array(nodeCount);
  for (let index = 0; index < nodeCount; index += 1) adjacency[index] = [];

  childSegments.forEach(seg => {
    adjacency[seg.fromIndex]?.push(seg.toIndex);
    adjacency[seg.toIndex]?.push(seg.fromIndex);
  });

  const distances = new Int16Array(nodeCount);
  distances.fill(-1);

  /** @type {number[]} */
  const queue = [];
  anchors.forEach(nodeIndex => {
    distances[nodeIndex] = 0;
    queue.push(nodeIndex);
  });

  let cursor = 0;
  while (cursor < queue.length) {
    const nodeIndex = queue[cursor];
    cursor += 1;
    const depth = distances[nodeIndex] ?? 0;
    if (depth >= maxDepth) continue;

    adjacency[nodeIndex]?.forEach(neighbor => {
      if (neighbor < 0 || neighbor >= nodeCount) return;
      if (distances[neighbor] >= 0) return;
      distances[neighbor] = depth + 1;
      queue.push(neighbor);
    });
  }

  for (let index = 0; index < nodeCount; index += 1) {
    const depth = distances[index];
    if (depth < 0) {
      weights[index] = 0;
      continue;
    }
    const t = 1 - depth / Math.max(1, maxDepth);
    const eased = clamp(t, 0, 1);
    weights[index] = eased * eased;
  }

  return weights;
}

/**
 * Group node indices by undirected connectivity over pointer edges.
 *
 * @param {Segment[]} segments
 * @param {number} nodeCount
 * @returns {number[][]}
 */
function pointerComponentsFromSegments(segments, nodeCount) {
  const parent = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) parent[i] = i;

  /**
   * @param {number} node
   * @returns {number}
   */
  function find(node) {
    let root = node;
    while (parent[root] !== root) root = parent[root];
    while (parent[node] !== node) {
      const next = parent[node];
      parent[node] = root;
      node = next;
    }
    return root;
  }

  /**
   * @param {number} a
   * @param {number} b
   * @returns {void}
   */
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
  }

  segments.forEach(seg => {
    if (seg.kind !== 'reentry' && seg.kind !== 'value') return;
    union(seg.fromIndex, seg.toIndex);
  });

  /** @type {Map<number, number[]>} */
  const groups = new Map();
  for (let i = 0; i < nodeCount; i += 1) {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(i);
    groups.set(root, list);
  }

  return Array.from(groups.values()).filter(nodes => nodes.length > 1);
}

/**
 * Curl pointer-connected nodes together so re-entrant links become local.
 *
 * This is a non-injective embedding at `fold=1`: each pointer-connected
 * component collapses to its centroid. The approach is deterministic and
 * reversible for `fold<1` (computed from the current sheet pose).
 *
 * @param {Float32Array} positions
 * @param {number[][]} pointerComponents
 * @param {number} fold
 * @param {string[]} kindByIndex
 * @returns {void}
 */
function applyPointerFold(positions, pointerComponents, fold, kindByIndex) {
  const t = clamp(fold, 0, 1);
  if (t <= 1e-6) return;

  const maxAngle = Math.PI * 1.35;
  const angle = t * maxAngle;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const shrink = 1 - t;

  pointerComponents.forEach(component => {
    let cx = 0;
    let cy = 0;
    let cz = 0;

    component.forEach(nodeIndex => {
      const base = nodeIndex * 3;
      cx += positions[base];
      cy += positions[base + 1];
      cz += positions[base + 2];
    });

    const count = component.length;
    if (!count) return;
    cx /= count;
    cy /= count;
    cz /= count;

    component.forEach(nodeIndex => {
      const base = nodeIndex * 3;
      const rx = positions[base] - cx;
      const ry = positions[base + 1] - cy;
      const rz = positions[base + 2] - cz;

      const kind = kindByIndex[nodeIndex] ?? '';
      const direction = kind === 'slot' ? -1 : 1;
      const sinLocal = sin * direction;

      const rotatedY = ry * cos - rz * sinLocal;
      const rotatedZ = ry * sinLocal + rz * cos;

      positions[base] = cx + rx * shrink;
      positions[base + 1] = cy + rotatedY * shrink;
      positions[base + 2] = cz + rotatedZ * shrink;
    });
  });
}

/**
 * Create a Three.js scene for a graph + physics positions.
 *
 * @param {SceneParams} params
 * @returns {VisScene}
 */
export function createScene(params) {
  const nodeRadius = params.nodeRadius ?? 0.18;
  const container = params.container;
  const pointerStyle = params.pointerStyle ?? 'arcs';

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio ?? 1);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const perspectiveCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 500);
  perspectiveCamera.position.set(0, 0, 9);
  perspectiveCamera.lookAt(0, 0, 0);

  const orthographicCamera = new THREE.OrthographicCamera(
    -1,
    1,
    1,
    -1,
    0.01,
    500,
  );
  orthographicCamera.position.copy(perspectiveCamera.position);
  orthographicCamera.quaternion.copy(perspectiveCamera.quaternion);
  orthographicCamera.up.copy(perspectiveCamera.up);

  /** @type {THREE.PerspectiveCamera | THREE.OrthographicCamera} */
  let camera = perspectiveCamera;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.update();

  /**
   * @param {number} distance
   * @returns {number}
   */
  function viewHeightForPerspective(distance) {
    const fovRad = perspectiveCamera.fov * Math.PI / 180;
    return 2 * Math.max(0, distance) * Math.tan(fovRad / 2);
  }

  /** @type {number} */
  let currentAspect = 1;

  /** @type {number} */
  let orthoHeight = viewHeightForPerspective(
    perspectiveCamera.position.distanceTo(controls.target),
  );

  /** @type {'perspective' | 'orthographic'} */
  let cameraMode = 'perspective';

  /**
   * @returns {void}
   */
  function updateOrthoFrustum() {
    const safeHeight = Math.max(0.01, orthoHeight);
    const halfHeight = safeHeight / 2;
    const halfWidth = halfHeight * currentAspect;

    orthographicCamera.left = -halfWidth;
    orthographicCamera.right = halfWidth;
    orthographicCamera.top = halfHeight;
    orthographicCamera.bottom = -halfHeight;
    orthographicCamera.updateProjectionMatrix();
  }

  /**
   * @param {THREE.Camera} source
   * @param {THREE.Camera} target
   * @returns {void}
   */
  function copyCameraPose(source, target) {
    target.position.copy(source.position);
    target.quaternion.copy(source.quaternion);
    target.up.copy(source.up);
  }

  /**
   * @param {'perspective' | 'orthographic'} mode
   * @returns {void}
   */
  function setCameraMode(mode) {
    const normalized = mode === 'orthographic' ? 'orthographic' : 'perspective';
    if (normalized === cameraMode) return;

    const target = controls.target;
    const offset = new THREE.Vector3().copy(camera.position).sub(target);
    let currentDistance = offset.length();
    if (currentDistance < 1e-4) {
      offset.set(0, 0.35, 1);
      currentDistance = 9;
    }
    offset.normalize();

    if (normalized === 'orthographic') {
      orthoHeight = viewHeightForPerspective(currentDistance);
      orthoHeight *= Math.max(1e-6, orthographicCamera.zoom);
      updateOrthoFrustum();
      copyCameraPose(camera, orthographicCamera);
      orthographicCamera.near = Math.max(0.01, currentDistance / 100);
      orthographicCamera.far = Math.max(500, currentDistance * 20);
      orthographicCamera.updateProjectionMatrix();
      camera = orthographicCamera;
      controls.object = camera;
      cameraMode = normalized;
      controls.update();
      return;
    }

    const effectiveHeight =
      orthoHeight / Math.max(1e-6, orthographicCamera.zoom);
    const rawDistance =
      (effectiveHeight / 2) /
      Math.tan((perspectiveCamera.fov * Math.PI / 180) / 2);
    const nextDistance = Math.max(2, rawDistance);
    perspectiveCamera.position
      .copy(target)
      .add(offset.multiplyScalar(nextDistance));
    perspectiveCamera.near = Math.max(0.01, nextDistance / 100);
    perspectiveCamera.far = Math.max(500, nextDistance * 20);
    perspectiveCamera.updateProjectionMatrix();

    camera = perspectiveCamera;
    controls.object = camera;
    cameraMode = normalized;
    controls.update();
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 6);
  scene.add(sun);

  const layoutSpacing = Math.max(1.6, nodeRadius * 8);
  const gridDimensions = params.gridDimensions ?? { x: 20, y: 20, z: 20 };
  const xExtent = Math.max(1, Math.floor(gridDimensions.x));
  const yExtent = Math.max(1, Math.floor(gridDimensions.y));
  const zExtent = Math.max(1, Math.floor(gridDimensions.z));

  const xyHalf = Math.max(xExtent, yExtent);
  const xzHalf = Math.max(xExtent, zExtent);
  const yzHalf = Math.max(yExtent, zExtent);

  const xyDivisions = xyHalf * 2;
  const xzDivisions = xzHalf * 2;
  const yzDivisions = yzHalf * 2;

  const xySize = layoutSpacing * xyDivisions;
  const xzSize = layoutSpacing * xzDivisions;
  const yzSize = layoutSpacing * yzDivisions;

  /**
   * @param {THREE.GridHelper} grid
   * @param {number} opacity
   * @param {'xy' | 'xz' | 'yz'} plane
   * @returns {void}
   */
  function configureGrid(grid, opacity, plane) {
    grid.rotation.set(0, 0, 0);
    if (plane === 'xy') grid.rotation.x = Math.PI / 2;
    if (plane === 'yz') grid.rotation.z = Math.PI / 2;

    const gridMaterial = grid.material;
    const applyGridMaterial = entry => {
      entry.transparent = true;
      entry.opacity = opacity;
      entry.depthWrite = false;
      entry.needsUpdate = true;
    };
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach(applyGridMaterial);
    } else {
      applyGridMaterial(gridMaterial);
    }
  }

  const minorGrid = new THREE.GridHelper(
    xySize,
    xyDivisions * 2,
    0x000000,
    0x000000,
  );
  configureGrid(minorGrid, 0.08, 'xy');
  const minorGridXZ = new THREE.GridHelper(
    xzSize,
    xzDivisions * 2,
    0x000000,
    0x000000,
  );
  configureGrid(minorGridXZ, 0.08, 'xz');
  minorGridXZ.visible = false;
  scene.add(minorGridXZ);
  const minorGridYZ = new THREE.GridHelper(
    yzSize,
    yzDivisions * 2,
    0x000000,
    0x000000,
  );
  configureGrid(minorGridYZ, 0.08, 'yz');
  minorGridYZ.visible = false;
  scene.add(minorGridYZ);

  scene.add(minorGrid);

  const majorGrid = new THREE.GridHelper(
    xySize,
    xyDivisions,
    0x000000,
    0x000000,
  );
  configureGrid(majorGrid, 0.1, 'xy');
  const majorGridXZ = new THREE.GridHelper(
    xzSize,
    xzDivisions,
    0x000000,
    0x000000,
  );
  configureGrid(majorGridXZ, 0.1, 'xz');
  majorGridXZ.visible = false;
  scene.add(majorGridXZ);
  const majorGridYZ = new THREE.GridHelper(
    yzSize,
    yzDivisions,
    0x000000,
    0x000000,
  );
  configureGrid(majorGridYZ, 0.1, 'yz');
  majorGridYZ.visible = false;
  scene.add(majorGridYZ);

  scene.add(majorGrid);

  const xyzGrid = createXYZGrid(
    { x: xExtent, y: yExtent, z: zExtent },
    layoutSpacing,
    0x000000,
    0.035,
  );
  xyzGrid.visible = false;
  scene.add(xyzGrid);

  const axes = new THREE.AxesHelper(2.5);
  scene.add(axes);

  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  /** @type {THREE.InstancedMesh | null} */
  let pairNodes = null;

  /** @type {THREE.InstancedMesh | null} */
  let otherNodes = null;

  /** @type {THREE.SphereGeometry | null} */
  let nodeGeometry = null;

  /** @type {THREE.MeshStandardMaterial | null} */
  let nodeMaterial = null;

  /** @type {THREE.MeshStandardMaterial | null} */
  let pairMaterial = null;

  /** @type {number} */
  let nodeCount = 0;

  /** @type {Float32Array} */
  let scaleByIndex = new Float32Array(0);

  /** @type {string[]} */
  let kindByIndex = [];

  /** @type {Int32Array} */
  let pairInstanceByIndex = new Int32Array(0);

  /** @type {Int32Array} */
  let otherInstanceByIndex = new Int32Array(0);

  /** @type {(CSS2DObject | null)[]} */
  let labelsByIndex = [];

	  /** @type {ReturnType<typeof createLineSegments> | null} */
	  let childLines = null;

	  /** @type {ReturnType<typeof createArcLines> |
	   *   ReturnType<typeof createLineSegments> | null} */
	  let pointerLines = null;

  /** @type {THREE.Mesh | null} */
  let sheetMesh = null;

  /** @type {THREE.BufferGeometry | null} */
  let sheetGeometry = null;

  /** @type {THREE.MeshBasicMaterial | null} */
  let sheetMaterial = null;

  /** @type {Float32Array} */
  let curledPositions = new Float32Array(0);

  /** @type {Float32Array} */
  let curlWeightByIndex = new Float32Array(0);

  /** @type {CurlParams | null} */
  let curlParams = null;

  /** @type {number[][]} */
  let pointerComponents = [];

  /** @type {number} */
  let curl = 0;

  const dummy = new THREE.Object3D();

  /**
   * @returns {void}
   */
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    currentAspect = width / Math.max(1, height);
    perspectiveCamera.aspect = currentAspect;
    perspectiveCamera.updateProjectionMatrix();
    updateOrthoFrustum();

    [childLines, pointerLines].forEach(lines => {
      if (!lines) return;
      lines.object.material.resolution.set(width, height);
    });
  }

  /**
   * @returns {void}
   */
  function disposeGraphObjects() {
    if (pairNodes) scene.remove(pairNodes);
    if (otherNodes) scene.remove(otherNodes);
    if (childLines) scene.remove(childLines.object);
    if (pointerLines) scene.remove(pointerLines.object);
    if (sheetMesh) scene.remove(sheetMesh);

    labelsByIndex.forEach(label => {
      if (!label) return;
      if (label.element && typeof label.element.remove === 'function') {
        label.element.remove();
      }
      labelGroup.remove(label);
    });
    labelsByIndex = [];

    if (pairNodes && pairNodes.instanceColor) {
      pairNodes.instanceColor.needsUpdate = false;
    }
    if (otherNodes && otherNodes.instanceColor) {
      otherNodes.instanceColor.needsUpdate = false;
    }

    if (nodeGeometry) nodeGeometry.dispose();
    if (nodeMaterial) nodeMaterial.dispose();
    if (pairMaterial) pairMaterial.dispose();
    if (childLines) {
      childLines.object.geometry.dispose();
      childLines.object.material.dispose();
    }
    if (pointerLines) {
      pointerLines.object.geometry.dispose();
      pointerLines.object.material.dispose();
    }

    if (sheetGeometry) sheetGeometry.dispose();
    if (sheetMaterial) sheetMaterial.dispose();

    pairNodes = null;
    otherNodes = null;
    nodeGeometry = null;
    nodeMaterial = null;
    pairMaterial = null;
    childLines = null;
    pointerLines = null;
    sheetMesh = null;
    sheetGeometry = null;
    sheetMaterial = null;
    nodeCount = 0;
    scaleByIndex = new Float32Array(0);
    pairInstanceByIndex = new Int32Array(0);
    otherInstanceByIndex = new Int32Array(0);
    curledPositions = new Float32Array(0);
    curlWeightByIndex = new Float32Array(0);
    curlParams = null;
    pointerComponents = [];
  }

  /**
   * @returns {void}
   */
  function applyCurlVisuals() {
    const clamped = clamp(curl, 0, 1);
    const sheetOpacity = 0.22 * clamped;

    if (sheetMesh && sheetMaterial) {
      sheetMesh.visible = sheetOpacity > 1e-3;
      sheetMaterial.transparent = true;
      sheetMaterial.opacity = sheetOpacity;
      sheetMaterial.needsUpdate = true;
    }
  }

  /**
   * @param {SceneGraph} next
   * @returns {void}
   */
  function setGraph(next) {
    disposeGraphObjects();

    nodeCount = next.nodeIds.length;
    curledPositions = new Float32Array(nodeCount * 3);
    curlWeightByIndex = new Float32Array(nodeCount);
    curlParams = null;
    pointerComponents = [];
    pairInstanceByIndex = new Int32Array(nodeCount);
    otherInstanceByIndex = new Int32Array(nodeCount);
    pairInstanceByIndex.fill(-1);
    otherInstanceByIndex.fill(-1);

    nodeGeometry = new THREE.SphereGeometry(nodeRadius, 16, 12);
    nodeMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.65,
    });

    scaleByIndex = new Float32Array(nodeCount);
    labelsByIndex = new Array(nodeCount).fill(null);

    const tempColor = new THREE.Color();
    kindByIndex = new Array(nodeCount);
    let pairCount = 0;
    let otherCount = 0;

    next.nodeIds.forEach((nodeId, index) => {
      const attrs = next.graph.getNodeAttributes(nodeId);
      const kind = String(attrs?.kind ?? 'unknown');
      kindByIndex[index] = kind;
      if (kind === 'pair') pairCount += 1;
      else otherCount += 1;

      const label = labelForNode(attrs ?? {});
      if (!label) return;

      const element = document.createElement('div');
      element.className = `node-label ${label.className}`;
      element.textContent = label.text;
      const object = new CSS2DObject(element);
      labelGroup.add(object);
      labelsByIndex[index] = object;
    });

    pairMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.65,
      transparent: true,
      opacity: 0.8,
    });

    if (otherCount) {
      const mesh = new THREE.InstancedMesh(
        nodeGeometry,
        nodeMaterial,
        otherCount,
      );
      otherNodes = mesh;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    if (pairCount) {
      const mesh = new THREE.InstancedMesh(
        nodeGeometry,
        pairMaterial,
        pairCount,
      );
      pairNodes = mesh;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    let nextPairInstance = 0;
    let nextOtherInstance = 0;
    next.nodeIds.forEach((nodeId, index) => {
      const kind = kindByIndex[index] ?? 'unknown';
      scaleByIndex[index] = scaleForKind(kind);
      tempColor.setHex(colorForKind(kind));

      if (kind === 'pair') {
        if (!pairNodes) return;
        pairInstanceByIndex[index] = nextPairInstance;
        pairNodes.setColorAt(nextPairInstance, tempColor);
        nextPairInstance += 1;
        return;
      }

      if (!otherNodes) return;
      otherInstanceByIndex[index] = nextOtherInstance;
      otherNodes.setColorAt(nextOtherInstance, tempColor);
      nextOtherInstance += 1;
    });

    if (pairNodes && pairNodes.instanceColor) {
      pairNodes.instanceColor.needsUpdate = true;
    }
    if (otherNodes && otherNodes.instanceColor) {
      otherNodes.instanceColor.needsUpdate = true;
    }

    const childSegments = next.segments.filter(seg => seg.kind === 'child');
    const pointerSegments = next.segments.filter(seg =>
      seg.kind === 'reentry' || seg.kind === 'value'
    );
    curlWeightByIndex = curlWeightsFromGraph(
      childSegments,
      kindByIndex,
      nodeCount,
    );

	    childLines = createLineSegments(childSegments, 0x000000);
	    childLines.object.frustumCulled = false;
	    scene.add(childLines.object);
	    if (pointerSegments.length) {
	      pointerLines = pointerStyle === 'lines'
	        ? createLineSegments(pointerSegments, 0x000000)
	        : createArcLines(pointerSegments, 0x000000);
	      pointerLines.object.frustumCulled = false;
	      scene.add(pointerLines.object);
	    }
    pointerComponents = pointerComponentsFromSegments(
      pointerSegments,
      nodeCount,
    );

    const nodeIndexById = new Map(
      next.nodeIds.map((nodeId, index) => [nodeId, index]),
    );

    const childrenByParent = new Map();
    next.graph.forEachEdge((edgeKey, attrs, source, target) => {
      if (attrs?.kind !== 'child') return;
      const index = attrs?.index;
      if (index !== 0 && index !== 1) return;
      const existing = childrenByParent.get(source) ?? [null, null];
      const nextChildren = [...existing];
      nextChildren[index] = target;
      childrenByParent.set(source, nextChildren);
    });

    const triangleIndices = [];
    childrenByParent.forEach((children, parentId) => {
      const leftId = children[0];
      const rightId = children[1];
      if (!leftId || !rightId) return;

      const parentIndex = nodeIndexById.get(parentId);
      const leftIndex = nodeIndexById.get(leftId);
      const rightIndex = nodeIndexById.get(rightId);
      if (
        typeof parentIndex !== 'number' ||
        typeof leftIndex !== 'number' ||
        typeof rightIndex !== 'number'
      ) {
        return;
      }
      triangleIndices.push(parentIndex, leftIndex, rightIndex);
    });

    if (triangleIndices.length) {
      sheetGeometry = new THREE.BufferGeometry();
      sheetGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(curledPositions, 3),
      );
      sheetGeometry.setIndex(triangleIndices);
      sheetMaterial = new THREE.MeshBasicMaterial({
        color: 0x111827,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      sheetMesh = new THREE.Mesh(sheetGeometry, sheetMaterial);
      sheetMesh.frustumCulled = false;
      scene.add(sheetMesh);
    }

    applyCurlVisuals();
    resize();
  }

  /**
   * @param {number} fold
   * @returns {void}
   */
  function setCurl(fold) {
    curl = clamp(fold, 0, 1);
    applyCurlVisuals();
  }

  /**
   * @param {number} opacity
   * @returns {void}
   */
  function setPointerLinkOpacity(opacity) {
    const clamped = Math.max(0, Math.min(1, opacity));
    if (!pointerLines) return;
    pointerLines.object.visible = clamped > 1e-3;
    pointerLines.object.material.transparent = true;
    pointerLines.object.material.opacity = clamped;
    pointerLines.object.material.needsUpdate = true;
  }

  /**
   * @param {{
   *   object: LineSegments2,
   *   buffer: Float32Array,
   *   segments: Segment[]
   * }} lines
   * @param {Float32Array} positions
   * @returns {void}
   */
  function updateLines(lines, positions) {
    const buffer = lines.buffer;
    lines.segments.forEach((seg, index) => {
      const a = seg.fromIndex * 3;
      const b = seg.toIndex * 3;
      const base = index * 6;

      buffer[base] = positions[a];
      buffer[base + 1] = positions[a + 1];
      buffer[base + 2] = positions[a + 2];
      buffer[base + 3] = positions[b];
      buffer[base + 4] = positions[b + 1];
      buffer[base + 5] = positions[b + 2];
    });

    const attr = lines.object.geometry.getAttribute('instanceStart');
    attr.needsUpdate = true;
  }

  /**
   * @param {ReturnType<typeof createArcLines>} lines
   * @param {Float32Array} positions
   * @returns {void}
   */
  function updatePointerArcs(lines, positions) {
    if (!lines.segments.length) return;

    if (!lines.layers) {
      lines.layers = arcLayersForSegments(lines.segments, positions);
    }

    const steps = lines.steps;
    const segmentsPerArc = Math.max(1, steps - 1);
    const buffer = lines.buffer;
    const baseLift = layoutSpacing * 0.8;
    const layerLift = layoutSpacing * 0.35;

    lines.segments.forEach((segment, edgeIndex) => {
      const fromBase = segment.fromIndex * 3;
      const toBase = segment.toIndex * 3;
      const ax = positions[fromBase];
      const ay = positions[fromBase + 1];
      const az = positions[fromBase + 2];
      const bx = positions[toBase];
      const by = positions[toBase + 1];
      const bz = positions[toBase + 2];

      const layer = lines.layers ? lines.layers[edgeIndex] : 0;
      const lift = baseLift + Math.max(0, layer) * layerLift;

      for (let step = 0; step < segmentsPerArc; step += 1) {
        const t0 = step / segmentsPerArc;
        const t1 = (step + 1) / segmentsPerArc;
        const w0 = arcPlateauWeight(t0);
        const w1 = arcPlateauWeight(t1);

        const p0x = lerp(ax, bx, t0);
        const p0y = lerp(ay, by, t0);
        const p0z = lerp(az, bz, t0) + w0 * lift;
        const p1x = lerp(ax, bx, t1);
        const p1y = lerp(ay, by, t1);
        const p1z = lerp(az, bz, t1) + w1 * lift;

        const base = (edgeIndex * segmentsPerArc + step) * 6;
        buffer[base] = p0x;
        buffer[base + 1] = p0y;
        buffer[base + 2] = p0z;
        buffer[base + 3] = p1x;
        buffer[base + 4] = p1y;
        buffer[base + 5] = p1z;
      }
    });

    const attr = lines.object.geometry.getAttribute('instanceStart');
    attr.needsUpdate = true;
  }

  resize();
  window.addEventListener('resize', resize);

  /**
   * @param {Float32Array} positions
   * @returns {void}
   */
  function update(positions) {
    if (!pairNodes && !otherNodes) return;
    if (!childLines) return;

    if (!curlParams) {
      curlParams = curlParamsFromPositions(positions);
    }

    const { maxAbsX, radius, maxAngle } = curlParams;
    const fold = clamp(curl, 0, 1);

    for (let index = 0; index < nodeCount; index += 1) {
      const base = index * 3;
      const x = positions[base];
      const y = positions[base + 1];
      const theta = (x / maxAbsX) * maxAngle;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const kind = kindByIndex[index] ?? '';
      const baseZ = positions[base + 2];
      const z = zOffsetForCurl(kind, baseZ, cos);
      const rolledX = radius * sin;
      const rolledZ = radius * (1 - cos);

      const targetX = rolledX + sin * z;
      const targetZ = rolledZ + cos * z;
      const weight = curlWeightByIndex[index] ?? 1;
      const localFold = fold * clamp(weight, 0, 1);
      const curledX = lerp(x, targetX, localFold);
      const curledY = y;
      const curledZ = lerp(baseZ, targetZ, localFold);

      curledPositions[base] = curledX;
      curledPositions[base + 1] = curledY;
      curledPositions[base + 2] = curledZ;
    }

    applyPointerFold(curledPositions, pointerComponents, fold, kindByIndex);

    for (let index = 0; index < nodeCount; index += 1) {
      const base = index * 3;
      const x = curledPositions[base];
      const y = curledPositions[base + 1];
      const z = curledPositions[base + 2];
      const scale = scaleByIndex[index] ?? 1;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      const pairInstance = pairInstanceByIndex[index];
      const otherInstance = otherInstanceByIndex[index];
      if (pairNodes && pairInstance >= 0) {
        pairNodes.setMatrixAt(pairInstance, dummy.matrix);
      }
      if (otherNodes && otherInstance >= 0) {
        otherNodes.setMatrixAt(otherInstance, dummy.matrix);
      }

      const label = labelsByIndex[index];
      if (label) {
        label.position.set(x, y + nodeRadius * 2.1 * scale, z);
      }
    }
	    if (pairNodes) pairNodes.instanceMatrix.needsUpdate = true;
	    if (otherNodes) otherNodes.instanceMatrix.needsUpdate = true;

	    updateLines(childLines, curledPositions);
	    if (pointerLines) {
	      if ('steps' in pointerLines) {
	        updatePointerArcs(pointerLines, curledPositions);
	      } else {
	        updateLines(pointerLines, curledPositions);
	      }
	    }

	    if (sheetGeometry) {
	      const attr = sheetGeometry.getAttribute('position');
	      attr.needsUpdate = true;
	    }
  }

  /**
   * Fit the current camera/controls to contain the provided positions.
   *
   * @param {Float32Array} positions
   * @returns {void}
   */
  function fitToPositions(positions) {
    const bounds = boundsFromPositions(positions);
    if (!bounds) return;

    const padding = 1.25;
    const radius = Math.max(bounds.radius, nodeRadius) * padding;
    const offset = new THREE.Vector3()
      .copy(camera.position)
      .sub(controls.target);
    let currentDistance = offset.length();
    if (currentDistance < 1e-4) {
      offset.set(0, 0.35, 1);
      currentDistance = 9;
    }
    offset.normalize();

    controls.target.copy(bounds.center);

    if (cameraMode === 'orthographic') {
      const halfHeight = radius * Math.max(1, 1 / currentAspect);
      orthographicCamera.zoom = 1;
      orthoHeight = halfHeight * 2;
      updateOrthoFrustum();

      const distance = Math.max(currentDistance, 2);
      orthographicCamera.position
        .copy(bounds.center)
        .add(offset.multiplyScalar(distance));
      orthographicCamera.near = Math.max(0.01, distance / 100);
      orthographicCamera.far = distance * 20 + radius * 2;
      orthographicCamera.updateProjectionMatrix();
      controls.update();
      return;
    }

    const vFov = perspectiveCamera.fov * Math.PI / 180;
    const vDistance = radius / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * currentAspect);
    const hDistance = radius / Math.tan(hFov / 2);
    const distance = Math.max(vDistance, hDistance, 2);

    perspectiveCamera.position
      .copy(bounds.center)
      .add(offset.multiplyScalar(distance));
    perspectiveCamera.near = Math.max(0.01, distance / 100);
    perspectiveCamera.far = distance * 20 + radius * 2;
    perspectiveCamera.updateProjectionMatrix();
    controls.update();
  }

  /**
   * @param {'none' | 'xy' | 'xz' | 'yz' | 'xyz'} mode
   * @returns {void}
   */
  function setGridMode(mode) {
    const normalized = (
      mode === 'none' ||
      mode === 'xz' ||
      mode === 'yz' ||
      mode === 'xyz'
    )
      ? mode
      : 'xy';
    const showXY = normalized === 'xy';
    const showXZ = normalized === 'xz';
    const showYZ = normalized === 'yz';
    const showXYZ = normalized === 'xyz';
    minorGrid.visible = showXY;
    majorGrid.visible = showXY;
    minorGridXZ.visible = showXZ;
    majorGridXZ.visible = showXZ;
    minorGridYZ.visible = showYZ;
    majorGridYZ.visible = showYZ;
    xyzGrid.visible = showXYZ;
  }

  /**
   * @returns {void}
   */
  function render() {
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  /**
   * @returns {void}
   */
  function dispose() {
    window.removeEventListener('resize', resize);
    disposeGraphObjects();
    [minorGrid, majorGrid, minorGridXZ, majorGridXZ, minorGridYZ, majorGridYZ]
      .forEach(grid => {
        scene.remove(grid);
        grid.geometry.dispose();
        const gridMaterial = grid.material;
        if (Array.isArray(gridMaterial)) {
          gridMaterial.forEach(material => material.dispose());
        } else {
          gridMaterial.dispose();
        }
      });

    scene.remove(xyzGrid);
    xyzGrid.geometry.dispose();
    const xyzMaterial = xyzGrid.material;
    if (Array.isArray(xyzMaterial)) {
      xyzMaterial.forEach(material => material.dispose());
    } else {
      xyzMaterial.dispose();
    }
    controls.dispose();
    renderer.dispose();
    container.removeChild(labelRenderer.domElement);
    container.removeChild(renderer.domElement);
  }

  return {
    setGraph,
    update,
    fitToPositions,
    setCameraMode,
    setGridMode,
    setCurl,
    setPointerLinkOpacity,
    render,
    dispose,
  };
}
