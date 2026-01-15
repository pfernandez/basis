/**
 * Reducer: pointer machine (all candidates)
 * ----------------------------------------
 *
 * Enumerates all locally-enabled machine events reachable from the current
 * root and exposes them as candidate kernel actions.
 */

import { collectEnabledEvents } from '../../graph/machine.js';

/**
 * @typedef {import('../actions.js').KernelAction} KernelAction
 * @typedef {import('../stepper.js').ReducerPlugin} ReducerPlugin
 */

/**
 * @returns {ReducerPlugin}
 */
export function createPointerMachineAllCandidatesReducer() {
  return {
    id: 'pointer-machine-all-candidates',
    init: () => null,
    candidates: (state, reducerState, options, hooks) => {
      const events = collectEnabledEvents(
        state.graph,
        state.rootId,
        options,
        hooks,
      );

      /** @type {KernelAction[]} */
      const actions = events.map(event => ({
        kind: 'pointer-machine',
        event,
      }));

      return { actions, reducerState };
    },
  };
}

