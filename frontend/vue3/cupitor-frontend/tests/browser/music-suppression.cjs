const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { serveFixtures } = require('./language-dialogs.cjs');

const pitched = (step, octave, duration, voice = 1, chord = false) => `<note>${chord ? '<chord/>' : ''}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${duration === 4 ? 'whole' : 'quarter'}</type></note>`;
const source = `<?xml version="1.0"?><score-partwise version="3.1">
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
<measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
${pitched('C', 4, 4)}${pitched('E', 4, 4, 1, true)}${pitched('G', 4, 4, 1, true)}</measure>
<measure number="2">${pitched('D', 4, 4)}${pitched('F', 4, 4, 1, true)}${pitched('A', 4, 4, 1, true)}</measure>
<measure number="3">${pitched('C', 3, 4)}<backup><duration>4</duration></backup>
${['E', 'F', 'G', 'A'].map(s => pitched(s, 4, 1, 2)).join('')}<backup><duration>4</duration></backup>${pitched('C', 5, 4, 3)}</measure>
</part></score-partwise>`;
const detail = { format: 'musicxml', source, voices: [], meta: { id: 'suppression-study', title: 'Pitch layers and chord recalculation', key: 'C' } };

async function serve(route) {
  const url = new URL(route.request().url());
  if (url.hostname === 'code.jquery.com') return route.fulfill({ body: fs.readFileSync(require.resolve('jquery/dist/jquery.min.js')), contentType: 'application/javascript' });
  if (url.pathname.includes('/db/music/')) {
    if (url.pathname.endsWith('/index.json')) return route.fulfill({ json: [{ id: detail.meta.id, title: detail.meta.title, tags: [] }] });
    if (url.pathname.endsWith('/details/suppression-study.json')) return route.fulfill({ json: detail });
    return route.fulfill({ json: [] });
  }
  return serveFixtures(route);
}

async function verify(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 1000 } : { width: 1400, height: 1000 }, isMobile: mobile, hasTouch: mobile });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(20000);
  await page.route('**/*', serve);
  const mode = page.locator('[data-for="suppressModeChk"]');
  const role = id => page.locator(`[data-register="${id}"]`);
  const labels = page.locator('#osmdPreview .chord-area-layer foreignObject div');
  const hint = page.locator('#suppressHint');
  const count = async n => assert.equal(await hint.textContent(), n ? `${n} notes suppressed` : '');
  try {
    await page.goto('http://127.0.0.1:3000/music.html?piece=suppression-study');
    await labels.first().waitFor();
    assert((await labels.allTextContents()).includes('C'));
    assert.equal(await page.locator('#registerChips').isVisible(), false);
    await mode.click();
    for (const id of ['lowest', 'highest', 'middle']) assert.equal(await role(id).isVisible(), true);
    await role('lowest').click(); await count(3);
    assert.equal(await role('lowest').getAttribute('aria-pressed'), 'true');
    await role('lowest').click(); await count(0);
    await role('highest').click(); await count(3);
    await role('highest').click(); await count(0);
    await role('middle').click(); await count(6); // includes four notes under held bass/melody
    await role('lowest').click(); await count(9);
    await role('highest').click(); await count(12);
    assert.equal(await labels.count(), 0, 'fully suppressed score has no guessed chords');
    await page.locator('#recalculateChordsBtn').click();
    assert.equal(await labels.count(), 0, 'recalculation must not restore muted chord tones');
    await page.locator('[data-for="hearAllChk"]').click();
    await labels.first().waitFor();
    await page.locator('[data-for="hearAllChk"]').click();
    assert.equal(await labels.count(), 0, 'temporary Hear all follows audible chord tones');
    for (const id of ['lowest', 'highest', 'middle']) await role(id).click();
    await count(0); await labels.first().waitFor();

    await labels.filter({ hasText: /^C$/ }).first().click();
    assert((await labels.allTextContents()).some(s => s.includes('✓')));
    await page.locator('#recalculateChordsBtn').click();
    assert((await labels.allTextContents()).every(s => !s.includes('✓')), 'manual recalc replaces previous chord picks');
    await labels.filter({ hasText: /^C$/ }).first().click();
    await mode.click();
    assert((await labels.allTextContents()).every(s => !s.includes('✓')), 'leaving Suppress notes automatically recalculates chords');
    assert.equal(await page.locator('#registerChips').isVisible(), false);
    await mode.click(); await role('lowest').click(); await count(3); await mode.click(); await count(3);
    assert.equal(await page.locator('#registerChips').isVisible(), false);
    const folder = path.resolve('test-results/music-beat-counts'); fs.mkdirSync(folder, { recursive: true });
    await page.locator('#musicPreview').screenshot({ path: path.join(folder, `suppression-${mobile ? 'mobile' : 'desktop'}.png`) });
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: pitch-layer toggles, held notes, audible chord recalculation, Hear all and automatic recalculation passed`);
  } finally { await page.close(); }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try { await verify(browser, false); await verify(browser, true); } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
