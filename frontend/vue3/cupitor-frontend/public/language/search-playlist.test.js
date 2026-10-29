import { buildSearchPlaylist } from './search-playlist.js'

const cue = (index, start, end) => ({ index: String(index), start: { ordinal: start }, end: { ordinal: end } })
const lines = [cue(1, 1, 3), cue(2, 3, 5), cue(3, 5, 7), cue(4, 120, 122)]
const match = (index, url = 'video') => ({ url, source: 'YouTube', word: 'i rätta händer', line: lines[index - 1] })
const options = { word: 'i rätta händer', files: [{ url: 'video', sv_subs: { data: lines } }], contextBefore: 1, contextAfter: 1 }

test('includes the whole group in order, deduplicates cues and marks every clip temporary', () => {
  const items = [match(2), match(2), match(3), match(4)]
  const original = JSON.stringify(items)
  const queue = buildSearchPlaylist(items, options)
  expect(queue.map(it => [it.lineIndex, it.timeStart, it.timeEnd])).toEqual([
    ['2', 1, 7], ['3', 3, 7], ['4', 120, 122],
  ])
  expect(queue.every(it => it._temporary && it.enabled && it.word === 'i rätta händer')).toBe(true)
  expect(queue[0].id).toBe('video')
  expect(JSON.stringify(items)).toBe(original)
})

test('uses the selected language, preserves other sources, and skips unplayable matches', () => {
  const audio = { url: 'audio.mp3', source: 'Audio', line: cue(1, 60.4, 64.1) }
  const files = [{ url: 'audio.mp3', en_subs: { data: [audio.line] } }]
  const queue = buildSearchPlaylist([audio, null, match(2), { ...audio, url: '' }], { files, lang: 'en' })
  expect(queue).toEqual([expect.objectContaining({ id: 'audio.mp3', source: 'Audio', timeStart: 60, timeEnd: 65 })])
  expect(buildSearchPlaylist([], options)).toEqual([])
})
