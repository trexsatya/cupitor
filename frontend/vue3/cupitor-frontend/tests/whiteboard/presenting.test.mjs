// A teacher presents: reveals three cards left to right, then zooms in and
// spotlights one of them.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

after(stopBrowser);

async function drawRect(b, x1, y1, x2, y2) {
  await b.shapeTool(0);
  const before = await b.uids();
  await b.dragCanvas(x1, y1, x2, y2);
  const [uid] = await b.newUids(before);
  await b.deselect();
  return uid;
}

// How much of each object a reveal currently shows (1 = all of it).
const shown = (b, uids) => b.eval(u => u.map(x => {
  const o = findIfRequired(x), c = o.clipPath;
  return c ? Math.round(100 * c.width / o.width) / 100 : 1;
}), uids);

test('presenting: reveal cards from the Animate panel, spotlight while zoomed, replay', async () => {
  const b = await openBoard();
  try {
    const cards = [];
    for (const x of [150, 350, 550]) cards.push(await drawRect(b, x, 200, x + 150, 300));

    // Select all three with a drag, pick Reveal (left → right), Start.
    await b.dragCanvas(120, 170, 740, 330);
    await b.page.selectOption('#prop-anim-type', 'reveal:left');
    await b.page.click('#prop-anim-toggle');
    // Part-way through, every card is partly shown …
    await b.page.waitForFunction(u => u.every(x => { const o = findIfRequired(x), c = o.clipPath; return c && c.width > 0 && c.width < o.width; }), cards, { timeout: 5000 });
    // … and at the end the clip is gone.
    await b.page.waitForFunction(u => u.every(x => !findIfRequired(x).clipPath), cards, { timeout: 5000 });
    assert.deepEqual(await shown(b, cards), [1, 1, 1]);

    // Zoom in, select the middle card and spotlight it with a circle.
    await b.page.click('button[title="Zoom In"]');
    await b.select(cards[1]);
    await b.page.selectOption('#prop-anim-type', 'spotlight:circle');
    await b.page.click('#prop-anim-toggle');
    await b.page.waitForSelector('#spotlight-overlay circle', { state: 'attached' });
    // Where the hole is on screen vs where the card is on screen.
    const spot = await b.eval(u => {
      const svg = document.querySelector('#spotlight-overlay'), c = svg.querySelector('circle');
      const p = svg.createSVGPoint(); p.x = +c.getAttribute('cx'); p.y = +c.getAttribute('cy');
      const s = p.matrixTransform(svg.getScreenCTM());
      const o = findIfRequired(u), m = fabric.util.transformPoint(o.getCenterPoint(), pc.viewportTransform);
      const el = pc.upperCanvasEl.getBoundingClientRect();
      return { hole: [s.x, s.y], card: [el.left + m.x, el.top + m.y] };
    }, cards[1]);
    assert.ok(Math.hypot(spot.hole[0] - spot.card[0], spot.hole[1] - spot.card[1]) < 2, `hole on the card: ${JSON.stringify(spot)}`);

    // Escape ends it; the time it ran is recorded.
    await b.page.waitForTimeout(400);
    await b.key('Escape');
    await b.page.waitForSelector('#spotlight-overlay', { state: 'detached' });
    const lines = await b.script();
    assert.ok(lines.some(l => /^reveal\(/.test(l)), 'reveal recorded');
    assert.ok(lines.some(l => /spotlight/.test(l) && /stopAnim/.test(l)), 'spotlight recorded with its stop');

    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay_ = {};
    const replay = await replayElsewhere(lines, async r => { replay_.spotlightLeft = await r.eval(() => !!document.getElementById('spotlight-overlay')); });
    Object.assign(replay, replay_);
    assert.deepEqual(replay.errors, []);
    assert.equal(replay.spotlightLeft, false, 'the replayed spotlight ends too');
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});

test('presenting: draw outlines from the Animate panel; Escape finishes; replay waits for it', async () => {
  const b = await openBoard();
  try {
    const cards = [];
    for (const x of [150, 350]) cards.push(await drawRect(b, x, 200, x + 150, 300));
    await b.select(cards[0]);
    await b.page.locator('#prop-fill').fill('#90caf9');
    await b.page.locator('#prop-fill').dispatchEvent('change');
    await b.deselect();
    await b.textMenu('Text in rectangle');
    let before = await b.uids();
    await b.click(560, 220);
    await b.typeInPopup('Joy');
    const [note] = await b.newUids(before);
    const all = [...cards, note];
    const looks = () => b.eval(u => u.map(x => { const o = findIfRequired(x); const parts = o._objects || [o];
      return parts.map(p => [p.type, p.fill, p.stroke, p.strokeWidth, p.strokeDashArray, p.opacity]); }), all);
    const original = await looks();

    // Select them all, pick Draw outline, Start.
    const start = async () => {
      await b.dragCanvas(120, 170, 760, 330);
      await b.page.selectOption('#prop-anim-type', 'drawOutline');
      await b.page.click('#prop-anim-toggle');
    };
    await start();
    // Part-way: each outline partly drawn, the fill and the text not yet in.
    await b.page.waitForFunction(u => u.every(x => {
      const o = findIfRequired(x), s = o._drawOutline;
      return s && s.traced.every(t => t.o.strokeDashOffset > 0.1 * t.length && t.o.strokeDashOffset < 0.9 * t.length);
    }), all, { timeout: 5000 });
    const mid = await b.eval(u => u.map(x => { const s = findIfRequired(x)._drawOutline;
      return { fills: s.fills.map(f => f.alpha ? new fabric.Color(f.o.fill).getAlpha() : 0), faded: s.faded.map(f => f.o.opacity) }; }), all);
    mid.forEach(m => { assert.ok(m.fills.every(a => a === 0), `fill hidden: ${JSON.stringify(m)}`); assert.ok(m.faded.every(v => v === 0), 'text hidden'); });
    // At the end everything is exactly as it was.
    await b.page.waitForFunction(u => u.every(x => !findIfRequired(x)._drawOutline), all, { timeout: 5000 });
    assert.deepEqual(await looks(), original);

    // Escape part-way finishes at once.
    await start();
    await b.page.waitForFunction(u => findIfRequired(u)._drawOutline, cards[0], { timeout: 5000 });
    await b.key('Escape');
    assert.equal(await b.eval(u => u.some(x => findIfRequired(x)._drawOutline), all), false, 'stopped');
    assert.deepEqual(await looks(), original);

    // Something drawn afterwards: on replay it only comes once the drawing is done.
    const last = await drawRect(b, 150, 400, 250, 460);
    const lines = await b.script();
    assert.ok(lines.some(l => /^drawOutline\(/.test(l)), 'recorded');
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines, async r => {
      assert.equal(await r.eval(() => window.__drawingWhenAdded), false, 'next line waited for the drawing');
    }, r => r.eval(u => pc.on('object:added', e => {
      if (e.target.uid === u) window.__drawingWhenAdded = pc.getObjects().some(o => o._drawOutline);
    }), last));
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});

test('presenting: outline drawing of images, arrows, scaled groups and fill-only shapes ends as it began', async () => {
  const b = await openBoard();
  try {
    const kinds = await b.eval(async () => {
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEIGBkZGRgAAB0IAwEV4bBGAAAAAElFTkSuQmCC';
      const img = await fabric.FabricImage.fromURL(png); img.set({ left: 60, top: 60, scaleX: 40, scaleY: 40 }); img.uid = 'IMG1'; pc.add(img);
      const arrow = new fabric.LineArrow([300, 80, 460, 160], { stroke: '#333', strokeWidth: 2 }); arrow.uid = 'A1'; pc.add(arrow);
      const g = textInRect('Scaled', 520, 60, {}, { stroke: '#2e7d32', strokeWidth: 3 }, 'TR1'); g.set({ scaleX: 2, scaleY: 2 }); g._objects.forEach(o => { if (o.stroke) o.strokeUniform = true; }); pc.add(g);
      const d = textInDiamond('Fill only', 60, 260, {}, {}); d.uid = 'D1'; pc.add(d);
      pc.renderAll();
      return ['IMG1', 'A1', 'TR1', 'D1'];
    });
    const looks = () => b.eval(u => u.map(x => { const o = findIfRequired(x);
      return (o._objects || [o]).map(p => [p.type, p.fill, p.stroke, p.strokeWidth, p.strokeDashArray, p.strokeDashOffset, p.opacity]); }), kinds);
    const original = await looks();

    await b.eval(u => { window.__done = drawOutline(u, { duration: 1500 }); }, kinds);
    await b.page.waitForTimeout(600);
    const mid = await b.eval(() => {
      const img = findIfRequired('IMG1'), arrow = findIfRequired('A1'), g = findIfRequired('TR1');
      const rect = g._objects.find(o => o.stroke), s = g.getObjectScaling();
      return {
        image: [img.opacity, img.stroke, img.strokeDashArray],
        arrowHead: arrow._innerAlpha,
        // with strokeUniform the dash is in scaled units: it must cover the scaled outline
        groupDash: rect.strokeUniform ? Math.round(rect.strokeDashArray[0] / (_outlineLength(rect) * (s.x + s.y) / 2) * 100) : 'n/a',
        groupPart: rect.strokeDashOffset / rect.strokeDashArray[0]
      };
    });
    assert.deepEqual(mid.image, [0, null, null], 'the image fades, no outline drawn round it');
    assert.equal(mid.arrowHead, 0, 'arrowhead waits for its line');
    assert.equal(mid.groupDash, 100, 'the dash covers the scaled outline');
    assert.ok(mid.groupPart > 0.2 && mid.groupPart < 0.9, `part-way: ${mid.groupPart}`);
    await b.eval(() => window.__done);
    assert.deepEqual(await looks(), original, 'everything as it was');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
