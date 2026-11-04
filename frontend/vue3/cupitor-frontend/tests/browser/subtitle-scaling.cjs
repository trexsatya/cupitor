const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const {serveFixtures}=require('./language-dialogs.cjs')

async function check(browser,mobile){
  const page=await browser.newPage({viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile})
  page.setDefaultTimeout(30000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  let offline=false,reads=0
  const index=Array.from({length:4},(_,i)=>({link:'large'+i,name:'Large '+i,source:'YouTube'}))
  const raw='1\n00:00:01,000 --> 00:00:03,000\nevictedneedle remains searchable\n\n2\n00:00:04,000 --> 00:00:06,000\n'+'x'.repeat(4500000)+'\n'
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url())
    if(url.pathname.endsWith('/srts/index.json'))return route.fulfill({json:index})
    if(url.pathname.endsWith('.sv.srt')){reads++;return offline?route.abort():route.fulfill({body:raw,contentType:'text/plain'})}
    if(url.pathname.endsWith('.en.srt'))return offline?route.abort():route.fulfill({body:'1\n00:00:01,000 --> 00:00:03,000\nA complete translation\n',contentType:'text/plain'})
    return serveFixtures(route)
  })
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  const ready=()=>page.evaluate(async()=>{await window._subtitlesReadyPromise;window._appSettings.contextLinesBefore=0;window._appSettings.contextLinesAfter=0})
  const search=async text=>{
    await page.locator('#searchText').fill(text);await page.locator('#searchText').press('Tab')
    await page.waitForFunction(()=>window._subtitleSearchCompletion?.complete)
  }
  try{
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'});await ready()
    await search('evictedneedle')
    const stats=await page.evaluate(()=>window.cupitorSubtitleMemoryStats())
    assert.ok(stats.evicted>0,'the fixture must exceed the actual main-thread raw budget')
    assert.ok(stats.residentBytes<=stats.budgetBytes)
    assert.deepEqual(await page.evaluate(()=>[...new Set(Object.values(window._lastWordToItemsMap).flat().map(item=>item.url))].sort()),index.map(item=>item.link))
    assert.ok(await page.evaluate(()=>window.searchResult.every(file=>file.sv_subs._contextOnly&&file.sv_subs.data.length===0)))
    assert.ok((await page.locator('#result .main-line').allTextContents()).some(text=>text.includes('evictedneedle')))
    const generated=await page.evaluate(()=>window.buildAutomaticItems({words:['evictedneedle'],matchesPerWord:4,contextLines:0}))
    assert.deepEqual(generated.map(tuple=>tuple.it.id).sort(),index.map(item=>item.link))
    const evicted=await page.evaluate(()=>Object.keys(window.allSubtitles).find(id=>window.allSubtitles[id]._evicted))
    await page.evaluate(id=>window.dispatchEvent(new CustomEvent('capturedSubtitle',{detail:{videoId:id,sourceLang:'sv',lines:[{start:10,end:12,text:'newcaptureunique'}]}})),evicted)
    await search('newcaptureunique')
    assert.ok(await page.evaluate(id=>Object.values(window._lastWordToItemsMap).flat().some(item=>item.url===id),evicted))
    await search('evictedneedle')
    assert.ok(await page.evaluate(id=>Object.values(window._lastWordToItemsMap).flat().some(item=>item.url===id),evicted),'capture merging retains the old full transcript')
    offline=true;const before=reads
    await page.reload({waitUntil:'networkidle'});await ready();await search('evictedneedle')
    assert.equal(reads,before,'offline reload reuses complete source-scoped downloads')
    assert.deepEqual(await page.evaluate(()=>[...new Set(Object.values(window._lastWordToItemsMap).flat().map(item=>item.url))].sort()),index.map(item=>item.link))
    assert.deepEqual(errors,[])
    console.log(`${mobile?'Mobile':'Desktop'}: actual eviction, complete search, context, automatic playlist, safe capture merge and offline reload passed`)
  }finally{await page.close()}
}
async function checkPicker(browser) {
  const page=await browser.newPage()
  page.setDefaultTimeout(30000)
  await page.route('**/*',route=>new URL(route.request().url()).pathname.endsWith('/srts/index.json')
    ? route.fulfill({json:Array.from({length:250},(_,i)=>({link:'picker'+i,name:'Library title '+i,source:'YouTube'}))}) : serveFixtures(route))
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.evaluate(()=>window._subtitlesReadyPromise)
    assert.ok(await page.locator('#mp3Choice option').count()<=2)
    for (const id of [249,248]) {
      await page.evaluate(()=>window.$('#mp3Choice').select2('open'))
      await page.locator('.select2-container--open .select2-search__field').fill('Library title '+id)
      await page.locator('.select2-results__option').filter({hasText:'Library title '+id}).click()
      assert.equal(await page.locator('#mp3Choice').inputValue(),'picker'+id)
      assert.ok(await page.locator('#mp3Choice option').count()<=2)
    }
    console.log('Large media picker: bounded options, full-library filtering and selected-option cleanup passed')
  } finally {await page.close()}
}
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
  try{await checkPicker(browser);await check(browser,false);await check(browser,true)}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
