// Browser regression for in-app subtitle suggestions. Native Android/OS file
// dialogs cannot be reordered; this verifies the accessible in-app list instead.
// Run: node tests/browser/local-file-picker.cjs
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

const fixture = [
  '<!doctype html><html><head><meta charset="utf-8">',
  '<script src="/vendor/jquery.js"></script>',
  '<script src="/vendor/jquery-ui.min.js"></script>',
  '<link rel="stylesheet" href="/vendor/jquery-ui.min.css">',
  '<link rel="stylesheet" href="/language.css"></head><body>',
  '<input type="file" id="localFiles" multiple>',
  '<script type="module">',
  "import {openLocalSubtitlePicker} from '/language/local-file-picker.js';",
  'window.openFixture = (names) => {',
  " const files = names.map(name => new File(['fixture'], name, {type: name.endsWith('.srt') ? 'text/plain' : 'audio/mpeg'}));",
  ' window.pickedFixture = null;',
  ' openLocalSubtitlePicker({ files, targetLanguage: "sv", onPlay: async choice => {',
  '  window.pickedFixture = { media: choice.mediaFile.name,',
  '    subtitle: choice.subtitleFile && choice.subtitleFile.name,',
  '    english: choice.englishFile && choice.englishFile.name };',
  ' }});',
  '};',
  '</script></body></html>',
].join('\n')

async function testPicker(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 780 } : { width: 1024, height: 800 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', route => {
    if (new URL(route.request().url()).pathname === '/local-picker-fixture.html') {
      return route.fulfill({ body: fixture, contentType: 'text/html' })
    }
    return serveFixtures(route)
  })
  try {
    await page.goto('http://127.0.0.1:3000/local-picker-fixture.html')
    await page.waitForFunction(() => !!window.openFixture)

    await page.evaluate(() => window.openFixture(['x.mp3', 'different.srt', 'x.en.srt', 'x.srt', 'x.sv.srt']))
    const names = await page.locator('#localSubtitlePickerDialog .local-subtitle-file-body strong').allTextContents()
    assert.deepEqual(names, ['x.srt', 'x.sv.srt', 'x.en.srt', 'different.srt'])
    assert.equal(await page.locator('#localSubtitlePickerDialog input[type=radio]:checked').count(), 1)
    await page.locator('#localSubtitlePickerDialog .local-subtitle-file').filter({hasText:'different.srt'}).click()
    await page.getByRole('button', {name:'Use subtitle & play'}).click()
    assert.deepEqual(await page.evaluate(() => window.pickedFixture),
      {media:'x.mp3', subtitle:'different.srt', english:null})

    // Choosing only an MP3 must not claim an unselected SRT exists.
    await page.evaluate(() => window.openFixture(['x.mp3']))
    assert.match(await page.locator('#localSubtitlePickerDialog').innerText(), /Expected: x.srt/)
    assert.equal(await page.getByRole('button', {name:'Use subtitle & play'}).isDisabled(), true)
    await page.locator('#localSubtitlePickerDialog input[type=file]').setInputFiles({
      name:'x.srt', mimeType:'text/plain',
      buffer:Buffer.from('1\n00:00:00,000 --> 00:00:01,000\nHej!\n'),
    })
    assert.equal(await page.locator('#localSubtitlePickerDialog .local-subtitle-file-body strong').innerText(), 'x.srt')
    await page.getByRole('button', {name:'Use subtitle & play'}).click()
    assert.deepEqual(await page.evaluate(() => window.pickedFixture),
      {media:'x.mp3', subtitle:'x.srt', english:null})

    await page.evaluate(() => window.openFixture(['x.mp3', 'unrelated.srt']))
    await page.getByRole('button', {name:'Play without subtitles'}).click()
    assert.deepEqual(await page.evaluate(() => window.pickedFixture),
      {media:'x.mp3', subtitle:null, english:null})
    assert.deepEqual(errors, [])
    console.log((mobile ? 'Mobile' : 'Desktop') + ': local subtitle picker passed')
  } finally {
    await page.close()
  }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args:['--no-sandbox', '--disable-dev-shm-usage']})
  try {
    await testPicker(browser, false)
    await testPicker(browser, true)
  } finally {
    await browser.close()
  }
})().catch(e => { console.error(e); process.exitCode = 1 })

module.exports = { testPicker }
