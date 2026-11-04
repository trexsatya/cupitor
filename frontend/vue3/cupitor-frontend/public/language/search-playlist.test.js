import { buildSearchPlaylist, buildSelectedSearchPlaylist } from './search-playlist.js'

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

test('limits playable clips separately for every selected heading', () => {
  const groups = ['first', 'second', 'unselected'].map(word => ({ word, items: [match(2), match(2), match(3), match(4)] }))
  const opts = { ...options, maxPerHeader: '2' }
  const selected = ['first', 'second']
  expect(buildSelectedSearchPlaylist(groups, selected, opts).map(it => it.lineIndex)).toEqual(['2', '3', '2', '3'])
  expect(buildSelectedSearchPlaylist(groups, selected, { ...opts, maxPerHeader: '' })).toHaveLength(6)
  expect(buildSelectedSearchPlaylist(groups, [], opts)).toEqual([])
  for (const maxPerHeader of ['0', '-1', '1.5', 'invalid', 'Infinity']) {
    expect(() => buildSelectedSearchPlaylist(groups, selected, { ...opts, maxPerHeader })).toThrow(RangeError)
  }
})

test('minimum surrounding words extend the clip within a continuous subtitle run', () => {
  const rich = [
    { ...cue(1, 0, 2), text: 'first second third fourth' },
    { ...cue(2, 2, 4), text: 'fifth sixth seventh eighth' },
    { ...cue(3, 4, 6), text: 'word' },
    { ...cue(4, 6, 8), text: 'ninth tenth eleventh twelfth' },
    { ...cue(5, 8, 10), text: 'thirteenth fourteenth fifteenth sixteenth' },
  ]
  const queue = buildSearchPlaylist(
    [{ url: 'words', source: 'YouTube', word: 'word', line: rich[2] }],
    { files: [{ url: 'words', sv_subs: { data: rich } }], contextBefore: 0,
      contextAfter: 0, minWordsAround: 6 },
  )
  expect(queue).toEqual([expect.objectContaining({ timeStart: 0, timeEnd: 10 })])
})

test('minimum surrounding words never jump across sparse subtitle seams', () => {
  const sparse = [
    { ...cue(1, 0, 2), text: 'earlier separate capture' },
    { ...cue(2, 100, 102), text: 'word' },
    { ...cue(3, 200, 202), text: 'later separate capture' },
  ]
  const queue = buildSearchPlaylist(
    [{ url: 'seams', source: 'local', word: 'word', line: sparse[1] }],
    { files: [{ url: 'seams', sv_subs: { data: sparse } }], minWordsAround: 10 },
  )
  expect(queue).toEqual([expect.objectContaining({ timeStart: 100, timeEnd: 102 })])
})
