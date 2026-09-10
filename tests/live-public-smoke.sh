#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(cd -- "$script_dir/.." && pwd)
session="svl-$$"
namespace="svl-$$"
browser=(agent-browser --namespace "$namespace" --session "$session")
playlist_url="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"

cleanup() {
  "${browser[@]}" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${browser[@]}" --init-script "$root/content.js" open "$playlist_url" >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("main [role=row]").length >= 2' >/dev/null

"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-label")?.startsWith("Play ")' >/dev/null
"${browser[@]}" press j >/dev/null
origin="$("${browser[@]}" eval 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-label")')"

"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent?.trim() === "Add to playlist"' >/dev/null

# k wraps from the first action to the last; j wraps back to the first.
"${browser[@]}" press k >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent?.trim() === "Open in Desktop app"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent?.trim() === "Add to playlist"' >/dev/null

"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length >= 2 && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent?.trim() === "New playlist"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-label")?.startsWith("Play ")' >/dev/null

restored="$("${browser[@]}" eval 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-label")')"
if [[ "$restored" != "$origin" ]]; then
  printf 'Selection was not restored: expected %s, got %s\n' "$origin" "$restored" >&2
  exit 1
fi

printf 'Spotify Vim Navigation live public smoke test passed.\n'
