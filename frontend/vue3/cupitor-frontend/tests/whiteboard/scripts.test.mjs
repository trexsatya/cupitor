// A teacher writes a script by hand in the script editor, labels its scenes
// with comments, plays it, steps through it, and shares it as a file.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openBoard, stopBrowser } from './board.mjs';

after(stopBrowser);
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'wb-'));

const SCRIPT = [
  '// Scene 1: the root',
  'addRect(100,100,120,60,{"uid":"R1","fill":"#90caf9"}) // the root, in blue',
  '/* Scene 2:',
  '   two children */',
  'addRect(300,100,80,40,{"uid":"R2"})',
  '',
  'drawOutline(["R2"], {"duration":300}) /* traced */',
  '/* one line */ addRect(100,300,60,40,{"uid":"R3"})'
];

// Types the script into the editor as a whole, Save Edits, then Play (clearing the board).
async function writeAndPlay(b, lines) {
  await b.page.click('.wb-tool[title^="Script editor"]');
  await b.eval(text => window._scriptEditor.setValue(text, -1), lines.join('\n'));
  await b.page.click('#scriptViewerDialog button:text-is("Save Edits")');
  await b.page.click('#scriptViewerDialog button:has-text("Play")');
  await b.page.click('#clearBeforePlayDialog button:text-is("▶ Play")');
  await b.page.waitForFunction(() => !window.isRecordingPlayback && !document.body.classList.contains('play-mode'), null, { timeout: 60000 });
}

// Collects what the play badge reports as the script plays.
const watchBadge = b => b.eval(() => {
  window.__badge = [];
  const badge = document.getElementById('play-line-badge');
  new MutationObserver(() => { if (badge.textContent) window.__badge.push(badge.textContent); })
    .observe(badge, { childList: true, characterData: true, subtree: true });
});
const badges = b => b.eval(() => [...new Set(window.__badge)]);

test('scripts: comments are kept, skipped when playing, and line numbers match the editor', async () => {
  const b = await openBoard();
  try {
    await watchBadge(b);
    const started = Date.now();
    await writeAndPlay(b, SCRIPT);
    const took = Date.now() - started;
    assert.deepEqual(await b.eval(() => ['R1', 'R2', 'R3'].map(u => isFabricObject(findIfRequired(u)))), [true, true, true]);
    assert.equal(await b.eval(() => findIfRequired('R1').fill), '#90caf9', 'code before a trailing comment runs');
    assert.deepEqual(await badges(b), ['Line 2 of 8', 'Line 5 of 8', 'Line 7 of 8', 'Line 8 of 8'], 'only code lines play, numbered as in the editor');
    assert.ok(took < 7000, `comments add no pauses (${took} ms)`);
    assert.equal((await b.script()).filter(l => l.trim()).length, 7, 'comments stay in the script');

    // A mistake on a line is reported with the editor's line number.
    await watchBadge(b);
    await writeAndPlay(b, [...SCRIPT.slice(0, 4), 'addRect(300,100,80,40,{"uid":"R2"}', ...SCRIPT.slice(5)]);
    assert.ok((await badges(b)).some(t => /^Line 5 of 8 failed/.test(t)), JSON.stringify(await badges(b)));
    assert.equal(b.errors.length, 1);
    assert.match(b.errors[0], /^Script line 5 failed/);
  } finally { await b.close(); }
});

test('scripts: what runs of each line: comments left out, quotes respected', async () => {
  const b = await openBoard();
  try {
    const cases = [
      ['// x', ''],
      ['addText("http://x") // note', 'addText("http://x")'],
      ["setHtml('a', '/* not a comment */')", "setHtml('a', '/* not a comment */')"],
      ['/* x */ animate("R1", {"left": 5}, {})', 'animate("R1", {"left": 5}, {})'],
      ['addRect(1,2,3,4) /* opens', 'addRect(1,2,3,4)'],
      ['   still comment', ''],
      ['ends */ removeByUid("R1")', 'removeByUid("R1")'],
      ['/* a */ /* b', ''],
      ['b */', ''],
      ['', ''],
      ['  hideObject("R2")  ', 'hideObject("R2")']
    ];
    assert.deepEqual(await b.eval(l => scriptCode(l), cases.map(c => c[0])), cases.map(c => c[1]));
    // A /* that never closes only comments out its own line.
    assert.deepEqual(await b.eval(() => scriptCode(['/* oops', 'addRect(1,1,2,2)', 'x() /* again', 'y()'])), ['', 'addRect(1,1,2,2)', 'x()', 'y()']);
  } finally { await b.close(); }
});

test('scripts: stepping through passes over comments', async () => {
  const b = await openBoard();
  try {
    await b.page.click('.wb-tool[title^="Script editor"]');
    await b.eval(text => window._scriptEditor.setValue(text, -1), SCRIPT.join('\n'));
    await b.page.click('#scriptViewerDialog button:text-is("Save Edits")');
    await b.page.click('#scriptViewerDialog button:has-text("Play")');
    await b.page.click('#clearBeforePlayDialog button:has-text("Play Stepwise")');
    const at = () => b.eval(() => window._stepwiseState && window._stepwiseState.index);
    const visited = [await at()];
    for (let i = 0; i < 4; i++) {
      await b.page.click('#stepwiseNextBtn');
      await b.page.waitForFunction(() => !window._stepwiseState.busy, null, { timeout: 10000 });
      visited.push(await at());
    }
    assert.deepEqual(visited, [1, 4, 6, 7, 8], 'it stops on code lines only, then is done');
    assert.equal(await b.page.textContent('#stepwiseNextBtn'), '✓ Done');
    assert.deepEqual(await b.eval(() => ['R1', 'R2', 'R3'].map(u => isFabricObject(findIfRequired(u)))), [true, true, true]);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('scripts: comments survive Export and Import', async () => {
  const b = await openBoard();
  let file;
  try {
    await b.eval(l => { window.recordedScriptLines = l; }, SCRIPT.filter(l => l.trim()));
    await b.page.click('.wb-tool[title^="Script editor"]');
    const [download] = await Promise.all([b.page.waitForEvent('download'), b.page.click('#scriptViewerDialog button:text-is("Export")')]);
    file = path.join(tmp, 'commented.txt');
    await download.saveAs(file);
  } finally { await b.close(); }

  const other = await openBoard();
  try {
    // A line typed in the editor but not saved yet, then Import.
    await other.page.click('.wb-tool[title^="Script editor"]');
    await other.eval(() => window._scriptEditor.setValue('// my notes', -1));
    await other.page.click('#scriptViewerDialog button:text-is("Import")');
    await other.page.setInputFiles('#importInputFile', file);
    await other.page.click('#importDialog button:has-text("OK")');
    // It plays at once, so the script dialog is out of the way.
    await other.page.waitForFunction(() => getComputedStyle(document.getElementById('scriptViewerDialog')).display === 'none', null, { timeout: 5000 });
    await other.page.waitForFunction(() => window.isRecordingPlayback, null, { timeout: 10000 }).catch(() => {});
    await other.page.waitForFunction(() => !window.isRecordingPlayback, null, { timeout: 60000 });
    assert.deepEqual(await other.script(), ['// my notes', ...SCRIPT.filter(l => l.trim())], 'the edit is kept, then the same lines, comments included');
    assert.deepEqual(await other.eval(() => ['R1', 'R2', 'R3'].map(u => isFabricObject(findIfRequired(u)))), [true, true, true]);
    assert.deepEqual(other.errors, []);
  } finally { await other.close(); }
});

test('scripts: run just the selected lines, or the cursor\'s line, on the board as it is', async () => {
  const b = await openBoard();
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  const lines = [
    'addRect(100,100,60,40,{"uid":"R1"})',
    'addRect(300,100,60,40,{"uid":"R2"})',
    '/* addRect(500,100,60,40,{"uid":"R9"})',
    '   still a comment */',
    'setObjectProps("R1", {"left": 400})',
    'removeByUid("R2")'
  ];
  const on = () => b.eval(() => ['R1', 'R2', 'R9'].map(u => { const o = findIfRequired(u); return isFabricObject(o) ? Math.round(o.left) : null; }));
  const select = (r1, c1, r2, c2) => b.eval(([a, b2, c, d]) => {
    const { Range } = ace.require('ace/range');
    _scriptEditor.selection.setRange(new Range(a, b2, c, d));
  }, [r1, c1, r2, c2]);
  const done = () => b.page.waitForFunction(() => !window.isRecordingPlayback && !document.body.classList.contains('play-mode'), null, { timeout: 30000 });
  try {
    await b.page.click('.wb-tool[title^="Script editor"]');
    await b.eval(text => window._scriptEditor.setValue(text, -1), lines.join('\n'));
    await watchBadge(b);

    // Rows 1-2 selected (the selection ends at the start of row 3): only they run.
    await select(0, 0, 2, 0);
    await b.page.click('#runSelectedLinesBtn');
    await done();
    assert.deepEqual(await on(), [100, 300, null]);
    assert.deepEqual(await badges(b), ['Line 1 of 6', 'Line 2 of 6'], 'numbered as in the editor');
    assert.equal(await b.page.isVisible('#scriptViewerDialog'), false, 'out of the way while they run');

    // Reopened, the selection is where it was; a comment line alone runs nothing.
    await b.page.click('.wb-tool[title^="Script editor"]');
    assert.deepEqual(await b.eval(() => { const r = _scriptEditor.getSelectionRange(); return [r.start.row, r.end.row]; }), [0, 2]);
    await select(3, 2, 3, 2);
    await b.page.click('#runSelectedLinesBtn');
    assert.equal(await b.page.isVisible('#scriptViewerDialog'), true, 'nothing to run: it stays open');

    // The cursor's line, with the shortcut: R1 moves, R2 stays.
    await select(4, 3, 4, 3);
    await b.eval(() => _scriptEditor.focus());
    await b.page.keyboard.press(`${mod}+Enter`);
    await done();
    assert.deepEqual(await on(), [400, 300, null]);
    assert.deepEqual(await b.script(), lines, 'running lines adds nothing to the script');
    assert.deepEqual(b.errors, []);

    // A line that fails (it needs an object no selected line made) stays reported.
    await b.page.click('.wb-tool[title^="Script editor"]');
    await b.eval(() => { _scriptEditor.navigateFileEnd(); _scriptEditor.insert('\nconnectObjects("R1", "R7", "L1")'); });
    await select(6, 0, 6, 0);
    await b.page.click('#runSelectedLinesBtn');
    await done();
    assert.match(await b.page.textContent('#play-notice'), /Line 7 failed: connectObjects: no object "R7"/);
    await b.page.click('.wb-tool[title^="Script editor"]');
    assert.deepEqual(await b.eval(() => _scriptEditor.session.getAnnotations().map(a => [a.row, a.type])), [[6, 'error']], 'marked in the editor');
    b.errors.length = 0; // the failure is also logged, as for any script line
  } finally { await b.close(); }
});
