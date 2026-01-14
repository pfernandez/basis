/**
 * Reduction runner (normal-order)
 * -------------------------------
 *
 * Small orchestration helper that repeatedly applies `stepNormalOrder` until no
 * local rule applies.
 */

import { createObserver, stepNormalOrder } from './machine.js';

/**
 * @typedef {{
 *   stepIndex: number,
 *   graph: import('./graph.js').Graph,
 *   rootId: string,
 *   note?: string,
 *   focus?: object
 * }} MachineStep
 */

/**
 * Run deterministic leftmost-outermost reduction steps until no rule applies.
 *
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {{
 *   maxSteps: number,
 *   reduceUnderLambdas: boolean,
 *   cloneArguments: boolean
 * }} options
 * @param {import('./machine.js').MachineHooks} [hooks]
 * @param {((step: MachineStep) => void) | null} [onStep]
 * @returns {{ graph: import('./graph.js').Graph, rootId: string }}
 */
export function runUntilStuck(
  graph,
  rootId,
  options,
  hooks = {},
  onStep = null,
) {
  const maxSteps = options.maxSteps ?? 10_000;
  let state = { graph, rootId, observer: createObserver(rootId) };

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const stepped = stepNormalOrder(
      state.graph,
      state.rootId,
      options,
      state.observer,
      hooks,
    );

    if (!stepped.didStep) return { graph: state.graph, rootId: state.rootId };

    state = {
      graph: stepped.graph,
      rootId: stepped.rootId,
      observer: stepped.observer,
    };

    if (typeof onStep === 'function') {
      onStep({
        stepIndex,
        graph: state.graph,
        rootId: state.rootId,
        note: stepped.note,
        focus: stepped.focus,
      });
    }
  }

  throw new Error(
    `Reduction exceeded maxSteps=${maxSteps}; ` +
      'expression may be non-terminating',
  );
}

