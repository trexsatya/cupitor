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
    const calls = Array.from({ length: 200 }, (_, i) => ({
      id: 'call-' + i, title: 'Study question ' + i, created_at: i, when_ms: Date.now(),
      status: i === 199 ? 'scheduled' : 'completed', choice: i === 199 ? null : 'en',
    }))
    window.CallBridge = { postMessage(raw) {
      const request = JSON.parse(raw); window.__callRequests.push(request)
      const data = request.op === 'getCapabilities'
        ? { supported: true, permission: 'granted', full_screen: false, exact_alarms: false, speech_input: true }
        : request.op === 'getCalls' ? { version: 1, calls } : { id: 'new-call' }
      window.dispatchEvent(new CustomEvent('cupitorCallAck', { detail: { ...request, ok: true, data } }))
      if (request.op === 'getCalls') window.dispatchEvent(new CustomEvent('cupitorCalls', { detail: data }))
    } }
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.querySelector('#studyCallsBtn').click())
    await page.locator('#studyCallsDialog').waitFor({ state: 'visible' })
    await page.locator('[data-call-question]').fill('Which article goes with katt?')
    await page.locator('[data-call-choices]').fill('ett\nen')
    await page.locator('[data-call-correct]').selectOption('1')
    await page.locator('[data-call-submit=now]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'callNow'))
    assert.deepEqual(await page.evaluate(() => window.__callRequests.find(r => r.op === 'callNow').choices), ['ett', 'en'])
    assert.deepEqual(await page.evaluate(() => {
      const r = window.__callRequests.find(r => r.op === 'callNow')
      return [r.correct_choice_index, r.max_retries, r.match_threshold, r.voice_response]
    }), [1, 3, 0.8, true])
    await page.locator('[data-call-when]').fill('2030-01-01T12:00')
    await page.locator('[data-call-submit=later]').click()
    assert.equal(await page.evaluate(() => window.__callRequests.filter(r => r.op === 'schedule').length), 0, 'invalid future time is not scheduled')
    const time = await page.evaluate(() => {
      const date = new Date(Date.now() + 3600000)
      return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    })
    await page.locator('[data-call-when]').fill(time)
    await page.locator('[data-call-submit=later]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'schedule'))
    assert.equal(await page.locator('.study-call-history-row').count(), 200)
    const dimensions = await page.locator('#studyCallsDialog').evaluate(el => {
      const box = el.closest('.ui-dialog').getBoundingClientRect()
      return { bottom: box.bottom, height: innerHeight, scroll: el.scrollHeight > el.clientHeight }
    })
    assert(dimensions.bottom <= dimensions.height + 1, 'dialog stays inside viewport')
    assert(dimensions.scroll, '200-row history scrolls inside the dialog')
    await page.locator('[data-call-history] button').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'cancel'))
    assert.equal(await page.evaluate(() => window.__callRequests.find(r => r.op === 'cancel').id), 'call-199')
    await page.locator('[data-call-type]').selectOption('text')
    await page.locator('[data-call-question]').fill('What is the capital of Sweden?')
    await page.locator('[data-call-accepted]').fill('Stockholm\nStockholms stad')
    await page.locator('[data-call-retries]').fill('2')
    await page.locator('[data-call-submit=now]').click()
    await page.waitForFunction(() => window.__callRequests.some(r => r.op === 'callNow' && r.response_type === 'text'))
    assert.deepEqual(await page.evaluate(() => {
      const r = window.__callRequests.filter(r => r.op === 'callNow').at(-1)
      return [r.choices, r.accepted_answers, r.max_retries, r.voice_response]
    }), [[], ['Stockholm', 'Stockholms stad'], 2, true])
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: choice/free responses, voice, retry and fuzzy settings, scheduling, cancellation and 200-row scrolling passed`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true) }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
