// Scripts leave the board as files: a teacher exports a lesson, a colleague
// imports it; a hand-edited script with a mistake still plays.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openBoard, stopBrowser, detached, assertSameScene, fixture } from './board.mjs';

after(stopBrowser);
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'wb-'));

// Script editor → Import → pick the file → OK.
async function importFile(b, file, { wait = true } = {}) {
  await b.page.click('.wb-tool[title^="Script editor"]');
  await b.page.click('#scriptViewerDialog button:text-is("Import")');
  await b.page.setInputFiles('#importInputFile', file);
  await b.page.click('#importDialog button:has-text("OK")');
  if (wait) {
    await b.page.waitForFunction(() => document.body.classList.contains('play-mode') || window.isRecordingPlayback, null, { timeout: 10000 }).catch(() => {});
    await b.page.waitForFunction(() => !document.body.classList.contains('play-mode') && !window.isRecordingPlayback, null, { timeout: 300000, polling: 250 });
    await b.page.waitForTimeout(300);
    await b.page.click('#scriptViewerDialog button[onclick="closeScriptDialog()"]');
  }
}

test('sharing: an exported lesson imports on another board exactly', async () => {
  const b = await openBoard();
  let file, live, lines;
  try {
    await b.shapeTool(0);
    let before = await b.uids();
    await b.dragCanvas(500, 120, 640, 190);
    const [root] = await b.newUids(before);
    await b.select(root);
    b.promptAnswers.push('Yes, No');
    await b.key('t');
    await b.select(root);
    for (const chk of await b.page.$$('#tree-children-list .tree-child-row input[type=checkbox]')) await chk.check();
    await b.page.click('#tree-node-panel button:has-text("Show/Hide")');
    await b.deselect();
    await b.dragObject(null, 200, 200, await b.centerOf(root));
    await b.deselect();

    await b.page.click('.wb-tool[title^="Script editor"]');
    const [download] = await Promise.all([b.page.waitForEvent('download'), b.page.click('#scriptViewerDialog button:text-is("Export")')]);
    file = path.join(tmp, 'lesson.txt');
    await download.saveAs(file);
    live = await b.snapshot();
    lines = await b.script();
  } finally { await b.close(); }

  const other = await openBoard();
  try {
    await importFile(other, file);
    assert.deepEqual(other.errors, []);
    assert.deepEqual(await other.script(), lines, 'the imported lines join the script');
    assert.deepEqual(detached(await other.lineGaps()), {});
    assertSameScene(await other.snapshot(), live, 2);
  } finally { await other.close(); }
});

test('sharing: a real lesson with nested groups imports with every line attached, and stays attached when dragged', async () => {
  const b = await openBoard();
  try {
    await importFile(b, fixture('nested-groups.txt'));
    assert.deepEqual(b.errors, []);
    const count = await b.eval(() => pc.getObjects().length);
    const gaps = await b.lineGaps();
    assert.equal(count, 42, 'objects on the canvas');
    assert.equal(Object.keys(gaps).length, 26, 'connected lines');
    assert.deepEqual(detached(gaps), {});

    // Drag the outer groups around; their lines keep up.
    for (const g of ['G3', 'G4']) {
      await b.deselect();
      await b.dragObject(g, 120, 60);
      await b.deselect();
      assert.deepEqual(detached(await b.lineGaps()), {}, `after dragging ${g}`);
    }
  } finally { await b.close(); }
});

test('sharing: a broken line is reported and skipped; importing again while it plays is refused', async () => {
  const file = path.join(tmp, 'broken.txt');
  fs.writeFileSync(file, [
    'addRect(100,100,80,60,{"uid":"R1","fill":"#90caf9"})',
    'addRect(200,100,80,60,{"uid":"R2"}',            // missing bracket
    'animate("R1", {"left": 400}, {"duration": 300})',
    'addRect(100,300,80,60,{"uid":"R3","fill":"#a5d6a7"})'
  ].join('\n'));
  const b = await openBoard();
  try {
    // The failure shows in the play badge while the script plays.
    await b.eval(() => {
      window.__failures = [];
      const badge = document.getElementById('play-line-badge');
      new MutationObserver(() => { if (badge.classList.contains('failed')) window.__failures.push(badge.textContent); })
        .observe(badge, { childList: true, characterData: true, subtree: true, attributes: true });
    });
    await importFile(b, file, { wait: false });
    await b.page.waitForFunction(() => window.isRecordingPlayback, null, { timeout: 10000 });
    // A second import while this one plays is refused with a message.
    await b.page.click('#scriptViewerDialog button:text-is("Import")');
    await b.page.setInputFiles('#importInputFile', file);
    await b.page.click('#importDialog button:has-text("OK")');
    assert.match(await b.page.textContent('#importMessage'), /playing/);
    await b.page.click('#importDialog button:has-text("Close")');

    await b.page.waitForFunction(() => !window.isRecordingPlayback, null, { timeout: 60000 });
    await b.page.waitForTimeout(300);
    const state = await b.eval(() => ['R1', 'R2', 'R3'].map(u => { const o = findIfRequired(u); return isFabricObject(o) ? Math.round(o.left) : null; }));
    assert.deepEqual(state, [400, null, 100], 'lines around the broken one still ran');
    const failures = await b.eval(() => [...new Set(window.__failures)]);
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.match(failures[0], /^Line 2 of 4 failed/);
    assert.equal((await b.script()).length, 4, 'imported once');
  } finally { await b.close(); }
});
