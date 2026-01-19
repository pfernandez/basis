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

/**
 * @typedef {import('../types.js').Segment} Segment
 */

/**
 * @typedef {{
 *   container: HTMLElement,
 *   nodeRadius?: number
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
      return 0x4b5563;
    case 'symbol':
      return 0x60a5fa;
    case 'binder':
      return 0x34d399;
    case 'slot':
      return 0xfbbf24;
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
      return 1.25;
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

/**
 * @param {Segment[]} segments
 * @param {number} color
 * @returns {{
 *   object: THREE.LineSegments,
 *   buffer: Float32Array,
 *   segments: Segment[]
 * }}
 */
function createLineSegments(segments, color) {
  const buffer = new Float32Array(segments.length * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
  });

  return {
    object: new THREE.LineSegments(geometry, material),
    buffer,
    segments,
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
 * @returns {void}
 */
function applyPointerFold(positions, pointerComponents, fold) {
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

      const rotatedY = ry * cos - rz * sin;
      const rotatedZ = ry * sin + rz * cos;

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
  scene.background = new THREE.Color(0x0b1020);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 500);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.update();

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 6);
  scene.add(sun);

  const grid = new THREE.GridHelper(60, 60, 0x1f2937, 0x111827);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  const axes = new THREE.AxesHelper(2.5);
  scene.add(axes);

  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  /** @type {THREE.InstancedMesh | null} */
  let nodes = null;

  /** @type {THREE.SphereGeometry | null} */
  let nodeGeometry = null;

  /** @type {THREE.MeshStandardMaterial | null} */
  let nodeMaterial = null;

  /** @type {number} */
  let nodeCount = 0;

  /** @type {Float32Array} */
  let scaleByIndex = new Float32Array(0);

  /** @type {(CSS2DObject | null)[]} */
  let labelsByIndex = [];

  /** @type {ReturnType<typeof createLineSegments> | null} */
  let childLines = null;

  /** @type {ReturnType<typeof createLineSegments> | null} */
  let linkLines = null;

  /** @type {THREE.Mesh | null} */
  let sheetMesh = null;

  /** @type {THREE.BufferGeometry | null} */
  let sheetGeometry = null;

  /** @type {THREE.MeshBasicMaterial | null} */
  let sheetMaterial = null;

  /** @type {Float32Array} */
  let curledPositions = new Float32Array(0);

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
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  /**
   * @returns {void}
   */
  function disposeGraphObjects() {
    if (nodes) scene.remove(nodes);
    if (childLines) scene.remove(childLines.object);
    if (linkLines) scene.remove(linkLines.object);
    if (sheetMesh) scene.remove(sheetMesh);

    labelsByIndex.forEach(label => {
      if (!label) return;
      if (label.element && typeof label.element.remove === 'function') {
        label.element.remove();
      }
      labelGroup.remove(label);
    });
    labelsByIndex = [];

    if (nodes && nodes.instanceColor) {
      nodes.instanceColor.needsUpdate = false;
    }

    if (nodeGeometry) nodeGeometry.dispose();
    if (nodeMaterial) nodeMaterial.dispose();
    if (childLines) {
      childLines.object.geometry.dispose();
      const material = childLines.object.material;
      if (Array.isArray(material)) {
        material.forEach(entry => entry.dispose());
      } else {
        material.dispose();
      }
    }
    if (linkLines) {
      linkLines.object.geometry.dispose();
      const material = linkLines.object.material;
      if (Array.isArray(material)) {
        material.forEach(entry => entry.dispose());
      } else {
        material.dispose();
      }
    }

    if (sheetGeometry) sheetGeometry.dispose();
    if (sheetMaterial) sheetMaterial.dispose();

    nodes = null;
    nodeGeometry = null;
    nodeMaterial = null;
    childLines = null;
    linkLines = null;
    sheetMesh = null;
    sheetGeometry = null;
    sheetMaterial = null;
    nodeCount = 0;
    scaleByIndex = new Float32Array(0);
    curledPositions = new Float32Array(0);
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
    curlParams = null;
    pointerComponents = [];

    nodeGeometry = new THREE.SphereGeometry(nodeRadius, 16, 12);
    nodeMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.65,
    });

    const mesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
    nodes = mesh;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;

    scaleByIndex = new Float32Array(nodeCount);
    labelsByIndex = new Array(nodeCount).fill(null);

    const tempColor = new THREE.Color();
    next.nodeIds.forEach((nodeId, index) => {
      const attrs = next.graph.getNodeAttributes(nodeId);
      const kind = String(attrs?.kind ?? 'unknown');
      scaleByIndex[index] = scaleForKind(kind);
      tempColor.setHex(colorForKind(kind));
      mesh.setColorAt(index, tempColor);

      const label = labelForNode(attrs ?? {});
      if (!label) return;

      const element = document.createElement('div');
      element.className = `node-label ${label.className}`;
      element.textContent = label.text;
      const object = new CSS2DObject(element);
      labelGroup.add(object);
      labelsByIndex[index] = object;
    });

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const childSegments = next.segments.filter(seg => seg.kind === 'child');
    const linkSegments = next.segments.filter(
      seg => seg.kind === 'reentry' || seg.kind === 'value',
    );

    childLines = createLineSegments(childSegments, 0x64748b);
    linkLines = createLineSegments(linkSegments, 0xf59e0b);
    scene.add(childLines.object);
    scene.add(linkLines.object);
    pointerComponents = pointerComponentsFromSegments(linkSegments, nodeCount);

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

    scene.add(mesh);
    applyCurlVisuals();
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
    if (!linkLines) return;
    const clamped = Math.max(0, Math.min(1, opacity));
    linkLines.object.visible = clamped > 1e-3;
    const material = linkLines.object.material;
    const updateMaterial = entry => {
      entry.transparent = true;
      entry.opacity = clamped;
      entry.needsUpdate = true;
    };
    if (Array.isArray(material)) {
      material.forEach(updateMaterial);
      return;
    }
    updateMaterial(material);
  }

  /**
   * @param {{
   *   object: THREE.LineSegments,
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

    const attr = lines.object.geometry.getAttribute('position');
    attr.needsUpdate = true;
  }

  resize();
  window.addEventListener('resize', resize);

  /**
   * @param {Float32Array} positions
   * @returns {void}
   */
  function update(positions) {
    if (!nodes) return;
    if (!childLines || !linkLines) return;

    if (!curlParams) {
      curlParams = curlParamsFromPositions(positions);
    }

    const { maxAbsX, radius, maxAngle } = curlParams;
    const fold = clamp(curl, 0, 1);

    for (let index = 0; index < nodeCount; index += 1) {
      const base = index * 3;
      const x = positions[base];
      const y = positions[base + 1];
      const z = positions[base + 2];

      const theta = (x / maxAbsX) * maxAngle;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const rolledX = radius * sin;
      const rolledZ = radius * (1 - cos);

      const targetX = rolledX + sin * z;
      const targetZ = rolledZ + cos * z;
      const curledX = lerp(x, targetX, fold);
      const curledY = y;
      const curledZ = lerp(z, targetZ, fold);

      curledPositions[base] = curledX;
      curledPositions[base + 1] = curledY;
      curledPositions[base + 2] = curledZ;
    }

    applyPointerFold(curledPositions, pointerComponents, fold);

    for (let index = 0; index < nodeCount; index += 1) {
      const base = index * 3;
      const x = curledPositions[base];
      const y = curledPositions[base + 1];
      const z = curledPositions[base + 2];
      const scale = scaleByIndex[index] ?? 1;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      nodes.setMatrixAt(index, dummy.matrix);

      const label = labelsByIndex[index];
      if (label) {
        label.position.set(x, y + nodeRadius * 2.1 * scale, z);
      }
    }
    nodes.instanceMatrix.needsUpdate = true;

    updateLines(childLines, curledPositions);
    updateLines(linkLines, curledPositions);

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

    const vFov = camera.fov * Math.PI / 180;
    const vDistance = radius / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const hDistance = radius / Math.tan(hFov / 2);
    const distance = Math.max(vDistance, hDistance, 2);

    const direction = new THREE.Vector3()
      .copy(camera.position)
      .sub(controls.target);
    if (direction.lengthSq() < 1e-8) direction.set(0, 0.35, 1);
    direction.normalize();

    controls.target.copy(bounds.center);
    camera.position.copy(bounds.center).add(direction.multiplyScalar(distance));
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 20 + radius * 2;
    camera.updateProjectionMatrix();
    controls.update();
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
    controls.dispose();
    renderer.dispose();
    container.removeChild(labelRenderer.domElement);
    container.removeChild(renderer.domElement);
  }

  return {
    setGraph,
    update,
    fitToPositions,
    setCurl,
    setPointerLinkOpacity,
    render,
    dispose,
  };
}
