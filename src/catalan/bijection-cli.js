#!/usr/bin/env node
/**
 * Bijection CLI
 * ------------
 *
 * Prints small tables showing:
 * - Dyck words ↔ Catalan tree renderings
 * - Motzkin words ↦ embedded Catalan trees
 */

import {
  dyckToTree,
  generateCatalanTrees,
  generateDyckWords,
  generateMotzkinWords,
  motzkinToTree,
  motzkinTreeToCatalanTree,
  renderMotzkinTree,
  renderTree,
} from './bijection.js';

/**
 * @param {import('./bijection.js').MotzkinTree} tree
 * @returns {string}
 */
function describeMotzkinTree(tree) {
  if (tree === null) return '•';
  if (tree.kind === 'unary') {
    return `U(${describeMotzkinTree(tree.child)})`;
  }
  if (tree.kind === 'binary') {
    return `B(${describeMotzkinTree(tree.left)}, ${describeMotzkinTree(
      tree.right,
    )})`;
  }
  throw new Error('Unknown Motzkin node');
}

/**
 * @param {string[]} argv
 * @returns {{ maxN: number }}
 */
function parseArgs(argv) {
  const maxNArg = argv.find(arg => arg.startsWith('--maxN='));
  const maxNValue = maxNArg ? Number.parseInt(maxNArg.split('=')[1], 10) : 4;
  return { maxN: Number.isFinite(maxNValue) ? maxNValue : 4 };
}

/**
 * @param {{ maxN: number }} options
 * @returns {void}
 */
function runCli(options) {
  for (let n = 0; n <= options.maxN; n += 1) {
    const dyckWords = generateDyckWords(n);
    const catalanTrees = generateCatalanTrees(n);
    const motzkinWords = generateMotzkinWords(n);

    console.log(`\n=== n = ${n} ===`);
    console.log(`Dyck words (C${n} = ${dyckWords.length}):`);
    console.log(dyckWords.join(', '));

    console.log(`Catalan trees (C${n} = ${catalanTrees.length}):`);
    console.log(catalanTrees.join(', '));

    console.log('Bijection (Dyck → Tree):');
    dyckWords.forEach((word, index) => {
      const tree = dyckToTree(word);
      const rendered = renderTree(tree);
      console.log(`  [${index}] ${word} → ${rendered}`);
    });

    console.log(`Motzkin words (M${n} = ${motzkinWords.length}):`);
    console.log(motzkinWords.join(', '));

    console.log('Bijection (Motzkin → Tree):');
    motzkinWords.forEach((word, index) => {
      const tree = motzkinToTree(word);
      const roundTrip = renderMotzkinTree(tree);
      const catalan = renderTree(motzkinTreeToCatalanTree(tree));
      const desc = describeMotzkinTree(tree);
      console.log(`  [${index}] ${roundTrip} → ${catalan}  [${desc}]`);
    });
  }
}

runCli(parseArgs(process.argv.slice(2)));

