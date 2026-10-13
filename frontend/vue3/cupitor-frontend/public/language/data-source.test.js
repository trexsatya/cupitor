import {
  configure, readUrl, writeTarget, hasSelf, hasOther, source, langFromLocation, NoSelfRepoError,
} from './data-source.js'

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
