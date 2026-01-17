/**
 * Motif discovery (pure)
 * ----------------------
 *
 * Stochastic exploration of local-collapse dynamics on small primitive Dyck
 * words, with optional η-normalization and collapse-policy selection.
 *
 * This is intentionally an experiment harness. Keep it pure so it can be used
 * from tests or other drivers (CLI, notebook-style scripts, etc.).
 */

import { dyck } from './catalan.js';
import { createCollapsePolicy } from './collapse-policy.js';
import {
  Leaf,
  Node,
  countPairs,
  etaNormalizeTree,
  hashTree,
  parseTree,
} from './dyck-tools.js';

/**
 * @typedef {import('./dyck-tools.js').Tree} Tree
 */

/**
 * @typedef {{
 *   maxN: number,
 *   runsPerTree: number,
 *   maxSteps: number,
 *   minMotifSize: number,
 *   useEta: boolean,
 *   freezeBalanced: boolean,
 *   policyMode: string,
 *   eps: number,
 *   random: () => number
 * }} DiscoverOptions
 */

/**
 * @type {DiscoverOptions}
 */
export const DEFAULT_DISCOVER_OPTIONS = {
  maxN: 9,
  runsPerTree: 1_000,
  maxSteps: 10_000,
  minMotifSize: 0,
  useEta: true,
  freezeBalanced: false,
  policyMode: 'heavier',
  eps: 1,
  random: Math.random,
};

/**
 * @param {Partial<DiscoverOptions>} overrides
 * @returns {DiscoverOptions}
 */
function normalizeOptions(overrides) {
  return { ...DEFAULT_DISCOVER_OPTIONS, ...(overrides ?? {}) };
}

/**
 * Primitive = never hits balance 0 before the end.
 *
 * @param {string} word
 * @returns {boolean}
 */
export function isPrimitiveDyck(word) {
  if (!word.length) return false;
  let balance = 0;
  for (let i = 0; i < word.length; i += 1) {
    balance += word[i] === '(' ? 1 : -1;
    if (balance === 0 && i !== word.length - 1) return false;
  }
  return balance === 0;
}

/**
 * Collect collapse candidates (redexes) as paths into the tree.
 *
 * @param {Tree} tree
 * @param {number} minMotifSize
 * @param {string[]} [path]
 * @param {{ path: string[], size: number }[]} [acc]
 * @returns {{ path: string[], size: number }[]}
 */
function collectRedexes(
  tree,
  minMotifSize,
  path = [],
  acc = [],
) {
  if (tree === Leaf) return acc;
  const size = countPairs(tree);
  if (size > minMotifSize) acc.push({ path: path.slice(), size });
  collectRedexes(tree.L, minMotifSize, [...path, 'L'], acc);
  collectRedexes(tree.R, minMotifSize, [...path, 'R'], acc);
  return acc;
}

/**
 * @param {Tree} tree
 * @param {string[]} path
 * @returns {Tree}
 */
function getByPath(tree, path) {
  let current = tree;
  path.forEach(dir => {
    current = dir === 'L' ? current.L : current.R;
  });
  return current;
}

/**
 * @param {Tree} tree
 * @param {string[]} path
 * @param {Tree} replacement
 * @returns {Tree}
 */
function setByPath(tree, path, replacement) {
  if (!path.length) return replacement;
  const [dir, ...rest] = path;
  if (dir === 'L') {
    return Node(setByPath(tree.L, rest, replacement), tree.R);
  }
  return Node(tree.L, setByPath(tree.R, rest, replacement));
}

/**
 * Choose a random element from a list.
 *
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T}
 */
function chooseOne(list, random) {
  const index = Math.floor(random() * list.length);
  return list[index];
}

/**
 * One ε-greedy deepest-first collapse step.
 *
 * @param {Tree} tree
 * @param {{
 *   minMotifSize: number,
 *   eps: number,
 *   random: () => number,
 *   collapse: (node: Tree) => Tree
 * }} options
 * @returns {{ tree: Tree, done: boolean }}
 */
function randomCollapseStep(tree, options) {
  const redexes = collectRedexes(tree, options.minMotifSize);
  if (!redexes.length) return { tree, done: true };

  const explore = options.random() < options.eps;
  const choicePath = explore
    ? chooseOne(redexes, options.random).path
    : (() => {
        const maxDepth = redexes.reduce(
          (max, redex) => Math.max(max, redex.path.length),
          0,
        );
        const deepest = redexes.filter(r => r.path.length === maxDepth);
        return chooseOne(deepest, options.random).path;
      })();

  const sub = getByPath(tree, choicePath);
  if (countPairs(sub) <= options.minMotifSize) {
    return { tree, done: true };
  }

  const collapsed = options.collapse(sub);
  const done = collapsed === sub;
  return { tree: setByPath(tree, choicePath, collapsed), done };
}

/**
 * Run stochastic collapse until no redex is available or `maxSteps` is reached.
 *
 * @param {Tree} start
 * @param {{
 *   maxSteps: number,
 *   minMotifSize: number,
 *   eps: number,
 *   random: () => number,
 *   collapse: (node: Tree) => Tree
 * }} options
 * @returns {Tree}
 */
function runStochastic(start, options) {
  let current = start;
  for (let step = 0; step < options.maxSteps; step += 1) {
    const { tree, done } = randomCollapseStep(current, options);
    current = tree;
    if (done) break;
  }
  return current;
}

/**
 * Discover frequently visited motifs by running collapse dynamics from many
 * initial trees.
 *
 * @param {Partial<DiscoverOptions>} [overrides]
 * @returns {{
 *   motifs: { hash: string, count: number, size: number }[],
 *   startCounts: Map<string, number>
 * }}
 */
export function discoverMotifs(overrides = {}) {
  const options = normalizeOptions(overrides);
  const collapse = createCollapsePolicy(countPairs, {
    mode: options.policyMode,
    freezeBalanced: options.freezeBalanced,
  });

  /** @type {Map<string, { count: number, size: number }>} */
  const visitCounts = new Map();

  /** @type {Map<string, number>} */
  const startCounts = new Map();

  for (let n = 1; n <= options.maxN; n += 1) {
    const words = dyck(n).filter(isPrimitiveDyck);
    words.forEach(word => {
      let core = parseTree(word);
      if (options.useEta) core = etaNormalizeTree(core);

      const coreHash = hashTree(core);
      startCounts.set(coreHash, (startCounts.get(coreHash) ?? 0) + 1);

      for (let run = 0; run < options.runsPerTree; run += 1) {
        const end = runStochastic(core, {
          maxSteps: options.maxSteps,
          minMotifSize: options.minMotifSize,
          eps: options.eps,
          random: options.random,
          collapse,
        });
        const hash = hashTree(end);
        const size = countPairs(end);
        const prev = visitCounts.get(hash);
        if (prev) {
          prev.count += 1;
        } else {
          visitCounts.set(hash, { count: 1, size });
        }
      }
    });
  }

  const motifs = [...visitCounts.entries()]
    .map(([hash, value]) => ({
      hash,
      count: value.count,
      size: value.size,
    }))
    .sort((a, b) => b.count - a.count);

  return { motifs, startCounts };
}

