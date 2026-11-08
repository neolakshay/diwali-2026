# GitHub Pages

Live website: <https://neolakshay.github.io/diwali-2026/>

`.github/workflows/pages.yml` deploys pushes to `diwali-2026`, or can be started manually from the repository's Actions tab. In **Settings → Pages**, the publishing source is **GitHub Actions**.

The workflow uses Node.js 24 to run `npm test`, then uploads a clean `_site` artifact containing only:

- `index.html` and `styles.css`
- `src/*.js`
- `audio/lakshmi-aarti.mp3`

Tests, documentation, agent files, screenshots, and repository settings are not published as site assets. If a new runtime asset is added, update the explicit copy list in the workflow. No bundler, Jekyll, server, API key, or runtime transcription service is required.

Keep asset URLs and module imports relative so they work under `/diwali-2026/`. Lyrics and translations ship as JavaScript; the browser plays the MP3 after the visitor chooses to listen. Its version query prevents reusing a stale recording. Audio replacement also requires updating the recording fingerprint and line cues described in `audio/README.md`.

Check the **Deploy GitHub Pages** workflow for deployment failures. A failed test prevents publishing. To roll back, revert the relevant code change and push a new commit to the deployment branch; do not force-push history.
