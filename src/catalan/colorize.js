const RESET = '\x1b[0m';
const pastelColors = [205, 198, 165, 135, 99];

function colorByDepth(depth) {
  const idx = Math.min(depth, pastelColors.length - 1);
  return `\x1b[38;5;${pastelColors[idx]}m`;
}

export function colorizeParens(s) {
  let result = '';
  let depth = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') {
      const color = colorByDepth(depth);
      result += `${color}(${RESET}`;
      depth++;
    } else if (ch === ')') {
      depth--;
      const color = colorByDepth(depth);
      result += `${color})${RESET}`;
    } else {
      result += ch;
    }
  }

  return result;
}

