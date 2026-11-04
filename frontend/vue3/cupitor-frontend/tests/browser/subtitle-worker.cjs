const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const {serveFixtures}=require('./language-dialogs.cjs')
async function check(browser,fallback){
  const page=await browser.newPage()
  page.setDefaultTimeout(15000)
  await page.route('**/*',serveFixtures)
  await page.addInitScript(fallback=>{
    window.dontConfirmOnRefresh=true
    if(fallback)window.Worker=class{constructor(){throw new Error('Fixture host has no workers')}}
  },fallback)
  try{
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.waitForFunction(()=>window._vocabularyReadyPromise&&window._subtitlesReadyPromise)
    await page.evaluate(async()=>{await Promise.all([window._vocabularyReadyPromise,window._subtitlesReadyPromise])})
    await page.locator('#searchText').fill('färgsprakande')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(()=>window._subtitleSearchCompletion?.complete)
    assert.equal(await page.evaluate(()=>window._subtitleSearchMode),fallback?'cooperative':'worker')
    assert.ok(await page.evaluate(()=>Object.values(window._lastWordToItemsMap||{}).flat().length>0))
    // Raw edits invalidate normalized documents even when the object identity
    // and cue count remain unchanged.
    await page.evaluate(()=>{for(const pair of Object.values(window.allSubtitles))pair.sv=pair.sv.replaceAll('färgsprakande','heltförändrat')})
    await page.locator('#searchText').fill('heltförändrat')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(()=>window._subtitleSearchCompletion?.complete&&Object.values(window._lastWordToItemsMap||{}).flat().some(hit=>hit.line.text.includes('heltförändrat')))
    console.log((fallback?'Cooperative fallback':'Worker')+': complete search and in-place edit invalidation passed')
  }finally{await page.close()}
}
async function lifecycle(browser){
  const page=await browser.newPage()
  await page.route('**/*',serveFixtures)
  try{
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    const result=await page.evaluate(async()=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const mode=[]
      const client=createSubtitleSearchClient({scope:'worker-lifecycle-fixture',timeoutMs:250,onMode:value=>mode.push(value)})
      const raw=text=>({sv:'1\n00:00:01,000 --> 00:00:03,000\n'+text+'\n',en:null,source:'YouTube'})
      client.update('slow',raw('a'.repeat(40000)+'!'));await client.flush()
      let ticks=0;const timer=setInterval(()=>ticks++,10)
      let timeout,cancelled
      try{
        try{await client.run('files',{ids:['slow'],query:'(a+)+$',suffix:'.sv.srt'})}catch(error){timeout=error.code}
        client.update('slow',raw('needle'))
        const recovered=await client.run('files',{ids:['slow'],query:'needle',suffix:'.sv.srt'})
        client.update('slow',raw('a'.repeat(40000)+'!'));await client.flush()
        const pending=client.run('files',{ids:['slow'],query:'(a+)+$',suffix:'.sv.srt'}).catch(error=>error.code)
        await new Promise(resolve=>setTimeout(resolve,50));client.cancel();cancelled=await pending
        client.update('slow',raw('fresh after cancel'))
        const next=await client.run('files',{ids:['slow'],query:'fresh after cancel',suffix:'.sv.srt'})
        return {timeout,cancelled,ticks,recovered:recovered.length,next:next.length,mode}
      }finally{clearInterval(timer);client.close()}
    })
    assert.equal(result.timeout,'subtitle-search-timeout')
    assert.equal(result.cancelled,'subtitle-search-cancelled')
    assert.equal(result.recovered,1);assert.equal(result.next,1)
    assert.ok(result.ticks>=5,'the main thread remains responsive while the worker regex is stuck')
    assert.ok(result.mode.every(mode=>mode==='worker'))
    console.log('Worker: supervised regex timeout, cancellation, responsive UI and fresh queries after restart passed')
  }finally{await page.close()}
}
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']})
  try{await check(browser,false);await check(browser,true);await lifecycle(browser)}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
