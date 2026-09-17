const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const ROOT = __dirname
;(async () => {
  const b = await chromium.launch({ headless: true })
  const p = await b.newPage()
  await p.route('**/*', async route => {
    const url = route.request().url()
    if (/\/language\.css(\?|#|$)/.test(url)) {
      const l = path.join(ROOT, 'public', 'language.css')
      if (fs.existsSync(l)) return route.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(l, 'utf8') })
    }
    const m = url.match(/\/language\/([^?#]+\.js)(\?|#|$)/)
    if (m) {
      const l = path.join(ROOT, 'public', 'language', m[1])
      if (fs.existsSync(l)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(l, 'utf8') })
    }
    return route.continue()
  })
  await p.goto('https://trexsatya.github.io/language.html?lang=swedish', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForSelector('#searchText', { timeout: 30000 })
  await p.waitForFunction(() => !!window.vocabulary && !!window._subtitlesLoaded, null, { timeout: 120000 })
  await p.waitForTimeout(1000)
  await p.evaluate(() => {
    window.sessionSearchHistory = ['hus', 'sjö', 'vatten']
    window.sessionHistoryIndex = 2
    window.__hides = []
    const $ = window.jQuery
    const origHide = $.fn.hide
    $.fn.hide = function () {
      try {
        if (this[0] && this[0].id === 'searchHistoryPanel') {
          window.__hides.push(new Error('hide').stack.split('\n').slice(1, 6).join(' | '))
        }
      } catch (_) {}
      return origHide.apply(this, arguments)
    }
  })
  const btn = await p.$('#prevSearchBtn')
  const box = await btn.boundingBox()
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up()
  await p.waitForTimeout(1200)
  console.log('open:', await p.evaluate(() => ({
    visible: getComputedStyle(document.getElementById('searchHistoryPanel')).display !== 'none',
    hides: window.__hides.slice(),
  })))
  await p.evaluate(() => { window.jQuery('#prevSearchBtn').trigger('click') })
  await p.waitForTimeout(2500)
  console.log('after step:', JSON.stringify(await p.evaluate(() => ({
    visible: getComputedStyle(document.getElementById('searchHistoryPanel')).display !== 'none',
    idx: window.sessionHistoryIndex,
    hides: window.__hides.slice(),
  })), null, 1))
  await b.close()
})().catch(e => { console.error('FAILED', e); process.exit(1) })
