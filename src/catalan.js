#!/usr/bin/env node

const RESET = '\x1b[0m';

const pastelColors = [205, 198, 165, 135, 99]; // More contrast: pink → purple path

function colorByPath(path) {
  const depth = path.length;
  const idx = Math.min(depth, pastelColors.length - 1);
  return `\x1b[38;5;${pastelColors[idx]}m`;
}

function generateColored(n, path = []) {
  if (n === 0) {
    return ['()'];
  }
  const result = [];
  for (let k = 0; k < n; k++) {
    const lefts = generateColored(k, [...path, 0]);
    const rights = generateColored(n - 1 - k, [...path, 1]);
    for (const left of lefts) {
      for (const right of rights) {
        const color = colorByPath(path);
        result.push(`${color}(${RESET}${left}${right}${color})${RESET}`);
      }
    }
  }
  return result;
}

function getVisibleLength(str) {
  // Remove ANSI escape codes to measure printable width
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}


function catalanPyramidColored(maxN = 3, match = null, center = false) {
  const rows = [];

  for (let n = 0; n <= maxN; n++) {
    let forms = generateColored(n);
    if (match) {
      const regex = new RegExp(match);
      forms = forms.filter(f => f.replace(/\x1b\[[0-9;]*m/g, '').match(regex));
    }
    if (forms.length > 0) {
      const row = `n=${n}: ${forms.join(' ')}`;
      rows.push(row);
    }
  }

  // Compute max visible width
  const maxWidth = Math.max(...rows.map(r => getVisibleLength(r)));

  rows.forEach(row => {
    if (center) {
      const padding = Math.floor((maxWidth - getVisibleLength(row)) / 2);
      console.log(' '.repeat(padding) + row);
    } else {
      console.log(row);
    }
  });
}

// --- CLI args ---
const maxN = process.argv[2] ? parseInt(process.argv[2], 10) : 3;
const matchArg = process.argv.find(arg => arg.startsWith('--match='));
const matchPattern = matchArg ? matchArg.split('=')[1] : null;

catalanPyramidColored(maxN, matchPattern);
