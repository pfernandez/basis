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
 * Integer half-extents for visualization grids.
 *
 * Values are measured in grid steps from the origin (e.g. `x: 10` spans
 * `[-10, +10]`).
 *
 * @typedef {{
 *   x: number,
 *   y: number,
 *   z: number
 * }} GridDimensions
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
