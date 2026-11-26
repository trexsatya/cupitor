import { LANGUAGES, languageKeyFromLocation, languageFromLocation, languageDefinition, speechLocale, defaultDataRoot, requireStudyLanguage } from './language-config.js'
const at = query => ({href: 'https://cupitor.test/language.html' + query})
test('study codes, subtitle suffixes and capabilities come from one immutable registry', () => {
  expect(languageFromLocation(at('?lang=Swedish')).code).toBe('sv')
  expect(languageFromLocation(at('?lang=SPANISH')).fullName).toBe('spanish')
  expect(languageFromLocation(at('?lang=spanish')).definition.subtitleSuffix).toBe('.es.srt')
  expect(languageFromLocation(at('?lang=swedish')).definition.capabilities.morphology).toBe('swedish')
  expect(Object.isFrozen(LANGUAGES.swedish.capabilities)).toBe(true)
})
test('data keys retain directory names while definitions accept codes and locales', () => {
  expect(languageDefinition('SV-se')).toBe(LANGUAGES.swedish)
  expect(languageKeyFromLocation(at('?lang=sv-se'))).toBe('sv-se')
  expect(defaultDataRoot('sv-se')).toBe('db/language/sv-se')
  expect(languageFromLocation(at('?lang=sv-se')).code).toBe('sv')
  expect(() => defaultDataRoot('../swedish')).toThrow(/Invalid/)
})
test('unknown and unimplemented study languages have an explicit unsupported state', () => {
  for (const key of ['unknown', 'english', 'hindi', 'greek']) {
    const language = languageFromLocation(at('?lang=' + key))
    expect(language.fullName).toBe(key)
    expect(language.supported).toBe(false)
    expect(() => requireStudyLanguage(at('?lang=' + key))).toThrow(/does not support/)
  }
  expect(languageFromLocation(at('?lang=unknown')).code).toBeNull()
  expect(languageKeyFromLocation(at('?lang=../escape'))).toBe('swedish')
  expect(languageKeyFromLocation(null)).toBe('swedish')
})
test.each([
  ['spanish', 'es', 'es-ES'], ['french', 'fr', 'fr-FR'], ['german', 'de', 'de-DE'],
])('%s vocabulary uses its own data, subtitle suffix and speech locale', (name, code, locale) => {
  const language = requireStudyLanguage(at('?lang=' + name))
  expect(language.code).toBe(code)
  expect(language.definition.subtitleSuffix).toBe('.' + code + '.srt')
  expect(defaultDataRoot(language.fullName)).toBe('db/language/' + name)
  expect(speechLocale(name)).toBe(locale)
  expect(() => requireStudyLanguage(at('?lang=unknown'))).toThrow('Swedish, Spanish, French or German')
})
test('study calls retain named-language and explicit locale support independently of study capabilities', () => {
  expect(speechLocale('hindi')).toBe('hi-IN')
  expect(speechLocale('HI')).toBe('hi-IN')
  expect(speechLocale('es-MX')).toBe('es-MX')
  expect(speechLocale('not-a-language')).toBe('sv-SE')
})
