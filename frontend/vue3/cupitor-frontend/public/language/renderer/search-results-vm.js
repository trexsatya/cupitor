// Pure VM helpers for the search-results pipeline. The two functions here
// were inline in language.js, each pulling its inputs from `window.*`:
//   - groupAndArrangeResults: by-category interleaving + media-file priority
//   - applyBlockedChannelFallback: demote items from blocked channels, but
//     fall back to showing them when no non-blocked alternative survives
//
// Carved out so they can be tested without a DOM / window. Callers pass the
// needed slices as args; language.js wraps them with thin shims that read
// the live globals.

// Resolve the channel for a result item using the supplied `srts` list. The
// channel is the leading "Channel || Title || vid" segment of the SRT name
// (the same convention used in capture/upload paths).
export function channelOfItem(item, srts) {
  if (!item) return null
  const link = item.url || item.id || item.link
  if (!link) return null
  const srt = Array.isArray(srts) ? srts.find(s => s && s.link === link) : null
  if (!srt) return null
  const name = String(srt.name || '')
  const i = name.indexOf(' || ')
  return (i > 0 ? name.slice(0, i) : name).trim() || null
}

// Drop items whose channel is in the blocked set, unless that would empty
// the result entirely — in which case keep the originals (otherwise the
// word would render with no findings).
export function applyBlockedChannelFallback(items, { blockedChannels = [], srts = [] } = {}) {
  const blocked = new Set(blockedChannels)
  if (!blocked.size) return items
  const allowed = items.filter(it => !blocked.has(channelOfItem(it, srts)))
  return allowed.length ? allowed : items
}

// Interleave items by category so that the first item of each category
// appears before any second item, ranked by category size. Items whose URL
// matches a known media file are pulled to the front.
//
// ctx fields:
//   categories       — { [url]: categoryName }
//   mediaFileNames   — string[] of preferred filenames
//   blockedChannels  — string[] (forwarded to applyBlockedChannelFallback)
//   srts             — used by applyBlockedChannelFallback to resolve channel
//   lodash           — the lodash instance (so tests can inject it)
export function groupAndArrangeResults(items, ctx = {}) {
  const _ = ctx.lodash || (typeof window !== 'undefined' ? window._ : null)
  if (!_) throw new Error('groupAndArrangeResults requires lodash')

  const categories = ctx.categories || {}
  const mediaFileNames = ctx.mediaFileNames || []

  let arr = applyBlockedChannelFallback(items, ctx)
  let grouped = _.groupBy(arr, it => {
    const c = categories[it.url] || ''
    return c.trim()
  })
  grouped = _.zip(...Object.values(grouped))
  grouped = _.sortBy(grouped, it => it.filter(Boolean).length).reverse()
  arr = grouped.flat().filter(Boolean)
  arr = arr.toSorted((x, _y) => {
    if (mediaFileNames.some(name => _.includes(name, x.url))) return -1
    return 0
  })
  return arr.filter(Boolean)
}
