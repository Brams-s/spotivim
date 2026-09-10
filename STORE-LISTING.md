# Store listing draft

## Name

Spotify Vim Navigation

## Summary

Keyboard-first navigation for visible Spotify Web library rows, tracks, and action menus.

## Description

Spotify Vim Navigation adds a small, focused Vim-style keyboard layer to the
Spotify Web Player. Move between the library and main content, select visible
tracks, open Spotify's action menu, and choose its actions without reaching
for a mouse.

The extension works only on `open.spotify.com`. It has no accounts, analytics,
telemetry, remote code, or storage; see `PRIVACY.md` for the complete data-use
statement. This release candidate intentionally supports only the browser
navigation layer. Desktop media keys, background playback, and status-bar
integrations are separate, operating-system-specific features and are not part
of this extension.

Spotify Vim Navigation is independent and is not affiliated with, endorsed by,
or sponsored by Spotify. Spotify is a trademark of Spotify AB.

## Permission rationale

`https://open.spotify.com/*` is required so the extension can read Spotify's
visible UI and respond to the keyboard on that site. No other sites are
matched, and no additional permissions are requested.

## Support

The public repository URL and issue tracker need to be inserted before store
submission.

## Assets

- Extension icons: `icons/` (`16`, `32`, `48`, and `128` pixels)
- Small promotional image: `store-assets/promo-440x280.png`
- Required live-product screenshot: capture during the final manual Spotify test
