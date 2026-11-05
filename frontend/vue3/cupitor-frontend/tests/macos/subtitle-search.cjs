// Runs the search engine in native WKWebView, as used by Cupitor on macOS.
// Requires macOS/Xcode and a real db/language/swedish data directory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http')
const {spawn,execFileSync}=require('node:child_process')
const {pathToFileURL}=require('node:url')
const assert=require('node:assert/strict')
const {installSlowSubtitleStorage}=require('../browser/slow-subtitle-storage.cjs')

async function scenario(){
  const ensure=(condition,message)=>{if(!condition)throw new Error(message)}
  const {createSubtitleSearchClient}=await import('/language/subtitle-search-client.js')
  const meta=await(await fetch('/metadata')).json(),modes=[]
  let probes=0
  function worker(options={},blockMain=false){
    const url=new URL('/language/subtitle-search-worker.js',location.href)
    url.searchParams.set('slowStorage',JSON.stringify(options))
    const value=new Worker(url,{type:'module'}),post=value.postMessage.bind(value)
    let blocked=false
    value.postMessage=(data,...rest)=>{
      if(data.type==='ping')probes++
      post(data,...rest)
      if(blockMain&&!blocked&&data.type==='ping'){
        blocked=true
        const until=performance.now()+500
        while(performance.now()<until){} // A busy WebView main thread with queued replies.
      }
    }
    return value
  }
  const client=createSubtitleSearchClient({scope:'wk-real-library',storage:'memory',indexingPaused:true,onMode:value=>modes.push(value),
    workerFactory:()=>worker()})
  const searches=[]
  try{
    for(let offset=0;offset<meta.total;offset+=128){
      const batch=await(await fetch('/documents?offset='+offset)).json()
      for(const doc of batch)client.update(doc.id,doc)
      await client.flush()
    }
    ensure(modes.length===1&&modes[0]==='worker','Slow WKWebView startup fell back to main-thread search')
    for(const [query,expected]of Object.entries(meta.expected)){
      const start=performance.now()
      const hits=await client.run('files',{ids:meta.ids,query,compact:true})
      ensure(JSON.stringify(hits.map(hit=>hit.url).sort())===JSON.stringify(expected),'WKWebView full-library result mismatch: '+query)
      searches.push({query,ms:Math.round(performance.now()-start),files:hits.length})
    }
  }finally{client.close()}
  const lagged=createSubtitleSearchClient({scope:'wk-main-thread-lag',timeoutMs:100,indexingPaused:true,
    workerFactory:()=>worker({readMs:800,queryTypes:['context']},true)})
  try{
    lagged.update('clip',{sv:'1\n00:00:01,000 --> 00:00:03,000\nvaken\n',en:null});await lagged.flush()
    const context=await lagged.run('context',{id:'clip',from:1,to:1})
    ensure(context.sv_subs.data[0].text.includes('vaken'),'Queued WKWebView reply was lost after main-thread load')
  }finally{lagged.close()}
  const safety=createSubtitleSearchClient({scope:'wk-stuck-worker',storage:'memory',timeoutMs:100,indexingPaused:true,workerFactory:()=>worker()})
  try{
    safety.update('clip',{sv:'1\n00:00:01,000 --> 00:00:03,000\nvaken\n',en:null});await safety.flush()
    let code
    try{await safety.run('files',{ids:['clip'],query:'fixture-blocked-loop'})}catch(error){code=error.code}
    ensure(code==='subtitle-search-timeout','An unresponsive native worker was not terminated')
    ensure((await safety.run('files',{ids:['clip'],query:'vaken',compact:true})).length===1,'WKWebView worker restart lost its corpus')
  }finally{safety.close()}
  globalThis.installSlowSubtitleStorage({readMs:200,armOnMessage:false})
  const fallback=createSubtitleSearchClient({scope:'wk-cooperative',timeoutMs:40,indexingPaused:true,
    workerFactory:()=>{throw new Error('Fixture worker unavailable')}})
  try{
    fallback.update('clip',{sv:'1\n00:00:01,000 --> 00:00:03,000\nvaken\n',en:null});await fallback.flush()
    ensure((await fallback.run('files',{ids:['clip'],query:'vaken',compact:true})).length===1,'Slow cooperative WKWebView storage failed')
  }finally{fallback.close()}
  return {engine:window.__cupitorNativeHostEngine,storage:'memory',available:meta.total,packs:meta.packs,searches,probes,mainThreadLag:true,workerRecovery:true,cooperative:true}
}

async function main(){
  assert.ok(process.env.CUPITOR_REAL_SUBTITLE_DATA,'Set CUPITOR_REAL_SUBTITLE_DATA')
  const data=path.resolve(process.env.CUPITOR_REAL_SUBTITLE_DATA),assets=path.resolve(__dirname,'../..',process.env.CUPITOR_TEST_ASSETS||'public')
  const index=JSON.parse(fs.readFileSync(path.join(data,'srts/index.json'),'utf8')),packs=new Map(),documents=[]
  for(const entry of index){
    if(!entry.bundle)continue
    if(!packs.has(entry.bundle))packs.set(entry.bundle,JSON.parse(fs.readFileSync(path.join(data,'srts',entry.bundle),'utf8')).files)
    const files=packs.get(entry.bundle),name=entry.bundleKey||entry.name,sv=files[name+'.sv.srt'],en=files[name+'.en.srt']
    if(sv!=null)documents.push({id:entry.link,sv,en,source:entry.source})
  }
  assert.ok(documents.length>=10000,'Native check requires a real library')
  const {prepareSearchDocument,matchSearchDocument}=await import(pathToFileURL(path.resolve(__dirname,'../../public/language/subtitle-search-engine.js')))
  const prepared=documents.map(prepareSearchDocument)
  const expected=Object.fromEntries(['försova','överfalla','vaken'].map(query=>[query,prepared.filter(doc=>matchSearchDocument(doc,query)).map(doc=>doc.id).sort()]))
  const meta={total:documents.length,packs:packs.size,ids:documents.map(doc=>doc.id),expected}
  const script=`globalThis.installSlowSubtitleStorage=(${installSlowSubtitleStorage.toString()});\n(${scenario.toString()})().then(result=>webkit.messageHandlers.SearchTestResult.postMessage({passed:true,...result}),error=>webkit.messageHandlers.SearchTestResult.postMessage({passed:false,message:String(error),stack:error.stack}));`
  new Function('return ('+scenario.toString()+')')
  if(process.argv.includes('--check-fixture')){console.log(JSON.stringify({available:meta.total,packs:meta.packs,expected}));return}
  const smoke=process.argv.includes('--chromium-smoke')
  if(!smoke)assert.equal(process.platform,'darwin','Native WKWebView execution requires macOS; use --check-fixture elsewhere')
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'cupitor-wk-search-'))
  const app=path.join(temporary,'SearchTest.app','Contents'),binary=path.join(app,'MacOS','SearchTest')
  fs.mkdirSync(path.dirname(binary),{recursive:true})
  fs.writeFileSync(path.join(app,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>org.cupitor.search-regression</string><key>CFBundleExecutable</key><string>SearchTest</string><key>CFBundlePackageType</key><string>APPL</string><key>NSPrincipalClass</key><string>NSApplication</string><key>LSUIElement</key><true/><key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict></dict></plist>`)
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost')
    const send=(body,type='application/json')=>{response.writeHead(200,{'Content-Type':type});response.end(body)}
    if(url.pathname==='/')return send('<!doctype html><meta charset="utf-8"><title>Cupitor native search check</title><script type="module">'+script+'</script>','text/html')
    if(url.pathname==='/metadata')return send(JSON.stringify(meta))
    if(url.pathname==='/documents'){const offset=Number(url.searchParams.get('offset'));return send(JSON.stringify(documents.slice(offset,offset+128)))}
    const file=path.resolve(assets,'.'+decodeURIComponent(url.pathname))
    if(!file.startsWith(assets+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return}
    if(url.pathname.endsWith('/subtitle-search-worker.js')){
      const options=JSON.parse(url.searchParams.get('slowStorage')||'{}')
      const blocked=`self.addEventListener('message',({data})=>{if(data.type==='files'&&data.payload?.query==='fixture-blocked-loop')while(true){}});\n`
      return send(`(${installSlowSubtitleStorage.toString()})(${JSON.stringify(options)});\n`+blocked+fs.readFileSync(file,'utf8'),'application/javascript')
    }
    send(fs.readFileSync(file),'application/javascript')
  })
  try{
    if(!smoke)execFileSync('/usr/bin/xcrun',['swiftc','-swift-version','5','-parse-as-library',path.join(__dirname,'SubtitleSearchHost.swift'),'-framework','AppKit','-framework','WebKit','-o',binary],{stdio:'inherit'})
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    if(smoke){
      const {chromium}=require('playwright')
      const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
      try{
        const page=await browser.newPage()
        await page.addInitScript(()=>{
          window.__cupitorNativeHostEngine='Chromium-smoke'
          window.webkit={messageHandlers:{SearchTestResult:{postMessage(result){window.__cupitorNativeTestResult=result}}}}
        })
        await page.goto('http://127.0.0.1:'+server.address().port)
        await page.waitForFunction(()=>window.__cupitorNativeTestResult,null,{timeout:240000})
        const result=await page.evaluate(()=>window.__cupitorNativeTestResult)
        console.log(JSON.stringify(result));assert.equal(result.passed,true,result.message)
      }finally{await browser.close()}
      return
    }
    const code=await new Promise((resolve,reject)=>{
      const child=spawn(binary,['http://127.0.0.1:'+server.address().port],{stdio:'inherit'})
      child.once('error',reject);child.once('exit',code=>resolve(code))
    })
    assert.equal(code,0,'Native WKWebView search regression failed')
  }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(temporary,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
