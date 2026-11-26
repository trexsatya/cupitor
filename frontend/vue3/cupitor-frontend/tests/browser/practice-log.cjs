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
  const note = () => editor.getByRole('textbox', { name: 'Week note', exact: true })
  const weekNote = () => log.locator('#practiceLogWeekLabel .practice-log-week-note p')
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
        weekNotes: { '2026-W43': { text: 'Tried another routine', updatedAt: 1 } },
      }))
    })
    await open()
    assert.match(await log.locator('#practiceLogWeekLabel').innerText(), /9–15 Nov/)
    await tab('Add week note')
    await note().fill('Shorter sessions worked.\nReview recordings on Sunday.')
    await press('Save note')
    await editor.waitFor({ state: 'hidden' })
    assert.equal(await weekNote().innerText(), 'Shorter sessions worked.\nReview recordings on Sunday.')
    await tab('Edit week note')
    await note().fill('Discard this draft')
    await page.keyboard.press('Escape')
    await editor.waitFor({ state: 'hidden' })
    assert.match(await weekNote().innerText(), /Shorter sessions worked/)
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
    await tab('Add week note')
    await note().fill('Plan two sessions.')
    await press('Save note')
    await editor.waitFor({ state: 'hidden' })
    assert.equal(await weekNote().innerText(), 'Plan two sessions.')
    await tab('Add a goal')
    await editor.getByLabel('Activity', { exact: true }).selectOption('Listening')
    await press('Continue')
    await editor.getByLabel('Goal', { exact: true }).fill('Listen to Kropp & Själ')
    await press('Save goal')
    await editor.waitFor({ state: 'hidden' })
    assert.equal(await log.locator('.practice-log-update').count(), 0)

    await tab('History')
    const weeks = log.locator('[data-week]')
    assert.deepEqual(await weeks.evaluateAll(rows => rows.map(row => row.dataset.week)), ['2026-W45', '2026-W44', '2026-W43'])
    assert.match(await weeks.first().innerText(), /70%/)
    await screenshot('history', page.locator('.practice-log-window'))
    const legacyWeek = log.locator('[data-week="2026-W44"]')
    await legacyWeek.locator('summary').first().press('Enter')
    await legacyWeek.getByText('Notes', { exact: true }).click()
    assert.ok(await legacyWeek.getByText('Listened to an interview').isVisible())
    await weeks.last().locator('summary').press('Enter')
    assert.ok(await weeks.last().getByText('Tried another routine').isVisible())

    await page.evaluate(() => window.cupitorUserData.flush())
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready()
    await open()
    assert.match(await weekNote().innerText(), /Shorter sessions worked/)
    assert.match(await log.locator('[data-item-name="Reading"]').innerText(), /5 \/ 30 pages/)
    assert.match(await log.locator('[data-item-name="Writing"]').innerText(), /100%/)
    await tab('Next week')
    assert.ok(await log.getByText('Listen to Kropp & Själ').isVisible())
    assert.equal(await weekNote().innerText(), 'Plan two sessions.')
    await tab('Edit week note')
    await note().fill('')
    await press('Save note')
    await editor.waitFor({ state: 'hidden' })
    assert.ok(await log.getByRole('button', { name: 'Add week note', exact: true }).isVisible())
    await tab('This week')
    assert.match(await weekNote().innerText(), /Shorter sessions worked/)
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: week notes, weekly goals, counted and percentage updates, history and reload passed`)
  } finally {
    await page.close()
  }
}

async function checkIsolation(browser, mobile) {
  const owner = { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null }
  const shared = { login: owner.login, repo: owner.repo, branch: owner.branch }
  const alice = { login: 'alice', repo: 'cupitor-data', branch: 'main', other: shared }
  const bob = { ...alice, login: 'bob' }
  const payload = (goal, updatedAt = 10) => ({ weeks: { '2026-W46': { Reading: { goal, updatedAt } } } })
  for (const account of [null, { login: null, other: shared }, { ...alice, repo: null, branch: null }, alice, owner]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 850 }, isMobile: mobile, hasTouch: mobile })
    const calls = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.clock.setFixedTime(new Date('2026-11-15T12:00:00Z'))
      await page.addInitScript(({ account, original }) => {
        window.dontConfirmOnRefresh = true
        if (!sessionStorage.getItem('isolation-seeded')) {
          if (account) localStorage.setItem('cupitor:account', JSON.stringify(account))
          localStorage.setItem('cupitor:practiceLog:swedish', JSON.stringify(original))
          sessionStorage.setItem('isolation-seeded', '1')
        }
      }, { account, original: payload('Owner local goal', 1) })
      let started, release
      const fetching = new Promise(resolve => { started = resolve })
      const response = new Promise(resolve => { release = resolve })
      let delay = false
      await page.route('**/*', async route => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/practice-log.json')) {
          calls.push(url.pathname)
          const login = url.pathname.split('/')[1]
          if (delay) { started(); await response }
          return route.fulfill({ json: payload(`${login} remote goal`) })
        }
        return serveFixtures(route)
      })
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => window.__cupitorSearchReady && !!window.cupitorUserData)
      await page.evaluate(() => window.openPracticeLogDialog())
      const canReadOwn = !!account?.login && !!account.repo
      assert.equal(calls.length, canReadOwn ? 1 : 0, 'unidentified visitors and users without a repo make no personal-log request')
      if (canReadOwn) {
        assert.match(calls[0], new RegExp(`^/${account.login}/`))
        assert.ok(await page.locator('#practiceLogItems').getByText(`${account.login} remote goal`, { exact: true }).isVisible())
      } else {
        assert.equal(await page.locator('#practiceLogItems').innerText().then(text => /Owner local goal|remote goal/.test(text)), false)
        assert.equal(await page.evaluate(() => window.cupitorUserData.getItem('cupitor:practiceLog:swedish')), null)
        await page.locator('#practiceLogSaveBtn').click()
        assert.equal(calls.length, 0, 'anonymous sync must not even read the owner file')
      }
      assert.match(await page.evaluate(() => localStorage.getItem('cupitor:practiceLog:swedish')), /Owner local goal/)

      if (account === alice) {
        // A late response from Alice must not enter Bob's memory, display or store.
        await page.evaluate(() => window.openPracticeLogDialog()) // close
        delay = true
        await page.evaluate(() => { window.openingOldLog = window.openPracticeLogDialog() })
        await fetching
        await page.evaluate(async bob => {
          const { saveAccount } = await import('/language/account-state.js')
          saveAccount(bob)
        }, bob)
        assert.equal(await page.locator('#practiceLogDialog').isVisible(), false)
        assert.equal(await page.evaluate(() => window._practiceLog), null)
        assert.equal(await page.locator('#practiceLogItems').innerText(), '')
        release()
        await page.evaluate(() => window.openingOldLog)
        assert.equal(await page.evaluate(() => window._practiceLog), null)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.__cupitorSearchReady && !!window.cupitorUserData)
        delay = false
        await page.evaluate(() => window.openPracticeLogDialog())
        assert.ok(await page.locator('#practiceLogItems').getByText('bob remote goal', { exact: true }).isVisible())
        assert.equal(await page.locator('#practiceLogItems').innerText().then(text => /alice remote goal|Owner local goal/.test(text)), false)
        assert.ok(calls.at(-1).startsWith('/bob/'))
      }
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  }
  console.log(`${mobile ? 'Mobile' : 'Desktop'}: anonymous/guest/new-account isolation, owner preservation and delayed account-switch responses passed`)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    await check(browser, false)
    await check(browser, true)
    await checkIsolation(browser, false)
    await checkIsolation(browser, true)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
