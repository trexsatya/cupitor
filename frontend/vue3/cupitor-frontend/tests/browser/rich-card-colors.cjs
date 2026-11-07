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
          <label><input id="preservePasteFormatting" type="checkbox">Keep formatting on paste</label>
          <div id="editor"></div><script src="/classic.js"></script>
          <script type="module">
            import { installRichCardFormatting } from '/language/rich-card-formatting.js';
            import { installRichCardStrikethrough } from '/language/rich-card-strikethrough.js';
            import { installRichCardUnderline } from '/language/rich-card-underline.js';
            import { installRichCardShortcuts } from '/language/rich-card-shortcuts.js';
            import { installRichCardPasteControl } from '/language/rich-card-paste.js';
            window.editor = await ClassicEditor.create(document.querySelector('#editor'));
            installRichCardStrikethrough(editor);
            installRichCardUnderline(editor);
            installRichCardFormatting(editor);
            installRichCardShortcuts(editor);
            installRichCardPasteControl(editor, document.querySelector('#preservePasteFormatting'));
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
      // Paste conversion uses the real CKEditor clipboard pipeline, not a
      // mock: the unchecked default must discard incoming markup, and the
      // checked setting must preserve native CKEditor formatting.
      const pasted = await page.evaluate(() => {
        const keep = document.querySelector('#preservePasteFormatting');
        const pipeline = editor.plugins.get('ClipboardPipeline');
        const defaultOff = !keep.checked;
        const run = preserve => {
          keep.checked = preserve;
          editor.setData('<p>Start </p>');
          const p = editor.model.document.getRoot().getChild(0);
          editor.model.change(w => w.setSelection(editor.model.createPositionAt(p, 'end')));
          pipeline.fire('inputTransformation', {
            content: editor.data.processor.toView('<p><strong>Bold source</strong></p>'),
            dataTransfer: { getData: type => type === 'text/plain' ? 'Bold source' : '' },
            method: 'paste',
          });
          return editor.getData();
        };
        return { defaultOff, off: run(false), on: run(true) };
      });
      assert.equal(pasted.defaultOff, true);
      assert.match(pasted.off, /Bold source/);
      assert.doesNotMatch(pasted.off, /<strong|<b(?:\s|>)/i,
        'default paste mode must remove source bold formatting');
      assert.match(pasted.on, /<(?:strong|b)(?:\s|>)/i,
        'enabling paste formatting must preserve source bold text');
      // Run key-driven formatting last: CKEditor's live cursor can retain an
      // inline filler, so calling setData for a separate paste scenario after
      // these simulated user keystrokes can invalidate it.
      assert.equal(await page.getByRole('button', { name: 'Underline' }).count(), 1,
        'Underline button must exist in CKEditor toolbar');
      const formats = [
        ['Control+b', /<strong>selected<\/strong>/i, 'bold'],
        ['Control+i', /<(?:i|em)>selected<\/(?:i|em)>/i, 'italic'],
        ['Control+Shift+x', /<s>selected<\/s>/i, 'strikethrough'],
        ['Control+u', /<u>selected<\/u>/i, 'underline'],
      ];
      for (const [shortcut, expected, name] of formats) {
        await page.evaluate(() => {
          editor.setData('<p>selected</p>');
          const p = editor.model.document.getRoot().getChild(0);
          editor.model.change(writer => writer.setSelection(
            writer.createRange(writer.createPositionAt(p, 0), writer.createPositionAt(p, 'end'))));
          editor.editing.view.focus();
        });
        await page.keyboard.press(shortcut);
        const html = await page.evaluate(() => editor.getData());
        assert.match(html, expected, shortcut + ' applies ' + name);
        // Underline has a custom converter in Classic: reloading card HTML
        // must retain the underline rather than silently dropping it.
        if (name === 'underline') {
          const restored = await page.evaluate(data => {
            editor.setData(data);
            return editor.getData();
          }, html);
          assert.match(restored, expected, 'underline survives editor save/reload');
        }
      }
      await page.close()
      console.log(`Rich card formatting colors and paste toggle: ${mobile ? 'mobile' : 'desktop'} passed`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
