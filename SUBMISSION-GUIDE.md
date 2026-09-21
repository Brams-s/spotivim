# Chrome Web Store submission guide: 0.1.0

Use `STORE-LISTING.md` as the copy-paste source for the listing, permission
rationale, privacy-practices answers, and reviewer instructions.

## Submission blockers

Do **not** submit until all of these are complete:

- [x] <https://github.com/Brams-s/spotivim> is public, and these URLs returned
  anonymous HTTP 200 responses:
  - <https://github.com/Brams-s/spotivim>
  - <https://github.com/Brams-s/spotivim/issues>
  - <https://github.com/Brams-s/spotivim/blob/main/PRIVACY.md>
- [ ] Current release documentation is committed and pushed, and GitHub Actions
  has passed. Until then, the public GitHub pages show the prior committed RC
  content.
- [ ] The signed-in manual browser matrix in `RELEASE-CHECKLIST.md` is complete.
- [ ] A real 1280×800 live-product screenshot has been captured using a
  dedicated sanitized signed-in account with the right panel closed. Follow
  `store-assets/live-screenshot-capture-guide.md`; the signed-out candidate was
  rejected because of a persistent signup banner and status overlap.

## Prerequisites

1. Register a Chrome Web Store developer account and pay the required developer
   registration fee.
2. Run `npm run package`; upload only
   `dist/spotify-vim-navigation-0.1.0.zip`.
3. Keep the package, test evidence, and remaining release gates recorded in
   `RELEASE-CHECKLIST.md`. CI is still pending for the current uncommitted
   changes.

## Dashboard steps

1. In the Chrome Web Store Developer Dashboard, select **New item** and upload
   `dist/spotify-vim-navigation-0.1.0.zip`.
2. On the Store listing tab, copy the name, summary, description, public URLs,
   permission rationale, and reviewer instructions from `STORE-LISTING.md`.
   Upload `store-assets/promo-440x280.png` and the real 1280×800 screenshot.
   Choose **Productivity**, **English**, **Public**, and **all regions**. Select
   **not mature** wherever the dashboard asks for mature-content status.
3. On the Privacy tab, state the single purpose: keyboard-first navigation of
   visible Spotify Web UI. For site access, use the `open.spotify.com`-only
   justification from `STORE-LISTING.md`. Declare no remote code and no
   collected data types. Complete the Limited Use certification and provide the
   privacy-policy URL from `STORE-LISTING.md`.
4. Add the reviewer test instructions from `STORE-LISTING.md` exactly, then
   save and preview every dashboard tab. Recheck the required URLs while signed
   out before selecting **Submit for review**.
5. After approval, publish immediately or use the dashboard's staged-release
   option if a controlled rollout is preferred.

Complete every unchecked item in `RELEASE-CHECKLIST.md` before submission.
