const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const {serveFixtures} = require('./language-dialogs.cjs')
async function checkCacheSources(browser) {
  const page = await browser.newPage()
  let marker = 'Original corpus', requests = 0
  await page.route('**/*', route => {
    if (new URL(route.request().url()).pathname.endsWith('.srt')) {
      requests++
      return route.fulfill({contentType:'text/plain', body:`1\n00:00:01,000 --> 00:00:03,000\n${marker}\n`})
    }
    return serveFixtures(route)
  })
  // Same login throughout: repository and branch changes must not reuse the
  // owner's old subtitles just because the link and owner still match.
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    if (!localStorage.getItem('cupitor:account'))
      localStorage.setItem('cupitor:account', JSON.stringify({login:'trexsatya',repo:'trexsatya.github.io',branch:'gh-pages',other:null}))
  })
  const load = async () => {
    await page.goto('http://127.0.0.1:3000/language.html', {waitUntil:'networkidle'})
    await page.evaluate(async () => {
      await window._subtitlesReadyPromise
      // Wait for fire-and-forget cache commits before reloading the page.
      while ((await window.cupitorCacheStats()).count !== 3) await new Promise(r => setTimeout(r, 20))
    })
    assert.match(await page.evaluate(() => window.allSubtitles.testVideo01.sv), new RegExp(marker))
  }
  try {
    await load()
    assert.equal(requests, 6)
    requests = 0
    await load()
    assert.equal(requests, 0, 'unchanged complete corpora remain cached')
    for (const changes of [{repo:'new-language-data'}, {branch:'next'}]) {
      await page.evaluate(changes => localStorage.setItem('cupitor:account', JSON.stringify({
        ...JSON.parse(localStorage.getItem('cupitor:account')), ...changes,
      })), changes)
      marker += ' changed'
      requests = 0
      await load()
      assert.equal(requests, 6, 'repository and branch changes refetch the entire active corpus')
    }
    console.log('Subtitle cache: same-source reuse and repository/branch isolation passed')
  } finally {await page.close()}
}
;(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args:['--no-sandbox']})
  try {
    for (const [name, code, supported] of [['Swedish','sv',true], ['SPANISH','es',true], ['hindi','hi',false], ['unknown','',false]]) {
      const page = await browser.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})
      const errors = [], dataRequests = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', route => {
        const url = route.request().url()
        if (url.includes('/db/language/')) dataRequests.push(new URL(url).pathname)
        if (name.toLowerCase() === 'spanish' && new URL(url).pathname.endsWith('/vocabulary.txt'))
          return route.fulfill({contentType:'text/plain', body:'#Spanish\n(light)|luz|\n(speak)|hablar|\n'})
        return serveFixtures(route)
      })
      await page.addInitScript(() => {
        window.dontConfirmOnRefresh = true
        localStorage.setItem('cupitor:account', JSON.stringify({login:null}))
        localStorage.setItem('cupitor:wordMaps:swedish@~guest', '[]')
      })
      await page.goto('http://127.0.0.1:3000/language.html?lang=' + name, {waitUntil:'networkidle'})
      await page.evaluate(() => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      assert.equal(await page.locator('meta[name="cupitor-target-lang"]').getAttribute('content'), code)
      assert.equal(await page.locator('meta[name="cupitor-target-lang-name"]').getAttribute('content'), name.toLowerCase())
      assert.equal(await page.locator('meta[name="cupitor-study-supported"]').getAttribute('content'), String(supported))
      if (supported) {
        assert(dataRequests.some(url => url.includes('/db/language/' + name.toLowerCase() + '/srts/index.json')))
        assert(dataRequests.every(url => !url.includes('/db/language/' + name + '/')))
        assert.equal(await page.locator('#searchText').isEnabled(), true)
        await page.locator('#searchText').fill(code === 'es' ? 'luz' : 'gräl')
        await page.locator('#searchText').press('Tab')
        try { await page.waitForFunction(() => !document.querySelector('#result').textContent.includes('Loading…')) }
        catch(error) {console.error({language:name,errors}, await page.evaluate(() => ({search:window.searchText,result:document.querySelector('#result').textContent.slice(0,800)}))); throw error}
      } else {
        assert.match(await page.locator('#unsupportedStudyLanguage').innerText(), /does not support/)
        assert.equal(await page.locator('#searchText').isDisabled(), true)
        assert.equal(dataRequests.filter(url => /\/(?:srts\/index.json|vocabulary.txt)$/.test(url)).length, 0)
      }
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => localStorage.getItem('cupitor:wordMaps:swedish@~guest')), '[]')
      console.log(name + ': language metadata, data paths, readiness and support state passed')
      await page.close()
    }
    await checkCacheSources(browser)
  } finally {await browser.close()}
})().catch(error => {console.error(error); process.exitCode=1})
