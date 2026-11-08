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
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<link rel="stylesheet" href="/language.css">',
    '<style>body{margin:0;padding:12px;font-family:system-ui;background:#f5f7f9;color:#263747}',
    '.lang-toolbar{padding:7px;border:1px solid #dbe3ed;border-radius:9px;background:white}',
    '.fixture-panel{margin:18px 0 0;padding:14px;border:1px solid #dce4ed;background:white;border-radius:9px}',
    '.results-scroll{max-height:230px;overflow-y:auto;overscroll-behavior:contain}',
    '.fixture-row{min-height:86px;padding:7px;border-bottom:1px solid #e9edf1}',
    '.fixture-row:last-child{border:0}</style></head><body>',
    '<div class="lang-toolbar"><button id="prevSearchBtn" class="lang-tool-btn">◀</button>',
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
    '<input value="färgsprakande inside an input"></section>',
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
    await page.waitForTimeout(320)
    console.log('Find result probe', JSON.stringify(await page.evaluate(() => ({
      count: document.querySelector('#cupPageFindCount')?.textContent,
      state: document.querySelector('#cupPageFindBar')?.__cupPageFind?.getState(),
      marks: document.querySelectorAll('mark.cup-page-find-fallback').length,
      rows: document.querySelectorAll('.fixture-row').length,
      rects: [...document.querySelectorAll('.fixture-row')].map(x => [x.getBoundingClientRect().width,x.getBoundingClientRect().height])
    }))))
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
