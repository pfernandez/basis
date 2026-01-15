# Agent Guide (Basis)

This repo is a research + prototype codebase exploring Catalan structures
(Dyck words, binary trees) and a graph-reduction evaluator/visualizer for
combinators (SK, fixpoints, etc.). Treat tests as the executable spec.

## High-level Goal

Build a clean, maintainable platform where:
- A small, pure "kernel" models discrete state and local rewrites.
- Multiple equivalent stepping strategies can be plugged in (deterministic,
  stochastic/RNG, physics-guided).
- Visualizations make "sharing" and "rewriting" explicit, not magical.

## Non-negotiable Constraints

- Formatting: keep max line length 80 columns in new/edited files.
- Documentation: add JSDoc for all functions you touch or add.
- Purity: kernel/domain logic must be side-effect free (no I/O, no mutation,
  no `console.*`). Side effects live in explicit adapters and UI.
- Determinism: prefer replayable traces. If you introduce randomness, thread
  an RNG/seed explicitly and log decisions as data.

## Repository Map

More detail: `docs/PROJECT_MAP.md`.

**Core (semantic)**
- `src/graph/`: current pointer-graph evaluator kernel (pair/tree substrate +
  pointer-based binding). Treat as the canonical reference implementation.
- `programs/`: Lisp-ish combinator definitions (e.g. `sk-basis.lisp`).
- `tests/graph-evaluator.test.js`: canonical semantics examples.

**Visualizer**
- `src/vis/domain/`: pure state/trace generation for the visualizer
  (Graphology snapshots + undo/redo history).
- `src/vis/simulation/`: Jolt Physics world management (WASM).
- `src/vis/view/`: Three.js rendering + camera controls.
- `src/vis/main.js`: orchestration + input handling.

**Catalan research tooling**
- `src/catalan/`: generators/bijections and local-collapse experiments.
  These scripts are useful for possibility-space exploration, but some are
  older and do not yet follow the stricter style rules. Prefer extracting
  reusable pure helpers and keeping CLI entrypoints thin.

**Node-only entrypoints**
- `src/cli/`: CLI wrappers for experiments/traces. Keep these as adapters.

**Docs**
- `docs/catalan-light-cone.tex`: the main LaTeX draft (translation layer for
  physicists). Treat as non-authoritative compared to tests/code.
- `docs/debris/`: legacy drafts and notes; reference-only.

## Current Evaluator Semantics (src/graph/)

The pointer machine is intentionally nonstandard:
- Application updates one indirection cell: `binder.valueId = argRoot`.
- Collapse is structural: `(() x) → x` (bypass a pair whose left is empty).
- Normal-order stepping uses an explicit observer (leftmost-outermost).
- "Weak" vs "full" phases control reduction under lambdas.

Cloning policy:
- The applied lambda is always cloned (fresh binder cell per call site).
- Argument cloning is optional (`cloneArguments`), trading substitution-like
  traces vs call-by-need graph sharing.

## Node vs Browser Modules

Shared modules must be browser-safe (no `node:*` imports).
Use `*-node.js` adapters for Node-only I/O:
- `src/graph/definitions.js` parses definition sources (pure).
- `src/graph/definitions-node.js` loads from disk (Node-only adapter).
- `src/graph/evaluator.js` is browser-safe orchestration (pure).
- `src/graph/evaluator-node.js` is the Node adapter for CLI/tests.

## Commands

- Tests: `npm test`
- Visualizer dev server: `npm run vis:dev` then open `http://localhost:8000/`
- Visualizer build: `npm run vis:build`

## Adding New Stepping Strategies

Preferred shape:
- Define discrete `Action` data and a pure `applyAction` in the kernel.
- Implement "choosers" that pick the next `Action`:
  - deterministic observer (current default)
  - RNG sampler (explicit seed)
  - physics-guided (use simulation observations, but keep choice logged)

Avoid coupling physics to semantics: the simulator should provide observations
(constraint strain, energy, proximity) and the chooser uses those to decide.
