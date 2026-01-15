/**
 * Pointer machine (observer + local rewrites)
 * ------------------------------------------
 *
 * This module implements the core "pairs + pointers" reduction dynamics on the
 * substrate from `graph.js`.
 *
 * Core rules:
 * - Binding is not substitution. Application updates one indirection cell
 *   (`binder.valueId = argRoot`) and replaces the application with the body.
 * - Collapse is purely structural: `(() x) → x` (bypass a pair whose left is
 *   empty).
 *
 * Everything about parsing, naming, and display is intentionally out of scope.
 */

import { cloneSubgraph, getNode, updateNode } from './graph.js';
import { assertPairNode, isLambdaPair, pairChildren } from './patterns.js';
import { invariant } from '../utils.js';

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
 * "where to look next" work items.
 *
 * @typedef {{ nodeId: string, path: PathFrame[], seenBinders: Set<string> }}
 *   WorkItem
 * @typedef {{ rootId: string, stack: WorkItem[] }} Observer
 */

/**
 * A single locally-enabled event selected by the observer.
 *
 * @typedef {{
 *   kind: 'expand',
 *   nodeId: string,
 *   name: string,
 *   path: PathFrame[]
 * }} ExpandEvent
 * @typedef {{
 *   kind: 'apply',
 *   nodeId: string,
 *   lambdaId: string,
 *   argId: string,
 *   path: PathFrame[]
 * }} ApplyEvent
 * @typedef {{
 *   kind: 'collapse',
 *   nodeId: string,
 *   replacementId: string,
 *   path: PathFrame[]
 * }} CollapseEvent
 * @typedef {ExpandEvent | ApplyEvent | CollapseEvent} Event
 */

/**
 * Hooks that let an outer layer keep the core machine agnostic about syntax.
 *
 * @typedef {{
 *   canExpandSymbol?: (name: string) => boolean,
 *   expandSymbol?: (
 *     graph: import('./graph.js').Graph,
 *     name: string
 *   ) => { graph: import('./graph.js').Graph, nodeId: string }
 * }} MachineHooks
 */

function replaceInPair(graph, parentId, index, replacementId) {
  return updateNode(graph, parentId, node => {
    assertPairNode(node, 'pair frame must target a pair node');
    const children = [...node.children];
    children[index] = replacementId;
    return { ...node, children };
  });
}

function replaceInBinderValue(graph, binderId, replacementId) {
  return updateNode(graph, binderId, node => {
    invariant(node.kind === 'binder', 'binder-value frame must target binder');
    return { ...node, valueId: replacementId };
  });
}

function replaceAtPath(graph, rootId, path, replacementId) {
  if (!path.length) return { graph, rootId: replacementId };

  const frame = path[path.length - 1];
  if (frame.kind === 'pair') {
    return {
      graph: replaceInPair(graph, frame.parentId, frame.index, replacementId),
      rootId,
    };
  }

  if (frame.kind === 'binder-value') {
    return {
      graph: replaceInBinderValue(graph, frame.binderId, replacementId),
      rootId,
    };
  }

  throw new Error(`Unknown path frame kind: ${frame.kind}`);
}

function lambdaParts(graph, lambdaId) {
  const node = getNode(graph, lambdaId);
  assertPairNode(node, 'Lambda root must be a pair node');
  const [binderId, bodyId] = pairChildren(node);
  invariant(
    getNode(graph, binderId).kind === 'binder',
    'Lambda binder must be a binder node',
  );
  return { binderId, bodyId };
}

function derefSlotOnce(graph, slotNode, seenBinders) {
  const binderId = slotNode.binderId;
  if (typeof binderId !== 'string') return null;
  if (seenBinders.has(binderId)) return null;
  const binder = getNode(graph, binderId);
  if (binder.kind !== 'binder') return null;
  if (typeof binder.valueId !== 'string') return null;
  seenBinders.add(binderId);
  return binder.valueId;
}

function resolveApplicationHead(graph, nodeId) {
  const seenBinders = new Set();
  let currentId = nodeId;
  while (true) {
    const node = getNode(graph, currentId);
    if (node.kind !== 'slot') return currentId;
    const nextId = derefSlotOnce(graph, node, seenBinders);
    if (typeof nextId !== 'string') return currentId;
    currentId = nextId;
  }
}

function applicationShape(graph, pairNode) {
  const [leftId, rightId] = pairChildren(pairNode);
  const headId = resolveApplicationHead(graph, leftId);
  return { leftId, rightId, headId };
}

function shouldExpandSymbol(node, hooks) {
  return (
    node.kind === 'symbol' &&
    typeof hooks.canExpandSymbol === 'function' &&
    hooks.canExpandSymbol(node.label)
  );
}

function collapseEventForApplication(graph, nodeId, pairNode, path) {
  const { rightId, headId } = applicationShape(graph, pairNode);
  if (getNode(graph, headId).kind !== 'empty') return null;
  return { kind: 'collapse', nodeId, replacementId: rightId, path };
}

function applyEventForApplication(graph, nodeId, pairNode, path) {
  const { rightId, headId } = applicationShape(graph, pairNode);
  if (!isLambdaPair(graph, headId)) return null;
  return { kind: 'apply', nodeId, lambdaId: headId, argId: rightId, path };
}

function workItemForBoundSlot(graph, slotNode, path, seenBinders) {
  const binderId = slotNode.binderId;
  if (typeof binderId !== 'string') return null;
  if (seenBinders.has(binderId)) return null;

  const binder = getNode(graph, binderId);
  if (binder.kind !== 'binder') return null;
  if (typeof binder.valueId !== 'string') return null;

  const nextSeen = new Set(seenBinders);
  nextSeen.add(binderId);

  return {
    nodeId: binder.valueId,
    path: [...path, { kind: 'binder-value', binderId }],
    seenBinders: nextSeen,
  };
}

function pushWork(stack, nodeId, path, seenBinders) {
  stack.push({ nodeId, path, seenBinders });
}

function pushPairTraversal(stack, nodeId, pairNode, path, seenBinders) {
  const [leftId, rightId] = pairChildren(pairNode);
  pushWork(
    stack,
    rightId,
    [...path, { kind: 'pair', parentId: nodeId, index: 1 }],
    seenBinders,
  );
  pushWork(
    stack,
    leftId,
    [...path, { kind: 'pair', parentId: nodeId, index: 0 }],
    seenBinders,
  );
}

function pushLambdaBody(stack, nodeId, lambdaPair, path, seenBinders) {
  const [, bodyId] = pairChildren(lambdaPair);
  pushWork(
    stack,
    bodyId,
    [...path, { kind: 'pair', parentId: nodeId, index: 1 }],
    seenBinders,
  );
}

/**
 * Observer logic: choose the next locally-enabled event under a normal-order
 * (leftmost-outermost) schedule.
 *
 * @param {Observer} observer
 * @param {import('./graph.js').Graph} graph
 * @param {{ reduceUnderLambdas: boolean }} options
 * @param {MachineHooks} hooks
 * @returns {{ event: Event | null, observer: Observer }}
 */
function observeNextEvent(observer, graph, options, hooks) {
  const reduceUnderLambdas = options.reduceUnderLambdas ?? true;
  const stack = [...(observer.stack ?? [])];

  while (stack.length) {
    const item = stack.pop();
    if (!item) break;
    const { nodeId, path, seenBinders } = item;
    const node = getNode(graph, nodeId);

    if (shouldExpandSymbol(node, hooks)) {
      return {
        event: { kind: 'expand', nodeId, name: node.label, path },
        observer: { rootId: observer.rootId, stack },
      };
    }

    if (node.kind === 'pair') {
      const collapse = collapseEventForApplication(graph, nodeId, node, path);
      if (collapse) {
        return {
          event: collapse,
          observer: { rootId: observer.rootId, stack },
        };
      }

      const apply = applyEventForApplication(graph, nodeId, node, path);
      if (apply) {
        return {
          event: apply,
          observer: { rootId: observer.rootId, stack },
        };
      }

      if (isLambdaPair(graph, nodeId)) {
        if (!reduceUnderLambdas) continue;
        pushLambdaBody(stack, nodeId, node, path, seenBinders);
        continue;
      }

      pushPairTraversal(stack, nodeId, node, path, seenBinders);
      continue;
    }

    if (node.kind === 'slot') {
      const nextItem = workItemForBoundSlot(graph, node, path, seenBinders);
      if (nextItem) stack.push(nextItem);
      continue;
    }
  }

  return { event: null, observer: { rootId: observer.rootId, stack } };
}

function expandSymbol(graph, rootId, event, hooks) {
  invariant(
    typeof hooks.expandSymbol === 'function',
    'expand event requires hooks.expandSymbol',
  );
  const expanded = hooks.expandSymbol(graph, event.name);
  return replaceAtPath(expanded.graph, rootId, event.path, expanded.nodeId);
}

function collapseApplication(graph, rootId, event) {
  return replaceAtPath(graph, rootId, event.path, event.replacementId);
}

function cloneIfNeeded(graph, rootId, shouldClone) {
  return shouldClone ? cloneSubgraph(graph, rootId) : { graph, rootId };
}

function bindArgument(graph, binderId, argId) {
  return updateNode(graph, binderId, binder => ({
    ...binder,
    valueId: argId,
  }));
}

function applyLambda(graph, lambdaId, argId, options) {
  const lambdaClone = cloneSubgraph(graph, lambdaId);
  const argClone = cloneIfNeeded(
    lambdaClone.graph,
    argId,
    options.cloneArguments,
  );
  const { binderId, bodyId } = lambdaParts(argClone.graph, lambdaClone.rootId);
  const boundGraph = bindArgument(argClone.graph, binderId, argClone.rootId);
  return { graph: boundGraph, bodyId };
}

function stepEvent(graph, rootId, event, options, hooks) {
  if (event.kind === 'expand') {
    return expandSymbol(graph, rootId, event, hooks);
  }
  if (event.kind === 'collapse') {
    return collapseApplication(graph, rootId, event);
  }

  const applied = applyLambda(graph, event.lambdaId, event.argId, options);
  return replaceAtPath(applied.graph, rootId, event.path, applied.bodyId);
}

/**
 * Create a fresh observer rooted at `rootId`.
 *
 * @param {string} rootId
 * @returns {Observer}
 */
export function createObserver(rootId) {
  return {
    rootId,
    stack: [{ nodeId: rootId, path: [], seenBinders: new Set() }],
  };
}

/**
 * Observe the next locally-enabled event under a deterministic normal-order
 * schedule.
 *
 * This is the "redex chooser" part of the machine. It does not mutate or
 * rewrite; it only selects an event.
 *
 * @param {Observer} observer
 * @param {import('./graph.js').Graph} graph
 * @param {{ reduceUnderLambdas: boolean }} options
 * @param {MachineHooks} [hooks]
 * @returns {{ event: Event | null, observer: Observer }}
 */
export function observeNormalOrder(observer, graph, options, hooks = {}) {
  return observeNextEvent(observer, graph, options, hooks);
}

/**
 * Collect all locally-enabled events reachable from `rootId`.
 *
 * The returned list is deterministic: it follows the same left-first traversal
 * order as the normal-order observer, but does not stop at the first redex.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {{ reduceUnderLambdas: boolean }} options
 * @param {MachineHooks} [hooks]
 * @returns {Event[]}
 */
export function collectEnabledEvents(graph, rootId, options, hooks = {}) {
  const reduceUnderLambdas = options.reduceUnderLambdas ?? true;
  const stack = [{ nodeId: rootId, path: [], seenBinders: new Set() }];

  /** @type {Event[]} */
  const events = [];

  while (stack.length) {
    const item = stack.pop();
    if (!item) break;

    const { nodeId, path, seenBinders } = item;
    const node = getNode(graph, nodeId);

    if (shouldExpandSymbol(node, hooks)) {
      events.push({ kind: 'expand', nodeId, name: node.label, path });
      continue;
    }

    if (node.kind === 'pair') {
      const collapse = collapseEventForApplication(graph, nodeId, node, path);
      if (collapse) events.push(collapse);

      const apply = applyEventForApplication(graph, nodeId, node, path);
      if (apply) events.push(apply);

      if (isLambdaPair(graph, nodeId)) {
        if (reduceUnderLambdas) {
          pushLambdaBody(stack, nodeId, node, path, seenBinders);
        }
        continue;
      }

      pushPairTraversal(stack, nodeId, node, path, seenBinders);
      continue;
    }

    if (node.kind === 'slot') {
      const nextItem = workItemForBoundSlot(graph, node, path, seenBinders);
      if (nextItem) stack.push(nextItem);
    }
  }

  return events;
}

/**
 * Apply a previously observed machine event.
 *
 * This is the "rewrite" part of the machine. It is pure: returns a new graph
 * value and an updated root.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {Event} event
 * @param {{ cloneArguments: boolean }} options
 * @param {MachineHooks} [hooks]
 * @returns {{
 *   graph: import('./graph.js').Graph,
 *   rootId: string,
 *   note: string,
 *   focus: Event
 * }}
 */
export function applyMachineEvent(graph, rootId, event, options, hooks = {}) {
  const stepped = stepEvent(graph, rootId, event, options, hooks);
  return {
    graph: stepped.graph,
    rootId: stepped.rootId,
    note: event.kind,
    focus: event,
  };
}

/**
 * Perform one deterministic leftmost-outermost reduction step.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {{ reduceUnderLambdas: boolean, cloneArguments: boolean }} options
 * @param {Observer} observer
 * @param {MachineHooks} [hooks]
 * @returns {{
 *   graph: import('./graph.js').Graph,
 *   rootId: string,
 *   observer: Observer,
 *   didStep: boolean,
 *   note?: string,
 *   focus?: Event
 * }}
 */
export function stepNormalOrder(graph, rootId, options, observer, hooks = {}) {
  // Deterministic baseline: start from the current root after each rewrite.
  const startObserver =
    observer?.rootId === rootId ? observer : createObserver(rootId);
  const observed = observeNextEvent(startObserver, graph, options, hooks);
  const event = observed.event;
  if (!event) {
    return { graph, rootId, observer: observed.observer, didStep: false };
  }

  const stepped = stepEvent(graph, rootId, event, options, hooks);

  return {
    graph: stepped.graph,
    rootId: stepped.rootId,
    observer: createObserver(stepped.rootId),
    didStep: true,
    note: event.kind,
    focus: event,
  };
}
