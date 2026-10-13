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
  otherListProblem, cacheRecordMatches, mergeVocabularyLayers, withoutReadOnlyLines, mergeRecordingLayers,
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
  test('guest: other is the only source, so it keeps the full retry (otherRetry is ignored)', async () => {
    configure(guest)
    let n = 0
    const fetchFn = async () => (++n < 3 ? res(500, '') : res(200, '[]'))
    const out = await readLayers('srts/index.json', { lang: 'swedish', fetchFn, retry: { tries: 3 }, otherRetry: { tries: 1 } })
    expect(out).toEqual([{ src: 'other', owner: 'trexsatya', text: '[]' }])
    expect(n).toBe(3)
  })
})

describe('cacheRecordMatches', () => {
  test('a cached record is used only when it came from the repo the index entry names', () => {
    expect(cacheRecordMatches({ owner: 'bob' }, { owner: 'bob' }, 'alice')).toBe(true)
    expect(cacheRecordMatches({ owner: 'bob' }, { owner: 'carol' }, 'alice')).toBe(false)
    expect(cacheRecordMatches({ owner: 'Bob' }, { owner: 'bob' }, 'alice')).toBe(true)
  })
  test('a record or entry without an owner belongs to the primary owner (records cached before owners were stored)', () => {
    expect(cacheRecordMatches({}, { owner: 'trexsatya' }, 'trexsatya')).toBe(true)
    expect(cacheRecordMatches({}, { owner: 'bob' }, 'alice')).toBe(false)
    expect(cacheRecordMatches({ owner: 'alice' }, {}, 'alice')).toBe(true)
    expect(cacheRecordMatches({}, null, 'alice')).toBe(true)
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

import { vocabularyFromLayers, relayerVocabulary, pendingVocabCategories } from './data-source.js'
import { parseVocabularyFile, vocabularyToText, mergeVocabulary } from './vocab-merge.js'

describe('vocabulary from layers (load, buffer, save)', () => {
  const selfText = 'stray\n#Verbs\n(eat)|äta|\n\n#Empty\n#Nouns\n(cat)|katt|'
  const otherText = '#Verbs\n(eat)|äta|\n(run)|springa|\n#Adjectives\n(big)|stor|'
  const remoteText = selfText + '\n(dog)|hund|'
  const otherOnly = ['(run)|springa|', '(big)|stor|']
  // What commitVocabularyToGithub sends: own lines only, merged against self's remote.
  const commitText = (v) => vocabularyToText(mergeVocabulary(v.baselineText,
    withoutReadOnlyLines(v.vocab, v.readOnly, v.otherCategories), remoteText))
  const both = () => vocabularyFromLayers([
    { src: 'self', owner: 'a', text: selfText }, { src: 'other', owner: 'o', text: otherText }])

  test('owner with no other: same map and baseline as parsing the file', () => {
    const v = vocabularyFromLayers([{ src: 'self', owner: 'o', text: selfText }])
    expect(v.vocab).toEqual(parseVocabularyFile(selfText))
    expect(v.baselineText).toBe(selfText)
    expect(v.readOnly.size).toBe(0)
    expect(v.otherCategories.size).toBe(0)
    expect(v.otherText).toBe(null)
  })
  test('owner with no other: saved bytes are the same as before layering', () => {
    const v = vocabularyFromLayers([{ src: 'self', owner: 'o', text: selfText }])
    v.vocab.Verbs.push('(new)|ny|'); v.vocab.Empty.push('(x)|x|')
    const before = parseVocabularyFile(selfText)
    before.Verbs.push('(new)|ny|'); before.Empty.push('(x)|x|')
    expect(commitText(v)).toBe(vocabularyToText(mergeVocabulary(selfText, before, remoteText)))
  })
  test('self missing (404) → empty self, empty baseline, other all read-only', () => {
    const v = vocabularyFromLayers([{ src: 'self', owner: 'a', text: null }, { src: 'other', owner: 'o', text: otherText }])
    expect(v.baselineText).toBe('')
    expect(v.vocab.Verbs).toEqual(['(eat)|äta|', '(run)|springa|'])
    expect(withoutReadOnlyLines(v.vocab, v.readOnly, v.otherCategories)).toEqual({})
  })
  test('with other: the save never contains the other user\'s lines', () => {
    const v = both()
    expect(v.vocab.Verbs).toContain('(run)|springa|')
    expect(v.otherText).toBe(otherText)
    v.vocab.Adjectives.push('(small)|liten|')
    v.vocab.Verbs.splice(1, 0, '(new)|ny|')
    const out = commitText(v)
    otherOnly.forEach(l => expect(out).not.toContain(l))
    expect(out).toContain('#Adjectives\n(small)|liten|')
    expect(out).toContain('(new)|ny|')
    expect(v.baselineText).toBe(selfText)
  })
  test('other layer that is missing (null text) is the same as no other', () => {
    const v = vocabularyFromLayers([{ src: 'self', owner: 'a', text: selfText }, { src: 'other', owner: 'o', text: null }])
    expect(v.vocab).toEqual(parseVocabularyFile(selfText))
    expect(v.otherText).toBe(null)
  })
  test('guest: every line is read-only, nothing is editable, baseline is empty', () => {
    const v = vocabularyFromLayers([{ src: 'other', owner: 'o', text: 'pre\n' + otherText }])
    expect(v.vocab).toEqual(parseVocabularyFile('pre\n' + otherText))
    expect(v.baselineText).toBe('')
    expect(withoutReadOnlyLines(v.vocab, v.readOnly, v.otherCategories)).toEqual({})
  })
  test('nothing at all → empty', () => {
    const v = vocabularyFromLayers([])
    expect(Object.keys(v.vocab)).toEqual([])
    expect(v.baselineText).toBe('')
  })
  test('pending buffer keeps only own lines of dirty categories', () => {
    const v = both()
    v.vocab.Verbs.push('(new)|ny|')
    v.vocab.Adjectives.push('(small)|liten|')
    const buf = pendingVocabCategories(v.vocab, ['Verbs', 'Adjectives', 'Missing'], v.readOnly, v.otherCategories)
    expect({ ...buf }).toEqual({ Verbs: ['(eat)|äta|', '', '(new)|ny|'], Adjectives: ['(small)|liten|'] })
    expect(JSON.stringify(buf)).not.toContain('springa')
    expect(JSON.stringify(buf)).not.toContain('stor')
  })
  test('pending buffer: an other-only category with no own line is left out', () => {
    const v = both()
    expect(Object.keys(pendingVocabCategories(v.vocab, ['Adjectives'], v.readOnly, v.otherCategories))).toEqual([])
  })
  test('pending buffer: a prototype-named category is an ordinary key', () => {
    const vocab = parseVocabularyFile('#__proto__\n(p)|p|')
    const buf = pendingVocabCategories(vocab, ['__proto__', 'toString'], new Set(), new Set())
    expect(Object.keys(buf)).toEqual(['__proto__'])
    expect(JSON.stringify(buf)).toBe('{"__proto__":["(p)|p|"]}')
  })
  test('replay then relayer: other lines show again, save still has none of them', () => {
    const v = both()
    // a replayed buffer replaces whole categories with own lines only
    v.vocab.Verbs = ['(eat)|äta|', '(new)|ny|']
    v.vocab.Adjectives = ['(small)|liten|']
    const r = relayerVocabulary(v.vocab, v.readOnly, v.otherCategories, v.otherText)
    expect(r.vocab.Verbs).toEqual(['(eat)|äta|', '(new)|ny|', '(run)|springa|'])
    expect(r.vocab.Adjectives).toEqual(['(small)|liten|', '(big)|stor|'])
    expect(r.otherCategories.has('Adjectives')).toBe(false)
    const out = vocabularyToText(mergeVocabulary(selfText, withoutReadOnlyLines(r.vocab, r.readOnly, r.otherCategories), remoteText))
    otherOnly.forEach(l => expect(out).not.toContain(l))
    expect(out).toContain('(small)|liten|')
  })
  test('relayer keeps an own empty category without inventing a blank line', () => {
    const v = both()
    const r = relayerVocabulary(v.vocab, v.readOnly, v.otherCategories, v.otherText)
    expect(r.vocab.Empty).toEqual([])
    expect(r.vocab).toEqual(v.vocab)
    expect([...r.readOnly]).toEqual([...v.readOnly])
  })
  test('relayer does not change the arrays it was given', () => {
    const v = both()
    const verbs = v.vocab.Verbs.slice()
    relayerVocabulary(v.vocab, v.readOnly, v.otherCategories, v.otherText).vocab.Verbs.push('z')
    expect(v.vocab.Verbs).toEqual(verbs)
  })
})

import { claimVocabularyLines } from './data-source.js'

describe('claimVocabularyLines (a user adds a line the other user also has)', () => {
  const selfText = '#Verbs\n(eat)|äta|\n#Nouns\n(cat)|katt|'
  const otherText = '#Verbs\n(eat)|äta|\n(run)|springa|\n#Adjectives\n(big)|stor|'
  const remoteText = selfText
  const commitText = (vocab, readOnly, otherCategories) => vocabularyToText(mergeVocabulary(selfText,
    withoutReadOnlyLines(vocab, readOnly, otherCategories), remoteText))

  test('no read-only line among the added ones: same objects back', () => {
    const m = mergeVocabularyLayers(selfText, otherText)
    const r = claimVocabularyLines(m.vocab, m.readOnly, m.otherCategories, ['(new)|ny|'])
    expect(r.vocab).toBe(m.vocab)
    expect(r.readOnly).toBe(m.readOnly)
  })
  test('the added line becomes own: other copy removed, not read-only, and it is saved', () => {
    const m = mergeVocabularyLayers(selfText, otherText)
    const r = claimVocabularyLines(m.vocab, m.readOnly, m.otherCategories, ['(run)|springa|'])
    expect(r.readOnly.has('(run)|springa|')).toBe(false)
    expect(r.readOnly.has('(big)|stor|')).toBe(true)
    expect(r.vocab.Verbs).toEqual(['(eat)|äta|'])
    r.vocab.Nouns.push('(run)|springa|')
    const out = commitText(r.vocab, r.readOnly, m.otherCategories)
    expect(out).toContain('#Nouns\n(cat)|katt|\n(run)|springa|')
    expect(out.match(/springa/g)).toHaveLength(1)
    expect(out).not.toContain('stor')
  })
  test('an other-only category left empty is dropped from the map', () => {
    const m = mergeVocabularyLayers(selfText, otherText)
    const r = claimVocabularyLines(m.vocab, m.readOnly, m.otherCategories, ['(big)|stor|'])
    expect(Object.keys(r.vocab)).toEqual(Object.keys(m.vocab).filter(k => k !== 'Adjectives'))
    expect(Object.keys(r.vocab)).not.toContain('Adjectives')
    // adding it back into that same category keeps the category (own line)
    r.vocab.Adjectives = ['(big)|stor|']
    expect(commitText(r.vocab, r.readOnly, m.otherCategories)).toContain('#Adjectives\n(big)|stor|')
  })
  test('claimed, buffered, reloaded: claiming the buffer again keeps the line through relayer', () => {
    // add + buffer
    const m = mergeVocabularyLayers(selfText, otherText)
    const r = claimVocabularyLines(m.vocab, m.readOnly, m.otherCategories, ['(run)|springa|'])
    r.vocab.Nouns.push('(run)|springa|')
    const buf = pendingVocabCategories(r.vocab, ['Nouns'], r.readOnly, m.otherCategories)
    expect(buf.Nouns).toContain('(run)|springa|')
    // reload: self file unchanged, so the line is read-only again
    const fresh = mergeVocabularyLayers(selfText, otherText)
    expect(fresh.readOnly.has('(run)|springa|')).toBe(true)
    // replay as _replayPendingVocab does: claim buffered lines, put categories back, relayer
    const bufLines = Object.values(buf).flat()
    const c = claimVocabularyLines(fresh.vocab, fresh.readOnly, fresh.otherCategories, bufLines)
    c.vocab.Nouns = buf.Nouns
    const out = relayerVocabulary(c.vocab, c.readOnly, fresh.otherCategories, otherText)
    expect(out.vocab.Nouns).toContain('(run)|springa|')
    expect(out.vocab.Verbs).not.toContain('(run)|springa|')
    expect(out.readOnly.has('(run)|springa|')).toBe(false)
    const saved = commitText(out.vocab, out.readOnly, out.otherCategories)
    expect(saved.match(/springa/g)).toHaveLength(1)
    // without the claim the line would be lost
    fresh.vocab.Nouns = buf.Nouns
    expect(relayerVocabulary(fresh.vocab, fresh.readOnly, fresh.otherCategories, otherText).vocab.Nouns)
      .not.toContain('(run)|springa|')
  })
  test('the inputs are not changed', () => {
    const m = mergeVocabularyLayers(selfText, otherText)
    const verbs = m.vocab.Verbs.slice()
    const ro = [...m.readOnly]
    claimVocabularyLines(m.vocab, m.readOnly, m.otherCategories, ['(run)|springa|'])
    expect(m.vocab.Verbs).toEqual(verbs)
    expect([...m.readOnly]).toEqual(ro)
  })
  test('prototype-named categories stay ordinary keys', () => {
    const m = mergeVocabularyLayers('#__proto__\n(p)|p|', '#__proto__\n(q)|q|\n#toString\n(t)|t|')
    const r = claimVocabularyLines(m.vocab, m.readOnly, m.otherCategories, ['(q)|q|'])
    expect(Object.keys(r.vocab)).toEqual(Object.keys(m.vocab))
    expect(Object.keys(r.vocab)).toContain('__proto__')
    expect(r.vocab['__proto__']).toEqual(['(p)|p|'])
  })
})

describe('source names are checked before they go into URLs', () => {
  const { currentSources, sourceProblems } = require('./data-source.js')
  const otherWith = o => ({ ...alice, other: { login: 'bob', name: 'Bob', repo: 'cupitor-data', branch: 'main', ...o } })

  test('the owner, a user and the default other all pass unchanged', () => {
    configure(owner)
    expect(currentSources()).toEqual({ self: { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }, other: null })
    expect(sourceProblems()).toEqual([])
    configure(alice)
    expect(currentSources().self).toEqual({ owner: 'alice', repo: 'cupitor-data', branch: 'main' })
    expect(currentSources().other).toEqual({ owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' })
  })

  test.each([
    ['branch with a slash', { branch: 'a/b' }],
    ['branch with ? and #', { branch: 'x?y#z' }],
    ['branch ..', { branch: '..' }],
    ['repo with a space', { repo: 'my repo' }],
    ['login with a slash', { login: 'bob/../x' }],
  ])('an invalid other (%s) is no other layer, with a notice', async (_, o) => {
    configure(otherWith(o))
    expect(currentSources().other).toBeNull()
    expect(hasOther()).toBe(false)
    expect(() => readUrl('other', 'x', 'swedish')).toThrow(/no other source/)
    expect(sourceProblems()).toHaveLength(1)
    const calls = []; const notices = []
    const fetchFn = async (url) => { calls.push(url); return res(200, '[]') }
    const out = await readLayers('srts/index.json', { lang: 'swedish', fetchFn, onNotice: n => notices.push(n) })
    expect(out.map(l => l.src)).toEqual(['self'])
    expect(calls.every(u => u.includes('/alice/cupitor-data/main/'))).toBe(true)
    expect(notices).toEqual([expect.stringMatching(/other user's library could not be loaded/)])
    // Once per configure.
    await readLayers('vocabulary.txt', { lang: 'swedish', fetchFn, onNotice: n => notices.push(n) })
    expect(notices).toHaveLength(1)
  })

  test('an invalid self is no self: no writes, nothing read from it', () => {
    configure({ ...alice, branch: 'feature/x' })
    expect(hasSelf()).toBe(false)
    expect(() => writeTarget()).toThrow(NoSelfRepoError)
    expect(readUrl('primary', 'x', 'swedish')).toContain('/trexsatya/trexsatya.github.io/gh-pages/')
    expect(sourceProblems()).toEqual([expect.stringMatching(/Your data repo name/)])
  })
})

describe('fetchSelfJson (own files only)', () => {
  const { fetchSelfJson } = require('./data-source.js')
  const jres = (status, body) => ({ ok: status < 400, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) })

  test('the owner reads the same URL as before, from the own repo', async () => {
    configure(owner)
    const calls = []
    const fetchFn = async (...args) => { calls.push(args); return jres(200, [{ link: 'a' }]) }
    expect(await fetchSelfJson('srts/srt_favorites.json', { lang: 'swedish', fetchFn, fallback: [] })).toEqual([{ link: 'a' }])
    expect(calls).toEqual([['https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/srt_favorites.json']])
    calls.length = 0
    await fetchSelfJson('practice-log.json', { lang: 'swedish', fetchFn, query: '?_=5', init: { cache: 'no-cache' } })
    expect(calls).toEqual([['https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/practice-log.json?_=5', { cache: 'no-cache' }]])
  })

  test('a user reads their own repo, never the other user\'s', async () => {
    configure(alice)
    const calls = []
    await fetchSelfJson('practice-log.json', { lang: 'swedish', fetchFn: async (u) => { calls.push(u); return jres(200, {}) } })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/alice/cupitor-data/main/')
  })

  test('no self (guest, or a user without a repo): fallback and no request', async () => {
    for (const st of [guest, aliceNoRepo]) {
      configure(st)
      const fetchFn = jest.fn()
      expect(await fetchSelfJson('srts/srt_favorites.json', { lang: 'swedish', fetchFn, fallback: [] })).toEqual([])
      expect(fetchFn).not.toHaveBeenCalled()
    }
  })

  test('404 (a fresh data repo) is the fallback, silently; other failures are logged, never thrown', async () => {
    configure(alice)
    const log = jest.fn()
    expect(await fetchSelfJson('f.json', { lang: 'swedish', fetchFn: async () => jres(404, ''), fallback: [], log })).toEqual([])
    expect(log).not.toHaveBeenCalled()
    expect(await fetchSelfJson('f.json', { lang: 'swedish', fetchFn: async () => jres(500, ''), fallback: [], log })).toEqual([])
    expect(await fetchSelfJson('f.json', { lang: 'swedish', fetchFn: async () => { throw new TypeError('Failed to fetch') }, fallback: [], log })).toEqual([])
    expect(await fetchSelfJson('f.json', { lang: 'swedish', fetchFn: async () => jres(200, 'not json{'), fallback: [], log })).toEqual([])
    expect(log).toHaveBeenCalledTimes(3)
  })
})
