#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { createCollapsePolicy, COLLAPSE_MODES } from './collapse-policy.js';
import { serialize, hashTree, countPairs as countDyckPairs, Node, Leaf } from './dyck-tools.js';

/*
 * Collapse policy explorer
 * ------------------------
 * This utility runs a handful of small Dyck trees through different collapse
 * policies so we can inspect how each heuristic behaves. It keeps the logic
 * data-only: no stochastic collapse traversal, just a single collapse decision
 * at each root so the reader can compare the output trees.
 */

const SAMPLE_TREES = {
  I: Node(Leaf, Leaf),
  K: Node(Node(Leaf, Leaf), Leaf),
  S: Node(Node(Node(Leaf, Leaf), Leaf), Leaf),
  ZigZag: Node(Node(Leaf, Node(Leaf, Leaf)), Leaf),
  Symmetric: Node(Node(Leaf, Leaf), Node(Leaf, Leaf)),
};

function formatTree(tree) {
  return serialize(tree);
}

function explorePolicies(samples, policies) {
  const rows = [];
  Object.entries(samples).forEach(([label, tree]) => {
    const inputSize = countDyckPairs(tree);
    const baseHash = hashTree(tree);
    policies.forEach(({ name, collapse }) => {
      const result = collapse(tree);
      const size = result ? countDyckPairs(result) : 0;
      rows.push({
        sample: label,
        policy: name,
        input: formatTree(tree),
        output: result ? formatTree(result) : '()',
        inputSize,
        outputSize: size,
        changed: hashTree(result) !== baseHash,
      });
    });
  });
  return rows;
}

function printTable(rows) {
  const group = rows.reduce((acc, row) => {
    acc[row.sample] = acc[row.sample] || [];
    acc[row.sample].push(row);
    return acc;
  }, {});

  Object.entries(group).forEach(([sample, results]) => {
    console.log(`\n=== ${sample} (${results[0].inputSize} pairs) ===`);
    console.log(`Input: ${results[0].input}`);
    results.forEach(({ policy, output, outputSize, changed }) => {
      console.log(`  ${policy.padEnd(10)} → ${output}  [size=${outputSize}${changed ? '' : ', frozen'}]`);
    });
  });
}

function buildPolicies() {
  return [
    { name: 'heavier', collapse: createCollapsePolicy(countDyckPairs, { mode: COLLAPSE_MODES.HEAVIER }) },
    { name: 'lighter', collapse: createCollapsePolicy(countDyckPairs, { mode: COLLAPSE_MODES.LIGHTER }) },
    { name: 'left', collapse: createCollapsePolicy(countDyckPairs, { mode: COLLAPSE_MODES.LEFT }) },
    { name: 'right', collapse: createCollapsePolicy(countDyckPairs, { mode: COLLAPSE_MODES.RIGHT }) },
    { name: 'freeze', collapse: createCollapsePolicy(countDyckPairs, { mode: COLLAPSE_MODES.HEAVIER, freezeBalanced: true, balanceThreshold: 0 }) },
  ];
}

function runCli() {
  const policies = buildPolicies();
  const rows = explorePolicies(SAMPLE_TREES, policies);
  printTable(rows);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runCli();
}

export { explorePolicies, buildPolicies, SAMPLE_TREES };
