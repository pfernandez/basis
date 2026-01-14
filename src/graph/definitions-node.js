/**
 * Definition loader (Node integration)
 * -----------------------------------
 *
 * Reads a file containing `(def ...)` and `(defn ...)` forms and returns an
 * environment mapping names to S-expression templates.
 */

import { readFileSync } from 'node:fs';
import { parseDefinitionsSource } from './definitions.js';

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

