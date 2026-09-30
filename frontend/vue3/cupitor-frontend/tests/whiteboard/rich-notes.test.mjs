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
    await b.dragCanvas(420, 205, 560, 300); // starting on the box
    const [cover] = await b.newUids(before);
    assert.ok(cover, 'rectangle drawn over the box');
    await b.page.locator('#prop-fill').fill('#ff0000');
    await b.page.locator('#prop-fill').dispatchEvent('change');
    await b.deselect();
    // Slide the cover over the start of the notes: their text disappears under it.
    const textArea = [215, 210, 130, 70];
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

test('rich notes: edit a box in the editor, CSS in Source; cancel, apply, undo, replay', async () => {
  const b = await openBoard();
  try {
    await b.tool('htmlBox');
    const before = await b.uids();
    await b.click(200, 200);
    const [box] = await b.newUids(before);
    await b.page.keyboard.press('Escape');
    await b.select(box);
    const html = () => b.eval(u => findIfRequired(u).customData.html, box);
    const original = await html();
    assert.equal(original, '<p>Double-click to edit</p>', 'placing a box and pressing Escape keeps its text');

    // Opens with the box's content, the editing area the box's width.
    const open = async () => {
      await b.page.click('#prop-html-source');
      await b.page.waitForFunction(() => { const e = CKEDITOR.instances.htmlBoxEditorArea; return e && e.status === 'ready' && !_htmlBoxEditor.loading && e.document.$.getElementById('html-box-editor-look'); }, null, { timeout: 30000 });
    };
    await open();
    assert.match(await b.eval(() => CKEDITOR.instances.htmlBoxEditorArea.getData()), /Double-click to edit/);
    assert.equal(await b.eval(u => Math.round(CKEDITOR.instances.htmlBoxEditorArea.document.getBody().$.getBoundingClientRect().width), box), 320);

    // Apply with no edits records nothing.
    const linesBefore = (await b.script()).length;
    await b.page.click('#htmlBoxEditorDialog button:text-is("Apply")');
    assert.equal((await b.script()).length, linesBefore, 'nothing recorded');
    assert.equal(await html(), original);
    await open();

    // Its dropdowns and dialogs show above it; keys in them stay off the canvas.
    const onTop = sel => b.eval(sel => {
      const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null || getComputedStyle(e).display !== 'none');
      if (!el) return 'missing';
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el === hit || el.contains(hit);
    }, sel);
    await b.page.click('#htmlBoxEditorDialog .cke_combo__font .cke_combo_button');
    await b.page.waitForSelector('.cke_panel', { state: 'visible' });
    assert.equal(await onTop('.cke_panel'), true, 'font list above the dialog');
    await b.page.keyboard.press('Escape');
    await b.page.click('#htmlBoxEditorDialog .cke_button__link');
    await b.page.waitForSelector('.cke_dialog', { state: 'visible' });
    assert.equal(await onTop('.cke_dialog'), true, 'link dialog above the dialog');
    await b.page.click('.cke_dialog .cke_dialog_ui_button_cancel');
    await b.page.click('#htmlBoxEditorDialog .cke_button__link');
    await b.page.waitForSelector('.cke_dialog', { state: 'visible' });
    await b.page.focus('.cke_dialog .cke_dialog_ui_button_cancel');
    await b.page.keyboard.press('Delete');
    assert.equal(await b.eval(u => isFabricObject(findIfRequired(u)), box), true, 'Delete in a CKEditor dialog leaves the box');
    await b.page.click('.cke_dialog .cke_dialog_ui_button_cancel');

    // The toolbar formats what's selected, and the box follows.
    await b.eval(() => { const e = CKEDITOR.instances.htmlBoxEditorArea; e.focus(); e.execCommand('selectAll'); });
    await b.page.click('#htmlBoxEditorDialog .cke_button__bold');
    await b.page.waitForFunction(u => /<strong>/.test(findIfRequired(u).customData.html), box, { timeout: 5000 });

    // Source: type HTML with CSS; the box follows while typing; Cancel goes back.
    const source = async text => {
      await b.page.click('#htmlBoxEditorDialog .cke_button__source');
      const ta = b.page.locator('#htmlBoxEditorDialog textarea.cke_source');
      await ta.fill('');
      await ta.pressSequentially(text.slice(0, 20));
      await ta.fill(text); // the rest at once
      await ta.dispatchEvent('input');
    };
    await source('<p>draft</p>');
    assert.match(await html(), /draft/, 'box previews the source');
    await b.page.click('#htmlBoxEditorDialog button:text-is("Cancel")');
    assert.equal(await html(), original, 'cancel puts it back');

    const styled = '<style>.hbx-deep{letter-spacing:2px}</style><div class="hbx-deep" style="font:bold 48px Arial;color:#fff;text-shadow:1px 1px 0 #999,2px 2px 0 #888,3px 3px 0 #777,4px 4px 6px rgba(0,0,0,.4)">Deep</div>';
    await open();
    await source(styled);
    await b.page.click('#htmlBoxEditorDialog button:text-is("Apply")');
    const applied = await html();
    assert.match(applied, /text-shadow:1px 1px 0 #999/, 'inline CSS kept');
    assert.match(applied, /<style>\.hbx-deep\{letter-spacing:2px\}<\/style>/, '<style> block kept');
    assert.match(applied, />Deep</);
    assert.equal(await b.eval(() => document.getElementById('htmlBoxEditorDialog').style.display), 'none', 'editor closed');
    await pictureReady(b, box);

    // Undo goes back to the original, redo to the styled box.
    await b.deselect();
    await b.key(`${mod}+z`);
    assert.equal(await html(), original);
    await b.key(`${mod}+Shift+z`);
    assert.equal(await html(), applied);

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
