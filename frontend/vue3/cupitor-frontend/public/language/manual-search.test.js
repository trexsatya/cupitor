import { findManualCards, highlightMatchesHtml, matchSnippetHtml, renderManualResultsHtml } from './manual-search.js'

const card = (id, source, target, extra = {}) => ({ manual: true, id, source, target, ...extra })
const playlist = (cards, extra = {}) => ({ items: { Manual: { Card: cards } }, ...extra })

const recordings = {
  Svenska: playlist([
    card('a', 'Han gick hem.', 'He went home.'),
    card('b', 'Hon åt\nfrukost', 'She ate breakfast'),
  ]),
  Övrigt: playlist([card('c', 'Vi ses', 'See you')]),
  Virtual: playlist([card('a', 'Han gick hem.', 'He went home.')], { virtual: true }),
  Book: playlist([card('d', 'hem igen', 'home again')], { external: true }),
  Empty: { items: {} },
}

describe('findManualCards', () => {
  test('matches either face, ignoring case', () => {
    expect(findManualCards(recordings, 'HEM').map(h => h.item.id)).toEqual(['a'])
    expect(findManualCards(recordings, 'breakfast').map(h => h.item.id)).toEqual(['b'])
  })

  // Same playlist order as everywhere else in the app (listRecordings).
  test('pipe-separated alternatives each match', () => {
    expect(findManualCards(recordings, 'ses|gick').map(h => [h.playlist, h.item.id]))
      .toEqual([['Svenska', 'a'], ['Övrigt', 'c']].sort((x, y) => x[0].localeCompare(y[0])))
  })

  test('a space in the search matches a line break in the card', () => {
    expect(findManualCards(recordings, 'åt frukost').map(h => h.item.id)).toEqual(['b'])
  })

  test('skips virtual and app-owned playlists, which hold no cards of their own', () => {
    expect(findManualCards(recordings, 'hem').map(h => h.playlist)).toEqual(['Svenska'])
  })

  test('blank or unparsable search finds nothing, and does not throw', () => {
    expect(findManualCards(recordings, '  ')).toEqual([])
    expect(findManualCards(recordings, '(')).toEqual([])
    expect(findManualCards(null, 'hem')).toEqual([])
  })

  test('caps the number of hits', () => {
    expect(findManualCards(recordings, 'e', { limit: 1 })).toHaveLength(1)
  })
})

describe('highlightMatchesHtml', () => {
  test('wraps every match and escapes the rest', () => {
    expect(highlightMatchesHtml('<b>hem</b> och Hem', 'hem'))
      .toBe("&lt;b&gt;<span class='highlight'>hem</span>&lt;/b&gt; och <span class='highlight'>Hem</span>")
  })

  test('keeps line breaks', () => {
    expect(highlightMatchesHtml('a\nb', 'zz')).toBe('a<br>b')
  })
})

describe('matchSnippetHtml', () => {
  const long = 'Det var en gång en liten flicka som bodde i ett hus vid havet och hon tyckte mycket om att simma varje morgon'

  test('cuts to the match at word boundaries, with … where it was cut', () => {
    expect(matchSnippetHtml(long, 'hus', 15))
      .toBe("…bodde i ett <span class='highlight'>hus</span> vid havet och…")
  })

  test('no … at an end that was not cut', () => {
    expect(matchSnippetHtml('Ett hus', 'hus')).toBe("Ett <span class='highlight'>hus</span>")
  })

  test('line breaks become one line', () => {
    expect(matchSnippetHtml('Hon åt\nfrukost', 'frukost'))
      .toBe("Hon åt <span class='highlight'>frukost</span>")
  })

  test('no match is null', () => {
    expect(matchSnippetHtml('Ett hus', 'bil')).toBeNull()
    expect(matchSnippetHtml('', 'hus')).toBeNull()
  })
})

describe('renderManualResultsHtml', () => {
  test('one clickable line per card, from whichever face matched', () => {
    const html = renderManualResultsHtml([
      { playlist: 'Sv "1"', item: card('x', 'Ett hus', 'A house') },
      { playlist: 'P', item: card('y', 'Något', 'house rules') },
    ], 'hus|house')
    expect(html).toContain('data-playlist="Sv &quot;1&quot;"')
    expect(html).toContain('data-id="x"')
    expect(html).toContain("<span class='highlight'>hus</span>")
    // Source matched for x, so its Target is not shown; y matched on Target.
    expect(html).not.toContain('A house')
    expect(html).toContain("<span class='highlight'>house</span> rules")
    expect(html).toContain('2 manual cards')
  })

  test('folded renders the header only', () => {
    const html = renderManualResultsHtml([{ playlist: 'P', item: card('x', 'hus', '') }], 'hus', { collapsed: true })
    expect(html).toContain('lib-collapsed')
    expect(html).toContain('aria-expanded="false"')
  })

  test('nothing found says so', () => {
    expect(renderManualResultsHtml([], 'hem')).toContain('No manual cards')
  })
})
