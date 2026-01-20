/**
 * Domain: visualizer stepping session
 * ----------------------------------
 *
 * This module is pure: it compiles an expression into the pointer-machine
 * substrate and provides immutable "step forward/back" transitions that carry
 * enough state to support alternative reducers and schedulers.
 */

import { parseSexpr } from '../../graph/parser.js';
import { createGraph } from '../../graph/graph.js';
import { buildGraphFromSexpr } from '../../graph/compile.js';
import { buildGraphInlinedFromSexpr } from '../../graph/precompile.js';
import { parseDefinitionsSource } from '../../graph/definitions.js';
import { serializeGraph } from '../../graph/serializer.js';
import { snapshotFromGraph } from '../../graph/trace.js';

import { createKernelStepper } from '../../kernel/stepper.js';
import {
  createPointerMachineNormalOrderReducer,
} from '../../kernel/reducers/pointer-machine-normal-order.js';
import {
  createPointerMachineAllCandidatesReducer,
} from '../../kernel/reducers/pointer-machine-all-candidates.js';
import { createFirstScheduler } from '../../kernel/schedulers/first.js';
import {
  createSeededRngScheduler,
} from '../../kernel/schedulers/seeded-rng.js';

import { graphologyFromSnapshot } from './snapshot.js';

/**
 * @typedef {import('../../kernel/actions.js').KernelState} KernelState
 * @typedef {import('../../kernel/actions.js').KernelAction} KernelAction
 * @typedef {import('../../kernel/stepper.js').StepperState} StepperState
 */

/**
 * @typedef {{
 *   graph: import('graphology').MultiDirectedGraph,
 *   rootId: string,
 *   note: string,
 *   expr: string,
 *   stepIndex: number
 * }} VisState
 */

/**
 * @typedef {{
 *   name: string,
 *   options: import('../../kernel/stepper.js').StepOptions
 * }} Phase
 */

/**
 * @typedef {{
 *   kernel: KernelState,
 *   action: KernelAction | null,
 *   stepperState: StepperState,
 *   decision: import('../../kernel/stepper.js').StepDecision | null,
 *   phaseIndex: number,
 *   state: VisState
 * }} Frame
 */

/**
 * @typedef {'normal-order' | 'multiway-rng'} SessionMode
 */

/**
 * @typedef {{
 *   sourceExpr: string,
 *   programSource: string,
 *   hooks: object,
 *   mode: SessionMode,
 *   compactGraph: import('../../graph/compact.js').GraphCompaction,
 *   seed: number | null,
 *   reducerId: string,
 *   schedulerId: string,
 *   phases: Phase[],
 *   frames: Frame[],
 *   index: number,
 *   complete: boolean,
 *   maxSteps: number,
 *   stepper: ReturnType<typeof createKernelStepper>
 * }} VisSession
 */

/**
 * @param {Map<string, any>} env
 * @returns {{
 *   canExpandSymbol: (name: string) => boolean,
 *   expandSymbol: (
 *     graph: import('../../graph/graph.js').Graph,
 *     name: string
 *   ) => { graph: import('../../graph/graph.js').Graph, nodeId: string }
 * }}
 */
function makeExpansionHooks(env) {
  return {
    canExpandSymbol: name => env.has(name),
    expandSymbol: (graphValue, name) =>
      buildGraphFromSexpr(graphValue, env.get(name), []),
  };
}

/**
 * Graphology graphs are mutable, so store a defensive `graph.copy()` for
 * history/undo.
 *
 * @param {VisState} state
 * @returns {VisState}
 */
function snapshotVisState(state) {
  return { ...state, graph: state.graph.copy() };
}

/**
 * @param {KernelState} kernel
 * @param {string} note
 * @param {number} stepIndex
 * @param {object | null} focus
 * @returns {VisState}
 */
function visStateFromKernel(kernel, note, stepIndex, focus) {
  const expr = serializeGraph(kernel.graph, kernel.rootId);
  const snapshot = snapshotFromGraph(kernel.graph, kernel.rootId, note, focus);
  return snapshotVisState({
    graph: graphologyFromSnapshot(snapshot),
    rootId: kernel.rootId,
    note,
    expr,
    stepIndex,
  });
}

/**
 * @param {VisSession} session
 * @returns {VisState}
 */
export function present(session) {
  return presentFrame(session).state;
}

/**
 * @param {VisSession} session
 * @returns {Frame}
 */
export function presentFrame(session) {
  return session.frames[session.index];
}

/**
 * @param {VisSession} session
 * @returns {{
 *   initial: number,
 *   reduced: number | null,
 *   lastStep: number | null
 * }}
 */
export function totals(session) {
  const initial = session.frames[0].state.graph.order;
  if (!session.complete) {
    return { initial, reduced: null, lastStep: null };
  }
  const finalFrame = session.frames[session.frames.length - 1];
  return {
    initial,
    reduced: finalFrame.state.graph.order,
    lastStep: finalFrame.state.stepIndex,
  };
}

/**
 * @param {VisSession} session
 * @returns {boolean}
 */
export function canStepBack(session) {
  return session.index > 0;
}

/**
 * @param {VisSession} session
 * @returns {boolean}
 */
export function canStepForward(session) {
  if (session.index < session.frames.length - 1) return true;
  return !session.complete;
}

/**
 * @param {VisSession} session
 * @returns {VisSession}
 */
export function stepBack(session) {
  if (!canStepBack(session)) return session;
  return { ...session, index: session.index - 1 };
}

/**
 * @param {VisSession} session
 * @param {object | null} [context]
 * @returns {VisSession}
 */
export function stepForward(session, context = null) {
  if (!canStepForward(session)) return session;

  if (session.index < session.frames.length - 1) {
    return { ...session, index: session.index + 1 };
  }

  const current = session.frames[session.frames.length - 1];
  let phaseIndex = current.phaseIndex;
  let kernel = current.kernel;
  let stepperState = current.stepperState;

  for (;;) {
    if (phaseIndex >= session.phases.length) {
      return { ...session, complete: true };
    }

    const phase = session.phases[phaseIndex];
    const maxSteps = phase.options.maxSteps ?? session.maxSteps;
    const nextIndex = current.state.stepIndex + 1;
    if (nextIndex > maxSteps) {
      throw new Error(`Reduction exceeded maxSteps=${maxSteps}`);
    }

    const stepped = session.stepper.step(
      kernel,
      stepperState,
      phase.options,
      context,
    );

    if (!stepped.didStep) {
      phaseIndex += 1;
      if (phaseIndex < session.phases.length) {
        stepperState = session.stepper.init(
          kernel,
          session.phases[phaseIndex].options,
        );
      }
      continue;
    }

    kernel = stepped.state;
    stepperState = stepped.stepperState;

    const note = `${phase.name}:${stepped.note ?? 'step'}`;
    const nextState = visStateFromKernel(
      kernel,
      note,
      nextIndex,
      stepped.focus ?? null,
    );

    const nextFrame = {
      kernel,
      action: stepped.action ?? null,
      stepperState,
      decision: stepped.decision ?? null,
      phaseIndex,
      state: nextState,
    };

    return {
      ...session,
      frames: [...session.frames, nextFrame],
      index: session.frames.length,
    };
  }
}

/**
 * @typedef {{
 *   stepIndex: number,
 *   phase: string,
 *   note: string,
 *   decision: import('../../kernel/stepper.js').StepDecision | null,
 *   action: KernelAction | null
 * }} ActionLogEntry
 */

/**
 * Return a replayable log of chosen actions and decisions.
 *
 * This is intended for debugging, exporting traces, and building replay
 * schedulers without depending on PRNG state.
 *
 * @param {VisSession} session
 * @returns {ActionLogEntry[]}
 */
export function actionLog(session) {
  return session.frames.map(frame => ({
    stepIndex: frame.state.stepIndex,
    phase: session.phases[frame.phaseIndex]?.name ?? '?',
    note: frame.state.note,
    decision: frame.decision ?? null,
    action: frame.action ?? null,
  }));
}

/**
 * @param {{
 *   programSource: string,
 *   sourceExpr: string,
 *   precompile?: boolean,
 *   cloneArguments?: boolean,
 *   compactGraph?: import('../../graph/compact.js').GraphCompaction,
 *   mode?: SessionMode,
 *   seed?: number,
 *   maxSteps?: number
 * }} config
 * @returns {VisSession}
 */
export function createSession(config) {
  const precompile = config.precompile ?? true;
  const cloneArguments = config.cloneArguments ?? false;
  const compactGraph = config.compactGraph ?? 'none';
  const mode = config.mode ?? 'normal-order';
  const seed = config.seed ?? 1;
  const maxSteps = config.maxSteps ?? 5_000;
  const env = parseDefinitionsSource(config.programSource);
  const hooks = precompile ? {} : makeExpansionHooks(env);

  const ast = parseSexpr(config.sourceExpr);

  const compiled = precompile
    ? buildGraphInlinedFromSexpr(createGraph(), ast, env)
    : buildGraphFromSexpr(createGraph(), ast, []);

  /** @type {KernelState} */
  const initialKernel = { graph: compiled.graph, rootId: compiled.nodeId };

  const reducer =
    mode === 'multiway-rng'
      ? createPointerMachineAllCandidatesReducer()
      : createPointerMachineNormalOrderReducer();
  const scheduler =
    mode === 'multiway-rng'
      ? createSeededRngScheduler(seed)
      : createFirstScheduler();
  const stepper = createKernelStepper({ reducer, scheduler, hooks });

  const phases = [
    {
      name: 'weak',
      options: {
        reduceUnderLambdas: false,
        cloneArguments,
        compactGraph,
        maxSteps,
      },
    },
    {
      name: 'full',
      options: {
        reduceUnderLambdas: true,
        cloneArguments,
        compactGraph,
        maxSteps,
      },
    },
  ];

  const initialStepperState = stepper.init(initialKernel, phases[0].options);
  const initialState = visStateFromKernel(initialKernel, 'init', 0, null);

  return {
    sourceExpr: config.sourceExpr,
    programSource: config.programSource,
    hooks,
    compactGraph,
    phases,
    frames: [
      {
        kernel: initialKernel,
        action: null,
        stepperState: initialStepperState,
        decision: null,
        phaseIndex: 0,
        state: initialState,
      },
    ],
    index: 0,
    complete: false,
    maxSteps,
    stepper,
    mode,
    seed: mode === 'multiway-rng' ? seed : null,
    reducerId: reducer.id,
    schedulerId: scheduler.id,
  };
}

/**
 * Convenience wrapper for the current "Hello World" demo.
 *
 * @param {string} programSource
 * @param {{
 *   mode?: SessionMode,
 *   seed?: number,
 *   compactGraph?: import('../../graph/compact.js').GraphCompaction
 * }} [options]
 * @returns {VisSession}
 */
export function createHelloWorldSession(programSource, options = {}) {
  return createSession({
    programSource,
    sourceExpr: '(((S a) b) c)',
    precompile: true,
    cloneArguments: false,
    compactGraph: options.compactGraph ?? 'none',
    mode: options.mode,
    seed: options.seed,
    maxSteps: 5_000,
  });
}
