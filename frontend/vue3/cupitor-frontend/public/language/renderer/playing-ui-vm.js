// View-model + pure helpers for the Playing UI (the now-playing banner
// over the recording playback + the subtitle context overlay shown
// alongside YouTube during play). DOM emission lives in the sibling
// `playing-ui-render.js`; the player wiring (gap stepper button
// handlers, YT polling) stays in language.js because it touches live
// player state.

import { isManualItem } from '../recordings-merge.js'
import { contiguousClipWindow } from '../random-playlist.js'

// Build a Unicode-bounded regex from `pattern` (already a regex source —
// caller is responsible for escaping). Falls back to unbounded for old
// engines without lookbehind / \p. Shared by highlightWordHtml and the
// multi-row phrase check.
export function buildBoundedWordRe(pattern, flags = 'giu') {
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, flags)
  } catch (_) {
    return new RegExp(`(${pattern})`, flags.replace('u', ''))
  }
}

// True if `word` (treated as a literal phrase) appears in any of `texts`.
// Used to decide whether to allow per-token fallback: when the WHOLE
// phrase is present on at least one rendered row, suppress fallback
// everywhere — otherwise a composite word like "x y z" would also light
// up its standalone parts on neighbouring rows.
export function phraseFoundInTexts(texts, word) {
  const w = String(word == null ? '' : word).trim()
  if (!w || !Array.isArray(texts) || !texts.length) return false
  const reEsc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = buildBoundedWordRe(reEsc)
  for (const t of texts) {
    if (!t) continue
    re.lastIndex = 0
    if (re.test(String(t))) return true
  }
  return false
}

// opts.allowTokens (default true): when false, the per-token fallback is
// suppressed and only the whole-phrase match is highlighted. Callers that
// pre-scan a corpus (Player / Practice) pass `false` whenever the whole
// phrase was found on at least one row, so the standalone parts on other
// rows don't also light up.
//
// Returns an HTML string. Inputs are HTML-escaped; the match positions
// have `<mark class="hl-word">…</mark>` spliced in around them.
export function highlightWordHtml(text, word, opts) {
  const t = (text == null ? '' : String(text)).trim()
  const w = (word == null ? '' : String(word)).trim()
  const allowTokens = !opts || opts.allowTokens !== false
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  if (!w) return esc(t)
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splice = (spans) => {
    if (!spans.length) return esc(t)
    let out = ''
    let lastIdx = 0
    for (const sp of spans) {
      out += esc(t.slice(lastIdx, sp.start))
      out += `<mark class="hl-word">${esc(t.slice(sp.start, sp.end))}</mark>`
      lastIdx = sp.end
    }
    out += esc(t.slice(lastIdx))
    return out
  }
  const collectSpans = (re) => {
    const spans = []
    let m
    re.lastIndex = 0
    while ((m = re.exec(t)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length })
      if (m.index === re.lastIndex) re.lastIndex++
    }
    return spans
  }
  const fullSpans = collectSpans(buildBoundedWordRe(reEsc(w)))
  if (fullSpans.length) return splice(fullSpans)
  if (!allowTokens) return esc(t)
  const tokens = w.split(/\s+/).map(s => s.trim()).filter(Boolean)
  if (tokens.length <= 1) return esc(t)
  const tokenRe = buildBoundedWordRe(tokens.map(reEsc).join('|'))
  const tokenSpans = collectSpans(tokenRe)
  tokenSpans.sort((a, b) => a.start - b.start)
  const merged = []
  for (const sp of tokenSpans) {
    const last = merged[merged.length - 1]
    if (last && sp.start <= last.end) last.end = Math.max(last.end, sp.end)
    else merged.push({ ...sp })
  }
  return splice(merged)
}

// Locate the subtitle line whose [start, end) brackets `t`; fall back to
// the first line at-or-after `t`. Returns -1 when nothing applies.
// Used for the live playhead refresh tick.
export function findLineByTime(lines, t) {
  if (!lines || !lines.length) return -1
  let i = lines.findIndex(l => l && l.start && l.end && l.start.ordinal <= t && l.end.ordinal > t)
  if (i < 0) i = lines.findIndex(l => l && l.start && l.start.ordinal >= t)
  return i
}

// Recover the matched cue when a recorded item's `lineIndex` no longer exists
// in the subtitle file — e.g. the SRT was re-segmented (or re-fetched) after the
// item was captured, so its stored index falls outside the current cue set.
// `lineIndex` is fragile; the clip time window (timeStart/timeEnd) and the
// captured word are stable, so we fall back to those. Order: an in-window cue
// containing the word → the cue at the window's midpoint (time only) → the word
// anywhere. Returns -1 when no anchor resolves (callers then treat as no-match).
export function resolveMatchIdxByTimeWord(primary, item) {
  if (!primary || !primary.length || !item) return -1
  const ts = Number(item.timeStart)
  const te = Number(item.timeEnd)
  const hasWin = Number.isFinite(ts) && Number.isFinite(te) && te >= ts
  const word = item.word ? String(item.word).toLowerCase().trim() : ''
  const overlapsWin = l => hasWin && l && l.start && l.end &&
    typeof l.start.ordinal === 'number' && typeof l.end.ordinal === 'number' &&
    l.end.ordinal > ts && l.start.ordinal < te
  const hasWord = l => !!word && String((l && l.text) || '').toLowerCase().includes(word)
  if (word && hasWin) {
    const i = primary.findIndex(l => overlapsWin(l) && hasWord(l))
    if (i >= 0) return i
  }
  if (hasWin) {
    const i = findLineByTime(primary, (ts + te) / 2)
    if (i >= 0) return i
  }
  if (word) {
    const i = primary.findIndex(hasWord)
    if (i >= 0) return i
  }
  return -1
}

// Recompute a recorded item's clip window from the CURRENT parsed subtitles so a
// stored [timeStart, timeEnd] built before the sparse-snippet fix (or captured
// across a temporal gap) doesn't overshoot at play time. Locates the matched cue
// (by lineIndex, else time+word recovery), then contracts to the contiguous run
// around it. The walk is bounded to the STORED window, so this only ever SHRINKS
// a clip (trims gap overshoot) — it never lengthens one. Manual items and
// unlocatable cues return null so the caller keeps the stored window.
export function contiguousPlayWindow(primary, item, opts = {}) {
  if (!primary || !primary.length || !item || isManualItem(item)) return null
  const want = String(item.lineIndex)
  let pos = primary.findIndex(l => l && l.index != null && String(l.index) === want)
  if (pos < 0) pos = resolveMatchIdxByTimeWord(primary, item)
  if (pos < 0) return null
  const cues = primary.map(l => ({
    ts: l && l.start && l.start.ordinal,
    te: l && l.end && l.end.ordinal,
  }))
  // Bound the walk to the stored window so play-time only trims overshoot.
  let loBound = 0
  let hiBound = cues.length - 1
  const sStart = Number(item.timeStart)
  const sEnd = Number(item.timeEnd)
  if (Number.isFinite(sStart) && Number.isFinite(sEnd) && sEnd > sStart) {
    for (let i = 0; i < cues.length; i++) {
      if (Number.isFinite(cues[i].te) && cues[i].te > sStart) { loBound = i; break }
    }
    for (let i = cues.length - 1; i >= 0; i--) {
      if (Number.isFinite(cues[i].ts) && cues[i].ts < sEnd) { hiBound = i; break }
    }
    if (pos < loBound) loBound = pos
    if (pos > hiBound) hiBound = pos
  }
  const win = contiguousClipWindow(cues, pos, {
    loBound, hiBound,
    gapThreshold: opts.gapThreshold,
    maxDuration: opts.maxDuration == null ? Infinity : opts.maxDuration,
  })
  if (!(win.timeEnd > win.timeStart)) return null
  return { timeStart: win.timeStart, timeEnd: win.timeEnd, matchIdx: pos }
}

// Build the now-playing banner VM:
//   { progressText, headText, metaText, isManual, gapLabel }
// `gapSeconds` is the active inter-item gap; the renderer feeds it to
// the gap stepper's read-out.
export function buildPlayingBannerVM(it, idx, total, gapSeconds) {
  const safeIdx = Number.isFinite(idx) ? idx : 0
  const safeTotal = Number.isFinite(total) ? total : 0
  const _gap = parseInt(gapSeconds, 10)
  const gap = Number.isFinite(_gap) ? _gap : 30
  if (!it) {
    return {
      isManual: false, progressText: `${safeIdx + 1}/${safeTotal}`,
      headText: '', metaText: '', word: '', gapLabel: `${gap}s`,
    }
  }
  if (isManualItem(it)) {
    const linkLbl = it.mediaUrl
      ? ` · ${it.mediaKind === 'youtube' ? '▶ YouTube' : '🔗 link'}`
      : ''
    return {
      isManual: true,
      progressText: `${safeIdx + 1}/${safeTotal}`,
      headText: `📝 ${it.source || '(empty)'}`,
      metaText: `${it.target || '(empty)'}${linkLbl}`,
      word: it.word || '',
      gapLabel: `${gap}s`,
    }
  }
  return {
    isManual: false,
    progressText: `${safeIdx + 1}/${safeTotal}`,
    headText: `▶ "${it.searchText}" → ${it.word}`,
    metaText: `${it.id} · ${it.source || '?'} · ${it.timeStart}s – ${it.timeEnd}s`,
    word: it.word || '',
    gapLabel: `${gap}s`,
  }
}

// Build the playing-subtitles VM. Inputs:
//   parsed: { sv: [...], en: [...] }  — both languages parsed from SRTs
//   lang:   'sv' | 'en'                — user's selected primary
//   item:   {lineIndex, word, ...}     — recorded match
//   before, after:                       context-line counts from settings
//
// Returns one of:
//   { state: 'no-primary' }
//   { state: 'no-match' }
//   { state: 'ok', from, to, matchIdx, primary, rows: [{ i, mainText, secText, active, highlightHtml? }] }
export function buildPlayingSubsVM({ parsed, lang, item, before, after }) {
  if (!parsed) return { state: 'no-primary' }
  const _lang = lang === 'sv' ? 'sv' : 'en'
  const _secLang = _lang === 'sv' ? 'en' : 'sv'
  const primary = _lang === 'sv' ? parsed.sv : parsed.en
  const secondary = _lang === 'sv' ? parsed.en : parsed.sv
  if (!primary || !primary.length) return { state: 'no-primary' }

  const want = String(item && item.lineIndex)
  let matchIdx = primary.findIndex(l => l && l.index != null && String(l.index) === want)
  // Stale lineIndex (SRT re-segmented since capture) → recover by time + word.
  if (matchIdx < 0) matchIdx = resolveMatchIdxByTimeWord(primary, item)
  if (matchIdx < 0) return { state: 'no-match' }

  const _before = Math.max(0, parseInt(before, 10) || 0)
  const _after = Math.max(0, parseInt(after, 10) || 0)
  const from = Math.max(0, matchIdx - _before)
  const to = Math.min(primary.length - 1, matchIdx + _after)

  const secById = new Map()
  if (secondary) secondary.forEach(s => { if (s && s.index != null) secById.set(s.index + '', s) })

  const mainTexts = []
  for (let i = from; i <= to; i++) {
    const line = primary[i]
    mainTexts.push((line && (line.text || line[_lang] || '')) || '')
  }
  const allowTokens = !!(item && item.word) && !phraseFoundInTexts(mainTexts, item.word)

  const rows = []
  for (let i = from; i <= to; i++) {
    const line = primary[i]
    const sec = line && line.index != null ? secById.get(line.index + '') : null
    const mainText = mainTexts[i - from]
    const secText = sec && (sec.text || sec[_secLang] || '') || ''
    rows.push({
      i,
      mainText: String(mainText).trim(),
      secText: secText.trim(),
      active: i === matchIdx,
      highlightHtml: (item && item.word)
        ? highlightWordHtml(mainText, item.word, { allowTokens })
        : null,
    })
  }

  return { state: 'ok', from, to, matchIdx, primary, rows }
}
