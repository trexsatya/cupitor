#!/usr/bin/env node
// Audit/stage a lossless catalog split; never overwrite the source checkout.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, sep } from 'node:path'
import { webcrypto } from 'node:crypto'
import { parseVocabularyFile, vocabularyToText, mergeVocabulary } from '../../public/language/vocab-merge.js'
import { adoptVocabularyEntryIds, vocabularyEntries } from '../../public/language/vocabulary-entries.js'
import { parseVocabularyCatalog, mergeVocabularyCatalogs, synchronizeVocabularyGroups, createVocabularyHintIndex, parseVocabularyHintTranslations, vocabularyLineParts, vocabularyCatalogForLanguage } from '../../public/language/vocabulary-hints.js'
import { vocabularyHintSeed } from '../../public/language/vocabulary-hint-seed.js'
import { packVocabularyCatalog, createVocabularyCatalogReader, VOCABULARY_STORAGE_INDEX } from '../../public/language/vocabulary-catalog-storage.js'

export async function auditVocabularyCatalog({ dataDir, lang = 'sv', outDir }) {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  const shared = join(dataDir, '..', 'shared')
  const read = path => existsSync(path) ? readFileSync(path, 'utf8') : null
  const raw = read(join(dataDir, 'vocabulary.txt'))
  if (raw == null) throw new Error('No vocabulary.txt in --dataDir.')
  const previous = await adoptVocabularyEntryIds(parseVocabularyFile(raw), lang)
  const vocabulary = mergeVocabulary(vocabularyToText(previous), previous, raw)
  if (existsSync(join(shared, VOCABULARY_STORAGE_INDEX))) throw new Error('This source already uses split storage. This command stages the initial legacy migration only.')
  const canonical = parseVocabularyCatalog(read(join(shared, 'vocabulary-meanings.json')))
  const hindi = parseVocabularyCatalog(read(join(dataDir, 'vocabulary-hints-hi.json')))
  const source = mergeVocabularyCatalogs(hindi, vocabularyHintSeed, canonical)
  const updated = { ...canonical, ...source, groups: { ...source.groups, ...synchronizeVocabularyGroups(source, lang, previous, vocabulary) } }
  if (canonical.attribution) updated.attribution = canonical.attribution
  const packed = await packVocabularyCatalog(updated)
  const rows = vocabularyEntries(vocabulary).map((entry, index) => ({ ...entry, index, entryId: entry.id }))
  const reader = createVocabularyCatalogReader({ read: async path => packed.files.get(path) ?? null, target: lang, vocabulary: () => vocabulary })
  const languages = [...new Set([...reader.languages, ...Object.values(source.groups).flatMap(group => Object.keys(group.hintOverrides || {})),
    ...Object.values(source.meanings).flatMap(meaning => Object.keys(meaning.hints))])]
  const results = {}, differences = [], searchDifferences = []
  let aliasChecks = 0
  await reader.initialize()
  for (const language of languages) {
    const translations = parseVocabularyHintTranslations(read(join(shared, 'vocabulary-hints', language + '.txt')) || '', language)
    const before = createVocabularyHintIndex(rows, lang, vocabularyCatalogForLanguage(language, hindi, vocabularyHintSeed, canonical), language, translations)
    await reader.loadLanguage(language)
    const after = createVocabularyHintIndex(rows, lang, vocabularyCatalogForLanguage(language, vocabularyHintSeed, await reader.catalog()), language, translations)
    const changed = rows.filter(row => JSON.stringify(before.hintsFor(row.line, row.index)) !== JSON.stringify(after.hintsFor(row.line, row.index)))
    const aliases = new Set([
      ...[...translations.values()].flat(), ...Object.values(source.meanings).flatMap(meaning => meaning.hints[language] || []),
      ...Object.values(source.groups).flatMap(group => group.hintOverrides?.[language] || []),
      ...Object.values(source.sharedHints?.[language] || {}).flat(),
      ...(language === 'en' ? rows.flatMap(row => vocabularyLineParts(row.line).hints) : []),
    ])
    const searchSignature = index => JSON.stringify(index.map(hit => [hit.index, [...hit.forms].sort(), [...hit.meanings].sort(), hit.localizedHints]))
    for (const alias of aliases) {
      aliasChecks++
      if (searchSignature(before.search(alias)) !== searchSignature(after.search(alias))) searchDifferences.push({ language, alias, before: JSON.parse(searchSignature(before.search(alias))), after: JSON.parse(searchSignature(after.search(alias))) })
    }
    results[language] = changed.length
    differences.push(...changed.map(row => ({ language, line: row.line, before: before.hintsFor(row.line, row.index), after: after.hintsFor(row.line, row.index) })))
  }
  const beforeRows = vocabularyEntries(previous).filter(entry => entry.id).length, afterRows = rows.filter(entry => entry.id).length
  if (beforeRows !== afterRows) throw new Error('Migration changed the number of vocabulary entries.')
  const sizes = [...packed.files].filter(([path]) => path !== VOCABULARY_STORAGE_INDEX).map(([, text]) => Buffer.byteLength(text))
  const report = { rows: afterRows, languages: results, changedDisplays: differences.length, examples: differences.slice(0, 10),
    chunks: sizes.length, maxChunkBytes: Math.max(...sizes), totalBytes: [...packed.files.values()].reduce((n, text) => n + Buffer.byteLength(text), 0),
    indexBytes: Buffer.byteLength(packed.files.get(VOCABULARY_STORAGE_INDEX)), aliasChecks, changedSearches: searchDifferences.length,
    searchExamples: searchDifferences.slice(0, 10),
    metadataBytes: [...packed.files].filter(([path]) => path.includes('/metadata/' + lang + '/')).reduce((n, [, text]) => n + Buffer.byteLength(text), 0) }
  if (differences.length || searchDifferences.length) throw new Error('Vocabulary migration changed hints: ' + JSON.stringify(report))
  if (outDir) {
    const root = resolve(outDir)
    const inside = (path, directory) => path === directory || path.startsWith(directory + sep)
    if ([join(root, 'shared'), join(root, 'vocabulary')].some(path => inside(path, resolve(dataDir)) || inside(path, resolve(shared)))) {
      throw new Error('--outDir must be a separate staging directory.')
    }
    for (const [path, text] of packed.files) { const file = join(root, 'shared', path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text) }
    mkdirSync(join(root, 'vocabulary'), { recursive: true })
    writeFileSync(join(root, 'vocabulary', 'vocabulary.txt'), vocabularyToText(vocabulary))
  }
  return report
}
