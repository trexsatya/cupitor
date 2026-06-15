// View-model for the "Review Captured Subtitles" dialog. Each entry in
// the captured buffer carries an SRT capture event (`detail`) that the
// dialog renders as a card the user can preview / push / delete.
//
// Buffer entry shape (set by bufferCapturedSubtitle in language.js):
//   { id, capturedAt, detail: {
//       videoId, videoTitle, sourceLang, targetLang,
//       lines: [...], translation: [...],
//       query?, matchIndex?
//   }}
//
// The async "is this SRT already on remote?" check stays in language.js;
// `pushButtonLabel(state)` shapes the live label per state.

// Build the per-row VM. Falsy fields are coerced to safe defaults so
// the renderer can blindly emit them.
export function buildCapturedRowVM(item) {
  const d = (item && item.detail) || {}
  return {
    id: (item && item.id) || '',
    title: d.videoTitle || d.videoId || 'unknown',
    videoId: d.videoId || '',
    sourceLang: d.sourceLang || '?',
    targetLang: d.targetLang || '?',
    srcLineCount: Array.isArray(d.lines) ? d.lines.length : 0,
    tgtLineCount: Array.isArray(d.translation) ? d.translation.length : 0,
    query: d.query || '',
    matchIndex: d.matchIndex != null ? String(d.matchIndex) : '',
  }
}

// "Push This" → "Push (merge)" when the SRT already exists upstream
// (state === 'modify'). For any other state, default label.
export function pushButtonLabel(state) {
  return state === 'modify' ? 'Push (merge)' : 'Push This'
}
