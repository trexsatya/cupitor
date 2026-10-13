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
  test('the owner in any case keeps the plain key; other logins are lowercased in the suffix', () => {
    expect(scopedKey('k', { login: 'TrexSatya', repo: null, branch: null, other: null })).toBe('k')
    expect(scopedKey('k', { login: 'Alice', repo: null, branch: null, other: null })).toBe('k@alice')
    expect(scopedKey('k', { login: 'ALICE', repo: null, branch: null, other: null })).toBe('k@alice')
  })
})

describe('normalizeUser validation (values end up in URLs)', () => {
  const ok = { login: 'bob', repo: 'cupitor-data', branch: 'main' }
  test('accepts GitHub-shaped values', () => {
    expect(normalizeUser({ login: 'Bob-2', repo: 'my_repo.v2-x', branch: 'feature/x-1' }))
      .toEqual({ login: 'Bob-2', name: 'Bob-2', repo: 'my_repo.v2-x', branch: 'feature/x-1' })
  })
  test.each([
    ['login with slash', { ...ok, login: 'a/b' }],
    ['login with dot', { ...ok, login: 'a.b' }],
    ['login with space', { ...ok, login: 'a b' }],
    ['login with ?', { ...ok, login: 'a?x=1' }],
    ['login not a string', { ...ok, login: 42 }],
    ['repo with slash', { ...ok, repo: 'a/b' }],
    ['repo with space', { ...ok, repo: 'a b' }],
    ['repo "."', { ...ok, repo: '.' }],
    ['repo ".."', { ...ok, repo: '..' }],
    ['repo with #', { ...ok, repo: 'a#b' }],
    ['branch with ..', { ...ok, branch: 'a..b' }],
    ['branch with leading /', { ...ok, branch: '/main' }],
    ['branch with space', { ...ok, branch: 'ma in' }],
    ['branch with tab', { ...ok, branch: 'ma\tin' }],
    ['branch with control char', { ...ok, branch: 'ma\u0001in' }],
    ['branch with DEL', { ...ok, branch: 'ma\u007fin' }],
    ['branch not a string', { ...ok, branch: 7 }],
  ])('rejects %s', (_, u) => {
    expect(normalizeUser(u)).toBeNull()
  })
  test('rejects non-objects', () => {
    expect(normalizeUser('bob')).toBeNull()
    expect(normalizeUser(undefined)).toBeNull()
  })
  test('loadAccount drops an invalid own login, repo or branch', () => {
    const load = rec => loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify(rec) }))
    expect(load({ login: 'a/b', repo: 'cupitor-data', branch: 'main' }).login).toBeNull()
    const badRepo = load({ login: 'alice', repo: '..', branch: 'main' })
    expect(badRepo.repo).toBeNull(); expect(badRepo.branch).toBeNull()
    const badBranch = load({ login: 'alice', repo: 'cupitor-data', branch: '/x' })
    expect(badBranch.repo).toBeNull(); expect(badBranch.branch).toBeNull()
  })
})

describe('storage robustness', () => {
  const throwing = () => ({
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('quota') },
    removeItem: () => { throw new Error('denied') },
  })
  test('loadAccount never throws and falls back to the no-record state', () => {
    expect(loadAccount(throwing())).toEqual(loadAccount(memStorage()))
  })
  test('saveAccount / clearAccount return false instead of throwing', () => {
    expect(saveAccount({ login: 'alice', repo: null, branch: null, other: null }, throwing())).toBe(false)
    expect(clearAccount(throwing())).toBe(false)
  })
  test('saveAccount / clearAccount return true on success', () => {
    const s = memStorage()
    expect(saveAccount({ login: 'alice', repo: null, branch: null, other: null }, s)).toBe(true)
    expect(clearAccount(s)).toBe(true)
  })
  test('a global localStorage whose access throws is treated as no storage', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
    try {
      expect(loadAccount().login).toBeNull()
      expect(saveAccount({ login: 'alice', repo: null, branch: null, other: null })).toBe(false)
      expect(clearAccount()).toBe(false)
      expect(scopedKey('k')).toBe('k')
    } finally {
      Object.defineProperty(window, 'localStorage', desc)
    }
  })
})

describe('stored other', () => {
  const load = rec => loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify(rec) }))
  const base = { login: 'alice', repo: 'cupitor-data', branch: 'main' }
  test('present but invalid falls back to the default for the login', () => {
    expect(load({ ...base, other: 'bob' }).other).toEqual({ ...OWNER })
    expect(load({ ...base, other: { login: 'bob' } }).other).toEqual({ ...OWNER })
    expect(load({ ...base, other: { login: 'b/ob', repo: 'x' } }).other).toEqual({ ...OWNER })
    expect(load({ ...base, other: [] }).other).toEqual({ ...OWNER })
    expect(load({ login: 'trexsatya', other: 'bob' }).other).toBeNull()
  })
  test('explicit null stays "none"', () => {
    expect(load({ ...base, other: null }).other).toBeNull()
  })
  test('a valid other is kept, normalized', () => {
    expect(load({ ...base, other: { login: 'bob', repo: 'cupitor-data' } }).other)
      .toEqual({ login: 'bob', name: 'bob', repo: 'cupitor-data', branch: 'main' })
  })
})

describe('case-insensitive logins', () => {
  const load = rec => loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify(rec) }))
  test('the owner in another case gets no default other', () => {
    expect(defaultOther('TrexSatya')).toBeNull()
    expect(load({ login: 'TREXSATYA' }).other).toBeNull()
  })
  test('other equal to self in another case is dropped', () => {
    expect(load({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: { login: 'ALICE', repo: 'cupitor-data' } }).other).toBeNull()
    expect(sources({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: { login: 'Alice', repo: 'cupitor-data', branch: 'main' } }).other).toBeNull()
  })
})

describe('owner without repo/branch', () => {
  test('loadAccount fills the owner repo and branch', () => {
    const r = loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya' }) }))
    expect(r).toEqual({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })
  })
  test('sources uses the owner repo for an owner state without one', () => {
    expect(sources({ login: 'TrexSatya', repo: null, branch: null, other: null }).self)
      .toEqual({ owner: 'TrexSatya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
  })
  test('an owner record with its own valid repo keeps it', () => {
    const r = loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya', repo: 'other-repo', branch: 'main' }) }))
    expect(r.repo).toBe('other-repo'); expect(r.branch).toBe('main')
  })
})

describe('sources — more states', () => {
  test('owner: self is the owner repo, other none by default', () => {
    expect(sources(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }) }))))
      .toEqual({ self: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }, other: null })
  })
  test('owner who chose another user: that user is other', () => {
    expect(sources({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages',
      other: { login: 'bob', name: 'bob', repo: 'cupitor-data', branch: 'main' } }).other)
      .toEqual({ owner: 'bob', repo: 'cupitor-data', branch: 'main' })
  })
  test('other == self is dropped to none', () => {
    expect(sources({ login: 'alice', repo: 'cupitor-data', branch: 'main',
      other: { login: 'alice', name: 'alice', repo: 'cupitor-data', branch: 'main' } }))
      .toEqual({ self: { owner: 'alice', repo: 'cupitor-data', branch: 'main' }, other: null })
  })
  test('signed in, no repo yet, default other: self none, other the owner', () => {
    expect(sources(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'alice' }) }))))
      .toEqual({ self: null, other: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' } })
  })
  test('saveAccount normalizes other (and drops an invalid one to none)', () => {
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: { login: 'bob', repo: 'cupitor-data', extra: 1 } }, s)
    expect(JSON.parse(s.getItem(ACCOUNT_KEY)).other).toEqual({ login: 'bob', name: 'bob', repo: 'cupitor-data', branch: 'main' })
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: { login: 'bob' } }, s)
    expect(JSON.parse(s.getItem(ACCOUNT_KEY)).other).toBeNull()
  })
})
