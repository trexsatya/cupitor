import { reusableSubtitleCache, subtitleSnapshot, SUBTITLE_CONTENT_VERSION } from './subtitle-state.js'
import { parseSrtEntries } from './srt-parser.js'

const source = '1\n00:00:01,000 --> 00:00:02,000\nFull source\n'
const target = '1\n00:00:01,000 --> 00:00:02,000\nFull translation\n'

test('old and partial caches are automatically treated as misses', () => {
  expect(reusableSubtitleCache({ sv: source })).toBe(false)
  expect(reusableSubtitleCache({ sv: source, contentVersion: 1, complete: true })).toBe(false)
  expect(reusableSubtitleCache({ sv: source, contentVersion: SUBTITLE_CONTENT_VERSION, complete: false })).toBe(false)
  expect(reusableSubtitleCache({ sv: source, contentVersion: SUBTITLE_CONTENT_VERSION, complete: true })).toBe(true)
  expect(reusableSubtitleCache({ sv: null, contentVersion: SUBTITLE_CONTENT_VERSION, complete: true })).toBe(false)
})

test('a remote snapshot without pending captures remains verbatim and drops stale parses', () => {
  const out = subtitleSnapshot({ sv: source, en: target, _parsedSv: [1], _parsedEn: [2], _partial: true })
  expect(out).toEqual({ sv: source, en: target, _remoteComplete: true, _partial: false })
})

test('pending captures survive hydration in both languages without replacing remote lines', () => {
  const extra = { start: 3, end: 4, text: 'Pending source' }
  const translation = { ...extra, text: 'Pending translation' }
  const out = subtitleSnapshot({ sv: source, en: target }, [{ lines: [extra], translation: [translation] }])
  expect(parseSrtEntries(out.sv).map(e => e.text)).toEqual(['Full source', 'Pending source'])
  expect(parseSrtEntries(out.en).map(e => e.text)).toEqual(['Full translation', 'Pending translation'])
})

test('untranslated captures retain the complete translation and an optional missing file stays null', () => {
  const captures = [{ lines: [{ start: 3, end: 4, text: 'Pending' }] }]
  expect(subtitleSnapshot({ sv: source, en: target }, captures).en).toBe(target)
  expect(subtitleSnapshot({ sv: source, en: null }, captures).en).toBeNull()
})

test('overlapping captures deduplicate against the authoritative file', () => {
  const out = subtitleSnapshot({ sv: source }, [{ lines: [{ start: 1, end: 2, text: 'Full source' }] }])
  expect(parseSrtEntries(out.sv)).toHaveLength(1)
})
