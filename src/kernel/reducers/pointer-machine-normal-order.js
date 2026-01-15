/**
 * Reducer: pointer machine (normal order)
 * --------------------------------------
 *
 * Adapter that turns the existing pointer-machine observer into a reducer
 * plugin producing `KernelAction`s.
 */

import { createObserver, observeNormalOrder } from '../../graph/machine.js';

/**
 * @typedef {import('../actions.js').KernelAction} KernelAction
 * @typedef {import('../stepper.js').ReducerPlugin} ReducerPlugin
 */

/**
 * @returns {ReducerPlugin}
 */
export function createPointerMachineNormalOrderReducer() {
  return {
    id: 'pointer-machine-normal-order',
    init: state => ({
      observer: createObserver(state.rootId),
    }),
    candidates: (state, reducerState, options, hooks) => {
      const observer =
        reducerState?.observer?.rootId === state.rootId
          ? reducerState.observer
          : createObserver(state.rootId);

      const observed = observeNormalOrder(
        observer,
        state.graph,
        options,
        hooks,
      );
      if (!observed.event) {
        return { actions: [], reducerState: { observer: observed.observer } };
      }

      /** @type {KernelAction} */
      const action = {
        kind: 'pointer-machine',
        event: observed.event,
      };

      return {
        actions: [action],
        reducerState: { observer: observed.observer },
      };
    },
    afterApply: state => ({ observer: createObserver(state.rootId) }),
  };
}
