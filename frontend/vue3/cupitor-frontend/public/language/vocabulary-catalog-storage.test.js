import { TextEncoder } from 'util'
import { webcrypto } from 'crypto'
import { parseVocabularyFile, vocabularyToText } from './vocab-merge.js'
import { createVocabularyMatcher } from './vocabulary-matcher.js'
import { createVocabularyHintIndex, parseVocabularyCatalog, mergeVocabularyCatalogs, VOCABULARY_CATALOG_PATH } from './vocabulary-hints.js'
import { vocabularyCommitFiles } from './vocabulary-save.js'
import { catalogJSON, packVocabularyCatalog, packVocabularyStream, readVocabularyStream,
  createVocabularyCatalogReader, VOCABULARY_STORAGE_INDEX, VOCABULARY_STORAGE_PATH, VOCABULARY_CHUNK_BYTES } from './vocabulary-catalog-storage.js'

beforeAll(() => { global.TextEncoder = TextEncoder; Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true }) })
const line = '(wake early)|uppe med tuppen|'
const vocabText = '#Everyday Life\n' + line + '\t[entry:entry-one]'
const vocab = () => parseVocabularyFile(vocabText)
const source = () => ({ version: 1, meanings: { truth: { label: 'Truth', hints: { hi: ['सत्य'], th: ['ความจริง'] }, examples: { sv: 'Sanning', hi: 'सत्य' } } },
  groups: { 'entry-one': { language: 'sv', category: 'Everyday Life', line, entryId: 'entry-one', forms: [], hintOverrides: { hi: ['जल्दी उठना'], th: ['ตื่นแต่เช้า'] } },
    spanish: { language: 'es', category: 'Things', line: '(truth)|verdad|', forms: [], meanings: ['truth'], hintOverrides: { hi: ['सत्य'], th: ['ความจริง'] } } },
  sharedHints: { hi: { early: ['जल्दी'] }, th: { early: ['แต่เช้า'] } }, attribution: { source: 'Retain this' } })
const lookup = (data, language, vocabulary = vocab()) => createVocabularyHintIndex(createVocabularyMatcher(vocabulary).rows, 'sv', data, language)
async function fixture(data = source(), language = 'hi', vocabulary = vocab()) {
  const packed = await packVocabularyCatalog(data)
  const read = jest.fn(async path => packed.files.get(path) ?? null)
  const reader = createVocabularyCatalogReader({ read, target: 'sv', vocabulary: () => vocabulary })
  await reader.loadLanguage(language)
  return { ...packed, read, reader, catalog: await reader.catalog(), snapshot: reader.snapshot() }
}
async function save(base, { patch = {}, files = new Map(base.files), local = vocab(), baselineText = vocabText, catalog = base.catalog } = {}) {
  const commit = vocabularyCommitFiles({ path: 'vocabulary.txt', baselineText, local, language: 'sv', catalog,
    catalogBaseline: catalog, storageSnapshot: base.snapshot, patch })
  const read = jest.fn(async path => path === 'vocabulary.txt' ? vocabText : files.get(path.replace('db/language/shared/', '')) ?? null)
  const plan = await commit.prepareFiles({ headSha: 'head', read })
  for (const file of plan) {
    const text = await file.getContent(null)
    if (file.path !== 'vocabulary.txt') files.set(file.path.replace('db/language/shared/', ''), text)
  }
  return { ...commit.result(), plan, files, read }
}

test('bound groups store compact revisions instead of duplicate vocabulary snapshots or empty group records', async () => {
  const data = await fixture()
  const metadata = await readVocabularyStream(data.index, 'metadata/sv', data.read)
  expect(metadata.records['e/entry-one'].s).toMatch(/^[a-f0-9]{64}$/)
  expect(metadata.records['g/entry-one']).toBeUndefined()
  expect(JSON.stringify(metadata.records)).not.toContain(line)
  expect(JSON.stringify(metadata.records)).not.toContain('Everyday Life')
  expect(data.catalog.attribution).toEqual(source().attribution)
  expect(lookup(data.catalog, 'hi').hintsFor(line)).toEqual(['जल्दी उठना'])
})

test('startup reads only the current study language and loads a new hint language on demand', async () => {
  const data = await fixture()
  expect(data.read.mock.calls.some(([path]) => /hints\/sv\/th|metadata\/es|meaning-hints\/th|shared-hints\/th/.test(path))).toBe(false)
  expect(data.reader.languages).toEqual(expect.arrayContaining(['hi', 'th']))
  expect(data.catalog.meanings.truth.hints.th).toBeUndefined()
  await data.reader.loadLanguage('th')
  const changed = await data.reader.catalog()
  expect(lookup(changed, 'th').hintsFor(line)).toEqual(['ตื่นแต่เช้า'])
  expect(changed.meanings.truth.hints.th).toEqual(['ความจริง'])
  expect(changed.sharedHints.th.early).toEqual(['แต่เช้า'])
  expect(data.read.mock.calls.some(([path]) => path.includes('metadata/es'))).toBe(false)
})

test('all chunks including branch nodes stay bounded and round-trip Unicode records', async () => {
  const records = Object.fromEntries(Array.from({ length: 80 }, (_, index) => ['id-' + index, ['ภาษาไทย 中文 Українська '.repeat(3)]]))
  const packed = await packVocabularyStream('hints/sv/th', records, { maxBytes: 1024 })
  expect(packed.files.size).toBeGreaterThan(1)
  expect([...packed.files.values()].every(text => Buffer.byteLength(text) <= 1024)).toBe(true)
  const decoded = await readVocabularyStream({ streams: { 'hints/sv/th': packed.root } }, 'hints/sv/th', async path => packed.files.get(path))
  expect(decoded.records).toEqual(records)
  await expect(packVocabularyStream('hints/sv/th', { one: ['x'.repeat(VOCABULARY_CHUNK_BYTES)] })).rejects.toThrow(/size limit/)
})

test('corrupt or missing chunks never silently fall back to a stale catalog', async () => {
  const data = await fixture()
  await expect(readVocabularyStream(data.index, 'metadata/sv', async () => '{}')).rejects.toThrow(/Damaged/)
  await expect(readVocabularyStream(data.index, 'metadata/sv', async () => null)).rejects.toThrow(/Missing/)
})

test('one hint edit updates its language chunk and index without rewriting other languages or metadata', async () => {
  const base = await fixture()
  const group = base.catalog.groups['entry-one']
  const result = await save(base, { patch: { groups: { 'entry-one': { ...group, hintOverrides: { hi: ['जागना'] } } } } })
  const paths = result.plan.map(file => file.path)
  expect(paths.filter(path => path.includes('/hints/sv/hi/'))).toHaveLength(1)
  expect(paths.some(path => /hints\/sv\/th|metadata\/sv|vocabulary-meanings\.json/.test(path))).toBe(false)
  expect(result.storage.index.streams['hints/sv/th']).toBe(base.index.streams['hints/sv/th'])
  expect(result.catalog.groups['entry-one'].hintOverrides.hi).toEqual(['जागना'])
  expect(result.catalog.groups['entry-one'].hintOverrides.th).toBeUndefined()
  expect(paths).toContain(VOCABULARY_STORAGE_PATH)
})

test('adding a language preserves the active language roots and never reads the other hint payload', async () => {
  const base = await fixture()
  const group = base.catalog.groups['entry-one']
  const result = await save(base, { patch: { groups: { 'entry-one': { ...group, hintOverrides: { ...group.hintOverrides, fr: ['se lever tôt'] } } } } })
  expect(result.storage.index.streams['hints/sv/th']).toBe(base.index.streams['hints/sv/th'])
  expect(result.read.mock.calls.some(([path]) => path.includes('/hints/sv/th/'))).toBe(false)
  expect(result.plan.some(file => file.path.includes('/hints/sv/fr/'))).toBe(true)
})

test('concurrent edits to the same hint conflict and an unrelated language edit is retained', async () => {
  const base = await fixture()
  const other = source(); other.groups['entry-one'].hintOverrides.hi = ['Changed elsewhere']
  const live = await packVocabularyCatalog(other)
  await expect(save(base, { files: live.files, patch: { groups: { 'entry-one': { ...base.catalog.groups['entry-one'], hintOverrides: { hi: ['My edit'] } } } } })).rejects.toThrow(/changed/)
  const otherLanguage = source(); otherLanguage.groups['entry-one'].hintOverrides.th = ['แก้ไข']
  const changed = await packVocabularyCatalog(otherLanguage)
  const result = await save(base, { files: changed.files, patch: { groups: { 'entry-one': { ...base.catalog.groups['entry-one'], hintOverrides: { hi: ['My edit'] } } } } })
  expect(result.storage.index.streams['hints/sv/th']).toBe(changed.index.streams['hints/sv/th'])
  expect(result.catalog.groups['entry-one'].hintOverrides.hi).toEqual(['My edit'])
})

test('vocabulary changes withhold unloaded languages too; reviewing one language leaves the other pending', async () => {
  const data = await fixture()
  const changedText = vocabText.replace('wake early', 'wake up').replace('uppe med tuppen', 'vakna')
  const reader = createVocabularyCatalogReader({ read: data.read, target: 'sv', vocabulary: () => parseVocabularyFile(changedText) })
  await reader.loadLanguage('hi')
  const catalog = await reader.catalog()
  expect(lookup(catalog, 'hi', parseVocabularyFile(changedText)).search('जल्दी उठना')).toHaveLength(0)
  await reader.loadLanguage('th')
  expect(lookup(await reader.catalog(), 'th', parseVocabularyFile(changedText)).search('ตื่นแต่เช้า')).toHaveLength(0)
})

test('a deleted ID stays a tombstone after reloading split metadata', async () => {
  const data = source(); data.groups['entry-one'].deleted = true
  const packed = await fixture(data)
  expect(packed.catalog.groups['entry-one'].deleted).toBe(true)
  expect(lookup(packed.catalog, 'hi').search('जल्दी उठना')).toHaveLength(0)
})

test('first save migrates legacy hints and meanings for every language without rewriting the legacy file', async () => {
  const data = source(), files = new Map([['vocabulary.txt', vocabText], [VOCABULARY_CATALOG_PATH, JSON.stringify(data)]])
  const commit = vocabularyCommitFiles({ path: 'vocabulary.txt', baselineText: vocabText, local: vocab(), language: 'sv', catalog: data, catalogBaseline: data,
    storageSnapshot: { index: null, loadedLanguages: ['hi'], records: new Map(), files: new Map(), legacyRaw: JSON.stringify(data) } })
  const plan = await commit.prepareFiles({ headSha: 'initial', read: async path => files.get(path) ?? null })
  for (const file of plan) files.set(file.path, await file.getContent(null))
  expect(plan.some(file => file.path === VOCABULARY_CATALOG_PATH)).toBe(false)
  expect(files.get(VOCABULARY_CATALOG_PATH)).toBe(JSON.stringify(data))
  expect(commit.result().catalog.groups['entry-one'].hintOverrides.hi).toEqual(['जल्दी उठना'])
  const spanish = createVocabularyCatalogReader({ read: async path => files.get('db/language/shared/' + path) ?? null,
    target: 'es', vocabulary: () => parseVocabularyFile('#Things\n(truth)|verdad|') })
  await spanish.loadLanguage('th')
  expect((await spanish.catalog()).groups.spanish.hintOverrides.th).toEqual(['ความจริง'])
  expect((await spanish.catalog()).meanings.truth.examples?.sv).toBeUndefined()
  await spanish.loadLanguage('sv')
  expect((await spanish.catalog()).meanings.truth.examples.sv).toBe('Sanning')
})

test('chunk ordering preserves legacy group precedence and translated form matches', async () => {
  const first = { ...source().groups['entry-one'], forms: [{ id: 'one', text: 'uppe med tuppen', meanings: ['truth'] }] }
  const last = { ...first, hintOverrides: { hi: ['Last translation'] } }
  const data = { ...source(), groups: { 'z-first': first, 'a-last': last } }
  const packed = await fixture(data)
  expect(lookup(packed.catalog, 'hi').hintsFor(line)).toEqual(lookup(data, 'hi').hintsFor(line))
  expect([...lookup(packed.catalog, 'hi').search('Last translation')[0].forms]).toEqual([...lookup(data, 'hi').search('Last translation')[0].forms])
  const result = await save(packed, { patch: { sharedHints: { hi: { early: ['Updated'] } } } })
  expect(result.plan.some(file => file.path.includes('/metadata/'))).toBe(false)
})

test('approval after a vocabulary change applies only to the reviewed hint language', async () => {
  const base = await fixture()
  const nextLine = '(wake up)|vakna|'
  const local = parseVocabularyFile(vocabText.replace(line, nextLine))
  const result = await save(base, { local, patch: { groups: { 'entry-one': { ...base.catalog.groups['entry-one'], line: nextLine,
    reviewRequired: true, reviewedHints: ['hi'], hintOverrides: { hi: ['जागना'] } } } } })
  const reader = createVocabularyCatalogReader({ read: async path => result.files.get(path) ?? null, target: 'sv', vocabulary: () => local })
  await reader.loadLanguage('hi')
  expect(lookup(await reader.catalog(), 'hi', local).hintsFor(nextLine)).toEqual(['जागना'])
  await reader.loadLanguage('th')
  expect(lookup(await reader.catalog(), 'th', local).hintsFor(nextLine)).toEqual([])
})

test('metadata and provenance survive splitting without exposing example-only languages as hint options', async () => {
  const data = source()
  data.groups['entry-one'].provenance = { dictionary: 'Reviewed source' }
  data.meanings.truth.notes = 'Keep this note'
  data.custom = { retained: true }
  const base = await fixture(data)
  expect(base.reader.languages).not.toContain('sv')
  expect(base.catalog.groups['entry-one'].provenance).toEqual(data.groups['entry-one'].provenance)
  expect(base.catalog.meanings.truth.notes).toBe('Keep this note')
  expect(base.catalog.custom).toEqual({ retained: true })
})

test('repeated searches reuse the hydrated catalog, and extra hint languages have a bounded in-memory working set', async () => {
  const base = await fixture()
  expect(await base.reader.catalog()).toBe(base.catalog)
  for (const code of ['th', 'fr', 'de']) await base.reader.loadLanguage(code)
  expect(base.reader.snapshot().loadedLanguages).toHaveLength(3)
  expect(base.reader.snapshot().records.has('hints/sv/hi')).toBe(false)
  await base.reader.loadLanguage('hi')
  expect(lookup(await base.reader.catalog(), 'hi').hintsFor(line)).toEqual(['जल्दी उठना'])
})

test('English fallback meaning aliases are available without downloading other native-language packs', async () => {
  const data = source()
  data.meanings.truth.hints.en = ['certainty']
  const base = await fixture(data)
  expect(base.catalog.meanings.truth.hints.en).toEqual(['certainty'])
  expect(base.read.mock.calls.some(([path]) => path.includes('/hints/sv/th/'))).toBe(false)
})

test('a compact source placeholder cannot mask a legacy numeric meaning group', async () => {
  const data = source()
  data.groups = { 1: { ...data.groups['entry-one'], hintOverrides: undefined, meanings: ['truth'] } }
  const base = await fixture(data)
  expect(lookup(base.catalog, 'hi').hintsFor(line)).toEqual(['सत्य'])
  expect(lookup(base.catalog, 'hi').search('सत्य')).toHaveLength(1)
})

test('meaning searches keep their original row order across chunk partitions', async () => {
  const second = '(wake early)|vakna tidigt|'
  const vocabulary = parseVocabularyFile(vocabText + '\n' + second + '\t[entry:entry-two]')
  const data = source()
  const common = { language: 'sv', category: 'Everyday Life', forms: [], meanings: ['truth'] }
  data.groups = { later: { ...common, entryId: 'entry-two', line: second }, earlier: { ...common, entryId: 'entry-one', line } }
  const base = await fixture(data, 'hi', vocabulary)
  expect(lookup(base.catalog, 'hi', vocabulary).search('सत्य').map(hit => hit.line))
    .toEqual(lookup(data, 'hi', vocabulary).search('सत्य').map(hit => hit.line))
})

test('different meanings sharing an alias retain definition order after split storage and source overlays', async () => {
  const { vocabularyCatalogForLanguage } = await import('./vocabulary-hints.js')
  const second = '(wake early)|vakna tidigt|'
  const vocabulary = parseVocabularyFile(vocabText + '\n' + second + '\t[entry:entry-two]')
  const data = source()
  data.meanings = { 'z-first': { label: 'First', hints: { hi: ['सत्य'] } }, 'a-last': { label: 'Last', hints: { hi: ['सत्य'] } } }
  const common = { language: 'sv', category: 'Everyday Life', forms: [] }
  data.groups = { earlier: { ...common, entryId: 'entry-one', line, meanings: ['a-last'] },
    later: { ...common, entryId: 'entry-two', line: second, meanings: ['z-first'] } }
  const base = await fixture(data, 'hi', vocabulary)
  const overlaid = vocabularyCatalogForLanguage('hi', data, base.catalog)
  expect(lookup(overlaid, 'hi', vocabulary).search('सत्य').map(hit => hit.line)).toEqual([second, line])
})

test('linked-library hints remain available per locale without masking owned overrides or bypassing review', async () => {
  const { vocabularyCatalogForLanguage } = await import('./vocabulary-hints.js')
  const linked = source(), owned = source()
  owned.groups['entry-one'].hintOverrides = { hi: ['My Hindi'] }
  const hi = vocabularyCatalogForLanguage('hi', linked, owned)
  expect(lookup(hi, 'hi').hintsFor(line)).toEqual(['My Hindi'])
  const th = vocabularyCatalogForLanguage('th', linked, owned)
  expect(lookup(th, 'th').hintsFor(line)).toEqual(['ตื่นแต่เช้า'])
  linked.groups['entry-one'].reviewRequired = true
  expect(lookup(vocabularyCatalogForLanguage('th', linked, owned), 'th').hintsFor(line)).toEqual([])
  const placeholder = { ...owned, groups: { 'entry-one': { ...owned.groups['entry-one'], storagePlaceholder: true, hintOverrides: undefined } } }
  expect(lookup(vocabularyCatalogForLanguage('hi', source(), placeholder), 'hi').hintsFor(line)).toEqual(['जल्दी उठना'])
})

test('linked fallback matching uses entry identity across old group keys and respects differing meaning links', async () => {
  const { vocabularyCatalogForLanguage } = await import('./vocabulary-hints.js')
  const linked = source(), owned = source()
  linked.groups = { 'old-library-key': linked.groups['entry-one'] }
  owned.groups['entry-one'].hintOverrides = { hi: ['My Hindi'] }
  expect(lookup(vocabularyCatalogForLanguage('th', linked, owned), 'th').hintsFor(line)).toEqual(['ตื่นแต่เช้า'])
  owned.groups['entry-one'].meanings = ['truth']
  expect(vocabularyCatalogForLanguage('th', linked, owned).groups['entry-one'].meanings).toEqual(['truth'])
})

test('updating one meaning translation keeps the other language fields', () => {
  const base = source()
  const update = { version: 1, groups: {}, meanings: { truth: { label: 'Truth', hints: { hi: ['Updated Hindi'] } } } }
  const merged = mergeVocabularyCatalogs(base, update)
  expect(merged.meanings.truth.hints.hi).toEqual(['Updated Hindi'])
  expect(merged.meanings.truth.hints.th).toEqual(['ความจริง'])
})
