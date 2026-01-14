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
  camera.position.set(0, 3.5, 9);
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
  grid.position.y = -8;
  scene.add(grid);

  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  /** @type {SceneGraph | null} */
  let graphValue = null;

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
      childLines.object.material.dispose();
    }
    if (linkLines) {
      linkLines.object.geometry.dispose();
      linkLines.object.material.dispose();
    }

    nodes = null;
    nodeGeometry = null;
    nodeMaterial = null;
    childLines = null;
    linkLines = null;
    nodeCount = 0;
    scaleByIndex = new Float32Array(0);
    graphValue = null;
  }

  /**
   * @param {SceneGraph} next
   * @returns {void}
   */
  function setGraph(next) {
    disposeGraphObjects();
    graphValue = next;

    nodeCount = next.nodeIds.length;
    nodeGeometry = new THREE.SphereGeometry(nodeRadius, 16, 12);
    nodeMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.65,
    });

    nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
    nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nodes.frustumCulled = false;

    scaleByIndex = new Float32Array(nodeCount);
    labelsByIndex = new Array(nodeCount).fill(null);

    const tempColor = new THREE.Color();
    next.nodeIds.forEach((nodeId, index) => {
      const attrs = next.graph.getNodeAttributes(nodeId);
      const kind = String(attrs?.kind ?? 'unknown');
      scaleByIndex[index] = scaleForKind(kind);
      tempColor.setHex(colorForKind(kind));
      nodes.setColorAt(index, tempColor);

      const label = labelForNode(attrs ?? {});
      if (!label) return;

      const element = document.createElement('div');
      element.className = `node-label ${label.className}`;
      element.textContent = label.text;
      const object = new CSS2DObject(element);
      labelGroup.add(object);
      labelsByIndex[index] = object;
    });

    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
    scene.add(nodes);

    const childSegments = next.segments.filter(seg => seg.kind === 'child');
    const linkSegments = next.segments.filter(
      seg => seg.kind === 'reentry' || seg.kind === 'value',
    );

    childLines = createLineSegments(childSegments, 0x64748b);
    linkLines = createLineSegments(linkSegments, 0xf59e0b);
    scene.add(childLines.object);
    scene.add(linkLines.object);
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

    for (let index = 0; index < nodeCount; index += 1) {
      const base = index * 3;
      const x = positions[base];
      const y = positions[base + 1];
      const z = positions[base + 2];
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

    updateLines(childLines, positions);
    updateLines(linkLines, positions);
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

  return { setGraph, update, fitToPositions, render, dispose };
}
