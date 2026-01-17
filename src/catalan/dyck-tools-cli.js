#!/usr/bin/env node
/**
 * Dyck tools CLI
 * -------------
 *
 * Small interactive demo for the `src/catalan/dyck-tools.js` helpers.
 */

import {
  analyze,
  buildCoreHistogram,
  generateDyck,
  stripEtaText,
} from './dyck-tools.js';

/**
 * @param {string[]} argv
 * @returns {{ maxN: number, samples: string[] }}
 */
function parseArgs(argv) {
  const maxNArg = argv.find(arg => arg.startsWith('--maxN='));
  const maxNValue = maxNArg ? Number.parseInt(maxNArg.split('=')[1], 10) : 3;
  const maxN = Number.isFinite(maxNValue) ? maxNValue : 3;

  const samples = argv.filter(arg => !arg.startsWith('--maxN='));
  return { maxN, samples };
}

/**
 * @param {{ maxN: number, samples: string[] }} options
 * @returns {void}
 */
function runCli(options) {
  const samples = options.samples.length
    ? options.samples
    : [
        '()',
        '(())',
        '((()))(()())',
        '()()()',
        '(()(()))',
        '(()()()(()()()()))',
      ];

  console.log('=== Analyze (primitive → core) ===');
  samples.forEach(word => {
    const rows = analyze(word);
    console.log(`Dyck: ${word}`);
    rows.forEach((row, index) => {
      console.log(
        `  block ${index + 1}: primitive=${row.primitive} ` +
          `[pairs=${row.primitivePairs}] => core=${row.core} ` +
          `[pairs=${row.corePairs}] (hash=${row.coreHash})`,
      );
    });
  });

  console.log(`\n=== Catalan histogram of cores (n<=${options.maxN}) ===`);
  /** @type {string[]} */
  const words = [];
  for (let n = 0; n <= options.maxN; n += 1) {
    words.push(...generateDyck(n));
  }
  buildCoreHistogram(words).forEach(({ size, count }) => {
    console.log(`size=${size}  count=${count}`);
  });

  console.log('\n=== η-strip examples ===');
  const demo = ['(()())', '(()(()()))', '((()())())'];
  demo.forEach(word => {
    console.log(`${word} -> ${stripEtaText(word)}`);
  });
}

runCli(parseArgs(process.argv.slice(2)));

