/**
 * Catalan CLI
 * -----------
 *
 * Prints small enumerations of Dyck / Catalan / Motzkin objects.
 *
 * Examples:
 * - `node src/catalan/index.js --simulation=dyck --maxN=3`
 * - `node src/catalan/index.js --simulation=pairs --spine --center`
 * - `node src/catalan/index.js --simulation=dyck --no-color > out.txt`
 */

import { dyck, motzkin, pairs } from './catalan.js';
import { colorizeParens, stripAnsi } from './colorize.js';

/**
 * @typedef {'dyck' | 'pairs' | 'motzkin'} SimulationKind
 */

/**
 * @typedef {{
 *   simulation: SimulationKind,
 *   maxN: number,
 *   centered: boolean,
 *   includeSpine: boolean,
 *   color: boolean
 * }} CliOptions
 */

/**
 * @param {string[]} argv
 * @returns {CliOptions}
 */
function parseArgs(argv) {
  const simulationArg = argv.find(arg => arg.startsWith('--simulation='));
  const maxNArg = argv.find(arg => arg.startsWith('--maxN='));
  const simulationValue = simulationArg ? simulationArg.split('=')[1] : 'dyck';
  const maxNValue = maxNArg ? Number.parseInt(maxNArg.split('=')[1], 10) : 3;

  /** @type {SimulationKind} */
  const simulation =
    simulationValue === 'pairs' || simulationValue === 'motzkin'
      ? simulationValue
      : 'dyck';

  const centered = argv.includes('--center');
  const includeSpine = argv.includes('--spine');

  const forcedColor = argv.includes('--color');
  const forcedNoColor = argv.includes('--no-color');
  const color =
    forcedColor || forcedNoColor
      ? forcedColor && !forcedNoColor
      : Boolean(process.stdout.isTTY);

  return {
    simulation,
    maxN: Number.isFinite(maxNValue) ? maxNValue : 3,
    centered,
    includeSpine,
    color,
  };
}

/**
 * @param {string} value
 * @returns {number}
 */
function visibleWidth(value) {
  return stripAnsi(value).length;
}

/**
 * @param {string} value
 * @param {number} minLength
 * @param {string} padChar
 * @returns {string}
 */
function padRight(value, minLength, padChar) {
  if (value.length >= minLength) return value;
  return value + padChar.repeat(minLength - value.length);
}

/**
 * @param {string[]} forms
 * @param {number} n
 * @param {{ centered: boolean, includeSpine: boolean }} options
 * @returns {string[]}
 */
function reorderWithSpine(forms, n, options) {
  if (!options.includeSpine) return forms;
  if (n <= 0) return forms;

  const spine = `${'('.repeat(n + 1)}${')'.repeat(n + 1)}`;
  const index = forms.indexOf(spine);
  const mid = Math.floor(forms.length / 2);

  if (options.centered) {
    if (index === mid) return forms;
    if (index === -1) {
      return [...forms.slice(0, mid), spine, ...forms.slice(mid)];
    }
    const reordered = forms.slice();
    reordered.splice(index, 1);
    reordered.splice(mid, 0, spine);
    return reordered;
  }

  if (index === 0) return forms;
  if (index === -1) return [spine, ...forms];
  const reordered = forms.slice();
  reordered.splice(index, 1);
  return [spine, ...reordered];
}

/**
 * @param {CliOptions} options
 * @returns {string[]}
 */
function buildRows(options) {
  const decorate = options.color ? colorizeParens : value => value;

  /** @type {string[]} */
  const rows = [];

  for (let n = 0; n <= options.maxN; n += 1) {
    const forms =
      options.simulation === 'pairs'
        ? pairs(n)
        : options.simulation === 'motzkin'
          ? motzkin(n)
          : dyck(n);

    const finalForms =
      options.simulation === 'dyck'
        ? forms
        : reorderWithSpine(forms, n, options);

    const prefix = padRight(`n=${n}, c=${finalForms.length}: `, 11, ' ');
    rows.push(`${prefix}${finalForms.map(decorate).join(' ')}`);
  }

  return rows;
}

/**
 * @param {string[]} rows
 * @returns {string[]}
 */
function centerRows(rows) {
  const maxWidth = Math.max(...rows.map(visibleWidth));
  return rows.map(row => {
    const padding = Math.floor((maxWidth - visibleWidth(row)) / 2);
    const split = row.split(':');
    const left = padRight(split[0] ?? '', 9, ' ');
    const right = split.slice(1).join(':');
    return `${left}${' '.repeat(Math.max(0, padding))}${right}`;
  });
}

/**
 * @param {CliOptions} options
 * @returns {void}
 */
function runCli(options) {
  const rows = buildRows(options);
  const output = options.centered ? centerRows(rows) : rows;
  output.forEach(row => console.log(row));
}

runCli(parseArgs(process.argv.slice(2)));
