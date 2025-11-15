#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Minimal SK interpreter that rewrites the tree using an id lookup table.
// Every literal `()` in the source becomes an entry in the lookup. The tree
// itself only stores numeric ids; all information about whether an empty node is
// a binder head, a slot that should re-enter a binder, or just plain void lives
// in that table. This keeps the runtime structure small and makes it easy to
// inspect the relationships explicitly.

function makePair(left, right) {
  return { kind: 'pair', left, right };
}

function makeSymbol(name) {
  return { kind: 'symbol', name };
}

function makeEmpty(id) {
  return { kind: 'empty', id };
}

function createLookupStore() {
  return { empties: new Map() };
}

function createTemplateState() {
  return {
    nextEmptyId: 1,
    nextBinderId: 1,
    stack: [],
    lookup: createLookupStore(),
  };
}

function registerEmpty(state, role, binderId = null) {
  const id = state.nextEmptyId++;
  state.lookup.empties.set(id, { role, binderId });
  return makeEmpty(id);
}

function buildTemplate(expr, state = createTemplateState()) {
  if (expr === null || expr === undefined) return registerEmpty(state, 'void');
  if (Array.isArray(expr)) {
    if (expr.length === 0) {
      return registerEmpty(state, 'void');
    }
    if (expr.length !== 2) {
      throw new Error('Pairs must have exactly two elements');
    }
    const [leftExpr, rightExpr] = expr;
    if (Array.isArray(leftExpr) && leftExpr.length === 0) {
      const binderId = state.nextBinderId++;
      const binderNode = registerEmpty(state, 'binder', binderId);
      state.stack.push(binderId);
      const body = buildTemplate(rightExpr, state);
      state.stack.pop();
      return makePair(binderNode, body);
    }
    const left = buildTemplate(leftExpr, state);
    const right = buildTemplate(rightExpr, state);
    return makePair(left, right);
  }
  if (typeof expr === 'string' && expr.startsWith('#')) {
    const depth = Number(expr.slice(1));
    if (!Number.isInteger(depth)) {
      throw new Error(`Invalid binder reference ${expr}`);
    }
    const index = state.stack.length - 1 - depth;
    if (index < 0) {
      throw new Error(`Binder reference ${expr} exceeds scope`);
    }
    const binderId = state.stack[index];
    return registerEmpty(state, 'slot', binderId);
  }
  return makeSymbol(expr);
}

function cloneFromTemplate(node, templateLookup, runtimeStore, binderMap = new Map()) {
  if (!node) return null;
  if (node.kind === 'symbol') return makeSymbol(node.name);
  if (node.kind === 'pair') {
    return makePair(
      cloneFromTemplate(node.left, templateLookup, runtimeStore, binderMap),
      cloneFromTemplate(node.right, templateLookup, runtimeStore, binderMap),
    );
  }
  if (node.kind === 'empty') {
    const meta = templateLookup.empties.get(node.id) ?? { role: 'void', binderId: null };
    const newId = runtimeStore.nextEmptyId++;
    let binderId = meta.binderId;
    const clonedMeta = { role: meta.role, binderId: null };
    if (meta.role === 'binder') {
      const newBinderId = runtimeStore.nextBinderId++;
      binderMap.set(binderId, newBinderId);
      clonedMeta.binderId = newBinderId;
    } else if (meta.role === 'slot') {
      const mapped = binderMap.get(binderId);
      if (mapped === undefined) {
        throw new Error('Encountered slot before binder while cloning template');
      }
      clonedMeta.binderId = mapped;
    } else {
      clonedMeta.binderId = null;
    }
    runtimeStore.empties.set(newId, clonedMeta);
    return makeEmpty(newId);
  }
  return node;
}

function cloneRuntimeNode(node, runtimeStore, binderMap = new Map()) {
  if (!node) return null;
  if (node.kind === 'symbol') return makeSymbol(node.name);
  if (node.kind === 'pair') {
    return makePair(
      cloneRuntimeNode(node.left, runtimeStore, binderMap),
      cloneRuntimeNode(node.right, runtimeStore, binderMap),
    );
  }
  if (node.kind === 'empty') {
    const meta = runtimeStore.empties.get(node.id) ?? { role: 'void', binderId: null };
    const newId = runtimeStore.nextEmptyId++;
    const clonedMeta = { role: meta.role, binderId: null };
    if (meta.role === 'binder') {
      const newBinderId = runtimeStore.nextBinderId++;
      binderMap.set(meta.binderId, newBinderId);
      clonedMeta.binderId = newBinderId;
    } else if (meta.role === 'slot' && meta.binderId !== null) {
      const mapped = binderMap.get(meta.binderId);
      if (mapped === undefined) {
        throw new Error('Encountered slot before binder while cloning runtime node');
      }
      clonedMeta.binderId = mapped;
    }
    runtimeStore.empties.set(newId, clonedMeta);
    return makeEmpty(newId);
  }
  return node;
}

function createRuntimeStore() {
  return {
    empties: new Map(),
    nextEmptyId: 1,
    nextBinderId: 1,
  };
}

function isEmptyNode(node, store) {
  if (!node) return true;
  if (node.kind !== 'empty') return false;
  const meta = store.empties.get(node.id);
  return meta?.role === 'void';
}

function traceCollapseEvent(store, options, path, left, right, didCollapse) {
  if (!options?.traceCollapse && !options?.traceGraphviz) return null;
  const traceState = options.__trace ?? (options.__trace = { collapse: 0 });
  traceState.collapse += 1;
  if (options.traceCollapse) {
    const logger = options.logger ?? console.log;
    const before = `(${treeToString(left, store)} ${treeToString(right, store)})`;
    const after = didCollapse
      ? treeToString(right, store)
      : `(${treeToString(left, store)} ${treeToString(right, store)})`;
    const leftMeta = (left && left.kind === 'empty') ? store.empties.get(left.id) : null;
    const metaNote = leftMeta
      ? ` left-meta=${leftMeta.role}${leftMeta.binderId !== null ? `#${leftMeta.binderId}` : ''}`
      : '';
    const status = didCollapse ? 'applied' : 'skipped';
    logger(`[collapse #${traceState.collapse}] path ${path} ${status}${metaNote}\n  before: ${before}\n  after : ${after}`);
  }
  return traceState.collapse;
}

function collapse(node, store, options = {}, path = '•') {
  if (!node) return null;
  if (node.kind === 'pair') {
    const left = collapse(node.left, store, options, `${path}L`);
    const right = collapse(node.right, store, options, `${path}R`);
    const shouldCollapse = isEmptyNode(left, store);
    const newSubtree = shouldCollapse ? right : makePair(left, right);
    if (options.traceCollapse || options.traceGraphviz) {
      const baseRoot = options.__traceRoot ?? node;
      options.__traceRoot = replaceSubtree(baseRoot, path, newSubtree);
    }
    const step = traceCollapseEvent(store, options, path, left, right, shouldCollapse);
    if (options.traceGraphviz && step !== null) {
      emitGraphvizSnapshot(options.__traceRoot ?? newSubtree, store, options, {
        step,
        path,
        didCollapse: shouldCollapse,
      });
    }
    return newSubtree;
  }
  return node;
}

function findNextBinder(node, store) {
  if (!node) return null;
  if (node.kind === 'pair') {
    if (node.left && node.left.kind === 'empty') {
      const meta = store.empties.get(node.left.id);
      if (meta && meta.role === 'binder') {
        return meta.binderId;
      }
    }
    const leftSearch = findNextBinder(node.left, store);
    if (leftSearch !== null) return leftSearch;
    return findNextBinder(node.right, store);
  }
  return null;
}

function replaceSubtree(root, path, newSubtree) {
  if (!root) return newSubtree;
  if (!path || path === '•') return newSubtree;
  const directions = path.slice(1).split('');
  return replaceSubtreeRecursive(root, directions, 0, newSubtree);
}

function replaceSubtreeRecursive(node, directions, index, newSubtree) {
  if (index === directions.length) {
    return newSubtree;
  }
  if (!node || node.kind !== 'pair') {
    return node;
  }
  const dir = directions[index];
  if (dir === 'L') {
    const next = replaceSubtreeRecursive(node.left, directions, index + 1, newSubtree);
    if (next === node.left) return node;
    return makePair(next, node.right);
  }
  const next = replaceSubtreeRecursive(node.right, directions, index + 1, newSubtree);
  if (next === node.right) return node;
  return makePair(node.left, next);
}

function getNodeAtPath(root, path) {
  if (!root) return null;
  if (!path || path === '•') return root;
  let node = root;
  for (const dir of path.slice(1)) {
    if (!node || node.kind !== 'pair') return null;
    node = dir === 'L' ? node.left : node.right;
  }
  return node;
}

function ensureGraphvizDir(options) {
  if (options.__graphvizDir) return options.__graphvizDir;
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = options.traceGraphvizDir ?? `graphviz-trace-${suffix}`;
  mkdirSync(dir, { recursive: true });
  options.__graphvizDir = dir;
  return dir;
}

function escapeDotLabel(label) {
  return String(label)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function renderGraphviz(root, store, options = {}) {
  if (!root) {
    return 'digraph Evaluation {\n  label="(empty)";\n}\n';
  }
  const mode = options.mode === 'share' ? 'share' : 'loops';
  const highlightNode = options.highlightNode ?? null;
  const label = options.graphLabel ? escapeDotLabel(options.graphLabel) : null;
  const nullSentinel = { kind: '__trace_void__' };
  const nodeDefs = new Map();
  const nodeIds = new Map();
  const binderNodeIds = new Map();
  const edges = [];
  let nextId = 1;

  function registerNode(id, config) {
    const existing = nodeDefs.get(id) ?? { attrs: {} };
    if (config.label !== undefined) existing.label = config.label;
    if (config.attrs) {
      existing.attrs = { ...existing.attrs, ...config.attrs };
    }
    nodeDefs.set(id, existing);
  }

  function applyHighlight(id, node) {
    if (node && node === highlightNode) {
      const existing = nodeDefs.get(id) ?? { attrs: {} };
      existing.attrs = { ...existing.attrs, color: '#dd3333', penwidth: 2 };
      nodeDefs.set(id, existing);
    }
  }

  function ensurePairNode(node) {
    let id = nodeIds.get(node);
    if (!id) {
      id = `n${nextId++}`;
      nodeIds.set(node, id);
      registerNode(id, {
        label: 'pair',
        attrs: { shape: 'ellipse', style: 'filled', fillcolor: '#eeeeff' },
      });
    }
    applyHighlight(id, node);
    return id;
  }

  function ensureSymbolNode(node) {
    let id = nodeIds.get(node);
    if (!id) {
      id = `n${nextId++}`;
      nodeIds.set(node, id);
      registerNode(id, {
        label: node.name,
        attrs: { shape: 'plaintext' },
      });
    }
    applyHighlight(id, node);
    return id;
  }

  function ensureVoidNode(node) {
    let id = nodeIds.get(node);
    if (!id) {
      id = `n${nextId++}`;
      nodeIds.set(node, id);
      registerNode(id, {
        label: '()',
        attrs: { shape: 'point' },
      });
    }
    applyHighlight(id, node);
    return id;
  }

  function ensureBinderNode(node, binderId) {
    let id = binderNodeIds.get(binderId);
    if (!id) {
      id = `n${nextId++}`;
      binderNodeIds.set(binderId, id);
      registerNode(id, {
        label: `binder#${binderId}`,
        attrs: { shape: 'circle', style: 'filled', fillcolor: '#ddffee' },
      });
    }
    if (node) nodeIds.set(node, id);
    applyHighlight(id, node);
    return id;
  }

  function ensureSlotNode(node, meta) {
    let id = nodeIds.get(node);
    if (!id) {
      id = `n${nextId++}`;
      nodeIds.set(node, id);
      const labelText = meta.binderId !== null ? `slot→${meta.binderId}` : 'slot';
      registerNode(id, {
        label: labelText,
        attrs: { shape: 'diamond', style: 'rounded' },
      });
    }
    applyHighlight(id, node);
    const extraEdges = [];
    if (meta.binderId !== null) {
      const binderTarget = ensureBinderNode(null, meta.binderId);
      extraEdges.push(`${id} -> ${binderTarget} [style=dashed,color="#888888",label="re-enter"];`);
    }
    return { id, extraEdges };
  }

  function addEdge(from, to, edgeLabel) {
    if (!from || !to) return;
    const parts = [];
    if (edgeLabel) parts.push(`label="${escapeDotLabel(edgeLabel)}"`);
    edges.push(`${from} -> ${to}${parts.length ? ` [${parts.join(', ')}]` : ''};`);
  }

  function walk(node, parentId, edgeLabel) {
    if (!node) {
      const id = ensureVoidNode(nullSentinel);
      addEdge(parentId, id, edgeLabel);
      return;
    }

    if (node.kind === 'empty') {
      const meta = store.empties.get(node.id);
      if (mode === 'share' && meta?.role === 'slot' && meta.binderId !== null) {
        const binderVis = ensureBinderNode(null, meta.binderId);
        addEdge(parentId, binderVis, `${edgeLabel} slot`);
        return;
      }
    }

    let visualId = null;
    let extraEdges = [];
    if (node.kind === 'pair') {
      visualId = ensurePairNode(node);
    } else if (node.kind === 'symbol') {
      visualId = ensureSymbolNode(node);
    } else if (node.kind === 'empty') {
      const meta = store.empties.get(node.id);
      if (meta?.role === 'binder') {
        visualId = ensureBinderNode(node, meta.binderId);
      } else if (meta?.role === 'slot') {
        ({ id: visualId, extraEdges } = ensureSlotNode(node, meta));
      } else {
        visualId = ensureVoidNode(node);
      }
    } else {
      visualId = ensureVoidNode(node);
    }

    if (parentId) {
      addEdge(parentId, visualId, edgeLabel);
    }
    extraEdges.forEach(edgeLine => edges.push(edgeLine));

    if (node.kind === 'pair') {
      walk(node.left, visualId, 'L');
      walk(node.right, visualId, 'R');
    }
  }

  walk(root, null, '');

  const lines = [
    'digraph Evaluation {',
    '  rankdir=LR;',
    '  splines=true;',
    '  node [fontname="monospace"];',
    '  edge [fontname="monospace"];',
  ];
  if (label) {
    lines.push(`  labelloc="t";`);
    lines.push(`  label="${label}";`);
  }
  for (const [id, def] of nodeDefs.entries()) {
    const attrParts = [];
    const nodeLabel = def.label !== undefined ? def.label : id;
    attrParts.push(`label="${escapeDotLabel(nodeLabel)}"`);
    for (const [attr, value] of Object.entries(def.attrs)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string') {
        attrParts.push(`${attr}="${escapeDotLabel(value)}"`);
      } else {
        attrParts.push(`${attr}=${value}`);
      }
    }
    lines.push(`  ${id} [${attrParts.join(', ')}];`);
  }
  edges.forEach(edgeLine => {
    lines.push(`  ${edgeLine}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function emitGraphvizSnapshot(root, store, options, info) {
  if (!options.traceGraphviz || !root) return;
  const dir = ensureGraphvizDir(options);
  const mode = options.traceGraphvizMode ?? 'loops';
  const highlightNode = getNodeAtPath(root, info.path);
  const label = `step ${String(info.step).padStart(4, '0')} :: ${info.path} ${info.didCollapse ? 'applied' : 'skipped'}`;
  const dot = renderGraphviz(root, store, {
    mode,
    highlightNode,
    graphLabel: label,
  });
  const filename = join(dir, `step-${String(info.step).padStart(4, '0')}.dot`);
  writeFileSync(filename, dot, 'utf8');
}

function substituteBinder(node, binderId, argument, store) {
  if (!node) return null;
  if (node.kind === 'empty') {
    const meta = store.empties.get(node.id);
    if (meta && meta.role === 'slot' && meta.binderId === binderId) {
      return cloneRuntimeNode(argument, store);
    }
    return node;
  }
  if (node.kind === 'pair') {
    if (node.left && node.left.kind === 'empty') {
      const meta = store.empties.get(node.left.id);
      if (meta && meta.role === 'binder' && meta.binderId === binderId) {
        return substituteBinder(node.right, binderId, argument, store);
      }
    }
    return makePair(
      substituteBinder(node.left, binderId, argument, store),
      substituteBinder(node.right, binderId, argument, store),
    );
  }
  if (node.kind === 'symbol') return makeSymbol(node.name);
  return node;
}

function applyNode(opTree, argTree, store) {
  const binderId = findNextBinder(opTree, store);
  if (binderId === null) {
    return makePair(opTree, argTree);
  }
  return substituteBinder(opTree, binderId, argTree, store);
}

function resolveSymbol(node, env, store) {
  if (!node || node.kind !== 'symbol') return node;
  if (!env.has(node.name)) return makeSymbol(node.name);
  const template = env.get(node.name);
  return cloneFromTemplate(template.tree, template.lookup, store);
}

function isBinderPair(node, store) {
  if (!node || node.kind !== 'pair') return false;
  if (!node.left || node.left.kind !== 'empty') return false;
  const meta = store.empties.get(node.left.id);
  return meta?.role === 'binder';
}

function evaluate(node, env, store, options = {}) {
  if (!node) return null;
  if (node.kind === 'symbol') {
    return resolveSymbol(node, env, store);
  }
  if (node.kind === 'pair') {
    if (isBinderPair(node, store)) {
      return node;
    }
    const op = evaluate(node.left, env, store, options);
    const arg = evaluate(node.right, env, store, options);
    const applied = applyNode(op, arg, store);
    if (options.traceCollapse || options.traceGraphviz) {
      options.__traceRoot = applied;
    }
    const collapsed = collapse(applied, store, options);
    if (options.traceGraphviz) {
      const performedSteps = options.__trace?.collapse ?? 0;
      if (performedSteps === 0) {
        emitGraphvizSnapshot(collapsed, store, options, {
          step: 0,
          path: '•',
          didCollapse: false,
        });
      }
    }
    if (options.traceCollapse || options.traceGraphviz) {
      options.__traceRoot = collapsed;
    }
    return collapsed;
  }
  return node;
}

function tokenize(source) {
  const stripped = source.replace(/;.*$/gm, '');
  return stripped.match(/[()]|[^\s()]+/g) ?? [];
}

function parseTokens(tokens) {
  if (!tokens.length) throw new Error('Unexpected EOF');
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')' && tokens.length) {
      list.push(parseTokens(tokens));
    }
    if (tokens.shift() !== ')') throw new Error('Missing )');
    return list;
  }
  if (token === ')') throw new Error('Unexpected )');
  return token;
}

function parseSexpr(source) {
  const tokens = tokenize(source);
  if (!tokens.length) return null;
  const expr = parseTokens(tokens);
  if (tokens.length) throw new Error('Extra tokens');
  return expr;
}

function convertExprToDeBruijn(expr, context) {
  if (expr === null || expr === undefined) return expr;
  if (Array.isArray(expr)) {
    return expr.map(part => convertExprToDeBruijn(part, context));
  }
  if (typeof expr === 'string') {
    if (expr.startsWith('#')) return expr;
    const index = context.lastIndexOf(expr);
    if (index !== -1) {
      const depth = context.length - 1 - index;
      return `#${depth}`;
    }
  }
  return expr;
}

function wrapParamsWithBinders(params, bodyExpr, context = []) {
  if (!params.length) {
    return convertExprToDeBruijn(bodyExpr, context);
  }
  const [first, ...rest] = params;
  if (typeof first !== 'string') {
    throw new Error('Parameter names must be symbols');
  }
  const nextContext = [...context, first];
  const inner = wrapParamsWithBinders(rest, bodyExpr, nextContext);
  return [[], inner];
}

function desugarDefnForm(form) {
  if (form.length !== 4) {
    throw new Error('(defn name (params) body) requires four elements');
  }
  const [, name, paramsExpr, bodyExpr] = form;
  if (!Array.isArray(paramsExpr)) {
    throw new Error('Function parameters must be a list');
  }
  const lambdaExpr = wrapParamsWithBinders(paramsExpr, bodyExpr, []);
  return ['def', name, lambdaExpr];
}

function buildTemplateFromExpr(expr) {
  const state = createTemplateState();
  const tree = buildTemplate(expr, state);
  return { tree, lookup: state.lookup };
}

function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  const tokens = tokenize(source);
  const env = new Map();
  while (tokens.length) {
    let form = parseTokens(tokens);
    if (Array.isArray(form) && form[0] === 'defn') {
      form = desugarDefnForm(form);
    }
    if (!Array.isArray(form) || form[0] !== 'def' || form.length !== 3) {
      throw new Error('Expected (def name body)');
    }
    const [, name, bodyExpr] = form;
    const template = buildTemplateFromExpr(bodyExpr);
    env.set(name, template);
  }
  return env;
}

function treeToString(node, store) {
  if (!node) return '()';
  if (node.kind === 'symbol') return node.name;
  if (node.kind === 'pair') {
    return `(${treeToString(node.left, store)} ${treeToString(node.right, store)})`;
  }
  if (node.kind === 'empty') {
    const meta = store.empties.get(node.id);
    if (!meta || meta.role === 'void') return '()';
    if (meta.role === 'binder') return `⟨binder#${meta.binderId}⟩`;
    if (meta.role === 'slot') return `⟨slot→${meta.binderId}⟩`;
  }
  return '()';
}

function formatLookup(store) {
  const rows = [];
  for (const [id, meta] of store.empties.entries()) {
    rows.push({ id, ...meta });
  }
  rows.sort((a, b) => a.id - b.id);
  return rows.map(row => {
    if (row.role === 'binder') return `empty#${row.id}: binder ${row.binderId}`;
    if (row.role === 'slot') return `empty#${row.id}: slot -> binder ${row.binderId}`;
    return `empty#${row.id}: void`;
  }).join('\n');
}

function runExpression(exprSource, env, options = {}) {
  const parsed = parseSexpr(exprSource);
  const template = buildTemplateFromExpr(parsed);
  const store = createRuntimeStore();
  const instantiated = cloneFromTemplate(template.tree, template.lookup, store);
  const result = evaluate(instantiated, env, store, options);
  return { result, store };
}

function runCli() {
  const args = process.argv.slice(2);
  const positionals = [];
  let showLookup = false;
  let traceCollapse = false;
  let traceGraphviz = false;
  let traceGraphvizMode = 'loops';
  let traceGraphvizDir = null;

  args.forEach((arg) => {
    if (arg === '--show-lookup') {
      showLookup = true;
      return;
    }
    if (arg === '--trace-collapse') {
      traceCollapse = true;
      return;
    }
    if (arg.startsWith('--trace-graphviz=')) {
      traceGraphviz = true;
      const value = arg.slice('--trace-graphviz='.length).toLowerCase();
      if (value === 'share' || value === 'merge') {
        traceGraphvizMode = 'share';
      } else {
        traceGraphvizMode = 'loops';
      }
      return;
    }
    if (arg === '--trace-graphviz') {
      traceGraphviz = true;
      return;
    }
    if (arg.startsWith('--trace-graphviz-dir=')) {
      traceGraphvizDir = arg.slice('--trace-graphviz-dir='.length);
      traceGraphviz = true;
      return;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      return;
    }
  });

  const expr = positionals[0] ?? '(((S a) b) c)';
  const defsPath = fileURLToPath(new URL('../programs/sk-basis.lisp', import.meta.url));
  const env = loadDefinitions(defsPath);
  const evalOptions = {
    traceCollapse,
    traceGraphviz,
    traceGraphvizMode,
    traceGraphvizDir,
  };
  const { result, store } = runExpression(expr, env, evalOptions);
  console.log('Input :', expr);
  console.log('Output:', treeToString(result, store));
  if (showLookup) {
    console.log('\nLookup table:');
    console.log(formatLookup(store));
  }
  if (traceGraphviz && evalOptions.__graphvizDir) {
    console.log(`Graphviz trace steps written to ${evalOptions.__graphvizDir}`);
    console.log('Run: dot -Tsvg <file.dot> -o <file.svg> to visualize a step.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}

export {
  buildTemplateFromExpr,
  cloneFromTemplate,
  createRuntimeStore,
  evaluate,
  formatLookup,
  loadDefinitions,
  parseSexpr,
  runExpression,
  treeToString,
};
