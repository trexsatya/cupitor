// A teacher reuses parts of the board with copy and paste.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, detached, assertSameScene } from './board.mjs';

after(stopBrowser);

async function drawRect(b, x1, y1, x2, y2) {
  await b.shapeTool(0);
  const before = await b.uids();
  await b.dragCanvas(x1, y1, x2, y2);
  const [uid] = await b.newUids(before);
  await b.deselect();
  return uid;
}

for (const mod of ['Control', 'Meta']) {
  test(`copy-paste with ${mod}: a connected pair, then a shape; replay`, async () => {
    const b = await openBoard();
    try {
      const a = await drawRect(b, 150, 150, 270, 220);
      const c = await drawRect(b, 450, 150, 570, 220);
      const d = await drawRect(b, 150, 400, 270, 470);
      await b.tool('connector');
      await b.select(a);
      await b.select(c);
      await b.key('Escape');
      await b.deselect();

      // The pair with its line: the pasted line joins the pasted shapes.
      await b.dragCanvas(120, 120, 620, 250);
      await b.key(`${mod}+c`);
      assert.equal(await b.eval(() => $('#node-content-holder').is(':visible')), false, 'no editor pops up');
      let before = await b.uids();
      await b.key(`${mod}+v`);
      const copies = await b.newUids(before);
      assert.equal(copies.length, 3, `pair + line pasted: ${copies}`);
      await b.deselect();
      const ends = await b.eval(u => { const l = u.map(findIfRequired).find(o => o instanceof fabric.Line); return [l.customData.source, l.customData.target]; }, copies);
      assert.ok(ends.every(e => copies.includes(e)), 'pasted line joins the pasted shapes');

      // Another shape: copy, paste twice — each paste lands a little further on.
      await b.select(d);
      await b.key(`${mod}+c`);
      before = await b.uids();
      await b.key(`${mod}+v`);
      await b.key(`${mod}+v`);
      const pasted = await b.newUids(before);
      assert.equal(pasted.length, 2, 'two pastes');
      const lefts = await b.eval(u => u.map(x => Math.round(findIfRequired(x).left)), [d, ...pasted]);
      assert.ok(lefts[1] > lefts[0] && lefts[2] > lefts[1], `pastes step on: ${lefts}`);

      // Pasting a link into a Properties-panel field pastes text, not objects.
      await b.select(d);
      await b.page.click('#prop-media-url');
      before = await b.uids();
      await b.key(`${mod}+v`);
      assert.deepEqual(await b.newUids(before), [], 'nothing pasted onto the board from a text field');
      await b.deselect();

      const lines = await b.script();
      const live = await b.snapshot();
      assert.deepEqual(b.errors, []);
      const replay = await replayElsewhere(lines);
      assert.deepEqual(replay.errors, []);
      assert.deepEqual(detached(replay.gaps), {});
      assertSameScene(replay.snapshot, live, 2);
    } finally { await b.close(); }
  });
}

test('typing in a Properties-panel field is text, not canvas shortcuts', async () => {
  const b = await openBoard();
  try {
    const a = await drawRect(b, 150, 150, 270, 220);
    await b.select(a);
    await b.page.click('#prop-media-url');
    // t, h, s, v are shortcuts on the canvas; Backspace deletes there.
    await b.page.keyboard.type('https://thesite.org/vids');
    await b.page.keyboard.press('Backspace');
    assert.equal(await b.page.inputValue('#prop-media-url'), 'https://thesite.org/vid');
    assert.deepEqual(await b.eval(u => { const o = findIfRequired(u); return [isFabricObject(o), o.visible]; }, a), [true, true], 'the object is still there and shown');
    assert.deepEqual(await b.script(), [(await b.script())[0]], 'nothing recorded but the shape');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('copy-paste: an object\'s notes open from the right-click menu', async () => {
  const b = await openBoard();
  try {
    const a = await drawRect(b, 150, 150, 270, 220);
    await b.select(a);
    await b.contextMenu(a, 'Notes');
    assert.equal(await b.eval(() => $('#node-content-holder').is(':visible')), true);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
