import { readFileSync } from 'node:fs';
import { addLink, addNode, cloneSubgraph, createGraph, getNode, replaceSlotsWith, updateNode } from './graph.js';
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

  for (let i = 0; i < maxSteps; i += 1) {
    const reduced = reduceGraph(currentGraph, currentRoot, env, tracer);
    const signature = serializeGraph(reduced.graph, reduced.rootId);
    if (signature === previousSig) {
      snapshotState(tracer, reduced.graph, reduced.rootId, 'final');
      return reduced;
    }
    // Consider caching signatures or a structural hash if this ever shows up hot.
    previousSig = signature;
    currentGraph = reduced.graph;
    currentRoot = reduced.rootId;
  }

  throw new Error(`Reduction exceeded maxSteps=${maxSteps}; expression may be non-terminating`);
}

/**
 * Build the graph representation for an expression.
 *
 * @param {Graph} graph
 * @param {any} expr
 * @param {{ id: string, anchorKey: string }[]} stack
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
        anchorKey: '',
      });
      const binderId = binderResult.id;
      const graphWithBinder = updateNode(binderResult.graph, binderId, node => ({
        ...node,
        anchorKey: `binder:${binderId}`,
      }));
      const nextStack = [...stack, { id: binderId, anchorKey: `binder:${binderId}` }];
      const body = buildTemplate(graphWithBinder, expr[1], nextStack);
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
      aliasKey: binder.anchorKey,
    });
    const { graph: finalGraph } = addLink(nextGraph, {
      kind: 'reentry',
      from: id,
      to: binder.id,
    });
    return { graph: finalGraph, nodeId: id };
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
function reduceGraph(graph, nodeId, env, tracer) {
  snapshotState(tracer, graph, nodeId, 'reduce');
  const node = getNode(graph, nodeId);
  if (node.kind === 'symbol' && env.has(node.label)) {
    const template = buildTemplate(graph, env.get(node.label), []);
    return reduceGraph(template.graph, template.nodeId, env, tracer);
  }
  if (node.kind !== 'pair') {
    return { graph, rootId: nodeId };
  }
  let currentGraph = graph;
  const leftEval = reduceGraph(currentGraph, node.children[0], env, tracer);
  currentGraph = leftEval.graph;
  const rightEval = reduceGraph(currentGraph, node.children[1], env, tracer);
  currentGraph = rightEval.graph;
  const application = applyIfLambda(currentGraph, node.id, leftEval.rootId, rightEval.rootId, env, tracer);
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
  const lambdaBody = getNode(clonedArg.graph, lambdaBodyId);
  const lambdaNodeIds = collectSubgraphNodeIds(clonedArg.graph, clonedLambda.rootId);

  if (lambdaBody.kind === 'slot' && lambdaBody.aliasKey === lambdaBinder.anchorKey) {
    snapshotState(tracer, clonedArg.graph, clonedArg.rootId, 'apply');
    return { graph: clonedArg.graph, rootId: clonedArg.rootId };
  }
  const nextGraph = replaceSlotsWith(
    clonedArg.graph,
    lambdaBinder.anchorKey,
    clonedArg.rootId,
    lambdaNodeIds,
  );
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
  const snapshot = {
    graph: {
      nodes: graph.nodes.map(node => ({ ...node, children: node.children ? [...node.children] : undefined })),
      links: graph.links.map(link => ({ ...link })),
    },
    rootId,
    note,
  };
  tracer(snapshot);
}

/**
 * Collect the IDs of all nodes reachable from a root by following pair children.
 *
 * @param {Graph} graph
 * @param {string} rootId
 * @returns {Set<string>}
 */
function collectSubgraphNodeIds(graph, rootId) {
  const seen = new Set();
  const stack = [rootId];
  while (stack.length) {
    const next = stack.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    const node = getNode(graph, next);
    (node.children ?? []).forEach(childId => stack.push(childId));
  }
  return seen;
}
