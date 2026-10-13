// Account operations against GitHub. This part: the users list from
// trexsatya/cupitor-users, cached in localStorage, with the owner as the
// fallback. users.json is filled by other people's pull requests, so every
// entry is untrusted: each one is validated, bad ones are dropped, a login
// appears once, and the owner's entry always comes from the code.
// Pure: fetch and storage are injected so jest can drive them.

import {
  OWNER, USERS_REPO, USERS_CACHE_KEY, DATA_REPO, TEMPLATE_REPO,
  normalizeUser, isOwnerLogin, sameLogin, isValidLogin, isValidRepo, cleanName, defaultOther,
  loadAccount, saveAccount, saveGuest, sources, storageOwner, scopedKey,
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
// their data repo — the one recorded for this login before (or recorded as
// missing), else cupitor-data on main — carries cupitor.json; otherwise
// they are signed in with no repo. A recorded repo without the marker is
// never swapped for another one (a 404 may only mean the repo went
// private): the state gets `missingRepo: { repo, branch }` instead, kept in
// the record and checked again at the next sign-in. The same login
// (ignoring case) keeps its chosen other;
// a new login gets the default. A failed repo check throws and leaves the
// record as it was. When storage cannot be written, the adopted state is
// still returned (the device keeps reading its old record).
export async function adoptLogin(me, { gh = defaultGh(), storage } = {}) {
  const login = me && me.login
  if (!isValidLogin(login)) throw new Error('account: adoptLogin needs a valid login')
  const prev = loadAccount(storage)
  const same = !prev.legacy && sameLogin(prev.login, login)
  let repo = null, branch = null, missingRepo = null
  if (isOwnerLogin(login)) {
    repo = OWNER.repo; branch = OWNER.branch
  } else {
    const recorded = !same ? null
      : prev.repo ? { repo: prev.repo, branch: prev.branch }
      : prev.missingRepo || null
    const name = recorded ? recorded.repo : DATA_REPO
    const onBranch = recorded ? recorded.branch : 'main'
    if (await repoHasMarker(gh, login, name, onBranch)) {
      repo = name; branch = onBranch
    } else if (recorded) {
      missingRepo = { repo: name, branch: onBranch }
    }
  }
  // Re-read after the network call: the other may have been changed (e.g.
  // in another tab) while the check was in flight.
  const cur = loadAccount(storage)
  const other = !cur.legacy && sameLogin(cur.login, login) ? cur.other : defaultOther(login)
  const next = { login, repo, branch, other }
  if (missingRepo) next.missingRepo = missingRepo
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

// ---- setup step 2: an entry in users.json ----
//
// The user forks cupitor-users, commits their entry on branch add-<login>
// of the fork and opens a PR to the owner's repo. The PR for head
// <login>:add-<login> is how every later check finds the request again.

const USERS_FILE = 'users.json'
const UPSTREAM = `/repos/${OWNER.login}/${USERS_REPO}`
const UPSTREAM_FULL_NAME = `${OWNER.login}/${USERS_REPO}`.toLowerCase()
const addBranch = login => `add-${login}`

// users.json at `ref` of <owner>/<repo>: its text, blob sha and raw list.
// A file that parseUsers refuses (too large, not a list) throws.
async function readUsersFile(gh, owner, repo, ref) {
  const f = await gh.getFile(owner, repo, USERS_FILE, '', ref)
  const text = f && typeof f.content === 'string' ? f.content : ''
  parseUsers(text)
  return { text, sha: f.sha, list: JSON.parse(text) }
}

const hasValidEntry = (list, login) => list.some(u => {
  const n = normalizeUser(u)
  return !!n && sameLogin(n.login, login)
})

// One entry on one line, keys in their own order: the file's usual layout.
function entryLine(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return JSON.stringify(e)
  return `{ ${Object.keys(e).map(k => `${JSON.stringify(k)}: ${JSON.stringify(e[k])}`).join(', ')} }`
}
const usersText = (list, eol = '\n') => (list.length
  ? `[${eol}${list.map(e => `  ${entryLine(e)}`).join(`,${eol}`)}${eol}]${eol}`
  : `[]${eol}`)

// users.json text with `entry` in it. An (invalid) entry already there for
// the same login is replaced; otherwise the entry is appended. In the usual
// layout every other line stays as it was; in any other layout the entry is
// put in before the closing bracket and the rest of the text is kept. Lines
// end the way the file's do (CRLF or LF). The result is parsed back and
// must be the old list plus (or with) the entry.
function usersWithEntry(text, entry) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const list = JSON.parse(text)
  const i = list.findIndex(u => u && typeof u === 'object' && sameLogin(u.login, entry.login))
  const next = list.slice()
  if (i >= 0) next[i] = entry; else next.push(entry)
  let out
  if (i >= 0 || !list.length || usersText(list, eol) === text) {
    out = usersText(next, eol)
  } else {
    const end = text.lastIndexOf(']')
    out = `${text.slice(0, end).replace(/\s+$/, '')},${eol}  ${entryLine(entry)}${eol}${text.slice(end)}`
  }
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(next)) throw new Error('account: users.json could not be updated cleanly')
  return out
}

// 'awaiting' (an open PR), 'listed' (a merged one), 'not_approved' (only
// closed ones) or 'none', from the PRs for head <login>:add-<login>.
async function prStatus(gh, login) {
  const head = encodeURIComponent(`${login}:${addBranch(login)}`)
  const prs = await gh.request('GET', `${UPSTREAM}/pulls?state=all&head=${head}`)
  // An empty or unreadable answer comes back as {}: never read it as "no PRs".
  if (!Array.isArray(prs)) throw new Error('account: GitHub answered the PR list without a list')
  const list = prs
  if (list.some(p => p && p.state === 'open')) return 'awaiting'
  // A merged PR counts as listed even if the entry was later removed.
  if (list.some(p => p && p.merged_at)) return 'listed'
  return list.length ? 'not_approved' : 'none'
}

// 'listed' | 'awaiting' | 'not_approved' | 'none' for `login`. Listed when
// users.json on cupitor-users main has a valid entry for the login (read
// through the API, not the raw file, so a merge shows without the raw
// file's cache delay); else the add-<login> PRs decide. A merged PR counts
// as listed even when the entry is not (yet) in the file read. The owner is
// always listed. Any failure throws — never 'none', which would start a
// second request.
export async function listingStatus({ login, gh } = {}) {
  if (!isValidLogin(login)) throw new Error('account: listingStatus needs a valid login')
  if (isOwnerLogin(login)) return 'listed'
  const github = gh || defaultGh()
  const { list } = await readUsersFile(github, OWNER.login, USERS_REPO, 'main')
  if (hasValidEntry(list, login)) return 'listed'
  return prStatus(github, login)
}

// The sha a ref answer points at.
function refSha(r) {
  const sha = r && r.object && r.object.sha
  if (typeof sha !== 'string' || !sha) throw new Error('account: GitHub answered a ref without a sha')
  return sha
}

const isUsersFork = r => !!(r && r.fork === true && [r.parent, r.source].some(p =>
  p && typeof p.full_name === 'string' && p.full_name.toLowerCase() === UPSTREAM_FULL_NAME))

// Whether the fork's main branch can be read yet (GitHub creates forks
// asynchronously; 404 / 409 mean "not yet").
async function forkReady(gh, login, fork) {
  try {
    await gh.request('GET', `/repos/${login}/${fork}/git/ref/heads/main`)
    return true
  } catch (e) {
    const s = statusOf(e)
    if (s === 404 || s === 409) return false
    throw e
  }
}

const FORK_PAGES = 5

// The name of the user's fork among upstream's forks (newest first, up to
// FORK_PAGES pages of 100), or null. Stops at the first match.
async function findUsersFork(gh, login) {
  for (let page = 1; page <= FORK_PAGES; page++) {
    const forks = await gh.request('GET', `${UPSTREAM}/forks?per_page=100&page=${page}`)
    if (!Array.isArray(forks)) throw new Error('account: GitHub answered the fork list without a list')
    const f = forks.find(x => x && x.owner && sameLogin(x.owner.login, login) && isValidRepo(x.name))
    if (f) return f.name
    if (forks.length < 100) return null
  }
  return null
}

// The name of the user's fork of cupitor-users, whatever it is called:
// <login>/cupitor-users when that is the fork, else the one in upstream's
// fork list; only when there is none is a fork made. Then waits (up to
// SETUP_WAIT_MS) until it can be read.
async function ensureUsersFork(gh, login, { sleep, now }) {
  const r = await getRepo(gh, login, USERS_REPO)
  let fork = isUsersFork(r) ? (isValidRepo(r.name) ? r.name : USERS_REPO) : null
  if (!fork) fork = await findUsersFork(gh, login)
  if (!fork) {
    const f = await gh.request('POST', `${UPSTREAM}/forks`, { default_branch_only: true })
    const mine = f && isValidRepo(f.name) && (!f.owner || sameLogin(f.owner.login, login))
    fork = mine ? f.name : USERS_REPO
  }
  const deadline = now() + SETUP_WAIT_MS
  while (!(await forkReady(gh, login, fork))) {
    if (now() >= deadline) throw new SetupError('listing', 'timeout', 'GitHub is still creating your copy of cupitor-users. Retry in a moment.')
    await sleep(SETUP_POLL_MS)
  }
  return fork
}

// Asks for `login` to be added to users.json, unless it is already listed
// or has a request (open, merged or closed). Every call checks before
// acting, so a retry after any failure resumes and never makes a second
// fork, branch, entry or PR:
//   fork cupitor-users (or find the fork) → sync it with upstream (best
//   effort) → branch add-<login> at upstream main → commit users.json =
//   upstream's file plus the entry → PR <login>:add-<login> into main.
// The branch carries exactly one change: when add-<login> exists without
// that content (an earlier attempt, upstream moved on), it is reset to
// upstream main first, after checking again that no PR uses it. The entry
// is { login, name, repo, branch } for the user's own repo; the owner gets
// 'listed' with no call at all. Returns the status ('awaiting' after opening the PR).
// Throws SetupError (step 'listing'). `report(step, status)` gets
// 'checking' / 'forking' / 'syncing' / 'branching' / 'committing' /
// 'opening-pr' / 'done'.
export async function ensureListing({
  login, name, repo, branch, gh, sleep = defaultSleep, now = Date.now, report = () => {},
} = {}) {
  if (!isValidLogin(login)) throw new SetupError('listing', 'bad_login', 'Sign in before asking to be listed.')
  if (isOwnerLogin(login)) {
    report('listing', 'checking')
    report('listing', 'done')
    return 'listed'
  }
  const entry = normalizeUser({ login, name: cleanName(name, login), repo, branch })
  if (!entry || entry.branch !== branch) throw new SetupError('listing', 'bad_entry', 'Set up your data repo before asking to be listed.')
  report('listing', 'checking')
  try {
    const github = gh || defaultGh()
    const status = await listingStatus({ login, gh: github })
    if (status !== 'none') {
      report('listing', 'done')
      return status
    }
    // The upstream file at one commit: the branch starts there and the
    // entry is added to exactly that text.
    const upSha = refSha(await github.request('GET', `${UPSTREAM}/git/ref/heads/main`))
    const up = await readUsersFile(github, OWNER.login, USERS_REPO, upSha)
    if (hasValidEntry(up.list, login)) {
      report('listing', 'done')
      return 'listed'
    }
    const wanted = usersWithEntry(up.text, entry)

    report('listing', 'forking')
    const fork = await ensureUsersFork(github, login, { sleep, now })

    report('listing', 'syncing')
    try {
      await github.request('POST', `/repos/${login}/${fork}/merge-upstream`, { branch: 'main' })
    } catch (e) {
      // The branch is cut from upstream main, so a fork whose main cannot be
      // synced (409: it has its own commits; anything else) is no reason to
      // stop; if upstream's commit is missing in the fork, the branch step
      // fails instead. Only a signed-out user stops here.
      if (statusOf(e) === 401) throw e
    }

    report('listing', 'branching')
    const work = addBranch(login)
    let fresh = true
    try {
      await github.request('POST', `/repos/${login}/${fork}/git/refs`, { ref: `refs/heads/${work}`, sha: upSha })
    } catch (e) {
      if (statusOf(e) !== 422) throw e // 422: the branch is already there
      fresh = false
    }

    report('listing', 'committing')
    let done = false
    if (!fresh) {
      let current = null
      try { current = (await github.getFile(login, fork, USERS_FILE, '', work)).content }
      catch (e) { if (!isNotFound(e)) throw e }
      done = current === wanted
      if (!done) {
        // Reset only a branch no PR uses (another tab may have opened one
        // since the first check).
        const latest = await prStatus(github, login)
        if (latest !== 'none') {
          report('listing', 'done')
          return latest
        }
        await github.request('PATCH', `/repos/${login}/${fork}/git/refs/heads/${work}`, { sha: upSha, force: true })
      }
    }
    if (!done) {
      // The branch is at upSha here, so its users.json is upstream's (up.sha).
      await github.putFile(login, fork, USERS_FILE, wanted, `Add ${login}`, up.sha, '', work)
    }

    report('listing', 'opening-pr')
    let result = 'awaiting'
    try {
      await github.request('POST', `${UPSTREAM}/pulls`, {
        title: `Add ${login}`,
        head: `${login}:${work}`,
        base: 'main',
        // Only login and repo (letters, digits, ".", "-", "_"): a branch name
        // may hold Markdown or an @mention.
        body: `Adds ${login} to users.json: data repo ${login}/${entry.repo}.`,
      })
    } catch (e) {
      // 422 also means "no commits" or "no such head"; only a PR that is
      // really there (another tab opened it) makes this a success.
      if (statusOf(e) !== 422) throw e
      result = await prStatus(github, login)
      if (result !== 'awaiting' && result !== 'listed') throw e
    }
    report('listing', 'done')
    return result
  } catch (e) {
    throw asSetupError('listing', e)
  }
}

// ---- the whole setup ----

// Runs both setup steps for `login` and resolves { status, state }: status
// from ensureListing, state the account record as saved. The data repo is
// `repoName`, else the repo recorded for this login (not a missingRepo:
// pass its name as repoName to set that one up again), else cupitor-data. The record gets the repo as soon as it exists, before the
// listing step, so a listing failure leaves the user able to write. The
// same login (ignoring case, never the legacy record) keeps its chosen
// other; anyone else gets the default. The owner goes through both steps
// with no network call and records the owner repo. Throws SetupError:
// step 'repo' or 'listing' from the steps, or step 'repo' code 'not_saved'
// when the record could not be written (the listing is then not started).
// A retry with the same arguments resumes.
export async function runSetup({
  login, name, repoName, gh, storage, sleep = defaultSleep, now = Date.now, report = () => {},
} = {}) {
  const prev = loadAccount(storage)
  const samePrev = isValidLogin(login) && !prev.legacy && sameLogin(prev.login, login)
  const wanted = isOwnerLogin(login) ? undefined : repoName || (samePrev && prev.repo) || DATA_REPO
  const r = await ensureDataRepo({ login, repoName: wanted, gh, sleep, now, report })
  // Re-read after the network calls: the other may have been changed (e.g.
  // in another tab) meanwhile.
  const cur = loadAccount(storage)
  const same = !cur.legacy && sameLogin(cur.login, login)
  const state = { login, repo: r.repo, branch: r.branch, other: same ? cur.other : defaultOther(login) }
  const kept = saveAccount(state, storage) ? loadAccount(storage) : null
  if (!kept || kept.legacy || kept.login !== login || kept.repo !== r.repo || kept.branch !== r.branch) {
    throw new SetupError('repo', 'not_saved',
      `${login}/${r.repo} is ready, but this browser could not save your account. Allow site data for this page and retry.`)
  }
  const status = await ensureListing({ login, name, repo: r.repo, branch: r.branch, gh, sleep, now, report })
  return { status, state: kept }
}

// ---- the browser's token ----
// A token pasted in a browser lives in sessionStorage (this tab only; it
// survives the reload that applies the account) unless "remember on this
// device" puts it in localStorage. Inside the app the webapp never holds a
// token: GitHubProxy attaches the app's own.

export const TOKEN_SESSION_KEY = 'cupitor:ghToken:session'
export const TOKEN_REMEMBER_KEY = 'cupitor:ghToken'
// When this device became a guest (ms). Written on sign-out, cleared once a
// sign-in has carried the guest's captures (carryGuestCaptures).
export const GUEST_SINCE_KEY = 'cupitor:guestSince'
// The captured-subtitle buffer's base key (language.js scopes it per owner).
export const CAPTURED_SUBTITLES_BASE = 'cupitor:capturedSubtitles'
const UNAUTHORIZED_EVENT = 'cupitorGithubUnauthorized'

// Reaching a global storage can throw (SecurityError when site data is
// blocked), and so can every call on it.
function globalStorage(name) {
  try { return typeof globalThis[name] !== 'undefined' ? globalThis[name] : null } catch (_) { return null }
}
function defaultStorages() {
  return { session: globalStorage('sessionStorage'), local: globalStorage('localStorage') }
}
const readKey = (s, k) => { try { return s ? s.getItem(k) : null } catch (_) { return null } }
const writeKey = (s, k, v) => { try { if (!s) return false; s.setItem(k, v); return true } catch (_) { return false } }
const dropKey = (s, k) => { try { if (s) s.removeItem(k) } catch (_) {} }

function defaultGhUtils() { return typeof window !== 'undefined' ? window.GitHubUtils || null : null }
// Inside the Cupitor app every GitHub request goes through GitHubProxy.
function inApp() { return typeof GitHubProxy !== 'undefined' }
const holdsToken = u => !!(u && typeof u.hasGHToken === 'function' && u.hasGHToken())

export function storedToken(storages = defaultStorages()) {
  return readKey(storages.local, TOKEN_REMEMBER_KEY) || readKey(storages.session, TOKEN_SESSION_KEY) || null
}

// Keeps the token in one place only. Returns whether it reads back.
export function rememberToken(token, remember, storages = defaultStorages()) {
  if (remember) { writeKey(storages.local, TOKEN_REMEMBER_KEY, token); dropKey(storages.session, TOKEN_SESSION_KEY) }
  else { writeKey(storages.session, TOKEN_SESSION_KEY, token); dropKey(storages.local, TOKEN_REMEMBER_KEY) }
  const other = remember ? readKey(storages.session, TOKEN_SESSION_KEY) : readKey(storages.local, TOKEN_REMEMBER_KEY)
  return storedToken(storages) === token && other == null
}

export function forgetToken(storages = defaultStorages()) {
  dropKey(storages.local, TOKEN_REMEMBER_KEY); dropKey(storages.session, TOKEN_SESSION_KEY)
}

// Puts the stored token into GitHubUtils; true when there was one.
export function applyStoredToken(ghUtils = defaultGhUtils(), storages = defaultStorages()) {
  const t = storedToken(storages)
  if (t && ghUtils) ghUtils.setGHToken(t)
  return !!t
}

const snapshotTokens = storages => ({ local: readKey(storages.local, TOKEN_REMEMBER_KEY), session: readKey(storages.session, TOKEN_SESSION_KEY) })
function restoreTokens(storages, snap) {
  if (snap.local == null) dropKey(storages.local, TOKEN_REMEMBER_KEY); else writeKey(storages.local, TOKEN_REMEMBER_KEY, snap.local)
  if (snap.session == null) dropKey(storages.session, TOKEN_SESSION_KEY); else writeKey(storages.session, TOKEN_SESSION_KEY, snap.session)
}

// While a sign-in or the boot check runs, the 401s it causes are its own to
// handle (a token being tried, or the check that finds the token gone), so
// the 401 handler stays out of the way.
let _quiet = 0

// ---- a guest's captures ----

function readList(s, key) {
  try {
    const v = JSON.parse(readKey(s, key) || '[]')
    return Array.isArray(v) ? v : []
  } catch (_) { return [] }
}

// A guest's local data lives under the guest's own keys, so after signing in
// their unsent captured subtitles would be left behind there. This moves
// every capture in the guest's buffer to `login`'s key (the plain key for
// the owner), skipping ids the target already has, and clears
// GUEST_SINCE_KEY. Pending subtitle and vocabulary edits and recordings are
// not moved: they are edits of the library the guest was reading, not new
// data of their own. Returns the number moved; never throws.
export function carryGuestCaptures(login, { storage } = {}) {
  const s = store(storage)
  if (!s || !isValidLogin(login)) return 0
  const settled = n => { dropKey(s, GUEST_SINCE_KEY); return n }
  const from = scopedKey(CAPTURED_SUBTITLES_BASE, { login: null })
  const to = scopedKey(CAPTURED_SUBTITLES_BASE, { login })
  const moving = readList(s, from).filter(c => c && typeof c === 'object')
  if (!moving.length) return settled(0)
  const target = readList(s, to)
  const have = new Set(target.map(c => c && c.id).filter(id => id != null))
  const fresh = moving.filter(c => c.id == null || !have.has(c.id))
  if (!writeKey(s, to, JSON.stringify(target.concat(fresh)))) return 0
  dropKey(s, from)
  return settled(moving.length)
}

// ---- sign in / out ----

// Browser only. Checks the token with GET /user, keeps it (session, or
// local when `remember`), records the account and returns the saved state;
// the caller reloads the page so it boots with the new sources and keys.
// On any failure the token that was in use before is back in place, nothing
// is recorded, and the error is thrown: "did not accept" for a 401, the
// GitHub error otherwise, or one saying the browser could not keep the
// token or the account. Only a stored token can be put back: one that was
// in memory only (e.g. typed into the legacy PAT prompt, never stored) is
// gone after a failed sign-in, and GitHubUtils is left without a token.
export async function signInWithToken(token, {
  remember = false, gh, ghUtils = defaultGhUtils(), storages = defaultStorages(), storage,
} = {}) {
  const t = String(token || '').trim()
  if (!t) throw new Error('No token given')
  if (inApp()) throw new Error('In the app, sign in through the app')
  if (!ghUtils) throw new Error('account: GitHubUtils is not loaded')
  const api = gh || defaultGh()
  const prev = loadAccount(storage)
  const before = snapshotTokens(storages)
  _quiet++
  try {
    ghUtils.setGHToken(t)
    const me = await fetchLogin(api)
    if (!me) throw new Error('GitHub did not accept this token')
    if (!rememberToken(t, remember, storages)) {
      throw new Error('This browser could not keep the token. Allow site data for this page and try again.')
    }
    await adoptLogin(me, { gh: api, storage })
    const saved = loadAccount(storage)
    if (saved.legacy || !sameLogin(saved.login, me.login)) {
      throw new Error(`GitHub knows you as ${me.login}, but this browser could not save your account. Allow site data for this page and try again.`)
    }
    if (!prev.legacy && !prev.login) carryGuestCaptures(me.login, { storage })
    return saved
  } catch (e) {
    restoreTokens(storages, before)
    const p = storedToken(storages)
    if (p) ghUtils.setGHToken(p); else ghUtils.clearGHToken()
    throw e
  } finally {
    _quiet--
  }
}

// Back to guest: forgets the browser's token and writes the explicit guest
// record (never removes it: no record reads as the legacy owner). Pending-
// edit keys are per owner and stay where they are, so the same person
// signing in again finds their unsent edits. Returns true when the record
// changed (the caller reloads), false when it was a guest already or the
// guest record could not be written.
export function signOut({ ghUtils = defaultGhUtils(), storages = defaultStorages(), storage, now = Date.now } = {}) {
  if (ghUtils) ghUtils.clearGHToken()
  forgetToken(storages)
  const was = loadAccount(storage)
  if (!was.legacy && !was.login) return false
  if (!saveGuest(storage)) return false
  writeKey(store(storage), GUEST_SINCE_KEY, String(now()))
  return true
}

// When (ms, this tab's sessionStorage) the 401 handler last signed out.
// For a minute after it the boot check does not sign a login back in: in
// the app the token stays with the app, and if GET /user still answers 200
// for it, re-adopting would reload, hit the same 401 and loop.
export const UNAUTHORIZED_AT_KEY = 'cupitor:unauthorizedAt'
export const REFUSED_GRACE_MS = 60000
function recentlyRefused(storages, now) {
  const at = Number(readKey(storages.session, UNAUTHORIZED_AT_KEY))
  if (!(at > 0)) return false
  const elapsed = now() - at
  return elapsed >= 0 && elapsed < REFUSED_GRACE_MS
}

// A 401 on a request that carried a token means the token is gone: sign
// out and tell the caller once (it reloads so the page boots as a guest).
// The event can come several times. Ignored: a guest's 401s (nothing to
// undo, so never a reload), and in a browser any 401 while no token is in
// memory (the request carried none; GitHubUtils does not raise those
// either). Inside the app the token is the app's and the page holds none,
// so the event always counts there. Returns an uninstaller.
export function installUnauthorizedHandler({
  ghUtils = defaultGhUtils(), storages = defaultStorages(), storage, onSignedOut = () => {},
  target = (typeof window !== 'undefined' ? window : null), now = Date.now,
} = {}) {
  if (!target) return () => {}
  let done = false
  const onEvent = () => {
    if (done || _quiet > 0) return
    const tokenless = !inApp() && ghUtils && typeof ghUtils.hasGHToken === 'function' && !ghUtils.hasGHToken()
    if (tokenless) return
    if (!signOut({ ghUtils, storages, storage, now })) return
    writeKey(storages.session, UNAUTHORIZED_AT_KEY, String(now()))
    done = true
    onSignedOut()
  }
  target.addEventListener(UNAUTHORIZED_EVENT, onEvent)
  return () => target.removeEventListener(UNAUTHORIZED_EVENT, onEvent)
}

// Same sources and same local keys: the running page is still right.
const sameView = (a, b) =>
  JSON.stringify(sources(a)) === JSON.stringify(sources(b)) && storageOwner(a) === storageOwner(b)

// At boot: make the stored record agree with the token actually in use (the
// app's, via GitHubProxy, or the browser's stored or in-memory one). Returns
//   'reload'    the record changed; boot again with the new sources and keys
//   'ok'        the record already matches (a guest with no token is 'ok')
//   'no_token'  a browser with no token at all (none stored or in memory)
//               and a record that is not a guest (legacy owner, owner or
//               any login). Nothing is asked or changed — e.g. a second tab
//               without the first tab's session token. Saving would hit the
//               legacy PAT prompt or a 401: show "Paste your GitHub token
//               to save".
//   'unchecked' GitHub could not be asked (network, rate limit, proxy
//               timeout), the record could not be written, or the 401
//               handler signed out in this tab under a minute ago
//               (UNAUTHORIZED_AT_KEY; the login is not adopted again yet).
//               The current record stays, so the legacy owner keeps saving
// Only a 401 from GET /user signs out here. A legacy owner (no record) is
// resolved when the check completes: to the login's record, or on a 401 to
// the explicit guest record. That sign-out sets the same UNAUTHORIZED_AT_KEY
// mark as the 401 handler, so the reloaded page says why.
export async function reconcileLogin({
  gh, ghUtils = defaultGhUtils(), storages = defaultStorages(), storage, bridgeAvailable = inApp(), now = Date.now,
} = {}) {
  const state = loadAccount(storage)
  const guest = !state.legacy && !state.login
  const toGuest = () => {
    const changed = signOut({ ghUtils, storages, storage, now })
    if (guest) return 'ok'
    if (!changed) return 'unchecked'
    writeKey(storages.session, UNAUTHORIZED_AT_KEY, String(now()))
    return 'reload'
  }
  const canAsk = bridgeAvailable || applyStoredToken(ghUtils, storages) || holdsToken(ghUtils)
  if (!canAsk) return guest ? 'ok' : 'no_token'
  _quiet++
  try {
    const api = gh || defaultGh()
    let me
    try { me = await fetchLogin(api) } catch (_) { return 'unchecked' }
    if (!me) return toGuest()
    if (!state.legacy && sameLogin(me.login, state.login)) return 'ok'
    if (recentlyRefused(storages, now)) return 'unchecked'
    try { await adoptLogin(me, { gh: api, storage }) } catch (_) { return 'unchecked' }
    const saved = loadAccount(storage)
    if (saved.legacy || !sameLogin(saved.login, me.login)) return 'unchecked'
    if (guest) carryGuestCaptures(me.login, { storage })
    return sameView(state, saved) ? 'ok' : 'reload'
  } finally {
    _quiet--
  }
}
