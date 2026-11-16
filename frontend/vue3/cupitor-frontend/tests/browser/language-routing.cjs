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
async function checkMultilingualVocabulary(browser, mobile) {
  const viewport = mobile ? {width:390,height:844} : {width:1280,height:900}
  const page = await browser.newPage({viewport, isMobile:mobile, hasTouch:mobile})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/vocabulary-meanings.json')) return route.fulfill({status:404, body:''})
    if (pathname.endsWith('/swedish/vocabulary-hints-hi.json')) return route.fulfill({json:{
      version:1, meanings:{ chair:{label:'Chair',hints:{hi:['कुर्सी']}} },
      groups:{ chairs:{language:'sv',category:'Objects',line:'(chair)|stol|stolar|',forms:[],meanings:['chair']} },
    }})
    if (pathname.endsWith('/vocabulary-hints-hi.json')) return route.fulfill({status:404, body:''})
    if (pathname.endsWith('/swedish/vocabulary.txt')) {
      return route.fulfill({contentType:'text/plain', body:
        '#Shapes, arrangements and conditions\n(opening, gap)|öppning|slits|hål|glugg|gluggar|springa|springor|\n' +
        '#Food, Drink, kitchen, Eating\n(drink)|dricka|dricker|drack|druckit|\n#Objects\n(chair)|stol|stolar|\n'})
    }
    if (pathname.endsWith('/spanish/vocabulary.txt')) {
      return route.fulfill({contentType:'text/plain', body:'#Food, Drink, kitchen, Eating\n(drink)|beber|tomar|\n'})
    }
    return serveFixtures(route)
  })
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  await page.goto('http://127.0.0.1:3000/language.html?lang=swedish', {waitUntil:'networkidle'})
  const query = page.locator('#searchText')
  const results = page.locator('#vocabularyResult')
  const tools = page.locator('#mobileSearchTools')
  const openTools = async () => {
    if (mobile && !await tools.isVisible()) await page.locator('#mobileSearchToolsBtn').click()
  }
  const optionsButton = page.locator('#searchVocabularyByPrefixBtn')
  const openSearchOptions = async () => {
    if (mobile) {
      await openTools()
      const details = tools.locator('.search-sheet-options')
      if (await details.getAttribute('open') === null) await details.locator('summary').click()
    } else if (!await page.locator('#searchVocabularyMenu').isVisible()) {
      await optionsButton.click()
    }
  }
  const closeOptions = async () => {
    if (mobile) await tools.getByRole('button', {name:'Close tools'}).click()
    else await optionsButton.click()
  }
  const openEditPreference = mobile ? openTools : openSearchOptions
  const search = async value => { await query.fill(value); await query.press('Tab') }
  try {
    assert.equal(await page.locator('#vocabularyLookupLanguage').isVisible(), false)
    assert.equal(await page.locator('#vocabularyLearningLanguage').isVisible(), false)
    await search('gap')
    const match = results.locator('[data-vocab-match-kind="hint"]').first()
    await match.waitFor()
    assert.match(await results.innerText(), /öppning.*hål/)
    const edit = match.locator('.vocab-hint-edit')
    assert.equal(await edit.count(), 1)
    assert.equal(await edit.isVisible(), false)
    assert.equal(await page.getByRole('checkbox', {name:'Show Edit vocabulary'}).count(), 0)
    await openEditPreference()
    const editPreference = page.getByRole('checkbox', {name:'Show Edit vocabulary'})
    await editPreference.check()
    await closeOptions()
    await edit.waitFor({state:'visible'})
    await edit.click()
    const editor = page.getByRole('dialog', {name:'Edit vocabulary'})
    await editor.getByRole('button', {name:'Cancel'}).click()
    await openEditPreference()
    await editPreference.uncheck()
    await closeOptions()
    assert.equal(await edit.isVisible(), false)
    await openSearchOptions()
    await page.getByRole('combobox', {name:'I know well', exact:true}).selectOption('hi')
    await closeOptions()
    await search('कुर्सी')
    const chair = results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'stolar'})
    await chair.first().waitFor()
    assert.equal(await chair.locator('mark').count(), 0)
    await search('chhed')
    await results.locator('mark').filter({hasText:'hål'}).first().waitFor()
    await search('peena')
    await results.locator('mark').filter({hasText:'dricka'}).first().waitFor()
    await openSearchOptions()
    await page.locator('#vocabularyLearningLanguage').selectOption('spanish')
    await page.waitForURL(/lang=spanish/)
    await results.locator('mark').filter({hasText:'beber'}).first().waitFor()
    assert.equal(await query.inputValue(), 'peena')
    assert.equal(await page.locator('#vocabularyLookupLanguage').inputValue(), 'hi')
    assert.deepEqual(errors, [])
    console.log((mobile ? 'Mobile' : 'Desktop') + ': optional vocabulary controls and cross-language lookup passed')
  } finally { await page.close() }
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
    await checkMultilingualVocabulary(browser, true)
    await checkMultilingualVocabulary(browser, false)
  } finally {await browser.close()}
})().catch(error => {console.error(error); process.exitCode=1})
