// Real Fabric scene/serialization integration; canvas painting is stubbed in jsdom.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.CUPITOR_JSDOM || 'jsdom');
const root = path.resolve(__dirname, '../../public');
function board(storage) {
    const dom = new JSDOM('<body><canvas></canvas></body>', { url: 'https://board.example', runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
    w.$ = w.jQuery = require('jquery')(w);
    w.customData = o => o.customData || (o.customData = {});
    w.objectIds = new Set(); w._ = {}; w.updateObjectIdsUi = () => {};
    const load = file => { const script = w.document.createElement('script'); script.textContent = fs.readFileSync(path.join(root, file), 'utf8'); w.document.body.appendChild(script); };
    for (const file of ['vendor/fabric.v6.js', 'algo.visual.toolbox.js', 'fabric.play.js', 'whiteboard.undo.js']) load(file);
    w.pc = new w.fabric.Canvas(w.document.querySelector('canvas'), { renderOnAddRemove: false });
    w.pc.getActiveObjects = () => w.selection || [];
    w.pc.discardActiveObject = () => { w.selection = []; };
    w.pc.setActiveObject = o => { w.selection = [o]; };
    w.eval('window.undoManager = new UndoManager()');
    w.lines = []; w.recordScriptFn = line => w.lines.push(line);
    if (storage) w.localStorage.setItem('play.composites.v1', storage);
    load('play-composites.js');
    return { w, close: () => dom.window.close() };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`);

test('not-connected preset: centred cross, arbitrary endpoints, IDs and round-trip', async () => {
    const b = board(); const { w } = b;
    try {
        const g = w.addNotConnected(100, 120, 300, 320, { stroke: '#f00', crossSize: 20, uid: 'relation' });
        near(g.left, 200); near(g.top, 220); near(g.angle, 45);
        assert.equal(g.getObjects().length, 3);
        g.getObjects().forEach(o => assert.equal(o.stroke, '#f00'));
        const revived = (await w.fabric.util.enlivenObjects([g.toObject()]))[0];
        near(revived.left, 200); near(revived.angle, 45);
        const preset = await w.addComposite('not-connected', 500, 400, { angle: 90 });
        near(preset.left, 500); near(preset.top, 400); near(preset.angle, 90);
        assert.notEqual(preset.uid, g.uid);
    } finally { b.close(); }
});

test('save a transformed multiselection without changing it; instances are independent and persistent', async () => {
    const b = board(); const { w } = b;
    try {
        const a = w.addRect(100, 100, 80, 40), c = w.addRect(250, 130, 50, 30);
        const selection = new w.fabric.ActiveSelection([a, c], { canvas: w.pc, angle: 25 });
        const before = [a, c].map(o => o.toObject());
        assert.equal(w.defineComposite('pair', [a.uid, c.uid]), true);
        assert.deepEqual([a, c].map(o => o.toObject()), before);
        const first = await w.addComposite('pair', 500, 300, { uid: 'pair1', scaleX: 2 });
        const second = await w.addComposite('pair', 700, 400);
        near(first.left, 500); near(first.scaleX, 2);
        assert.notEqual(first.uid, second.uid);
        assert.notEqual(first.item(0).uid, second.item(0).uid);
        first.item(0).set('fill', '#123456');
        assert.notEqual(second.item(0).fill, '#123456');
        const reloaded = board(w.localStorage.getItem('play.composites.v1'));
        try {
            const copy = await reloaded.w.addComposite('pair', 100, 200);
            assert.equal(copy.getObjects().length, 2);
            assert.notEqual(copy.item(0).fill, '#123456');
        } finally { reloaded.close(); }
        assert.equal(w.removeComposite('pair'), true);
        assert.ok(w.pc.getObjects().includes(first));
        await assert.rejects(w.addComposite('pair', 0, 0), /Unknown composite/);
        assert.throws(() => w.defineComposite('not-connected', [a]), /Choose a name/);
        assert.throws(() => w.defineComposite('empty', []), /Select existing/);
        selection.removeAll();
    } finally { b.close(); }
});

test('UI inserts an undoable group and records a portable script for a fresh browser', async () => {
    const b = board(); const { w } = b;
    try {
        const shape = w.addNotConnected(0, 0, 150, 0);
        w.selection = [shape];
        w.toggleCompositeLibrary(true);
        w.document.querySelector('#composite-library input').value = 'my relation';
        w.document.querySelector('[data-save]').click();
        const buttons = [...w.document.querySelectorAll('[data-list] button')];
        buttons.find(x => x.textContent === 'my relation').click();
        // enlivenObjects awaits before recording and selecting.
        await new Promise(r => setTimeout(r, 20));
        assert.equal(w.lines.length, 1);
        const inserted = w.selection[0];
        assert.notEqual(inserted.uid, shape.uid);
        w.undoManager.undo(); assert.ok(!w.pc.getObjects().includes(inserted));
        w.undoManager.redo(); assert.ok(w.pc.getObjects().includes(inserted));
        const replay = board();
        try {
            assert.equal(replay.w.listComposites().length, 1);
            await replay.w.eval(replay.w.buildScriptExecutables([w.lines[0]])[0])();
            const copy = replay.w.pc.getObjects()[0];
            assert.equal(copy.uid, inserted.uid);
            near(copy.left, inserted.left);
            assert.equal(copy.getObjects().length, 1);
            assert.equal(copy.item(0).getObjects().length, 3);
        } finally { replay.close(); }
    } finally { b.close(); }
});

test('standalone addComposite script lines return promises, so following lines wait', async () => {
    const b = board(); const { w } = b;
    try {
        w.defineComposite('box', [w.addRect(0, 0, 50, 40)]);
        const fn = w.eval(w.buildScriptExecutables(['addComposite("box", 200, 150, {uid:"copy"})'])[0]);
        const pending = fn();
        assert.equal(typeof pending.then, 'function');
        await pending;
        near(w.findIfRequired('copy').left, 200);
    } finally { b.close(); }
});

test('connector arrowheads: all modes render, serialize, and survive moving their objects', async () => {
    const b = board(); const { w } = b;
    try {
        const a = w.addRect(100, 100, 50, 40), c = w.addRect(400, 200, 50, 40);
        for (const bend of [undefined, 60, 'loop']) {
            for (const mode of ['none', 'start', 'end', 'both']) {
                const line = w.connectObjects(a.uid, bend === 'loop' ? a.uid : c.uid, undefined, { arrowheads: mode, bend });
                assert.equal(line.arrowheads, mode);
                const heads = [];
                const ctx = new Proxy({ globalAlpha: 1, translate: (x, y) => heads.push([x, y]) }, { get: (o, key) => key in o ? o[key] : () => {} });
                line._render(ctx);
                assert.equal(heads.length, mode === 'both' ? 2 : mode === 'none' ? 0 : 1, `${bend}/${mode} wing count`);
                const revived = (await w.fabric.util.enlivenObjects([line.toObject()]))[0];
                assert.equal(revived.arrowheads, mode);
                assert.equal(revived.customData.source, a.uid);
                line.dirty = false;
                w.setConnectorArrows(line, mode === 'both' ? 'none' : 'both');
                assert.equal(line.dirty, true, 'arrow style changes invalidate the drawing cache');
                const prev = line.x1;
                a.set('left', a.left + 20); a.setCoords();
                w.updateConnectors(a);
                assert.notEqual(line.x1, prev);
                assert.equal(line.arrowheads, mode === 'both' ? 'none' : 'both');
            }
        }
        const legacy = (await w.fabric.util.enlivenObjects([{ type: 'LineArrow', x1: 0, y1: 0, x2: 100, y2: 0 }]))[0];
        assert.equal(legacy.arrowheads, 'end', 'old scripts and saved scenes retain their arrow');
        assert.throws(() => w.setConnectorArrows(legacy, 'invalid'), /Arrowheads must/);
        assert.throws(() => w.connectObjects(a, c, undefined, { arrowheads: 'invalid' }), /Invalid connector/);
    } finally { b.close(); }
});
