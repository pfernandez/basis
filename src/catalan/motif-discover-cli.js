#!/usr/bin/env node
/**
 * Motif discovery CLI
 * ------------------
 *
 * Runs stochastic local-collapse dynamics and prints frequently visited end
 * states ("motifs").
 */

import { discoverMotifs } from './motif-discover.js';

/**
 * @param {string} mode
 * @returns {import('./motif-discover.js').CollapseMode}
 */
function parsePolicyMode(mode) {
  if (
    mode === 'heavier' ||
    mode === 'lighter' ||
    mode === 'left' ||
    mode === 'right'
  ) {
    return mode;
  }
  throw new Error(`Unknown policy mode: ${mode}`);
}

/**
 * @param {string[]} argv
 * @returns {import('./motif-discover.js').DiscoverOptions}
 */
function parseArgs(argv) {
  const maxNArg = argv.find(arg => arg.startsWith('--maxN='));
  const runsArg = argv.find(arg => arg.startsWith('--runs='));
  const maxStepsArg = argv.find(arg => arg.startsWith('--maxSteps='));
  const minSizeArg = argv.find(arg => arg.startsWith('--minSize='));
  const epsArg = argv.find(arg => arg.startsWith('--eps='));
  const policyArg = argv.find(arg => arg.startsWith('--policy='));

  const maxN = maxNArg ? Number.parseInt(maxNArg.split('=')[1], 10) : 9;
  const runsPerTree = runsArg
    ? Number.parseInt(runsArg.split('=')[1], 10)
    : 1000;
  const maxSteps = maxStepsArg
    ? Number.parseInt(maxStepsArg.split('=')[1], 10)
    : 10000;
  const minMotifSize = minSizeArg
    ? Number.parseInt(minSizeArg.split('=')[1], 10)
    : 0;
  const eps = epsArg ? Number.parseFloat(epsArg.split('=')[1]) : 1;
  const policyMode = parsePolicyMode(
    policyArg ? policyArg.split('=')[1] : 'heavier',
  );

  return {
    maxN: Number.isFinite(maxN) ? maxN : 9,
    runsPerTree: Number.isFinite(runsPerTree) ? runsPerTree : 1000,
    maxSteps: Number.isFinite(maxSteps) ? maxSteps : 10000,
    minMotifSize: Number.isFinite(minMotifSize) ? minMotifSize : 0,
    useEta: !argv.includes('--no-eta'),
    freezeBalanced: argv.includes('--freeze-balanced'),
    policyMode,
    eps: Number.isFinite(eps) ? eps : 1,
    random: Math.random,
  };
}

/**
 * @param {import('./motif-discover.js').DiscoverOptions} options
 * @returns {void}
 */
function runCli(options) {
  const { motifs, startCounts } = discoverMotifs(options);

  console.log(
    '=== Start cores (primitive only, ' +
      `η-normalized=${options.useEta}, ` +
      `freezeBalanced=${options.freezeBalanced}, ` +
      `policy=${options.policyMode}) ===`,
  );

  startCounts.forEach((count, hash) => {
    console.log(`${hash}  starts=${count}`);
  });

  console.log('\n=== Discovered motifs (by visit frequency) ===');
  motifs.slice(0, 30).forEach(motif => {
    console.log(`${motif.hash}  visits=${motif.count}  size=${motif.size}`);
  });

  console.log(
    '\nFlags:\n' +
      '  --no-eta           disable (() x) -> x pre-collapse\n' +
      '  --freeze-balanced  stop collapsing when |L|-|R| <= 1\n' +
      '  --policy=<mode>    heavier | lighter | left | right\n' +
      '  --maxN=<n>         maximum semilength to sample\n' +
      '  --runs=<n>         runs per starting tree\n' +
      '  --maxSteps=<n>     step limit per run\n' +
      '  --minSize=<n>      minimum size to consider as a redex\n' +
      '  --eps=<p>          ε-greedy explore probability\n',
  );
}

runCli(parseArgs(process.argv.slice(2)));
