import { recordingReviewPage, recordingReviewOrder } from './recording-review-page.js'

test('pages retain group order, original indices and item references', () => {
  const items = { a: { x: [{ id: 1 }, { id: 2 }] }, b: { y: [{ id: 3 }, { id: 4 }] } }
  const first = recordingReviewPage(items, 0, 3)
  const second = recordingReviewPage(items, 1, 3)
  expect(first).toMatchObject({ total: 4, start: 0, end: 3, pageCount: 2 })
  expect(first.groups.b.y[0]).toMatchObject({ idx: 0, item: { id: 3 } })
  expect(second.groups.b.y[0]).toEqual({ st: 'b', w: 'y', idx: 1, item: items.b.y[1] })
  expect(second.groups.b.y[0].item).toBe(items.b.y[1])
  expect(Object.keys(second.groups)).toEqual(['b'])
})

test('a huge list renders at most fifty entries even at its last page', () => {
  const items = { word: { word: Array.from({ length: 10000 }, (_, id) => ({ id })) } }
  const view = recordingReviewPage(items, 999)
  expect(view).toMatchObject({ page: 199, pageCount: 200, start: 9950, end: 10000 })
  expect(view.groups.word.word).toHaveLength(50)
  expect(view.groups.word.word[49]).toMatchObject({ idx: 9999, item: { id: 9999 } })
  expect(items.word.word).toHaveLength(10000)
})

test('empty lists and a deleted last page clamp to a valid page', () => {
  expect(recordingReviewPage({}, 5)).toMatchObject({ page: 0, pageCount: 1, total: 0, start: 0, end: 0 })
  expect(recordingReviewPage({ a: { x: [{}] } }, 1)).toMatchObject({ page: 0, total: 1 })
})

test('dragging on a later page preserves every unseen item and absolute index', () => {
  expect(recordingReviewOrder([5, 3, 4], 8)).toEqual([0, 1, 2, 5, 3, 4, 6, 7])
  expect(recordingReviewOrder([0, 0], 8)).toBeNull()
  expect(recordingReviewOrder([8], 8)).toBeNull()
})
