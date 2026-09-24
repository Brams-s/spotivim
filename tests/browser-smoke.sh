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
"${browser[@]}" wait --fn 'document.querySelector("main [data-uri=\"spotify:track:uno\"]")?.classList.contains("spotify-vim-selected-context")' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("Press ? for shortcuts")' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Dos"' >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("main [data-uri=\"spotify:track:uno\"]")?.classList.contains("spotify-vim-selected-context")' >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("Press ? for shortcuts")' >/dev/null

"${browser[@]}" eval 'window.replaceTracks()' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null

# Exercise repeated open/close cycles. This catches stale pane state, orphaned
# menus, and the regression where DOM focus fell back to Your Library.
for _ in {1..3}; do
  "${browser[@]}" press a >/dev/null
  "${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
  "${browser[@]}" wait --fn 'document.activeElement.getAttribute("aria-activedescendant") === document.querySelector("[role=menu] .spotify-vim-selected-play")?.id && Boolean(document.querySelector("[role=menu] .spotify-vim-selected-play")?.id)' >/dev/null
  "${browser[@]}" press Escape >/dev/null
  "${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
  "${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null
done

# The help surface owns its keys, toggles without duplication, and restores
# the selected control when dismissed.
"${browser[@]}" eval 'window.fixtureSafety.armHelpHostHandlers()' >/dev/null
"${browser[@]}" eval 'document.body.dataset.statusBeforeHelp = document.querySelector("#spotify-vim-navigation-status")?.textContent || ""' >/dev/null
"${browser[@]}" set viewport 420 480 >/dev/null
"${browser[@]}" press '?' >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("#spotify-vim-navigation-help").length === 1 && document.querySelector("#spotify-vim-navigation-help [data-spotify-vim-help-close]") === document.activeElement' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#spotify-vim-navigation-status")?.textContent === document.body.dataset.statusBeforeHelp && document.querySelector("#spotify-vim-navigation-status")?.dataset.suppressed === "true" && !document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("j/k move")' >/dev/null
"${browser[@]}" eval 'document.querySelector("#spotify-vim-navigation-help").scrollTop = 0' >/dev/null
"${browser[@]}" press PageDown >/dev/null
"${browser[@]}" press ArrowDown >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#spotify-vim-navigation-help").scrollTop > 0 && !document.body.dataset.helpHostKeys' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro" && document.querySelector("#spotify-vim-navigation-help [data-spotify-vim-help-close]") === document.activeElement && !document.body.dataset.helpHostKeys' >/dev/null
"${browser[@]}" press Tab >/dev/null
"${browser[@]}" press Shift+Tab >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#spotify-vim-navigation-help") && document.querySelector(".spotify-vim-selected-play") === document.activeElement' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#spotify-vim-navigation-status")?.dataset.suppressed === "false" && document.querySelector("#spotify-vim-navigation-status")?.dataset.visible === "true"' >/dev/null
"${browser[@]}" press '?' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#spotify-vim-navigation-help")' >/dev/null
"${browser[@]}" press '?' >/dev/null
"${browser[@]}" press Space >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#spotify-vim-navigation-help")' >/dev/null
"${browser[@]}" press '?' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#spotify-vim-navigation-help") && !document.querySelector(".spotify-vim-selected-play") && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("disabled")' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" press '?' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.addExternalInput()' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-external-input" && !document.querySelector("#spotify-vim-navigation-help") && !document.querySelector(".spotify-vim-selected-play")' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" eval 'document.activeElement.blur()' >/dev/null
"${browser[@]}" set viewport 1280 800 >/dev/null

# Shift+A opens the now-playing widget's menu instead of the selected row's
# menu, and returns to the existing selection when dismissed.
"${browser[@]}" press Shift+A >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuSource === "now-playing-more"' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
"${browser[@]}" wait --fn '!document.querySelector(".spotify-vim-selected-play")' >/dev/null

# A playlist query with no matches must still let Escape return navigation to
# the menu, and a second Escape must close the entire action stack.
"${browser[@]}" press l >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Cuatro"' >/dev/null
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

# The now-playing shortcut remains available when no extension selection owns
# focus, unlike selection-based a. When Spotify does not expose a visible More
# button, its track/playlist link receives the native context-menu event.
"${browser[@]}" eval 'document.activeElement.blur()' >/dev/null
"${browser[@]}" eval 'document.querySelector("#now-playing-more").hidden = true' >/dev/null
"${browser[@]}" press Shift+A >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuSource === "now-playing-link"' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0' >/dev/null
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

# Home shelves expose a full-card action and a separate small Play button.
# h/l follow the row; j/k cross shelves without unexpectedly playing cards.
"${browser[@]}" open "file://$script_dir/fixture.html" >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.ready === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.renderCardShelves()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Alpha") && document.activeElement?.getAttribute("role") === "button"' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Beta") && !document.body.dataset.playedCard' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Epsilon")' >/dev/null
"${browser[@]}" press h >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Delta")' >/dev/null
"${browser[@]}" press h >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("nav .spotify-vim-selected-play")?.textContent === "Biblioteca Uno"' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Delta")' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Gamma")' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Gamma") && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("End of this shelf")' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Epsilon")' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.openedCard === "Epsilon" && !document.body.dataset.playedCard' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Epsilon")' >/dev/null
"${browser[@]}" eval 'document.querySelector(".fixture-shelf[aria-label=Albums] [role=grid]").focus()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Beta")' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir After Shelves"' >/dev/null

# Spotify's roving-focus manager can focus the first grid row even when our
# selected card is in another column. The handoff keeps navigation and Enter
# attached to the highlighted card, but releases unrelated native focus.
"${browser[@]}" open "file://$script_dir/fixture.html" >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.ready === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.renderCardShelves(); window.fixtureSafety.setCarouselRovingFocus()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.activeElement === document.querySelector(".fixture-shelf [role=row]") && document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Beta")' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.activeElement === document.querySelector(".fixture-shelf[aria-label=Albums] [role=row]") && document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Epsilon")' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.openedCard === "Epsilon" && !document.body.dataset.playedCard' >/dev/null
"${browser[@]}" press h >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Delta")' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.focusComposite()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-composite" && document.querySelector("main .spotify-vim-selected-play")?.getAttribute("aria-labelledby")?.includes("Delta") && document.body.dataset.compositeKey === "l"' >/dev/null

# A connected card repurposed by a shelf rerender must not open the replacement.
"${browser[@]}" open "file://$script_dir/fixture.html" >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.ready === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.renderCardShelves()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" eval 'const selected = document.querySelector("main .spotify-vim-selected-play"); selected.closest("[role=listitem]").setAttribute("aria-labelledby", "card-title-spotify:playlist:Changed-0"); selected.setAttribute("aria-labelledby", "card-title-spotify:playlist:Changed-0")' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn '!document.body.dataset.openedCard && !document.querySelector("main .spotify-vim-selected-play") && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("no longer available")' >/dev/null

printf 'Spotify Vim Navigation browser smoke tests passed.\n'
