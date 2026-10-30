import { orderedRecordingEntries, insertRecordingItem, insertionIndex, reorderRecordingBucket } from './recordings-order.js'
import { buildPlayQueue } from './play-queue.js'
import { recordingReviewPage } from './recording-review-page.js'
import { rowPositionIn, resolveVirtualItems, mergeRecordingCollections } from './recordings-merge.js'

const ids = items => orderedRecordingEntries(items).map(e => e.item.id)
const fixture = () => ({ First: { term: [{ id: 'a' }, { id: 'b', enabled: false }] }, Manual: { Card: [{ id: 'c', manual: true }] } })

test('indexes are one based, blank appends, and invalid input cannot mutate a playlist', () => {
  expect(insertionIndex('', 3)).toBe(4)
  const items = fixture(), before = JSON.stringify(items)
  for (const n of [0, -1, 1.5, 'abc', Infinity, 5]) {
    expect(insertRecordingItem(items, 'Manual', 'Card', { id: 'new' }, n)).toBe(false)
    expect(JSON.stringify(items)).toBe(before)
  }
})

test('mixed buckets, disabled rows, pagination and playback share one persistent order', () => {
  const items = fixture()
  insertRecordingItem(items, 'Manual', 'Card', { id: 'new', manual: true }, 2)
  expect(ids(items)).toEqual(['a', 'new', 'b', 'c'])
  const restored = JSON.parse(JSON.stringify(items))
  const review = recordingReviewPage(restored)
  expect(review.runs.flatMap(run => run.entries.map(e => e.item.id))).toEqual(ids(items))
  expect(rowPositionIn(restored, 'Manual', 'Card', 0)).toEqual({ pos: 2, total: 4 })
  expect(buildPlayQueue({ currentName: 'P', currentItems: restored }).map(it => it.id)).toEqual(['a', 'new', 'c'])
  expect(recordingReviewPage(restored, 1, 2).runs.flatMap(run => run.entries.map(e => e.item.id))).toEqual(['b', 'c'])
  insertRecordingItem(items, 'First', 'term', { id: 'end' }, '')
  expect(ids(items)).toEqual(['a', 'new', 'b', 'c', 'end'])
  insertRecordingItem(items, 'Fresh', 'word', { id: 'front' }, 1)
  expect(ids(items)[0]).toBe('front')
})

test('reordering a bucket retains its global slots and duplication inserts next to the original', () => {
  const items = fixture()
  insertRecordingItem(items, 'Manual', 'Card', { id: 'new' }, 2)
  reorderRecordingBucket(items, 'First', 'term', items.First.term.slice().reverse())
  expect(ids(items)).toEqual(['b', 'new', 'a', 'c'])
  const copy = { ...items.First.term[1] }
  insertRecordingItem(items, 'First', 'term', copy, 4)
  expect(ids(items)).toEqual(['b', 'new', 'a', 'a', 'c'])
})

test('sync and combined playlists retain the member order without modifying member ranks', () => {
  const items = fixture()
  insertRecordingItem(items, 'Manual', 'Card', { id: 'new' }, 2)
  const local = { P: { items, updatedAt: 2 }, Q: { items: { x: { x: [{ id: 'q', playlistOrder: 0 }] } } }, V: { virtual: true, members: ['P', 'Q'] } }
  const before = JSON.stringify(local)
  expect(ids(resolveVirtualItems(local, 'V'))).toEqual(['a', 'new', 'b', 'c', 'q'])
  expect(JSON.stringify(local)).toBe(before)
  const merged = mergeRecordingCollections(local, { P: { items: fixture(), updatedAt: 1 } })
  expect(ids(merged.P.items)).toEqual(ids(items))
})
