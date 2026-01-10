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
  pair: '#000000', // base (structure)
  binder: '#FF2DAA', // hot pink
  slot: '#2D0A5B', // deep purple
  symbol: '#111111', // black-ish
  empty: '#BDBDBD', // neutral
  focus: '#FF2DAA', // highlight
  childLink: 'rgba(0, 0, 0, 0.38)',
  reentryLink: '#FF2DAA',
  valueLink: '#2D0A5B',
  expandLink: 'rgba(0, 0, 0, 0.55)',
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
  file: document.getElementById('file'),
  focus: document.getElementById('focus'),
};

let trace = [];
let playing = false;
let playTimer = null;

// Keep stable object identities across snapshot updates so node positions
// don't "jump" between steps.
const nodeCache = new Map(); // id -> node object (mutated by the engine)

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

function computeSlotIndexLabels(rootId, nodeById) {
  const labels = new Map(); // slotId -> "#n"
  if (typeof rootId !== 'string') return labels;

  const seen = new Set();
  function walk(nodeId, binderStack) {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) return;

    if (node.kind === 'pair' && Array.isArray(node.children) && node.children.length === 2) {
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
      return link.__folded ? 'rgba(0, 0, 0, 0.78)' : COLORS.childLink;
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
  return 6;
}

function widthForLink(link) {
  if (link.__focus) return 4;
  if (link.kind === 'child') return link.__folded ? 2.4 : 1.6;
  return 2.6;
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
    if (!binder || binder.kind !== 'binder' || typeof binder.valueId !== 'string') return currentId;
    currentId = binder.valueId;
  }
  return currentId;
}

function snapshotToGraphData(snapshot) {
  const graph = snapshot?.graph ?? snapshot;
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error('Trace must contain snapshots with { graph: { nodes, links } }');
  }
  const nodes = graph.nodes.map(internNode);

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const slotLabels = computeSlotIndexLabels(snapshot?.rootId ?? graph.rootId, nodeById);
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
      const binder = typeof node.binderId === 'string' ? nodeById.get(node.binderId) : null;
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

  const view = {
    showTree: elements.showTree?.checked ?? true,
    showPointers: elements.showPointers?.checked ?? true,
    foldSlots: elements.foldSlots?.checked ?? false,
  };

  const edges = baseEdges
    .filter(edge => {
      if (edge.kind === 'child') return view.showTree;
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

  [elements.showTree, elements.showPointers, elements.foldSlots].forEach(control => {
    if (!control) return;
    control.addEventListener('change', () => {
      stopPlaying();
      renderStep(Number(elements.step.value));
    });
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
  .linkColor(colorForLink)
  .linkWidth(widthForLink)
  .linkDirectionalArrowLength(arrowLengthForLink)
  .linkDirectionalArrowColor(colorForLink)
  .linkDirectionalArrowRelPos(1)
  .linkOpacity(1)
  .onNodeClick(node => {
    // Smoothly aim the camera at clicked nodes for inspection.
    const distance = 140;
    const distRatio = 
      1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    Graph.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio
      },
      node,
      600);
  });

setupEvents();
loadDefaultTrace();
