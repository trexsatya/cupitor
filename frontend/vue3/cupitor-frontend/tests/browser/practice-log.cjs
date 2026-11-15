const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1280, height: 850 }, isMobile: mobile, hasTouch: mobile,
  })
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const log = page.locator('#practiceLogDialog')
  const editor = page.locator('#practiceLogEditor')
  const press = name => editor.getByRole('button', { name, exact: true }).click()
  const tab = name => log.getByRole('button', { name, exact: true }).click()
  const open = async () => {
    const shortcut = mobile
      ? page.getByRole('navigation', { name: 'Cupitor navigation' }).getByRole('button', { name: 'Practice Log' })
      : page.locator('#headerPracticeLogBtn')
    await shortcut.click()
    await log.waitFor()
  }
  const screenshot = async (name, locator) => {
    if (!process.env.SCREENSHOT_DIR) return
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
    await locator.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `practice-log-${mobile ? 'mobile' : 'desktop'}-${name}.png`) })
  }
  const ready = () => page.waitForFunction(() => window.__cupitorSearchReady && !!window.cupitorUserData)
  try {
    await page.clock.setFixedTime(new Date('2026-11-15T12:00:00Z'))
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'domcontentloaded' })
    await ready()
    await page.evaluate(async () => {
      const { scopedKey } = await import('/language/account-state.js')
      window.cupitorUserData.setItem(scopedKey('cupitor:practiceLog:swedish'), JSON.stringify({
        customItems: ['Reading', 'Writing', 'Listening'],
        weeks: {
          '2026-W44': { Listening: { status: 'done', notes: 'Listened to an interview' } },
          '2026-W45': { Writing: { status: 'in_progress', goal: 'Summarize an episode', progress: 70 } },
          '2026-W46': { Writing: { status: 'in_progress', goal: 'Write a reflection', notes: 'Use the interview' } },
        },
      }))
    })
    await open()
    assert.match(await log.locator('#practiceLogWeekLabel').innerText(), /9–15 Nov/)
    await log.getByRole('button', { name: 'Edit Writing goal' }).click()
    assert.equal(await editor.locator('textarea').count(), 1)
    assert.equal(await editor.getByLabel('Goal', { exact: true }).inputValue(), 'Write a reflection\n\nUse the interview')
    assert.equal(await editor.getByLabel('Target unit').inputValue(), '')
    await press('Save goal')
    await editor.waitFor({ state: 'hidden' })

    await log.getByRole('button', { name: 'Update Writing progress' }).click()
    await page.keyboard.press('Escape')
    await editor.waitFor({ state: 'hidden' })
    assert.ok(await log.isVisible(), 'Escape closes the progress editor without closing Practice Log')
    await log.getByRole('button', { name: 'Update Writing progress' }).click()
    const slider = editor.getByRole('slider', { name: 'Progress this week' })
    await slider.press('End')
    assert.equal(await slider.getAttribute('aria-valuetext'), '100%')
    await screenshot('slider', editor)
    await press('Save progress')
    await editor.waitFor({ state: 'hidden' })
    assert.match(await log.locator('[data-item-name="Writing"]').innerText(), /100%/)
    assert.match(await log.locator('#practiceLogWeekLabel').innerText(), /1 of 1 goal complete/)

    await tab('Add a goal')
    await editor.getByLabel('Activity', { exact: true }).selectOption('Reading')
    await press('Continue')
    await editor.getByLabel('Goal', { exact: true }).fill('Read Ordens värld')
    await editor.getByLabel('Target unit').selectOption('pages')
    await editor.getByRole('spinbutton', { name: 'Target amount' }).fill('30')
    await press('Save goal')
    await editor.waitFor({ state: 'hidden' })
    await log.getByRole('button', { name: 'Update Reading progress' }).click()
    await press('Add 5 pages')
    await press('Save progress')
    await editor.waitFor({ state: 'hidden' })
    assert.match(await log.locator('[data-item-name="Reading"]').innerText(), /5 \/ 30 pages/)

    await screenshot('week', page.locator('.practice-log-window'))
    await tab('Next week')
    assert.match(await log.locator('#practiceLogWeekLabel').innerText(), /16–22 Nov/)
    await tab('Add a goal')
    await editor.getByLabel('Activity', { exact: true }).selectOption('Listening')
    await press('Continue')
    await editor.getByLabel('Goal', { exact: true }).fill('Listen to Kropp & Själ')
    await press('Save goal')
    await editor.waitFor({ state: 'hidden' })
    assert.equal(await log.locator('.practice-log-update').count(), 0)

    await tab('History')
    const weeks = log.locator('[data-week]')
    assert.deepEqual(await weeks.evaluateAll(rows => rows.map(row => row.dataset.week)), ['2026-W45', '2026-W44'])
    assert.match(await weeks.first().innerText(), /70%/)
    await screenshot('history', page.locator('.practice-log-window'))
    await weeks.last().locator('summary').first().press('Enter')
    await weeks.last().getByText('Notes', { exact: true }).click()
    assert.ok(await weeks.last().getByText('Listened to an interview').isVisible())

    await page.evaluate(() => window.cupitorUserData.flush())
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready()
    await open()
    assert.match(await log.locator('[data-item-name="Reading"]').innerText(), /5 \/ 30 pages/)
    assert.match(await log.locator('[data-item-name="Writing"]').innerText(), /100%/)
    await tab('Next week')
    assert.ok(await log.getByText('Listen to Kropp & Själ').isVisible())
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: weekly goals, counted and percentage updates, history and reload passed`)
  } finally {
    await page.close()
  }
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    await check(browser, false)
    await check(browser, true)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
