# Contributing

Thanks for helping make Spotify Vim Navigation more reliable.

## Before opening a change

1. Keep the extension single-purpose: keyboard navigation on Spotify Web.
2. Prefer semantic roles and stable `data-testid` attributes over visible,
   English-language labels.
3. Do not add analytics, remote code, account access, storage, or broader host
   matches without a separate privacy and scope review.
4. Preserve native keyboard behavior in editable fields, dialogs, and controls
   the extension does not currently own.
5. Add a fixture regression for DOM or key-handling changes.

Run the complete local checks:

```bash
npm test
npm run package
```

Then test against the live Spotify pages and locales listed in
`RELEASE-CHECKLIST.md`. Never attach cookies, OAuth tokens, browser profiles,
HAR files, or other account data to an issue.
