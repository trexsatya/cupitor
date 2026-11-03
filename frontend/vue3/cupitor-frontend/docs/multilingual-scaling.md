# Multilingual scaling: language and source foundation

The shared registry in `public/language/language-config.js` supplies language
codes, speech locales, subtitle suffixes and explicit study capabilities to
the study page, host metadata, study calls and language-management tools.
Swedish and Spanish retain study support. Additional registered languages
support call metadata; they do not automatically acquire morphology or the
full subtitle/vocabulary study pipeline. Existing language directory keys
remain independent of locale aliases.

`data-source.js` resolves each own/shared source to an owner, repository,
branch, language and data root. Repository overrides remain disabled while
pending edits and sync baselines still use their legacy storage keys. There
is no repository or user-data migration in this change.

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

The next storage phase must migrate playlists, maps, baselines and pending
edits transactionally into IndexedDB and isolate them by source. Worker
search, map indexing and bounded corpus loading remain later phases. Complete
active-language search, substring/regex behavior and own/shared precedence
remain requirements throughout those changes.
