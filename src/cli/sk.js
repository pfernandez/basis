#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { loadDefinitions, evaluateExpression } from '../graph/evaluator.js';
import { getNode } from '../graph/graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  const args = process.argv.slice(2);
  const defsArg = args.find(arg => arg.startsWith('--defs='));
  const defsPath = defsArg
    ? defsArg.slice('--defs='.length)
    : join(__dirname, '../../programs/sk-basis.lisp');
  const inputs = args.filter(arg => !arg.startsWith('--defs='));
  const env = loadDefinitions(defsPath);
  const samples = inputs.length ? inputs : ['(I a)', '((K a) b)'];

  samples.forEach(exprSource => {
    try {
      const result = evaluateExpression(exprSource, env);
      const focus = getNode(result.graph, result.rootId);
      console.log(`Expression: ${exprSource}`);
      console.log(`  Focus: ${focus.label}`);
      console.log(`  Nodes: ${result.graph.nodes.length}, Links: ${result.graph.links.length}`);
    } catch (error) {
      console.error(`Failed to evaluate ${exprSource}: ${error.message}`);
    }
  });
}

main();
