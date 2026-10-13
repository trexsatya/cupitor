import {
  configure, readUrl, writeTarget, hasSelf, hasOther, source, langFromLocation, NoSelfRepoError,
} from './data-source.js'
import { saveGuest } from './account-state.js'

const guest = { login: null, repo: null, branch: null, other: { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' } }
const alice = { login: 'alice', repo: 'cupitor-data', branch: 'main', other: { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' } }
const aliceNoRepo = { login: 'alice', repo: null, branch: null, other: guest.other }
const owner = { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null }

describe('readUrl', () => {
  test('guest: primary and other point at the owner repo; self is absent', () => {
    configure(guest)
    expect(readUrl('primary', 'srts/index.json', 'swedish'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/index.json')
    expect(readUrl('other', '', 'spanish'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/spanish')
    expect(() => readUrl('self', 'x', 'swedish')).toThrow(/no self source/)
    expect(hasSelf()).toBe(false); expect(hasOther()).toBe(true)
  })
  test('signed in with a repo: self and primary are the own repo', () => {
    configure(alice)
    expect(readUrl('self', 'vocabulary.txt', 'swedish'))
      .toBe('https://raw.githubusercontent.com/alice/cupitor-data/main/db/language/swedish/vocabulary.txt')
    expect(readUrl('primary', 'vocabulary.txt', 'swedish')).toBe(readUrl('self', 'vocabulary.txt', 'swedish'))
    expect(source('other')).toEqual({ owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
  })
  test('owner with no other: other is absent', () => {
    configure(owner)
    expect(hasOther()).toBe(false)
    expect(() => readUrl('other', 'x', 'swedish')).toThrow(/no other source/)
  })
  test('unknown source name throws', () => {
    configure(guest)
    expect(() => readUrl('them', 'x', 'swedish')).toThrow(/unknown source/)
  })
})

describe('writeTarget', () => {
  test('is the self repo', () => {
    configure(alice)
    expect(writeTarget()).toEqual({ owner: 'alice', repo: 'cupitor-data', branch: 'main' })
    configure(owner)
    expect(writeTarget()).toEqual({ owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
  })
  test('throws NoSelfRepoError for a guest and for a user without a repo', () => {
    configure(guest)
    expect(() => writeTarget()).toThrow(NoSelfRepoError)
    expect(() => writeTarget()).toThrow('Set up your repo to save changes')
    configure(aliceNoRepo)
    expect(() => writeTarget()).toThrow(NoSelfRepoError)
  })
})

describe('langFromLocation', () => {
  test('reads ?lang=, defaults to swedish', () => {
    expect(langFromLocation({ href: 'https://x/language.html?lang=spanish' })).toBe('spanish')
    expect(langFromLocation({ href: 'https://x/language.html' })).toBe('swedish')
    expect(langFromLocation(null)).toBe('swedish')
  })
  test('lowercases, accepts hyphenated names, rejects anything else', () => {
    const at = (q) => langFromLocation({ href: `https://x/language.html?lang=${q}` })
    expect(at('Swedish')).toBe('swedish')
    expect(at('sv-se')).toBe('sv-se')
    expect(at('')).toBe('swedish')
    expect(at('../x')).toBe('swedish')
    expect(at('%2E%2E%2Fx')).toBe('swedish')
    expect(at('-x')).toBe('swedish')
  })
})

describe('readUrl lang check', () => {
  test('throws for a lang that is not a plain language name', () => {
    configure(guest)
    expect(() => readUrl('primary', 'x', '../x')).toThrow(/invalid lang/)
    expect(() => readUrl('primary', 'x', '')).toThrow(/invalid lang/)
    expect(() => readUrl('primary', 'x', 'Swedish')).toThrow(/invalid lang/)
    expect(readUrl('primary', 'x', 'sv-se'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/sv-se/x')
  })
})

const OWNER_BASE = 'https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish'

describe('readUrl path encoding', () => {
  // `path` is raw (not pre-encoded); readUrl encodes each segment, the same
  // way language.js callers encode the filename they append to the base.
  test.each([
    ['space', 'srts/My Film.sv.srt', 'srts/My%20Film.sv.srt'],
    ['||', 'srts/a||b.sv.srt', 'srts/a%7C%7Cb.sv.srt'],
    ['#', 'srts/Part #2.sv.srt', 'srts/Part%20%232.sv.srt'],
    ['%', 'srts/100% sure.sv.srt', 'srts/100%25%20sure.sv.srt'],
    ['Arabic', 'srts/مرحبا.ar.srt', `srts/${encodeURIComponent('مرحبا')}.ar.srt`],
  ])('%s', (_label, path, encoded) => {
    configure(guest)
    const url = readUrl('primary', path, 'swedish')
    expect(url).toBe(`${OWNER_BASE}/${encoded}`)
    const name = path.split('/')[1]
    expect(url).toBe(`${OWNER_BASE}/srts/${encodeURIComponent(name)}`)
    expect(decodeURIComponent(url.slice(OWNER_BASE.length + 1))).toBe(path)
  })
  test('the empty path is the base, as getResourceUrl() is today', () => {
    configure(guest)
    expect(readUrl('primary', '', 'swedish')).toBe(OWNER_BASE)
  })
  test('rejects . and .. segments', () => {
    configure(guest)
    for (const p of ['..', '.', '../x', 'srts/../x', 'srts/./x', 'srts/..']) {
      expect(() => readUrl('primary', p, 'swedish')).toThrow(/invalid path/)
    }
    expect(readUrl('primary', 'srts/..x.srt', 'swedish')).toBe(`${OWNER_BASE}/srts/..x.srt`)
  })
})

describe('sources by account', () => {
  test('owner: primary and self are the owner repo', () => {
    configure(owner)
    expect(readUrl('primary', 'vocabulary.txt', 'swedish')).toBe(`${OWNER_BASE}/vocabulary.txt`)
    expect(readUrl('self', 'vocabulary.txt', 'swedish')).toBe(`${OWNER_BASE}/vocabulary.txt`)
  })
  test('user without a repo: primary is the owner repo, self is absent', () => {
    configure(aliceNoRepo)
    expect(readUrl('primary', 'vocabulary.txt', 'swedish')).toBe(`${OWNER_BASE}/vocabulary.txt`)
    expect(() => readUrl('self', 'x', 'swedish')).toThrow(/no self source/)
    expect(() => writeTarget()).toThrow(NoSelfRepoError)
    expect(hasSelf()).toBe(false)
  })
  test('guest: writeTarget throws', () => {
    configure(guest)
    expect(() => writeTarget()).toThrow(NoSelfRepoError)
  })
  test('other equal to self is no other', () => {
    configure({ ...owner, other: { login: 'TrexSatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' } })
    expect(hasOther()).toBe(false)
    expect(() => readUrl('other', 'x', 'swedish')).toThrow(/no other source/)
  })
})

describe('state read from localStorage (configure(null))', () => {
  afterEach(() => { localStorage.clear(); configure(null) })
  test('no account record (legacy owner): writeTarget is the owner repo', () => {
    localStorage.clear()
    configure(null)
    expect(writeTarget()).toEqual({ owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
    expect(hasOther()).toBe(false)
  })
  test('explicit guest record: writeTarget throws, other is the owner', () => {
    saveGuest(localStorage)
    configure(null)
    expect(() => writeTarget()).toThrow(NoSelfRepoError)
    expect(readUrl('primary', 'vocabulary.txt', 'swedish')).toBe(`${OWNER_BASE}/vocabulary.txt`)
  })
})

describe('configure', () => {
  test('keeps a copy, so later changes to the given object do not leak in', () => {
    const s = { ...alice }
    configure(s)
    s.login = 'mallory'; s.repo = 'evil'
    expect(writeTarget()).toEqual({ owner: 'alice', repo: 'cupitor-data', branch: 'main' })
  })
})
