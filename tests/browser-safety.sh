#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(cd -- "$script_dir/.." && pwd)
session=$(agent-browser session id --scope worktree --prefix spotify-vim-safety)
browser=(agent-browser --session "$session")

cleanup() {
  "${browser[@]}" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

reset_main() {
  "${browser[@]}" --init-script "$root/content.js" open "file://$script_dir/fixture.html" >/dev/null
  "${browser[@]}" wait --fn 'document.body.dataset.ready === "true"' >/dev/null
  "${browser[@]}" press l >/dev/null
  "${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Uno"' >/dev/null
}

open_menu() {
  "${browser[@]}" press a >/dev/null
  "${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null
  "${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu"' >/dev/null
}

# Menu synthetic activation produces one click and suppresses a native keydown
# that would otherwise activate the same focused item again.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.focusExternalMenuItem()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.nativeMenuActions === "1" && document.body.dataset.nativeMenuClicks === "1" && !document.body.dataset.nativeMenuKeydowns' >/dev/null

# Recycled selected nodes cannot operate on a different semantic row, while a
# same-identity rerender is reacquired before its action menu opens.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.recycleSelectedMain()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("[role=menu]") && !document.body.dataset.moreClicks && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("no longer available")' >/dev/null

# A removed play control and a reparented control both release the exact old
# row owner rather than rediscovering a mutable ancestor later.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.removeSelectedMainPlay()' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#fixture-selected-row")?.classList.contains("spotify-vim-selected-context")' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.reparentSelectedMain()' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("#fixture-original-row")?.classList.contains("spotify-vim-selected-context")' >/dev/null

reset_main
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Dos"' >/dev/null
"${browser[@]}" eval 'window.replaceTracks()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.lastMoreUri === "spotify:track:dos" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null

reset_main
"${browser[@]}" press h >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.recycleSelectedSidebar()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id !== "library-control" && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("no longer available")' >/dev/null

reset_main
"${browser[@]}" press h >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.countSidebarActivation(); window.fixtureSafety.disableSelectedSidebar()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn '!document.body.dataset.sidebarClicks && !document.body.dataset.sidebarKeydowns && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("no longer available")' >/dev/null

# Disabled or removed menu actions are never synthetically activated.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setNativeMenuTakeover()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuBClicks && !document.body.dataset.menuAClicks && document.querySelector("[role=menu]")?.getAttribute("aria-activedescendant") === "fixture-native-b"' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.disableSelectedMenuItem()' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && !document.querySelector("[role=menu] .spotify-vim-selected-play") && !document.querySelector("[role=menu]")?.hasAttribute("aria-activedescendant")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.hideSelectedMenuItem()' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && !document.querySelector("[role=menu] .spotify-vim-selected-play") && !document.querySelector("[role=menu]")?.hasAttribute("aria-activedescendant")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.inertSelectedMenuItem()' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && !document.querySelector("[role=menu] .spotify-vim-selected-play") && !document.querySelector("[role=menu]")?.hasAttribute("aria-activedescendant")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.removeSelectedMenuItem()' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && !document.querySelector("[role=menu] .spotify-vim-selected-play") && !document.querySelector("[role=menu]")?.hasAttribute("aria-activedescendant")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.removeSelectedMenuItem()' >/dev/null
"${browser[@]}" wait 240 >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && document.querySelector("[role=menu]")?.getAttribute("aria-activedescendant") === null && !document.querySelector("[role=menu]")?.hasAttribute("aria-activedescendant") && window.fixtureSafety.lastRemovedMenuItem?.id === ""' >/dev/null

for kind in inert aria-hidden; do
  reset_main
  open_menu
  "${browser[@]}" eval "window.fixtureSafety.wrapSelectedMenuItem(\"$kind\")" >/dev/null
  "${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && !document.querySelector("[role=menu] .spotify-vim-selected-play") && !document.querySelector("[role=menu]")?.hasAttribute("aria-activedescendant")' >/dev/null
done

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.changeSelectedMenuId()' >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.isConnected && !document.querySelector("[role=menu] .spotify-vim-selected-play") && document.querySelector("[role=menu]")?.getAttribute("aria-activedescendant") === null && document.querySelector("#fixture-native-changed-id")' >/dev/null

# Only the first gridcell fallback is considered a play control.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.renderUnsafePlayableRows()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.id === "valid-first-play" && !document.body.dataset.unsafeMore' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.validPlayClicks === "1"' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.renderWrappedPlayableRows()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.id === "wrapped-first-play" && document.querySelector(".spotify-vim-selected-play")?.closest("[role=row]")?.classList.contains("spotify-vim-selected-context") && !document.body.dataset.wrappedUnsafeMore' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.wrappedPlayClicks === "1"' >/dev/null

# Escape clears selection history for activation; recycled duplicate identities
# never redirect second-row intent to the first row's More action.
reset_main
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" eval 'document.activeElement.blur()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("[role=menu]") && !document.body.dataset.moreClicks && !document.querySelector(".spotify-vim-selected-play")' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.renderDuplicateRows()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.recycleSelectedMain()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn '!document.querySelector("[role=menu]") && !document.body.dataset.moreClicks && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("no longer available")' >/dev/null

# Empty menu shells wait for choices, and keep menu ownership after their
# bounded timeout until a later j discovers inserted actions.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuShell()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuShellMounted === "true"' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseMenuShellItems()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuShellItemsMounted === "true" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuShell()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuShellMounted === "true"' >/dev/null
"${browser[@]}" wait 1300 >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && !document.querySelector(".spotify-vim-selected-play") && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("loading choices")' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseMenuShellItems()' >/dev/null
"${browser[@]}" press j >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null

# A submenu may replace an existing menu container's actionable contents.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuSameContainer()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 1 && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Nueva lista"' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuSameUnchanged()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait 1300 >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && !document.querySelector(".spotify-vim-selected-play") && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("did not open")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuSameRepurposed()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuConstantNodes === "2" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Acción de submenú reutilizada A"' >/dev/null

# Immutable pre-focus signatures detect semantic mutations on the same ordered
# nodes, including attribute-only and character-data-only changes.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuGate(); window.fixtureSafety.setSubmenuAriaMutation()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseSubmenu()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuConstantNodes === "2" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.getAttribute("aria-label") === "Acción aria de submenú"' >/dev/null

# A native B relationship takes ownership during a gated submenu transition;
# the late child must not regain extension focus or selection.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuGate()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuNativeTakeover()' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseSubmenu()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuMounted === "1" && document.querySelector("#fixture-requested-menu")?.isConnected && document.activeElement?.id === "fixture-requested-menu" && document.querySelector("#fixture-requested-menu")?.getAttribute("aria-activedescendant") === "fixture-native-submenu-b" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null

# Same-task activation must also fail closed before the observer can run.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuGate()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuNativeTakeover()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'Number(document.body.dataset.submenuNativeBClicks) >= 1 && !document.body.dataset.menuAClicks && document.body.dataset.submenuNativeDefaultPrevented === "false" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseSubmenu()' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuGate(); window.fixtureSafety.setSubmenuTextMutation()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseSubmenu()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuConstantNodes === "2" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Acción texto de submenú"' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuDisabledFalse()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait 1300 >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && !document.querySelector(".spotify-vim-selected-play") && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("did not open")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuSearchOnly()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#fixture-submenu-search") && document.activeElement?.getAttribute("role") === "menu" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuOpens === "1" && !document.body.dataset.action && document.activeElement?.getAttribute("role") === "menu"' >/dev/null

# Spotify may focus a native item while mounting the action portal. That first
# expected focus must not cancel the open before the menu waiter selects it.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuAutoFocusFirst()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null

# An already-visible unrelated menu is never admitted as this open's portal.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuGate(); window.fixtureSafety.retainExistingMenus(); window.fixtureSafety.createUnrelatedMenu()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.focusUnrelatedMenu(); window.fixtureSafety.releaseMenu()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuMounted === "1" && document.activeElement?.id === "fixture-unrelated-menu-item" && !document.querySelector("#fixture-requested-menu .spotify-vim-selected-play")' >/dev/null

# A focus-admitted portal and the waiter result must be the same DOM menu.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuAutoFocusFirst(); window.fixtureSafety.setMenuReplacement()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("#fixture-replacement-menu") && document.activeElement?.textContent === "Agregar a la cola" && !document.querySelector("#fixture-requested-menu .spotify-vim-selected-play") && !document.querySelector("#fixture-replacement-menu .spotify-vim-selected-play")' >/dev/null

# Direct nested portal controls retain native initial focus; only eligible menu
# items (or the menu container) qualify for mount-time admission.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuAutoFocusInput()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-requested-menu-input" && !document.querySelector("#fixture-requested-menu .spotify-vim-selected-play")' >/dev/null

# A container-first mount must not treat a later direct input as a null menuitem.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuContainerThenInput()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait 120 >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-requested-menu-input" && !document.querySelector(".spotify-vim-selected-play") && document.activeElement !== document.querySelector("#fixture-requested-menu")' >/dev/null

# A timed-out open is terminal: a later native menu focus remains unowned.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.setMenuGate()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuPending === "true"' >/dev/null
"${browser[@]}" wait 1300 >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.focusOtherMenu()' >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-other-menu-item" && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("did not open") && !document.querySelector("#fixture-other-menu .spotify-vim-selected-play")' >/dev/null

# The submenu branch gets the same propagation protection.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuGate(); window.fixtureSafety.armSubmenuActivation(); window.fixtureSafety.suppressSubmenuFocusOpening(); window.fixtureSafety.focusSubmenuTrigger()' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.restoreSubmenuFocusOpening()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.releaseSubmenu()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuMounted === "1" && document.body.dataset.submenuOpens === "1" && !document.body.dataset.submenuClicks && !document.body.dataset.submenuKeydowns' >/dev/null

# An unrelated native control keeps its Enter default behavior while a menu stays mounted.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.focusOutsideMenu()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.externalEnter === "true" && document.body.dataset.externalDefaultPrevented === "false" && document.body.dataset.externalClick === "true" && !document.body.dataset.action' >/dev/null

# The sidebar handoff is one-shot: its original library target recovers l, but
# later ordinary/composite focus cannot be retargeted into extension ownership.
reset_main
"${browser[@]}" press h >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.textContent === "Biblioteca Uno"' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "library-control"' >/dev/null
"${browser[@]}" wait 650 >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Uno"' >/dev/null

reset_main
"${browser[@]}" press h >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "library-control"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.focusOutsideMenu()' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "native-control" && document.body.dataset.externalPaneKey === "l" && document.body.dataset.externalPaneDefaultPrevented === "false" && document.querySelector(".spotify-vim-selected-play")?.textContent === "Biblioteca Uno"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.focusComposite()' >/dev/null
"${browser[@]}" press h >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-composite" && document.body.dataset.compositeKey === "l" && document.body.dataset.compositeDefaultPrevented === "false" && document.querySelector(".spotify-vim-selected-play")?.textContent === "Biblioteca Uno"' >/dev/null

# role, native, and alert dialogs retain h/l and Shift+A.
for kind in role native alert; do
  reset_main
  "${browser[@]}" eval "window.fixtureSafety.showDialog(\"$kind\")" >/dev/null
  "${browser[@]}" press h >/dev/null
  "${browser[@]}" press l >/dev/null
  "${browser[@]}" press Shift+A >/dev/null
  "${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-dialog-button" && !document.querySelector("[role=menu]")' >/dev/null
done

# Explicit gates prove a late mount happened after disable and after / supersession.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.runPendingMenuRace("disable")' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuRace === "disable" && document.body.dataset.menuMounted === "1"' >/dev/null
"${browser[@]}" wait 120 >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]") && !document.querySelector(".spotify-vim-selected-play") && document.activeElement?.getAttribute("role") !== "menu" && document.querySelector("#spotify-vim-navigation-status")?.textContent.includes("disabled")' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.runPendingMenuRace("search")' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuRace === "search" && document.body.dataset.menuMounted === "1"' >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.dataset.testid === "search-input"' >/dev/null
"${browser[@]}" wait 120 >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]") && document.activeElement?.dataset.testid === "search-input" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null

# Neutral Shift+A is canceled by Escape even with no selected row.
reset_main
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" eval 'document.activeElement.blur(); window.fixtureSafety.runPendingMenuRace("neutral")' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.menuRace === "neutral" && document.body.dataset.menuMounted === "1"' >/dev/null
"${browser[@]}" wait 120 >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]") && !document.querySelector(".spotify-vim-selected-play") && document.activeElement?.getAttribute("role") !== "menu"' >/dev/null

# A native focus change during a gated submenu wait cannot be overwritten on release.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setSubmenuGate()' >/dev/null
"${browser[@]}" press k >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuPending === "true"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.focusOtherMenu(); window.fixtureSafety.releaseSubmenu()' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.submenuMounted === "1"' >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-other-menu-item"' >/dev/null

# Retained parent + follow-up menu keeps exact follow-up item focus after cleanup.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setActionMode("follow-up-retain")' >/dev/null
"${browser[@]}" press l >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-follow-up-item" && document.querySelectorAll("[role=menu]").length === 2' >/dev/null
"${browser[@]}" wait 180 >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-follow-up-item" && document.querySelectorAll("[role=menu]").length === 2' >/dev/null

# Focus to another menu during both close wait stages cancels fallback/reselection.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.runCloseRace("first")' >/dev/null
"${browser[@]}" wait 240 >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.moreClicks === "1" && document.activeElement?.id === "fixture-other-menu-item" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.runCloseRace("second")' >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.moreClicks === "2"' >/dev/null
"${browser[@]}" wait 360 >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.moreClicks === "2" && document.activeElement?.id === "fixture-other-menu-item" && !document.querySelector(".spotify-vim-selected-play")' >/dev/null

# The post-action j runs before the 150ms cleanup and remains the winning selection.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.runPostActionJ()' >/dev/null
"${browser[@]}" wait --fn 'Number(document.body.dataset.postActionKeyAt) - Number(document.body.dataset.actionAt) >= 0 && Number(document.body.dataset.postActionKeyAt) - Number(document.body.dataset.actionAt) < 150' >/dev/null
"${browser[@]}" wait 180 >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.getAttribute("aria-label") === "Reproducir Dos"' >/dev/null

# A sibling playlist portal is owned only after / chooses it; arbitrary inputs keep Escape.
reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.addSiblingPlaylistSearch()' >/dev/null
"${browser[@]}" press / >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.id === "fixture-sibling-playlist-search"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.activeElement?.getAttribute("role") === "menu" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.textContent === "Agregar a la cola"' >/dev/null

reset_main
open_menu
"${browser[@]}" eval 'window.fixtureSafety.addExternalInput()' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.externalEscapePrevented === "false"' >/dev/null

# Sidebar synthetic activation remains exactly one click with no native keydown.
reset_main
"${browser[@]}" press h >/dev/null
"${browser[@]}" wait --fn 'document.querySelector(".spotify-vim-selected-play")?.textContent === "Biblioteca Uno"' >/dev/null
"${browser[@]}" eval 'window.fixtureSafety.countSidebarActivation()' >/dev/null
"${browser[@]}" press Enter >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.sidebarClicks === "1" && !document.body.dataset.sidebarKeydowns && document.activeElement?.id === "library-control"' >/dev/null

# Existing menu IDs are reused, not removed, while the container's original
# aria-activedescendant is temporarily replaced and restored on close.
reset_main
"${browser[@]}" eval 'window.fixtureSafety.addGeneratedIdCollision()' >/dev/null
open_menu
"${browser[@]}" wait --fn 'document.querySelector("[role=menu] .spotify-vim-selected-play")?.id !== "spotify-vim-menu-item-1" && document.querySelector("[role=menu]")?.getAttribute("aria-activedescendant") === document.querySelector("[role=menu] .spotify-vim-selected-play")?.id' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.querySelectorAll("[role=menu]").length === 0 && document.getElementById("spotify-vim-menu-item-1")' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.setPreexistingMenuAria(); window.fixtureSafety.recordRemovedMenuAria()' >/dev/null
"${browser[@]}" press a >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.getAttribute("aria-activedescendant") === "fixture-existing-menu-item" && document.querySelector("[role=menu] .spotify-vim-selected-play")?.id === "fixture-existing-menu-item"' >/dev/null
"${browser[@]}" press Escape >/dev/null
"${browser[@]}" wait --fn 'document.body.dataset.removedMenuAria === "fixture-existing-active" && document.body.dataset.removedMenuItemId === "fixture-existing-menu-item"' >/dev/null

reset_main
"${browser[@]}" eval 'window.fixtureSafety.setPreexistingMenuAria()' >/dev/null
open_menu
"${browser[@]}" eval 'window.fixtureSafety.setThirdNativeMenuRef()' >/dev/null
"${browser[@]}" press Alt+Shift+v >/dev/null
"${browser[@]}" wait --fn 'document.querySelector("[role=menu]")?.getAttribute("aria-activedescendant") === "fixture-third-active" && !document.querySelector("[role=menu] .spotify-vim-selected-play")' >/dev/null

printf 'Spotify Vim Navigation safety regression tests passed.\n'
