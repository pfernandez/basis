#!/usr/bin/env bash
set -euo pipefail

docs_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$docs_dir"

build_dir="figures/_build"
svg_dir="figures/svg"
wrapper_tex="figures/_tools/standalone.tex"

mkdir -p "$build_dir"
mkdir -p "$svg_dir"

resolve_fig_path() {
  local spec="$1"
  local candidates=("$spec")

  if [[ "$spec" != *.tex ]]; then
    candidates+=("${spec}.tex")
  fi

  if [[ "$spec" != figures/* ]]; then
    candidates+=("figures/$spec")
    if [[ "$spec" != *.tex ]]; then
      candidates+=("figures/${spec}.tex")
    fi
  fi

  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if [[ $# -gt 1 ]]; then
  printf 'Usage: %s [figure]\n' "$0" >&2
  exit 2
fi

fig_paths=()
if [[ $# -eq 1 ]]; then
  fig_path="$(resolve_fig_path "$1")" || {
    printf 'Figure not found: %s\n' "$1" >&2
    exit 1
  }
  fig_paths=("$fig_path")
else
  fig_paths=(figures/*.tex)
fi

for fig_path in "${fig_paths[@]}"; do
  fig_name="$(basename "$fig_path" .tex)"

  latexmk -dvi -interaction=nonstopmode -halt-on-error \
    -outdir="$build_dir" \
    -jobname="$fig_name" \
    -pretex="\\def\\FigureFile{$fig_path}" \
    -usepretex \
    "$wrapper_tex"

  dvisvgm --no-fonts \
    --output="${svg_dir}/${fig_name}.svg" \
    "${build_dir}/${fig_name}.dvi"
done

printf 'Wrote SVGs to %s/\n' "$svg_dir"
