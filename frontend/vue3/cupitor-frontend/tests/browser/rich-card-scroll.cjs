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
        'import { sizeRichCardEditingArea, observeRichCardEditingArea } from "/language/rich-card-layout.js";',
        'import { installMobileRichToolbar } from "/language/rich-card-mobile-toolbar.js";',
        'window.resizeEditingArea = () => sizeRichCardEditingArea(document.querySelector("#richCardEditor"));',
        'window.desktopEditor = ' + (!mobile) + ';',
        'window.editor = await ClassicEditor.create(document.querySelector(".rce-host"));',
        'window.mobileToolbar = installMobileRichToolbar(editor, document.querySelector("#richCardEditor"), { mobile: !window.desktopEditor });',
        'editor.setData(Array.from({length:95},(_,i)=>"<p>Paragraph "+i+" '+
          'containing enough words to make it wrap and scroll inside the editor, not the dialog.</p>").join(""));',
        'window.sizedOnOpen = window.desktopEditor ? window.resizeEditingArea() : null;',
        'window.stopEditorLayoutWatch = window.desktopEditor ? observeRichCardEditingArea(document.querySelector("#richCardEditor")) : () => {};',
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
      if (mobile) {
        const toggle = page.locator('.rce-toolbar-toggle')
        await toggle.waitFor({state:'visible'})
        assert.equal(await page.locator('.ck-editor__top .ck-toolbar').isHidden(), true,
          'Mobile rich formatting buttons start collapsed')
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        if (process.env.SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
          await page.screenshot({path: path.join(process.env.SCREENSHOT_DIR, 'cupitor-rich-editor-mobile-collapsed.png')})
        }
        await toggle.click()
        assert.equal(await page.locator('.ck-editor__top .ck-toolbar').isVisible(), true)
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
        if (process.env.SCREENSHOT_DIR) {
          await page.screenshot({path: path.join(process.env.SCREENSHOT_DIR, 'cupitor-rich-editor-mobile-expanded.png')})
        }
        await toggle.click()
        assert.equal(await page.locator('.ck-editor__top .ck-toolbar').isHidden(), true,
          'Formatting toolbar collapses again without closing editor')
      } else {
        assert.equal(await page.locator('.rce-toolbar-toggle').count(), 0,
          'Desktop rich controls remain expanded with no toggle')
      }
      if (!mobile) assert.equal(await page.evaluate(() => window.sizedOnOpen), true,
        'Desktop CKEditor wrapper must be found and sized on open')
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
      if (!mobile) {
        const available = await page.locator('#richCardEditor').evaluate(el => el.clientHeight)
        assert(before.clientHeight > available * 0.65,
          'The editing surface must use the tall dialog instead of a fixed 360px fallback: ' +
          JSON.stringify({ before, available }))
      }
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

        // A bottom-line click/selection must not scroll the dialog or shrink
        // CKEditor: only the editable is scrollable, and it keeps its position.
        await editable.evaluate(el => { el.scrollTop = el.scrollHeight })
        const bottomBefore = await editable.evaluate(el => ({
          scroll: el.scrollTop, height: el.clientHeight, max: el.scrollHeight - el.clientHeight,
        }))
        await page.locator('.ck-editor__editable p').last().click()
        await page.waitForTimeout(100)
        const bottomAfter = await page.evaluate(() => {
          const el = document.querySelector('.ck-editor__editable')
          return {
            scroll: el.scrollTop, height: el.clientHeight, max: el.scrollHeight - el.clientHeight,
            rootScroll: document.querySelector('#richCardEditor').scrollTop,
            dialogScroll: document.querySelector('.ui-dialog').scrollTop,
          }
        })
        assert(bottomAfter.scroll > bottomAfter.max - 180,
          'Clicking the last line must not jump back to the top: ' + JSON.stringify({ bottomBefore, bottomAfter }))
        assert.equal(bottomAfter.rootScroll, 0)
        assert.equal(bottomAfter.dialogScroll, 0)
        assert(Math.abs(bottomAfter.height - bottomBefore.height) <= 2,
          'Clicking text must not collapse the expanded editor')

        // A temporary focus loss can reflow CKEditor in a desktop WebView.
        // Refit on focus without changing the caret/selection or scroll position.
        await page.evaluate(() => {
          const el = document.querySelector('.ck-editor__editable')
          el.style.height = '160px'
          window.dispatchEvent(new Event('blur'))
          window.dispatchEvent(new Event('focus'))
        })
        await page.waitForFunction(expected =>
          Math.abs(document.querySelector('.ck-editor__editable').clientHeight - expected) <= 2,
          bottomBefore.height)
        const restored = await editable.evaluate(el => ({
          height: el.clientHeight, scroll: el.scrollTop,
        }))
        assert(restored.scroll > 80, 'Refocusing must retain the editor scroll position')
        console.log('Desktop: full-height editor, last-line click and window-refocus recovery passed')
      } else {
        assert.equal(before.touchAction, 'pan-y', 'mobile editor allows native vertical swipes')
        const scrollTop = await editable.evaluate(el => { el.scrollTop = 240; return el.scrollTop })
        assert(scrollTop > 80, 'Mobile rich-card editor must scroll long content')
      }
      console.log((mobile ? 'Mobile' : 'Desktop') +
        ': rich card overflow, independent scrolling and desktop resize passed')
      await page.evaluate(() => window.stopEditorLayoutWatch())
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
