/**
 * Graph evaluator (reference implementation)
 * -----------------------------------------
 *
 * This module is a deliberately small, inspectable reducer for a "pairs + pointers"
 * term graph. It exists to make the operational story easy to audit and visualize.
 *
 * Core ideas:
 * - The substrate `s` is a persistent store of nodes connected by pointers.
 * - Binding is *not* substitution. Each lambda has a dedicated binder node; all
 *   occurrences (slots) point to that binder. Application is a single local update
 *   `binder.valueId = argumentRoot`.
 * - Collapse is the purely structural local rewrite: `(() x) → x` (implemented by
 *   bypassing a pair whose left child is `empty`).
 *
 * Everything else is "observer / lens" machinery:
 * - A deterministic schedule chooses which local event to perform next
 *   (leftmost-outermost / normal-order).
 * - Optional cloning toggles control sharing for the reference implementation.
 * - Parsing, def/defn desugaring, and tracing are conveniences, not substrate rules.
 */

import { readFileSync } from 'node:fs';
import { addNode, cloneSubgraph, createGraph, getNode, updateNode } from './graph.js';
import { parseMany, parseSexpr } from './parser.js';
import { invariant } from '../utils.js';

const EMPTY_LABEL = '()';

/**
 * ---------------------------------------------------------------------------
 * Types (JSDoc)
 * ---------------------------------------------------------------------------
 */

/**
 * A path frame describes how to replace a focused subterm while preserving
 * structural sharing. Frames are produced by the observer (redex chooser).
 *
 * @typedef {{ kind: 'pair', parentId: string, index: 0 | 1 }} PairFrame
 * @typedef {{ kind: 'binder-value', binderId: string }} BinderValueFrame
 * @typedef {PairFrame | BinderValueFrame} PathFrame
 */

/**
 * The observer `o` (lens) is an explicit traversal state: a pointer stack of
 * "where to look next" work items. This makes evaluation closer to an explicit
 * `(o, s)` machine state, rather than a reducer that secretly re-scans the term.
 *
 * The current strategy is deliberately simple and deterministic: the observer is
 * reset to the root after every rewrite ("fall back to the origin"), so the
 * semantics match the previous global scan.
 *
 * @typedef {{ nodeId: string, path: PathFrame[], seenBinders: Set<string> }} WorkItem
 * @typedef {{ rootId: string, stack: WorkItem[] }} Observer
 */

/**
 * A single locally-enabled event selected by the observer.
 *
 * Notes:
 * - `expand` is convenience-only: it inlines a named symbol from `env`.
 * - `apply` performs one binder update and replaces the application with the body.
 * - `collapse` performs the structural `(() x) → x` bypass.
 *
 * @typedef {{ kind: 'expand', nodeId: string, name: string, path: PathFrame[] }} ExpandEvent
 * @typedef {{ kind: 'apply', nodeId: string, lambdaId: string, argId: string, path: PathFrame[] }} ApplyEvent
 * @typedef {{ kind: 'collapse', nodeId: string, replacementId: string, path: PathFrame[] }} CollapseEvent
 * @typedef {ExpandEvent | ApplyEvent | CollapseEvent} Event
 */

/**
 * ---------------------------------------------------------------------------
 * Public API: definition loading + evaluation
 * ---------------------------------------------------------------------------
 */

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
    const normalized = normalizeDefinitionForm(form);
    env.set(normalized.name, normalized.body);
  });
  return env;
}

/**
 * Normalize a `(def …)` or `(defn …)` form into `{ name, body }`.
 * @param {any[]} form
 * @returns {{ name: string, body: any }}
 */
function normalizeDefinitionForm(form) {
  if (!Array.isArray(form) || form.length < 3) {
    throw new Error('Each form must be (def name body)');
  }
  if (form[0] === 'def') {
    const [, name, body] = form;
    return { name, body };
  }
  if (form[0] === 'defn') {
    const [, name, params, body] = form;
    return { name, body: desugarParamsToLambdas(params, body) };
  }
  throw new Error(`Unsupported form ${form[0]}`);
}

/**
 * Desugar `(defn name (x y …) body)` into nested lambdas `λx.λy.… body`.
 *
 * In this repo, lambdas are represented in S-expression skeletons as `[[], body]`
 * (a pair whose left child is the empty list).
 *
 * @param {any[]} params
 * @param {any} body
 * @param {string[]} context
 * @returns {any}
 */
function desugarParamsToLambdas(params, body, context = []) {
  invariant(Array.isArray(params), 'defn params must be a list');
  if (!params.length) {
    return encodeNamesAsSlots(body, context);
  }
  const [first, ...rest] = params;
  const extended = [...context, first];
  return [[], desugarParamsToLambdas(rest, body, extended)];
}

/**
 * Replace named parameters with De Bruijn-style slot references (`#0`, `#1`, …).
 *
 * @param {any} expr
 * @param {string[]} context
 * @returns {any}
 */
function encodeNamesAsSlots(expr, context) {
  if (Array.isArray(expr)) {
    return expr.map(part => encodeNamesAsSlots(part, context));
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
 * @param {{
 *   tracer?: (snapshot: object) => void,
 *   maxSteps?: number,
 *   cloneArguments?: boolean
 * }} [options]
 * @returns {{ graph: Graph, rootId: string }}
 */
export function evaluateExpression(expr, env, options = {}) {
  const tracer = options.tracer ?? null;
  const maxSteps = options.maxSteps ?? 10_000;
  const cloneArguments = options.cloneArguments ?? true;
  const ast = typeof expr === 'string' ? parseSexpr(expr) : expr;
  const graph = createGraph();
  const { graph: withTree, nodeId } = buildGraphFromSexpr(graph, ast, []);
  snapshotState(tracer, withTree, nodeId, 'init');

  let currentGraph = withTree;
  let currentRoot = nodeId;

  // Phase 1: weak reduction (do not reduce inside lambda bodies).
  ({ graph: currentGraph, rootId: currentRoot } = runUntilStuck(
    currentGraph,
    currentRoot,
    env,
    tracer,
    maxSteps,
    { reduceUnderLambdas: false, cloneArguments },
  ));

  // Phase 2: full reduction (normalize under lambdas).
  const final = runUntilStuck(currentGraph, currentRoot, env, tracer, maxSteps, {
    reduceUnderLambdas: true,
    cloneArguments,
  });
  currentGraph = final.graph;
  currentRoot = final.rootId;
  snapshotState(tracer, currentGraph, currentRoot, 'final');
  return { graph: currentGraph, rootId: currentRoot };
}

function runUntilStuck(graph, rootId, env, tracer, maxSteps, options) {
  let currentGraph = graph;
  let currentRoot = rootId;
  let observer = createObserver(rootId);
  for (let i = 0; i < maxSteps; i += 1) {
    const stepped = stepNormalOrder(currentGraph, currentRoot, env, options, observer);
    if (!stepped.didStep) return { graph: currentGraph, rootId: currentRoot };
    currentGraph = stepped.graph;
    currentRoot = stepped.rootId;
    observer = stepped.observer;
    snapshotState(tracer, currentGraph, currentRoot, stepped.note, stepped.focus);
  }
  throw new Error(`Reduction exceeded maxSteps=${maxSteps}; expression may be non-terminating`);
}

/**
 * ---------------------------------------------------------------------------
 * Term construction: S-expression → pointer graph
 * ---------------------------------------------------------------------------
 */

/**
 * Build the graph representation for an expression.
 *
 * @param {Graph} graph
 * @param {any} expr
 * @param {{ id: string }[]} stack
 * @returns {{ graph: Graph, nodeId: string }}
 */
function buildGraphFromSexpr(graph, expr, stack) {
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
      const body = buildGraphFromSexpr(binderResult.graph, expr[1], nextStack);
      const { graph: complete, id } = addNode(body.graph, {
        kind: 'pair',
        label: '·',
        children: [binderId, body.nodeId],
      });
      return { graph: complete, nodeId: id };
    }
    const left = buildGraphFromSexpr(graph, expr[0], stack);
    const right = buildGraphFromSexpr(left.graph, expr[1], stack);
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
 * ---------------------------------------------------------------------------
 * Machine: one step = one local event
 * ---------------------------------------------------------------------------
 */

/**
 * Perform one deterministic leftmost-outermost reduction step.
 *
 * The step selection is isolated to `chooseNextEvent` (observer logic). The
 * substrate update is a single local rewrite (expand/apply/collapse).
 *
 * @param {Graph} graph
 * @param {string} rootId
 * @param {Map<string, any>} env
 * @param {{ reduceUnderLambdas: boolean, cloneArguments: boolean }} options
 * @param {Observer} observer
 * @returns {{ graph: Graph, rootId: string, observer: Observer, didStep: boolean, note?: string, focus?: object }}
 */
function stepNormalOrder(graph, rootId, env, options, observer) {
  // The deterministic baseline strategy: the observer always starts from the
  // current root. (In other words: this schedule "falls back to the origin"
  // after every rewrite.)
  const startObserver = observer?.rootId === rootId ? observer : createObserver(rootId);
  const observed = observeNextEvent(startObserver, graph, env, options);
  const event = observed.event;
  if (!event) return { graph, rootId, observer: observed.observer, didStep: false };

  switch (event.kind) {
    case 'expand': {
      const template = buildGraphFromSexpr(graph, env.get(event.name), []);
      const replaced = replaceAtPath(template.graph, rootId, event.path, template.nodeId);
      return {
        graph: replaced.graph,
        rootId: replaced.rootId,
        observer: createObserver(replaced.rootId),
        didStep: true,
        note: 'expand',
        focus: event,
      };
    }
    case 'collapse': {
      const replaced = replaceAtPath(graph, rootId, event.path, event.replacementId);
      return {
        graph: replaced.graph,
        rootId: replaced.rootId,
        observer: createObserver(replaced.rootId),
        didStep: true,
        note: 'collapse',
        focus: event,
      };
    }
    case 'apply': {
      let workingGraph = graph;
      const clonedLambda = cloneSubgraph(workingGraph, event.lambdaId);
      workingGraph = clonedLambda.graph;

      let argId = event.argId;
      if (options.cloneArguments) {
        const clonedArg = cloneSubgraph(workingGraph, argId);
        workingGraph = clonedArg.graph;
        argId = clonedArg.rootId;
      }

      const lambdaRoot = getNode(workingGraph, clonedLambda.rootId);
      invariant(lambdaRoot.kind === 'pair', 'Lambda root must be a pair node');
      const lambdaBinderId = lambdaRoot.children?.[0];
      const lambdaBodyId = lambdaRoot.children?.[1];
      invariant(typeof lambdaBinderId === 'string' && typeof lambdaBodyId === 'string', 'Malformed lambda pair');
      const lambdaBinder = getNode(workingGraph, lambdaBinderId);
      invariant(lambdaBinder.kind === 'binder', 'Lambda binder must be a binder node');

      workingGraph = updateNode(workingGraph, lambdaBinderId, binder => ({
        ...binder,
        valueId: argId,
      }));

      const replaced = replaceAtPath(workingGraph, rootId, event.path, lambdaBodyId);
      return {
        graph: replaced.graph,
        rootId: replaced.rootId,
        observer: createObserver(replaced.rootId),
        didStep: true,
        note: 'apply',
        focus: event,
      };
    }
    default:
      throw new Error(`Unknown event kind: ${event.kind}`);
  }
}

function replaceAtPath(graph, rootId, path, replacementId) {
  if (!path.length) return { graph, rootId: replacementId };
  const frame = path[path.length - 1];
  if (frame.kind === 'pair') {
    const parentId = frame.parentId;
    const index = frame.index;
    const nextGraph = updateNode(graph, parentId, node => {
      invariant(node.kind === 'pair', 'pair path frame must target a pair node');
      const children = Array.isArray(node.children) ? [...node.children] : [];
      children[index] = replacementId;
      return { ...node, children };
    });
    return { graph: nextGraph, rootId };
  }
  if (frame.kind === 'binder-value') {
    const binderId = frame.binderId;
    const nextGraph = updateNode(graph, binderId, node => {
      invariant(node.kind === 'binder', 'binder-value frame must target a binder node');
      return { ...node, valueId: replacementId };
    });
    return { graph: nextGraph, rootId };
  }
  throw new Error(`Unknown path frame kind: ${frame.kind}`);
}

function isLambdaPair(graph, nodeId) {
  const node = getNode(graph, nodeId);
  if (node.kind !== 'pair' || !Array.isArray(node.children) || node.children.length !== 2) return false;
  const left = getNode(graph, node.children[0]);
  return left.kind === 'binder';
}

/**
 * Resolve the "head" of an application by dereferencing slots through bound binders.
 * This is used only for determining whether the left side is `empty` (collapse) or
 * a lambda (apply), without forcing evaluation of the argument.
 */
function resolveApplicationHead(graph, nodeId, seenBinders) {
  let currentId = nodeId;
  while (true) {
    const node = getNode(graph, currentId);
    if (node.kind !== 'slot') return currentId;
    const binderId = node.binderId;
    if (typeof binderId !== 'string') return currentId;
    if (seenBinders.has(binderId)) return currentId;
    const binder = getNode(graph, binderId);
    if (binder.kind !== 'binder' || typeof binder.valueId !== 'string') return currentId;
    seenBinders.add(binderId);
    currentId = binder.valueId;
  }
}

/**
 * Create a fresh observer rooted at `rootId`.
 *
 * @param {string} rootId
 * @returns {Observer}
 */
function createObserver(rootId) {
  return {
    rootId,
    stack: [{ nodeId: rootId, path: [], seenBinders: new Set() }],
  };
}

/**
 * Observer logic: choose the next locally-enabled event under a normal-order
 * (leftmost-outermost) schedule.
 *
 * This is implemented as an explicit pointer stack (zipper-like traversal state)
 * so the "lens" is a concrete piece of data rather than implicit recursion.
 *
 * @param {Observer} observer
 * @returns {{ event: Event | null, observer: Observer }}
 */
function observeNextEvent(observer, graph, env, options) {
  const reduceUnderLambdas = options.reduceUnderLambdas ?? true;
  const stack = [...(observer.stack ?? [])];

  while (stack.length) {
    const item = stack.pop();
    if (!item) break;
    const { nodeId, path, seenBinders } = item;
    const node = getNode(graph, nodeId);

    if (node.kind === 'symbol' && env.has(node.label)) {
      return { event: { kind: 'expand', nodeId, name: node.label, path }, observer: { rootId: observer.rootId, stack } };
    }

    if (node.kind === 'pair' && Array.isArray(node.children) && node.children.length === 2) {
      const [leftId, rightId] = node.children;
      const leftResolvedId = resolveApplicationHead(graph, leftId, new Set());
      const leftResolved = getNode(graph, leftResolvedId);
      if (leftResolved.kind === 'empty') {
        return {
          event: { kind: 'collapse', nodeId, replacementId: rightId, path },
          observer: { rootId: observer.rootId, stack },
        };
      }
      if (leftResolved.kind === 'pair' && isLambdaPair(graph, leftResolvedId)) {
        return {
          event: { kind: 'apply', nodeId, lambdaId: leftResolvedId, argId: rightId, path },
          observer: { rootId: observer.rootId, stack },
        };
      }

      if (isLambdaPair(graph, nodeId)) {
        if (!reduceUnderLambdas) continue;
        stack.push({
          nodeId: rightId,
          path: [...path, { kind: 'pair', parentId: nodeId, index: 1 }],
          seenBinders,
        });
        continue;
      }

      // Depth-first, left-to-right traversal: push right, then left.
      stack.push({
        nodeId: rightId,
        path: [...path, { kind: 'pair', parentId: nodeId, index: 1 }],
        seenBinders,
      });
      stack.push({
        nodeId: leftId,
        path: [...path, { kind: 'pair', parentId: nodeId, index: 0 }],
        seenBinders,
      });
      continue;
    }

    if (node.kind === 'slot') {
      const binderId = node.binderId;
      if (typeof binderId !== 'string') continue;
      if (seenBinders.has(binderId)) continue;
      const binder = getNode(graph, binderId);
      if (binder.kind !== 'binder' || typeof binder.valueId !== 'string') continue;
      const nextSeen = new Set(seenBinders);
      nextSeen.add(binderId);
      stack.push({
        nodeId: binder.valueId,
        path: [...path, { kind: 'binder-value', binderId }],
        seenBinders: nextSeen,
      });
      continue;
    }
  }

  return { event: null, observer: { rootId: observer.rootId, stack } };
}

/**
 * Emit a snapshot for visualization/debugging.
 *
 * @param {(snapshot: object) => void} tracer
 * @param {Graph} graph
 * @param {string} rootId
 * @param {string} note
 * @param {object} [focus]
 * @returns {void}
 */
function snapshotState(tracer, graph, rootId, note, focus = null) {
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
    focus,
  };
  tracer(snapshot);
}
