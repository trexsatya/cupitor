import {
  buildLibraryQuery,
  normalizeLibraryPayload,
  mergeLibraryHits,
  groupHitsByBook,
  renderLibraryResultsHtml,
} from './library-search.js'

describe('buildLibraryQuery', () => {
  test('keeps pipe-separated phrases, drops dupes and short single words', () => {
    expect(buildLibraryQuery('göra|gå an|gå an|på|går an'))
      .toBe('göra|gå an|går an')
  })

  test('short multi-word phrases are exempt — the host honours them', () => {
    expect(buildLibraryQuery('är av|av')).toBe('är av')
  })

  test('drops phrases the last-token prefix match already covers', () => {
    // FTS5 prefix-matches the last token: "förvärv" already hits förvärvad.
    expect(buildLibraryQuery('förvärvad|förvärva|förvärv')).toBe('förvärv')
    // ...only when the leading tokens are the same phrase.
    expect(buildLibraryQuery('gå an|gå anna')).toBe('gå an')
    expect(buildLibraryQuery('hem|kom hemma')).toBe('hem|kom hemma')
  })

  test('strips the regex fragments removeHintsInBrackets bakes in', () => {
    // "gå (ngn) vidare" → "gå [^ ]* vidare"; host grammar has no regex, so we
    // send the longest literal run.
    expect(buildLibraryQuery('gå [^ ]* vidare')).toBe('vidare')
    expect(buildLibraryQuery('<*gå an|vidare')).toBe('gå an|vidare')
  })

  test('caps the phrase count', () => {
    const many = Array.from({ length: 20 }, (_, i) => `word${i}`).join('|')
    expect(buildLibraryQuery(many, 3)).toBe('word0|word1|word2')
  })

  test('empty / junk input yields an empty query', () => {
    expect(buildLibraryQuery('')).toBe('')
    expect(buildLibraryQuery(null)).toBe('')
    expect(buildLibraryQuery('||.*||')).toBe('')
  })
})

describe('normalizeLibraryPayload', () => {
  test('maps the host shape and fills missing chapter titles', () => {
    const p = normalizeLibraryPayload({
      query: 'hem',
      hits_capped: true,
      hits: [{
        book_key: 'abc', book_title: 'Bok', chapter_idx: 4, chapter_title: '',
        snippets: [{ phrase: 'hem', offset: 10, before: 'kom ', match: 'hem', after: ' igen' }],
      }],
    })
    expect(p.hitsCapped).toBe(true)
    expect(p.done).toBe(true)
    expect(p.hits[0]).toMatchObject({ bookKey: 'abc', chapterIdx: 4, chapterTitle: 'Chapter 5' })
    expect(p.hits[0].snippets[0].match).toBe('hem')
  })

  test('carries the streaming flags', () => {
    expect(normalizeLibraryPayload({ query: 'q', hits: [], done: false }).done).toBe(false)
    const closing = normalizeLibraryPayload({ query: 'q', hits: [], done: true, cancelled: true })
    expect(closing).toMatchObject({ done: true, cancelled: true })
  })

  test('survives a garbage payload', () => {
    expect(normalizeLibraryPayload(undefined))
      .toEqual({ query: '', hits: [], done: true, hitsCapped: false, cancelled: false })
    expect(normalizeLibraryPayload({ hits: [null, 'x', {}] }).hits).toHaveLength(1)
  })
})

describe('mergeLibraryHits', () => {
  const h = (book, ch, snips) => ({
    bookKey: book, bookTitle: book, chapterIdx: ch, chapterTitle: `c${ch}`,
    snippets: snips.map(o => ({ phrase: 'p', offset: o, before: '', match: 'm', after: '' })),
  })

  test('appends new chapters in arrival order', () => {
    const merged = mergeLibraryHits(mergeLibraryHits([], [h('a', 0, [1])]), [h('a', 1, [2]), h('b', 0, [3])])
    expect(merged.map(x => `${x.bookKey}${x.chapterIdx}`)).toEqual(['a0', 'a1', 'b0'])
  })

  test('a resent chapter unions its snippets instead of duplicating the row', () => {
    const merged = mergeLibraryHits([h('a', 0, [1])], [h('a', 0, [1, 5])])
    expect(merged).toHaveLength(1)
    expect(merged[0].snippets.map(s => s.offset)).toEqual([1, 5])
  })
})

describe('renderLibraryResultsHtml', () => {
  const hit = (bookKey, bookTitle, chapterIdx, match) => ({
    bookKey, bookTitle, chapterIdx, chapterTitle: `Ch ${chapterIdx}`,
    snippets: [{ phrase: match, offset: 0, before: 'a ', match, after: ' b' }],
  })

  test('groups chapters under their book and carries the openEpub data', () => {
    const html = renderLibraryResultsHtml({
      query: 'hem',
      hits: [hit('k1', 'Bok A', 0, 'hem'), hit('k1', 'Bok A', 3, 'hem'), hit('k2', 'Bok B', 1, 'hem')],
    })
    expect(html.match(/lib-book-title/g)).toHaveLength(2)
    expect(html).toContain('data-book-key="k1" data-chapter-idx="3"')
    expect(html).toContain('<mark>hem</mark>')
    expect(html).toContain('across 2 books')
  })

  test('each hit carries the phrase IT matched, not the whole query', () => {
    // Query "x|y": the reader honours one phrase, so a chapter that matched y
    // must open on y — sending the query would land on x.
    const html = renderLibraryResultsHtml({
      query: 'x|y',
      hits: [{
        bookKey: 'k', bookTitle: 'B', chapterIdx: 2, chapterTitle: 'C',
        snippets: [
          { phrase: 'y', offset: 0, before: 'a ', match: 'ynglingen', after: ' b' },
          { phrase: 'x', offset: 9, before: 'c ', match: 'xylofon', after: ' d' },
        ],
      }],
    })
    expect(html).toContain('data-match="ynglingen"')
    expect(html).toContain('data-match="xylofon"')
    expect(html).not.toContain('data-match="x|y"')
    // chapter-level ↗ opens at the chapter's first match
    expect(html.indexOf('data-match="ynglingen"')).toBeLessThan(html.indexOf('data-match="xylofon"'))
    // every snippet is its own open target
    expect(html.match(/class="lib-snip lib-open"/g)).toHaveLength(2)
  })

  test('sends the inflected word from the book, not our search phrase', () => {
    // Prefix match: we searched "envis", the book says "envist". Opening on
    // "envis" would have the reader hunt for a word that isn't there.
    const html = renderLibraryResultsHtml({
      query: 'envis',
      hits: [{ bookKey: 'k', bookTitle: 'B', chapterIdx: 0, chapterTitle: 'C',
        snippets: [{ phrase: 'envis', offset: 0, before: 'han var ', match: 'envist', after: ' tyst' }] }],
    })
    expect(html).toContain('data-match="envist"')
    expect(html).not.toContain('data-match="envis"')
  })

  test('falls back to the phrase when the host sends no match text', () => {
    const html = renderLibraryResultsHtml({
      query: 'q',
      hits: [{ bookKey: 'k', bookTitle: 'B', chapterIdx: 0, chapterTitle: 'C',
        snippets: [{ phrase: 'hem', offset: 0, before: '', match: '', after: '' }] }],
    })
    expect(html).toContain('data-match="hem"')
  })

  test('escapes host-supplied text', () => {
    const h = hit('k<1>', '<script>x</script>', 0, '<b>')
    expect(renderLibraryResultsHtml({ query: 'q', hits: [h] })).not.toContain('<script>')
  })

  test('collapsed keeps the header but folds the body', () => {
    const p = { query: 'hem', hits: [hit('k', 'B', 0, 'hem')] }
    const open = renderLibraryResultsHtml(p)
    const shut = renderLibraryResultsHtml(p, { collapsed: true })
    expect(open).toContain('aria-expanded="true"')
    expect(open).not.toContain('lib-collapsed')
    expect(shut).toContain('lib-collapsed')
    expect(shut).toContain('aria-expanded="false"')
    // header text survives collapsing — the user still sees the hit count
    expect(shut).toContain('1 snippet in 1 chapter')
    expect(shut).toContain('<mark>hem</mark>')
  })

  test('each book is independently collapsible', () => {
    const html = renderLibraryResultsHtml({ query: 'q', hits: [hit('k1', 'A', 0, 'q'), hit('k2', 'B', 0, 'q')] })
    expect(html.match(/class="lib-book-title" aria-expanded="true"/g)).toHaveLength(2)
    expect(html.match(/lib-book-body/g)).toHaveLength(2)
  })

  test('reports the 200-hit cap and the empty case', () => {
    expect(renderLibraryResultsHtml({ query: 'e', hits: [hit('k', 'B', 0, 'e')], hitsCapped: true }))
      .toContain('lib-capped')
    expect(renderLibraryResultsHtml({ query: 'zz', hits: [] })).toContain('No matches in your books')
  })

  test('distinguishes still-streaming from stopped-early', () => {
    const partial = { query: 'q', hits: [hit('k', 'B', 0, 'q')] }
    expect(renderLibraryResultsHtml(partial, { streaming: true })).toContain('still searching…')
    expect(renderLibraryResultsHtml(partial, { cancelled: true })).toContain('stopped early')
    // nothing found *yet* must not read as "no matches"
    expect(renderLibraryResultsHtml({ query: 'q', hits: [] }, { streaming: true }))
      .toContain('Searching your books')
  })
})

describe('groupHitsByBook', () => {
  test('falls back to the title when book_key is missing', () => {
    const groups = groupHitsByBook([
      { bookKey: '', bookTitle: 'X', chapterIdx: 0, snippets: [] },
      { bookKey: '', bookTitle: 'X', chapterIdx: 1, snippets: [] },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].chapters).toHaveLength(2)
  })
})
