# Multilingual scaling

The shared registry in `public/language/language-config.js` supplies language
codes, speech locales, subtitle suffixes and explicit study capabilities to
the study page, host metadata, study calls and language-management tools.
Swedish and Spanish retain study support. Additional registered languages
support call metadata; they do not automatically acquire morphology or the
full subtitle/vocabulary study pipeline. Existing language directory keys
remain independent of locale aliases.

`data-source.js` resolves each own/shared source to an owner, repository,
branch, language and data root. Repository overrides remain disabled. This
change migrates device data; it does not move files between GitHub repositories.

Asynchronous work captures a source context. Changes to the account,
repository, branch, shared library or active language invalidate it. Source
reconfiguration also detects a switch away and back while a request is pending. Reapplying unchanged
source settings is safe. Layered reads reject stale responses; subtitle and
vocabulary loaders cannot install them. Playlist and word-map sync responses
cannot adopt stale results or advance baselines. Playlist writes retain their
original destination across retries. An already submitted server write may
finish at that original destination; it never marks the new context synced.

Subtitle cache records include the complete source identity. Owner-only
legacy records are retained but refetched once before reuse. The first load
after upgrading therefore needs a connection to refresh those downloads.
Subsequent loads reuse unchanged complete records. Changing a repository or
branch refetches the corpus even when its owner and video links are identical.
Cache content is disposable; this does not modify captured edit buffers,
playlists, maps or their GitHub files.

## Transactional device data

`user-data-store.js` now stores playlists, word maps, sync baselines, folder
metadata and pending vocabulary/subtitle/capture edits in `cupitor-user-data`.
Practice logs, playback restoration and saved voice-take metadata use the same
store. Recorded audio blobs and downloaded subtitle caches remain separate.
Small UI settings stay in localStorage. GitHub formats and destinations remain
unchanged; repository overrides are still disabled.

Each scope includes the account, active language and resolved source identity
(owner/repository/branch/language/root). Guest data follows the selected library.
Startup hydrates an in-memory view before application initialization. Existing
UI reads use that view; writes batch asynchronously. A transaction commits all
related values, deletion tombstones, a revision journal and the scope revision.
Sync awaits durable saves before sending data and before reporting completion.
No failed save falls back to an older localStorage snapshot.

Migration validates actual legacy values, copies them in one transaction,
reads them back and compares their complete content, then records a verified
migration marker and digest. Interrupted copies can be verified and completed
on restart. Original localStorage data remains untouched for recovery. A
durable legacy-key claim prevents replaying that original snapshot into a new
repository or branch. Historically unlabelled playlist/selection keys are
claimed once by the first supported study-language scope opened after upgrade;
they cannot be attributed retrospectively to a different language. Labelled
pending vocabulary, subtitle paths and captured source languages migrate to
their respective languages. Opening an unsupported language claims no legacy
data. Map baselines migrate only to their matching repository and branch.

Failed transactions retain the newest pending view, display a persistent save
warning and offer export/retry. A scope revision check refuses stale writes
from another tab, even without BroadcastChannel. Export its pending work and
reload that tab before editing again. Schema changes close old connections;
blocked or unavailable storage reports an explicit failure. New edits remain
exportable rather than being written back to a legacy store.

Settings → Tools → Advanced → Manage → Device data exports or restores a
backup for the active account/language/source. Restore validates all records
and scope before staging a transactional replacement. Export current work
before restoring an older backup. Pending edits in a failed-save banner can
also be exported. This backup excludes audio files and downloaded subtitles.
Do not downgrade to an old client and assume its retained legacy copy includes
new IndexedDB edits; use the new client's export/restore path for recovery.

Selected subtitle uploads keep unselected edits durable throughout the request.
Acknowledgement removes only entries that still equal the sent snapshot;
newer edits remain pending. Playlist/map baselines and adopted local data are
committed together, including captures made while an upload is in flight.

Validation covers interrupted/repeated migration, malformed data, source and
language isolation, collections beyond the old storage budget, aborted saves,
recovery import, competing tabs and schema upgrades. Browser tests exercise
desktop and emulated mobile, real IndexedDB transactions, reloads and failed
post-upload baseline saves, on source and production assets. Real Android/Mac
device performance is not established by these checks.

## Complete search with bounded working data

The module worker scans the complete downloaded active-language corpus in
`cupitor-search-corpus-v1`. It preserves literal, substring, regex, cue-anchor,
cross-cue phrase and expansion attribution, along with existing ranking,
English corresponding-word grouping and own/shared precedence. No prefix index
or fixed result limit substitutes for the full scan. Attribution streams one
document batch at a time. English grouping streams frequency statistics and
paired-line assignments instead of sending every studied-language line to the UI.

Every request carries a session generation and request identity. Raw document
edits invalidate normalized data and cancel in-flight queries. A main-thread
watchdog terminates a worker after ten seconds, including a regex evaluation
that cannot receive cancellation messages. Cancelled, timed-out, missing-cache
and partially downloaded searches explicitly report incomplete results. The
next query can restart the worker from its persisted session corpus. Hosts
without module workers use the same cooperative implementation; that fallback
cannot interrupt a single native regex evaluation, and the status explains it.

Each tab has a separate derived corpus namespace within the account, language
and resolved own/shared sources. Unsynced edits in another tab cannot overwrite
this tab's search data. The authoritative subtitle download cache is reused on
reload; the derived namespace is prepared from it in bounded batches.

Raw main-thread subtitle strings use a 32 MiB working budget. Only acknowledged
documents can be evicted; unsaved edits remain pinned. Metadata remains resident
and full text can be restored for playback, editing and capture merges. Large
searches return cue references and request paired context only for displayed
rows. Rare-word scans, vocabulary-to-video checks and automatic playlists scan
persistent documents too, so eviction never excludes a file. Selected search
playlists use all selected matches, including cards not currently displayed.

Normalized worker strings use a 16 MiB LRU budget. Raw read/update batches target
2 MiB and at most 64/32 documents respectively. Initial subtitle fetching uses
four concurrent requests with persistence backpressure. Bundle bodies use an
8 MiB LRU; source and revision remain part of the cache key. A complete transcript
is the indivisible regex unit: a single larger document is processed alone.
These are estimates for retained strings, not total browser heap or network
traffic guarantees. Result references, vocabulary metadata, currently displayed
context and pending edits also consume memory and scale with actual content.

Search-cache metadata records document counts and estimated raw text sizes.
Active sessions maintain leases. Cleanup retains active sessions, removes
expired sessions older than seven days, keeps one inactive session per source,
and applies a soft 128 MiB budget to disposable derived data. Manage → Cached
data lists account/language/source caches and sizes; active search sessions
are protected. Removing disposable caches never removes pending user edits.

## Indexed maps and bounded views

A normalized word-to-map/node reverse index serves map badges and cross-map
links. Saving an edited map updates that map's index entries. The first save
splits a legacy map collection into a directory and independent map records in
the same transaction; later node edits encode only the changed map. Portable
exports and GitHub sync retain their existing JSON format and stable identities.
Dragging updates the moved SVG groups and incident edges in place.

Map/folder/related-map lists show 100 entries per page. Large map pickers retain
the current map and a bounded initial list, with complete library filtering.
Media libraries above 200 entries use a searchable local picker with 50 results
per page instead of one DOM option per subtitle. Search heading pages retain
full counts; each heading renders at most 100 matches per page and offers
previous/next controls. All matches remain available to paging and playlist
selection. The main search page picker shows a bounded window plus first/last.

Regression coverage compares search attribution with the pre-worker reference,
exercises worker/fallback mode, mutation invalidation, supervised regex timeouts,
cancellation/restart, and streams compact grouping/context/playlists. A corpus
larger than the real raw-memory budget verifies complete search, capture merges,
automatic playlists and offline reload on desktop and emulated mobile. Large-map
checks verify bounded DOM, complete filtering, stable drag elements and isolated
record saves. Benchmark instrumentation and real Android/Mac performance
measurement remain outside this change.
