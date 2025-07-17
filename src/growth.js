// Import utilities from your existing modules
import { isArray, first, map, apply } from './functions.js';
import { svg } from './dom.js';

// Constants
const NODE_RADIUS = 4;
const X_STEP = 20;
const Y_STEP = 20;

// Helpers for recognition
const isLeaf = expr => expr === '()';
const isApply = expr =>
  isArray(expr) && expr.length === 2 && isLeaf(expr[0]) && isLeaf(expr[1]);

// Probabilistic ignition condition
const ignitionProbability = depth => Math.pow(2, -(depth + 1));

// History tracker
let history = [];

// Evaluation function enforcing left-handedness
export const evaluateNode = (node, depth = 0, path = []) => {
  if (isLeaf(node)) {
    history.push({ node, depth, path, type: 'leaf' });
    return;
  }

  if (isApply(node)) {
    history.push({ node, depth, path, type: 'apply' });

    // Probabilistic ignition: allow growth based on Solomonoff prior
    if (Math.random() >= ignitionProbability(depth)) return;

    // LEFT FIRST (A8 constraint)
    evaluateNode(node[0], depth + 1, [...path, 0]);
    evaluateNode(node[1], depth + 1, [...path, 1]);
  }
};

// Rendering function using your `dom.js` helpers
export const renderHistory = history =>
  svg('svg', { width: 800, height: 600, viewBox: '0 0 800 600' },
    history.map(({ path, depth, type }) =>
      svg('circle', {
        cx: path.length * X_STEP + 20,
        cy: depth * Y_STEP + 20,
        r: NODE_RADIUS,
        fill: type === 'apply' ? 'blue' : 'black',
        stroke: 'none'
      })
    )
  );

// Entry point for experiment
export const runExperiment = () => {
  history = [];  // Reset for each run
  const root = ['()', '()'];  // `apply = cons` equivalence
  evaluateNode(root);
  document.body.appendChild(renderHistory(history));
};

