import { dyck, pairs } from './catalan.js';
import { colorizeParens } from './colorize.js'

// --- CLI args ---
const simulationArg = process.argv.find(arg => arg.startsWith('--simulation='));
const simulation = simulationArg ? simulationArg.split('=')[1] : 'dyck';
const maxNArg = process.argv.find(arg => arg.startsWith('--maxN='));
const maxN = maxNArg ? parseInt(maxNArg.split('=')[1]) : 3;
const centered = process.argv.includes('--center');

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
  const forms = simulation === 'pairs' ? pairs(n) : dyck(n);
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

