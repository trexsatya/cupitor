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
// Pure: the account state is read once from localStorage and can be set
// with configure() in tests.

import { loadAccount, sources } from './account-state.js'

// ---- layered reads ----
let _layerStats = { other: { hits: 0, misses: 0, errors: 0 } }
export function resetLayerStats() { _layerStats = { other: { hits: 0, misses: 0, errors: 0 } } }
export function layerStats() { return JSON.parse(JSON.stringify(_layerStats)) }

let _state = null
export function configure(state) { _state = state; resetLayerStats() }
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
// for the directory itself.
export function readUrl(who, path, lang = langFromLocation()) {
  if (typeof lang !== 'string' || !LANG_RE.test(lang)) throw new Error(`data-source: invalid lang "${lang}"`)
  const src = source(who)
  if (!src) throw new Error(`data-source: no ${who} source`)
  const base = rawBase(src, lang)
  return path ? `${base}/${path}` : base
}

// { owner, repo, branch } of self. Writes never go anywhere else.
export function writeTarget() {
  const s = currentSources().self
  if (!s) throw new NoSelfRepoError()
  return { owner: s.owner, repo: s.repo, branch: s.branch }
}
