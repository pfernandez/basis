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

const COLORS = Object.freeze({
  pair: '#2D0A5B', // deep purple
  binder: '#FF2DAA', // hot pink
  slot: '#B5179E', // purple/pink
  symbol: '#3F37C9', // violet-blue
  empty: '#BDBDBD', // neutral
  focus: '#111111', // black highlight
  childLink: 'rgba(0, 0, 0, 0.12)',
  reentryLink: '#FF2DAA',
  valueLink: '#2D0A5B',
  expandLink: '#3F37C9',
});

const elements = {
  graph: document.getElementById('graph'),
  loadTrace: document.getElementById('load-trace'),
  playPause: document.getElementById('play-pause'),
  step: document.getElementById('step'),
  stepLabel: document.getElementById('step-label'),
  noteLabel: document.getElementById('note-label'),
  file: document.getElementById('file'),
  focus: document.getElementById('focus'),
};

let trace = [];
let playing = false;
let playTimer = null;

// Keep stable object identities across snapshot updates so node positions
// don't "jump" between steps.
const nodeCache = new Map(); // id -> node object (mutated by the engine)
const linkCache = new Map(); // id -> link object

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

function colorForLink(link) {
  switch (link.kind) {
    case 'child':
      return COLORS.childLink;
    case 'reentry':
      return COLORS.reentryLink;
    case 'value':
      return COLORS.valueLink;
    default:
      return COLORS.expandLink;
  }
}

function arrowLengthForLink(link) {
  if (link.kind === 'child') return 0;
  return 4;
}

function widthForLink(link) {
  if (link.__focus) return 3;
  if (link.kind === 'child') return 1;
  return 2;
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
  const existing = linkCache.get(id);
  if (existing) {
    Object.assign(existing, raw, { id });
    return existing;
  }
  const link = { ...raw, id };
  linkCache.set(id, link);
  return link;
}

function clearFocusFlags() {
  nodeCache.forEach(node => {
    node.__focus = false;
  });
  linkCache.forEach(link => {
    link.__focus = false;
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

function snapshotToGraphData(snapshot) {
  const graph = snapshot?.graph ?? snapshot;
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error('Trace must contain snapshots with { graph: { nodes, links } }');
  }
  const nodes = graph.nodes.map(internNode);
  const edges = ensureEdges({ ...graph, nodes });
  const links = edges.map(internLink);
  return { nodes, links };
}

function setTrace(nextTrace) {
  trace = nextTrace;
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
  const graphData = snapshotToGraphData(snapshot);
  const focused = focusIdsFromSnapshot(snapshot);
  focused.forEach(id => {
    const node = nodeCache.get(id);
    if (node) node.__focus = true;
  });
  graphData.links.forEach(link => {
    if (focused.has(link.from) || focused.has(link.to)) link.__focus = true;
  });

  Graph.graphData(graphData);
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
  const delayMs = 900;
  playTimer = setInterval(() => {
    const next = Number(elements.step.value) + 1;
    if (next >= trace.length) {
      stopPlaying();
      return;
    }
    renderStep(next);
  }, delayMs);
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
}

const Graph = ForceGraph3D({
  controlType: 'orbit',
})(elements.graph)
  .backgroundColor('#ffffff')
  .nodeId('id')
  .nodeColor(colorForNode)
  .nodeVal(sizeForNode)
  .nodeLabel(node => {
    const parts = [`${node.kind}: ${node.label}`, node.id];
    if (node.kind === 'slot' && typeof node.binderId === 'string') parts.push(`binderId=${node.binderId}`);
    if (node.kind === 'binder' && typeof node.valueId === 'string') parts.push(`valueId=${node.valueId}`);
    return parts.join('<br>');
  })
  .linkSource('from')
  .linkTarget('to')
  .linkColor(colorForLink)
  .linkWidth(widthForLink)
  .linkDirectionalArrowLength(arrowLengthForLink)
  .linkDirectionalArrowColor(colorForLink)
  .linkDirectionalArrowRelPos(1)
  .linkOpacity(0.85)
  .onNodeClick(node => {
    // Smoothly aim the camera at clicked nodes for inspection.
    const distance = 140;
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    Graph.cameraPosition(
      { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
      node,
      600,
    );
  });

setupEvents();
loadDefaultTrace();

