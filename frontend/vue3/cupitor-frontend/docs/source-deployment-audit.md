# Source/deployment audit — 21 October 2026

Editable application source is frontend/vue3/cupitor-frontend in
[trexsatya/cupitor](https://github.com/trexsatya/cupitor).
The deployment workflow builds music-study-app, not master. The last successful
source revision was a9b214e389c2165e25113a9b4e753b25f118bbe8, published as site
commit 22d144cab139df198d70040a3b24b50a24c21cf5. The audit compares that deployment,
current source d39aeacf3c5912d6927eb9fd6269b46d0de12f17, and site head
afbec8f932ab9744942205f83e4363859f4cfe76.

## Changes that would be overwritten

| Site PR | Behavior | Resolution |
| --- | --- | --- |
| [22](https://github.com/trexsatya/trexsatya.github.io/pull/22) | Selected-text Search and always-visible Practice Flip | Ported implementation, source integration, CSS and tests |
| [23](https://github.com/trexsatya/trexsatya.github.io/pull/23) | Captured Spotify cue ends, embedded Player/Practice, Play All, media sizing | Ported into readable source |
| [24](https://github.com/trexsatya/trexsatya.github.io/pull/24) | Saved Spotify start timestamps and seek/resume | Ported current merged player and regressions |
| [25](https://github.com/trexsatya/trexsatya.github.io/pull/25) | Buffering/seek recovery and item advancement | Ported current merged player and regressions |
| [27](https://github.com/trexsatya/trexsatya.github.io/pull/27), open | Dialog scrolling and Sync pending-change state | Reimplemented in source with regressions |
| [26](https://github.com/trexsatya/trexsatya.github.io/pull/26), open | Additional Spotify activation and whole-second seek changes | Pending work; also requires a source-based PR before production merge |

The next deployment replaces language/language.js, language.css, language.html
and the other owned application assets. Even if a site-only new module remains
on disk, replacing the entry script that imports it loses its feature.

The port preserves newer source changes: account-banner dismissal, repository
availability checks and the SRT-generation tool. A literal unresolved merge
conflict in _loadOtherRecordings was already committed in d39aeacf and blocked
source deployment. It is resolved by retaining split-file playlist loading and
the newer repository availability check. An early syntax check now catches
such errors before browser tests.

## Site-owned changes that are preserved

Site PRs [16](https://github.com/trexsatya/trexsatya.github.io/pull/16),
[18](https://github.com/trexsatya/trexsatya.github.io/pull/18),
[19](https://github.com/trexsatya/trexsatya.github.io/pull/19),
[20](https://github.com/trexsatya/trexsatya.github.io/pull/20) and
[21](https://github.com/trexsatya/trexsatya.github.io/pull/21) change the subtitle
and capture scripts under db/js/. They are not frontend build outputs.
Vocabulary, playlist cards and subtitles under db/ are also site-owned.
Publishing protects all of db/, .github/ and CNAME, so those changes do not need
copying into the frontend source.

Source deployment now runs the recovered feature tests. Site-only tests tied
to minified local variable names are not a durable substitute for source tests.
The open site PR 26 has additional work that this audit intentionally does not
silently merge into the recovery of already-merged features.

## Future work

Edit public/language/, public/language.css and public/language.html. Run source
and production-build regressions. Leave cache versions to scripts/cache-bust.js.
Do not implement app fixes only in the publishing repository. Switching the
source deployment to the older master branch requires reconciling that history
separately; this port keeps the existing deployment branch.
