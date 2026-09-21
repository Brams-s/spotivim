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
- [x] Current release documentation is public, and the
  [Validate stable release](https://github.com/Brams-s/spotivim/actions/runs/35641080233)
  workflow passed, including archive upload.
- [ ] The signed-in manual browser matrix in `RELEASE-CHECKLIST.md` is complete.
- [x] The designer-accepted real 1280×800 live-product screenshot is included
  at `store-assets/screenshot-live-1280x800.png`.

## Prerequisites

1. Register a Chrome Web Store developer account and pay the required developer
   registration fee.
2. Run `npm run package`; upload only
   `dist/spotify-vim-navigation-0.1.0.zip`.
3. Keep the package, test evidence, and remaining release gates recorded in
   `RELEASE-CHECKLIST.md`.

## Dashboard steps

1. In the Chrome Web Store Developer Dashboard, select **New item** and upload
   `dist/spotify-vim-navigation-0.1.0.zip`.
2. On the Store listing tab, copy the name, summary, description, public URLs,
   permission rationale, and reviewer instructions from `STORE-LISTING.md`.
   Upload `store-assets/promo-440x280.png` and
   `store-assets/screenshot-live-1280x800.png`.
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
