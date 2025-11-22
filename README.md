# Basis

*A Catalan machine where `()` + local collapse yields universal computation, stable motifs, and diagrammatic structure.*

---

## Quick overview

Basis is a playground built on one idea:

> Start with `()`, allow only pairing and local collapse, and see how far structure alone can take you.

With that, this repo lets you:

- generate and explore **Catalan objects** (balanced parentheses, Dyck paths, trees),
- run a tiny **universal computer** built from these shapes,
- study **recurrent motifs and cycles** under different collapse rules,
- and, if you want, experiment with **physics-flavored** interpretations (diagrams, forces, curvature) in a controlled, combinatorial setting.

If you’re in a hurry, jump to **[Getting started](#6-getting-started)**.

---

## 1) Why `()` and Catalan?

We treat `()` as both **vacuum** and **potential**. By pairing `()` with itself we generate the classic **Catalan families**:

- balanced parentheses (Dyck words),
- binary trees,
- noncrossing diagrams.

This gives us a simple but rich **possibility space** of well-formed, nested structures.

Example (small `n`):

```text
()
(())
()()
((()))
(()())
(())()
()(())
()()()
```

You can draw each string as an up–down path:

* `(` = step up,
* `)` = step down,
* you never go below zero,
* you end where you started.

Interpretation:

* **height** in the Dyck path ≈ how many things are “open” → a notion of causal depth / “time”
* **horizontal position** ≈ where you are in the history → a notion of “space” or branching
* **the set of paths at a given length** ≈ a collection of structured histories

Basis takes this shared Catalan family as its **universe of possibilities** and then asks:
“What happens if we give it a small set of local rules for growth and collapse?”

---

## 2) What this repository is for

This repo supports three intertwined uses:

1. **Minimal universal computer from `()`**
   A pure structural SK/λ system (no opcodes):

   * binders as `(() body)`,
   * De Bruijn references `#n` (for “the n-th enclosing binder”),
   * application as pairing,
   * evaluation as **structural collapse** `(() x) ⇒ x` plus substitution.

   This shows that `()` + pairing + collapse are enough for **general computation**.

2. **Motif and cycle discovery under collapse**
   Stochastic, local collapse policies over Catalan trees reveal:

   * **recurrent motifs** (shapes that keep reappearing),
   * **fixed points** and **cycles** in the *pattern graph* (see below),
   * survival and frequency statistics for different policies.

3. **A structural lens on diagrams, gauge, and geometry** *(exploratory)*
   If you’re physics-inclined, you can read:

   * collapse events as interaction **vertices**,
   * persistent links as **propagators**,
   * whole histories as **diagram expansions**,
   * local encoding freedom as **gauge-like** redundancy,
   * motif-density gradients as **force-like** effects,
   * “collapse of computed history” as a **curvature-like** bending of structure.

Nothing here claims a finished physical theory. Everything is explicit, testable **combinatorics + code**.

You can happily ignore (3) and still get a lot of value from (1) and (2).

---

## 3) Core pieces

### A) Catalan / Dyck engine

Utilities for generating and working with Catalan families:

* balanced parentheses (Dyck words),
* trees,
* noncrossing diagrams,
* simple statistics and bijections between them.

This is the shared **substrate** for compute, motifs, and diagrams.

### B) Pure structural SK / λ (no cheats)

We interpret the same structures as a tiny λ-like language:

* **Binder:** `(() body)` introduces an argument slot.
* **Reference:** `#n` addresses the `n`-th enclosing binder (De Bruijn style).
* **Application:** `(f x)` is just binary pairing.
* **Evaluation:** repeated structural collapse

```text
(() x) ⇒ x
```

plus substitution and a few standard rules.

`programs/sk-basis.lisp` defines:

* `I`, `K`, `S`,
* booleans,
* composition,

all as **trees on this substrate**.

**Bottom line:** `()` + pairing + collapse is expressive enough to be **Turing-complete**.

You don’t need to follow all the λ-calculus details to use the rest of the repo; they are there for readers who want the programming-language angle.

### C) Collapse policies & motif discovery

Different local policies determine how the structure actually evolves:

* prefer **leftmost** branches,
* prefer **heavier/more structured** branches,
* treat exactly balanced cases as “frozen” (no collapse),
* etc.

The exploration scripts record:

* which motifs recur,
* how long they survive,
* which configurations act as **attractors**.

These are the raw data behind the geometry/diagram analogies.

### D) Pattern graph & reentry (identity as conserved form)

The raw causal evolution is acyclic: it’s a tree of events.
But if we **identify isomorphic subtrees** (same shape, different location), we can quotient down to a **pattern graph** that may have cycles:

```text
Causal tree (unfolded):         Pattern graph (quotiented):

        A                              [A]
       / \                              |
      B   B        ===>                [B]
     /     \                             \
    C       C                            [C]  (possible cycle B → C → B …)
```

In this view:

* **Recurrent motifs** behave like fixed points or “particle types”.
* **Cycles** correspond to reentry: the same structural form keeps feeding into itself.
* Many concrete embeddings of one motif-class look like many “instances” of the same thing.

This matches intuition like “one field, many quanta” or Wheeler’s “one electron” picture, but implemented as **one conserved pattern reused everywhere**, without literal time loops.

---

## 4) Dyck paths as discrete spacetime (design constraint)

Dyck words ↔ paths with:

* `(` = +1,
* `)` = −1,
* stay ≥ 0,
* return to 0.

Known scaling limits (toward Brownian-like excursions) provide a disciplined bridge from **discrete Catalan combinatorics** to **continuous path-like behavior**.

In this project we treat that as a **constraint** on dynamics:

> Any rule we propose should respect the causal cone:
> you can only change depth by one unit per step.

That keeps the discrete model loosely aligned with relativistic intuition (no “instant” arbitrarily-distant effects in the underlying walk).

---

## 5) Collapse as dynamics (and a gravity analogy)

Conceptually, you can think of a partial history as sitting in a landscape of possible continuations:

* some continuations are very constrained (few ways to keep going),
* some are very loose (many ways to extend).

The **number or weight of consistent continuations** behaves like a local “potential”:

* regions where histories tend to concentrate look like **wells**,
* differences in that potential drive **flow** toward those regions,
* the realized history bends through areas of high “density” in a way that can be read as **curvature-like**.

In practice, the code simply:

1. runs collapse policies on trees,
2. tracks motif frequencies and distributions,
3. maps where structure tends to accumulate.

This is an explicit **hypothesis lab**, not a GR/QFT package. The analogy is there for readers who want it; the computations are just tree rewrites and statistics.

---

## 6) Getting started

### Requirements

* Node.js (v18+)

### Install

```bash
npm install
```

### First things to try

Generate and inspect some Catalan structures:

```bash
npm run dyck
npm run dyck:center
npm run pairs
npm run motzkin
```

Explore collapse and motifs under different policies:

```bash
npm run motifs
npm run motifs:freeze
npm run motifs:heavier
npm run motifs:lighter
npm run motifs:left
npm run motifs:right
```

Run the SK interpreter on the structural substrate:

```bash
npm run sk

# or with custom expressions / defs:
node src/cli/sk.js --defs=programs/sk-basis.lisp "((I x) y)" "(((S K K) z))"
```

### Inspect collapse traces in a viewer

An experimental viewer lives under `src/vis/`. It renders per-step collapse snapshots, with either explicit loop arrows (binder re-entry) or true structural sharing (motifs literally fold onto themselves):

```bash
# export one or more traces into the viewer folder
npm run sk -- --trace=src/vis/trace.json "(I z)"

# serve src/vis/
npx http-server src/vis
```

Then open `http://localhost:8080` and click “Load trace.json”.

The viewer consumes the exported nodes/links trace (an array when multiple expressions are evaluated) and lets you scrub through the steps. You can also paste arbitrary graph JSON to inspect a snapshot manually.

This part is optional; everything else works fine at the CLI.

---

## 7) Repository layout

* `src/`

  * `catalan/` — Dyck/Motzkin generators, bijections, motif tools.
  * `graph/` — node/link graph core plus the new evaluator.
  * `cli/` — command-line entry points (e.g. `sk.js`, motif runners).
  * `vis/` — lightweight HTML/CSS/JS viewers for graph snapshots.
* `programs/`

  * `sk-basis.lisp` — SK, booleans, helpers in pure binder syntax.
* `scheme/`

  * `recursive.scm` — early structural attention/memory demo (Turing-style read-head).
* `docs/`

  * concept notes (overview, geometry/diagram ideas), marked exploratory.
* `tests/`

  * checks for bijections, interpreter correctness, motif stats.

If you are only interested in **computation**, focus on `src/`, `programs/`, and `tests/`.
If you are here for **concepts and physics analogies**, see `docs/` and the motif tools under `src/catalan/`.

---

## 8) Audience & stance

This repo is aimed at readers who enjoy some combination of:

* λ-calculus and combinatory logic,
* Catalan combinatorics,
* programming languages and interpreters,
* planar / diagrammatic methods,
* structural takes on memory and physics.

The **kernel / compute layers** (Catalan machine, interpreter, motif explorer) are concrete and tested.
The **diagram / gauge / geometry** layers are explicitly **exploratory** and meant to be **probed and falsified**, not taken as finished theory.

---

## 9) License

* **Code:** Apache License 2.0 (see `LICENSE`)
* **Documentation & essays (`README.md`, `docs/`):** CC BY 4.0

---

## 10) Citation (optional)

If you reference this work, you can cite it as:

```text
Paul Fernandez, “A Catalan Basis for Computation, Memory, and
Relativistic Quantum Dynamics from a Single Collapse Rule” (2025).
GitHub: pfernandez/basis.
```

