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

function normalizeOptions(overrides = {}) {
  return { ...DEFAULTS, ...overrides };
}

function validateMode(mode) {
  if (!Object.values(MODES).includes(mode)) {
    throw new Error(`Unknown collapse mode: ${mode}`);
  }
}

function ensureCountPairs(countPairs) {
  if (typeof countPairs !== 'function') {
    throw new Error('createCollapsePolicy expects a countPairs(tree) function');
  }
}

export function createCollapsePolicy(countPairs, overrides = {}) {
  ensureCountPairs(countPairs);
  const options = normalizeOptions(overrides);
  validateMode(options.mode);

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
        if (options.lighterChance > 0 && options.random() < options.lighterChance) {
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
