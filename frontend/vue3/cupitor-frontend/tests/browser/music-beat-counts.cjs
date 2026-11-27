// Actual music.html + vendored OSMD, with a small deterministic MusicXML library.
// Captures the score as displayed; no mocked renderer or screenshot styling.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..', process.env.CUPITOR_TEST_ASSETS || 'public');
const screenshots = path.resolve(process.env.SCREENSHOT_DIR || 'test-results/music-beat-counts');

function note(step, duration = 4, type = 'quarter', fingering = '') {
  return `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration><type>${type}</type>`
    + (fingering ? `<notations><technical><fingering>${fingering}</fingering></technical></notations>` : '') + '</note>';
}
const source = `<?xml version="1.0"?><score-partwise version="3.1">
  <work><work-title>Beat counts · meter study</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
  <measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key>
  <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
  ${['C', 'D', 'E', 'F'].map((s, i) => note(s, 4, 'quarter', String(i + 1))).join('')}</measure>
  <measure number="2">${note('G', 8, 'half')}${note('E', 8, 'half')}</measure>
  <measure number="3"><attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
  ${['E', 'D', 'C'].map(s => note(s)).join('')}</measure>
  <measure number="4">${['D', 'E', 'G'].map(s => note(s)).join('')}</measure>
  <measure number="5"><attributes><time><beats>6</beats><beat-type>8</beat-type></time></attributes>
  ${['C', 'D', 'E', 'F', 'G', 'A'].map(s => note(s, 2, 'eighth')).join('')}</measure>
  <measure number="6">${['G', 'F', 'E', 'D', 'C', 'D'].map(s => note(s, 2, 'eighth')).join('')}</measure>
  </part></score-partwise>`;
const detail = { format: 'musicxml', source, voices: [], meta: { id: 'meter-study', title: 'Beat counts · meter study', tempo: 90 } };
// Two bars from the published guitar score that exposed the misplaced row:
// trexsatya.github.io/db/music/western/details/samba-do-aviao-antonio-carlos-jobim-samba-do-aviao-by-antonio-carlos-jobim.mxl.json
const guitarDetail = { format: 'musicxml', voices: [],
  source: fs.readFileSync(path.join(__dirname, 'fixtures/guitar-notation-tab.musicxml'), 'utf8'),
  meta: { id: 'guitar-tab-study', title: 'Samba do Avião · notation and tablature', instrument: 'Guitar', tempo: 100 } };

async function serve(route) {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1') {
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  }
  if (url.hostname === 'code.jquery.com') return route.fulfill({
    body: fs.readFileSync(require.resolve('jquery/dist/jquery.min.js')), contentType: 'application/javascript',
  });
  if (url.pathname.endsWith('/western/index.json')) return route.fulfill({ json: [detail, guitarDetail].map(d => ({ id: d.meta.id, title: d.meta.title, tags: [] })) });
  if (url.pathname.endsWith('/details/meter-study.json')) return route.fulfill({ json: detail });
  if (url.pathname.endsWith('/details/guitar-tab-study.json')) return route.fulfill({ json: guitarDetail });
  if (route.request().resourceType() === 'script') return route.fulfill({ body: '', contentType: 'application/javascript' });
  return route.fulfill({ json: [] });
}

async function verify(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 1000 } : { width: 1400, height: 1100 },
    isMobile: mobile, hasTouch: mobile });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(20000);
  await page.route('**/*', serve);
  try {
    await page.goto('http://127.0.0.1:3000/music.html?piece=meter-study');
    await page.locator('[data-counter-key="1:1"] .beat-counter').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#osmdPreview .beat-counter').length === 26);
    await page.evaluate(() => document.fonts.ready);
    const colors = await page.locator('#osmdPreview .beat-counter').evaluateAll(nodes => [...new Set(nodes.map(n => getComputedStyle(n).backgroundColor))]);
    assert.equal(colors.length, 3, 'three visible accent levels');
    assert.equal(await page.locator('[data-counter-key="1:1"]').getAttribute('data-beat-strength'), 'downbeat');
    assert.equal(await page.locator('[data-counter-key="1:3"]').getAttribute('data-beat-strength'), 'strong');
    assert.equal(await page.locator('[data-counter-key="3:3"]').getAttribute('data-beat-strength'), 'weak');
    assert.equal(await page.locator('[data-counter-key="5:4"]').getAttribute('data-beat-strength'), 'strong');
    const downbeat = page.locator('[data-counter-key="1:1"] .beat-counter');
    const style = await downbeat.evaluate(n => ({ color: getComputedStyle(n).color, radius: getComputedStyle(n).borderRadius, height: n.getBoundingClientRect().height }));
    assert.equal(style.color, 'rgb(255, 255, 255)');
    assert.equal(style.radius, '999px');
    assert(style.height > 10, 'badges are visible after responsive zoom');
    const collisions = await page.locator('#osmdPreview [data-counter-key]').evaluateAll(nodes => {
      const rows = nodes.map(n => ({ key: n.dataset.counterKey, box: n.getBoundingClientRect() }));
      return rows.slice(1).filter((r, i) => rows[i].key.split(':')[0] === r.key.split(':')[0]
        && rows[i].box.right > r.box.left + .5).map(r => r.key);
    });
    assert.deepEqual(collisions, [], 'automatic badges must not overlap in narrow or sustained-note bars');
    assert(style.height >= 22, 'beat badges keep a readable size on mobile');
    await page.locator('#viewOptions').scrollIntoViewIfNeeded();
    await fs.promises.mkdir(screenshots, { recursive: true });
    await page.locator('#musicPreview').screenshot({ path: path.join(screenshots, mobile ? 'beat-counts-mobile.png' : 'beat-counts-desktop.png') });

    // Renaming a count changes its text, while its original metric strength remains.
    await page.locator('#beatCountEditBtn').click();
    await page.locator('[data-counter-key="1:3"] .beat-counter').click();
    await page.locator('#beatCountLabel').fill('THREE');
    await page.locator('#beatCountLabel').press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-counter-key="1:3"] .beat-counter')?.textContent === 'THREE');
    assert.equal(await page.locator('[data-counter-key="1:3"]').getAttribute('data-beat-strength'), 'strong');
    await page.locator('#beatCountSaveStatus').filter({ hasText: 'Saved locally' }).waitFor();
    await page.reload();
    await page.locator('[data-counter-key="1:3"]').filter({ hasText: 'THREE' }).waitFor();
    assert.equal(await page.locator('[data-counter-key="1:3"]').getAttribute('data-beat-strength'), 'strong');
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: styled beat counts, meter accents and saved overrides passed`);
  } finally { await page.close(); }
}

async function verifyGuitar(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 1100 } : { width: 1600, height: 1100 },
    isMobile: mobile, hasTouch: mobile });
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', serve);
  const checkPlacement = async () => {
    const positions = await page.locator('#osmdPreview [data-counter-key]').evaluateAll(nodes => nodes.map(n => {
      const measure = n.dataset.counterKey.split(':')[0];
      const tab = [...n.ownerSVGElement.querySelectorAll('.vf-measure')].find(g => g.id === measure && g.querySelector('.vf-tabnote'));
      return { key: n.dataset.counterKey, top: n.getBoundingClientRect().top, tabBottom: tab?.getBoundingClientRect().bottom };
    }));
    assert(positions.length > 0);
    positions.forEach(p => {
      assert(Number.isFinite(p.tabBottom), `TAB staff found for ${p.key}`);
      assert(p.top > p.tabBottom + 3, `${p.key} clears the bottom of the tablature (${p.top} > ${p.tabBottom})`);
    });
  };
  try {
    await page.goto('http://127.0.0.1:3000/music.html?piece=guitar-tab-study');
    await page.locator('[data-counter-key="2:2"] .beat-counter').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#osmdPreview .beat-counter').count(), 4, 'one count row per 2/2 bar');
    await checkPlacement();
    await fs.promises.mkdir(screenshots, { recursive: true });
    await page.locator('#musicPreview').screenshot({ path: path.join(screenshots, mobile ? 'guitar-beat-counts-mobile.png' : 'guitar-beat-counts-desktop.png') });
    await page.locator('#segFrom').fill('2');
    await page.locator('#segTo').fill('2');
    await page.locator('#previewSegBtn').click();
    await page.waitForFunction(() => document.querySelectorAll('#osmdPreview .beat-counter').length === 2);
    assert.equal(await page.locator('[data-counter-key="1:1"]').count(), 0, 'no counters for the undrawn bar');
    await checkPlacement();
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: guitar beat counts clear notation and TAB, including segment view`);
  } finally { await page.close(); }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try { await verify(browser, false); await verify(browser, true); await verifyGuitar(browser, false); await verifyGuitar(browser, true); }
  finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
