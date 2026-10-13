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
// No record at all means the legacy owner (see legacyOwner); a guest is an
// explicit record with a null login, written by saveGuest.

export const ACCOUNT_KEY = 'cupitor:account'
export const USERS_CACHE_KEY = 'cupitor:users'

export const OWNER = Object.freeze({ login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
export const USERS_REPO = 'cupitor-users'
export const TEMPLATE_REPO = 'cupitor-data-template'
export const DATA_REPO = 'cupitor-data'

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

// These values are put into raw URLs and API paths, so only GitHub-shaped
// names pass.
const LOGIN_RE = /^[A-Za-z0-9-]+$/
const REPO_RE = /^[A-Za-z0-9_.-]+$/
// eslint-disable-next-line no-control-regex
const BRANCH_BAD_RE = /[\s\u0000-\u001f\u007f]/

export function isValidLogin(v) {
  return typeof v === 'string' && LOGIN_RE.test(v)
}

export function isValidRepo(v) {
  return typeof v === 'string' && REPO_RE.test(v) && v !== '.' && v !== '..'
}

export function isValidBranch(v) {
  return typeof v === 'string' && v.length > 0 && !v.includes('..') &&
    !v.startsWith('/') && !BRANCH_BAD_RE.test(v)
}

function sameLogin(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
}

export function isOwnerLogin(login) {
  return sameLogin(login, OWNER.login)
}

// A users.json entry made safe: login and repo are required, name defaults
// to the login, a missing or empty branch to main. Anything invalid is null.
export function normalizeUser(u) {
  if (!u || typeof u !== 'object' || Array.isArray(u)) return null
  const { login, repo } = u
  if (!isValidLogin(login) || !isValidRepo(repo)) return null
  const branch = u.branch == null || u.branch === '' ? 'main' : u.branch
  if (!isValidBranch(branch)) return null
  return {
    login,
    name: typeof u.name === 'string' && u.name ? u.name : login,
    repo,
    branch,
  }
}

// Guests and every user but the owner start out reading the owner's library.
export function defaultOther(login) {
  return isOwnerLogin(login) ? null : { ...OWNER }
}

// No usable record at all (absent, unreadable, unparsable, or not a JSON
// object): the device predates accounts, so it is the owner's. `legacy: true`
// tells "never set" apart from a record that was chosen; saveAccount does
// not persist it.
function legacyOwner() {
  return { login: OWNER.login, repo: OWNER.repo, branch: OWNER.branch, other: defaultOther(OWNER.login), legacy: true }
}

// A JSON object record is taken as chosen: one whose login is null, absent
// or invalid is a guest (self none, other the owner unless one is stored).
export function loadAccount(storage) {
  const s = store(storage)
  let raw = null
  try { raw = s ? s.getItem(ACCOUNT_KEY) : null } catch (_) {}
  let v = null
  try { v = raw ? JSON.parse(raw) : null } catch (_) {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return legacyOwner()
  const login = isValidLogin(v.login) ? v.login : null
  let repo = login && isValidRepo(v.repo) ? v.repo : null
  let branch = repo && isValidBranch(v.branch) ? v.branch : null
  if (!branch) repo = null
  if (!repo && isOwnerLogin(login)) { repo = OWNER.repo; branch = OWNER.branch }
  // Explicit null means "none"; absent or invalid means the default.
  let other
  if ('other' in v && v.other === null) other = null
  else other = normalizeUser(v.other) || defaultOther(login)
  if (other && sameLogin(other.login, login)) other = null
  return { login, repo, branch, other }
}

// Returns true when the record was written, false otherwise; never throws.
export function saveAccount(state, storage) {
  const s = store(storage)
  if (!s || !state) return false
  const { login, repo, branch, other } = state
  try {
    s.setItem(ACCOUNT_KEY, JSON.stringify({ login, repo, branch, other: other ? normalizeUser(other) : null }))
    return true
  } catch (_) {
    return false
  }
}

// Writes the explicit guest record. Sign-out uses this, not clearAccount:
// with no record the device reads as the legacy owner.
// Returns true when written, false otherwise; never throws.
export function saveGuest(storage) {
  const s = store(storage)
  if (!s) return false
  try {
    s.setItem(ACCOUNT_KEY, JSON.stringify({ login: null, repo: null, branch: null }))
    return true
  } catch (_) {
    return false
  }
}

// Removes the record, so the device reads as the legacy owner again. Not for
// sign-out: that must write the guest record with saveGuest.
// Returns true when the record was removed, false otherwise; never throws.
export function clearAccount(storage) {
  const s = store(storage)
  if (!s) return false
  try {
    s.removeItem(ACCOUNT_KEY)
    return true
  } catch (_) {
    return false
  }
}

// { self, other } as { owner, repo, branch } or null. The owner without a
// repo of record writes to the owner repo; an other equal to self is none.
export function sources(state) {
  let self = null
  if (state.login && state.repo && state.branch) {
    self = { owner: state.login, repo: state.repo, branch: state.branch }
  } else if (isOwnerLogin(state.login)) {
    self = { owner: state.login, repo: OWNER.repo, branch: OWNER.branch }
  }
  const o = state.other && !sameLogin(state.other.login, state.login)
    ? { owner: state.other.login, repo: state.other.repo, branch: state.other.branch }
    : null
  return { self, other: o }
}

// Whose local data a storage key belongs to, lowercased so a login's case
// never splits its data. A guest shares the device's plain keys with the
// owner (that is where the pre-account data lives); any other login gets its
// own suffix.
export function storageOwner(state) {
  return state.login ? state.login.toLowerCase() : OWNER.login
}

export function scopedKey(base, state = loadAccount()) {
  const owner = storageOwner(state)
  return owner === OWNER.login ? base : `${base}@${owner}`
}
