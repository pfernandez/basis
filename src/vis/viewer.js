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
  renderGraph(trace[nextIndex]);
}

function renderGraph(snapshot) {
  canvas.innerHTML = '';
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!snapshot?.graph?.nodes) return;
  const nodes = snapshot.graph.nodes;
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
    canvas.appendChild(el);
  });
}

setTrace(example);
