# The Catalan Rule — Overview

This document is the conceptual front door for the project.

If the repository root says **what** exists, this explains **why** it exists and **how the pieces relate**—without assuming you’ve already signed up for any of the physics speculation.

---

## 1. Starting Point: `()` as Vacuum + Structure

We commit to a minimal ontology:

- `()` is the **vacuum symbol**.
- Pairing `()` with itself (and with larger paired forms) gives us:
  - balanced parentheses (Dyck words),
  - binary trees,
  - noncrossing matchings.

These are all classic **Catalan** objects.

We take them as:

- a **possibility space** of well-formed configurations,
- a discrete model of **nested causality** (opens before closes),
- the substrate on which we test:
  1. universal computation,
  2. stable motifs and cycles,
  3. physics-like diagrammatics,
  4. reflective memory / attention mechanisms.

Everything else is built on top.

---

## 2. Dyck Paths as Discrete Spacetime Sketches

Each Dyck word can be viewed as a path:

- `(` = up-step, `)` = down-step,
- never go below height 0,
- start and end at 0.

Example (small `n`):

```text
n = 0:
    ()

n = 1:
    (())
    ()()

n = 2:
    ((()))
    (()())
    (())()
    ()(())
    ()()()
