// A teacher walks a class through the steps of a plan on a step list,
// drawn down the board and then across it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

after(stopBrowser);

const ITEMS = '["Plan the goal", "Gather the facts", "Sketch the design"]';
const look = b => b.eval(() => [1, 2, 3].map(i => {
  const bl = findIfRequired('TL_B' + i), t = findIfRequired('TL_T' + i);
  return [bl.fill, +bl.scaleX.toFixed(2), t.fill, t.fontWeight, Math.round(t.left), Math.round(t.top)];
}));

for (const direction of ['vertical', 'horizontal']) {
  test(`step list (${direction}): drawn along the spine, stepped through, replayed`, async () => {
    const b = await openBoard();
    try {
      const lines = [
        `stepList("TL", ${ITEMS}, 200, 150, {"direction": "${direction}", "gap": 160})`,
        'markStep("TL", 2)'
      ];
      await b.eval(l => { window.recordedScriptLines = l; }, lines);
      await b.play();
      const [home] = await b.eval(() => [[1, 2, 3].map(i => findIfRequired('TL_B' + i)).map(o => [o.left, o.top])]);
      const across = direction === 'horizontal';
      assert.deepEqual(home, across ? [[200, 150], [360, 150], [520, 150]] : [[200, 150], [200, 310], [200, 470]], 'bullets along the spine');
      const wide = await b.eval(() => { const s = findIfRequired('TL'); s.setCoords(); const r = s.getBoundingRect(); return r.width > r.height; });
      assert.equal(wide, across, 'the spine runs the chosen way');

      // Step 2: item 1 done, 2 active (bigger, label nudged off the spine), 3 pending.
      const [one, two, three] = await look(b);
      assert.deepEqual(one.slice(0, 4), ['#26a69a', 1, '#37474f', 'normal']);
      assert.deepEqual(two.slice(0, 4), ['#ff7043', 1.9, '#1565c0', 'bold']);
      assert.deepEqual(three.slice(0, 4), ['#90a4ae', 1, '#90a4ae', 'normal']);
      const nudged = across ? two[5] - one[5] : two[4] - one[4];
      assert.equal(nudged, 16, 'the active label steps away from the spine');
      if (across) assert.ok(one[5] > 150 + 12, 'labels under the bullets');
      else assert.ok(one[4] > 200 + 12, 'labels right of the bullets');

      // Step on to 3, then back to none.
      await b.eval(() => markStep('TL', 3));
      assert.deepEqual((await look(b)).map(r => r[0]), ['#26a69a', '#26a69a', '#ff7043']);
      await b.eval(() => markStep('TL', 0));
      const reset = await look(b);
      assert.deepEqual(reset.map(r => [r[0], r[1], r[3]]), [1, 2, 3].map(() => ['#90a4ae', 1, 'normal']));
      assert.equal(across ? reset[1][5] : reset[1][4], across ? one[5] : one[4], 'labels back home');

      const live = await b.snapshot();
      const replay = await replayElsewhere(lines.concat(['markStep("TL", 3)', 'markStep("TL", 0)']));
      assert.deepEqual(replay.errors, []);
      assertSameScene(replay.snapshot, live, 2);
      assert.deepEqual(b.errors, []);
    } finally { await b.close(); }
  });
}

test('step list, by its old names bulletTimeline / timelineStep: labels follow a moved list; drawing again with the same uid replaces it', async () => {
  const b = await openBoard();
  try {
    await b.play([`bulletTimeline("TL", ${ITEMS}, 200, 150, {})`]);
    // Move the whole timeline 300 px right, as a drag of all its parts would.
    await b.eval(() => pc.getObjects().filter(o => /^TL/.test(o.uid)).forEach(o => setObjectProps(o, { left: o.left + 300 })));
    const before = await look(b);
    await b.play(['timelineStep("TL", 1)']);
    const after = await look(b);
    assert.equal(after[0][4], before[0][4] + 16, 'the active label steps off from where it is now');
    assert.deepEqual(after.slice(1).map(r => r[4]), before.slice(1).map(r => r[4]), 'the others stay put');

    await b.play([`bulletTimeline("TL", ["One", "Two"], 100, 100, {"direction": "horizontal", "gap": null})`, 'timelineStep("TL", 2)']);
    assert.deepEqual(await b.eval(() => pc.getObjects().map(o => o.uid).filter(u => /^TL/.test(u)).sort()), ['TL', 'TL_B1', 'TL_B2', 'TL_T1', 'TL_T2']);
    assert.deepEqual(await b.eval(() => [findIfRequired('TL_B2').left, findIfRequired('TL_B2').fill]), [210, '#ff7043'], 'default gap; the new one is the one stepped');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('a grouped step list is one object: steps are marked inside it, it moves and goes as one', async () => {
  const b = await openBoard();
  try {
    await b.play([`stepList("TL", ${ITEMS}, 200, 150, {group: true})`, 'markStep("TL", 2)']);
    assert.deepEqual(await b.eval(() => pc.getObjects().map(o => o.uid)), ['TL'], 'one object on the board');
    const [one, two] = await look(b);
    assert.deepEqual([one[0], two[0], two[1], two[3]], ['#26a69a', '#ff7043', 1.9, 'bold']);
    await b.play(['animate("TL", {left: 700}, {duration: 1})', 'markStep("TL", 3)']);
    assert.deepEqual((await look(b)).map(r => r[0]), ['#26a69a', '#26a69a', '#ff7043'], 'marked where it now is');
    await b.play(['stepList("TL", ["One"], 100, 100, {group: true})']);
    assert.deepEqual(await b.eval(() => pc.getObjects().map(o => o.uid)), ['TL'], 'drawn again: the old one went');
    await b.play(['removeByUid("TL")']);
    assert.deepEqual(await b.eval(() => pc.getObjects().length), 0);
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

