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

Swedish vocabulary matching also connects agent/activity noun endings such
as `översittare` / `översitteri`, including automatic prefix search. It uses
a shared stem from the language's suffix rules rather than accepting any
words with a similar beginning. Vowel deletion in pairs such as `hagel` /
`hagla` and `cykel` / `cykla` also normalizes to a shared stem. Subtitle queries
keep the typed term when it already finds subtitle results.

## Practice speed

In Practice, open **⋯ → Speed cycle**, enter an ordered list such as
`1, 0.75, 0.5` or `0.7, 0.5`, then press **Save speeds**. The speed button cycles
through exactly that list and wraps to its beginning. Decimal points are used
inside rates; commas, spaces or semicolons separate rates. Allowed rates are
0.1–4. The list and selected rate persist across cards and sessions.
YouTube receives the closest speed supported by the current video; the
settings show the actual rate when it differs from the requested rate.

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

Run `npx jest public/language public/github-utils.test.js --runInBand` for the
language and sync tests, and `npm run build` for the production bundle.
The new tests cover legacy migration, large-file splitting, round trips,
concurrent index edits, retention expiry, part reuse, old-orphan discovery,
stale-index recovery, failed/missing reads, cache isolation, strict channel
limits, compound heads and custom speed cycling.
