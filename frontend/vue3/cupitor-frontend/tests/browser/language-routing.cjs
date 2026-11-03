const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const {serveFixtures} = require('./language-dialogs.cjs')
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
  } finally {await browser.close()}
})().catch(error => {console.error(error); process.exitCode=1})
