#!/usr/bin/env node

const BLUE = '\x1b[34m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function generateColored(n, side = null) {
  if (n === 0) {
    return ['()'];
  }
  const result = [];
  for (let k = 0; k < n; k++) {
    const lefts = generateColored(k, 'left');
    const rights = generateColored(n - 1 - k, 'right');
    for (const left of lefts) {
      for (const right of rights) {
        const parenColor = side === 'left' ? BLUE : side === 'right' ? RED : '';
        result.push(`${parenColor}(${RESET}${left}${right}${parenColor})${RESET}`);
      }
    }
  }
  return result;
}

function catalanPyramidColored(maxN = 3) {
  for (let n = 0; n <= maxN; n++) {
    const forms = generateColored(n);
    console.log(`n=${n}: ${forms.join(' ')}`);
  }
}

const maxN = process.argv[2] ? parseInt(process.argv[2], 10) : 3;
catalanPyramidColored(maxN);

