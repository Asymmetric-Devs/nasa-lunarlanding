#!/bin/sh
# Download the public LOLA files that tests/visibility.test.ts needs (about 220 MB) into data-raw/.
# usage: scripts/fetch_validation_data.sh [data-raw dir]
# Files already present are skipped; an interrupted download resumes.
set -eu
RAW="${1:-$(dirname "$0")/../data-raw}"
BASE="https://imbrium.mit.edu"
get() { # get <remote path> <local dir>
  mkdir -p "$RAW/$2"
  out="$RAW/$2/$(basename "$1")"
  if [ -s "$out" ] && [ ! -e "$out.part" ]; then echo "have  $out"; return; fi
  echo "fetch $1"
  curl -fL --retry 3 -C - -o "$out.part" "$BASE/$1"
  mv "$out.part" "$out"
}
for ext in LBL IMG; do
  get "DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.$ext" dem80s80
  get "EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608.$ext" illum85
  get "EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608_EARTH.$ext" illum85
done
echo "done: $RAW"
