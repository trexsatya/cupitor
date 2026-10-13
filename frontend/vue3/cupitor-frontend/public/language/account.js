// Account operations against GitHub. This part: the users list from
// trexsatya/cupitor-users, cached in localStorage, with the owner as the
// fallback. users.json is filled by other people's pull requests, so every
// entry is untrusted: each one is validated, bad ones are dropped, a login
// appears once, and the owner's entry always comes from the code.
// Pure: fetch and storage are injected so jest can drive them.

import {
  OWNER, USERS_REPO, USERS_CACHE_KEY, DATA_REPO, TEMPLATE_REPO,
  normalizeUser, isOwnerLogin, sameLogin, isValidLogin, isValidRepo, cleanName, defaultOther,
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

// A setup step that failed: `step` names it ('repo', …), `code` says why.
// `status` (the HTTP status, 0 when none) and `cause` are set when the
// failure came from GitHub.
export class SetupError extends Error {
  constructor(step, code, message, { status, cause } = {}) {
    super(message)
    this.name = 'SetupError'; this.step = step; this.code = code
    if (status !== undefined) this.status = status
    if (cause !== undefined) this.cause = cause
  }
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
// their data repo — the one recorded for this login before, else (or when
// that one has no marker) cupitor-data on main — carries cupitor.json; otherwise they are signed
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
    if (await repoHasMarker(gh, login, name, onBranch)) {
      repo = name; branch = onBranch
    } else if ((name !== DATA_REPO || onBranch !== 'main') && await repoHasMarker(gh, login, DATA_REPO, 'main')) {
      // The recorded repo is gone (deleted, renamed, marker removed): the
      // default one may still be there.
      repo = DATA_REPO; branch = 'main'
    }
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

// ---- setup step 1: the data repo ----

const SETUP_WAIT_MS = 30000
const SETUP_POLL_MS = 2000
const defaultSleep = ms => new Promise(r => setTimeout(r, ms))
const TEMPLATE_FULL_NAME = `${OWNER.login}/${TEMPLATE_REPO}`.toLowerCase()

// Any failure of a setup step as a SetupError for that step: a 401 is
// 'unauthorized', every other GitHub or network failure 'github'.
function asSetupError(step, e) {
  if (e instanceof SetupError) return e
  const status = statusOf(e)
  return new SetupError(step, status === 401 ? 'unauthorized' : 'github',
    String((e && e.message) || e), { status, cause: e })
}

// The repo as GitHub describes it, or null when it does not exist.
async function getRepo(gh, login, repo) {
  try { return (await gh.request('GET', `/repos/${login}/${repo}`)) || {} }
  catch (e) { if (isNotFound(e)) return null; throw e }
}

const fromTemplate = r => {
  const t = r && r.template_repository
  return !!(t && typeof t.full_name === 'string' && t.full_name.toLowerCase() === TEMPLATE_FULL_NAME)
}

// The marker on main; a repo GitHub has not filled in yet answers 404 or
// 409 (empty repository), both "not yet".
async function markerOnMain(gh, login, repo) {
  try { return await repoHasMarker(gh, login, repo, 'main') }
  catch (e) { if (statusOf(e) === 409) return false; throw e }
}

// Creates <login>/<repoName> from the template unless it is already there,
// and waits until GitHub has filled it in (cupitor.json on main). Every
// call checks before acting, so a retry after any failure resumes: a repo
// generated from the template that is still filling in is waited for, not
// generated again. A repo of that name that is not a Cupitor data repo →
// SetupError 'repo_taken' (ask for another name). The owner's repo is never
// created. `report(step, status)` gets 'checking' / 'creating' / 'done'.
// Throws SetupError (step 'repo') on any failure; `sleep` / `now` are
// injected so tests do not wait.
export async function ensureDataRepo({
  login, repoName = DATA_REPO, gh, sleep = defaultSleep, now = Date.now, report = () => {},
} = {}) {
  if (!isValidLogin(login)) throw new SetupError('repo', 'bad_login', 'Sign in before setting up a repo.')
  if (!isValidRepo(repoName)) throw new SetupError('repo', 'bad_name', 'That repo name cannot be used. Use letters, digits, ".", "-" or "_".')
  report('repo', 'checking')
  if (isOwnerLogin(login)) {
    report('repo', 'done')
    return { repo: OWNER.repo, branch: OWNER.branch, created: false }
  }
  try {
    const github = gh || defaultGh()
    let created = false
    const r0 = await getRepo(github, login, repoName)
    let r = r0
    const triedGenerate = !r0
    if (!r) {
      report('repo', 'creating')
      try {
        await github.request('POST', `/repos/${OWNER.login}/${TEMPLATE_REPO}/generate`,
          { owner: login, name: repoName, private: false, include_all_branches: false, description: 'Cupitor language data' })
        created = true
      } catch (e) {
        // 422: the name is taken after all (an earlier attempt whose answer
        // was lost, another tab) — look at what is there.
        if (statusOf(e) !== 422) throw e
        r = await getRepo(github, login, repoName)
        if (!r) throw e
      }
    }
    if (r) {
      if (await markerOnMain(github, login, repoName)) {
        report('repo', 'done')
        return { repo: repoName, branch: 'main', created: false }
      }
      if (!fromTemplate(r)) {
        throw new SetupError('repo', 'repo_taken', `${login}/${repoName} already exists and is not a Cupitor data repo. Choose another name.`)
      }
      if (!triedGenerate) report('repo', 'creating')
    }
    // GitHub fills a generated repo in asynchronously; the marker says it is done.
    const deadline = now() + SETUP_WAIT_MS
    while (!(await markerOnMain(github, login, repoName))) {
      if (now() >= deadline) throw new SetupError('repo', 'timeout', 'GitHub is still creating the repo. Retry in a moment.')
      await sleep(SETUP_POLL_MS)
    }
    report('repo', 'done')
    return { repo: repoName, branch: 'main', created }
  } catch (e) {
    throw asSetupError('repo', e)
  }
}
