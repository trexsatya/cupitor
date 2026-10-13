// A narrated scene played through the page's playback session: cues written
// as script lines, the seek bar at the top while it plays, and a cone drawn
// for "what this person sees".
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser } from './board.mjs';

after(stopBrowser);

test('a cone opens from its tip towards its angle, its far end bulging away; drawn again with its uid it is replaced', async () => {
  const b = await openBoard();
  try {
    const box = () => b.eval(() => { const c = findIfRequired('C'); c.setCoords(); const r = c.getBoundingRect(); return [r.left, r.top, r.left + r.width, r.top + r.height].map(Math.round); });
    // Opening right: half-width at the far end 300·tan 20° ≈ 109; the rim adds 0.25 of that beyond 700.
    await b.eval(() => addCone(400, 300, { uid: 'C', length: 300, span: 40 }));
    const [l, t, r, bt] = await box();
    assert.ok(Math.abs(l - 400) <= 3, `tip at the left (${l})`);
    assert.ok(Math.abs(r - 727) <= 4, `far end bulges past 700 (${r})`);
    assert.ok(Math.abs((t + bt) / 2 - 300) <= 2, 'centred on the tip\'s line');
    assert.ok(bt - t > 2 * 109, 'the sides bow out beyond the straight ones');
    // Opening down, half faded: replaced in place, opacity kept, one object.
    await b.eval(() => { findIfRequired('C').set('opacity', 0.5); addCone(400, 300, { uid: 'C', angle: 90, length: 300, span: 40 }); });
    const [l2, t2, r2, b2] = await box();
    assert.ok(Math.abs(t2 - 300) <= 3 && Math.abs(b2 - 627) <= 4 && Math.abs((l2 + r2) / 2 - 400) <= 2, `turned to open downwards (${[l2, t2, r2, b2]})`);
    assert.deepEqual(await b.eval(() => [pc.getObjects().filter(o => o.uid === 'C').length, findIfRequired('C').opacity]), [1, 0.5]);
    // No rim, no curve: a plain triangle reaching exactly 700.
    await b.eval(() => addCone(400, 300, { uid: 'C', rim: 0, curve: 0, length: 300, span: 40 }));
    const [, t3, r3, b3] = await box();
    assert.ok(Math.abs(r3 - 700) <= 3 && Math.abs((b3 - t3) - 218) <= 6, `flat far end (${[r3, b3 - t3]})`);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

const TIMELINE = {
  start: ["addLabel('TITLE', 700, 120, {uid: 'title'})"],
  cues: [
    { id: 'one', at: 0.4, lines: ["Promise.resolve(addLabel('ONE', 300, 350, {uid: 'one', boundary: 'solid'})).then(l => drawOutline(l, {duration: 3000}))"] },
    { id: 'cone', at: 3, lines: ["addCone(300, 400, {uid: 'view', angle: 0, length: 250})", "Promise.resolve(sleep(5))"] },
    { id: 'two', at: 6, lines: ["// the second idea", "addLabel('TWO', 800, 350, {uid: 'two'})"] }
  ],
  captions: [{ start: 0, end: 12, text: 'Hela scenen.' }],
  chapters: [{ id: 'opening', at: 0, title: 'Opening' }, { id: 'view', at: 3, title: 'The view' }, { id: 'second', at: 6, title: 'Second idea' }]
};

test('script cues play at their times; seeking (bar keys, chapter list, slider) rebuilds the scene with the cues before it run instantly; Escape stops and hides the bar', async () => {
  const b = await openBoard();
  try {
    const on = () => b.eval(() => ['title', 'one', 'view', 'two'].filter(u => isFabricObject(findIfRequired(u))));
    const bar = () => b.eval(() => ({ shown: document.body.classList.contains('play-session'), time: document.querySelector('#play-session-bar .time').textContent, chapter: document.querySelector('#play-session-bar select').value }));
    await b.eval(t => { window.S = playbackSession(); S.setTimeline(scriptTimeline(t)); window.drawOutlineBefore = window.drawOutline; return S.play(); }, TIMELINE);
    await b.page.waitForTimeout(800);
    assert.deepEqual(await on(), ['title', 'one'], 'the opening and the first cue');
    let shown = await bar();
    assert.equal(shown.shown, true, 'the bar is there while it plays');
    assert.match(shown.time, /^0:00 \/ 0:12$/);
    assert.equal(shown.chapter, 'opening');

    // ] goes to the next chapter: the cone cue (with its 5 s sleep) is reached by seeking, so it runs at once.
    const t0 = Date.now();
    await b.page.keyboard.press(']');
    await b.page.waitForFunction(() => S.chapterAt(S.time).id === 'view' && isFabricObject(findIfRequired('view')));
    assert.ok(Date.now() - t0 < 2500, 'the cue before the new time was not waited out');
    assert.equal(await b.eval(() => window.drawOutline === window.drawOutlineBefore), true, 'animations are themselves again afterwards');
    assert.deepEqual(await on(), ['title', 'one', 'view']);

    // → five seconds on: past the second idea.
    await b.page.keyboard.press('ArrowRight');
    await b.page.waitForFunction(() => S.time >= 8 && isFabricObject(findIfRequired('two')));
    shown = await bar();
    assert.equal(shown.chapter, 'second');

    // Paused, the slider back to the start: the scene as it is then (only the opening), still paused.
    await b.page.click('#play-pause-btn', { force: true });
    await b.page.locator('#play-session-bar input[type=range]').fill('0.1');
    await b.page.waitForFunction(() => S.time < 1 && !isFabricObject(findIfRequired('two')));
    assert.deepEqual(await on(), ['title']);
    assert.equal(await b.eval(() => S.state), 'paused');

    // The chapter list.
    await b.page.selectOption('#play-session-bar select', 'second');
    await b.page.waitForFunction(() => isFabricObject(findIfRequired('two')));
    assert.deepEqual(await on(), ['title', 'one', 'view', 'two']);
    assert.equal(await b.eval(() => pc.getObjects().filter(o => o.uid === 'two').length), 1, 'no duplicate from seeking twice');

    await b.page.keyboard.press('Escape');
    await b.page.waitForFunction(() => S.state === 'stopped');
    assert.equal((await bar()).shown, false, 'the bar goes with play mode');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('a cue line that fails is reported with its number, by playing and by seeking past it', async () => {
  const b = await openBoard();
  try {
    const r = await b.eval(async () => {
      const s = playbackSession();
      const played = [];
      s.on('cue', c => played.push([c.cue, c.error]));
      s.setTimeline(scriptTimeline({ cues: [{ id: 'bad', at: 0.2, lines: ['// fine', 'noSuchFunction(1)'] }], captions: [{ start: 0, end: 0.6, text: 'x' }] }));
      await s.play();
      await new Promise(r => setTimeout(r, 1000));
      const seek = await s.seek(0.5);
      return { played, seek: seek.problems.map(p => [p.cue, p.error.message]) };
    });
    assert.deepEqual(r.played.map(p => p[0]), ['bad']);
    assert.match(r.played[0][1], /^line 2 \(noSuchFunction\(1\)\): noSuchFunction is not defined/);
    assert.equal(r.seek[0][0], 'bad');
    assert.match(r.seek[0][1], /^line 2 \(noSuchFunction\(1\)\): noSuchFunction is not defined/);
  } finally { await b.close(); }
});

test('seeking while paused rebuilds at once and stays paused; [ before the first chapter goes to the start', async () => {
  const b = await openBoard();
  try {
    await b.eval(() => {
      window.S = playbackSession();
      S.setTimeline(scriptTimeline({
        cues: [
          { id: 'a', at: 0.2, lines: ["Promise.resolve(addLabel('A', 300, 300, {uid: 'a', boundary: 'solid'})).then(l => drawOutline(l, {duration: 800}))"] },
          { id: 'b', at: 3, lines: ["animate('a', {left: 600}, {duration: 800})"] }
        ],
        captions: [{ start: 0, end: 10, text: 'x' }],
        chapters: [{ id: 'later', at: 2, title: 'Later' }]
      }));
      return S.play();
    });
    await b.page.waitForTimeout(500);
    await b.page.click('#play-pause-btn', { force: true });
    const r = await b.eval(async () => {
      const t0 = performance.now();
      const out = await Promise.race([S.seek(4).then(() => 'done'), new Promise(r => setTimeout(() => r('hung'), 3000))]);
      return { out, ms: performance.now() - t0, state: S.state, paused: window._playPaused, left: Math.round(findIfRequired('a').left), time: S.time };
    });
    assert.equal(r.out, 'done', 'the rebuild does not wait for Resume');
    assert.ok(r.ms < 1500, `quick (${Math.round(r.ms)} ms)`);
    assert.deepEqual([r.state, r.paused, r.time], ['paused', true, 4]);
    assert.ok(Math.abs(r.left - 600) <= 2, `the moved state (${r.left})`);
    await b.eval(() => S.seek(1));
    await b.page.click('#play-pause-btn', { force: true });
    await b.page.keyboard.press('[');
    await b.page.waitForFunction(() => S.time < 0.5);
    await b.page.keyboard.press('Escape');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('a seek in the middle of a cue\'s animation stops it: nothing changes the rebuilt scene afterwards; cue lines that give a promise are waited for', async () => {
  const b = await openBoard();
  try {
    const r = await b.eval(async () => {
      const s = window.S = playbackSession();
      const marks = [];
      window.mark = m => marks.push([m, Math.round(s.time * 10) / 10]);
      s.setTimeline(scriptTimeline({
        start: ["addLabel('M', 100, 300, {uid: 'm'})"],
        cues: [
          { id: 'slide', at: 0.2, lines: ["animate('m', {left: 900}, {duration: 3000})"] },
          { id: 'waits', at: 0.3, lines: ['mark("before")', 'sleep(0.6)', 'mark("after")'] }
        ],
        captions: [{ start: 0, end: 10, text: 'x' }]
      }));
      await s.play();
      await new Promise(r => setTimeout(r, 1200)); // the slide is a third of the way
      const playedMarks = marks.slice();
      await s.seek(5); // past it: rebuilt with the slide's end state, and nothing after it plays
      const end = Math.round(findIfRequired('m').left);
      await new Promise(r => setTimeout(r, 600));
      const later = Math.round(findIfRequired('m').left);
      const running = fabric.runningAnimations.length;
      await s.stop();
      return { end, later, running, marks: playedMarks };
    });
    assert.equal(r.later, r.end, `the cut-short slide moved nothing after the seek (${r.end} → ${r.later})`);
    assert.equal(r.running, 0, 'no animation left running');
    assert.deepEqual(r.marks.map(m => m[0]), ['before', 'after']);
    assert.ok(r.marks[1][1] - r.marks[0][1] >= 0.5, `sleep(0.6) was waited for (${JSON.stringify(r.marks)})`);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
