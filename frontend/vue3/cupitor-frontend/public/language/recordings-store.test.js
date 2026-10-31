import { createHash } from 'crypto'
import { TextEncoder } from 'util'
import { parseRecordingsRoot, readRecordings, loadRecordingsFiles, splitRecordings, syncRecordingsFiles, RECORDINGS_PART_BYTES } from './recordings-store.js'

global.TextEncoder = TextEncoder
const digest = text => createHash('sha256').update(text).digest('hex')
const options = { maxBytes: 260, digest }
const collection = () => ({
  'Scener / färg 🎨': { createdAt: 1, updatedAt: 2, shuffle: true, items: {
    'färgsprakande': { 'sprakande': Array.from({ length: 9 }, (_, i) => ({ id: 'v' + i, lineIndex: i, html: '<b>Blå & grön</b>', enabled: i % 2 === 0 })) },
    'empty': { word: [] }, 'empty section': {}
  } },
  'Manual': { items: { Manual: { Card: [{ manual: true, source: '<p>Hej!</p>', target: 'Hi', audio: [{ url: 'sound.mp3' }] }] } } },
  'All': { virtual: true, members: ['Scener / färg 🎨', 'Manual'], updatedAt: 3 },
  'Empty': { items: {} }
})
const readSplit = split => readRecordings(parseRecordingsRoot(split.text), path => {
  if (!split.files.has(path)) throw new Error('missing')
  return split.files.get(path)
})

test('legacy collections still load without part requests', async () => {
  const coll = collection(), read = jest.fn()
  expect(await readRecordings(parseRecordingsRoot(JSON.stringify(coll)), read)).toEqual(coll)
  expect(read).not.toHaveBeenCalled()
  expect(parseRecordingsRoot(null)).toEqual({})
  for (const bad of ['', '[]', 'null', '{bad']) expect(() => parseRecordingsRoot(bad)).toThrow()
})

test('split/reassemble preserves cards, order, metadata, virtual playlists and empty buckets', async () => {
  const coll = collection(), split = await splitRecordings(coll, options)
  expect(split.files.size).toBeGreaterThan(3)
  for (const text of split.files.values()) expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(options.maxBytes)
  expect(await readSplit(split)).toEqual(coll)
  expect(collection()).toEqual(coll)
})

test('unchanged playlists keep the same part names', async () => {
  const coll = collection(), first = await splitRecordings(coll, options)
  coll.Empty.items = { new: { word: [{ id: 'new' }] } }
  const second = await splitRecordings(coll, options)
  const before = JSON.parse(first.text).playlists[0].parts
  expect(JSON.parse(second.text).playlists[0].parts).toEqual(before)
})

test('a multi-megabyte legacy collection becomes a small root and bounded parts', async () => {
  const coll = { Large: { items: { search: { word: Array.from({ length: 6000 }, (_, i) => ({ id: String(i), source: 'ö'.repeat(100) })) } } } }
  const split = await splitRecordings(coll, { digest })
  expect(Buffer.byteLength(JSON.stringify(coll))).toBeGreaterThan(1024 * 1024)
  expect(Buffer.byteLength(split.text)).toBeLessThan(10000)
  for (const text of split.files.values()) expect(Buffer.byteLength(text)).toBeLessThanOrEqual(RECORDINGS_PART_BYTES)
  expect(await readSplit(split)).toEqual(coll)
})

test('a missing, malformed or unsafe part fails the whole read', async () => {
  const split = await splitRecordings(collection(), options)
  const root = JSON.parse(split.text)
  await expect(readRecordings(root, () => { throw new Error('missing') })).rejects.toThrow('missing')
  await expect(readRecordings(root, () => 'null')).rejects.toThrow('Invalid recordings part')
  root.playlists[0].parts[0] = '../other-file.json'
  const read = jest.fn()
  await expect(readRecordings(root, read)).rejects.toThrow('Invalid recordings part path')
  expect(read).not.toHaveBeenCalled()
})

test('sync migrates the root and new parts in one commit, then skips unchanged parts', async () => {
  const coll = collection(), disk = new Map([['recordings.json', JSON.stringify(coll)]])
  const commitFiles = jest.fn(async files => {
    const updates = await Promise.all(files.map(async f => [f.path, await f.getContent(disk.get(f.path) ?? null)]))
    updates.forEach(([path, text]) => disk.set(path, text))
  })
  const args = { readFile: path => disk.get(path) ?? null, commitFiles, merge: remote => remote, splitOptions: options }
  expect(await syncRecordingsFiles(args)).toEqual(coll)
  expect(commitFiles).toHaveBeenCalledTimes(1)
  expect(commitFiles.mock.calls[0][0].length).toBeGreaterThan(2)
  expect(await syncRecordingsFiles(args)).toEqual(coll)
  expect(commitFiles.mock.calls[1][0].map(f => f.path)).toEqual(['recordings.json'])
})

test('a concurrent index edit reruns the merge without losing the other device additions', async () => {
  let disk = new Map([['recordings.json', JSON.stringify({ A: { items: {} } })]])
  let calls = 0
  const merge = jest.fn(remote => ({ ...remote, Local: { items: {} } }))
  const result = await syncRecordingsFiles({
    readFile: path => disk.get(path) ?? null, merge, splitOptions: options,
    commitFiles: async files => {
      if (++calls === 1) disk.set('recordings.json', JSON.stringify({ A: { items: {} }, OtherDevice: { items: {} } }))
      const updates = await Promise.all(files.map(async f => [f.path, await f.getContent(disk.get(f.path) ?? null)]))
      updates.forEach(([path, text]) => disk.set(path, text))
    }
  })
  expect(merge).toHaveBeenCalledTimes(2)
  expect(Object.keys(result)).toEqual(['A', 'OtherDevice', 'Local'])
  expect(await readRecordings(JSON.parse(disk.get('recordings.json')), path => disk.get(path))).toEqual(result)
})

test('read failures and oversized cards never publish a partial collection', async () => {
  const commitFiles = jest.fn()
  await expect(syncRecordingsFiles({ readFile: () => { throw new Error('offline') }, commitFiles, merge: x => x })).rejects.toThrow('offline')
  await expect(syncRecordingsFiles({ readFile: () => null, commitFiles, merge: () => collection(), splitOptions: { ...options, maxBytes: 30 } })).rejects.toThrow('exceeds')
  expect(commitFiles).not.toHaveBeenCalled()
})

// Realistic atomic delete handling: all guards resolve before any file moves.
function syncDisk(initial, now = 1) {
  const disk = new Map([['recordings.json', JSON.stringify(initial)]])
  const clock = { value: now }
  const commitFiles = jest.fn(async files => {
    const changes = await Promise.all(files.map(async f => [f.path, f.delete ? null : await f.getContent(disk.get(f.path) ?? null)]))
    changes.forEach(([path, text]) => text === null ? disk.delete(path) : disk.set(path, text))
  })
  return { disk, clock, commitFiles, args: {
    readFile: path => disk.get(path) ?? null, commitFiles, now: () => clock.value,
    listParts: jest.fn(async () => [...disk.keys()].filter(path => path.startsWith('recordings/'))),
    merge: remote => remote, splitOptions: { digest }
  } }
}
const simpleCards = id => ({ Playlist: { items: { search: { word: [{ id, lineIndex: 1, source: id }] } } } })
const retention = 7 * 24 * 60 * 60 * 1000

test('sync automatically marks obsolete parts, retains them for seven days, then atomically removes them', async () => {
  const h = syncDisk(simpleCards('first'))
  await syncRecordingsFiles(h.args)
  const first = JSON.parse(h.disk.get('recordings.json')).playlists[0].parts[0]
  h.clock.value = 2
  await syncRecordingsFiles({ ...h.args, merge: () => simpleCards('second') })
  const second = JSON.parse(h.disk.get('recordings.json')).playlists[0].parts[0]
  expect(h.disk.has(first)).toBe(true)
  expect(JSON.parse(h.disk.get('recordings.json')).retiredParts).toEqual({ [first]: 2 })
  h.clock.value = 2 + retention - 1
  await syncRecordingsFiles(h.args)
  expect(h.disk.has(first)).toBe(true)
  expect(JSON.parse(h.disk.get('recordings.json')).retiredParts[first]).toBe(2)
  h.clock.value++
  await syncRecordingsFiles(h.args)
  expect(h.disk.has(first)).toBe(false)
  expect(h.disk.has(second)).toBe(true)
  expect(JSON.parse(h.disk.get('recordings.json')).retiredParts).toBeUndefined()
  expect(h.commitFiles.mock.calls[3][0]).toEqual(expect.arrayContaining([{ path: first, delete: true }]))
  expect(await readRecordings(JSON.parse(h.disk.get('recordings.json')), p => h.disk.get(p))).toEqual(simpleCards('second'))
})

test('reused retired parts stay live, and discovery finds pre-cleanup orphans on a daily schedule', async () => {
  const h = syncDisk(simpleCards('first'))
  const orphan = 'recordings/' + 'f'.repeat(64) + '.json'
  h.disk.set(orphan, '["old orphan"]')
  h.disk.set('recordings/manual.json', 'unrelated')
  await syncRecordingsFiles(h.args)
  const first = JSON.parse(h.disk.get('recordings.json')).playlists[0].parts[0]
  await syncRecordingsFiles({ ...h.args, merge: () => simpleCards('second') })
  expect(h.args.listParts).toHaveBeenCalledTimes(1)
  h.clock.value += retention
  await syncRecordingsFiles({ ...h.args, merge: () => simpleCards('first') })
  expect(h.disk.has(first)).toBe(true)
  expect(h.disk.has(orphan)).toBe(false)
  expect(h.disk.has('recordings/manual.json')).toBe(true)
  expect(h.args.listParts).toHaveBeenCalledTimes(2)
  expect(JSON.parse(h.disk.get('recordings.json')).retiredParts[first]).toBeUndefined()
})

test('a concurrent index edit rescuing an expired part aborts the deletion and replans cleanup', async () => {
  const h = syncDisk(simpleCards('first'))
  await syncRecordingsFiles(h.args)
  const old = h.disk.get('recordings.json')
  const first = JSON.parse(old).playlists[0].parts[0]
  h.clock.value = 2
  await syncRecordingsFiles({ ...h.args, merge: () => simpleCards('second') })
  h.clock.value += retention
  let conflict = true
  await syncRecordingsFiles({ ...h.args, commitFiles: async files => {
    if (conflict) {
      conflict = false
      expect(files.some(f => f.delete && f.path === first)).toBe(true)
      h.disk.set('recordings.json', old) // Another device reused the part.
    }
    return h.commitFiles(files)
  } })
  expect(h.disk.has(first)).toBe(true)
  expect(await readRecordings(JSON.parse(h.disk.get('recordings.json')), p => h.disk.get(p))).toEqual(simpleCards('first'))
})

test('discovery failure does not block sync, and a failed cleanup commit leaves parts and retirement markers intact', async () => {
  const h = syncDisk(simpleCards('first'))
  const log = jest.fn()
  await syncRecordingsFiles({ ...h.args, log, listParts: async () => { throw new Error('offline') } })
  expect(log).toHaveBeenCalled()
  expect(JSON.parse(h.disk.get('recordings.json')).partsScannedAt).toBeUndefined()
  await syncRecordingsFiles({ ...h.args, merge: () => simpleCards('second') })
  h.clock.value += retention
  const before = new Map(h.disk)
  await expect(syncRecordingsFiles({ ...h.args, commitFiles: async () => { throw new Error('push failed') } })).rejects.toThrow('push failed')
  expect(h.disk).toEqual(before)
})

test('a cached index whose parts were cleaned up is retried once against the fresh index', async () => {
  const old = await splitRecordings(simpleCards('old'), { digest })
  const current = await splitRecordings(simpleCards('current'), { digest })
  const read = jest.fn((path, fresh) => {
    if (path === 'recordings.json') return fresh ? current.text : old.text
    if (current.files.has(path)) return current.files.get(path)
    throw Object.assign(new Error('not found'), { code: 'recordings-part-missing' })
  })
  expect(await loadRecordingsFiles(read)).toEqual(simpleCards('current'))
  expect(read.mock.calls.filter(([path]) => path === 'recordings.json')).toEqual([['recordings.json', false], ['recordings.json', true]])
})

test('a still-missing active part fails after one refresh, and unrelated read failures do not retry', async () => {
  const split = await splitRecordings(simpleCards('one'), { digest })
  const read = jest.fn(path => {
    if (path === 'recordings.json') return split.text
    throw Object.assign(new Error('missing active part'), { code: 'recordings-part-missing' })
  })
  await expect(loadRecordingsFiles(read)).rejects.toThrow('missing active part')
  expect(read.mock.calls.filter(([path]) => path === 'recordings.json')).toHaveLength(2)
  const offline = jest.fn(() => { throw new Error('offline') })
  await expect(loadRecordingsFiles(offline)).rejects.toThrow('offline')
  expect(offline).toHaveBeenCalledTimes(1)
})

test('folder catalogs sync atomically with playlists, preserve empty folders and survive callers without folder edits', async () => {
  const initial=await splitRecordings({A:{folder:'Swedish/Listening',items:{}}},options)
  const root=JSON.parse(initial.text);root.folders={'Swedish/Empty':{updatedAt:1,deleted:false}}
  const disk=new Map([['recordings.json',JSON.stringify(root)],...initial.files])
  const readFile=path=>disk.get(path)??null
  const commitFiles=async files=>{
    const updates=await Promise.all(files.map(async f=>[f.path,await f.getContent(disk.get(f.path)??null)]))
    for(const [path,text] of updates)disk.set(path,text)
  }
  await syncRecordingsFiles({readFile,commitFiles,merge:r=>r,splitOptions:options,
    mergeFolders:remote=>({...remote,New:{updatedAt:2,deleted:false}})})
  const metadata=jest.fn()
  const loaded=await loadRecordingsFiles(readFile,{onMetadata:metadata})
  expect(loaded.A.folder).toBe('Swedish/Listening')
  expect(metadata.mock.calls[0][0].folders).toEqual({'Swedish/Empty':{updatedAt:1,deleted:false},New:{updatedAt:2,deleted:false}})
  await syncRecordingsFiles({readFile,commitFiles,merge:r=>r,splitOptions:options})
  expect(JSON.parse(disk.get('recordings.json')).folders).toEqual(metadata.mock.calls[0][0].folders)
})
test('folder metadata is not adopted from an incomplete playlist snapshot', async()=>{
  const split=await splitRecordings(simpleCards('test'),options),root=JSON.parse(split.text)
  root.folders={Empty:{updatedAt:1,deleted:false}}
  const onMetadata=jest.fn()
  await expect(loadRecordingsFiles(path=>path==='recordings.json'?JSON.stringify(root):Promise.reject(new Error('missing')),{onMetadata})).rejects.toThrow('missing')
  expect(onMetadata).not.toHaveBeenCalled()
})

test('a racing folder edit retries against the fresh catalog and preserves both devices', async()=>{
  const initial=await splitRecordings({A:{items:{}}},options),disk=new Map([['recordings.json',initial.text],...initial.files])
  let calls=0
  const mergeFolders=remote=>({...remote,Local:{updatedAt:4,deleted:false}})
  await syncRecordingsFiles({readFile:path=>disk.get(path)??null,merge:r=>r,mergeFolders,splitOptions:options,
    commitFiles:async files=>{
      if(++calls===1){
        const root=JSON.parse(disk.get('recordings.json'));root.folders={Remote:{updatedAt:3,deleted:false}}
        disk.set('recordings.json',JSON.stringify(root))
      }
      const updates=await Promise.all(files.map(async f=>[f.path,await f.getContent(disk.get(f.path)??null)]))
      for(const [path,text] of updates)disk.set(path,text)
    }})
  expect(calls).toBe(2)
  expect(Object.keys(JSON.parse(disk.get('recordings.json')).folders).sort()).toEqual(['Local','Remote'])
})
