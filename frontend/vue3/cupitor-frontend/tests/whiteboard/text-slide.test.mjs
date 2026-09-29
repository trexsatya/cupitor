// A teacher writes a text slide: a heading typed on the canvas and a
// multi-line note inside a rectangle, then tidies the heading's width.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

after(stopBrowser);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

test('text slide: typed heading fits its text, multi-line note in a box, replay', async () => {
  const b = await openBoard();
  try {
    // Heading: Text tool, click, double-click to edit, type, click away.
    await b.textMenu('Text');
    let before = await b.uids();
    await b.click(200, 100);
    const [heading] = await b.newUids(before);
    assert.equal(await b.eval(u => findIfRequired(u).type, heading), 'textbox');
    const [hx, hy] = await b.centerOf(heading);
    const [sx, sy] = await b.screen(hx, hy);
    await b.page.mouse.dblclick(sx, sy);
    await b.page.keyboard.press(`${mod}+a`);
    await b.page.keyboard.type('Feelings');
    await b.click(900, 600);
    const h = await b.eval(u => { const o = findIfRequired(u); return { text: o.text, width: o.width, line: o.getLineWidth(0) }; }, heading);
    assert.equal(h.text, 'Feelings');
    assert.ok(h.width - h.line < 12, `box hugs its text: width ${h.width} vs text ${h.line}`);

    // Widen it by the right-side handle; the width sticks. Undo puts it back.
    await b.select(heading);
    await b.dragHandle('mr', 150, 0);
    const widened = await b.eval(u => findIfRequired(u).width, heading);
    assert.ok(widened > h.width + 100, `widened to ${widened}`);
    await b.deselect();
    await b.key(`${mod}+z`);
    assert.ok(Math.abs(await b.eval(u => findIfRequired(u).width, heading) - h.width) < 1, 'undo restores the width');
    await b.key(`${mod}+Shift+z`);
    assert.ok(Math.abs(await b.eval(u => findIfRequired(u).width, heading) - widened) < 1, 'redo widens again');

    // A note in a rectangle: Text menu → Text in rectangle, click, type
    // several lines. Keys typed into the popup don't reach the canvas
    // (t would otherwise add a text, s would pick the rectangle tool).
    await b.textMenu('Text in rectangle');
    before = await b.uids();
    await b.click(300, 300);
    await b.typeInPopup('Joy lifts us\nFear warns us\nsadness slows us');
    const [note] = await b.newUids(before);
    assert.ok(note, 'note added');
    const noteText = await b.eval(u => { const o = findIfRequired(u); const t = o._objects.find(k => typeof k.text === 'string'); return t.text; }, note);
    // The shape pads each line with a space on both sides.
    assert.equal(noteText.split('\n').map(l => l.trim()).join('\n'), 'Joy lifts us\nFear warns us\nsadness slows us');
    assert.equal((await b.newUids(before)).length, 1, 'typing in the popup added nothing else');
    assert.equal(await b.eval(() => toolManager.activeTool), 'select');

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
