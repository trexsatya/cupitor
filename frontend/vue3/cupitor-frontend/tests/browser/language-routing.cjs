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
  const published = new Map(), catalogRequests = []
  let offlineCatalog = false
  await page.exposeFunction('__publishHintWrites', writes => { for (const [path, text] of writes) published.set('/' + path, text) })
  const swedishVocabulary = '#Shapes, arrangements and conditions\n(opening, gap)|öppning|slits|hål|glugg|gluggar|springa|springor|\n' +
    '#Food, Drink, kitchen, Eating\n(drink)|dricka|dricker|drack|druckit|\n(sip)|smutta|smuttar|\n' +
    '#Objects\n(chair)|stol|stolar|\n#Phrases\n(greeting)|ha en bra dag|\n#Other verbs\n(sip)|sippa|\n'
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.includes('/vocabulary-catalog/') || pathname.endsWith('/vocabulary-meanings.json') || pathname.endsWith('/vocabulary-hints-hi.json')) catalogRequests.push(pathname)
    if (offlineCatalog && pathname.includes('/vocabulary-catalog/')) return route.abort('failed')
    const savedFile = [...published].find(([path]) => pathname.endsWith(path))
    if (savedFile) return route.fulfill({contentType: pathname.endsWith('.json') ? 'application/json' : 'text/plain', body: savedFile[1]})
    if (pathname.endsWith('/vocabulary-hints/hi.txt')) return route.fulfill({
      contentType:'text/plain', body:'drink = पीना | peena\nsip = घूँट लेना'
    })
    if (pathname.endsWith('.hi.srt')) return route.fulfill({status:404, body:''})
    if (pathname.endsWith('.sv.srt')) return route.fulfill({
      contentType:'text/plain', body:'1\n00:00:01,000 --> 00:00:03,000\ndricka\n\n2\n00:00:03,000 --> 00:00:05,000\nHa en bra dag\n'
    })
    if (pathname.endsWith('.en.srt')) return route.fulfill({
      contentType:'text/plain', body:'1\n00:00:01,000 --> 00:00:03,000\ndrink\n\n2\n00:00:03,000 --> 00:00:05,000\nHave a good day\n'
    })
    if (pathname.endsWith('/vocabulary-meanings.json')) return route.fulfill({status:404, body:''})
    if (pathname.endsWith('/swedish/vocabulary-hints-hi.json')) return route.fulfill({json:{
      version:1, meanings:{ chair:{label:'Chair',hints:{hi:['कुर्सी']}} },
      groups:{ chairs:{language:'sv',category:'Objects',line:'(chair)|stol|stolar|',forms:[],meanings:['chair']} },
    }})
    if (pathname.endsWith('/vocabulary-hints-hi.json')) return route.fulfill({status:404, body:''})
    if (pathname.endsWith('/swedish/vocabulary.txt')) {
      return route.fulfill({contentType:'text/plain', body:swedishVocabulary})
    }
    if (pathname.endsWith('/spanish/vocabulary.txt')) {
      return route.fulfill({contentType:'text/plain', body:'#Food, Drink, kitchen, Eating\n(drink)|beber|tomar|\n'})
    }
    if (pathname.endsWith('/french/vocabulary.txt')) {
      return route.fulfill({contentType:'text/plain', body:'#Food, Drink, kitchen, Eating\n(drink)|boire|je bois|bu|\n'})
    }
    if (pathname.endsWith('/german/vocabulary.txt')) {
      return route.fulfill({contentType:'text/plain', body:'#Food, Drink, kitchen, Eating\n(drink)|trinken|trinkt|trank|getrunken|\n'})
    }
    return serveFixtures(route)
  })
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.__familiarLanguages = []
    window.FamiliarLanguageBridge = { postMessage: language => window.__familiarLanguages.push(language) }
    window.TranslateRequest = { postMessage(raw) {
      const { id, source, target, text } = JSON.parse(raw)
      queueMicrotask(() => window.__cupTranslated(id,
        source === 'sv' && target === 'hi' && text.toLowerCase() === 'dricka' ? 'पीना' : text))
    } }
  })
  await page.goto('http://127.0.0.1:3000/language.html?lang=swedish', {waitUntil:'networkidle'})
  const query = page.locator('#searchText')
  const results = page.locator('#vocabularyResult')
  const tools = page.locator('#mobileSearchTools')
  const openTools = async () => {
    if (mobile && !await tools.isVisible()) await page.locator('#mobileSearchToolsBtn').click()
  }
  const optionsButton = page.locator('#searchVocabularyByPrefixBtn')
  const openSearchOptions = async () => {
    if (!await page.locator('#searchVocabularyMenu').isVisible()) {
      await optionsButton.click()
    }
  }
  const closeOptions = async () => {
    if (await tools.isVisible()) await tools.getByRole('button', {name:'Close tools'}).click()
    else await optionsButton.click()
  }
  const openEditPreference = mobile ? openTools : openSearchOptions
  const search = async value => { await query.fill(value); await query.press('Tab') }
  try {
    assert.equal(await page.locator('#vocabularyLookupLanguage').isVisible(), !mobile)
    assert.equal(await page.locator('#vocabularyLearningLanguage').isVisible(), !mobile)
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
    const editor = page.getByRole('dialog', {name:'Edit vocabulary hints'})
    assert.equal(await editor.getByRole('textbox', {name:'English hints'}).inputValue(), 'opening, gap')
    await editor.getByRole('button', {name:'Cancel'}).click()
    await openEditPreference()
    await editPreference.uncheck()
    await closeOptions()
    assert.equal(await edit.isVisible(), false)
    await openSearchOptions()
    await page.getByRole('combobox', {name:'I know well', exact:true}).selectOption('hi')
    await page.waitForFunction(() => window.__familiarLanguages.at(-1) === 'hi')
    await closeOptions()
    await search('कुर्सी')
    const chair = results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'stolar'})
    await chair.first().waitFor()
    assert.equal(await chair.locator('mark').count(), 0)
    await search('chhed')
    await results.locator('mark').filter({hasText:'hål'}).first().waitFor()
    await search('dricka')
    const drink = results.locator('.similar-segment-header').filter({hasText:'dricka'}).first()
    await drink.waitFor()
    assert.match(await drink.innerText(), /पीना/)
    await drink.click()
    assert.match(await results.locator('.similar-segment-body:visible').first().innerText(), /घूँट लेना.*smutta/)
    const translations = page.locator('#translationPanel')
    await translations.getByRole('button', {name:'पीना', exact:true}).waitFor()
    const google = translations.getByRole('link', {name:'Google Translate'})
    assert.equal(new URL(await google.getAttribute('href')).searchParams.get('tl'), 'hi')
    const resultsGroup = page.locator('#result .subtitle-result-toggle').filter({hasText:'dricka'}).first()
    await resultsGroup.waitFor()
    if (await resultsGroup.getAttribute('aria-expanded') === 'false') await resultsGroup.click()
    const translate = page.getByTitle('Translate the visible lines to Hindi').first()
    const translatedVideo = await translate.getAttribute('data-url')
    await translate.click()
    await page.locator('#result .secondary-line[lang="hi"]').first().waitFor()
    assert.equal(await page.locator('#result .secondary-line[lang="hi"] .line-text').first().textContent(), 'पीना')
    const saved = await page.evaluate(async () => {
      const original = window.GitHubUtils.commitMultipleFiles
      const writes = []
      try {
        window.GitHubUtils.commitMultipleFiles = async ({files}) => {
          for (const file of files) writes.push([file.path, await file.getContent('')])
          return {committed: true}
        }
        await window.flushPendingSrtEdits()
        return writes
      } finally {
        window.GitHubUtils.commitMultipleFiles = original
      }
    })
    assert(saved.some(([path, text]) => path.endsWith('.hi.srt') && text.includes('पीना')))
    assert(!saved.some(([path]) => path.endsWith('.en.srt')))
    await search('stol')
    await results.locator('.similar-segment-header').filter({hasText:'stol'}).first().waitFor()
    await resultsGroup.waitFor({state:'detached'})
    await search('dricka')
    await resultsGroup.waitFor()
    await page.locator('#subtitleSearchStatus[data-complete="true"]').waitFor()
    if (await resultsGroup.getAttribute('aria-expanded') === 'false') await resultsGroup.click()
    const reopened = page.locator('#result .lines-cntnr').filter({
      has: page.locator(`.play-btn-container[data-url="${translatedVideo}"]`),
    }).first()
    await reopened.evaluate(element => element.scrollIntoView({block:'center'}))
    const restored = reopened.locator('.secondary-line[lang="hi"]').getByText('पीना', {exact:true})
    await restored.waitFor()
    for (const card of [
      {id:translatedVideo, word:'dricka', timeStart:1, timeEnd:3, lineIndex:1, answer:'पीना', target:'HI'},
      {id:translatedVideo === 'testVideo01' ? 'testVideo02' : 'testVideo01',
        word:'dag', timeStart:3, timeEnd:5, lineIndex:2, answer:'Have a good day', target:'EN'},
    ]) {
      await page.evaluate(({answer, target, ...item}) => {
        window.ytPlayer = {
          getPlayerState: () => 2, getCurrentTime: () => 1,
          getVideoData: () => ({video_id:item.id}), pauseVideo() {},
        }
        window._appSettings.practiceRevealMode = 'both'
        window.openPracticeMode({queue:[{...item, source:'YouTube'}], single:true})
      }, card)
      const practice = page.locator('#practiceMode')
      await practice.locator('.practice-back').getByText(card.answer, {exact:true}).waitFor()
      assert.equal(await practice.locator('.practice-dir').textContent(), 'SV → ' + card.target)
      await page.evaluate(() => window.closePracticeMode())
    }
    await search('peena')
    await results.locator('mark').filter({hasText:'dricka'}).first().waitFor()
    const language = page.getByRole('combobox', {name:'Search language'})
    assert.deepEqual(await language.locator('option:not([hidden])').allTextContents(), ['Swedish', 'English', 'Hindi'])
    await language.selectOption({label:'Hindi'})
    await resultsGroup.waitFor()
    assert.match(await google.getAttribute('href'), /[?&]sl=hi&tl=sv(?:&|$)/)
    await search('greeting')
    await results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'ha en bra dag'}).waitFor()
    await page.locator('#result .subtitle-result-toggle').filter({hasText:/ha en bra dag/i}).first().waitFor()
    assert.equal(await language.inputValue(), 'known')

    await language.selectOption({label:'English'})
    await search('drink')
    const englishDrink = results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'dricka'})
    await englishDrink.waitFor()
    assert.match(await englishDrink.innerText(), /\(drink\)/)
    await page.waitForFunction(() => window._resultsSearchLang === 'en' && window._subtitleSearchCompletion?.complete &&
      window.searchResult.length > 0)
    assert.match(await google.getAttribute('href'), /[?&]sl=en&tl=sv(?:&|$)/)

    await openEditPreference()
    await editPreference.check()
    await closeOptions()
    await search('sip')
    const sip = results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'smuttar'})
    await sip.getByRole('button', {name:'Edit vocabulary'}).click()
    const hindiHints = editor.getByRole('textbox', {name:'Hindi hints for this line'})
    assert.equal(await hindiHints.inputValue(), 'घूँट लेना')
    const sharedSip = editor.getByRole('group', {name:'Shared Hindi catalog'}).getByRole('textbox', {name:'sip'})
    assert.equal(await sharedSip.inputValue(), 'घूँट लेना')
    await page.evaluate(vocabulary => {
      window.__hintWrites = []
      const original = window.GitHubUtils.commitMultipleFiles
      window.GitHubUtils.commitMultipleFiles = async options => {
        if (!options.commitMessage.startsWith('vocab:')) return original(options)
        const snapshot = {
          headSha: 'hint-save-snapshot',
          read: async path => path.endsWith('/vocabulary.txt') ? vocabulary : null,
        }
        const files = options.prepareFiles ? await options.prepareFiles(snapshot) : options.files
        // The write plan is fixed before parallel transforms run.
        await Promise.all([...files].reverse().map(async file => {
          const next = await file.getContent(await snapshot.read(file.path), snapshot)
          if (next != null) window.__hintWrites.push([file.path, next])
        }))
        await window.__publishHintWrites(window.__hintWrites)
        return {committed:true}
      }
    }, swedishVocabulary)
    await hindiHints.fill('घूँट भरना | ghoont bharna')
    await sharedSip.fill('चुस्की लेना | chuski lena')
    await editor.getByRole('button', {name:'Save changes'}).click()
    await editor.waitFor({state:'detached'})
    const writes = await page.evaluate(() => window.__hintWrites)
    assert(writes.length > 2, 'vocabulary, hint chunks and their index are saved together')
    const vocabularyWrite = writes.find(([path]) => path.endsWith('/vocabulary.txt'))
    const indexWrite = writes.find(([path]) => path.endsWith('/vocabulary-catalog/index.json'))
    assert(vocabularyWrite && indexWrite)
    assert(!writes.some(([path]) => path.endsWith('/vocabulary-meanings.json')), 'the monolithic catalog is not rewritten')
    assert.match(vocabularyWrite[1], /\t\[entry:[a-z0-9-]+\]/)
    const hintRecords = Object.assign({}, ...writes.filter(([path]) => path.includes('/hints/sv/hi/')).map(([, text]) => JSON.parse(text).records || {}))
    const [id, hints] = Object.entries(hintRecords).find(([, aliases]) => aliases.includes('ghoont bharna'))
    assert(vocabularyWrite[1].includes('(sip)|smutta|smuttar|\t[entry:' + id + ']'))
    assert.deepEqual(hints, ['घूँट भरना', 'ghoont bharna'])
    const sharedRecords = Object.assign({}, ...writes.filter(([path]) => path.includes('/shared-hints/hi/')).map(([, text]) => JSON.parse(text).records || {}))
    assert.deepEqual(sharedRecords.sip, ['चुस्की लेना', 'chuski lena'])
    assert(writes.filter(([path]) => path.includes('/vocabulary-catalog/') && !path.endsWith('/index.json')).every(([, text]) => Buffer.byteLength(text) <= 65536))
    await language.selectOption({label:'Hindi'})
    await search('ghoont bharna')
    await sip.waitFor()
    assert.match(await sip.innerText(), /घूँट भरना/)
    await search('chuski lena')
    await results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'sippa'}).waitFor()
    await sip.waitFor({state:'detached'})
    await search('peena')
    await results.locator('mark').filter({hasText:'dricka'}).first().waitFor()
    catalogRequests.length = 0
    await page.evaluate(async () => { await window.cupitorUserData.flush() })
    offlineCatalog = true
    await page.reload({waitUntil:'networkidle'})
    await language.selectOption({label:'Hindi'})
    await search('ghoont bharna')
    await results.locator('[data-vocab-match-kind="hint"]').filter({hasText:'smuttar'}).waitFor()
    assert(!catalogRequests.some(path => /vocabulary-meanings\.json|vocabulary-hints-hi\.json/.test(path)), 'split storage reloads from its cache without legacy catalogs')
    offlineCatalog = false
    await search('peena')
    await results.locator('mark').filter({hasText:'dricka'}).first().waitFor()
    await openSearchOptions()
    await page.locator('#vocabularyLearningLanguage').selectOption('spanish')
    await page.waitForURL(/lang=spanish/)
    await results.locator('mark').filter({hasText:'beber'}).first().waitFor()
    assert.equal(await query.inputValue(), 'peena')
    assert.equal(await page.locator('#vocabularyLookupLanguage').inputValue(), 'hi')
    assert.deepEqual(await language.locator('option:not([hidden])').allTextContents(), ['Spanish', 'English', 'Hindi'])
    assert.equal(await language.locator('option:checked').textContent(), 'Hindi')
    for (const [name, label, word] of [['french', 'French', 'boire'], ['german', 'German', 'trinken']]) {
      await openSearchOptions()
      const learning = page.locator('#vocabularyLearningLanguage')
      assert.deepEqual(await learning.locator('option').allTextContents(), ['Swedish', 'Spanish', 'French', 'German'])
      await learning.selectOption(name)
      await page.waitForURL(new RegExp('lang=' + name))
      // Shared-cue translations match the whole row. Only the older seeded
      // form-specific meanings highlight individual native forms.
      const translatedRow = results.locator('[data-vocab-match-kind="hint"]').filter({hasText:word}).first()
      try { await translatedRow.waitFor() }
      catch (error) {
        console.error({name, mobile, query:await query.inputValue(), results:await results.innerText()})
        throw error
      }
      assert.match(await translatedRow.innerText(), /पीना/)
      assert.equal(await query.inputValue(), 'peena')
      assert.equal(await page.locator('#vocabularyLookupLanguage').inputValue(), 'hi')
      assert.deepEqual(await language.locator('option:not([hidden])').allTextContents(), [label, 'English', 'Hindi'])
    }
    assert.deepEqual(errors, [])
    console.log((mobile ? 'Mobile' : 'Desktop') + ': optional vocabulary controls and cross-language lookup passed')
  } finally { await page.close() }
}
;(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args:['--no-sandbox']})
  try {
    for (const [name, code, supported, term] of [['Swedish','sv',true,'gräl'], ['SPANISH','es',true,'luz'],
      ['french','fr',true,'maisons'], ['german','de',true,'Häuser'], ['hindi','hi',false], ['unknown','',false]]) {
      const page = await browser.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})
      const errors = [], dataRequests = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', route => {
        const url = route.request().url()
        if (url.includes('/db/language/')) dataRequests.push(new URL(url).pathname)
        if (name.toLowerCase() === 'spanish' && new URL(url).pathname.endsWith('/vocabulary.txt'))
          return route.fulfill({contentType:'text/plain', body:'#Spanish\n(light)|luz|\n(speak)|hablar|\n'})
        if (['fr', 'de'].includes(code)) {
          if (new URL(url).pathname.endsWith('/srts/index.json')) return route.fulfill({json:[]})
          if (new URL(url).pathname.endsWith('/vocabulary.txt')) return route.fulfill({contentType:'text/plain',
            body:code === 'fr' ? '#Home\n(house)|maison|la maison|maisons|\n' : '#Home\n(house)|Haus|das Haus|Häuser|\n'})
        }
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
        assert(dataRequests.filter(url => /\/(?:srts\/index.json|vocabulary.txt)$/.test(url))
          .every(url => url.includes('/db/language/' + name.toLowerCase() + '/')))
        assert.equal(await page.locator('#searchText').isEnabled(), true)
        await page.locator('#searchText').fill(term)
        await page.locator('#searchText').press('Tab')
        try { await page.waitForFunction(() => !document.querySelector('#result').textContent.includes('Loading…')) }
        catch(error) {console.error({language:name,errors}, await page.evaluate(() => ({search:window.searchText,result:document.querySelector('#result').textContent.slice(0,800)}))); throw error}
        if (['fr', 'de'].includes(code)) {
          const results = page.locator('#vocabularyResult')
          await results.getByText(new RegExp(term)).first().waitFor()
          await page.locator('#searchText').fill('house')
          await page.locator('#searchText').press('Tab')
          await results.locator('[data-vocab-match-kind="hint"]').filter({hasText:code === 'fr' ? 'maison' : 'Haus'}).waitFor()
        }
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
