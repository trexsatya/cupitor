const fs = require('fs')
const path = require('path')
const _ = require('lodash')

// Exercise the page's helpers without starting the media/search application.
const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const helpers = source.slice(source.indexOf('function getSwedishDictionaryUrl('),
  source.indexOf('// Lazy-create + show the small popover'))
const { getSwedishDictionaryUrl, getSwedishDictionaryLink } = new Function('getLangFromUrl', '_',
  helpers + '; return { getSwedishDictionaryUrl, getSwedishDictionaryLink }')(() => ({ code: 'sv' }), _)
const base = 'https://spraakbanken.gu.se/resurser/data/karp/so-2009-webbversion/'

test('Swedish words and phrases use the SO 2009 headword URLs', () => {
  expect(getSwedishDictionaryUrl('sköta')).toBe(base + 'sk%C3%B6ta.html')
  expect(getSwedishDictionaryUrl('  SKO\u0308TA  sig  ')).toBe(base + 'sk%C3%B6ta%20sig.html')
})

test('other languages and empty terms have no SO action', () => {
  for (const language of ['en', 'es', null]) {
    expect(getSwedishDictionaryUrl('sköta', language)).toBe('')
    expect(getSwedishDictionaryLink('sköta', language)).toBe('')
  }
  expect(getSwedishDictionaryLink('  ')).toBe('')
})

test('dictionary links keep the lookup text inside the URL path', () => {
  const container = document.createElement('div')
  container.innerHTML = getSwedishDictionaryLink('"<img src=x onerror=alert(1)>/#?')
  expect(container.querySelectorAll('a')).toHaveLength(1)
  expect(container.querySelectorAll('img')).toHaveLength(0)
  const link = container.querySelector('a')
  expect(link.textContent).toBe('Svensk ordbok')
  expect(link.target).toBe('_blank')
  expect(new URL(link.href).origin).toBe('https://spraakbanken.gu.se')
  expect(new URL(link.href).search).toBe('')
  expect(new URL(link.href).hash).toBe('')
})
