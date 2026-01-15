/**
 * Scheduler: choose the first candidate.
 */

/**
 * @typedef {import('../stepper.js').SchedulerPlugin} SchedulerPlugin
 */

/**
 * @returns {SchedulerPlugin}
 */
export function createFirstScheduler() {
  return {
    id: 'first',
    choose: (actions, _context, _state, schedulerState) => ({
      action: actions[0] ?? null,
      schedulerState,
    }),
  };
}

