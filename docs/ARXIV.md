# arXiv v1 submission notes

## Build

Main paper:
```bash
latexmk -pdf -interaction=nonstopmode -halt-on-error catalan-light-cone.tex
```
(Optional) Standalone supplement:

```bash
latexmk -pdf -interaction=nonstopmode \
  -halt-on-error catalan-light-cone-supplement.tex
```

## Figures (SVG export)

Export standalone SVGs to `figures/svg/` (requires `dvisvgm`):
```bash
bash figures/export-svg.sh
```

Export a single figure:
```bash
bash figures/export-svg.sh figures/clc-catalan-cone.tex
```

## Minimal upload set (current)

- `catalan-light-cone.tex`
- `catalan-light-cone-supplement-appendices.tex` (now `\input` by the main file)
- `supplemental-operators.tex` (now `\input` transitively)
- `figures/*.tex` (figure bodies, now `\input` by the TeX sources)

## Notes

- The main paper now integrates the previous “companion supplement” as
  appendices via `\input{...}`.
- No `-shell-escape` features are used.

## Categories (suggested)

- Primary: `math.CO`
- Cross-lists: `math.PR`, `quant-ph` (if you want physics/foundations readers)
