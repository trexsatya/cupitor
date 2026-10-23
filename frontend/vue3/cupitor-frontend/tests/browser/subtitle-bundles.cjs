const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { serveFixtures } = require('./language-dialogs.cjs')
const path = require('node:path')
const fs = require('node:fs')

const dir = 'db/language/swedish/srts'
const a = 'bundleVid01', b = 'bundleVid02'
const titleA = 'Kanal || First || ' + a, titleB = 'Kanal || Second || ' + b
const cue = (text, index = 1, second = '01') => `${index}\n00:00:${second},000 --> 00:00:${String(Number(second) + 2).padStart(2, '0')},000\n${text}\n`
const textA = cue('En färgsprakande kväll.'), textB = cue('En färgsprakande dag.')
const hash = text => createHash('sha1').update(text).digest('hex')

async function check(browser, mobile) {
  const { packDocuments, bundleText, jsonText } = await import(path.resolve(__dirname, '../../public/language/subtitle-bundles.js'))
  const packed = packDocuments({ [titleA + '.sv.srt']: textA, [titleA + '.en.srt']: cue('A colourful evening.'), [titleB + '.sv.srt']: textB })
  const pack = packed.storage.packs[0].path
  const index = [{ link: a, name: titleA, source: 'YouTube', bundle: pack, bundleRevision: 1 },
    { link: b, name: titleB, source: 'YouTube', bundle: pack, bundleRevision: 1 }]
  let state = new Map([[dir + '/index.json', jsonText(index)], [dir + '/storage.json', jsonText(packed.storage)],
    [dir + '/' + pack, bundleText(packed.packs.get(pack))]])
  const snapshots = new Map([['head0', new Map(state)], ['tree0', new Map(state)]])
  const commits = new Map([['head0', { tree: { sha: 'tree0' } }]])
  const blobs = new Map(), writes = [], reads = []
  let head = 'head0', serial = 0, collide = true, bundleReads = 0
  const page = await browser.newPage({ viewport: { width: mobile ? 393 : 1280, height: 780 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), method = route.request().method(), file = decodeURIComponent(url.pathname)
    if (url.hostname === 'api.github.com') {
      const request = file.match(/^\/repos\/[^/]+\/[^/]+\/(.+)$/)
      if (!request) return route.fulfill({ status: 404, json: { message: 'Not Found' } })
      const endpoint = request[1]
      const body = route.request().postDataJSON()
      if (method === 'GET' && endpoint.startsWith('contents/')) {
        const target = endpoint.slice(9), ref = url.searchParams.get('ref')
        reads.push({ target, ref })
        const data = snapshots.get(ref) || state
        if (!data.has(target)) return route.fulfill({ status: 404, json: { message: 'Not Found' } })
        const content = data.get(target)
        return route.fulfill({ json: { content: Buffer.from(content).toString('base64'), sha: hash(content), size: Buffer.byteLength(content) } })
      }
      if (method === 'GET' && endpoint.startsWith('git/ref/heads/')) return route.fulfill({ json: { object: { sha: head } } })
      if (method === 'GET' && endpoint.startsWith('branches/')) return route.fulfill({ json: { commit: { sha: head } } })
      if (method === 'GET' && endpoint.startsWith('git/commits/')) return route.fulfill({ json: commits.get(endpoint.slice(12)) })
      if (method === 'POST' && endpoint === 'git/blobs') {
        const sha = 'blob' + ++serial
        blobs.set(sha, body.content)
        return route.fulfill({ json: { sha } })
      }
      if (method === 'POST' && endpoint === 'git/trees') {
        const data = new Map(snapshots.get(body.base_tree))
        for (const entry of body.tree) { writes.push(entry.path); if (entry.sha === null) data.delete(entry.path); else data.set(entry.path, blobs.get(entry.sha)) }
        const sha = 'tree' + ++serial
        snapshots.set(sha, data)
        return route.fulfill({ json: { sha } })
      }
      if (method === 'POST' && endpoint === 'git/commits') {
        const sha = 'commit' + ++serial
        commits.set(sha, { tree: { sha: body.tree } })
        snapshots.set(sha, snapshots.get(body.tree))
        return route.fulfill({ json: { sha } })
      }
      if (method === 'PATCH' && endpoint.startsWith('git/refs/heads/')) {
        if (collide) {
          collide = false
          const data = JSON.parse(state.get(dir + '/' + pack))
          data.files[titleB + '.sv.srt'] = textB.replace('dag.', 'dag. Concurrent edit.')
          state = new Map(state)
          state.set(dir + '/' + pack, JSON.stringify(data, null, 2) + '\n')
          const manifest = JSON.parse(state.get(dir + '/storage.json')); manifest.packs[0].revision++
          state.set(dir + '/storage.json', jsonText(manifest))
          state.set(dir + '/index.json', jsonText(index.map(entry => ({ ...entry, bundleRevision: 2 }))))
          head = 'remote'; snapshots.set(head, state); snapshots.set('remoteTree', state); commits.set(head, { tree: { sha: 'remoteTree' } })
          return route.fulfill({ status: 422, json: { message: 'Not a fast forward' } })
        }
        head = body.sha; state = snapshots.get(head)
        return route.fulfill({ json: { object: { sha: head } } })
      }
      return route.fulfill({ status: 404, json: { message: endpoint } })
    }
    if (url.hostname !== '127.0.0.1') {
      const at = file.indexOf('/db/language/swedish/srts/')
      if (at >= 0) {
        const target = file.slice(at + 1)
        if (/\/packs\//.test(target)) bundleReads++
        return state.has(target) ? route.fulfill({ body: state.get(target), contentType: 'application/json' }) : route.fulfill({ status: 404, body: 'Not found' })
      }
    }
    return serveFixtures(route)
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    assert.equal(bundleReads, 1, 'all media and language tracks share one bundle request')
    assert.equal(await page.evaluate(a => window.allSubtitles[a].sv, a), textA)
    await page.evaluate(() => { window.showInfoWithoutPopup = false })
    await page.locator('#searchText').fill('färgsprakande')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(() => document.querySelectorAll('#result .srt-file').length === 2)

    const click = locator => mobile ? locator.tap() : locator.click()
    await click(page.locator(`#result .play-btn-container[data-url="${a}"] .media-info`).first())
    await click(page.locator('#info-dialog-content').getByRole('button', { name: 'Show complete SRT' }))
    const fullSrt = page.locator('#fullSrtDialog')
    await fullSrt.locator('.full-srt-text').waitFor({ state: 'visible' })
    assert.equal(await fullSrt.locator('.full-srt-text').textContent(), textA, 'full SRT dialog reads the exact bundled source')
    await fullSrt.locator('.full-srt-language').selectOption('en')
    assert.equal(await fullSrt.locator('.full-srt-text').textContent(), cue('A colourful evening.'), 'full SRT dialog reads the bundled translation')
    await click(fullSrt.locator('..').locator('.ui-dialog-buttonpane').getByRole('button', { name: 'Close', exact: true }))
    await page.evaluate(() => $('#info-dialog-content').dialog('close'))

    // Real commitMultipleFiles and adapter, including a branch race.
    await page.evaluate(async a => {
      window.GitHubUtils.setGHToken('test')
      await window.pushCapturedSubtitlesBatched([{ id: 'capture', detail: { videoId: a, sourceLang: 'sv',
        videoUrl: 'https://www.youtube.com/watch?v=' + a, lines: [{ start: 10, end: 12, text: 'A newly captured cue.' }] } }])
    }, a)
    let files = JSON.parse(state.get(dir + '/' + pack)).files
    assert.match(files[titleA + '.sv.srt'], /En färgsprakande kväll/)
    assert.match(files[titleA + '.sv.srt'], /A newly captured cue/)
    assert.match(files[titleB + '.sv.srt'], /Concurrent edit/)
    assert.equal(files[titleA + '.en.srt'], cue('A colourful evening.'))
    assert(reads.some(read => read.ref === 'remote'), 'retry reads from the new immutable head')
    assert(!writes.some(path => path.endsWith('.srt')), 'no individual SRT files are recreated')

    // Add a completely new video and its source/translation together.
    await page.evaluate(async () => {
      await window.pushCapturedSubtitlesBatched([{ id: 'new', detail: { videoId: 'bundleNew03', sourceLang: 'sv', targetLang: 'en', source: 'YouTube',
        videoTitle: 'New title', channel: 'Kanal', lines: [{ start: 1, end: 3, text: 'Nytt innehåll.' }], translation: [{ start: 1, end: 3, text: 'New content.' }] } }])
    })
    assert(JSON.parse(state.get(dir + '/index.json')).find(entry => entry.link === 'bundleNew03')?.bundle)
    assert(![...state.keys()].some(path => path.endsWith('.srt')))

    // Single-file merge editing uses conditional virtual reads and preserves siblings.
    await page.evaluate(async ({ dir, titleA }) => {
      const target = { owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages' }
      const filePath = dir + '/' + titleA + '.en.srt'
      const current = await window.GitHubUtils.getFile(target.owner, target.repo, filePath, '', target.branch)
      await window.GitHubUtils.putFile(target.owner, target.repo, filePath, current.content.replace('colourful', 'bright'), 'Edit translation', current.sha, '', target.branch)
    }, { dir, titleA })
    files = JSON.parse(state.get(dir + '/' + pack)).files
    assert.match(files[titleA + '.en.srt'], /bright/)
    assert.match(files[titleB + '.sv.srt'], /Concurrent edit/)
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(async () => window._subtitlesReadyPromise)
    assert.match(await page.evaluate(b => window.allSubtitles[b].sv, b), /Concurrent edit/, 'changed bundle revisions invalidate old per-video caches')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: bundle boot/search, deduplicated requests, captures, atomic new media, concurrent retry, edits and cache invalidation passed`)
  } finally { await page.close() }
}
async function checkRealCorpus(browser, root) {
  for (const [language, code] of [['swedish', 'sv'], ['spanish', 'es']]) {
    const directory = path.join(root, language, 'srts')
    const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json')))
    const documents = new Map(), expected = Object.create(null), seen = new Set(), requests = new Set()
    for (const entry of index) {
      if (seen.has(entry.link)) continue
      seen.add(entry.link)
      if (!entry.bundle) continue
      if (!documents.has(entry.bundle)) documents.set(entry.bundle, JSON.parse(fs.readFileSync(path.join(directory, entry.bundle))).files)
      const files = documents.get(entry.bundle), base = entry.bundleKey || entry.name
      if (Object.hasOwn(files, base + '.' + code + '.srt')) expected[entry.link] = { sv: files[base + '.' + code + '.srt'] || null, en: files[base + '.en.srt'] || null }
    }
    const page = await browser.newPage({ viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true })
    await page.route('**/*', route => {
      const url = new URL(route.request().url()), file = decodeURIComponent(url.pathname)
      const marker = '/db/language/' + language + '/srts/'
      const at = file.indexOf(marker)
      if (url.hostname !== '127.0.0.1' && at >= 0) {
        const relative = file.slice(at + marker.length), location = path.resolve(directory, relative)
        if (!location.startsWith(directory + path.sep) || !fs.existsSync(location)) return route.fulfill({ status: 404, body: 'Not found' })
        if (relative.startsWith('packs/')) requests.add(relative)
        return route.fulfill({ body: fs.readFileSync(location), contentType: 'application/json' })
      }
      return serveFixtures(route)
    })
    try {
      await page.goto('http://127.0.0.1:3000/language.html?lang=' + language, { waitUntil: 'networkidle' })
      await page.evaluate(async () => window._subtitlesReadyPromise)
      const actual = await page.evaluate(() => Object.fromEntries(Object.entries(window.allSubtitles).map(([link, s]) => [link, { sv: s.sv, en: s.en || null }])))
      assert.equal(Object.keys(actual).length, Object.keys(expected).length, language + ': complete media count')
      for (const [link, tracks] of Object.entries(expected)) {
        assert.equal(hash(actual[link].sv || ''), hash(tracks.sv || ''), language + ': source mismatch for ' + link)
        assert.equal(hash(actual[link].en || ''), hash(tracks.en || ''), language + ': translation mismatch for ' + link)
      }
      console.log(`Real ${language}: ${Object.keys(expected).length} complete subtitle pairs verified through ${requests.size} bundle requests`)
    } finally { await page.close() }
  }
}
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    await check(browser, true); await check(browser, false)
    if (process.env.CUPITOR_BUNDLE_DATA_DIR) await checkRealCorpus(browser, process.env.CUPITOR_BUNDLE_DATA_DIR)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
