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
- `src/catalan/*.js` modules are pure helpers used by tests and experiments.
- Node entrypoints live in `src/catalan/*-cli.js` (thin wrappers with I/O).
- The enumerators are ordered deterministically (e.g. `pairs(n)` matches
  `dyck(n)` under the Dyck ↔ tree bijection).

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
