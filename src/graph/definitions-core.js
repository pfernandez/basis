/**
 * Definition parsing (pure)
 * -------------------------
 *
 * Parses a source string containing `(def ...)` and `(defn ...)` forms into an
 * environment mapping names to S-expression templates.
 *
 * This file intentionally contains no Node-only I/O so it can be shared by:
 * - CLI/tests (via `definitions.js` / `loadDefinitions`)
 * - browser visualizers (via `parseDefinitionsSource`)
 */

import { parseMany } from './parser.js';
import { lambdaMarker } from './compile.js';
import { invariant } from '../utils.js';

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

  throw new Error(`Unsupported form ${String(form[0])}`);
}

/**
 * Parse a program source containing `(def …)` / `(defn …)` forms.
 *
 * @param {string} source
 * @returns {Map<string, any>} Map of name → S-expression template
 */
export function parseDefinitionsSource(source) {
  const forms = parseMany(source);
  const env = new Map();

  forms.forEach(form => {
    const normalized = normalizeDefinitionForm(form);
    env.set(normalized.name, normalized.body);
  });

  return env;
}

