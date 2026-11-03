import { parseWordMaps } from './word-maps-sync.js'
import { readMap } from './word-map-model.js'

export const MAP_RECORDS_FORMAT = 'cupitor-word-map-records-v1'
const normalized = word => String(word || '').trim().toLocaleLowerCase()

// One word lookup per displayed node; no whole-library scan during redraws.
export function createWordMapIndex(maps = []) {
  const byWord = new Map(), byId = new Map(), wordsByMap = new Map(), order = new Map(), relatedIds = new Map()
  let nextOrder=0
  const remove = id => {
    for (const word of wordsByMap.get(id) || []) {
      relatedIds.delete(word)
      const matches = byWord.get(word)
      matches.delete(id)
      if (!matches.size) byWord.delete(word)
    }
    wordsByMap.delete(id); byId.delete(id)
  }
  const update = map => {
    if(!order.has(map.id))order.set(map.id,nextOrder++)
    remove(map.id); byId.set(map.id, map)
    const words = new Set()
    for (const node of map.nodes) {
      const word = normalized(node.word)
      if (!word) continue
      relatedIds.delete(word)
      words.add(word)
      if (!byWord.has(word)) byWord.set(word, new Map())
      const matches = byWord.get(word)
      if (!matches.has(map.id)) matches.set(map.id, [])
      matches.get(map.id).push(node.id)
    }
    wordsByMap.set(map.id, words)
  }
  maps.forEach(update)
  return { update, remove(id){remove(id);order.delete(id)},
    count(word, except) { const matches=byWord.get(normalized(word));return (matches?.size||0)-(matches?.has(except)?1:0) },
    related(word, except, limit=Infinity, offset=0) {
      const key=normalized(word)
      if(!relatedIds.has(key))relatedIds.set(key,[...(byWord.get(key)?.keys()||[])].sort((a,b)=>order.get(a)-order.get(b)))
      const matches=[];let skipped=0
      for(const id of relatedIds.get(key)){
        if(id===except)continue
        if(skipped++<offset)continue
        if(matches.length>=limit)break
        matches.push(byId.get(id))
      }
      return matches
    },
    nodes(word, mapId) { return byWord.get(normalized(word))?.get(mapId) || [] },
  }
}

// Keep existing JSON APIs readable, while persisting only changed map records.
// The directory and changed records share the user-data store's transaction.
export function withWordMapRecords(storage, mapKeys) {
  const keys = new Set(mapKeys), cache = new Map()
  const recordKey = (key, id) => key + ':map:' + encodeURIComponent(id)
  const readRaw = storage.getItem.bind(storage)
  const readMaps = key => {
    const raw = readRaw(key), previous = cache.get(key)
    if (previous?.raw === raw) return previous.maps
    let maps
    if (!raw) maps = []
    else {
      const data = JSON.parse(raw)
      if (data?.format === MAP_RECORDS_FORMAT) {
        if (!Array.isArray(data.ids) || new Set(data.ids).size !== data.ids.length)
          throw new Error('Invalid saved word-map directory')
        maps = data.ids.map(id => {
          if (typeof id !== 'string' || !id) throw new Error('Invalid saved word-map id')
          const record = readRaw(recordKey(key, id))
          if (!record) throw new Error('A saved word-map record is missing. Export device data before recovery.')
          const map = readMap(record)
          if (map.id !== id) throw new Error('A saved word-map identity does not match its directory')
          return map
        })
      } else maps = parseWordMaps(data)
    }
    cache.set(key, {raw, maps})
    return maps
  }
  const view = Object.create(storage)
  view.readMaps = readMaps
  view.saveMaps = (key, maps, changedId = null) => {
    keys.add(key)
    const before = readMaps(key), data = JSON.parse(readRaw(key) || 'null')
    const split = data?.format === MAP_RECORDS_FORMAT
    const ids = maps.map(map => map.id)
    if (new Set(ids).size !== ids.length) throw new Error('Word-map ids must be unique')
    const old = new Set(before.map(map => map.id))
    const nextById = new Map(before.map(map => [map.id, map]))
    for (const map of maps) {
      if (!split || changedId == null || map.id === changedId || !old.has(map.id)) {
        const next = readMap(map)
        storage.setItem(recordKey(key, map.id), JSON.stringify(next))
        nextById.set(map.id, next)
      }
      old.delete(map.id)
    }
    for (const id of old) storage.removeItem(recordKey(key, id))
    storage.setItem(key, JSON.stringify({format:MAP_RECORDS_FORMAT,ids}))
    cache.set(key, {raw:readRaw(key), maps:ids.map(id => nextById.get(id))})
  }
  view.getItem = key => {
    const raw = readRaw(key)
    if (keys.has(key) && raw && JSON.parse(raw)?.format === MAP_RECORDS_FORMAT)
      return JSON.stringify(readMaps(key))
    return raw
  }
  // Existing sync/import callers supply a whole collection; normal editing
  // uses saveMaps with the changed id and avoids serializing other maps.
  view.setItem = (key, value) => keys.has(key)
    ? view.saveMaps(key, parseWordMaps(value)) : storage.setItem(key, value)
  view.removeItem = key => {
    if (keys.has(key)) for (const map of readMaps(key)) storage.removeItem(recordKey(key, map.id))
    cache.delete(key); storage.removeItem(key)
  }
  view.importData = async (...args) => { try { await storage.importData(...args) } finally { cache.clear() } }
  return view
}
