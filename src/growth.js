// Import utilities from your existing modules
import { isArray } from './functions.js';
import { body, circle, head, html, line, link, render, svg } from './elements.js';

// Probabilistic ignition condition
const ignitionProbability = depth => 1 //Math.pow(2, -(depth + 1));

// Helpers for recognition
const isLeaf = expr => expr === '()';
const isApply = expr =>
  isArray(expr) && expr.length === 2 && isLeaf(expr[0]) && isLeaf(expr[1]);

// History tracker
let history = [];

// Constants
const MAX_DEPTH = 6;

// Chirality counters
let leftCount = 0;
let rightCount = 0;

export const evaluateNode = (node, depth = 0, path = []) => {
  if (depth > MAX_DEPTH) return;

  const pathStr = path.join(',');

  if (isLeaf(node)) {
    console.log(
      '%cLeaf', 'color: green',
      `depth=${depth}, path=[${pathStr}]`
    );
    history.push({ node, depth, path, type: 'leaf' });

    if (Math.random() < ignitionProbability(depth)) {
      console.log(
        '%cPromote', 'color: orange',
        `depth=${depth}, path=[${pathStr}]`
      );
      node = ['()', '()'];
      history.push({ node, depth, path, type: 'apply' });

      leftCount++;
      evaluateNode(node[0], depth + 1, [...path, 0]);

      rightCount++;
      evaluateNode(node[1], depth + 1, [...path, 1]);
    }

    return;
  }

  if (isApply(node)) {
    console.log(
      '%cApply', 'color: blue',
      `depth=${depth}, path=[${pathStr}]`
    );
    history.push({ node, depth, path, type: 'apply' });

    leftCount++;
    evaluateNode(node[0], depth + 1, [...path, 0]);

    rightCount++;
    evaluateNode(node[1], depth + 1, [...path, 1]);
  }
};

export const reportChiralityStats = () => {
  console.log(
    '%cChirality Stats', 'color: purple; font-weight: bold',
    `Left traversals: ${leftCount}, Right traversals: ${rightCount}`
  );
};

export const renderHistory = history => {
  const elements = [];

  // Build a lookup to reference positions by path
  const positionMap = new Map();

  history.forEach(({ path, depth, type }) => {
    const cx = 400 + 20 * path.reduce((acc, dir, i) => acc + (dir === 0 ? -1 : 1), 0);
    const cy = 20 + 20 * depth;

    positionMap.set(path.join(','), { cx, cy });

    // Add circle node
    elements.push(circle({
      cx, cy, r: 4,
      fill: type === 'apply' ? 'blue' : 'black',
      stroke: 'none'
    }));

    // Add edge from parent, if not root
    if (path.length > 0) {
      const parentPath = path.slice(0, -1).join(',');
      const parent = positionMap.get(parentPath);

      if (parent) {
        elements.push(line({
          x1: parent.cx, y1: parent.cy,
          x2: cx, y2: cy,
          stroke: '#999',
          'stroke-width': 1
        }));
      }
    }
  });

  const dom = html(
    head(link({ rel: "icon", href: "data:x-icon" })),
    body(
      svg({ width: 800, height: 600, viewBox: '0 0 800 600' },
        ...elements
      )
    )
  )

  return render(dom);
};

// Entry point for experiment
export const runExperiment = () => {
  history = [];  // Reset for each run
  const root = ['()', '()'];  // `apply = cons` equivalence
  evaluateNode(root);

  renderHistory(history);
};


let aggregateLeft = 0;
let aggregateRight = 0;

export const runBatch = (n = 100) => {
  aggregateLeft = 0;
  aggregateRight = 0;

  for (let i = 0; i < n; i++) {
    // Reset state for each run
    history = [];
    leftCount = 0;
    rightCount = 0;

    const root = ['()', '()'];
    evaluateNode(root);

    aggregateLeft += leftCount;
    aggregateRight += rightCount;
  }

  console.log(
    '%cBatch Chirality Stats', 'color: purple; font-weight: bold',
    `Runs: ${n}, Total left: ${aggregateLeft}, Total right: ${aggregateRight}`
  );

  const leftRatio = aggregateLeft / (aggregateLeft + aggregateRight);
  const rightRatio = aggregateRight / (aggregateLeft + aggregateRight);

  console.log(
    `Empirical ratios → Left: ${leftRatio.toFixed(3)}, Right: ${rightRatio.toFixed(3)}`
  );
};
