// Answers the host app's question "which of these videos does the webapp
// already have?" for its Saved videos list. The host calls
// window.cupitorKnownVideos(idsJson) synchronously and polls until `ready`.
//
// `library`: ids with an entry read from the subtitle index layers (own and
// other user's, merged; those entries carry `src`), or one pushed to the own
// repo this session (`pushed`). Entries a buffered capture only seeded into
// window.srts have neither and do not count.
// `pending`: ids waiting in Review Captured (buffered captures keep the
// video id at `detail.videoId`). An id that is pending is reported only
// there, never also under `library`.

function _idList(idsJson) {
  let ids
  try { ids = JSON.parse(idsJson) } catch (_) { return [] }
  if (!Array.isArray(ids)) return []
  return ids.filter(id => typeof id === 'string' && id.length > 0)
}

// Pure: { ready, library, pending } for the ids in `idsJson` (a JSON array of
// video ids). Nothing is reported until `ready`, so a half-loaded page never
// claims a video is missing.
export function knownVideos(idsJson, { ready, srts, captured }) {
  if (!ready) return { ready: false, library: [], pending: [] }
  const ids = _idList(idsJson)
  const inIndex = new Set((Array.isArray(srts) ? srts : [])
    .filter(s => s && s.link && (s.src || s.pushed)).map(s => s.link))
  const inBuffer = new Set((Array.isArray(captured) ? captured : [])
    .map(c => c && c.detail && c.detail.videoId).filter(Boolean))
  return {
    ready: true,
    library: ids.filter(id => inIndex.has(id) && !inBuffer.has(id)),
    pending: ids.filter(id => inBuffer.has(id)),
  }
}
