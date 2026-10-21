# Captured Spotify podcast clips

Captured captions retain `start` and `end` in seconds. New cards store aligned
`captionStarts` and `captionEnds`; merged cards store both arrays in each
`captionBlocks` entry. Text fields, translations and duplicate detection keep
their existing behavior.

A card linked to a Spotify podcast episode with valid cue bounds is playable
in the same playlist as YouTube clips. Play All seeks to each passage, stops
at its end and advances through the normal queue, gaps and loop settings.
Overlapping cues and pauses of up to half a second form one passage; separated
selections skip unselected material. Practice cues stay paused until Play is
pressed and can then be paused, resumed and replayed.

Older cards saved only cue starts. Resend the same captured lines to their
playlist once: existing cards gain end times without duplicate text or items.
Missing or invalid end times are never guessed.

Playback uses Spotify's visible podcast embed and public iFrame API in both
Cupitor and ordinary browsers. The same embedded player stays in the media area
when changing cards or switching between Player and Practice. Show Spotify
focuses that player. Playback does not open or control a separate Spotify tab,
app or WebView, and does not use `SpotifyClipBridge`.

The controller validates the episode and seek position while preserving play
intent, pauses at the saved end, and then advances the queue. Stop,
navigation and backgrounding pause the embed. Clip timing depends on Spotify's
reported playback positions; this is not sample-accurate audio trimming.
The first episode is loaded with `loadEntity(uri, false, startAt)` so the embed's
initial Play uses the clip timestamp. For later seeks, send Seek followed immediately by Resume: an idle embed can
withhold its seek position until it resumes. Keep validating the reported
position, with bounded retries, rather than waiting for that update to resume. An embedded Play that starts outside the
cue keeps its play intent while Cupitor corrects the position.
Play/Pause intent is kept separately from temporary transport pauses. Seeking
and buffering hold that intent until playback progress confirms recovery.
Completion is marked before pausing, so the boundary pause cannot pause the
playlist owner or the next item. A delayed seek update may already be playing
inside the clip; it does not have to equal the target within 250 milliseconds.
Recovery retries are bounded, and manual Pause and backgrounding still stop it.
Repeated ready notifications do not seek an already-playing clip back to its start.

If autoplay is blocked, the playlist waits for a Play tap in the embed.
No Spotify Web API token or companion native bridge is required. Current
Cupitor builds already enable media playback and third-party cookies in the
study WebView; no new Flutter build is needed for this playback route.
Spotify music tracks and ordinary web links retain their existing behavior.
Playback speed control is not exposed by the embed API.

```sh
CUPITOR_JSDOM=/path/to/node_modules/jsdom node --test public/language/spotify-*.test.mjs
```

The tests also use `jquery` and `@babel/parser` from the same dependency tree
to exercise the actual app playlist loop in an isolated DOM. They verify
timings and the SDK contract, including Cupitor builds that expose native
bridges; they do not play live Spotify audio. A device check should capture
separated lines from episode `317TI86OHwkAxLtwi1VnXN` with its matching SRT,
then verify seek, end/pause, card advancement, Practice replay and a mixed
YouTube queue. Test with an initial Play tap if autoplay is blocked.

Pull requests changing the language player run the Spotify and selection tests
in `.github/workflows/deploy-site.yml`. Transport tests cover buffering,
reordered pause acknowledgements, seek progress, consecutive items and passages,
manual Pause, and background/foreground transitions.


Spotify seeks accept whole seconds. Corrective seeks use the preceding whole
second and may include less than one second of lead-in; the original SRT start
and end values remain unchanged. Between fresh, unpaused, nonbuffering progress
reports, the foreground clock enforces fractional ends. Pausing, buffering,
backgrounding and unconfirmed seeks suspend that prediction.

To export bounded transport diagnostics, stop playback and open Settings →
Logs → **Copy Spotify log**. If clipboard access is denied, the same JSON is
selected in the log viewer for manual copying. It contains commands, ranges and
playback state, without card text, session tokens or raw source URLs.

The live Chrome workflow records the real iframe, automatic queue transitions,
per-passage progress, stopping boundaries and log export. Control runs preserve
all 27 cards and 32 cue ranges from the supplied Swedish playlist, changing only
the episode links in memory. This verifies timing and transport behavior; the
original episode's content alignment still needs a region where Spotify makes
it available. No autoplay-policy override or simulated playback clock is used.


Source lives on Cupitor's `music-study-app` branch, which is selected by
`.github/workflows/deploy-site.yml`. The production build copies `public/`,
minifies the app modules and versions their URLs. Do not apply future player
fixes only to the publishing repository.

The preserved playlist fixture is copied verbatim from
`trexsatya/trexsatya.github.io`, blob
`a92013cb58a24f82ab8476343f4df2e34450306d`, path
`db/language/swedish/recordings/67d5fc3994959109e1bfb6bebdcb633e5797268126c49c5c6c9644465164a686.json`.
It is a test fixture and is never copied into public recording data.
