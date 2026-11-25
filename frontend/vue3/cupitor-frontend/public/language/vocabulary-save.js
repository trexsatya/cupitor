import { mergeVocabulary, parseVocabularyFile, vocabularyToText } from './vocab-merge.js'
import { identifyNewVocabularyEntries, vocabularyEntries } from './vocabulary-entries.js'
import { changeVocabularyCatalog, mergeVocabularyCatalogs, synchronizeVocabularyGroups, VOCABULARY_CATALOG_PATH } from './vocabulary-hints.js'
import { catalogJSON, createVocabularyCatalogReader, packVocabularyCatalog, packVocabularyStream,
  parseVocabularyStorageIndex, readVocabularyStream, vocabularyCatalogRecords, VOCABULARY_STORAGE_INDEX, VOCABULARY_STORAGE_PATH } from './vocabulary-catalog-storage.js'

const shared = 'db/language/shared/'
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const valueAt = (records, key) => Object.hasOwn(records || {}, key) ? records[key] : undefined

// A dynamic plan is recomputed against a pinned commit on every retry. The
// vocabulary, changed chunks and their index are published in one Git commit.
export function vocabularyCommitFiles({ path, baselineText, local, language, catalog, catalogBaseline,
  storageSnapshot, patch = {}, assertCurrent = () => {} }) {
  let result
  identifyNewVocabularyEntries(local)
  return {
    files: [{ path, getContent: () => { throw new Error('Prepare the vocabulary storage transaction before writing.') } }],
    async prepareFiles(snapshot) {
      assertCurrent()
      const remoteText = await snapshot.read(path)
      const next = mergeVocabulary(baselineText, local, remoteText || '')
      identifyNewVocabularyEntries(next)
      const text = vocabularyToText(next)
      const byId = new Map(vocabularyEntries(next).filter(entry => entry.id).map(entry => [entry.id, entry]))
      for (const group of Object.values(patch.groups || {})) {
        if (!group.entryId) continue
        const entry = byId.get(group.entryId)
        if (!entry || entry.category !== group.category || entry.line !== group.line) {
          throw new Error('This vocabulary entry changed in the repository. Reload before editing its hints.')
        }
      }
      const groups = synchronizeVocabularyGroups(catalog, language, parseVocabularyFile(baselineText), next)
      const changes = { ...patch, groups: { ...groups, ...patch.groups } }
      const liveIndex = parseVocabularyStorageIndex(await snapshot.read(VOCABULARY_STORAGE_PATH))
      if (!!liveIndex !== !!storageSnapshot?.index && storageSnapshot) throw new Error('Vocabulary storage changed. Reload before saving.')
      const writes = new Map()
      let index
      const immutable = new Map(storageSnapshot?.files)
      const read = async relative => {
        if (writes.has(relative)) return writes.get(relative)
        if (immutable.has(relative)) return immutable.get(relative)
        return snapshot.read(shared + relative)
      }
      if (!liveIndex) {
        const raw = await snapshot.read(VOCABULARY_CATALOG_PATH)
        const live = changeVocabularyCatalog(raw, catalogBaseline, changes)
        // Keep every language and meaning, including legacy Hindi and seeds.
        const updated = { ...live, ...mergeVocabularyCatalogs(catalog, live) }
        if (live.attribution) updated.attribution = live.attribution
        const packed = await packVocabularyCatalog(updated)
        index = packed.index
        for (const entry of packed.files) writes.set(...entry)
      } else {
        if (!storageSnapshot?.index) throw new Error('Reload the vocabulary catalog before saving.')
        const updated = changeVocabularyCatalog(JSON.stringify(catalog), catalog, changes)
        const hintLanguages = [...new Set([...storageSnapshot.loadedLanguages, ...Object.keys(patch.sharedHints || {}),
          ...Object.values(patch.groups || {}).flatMap(group => Object.keys(group.hintOverrides || {}))])]
        const desired = await vocabularyCatalogRecords(updated, { targets: [language], hintLanguages })
        const names = new Set([...desired.keys(), ...storageSnapshot.records.keys()])
        index = { ...liveIndex, streams: { ...liveIndex.streams },
          hintLanguages: [...new Set([...(liveIndex.hintLanguages || []), ...Object.keys(patch.sharedHints || {}),
            ...Object.values(patch.groups || {}).flatMap(group => Object.keys(group.hintOverrides || {}))])].sort() }
        for (const name of names) {
          // Reader snapshots contain only the current learning/hint languages.
          const before = storageSnapshot.records.get(name) || {}, after = desired.get(name) || {}
          const touched = [...new Set([...Object.keys(before), ...Object.keys(after)])]
            .filter(key => !same(valueAt(before, key), valueAt(after, key)))
          if (!touched.length) continue
          const current = await readVocabularyStream(liveIndex, name, read)
          for (const entry of current.files) immutable.set(...entry)
          const records = { ...current.records }
          for (const key of touched) {
            const expected = valueAt(before, key), live = valueAt(records, key), desired = valueAt(after, key)
            if (!same(live, expected) && !same(live, desired)) {
              throw new Error('This vocabulary hint or source revision changed in the repository. Reload before editing it.')
            }
            if (desired === undefined) delete records[key]
            else records[key] = desired
          }
          const packed = await packVocabularyStream(name, records)
          index.streams[name] = packed.root
          for (const [file, text] of packed.files) if (!immutable.has(file)) writes.set(file, text)
        }
        writes.set(VOCABULARY_STORAGE_INDEX, catalogJSON(index))
      }
      const reader = createVocabularyCatalogReader({ read, target: language, vocabulary: () => next })
      await reader.initialize()
      for (const code of storageSnapshot?.loadedLanguages || ['en']) await reader.loadLanguage(code)
      const nextCatalog = await reader.catalog()
      const state = reader.snapshot()
      result = { text, catalog: nextCatalog, storage: state, storageWrites: writes }
      assertCurrent()
      return [{ path, getContent: () => { assertCurrent(); return text } }, ...[...writes].map(([relative, value]) => ({
        path: shared + relative, getContent: () => { assertCurrent(); return value },
      }))]
    },
    result: () => result,
  }
}
