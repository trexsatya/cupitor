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

test('typed and handwritten labels: in a character or stroke at a time, then whole; a handwritten one renamed stays in its place, its box fitting', async () => {
  const b = await openBoard();
  try {
    await b.eval(() => {
      window.recordedScriptLines = [
        'Promise.resolve(typeIn(addLabel("WHO?", 300, 200, {uid: "t", boundary: "solid"}), {duration: 2000}))',
        'Promise.resolve(handFont()).then(() => writeIn(addLabel("VEM SÄTTER RAMEN?", 600, 400, {uid: "w", boundary: "solid", hand: true}), {duration: 2000}))'
      ];
      playScript();
    });
    // Part way: some of the text, with the caret; then part of the strokes.
    await b.page.waitForTimeout(900);
    const typing = await b.eval(() => findIfRequired('t').getObjects()[1].text);
    assert.ok(/^W?H?O?\|$/.test(typing) && typing.length < 5, `part typed: ${typing}`);
    await b.page.waitForFunction(() => isFabricObject(findIfRequired('w')));
    await b.page.waitForTimeout(800);
    const hidden = await b.eval(() => findIfRequired('w').getObjects()[1].getObjects().filter(p => p.strokeDashOffset > 0).length);
    assert.ok(hidden > 0, 'some strokes still to write');
    await b.page.waitForFunction(() => !window.isRecordingPlayback);
    assert.equal(await b.eval(() => findIfRequired('t').getObjects()[1].text), 'WHO?');
    assert.equal(await b.eval(() => findIfRequired('w').getObjects()[1].getObjects().filter(p => p.strokeDashOffset > 0).length), 0, 'all written');

    // Renamed (also when shrunk): the same centre, the box round the new strokes.
    const look = () => b.eval(() => {
      const g = findIfRequired('w'), [r, h] = g.getObjects();
      g.setCoords(); h.setCoords();
      const c = g.getCenterPoint(), hc = h.getCenterPoint();
      return { centre: [Math.round(c.x), Math.round(c.y)], strokes: [Math.round(hc.x), Math.round(hc.y)], box: Math.round(r.width), text: Math.round(h.width) };
    });
    const before = await look();
    await b.eval(() => { tagState('written', ['w']); setLabelText('w', 'VEM SÄTTER RAMEN NU?'); });
    const after = await look();
    assert.deepEqual(after.centre, before.centre);
    assert.deepEqual(after.strokes, after.centre, 'the strokes stay in the label');
    assert.ok(after.text > before.text && after.box === after.text + 24, `the box fits the longer text: ${JSON.stringify(after)}`);
    // Going back to the tag brings back the old strokes in their box.
    await b.eval(() => revertState('written', { duration: 0 }));
    assert.deepEqual(await look(), before, 'back to the tagged text, strokes and box');
    await b.eval(() => { setObjectProps('w', { scaleX: 0.5, scaleY: 0.5 }); setLabelText('w', 'VEM?'); });
    const small = await look();
    assert.deepEqual(small.strokes, small.centre, 'shrunk, the strokes still stay in the label');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('handwriting: a middle dot is a dot, missing punctuation is written with what the font has, unknown characters leave a gap', async () => {
  const b = await openBoard();
  try {
    const look = await b.eval(async () => {
      await handFont();
      const strokes = t => makeHandText(t, { fontSize: 40 }).getObjects().filter(p => p._handD);
      const width = t => makeHandText(t, { fontSize: 40 }).width;
      return {
        middot: strokes('·').map(p => p._handD), question: strokes('?').length,
        dash: strokes('–').length === strokes('-').length, ellipsis: strokes('…').length === strokes('...').length,
        unknown: strokes('日').length, dots: width('...') > width('.') * 3,
        // Letters keep their own width; an accent typed apart joins its letter; zero-width characters add nothing.
        letters: width('ll') < width('..') * 0.8, // only punctuation gets a cell
        decomposed: width('e\u0301') === width('\u00e9'), zeroWidth: width('a\u200Bb') === width('ab')
      };
    });
    assert.equal(look.middot.length, 1);
    assert.match(look.middot[0], / a /, 'a little circle, not the ? glyph');
    assert.equal(look.dash, true);
    assert.equal(look.ellipsis, true);
    assert.equal(look.unknown, 0, 'no ? for a character the font lacks');
    assert.equal(look.dots, true, 'dots each get room of their own');
    assert.equal(look.letters, true, 'narrow letters are not padded');
    assert.equal(look.decomposed, true);
    assert.equal(look.zeroWidth, true);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('pause and resume: nothing moves or moves on while paused, then it carries on from the same moment; Space and the button toggle it; Esc while paused stops', async () => {
  const b = await openBoard();
  try {
    await b.eval(() => {
      window.recordedScriptLines = [
        'addRect(100, 100, 80, 40, {uid: "A"})',
        'animate("A", {left: 900}, {duration: 2000})',
        'Promise.resolve(sleep(1))',
        'addRect(100, 300, 80, 40, {uid: "B"})'
      ];
      playScript();
    });
    await b.page.waitForFunction(() => isFabricObject(findIfRequired('A')) && findIfRequired('A').left > 200);
    await b.page.keyboard.press(' ');
    assert.equal(await b.page.isVisible('#play-pause-btn .when-paused'), true, 'the button offers Resume');
    const at = await b.eval(() => findIfRequired('A').left);
    await b.page.waitForTimeout(2500); // longer than the whole animation
    assert.equal(await b.eval(() => findIfRequired('A').left), at, 'still while paused');
    assert.equal(await b.eval(() => isFabricObject(findIfRequired('B'))), false, 'no line runs while paused');
    await b.page.click('#play-pause-btn');
    await b.page.waitForFunction(() => isFabricObject(findIfRequired('B')), null, { timeout: 8000 });
    assert.equal(await b.eval(() => findIfRequired('A').left), 900, 'the animation finished where it should');
    await b.page.waitForFunction(() => !document.body.classList.contains('play-mode'));

    // Paused, then Esc: playback stops and the board is not left frozen.
    await b.eval(() => { window.recordedScriptLines = ['Promise.resolve(sleep(1))', 'addRect(100, 500, 80, 40, {uid: "C"})']; playScript(); });
    await b.page.keyboard.press(' ');
    await b.page.keyboard.press('Escape');
    assert.equal(await b.eval(() => window._playPaused), false);
    await b.page.waitForTimeout(1500);
    assert.equal(await b.eval(() => isFabricObject(findIfRequired('C'))), false, 'the rest was skipped');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
