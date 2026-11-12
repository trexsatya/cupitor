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
    assert.deepEqual(await read(), [
      {text:'Hej världen',lang:'sv-SE'},
      {text:'Hello world',lang:'en-US'},
    ],
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
    assert.deepEqual((await read())[0], {text:'Hej världen',lang:'sv-SE'}, 'Practice speaks its visible front face')
    await page.locator('#practiceMode .practice-unflip').click({force:true})
    if (mobile) await play.tap()
    else await play.click()
    await page.waitForFunction(() => window.__ttsSpoken.length >= 2)
    assert.deepEqual((await read())[1], {text:'Hello world',lang:'en-US'}, 'Practice can speak the revealed face')
    await page.evaluate(() => window.closePracticeMode())

    const capture = {
      id:'tts-captured-target',manual:true,source:'',target:'En svensk mening.',
      captionField:'target',mediaUrl:'https://example.com/transcript',mediaKind:'link',_temporary:true,
    }
    const expected = [{text:capture.target,lang:'sv-SE'}]
    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window._practiceFrontIsSource = false
      window.openPracticeMode({queue:[card],temporary:true})
    },capture)
    if (mobile) await play.tap()
    else await play.click()
    await page.waitForFunction(() => window.__ttsSpoken.length === 1)
    assert.deepEqual(await read(), expected, 'Practice speaks a caption captured into Target in the studied language')
    await page.evaluate(() => window.closePracticeMode())
    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window.__cardTtsSession = window.playRecording({queue:[card],shuffle:false,loop:'off',temporary:true})
    },capture)
    await page.waitForFunction(() => window.__ttsSpoken.length === 1)
    assert.deepEqual(await read(), expected, 'Player speaks a caption captured into Target in the studied language')
    await page.evaluate(() => window.__cardTtsSession)

    const quizName = 'TTS quiz'
    const question = 'Vad heter du?'
    const answer = 'Jag heter Anna.'
    const quizCard = () => page.evaluate(name => window._recordings[name].items.Manual.Card[0], quizName)
    const editor = page.locator('#manualEntryEditor')
    const sourceLanguage = editor.getByLabel('Source language')
    const targetLanguage = editor.getByLabel('Target language')
    const saveEditor = async name => {
      await editor.locator('..').getByRole('button', {name, exact:true}).click()
      await editor.waitFor({state:'hidden'})
    }
    const editQuiz = () => page.evaluate(name => window._openManualEntryEditor(
      name, window._recordings[name].items.Manual.Card[0], {showPlaylistAfterSave:false}), quizName)
    await page.evaluate(name => {
      window._recordings = {[name]: {items:{}}}
      window.selectRecording(name)
      window._openManualEntryEditor(name, null, {showPlaylistAfterSave:false})
    }, quizName)
    assert.equal(await sourceLanguage.inputValue(), '')
    assert.equal(await targetLanguage.inputValue(), '')
    await editor.locator('#meeSource').fill(question)
    await editor.locator('#meeTarget').fill(answer)
    await sourceLanguage.selectOption('sv-SE')
    await targetLanguage.selectOption('sv-SE')
    await saveEditor('Add')

    const quiz = await quizCard()
    const quizSpeech = [{text:question,lang:'sv-SE'}, {text:answer,lang:'sv-SE'}]
    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window.__cardTtsSession = window.playRecording({queue:[card],shuffle:false,loop:'off',temporary:true})
    },quiz)
    await page.waitForFunction(() => window.__ttsSpoken.length === 2)
    assert.deepEqual(await read(), quizSpeech, 'Player uses the same selected language for both faces')
    await page.evaluate(() => window.__cardTtsSession)
    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window.openPracticeMode({queue:[card],temporary:true})
    },quiz)
    if (mobile) await play.tap()
    else await play.click()
    await page.waitForFunction(() => window.__ttsSpoken.length === 1)
    assert.deepEqual(await read(), [quizSpeech[1]], 'Practice uses the explicit language of the visible Target face')
    await page.evaluate(() => window.closePracticeMode())

    await editQuiz()
    assert.equal(await sourceLanguage.inputValue(), 'sv-SE')
    assert.equal(await targetLanguage.inputValue(), 'sv-SE')
    await targetLanguage.selectOption('es-ES')
    await editor.locator('#meeSwap').click()
    assert.equal(await sourceLanguage.inputValue(), 'es-ES')
    assert.equal(await targetLanguage.inputValue(), 'sv-SE')
    await saveEditor('Save')
    await page.evaluate(() => window.cupitorUserData.flush())
    await page.reload({waitUntil:'networkidle'})
    await page.evaluate(() => Promise.all([window._vocabularyReadyPromise,window._subtitlesReadyPromise]))
    await editQuiz()
    assert.equal(await sourceLanguage.inputValue(), 'es-ES', 'Swapped language survives reload')
    assert.equal(await targetLanguage.inputValue(), 'sv-SE')
    await sourceLanguage.selectOption('')
    await saveEditor('Save')
    const updated = await quizCard()
    assert.equal(updated.sourceTtsLocale, undefined, 'Automatic clears an explicit locale')
    assert.equal(updated.targetTtsLocale, 'sv-SE')

    await page.evaluate(card => {
      window.__ttsSpoken.length = 0
      window._appSettings.recPlayTtsFallback = false
      window.openPracticeMode({queue:[card],temporary:true})
    },card)
    assert.equal(await play.isVisible(),false,'TTS-off hides the Speak button on silent cards')
    await page.evaluate(() => window.closePracticeMode())
    assert.deepEqual(errors, [], 'no page errors')
    console.log((mobile ? 'Mobile' : 'Desktop')+
      ': automatic and per-face TTS languages in Player and Practice, swap, and persistence passed')
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
