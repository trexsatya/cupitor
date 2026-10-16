import { createHash } from 'crypto'
import { TextEncoder } from 'util'
import { parseRecordingsRoot, readRecordings, splitRecordings, syncRecordingsFiles, RECORDINGS_PART_BYTES } from './recordings-store.js'

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
