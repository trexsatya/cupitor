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
