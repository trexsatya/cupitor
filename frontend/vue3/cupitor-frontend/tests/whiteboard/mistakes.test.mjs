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

test('mistakes: Delete key on a connected shape, then undo', async () => {
  const b = await openBoard();
  try { await deleteAndUndo(b, 'key'); } finally { await b.close(); }
});

test('mistakes: undo and redo are part of the recording', async () => {
  const b = await openBoard();
  try {
    const { a, c } = await connectedPair(b);

    // A small tree under a third shape.
    const root = await drawRect(b, 700, 120, 820, 180);
    await b.select(root);
    b.promptAnswers.push('Yes, No');
    await b.key('t');
    await b.select(root);
    for (const chk of await b.page.$$('#tree-children-list .tree-child-row input[type=checkbox]')) await chk.check();
    await b.page.click('#tree-node-panel button:has-text("Show/Hide")');
    await b.deselect();
    const [kid] = await b.eval(r => findIfRequired(r).treeConnection.outgoing.lines.map(findIfRequired).map(l => l.customData.target), root);
    await b.dragObject(null, 0, 200, await b.centerOf(kid));
    await b.deselect();
    const kidLine = await b.eval(k => pc.getObjects().find(o => o.customData && o.customData.target === k).uid, kid);

    // Move a shape, then undo the move: it goes back and its line follows.
    const home = await b.centerOf(a);
    await b.dragObject(a, 0, 150);
    await b.deselect();
    await b.key(`${mod}+z`);
    assert.deepEqual(await b.centerOf(a), home);
    assert.deepEqual(detached(await b.lineGaps()), {}, 'line back with the shape');

    // Delete a tree child: its line goes too. Undo, redo, undo.
    await b.select(kid);
    await b.contextMenu(kid, 'Delete');
    assert.deepEqual(await exists(b, [kid, kidLine]), [false, false], 'tree child goes with its line');
    await b.key(`${mod}+z`);
    assert.deepEqual(await exists(b, [kid, kidLine]), [true, true], 'undo: both back');
    await b.key(`${mod}+Shift+z`);
    assert.deepEqual(await exists(b, [kid, kidLine]), [false, false], 'redo: both gone');
    await b.key(`${mod}+z`);
    assert.deepEqual(await exists(b, [kid, kidLine]), [true, true], 'undo again: both back');

    // Delete key on the other end of the connector, then undo.
    await b.select(c);
    await b.key('Delete');
    await b.key(`${mod}+z`);
    await b.deselect();
    assert.deepEqual(detached(await b.lineGaps()), {});

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines, async r => {
      // The replayed restored shape still pulls its line along.
      await r.dragObject(c, 0, 120);
      await r.deselect();
      assert.deepEqual(detached(await r.lineGaps()), {}, 'replayed restored connector follows');
    });
    assert.deepEqual(replay.errors, []);
    assert.deepEqual(detached(replay.gaps), {});
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});

test('mistakes: an undone drawing and a redone quad replay as they look', async () => {
  const b = await openBoard();
  try {
    // A freehand stroke with the pen, then undo it.
    await b.key('p');
    await b.dragCanvas(150, 400, 300, 450);
    assert.equal(await b.eval(() => oc.getObjects().length), 1, 'stroke drawn');
    await b.key('v');
    await b.key(`${mod}+z`);
    assert.equal(await b.eval(() => oc.getObjects().length), 0, 'stroke undone');

    // A quad, undone and redone: its label comes back with it.
    await b.shapeTool(3);
    const before = await b.uids();
    await b.dragCanvas(400, 150, 560, 260);
    const [quad] = await b.newUids(before);
    await b.deselect();
    await b.key(`${mod}+z`);
    await b.key(`${mod}+Shift+z`);
    const labelled = () => b.eval(u => { const q = findIfRequired(u); return isFabricObject(q) && !!q._labelText && pc.getObjects().filter(o => o === q._labelText).length; }, quad);
    assert.equal(await labelled(), 1, 'label back with the quad, once');

    const lines = await b.script();
    assert.deepEqual(b.errors, []);
    let replayed;
    await replayElsewhere(lines, async r => {
      replayed = { strokes: await r.eval(() => oc.getObjects().length), labelled: await r.eval(u => { const q = findIfRequired(u); return isFabricObject(q) && !!q._labelText && pc.getObjects().filter(o => o === q._labelText).length; }, quad), errors: r.errors };
    });
    assert.deepEqual(replayed, { strokes: 0, labelled: 1, errors: [] });
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
