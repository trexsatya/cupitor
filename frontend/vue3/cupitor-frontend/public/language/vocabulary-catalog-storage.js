import { vocabularyEntries } from './vocabulary-entries.js'
import { vocabularyToText } from './vocab-merge.js'
import { parseVocabularyCatalog, vocabularyContentSignature } from './vocabulary-hints.js'

export const VOCABULARY_STORAGE_DIRECTORY = 'vocabulary-catalog'
export const VOCABULARY_STORAGE_INDEX = VOCABULARY_STORAGE_DIRECTORY + '/index.json'
export const VOCABULARY_STORAGE_PATH = 'db/language/shared/' + VOCABULARY_STORAGE_INDEX
export const VOCABULARY_CHUNK_BYTES = 65536
const hashPattern = /^[a-f0-9]{64}$/u
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const idPattern = /^[a-z0-9-]{1,80}$/u
const languagePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u
const own = (value, key) => Object.hasOwn(value || {}, key) ? value[key] : undefined
const streamPattern = /^(?:metadata\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*|hints\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*|meaning-definitions|(?:meaning-hints|shared-hints)\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/u
const canonical = value => Array.isArray(value) ? value.map(canonical) : record(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
export const catalogJSON = value => JSON.stringify(canonical(value)) + '\n'
const bytes = value => new TextEncoder().encode(value)
export async function catalogHash(text) {
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes(text)))].map(n => n.toString(16).padStart(2, '0')).join('')
}
export const vocabularySourceRevision = line => catalogHash(vocabularyContentSignature(line))
const bit = (hash, index) => (parseInt(hash[Math.floor(index / 4)], 16) >> (3 - index % 4)) & 1
export function catalogChunkPath(stream, hash) {
  if (!streamPattern.test(stream) || !hashPattern.test(hash)) throw new Error('Invalid vocabulary chunk path.')
  return VOCABULARY_STORAGE_DIRECTORY + '/' + stream + '/' + hash + '.json'
}
export function parseVocabularyStorageIndex(raw) {
  if (raw == null) return null
  const value = JSON.parse(raw)
  if (value?.version !== 2 || !record(value.streams) || Object.entries(value.streams).some(([name, hash]) =>
    !streamPattern.test(name) || !hashPattern.test(hash)) ||
    (value.hintLanguages !== undefined && (!Array.isArray(value.hintLanguages) || value.hintLanguages.some(code => !languagePattern.test(code)))) ||
    (value.extra !== undefined && (!record(value.extra) || ['version', 'meanings', 'groups', 'sharedHints'].some(key => Object.hasOwn(value.extra, key))))) throw new Error('Unsupported vocabulary storage index.')
  return value
}
const emptyCatalog = () => parseVocabularyCatalog(null)

// Immutable, content-addressed chunks let a reader finish an older manifest
// while another client publishes a newer one. Both leaves and branch nodes
// have a fixed byte ceiling; updating one key rewrites only its tree path.
export async function packVocabularyStream(stream, records, { maxBytes = VOCABULARY_CHUNK_BYTES } = {}) {
  if (!streamPattern.test(stream)) throw new Error('Invalid vocabulary stream.')
  const files = new Map()
  const entries = await Promise.all(Object.entries(records).sort(([a], [b]) => a.localeCompare(b, 'en')).map(async ([key, value]) =>
    ({ key, value, hash: await catalogHash(key) })))
  async function save(node) {
    const text = catalogJSON({ version: 2, ...node })
    if (bytes(text).length > maxBytes) throw new Error('A vocabulary hint record exceeds the chunk size limit.')
    const hash = await catalogHash(text)
    files.set(catalogChunkPath(stream, hash), text)
    return hash
  }
  async function branch(items, depth) {
    const records = Object.fromEntries(items.map(item => [item.key, item.value]))
    if (bytes(catalogJSON({ version: 2, records })).length <= maxBytes) return save({ records })
    if (items.length < 2 || depth === 256) throw new Error('A vocabulary hint record exceeds the chunk size limit.')
    const zero = items.filter(item => !bit(item.hash, depth)), one = items.filter(item => bit(item.hash, depth))
    return save({ zero: await branch(zero, depth + 1), one: await branch(one, depth + 1) })
  }
  return { root: await branch(entries, 0), files }
}

function limited(fn, count = 6) {
  let active = 0
  const queue = []
  return async (...args) => {
    if (active >= count) await new Promise(resolve => queue.push(resolve))
    else active++
    try { return await fn(...args) }
    finally { if (queue.length) queue.shift()(); else active-- }
  }
}
export async function readVocabularyStream(index, stream, read) {
  const root = own(index?.streams, stream)
  const records = Object.create(null), files = new Map()
  if (!root) return { records, files }
  const fetch = limited(async hash => {
    const path = catalogChunkPath(stream, hash), text = await read(path)
    if (text == null) throw new Error('Missing vocabulary chunk: ' + path)
    if (bytes(text).length > VOCABULARY_CHUNK_BYTES || await catalogHash(text) !== hash) throw new Error('Damaged vocabulary chunk: ' + path)
    const node = JSON.parse(text)
    if (node?.version !== 2) throw new Error('Unsupported vocabulary chunk: ' + path)
    files.set(path, text)
    return node
  })
  async function visit(hash, prefix) {
    if (prefix.length > 256) throw new Error('Invalid vocabulary chunk tree.')
    const node = await fetch(hash)
    if (record(node.records) && node.zero === undefined && node.one === undefined) {
      await Promise.all(Object.entries(node.records).map(async ([key, value]) => {
        const hash = await catalogHash(key)
        if ([...prefix].some((value, index) => Number(value) !== bit(hash, index)) || Object.hasOwn(records, key)) {
          throw new Error('Invalid vocabulary chunk partition.')
        }
        records[key] = value
      }))
    } else if (hashPattern.test(node.zero) && hashPattern.test(node.one) && node.records === undefined) {
      await Promise.all([visit(node.zero, prefix + '0'), visit(node.one, prefix + '1')])
    } else throw new Error('Invalid vocabulary chunk.')
  }
  await visit(root, '')
  return { records, files }
}

const reviewFields = group => ({
  ...(group.deleted ? { d: true } : {}),
  ...(group.reviewRequired ? { r: true } : {}),
  ...(group.reviewedHints?.length ? { a: group.reviewedHints } : {}),
})
const expandReview = value => ({
  ...(value.d ? { deleted: true } : {}), ...(value.r ? { reviewRequired: true } : {}),
  ...(value.a?.length ? { reviewedHints: value.a } : {}),
})
const nonempty = value => value && Object.keys(value).length

// Empty group snapshots become one compact revision record. Vocabulary text
// is authoritative and is not duplicated in metadata or each hint language.
export async function vocabularyCatalogRecords(catalog, { targets, hintLanguages } = {}) {
  const result = new Map()
  const put = (stream, key, value) => {
    if (!result.has(stream)) result.set(stream, Object.create(null))
    result.get(stream)[key] = value
  }
  const includes = language => !hintLanguages || hintLanguages.includes(language)
  const revisions = new Map()
  const revision = line => {
    const signature = vocabularyContentSignature(line)
    if (!revisions.has(signature)) revisions.set(signature, catalogHash(signature))
    return revisions.get(signature)
  }
  let nextOrder = Object.values(catalog.groups).reduce((max, group) => Math.max(max, group.storageOrder ?? -1), -1) + 1
  for (const [id, group] of Object.entries(catalog.groups)) {
    if (targets && !targets.includes(group.language)) continue
    const stream = 'metadata/' + group.language
    const known = new Set(['language', 'category', 'line', 'entryId', 'forms', 'meanings', 'hintOverrides', 'deleted',
      'reviewRequired', 'reviewedHints', 'sourceRevision', 'storageOrder', 'storageHasOverrides', 'storagePlaceholder', 'id', 'row'])
    const extra = Object.fromEntries(Object.entries(group).filter(([key]) => !known.has(key)))
    const hasOverrides = group.storageHasOverrides || group.hintOverrides !== undefined
    const semantic = nonempty(extra) || group.storageOrder !== undefined || hasOverrides || group.forms.length || group.meanings?.length || id !== group.entryId
    const order = semantic ? group.storageOrder ?? nextOrder++ : undefined
    const precedence = { ...(order !== undefined ? { o: order } : {}), ...(hasOverrides ? { h: true } : {}) }
    if (group.entryId) {
      const previous = result.get(stream)?.['e/' + group.entryId]
      const source = { s: group.deleted && group.sourceRevision ? group.sourceRevision : await revision(group.line) }
      if (id === group.entryId) Object.assign(source, reviewFields(group), precedence)
      else if (group.deleted) source.d = true
      // A real row takes precedence over an older duplicate group's tombstone.
      if (!previous || !group.deleted || previous.d) put(stream, 'e/' + group.entryId, { ...previous, ...source })
      if (id !== group.entryId || group.forms.length || group.meanings?.length || nonempty(extra)) {
        put(stream, 'g/' + id, { e: group.entryId, ...(nonempty(extra) ? { x: extra } : {}),
          ...(group.forms.length ? { f: group.forms } : {}), ...(group.meanings?.length ? { m: group.meanings } : {}), ...reviewFields(group), ...precedence })
      }
    } else {
      const { hintOverrides, storageOrder, storageHasOverrides, sourceRevision, id: runtimeId, row, ...metadata } = group
      put(stream, 'g/' + id, { legacy: metadata, ...precedence })
    }
    for (const [language, hints] of Object.entries(group.hintOverrides || {})) {
      if (includes(language)) put('hints/' + group.language + '/' + language, id, hints)
    }
  }
  let nextMeaningOrder = Object.values(catalog.meanings).reduce((max, meaning) => Math.max(max, meaning.storageOrder ?? -1), -1) + 1
  for (const [id, meaning] of Object.entries(catalog.meanings)) {
    const { hints, examples, storageOrder, ...metadata } = meaning
    put('meaning-definitions', id, { value: metadata, order: storageOrder ?? nextMeaningOrder++ })
    for (const language of new Set([...Object.keys(meaning.hints), ...Object.keys(meaning.examples || {})])) {
      if (includes(language)) put('meaning-hints/' + language, id, {
        ...(Object.hasOwn(meaning.hints, language) ? { h: meaning.hints[language] } : {}),
        ...(meaning.examples?.[language] !== undefined ? { e: meaning.examples[language] } : {}),
      })
    }
  }
  for (const [language, entries] of Object.entries(catalog.sharedHints || {})) {
    if (includes(language)) for (const [cue, hints] of Object.entries(entries)) put('shared-hints/' + language, cue, hints)
  }
  return result
}

export async function hydrateVocabularyCatalog(streams, target, vocabulary) {
  const result = emptyCatalog(), metadata = streams.get('metadata/' + target) || {}
  const rows = new Map(vocabularyEntries(vocabulary).filter(entry => entry.id).map(entry => [entry.id, entry]))
  const changed = new Map()
  const sources = Object.entries(metadata).filter(([key]) => key.startsWith('e/'))
  await Promise.all(sources.map(async ([key, value]) => {
    const id = key.slice(2), row = rows.get(id)
    if (!idPattern.test(id) || !hashPattern.test(value?.s)) throw new Error('Invalid vocabulary source revision.')
    changed.set(id, row ? await vocabularySourceRevision(row.line) !== value.s : false)
  }))
  for (const [key, value] of sources) {
    const id = key.slice(2), row = rows.get(id)
    result.groups[id] = { language: target, category: row?.category || '', line: row?.line || '', forms: [], entryId: id,
      sourceRevision: value.s, ...expandReview(value),
      ...(value.o !== undefined ? { storageOrder: value.o } : { storagePlaceholder: true }),
      ...(value.h ? { storageHasOverrides: true, hintOverrides: {} } : {}), ...(!row ? { deleted: true } : {}),
      ...(changed.get(id) ? { reviewRequired: true, reviewedHints: [] } : {}) }
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (!key.startsWith('g/')) continue
    const id = key.slice(2)
    if (value.legacy) {
      result.groups[id] = { ...JSON.parse(JSON.stringify(value.legacy)),
        ...(value.o !== undefined ? { storageOrder: value.o } : {}),
        ...(value.h ? { storageHasOverrides: true, hintOverrides: {} } : {}) }
      continue
    }
    const source = result.groups[value.e]
    if (!source) throw new Error('A vocabulary group has no source revision.')
    result.groups[id] = { ...value.x, language: target, category: source.category, line: source.line, entryId: value.e,
      sourceRevision: source.sourceRevision, forms: (value.f || []).map(form => ({ ...form, meanings: [...form.meanings] })),
      ...(value.m ? { meanings: [...value.m] } : {}),
      ...(value.o !== undefined ? { storageOrder: value.o } : {}),
      ...(value.h ? { storageHasOverrides: true, hintOverrides: {} } : {}), ...expandReview(value), ...(source.deleted ? { deleted: true } : {}),
      ...(changed.get(value.e) ? { reviewRequired: true, reviewedHints: [] } : {}) }
  }
  const meanings = Object.entries(streams.get('meaning-definitions') || {})
    .map(([id, value], index) => ({ id, value: typeof value.label === 'string' ? value : value.value, order: typeof value.label === 'string' ? index : value.order }))
    .sort((a, b) => a.order - b.order)
  for (const { id, value, order } of meanings) result.meanings[id] = { ...value, hints: {}, storageOrder: order }
  for (const [name, records] of streams) {
    if (name.startsWith('hints/' + target + '/')) {
      const language = name.slice(('hints/' + target + '/').length)
      for (const [id, hints] of Object.entries(records)) {
        if (!result.groups[id]) throw new Error('A vocabulary hint has no group.')
        result.groups[id].hintOverrides ||= {}
        result.groups[id].hintOverrides[language] = hints
      }
    } else if (name.startsWith('meaning-hints/')) {
      const language = name.slice('meaning-hints/'.length)
      for (const [id, value] of Object.entries(records)) {
        if (!result.meanings[id]) throw new Error('A vocabulary translation has no meaning.')
        if (value.h !== undefined) result.meanings[id].hints[language] = value.h
        if (value.e !== undefined) { result.meanings[id].examples ||= {}; result.meanings[id].examples[language] = value.e }
      }
    } else if (name.startsWith('shared-hints/') && Object.keys(records).length) {
      result.sharedHints ||= {}
      result.sharedHints[name.slice('shared-hints/'.length)] = records
    }
  }
  result.groups = Object.fromEntries(Object.entries(result.groups).sort(([, a], [, b]) => Number(!!a.storagePlaceholder) - Number(!!b.storagePlaceholder) || (a.storageOrder ?? -1) - (b.storageOrder ?? -1)))
  return parseVocabularyCatalog(JSON.stringify(result))
}

export function vocabularyStorageLanguages(index) {
  if (index?.hintLanguages) return index.hintLanguages
  return [...new Set(Object.keys(index?.streams || {}).flatMap(name => {
    const parts = name.split('/')
    return parts[0] === 'hints' ? [parts[2]] : ['meaning-hints', 'shared-hints'].includes(parts[0]) ? [parts[1]] : []
  }))]
}
export async function packVocabularyCatalog(catalog, options) {
  const records = await vocabularyCatalogRecords(catalog, options)
  const extra = Object.fromEntries(Object.entries(catalog).filter(([key]) => !['version', 'meanings', 'groups', 'sharedHints', 'attribution'].includes(key)))
  const hintLanguages = [...new Set([
    ...Object.values(catalog.groups).flatMap(group => Object.keys(group.hintOverrides || {})),
    ...Object.values(catalog.meanings).flatMap(meaning => Object.keys(meaning.hints)), ...Object.keys(catalog.sharedHints || {}),
  ])].sort()
  const index = { version: 2, streams: {}, hintLanguages,
    ...(catalog.attribution ? { attribution: catalog.attribution } : {}), ...(nonempty(extra) ? { extra } : {}) }
  const files = new Map()
  for (const [name, values] of records) {
    const packed = await packVocabularyStream(name, values, options)
    index.streams[name] = packed.root
    for (const entry of packed.files) files.set(...entry)
  }
  files.set(VOCABULARY_STORAGE_INDEX, catalogJSON(index))
  return { index, files, records }
}

export function createVocabularyCatalogReader({ read, target, vocabulary, initial }) {
  let index = initial?.index, legacy, legacyRaw = initial?.legacyRaw, initialized = !!initial?.index
  const records = new Map(initial?.records), files = new Map(initial?.files), loaded = new Set(initial?.loadedLanguages), pending = new Map()
  let recordsVersion = 0, cachedCatalog, cachedSignature
  for (const name of records.keys()) pending.set(name, Promise.resolve())
  const stream = async name => {
    if (!pending.has(name)) pending.set(name, readVocabularyStream(index, name, read).then(value => {
      records.set(name, value.records)
      recordsVersion++
      for (const entry of value.files) files.set(...entry)
    }).catch(error => { pending.delete(name); throw error }))
    await pending.get(name)
  }
  return {
    async initialize() {
      if (initialized) return
      index = parseVocabularyStorageIndex(await read(VOCABULARY_STORAGE_INDEX))
      if (index) {
        await Promise.all([stream('metadata/' + target), stream('meaning-definitions'), stream('hints/' + target + '/en'), stream('meaning-hints/en'), stream('shared-hints/en')])
        loaded.add('en')
      }
      else {
        legacyRaw = await read('vocabulary-meanings.json')
        legacy = parseVocabularyCatalog(legacyRaw)
      }
      initialized = true
    },
    async loadLanguage(language) {
      if (!languagePattern.test(language)) throw new Error('Invalid vocabulary hint language.')
      await this.initialize()
      if (index) await Promise.all([stream('hints/' + target + '/' + language), stream('meaning-hints/' + language), stream('shared-hints/' + language)])
      loaded.delete(language)
      loaded.add(language)
      while (loaded.size > 3) {
        const oldest = [...loaded].find(code => code !== 'en')
        loaded.delete(oldest)
        for (const name of ['hints/' + target + '/' + oldest, 'meaning-hints/' + oldest, 'shared-hints/' + oldest]) {
          records.delete(name); pending.delete(name)
          for (const path of files.keys()) if (path.startsWith(VOCABULARY_STORAGE_DIRECTORY + '/' + name + '/')) files.delete(path)
        }
        recordsVersion++
      }
    },
    async catalog() {
      await this.initialize()
      if (!index) return legacy
      const vocab = vocabulary(), signature = recordsVersion + ':' + vocabularyToText(vocab)
      if (signature === cachedSignature) return cachedCatalog
      const value = await hydrateVocabularyCatalog(records, target, vocab)
      if (index.attribution) value.attribution = index.attribution
      for (const [key, item] of Object.entries(index.extra || {})) Object.defineProperty(value, key, {
        value: item, writable: true, enumerable: true, configurable: true,
      })
      cachedSignature = signature
      cachedCatalog = value
      return value
    },
    get split() { return !!index },
    get languages() { return vocabularyStorageLanguages(index) },
    snapshot() { return { index, records: new Map(records), files: new Map(files), loadedLanguages: [...loaded], legacyRaw } },
  }
}
