/**
 * Definition loader (surface syntax convenience)
 * ---------------------------------------------
 *
 * Reads a file containing `(def ...)` and `(defn ...)` forms and returns an
 * environment mapping names to S-expression templates.
 *
 * This module is intentionally about syntax and authoring convenience. The
 * core machine dynamics do not depend on it.
 */

import { readFileSync } from 'node:fs';
import { parseMany } from './parser.js';
import { invariant } from '../utils.js';
import { lambdaMarker } from './compile.js';

/**
 * Desugar `(defn name (x y …) body)` into nested lambdas `λx.λy.… body`.
 *
 * In this repo, lambdas are represented in S-expression skeletons as
 * `[[], body]` (a pair whose left child is the empty list).
 *
 * @param {any[]} params
 * @param {any} body
 * @returns {any}
 */
function desugarParamsToLambdas(params, body) {
  invariant(Array.isArray(params), 'defn params must be a list');
  if (!params.length) return body;

  const [first, ...rest] = params;
  // Named binder marker so we can resolve occurrences by name while building
  // the pointer graph (no intermediate `#n` rewrite required).
  return [lambdaMarker(first), desugarParamsToLambdas(rest, body)];
}

/**
 * Normalize a `(def …)` or `(defn …)` form into `{ name, body }`.
 *
 * @param {any[]} form
 * @returns {{ name: string, body: any }}
 */
function normalizeDefinitionForm(form) {
  if (!Array.isArray(form) || form.length < 3) {
    throw new Error('Each form must be (def name body)');
  }

  if (form[0] === 'def') {
    const [, name, body] = form;
    return { name, body };
  }

  if (form[0] === 'defn') {
    const [, name, params, body] = form;
    return { name, body: desugarParamsToLambdas(params, body) };
  }

  throw new Error(`Unsupported form ${form[0]}`);
}

/**
 * Load all `(def …)` / `(defn …)` forms from a file path.
 *
 * @param {string} path
 * @returns {Map<string, any>} Map of name → S-expression template
 */
export function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  const forms = parseMany(source);

  const env = new Map();
  forms.forEach(form => {
    const normalized = normalizeDefinitionForm(form);
    env.set(normalized.name, normalized.body);
  });
  return env;
}
