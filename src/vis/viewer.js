const button = document.getElementById('render-button');
const canvas = document.getElementById('graph-canvas');
const input = document.getElementById('graph-input');

const example = {
  nodes: [
    { id: 'n0', kind: 'pair', label: '·', children: ['n1', 'n2'] },
    { id: 'n1', kind: 'symbol', label: 'I' },
    { id: 'n2', kind: 'symbol', label: 'x' },
  ],
  links: [],
};

input.value = JSON.stringify(example, null, 2);

button.addEventListener('click', () => {
  try {
    const graph = JSON.parse(input.value);
    renderGraph(graph);
  } catch {
    alert('Invalid JSON');
  }
});

function renderGraph(graph) {
  canvas.innerHTML = '';
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  graph.nodes.forEach((node, index) => {
    const el = document.createElement('div');
    el.className = 'node';
    el.textContent = `${node.label} (${node.kind})`;
    const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
    const x = width / 2 + Math.cos(angle) * (width / 3);
    const y = height / 2 + Math.sin(angle) * (height / 3);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    canvas.appendChild(el);
  });
}

renderGraph(example);
