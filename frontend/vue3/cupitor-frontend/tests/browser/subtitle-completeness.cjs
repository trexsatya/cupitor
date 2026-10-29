// Uses the reported 17-cue SRT, real app state and IndexedDB. GitHub writes
// are doubled: transforms see authoritative text and an optional retry.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const id = 'ivOW01v4VXc'
const name = 'Aftonbladet || Partiledarna om förslaget på förbud mot burka och niqab || ' + id
const full = fs.readFileSync(path.join(__dirname, '../fixtures/' + id + '.sv.srt'), 'utf8')
const partial = '1\n00:00:06,919 --> 00:00:10,759\n>> Ja, både burka och är ju uttryck för eh\n'
const english = '1\n00:00:00,160 --> 00:00:01,920\nA complete existing translation\n'

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 900 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(15000)
  let sourceReads = 0
  let releaseIndex
  let indexGate = null
  let releaseSource
  let sourceGate = null
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    const file = decodeURIComponent(url.pathname)
    if (file === '/seed.html') return route.fulfill({ body: '<html></html>', contentType: 'text/html' })
    if (url.hostname === '127.0.0.1' && file === '/language/language.js') {
      const hooks = '\nwindow.__subtitleTest = { getSubtitlesForLink, pushCapturedSubtitlesBatched, bufferCapturedSubtitle, loadCapturedBuffer, saveCapturedBuffer, _cacheWriteSubtitleFromMemory, _cacheReadAll, srtToJson };'
      return route.fulfill({ body: fs.readFileSync(path.join(__dirname, '../../public/language/language.js'), 'utf8') + hooks, contentType: 'application/javascript' })
    }
    if (file.endsWith('/srts/index.json')) {
      if (indexGate) await indexGate
      return route.fulfill({ json: [{ link: id, name, source: 'youtube' }] })
    }
    if (file.endsWith('.sv.srt')) {
      sourceReads++
      if (sourceGate) await sourceGate
      return route.fulfill({ body: full, contentType: 'text/plain' })
    }
    if (file.endsWith('.en.srt')) return route.fulfill({ body: english, contentType: 'text/plain' })
    return serveFixtures(route)
  })
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const waitReady = () => page.evaluate(async () => { await window._subtitlesReadyPromise })
  const read = () => page.evaluate(id => {
    const s = window.allSubtitles[id]
    return { sv: s.sv, en: s.en, cues: window.__subtitleTest.srtToJson(s.sv).length, complete: s._remoteComplete, partial: s._partial, name: s.fileName }
  }, id)
  try {
    // Simulate a cache created by the old push path. No manual cache clear.
    await page.goto('http://127.0.0.1:3000/seed.html')
    await page.evaluate(async ({ id, name, partial }) => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('cupitor-cache-v1-swedish', 1)
        req.onupgradeneeded = () => req.result.createObjectStore('subtitles', { keyPath: 'link' })
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('subtitles', 'readwrite')
          tx.objectStore('subtitles').put({ link: id, name, sv: partial, owner: 'trexsatya' })
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
      })
    }, { id, name, partial })
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => !!window.__subtitleTest)
    await waitReady()
    assert.equal(sourceReads, 1, 'legacy cache is automatically refreshed')
    assert.deepEqual(await read(), { sv: full, en: english, cues: 17, complete: true, partial: false, name })

    // Both a real commit and an already-on-GitHub capture must install the
    // entire merged API snapshot, not just the one cue in memory.
    for (const noOp of [false, true]) {
      const out = await page.evaluate(async ({ id, name, full, english, partial, noOp }) => {
        const t = window.__subtitleTest
        const detail = { videoId: id, sourceLang: 'sv', videoUrl: 'https://www.youtube.com/watch?v=' + id,
          lines: [{ start: 6.919, end: 10.759, text: '>> Ja, både burka och är ju uttryck för eh' }] }
        const item = { id: 'pushed', detail }
        let committedIndex
        const indexText = JSON.stringify([{ link: id, name, source: 'youtube', category: 'concurrent metadata' },
          { link: 'unrelated', name: 'Other media', source: 'youtube' }])
        t.saveCapturedBuffer([null, item])
        window.allSubtitles[id] = { sv: partial, en: null, _partial: true, _parsedSv: ['stale'], _parsedEn: ['stale'] }
        window.GitHubUtils.getFile = async () => ({ content: JSON.stringify([{ link: id, name, source: 'youtube' }]) })
        window.GitHubUtils.commitMultipleFiles = async ({ files }) => {
          // First transform pass is superseded by a simulated 409 retry.
          for (const file of files) await file.getContent(file.path.endsWith('/index.json') ? indexText : file.path.endsWith('.sv.srt') ? partial : null)
          for (const file of files) {
            const text = await file.getContent(file.path.endsWith('/index.json') ? indexText : file.path.endsWith('.sv.srt') ? full : english)
            if (file.path.endsWith('/index.json')) committedIndex = JSON.parse(text)
          }
          return { committed: !noOp, reason: noOp ? 'no-changes' : undefined }
        }
        const result = await t.pushCapturedSubtitlesBatched([item])
        t.saveCapturedBuffer([])
        const cache = (await t._cacheReadAll()).get(id)
        return { result, sv: window.allSubtitles[id].sv, en: window.allSubtitles[id].en,
          staleParse: !!window.allSubtitles[id]._parsedSv || !!window.allSubtitles[id]._parsedEn,
          cache, cueCount: t.srtToJson(window.allSubtitles[id].sv).length, committedIndex }
      }, { id, name, full, english, partial, noOp })
      assert.equal(out.cueCount, 17)
      assert.equal(out.en, english, 'untranslated capture retains the full translation')
      assert.equal(out.staleParse, false)
      assert.equal(out.cache.sv, out.sv)
      assert.equal(out.cache.complete, true)
      assert.equal(out.cache.contentVersion, 2)
      assert.equal(out.committedIndex.find(entry => entry.link === id).preserveCapturedContext, true)
      assert.equal(out.committedIndex.find(entry => entry.link === id).category, 'concurrent metadata')
      assert.equal(out.committedIndex.find(entry => entry.link === 'unrelated').name, 'Other media')
      if (noOp) assert.equal(out.result.committed, false)
    }
    const beforeReload = sourceReads
    await page.reload({ waitUntil: 'networkidle' })
    await waitReady()
    assert.equal(sourceReads, beforeReload, 'a corrected complete cache is reusable')
    assert.equal((await read()).cues, 17)

    // The full fetch must fill holes while preserving a capture arriving
    // during the request. Partial memory must never short-circuit it.
    sourceGate = new Promise(resolve => { releaseSource = resolve })
    await page.evaluate(({ id, partial }) => {
      const t = window.__subtitleTest
      window.allSubtitles[id] = { sv: partial, en: null, _partial: true }
      window.__loadingSubtitle = t.getSubtitlesForLink(id, 'youtube')
    }, { id, partial })
    await page.waitForTimeout(30)
    await page.evaluate(id => {
      window.dispatchEvent(new CustomEvent('capturedSubtitle', { detail: {
        videoId: id, sourceLang: 'sv', channel: 'A new label', title: 'New capture',
        lines: [{ start: 40, end: 41, text: 'A pending capture beyond the remote file' }],
        translation: [{ start: 40, end: 41, text: 'Pending translation' }]
      } }))
    }, id)
    releaseSource()
    sourceGate = null
    await page.evaluate(() => window.__loadingSubtitle)
    await page.waitForFunction(id => window.__subtitleTest.srtToJson(window.allSubtitles[id].sv).length === 18, id)
    const hydrated = await read()
    assert.equal(hydrated.cues, 18)
    assert(hydrated.sv.includes('bekymrad över detta. Andra länder har'))
    assert(hydrated.en.includes('A complete existing translation'))
    assert(hydrated.en.includes('Pending translation'))
    assert.equal(hydrated.name, name, 'a capture cannot rename an indexed SRT')
    assert.equal(hydrated.partial, false)

    // An excerpt arriving before index.json must not make the boot pool
    // consider that video already loaded. Remove only our test cache rows.
    await page.evaluate(async () => {
      window.__subtitleTest.saveCapturedBuffer([])
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('cupitor-cache-v1-swedish', 1)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('subtitles', 'readwrite')
          tx.objectStore('subtitles').clear()
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
      })
    })
    indexGate = new Promise(resolve => { releaseIndex = resolve })
    const readsBeforeBoot = sourceReads
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => !!window.__subtitleTest)
    await page.evaluate(id => window.dispatchEvent(new CustomEvent('capturedSubtitle', { detail: {
      videoId: id, sourceLang: 'sv', lines: [{ start: 40, end: 41, text: 'Captured before index load' }]
    } })), id)
    releaseIndex()
    indexGate = null
    await waitReady()
    assert.equal(sourceReads, readsBeforeBoot + 1)
    assert.equal((await read()).cues, 18)
    assert.equal((await read()).name, name)
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: complete subtitle merges, no-op pushes, retry snapshots, cache repair/reuse and captures during fetch/boot passed`)
  } finally {
    releaseSource?.()
    releaseIndex?.()
    await page.close()
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true) }
  finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
