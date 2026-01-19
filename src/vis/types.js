/**
 * Shared visualization types
 * -------------------------
 *
 * This file is JSDoc-only: it exists to keep structural types consistent across
 * `domain/`, `simulation/`, and `view/` modules.
 */

/**
 * @typedef {{
 *   kind: string,
 *   fromIndex: number,
 *   toIndex: number
 * }} Segment
 */

/**
 * @typedef {{
 *   nodeIds: string[],
 *   nodeIndexById: Map<string, number>,
 *   positions: Float32Array,
 *   segments: Segment[],
 *   step: (deltaSeconds: number) => void,
 *   dispose: () => void
 * }} SimulationEngine
 */

export {};
