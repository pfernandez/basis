/**
 * Dyck tools
 * ----------
 *
 * Pure helpers for working with Dyck words (balanced parentheses) and their
 * associated Catalan trees.
 *
 * Conventions:
 * - A Catalan/Dyck tree is either a leaf (`Leaf = null`) or an internal node
 *   `{ L, R }`.
 * - A Dyck word can represent a forest: concatenation of primitive blocks.
 * - η-normalization removes left-empty wrappers: `(() x) ≡ x`.
 */

import { dyck as generateDyck } from './catalan.js';

/**
 * @typedef {{ L: Tree, R: Tree } | null} Tree
 */

/**
 * Leaf value.
 * @type {null}
 */
export const Leaf = null;

/**
 * Construct a tree node.
 *
 * @param {Tree} left
 * @param {Tree} right
 * @returns {Tree}
 */
export function Node(left, right) {
  return { L: left, R: right };
}

/**
 * @param {Tree} tree
 * @returns {boolean}
 */
export function isLeaf(tree) {
  return tree === Leaf;
}

/**
 * Count internal nodes (Catalan size).
 *
 * @param {Tree} tree
 * @returns {number}
 */
export function countPairs(tree) {
  if (isLeaf(tree)) return 0;
  return 1 + countPairs(tree.L) + countPairs(tree.R);
}

/**
 * Stable structural hash (ordered).
 *
 * @param {Tree} tree
 * @returns {string}
 */
export function hashTree(tree) {
  if (isLeaf(tree)) return '()';
  return `(${hashTree(tree.L)}${hashTree(tree.R)})`;
}

/**
 * Serialize a tree back to parentheses.
 *
 * @param {Tree} tree
 * @returns {string}
 */
export function serialize(tree) {
  if (isLeaf(tree)) return '()';
  return `(${serialize(tree.L)}${serialize(tree.R)})`;
}

/**
 * Factor a Dyck word into primitive balanced blocks.
 *
 * Example: `()()(()())` → `['()', '()', '(()())']`
 *
 * @param {string} word
 * @returns {string[]}
 */
export function factorDyck(word) {
  /** @type {string[]} */
  const out = [];
  let balance = 0;
  let start = 0;

  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];
    if (ch === '(') balance += 1;
    else if (ch === ')') balance -= 1;
    else throw new Error(`Invalid character: ${ch}`);

    if (balance < 0) throw new Error(`Unbalanced at ${i} in "${word}"`);

    if (balance === 0) {
      out.push(word.slice(start, i + 1));
      start = i + 1;
    }
  }

  if (balance !== 0) throw new Error(`Unbalanced at end in "${word}"`);
  return out.filter(Boolean);
}

/**
 * Parse a primitive Dyck word (one balanced block) into a tree.
 *
 * Grammar: `P := '()' | '(' P P ')'`
 *
 * If the inner portion factors into more than two primitives, we
 * right-associate the list to keep the parser total (useful for Motzkin/unary
 * dressings).
 *
 * @param {string} primitive
 * @returns {Tree}
 */
export function parseTree(primitive) {
  if (primitive === '()') return Leaf;
  if (primitive[0] !== '(' || primitive[primitive.length - 1] !== ')') {
    throw new Error(
      `Primitive must start '(' and end ')': "${primitive}"`,
    );
  }

  const inner = primitive.slice(1, -1);
  const parts = factorDyck(inner);
  if (parts.length === 2) {
    return Node(parseTree(parts[0]), parseTree(parts[1]));
  }

  return parts.reduceRight((acc, part) => Node(parseTree(part), acc), Leaf);
}

/**
 * η-normalize a tree: `Node(Leaf, X) → X`, recursively.
 *
 * @param {Tree} tree
 * @returns {Tree}
 */
export function etaNormalizeTree(tree) {
  if (isLeaf(tree)) return Leaf;
  const left = etaNormalizeTree(tree.L);
  const right = etaNormalizeTree(tree.R);
  if (isLeaf(left) && !isLeaf(right)) return right;
  return Node(left, right);
}

/**
 * Canonicalize associativity for stable comparison.
 *
 * Currently a no-op for ordered trees.
 *
 * @param {Tree} tree
 * @returns {Tree}
 */
export function canonicalize(tree) {
  return tree;
}

/**
 * Summarize a Dyck word (possibly a forest) into η-normalized cores.
 *
 * @param {string} word
 * @returns {{
 *   primitives: string[],
 *   cores: Tree[],
 *   coreHashes: string[],
 *   coreSizes: number[]
 * }}
 */
export function catalog(word) {
  const primitives = factorDyck(word);
  const cores = primitives.map(prim =>
    canonicalize(etaNormalizeTree(parseTree(prim))),
  );
  return {
    primitives,
    cores,
    coreHashes: cores.map(hashTree),
    coreSizes: cores.map(countPairs),
  };
}

/**
 * Build a histogram by Catalan size (after η-normalization) for many words.
 *
 * @param {string[]} words
 * @returns {{ size: number, count: number }[]}
 */
export function buildCoreHistogram(words) {
  /** @type {Map<number, number>} */
  const hist = new Map();

  words.forEach(word => {
    const { cores } = catalog(word);
    cores.forEach(tree => {
      const size = countPairs(tree);
      hist.set(size, (hist.get(size) ?? 0) + 1);
    });
  });

  return [...hist.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, count]) => ({ size, count }));
}

/**
 * Factor a forest into primitives and annotate each with its η-normalized core.
 *
 * @param {string} word
 * @returns {{
 *   primitive: string,
 *   primitivePairs: number,
 *   core: string,
 *   coreHash: string,
 *   corePairs: number
 * }[]}
 */
export function analyze(word) {
  return factorDyck(word).map(primitive => {
    const tree = parseTree(primitive);
    const coreTree = canonicalize(etaNormalizeTree(tree));
    return {
      primitive,
      primitivePairs: countPairs(tree),
      core: serialize(coreTree),
      coreHash: hashTree(coreTree),
      corePairs: countPairs(coreTree),
    };
  });
}

/**
 * Strip η-wrappers from a Dyck word textually by factoring, parsing, and
 * re-serializing normalized trees.
 *
 * @param {string} word
 * @returns {string}
 */
export function stripEtaText(word) {
  return factorDyck(word)
    .map(primitive => serialize(etaNormalizeTree(parseTree(primitive))))
    .join('');
}

export { generateDyck };
