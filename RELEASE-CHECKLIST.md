# 0.1.0 release gate

Repository-proven static facts:

- [x] `manifest.json` is stable version `0.1.0` and has no RC `version_name`.
- [x] `scripts/package.sh` targets `spotify-vim-navigation-0.1.0.zip`.
- [x] Required icons and 440×280 promotional artwork are present.
- [x] Screenshot capture instructions exist at `store-assets/live-screenshot-capture-guide.md`.

Validation evidence:

- [x] `npm test` passed locally.
- [x] Stable release documentation is public, and the [Validate stable release](https://github.com/Brams-s/spotivim/actions/runs/35641080233) workflow passed, including archive upload.
- [x] `npm run test:live` passed against public signed-out Spotify.
- [x] `npm run package` created `dist/spotify-vim-navigation-0.1.0.zip` containing only `manifest.json`, `content.js`, `styles.css`, and the four icons.
- [x] An isolated Chromium session loaded the unpacked extension. `chrome://extensions` showed Spotify Vim Navigation enabled with no error button, and live Spotify reported extension version `0.1.0` with a working selection.

Manual browser checks (Chrome and Chromium):

- [x] Signed-in route rendering checked: Home, Search, public playlist, album, artist, and Liked Songs. Empty Queue redirected to Home; Podcasts redirected to a current genre route.
- [x] Signed-in non-destructive keyboard checks passed: main/sidebar selection; `j`/`k`; action menu and nested Add-to-playlist menu without choosing an action; playlist-menu `/` focus and `Esc` restoration; main `/` focus; `gg`/`G`; `?`; `Esc`; `Alt+Shift+V`; and sidebar `Enter` navigation.
- [x] Reduced-motion mode and `role=status` / `aria-live=polite` status messaging checked.
- [ ] `Shift+A` in a signed-in now-playing context. No now-playing context was available without starting playback; fixture coverage exists.
- [ ] `H`/`L` manual browser navigation. The driver history was unsuitable for this check.
- [ ] Loading/empty states and a long virtualized playlist after scroll/rerender.
- [ ] English plus two non-English Spotify UI locales.
- [ ] Slow menu opening and page rerenders.
- [ ] Full keyboard-only flow and screen-reader verification beyond the checked status-message attributes.
- [ ] Confirm no requests, storage entries, or permission prompts originate from the extension.

Store gate:

- [x] Add homepage, support, and privacy-policy URLs to `STORE-LISTING.md`.
- [x] `https://github.com/Brams-s/spotivim` is public; homepage, issues, and privacy-policy URLs returned anonymous HTTP 200 responses.
- [ ] Capture a real 1280×800 live-product screenshot using a dedicated sanitized signed-in account with the right panel closed. The signed-out candidate was rejected because of a persistent signup banner and status overlap.
- [ ] Complete the Chrome Web Store privacy-practices form.
- [ ] Check trademarks and store metadata one final time.
