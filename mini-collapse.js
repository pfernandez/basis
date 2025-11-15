#!/usr/bin/env node
function collapse(node) {
  if (node === null || typeof node !== 'object') return node;
  const left = collapse(node[0]);
  const right = collapse(node[1]);
  return left === null ? right : [left, right];
}

function focus(node) {
  return (node && typeof node === 'object') ? focus(node[0]) : node;
}

function substitute(node, from, to) {
  if (node === null) return null;
  if (typeof node === 'string') return node === from ? to : node;
  return [substitute(node[0], from, to), substitute(node[1], from, to)];
}

const env = {
  I: [null, 'x'],
  K: [null, [[null, 'x'], 'y']],
};

function evalI(arg) {
  const substituted = substitute(env.I, 'x', arg);
  const collapsed = collapse(substituted);
  return { collapsed, focus: focus(collapsed) };
}

function evalK(arg1, arg2) {
  const first = collapse(substitute(env.K, 'x', arg1));
  const second = collapse(substitute(first, 'y', arg2));
  return { collapsed: second, focus: focus(second) };
}

const Ires = evalI('a');
const Kres = evalK('a', 'b');
console.log('I a collapsed =', Ires.collapsed, 'focus =', Ires.focus);
console.log('K a b collapsed =', Kres.collapsed, 'focus =', Kres.focus);
