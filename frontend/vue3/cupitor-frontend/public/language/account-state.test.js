import {
  ACCOUNT_KEY, OWNER, loadAccount, saveAccount, clearAccount, saveGuest,
  normalizeUser, defaultOther, sources, scopedKey, storageOwner, GUEST_STORAGE_OWNER,
} from './account-state.js'

function memStorage(init = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  }
}

const LEGACY = { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null, legacy: true }
const GUEST_REC = () => memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: null, repo: null, branch: null }) })

describe('loadAccount', () => {
  test('nothing stored → legacy owner (self is the owner repo, no other)', () => {
    expect(loadAccount(memStorage())).toEqual(LEGACY)
  })
  test('garbage stored → legacy owner', () => {
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: '{nope' }))).toEqual(LEGACY)
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: '[]' }))).toEqual(LEGACY)
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: 'null' }))).toEqual(LEGACY)
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: '42' }))).toEqual(LEGACY)
  })
  test('an explicit guest record → guest with trexsatya as the other source', () => {
    expect(loadAccount(GUEST_REC())).toEqual({
      login: null, repo: null, branch: null,
      other: { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' },
    })
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: '{}' })).login).toBeNull()
  })
  test('a record with an invalid login is guest-like, not legacy owner', () => {
    const r = loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'a/b', repo: 'x', branch: 'main' }) }))
    expect(r.login).toBeNull(); expect(r.legacy).toBeUndefined()
    expect(sources(r).self).toBeNull()
  })
  test('a stored owner record is not legacy', () => {
    expect(loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya' }) })).legacy).toBeUndefined()
  })
  test('saveGuest writes an explicit guest record', () => {
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null }, s)
    expect(saveGuest(s)).toBe(true)
    expect(loadAccount(s)).toEqual(loadAccount(GUEST_REC()))
    expect(sources(loadAccount(s))).toEqual({ self: null, other: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' } })
  })
  test('saveGuest returns false when storage throws', () => {
    expect(saveGuest({ getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem() {} })).toBe(false)
  })
  test('saving the legacy state persists a plain owner record', () => {
    const s = memStorage()
    saveAccount(loadAccount(s), s)
    expect(JSON.parse(s.getItem(ACCOUNT_KEY))).toEqual({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })
    expect(loadAccount(s).legacy).toBeUndefined()
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
  test('clearAccount removes the record, which reads back as legacy owner', () => {
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null }, s)
    clearAccount(s)
    expect(loadAccount(s)).toEqual(LEGACY)
  })
})

describe('normalizeUser / defaultOther', () => {
  test('fills name and branch, rejects entries without login or repo', () => {
    expect(normalizeUser({ login: 'bob', repo: 'cupitor-data' })).toEqual({ login: 'bob', name: 'bob', repo: 'cupitor-data', branch: 'main' })
    expect(normalizeUser({ login: 'bob' })).toBeNull()
    expect(normalizeUser(null)).toBeNull()
  })
  test('name is display text from strangers: trimmed, control characters removed, at most 64 characters', () => {
    const name = n => normalizeUser({ login: 'bob', repo: 'r', name: n }).name
    expect(name('  Bob  ')).toBe('Bob')
    expect(name('Bo\u0000b\n\t\u001b[31m\u007f\u0085')).toBe('Bob[31m')
    const cp = (...xs) => String.fromCodePoint(...xs)
    expect(name(`a${cp(0x202e)}evil${cp(0x2066)}x`)).toBe('aevilx')
    expect(name(`a${cp(0x200b)}b${cp(0xad)}c${cp(0xfeff)}d${cp(0x2028)}e${cp(0x61c)}f`)).toBe('abcdef')
    expect(name(cp(0x200b, 0x200d))).toBe('bob')
    expect(name(cp(0x200c, 0x200d, 0x20))).toBe('bob')
  })
  test('name keeps the joiners real scripts and emoji need, drops other invisible fillers', () => {
    const name = n => normalizeUser({ login: 'bob', repo: 'r', name: n }).name
    const cp = (...xs) => String.fromCodePoint(...xs)
    // Persian "salam-donya" with a zero-width non-joiner (U+200C) between the words.
    const persian = cp(0x633, 0x644, 0x627, 0x645, 0x200c, 0x62f, 0x646, 0x6cc, 0x627)
    expect(name(persian)).toBe(persian)
    // Family emoji: man ZWJ woman ZWJ girl.
    const family = cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467)
    expect(name(`Ann ${family}`)).toBe(`Ann ${family}`)
    // Joiners at the ends carry nothing and are trimmed.
    expect(name(`${cp(0x200d)}Ann${cp(0x200c)}`)).toBe('Ann')
    // Hangul fillers, combining grapheme joiner, braille blank, tag characters.
    expect(name(cp(0x3164, 0x115f, 0x1160, 0xffa0))).toBe('bob')
    expect(name(`A${cp(0x34f)}n${cp(0x2800)}n${cp(0xe0001, 0xe0041, 0xe007f)}`)).toBe('Ann')
    expect(name(cp(0x2800, 0x3164, 0x200d))).toBe('bob')
    expect(name('x'.repeat(100))).toBe('x'.repeat(64))
    expect(name('😀'.repeat(70))).toBe('😀'.repeat(64))
    expect(name(`${'y'.repeat(63)} z`)).toBe('y'.repeat(63))
    expect(name('   ')).toBe('bob')
    expect(name('\u0000\n')).toBe('bob')
    expect(name('')).toBe('bob')
  })
  test('defaultOther is trexsatya for everyone but trexsatya', () => {
    expect(defaultOther(null).login).toBe('trexsatya')
    expect(defaultOther('alice').login).toBe('trexsatya')
    expect(defaultOther('trexsatya')).toBeNull()
  })
})

describe('sources', () => {
  test('guest: no self, other is the owner', () => {
    expect(sources(loadAccount(GUEST_REC()))).toEqual({
      self: null, other: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' } })
  })
  test('no record (legacy owner): self is the owner repo, other none', () => {
    expect(sources(loadAccount(memStorage()))).toEqual({
      self: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }, other: null })
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
  test('the owner (with or without a record) keeps the plain key; other logins get a suffix', () => {
    expect(scopedKey('cupitor:recordings', loadAccount(memStorage()))).toBe('cupitor:recordings')
    expect(scopedKey('cupitor:recordings', { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null })).toBe('cupitor:recordings')
    expect(scopedKey('cupitor:recordings', loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }) })))).toBe('cupitor:recordings')
    expect(scopedKey('cupitor:recordings', { login: 'alice', repo: null, branch: null, other: null })).toBe('cupitor:recordings@alice')
  })
  test('a guest has its own keys, never the plain (owner) ones nor any login\'s', () => {
    expect(storageOwner(loadAccount(GUEST_REC()))).toBe(GUEST_STORAGE_OWNER)
    expect(scopedKey('cupitor:recordings', loadAccount(GUEST_REC()))).toBe('cupitor:recordings@~guest')
    // A record whose login is not valid reads as a guest.
    expect(scopedKey('k', loadAccount(memStorage({ [ACCOUNT_KEY]: JSON.stringify({ login: 'not valid!' }) })))).toBe('k@~guest')
    // A GitHub user literally called "guest" is not the guest.
    expect(scopedKey('k', { login: 'guest', repo: null, branch: null, other: null })).toBe('k@guest')
    // The legacy owner (no record) is not a guest.
    expect(loadAccount(memStorage()).legacy).toBe(true)
    expect(storageOwner(loadAccount(memStorage()))).toBe('trexsatya')
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
      expect(loadAccount()).toEqual(LEGACY)
      expect(saveGuest()).toBe(false)
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

describe('missingRepo (a recorded data repo that cannot be found)', () => {
  const rec = v => memStorage({ [ACCOUNT_KEY]: JSON.stringify(v) })
  test('kept across save and load; the user has no self, so writes are blocked', () => {
    const s = memStorage()
    const state = { login: 'alice', repo: null, branch: null, other: null, missingRepo: { repo: 'my-data', branch: 'dev' } }
    expect(saveAccount(state, s)).toBe(true)
    expect(loadAccount(s)).toEqual(state)
    expect(sources(loadAccount(s)).self).toBeNull()
  })
  test('absent unless set: no key on ordinary states', () => {
    expect('missingRepo' in loadAccount(rec({ login: 'alice', repo: 'cupitor-data', branch: 'main' }))).toBe(false)
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null }, s)
    expect('missingRepo' in JSON.parse(s.getItem(ACCOUNT_KEY))).toBe(false)
  })
  test('dropped when the user has a repo, is a guest or the owner, or the value is not a usable repo/branch', () => {
    const m = { repo: 'my-data', branch: 'main' }
    expect(loadAccount(rec({ login: 'alice', repo: 'cupitor-data', branch: 'main', missingRepo: m })).missingRepo).toBeUndefined()
    expect(loadAccount(rec({ login: null, repo: null, branch: null, missingRepo: m })).missingRepo).toBeUndefined()
    expect(loadAccount(rec({ login: 'trexsatya', repo: null, branch: null, missingRepo: m })).missingRepo).toBeUndefined()
    for (const bad of [null, 'my-data', [], { repo: '../x', branch: 'main' }, { repo: 'my-data', branch: 'a..b' }, { repo: 'my-data' }]) {
      expect(loadAccount(rec({ login: 'alice', repo: null, branch: null, missingRepo: bad })).missingRepo).toBeUndefined()
    }
    const s = memStorage()
    saveAccount({ login: 'alice', repo: 'cupitor-data', branch: 'main', other: null, missingRepo: m }, s)
    expect('missingRepo' in JSON.parse(s.getItem(ACCOUNT_KEY))).toBe(false)
  })
})
