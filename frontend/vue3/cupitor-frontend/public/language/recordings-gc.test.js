import { planRecordingsCleanup, listRecordingsParts, RECORDINGS_RETENTION_MS } from './recordings-gc.js'
const part = n => `recordings/${n.toString(16).padStart(64, '0')}.json`
const day = 24 * 60 * 60 * 1000

test('newly unreferenced parts get seven days from first observation, never from playlist age', () => {
  const previous = { playlists: [{ parts: [part(1), part(2)] }] }
  expect(planRecordingsCleanup(previous, [part(2)], 10)).toEqual({ retired: { [part(1)]: 10 }, remove: [] })
  previous.playlists = [{ parts: [part(2)] }]
  previous.retiredParts = { [part(1)]: 10 }
  expect(planRecordingsCleanup(previous, [part(2)], 10 + RECORDINGS_RETENTION_MS - 1).remove).toEqual([])
  expect(planRecordingsCleanup(previous, [part(2)], 10 + RECORDINGS_RETENTION_MS)).toEqual({ retired: {}, remove: [part(1)] })
})

test('an obsolete retirement marker on a previously live part cannot bypass the grace period', () => {
  const now = RECORDINGS_RETENTION_MS * 2
  const previous = { playlists: [{ parts: [part(1)] }], retiredParts: { [part(1)]: 1 } }
  expect(planRecordingsCleanup(previous, [], now)).toEqual({ retired: { [part(1)]: now }, remove: [] })
})

test('reusing an expired part cancels retirement; invalid paths/timestamps do not authorize deletion', () => {
  const previous = { retiredParts: { [part(1)]: 1, [part(2)]: '1', [part(3)]: -1,
    [part(4)]: 100 * day, '../other.json': 1, 'recordings/manual.json': 1 } }
  expect(planRecordingsCleanup(previous, [part(1)], 20 * day, [part(2), 'recordings/manual.json'])).toEqual({
    retired: { [part(4)]: 100 * day, [part(2)]: 20 * day }, remove: []
  })
})

test('discovery retires earlier orphan files without resetting an existing retirement clock', () => {
  const previous = { retiredParts: { [part(1)]: 10 } }
  expect(planRecordingsCleanup(previous, [part(3)], 20, [part(1), part(2), part(3), 'recordings/readme.md'])).toEqual({
    retired: { [part(1)]: 10, [part(2)]: 20 }, remove: []
  })
})

function inventoryRequest(entries, { truncated = false, missing = false } = {}) {
  const branch = 'feature/data'
  const responses = {
    [`/repos/alice/data/git/ref/heads/${branch}`]: { object: { sha: 'commit-one' } },
    '/repos/alice/data/git/commits/commit-one': { tree: { sha: 'root' } },
    '/repos/alice/data/git/trees/root': { tree: [{ path: 'db', type: 'tree', sha: 'db' }] },
    '/repos/alice/data/git/trees/db': { tree: [{ path: 'language', type: 'tree', sha: 'language' }] },
    '/repos/alice/data/git/trees/language': { tree: [{ path: 'swedish', type: 'tree', sha: 'swedish' }] },
    '/repos/alice/data/git/trees/swedish': { tree: missing ? [] : [{ path: 'recordings', type: 'tree', sha: 'parts' }] },
    '/repos/alice/data/git/trees/parts': { tree: entries, truncated }
  }
  const request = jest.fn(async (method, path) => {
    expect(method).toBe('GET')
    if (!responses[path]) throw new Error('Unexpected request ' + path)
    return responses[path]
  })
  return { request, owner: 'alice', repo: 'data', branch, directory: 'db/language/swedish/recordings' }
}

test('inventories over 1,000 generated parts from one fixed commit, ignoring unrelated files and symlinks', async () => {
  const paths = Array.from({ length: 1200 }, (_, i) => part(i))
  const entries = paths.map(path => ({ path: path.slice(11), type: 'blob', mode: '100644' }))
  entries.push({ path: 'manual.json', type: 'blob', mode: '100644' },
    { path: part(1201).slice(11), type: 'tree', mode: '040000' },
    { path: part(1202).slice(11), type: 'blob', mode: '120000' })
  const args = inventoryRequest(entries)
  expect(await listRecordingsParts(args)).toEqual(paths)
  expect(args.request).toHaveBeenCalledTimes(7)
})

test('a truncated inventory is rejected, while an absent recordings directory is empty', async () => {
  await expect(listRecordingsParts(inventoryRequest([], { truncated: true }))).rejects.toThrow('Incomplete')
  expect(await listRecordingsParts(inventoryRequest([], { missing: true }))).toEqual([])
})
