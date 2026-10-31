// Real playlist layouts, with all network traffic intercepted locally.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const fixture = require('./fixtures/recorded-playlists.json')
const flatten = items => Object.entries(items).flatMap(([st, words]) =>
  Object.entries(words).flatMap(([w, arr]) => arr.map((item, idx) => ({ st, w, idx, item }))))
const clips = Object.values(fixture.playlists).flatMap(r => flatten(r.items)).filter(r => !r.item.manual)
const ids = [...new Set(clips.map(r => r.item.id))]
const subtitle = id => clips.filter(r => r.item.id === id).map(({ item: it }, i) => {
  const time = n => new Date(n * 1000).toISOString().slice(11, 23).replace('.', ',')
  return `${i + 1}\n${time(it.timeStart)} --> ${time(it.timeEnd)}\n${it.word} — a long local subtitle preview for the captured clip.\n`
}).join('\n')

async function fixtures(route) {
  const url = new URL(route.request().url()), file = decodeURIComponent(url.pathname)
  if (url.hostname !== '127.0.0.1') {
    if (file.endsWith('/srts/index.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ids.map(link => ({ link, name: `Fixture || Captured || ${link}`, source: 'YouTube' }))) })
    if (file.endsWith('.srt')) {
      // Keep previews pending while the user starts to scroll.
      await new Promise(resolve => setTimeout(resolve, 150))
      const id = ids.find(id => file.includes(id))
      return route.fulfill({ contentType: 'text/plain', body: id ? subtitle(id) : '' })
    }
  }
  return serveFixtures(route)
}

async function swipe(page, session, dy) {
  const box = await page.locator('#recordingReviewDialog').boundingBox()
  const x = box.x + box.width * .55, y = dy < 0 ? box.y + box.height - 35 : box.y + 35
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i / 3, y: y + dy * i / 12 }] })
    await page.waitForTimeout(16)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

// Choose through the folder browser, then exercise native card scrolling.
async function choosePlaylist(page, name, mobile) {
  const panel=page.locator('#playlistBrowserPanel')
  if(!await panel.evaluate(el=>el.open))await panel.locator(':scope > summary').click()
  const folders=page.locator('.pl-folder-pane')
  if(!await folders.evaluate(el=>el.open))await folders.locator('summary').click()
  await page.locator('.pl-folder-list button[data-folder="*"]').click()
  await page.locator('#playlistTypeFilter').selectOption('all')
  await page.locator('#playlistFilter').fill(name)
  const option=page.locator('.pl-playlist-row').filter({has:page.getByText(name,{exact:true})})
  if(mobile)await option.tap();else await option.click()
  await page.waitForFunction(name=>window._recording.currentName===name&&
    document.getElementById('recRecSelect').value===name&&!document.getElementById('playlistBrowserPanel').open,name)
}

async function checkPages(browser, mobile, width = mobile ? 430 : 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', fixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async fixture => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window._recordings = fixture.playlists
      fixture.otherNames.forEach(name => { window._recordings[name] = { items: {} } })
      window._scrollSamples = []
      const sample = () => {
        const el = document.getElementById('recordingReviewDialog')
        if (el && window._trackScroll) window._scrollSamples.push(el.scrollTop)
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    }, fixture)
    const session = mobile ? await page.context().newCDPSession(page) : null
    await page.evaluate(() => window.openRecordingReviewDialog())
    for (const [name, rec] of Object.entries(fixture.playlists)) {
      const expected = flatten(rec.items), seen = []
      await choosePlaylist(page, name, mobile)
      const pageCount = Math.ceil(expected.length / 50)
      let maxHeight = 0
      for (let p = 0; p < pageCount; p++) {
        if (p) await page.locator('.rec-page-step[aria-label="Next playlist page"]').last().click()
        const state = await page.locator('#recordingReviewDialog').evaluate(el => ({
          top: el.scrollTop, height: el.scrollHeight, width: el.scrollWidth, clientWidth: el.clientWidth,
          rows: [...el.querySelectorAll('.rec-item')].map(row => ({
            st: row.closest('.rec-item-list').dataset.st, w: row.closest('.rec-item-list').dataset.w,
            idx: Number(row.dataset.idx), number: Number(row.querySelector('.rec-item-no').textContent),
          })),
        }))
        assert.equal(state.top, 0, 'each new page starts at its beginning')
        assert(state.height < 16384, 'real playlists stay below the former large-surface threshold')
        if (mobile) assert(state.width <= state.clientWidth + 1, 'mobile rows fit without sideways overflow')
        maxHeight = Math.max(maxHeight, state.height)
        const subset = expected.slice(p * 50, (p + 1) * 50)
        assert.deepEqual(state.rows, subset.map((r, i) => ({ st: r.st, w: r.w, idx: r.idx, number: p * 50 + i + 1 })))
        seen.push(...state.rows)
        await page.locator('#recordingReviewDialog').evaluate(el => { el.scrollTop = 0; window._scrollSamples = []; window._trackScroll = true })
        if (mobile) await swipe(page, session, -220)
        else {
          const box = await page.locator('#recordingReviewDialog').boundingBox()
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.wheel(0, 240)
        }
        await page.waitForTimeout(900)
        const samples = await page.evaluate(() => { window._trackScroll = false; return window._scrollSamples })
        assert(samples.at(-1) > 100, 'trusted input scrolls from the first card after selecting a playlist')
        assert(samples.every((top, i) => !i || top >= samples[i - 1] - 1), 'downward scrolling never reverses after lifting')
        await page.waitForFunction(() => !document.querySelector('#recordingReviewDialog [data-pending]'))
        const refreshed = await page.locator('#recordingReviewDialog').evaluate(async el => {
          const before = el.scrollTop
          const dialogTop = el.parentElement.getBoundingClientRect().top
          window.openRecordingReviewDialog()
          await new Promise(resolve => setTimeout(resolve, 250))
          return { before, after: el.scrollTop, dialogTop, afterTop: el.parentElement.getBoundingClientRect().top, first: el.querySelector('.rec-item-no').textContent }
        })
        assert.equal(refreshed.after, refreshed.before, 'same-page refresh preserves a native position')
        assert.equal(refreshed.afterTop, refreshed.dialogTop, 'refresh must not move the dialog itself')
        assert.equal(Number(refreshed.first), p * 50 + 1, 'refresh preserves the selected page')
        if (mobile) {
          await swipe(page, session, 160)
          await page.waitForFunction(before => document.getElementById('recordingReviewDialog').scrollTop < before - 50, refreshed.after)
        }
      }
      assert.equal(seen.length, expected.length, 'every item remains reachable exactly once')
      assert.equal(new Set(seen.map(r => JSON.stringify([r.st, r.w, r.idx]))).size, expected.length)
      assert.deepEqual(await page.evaluate(name => window._recordings[name].items, name), rec.items, 'browsing preserves the full playlist and playback data')
      if (name.startsWith('Taare')) {
        // Later-page controls must address the original group indices.
        await page.locator('.rec-page-input').last().fill('2')
        await page.locator('.rec-page-input').last().press('Tab')
        await page.locator('#recordingReviewDialog').evaluate(el => { el.scrollTop = 0 })
        const toggle = page.locator('#recordingReviewDialog .rec-toggle-track').first()
        if (mobile) await toggle.tap(); else await toggle.click()
        assert.equal(await page.evaluate(() => window._recording.items.Manual.Card[50].enabled), false)
        assert.equal(await page.evaluate(() => window._recording.items.Manual.Card[0].enabled), true)
        if (!mobile) {
          const handles = page.locator('#recordingReviewDialog .rec-drag')
          const first = await handles.nth(0).boundingBox(), third = await handles.nth(2).boundingBox()
          await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
          await page.mouse.down()
          await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 10 })
          await page.mouse.up()
          await page.waitForFunction(id => window._recording.items.Manual.Card[50].id !== id, rec.items.Manual.Card[50].id)
          assert.equal(await page.locator('#recordingReviewDialog .rec-item').first().getAttribute('data-idx'), '50')
          assert.equal(await page.locator('#recordingReviewDialog .rec-item-no').first().innerText(), '51')
          assert.equal(await page.evaluate(() => window._recording.items.Manual.Card[99].id), rec.items.Manual.Card[99].id)
          assert.equal(await page.evaluate(() => window._recording.items.Manual.Card.length), 100)
        }
        await page.locator('#recordingReviewDialog .rec-dup').first().click()
        assert.equal(await page.evaluate(() => window._recording.items.Manual.Card.length), 101)
        assert.equal(await page.locator('#recordingReviewDialog .rec-item-no').first().innerText(), '51')
      }
      // Jump directly, rather than requiring repeated Next taps in a huge list.
      await page.locator('.rec-page-input').last().fill('1')
      await page.locator('.rec-page-input').last().press('Tab')
      await page.waitForFunction(() => document.querySelector('#recordingReviewDialog .rec-item-no').textContent === '1')
      if (mobile && process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, (name.startsWith('Taare') ? 'taare' : 'tvivla') + '-playlist-pages-' + width + '.png') })
      }
      console.log(`${mobile ? 'Mobile ' + width : 'Desktop'} ${name}: ${expected.length} items across ${pageCount} pages, max ${maxHeight}px; native scrolling and previews stable`)
    }
    if (session) await session.detach()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await checkPages(browser, false)
    if (!process.argv.includes('--desktop-only')) {
      await checkPages(browser, true, 360)
      if (!process.argv.includes('--narrow-only')) await checkPages(browser, true, 430)
    }
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })

module.exports = { fixtures, choosePlaylist }
