# Lakshmi Mata aarti

- `lakshmi-aarti.mp3` is the recording supplied by the project owner as copyright-free. Keep the original source/license or permission with your release records; the application does not independently establish its licensing.
- Playback is optional and offered only after both rituals finish. The audio is served by this site, not a third-party streaming service. There is no autoplay, loop, or runtime transcription service.
- `src/aarti-lyrics.js` holds recording-specific line timestamps, Romanized Hindi (Hindi in English letters), and Devanagari. Romanized lyrics are not an English meaning/translation. The top-right EN / हिन्दी toggle translates the full interface and selects the matching lyric script without restarting playback; the player’s script selector can still be used independently.
- Lyrics follow the native audio player's clock, including pauses and seeks. Instrumental gaps show a quiet interlude rather than advancing lyrics on a separate timer.
- Line timings are derived locally from this recording. Review synchronization while listening before public release; sung syllables can need small timing adjustments. Replacing or editing the recording requires re-aligning the cue timestamps, not stretching them to the new duration.
- The current recording is approximately 5 minutes 45 seconds. `AARTI_RECORDING` stores its duration, byte size, and SHA-256 fingerprint; tests reject a different recording until its cues are updated. The audio URL includes the fingerprint prefix so browsers do not reuse an older recording after deployment.

## Ambient sound and ritual effects

`src/soundscape.js` synthesizes the ambient air/drone, diya ignition and crackle, rocket whistles, and cracker bursts using the browser's Web Audio API. These effects use no third-party recordings or additional downloaded assets, and work on static hosting such as GitHub Pages.

The soundscape starts only after interaction, uses conservative gain and a compressor, and has an EN/Hindi Effects toggle that remembers its setting. This toggle controls ambience and effects, not the separate aarti recording. Effects are silenced during the aarti, the quiet ending, and while the page is hidden. Burst sounds are triggered by the fireworks renderer, not independent wall-clock timers; reduced-motion mode plays only one burst for its static display.

Run the local site over HTTP, rather than opening `index.html` as a `file:` URL. Run `npm test` for the ritual flow, cue boundaries, playback, language switching, and error-handling checks.
