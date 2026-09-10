#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(cd -- "$script_dir/.." && pwd)
session=$(agent-browser session id --scope worktree --prefix spotify-vim-rc)
browser=(agent-browser --session "$session")

cleanup() {
  "${browser[@]}" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${browser[@]}" --init-script "$root/content.js" open "file://$script_dir/fixture.html" >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.ready === "true"' >/dev/null

"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'Boolean(document.querySelector("#spotify-vim-navigation-status")?.dataset.extensionVersion)' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Uno"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Dos"' >/dev/null

"${browser[@]}" eval 'window.replaceTracks()' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

# Exercise repeated open/close cycles. This catches stale pane state, orphaned
# menus, and the regression where DOM focus fell back to Your Library.
for _ in {1..3}; do
  "${browser[@]}" press a >/dev/null
  "${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
  "${browser[@]}" press Escape >/dev/null
  "${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
  "${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null
done

# A playlist query with no matches must still let Escape return navigation to
# the menu, and a second Escape must close the entire action stack.
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Nueva lista"' >/dev/null
"${browser[@]}" press / >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "searchbox"' >/dev/null
"${browser[@]}" keyboard type "Does not exist" >/dev/null
"${browser[@]}" wait --fn '[...document.querySelectorAll("[role=menuitem]")].filter((item) => /Focus Mix|Jazz/.test(item.textContent)).every((item) => item.hidden)' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Nueva lista"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

# Spotify can dismiss a portal because of an outside click. The next command
# must reconcile to main content instead of leaving navigation trapped in a
# now-nonexistent menu.
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" eval 'document.querySelectorAll("[role=menu]").forEach((menu) => menu.remove())' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Dos"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

# If Spotify ignores Escape, the extension falls back to the origin row's More
# button and restores only after the menu is actually gone.
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" eval 'document.body.dataset.ignoreMenuEscape = "true"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

# If both close mechanisms are temporarily ignored, keep menu ownership rather
# than leaking j/k back into the library or track list.
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" eval 'document.body.dataset.stubbornMenu = "true"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait 700 >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Añadir a una lista"' >/dev/null
"${browser[@]}" eval 'delete document.body.dataset.stubbornMenu' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
"${browser[@]}" eval 'delete document.body.dataset.ignoreMenuEscape' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Añadir a una lista"' >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Añadir a una lista"' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Nueva lista"' >/dev/null
"${browser[@]}" press / >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "searchbox"' >/dev/null
"${browser[@]}" keyboard type "Focus" >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menuitem][hidden]")?.textContent === "Jazz"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Nueva lista"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Focus Mix"' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.action === "focus"' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

"${browser[@]}" press h >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.textContent === "Biblioteca Uno"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.textContent === "Biblioteca Dos"' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "library-control"' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

"${browser[@]}" press / >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.dataset.testid === "search-input"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll(".spotify-vim-selected-play").length === 0' >/dev/null

"${browser[@]}" eval 'document.querySelector("#native-control").focus()' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll(".spotify-vim-selected-play").length === 0' >/dev/null

"${browser[@]}" eval 'document.activeElement.blur()' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll(".spotify-vim-selected-play").length === 0' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

"${browser[@]}" eval 'document.querySelector("#main-scroll").scrollTop = 700' >/dev/null
"${browser[@]}" press g >/dev/null
"${browser[@]}" press g >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#main-scroll").scrollTop === 0' >/dev/null

printf 'Spotify Vim Navigation browser smoke tests passed.\n'
