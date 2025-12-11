What follows is a compact "field guide" to the ideas that sit around (but
mostly outside) the trimmed Catalan Light Cone paper. Each subsection is
self-contained, with key definitions and equations, and ends with a short note
on status:

* **solid** = standard math / clearly derivable from the Catalan setup,
* **speculative** = motivated but not rigorously derived,
* **interpretive** = philosophical / physical reading layered on top.

---

## 1. Depth–breadth tradeoff and discrete uncertainty

### 1.1. Depth, breadth, and Kraft-type constraints

For a Dyck tree $T$, let:

* ${d_i}$ be the depths of its leaves,
* $h(T) := \max_i d_i$ the maximal depth ("height"),
* $r(T)$ a breadth measure (e.g. number of leaves or maximum number of disjoint
  pairs at a level).

Interpreting the tree as a full binary prefix code, the **Kraft equality**
holds:

$$ \sum_i 2^{-d_i} = 1. $$

This implies a tradeoff:

* If many leaves are shallow ($d_i$ small), their contributions $2^{-d_i}$ are
  large, so there can be fewer of them.
* If there are many leaves, some must be deep to keep the sum at 1.

Thus, one cannot have simultaneously "maximal depth" and "maximal breadth";
extremal patterns (chain vs star) sit at opposite ends, while typical trees
interpolate. 

**Status**

* **Solid.** The Kraft equality and its consequences are standard coding-theory
  facts applied to Catalan trees.
* **Speculative/interpretive.** Calling this a "discrete uncertainty" relation
  between "time-like commitment" (depth) and "space-like spread" (breadth) is
  interpretive, but consistent with the cone picture.

---

## 2. Hilbert-space and spectral view on Catalan tiers

### 2.1. Basis, shift operator, and Fourier modes

Fix tier $n$. Let $\{|w_j\rangle : j=0,\dots,C_n-1\}$ be an orthonormal basis
labeled by the Dyck words of length $2n$. Arrange them in some cyclic order
around the "rim" of the cone.

Define the **shift operator** $S$ by:

$$ S|w_j\rangle = |w_{j+1}\rangle,\qquad S^{C_n} = I. $$

The eigenvectors of $S$ form a discrete Fourier basis:

$$
|\tilde{k}\rangle =
\frac{1}{\sqrt{C_n}}\sum_{j=0}^{C_n-1} e^{2\pi i jk/C_n} |w_j\rangle,
$$

with eigenvalues

$$ S|\tilde{k}\rangle = e^{-i 2\pi k / C_n} |\tilde{k}\rangle. $$ 

One can then introduce an effective Hamiltonian $H$ and time step $\Delta$ by
setting:

$$ S = e^{-i H\Delta / \hbar}, $$

so that each eigenmode satisfies

$$
H|\tilde{k}\rangle = E_k|\tilde{k}\rangle,\quad S|\tilde{k}\rangle =
e^{-iE_k\Delta/\hbar}|\tilde{k}\rangle.
$$ 

This realizes each tier as a finite-dimensional Hilbert space with a unitary
"around-the-rim" evolution step.

**Status**

* **Solid.** This spectral construction is standard: a cyclic graph’s
  adjacency/shift operator is diagonalized by discrete Fourier modes.
* **Speculative.** Identifying the abstract $H$ with a physical Hamiltonian and
  the tier rim with a spatial slice is a model choice, not a theorem.

---

## 3. Structural action and path-integral amplitudes

### 3.1. Action as area under Dyck paths

A Dyck path $w$ of semilength $n$ has height process $`(H_k)_{k=0}^{2n}`$, with
$`H_0 = H_{2n} = 0`$. The **area** under the path is

$$
A[w] := \sum_{k=0}^{2n-1} H_k.
$$

A **structural action** is then taken as

$$ S[w] := \alpha A[w] + \beta h_{\max}(w) + \dots, $$

for some constants $\alpha,\beta$ and possibly curvature-like terms. 

Assign complex amplitudes

$$ \mathcal{A}[w] = e^{i S[w]/\hbar}. $$

Summing over all Dyck histories $w$ from a given initial to final configuration
yields a discrete **path integral**. In scaling limits where the height process
converges to Brownian excursions, the dominant contributions approximate a
Feynman-type sum over paths with quadratic action (leading to heat/Schrödinger
dynamics; see below).

**Status**

* **Solid.** The area functional and its relation to Dyck paths is
  well-defined; the convergence of height processes to Brownian excursions
  under diffusive scaling is standard. 
* **Speculative.** The specific choice of $S[w]$ and claim that it reproduces a
  particular physical action is a hypothesis; the paper does not yet derive a
  unique action from first principles.

---

## 4. Helical worldlines and phase time

### 4.1. Two notions of time and helical slices

Two complementary "times" appear: 

1. **Causal time.** Tier $n$ (or $t = n$) is discrete proper time; all states
at a given $n$ are simultaneous.
2. **Phase time.** Each history $w$ at tier $n$ carries a phase

$$
\tau(w) =
\frac{h_{\max}(w)}{n},\qquad \theta(w) =
(\omega n + \beta\,\tau(w)) \bmod 2\pi,
$$

where $\omega$ and $\beta$ encode global and shape-dependent contributions.

Histories with equal $\theta(w)$ trace **helices** through the cone: as $n$
increases, the point $(t=n, \text{breadth}, \theta)$ winds around the cone with
a pitch determined by $\omega,\beta$. 

At large $\omega$ (high "carrier frequency"), these helices approximate
continuous precession on a Bloch-sphere-like manifold; the cone cross-sections
look like constant-phase slices.

**Status**

* **Solid.** The existence of two independent parameters (tier and
  shape/height) is straightforward. The formula for $(\tau(w),\theta(w))$ is a
  consistent definition.
* **Speculative/interpretive.** Reading these helices as actual worldlines in
  physical spacetime or Bloch-sphere trajectories is an interpretive mapping,
  not mathematically forced.

---

## 5. Information capacity and Bekenstein-like bounds

The number of Dyck words of semilength $n$ is the Catalan number

$$ C_n = \frac{1}{n+1}\binom{2n}{n}. $$

At fixed "radius" or cross-section of the cone, the number of admissible
boundary configurations grows combinatorially but can be compared to an **area
measure**. Under coarse-graining, one can interpret each Dyck event as
contributing one unit of causal information, so that:

* Information content per unit cross-sectional area is finite.
* At Planck-scale resolution, this saturates bounds analogous to the Bekenstein
  limit (roughly one bit per Planck area). 

**Status**

* **Solid.** Finite combinatorial entropy per tier and the asymptotics of
  Catalan numbers are rigorous.
* **Speculative.** Matching those counts to physical Bekenstein bounds requires
  nontrivial calibration and is not derived; it is a suggestive analogy.

---

## 6. Structural potential and collapse work

### 6.1. Structural potential $U(T)$

For a rooted, finite binary tree $T$, define the **structural potential**

$$ U(T) := \text{number of internal pairs in } T. $$

Properties: 

* Invariant under local rotations (associahedron moves).
* Increases by 1 under both primitive expansion moves:

  * **Wrap**: $x \mapsto (()x)$,
  * **Branch**: $(x,y) \mapsto \langle x,y\rangle$.
* Nonnegative.

For a focused pair $\langle L,R\rangle$, define an **applicative force**

$$ F_{\text{app}}(\langle L,R\rangle) := |U(L) - U(R)|. $$ 

The **collapse rule** "keep the more structured side" selects the subtree with
larger $U$.

### 6.2. Collapse work $\Delta U$

When a focused pair collapses, the structural potential drops by

$$ \Delta U = 1 + \min\{U(L),U(R)\}, $$

where the $(+1)$ accounts for removal of the parent pair and $\min\{\cdot\}$
reflects the loss of the "discarded" subtree from the realized history. 

This $\Delta U$ is interpreted as **irreversible collapse work** for that event.

**Status**

* **Solid.** Definitions of $U$, $F_{\text{app}}$, and $\Delta U$ are
  combinatorially precise.
* **Interpretive.** Reading $\Delta U$ as "work" and $F_{\text{app}}$ as
  "force" is interpretive; still, it is a consistent energy-like functional on
  the tree space.

---

## 7. Locality, chronons, and proper time as collapse work

### 7.1. Locality constraint and chronons

Assume the evolution consists of **chronons**, each comprising:

1. A finite sequence of local rotations (no change in $U$).
2. Exactly one collapse at a focused pair $\langle L,R\rangle$.

Impose a **locality bound**: during one chronon, the focus can move at most one
edge in the tree (or one unit in breadth). 

This yields a maximum propagation speed

$$ c = 1 \ \text{edge per chronon}. $$

### 7.2. Discrete Minkowski interval and proper time

Consider an observer/worldline that moves $\Delta x$ steps in breadth over
$\Delta t$ chronons. The model defines a discrete invariant interval

$$ s^2 = \Delta t^2 - \Delta x^2, $$

and **proper time**

$$ \Delta\tau = \sqrt{\Delta t^2 - \Delta x^2}. $$ 

The key interpretive statement: $\Delta\tau$ literally counts the total
collapse work performed in the observer’s own frame; motion "uses up" part of
the update budget on changing location (rotations and focus moves) rather than
on local collapse, so moving structures age more slowly.

**Status**

* **Solid.** The combinatorial definition of chronons, focus moves, and
  discrete interval is explicit.
* **Speculative/interpretive.** Identifying this with Lorentz kinematics and
  reading $\Delta\tau$ as proper time in a physical sense is a model
  hypothesis.

---

## 8. SI calibration via the Casimir effect

### 8.1. Defining a collapse force scale

Introduce:

* Edge length $\ell_0$ (fundamental spatial unit).
* Chronon duration $\tau$.

Set

$$ c = \frac{\ell_0}{\tau},\qquad \varepsilon_0 = \frac{\hbar}{\tau}, $$

where $\varepsilon_0$ is a unit collapse energy. Then the characteristic
**collapse force** is

$$ F_0 = \frac{\varepsilon_0}{\ell_0} = \frac{\hbar c}{\ell_0^2}. $$

### 8.2. Comparison with Casimir pressure

For two parallel plates separated by $a$, the Casimir force per unit area is

$$ \frac{F_{\text{Casimir}}}{A} = -\frac{\pi^2 \hbar c}{240\,a^4}. $$

Taking $a = \ell_0$ and a single "cell" of cross-sectional area $\ell_0^2$, one
finds

$$ F_{\text{Casimir, cell}} \approx \frac{\pi^2}{240} \frac{\hbar c}{\ell_0^2} =
\frac{\pi^2}{240} F_0 \approx 0.0411\,F_0.
$$ 

This suggests that choosing $\ell_0$ near a relevant cavity scale leads to
collapse forces comparable to observed vacuum pressures.

**Status**

* **Solid.** The algebra connecting $F_0$ and Casimir expressions is
  straightforward.
* **Speculative.** Treating this as a genuine physical calibration of $\ell_0$
  and $\tau$ is conjectural; it has not been derived from first principles.

---

## 9. Actualization weight and actualization-biased collapse

### 9.1. Definition of actualization weight

Given the tree grammar

$$ T ::= () \mid (t_1 t_2),\quad t_1,t_2\in T, $$

define the **actualization weight** $aw: T \to \mathbb{N}$ inductively: 

1. $aw(()) = 0$.
2. If $t = (L,R)$ and a local contraction selects $L$, then increment $aw(L)$
to $aw(L)+1$, and assign $aw(\text{result}) = aw(L)+1$.
3. If $R$ is selected, analogously increment $aw(R)$.
4. Newly expanded subtrees start with $aw = 0$.

Thus, $aw(t)$ counts **wins**, not size; it measures "how much reality has
already flowed through here." 

### 9.2. Actualization-biased collapse rule

Given $t = (L,R)$, the **actualization-biased collapse** is:

$$
(L,R) \rightsquigarrow
\begin{cases}
  L, & aw(L) > aw(R),
  \\ R, & aw(R) > aw(L),\\
  \text{freeze}(L,R)\ \text{or symmetry-breaking}, & aw(L) = aw(R).
\end{cases}
$$ 

A "freeze-balanced" option keeps equally actualized branches live rather than
immediately collapsing.

**Status**

* **Solid.** The definition and update rule for $aw$ are explicit.
* **Interpretive.** Modeling "reality’s preference" as "earlier wins" is a
  conceptual stance, but internally consistent.

---

## 10. Emergent I, K, S, and Y from actualization-weighted collapse

### 10.1. Identity ($I$)

Define the identity-like tree

$$ I := (()()). $$

The base rule is

$$ (() x) \rightsquigarrow x. $$ 

The result $x$ inherits an incremented actualization weight:

$$ aw(x) := aw(x)+1. $$ 

Thus $I x \rightsquigarrow x$, with $x$ now more actual than fresh neighbors.

### 10.2. K-like constant/selector behavior

Let $A$ be already actualized with $aw(A) = a \ge 1$, and let $B$ be freshly
expanded with $aw(B) = 0$. Consider

$$ T := (A B). $$

By the actualization-biased rule,

$$ aw(A) > aw(B) \implies (A B) \rightsquigarrow A,\quad aw(A) \mapsto a+1. $$ 

Define a reusable K-shape

$$ K_A := (A()). $$

Then

$$ K_A \rightsquigarrow A, $$

and for any $C$,

$$ (K_A C) \equiv ((A())C) \rightsquigarrow A, $$

since the left branch has higher $aw$ and dominates. 

This reproduces

$$ K A C \to A $$

without installing a primitive K rule.

### 10.3. S-like sharing and entanglement

When a highly actualized core $C$ branches into two fresh reentries $X$ and
$Y$,

$$ C \rightsquigarrow (C, X),\quad C \rightsquigarrow (C, Y), $$

with $aw(C) \gg 0$ and $aw(X) = aw(Y) = 0$, the core cannot be overwritten by either
branch. Both branches share the same earlier piece, creating an S-like pattern:
one actualized part feeding two later consumers. 

If the collapse rule in balanced cases is "freeze," then:

> Two branches are **entangled** iff they both reference a subtree whose
> actualization weight is equal on both sides and is not yet collapsed. 

### 10.4. Y-like self-reentry

A Y-like structure is built by:

1. Starting from an actualized core $C$.
2. Reentering it to produce a fresh copy.
3. Arranging that the presence of the fresh copy is itself a reason to reenter
again.

This yields a tree that, after collapse, produces another copy of the same
shape but at a higher $aw$, so its actualization weight grows without bound:

$$ \text{Y-loop} \implies aw \to aw+1 \to aw+2 \to \cdots. $$ 

This is the structural analogue of a fixed-point combinator: a locally
self-sourcing collapse.

**Status**

* **Solid (internal).** Given the definitions of $aw$ and the collapse rule,
  the derivation of I, K, S, Y behaviors within the tree space is correct and
  demonstrated.
* **Speculative/interpretive.** Identifying these motifs with "particles,"
  "fields," or cognitive structures is interpretive, and their stability in
  large-scale dynamics remains conjectural.

---

## 11. Causal orientation and left spine

The choice "left applies to right" is given a causal justification:

* The left subtree $L$ at a node $(L,R)$ is interpreted as the **earlier**
  portion (already actualized part of the tree).
* The right subtree $R$ is the **later** contribution (newly expanded
  possibility).

Actualization-biased collapse gives "earlier interprets later": $(L,R)$ is "$L$
acts on $R$". Mirroring the convention "$R$ applies to $L$" would give later
parts power over earlier ones, i.e. retrocausality. 

Therefore a **left-spine, curried representation** is preferred to align
computational application with causal order.

**Status**

* **Solid (formal).** The left-curried encoding of binary trees is unambiguous.
* **Interpretive.** The causal reading of left vs right is a choice of physical
  semantics, not dictated by the math.

---

## 12. Minimal embedding dimension for reentrant structure

Actualization introduces **back-references** (e.g. K, S, Y patterns pointing to
earlier structures). The resulting object is a directed graph $G=(V,E)$ whose
edges include:

* Parent–child links (tree edges).
* Backward reference links (reentry edges). 

To embed $G$ into continuous space without spurious crossings:

* Consider three early actualized structures $(A_1,A_2,A_3)$ and three later
  ones $(B_1,B_2,B_3)$ such that:

  * $B_1$ references $(A_2,A_3)$,
  * $B_2$ references $(A_1,A_3)$,
  * $B_3$ references $(A_1,A_2)$.
* The subgraph of reference edges is $K_{3,3}$, which is nonplanar by
  Kuratowski’s theorem; any 2D embedding must have crossings that are not true
  interactions. 

Thus:

* **2D is insufficient** to represent general reentrant structure without false
  crossings.
* **3D is sufficient** for embedding generic finite graphs.
* The model suggests that an honest representation of reentry dynamics needs at
  least three spatial dimensions. 

**Status**

* **Solid.** The graph-theoretic argument about $K_{3,3}$ non-planarity is
  standard.
* **Speculative/interpretive.** Linking this to "why 3D space" in physics is
  conjectural.

---

## 13. Narayana sectors and breadth-angle

Narayana numbers $N(n,k)$ count Dyck paths of semilength $n$ with exactly $k$
peaks (or other equivalent statistics of breadth). The Catalan number
decomposes as:

$$ C_n = \sum_{k=1}^n N(n,k). $$

The proposal is to treat **Narayana sectors** at fixed $n$ as breadth sectors:

* Sector $k$ collects all histories of that tier with "breadth" $k$ (e.g.
  number of peaks).
* The index $k$ can be reparametrized as an angular coordinate $\phi$ around
  the cone, providing a discrete notion of angle:

$$ \phi_k \approx 2\pi \frac{k-1}{n-1},\quad k=1,\dots,n. $$

Weighted sums over sectors then encode preferences for narrow vs broad
histories; different choices of sector weights $w_k$ correspond to different
"angular distributions" of amplitude.

**Status**

* **Solid.** Narayana numbers and the decomposition $C_n = \sum_k N(n,k)$ are
  standard.
* **Speculative.** Using $k$ as an actual spatial or phase angle, and tying
  physical observables to the $w_k$, is a model choice.

---

## 14. Born-like measures from structural constraints

In the extended light-cone manuscript, there is a sketch of a derivation:

1. Assign complex amplitudes $\psi(w)$ to histories.
2. Require that **actualization weights** or probabilities over coarse-grained
outcomes:

   * Refine correctly under splitting of alternatives.
   * Are invariant under regrouping of structurally equivalent histories
     (structural gauge invariance). 

Under assumptions analogous to Gleason-like or Dutch-book coherence
constraints, this pushes toward a quadratic dependence:

$$ \mathbb{P}(\text{outcome}) \propto |\psi|^2 $$

as the unique consistent measure.

**Status**

* **Solid (local).** The structural requirements (refinement, regrouping) are
  clearly stated.
* **Speculative.** The derivation is not fully formalized; the uniqueness of
  $|\psi|^2$ is asserted heuristically rather than proved.

---

## 15. Motif ecology and reentry kernels

### 15.1. Motifs vs kernels

A **motif** is a small subtree pattern that recurs with non-negligible
frequency under stochastic expansion + collapse simulations.

Two classes appear:

* **Equilibria:** patterns that recur but do not necessarily recreate
  themselves.
* **Reentry kernels:** minimal patterns that, when they collapse, recreate the
  conditions for their own future collapse—locally self-sourcing loops. 

Kernels are candidates for "particle-like" excitations; their stability and
interactions define an **ecology**.

### 15.2. Kernel interactions and sectors

When worldlines of kernels overlap or share substructure (e.g. share earlier
actualized cores), they influence each other’s actualization weights and
collapse statistics. Families of kernels that interact strongly form
**interaction sectors**, reminiscent of particle sectors in QFT. 

Preliminary simulations suggest:

* Certain triply nested kernels behave antisymmetrically under exchange
  (fermion-like).
* Doubly nested ones behave symmetrically (boson-like).

**Status**

* **Solid (definition).** The notions of motif and kernel are well-defined;
  classification schemes are outlined.
* **Speculative.** The fermion/boson analogy and correspondence to standard
  model sectors are conjectural and based on early simulation hints.

---

## 16. Quantum–classical transition via reinforcement

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

## 17. Agency, memory, and experience

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

## 18. Fields, interactions, and gauge symmetry

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

## 19. Global vs local views and multicomputation

The collapse program distinguishes:

$$
\text{global} =
\text{distribution of possibilities},\qquad \text{local} =
\text{actualization mechanism},
$$

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

## 20. Constants as statistical fixed points

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

## 21. Mode decompositions on Dyck trees and discrete field equations

### 21.1. Fields on words, prefixes, and nodes

There are (at least) three natural ways to define a “field” on the Catalan substrate:

1. **Field on words at fixed tier.**  
   For tier \(n\), define a complex field
   \[
     \Phi_n : \mathcal{D}_n \to \mathbb{C},\qquad
     w \mapsto \Phi_n(w),
   \]
   where \(\mathcal{D}_n\) is the set of Dyck words of semilength \(n\). Each \(w\) is a full history at that proper time.

2. **Field on prefixes (the global possibility tree).**  
   Let \(\mathcal{C}\) be the infinite Dyck-prefix tree. A field is
   \[
     \Phi : \mathrm{Pref}(\mathcal{C}) \to \mathbb{C},\qquad
     u \mapsto \Phi(u),
   \]
   assigning a value to every prefix \(u\). This is the most global viewpoint; it “lives” directly on the Catalan light-cone substrate with all local cones (see Sections 2 and 19).

3. **Field on nodes of a single Dyck tree.**  
   For a fixed word \(w\), with tree representation \(T(w)\), one can define a local field
   \[
     \phi_w : V(T(w)) \to \mathbb{C},\qquad
     v \mapsto \phi_w(v),
   \]
   where \(V(T(w))\) is the set of internal nodes or edges of the tree. This is the “internal field on a given history,” analogous to a field configuration on a single spacetime background.

The first two are **global** (fields on ensembles / prefixes); the third is **local** (fields on one realized history). The mode-decomposition picture below uses the third, but is compatible with the first two.

**Status**

* **Solid (definitions).** All three views are straightforward structures on the Catalan objects already in use.
* **Speculative.** Identifying these fields with physical fields (e.g. scalar, gauge) is an interpretive layer, not derived.

---

### 21.2. Subtree modes as a multiscale basis

Every Dyck tree \(T(w)\) admits a canonical hierarchy of subtrees:

* each internal node \(v\) of \(T(w)\) defines a subtree \(T_v\),
* these subtrees are themselves Catalan trees, with the usual depth–breadth structure.

This suggests treating these subtrees as **localized modes**. Concretely:

* For each internal node \(v\), define a mode function \(\psi_v\) on histories (or on trees) that is “supported on” the corresponding subtree \(T_v\). For example:
  * \(\psi_v(w) = 1\) if the configuration around \(v\) in \(T(w)\) matches a particular pattern, and \(0\) otherwise.
  * Or more smoothly, \(\psi_v(w)\) could be a function of the shape of \(T_v\) (height, breadth, area, motif class, etc.).

Then amplitudes on the full tree can be written as a **discrete mode expansion**:
\[
  \Phi(w) \;=\; \sum_{v \in V(T(w))} a_v\,\psi_v(w),
\]
where the coefficients \(a_v\) quantify how strongly each subtree mode contributes.

This is analogous to a **wavelet decomposition**:

* the tree hierarchy provides the “scales”;
* subtrees at different depths provide coarse vs fine modes;
* the set \(\{\psi_v\}\) is finite for any finite Dyck word \(w\).

In the global language, one can also define a family of modes \(\psi_\alpha\) indexed by small subtree types (motifs) and express \(\Phi_n\) as
\[
  \Phi_n(w) \;=\; \sum_\alpha a_\alpha^{(n)}\,\psi_\alpha(w),
\]
where \(\alpha\) runs over a library of motif-types (see Section 15 on motif ecology).

**Status**

* **Solid (structural).** The hierarchy of subtrees and the finite mode expansion are exact combinatorial facts.
* **Speculative.** The particular choice of mode family \(\{\psi_v\}\) or \(\{\psi_\alpha\}\), and any claim of uniqueness, is model-dependent.

---

### 21.3. Static decomposition vs dynamic evolution

At a fixed tier \(n\), the field \(\Phi_n(w)\) (or \(\phi_w(v)\)) is a **static snapshot**. Dynamics arise in two distinct ways:

1. **Tier growth (external / causal time).**  
   Moving from tier \(n\) to \(n+1\) adds a new pair step to the Dyck word. This extends the tree by a local growth rule, increasing the pool of subtrees and therefore the basis of modes. A generic update law looks like
   \[
     \Phi_{n+1}(w') \;=\; \sum_{w \prec w'} K(w' \leftarrow w)\,\Phi_n(w),
   \]
   where the kernel \(K(w' \leftarrow w)\) is nonzero only if \(w'\) is a one-step extension of \(w\) that respects the Dyck constraint. This is the “global” time evolution used in the path-integral picture (Section 3).

2. **Internal redistribution (internal / phase-like time).**  
   Even at fixed tier \(n\), amplitude can be redistributed among the nodes of a single tree via a discrete operator acting on \(\phi_w\), for example:
   \[
     \phi_w^{(m+1)}(v)
       \;=\; \phi_w^{(m)}(v) - \kappa \bigl(L_T \phi_w^{(m)}\bigr)(v),
   \]
   where \(m\) is an internal time step and \(L_T\) is a graph Laplacian on the tree \(T(w)\) (see below). This is a **diffusion** or **wave** evolution on a fixed combinatorial background.

In the continuum limit, tier-growth dynamics give rise to **Brownian excursion + heat/Schrödinger** behaviour (Section 2), while internal redistribution on the tree or prefix graph corresponds to **field propagation** on a fixed “slice” of the substrate.

**Status**

* **Solid (formal structure).** Decomposing dynamics into (i) causal-tier growth and (ii) internal redistribution is consistent with the existing path-integral and light-cone constructions.
* **Speculative.** Interpreting these two times as physically distinct (proper time vs phase time, or similar) is interpretive (see Section 4).

---

### 21.4. Tree Laplacians and discrete heat/Schrödinger equations

Given a Dyck tree \(T(w)\) with node set \(V\) and edges \(E\), define a discrete **tree Laplacian** \(L_T\) acting on node fields \(\phi_w : V \to \mathbb{C}\) by
\[
  (L_T \phi_w)(v)
    := \phi_w(v) - \frac{1}{\deg(v)} \sum_{u \sim v} \phi_w(u),
\]
where \(\deg(v)\) is the degree of node \(v\) and \(u \sim v\) ranges over neighbours connected by tree edges.\footnote{Other normalizations (combinatorial, normalized Laplacian, weighted edges) are possible; the choice affects spectra but not the basic structure.}

Then:

* The **discrete heat equation** on the tree is
  \[
    \frac{\partial}{\partial \tau} \phi_w(\tau, v)
      = -\kappa \,(L_T \phi_w)(\tau, v),
  \]
  or in discrete internal time steps \(\tau_m = m \Delta \tau\),
  \[
    \phi_w^{(m+1)} = \bigl(I - \kappa \Delta \tau \, L_T\bigr) \phi_w^{(m)}.
  \]

* The **discrete Schrödinger-like equation** on the tree is
  \[
    i \frac{\partial}{\partial \tau} \phi_w(\tau, v)
      = H_T \phi_w(\tau, v),
  \]
  with a Hamiltonian
  \[
    H_T := \alpha L_T + V_T,
  \]
  where \(V_T\) is a potential term depending on local features (height, breadth, motif labels, etc.). In discrete steps:
  \[
    \phi_w^{(m+1)} \approx e^{-i H_T \Delta \tau} \phi_w^{(m)}.
  \]

Analogous definitions apply to the **prefix tree \(\mathcal{C}\)** at fixed tier \(n\): a Laplacian on the induced subgraph of prefixes of length \(2n\) gives a heat/Schrödinger-type evolution on the “rim” Hilbert space discussed in Section 2 (Hilbert-space and spectral view).

In large-\(n\) limits:

* \(T(w)\) for typical random Dyck words converges (in an appropriate sense) to the **Continuum Random Tree (CRT)** / Brownian excursion object.
* Spectral properties of \(L_T\) are expected to converge to Laplacian-type operators on the limiting continuum tree.  
* The discrete heat/Schrödinger equations on \(T(w)\) should then approximate continuum differential equations on that limiting object, paralleling the Dyck \(\to\) Brownian excursion \(\to\) heat/Schr chain already used for amplitudes.

**Status**

* **Solid (discrete operators).** The definition of \(L_T\) and the discrete heat/Schr equations on trees and prefix graphs is standard spectral graph theory.
* **Speculative.** The precise continuum limit of these operators on random Dyck trees, and the identification of the limiting PDEs with physical field equations, is a research program rather than a completed derivation.

---

### 21.5. Relation to global spectral view and gauge/field ideas

This mode-decomposition and tree-Laplacian picture connects several earlier ideas:

* Section 2 (Hilbert-space and spectral view) diagonalizes a **shift operator around the rim** at fixed tier \(n\), giving global “Fourier modes” indexed by a discrete momentum \(k\). The present section adds **local modes on trees / prefixes**, giving a complementary “position / shape space” description.

* Section 18 (fields and gauge symmetry) treats labels on nodes/edges as fields, with gauge redundancy implemented by structural equivalences. The Laplacian + mode picture gives these fields a natural **dynamics** (heat/Schr-type evolution) on a fixed combinatorial background.

* Section 19 (global vs local views) distinguishes:
  * a **global** multicomputation picture (all histories), and
  * a **local** actualization picture (one realized path).  
  Fields and mode decompositions can be defined in both regimes: globally as amplitudes over histories, locally as fields on a single realized tree. The same Catalan structure supports both.

Taken together, this suggests a program:

* Use **subtree modes** as a combinatorial analogue of Fourier/wavelet bases.
* Use **tree/prefix Laplacians** to define discrete heat/Schrödinger dynamics on those modes.
* Study the **scaling limits** of spectra and eigenmodes under Dyck \(\to\) Brownian / CRT convergence.
* Compare the resulting continuum operators to familiar field operators in QFT / quantum mechanics.

**Status**

* **Solid (structural alignment).** The connections to Sections 2, 18, and 19 are mathematically consistent: all constructions live on the same Catalan objects and standard graph/Laplacian tools.
* **Speculative.** Whether this program yields a concrete, physically viable field theory on the Catalan substrate remains open; at present it is a roadmap for future work.

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
