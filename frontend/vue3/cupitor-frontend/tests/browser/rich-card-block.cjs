const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

;(async () => {
  const ckeditor = process.env.CKEDITOR_CLASSIC_PATH
    ? fs.readFileSync(process.env.CKEDITOR_CLASSIC_PATH, 'utf8')
    : await (await fetch('https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@41.4.2/build/ckeditor.js')).text()
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 800 },
        isMobile: mobile, hasTouch: mobile })
      page.on('pageerror', error => console.error(error))
      await page.route('http://editor.test/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/classic.js')
          return route.fulfill({ contentType: 'text/javascript', body: ckeditor })
        if (url.pathname === '/')
          return route.fulfill({ contentType: 'text/html', body: `
            <div id="editor"></div><script src="/classic.js"></script>
            <script type="module">
              import { installRichCardBlockFormatting } from '/language/rich-card-block-formatting.js';
              window.installBlocks = installRichCardBlockFormatting;
              window.editor = await ClassicEditor.create(document.querySelector('#editor'));
              installRichCardBlockFormatting(editor);
              editor.setData('<p>first</p><p>second</p>');
              editor.model.change(writer => writer.setSelection(
                writer.createPositionAt(editor.model.document.getRoot().getChild(0), 1)));
              window.ready = true;
            </script>` })
        return route.fulfill({ path: path.join(__dirname, '../../public', url.pathname) })
      })
      await page.goto('http://editor.test/')
      await page.waitForFunction(() => window.ready)
      for (const [option, value] of [
        ['Align center', 'center'], ['Align right', 'right'],
        ['Align justify', 'justify'], ['Align left', 'left'],
      ]) {
        await page.getByRole('button', { name: option }).click()
        const output = await page.evaluate(() => editor.getData())
        assert.match(output, new RegExp('text-align:' + value), option + ' writes persisted HTML style')
      }
      await page.getByRole('button', { name: 'Increase indent' }).click()
      await page.getByRole('button', { name: 'Increase indent' }).click()
      let output = await page.evaluate(() => editor.getData())
      assert.match(output, /margin-left:80px/, 'indent increases by 40px per step')
      await page.getByRole('button', { name: 'Decrease indent' }).click()
      output = await page.evaluate(() => editor.getData())
      assert.match(output, /margin-left:40px/, 'outdent reduces the indentation level')

      const restored = await page.evaluate(async html => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const copy = await ClassicEditor.create(host)
        installBlocks(copy)
        copy.setData(html)
        return copy.getData()
      }, output)
      assert.match(restored, /text-align:left/, 'reloading the card retains alignment')
      assert.match(restored, /margin-left:40px/, 'reloading the card retains indentation')
      assert.equal(await page.getByRole('button', { name: 'Align justify' }).count(), 2,
        'alignment controls remain visible in both editor instances')
      await page.close()
      console.log(`${mobile ? 'Mobile' : 'Desktop'} rich card alignment and indentation preserved through HTML roundtrip`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
