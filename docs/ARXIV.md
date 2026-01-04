# arXiv v1 submission notes

## Build

- Main paper: `latexmk -pdf -interaction=nonstopmode -halt-on-error catalan-light-cone.tex`
- (Optional) Standalone supplement: `latexmk -pdf -interaction=nonstopmode -halt-on-error catalan-light-cone-supplement.tex`

## Minimal upload set (current)

- `catalan-light-cone.tex`
- `catalan-light-cone-supplement-appendices.tex` (now `\input` by the main file)
- `supplemental-operators.tex` (now `\input` transitively)

## Notes

- The main paper now integrates the previous “companion supplement” as appendices via `\input{...}`.
- No `-shell-escape` features are used.

## Categories (suggested)

- Primary: `math.CO`
- Cross-lists: `math.PR`, `quant-ph` (if you want physics/foundations readers)
