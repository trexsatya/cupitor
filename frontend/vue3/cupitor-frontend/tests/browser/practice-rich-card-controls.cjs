const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')

;(async () => {
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
      page.on('pageerror', error => { throw error })
      const html = `<!doctype html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/vendor/jquery-ui.min.css">
        <link rel="stylesheet" href="/language.css">
        </head><body class="practice-mode">
        <div id="practiceMode" style="display:block"></div>
        <div id="manualEntryEditor" style="display:none">
          <textarea id="meeSource">Original card</textarea>
          <button id="openRich" type="button">Rich text</button>
        </div>
        <div id="richCardEditor" style="display:none">
          <div id="richText" contenteditable="true"></div>
        </div>
        <script src="/vendor/jquery.js"></script>
        <script src="/vendor/jquery-ui.min.js"></script>
        <script type="module">
          import { arrangeRichCardDialog } from '/language/rich-card-modal.js';
          const studyZ = 2147483647;
          const $manual = jQuery('#manualEntryEditor');
          const $rich = jQuery('#richCardEditor');
          let release = () => {};
          window.savedText = null;
          // The real Practice dialogopen/focus hook gives these dialogs the
          // maximum stacking layer, not the usual 100030 layer.
          jQuery(document).on('dialogopen dialogfocus', function (e) {
            const wrap = jQuery(e.target).closest('.ui-dialog');
            if (!wrap.length) return;
            wrap.appendTo('body').addClass('above-practice-mode');
            wrap[0].style.setProperty('z-index', String(studyZ), 'important');
          });
          $manual.dialog({
            title: 'Edit card', modal: true, width: ${mobile ? 360 : 480},
            open() { jQuery('body').addClass('manual-editor-open dialog-above-practice'); },
            buttons: {
              Save() {
                window.savedText = $manual.find('#meeSource').val();
                $manual.dialog('close');
              }
            }
          });
          jQuery('#openRich').on('click', () => {
            jQuery('#richText').text(jQuery('#meeSource').val());
            $rich.dialog({
              title: 'Rich editor', modal: true,
              dialogClass: '${mobile ? 'rich-card-editor-mobile' : 'rich-card-editor-desktop'}',
              width: ${mobile ? 350 : 700},
              buttons: {
                Apply() {
                  jQuery('#meeSource').val(jQuery('#richText').text());
                  $rich.dialog('close');
                },
                Cancel() { $rich.dialog('close'); }
              },
              close() {
                release();
                release = () => {};
                $rich.dialog('destroy');
              }
            });
            release = arrangeRichCardDialog($rich, jQuery('#meeSource'), {
              studyActive: true, studyZ,
            });
          });
          window.ready = true;
        </script>
        </body></html>`
      await page.route('http://editor.test/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/')
          return route.fulfill({ contentType: 'text/html', body: html })
        return route.fulfill({
          path: path.join(__dirname, '../../public', url.pathname),
        })
      })
      await page.goto('http://editor.test/')
      await page.waitForFunction(() => window.ready)

      const rich = page.locator('.ui-dialog:has(> #richCardEditor)')
      const parent = page.locator('.ui-dialog:has(> #manualEntryEditor)')
      const openRich = async () => {
        if (mobile) await page.locator('#openRich').tap()
        else await page.locator('#openRich').click()
        await rich.waitFor({ state: 'visible' })
        const layers = await page.evaluate(() => {
          const parent = document.querySelector('#manualEntryEditor').closest('.ui-dialog')
          const rich = document.querySelector('#richCardEditor').closest('.ui-dialog')
          const overlay = jQuery('#richCardEditor').dialog('instance').overlay[0]
          return {
            parent: Number(getComputedStyle(parent).zIndex),
            rich: Number(getComputedStyle(rich).zIndex),
            overlay: Number(getComputedStyle(overlay).zIndex),
            parentIsModal: jQuery('#manualEntryEditor').dialog('option', 'modal'),
          }
        })
        assert.equal(layers.parentIsModal, false, 'nested parent modal must release its focus trap')
        assert(layers.parent < layers.overlay && layers.overlay < layers.rich,
          'rich dialog and buttons must be above both the parent and its overlay: ' +
          JSON.stringify(layers))
        assert(await rich.getByRole('button', { name: 'Apply', exact: true }).isVisible())
      }

      await openRich()
      await rich.locator('#richText').fill('Edited from Practice')
      if (mobile) await rich.getByRole('button', { name: 'Apply' }).tap()
      else await rich.getByRole('button', { name: 'Apply' }).click()
      await rich.waitFor({ state: 'detached' })
      assert.equal(await page.locator('#meeSource').inputValue(), 'Edited from Practice')
      assert.equal(await page.evaluate(() => jQuery('#manualEntryEditor').dialog('option', 'modal')), true,
        'the parent modal must be restored after Apply')

      await openRich()
      await rich.locator('#richText').fill('Discarded edit')
      if (mobile) await rich.getByRole('button', { name: 'Cancel' }).tap()
      else await rich.getByRole('button', { name: 'Cancel' }).click()
      await rich.waitFor({ state: 'detached' })
      assert.equal(await page.locator('#meeSource').inputValue(), 'Edited from Practice')
      assert.equal(await page.evaluate(() => jQuery('#manualEntryEditor').dialog('option', 'modal')), true)

      await openRich()
      if (mobile) await rich.locator('.ui-dialog-titlebar-close').tap()
      else await rich.locator('.ui-dialog-titlebar-close').click()
      await rich.waitFor({ state: 'detached' })
      assert.equal(await page.locator('#meeSource').inputValue(), 'Edited from Practice')
      assert.equal(await page.evaluate(() => jQuery('#manualEntryEditor').dialog('option', 'modal')), true)

      if (mobile) await parent.getByRole('button', { name: 'Save' }).tap()
      else await parent.getByRole('button', { name: 'Save' }).click()
      assert.equal(await page.evaluate(() => window.savedText), 'Edited from Practice',
        'the parent card Save action must work after closing the rich editor')
      await page.close()
      console.log((mobile ? 'Mobile' : 'Desktop') +
        ': nested Practice rich editor Apply, Cancel, Close and card Save passed')
    }
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
