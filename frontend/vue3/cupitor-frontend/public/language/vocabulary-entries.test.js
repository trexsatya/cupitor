import { TextEncoder } from 'util'
import { webcrypto } from 'crypto'
import { parseVocabularyFile, vocabularyToText, mergeVocabulary, removeVocabularyLine } from './vocab-merge.js'
import { adoptVocabularyEntryIds, identifyNewVocabularyEntries, vocabularyEntryId, vocabularyEntries,
  setVocabularyEntryId, spliceVocabularyEntries, restoreVocabularyEntryIds } from './vocabulary-entries.js'
import { mergeVocabularyLayers, withoutReadOnlyLines, pendingVocabCategories, relayerVocabulary } from './data-source.js'
import { createVocabularyMatcher } from './vocabulary-matcher.js'
import { createVocabularyHintIndex, parseVocabularyCatalog, reviseVocabularyGroup, synchronizeVocabularyGroups } from './vocabulary-hints.js'
import { vocabularyCommitFiles } from './vocabulary-save.js'
import { VOCABULARY_CATALOG_PATH } from './vocabulary-hints.js'
import { createVocabularyCatalogReader, VOCABULARY_STORAGE_PATH } from './vocabulary-catalog-storage.js'

beforeAll(() => {
  global.TextEncoder = TextEncoder
  Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true })
})
const original = '(wake early)|uppe med tuppen|'
const changed = '(stay awake)|hålla sig vaken|'
const text = (line = original, category = 'Everyday Life', id = 'entry-one') => `#${category}\n${line}\t[entry:${id}]`
const empty = () => parseVocabularyCatalog(null)
const catalog = () => ({ version: 1, meanings: {}, groups: { 'hints-old': {
  language: 'sv', category: 'Everyday Life', line: original, forms: [],
  hintOverrides: { hi: ['जल्दी उठना'], th: ['ตื่นแต่เช้า'] },
} }, attribution: { source: 'Retain this metadata' } })
const index = (vocab, data, language = 'hi') => createVocabularyHintIndex(createVocabularyMatcher(vocab).rows, 'sv', data, language)

async function runCommit(commit, vocabulary, data, headSha = 'head') {
  const files = new Map([['vocabulary.txt', vocabulary], [VOCABULARY_CATALOG_PATH, JSON.stringify(data)]])
  const read = jest.fn(async path => files.get(path) ?? null)
  const plan = await commit.prepareFiles({ headSha, read })
  for (const file of plan) files.set(file.path, await file.getContent(files.get(file.path) ?? null))
  return { ...commit.result(), files }
}

function migrate() {
  const previous = parseVocabularyFile(text())
  const data = catalog()
  data.groups = { ...data.groups, ...synchronizeVocabularyGroups(data, 'sv', previous, previous) }
  return { previous, data }
}

test('markers round-trip without entering text, search, categories or CLI rows', () => {
  const vocab = parseVocabularyFile(text())
  expect(vocab['Everyday Life']).toEqual([original])
  expect(vocabularyToText(vocab).replace('#__empty__\n\n', '')).toBe(text())
  expect(vocabularyEntryId(vocab, 'Everyday Life', original)).toBe('entry-one')
  const matcher = createVocabularyMatcher(vocab)
  expect(matcher.rows.some(row => row.words.includes('entry'))).toBe(false)
  expect(matcher.rows.find(row => row.line === original).entryId).toBe('entry-one')
})

test('legacy adoption is deterministic, then an arbitrary rename and move carries the same ID', async () => {
  const a = await adoptVocabularyEntryIds(parseVocabularyFile('#A\n' + original), 'sv')
  const b = await adoptVocabularyEntryIds(parseVocabularyFile('#A\n' + original), 'sv')
  const id = vocabularyEntryId(a, 'A', original)
  expect(vocabularyEntryId(b, 'A', original)).toBe(id)
  spliceVocabularyEntries(a, 'A', 0, 1, [changed])
  a.B = a.A
  setVocabularyEntryId(a, 'B', changed, vocabularyEntryId(a, 'A', changed))
  delete a.A
  const reloaded = await adoptVocabularyEntryIds(parseVocabularyFile(vocabularyToText(a)), 'sv')
  expect(vocabularyEntryId(reloaded, 'B', changed)).toBe(id)
})

test('migration keeps existing group IDs, all languages and attribution', () => {
  const { previous, data } = migrate()
  expect(data.groups['hints-old'].entryId).toBe('entry-one')
  expect(data.groups['hints-old'].hintOverrides).toEqual(catalog().groups['hints-old'].hintOverrides)
  expect(data.attribution).toEqual(catalog().attribution)
  expect(index(previous, data).search('जल्दी उठना')).toHaveLength(1)
})

test('category moves and reordered words retain reviewed hints after reload', () => {
  const { data } = migrate()
  const moved = parseVocabularyFile(text(original, 'Morning'))
  expect(index(moved, data).search('जल्दी उठना')[0].category).toBe('Morning')
  const group = reviseVocabularyGroup(data.groups['hints-old'], '(early, wake)|a|b|', { category: 'Morning', line: '(wake, early)|b|a|' })
  expect(group.reviewRequired).toBeUndefined()
})

test('changing all words keeps identity but withholds stale translations pending language-specific review', () => {
  const { previous, data } = migrate()
  const next = parseVocabularyFile(text(changed, 'Sleep'))
  // Also safe before a catalog synchronization, e.g. a hand-edited text file.
  expect(index(next, data).search('जल्दी उठना')).toHaveLength(0)
  const groups = synchronizeVocabularyGroups(data, 'sv', previous, next)
  const updated = { ...data, groups: { ...data.groups, ...groups } }
  expect(groups['hints-old'].entryId).toBe('entry-one')
  expect(groups['hints-old'].reviewRequired).toBe(true)
  expect(index(next, updated).hintsFor(changed)).toEqual([])
  groups['hints-old'].hintOverrides.hi = ['जागते रहना']
  groups['hints-old'].reviewedHints = ['hi']
  expect(index(next, updated).search('जागते रहना')).toHaveLength(1)
  expect(index(next, updated, 'th').search('ตื่นแต่เช้า')).toHaveLength(0)
})

test('delete and recreate identical text cannot reactivate the old ID or old hints', () => {
  const { previous, data } = migrate()
  const deleted = removeVocabularyLine(previous, new Set(), 'Everyday Life', original).vocab
  const tombstones = synchronizeVocabularyGroups(data, 'sv', previous, deleted)
  expect(tombstones['hints-old'].deleted).toBe(true)
  spliceVocabularyEntries(deleted, 'Everyday Life', 0, 0, [original])
  const created = parseVocabularyFile(vocabularyToText(deleted))
  expect(vocabularyEntryId(created, 'Everyday Life', original)).not.toBe('entry-one')
  expect(index(created, data).search('जल्दी उठना')).toHaveLength(0)
  expect(index(created, { ...data, groups: tombstones }).search('जल्दी उठना')).toHaveLength(0)
})

test('editing then adding the old text gives two distinct identities', () => {
  const vocab = parseVocabularyFile(text())
  spliceVocabularyEntries(vocab, 'Everyday Life', 0, 1, [changed])
  spliceVocabularyEntries(vocab, 'Everyday Life', 1, 0, [original])
  expect(vocabularyEntryId(vocab, 'Everyday Life', changed)).toBe('entry-one')
  expect(vocabularyEntryId(vocab, 'Everyday Life', original)).not.toBe('entry-one')
  expect(() => vocabularyToText(vocab)).not.toThrow()
})

test('identical copies keep their own IDs through insertion and deletion', () => {
  const raw = text() + '\n' + original + '\t[entry:entry-two]'
  const vocab = parseVocabularyFile(raw)
  spliceVocabularyEntries(vocab, 'Everyday Life', 0, 0, [original])
  expect(vocabularyEntryId(vocab, 'Everyday Life', original, 1)).toBe('entry-one')
  const result = removeVocabularyLine(vocab, new Set(), 'Everyday Life', original, 1).vocab
  expect(vocabularyEntryId(result, 'Everyday Life', original, 1)).toBe('entry-two')
  expect(() => vocabularyToText(result)).not.toThrow()
})

test('one-to-many replacements do not guess which meaning inherits the old translation', () => {
  const { previous, data } = migrate()
  const next = parseVocabularyFile(vocabularyToText(previous))
  spliceVocabularyEntries(next, 'Everyday Life', 0, 1, [original, changed])
  const patch = synchronizeVocabularyGroups(data, 'sv', previous, next)
  expect(patch['hints-old'].deleted).toBe(true)
  expect(index(next, data).search('जल्दी उठना')).toHaveLength(0)
})

test('layering and unsaved-work serialization keep IDs and exclude the other user', () => {
  const layered = mergeVocabularyLayers(text(), text(changed, 'Other', 'entry-other'))
  const pending = pendingVocabCategories(layered.vocab, ['Everyday Life', 'Other'], layered.readOnly, layered.otherCategories)
  const saved = JSON.parse(JSON.stringify({ categories: pending, entries: vocabularyEntries(pending).filter(entry => entry.id) }))
  restoreVocabularyEntryIds(saved.categories, saved.entries)
  const replayed = relayerVocabulary(saved.categories, new Set(), new Set(), text(changed, 'Other', 'entry-other'))
  const own = withoutReadOnlyLines(replayed.vocab, replayed.readOnly, replayed.otherCategories)
  expect(vocabularyEntries(own).filter(e => e.id).map(e => e.id)).toEqual(['entry-one'])
})

test('a remote rename wins over an unchanged local entry; unrelated additions survive', () => {
  const baseline = text()
  const local = parseVocabularyFile(baseline)
  local['Everyday Life'].push('(cat)|katt|')
  identifyNewVocabularyEntries(local)
  const merged = mergeVocabulary(baseline, local, text(changed, 'Sleep'))
  expect(merged.Sleep).toEqual([changed])
  expect(merged['Everyday Life']).toEqual(['(cat)|katt|'])
  expect(vocabularyEntryId(merged, 'Sleep', changed)).toBe('entry-one')
})

test('conflicting changes and deletion versus edit stop the atomic save', () => {
  const local = parseVocabularyFile(text())
  spliceVocabularyEntries(local, 'Everyday Life', 0, 1, [changed])
  expect(() => mergeVocabulary(text(), local, text('(sleep)|sova|'))).toThrow(/changed in the repository/)
  expect(() => mergeVocabulary(text(), local, '#Everyday Life')).toThrow(/edited and deleted/)
})

test('legacy remote text can be adopted atomically with the existing curated packs', async () => {
  const raw = '#Everyday Life\n' + original
  const baseline = await adoptVocabularyEntryIds(parseVocabularyFile(raw), 'sv')
  const local = parseVocabularyFile(vocabularyToText(baseline))
  spliceVocabularyEntries(local, 'Everyday Life', 0, 1, [changed])
  const data = catalog()
  const commit = vocabularyCommitFiles({ path: 'vocabulary.txt', baselineText: vocabularyToText(baseline), local, language: 'sv', catalog: data, catalogBaseline: data })
  const { text: nextText, catalog: nextCatalog, files } = await runCommit(commit, raw, data)
  const id = vocabularyEntryId(baseline, 'Everyday Life', original)
  expect(vocabularyEntryId(parseVocabularyFile(nextText), 'Everyday Life', changed)).toBe(id)
  expect(nextCatalog.groups['hints-old'].entryId).toBe(id)
  expect(nextCatalog.groups['hints-old'].reviewRequired).toBe(true)
  expect(nextCatalog.attribution).toEqual(data.attribution)
  expect(files.has(VOCABULARY_STORAGE_PATH)).toBe(true)
  expect(files.get(VOCABULARY_CATALOG_PATH)).toBe(JSON.stringify(data))
})

test('transaction retries use fresh remote vocabulary and retain unrelated catalog edits', async () => {
  const { data } = migrate()
  const commit = vocabularyCommitFiles({ path: 'vocabulary.txt', baselineText: text(), local: parseVocabularyFile(text()), language: 'sv', catalog: data, catalogBaseline: data })
  await runCommit(commit, text(), data, 'first')
  const remoteText = text(original, 'Moved')
  const remote = { ...data, sharedHints: { hi: { cat: ['बिल्ली'] } } }
  const result = await runCommit(commit, remoteText, remote, 'second')
  const reader = createVocabularyCatalogReader({ read: async path => result.files.get('db/language/shared/' + path) ?? null,
    target: 'sv', vocabulary: () => parseVocabularyFile(result.text) })
  await reader.loadLanguage('hi')
  expect((await reader.catalog()).sharedHints).toEqual(remote.sharedHints)
  expect(result.catalog.groups['hints-old'].category).toBe('Moved')
  expect(result.text).toContain('#Moved')
})

test('migration updates every legacy group on a row and refuses ambiguous matches', () => {
  const previous = parseVocabularyFile(text())
  const data = catalog()
  data.groups.duplicate = { ...data.groups['hints-old'] }
  expect(Object.keys(synchronizeVocabularyGroups(data, 'sv', previous, previous))).toHaveLength(2)
  const ambiguous = parseVocabularyFile(text() + '\n' + original + '\t[entry:entry-two]')
  expect(synchronizeVocabularyGroups(data, 'sv', ambiguous, ambiguous)['hints-old']).toBeUndefined()
})

test('invalid and duplicate markers fail instead of silently borrowing another row identity', () => {
  expect(() => parseVocabularyFile(text() + '\n' + changed + '\t[entry:entry-one]')).toThrow(/Duplicate/)
  expect(() => parseVocabularyFile('#A\na\t[entry:INVALID]')).toThrow(/Invalid/)
  expect(() => parseVocabularyCatalog(JSON.stringify({ ...empty(), groups: { a: { ...catalog().groups['hints-old'], entryId: 'INVALID' } } }))).toThrow(/unsupported/)
})

test('a forms-only change withholds shared and linked hints too until review', () => {
  const { data } = migrate()
  const line = '(wake early)|vakna tidigt|'
  const next = parseVocabularyFile(text(line))
  const rows = createVocabularyMatcher(next).rows
  const result = createVocabularyHintIndex(rows, 'sv', data, 'hi', new Map([['wake early', ['जल्दी उठना']]]))
  expect(result.hintsFor(line)).toEqual([])
  expect(result.search('जल्दी उठना')).toHaveLength(0)
  expect(result.groupFor(rows.find(row => row.line === line).index).reviewRequired).toBe(true)
})

test('a catalog-only edit cannot bypass a concurrent vocabulary edit', async () => {
  const { data } = migrate()
  const commit = vocabularyCommitFiles({ path: 'vocabulary.txt', baselineText: text(), local: parseVocabularyFile(text()), language: 'sv', catalog: data, catalogBaseline: data,
    patch: { groups: { 'hints-old': { ...data.groups['hints-old'], hintOverrides: { hi: ['Updated hint'] } } } } })
  await expect(runCommit(commit, text(changed), data)).rejects.toThrow(/vocabulary/)
})

test('first adoption preserves curated hints when the old seed has a spelling difference', () => {
  const data = catalog()
  data.groups['hints-old'].line = '(wake early)|uppe med tuppen|vakna|'
  const previous = parseVocabularyFile(text('(wake early)|vakna|'))
  const groups = synchronizeVocabularyGroups(data, 'sv', previous, previous)
  expect(groups['hints-old'].reviewRequired).toBeUndefined()
  expect(groups['hints-old'].hintOverrides).toEqual(data.groups['hints-old'].hintOverrides)
})

test('shared-pack-only rows also get a stable snapshot for later translation review', () => {
  const previous = parseVocabularyFile(text())
  const groups = synchronizeVocabularyGroups(empty(), 'sv', previous, previous)
  expect(groups['entry-one'].entryId).toBe('entry-one')
  const next = parseVocabularyFile(text('(wake early)|vakna tidigt|'))
  const changed = synchronizeVocabularyGroups({ ...empty(), groups }, 'sv', previous, next)
  expect(changed['entry-one'].reviewRequired).toBe(true)
})

test('dynamic plans assign matching vocabulary and hint IDs on every retry', async () => {
  const { data } = migrate()
  const commit = vocabularyCommitFiles({ path: 'vocabulary.txt', baselineText: text(), local: parseVocabularyFile(text()), language: 'sv', catalog: data, catalogBaseline: data })
  for (const headSha of ['one', 'two']) {
    const remote = text(original, headSha) + '\n(new entry)|nytt ord|'
    const result = await runCommit(commit, remote, data, headSha)
    const next = parseVocabularyFile(result.text)
    const newId = vocabularyEntryId(next, headSha, '(new entry)|nytt ord|')
    expect(result.catalog.groups[newId].entryId).toBe(newId)
    expect(result.catalog.groups['hints-old'].category).toBe(headSha)
  }
})

test('a read-only fork with the same ID cannot make the own entry ambiguous', () => {
  const { data } = migrate()
  const layers = mergeVocabularyLayers(text(), text(changed, 'Other'))
  expect(index(layers.vocab, data).search('जल्दी उठना')).toHaveLength(1)
})

test('a line-only display cannot bypass review when identical text has multiple identities', () => {
  const { data } = migrate()
  const line = '(wake early)|vakna tidigt|'
  data.groups.other = { ...data.groups['hints-old'], entryId: 'entry-two', category: 'Other', line, hintOverrides: { hi: ['Approved translation'] } }
  const vocab = parseVocabularyFile(text(line) + '\n' + text(line, 'Other', 'entry-two'))
  const result = createVocabularyHintIndex(createVocabularyMatcher(vocab).rows, 'sv', data, 'hi', new Map([['wake early', ['Unreviewed shared hint']]]))
  expect(result.hintsFor(line)).toEqual([])
  expect(result.search('Approved translation')).toHaveLength(1)
})

test('first adoption retains identical legacy rows with their distinct identities', async () => {
  const raw = '#Everyday Life\n' + original + '\n' + original
  const baseline = await adoptVocabularyEntryIds(parseVocabularyFile(raw), 'sv')
  const merged = mergeVocabulary(vocabularyToText(baseline), baseline, raw)
  expect(merged['Everyday Life']).toEqual([original, original])
  expect(vocabularyEntries(merged).filter(entry => entry.id).map(entry => entry.id)).toEqual(vocabularyEntries(baseline).filter(entry => entry.id).map(entry => entry.id))
  expect(() => mergeVocabulary(vocabularyToText(baseline), baseline, '#Everyday Life\n' + original)).toThrow(/ambiguously/)
})
