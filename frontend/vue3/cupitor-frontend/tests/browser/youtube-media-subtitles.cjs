const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {serveFixtures} = require('./language-dialogs.cjs')
async function verify(browser, width) {
  const page = await browser.newPage({viewport:{width,height:820},isMobile:width<1000,hasTouch:width<1000})
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(30000)
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('dialog',d=>{errors.push(d.message());d.dismiss()})
  await page.route('**/*',serveFixtures)
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.installMockYoutubeApi()'
  }))
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.installMockYoutubeApi = () => {
      window.YT = { Player: function (hostId, { events }) {
        const iframe = document.createElement('iframe')
        iframe.id = hostId
        iframe.title = 'YouTube player'
        document.getElementById(hostId).replaceWith(iframe)
        const s = window.__yt = {id:'', time:0, state:2, rate:1, loads:0}
        const player = {
          getIframe: () => iframe, getCurrentTime: () => s.time, getPlayerState: () => s.state,
          getVideoData: () => ({video_id:s.id}), getPlaybackRate: () => s.rate, setPlaybackRate: rate => s.rate = rate,
          getAvailablePlaybackRates: () => [0.5, 0.7, 0.8, 1],
          playVideo: () => s.state = 1, pauseVideo: () => s.state = 2, seekTo: time => s.time = time,
          loadVideoById: id => { s.id = id; s.time = 0; s.state = 1; s.loads++ }
        }
        queueMicrotask(() => events.onReady({ target: player }))
        return player
      } }
      window.onYouTubeIframeAPIReady()
    }
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.evaluate(() => Promise.all([window._vocabularyReadyPromise,window._subtitlesReadyPromise]))
    assert.equal(await page.locator('iframe#youtubePlayer').count(), 0, 'Search does not eagerly create the player')
    await page.locator('#toggleMediaPanelBtn').click()
    await page.locator('#select2-mp3Choice-container').click()
    await page.locator('#select2-mp3Choice-results .select2-results__group').click()
    await page.getByRole('option', { name: /testVideo01/ }).click()
    await page.getByRole('button', { name: '▶ Play', exact: true }).click()
    const panel=page.locator('#youtubeCaptionPanel')
    const back = page.getByRole('button', { name: 'Back to player' })
    await panel.locator('.cup-sub-cue').first().waitFor()
    assert.equal(await page.locator('iframe#youtubePlayer').isVisible(), true)
    assert.equal(await page.locator('#mediaControlPanel').isVisible(), false)
    assert.equal(await page.locator('#subtitleColumn').isVisible(),false)
    assert.equal(await panel.locator('.cup-sub-cue').count(),5)
    assert.equal(await page.evaluate(()=>window.__yt.loads),1,'selected media waits for the iframe load')
    // Use the same actual cue transport, translation, selection and settings UI.
    await panel.locator('.cup-sub-time').nth(2).click()
    assert.equal(await page.evaluate(()=>window.__yt.time),5)
    await page.evaluate(()=>window.__yt.time=5.5)
    await page.waitForFunction(()=>document.querySelector('#youtubeCaptionPanel .cup-active')?.textContent.includes('väljarkår'))
    await panel.locator('[data-act=prev]').click()
    assert.equal(await page.evaluate(()=>window.__yt.time),5)
    await panel.locator('[data-act=prev]').click()
    assert.equal(await page.evaluate(()=>window.__yt.time),3)
    await panel.locator('[data-act=next]').click()
    assert.equal(await page.evaluate(()=>window.__yt.time),5)
    await panel.locator('[data-act=settings]').click()
    await page.locator('.cup-sub-modal').waitFor()
    await page.locator('.cup-sub-modal button').filter({hasText:/Close|Save|OK/}).last().click()
    await page.evaluate(()=>window.__yt.rate=0.7)
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,700)))
    assert.equal(await page.evaluate(()=>window.__yt.rate),0.7,'legacy timer must preserve shared replay speed')
    // Divider resize and rotation never hide iframe controls below the panel.
    const assertFit=async()=>{
      const r=await page.evaluate(()=>{
        const a=document.querySelector('#youtubePlayer').getBoundingClientRect()
        const b=document.querySelector('#youtubeCaptionPanel').getBoundingClientRect()
        return {left:a.left,right:a.right,bottom:a.bottom,top:a.top,divider:b.top,width:innerWidth}
      })
      assert(r.left>=0&&r.right<=r.width+1&&r.bottom<=r.divider+1&&r.bottom>r.top,JSON.stringify(r))
    }
    await assertFit()
    for(const y of [230,600,230]) {
      const drag=await panel.locator('.cup-sub-drag').boundingBox()
      await page.mouse.move(drag.x+20,drag.y+3);await page.mouse.down();await page.mouse.move(20,y);await page.mouse.up()
      assert.equal(await panel.locator('.cup-dragging').count(),0,'release over the iframe must end the resize')
      assert.equal(await page.evaluate(()=>document.body.classList.contains('cup-sub-dragging')),false)
      await assertFit()
    }
    await page.setViewportSize({width:820,height:390});await assertFit()
    await page.setViewportSize({width,height:820})
    await panel.locator('[data-act=pick]').click();await panel.locator('[data-act=all]').click();await panel.locator('[data-act=send]').click()
    await page.locator('#captionCaptureDialog').waitFor()
    assert.match(await page.locator('#captionCaptureDialog').innerText(),/färgsprakande/)
    // The inline study-dialog layer must outrank both the shared sidebar
    // and its modal backdrop. Disabling backdrop pointer events would allow
    // clicks through to the player, so keep the modal shield active too.
    const layers=await page.evaluate(()=>{
      const dialog=document.querySelector('#captionCaptureDialog').closest('.ui-dialog')
      const overlay=document.querySelector('.ui-widget-overlay')
      return {dialog:Number(getComputedStyle(dialog).zIndex),
        overlay:Number(getComputedStyle(overlay).zIndex),
        panel:Number(getComputedStyle(document.querySelector('#youtubeCaptionPanel')).zIndex),
        shield:getComputedStyle(overlay).pointerEvents}
    })
    assert(layers.dialog>layers.overlay&&layers.dialog>layers.panel,JSON.stringify(layers))
    assert.equal(layers.shield,'auto','modal backdrop must still intercept background clicks')
    await page.locator('#captionCaptureDialog').locator('..').getByRole('button',{name:'Cancel',exact:true}).click()
    await page.evaluate(() => { window.__yt.time = 5.5; window.__yt.state = 1 })
    await panel.locator('.cup-w[data-w="väljarkår"]').click()
    await back.waitFor()
    await page.waitForFunction(() => window._lastWordToItemsMap?.väljarkår?.length)
    assert.equal(await page.locator('#searchText').inputValue(), 'väljarkår')
    assert.equal(await page.locator('#resultContainer').isVisible(), true)
    assert.equal(await panel.isVisible(), false)
    assert.equal(await page.locator('iframe#youtubePlayer').isVisible(), false)
    assert.equal(await page.locator('#mediaControlPanel').isVisible(), false)
    assert.equal(await page.evaluate(() => window.__yt.state), 2)
    await back.click()
    assert.equal(await page.locator('iframe#youtubePlayer').isVisible(), true)
    assert.equal(await panel.isVisible(), true)
    assert.equal(await back.isVisible(), false)
    assert.deepEqual(await page.evaluate(() => [window.__yt.id, window.__yt.time, window.__yt.state, window.__yt.loads]),
      ['testVideo01', 5.5, 2, 1], 'return restores the same video and timestamp, paused')
    const before=await page.evaluate(()=>({...window.__yt}))
    await page.locator('#youtubeClosePlayer').click()
    assert.equal(await panel.isVisible(),false)
    await back.click()
    assert.equal(await panel.isVisible(),true)
    assert.equal(await page.evaluate(()=>window.__yt.time),before.time)
    assert.equal(await page.evaluate(()=>window.__yt.loads),before.loads)
    await panel.locator('[data-act=split]').click()
    assert.equal(await page.evaluate(()=>document.body.classList.contains('youtube-media-mode')),false)
    await back.click()
    await page.evaluate(()=>window.youtubePlayInterval={start:1,end:3})
    await panel.locator('.cup-sub-time').last().click()
    assert.equal(await page.evaluate(()=>window.youtubePlayInterval),null,'a cue seek releases previous excerpt bounds')
    // Opening Practice releases the main-page panel and its polling clock.
    await page.evaluate(()=>{
      window.ytPlayerReady=false
      window.mediaSelected={link:'testVideo02',source:'link'}
      window.__mainLoad=window.playSelectedMedia()
      window.openPracticeMode({queue:[{manual:true,id:'one',source:'Practice'}]})
      window.ytPlayerReady=true
    })
    const studyLoads=await page.evaluate(()=>window.__yt.loads)
    await page.evaluate(()=>window.__mainLoad)
    assert.equal(await page.evaluate(()=>window.__yt.loads),studyLoads,'a delayed main-page load cannot take over Practice')
    assert.equal(await panel.isVisible(),false)
    await page.evaluate(()=>window.closePracticeMode())
    fs.mkdirSync('test-results/youtube-media',{recursive:true})
    await back.click()
    await page.screenshot({path:`test-results/youtube-media/${width}.png`})
    assert.deepEqual(errors,[])
    console.log(width+'px: shared YouTube panel, seeks, capture, resize, restore and study handoff passed')
  } catch(e) { console.error(await page.evaluate(()=>({search:document.querySelector('#searchText').value,result:document.querySelector('#result').textContent.slice(0,500),body:document.body.className})),errors); throw e } finally {await page.close()}
}
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']})
  try {for(const width of [1100,390,320])await verify(browser,width)}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
