// Pure vocabulary parse/serialize/merge helpers. The vocabulary file is
// a category-bucketed text file:
//
//   #Verbs
//   (preserve)|förvara|förvarade|förvarar|
//   (eat)|äta|åt|ätit|
//   #Adjectives
//   (big)|stor|stort|stora|
//
// Each "#Name" line opens a new category bucket; the following non-#
// lines belong to it. `mergeVocabulary` is a 3-way merge: baseText is
// what we previously loaded, localVocab is the in-memory state, and
// remoteText is the live remote — local intent wins over remote churn.

// Parse vocabulary text into a { [category]: [line, ...] } map.
// Lines before the first `#category` header land under the special
// '__empty__' bucket — callers like `mergeVocabulary` strip that bucket
// before merging. Returns an empty object for empty input.
// The map has no prototype, so a header such as `#toString` or `#__proto__`
// is an ordinary category.
export function parseVocabularyFile(text) {
  const out = Object.create(null)
  if (!text) return out
  const lines = String(text).split('\n')
  let currentCategory = '__empty__'
  out[currentCategory] = []
  for (const line of lines) {
    if (line.startsWith('#')) {
      currentCategory = line.replace('#', '').trim()
      out[currentCategory] = []
    } else {
      out[currentCategory].push(line)
    }
  }
  return out
}

// The lines of `cat` in a category map, read as an own key only (so a plain
// object's `toString` or `constructor` is never taken for a category).
export function ownLines(vocab, cat) {
  return (vocab && Object.prototype.hasOwnProperty.call(vocab, cat) && vocab[cat]) || []
}

// Render a { [category]: [line, ...] } map back into vocabulary text.
// Categories appear in their object-iteration order (which in JS is
// insertion order for string keys). Each category's lines are joined
// with newlines and prefixed with the `#header` line.
export function vocabularyToText(vocab) {
  return Object.keys(vocab)
    .map(k => `#${k}\n${vocab[k].join('\n')}`).join('\n')
}

// Bracket-balance check across the line, validated per `|`-segment so a
// hint group like `(spell)` in one segment can't accidentally cancel an
// unbalanced one in another. Returns true when every segment has matched
// pairs of `()`, `[]`, and `{}`.
export function isProperlyBracketed(line) {
  const parts = String(line).split('|')
  const closeToOpen = { ')': '(', ']': '[', '}': '{' }
  return parts.every(part => {
    const stack = []
    for (const ch of part) {
      if ('([{'.includes(ch)) stack.push(ch)
      else if (')]}'.includes(ch)) {
        if (stack.pop() !== closeToOpen[ch]) return false
      }
    }
    return stack.length === 0
  })
}

// 3-way merge of categorised vocabulary files.
//   base = the text we previously loaded
//   localVocab = the in-memory current state (parsed shape)
//   remoteText = the latest from remote
//
// Per category:
//   * Local order leads. Lines added locally (not in base) are kept.
//   * Base lines still on remote are kept.
//   * Base lines removed on remote get dropped (the user didn't
//     intentionally re-add them since).
//   * Remote-only additions are appended at the end, skipping any line
//     we intentionally deleted locally (base had it, local doesn't).
//
// The special '__empty__' bucket (lines parsed before the first
// `#category` header) is dropped from the result.
export function mergeVocabulary(baseText, localVocab, remoteText) {
  const base = parseVocabularyFile(baseText || '#__empty__\n')
  const remote = parseVocabularyFile(remoteText || '#__empty__\n')
  const local = localVocab || {}
  const merged = Object.create(null)
  const allCats = new Set([
    ...Object.keys(base),
    ...Object.keys(remote),
    ...Object.keys(local),
  ])
  for (const cat of allCats) {
    if (cat === '__empty__') continue
    const baseLines = ownLines(base, cat)
    const remoteLines = ownLines(remote, cat)
    const localLines = ownLines(local, cat)
    const baseSet = new Set(baseLines)
    const remoteSet = new Set(remoteLines)
    const localSet = new Set(localLines)

    const out = []
    const seen = new Set()
    for (const l of localLines) {
      const userAdded = !baseSet.has(l)
      const stillInRemote = remoteSet.has(l)
      if ((userAdded || stillInRemote) && !seen.has(l)) {
        seen.add(l); out.push(l)
      }
    }
    for (const l of remoteLines) {
      if (seen.has(l)) continue
      const removedLocally = baseSet.has(l) && !localSet.has(l)
      if (!removedLocally) { seen.add(l); out.push(l) }
    }
    merged[cat] = out
  }
  return merged
}

// Remove one line from a category of a vocabulary map, for "Delete line" in
// the add-to-vocabulary dialog. `occurrence` picks which copy when the
// category holds the same text more than once (0 = the first).
// Returns { vocab } — a new map (same category order; only the touched
// category gets a new array; the input is not changed) — or { reason }:
//   'blank'     — no line, or a blank (separator) line
//   'read-only' — the line is in `readOnly` (the other user's; never saved)
//   'not-found' — the category doesn't hold that copy of the line
// A category left with no lines is kept, empty: its header stays in the
// file (the 3-way merge keeps a category's header whenever base or remote
// has it anyway), and keeping the key is what puts the deletion in the
// unsaved-edits buffer.
export function removeVocabularyLine(vocab, readOnly, category, line, occurrence = 0) {
  if (typeof line !== 'string' || !line.trim()) return { reason: 'blank' }
  if (readOnly && readOnly.has(line)) return { reason: 'read-only' }
  const lines = ownLines(vocab, category)
  let at = -1
  for (let i = 0, seen = 0; i < lines.length; i++) {
    if (lines[i] !== line) continue
    if (seen === occurrence) { at = i; break }
    seen++
  }
  if (at < 0) return { reason: 'not-found' }
  const out = Object.create(null)
  for (const cat of Object.keys(vocab)) {
    out[cat] = cat === category ? lines.filter((_, i) => i !== at) : vocab[cat]
  }
  return { vocab: out }
}

// The "unsaved changes pending" hint in the add-to-vocabulary dialog, from
// the counts of lines added and deleted since the last save. With neither
// known (e.g. replayed from an older buffer) it gives no number.
export function vocabPendingHintText(added, deleted) {
  const a = Math.max(0, parseInt(added, 10) || 0)
  const d = Math.max(0, parseInt(deleted, 10) || 0)
  const parts = []
  if (a > 0) parts.push(`${a} new entr${a === 1 ? 'y' : 'ies'}`)
  if (d > 0) parts.push(`${d} deleted`)
  const countPart = parts.length ? ` — ${parts.join(', ')}` : ''
  return `unsaved changes pending${countPart} — Save & Close to commit`
}
