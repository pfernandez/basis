/**
 * Bijection toolkit
 * -----------------
 *
 * Dyck words enumerate full binary trees via the grammar:
 *
 *   D := '(' D ')' D | ε
 *
 * Parsing a Dyck word with that grammar yields a binary tree where each `(`
 * introduces a node and `ε` is a leaf. Rendering the tree as
 * `(${left}${right})` with leaf `()` gives the "pairs form" used throughout
 * this repo.
 *
 * Motzkin words allow unary nodes. We parse them into explicit unary/binary
 * trees, then embed them into Catalan trees by translating each unary step as
 * a neutral left leaf: `U(x) ↦ B(•, x)`.
 */

import { dyck, motzkin, pairs } from './catalan.js';

/**
 * @typedef {{ left: DyckTree, right: DyckTree } | null} DyckTree
 * @typedef {{
 *   kind: 'unary',
 *   child: MotzkinTree
 * } | {
 *   kind: 'binary',
 *   left: MotzkinTree,
 *   right: MotzkinTree
 * } | null} MotzkinTree
 */

// Re-export canonical generators so consumers can import a single module.
export const generateDyckWords = dyck;
export const generateCatalanTrees = pairs;
export const generateMotzkinWords = motzkin;

/**
 * Split a balanced parentheses string into top-level balanced blocks.
 *
 * @param {string} value
 * @returns {string[]}
 */
function splitIntoBalancedBlocks(value) {
  /** @type {string[]} */
  const parts = [];
  let balance = 0;
  let start = 0;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') balance += 1;
    else if (ch === ')') balance -= 1;
    else throw new Error(`Invalid character: ${ch}`);

    if (balance < 0) throw new Error(`Unbalanced parentheses in ${value}`);

    if (balance === 0) {
      parts.push(value.slice(start, i + 1));
      start = i + 1;
    }
  }

  if (balance !== 0) {
    throw new Error(`Unbalanced parentheses in ${value}`);
  }

  return parts.filter(Boolean);
}

/**
 * Parse a Dyck word into a full binary tree.
 *
 * @param {string} word
 * @returns {DyckTree}
 */
export function dyckToTree(word) {
  if (!word.length) return null;
  if (word[0] !== '(') throw new Error(`Invalid Dyck word: ${word}`);

  let balance = 0;
  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];
    if (ch === '(') balance += 1;
    else if (ch === ')') balance -= 1;
    else throw new Error(`Invalid character in Dyck word: ${ch}`);

    if (balance < 0) throw new Error(`Invalid Dyck word: ${word}`);
    if (balance !== 0) continue;

    const left = word.slice(1, i);
    const right = word.slice(i + 1);
    return { left: dyckToTree(left), right: dyckToTree(right) };
  }

  throw new Error(`Invalid Dyck word: ${word}`);
}

/**
 * Render a Dyck tree into "pairs form".
 *
 * @param {DyckTree} tree
 * @returns {string}
 */
export function renderTree(tree) {
  if (tree === null) return '()';
  return `(${renderTree(tree.left)}${renderTree(tree.right)})`;
}

/**
 * Parse a Motzkin word into a unary/binary tree.
 *
 * @param {string} word
 * @returns {MotzkinTree}
 */
export function motzkinToTree(word) {
  if (word === '()') return null;
  if (word[0] !== '(' || word[word.length - 1] !== ')') {
    throw new Error(`Invalid Motzkin word: ${word}`);
  }

  const inner = word.slice(1, -1);
  const parts = splitIntoBalancedBlocks(inner);
  if (parts.length === 1) {
    return { kind: 'unary', child: motzkinToTree(parts[0]) };
  }
  if (parts.length === 2) {
    return {
      kind: 'binary',
      left: motzkinToTree(parts[0]),
      right: motzkinToTree(parts[1]),
    };
  }

  throw new Error(`Motzkin nodes must have 1 or 2 children: ${word}`);
}

/**
 * Render a Motzkin tree back into its word form.
 *
 * @param {MotzkinTree} tree
 * @returns {string}
 */
export function renderMotzkinTree(tree) {
  if (tree === null) return '()';
  if (tree.kind === 'unary') {
    return `(${renderMotzkinTree(tree.child)})`;
  }
  if (tree.kind === 'binary') {
    return `(${renderMotzkinTree(tree.left)}${renderMotzkinTree(tree.right)})`;
  }
  throw new Error('Unknown Motzkin node');
}

/**
 * Embed a Motzkin tree into a Dyck/Catalan tree by turning unary nodes into a
 * binary node with a neutral left leaf.
 *
 * @param {MotzkinTree} tree
 * @returns {DyckTree}
 */
export function motzkinTreeToCatalanTree(tree) {
  if (tree === null) return null;
  if (tree.kind === 'unary') {
    return { left: null, right: motzkinTreeToCatalanTree(tree.child) };
  }
  if (tree.kind === 'binary') {
    return {
      left: motzkinTreeToCatalanTree(tree.left),
      right: motzkinTreeToCatalanTree(tree.right),
    };
  }
  throw new Error('Unknown Motzkin node');
}

