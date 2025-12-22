# IDEAS

_Living consolidation for the Catalan Light Cone / Basis project._
_Last refactor: 2025-12-13._

**What this file is for**

- Keep each coherent idea **in one place**, so its maturity is visible at a glance.
- Make it easy to mine for the main paper (`docs/catalan-light-cone.tex`) without missing scattered pieces.
- Preserve ideas even if wording changes.

**Structure**

- **INBOX**: quick capture for new/half-formed notes.
- **CANON**: integrated dossiers (each aims to be “the best current writeup” of that idea).
- **ARCHIVE**: lossless snapshot(s) of prior drafts so nothing is ever lost.

---

## Paper integration tags (current)

Legend:
- **[IN PAPER]**: already integrated into `docs/catalan-light-cone.tex` at arXiv-rigorous strength
- **[PARTIAL]**: some pieces integrated; remainder stays here
- **[IDEA ONLY]**: not in the paper yet (or intentionally excluded for rigor/scope)

## INBOX

_Empty for now._
(When you have a new thought, drop it here; the next refactor folds it into CANON.)

---

## CANON

### 1) The substrate as coordinate systems on one Catalan object **[IN PAPER]**

**Paper:** `docs/catalan-light-cone.tex` (Catalan light-cone geometry + coordinate charts appendix).

Dyck words, full binary trees, and unlabeled S-expressions are canonically bijective Catalan families:

$$
\text{Dyck} \;\longleftrightarrow\;
\text{Full binary trees} \;\longleftrightarrow\;
\text{S-expressions}.
$$

Switching representations is not a simulation; it is a **change of coordinates** on the same invariant combinatorial object:

- **Dyck view** highlights a discrete causal geometry: a path in $(t,x)$ with steps $(\Delta t,\Delta x)=(1,\pm 1)$ and nonnegativity constraint.
- **Tree view** highlights recursion, branching depth, and local motifs.
- **S-expr view** is a linear trace/projection of the same tree (the “parentheses skyline”), useful for computation (pairs expansion) and for identifying reentry patterns.

A convenient continuum-facing coordinate choice uses light-cone variables:

$$u=t+x,\qquad v=t-x.$$

Each Dyck step increments exactly one of $(u,v)$ by $2$, and the Dyck constraint corresponds to

$$u\ge 0,\qquad v\ge 0.$$

In $(1+1)$D, Lorentz boosts act by rescaling:

```math
u' = e^{\eta} u, \qquad v' = e^{-\eta} v,
```

equivalently

```math
t' = \gamma (t - v_L x), \qquad x' = \gamma (x - v_L t),
\quad \gamma = (1 - v_L^2)^{-1/2}, \quad v_L = \tanh \eta.
```

This makes it natural to treat “Dyck geometry” as a discrete light cone, and “tree coordinates” as alternative projections of the same cone.

**Narayana refinement by peak count (solid; [IN PAPER]).**
Narayana numbers $N(n,k)$ refine Catalan tiers:

$$C_n = \sum_{k=1}^n N(n,k).$$

Interpreting $k$ (e.g., peak count) as a breadth-adjacent statistic suggests an “angle” parameter at fixed tier:

$$\phi_k \approx 2\pi \frac{k-1}{n-1},\quad k=1,\dots,n.$$

The Narayana refinement itself is standard. Treating $k$ as a literal angular coordinate is optional packaging (**[IDEA ONLY]**), not a derived geometric fact.

**Helical slices / phase time (interpretive; [IDEA ONLY]).**
In addition to tier time $n$ (“causal time”), one can attach a shape-dependent phase:

$$ \tau(w) = \frac{h_{\max}(w)}{n},\qquad \theta(w)=(\omega n + \beta\,\tau(w))\bmod 2\pi. $$

Constant-$\theta$ histories trace helices through the cone (useful as a visualization and as a possible bridge to Bloch-sphere style descriptions).

---

### 2) Depth–breadth tradeoff, discrete uncertainty, and information capacity **[IN PAPER]**

**Paper:** `docs/catalan-light-cone.tex` (breadth/depth tradeoff + Kraft remark; entropy appendix).

**Depth–breadth inequality (solid combinatorics).**
For any full binary tree with leaf depths $d_1,\dots,d_m$:

$$\sum_{i=1}^m 2^{-d_i}=1.$$

This implies a hard tradeoff: many shallow leaves (large breadth) forces small average depth, and deep leaves force narrowness. Interpreting

- depth $\sim$ causal time / computational nesting, and
- breadth $\sim$ branching / “space”,

yields a natural **discrete uncertainty principle** on the Catalan substrate. (This is combinatorial; the physics interpretation is optional.)

**Entropy per tier (solid; [IN PAPER]) and Bekenstein-like bounds (speculative calibration; [IDEA ONLY]).**
The number of histories at tier $n$ is the Catalan number:

$$ C_n = \frac{1}{n+1}\binom{2n}{n}. $$

Thus each tier has finite combinatorial entropy and well-controlled asymptotics. One can compare the growth of admissible boundary configurations to “area-like” measures under coarse-graining, motivating analogies to holographic/Bekenstein bounds (the analogy becomes physical only after a separate calibration step).

**Lorentz structure from Dyck geometry (solid as geometry; interpretive as physics; [IN PAPER as continuum comparison]).**
Dyck steps satisfy $|\Delta x|=\Delta t$, so admissible histories lie inside a discrete cone:

$$|x|\le t.$$

Under diffusive scaling, Dyck ensembles converge to Brownian excursions; this supports heat/Schrödinger-like continuum limits (see Dossier 6). Reading this as literal spacetime is a modeling choice; reading it as a useful causal geometry is already rigorous.

---

### 3) Collapse dynamics: potential, work, locality, and proper time **[PARTIAL]**

**Paper:** `docs/catalan-light-cone.tex` (selection/collapse discussion; computational proper time as event-count parameter; entropy appendix; collapse-size bookkeeping lemma).

This dossier is the “local rule” side of the global cone picture: collapse/actualization provides an irreversible arrow and a natural notion of proper time.

#### Structural potential and collapse work **[PARTIAL]**

For a finite rooted binary tree $T$, define the **structural potential**

$$U(T):=\text{(number of internal pairs in }T\text{)}.$$

For a focused pair $\langle L,R\rangle$, define the **applicative force**

$$F_{\text{app}}(\langle L,R\rangle):=|U(L)-U(R)|.$$

Under a “keep the more structured side” collapse, the potential drop for collapsing $\langle L,R\rangle$ is

$$\Delta U = \big(1+U(L)+U(R)\big) - \max\{U(L),U(R)\}=1+\min\{U(L),U(R)\}.$$

The internal-node bookkeeping and size drops under subtree selection are now recorded in the paper; interpreting $\Delta U$ as irreversible work (and $F_{\text{app}}$ as a force scale) remains optional and is not claimed as physics.

#### Chronons, locality, and a discrete interval (interpretive bridge to relativity) **[IDEA ONLY]**

Assume evolution proceeds in **chronons**, each consisting of:

1. a finite sequence of local rotations / focus moves (no change in $U$), then
2. exactly one collapse event.

With a locality bound “focus moves at most one edge per chronon,” the effective speed limit is

$$c=1\ \text{edge per chronon}.$$

A corresponding discrete Minkowski-style interval can be defined by counting how much of a chronon budget is spent moving vs collapsing. The key interpretive claim is:

- **proper time** is “collapse time”: the number of collapse events experienced along a history,
- motion uses up update budget, so moving structures accumulate less collapse time (time dilation analog).

#### Computational proper time as collapse count (solid definition; interpretive mapping) **[IN PAPER]**

Let $k$ be the number of collapse events along a history. Define **computational proper time**

```math
\tau = \alpha k,
```

with $\alpha$ a characteristic time-per-collapse. This is an invariantly defined discrete parameter; treating it as physical proper time is the hypothesis.

#### Actualization weight and actualization-biased collapse **[IDEA ONLY]**

Define an **actualization weight** $aw:T\to\mathbb{N}$ inductively:

1. $aw(())=0$.
2. When a contraction selects a subtree, increment the selected side’s weight; newly expanded material starts at $0$.

Collapse then becomes biased toward the more-actualized branch:

$$
(L,R) \rightsquigarrow
\begin{cases}
L, & aw(L)>aw(R),\\
R, & aw(R)>aw(L),\\
\text{freeze}(L,R)\ \text{or symmetry-breaking}, & aw(L)=aw(R).
\end{cases}
$$

This yields a concrete, local “memory” of which structures have repeatedly won in the past.

#### SI calibration via Casimir effect (speculative) **[IDEA ONLY]**

Introduce a fundamental edge length $\ell_0$ and chronon duration $\tau$. Set

$$c=\frac{\ell_0}{\tau},\qquad \varepsilon_0=\frac{\hbar}{\tau}.$$

A characteristic force scale is then

$$F_0 := \frac{\varepsilon_0}{\ell_0}=\frac{\hbar}{\tau\,\ell_0}.$$

Comparing to the Casimir pressure scale at separation $\ell_0$ gives

$$
F_{\text{Casimir, cell}}\approx \frac{\pi^2}{240}\frac{\hbar c}{\ell_0^2}
=\frac{\pi^2}{240}F_0\approx 0.0411\,F_0,
$$

suggesting a possible way to tie units to vacuum-pressure magnitudes (conjectural; not derived from first principles).

---

### 4) Computation from collapse: application order, combinators, reentry, and motifs **[PARTIAL]**

**Paper:** `docs/catalan-light-cone.tex` (Catalan universality for SKI/$\\lambda$ term structure; local reduction and disjoint commutation). Collapse-driven emergence, actualization weights, and motifs remain future work.

This dossier collects the computational substrate: how lambda/SKI-like behavior emerges from structure + local collapse + reinforcement.

#### Why “left applies to right” (causal orientation) **[PARTIAL]**

Given a pair $(L,R)$, interpret $L$ as earlier / already-actualized structure and $R$ as later / newly expanded possibility. Then “earlier interprets later” is the causal choice:

- application as $(L,R)$ means “$L$ acts on $R$,”
- the mirror convention would hand power to the later branch (retrocausal semantics).

This motivates a left-spine / curried encoding as the causally aligned normal form.

#### Emergent I, K, S, Y (internal derivations; interpretive external mapping) **[IDEA ONLY]**

With actualization-biased collapse, one can realize behaviors analogous to SKI combinators and fixed points (Y-like reentry), without installing them as primitives. The key pattern is: repeated collapse wins reinforce a subtree (increasing $aw$), which then dominates later choices and can recreate its own collapse conditions (“reentry kernels”).

The fixed-point flavor is captured by a “self-sourcing” loop:

```math
\text{Y-loop} \implies aw \to aw+1 \to aw+2 \to \cdots.
```

Formally: the tree dynamics can generate stable motifs behaving like identity, constant, sharing/duplication, and self-application motifs.

#### Motif ecology and reentry kernels **[IDEA ONLY]**

A **motif** is a small subtree pattern that recurs with non-negligible frequency under stochastic expansion + collapse. A **reentry kernel** is a motif that, when it collapses, recreates conditions for its own future collapse—local self-sourcing.

This motivates an “ecology” picture:

- kernels as particle-like excitations (candidate),
- interactions as motif collisions / overlap / competition for actualization,
- statistics of motif populations as emergent “constants” (see Dossier 8).

Early simulation hints suggest symmetry/antisymmetry-like behavior for certain nested kernels (speculative).

#### Minimal embedding dimension for honest reentry pictures (solid graph fact; speculative physics link) **[IDEA ONLY]**

Once reentry edges are allowed, the structure is a directed graph, not a planar tree. Nonplanarity arguments (e.g. $K_{3,3}$) show that **2D drawings must introduce spurious crossings** for generic reentrant structure. **3D is sufficient** to embed generic finite graphs without forced crossings. The leap from “needs 3D to draw without lies” to “explains 3 spatial dimensions” is conjectural, but the combinatorial pressure toward higher-dimensional faithful embeddings is real.

---

### 5) Amplitudes: structural action, Born-like measures, and Catalan path integrals **[PARTIAL]**

**Paper:** `docs/catalan-light-cone.tex` (formal Catalan amplitude model definition; amplitudes from additive phase functionals; coherent summation + squaring; Dyck area scaling and diffusion/Schr\"odinger limits; $q$-Catalan/area-refinement remark; transfer-kernel recursion/semigroup property for the area phase; worked double-slit appendix). Any derivation/uniqueness of a Born rule remains open.

This dossier collects the “global sum over histories” side: assign actions/amplitudes to Dyck histories (and/or collapse-decorated histories) to recover continuum dynamics and probability rules.

#### Structural action as Dyck area (solid definition; open uniqueness) **[IN PAPER]**

For a Dyck path $w$ of semilength $n$ with height process $(H_k)_{k=0}^{2n}$, define the area

$$A[w]:=\sum_{k=0}^{2n-1} H_k.$$

A natural structural action is

$$S[w]:=\alpha A[w] + \beta h_{\max}(w) + \cdots.$$

Assign amplitudes $\psi(w)\propto \exp(iS[w])$ (or $\exp(-S[w])$) and sum over histories to obtain a discrete path integral. In Brownian-excursion scaling limits, this connects to heat/Schrödinger-like dynamics.

**Note.** The paper now makes this explicit as a self-contained “Catalan amplitude model” definition, and records that area-weighted sums are a specialization of the standard area-refined ($q$-)Catalan generating function.

#### Transfer kernel / discrete Feynman--Kac for the area phase (solid; [IN PAPER])

Fix a phase scale $\alpha$. Define a kernel $K_\alpha^{(r)}(a,b)$ as the sum of
weights $\exp\!\big(i\alpha \sum_{t=0}^{r-1}h_t\big)$ over all nonnegative
nearest-neighbour height paths of length $r$ from $a$ to $b$.

This admits:

- a one-step transfer recursion (condition on the first step), and
- a Chapman–Kolmogorov/semigroup composition law (split at an intermediate time),

and in particular the tier-$n$ area-phase partition function is
$Z_n(\alpha)=K_\alpha^{(2n)}(0,0)=\sum_{w\in\mathcal D_n} e^{i\alpha A(w)}$.

#### Carlitz--Riordan recursion for $q$-Catalan / first-return decomposition (solid; [IN PAPER])

By the unique first-return decomposition $w=\texttt{(}u\texttt{)}v$ with
$u\in\mathcal D_k$ and $v\in\mathcal D_{n-1-k}$, the Dyck-area functional satisfies

$$A(w)=A(u)+A(v)+(2k+1),$$

so the weighted partition function obeys

$$Z_n(\alpha)=\sum_{k=0}^{n-1} e^{i\alpha(2k+1)} Z_k(\alpha)\,Z_{n-1-k}(\alpha).$$

Equivalently, for $q=e^{2i\alpha}$ and $C_n(q)=\sum q^{\mathrm{area}(w)}$ this yields the
Carlitz--Riordan recurrence

$$C_n(q)=\sum_{k=0}^{n-1} q^k\,C_k(q)\,C_{n-1-k}(q).$$

At the generating-function level, $C(q;z)=\sum_{n\ge 0}C_n(q)z^n$ satisfies the
functional equation

$$C(q;z)=1+z\,C(q;z)\,C(q;qz).$$

Equivalently (as a formal power series), $C(q;z)$ admits the Stieltjes continued
fraction

$$C(q;z)=\cfrac{1}{1-\cfrac{z}{1-\cfrac{qz}{1-\cfrac{q^2z}{1-\ddots}}}}.$$

#### Toward a discrete action on collapse-decorated worldlines (interpretive → speculative) **[IDEA ONLY]**

A collapse-decorated Catalan history can be treated as

```math
\gamma = \{(t_k,x_k,\tau_k,\sigma_k)\}_{k=0}^N,
```

with $(t_k,x_k)$ the Dyck coordinates, $\tau_k$ collapse-count proper time, and $\sigma_k$ local motif data. A natural discrete action template is

```math
S[\gamma]
= \sum_k \Big[ K_k + V(\sigma_k)\,\Delta\tau + \mu\,C_k \Big],
```

with:
- $K_k$ a (possibly effective) kinetic term from Dyck geometry,
- $V(\sigma)$ a motif-energy functional (e.g., imbalance, redex density, curvature proxies),
- $C_k$ an indicator/cost for collapse events.

This is the bridge point where causality (Dyck), computation (collapse), and “energy” (motif structure) become one action principle.

#### Path-integral over Catalan histories (solid form; open evaluation) **[IN PAPER]**

A partition function between boundary configurations $A\to B$ takes the form

```math
\mathcal{Z}(A\to B)
= \sum_{\gamma:A\to B} \exp\!\left[i\,S[\gamma]\right],
```

summing over Dyck paths, collapse schedules, and motif evolutions consistent with locality/causality. Special cases (e.g. “massless” $V=0$) may admit closed Catalan/Narayana expressions.

#### Propagator kernel on the cone (speculative but sharply stated) **[IDEA ONLY]**

# Propagator Kernel on the Catalan Cone

*(Interpretive → Speculative)*

Given a discrete action $S[\gamma]$ over Catalan histories, define a **propagator kernel**:

```math
K(A,B) = \sum_{\gamma:A\to B} \exp[-S(\gamma)],
```

where:

* $A,B$ are boundary configurations (positions in the Dyck cone together with motif states),
* the sum runs over all Catalan histories connecting them.

This kernel satisfies a discrete Chapman–Kolmogorov relation:

```math
K(A,C) = \sum_B K(A,B)\,K(B,C),
```

which matches the structure of:

* path integrals,
* transfer matrices,
* tensor network contractions.

**Solid subcase now in paper.** There is already an explicit semigroup kernel at
the level of the \emph{height projection} (nonnegative walk) for the area phase
$\exp(i\alpha A)$; the “cone-level propagator” idea is the generalization to richer
state spaces (full Catalan histories, collapse-decorated histories, motif states).

### Special Cases

1. **Pure Catalan propagation** ($V=\mu=0$):
   $K$ reduces to the number of admissible Dyck–motif histories between $A$ and $B$.

2. **Local motif energies only:**
   $K$ becomes a *weighted Catalan kernel*, expressible by continued fractions or generating functions.

3. **Collapse-dominated dynamics:**
   $K$ encodes computational cost along worldlines, selecting effective geodesics in the Catalan cone.

This allows you to define scattering processes, tunneling amplitudes, and decoherence-like suppression of “structurally unlikely” paths — all on a purely combinatorial substrate.

---

#### Born-like measure from structural coherence (near-solid sketch) **[IDEA ONLY]**

Coherence requirements (refinement under splitting, invariance under regrouping of structurally equivalent histories / gauge-like redundancy) push toward a quadratic probability rule:

$$\mathbb{P}(\text{outcome}) \propto |\psi|^2,$$

as the unique consistent measure under Gleason/Dutch-book–style assumptions (the full proof remains to be written in this setting).

---

### 6) Modes, fields, and continuum limits: spectral view, PDEs, dispersion **[PARTIAL]**

**Paper:** `docs/catalan-light-cone.tex` (height-projection covariance + Karhunen--Lo\`eve modes; mode-wise phase discussion in Schr\"odinger subsection). Shift-operator/Fourier-basis and tree-Laplacian programs remain here.

The paper now also records explicit ballot-number formulas for the nonnegative
bridge counts $B(r;a\!\to\!b)$ and hence for the height mean and two-time covariance
via the Catalan-triangle factorization (so the correlation kernel is not just
abstractly defined; it is explicitly computable).

This dossier collects ways to treat the Catalan tiers as a state space for dynamics, and how continuum PDEs emerge.

#### Hilbert-space / spectral picture (solid framing) **[PARTIAL]**

### 2.1. Basis, shift operator, and Fourier modes

Fix tier $n$. Let $\{|w_j\rangle : j=0,\dots,C_n-1\}$ be an orthonormal basis
labeled by the Dyck words of length $2n$. Arrange them in some cyclic order
around the "rim" of the cone.

Define the **shift operator** $S$ by:

$$ S|w_j\rangle = |w_{j+1}\rangle,\qquad S^{C_n} = I. $$

The eigenvectors of $S$ form a discrete Fourier basis:

$$ |\tilde{k}\rangle = \frac{1}{\sqrt{C_n}}\sum_{j=0}^{C_n-1} e^{2\pi i jk/C_n}
|w_j\rangle, $$

with eigenvalues

$$ S|\tilde{k}\rangle = e^{-i 2\pi k / C_n} |\tilde{k}\rangle. $$

One can then introduce an effective Hamiltonian $H$ and time step $\Delta$ by
setting:

$$ S = e^{-i H\Delta / \hbar}, $$

so that each eigenmode satisfies

$$ H|\tilde{k}\rangle = E_k|\tilde{k}\rangle,\quad S|\tilde{k}\rangle =
e^{-iE_k\Delta/\hbar}|\tilde{k}\rangle.  $$

This realizes each tier as a finite-dimensional Hilbert space with a unitary
"around-the-rim" evolution step.

**Status**

* **Solid.** This spectral construction is standard: a cyclic graph’s
  adjacency/shift operator is diagonalized by discrete Fourier modes.
* **Speculative.** Identifying the abstract $H$ with a physical Hamiltonian and
  the tier rim with a spatial slice is a model choice, not a theorem.

---

#### Fields on words, prefixes, and nodes (solid definitions) **[IDEA ONLY]**

### 21.1. Fields on words, prefixes, and nodes

There are (at least) three natural ways to define a “field” on the Catalan
substrate:

1. **Field on words at fixed tier.**  For tier $n$, define a complex field

```math
\Phi_n : \mathcal{D}_n \to \mathbb{C},\qquad w \mapsto \Phi_n(w),
```

where $`\mathcal{D}_n`$ is the set of Dyck words of semilength $n$. Each $w$ is
a full history at that proper time.

2. **Field on prefixes (the global possibility tree).**  Let $\mathcal{C}$ be
the infinite Dyck-prefix tree. A field is

$$ \Phi : \mathrm{Pref}(\mathcal{C}) \to \mathbb{C},\qquad u \mapsto \Phi(u),
$$

assigning a value to every prefix $u$. This is the most global viewpoint; it
“lives” directly on the Catalan light-cone substrate with all local cones (see
Sections 2 and 19).

3. **Field on nodes of a single Dyck tree.**  For a fixed word $w$, with tree
representation $T(w)$, one can define a local field

$$ \phi_w : V(T(w)) \to \mathbb{C},\qquad v \mapsto \phi_w(v), $$

where $V(T(w))$ is the set of internal nodes or edges of the tree. This is the
“internal field on a given history,” analogous to a field configuration on a
single spacetime background.

The first two are **global** (fields on ensembles / prefixes); the third is
**local** (fields on one realized history). The mode-decomposition picture
below uses the third, but is compatible with the first two.

**Status**

* **Solid (definitions).** All three views are straightforward structures on
  the Catalan objects already in use.
* **Speculative.** Identifying these fields with physical fields (e.g. scalar,
  gauge) is an interpretive layer, not derived.

---

### 21.2. Subtree modes as a multiscale basis **[IDEA ONLY]**

Every Dyck tree $T(w)$ admits a canonical hierarchy of subtrees:

* each internal node $v$ of $T(w)$ defines a subtree $T_v$,
* these subtrees are themselves Catalan trees, with the usual depth–breadth
  structure.

This suggests treating these subtrees as **localized modes**. Concretely:

* For each internal node $v$, define a mode function $\psi_v$ on histories (or
  on trees) that is “supported on” the corresponding subtree $T_v$. For
  example:
  * $\psi_v(w) = 1$ if the configuration around $v$ in $T(w)$ matches a
    particular pattern, and $0$ otherwise.
  * Or more smoothly, $\psi_v(w)$ could be a function of the shape of $T_v$
    (height, breadth, area, motif class, etc.).

Then amplitudes on the full tree can be written as a **discrete mode
expansion**:

$$ \Phi(w) \;=\; \sum_{v \in V(T(w))} a_v\,\psi_v(w), $$

where the coefficients $a_v$ quantify how strongly each subtree mode
contributes.

This is analogous to a **wavelet decomposition**:

* the tree hierarchy provides the “scales”;
* subtrees at different depths provide coarse vs fine modes;
* the set $\{\psi_v\}$ is finite for any finite Dyck word $w$.

In the global language, one can also define a family of modes $\psi_\alpha$
indexed by small subtree types (motifs) and express $\Phi_n$ as

$$ \Phi_n(w) \;=\; \sum_\alpha a_\alpha^{(n)}\,\psi_\alpha(w), $$

where $\alpha$ runs over a library of motif-types (see Section 15 on motif
ecology).

**Status**

* **Solid (structural).** The hierarchy of subtrees and the finite mode
  expansion are exact combinatorial facts.
* **Speculative.** The particular choice of mode family $\{\psi_v\}$ or
  $\{\psi_\alpha\}$, and any claim of uniqueness, is model-dependent.

---

### 21.3. Static decomposition vs dynamic evolution **[IDEA ONLY]**

At a fixed tier $n$, the field $`\Phi_n(w)`$ (or $`\phi_w(v)`$) is a **static
snapshot**. Dynamics arise in two distinct ways:

1. **Tier growth (external / causal time).**  Moving from tier $n$ to $n+1$
adds a new pair step to the Dyck word. This extends the tree by a local growth
rule, increasing the pool of subtrees and therefore the basis of modes. A
generic update law looks like

$$ \Phi_{n+1}(w') \;=\; \sum_{w \prec w'} K(w'\leftarrow w)\,\Phi_n(w), $$

where the kernel $K(w' \leftarrow w)$ is nonzero only if $w'$ is a one-step
extension of $w$ that respects the Dyck constraint. This is the “global” time
evolution used in the path-integral picture (Section 3).

2. **Internal redistribution (internal / phase-like time).**  Even at fixed
tier $n$, amplitude can be redistributed among the nodes of a single tree via a
discrete operator acting on $\phi_w$, for example:

$$ \phi_w^{(m+1)}(v) \;=\; \phi_w^{(m)}(v) - \kappa \bigl(L_T
\phi_w^{(m)}\bigr)(v), $$

where $m$ is an internal time step and $L_T$ is a graph Laplacian on the tree
$T(w)$ (see below). This is a **diffusion** or **wave** evolution on a fixed
combinatorial background.

In the continuum limit, tier-growth dynamics give rise to **Brownian excursion
+ heat/Schrödinger** behaviour (Section 2), while internal redistribution on
  the tree or prefix graph corresponds to **field propagation** on a fixed
  “slice” of the substrate.

**Status**

* **Solid (formal structure).** Decomposing dynamics into (i) causal-tier
  growth and (ii) internal redistribution is consistent with the existing
  path-integral and light-cone constructions.
* **Speculative.** Interpreting these two times as physically distinct (proper
  time vs phase time, or similar) is interpretive (see Section 4).

---

### 21.4. Tree Laplacians and discrete heat/Schrödinger equations **[IDEA ONLY]**

Given a Dyck tree $T(w)$ with node set $V$ and edges $E$, define a discrete
**tree Laplacian** $L_T$ acting on node fields $\phi_w : V \to \mathbb{C}$ by

$$ (L_T \phi_w)(v) := \phi_w(v) - \frac{1}{\deg(v)} \sum_{u\sim v} \phi_w(u),
$$

where $\deg(v)$ is the degree of node $v$ and $u \sim v$ ranges over neighbours
connected by tree edges.\footnote{Other normalizations (combinatorial,
normalized Laplacian, weighted edges) are possible; the choice affects spectra
but not the basic structure.}

Then:

* The **discrete heat equation** on the tree is

$$ \frac{\partial}{\partial \tau} \phi_w(\tau, v) = -\kappa \,(L_T
\phi_w)(\tau, v), $$

or in discrete internal time steps $\tau_m = m \Delta \tau$,

$$ \phi_w^{(m+1)} = \bigl(I - \kappa \Delta \tau \, L_T\bigr) \phi_w^{(m)}. $$

* The **discrete Schrödinger-like equation** on the tree is

$$
i \frac{\partial}{\partial \tau} \phi_w(\tau, v) = H_T \phi_w(\tau, v),
$$

with a Hamiltonian

$$ H_T := \alpha L_T + V_T, $$

where $V_T$ is a potential term depending on local features (height, breadth,
motif labels, etc.). In discrete steps:

$$ \phi_w^{(m+1)} \approx e^{-i H_T \Delta \tau} \phi_w^{(m)}. $$

Analogous definitions apply to the **prefix tree $\mathcal{C}$** at fixed tier
$n$: a Laplacian on the induced subgraph of prefixes of length $2n$ gives a
heat/Schrödinger-type evolution on the “rim” Hilbert space discussed in Section
2 (Hilbert-space and spectral view).

In large-$n$ limits:

* $T(w)$ for typical random Dyck words converges (in an appropriate sense) to
  the **Continuum Random Tree (CRT)** / Brownian excursion object.
* Spectral properties of $L_T$ are expected to converge to Laplacian-type
  operators on the limiting continuum tree.
* The discrete heat/Schrödinger equations on $T(w)$ should then approximate
  continuum differential equations on that limiting object, paralleling the
  Dyck $\to$ Brownian excursion $\to$ heat/Schr chain already used for
  amplitudes.

**Status**

* **Solid (discrete operators).** The definition of $L_T$ and the discrete
  heat/Schr equations on trees and prefix graphs is standard spectral graph
  theory.
* **Speculative.** The precise continuum limit of these operators on random
  Dyck trees, and the identification of the limiting PDEs with physical field
  equations, is a research program rather than a completed derivation.

---

### 21.5. Relation to global spectral view and gauge/field ideas **[IDEA ONLY]**

This mode-decomposition and tree-Laplacian picture connects several earlier
ideas:

* Section 2 (Hilbert-space and spectral view) diagonalizes a **shift operator
  around the rim** at fixed tier $n$, giving global “Fourier modes” indexed by
  a discrete momentum $k$. The present section adds **local modes on trees /
  prefixes**, giving a complementary “position / shape space” description.

* Section 18 (fields and gauge symmetry) treats labels on nodes/edges as
  fields, with gauge redundancy implemented by structural equivalences. The
  Laplacian + mode picture gives these fields a natural **dynamics**
  (heat/Schr-type evolution) on a fixed combinatorial background.

* Section 19 (global vs local views) distinguishes:
  * a **global** multicomputation picture (all histories), and
  * a **local** actualization picture (one realized path).  Fields and mode
    decompositions can be defined in both regimes: globally as amplitudes over
    histories, locally as fields on a single realized tree. The same Catalan
    structure supports both.

Taken together, this suggests a program:

* Use **subtree modes** as a combinatorial analogue of Fourier/wavelet bases.
* Use **tree/prefix Laplacians** to define discrete heat/Schrödinger dynamics
  on those modes.
* Study the **scaling limits** of spectra and eigenmodes under Dyck $\to$
  Brownian / CRT convergence.
* Compare the resulting continuum operators to familiar field operators in QFT
  / quantum mechanics.

**Status**

* **Solid (structural alignment).** The connections to Sections 2, 18, and 19
  are mathematically consistent: all constructions live on the same Catalan
  objects and standard graph/Laplacian tools.
* **Speculative.** Whether this program yields a concrete, physically viable
  field theory on the Catalan substrate remains open; at present it is a
  roadmap for future work.

---

#### Discrete field equations and mode decompositions (program direction)

*(Solid; derived directly from Dyck geometry and standard continuum limits)*

A Dyck path of semilength $n$ is a sequence of steps $(\Delta x, \Delta t) = (\pm 1, 1)$ with height constraint $h \ge 0$. This automatically places all Dyck paths inside a **discrete light cone**:

$$|x| \le t, \qquad t \in {0,1,\dots,2n}.$$

Under diffusive scaling
$$t = n,\tau, \qquad x = \sqrt{n},\xi,$$
the Dyck ensemble converges to **Brownian excursions**, whose support is the continuum light cone. This gives a natural $(1+1)$-dimensional Lorentzian structure.

_(Canonical summary truncated; full writeup preserved in ARCHIVE.)_

#### Effective dispersion and mass spectra (interpretive → speculative)

If we treat Dyck geometry as setting the effective speed of propagation (always at slope $\pm 1$ in $(t,x)$), then a perturbative continuum analog yields:

```math
E^2 - p^2 = m(\sigma)^2,
```

where:

* $E$ measures temporal fluctuation of the motif ensemble,
* $p$ measures spatial/breadth fluctuation (tree expansion direction),
* $m(\sigma)$ emerges from **persistent structural asymmetry** in the local tree geometry.

This is the beginning of a **mass spectrum** for stable Catalan motifs.

Stable, self-reproducing motifs (like the SKI “S-shape,” “K-shape,” or Y-like self-application structures) might correspond to different “particle species” with different effective masses.

---

# Summary Table

| Concept                              | Status                     | Notes                                                                   |
| ------------------------------------ | -------------------------- | ----------------------------------------------------------------------- |
| Hamiltonian for Catalan dynamics     | Interpretive → Solid       | Clean Legendre transform; continuum limit behaves as expected.          |
| Path-integral over Catalan histories | Interpretive → Speculative | Direct analogue of Feynman/CDT but with computational degrees included. |
| Motif-based mass spectrum            | Interpretive → Speculative | Structure-driven analogue of rest mass; promising.                      |

---

# Discrete Euler–Lagrange Equations on the Catalan Cone

*(Interpretive → Speculative)*

Given a discrete action

```math
S[\gamma] = \sum_k L(t_k, x_k, \sigma_k; t_{k+1}, x_{k+1}, \sigma_{k+1}),
```

over a Catalan worldline

```math
\gamma = \{ (t_k, x_k, \sigma_k) \}_{k=0}^N,
```

a **discrete Euler–Lagrange condition** selects extremal histories:

1. Fix the endpoints $(t_0, x_0, \sigma_0)$ and $(t_N, x_N, \sigma_N)$.
2. Vary intermediate configurations $(t_k, x_k, \sigma_k)$.
3. Require that the first variation of $S$ vanishes.

In a simplified setting where $L$ depends only on local increments and motif energy,

```math
L_k = K_k + V(\sigma_k)\Delta\tau + \mu C_k,
```

with $K_k$ the kinetic term and $C_k$ the collapse indicator, the discrete Euler–Lagrange equations take the schematic form

```math
\frac{\partial L_k}{\partial x_k}
  + \frac{\partial L_{k-1}}{\partial x_k} \approx 0,
\qquad
\frac{\partial L_k}{\partial \sigma_k}
  + \frac{\partial L_{k-1}}{\partial \sigma_k} \approx 0.
```

Conceptually:

* Variations in $x_k$ enforce consistency of geometric motion in the Dyck cone (no “kinks” in the classical limit).
* Variations in motif variables $\sigma_k$ enforce consistency of how structure changes along an extremal history (no gratuitous, energetically costly motif flips).

In the continuum limit, this recovers standard Euler–Lagrange equations for a field with internal structure, but now built on top of the Catalan substrate.

---

# Noether-Type Correspondence for Catalan Symmetries

*(Interpretive → Speculative)*

**Noether’s theorem** ties continuous symmetries of the action to conserved quantities. In the Catalan setting, we have **discrete symmetries** of:

* Dyck geometry (e.g., time translation, reflection),
* motif structure (e.g., left–right reflection),
* evaluation/collapse schedules.

The idea: whenever the discrete action $S[\gamma]$ is invariant under a transformation of histories, there should be a corresponding **invariant of Catalan dynamics**.

# **Motif-Based Mass Spectrum**

*(Interpretive → Speculative, but conceptually sharp)*

In a physical interpretation, **mass** should reflect the tendency of a structure to “resist” propagation or collapse. In the Catalan universe, this resistance comes from **persistent motif asymmetry** or **structural tension**.

# Discrete Dispersion Relations

*(Interpretive → Speculative)*

Let an effective motif behave like a “particle” moving through the cone.

Using the invariant

```math
E^2 - p^2 = m^2(\sigma),
```

we obtain a **discrete dispersion relation**:

```math
E(p) = \sqrt{p^2 + m^2(\sigma)}.
```

**Interpretation:**

* Balanced motifs ($m=0$) propagate at maximal slope in the Dyck cone (null-like).
* More structured motifs ($m>0$) propagate more slowly in computational proper time (timelike).
* The motif’s *shape* — not an external label — determines the mass term.

This gives you:

* wavepacket-like propagation of motif families,
* effective refractive behavior in combinatorial media,
* mass generation via symmetry breaking in motif space.

---

---

### 7) Symmetry, gauge, and Noether-type correspondences **[PARTIAL]**

**Paper:** `docs/catalan-light-cone.tex` (gauge-like redundancy from commuting disjoint updates; gauge-invariant counting note). Noether-type claims stay here.

Gauge-like structure is already present at the combinatorial level: many representations encode the same “observable” outcome.

### 18.1. Fields as labels on nodes and edges

Beyond pure structure, one can decorate trees with labels (charges, spins,
etc.):

* Each node or edge carries an element of some set $F$ (field values).
* Local update rules couple structural collapse and field updates: when a
  subtree collapses, the labels on its surviving parts are updated by a local
  rule.

Repeated localized excitations in a region of the tree correspond to **field
configurations**.

### 18.2. Gauge symmetry as structural redundancy

Many different labelled trees represent the same coarse-grained geometry or
computation. Structural equivalences (rotations, α-equivalent λ-terms,
relabelings that do not affect observables) form **gauge symmetries**:

* A gauge transformation is a local rewrite that preserves observable outcomes.
* Gauge fixing corresponds to picking canonical representatives (e.g.
  left-curried form, normalized motifs).

**Status**

* **Solid (analogy).** The equivalence-class structure is precise; the gauge
  analogy is natural.
* **Speculative.** Identifying specific gauge groups with Standard Model
  symmetries, or deriving interactions, is not yet done.

---

1. **Time-translation of collapse schedule**
   Shifting all collapse indices $k \mapsto k + c$ (when allowed by boundary conditions) without changing $S$ suggests conservation of an energy-like quantity.

2. **Left–right subtree reflection**
   Reflecting $\sigma$ by swapping left and right subtrees ($L \leftrightarrow R$) without changing $S$ suggests conservation of “parity” or a chiral charge.

3. **Motif relabeling symmetry**
   If a class of motifs are indistinguishable in $V(\sigma)$ and in $K_k$, then exchanging them along a path should leave $S$ invariant, hinting at a conserved “motif charge.”

> If the discrete action $S[\gamma]$ is invariant under a family of transformations of Catalan histories
>
> ```math
> \gamma \mapsto \gamma',
> ```
>
> then there exists a corresponding quantity $Q(\gamma)$, computable from local motif and Dyck data, that is invariant along extremal histories.

In practice, this would look like:

* time-shift invariance $\Rightarrow$ conserved “computational energy” along the history,
* left–right symmetry $\Rightarrow$ conservation of a net imbalance or chiral charge,
* motif relabel invariance $\Rightarrow$ conservation of motif population measures.

This gives a way to define **conserved quantities directly on Catalan dynamics**, without starting from continuum field theory.

---

# Mass–Energy–Computation Invariant

*(Interpretive → Speculative)*

In the usual relativistic setting, we have the invariant

```math
E^2 - p^2 = m^2
```

(with $c=1$). In the Catalan setting, we can try to build an **analogous invariant** that incorporates:

* geometric motion $(t,x)$,
* computational proper time $\tau$,
* motif-based mass $m(\sigma)$.

---

### 8) Interpretation layer: reinforcement, agency, multicomputation, constants **[IDEA ONLY]**

These are explicitly interpretive readings of the same substrate—useful as a conceptual compass, not as claims.

In the actualization-weight picture, **quantum vs classical** is graded:

* Fresh structures with low $aw$ are sensitive to interference, symmetry, and
  alternative branches; behaviour is "quantum-like."
* Highly reinforced structures with large $aw$ have won many collapses; they
  behave rigidly and predictably, "classical-like."

Thus, decoherence becomes a matter of **reinforcement**: as a motif wins
repeatedly, its actualization weight increases, and its effective behaviour
loses sensitivity to delicate phase cancellations.

**Status**

* **Speculative but coherent.** This provides a concrete mechanism for a
  continuum between quantum and classical within the model, but remains
  phenomenological.

---

The collapse program distinguishes:

$$ \text{global} = \text{distribution of possibilities},\qquad \text{local} =
\text{actualization mechanism}, $$

with global behaviour described spectrally (Hilbert-space, shift operators,
Brownian limits) and local behaviour described by actualization-weighted
collapse.

This is strongly reminiscent of **multicomputation**:

* Many possible histories evolve in parallel (Dyck tiers; global view).
* A particular actualization path selects one realized history (local view).

**Status**

* **Solid (structure).** The decomposition into global vs local is explicit.
* **Interpretive.** The connection to Wolfram-style multicomputation is
  conceptual but well-aligned.

---

The Catalan Rule notes extend the motif story into cognition:

* Collapse is interpreted as the **present moment** of an embedded observer.
* Actualization weight functions as a kind of **memory**: how often the
  universe has passed through that structural pattern.
* Reentry kernels that maintain coherent self-reference over long histories are
  candidates for minimal **agents**.

Awareness is described as what it feels like when a reentrant structure not
only persists but also refers to its own past actualizations—experience as the
**felt actualization of potential through collapse**.

**Status**

* **Interpretive.** No mathematical claims of consciousness are made; this is a
  philosophical reading of the same substrate.

---

Finally, the Catalan Rule document proposes:

* Dimensionless physical constants (e.g. $\alpha$) may correspond to **fixed
  points of motif statistics**: asymptotic ratios of kernel frequencies in
  long-running motif ecologies.

In this view:

* The "values" of constants are not arbitrary parameters but emergent
  equilibria of recursive competition among motifs on the Catalan substrate.

**Status**

* **Speculative.** This is a research program outline; no explicit derivation
  is given.

---

Taken together, these extended notes form a library of ideas that sit around
the trimmed Catalan Light Cone paper:

* Rigorous: depth–breadth tradeoff, Dyck/Brownian scaling, spectral
  Hilbert-space picture, structural potential $U$, actualization weight $aw$,
  discrete Minkowski interval.
* Speculative but structured: collapse-as-gravitation, Casimir calibration,
  Born-like uniqueness arguments, Narayana sectors as angles, motif ecology,
  constants as fixed points.
* Interpretive: agency, experience, quantum–classical transition as
  reinforcement, causal orientation, and dimensional explanations.

---

---

### 9) Catalog of additional “nearby” ideas and research targets **[IDEA ONLY]**

This final dossier is a compact catalog of additional ideas that may (or may not) end up in papers, but are worth keeping visible because they connect multiple threads.

#### Renormalization / coarse-graining on motif distributions

# Renormalization Flow on Motif Distributions

*(Speculative but natural)*

Given a measure on Catalan histories (via $S[\gamma]$ and $\exp(-S)$), we can ask what happens when we:

* **coarse-grain the tree** (merge small subtrees into effective motifs),
* **rescale the Dyck length** (group steps into blocks),
* **redefine the motif dictionary** at a larger scale.

This defines a **renormalization group (RG) flow** on:

* motif probabilities,
* effective mass/energy parameters,
* and possibly on the functional form of $V(\sigma)$ itself.

### Basic idea

1. Start with a microscopic motif set ${\sigma}$ and bare potential $V(\sigma)$.
2. Group small subtrees into larger “blocks,” obtaining coarse motifs ${\Sigma}$.
3. Define an effective potential $V_{\mathrm{eff}}(\Sigma)$ such that the partition function is preserved:

```math
\sum_{\gamma} \exp[-S(\gamma; V)]
   \approx
\sum_{\Gamma} \exp[-S(\Gamma; V_{\mathrm{eff}})],
```

where $\gamma$ runs over fine histories and $\Gamma$ over coarse histories.

4. Track how parameters (e.g. motif masses, couplings) flow under repeated coarse-graining.

### Possible fixed points

* A **massless fixed point** where all motifs behave effectively symmetric and propagation is scale-invariant.
* A **massive fixed point** where certain motif families dominate and induce an effective correlation length.
* A **computationally critical point** where small changes in collapse rules cause large-scale structural changes.

This renormalization picture could unify:

* the Brownian excursion / continuum limits,
* motif statistics (Narayana refinements, etc.),
* and the emergent field-theoretic behavior on the Catalan cone.

---

#### Curvature, metric reconstruction, scattering, tensor-network readings (speculative but concrete)

# Discrete Curvature from Subtree Imbalance

*(Interpretive → Speculative)*

Each node in a binary tree has:

* a left subtree size $L$,
* a right subtree size $R$.

Define the **imbalance**:

```math
\kappa = \frac{|L - R|}{L + R}.
```

This serves as a curvature-like scalar:

* $\kappa = 0$ for perfectly balanced nodes (flat structure),
* $\kappa > 0$ indicates regions where structure bends or biases.

We can interpret $\kappa$ as:

1. **Intrinsic curvature** of the computational geometry
   (imbalanced structures resist collapse, causing “slower” propagation).

2. **Contribution to mass** via

   ```math
   m(\sigma) \sim f(\kappa),
   ```

   where $f$ is monotone.

3. **Geometric defect density** in the Catalan cone
   (analogous to curvature concentrated at nodes in Regge calculus).

This is speculative but mathematically natural.

---

# Metric Reconstruction from Subtree Statistics

*(Speculative)*

The Dyck cone gives a *background* $(t,x)$ geometry. However, effective geometry at larger scales can be reconstructed from **statistics of subtrees and motifs**.

Idea:

1. Consider a large region of the Catalan tree underlying histories in some ensemble.

2. Measure local motif statistics:

   * average subtree sizes,
   * imbalance $\kappa$,
   * depth variance $\mathrm{Var}(d)$,
   * motif mass $m^2(\sigma)$.

3. Infer an effective metric $g_{\mu\nu}$ whose curvature encodes these statistics.

For example, regions with:

* high imbalance or depth variance might correspond to “curved” domains,
* nearly symmetric subtrees correspond to “flat” domains.

This parallels:

* Regge calculus (curvature from deficit angles),
* random geometry (Liouville quantum gravity),
* CDT (curvature from triangulation patterns),

but with **Catalan combinatorics** as the primitive.

---

# Motif Scattering and an S-Matrix Analogue

*(Speculative)*

If stable motifs behave like particles, we can define **scattering processes** in the Catalan cone:

* Prepare an initial configuration with two incoming motifs (e.g. subtrees $A$ and $B$),
* Evolve under Catalan dynamics (collapse and motif interactions),
* Observe outgoing motifs in the far “future” of computational proper time.

A formal **S-matrix** analogue:

```math
S_{\alpha\beta}
  = \langle \beta_{\mathrm{out}} \vert \alpha_{\mathrm{in}} \rangle,
```

where $\alpha,\beta$ index asymptotic motif states (e.g. “one S-like motif + one K-like motif” etc.).

The propagator kernel $K(A,B)$ is the building block; the S-matrix is its “asymptotic” limit as the history length grows and boundaries are pushed to far past/future in $\tau$.

This suggests:

* defining **motif cross-sections** (probabilities that input motifs produce certain outputs),
* exploring **resonances** (unstable motifs that form transiently),
* and seeing whether some motif families behave like “bound states.”

---

# Tensor-Network Interpretation of the Catalan Substrate

*(Interpretive → Speculative)*

The Catalan structures naturally support a **tensor-network view**:

* each internal node = tensor with a fixed valence (e.g. 3 legs: parent, left child, right child),
* each leaf = trivial tensor (or a leg open to boundary conditions),
* the entire tree = contraction of a network of identical or motif-dependent tensors.

In this picture:

* Motifs correspond to **subnetworks** with different tensor patterns,
* Collapse corresponds to **tensor contraction / simplification** rules,
* The action $S[\gamma]$ corresponds to **weights on tensor configurations**.

This aligns with:

* MERA / MPS / PEPS intuitions,
* tensor networks in AdS/CFT and quantum gravity,
* and the idea that computation and geometry are emergent from the same combinatorial data.

You can think of the Catalan cone as a **specific tensor-network ansatz** for spacetime + computation, with motif interactions encoding both “matter” and “computation” degrees of freedom.

---

# Field Equations Emergent from Action Minimization

*(Speculative)*

If we coarse-grain over many histories and motifs, we can attempt to define:

* effective fields $\phi(t,x)$ that encode aggregated motif densities,
* e.g. $\phi(t,x)$ could be the expected mass density or curvature at point $(t,x)$ in the cone.

The discrete Euler–Lagrange equations for $S[\gamma]$ then induce **effective field equations** for $\phi$:

```math
\frac{\delta S_{\mathrm{eff}}[\phi]}{\delta \phi(t,x)} = 0,
```

where $S_{\mathrm{eff}}$ is an action functional obtained by integrating out microscopic Catalan structure.

One might expect:

* diffusion-like or wave-like equations reflecting the Brownian / Schrödinger continuum limits,
* nonlinear terms from motif interactions,
* curvature couplings from imbalance/variance terms.

This is speculative, but provides a roadmap for deriving **macroscopic PDEs** from the underlying Catalan dynamics.

---

# Gravitational Analogues from Motif Curvature

*(High Speculative but Conceptually Consistent)*

If subtree imbalance and depth variance play the role of curvature and energy density, one can imagine:

* an **Einstein-like equation** relating effective curvature (from motif statistics) to effective stress–energy (from motif masses and interactions).

Symbolically:

```math
\mathrm{Curvature}(\text{motif statistics})
   \sim
\mathrm{Energy}(\text{motif masses and flows}).
```

At this point, the speculation is high, but the structure is suggestive:

* the Catalan cone provides a causal scaffold,
* motif statistics provide local “matter” content,
* collapsing histories provide dynamics.

If a consistent continuum limit exists, it may resemble a toy model of **quantum gravity with computation integrated** as an intrinsic degree of freedom.

---

#### Stability map (what currently looks most claimable vs most exploratory)

- **Core combinatorics (solid):**
  - Dyck/tree/S-expr equivalences; Catalan counts; Narayana refinement by peak count (**[IN PAPER]**).
  - Depth–breadth (including Kraft equality) (**[IN PAPER]**).
  - Dyck cone geometry and Brownian-excursion scaling (**[IN PAPER]**).
  - Hilbert-space state space over tiers (basis/superpositions in paper; shift-operator program is **[IDEA ONLY]**).
  - Size bookkeeping $U(T)$ and subtree-selection drops (**[PARTIAL]**); $F_{\text{app}}$, $aw$, chronons remain **[IDEA ONLY]**.

- **Near-solid but still “needs a clean proof/derivation”:**
  - Born-like uniqueness from structural coherence (**[IDEA ONLY]**).
  - A well-motivated discrete action $S[\gamma]$ that yields a tractable propagator $\mathcal{K}$ (**[IDEA ONLY]**).

- **Exploratory / program direction:**
  - Mass/energy/momentum analogues for motifs: $E^2-p^2=m(\sigma)^2$ as an effective invariant.
  - Discrete dispersion and PDE limits from a preferred Laplacian/operator on Catalan space.
  - Motif ecology statistics as emergent constants.

- **Frontier speculation (track, don’t claim):**
  - Gravity/curvature emergence via motif imbalance and coarse-grained geometry.
  - Standard-model–level gauge groups / particle families from motif symmetries.
  - Full “S-matrix” and field-theoretic scattering on the Catalan substrate.

---

---

## ARCHIVE

The pre-refactor snapshot of this file has been moved to `docs/ARCHIVE.md`.
