import { readFileSync } from 'node:fs';
import { addNode, cloneSubgraph, createGraph, getNode, updateNode } from './graph.js';
import { parseMany, parseSexpr } from './parser.js';
import { invariant } from '../utils.js';
import { serializeGraph } from './serializer.js';

const EMPTY_LABEL = '()';

/**
 * Load all `(def …)` / `(defn …)` forms from a file path.
 *
 * @param {string} path
 * @returns {Map<string, any>} Map of name → S-expression template
 */
export function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  const forms = parseMany(source);
  const env = new Map();
  forms.forEach(form => {
    const normalized = normalizeForm(form);
    env.set(normalized.name, normalized.body);
  });
  return env;
}

/**
 * Normalize a `(def …)` or `(defn …)` form into `{ name, body }`.
 * @param {any[]} form
 * @returns {{ name: string, body: any }}
 */
function normalizeForm(form) {
  if (!Array.isArray(form) || form.length < 3) {
    throw new Error('Each form must be (def name body)');
  }
  if (form[0] === 'def') {
    const [, name, body] = form;
    return { name, body };
  }
  if (form[0] === 'defn') {
    const [, name, params, body] = form;
    return { name, body: wrapParamsWithBinders(params, body) };
  }
  throw new Error(`Unsupported form ${form[0]}`);
}

/**
 * Wrap function parameters with empty binder pairs.
 *
 * @param {any[]} params
 * @param {any} body
 * @param {string[]} context
 * @returns {any}
 */
function wrapParamsWithBinders(params, body, context = []) {
  invariant(Array.isArray(params), 'defn params must be a list');
  if (!params.length) {
    return convertNamesToSlots(body, context);
  }
  const [first, ...rest] = params;
  const extended = [...context, first];
  return [[], wrapParamsWithBinders(rest, body, extended)];
}

/**
 * Replace named parameters with De Bruijn-style slot references.
 *
 * @param {any} expr
 * @param {string[]} context
 * @returns {any}
 */
function convertNamesToSlots(expr, context) {
  if (Array.isArray(expr)) {
    return expr.map(part => convertNamesToSlots(part, context));
  }
  if (typeof expr === 'string' && !expr.startsWith('#')) {
    const index = context.lastIndexOf(expr);
    if (index !== -1) {
      const depth = context.length - 1 - index;
      return `#${depth}`;
    }
  }
  return expr;
}

export function evaluateExpressions(expressions, env) {
  const results = expressions.map(exprSource => {
    const expr = parseSexpr(exprSource);
    return evaluateExpression(expr, env);
  });
  return results;
}

/**
 * Evaluate an expression against the provided environment.
 *
 * @param {string | any[]} expr
 * @param {Map<string, any>} env
 * @param {{ tracer?: (snapshot: object) => void }} [options]
 * @returns {{ graph: Graph, rootId: string }}
 */
export function evaluateExpression(expr, env, options = {}) {
  const tracer = options.tracer ?? null;
  const maxSteps = options.maxSteps ?? 256;
  const ast = typeof expr === 'string' ? parseSexpr(expr) : expr;
  const graph = createGraph();
  const { graph: withTree, nodeId } = buildTemplate(graph, ast, []);
  snapshotState(tracer, withTree, nodeId, 'init');

  let currentGraph = withTree;
  let currentRoot = nodeId;
  let previousSig = serializeGraph(currentGraph, currentRoot);

  // Phase 1: weak reduction (do not reduce inside lambda bodies).
  for (let i = 0; i < maxSteps; i += 1) {
    const reduced = reduceGraph(currentGraph, currentRoot, env, tracer, { reduceUnderLambdas: false });
    const signature = serializeGraph(reduced.graph, reduced.rootId);
    if (signature === previousSig) {
      currentGraph = reduced.graph;
      currentRoot = reduced.rootId;
      break;
    }
    previousSig = signature;
    currentGraph = reduced.graph;
    currentRoot = reduced.rootId;
    if (i === maxSteps - 1) {
      throw new Error(`Reduction exceeded maxSteps=${maxSteps}; expression may be non-terminating`);
    }
  }

  // Phase 2: full reduction (normalize under lambdas).
  previousSig = serializeGraph(currentGraph, currentRoot);
  for (let i = 0; i < maxSteps; i += 1) {
    const reduced = reduceGraph(currentGraph, currentRoot, env, tracer, { reduceUnderLambdas: true });
    const signature = serializeGraph(reduced.graph, reduced.rootId);
    if (signature === previousSig) {
      snapshotState(tracer, reduced.graph, reduced.rootId, 'final');
      return reduced;
    }
    previousSig = signature;
    currentGraph = reduced.graph;
    currentRoot = reduced.rootId;
  }

  throw new Error(`Normalization exceeded maxSteps=${maxSteps}; expression may be non-terminating`);
}

/**
 * Build the graph representation for an expression.
 *
 * @param {Graph} graph
 * @param {any} expr
 * @param {{ id: string }[]} stack
 * @returns {{ graph: Graph, nodeId: string }}
 */
function buildTemplate(graph, expr, stack) {
  if (expr === null || (Array.isArray(expr) && expr.length === 0)) {
    const { graph: nextGraph, id } = addNode(graph, { kind: 'empty', label: EMPTY_LABEL });
    return { graph: nextGraph, nodeId: id };
  }
  if (Array.isArray(expr)) {
    invariant(expr.length === 2, 'Pairs must have exactly two elements');
    if (Array.isArray(expr[0]) && expr[0].length === 0) {
      const binderResult = addNode(graph, {
        kind: 'binder',
        label: `λ${stack.length}`,
        valueId: null,
      });
      const binderId = binderResult.id;
      const nextStack = [...stack, { id: binderId }];
      const body = buildTemplate(binderResult.graph, expr[1], nextStack);
      const { graph: complete, id } = addNode(body.graph, {
        kind: 'pair',
        label: '·',
        children: [binderId, body.nodeId],
      });
      return { graph: complete, nodeId: id };
    }
    const left = buildTemplate(graph, expr[0], stack);
    const right = buildTemplate(left.graph, expr[1], stack);
    const { graph: complete, id } = addNode(right.graph, {
      kind: 'pair',
      label: '·',
      children: [left.nodeId, right.nodeId],
    });
    return { graph: complete, nodeId: id };
  }
  if (typeof expr === 'string' && expr.startsWith('#')) {
    const depth = Number(expr.slice(1));
    const binder = stack[stack.length - 1 - depth];
    invariant(binder, `Unbound slot reference ${expr}`);
    const { graph: nextGraph, id } = addNode(graph, {
      kind: 'slot',
      label: expr,
      binderId: binder.id,
    });
    return { graph: nextGraph, nodeId: id };
  }
  const { graph: nextGraph, id } = addNode(graph, {
    kind: 'symbol',
    label: String(expr),
  });
  return { graph: nextGraph, nodeId: id };
}

/**
 * Reduce a node by recursively evaluating its children.
 *
 * @param {Graph} graph
 * @param {string} nodeId
 * @param {Map<string, any>} env
 * @param {(snapshot: object) => void} tracer
 * @returns {{ graph: Graph, rootId: string }}
 */
function reduceGraph(graph, nodeId, env, tracer, options = {}) {
  const reduceUnderLambdas = options.reduceUnderLambdas ?? true;
  snapshotState(tracer, graph, nodeId, 'reduce');
  const node = getNode(graph, nodeId);
  if (node.kind === 'symbol' && env.has(node.label)) {
    const template = buildTemplate(graph, env.get(node.label), []);
    return reduceGraph(template.graph, template.nodeId, env, tracer, options);
  }
  if (node.kind === 'slot') {
    const binderId = node.binderId;
    if (typeof binderId !== 'string') {
      return { graph, rootId: nodeId };
    }
    const binder = getNode(graph, binderId);
    if (binder.kind !== 'binder' || !binder.valueId) {
      return { graph, rootId: nodeId };
    }
    const valueEval = reduceGraph(graph, binder.valueId, env, tracer, options);
    const nextGraph = updateNode(valueEval.graph, binderId, current => ({
      ...current,
      valueId: valueEval.rootId,
    }));
    return { graph: nextGraph, rootId: valueEval.rootId };
  }
  if (node.kind !== 'pair') {
    return { graph, rootId: nodeId };
  }
  if (!reduceUnderLambdas) {
    const leftNode = getNode(graph, node.children[0]);
    if (leftNode.kind === 'binder') {
      return { graph, rootId: nodeId };
    }
  }
  const leftEval = reduceGraph(graph, node.children[0], env, tracer, options);
  const rightEval = reduceGraph(leftEval.graph, node.children[1], env, tracer, options);
  const rewired = updateNode(rightEval.graph, node.id, current => ({
    ...current,
    children: [leftEval.rootId, rightEval.rootId],
  }));
  const application = applyIfLambda(rewired, node.id, leftEval.rootId, rightEval.rootId, tracer);
  return collapsePair(application.graph, application.rootId, tracer);
}

/**
 * Apply an argument to a binder if the candidate is a lambda.
 *
 * @param {Graph} graph
 * @param {string} parentPairId
 * @param {string} candidateId
 * @param {string} argumentId
 * @param {(snapshot: object) => void} tracer
 * @returns {{ graph: Graph, rootId: string }}
 */
function applyIfLambda(graph, parentPairId, candidateId, argumentId, tracer) {
  const candidate = getNode(graph, candidateId);
  if (candidate.kind !== 'pair') {
    return { graph, rootId: parentPairId };
  }
  const binderId = candidate.children?.[0];
  const bodyId = candidate.children?.[1];
  if (!binderId || !bodyId) {
    return { graph, rootId: parentPairId };
  }
  const binder = getNode(graph, binderId);
  if (binder.kind !== 'binder') {
    return { graph, rootId: parentPairId };
  }

  // Clone the lambda and argument so shared callees keep their original structure.
  const clonedLambda = cloneSubgraph(graph, candidateId);
  const clonedArg = cloneSubgraph(clonedLambda.graph, argumentId);
  const lambdaRoot = getNode(clonedArg.graph, clonedLambda.rootId);
  const lambdaBinderId = lambdaRoot.children?.[0];
  const lambdaBodyId = lambdaRoot.children?.[1];
  if (!lambdaBinderId || !lambdaBodyId) {
    return { graph, rootId: parentPairId };
  }
  const lambdaBinder = getNode(clonedArg.graph, lambdaBinderId);
  invariant(lambdaBinder.kind === 'binder', 'Lambda binder must be a binder node');
  const nextGraph = updateNode(clonedArg.graph, lambdaBinderId, binder => ({
    ...binder,
    valueId: clonedArg.rootId,
  }));

  snapshotState(tracer, nextGraph, lambdaBodyId, 'apply');
  return { graph: nextGraph, rootId: lambdaBodyId };
}

/**
 * Collapse a pair according to the (() x) → x rule.
 *
 * @param {Graph} graph
 * @param {string} nodeId
 * @param {(snapshot: object) => void} tracer
 * @returns {{ graph: Graph, rootId: string }}
 */
function collapsePair(graph, nodeId, tracer) {
  const node = getNode(graph, nodeId);
  if (node.kind !== 'pair') {
    return { graph, rootId: nodeId };
  }
  const leftCollapse = collapsePair(graph, node.children[0], tracer);
  const rightCollapse = collapsePair(leftCollapse.graph, node.children[1], tracer);
  const leftNode = getNode(rightCollapse.graph, leftCollapse.rootId);
  if (leftNode.kind === 'empty') {
    snapshotState(tracer, rightCollapse.graph, rightCollapse.rootId, 'collapse');
    return { graph: rightCollapse.graph, rootId: rightCollapse.rootId };
  }
  const updated = updateNode(rightCollapse.graph, nodeId, current => ({
    ...current,
    children: [leftCollapse.rootId, rightCollapse.rootId],
  }));
  snapshotState(tracer, updated, nodeId, 'collapse');
  return { graph: updated, rootId: nodeId };
}

/**
 * Emit a snapshot for visualization/debugging.
 *
 * @param {(snapshot: object) => void} tracer
 * @param {Graph} graph
 * @param {string} rootId
 * @param {string} note
 * @returns {void}
 */
function snapshotState(tracer, graph, rootId, note) {
  if (typeof tracer !== 'function') return;
  const nodes = graph.nodes.map(node => ({ ...node, children: node.children ? [...node.children] : undefined }));
  const links = [];
  nodes.forEach(node => {
    if (node.kind === 'slot') {
      if (typeof node.binderId === 'string') {
        links.push({
          id: `reentry:${node.id}`,
          kind: 'reentry',
          from: node.id,
          to: node.binderId,
        });
      }
    }
    if (node.kind === 'binder' && typeof node.valueId === 'string') {
      links.push({
        id: `value:${node.id}`,
        kind: 'value',
        from: node.id,
        to: node.valueId,
      });
    }
  });
  const treeLinks = [];
  nodes.forEach(node => {
    if (node.kind !== 'pair') return;
    if (!Array.isArray(node.children) || node.children.length !== 2) return;
    treeLinks.push({
      id: `t:${node.id}:0`,
      kind: 'child',
      from: node.id,
      to: node.children[0],
      index: 0,
    });
    treeLinks.push({
      id: `t:${node.id}:1`,
      kind: 'child',
      from: node.id,
      to: node.children[1],
      index: 1,
    });
  });
  const snapshot = {
    graph: {
      nodes,
      links,
      edges: [...treeLinks, ...links],
    },
    rootId,
    note,
  };
  tracer(snapshot);
}
