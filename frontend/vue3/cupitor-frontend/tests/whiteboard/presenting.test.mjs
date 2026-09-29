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
