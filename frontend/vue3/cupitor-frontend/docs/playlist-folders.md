# Playlist browser and folder storage

Settings → Tools → Playlists opens the library (formerly Review). Browse all
playlists, unfiled playlists, or a folder using the tree and breadcrumbs. Name
filtering is literal, case-insensitive and accent-insensitive, and also matches
folder paths. Type filters distinguish own, shared, native-app and virtual
playlists. Filtering within a folder includes its descendants. Without a filter,
a folder shows its immediate subfolders and playlists.

Selecting a playlist collapses the browser to put its cards and actions within
reach. Browse playlists expands it again. New playlist uses the folder being
browsed. Move to folder changes only placement. Duplicate keeps the original
folder. Folder rename/move updates its descendants without changing playlist
names, cards, IDs, order, or virtual playlist membership. Folder deletion is
allowed only after playlists and subfolders are moved out. Shared and app-owned
playlists can be browsed and filtered; their folder assignment cannot be edited.

Each playlist stores its path in an optional `folder` metadata field. Old
playlists without it remain Unfiled. Empty folders are catalog entries in the
`folders` field of the existing `cupitor-recordings-v1` manifest. The catalog is
synced atomically with the playlists and content-addressed card parts; its
local copy and confirmed base are scoped by account and language. Metadata is
adopted only after every referenced card part loads successfully.

Catalog entries use `{updatedAt, deleted}`. Latest changes win, with deletion
winning a timestamp tie. Tombstones prevent an older device snapshot from
bringing an empty deleted or renamed folder back. Concurrent catalog additions
are retained when a sync retries. Playlist placement uses the existing
three-way metadata merge, so another device's card edit can coexist with a move.
Changes made while a sync is running remain pending for the next sync.

Browser navigation/filter state is separate from playlist content; browsing a
folder never changes the current recording destination. Playlist names retain
their existing globally unique identity, independently of folder paths.
