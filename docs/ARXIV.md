# arXiv v1 submission notes

## Build

- Main paper: `latexmk -pdf -interaction=nonstopmode -halt-on-error catalan-light-cone.tex`
- Companion supplement (optional): `latexmk -pdf -interaction=nonstopmode -halt-on-error catalan-light-cone-supplement.tex`
  - Compile `catalan-light-cone.tex` first so `catalan-light-cone.aux` exists for cross-refs (`xr-hyper`).

## Minimal upload set (lean v1)

- `catalan-light-cone.tex`

The v1 TeX file is self-contained (no `\input{...}` or external figures).

## Recommended source bundle (so “companion supplement” references resolve)

- `catalan-light-cone.tex`
- `catalan-light-cone-supplement.tex`
- `catalan-light-cone-supplement-appendices.tex`
- `supplemental-operators.tex` (optional; currently not included by either PDF)

## Notes

- The main paper references a “companion supplement” for material intentionally omitted from the v1 PDF; including the supplement TeX in the arXiv source upload keeps that reference honest even if arXiv only compiles the main file.
- No `-shell-escape` features are used.
