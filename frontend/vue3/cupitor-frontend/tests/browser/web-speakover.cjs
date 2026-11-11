// Real Chromium smoke test: Speak Over is usable in a normal HTTPS/localhost
// browser without the native AudioBridge. Stub the browser mic (not the
// application logic) to exercise recording, IndexedDB and playback controls.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

function wav() {
  const samples = 22050
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(22050, 24)
  buffer.writeUInt32LE(44100, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}

async function verify(browser, mobile) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 820 } : { width: 1100, height: 900 },
    isMobile: mobile, hasTouch: mobile,
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    delete window.AudioBridge
    let starts = 0
    let stops = 0
    let releases = 0
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => {
        window.__webMicStarts = ++starts
        return { getTracks: () => [{ stop() { window.__webMicReleases = ++releases } }] }
      } },
    })
    class FakeMediaRecorder {
      constructor(stream) {
        this.stream = stream
        this.mimeType = 'audio/webm'
        this.state = 'inactive'
        this.listeners = {}
      }
      static isTypeSupported(type) { return type === 'audio/webm' }
      addEventListener(type, callback) {
        (this.listeners[type] ||= []).push(callback)
      }
      dispatch(type, data) {
        for (const callback of this.listeners[type] || []) callback({ data })
      }
      start() { this.state = 'recording' }
      stop() {
        this.state = 'inactive'
        window.__webMicStops = ++stops
        this.dispatch('dataavailable', new Blob(['Recorded browser microphone audio'], { type:'audio/webm' }))
        this.dispatch('stop')
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder })
  })
  await page.route('**/*', serveFixtures)
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => typeof window.loadLocalFiles === 'function')
    assert.equal(await page.evaluate(() => !!window.AudioBridge), false)
    await page.locator('#localFiles').setInputFiles({
      name:'browser-lesson.wav', mimeType:'audio/wav', buffer:wav(),
    })
    await page.locator('#localSubtitlePickerDialog').waitFor()
    await page.locator('#localSubtitlePickerDialog button')
      .filter({hasText:'Play without subtitles'}).click()
    const bar = page.locator('#localSpeakOverBar')
    await bar.waitFor({state:'visible'})
    await bar.locator('.local-sprec-rec').click()
    await page.waitForFunction(() =>
      document.querySelector('#localSpeakOverBar .local-sprec-rec')?.getAttribute('aria-label') === 'Stop recording')
    assert.equal(await page.locator('#localAudio').evaluate(el => el.paused), true)
    assert.equal(await page.evaluate(() => window.__webMicStarts), 1)
    await bar.locator('.local-sprec-rec').click()
    await page.waitForFunction(() => document.querySelector('#localSpeakOverBar .local-sprec-play-take'))
    assert.equal(await page.evaluate(() => window.__webMicStops), 1)
    assert.equal(await page.evaluate(() => window.__webMicReleases), 1)
    await bar.locator('.local-sprec-keep').click()
    assert.match(await bar.innerText(), /kept for this local file/i)
    const stored = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('cupitor-speakover-audio-v1')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const tx = request.result.transaction('takes', 'readonly')
        const list = tx.objectStore('takes').getAllKeys()
        list.onsuccess = () => resolve(list.result)
        list.onerror = () => reject(list.error)
      }
    }))
    assert.equal(stored.length, 1, 'actual browser audio blob is stored in IndexedDB')
    assert.deepEqual(errors, [])
    console.log((mobile ? 'Mobile' : 'Desktop') +
      ': browser-only Speak Over recorded, stopped mic, kept take in IndexedDB')
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({
    headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args:['--no-sandbox','--disable-dev-shm-usage'],
  })
  try { await verify(browser, false); await verify(browser, true) }
  finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
