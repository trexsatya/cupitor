import { createVocabularyMatcher } from './vocabulary-matcher.js'
import { expandWords, buildExpansionMap } from './vocab-expand.js'

function matcher(vocab, lang = 'sv') {
  const expansions = buildExpansionMap(vocab)
  return createVocabularyMatcher(vocab, { lang, expansions, expandLine: line => expandWords(line, lang, expansions) })
}
const vocab = {
  Exact: ['(bully)|översittare|', '(hail)|hagla|', '(colorful)|färgsprakande|'],
  Families: ['(bullying)|översitteri|', '(hail)|hagel(sl-pl)|hagelskur|hagelskurar|hagelkorn(sl-pl)',
    '(paint)|målare|', '(bicycle)|cykel|', '(mumble)|mummel|', '(real)|verklig|'],
  Phrases: ['(can, acceptable)|<*gå an|', '(effect)|<*göra susen|'],
  Parts: ['(color)|färg|', '(crackle)|spraka|sprakande|'],
  Other: ['(translate)|översätta|', '(overview)|översikt|', '(pastures)|hagar|', '(land)|land|'],
  Expansions: ['gå=gå,går,gick,gått', 'göra=göra,gör,gjorde,gjort', 'sova=sova,sover,sov,sovit'],
  Sleep: ['(sleep)|sova|']
}
test.each([
  ['översittare', 'översitteri'], ['översittarens', 'översitteri'],
  ['hagla', 'hagel'], ['haglade', 'hagel'], ['målerierna', 'målare'],
  ['cyklarnas', 'cykel'], ['mumlade', 'mummel'], ['verklighetens', 'verklig'],
  ['sovit', 'sova']
])('retains the family %s -> %s in every search mode', (query, target) => {
  const m = matcher(vocab)
  const ordinary = m.search(query)
  const prefixes = m.search(query, { includePrefix: true })
  expect(ordinary.some(row => row.line.includes(target))).toBe(true)
  expect(prefixes.filter(row => row.kind !== 'prefix')).toEqual(ordinary)
  expect(ordinary.some(row => row.category === 'Other')).toBe(false)
})
test('an exact row never suppresses another family row, and confidence beats prefix length', () => {
  const m = matcher(vocab)
  const results = m.search('översittare', { includePrefix: true })
  expect(results[0].line).toBe('(bully)|översittare|')
  expect(results.find(row => row.line === '(bullying)|översitteri|').kind).toBe('family')
})
test('keeps complete known compound constituents alongside the exact compound', () => {
  const results = matcher(vocab).search('färgsprakande')
  expect(results.map(row => row.line)).toEqual(expect.arrayContaining([
    '(colorful)|färgsprakande|', '(color)|färg|', '(crackle)|spraka|sprakande|'
  ]))
  expect(results[0].kind).toBe('exact')
})
test('väljarkår keeps the full three-letter kår and rejects the embedded two-letter år', () => {
  const m = matcher({ People: ['(voter)|väljare|', '(corps)|kår|', '(year)|år|'] })
  for (const includePrefix of [false, true]) {
    const lines = m.search('väljarkår', { includePrefix }).map(row => row.line)
    expect(lines).toContain('(corps)|kår|')
    expect(lines).toContain('(voter)|väljare|')
    expect(lines).not.toContain('(year)|år|')
  }
})
test('an unknown compound modifier still retains the longest known head', () => {
  const results = matcher({ People: ['(corps)|kår|', '(year)|år|'] }).search('väljarkår')
  expect(results.map(r => r.line)).toEqual(['(corps)|kår|'])
})
test('recognizes whole inflected families before trying unrelated compound fragments', () => {
  const m = matcher({ Words: ['(bullying)|översitteri|', '(clean)|rensa|ren|', '(hail)|hagel|', '(greedy)|hagalen|', '(lay)|lägga|'] })
  expect(m.search('översittarens').map(r => r.line)).toEqual(['(bullying)|översitteri|'])
  expect(m.search('haglade').map(r => r.line)).toEqual(['(hail)|hagel|'])
})
test('expands phrases, respects word boundaries, and does not replace a phrase with individual words', () => {
  const m = matcher(vocab)
  expect(m.search('går an').map(row => row.line)).toEqual(['(can, acceptable)|<*gå an|'])
  expect(m.search('gjorde susen').map(row => row.line)).toEqual(['(effect)|<*göra susen|'])
  expect(m.search('går på')).toEqual([])
  expect(m.search('gör sus')).toEqual([])
  expect(m.search('an')).toEqual([])
})
test('does not treat English fragments as Swedish compounds or families', () => {
  const m = matcher(vocab, 'en')
  expect(m.search('colander')).toEqual([])
  expect(m.search('översittarens')).toEqual([])
})
test('excludes expansion definitions, tolerates empty categories, and keeps raw lines intact', () => {
  const data = { ...vocab, Empty: null }
  const m = matcher(data)
  expect(m.rows.some(row => row.category === 'Expansions')).toBe(false)
  expect(m.search('hagla').find(row => row.category === 'Families').line)
    .toBe('(hail)|hagel(sl-pl)|hagelskur|hagelskurar|hagelkorn(sl-pl)')
  expect(m.search('')).toEqual([])
  expect(m.search('och')).toEqual([])
})
test('rebuilding after a same-size edit changes the results', () => {
  const data = { Words: ['(hail)|hagel|'] }
  expect(matcher(data).search('hagla')).toHaveLength(1)
  data.Words[0] = '(bicycle)|cykel|'
  expect(matcher(data).search('hagla')).toEqual([])
  expect(matcher(data).search('cyklade')).toHaveLength(1)
})

test.each(['till', 'för', 'som', 'med', 'från', 'över', 'under', 'utan', 'mellan', 'genom', 'eftersom', 'men'])(
  '%s cannot be the only matching word, including exact query alternatives', stop => {
    const noise = [`(bare)|${stop}|`, `(punctuated)|${stop.toUpperCase()}!|`, `(phrase)|gå ${stop}|`]
    const useful = '(bullying)|översitteri|'
    const m = matcher({ Noise: noise, Useful: [useful] })
    for (const includePrefix of [false, true]) {
      expect(m.search(stop, { includePrefix })).toEqual([])
      expect(m.search(stop.toUpperCase().normalize('NFD') + '!', { includePrefix })).toEqual([])
      expect(m.search(`${stop}|översittare`, { includePrefix }).map(r => r.line)).toEqual([useful])
      expect(m.search(`översittare|${stop}`, { includePrefix }).map(r => r.line)).toEqual([useful])
    }
    for (const line of noise) expect(m.matchLine(line, `${stop}|översittare`)).toBeNull()
  }
)

test('filters common-only compound and prefix anchors while keeping content words with those prefixes', () => {
  const useful = '(manufacture)|till<*verka|tillverkning|'
  const m = matcher({ Noise: ['(to)|till|', '(ensure)|se till|', '(for)|för!|'], Useful: [useful],
    Expansions: ['verka=verka,verkar,verkade,verkat'] })
  for (const includePrefix of [false, true]) {
    expect(m.search('tillverkade', { includePrefix }).map(r => r.line)).toEqual([useful])
    expect(m.search('tillverkning', { includePrefix }).map(r => r.line)).toEqual([useful])
    expect(m.search('kryptotill', { includePrefix })).toEqual([])
    expect(m.search('förneka', { includePrefix })).toEqual([])
  }
})

test.each(['se till', 'till och från', 'för sig'])(
  'keeps the complete expression %s instead of removing its common words', query => {
    const line = `(expression)|${query}|`
    const m = matcher({ Phrases: [line], Noise: ['(to)|till|', '(for)|för|', '(from)|från|'] })
    for (const includePrefix of [false, true]) expect(m.search(query, { includePrefix }).map(r => r.line)).toEqual([line])
    expect(m.matchLine(line, query).kind).toBe('exact')
  }
)
