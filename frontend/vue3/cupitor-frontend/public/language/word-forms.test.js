import { vocabularyForms, createWordFormMatcher } from './word-forms.js'

const families = [
  ['översittarens', 'översitteri'], ['översitteriets', 'översittare'],
  ['målerierna', 'målare'], ['fiskerierna', 'fiskare'],
  ['hagla', 'hagel'], ['haglade', 'hagel'], ['haglets', 'hagla'],
  ['cyklarnas', 'cykel'], ['cyklade', 'cykel'], ['seglade', 'segel'],
  ['tvivlade', 'tvivel'], ['mumlade', 'mummel'], ['gamla', 'gammal'],
  ['himlen', 'himmel'], ['somrarna', 'sommar'], ['fönstrens', 'fönster'],
  ['vattnets', 'vatten'], ['vackrare', 'vacker'], ['vackraste', 'vacker'],
  ['verklighetens', 'verklig'], ['vänskapens', 'vän'],
  ['störningarna', 'störa'], ['byggnader', 'byggnad'],
  ['kvällarna', 'kväll'], ['flickornas', 'flicka'],
  ['hoppades', 'hoppa'], ['förvärvade', 'förvärva'], ['förvärvningarnas', 'förvärva']
]
test.each(families)('relates %s / %s in both directions', (a, b) => {
  const m = createWordFormMatcher('sv')
  expect(m.related(a, b)).toBe(true)
  expect(m.related(b, a)).toBe(true)
})
test.each([
  ['matt', 'mat'], ['släppa', 'släpa'], ['hatta', 'hata'],
  ['översittare', 'översätta'], ['översittare', 'översikt'],
  ['hagla', 'hagar'], ['hagel', 'hagna'], ['färg', 'fara'],
  ['hagla', 'hagalen'],
  ['cykel', 'cyklon'], ['vän', 'vänta'], ['hus', 'hustru']
])('does not invent a shared family for %s / %s', (a, b) => {
  expect(createWordFormMatcher('sv').related(a, b)).toBe(false)
})
test('normalizes Unicode and case without dropping Swedish diacritics', () => {
  const m = createWordFormMatcher('sv')
  expect(m.related(' ÖVERSITTARE '.normalize('NFD'), 'översitteri')).toBe(true)
  expect(m.related('far', 'får')).toBe(false)
})
test('uses explicit lexical expansion families without pronoun or placeholder spillover', () => {
  const m = createWordFormMatcher('sv', { sova: ['sova', 'sover', 'sov', 'sovit'],
    sig: ['sig', 'henne'], ngn: ['honom', 'henne'], plats: ['upp', 'ner'] })
  expect(m.related('sovit', 'sova')).toBe(true)
  expect(m.related('honom', 'henne')).toBe(false)
  expect(m.related('upp', 'ner')).toBe(false)
})
test('bounds each normalization stage, preserves originals, and handles invalid input', () => {
  expect(vocabularyForms(null, 'sv')).toEqual([])
  expect(vocabularyForms('en fras', 'sv')).toEqual(['en fras'])
  expect(vocabularyForms('matt', 'sv')).toEqual(['matt'])
  const forms = vocabularyForms('översittarens', 'sv')
  expect(forms).toContain('översittarens')
  expect(forms).toContain('översitt')
  expect(forms).not.toContain('översi')
  expect(new Set(forms).size).toBe(forms.length)
})
test('isolates languages and preserves existing English/Spanish stemming', () => {
  expect(createWordFormMatcher('en').related('studies', 'study')).toBe(true)
  expect(createWordFormMatcher('es').related('casas', 'casa')).toBe(true)
  expect(createWordFormMatcher('en').related('hagel', 'hagla')).toBe(false)
  expect(createWordFormMatcher('de').related('översittare', 'översitteri')).toBe(false)
})

test('recognizes -dd/-dda Swedish participles without changing other languages', () => {
  expect(vocabularyForms('beströdda', 'sv')).toContain('beströ')
  expect(vocabularyForms('beströdd', 'sv')).toContain('beströ')
  const match = createWordFormMatcher('sv')
  expect(match.related('beströ', 'beströdda')).toBe(true)
  expect(match.related('beströ', 'beströdd')).toBe(true)
  expect(match.related('beströ', 'bestämda')).toBe(false)
  expect(match.related('beströ', 'ström')).toBe(false)
  expect(vocabularyForms('beströdda', 'en')).not.toContain('beströ')
})
