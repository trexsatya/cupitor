import {
  threeWayRecordings,
  mergePlaylist3,
  summarizePlaylistChange,
  sameJson,
} from './recordings-3way.js'

const item = (id, extra = {}) => ({ id, lineIndex: 0, ...extra })
const pl = (cards, extra = {}) => ({ items: { Manual: { Card: cards } }, createdAt: 1, updatedAt: 1, ...extra })
const ids = p => p.items.Manual.Card.map(i => i.id)

describe('threeWayRecordings', () => {
  const base = { A: pl([item('a')]), B: pl([item('b')]), C: pl([item('c')]) }

  test('a playlist changed on one side only takes that side, deletions included', () => {
    const local = { A: pl([item('a'), item('a2')]), B: base.B, C: base.C }
    const remote = { A: base.A, B: pl([item('b'), item('b2')]) }   // C deleted on the server
    const { merged, conflicts } = threeWayRecordings(base, local, remote)
    expect(conflicts).toEqual([])
    expect(ids(merged.A)).toEqual(['a', 'a2'])
    expect(ids(merged.B)).toEqual(['b', 'b2'])
    expect(merged.C).toBeUndefined()
  })

  test('new on either side is kept', () => {
    const { merged, conflicts } = threeWayRecordings(base,
      { ...base, L: pl([item('l')]) }, { ...base, R: pl([item('r')]) })
    expect(conflicts).toEqual([])
    expect(Object.keys(merged).sort()).toEqual(['A', 'B', 'C', 'L', 'R'])
  })

  test('changed on both sides the same way is not a conflict', () => {
    const same = pl([item('a'), item('x')])
    expect(threeWayRecordings(base, { ...base, A: same }, { ...base, A: same }).conflicts).toEqual([])
  })

  test('changed differently on both sides is a conflict, left for the caller', () => {
    const { merged, conflicts } = threeWayRecordings(base,
      { ...base, A: pl([item('a'), item('l')]) },
      { ...base, A: pl([item('a'), item('r')]) })
    expect(conflicts.map(c => c.name)).toEqual(['A'])
    expect(merged.A).toBeUndefined()
    expect(ids(conflicts[0].local)).toEqual(['a', 'l'])
    expect(ids(conflicts[0].remote)).toEqual(['a', 'r'])
  })

  test('deleted on one side and edited on the other is a conflict', () => {
    const local = { B: base.B, C: base.C }                         // A deleted here
    const remote = { ...base, A: pl([item('a'), item('r')]) }        // A edited there
    const { conflicts } = threeWayRecordings(base, local, remote)
    expect(conflicts.map(c => [c.name, c.local, !!c.remote])).toEqual([['A', null, true]])
  })

  test('a save that only moved updatedAt is not a change', () => {
    const touched = { ...base, A: { ...base.A, updatedAt: 99 } }
    const remote = { ...base, A: pl([item('a'), item('r')]) }
    const { merged, conflicts } = threeWayRecordings(base, touched, remote)
    expect(conflicts).toEqual([])
    expect(ids(merged.A)).toEqual(['a', 'r'])
  })

  test('key order does not count as a change', () => {
    const reordered = { A: { updatedAt: 1, createdAt: 1, items: { Manual: { Card: [{ lineIndex: 0, id: 'a' }] } } } }
    expect(threeWayRecordings({ A: base.A }, reordered, { A: base.A }).conflicts).toEqual([])
    expect(sameJson(reordered.A, base.A)).toBe(true)
  })
})

describe('mergePlaylist3', () => {
  const b = pl([item('a'), item('b'), item('c')])

  test('keeps additions from both, honours deletions from either', () => {
    const l = pl([item('a'), item('c'), item('l')], { updatedAt: 2 })   // deleted b, added l
    const r = pl([item('a'), item('b'), item('r')], { updatedAt: 3 })   // deleted c, added r
    const { playlist, collisions } = mergePlaylist3(b, l, r)
    expect(ids(playlist)).toEqual(['a', 'l', 'r'])
    expect(collisions).toEqual([])
  })

  test('an item edited on one side takes the edit', () => {
    const l = pl([item('a', { source: 'new' }), item('b'), item('c')])
    const r = pl([item('a'), item('b'), item('c'), item('r')])
    expect(mergePlaylist3(b, l, r).playlist.items.Manual.Card[0].source).toBe('new')
  })

  test('an item edited differently on both sides keeps the newer side and reports it', () => {
    const l = pl([item('a', { source: 'mine' }), item('b'), item('c')], { updatedAt: 5 })
    const r = pl([item('a', { source: 'theirs' }), item('b'), item('c')], { updatedAt: 9 })
    const { playlist, collisions } = mergePlaylist3(b, l, r)
    expect(playlist.items.Manual.Card[0].source).toBe('theirs')
    expect(collisions).toEqual(['Manual / Card / a'])
  })

  test('edited on one side, deleted on the other, keeps the edit', () => {
    const l = pl([item('a', { source: 'kept' }), item('b'), item('c')])
    const r = pl([item('b'), item('c')])
    const { playlist, collisions } = mergePlaylist3(b, l, r)
    expect(ids(playlist)).toEqual(['a', 'b', 'c'])
    expect(collisions).toEqual(['Manual / Card / a'])
  })

  test('playlist settings merge field by field', () => {
    const l = pl([item('a'), item('b'), item('c')], { music: 'calm', updatedAt: 2 })
    const r = pl([item('a'), item('b'), item('c')], { notif: 'daily', updatedAt: 3 })
    const { playlist } = mergePlaylist3(b, l, r)
    expect(playlist.music).toBe('calm')
    expect(playlist.notif).toBe('daily')
    expect(playlist.updatedAt).toBe(3)
  })

  test('items in a bucket only one side has survive', () => {
    const l = pl([item('a'), item('b'), item('c')])
    l.items.huset = { hus: [item('y1')] }
    const { playlist } = mergePlaylist3(b, l, b)
    expect(playlist.items.huset.hus.map(i => i.id)).toEqual(['y1'])
  })
})

describe('summarizePlaylistChange', () => {
  const b = pl([item('a'), item('b')])
  test('counts added, removed and edited items against the last sync', () => {
    expect(summarizePlaylistChange(b, pl([item('a', { source: 'x' }), item('c'), item('d')])))
      .toEqual({ state: 'changed', added: 2, removed: 1, edited: 1, total: 3 })
  })
  test('new and deleted playlists', () => {
    expect(summarizePlaylistChange(null, b).state).toBe('new')
    expect(summarizePlaylistChange(b, null).state).toBe('deleted')
  })
})
