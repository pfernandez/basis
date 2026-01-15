/**
 * Scheduler: seeded RNG
 * --------------------
 *
 * Deterministically chooses a random action from the candidate set using an
 * explicit 32-bit seed threaded through `schedulerState`.
 */

/**
 * @typedef {import('../stepper.js').SchedulerPlugin} SchedulerPlugin
 */

/**
 * @param {number} value
 * @returns {number}
 */
function toUint32(value) {
  return Number.isFinite(value) ? value >>> 0 : 0;
}

/**
 * One step of the Mulberry32 PRNG.
 *
 * @param {number} state
 * @returns {{ value: number, state: number }}
 */
function mulberry32Step(state) {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let x = nextState;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  const value = (x ^ (x >>> 14)) >>> 0;
  return { value, state: nextState };
}

/**
 * @param {number} seed
 * @returns {SchedulerPlugin}
 */
export function createSeededRngScheduler(seed) {
  const initialState = toUint32(seed);
  return {
    id: 'seeded-rng',
    init: () => initialState,
    choose: (actions, _context, _state, schedulerState) => {
      if (!actions.length) {
        return { action: null, schedulerState };
      }

      const current =
        typeof schedulerState === 'number' ? schedulerState : initialState;
      const stepped = mulberry32Step(current);
      const index = stepped.value % actions.length;
      return {
        action: actions[index] ?? null,
        schedulerState: stepped.state,
      };
    },
  };
}

