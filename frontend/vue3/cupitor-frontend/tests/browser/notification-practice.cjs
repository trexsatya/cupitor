const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')
const fs = require('node:fs')
const path = require('node:path')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  page.setDefaultTimeout(15000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true; localStorage.setItem('notifDebug', '1') })
  const ready = () => page.waitForFunction(() => window._practiceActive && !document.querySelector('#practiceMode .practice-loading'))
  const click = async selector => {
    if (await page.evaluate(() => document.body.classList.contains('study-controls-hidden'))) {
      await page.locator('#practiceMode .practice-card').click()
    }
    if (mobile) await page.locator(selector).tap(); else await page.locator(selector).click()
  }
  const checkCovered = async () => {
    assert.equal(await page.locator('#srtLoadingBanner').isVisible(), false, 'main-page loading notice stays covered')
    assert.equal(await page.locator('#settingsPanel').evaluate(el => el.closest('.ui-dialog').classList.contains('behind-study-view')), true)
    assert(await page.evaluate(() => {
      const dialog = document.querySelector('#settingsPanel').closest('.ui-dialog')
      return +getComputedStyle(dialog).zIndex < +getComputedStyle(document.body, '::before').zIndex
    }), 'existing Settings stays behind the opaque backdrop')
    for (const point of [[2, 60], [10, 450], [10, 850]]) {
      assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.behind-study-view'), point), false)
    }
    assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundColor), 'rgb(10, 10, 10)')
    assert(await page.locator('#playingQueueDialog').evaluate(el =>
      +getComputedStyle(el.closest('.ui-dialog')).zIndex < +getComputedStyle(document.body, '::before').zIndex))
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.evaluate(() => {
      const card = (id, source) => ({ manual: true, id, source, target: 'Translation' })
      window._recordings = {
        A: { notifKey: 'key-a', items: { Manual: { Card: [card('a1', 'First reminder'), card('a2', 'Clicked reminder'), card('a3', 'Already read')] } } },
        B: { notifKey: 'key-b', items: { Manual: { Card: [card('b1', 'Unread from another playlist'), { ...card('off', 'Excluded'), enabled: false }] } } }
      }
      window._recording = { currentName: 'A', items: window._recordings.A.items }
      window.__originalRecordings = JSON.stringify(window._recordings)
      Object.assign(window._appSettings, { recPlayShuffle: true, recPlayLoop: 'off' })
      window.__originalResume = JSON.stringify(window._recLastPlayedMap || {})
      window.__storageBefore = Object.fromEntries(Object.keys(localStorage).filter(k => /recLastPlayed/.test(k)).map(k => [k, localStorage.getItem(k)]))
      window._notifSimulateFeed([
        { external_key: 'key-a', item_external_id: 'card:a1', title: 'First reminder', fired_at: 30, responded_at: null },
        { external_key: 'key-a', item_external_id: 'card:a2', title: 'Clicked reminder', fired_at: 20, responded_at: null },
        { external_key: 'key-b', item_external_id: 'card:b1', title: 'Unread from another playlist', fired_at: 10, responded_at: null },
        { external_key: 'key-a', item_external_id: 'card:a3', title: 'Already read', fired_at: 40, responded_at: 50 },
        { external_key: 'key-b', item_external_id: 'card:off', title: 'Excluded', fired_at: 1, responded_at: null }
      ])
    })
    // Start with a paused saved session underneath. Notification practice
    // must not overwrite that session's cursor, even when Player is reused.
    await page.evaluate(() => {
      const queue = window._recordings.A.items.Manual.Card.map((item, idx) => ({
        ...item, _recName: 'A', _st: 'Manual', _w: 'Card', _idx: idx,
      }))
      window.__normalPlayer = window.playRecording({ resumeQueue: { queue, pos: 2 }, startPaused: true, keepCurrentItem: true })
    })
    await page.waitForFunction(() => window._playingRecording && window._recPlayIndex === 2)
    await page.evaluate(() => {
      window.minimizePlayingRecording()
      window.__originalResume = JSON.stringify(window._recLastPlayedMap || {})
      window.__storageBefore = Object.fromEntries(Object.keys(localStorage).filter(k => /recLastPlayed/.test(k)).map(k => [k, localStorage.getItem(k)]))
    })
    await page.locator('#toggleSettingsPanelBtn').click()
    await page.evaluate(() => {
      $('#settingsPanel').append('<div id="long-settings-test">' + '<p>Extra settings content</p>'.repeat(90) + '</div>')
      $('#settingsPanel').dialog('option', 'modal', true)
    })
    await page.waitForFunction(() => document.getElementById('settingsPanel').scrollHeight > document.getElementById('settingsPanel').clientHeight)
    await page.locator('#settingsPanel').hover()
    await page.mouse.wheel(0, 600)
    await page.waitForFunction(() => document.getElementById('settingsPanel').scrollTop > 0)
    assert(await page.locator('#settingsPanel').evaluate(el => el.closest('.ui-dialog').getBoundingClientRect().bottom <= innerHeight + 1))
    // This dialog has an ID-specific !important z-index rule; it must be
    // covered as well as an ordinary Settings dialog.
    await page.evaluate(() => $('<div id="playingQueueDialog">Previous queue</div>').appendTo('body').dialog({ modal: false }))
    // Real inbox row handler captures unread state before acknowledgement.
    await page.locator('#notifBellBtn').scrollIntoViewIfNeeded()
    await page.evaluate(() => $('#notifBellBtn').trigger('click'))
    await page.locator('.notif-bell-row[data-xid="card:a2"]').click()
    await ready()
    assert.deepEqual(await page.evaluate(() => window._practiceCards.map(i => i.id)), ['a2', 'a1', 'b1'])
    assert.equal(await page.evaluate(() => window._recording.currentName), 'A')
    await checkCovered()
    assert.equal(await page.locator('#notifBellBadge').textContent(), '3', 'only the clicked reminder is marked read')
    {
      const output = process.env.SCREENSHOT_DIR || 'test-results/dialog-browser-results/notifications'
      fs.mkdirSync(output, { recursive: true })
      await page.screenshot({ path: path.join(output, `notification-practice-${mobile ? 'mobile' : 'desktop'}.png`) })
    }
    await click('.practice-next')
    await page.waitForFunction(() => window._practiceIdx === 1)
    await ready()
    assert.equal(await page.locator('#notifBellBadge').textContent(), '2')
    // Shuffle OFF must restore the temporary snapshot, never all of A.
    await click('.practice-shuffle')
    assert.deepEqual(await page.evaluate(() => window._practiceCards.map(i => i.id)), ['a2', 'a1', 'b1'])
    await click('.practice-minimize')
    assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::before').content), 'none')
    assert.equal(await page.evaluate(() => $('#settingsPanel').dialog('option', 'modal')), true, 'minimize restores covered modal focus behavior')
    await page.evaluate(() => window.restorePracticeMode())
    await checkCovered()
    // Editors opened during study must still appear above it.
    await page.evaluate(() => $('<div id="study-test-editor">Editor</div>').appendTo('body').dialog({ modal: true }))
    assert.equal(await page.locator('#study-test-editor').evaluate(el => el.closest('.ui-dialog').classList.contains('above-practice-mode')), true)
    await page.evaluate(() => $('#study-test-editor').dialog('close'))
    await click('.practice-player-btn')
    await page.waitForFunction(() => window._playingRecording && !window._practiceActive && window._recPlayIndex === 1)
    assert.deepEqual(await page.evaluate(() => window._recPlayQueue.map(i => i.id)), ['a2', 'a1', 'b1'])
    await checkCovered()
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some(k => /openView/.test(k))), false, 'reusing a saved Player keeps notification practice temporary')
    await page.locator('#recPlayingBanner .rec-pb-info-btn').click()
    await page.locator('.rec-pb-practice-btn').click()
    await ready()
    assert.equal(await page.evaluate(() => window._practiceIdx), 1)
    await click('.practice-close')
    await page.waitForFunction(() => !window._practiceActive && !window._playingRecording && !window._recPlayQueue)
    assert.equal(await page.evaluate(() => window._practiceCards.length), 0, 'closing discards every temporary queue')
    assert.equal(await page.evaluate(() => JSON.stringify(window._recordings) === window.__originalRecordings), true)
    assert.equal(await page.evaluate(() => JSON.stringify(window._recLastPlayedMap || {}) === window.__originalResume), true)
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => /recLastPlayed/.test(k)).map(k => [k, localStorage.getItem(k)]))) === JSON.stringify(window.__storageBefore)), true)
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some(k => /openView/.test(k))), false)
    // Native event includes clicked even if host already marked it read,
    // and the bridge request retains the 200-event bound.
    await page.evaluate(() => {
      window.__notifRequests = []
      window.NotifBridge = { postMessage: raw => {
        const request = JSON.parse(raw)
        window.__notifRequests.push(request)
        queueMicrotask(() => {
          if (request.op === 'getNotifications') window.dispatchEvent(new CustomEvent('cupitorNotifFeed', { detail: window.__cupitorNotifFeed }))
          window.dispatchEvent(new CustomEvent('cupitorNotifAck', { detail: { request_id: request.request_id, ok: true } }))
        })
      } }
      window.dispatchEvent(new CustomEvent('cupitorNotificationOpened', { detail: { external_key: 'key-a', item_external_id: 'card:a2' } }))
    })
    await ready()
    assert.deepEqual(await page.evaluate(() => window._practiceCards.map(i => i.id)), ['a2', 'b1'])
    assert(await page.evaluate(() => window.__notifRequests.filter(r => r.op === 'getNotifications').every(r => r.limit === 200 && !r.include_unread)))
    await click('.practice-close')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} notification queue, read state, shuffle, view switching, discard, storage and opaque dialogs passed`)
  } catch (error) {
    const output = process.env.SCREENSHOT_DIR || 'test-results/dialog-browser-results/notifications'
    fs.mkdirSync(output, { recursive: true })
    await page.screenshot({ path: path.join(output, 'notification-failure.png') }).catch(() => {})
    console.error(await page.evaluate(() => ({ body: document.body.className, practice: window._practiceActive,
      index: window._practiceIdx, queue: window._practiceCards?.map(i => i.id), player: window._playingRecording,
      playerIndex: window._recPlayIndex, errors: window.__errors })))
    throw error
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
  try { await check(browser, false); await check(browser, true) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
