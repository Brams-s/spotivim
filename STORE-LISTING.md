# Chrome Web Store listing: Spotify Vim Navigation 0.1.0

## Name

Spotify Vim Navigation

## Summary

Keyboard-first navigation for visible Spotify Web library rows, tracks, and action menus.

## Description

Spotify Vim Navigation adds a focused Vim-style keyboard layer to the Spotify
Web Player. Use `h`/`l` to choose the visible library or main-content pane,
`j`/`k` to move a selection, and `Enter` to open the selected item. Use `a` to
open Spotify's action menu, `/` to focus search, `gg`/`G` to scroll, and `H`/`L`
to move through browser history. Press `?` in Spotify to see the full key list.

The extension runs only on `open.spotify.com`. It locally reads visible Spotify
page content so it can identify navigable UI, adds transient selection and
status UI, and dispatches page click, context-menu, and keyboard events when a
shortcut is used. It does not collect, transmit, sell, share, or store data;
it has no analytics, remote code, background worker, or network requests.

Spotify controls its web UI and can change it without notice. This release is
tested first against English Spotify Web and does not promise compatibility
with every Spotify UI experiment or locale. It does not provide playback
hotkeys, volume control, Connect-device control, background playback, or
desktop status-bar integration.

Spotify Vim Navigation is independent and is not affiliated with, endorsed by,
or sponsored by Spotify. Spotify is a trademark of Spotify AB.

## Permission rationale

**Site access: `https://open.spotify.com/*`** — required to locally read
Spotify's visible UI and respond to keyboard shortcuts on that site. It is not
used to access any other website. No additional permissions are requested.

## Public URLs

- Homepage: <https://github.com/Brams-s/spotivim>
- Support: <https://github.com/Brams-s/spotivim/issues>
- Privacy policy: <https://github.com/Brams-s/spotivim/blob/main/PRIVACY.md>

The repository is public. The homepage, support, and privacy-policy URLs have
all been verified to return anonymous HTTP 200 responses.

## Privacy practices answers

Use these answers in the Chrome Web Store privacy-practices form:

- **User data collection:** No. No user-data category is collected.
- **User data transmission, sale, or sharing:** No.
- **User data storage:** No.
- **Analytics or tracking:** No.
- **Remote code or network requests:** No.
- **Site access explanation:** The extension runs only on
  `https://open.spotify.com/*` and locally reads visible Spotify page content
  to provide keyboard navigation. It does not transmit that content.

## Reviewer test instructions

1. Install the submitted extension, then open or refresh
   `https://open.spotify.com/`.
2. Click a non-editable area of the Spotify page. Press `h` or `l`, then `j` or
   `k`, to show the temporary selection. Press `Enter` to activate it.
3. Select a visible track, press `a` to open Spotify's action menu, use `j`/`k`
   to move through actions, and press `Enter` or `Esc`.
4. Press `?` to open the in-page key reference. Test `/`, `gg`, `G`, `H`, `L`,
   and `Alt+Shift+V` as desired.

The extension does not require an extension account or setup beyond its Spotify
site access. Spotify UI availability and available content can vary by region
and signed-in state.

## Assets

- Extension icons: `icons/` (`16`, `32`, `48`, and `128` pixels)
- Small promotional image: `store-assets/promo-440x280.png`
- Required live-product screenshot: capture it during the final manual Spotify
  test using `store-assets/live-screenshot-capture-guide.md`. The screenshot is
  not yet included in the repository.
