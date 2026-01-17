/**
 * Collapse policy explorer (pure)
 * -------------------------------
 *
 * Generates small example trees and applies collapse policies to their roots.
 * This module is data-only and safe to import from tests.
 */

import { createCollapsePolicy, COLLAPSE_MODES } from './collapse-policy.js';
import {
  Leaf,
  Node,
  countPairs,
  hashTree,
  serialize,
} from './dyck-tools.js';

/**
 * @typedef {import('./dyck-tools.js').Tree} Tree
 */

/**
 * @typedef {{
 *   name: string,
 *   collapse: (tree: Tree) => Tree
 * }} Policy
 */

/**
 * Small sample suite for policy comparisons.
 *
 * @type {Record<string, Tree>}
 */
export const SAMPLE_TREES = {
  I: Node(Leaf, Leaf),
  K: Node(Node(Leaf, Leaf), Leaf),
  S: Node(Node(Node(Leaf, Leaf), Leaf), Leaf),
  ZigZag: Node(Node(Leaf, Node(Leaf, Leaf)), Leaf),
  Symmetric: Node(Node(Leaf, Leaf), Node(Leaf, Leaf)),
};

/**
 * @param {Record<string, Tree>} samples
 * @param {Policy[]} policies
 * @returns {{
 *   sample: string,
 *   policy: string,
 *   input: string,
 *   output: string,
 *   inputSize: number,
 *   outputSize: number,
 *   changed: boolean
 * }[]}
 */
export function explorePolicies(samples, policies) {
  /** @type {ReturnType<typeof explorePolicies>} */
  const rows = [];

  Object.entries(samples).forEach(([label, tree]) => {
    const inputSize = countPairs(tree);
    const inputHash = hashTree(tree);
    policies.forEach(({ name, collapse }) => {
      const result = collapse(tree);
      rows.push({
        sample: label,
        policy: name,
        input: serialize(tree),
        output: serialize(result),
        inputSize,
        outputSize: countPairs(result),
        changed: hashTree(result) !== inputHash,
      });
    });
  });

  return rows;
}

/**
 * Build the standard policy set.
 *
 * @returns {Policy[]}
 */
export function buildPolicies() {
  return [
    {
      name: 'heavier',
      collapse: createCollapsePolicy(countPairs, {
        mode: COLLAPSE_MODES.HEAVIER,
      }),
    },
    {
      name: 'lighter',
      collapse: createCollapsePolicy(countPairs, {
        mode: COLLAPSE_MODES.LIGHTER,
      }),
    },
    {
      name: 'left',
      collapse: createCollapsePolicy(countPairs, {
        mode: COLLAPSE_MODES.LEFT,
      }),
    },
    {
      name: 'right',
      collapse: createCollapsePolicy(countPairs, {
        mode: COLLAPSE_MODES.RIGHT,
      }),
    },
    {
      name: 'freeze',
      collapse: createCollapsePolicy(countPairs, {
        mode: COLLAPSE_MODES.HEAVIER,
        freezeBalanced: true,
        balanceThreshold: 0,
      }),
    },
  ];
}

