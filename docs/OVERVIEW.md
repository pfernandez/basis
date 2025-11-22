# Basis — Conceptual Overview

This document is the **big-picture tour** of Basis.

The README tells you how to run things.  
Here we focus on **what the project is about** and **how the pieces fit together**, without assuming any background in physics or category theory.

---

## 1. The whole idea in one paragraph

Basis starts from the simplest thing we can write:

```text
()
```

and the rule “you can always put one pair of parentheses inside another, or next to another.” From that alone you get:

* a huge family of **well-formed bracket strings**,
* simple **up–down paths** you can draw on a grid,
* and **binary trees** made of pairs.

We treat this shared family as a **toy universe of possibilities**:

* each structure is a tiny “history” of how something could unfold,
* we let local rules make those histories grow or collapse,
* and we watch what kinds of patterns, computations, and “forces” emerge.

That’s all Basis is: a place to experiment with **structure + local rules** and see how far it gets you.

---

## 2. A universe made of `()`

The starting symbol is:

* `()` = “a unit of structure” and “a bit of empty space” at the same time.

If you nest and line up these pairs, you get things like:

```text
()
(())
()()
(()())
((()))
```

These belong to a famous combinatorial family called the **Catalan numbers**. You don’t need the formula; what matters is:

* they count **all** ways of making properly nested structures,
* the same family shows up as:

  * balanced parentheses (strings),
  * paths that go up and down,
  * binary trees,
  * non-crossing diagrams.

Basis uses this family as its **possibility space**:
every object you see is one of these well-nested shapes.

---

## 3. Dyck paths as simple spacetime sketches

Take a balanced string and read it as a little walk:

* `(` means “go up by 1”,
* `)` means “go down by 1”,
* you’re not allowed to go below 0,
* you must end back at 0.

Example:

```text
word:   ( ( ) ( ) )
step:   + + - + - -
height: 0 1 2 1 2 1 0

    2 |      /\
    1 |   /\/  \
    0 |__/      \__
       0 1 2 3 4 5 6   (horizontal = steps)
```

You can read this picture as a **toy spacetime diagram**:

* vertical axis (height) ≈ how many things are “open” → a notion of **depth** or “time”;
* horizontal axis (steps) ≈ where in the sequence you are → a notion of **breadth** or “space”.

If you take many such paths and scale them up, they start to look like smooth, random curves. That gives a bridge from this discrete world to ordinary continuous math, but you don’t need that to play with the code.

For Basis, this picture is a **design constraint**:

> Whatever rules we use, they should respect this “cone” shape:
> you can only go one step deeper or shallower at a time.

---

## 4. Collapse: how change happens

So far we only have shapes. Dynamics comes from **local rewrite rules**.

The most basic one is:

```text
(() x)  ⇒  x
```

You can think of this as:

* “a neutral wrapper around `x` disappears”, or
* “an identity function applied to `x` returns `x`”.

More generally, the repo experiments with **policies** for deciding what to do at a given pair:

* sometimes prefer the **left** side,
* sometimes pick the **heavier / more structured** side,
* sometimes treat perfectly balanced situations as “entangled” and don’t collapse them at all.

What we measure is:

* which small shapes (motifs) show up over and over,
* how often certain patterns survive,
* how many ways a partial history can be extended consistently.

There is a **gentle analogy with physics**:

* places where motifs cluster look like **potential wells**,
* differences in motif “density” look like **forces**,
* the sequence of collapses bends the underlying tree in a way that can be read as **curvature**.

You don’t have to buy the physics analogy to use any of this—everything is just tree rewriting and statistics.

---

## 5. Yes, this can run real programs

Under the hood, Basis also treats these trees as a tiny **programming language**.

Very roughly:

* A **function** is a tree with a “hole” for an argument.
* An **application** is just a pair `(f x)`.
* The rule `(() x) ⇒ x` acts like an **identity function**.
* With a bit more encoding (explained in the repo), you can:

  * define the classic SK combinators,
  * represent functions without variable names,
  * build booleans, conditionals, and simple programs.

All of this lives in plain text files (e.g. a small Lisp-style basis and a simple interpreter).

The important takeaway for a non-specialist:

> This substrate isn’t just pretty pictures.
> It’s powerful enough to express general computation.

So the same objects can be read as:

* **histories** (how structure evolves),
* **programs** (what to compute),
* **configurations** (what “field” is present).

---

## 6. Patterns, loops, and structural sharing

When you run the dynamics, the same shapes appear again and again.

One useful view is:

```text
Causal tree
   ↓  (identify identical subtrees)
Pattern graph    (nodes = motifs, edges = "can flow into")
```

In that pattern graph:

* **fixed motifs** behave like persistent “identities” or particles,
* **cycles** correspond to re-entry: the same form keeps coming back,
* one motif can appear in **many places at once**, so we track the shape, not just a single location.

This gives you a way to talk about:

* “this structure is conserved”,
* “this cluster of forms keeps feeding into itself”,
* “many different concrete histories share the same abstract pattern”.

If you know physics, you can see how this smells like:

* Feynman diagrams (paths of interaction),
* loop diagrams (feedback),
* Wheeler-style “law without law” ideas.

If you don’t know physics, it’s just:
**a graph of repeating shapes and how they connect.**

---

## 7. Where the physics language comes in (optional)

Some folders and notes in the repo use physics-flavored words:
“fields”, “gauge”, “diagrams”, “collapse force”, etc.

You can read those as:

* **Feynman-like diagrams**:
  nodes = collapse events, lines = persistent links between motifs.
* **Gauge-like freedom**:
  if we color or phase-label parts of the tree, there are many ways to describe the same observable behavior. Changing those labels without changing anything measurable acts like a “gauge transformation”.
* **Loop invariants**:
  going around a closed loop and multiplying contributions can give quantities that stay the same under local changes.

These ideas are **work in progress** and meant as hypotheses to test:

* Can we rebuild familiar physics diagrams from nothing but:

  * Catalan histories,
  * local collapse rules,
  * and weights/phases on motifs?
* Can some “symmetries” and “effective couplings” appear statistically from which histories actually get realized?

If this isn’t your interest, you can safely ignore this layer and stay with the combinatorics / interpreter parts.

---

## 8. Attention, memory, and agents (where this can go)

Earlier prototypes in this line of work used a tiny Scheme:

* a **frame** as `(focus . rest)`,
* a **program** as a list of “move the focus” operations,
* an **agent** as “an id + a procedure” walking over memory.

Basis reuses that spirit on the new substrate:

> One kind of structure for everything:
> computation, memory, and “what is being observed”.

The long-term goal is to have:

* agents that move through the tree,
* memory that is just more of the same structure,
* no sharp line between “data”, “program”, and “state”.

Right now this is mostly hinted at in essays and early code; it’s here to show where the project is pointed.

---

## 9. Concept stack (at a glance)

Here is the full stack on one page:

```text
   [ Physical / Semantic Interpretations ]
      Diagrams, symmetry ideas, gravity-like analogies
                               |
   [ Pattern Graph ]
      motifs, cycles, reentry, conserved forms
                               |
   [ Dynamics / Collapse ]
      local rules, evaluation, motif statistics
                               |
   [ Catalan Structures ]
      Dyck words, trees, noncrossing diagrams
                               |
   [ `()` ]
      vacuum symbol, pure pairing
```

* The **bottom layers** (`()`, Catalan structures, local rules) are concrete and fully implemented.
* The **upper layers** (diagrams, gauge, gravity analogies) are exploratory and can be read as open questions.

---

## 10. How to explore the repo

See the main `README.md` for up-to-date commands and file paths.
Conceptually, you can approach Basis as:

1. **A combinatorics playground**

   * Generate and visualize Catalan objects and Dyck paths.
2. **A tiny interpreter / computation lab**

   * Play with SK-style programs and the `(() x) ⇒ x` collapse rule.
3. **A pattern and motif explorer**

   * Run motif discovery, see which shapes recur, and how collapse rules affect them.
4. **A hypothesis lab for “geometry from structure”**

   * If you’re curious about physics links, connect this to ideas from quantum field theory, gravity, or information theory.

Each layer stands on its own.
You can ignore the speculative parts and still get a lot of value from the core combinatorics and interpreter pieces.
