// A teacher tags how a slide looks, rearranges it (moves, recolours, deletes),
// then reverts it to the tag, undoes and redoes that, and replays the lesson.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, assertSameScene } from './board.mjs';

after(stopBrowser);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

async function drawRect(b, x1, y1, x2, y2) {
  await b.shapeTool(0);
  const before = await b.uids();
  await b.dragCanvas(x1, y1, x2, y2);
  const [uid] = await b.newUids(before);
  await b.deselect();
  return uid;
}
const look = (b, u) => b.eval(x => {
  const o = findIfRequired(x);
  if (!isFabricObject(o) || !o.canvas) return 'gone';
  o.setCoords();
  const r = o.getBoundingRect();
  return [...[r.left, r.top, r.width, r.height].map(Math.round), o.fill, o.visible];
}, u);
const reverted = b => b.page.waitForFunction(() => !pc.getObjects().some(o => o._animating || (o.__animations && o.__animations.length)), null, { timeout: 5000 })
  .then(() => b.page.waitForTimeout(900));

test('tagging: tag a selection, change it, revert to the tag, undo, redo, replay', async () => {
  const b = await openBoard();
  try {
    const a = await drawRect(b, 150, 150, 270, 220);
    const c = await drawRect(b, 400, 300, 500, 380);
    const start = [await look(b, a), await look(b, c)];

    // Tag both as "start".
    await b.selectMany([a, c]);
    await b.page.fill('#prop-tag-name', 'start');
    await b.page.click('#prop-tag-add');
    assert.deepEqual(await b.eval(() => stateTags()), [{ name: 'start', uids: [a, c] }]);
    assert.equal(await b.page.inputValue('#prop-tag-list'), 'start');
    assert.equal(start[0][0], (await look(b, a))[0], 'tagging changes nothing');

    // Move a, recolour c and then delete it.
    await b.deselect();
    await b.dragObject(a, 200, 120);
    await b.deselect();
    await b.select(c);
    await b.page.locator('#prop-fill').fill('#ff0000');
    await b.page.locator('#prop-fill').dispatchEvent('change');
    await b.eval(() => document.activeElement.blur());
    await b.key('Delete');
    const changed = [await look(b, a), await look(b, c)];
    assert.notDeepEqual(changed[0], start[0]);
    assert.equal(changed[1], 'gone');

    // Revert to the tag: a goes back, c comes back as it was.
    await b.select(a);
    await b.page.selectOption('#prop-tag-list', 'start');
    await b.page.click('#prop-tag-revert');
    await reverted(b);
    assert.deepEqual([await look(b, a), await look(b, c)], start, 'both as tagged');

    // Undo puts things as they were before the revert; redo reverts again.
    await b.deselect();
    await b.key(`${mod}+z`);
    assert.deepEqual([await look(b, a), await look(b, c)], changed, 'undo');
    await b.key(`${mod}+Shift+z`);
    assert.deepEqual([await look(b, a), await look(b, c)], start, 'redo');

    const lines = await b.script();
    assert.ok(lines.includes(`tagState("start", ${JSON.stringify([a, c])})`), lines.join('\n'));
    assert.ok(lines.includes('revertState("start", {"duration":600})'));
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assertSameScene(replay.snapshot, live, 2);

    // Forgetting the tag takes it off the list.
    await b.select(a);
    await b.page.click('#prop-tag-remove');
    assert.deepEqual(await b.eval(() => stateTags()), []);
    assert.equal(await b.page.locator('#prop-tag-list option').count(), 0);
  } finally { await b.close(); }
});

test('tagging: a line between two objects hides and shows with them on revert, undo and replay', async () => {
  const b = await openBoard();
  try {
    await b.play([
      'addRect(100,100,80,40,{"uid":"A"})',
      'addRect(400,100,80,40,{"uid":"B"})',
      'connectObjects("A", "B", "L1")',
      'tagState("shown", ["A"])',
      'hideObject("A")',
      'tagState("hidden", ["A"])',
      'showObject("A")',
      'revertState("hidden", {"duration": 0})'
    ]);
    const seen = () => b.eval(() => ['A', 'L1'].map(u => findIfRequired(u).visible));
    assert.deepEqual(await seen(), [false, false], 'reverted to hidden: its line too');
    const { line } = await b.eval(() => { const { command } = _revertState('shown', { duration: 0 }); undoManager.push(command); return { line: 1 }; });
    assert.ok(line);
    assert.deepEqual(await seen(), [true, true], 'reverted to shown: its line too');
    await b.deselect();
    await b.key(`${mod}+z`);
    assert.deepEqual(await seen(), [false, false], 'undo');
    assert.match((await b.script()).at(-1), /^hideObject\("A"\);/, 'undo records the hide that takes the line along');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});

test('tagging: a group, a hidden object and a text come back as tagged', async () => {
  const b = await openBoard();
  try {
    const lines = [
      'addRect(100,100,80,40,{"uid":"R1","fill":"#90caf9"})',
      'addRect(200,100,80,40,{"uid":"R2","fill":"#a5d6a7"})',
      'groupObjects(["R1","R2"], "G1")',
      'pc.add(textbox({"text":"Before","left":100,"top":300,"uid":"T1"}))',
      'tagState("intro", ["G1","T1"])',
      'animate("G1", {"left": 400, "angle": 30}, {"duration": 100})',
      'setObjectProps("R1", {"fill": "#000000"})',
      'setObjectProps("T1", {"text": "After", "visible": false})',
      'revertState("intro", {"duration": 0})'
    ];
    await b.play(lines);
    assert.deepEqual(await b.eval(() => {
      const g = findIfRequired('G1'), t = findIfRequired('T1');
      return [Math.round(g.left), Math.round(g.angle), findIfRequired('R1').fill, t.text, t.visible];
    }), [100, 0, '#90caf9', 'Before', true]);

    // Tagging a deleted object leaves it deleted; a group taken apart since
    // is not put back over its items.
    await b.play([
      'removeByUid("T1")',
      'tagState("gone", ["T1"])',
      'ungroupObjects("G1")',
      'revertState("intro", {"duration": 0})'
    ]);
    assert.deepEqual(await b.eval(() => [isFabricObject(findIfRequired('T1')) && !!findIfRequired('T1').canvas,
      stateTags().map(t => t.name), pc.getObjects().some(o => o.uid === 'G1'),
      ['R1', 'R2'].map(u => findIfRequired(u).group === undefined || findIfRequired(u).group === null)]),
    [true, ['intro'], false, [true, true]], 'T1 comes back only through the revert, G1 stays apart');
    assert.deepEqual(b.errors, []);
  } finally { await b.close(); }
});
