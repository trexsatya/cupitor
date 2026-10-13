import { USERS_CACHE_KEY, OWNER, ACCOUNT_KEY, loadAccount } from './account-state.js'
import {
  parseUsers, cachedUsers, fetchUsers, ownerEntry, USERS_RAW_URL,
  MAX_USERS, MAX_USERS_BYTES, fetchLogin, adoptLogin, defaultGh,
  ensureDataRepo, SetupError, listingStatus, ensureListing, runSetup,
  TOKEN_SESSION_KEY, TOKEN_REMEMBER_KEY, GUEST_SINCE_KEY, UNAUTHORIZED_AT_KEY, storedToken, rememberToken, forgetToken, applyStoredToken,
  signInWithToken, signOut, reconcileLogin, installUnauthorizedHandler, carryGuestCaptures,
} from './account.js'

export function memStorage(init = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}
const textRes = (status, text) => ({ ok: status < 400, status, text: async () => text })
const noSleep = () => Promise.resolve()

describe('users list', () => {
  const list = [{ login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' }, { login: 'alice', repo: 'cupitor-data' }]

  test('the raw URL points at cupitor-users on main', () => {
    expect(USERS_RAW_URL).toBe('https://raw.githubusercontent.com/trexsatya/cupitor-users/main/users.json')
  })

  test('ownerEntry is a fresh copy of OWNER', () => {
    const o = ownerEntry()
    expect(o).toEqual({ ...OWNER })
    o.repo = 'changed'
    expect(ownerEntry().repo).toBe(OWNER.repo)
  })

  test('parseUsers normalises and drops junk; the owner is always present', () => {
    expect(parseUsers(JSON.stringify([{ login: 'alice', repo: 'cupitor-data' }, { nope: 1 }]))).toEqual([
      ownerEntry(), { login: 'alice', name: 'alice', repo: 'cupitor-data', branch: 'main' },
    ])
    expect(parseUsers('[]')).toEqual([ownerEntry()])
    expect(() => parseUsers('{}')).toThrow(/users.json/)
    expect(() => parseUsers('{')).toThrow(/users.json/)
    expect(() => parseUsers('')).toThrow(/users.json/)
    expect(() => parseUsers(null)).toThrow(/users.json/)
  })

  test('parseUsers drops entries that are not safe objects', () => {
    const text = JSON.stringify([
      null, 'alice', 42, [], ['bob'], true,
      { login: 'bad login', repo: 'r' },
      { login: 'eve', repo: '../x' },
      { login: 'eve', repo: '..' },
      { login: 'mallory', repo: 'r', branch: '../main' },
      { login: 'mallory', repo: 'r', branch: 'a b' },
      { login: 'bob', repo: 'data', branch: 7 },
      { login: 'carol', name: 5, repo: 'data', branch: 'dev' },
    ])
    expect(parseUsers(text)).toEqual([
      ownerEntry(), { login: 'carol', name: 'carol', repo: 'data', branch: 'dev' },
    ])
  })

  test('the owner always comes from the code, whatever users.json says about them', () => {
    const text = JSON.stringify([
      { login: 'alice', repo: 'cupitor-data' },
      { login: 'TrexSatya', name: 'Impostor', repo: 'evil', branch: 'main' },
    ])
    expect(parseUsers(text)).toEqual([
      ownerEntry(), { login: 'alice', name: 'alice', repo: 'cupitor-data', branch: 'main' },
    ])
  })

  test('parseUsers keeps the first entry per login, ignoring case', () => {
    const text = JSON.stringify([
      { login: 'Alice', name: 'First', repo: 'one' },
      { login: 'alice', name: 'Second', repo: 'two' },
      { login: 'bob', repo: 'cupitor-data' },
    ])
    expect(parseUsers(text).map(u => [u.login, u.repo])).toEqual([
      ['trexsatya', 'trexsatya.github.io'], ['Alice', 'one'], ['bob', 'cupitor-data'],
    ])
  })

  test('fetchUsers fetches the raw file, caches it, returns it', async () => {
    const storage = memStorage()
    const fetchFn = jest.fn(async () => textRes(200, JSON.stringify(list)))
    const users = await fetchUsers({ fetchFn, storage })
    expect(fetchFn.mock.calls[0][0]).toBe(USERS_RAW_URL)
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
    expect(users.map(u => u.login)).toEqual(['trexsatya', 'alice'])
    expect(JSON.parse(storage.getItem(USERS_CACHE_KEY)).map(u => u.login)).toEqual(['trexsatya', 'alice'])
  })

  test('network failure → cached list; no cache → only the owner', async () => {
    const storage = memStorage({ [USERS_CACHE_KEY]: JSON.stringify(list) })
    const failing = async () => { throw new Error('offline') }
    expect((await fetchUsers({ fetchFn: failing, storage, sleep: noSleep })).map(u => u.login)).toEqual(['trexsatya', 'alice'])
    expect(await fetchUsers({ fetchFn: failing, storage: memStorage(), sleep: noSleep })).toEqual([ownerEntry()])
    expect(await fetchUsers({ fetchFn: async () => textRes(500, ''), storage: memStorage(), sleep: noSleep })).toEqual([ownerEntry()])
    expect(await fetchUsers({ fetchFn: async () => textRes(404, 'Not Found'), storage: memStorage(), sleep: noSleep })).toEqual([ownerEntry()])
  })

  test('a transient failure is retried before falling back', async () => {
    const fetchFn = jest.fn()
      .mockImplementationOnce(async () => textRes(503, ''))
      .mockImplementationOnce(async () => textRes(200, JSON.stringify(list)))
    const users = await fetchUsers({ fetchFn, storage: memStorage(), sleep: noSleep })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(users.map(u => u.login)).toEqual(['trexsatya', 'alice'])
  })

  test('a malformed users.json keeps the cached list and does not overwrite it', async () => {
    for (const body of ['', '{', '{"login":"alice"}', 'null']) {
      const storage = memStorage({ [USERS_CACHE_KEY]: JSON.stringify(list) })
      const users = await fetchUsers({ fetchFn: async () => textRes(200, body), storage, sleep: noSleep })
      expect(users.map(u => u.login)).toEqual(['trexsatya', 'alice'])
      expect(JSON.parse(storage.getItem(USERS_CACHE_KEY)).map(u => u.login)).toEqual(['trexsatya', 'alice'])
    }
  })

  test('a storage that throws never breaks the list', async () => {
    const broken = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceeded') },
      removeItem: () => { throw new Error('SecurityError') },
    }
    const ok = async () => textRes(200, JSON.stringify(list))
    expect((await fetchUsers({ fetchFn: ok, storage: broken })).map(u => u.login)).toEqual(['trexsatya', 'alice'])
    const failing = async () => { throw new Error('offline') }
    expect(await fetchUsers({ fetchFn: failing, storage: broken, sleep: noSleep })).toEqual([ownerEntry()])
    expect(cachedUsers(broken)).toBeNull()
  })

  test('no fetch available → cache, else the owner', async () => {
    expect(await fetchUsers({ fetchFn: null, storage: memStorage() })).toEqual([ownerEntry()])
    const storage = memStorage({ [USERS_CACHE_KEY]: JSON.stringify(list) })
    expect((await fetchUsers({ fetchFn: null, storage })).map(u => u.login)).toEqual(['trexsatya', 'alice'])
  })

  test('cachedUsers tolerates a broken cache', () => {
    expect(cachedUsers(memStorage({ [USERS_CACHE_KEY]: '{' }))).toBeNull()
    expect(cachedUsers(memStorage({ [USERS_CACHE_KEY]: '{}' }))).toBeNull()
    expect(cachedUsers(memStorage({ [USERS_CACHE_KEY]: 'null' }))).toBeNull()
    expect(cachedUsers(memStorage())).toBeNull()
  })

  test('cachedUsers re-validates what it reads', () => {
    const tampered = JSON.stringify([
      { login: 'trexsatya', repo: 'evil', branch: 'main' },
      { login: 'alice', repo: '../x' },
      { login: 'bob', repo: 'cupitor-data' },
      { login: 'BOB', repo: 'other' },
    ])
    expect(cachedUsers(memStorage({ [USERS_CACHE_KEY]: tampered }))).toEqual([
      ownerEntry(), { login: 'bob', name: 'bob', repo: 'cupitor-data', branch: 'main' },
    ])
  })

  test('an entry comes back with exactly login, name, repo and branch', () => {
    const raw = { login: 'a', repo: 'r', extra: 1, ['__proto__']: { polluted: true } }
    expect(Object.keys(raw)).toContain('__proto__')
    for (const u of [parseUsers(JSON.stringify([raw]))[1], parseUsers('[{"login":"a","repo":"r","extra":1,"__proto__":{"polluted":true}}]')[1]]) {
      expect(Object.keys(u).sort()).toEqual(['branch', 'login', 'name', 'repo'])
      expect(Object.getPrototypeOf(u)).toBe(Object.prototype)
      expect(u.polluted).toBeUndefined()
      expect(u).toEqual({ login: 'a', name: 'a', repo: 'r', branch: 'main' })
    }
    expect({}.polluted).toBeUndefined()
  })

  test('a users.json over 256 KB is refused; the cached list stays', async () => {
    expect(MAX_USERS_BYTES).toBe(256 * 1024)
    const pad = ' '.repeat(MAX_USERS_BYTES)
    expect(() => parseUsers(`[${pad}]`)).toThrow(/too large/)
    // Counted in bytes, not characters.
    const wide = `[{"login":"bob","repo":"r","name":"${'é'.repeat(MAX_USERS_BYTES / 2)}"}]`
    expect(wide.length).toBeLessThan(MAX_USERS_BYTES)
    expect(() => parseUsers(wide)).toThrow(/too large/)
    expect(parseUsers(`[${' '.repeat(MAX_USERS_BYTES - 2)}]`)).toEqual([ownerEntry()])
    const storage = memStorage({ [USERS_CACHE_KEY]: JSON.stringify(list) })
    const users = await fetchUsers({ fetchFn: async () => textRes(200, `[${pad}]`), storage, sleep: noSleep })
    expect(users.map(u => u.login)).toEqual(['trexsatya', 'alice'])
    expect(JSON.parse(storage.getItem(USERS_CACHE_KEY)).map(u => u.login)).toEqual(['trexsatya', 'alice'])
  })

  test('at most 500 entries are kept, the owner first', () => {
    expect(MAX_USERS).toBe(500)
    const many = Array.from({ length: 800 }, (_, i) => ({ login: `u${i}`, repo: 'r' }))
    many.splice(600, 0, { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
    const users = parseUsers(JSON.stringify(many))
    expect(users).toHaveLength(500)
    expect(users[0]).toEqual(ownerEntry())
    expect(users[1].login).toBe('u0')
    expect(users[499].login).toBe('u498')
    expect(cachedUsers(memStorage({ [USERS_CACHE_KEY]: JSON.stringify(many) }))).toHaveLength(500)
  })
})

// A fake GitHub: routes map "METHOD /path" to a JSON reply, a function, or
// an Error(`GitHub API error <status>: ...`) to throw. Calls are recorded.
export function fakeGh(routes) {
  const calls = []
  const hit = async (method, path, body) => {
    const key = `${method} ${path.split('?')[0]}`
    calls.push(`${method} ${path}`)
    let r = routes[key]
    if (typeof r === 'function') r = await r(body, path)
    if (r === undefined) throw new Error(`GitHub API error 404: Not Found (${key})`)
    if (r instanceof Error) throw r
    return r
  }
  return {
    calls,
    request: hit,
    getFile: async (owner, repo, filePath, _t, branch) => {
      const r = await hit('GET', `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`)
      return { content: r.text, sha: r.sha }
    },
    putFile: (owner, repo, filePath, content, message, sha, _t, branch) =>
      hit('PUT', `/repos/${owner}/${repo}/contents/${filePath}`, { content, message, sha, branch }),
  }
}
export const err = (status, msg = 'x') => new Error(`GitHub API error ${status}: ${msg}`)

describe('defaultGh', () => {
  afterEach(() => { delete window.GitHubUtils })
  test('wraps window.GitHubUtils; missing → throws', () => {
    expect(() => defaultGh()).toThrow(/GitHubUtils/)
    const u = { request: jest.fn(), getFile: jest.fn(), putFile: jest.fn() }
    window.GitHubUtils = u
    expect(defaultGh()).toEqual({ request: u.request, getFile: u.getFile, putFile: u.putFile })
  })
})

describe('fetchLogin', () => {
  test('GET /user → { login, name }', async () => {
    const gh = fakeGh({ 'GET /user': { login: 'alice', name: 'Alice' } })
    expect(await fetchLogin(gh)).toEqual({ login: 'alice', name: 'Alice' })
    expect(gh.calls).toEqual(['GET /user'])
    expect(await fetchLogin(fakeGh({ 'GET /user': { login: 'bob', name: null } }))).toEqual({ login: 'bob', name: 'bob' })
  })
  test('401 (no or bad token) → null; other failures throw', async () => {
    expect(await fetchLogin(fakeGh({ 'GET /user': err(401, 'Bad credentials') }))).toBeNull()
    expect(await fetchLogin(fakeGh({ 'GET /user': err(401, 'Requires authentication') }))).toBeNull()
    await expect(fetchLogin(fakeGh({ 'GET /user': err(500) }))).rejects.toThrow(/500/)
    // 403 is a rate limit or a token without access, not "signed out".
    await expect(fetchLogin(fakeGh({ 'GET /user': err(403, 'API rate limit exceeded') }))).rejects.toThrow(/403/)
    // The app proxy reports a dropped connection as status 0, and a stuck
    // proxy as a timeout with no status at all.
    await expect(fetchLogin(fakeGh({ 'GET /user': err(0, '') }))).rejects.toThrow(/error 0/)
    await expect(fetchLogin(fakeGh({ 'GET /user': new Error('GitHubProxy timeout (30000ms) for GET /user') }))).rejects.toThrow(/timeout/)
    // A 401 named in the message text of another error is not a 401.
    await expect(fetchLogin(fakeGh({ 'GET /user': new Error('proxy said: GitHub API error 4010 x') }))).rejects.toThrow()
  })
  test('an answer without a usable login throws instead of reading as signed out', async () => {
    for (const body of [{}, { login: '' }, { login: 'bad login' }, null, { login: 7 }]) {
      await expect(fetchLogin(fakeGh({ 'GET /user': () => body }))).rejects.toThrow(/login/)
    }
  })
})

describe('adoptLogin', () => {
  test('the owner gets the owner repo and no other', async () => {
    const storage = memStorage()
    const gh = fakeGh({})
    const state = await adoptLogin({ login: 'trexsatya', name: 'Satya' }, { gh, storage })
    expect(state).toEqual({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })
    expect(loadAccount(storage).login).toBe('trexsatya')
    expect(loadAccount(storage).legacy).toBeUndefined()
    expect(gh.calls).toEqual([])
  })
  test('the owner is recognised whatever the case', async () => {
    const storage = memStorage()
    const state = await adoptLogin({ login: 'TrexSatya' }, { gh: fakeGh({}), storage })
    expect(state).toEqual({ login: 'TrexSatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })
  })
  test('a user whose data repo exists is ready; one without is signed in with no repo', async () => {
    const ready = fakeGh({ 'GET /repos/alice/cupitor-data/contents/cupitor.json': { sha: 's' } })
    expect(await adoptLogin({ login: 'alice' }, { gh: ready, storage: memStorage() }))
      .toEqual({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: ownerEntry() })
    expect(ready.calls).toEqual(['GET /repos/alice/cupitor-data/contents/cupitor.json?ref=main'])
    expect(await adoptLogin({ login: 'bob' }, { gh: fakeGh({}), storage: memStorage() }))
      .toEqual({ login: 'bob', repo: null, branch: null, other: ownerEntry() })
  })
  test('the same login signing in again keeps its chosen other and repo name', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'my-data', branch: 'main', other: null }) })
    const gh = fakeGh({ 'GET /repos/alice/my-data/contents/cupitor.json': { sha: 's' } })
    expect(await adoptLogin({ login: 'alice' }, { gh, storage })).toEqual({ login: 'alice', repo: 'my-data', branch: 'main', other: null })
  })
  test('"same login" ignores case, and a kept repo is checked on its own branch', async () => {
    const bob = { login: 'bob', name: 'Bob', repo: 'cupitor-data', branch: 'main' }
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'ALICE', repo: 'my-data', branch: 'dev', other: bob }) })
    const gh = fakeGh({ 'GET /repos/alice/my-data/contents/cupitor.json': { sha: 's' } })
    expect(await adoptLogin({ login: 'alice' }, { gh, storage })).toEqual({ login: 'alice', repo: 'my-data', branch: 'dev', other: bob })
    expect(gh.calls).toEqual(['GET /repos/alice/my-data/contents/cupitor.json?ref=dev'])
  })
  test('an other chosen while the repo check is in flight is kept', async () => {
    const bob = { login: 'bob', name: 'Bob', repo: 'cupitor-data', branch: 'main' }
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null }) })
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data/contents/cupitor.json': () => {
        storage.setItem(ACCOUNT_KEY, JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: bob }))
        return { sha: 's' }
      },
    })
    expect((await adoptLogin({ login: 'alice' }, { gh, storage })).other).toEqual(bob)
  })
  test('a recorded repo that has no marker is reported missing, never swapped for another repo', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'my-data', branch: 'dev', other: null }) })
    // cupitor-data exists too, but a 404 may only mean "private now": no switching.
    const gh = fakeGh({ 'GET /repos/alice/cupitor-data/contents/cupitor.json': { sha: 's' } })
    const state = await adoptLogin({ login: 'alice' }, { gh, storage })
    expect(state).toEqual({ login: 'alice', repo: null, branch: null, other: null, missingRepo: { repo: 'my-data', branch: 'dev' } })
    expect(gh.calls).toEqual(['GET /repos/alice/my-data/contents/cupitor.json?ref=dev'])
    // Kept across a reload, and it is "no self": writes stay blocked.
    expect(loadAccount(storage)).toEqual(state)
  })
  test('a missing repo is checked again on the next sign-in and comes back when visible', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: null, branch: null, other: null, missingRepo: { repo: 'my-data', branch: 'dev' } }) })
    const still = fakeGh({})
    expect((await adoptLogin({ login: 'ALICE' }, { gh: still, storage })).missingRepo).toEqual({ repo: 'my-data', branch: 'dev' })
    expect(still.calls).toEqual(['GET /repos/ALICE/my-data/contents/cupitor.json?ref=dev'])
    const back = fakeGh({ 'GET /repos/alice/my-data/contents/cupitor.json': { sha: 's' } })
    const state = await adoptLogin({ login: 'alice' }, { gh: back, storage })
    expect(state).toEqual({ login: 'alice', repo: 'my-data', branch: 'dev', other: null })
    expect(loadAccount(storage).missingRepo).toBeUndefined()
  })
  test('no recorded repo and no cupitor-data: no repo, nothing reported missing', async () => {
    const state = await adoptLogin({ login: 'alice' }, { gh: fakeGh({}), storage: memStorage() })
    expect(state).toEqual({ login: 'alice', repo: null, branch: null, other: ownerEntry() })
  })
  test('a failing check of a missing repo throws and keeps the record', async () => {
    const before = JSON.stringify({ login: 'alice', repo: null, branch: null, other: null, missingRepo: { repo: 'my-data', branch: 'main' } })
    const storage = memStorage({ [ACCOUNT_KEY]: before })
    const gh = fakeGh({ 'GET /repos/alice/my-data/contents/cupitor.json': err(500) })
    await expect(adoptLogin({ login: 'alice' }, { gh, storage })).rejects.toThrow(/500/)
    expect(storage.getItem(ACCOUNT_KEY)).toBe(before)
  })
  test('another login does not inherit a missing repo', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: null, branch: null, other: null, missingRepo: { repo: 'my-data', branch: 'main' } }) })
    const gh = fakeGh({})
    expect(await adoptLogin({ login: 'bob' }, { gh, storage })).toEqual({ login: 'bob', repo: null, branch: null, other: ownerEntry() })
    expect(gh.calls).toEqual(['GET /repos/bob/cupitor-data/contents/cupitor.json?ref=main'])
  })
  test('a different login does not inherit the previous one\'s repo or other', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'my-data', branch: 'main', other: null }) })
    const gh = fakeGh({ 'GET /repos/bob/cupitor-data/contents/cupitor.json': { sha: 's' } })
    expect(await adoptLogin({ login: 'bob' }, { gh, storage })).toEqual({ login: 'bob', repo: 'cupitor-data', branch: 'main', other: ownerEntry() })
  })
  test('a legacy (no record) device or a guest record: a new login gets the defaults', async () => {
    const gh = () => fakeGh({ 'GET /repos/alice/cupitor-data/contents/cupitor.json': { sha: 's' } })
    const expected = { login: 'alice', repo: 'cupitor-data', branch: 'main', other: ownerEntry() }
    expect(await adoptLogin({ login: 'alice' }, { gh: gh(), storage: memStorage() })).toEqual(expected)
    const guest = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null, repo: null, branch: null }) })
    expect(await adoptLogin({ login: 'alice' }, { gh: gh(), storage: guest })).toEqual(expected)
  })
  test('a failed repo check (not a 404) throws and leaves the record alone', async () => {
    const before = JSON.stringify({ login: null, repo: null, branch: null })
    for (const e of [err(500), err(403), err(401), new Error('GitHubProxy timeout')]) {
      const storage = memStorage({ [ACCOUNT_KEY]: before })
      const gh = fakeGh({ 'GET /repos/alice/cupitor-data/contents/cupitor.json': e })
      await expect(adoptLogin({ login: 'alice' }, { gh, storage })).rejects.toThrow()
      expect(storage.getItem(ACCOUNT_KEY)).toBe(before)
    }
  })
  test('an invalid login is refused before anything is written', async () => {
    for (const me of [null, {}, { login: '' }, { login: 'a/b' }, { login: '../x' }]) {
      const storage = memStorage()
      const gh = fakeGh({})
      await expect(adoptLogin(me, { gh, storage })).rejects.toThrow(/login/)
      expect(storage.getItem(ACCOUNT_KEY)).toBeNull()
      expect(gh.calls).toEqual([])
    }
  })
  test('storage that cannot be written still returns the adopted state', async () => {
    const broken = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceeded') },
      removeItem: () => {},
    }
    const gh = fakeGh({ 'GET /repos/alice/cupitor-data/contents/cupitor.json': { sha: 's' } })
    expect(await adoptLogin({ login: 'alice' }, { gh, storage: broken }))
      .toEqual({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: ownerEntry() })
  })
})

function clock(start = 0) { let t = start; return { now: () => t, tick: ms => { t += ms } } }
const GENERATE = 'POST /repos/trexsatya/cupitor-data-template/generate'
const FROM_TEMPLATE = { name: 'cupitor-data', template_repository: { full_name: 'trexsatya/cupitor-data-template' } }

describe('ensureDataRepo', () => {
  test('from scratch: generates from the template and waits for cupitor.json', async () => {
    let created = false, polls = 0
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data': () => (created ? FROM_TEMPLATE : err(404)),
      [GENERATE]: (body) => {
        expect(body).toEqual({ owner: 'alice', name: 'cupitor-data', private: false, include_all_branches: false, description: 'Cupitor language data' })
        created = true; return { name: 'cupitor-data' }
      },
      'GET /repos/alice/cupitor-data/contents/cupitor.json': () => (++polls >= 2 ? { sha: 's' } : err(404)),
    })
    const steps = []
    const out = await ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now, report: (s, st) => steps.push(`${s}:${st}`) })
    expect(out).toEqual({ repo: 'cupitor-data', branch: 'main', created: true })
    expect(gh.calls.filter(c => c === GENERATE)).toHaveLength(1)
    expect(gh.calls).toContain('GET /repos/alice/cupitor-data/contents/cupitor.json?ref=main')
    expect(steps).toEqual(['repo:checking', 'repo:creating', 'repo:done'])
  })
  test('already done: no generate call', async () => {
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data': FROM_TEMPLATE,
      'GET /repos/alice/cupitor-data/contents/cupitor.json': { sha: 's' },
    })
    expect(await ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now })).toEqual({ repo: 'cupitor-data', branch: 'main', created: false })
    expect(gh.calls).not.toContain(GENERATE)
  })
  test('a repo of that name that is not a Cupitor data repo → repo_taken, nothing created', async () => {
    const gh = fakeGh({ 'GET /repos/alice/cupitor-data': { name: 'cupitor-data', template_repository: null } })
    const p = ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now })
    await expect(p).rejects.toThrow(SetupError)
    await expect(p).rejects.toMatchObject({ step: 'repo', code: 'repo_taken' })
    expect(gh.calls).not.toContain(GENERATE)
  })
  test('a different repo name is honoured', async () => {
    const gh = fakeGh({
      'GET /repos/alice/my-cupitor': { name: 'my-cupitor' },
      'GET /repos/alice/my-cupitor/contents/cupitor.json': { sha: 's' },
    })
    expect((await ensureDataRepo({ login: 'alice', repoName: 'my-cupitor', gh, sleep: noSleep, now: clock().now })).repo).toBe('my-cupitor')
  })
  test('generation that never shows cupitor.json within 30 s → timeout; the retry resumes without generating again', async () => {
    const c = clock()
    let created = false, markerReady = false
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data': () => (created ? FROM_TEMPLATE : err(404)),
      [GENERATE]: () => { created = true; return { name: 'cupitor-data' } },
      'GET /repos/alice/cupitor-data/contents/cupitor.json': () => (markerReady ? { sha: 's' } : err(404)),
    })
    const sleeps = []
    const sleep = async ms => { sleeps.push(ms); c.tick(10000) }
    const p = ensureDataRepo({ login: 'alice', gh, sleep, now: c.now })
    await expect(p).rejects.toMatchObject({ step: 'repo', code: 'timeout' })
    expect(sleeps.length).toBeGreaterThan(0)
    expect(sleeps.length).toBeLessThan(10)
    // Retry: the repo exists (from the template) but is still filling in.
    let polls = 0
    gh.calls.length = 0
    const steps = []
    const retry = ensureDataRepo({
      login: 'alice', gh, now: c.now, report: (s, st) => steps.push(`${s}:${st}`),
      sleep: async () => { c.tick(2000); if (++polls === 2) markerReady = true },
    })
    expect(await retry).toEqual({ repo: 'cupitor-data', branch: 'main', created: false })
    expect(gh.calls).not.toContain(GENERATE)
    expect(steps).toEqual(['repo:checking', 'repo:creating', 'repo:done'])
  })
  test('generate answering 422 (the repo appeared meanwhile) resumes when it came from the template', async () => {
    let exists = false, polls = 0
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data': () => (exists ? FROM_TEMPLATE : err(404)),
      [GENERATE]: () => { exists = true; return err(422, 'Name already exists on this account') },
      'GET /repos/alice/cupitor-data/contents/cupitor.json': () => (++polls >= 2 ? { sha: 's' } : err(404)),
    })
    const steps = []
    expect(await ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now, report: (s, st) => steps.push(`${s}:${st}`) }))
      .toEqual({ repo: 'cupitor-data', branch: 'main', created: false })
    expect(steps).toEqual(['repo:checking', 'repo:creating', 'repo:done'])
  })
  test('generate answering 422 for a repo that is not from the template → repo_taken', async () => {
    let exists = false
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data': () => (exists ? { name: 'cupitor-data' } : err(404)),
      [GENERATE]: () => { exists = true; return err(422, 'Name already exists on this account') },
    })
    await expect(ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now }))
      .rejects.toMatchObject({ step: 'repo', code: 'repo_taken' })
  })
  test('generate answering 422 with no repo there → a setup error for the step', async () => {
    const gh = fakeGh({ 'GET /repos/alice/cupitor-data': err(404), [GENERATE]: err(422, 'Unprocessable') })
    await expect(ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now }))
      .rejects.toMatchObject({ step: 'repo', code: 'github', status: 422 })
  })
  test('a repo that is still empty (409 on contents) is waited for', async () => {
    let polls = 0
    const gh = fakeGh({
      'GET /repos/alice/cupitor-data': FROM_TEMPLATE,
      'GET /repos/alice/cupitor-data/contents/cupitor.json': () => (++polls >= 3 ? { sha: 's' } : err(409, 'Git Repository is empty.')),
    })
    expect((await ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now })).repo).toBe('cupitor-data')
  })
  test('GitHub failures become setup errors for the step and never create anything', async () => {
    for (const [e, code, status] of [[err(500), 'github', 500], [err(401, 'Bad credentials'), 'unauthorized', 401], [new Error('GitHubProxy timeout'), 'github', 0]]) {
      const gh = fakeGh({ 'GET /repos/alice/cupitor-data': e })
      const p = ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now })
      await expect(p).rejects.toThrow(SetupError)
      await expect(p).rejects.toMatchObject({ step: 'repo', code, status })
      expect(gh.calls).not.toContain(GENERATE)
    }
    // A failing marker check on an existing repo is not "not a data repo".
    const gh = fakeGh({ 'GET /repos/alice/cupitor-data': FROM_TEMPLATE, 'GET /repos/alice/cupitor-data/contents/cupitor.json': err(503) })
    await expect(ensureDataRepo({ login: 'alice', gh, sleep: noSleep, now: clock().now }))
      .rejects.toMatchObject({ step: 'repo', code: 'github', status: 503 })
  })
  test('the owner never gets a repo created', async () => {
    for (const login of ['trexsatya', 'TrexSatya']) {
      const gh = fakeGh({})
      expect(await ensureDataRepo({ login, gh, sleep: noSleep, now: clock().now }))
        .toEqual({ repo: 'trexsatya.github.io', branch: 'gh-pages', created: false })
      expect(gh.calls).toEqual([])
    }
  })
  test('invalid login or repo name is refused before any call', async () => {
    for (const [login, repoName, code] of [['a/b', undefined, 'bad_login'], [null, undefined, 'bad_login'], ['alice', '../x', 'bad_name'], ['alice', 'a b', 'bad_name'], ['alice', '', 'bad_name']]) {
      const gh = fakeGh({})
      await expect(ensureDataRepo({ login, repoName, gh, sleep: noSleep, now: clock().now }))
        .rejects.toMatchObject({ step: 'repo', code })
      expect(gh.calls).toEqual([])
    }
  })
})

// users.json as it is on trexsatya/cupitor-users: one entry per line.
const OWNER_LINE = '{ "login": "trexsatya", "name": "Satya", "repo": "trexsatya.github.io", "branch": "gh-pages" }'
const ALICE_LINE = '{ "login": "alice", "name": "Alice", "repo": "cupitor-data", "branch": "main" }'
const UPSTREAM_TEXT = `[\n  ${OWNER_LINE}\n]\n`
const WITH_ALICE = `[\n  ${OWNER_LINE},\n  ${ALICE_LINE}\n]\n`
const UP = '/repos/trexsatya/cupitor-users'
const PRS = `GET ${UP}/pulls`
const PR_QUERY = `${UP}/pulls?state=all&head=alice%3Aadd-alice`

describe('listingStatus', () => {
  const users = text => ({ [`GET ${UP}/contents/users.json`]: { text, sha: 'UF1' } })
  test('a valid entry in users.json (ignoring case) → listed, without looking at PRs', async () => {
    for (const login of ['alice', 'Alice']) {
      const gh = fakeGh(users(WITH_ALICE))
      expect(await listingStatus({ login, gh })).toBe('listed')
      expect(gh.calls).toEqual([`GET ${UP}/contents/users.json?ref=main`])
    }
  })
  test('otherwise the PRs for add-<login> decide', async () => {
    const st = async prs => listingStatus({ login: 'alice', gh: fakeGh({ ...users(UPSTREAM_TEXT), [PRS]: prs }) })
    expect(await st([{ state: 'open', merged_at: null }])).toBe('awaiting')
    expect(await st([{ state: 'closed', merged_at: '2026-01-01T00:00:00Z' }])).toBe('listed')
    expect(await st([{ state: 'closed', merged_at: null }])).toBe('not_approved')
    expect(await st([{ state: 'closed', merged_at: null }, { state: 'open', merged_at: null }])).toBe('awaiting')
    expect(await st([])).toBe('none')
  })
  test('asks for exactly the add-<login> head, all states', async () => {
    const gh = fakeGh({ ...users(UPSTREAM_TEXT), [PRS]: (_b, path) => { expect(path).toBe(PR_QUERY); return [] } })
    await listingStatus({ login: 'alice', gh })
    expect(gh.calls).toContain(`GET ${PR_QUERY}`)
  })
  test('an invalid entry for the login does not count as listed', async () => {
    const text = `[\n  ${OWNER_LINE},\n  { "login": "alice", "repo": "../evil" }\n]\n`
    expect(await listingStatus({ login: 'alice', gh: fakeGh({ ...users(text), [PRS]: [] }) })).toBe('none')
  })
  test('the owner is always listed, with no call', async () => {
    const gh = fakeGh({})
    expect(await listingStatus({ login: 'TrexSatya', gh })).toBe('listed')
    expect(gh.calls).toEqual([])
  })
  test('failures throw (never "none", which would start a new PR)', async () => {
    await expect(listingStatus({ login: 'alice', gh: fakeGh({ [`GET ${UP}/contents/users.json`]: err(500) }) })).rejects.toThrow(/500/)
    await expect(listingStatus({ login: 'alice', gh: fakeGh({ ...users(UPSTREAM_TEXT), [PRS]: err(403) }) })).rejects.toThrow(/403/)
    await expect(listingStatus({ login: 'alice', gh: fakeGh(users('{"not":"a list"}')) })).rejects.toThrow(/users.json/)
  })
})

describe('ensureListing', () => {
  // A GitHub where each write changes what the next read sees, so the same
  // state can be replayed from any failure point.
  function world({ forked = false, branchText = null, prs = [], upstreamText = UPSTREAM_TEXT, failAt = null, forkRepo } = {}) {
    const st = { forked, branchText, prs: prs.slice(), upstreamText }
    const fail = name => { if (failAt === name) throw err(500, `boom at ${name}`) }
    const fork = `/repos/alice/cupitor-users`
    const gh = fakeGh({
      [`GET ${UP}/contents/users.json`]: () => ({ text: st.upstreamText, sha: 'UF1' }),
      [PRS]: (_b, path) => { expect(path).toBe(PR_QUERY); return st.prs },
      [`GET ${UP}/git/ref/heads/main`]: { object: { sha: 'UP1' } },
      [`GET ${fork}`]: () => forkRepo || (st.forked ? { name: 'cupitor-users', fork: true, parent: { full_name: 'trexsatya/cupitor-users' } } : err(404)),
      [`GET ${UP}/forks`]: () => (st.forked ? [{ name: 'cupitor-users', owner: { login: 'alice' } }] : []),
      [`POST ${UP}/forks`]: () => { fail('fork'); st.forked = true; return { name: 'cupitor-users', owner: { login: 'alice' } } },
      [`GET ${fork}/git/ref/heads/main`]: () => (st.forked ? { object: { sha: 'F1' } } : err(404)),
      [`POST ${fork}/merge-upstream`]: body => { fail('sync'); expect(body).toEqual({ branch: 'main' }); return { message: 'ok' } },
      [`POST ${fork}/git/refs`]: body => {
        fail('branch')
        expect(body).toEqual({ ref: 'refs/heads/add-alice', sha: 'UP1' })
        if (st.branchText !== null) return err(422, 'Reference already exists')
        st.branchText = st.upstreamText; return {}
      },
      [`PATCH ${fork}/git/refs/heads/add-alice`]: body => {
        fail('reset')
        expect(body).toEqual({ sha: 'UP1', force: true })
        st.branchText = st.upstreamText; return {}
      },
      [`GET ${fork}/contents/users.json`]: (_b, path) => {
        expect(path).toBe(`${fork}/contents/users.json?ref=add-alice`)
        return st.branchText === null ? err(404) : { text: st.branchText, sha: st.branchText === st.upstreamText ? 'UF1' : 'B2' }
      },
      [`PUT ${fork}/contents/users.json`]: body => {
        fail('commit')
        expect(body).toMatchObject({ branch: 'add-alice', sha: 'UF1', message: 'Add alice' })
        if (st.branchText !== st.upstreamText) return err(409, 'sha does not match')
        st.branchText = body.content; return {}
      },
      [`POST ${UP}/pulls`]: body => {
        fail('pr')
        expect(body).toMatchObject({ head: 'alice:add-alice', base: 'main', title: 'Add alice' })
        if (st.prs.some(p => p.state === 'open')) return err(422, 'A pull request already exists for alice:add-alice.')
        st.prs.push({ state: 'open', merged_at: null }); return { number: 7 }
      },
    })
    return { gh, st }
  }
  const args = (gh, extra = {}) => ({ login: 'alice', name: 'Alice', repo: 'cupitor-data', branch: 'main', gh, sleep: noSleep, now: clock().now, ...extra })
  const writes = gh => gh.calls.filter(c => /^(POST|PUT|PATCH|DELETE) /.test(c))

  test('from scratch: fork, sync, branch, commit, PR → awaiting; the file gains exactly one line', async () => {
    const { gh, st } = world()
    const steps = []
    expect(await ensureListing(args(gh, { report: (s, x) => steps.push(`${s}:${x}`) }))).toBe('awaiting')
    expect(writes(gh)).toEqual([
      `POST ${UP}/forks`,
      'POST /repos/alice/cupitor-users/merge-upstream',
      'POST /repos/alice/cupitor-users/git/refs',
      'PUT /repos/alice/cupitor-users/contents/users.json',
      `POST ${UP}/pulls`,
    ])
    expect(st.branchText).toBe(WITH_ALICE)
    expect(st.prs).toHaveLength(1)
    expect(steps).toEqual(['listing:checking', 'listing:forking', 'listing:syncing', 'listing:branching', 'listing:committing', 'listing:opening-pr', 'listing:done'])
  })

  test.each(['fork', 'branch', 'commit', 'pr'])('fails at %s, then a retry finishes with one entry and one PR', async at => {
    const { gh, st } = world({ failAt: at })
    const p = ensureListing(args(gh))
    await expect(p).rejects.toThrow(SetupError)
    await expect(p).rejects.toMatchObject({ step: 'listing', code: 'github', status: 500 })
    const again = world({ ...st })
    expect(await ensureListing(args(again.gh))).toBe('awaiting')
    expect(again.st.branchText).toBe(WITH_ALICE)
    expect(again.st.prs).toHaveLength(1)
    // And once more: nothing left to do.
    const third = world({ ...again.st })
    expect(await ensureListing(args(third.gh))).toBe('awaiting')
    expect(writes(third.gh)).toEqual([])
  })

  test('a PUT that landed but whose answer was lost: the retry finds the branch done', async () => {
    const { gh } = world({ forked: true, branchText: WITH_ALICE })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(writes(gh)).toEqual([
      'POST /repos/alice/cupitor-users/merge-upstream',
      'POST /repos/alice/cupitor-users/git/refs',
      `POST ${UP}/pulls`,
    ])
  })

  test('a stale add-<login> branch (older upstream, other edits) is reset to upstream before the commit', async () => {
    const stale = `[\n  ${OWNER_LINE},\n  { "login": "alice", "name": "Old", "repo": "x", "branch": "main" },\n  { "login": "junk", "repo": "j" }\n]\n`
    const { gh, st } = world({ forked: true, branchText: stale })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(writes(gh)).toContain('PATCH /repos/alice/cupitor-users/git/refs/heads/add-alice')
    expect(st.branchText).toBe(WITH_ALICE)
  })

  test('a failing reset is resumed too', async () => {
    const { gh, st } = world({ forked: true, branchText: 'junk', failAt: 'reset' })
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', status: 500 })
    const again = world({ ...st })
    expect(await ensureListing(args(again.gh))).toBe('awaiting')
    expect(again.st.branchText).toBe(WITH_ALICE)
  })

  test('other entries stay byte for byte; the new one is appended', async () => {
    const upstreamText = `[\n  ${OWNER_LINE},\n  { "login": "bob", "name": "Bøb", "repo": "data", "branch": "dev", "extra": 1 },\n  "junk"\n]\n`
    const { gh, st } = world({ upstreamText })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(`[\n  ${OWNER_LINE},\n  { "login": "bob", "name": "Bøb", "repo": "data", "branch": "dev", "extra": 1 },\n  "junk",\n  ${ALICE_LINE}\n]\n`)
  })

  test('a file in another layout keeps its text; the entry goes in before the closing bracket', async () => {
    const upstreamText = '[\n    {\n        "login": "trexsatya",\n        "repo": "trexsatya.github.io"\n    }\n]'
    const { gh, st } = world({ upstreamText })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(`[\n    {\n        "login": "trexsatya",\n        "repo": "trexsatya.github.io"\n    },\n  ${ALICE_LINE}\n]`)
  })

  test('CRLF line endings are kept: the usual layout gains one CRLF line', async () => {
    const crlf = s => s.replace(/\n/g, '\r\n')
    const upstreamText = crlf(`[\n  ${OWNER_LINE},\n  { "login": "bob", "repo": "data" }\n]\n`)
    const { gh, st } = world({ upstreamText })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(crlf(`[\n  ${OWNER_LINE},\n  { "login": "bob", "repo": "data" },\n  ${ALICE_LINE}\n]\n`))
  })

  test('CRLF in another layout: the spliced entry uses CRLF too', async () => {
    const upstreamText = '[\r\n    {\r\n        "login": "trexsatya",\r\n        "repo": "trexsatya.github.io"\r\n    }\r\n]\r\n'
    const { gh, st } = world({ upstreamText })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(`[\r\n    {\r\n        "login": "trexsatya",\r\n        "repo": "trexsatya.github.io"\r\n    },\r\n  ${ALICE_LINE}\r\n]\r\n`)
  })

  test('CRLF: replacing an invalid entry and filling an empty list keep CRLF', async () => {
    let w = world({ upstreamText: `[\r\n  ${OWNER_LINE},\r\n  { "login": "alice", "repo": "../bad" }\r\n]\r\n` })
    await ensureListing(args(w.gh))
    expect(w.st.branchText).toBe(`[\r\n  ${OWNER_LINE},\r\n  ${ALICE_LINE}\r\n]\r\n`)
    w = world({ upstreamText: '[]\r\n' })
    await ensureListing(args(w.gh))
    expect(w.st.branchText).toBe(`[\r\n  ${ALICE_LINE}\r\n]\r\n`)
  })

  test('an empty list gets the entry', async () => {
    const { gh, st } = world({ upstreamText: '[]\n' })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(`[\n  ${ALICE_LINE}\n]\n`)
  })

  test('an invalid entry already there for the login is replaced, the rest untouched', async () => {
    const upstreamText = `[\n  ${OWNER_LINE},\n  { "login": "Alice", "repo": "../bad" },\n  { "login": "bob", "repo": "data" }\n]\n`
    const { gh, st } = world({ upstreamText })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(`[\n  ${OWNER_LINE},\n  ${ALICE_LINE},\n  { "login": "bob", "repo": "data" }\n]\n`)
  })

  test('the name is cleaned; a missing name becomes the login', async () => {
    const bell = String.fromCodePoint(7)
    let w = world()
    await ensureListing(args(w.gh, { name: `  Ali${bell}ce  ` }))
    expect(w.st.branchText).toBe(WITH_ALICE)
    w = world()
    await ensureListing(args(w.gh, { name: undefined }))
    expect(JSON.parse(w.st.branchText)[1]).toEqual({ login: 'alice', name: 'alice', repo: 'cupitor-data', branch: 'main' })
  })

  test.each([
    ['awaiting', [{ state: 'open', merged_at: null }]],
    ['listed', [{ state: 'closed', merged_at: '2026-01-01T00:00:00Z' }]],
    ['not_approved', [{ state: 'closed', merged_at: null }]],
  ])('already %s: nothing is written', async (status, prs) => {
    const { gh } = world({ prs })
    expect(await ensureListing(args(gh))).toBe(status)
    expect(writes(gh)).toEqual([])
  })

  test('already in users.json: nothing is written', async () => {
    const { gh } = world({ upstreamText: WITH_ALICE })
    expect(await ensureListing(args(gh))).toBe('listed')
    expect(writes(gh)).toEqual([])
  })

  test('the owner is never put through it: no call at all', async () => {
    const gh = fakeGh({})
    expect(await ensureListing(args(gh, { login: 'TrexSatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }))).toBe('listed')
    expect(await ensureListing(args(gh, { login: 'trexsatya', repo: 'cupitor-data', branch: 'main' }))).toBe('listed')
    expect(await ensureListing(args(gh, { login: 'trexsatya', repo: null, branch: null }))).toBe('listed')
    expect(gh.calls).toEqual([])
  })

  test('invalid login, repo or branch is refused before any call', async () => {
    for (const [extra, code] of [
      [{ login: 'a/b' }, 'bad_login'], [{ login: null }, 'bad_login'],
      [{ repo: '../x' }, 'bad_entry'], [{ repo: null }, 'bad_entry'], [{ branch: '../main' }, 'bad_entry'],
    ]) {
      const gh = fakeGh({})
      await expect(ensureListing(args(gh, extra))).rejects.toMatchObject({ step: 'listing', code })
      expect(gh.calls).toEqual([])
    }
  })

  test('PR answering 422 when an open PR is there (another tab) → awaiting', async () => {
    const { gh, st } = world()
    const open = gh.request
    gh.request = async (m, p, b) => {
      if (m === 'POST' && p === `${UP}/pulls`) { st.prs.push({ state: 'open', merged_at: null }); throw err(422, 'A pull request already exists') }
      return open(m, p, b)
    }
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.prs).toHaveLength(1)
  })

  test('PR answering 422 with no PR there (e.g. no commits) → an error, not "awaiting"', async () => {
    const { gh } = world()
    const open = gh.request
    gh.request = async (m, p, b) => {
      if (m === 'POST' && p === `${UP}/pulls`) throw err(422, 'No commits between main and alice:add-alice')
      return open(m, p, b)
    }
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', code: 'github', status: 422 })
  })

  test.each([409, 422, 500])('a failing sync (%s) does not stop the setup: the branch comes from upstream', async status => {
    const { gh, st } = world()
    const open = gh.request
    gh.request = async (m, p, b) => {
      if (p.endsWith('/merge-upstream')) throw err(status, 'cannot sync')
      return open(m, p, b)
    }
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe(WITH_ALICE)
  })

  test('a sync answering 401 stops as unauthorized', async () => {
    const { gh } = world()
    const open = gh.request
    gh.request = async (m, p, b) => { if (p.endsWith('/merge-upstream')) throw err(401, 'Bad credentials'); return open(m, p, b) }
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', code: 'unauthorized' })
    expect(writes(gh).some(c => c.includes('/git/refs') || c.startsWith('PUT') || c.endsWith('/pulls'))).toBe(false)
  })

  test('a PR list answered as {} (empty / unreadable body) is an error, never "none"', async () => {
    const { gh } = world()
    const open = gh.request
    gh.request = async (m, p, b) => (m === 'GET' && p.startsWith(`${UP}/pulls`) ? {} : open(m, p, b))
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', code: 'github' })
    expect(writes(gh)).toEqual([])
  })

  test('a PR that appears before a stale branch is reset: the branch is left alone', async () => {
    const { gh, st } = world({ forked: true, branchText: 'old' })
    const open = gh.request
    let lookups = 0
    gh.request = async (m, p, b) => {
      if (m === 'GET' && p.startsWith(`${UP}/pulls`) && ++lookups === 2) st.prs.push({ state: 'open', merged_at: null })
      return open(m, p, b)
    }
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(st.branchText).toBe('old')
    expect(writes(gh).some(c => c.startsWith('PATCH') || c.startsWith('PUT') || c.endsWith('/pulls'))).toBe(false)
  })

  test('a 422 on branch creation for a branch that is not there surfaces as an error', async () => {
    const { gh, st } = world({ forked: true })
    const open = gh.request
    gh.request = async (m, p, b) => {
      if (m === 'POST' && p.endsWith('/git/refs')) throw err(422, 'Object does not exist')
      if (m === 'PATCH') throw err(422, 'Reference does not exist')
      return open(m, p, b)
    }
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', status: 422 })
    expect(st.prs).toEqual([])
  })

  test('the PR body names only login and repo', async () => {
    const { gh } = world()
    const open = gh.request
    let body
    gh.request = async (m, p, b) => { if (m === 'POST' && p === `${UP}/pulls`) body = b; return open(m, p, b) }
    await ensureListing(args(gh, { branch: 'x@y`z' }))
    expect(body.body).toBe('Adds alice to users.json: data repo alice/cupitor-data.')
  })

  // A user whose fork, if any, is not at <login>/cupitor-users. `forks` is
  // upstream's fork list (each { name, owner }); `cupitorUsers` is what
  // GET /repos/alice/cupitor-users answers.
  function namedForkWorld({ forks = [], cupitorUsers = err(404), forkFails = false, created = 'cupitor-users-1' } = {}) {
    const st = { forks: forks.slice(), text: null, prs: [] }
    const mine = () => st.forks.find(f => f.owner.login.toLowerCase() === 'alice')
    const name = () => (mine() ? mine().name : null)
    const routes = {
      [`GET ${UP}/contents/users.json`]: { text: UPSTREAM_TEXT, sha: 'UF1' },
      [PRS]: () => st.prs,
      [`GET ${UP}/git/ref/heads/main`]: { object: { sha: 'UP1' } },
      'GET /repos/alice/cupitor-users': cupitorUsers,
      [`GET ${UP}/forks`]: (_b, path) => {
        const page = Number(/[?&]page=(\d+)/.exec(path)[1])
        expect(path).toBe(`${UP}/forks?per_page=100&page=${page}`)
        return st.forks.slice((page - 1) * 100, page * 100)
      },
      [`POST ${UP}/forks`]: () => {
        if (forkFails) throw err(500, 'boom')
        st.forks.unshift({ name: created, owner: { login: 'alice' } })
        return { name: created, owner: { login: 'alice' } }
      },
      [`POST ${UP}/pulls`]: () => { st.prs.push({ state: 'open', merged_at: null }); return { number: 1 } },
    }
    const gh = fakeGh(routes)
    const real = gh.request
    // Every /repos/alice/<fork>/… call must name the fork found or made.
    gh.request = async (m, p, b) => {
      const at = /^\/repos\/alice\/([^/?]+)\/(git\/ref\/heads\/main|merge-upstream|git\/refs)$/.exec(p)
      if (at) {
        expect(at[1]).toBe(name())
        gh.calls.push(`${m} ${p}`)
        if (at[2] === 'git/refs') {
          if (st.text !== null) throw err(422, 'Reference already exists')
          st.text = UPSTREAM_TEXT
        }
        return at[2] === 'git/ref/heads/main' ? { object: { sha: 'F1' } } : {}
      }
      return real(m, p, b)
    }
    gh.getFile = async (owner, repo, _f, _t, branch) => {
      if (owner === 'trexsatya') return { content: UPSTREAM_TEXT, sha: 'UF1' }
      expect([owner, repo, branch]).toEqual(['alice', name(), 'add-alice'])
      gh.calls.push(`GET /repos/${owner}/${repo}/contents/users.json?ref=${branch}`)
      if (st.text === null) throw err(404)
      return { content: st.text, sha: st.text === UPSTREAM_TEXT ? 'UF1' : 'B2' }
    }
    gh.putFile = async (owner, repo, _f, content, _msg, sha, _t, branch) => {
      expect([owner, repo, sha, branch]).toEqual(['alice', name(), 'UF1', 'add-alice'])
      gh.calls.push(`PUT /repos/${owner}/${repo}/contents/users.json`)
      st.text = content; return {}
    }
    return { gh, st }
  }
  const others = n => Array.from({ length: n }, (_, i) => ({ name: 'cupitor-users', owner: { login: `user${i}` } }))

  test('an existing fork under another name (found on a later page, owner in any case) is reused, no fork made', async () => {
    const { gh, st } = namedForkWorld({ forks: [...others(150), { name: 'my-users', owner: { login: 'Alice' } }] })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(gh.calls).not.toContain(`POST ${UP}/forks`)
    expect(gh.calls).toContain('PUT /repos/alice/my-users/contents/users.json')
    expect(gh.calls.filter(c => c.startsWith(`GET ${UP}/forks`))).toEqual([
      `GET ${UP}/forks?per_page=100&page=1`, `GET ${UP}/forks?per_page=100&page=2`,
    ])
    expect(st.text).toBe(WITH_ALICE)
  })

  test('the fork list stops at the first match', async () => {
    const { gh } = namedForkWorld({ forks: [{ name: 'my-users', owner: { login: 'alice' } }, ...others(250)] })
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(gh.calls.filter(c => c.startsWith(`GET ${UP}/forks`))).toHaveLength(1)
  })

  test('a repo named cupitor-users that is not a fork, and no fork: one fork is made and its name used; a retry does not fork again', async () => {
    const cupitorUsers = { name: 'cupitor-users', fork: false }
    const { gh, st } = namedForkWorld({ cupitorUsers, forks: others(3) })
    // First run fails after forking (at the PR), so the retry starts over.
    const real = gh.request
    let failPr = true
    gh.request = async (m, p, b) => {
      if (failPr && m === 'POST' && p === `${UP}/pulls`) throw err(502, 'bad gateway')
      return real(m, p, b)
    }
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', status: 502 })
    expect(gh.calls.filter(c => c === `POST ${UP}/forks`)).toHaveLength(1)
    expect(gh.calls).toContain('PUT /repos/alice/cupitor-users-1/contents/users.json')
    failPr = false
    gh.calls.length = 0
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(gh.calls).not.toContain(`POST ${UP}/forks`)
    expect(gh.calls.some(c => c.startsWith('PUT'))).toBe(false)
    expect(st.text).toBe(WITH_ALICE)
    expect(st.prs).toHaveLength(1)
  })

  test('a failing fork list is an error, not a reason to fork', async () => {
    const { gh } = namedForkWorld()
    const real = gh.request
    gh.request = async (m, p, b) => (m === 'GET' && p.startsWith(`${UP}/forks`) ? Promise.reject(err(503)) : real(m, p, b))
    await expect(ensureListing(args(gh))).rejects.toMatchObject({ step: 'listing', status: 503 })
    expect(gh.calls).not.toContain(`POST ${UP}/forks`)
  })

  test('a fork that is not ready within 30 s → timeout; the retry does not fork again', async () => {
    const c = clock()
    let ready = false
    const { gh, st } = world()
    const open = gh.request
    gh.request = async (m, p, b) => {
      if (p === '/repos/alice/cupitor-users/git/ref/heads/main' && !ready) throw err(404)
      return open(m, p, b)
    }
    await expect(ensureListing(args(gh, { sleep: async () => c.tick(10000), now: c.now })))
      .rejects.toMatchObject({ step: 'listing', code: 'timeout' })
    expect(st.forked).toBe(true)
    gh.calls.length = 0
    ready = true
    expect(await ensureListing(args(gh))).toBe('awaiting')
    expect(gh.calls).not.toContain(`POST ${UP}/forks`)
  })

  test('401 → unauthorized; a failing status check writes nothing', async () => {
    let w = world()
    const open = w.gh.request
    w.gh.request = async (m, p, b) => { if (m === 'POST' && p.endsWith('/forks')) throw err(401, 'Bad credentials'); return open(m, p, b) }
    await expect(ensureListing(args(w.gh))).rejects.toMatchObject({ step: 'listing', code: 'unauthorized', status: 401 })
    w = world()
    const open2 = w.gh.request
    w.gh.request = async (m, p, b) => { if (p.startsWith(`${UP}/pulls`)) throw err(503); return open2(m, p, b) }
    await expect(ensureListing(args(w.gh))).rejects.toMatchObject({ step: 'listing', code: 'github', status: 503 })
    expect(writes(w.gh)).toEqual([])
  })
})

describe('runSetup', () => {
  const BOB = { login: 'bob', name: 'Bob', repo: 'cupitor-data', branch: 'main' }
  // A user whose data repo is ready and who is listed (or not, per `users`).
  const ready = (login = 'alice', repo = 'cupitor-data', users = WITH_ALICE) => fakeGh({
    [`GET /repos/${login}/${repo}`]: { name: repo },
    [`GET /repos/${login}/${repo}/contents/cupitor.json`]: { sha: 's' },
    [`GET ${UP}/contents/users.json`]: { text: users, sha: 'UF1' },
  })
  const run = (gh, storage, extra = {}) => runSetup({ login: 'alice', name: 'Alice', gh, storage, sleep: noSleep, now: clock().now, ...extra })
  const saved = storage => JSON.parse(storage.dump()[ACCOUNT_KEY])

  test('repo then listing; the account record gets the repo as soon as it exists', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: null, branch: null }) })
    const out = await run(ready(), storage)
    expect(out.status).toBe('listed')
    expect(loadAccount(storage)).toMatchObject({ login: 'alice', repo: 'cupitor-data', branch: 'main' })
    expect(out.state).toEqual(loadAccount(storage))
  })

  test('the record is written before the listing step starts', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) })
    const gh = ready()
    gh.getFile = async () => { expect(loadAccount(storage).repo).toBe('cupitor-data'); return { content: WITH_ALICE, sha: 'UF1' } }
    expect((await run(gh, storage)).status).toBe('listed')
  })

  test('a listing failure leaves the repo recorded (the user can already write)', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) })
    const gh = ready()
    gh.getFile = async () => { throw err(500) }
    await expect(run(gh, storage)).rejects.toMatchObject({ step: 'listing', code: 'github', status: 500 })
    expect(loadAccount(storage).repo).toBe('cupitor-data')
  })

  test('a repo failure writes nothing to the record', async () => {
    const rec = JSON.stringify({ login: 'alice', repo: null, branch: null, other: null })
    const storage = memStorage({ [ACCOUNT_KEY]: rec })
    await expect(run(fakeGh({ 'GET /repos/alice/cupitor-data': err(503) }), storage)).rejects.toMatchObject({ step: 'repo', code: 'github' })
    expect(storage.dump()[ACCOUNT_KEY]).toBe(rec)
  })

  test('a chosen repo name is used and recorded; the listing status passes through', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) })
    const gh = ready('alice', 'my-data', UPSTREAM_TEXT)
    gh.getFile = async () => ({ content: UPSTREAM_TEXT, sha: 'UF1' })
    const routes = gh.request
    gh.request = async (m, p, b) => (m === 'GET' && p.startsWith(`${UP}/pulls`) ? [{ state: 'open', merged_at: null }] : routes(m, p, b))
    const out = await run(gh, storage, { repoName: 'my-data' })
    expect(out.status).toBe('awaiting')
    expect(out.state).toMatchObject({ login: 'alice', repo: 'my-data', branch: 'main' })
  })

  test('a retry uses the repo already recorded, unless another name is given', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'my-data', branch: 'main' }) })
    const gh = ready('alice', 'my-data')
    await run(gh, storage)
    expect(gh.calls).toContain('GET /repos/alice/my-data')
    expect(loadAccount(storage).repo).toBe('my-data')
    const ghCase = ready('Alice', 'my-data')
    await run(ghCase, storage, { login: 'Alice' })
    expect(ghCase.calls).toContain('GET /repos/Alice/my-data')
    expect(loadAccount(storage)).toMatchObject({ login: 'Alice', repo: 'my-data' })
    const gh2 = ready('alice', 'other-data')
    await run(gh2, storage, { repoName: 'other-data' })
    expect(loadAccount(storage).repo).toBe('other-data')
  })

  test('the same login (any case) keeps its chosen other; the login is stored as given', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: null, branch: null, other: BOB }) })
    await run(ready('Alice'), storage, { login: 'Alice' })
    expect(loadAccount(storage)).toMatchObject({ login: 'Alice', repo: 'cupitor-data', other: BOB })
    const none = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', other: null }) })
    await run(ready(), none)
    expect(loadAccount(none).other).toBeNull()
  })

  test('a different login, a guest record or no record → the default other', async () => {
    for (const rec of [{ login: 'bob', repo: 'bob-data', branch: 'main', other: null },{ login: null, other: null }, undefined]) {
      const storage = memStorage(rec ? { [ACCOUNT_KEY]: JSON.stringify(rec) } : {})
      const out = await run(ready(), storage)
      expect(out.state).toMatchObject({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: { ...OWNER } })
      expect(out.state.legacy).toBeUndefined()
    }
  })

  test('a recorded missing repo is dropped once the new repo is set', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: null, branch: null, missingRepo: { repo: 'gone', branch: 'main' } }) })
    expect(loadAccount(storage).missingRepo).toBeTruthy()
    await run(ready(), storage)
    expect(saved(storage).missingRepo).toBeUndefined()
    expect(loadAccount(storage).repo).toBe('cupitor-data')
  })

  test('progress is reported for both steps', async () => {
    const steps = []
    await run(ready(), memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) }), { report: (s, x) => steps.push(`${s}:${x}`) })
    expect(steps).toEqual(['repo:checking', 'repo:done', 'listing:checking', 'listing:done'])
  })

  test('a record that cannot be saved → SetupError, the listing is not started', async () => {
    const base = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) })
    for (const storage of [
      { ...base, setItem: () => { throw new Error('QuotaExceededError') } },
      { getItem: () => null, setItem: () => {}, removeItem: () => {} }, // write accepted, never read back
    ]) {
      const gh = ready()
      await expect(run(gh, storage)).rejects.toMatchObject({ name: 'SetupError', step: 'repo', code: 'not_saved' })
      expect(gh.calls.some(c => c.includes('cupitor-users'))).toBe(false)
    }
  })

  test('the owner needs no setup: no network, the owner repo is recorded', async () => {
    for (const login of ['trexsatya', 'TrexSatya']) {
      const storage = memStorage()
      const gh = fakeGh({})
      const out = await runSetup({ login, gh, storage })
      expect(out.status).toBe('listed')
      expect(gh.calls).toEqual([])
      expect(out.state).toMatchObject({ login, repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })
      expect(loadAccount(storage)).toEqual(out.state)
      expect(loadAccount(storage).legacy).toBeUndefined()
    }
  })

  test('the owner keeps a chosen other and ignores a repo name', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya', other: BOB }) })
    const gh = fakeGh({})
    const out = await runSetup({ login: 'trexsatya', repoName: 'cupitor-data', gh, storage })
    expect(gh.calls).toEqual([])
    expect(out.state).toMatchObject({ repo: 'trexsatya.github.io', branch: 'gh-pages', other: BOB })
  })

  test('no valid login → SetupError bad_login, nothing written', async () => {
    const storage = memStorage()
    await expect(runSetup({ login: null, gh: fakeGh({}), storage })).rejects.toMatchObject({ step: 'repo', code: 'bad_login' })
    expect(storage.dump()).toEqual({})
  })
})

// ---- browser token, sign-in / sign-out, 401, boot reconcile ----

function fakeGhUtils(initial = null) {
  let token = initial
  return {
    setGHToken: t => { token = t ? String(t).trim() : null },
    clearGHToken: () => { token = null },
    hasGHToken: () => !!token,
    get token() { return token },
  }
}
const storages = () => ({ session: memStorage(), local: memStorage() })
// A storage whose writes to `badKey` (or every key when omitted) throw.
function brokenStorage(init = {}, badKey) {
  const s = memStorage(init)
  const setItem = s.setItem
  s.setItem = (k, v) => { if (!badKey || k === badKey) throw new Error('QuotaExceededError'); setItem(k, v) }
  return s
}
// Like fakeGh, but a 401 raises cupitorGithubUnauthorized on `target` before
// throwing, as GitHubUtils does.
function loudGh(routes, target) {
  const g = fakeGh(routes)
  const request = g.request
  g.request = async (...a) => {
    try { return await request(...a) } catch (e) {
      if (/GitHub API error 401\b/.test(e.message)) target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
      throw e
    }
  }
  return g
}
const ALICE_REC = JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main' })
const ALICE_MARKER = { 'GET /repos/alice/cupitor-data/contents/cupitor.json': { sha: 's' } }
const capture = (id, capturedAt) => ({ id, capturedAt, detail: { videoId: 'v' + id } })

describe('browser token', () => {
  test('session by default, local when remembered, forget clears both', () => {
    const s = storages()
    expect(rememberToken('ghp_1', false, s)).toBe(true)
    expect(s.session.getItem(TOKEN_SESSION_KEY)).toBe('ghp_1'); expect(s.local.getItem(TOKEN_REMEMBER_KEY)).toBeNull()
    expect(rememberToken('ghp_2', true, s)).toBe(true)
    expect(s.local.getItem(TOKEN_REMEMBER_KEY)).toBe('ghp_2'); expect(s.session.getItem(TOKEN_SESSION_KEY)).toBeNull()
    expect(storedToken(s)).toBe('ghp_2')
    rememberToken('ghp_3', false, s)
    expect(s.local.getItem(TOKEN_REMEMBER_KEY)).toBeNull(); expect(storedToken(s)).toBe('ghp_3')
    forgetToken(s)
    expect(storedToken(s)).toBeNull()
    expect(s.session.dump()).toEqual({}); expect(s.local.dump()).toEqual({})
  })

  test('a storage that refuses the write → false; unreadable storages read as no token', () => {
    expect(rememberToken('ghp_1', false, { session: brokenStorage(), local: memStorage() })).toBe(false)
    expect(rememberToken('ghp_1', true, { session: memStorage(), local: null })).toBe(false)
    const throwing = { getItem: () => { throw new Error('SecurityError') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(storedToken({ session: throwing, local: throwing })).toBeNull()
    expect(() => forgetToken({ session: throwing, local: throwing })).not.toThrow()
    // a copy that cannot be removed from the other storage is a failure, not two copies
    const stuck = memStorage({ [TOKEN_SESSION_KEY]: 'old' }); stuck.removeItem = () => { throw new Error('x') }
    expect(rememberToken('ghp_2', true, { session: stuck, local: memStorage() })).toBe(false)
  })

  test('applyStoredToken hands the token to GitHubUtils', () => {
    const s = storages(); const u = fakeGhUtils()
    expect(applyStoredToken(u, s)).toBe(false)
    expect(u.token).toBeNull()
    rememberToken('ghp_3', false, s)
    expect(applyStoredToken(u, s)).toBe(true); expect(u.token).toBe('ghp_3')
  })
})

describe('signInWithToken', () => {
  afterEach(() => { delete global.GitHubProxy })

  test('a good token signs in, is kept and used for requests', async () => {
    const s = storages(); const u = fakeGhUtils(); const storage = memStorage()
    const gh = fakeGh({ 'GET /user': { login: 'alice', name: 'Alice' }, ...ALICE_MARKER })
    const state = await signInWithToken(' ghp_ok ', { remember: true, gh, ghUtils: u, storages: s, storage })
    expect(state).toMatchObject({ login: 'alice', repo: 'cupitor-data', branch: 'main' })
    expect(loadAccount(storage)).toEqual(state)
    expect(storedToken(s)).toBe('ghp_ok'); expect(s.session.getItem(TOKEN_SESSION_KEY)).toBeNull(); expect(u.token).toBe('ghp_ok')
  })

  test('a token GitHub refuses is dropped and the previous one is back in use', async () => {
    const s = storages(); const u = fakeGhUtils(); const storage = memStorage()
    const bad = fakeGh({ 'GET /user': err(401) })
    await expect(signInWithToken('ghp_bad', { gh: bad, ghUtils: u, storages: s, storage })).rejects.toThrow(/did not accept/)
    expect(u.token).toBeNull(); expect(storedToken(s)).toBeNull(); expect(storage.dump()).toEqual({})

    rememberToken('ghp_alice', true, s); u.setGHToken('ghp_alice')
    const aliceStorage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    await expect(signInWithToken('ghp_bad', { remember: false, gh: bad, ghUtils: u, storages: s, storage: aliceStorage })).rejects.toThrow(/did not accept/)
    expect(u.token).toBe('ghp_alice'); expect(storedToken(s)).toBe('ghp_alice')
    expect(s.session.getItem(TOKEN_SESSION_KEY)).toBeNull()
    expect(loadAccount(aliceStorage).login).toBe('alice')
  })

  test('GitHub unreachable → the error is passed on and nothing changes', async () => {
    const s = storages(); const u = fakeGhUtils(); const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    rememberToken('ghp_alice', false, s); u.setGHToken('ghp_alice')
    await expect(signInWithToken('ghp_new', { gh: fakeGh({ 'GET /user': err(502) }), ghUtils: u, storages: s, storage })).rejects.toThrow(/502/)
    expect(u.token).toBe('ghp_alice'); expect(storedToken(s)).toBe('ghp_alice'); expect(loadAccount(storage).login).toBe('alice')
    // the marker check failing is the same
    const gh = fakeGh({ 'GET /user': { login: 'bob' }, 'GET /repos/bob/cupitor-data/contents/cupitor.json': err(500) })
    await expect(signInWithToken('ghp_bob', { remember: true, gh, ghUtils: u, storages: s, storage })).rejects.toThrow(/500/)
    expect(u.token).toBe('ghp_alice'); expect(storedToken(s)).toBe('ghp_alice'); expect(s.local.getItem(TOKEN_REMEMBER_KEY)).toBeNull()
    expect(loadAccount(storage).login).toBe('alice')
  })

  test('an account record that cannot be saved is an error, and the token is not kept', async () => {
    const s = storages(); const u = fakeGhUtils(); const storage = brokenStorage({}, ACCOUNT_KEY)
    const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
    await expect(signInWithToken('ghp_ok', { remember: true, gh, ghUtils: u, storages: s, storage })).rejects.toThrow(/could not save/)
    expect(u.token).toBeNull(); expect(storedToken(s)).toBeNull()
    expect(loadAccount(storage).legacy).toBe(true)
  })

  test('a token the browser cannot keep is an error before anything is recorded', async () => {
    const s = { session: brokenStorage(), local: memStorage() }; const u = fakeGhUtils(); const storage = memStorage()
    const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
    await expect(signInWithToken('ghp_ok', { gh, ghUtils: u, storages: s, storage })).rejects.toThrow(/could not keep/)
    expect(u.token).toBeNull(); expect(storage.dump()).toEqual({})
  })

  test('no token, or inside the app → refused without a request', async () => {
    const u = fakeGhUtils(); const gh = fakeGh({})
    await expect(signInWithToken('  ', { gh, ghUtils: u, storages: storages(), storage: memStorage() })).rejects.toThrow(/No token/)
    global.GitHubProxy = { postMessage: () => {} }
    await expect(signInWithToken('ghp_ok', { gh, ghUtils: u, storages: storages(), storage: memStorage() })).rejects.toThrow(/app/)
    expect(gh.calls).toEqual([]); expect(u.token).toBeNull()
  })

  test("a 401 from the token being tried does not sign the current user out", async () => {
    const s = storages(); const u = fakeGhUtils('ghp_alice'); const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    rememberToken('ghp_alice', false, s)
    const target = new EventTarget(); const after = jest.fn()
    installUnauthorizedHandler({ ghUtils: u, storages: s, storage, onSignedOut: after, target })
    await expect(signInWithToken('ghp_bad', { gh: loudGh({ 'GET /user': err(401) }, target), ghUtils: u, storages: s, storage })).rejects.toThrow(/did not accept/)
    expect(after).not.toHaveBeenCalled()
    expect(loadAccount(storage).login).toBe('alice'); expect(u.token).toBe('ghp_alice')
    // ...but a 401 afterwards still does
    target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe('signOut and the 401 handler', () => {
  test('signOut forgets the token and returns to guest, keeping pending-edit keys', () => {
    const s = storages(); const u = fakeGhUtils()
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC, 'cupitor:pendingSrtEdits@alice': '{"x":1}' })
    rememberToken('t', true, s); u.setGHToken('t')
    expect(signOut({ ghUtils: u, storages: s, storage, now: () => 500 })).toBe(true)
    expect(loadAccount(storage)).toEqual({ login: null, repo: null, branch: null, other: ownerEntry() })
    expect(storedToken(s)).toBeNull(); expect(u.token).toBeNull()
    expect(storage.getItem('cupitor:pendingSrtEdits@alice')).toBe('{"x":1}')
    expect(storage.getItem(GUEST_SINCE_KEY)).toBe('500')
    // already a guest: nothing changes, the guest clock keeps its start
    expect(signOut({ ghUtils: u, storages: s, storage, now: () => 900 })).toBe(false)
    expect(storage.getItem(GUEST_SINCE_KEY)).toBe('500')
  })

  test('the legacy owner (no record) signs out to an explicit guest', () => {
    const storage = memStorage()
    expect(signOut({ ghUtils: fakeGhUtils(), storages: storages(), storage })).toBe(true)
    expect(loadAccount(storage)).toMatchObject({ login: null })
    expect(loadAccount(storage).legacy).toBeUndefined()
  })

  test('a guest record that cannot be written → false (the caller must not reload)', () => {
    const storage = brokenStorage({ [ACCOUNT_KEY]: ALICE_REC })
    const u = fakeGhUtils('t')
    expect(signOut({ ghUtils: u, storages: storages(), storage })).toBe(false)
    expect(u.token).toBeNull()
  })

  test('installUnauthorizedHandler signs out once on the event', () => {
    const s = storages(); const u = fakeGhUtils('ghp_alice'); const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) })
    const after = jest.fn()
    const uninstall = installUnauthorizedHandler({ ghUtils: u, storages: s, storage, onSignedOut: after, target: window, now: () => 777 })
    window.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    window.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    expect(after).toHaveBeenCalledTimes(1)
    expect(loadAccount(storage).login).toBeNull()
    expect(s.session.getItem(UNAUTHORIZED_AT_KEY)).toBe('777')
    uninstall()
  })

  test('in a browser, a 401 with no token in use signs nobody out', () => {
    const s = storages(); rememberToken('ghp_alice', true, s)
    const u = fakeGhUtils() // nothing in memory: the failing request carried no token
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    const target = new EventTarget(); const after = jest.fn()
    installUnauthorizedHandler({ ghUtils: u, storages: s, storage, onSignedOut: after, target })
    target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    expect(after).not.toHaveBeenCalled()
    expect(loadAccount(storage).login).toBe('alice'); expect(storedToken(s)).toBe('ghp_alice')
    expect(s.session.getItem(UNAUTHORIZED_AT_KEY)).toBeNull()
  })

  describe('inside the app', () => {
    afterEach(() => { delete global.GitHubProxy })

    test('the 401 handler signs out with no token in the page (the app holds it)', () => {
      global.GitHubProxy = { postMessage: () => {} }
      const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
      const target = new EventTarget(); const after = jest.fn()
      installUnauthorizedHandler({ ghUtils: fakeGhUtils(), storages: storages(), storage, onSignedOut: after, target })
      target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
      expect(after).toHaveBeenCalledTimes(1)
      expect(loadAccount(storage).login).toBeNull()
    })

    test('no reload loop: right after a 401 sign-out the boot check does not sign the same token back in', async () => {
      global.GitHubProxy = { postMessage: () => {} }
      const s = storages(); const u = fakeGhUtils()
      const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
      const target = new EventTarget(); const after = jest.fn()
      installUnauthorizedHandler({ ghUtils: u, storages: s, storage, onSignedOut: after, target, now: () => 1000 })
      target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
      expect(after).toHaveBeenCalledTimes(1)
      // the reload: GET /user still answers 200 for the app's token
      const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
      expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: true, now: () => 1000 + 5000 })).toBe('unchecked')
      expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: true, now: () => 1000 + 59000 })).toBe('unchecked')
      expect(loadAccount(storage).login).toBeNull()
      // a minute later it is a normal boot again
      expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: true, now: () => 1000 + 61000 })).toBe('reload')
      expect(loadAccount(storage).login).toBe('alice')
    })
  })

  test('a 401 while already a guest changes nothing and does not ask for a reload', () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null }) })
    const target = new EventTarget(); const after = jest.fn()
    installUnauthorizedHandler({ ghUtils: fakeGhUtils(), storages: storages(), storage, onSignedOut: after, target })
    target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    expect(after).not.toHaveBeenCalled()
  })

  test('when the guest record cannot be written the handler does not ask for a reload', () => {
    const storage = brokenStorage({ [ACCOUNT_KEY]: ALICE_REC })
    const target = new EventTarget(); const after = jest.fn()
    installUnauthorizedHandler({ ghUtils: fakeGhUtils('t'), storages: storages(), storage, onSignedOut: after, target })
    target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    expect(after).not.toHaveBeenCalled()
  })
})

describe('reconcileLogin (boot)', () => {
  test('a guest with no token source → ok, no request', async () => {
    const gh = fakeGh({})
    const guest = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null }) })
    expect(await reconcileLogin({ gh, ghUtils: fakeGhUtils(), storages: storages(), storage: guest, bridgeAvailable: false })).toBe('ok')
    expect(gh.calls).toEqual([])
  })

  test('no token source never downgrades an account: no_token, record untouched, every boot', async () => {
    for (const rec of [undefined, ALICE_REC, JSON.stringify({ login: 'trexsatya' }), JSON.stringify({ login: 'bob' })]) {
      const storage = memStorage(rec ? { [ACCOUNT_KEY]: rec } : {})
      const before = storage.dump(); const gh = fakeGh({})
      for (let boot = 0; boot < 2; boot++) {
        expect(await reconcileLogin({ gh, ghUtils: fakeGhUtils(), storages: storages(), storage, bridgeAvailable: false })).toBe('no_token')
      }
      expect(storage.dump()).toEqual(before)
      expect(gh.calls).toEqual([])
    }
  })

  test('a second tab without the session token leaves the first tab signed in', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    const tab1 = storages(); rememberToken('ghp_alice', false, tab1)
    const tab2 = storages()
    expect(await reconcileLogin({ gh: fakeGh({}), ghUtils: fakeGhUtils(), storages: tab2, storage, bridgeAvailable: false })).toBe('no_token')
    expect(loadAccount(storage).login).toBe('alice'); expect(storedToken(tab1)).toBe('ghp_alice')
  })

  test('the legacy owner with a token in use is recorded as the owner without a reload', async () => {
    const gh = fakeGh({ 'GET /user': { login: 'trexsatya' } })
    for (const opts of [{ bridgeAvailable: true, ghUtils: fakeGhUtils() }, { bridgeAvailable: false, ghUtils: fakeGhUtils('ghp_prompted') }]) {
      const storage = memStorage()
      expect(await reconcileLogin({ gh, storages: storages(), storage, ...opts })).toBe('ok')
      expect(loadAccount(storage)).toEqual({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })
    }
  })

  test('the legacy owner keeps saving when the check cannot complete', async () => {
    for (const fail of [err(502), err(403, 'rate limit'), new Error('GitHubProxy timeout')]) {
      const storage = memStorage()
      expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': fail }), ghUtils: fakeGhUtils(), storages: storages(), storage, bridgeAvailable: true })).toBe('unchecked')
      expect(loadAccount(storage).legacy).toBe(true)
      expect(storage.dump()).toEqual({})
    }
  })

  test('a stored token is put to use; a network failure keeps the account and the token', async () => {
    const s = storages(); const u = fakeGhUtils(); rememberToken('ghp_alice', true, s)
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(500) }), ghUtils: u, storages: s, storage, bridgeAvailable: false })).toBe('unchecked')
    expect(u.token).toBe('ghp_alice'); expect(storedToken(s)).toBe('ghp_alice'); expect(loadAccount(storage).login).toBe('alice')
    const gh = fakeGh({ 'GET /user': { login: 'Alice' } })
    expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: false })).toBe('ok')
    expect(gh.calls).toEqual(['GET /user'])
  })

  test('in the app: GET /user decides; a changed login is adopted and reloads; the same login is ok', async () => {
    const s = storages(); const u = fakeGhUtils()
    const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null }) })
    expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: true })).toBe('reload')
    expect(loadAccount(storage)).toMatchObject({ login: 'alice', repo: 'cupitor-data' })
    expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: true })).toBe('ok')
    expect(u.token).toBeNull()
  })

  test('another login than the record → adopted, reload', async () => {
    const s = storages(); const u = fakeGhUtils(); rememberToken('ghp_bob', false, s)
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    const gh = fakeGh({ 'GET /user': { login: 'bob' }, 'GET /repos/bob/cupitor-data/contents/cupitor.json': { sha: 's' } })
    expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: false })).toBe('reload')
    expect(loadAccount(storage)).toMatchObject({ login: 'bob', repo: 'cupitor-data' })
  })

  test('in the app with no token and a stale record → signed out, reload', async () => {
    const s = storages(); const u = fakeGhUtils()
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) })
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: u, storages: s, storage, bridgeAvailable: true })).toBe('reload')
    expect(loadAccount(storage).login).toBeNull()
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: u, storages: s, storage, bridgeAvailable: true })).toBe('ok')
  })

  test('a 401 sign-out at boot leaves the same mark as the 401 handler, so the next page says why', async () => {
    for (const rec of [ALICE_REC, null]) { // a login, and the legacy owner (no record)
      const s = storages(); const u = fakeGhUtils(); rememberToken('ghp_old', false, s)
      const storage = memStorage(rec ? { [ACCOUNT_KEY]: rec } : {})
      expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: u, storages: s, storage, bridgeAvailable: false, now: () => 4242 })).toBe('reload')
      expect(s.session.getItem(UNAUTHORIZED_AT_KEY)).toBe('4242')
    }
  })

  test('no mark when nothing was signed out: already a guest, or the guest record could not be written', async () => {
    const s1 = storages()
    const guest = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null }) })
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: fakeGhUtils(), storages: s1, storage: guest, bridgeAvailable: true })).toBe('ok')
    expect(s1.session.getItem(UNAUTHORIZED_AT_KEY)).toBeNull()
    const s2 = storages()
    const stale = brokenStorage({ [ACCOUNT_KEY]: ALICE_REC })
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: fakeGhUtils(), storages: s2, storage: stale, bridgeAvailable: true })).toBe('unchecked')
    expect(s2.session.getItem(UNAUTHORIZED_AT_KEY)).toBeNull()
  })

  test('right after a boot 401 sign-out, pasting a new token still signs in', async () => {
    const s = storages(); const u = fakeGhUtils(); rememberToken('ghp_old', false, s)
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: u, storages: s, storage, bridgeAvailable: false })).toBe('reload')
    expect(s.session.getItem(UNAUTHORIZED_AT_KEY)).not.toBeNull()
    const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
    expect(await signInWithToken('ghp_new', { gh, ghUtils: u, storages: s, storage })).toMatchObject({ login: 'alice', repo: 'cupitor-data' })
  })

  test('its own 401 never triggers the handler, so there is one sign-out and no reload loop', async () => {
    const target = new EventTarget(); const after = jest.fn()
    const s = storages(); const u = fakeGhUtils(); rememberToken('ghp_old', true, s)
    const storage = memStorage({ [ACCOUNT_KEY]: ALICE_REC })
    installUnauthorizedHandler({ ghUtils: u, storages: s, storage, onSignedOut: after, target })
    const gh = loudGh({ 'GET /user': err(401) }, target)
    expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: false })).toBe('reload')
    expect(after).not.toHaveBeenCalled()
    expect(storedToken(s)).toBeNull(); expect(u.token).toBeNull()
    // the next boot (no token now) is quiet
    expect(await reconcileLogin({ gh, ghUtils: u, storages: s, storage, bridgeAvailable: false })).toBe('ok')
    // and a guest's 401s never ask for a reload either
    target.dispatchEvent(new CustomEvent('cupitorGithubUnauthorized'))
    expect(after).not.toHaveBeenCalled()
  })

  test('a record that cannot be written never asks for a reload (no reload loop)', async () => {
    const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
    const guest = brokenStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null }) })
    expect(await reconcileLogin({ gh, ghUtils: fakeGhUtils(), storages: storages(), storage: guest, bridgeAvailable: true })).toBe('unchecked')
    const stale = brokenStorage({ [ACCOUNT_KEY]: ALICE_REC })
    expect(await reconcileLogin({ gh: fakeGh({ 'GET /user': err(401) }), ghUtils: fakeGhUtils(), storages: storages(), storage: stale, bridgeAvailable: true })).toBe('unchecked')
    expect(loadAccount(stale).login).toBe('alice')
  })
})

describe("a guest's unsent captures follow them into their new account", () => {
  const BASE = 'cupitor:capturedSubtitles'
  const GUEST = `${BASE}@~guest`

  test("the guest's captures move to the new login; the owner's plain-key captures stay", async () => {
    const storage = memStorage({
      [ACCOUNT_KEY]: ALICE_REC,
      [`${BASE}@alice`]: JSON.stringify([capture('a0', 10)]),
      [BASE]: JSON.stringify([capture('owner', 50)]),
    })
    const s = storages(); const u = fakeGhUtils()
    signOut({ ghUtils: u, storages: s, storage, now: () => 100 })
    storage.setItem(GUEST, JSON.stringify([capture('g1', 150), capture('g2', 160)]))
    const gh = fakeGh({ 'GET /user': { login: 'Alice' }, 'GET /repos/Alice/cupitor-data/contents/cupitor.json': { sha: 's' } })
    await signInWithToken('ghp', { gh, ghUtils: u, storages: s, storage })
    expect(JSON.parse(storage.getItem(BASE)).map(c => c.id)).toEqual(['owner'])
    expect(JSON.parse(storage.getItem(`${BASE}@alice`)).map(c => c.id)).toEqual(['a0', 'g1', 'g2'])
    expect(storage.getItem(GUEST)).toBeNull()
    expect(storage.getItem(GUEST_SINCE_KEY)).toBeNull()
  })

  test('the same happens when the app signs a guest in (boot reconcile)', async () => {
    const storage = memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null }), [GUEST_SINCE_KEY]: '100', [GUEST]: JSON.stringify([capture('g1', 150)]) })
    const gh = fakeGh({ 'GET /user': { login: 'alice' }, ...ALICE_MARKER })
    expect(await reconcileLogin({ gh, ghUtils: fakeGhUtils(), storages: storages(), storage, bridgeAvailable: true })).toBe('reload')
    expect(storage.getItem(GUEST)).toBeNull()
    expect(JSON.parse(storage.getItem(`${BASE}@alice`)).map(c => c.id)).toEqual(['g1'])
  })

  test("a guest signing in as the owner: the guest's captures join the owner's plain key", () => {
    const storage = memStorage({ [GUEST_SINCE_KEY]: '100', [GUEST]: JSON.stringify([capture('g1', 150)]), [BASE]: JSON.stringify([capture('o1', 5)]) })
    expect(carryGuestCaptures('trexsatya', { storage })).toBe(1)
    expect(JSON.parse(storage.getItem(BASE)).map(c => c.id)).toEqual(['o1', 'g1'])
    expect(storage.getItem(GUEST)).toBeNull()
    expect(storage.getItem(GUEST_SINCE_KEY)).toBeNull()
  })

  test("nothing in the guest's buffer: nothing moves, the owner's plain key is untouched", () => {
    const storage = memStorage({ [BASE]: JSON.stringify([capture('o1', 150)]) })
    expect(carryGuestCaptures('alice', { storage })).toBe(0)
    expect(JSON.parse(storage.getItem(BASE)).map(c => c.id)).toEqual(['o1'])
    expect(storage.getItem(`${BASE}@alice`)).toBeNull()
  })

  test('captures without an id are moved too, never taken for duplicates', () => {
    const storage = memStorage({
      [GUEST]: JSON.stringify([{ capturedAt: 150, detail: {} }, capture('dup', 160)]),
      [`${BASE}@alice`]: JSON.stringify([{ capturedAt: 5, detail: {} }, capture('dup', 160)]),
    })
    expect(carryGuestCaptures('alice', { storage })).toBe(2)
    expect(JSON.parse(storage.getItem(`${BASE}@alice`))).toHaveLength(3)
    expect(storage.getItem(GUEST)).toBeNull()
  })

  test('a target that cannot be written leaves the captures where they are', () => {
    const storage = brokenStorage({ [GUEST]: JSON.stringify([capture('g1', 150)]) }, `${BASE}@alice`)
    expect(carryGuestCaptures('alice', { storage })).toBe(0)
    expect(JSON.parse(storage.getItem(GUEST)).map(c => c.id)).toEqual(['g1'])
  })
})
