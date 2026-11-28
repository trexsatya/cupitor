import { capturedSubtitleTerms, fetchSubtitleCaptureWordCount, mergeSubtitleCaptureTerms } from './subtitle-capture-words.js'

test('keeps one entry per distinct searched term across repeat pushes', () => {
  const capture = { sourceLang: 'sv', lines: [{ text: 'Han gav vika.' }] }
  const terms = capturedSubtitleTerms([
    { ...capture, query: ' Ge  vika ' },
    { ...capture, query: 'A\u030Ar' },
    { ...capture, query: '' },
    { ...capture, query: 'unsaved', lines: [] },
  ])
  const merged = mergeSubtitleCaptureTerms('["år","tassa"]', terms)
  expect(JSON.parse(merged)).toEqual(['ge vika', 'tassa', 'år'])
  expect(mergeSubtitleCaptureTerms(merged, terms)).toBe(merged)
})

test('reads a count from the listed user’s repository and language', async () => {
  const user = { login: 'alice', repo: 'cupitor-data', branch: 'main' }
  const fetch = jest.fn(async () => ({ ok: true, text: async () => '["tassa","TASSA","år"]' }))
  expect(await fetchSubtitleCaptureWordCount(user, 'swedish', fetch)).toBe(2)
  expect(fetch.mock.calls[0][0]).toBe(
    'https://raw.githubusercontent.com/alice/cupitor-data/main/db/language/swedish/subtitle-capture-words.json',
  )
  fetch.mockResolvedValue({ ok: false, status: 404 })
  expect(await fetchSubtitleCaptureWordCount(user, 'swedish', fetch)).toBe(0)
  fetch.mockResolvedValue({ ok: false, status: 503 })
  expect(await fetchSubtitleCaptureWordCount(user, 'swedish', fetch)).toBeNull()
})
