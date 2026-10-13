// Account operations against GitHub. This part: the users list from
// trexsatya/cupitor-users, cached in localStorage, with the owner as the
// fallback. users.json is filled by other people's pull requests, so every
// entry is untrusted: each one is validated, bad ones are dropped, a login
// appears once, and the owner's entry always comes from the code.
// Pure: fetch and storage are injected so jest can drive them.

import {
  OWNER, USERS_REPO, USERS_CACHE_KEY, DATA_REPO,
  normalizeUser, isOwnerLogin, sameLogin, isValidLogin, cleanName, defaultOther,
  loadAccount, saveAccount,
} from './account-state.js'
import { fetchWithRetry } from './net.js'

export const USERS_RAW_URL = `https://raw.githubusercontent.com/${OWNER.login}/${USERS_REPO}/main/users.json`
// Limits on what strangers' pull requests can make every client download
// and keep: the list file in bytes, and the entries kept (owner included).
export const MAX_USERS_BYTES = 256 * 1024
export const MAX_USERS = 500

// Any access to the global localStorage can throw (SecurityError when site
// data is blocked), so reaching it is guarded too.
function store(storage) {
  if (storage) return storage
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch (_) {
    return null
  }
}

export function ownerEntry() { return { ...OWNER } }

// ---- users list ----

// A list of raw entries → the owner first, then each valid entry once
// (first one wins, logins compared ignoring case). The owner's own entry in
// the list is ignored: theirs is OWNER.
function cleanUsers(list) {
  const seen = new Set([OWNER.login.toLowerCase()])
  const users = [ownerEntry()]
  for (const raw of list) {
    if (users.length >= MAX_USERS) break
    const u = normalizeUser(raw)
    if (!u || isOwnerLogin(u.login)) continue
    const key = u.login.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    users.push(u)
  }
  return users
}

// UTF-8 size of a string without TextEncoder (absent in some test setups).
// A surrogate pair counts 2 + 2 = 4 bytes.
function utf8Bytes(s) {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xd800 && c <= 0xdfff) ? 2 : 3
  }
  return n
}

function tooLarge(text) {
  if (typeof text !== 'string') return false
  if (text.length > MAX_USERS_BYTES) return true
  return text.length * 3 > MAX_USERS_BYTES && utf8Bytes(text) > MAX_USERS_BYTES
}

// users.json text → cleaned entries, the owner first, at most MAX_USERS.
// Text over MAX_USERS_BYTES or not a JSON list throws.
export function parseUsers(text) {
  if (tooLarge(text)) throw new Error('users.json is too large')
  let v
  try { v = JSON.parse(text) } catch (e) { throw new Error('users.json is not valid JSON') }
  if (!Array.isArray(v)) throw new Error('users.json is not a list')
  return cleanUsers(v)
}

// The cached list, re-validated, or null when there is none or it is unusable.
export function cachedUsers(storage) {
  const s = store(storage)
  try {
    const raw = s ? s.getItem(USERS_CACHE_KEY) : null
    if (!raw) return null
    const v = JSON.parse(raw)
    return Array.isArray(v) ? cleanUsers(v) : null
  } catch (_) {
    return null
  }
}

// Fresh list when the network answers with a usable users.json (and the
// cache is refreshed), else the cached list, else only the owner. Never
// throws. `tries` / `sleep` tune the retry (tests pass a no-op sleep).
export async function fetchUsers({
  fetchFn = (typeof fetch !== 'undefined' ? fetch : null),
  storage, tries = 2, timeoutMs = 10000, sleep,
} = {}) {
  const s = store(storage)
  try {
    if (!fetchFn) throw new Error('no fetch')
    const r = await fetchWithRetry(USERS_RAW_URL, { tries, timeoutMs }, { fetch: fetchFn, sleep })
    const users = parseUsers(await r.text())
    try { if (s) s.setItem(USERS_CACHE_KEY, JSON.stringify(users)) } catch (_) {}
    return users
  } catch (_) {
    return cachedUsers(s) || [ownerEntry()]
  }
}

// ---- GitHub adapter helpers ----

// The GitHub calls this module makes, from window.GitHubUtils (direct fetch
// in a browser, the app's GitHubProxy inside the app). Tests inject a fake.
export function defaultGh() {
  const u = typeof window !== 'undefined' ? window.GitHubUtils : null
  if (!u) throw new Error('account: GitHubUtils is not loaded')
  return { request: u.request, getFile: u.getFile, putFile: u.putFile }
}

// The HTTP status of a GitHubUtils.request failure ("GitHub API error <n>:
// ..."), or 0 when the error carries none (proxy timeout, network).
function statusOf(err) {
  const m = /^GitHub API error (\d+)\b/.exec(String(err && err.message))
  return m ? Number(m[1]) : 0
}
const isNotFound = e => statusOf(e) === 404

export class SetupError extends Error {
  constructor(step, code, message) { super(message); this.name = 'SetupError'; this.step = step; this.code = code }
}

// Whether <login>/<repo> on <branch> carries the cupitor.json marker. Only a
// 404 means "no"; any other failure throws, so a flaky network never makes
// a ready user look like one without a repo.
async function repoHasMarker(gh, login, repo, branch) {
  try {
    await gh.request('GET', `/repos/${login}/${repo}/contents/cupitor.json?ref=${encodeURIComponent(branch)}`)
    return true
  } catch (e) {
    if (isNotFound(e)) return false
    throw e
  }
}

// ---- who am I ----

// { login, name } for the token in use, or null when GitHub answers 401
// (no token, or a bad / revoked one). Every other failure throws — a 403
// (rate limit, token without access), a 5xx, a proxy status 0 or timeout,
// or a 200 without a usable login — so the caller can tell "signed out"
// from "could not find out" and keep the current account on the latter.
export async function fetchLogin(gh = defaultGh()) {
  let u
  try {
    u = await gh.request('GET', '/user')
  } catch (e) {
    if (statusOf(e) === 401) return null
    throw e
  }
  if (!u || !isValidLogin(u.login)) throw new Error('account: GitHub /user answered without a login')
  return { login: u.login, name: cleanName(u.name, u.login) }
}

// Records `me` (from fetchLogin) as the account and returns the new state.
// The owner always writes to the owner repo. Anyone else is ready when
// their data repo — the one recorded for this login before, else
// cupitor-data on main — carries cupitor.json; otherwise they are signed
// in with no repo. The same login (ignoring case) keeps its chosen other;
// a new login gets the default. A failed repo check throws and leaves the
// record as it was. When storage cannot be written, the adopted state is
// still returned (the device keeps reading its old record).
export async function adoptLogin(me, { gh = defaultGh(), storage } = {}) {
  const login = me && me.login
  if (!isValidLogin(login)) throw new Error('account: adoptLogin needs a valid login')
  const prev = loadAccount(storage)
  const same = !prev.legacy && sameLogin(prev.login, login)
  let repo = null, branch = null
  if (isOwnerLogin(login)) {
    repo = OWNER.repo; branch = OWNER.branch
  } else {
    const name = (same && prev.repo) || DATA_REPO
    const onBranch = (same && prev.repo && prev.branch) || 'main'
    if (await repoHasMarker(gh, login, name, onBranch)) { repo = name; branch = onBranch }
  }
  // Re-read after the network call: the other may have been changed (e.g.
  // in another tab) while the check was in flight.
  const cur = loadAccount(storage)
  const other = !cur.legacy && sameLogin(cur.login, login) ? cur.other : defaultOther(login)
  const next = { login, repo, branch, other }
  const saved = saveAccount(next, storage) ? loadAccount(storage) : null
  if (!saved || saved.legacy) return { ...next, other: other ? normalizeUser(other) : null }
  return saved
}
