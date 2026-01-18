/**
 * Graph patterns (shared predicates)
 * ---------------------------------
 *
 * Helpers for working with the pointer-graph substrate shape in a consistent
 * way across the reducer and serializer.
 */

import { getNode } from './graph.js';
import { invariant } from '../utils.js';

/**
 * @param {any} node
 * @returns {node is { kind: 'pair', children: [string, string] }}
 */
export function isPairNode(node) {
  return (
    Boolean(node) &&
    typeof node === 'object' &&
    node.kind === 'pair' &&
    Array.isArray(node.children) &&
    node.children.length === 2 &&
    typeof node.children[0] === 'string' &&
    typeof node.children[1] === 'string'
  );
}

/**
 * @param {any} node
 * @param {string} [message]
 * @returns {void}
 */
export function assertPairNode(node, message = 'Expected pair node') {
  invariant(isPairNode(node), message);
  invariant(
    node.children.length === 2,
    'pair nodes must have two children',
  );
}

/**
 * @param {any} node
 * @param {string} [message]
 * @returns {[string, string]}
 */
export function pairChildren(node, message) {
  assertPairNode(node, message);
  return node.children;
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} pairId
 * @returns {boolean}
 */
export function isLambdaPair(graph, pairId) {
  const node = getNode(graph, pairId);
  if (!isPairNode(node) || node.children.length !== 2) return false;
  const [leftId] = node.children;
  return getNode(graph, leftId).kind === 'binder';
}
