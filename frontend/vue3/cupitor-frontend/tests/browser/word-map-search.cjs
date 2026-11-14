const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    localStorage.setItem('cupitor:account', JSON.stringify({ login: null }))
    localStorage.setItem('cupitor:appSettings:swedish@~guest', JSON.stringify({includeWordMapsInSearch:true}))
    localStorage.setItem('cupitor:wordMaps:swedish@~guest', JSON.stringify([
      {version: 1, id: 'first', name: 'Conflict', edges: [], nodes: [{id:'a',word:'Gräl',x:180,y:120}, {id:'b',word:'Bråk',x:600,y:400}]},
      {version: 1, id: 'second', name: 'Escalation', edges: [], nodes: [{id:'c',word:'Gräl',x:2100,y:1400}, {id:'d',word:'Bråk',x:900,y:500}]},
    ]))
    localStorage.setItem('cupitor:wordMaps:spanish@~guest', JSON.stringify([
      {version:1,id:'wrong-language',name:'Gräl',nodes:[],edges:[]},
    ]))
  })
  const visibleMatch = async () => {
    const bounds = await page.locator('.wm-viewport').boundingBox()
    const node = await page.locator('.wm-search-match').first().boundingBox()
    assert.ok(node.x >= bounds.x && node.x + node.width <= bounds.x + bounds.width, 'match is horizontally visible')
    assert.ok(node.y >= bounds.y && node.y + node.height <= bounds.y + bounds.height, 'match is vertically visible')
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html?lang=swedish', {waitUntil:'networkidle'})
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.locator('#searchText').fill('gräl|bråk')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(() => document.querySelectorAll('#wordMapResults .word-map-hit').length === 2)
    await page.locator('#searchLoadingOverlay').waitFor({state:'hidden'})
    assert.equal(await page.locator('#wordMapResults .highlight').count(), 2)
    await page.locator('#wordMapSearchIncludeCb').uncheck()
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 0)
    await page.locator('#wordMapSearchIncludeCb').check()
    await page.locator('.word-map-hit[data-map-id="second"]').click()
    const dialog = page.locator('#wordMapsDialog')
    await dialog.waitFor({state:'visible'})
    assert.equal(await dialog.locator('[aria-label="Saved word map"]').inputValue(), 'second')
    assert.equal(await dialog.locator('.wm-search-match').count(), 2)
    assert.equal(await dialog.locator('[aria-label="Edit mode"]').isChecked(), false)
    await visibleMatch()
    await dialog.locator('[aria-label="Enter fullscreen"]').click()
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').getBoundingClientRect().width >= innerWidth - 2)
    const fullscreen = await dialog.boundingBox()
    assert.ok(fullscreen.width >= (mobile ? 388 : 1278), 'fullscreen fills the available viewport')
    await visibleMatch()
    await dialog.getByRole('button', {name:'Find vocabulary & clips', exact:true}).click()
    await page.locator('#wordMapsRestore').click()
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').getBoundingClientRect().width >= innerWidth - 2)
    await visibleMatch()
    if (process.env.SCREENSHOT_DIR) {
      require('node:fs').mkdirSync(process.env.SCREENSHOT_DIR, {recursive:true})
      await page.screenshot({path:require('node:path').join(process.env.SCREENSHOT_DIR, `word-map-search-${mobile ? 'mobile' : 'desktop'}.png`)})
    }
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    assert.equal(await dialog.isVisible(), true)
    await dialog.locator('[data-node="c"]').click()
    await dialog.getByRole('button', {name:'Find vocabulary & clips', exact:true}).click()
    await page.locator('#wordMapsRestore').waitFor({state:'visible'})
    await page.waitForFunction(() => window._vocabularySearchText === 'gräl' &&
      !document.querySelector('#result').textContent.includes('Loading…'))
    await page.locator('.word-map-hit[data-map-id="first"]').click()
    assert.equal(await dialog.locator('[aria-label="Saved word map"]').inputValue(), 'first')
    assert.equal(await dialog.locator('.wm-search-match').count(), 1)
    assert.equal(await dialog.locator('.wm-search-match').getAttribute('data-node'), 'a')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} word-map search, scoped results, highlights, centered match, fullscreen and minimized retargeting passed`)
  } catch (error) {
    console.error(await page.evaluate(() => ({query: window._vocabularySearchText, search:window.searchText, input:document.querySelector('#searchText').value, text:document.querySelector('#result').textContent.slice(0,300)})), errors)
    throw error
  } finally { await page.close() }
}
async function checkLibrary(browser, width) {
  const page = await browser.newPage({viewport: {width, height: 844}, isMobile: width < 700, hasTouch: width < 700})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(10000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    localStorage.setItem('cupitor:account', JSON.stringify({login: null}))
    const key = 'cupitor:wordMaps:swedish@~guest'
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([
      {version: 1, id: 'conflict', name: 'Konflikt & aggression', folder: 'Swedish/People', nodes: [
        {id:'a',word:'Gräl & käbbel',x:350,y:150,color:'#334155',shape:'hexagon'},
        {id:'b',word:'Bråka',x:750,y:150,color:'#64748b'},
        {id:'c',word:'Överfalla',x:550,y:420,color:'#334155',note:'Att plötsligt angripa någon fysiskt, ofta oväntat. Allvarligt.'},
      ], edges: [{id:'e',from:'a',to:'b'},{id:'f',from:'b',to:'c'}]},
      {version: 1, id: 'light', name: 'Ljus', folder: 'Swedish/Nature', nodes: [], edges: []},
      {version: 1, id: 'other', name: 'Unfiled map', nodes: [], edges: []},
    ]))
  })
  const screenshot = async name => {
    if (!process.env.SCREENSHOT_DIR) return
    require('node:fs').mkdirSync(process.env.SCREENSHOT_DIR, {recursive: true})
    await page.screenshot({path:require('node:path').join(process.env.SCREENSHOT_DIR, `word-maps-${name}-${width}.png`)})
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html?lang=swedish', {waitUntil:'networkidle'})
    await page.evaluate(() => window.openWordMaps())
    const dialog = page.locator('#wordMapsDialog')
    await dialog.locator('[data-node="c"]').click()
    await screenshot('read')
    assert.equal(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1), true, 'dialog must fit narrow screens')
    await dialog.getByRole('button', {name:'Browse maps', exact:true}).click()
    await dialog.locator('[data-folder="Swedish/People"]').click()
    assert.equal(await dialog.locator('.wm-library-map').count(), 1)
    await dialog.getByRole('switch', {name:'Edit mode'}).check()
    await dialog.locator('[aria-label="Map folder path"]').fill('Swedish/People/Conflict')
    await dialog.getByRole('button', {name:'Move map', exact:true}).click()
    await dialog.getByRole('button', {name:'Save map', exact:true}).click()
    await page.waitForFunction(() => document.querySelector('.wm-status').textContent === 'Saved on this device')
    assert.equal(await page.evaluate(async () => { await window.cupitorUserData.flush(); return JSON.parse(window.cupitorUserData.getItem('cupitor:wordMaps:swedish@~guest')).find(m=>m.id==='conflict').folder }), 'Swedish/People/Conflict')
    await screenshot('folders')
    await dialog.locator('[data-folder="*"]').click()
    await dialog.getByRole('searchbox', {name:'Filter maps'}).fill('Ljus')
    assert.equal(await dialog.locator('.wm-library-map').count(), 1)
    await dialog.locator('[data-map-id="light"]').click()
    assert.equal(await dialog.locator('[aria-label="Saved word map"]').inputValue(), 'light')
    // Picker groups keep every map reachable without changing its identity.
    await dialog.locator('[aria-label="Saved word map"]').selectOption('conflict')
    if (await dialog.locator('.wm-library').isVisible()) await dialog.getByRole('button',{name:'Close browser',exact:true}).click()
    await dialog.getByRole('button', {name:'+ Text', exact:true}).click()
    const editor = dialog.locator('.wm-node-editor')
    await editor.fill('Plain text')
    await editor.press('End')
    await editor.press('Enter')
    await editor.pressSequentially('Second line')
    assert.equal(await editor.inputValue(), 'Plain text\nSecond line')
    await dialog.getByRole('button', {name:'Apply text', exact:true}).click()
    const label = dialog.locator('[data-node]').filter({ hasText: 'Second line' })
    assert.deepEqual(await label.locator('text tspan').allTextContents(), ['Plain text', 'Second line'])
    assert.equal(await label.locator('rect').getAttribute('fill'), 'transparent')
    await dialog.getByRole('button', {name:'+ Text', exact:true}).click()
    await editor.fill('Cancelled text')
    await dialog.getByRole('button', {name:'Cancel text', exact:true}).click()
    assert.equal(await dialog.locator('[data-node]').count(), 4)
    const overlap = await dialog.evaluate(el => {
      const a = el.querySelector('.wm-draft-actions').getBoundingClientRect()
      const b = el.querySelector('.wm-zoom-controls').getBoundingClientRect()
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    })
    assert.equal(overlap, false, 'draft actions must leave zoom controls accessible')
    await dialog.getByRole('button', {name:'Discard changes', exact:true}).click()
    assert.equal(await dialog.locator('[data-node]').count(), 3)
    await dialog.getByRole('switch', {name:'Edit mode'}).uncheck()
    await dialog.getByRole('button', {name:'Enter fullscreen', exact:true}).click()
    await page.waitForFunction(() => document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const svg = dialog.locator('.wm-viewport > svg')
    const before = await svg.evaluate(s => parseFloat(s.style.width))
    await dialog.getByRole('button', {name:'Zoom in', exact:true}).click()
    assert.ok(await svg.evaluate(s => parseFloat(s.style.width)) > before)
    await dialog.getByRole('button', {name:'Zoom out', exact:true}).click()
    assert.ok(Math.abs(await svg.evaluate(s => parseFloat(s.style.width)) - before) < 1)
    await dialog.getByRole('button', {name:'Fit map', exact:true}).click()
    await dialog.locator('[data-node="c"]').click()
    await screenshot('fullscreen')
    await dialog.getByRole('button', {name:'Exit fullscreen', exact:true}).click()
    await page.waitForFunction(() => !document.querySelector('#wordMapsDialog').classList.contains('wm-fullscreen'))
    await page.reload({waitUntil:'networkidle'})
    await page.evaluate(() => window.openWordMaps())
    assert.equal(await page.locator('[aria-label="Saved word map"] optgroup[label="Swedish/People/Conflict"]').count(), 1)
    assert.equal(await page.locator('[data-node]').count(), 3)
    assert.deepEqual(errors, [])
    console.log(`${width}px: folder navigation, filtering, moves, reload, icons and fullscreen zoom passed`)
  } finally { await page.close() }
}

async function checkLargeLibrary(browser) {
  const page=await browser.newPage({viewport:{width:1280,height:900}})
  await page.route('**/*',serveFixtures)
  await page.addInitScript(()=>{
    window.dontConfirmOnRefresh=true
    localStorage.setItem('cupitor:account',JSON.stringify({login:null}))
    localStorage.setItem('cupitor:wordMaps:swedish@~guest',JSON.stringify(Array.from({length:550},(_,i)=>({
      version:1,id:'map'+i,name:'Large map '+i,folder:'Folder '+i,
      nodes:[{id:'a',word:'Shared',x:400,y:200},{id:'b',word:'Stable',x:800,y:400}],edges:[{id:'edge',from:'a',to:'b'}],
    }))))
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.evaluate(()=>window.openWordMaps())
    const dialog=page.locator('#wordMapsDialog')
    await dialog.getByRole('button',{name:'Browse maps',exact:true}).click()
    assert.ok(await dialog.locator('[aria-label="Saved word map"] option').count()<=101)
    assert.equal(await dialog.locator('.wm-library-map').count(),100)
    await dialog.getByRole('button',{name:'Next maps',exact:true}).click()
    assert.equal(await dialog.locator('.wm-library-map').count(),100)
    await dialog.getByRole('searchbox',{name:'Filter maps'}).fill('Large map 549')
    assert.equal(await dialog.locator('.wm-library-map').count(),1)
    await dialog.locator('[data-map-id="map549"]').click()
    if(await dialog.locator('.wm-library').isVisible())await dialog.getByRole('button',{name:'Close browser',exact:true}).click()
    await dialog.getByRole('switch',{name:'Edit mode'}).check()
    const node=dialog.locator('[data-node="a"]'),bounds=await node.boundingBox()
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down()
    await page.evaluate(()=>{
      window.__stableNode=document.querySelector('[data-node="b"]')
      window.__draggedNode=document.querySelector('[data-node="a"]')
      window.__beforeTransform=window.__draggedNode.getAttribute('transform')
    })
    await page.mouse.move(bounds.x+bounds.width/2+45,bounds.y+bounds.height/2+25,{steps:5})
    assert.equal(await page.evaluate(()=>window.__stableNode===document.querySelector('[data-node="b"]')&&window.__draggedNode===document.querySelector('[data-node="a"]')),true,'dragging preserves SVG element identity')
    assert.notEqual(await page.evaluate(()=>window.__draggedNode.getAttribute('transform')),await page.evaluate(()=>window.__beforeTransform))
    await page.mouse.up()
    await dialog.getByRole('button', {name:'Save map', exact:true}).click()
    await page.waitForFunction(() => document.querySelector('.wm-status').textContent === 'Saved on this device')
    const saved=await page.evaluate(()=>JSON.parse(window.cupitorUserData.getItem('cupitor:wordMaps:swedish@~guest')))
    assert.equal(saved.length,550);assert.notEqual(saved.find(map=>map.id==='map549').nodes[0].x,400)
    assert.equal(saved[0].nodes[0].x,400,'other map records are preserved')
    console.log('Large map library: bounded pickers and pages, complete filtering, stable SVG drag and isolated record persistence passed')
  } finally {await page.close()}
}

;(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']})
  try { await checkLargeLibrary(browser); await check(browser, false); await check(browser, true); for (const width of [1280, 390, 320]) await checkLibrary(browser, width) } finally { await browser.close() }
})().catch(error => {console.error(error);process.exitCode=1})
