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
import { parseDefinitionsSource } from './definitions-core.js';

/**
 * Load all `(def …)` / `(defn …)` forms from a file path.
 *
 * @param {string} path
 * @returns {Map<string, any>} Map of name → S-expression template
 */
export function loadDefinitions(path) {
  const source = readFileSync(path, 'utf8');
  return parseDefinitionsSource(source);
}
