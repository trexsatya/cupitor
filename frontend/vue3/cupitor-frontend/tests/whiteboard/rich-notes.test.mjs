// A teacher writes formatted notes in an HTML box, covers part of it with a
// shape, zooms in, and replays the lesson.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

after(stopBrowser);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

const pictureReady = (b, uid) => b.page.waitForFunction(u => {
  const o = findIfRequired(u);
  return o._htmlPicture && o._htmlPictureContent === _htmlPictureContent(o) && !o._htmlPicturePending;
}, uid, { timeout: 15000 });

// Near-black pixels (text) drawn in a canvas area.
const darkPixels = (b, x, y, w, h) => b.eval(([x, y, w, h]) => {
  pc.renderAll();
  const v = pc.viewportTransform, r = pc.getRetinaScaling();
  const d = pc.lowerCanvasEl.getContext('2d').getImageData((x * v[0] + v[4]) * r, (y * v[3] + v[5]) * r, w * v[0] * r, h * v[3] * r).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90 && d[i + 3] > 200) n++;
  return n;
}, [x, y, w, h]);

test('rich notes: type and format an HTML box, cover it, zoom, replay', async () => {
  const b = await openBoard();
  try {
    // Place the box; it opens for typing straight away.
    await b.tool('htmlBox');
    let before = await b.uids();
    await b.click(200, 200);
    const [box] = await b.newUids(before);
    await b.page.waitForSelector('.html-box.editing');

    // Type two lines (letters like t, s, h are canvas shortcuts elsewhere),
    // then make them bold and a bulleted list from the Properties panel.
    await b.page.keyboard.press(`${mod}+a`);
    await b.page.keyboard.type('Breathe in slowly');
    await b.page.keyboard.press('Enter');
    await b.page.keyboard.type('Hold, then breathe out');
    await b.page.keyboard.press(`${mod}+a`);
    await b.page.click('#prop-html-section button[title="Bold"]');
    await b.page.click('#prop-html-section button[title="Bulleted list"]');
    await b.page.keyboard.press('Escape');
    await b.page.waitForSelector('.html-box.editing', { state: 'detached' });

    const html = await b.eval(u => findIfRequired(u).customData.html, box);
    assert.match(html, /<ul>.*<li>.*Breathe in slowly.*<\/li>.*<li>.*Hold, then breathe out.*<\/li>.*<\/ul>/s);
    assert.match(html, /<b>|font-weight/);
    assert.deepEqual(await b.newUids(before), [box], 'typing in the box added nothing to the canvas');
    assert.equal(await b.eval(u => findIfRequired(u).visible, box), true, 'h typed in the box did not hide it');

    // Undo takes the text back to the placeholder; redo brings it again.
    await b.deselect();
    await b.key(`${mod}+z`);
    assert.equal(await b.eval(u => findIfRequired(u).customData.html, box), '<p>Double-click to edit</p>');
    await b.key(`${mod}+Shift+z`);
    assert.equal(await b.eval(u => findIfRequired(u).customData.html, box), html);

    // Cover the right part of the box with a red rectangle: the rectangle
    // is drawn over the notes, not under them.
    await pictureReady(b, box);
    await b.shapeTool(0);
    before = await b.uids();
    await b.dragCanvas(420, 190, 560, 300);
    const [cover] = await b.newUids(before);
    assert.ok(cover, 'rectangle drawn over the box');
    await b.page.locator('#prop-fill').fill('#ff0000');
    await b.page.locator('#prop-fill').dispatchEvent('change');
    await b.deselect();
    // Slide the cover over the start of the notes: their text disappears under it.
    const textArea = [215, 200, 130, 80];
    assert.ok(await darkPixels(b, ...textArea) > 50, 'the notes show text there before');
    await b.dragObject(cover, -210, 0);
    await b.deselect();
    assert.equal(await darkPixels(b, ...textArea), 0, 'no note text shows through the cover');
    assert.ok(await b.eval(([c, x]) => pc.getObjects().indexOf(findIfRequired(c)) > pc.getObjects().indexOf(findIfRequired(x)), [cover, box]));

    // Zoom in twice: the notes are drawn again at a higher resolution.
    const w1 = await b.eval(u => findIfRequired(u)._htmlPicture.width, box);
    await b.page.click('button[title="Zoom In"]');
    await b.page.click('button[title="Zoom In"]');
    await b.page.waitForFunction(([u, w]) => findIfRequired(u)._htmlPicture.width > w, [box, w1], { timeout: 15000 });

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
