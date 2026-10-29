import { youtubeClipForItem, manualPlaybackPlan, clipFallbackSeconds } from './card-playback.js'

const yt = (start, extra = {}, id = 'testVideo01') => ({ manual: true, id: 'card-' + start,
  mediaUrl: `https://youtu.be/${id}?t=${start}`, ...extra })

test('infers the earlier of the next same-video start and the configured length without mutating cards', () => {
  const queue = [yt(60), { manual: true, source: 'Text' }, yt(4, {}, 'testVideo02'), yt(72), yt(105)]
  const saved = JSON.stringify(queue)
  expect(youtubeClipForItem(queue[0], queue, 0)).toMatchObject({ timeStart: 60, timeEnd: 72, inferredEnd: true })
  expect(youtubeClipForItem(queue[0], queue, 0, 5).timeEnd).toBe(65)
  expect(youtubeClipForItem(queue[3], queue, 3).timeEnd).toBe(92)
  expect(youtubeClipForItem(queue[4], queue, 4).timeEnd).toBe(125)
  expect(JSON.stringify(queue)).toBe(saved)
})

test('keeps explicit ends/durations and ignores disabled, earlier and different-video starts', () => {
  const queue = [yt(60), yt(61, { enabled: false }), yt(40), yt(65, {}, 'testVideo02')]
  expect(youtubeClipForItem(queue[0], queue, 0).timeEnd).toBe(80)
  expect(youtubeClipForItem(yt(60, { endTimestamp: '1:47' }), queue).timeEnd).toBe(107)
  expect(youtubeClipForItem(yt(60, { duration: 9 })).timeEnd).toBe(69)
  expect(youtubeClipForItem(yt(60, { endTimestamp: 50 })).timeEnd).toBe(80)
  expect(youtubeClipForItem({ id: 'testVideo01', source: 'YouTube', timeStart: 5 }, [], -1, 12).timeEnd).toBe(17)
  expect(clipFallbackSeconds('')).toBe(20)
  expect(clipFallbackSeconds(-1)).toBe(20)
  expect(clipFallbackSeconds('12')).toBe(12)
})

test('chooses linked media, recordings, or both; single-source cards remain playable', () => {
  const both = yt(60, { sourceAudioUrl: 'file:///source.wav' })
  expect(manualPlaybackPlan(both, 'linked')).toEqual({ hasBoth: true, linked: true, recordings: false })
  expect(manualPlaybackPlan(both, 'recordings')).toEqual({ hasBoth: true, linked: false, recordings: true })
  expect(manualPlaybackPlan(both, 'both')).toEqual({ hasBoth: true, linked: true, recordings: true })
  expect(manualPlaybackPlan(yt(60), 'recordings').linked).toBe(true)
  expect(manualPlaybackPlan({ manual: true, sourceAudioUrl: 'file:///source.wav' }, 'linked').recordings).toBe(true)
  const spotify = { manual: true, mediaUrl: 'https://open.spotify.com/episode/317TI86OHwkAxLtwi1VnXN',
    captionUrl: 'https://open.spotify.com/episode/317TI86OHwkAxLtwi1VnXN', captionStarts: [10], captionEnds: [15], targetAudioUrl: 'file:///target.wav' }
  expect(manualPlaybackPlan(spotify, 'recordings')).toEqual({ hasBoth: true, linked: false, recordings: true })
})
