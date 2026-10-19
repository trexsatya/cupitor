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
let _sourceNoticeSent = false
// Keeps a shallow copy, so later changes to the caller's object do not leak in.
export function configure(state) { _state = state ? { ...state } : null; _sourceNoticeSent = false; resetLayerStats() }
function state() { return _state || (_state = loadAccount()) }

// Owner, repo and branch go into raw URLs and API paths as they are, so each
// must be a plain name (a branch may be '/'-separated plain names). A source with anything else is left out: no self
// means no writes, no other means no layered library.
const SAFE_NAME_RE = /^[\w.-]+$/
const safeName = v => typeof v === 'string' && SAFE_NAME_RE.test(v) && v !== '.' && v !== '..'
const SAFE_BRANCH_RE = /^[\w.-]+(\/[\w.-]+)*$/
const safeBranch = v => typeof v === 'string' && SAFE_BRANCH_RE.test(v) && v.split('/').every(p => p !== '.' && p !== '..')
const safeSource = s => safeName(s.owner) && safeName(s.repo) && safeBranch(s.branch)

export function currentSources() {
  const s = sources(state())
  return {
    self: s.self && safeSource(s.self) ? s.self : null,
    other: s.other && safeSource(s.other) ? s.other : null,
  }
}

// Messages for the sources left out by currentSources (empty when none).
export function sourceProblems() {
  const s = sources(state())
  const out = []
  if (s.self && !safeSource(s.self)) out.push('Your data repo name in this browser is not valid, so changes cannot be saved. Set up your repo again.')
  if (s.other && !safeSource(s.other)) out.push("The other user's library could not be loaded: its repo name is not valid.")
  return out
}

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

// The parsed JSON of one of the user's own files (practice log, starred
// lines): never the other user's. `fallback` when there is no self (no
// request is made), the file is missing, the request fails or the text is
// not JSON; never throws. Failures other than a 404 go to `log`. `query` is
// appended to the URL as given; `init` is passed to fetch.
export async function fetchSelfJson(path, {
  lang = langFromLocation(), query = '', init, fallback = null, fetchFn,
  log = (m, e) => { try { console.warn(m, e) } catch (_) {} },
} = {}) {
  let url
  try {
    if (!hasSelf()) return fallback
    url = readUrl('self', path, lang) + query
  } catch (e) { log(`fetchSelfJson: no URL for ${path}`, e); return fallback }
  try {
    const f = fetchFn || fetch
    const res = init === undefined ? await f(url) : await f(url, init)
    if (res.status === 404) return fallback
    if (!res.ok) { log(`fetchSelfJson: ${path} answered ${res.status}`); return fallback }
    return await res.json()
  } catch (e) {
    log(`fetchSelfJson: could not read ${path}`, e)
    return fallback
  }
}

// raw.githubusercontent.com answers 404 both for a file a repo does not have
// (a new repo made from the template has almost none) and for a repo that is
// gone (renamed, deleted or made private). The GitHub API tells them apart:
// GET /repos/<owner>/<repo> answers 404 only when the repo cannot be seen.
// One answer per repo per page load: true (there), false (gone), null (could
// not tell: network error, rate limit). The promise is kept, so files missing
// at the same time share one request; a "could not tell" is kept too, so a
// gone repo seen through a failed check stays unreported until a reload.
const _repoChecks = new Map()
const _repoGoneNoticed = new Set()
export function resetRepoChecks() { _repoChecks.clear(); _repoGoneNoticed.clear() }

export function repoExists(src, { fetchFn } = {}) {
  const key = `${src.owner}/${src.repo}`.toLowerCase()
  if (!_repoChecks.has(key)) {
    const url = `https://api.github.com/repos/${encodeURIComponent(src.owner)}/${encodeURIComponent(src.repo)}`
    _repoChecks.set(key, fetchWithRetry(url, { tries: 1, timeoutMs: 8000, passthrough404: true, init: { cache: 'no-store' } }, fetchFn ? { fetch: fetchFn } : {})
      .then(res => res.status !== 404, () => null))
  }
  return _repoChecks.get(key)
}

// After a 404 from the other layer: tells `onNotice` (once per page load per
// repo) when the other repo itself is gone. A missing file in a repo that is
// there is an empty layer and says nothing; so does a check that could not
// be made.
export async function checkOtherRepo(onNotice, { fetchFn } = {}) {
  const o = currentSources().other
  if (!o || !onNotice) return
  const exists = await repoExists(o, { fetchFn })
  const key = `${o.owner}/${o.repo}`.toLowerCase()
  if (exists !== false || _repoGoneNoticed.has(key)) return
  _repoGoneNoticed.add(key)
  try { onNotice(`${o.owner}/${o.repo} could not be found — the repo may have been renamed, deleted or made private, so ${o.owner}'s library is not shown.`) } catch (_) {}
}

// Fetch one file from every present source, self first. Each layer is
// { src, owner, text } with text null when the file is not there (404, one
// request, no retries). With `onNotice`, an other-layer 404 also starts
// checkOtherRepo (in the background), so a gone repo is reported and an
// empty one is not. `path` is raw, as for readUrl. The other layer may
// fail without stopping the app: it is dropped and `onNotice(message)` is
// called. A self failure that is not a 404 throws. `retry` is passed to
// fetchWithRetry for every layer; `otherRetry`, when given, replaces it for
// the other layer when there is also a self layer, so a failing other repo
// can be given up on quickly. With no self (a guest) other is the only
// source and keeps `retry`. A source left out for an invalid repo name (see
// sourceProblems) is reported through `onNotice` once per configure, to the
// first caller that passes one.
export async function readLayers(path, { lang = langFromLocation(), fetchFn, onNotice, retry = {}, otherRetry } = {}) {
  checkLang(lang)
  const segments = pathSegments(path)
  const s = currentSources()
  if (onNotice && !_sourceNoticeSent) {
    _sourceNoticeSent = true
    for (const m of sourceProblems()) { try { onNotice(m) } catch (_) {} }
  }
  const out = []
  for (const [src, cfg] of [['self', s.self], ['other', s.other]]) {
    if (!cfg) continue
    const url = urlFor(cfg, segments, lang)
    try {
      const opts = src === 'other' && s.self && otherRetry ? otherRetry : retry
      const res = await fetchWithRetry(url, { ...opts, passthrough404: true }, fetchFn ? { fetch: fetchFn } : {})
      const text = res.status === 404 ? null : await res.text()
      if (src === 'other') { if (text == null) _layerStats.other.misses++; else _layerStats.other.hits++ }
      // Not awaited: the answer is only a notice, and a slow API must not hold up the read.
      if (src === 'other' && text == null && onNotice) checkOtherRepo(onNotice, { fetchFn }).catch(() => {})
      out.push({ src, owner: cfg.owner, text })
    } catch (e) {
      if (src === 'self') throw e
      _layerStats.other.errors++
      if (onNotice) try { onNotice(`Could not load ${path} from ${cfg.owner}/${cfg.repo}: ${e && e.message}`) } catch (_) {}
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
// Self wins: an entry is left out when an earlier layer has its link. Links
// repeated inside one layer are all kept, as the file has them (the
// duplicate-entry cleanup lists them). Every entry carries src, owner and
// readOnly — strip those before writing a list back.
export function mergeIndexLayers(layers) {
  const out = []
  const seen = new Set()
  for (const layer of layers || []) {
    const arr = parseList(layer.text, layer.src, 'index.json')
    if (!arr) continue
    const links = []
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue
      if (it.link != null) {
        if (seen.has(it.link)) continue
        links.push(it.link)
      }
      out.push({ ...it, src: layer.src, owner: layer.owner, readOnly: layer.src !== 'self' })
    }
    links.forEach(l => seen.add(l))
  }
  return out
}

// Whether a cached subtitle record ({ owner? }) came from the repo the merged
// index entry ({ owner? }) names. Either side without an owner belongs to
// `primaryOwner` (records cached before owners were stored, entries added
// this session). Logins compare without case.
export function cacheRecordMatches(record, entry, primaryOwner) {
  const want = (entry && entry.owner) || primaryOwner || ''
  const have = (record && record.owner) || primaryOwner || ''
  return String(want).toLowerCase() === String(have).toLowerCase()
}

// Why the other layer of a JSON list file (e.g. srts/index.json) adds
// nothing, as a message for the user, or null when it is fine or absent.
// A missing file is an empty list (a gone repo is reported by
// checkOtherRepo instead).
export function otherListProblem(layers, path) {
  const o = (layers || []).find(l => l && l.src === 'other')
  if (!o) return null
  if (o.text == null) return null
  if (parseList(o.text, 'other', path) === null) return `${path} from ${o.owner} is not a valid list and was skipped.`
  return null
}

// srts/categorisation.txt: lines "category || channel || title || link"
// (4 parts); any other line has no category (8 spaces, as language.js's
// fetchCategorisation). Returns { link: category }.
//
// Maps built here have no prototype and are checked with hasOwn, so a link
// or category named `toString`, `constructor` or `__proto__` is an
// ordinary key.
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
export function parseCategorisation(text) {
  const out = Object.create(null)
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
  const out = Object.create(null)
  for (const layer of layers || []) {
    const map = parseCategorisation(layer.text)
    for (const k of Object.keys(map)) if (!hasOwn(out, k)) out[k] = map[k]
  }
  return out
}

// vocabulary.txt: self categories first; a line from other is appended to
// its category when self does not have that line anywhere. `readOnly` is the
// set of appended lines (by text) — they never go into a commit.
// `otherCategories` names the categories that exist only because of other.
// `vocab` has no prototype (see parseVocabularyFile).
export function mergeVocabularyLayers(selfText, otherText) {
  return addOtherVocabulary(parseVocabularyFile(selfText || ''), otherText)
}

// Adds other's lines to `vocab` (a self map, changed in place) as above.
function addOtherVocabulary(vocab, otherText) {
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
      if (!hasOwn(vocab, cat)) { vocab[cat] = []; otherCategories.add(cat) }
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
//
// Known limitation: read-only lines are tracked by text, so a line the user
// adds that is identical to one of other's lines is dropped here too and is
// not saved — unless claimVocabularyLines took it out of `readOnly` first, as
// adding a line in the vocabulary dialog does.
export function withoutReadOnlyLines(vocab, readOnly, otherCategories) {
  const out = Object.create(null)
  for (const cat of Object.keys(vocab || {})) {
    const lines = (hasOwn(vocab, cat) && vocab[cat]) || []
    const kept = lines.filter(l => !readOnly.has(l))
    const fromOtherOnly = kept.length === 0 &&
      (otherCategories ? otherCategories.has(cat) : lines.length > 0)
    if (fromOtherOnly) continue
    if (cat === '__empty__' && !kept.some(l => l && l.trim())) continue
    out[cat] = kept
  }
  return out
}

// The vocabulary to show and edit, from readLayers('vocabulary.txt').
//   vocab           — self's lines with other's added (mergeVocabularyLayers)
//   readOnly, otherCategories — what withoutReadOnlyLines needs to keep
//                     other's lines out of a save
//   baselineText    — self's file as loaded: the base of the 3-way merge on
//                     save. Never other's text.
//   otherText       — other's file, kept to add its lines again after a save
// With no self (a guest) other's vocabulary is shown as it is, and every
// line and category of it is read-only, so nothing of it can be saved.
export function vocabularyFromLayers(layers) {
  const self = (layers || []).find(l => l && l.src === 'self')
  const other = (layers || []).find(l => l && l.src === 'other')
  const otherText = other && other.text != null ? other.text : null
  if (self) {
    return { ...mergeVocabularyLayers(self.text, otherText), baselineText: self.text || '', otherText }
  }
  const vocab = parseVocabularyFile(otherText || '')
  return {
    vocab,
    readOnly: new Set(Object.values(vocab).flat()),
    otherCategories: new Set(Object.keys(vocab)),
    baselineText: '',
    otherText,
  }
}

// Own lines of the named categories, for the unsaved-edits buffer in
// localStorage: read-only lines are left out (so a buffer replayed later,
// when other's lines may have changed or other is not loaded, holds nothing
// of theirs), and so is a category with no own line that came only from
// other. The map has no prototype.
export function pendingVocabCategories(vocab, names, readOnly, otherCategories) {
  const picked = Object.create(null)
  for (const cat of names || []) if (hasOwn(vocab || {}, cat) && Array.isArray(vocab[cat])) picked[cat] = vocab[cat]
  return withoutReadOnlyLines(picked, readOnly, otherCategories)
}

// After own categories were replaced (a replayed buffer): take the own lines
// again and add other's lines from `otherText` anew. Returns what
// mergeVocabularyLayers returns; the given map and arrays are not changed.
export function relayerVocabulary(vocab, readOnly, otherCategories, otherText) {
  return addOtherVocabulary(withoutReadOnlyLines(vocab, readOnly, otherCategories), otherText)
}

// A line the user adds is their own even when the other user has the same
// text. Read-only lines are tracked by text, so without this the user's line
// would be dropped on save. The other user's copies of `lines` are taken out
// of the map (an other-only category left empty goes too) and out of
// `readOnly`; the caller then inserts the user's copy. Returns
// { vocab, readOnly } as new objects, or the given ones when none of `lines`
// is read-only. The inputs are not changed.
export function claimVocabularyLines(vocab, readOnly, otherCategories, lines) {
  const claimed = new Set((lines || []).filter(l => readOnly && readOnly.has(l)))
  if (!claimed.size) return { vocab, readOnly }
  const nextReadOnly = new Set([...readOnly].filter(l => !claimed.has(l)))
  const out = Object.create(null)
  for (const cat of Object.keys(vocab || {})) {
    const lines = (hasOwn(vocab, cat) && vocab[cat]) || []
    const kept = lines.filter(l => !claimed.has(l))
    if (kept.length === 0 && lines.length > 0 && otherCategories && otherCategories.has(cat)) continue
    out[cat] = kept
  }
  return { vocab: out, readOnly: nextReadOnly }
}

// recordings.json ({ collectionName: { items, ... } }): the name is the key;
// self wins and comes first. Other's collections are tagged
// { readOnly: true, src: 'other' } so the UI hides edit controls and the
// persister skips them.
function isCollection(c) { return !!c && typeof c === 'object' && !Array.isArray(c) }
export function mergeRecordingLayers(selfColl, otherColl) {
  const out = Object.create(null)
  for (const name of Object.keys(selfColl || {})) {
    const c = selfColl[name]
    if (isCollection(c)) out[name] = c
  }
  for (const name of Object.keys(otherColl || {})) {
    const c = otherColl[name]
    if (hasOwn(out, name)) continue
    if (isCollection(c)) out[name] = { ...c, readOnly: true, src: 'other' }
  }
  return out
}
