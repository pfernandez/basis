/**
 * Trace viewer (browser-only)
 * ---------------------------
 *
 * Renders snapshots emitted by `src/graph/evaluator.js` into a simple SVG+DOM view.
 * This is intentionally lightweight; it is a debugging aid, not a "real" layout.
 *
 * Snapshot format:
 * - `snapshot.graph.nodes`: nodes with `id`, `kind`, `label`, optional `children`
 * - `snapshot.graph.links`: derived non-tree edges (e.g. slot→binder, binder→value)
 * - `snapshot.note`: step label (init/apply/collapse/expand/final)
 * - `snapshot.focus`: optional redex/event metadata for inspection
 */

const button = document.getElementById('render-button');
const fetchButton = document.getElementById('fetch-button');
const slider = document.getElementById('step-slider');
const sliderLabel = document.getElementById('step-label');
const canvas = document.getElementById('graph-canvas');
const input = document.getElementById('graph-input');

let trace = [];

function normalizeData(data) {
  if (Array.isArray(data)) {
    return data.flatMap(entry => {
      if (entry && Array.isArray(entry.snapshots)) {
        return entry.snapshots.map(snapshot => ({
          ...snapshot,
          expression: entry.expression,
        }));
      }
      return [entry];
    });
  }
  return [data];
}

const example = {
  nodes: [
    { id: 'n0', kind: 'pair', label: '·', children: ['n1', 'n2'] },
    { id: 'n1', kind: 'symbol', label: 'I' },
    { id: 'n2', kind: 'symbol', label: 'x' },
  ],
  links: [],
};

input.value = JSON.stringify(example, null, 2);

fetchButton.addEventListener('click', async () => {
  try {
    const resp = await fetch('./trace.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    setTrace(data);
  } catch (err) {
    alert(`Unable to fetch trace.json (${err.message}). Paste JSON manually instead.`);
  }
});

button.addEventListener('click', () => {
  try {
    const data = JSON.parse(input.value);
    setTrace(data);
  } catch {
    alert('Invalid JSON');
  }
});

slider.addEventListener('input', event => {
  renderStep(Number(event.target.value));
});

function setTrace(data) {
  trace = normalizeData(data);
  slider.max = Math.max(0, trace.length - 1);
  renderStep(0);
}

function renderStep(index) {
  if (!trace.length) return;
  const nextIndex = Math.min(Math.max(index, 0), trace.length - 1);
  slider.value = nextIndex;
  const snapshot = trace[nextIndex];
  const note = snapshot?.note ? ` • ${snapshot.note}` : '';
  sliderLabel.textContent = `${nextIndex + 1} / ${trace.length}${note}`;
  input.value = JSON.stringify(snapshot, null, 2);
  renderGraph(trace[nextIndex]);
}

function renderGraph(snapshot) {
  canvas.innerHTML = '';
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!snapshot?.graph?.nodes) return;
  const nodes = snapshot.graph.nodes;
  const positions = new Map();

  nodes.forEach((node, i) => {
    const el = document.createElement('div');
    el.className = 'node';
    el.textContent = node.label;
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = Math.min(width, height) / 3;
    const x = width / 2 + Math.cos(angle) * radius;
    const y = height / 2 + Math.sin(angle) * radius;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    positions.set(node.id, { x, y });
    canvas.appendChild(el);
  });

  if (nodes.some(node => Array.isArray(node.children) && node.children.length)) {
    const treeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    treeSvg.classList.add('tree-layer');
    treeSvg.setAttribute('width', width);
    treeSvg.setAttribute('height', height);
    nodes.forEach(node => {
      if (!node.children) return;
      const from = positions.get(node.id);
      node.children.forEach(childId => {
        const to = positions.get(childId);
        if (!from || !to) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        path.setAttribute('class', 'tree-link');
        path.setAttribute('x1', from.x);
        path.setAttribute('y1', from.y);
        path.setAttribute('x2', to.x);
        path.setAttribute('y2', to.y);
        treeSvg.appendChild(path);
      });
    });
    canvas.appendChild(treeSvg);
  }

  if (Array.isArray(snapshot.graph.links) && snapshot.graph.links.length) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('link-layer');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    snapshot.graph.links.forEach(link => {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      if (!from || !to) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = (from.x + to.x) / 2;
      const midY = Math.min(from.y, to.y) - 40;
      path.setAttribute('class', 'link');
      path.setAttribute('d', `M${from.x} ${from.y} Q${midX} ${midY} ${to.x} ${to.y}`);
      svg.appendChild(path);
    });
    canvas.appendChild(svg);
  }
}

setTrace(example);
