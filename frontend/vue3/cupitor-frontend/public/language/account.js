// Account operations against GitHub. This part: the users list from
// trexsatya/cupitor-users, cached in localStorage, with the owner as the
// fallback. users.json is filled by other people's pull requests, so every
// entry is untrusted: each one is validated, bad ones are dropped, a login
// appears once, and the owner's entry always comes from the code.
// Pure: fetch and storage are injected so jest can drive them.

import { OWNER, USERS_REPO, USERS_CACHE_KEY, normalizeUser, isOwnerLogin } from './account-state.js'
import { fetchWithRetry } from './net.js'

export const USERS_RAW_URL = `https://raw.githubusercontent.com/${OWNER.login}/${USERS_REPO}/main/users.json`

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
    const u = normalizeUser(raw)
    if (!u || isOwnerLogin(u.login)) continue
    const key = u.login.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    users.push(u)
  }
  return users
}

// users.json text → cleaned entries, the owner first. Text that is not a
// JSON list throws.
export function parseUsers(text) {
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
