/* dyck-tools.js
 *
 * Utilities for working with Dyck words (balanced parentheses), η-normalization,
 * Catalan cores vs. Motzkin dressings, primitive factorization, and simple catalogs.
 *
 * Conventions
 * -----------
 * - A Dyck *tree* is either a Leaf "()", or an internal node (L,R).
 * - We represent Leaf as null (for simplicity), and Node as { L, R }.
 * - A Dyck *word* can be a *forest* (concatenation of trees). We factor it into
 *   *primitives* (maximal balanced blocks) before parsing each to a tree.
 * - η-normalization removes left-empty wrappers: (() x) ≡ x  (i.e., Node(Leaf, X) → X).
 *   (We do not remove right-empty wrappers; that keeps the asymmetry we’ve been using.)
 *
 * What you can do
 * ---------------
 * - factorDyck(word)          → ["primitive1", "primitive2", ...]
 * - parseTree(primitive)      → { L, R } | null
 * - etaNormalizeTree(tree)    → normalized { L, R } | null
 * - serialize(tree)           → "(()())" style
 * - countPairs(tree)          → # of internal nodes (Catalan size)
 * - catalog(word)             → { cores, dressings } summary for a Dyck word
 * - buildCoreHistogram(words) → histogram by Catalan size after η-normalization
 *
 * Run as CLI: node dyck-tools.js
 */

/////////////////////////////// Core data model ///////////////////////////////

/** Leaf = null for compactness */
const Leaf = null;

/** @typedef {{L: Tree, R: Tree} | null} Tree */

/** Make a node */
function Node(L, R) {
  return { L, R };
}

/** Is leaf? */
function isLeaf(t) {
  return t === Leaf;
}

/** Count internal nodes (Catalan size) */
function countPairs(t) {
  if (isLeaf(t)) return 0;
  return 1 + countPairs(t.L) + countPairs(t.R);
}

/** Structural hash (ordered); stable across equal trees. */
function hashTree(t) {
  if (isLeaf(t)) return '()';
  return `(${hashTree(t.L)}${hashTree(t.R)})`;
}

/** Serialize back to parentheses (ordered). */
function serialize(t) {
  if (isLeaf(t)) return '()';
  return `(${serialize(t.L)}${serialize(t.R)})`;
}

/////////////////////////////// Parsing //////////////////////////////////////

/**
 * Factor a Dyck word into *primitive* blocks (maximal balanced substrings).
 * E.g., "()()(()())" → ["()", "()", "(()())"]
 */
function factorDyck(s) {
  const out = [];
  let bal = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') bal++;
    else if (ch === ')') bal--;
    if (bal < 0) throw new Error(`Unbalanced at ${i} in "${s}"`);
    if (bal === 0 && ch === ')') {
      out.push(s.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (bal !== 0) throw new Error(`Unbalanced at end in "${s}"`);
  return out.filter(x => x.length > 0);
}

/**
 * Parse a *primitive* Dyck word (one balanced block) into a binary tree.
 * Grammar: P := "()" | "(" P P ")"  (full binary)
 * This is the standard Catalan parse.
 */
function parseTree(primitive) {
  if (primitive === '()') return Leaf;
  if (primitive[0] !== '(' || primitive[primitive.length - 1] !== ')') {
    throw new Error(`Primitive must start '(' and end ')': "${primitive}"`);
  }
  // strip outer parens and split the inside into two primitives
  const inner = primitive.slice(1, -1);
  const parts = factorDyck(inner); // should return exactly 2 parts for full binary
  if (parts.length !== 2) {
    // If you see len ≠ 2, your input isn't *full* binary—likely Motzkin/unary present.
    // You can reconstruct a binary by right-associating: (((p1 p2) p3) ...).
    const rightAssoc = parts.reduceRight((acc, cur) => {
      return Node(parseTree(cur), acc);
    }, Leaf); // if parts length==1, Node(parse(parts[0]), Leaf) (degenerate)
    return rightAssoc;
  }
  return Node(parseTree(parts[0]), parseTree(parts[1]));
}

//////////////////////// η-normalization (Motzkin → Catalan core) /////////////

/**
 * η-normalize: contract left-empty wrappers (() x) ≡ x, recursively.
 * We also normalize children first, then apply the rule at this node.
 */
function etaNormalizeTree(t) {
  if (isLeaf(t)) return Leaf;
  const L = etaNormalizeTree(t.L);
  const R = etaNormalizeTree(t.R);
  // η-rule: (() x) → x  (i.e., left child is Leaf)
  if (isLeaf(L) && !isLeaf(R)) {
    return R; // drop the neutral wrapper
  }
  return Node(L, R);
}

/**
 * Canonicalize associativity for stable comparison (ordered trees already stable).
 * If you want rotation-invariance, you can add a canonical-rotation step here.
 */
function canonicalize(t) {
  // For now, ordered trees are canonical; add rotation canon if you decide to quotient by rotations.
  return t;
}

///////////////////////////// Catalog & Motif utilities ///////////////////////

/**
 * Given a Dyck *word* (possibly a forest), return:
 * - cores: normalized Catalan cores (η-quotiented) for each primitive
 * - dressings: original primitives (before η), useful for kinetics
 */
function catalog(word) {
  const prims = factorDyck(word);
  const cores = prims.map(p => canonicalize(etaNormalizeTree(parseTree(p))));
  return {
    primitives: prims,
    cores,
    coreHashes: cores.map(hashTree),
    coreSizes: cores.map(countPairs),
  };
}

/** Build a histogram by Catalan size (after η-normalization) for many words. */
function buildCoreHistogram(words) {
  const hist = new Map(); // size -> count
  for (const w of words) {
    const { cores } = catalog(w);
    for (const t of cores) {
      const k = countPairs(t);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  // materialize as sorted array
  const out = [...hist.entries()].sort((a, b) => a[0] - b[0])
    .map(([size, count]) => ({ size, count }));
  return out;
}

/**
 * Primitive factorization with η bookkeeping: return tuples of
 * { primitive, coreHash, coreSize, primitiveSize }.
 */
function analyze(word) {
  const prims = factorDyck(word);
  return prims.map(p => {
    const tree = parseTree(p);
    const core = canonicalize(etaNormalizeTree(tree));
    return {
      primitive: p,
      primitivePairs: countPairs(tree),
      core: serialize(core),
      coreHash: hashTree(core),
      corePairs: countPairs(core),
    };
  });
}

/** Quick helper: generate all Dyck words of semilength n (Catalan) */
function generateDyck(n) {
  const out = [];
  function backtrack(s, open, close) {
    if (s.length === 2 * n) { out.push(s); return; }
    if (open < n) backtrack(s + '(', open + 1, close);
    if (close < open) backtrack(s + ')', open, close + 1);
  }
  backtrack('', 0, 0);
  return out;
}

/** Quick helper: strip all η-wrappers from a *whole forest string* textually.
 *  (Robust route is tree-based via etaNormalizeTree; this is just a viewer.)
 */
function stripEtaText(s) {
  // Replace "(()X)" → "(X)" at text level repeatedly.
  // We do it cautiously by detecting '(()' followed by a balanced segment '... )'.
  // For correctness on all cases, prefer the tree-based etaNormalizeTree.
  let changed = true;
  while (changed) {
    changed = false;
    const re = /\(\(\)(\(.+\))\)/g; // matches "(()<balanced-ish>)" (approx)
    s = s.replace(re, (_, inner) => {
      changed = true;
      return inner;
    });
  }
  return s;
}

/////////////////////////////// CLI demo //////////////////////////////////////

if (require.main === module) {
  // Demo 1: analyze a few user-supplied strings or defaults
  const inputs = process.argv.slice(2);
  const samples = inputs.length ? inputs : [
    '()',
    '(())',
    '((()))(()())',         // forest of two primitives
    '()()()',               // forest of three voids
    '(()(()))',             // η-dressed (degenerate) that normalizes to (())
    '(()()()(()()()()))',   // longer forest with structure
  ];

  console.log('=== Analyze (primitive → core) ===');
  for (const s of samples) {
    const rows = analyze(s);
    console.log(`Dyck: ${s}`);
    rows.forEach((r, i) => {
      console.log(`  block ${i+1}: primitive=${r.primitive} [pairs=${r.primitivePairs}]`
        + `  => core=${r.core} [pairs=${r.corePairs}]  (hash=${r.coreHash})`);
    });
  }

  // Demo 2: show Catalan histogram after η-normalization for all words up to n=3
  console.log('\n=== Catalan histogram of cores (n<=3) ===');
  const words = [];
  for (let n = 0; n <= 3; n++) {
    words.push(...generateDyck(n));
  }
  const hist = buildCoreHistogram(words);
  for (const { size, count } of hist) {
    console.log(`size=${size}  count=${count}`);
  }

  // Demo 3: show that η-dressed degenerates map to the same core
  console.log('\n=== η-normalization examples ===');
  const demo = [
    '(()())',           // η-dressed → strip to () as core for this primitive
    '(()(()()))',       // η-dressed version of one n=2 core
    '((()())())',       // rotated sibling
  ];
  for (const s of demo) {
    const rows = analyze(s);
    console.log(`Dyck: ${s}`);
    rows.forEach((r, i) => {
      console.log(`  block ${i+1}: primitive=${r.primitive} -> core=${r.core}`);
    });
  }
}

/////////////////////////////// Exports ///////////////////////////////////////

module.exports = {
  Leaf, Node, isLeaf,
  factorDyck, parseTree, etaNormalizeTree, canonicalize,
  serialize, hashTree, countPairs,
  catalog, buildCoreHistogram, analyze, generateDyck, stripEtaText,
};
