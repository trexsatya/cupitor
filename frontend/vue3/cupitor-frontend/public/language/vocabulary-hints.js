import { stripBracketHints, stripExpansionMarkers } from './vocab-search.js'
import { isProperlyBracketed, ownLines, parseVocabularyFile } from './vocab-merge.js'

export const VOCABULARY_CATALOG_FILE = 'vocabulary-meanings.json'
export const GENERATED_HINDI_HINTS_FILE = 'vocabulary-hints-hi.json'
export const SHARED_HINTS_DIRECTORY = 'vocabulary-hints'
export const VOCABULARY_CATALOG_PATH = 'db/language/shared/' + VOCABULARY_CATALOG_FILE

export function normalizeHint(value, language) {
  const text = value.normalize('NFC').trim().replace(/\s+/gu, ' ')
  return language ? text.toLocaleLowerCase(language) : text.toLowerCase()
}

// Split a cue list while keeping any qualifiers with their phrase.
export function splitVocabularyHints(value) {
  let depth = 0
  let start = 0
  const hints = []
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if ((value[i] === ',' || value[i] === ';') && depth === 0) {
      hints.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  hints.push(value.slice(start).trim())
  return [...new Set(hints.filter(Boolean))]
}

export function vocabularyLineParts(line) {
  const segments = line.split('|').map(part => part.trim()).filter(Boolean)
  const leading = segments[0]?.match(/^\(((?:[^()]|\([^()]*\))+?)\)$/u)
  if (leading && isProperlyBracketed(segments[0])) {
    return { hints: splitVocabularyHints(leading[1]), forms: segments.slice(1) }
  }
  // Some single-form lines use the legacy "hacer (do,make)" format.
  const trailing = segments.length === 1 && segments[0].match(/^([^()]+?)\s+\(([^()]+)\)$/u)
  if (trailing && isProperlyBracketed(segments[0])) {
    return { hints: splitVocabularyHints(trailing[2]), forms: [trailing[1].trim()] }
  }
  return { hints: [], forms: segments }
}

const rowKey = (category, line) => JSON.stringify([category, vocabularyLineParts(line)])
const formKey = text => normalizeHint(stripExpansionMarkers(stripBracketHints(text)))
const idPattern = /^[a-z0-9-]{1,80}$/u
const languagePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u
const record = value => !!value && typeof value === 'object' && !Array.isArray(value)
const validId = value => typeof value === 'string' && idPattern.test(value)
const validLanguage = value => typeof value === 'string' && languagePattern.test(value)
  && Intl.getCanonicalLocales(value).length === 1
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && !!item.trim())
const entriesAre = (value, predicate) => record(value) && Object.entries(value).every(([key, item]) => predicate(key, item))

export function parseVocabularyHintLanguages(text = '') {
  const languages = new Set()
  for (const line of text.split(/\r?\n/u)) {
    const value = line.trim()
    try {
      if (validLanguage(value)) languages.add(Intl.getCanonicalLocales(value)[0])
    } catch (_) { /* Ignore malformed language tags. */ }
  }
  return [...languages]
}

// Each line contains an English cue, =, and one or more pipe-separated hints.
export function parseVocabularyHintTranslations(text = '', language) {
  const byEnglish = new Map()
  for (const line of text.split(/\r?\n/u)) {
    const equals = line.indexOf('=')
    if (equals < 1 || line.trimStart().startsWith('#')) continue
    const english = normalizeHint(line.slice(0, equals), 'en')
    const aliases = byEnglish.get(english) || new Map()
    for (const part of line.slice(equals + 1).split('|')) {
      const key = normalizeHint(part, language)
      if (key && !aliases.has(key)) aliases.set(key, part.trim())
    }
    if (english && aliases.size) byEnglish.set(english, aliases)
  }
  return new Map([...byEnglish].map(([english, aliases]) => [english, [...aliases.values()]]))
}

export function parseVocabularyCatalog(raw) {
  if (raw == null) return { version: 1, meanings: {}, groups: {} }
  const value = JSON.parse(raw)
  const validMeaning = (id, item) => validId(id) && record(item) &&
    typeof item.label === 'string' && !!item.label.trim() &&
    entriesAre(item.hints, (language, hints) => validLanguage(language) && strings(hints)) &&
    (item.examples === undefined || entriesAre(item.examples, (language, text) =>
      validLanguage(language) && typeof text === 'string'))
  const validGroup = (id, item) => validId(id) && record(item) &&
    validLanguage(item.language) && typeof item.category === 'string' && typeof item.line === 'string' &&
    (item.meanings === undefined || (Array.isArray(item.meanings) && item.meanings.every(validId))) &&
    Array.isArray(item.forms) && new Set(item.forms.map(form => form?.id)).size === item.forms.length &&
    item.forms.every(form => record(form) && validId(form.id) && typeof form.text === 'string' &&
      Array.isArray(form.meanings) && form.meanings.every(validId))
  if (value?.version !== 1 || !entriesAre(value.meanings, validMeaning) || !entriesAre(value.groups, validGroup)) {
    throw new Error('The vocabulary meanings file has an unsupported format.')
  }
  return value
}

export function mergeVocabularyCatalogs(...catalogs) {
  return {
    version: 1,
    meanings: Object.assign(Object.create(null), ...catalogs.map(catalog => catalog.meanings)),
    groups: Object.assign(Object.create(null), ...catalogs.map(catalog => catalog.groups)),
  }
}

// Merge only records touched by the editor. The repository write retries on
// branch updates, so concurrent edits to another record can go through.
export function changeVocabularyCatalog(raw, baseline, patch) {
  const live = parseVocabularyCatalog(raw)
  for (const kind of ['meanings', 'groups']) {
    for (const [id, value] of Object.entries(patch[kind])) {
      if (JSON.stringify(Object.hasOwn(live[kind], id) ? live[kind][id] : undefined) !==
          JSON.stringify(Object.hasOwn(baseline[kind], id) ? baseline[kind][id] : undefined)) {
        throw new Error('This meaning or vocabulary group changed in the repository. Reload before editing it.')
      }
      live[kind][id] = value
    }
  }
  return live
}

export function assertVocabularyRow(raw, baselineRaw, category, line) {
  const baseline = ownLines(parseVocabularyFile(baselineRaw), category)
  const remote = ownLines(parseVocabularyFile(raw), category)
  if (baseline.includes(line) && !remote.includes(line)) {
    throw new Error('This vocabulary line changed in the repository. Reload before editing it.')
  }
}

// Preserve the older form links when ordinary text edits move or correct a row.
export function reviseVocabularyGroup(group, previousLine, { category, line }) {
  const previous = vocabularyLineParts(previousLine).forms.map(text => normalizeHint(text))
  const updated = vocabularyLineParts(line).forms
  const byName = new Map(updated.map(text => [normalizeHint(text), text]))
  const previousNames = new Set(previous)
  const changed = previous.length === updated.length
    ? updated.map((text, index) => ({ text, oldName: previous[index] }))
      .filter(({ text, oldName }) => normalizeHint(text) !== oldName)
    : []
  const correction = changed.length === 1 && !byName.has(changed[0].oldName) &&
      !previousNames.has(normalizeHint(changed[0].text)) ? changed[0] : null

  const forms = group.forms.flatMap(form => {
    const name = normalizeHint(form.text)
    if (!previousNames.has(name)) return []
    const text = byName.get(name) ?? (correction?.oldName === name ? correction.text : undefined)
    return text === undefined ? [] : [{ ...form, text }]
  })
  const next = { language: group.language, category, line, forms }
  if (group.meanings) next.meanings = group.meanings
  return next
}

export function createVocabularyHintIndex(rows, target, catalog, source, translations = new Map()) {
  const byEnglish = new Map()
  const byPhrase = new Map()
  const byMeaning = new Map()
  const byRow = new Map()
  const exactRows = new Map()
  const rowsByCategory = new Map()
  const put = (map, key, value) => {
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(value)
  }
  for (const row of rows) {
    const { hints, forms } = vocabularyLineParts(row.line)
    if (!forms.length) continue
    put(exactRows, rowKey(row.category, row.line), row)
    put(rowsByCategory, row.category, { row, hints, forms })
    for (const hint of hints) put(byEnglish, normalizeHint(hint, 'en'), row)
  }
  const groups = Object.entries(catalog.groups).filter(([, group]) => group.language === target)
  // A saved group can override a seeded group on the same row.
  for (const [id, group] of groups) {
    const exact = exactRows.get(rowKey(group.category, group.line))
    let row = exact?.[0]
    if (!row) {
      // Text-file edits can change the cue or the forms. Recover the link
      // when the unchanged parts uniquely identify the same row.
      const { hints, forms } = vocabularyLineParts(group.line)
      const phraseKey = phrases => JSON.stringify(phrases.map(phrase => normalizeHint(phrase, 'en')).sort())
      const hintKey = phraseKey(hints)
      const formSignature = texts => JSON.stringify(texts.map(formKey).sort())
      const previousForms = formSignature(forms)
      const linkTexts = group.meanings?.length ? forms : group.forms.filter(form => form.meanings.length).map(form => form.text)
      const linkedForms = new Set(linkTexts.map(formKey).filter(Boolean))
      const candidates = (rowsByCategory.get(group.category) || []).filter(entry =>
        formSignature(entry.forms) === previousForms ||
        (hints.length && phraseKey(entry.hints) === hintKey && entry.forms.some(form => linkedForms.has(formKey(form)))))
      if (candidates.length === 1) row = candidates[0].row
    }
    if (row) byRow.set(row.index, { id, ...group, row })
  }
  for (const [english, matchingRows] of byEnglish) {
    if (source === 'en') {
      for (const row of matchingRows) put(byPhrase, english, { row })
      continue
    }
    const aliases = translations.get(english)
    if (!aliases) continue
    for (const row of matchingRows) {
      const local = byRow.get(row.index)?.meanings
      // An explicit group hint can give this row a narrower meaning.
      if (local?.some(id => catalog.meanings[id]?.hints[source] !== undefined)) continue
      for (const alias of aliases) put(byPhrase, normalizeHint(alias, source), { row, sharedAliases: aliases })
    }
  }
  for (const group of byRow.values()) {
    for (const meaning of group.meanings || []) put(byMeaning, meaning, { row: group.row })
    const available = new Set(vocabularyLineParts(group.row.line).forms.map(text => normalizeHint(text)))
    for (const form of group.forms) {
      const key = normalizeHint(form.text)
      if (!key || !available.has(key)) continue
      for (const meaning of form.meanings) put(byMeaning, meaning, { row: group.row, form: key })
    }
  }
  for (const [id, meaning] of Object.entries(catalog.meanings)) {
    const links = byMeaning.get(id)
    if (!links) continue
    const aliases = meaning.hints[source] || []
    for (const hint of aliases) {
      const key = normalizeHint(hint, source)
      if (key) for (const link of links) put(byPhrase, key, { ...link, meaning: id, aliases })
    }
  }
  return {
    groupFor: index => byRow.get(index),
    search(query) {
      const results = new Map()
      for (const term of query.split('|')) {
        const key = normalizeHint(term, source)
        if (!key) continue
        for (const hit of byPhrase.get(key) || []) {
          const rowKeyValue = rowKey(hit.row.category, hit.row.line)
          if (!results.has(rowKeyValue)) {
            results.set(rowKeyValue, { ...hit.row, kind: 'hint', forms: new Set(), meanings: new Set(),
              aliases: new Map(), sharedAliases: new Map(), matchedAliases: new Set() })
          }
          const result = results.get(rowKeyValue)
          if (hit.form) result.forms.add(hit.form)
          if (hit.meaning) result.meanings.add(hit.meaning)
          if (source !== 'en') {
            const spellingMap = hit.sharedAliases ? result.sharedAliases : result.aliases
            for (const alias of hit.sharedAliases || hit.aliases || []) {
              const aliasKey = normalizeHint(alias, source)
              if (!spellingMap.has(aliasKey)) spellingMap.set(aliasKey, alias)
              if (aliasKey === key) result.matchedAliases.add(aliasKey)
            }
          }
        }
      }
      return [...results.values()].map(({ aliases, sharedAliases, matchedAliases, ...result }) => {
        const spellings = sharedAliases.size ? sharedAliases : aliases
        const localizedHints = [...matchedAliases].filter(key => spellings.has(key)).map(key => spellings.get(key))
        for (const [key, alias] of spellings) if (!matchedAliases.has(key)) localizedHints.push(alias)
        return { ...result, localizedHints }
      })
    },
  }
}

export function vocabularyFormKey(form) { return formKey(form) }
