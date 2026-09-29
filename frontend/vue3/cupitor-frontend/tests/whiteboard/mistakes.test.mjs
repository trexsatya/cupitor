// A teacher fixes mistakes: deletes a connected shape by accident and undoes
// it, and duplicates a connected pair to reuse it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, detached, assertSameScene } from './board.mjs';

after(stopBrowser);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

async function drawRect(b, x1, y1, x2, y2) {
  await b.shapeTool(0);
  const before = await b.uids();
  await b.dragCanvas(x1, y1, x2, y2);
  const [uid] = await b.newUids(before);
  await b.deselect();
  return uid;
}

// Two rectangles joined by the connector tool.
async function connectedPair(b) {
  const a = await drawRect(b, 150, 150, 270, 220);
  const c = await drawRect(b, 450, 150, 570, 220);
  await b.tool('connector');
  const before = await b.uids();
  await b.select(a);
  await b.select(c);
  const [line] = await b.newUids(before);
  await b.key('Escape');
  await b.eval(() => toolManager.activate('select'));
  await b.deselect();
  assert.deepEqual(await b.eval(l => { const cd = findIfRequired(l).customData; return [cd.source, cd.target]; }, line), [a, c]);
  return { a, c, line };
}

const exists = (b, uids) => b.eval(u => u.map(x => isFabricObject(findIfRequired(x))), uids);

// Deletes the connected shape `a` (with `how`), undoes, and checks the line follows it again.
async function deleteAndUndo(b, how) {
  const { a, line } = await connectedPair(b);
  await b.select(a);
  if (how === 'menu') await b.contextMenu(a, 'Delete');
  else await b.key('Delete');
  assert.deepEqual(await exists(b, [a, line]), [false, false], 'the shape goes, and its line with it');
  await b.key(`${mod}+z`);
  assert.deepEqual(await exists(b, [a, line]), [true, true], 'undo brings both back');
  await b.deselect();
  await b.dragObject(a, 0, 150);
  await b.deselect();
  assert.deepEqual(detached(await b.lineGaps()), {}, 'the restored line follows the moved shape');
  assert.deepEqual(b.errors, []);
}

test('mistakes: right-click Delete on a connected shape, then undo', async () => {
  const b = await openBoard();
  try { await deleteAndUndo(b, 'menu'); } finally { await b.close(); }
});

test('mistakes: Delete key on a connected shape, then undo', { todo: 'the Delete key is not undoable' }, async () => {
  const b = await openBoard();
  try { await deleteAndUndo(b, 'key'); } finally { await b.close(); }
});

test('mistakes: replay after an undo shows the undone state', { todo: 'undo/redo are not recorded in the script' }, async () => {
  const b = await openBoard();
  try {
    const { a } = await connectedPair(b);
    await b.select(a);
    await b.contextMenu(a, 'Delete');
    await b.key(`${mod}+z`);
    const live = await b.snapshot();
    const replay = await replayElsewhere(await b.script());
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});

test('mistakes: a duplicated connected pair stays connected, also after replay', async () => {
  const b = await openBoard();
  try {
    const { c, line } = await connectedPair(b);

    // Select the pair and its line with a drag around them, Duplicate.
    await b.dragCanvas(120, 120, 620, 260);
    assert.equal(await b.eval(() => pc.getActiveObjects().length), 3);
    let before = await b.uids();
    await b.contextMenu(c, 'Duplicate');
    const copies = await b.newUids(before);
    assert.equal(copies.length, 3, `three copies: ${copies}`);
    await b.deselect();
    const copyLine = await b.eval(u => u.find(x => findIfRequired(x) instanceof fabric.Line), copies);
    const [ca, cc] = await b.eval(l => { const cd = findIfRequired(l).customData; return [cd.source, cd.target]; }, copyLine);
    assert.ok(copies.includes(ca) && copies.includes(cc), 'the copied line joins the copies');

    // Pull the copied shapes away together, then move one on its own.
    await b.selectMany([ca, cc]);
    await b.dragObject(null, 0, 300, await b.centerOf(cc));
    await b.deselect();
    await b.dragObject(cc, 200, 0);
    await b.deselect();
    const gaps = await b.lineGaps();
    assert.deepEqual(Object.keys(gaps).sort(), [line, copyLine].sort());
    assert.deepEqual(detached(gaps), {}, 'every line follows its shapes');

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines, async r => {
      // On the replayed board the copied line still follows a dragged copy.
      await r.dragObject(ca, -100, 0);
      await r.deselect();
      assert.deepEqual(detached(await r.lineGaps()), {}, 'replayed copy line follows its shape');
    });
    assert.deepEqual(replay.errors, []);
    assert.deepEqual(detached(replay.gaps), {});
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
