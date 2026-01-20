/**
 * Kernel actions (pure state transitions)
 * --------------------------------------
 *
 * The project is exploring multiple equivalent ways to "step" computation:
 * deterministic observers, RNG-driven sampling, physics-guided scheduling, and
 * eventually pair-only rewrite systems.
 *
 * This module defines a minimal, replayable "action" surface. An action is
 * pure data. Applying an action is a pure function returning a new state.
 *
 * The initial implementation is an adapter over the pointer machine in
 * `src/graph/`. As the kernel evolves, new action kinds can be added without
 * coupling the UI or simulator to one evaluator.
 */

import { applyMachineEvent } from '../graph/machine.js';
import { compactGraph } from '../graph/compact.js';

/**
 * @typedef {{
 *   graph: import('../graph/graph.js').Graph,
 *   rootId: string
 * }} KernelState
 */

/**
 * @typedef {import('../graph/machine.js').Event} MachineEvent
 */

/**
 * @typedef {{
 *   kind: 'pointer-machine',
 *   event: MachineEvent
 * }} PointerMachineAction
 */

/**
 * @typedef {PointerMachineAction} KernelAction
 */

/**
 * Apply a kernel action.
 *
 * @param {KernelState} state
 * @param {KernelAction} action
 * @param {{
 *   reduceUnderLambdas: boolean,
 *   cloneArguments: boolean,
 *   compactGraph?: import('../graph/compact.js').GraphCompaction
 * }} options
 * @param {import('../graph/machine.js').MachineHooks} [hooks]
 * @returns {{ state: KernelState, note: string, focus: object | null }}
 */
export function applyAction(state, action, options, hooks = {}) {
  if (action.kind !== 'pointer-machine') {
    throw new Error(`Unsupported action kind: ${action.kind}`);
  }

  const stepped = applyMachineEvent(
    state.graph,
    state.rootId,
    action.event,
    options,
    hooks,
  );

  const compaction = options.compactGraph ?? 'none';
  const compacted = compactGraph(stepped.graph, stepped.rootId, {
    mode: compaction,
  });

  return {
    state: { graph: compacted.graph, rootId: compacted.rootId },
    note: stepped.note,
    focus: stepped.focus ?? null,
  };
}
