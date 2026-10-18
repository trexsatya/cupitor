// Exercise the native event through the real dialog and persistence path.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')

const playlist = 'Tillåt mig tvivla - Ord'
const cap = { source: 'caption', title: 'Tillåt mig tvivla',
  url: 'https://www.youtube.com/watch?v=testVideo01', timeParam: 't',
  lines: [{ start: 10, text: 'Tillåt mig tvivla.', translation: 'Allow me to doubt.' },
    { start: 12, text: 'Jag vill förstå.' }] }
const nextCap = { ...cap, lines: [cap.lines[1],
  { start: 15, text: 'Vi söker ett svar.', translation: 'We are looking for an answer.' },
  { start: 18, text: 'Låt oss tänka efter.' }, { start: 18, text: 'Låt oss tänka efter.' }] }

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 900 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = [], alerts = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { alerts.push(d.message()); d.dismiss() })
  page.setDefaultTimeout(10000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.__filed = []
    window.PlaylistBridge = { postMessage: raw => window.__filed.push(JSON.parse(raw)) }
  })
  const click = selector => {
    const el = typeof selector === 'string' ? page.locator(selector) : selector
    return mobile ? el.tap() : el.click()
  }
  const send = async detail => {
    await page.evaluate(detail => window.dispatchEvent(new CustomEvent('cupitorCaptionCapture', { detail })), detail)
    await page.locator('#captionCaptureDialog').waitFor({ state: 'visible' })
  }
  const cancel = () => click(page.locator('#captionCaptureDialog').locator('..').getByRole('button', { name: 'Cancel', exact: true }))
  const read = () => page.evaluate(name => JSON.parse(JSON.stringify(window._recordings[name])), playlist)
  const cards = async () => (await read()).items.Manual.Card
  const select = async id => {
    await page.locator('#capCapPlaylist').selectOption(playlist)
    await page.locator('#capCapItem').selectOption(id)
  }
  const commit = async () => {
    await click('#capCapSave')
    await page.locator('#captionCaptureDialog').waitFor({ state: 'hidden' })
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async playlist => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window._recordings = {
        Default: { items: {} },
        [playlist]: { items: { Manual: { Card: [
          { manual: true, id: 'notes', source: 'Mina anteckningar', target: 'My notes', enabled: true,
            mediaUrl: 'https://example.org/notes', mediaKind: 'link', musicTrackId: 'keep-music', sourceAudioUrl: 'file://keep-voice' },
          { manual: true, id: 'other', source: 'En annan passage', target: 'Another passage', enabled: true }
        ] }, Clips: { Ord: [{ id: 'testVideo02', timeStart: 1, timeEnd: 3, word: 'ord' }] } } },
        Empty: { items: {} }, ReadOnly: { readOnly: true, items: {} },
        Book: { external: true, items: {} }, Combined: { virtual: true, sources: [playlist] }
      }
      window._recording.currentName = playlist
      window._recording.items = window._recordings[playlist].items
      window.openRecordingReviewDialog()
    }, playlist)

    await send(cap)
    assert.equal(await page.locator('#capCapItem').inputValue(), '')
    const destinations = await page.locator('#capCapPlaylist option').allTextContents()
    for (const name of ['ReadOnly', 'Book', 'Combined']) assert(!destinations.includes(name))
    await select('notes')
    assert.equal(await page.locator('#capCapItem option').count(), 3, 'only manual items are offered')
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `capture-merge-${mobile ? 'mobile' : 'desktop'}.png`) })
    }
    await page.locator('#capCapItem').selectOption('')
    await commit()
    let items = await cards()
    assert.equal(items.length, 3, 'New item keeps the original capture behavior')
    const added = items[2], untouched = items[1]
    assert.equal(added.source, 'Tillåt mig tvivla.\nJag vill förstå.')
    assert.equal(added.target, 'Allow me to doubt.\n—')
    assert.equal(added.mediaUrl, cap.url + '&t=10')

    await send(nextCap)
    assert.equal(await page.locator('#capCapItem').inputValue(), '', 'each capture starts with an explicit New item choice')
    await select(added.id)
    assert.equal(await page.locator('#capCapSave').innerText(), 'Merge')
    assert.match(await page.locator('#capCapMergeHint').innerText(), /Existing text and media are kept/)
    const wrap = page.locator('#captionCaptureDialog').locator('..')
    const box = await wrap.boundingBox()
    assert(box.x >= 0 && box.x + box.width <= (mobile ? 430 : 1280), 'dialog fits the viewport')
    await commit()
    items = await cards()
    assert.equal(items.length, 3, 'merge does not create an extra item')
    assert.equal(items[2].id, added.id)
    assert.equal(items[2].mediaUrl, added.mediaUrl)
    assert.equal(items[2].source, added.source + '\nVi söker ett svar.\nLåt oss tänka efter.')
    assert.equal(items[2].target, added.target + '\nWe are looking for an answer.\n—')
    assert.deepEqual(items[1], untouched)
    assert.match(await page.evaluate(() => window.__filed.at(-1).message), /Merged 2 lines.*2 already there/)
    const afterMerge = await read()
    await send({ ...cap, lines: [...cap.lines, ...nextCap.lines] })
    await select(added.id)
    await commit()
    assert.deepEqual(await read(), afterMerge, 'legacy and merged passages are deduplicated together')

    // Appending a page sentence to Target preserves handwritten notes, audio,
    // music and media while keeping the sentence's own line breaks.
    const pageCap = { source: 'page', title: 'A page', url: 'https://example.org/book',
      lines: [{ start: 0, text: 'Han gick hem,\nsa hon.' }] }
    await send(pageCap)
    await select('notes')
    await page.locator('input[name="capCapField"][value="target"]').check()
    await commit()
    const note = (await cards())[0]
    assert.equal(note.source, 'Mina anteckningar\n—\n—')
    assert.equal(note.target, 'My notes\nHan gick hem,\nsa hon.')
    assert.equal(note.sourceAudioUrl, 'file://keep-voice')
    assert.equal(note.musicTrackId, 'keep-music')
    assert.equal(note.mediaUrl, 'https://example.org/notes')
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(async () => { await window._subtitlesReadyPromise })
    assert.deepEqual((await cards())[0], note, 'merged blocks persist across reloads')
    await send(pageCap)
    await select('notes')
    await commit()
    assert.deepEqual((await cards())[0], note, 'persisted multiline page capture is not duplicated')

    // Changing the playlist clears a prior merge choice. Cancelling leaves
    // both the original item and the proposed destination untouched.
    await send(nextCap)
    await select(added.id)
    await page.locator('#capCapPlaylist').selectOption('Empty')
    assert.equal(await page.locator('#capCapItem').inputValue(), '')
    assert.equal(await page.locator('#capCapItem').isDisabled(), true)
    assert.equal(await page.locator('#capCapSave').innerText(), 'Add')
    await cancel()
    const beforeCancel = await read()
    await send({ ...cap, lines: [{ start: 99, text: 'Do not save' }] })
    await select('notes')
    await cancel()
    assert.deepEqual(await read(), beforeCancel)

    // A stale item or a playlist that became read-only refuses the write and
    // keeps the incoming capture on screen for a different destination.
    const lastCap = { ...cap, lines: [{ start: 101, text: 'Sista raden.', translation: 'The last line.' }] }
    await send(lastCap)
    await select('other')
    await page.evaluate(name => { window._recordings[name].items.Manual.Card.splice(1, 1) }, playlist)
    await click('#capCapSave')
    assert.match(alerts.pop(), /no longer available/)
    assert.equal(await page.locator('#captionCaptureDialog').isVisible(), true)
    await page.locator('#capCapItem').selectOption('notes')
    await page.evaluate(name => { window._recordings[name].readOnly = true }, playlist)
    await click('#capCapSave')
    assert.match(alerts.pop(), /read.only/i)
    assert.equal(await page.locator('#captionCaptureDialog').isVisible(), true)
    await page.evaluate(name => { delete window._recordings[name].readOnly }, playlist)
    await commit()

    // A manual edit invalidates that face's provenance so re-capturing text
    // removed from it can never be silently lost to a stale duplicate key.
    await page.evaluate(({ name, id }) => window._openManualEntryEditor(name,
      window._recordings[name].items.Manual.Card.find(it => it.id === id)), { name: playlist, id: added.id })
    await page.locator('#meeSource').fill('Edited notes')
    await click(page.locator('#manualEntryEditor').locator('..').getByRole('button', { name: 'Save', exact: true }))
    await page.locator('#manualEntryEditor').waitFor({ state: 'hidden' })
    await send(cap)
    await select(added.id)
    await page.locator('input[name="capCapField"][value="source"]').check()
    await commit()
    assert.equal((await cards()).find(it => it.id === added.id).source,
      'Edited notes\n—\n—\n—\nTillåt mig tvivla.\nJag vill förstå.')
    // Queued events retain their own capture and begin with New item again.
    await send({ ...cap, lines: [{ start: 200, text: 'En köad rad.' }] })
    await select('notes')
    await page.evaluate(cap => window.dispatchEvent(new CustomEvent('cupitorCaptionCapture', {
      detail: { ...cap, lines: [{ start: 201, text: 'Nästa block.' }] }
    })), cap)
    assert.match(await page.locator('#captionCaptureDialog').locator('..').locator('.ui-dialog-title').innerText(), /1 more waiting/)
    await click('#capCapSave')
    await page.waitForFunction(() => document.querySelector('.cap-cap-line')?.textContent === 'Nästa block.')
    assert.equal(await page.locator('#capCapItem').inputValue(), '')
    await commit()
    assert.equal((await cards()).length, 3, 'queued second capture creates one new item')
    assert.deepEqual(alerts, [])
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: capture create/merge, paired translations, deduplication, multiline pages, reload, cancellation, stale destinations and edits passed`)
  } catch (e) {
    console.error(await page.evaluate(() => ({ errors: window.__filed,
      item: document.querySelector('#capCapItem')?.value,
      hint: document.querySelector('#capCapMergeHint')?.textContent,
      buttons: [...document.querySelectorAll('#capCapSave')].map(el => el.outerHTML) })))
    console.error('Page errors:', errors)
    throw e
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
