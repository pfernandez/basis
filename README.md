# Collapse-Based SK Interpreter

This project shows that the SK combinator calculus can be evaluated using only
the single collapse rule

```
(() x) ⇒ x.
```

Binders are represented explicitly as `(() body)` nodes, references are
De Bruijn indices (e.g. `#0`, `#1`), and application is just binary pairing.
`src/sk.js` rebuilds binder identity from `programs/sk-basis.lisp`, applies the
collapse rule until no wrappers remain, and reports both the collapsed tree and
its left-spine focus. No other primitive rewrite rules are used.

## Usage

### Install

```bash
npm install
```

### Run SK expressions

```bash
npm run sk -- '((K a) b)'
```

The interpreter reads `programs/sk-basis.lisp` (written with `defn` sugar that
is desugared into De Bruijn indices on load), evaluates each expression, and
prints the collapsed tree plus its focus. Add `--trace-collapse` to log every
collapse event while evaluating:

```bash
npm run sk -- --trace-collapse '(((S a) b) c)'
```

### Lookup-table / tracing mode

`src/sk_lookup_table.js` keeps the evaluation state as an explicit lookup table
of empty-node IDs. It exposes two tracing helpers:

```bash
# Log every collapse step along with the node path
npm run sk:lookup -- --trace-collapse '(((S a) b) c)'

# Additionally dump Graphviz DOT snapshots of each step
npm run sk:lookup -- --trace-graphviz=share --trace-graphviz-dir=traces '(((S a) b) c)'
```

Use the helper script to render DOT files to SVG or to build a simple HTML
player:

```bash
npm run sk:trace -- --html traces/
```

(See `scripts/render-graphviz-trace.js` for available flags such as
`--format=png` or `--interval=400`.)

### Tests

```bash
npm test
```

`tests/sk.test.js` proves that the collapse evaluator satisfies the standard SK
laws (`I`, `K`, `S`, booleans, `defn` sugar) and exercises the collapse-trace
logging.

### Church numeral examples

`programs/church.lisp` adds Church numerals along with `SUCC`, `PLUS`, `MULT`,
and a helper `PEANO` that renders a numeral as nested `SUCC` applications. For
instance:

```bash
# (2 + 3) = 5  ➜ five SUCC applications to ZERO
node src/sk.js --defs=programs/church.lisp EXAMPLE-SUM

# (3 × 3) = 9 ➜ nine SUCC applications to ZERO
node src/sk.js --defs=programs/church.lisp EXAMPLE-PRODUCT

# You can also run custom expressions, e.g. (4 × (2 + 3))
node src/sk.js --defs=programs/church.lisp "(PEANO ((MULT ((PLUS TWO) THREE)) FOUR))"
```

## Repository layout

```
programs/sk-basis.lisp     # SK, booleans, and helpers written with defn sugar
src/sk.js                  # slot/binder interpreter using the collapse rule
src/sk_lookup_table.js     # lookup-table variant with tracing hooks
scripts/render-graphviz-trace.js
                           # converts DOT traces into SVG/HTML slideshows
tests/sk.test.js           # unit tests for the collapse evaluator
```

## License

- **Code:** Apache License 2.0 (see `LICENSE.md`)
- **Documentation:** Creative Commons Attribution 4.0 (CC BY 4.0)
