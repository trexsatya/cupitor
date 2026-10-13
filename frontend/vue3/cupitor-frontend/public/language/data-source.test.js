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

import {
  readLayers, layerStats, mergeIndexLayers, parseCategorisation, mergeCategorisationLayers,
  otherListProblem, mergeVocabularyLayers, withoutReadOnlyLines, mergeRecordingLayers,
} from './data-source.js'

const res = (status, text) => ({ ok: status < 400, status, text: async () => text })

describe('readLayers', () => {
  test('self then other, 404 is an empty layer (null text), stats count other', async () => {
    configure(alice)
    const calls = []
    const fetchFn = async (url) => {
      calls.push(url)
      return url.includes('/alice/') ? res(200, 'mine') : res(404, '')
    }
    const out = await readLayers('vocabulary.txt', { lang: 'swedish', fetchFn })
    expect(out).toEqual([
      { src: 'self', owner: 'alice', text: 'mine' },
      { src: 'other', owner: 'trexsatya', text: null },
    ])
    expect(calls[0]).toContain('/alice/cupitor-data/main/db/language/swedish/vocabulary.txt')
    expect(calls[1]).toContain('/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/vocabulary.txt')
    expect(calls).toHaveLength(2) // a missing file costs one request, no retries
    expect(layerStats().other).toEqual({ hits: 0, misses: 1, errors: 0 })
  })
  test('an other-layer failure is skipped with a notice; a self failure throws', async () => {
    configure(alice)
    const notices = []
    const failing = async (url) => (url.includes('/alice/') ? res(200, 'x') : res(500, ''))
    const out = await readLayers('srts/index.json', { lang: 'swedish', fetchFn: failing, retry: { tries: 1 }, onNotice: n => notices.push(n) })
    expect(out).toEqual([{ src: 'self', owner: 'alice', text: 'x' }])
    expect(notices).toHaveLength(1)
    expect(layerStats().other.errors).toBe(1)
    const selfFails = async () => res(500, '')
    await expect(readLayers('srts/index.json', { lang: 'swedish', fetchFn: selfFails, retry: { tries: 1 } })).rejects.toThrow(/HTTP 500/)
  })
  test('guest: only the other layer', async () => {
    configure(guest)
    const out = await readLayers('recordings.json', { lang: 'swedish', fetchFn: async () => res(200, '{}') })
    expect(out).toEqual([{ src: 'other', owner: 'trexsatya', text: '{}' }])
    expect(layerStats().other.hits).toBe(1)
  })
  test('builds URLs like readUrl: per-segment encoding, . and .. refused, lang checked', async () => {
    configure(alice)
    const calls = []
    const fetchFn = async (url) => { calls.push(url); return res(200, '') }
    await readLayers('srts/Part #2.sv.srt', { lang: 'swedish', fetchFn })
    expect(calls).toEqual([readUrl('self', 'srts/Part #2.sv.srt', 'swedish'), readUrl('other', 'srts/Part #2.sv.srt', 'swedish')])
    expect(calls[1]).toBe(`${OWNER_BASE}/srts/Part%20%232.sv.srt`)
    await expect(readLayers('srts/../x', { lang: 'swedish', fetchFn })).rejects.toThrow(/invalid path/)
    await expect(readLayers('x', { lang: '../x', fetchFn })).rejects.toThrow(/invalid lang/)
    expect(calls).toHaveLength(2)
  })
  test('owner with no other: only the self layer', async () => {
    configure(owner)
    const out = await readLayers('vocabulary.txt', { lang: 'swedish', fetchFn: async () => res(404, '') })
    expect(out).toEqual([{ src: 'self', owner: 'trexsatya', text: null }])
    expect(layerStats().other).toEqual({ hits: 0, misses: 0, errors: 0 })
  })
  test('otherRetry applies to the other layer only; self keeps retry', async () => {
    configure(alice)
    const calls = []
    const fetchFn = async (url) => { calls.push(url); return res(500, '') }
    const notices = []
    // self: 2 tries then throws — other is never reached
    await expect(readLayers('srts/index.json', { lang: 'swedish', fetchFn, retry: { tries: 2, timeoutMs: 50 }, otherRetry: { tries: 1 } }))
      .rejects.toThrow(/HTTP 500/)
    expect(calls.filter(u => u.includes('/alice/'))).toHaveLength(2)
    calls.length = 0
    const otherFails = async (url) => { calls.push(url); return url.includes('/alice/') ? res(200, '[]') : res(500, '') }
    const out = await readLayers('srts/index.json', { lang: 'swedish', fetchFn: otherFails, retry: { tries: 3 }, otherRetry: { tries: 1 }, onNotice: n => notices.push(n) })
    expect(out).toEqual([{ src: 'self', owner: 'alice', text: '[]' }])
    expect(calls.filter(u => u.includes('/trexsatya/'))).toHaveLength(1)
    expect(notices).toHaveLength(1)
  })
})

describe('otherListProblem', () => {
  test('no other layer, or a valid / empty list: no problem', () => {
    expect(otherListProblem([{ src: 'self', owner: 'a', text: null }], 'srts/index.json')).toBe(null)
    expect(otherListProblem([{ src: 'other', owner: 'b', text: '[]' }], 'srts/index.json')).toBe(null)
    expect(otherListProblem([{ src: 'other', owner: 'b', text: '' }], 'srts/index.json')).toBe(null)
    expect(otherListProblem([], 'srts/index.json')).toBe(null)
  })
  test('missing file (404) or not a list: a message naming the owner', () => {
    expect(otherListProblem([{ src: 'other', owner: 'bob', text: null }], 'srts/index.json')).toMatch(/bob.*srts\/index\.json|srts\/index\.json.*bob/)
    expect(otherListProblem([{ src: 'other', owner: 'bob', text: '{' }], 'srts/index.json')).toMatch(/bob/)
    expect(otherListProblem([{ src: 'other', owner: 'bob', text: '{}' }], 'srts/index.json')).toMatch(/bob/)
  })
})

describe('mergeIndexLayers', () => {
  test('self wins by link; other entries are tagged read-only', () => {
    const merged = mergeIndexLayers([
      { src: 'self', owner: 'alice', text: JSON.stringify([{ link: 'a', name: 'A mine', source: 'yt' }]) },
      { src: 'other', owner: 'trexsatya', text: JSON.stringify([{ link: 'a', name: 'A theirs' }, { link: 'b', name: 'B' }]) },
    ])
    expect(merged).toEqual([
      { link: 'a', name: 'A mine', source: 'yt', src: 'self', owner: 'alice', readOnly: false },
      { link: 'b', name: 'B', src: 'other', owner: 'trexsatya', readOnly: true },
    ])
  })
  test('repeated links inside one layer are all kept (the duplicate cleanup needs them); only other is deduped against self', () => {
    const merged = mergeIndexLayers([
      { src: 'self', owner: 'alice', text: JSON.stringify([{ link: 'a', name: 'A1' }, { link: 'a', name: 'A2' }]) },
      { src: 'other', owner: 'bob', text: JSON.stringify([{ link: 'a', name: 'A3' }, { link: 'c', name: 'C' }]) },
    ])
    expect(merged.map(e => e.name)).toEqual(['A1', 'A2', 'C'])
  })
  test('null text is an empty list; invalid self JSON throws; invalid other JSON is skipped', () => {
    expect(mergeIndexLayers([{ src: 'self', owner: 'a', text: null }])).toEqual([])
    expect(() => mergeIndexLayers([{ src: 'self', owner: 'a', text: '{' }])).toThrow(/index.json/)
    expect(mergeIndexLayers([{ src: 'self', owner: 'a', text: '[]' }, { src: 'other', owner: 'b', text: '{' }])).toEqual([])
  })
})

describe('categorisation', () => {
  test('parseCategorisation maps the file name to its category', () => {
    expect(parseCategorisation('Kids || x || y || file1\nfile2')).toEqual({ file1: 'Kids', file2: '        ' })
    expect(parseCategorisation(null)).toEqual({})
  })
  test('a 3-part line (channel || title || link) has no category, as in the real file', () => {
    expect(parseCategorisation('Chan || Title || L1\r\n')).toEqual({ L1: '        ' })
  })
  test('mergeCategorisationLayers: self wins', () => {
    expect(mergeCategorisationLayers([
      { src: 'self', text: 'A || x || y || f1' },
      { src: 'other', text: 'B || x || y || f1\nC || x || y || f2' },
    ])).toEqual({ f1: 'A', f2: 'C' })
  })
})

describe('vocabulary layers', () => {
  const selfText = '#Verbs\n(eat)|äta|\n#Nouns\n(cat)|katt|'
  const otherText = '#Verbs\n(eat)|äta|\n(run)|springa|\n#Adjectives\n(big)|stor|'
  test('other-only lines are appended and listed as read-only; shared lines are self', () => {
    const { vocab, readOnly } = mergeVocabularyLayers(selfText, otherText)
    expect(vocab.Verbs).toEqual(['(eat)|äta|', '(run)|springa|'])
    expect(vocab.Nouns).toEqual(['(cat)|katt|'])
    expect(vocab.Adjectives).toEqual(['(big)|stor|'])
    expect([...readOnly]).toEqual(['(run)|springa|', '(big)|stor|'])
  })
  test('no other text → self as is', () => {
    const { vocab, readOnly } = mergeVocabularyLayers(selfText, null)
    expect(vocab.Verbs).toEqual(['(eat)|äta|']); expect(readOnly.size).toBe(0)
  })
  test('withoutReadOnlyLines drops them and empty categories that came only from other', () => {
    const { vocab, readOnly } = mergeVocabularyLayers(selfText, otherText)
    expect(withoutReadOnlyLines(vocab, readOnly)).toEqual({ Verbs: ['(eat)|äta|'], Nouns: ['(cat)|katt|'] })
  })
  test('a self category that was empty stays when other fills it', () => {
    const merged = mergeVocabularyLayers('#Verbs\n#Nouns\n(cat)|katt|', '#Verbs\n(run)|springa|')
    expect(merged.vocab.Verbs).toEqual(['(run)|springa|'])
    expect(withoutReadOnlyLines(merged.vocab, merged.readOnly, merged.otherCategories))
      .toEqual({ Verbs: [], Nouns: ['(cat)|katt|'] })
  })
  test('a line the user adds to an other-only category keeps that category', () => {
    const merged = mergeVocabularyLayers(selfText, otherText)
    merged.vocab.Adjectives.push('(small)|liten|')
    expect(withoutReadOnlyLines(merged.vocab, merged.readOnly, merged.otherCategories).Adjectives)
      .toEqual(['(small)|liten|'])
  })
  test('prototype-named categories in either file merge as ordinary categories', () => {
    const self = '#toString\n(a)|a|\n#__proto__\n(p)|p|'
    const other = '#toString\n(b)|b|\n#constructor\n(c)|c|\n#__proto__\n(q)|q|\n#valueOf\n(v)|v|'
    const { vocab, readOnly, otherCategories } = mergeVocabularyLayers(self, other)
    expect(vocab.toString).toEqual(['(a)|a|', '(b)|b|'])
    expect(vocab.constructor).toEqual(['(c)|c|'])
    expect(vocab['__proto__']).toEqual(['(p)|p|', '(q)|q|'])
    expect(vocab.valueOf).toEqual(['(v)|v|'])
    expect([...otherCategories]).toEqual(['constructor', 'valueOf'])
    const editable = withoutReadOnlyLines(vocab, readOnly, otherCategories)
    expect(Object.keys(editable)).toEqual(['toString', '__proto__'])
    expect(editable.toString).toEqual(['(a)|a|'])
    expect(editable['__proto__']).toEqual(['(p)|p|'])
    // without otherCategories (guessing mode) the same result
    expect(Object.keys(withoutReadOnlyLines(vocab, readOnly))).toEqual(['toString', '__proto__'])
  })
  test('withoutReadOnlyLines takes a plain object with prototype-named keys', () => {
    const plain = JSON.parse('{"__proto__":["x"],"toString":["y"]}')
    expect(Object.keys(withoutReadOnlyLines(plain, new Set()))).toEqual(['__proto__', 'toString'])
  })
  test('known limitation: a self line with the same text as a read-only line is dropped on save', () => {
    const merged = mergeVocabularyLayers(selfText, otherText)
    merged.vocab.Nouns.push('(run)|springa|') // user adds a line other already has
    expect(withoutReadOnlyLines(merged.vocab, merged.readOnly, merged.otherCategories).Nouns)
      .toEqual(['(cat)|katt|'])
  })
  test('a line repeated in one other category is added once', () => {
    const { vocab } = mergeVocabularyLayers('#Verbs\n(eat)|äta|', '#Verbs\n(run)|springa|\n(run)|springa|')
    expect(vocab.Verbs).toEqual(['(eat)|äta|', '(run)|springa|'])
  })
  test('the result does not share arrays with a later parse', () => {
    const a = mergeVocabularyLayers(selfText, otherText)
    a.vocab.Verbs.push('x')
    expect(mergeVocabularyLayers(selfText, otherText).vocab.Verbs).not.toContain('x')
  })
})

describe('mergeRecordingLayers', () => {
  test('self wins by name; other collections are tagged read-only', () => {
    const out = mergeRecordingLayers(
      { Default: { items: { a: 1 } } },
      { Default: { items: { b: 2 } }, Theirs: { items: {} } })
    expect(out.Default).toEqual({ items: { a: 1 } })
    expect(out.Theirs).toEqual({ items: {}, readOnly: true, src: 'other' })
  })
  test('tolerates null sides', () => {
    expect(mergeRecordingLayers(null, null)).toEqual({})
    expect(mergeRecordingLayers(null, { X: { items: {} } }).X.readOnly).toBe(true)
  })
  test('self collections come first', () => {
    expect(Object.keys(mergeRecordingLayers({ Mine: {} }, { Theirs: {}, Mine: {} }))).toEqual(['Mine', 'Theirs'])
  })
  test('names like "constructor" are ordinary keys; arrays are not collections', () => {
    const out = mergeRecordingLayers({}, { constructor: { items: {} }, toString: { items: {} }, Bad: [1] })
    expect(out.constructor).toEqual({ items: {}, readOnly: true, src: 'other' })
    expect(Object.keys(out)).toEqual(['constructor', 'toString'])
    const proto = mergeRecordingLayers(JSON.parse('{"__proto__":{"items":{"a":1}}}'), JSON.parse('{"__proto__":{"items":{}},"X":{}}'))
    expect(Object.keys(proto)).toEqual(['__proto__', 'X'])
    expect(proto['__proto__']).toEqual({ items: { a: 1 } })
  })
  test('categorisation: links named like prototype keys are kept, self wins', () => {
    const out = mergeCategorisationLayers([
      { src: 'self', text: 'S || a || b || __proto__' },
      { src: 'other', text: 'K || a || b || constructor\nT || a || b || toString\nO || a || b || __proto__' },
    ])
    expect(Object.keys(out)).toEqual(['__proto__', 'constructor', 'toString'])
    expect(out['__proto__']).toBe('S')
    expect(out.constructor).toBe('K')
    expect(out.toString).toBe('T')
    const parsed = parseCategorisation('X || a || b || __proto__\ntoString')
    expect(parsed['__proto__']).toBe('X')
    expect(parsed.toString).toBe('        ')
  })
})
