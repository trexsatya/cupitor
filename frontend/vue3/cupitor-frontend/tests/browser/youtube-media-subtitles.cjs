const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {serveFixtures} = require('./language-dialogs.cjs')
async function verify(browser, width) {
  const page = await browser.newPage({viewport:{width,height:820},isMobile:width<1000,hasTouch:width<1000})
  page.setDefaultTimeout(8000)
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('dialog',d=>{errors.push(d.message());d.dismiss()})
  await page.route('**/*',serveFixtures)
  await page.addInitScript(()=>{window.dontConfirmOnRefresh=true})
  try {
    await page.goto('http://127.0.0.1:3000/language.html',{waitUntil:'networkidle'})
    await page.evaluate(async()=>{
      await Promise.all([window._vocabularyReadyPromise,window._subtitlesReadyPromise])
      const iframe=document.createElement('iframe');iframe.id='youtubePlayer';iframe.title='YouTube player'
      document.getElementById('youtubePlayer').replaceWith(iframe)
      const s=window.__yt={id:'',time:0,state:2,rate:1,loads:0}
      window.ytPlayer={getIframe:()=>iframe,getCurrentTime:()=>s.time,getPlayerState:()=>s.state,
        getVideoData:()=>({video_id:s.id}),getPlaybackRate:()=>s.rate,setPlaybackRate:r=>s.rate=r,
        getAvailablePlaybackRates:()=>[0.5,0.7,0.8,1],playVideo:()=>s.state=1,pauseVideo:()=>s.state=2,
        seekTo:t=>s.time=t,loadVideoById:id=>{s.id=id;s.time=0;s.state=1;s.loads++}}
      window.ytPlayerReady=true
      window.mediaSelected={link:'testVideo01',source:'link'}
      await window.playSelectedMedia()
    })
    const panel=page.locator('#youtubeCaptionPanel')
    await panel.locator('.cup-sub-cue').first().waitFor()
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
    const drag=await panel.locator('.cup-sub-drag').boundingBox()
    await page.mouse.move(drag.x+20,drag.y+3);await page.mouse.down();await page.mouse.move(20,230);await page.mouse.up()
    await assertFit()
    await page.setViewportSize({width:820,height:390});await assertFit()
    await page.setViewportSize({width,height:820})
    await panel.locator('[data-act=pick]').click();await panel.locator('[data-act=all]').click();await panel.locator('[data-act=send]').click()
    await page.locator('#captionCaptureDialog').waitFor()
    assert.match(await page.locator('#captionCaptureDialog').innerText(),/färgsprakande/)
    await page.locator('#captionCaptureDialog').locator('..').getByRole('button',{name:'Cancel',exact:true}).click()
    const before=await page.evaluate(()=>({...window.__yt}))
    await page.locator('#youtubeClosePlayer').click()
    assert.equal(await panel.isVisible(),false)
    await page.locator('#youtubeResumePlayer').click()
    assert.equal(await panel.isVisible(),true)
    assert.equal(await page.evaluate(()=>window.__yt.time),before.time)
    assert.equal(await page.evaluate(()=>window.__yt.loads),before.loads)
    await panel.locator('[data-act=split]').click()
    assert.equal(await page.evaluate(()=>document.body.classList.contains('youtube-media-mode')),false)
    await page.locator('#youtubeResumePlayer').click()
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
    await page.locator('#youtubeResumePlayer').click()
    await page.screenshot({path:`test-results/youtube-media/${width}.png`})
    assert.deepEqual(errors,[])
    console.log(width+'px: shared YouTube panel, seeks, capture, resize, restore and study handoff passed')
  } catch(e) { console.error(await page.evaluate(()=>({search:document.querySelector('#searchText').value,result:document.querySelector('#result').textContent.slice(0,500),body:document.body.className})),errors); throw e } finally {await page.close()}
}
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']})
  try {for(const width of [1100,390,320])await verify(browser,width)}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
