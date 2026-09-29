// A teacher builds a mind map by hand, rearranges it, and replays the lesson.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBoard, stopBrowser, replayElsewhere, detached, assertSameScene } from './board.mjs';

after(stopBrowser);

test('mind map: draw, branch, rearrange, connect, group, replay', async () => {
  const b = await openBoard();
  try {
    // Draw the root with the rectangle tool.
    await b.shapeTool(0);
    let before = await b.uids();
    await b.dragCanvas(500, 120, 640, 190);
    const [root] = await b.newUids(before);
    assert.ok(root, 'dragging with the rectangle tool draws a rectangle');

    // Branch it: press t on the selected root and type the children.
    await b.select(root);
    b.promptAnswers.push('Joy, Fear, Anger');
    before = await b.uids();
    await b.key('t');
    const added = await b.newUids(before);
    const kids = await b.eval(r => {
      const o = findIfRequired(r);
      return o.treeConnection.outgoing.lines.map(findIfRequired).map(l => l.customData.target);
    }, root);
    assert.equal(kids.length, 3, `three children, added: ${added}`);
    assert.deepEqual(await b.eval(k => k.map(u => findIfRequired(u).visible), kids), [false, false, false], 'children start hidden');

    // Show them from the Tree panel: tick every child, press Show/Hide.
    await b.select(root);
    await b.page.waitForSelector('#tree-node-panel.visible');
    for (const chk of await b.page.$$('#tree-children-list .tree-child-row input[type=checkbox]')) await chk.check();
    await b.page.click('#tree-node-panel button:has-text("Show/Hide")');
    assert.deepEqual(await b.eval(k => k.map(u => findIfRequired(u).visible), kids), [true, true, true]);

    // The children sit stacked on the root; drag the top one out each time,
    // fanning them out underneath.
    await b.deselect();
    const stack = await b.centerOf(kids[0]);
    const spots = [[-260, 220], [0, 260], [260, 220]], order = [];
    for (const [dx, dy] of spots) {
      const moved = await b.eval(k => k.map(u => { const o = findIfRequired(u); return o.left + "," + o.top; }), kids);
      await b.dragObject(null, dx, dy, stack);
      await b.deselect();
      const now = await b.eval(k => k.map(u => { const o = findIfRequired(u); return o.left + "," + o.top; }), kids);
      order.push(kids[now.findIndex((x, i) => x !== moved[i])]);
    }
    assert.deepEqual([...order].sort(), [...kids].sort(), 'each drag pulled out a different child');
    kids.splice(0, 3, ...order);
    assert.deepEqual(detached(await b.lineGaps()), {}, 'tree lines follow the dragged children');

    // Tree lines meet the facing edges: root's bottom edge, each child's top edge.
    const ends = await b.eval(({ root, kids }) => kids.map(k => {
      const l = pc.getObjects().find(o => o.customData && o.customData.target === k && o.customData.source === root);
      const m = l.calcTransformMatrix(), q = l.calcLinePoints();
      const a = fabric.util.transformPoint(new fabric.Point(q.x1, q.y1), m), z = fabric.util.transformPoint(new fabric.Point(q.x2, q.y2), m);
      const r = findIfRequired(root).getBoundingRect(), c = findIfRequired(k).getBoundingRect();
      // Distance from the middle of the root's bottom edge and of the child's top edge.
      return [Math.round(Math.hypot(a.x - (r.left + r.width / 2), a.y - (r.top + r.height))), Math.round(Math.hypot(z.x - (c.left + c.width / 2), z.y - c.top))];
    }), { root, kids });
    ends.forEach(([fromRoot, toChild]) => { assert.ok(Math.abs(fromRoot) <= 2 && Math.abs(toChild) <= 2, `line ends ${ends}`); });

    // Connect Joy to Anger with the connector tool.
    await b.tool('connector');
    before = await b.uids();
    await b.select(kids[0]);
    await b.select(kids[2]);
    const [conn] = (await b.newUids(before)).filter(Boolean);
    assert.ok(conn, 'connector drawn');
    await b.key('Escape');
    await b.eval(() => toolManager.activate && toolManager.activate('select'));

    // Group the two outer children with Ctrl/Cmd+G and move the group.
    await b.deselect();
    await b.selectMany([kids[0], kids[2]]);
    before = await b.uids();
    await b.key(process.platform === 'darwin' ? 'Meta+g' : 'Control+g');
    const [group] = (await b.newUids(before));
    assert.equal(await b.eval(g => findIfRequired(g).type, group), 'group');
    await b.deselect();
    await b.dragObject(group, 0, 120, (await b.centerOf(kids[0])));
    // Scale it by its corner and rotate it by its top handle.
    await b.select(group);
    await b.dragHandle('br', 60, 40);
    await b.dragHandle('mtr', 80, 0);
    await b.deselect();
    assert.deepEqual(detached(await b.lineGaps()), {}, 'lines stay on the grouped, moved, scaled and rotated children');
    assert.notEqual(await b.eval(g => Math.round(findIfRequired(g).angle), group), 0, 'group rotated');

    const lines = await b.script();
    const live = await b.snapshot();
    assert.deepEqual(b.errors, []);

    // The recording replayed on a fresh board ends up identical.
    const replay = await replayElsewhere(lines);
    assert.deepEqual(replay.errors, []);
    assert.deepEqual(detached(replay.gaps), {});
    assertSameScene(replay.snapshot, live, 2);
  } finally { await b.close(); }
});
