# Security

Spotify Vim Navigation has no backend and intentionally requests no extension
API permissions. Its content script is limited to `open.spotify.com`.

Do not include credentials, Spotify cookies, OAuth tokens, browser profiles,
or unredacted network captures in a report. Once the public repository exists,
report vulnerabilities through its private GitHub security-advisory form. Use
the public issue tracker only for reports that contain no sensitive data.

Security updates will be documented in `CHANGELOG.md` and published as a new
extension version. No remote code is loaded, so an installed version changes
only through the browser's extension-update mechanism.
