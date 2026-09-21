#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(cd -- "$script_dir/.." && pwd)
archive="$root/dist/spotify-vim-navigation-0.1.0.zip"

node "$script_dir/validate.mjs"
command -v zip >/dev/null || {
  printf 'zip is required to build the release archive.\n' >&2
  exit 1
}
mkdir -p "$root/dist"
rm -f -- "$archive"

(
  cd "$root"
  zip -q "$archive" manifest.json content.js styles.css icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png
)

unzip -tq "$archive" >/dev/null
printf 'Created %s\n' "$archive"
