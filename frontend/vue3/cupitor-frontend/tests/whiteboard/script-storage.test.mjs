// A teacher records part of a lesson, edits the script, reloads the page by
// mistake, and gets the script back with when each line was added.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, startBrowser, stopBrowser } from './board.mjs';

after(stopBrowser);

async function reload(b) {
  await b.page.reload({ waitUntil: 'load' });
  await b.page.waitForFunction(() => window.pc && window.playScript && window.undoManager, null, { timeout: 60000 });
}
const state = b => b.eval(() => ({ lines: recordedScriptLines.slice(), times: scriptLineTimes().slice() }));
const gutter = b => b.eval(() => [...document.querySelectorAll('#scriptViewerEditor .ace_gutter-cell')].map(c => c.textContent.trim()));

test('script storage: kept over a reload, with line times in the gutter that survive edits', async () => {
  const b = await openBoard();
  try {
    // Record two rectangles, a little apart in time.
    const before = Date.now();
    await b.shapeTool(0);
    await b.dragCanvas(150, 150, 270, 220);
    await b.deselect();
    await b.page.waitForTimeout(1100);
    await b.shapeTool(0);
    await b.dragCanvas(400, 300, 500, 380);
    await b.deselect();
    const recorded = await state(b);
    assert.equal(recorded.lines.length, 2, recorded.lines.join('\n'));
    assert.ok(recorded.times.every(t => t >= before && t <= Date.now()), 'each line has the time it was recorded');
    assert.ok(recorded.times[1] - recorded.times[0] >= 1000);

    // The editor's gutter shows the time beside each line number.
    await b.page.click('.wb-tool[title^="Script editor"]');
    const clock = t => b.eval(ms => _formatLineTime(ms), t);
    assert.deepEqual(await gutter(b), [`${await clock(recorded.times[0])} 1`, `${await clock(recorded.times[1])} 2`]);

    // Add a comment above them: the old lines keep their times, the new one gets now.
    await b.eval(() => _scriptEditor.navigateFileStart());
    await b.page.keyboard.type('// Scene 1');
    await b.page.keyboard.press('Enter');
    const want = `${await clock(recorded.times[0])} 2`;
    await b.page.waitForFunction(w => document.querySelectorAll('#scriptViewerEditor .ace_gutter-cell')[1].textContent.trim() === w, want, { timeout: 3000 })
      .catch(async () => assert.equal((await gutter(b))[1], want, 'the gutter follows while typing'));
    assert.equal((await gutter(b))[0], '1', 'a line not saved yet has no time');
    const saving = Date.now();
    await b.page.click('#scriptViewerDialog button:text-is("Save Edits")');
    const edited = await state(b);
    assert.deepEqual(edited.lines, ['// Scene 1', ...recorded.lines]);
    assert.deepEqual(edited.times.slice(1), recorded.times);
    assert.ok(edited.times[0] >= saving);
    await b.page.click('#scriptViewerDialog button:text-is("×")');

    // Reload: the script and its times are back; the board is empty until played.
    await reload(b);
    assert.deepEqual(await state(b), edited);
    assert.equal(await b.eval(() => pc.getObjects().length), 0);
    assert.match(await b.page.textContent('#script-restored-bar'), /back \(3 lines\)/);
    await b.page.click('#script-restored-bar button:has-text("Play it")');
    await b.page.click('#clearBeforePlayDialog button:text-is("▶ Play")');
    await b.page.waitForFunction(() => !window.isRecordingPlayback && !document.body.classList.contains('play-mode'), null, { timeout: 60000 });
    assert.equal(await b.eval(() => pc.getObjects().filter(o => o.type === 'rect').length), 2, 'playing it redraws the board');
    assert.deepEqual(await state(b), edited, 'playing changes neither lines nor times');
    assert.equal(await b.page.isVisible('#script-restored-bar'), false);

    // Start fresh empties it, for good.
    await reload(b);
    await b.page.click('#script-restored-bar button:has-text("Start fresh")');
    assert.deepEqual(await state(b), { lines: [], times: [] });
    await reload(b);
    assert.deepEqual(await state(b), { lines: [], times: [] });
    assert.equal(await b.page.isVisible('#script-restored-bar'), false);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('script storage: a second tab that did nothing leaves the saved script alone when it closes', async () => {
  const { http, browser } = await startBrowser();
  const context = await browser.newContext();
  try {
    const open = async () => {
      const page = await context.newPage();
      await page.goto(`${http.url}/play.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.pc && window.undoManager, null, { timeout: 60000 });
      return page;
    };
    const [a, idle] = [await open(), await open()];
    await a.evaluate(() => { recordScript('addRect(1,1,20,20,{"uid":"A"})'); saveScriptToStorage(); });
    await idle.close({ runBeforeUnload: true });
    await a.waitForTimeout(200);
    assert.deepEqual(await a.evaluate(() => JSON.parse(localStorage.getItem('play.script')).lines), ['addRect(1,1,20,20,{"uid":"A"})']);
  } finally { await context.close(); }
});
