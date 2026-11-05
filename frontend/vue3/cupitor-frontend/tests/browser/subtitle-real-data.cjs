// Read-only verification against a real db/language/swedish directory:
// CUPITOR_REAL_SUBTITLE_DATA=/path/to/swedish node tests/browser/subtitle-real-data.cjs
// No transcripts or account data are included in this test or written remotely.
const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {pathToFileURL}=require('node:url')
const {serveFixtures}=require('./language-dialogs.cjs')
const {installSlowSubtitleStorage}=require('./slow-subtitle-storage.cjs')

async function main(){
  assert.ok(process.env.CUPITOR_REAL_SUBTITLE_DATA,'Set CUPITOR_REAL_SUBTITLE_DATA to a real language data directory')
  const root=path.resolve(process.env.CUPITOR_REAL_SUBTITLE_DATA)
  const cpuRate=Number(process.env.CUPITOR_REAL_SUBTITLE_CPU_RATE||1)
  const storageDelayMs=Number(process.env.CUPITOR_REAL_SUBTITLE_STORAGE_DELAY_MS||0)
  const storage=process.env.CUPITOR_REAL_SUBTITLE_ENGINE||'memory'
  assert.ok(Number.isFinite(cpuRate)&&cpuRate>=1)
  assert.ok(Number.isFinite(storageDelayMs)&&storageDelayMs>=0)
  const assets=path.resolve(__dirname,'../..',process.env.CUPITOR_TEST_ASSETS||'public')
  const index=JSON.parse(fs.readFileSync(path.join(root,'srts/index.json'),'utf8'))
  const packs=new Map(),documents=[],missing=[],queries=['försova','överfalla','vaken']
  const {prepareSearchDocument,matchSearchDocument}=await import(pathToFileURL(path.resolve(__dirname,'../../public/language/subtitle-search-engine.js')))
  for(const entry of index){
    let sv,en
    if(entry.bundle){
      if(!packs.has(entry.bundle))packs.set(entry.bundle,JSON.parse(fs.readFileSync(path.join(root,'srts',entry.bundle),'utf8')).files)
      const files=packs.get(entry.bundle),name=entry.bundleKey||entry.name
      sv=files[name+'.sv.srt'];en=files[name+'.en.srt']
    }else{
      const read=suffix=>{const file=path.join(root,'srts',entry.name+suffix);return fs.existsSync(file)?fs.readFileSync(file,'utf8'):null}
      sv=read('.sv.srt');en=read('.en.srt')
    }
    if(sv==null){missing.push(entry.link);continue}
    documents.push(prepareSearchDocument({id:entry.link,sv,en,source:entry.source}))
  }
  assert.ok(index.length>=10000,'This is a library-scale check, not the small UI fixture')
  const reference=new Map(queries.map(query=>[query,documents.filter(doc=>matchSearchDocument(doc,query)).map(doc=>doc.id).sort()]))
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
  const report={total:index.length,available:documents.length,missing,packCount:packs.size,cpuRate,storageDelayMs,searches:[]}
  try{
    const desktop=cpuRate>1
    const context=await browser.newContext({viewport:{width:desktop?1280:390,height:900},isMobile:!desktop,hasTouch:!desktop})
    const page=await context.newPage(),reads=new Map(),errors=[]
    if(cpuRate>1){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate})}
    page.setDefaultTimeout(120000)
    page.on('pageerror',error=>errors.push(error.message))
    await page.addInitScript(()=>{
      window.dontConfirmOnRefresh=true
      window.__realSubtitleProbes=0
      const NativeWorker=window.Worker
      window.Worker=class extends NativeWorker{postMessage(data,...rest){if(data.type==='ping')window.__realSubtitleProbes++;return super.postMessage(data,...rest)}}
    })
    await context.route('**/*',route=>{
      const url=new URL(route.request().url()),prefix='/db/language/swedish/',offset=url.pathname.indexOf(prefix)
      if(storageDelayMs&&url.pathname.endsWith('/subtitle-search-worker.js'))return route.fulfill({contentType:'application/javascript',
        body:`(${installSlowSubtitleStorage.toString()})(${JSON.stringify({readMs:storageDelayMs})});\n`+fs.readFileSync(path.join(assets,'language/subtitle-search-worker.js'),'utf8')})
      if(offset>=0){
        const relative=decodeURIComponent(url.pathname.slice(offset+prefix.length)),file=path.resolve(root,relative)
        assert.ok(file.startsWith(root+path.sep),'Data reads stay within the chosen fixture')
        if(fs.existsSync(file)&&fs.statSync(file).isFile()){
          reads.set(relative,(reads.get(relative)||0)+1)
          return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.json')?'application/json':'text/plain'})
        }
        if(relative.endsWith('.srt'))return route.fulfill({status:404,body:''})
      }
      return serveFixtures(route)
    })
    const loaded=async()=>{
      await page.waitForFunction(()=>window._subtitlesLoaded===true)
      assert.equal(await page.evaluate(()=>Object.keys(window.allSubtitles).length),documents.length)
      assert.equal(await page.evaluate(()=>window._subtitleSearchStorageError),undefined)
    }
    let start=Date.now()
    await page.goto('http://127.0.0.1:3000/language.html'+(storage==='indexeddb'?'?subtitleSearch=indexeddb':''),{waitUntil:'domcontentloaded'});await loaded()
    report.coldLoadMs=Date.now()-start
    report.storage=await page.evaluate(()=>window.cupitorSubtitleSearch.storage)
    assert.equal(report.storage,storage)
    assert.equal(await page.evaluate(()=>window._subtitleSearchMode),'worker','a busy computer should keep searches off the main thread')
    assert.equal([...reads.keys()].filter(file=>file.startsWith('srts/packs/')).length,packs.size)
    assert.ok([...reads].filter(([file])=>file.startsWith('srts/packs/')).every(([,count])=>count===1),'every pack downloads once')
    for(const query of queries){
      const token=await page.evaluate(()=>window._subtitleSearchToken||0)
      start=Date.now()
      await page.locator('#searchText').fill(query);await page.locator('#searchText').press('Enter')
      await page.waitForFunction(({query,token})=>window._requestedSearchText===query&&window._subtitleSearchToken>token&&window._subtitleSearchCompletion?.reason!=='running', {query,token})
      assert.equal(await page.locator('#result .search-incomplete').count(),0,`Search ${query} failed: ${await page.locator('#result').textContent()}`)
      assert.ok(await page.locator('#result .l-accordion').count(),'accordions are rendered before loading ends')
      await page.locator('#searchLoadingOverlay').waitFor({state:'hidden'})
      const uiMs=Date.now()-start
      const completion=await page.evaluate(()=>window._subtitleSearchCompletion)
      assert.deepEqual([...completion.missing].sort(),[...missing].sort(),'only genuinely unavailable repository entries are reported missing')
      report.searches.push({query,uiMs,matchingFiles:reference.get(query).length})
    }
    if(process.env.SCREENSHOT_DIR){
      fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true})
      const heading=page.locator('#result .l-accordion:not(.no-result)').first()
      if(!await heading.evaluate(el=>el.classList.contains('active')))await heading.click()
      await heading.locator('..').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'cupitor-real-subtitle-search-mobile.png')})
    }
    for(const query of queries){
      const actual=await page.evaluate(async({ids,query})=>(await window.cupitorSubtitleSearch.run('files',{ids,query,compact:true})).map(hit=>hit.url).sort(),{ids:documents.map(doc=>doc.id),query})
      assert.deepEqual(actual,reference.get(query),'worker results match an independent full in-memory scan of the real corpus')
    }
    const legacyScope=storage==='indexeddb'?await page.evaluate(async()=>{
      const client=window.cupitorSubtitleSearch,scopes=await client.run('caches',{})
      const baseScope=scopes.find(meta=>meta.scope===client.storageScope).baseScope
      const token=sessionStorage.getItem('cupitor:subtitle-search-session:'+baseScope)
      const legacyScope=JSON.stringify([baseScope,token])
      const {openSubtitleCorpus}=await import('/language/subtitle-corpus-store.js')
      const legacy=await openSubtitleCorpus(legacyScope,indexedDB,{baseScope})
      try{
        let batch=[]
        for(const [id,record]of Object.entries(window.allSubtitles)){
          const raw=record._evicted?await client.run('document',{id}):record
          batch.push({...raw,id,revision:1})
          if(batch.length>=128){await legacy.put(batch);batch=[]}
        }
        if(batch.length)await legacy.put(batch)
        await legacy.indexDocument(Object.keys(window.allSubtitles)[0])
      }finally{legacy.close()}
      return legacyScope
    }):null
    const before=new Map(reads);start=Date.now()
    await page.reload({waitUntil:'domcontentloaded'});await loaded();report.reloadMs=Date.now()-start
    if(legacyScope){
      assert.ok(!await page.evaluate(async scope=>(await window.cupitorSubtitleSearch.run('caches',{})).some(meta=>meta.scope===scope),legacyScope),'upgrade reclaims the previous full-library index even while its old lease has not expired')
      report.legacyUpgradeReclaimed=true
    }
    const failedPacks=new Set(index.filter(entry=>missing.includes(entry.link)).map(entry=>'srts/'+entry.bundle))
    for(const [file,count]of before)if(file.startsWith('srts/packs/')&&!failedPacks.has(file))assert.equal(reads.get(file),count,'complete cached packs are reused on reload')
    // Supervise a real library scan with a shorter inactivity budget. First
    // force a worker restart so candidate metadata is genuinely cold.
    report.watchdog=await page.evaluate(async storage=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const client=createSubtitleSearchClient({scope:'real-library-watchdog',storage,timeoutMs:1000,indexingPaused:true})
      try{
        const ids=Object.keys(window.allSubtitles)
        for(const id of ids){
          let doc=window.allSubtitles[id]
          if(doc._evicted)doc=await window.cupitorSubtitleSearch.run('document',{id})
          client.update(id,doc)
          if(client.pendingSize>=128)await client.flush()
        }
        await client.flush()
        client.update('watchdog-probe',{sv:'1\n00:00:01,000 --> 00:00:03,000\n'+'a'.repeat(40000)+'!\n',en:null})
        await client.flush()
        let stalled
        try{await client.run('files',{ids:['watchdog-probe'],query:'(a+)+$'})}catch(error){stalled=error.code}
        const start=performance.now()
        const hits=await client.run('files',{ids,query:'försova',compact:true})
        return {stalled,recoveryMs:Math.round(performance.now()-start),budgetMs:1000,files:hits.map(hit=>hit.url).sort()}
      }finally{client.close()}
    },storage)
    assert.equal(report.watchdog.stalled,'subtitle-search-timeout','a stalled worker is still terminated')
    assert.deepEqual(report.watchdog.files,reference.get('försova'),'the restarted worker searches the entire real corpus without a false timeout')
    assert.deepEqual(errors,[])
    report.livenessProbes=await page.evaluate(()=>window.__realSubtitleProbes)
    if(storage==='indexeddb'&&storageDelayMs>10000)assert.ok(report.livenessProbes>0,'the full-library check must exercise the slow-storage watchdog path')
    console.log(JSON.stringify(report,null,2))
    if(process.env.CUPITOR_REAL_SUBTITLE_REPORT)fs.writeFileSync(process.env.CUPITOR_REAL_SUBTITLE_REPORT,JSON.stringify(report,null,2)+'\n')
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
