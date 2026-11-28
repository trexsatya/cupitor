const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { serveFixtures } = require('./language-dialogs.cjs');

const xmlNote = (name, octave, { chord = false, duration = 4, voice = 1, type = 'whole' } = {}) => `<note>${chord ? '<chord/>' : ''}<pitch><step>${name[0]}</step>${name[1] ? `<alter>${name[1] === '#' ? 1 : -1}</alter>` : ''}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${type}</type></note>`;
const pitch = (name, octave, chord = false) => xmlNote(name, octave, { chord });
const source = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
<measure number="1"><attributes><divisions>1</divisions><key><fifths>2</fifths><mode>minor</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${pitch('F#', 2)}${pitch('A', 3, true)}${pitch('E', 4, true)}</measure>
<measure number="2">${pitch('F', 2)}${pitch('B', 3, true)}${pitch('E', 4, true)}</measure>
<measure number="3">${pitch('C', 3)}${pitch('C#', 4, true)}${pitch('F#', 4, true)}</measure>
<measure number="4"><attributes><divisions>2</divisions></attributes>${xmlNote('F', 2, { duration: 8 })}<backup><duration>8</duration></backup>
<note><rest/><duration>1</duration><voice>2</voice><type>eighth</type></note>
${[['D', 3], ['Ab', 3], ['B', 3], ['E', 4], ['D', 4], ['B', 3], ['D', 4]].map(([name, octave]) => xmlNote(name, octave, { duration: 1, voice: 2, type: 'eighth' })).join('')}
<backup><duration>8</duration></backup>${xmlNote('E', 4, { duration: 4, voice: 3, type: 'half' })}<note><rest/><duration>4</duration><voice>3</voice><type>half</type></note></measure>
</part></score-partwise>`;
const study = { format: 'musicxml', source, voices: [], meta: { id: 'chord-what-if-study', title: 'Key-note and chromatic replacements', key: 'Bm' } };

function serve(detail) {
  return async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'code.jquery.com') return route.fulfill({ body: fs.readFileSync(require.resolve('jquery/dist/jquery.min.js')), contentType: 'application/javascript' });
    if (url.pathname.includes('/db/music/')) {
      if (url.pathname.endsWith('/index.json')) return route.fulfill({ json: [{ id: detail.meta.id, title: detail.meta.title, tags: [] }] });
      if (url.pathname.includes('/details/')) return route.fulfill({ json: detail });
      return route.fulfill({ json: [] });
    }
    return serveFixtures(route);
  };
}

async function verify(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 1000 } : { width: 1400, height: 1000 }, isMobile: mobile, hasTouch: mobile });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', serve(study));
  try {
    await page.goto('http://127.0.0.1:3000/music.html?piece=' + study.meta.id);
    const button = page.locator('#whatIfChordsBtn'); await button.waitFor({ state: 'visible' });
    const original = await page.locator('#osmdPreview').innerHTML();
    await button.click();
    await page.locator('#chordWhatIfKey').selectOption('11:minor');
    const results = page.locator('#chordWhatIfResults');
    assert((await results.textContent()).includes('A3 → B3'));
    assert((await results.textContent()).includes('E4 → D4'));
    assert((await results.textContent()).includes('F2 → F#2 (outside key)'));
    assert((await results.textContent()).includes('Bsus4'));
    assert.equal(await page.locator('#osmdPreview').innerHTML(), original, 'hypotheses must not change the score or its chord picks');
    assert.equal(await button.getAttribute('aria-expanded'), 'true');
    const preview = results.locator('tbody tr').filter({ hasText: 'E4 → D4' }).first().getByRole('button', { name: 'Show on score' });
    await preview.click();
    const overlay = page.locator('#osmdPreview .chord-what-if-layer');
    assert.equal(await overlay.count(), 1);
    assert((await overlay.textContent()).includes('What if: D?'));
    assert.equal(await overlay.locator('.chord-what-if-note').getAttribute('data-midi'), '64');
    assert.equal(await overlay.locator('.chord-what-if-evidence.retained').count(), 2);
    assert.deepEqual(await overlay.locator('.chord-what-if-evidence').evaluateAll(nodes => nodes.map(n => [n.dataset.noteId, n.dataset.midi])), [['n1', '42'], ['n2', '57'], ['n3', '64']]);
    assert.deepEqual(await page.locator('#chordWhatIfScoreNotes .chord-what-if-evidence-chip').allTextContents(), ['n1 · F#2', 'n2 · A3', 'n3 · E4 → D4']);
    assert((await overlay.textContent()).includes('D + F# + A'));
    assert.equal(await preview.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#chordWhatIfScore').isVisible(), true);
    await page.locator('#chordWhatIfScoreClear').click();
    assert.equal(await overlay.count(), 0);
    assert.equal(await page.locator('#osmdPreview').innerHTML(), original, 'clearing a preview restores the exact score DOM');
    await preview.click();
    await page.locator('#chordWhatIfChanges').selectOption('2');
    assert.equal(await overlay.count(), 0, 'changing the analysis removes an old score annotation');
    assert((await results.textContent()).includes('; '), 'two-pitch combinations appear only when requested');
    await page.locator('#chordWhatIfMinor').selectOption('harmonic');
    assert((await page.locator('#chordWhatIfSummary').textContent()).includes('B minor (harmonic)'));
    await page.locator('#chordWhatIfKey').selectOption('0:major');
    assert.equal(await page.locator('#chordWhatIfMinor').isVisible(), false);
    assert((await page.locator('#chordWhatIfSummary').textContent()).includes('C major'));
    const originals = page.locator('#chordOriginalReadings tr[data-measure="4"]');
    await originals.filter({ hasText: 'Fdim7 + E' }).getByRole('button', { name: 'Show on score' }).click();
    assert((await page.locator('#chordWhatIfScoreText').textContent()).includes('Original harmony · m4'));
    assert.equal(await overlay.locator('.chord-what-if-evidence.additional').count(), 2);
    assert.equal(await overlay.locator('.chord-what-if-evidence.replaced').count(), 0);
    await originals.filter({ hasText: 'E7b9/F' }).getByRole('button', { name: 'Show on score' }).click();
    assert.equal(await overlay.locator('.chord-what-if-evidence.additional').count(), 0);
    assert((await overlay.textContent()).includes('Original: E7b9/F'));
    await page.locator('#chordWhatIfScoreClear').click();
    assert.equal(await page.locator('#osmdPreview').innerHTML(), original);
    await page.locator('#chordWhatIfUnidentified').uncheck();
    await page.locator('#chordWhatIfClose').click();
    assert.equal(await page.locator('#chordWhatIfPanel').isVisible(), false);
    await button.click();
    await page.locator('[data-for="suppressModeChk"]').click();
    assert.equal(await page.locator('#chordWhatIfPanel').isVisible(), false, 'changing the audible notes invalidates the report');
    await page.locator('[data-register="highest"]').click();
    await page.locator('[data-register="lowest"]').click();
    await page.locator('[data-register="middle"]').click();
    await button.click();
    assert((await page.locator('#chordWhatIfSummary').textContent()).includes('0 of 0'));
    assert((await results.textContent()).includes('No complete chord'));
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: in-key/chromatic moves, two pitches, key/scale changes, suppression, empty state and unchanged score passed`);
  } finally { await page.close(); }
}

// Optional real-library check. The ordinary test is deterministic/offline; this
// accepts downloaded detail files to exercise full scores without committing them.
async function verifyReal(browser, file) {
  const detail = JSON.parse(fs.readFileSync(file));
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(45000);
  await page.route('**/*', serve(detail));
  try {
    await page.goto('http://127.0.0.1:3000/music.html?piece=' + encodeURIComponent(detail.meta.id));
    await page.locator('#whatIfChordsBtn').waitFor({ state: 'visible' });
    await page.locator('#whatIfChordsBtn').click();
    assert((await page.locator('#chordWhatIfResults').textContent()).includes('→'));
    const screenshots = path.resolve('test-results/music-chord-what-if'); fs.mkdirSync(screenshots, { recursive: true });
    await page.locator('#chordWhatIfPanel').screenshot({ path: path.join(screenshots, detail.meta.id.slice(0, 70) + '.png') });
    if (detail.meta.id.startsWith('samba-do-aviao')) {
      const row = page.locator('.chord-what-if-card').first().locator('tbody tr').filter({ hasText: 'E4 → D4' });
      await row.getByRole('button', { name: 'Show on score' }).click();
      const mark = page.locator('#osmdPreview .chord-what-if-note');
      assert.equal(await mark.getAttribute('data-midi'), '64');
      assert.equal(await mark.getAttribute('data-onset'), '0', 'the reconsidered E4 is held from the earlier attack');
      assert.deepEqual(await page.locator('#osmdPreview .chord-what-if-evidence').evaluateAll(nodes => nodes.map(n => [n.dataset.noteId, n.dataset.midi, n.dataset.onset])), [['n1', '42', '0'], ['n2', '57', '1'], ['n3', '64', '0']]);
      const score = page.locator('#osmdPreview');
      await page.locator('#chordWhatIfScore').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      const rect = await score.boundingBox();
      const banner = await page.locator('#chordWhatIfScore').boundingBox();
      const clip = { x: rect.x, y: Math.max(0, banner.y), width: rect.width, height: Math.min(rect.height, 350) + rect.y - Math.max(0, banner.y) };
      await page.screenshot({ path: path.join(screenshots, 'samba-what-if-on-score.png'), clip, animations: 'disabled' });
      const originalRows = page.locator('#chordOriginalReadings tr[data-measure="2"]');
      assert((await originalRows.allTextContents()).some(t => t.includes('Fdim7 + E')));
      assert((await originalRows.allTextContents()).some(t => t.includes('E7b9/F')));
      const scoreLabels = await page.locator('#osmdPreview .chord-area-layer foreignObject').allTextContents();
      assert(scoreLabels.includes('Fdim7 + E · arp.'));
      assert(scoreLabels.includes('E7b9/F · arp.'));
      await originalRows.filter({ hasText: 'Fdim7 + E' }).getByRole('button', { name: 'Show on score' }).click();
      assert((await page.locator('#chordWhatIfScoreText').textContent()).includes('Original harmony · m2'));
      assert.equal(await page.locator('#osmdPreview .chord-what-if-evidence.additional').count(), 2);
      assert.equal(await page.locator('#osmdPreview .chord-what-if-evidence.replaced').count(), 0);
      await page.locator('#chordWhatIfScore').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      const originalBox = await score.boundingBox(), originalBanner = await page.locator('#chordWhatIfScore').boundingBox();
      await page.screenshot({ path: path.join(screenshots, 'samba-m2-original-harmony.png'), clip: {
        x: originalBox.x, y: Math.max(0, originalBanner.y), width: originalBox.width,
        height: Math.min(originalBox.height, 350) + originalBox.y - Math.max(0, originalBanner.y),
      }, animations: 'disabled' });
      await originalRows.filter({ hasText: 'E7b9/F' }).getByRole('button', { name: 'Show on score' }).click();
      assert.equal(await page.locator('#osmdPreview .chord-what-if-evidence.additional').count(), 0);
      assert((await page.locator('#chordWhatIfScoreText').textContent()).includes('E7b9/F'));
    }
    const report = await page.evaluate(async detail => {
      const { createMusicRenderer } = await import('./music-render.js');
      const host = document.createElement('div'); host.style.width = '1400px'; document.body.appendChild(host);
      const renderer = createMusicRenderer(host, { beatCounters: false });
      try { await renderer.loadDetail(detail); return renderer.getWhatIfChords(); }
      finally { renderer.osmd.clear(); host.remove(); }
    }, detail);
    const unknown = report.contexts.filter(c => !c.originalChords.length);
    const found = unknown.filter(c => c.suggestions.length);
    assert(found.length > 0);
    assert.deepEqual(errors, []);
    console.log(`${detail.meta.id}: ${found.length}/${unknown.length} unidentified groups have one-pitch alternatives in ${report.scale.label}`);
    return { id: detail.meta.id, key: detail.meta.key, ...report };
  } finally { await page.close(); }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    await verify(browser, false); await verify(browser, true);
    if (process.env.CUPITOR_REAL_PIECES) {
      const reports = [];
      for (const file of JSON.parse(process.env.CUPITOR_REAL_PIECES)) reports.push(await verifyReal(browser, file));
      fs.writeFileSync(path.resolve('test-results/music-chord-what-if-real.json'), JSON.stringify(reports, null, 2));
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
