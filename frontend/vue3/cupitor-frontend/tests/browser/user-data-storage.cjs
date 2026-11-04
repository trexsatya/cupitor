const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const {serveFixtures} = require('./language-dialogs.cjs')
const seed = {
  Legacy: {createdAt:1, updatedAt:1, folder:'Study/Verbs', items:{Manual:{Card:[{id:'stable-card', manual:true, source:'Original', target:'Translation', enabled:true}]}}},
}
const map = {version:1,id:'stable-map',name:'Saved map',folder:'Study/Connections',nodes:[{id:'node',word:'Gräl',x:200,y:200}],edges:[]}

// Use public application actions and the actual store, including production
// modules whose private identifiers are intentionally minified.
function installStorageFixture(pendingKey) {
  window.__storageTest={
    save(){return window.selectRecording(window._recording.currentName)},
    read(){return JSON.parse(window.cupitorUserData.getItem(pendingKey)||'{}')},
    savePending(value){window.cupitorUserData.setItem(pendingKey,JSON.stringify(value))},
    queue(file,line,newText,options){
      const value=this.read()
      if(!value[file])value[file]={}
      value[file][line]={newText,ts:Date.now(),...options}
      this.savePending(value)
      window._updateSrtEditsUi()
    },
  }
}

async function check(browser, mobile) {
  const context = await browser.newContext({viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile})
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(15000)
  await context.route('**/*',serveFixtures)
  await page.addInitScript(installStorageFixture, 'cupitor:pendingSrtEdits@~guest')
  await page.addInitScript(({seed,map}) => {
    window.dontConfirmOnRefresh = true
    if (localStorage.getItem('storage-test-seeded')) return
    localStorage.setItem('storage-test-seeded','1')
    localStorage.setItem('cupitor:account',JSON.stringify({login:null}))
    localStorage.setItem('cupitor:recordings@~guest',JSON.stringify(seed))
    localStorage.setItem('cupitor:recording:current@~guest','Legacy')
    localStorage.setItem('cupitor:wordMaps:swedish@~guest',JSON.stringify([map]))
    localStorage.setItem('cupitor:playlistFolders:swedish@~guest',JSON.stringify({'Study/Empty':{updatedAt:1,deleted:false}}))
    localStorage.setItem('cupitor:pendingSrtEdits@~guest',JSON.stringify({
      'db/language/swedish/srts/a.sv.srt':{'1':{newText:'Swedish pending',ts:1}},
      'db/language/spanish/srts/b.es.srt':{'1':{newText:'Spanish pending',ts:1}},
    }))
  }, {seed,map})
  page.on('pageerror',error=>errors.push(error.message))
  const load = async (language='swedish') => {
    await page.goto('http://127.0.0.1:3000/language.html?lang='+language,{waitUntil:'networkidle'})
    await page.waitForFunction(()=>window.__storageTest && window.cupitorUserData && window._recordings && window.selectRecording)
    await page.evaluate(async()=>{
      await Promise.all([window._subtitlesReadyPromise,window._vocabularyReadyPromise])
      await window.cupitorUserData.flush()
    })
  }
  try {
    await load()
    assert.equal(await page.evaluate(()=>window._recordings.Legacy.items.Manual.Card[0].id),'stable-card')
    assert.equal(await page.evaluate(()=>window._recordings.Legacy.folder),'Study/Verbs')
    assert.deepEqual(await page.evaluate(()=>Object.keys(window.__storageTest.read())),['db/language/swedish/srts/a.sv.srt'])
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cupitor:pendingSrtEdits@~guest'))['db/language/spanish/srts/b.es.srt']['1'].newText),'Spanish pending')
    await page.evaluate(async()=>{
      window._recordings.Legacy.items.Manual.Card[0].source='Durable edit'
      window.__storageTest.save()
      await window.cupitorUserData.flush()
    })
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cupitor:recordings@~guest')).Legacy.items.Manual.Card[0].source),'Original','legacy originals remain untouched')
    await load()
    assert.equal(await page.evaluate(()=>window._recordings.Legacy.items.Manual.Card[0].source),'Durable edit')
    await page.evaluate(()=>window.openWordMaps())
    await page.locator('#wordMapsDialog').waitFor({state:'visible'})
    assert.equal(await page.locator('[aria-label="Saved word map"]').inputValue(),'stable-map')
    await page.locator('#wordMapsDialog [aria-label="Close"]').click()

    await load('spanish')
    assert.equal(await page.evaluate(()=>!!window._recordings.Legacy),false,'old unscoped playlists cannot replay into a second language')
    assert.deepEqual(await page.evaluate(()=>Object.keys(window.__storageTest.read())),['db/language/spanish/srts/b.es.srt'])
    await load()

    // Abort an actual browser transaction, retain the latest in-memory draft,
    // and verify the persistent warning and retry recover the same edit.
    await page.evaluate(async()=>{
      const original=IDBDatabase.prototype.transaction
      let fail=true
      IDBDatabase.prototype.transaction=function(names,mode,...rest){
        const tx=original.call(this,names,mode,...rest)
        if (fail && mode==='readwrite' && Array.from(names).includes('outbox')) {fail=false;queueMicrotask(()=>tx.abort())}
        return tx
      }
      try {
        window._recordings.Legacy.items.Manual.Card[0].source='Recover after failed save'
        window.__storageTest.save()
        await window.cupitorUserData.flush().catch(()=>{})
      } finally {IDBDatabase.prototype.transaction=original}
    })
    await page.locator('#userDataError').waitFor({state:'visible'})
    assert.equal(await page.evaluate(()=>window.cupitorUserData.exportData().values['cupitor:recordings@~guest'].includes('Recover after failed save')),true)
    await page.getByRole('button',{name:'Retry save',exact:true}).click()
    await page.locator('#userDataError').waitFor({state:'detached'})
    await load()
    assert.equal(await page.evaluate(()=>window._recordings.Legacy.items.Manual.Card[0].source),'Recover after failed save')

    // A second tab started at the same revision may read, but must not replace
    // the first tab's new data. Its pending work remains exportable.
    const second = await context.newPage()
    await second.addInitScript(installStorageFixture, 'cupitor:pendingSrtEdits@~guest')
    await second.goto(page.url(),{waitUntil:'networkidle'})
    await second.waitForFunction(()=>window.__storageTest && window.cupitorUserData)
    await second.evaluate(async()=>{await window.cupitorUserData.flush()})
    await page.evaluate(async()=>{
      window._recordings.Legacy.items.Manual.Card[0].source='First tab wins'
      window.__storageTest.save();await window.cupitorUserData.flush()
    })
    await second.evaluate(async()=>{
      window._recordings.Legacy.items.Manual.Card[0].source='Second tab draft'
      window.__storageTest.save();await window.cupitorUserData.flush().catch(()=>{})
    })
    await second.locator('#userDataError').waitFor({state:'visible'})
    assert.match(await second.locator('#userDataError').innerText(),/Another Cupitor tab/)
    assert.equal(await second.evaluate(()=>JSON.parse(window.cupitorUserData.exportData().values['cupitor:recordings@~guest']).Legacy.items.Manual.Card[0].source),'Second tab draft')
    await second.close()
    await load()
    assert.equal(await page.evaluate(()=>window._recordings.Legacy.items.Manual.Card[0].source),'First tab wins')

    // A changed destination starts with its own store. Returning to the
    // original source restores its current IndexedDB snapshot.
    await page.evaluate(()=>localStorage.setItem('cupitor:account',JSON.stringify({login:null,other:{login:'other-user',repo:'different-data',branch:'main'}})))
    await load()
    assert.equal(await page.evaluate(()=>!!window._recordings.Legacy),false)
    await page.evaluate(()=>localStorage.setItem('cupitor:account',JSON.stringify({login:null})))
    await load()
    assert.equal(await page.evaluate(()=>window._recordings.Legacy.items.Manual.Card[0].source),'First tab wins')
    assert.deepEqual(errors,[])
    console.log(`${mobile?'Mobile':'Desktop'}: migration, reload, language/source isolation, map access, failed saves, recovery and tab conflicts passed`)
  } finally {await context.close()}
}

async function checkSync(browser) {
  const page=await browser.newPage()
  await page.route('**/*',serveFixtures)
  await page.addInitScript(installStorageFixture, 'cupitor:pendingSrtEdits')
  await page.addInitScript(seed=>{
    window.dontConfirmOnRefresh=true
    if(localStorage.getItem('own-seeded'))return
    localStorage.setItem('own-seeded','1')
    localStorage.setItem('cupitor:account',JSON.stringify({login:'trexsatya',repo:'trexsatya.github.io',branch:'gh-pages',other:null}))
    localStorage.setItem('cupitor:recordings',JSON.stringify(seed))
    localStorage.setItem('cupitor:recording:current','Legacy')
  },seed)
  page.on('dialog',dialog=>dialog.dismiss())
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.waitForFunction(()=>window.__storageTest&&window._recordingsRemoteMerged)
    await page.evaluate(async()=>{
      await window.cupitorUserData.flush()
      const remote=new Map()
      window.__commits=0
      window.GitHubUtils.getFile=async(owner,repo,file)=>{
        if(remote.has(file))return {content:remote.get(file)}
        throw new Error('GitHub API error 404')
      }
      window.GitHubUtils.request=async()=>{throw new Error('Fixture has no orphan parts')}
      window.GitHubUtils.commitMultipleFiles=async({files})=>{
        window.__commits++
        for(const file of files){if(file.delete)remote.delete(file.path);else remote.set(file.path,await file.getContent(remote.get(file.path)??null))}
        window.__started=true
        if(window.__hold)await new Promise(resolve=>{window.__release=resolve})
        if(window.__failAfterRemote)window.__abortNext=true
        return {committed:true}
      }
      const file='db/language/swedish/srts/a.sv.srt'
      window.__storageTest.savePending({[file]:{
        '1':{newText:'Selected',ts:1,start:'00:00:01,000',end:'00:00:02,000'},
        '2':{newText:'Unselected',ts:1,start:'00:00:02,000',end:'00:00:03,000'},
      }})
      await window.cupitorUserData.flush()
      window.__hold=true
      window.__push=window.flushPendingSrtEdits({[file]:{'1':window.__storageTest.read()[file]['1']}})
    })
    await page.waitForFunction(()=>window.__started)
    assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(window.cupitorUserData.exportData().values['cupitor:pendingSrtEdits'])['db/language/swedish/srts/a.sv.srt']).length),2,'unselected edits stay persisted during an upload')
    await page.evaluate(async()=>{
      window.__storageTest.queue('db/language/swedish/srts/a.sv.srt',1,'Changed during upload',{start:'00:00:01,000',end:'00:00:02,000'})
      await window.cupitorUserData.flush()
      window.__hold=false;window.__release();await window.__push
    })
    assert.deepEqual(await page.evaluate(()=>Object.values(window.__storageTest.read()['db/language/swedish/srts/a.sv.srt']).map(row=>row.newText)),['Changed during upload','Unselected'])
    await page.evaluate(async()=>{
      const original=IDBDatabase.prototype.transaction
      window.__restoreTransaction=()=>{IDBDatabase.prototype.transaction=original}
      IDBDatabase.prototype.transaction=function(names,mode,...rest){
        const tx=original.call(this,names,mode,...rest)
        if(window.__abortNext&&mode==='readwrite'&&Array.from(names).includes('outbox')){window.__abortNext=false;queueMicrotask(()=>tx.abort())}
        return tx
      }
      window._recordings.Legacy.items.Manual.Card[0].source='Uploaded playlist'
      window.__storageTest.save();await window.cupitorUserData.flush()
      window.__failAfterRemote=true
      await window.syncRecordingsToGithub().then(()=>{throw new Error('Expected failed local save')},()=>{})
      window.__restoreTransaction()
    })
    await page.locator('#userDataError').waitFor({state:'visible'})
    assert.equal(await page.evaluate(()=>window._recordingsDirty),true,'a failed local baseline commit cannot mark the collection synced')
    const commits=await page.evaluate(()=>window.__commits)
    await page.evaluate(async()=>{await window.syncRecordingsToGithub().catch(()=>{})})
    assert.equal(await page.evaluate(()=>window.__commits),commits,'unsaved data cannot start another remote write')
    await page.getByRole('button',{name:'Retry save',exact:true}).click()
    await page.locator('#userDataError').waitFor({state:'detached'})
    assert.equal(await page.evaluate(()=>window._recordingsDirty),false)
    console.log('Sync: unselected/concurrent subtitle edits stay durable; failed post-upload baseline commits remain incomplete and block further writes')
  } finally {await page.close()}
}

;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']})
  try {await check(browser,false);await check(browser,true);await checkSync(browser)} finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
