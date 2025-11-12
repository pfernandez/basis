# A Catalan Basis for Computation, Memory, and Relativistic Quantum Dynamics from a Single Collapse Rule

*A Catalan machine where `()` + local collapse yields universal computation, stable motifs, and diagrammatic structure.*

> **Project nickname:** **Basis**  
> **One-liner:** Pure `()` + local collapse → SK computation, motif memory, and causal/diagrammatic structure.

---

## 1) Why `()` and Catalan?

We take `()` as **vacuum** and **potential**. By pairing `()` with itself we generate the classic **Catalan** families:

- balanced parentheses (Dyck words),
- binary trees,
- noncrossing diagrams.

This gives us a **possibility space** with nested causality (“opens before closes”), on which we define a **single collapse rule** and measure what structures persist.

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

Interpretation:

- **height** in the Dyck path ≈ causal depth / “time”  
- **horizontal breadth** ≈ branching / “space” (relative, not absolute)
- **ensemble of Dyck paths** ≈ structured histories

---

## 2) What this repository is for

1. **Minimal universal computer from `()`**  
   A pure structural SK/λ system (no opcodes): binders as `(() body)`, De Bruijn references `#n`, application as pairing, evaluation as **structural collapse** `(() x) ⇒ x`.

2. **Motif and cycle discovery under collapse**  
   Stochastic/local collapse policies over Catalan trees reveal **recurrent motifs**, **fixed points**, and **cycles** in the *pattern graph* (the quotient of repeated shapes).

3. **A structural lens on diagrams, gauge, and geometry** *(exploratory)*  
   - collapse events ↔ interaction **vertices**  
   - persistent links ↔ **propagators**  
   - histories ↔ **diagram expansions**  
   - local encoding freedom ↔ **gauge-like** redundancy  
   - motif-density gradients ↔ **force-like** effects  
   - “collapse of computed history” ↔ **curvature-like** behavior

Nothing here claims a finished physical theory; everything is explicit and testable as combinatorics + code.

---

## 3) Core pieces

### A) Catalan / Dyck engine
Utilities for generating/manipulating Catalan families (Dyck words, trees, noncrossing diagrams). This is the shared substrate for compute, motifs, and diagrams.

### B) Pure structural SK / λ (no cheats)
- Binder: `(() body)` introduces an argument slot.  
- Reference: `#n` addresses the `n`-th enclosing binder (De Bruijn).  
- Application: binary pairing.  
- Evaluation: repeated structural collapse `(() x) ⇒ x` + substitution.

`programs/sk-basis.lisp` defines `I`, `K`, `S`, booleans, composition—**all as trees**.

**Conclusion:** `()` + pairing + collapse is **Turing-complete**.

### C) Collapse policies & motif discovery
Scripts explore different local policies (leftmost/heaviest/balanced/etc.) and record:
- which motifs recur,
- survival distributions,
- structural “attractors”.

These are the raw data for the geometry/diagram analogies.

### D) Pattern graph & reentry (identity as conserved form)
The causal evolution is acyclic, but when we *identify isomorphic subtrees*, the **pattern graph** can have cycles:

```text
Causal tree (unfolded):         Pattern graph (quotiented):

        A                              [A]
       / \                              |
      B   B        ===>                [B]
     /     \                             \
    C       C                            [C]  (possible cycle B→C→B…)
```

- **Recurrent motifs** = fixed points
- **Cycles** = reentry of the same structural form
- **Indistinguishable “particles”** = many embeddings of one motif-class

This matches “one field, many quanta” / Wheeler-style “one electron” as *one conserved pattern reused everywhere*—without loops in time.

---

## 4) Dyck paths as discrete spacetime (design constraint)

Dyck words ↔ paths (`(`=+1, `)`=−1, stay ≥ 0, return to 0). Known scaling limits (to Brownian-like excursions) provide a disciplined bridge from discrete Catalan combinatorics to **continuous path-like behavior**. Any dynamic we propose should respect this causal, relativistic scaffolding.

---

## 5) Collapse as dynamics (and a gravity analogy)

Given a partial history $begin:math:text$H$end:math:text$, the number/weight of **consistent continuations** defines a local “potential.” Then:

- **motif density** (histories concentrate) behaves like a well,
- **gradients** in that density act like forces,
- **curvature-like** behavior appears where realized history is densest.

In code, we probe this by running collapse policies, measuring motif frequencies, and mapping structural wells. This is an explicit **hypothesis lab**, not a GR/QFT claim.

---

## 6) Getting started

### Requirements
- Node.js (v18+)

### Install
```bash
npm install
```

### Explore Catalan structures
```bash
npm run dyck
npm run dyck:center
npm run pairs
npm run motzkin
```

### Explore collapse & motifs
```bash
npm run motifs
npm run motifs:freeze
npm run motifs:heavier
npm run motifs:lighter
npm run motifs:left
npm run motifs:right
```

### Run the SK interpreter
```bash
npm run sk
# or with custom expressions / defs:
node src/sk.js --defs=programs/sk-basis.lisp "((I x) y)" "(((S K K) z))"
```

---

## 7) Repository layout

- `src/`
  - `catalan.js` — generate Dyck/Motzkin/pair families
  - `dyck-tools.js` — parsing, normalization, catalogs
  - `collapse-policy.js` — pluggable local rules
  - `motif-discover.js` — motif search under collapse
  - `sk.js` — pure structural SK/λ engine
- `programs/`
  - `sk-basis.lisp` — SK, booleans, helpers in pure binder syntax
- `scheme/`
  - `recursive.scm` — early structural attention/memory demo (Turing-style read-head)
- `docs/`
  - concept notes (overview, geometry/diagram ideas)
- `tests/`
  - checks for bijections, interpreter correctness, motif stats

---

## 8) Audience & stance

For readers who enjoy λ-calculus, Catalan combinatorics, PL theory, planar/diagrammatic methods, and reflective memory. The **kernel** (Catalan Machine) and **compute** layers are concrete; the **diagram/gauge/geometry** layers are marked exploratory and are meant to be tested, not believed.

---

## 9) License

- **Code:** Apache License 2.0 (see `LICENSE`)
- **Documentation & essays (`README.md`, `docs/`):** CC BY 4.0

---

## 10) Citation (optional)

If you reference this work:

```
Paul Fernandez, “A Catalan Basis for Computation, Memory, and Relativistic Quantum Dynamics from a Single Collapse Rule” (2025). GitHub: pfernandez/basis-catalan.
```