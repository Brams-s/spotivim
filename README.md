# Spotify Vim Navigation

Keyboard-first navigation for the [Spotify Web Player](https://open.spotify.com).

> Release candidate `0.1.0-rc.1`: use it for testing, not as a promise of
> compatibility with every Spotify UI experiment or locale.

## Install locally

1. Open `chrome://extensions` (or `chromium://extensions`).
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this directory.
4. Open or refresh `https://open.spotify.com`.

When this extension is launched through the included Omarchy Spotify launcher,
changes to its manifest, script, or stylesheet are fingerprinted. The launcher
restarts only Spotify after an update so Chromium cannot keep an older unpacked
build cached.

## Keys

| Key | Action |
| --- | --- |
| `h` / `l` | Select the visible library / main-content pane |
| `j` / `k` | Move selection down / up |
| `Enter` | Open library item or choose an action-menu item |
| `a` | Open Spotify's action menu for the selection |
| `/` | Focus Spotify search |
| `gg` / `G` | Scroll main content to top / bottom |
| `H` / `L` | Browser history back / forward |
| `Esc` | Clear extension selection or close Spotify's action menu |
| `?` | Show this in-page help |
| `Alt+Shift+V` | Toggle the extension on/off for the current tab |

Inside an action menu, `j`/`k` wraps through available actions, `l` or `Enter`
chooses the highlighted action or enters its submenu, and `h` or `Esc` closes
the menu and restores the originating item. In an **Add to playlist** submenu,
`/` focuses its playlist search. Type the query, press `Esc` to return to the
filtered results, then use `j`/`k` and `Enter` normally.

The extension avoids editable fields and ordinary focused controls unless it
owns the current selection. `Alt+Shift+V` is the escape hatch if a Spotify UI
change conflicts with a shortcut. The toggle resets when the page reloads.

## Scope and limitations

- It navigates currently visible items; Spotify virtualizes long lists, so
  newly rendered rows may need a fresh `j`/`k` selection.
- Spotify controls its UI and can change it without notice. The extension is
  tested first against English Spotify Web; locale coverage is a release-gate
  test item, not a guarantee in this RC.
- It does not provide playback hotkeys, volume control, Connect-device control,
  background playback, or desktop status-bar integration.
- No Spotify password, OAuth token, or account data is requested or stored.

## Privacy and licensing

Read [PRIVACY.md](PRIVACY.md) for the data-use statement. Licensed under the
[MIT License](LICENSE).

Spotify Vim Navigation is an independent project and is not affiliated with,
endorsed by, or sponsored by Spotify. Spotify is a trademark of Spotify AB.

## Release checks

Run the complete fixture-backed test suite before packaging:

```bash
npm test
```

The browser test requires `agent-browser`; the extension itself has no runtime
dependencies.

An optional signed-out smoke test checks the current live Spotify DOM and never
uses your Spotify profile:

```bash
npm run test:live
```

Build a clean upload archive after validation:

```bash
npm run package
```

Then perform the manual browser matrix in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).
