/**
 * Catalan generators
 * ------------------
 *
 * This module defines small, pure generators used by both tests and CLI tools.
 *
 * - `dyck(n)`: Dyck words of semilength `n` (balanced parens strings).
 * - `pairs(n)`: Catalan trees rendered as `(${left}${right})` with leaves `()`.
 * - `motzkin(n)`: Motzkin words (unary/binary) rendered with parentheses.
 */

/**
 * Convert a Dyck word (grammar `D := '(' D ')' D | ε`) into a full-binary tree
 * form rendered as `(${left}${right})` with leaf `()`.
 *
 * This is equivalent to `renderTree(dyckToTree(word))` in `bijection.js` but
 * lives here to avoid cyclic imports.
 *
 * @param {string} word
 * @returns {string}
 */
function dyckWordToPairsForm(word) {
  if (!word.length) return '()';
  if (word[0] !== '(') {
    throw new Error(`Invalid Dyck word: ${word}`);
  }

  let balance = 0;
  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];
    if (ch === '(') balance += 1;
    else if (ch === ')') balance -= 1;
    else throw new Error(`Invalid character: ${ch}`);

    if (balance < 0) throw new Error(`Invalid Dyck word: ${word}`);
    if (balance !== 0) continue;

    const left = word.slice(1, i);
    const right = word.slice(i + 1);
    return `(${dyckWordToPairsForm(left)}${dyckWordToPairsForm(right)})`;
  }

  throw new Error(`Invalid Dyck word: ${word}`);
}

/**
 * Enumerate Dyck words of semilength `n` in a deterministic backtracking order.
 *
 * @param {number} n
 * @returns {string[]}
 */
export function dyck(n) {
  /** @type {string[]} */
  const result = [];

  /**
   * @param {string} current
   * @param {number} openCount
   * @param {number} closeCount
   * @returns {void}
   */
  function backtrack(current, openCount, closeCount) {
    if (current.length === 2 * n) {
      result.push(current);
      return;
    }

    if (openCount < n) {
      backtrack(`${current}(`, openCount + 1, closeCount);
    }

    if (closeCount < openCount) {
      backtrack(`${current})`, openCount, closeCount + 1);
    }
  }

  backtrack('', 0, 0);
  return result;
}

/**
 * Enumerate Catalan trees (full binary trees) of size `n` by mapping each Dyck
 * word through the canonical `D := '(' D ')' D | ε` parse.
 *
 * This ensures the enumeration order matches `dyck(n)` under the bijection.
 *
 * @param {number} n
 * @returns {string[]}
 */
export function pairs(n) {
  return dyck(n).map(dyckWordToPairsForm);
}

/**
 * Enumerate Motzkin words of size `n`.
 *
 * Representation:
 * - leaf: `()`
 * - unary node: `(${child})`
 * - binary node: `(${left}${right})`
 *
 * The size parameter counts "pairs minus one" so that:
 * - `n=0` → `()`
 * - `n=1` → `(())`
 * - `n=2` → `((()))`, `(()())`
 *
 * @param {number} n
 * @returns {string[]}
 */
export function motzkin(n) {
  if (n === 0) return ['()'];

  /** @type {string[]} */
  const out = [];

  for (const s of motzkin(n - 1)) {
    out.push(`(${s})`);
  }

  for (let i = 0; i <= n - 2; i += 1) {
    const j = n - 2 - i;
    for (const a of motzkin(i)) {
      for (const b of motzkin(j)) {
        out.push(`(${a}${b})`);
      }
    }
  }

  return out;
}
