/**
 * ANSI color helpers (CLI-only)
 * ----------------------------
 *
 * Colorize parentheses by depth for terminal display. Keep this module pure so
 * CLIs can opt into or out of color without affecting generators.
 */

const RESET = '\x1b[0m';
const PASTEL_COLORS = [205, 198, 165, 135, 99];

/**
 * @param {number} depth
 * @returns {string}
 */
function colorByDepth(depth) {
  const index = Math.min(depth, PASTEL_COLORS.length - 1);
  return `\x1b[38;5;${PASTEL_COLORS[index]}m`;
}

/**
 * Remove ANSI escape sequences from a string.
 *
 * @param {string} value
 * @returns {string}
 */
export function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Apply depth-based ANSI coloring to balanced parentheses.
 *
 * @param {string} value
 * @returns {string}
 */
export function colorizeParens(value) {
  let result = '';
  let depth = 0;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') {
      result += `${colorByDepth(depth)}(${RESET}`;
      depth += 1;
      continue;
    }

    if (ch === ')') {
      depth -= 1;
      result += `${colorByDepth(depth)})${RESET}`;
      continue;
    }

    result += ch;
  }

  return result;
}
