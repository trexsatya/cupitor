// Shared by the browser, host bridges and language-management tools. A data
// directory key is deliberately not rewritten to a code/locale alias: existing
// URLs and saved keys may name real folders such as "sv-se".
export const DEFAULT_LANGUAGE = 'swedish'
export const LANGUAGE_KEY = /^[a-z][a-z-]*$/
const definitions = [
  ['swedish', 'sv', 'sv-SE', true, 'swedish'],
  ['spanish', 'es', 'es-ES', true, 'spanish'],
  ['english', 'en', 'en-US', false, null],
  ['french', 'fr', 'fr-FR', false, null],
  ['german', 'de', 'de-DE', false, null],
  ['hindi', 'hi', 'hi-IN', false, null],
  ['greek', 'el', 'el-GR', false, null],
]
export const LANGUAGES = Object.freeze(Object.fromEntries(definitions.map(([name, code, locale, study, morphology]) => [name,
  Object.freeze({ name, code, locale, subtitleSuffix: `.${code}.srt`, dictionary: code,
    capabilities: Object.freeze({ study, calls: true, morphology }) })
])))

export function languageKey(value) {
  const key = typeof value === 'string' ? value.toLowerCase() : ''
  return LANGUAGE_KEY.test(key) ? key : DEFAULT_LANGUAGE
}
export function languageKeyFromLocation(loc = typeof window === 'undefined' ? null : window.location) {
  try { return languageKey(new URL(loc.href).searchParams.get('lang')) }
  catch (_) { return DEFAULT_LANGUAGE }
}
const byAlias = new Map(Object.values(LANGUAGES).flatMap(lang =>
  [lang.name, lang.code, lang.locale.toLowerCase()].map(alias => [alias, lang])))
export function languageDefinition(value) {
  return byAlias.get(String(value || '').trim().toLowerCase()) || null
}
export function languageFromLocation(loc = typeof window === 'undefined' ? null : window.location) {
  const fullName = languageKeyFromLocation(loc), definition = languageDefinition(fullName)
  return { fullName, code: definition?.code || null, locale: definition?.locale || null,
    definition, supported: !!definition?.capabilities.study }
}
export function requireStudyLanguage(loc) {
  const language = languageFromLocation(loc)
  if (!language.supported) throw new Error(`The study app does not support “${language.fullName}” yet. Choose Swedish or Spanish.`)
  return language
}
export function defaultDataRoot(language) {
  if (typeof language !== 'string' || !LANGUAGE_KEY.test(language)) throw new Error(`Invalid language data key: ${language}`)
  return `db/language/${language}`
}
export function speechLocale(value, fallback = LANGUAGES.swedish.locale) {
  const definition = languageDefinition(value)
  if (definition) return definition.locale
  // Study calls have always accepted explicit BCP-47 tags independently of
  // whether the full subtitle/vocabulary app supports the language.
  const tag = String(value || '').trim()
  if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(tag)) return fallback
  try { return Intl.getCanonicalLocales(tag)[0] || fallback } catch (_) { return fallback }
}
