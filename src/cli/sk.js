#!/usr/bin/env node
/**
 * SK evaluator CLI
 * ---------------
 *
 * Runs the graph reducer against a small `(def …)`/`(defn …)` basis file
 * and optionally writes a step-by-step JSON trace for visualization/debugging.
 *
 * Usage:
 *   `node src/cli/sk.js "(I a)" "((K a) b)"`
 *   `node src/cli/sk.js --trace=src/vis/trace.json "(I a)"`
 *   `node src/cli/sk.js --no-precompile --trace=src/vis/trace.json "(I a)"`
 */

import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  loadDefinitions,
  evaluateExpression,
} from '../graph/evaluator-node.js';
import { getNode } from '../graph/graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {any} node
 * @returns {string}
 */
function describeNode(node) {
  if (!node) return '<missing>';
  if (node.kind === 'symbol') return String(node.label ?? node.id);
  if (node.kind === 'empty') return '()';
  if (node.kind === 'pair') return `pair(${node.id})`;
  if (node.kind === 'binder') return `binder(${node.id})`;
  if (node.kind === 'slot') return `slot(${node.binderId ?? '?'})`;
  return `${node.kind}(${node.id})`;
}

/**
 * Count pointer edges (`slot -> binder` and `binder -> value`).
 *
 * @param {import('../graph/graph.js').Graph} graph
 * @returns {number}
 */
function countPointerLinks(graph) {
  return graph.nodes.reduce((count, node) => {
    if (node.kind === 'slot' && typeof node.binderId === 'string') {
      return count + 1;
    }
    if (node.kind === 'binder' && typeof node.valueId === 'string') {
      return count + 1;
    }
    return count;
  }, 0);
}

/**
 * @param {string[]} argv
 * @returns {{
 *   defsPath: string,
 *   tracePath: string | null,
 *   inputs: string[],
 *   precompile: boolean
 * }}
 */
function parseArgs(argv) {
  const defsArg = argv.find(arg => arg.startsWith('--defs='));
  const traceArg = argv.find(arg => arg.startsWith('--trace='));
  const precompileArg = argv.includes('--precompile');
  const noPrecompileArg = argv.includes('--no-precompile');
  const defsPath = defsArg
    ? defsArg.slice('--defs='.length)
    : join(__dirname, '../../programs/sk-basis.lisp');
  const tracePath = traceArg ? traceArg.slice('--trace='.length) : null;
  const precompile = precompileArg
    ? true
    : noPrecompileArg
      ? false
      : Boolean(tracePath);
  const inputs = argv.filter(
    arg => !arg.startsWith('--defs=') && !arg.startsWith('--trace='),
  );
  const filteredInputs = inputs.filter(
    arg => arg !== '--precompile' && arg !== '--no-precompile',
  );
  return { defsPath, tracePath, inputs: filteredInputs, precompile };
}

/**
 * @param {{ expression: string, snapshots: object[] }[]} results
 * @param {string} tracePath
 * @returns {void}
 */
function exportTrace(results, tracePath) {
  const payload = results.map(result => ({
    expression: result.expression,
    snapshots: result.snapshots,
  }));
  writeFileSync(tracePath, JSON.stringify(payload, null, 2));
  console.log(`Trace written to ${tracePath}`);
}

/**
 * @param {string[]} argv
 * @returns {void}
 */
function main(argv) {
  const { defsPath, tracePath, inputs, precompile } = parseArgs(argv);
  const env = loadDefinitions(defsPath);
  const samples = inputs.length ? inputs : ['(I a)', '((K a) b)'];
  const evaluations = [];

  samples.forEach(exprSource => {
    try {
      const snapshots = [];
      const result = evaluateExpression(exprSource, env, {
        tracer: snapshot => snapshots.push(snapshot),
        precompile,
      });
      const focus = getNode(result.graph, result.rootId);
      evaluations.push({ expression: exprSource, snapshots });
      console.log(`Expression: ${exprSource}`);
      console.log(`  Focus: ${describeNode(focus)}`);
      console.log(
        `  Nodes: ${result.graph.nodes.length}, ` +
          `Links: ${countPointerLinks(result.graph)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to evaluate ${exprSource}: ${message}`);
    }
  });

  if (tracePath) {
    exportTrace(evaluations, tracePath);
  }
}

main(process.argv.slice(2));
