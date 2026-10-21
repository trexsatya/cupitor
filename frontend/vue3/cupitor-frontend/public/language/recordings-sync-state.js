import {sameJson} from './recordings-3way.js';

// Playlist updatedAt is bookkeeping: selecting or pausing a recording also
// saves it. Compare the content/settings that a sync would actually change.
function syncContent(recordings) {
  const result = {};
  for (const [name, playlist] of Object.entries(recordings || {})) {
    if (!playlist || playlist.external || playlist.readOnly) continue;
    const {updatedAt, ...content} = playlist;
    result[name] = content;
  }
  return result;
}

export function recordingsHaveChanges(current, baseline, fallbackDirty = false) {
  // Before a first successful remote read, retain known pending local edits.
  if (baseline == null) return !!fallbackDirty;
  return !sameJson(syncContent(current), syncContent(baseline));
}
