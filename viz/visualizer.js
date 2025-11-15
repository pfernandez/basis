import {
  render,
  component,
  h1,
  div,
  section,
  label,
  span,
  input,
  svg,
  path,
} from '../lib/elements.js';
import { sampleTrace } from './sample-trace.js';

const VIEWPORT = { width: 960, height: 560, depth: 140 };
const NODE_SPACING = { x: 1, y: 1.12 };
const DEFAULT_STATE = {
  trace: sampleTrace,
  step: 0,
  showLoops: true,
  shareStructure: false,
  rotation: -24,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function subtreeSize(nodeId, map, cache) {
  if (cache.has(nodeId)) return cache.get(nodeId);
  const node = map.get(nodeId);
  if (!node) {
    cache.set(nodeId, 1);
    return 1;
  }
  if (!node.children || node.children.length === 0) {
    cache.set(nodeId, 1);
    return 1;
  }
  const size = node.children.reduce((sum, child) => sum + subtreeSize(child, map, cache), 0);
  cache.set(nodeId, size);
  return size;
}

function assignPositions(nodeId, map, cache, depth, offset, positions) {
  const node = map.get(nodeId);
  const width = cache.get(nodeId) ?? 1;
  const x = offset + width / 2;
  const pos = {
    x: x * NODE_SPACING.x,
    y: depth * NODE_SPACING.y,
    z: 0,
    shared: false,
  };
  positions.set(nodeId, pos);

  if (!node?.children) return;
  let cursor = offset;
  node.children.forEach(childId => {
    const childWidth = cache.get(childId) ?? 1;
    assignPositions(childId, map, cache, depth + 1, cursor, positions);
    cursor += childWidth;
  });
}

function normalizePositions(posMap, stepIndex) {
  const xs = [...posMap.values()].map(p => p.x);
  const ys = [...posMap.values()].map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const scale = Math.min(
    (VIEWPORT.width - 120) / spanX,
    (VIEWPORT.height - 160) / spanY,
  );

  const normalized = new Map();
  posMap.forEach((pos, id) => {
    normalized.set(id, {
      x: (pos.x - (minX + spanX / 2)) * scale,
      y: (pos.y - minY) * scale,
      z: stepIndex * VIEWPORT.depth,
      shared: pos.shared,
    });
  });
  return normalized;
}

function computeLayout(step, index, shareStructure) {
  const nodeMap = new Map(step.nodes.map(node => [node.id, node]));
  const cache = new Map();
  subtreeSize(step.root, nodeMap, cache);

  const positions = new Map();
  assignPositions(step.root, nodeMap, cache, 0, 0, positions);

  const anchors = new Map();
  step.nodes.forEach(node => {
    if (node.anchorKey && positions.has(node.id)) {
      anchors.set(node.anchorKey, positions.get(node.id));
    }
  });

  if (shareStructure) {
    step.nodes.forEach(node => {
      if (node.aliasKey && anchors.has(node.aliasKey)) {
        const anchorPos = anchors.get(node.aliasKey);
        positions.set(node.id, { ...anchorPos, shared: true });
      }
    });
  }

  const normalized = normalizePositions(positions, index);
  const edges = step.nodes.flatMap(node =>
    (node.children || []).map(child => ({ from: node.id, to: child })),
  );

  return { nodes: nodeMap, positions: normalized, edges };
}

function projectToScreen(pos) {
  const persp = 1200;
  const centerX = VIEWPORT.width / 2;
  const centerY = VIEWPORT.height / 3;
  const depthScale = persp / (persp + pos.z + 1);

  return {
    x: centerX + pos.x * depthScale,
    y: centerY + pos.y * depthScale,
  };
}

function makeEdgePaths(edges, positions) {
  return edges
    .map(edge => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return null;
      const a = projectToScreen(from);
      const b = projectToScreen(to);
      return path({
        d: `M${a.x} ${a.y} L${b.x} ${b.y}`,
        class: 'edge',
      });
    })
    .filter(Boolean);
}

function makeLoopPaths(links = [], positions) {
  return links
    .map(link => {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      if (!from || !to) return null;
      const start = projectToScreen(from);
      const end = projectToScreen(to);
      const ctrlX = (start.x + end.x) / 2 + 35;
      const ctrlY = Math.min(start.y, end.y) - 80;
      return path({
        d: `M${start.x} ${start.y} Q${ctrlX} ${ctrlY} ${end.x} ${end.y}`,
        class: 'loop',
      });
    })
    .filter(Boolean);
}

function nodeElements(step, layout) {
  return step.nodes.map(node => {
    const pos = layout.positions.get(node.id);
    if (!pos) return null;
    const { x, y } = projectToScreen(pos);
    const transform = `translate3d(${x}px, ${y}px, ${pos.z}px) translate(-50%, -50%)`;
    const classes = ['node', node.kind];
    if (pos.shared) classes.push('shared');
    return div(
      {
        class: classes.join(' '),
        style: { transform },
      },
      node.label ?? node.kind,
    );
  }).filter(Boolean);
}

const visualizer = component((state = DEFAULT_STATE) => {
  const trace = state.trace?.length ? state.trace : sampleTrace;
  const stepCount = trace.length;
  const stepIndex = clamp(state.step, 0, stepCount - 1);
  const step = trace[stepIndex];
  const layout = computeLayout(step, stepIndex, state.shareStructure);
  const update = patch => visualizer({ ...state, ...patch });

  const edgePaths = makeEdgePaths(layout.edges, layout.positions);
  const loopPaths = state.showLoops
    ? makeLoopPaths(step.links, layout.positions)
    : [];

  const nodeViews = nodeElements(step, layout);

  return div(
    { class: 'app-shell' },
    h1('Basis Collapse Visualizer'),
    div(
      { class: 'notice' },
      'Step through a collapse trace, tilt the scene, and inspect structural sharing. ',
      'Toggle loop arrows to highlight binder re-entry, or enable sharing mode to watch the tree fold through reused motifs.',
    ),
    section(
      { class: 'controls' },
      label(
        'Step',
        input({
          type: 'range',
          min: 0,
          max: Math.max(0, stepCount - 1),
          value: stepIndex,
          oninput: (_elements, event) => update({ step: Number(event.target.value) }),
        }),
        span(
          { class: 'step-label' },
          `${stepIndex + 1} / ${stepCount}`,
        ),
      ),
      label(
        'Rotate',
        input({
          type: 'range',
          min: -60,
          max: 60,
          step: 1,
          value: state.rotation,
          oninput: (_elements, event) => update({ rotation: Number(event.target.value) }),
        }),
        span(`${state.rotation}°`),
      ),
    ),
    section(
      { class: 'toggles' },
      label(
        input({
          type: 'checkbox',
          class: 'toggle-input',
          checked: state.showLoops,
          onchange: () => update({ showLoops: !state.showLoops }),
        }),
        'Loop arrows',
      ),
      label(
        input({
          type: 'checkbox',
          class: 'toggle-input',
          checked: state.shareStructure,
          onchange: () => update({ shareStructure: !state.shareStructure }),
        }),
        'Share structure',
      ),
    ),
    div(
      {
        class: 'viewport',
      },
      div(
        {
          class: 'scene',
          style: {
            transform: `scale(var(--scene-scale)) rotateX(18deg) rotateY(${state.rotation}deg)`,
          },
        },
        svg(
          {
            class: 'edge-layer',
            width: VIEWPORT.width,
            height: VIEWPORT.height,
            viewBox: `0 0 ${VIEWPORT.width} ${VIEWPORT.height}`,
          },
          ...edgePaths,
        ),
        svg(
          {
            class: 'loop-layer',
            width: VIEWPORT.width,
            height: VIEWPORT.height,
            viewBox: `0 0 ${VIEWPORT.width} ${VIEWPORT.height}`,
          },
          ...loopPaths,
        ),
        div({ class: 'node-layer' }, ...nodeViews),
      ),
    ),
    div(
      { class: 'legend' },
      'Step ',
      span({ class: 'step-label' }, `#${stepIndex + 1}`),
      ' • ',
      span(step.label),
    ),
  );
});

function mount() {
  const root = document.getElementById('app') || document.body;
  document.title = 'Basis Collapse Visualizer';
  render(visualizer(), root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
