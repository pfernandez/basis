/**
 * Common utilities shared across Basis modules.
 */

/**
 * Create a simple incremental ID generator.
 *
 * @param {string} prefix
 * @returns {() => string}
 */
export function createIdGenerator(prefix = 'n') {
  let counter = 0;
  return () => `${prefix}${counter++}`;
}

/**
 * Ensure a condition holds, otherwise throw with the provided message.
 *
 * @param {boolean} condition
 * @param {string} message
 * @returns {void}
 */
export function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Build a parent index for quick child→parent lookups.
 *
 * @param {Array<{id: string, children?: string[]}>} nodes
 * @returns {Map<string, string[]>}
 */
export function buildParentIndex(nodes) {
  const index = new Map();
  nodes.forEach(node => {
    if (!node.children) return;
    node.children.forEach(child => {
      const parents = index.get(child);
      if (parents) {
        parents.push(node.id);
      } else {
        index.set(child, [node.id]);
      }
    });
  });
  return index;
}

/**
 * Replace a node entry immutably.
 *
 * @template T
 * @param {T[]} list
 * @param {string} id
 * @param {(node: T) => T} updater
 * @returns {T[]}
 */
export function replaceNode(list, id, updater) {
  return list.map(node => (node.id === id ? updater(node) : node));
}
