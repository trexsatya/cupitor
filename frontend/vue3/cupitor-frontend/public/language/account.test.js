import { USERS_CACHE_KEY, OWNER, ACCOUNT_KEY, loadAccount } from './account-state.js'
import {
  parseUsers, cachedUsers, fetchUsers, ownerEntry, USERS_RAW_URL,
  MAX_USERS, MAX_USERS_BYTES, fetchLogin, adoptLogin, defaultGh,
  ensureDataRepo, SetupError,
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
