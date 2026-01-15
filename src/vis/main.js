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
  canStepForward,
  createHelloWorldSession,
  present,
  stepBack,
  stepForward,
  totals,
} from './domain/session.js';

import { createPhysicsEngine } from './simulation/engine.js';
import { createScene } from './view/scene.js';

/**
 * @param {string | null} value
 * @returns {'normal-order' | 'multiway-rng'}
 */
function parseModeParam(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (
    normalized === 'multiway' ||
    normalized === 'multi' ||
    normalized === 'rng' ||
    normalized === 'random' ||
    normalized === 'stochastic'
  ) {
    return 'multiway-rng';
  }
  return 'normal-order';
}

/**
 * @param {string | null} value
 * @returns {number}
 */
function parseSeedParam(value) {
  const seed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(seed) ? seed : 1;
}

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
 * @param {import('./domain/session.js').VisState} state
 * @param {{ initial: number, reduced: number | null, lastStep: number | null }}
 *   totalsValue
 * @param {{ isPlaying: boolean }} playback
 * @param {import('./domain/session.js').VisSession} session
 * @returns {string}
 */
function hudForPresent(state, totalsValue, playback, session) {
  const lastStep = totalsValue.lastStep ?? '?';
  const reduced = totalsValue.reduced ?? '?';
  const seed = session.seed === null ? '' : ` seed=${session.seed}`;
  return [
    '3D Combinator Visualizer (Hello World)',
    '',
    `step: ${state.stepIndex}/${lastStep}`,
    `state: ${state.note}`,
    `play: ${playback.isPlaying ? 'playing' : 'paused'}`,
    `mode: ${session.mode}${seed}`,
    `source: ${session.sourceExpr}`,
    `expr: ${state.expr}`,
    'play/pause: Space',
    'step: ←/→',
    'mode: M',
    '',
    `nodes: ${state.graph.order}  edges: ${state.graph.size}`,
    `init nodes: ${totalsValue.initial}`,
    `reduced nodes: ${reduced}`,
  ].join('\n');
}

/**
 * @returns {Promise<void>}
 */
async function start() {
  const app = mustGetElement('app');
  const hud = mustGetElement('hud');

  const params = new URLSearchParams(window.location.search);
  let mode = parseModeParam(params.get('mode'));
  const seed = parseSeedParam(params.get('seed'));

  /** @type {import('./domain/session.js').VisSession} */
  let session = createHelloWorldSession(programSource, { mode, seed });

  /** @type {import('./simulation/engine.js').PhysicsEngine | null} */
  let engine = null;

  const vis = createScene({ container: app });

  let didFit = false;
  let isPlaying = false;
  let isLoading = false;

  const secondsPerStep = 0.8;
  let stepAccumulatorSeconds = 0;

  /**
   * @param {import('./domain/session.js').VisState | null} state
   * @returns {void}
   */
  function renderHud(state = null) {
    const effectiveState = state ?? present(session);
    const totalsValue = totals(session);
    setHudText(
      hud,
      hudForPresent(
        effectiveState,
        totalsValue,
        { isPlaying },
        session,
      ),
    );
  }

  /**
   * @param {import('./domain/session.js').VisState} state
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
    renderHud(state);
  }

  /** @type {{
   *   state: import('./domain/session.js').VisState,
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
   * @param {import('./domain/session.js').VisState} state
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

  await loadStateNow(present(session), { fit: true });

  /**
   * @returns {void}
   */
  function pausePlayback() {
    isPlaying = false;
    stepAccumulatorSeconds = 0;
    renderHud(null);
  }

  /**
   * @param {1 | -1} direction
   * @returns {void}
   */
  function stepFrame(direction) {
    pausePlayback();
    const beforeIndex = session.index;

    try {
      if (direction === -1) {
        session = stepBack(session);
      } else {
        session = stepForward(session, null);
      }
    } catch (error) {
      isPlaying = false;
      setHudText(hud, String(error?.stack ?? error));
      console.error(error);
      return;
    }

    if (session.index !== beforeIndex) {
      queueLoadState(present(session), { fit: false });
      return;
    }

    renderHud(null);
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

      if (!canStepForward(session)) return;

      isPlaying = true;
      stepAccumulatorSeconds = 0;
      renderHud(null);
      return;
    }

    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      pausePlayback();
      mode = mode === 'normal-order' ? 'multiway-rng' : 'normal-order';
      session = createHelloWorldSession(programSource, { mode, seed });
      queueLoadState(present(session), { fit: false });
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
      event.preventDefault();
      stepFrame(-1);
      return;
    }

    if (event.key === 'y' || event.key === 'Y') {
      event.preventDefault();
      stepFrame(1);
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
        const beforeIndex = session.index;
        try {
          session = stepForward(session, null);
        } catch (error) {
          isPlaying = false;
          setHudText(hud, String(error?.stack ?? error));
          console.error(error);
          return;
        }

        if (session.index === beforeIndex) {
          pausePlayback();
        } else {
          queueLoadState(present(session), { fit: false });
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
