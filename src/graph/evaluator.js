/**
 * Graph evaluator (Node integration layer)
 * ---------------------------------------
 *
 * Re-exports:
 * - `loadDefinitions` (Node-only file I/O)
 * - `evaluateExpression` (browser-safe core evaluator)
 */

export { loadDefinitions } from './definitions.js';
export { evaluateExpression } from './evaluator-core.js';

