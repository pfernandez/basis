# Catalan Explorations

Explorations of the Catalan lattice as a tree-like representation of possibility space.

## Collapse-Based SK Interpreter

The `src/sk.js` interpreter evaluates ordinary SK combinator expressions using
a single rewrite: drop every neutral wrapper of the form `(() x)` so the right
child survives. Binder/slot identity is rebuilt from the definitions in
`programs/sk-basis.lisp`, which are written with `defn` sugar and desugar into
pure De Bruijn indices during load.

### Running expressions

```
npm run sk -- '((K a) b)'
```

For an id/lookup-table view (with optional collapse tracing or Graphviz
snapshots) use `src/sk_lookup_table.js`:

```
npm run sk:lookup -- --trace-collapse '(((S a) b) c)'
```

### Tests

`npm test` runs `tests/sk.test.js`, which demonstrates that the collapse rule
alone reproduces the standard SK combinator laws (I, K, S, TRUE/FALSE, and
`defn` sugar) and exercises the gravity-trace option.
