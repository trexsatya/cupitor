import { rawBase } from './data-source.js'
import { fetchWithRetry, parseRemoteList } from './net.js'

export const SUBTITLE_CAPTURE_WORDS_FILE = 'subtitle-capture-words.json'

function normalizeTerm(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/gu, ' ').toLowerCase().normalize('NFC')
    : ''
}

export function capturedSubtitleTerms(details) {
  return details
    .filter(detail => detail?.sourceLang && Array.isArray(detail.lines) && detail.lines.length)
    .map(detail => normalizeTerm(detail.query))
    .filter(term => /\p{L}/u.test(term))
}

function parseTerms(text) {
  const terms = parseRemoteList(text, SUBTITLE_CAPTURE_WORDS_FILE)
  if (terms.some(term => typeof term !== 'string' || !term.trim())) {
    throw new Error('Invalid subtitle capture words')
  }
  return new Set(terms.map(normalizeTerm))
}

export function mergeSubtitleCaptureTerms(current, terms) {
  const merged = parseTerms(current)
  for (const term of terms) merged.add(term)
  return JSON.stringify([...merged].sort()) + '\n'
}

export async function fetchSubtitleCaptureWordCount(user, lang, fetchFn) {
  const base = rawBase({ ...user, owner: user.login }, lang)
  const url = `${base}/${SUBTITLE_CAPTURE_WORDS_FILE}`
  try {
    const response = await fetchWithRetry(url, {
      tries: 1, timeoutMs: 5000, passthrough404: true, init: { cache: 'no-cache' },
    }, { fetch: fetchFn })
    return response.status === 404 ? 0 : parseTerms(await response.text()).size
  } catch (_) {
    return null
  }
}
