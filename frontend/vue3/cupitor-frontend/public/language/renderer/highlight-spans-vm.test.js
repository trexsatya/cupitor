import { buildHighlightSpans, sliceByHighlightSpans } from './highlight-spans-vm.js'

const slice = (text, span) => text.slice(span.start, span.end)

describe('buildHighlightSpans — basics', () => {
  test('empty/null pattern → no spans', () => {
    expect(buildHighlightSpans('hello world', '')).toEqual([])
    expect(buildHighlightSpans('hello world', null)).toEqual([])
    expect(buildHighlightSpans('hello world', '   |   ')).toEqual([])
  })
  test('no match → empty array', () => {
    expect(buildHighlightSpans('hello world', 'xyz')).toEqual([])
  })
  test('single-token match expands to whitespace boundary', () => {
    const text = 'I love designing webpages'
    const spans = buildHighlightSpans(text, 'design')
    expect(spans).toHaveLength(1)
    expect(slice(text, spans[0])).toBe('designing')
  })
})

describe('buildHighlightSpans — multi-word phrase priority', () => {
  test('phrase wins over its single-word alternatives', () => {
    // Without the priority rule, this pattern would light up "x", "y", and "z"
    // standalone too. With the rule, only the phrase "x y z" survives.
    const text = 'foo x y z bar x baz'
    const spans = buildHighlightSpans(text, 'x y z|x|y|z')
    expect(spans).toHaveLength(1)
    expect(slice(text, spans[0])).toBe('x y z')
  })
  test('phrase with relaxed spaces matches multiple internal whitespace', () => {
    const text = 'foo i  förväg bar'
    const spans = buildHighlightSpans(text, 'i förväg')
    expect(spans).toHaveLength(1)
    expect(slice(text, spans[0])).toBe('i  förväg')
  })
})

describe('buildHighlightSpans — phrase fallback to single-word', () => {
  test('when no phrase matches, single-word alternations apply (unbounded)', () => {
    const text = 'I love designing webpages'
    const spans = buildHighlightSpans(text, 'design|love')
    expect(spans).toHaveLength(2)
    expect(spans.map(s => slice(text, s))).toEqual(['love', 'designing'])
  })
  test('when no phrase matches, sub-words split from multi-word are BOUNDED', () => {
    // "i" comes only from "i förväg" (multi-word). Bounded matching should
    // NOT light up "i" inside "vi"/"vilken".
    const text = 'vi vilken i'
    const spans = buildHighlightSpans(text, 'i förväg')
    expect(spans).toHaveLength(1)
    expect(slice(text, spans[0])).toBe('i')
  })
  test('overlapping spans merge into a single span', () => {
    const text = 'abcdef'
    // Two patterns that touch the same character region.
    const spans = buildHighlightSpans(text, 'abc|cdef')
    expect(spans).toHaveLength(1)
    expect(slice(text, spans[0])).toBe('abcdef')
  })
})

describe('buildHighlightSpans — defensive', () => {
  test('invalid regex source falls through to no spans', () => {
    expect(buildHighlightSpans('hello', '(unclosed')).toEqual([])
  })
  test('newlines act as word boundaries during expansion', () => {
    const text = 'foo\ndesign'
    const spans = buildHighlightSpans(text, 'design')
    expect(spans).toHaveLength(1)
    expect(slice(text, spans[0])).toBe('design')
  })
})

describe('sliceByHighlightSpans', () => {
  test('returns single plain chunk when no spans', () => {
    expect(sliceByHighlightSpans('hi', [])).toEqual([{ kind: 'plain', text: 'hi' }])
  })
  test('returns [] for empty text and no spans', () => {
    expect(sliceByHighlightSpans('', [])).toEqual([])
  })
  test('interleaves plain + match chunks', () => {
    const text = 'foo BAR baz'
    const spans = [{ start: 4, end: 7 }]
    expect(sliceByHighlightSpans(text, spans)).toEqual([
      { kind: 'plain', text: 'foo ' },
      { kind: 'match', text: 'BAR' },
      { kind: 'plain', text: ' baz' },
    ])
  })
  test('handles match at start and end', () => {
    const text = 'A middle B'
    const spans = [{ start: 0, end: 1 }, { start: 9, end: 10 }]
    expect(sliceByHighlightSpans(text, spans)).toEqual([
      { kind: 'match', text: 'A' },
      { kind: 'plain', text: ' middle ' },
      { kind: 'match', text: 'B' },
    ])
  })
})
