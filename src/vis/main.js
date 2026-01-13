/**
 * Visualizer entry point (Vite)
 * ----------------------------
 *
 * "Hello World" target:
 * - build a graph for `(((S a) b) c)`
 * - apply one S-combinator macro step
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
 * @returns {string}
 */
function hudForPresent(state, totals) {
  return [
    '3D Combinator Visualizer (Hello World)',
    '',
    `state: ${state.note}`,
    `expr: ${state.expr}`,
    'step: Space',
    'undo: Z    redo: Y',
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
    reduced: states[1].graph.order,
  };

  /** @type {import('./simulation/engine.js').PhysicsEngine | null} */
  let engine = null;

  /** @type {import('./view/scene.js').VisScene | null} */
  let vis = null;

  /**
   * @param {import('./domain/combinators.js').VisState} state
   * @returns {Promise<void>}
   */
  async function loadState(state) {
    const previousVis = vis;
    vis = null;
    if (previousVis) previousVis.dispose();

    const previousEngine = engine;
    engine = null;
    if (previousEngine) previousEngine.dispose();

    const nextEngine = await createPhysicsEngine({
      graph: state.graph,
      rootId: state.rootId,
    });
    engine = nextEngine;

    const nextVis = createScene({
      container: app,
      graph: state.graph,
      nodeIds: engine.nodeIds,
      nodeIndexById: engine.nodeIndexById,
      segments: engine.segments,
    });
    vis = nextVis;

    vis.update(engine.positions);
    vis.render();
    setHudText(hud, hudForPresent(state, totals));
  }

  await loadState(history.present);

  /**
   * @param {import('./domain/combinators.js').VisState} state
   * @returns {void}
   */
  function queueLoadState(state) {
    void loadState(state).catch(error => {
      setHudText(hud, String(error?.stack ?? error));
      console.error(error);
    });
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  function onKeyDown(event) {
    if (event.key === ' ') {
      event.preventDefault();
      if (history.present.note === 'init') {
        history = commit(history, states[1]);
        queueLoadState(history.present);
      }
      return;
    }

    if (event.key === 'z' || event.key === 'Z') {
      history = undo(history);
      queueLoadState(history.present);
      return;
    }

    if (event.key === 'y' || event.key === 'Y') {
      history = redo(history);
      queueLoadState(history.present);
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
