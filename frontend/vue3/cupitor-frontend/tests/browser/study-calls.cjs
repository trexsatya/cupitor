const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 800 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.__callRequests = []
    let sequence = 0
    let calls = Array.from({ length: 150 }, (_, i) => ({
      id: 'done-' + i, title: 'Finished question ' + i, created_at: i, finished_at: i, when_ms: Date.now(),
      status: 'completed', choice: 'en',
    }))
    calls.push({ id: 'pending', title: 'Existing question', question: 'Which word?', choices: ['ett', 'en'],
      correct_choice_index: 1, response_type: 'choice', language: 'sv-SE', when_ms: Date.now() + 3600000, status: 'scheduled' })
    window.CallBridge = { postMessage(raw) {
      const request = JSON.parse(raw); window.__callRequests.push(request)
      const add = call => calls.push({ ...call, id: 'new-' + sequence++, created_at: Date.now(), status: call.enabled === false ? 'disabled' : 'scheduled' })
      if (request.op === 'scheduleBatch') request.calls.forEach(add)
      if (request.op === 'schedule') add(request)
      if (request.op === 'setEnabled') calls = calls.map(c => c.id === request.id ? { ...c, enabled: request.enabled, status: request.enabled ? 'scheduled' : 'disabled' } : c)
      if (request.op === 'remove') calls = calls.filter(c => c.id !== request.id)
      if (request.op === 'update') calls = calls.map(c => c.id === request.id ? { ...c, ...request } : c)
      const data = request.op === 'getCapabilities'
        ? { supported: true, permission: 'granted', full_screen: true, exact_alarms: true, speech_input: true,
          batch_schedule: true, edit_scheduled: true, pending_controls: true, history_limit: 100 }
        : request.op === 'getCalls' ? { version: 1, calls } : { id: 'new-call' }
      window.dispatchEvent(new CustomEvent('cupitorCallAck', { detail: { ...request, ok: true, data } }))
    } }
  })
  const button = (scope, text) => page.locator(scope).getByRole('button', { name: text, exact: true })
  const future = () => page.evaluate(() => {
    const date = new Date(Date.now() + 3600000)
    return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.querySelector('#studyCallsBtn').click())
    await page.locator('[data-call-pending] .study-call-history-row').waitFor()
    assert.equal(await page.locator('[data-call-view=editor]').isVisible(), false)
    assert.equal(await page.locator('[data-call-history]').isVisible(), false)
    await page.locator('[data-call-history-toggle]').click()
    assert.equal(await page.locator('[data-call-history] .study-call-history-row').count(), 100)
    const dimensions = await page.locator('#studyCallsDialog').evaluate(el => {
      const box = el.closest('.ui-dialog').getBoundingClientRect()
      return { bottom: box.bottom, height: innerHeight, scroll: el.scrollHeight > el.clientHeight }
    })
    assert(dimensions.bottom <= dimensions.height + 1, 'dialog stays inside viewport')
    assert(dimensions.scroll, '100-row history scrolls within the dialog')
    await page.locator('[data-call-history-toggle]').click()
    await button('[data-call-pending]', 'Disable').click()
    await button('[data-call-pending]', 'Enable').click()
    await button('[data-call-pending]', 'Edit call').click()
    await page.locator('[data-call-question]').fill('Edited existing question')
    await page.locator('[data-call-submit=later]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'update'))
    assert.equal(await page.evaluate(() => window.__callRequests.find(r => r.op === 'update').question), 'Edited existing question')
    await button('[data-call-pending]', 'Remove').click()
    await page.locator('[data-call-pending]').getByText('No pending calls.').waitFor()

    await page.locator('[data-call-add]').click()
    await page.locator('[data-call-question]').fill('Which article goes with katt?')
    const alternatives = page.locator('[data-call-alternatives] input[type=text]')
    await alternatives.nth(0).fill('ett'); await alternatives.nth(1).fill('en')
    await page.locator('[data-call-alternatives] input[type=radio]').nth(1).check()
    await page.locator('[data-call-submit=now]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'callNow'))
    assert.deepEqual(await page.evaluate(() => {
      const r = window.__callRequests.find(r => r.op === 'callNow')
      return [r.choices, r.correct_choice_index, r.max_retries, r.match_threshold, r.voice_response]
    }), [['ett', 'en'], 1, 3, 0.8, true])

    await page.locator('[data-call-add]').click()
    await page.locator('[data-call-type]').selectOption('text')
    await page.locator('[data-call-question]').fill('What is the capital of Sweden?')
    await page.locator('[data-call-accepted]').fill('Stockholm\nStockholms stad')
    await page.locator('.study-call-settings summary').click()
    await page.locator('[data-call-retries]').fill('2')
    await page.locator('[data-call-when]').fill('2030-01-01T12:00')
    await page.locator('[data-call-submit=later]').click()
    assert.equal(await page.evaluate(() => window.__callRequests.filter(r => r.op === 'schedule').length), 0)
    await page.locator('[data-call-when]').fill(await future())
    await page.locator('[data-call-submit=later]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'schedule'))
    assert.deepEqual(await page.evaluate(() => {
      const r = window.__callRequests.find(r => r.op === 'schedule')
      return [r.choices, r.accepted_answers, r.max_retries, r.voice_response]
    }), [[], ['Stockholm', 'Stockholms stad'], 2, true])

    await page.locator('[data-call-open-import]').click()
    await page.locator('[data-call-import-file]').setInputFiles({ name: 'calls.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ calls: [
        { title: 'Imported choice', question: 'Choose one', choices: ['One', 'Two'], correct_choice_index: 0 },
        { title: 'Imported text', question: 'Name a city', response_type: 'text', accepted_answers: ['Stockholm'] },
      ] })) })
    await page.locator('[data-call-import-drafts] .study-call-history-row').first().waitFor()
    await button('[data-call-import-drafts]', 'Edit').first().click()
    await page.locator('[data-call-question]').fill('Edited imported question')
    await page.locator('[data-call-alternative-add]').click()
    await page.locator('[data-call-alternatives] input[type=text]').nth(2).fill('Three')
    await page.locator('[data-call-alternatives] input[type=radio]').nth(2).check()
    await page.locator('[data-call-import-save]').click()
    await page.locator('[data-call-import-start]').fill(await future())
    await page.locator('[data-call-import-schedule]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'scheduleBatch'))
    assert.deepEqual(await page.evaluate(() => {
      const calls = window.__callRequests.find(r => r.op === 'scheduleBatch').calls
      return [calls[0].question, calls[0].choices, calls[0].correct_choice_index, calls[1].when_ms - calls[0].when_ms]
    }), ['Edited imported question', ['One', 'Two', 'Three'], 2, 300000])
    assert.equal(await page.locator('[data-call-pending] .study-call-history-row').count(), 3)
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: editable import, pending controls, choice/voice/free responses, hidden capped history and scrolling passed`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true) }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
