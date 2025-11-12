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
```

Path view (height vs position) for a simple word like (()()):

```text
word:   ( ( ) ( ) )
step:   + + - + - -
height: 0 1 2 1 2 1 0

    2 |      /\
    1 |   /\/  \
    0 |__/      \__
       0 1 2 3 4 5 6  (position)
```

This suggests:
- height ≈ causal depth / “time”,
- horizontal position / branching ≈ “space” / multiplicity of compatible futures,
- Dyck ensemble ≈ structured histories of a system.

Known scaling limits (Dyck paths → Brownian excursions) provide a rigorous bridge from:

discrete Catalan combinatorics → continuous path-like behavior.

We use that as a design constraint: any dynamics we propose should make sense on this spacetime-like scaffold.

⸻

## 3. Collapse as Dynamics (and a Gravity Analogy)

On this scaffold, we define local collapse rules: ways to rewrite or “evaluate” Catalan structures.

At minimum:
- (() x) ⇒ x (a binder applied to an argument collapses structurally)

And more generally:
- 	policies that prefer:
- 	leftmost vs rightmost,
- 	deeper vs shallower,
- 	heavier vs lighter branches,
- 	or only certain balanced subforms.

We then:
- 	run these rules on Catalan trees,
- 	track which shapes:
- 	recur frequently,
- 	survive as stable substructures,
- 	act as attractors.

This supports a structural analogy:
- 	For a partial history (H), let allowed future continuations be its consistent extensions.
- 	Regions/motifs that admit many extensions behave like wells:
- 	histories “fall into” them.
- 	Regions/motifs that drastically restrict extensions act like barriers.

Interpreted cautiously:
- 	motif density ~ how many histories pass through a configuration,
- 	forces ~ gradients in this density / consistent-futures count,
- 	gravity-like behavior ~ the tendency of collapse dynamics to concentrate histories into certain structural wells.

This is not GR, but it is a concrete way to study:

“collapse of realized history shapes effective geometry.”

The code lets you experiment with this rather than just read about it.

⸻

## 4. Pure Structural SK / λ from ()

To ensure the foundation isn’t hand-wavy, we implement a minimal universal computer directly on the same substrate.

Core encoding:
- 	Binders as (() body) — introduce an argument slot.
- 	Variables as #n — De Bruijn index into enclosing binders.
- 	Application as binary pairing.
- 	Evaluation as repeated structural collapse:
- 	(() x) ⇒ x plus recursive substitution.

In programs/sk-basis.lisp we define:
- 	I, K, S,
- 	booleans,
- 	function composition,

purely as Catalan trees, with no extra opcodes.

Conclusion:

The () + pairing + collapse universe is Turing-complete.

This computational core is intentionally tight and independently valuable, even if you ignore all physical analogies.

⸻

## 5. Motifs, Cycles, and Structural Sharing

Given an acyclic causal evolution (no loops in time), we do something crucial:
	1.	Identify isomorphic subtrees / motifs in the history.
	2.	Collapse each equivalence class into a node in a pattern graph.

The pattern graph can contain cycles even though the underlying causal tree is acyclic.

ASCII sketch:
```text
Causal tree (unfolded):

        A
       / \
      B   B
     /     \
    C       C
```

Pattern graph (quotiented by shape):

```text
    [A]
     |
    [B]
     |
    [C]
```

If A → B → C → B → C ... patterns repeat,
the pattern graph may show cycles even though time doesn't loop.

Interpretation:
- 	Recurrent motifs = fixed points of the dynamics.
- 	Cycles in the pattern graph = reentry of the same structural form.
- 	Indistinguishable “particles” or “roles” = many embeddings of the same motif-class in different regions of the causal tree.

This offers a clean structural reading of:
- 	“one field, many quanta,”
- 	Wheeler-style “one electron” as one conserved pattern re-used everywhere,

without violating causality.

⸻

## 6. Diagrams, Gauge, and Fields (Work in Progress)

The same machinery naturally touches familiar field-theoretic structures:

Feynman-like diagrams
- 	Local collapse events ↔ interaction vertices.
- 	Persistent links / substructures ↔ propagators.
- 	Complete collapse histories ↔ diagrams summing possible interaction patterns.

In this view, diagrams are compressed views of Catalan rewrite histories.

Gauge-like freedom

Once we attach internal labels to motifs (e.g. phases, “colors”):
- 	multiple local encodings that yield the same observable motif patterns
behave like gauge transformations:
- 	local changes of representation,
- 	no change in physical invariants (closed-loop traces, motif frequencies, etc.).

Wilson-loop style structures

Closed structural loops and their invariants over internal labels:
- 	can be defined directly on the Catalan / noncrossing diagrams,
- 	providing a natural place to study confinement-like behavior via loop expectations.

These connections are framed here as questions to test:
- 	Can standard diagrammatics be reconstructed as views of Catalan histories + weights?
- 	Can gauge redundancies and effective couplings emerge from the statistics of realized vs unrealized possibilities?

The code is organized so we can approach this incrementally, starting from solid combinatorics.

⸻

## 7. Attention & Memory (Scheme Experiment)

An early Scheme fragment (kept intentionally) models:
- 	a frame as (cons focus rest),
- 	a program as a list of navigation ops,
- 	an agent as:
- 	an identifier,
- 	plus a procedure for walking that structure.

This was an initial attempt at:
- 	a self-evaluating structural computer, and
- 	a Turing-like read-head over memory:
- 	an attention mechanism that traverses and rewrites cons-based histories.

While the modern SK/Catalan engine is cleaner, the intent is the same:

unify computation, memory, and observation as operations on the same ()-based substrate.

⸻

## 8. Putting the Pieces Together (Diagram)

A compact visual stack of how the concepts relate:

```text
   [ Layer 4: Physical / Semantic Interpretations ]
          |  (QFT diagrams, gauge-like symmetries, gravity analogies)
          v
   [ Layer 3: Pattern Graph ]
          |  motifs, cycles, reentry, "particle" forms
          v
   [ Layer 2: Dynamics / Collapse ]
          |  local rules, evaluation, motif statistics
          v
   [ Layer 1: Catalan Structures ]
          |  Dyck words, trees, noncrossing diagrams
          v
   [ Layer 0: `()` ]
          vacuum symbol, pure pairing
```

Everything above Layer 1 is optional interpretation.
Everything from Layer 1 down is concrete structure you can inspect in this repo.

⸻

## 9. How to Navigate the Repo

Recommended entry points:
1.	 README.md
  - 	High-level purpose, how to run things.
2.	src/sk.js + programs/sk-basis.lisp
  - 	See how SK/λ live in pure ()-structure.
3.	src/motif-discover.js + src/collapse-policy.js
  - 	Explore collapse rules and motif statistics.
4.	docs/
  - 	For essays and deeper dives into:
  - 	collapse-as-geometry,
  - 	structural diagrammatics,
  - 	reflective memory.

You can engage at three levels:
1.	 As a combinatorics & interpreter playground.
2.	 As a structural approach to agents / memory / attention.
3.	 As a hypothesis lab for how computation-like structure might underwrite physics.

Each level stands on its own; nothing requires belief beyond the code it runs on.

⸻

