# Basis

This repository is where I keep a mix of research notes, experiments, and code around a simple but surprisingly rich family of objects: Catalan structures — balanced parentheses (Dyck paths), full binary trees, and closely related forms.

I started working with these structures because they sit at an interesting intersection of ideas I care about: recursion, syntax, computation, and the way local structure can induce global constraints. Over time, this grew into both a draft paper and a small experimental platform for exploring how far these ideas can be pushed in a concrete, hands-on way.

The goal of the repository isn’t to present a finished theory. It’s to make the work visible: the formal parts, the exploratory parts, and the code that connects them.

---

## Contents

There are two main threads running through the repo.

**1. A working research paper**

The file docs/catalan-light-cone.tex is the center of gravity. It’s a LaTeX draft of a paper that tries to state the ideas as cleanly and rigorously as possible, using standard mathematical and probabilistic tools where applicable.

That document is where definitions live, where claims are made carefully, and where speculative material is clearly separated from established results. If you’re primarily interested in the conceptual side, that’s the place to start.

For convenience:

* Main paper PDF: `docs/catalan-light-cone.pdf` (built from `docs/catalan-light-cone.tex`)
* Companion supplement PDF (extra appendices/proofs): `docs/catalan-light-cone-supplement.pdf` (built from `docs/catalan-light-cone-supplement.tex`)
* Working notes / intuition (not arXiv-rigorous): `docs/IDEAS.md`, `docs/ARCHIVE.md`, `docs/intuition.md`
* Legacy drafts (historical; not maintained): `docs/catalan-collapse.tex`, `docs/geometry-of-possibility.tex`

**2. An experimental codebase**

Alongside the paper is code I use to explore and test ideas before (and while) they make their way into formal writing. This includes:
* Generators for Dyck paths, trees, and alternative Catalan normal forms
* Small experiments with local rewrite or “collapse” rules on trees
* Tools for enumerating, normalizing, and comparing structures
* A minimal graph-based evaluator for SK-style combinator expressions
* Trace and visualization tools for stepping through reductions

The code isn’t meant to be a polished framework. It’s a laboratory: something I can run, tweak, and inspect to see what actually happens when simple rules are applied repeatedly.

---

## What the work is about

At a high level, the project explores how much structure you can get from:
- Purely combinatorial objects with a nesting constraint
- Local, syntax-level transformations on trees
- Familiar computational primitives expressed structurally
- Standard scaling limits of conditioned random walks

Rather than starting from equations or physical interpretation, the emphasis is on structure first: how paths, trees, and programs relate to one another, what invariants they share, and what kinds of patterns recur when you explore them algorithmically.

Some of these directions connect naturally to known results; others are still very much “let’s see what happens if…”. Both live here side by side.

---

## Navigating the repo

A quick map:
* docs/ - The paper and working notes.
* src/catalan/ - Generators, normal forms, local rewrite rules, and motif exploration for
Catalan objects.
* src/graph/ - A small graph-based evaluator used to study structural computation and
reduction traces.
* programs/ - Example combinator definitions built up into a minimal Lisp, and related test programs.
* src/vis/ - A lightweight browser-based trace viewer.
* tests/ - Unit tests that keep the experiments honest.
* lib/ - A small functional UI toolkit for use in demos and visualization.

---

## Running things

Most everything runs under Node.js:

```sh
npm install
npm test
```

### 3D trace viewer

The graph reducer can emit a step-by-step JSON trace that you can watch in a
browser using `3d-force-graph`.

1) Generate a trace:

```sh
node src/cli/sk.js --trace=src/vis/trace.json "(I z)"
```

2) Serve the repo root (so the viewer can load `/node_modules/...`):

```sh
python -m http.server
```

3) Open `http://localhost:8000/src/vis/`.

The viewer has basic controls for stepping/playing the trace, and toggles for
showing tree vs pointer edges (and folding bound slots into the tree view).

There are also small CLI scripts for enumeration, collapse-policy exploration,
and evaluation (see package.json for entry points). Some scripts emit trace
data that can be viewed interactively in the browser.

---

This repo exists because I find these structures genuinely interesting, and
because having the paper, the code, and the experiments in one place makes it
easier to think clearly about them. If you’re curious too, you’re very welcome
to poke around.
