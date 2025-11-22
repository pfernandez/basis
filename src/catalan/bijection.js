import { fileURLToPath } from 'node:url';
import { dyck, pairs, motzkin } from './catalan.js';

/*
 * Bijection toolkit
 * -----------------
 * - Dyck words enumerate full binary trees: every primitive block corresponds
 *   to an internal node with exactly two children. `dyckToTree` and
 *   `renderTree` therefore form a perfect round-trip when paired with
 *   `generateDyckWords` or `pairs()` (Catalan generator).
 * - Motzkin words allow unary nodes as well. We parse them into explicit
 *   `{ kind: 'unary' | 'binary' }` trees, then convert each unary step into the
 *   canonical Catalan encoding by inserting a neutral left leaf. The CLI prints
 *   both representations: the Catalan tree (so Motzkin shapes can be compared
 *   directly with Dyck/Catalan outputs) plus a compact `U/B` annotation that
 *   preserves which nodes were unary vs. binary in the original word.
 */

// Re-export canonical generators so the bijection module stays the single entry-point
// for Dyck words / Catalan trees in other tooling.
export const generateDyckWords = dyck;
export const generateCatalanTrees = pairs;
export const generateMotzkinWords = motzkin;

function splitIntoBalancedBlocks(s) {
  const parts = [];
  let balance = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') balance++;
    else if (ch === ')') balance--;
    else throw new Error(`Invalid character: ${ch}`);
    if (balance < 0) {
      throw new Error(`Unbalanced parentheses in ${s}`);
    }
    if (balance === 0) {
      parts.push(s.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (balance !== 0) {
    throw new Error(`Unbalanced parentheses in ${s}`);
  }
  return parts.filter(Boolean);
}

// === Parse a Dyck word into a tree structure ===
export function dyckToTree(s) {
  if (s.length === 0) return null;
  if (s[0] !== '(') {
    throw new Error(`Invalid Dyck word: ${s}`);
  }

  let balance = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === '(') balance++;
    else if (char === ')') balance--;
    else throw new Error(`Invalid character in Dyck word: ${char}`);

    if (balance < 0) {
      throw new Error(`Invalid Dyck word: ${s}`);
    }
    if (balance === 0) {
      const left = s.slice(1, i);
      const right = s.slice(i + 1);
      return { left: dyckToTree(left), right: dyckToTree(right) };
    }
  }

  throw new Error(`Invalid Dyck word: ${s}`);
}

// === Render a tree structure back into nested parens ===
export function renderTree(tree) {
  if (tree === null) return '()';
  return `(${renderTree(tree.left)}${renderTree(tree.right)})`;
}

// === Motzkin (unary/binary) parsing/rendering ===
export function motzkinToTree(s) {
  if (s === '()') return null;
  if (s[0] !== '(' || s[s.length - 1] !== ')') {
    throw new Error(`Invalid Motzkin word: ${s}`);
  }
  const inner = s.slice(1, -1);
  const parts = splitIntoBalancedBlocks(inner);
  if (parts.length === 1) {
    return { kind: 'unary', child: motzkinToTree(parts[0]) };
  }
  if (parts.length === 2) {
    return {
      kind: 'binary',
      left: motzkinToTree(parts[0]),
      right: motzkinToTree(parts[1]),
    };
  }
  throw new Error(`Motzkin nodes must have 1 or 2 children: ${s}`);
}

export function renderMotzkinTree(tree) {
  if (tree === null) return '()';
  if (tree.kind === 'unary') {
    return `(${renderMotzkinTree(tree.child)})`;
  }
  if (tree.kind === 'binary') {
    return `(${renderMotzkinTree(tree.left)}${renderMotzkinTree(tree.right)})`;
  }
  throw new Error('Unknown Motzkin node');
}

function describeMotzkinTree(tree) {
  if (tree === null) return '•';
  if (tree.kind === 'unary') {
    return `U(${describeMotzkinTree(tree.child)})`;
  }
  if (tree.kind === 'binary') {
    return `B(${describeMotzkinTree(tree.left)}, ${describeMotzkinTree(tree.right)})`;
  }
  throw new Error('Unknown Motzkin node');
}

export function motzkinTreeToCatalanTree(tree) {
  if (tree === null) return null;
  if (tree.kind === 'unary') {
    return { left: null, right: motzkinTreeToCatalanTree(tree.child) };
  }
  if (tree.kind === 'binary') {
    return {
      left: motzkinTreeToCatalanTree(tree.left),
      right: motzkinTreeToCatalanTree(tree.right),
    };
  }
  throw new Error('Unknown Motzkin node');
}

function runCli() {
  const maxN = 4;

  for (let n = 0; n <= maxN; n++) {
    const dyckWords = generateDyckWords(n);
    const catalanTrees = generateCatalanTrees(n);
    const motzkinWords = generateMotzkinWords(n);

    console.log(`\n=== n = ${n} ===`);
    console.log(`Dyck words (C${n} = ${dyckWords.length}):`);
    console.log(dyckWords.join(', '));

    console.log(`Catalan trees (C${n} = ${catalanTrees.length}):`);
    console.log(catalanTrees.join(', '));

    console.log(`Bijection (Dyck → Tree):`);
    dyckWords.forEach((word, i) => {
      const tree = dyckToTree(word);
      const rendered = renderTree(tree);
      console.log(`  [${i}] ${word} → ${rendered}`);
    });

    console.log(`Motzkin words (M${n} = ${motzkinWords.length}):`);
    console.log(motzkinWords.join(', '));

    console.log(`Bijection (Motzkin → Tree):`);
    motzkinWords.forEach((word, i) => {
      const tree = motzkinToTree(word);
      const binary = renderTree(motzkinTreeToCatalanTree(tree));
      const desc = describeMotzkinTree(tree);
      console.log(`  [${i}] ${word} → ${binary}  [${desc}]`);
    });
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runCli();
}
