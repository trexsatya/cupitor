const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const {serveFixtures} = require('./language-dialogs.cjs')

const srt = text => '1\n00:00:01,000 --> 00:00:03,000\n' + text + '\n'

async function check(browser, mobile) {
  const page = await browser.newPage({viewport:{width:mobile?390:1280,height:900}, isMobile:mobile, hasTouch:mobile})
  page.setDefaultTimeout(60000)
  const errors = [], index = [], packs = new Map(), reads = new Map()
  let offline = false, revised = false
  for (let row = 0; row < 40; row++) for (let pack = 0; pack < 10; pack++) {
    const path = `packs/pack-${String(pack + 1).padStart(6,'0')}.json`
    if (!packs.has(path)) packs.set(path,{version:1,files:{}})
    const name = `Packed ${pack} ${row}`, link = `pack-${pack}-${row}`
    index.push({link,name,source:'YouTube',bundle:path,bundleRevision:1})
    packs.get(path).files[name + '.sv.srt'] = srt('packbatchneedle ' + 'x'.repeat(24000))
    if (row % 5) packs.get(path).files[name + '.en.srt'] = srt('A complete translation')
  }
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.__packMetrics = {cacheWrites:0, updates:[]}
    const transaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function(names,mode,...rest) {
      if (mode === 'readwrite' && this.name.startsWith('cupitor-cache-v1-')) window.__packMetrics.cacheWrites++
      return transaction.call(this,names,mode,...rest)
    }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(data,...rest) {
        if (data.type === 'update') window.__packMetrics.updates.push({count:data.payload.documents.length,
          bytes:data.payload.documents.reduce((n,doc) => n + 2*((doc.sv?.length||0)+(doc.en?.length||0)),0)})
        return super.postMessage(data,...rest)
      }
    }
  })
  page.on('pageerror',error => errors.push(error.message))
  await page.route('**/*',async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/srts/index.json')) return route.fulfill({json:index.map(entry => revised && entry.bundle === 'packs/pack-000001.json' ? {...entry,bundleRevision:2} : entry)})
    const match = url.pathname.match(/\/srts\/(packs\/pack-\d+\.json)$/)
    if (match) {
      reads.set(match[1],(reads.get(match[1])||0)+1)
      return offline ? route.abort() : route.fulfill({json:packs.get(match[1])})
    }
    return serveFixtures(route)
  })
  const load = async () => {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.waitForFunction(() => window._subtitlesLoaded === true)
    await page.evaluate(() => window.cupitorSubtitleSearch.flush())
  }
  const searchAll = () => page.evaluate(async ids => {
    const hits = await window.cupitorSubtitleSearch.run('files',{ids,query:'packbatchneedle',suffix:'.sv.srt',compact:true})
    return hits.map(hit => hit.url).sort()
  },index.map(entry => entry.link))
  try {
    await load()
    assert.equal(reads.size,10)
    assert.ok([...reads.values()].every(count => count === 1),'each interleaved pack downloads once despite exceeding the LRU budget')
    const metrics = await page.evaluate(() => window.__packMetrics)
    assert.equal(metrics.cacheWrites,10,'400 small pairs share one bounded download-cache transaction per pack')
    assert.ok(metrics.updates.some(batch => batch.count > 1),'search writes must batch documents')
    assert.ok(metrics.updates.every(batch => batch.count <= 128 && batch.bytes <= 2*1024*1024))
    assert.deepEqual(await page.evaluate(() => window.srts.map(entry => entry.link)),index.map(entry => entry.link),'the visible index retains its original order')
    assert.equal(await page.evaluate(() => window.allSubtitles['pack-0-0'].en),null)
    assert.match(await page.evaluate(() => window.allSubtitles['pack-0-1'].en),/complete translation/)
    assert.deepEqual(await searchAll(),index.map(entry => entry.link).sort())
    revised = true
    await load()
    assert.equal(reads.get('packs/pack-000001.json'),2,'only a changed pack is refetched')
    assert.ok([...reads].filter(([path]) => path !== 'packs/pack-000001.json').every(([,count]) => count === 1))
    assert.equal(await page.evaluate(() => window.__packMetrics.cacheWrites),1)
    offline = true
    const before = [...reads]
    await load()
    assert.deepEqual([...reads],before,'offline reload reuses every complete imported pair')
    assert.equal(await page.evaluate(() => window.__packMetrics.cacheWrites),0)
    assert.deepEqual(await searchAll(),index.map(entry => entry.link).sort())
    assert.deepEqual(errors,[])
    console.log(`${mobile?'Mobile':'Desktop'}: 400 interleaved pairs, 10 pack reads, 10 cache transactions, bounded worker batches, revision refresh, complete search and offline reload passed`)
  } finally {await page.close()}
}

async function checkRecovery(browser) {
  const page = await browser.newPage()
  const entry = {link:'pack-recovery',name:'Pack recovery',source:'YouTube',bundle:'packs/pack-000001.json',bundleRevision:1}
  let reads = 0, release
  const hold = new Promise(resolve => {release=resolve})
  await page.addInitScript(() => {window.dontConfirmOnRefresh=true})
  await page.route('**/*',async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/srts/index.json')) return route.fulfill({json:[entry]})
    if (url.pathname.endsWith('/packs/pack-000001.json')) {
      reads++; await hold
      return route.fulfill({json:{version:1,files:{'Pack recovery.sv.srt':srt('Original remote context')}}})
    }
    return serveFixtures(route)
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'domcontentloaded'})
    await page.waitForFunction(() => window._srtsIndexLoaded && window.cupitorKnownVideos)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('capturedSubtitle',{detail:{videoId:'pack-recovery',sourceLang:'sv',lines:[{start:10,end:12,text:'Unsynced capture during pack download'}]}})))
    release()
    await page.waitForFunction(() => window._subtitlesLoaded === true && window.allSubtitles['pack-recovery']?.sv.includes('Unsynced capture during pack download'))
    const text = await page.evaluate(() => window.allSubtitles['pack-recovery'].sv)
    assert.match(text,/Original remote context/); assert.match(text,/Unsynced capture/)
    assert.equal(reads,1,'capture hydration shares the pending pack request')
    await page.evaluate(async () => {await window.cupitorSubtitleSearch.flush(); await window.cupitorUserData.flush()})
    await page.reload({waitUntil:'networkidle'})
    await page.waitForFunction(() => window._subtitlesLoaded === true)
    assert.equal(reads,1)
    assert.match(await page.evaluate(() => window.allSubtitles['pack-recovery'].sv),/Unsynced capture/)
    console.log('Concurrent capture: complete remote context and pending lines survive pack import and reload without a second download')
  } finally {release(); await page.close()}
}

async function checkWriteFailure(browser) {
  const page = await browser.newPage(), index = [], packs = new Map(), reads = []
  for (let row = 0; row < 40; row++) for (let pack = 0; pack < 8; pack++) {
    const path = `packs/pack-${String(pack + 1).padStart(6,'0')}.json`, name = `Recovery ${pack} ${row}`
    index.push({link:`recovery-${pack}-${row}`,name,source:'YouTube',bundle:path,bundleRevision:1})
    if (!packs.has(path)) packs.set(path,{version:1,files:{}})
    packs.get(path).files[name + '.sv.srt'] = srt('recoverablepackneedle ' + 'x'.repeat(1000))
  }
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    if (sessionStorage.getItem('pack-write-failed')) return
    sessionStorage.setItem('pack-write-failed','1')
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(data,...rest) {
        if (data.type === 'update') {
          queueMicrotask(() => this.dispatchEvent(new MessageEvent('message',{data:{id:data.id,generation:data.generation,
            error:{message:'Fixture search storage failed',code:'subtitle-search-incomplete'}}})))
          return
        }
        return super.postMessage(data,...rest)
      }
    }
  })
  await page.route('**/*',route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/srts/index.json')) return route.fulfill({json:index})
    const match = url.pathname.match(/\/srts\/(packs\/pack-\d+\.json)$/)
    if (match) {reads.push(match[1]); return route.fulfill({json:packs.get(match[1])})}
    return serveFixtures(route)
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.waitForFunction(() => window._subtitlesLoaded && window._subtitleSearchStorageError)
    assert.ok(reads.length <= 4,'failed persistence cannot start the queued packs')
    assert.ok(await page.evaluate(() => window.cupitorSubtitleMemoryStats().pendingDocuments <= 512))
    assert.match(await page.evaluate(() => window._subtitleSearchStorageError),/Fixture search storage failed/)
    await page.reload({waitUntil:'networkidle'})
    await page.waitForFunction(() => window._subtitlesLoaded === true)
    const found = await page.evaluate(async ids => {
      const hits = await window.cupitorSubtitleSearch.run('files',{ids,query:'recoverablepackneedle',suffix:'.sv.srt',compact:true})
      return hits.map(hit => hit.url).sort()
    },index.map(entry => entry.link))
    assert.deepEqual(found,index.map(entry => entry.link).sort())
    console.log('Storage failure: staging stops within four current batches, reports incomplete search and recovers all 320 pairs on reload')
  } finally {await page.close()}
}

;(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
  try {await check(browser,false); await check(browser,true); await checkRecovery(browser); await checkWriteFailure(browser)} finally {await browser.close()}
})().catch(error => {console.error(error); process.exitCode=1})
