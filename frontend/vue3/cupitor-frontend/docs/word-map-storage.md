# Word map storage

Word maps use the same resolved account, repository, branch and language root
as recordings. GitHub sync writes a small `word-maps.json` index and one
complete JSON map per `word-maps/<sha256>.json` file under that language root
(for example, `db/language/swedish/word-maps/`). Each index entry contains the
map's stable ID and file path. Content hashes make map files immutable;
unchanged maps keep their paths and are not rewritten when another map changes.

Existing array and `{version: 1, maps: [...]}` collections still load. The next
successful Sync replaces the collection with a `cupitor-word-maps-v1` index
and its map files in one atomic commit. Map IDs, folders, words, connections,
notes, images and appearance retain the existing portable map format. Device
records, portable import/export and repository-scoped sync baselines keep
their existing formats. Web and native hosts use this shared sync adapter.

Every referenced map must load and validate before anything is adopted.
Missing or malformed files fail the whole read; they never imply deletions.
A missing map file retries a fresh index once in case an old version expired.
The existing three-way merge still resolves simultaneous edits and deletions.
If the index changes at the commit head, sync reads it again and repeats the
merge instead of overwriting another device's changes. Failed writes do not
advance the local baseline or discard unsynced edits.

Replaced or deleted map files stay readable for seven days after a sync first
observes them without an active reference. A later successful sync removes
expired generated files atomically with the index. Reusing an older map
version removes it from retirement. Cleanup only considers generated paths
tracked by the index; unrelated files remain untouched.

Older clients that only understand the single collection cannot read the new
index. Update clients before syncing the migrated repository.
