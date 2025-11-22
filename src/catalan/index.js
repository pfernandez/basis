import { dyck, pairs, motzkin } from './catalan.js';
import { colorizeParens } from './colorize.js'

// --- CLI args ---
const simulationArg = process.argv.find(arg => arg.startsWith('--simulation='));
const simulation = simulationArg ? simulationArg.split('=')[1] : 'dyck';
const maxNArg = process.argv.find(arg => arg.startsWith('--maxN='));
const maxN = maxNArg ? parseInt(maxNArg.split('=')[1]) : 3;
const centered = process.argv.includes('--center');
const includeSpine = process.argv.includes('--spine');

function getVisibleLength(str) {
  // Remove ANSI escape codes to measure printable width
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padToMinLength(inputString, minLength = 11, padChar = ' ') {
  if (inputString.length < minLength) {
    const charsToAdd = minLength - inputString.length;
    return inputString + padChar.repeat(charsToAdd);
  }
  return inputString;
}

console.log(
  'Running simulation...\n', 
  { simulation, maxN, centered },
  '\n'
);

const rows = [];

for (let n = 0; n <= maxN; n++) {
  let forms = simulation === 'pairs' ? pairs(n)
             : simulation === 'motzkin' ? motzkin(n)
             : dyck(n);
  if ((simulation === 'pairs' || simulation === 'motzkin') && includeSpine && n > 0) {
    // Spine depth is n+1: e.g., n=1 -> (()), n=2 -> ((()))
    const spine = '('.repeat(n + 1) + ')'.repeat(n + 1);
    const idx = forms.indexOf(spine);
    if (centered) {
      const mid = Math.floor(forms.length / 2);
      if (idx === -1) {
        forms = [...forms.slice(0, mid), spine, ...forms.slice(mid)];
      } else if (idx !== mid) {
        const reordered = forms.slice();
        reordered.splice(idx, 1);
        reordered.splice(mid, 0, spine);
        forms = reordered;
      }
    } else {
      // Show spine first when not centered
      if (idx === -1) {
        forms = [spine, ...forms];
      } else if (idx !== 0) {
        const reordered = forms.slice();
        reordered.splice(idx, 1);
        forms = [spine, ...reordered];
      }
    }
  }
  const count = forms.length;
  if (forms.length > 0) {
    const coloredForms = forms.map(colorizeParens);
    const prefix = padToMinLength( `n=${n}, c=${count}: `)
    const row = prefix + coloredForms.join(' ');
    rows.push(row);
  }
}

rows.forEach(row => {
  if (centered) {
    const maxWidth = Math.max(...rows.map(r => getVisibleLength(r)));
    const padding = Math.floor((maxWidth - getVisibleLength(row)) / 2);
    const parts = row.split(':')
    console.log(padToMinLength(parts[0], 9) + ' '.repeat(padding) + parts[1]);
  } else {
    console.log(row);
  }
});
