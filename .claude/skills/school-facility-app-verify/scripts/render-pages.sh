#!/usr/bin/env bash
# Usage: render-pages.sh OUTDIR FILE...   (each FILE is a .pdf or .docx)
# Prints the page count of each file and writes OUTDIR/<name>-<page>.png at 40 dpi.
# Needs soffice (LibreOffice) for .docx, plus pdfinfo and pdftoppm (poppler).
set -euo pipefail
out="$1"
shift
mkdir -p "$out"
for f in "$@"; do
  base="$(basename "${f%.*}")"
  pdf="$f"
  if [[ "$f" == *.docx ]]; then
    soffice --headless --convert-to pdf --outdir "$out" "$f" >/dev/null 2>&1
    pdf="$out/$base.pdf"
  fi
  echo "$base: $(pdfinfo "$pdf" | awk '/^Pages/{print $2}') pages"
  pdftoppm -r 40 -png "$pdf" "$out/$base"
done
ls "$out"
