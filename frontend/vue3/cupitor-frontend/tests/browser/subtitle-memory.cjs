const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const {serveFixtures}=require('./language-dialogs.cjs')

async function check(browser,disk){
  const page=await browser.newPage()
  await page.route('**/*',serveFixtures)
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  try{
    await page.goto('http://127.0.0.1:3000/language.html'+(disk?'?subtitleSearch=indexeddb':''),{waitUntil:'domcontentloaded'})
    await page.waitForFunction(()=>window.__cupitorSearchReady&&window._subtitlesLoaded)
    assert.equal(await page.evaluate(()=>window.cupitorSubtitleSearch.storage),disk?'indexeddb':'memory')
    await page.locator('#searchText').fill('färgsprakande');await page.locator('#searchText').press('Enter')
    await page.waitForFunction(()=>window._subtitleSearchCompletion?.complete)
    assert.ok(await page.evaluate(()=>Object.values(window._lastWordToItemsMap).flat().length>0))
    assert.equal(await page.evaluate(async()=>(await indexedDB.databases()).some(db=>db.name==='cupitor-search-corpus-v1')),disk,
      'default searches do not create or query the disk search corpus')
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window._subtitlesLoaded)
    assert.equal(await page.evaluate(()=>window.cupitorSubtitleSearch.storage),disk?'indexeddb':'memory')
    if(!disk){
      const result=await page.evaluate(async()=>{
        const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
        const client=createSubtitleSearchClient({scope:'memory-restart-browser',storage:'memory',timeoutMs:100})
        const srt=text=>'1\n00:00:01,000 --> 00:00:03,000\n'+text+'\n'
        try{
          client.update('edit',{sv:srt('saved needle'),en:srt('translation')})
          client.update('deleted',{sv:srt('old needle'),en:null});await client.flush()
          client.update('edit',{sv:srt('unsaved needle'),en:srt('translation')})
          client.update('deleted',null)
          client.update('probe',{sv:srt('a'.repeat(40000)+'!'),en:null});await client.flush()
          let code
          try{await client.run('files',{ids:['probe'],query:'(a+)+$'})}catch(error){code=error.code}
          const hits=await client.run('files',{ids:['edit'],query:'needle',compact:true})
          const doc=await client.run('document',{id:'edit'})
          let removed=false
          try{await client.run('document',{id:'deleted'})}catch(_){removed=true}
          return {code,ids:hits.map(hit=>hit.url),text:doc.sv,removed}
        }finally{client.close()}
      })
      assert.equal(result.code,'subtitle-search-timeout');assert.deepEqual(result.ids,['edit'])
      assert.match(result.text,/unsaved needle/);assert.equal(result.removed,true)
    }
    console.log(disk?'IndexedDB feature flag: search and reload passed':'Default RAM search: no search database, correct results, reload and edits preserved through worker restart passed')
  }finally{await page.close()}
}
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
  try{await check(browser,false);await check(browser,true)}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
