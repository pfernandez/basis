
export function dyck(n) {
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

export function pairs(n) {
  if (n === 0) return ['()'];
  const result = [];

  for (let i = 0; i < n; i++) {
    const left = pairs(i);
    const right = pairs(n - 1 - i);

    for (const l of left) {
      for (const r of right) {
        result.push(`(${l}${r})`);
      }
    }
  }

  return result;
}

// Motzkin forms: each pair contains 0, 1, or 2 immediate sub‑forms (no forests).
// Enumerated by total pairs minus one (n):
// n=0 -> ()
// n=1 -> (())
// n=2 -> ((())) (()())
export function motzkin(n) {
  if (n === 0) return ['()'];
  const out = [];
  // Unary: wrap any contain(n-1)
  for (const s of motzkin(n - 1)) {
    out.push(`(${s})`);
  }
  // Binary: split n-2 into i and j, combine contain(i) with contain(j)
  for (let i = 0; i <= n - 2; i++) {
    const j = n - 2 - i;
    for (const a of motzkin(i)) {
      for (const b of motzkin(j)) {
        out.push(`(${a}${b})`);
      }
    }
  }
  return out;
}
