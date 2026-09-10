(() => {
  "use strict";

  if (globalThis.__spotifyVimNavigationInstalled) return;
  globalThis.__spotifyVimNavigationInstalled = true;

  const selectedClass = "spotify-vim-selected-play";
  const statusId = "spotify-vim-navigation-status";
  let selected = null;
  let pane = "main";
  let lastMainSelection = null;
  let lastMainIdentity = null;
  let lastSidebarSelection = null;
  let lastSidebarIdentity = null;
  let lastMenuSelection = null;
  let menuOriginPane = "main";
  let menuOriginSelection = null;
  let forwardingMenuEscape = false;
  let pendingG = false;
  let pendingGTimer = 0;
  let statusTimer = 0;
  let enabled = true;

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

  function playableButtons() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return [];

    // Spotify's older rows marked their play control with data-testid. Current
    // grid rows omit that marker, but consistently place the play control in
    // the first role=gridcell. Keep the old selector as a compatibility path.
    return [...main.querySelectorAll('[role="row"]')]
      .map((row) => row.querySelector('button[data-testid="play-button"]') ||
        row.querySelector('[role="gridcell"] button'))
      .filter(visible);
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
    const local = menu instanceof HTMLElement ? [...menu.querySelectorAll(selector)] : [];
    const localSearch = local.find(visible);
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
    statusTimer = setTimeout(() => { status.dataset.visible = "false"; }, duration);
  }

  function clearSelection() {
    selected?.classList.remove(selectedClass);
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
      "[role=listbox]", "[role=dialog]"
    ].join(", ")));
  }

  function selectionOwnsEvent(event) {
    if (!selectedIsUsable()) return false;
    return [event.target, document.activeElement].some((element) =>
      element instanceof Node && (element === selected || selected.contains(element))
    );
  }

  function canHandleShortcut(event) {
    if (pane === "menu" && activeActionMenu()) return true;
    if (selectionOwnsEvent(event)) return true;
    return !nativeInteractive(event.target) && !nativeInteractive(document.activeElement);
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
    const uri = scope.getAttribute("data-uri") || scope.querySelector("[data-uri]")?.getAttribute("data-uri");
    if (uri) return uri;
    const link = scope.querySelector('a[href*="/track/"], a[href*="/album/"], a[href*="/artist/"], a[href*="/playlist/"]');
    if (link instanceof HTMLAnchorElement) return link.href;
    return element.getAttribute("aria-label") || elementLabel(element);
  }

  function rememberedIndex(items, element, identity) {
    const connectedIndex = items.indexOf(element);
    if (connectedIndex >= 0) return connectedIndex;
    if (!identity) return -1;
    return items.findIndex((item) => elementIdentity(item) === identity);
  }

  function smoothBehavior() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function select(button, index, total, selectionPane) {
    if (!(button instanceof HTMLElement)) return false;
    clearSelection();
    selected = button;
    pane = selectionPane;
    if (pane === "sidebar") {
      lastSidebarSelection = button;
      lastSidebarIdentity = elementIdentity(button);
    }
    else if (pane === "menu") lastMenuSelection = button;
    else {
      lastMainSelection = button;
      lastMainIdentity = elementIdentity(button);
    }
    selected.classList.add(selectedClass);
    selected.scrollIntoView({ block: "center", inline: "nearest", behavior: smoothBehavior() });
    // Focusing Spotify menu items eagerly opens hover/focus submenus. Keep DOM
    // focus on the menu container while the extension highlights individual
    // actions, then focus an item only when the user deliberately enters it.
    if (pane === "menu") focusActionMenu(button.closest('[role="menu"]'));
    else selected.focus({ preventScroll: true });
    const label = elementLabel(selected);
    const title = pane === "sidebar" ? "Sidebar" : pane === "menu" ? "Actions" : "Main";
    const action = pane === "sidebar"
      ? "Enter opens"
      : pane === "menu"
        ? "j/k wrap · / playlist search · h/Esc close · l/Enter chooses"
        : "Enter or Space plays · a opens actions";
    flash(`${title} ${index + 1}/${total}: ${label} — ${action}`);
    return true;
  }

  function moveSelection(direction) {
    const buttons = playableButtons();
    if (buttons.length === 0) {
      flash("No playable tracks are visible yet.");
      return;
    }
    const current = rememberedIndex(buttons, lastMainSelection, lastMainIdentity);
    const next = current < 0
      ? (direction > 0 ? 0 : buttons.length - 1)
      : Math.max(0, Math.min(buttons.length - 1, current + direction));
    select(buttons[next], next, buttons.length, "main");
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

  function waitForActionMenu(previousMenu = null, previousItems = [], timeout = 1200) {
    const changedMenu = () => {
      const current = activeActionMenu();
      if (!current) return null;
      const currentItems = actionMenuItems(current);
      const itemsChanged = currentItems.length !== previousItems.length ||
        currentItems.some((item, index) => item !== previousItems[index]);
      return current !== previousMenu || itemsChanged ? current : null;
    };

    const current = changedMenu();
    if (current) return Promise.resolve(current);

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const next = changedMenu();
        if (next) finish(next);
      });
      const timer = setTimeout(() => finish(null), timeout);
      const finish = (menu) => {
        clearTimeout(timer);
        observer.disconnect();
        resolve(menu);
      };
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-hidden", "class", "hidden", "style"]
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

  function moreOptionsButton(item) {
    const row = item.closest('[role="row"]');
    const gridCell = item.closest('[role="gridcell"]');
    const scope = row || gridCell || item.parentElement;
    if (!(scope instanceof HTMLElement)) return null;
    return scope.querySelector('button[data-testid="more-button"], button[aria-haspopup="menu"]');
  }

  async function openActions() {
    if (!selectedIsUsable() || pane === "menu") {
      flash("Select a library item or track first.");
      return;
    }

    menuOriginPane = pane;
    menuOriginSelection = selected;
    lastMenuSelection = null;

    const existingMenu = activeActionMenu();
    const existingItems = actionMenuItems(existingMenu);
    const more = moreOptionsButton(selected);
    if (visible(more)) {
      more.click();
    } else {
      const rect = selected.getBoundingClientRect();
      selected.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 2,
        buttons: 2,
        clientX: rect.left + Math.min(20, rect.width / 2),
        clientY: rect.top + Math.min(20, rect.height / 2)
      }));
    }

    const menu = await waitForActionMenu(existingMenu, existingItems);
    if (!menu || !selectFirstActionMenuItem(menu)) {
      flash("Spotify did not open an action menu for this item.");
    }
  }

  function activateMenuItem() {
    if (!selectedIsUsable()) return;
    const previousMenu = menuForSelection();
    const previousItems = actionMenuItems(previousMenu);
    const previousSelection = selected;
    const opensSubmenu = previousSelection.hasAttribute("aria-expanded");

    if (opensSubmenu) {
      // Spotify exposes submenu entries via aria-expanded and opens them on
      // deliberate focus. Keeping focus out during j/k avoids opening them
      // merely because the highlight passed over the row.
      if (document.activeElement === previousSelection) previousSelection.blur();
      previousSelection.focus({ preventScroll: true });
      waitForActionMenu(previousMenu, previousItems).then((nextMenu) => {
        if (!nextMenu || nextMenu === previousMenu) {
          const items = actionMenuItems(previousMenu);
          const index = items.indexOf(previousSelection);
          if (index >= 0) select(previousSelection, index, items.length, "menu");
          flash("Spotify did not open this submenu.");
          return;
        }
        lastMenuSelection = null;
        selectFirstActionMenuItem(nextMenu);
      });
      return;
    }

    previousSelection.click();
    setTimeout(() => {
      if (visible(previousMenu)) {
        const items = actionMenuItems(previousMenu);
        const index = items.indexOf(previousSelection);
        if (index >= 0) select(previousSelection, index, items.length, "menu");
        return;
      }
      if (activeActionMenu()) closeActionMenus(true);
      else restoreMenuOrigin();
    }, 150);
  }

  function restoreMenuOrigin() {
    const originPane = menuOriginPane;
    const originSelection = menuOriginSelection;
    const identity = originPane === "sidebar" ? lastSidebarIdentity : lastMainIdentity;
    const items = originPane === "sidebar" ? sidebarItems() : playableButtons();
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
    clearSelection();
    lastMenuSelection = null;
    if (forwardEscape) forwardEscapeToSpotify();

    if (await waitForActionMenusClosed()) {
      restoreMenuOrigin();
      return;
    }

    const more = moreOptionsButton(menuOriginSelection);
    if (more instanceof HTMLElement) more.click();
    if (await waitForActionMenusClosed(320)) {
      restoreMenuOrigin();
      return;
    }

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

    const buttons = playableButtons();
    if (buttons.length === 0) {
      pane = "main";
      clearSelection();
      document.querySelector("main")?.focus({ preventScroll: true });
      flash("Main content — no playable tracks are visible yet.");
      return;
    }
    const index = Math.max(0, rememberedIndex(buttons, lastMainSelection, lastMainIdentity));
    select(buttons[index], index, buttons.length, "main");
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

  document.addEventListener("keydown", (event) => {
    if (forwardingMenuEscape) return;
    if (event.isComposing || event.ctrlKey || event.metaKey) return;
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      enabled = !enabled;
      clearPendingG();
      clearSelection();
      flash(`Spotify Vim Navigation ${enabled ? "enabled" : "disabled"}.`, 1600);
      return;
    }
    if (event.defaultPrevented || event.altKey || !enabled) return;

    if (pane === "menu" && event.key === "Escape" && isEditable(event.target)) {
      const menu = event.target instanceof Element
        ? event.target.closest('[role="menu"]') || activeActionMenu()
        : activeActionMenu();
      if (menu) {
        event.preventDefault();
        event.stopPropagation();
        clearPendingG();
        const items = actionMenuItems(menu);
        const remembered = items.indexOf(lastMenuSelection);
        const index = remembered >= 0 ? remembered : 0;
        if (items.length > 0) select(items[index], index, items.length, "menu");
        else focusActionMenu(menu);
        return;
      }
    }

    if (isEditable(event.target)) return;
    reconcilePane();

    // Spotify moves DOM focus to native controls such as "Your Library" when
    // a library item opens. h/l have no native control behavior, so keep pane
    // switching available even while that stale Spotify focus is present.
    if (pane !== "menu" && (event.key === "h" || event.key === "l")) {
      event.preventDefault();
      clearPendingG();
      focusPane(event.key === "h" ? "sidebar" : "main");
      return;
    }

    if (!canHandleShortcut(event)) return;

    if (event.key === "Escape") {
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
      clearPendingG();
      const direction = event.key === "j" ? 1 : -1;
      if (pane === "sidebar") moveSidebarSelection(direction);
      else if (pane === "menu") moveMenuSelection(direction);
      else moveSelection(direction);
      return;
    }

    if (pane === "menu" && event.key === "h") {
      event.preventDefault();
      clearPendingG();
      closeActionMenus(true);
      return;
    }

    if (pane === "menu" && (event.key === "l" || event.key === "Enter") && selected) {
      event.preventDefault();
      clearPendingG();
      activateMenuItem();
      return;
    }

    if (event.key === "Enter" && pane === "sidebar" && selected) {
      // Library rows are ARIA buttons rather than native buttons. Activating
      // the selected row here makes Enter open it reliably; playback remains
      // a real keyboard event on Spotify's native controls in the main pane.
      event.preventDefault();
      clearPendingG();
      selected.click();
      return;
    }

    if (event.key === "a") {
      event.preventDefault();
      clearPendingG();
      openActions();
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
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
      history.back();
      return;
    }

    if (event.key === "L" && event.shiftKey) {
      event.preventDefault();
      history.forward();
      return;
    }

    if (event.key === "?") {
      event.preventDefault();
      flash("h/l panes · j/k move · a actions · menus: j/k wrap, / search, h/Esc close, l/Enter choose · gg/G scroll · H/L history · Alt+Shift+V toggle", 7000);
    }
  }, true);
})();
