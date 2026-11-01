const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    localStorage.setItem('cupitor:account', JSON.stringify({ login: null }))
    localStorage.setItem('cupitor:wordMaps:swedish@~guest', JSON.stringify([
      {version: 1, id: 'first', name: 'Conflict', edges: [], nodes: [{id:'a',word:'Gräl',x:180,y:120}, {id:'b',word:'Bråk',x:600,y:400}]},
      {version: 1, id: 'second', name: 'Escalation', edges: [], nodes: [{id:'c',word:'Gräl',x:2100,y:1400}, {id:'d',word:'Bråk',x:900,y:500}]},
    ]))
    localStorage.setItem('cupitor:wordMaps:spanish@~guest', JSON.stringify([
      {version:1,id:'wrong-language',name:'Gräl',nodes:[],edges:[]},
    ]))
  })
  const visibleMatch = async () => {
    const bounds = await page.locator('.wm-viewport').boundingBox()
    const node = await page.locator('.wm-search-match').first().boundingBox()
    assert.ok(node.x >= bounds.x && node.x + node.width <= bounds.x + bounds.width, 'match is horizontally visible')
    assert.ok(node.y >= bounds.y && node.y + node.height <= bounds.y + bounds.height, 'match is vertically visible')
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html?lang=swedish', {waitUntil:'networkidle'})
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.locator('#searchText').fill('gräl|bråk')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(() => document.querySelectorAll('#wordMapResults .word-map-hit').length === 2)
    assert.equal(await page.locator('#wordMapResults .highlight').count(), 2)
    await page.locator('#wordMapSearchIncludeCb').uncheck()
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 0)
    await page.locator('#wordMapSearchIncludeCb').check()
    await page.locator('.word-map-hit[data-map-id="second"]').click()
    const dialog = page.locator('#wordMapsDialog')
    await dialog.waitFor({state:'visible'})
    assert.equal(await dialog.locator('[aria-label="Saved word map"]').inputValue(), 'second')
    assert.equal(await dialog.locator('.wm-search-match').count(), 2)
    assert.equal(await dialog.locator('[aria-label="Edit mode"]').isChecked(), false)
    await visibleMatch()
    await dialog.locator('[aria-label="Enter fullscreen"]').click()
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').getBoundingClientRect().width >= innerWidth - 2)
    const fullscreen = await dialog.boundingBox()
    assert.ok(fullscreen.width >= (mobile ? 388 : 1278), 'fullscreen fills the available viewport')
    await visibleMatch()
    if (process.env.SCREENSHOT_DIR) {
      require('node:fs').mkdirSync(process.env.SCREENSHOT_DIR, {recursive:true})
      await page.screenshot({path:require('node:path').join(process.env.SCREENSHOT_DIR, `word-map-search-${mobile ? 'mobile' : 'desktop'}.png`)})
    }
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    assert.equal(await dialog.isVisible(), true)
    await dialog.locator('[data-node="c"]').click()
    await dialog.getByRole('button', {name:'Find vocabulary & clips', exact:true}).click()
    await page.locator('#wordMapsRestore').waitFor({state:'visible'})
    await page.waitForFunction(() => window._vocabularySearchText === 'gräl' &&
      !document.querySelector('#result').textContent.includes('Loading…'))
    await page.locator('.word-map-hit[data-map-id="first"]').click()
    assert.equal(await dialog.locator('[aria-label="Saved word map"]').inputValue(), 'first')
    assert.equal(await dialog.locator('.wm-search-match').count(), 1)
    assert.equal(await dialog.locator('.wm-search-match').getAttribute('data-node'), 'a')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} word-map search, scoped results, highlights, centered match, fullscreen and minimized retargeting passed`)
  } catch (error) {
    console.error(await page.evaluate(() => ({query: window._vocabularySearchText, search:window.searchText, input:document.querySelector('#searchText').value, text:document.querySelector('#result').textContent.slice(0,300)})), errors)
    throw error
  } finally { await page.close() }
}
;(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']})
  try { await check(browser, false); await check(browser, true) } finally { await browser.close() }
})().catch(error => {console.error(error);process.exitCode=1})
