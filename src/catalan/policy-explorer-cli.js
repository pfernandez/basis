#!/usr/bin/env node
/**
 * Collapse policy explorer CLI
 * ----------------------------
 *
 * Prints sample trees collapsed at the root under several heuristics.
 */

import {
  buildPolicies,
  explorePolicies,
  SAMPLE_TREES,
} from './policy-explorer.js';

/**
 * @param {ReturnType<typeof explorePolicies>} rows
 * @returns {Record<string, ReturnType<typeof explorePolicies>>}
 */
function groupRowsBySample(rows) {
  return rows.reduce((acc, row) => {
    acc[row.sample] = acc[row.sample] ?? [];
    acc[row.sample].push(row);
    return acc;
  }, /** @type {Record<string, any[]>} */ ({}));
}

/**
 * @param {ReturnType<typeof explorePolicies>} rows
 * @returns {void}
 */
function printTable(rows) {
  const groups = groupRowsBySample(rows);
  Object.entries(groups).forEach(([sample, results]) => {
    const first = results[0];
    console.log(`\n=== ${sample} (${first.inputSize} pairs) ===`);
    console.log(`Input: ${first.input}`);
    results.forEach(result => {
      const frozen = result.changed ? '' : ', frozen';
      console.log(
        `  ${result.policy.padEnd(10)} → ${result.output} ` +
          `[size=${result.outputSize}${frozen}]`,
      );
    });
  });
}

printTable(explorePolicies(SAMPLE_TREES, buildPolicies()));
