import _ from 'lodash'
import {
  channelOfItem,
  applyBlockedChannelFallback,
  groupAndArrangeResults,
} from './search-results-vm.js'

const srt = (link, name) => ({ link, name })

describe('channelOfItem', () => {
  test('parses "Channel || Title || vid" SRT name', () => {
    const srts = [srt('u1', 'Foo Channel || Some Title || abc123')]
    expect(channelOfItem({ url: 'u1' }, srts)).toBe('Foo Channel')
  })
  test('returns trimmed full name when no " || " separator', () => {
    expect(channelOfItem({ url: 'u1' }, [srt('u1', '   Solo Name  ')])).toBe('Solo Name')
  })
  test('falls back to item.id / item.link when url is absent', () => {
    const srts = [srt('id-only', 'X || Y || Z')]
    expect(channelOfItem({ id: 'id-only' }, srts)).toBe('X')
    expect(channelOfItem({ link: 'id-only' }, srts)).toBe('X')
  })
  test('null item / no link / no matching srt → null', () => {
    expect(channelOfItem(null, [])).toBeNull()
    expect(channelOfItem({}, [])).toBeNull()
    expect(channelOfItem({ url: 'missing' }, [srt('other', 'A || B || C')])).toBeNull()
  })
  test('tolerates non-array srts', () => {
    expect(channelOfItem({ url: 'u' }, null)).toBeNull()
    expect(channelOfItem({ url: 'u' }, undefined)).toBeNull()
  })
})

describe('applyBlockedChannelFallback', () => {
  const SRTS = [
    srt('u1', 'BadChannel || T1 || v1'),
    srt('u2', 'BadChannel || T2 || v2'),
    srt('u3', 'GoodChannel || T3 || v3'),
  ]
  test('empty blocked set is a no-op', () => {
    const items = [{ url: 'u1' }, { url: 'u3' }]
    expect(applyBlockedChannelFallback(items, { srts: SRTS })).toBe(items)
  })
  test('drops items from a blocked channel when allowed items remain', () => {
    const items = [{ url: 'u1' }, { url: 'u3' }]
    const out = applyBlockedChannelFallback(items, { blockedChannels: ['BadChannel'], srts: SRTS })
    expect(out).toEqual([{ url: 'u3' }])
  })
  test('keeps originals when every item is blocked (fallback)', () => {
    const items = [{ url: 'u1' }, { url: 'u2' }]
    const out = applyBlockedChannelFallback(items, { blockedChannels: ['BadChannel'], srts: SRTS })
    expect(out).toBe(items)
  })
})

describe('groupAndArrangeResults', () => {
  test('interleaves by category so first-of-each precedes second-of-each', () => {
    const items = [
      { url: 'a1' }, { url: 'a2' },
      { url: 'b1' }, { url: 'b2' }, { url: 'b3' },
      { url: 'c1' },
    ]
    const categories = {
      a1: 'A', a2: 'A',
      b1: 'B', b2: 'B', b3: 'B',
      c1: 'C',
    }
    const out = groupAndArrangeResults(items, { lodash: _, categories })
    // _.zip preserves Object.values order, so the first item of each category
    // comes out in groupBy-insertion order (A, B, C). The second-of-each row
    // is then ranked by the count of items it contains.
    expect(out.map(it => it.url)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'b3'])
  })
  test('items with URLs matching a media file are pulled forward', () => {
    const items = [
      { url: 'foo.mp3' },
      { url: 'bar.srt' },
      { url: 'media.mp3' },
    ]
    const out = groupAndArrangeResults(items, {
      lodash: _,
      mediaFileNames: ['media'],
    })
    expect(out[0].url).toBe('media.mp3')
  })
  test('uses categories.trim() — blank/whitespace categories collapse into one bucket', () => {
    const items = [{ url: 'a' }, { url: 'b' }, { url: 'c' }]
    const out = groupAndArrangeResults(items, {
      lodash: _,
      categories: { a: '  ', b: '', c: undefined },
    })
    expect(out).toHaveLength(3)
  })
  test('handles missing categories / mediaFileNames defaults', () => {
    const items = [{ url: 'x' }, { url: 'y' }]
    expect(groupAndArrangeResults(items, { lodash: _ })).toHaveLength(2)
  })
  test('respects blocked channel demotion before grouping', () => {
    const items = [{ url: 'u1' }, { url: 'u2' }]
    const srts = [srt('u1', 'Bad || T || v'), srt('u2', 'Good || T || v')]
    const out = groupAndArrangeResults(items, {
      lodash: _,
      blockedChannels: ['Bad'],
      srts,
    })
    expect(out).toEqual([{ url: 'u2' }])
  })
  test('throws if no lodash supplied and window._ unavailable', () => {
    expect(() => groupAndArrangeResults([], {})).toThrow(/lodash/)
  })
  test('dedupes identical (url, line index) matches — same phrase added twice', () => {
    // A no-pipe multi-word search adds the same line under both the
    // whole-search-text key and the per-phrase-term key (identical key), so a
    // line arrives twice. Only one card should render.
    const items = [
      { url: 'v1', line: { index: '12' } },
      { url: 'v1', line: { index: '12' } },
    ]
    expect(groupAndArrangeResults(items, { lodash: _ })).toEqual([
      { url: 'v1', line: { index: '12' } },
    ])
  })
  test('keeps distinct line indices of the same video', () => {
    const items = [
      { url: 'v1', line: { index: '12' } },
      { url: 'v1', line: { index: '40' } },
    ]
    expect(groupAndArrangeResults(items, { lodash: _ })).toHaveLength(2)
  })
})
