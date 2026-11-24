// Entry markers live in vocabulary.txt, but never in visible/searchable text.
// Keep the marker when editing the file by hand; omit it on new entries.
const identities = new WeakMap()
const marker = /\t\[entry:([a-z0-9-]{1,80})\]\r?$/u
const keyFor = (category, line) => JSON.stringify([category, line])

export function splitVocabularyEntry(raw) {
  const match = raw.match(marker)
  if (/\t\[entry:/u.test(raw) && !match) throw new Error('Invalid vocabulary entry ID.')
  return match ? { line: raw.slice(0, match.index), id: match[1] } : { line: raw }
}

export function vocabularyEntryId(vocab, category, line, occurrence = 0) {
  return identities.get(vocab)?.get(keyFor(category, line))?.[occurrence]
}

export function setVocabularyEntryId(vocab, category, line, id, occurrence = 0) {
  if (!/^[a-z0-9-]{1,80}$/u.test(id)) throw new Error('Invalid vocabulary entry ID.')
  if (!identities.has(vocab)) identities.set(vocab, new Map())
  const ids = identities.get(vocab)
  const key = keyFor(category, line)
  if (!ids.has(key)) ids.set(key, [])
  ids.get(key)[occurrence] = id
}

export function vocabularyEntries(vocab) {
  const entries = []
  for (const [category, lines] of Object.entries(vocab || {})) {
    const counts = new Map()
    for (const line of lines) {
      const occurrence = counts.get(line) || 0
      counts.set(line, occurrence + 1)
      entries.push({ category, line, occurrence, id: vocabularyEntryId(vocab, category, line, occurrence) })
    }
  }
  return entries
}

export function copyVocabularyEntryIds(from, to) {
  for (const entry of vocabularyEntries(to)) {
    const id = vocabularyEntryId(from, entry.category, entry.line, entry.occurrence)
    if (id) setVocabularyEntryId(to, entry.category, entry.line, id, entry.occurrence)
  }
  return to
}

export function restoreVocabularyEntryIds(vocab, entries = []) {
  for (const entry of entries) {
    if (entry.id && vocab[entry.category]?.filter(line => line === entry.line).length > entry.occurrence) {
      setVocabularyEntryId(vocab, entry.category, entry.line, entry.id, entry.occurrence)
    }
  }
}

export function newVocabularyEntryId() {
  // getRandomValues also works in older native WebViews without randomUUID.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return 'entry-' + [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function identifyNewVocabularyEntries(vocab) {
  for (const entry of vocabularyEntries(vocab)) {
    if (entry.line.trim() && entry.category !== '__empty__' && !entry.id) {
      setVocabularyEntryId(vocab, entry.category, entry.line, newVocabularyEntryId(), entry.occurrence)
    }
  }
  return vocab
}

// Deterministic first adoption lets two clients open the same legacy file.
// Once persisted, this ID is carried forward; it is never recalculated on edit.
export async function adoptVocabularyEntryIds(vocab, language) {
  await Promise.all(vocabularyEntries(vocab).map(async entry => {
    if (!entry.line.trim() || entry.category === '__empty__' || entry.id) return
    const bytes = new TextEncoder().encode(JSON.stringify([language, entry.category, entry.line, entry.occurrence]))
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    const id = 'entry-' + [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    setVocabularyEntryId(vocab, entry.category, entry.line, id, entry.occurrence)
  }))
  return vocab
}

export function assertUniqueVocabularyEntryIds(vocab) {
  const seen = new Set()
  for (const { id } of vocabularyEntries(vocab)) {
    if (!id) continue
    if (seen.has(id)) throw new Error('Duplicate vocabulary entry ID. Remove the copied marker to create a new entry.')
    seen.add(id)
  }
}

// Identity-aware 3-way merge. Text-only legacy files use the older merger.
export function mergeIdentifiedVocabulary(base, local, remote) {
  const rowKey = entry => keyFor(entry.category, entry.line)
  const baseRows = vocabularyEntries(base).filter(e => e.category !== '__empty__')
  const oldByText = new Map()
  for (const entry of baseRows) {
    const key = rowKey(entry)
    if (!oldByText.has(key)) oldByText.set(key, [])
    oldByText.get(key).push(entry)
  }
  const index = vocab => {
    assertUniqueVocabularyEntryIds(vocab)
    const rows = vocabularyEntries(vocab).filter(e => e.category !== '__empty__')
    const counts = new Map()
    for (const entry of rows) counts.set(rowKey(entry), (counts.get(rowKey(entry)) || 0) + 1)
    return new Map(rows.map(entry => {
      const previous = oldByText.get(rowKey(entry)) || []
      if (!entry.id && previous.length > 1 && previous.some(row => row.id) && previous.length !== counts.get(rowKey(entry))) {
        throw new Error('Duplicate legacy vocabulary rows changed ambiguously. Reload before saving.')
      }
      const id = entry.id || previous[entry.occurrence]?.id
      return [id || 'text:' + JSON.stringify([entry.category, entry.line, entry.occurrence]), { ...entry, id }]
    }))
  }
  const b = index(base), l = index(local), r = index(remote)
  const chosen = new Map()
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const before = b.get(id), mine = l.get(id), theirs = r.get(id)
    const same = (a, c) => a && c && rowKey(a) === rowKey(c)
    if (!before) {
      if (mine && theirs && !same(mine, theirs)) throw new Error('This new vocabulary entry changed in the repository. Reload before saving.')
      chosen.set(id, mine || theirs); continue
    }
    if (mine && theirs) {
      if (!same(mine, before) && !same(theirs, before) && !same(mine, theirs)) {
        throw new Error('This vocabulary entry changed in the repository. Reload before editing it.')
      }
      chosen.set(id, same(mine, before) ? theirs : mine)
    } else if ((mine && !same(mine, before)) || (theirs && !same(theirs, before))) {
      throw new Error('This vocabulary entry was edited and deleted concurrently. Reload before saving.')
    }
  }
  const out = Object.create(null)
  for (const category of new Set([...Object.keys(base), ...Object.keys(remote), ...Object.keys(local)])) {
    if (category !== '__empty__') out[category] = []
  }
  const seen = new Set()
  for (const id of [...l.keys(), ...r.keys()]) {
    if (seen.has(id) || !chosen.has(id)) continue
    seen.add(id)
    const entry = chosen.get(id)
    const occurrence = out[entry.category].filter(line => line === entry.line).length
    out[entry.category].push(entry.line)
    if (entry.id) setVocabularyEntryId(out, entry.category, entry.line, entry.id, occurrence)
  }
  return out
}

// The vocabulary dialog edits string arrays. Move their identities in the
// same splice, including duplicate lines; only a one-to-one edit reuses an ID.
export function spliceVocabularyEntries(vocab, category, start, count, inserted) {
  const lines = vocab[category]
  const counts = new Map()
  const ids = lines.map(line => {
    const occurrence = counts.get(line) || 0
    counts.set(line, occurrence + 1)
    return vocabularyEntryId(vocab, category, line, occurrence)
  })
  const replacement = count === 1 && inserted.length === 1 ? ids[start] : undefined
  lines.splice(start, count, ...inserted)
  ids.splice(start, count, ...inserted.map((line, index) => line.trim() ? replacement || newVocabularyEntryId() : undefined))
  const saved = vocabularyEntries(vocab).filter(entry => entry.category !== category)
  identities.set(vocab, new Map())
  restoreVocabularyEntryIds(vocab, saved)
  counts.clear()
  lines.forEach((line, index) => {
    const occurrence = counts.get(line) || 0
    counts.set(line, occurrence + 1)
    if (ids[index]) setVocabularyEntryId(vocab, category, line, ids[index], occurrence)
  })
}
