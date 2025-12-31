# The Catalan Engine (Intuition Draft)

This is not the arXiv paper.

It’s the version written for you: the one that tries to keep the picture alive
while still staying honest about what is definition, what is choice, what is
interpretation, and what is still open.

Throughout, I’ll use inline callouts like these:

> **FACT** — something that is true in ordinary math/combinatorics, or a direct,
> checkable consequence of the definitions.

> **MODEL CHOICE** — a place where we decide “this is the rule” or “this is the
> weighting” because we are building a model, not proving a theorem.

> **INTERPRETATION** — a way of *reading* the model in physical/semantic terms.

> **OPEN** — an unresolved gap, or a fork in the road.

If a sentence ever feels like it’s claiming too much, it should probably be
inside one of these blocks.

---

## 1. Why Dyck shows up at all (and why it’s not “just branching”)

You started with cons-pairs. That matters.

A cons-pair is the smallest nontrivial piece of structure: not a value, not a
label, not a number, but a *relationship*: a left thing and a right thing held
together as a unit.

If you allow yourself only that operation—“make a pair”—you can generate
infinite shape. But you can’t yet generate *process*. You can build, but
building by itself has no intrinsic notion of being “done”.

The moment you insist on *return*—on closure, on coming back—you introduce the
smallest possible notion of a completed act.

In parenthesis language, return is “every open must close”.
In stack language, return is “every push must eventually pop”.
In your language, return is “every created context must eventually discharge”.

That is the extra constraint that turns “the set of all binary choices” into
“the set of all well-formed nested choices”.

> **FACT** — If you take arbitrary binary strings, you get a huge space:
> everything in `{0,1}^*`. If you take well-bracketed strings, you get a much
> smaller, much more structured space: the Dyck language. Dyck is the free
> language of balanced parentheses: it is the minimal formal system that has
> “open/close” and forbids closing before opening.

This is the first unifying point:

Binary branching is *too big* to be a self-contained universe of completed
events. Dyck is what you get when you demand that events come with a built-in
notion of completion.

And once you have completion, you can talk about:

- “a history” (a finished parenthesis string),
- “a partial history” (a prefix that hasn’t returned yet),
- “how many unfinished obligations exist right now” (stack height),
- “how much unfinishedness accumulated over time” (area under the height curve).

Those last two are where your “potential of unresolved structure” starts to
become precise.

---

## 2. One object, three coordinate systems (and why this is not handwaving)

The arXiv draft repeats “these are just coordinate changes”, but it’s easy to
feel like we’re cheating: a Dyck path looks geometric; a tree looks like syntax;
a parenthesis string looks like code. Why should they be the same thing?

Before we do an example, one small vocabulary pin:

> **FACT** — A *bijection* is a perfect reversible dictionary between two ways
> of writing the same information. If you have a bijection, you are not “adding
> a model assumption” by switching representations; you are just translating.

Let’s do it slowly with a single, concrete example.

Take the Dyck word:

```
w = (())
```

### 2.1 The “walk” (Dyck path) view

Scan left to right. Every `(` means “open”; every `)` means “close”.
Track the running difference (opens minus closes as you scan):

```
symbols:  (  (  )  )
height :  1  2  1  0
```

That running height is the Dyck walk. It never goes negative (you never close
before opening), and it ends at zero (everything you opened is closed).

> **FACT** — The “height” at each step is literally “how many opens are still
> waiting to be matched”. This is not a metaphor; it’s exactly what the counter
> computes.

### 2.2 The “tree” view

Every Dyck word has a canonical parse as a full binary tree:

- the outermost pair is the root,
- inside it, you split the remaining substring into two balanced blocks: left
  subtree and right subtree,
- and you repeat.

For `w=(())`, the corresponding full binary tree is the “left-nested chain”
shape: a root whose left child is itself a node, and whose right child is a
leaf.

If you like an ASCII picture, it’s this:

```
      •
     / \
    •   ()
   / \
  () ()
```

This is why the Catalan numbers appear: counting Dyck words is the same as
counting these full binary trees.

> **FACT** — The “tree” isn’t an extra structure you added. It’s the unique
> recursive decomposition of the balanced string itself. The string *already
> contains* the tree; the tree view just makes the recursion explicit.

### 2.3 The “pairs / S-expression” view

Now comes the move that is closest to your origin story.

You can read the same tree as an S-expression where the *only* constructor is
pairing. If you erase labels (no atoms), what remains is still a valid
expression: just parentheses.

But here’s the subtlety that makes the “unity of bijections” feel slippery at
first:

The Dyck word `w=(())` is *not* the same parenthesis string as the tree’s
S-expression serialization.

Under the standard Dyck→tree bijection (the one used in the repo), the tree for
`w=(())` serializes as:

```
((()())())
```

This longer string is “the same object” seen through the tree/pairs coordinate
system:

- in the **Dyck/walk** coordinate system, parentheses are *time steps* (`(` = up,
  `)` = down),
- in the **pairs/S-expr** coordinate system, parentheses are *structure* (`()` =
  a leaf, and `(LR)` = a node whose children are `L` and `R`).

Even so, the same “stack depth” intuition survives: if you scan *either*
parenthesis string from left to right, you can compute a prefix depth. It just
means slightly different things depending on which coordinate system you’re in.

So a safer way to say it is:

> **FACT** — There are *two* relevant “heights” you can compute:
> (i) the Dyck walk height (opens minus closes, treating each parenthesis as a
> time step), and (ii) the parse depth / nesting depth of the underlying tree.
> They are related because they come from the same structure, but they are not
> literally the same sequence on the page.

This is the unity you’ve been feeling: it’s not that we glued geometry onto
computation. It’s that the *same combinatorial object* has multiple natural
projections:

- the walk projection makes time-like structure visible,
- the tree projection makes locality and substructure visible,
- the S-expression projection makes “program-ness” visible.

---

## 3. Return as “obligation”, and why height really does behave like potential

Let’s say “obligation” carefully.

When you read a Dyck word as a history, each `(` is an opening of something that
must eventually be closed. Until it closes, it is unresolved. It is “in the
air”. It is a commitment that has been made but not discharged.

At a given scan step, the height is the number of unresolved opens.

So if you want a scalar that says “how much unresolved structure exists *right
now*”, the height is the first thing you can write down.

> **MODEL CHOICE** — Interpret Dyck height `h` as “structural potential”: the
> amount of unresolved structure currently present.

Now take the next step:

If height is instantaneous unresolved-ness, then the simplest “total unresolved
work over a whole history” is to add it up over time:

```
A(w) = (height at step 1) + (height at step 2) + ... + (height at last step)
```

That is Dyck area. In the arXiv draft it’s introduced as a convenient additive
functional. In your own language it is:

> **INTERPRETATION** — Area is “how long obligations stayed open, summed over
> all obligations”.

Here’s the key “same accounting” fact in plain terms:

- You can “charge” an obligation continuously while it remains open (height per
  tick).
- Or you can wait until the obligation closes and then charge its whole
  lifetime all at once.

Those are the same total bill.

> **FACT** — The sum of heights over time equals the sum over matched pairs of
> their open-duration. This is just double-counting: each open pair contributes
> `+1` to height at each tick until it closes.

This is important because it gives you a reason why “area” is not a random
choice: it’s what you get if you accept “unresolved structure is the primitive
thing” and then ask for the simplest extensive (additive) global tally.

---

## 4. What a “dot on the screen” is, combinatorially

You asked a very direct question: a dot on the screen has a position in
spacetime. What is that, from the lattice’s point of view? How do we compute
it?

In this framework there are two layers:

1. the underlying history space (the Catalan substrate),
2. a chosen *observation map* from that space to whatever we call “outcomes”.

The arXiv draft names this map `f`. Here’s the intuition without symbols.

### 4.1 The lattice is bigger than the picture you draw

When we draw the Dyck cone as a picture with axes, we are projecting a very rich
object down to two coordinates:

- step index (“time along the growth”), and
- height (“how many opens are live”).

But many different prefixes share the same `(time, height)`.
They differ in *how* they got there: the internal arrangement of nested opens
and closes.

So the right mental model is:

> **FACT** — The cone diagram is a *shadow*. Each point `(k,h)` in the diagram
> represents a whole finite set of distinct Catalan prefixes whose height is
> `h` after `k` steps.

In physics terms: the plotted cone is a coarse coordinate chart; it forgets
internal degrees of freedom.

### 4.1.1 A small but important clarification: there’s more than one “cone picture”

You’ve been carrying (at least) two geometric pictures at once, and it’s worth
making them explicit so they stop competing in your head.

1. **The within-history cone (prefix time vs Dyck height).**
   This is the `(k,h)` picture in this section: as a history grows step by step,
   the height changes by `±1` and stays nonnegative. This is the picture that
   naturally supports “screen plane at time `k`”.

2. **The across-histories cone (tier vs breadth statistic).**
   This is the `(n,r)` picture in the arXiv paper: once a full history is
   complete (tier `n`), you can summarize its *shape* by a single breadth number
   `r(w)` (for example: the maximum number of pairs at a common nesting depth).

They are both honest, but they are not the same axis labels.

> **FACT** — `(k,h)` is a coordinate system on *prefixes of a single history*.
> `(n,r)` is a coordinate system on *the set of completed histories*, where `r`
> is a global summary of the whole shape.

The reason they still feel like “the same light cone” is that they both express
the same underlying constraint: local growth can only change the relevant
coordinate by one unit per step, so there is a speed limit.

> **INTERPRETATION** — If you want an Einstein-like analogy, the speed limit is
> the only truly rigid thing in the picture: “you can only change one unit of
> open structure per tick”. The cone is just the envelope that constraint
> enforces.

### 4.2 An “event” is an observation of a coarse feature of a prefix

In this framework, “an event happened” means: you chose a time slice, and you
asked a question about the structure on that slice.

The important shift is that we are not forced to identify “a physical event” with
“the entire Dyck word”. A completed Dyck word is a whole *closed* history. But an
experiment (like double-slit) has moments inside it: emission, passing an
aperture, arriving at a screen, being recorded.

Those are naturally modeled by *prefixes* of a Dyck history.

A prefix is just the beginning of the parenthesis string before it has fully
returned.

So, to talk about a dot on a screen, you do something like:

1. pick a slice time (a prefix length) that represents “the screen plane”, and
2. define a rule that maps the prefix on that slice to a “screen coordinate”.

That mapping is what the paper calls an “observable”. Here’s what that means in
model-language:

> **FACT** — An “observable” is just a function that throws away detail. It
> takes a complicated Catalan object (a history, or a prefix) and returns a
> simpler label like “left vs right”, or “screen pixel 17”, or “height = 5”.

### 4.3 The simplest “screen coordinate” you can read off the lattice

If we stay in 1+1 dimensions (which is where the Dyck walk picture lives), the
most direct “position-like” coordinate is the height itself.

At a fixed slice time `k`, the height is a nonnegative integer `h`.

So a toy “screen” is:

- the plane `k = k_screen` (a fixed step/time),
- with pixels labeled by `h = 0,1,2,...`.

In this picture, a dot on the screen at pixel `h` means:

> **MODEL CHOICE** — “Position on the screen” is the height of the history at
> the observation slice.

Is that *the* physical position? Not necessarily. It is the cleanest internal
coordinate the lattice gives you for free. If later you want a different
mapping—something that uses breadth, leaf index, or a richer embedding—you can
replace the observable. The mechanism stays the same.

### 4.4 How the dot distribution is computed (combinatorially, not metaphorically)

Now we can say what the “probability distribution on the wall” is in Catalan
terms.

You do not predict a dot by picking a single history. You predict it by
aggregating over *all histories consistent with what you didn’t observe*.

Here is the minimal recipe:

1. Decide what you count as “the same outcome” (i.e. define your observable).
2. For each possible outcome label, sum the complex contributions of all
   histories that map to it.
3. Turn the resulting complex number into a nonnegative weight (square
   magnitude).

If you want this in one sentence:

> **FACT** — An *amplitude* is just a complex accumulator attached to an outcome
> label. A *probability* is proportional to the squared magnitude `|amplitude|^2`
> after you normalize across all outcomes.

This is the part that quantum mechanics forces on you: adding alternatives
*before* squaring is where interference lives.

> **FACT** — If you add first and square later, you get cross-terms:
> `|A+B|^2 = |A|^2 + |B|^2 + 2 Re(A·conj(B))`. Those cross-terms are literally
> “interference”.

In the Catalan engine, the “alternatives” are just different admissible
prefixes/histories that your observable refuses to distinguish.

And the computation is genuinely combinatorial: it’s a recursion on a lattice.

You can picture it as a dynamic programming table:

- time index `k` goes left-to-right,
- height `h` goes up-and-down,
- each step moves from `(k,h)` to `(k+1,h±1)` (with the nonnegativity constraint),
- and you carry a complex amplitude at each reachable `(k,h)`.

If you like “how exactly is it computed?” in almost-code, it’s this kind of
update:

```
amp[0][0] = 1
for each time k:
  for each height h:
    amp[k+1][h+1] += stepWeight(k,h, up)   * amp[k][h]
    if h > 0:
      amp[k+1][h-1] += stepWeight(k,h, down) * amp[k][h]
```

Where `stepWeight` is where you put your model choice:

- if you want “pure counting”, the weights are all `1`,
- if you want an area-phase, you multiply by something like `exp(i * α * h)` at
  each step (because height is the instantaneous unresolved-structure level).

The arXiv paper calls this a transfer recursion / transfer matrix. In plain
language:

> **FACT** — “Sum over all histories” doesn’t mean you literally enumerate them
> one by one. Because each history is built from local steps, you can propagate
> the total amplitude forward one step at a time by summing contributions from
> the two possible predecessor states.

So the “dot distribution at the screen” is computed by taking the amplitude
table at time `k_screen` and reading off the squared magnitudes at each height.

### 4.5 What “two slits” means in this language

In the usual double-slit story, the difference between “both slits open” and
“one slit blocked” is not mystical. It is literally a change in which histories
are allowed to contribute.

In Catalan terms, you implement a slit by imposing a constraint at an
intermediate slice time `k_slit`.

For example: you might say “only histories that have height `h=2` at `k_slit`
are allowed through slit L” and “only those with height `h=4` at `k_slit` are
allowed through slit R”.

Then:

- with **both slits open**, histories through L and histories through R both
  contribute, and their amplitudes add at the screen;
- with **one slit blocked**, one family of histories is removed, so the sum
  changes and interference disappears.

> **FACT** — Interference is not “many realities doing computation”. It is a
> property of *how you aggregate indistinguishable alternatives*. If you remove
> a whole family of alternatives (block a slit), or if you label them so they
> become distinguishable (which-path information), the cross-term vanishes.

This is the sense in which “the possibility space is real” can be said without
overclaiming: the *statistics* force you to treat unobserved alternatives as
contributing coherently.

### 4.6 Scouting mission: what “space” could mean in the Catalan engine

At this point you’ve felt the core tension: we have a very sharp causal growth
law, and a very suggestive cone picture, but “what is the spatial coordinate?”
still feels underdetermined.

The cleanest way I know to unstick this is to separate three roles that are
easy to blur because they all sound like “geometry”:

> **FACT** — There are three different things:
> 1. the **state/history space** (what the system is made of),
> 2. the **outcome/coordinate** you *read out* (what an apparatus reports),
> 3. the **locality notion** (which states count as “neighbors” for dynamics).

The Catalan substrate fixes (1) very tightly, and gives you a strong causal
structure in (time, prefix) order. But (2) and (3) are where the model still has
degrees of freedom.

Here are the main choices you’ve been orbiting, with the “what do you buy, what
do you pay” summary for each.

#### Option A: “screen coordinate” = height at a slice (the minimal toy space)

This is what we did above: pick `k_screen` and set `x := H(k_screen)`.

> **FACT** — Height is not a unique address on the slice. It’s a projection.
> Many different prefixes at time `k` share the same height `h`.

That non-uniqueness is not a problem: it’s exactly how coarse measurement works.
All the distinct micro-histories that land in the same height bin contribute to
the same “pixel”, and that’s where coherent addition (and interference) lives.

This choice is extremely pair-local and computationally clean because the
transfer recursion closes on `(k,h)` alone.

#### Option B: “space” = breadth `r(w)` (the chain–star cone coordinate)

Breadth `r(w)` is a beautiful global statistic, and it really does interpolate
between “everything nested” and “everything separated”.

But:

> **FACT** — `r(w)` is a property of a *completed* history. It summarizes a whole
> episode; it is not “where the particle is” at some intermediate time.

So `r` is great as an across-histories chart `(n,r)` and as a way to talk about
depth–breadth tradeoffs. It is much less natural as a literal detector
coordinate, unless you intend the apparatus to measure a global “max width”
feature of the entire run.

#### Option C: “space” = focus/address (your “measurement chooses a focus” instinct)

If you want slit separation to be a literal integer distance, this is the most
direct route:

- Treat a state not just as “a Dyck prefix exists”, but as “a Dyck-derived tree
  exists *with a distinguished active pair* (a focus)”.
- Call “position” the address of that focused pair (an `L/R` bitstring from the
  root, or a left-to-right index along the frontier at the chosen slice).

> **MODEL CHOICE** — This introduces extra structure (a focus and a rule for how
> it moves), but in exchange you get an honest coordinate that can distinguish
> two slits and measure their separation as a graph distance.

This is also where refocusing/rotations belong naturally: they are position-like
motions at fixed size.

#### Option D: “space” = within-tier adjacency (Tamari / Dyck / alt-Tamari)

If you want a Laplacian/Hamiltonian acting on the tier Hilbert space `ℓ²(D_n)`,
you need a notion of “neighboring states on the tier”.

> **MODEL CHOICE** — Pick an adjacency graph on `D_n`. Tamari rotations are the
> canonical pair-local move (local rebracketing). Dyck/alt-Tamari give other
> tier-local adjacencies.

This gives you a principled locality and a canonical-looking Laplacian once the
adjacency is fixed. But it’s “space of shapes/programs” unless you also supply
an observation map that tells you what a lab detector reads off from a shape.

#### A warning about “lex order” and the rim shift idea

It’s tempting to take an enumeration (lex, or “radial then lex”) and treat the
index as a coordinate, then define a shift `S|j⟩=|j+1⟩` and a Laplacian on that
cycle.

> **FACT** — That construction makes a perfectly good operator, but it is
> locality on a *labeling*, not locality forced by pairs. Different enumerations
> give different “cycle geometries”.

So lex is great for *printing* and for stable indexing, but it’s not the same as
a pair-local neighbor relation like Tamari rotation.

#### What “overlap of paths” means, precisely

One last knot to untie, since it shows up in your “focus at the slit” picture:

> **FACT** — Two distinct prefixes at the same slice time label disjoint sets of
> full histories. A completed history can’t have two different prefixes of the
> same length.

So the “recombination” required for interference is not an overlap of history
sets. It is overlap after *forgetting*: both source-families can feed the same
later outcome label because the observation map discards which-source
information.

> **OPEN** — The big outstanding physical identification is: which option (or
> mixture) corresponds to “space in the lab”? The paper can show that several
> choices produce coherent interference mechanisms; it does not yet derive the
> unique one nature uses.

---

## 5. Relativity: cones, frames, and the symmetries you actually have

You’re right to feel that the relativistic piece is missing from the intuition
draft so far.

The arXiv paper uses “light cone” language, but in a careful way: as a mnemonic
for a *constraint*, not as a claim of exact Lorentz symmetry on the Dyck lattice.

This section is the place to make that feel natural rather than evasive.

### 5.1 The one rigid ingredient: a speed limit

Einstein’s move (in one sentence) was: treat the observed speed of light as a
hard constraint that all observers agree on, and then rebuild the geometry
around that.

In the Catalan engine, the “speed of light” analogue is almost embarrassingly
simple.

In the within-history `(t,x)` picture:

- `t` is the step index (one tick per parenthesis),
- `x` is the current height (how many opens are unresolved),
- every tick changes `x` by `±1`,
- and you are never allowed to go below `0`.

So there is a built-in maximum slope. You cannot change the position-like
coordinate faster than one unit per tick.

> **FACT** — The cone here is an envelope enforced by an allowed-moves rule.
> It is not “derived from a metric” the way the Minkowski light cone is; it is
> derived from “what steps are permitted”.

### 5.2 The symmetry you already *do* have: causal order survives, serialization does not

In special relativity (SR), different observers can disagree about the time
order of two spacelike-separated events, but they cannot disagree about what is
causally possible.

In the Catalan engine, the clean analogue is the difference between:

- a **causal partial order** (“this must happen before that”), and
- a **serialization** (a particular step-by-step ordering you chose when you
  simulated or evaluated).

Your commutation lemma is the key fact:

> **FACT** — Two disjoint local reductions commute. If neither reduction depends
> on the other (they touch disjoint subtrees), then swapping their order does
> not change the final tree.

That’s a real symmetry: you can quotient by it. It’s the same move as “different
linear extensions represent the same partial order”.

> **INTERPRETATION** — “A choice of evaluation order” is like “a choice of
> reference frame”: it is a way of listing events that are not causally forced
> into a unique global order.

This is also where your intuition about “instantaneous collapse of
probabilities” can get untangled: re-ordering independent computation steps is
not the same thing as projection/conditioning. One is a symmetry of description;
the other is a genuine information update that changes which alternatives remain
indistinguishable.

### 5.3 Null coordinates: the cleanest bridge between Dyck and Minkowski pictures

Let’s keep the same 1+1 “spacetime diagram” view:

- `t` = step index,
- `x` = height.

Allowed moves are:

- `(t,x) → (t+1, x+1)` (open),
- `(t,x) → (t+1, x-1)` (close, if `x>0`).

Now define the **null coordinates**:

```
u = t + x
v = t - x
```

In SR, these coordinates run along the light-cone directions.
In the Dyck walk, something even more concrete happens:

- an upstep increases `u` by `2` and leaves `v` unchanged,
- a downstep increases `v` by `2` and leaves `u` unchanged.

So `u/2` is literally “how many opens have occurred so far” and `v/2` is
literally “how many closes have occurred so far”.

> **FACT** — In this model, null coordinates are not abstract geometry. They
> are just “open-count” and “close-count”.

### 5.4 What Lorentz symmetry would mean here (and why it isn’t automatic)

In SR, a Lorentz transformation is a change of coordinates between inertial
frames that preserves the interval (equivalently: preserves the light cones).

Before the formulas, it helps to name the idea they’re expressing.

> **FACT** — A *frame* (in SR) is just a coordinate system used by an observer
> moving at constant velocity. A *boost* is the coordinate change between two
> such frames when one observer is moving relative to the other along the
> “space” direction. Boost symmetry is the statement that the laws don’t care
> which inertial frame you use: you can rewrite them in primed coordinates and
> they keep the same form.

Where do the equations come from? In 1+1 dimensions you can get them from two
simple requirements (in units where `c=1`):

1. **Straight lines stay straight.** If you want “constant-velocity motion” to
   look constant-velocity in every inertial frame, the transformation should be
   linear (no weird bending of worldlines).
2. **Light rays stay light rays.** The lines `x = ±t` (the cone boundaries) must
   map to lines of the same slope in the new coordinates.

A quick derivation uses the null coordinates `u=t+x`, `v=t-x`. The two cone
boundaries are exactly the lines `u=0` and `v=0`. A linear transformation that
preserves those null lines must have the form

```
u' = a u
v' = b v
```

for some positive constants `a,b` (positive so you don’t flip time orientation).
The interval is `t^2 - x^2 = u v`, so preserving it requires

```
u'v' = uv  ⇒  ab = 1  ⇒  b = 1/a.
```

It’s convenient to write `a = e^{η}` (because composing boosts multiplies the
scales, so the parameter `η` adds). This `η` is called the **rapidity**. With
that convention, boosts look especially simple in null coordinates: they are
just rescalings,

```
u' = e^{η} u
v' = e^{-η} v
```

which preserve the product `u v` (another way to write `t^2 - x^2`).

If you convert back to `(t,x)` using `t=(u+v)/2`, `x=(u-v)/2`, you get the
“hyperbolic rotation” form

```
t' = cosh(η) t + sinh(η) x
x' = sinh(η) t + cosh(η) x
```

where `cosh` and `sinh` are the functions that satisfy `cosh^2(η) - sinh^2(η) = 1`
(the Lorentz analogue of `cos^2 + sin^2 = 1` for ordinary rotations).

If you prefer an ordinary velocity parameter `β` with `|β|<1`, set

```
β = tanh(η),   γ = cosh(η) = 1 / sqrt(1-β^2),
```

and the same transformation can be written in the more familiar `γ` form (up to
sign conventions about which direction is “positive x”):

```
t' = γ (t ± β x)
x' = γ (x ± β t)
```

Now the crucial point:

Our Dyck lattice is discrete, has a boundary (`x≥0`), and often includes a
return condition (`x` returns to `0` at the end of a history).

So even though the **cone picture** is real, the full **Lorentz symmetry group**
is not sitting there waiting to be used. Most boosts would send lattice points
to non-lattice points, and the boundary condition breaks homogeneity.

> **FACT** — “Having a cone” does not imply “having Lorentz invariance”.
> The cone can be a property of constraints without being a property of an
> invariant metric.

So what do you get, honestly?

- an exact causal structure (a partial order),
- an exact gauge freedom to reorder independent events,
- Lorentz-flavored coordinates (like `u,v`) that let you *read* the same history
  in a different way,
- but not a theorem saying “all inertial frames are equivalent” in the strong
  SR sense.

> **OPEN** — If we want genuine Lorentz invariance to emerge, we need an
> additional ingredient: either a different large-scale limit, or a different
> dynamics on the lattice whose dominant behavior is invariant under a
> Lorentz-like group. The Brownian/diffusion scaling in the current paper is
> nonrelativistic.

### 5.5 When “I can’t choose” is a hint that you’ve found a symmetry

Your instinct here is excellent: sometimes “I don’t know which version is
right” is your mind noticing that the difference is not physical.

A practical rule of thumb:

> **FACT** — If two descriptions lead to the same predictions for every
> observable you’ve defined, then the difference between them is a symmetry (or
> gauge freedom). If they lead to different predictions, then you have a real
> model choice that must be fixed by principle or by observation.

Examples you already have:

- “phase accrues continuously while open” vs “phase is paid at closure” is (for
  the area functional) the **same accounting**, hence a symmetry of description.
- “evaluate left independent subtree first” vs “evaluate right independent
  subtree first” is (when they are truly independent) a commutation symmetry.
- “Dyck vs tree vs pairs” is a bijection: a pure translation.

But:

- “area phase” vs “some other phase functional” is a different model.
- “counting measure” vs “coherent phase sum” is a different model.
- “one-history selection dynamics exists” vs “only the measure on histories is
  fundamental” is a different model.

That’s the line between “equally valid symmetry” and “a fork in theory space”.

### 5.6 Chronons, proper time, and time dilation (as a model choice)

Now we can talk about the “chronon budget” picture you’ve carried for a long
time, but in a way that doesn’t pretend we’ve already derived relativity.

First, we need one new word.

> **MODEL CHOICE** — A *chronon* is one unit of update budget. It is the
> smallest indivisible “tick” in which the engine can do a bounded amount of
> local work.

The budget can be spent in two qualitatively different ways:

1. **Motion / rearrangement.** You move the focus (the “place you are acting”)
   to a neighboring location in the tree, or you perform a local rotation that
   changes how a subtree is bracketed without changing its “content”. Think:
   shifting attention, changing parentheses, re-associating application.

2. **Return / collapse.** You actually discharge an obligation—one of the
   irreversible “return” events that reduces unresolved structure (in whatever
   collapse rule you have in mind).

It’s worth separating three ideas that can get conflated because they’re all
“ways of walking through the Catalan set”:

> **FACT** — A listing order (like lexicographic order on Dyck words) is just a
> bookkeeping choice. A rotation relation (Tamari) is a local *rebracketing*
> move at fixed size. A growth relation (prefix extension / returns) changes
> size by adding or discharging obligations.

The computational S-expr bijection does not force one ordering over another. It
identifies the objects. The moment you define “space = adjacency”, though, you
must decide which adjacency you mean.

> **MODEL CHOICE** — When you build “dynamics on a tier” (a Laplacian, a
> Schrödinger operator, a diffusion process on fixed `n`), you have to pick an
> adjacency graph. Tamari rotations are a natural pair-local choice because
> they are literally local rewrites; lex order is not an adjacency.

Here’s a tiny concrete example of refocusing vs return, using the simplest
nontrivial tier (`n=2` internal nodes, i.e. 3 leaves).

Take three items `a,b,c` and think of pairing as “application”:

```
((a b) c)   ↔   (a (b c))
```

Those are the two Catalan shapes at this size. In the unlabeled-tree encoding
used elsewhere in this repo, they render as:

```
((()())())    ↔    (()(()()))
```

Moving from the left bracketing to the right bracketing is a **refocus /
rotation**: it doesn’t create or destroy any pairs; it just changes *which pair
is “inside” which other pair*. (That’s the Tamari/associahedron move.)

By contrast, a **return / collapse** actually removes unresolved structure. In
the evaluator rule you started from, the primitive return is:

```
(() x)  →  x
```

That’s a different kind of event: it reduces “how much pairing structure is
still present”. In the walk picture it’s a downstep; in the S-expr picture it’s
an applicative discharge.

In this picture, “space” is not a pre-existing stage. “Space” is the adjacency
graph of places the focus could be, i.e. how far (in edges) you are from where
you were.

So the most basic locality constraint you can impose is:

> **MODEL CHOICE** — In one chronon, the focus can move by at most one edge.

This immediately implies a speed limit:

> **FACT** — If `Δt` is the number of chronons elapsed and `Δx` is the number of
> edges of net focus drift, then `|Δx| ≤ Δt`. No matter what else the model is,
> you cannot “propagate influence” faster than one edge per tick.

So far, this is just the same cone constraint again, now stated in “focus space”.

#### Proper time as “how many real returns happened”

In relativity, *proper time* is the time measured by a clock riding along with a
process. A moving clock accumulates less proper time between two coordinate-time
events than a stationary one.

In the Catalan engine, the most natural internal clock you’ve pointed at is:

> **MODEL CHOICE** — Define proper time `τ` to be proportional to the number of
> irreversible return/collapse events experienced along a process.

This fits your intuition: return is the fundamental “it happened” move. It’s
the irreversible act of discharging an obligation.

Now the time-dilation story becomes a budget tradeoff:

- If you spend chronons moving the focus around, you have fewer chronons left to
  spend on collapse/return.
- So a fast-moving process accumulates fewer collapse events “per unit of
  external time”.

> **INTERPRETATION** — Proper time is “how much actual irreversible work got
> done”, not “how many coordinate ticks elapsed”. Motion burns budget that could
> have gone into returns, so motion dilates proper time.

You can make this concrete in two ways:

1. **A literal discrete budget accounting.**
   If each chronon must be spent either moving or collapsing (one or the other),
   then
   - `Δt` = number of chronons,
   - `Δx` ≈ number of moves (in the fastest case),
   - `Δτ` = number of collapses,
   so `Δτ` is approximately “whatever is left over” after motion:
   `Δτ ≈ Δt - (#moves)`.
   This already has the right qualitative shape: at rest, you “age” fastest; at
   the speed limit, you do no collapse work.

2. **A Lorentz-flavored scalar (if you want boosts).**
   If you want a single number built from `(Δt,Δx)` that matches the familiar SR
   form in a continuum limit, you can *choose* the Minkowski-style combination:
   `Δτ := sqrt(Δt^2 - Δx^2)`.
   This is exactly the quantity that stays fixed under the continuous Lorentz
   boost rescalings `u' = e^{η}u`, `v' = e^{-η}v` (where `u=t+x`, `v=t-x`).

   > **MODEL CHOICE** — Use `Δτ = sqrt(Δt^2 - Δx^2)` as the proper-time
   > functional. This does not follow from the Dyck constraint alone; it is the
   > simplest bridge to the Lorentz-symmetric continuum story.

   > **FACT** — In null coordinates, this is `Δτ = sqrt(Δu Δv)`. In the Dyck walk,
   > `Δu/2` and `Δv/2` are just open-count and close-count, so `sqrt(ΔuΔv)` is the
   > geometric mean of those two counts (scaled). That’s a striking way the “SR
   > algebra” echoes your open/return bookkeeping.

#### Where the symmetry question lands

This is exactly the kind of place where your “maybe I can’t choose because it’s
really a symmetry” instinct can guide you:

- The **speed limit** `|Δx|≤Δt` is forced by locality. That part is not a choice.
- The **definition of proper time** is a modeling move: you decide what the
  clock reads (collapse count, or a quadratic form, or something else).

> **OPEN** — If nature really behaves like this, the “right” proper-time
> functional should not just be aesthetically Lorentz-like; it should be forced
> by a deeper invariance or by comparison with observation. Right now, in the
> Catalan engine, Lorentz invariance is an aspiration for an emergent limit, not
> an established symmetry of the discrete substrate.

---

## 6. Why phase belongs to “return” and “obligation” (in the simplest model)

At this point, we’ve described the mechanism of interference but not the source
of phase. Where do those complex factors come from?

The paper’s clean answer is: we choose a phase functional that is computed
pair-locally along growth.

In your own terms: if the only primitive thing is “open obligations” and “close
obligations”, then the most primitive “running cost” is: how many obligations
are open at each step.

That is height.

And the simplest extensive total cost is: sum of height over time.

That is area.

> **MODEL CHOICE** — Assign each history a complex weight of the form
> `exp(i * (scale) * area)`. The scale is a parameter (later: a physical
> calibration target).

Why is this not arbitrary? Because it’s the first nontrivial additive functional
you can build without smuggling in extra state.

> **FACT** — If you demand (i) additivity under concatenation, and (ii)
> computability from bounded local growth data, then your phase must be a sum
> of per-step increments. “Area” is the special case where the increment is
> exactly the current height.

And now your earlier “both” instinct becomes crisp:

- “phase accrues while obligations are open” is the per-step height view,
- “phase accrues at returns” is the per-pair lifetime view,
- they agree because they are literally two bookkeepings of the same sum.

So you don’t have to choose between them at this level. The model chooses a
quantity; you can tell two different stories about how it is paid.

> **INTERPRETATION** — If you want to hear physics in it, area is “how much
> unresolved structure was ‘in circulation’ over the course of the history”.
> That is exactly the kind of thing an action-like phase would naturally depend
> on: not just where you ended, but how you got there.

> **OPEN** — This still doesn’t derive *why* nature uses complex phase rather
> than a real weight, or why area is the unique right functional. What it does
> give is the simplest pair-local candidate that reproduces the *mechanism* of
> interference.

---

## 7. Where computation lives (and why unlabeled S-expressions are not a sideshow)

Your `\iffalse` appendix block is pointing at something deep:

The Catalan substrate is not just “a geometry”. It is also “the set of all
program *shapes*”, once you decide that a program is built by repeated binary
application.

McCarthy’s Lisp idea was: the primitive data constructor is `cons`, and the rest
of language is built on top.

Your move is: push even harder—erase atoms entirely and ask what remains if the
only thing you can do is build pairs.

What remains is a universe of unlabeled S-expressions: pure parentheses.

And those pure parentheses already carry:

- a notion of context (nesting depth),
- a notion of completion (return to zero),
- and a notion of local rewrite (replace a subtree with another subtree).

So it becomes reasonable to treat “computation” as something that happens *inside
the Catalan family*, not something you bolt on.

> **FACT** — In `src/graph/evaluator.js` and `src/graph/sk-legacy.js`, the core
> structural rewrite `(() x) → x` is implemented as a deterministic reduction
> rule. With binder/slot re-entry (De Bruijn references), this supports SKI and
> lambda-like computation without relying on atom inspection.

Here’s a clean way to keep the roles straight:

- **Dyck return** is the closure law that makes histories “complete”.
- **η-collapse** `(() x)→x` is a *quotient rule* that removes neutral wrappers
  (vacuum bubbles) without changing the carried structure.
- **Re-entry** is what lets a pure tree behave like a program with binding and
  self-reference.

If you put those together, you get your “self-interpreting, self-reflective
structure of pure associations” as a concrete research direction, not a mood.

> **INTERPRETATION** — In the computation view, “focus” (car / left spine) is
> the place where structure is assimilated: where an operator meets an operand,
> where a binder receives an argument, where a reduction actually fires. That
> does rhyme with attention. It’s a powerful analogy—but it belongs in the
> interpretation layer, not in the arXiv claims.

### 7.1 Gödel numbering, but for shapes

Gödel’s move was: treat “a formula” as “a number” by choosing an encoding. The
details don’t matter here; what matters is the viewpoint:

Syntax can be made into arithmetic.

Your viewpoint is adjacent, but structural:

Programs can be made into *trees*, and trees can be made into *parenthesis
strings*, and parenthesis strings can be made into *numbers*.

So the “set of all possible programs” becomes something you can literally point
to: it’s an enumerable set of finite objects.

> **FACT** — Once you choose a finite encoding of labels, every finite program
> is representable as a finite labeled tree. Forgetting labels gives you a
> Catalan skeleton. This is the sense in which Catalan structure is a “program
> frame”.

> **INTERPRETATION** — The Catalan engine is a way of studying “the space of all
> programs” through a geometric lens: depth/breadth tradeoffs become geometric
> constraints; rewrite locality becomes causal structure; enumeration becomes
> entropy.

---

## 8. Attractors instead of “one true history”

You’ve said something I think is crucial: a “specific history” doesn’t exist any
more than a concept does. Instead, we have local attractors.

Here is a crisp way to say that in model terms.

There are (at least) two distinct objects:

1. **The substrate**: the full space of admissible Catalan histories/prefixes.
2. **A rule or measure** on that space: a way of assigning weights, phases, or
   transition probabilities.

Once you have a rule/measure, you can talk about:

- which structures are common vs rare,
- which motifs recur,
- which patterns are stable under dynamics,
- which bundles of histories add coherently (stationary-phase–like clusters),
- which regions behave like basins (attractors).

That’s already a very “concept-like” ontology: what is real is the stable
pattern, not a single micro-history.

> **INTERPRETATION** — A “particle” or a “concept” is not one tree; it’s a
> stable motif class: something that keeps reappearing as you evolve, compress,
> or coarse-grain the structure.

> **FACT** — The repo already has an experimental version of this idea:
> `src/catalan/motif-discover.js` runs stochastic local reductions and logs
> recurrent end-shapes (“motifs”). This is not a theory of mind, but it *is* a
> concrete attractor-finding experiment on the Catalan substrate.

> **OPEN** — To turn “attractors” into a tight theory, you need to specify the
> dynamics precisely (what expansions are allowed, what collapses are allowed,
> what weights/temperatures you use) and then prove or measure stability and
> universality properties (do the attractors persist under perturbations?).

---

## 9. Occam, Solomonoff, and “choose the simplest until observation demands more”

Occam’s razor is not a law of nature; it’s a strategy for surviving ignorance:
prefer the simplest explanation that fits what you’ve seen.

Solomonoff induction is one attempt to formalize that instinct: assign higher
prior weight to hypotheses that have shorter descriptions.

The Catalan engine flirts with that philosophy in a very literal way:

- a Catalan object is a short description of a nested structure,
- the whole space of such objects is enumerable,
- you can imagine weighting them by something like “description length” or
  “structural cost”.

> **INTERPRETATION** — If nature behaves like an optimizer under constraints, or
> like a universal prior over simple generative processes, then “start with the
> simplest pair-local substrate” is not just aesthetic; it is a plausible
> heuristic.

> **OPEN** — This is where we must not bluff. The paper can use Occam as
> motivation, but “nature follows Solomonoff” is not something we can claim
> without a sharp, testable consequence.

---

## 10. Energy, curvature, and the “only moves are expansion and return” thesis

Now we return to your deepest instinct:

If the only primitives are:

- expand (open new obligations / grow possibility),
- return (close obligations / discharge / collapse),

then whatever we call “energy” has to come from that circuit.

There is a disciplined way to say this that stays inside the model.

At any moment, the system has some amount of unresolved structure. Call it
potential if you like. In the walk picture, it is height. In the tree picture,
it is “how much is still nested and incomplete”. In the S-expression picture,
it is “how many frames are still open”.

Then:

- expansion injects potential (opens new obligations),
- return releases potential (closes obligations),
- the history’s total “cost” is the integral of potential over time (area).

> **INTERPRETATION** — The simplest energy story here is not “mass is stored in
> atoms”. It is “energy is stored in unresolved structure”.

Now curvature.

In ordinary physics language, curvature is a way of saying that “straight lines”
are not globally straight; local geometry biases paths.

In your lattice language, “curvature” could mean something like:

- the statistics are not uniform; they prefer some local transitions over others.

If a transition kernel makes some moves more likely than others, then the space
of histories is no longer “flat”: it has a built-in bias field.

> **MODEL CHOICE** — Choose a specific local rule (or weighting) that makes the
> growth non-uniform (e.g. weights depending on height or on local motifs). This
> induces a geometry in the sense that it changes which paths dominate.

> **OPEN** — Turning “bias” into “curvature” can be made mathematically precise
> (there are discrete curvature notions for Markov chains and graphs), but it
> is not automatic. We would need to pick the kernel and then *compute* the
> induced geometry, not just name it.

---

## 11. What you already have, and what it would mean to “tighten the picture”

Here’s the state of play in the simplest honest phrasing I can give:

> **FACT** — You have a canonical substrate (Catalan/Dyck) with a built-in cone
> constraint, multiple equivalent coordinate systems, and a working structural
> computation kernel (`(() x)→x` + re-entry).

> **MODEL CHOICE** — You can get interference by adding a pair-local additive
> phase functional (area is the simplest) and summing coherently over
> indistinguishable histories defined by an observation map.

> **OPEN** — The measurement problem (why one dot) is not solved by the above.
> But the interference pattern (the distribution) does not require solving it.

If the goal of this document is “make the solutions plain to you”, then the
next tightening questions are not many; they’re few and sharp:

1. **What is the observation map for a given physical experiment?**
   (What exactly is a “screen coordinate” in Catalan terms?)

2. **What principle selects the phase functional?**
   (Area is minimal; what would make it uniquely demanded rather than merely
   chosen?)

3. **What dynamics, if any, sits underneath the amplitude picture?**
   (Do we only ever talk about a measure on histories, or do we posit a
   selection/collapse dynamics in addition?)

4. **Where do attractors live, and what are they stable under?**
   (This is the bridge from “a space of programs” to “a space of concepts”.)

If you tell me which of these feels most like “the missing hinge” right now, I
can keep writing the next section in the same voice—but focused on that hinge.
