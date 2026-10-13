import { USERS_CACHE_KEY, OWNER, ACCOUNT_KEY, loadAccount } from './account-state.js'
import {
  parseUsers, cachedUsers, fetchUsers, ownerEntry, USERS_RAW_URL,
  MAX_USERS, MAX_USERS_BYTES, fetchLogin, adoptLogin, defaultGh,
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
