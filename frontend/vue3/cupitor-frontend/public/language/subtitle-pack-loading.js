import { runInBatches } from './net.js'

// Group the missing entries, not the full index: cache hits and index ordering
// remain unchanged. Owner/repository, physical path and revision are separate
// download identities. Loose SRTs retain the individual-file loading path.
export async function loadSubtitlePacks(entries, {
  loader, baseUrl, code, commitBatch, loadLoose, assertCurrent = () => {},
  onFailure = () => {}, onProgress = () => {}, concurrency = 4,
  maxDocuments = 32, maxBytes = 2 * 1024 * 1024,
}) {
  const groups = new Map()
  for (const entry of entries) {
    const base = baseUrl(entry)
    const key = entry.bundle ? JSON.stringify([base, entry.bundle, entry.bundleRevision || 1]) : Symbol()
    if (!groups.has(key)) groups.set(key, { base, entries: [] })
    groups.get(key).entries.push(entry)
  }
  let completed = 0, stopped = null
  const check = () => { assertCurrent(); if (stopped) throw stopped }
  const progress = count => { completed += count; onProgress(completed, entries.length) }
  const fail = (items, error) => {
    check()
    for (const entry of items) onFailure(entry, error)
    progress(items.length)
  }
  const results = await runInBatches([...groups.values()], async group => {
    check()
    if (!group.entries[0].bundle) {
      try { await loadLoose(group.entries[0]) }
      catch (error) { fail(group.entries, error); return }
      check(); progress(1); return
    }
    let files
    try { files = await loader.bundle(group.entries[0], group.base) }
    catch (error) { fail(group.entries, error); return }
    check()
    let batch = [], bytes = 0
    const flush = async () => {
      if (!batch.length) return
      check()
      const rows = batch; batch = []; bytes = 0
      try { await commitBatch(rows); check(); progress(rows.length) }
      catch (error) {
        // Without an acknowledgement, raw documents remain pinned. Stop all
        // lanes before staging more packs, keeping failed imports bounded.
        stopped ||= error
        throw error
      }
    }
    for (const entry of group.entries) {
      check()
      const name = entry.bundleKey || entry.name
      const sv = Object.hasOwn(files, name + '.' + code + '.srt') ? files[name + '.' + code + '.srt'] : null
      const en = Object.hasOwn(files, name + '.en.srt') ? files[name + '.en.srt'] : null
      if (sv == null) {
        fail([entry], Object.assign(new Error('Subtitle track is absent from bundle'), {kind: 'notfound'}))
        continue
      }
      const size = 2 * (sv.length + (en?.length || 0))
      if (batch.length && (batch.length >= maxDocuments || bytes + size > maxBytes)) await flush()
      batch.push({entry, sv, en}); bytes += size
    }
    await flush()
  }, concurrency)
  // runInBatches settles individual jobs; source changes and callback failures
  // must still reject the import instead of declaring a stale load complete.
  const rejected = results.find(result => result.status === 'rejected')
  if (rejected) throw rejected.reason
}
