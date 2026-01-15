# Project Map

This file is a short, practical guide for navigating the codebase.

## What To Treat As Canonical

- Semantics: `src/graph/` + `tests/graph-evaluator.test.js`
- Definitions/programs: `programs/` (especially `programs/sk-basis.lisp`)
- Visualizer wiring: `src/vis/`

## src/graph/ (Pointer-Machine Evaluator)

Purpose: a pure, browser-safe evaluator for a nonstandard pointer semantics.

Key modules:
- `src/graph/graph.js`: immutable node store + cloning helpers
- `src/graph/machine.js`: observer + local rewrites (`apply`, `collapse`)
- `src/graph/runner.js`: "step until stuck" orchestration helper
- `src/graph/serializer.js`: debug S-expression serializer
- `src/graph/trace.js`: view-only snapshots (includes re-entry links)

Node-only adapters:
- `src/graph/definitions-node.js`, `src/graph/evaluator-node.js`

## src/vis/ (3D Visualizer)

Purpose: render and interact with reduction traces.

Separation of concerns:
- `src/vis/domain/`: pure trace/state (Graphology graphs + history)
- `src/vis/simulation/`: physics embedding (Jolt WASM)
- `src/vis/view/`: rendering + camera (Three.js)
- `src/vis/main.js`: app orchestration + input mapping

## src/catalan/ (Catalan Space Tooling)

Purpose: enumerate and analyze Catalan objects and related local rewrite
experiments.

Status:
- Used by tests and scripts, but some files predate the stricter style rules.
- Prefer factoring reusable pure helpers out of CLI scripts over rewriting
everything at once.

If a file must be edited, modernize only the touched surface:
- keep line length ≤ 80
- add JSDoc for modified functions
- avoid adding new global process/CLI parsing in shared modules

## src/cli/ (Entry Points)

Purpose: thin Node wrappers around core modules.

Rule: keep `node:*` imports here (or in `*-node.js` adapters), not in shared
modules used by the browser visualizer.

## tests/

Purpose: executable proofs / regression suite.

Categories:
- `tests/graph-evaluator.test.js`: evaluator semantics (highest priority)
- `tests/*.test.js` under Catalan: enumerators, bijections, policy tools

Do not delete tests when refactoring; rewrite them only when the intended
semantics changes and you can explain the new invariant.

## src/kernel/ (Pluggable Action Surface)

Purpose: a long-term home for replayable `Action` transitions and reducer /
scheduler interfaces.

Current contents:
- `src/kernel/actions.js`: apply an action (pure)
- `src/kernel/stepper.js`: reducer + scheduler orchestration
- `src/kernel/reducers/`: reducer plugins (normal-order pointer machine today)
- `src/kernel/schedulers/`: scheduler plugins (deterministic today)
