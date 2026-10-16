import { capturedSlotText } from './srt-parser.js'

// Older records may contain only the captured lines, even after a successful
// push. Re-fetch them once; only complete remote snapshots are reusable.
export const SUBTITLE_CONTENT_VERSION = 2
export function reusableSubtitleCache(record) {
  return !!(record && record.contentVersion === SUBTITLE_CONTENT_VERSION &&
    record.complete === true && typeof record.sv === 'string' && record.sv)
}

// A complete repository pair plus captures which have not been pushed yet.
// Do not union an arbitrary old cache: it can resurrect discarded conflicts
// or lines belonging to another user's version of the same video.
export function subtitleSnapshot(snapshot, captures = []) {
  let sv = snapshot.sv || null
  let en = snapshot.en || null
  for (const detail of captures) {
    sv = capturedSlotText(sv, detail.lines)
    en = capturedSlotText(en, detail.translation)
  }
  const result = { ...snapshot, sv, en, _remoteComplete: true, _partial: false }
  delete result._parsedSv
  delete result._parsedEn
  return result
}
