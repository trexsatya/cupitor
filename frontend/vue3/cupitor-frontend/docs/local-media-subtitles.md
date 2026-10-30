# Local media uses the main WebView subtitle panel

Open an MP3, WAV or MP4 from the media panel. The subtitle picker ranks exact
filename matches first; an SRT can also be added later with **Open SRT** in the
player's subtitle toolbar. Applying or removing subtitles preserves the media
position, paused state, and Speak Over takes. Invalid files preserve the installed
track. UTF-8, BOM-marked UTF-16 and Windows-1252 SRTs are accepted.

The player uses the same split transcript component as videos in the app's main
WebView: draggable divider, timed highlighting, timestamp seeking, translation,
replay settings, select-lines and send. Speak Over stays in that panel. Minimize
returns to lookup; **Return to local player** restores it without reselecting the
file. Local File handles last for the current tab; the source media is not saved.

## Shared source ownership

`public/language/caption-sidebar.js` is the canonical component for local files,
YouTube in the language app, and injected panels in the native app. All runtime
scripts and their tests now live in `public/page-scripts/` in Cupitor. The bundle
builder inserts the canonical sidebar between the numbered site adapters; no
second sidebar source is maintained. Run `node scripts/build-page-scripts.cjs`
after a runtime or component edit. `--check` rejects a stale committed bundle,
and the production build regenerates it before minification.

The native app fetches `snippet.js` and `frame-boot.js` from Cupitor's master
branch under `frontend/vue3/cupitor-frontend/public/page-scripts/`. Older native
installs can continue using the legacy site copy until updated. Data in the
publishing repository remains under its existing ownership.

`media-caption-panel.js` parses paired SRTs and adapts callbacks and recorder
placement for both media types. `youtube-media-adapter.js` supplies the IFrame
API clock and transport; polling stops when the panel closes or Practice/Player
opens. YouTube and local media share the transcript toolbar, divider, translation,
replay, selection, and capture. Closing and reopening retains the playback
position. The translation callback uses the webapp's existing request broker,
so the component cannot replace `window.__cupTranslated`.

MediaElement's original element id points to its proxy wrapper. Both the subtitle
panel and Speak Over bind to the real nested native `<audio>`/`<video>` instead.
The legacy timer must not overwrite the shared panel's local replay speed.

Captured local lines use the file's name/size/modified fingerprint as their
provenance and retain cue bounds through the existing capture dialog. They are
text cards; a browser File is not a permanent URL or an automatically restorable
media attachment.

## Checks

`node tests/browser/local-media-subtitles.cjs` covers desktop, 390px and 320px,
real WAV and MP4 playback, first/final cues, seeking, English companions, invalid
and replacement SRTs, UTF-16, capture preview, minimization, and width constraints.
`local-speakover.cjs` and the focused unit suites cover recorder persistence and
translation/capture callbacks. CI runs the browser checks against source and the
production build.

`node tests/browser/youtube-media-subtitles.cjs` checks the same YouTube paths at
desktop, 390px and 320px, including rotation, iframe bounds and study handoff.
