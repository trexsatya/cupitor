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
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)))
  p.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)) })
  await p.goto('https://trexsatya.github.io/language.html?lang=swedish', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForSelector('#searchText', { timeout: 30000 })
  try {
    await p.waitForFunction(() => !!window.vocabulary && !!window._subtitlesLoaded, null, { timeout: 120000 })
  } catch (e) {
    console.log('READY CHECK FAILED:', await p.evaluate(() => JSON.stringify({
      vocab: !!window.vocabulary, subs: !!window._subtitlesLoaded,
      srts: (window.srts || []).length, jq: typeof window.jQuery,
    })))
    throw e
  }
  await p.waitForTimeout(1200)
  const note = (k, v) => { console.log('--- ' + k + ' ---'); console.log(JSON.stringify(v)) }

  // A. the practice media slot, every cell
  note('A-practice-slot', await p.evaluate(() => {
    const mc = document.getElementById('mediaContainer')
    const pa = document.getElementById('practiceAudio')
    const before = document.body.className
    const at = (cls) => {
      document.body.className = cls
      return getComputedStyle(mc).display + ' / audio ' + (pa ? getComputedStyle(pa).display : 'n/a')
    }
    const out = {
      videoCard: at('practice-mode'),
      manual_noLink_noRec: at('practice-mode practice-no-video'),
      manual_noLink_rec: at('practice-mode practice-manual practice-no-video'),
      manual_link_rec: at('practice-mode practice-manual'),
      player_manualCard: at('rec-playing rec-playing-manual'),
    }
    document.body.className = before
    return out
  }))

  // B. the open list follows the history
  await p.evaluate(() => {
    window.sessionSearchHistory = ['hus', 'sjö', 'vatten']
    window.sessionHistoryIndex = 2
  })
  const btn = await p.$('#prevSearchBtn')
  const box = await btn.boundingBox()
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up()
  await p.waitForTimeout(300)
  note('B1-open', await p.evaluate(() => ({
    rows: [...document.querySelectorAll('.srch-hist-row')].map(r => r.textContent.trim()),
    here: (document.querySelector('.srch-hist-row.is-current') || {}).textContent,
  })))
  // Step with the button while the list is up — the marker must follow. Waited
  // out the long-press window first, or the click is the one the press suppressed.
  await p.waitForTimeout(900)
  await p.evaluate(() => { window.jQuery('#prevSearchBtn').trigger('click') })
  await p.waitForTimeout(3000)
  note('B2-after-step', await p.evaluate(() => ({
    visible: (() => { const e = document.getElementById('searchHistoryPanel'); return !!e && getComputedStyle(e).display !== 'none' })(),
    here: (document.querySelector('.srch-hist-row.is-current') || {}).textContent,
    idx: window.sessionHistoryIndex,
    box: document.getElementById('searchText').value,
  })))
  // A search recorded while the list is open shifts every entry along by one.
  note('B3-before-new-search', await p.evaluate(() =>
    [...document.querySelectorAll('.srch-hist-row')].map(r => r.getAttribute('data-idx') + ':' + r.textContent.trim())))
  await p.evaluate(() => { window.jQuery('#searchText').val('huset').trigger('input').trigger('change') })
  await p.waitForTimeout(4000)
  note('B4-after-new-search', await p.evaluate(() => ({
    visible: (() => { const e = document.getElementById('searchHistoryPanel'); return !!e && getComputedStyle(e).display !== 'none' })(),
    rows: [...document.querySelectorAll('.srch-hist-row')].map(r => r.getAttribute('data-idx') + ':' + r.textContent.trim()),
    history: window.sessionSearchHistory.slice(),
    idx: window.sessionHistoryIndex,
  })))

  // C. a long press must not leave anything eating the next click
  await p.evaluate(() => { document.getElementById('searchHistoryPanel').style.display = 'none' })
  const b2 = await p.$('#nextSearchBtn')
  const bb = await b2.boundingBox()
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await p.mouse.down(); await p.waitForTimeout(700)
  await p.mouse.move(bb.x + 300, bb.y + 220)                     // drag away, then release
  await p.mouse.up()
  await p.waitForTimeout(200)
  note('C-next-click-still-lands', await p.evaluate(() => {
    let got = 0
    const probe = document.createElement('button')
    probe.id = '__probe'
    probe.style.cssText = 'position:fixed;top:4px;left:4px;z-index:200000;width:60px;height:30px'
    probe.addEventListener('click', () => { got++ })
    document.body.appendChild(probe)
    probe.click()
    const out = { clicksSeen: got }
    probe.remove()
    return out
  }))
  await b.close()
})().catch(e => { console.error('FAILED', e); process.exit(1) })
