// Where the language app reads from and writes to. Every raw URL and every
// GitHub write target in language.js comes from here; nothing else names an
// owner, repo or branch.
//
//   self    — the signed-in user's own repo (editable). Absent for a guest
//             and for a signed-in user whose repo is not set up yet.
//   other   — one other listed user's repo, read-only. Absent when "none".
//   primary — self when present, else other. What the single-source code
//             paths (practice log, resource base URL) use.
//
// The account state is read from localStorage once, on first use, and then
// kept. Nothing here notices a later sign-in, sign-out or repo setup: after
// any of those, call configure(loadAccount()) (or reload the page) so reads
// and writes follow the new account. configure(null) drops the kept state
// so the next use reads localStorage again.

import { loadAccount, sources } from './account-state.js'
import { fetchWithRetry } from './net.js'
import { parseVocabularyFile } from './vocab-merge.js'

// ---- layered reads ----
let _layerStats = { other: { hits: 0, misses: 0, errors: 0 } }
export function resetLayerStats() { _layerStats = { other: { hits: 0, misses: 0, errors: 0 } } }
export function layerStats() { return JSON.parse(JSON.stringify(_layerStats)) }

let _state = null
// Keeps a shallow copy, so later changes to the caller's object do not leak in.
export function configure(state) { _state = state ? { ...state } : null; resetLayerStats() }
function state() { return _state || (_state = loadAccount()) }
export function currentSources() { return sources(state()) }

// The language goes into raw URL paths, so only plain names pass.
const LANG_RE = /^[a-z][a-z-]*$/

export function langFromLocation(loc = (typeof window !== 'undefined' ? window.location : null)) {
  try {
    const v = (new URL(loc.href).searchParams.get('lang') || '').toLowerCase()
    return LANG_RE.test(v) ? v : 'swedish'
  } catch (_) { return 'swedish' }
}

export function rawBase(src, lang) {
  return `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${src.branch}/db/language/${lang}`
}

export class NoSelfRepoError extends Error {
  constructor() { super('Set up your repo to save changes'); this.name = 'NoSelfRepoError' }
}

export function source(who) {
  const s = currentSources()
  if (who === 'self') return s.self
  if (who === 'other') return s.other
  if (who === 'primary') return s.self || s.other
  throw new Error(`data-source: unknown source "${who}"`)
}
export function hasSelf() { return !!currentSources().self }
export function hasOther() { return !!currentSources().other }

// Raw URL under db/language/<lang>/ for the given source. `path` may be ''
// for the directory itself. `path` is raw, not URL-encoded: each '/'-separated
// segment is encoded here with encodeURIComponent (so spaces, '||', '#', '%'
// and non-Latin names survive). A caller that appends a filename to the
// returned URL encodes that filename itself, as language.js does today.
// '.' and '..' segments are refused.
export function readUrl(who, path, lang = langFromLocation()) {
  checkLang(lang)
  const segments = pathSegments(path)
  const src = source(who)
  if (!src) throw new Error(`data-source: no ${who} source`)
  return urlFor(src, segments, lang)
}

function checkLang(lang) {
  if (typeof lang !== 'string' || !LANG_RE.test(lang)) throw new Error(`data-source: invalid lang "${lang}"`)
}
function pathSegments(path) {
  const segments = path ? String(path).split('/') : []
  if (segments.some(s => s === '.' || s === '..')) throw new Error(`data-source: invalid path "${path}"`)
  return segments
}
function urlFor(src, segments, lang) {
  const base = rawBase(src, lang)
  return segments.length ? `${base}/${segments.map(encodeURIComponent).join('/')}` : base
}

// { owner, repo, branch } of self. Writes never go anywhere else.
export function writeTarget() {
  const s = currentSources().self
  if (!s) throw new NoSelfRepoError()
  return { owner: s.owner, repo: s.repo, branch: s.branch }
}

// Fetch one file from every present source, self first. Each layer is
// { src, owner, text } with text null when the file is not there (404, one
// request, no retries). `path` is raw, as for readUrl. The other layer may
// fail without stopping the app: it is dropped and `onNotice(message)` is
// called. A self failure that is not a 404 throws.
export async function readLayers(path, { lang = langFromLocation(), fetchFn, onNotice = () => {}, retry = {} } = {}) {
  checkLang(lang)
  const segments = pathSegments(path)
  const s = currentSources()
  const out = []
  for (const [src, cfg] of [['self', s.self], ['other', s.other]]) {
    if (!cfg) continue
    const url = urlFor(cfg, segments, lang)
    try {
      const res = await fetchWithRetry(url, { ...retry, passthrough404: true }, fetchFn ? { fetch: fetchFn } : {})
      const text = res.status === 404 ? null : await res.text()
      if (src === 'other') { if (text == null) _layerStats.other.misses++; else _layerStats.other.hits++ }
      out.push({ src, owner: cfg.owner, text })
    } catch (e) {
      if (src === 'self') throw e
      _layerStats.other.errors++
      try { onNotice(`Could not load ${path} from ${cfg.owner}/${cfg.repo}: ${e && e.message}`) } catch (_) {}
    }
  }
  return out
}

function parseList(text, src, label) {
  if (text == null || !String(text).trim()) return []
  try {
    const v = JSON.parse(text)
    if (!Array.isArray(v)) throw new Error('not a list')
    return v
  } catch (e) {
    if (src === 'self') throw new Error(`${label} is not a valid list: ${e.message}`)
    return null // other: skip the layer
  }
}

// srts/index.json layers ([{ link, name, source }]) → one list. Key: link.
// Self wins; every entry carries src, owner and readOnly — strip those
// before writing a list back.
export function mergeIndexLayers(layers) {
  const out = []
  const seen = new Set()
  for (const layer of layers || []) {
    const arr = parseList(layer.text, layer.src, 'index.json')
    if (!arr) continue
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue
      if (it.link != null) {
        if (seen.has(it.link)) continue
        seen.add(it.link)
      }
      out.push({ ...it, src: layer.src, owner: layer.owner, readOnly: layer.src !== 'self' })
    }
  }
  return out
}

// srts/categorisation.txt: lines "category || channel || title || link"
// (4 parts); any other line has no category (8 spaces, as language.js's
// fetchCategorisation). Returns { link: category }.
export function parseCategorisation(text) {
  const out = {}
  if (text == null) return out
  String(text).split('\n').forEach(raw => {
    const line = raw.replace(/\r$/, '')
    if (!line) return
    const l = line.split(' || ')
    out[l[l.length - 1]] = l.length === 4 ? l[0] : '        '
  })
  return out
}

// Self wins per link (layers come self first, as readLayers returns them).
export function mergeCategorisationLayers(layers) {
  const out = {}
  for (const layer of layers || []) {
    const map = parseCategorisation(layer.text)
    for (const k of Object.keys(map)) if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = map[k]
  }
  return out
}

// vocabulary.txt: self categories first; a line from other is appended to
// its category when self does not have that line anywhere. `readOnly` is the
// set of appended lines (by text) — they never go into a commit.
// `otherCategories` names the categories that exist only because of other.
export function mergeVocabularyLayers(selfText, otherText) {
  const vocab = parseVocabularyFile(selfText || '')
  const readOnly = new Set()
  const otherCategories = new Set()
  if (!otherText) return { vocab, readOnly, otherCategories }
  const other = parseVocabularyFile(otherText)
  const selfLines = new Set(Object.values(vocab).flat().filter(l => l && l.trim()))
  for (const cat of Object.keys(other)) {
    if (cat === '__empty__') continue
    const added = new Set()
    for (const line of other[cat]) {
      if (!line || !line.trim() || selfLines.has(line) || added.has(line)) continue
      if (!vocab[cat]) { vocab[cat] = []; otherCategories.add(cat) }
      vocab[cat].push(line)
      added.add(line)
      readOnly.add(line)
    }
  }
  return { vocab, readOnly, otherCategories }
}

// The editable part of a merged vocabulary: read-only lines removed; a
// category left with no lines of its own is dropped when it came only from
// other (named in `otherCategories` when given, else guessed: every line in
// it was read-only), and so is an empty pre-header bucket. A line the user
// added to an other-only category keeps that category.
export function withoutReadOnlyLines(vocab, readOnly, otherCategories) {
  const out = {}
  for (const cat of Object.keys(vocab || {})) {
    const lines = vocab[cat] || []
    const kept = lines.filter(l => !readOnly.has(l))
    const fromOtherOnly = kept.length === 0 &&
      (otherCategories ? otherCategories.has(cat) : lines.length > 0)
    if (fromOtherOnly) continue
    if (cat === '__empty__' && !kept.some(l => l && l.trim())) continue
    out[cat] = kept
  }
  return out
}

// recordings.json ({ collectionName: { items, ... } }): the name is the key;
// self wins and comes first. Other's collections are tagged
// { readOnly: true, src: 'other' } so the UI hides edit controls and the
// persister skips them.
function isCollection(c) { return !!c && typeof c === 'object' && !Array.isArray(c) }
export function mergeRecordingLayers(selfColl, otherColl) {
  const out = {}
  for (const name of Object.keys(selfColl || {})) {
    const c = selfColl[name]
    if (isCollection(c)) out[name] = c
  }
  for (const name of Object.keys(otherColl || {})) {
    const c = otherColl[name]
    if (Object.prototype.hasOwnProperty.call(out, name)) continue
    if (isCollection(c)) out[name] = { ...c, readOnly: true, src: 'other' }
  }
  return out
}
