# Live product screenshot capture guide

The promotional image is an abstract feature graphic. It does not represent a
Spotify screen and should remain separate from the required live-product
screenshot.

## Capture specification

- **Canvas:** 1280 × 800 px, PNG, at 1× scale.
- **Frame:** crop to the page viewport only; exclude the browser toolbar,
  address bar, bookmarks, extensions menu, and operating-system chrome.
- **Page:** `https://open.spotify.com/` in a normal signed-in test account.
- **State:** load a library or playlist with at least five visible tracks; keep
  the left library pane, track rows, and bottom now-playing bar in view.
- **Extension state:** press `j` once with the pointer over a non-editable part
  of the page. The selected play control should show the extension's warm
  amber outline. Press `h` only if needed to show the sidebar selection instead.
  Do not leave a menu open unless the menu is the feature being demonstrated.
- **Composition:** leave useful breathing room around the selected row. Keep
  the product UI legible and make the amber selection outline the visual cue;
  do not add labels, fake keycaps, or overlays in an image editor.

## Privacy and accuracy checklist

- Use a dedicated account or a library made from public/demo content.
- Remove or replace personal names, profile photos, private playlist names,
  recently played items, notifications, and recommendation history before
  capture.
- Check the full frame for email addresses, account handles, share links,
  local file names, and browser-sync details. Redact only those private
  values, using solid blocks that do not cover the extension selection cue.
- Do not recreate Spotify UI, paste in a different session, or imply that the
  extension is made by or endorsed by Spotify.
- Confirm the visible amber outline and status message are produced by the
  installed extension, not by manual CSS or an image editor.

Save the final file as `store-assets/screenshot-live-1280x800.png` only after
the checks above pass. Until then, the abstract promotional image is the only
store asset that should be treated as ready for submission.
