# 0.1.0 release gate

Static checks:

- [ ] `npm test` passes locally and in CI.
- [ ] Load the unpacked extension in a clean Chromium/Chrome profile with no manifest warnings.
- [ ] Run `scripts/package.sh` to build an upload ZIP containing only extension runtime files.

Manual browser checks (Chrome and Chromium):

- [ ] Home, Search, playlist, album, artist, Liked Songs, Queue, and Podcasts pages.
- [ ] Library/main movement; `j`/`k`; `Enter`; `a` action menu; nested action menu; `/`; `gg`/`G`; `H`/`L`; `Esc`; toggle.
- [ ] Loading/empty states and a long virtualized playlist after scroll/rerender.
- [ ] English plus two non-English Spotify UI locales.
- [ ] Slow menu opening and page rerenders.
- [ ] Keyboard-only flow, screen-reader status messages, and reduced-motion preference.
- [ ] Confirm no requests, storage entries, or permission prompts originate from the extension.

Store gate:

- [ ] Add repository and support URLs to `STORE-LISTING.md`.
- [x] Prepare the required 440×280 promotional artwork.
- [ ] Capture the required 1280×800 or 640×400 live-product screenshot.
- [ ] Complete the Chrome Web Store privacy-practices form.
- [ ] Check trademarks and store metadata one final time.
