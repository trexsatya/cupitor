// The account record and what follows from it: which repo is "self" (writes
// go there), which repo is "other" (read-only layer), and how localStorage /
// IndexedDB names are scoped so two people's data on one device never mix.
// Pure: storage is injected (defaults to localStorage) so jest can drive it.
//
// Record shape in localStorage `cupitor:account`:
//   { login, repo, branch, other }
//   login  — GitHub login, null for a guest
//   repo / branch — the user's data repo; both null until setup created it
//   other  — a users.json entry { login, name, repo, branch } to layer on
//            read-only, or null for none. Absent → the default for the login.

export const ACCOUNT_KEY = 'cupitor:account'
export const USERS_CACHE_KEY = 'cupitor:users'

export const OWNER = Object.freeze({ login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
export const USERS_REPO = 'cupitor-users'
export const TEMPLATE_REPO = 'cupitor-data-template'
export const DATA_REPO = 'cupitor-data'

function store(storage) {
  if (storage) return storage
  return typeof localStorage !== 'undefined' ? localStorage : null
}

// A users.json entry made safe: login and repo are required, name defaults
// to the login, branch to main. Anything else is null.
export function normalizeUser(u) {
  if (!u || typeof u !== 'object') return null
  const { login, repo } = u
  if (typeof login !== 'string' || !login || typeof repo !== 'string' || !repo) return null
  return {
    login,
    name: typeof u.name === 'string' && u.name ? u.name : login,
    repo,
    branch: typeof u.branch === 'string' && u.branch ? u.branch : 'main',
  }
}

// Guests and every user but the owner start out reading the owner's library.
export function defaultOther(login) {
  return login === OWNER.login ? null : { ...OWNER }
}

export function loadAccount(storage) {
  const s = store(storage)
  let raw = null
  try { raw = s ? s.getItem(ACCOUNT_KEY) : null } catch (_) {}
  let v = null
  try { v = raw ? JSON.parse(raw) : null } catch (_) {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) v = {}
  const login = typeof v.login === 'string' && v.login ? v.login : null
  const repo = login && typeof v.repo === 'string' && v.repo ? v.repo : null
  const branch = repo && typeof v.branch === 'string' && v.branch ? v.branch : null
  let other = ('other' in v) ? normalizeUser(v.other) : defaultOther(login)
  if (other && other.login === login) other = null
  return { login, repo: branch ? repo : null, branch, other }
}

export function saveAccount(state, storage) {
  const s = store(storage)
  if (!s) return
  const { login, repo, branch, other } = state
  s.setItem(ACCOUNT_KEY, JSON.stringify({ login, repo, branch, other: other ? normalizeUser(other) : null }))
}

export function clearAccount(storage) {
  const s = store(storage)
  if (!s) return
  s.removeItem(ACCOUNT_KEY)
}

// { self, other } as { owner, repo, branch } or null.
export function sources(state) {
  const self = state.login && state.repo && state.branch
    ? { owner: state.login, repo: state.repo, branch: state.branch }
    : null
  const o = state.other && (!self || state.other.login !== self.owner)
    ? { owner: state.other.login, repo: state.other.repo, branch: state.other.branch }
    : null
  return { self, other: o }
}

// Whose local data a storage key belongs to. A guest shares the device's
// plain keys with the owner (that is where the pre-account data lives); any
// other login gets its own suffix.
export function storageOwner(state) {
  return state.login || OWNER.login
}

export function scopedKey(base, state = loadAccount()) {
  const owner = storageOwner(state)
  return owner === OWNER.login ? base : `${base}@${owner}`
}
