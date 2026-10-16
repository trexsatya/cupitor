import { channelOfItem } from './renderer/search-results-vm.js'

// An explicit include filter is strict, including when it yields no hits.
// It must run before blocked-channel fallback and corresponding-word guesses.
export function filterSearchChannels(items, selected = [], srts = []) {
  if (!Array.isArray(selected) || !selected.length) return items
  const wanted = new Set(selected)
  const byLink = new Map(srts.filter(Boolean).map(s => [s.link, s]))
  return items.filter(item => {
    if (!item) return false
    const srt = byLink.get(item.url || item.id || item.link)
    if (!srt || (srt.source !== 'youtube' && srt.source !== 'link')) return false
    return wanted.has(channelOfItem(item, [srt]))
  })
}

export function searchChannelOptions(srts = [], selected = []) {
  const names = new Set(selected)
  for (const s of srts) {
    if (!s || (s.source !== 'youtube' && s.source !== 'link')) continue
    const channel = channelOfItem(s, [s])
    if (channel) names.add(channel)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}
