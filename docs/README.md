# Docs at a Glance

This folder holds the narrative and research notes behind Basis—the idea that a single recursive constraint on balanced parentheses (Dyck paths / Catalan trees) can underwrite causal geometry, quantum-like amplitudes, and universal computation.

## What’s here

- `catalan-light-cone.latex` / `catalan-light-cone.pdf` — the main paper. It formalizes the “Catalan light cone” geometry, shows the diffusion → Schrödinger scaling limit of constrained Dyck walks, and maps the same structures to SKI/λ-term graphs to prove computational universality. Appendix material is explicitly marked interpretive.
- `IDEAS.md` — a compact field guide (20 sections) that extends beyond the paper. Each idea is labeled **solid**, **speculative**, or **interpretive**. Topics include structural potential and collapse work, chronons and discrete intervals, Casimir-inspired calibration, actualization-weighted collapse (leading to emergent I/K/S/Y behaviour), Narayana “breadth-angle” sectors, motif ecology, and constants as statistical fixed points.
- `OVERVIEW.md` — a plain-language tour of the project for readers who want intuition before diving into math or code.

## Key through-lines

- **Catalan light cone.** Dyck paths ordered by tier and breadth form a discrete cone bounded by the fully nested chain (timelike axis) and fully separated star (lightlike envelope), enforcing $r \le t$ combinatorially.
- **Scaling limits.** Conditioned Dyck walks converge to Brownian excursions; their densities satisfy the heat equation and, under Wick rotation, the free Schrödinger equation—no extra quantization step required.
- **Pairs expansion to computation.** Recursive pairing alone yields unlabeled application graphs; choosing SKI motifs makes the substrate computationally universal. Local reductions respect the same causal locality as the cone.
- **Locality and commutation.** Disjoint subtrees commute (spacelike separation analogue). Collapse/refinement is local and preserves causal ancestry; selection/measurement remains structurally constrained.
- **Speculative extensions (IDEAS.md).** Structural potentials and “collapse work,” proper time as collapse budget, actualization-biased collapse rules, helices/phase time, Narayana sector weights, motif ecologies, and emergent constants are presented as hypotheses to probe, not as derived physics.

## Reading order

1. Start with `OVERVIEW.md` for the lay of the land.
2. Read `catalan-light-cone.pdf` (or the `.latex` source) for the formal geometry/diffusion/computation story and its limitations.
3. Dip into `IDEAS.md` for the broader research program and speculative threads; the status labels signal how firmly each claim rests on established combinatorics.

## Building / viewing

- The PDF is prebuilt. To regenerate it locally:

  ```bash
  latexmk -pdf catalan-light-cone.latex
  ```

No external assets are required beyond a standard LaTeX install.
