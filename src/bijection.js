// === Generate all Dyck words (well-formed parentheses strings) ===
function generateDyckWords(n) {
  const result = [];

  function backtrack(currentString, openCount, closeCount) {
    if (currentString.length === 2 * n) {
      result.push(currentString);
      return;
    }
    if (openCount < n) {
      backtrack(currentString + '(', openCount + 1, closeCount);
    }
    if (closeCount < openCount) {
      backtrack(currentString + ')', openCount, closeCount + 1);
    }
  }

  backtrack("", 0, 0);
  return result;
}

// === Generate all Catalan binary trees (explicit structural form) ===
function generateCatalanTrees(n) {
  if (n === 0) return ['()'];
  const result = [];
  for (let i = 0; i < n; i++) {
    const left = generateCatalanTrees(i);
    const right = generateCatalanTrees(n - 1 - i);
    for (const l of left) {
      for (const r of right) {
        result.push(`(${l}${r})`);
      }
    }
  }
  return result;
}

// === Parse a Dyck word into a tree structure ===
function dyckToTree(s) {
  if (s === '()') return null;
  let balance = 0;
  for (let i = 1; i < s.length - 1; i++) {  // Skip outermost ()
    if (s[i] === '(') balance++;
    else balance--;
    if (balance === 0) {
      const left = s.slice(1, i + 1);
      const right = s.slice(i + 1, s.length - 1);
      return { left: dyckToTree(left), right: dyckToTree(right) };
    }
  }
  return null;
}

// === Render a tree structure back into nested parens ===
function renderTree(tree) {
  if (tree === null) return '()';
  return `(${renderTree(tree.left)}${renderTree(tree.right)})`;
}

// === Run unified comparison ===
const maxN = 4;

for (let n = 0; n <= maxN; n++) {
  const dyckWords = generateDyckWords(n);
  const catalanTrees = generateCatalanTrees(n);

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
}

