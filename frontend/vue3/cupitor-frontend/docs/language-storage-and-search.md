# Language app: recordings, search and device storage

The language app source is under `public/language/`, with its page and styles
in `public/language.html` and `public/language.css`.

## Recordings storage

Reading supports both the original playlist collection in `recordings.json`
and the new `cupitor-recordings-v1` manifest. The next **Sync** migrates a
legacy collection in one atomic GitHub commit. No separate migration step
or changes in the native app are required.

`db/language/<language>/recordings.json` contains playlist names, metadata,
and ordered part paths. Each playlist has its own parts under `recordings/`.
A large playlist is split into parts of at most 256 KiB. Parts are JSON arrays
of rows: `[searchText]` creates a section, `[searchText, word]` creates a bucket,
and `[searchText, word, card]` appends a card. Empty buckets, card order,
manual card content, playlist settings and virtual members are preserved.
A single card over 256 KiB is refused with a message; the sync writes nothing.

Each part filename is the SHA-256 of its contents. Unchanged parts are reused.
A cached manifest therefore points to its own immutable snapshot. Only the
current manifest's parts are loaded. Changing one playlist does not rewrite
other playlists' parts.

**Automatic cleanup runs during Sync.** Parts no longer referenced by any
playlist are marked in the index and kept for seven days from that first
observation. A later Sync deletes expired parts in the same atomic commit as
the updated index. Reusing a part cancels its retirement; active parts are
never deleted. Files whose timestamps are invalid or in the future cannot
be removed early.

At most once per day during Sync, the app inventories the generated files in
this language's recordings directory in the user's own repo. This also finds
old orphaned parts from before cleanup was enabled. Discovery uses a fixed
commit's directory trees, including directories over 1,000 files; unrelated
files and directories are ignored. A discovery failure is logged and retried
on a later Sync without blocking normal sync or cleaning an incomplete list.

If an old cached index references a part removed after the grace period, the
reader fetches the current index and retries once. A still-missing active part
fails the entire read. Git history is retained; cleanup removes obsolete files
from the current branch without rewriting history.

The existing three-way merge and conflict chooser operate on the reassembled
collection. The root and new parts are committed together, with an index guard
that retries if another device changes the manifest. A missing or unreadable
part aborts the load/sync, rather than being interpreted as deleted cards.
Local edits made during sync remain dirty afterwards. Other users' legacy or
split playlists use the same reader and remain read-only.

Deploy the updated client before the first migration; old clients only
understand the legacy collection. A successful Sync uses browser Web Crypto
SHA-256 support (HTTPS or localhost).

## Subtitle completeness

A captured excerpt is available to search immediately, but it is marked
partial until the full indexed SRT pair has loaded. Loading the pair merges
pending captures without losing any repository lines or translation, and
keeps the indexed filename. Partial captures cannot suppress initial loads
or background retries.

After Push This/All, memory and IndexedDB receive the complete text produced
by the successful GitHub merge, including its final retry. This also runs for
an already-up-to-date push. An untranslated capture reads the existing
translation without writing an empty file. Captures arriving during a push
are retained; cached parses are invalidated.

Cache records now carry a content version and a completeness flag. Older
records, which may contain only captured excerpts, are automatically fetched
again once. No manual cache deletion is needed. Corrected complete records
are reusable on subsequent loads, and account/owner isolation still applies.

The browser regression `node tests/browser/subtitle-completeness.cjs` uses
the reported 17-cue `ivOW01v4VXc` SRT with real app state and IndexedDB on
desktop and mobile. GitHub writes are simulated, including a retry and a
no-op push. The deployment workflow runs this check before building.

## Search

**Settings → Search channels** opens a searchable checklist of
YouTube channels from both loaded libraries. No selection means all sources.
Channel names come from the first `||`-separated part of each SRT filename,
for example `Ljudbok Klubb` from `Ljudbok Klubb || HARRY POTTER || videoId`.
Source labels such as `YouTube`, `youtube`, and `link` are matched without case.
Selecting channels restricts subtitle matching and corresponding-word guesses
strictly to those channels. A filter that finds nothing stays empty; blocked
channel fallback cannot pull in another channel. The selection is saved with
the account's language settings. Local media and vocabulary results remain
available when searching all sources; vocabulary results are independent of
the channel filter.

Dialogs close through their X, Escape, or action buttons. Clicking elsewhere
does not dismiss a dialog or discard staged input. Opening a dialog from
Settings still replaces Settings. Outside-click dismissal is scoped to small
popovers and menus, so a new dialog needs no exception in a global handler.

The browser regression test runs in the frontend deployment workflow. To run
it locally, install Chromium with `npx playwright install chromium`, then run
`node tests/browser/language-dialogs.cjs` from the frontend directory. It uses
fixture subtitles without accessing real accounts or libraries.

The translation summary has a reserved row. Its expanded answer overlays the
results in a scrollable popup, so late answers and expansion do not move the
results. The existing preference for open/closed translation is retained.

Complete compound-word splits also run for already-known words. For example,
`färgsprakande` can expose `färg` and `sprakande` instead of stopping at the
whole word or consuming only `sprak` during the greedy scan.

Vocabulary search uses one compiled matcher for ordinary findings, automatic
prefix search and the manual prefix action. Exact phrases come first, followed
by exact word tokens, related forms and compound constituents. An exact match
never hides a related line. All of those findings remain visible; the Prefix
limit applies only to extra, collapsed spelling-prefix suggestions and their
overflow dialog.

A common word such as `till`, `för`, `som` or `med` cannot be the sole
reason for a vocabulary result. The filter applies to each query alternative,
punctuated tokens, compound constituents and prefix/suffix suggestions,
including the Different-prefixes dialog. A useful match on the same row still
keeps it. Complete expressions such as `se till` or `till och från` remain
searchable as phrases; common prefixes inside content words such as
`tillverkning` are preserved.

Related-word normalization applies bounded stages for Swedish genitives,
inflections, derivations and spelling changes, so layered forms such as
`översittarens`, `måleriet`, `haglade` and `cyklarnas` can find their family.
Explicit lexical forms in Expansions also provide irregular families. Pronoun
and placeholder expansions are excluded from those families. Diacritics stay
distinct, and Swedish rules do not apply to searches in other languages.

Compound matching accounts for complete constituents, including inflected
modifiers and three-letter heads. `väljarkår` finds `kår` without matching the
embedded `år`; `färgsprakande` can find `färg` and `spraka` even when the compound
itself is already listed. An unfamiliar modifier may still have a known head:
only its longest recognized head is offered. Recognized inflected words are
not broken into unrelated scraps.

The compiled index is replaced when the language or vocabulary contents change,
including edits that retain the same line count. Vocabulary matching does not
add fragments to the subtitle or book query. These are rule-based word-family
relationships, not a full semantic dictionary: ambiguous stems can have several
meanings, and genuinely irregular families can be supplied in Expansions.

## Practice speed

Practice card changes stop the previous clip immediately and prepare the next
video with YouTube's non-playing cue command. They do not load an autoplaying
video and try to silence it afterwards. Pending ready/load/seek operations are
cancelled when the card changes, Play takes over or Practice closes. An iframe
that becomes ready during or after a closed Practice request stays silent.

In Practice, open **⋯ → Speed cycle**, enter an ordered list such as
`1, 0.75, 0.5` or `0.7, 0.5`, then press **Save speeds**. The speed button cycles
through exactly that list and wraps to its beginning. Decimal points are used
inside rates; commas, spaces or semicolons separate rates. Allowed rates are
0.1–4. The list and selected rate persist across cards and sessions.
YouTube receives the closest speed supported by the current video; the
settings show the actual rate when it differs from the requested rate.

## Keyboard shortcuts

Practice and Player have **Player** / **Practice** buttons to switch views at
the current item. The exact queue order and index are retained, including
shuffled queues and multiple clips from the same video. Practice pauses the
Player session; returning to Player starts the selected item. Text-only cards
remain visible and paused instead of being skipped during this handoff.
Practice covers the underlying page; minimizing it restores the main page.

On phones the view controls use icons. Player's **Practice** action is inside
its info panel; **Replay** remains in its top bar. Replay uses 0.75× for the
current item, including manual recordings, and restores normal speed when
the selected item changes. Keyboard-shortcut buttons are hidden on phones.

Drag the horizontal divider between media and text to resize either view.
Player and Practice remember separate positions. The divider also supports
the up/down arrow keys; Home or double-click restores the default size.

Both views fade their controls after three idle seconds. The Player timer and
progress bar stay visible and keep updating while the other controls are hidden.
Tap the text or player to bring them back; the first tap only reveals controls, including
over the YouTube iframe and native audio controls. The next tap operates
them normally. Text and media keep their positions, and card swipes and text
scrolling still work while controls are hidden. Keyboard input also reveals
controls. Open panels, text editing, keyboard focus on controls, dragging the
divider and active microphone recording keep controls visible.

In Android dialog1, the app calls
`window.CupitorYouTubeControls?.setVisible(visible)` whenever the study controls
hide or appear. YouTube's native controls therefore follow the same idle timer,
tap and keyboard actions. Closing or minimizing a view restores them. The host
bridge applies visibility inside the embed without recreating or seeking the
player; keep YouTube's initial `controls` setting at its default of `1`.
In ordinary browsers or older hosts where the API is absent, YouTube keeps its
own automatic hiding behavior. A host API error cannot block web controls.

Background music has independent **Manual cards** and **YouTube clips**
profiles in its dialog. Each has its own enable switch, track, timing and
volume settings. The library and the pause-all control are shared; existing
playlist/card track overrides continue to apply. Old settings retain silent
music during YouTube clips until their profile is changed explicitly.

Open **Settings → Keyboard shortcuts**, **Practice → ⋯ → Keyboard shortcuts**,
or press **?** for the in-app reference.

| Key | Action |
| --- | --- |
| `/` | Focus and select the main search field, including when it already has focus |
| `/` in Practice | Click Search this word and minimize Practice |
| `←` / `K` | Previous Practice card |
| `→` / `J` | Next Practice card |
| `Space` | Play/pause the Practice clip or recording; resume a paused clip |
| `R` | Reveal/flip the answer |
| `D` | Switch the language direction |
| `S` | Cycle the configured playback speeds |
| `Esc` | Close Practice; when help is open, close help first |
| `?` | Show the shortcut reference |

Typing in inputs, textareas, selects and rich-text editors, IME composition,
modifier shortcuts, and open dialogs retain their own keys. The main search
field reserves `/` to select its query; the slash is not inserted. A minimized
Practice session leaves shortcuts with the visible main view. Focused buttons
keep native Space activation. Click the card first if YouTube has keyboard
focus. Practice/playback shortcuts bypass the old key-release transport so a
single press cannot also seek or toggle the shared player behind the view.

## Cached data

**Settings → Manage → Cached data** lists other accounts' and languages'
subtitle databases, plus source users within the current cache. Removing a
source clears only that user's downloaded subtitle pairs. Further writes for
that source are suppressed until reload. Removing an inactive account/language
cache deletes only that subtitle database. Playlists, pending edits, music,
localStorage and credentials are unaffected. Libraries that remain enabled
are downloaded again on the next reload.

Connections close on IndexedDB version-change requests. A database held open
by an older tab reports that the tab must be closed. Browsers without
`indexedDB.databases()` list the current cache and caches recorded since this
update.

Number-of-results and context-line inputs debounce redraws without dismissing
Settings or moving focus. Settings closes through its close button, Escape,
the gear, or an action that opens another dialog.

## Verification

Recorded Searches keeps native scrolling where it works. Its background
WebView check probes within two pixels of the current position and yields to
new input instead of restoring an older position. The Android fallback and
page scroll rescue estimate momentum from the last 100 ms of motion so a tiny
finger reversal at release cannot send a downward swipe upwards. Holding
still clears stale velocity; cancelled gestures stop without momentum, and
replacing the displayed playlist cancels its old animation.

`node tests/browser/recorded-searches-scroll.cjs --huge` exercises a 10,000-item
fixture playlist, native wheel scrolling, the preview-check race, both touch fallback
paths, release jitter, cancellation, pause, refresh, playlist switching and
horizontal scrolling. Desktop drag handles are registered in a single batch
to avoid quadratic widget setup on huge lists; the test also verifies actual
drag-reordering. It runs in CI alongside the existing dialog checks.

Run `npx jest public/language public/github-utils.test.js --runInBand` for the
language and sync tests, and `npm run build` for the production bundle.
The new tests cover legacy migration, large-file splitting, round trips,
concurrent index edits, retention expiry, part reuse, old-orphan discovery,
stale-index recovery, failed/missing reads, cache isolation, strict channel
limits, compound heads and custom speed cycling.
