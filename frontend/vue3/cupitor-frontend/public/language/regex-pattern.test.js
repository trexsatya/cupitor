import { splitRegexAlternatives, hasRegexSyntax, isTypedRegex, hasPhraseWhitespace, relaxRegexSpaces, compileRegex } from './regex-pattern.js'

test('alternatives preserve nested groups, classes and escaped pipes', () => {
  expect(splitRegexAlternatives(String.raw`(?:för|över)[^ |]+|för\|namn`))
    .toEqual(['(?:för|över)[^ |]+', String.raw`för\|namn`])
})

test('space relaxation leaves classes and escaped literal spaces intact', () => {
  expect(relaxRegexSpaces(String.raw`foo  [^ ]+ för\ många`))
    .toBe(String.raw`foo\s+[^ ]+\s+för\ många`)
  expect(relaxRegexSpaces('för[ ]+många')).toBe('för[ ]+många')
})

test('class spaces do not turn a word regex into a phrase', () => {
  expect(hasPhraseWhitespace('för[^ ]+')).toBe(false)
  expect(hasPhraseWhitespace('foo [^ ]+ bar')).toBe(true)
})

test('typed regexes keep their syntax while vocabulary conventions keep expansion', () => {
  for (const text of [String.raw`för\S+`, '(?:för|över)', '^förringa$', 'för[ ]+många']) {
    expect(isTypedRegex(text)).toBe(true)
    expect(hasRegexSyntax(text)).toBe(true)
  }
  for (const text of ['förringa', '<*gå an', 'sett till (ngt)', '(pl)|hagar']) expect(isTypedRegex(text)).toBe(false)
})

test('compilation preserves uppercase escapes and supports Unicode properties', () => {
  expect(compileRegex(String.raw`för\S+`).test('för många')).toBe(false)
  expect(compileRegex(String.raw`för\S+`).test('förringa')).toBe(true)
  expect(compileRegex(String.raw`över\p{L}+`).test('överdriva')).toBe(true)
  expect(compileRegex(String.raw`över\p{L}+`).test('över123')).toBe(false)
})

test('legacy escapes still work and invalid expressions throw', () => {
  expect(compileRegex(String.raw`för\-namn`).test('för-namn')).toBe(true)
  for (const text of ['för[', '(för', 'för{2,1}', String.raw`över\p{Unknown}+`]) {
    expect(() => compileRegex(text)).toThrow()
  }
})
