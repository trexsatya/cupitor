// A presenter connects boxes, then plays the script faster, and steps through
// it without looking at the code.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser } from './board.mjs';

after(stopBrowser);

// The connector's ends and both boxes, rounded.
const ends = b => b.eval(() => {
  const r = Math.round, l = findIfRequired('L');
  const box = u => { const o = findIfRequired(u); o.setCoords(); const k = o.getBoundingRect(); return [r(k.left), r(k.top), r(k.left + k.width), r(k.top + k.height)]; };
  return { line: [l.x1, l.y1, l.x2, l.y2].map(r), a: box('A'), c: box('C') };
});

test('arrows leave from the middle of an edge, not a corner, unless a side is named; they keep it when moved', async () => {
  const b = await openBoard();
  try {
    await b.play([
      'addRect(100, 100, 120, 60, {uid: "A"})',
      'addRect(400, 300, 120, 60, {uid: "C"})',
      'connectObjects("A", "C", "L")'
    ]);
    let { line, a, c } = await ends(b);
    // Mostly below: the middle of A's bottom edge to the middle of C's top.
    assert.deepEqual(line, [(a[0] + a[2]) / 2, a[3], (c[0] + c[2]) / 2, c[1]].map(Math.round));

    await b.play(['removeByUid("L")', 'connectObjects("A", "C", "L", {sides: {from: "bottom-right", to: "left"}})']);
    ({ line, a, c } = await ends(b));
    assert.deepEqual(line, [a[2], a[3], c[0], (c[1] + c[3]) / 2].map(Math.round), 'the named corner and edge');

    await b.play(['animate("C", {left: 600, top: 120}, {duration: 1})']);
    ({ line, a, c } = await ends(b));
    assert.deepEqual(line, [a[2], a[3], c[0], (c[1] + c[3]) / 2].map(Math.round), 'still from the corner after C moved');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('at 4× a script with waits and animations plays in about a quarter of the time; the speed is remembered', async () => {
  const b = await openBoard();
  try {
    const lines = [
      'removeByUid("A"); removeByUid("B"); addRect(100, 100, 80, 40, {uid: "A"}); addRect(100, 400, 80, 40, {uid: "B"})',
      'Promise.resolve(sleep(2))', 'animate("A", {left: 500}, {duration: 2000})', 'Promise.resolve(caption("Hello", {wait: 2000}))',
      'removeByUid("L"); connectObjects("A", "B", "L", {animate: true, duration: 2000})', 'drawOutline("B", {duration: 2000})',
      'animateViewport({zoom: 1, pan: [0, 0]}, {duration: 2000})'
    ];
    const timed = async () => { const t = Date.now(); await b.play(lines); return Date.now() - t; };
    const normal = await timed();
    // Chosen in the Play dialog's speed list.
    await b.eval(() => { const s = document.querySelector('#clearBeforePlayDialog select.play-speed'); s.value = '4'; s.dispatchEvent(new Event('change')); });
    const fast = await timed();
    assert.ok(normal > 12000, `normal speed took ${normal} ms`);
    assert.ok(fast < normal / 2.5, `4× took ${fast} ms against ${normal} ms`);
    assert.equal(await b.eval(() => findIfRequired('A').left), 500, 'the animation still ends where it should');
    // Both speed lists show it, and a new page starts at it.
    assert.deepEqual(await b.eval(() => [...document.querySelectorAll('select.play-speed')].map(s => s.value)), ['4', '4']);
    await b.page.reload();
    await b.page.waitForFunction(() => window.pc && window.playScript);
    assert.equal(await b.eval(() => window.playSpeed), 4);
    // Outside playback, animations run at their own time.
    assert.equal(await b.eval(() => playRate()), 1);
    await b.eval(() => setPlaySpeed(1));
  } finally { await b.close(); }
});

test('stepwise opens as a bar without code lines; → steps on; the lines can be shown', async () => {
  const b = await openBoard();
  try {
    await b.eval(() => {
      window.recordedScriptLines = ['// boxes', 'addRect(100, 100, 80, 40, {uid: "A"})', 'addRect(300, 100, 80, 40, {uid: "B"})'];
      playScriptStepwise();
    });
    const lines = () => b.page.isVisible('#stepwiseLines');
    assert.equal(await b.page.isVisible('#stepwisePlayDialog'), true);
    assert.equal(await lines(), false, 'no code lines at first');
    await b.page.keyboard.press('ArrowRight');
    await b.page.waitForFunction(() => window._stepwiseState && window._stepwiseState.index === 2);
    assert.equal(await b.eval(() => isFabricObject(findIfRequired("A")) && !isFabricObject(findIfRequired("B"))), true, 'one line run');
    await b.page.click('#stepwiseLinesBtn');
    assert.equal(await lines(), true);
    await b.page.click('#stepwiseNextBtn');
    await b.page.waitForFunction(() => document.getElementById('stepwiseStatus').textContent === 'Finished');
    assert.equal(await b.eval(() => isFabricObject(findIfRequired("B"))), true);
    await b.page.click('#stepwiseLinesBtn');
    assert.equal(await lines(), false);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
