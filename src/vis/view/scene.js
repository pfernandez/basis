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
 * @typedef {{
 *   kind: string,
 *   fromIndex: number,
 *   toIndex: number
 * }} Segment
 */

/**
 * @typedef {{
 *   container: HTMLElement,
 *   graph: import('graphology').MultiDirectedGraph,
 *   nodeIds: string[],
 *   nodeIndexById: Map<string, number>,
 *   segments: Segment[],
 *   nodeRadius?: number
 * }} SceneParams
 */

/**
 * @typedef {{
 *   update: (positions: Float32Array) => void,
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

  const nodeCount = params.nodeIds.length;
  const nodeGeometry = new THREE.SphereGeometry(nodeRadius, 16, 12);
  const nodeMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.1,
    roughness: 0.65,
  });
  const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
  nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodes.frustumCulled = false;

  const scaleByIndex = new Float32Array(nodeCount);
  const labelsByIndex = new Array(nodeCount).fill(null);
  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  const tempColor = new THREE.Color();
  params.nodeIds.forEach((nodeId, index) => {
    const attrs = params.graph.getNodeAttributes(nodeId);
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

  const childSegments = params.segments.filter(seg => seg.kind === 'child');
  const linkSegments = params.segments.filter(
    seg => seg.kind === 'reentry' || seg.kind === 'value',
  );

  const childLines = createLineSegments(childSegments, 0x64748b);
  const linkLines = createLineSegments(linkSegments, 0xf59e0b);
  scene.add(childLines.object);
  scene.add(linkLines.object);

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
    controls.dispose();
    renderer.dispose();
    nodeGeometry.dispose();
    nodeMaterial.dispose();
    childLines.object.geometry.dispose();
    childLines.object.material.dispose();
    linkLines.object.geometry.dispose();
    linkLines.object.material.dispose();
    container.removeChild(labelRenderer.domElement);
    container.removeChild(renderer.domElement);
  }

  return { update, render, dispose };
}
