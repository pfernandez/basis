/**
 * Collapse policy helpers
 * -----------------------
 * A collapse policy decides, for any internal node, which child subtree
 * survives when we perform a local reduction. This file keeps the heuristics
 * in one place so that experiments (heavier-vs-lighter, left/right forcing,
 * freezing near-balanced nodes, etc.) can be toggled without rewriting the
 * traversal logic in other modules.
 */

const MODES = Object.freeze({
  HEAVIER: 'heavier',
  LIGHTER: 'lighter',
  LEFT: 'left',
  RIGHT: 'right',
});

const DEFAULTS = {
  mode: MODES.HEAVIER,
  freezeBalanced: false,
  balanceThreshold: 1,
  lighterChance: 0.05,
  random: Math.random,
};

/**
 * @typedef {'heavier' | 'lighter' | 'left' | 'right'} CollapseMode
 */

/**
 * @typedef {{
 *   mode: CollapseMode,
 *   freezeBalanced: boolean,
 *   balanceThreshold: number,
 *   lighterChance: number,
 *   random: () => number
 * }} CollapsePolicyOptions
 */

/**
 * @param {Partial<CollapsePolicyOptions>} overrides
 * @returns {CollapsePolicyOptions}
 */
function normalizeOptions(overrides = {}) {
  return { ...DEFAULTS, ...overrides };
}

/**
 * @param {CollapseMode} mode
 * @returns {void}
 */
function validateMode(mode) {
  if (!Object.values(MODES).includes(mode)) {
    throw new Error(`Unknown collapse mode: ${mode}`);
  }
}

/**
 * @param {unknown} countPairs
 * @returns {void}
 */
function ensureCountPairs(countPairs) {
  if (typeof countPairs !== 'function') {
    throw new Error(
      'createCollapsePolicy expects a countPairs(tree) function',
    );
  }
}

/**
 * Create a policy function that selects the subtree to keep at a node.
 *
 * The policy never mutates its input; it returns an existing subtree reference
 * or the original node (when frozen).
 *
 * @param {(tree: any) => number} countPairs
 * @param {Partial<CollapsePolicyOptions>} [overrides]
 * @returns {(node: any) => any}
 */
export function createCollapsePolicy(countPairs, overrides = {}) {
  ensureCountPairs(countPairs);
  const options = normalizeOptions(overrides);
  validateMode(options.mode);

  /**
   * @param {any} node
   * @returns {any}
   */
  return function collapseNode(node) {
    if (!node) return null;
    const left = node.L ?? null;
    const right = node.R ?? null;

    const leftSize = countPairs(left);
    const rightSize = countPairs(right);

    if (
      options.freezeBalanced &&
      Math.abs(leftSize - rightSize) <= options.balanceThreshold
    ) {
      return node;
    }

    const heavierIsLeft = leftSize >= rightSize;
    const heavier = heavierIsLeft ? left : right;
    const lighter = heavierIsLeft ? right : left;

    switch (options.mode) {
      case MODES.LEFT:
        return left;
      case MODES.RIGHT:
        return right;
      case MODES.LIGHTER:
        return lighter;
      case MODES.HEAVIER: {
        if (
          options.lighterChance > 0 &&
          options.random() < options.lighterChance
        ) {
          return lighter;
        }
        return heavier;
      }
      default:
        throw new Error(`Unsupported collapse mode: ${options.mode}`);
    }
  };
}

export { MODES as COLLAPSE_MODES };
