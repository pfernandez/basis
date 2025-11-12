The Catalan Rule

A structural engine built from one symbol: ().

This project explores a concrete, testable idea:

If all we assume is a vacuum symbol () and local rules for expansion and collapse in possibility space, then:
	•	universal computation,
	•	persistent motifs and cycles,
	•	and spacetime / field / particle–like behavior
may all emerge from the same underlying combinatorics.

This repository is:
	•	a working codebase (Node.js, small interpreters, motif explorers),
	•	a lab for structural hypotheses,
	•	and a public stake in an idea that can be read, run, and criticized.

It is not a finished theory of physics. It is an attempt to push as far as possible with minimal assumptions, in the open.

⸻

1. Why () and Catalan?

We take () seriously:
	•	() represents vacuum — the neutral “nothing” from which structure is built.
	•	Repeated pairing of () generates balanced forms: Dyck words, binary trees, noncrossing diagrams.
	•	The only operations we rely on are:
	•	expansion (building larger pair-structures),
	•	collapse (local rewrites, including (() x) → x).

The Catalan lattice (all Dyck words, ordered by inclusion/refinement) is then:
	•	our possibility space,
	•	a discrete model of nested causality and branching futures.

This is not metaphor-only. We work directly with:

()
(())
()()
((()))
(()())
(())()
()(())
()()()
...

and their standard bijections to trees and noncrossing graphs.

⸻

2. Dyck paths as discrete spacetime

A Dyck word can be viewed as a path:
	•	read “(” as +1 and “)” as −1 in height,
	•	plot steps left→right.

This gives:
	•	height ≈ causal depth / “time”,
	•	horizontal position / branching ≈ “space” or multiplicity of compatible histories.

In the large-size limit, ensembles of Dyck paths have known scaling limits (Brownian excursions, etc.). That provides:
	•	a mathematically grounded bridge from discrete Catalan structure
	•	to continuous paths and relative spacetime geometry.

In this project we use that as a design constraint:

Any proposed dynamics on Catalan objects should admit a sensible continuum limit and a causal interpretation.

⸻

3. Collapse, curvature, and a gravity analogy

Local collapse rules select which possibilities actually realize.

Given:
	•	a partial history H,
	•	and the set of future continuations consistent with H,

we can reason about:
	•	regions of high motif density (many compatible futures; structural attractors),
	•	regions where certain motifs suppress possibilities (fewer extensions).

This suggests a working analogy:
	•	Mass / curvature ↔ regions where realized histories are dense and reinforcing.
	•	Forces ↔ gradients in the “count” or weight of compatible futures.
	•	Gravity as collapse ↔ the tendency of histories to fall into motifs that maximize consistent continuation.

In code, we approximate this by:
	•	defining local collapse policies,
	•	running them over Catalan trees,
	•	detecting recurrent motifs and structural wells.

These experiments do not prove GR/QFT, but they operationalize:

“Collapse of computed history shapes effective geometry.”

It’s stated here explicitly as a research direction, not as a conclusion.

⸻

4. Minimal universal computer from () (this part is solid)

The repository includes a pure structural SK / λ engine:
	•	Binders encoded as (() body) (introduce an argument slot).
	•	Variables as #n (De Bruijn index into enclosing binders).
	•	Application as tree structure.
	•	Evaluation as structural collapse ((() x) ⇒ x) plus substitution—no hidden opcodes.

From this we build:
	•	I, K, S,
	•	booleans,
	•	composition, etc.

All as balanced parentheses trees.

This shows:

The () + pairing + collapse substrate is Turing-complete.

This computational core is intentionally conservative and independently useful.

⸻

5. Motifs, cycles, and “one-electron” style structural sharing

On top of the acyclic causal evolution, we:
	1.	Identify isomorphic subtrees / motifs.
	2.	Quotient them into a pattern graph.

The pattern graph can have cycles even when the underlying causal tree does not.

Interpretation:
	•	Recurrent motifs = fixed points of the dynamics.
	•	Cycles in the pattern graph = reentry of the same structural form.
	•	Indistinguishable “particles” = repeated use of the same motif-class.

This offers a clean structural reading of ideas like:
	•	QFT’s “one field, many quanta”,
	•	Wheeler’s “one electron” as one conserved form, many embeddings,

without invoking literal loops in time.

⸻

6. A structural lens on diagrams, gauge, and fields

The same machinery naturally touches known physics structures:
	•	Feynman-like diagrams:
	•	collapse events ↔ vertices,
	•	persistent links ↔ propagators,
	•	histories of Catalan rewrites ↔ diagram expansions.
	•	Gauge as redundancy:
	•	once internal labels (color, phase, etc.) are added to motifs,
	•	local changes of encoding that preserve observables define gauge transformations.
	•	Wilson loops & confinement (structurally):
	•	closed motif loops and their invariants
	•	can be expressed directly on the Catalan substrate.

Here these appear as structural correspondences to investigate:

Can standard diagrammatics and gauge-like behavior be reconstructed purely from the statistics and symmetries of Catalan collapse histories?

The repo provides the playground to test that, not the final word.

⸻

7. Scheme & attention/memory

An early Scheme fragment (kept here intentionally):
	•	models a frame as (cons focus rest),
	•	defines an “agent” as:
	•	a pointer into such a structure,
	•	plus a list of operations.

This was a first attempt at:
	•	a Turing-style read-head for structural memory,
	•	an attention mechanism that walks and rewrites cons-based histories.

The modern SK/Catalan engine is a more principled base for the same goal:
unify computation, memory, and “observation” as structure over ().

⸻

8. Repository layout
	•	src/
	•	Catalan/Dyck generators and bijections.
	•	SK / λ engine on pure tree structure.
	•	Collapse policies and motif discovery.
	•	programs/
	•	sk-basis.lisp: core combinators & booleans in pure binder syntax.
	•	scheme/
	•	Structural attention/memory prototype.
	•	docs/
	•	Concept notes (The Catalan Rule, Geometry of Possibility, etc.).
	•	tests/
	•	Checks for bijections, interpreter correctness, and motifs.

⸻

9. How to run

Requirements: Node.js (v18+)

npm install

Explore Catalan structures:

npm run dyck
npm run dyck:center
npm run pairs
npm run motzkin

Experiment with collapse & motifs:

npm run motifs
npm run motifs:freeze
npm run motifs:heavier
npm run motifs:lighter
npm run motifs:left
npm run motifs:right

SK / λ on ():

npm run sk
node src/sk.js --defs=programs/sk-basis.lisp "((I x) y)" "(((S K K) z))"


⸻

10. Audience & stance

This project is for people who are:
	•	comfortable with λ-calculus / combinators,
	•	interested in Catalan / planar combinatorics,
	•	curious about structural foundations of:
	•	computation,
	•	Feynman diagrams and path integrals,
	•	reflective memory and attention in AI.

The stance is simple:
	•	The code and combinatorics are precise.
	•	The physical and cognitive interpretations are explicit hypotheses.
	•	The point is to make them concrete enough that others can:
	•	test them,
	•	refute them,
	•	or discover they connect to existing work in an interesting way.

## License

- Code: [Apache License 2.0](./LICENSE)
- Documentation & essays (README, docs/): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)