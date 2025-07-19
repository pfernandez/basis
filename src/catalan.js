
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

