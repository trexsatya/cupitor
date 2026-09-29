// A teacher tidies a slide: lines shapes up by dragging (they snap to each
// other), then resizes and turns several at once.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

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
const box = (b, u) => b.eval(x => { const o = findIfRequired(x); o.setCoords(); const r = o.getBoundingRect(); return [r.left, r.top, r.width, r.height].map(Math.round); }, u);

test('rearranging: snap into line, resize and rotate a multi-selection, replay', async () => {
  const b = await openBoard();
  try {
    const a = await drawRect(b, 150, 150, 270, 220);
    const c = await drawRect(b, 400, 300, 500, 380);
    const count = (await b.uids()).size;

    // Drag c so its left edge lands 3 px off a's: it snaps level with a.
    const [al] = await box(b, a), [cl] = await box(b, c);
    await b.dragObject(null, al + 3 - cl, 0, await b.centerOf(c)); // it snaps, so it moves 3 px further
    await b.deselect();
    assert.equal((await box(b, c))[0], al, 'left edges line up');
    assert.equal((await b.uids()).size, count, 'the guides are not objects');

    // Select both, pull the corner out and turn them a little.
    await b.selectMany([a, c]);
    const before = [await box(b, a), await box(b, c)];
    await b.dragHandle('br', 80, 60);
    const grown = [await box(b, a), await box(b, c)];
    grown.forEach((r, i) => assert.ok(r[2] > before[i][2] && r[3] > before[i][3], `both grew: ${before[i]} → ${r}`));
    await b.dragHandle('mtr', 60, 0);
    assert.ok(await b.eval(() => Math.abs(pc.getActiveObject().angle) > 3), 'turned');

    // Undo both with the selection still active: each shape goes back.
    await b.key(`${mod}+z`);
    await b.deselect();
    assert.deepEqual(await b.eval(u => Math.round(findIfRequired(u).angle), a), 0, 'undo takes the turn back');
    assert.deepEqual([await box(b, a), await box(b, c)], grown, 'still grown');
    await b.key(`${mod}+z`);
    const undone = [await box(b, a), await box(b, c)];
    undone.forEach((r, i) => r.forEach((v, k) => assert.ok(Math.abs(v - before[i][k]) <= 1, `back to ${before[i]}: ${r}`)));
    // Redo the resize again.
    await b.key(`${mod}+Shift+z`);
    assert.deepEqual([await box(b, a), await box(b, c)], grown, 'redo grows them again');

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
