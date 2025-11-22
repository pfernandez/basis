#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { createCollapsePolicy, COLLAPSE_MODES } from './collapse-policy.js';

/**
 * motif-discover.js
 *
 * Discover recurrent "motifs" in the local-collapse dynamics on small Catalan
 * trees.
 *
 * This version:
 * - generates ONLY primitive Dyck words (one outer pair)
 * - uses a FLEXIBLE Dyck→tree parser (right-assoc fallback) so all valid Dyck
 *   words parse
 * - keeps a floor (MIN_MOTIF_SIZE) so mid-sized shapes survive
 * - uses stochastic deepest-first (ε-greedy)
 * - optional η-normalization: (() x) -> x  (--no-eta to disable)
 * - optional freeze of near-balanced nodes: --freeze-balanced
 */

//////////////////// CONFIG /////////////////////////////////////////////

const MAX_N = 8;
const RUNS_PER_TREE = 800;
const MAX_STEPS = 800;
const MIN_MOTIF_SIZE = 3;
const USE_ETA = !process.argv.includes('--no-eta');
const FREEZE_BALANCED = process.argv.includes('--freeze-balanced');
const policyArg = process.argv.find(arg => arg.startsWith('--policy='));
const COLLAPSE_MODE = policyArg ? policyArg.split('=')[1] : COLLAPSE_MODES.HEAVIER;
const EPS = 0.2; // 20% explore, 80% deepest-first

//////////////////// BASIC TREE STUFF //////////////////////////////////

const Leaf = null;
const Node = (L, R) => ({ L, R });
const isLeaf = t => t === Leaf;

function countPairs(t) {
  if (isLeaf(t)) return 0;
  return 1 + countPairs(t.L) + countPairs(t.R);
}

const collapseWithPolicy = createCollapsePolicy(countPairs, {
  mode: COLLAPSE_MODE,
  freezeBalanced: FREEZE_BALANCED,
});

function serialize(t) {
  if (isLeaf(t)) return '()';
  return `(${serialize(t.L)}${serialize(t.R)})`;
}
const hashTree = serialize;

//////////////////// DYCK GENERATION ///////////////////////////////////

/** all Dyck words of semilength n */
function generateDyck(n) {
  const out = [];
  (function backtrack(s, open, close) {
    if (s.length === 2 * n) { out.push(s); return; }
    if (open < n) backtrack(s + '(', open + 1, close);
    if (close < open) backtrack(s + ')', open, close + 1);
  })('', 0, 0);
  return out;
}

/** primitive = never hits 0 before the end */
function isPrimitiveDyck(s) {
  if (!s || !s.length) return false;
  let bal = 0;
  for (let i = 0; i < s.length; i++) {
    bal += s[i] === '(' ? 1 : -1;
    if (bal === 0 && i !== s.length - 1) return false;
  }
  return bal === 0;
}

/** split a balanced string into top-level Dyck factors */
function factorDyck(s) {
  const out = [];
  let bal = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    bal += ch === '(' ? 1 : -1;
    if (bal === 0) {
      out.push(s.slice(start, i + 1));
      start = i + 1;
    }
  }
  return out.filter(Boolean);
}

/**
 * FLEXIBLE parser (your original idea):
 * - () -> Leaf
 * - if inside splits into exactly 2 parts: Node(left,right)
 * - otherwise right-associate the list of parts
 */
function parseTreeFlexible(primitive) {
  if (primitive === '()') return Leaf;
  const inner = primitive.slice(1, -1);
  const parts = factorDyck(inner);
  if (parts.length !== 2) {
    // right-associate: (...((p1 p2) p3) ... )
    return parts.reduceRight((acc, cur) => Node(parseTreeFlexible(cur), acc), Leaf);
  }
  return Node(parseTreeFlexible(parts[0]), parseTreeFlexible(parts[1]));
}

//////////////////// NORMALIZATION /////////////////////////////////////

function etaNormalizeTree(t) {
  if (isLeaf(t)) return Leaf;
  const L = etaNormalizeTree(t.L);
  const R = etaNormalizeTree(t.R);
  if (isLeaf(L) && !isLeaf(R)) {
    return R; // (() x) -> x
  }
  return Node(L, R);
}

//////////////////// COLLAPSE DYNAMICS /////////////////////////////////

function collectRedexes(t, path = [], acc = []) {
  if (isLeaf(t)) return acc;
  const size = countPairs(t);
  if (size > MIN_MOTIF_SIZE) {
    acc.push({ path: path.slice(), size });
  }
  collectRedexes(t.L, path.concat('L'), acc);
  collectRedexes(t.R, path.concat('R'), acc);
  return acc;
}

function getByPath(t, path) {
  let cur = t;
  for (const d of path) {
    cur = d === 'L' ? cur.L : cur.R;
  }
  return cur;
}

function setByPath(t, path, sub) {
  if (path.length === 0) return sub;
  const [d, ...rest] = path;
  if (d === 'L') return Node(setByPath(t.L, rest, sub), t.R);
  return Node(t.L, setByPath(t.R, rest, sub));
}

/** one ε-greedy deepest-first collapse step */
function randomCollapseStep(t) {
  const redexes = collectRedexes(t);
  if (!redexes.length) return { tree: t, done: true };

  let choicePath;
  if (Math.random() < EPS) {
    // explore
    choicePath = redexes[Math.floor(Math.random() * redexes.length)].path;
  } else {
    // exploit: pick random among deepest
    const maxDepth = redexes.reduce((m, r) => Math.max(m, r.path.length), 0);
    const deepest = redexes.filter(r => r.path.length === maxDepth);
    choicePath = deepest[Math.floor(Math.random() * deepest.length)].path;
  }

  const sub = getByPath(t, choicePath);
  const subSize = countPairs(sub);
  if (subSize <= MIN_MOTIF_SIZE) {
    return { tree: t, done: true };
  }

  const collapsed = collapseWithPolicy(sub);
  const done = collapsed === sub; // frozen
  return { tree: setByPath(t, choicePath, collapsed), done };
}

function runStochastic(start, maxSteps = MAX_STEPS) {
  let t = start;
  for (let i = 0; i < maxSteps; i++) {
    const { tree: next, done } = randomCollapseStep(t);
    t = next;
    if (done) break;
  }
  return t;
}

//////////////////// DISCOVERY /////////////////////////////////////////

function discoverMotifs(maxN = MAX_N, runsPerTree = RUNS_PER_TREE) {
  const visitCounts = new Map(); // hash -> {count,size}
  const startCounts = new Map(); // hash -> count

  // start at n=1 to skip empty string
  for (let n = 1; n <= maxN; n++) {
    const words = generateDyck(n).filter(isPrimitiveDyck);
    for (const w of words) {
      // parse w with flexible parser
      let core = parseTreeFlexible(w);
      if (USE_ETA) core = etaNormalizeTree(core);

      const coreHash = hashTree(core);
      startCounts.set(coreHash, (startCounts.get(coreHash) || 0) + 1);

      for (let r = 0; r < runsPerTree; r++) {
        const end = runStochastic(core, MAX_STEPS);
        const h = hashTree(end);
        const size = countPairs(end);
        const prev = visitCounts.get(h);
        if (prev) {
          prev.count += 1;
        } else {
          visitCounts.set(h, { count: 1, size });
        }
      }
    }
  }

  const motifs = [...visitCounts.entries()]
    .map(([hash, { count, size }]) => ({ hash, count, size }))
    .sort((a, b) => b.count - a.count);

  return { motifs, startCounts };
}

//////////////////// CLI //////////////////////////////////////////////////////

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  const { motifs, startCounts } = discoverMotifs();

  console.log('=== Start cores (primitive only, η-normalized=' + USE_ETA + ', freezeBalanced=' + FREEZE_BALANCED + ', policy=' + COLLAPSE_MODE + ') ===');
  for (const [h, c] of startCounts.entries()) {
    console.log(`${h}  starts=${c}`);
  }

  console.log('\n=== Discovered motifs (by visit frequency) ===');
  motifs.slice(0, 30).forEach(m => {
    console.log(`${m.hash}  visits=${m.count}  size=${m.size}`);
  });

  console.log(`
Flags:
  --no-eta           disable (() x) -> x pre-collapse
  --freeze-balanced  stop collapsing when |L|-|R| <= 1
  --policy=<mode>    pick collapse strategy (heavier | lighter | left | right)

Notes:
  - raise MIN_MOTIF_SIZE to 4–5 to preserve even bigger motifs
  - drop --freeze-balanced to let everything flow to terminals
`);
}
