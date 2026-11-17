const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {test, before, after} = require('node:test');
const {chromium} = require('playwright');

const script = readFileSync(path.join(__dirname, 'filmot-capture.js'), 'utf8');
const saveScript = readFileSync(path.join(__dirname, 'filmot-save-video.js'), 'utf8');
const annotator = readFileSync(path.join(__dirname, 'filmot-annotator.js'), 'utf8');
const video = `
  <div id="divVideoDetails">
    <div class="col-6">Video title</div>
    <a href="/channel/example">Example channel</a>
  </div>
  <iframe id="player" src="https://www.youtube.com/embed/example123"></iframe>`;
const captions = `
  <div id="subtitlesIn">
    <div id="s11"><a href="javascript:jtt(11,1.5)">▶</a> glad över att det hade ansetts</div>
    <section><div id="s12"><a href="#" onclick="jtt(12, '4.25')">▶</a> att lida smälek</div></section>
    <div id="s13"><a href="#" onclick="jtt(13, 7)">mina vänner</a></div>
  </div>`;
const mobileCaptions = `
  <div class="scroll-subtitles">
    <div id="s21"><div><a href="javascript:jtt('s21', 42.5);">▶&nbsp;</a></div>
      <span>jag tycker att beskäftig är ett bra ord</span>
    </div>
    <div id="s22"><button data-start="00:45.250">Play</button>för det behövs</div>
    <div id="s23" data-start-ms="47900">jobbade på universitetet förut</div>
  </div>`;
const withoutPanel = `
  <div id="s31"><a href="javascript:jtt(31, 62);">▶</a> utan panel</div>
  <a href="javascript:jtt(32, 63);">unrelated play button</a>`;

let browser, page;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CUPITOR_CHROME_PATH || process.env.CHROME_BIN || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  page = await browser.newPage();
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    let body = '';
    if (url.hostname === 'filmot.org') {
      body = video.replace('example123', '8E_PWhMzHuY') + captions.replace('att lida smälek', 'honom på villospår.');
    } else if (url.hostname === 'filmot.com') {
      if (url.pathname.endsWith('/frame')) body = video + '<iframe src="/captions"></iframe>';
      else if (url.pathname === '/captions') body = captions;
      else if (url.pathname.endsWith('/mobile')) body = mobileCaptions;
      else if (url.pathname.endsWith('/unnamed-panel')) body = withoutPanel;
      else if (url.pathname.endsWith('/external')) body = '<iframe src="https://other.example/detail"></iframe>';
      else if (!url.pathname.endsWith('/empty')) body = video + captions;
    } else if (['other.example', 'filmot.org.example.com'].includes(url.hostname)) {
      body = video + captions;
    }
    return route.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html>' + body});
  });
});
after(async () => { await browser?.close(); });

async function capture(url) {
  await page.goto(url);
  const result = await page.evaluate(script);
  return result === null ? null : JSON.parse(result);
}

test('captures timed legacy, nested, and linked subtitle rows', async () => {
  const result = await capture('https://filmot.com/search/%22sm%C3%A4lek%22/1');
  assert.equal(result.query, 'smälek');
  assert.equal(result.videoId, 'example123');
  assert.equal(result.videoTitle, 'Video title');
  assert.equal(result.videoChannel, 'Example channel');
  assert.equal(result.matchIdx, 1);
  assert.deepEqual(result.lines, [
    {i: 11, ts: 1.5, t: 'glad över att det hade ansetts'},
    {i: 12, ts: 4.25, t: 'att lida smälek'},
    {i: 13, ts: 7, t: 'mina vänner'},
  ]);
});

test('reads a same-origin detail frame while retaining the parent search query', async () => {
  const result = await capture('https://filmot.com/search/%22sm%C3%A4lek%22/1/frame');
  assert.equal(result.query, 'smälek');
  assert.equal(result.videoId, 'example123');
  assert.equal(result.videoTitle, 'Video title');
  assert.equal(result.videoChannel, 'Example channel');
  assert.equal(result.lines.length, 3);
  assert.equal(result.matchIdx, 1);
});

test('unrelated frames and pages and unloaded captions produce no capture', async () => {
  assert.equal(await capture('https://other.example/detail'), null);
  assert.deepEqual((await capture('https://filmot.com/search/word/1/external')).lines, []);
  assert.deepEqual((await capture('https://filmot.com/search/word/1/empty')).lines, []);
});

test('captures, saves, and annotates a result on filmot.org', async () => {
  const result = await capture('https://filmot.org/search/%22villosp%C3%A5r%22/8E_PWhMzHuY/1?lang=sv');
  assert.equal(result.query, 'villospår');
  assert.equal(result.videoId, '8E_PWhMzHuY');
  assert.equal(result.lines[result.matchIdx].t, 'honom på villospår.');
  assert.equal(result.lines[result.matchIdx].ts, 4.25);
  assert.equal(JSON.parse(await page.evaluate(saveScript)).url, result.videoUrl);
  await page.evaluate(annotator);
  assert.equal(await page.evaluate(() => typeof window.__cupitorFilmotApply), 'function');

  assert.equal(await capture('https://filmot.org.example.com/'), null);
  assert.deepEqual(JSON.parse(await page.evaluate(saveScript)), {});
  await page.evaluate(annotator);
  assert.equal(await page.evaluate(() => typeof window.__cupitorFilmotApply), 'undefined');
});

test('reads a mobile transcript and identifies its video from the current result URL', async () => {
  const result = await capture('https://filmot.com/search/%22besk%C3%A4ftig%22/example1234/1/mobile');
  assert.equal(result.query, 'beskäftig');
  assert.equal(result.videoId, 'example1234');
  assert.deepEqual(result.lines, [
    {i: 21, ts: 42.5, t: 'jag tycker att beskäftig är ett bra ord'},
    {i: 22, ts: 45.25, t: 'för det behövs'},
    {i: 23, ts: 47.9, t: 'jobbade på universitetet förut'},
  ]);
});

test('reads numbered legacy rows while the Filmot panel is missing', async () => {
  const result = await capture('https://filmot.com/search/panel/1/unnamed-panel');
  assert.deepEqual(result.lines, [{i: 31, ts: 62, t: 'utan panel'}]);
  assert.equal(result.diagnostics.panels, 0);
  assert.equal(result.diagnostics.controls, 2);
});

test('delivers a large transcript through small, request-scoped WebView replies', async () => {
  await page.goto('https://filmot.com/search/%22sm%C3%A4lek%22/1/empty');
  await page.evaluate(() => {
    const cues = Array.from({length: 200}, (_, i) =>
      `<div id="s${i}" data-start="${i}">smälek på svenska 💬 ${i}</div>`
    ).join('');
    document.body.innerHTML = `<div id="subtitlesIn">${cues}</div>`;
  });
  const snapshot = await page.evaluate(`(function(cupitorFilmotCaptureId) {
    return ${script}
  })(41);`);
  const summary = JSON.parse(snapshot);
  assert.equal(summary.cues, 200);
  assert.ok(summary.length > 8192);
  assert.equal(await page.evaluate(() => window.__cupitorReadFilmotCapture(40, 0)), null);

  let transcript = '';
  while (transcript.length < summary.length) {
    const reply = await page.evaluate(offset => window.__cupitorReadFilmotCapture(41, offset), transcript.length);
    const {chunk} = JSON.parse(reply);
    assert.ok(chunk.length > 0 && chunk.length <= 4096);
    transcript += chunk;
  }
  assert.equal(transcript.length, summary.length);
  const {lines, query} = JSON.parse(transcript);
  assert.equal(query, 'smälek');
  assert.deepEqual(lines[199], {i: 199, ts: 199, t: 'smälek på svenska 💬 199'});
  assert.equal(await page.evaluate(() => typeof window.__cupitorReadFilmotCapture), 'undefined');
});
