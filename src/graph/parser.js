/**
 * Parse Lisp-style S-expressions into plain JavaScript arrays.
 */

function clean(source) {
  return source.replace(/;.*$/gm, '');
}

function tokenize(source) {
  return clean(source)
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function read(tokens) {
  if (!tokens.length) throw new Error('Unexpected EOF while reading');
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')') {
      list.push(read(tokens));
      if (!tokens.length) throw new Error('Missing )');
    }
    tokens.shift();
    return list;
  }
  if (token === ')') {
    throw new Error('Unexpected )');
  }
  if (!Number.isNaN(Number(token))) {
    return Number(token);
  }
  return token;
}

export function parseSexpr(source) {
  const tokens = tokenize(source);
  if (!tokens.length) return null;
  const expr = read(tokens);
  if (tokens.length) {
    throw new Error('Extra content after expression');
  }
  return expr;
}

export function parseMany(source) {
  const tokens = tokenize(source);
  const expressions = [];
  while (tokens.length) {
    expressions.push(read(tokens));
  }
  return expressions;
}
