/**
 * Visualizer entry point (Vite)
 * ----------------------------
 *
 * "Hello World" target:
 * - build a graph for `(((S a) b) c)`
 * - inline `S` then step reducer events
 * - simulate with Jolt + render with Three
 */

import programSource from '../../programs/sk-basis.lisp?raw';

import {
  createHelloWorldStates,
  createHistory,
  commit,
  undo,
  redo,
} from './domain/combinators.js';

import { createPhysicsEngine } from './simulation/engine.js';
import { createScene } from './view/scene.js';

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function mustGetElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

/**
 * @param {HTMLElement} hud
 * @param {string} text
 * @returns {void}
 */
function setHudText(hud, text) {
  hud.textContent = text;
}

/**
 * @param {import('./domain/combinators.js').VisState} state
 * @param {{ initial: number, reduced: number }} totals
 * @param {{ isPlaying: boolean }} playback
 * @returns {string}
 */
function hudForPresent(state, totals, playback) {
  return [
    '3D Combinator Visualizer (Hello World)',
    '',
    `step: ${state.stepIndex}/${totals.lastStep}`,
    `state: ${state.note}`,
    `play: ${playback.isPlaying ? 'playing' : 'paused'}`,
    'source: (((S a) b) c)',
    `expr: ${state.expr}`,
    'play/pause: Space',
    'step: ←/→',
    '',
    `nodes: ${state.graph.order}  edges: ${state.graph.size}`,
    `init nodes: ${totals.initial}`,
    `reduced nodes: ${totals.reduced}`,
  ].join('\n');
}

/**
 * @returns {Promise<void>}
 */
async function start() {
  const app = mustGetElement('app');
  const hud = mustGetElement('hud');

  const { states } = createHelloWorldStates(programSource);
  let history = createHistory(states[0]);

  const totals = {
    initial: states[0].graph.order,
    reduced: states[states.length - 1].graph.order,
    lastStep: states.length - 1,
  };

  /** @type {import('./simulation/engine.js').PhysicsEngine | null} */
  let engine = null;

  const vis = createScene({ container: app });

  let didFit = false;
  let isPlaying = false;
  let isLoading = false;

  const secondsPerStep = 0.8;
  let stepAccumulatorSeconds = 0;

  /**
   * @param {import('./domain/combinators.js').VisState} state
   * @param {{ fit: boolean }} options
   * @returns {Promise<void>}
   */
  async function loadStateNow(state, options) {
    const previousEngine = engine;
    engine = null;
    if (previousEngine) previousEngine.dispose();

    const nextEngine = await createPhysicsEngine({
      graph: state.graph,
      rootId: state.rootId,
    });
    engine = nextEngine;

    vis.setGraph({
      graph: state.graph,
      nodeIds: nextEngine.nodeIds,
      segments: nextEngine.segments,
    });
    vis.update(nextEngine.positions);

    if (options.fit && !didFit) {
      vis.fitToPositions(nextEngine.positions);
      didFit = true;
    }

    vis.render();
    setHudText(hud, hudForPresent(state, totals, { isPlaying }));
  }

  /** @type {{
   *   state: import('./domain/combinators.js').VisState,
   *   options: { fit: boolean }
   * } | null} */
  let pendingLoad = null;

  /**
   * @returns {Promise<void>}
   */
  async function flushPendingLoads() {
    while (pendingLoad) {
      const { state, options } = pendingLoad;
      pendingLoad = null;
      await loadStateNow(state, options);
    }
    isLoading = false;
  }

  /**
   * @param {import('./domain/combinators.js').VisState} state
   * @param {{ fit: boolean }} options
   * @returns {void}
   */
  function queueLoadState(state, options) {
    pendingLoad = { state, options };
    if (isLoading) return;
    isLoading = true;

    void flushPendingLoads().catch(error => {
      pendingLoad = null;
      isLoading = false;
      isPlaying = false;
      setHudText(hud, String(error?.stack ?? error));
      console.error(error);
    });
  }

  await loadStateNow(history.present, { fit: true });

  /**
   * @returns {void}
   */
  function pausePlayback() {
    isPlaying = false;
    stepAccumulatorSeconds = 0;
    setHudText(hud, hudForPresent(history.present, totals, { isPlaying }));
  }

  /**
   * @param {1 | -1} direction
   * @returns {void}
   */
  function stepFrame(direction) {
    pausePlayback();

    if (direction === -1) {
      const previousIndex = history.present.stepIndex;
      history = undo(history);
      if (history.present.stepIndex !== previousIndex) {
        queueLoadState(history.present, { fit: false });
      }
      return;
    }

    const attemptedRedo = redo(history);
    if (attemptedRedo.present.stepIndex !== history.present.stepIndex) {
      history = attemptedRedo;
      queueLoadState(history.present, { fit: false });
      return;
    }

    const nextIndex = history.present.stepIndex + 1;
    if (nextIndex >= states.length) {
      setHudText(hud, hudForPresent(history.present, totals, { isPlaying }));
      return;
    }

    history = commit(history, states[nextIndex]);
    queueLoadState(history.present, { fit: false });
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  function onKeyDown(event) {
    if (event.key === ' ') {
      event.preventDefault();
      if (isPlaying) {
        pausePlayback();
        return;
      }

      if (history.present.stepIndex >= states.length - 1) return;

      isPlaying = true;
      stepAccumulatorSeconds = 0;
      setHudText(hud, hudForPresent(history.present, totals, { isPlaying }));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepFrame(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepFrame(1);
      return;
    }

    if (event.key === 'z' || event.key === 'Z') {
      pausePlayback();
      history = undo(history);
      queueLoadState(history.present, { fit: false });
      return;
    }

    if (event.key === 'y' || event.key === 'Y') {
      pausePlayback();
      history = redo(history);
      queueLoadState(history.present, { fit: false });
    }
  }

  window.addEventListener('keydown', onKeyDown);

  let lastTimeMs = performance.now();

  /**
   * @param {number} nowMs
   * @returns {void}
   */
  function animate(nowMs) {
    const dt = (nowMs - lastTimeMs) / 1000;
    lastTimeMs = nowMs;

    if (isPlaying && !isLoading) {
      stepAccumulatorSeconds += dt;
      if (stepAccumulatorSeconds >= secondsPerStep) {
        stepAccumulatorSeconds = 0;
        if (history.present.stepIndex >= states.length - 1) {
          pausePlayback();
        } else {
          const nextIndex = history.present.stepIndex + 1;
          history = commit(history, states[nextIndex]);
          queueLoadState(history.present, { fit: false });
        }
      }
    }

    if (engine && vis) {
      engine.step(dt);
      vis.update(engine.positions);
      vis.render();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

start().catch(error => {
  const hud = document.getElementById('hud');
  if (hud) {
    hud.textContent = String(error?.stack ?? error);
  }
  console.error(error);
});
