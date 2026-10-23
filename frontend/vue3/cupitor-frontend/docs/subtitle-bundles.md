# Subtitle bundles

Each language keeps `srts/index.json` as an array of media records. Migrated
records add `bundle`, `bundleRevision`, and (only for an exact Unicode filename
which differs from the index name) `bundleKey`. The `bundle` path is relative to
`srts/`, for example `packs/pack-000001.json`.

A pack is `{ "version": 1, "files": { "original-name.sv.srt": "original SRT text", ... } }`.
It is the canonical storage, not a second copy alongside individual SRTs.
`storage.json` records the format, limits, revisions, and monotonic next pack ID.
The target is 200 tracks and 1 MiB of UTF-8 JSON per pack. All tracks for one
media stay together. An individual oversized media is preserved in its own pack.
Existing assignments stay stable; growth can move only the edited media when
its containing pack exceeds a limit. Empty packs are removed and IDs not reused.

The app supports mixed legacy and bundled indexes. It shares concurrent pack
downloads and caches individual complete subtitle pairs in IndexedDB, including
the pack path/revision so changes invalidate stale entries. Account, repository,
language and pack revision are represented in the request URL. Missing or
malformed packs fail explicitly; they never become empty authoritative files.

## Writes

`GitHubUtils` installs a subtitle adapter. Existing `.srt` paths become virtual
files. Capture, translation, inline edits, single-file merge writes and deletes
operate on those logical tracks. The adapter coalesces them per pack, preserving
unrelated tracks. Pack contents, index pointers/revisions and the storage
manifest are committed atomically. Reads are pinned to the commit used as the
parent. A ref conflict replans against the new parent. Conditional single-file
writes also check the original pack SHA before replacing a track.

Creating a new media requires its index record and tracks in the same logical
commit. Bulk capture does this automatically, without splitting its index into a
later transaction. The local Manage CLI uses the same planner for captures and
pruning and can scan bundled and legacy data.

## Migration and verification

Run from the frontend project directory:

```bash
node tools/language/subtitle-bundles.mjs pack /path/to/data/db/language/swedish/srts
node tools/language/subtitle-bundles.mjs pack /path/to/data/db/language/swedish/srts --apply
node tools/language/subtitle-bundles.mjs verify /path/to/data/db/language/swedish/srts
node tools/language/subtitle-bundles.mjs unpack /path/to/data/db/language/swedish/srts --output /path/to/export
```

Planning is read-only. Apply verifies a SHA-256 inventory of every filename and
the exact UTF-8 SRT text before removing individual files. CRLF, BOMs, timestamps,
cue numbers, translations, original backups and unindexed tracks are preserved.
Index entries whose files are already absent remain in place and are counted
in the report. A rerun on an already bundled directory makes no changes.

Perform migration in an isolated data-repository branch. Deploy the compatible
frontend and reload open clients before merging the data migration. Older
frontend versions cannot read packs and may recreate individual files. Do not
merge a stale migration over newer captures: rerun it against the current data
head when the index or migrated files have changed. The PR must contain only
subtitle storage changes; vocabulary, recordings and other data stay untouched.

No Git history is rewritten. This reduces files in the current checkout and
future tree updates; old SRT versions remain available in existing history.
