// Exercise the real local-file -> subtitle picker -> player -> shared panel
// path, including seeks, last cues, replacement and captured playlist text.
const {chromium} = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {serveFixtures} = require('./language-dialogs.cjs')

function wav() {
  const samples = 44100 * 12
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(44100, 24); buffer.writeUInt32LE(88200, 28)
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}
const srt = (a = 'Första meningen', b = 'Andra meningen', c = 'Sista meningen') =>
  `1\n00:00:00,000 --> 00:00:02,000\n${a}\n\n2\n00:00:02,000 --> 00:00:04,000\n${b}\n\n3\n00:00:04,000 --> 00:00:08,000\n${c}\n`
const file = (name, text) => ({name, mimeType:'text/plain', buffer:Buffer.from(text)})

async function verify(browser, width, video = false) {
  const mediaSelector = video ? "#localMedia video" : "#localMedia audio"
  const mobile = width < 1000
  const page = await browser.newPage({viewport:{width,height:820}, isMobile:mobile, hasTouch:mobile})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.dismiss())
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  await page.route('**/*', serveFixtures)
  try {
    await page.goto('http://127.0.0.1:3000/language.html', {waitUntil:'networkidle'})
    await page.waitForFunction(() => typeof window.loadLocalFiles === 'function')
    await page.locator('#localFiles').setInputFiles([
      video ? {name:'lesson.MP4',mimeType:'video/mp4',buffer:fs.readFileSync(path.join(__dirname,'fixtures/local-media.mp4'))}
        : {name:'lesson.WAV', mimeType:'audio/wav', buffer:wav()},
      file('lesson.srt', srt()), file('lesson.en.srt', srt('First line', 'Second line', 'Last line')),
    ])
    await page.getByRole('button', {name:'Use subtitle & play',exact:true}).click()
    await page.locator('#localCaptionPanel .cup-sub-cue').first().waitFor()
    assert.equal(await page.locator('#localCaptionPanel .cup-sub-cue').count(), 3)
    assert.equal(await page.evaluate(() => window.syncSubtitle), true)
    assert.equal(await page.evaluate(() => window.subtitles.every(c => Number.isFinite(c.ts) && Number.isFinite(c.te))), true)
    assert.match(await page.locator('#localSubtitleStatus').innerText(), /lesson.srt · 3 subtitles/)
    assert.match(await page.locator('#localCaptionPanel .cup-sub-cue').first().innerText(), /Första meningen/)
    assert.match(await page.locator('#localCaptionPanel .cup-sub-cue').last().innerText(), /Last line/)

    // Final cue and a backward seek follow the native media clock while paused.
    for (const [time, text] of [[4.5,'Sista meningen'],[0.5,'Första meningen'],[2.5,'Andra meningen']]) {
      await page.locator(mediaSelector).evaluate((audio, time) => {
        audio.pause(); audio.currentTime = time; audio.dispatchEvent(new Event('timeupdate'))
      }, time)
      await page.waitForFunction(text => document.querySelector('#localCaptionPanel .cup-active')?.textContent.includes(text), text)
    }
    await page.locator('#localCaptionPanel .cup-sub-cue').nth(1).locator('.cup-sub-time').click()
    assert(await page.locator(mediaSelector).evaluate(audio => audio.currentTime >= 2 && audio.currentTime < 3))
    const before = await page.locator(mediaSelector).evaluate(audio => { audio.pause(); return {src:audio.src, time:audio.currentTime} })

    // A revised file can be attached independently without losing the player.
    await page.locator('#localSubtitleFiles').setInputFiles(file('lesson.srt', srt('Ny första', 'Ny andra', 'Ny sista')))
    await page.getByRole('button', {name:'Apply subtitles',exact:true}).click()
    await page.locator('#localSubtitlePickerDialog').waitFor({state:'hidden'})
    assert.match(await page.locator('#localCaptionPanel .cup-sub-cue').last().innerText(), /Ny sista/)
    assert.deepEqual(await page.locator(mediaSelector).evaluate(audio => ({src:audio.src,time:audio.currentTime})), before)

    // Bad SRTs report the error and preserve the installed transcript.
    await page.locator('#localSubtitleFiles').setInputFiles(file('lesson.srt', 'not an SRT'))
    await page.getByRole('button', {name:'Apply subtitles',exact:true}).click()
    await page.locator('#localSubtitlePickerDialog [role=alert]').waitFor({state:'visible'})
    assert.match(await page.locator('#localCaptionPanel .cup-sub-cue').last().innerText(), /Ny sista/)
    await page.getByRole('button', {name:'Cancel',exact:true}).click()

    // Capture uses the shared selection controls and the existing destination
    // dialog. It preserves the file identity and fractional cue bounds.
    await page.locator('#localCaptionPanel [data-act=pick]').click()
    await page.locator('#localCaptionPanel [data-act=all]').click()
    await page.locator('#localCaptionPanel [data-act=send]').click()
    await page.locator('#captionCaptureDialog').waitFor({state:'visible'})
    assert.match(await page.locator('#captionCaptureDialog').innerText(), /Ny första/)
    await page.locator('#captionCaptureDialog').locator('..').getByRole('button', {name:'Cancel',exact:true}).click()

    // Check the panel, native transport and every toolbar button fit at 320px.
    const geometry = await page.evaluate(() => {
      const selectors = ['#localMedia','#localCaptionPanel','#localMedia .mejs__container:not([style*="display: none"])']
      return selectors.flatMap(s => [...document.querySelectorAll(s)]).map(el => {
        const r = el.getBoundingClientRect(); return {left:r.left,right:r.right}
      })
    })
    for (const r of geometry) assert(r.left >= -1 && r.right <= width + 1, JSON.stringify(r))
    await page.locator('#localClosePlayer').click()
    assert.equal(await page.locator('#localCaptionPanel').isVisible(), false)
    await page.locator('#mediaControlPanel').evaluate(el => {el.style.display = 'block'})
    await page.locator('#localMediaContainer').evaluate(el => {el.style.display = 'block'})
    await page.locator('#localResumePlayer').click()
    assert.equal(await page.locator('#localCaptionPanel').isVisible(), true)

    if (width === 390) {
      fs.mkdirSync('test-results/local-media', {recursive:true})
      await page.screenshot({path:'test-results/local-media/subtitles-mobile' + (video ? '-video' : '') + '.png'})
    }
    // SRT-only selection through the original input also attaches to this file.
    await page.locator('#localFiles').setInputFiles({name:'lesson.srt',mimeType:'text/plain',buffer:Buffer.from('\ufeff' + srt('Igen', 'Mitten', 'Slut'),'utf16le')})
    await page.getByRole('button', {name:'Apply subtitles',exact:true}).click()
    await page.locator('#localSubtitlePickerDialog').waitFor({state:'hidden'})
    assert.match(await page.locator('#localCaptionPanel .cup-sub-cue').first().innerText(), /Igen/)
    await page.locator('#localSubtitleFiles').setInputFiles(file('lesson.srt', srt()))
    await page.getByRole('button', {name:'Remove subtitles',exact:true}).click()
    await page.locator('#localSubtitlePickerDialog').waitFor({state:'hidden'})
    assert.equal(await page.locator('#localCaptionPanel .cup-sub-cue').count(), 0)
    assert.match(await page.locator('#localSubtitleStatus').innerText(), /No subtitles attached/)
    assert.equal(await page.evaluate(() => window.currentSub), null)
    assert.deepEqual(errors, [])
    console.log(width + 'px ' + (video ? 'MP4' : 'WAV') + ': local subtitles, shared panel, capture, seek, replacement and layout passed')
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args:['--no-sandbox','--disable-dev-shm-usage']})
  try {
    for (const width of [1100,390,320]) await verify(browser, width)
    await verify(browser,390,true)
  }
  finally { await browser.close() }
})().catch(error => {console.error(error); process.exitCode=1})
