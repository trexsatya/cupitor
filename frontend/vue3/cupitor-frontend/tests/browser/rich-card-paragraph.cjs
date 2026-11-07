const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

;(async () => {
  const ckeditor = process.env.CKEDITOR_CLASSIC_PATH
    ? fs.readFileSync(process.env.CKEDITOR_CLASSIC_PATH, 'utf8')
    : await (async () => {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@41.4.2/build/ckeditor.js')
      assert(r.ok, 'CKEditor bundle unavailable')
      return r.text()
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
      page.on('pageerror', error => console.error('[rich editor]', error.message))
      await page.route('http://editor.test/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/classic.js')
          return route.fulfill({ contentType: 'text/javascript', body: ckeditor })
        if (url.pathname === '/')
          return route.fulfill({ contentType: 'text/html', body: `
            <div id="editor"></div><div id="reopen"></div>
            <script src="/classic.js"></script>
            <script type="module">
              import { installRichCardUnderline } from '/language/rich-card-underline.js';
              import { installRichCardStrikethrough } from '/language/rich-card-strikethrough.js';
              import { installRichCardShortcuts } from '/language/rich-card-shortcuts.js';
              import { installRichCardParagraphTools } from '/language/rich-card-paragraph.js';
              const setup = editor => {
                installRichCardStrikethrough(editor);
                installRichCardUnderline(editor);
                installRichCardShortcuts(editor);
                installRichCardParagraphTools(editor);
              };
              window.editor = await ClassicEditor.create(document.querySelector('#editor'));
              setup(editor);
              editor.setData('<p>bold italic strike underline</p>');
              window.reopenEditor = async html => {
                window.reopened = await ClassicEditor.create(document.querySelector('#reopen'));
                setup(reopened);
                reopened.setData(html);
                return reopened.getData();
              };
              window.ready = true;
            </script>` })
        return route.fulfill({ path: path.join(__dirname, '../../public', url.pathname) })
      })
      await page.goto('http://editor.test/')
      await page.waitForFunction(() => window.ready)
      const buttons = await page.locator('.cup-card-paragraph-tools button').allTextContents()
      assert.equal(buttons.length, 6, 'four alignment and two indentation actions')

      // Format four separate ranges without replacing the contents of a focused
      // editor between keystrokes. CKEditor 5 uses an inline filler for its
      // live selection and cannot safely be setData() mid-keyboard event.
      const formats = [
        { key: 'Control+b', start: 0, end: 4, pattern: /<strong>bold<\\/strong>/i },
        { key: 'Control+i', start: 5, end: 11, pattern: /<(?:i|em)>italic<\\/(?:i|em)>/i },
        { key: 'Control+Shift+x', start: 12, end: 18, pattern: /<s>strike<\\/s>/i },
        { key: 'Control+u', start: 19, end: 28, pattern: /<u>underline<\\/u>/i },
      ]
      for (const format of formats) {
        await page.evaluate(({ start, end }) => {
          const block = editor.model.document.getRoot().getChild(0)
          editor.model.change(writer => writer.setSelection(
            writer.createRange(writer.createPositionAt(block, start),
              writer.createPositionAt(block, end))))
          editor.editing.view.focus()
        }, format)
        await page.keyboard.press(format.key)
        const html = await page.evaluate(() => editor.getData())
        assert.match(html, format.pattern, format.key + ' applies rich-card formatting')
      }

      await page.getByRole('button', { name: 'Align center', exact: true }).click()
      await page.getByRole('button', { name: 'Increase indent', exact: true }).click()
      await page.getByRole('button', { name: 'Increase indent', exact: true }).click()
      const html = await page.evaluate(() => editor.getData())
      assert.match(html, /text-align:\\s*center/i, 'alignment is serialized to HTML')
      assert.match(html, /margin-left:\\s*4em/i, 'two indent steps are serialized to HTML')

      const savedHtml = await page.evaluate(html => window.reopenEditor(html), html)
      assert.match(savedHtml, /text-align:\\s*center/i, 'alignment survives reopen')
      assert.match(savedHtml, /margin-left:\\s*4em/i, 'indent survives reopen')
      assert.match(savedHtml, /<u>underline<\\/u>/i, 'underline survives reopen')

      await page.getByRole('button', { name: 'Align right', exact: true }).first().click()
      const right = await page.evaluate(() => editor.getData())
      assert.match(right, /text-align:\\s*right/i)
      await page.getByRole('button', { name: 'Decrease indent', exact: true }).first().click()
      const reduced = await page.evaluate(() => editor.getData())
      assert.match(reduced, /margin-left:\\s*2em/i)
      await page.close()
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: Ctrl formatting shortcuts, underline HTML roundtrip, alignment and indentation passed`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
