// TTS fallback for silent manual cards: Player auto-speaks, Practice speaks
// only after Play, and saved recordings/linked clips take precedence.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({
    viewport: {width: mobile ? 390 : 1250, height: 820},
    isMobile: mobile, hasTouch: mobile,
  })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(15000)
  try {
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => {
      window.dontConfirmOnRefresh = true
      window.__ttsSpoken = []
      window.__ttsCancelled = 0
      let current = null
      class Utterance { constructor(text) { this.text = text } }
      const synth = {
        speak(u) {
          current = u
          window.__ttsSpoken.push({text:u.text,lang:u.lang})
          setTimeout(() => {
            if (current === u) { current = null; u.onend?.() }
          }, 70)
        },
        cancel() { current = null; window.__ttsCancelled++ },
        pause() {}, resume() {}, getVoices() { return [] },
      }
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth})
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance})
    })
    await page.goto('http://127.0.0.1:3000/language.html', {waitUntil:'networkidle'})
    await page.evaluate(() => Promise.all([window._vocabularyReadyPromise,window._subtitlesReadyPromise]))
    const read = () => page.evaluate(() => window.__ttsSpoken.slice())
    const card = {id:'tts-silent-manual',manual:true,source:'Hej världen',target:'Hello world',_temporary:true}
    await page.evaluate(card => {
      Object.assign(window._appSettings,{
        recPlayTtsFallback:true,recPlayShuffle:false,recPlayLoop:'off',
        recPlayGapSeconds:0,recPlaySrcTgtGapSeconds:0,
      })
      window.__cardTtsSession = window.playRecording({queue:[card],shuffle:false,loop:'off',temporary:true})
    },card)
    await page.waitForFunction(() => window.__ttsSpoken.length === 2)
    assert.deepEqual((await read()).map(x=>x.text), ['Hej världen','Hello world'],
      'Player speaks Source then Target for the silent manual card')
    await page.evaluate(() => window.__cardTtsSession)
    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window.openPracticeMode({queue:[card],temporary:true})
    },card)
    const play = page.locator('#practiceMode .practice-play')
    await play.waitFor({state:'visible'})
    assert.equal((await read()).length, 0, 'Practice never auto-speaks on card open')
    if (mobile) await play.tap()
    else await play.click()
    await page.waitForFunction(() => window.__ttsSpoken.length === 1)
    assert.equal((await read())[0].text, 'Hej världen', 'Practice speaks its visible front face')
    await page.locator('#practiceMode .practice-unflip').click({force:true})
    if (mobile) await play.tap()
    else await play.click()
    await page.waitForFunction(() => window.__ttsSpoken.length >= 2)
    assert.equal((await read())[1].text, 'Hello world', 'Practice can speak the revealed face')
    await page.evaluate(() => window.closePracticeMode())
    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window._appSettings.recPlayTtsFallback = false
      window.openPracticeMode({queue:[card],temporary:true})
    },card)
    assert.equal(await play.isVisible(),false,'TTS-off hides the Speak button on silent cards')
    await page.evaluate(() => window.closePracticeMode())
    assert.deepEqual(errors, [], 'no page errors')
    console.log((mobile ? 'Mobile' : 'Desktop')+
      ': opt-in TTS played silent manual Player/Practice cards in source/target order')
  } finally { await page.close() }
}

;(async() => {
  const browser = await chromium.launch({headless:true,
    executablePath:process.env.CHROMIUM_PATH||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
    args:['--no-sandbox','--disable-dev-shm-usage'],
  })
  try { await check(browser,false); await check(browser,true) }
  finally { await browser.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
