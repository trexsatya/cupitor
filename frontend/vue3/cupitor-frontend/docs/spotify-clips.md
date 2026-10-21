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

The controller confirms the episode and seek position before playing, pauses
when playback updates reach the saved end, and then advances the queue. Stop,
navigation and backgrounding pause the embed. Clip timing depends on Spotify's
reported playback positions; this is not sample-accurate audio trimming.
The first episode is loaded with `loadEntity(uri, false, startAt)` so the embed's
initial Play uses the clip timestamp. After a confirmed seek, use Resume rather
than starting the loaded entity again. An embedded Play that starts outside the
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
