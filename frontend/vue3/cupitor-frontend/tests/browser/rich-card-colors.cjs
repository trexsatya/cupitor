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
      await page.route('http://editor.test/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/classic.js') return route.fulfill({ contentType: 'text/javascript', body: ckeditor })
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `
          <div id="editor"></div><script src="/classic.js"></script>
          <script type="module">
            import { installRichCardFormatting } from '/language/rich-card-formatting.js';
            window.editor = await ClassicEditor.create(document.querySelector('#editor'));
            installRichCardFormatting(editor);
            editor.setData('<p>first second third</p>');
            window.ready = true;
          </script>` })
        return route.fulfill({ path: path.join(__dirname, '../../public', url.pathname) })
      })
      await page.goto('http://editor.test/')
      await page.waitForFunction(() => window.ready)
      for (const [title, attribute] of [['Text color', 'cupCardTextColor'], ['Background color', 'cupCardBackgroundColor']]) {
        const select = (start, end) => page.evaluate(({ start, end }) => {
          const p = editor.model.document.getRoot().getChild(0)
          editor.model.change(w => w.setSelection(w.createRange(w.createPositionAt(p, start), w.createPositionAt(p, end))))
          editor.editing.view.focus()
        }, { start, end })
        await select(0, 5)
        await page.locator(`input[aria-label="${title}"]`).evaluate(input => {
          input.dispatchEvent(new Event('pointerdown'))
          input.value = '#993355'
          input.dispatchEvent(new Event('change'))
        })
        for (const [start, end] of [[6, 12], [13, 18]]) {
          await select(start, end)
          const button = page.getByRole('button', { name: `Apply ${title.toLowerCase()}`, exact: true })
          if (mobile) await button.tap(); else await button.click()
          assert.equal(await page.evaluate(attribute => {
            const selection = editor.model.document.selection
            return [...selection.getFirstRange().getItems()].every(item => item.getAttribute(attribute) === '#993355')
          }, attribute), true)
        }
      }
      await page.close()
      console.log(`Repeated text/background color: ${mobile ? 'mobile' : 'desktop'} passed`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
