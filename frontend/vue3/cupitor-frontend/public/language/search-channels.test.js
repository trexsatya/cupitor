import { filterSearchChannels, searchChannelOptions } from './search-channels.js'
import { groupAndArrangeResults } from './renderer/search-results-vm.js'
import _ from 'lodash'
const srts = [
  { link: 'a', name: 'Channel A || One || a', source: 'link' },
  { link: 'b', name: 'Channel B || Two || b', source: 'youtube', readOnly: true },
  { link: 'c', name: 'Channel A || Local || c', source: 'local' }
]
const items = [{ url: 'a' }, { url: 'b' }, { url: 'c' }, { url: 'unknown' }]
test('all channels preserves every source, an explicit selection is strict', () => {
  expect(filterSearchChannels(items, [], srts)).toBe(items)
  expect(filterSearchChannels(items, ['Channel A'], srts)).toEqual([{ url: 'a' }])
  expect(filterSearchChannels(items, ['Channel A', 'Channel B'], srts)).toEqual([{ url: 'a' }, { url: 'b' }])
  expect(filterSearchChannels(items, ['Missing'], srts)).toEqual([])
})
test('blocked-channel fallback cannot escape an explicit channel limit', () => {
  const allowed = filterSearchChannels(items, ['Channel A'], srts)
  const out = groupAndArrangeResults(allowed, { lodash: _, srts, blockedChannels: ['Channel A'] })
  expect(out).toEqual([{ url: 'a' }])
})
test('picker offers both libraries, retains selected missing names, excludes local files', () => {
  expect(searchChannelOptions(srts, ['Old channel'])).toEqual(['Channel A', 'Channel B', 'Old channel'])
})
test('real library source casing includes channel prefixes, deduplicates videos, and filters consistently', () => {
  const library = [
    { link: 'book1', name: 'Ljudbok Klubb || ROBINSON CRUSOE ljudbok på svenska || book1', source: 'YouTube' },
    { link: 'book2', name: 'Ljudbok Klubb||HARRY POTTER||book2', source: 'YOUTUBE', readOnly: true },
    { link: 'land', name: 'Anders på landet || Höns i trädgård || land', source: 'youtube' },
    { link: 'capture', name: 'Captured channel || Clip || capture', source: ' Link ' },
    { link: 'local', name: 'Local movie', source: 'local' },
    { link: 'svt', name: 'SVT show', source: 'SVT' },
    null
  ]
  expect(searchChannelOptions(library)).toEqual(['Anders på landet', 'Captured channel', 'Ljudbok Klubb'])
  const results = library.filter(Boolean).map(s => ({ url: s.link }))
  expect(filterSearchChannels(results, ['Ljudbok Klubb'], library)).toEqual([{ url: 'book1' }, { url: 'book2' }])
  expect(filterSearchChannels(results, ['Captured channel'], library)).toEqual([{ url: 'capture' }])
})
