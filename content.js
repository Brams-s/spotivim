(() => {
  "use strict";

  if (globalThis.__spotifyVimNavigationInstalled) return;
  globalThis.__spotifyVimNavigationInstalled = true;

  const selectedClass = "spotify-vim-selected-play";
  const selectedContextClass = "spotify-vim-selected-context";
  const statusId = "spotify-vim-navigation-status";
  const helpId = "spotify-vim-navigation-help";
  const helpHeadingId = "spotify-vim-navigation-help-heading";
  let selected = null;
  let pane = "main";
  let lastMainSelection = null;
  let lastMainIdentity = null;
  let lastSidebarSelection = null;
  let lastSidebarIdentity = null;
  let lastMenuSelection = null;
  let lastMenuIdentity = null;
  let menuOriginPane = "main";
  let menuOriginSelection = null;
  let menuOriginActionTarget = null;
  let forwardingMenuEscape = false;
  let pendingG = false;
  let pendingGTimer = 0;
  let statusTimer = 0;
  let enabled = true;
  let operationGeneration = 0;
  let currentOperation = null;
  let staleSidebarFocus = null;
  let staleSidebarTimer = 0;
  let cardFocusHandoff = null;
  let cardFocusTimer = 0;
  let ownedMenuSearch = null;
  let menuAriaState = new WeakMap();
  let activeMenuAriaState = null;
  let menuAriaReconcileTimer = 0;
  let menuItemId = 0;
  let helpRestoreFocus = null;
  let firstSelectionHintShown = false;
  let selectedContextOwner = null;
  let selectedContextOwnerClass = null;
  let suppressedStatusMessage = null;

  function extensionVersion() {
    try {
      return globalThis.chrome?.runtime?.getManifest?.().version_name ||
        globalThis.chrome?.runtime?.getManifest?.().version ||
        "development";
    } catch {
      return "development";
    }
  }

  function isEditable(element) {
    if (!(element instanceof Element)) return false;
    if (element.matches("input, textarea, select")) return !element.disabled;
    return element.isContentEditable || Boolean(
      element.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"]')
    );
  }

  function visible(element) {
    if (!(element instanceof HTMLElement) || element.disabled) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function mainItems() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return [];

    // Carousel rows are cards, not track-list rows. Their small Play button is
    // a secondary action; selecting it makes a horizontal shelf behave like a
    // vertical list and leaves the card itself inaccessible from our keys.
    return [...main.querySelectorAll('[role="row"]')]
      .map((row) => {
        if (row.closest('[data-shelf="carousel"]')) {
          return row.querySelector('[role="listitem"] > [role="button"]');
        }
        const explicit = row.querySelector('button[data-testid="play-button"]');
        if (explicit) return explicit;
        // Track rows may wrap their cells in a presentation div. Never use a
        // later action cell as a fallback play control.
        const firstCell = row.querySelector('[role="gridcell"]');
        return firstCell?.querySelector("button") || null;
      })
      .filter(visible);
  }

  function mainShelf(item) {
    return item?.closest?.('[data-shelf="carousel"]') || null;
  }

  function sidebarItems() {
    const library = document.querySelector('nav [role="grid"]');
    if (!(library instanceof HTMLElement)) return [];

    // Spotify renders every saved item as a grid cell. The action that opens
    // it is a role=button div; the native Play button in the same row must be
    // ignored so h/j/k selects the row instead of starting playback.
    return [...library.querySelectorAll('[role="gridcell"]')]
      .map((cell) => cell.querySelector('[role="button"]'))
      .filter(visible);
  }

  function activeActionMenu() {
    const menus = [...document.querySelectorAll('[role="menu"]')].filter(visible);
    return menus.at(-1) || null;
  }

  function nowPlayingWidget() {
    const selectors = [
      '[data-testid="now-playing-widget"]',
      '.main-nowPlayingWidget-nowPlaying',
      '[data-testid="now-playing-bar"]',
      '.main-nowPlayingBar-left'
    ];
    for (const selector of selectors) {
      const widget = [...document.querySelectorAll(selector)].find(visible);
      if (widget) return widget;
    }
    return null;
  }

  function menuForSelection() {
    const menu = pane === "menu" && lastMenuSelection instanceof Element
      ? lastMenuSelection.closest('[role="menu"]')
      : null;
    return visible(menu) ? menu : activeActionMenu();
  }

  function actionMenuItems(menu = menuForSelection()) {
    if (!(menu instanceof HTMLElement)) return [];
    return [...menu.querySelectorAll('[role="menuitem"], [role="option"]')]
      .filter((item) => item.closest('[role="menu"]') === menu)
      .filter((item) => !item.querySelector('input, textarea, [role="searchbox"], [role="textbox"]'))
      .filter((item) => item.getAttribute("aria-disabled") !== "true")
      .filter(visible);
  }

  function localActionMenuSearch(menu) {
    if (!(menu instanceof HTMLElement)) return null;
    const selector = [
      'input[role="searchbox"]', 'input[type="search"]', '[role="searchbox"]',
      '[data-testid="playlist-search-input"]', 'input[placeholder*="playlist" i]',
      'input[aria-label*="playlist" i]'
    ].join(", ");
    return [...menu.querySelectorAll(selector)].find(visible) || null;
  }

  function menuIsReady(menu) {
    return actionMenuItems(menu).length > 0 || localActionMenuSearch(menu) instanceof HTMLElement;
  }

  function focusActionMenu(menu) {
    if (!(menu instanceof HTMLElement)) return;
    if (!menu.hasAttribute("tabindex")) menu.setAttribute("tabindex", "-1");
    menu.focus({ preventScroll: true });
  }

  function actionMenuSearch(menu = activeActionMenu()) {
    const selector = [
      'input[role="searchbox"]', 'input[type="search"]', '[role="searchbox"]',
      '[data-testid="playlist-search-input"]', 'input[placeholder*="playlist" i]',
      'input[aria-label*="playlist" i]'
    ].join(", ");
    const localSearch = localActionMenuSearch(menu);
    if (localSearch) return localSearch;

    // Some Spotify experiments render the playlist picker in a sibling portal
    // rather than below the role=menu node. Only accept globally visible fields
    // whose accessible name explicitly identifies them as playlist search so
    // the main Spotify search box can never be captured here.
    return [...document.querySelectorAll(selector)].find((search) => {
      if (!visible(search)) return false;
      const name = `${search.getAttribute("aria-label") || ""} ${search.getAttribute("placeholder") || ""}`;
      return /playlist|lista/i.test(name) || search.matches('[data-testid="playlist-search-input"]');
    }) || null;
  }

  function focusActionMenuSearch() {
    const menu = activeActionMenu();
    const search = actionMenuSearch(menu);
    if (!(search instanceof HTMLElement)) {
      flash("This action menu has no playlist search.");
      return;
    }
    clearSelection();
    pane = "menu";
    ownedMenuSearch = { menu, search };
    search.focus({ preventScroll: true });
    if (search instanceof HTMLInputElement) search.select();
    flash("Playlist search — type, then Esc to return to the results.");
  }

  function ensureUi() {
    if (!document.body) return false;
    if (!document.getElementById(statusId)) {
      const status = document.createElement("div");
      status.id = statusId;
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      status.dataset.extensionVersion = extensionVersion();
      document.body.append(status);
    }
    return true;
  }

  function flash(message, duration = 2200) {
    if (!ensureUi()) return;
    const status = document.getElementById(statusId);
    if (!status) return;
    clearTimeout(statusTimer);
    status.textContent = message;
    status.dataset.visible = "true";
    const helpOpen = document.getElementById(helpId);
    status.dataset.suppressed = helpOpen ? "true" : "false";
    if (helpOpen) suppressedStatusMessage = message;
    statusTimer = setTimeout(() => { status.dataset.visible = "false"; }, duration);
  }

  function selectionContextOwner(element, selectionPane) {
    if (!(element instanceof Element)) return null;
    if (selectionPane === "menu") return element;
    if (selectionPane === "sidebar") return element.closest('[role="gridcell"]');
    return element.closest('[role="row"]');
  }

  function clearSelectionContextOwner() {
    if (selectedContextOwner instanceof HTMLElement && selectedContextOwnerClass) {
      selectedContextOwner.classList.remove(selectedContextOwnerClass);
    }
    selectedContextOwner = null;
    selectedContextOwnerClass = null;
  }

  function cleanupMenuAriaState(state = activeMenuAriaState) {
    if (!state) return;
    const menu = state.menu;
    const current = menu instanceof HTMLElement ? menu.getAttribute("aria-activedescendant") : null;
    // Spotify may have taken ownership since our last update. Never overwrite
    // that newer value while releasing our own reference.
    if (menu instanceof HTMLElement && current === state.extensionValue) {
      if (state.hadAttribute) menu.setAttribute("aria-activedescendant", state.previousValue);
      else menu.removeAttribute("aria-activedescendant");
    }
    if (state.generatedId && state.targetItem?.id === state.extensionValue) {
      state.targetItem.removeAttribute("id");
    }
    if (menu instanceof HTMLElement) menuAriaState.delete(menu);
    state.observer?.disconnect();
    if (activeMenuAriaState === state) activeMenuAriaState = null;
    if (!activeMenuAriaState && menuAriaReconcileTimer) {
      clearInterval(menuAriaReconcileTimer);
      menuAriaReconcileTimer = 0;
    }
  }

  function menuTargetEligible(state) {
    if (!state || !(state.menu instanceof HTMLElement) || !(state.targetItem instanceof HTMLElement)) return false;
    const target = state.targetItem;
    return target.isConnected && target.id === state.extensionValue &&
      !unavailableNativeContext(target) && target.getAttribute("aria-disabled") !== "true" &&
      target.getAttribute("aria-hidden") !== "true" && !target.hasAttribute("inert") &&
      actionMenuItems(state.menu).includes(target);
  }

  function menuOwnershipIntact(menu = menuForSelection()) {
    const state = activeMenuAriaState;
    return state && state.menu === menu && menuTargetEligible(state) &&
      menu.getAttribute("aria-activedescendant") === state.extensionValue;
  }

  function relinquishMenuSelection() {
    const old = selected;
    if (activeMenuAriaState) cleanupMenuAriaState();
    old?.classList.remove(selectedClass);
    clearSelectionContextOwner();
    selected = null;
    lastMenuSelection = null;
    lastMenuIdentity = null;
    supersedeOperations();
  }

  function reconcileMenuAria() {
    const state = activeMenuAriaState;
    if (!state) return;
    const relationshipIntact = state.menu.getAttribute("aria-activedescendant") === state.extensionValue;
    if (!relationshipIntact || !menuTargetEligible(state)) {
      const nativeTakeover = !relationshipIntact;
      const ownsPendingOperation = nativeTakeover && currentOperation?.menu === state.menu;
      if (ownsPendingOperation) {
        relinquishMenuSelection();
        return;
      }
      cleanupMenuAriaState(state);
      if (selected === state.targetItem) {
        selected?.classList.remove(selectedClass);
        selected = null;
        clearSelectionContextOwner();
        lastMenuSelection = null;
        lastMenuIdentity = null;
      }
    }
  }

  function restoreMenuActiveDescendant(menu) {
    const state = menuAriaState.get(menu);
    if (state) cleanupMenuAriaState(state);
  }

  function ownedMenuItemId(item) {
    if (item.id) return item.id;
    let id;
    do {
      menuItemId += 1;
      id = `spotify-vim-menu-item-${menuItemId}`;
    } while (document.getElementById(id));
    item.id = id;
    return id;
  }

  function updateMenuActiveDescendant(item) {
    const menu = item?.closest?.('[role="menu"]');
    if (!(menu instanceof HTMLElement) || !(item instanceof HTMLElement)) return;
    let state = menuAriaState.get(menu);
    if (!state) {
      state = {
        menu,
        hadAttribute: menu.hasAttribute("aria-activedescendant"),
        previousValue: menu.getAttribute("aria-activedescendant") || "",
        targetItem: null,
        extensionValue: null,
        generatedId: false
      };
      menuAriaState.set(menu, state);
      activeMenuAriaState = state;
      if (!menuAriaReconcileTimer) menuAriaReconcileTimer = setInterval(reconcileMenuAria, 150);
      state.observer = new MutationObserver(() => reconcileMenuAria());
      // The menu can be reparented or its selected child can be removed from
      // the portal without mutating the menu node itself. This observer is
      // active only while this one extension-owned reference exists and is
      // disconnected by cleanupMenuAriaState.
      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["id", "aria-activedescendant", "aria-disabled", "aria-hidden", "hidden", "inert", "style", "class", "role"]
      });
    }
    if (state.targetItem && state.targetItem !== item && state.generatedId && state.targetItem.id === state.extensionValue) {
      state.targetItem.removeAttribute("id");
    }
    const hadItemId = Boolean(item.id);
    const id = ownedMenuItemId(item);
    state.targetItem = item;
    state.extensionValue = id;
    state.generatedId = !hadItemId;
    menu.setAttribute("aria-activedescendant", id);
  }

  function clearHelpRestoreFocus() {
    const focus = helpRestoreFocus;
    helpRestoreFocus = null;
    if (focus instanceof HTMLElement && focus.isConnected && visible(focus) && !unavailableNativeContext(focus)) {
      focus.focus({ preventScroll: true });
    }
  }

  function closeHelp(restore = true) {
    const panel = document.getElementById(helpId);
    const ownsFocus = panel instanceof HTMLElement &&
      (document.activeElement === panel || panel.contains(document.activeElement));
    if (panel) panel.remove();
    const status = document.getElementById(statusId);
    if (status) {
      if (suppressedStatusMessage !== null && status.textContent === suppressedStatusMessage) {
        status.dataset.visible = "false";
      }
      status.dataset.suppressed = "false";
    }
    suppressedStatusMessage = null;
    if (restore && ownsFocus) clearHelpRestoreFocus();
    else helpRestoreFocus = null;
  }

  function openHelp() {
    if (document.getElementById(helpId)) {
      closeHelp();
      return;
    }
    ensureUi();
    const status = document.getElementById(statusId);
    status?.setAttribute("data-suppressed", "true");
    suppressedStatusMessage = status?.textContent || null;
    helpRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = document.createElement("section");
    panel.id = helpId;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", helpHeadingId);
    panel.tabIndex = -1;
    panel.innerHTML = `
      <div class="spotify-vim-help-header"><h2 id="${helpHeadingId}">Keyboard shortcuts</h2>
        <button type="button" data-spotify-vim-help-close>Close</button></div>
      <div class="spotify-vim-help-groups">
        <section><h3>Navigation</h3><dl>
          <div><dt><kbd>h</kbd> / <kbd>l</kbd></dt><dd>Choose a pane or move across a card shelf</dd></div>
          <div><dt><kbd>j</kbd> / <kbd>k</kbd></dt><dd>Move between shelves or through tracks</dd></div>
          <div><dt><kbd>Enter</kbd></dt><dd>Open a selected card or library item</dd></div>
          <div><dt><kbd>/</kbd></dt><dd>Focus Spotify search</dd></div>
        </dl></section>
        <section><h3>Actions</h3><dl>
          <div><dt><kbd>a</kbd></dt><dd>Open actions for the selection</dd></div>
          <div><dt><kbd>Shift</kbd> + <kbd>A</kbd></dt><dd>Open actions for what is playing</dd></div>
        </dl></section>
        <section><h3>Menus</h3><dl>
          <div><dt><kbd>j</kbd> / <kbd>k</kbd></dt><dd>Move through actions</dd></div>
          <div><dt><kbd>l</kbd> / <kbd>Enter</kbd></dt><dd>Choose or enter a submenu</dd></div>
          <div><dt><kbd>/</kbd></dt><dd>Search playlist choices</dd></div>
          <div><dt><kbd>h</kbd> / <kbd>Esc</kbd></dt><dd>Close and return</dd></div>
        </dl></section>
        <section><h3>Global</h3><dl>
          <div><dt><kbd>gg</kbd> / <kbd>G</kbd></dt><dd>Scroll to the top or bottom</dd></div>
          <div><dt><kbd>H</kbd> / <kbd>L</kbd></dt><dd>Go back or forward in browser history</dd></div>
          <div><dt><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd></dt><dd>Turn navigation on or off</dd></div>
          <div><dt><kbd>?</kbd></dt><dd>Show or hide these shortcuts</dd></div>
        </dl></section>
      </div>`;
    panel.querySelector("[data-spotify-vim-help-close]").addEventListener("click", closeHelp);
    document.body.append(panel);
    panel.querySelector("[data-spotify-vim-help-close]")?.focus({ preventScroll: true });
  }

  function clearSelection() {
    clearCardFocusHandoff();
    selected?.classList.remove(selectedClass);
    clearSelectionContextOwner();
    if (activeMenuAriaState) cleanupMenuAriaState();
    selected = null;
  }

  function selectedIsUsable() {
    return selected instanceof HTMLElement && selected.isConnected && visible(selected);
  }

  function nativeInteractive(element) {
    if (!(element instanceof Element)) return false;
    return Boolean(element.closest([
      "a[href]", "button", "input", "textarea", "select",
      "[contenteditable]:not([contenteditable=\"false\"])", "[role=button]",
      "[role=link]", "[role=slider]", "[role=tab]", "[role=combobox]",
      "[role=listbox]", "[role=dialog]", "[role=menuitem]", "[role=option]",
      "[role=tree]", "[role=grid]", "[role=treegrid]"
    ].join(", ")));
  }

  function unavailableNativeContext(element) {
    if (!(element instanceof Element)) return false;
    return Boolean(element.closest('[role="dialog"], [role="alertdialog"], dialog[open], [inert], [aria-hidden="true"]'));
  }

  function menuFocusState(menu = menuForSelection()) {
    if (!(menu instanceof HTMLElement) || !visible(menu)) return { menu: null, kind: "none", item: null };
    const focus = document.activeElement;
    if (focus === menu) return { menu, kind: "container", item: null };
    if (focus instanceof Element) {
      const item = focus.closest('[role="menuitem"], [role="option"]');
      if (item instanceof HTMLElement && actionMenuItems(menu).includes(item)) {
        return { menu, kind: "item", item };
      }
    }
    return { menu, kind: "none", item: null };
  }

  function adoptFocusedMenuItem(menu) {
    const { kind, item } = menuFocusState(menu);
    if (kind !== "item" || !(item instanceof HTMLElement)) return false;
    if (selected !== item) {
      clearSelection();
      selected = item;
      pane = "menu";
      lastMenuSelection = item;
      lastMenuIdentity = elementIdentity(item);
      item.classList.add(selectedClass);
      selectedContextOwner = selectionContextOwner(item, "menu");
      selectedContextOwnerClass = selectedContextClass;
      selectedContextOwner?.classList.add(selectedContextClass);
      updateMenuActiveDescendant(item);
    }
    return true;
  }

  function ownsStaleSidebarFocus() {
    const focus = document.activeElement;
    return pane === "sidebar" && selectedIsUsable() &&
      staleSidebarFocus?.source === selected && staleSidebarFocus.target === focus &&
      !unavailableNativeContext(focus);
  }

  function clearStaleSidebarFocus() {
    staleSidebarFocus = null;
    clearTimeout(staleSidebarTimer);
    staleSidebarTimer = 0;
  }

  function clearCardFocusHandoff() {
    cardFocusHandoff = null;
    clearTimeout(cardFocusTimer);
    cardFocusTimer = 0;
  }

  function clearOwnedMenuSearch() {
    ownedMenuSearch = null;
  }

  function selectionOwnsEvent(event) {
    if (!selectedIsUsable()) return false;
    if (cardFocusHandoff?.source === selected && cardFocusHandoff.target === document.activeElement &&
      event.target === document.activeElement && !unavailableNativeContext(event.target)) return true;
    return [event.target, document.activeElement].some((element) =>
      element instanceof Node && (element === selected || selected.contains(element) ||
        (mainShelf(selected) && element instanceof Element &&
          (element === selected.closest('[role="row"]') ||
            element === selected.closest('[role="grid"]'))))
    );
  }

  function canHandleShortcut(event) {
    if (unavailableNativeContext(event.target) || unavailableNativeContext(document.activeElement)) return false;
    if (pane === "menu" && menuFocusState().kind !== "none") return true;
    if (selectionOwnsEvent(event)) return true;
    return !nativeInteractive(event.target) && !nativeInteractive(document.activeElement);
  }

  function captureMenuOrigin(target = selected) {
    return {
      pane,
      selection: selected,
      actionTarget: target,
      scope: target?.closest?.('[role="row"], [role="gridcell"]') || target?.parentElement || null
    };
  }

  function rememberedMenuOrigin() {
    return {
      pane: menuOriginPane,
      selection: menuOriginSelection,
      actionTarget: menuOriginActionTarget,
      scope: menuOriginActionTarget?.closest?.('[role="row"], [role="gridcell"]') ||
        menuOriginActionTarget?.parentElement || null
    };
  }

  function supersedeOperations() {
    if (currentOperation) currentOperation.awaitingMenu = false;
    operationGeneration += 1;
    currentOperation = null;
  }

  function beginOperation(origin = captureMenuOrigin()) {
    supersedeOperations();
    const operation = {
      id: operationGeneration,
      origin,
      menu: null,
      menuItem: null,
      awaitingMenu: false,
      allowMenuTransition: false,
      preOpenMenu: null,
      preExistingMenus: new Set()
    };
    currentOperation = operation;
    return operation;
  }

  function operationIsCurrent(operation) {
    return enabled && currentOperation === operation && operation.id === operationGeneration;
  }

  function operationAllowsFocus(operation, focus) {
    if (!(focus instanceof Element)) return true;
    if (unavailableNativeContext(focus)) return false;
    const focusMenu = focus.closest('[role="menu"]');
    if (focusMenu) {
      // Spotify can focus its first native menuitem in the same task that
      // mounts the portal, before our waiter continuation records the menu.
      // Admit only that first active portal while an action-open explicitly
      // awaits it; every later/replacement menu remains a superseding focus.
      if (!operation.menu && operation.awaitingMenu &&
        !operation.preExistingMenus.has(focusMenu) && focusMenu === activeActionMenu()) {
        const initialItem = focus.closest('[role="menuitem"], [role="option"]');
        const eligibleItem = initialItem instanceof HTMLElement && actionMenuItems(focusMenu).includes(initialItem)
          ? initialItem
          : null;
        // A portal container or one of its eligible actions is an expected
        // mount-time handoff. Directly nested controls are native ownership.
        if (focus !== focusMenu && !eligibleItem) return false;
        operation.menu = focusMenu;
        operation.menuItem = eligibleItem;
      }
      if (focusMenu !== operation.menu) return false;
      const item = focus.closest('[role="menuitem"], [role="option"]');
      return focus === operation.menu || (item instanceof HTMLElement &&
        operation.menuItem instanceof HTMLElement && item === operation.menuItem);
    }
    if (focus === operation.origin.selection || focus === operation.origin.actionTarget) return true;
    return operation.origin.scope instanceof Element && operation.origin.scope.contains(focus);
  }

  function restoreIsSafe(operation) {
    if (!operationIsCurrent(operation) || activeActionMenu()) return false;
    const focus = document.activeElement;
    return !nativeInteractive(focus) || operationAllowsFocus(operation, focus);
  }

  function operationOwnsMenu(operation, menu = activeActionMenu()) {
    return operationIsCurrent(operation) && menu instanceof HTMLElement && menu === operation.menu;
  }

  function setOperationMenu(operation, menu, item = null) {
    if (!operationIsCurrent(operation) || !(menu instanceof HTMLElement)) return false;
    if (operation.menu && operation.menu !== menu && !operation.allowMenuTransition) return false;
    operation.menu = menu;
    operation.menuItem = item;
    operation.awaitingMenu = false;
    operation.allowMenuTransition = false;
    return true;
  }

  function reconcilePane() {
    if (pane !== "menu" || activeActionMenu()) return;
    clearSelection();
    pane = menuOriginPane;
    lastMenuSelection = null;
  }

  function elementLabel(element) {
    const ariaLabel = element.getAttribute("aria-label")?.trim();
    if (ariaLabel) return ariaLabel;

    const labelledBy = element.getAttribute("aria-labelledby")?.trim();
    if (labelledBy) {
      const label = labelledBy.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ");
      if (label) return label;
    }

    return element.textContent?.trim() || "item";
  }

  function elementIdentity(element) {
    if (!(element instanceof Element)) return null;
    // Prefer the complete track row. In Spotify's current markup the selected
    // play button is nested in a gridcell, while the stable track URI/link is
    // attached elsewhere on the enclosing row.
    const scope = element.closest('[role="row"]') || element.closest('[role="gridcell"]') || element;
    const cardTitle = scope.querySelector('[role="listitem"]')?.getAttribute("aria-labelledby") || "";
    const cardUri = cardTitle.match(/card-title-(spotify:(?:track|album|artist|playlist):[A-Za-z0-9]+)/)?.[1];
    if (cardUri) return cardUri;
    const uri = scope.getAttribute("data-uri") || scope.querySelector("[data-uri]")?.getAttribute("data-uri");
    if (uri) return uri;
    const link = scope.querySelector('a[href*="/track/"], a[href*="/album/"], a[href*="/artist/"], a[href*="/playlist/"]');
    if (link instanceof HTMLAnchorElement) return link.href;
    return element.getAttribute("aria-label") || elementLabel(element);
  }

  function rememberedIndex(items, element, identity) {
    const connectedIndex = items.indexOf(element);
    if (connectedIndex >= 0 && (!identity || elementIdentity(element) === identity)) return connectedIndex;
    if (!identity) return -1;
    const matches = items.filter((item) => elementIdentity(item) === identity);
    return matches.length === 1 ? items.indexOf(matches[0]) : -1;
  }

  function eligibleSelectionCandidate(item, items, identity, selectionPane, menu) {
    return item instanceof HTMLElement && items.includes(item) && visible(item) &&
      !unavailableNativeContext(item) && item.getAttribute("aria-disabled") !== "true" &&
      (!identity || elementIdentity(item) === identity) &&
      (selectionPane !== "menu" || item.closest('[role="menu"]') === menu);
  }

  function selectionStateForPane(selectionPane = pane) {
    if (selectionPane === "sidebar") {
      return { items: sidebarItems(), identity: lastSidebarIdentity, menu: null };
    }
    if (selectionPane === "menu") {
      const menu = menuForSelection();
      return { items: actionMenuItems(menu), identity: lastMenuIdentity, menu };
    }
    return { items: mainItems(), identity: lastMainIdentity, menu: null };
  }

  function revalidateCurrentSelection(selectionPane = pane) {
    const { items, identity, menu } = selectionStateForPane(selectionPane);
    if (!(selected instanceof HTMLElement)) {
      flash("Select an item first.");
      return false;
    }
    if (eligibleSelectionCandidate(selected, items, identity, selectionPane, menu)) return true;

    // A connected node whose identity changed was recycled. Never redirect it
    // to a duplicate match; only a detached selection may be reacquired.
    if (selected.isConnected) {
      clearSelection();
      flash("Selection is no longer available.");
      return false;
    }

    const replacements = identity
      ? items.filter((item) => eligibleSelectionCandidate(item, items, identity, selectionPane, menu))
      : [];
    if (replacements.length === 1) {
      const replacement = replacements[0];
      return select(replacement, items.indexOf(replacement), items.length, selectionPane);
    }
    clearSelection();
    flash("Selection is no longer available.");
    return false;
  }

  function smoothBehavior() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function select(button, index, total, selectionPane) {
    if (!(button instanceof HTMLElement)) return false;
    clearSelection();
    selected = button;
    pane = selectionPane;
    if (staleSidebarFocus?.source !== button) clearStaleSidebarFocus();
    if (pane === "sidebar") {
      lastSidebarSelection = button;
      lastSidebarIdentity = elementIdentity(button);
    }
    else if (pane === "menu") {
      lastMenuSelection = button;
      lastMenuIdentity = elementIdentity(button);
    }
    else {
      lastMainSelection = button;
      lastMainIdentity = elementIdentity(button);
    }
    selected.classList.add(selectedClass);
    selectedContextOwner = selectionContextOwner(selected, pane);
    selectedContextOwnerClass = selectedContextClass;
    selectedContextOwner?.classList.add(selectedContextClass);
    if (pane === "menu") updateMenuActiveDescendant(selected);
    selected.scrollIntoView({ block: "center", inline: "nearest", behavior: smoothBehavior() });
    // Focusing Spotify menu items eagerly opens hover/focus submenus. Keep DOM
    // focus on the menu container while the extension highlights individual
    // actions, then focus an item only when the user deliberately enters it.
    if (pane === "menu") focusActionMenu(button.closest('[role="menu"]'));
    else {
      if (pane === "main" && mainShelf(selected)) {
        cardFocusHandoff = { source: selected, target: null };
        cardFocusTimer = setTimeout(clearCardFocusHandoff, 500);
      }
      selected.focus({ preventScroll: true });
    }
    const label = elementLabel(selected);
    const shelf = pane === "main" ? mainShelf(selected) : null;
    const title = pane === "sidebar" ? "Sidebar" : pane === "menu" ? "Actions" : shelf ? "Shelf" : "Main";
    const shelfItems = shelf ? mainItems().filter((item) => mainShelf(item) === shelf) : null;
    const hint = firstSelectionHintShown ? "" : " · Press ? for shortcuts.";
    firstSelectionHintShown = true;
    const action = pane === "sidebar"
      ? "Enter opens"
      : pane === "menu"
        ? "j/k wrap · / playlist search · h/Esc close · l/Enter chooses"
        : shelf ? "h/l cards · j/k shelves · Enter opens · a opens actions"
          : "Enter or Space plays · a opens actions";
    const position = shelf ? `${shelfItems.indexOf(selected) + 1}/${shelfItems.length}` : `${index + 1}/${total}`;
    flash(`${title} ${position}: ${label} — ${action}${hint}`);
    return true;
  }

  function moveMainSelection(direction) {
    const items = mainItems();
    if (items.length === 0) {
      flash("No cards or playable tracks are visible yet.");
      return;
    }
    const current = rememberedIndex(items, lastMainSelection, lastMainIdentity);
    const shelf = current >= 0 ? mainShelf(items[current]) : null;
    if (shelf) {
      const column = items.filter((item) => mainShelf(item) === shelf).indexOf(items[current]);
      let next = current + direction;
      while (next >= 0 && next < items.length && mainShelf(items[next]) === shelf) next += direction;
      if (next < 0 || next >= items.length) {
        flash("No more shelves or tracks in that direction.");
        return;
      }
      const nextShelf = mainShelf(items[next]);
      if (nextShelf) {
        const nextItems = items.filter((item) => mainShelf(item) === nextShelf);
        const target = nextItems[Math.min(column, nextItems.length - 1)];
        select(target, items.indexOf(target), items.length, "main");
      } else {
        select(items[next], next, items.length, "main");
      }
      return;
    }
    const next = current < 0
      ? (direction > 0 ? 0 : items.length - 1)
      : Math.max(0, Math.min(items.length - 1, current + direction));
    select(items[next], next, items.length, "main");
  }

  function moveShelfSelection(direction) {
    if (!revalidateCurrentSelection("main")) return true;
    const shelf = mainShelf(selected);
    if (!shelf) return false;
    const items = mainItems();
    const shelfItems = items.filter((item) => mainShelf(item) === shelf);
    const column = shelfItems.indexOf(selected);
    if (direction < 0 && column === 0) return false; // h exits to the library.
    const next = column + direction;
    if (next >= shelfItems.length) {
      flash("End of this shelf; use j/k to change shelves.");
    } else {
      const target = shelfItems[next];
      select(target, items.indexOf(target), items.length, "main");
    }
    return true;
  }

  function moveSidebarSelection(direction) {
    const items = sidebarItems();
    if (items.length === 0) {
      flash("The Spotify sidebar is still loading.");
      return;
    }
    const current = rememberedIndex(items, lastSidebarSelection, lastSidebarIdentity);
    const next = current < 0
      ? (direction > 0 ? 0 : items.length - 1)
      : Math.max(0, Math.min(items.length - 1, current + direction));
    select(items[next], next, items.length, "sidebar");
  }

  function moveMenuSelection(direction) {
    const menu = menuForSelection();
    const items = actionMenuItems(menu);
    if (items.length === 0) {
      if (visible(menu)) {
        clearSelection();
        pane = "menu";
        focusActionMenu(menu);
        flash("This action menu has no visible choices yet.");
      } else {
        restoreMenuOrigin();
      }
      return;
    }
    const current = items.indexOf(lastMenuSelection);
    const next = current < 0
      ? (direction > 0 ? 0 : items.length - 1)
      : (current + direction + items.length) % items.length;
    select(items[next], next, items.length, "menu");
  }

  function selectFirstActionMenuItem(menu = menuForSelection()) {
    const items = actionMenuItems(menu);
    if (items.length > 0) {
      const remembered = items.indexOf(lastMenuSelection);
      const index = remembered >= 0 ? remembered : 0;
      return select(items[index], index, items.length, "menu");
    }
    return false;
  }

  function actionSignatures(items) {
    return items.map((item) => [
      item.getAttribute("role") || "",
      elementLabel(item),
      item.getAttribute("data-testid") || (item.id.startsWith("spotify-vim-menu-item-") ? "" : item.id) || "",
      item.querySelector("a[href]")?.getAttribute("href") || ""
    ].join("\u0001"));
  }

  function actionSetChanged(previousSignatures, menu) {
    const next = actionSignatures(actionMenuItems(menu));
    return next.length !== previousSignatures.length || next.some((signature, index) => signature !== previousSignatures[index]);
  }

  function waitForActionMenu(previousMenu = null, previousSignatures = [], timeout = 1200, onShell = null) {
    let reportedShell = null;
    const changedMenu = () => {
      const current = activeActionMenu();
      if (!current) return null;
      const changed = current !== previousMenu || actionSetChanged(previousSignatures, current);
      if (!changed) return null;
      if (menuIsReady(current)) return current;
      if (current !== reportedShell) {
        reportedShell = current;
        onShell?.(current);
      }
      return null;
    };

    const current = changedMenu();
    if (current) return Promise.resolve(current);

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const next = changedMenu();
        if (next) finish(next);
      });
      const timer = setTimeout(() => finish(changedMenu()), timeout);
      const finish = (menu) => {
        clearTimeout(timer);
        observer.disconnect();
        resolve(menu);
      };
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: [
          "aria-hidden", "class", "hidden", "style", "aria-label", "aria-labelledby",
          "role", "data-testid", "aria-disabled", "type", "placeholder"
        ]
      });
    });
  }

  function waitForActionMenusClosed(timeout = 180) {
    if (!activeActionMenu()) return Promise.resolve(true);

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (!activeActionMenu()) finish(true);
      });
      const timer = setTimeout(() => finish(!activeActionMenu()), timeout);
      const finish = (closed) => {
        clearTimeout(timer);
        observer.disconnect();
        resolve(closed);
      };
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-hidden", "class", "hidden", "style"]
      });
    });
  }

  function retainMenuShell(operation, menu, message) {
    if (!(menu instanceof HTMLElement) || !operationIsCurrent(operation) || !setOperationMenu(operation, menu)) {
      return false;
    }
    clearSelection();
    pane = "menu";
    lastMenuSelection = null;
    lastMenuIdentity = null;
    focusActionMenu(menu);
    flash(message);
    return true;
  }

  function moreOptionsButton(item) {
    const row = item.closest('[role="row"]');
    const gridCell = item.closest('[role="gridcell"]');
    if (!row && !gridCell) {
      const local = item.querySelector('button[data-testid="more-button"], button[aria-haspopup="menu"]');
      if (local) return local;
    }
    const scope = row || gridCell || item.parentElement;
    if (!(scope instanceof HTMLElement)) return null;
    return scope.querySelector('button[data-testid="more-button"], button[aria-haspopup="menu"]');
  }

  async function openActions(target = selected) {
    if (!(target instanceof HTMLElement) || !visible(target) || pane === "menu") {
      flash("Select a library item or track first.");
      return;
    }

    const origin = captureMenuOrigin(target);
    const operation = beginOperation(origin);
    operation.awaitingMenu = true;
    menuOriginPane = origin.pane;
    menuOriginSelection = origin.selection;
    menuOriginActionTarget = origin.actionTarget;
    lastMenuSelection = null;

    operation.preExistingMenus = new Set([...document.querySelectorAll('[role="menu"]')].filter(visible));
    operation.preOpenMenu = activeActionMenu();
    const existingMenu = operation.preOpenMenu;
    const existingItems = actionMenuItems(existingMenu);
    const existingSignatures = actionSignatures(existingItems);
    const more = moreOptionsButton(target);
    if (visible(more)) {
      more.click();
    } else {
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 2,
        buttons: 2,
        clientX: rect.left + Math.min(20, rect.width / 2),
        clientY: rect.top + Math.min(20, rect.height / 2)
      }));
    }

    const menu = await waitForActionMenu(existingMenu, existingSignatures, 1200, (shell) => {
      if (!operationIsCurrent(operation) || operation.preExistingMenus.has(shell) ||
        (operation.menu && operation.menu !== shell)) return;
      retainMenuShell(operation, shell, "Action menu is still loading choices.");
    });
    if (!operationIsCurrent(operation)) return;
    if (!(menu instanceof HTMLElement)) {
      const shell = activeActionMenu();
      if (shell instanceof HTMLElement && !operation.preExistingMenus.has(shell) &&
        (!operation.menu || operation.menu === shell) &&
        retainMenuShell(operation, shell, "Action menu is still loading choices.")) {
        return;
      }
    }
    const invalidMenu = !(menu instanceof HTMLElement) || operation.preExistingMenus.has(menu) ||
      (operation.menu && operation.menu !== menu);
    if (invalidMenu || !setOperationMenu(operation, menu)) {
      operation.awaitingMenu = false;
      supersedeOperations();
      flash("Spotify did not open an action menu for this item.");
      return;
    }
    if (!selectFirstActionMenuItem(menu)) {
      if (localActionMenuSearch(menu) && retainMenuShell(operation, menu, "Action menu search is ready.")) return;
      supersedeOperations();
      flash("Spotify did not open an action menu for this item.");
    } else {
      operation.menuItem = selected;
    }
  }

  function openNowPlayingActions() {
    const widget = nowPlayingWidget();
    if (!widget) {
      flash("No currently playing track or playlist is available.");
      return;
    }
    const contextItem = widget.querySelector([
      '[data-testid="context-item-link"]',
      '[data-testid="context-item-info-title"] a',
      'a[href*="/track/"]',
      'a[href*="/episode/"]',
      'a[href*="/playlist/"]',
      'a[href*="/album/"]'
    ].join(", "));
    openActions(contextItem instanceof HTMLElement && visible(contextItem) ? contextItem : widget);
  }

  function activateMenuItem() {
    const previousMenu = menuForSelection();
    const adoptedFocusedItem = adoptFocusedMenuItem(previousMenu);
    if (!adoptedFocusedItem && !revalidateCurrentSelection("menu")) return;
    if (!revalidateCurrentSelection("menu")) return;
    if (!(previousMenu instanceof HTMLElement) || selected?.closest('[role="menu"]') !== previousMenu) return;
    const previousItems = actionMenuItems(previousMenu);
    const previousSignatures = actionSignatures(previousItems);
    const previousSelection = selected;
    const operation = beginOperation(rememberedMenuOrigin());
    setOperationMenu(operation, previousMenu, previousSelection);
    const opensSubmenu = previousSelection.hasAttribute("aria-expanded");

    if (opensSubmenu) {
      operation.allowMenuTransition = true;
      // Spotify exposes submenu entries via aria-expanded and opens them on
      // deliberate focus. Keeping focus out during j/k avoids opening them
      // merely because the highlight passed over the row.
      if (document.activeElement === previousSelection) previousSelection.blur();
      previousSelection.focus({ preventScroll: true });
      waitForActionMenu(previousMenu, previousSignatures, 1200, (shell) => {
        if (operationIsCurrent(operation) && (shell === previousMenu || shell === operation.menu || operation.allowMenuTransition)) {
          operation.sawTransitionShell = true;
          retainMenuShell(operation, shell, "Submenu is still loading choices.");
        }
      }).then((nextMenu) => {
        if (!operationIsCurrent(operation)) return;
        const changedInPlace = nextMenu === previousMenu && actionSetChanged(previousSignatures, nextMenu);
        if (!nextMenu || (nextMenu === previousMenu && !changedInPlace)) {
          const shell = activeActionMenu();
          if (shell instanceof HTMLElement && (shell !== previousMenu || operation.sawTransitionShell) &&
            (shell === previousMenu || shell === operation.menu || operation.allowMenuTransition) &&
            retainMenuShell(operation, shell, "Submenu is still loading choices.")) return;
          clearSelection();
          pane = "menu";
          focusActionMenu(previousMenu);
          supersedeOperations();
          flash("Spotify did not open this submenu.");
          return;
        }
        lastMenuSelection = null;
        if (!setOperationMenu(operation, nextMenu)) return;
        if (selectFirstActionMenuItem(nextMenu)) operation.menuItem = selected;
        else if (localActionMenuSearch(nextMenu)) retainMenuShell(operation, nextMenu, "Submenu search is ready.");
        else {
          clearSelection();
          pane = "menu";
          focusActionMenu(nextMenu);
          supersedeOperations();
          flash("Spotify did not open this submenu.");
        }
      });
      return;
    }

    previousSelection.click();
    setTimeout(() => {
      if (!operationIsCurrent(operation)) return;
      if (activeActionMenu() && activeActionMenu() !== previousMenu) return;
      if (visible(previousMenu)) {
        if (!menuOwnershipIntact(previousMenu)) {
          relinquishMenuSelection();
          return;
        }
        const focus = document.activeElement;
        const focusedItem = focus instanceof Element
          ? focus.closest('[role="menuitem"], [role="option"]')
          : null;
        if (!operationOwnsMenu(operation, previousMenu) ||
          (focusedItem && focusedItem !== previousSelection) ||
          (focus !== previousMenu && focus !== previousSelection)) return;
        const items = actionMenuItems(previousMenu);
        const index = items.indexOf(previousSelection);
        if (index >= 0) select(previousSelection, index, items.length, "menu");
        return;
      }
      // An action may replace its menu with a dialog or a follow-up menu. It
      // now owns focus/keyboard handling; never close or restore behind it.
      if (activeActionMenu() || !restoreIsSafe(operation)) return;
      restoreMenuOrigin(operation.origin);
    }, 150);
  }

  function restoreMenuOrigin(origin = { pane: menuOriginPane, selection: menuOriginSelection }) {
    const originPane = origin.pane;
    const originSelection = origin.selection;
    const items = originPane === "sidebar" ? sidebarItems() : mainItems();
    const identity = originSelection
      ? (originPane === "sidebar" ? lastSidebarIdentity : lastMainIdentity)
      : null;
    const index = rememberedIndex(items, originSelection, identity);

    clearSelection();
    pane = originPane;
    lastMenuSelection = null;

    if (index >= 0) {
      select(items[index], index, items.length, originPane);
    } else {
      flash("Action menu closed.");
    }
  }

  function forwardEscapeToSpotify() {
    const target = document.activeElement instanceof Element ? document.activeElement : document.body;
    if (!target) return;
    forwardingMenuEscape = true;
    target.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true
    }));
    forwardingMenuEscape = false;
  }

  async function closeActionMenus(forwardEscape) {
    const origin = rememberedMenuOrigin();
    const operation = beginOperation(origin);
    setOperationMenu(operation, menuForSelection(), selected);
    clearSelection();
    lastMenuSelection = null;
    if (forwardEscape) forwardEscapeToSpotify();

    if (await waitForActionMenusClosed()) {
      if (operationIsCurrent(operation) && restoreIsSafe(operation)) restoreMenuOrigin(origin);
      return;
    }

    if (!operationIsCurrent(operation)) return;
    if (!operationOwnsMenu(operation)) return;
    const more = moreOptionsButton(origin.actionTarget);
    if (more instanceof HTMLElement) more.click();
    if (await waitForActionMenusClosed(320)) {
      if (operationIsCurrent(operation) && restoreIsSafe(operation)) restoreMenuOrigin(origin);
      return;
    }

    if (!operationOwnsMenu(operation)) return;

    // Never return keyboard ownership to the sidebar/main pane while a Spotify
    // portal is still open. That was the cause of menu keystrokes appearing to
    // jump back to Your Library when Spotify ignored the first close request.
    pane = "menu";
    if (!selectFirstActionMenuItem(activeActionMenu())) {
      focusActionMenu(activeActionMenu());
    }
    flash("Spotify kept the action menu open; press Esc again.");
  }

  function focusPane(nextPane) {
    if (nextPane === "sidebar") {
      const items = sidebarItems();
      if (items.length === 0) {
        flash("The Spotify sidebar is still loading.");
        return;
      }
      const remembered = rememberedIndex(items, lastSidebarSelection, lastSidebarIdentity);
      const current = items.findIndex((item) =>
        item.matches('[aria-current="page"], [aria-selected="true"]') ||
        Boolean(item.closest('[aria-current="page"], [aria-selected="true"]'))
      );
      const index = remembered >= 0 ? remembered : Math.max(0, current);
      select(items[index], index, items.length, "sidebar");
      return;
    }

    const items = mainItems();
    if (items.length === 0) {
      pane = "main";
      clearSelection();
      document.querySelector("main")?.focus({ preventScroll: true });
      flash("Main content — no cards or playable tracks are visible yet.");
      return;
    }
    const index = Math.max(0, rememberedIndex(items, lastMainSelection, lastMainIdentity));
    select(items[index], index, items.length, "main");
  }

  function focusSearch() {
    const search = document.querySelector(
      'input[role="combobox"], input[data-testid="search-input"], [role="combobox"] input'
    );
    if (!(search instanceof HTMLElement)) {
      flash("Search is still loading. Try / again in a moment.");
      return;
    }
    clearSelection();
    pane = "main";
    search.focus({ preventScroll: true });
    flash("Search — type a query, then Enter.");
  }

  function pageScrollContainer() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return document.scrollingElement;
    let container = selectedIsUsable() ? selected.parentElement : main;
    while (container && container !== document.body) {
      const style = getComputedStyle(container);
      if (container.scrollHeight > container.clientHeight && /(auto|scroll)/.test(style.overflowY)) {
        return container;
      }
      container = container.parentElement;
    }
    const descendants = [main, ...main.querySelectorAll("*")];
    const scrollable = descendants.find((candidate) => {
      if (!(candidate instanceof HTMLElement)) return false;
      const style = getComputedStyle(candidate);
      return candidate.scrollHeight > candidate.clientHeight && /(auto|scroll)/.test(style.overflowY);
    });
    if (scrollable) return scrollable;
    return document.scrollingElement;
  }

  function scrollPage(position) {
    const container = pageScrollContainer();
    if (!container) return;
    container.scrollTo({
      top: position === "top" ? 0 : container.scrollHeight,
      behavior: smoothBehavior()
    });
    flash(position === "top" ? "Top of page." : "Bottom of page.", 1000);
  }

  function clearPendingG() {
    pendingG = false;
    clearTimeout(pendingGTimer);
    pendingGTimer = 0;
  }

  function startPendingG() {
    clearPendingG();
    pendingG = true;
    pendingGTimer = setTimeout(clearPendingG, 700);
  }

  document.addEventListener("focusin", (event) => {
    const focus = event.target;
    if (cardFocusHandoff) {
      const { source, target } = cardFocusHandoff;
      if (source !== selected || unavailableNativeContext(focus)) {
        clearCardFocusHandoff();
      } else if (!target && focus instanceof Element && focus !== source) {
        // Spotify's carousel can move focus to its first row after we choose
        // another column. Admit only the immediate same-grid handoff.
        if (focus.matches('[role="row"], [role="grid"]') &&
          focus.closest('[role="grid"]') === source.closest('[role="grid"]')) {
          cardFocusHandoff.target = focus;
          clearTimeout(cardFocusTimer);
          cardFocusTimer = 0;
        } else clearCardFocusHandoff();
      } else if (target && focus !== target && focus !== source) {
        clearCardFocusHandoff();
      }
    }
    if (staleSidebarFocus) {
      if (staleSidebarFocus.source !== selected || unavailableNativeContext(focus)) {
        clearStaleSidebarFocus();
      } else if (!staleSidebarFocus.target && focus instanceof Element && focus !== selected) {
        if (nativeInteractive(focus)) {
          staleSidebarFocus.target = focus;
          // The timeout only bounds acquisition of Spotify's post-click focus.
          // Once that exact target is known, keep it until focus or ownership
          // changes rather than expiring an otherwise valid recovery handoff.
          clearTimeout(staleSidebarTimer);
          staleSidebarTimer = 0;
        }
        else clearStaleSidebarFocus();
      } else if (staleSidebarFocus.target && focus !== staleSidebarFocus.target) {
        clearStaleSidebarFocus();
      }
    }
    if (currentOperation && !operationAllowsFocus(currentOperation, focus)) {
      // While an action portal is still mounting, foreign native focus takes
      // ownership rather than leaving the origin row visually selected behind it.
      if (currentOperation.awaitingMenu) clearSelection();
      supersedeOperations();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (forwardingMenuEscape) return;
    if (event.isComposing || event.ctrlKey || event.metaKey) return;
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      event.stopImmediatePropagation();
      enabled = !enabled;
      supersedeOperations();
      clearStaleSidebarFocus();
      clearPendingG();
      clearSelection();
      if (!enabled) closeHelp(true);
      flash(`Spotify Vim Navigation ${enabled ? "enabled" : "disabled"}.`, 1600);
      return;
    }
    const help = document.getElementById(helpId);
    if (help && (event.target === help || (event.target instanceof Node && help.contains(event.target)))) {
      event.stopImmediatePropagation();
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        closeHelp();
      } else if (["j", "k", "a", "l", "h", "g", "G", "H", "L", "/"].includes(event.key)) {
        event.preventDefault();
      }
      return;
    }
    if (event.defaultPrevented || event.altKey || !enabled) return;

    if (pane === "menu" && event.key === "Escape" && isEditable(event.target)) {
      const menu = event.target instanceof Element ? event.target.closest('[role="menu"]') : null;
      const ownsSearch = ownedMenuSearch?.search === event.target && ownedMenuSearch.menu === menuForSelection();
      if ((menu && menu === menuForSelection()) || ownsSearch) {
        event.preventDefault();
        event.stopPropagation();
        clearPendingG();
        const ownedMenu = ownsSearch ? ownedMenuSearch.menu : menu;
        const items = actionMenuItems(ownedMenu);
        const remembered = items.indexOf(lastMenuSelection);
        const index = remembered >= 0 ? remembered : 0;
        if (items.length > 0) select(items[index], index, items.length, "menu");
        else focusActionMenu(ownedMenu);
        clearOwnedMenuSearch();
        return;
      }
    }

    if (isEditable(event.target)) return;
    reconcilePane();

    // Spotify moves DOM focus to native controls such as "Your Library" when
    // a library item opens. Limit the recovery to that exact extension-owned
    // handoff; dialogs and unrelated native controls retain their own keys.
    if (pane !== "menu" && (event.key === "h" || event.key === "l")) {
      if (!canHandleShortcut(event) && !ownsStaleSidebarFocus()) return;
      event.preventDefault();
      clearStaleSidebarFocus();
      supersedeOperations();
      clearPendingG();
      if (pane === "main" && selectedIsUsable() && mainShelf(selected) &&
        moveShelfSelection(event.key === "h" ? -1 : 1)) return;
      focusPane(event.key === "h" ? "sidebar" : "main");
      return;
    }

    if (event.key === "A" && event.shiftKey) {
      if (!canHandleShortcut(event)) return;
      event.preventDefault();
      clearPendingG();
      openNowPlayingActions();
      return;
    }

    if (!canHandleShortcut(event)) return;

    if (event.key === "Escape") {
      supersedeOperations();
      if (pane === "menu") {
        clearPendingG();
        // Let the real Escape reach the focused Spotify menu. If Spotify's
        // current experiment does not close it, toggle the origin's menu
        // button as a fallback and then restore the originating selection.
        closeActionMenus(false);
        return;
      }
      if (selected) {
        event.preventDefault();
        clearSelection();
        flash("Selection cleared.");
      }
      clearPendingG();
      return;
    }

    if (event.key === "j" || event.key === "k") {
      event.preventDefault();
      const pendingShell = pane === "menu" && currentOperation?.menu === activeActionMenu() &&
        !menuIsReady(activeActionMenu());
      if (!pendingShell) supersedeOperations();
      clearStaleSidebarFocus();
      clearPendingG();
      const direction = event.key === "j" ? 1 : -1;
      if (pane === "sidebar") moveSidebarSelection(direction);
      else if (pane === "menu") moveMenuSelection(direction);
      else moveMainSelection(direction);
      return;
    }

    if (pane === "menu" && event.key === "h") {
      event.preventDefault();
      clearPendingG();
      closeActionMenus(true);
      return;
    }

    if (pane === "menu" && (event.key === "l" || event.key === "Enter") && selected) {
      // A real focused menu item wins over a stale visual highlight. A focused
      // control outside the owned menu never reaches this branch.
      if (!menuOwnershipIntact()) {
        relinquishMenuSelection();
        return;
      }
      if (!adoptFocusedMenuItem(menuForSelection()) && menuFocusState().kind !== "container") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearPendingG();
      activateMenuItem();
      return;
    }

    if (pane === "main" && mainShelf(selected) &&
      (event.key === "Enter" || event.key === " " || event.key === "Spacebar")) {
      if (!revalidateCurrentSelection("main")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      // Spotify may have focused the first row of the grid rather than our
      // highlighted card. A native Enter there would open the wrong card.
      if (event.key === "Enter" && document.activeElement !== selected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selected.click();
        return;
      }
    }

    if (event.key === "Enter" && pane === "sidebar" && selected) {
      // Library rows are ARIA buttons rather than native buttons. Activating
      // the selected row here makes Enter open it reliably; playback remains
      // a real keyboard event on Spotify's native controls in the main pane.
      event.preventDefault();
      event.stopImmediatePropagation();
      clearPendingG();
      if (!revalidateCurrentSelection("sidebar")) return;
      clearStaleSidebarFocus();
      staleSidebarFocus = { source: selected, target: null };
      staleSidebarTimer = setTimeout(clearStaleSidebarFocus, 500);
      selected.click();
      return;
    }

    if (event.key === "a") {
      event.preventDefault();
      clearPendingG();
      if ((pane === "main" || pane === "sidebar") && !revalidateCurrentSelection(pane)) return;
      openActions();
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      supersedeOperations();
      clearStaleSidebarFocus();
      clearPendingG();
      if (pane === "menu") focusActionMenuSearch();
      else focusSearch();
      return;
    }

    if (event.key === "g") {
      event.preventDefault();
      if (event.repeat) return;
      if (pendingG) {
        clearPendingG();
        scrollPage("top");
      } else {
        startPendingG();
      }
      return;
    }

    if (event.key === "G" && event.shiftKey) {
      event.preventDefault();
      clearPendingG();
      scrollPage("bottom");
      return;
    }

    if (event.key === "H" && event.shiftKey) {
      event.preventDefault();
      supersedeOperations();
      history.back();
      return;
    }

    if (event.key === "L" && event.shiftKey) {
      event.preventDefault();
      supersedeOperations();
      history.forward();
      return;
    }

    if (event.key === "?") {
      event.preventDefault();
      event.stopImmediatePropagation();
      openHelp();
    }
  }, true);
})();
