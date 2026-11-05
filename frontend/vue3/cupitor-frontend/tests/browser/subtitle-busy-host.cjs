const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {serveFixtures}=require('./language-dialogs.cjs')
const {installSlowSubtitleStorage}=require('./slow-subtitle-storage.cjs')

async function main(){
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await browser.newPage();page.setDefaultTimeout(30000)
  const root=path.resolve(__dirname,'../..',process.env.CUPITOR_TEST_ASSETS||'public')
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  await page.route('**/*',route=>{
    const url=new URL(route.request().url())
    if(url.pathname.endsWith('/subtitle-search-worker.js')&&url.searchParams.has('slowStorage')){
      const options=JSON.parse(url.searchParams.get('slowStorage'))
      return route.fulfill({contentType:'application/javascript',body:`(${installSlowSubtitleStorage.toString()})(${JSON.stringify(options)});\n`+fs.readFileSync(path.join(root,'language/subtitle-search-worker.js'),'utf8')})
    }
    return serveFixtures(route)
  })
  try{
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'domcontentloaded'})
    await page.waitForFunction(()=>window.__cupitorSearchReady&&window._subtitlesLoaded)
    const result=await page.evaluate(async()=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const modes=[],probes=[],srt='1\n00:00:01,000 --> 00:00:03,000\nvaken\n'
      const client=createSubtitleSearchClient({scope:'busy-worker-storage',timeoutMs:250,indexingPaused:true,onMode:mode=>modes.push(mode),workerFactory:()=>{
        const url=new URL('/language/subtitle-search-worker.js',location.href)
        url.searchParams.set('slowStorage',JSON.stringify({startupMs:3000,readMs:800,queryTypes:['context']}))
        const worker=new Worker(url,{type:'module'}),post=worker.postMessage.bind(worker)
        worker.postMessage=(data,...rest)=>{if(data.type==='ping')probes.push(data.id);return post(data,...rest)}
        return worker
      }})
      try{
        client.update('clip',{sv:srt,en:null})
        const start=performance.now();await client.flush()
        const startupMs=performance.now()-start,reading=performance.now()
        const context=await client.run('context',{id:'clip',from:1,to:1})
        const contextMs=performance.now()-reading
        const hits=await client.run('files',{ids:['clip'],query:'vaken',compact:true})
        return {modes,probes:probes.length,startupMs,contextMs,text:context.sv_subs.data[0].text,hits:hits.map(hit=>hit.url)}
      }finally{client.close()}
    })
    assert.deepEqual(result.modes,['worker'],'busy startup must not force main-thread searching')
    assert.ok(result.startupMs>=3000);assert.ok(result.contextMs>=800);assert.ok(result.probes>=2)
    assert.match(result.text,/vaken/);assert.deepEqual(result.hits,['clip'])
    await page.evaluate(installSlowSubtitleStorage,{readMs:200,armOnMessage:false})
    const fallback=await page.evaluate(async()=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js'),modes=[]
      const client=createSubtitleSearchClient({scope:'busy-cooperative-storage',timeoutMs:40,indexingPaused:true,
        workerFactory:()=>{throw new Error('Fixture host has no workers')},onMode:mode=>modes.push(mode)})
      try{
        client.update('clip',{sv:'1\n00:00:01,000 --> 00:00:03,000\nvaken\n',en:null});await client.flush()
        const hits=await client.run('files',{ids:['clip'],query:'vaken',compact:true})
        return {modes,hits:hits.map(hit=>hit.url)}
      }finally{client.close()}
    })
    assert.deepEqual(fallback,{modes:['cooperative'],hits:['clip']})
    const cancelled=await page.evaluate(async()=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const client=createSubtitleSearchClient({scope:'cancel-slow-context',timeoutMs:100,indexingPaused:true,workerFactory:()=>{
        const url=new URL('/language/subtitle-search-worker.js',location.href)
        url.searchParams.set('slowStorage',JSON.stringify({readMs:800,queryTypes:['context']}))
        return new Worker(url,{type:'module'})
      }})
      try{
        client.update('clip',{sv:'1\n00:00:01,000 --> 00:00:03,000\nvaken\n',en:null});await client.flush()
        const reading=client.run('context',{id:'clip',from:1,to:1}).then(()=> 'completed',error=>error.code)
        await new Promise(resolve=>setTimeout(resolve,100));client.cancel()
        const code=await reading,hits=await client.run('files',{ids:['clip'],query:'vaken',compact:true})
        return {code,hits:hits.map(hit=>hit.url)}
      }finally{client.close()}
    })
    assert.deepEqual(cancelled,{code:'subtitle-search-cancelled',hits:['clip']})
    await page.evaluate(installSlowSubtitleStorage,{readMs:200,armOnMessage:false})
    const cancelledFallback=await page.evaluate(async()=>{
      const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
      const client=createSubtitleSearchClient({scope:'cancel-cooperative-context',timeoutMs:40,indexingPaused:true,
        workerFactory:()=>{throw new Error('Fixture host has no workers')}})
      try{
        client.update('clip',{sv:'1\n00:00:01,000 --> 00:00:03,000\nvaken\n',en:null});await client.flush()
        const reading=client.run('context',{id:'clip',from:1,to:1}).then(()=> 'completed',error=>error.code)
        await new Promise(resolve=>setTimeout(resolve,25));client.cancel()
        return await reading
      }finally{client.close()}
    })
    assert.equal(cancelledFallback,'subtitle-search-cancelled')
    assert.deepEqual(errors,[])
    console.log('Busy host: slow startup/context, liveness probes, delayed cooperative IDB reads, Cancel and worker recovery passed')
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
