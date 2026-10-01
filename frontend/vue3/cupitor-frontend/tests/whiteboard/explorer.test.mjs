// A teacher has hidden some objects for later in the lesson, finds them in
// the Objects list, shows and hides them, and replays the lesson.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

after(stopBrowser);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

const rows = b => b.eval(() => [...document.querySelectorAll('#object-explorer-list .explorer-row')]
  .map(r => r.dataset.uid + (r.classList.contains('hidden-object') ? ' (hidden)' : '') + (r.classList.contains('selected') ? ' *' : '')));
const visible = (b, ...uids) => b.eval(u => u.map(x => findIfRequired(x).visible), uids);

test('explorer: the selection uid at the bottom; find, show and hide objects; undo; replay', async () => {
  const b = await openBoard();
  try {
    await b.play([
      'addRect(150,150,120,60,{"uid":"R1","fill":"#90caf9"})',
      'addRect(400,300,100,80,{"uid":"R2","fill":"#a5d6a7"})',
      'addRect(600,300,100,80,{"uid":"R3"})',
      'hideObject("R2")',
      'hideObject("R3")'
    ]);
    // The bar sits at the bottom and names what is selected.
    assert.equal(await b.page.textContent('#selectedObjId'), '–');
    await b.select('R1');
    assert.equal(await b.page.textContent('#selectedObjId'), 'R1');
    const bar = await b.eval(() => [document.getElementById('layer-info-bar').getBoundingClientRect().bottom, innerHeight]);
    assert.ok(bar[1] - bar[0] < 40, `at the bottom: ${bar}`);
    await b.deselect();
    assert.equal(await b.page.textContent('#selectedObjId'), '–');

    // The list shows everything, top first, hidden ones marked.
    await b.page.click('#object-explorer-btn');
    assert.deepEqual(await rows(b), ['R3 (hidden)', 'R2 (hidden)', 'R1']);
    await b.page.check('#object-explorer-hidden');
    assert.deepEqual(await rows(b), ['R3 (hidden)', 'R2 (hidden)']);
    await b.page.uncheck('#object-explorer-hidden');
    await b.page.fill('#object-explorer-filter', 'r2');
    assert.deepEqual(await rows(b), ['R2 (hidden)']);
    await b.page.fill('#object-explorer-filter', '');

    // Show R2 with its eye; undo hides it again, redo shows it.
    await b.page.click('#object-explorer-list .explorer-row[data-uid="R2"] .explorer-eye');
    assert.deepEqual(await visible(b, 'R2'), [true]);
    assert.deepEqual(await rows(b), ['R3 (hidden)', 'R2', 'R1'], 'the list follows');
    await b.key(`${mod}+z`);
    assert.deepEqual(await visible(b, 'R2'), [false]);
    await b.key(`${mod}+Shift+z`);
    assert.deepEqual(await visible(b, 'R2'), [true]);
    // Undoing while it is selected hides it and drops the selection.
    await b.select('R2');
    await b.key(`${mod}+z`);
    assert.deepEqual([await visible(b, 'R2'), await b.eval(() => pc.getActiveObject())], [[false], undefined]);
    await b.key(`${mod}+Shift+z`);

    // Clicking a row selects it; its eye hides it (and drops the selection).
    await b.page.click('#object-explorer-list .explorer-row[data-uid="R1"] .explorer-label');
    assert.equal(await b.eval(() => pc.getActiveObject() && pc.getActiveObject().uid), 'R1');
    await b.page.click('#object-explorer-list .explorer-row[data-uid="R1"] .explorer-eye');
    assert.deepEqual(await visible(b, 'R1'), [false]);
    assert.equal(await b.eval(() => pc.getActiveObject()), undefined);

    // Show all brings back every hidden one, as one undo step.
    await b.page.click('#object-explorer-show-all');
    assert.deepEqual(await visible(b, 'R1', 'R2', 'R3'), [true, true, true]);
    assert.equal(await b.page.isDisabled('#object-explorer-show-all'), true);
    await b.key(`${mod}+z`);
    assert.deepEqual(await visible(b, 'R1', 'R2', 'R3'), [false, true, false]);
    await b.key(`${mod}+Shift+z`);

    const lines = await b.script();
    assert.ok(lines.includes('showObject("R2")'), lines.join('\n'));
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
