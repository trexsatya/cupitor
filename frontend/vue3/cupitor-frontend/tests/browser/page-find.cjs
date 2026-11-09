// Browser regression for Find on page (web + Android WebView-sized layout).
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const publicRoot = path.resolve(__dirname, '../../public')
const htmlSource = fs.readFileSync(path.join(publicRoot, 'language.html'), 'utf8')
const resultButton = htmlSource.match(/<button id="toggleResultContainer"[\s\S]*?<\/button>/)?.[0]
const findButton = htmlSource.match(/<button type="button" id="cupPageFindToggle"[\s\S]*?<\/button>/)?.[0]
const findBar = htmlSource.match(/<div id="cupPageFindBar"[\s\S]*?<\/div>/)?.[0]
assert(resultButton && findButton && findBar, 'Find toolbar elements exist in language.html')
assert(!htmlSource.includes('id="toggleMediaRelatedContainer"'), 'obsolete Toggle player was removed')
assert(/id="toggleResultContainer"[\s\S]*?<\/button>\s*<button type="button" id="cupPageFindToggle"/.test(htmlSource),
  'Find icon is immediately beside Toggle results')

function fixture() {
  return [
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<link rel="stylesheet" href="/language.css">',
    '<style>body{margin:0;padding:12px;font-family:system-ui;background:#f5f7f9;color:#263747}',
    '.lang-toolbar{padding:7px;border:1px solid #dbe3ed;border-radius:9px;background:white}',
    '.fixture-panel{margin:18px 0 0;padding:14px;border:1px solid #dce4ed;background:white;border-radius:9px}',
    '.results-scroll{max-height:230px;overflow-y:auto;overscroll-behavior:contain}',
    '.fixture-row{min-height:86px;padding:7px;border-bottom:1px solid #e9edf1}',
    '.fixture-row:last-child{border:0}</style></head><body>',
    '<div id="mainControlInputs"><div class="lang-toolbar"><button id="prevSearchBtn" class="lang-tool-btn">◀</button>',
    '<button class="lang-tool-btn" title="Settings">⚙</button>',
    '<button class="lang-tool-btn" title="Media">▣</button>',
    resultButton, findButton,
    '<button id="nextSearchBtn" class="lang-tool-btn">▶</button></div>',
    findBar,
    '<section class="fixture-panel" aria-label="Main page">',
    '<h3>Subtitle results</h3><p>Use the Find icon to locate text on the page.</p>',
    '<div class="results-scroll" id="results">',
    '<div class="fixture-row">En färgsprakande kväll, vid havet.</div>',
    '<div class="fixture-row">En annan färgsprakande berättelse.</div>',
    '<div class="fixture-row">Det var en färgsprakande dag.</div></div>',
    '<div hidden>färgsprakande not visible</div>',
    '<div style="display:none">färgsprakande hidden by CSS</div>',
    '<div contenteditable="true">färgsprakande editor</div>',
    '<input value="färgsprakande inside an input"></section></div>',
    '<div id="practiceMode" style="display:none"><div class="practice-topbar">',
    '<button type="button" class="practice-settings" aria-label="Practice settings">⋯</button>',
    '<button type="button" class="practice-search" aria-label="Search this word">🔎</button>',
    '</div><div class="practice-settings-panel" style="display:none">',
    '<button type="button" class="cup-page-find-study-trigger practice-find" aria-label="Find on page">Find on page</button>',
    '</div><div class="practice-card"><div class="practice-flipper">
    '<div class="practice-face practice-front-face"><div class="practice-front">blueberry current card</div></div>',
    '</div></div></div>',
    '<div id="recPlayingBanner" style="display:none"><div class="rec-pb-top">',
    '<button type="button" class="rec-pb-info-btn" aria-label="Show details">ℹ</button>',
    '</div><div class="rec-pb-details" style="display:none">',
    '<button type="button" class="cup-page-find-study-trigger rec-pb-find-btn" aria-label="Find on page">Find on page</button>',
    '</div></div>',
    '<div id="recPlayingSubs" style="display:none"><p>apricot playing subtitle</p></div>',
    '<div id="dialogFixture" style="display:none"><p>mandarin in a visible dialog</p></div>',
    '<script type="module" src="/language/page-find.js"></script></body></html>'
  ].join('')
}

async function run(browser, mobile, legacy) {
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1120, height: mobile ? 760 : 780 },
    isMobile: mobile, hasTouch: mobile,
  })
  try {
    page.on('pageerror', error => console.error('Find page error:', error.message))
    if (legacy) {
      await page.addInitScript(() => {
        try { Object.defineProperty(CSS, 'highlights', { value: undefined, configurable: true }) } catch (_) {}
      })
    }
    await page.route('http://find.test/**', route => {
      const p = new URL(route.request().url()).pathname
      if (p === '/') return route.fulfill({ contentType: 'text/html', body: fixture() })
      const file = path.resolve(publicRoot, '.' + p)
      if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file))
        return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ contentType: p.endsWith('.css') ? 'text/css' : 'text/javascript',
        body: fs.readFileSync(file) })
    })
    await page.goto('http://find.test/', { waitUntil: 'load' })
    await page.waitForFunction(() => !!document.getElementById('cupPageFindBar')?.__cupPageFind)
    const bar = page.locator('#cupPageFindBar')
    const input = page.locator('#cupPageFindInput')
    const count = page.locator('#cupPageFindCount')
    if (!mobile) await page.keyboard.press('Control+f')
    else await page.locator('#cupPageFindToggle').click()
    assert.equal(await bar.isVisible(), true)
    assert.equal(await input.evaluate(el => document.activeElement === el), true)
    await input.fill('färgsprakande')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 3')
    assert.equal(await count.textContent(), '1 of 3', 'only 3 visible non-editable matches')
    const status = async () => page.evaluate(() => document.querySelector('#cupPageFindBar').__cupPageFind.getState())
    assert.equal((await status()).total, 3)
    await input.press('Enter')
    assert.equal(await count.textContent(), '2 of 3', 'Enter moves forward')
    assert.equal((await status()).focused, true, 'Enter keeps Find field focused')
    await input.press('Shift+Enter')
    assert.equal(await count.textContent(), '1 of 3', 'Shift+Enter moves backward')
    assert.equal((await status()).focused, true, 'Shift+Enter keeps focus')
    await input.press('Shift+Enter')
    assert.equal(await count.textContent(), '3 of 3', 'previous wraps')
    await page.locator('#cupPageFindNext').click()
    assert.equal(await count.textContent(), '1 of 3', 'next wraps')
    assert.equal((await status()).focused, true, 'arrow buttons return focus to input')
    await input.fill('not-there')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === 'No matches')
    assert.equal(await page.locator('#cupPageFindPrevious').isDisabled(), true)
    await input.fill('färgsprakande')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 3')
    if (!mobile) {
      await page.keyboard.press('Control+g')
      assert.equal(await count.textContent(), '2 of 3', 'Ctrl+G goes next')
      await page.keyboard.press('Control+Shift+g')
      assert.equal(await count.textContent(), '1 of 3', 'Ctrl+Shift+G goes previous')
    }
    assert.equal((await status()).usingCssHighlights, !legacy)
    const screenshotDir = process.env.SCREENSHOT_DIR
    if (screenshotDir && !legacy) {
      fs.mkdirSync(screenshotDir, { recursive: true })
      await page.screenshot({ path: path.join(screenshotDir,
        mobile ? 'cupitor-webapp-find-mobile.png' : 'cupitor-webapp-find-desktop.png') })
    }
    await input.press('Escape')
    assert.equal(await bar.isVisible(), false)
    assert.equal((await status()).total, 0, 'closing clears matches')
    // Find belongs to the entire visible HTML document. The app hides its
    // main page toolbar/results when Practice or Player opens; each study
    // toolbar exposes the same Find bar and cards change without navigation.
    await page.evaluate(() => {
      document.body.classList.add('practice-mode', 'practice-no-video')
      document.querySelector('#practiceMode').style.display = 'flex'
    })
    await page.evaluate(() => {
      const settings = document.querySelector('#practiceMode .practice-settings')
      settings.addEventListener('click', () => {
        const panel = document.querySelector('#practiceMode .practice-settings-panel')
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
      })
      const info = document.querySelector('#recPlayingBanner .rec-pb-info-btn')
      info.addEventListener('click', () => {
        const banner = document.querySelector('#recPlayingBanner')
        const panel = banner.querySelector('.rec-pb-details')
        const expand = !banner.classList.contains('rec-pb-expanded')
        banner.classList.toggle('rec-pb-expanded', expand)
        panel.style.display = expand ? 'block' : 'none'
      })
    })
    assert.equal(await page.locator('#practiceMode .practice-find').isVisible(), false,
      'Find must not add another topbar magnifier')
    await page.locator('#practiceMode .practice-settings').click()
    assert.equal(await page.locator('#practiceMode .practice-find').isVisible(), true)
    if (screenshotDir && !legacy) {
      await page.screenshot({ path: path.join(screenshotDir,
        mobile ? 'cupitor-practice-more-find-mobile.png' : 'cupitor-practice-more-find-desktop.png') })
    }
    await page.locator('#practiceMode .practice-find').click()
    assert.equal(await bar.isVisible(), true, 'Practice Find must be clickable')
    assert.equal(await page.locator('#practiceMode .practice-settings-panel').isVisible(), false,
      'More panel closes when opening Find')
    await input.fill('färgsprakande')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === 'No matches')
    await input.fill('blueberry')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 1')
    if (screenshotDir && !legacy) {
      await page.screenshot({ path: path.join(screenshotDir,
        mobile ? 'cupitor-find-practice-mobile.png' : 'cupitor-find-practice-desktop.png') })
    }
    await page.evaluate(() => {
      document.querySelector('#practiceMode .practice-front').textContent = 'Next item with pear'
    })
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === 'No matches')
    await page.evaluate(() => {
      document.querySelector('#practiceMode .practice-front').textContent = 'blueberry is now in another item'
    })
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 1')
    assert.equal((await status()).focused, true, 'Find retains its focus after card navigation')
    await page.evaluate(() => {
      document.body.classList.remove('practice-mode', 'practice-no-video')
      document.querySelector('#practiceMode').style.display = 'none'
      document.body.classList.add('rec-playing')
      document.querySelector('#recPlayingBanner').style.display = 'block'
      document.querySelector('#recPlayingSubs').style.display = 'block'
    })
    await input.press('Escape')
    assert.equal(await page.locator('#recPlayingBanner .rec-pb-find-btn').isVisible(), false,
      'Player Find must be in details, not the topbar')
    await page.locator('#recPlayingBanner .rec-pb-info-btn').click()
    assert.equal(await page.locator('#recPlayingBanner .rec-pb-find-btn').isVisible(), true)
    await page.locator('#recPlayingBanner .rec-pb-find-btn').click()
    assert.equal(await page.locator('#recPlayingBanner .rec-pb-details').isVisible(), false,
      'Player details close when opening Find')
    await input.fill('apricot')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 1')
    if (screenshotDir && !legacy) {
      await page.screenshot({ path: path.join(screenshotDir,
        mobile ? 'cupitor-find-player-mobile.png' : 'cupitor-find-player-desktop.png') })
    }
    assert.equal((await status()).focused, true, 'Player details open the same Find bar')
    // The Find panel is accessible above an open dialog, rather than trapped
    // below its high-z-index backdrop. Closing Find leaves the dialog intact.
    await page.evaluate(() => {
      const dialog = document.querySelector('#dialogFixture')
      dialog.style.cssText = 'display:block;position:fixed;inset:0;' +
        'background:white;z-index:2147483647'
    })
    await input.fill('mandarin')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 1')
    await page.keyboard.press('Control+f')
    const reachable = await page.evaluate(() => {
      const bar = document.querySelector('#cupPageFindBar')
      const rect = bar.getBoundingClientRect()
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + 15)?.closest('#cupPageFindBar') === bar
    })
    assert.equal(reachable, true, 'Find stays above high-layer dialogs')
    await input.press('Escape')
    await page.evaluate(() => {
      document.body.classList.remove('rec-playing')
      document.querySelector('#recPlayingBanner').style.display = 'none'
      document.querySelector('#recPlayingSubs').style.display = 'none'
      document.querySelector('#dialogFixture').style.display = 'none'
    })
    await page.locator('#cupPageFindToggle').click()
    await input.fill('färgsprakande')
    await page.waitForFunction(() => document.querySelector('#cupPageFindCount').textContent === '1 of 3')
    await input.press('Escape')
    assert.equal(await bar.isVisible(), false)
    assert.equal((await status()).total, 0, 'closing clears matches')
    if (legacy) assert.equal(await page.locator('mark.cup-page-find-fallback').count(), 0)
    await page.locator('#cupPageFindToggle').click()
    assert.equal(await input.evaluate(el => document.activeElement === el), true)
    console.log((mobile ? 'Mobile' : 'Desktop') + (legacy ? ' legacy' : '') +
      ': Find toolbar, Enter/reverse, count, highlights, focus and close passed')
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
                    process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    await run(browser, false, false)
    await run(browser, true, false)
    await run(browser, false, true)
  } finally {
    await browser.close()
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
