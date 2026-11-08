const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

;(async () => {
  const ckeditor = process.env.CKEDITOR_CLASSIC_PATH
    ? fs.readFileSync(process.env.CKEDITOR_CLASSIC_PATH, 'utf8')
    : await (async () => {
      const response = await fetch('https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@41.4.2/build/ckeditor.js')
      assert(response.ok, 'CKEditor bundle download failed')
      return response.text()
    })()
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  })
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: mobile ? 390 : 1280, height: 800 },
        isMobile: mobile, hasTouch: mobile,
      })
      page.on('pageerror', error => console.error(error.message))
      const body = [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<link rel="stylesheet" href="/language.css">',
        '<style>body{margin:0}.ui-dialog{position:absolute;top:20px;left:12px;',
        'width:90vw;height:700px;box-sizing:border-box;display:flex;flex-direction:column;',
        'border:1px solid #999;background:white}',
        '.ui-dialog-titlebar{flex:0 0 34px}.ui-dialog-buttonpane{flex:0 0 50px}',
        '#richCardEditor.ui-dialog-content{flex:1 1 auto;min-height:0;min-width:0;',
        'box-sizing:border-box;padding:12px}',
        '</style></head><body>',
        '<div class="ui-dialog ' + (mobile ? 'rich-card-editor-mobile' : 'rich-card-editor-desktop') + '">',
        '<div class="ui-dialog-titlebar">Rich editor</div>',
        '<div id="richCardEditor" class="ui-dialog-content">',
        '<label class="rce-paste-option">Keep formatting on paste</label>',
        '<div class="rce-host"></div></div>',
        '<div class="ui-dialog-buttonpane">Apply / Cancel</div></div>',
        '<script src="/classic.js"></script>',
        '<script type="module">',
        'import { sizeRichCardEditingArea } from "/language/rich-card-layout.js";',
        'import { initMobileRichCardToolbar } from "/language/rich-card-mobile-toolbar.js";',
        'window.resizeEditingArea = () => sizeRichCardEditingArea(document.querySelector("#richCardEditor"));',
        'window.desktopEditor = ' + (!mobile) + ';',
        'window.editor = await ClassicEditor.create(document.querySelector(".rce-host"));',
        'window.mobileFormattingToggle = initMobileRichCardToolbar(document.querySelector("#richCardEditor"));',
        'editor.setData(Array.from({length:95},(_,i)=>"<p>Paragraph "+i+" '+
          'containing enough words to make it wrap and scroll inside the editor, not the dialog.</p>").join(""));',
        'window.sizedOnOpen = window.desktopEditor ? window.resizeEditingArea() : null;',
        'window.ready = true;',
        '</script></body></html>',
      ].join('')
      await page.route('http://editor.test/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/classic.js')
          return route.fulfill({ contentType: 'text/javascript', body: ckeditor })
        if (url.pathname === '/')
          return route.fulfill({ contentType: 'text/html', body })
        return route.fulfill({ path: path.join(__dirname, '../../public', url.pathname) })
      })
      await page.goto('http://editor.test/')
      await page.waitForFunction(() => window.ready && document.querySelector('.ck-editor__editable'))
      if (!mobile) assert.equal(await page.evaluate(() => window.sizedOnOpen), true,
        'Desktop CKEditor wrapper must be found and sized on open')
      const toggle = page.locator('#richCardEditor .rce-mobile-tools-toggle')
      assert.equal(await toggle.count(), 1, 'rich editor has one mobile formatting toggle')
      if (mobile) {
        assert.equal(await toggle.isVisible(), true)
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        assert.equal(await page.locator('#richCardEditor .ck-editor__top').isVisible(), false,
          'mobile CKEditor toolbar defaults collapsed')
        await toggle.click()
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
        assert.equal(await page.locator('#richCardEditor .ck-editor__top').isVisible(), true)
        await toggle.click()
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        assert.equal(await page.locator('#richCardEditor .ck-editor__top').isVisible(), false)
        assert(await page.locator('.ck-editor__editable').isVisible(),
          'editing surface stays visible when formatting controls collapse')
      } else {
        assert.equal(await toggle.isVisible(), false,
          'desktop always shows normal CKEditor formatting toolbar')
        assert.equal(await page.locator('#richCardEditor .ck-editor__top').isVisible(), true)
      }
      const metrics = () => page.locator('.ck-editor__editable').evaluate(el => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: getComputedStyle(el).overflowY,
        touchAction: getComputedStyle(el).touchAction,
      }))
      const before = await metrics()
      assert(before.scrollHeight > before.clientHeight + 200,
        'Long rich-card content must overflow the editable, not stretch the modal: ' +
        JSON.stringify(before))
      assert.equal(before.overflowY, 'auto', 'editable owns vertical scrolling')
      const editable = page.locator('.ck-editor__editable')
      if (!mobile) {
        // CKEditor can scroll to its insertion point while loading setData().
        // Verify a fresh downward wheel gesture from the actual top.
        await editable.evaluate(el => { el.scrollTop = 0 })
        const getScrollDetails = () => page.evaluate(() => {
          const el = document.querySelector('.ck-editor__editable')
          const rect = el.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return {
            client: el.clientHeight, height: el.scrollHeight, top: el.scrollTop,
            rect: { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
            hit: hit?.className || hit?.tagName,
            hostTop: document.querySelector('#richCardEditor')?.scrollTop,
            dialogTop: document.querySelector('.ui-dialog')?.scrollTop,
            active: document.activeElement?.className,
          }
        })
        await editable.hover()
        console.log('Rich editor before wheel:', JSON.stringify(await getScrollDetails()))
        await page.mouse.wheel(0, 550)
        await page.waitForTimeout(450)
        const afterWheel = await getScrollDetails()
        console.log('Rich editor after wheel:', JSON.stringify(afterWheel))
        assert(afterWheel.top > 80, 'Wheel should scroll the editor itself: ' + JSON.stringify(afterWheel))
        await page.evaluate(() => {
          document.querySelector('.ui-dialog').style.height = '500px'
          if (!window.resizeEditingArea()) throw new Error('Desktop CKEditor wrapper was not sized after resize')
          document.querySelector('.ck-editor__editable').scrollTop = 0
        })
        const smaller = await metrics()
        assert(smaller.clientHeight < before.clientHeight - 80,
          'Editable should shrink when desktop dialog is resized: ' + JSON.stringify({ before, smaller }))
        await editable.hover()
        await page.mouse.wheel(0, 450)
        await page.waitForFunction(() => document.querySelector('.ck-editor__editable').scrollTop > 80,
          { timeout: 5000 })
      } else {
        assert.equal(before.touchAction, 'pan-y', 'mobile editor allows native vertical swipes')
        const scrollTop = await editable.evaluate(el => { el.scrollTop = 240; return el.scrollTop })
        assert(scrollTop > 80, 'Mobile rich-card editor must scroll long content')
      }
      console.log((mobile ? 'Mobile' : 'Desktop') +
        ': rich card overflow, independent scrolling and desktop resize passed')
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
