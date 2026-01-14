/**
 * Graph evaluator (Node integration)
 * ---------------------------------
 *
 * Re-exports:
 * - `loadDefinitions` (Node-only file I/O)
 * - `evaluateExpression` (browser-safe evaluator core)
 */

export { loadDefinitions } from './definitions-node.js';
export { evaluateExpression } from './evaluator.js';

