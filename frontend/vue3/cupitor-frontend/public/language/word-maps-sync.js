import { readMap, newId } from './word-map-model.js'
import { sameJson } from './recordings-3way.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
export function parseWordMaps(text) {
  if (text == null) return []
  const value = typeof text === 'string' ? JSON.parse(text) : text
  const maps = Array.isArray(value) ? value : value?.version === 1 ? value.maps : null
  if (!Array.isArray(maps)) throw new Error('Invalid word maps file')
  const ids = new Set()
  return maps.map((map) => {
    if (!map || typeof map.id !== 'string' || !map.id || ids.has(map.id))
      throw new Error('Word maps must have unique, stable ids')
    ids.add(map.id)
    return readMap(map)
  })
}
const keyed = (maps) => new Map((maps || []).map((map) => [map.id, map]))
export function mergeWordMaps(base, local, remote) {
  const b = keyed(base),
    l = keyed(local),
    r = keyed(remote),
    maps = [],
    conflicts = []
  for (const id of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
    const before = b.get(id) || null,
      here = l.get(id) || null,
      there = r.get(id) || null
    let result
    if (sameJson(here, there)) result = here
    else if (sameJson(here, before)) result = there
    else if (sameJson(there, before)) result = here
    else {
      conflicts.push({ id, base: before, local: here, remote: there })
      continue
    }
    if (result) maps.push(result)
  }
  return { maps, conflicts }
}
const encoded = (maps) => JSON.stringify({ version: 1, maps }, null, 2) + '\n'
export const cancelledSync = () =>
  Object.assign(new Error('Sync cancelled; local changes are kept.'), {
    code: 'word-maps-sync-cancelled',
  })

// The commit callback re-merges against the exact GitHub head on every retry.
// Baselines are independent of the local cache and scoped to repo + branch.
export function createWordMapSync({
  storageKey,
  sourceKey,
  storage = localStorage,
  readFile,
  commitFile,
  resolveConflicts,
}) {
  const baseKey = storageKey + ':base:' + sourceKey
  let base = null,
    baseError = null,
    busy = false
  try {
    const raw = storage.getItem(baseKey)
    if (raw != null) base = parseWordMaps(raw)
  } catch (_) {
    baseError = new Error(
      'The saved sync baseline could not be read. Export your maps before recovering the stored data.'
    )
  }
  const saveBase = (maps) => {
    storage.setItem(baseKey, encoded(maps))
    base = clone(maps)
  }
  const normalize = (maps) => parseWordMaps(clone(maps))
  const check = () => {
    if (baseError) throw baseError
    if (busy) throw new Error('Word maps are already syncing')
  }
  return {
    dirty(maps) {
      return !sameJson(keyedObject(normalize(maps)), keyedObject(base || []))
    },
    async pull(getMaps, adopt) {
      check()
      busy = true
      try {
        const remote = parseWordMaps(await readFile())
        const local = normalize(getMaps())
        const result = mergeWordMaps(base || [], local, remote)
        // On load, defer conflicting edits/deletions to Sync. Retain their
        // old baseline so a later push cannot silently overwrite either side.
        const nextBase = keyed(remote)
        for (const conflict of result.conflicts) {
          if (conflict.local) result.maps.push(conflict.local)
          if (conflict.base) nextBase.set(conflict.id, conflict.base)
          else nextBase.delete(conflict.id)
        }
        adopt(clone(result.maps))
        saveBase([...nextBase.values()])
        return { conflicts: result.conflicts.length }
      } finally {
        busy = false
      }
    },
    async push(getMaps, adopt) {
      check()
      const snapshot = normalize(getMaps()),
        initialBase = clone(base || []),
        choices = new Map()
      busy = true
      let pushed
      try {
        await commitFile(async (text) => {
          const remote = parseWordMaps(text),
            result = mergeWordMaps(initialBase, snapshot, remote)
          if (result.conflicts.length) {
            const unknown = result.conflicts.filter((c) => !choices.has(JSON.stringify(c)))
            if (unknown.length) {
              const answers = await resolveConflicts(unknown)
              if (!answers) throw cancelledSync()
              for (const c of unknown) {
                const answer = answers[c.id]
                if (
                  !['local', 'remote', 'both'].includes(answer) ||
                  (answer === 'both' && (!c.local || !c.remote))
                )
                  throw cancelledSync()
                choices.set(JSON.stringify(c), { answer, copyId: newId() })
              }
            }
            for (const c of result.conflicts) {
              const { answer, copyId } = choices.get(JSON.stringify(c))
              const value = answer === 'remote' ? c.remote : c.local
              if (value) result.maps.push(value)
              if (answer === 'both')
                result.maps.push({
                  ...clone(c.remote),
                  id: copyId,
                  name: c.remote.name + ' (from GitHub)',
                })
            }
          }
          pushed = normalize(result.maps)
          return encoded(pushed)
        })
        if (!pushed) throw new Error('GitHub did not confirm a word maps commit')
        // Do not mark edits made during a slow upload as synced or erase them.
        const current = normalize(getMaps()),
          next = mergeWordMaps(snapshot, current, pushed)
        for (const c of next.conflicts) if (c.local) next.maps.push(c.local)
        adopt(clone(next.maps))
        saveBase(pushed)
        return { dirty: this.dirty(next.maps) }
      } finally {
        busy = false
      }
    },
  }
}
function keyedObject(maps) {
  return Object.fromEntries(maps.map((map) => [map.id, map]))
}
