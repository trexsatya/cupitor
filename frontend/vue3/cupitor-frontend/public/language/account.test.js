import { USERS_CACHE_KEY, OWNER } from './account-state.js'
import { parseUsers, cachedUsers, fetchUsers, ownerEntry, USERS_RAW_URL } from './account.js'

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
})
