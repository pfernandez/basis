#!/usr/bin/env node
/**
 * SK evaluator CLI
 * ---------------
 *
 * Runs the graph reducer against a small `(def …)`/`(defn …)` basis file and
 * optionally writes a trace for `src/vis/viewer.js` to render.
 *
 * Usage:
 *   `node src/cli/sk.js "(I a)" "((K a) b)"`
 *   `node src/cli/sk.js --trace=src/vis/trace.json "(I a)"`
 */

import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import { loadDefinitions, evaluateExpression } from '../graph/evaluator.js';
import { getNode } from '../graph/graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function countPointerLinks(graph) {
  return graph.nodes.reduce((count, node) => {
    if (node.kind === 'slot' && typeof node.binderId === 'string') return count + 1;
    if (node.kind === 'binder' && typeof node.valueId === 'string') return count + 1;
    return count;
  }, 0);
}

function parseArgs(argv) {
  const defsArg = argv.find(arg => arg.startsWith('--defs='));
  const traceArg = argv.find(arg => arg.startsWith('--trace='));
  const defsPath = defsArg
    ? defsArg.slice('--defs='.length)
    : join(__dirname, '../../programs/sk-basis.lisp');
  const tracePath = traceArg ? traceArg.slice('--trace='.length) : null;
  const inputs = argv.filter(arg => !arg.startsWith('--defs=') && !arg.startsWith('--trace='));
  return { defsPath, tracePath, inputs };
}

function exportTrace(results, tracePath) {
  const payload = results.map(result => ({
    expression: result.expression,
    snapshots: result.snapshots,
  }));
  writeFileSync(tracePath, JSON.stringify(payload, null, 2));
  console.log(`Trace written to ${tracePath}`);
}

function main() {
  const { defsPath, tracePath, inputs } = parseArgs(process.argv.slice(2));
  const env = loadDefinitions(defsPath);
  const samples = inputs.length ? inputs : ['(I a)', '((K a) b)'];
  const evaluations = [];

  samples.forEach(exprSource => {
    try {
      const snapshots = [];
      const result = evaluateExpression(exprSource, env, {
        tracer: snapshot => snapshots.push(snapshot),
      });
      const focus = getNode(result.graph, result.rootId);
      evaluations.push({ expression: exprSource, snapshots });
      console.log(`Expression: ${exprSource}`);
      console.log(`  Focus: ${focus.label}`);
      console.log(`  Nodes: ${result.graph.nodes.length}, Links: ${countPointerLinks(result.graph)}`);
    } catch (error) {
      console.error(`Failed to evaluate ${exprSource}: ${error.message}`);
    }
  });

  if (tracePath) {
    exportTrace(evaluations, tracePath);
  }
}

main();
