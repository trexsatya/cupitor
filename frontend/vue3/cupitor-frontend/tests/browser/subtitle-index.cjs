const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const {serveFixtures}=require('./language-dialogs.cjs')

async function check(browser,fallback){
  const page=await browser.newPage()
  page.setDefaultTimeout(60000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',serveFixtures)
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  try{
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    const result=await page.evaluate(async fallback=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const modes=[],client=createSubtitleSearchClient({scope:'indexed-browser-'+fallback,timeoutMs:10000,
        ...(fallback?{workerFactory:()=>{throw new Error('Fixture host has no workers')}}:{}),onMode:mode=>modes.push(mode)})
      const srt=text=>'1\n00:00:01,000 --> 00:00:03,000\n'+text+'\n'
      const ids=Array.from({length:130},(_,i)=>'indexed'+i)
      const query=(text,extra={})=>client.run('files',{ids,query:text,suffix:'.sv.srt',...extra})
      async function indexed(){
        const deadline=Date.now()+60000
        for(;;){const status=await client.run('indexStatus',{ids});if(!status.pending)return status;if(Date.now()>deadline)throw new Error('Index preparation did not finish: '+JSON.stringify(status));await new Promise(resolve=>setTimeout(resolve,25))}
      }
      try{
        ids.forEach((id,i)=>client.update(id,{sv:srt(i===129?'rareindexneedle across\ncues':'ordinary subtitle material '+i),en:srt(i===129?'specifictranslation':'regular translation'),source:'YouTube'}))
        await client.flush()
        const cold=await query('rareindexneedle')
        const prepared=await indexed()
        const warm=await query('rareindexneedle'),warmStats=await client.run('indexStatus',{ids})
        const reference=await query('rareindexneedle',{useIndex:false})
        const phrase=await query('across cues')
        const alternatives=await query('rareindexneedle|specifictranslation')
        client.update(ids[0],{sv:srt('newindexneedle'),en:srt('new translation'),source:'YouTube'})
        const changed=await query('newindexneedle')
        await indexed()
        const changedWarm=await query('newindexneedle'),changedStats=await client.run('indexStatus',{ids})
        client.update(ids[0],null)
        const remaining=ids.slice(1)
        const deleted=await client.run('files',{ids:remaining,query:'newindexneedle',suffix:'.sv.srt'})
        return {modes,cold:cold.map(hit=>hit.url),prepared,warm:warm.map(hit=>hit.url),same:JSON.stringify(warm)===JSON.stringify(reference),warmStats,
          phrase:phrase.map(hit=>hit.url),alternatives:alternatives.map(hit=>hit.url),changed:changed.map(hit=>hit.url),changedWarm:changedWarm.map(hit=>hit.url),changedStats,deleted:deleted.length}
      }finally{client.close()}
    },fallback)
    assert.deepEqual(result.modes,[fallback?'cooperative':'worker'])
    assert.equal(result.prepared.ready,130)
    assert.deepEqual(result.cold,['indexed129']);assert.deepEqual(result.warm,result.cold);assert.equal(result.same,true)
    assert.equal(result.warmStats.lastQuery.strategy,'trigram');assert.equal(result.warmStats.lastQuery.inspected,1)
    assert.deepEqual(result.phrase,['indexed129']);assert.deepEqual(result.alternatives,['indexed129'])
    assert.deepEqual(result.changed,['indexed0']);assert.deepEqual(result.changedWarm,result.changed)
    assert.equal(result.changedStats.lastQuery.inspected,1);assert.equal(result.deleted,0)
    assert.deepEqual(errors,[])
    console.log(`${fallback?'Cooperative':'Worker'}: index preparation, bounded shards, actual candidate pruning, full-scan parity, cross-cue phrases, alternatives, immediate edits and deletions passed`)
  }finally{await page.close()}
}
async function checkReload(browser){
  const context=await browser.newContext(),page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',serveFixtures)
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  const install=()=>page.evaluate(async()=>{
    if(!navigator.locks)throw new Error('This fixture requires native Web Locks')
    const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
    const client=window.__reloadIndex=createSubtitleSearchClient({scope:'reload-index-proof'})
    const ids=['same','another'],srt=text=>'1\n00:00:01,000 --> 00:00:03,000\n'+text+'\n'
    client.update('same',{sv:srt('originalneedle'),en:null,source:'YouTube'})
    client.update('another',{sv:srt('unrelated'),en:null,source:'YouTube'})
    await client.flush()
    for(let attempt=0;attempt<200;attempt++){
      const status=await client.run('indexStatus',{ids})
      if(!status.pending)break
      await new Promise(resolve=>setTimeout(resolve,25))
    }
    const results=await client.run('files',{ids,query:'originalneedle',suffix:'.sv.srt'})
    const status=await client.run('indexStatus',{ids}),caches=await client.run('caches',{})
    return {scope:client.storageScope,results:results.map(hit=>hit.url),status,indexBytes:caches.find(entry=>entry.scope===client.storageScope).indexBytes,
      token:sessionStorage.getItem('cupitor:subtitle-search-session:reload-index-proof')}
  })
  let copied
  try{
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    const before=await install()
    await page.evaluate(()=>window.cupitorUserData.flush())
    await page.reload({waitUntil:'networkidle'})
    const after=await install()
    assert.equal(after.scope,before.scope,'reload reuses the persisted tab corpus')
    assert.equal(after.indexBytes,before.indexBytes,'unchanged downloads do not add index data')
    assert.equal(after.status.ready,2);assert.equal(after.status.lastQuery.inspected,1)
    assert.deepEqual(after.results,['same'])
    copied=await context.newPage()
    await copied.route('**/*',serveFixtures)
    await copied.addInitScript(token=>{
      window.dontConfirmOnRefresh=true
      sessionStorage.setItem('cupitor:subtitle-search-session:reload-index-proof',token)
    },after.token)
    await copied.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    const separate=await copied.evaluate(async()=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const client=window.__copiedIndex=createSubtitleSearchClient({scope:'reload-index-proof'})
      client.update('same',{sv:'1\n00:00:01,000 --> 00:00:03,000\nseparateneedle\n',en:null,source:'YouTube'})
      const result=await client.run('files',{ids:['same'],query:'separateneedle',suffix:'.sv.srt'})
      return {scope:client.storageScope,results:result.map(hit=>hit.url)}
    })
    assert.notEqual(separate.scope,after.scope,'a copied tab cannot share mutable search data')
    assert.deepEqual(separate.results,['same'])
    const original=await page.evaluate(async()=>{
      const result=await window.__reloadIndex.run('files',{ids:['same'],query:'originalneedle',suffix:'.sv.srt'})
      return result.map(hit=>hit.url)
    })
    assert.deepEqual(original,['same']);assert.deepEqual(errors,[])
    console.log('Persistent index: same-tab reload reuse, unchanged index size and copied-tab edit isolation passed')
  }finally{await context.close()}
}
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
  try{await check(browser,false);await check(browser,true);await checkReload(browser)}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
