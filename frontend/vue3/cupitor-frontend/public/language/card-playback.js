import { parseMediaUrl, youtubeStartSeconds } from './recordings-merge.js'
import { spotifyClipSegments } from './spotify-clips.js'

export function clipFallbackSeconds(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(600, n) : 20
}

function seconds(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  const text = String(value).trim()
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text)
  if (/^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/.test(text)) {
    return text.split(':').reduce((n, part) => n * 60 + Number(part), 0)
  }
  return null
}

function youtubeStart(item) {
  if (!item) return null
  const media = parseMediaUrl(item.mediaUrl)
  const manualId = item.mediaVideoId || (media?.kind === 'youtube' ? media.id : null)
  const id = manualId || (!item.manual && String(item.source || 'youtube').toLowerCase() === 'youtube' ? item.id : null)
  if (!id) return null
  const start = seconds(item.startTimestamp ?? item.timeStart) ?? youtubeStartSeconds(item.mediaUrl)
  return { id, timeStart: start }
}

// No inferred values are written back to the card. Timestamps in a different
// video (or before this clip) cannot be used as an end in this video's clock.
export function youtubeClipForItem(item, queue = [], index = queue.indexOf(item), fallback = 20) {
  const video = youtubeStart(item)
  if (!video) return null
  let urlEnd = null
  try { urlEnd = new URL(item.mediaUrl).searchParams.get('end') } catch (_) {}
  let end = seconds(item.endTimestamp ?? item.timeEnd ?? urlEnd)
  const duration = seconds(item.duration ?? item.durationSeconds)
  if (!(end > video.timeStart) && duration > 0) end = video.timeStart + duration
  if (!(end > video.timeStart) && Array.isArray(item.captionEnds)) {
    const ends = item.captionEnds.map(seconds).filter(n => n > video.timeStart)
    if (ends.length) end = Math.max(...ends)
  }
  if (end > video.timeStart) return { ...video, timeEnd: end, inferredEnd: false }
  end = video.timeStart + clipFallbackSeconds(fallback)
  if (index >= 0) {
    for (let i = index + 1; i < queue.length; i++) {
      if (queue[i]?.enabled === false) continue
      const next = youtubeStart(queue[i])
      if (next?.id === video.id && next.timeStart > video.timeStart) {
        end = Math.min(end, next.timeStart)
        break
      }
    }
  }
  return { ...video, timeEnd: end, inferredEnd: true }
}

// A preference chooses between sources only when both are present. A card
// with just one source keeps playing that source under every preference.
export function manualPlaybackPlan(item, preference = 'both') {
  const hasLinked = !!youtubeStart(item) || spotifyClipSegments(item).length > 0
  const hasRecordings = [item?.sourceAudioUrl, item?.targetAudioUrl, item?.mediaUrl]
    .some(url => typeof url === 'string' && url.startsWith('file://'))
  const hasBoth = hasLinked && hasRecordings
  return { hasBoth,
    linked: hasLinked && (!hasBoth || preference !== 'recordings'),
    recordings: hasRecordings && (!hasBoth || preference !== 'linked') }
}
