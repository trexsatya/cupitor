const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 800 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => d.accept())
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.__requests = []
    let lists = []
    const emit = (event, data) => {
      window['__' + event] = data
      window.dispatchEvent(new CustomEvent(event, { detail: data }))
    }
    window.NotifBridge = { postMessage(raw) {
      const r = JSON.parse(raw); window.__requests.push(r)
      let data
      if (r.op === 'getCapabilities') data = { supported: true, permission: 'granted', delivery_modes: ['notification', 'call'] }
      if (r.op === 'getSchedules') emit('cupitorNotifSchedules', { version: 1, schedules: [
        { key: 'ebbinghaus', name: 'Ebbinghaus', kind: 'series' },
        { key: 'daily_0900', name: 'Daily 09:00', kind: 'recurring' },
      ] })
      const list = lists.find(l => l.external_key === r.external_key)
      if (r.op === 'createList') lists.push({ ...r, source: 'webpage', status: 'active' })
      if (r.op === 'syncItems' && list) list.items = r.items
      if (r.op === 'setDelivery' && list) Object.assign(list, { delivery: r.delivery, call_config: r.call_config })
      if (r.op === 'setStatus' && list) list.status = r.status
      if (r.op === 'setSchedule' && list) Object.assign(list, { schedule_key: r.schedule_key, intro_schedule_key: r.intro_schedule_key })
      if (r.op === 'deleteList') lists = lists.filter(l => l !== list)
      emit('cupitorNotifAck', { ...r, ok: true, data })
      emit('cupitorNotifLists', { version: 1, lists })
    } }
    window.CallBridge = { postMessage(raw) {
      const r = JSON.parse(raw)
      emit('cupitorCallAck', { ...r, ok: true, data: r.op === 'getCapabilities'
        ? { supported: true, permission: 'granted', speech_input: true } : { calls: [] } })
    } }
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      const card = (id, source, target) => ({ manual: true, id, source, target })
      window._recordings = { Animals: { items: { Manual: { Card: [card('cat', 'katt', 'cat'), card('dog', 'hund', 'dog'),
        { ...card('off', 'fågel', 'bird'), enabled: false }] } } } }
      window._recording = { currentName: 'Animals', items: window._recordings.Animals.items }
      document.querySelector('#studyCallsBtn').click()
    })
    await page.locator('#notifDialog').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#notifDelivery').inputValue(), 'call')
    assert.equal(await page.locator('#studyCallsDialog').count(), 0, 'playlist Calls opens the shared scheduling flow')
    assert.match(await page.locator('#notifCallPreview').innerText(), /2 question/)
    await page.locator('#notifIntroSchedule').selectOption('daily_0900')
    await page.locator('#notifEnableBtn').click()
    await page.waitForFunction(() => window.__requests.some(r => r.op === 'createList'))
    const created = await page.evaluate(() => window.__requests.find(r => r.op === 'createList'))
    assert.equal(created.delivery, 'call')
    assert.equal(created.intro_schedule_key, 'daily_0900')
    assert.deepEqual(created.items.map(i => i.external_id), ['card:cat', 'card:dog'])
    assert.deepEqual(created.items[0].payload.study_call.accepted_answers, ['cat'])
    assert.equal(created.call_config.max_retries, 3)
    assert.equal(created.call_config.match_threshold, 0.8)
    await page.locator('.notif-toggle').click()
    await page.waitForFunction(() => window.__requests.some(r => r.op === 'setStatus' && r.status === 'paused'))
    await page.locator('.notif-toggle').click()
    await page.locator('.notif-call-edit').click()
    await page.locator('#notifCallDirection').selectOption('target-source')
    await page.locator('#notifCallType').selectOption('choice')
    await page.locator('#notifCallRetries').fill('2')
    await page.locator('#notifEnableBtn').click()
    await page.waitForFunction(() => window.__requests.some(r => r.op === 'setDelivery'))
    const synced = await page.evaluate(() => window.__requests.filter(r => r.op === 'syncItems').at(-1))
    assert.equal(synced.items[0].payload.study_call.question, 'cat')
    const q = synced.items[0].payload.study_call
    assert.equal(q.choices[q.correct_choice_index], 'katt')
    assert.equal(q.max_retries, 2)
    assert.equal(await page.evaluate(() => window.__requests.filter(r => r.op === 'setSchedule').length), 0,
      'editing call settings preserves the existing schedule and progress')
    await page.locator('.notif-disable').click()
    await page.waitForFunction(() => window.__requests.some(r => r.op === 'deleteList'))
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: playlist call creation, intro cadence, voice/fuzzy/retry options, direction/alternatives, pause/resume and disable passed`)
  } finally { await page.close() }
}
;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true) }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
