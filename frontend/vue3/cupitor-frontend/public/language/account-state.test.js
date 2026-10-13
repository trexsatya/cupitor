import {
  ACCOUNT_KEY, OWNER, loadAccount, saveAccount, clearAccount,
  normalizeUser, defaultOther, sources, scopedKey,
} from './account-state.js'

function memStorage(init = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  }
}

describe('loadAccount', () => {
  test('nothing stored → guest with trexsatya as the other source', () => {
    expect(loadAccount(memStorage())).toEqual({
      login: null, repo: null, branch: null,
      other: { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' },
    })
  })
  test('garbage stored → guest', () => {
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: '{nope' })).login).toBeNull()
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: '[]' })).login).toBeNull()
  })
  test('a signed-in record round-trips', () => {
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main',
      other: { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' } }, s)
    expect(loadAccount(s)).toEqual({ login: 'alice', repo: 'cupitor-data', branch: 'main',
      other: { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' } })
  })
  test('other: null stored means "none"; a missing other means the default', () => {
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null }) })).other).toBeNull()
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main' }) })).other.login).toBe('trexsatya')
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }) })).other).toBeNull()
  })
  test('other equal to self is dropped; a repo without a branch is no repo', () => {
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: { login: 'alice', repo: 'cupitor-data', branch: 'main' } }) })).other).toBeNull()
    const r = loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice', repo: 'cupitor-data' }) }))
    expect(r.repo).toBeNull(); expect(r.branch).toBeNull(); expect(r.login).toBe('alice')
  })
  test('clearAccount returns to guest', () => {
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null }, s)
    clearAccount(s)
    expect(loadAccount(s).login).toBeNull()
  })
})

describe('normalizeUser / defaultOther', () => {
  test('fills name and branch, rejects entries without login or repo', () => {
    expect(normalizeUser({ login: 'bob', repo: 'cupitor-data' })).toEqual({ login: 'bob', name: 'bob', repo: 'cupitor-data', branch: 'main' })
    expect(normalizeUser({ login: 'bob' })).toBeNull()
    expect(normalizeUser(null)).toBeNull()
  })
  test('defaultOther is trexsatya for everyone but trexsatya', () => {
    expect(defaultOther(null).login).toBe('trexsatya')
    expect(defaultOther('alice').login).toBe('trexsatya')
    expect(defaultOther('trexsatya')).toBeNull()
  })
})

describe('sources', () => {
  test('guest: no self, other is the owner', () => {
    expect(sources(loadAccount(memStorage()))).toEqual({
      self: null, other: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' } })
  })
  test('signed in with a repo: self is the repo', () => {
    expect(sources({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null })).toEqual({
      self: { owner: 'alice', repo: 'cupitor-data', branch: 'main' }, other: null })
  })
  test('signed in without a repo: no self', () => {
    expect(sources({ login: 'alice', repo: null, branch: null, other: OWNER }).self).toBeNull()
  })
})

describe('scopedKey', () => {
  test('owner and guest keep the plain key; other logins get a suffix', () => {
    expect(scopedKey('cupitor:recordings', loadAccount(memStorage()))).toBe('cupitor:recordings')
    expect(scopedKey('cupitor:recordings', { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })).toBe('cupitor:recordings')
    expect(scopedKey('cupitor:recordings', { login: 'alice', repo: null, branch: null, other: null })).toBe('cupitor:recordings@alice')
  })
})
