// Exercise the real input -> subtitle search -> rendered highlight pipeline.
// Expected cues and marked text are specified independently for every regex.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { serveFixtures } = require('./language-dialogs.cjs')

const line = (text, ...highlights) => ({ text, highlights })
const words = [line('Hellre för många än för få'), line('utan att förringa konsten', 'förringa'), line('Vi ska förnya allt', 'förnya')]
const cases = [
  { pattern: 'för[^ ]+', lines: words },
  { pattern: String.raw`för[^\s]+`, lines: words },
  { pattern: String.raw`för\S+`, lines: words },
  { pattern: 'för[^ |]+', lines: [line('för många'), line('förnamn gäller', 'förnamn'), line('för|namn gäller')] },
  { pattern: '(?:för|över)[^ ]+', lines: [line('för många'), line('utan att förringa konsten', 'förringa'), line('överdriva inte', 'överdriva')] },
  { pattern: 'för(ringa|nya)', lines: words },
  { pattern: 'för(?:ringa|nya)', lines: words },
  { pattern: 'förring[ae]', lines: [line('förringa inget', 'förringa'), line('förringe inget', 'förringe'), line('förringning är onödig')] },
  { pattern: '^förringa', lines: [line('en vanlig rad'), line('förringa inget', 'förringa'), line('utan att förringa')] },
  { pattern: 'förringa$', lines: [line('ingen vill förringa', 'förringa'), line('förringa inget'), line('en vanlig sista rad')] },
  { pattern: String.raw`\bförringa\b`, lines: [line('utan att förringa konsten', 'förringa'), line('förringning är onödig')] },
  { pattern: 'för(?=ringa)', lines: [line('utan att förringa', 'för'), line('Vi ska förnya allt')] },
  { pattern: 'för(?!nya)ringa', lines: [line('utan att förringa', 'förringa'), line('Vi ska förnya allt')] },
  { pattern: '(?<=att )förringa', lines: [line('utan att förringa', 'förringa'), line('förringa inget')] },
  { pattern: '(?<!att )förringa', lines: [line('utan att förringa'), line('förringa inget', 'förringa')] },
  { pattern: String.raw`för\d{2,3}`, lines: [line('för12 gäller', 'för12'), line('för1234 gäller', 'för123'), line('för1 gäller'), line('för många')] },
  { pattern: String.raw`^för\D+$`, lines: [line('för stora ord', 'för stora ord'), line('för123 gäller'), line('en vanlig rad')] },
  { pattern: String.raw`för\+`, lines: [line('för+ gäller', 'för+'), line('för++ gäller', 'för+'), line('för många')] },
  { pattern: String.raw`för\|namn`, lines: [line('för|namn gäller', 'för|namn'), line('förnamn gäller'), line('en vanlig rad')] },
  { pattern: String.raw`\(förringa\)`, lines: [line('(förringa) inget', '(förringa)'), line('förringa inget')] },
  { pattern: 'för[ ]+många', lines: [line('för   många ord', 'för många'), line('för+många ord'), line('förmycket ord')] },
  { pattern: String.raw`foo\s+baz\s+bar`, lines: [line('foo   baz  bar', 'foo baz bar'), line('foo alone bar')] },
  { pattern: String.raw`över\p{L}+`, lines: [line('överdriva inte', 'överdriva'), line('överflödigt nu', 'överflödigt'), line('över123 nu')] },
  { pattern: 'För.*', lines: [line('För många än för få', 'För många än för få'), line('Vi ska förnya allt', 'förnya allt'), line('en vanlig rad')] },
  { pattern: 'förringa|överdriva', lines: [line('förringa inget', 'förringa'), line('överdriva inte', 'överdriva'), line('för många')] },
  { pattern: 'förring', lines: [line('förringa inget', 'förringa'), line('förringning är onödig', 'förringning'), line('för många')] },
  { pattern: 'z{3}', lines: [line('en vanlig rad'), line('en annan rad')] },
  { pattern: 'för[', invalid: true, lines: [line('en vanlig rad')] },
  { pattern: '(för', invalid: true, lines: [line('en vanlig rad')] },
  { pattern: 'för{2,1}', invalid: true, lines: [line('en vanlig rad')] },
  { pattern: String.raw`för\d{2,3}?`, lines: [line('för12 gäller', 'för12'), line('för1234 gäller', 'för12'), line('för1 gäller')] },
  { pattern: 'för(nya)?', lines: [line('för många', 'för'), line('förnya allt', 'förnya'), line('en vanlig rad')] },
  { pattern: 'för[^ ]+|^överdriva$', lines: [line('utan att förringa', 'förringa'), line('överdriva', 'överdriva'), line('utan att överdriva')] },
  { pattern: String.raw`(?:foo|bar)\s+baz`, lines: [line('foo baz', 'foo baz'), line('bar baz', 'bar baz'), line('foo alone')] },
  { pattern: String.raw`foo\nbaz`, lines: [line('foo\nbaz', 'foo baz'), line('foo baz')] },
  { pattern: String.raw`över\p{Unknown}+`, invalid: true, lines: [line('en vanlig rad')] },
  { pattern: String.raw`\bthin\w*\b`, lang: 'en', lines: [line('a thin line', 'thin'), line('a thinking person', 'thinking'), line('nothing there')] },
  { pattern: '(?<=very )thin', lang: 'en', lines: [line('a very thin line', 'thin'), line('a thin line')] },
  { pattern: '^thin', lang: 'en', lines: [line('a thin line'), line('thin ice', 'thin'), line('a normal last line')] },
  { pattern: 'colou?r', lang: 'en', lines: [line('a color choice', 'color'), line('a colour choice', 'colour'), line('a normal line')] },
  { pattern: 'foo bar|baz', lines: [line('foo bar and baz', 'foo bar', 'baz'), line('foo alone')] },
  { pattern: 'för|förringa', lines: [line('förringa inget', 'för'), line('förnya allt', 'för'), line('en vanlig rad')] },
  { pattern: String.raw`(för)\1`, lines: [line('förför gäller', 'förför'), line('förringa inget')] },
  { pattern: String.raw`(foo)|(bar)\2`, lines: [line('foo and barbar', 'foo', 'barbar'), line('bar alone')] },
  { pattern: String.raw`(?<root>för)\k<root>`, lines: [line('förför gäller', 'förför'), line('förringa inget')] },
  { pattern: 'för[^ ]+', lines: [line('förringa och förnya men för få', 'förringa', 'förnya'), line('för många')] },
  { pattern: '^-förringa_$', lines: [line('-förringa_', '-förringa_'), line('förringa')] },
  { pattern: '(?:för){2}', lines: [line('förför gäller', 'förför'), line('förringa inget')] },
  { pattern: 'för.*?a', lines: [line('förringa och förnya allt', 'förringa', 'förnya'), line('för många', 'för många'), line('för nu')] },
  { pattern: '[Ff]ör', lines: [line('Förnya och förringa', 'För', 'för'), line('en vanlig rad')] },
]

const srt = texts => texts.map((text, i) => `${i + 1}\n00:00:${String(i * 2 + 1).padStart(2, '0')},000 --> 00:00:${String(i * 2 + 3).padStart(2, '0')},000\n${text}\n`).join('\n')
const index = [{ link: 'testVideo01', name: 'Test channel || Regex matrix || testVideo01', source: 'YouTube' }]
async function fixtures(route) {
  const url = new URL(route.request().url())
  const file = decodeURIComponent(url.pathname)
  if (url.hostname !== '127.0.0.1') {
    if (file.endsWith('/srts/index.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(index) })
    if (file.endsWith('.srt')) return route.fulfill({ contentType: 'text/plain', body: srt(['en vanlig rad']) })
    if (file.endsWith('/vocabulary.txt')) return route.fulfill({ contentType: 'text/plain', body: '#Test\n(test)|vanlig|\n' })
  }
  return serveFixtures(route)
}

// Wiki-link markup adds spaces around punctuation without changing the span.
const normalize = text => text.replace(/\s+/g, ' ').trim().replace(/\s+([-+|()[\]])/g, '$1').replace(/([-+(|\[])\s+/g, '$1')
async function checkRegexes(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = [], dialogs = [], reports = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss() })
  await page.route('**/*', fixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      const url = [...document.scripts].find(s => s.src.includes('/language/language.js')).src
      window._regexMatrixSearch = (await import(url)).searchTextChanged
      $('#numberOfFindingsToShow').val('-1')
      window.SEARCH_RESULT_PAGE_SIZE = 1000
      Object.assign(window._appSettings, { contextLinesBefore: 0, contextLinesAfter: 0, autoPrefixSearch: false })
    })
    for (const c of cases) {
      const actual = await page.evaluate(async ({ pattern, sv, en, lang }) => {
        window.allSubtitles = { testVideo01: { sv, en, source: 'YouTube', fileName: 'Test channel || Regex matrix || testVideo01' } }
        window._shownWordToItemsMap = {}
        const input = document.getElementById('searchText')
        input.value = pattern
        window.forceLangForNextSearch = lang
        let error = null
        try { await window._regexMatrixSearch.call(input) } catch (e) { error = e.message }
        const keys = [...new Set(Object.values(window._shownWordToItemsMap || {}).flat().map(it => Number(it.line.index)))].sort((a, b) => a - b)
        const rows = [...document.querySelectorAll('#result .srt-file .line[data-lang-code="' + lang + '"]')].map(el => ({
          index: Number(el.dataset.lineIndex), highlights: [...el.querySelectorAll('.highlight')].map(h => h.textContent),
        }))
        return { error, keys, rows, query: window.searchText, text: document.getElementById('result').textContent }
      }, { pattern: c.pattern, lang: c.lang || 'sv',
        sv: srt(c.lines.map((l, i) => c.lang === 'en' ? 'Svensk översättning ' + i : l.text)),
        en: srt(c.lines.map((l, i) => c.lang === 'en' ? l.text : 'English translation ' + i)) })
      try {
        assert.equal(actual.error, null, 'search must handle the expression without throwing')
        const expected = c.lines.flatMap((l, i) => l.highlights.length ? [i + 1] : [])
        assert.deepEqual(actual.keys, expected, 'exact set of matching subtitle cues')
        if (c.invalid) {
          assert.match(actual.text, /Invalid regular expression/i)
          assert.equal(actual.rows.length, 0)
        } else {
          assert(!actual.text.includes('Loading…'), 'search finishes')
          for (const i of expected) assert(actual.rows.some(row => row.index === i), 'matching cue ' + i + ' is rendered')
          for (const row of actual.rows) {
            assert(expected.includes(row.index), 'no non-matching cue is rendered')
            assert.deepEqual(row.highlights.map(normalize), c.lines[row.index - 1].highlights.map(normalize), 'exact highlighted text in cue ' + row.index)
          }
        }
        reports.push({ pattern: c.pattern, passed: true })
      } catch (e) {
        reports.push({ pattern: c.pattern, passed: false, issue: e.message, actual })
        console.log('FAIL ' + JSON.stringify(c.pattern) + ': ' + e.message.split('\n')[0])
      }
    }
    const failed = reports.filter(r => !r.passed)
    if (process.env.REGEX_REPORT) fs.writeFileSync(process.env.REGEX_REPORT + (mobile ? '-mobile' : '-desktop') + '.json', JSON.stringify({ errors, dialogs, reports }, null, 2))
    console.log(`${mobile ? 'Mobile' : 'Desktop'} regex matrix: ${reports.length - failed.length}/${reports.length} passed`)
    assert.deepEqual(errors, [])
    assert.deepEqual(dialogs, [])
    assert.equal(failed.length, 0, 'all regex result/highlight checks pass')
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await checkRegexes(browser, false)
    if (!process.argv.includes('--desktop-only')) await checkRegexes(browser, true)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })

module.exports = { checkRegexes }
