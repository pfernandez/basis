/**
 * Kernel stepper (reducers + schedulers)
 * -------------------------------------
 *
 * The kernel exposes:
 * - `ReducerPlugin`: proposes candidate `KernelAction`s for the current state.
 * - `SchedulerPlugin`: chooses one action (possibly using external context).
 *
 * This keeps the observer/reducer pure while allowing different stepping
 * policies (deterministic, RNG, physics-guided) without entangling view or
 * simulation code with evaluator internals.
 */

import { applyAction } from './actions.js';

/**
 * @typedef {import('./actions.js').KernelState} KernelState
 * @typedef {import('./actions.js').KernelAction} KernelAction
 */

/**
 * @typedef {{
 *   maxSteps?: number,
 *   reduceUnderLambdas: boolean,
 *   cloneArguments: boolean
 * }} StepOptions
 */

/**
 * @typedef {{
 *   reducerState: any,
 *   schedulerState: any
 * }} StepperState
 */

/**
 * @typedef {{
 *   id: string,
 *   init: (
 *     state: KernelState,
 *     options: StepOptions,
 *     hooks: object
 *   ) => any,
 *   candidates: (
 *     state: KernelState,
 *     reducerState: any,
 *     options: StepOptions,
 *     hooks: object
 *   ) => { actions: KernelAction[], reducerState: any },
 *   afterApply?: (
 *     state: KernelState,
 *     reducerState: any,
 *     action: KernelAction,
 *     result: { state: KernelState, note: string, focus: object | null },
 *     options: StepOptions,
 *     hooks: object
 *   ) => any
 * }} ReducerPlugin
 */

/**
 * @typedef {{
 *   id: string,
 *   init?: (options: StepOptions) => any,
 *   choose: (
 *     actions: KernelAction[],
 *     context: object | null,
 *     state: KernelState,
 *     schedulerState: any
 *   ) => { action: KernelAction | null, schedulerState: any }
 * }} SchedulerPlugin
 */

/**
 * @typedef {{
 *   didStep: boolean,
 *   state: KernelState,
 *   stepperState: StepperState,
 *   note?: string,
 *   focus?: object | null,
 *   action?: KernelAction
 * }} StepResult
 */

/**
 * @param {{
 *   reducer: ReducerPlugin,
 *   scheduler: SchedulerPlugin,
 *   hooks?: object
 * }} config
 * @returns {{
 *   init: (state: KernelState, options: StepOptions) => StepperState,
 *   step: (
 *     state: KernelState,
 *     stepperState: StepperState,
 *     options: StepOptions,
 *     context?: object | null
 *   ) => StepResult
 * }}
 */
export function createKernelStepper(config) {
  const hooks = config.hooks ?? {};
  const reducer = config.reducer;
  const scheduler = config.scheduler;

  return {
    init: (state, options) => ({
      reducerState: reducer.init(state, options, hooks),
      schedulerState:
        typeof scheduler.init === 'function' ? scheduler.init(options) : null,
    }),
    step: (state, stepperState, options, context = null) => {
      const proposed = reducer.candidates(
        state,
        stepperState.reducerState,
        options,
        hooks,
      );

      const choice = scheduler.choose(
        proposed.actions,
        context,
        state,
        stepperState.schedulerState,
      );

      const action = choice.action;
      const nextSchedulerState = choice.schedulerState;
      if (!action) {
        return {
          didStep: false,
          state,
          stepperState: {
            reducerState: proposed.reducerState,
            schedulerState: nextSchedulerState,
          },
        };
      }

      const applied = applyAction(state, action, options, hooks);
      const nextReducerState =
        typeof reducer.afterApply === 'function'
          ? reducer.afterApply(
              applied.state,
              proposed.reducerState,
              action,
              applied,
              options,
              hooks,
            )
          : proposed.reducerState;

      return {
        didStep: true,
        action,
        note: applied.note,
        focus: applied.focus ?? null,
        state: applied.state,
        stepperState: {
          reducerState: nextReducerState,
          schedulerState: nextSchedulerState,
        },
      };
    },
  };
}

