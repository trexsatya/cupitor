# Download a YouTube track into the caption sidebar

## Local SRT files and Spotify

**Open SRT** uses the native `LocalSubtitles` channel, independently of YouTube
downloads, on every supported player. Spotify has its own player adapter, so
the panel works without a visible `<video>` and follows the playing track or
episode rather than the page currently being browsed. The panel stays above
Spotify's footer. Its normal translation, replay, cue navigation and capture
controls use the same interface; local playback rates require an accessible
native media element (Spotify Connect has no local rate control).

Spotify has a floating **SRT** button at the top right, including on its home
page before a player has rendered. Tap it to open or close the panel. Choose
a track or episode first to enable **Open SRT**. Older apps display an update
message when the native file picker is unavailable. A panel closed with either
toggle stays closed until reopened.

Synchronization reads the fractional position from Spotify's playback slider,
including sliders nested inside its timeline wrapper. Rounded clock text is a
fallback, so cues starting between whole seconds can be highlighted correctly.

On mobile the desktop timeline may be absent. The early playback bridge also
observes offscreen audio and Spotify's Media Session position/action handlers.
When no playback interface is available, the panel asks for one pause/resume
instead of highlighting 0:00 or pretending a cue seek succeeded. Tap a cue's
timestamp to seek; word taps retain their lookup behavior. Diagnostic source
changes are written to the app's snippet logs.

Capturing podcast cues sends their original fractional times together with
`timeParam: 't'` and `timeLink: true`. The receiving app adds `?t=<seconds>`
to the card's episode link using the earliest cue actually filed on that card,
rounded down to a whole second. The capture identity remains the plain episode
URL for deduplication. This follows the playing episode even while browsing
elsewhere in Spotify. Music tracks keep their plain links (`timeLink: false`).

The picker request is `{op: 'open', requestId, lang}`. The app returns parsed
SRT cues through `window.__cupLocalSubtitlesResult({requestId, lang, lines})`,
or `{requestId, cancelled: true}`. Only the pending request for the same media
item is accepted. Invalid and cancelled imports preserve the transcript;
accepted imports replace it without starting playback. Up to five local
tracks are remembered per tab. Clearing removes both local and downloaded
tracks for the current item. Native/live harvesting stays suppressed until
the imported track is cleared or the media changes.

```sh
CUPITOR_JSDOM=/path/to/jsdom node --test public/page-scripts/local-subtitles.test.mjs
```

The companion Flutter app change adds the picker, encoding-aware SRT parser,
and Spotify-aware pause/resume around word lookup.

## YouTube downloads

YouTube watch pages have a visible **SRT · Capture** launcher, including mobile
YouTube. It reopens the same split subtitle panel after it is closed. The panel
can open before the video element has rendered; **⤓CC** downloads a complete
track, **☑** selects lines and **⤴** sends the selection to Cupitor. Closing the
panel stays closed across discovery ticks until the launcher is tapped again.

`window.__cupOpenSubtitlePanel()` opens the panel and returns false outside
video pages. Use the panel's **⤓CC** button to choose and download caption
tracks into the playing page. The redundant native floating CC button is
removed in the companion app change.

The video height cap uses the split viewport height, rather than a percentage
of its immediate parent. Mobile YouTube positions the video absolutely in a
zero-height wrapper; a `100%` cap collapsed it to zero when the panel opened.
The cap applies only while split view is active, so closing restores the
player's own layout.

YouTube also needs its complete player frame resized together. The dedicated
`26-youtube-split-layout.js` adapter fits the mobile aspect-ratio wrapper,
video container and native controls into the area between the page header
and the divider. It overrides stale inline centering offsets and contains
the picture without cropping as the divider moves. Rotation and replacement
players recalculate the frame bounds; closing the panel and teardown release
the adapter's classes, CSS variables and listeners.

The adapter preserves YouTube's native control layers. The empty mobile
`#player-control-container` keeps its original geometry, so hidden controls
cannot intercept taps on the video. Volume and settings popups keep their
native stacking above the player. Browser checks exercise actual touch/mouse
hit targets and control handlers before resizing, after resizing and after
closing the subtitle panel.

The shared `public/language/caption-sidebar.js` also accepts optional `onWord`, `onCapture`
and asynchronous `translateText` callbacks for the language app's local-file
player. The bundle builder reads that canonical source directly; there is no
second sidebar source to update. Using `translateText` leaves the
embedding app's `window.__cupTranslated` callback intact.

In a compatible Cupitor app, the YouTube sidebar's **⤓CC** button asks the
native `YouTubeSubtitles` JavaScript channel to download the current video's
subtitles. The app reuses its existing track picker and yt-dlp downloader.
The button is hidden when that channel is absent.

The app calls `window.__cupImportYouTubeSubtitles` with:

```js
{
  videoId: 'abcdefghijk',
  lang: 'sv',
  lines: [{start: 1.5, end: 4, text: 'En mening.'}]
}
```

Times are seconds. The function returns `true` for an accepted track and
`false` for an empty/invalid payload or a different current video. Import
replaces harvested lines; it does not seek or start playback. The native video
clock still drives highlighting and the existing replay strategies. Caption
translation and selecting/sending lines use the selected track's language.

While a downloaded track is active, live DOM/TextTrack/VTT harvesting cannot
append duplicate approximate captions. Moving to a new video clears the old
timeline. Up to five downloaded tracks are remembered in `sessionStorage`,
and returning to one of those videos restores its track. Clear removes it
from both the panel and that session cache.

Regenerate `snippet.js` after changing the numbered sources:

```sh
sh public/page-scripts/build.sh
CUPITOR_JSDOM=/path/to/jsdom node --test public/page-scripts/youtube-download.test.mjs
CUPITOR_JSDOM=/path/to/jsdom node public/page-scripts/caption-capture.test.mjs
CUPITOR_JSDOM=/path/to/jsdom node public/page-scripts/caption-link.test.mjs
CUPITOR_CHROME_PATH=/path/to/chrome node --test public/page-scripts/youtube-layout.browser.cjs
```

The app update is in `trexsatya/cupitor-flutter`; the two changes can be merged
in either order. Refresh the video page after both are deployed. Older apps
continue their existing caption capture flow without a download button.
