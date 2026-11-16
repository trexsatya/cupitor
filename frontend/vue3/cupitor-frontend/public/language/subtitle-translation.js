// Companion tracks may skip or split cues, so sequence numbers are not
// reliable for matching them to the original subtitle.
function trackLookup(cues, matchOverlap) {
  const timed = cues.filter(cue => cue.start && cue.end && cue.text?.trim())
  const byStart = new Map(timed.map(cue => [cue.start.ordinal, cue.text.trim()]))
  if (!matchOverlap || !timed.length) return cue => byStart.get(cue.start?.ordinal)

  timed.sort((a, b) => a.start.ordinal - b.start.ordinal)
  let latestEnd = -Infinity
  const ends = timed.map(cue => (latestEnd = Math.max(latestEnd, cue.end.ordinal)))
  return cue => {
    const start = cue.start?.ordinal, end = cue.end?.ordinal
    const exact = byStart.get(start)
    if (exact) return exact

    // Find the first candidate whose end can still overlap the source cue.
    let first = 0, last = timed.length
    while (first < last) {
      const mid = (first + last) >>> 1
      if (ends[mid] <= start) first = mid + 1
      else last = mid
    }
    let best, overlap = 0
    for (let i = first; i < timed.length && timed[i].start.ordinal < end; i++) {
      const candidate = timed[i]
      const shared = Math.min(end, candidate.end.ordinal) - Math.max(start, candidate.start.ordinal)
      if (shared > overlap) { best = candidate; overlap = shared }
    }
    return best?.text.trim()
  }
}

export function createSubtitleTranslationLookup({ preferred = [], language = 'en', english = [] } = {}) {
  const preferredText = trackLookup(preferred, true)
  const englishText = trackLookup(english, language !== 'en')
  return cue => {
    if (!cue) return null
    const text = preferredText(cue)
    if (text) return { text, language }
    const fallback = englishText(cue)
    return fallback ? { text: fallback, language: 'en' } : null
  }
}
