// Reusable snapshots, separate from the scene: editing a copy never edits its template.
const _compositeKey = 'play.composites.v1';
const _compositeDefinitions = new Map();
const _compositeJSON = value => JSON.parse(JSON.stringify(value));

function addNotConnected(x1, y1, x2, y2, opts = {}) {
    const { crossSize = 16, stroke = '#333', strokeWidth = 2, uid, ...rest } = opts;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const h = crossSize / 2;
    const style = { stroke, strokeWidth, strokeLineCap: 'round' };
    const objects = [
        new fabric.Line([-length / 2, 0, length / 2, 0], style),
        new fabric.Line([-h, -h, h, h], style),
        new fabric.Line([-h, h, h, -h], style),
    ];
    const group = new fabric.Group(objects, Object.assign({}, rest, {
        originX: 'center', originY: 'center', left: (x1 + x2) / 2, top: (y1 + y2) / 2,
        angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI,
    }));
    _compositeChildUids(group);
    if (uid) group.uid = uid;
    pc.add(group);
    if (uid) _trackUid(group);
    group.setCoords();
    return group;
}

function _compositeChildUids(group) {
    for (const child of group.getObjects()) {
        if (!child.uid) child.uid = semanticUid(child.type);
        customData(child).uid = child.uid;
        if (child.getObjects) _compositeChildUids(child);
    }
}

function _persistComposites() {
    try { localStorage.setItem(_compositeKey, JSON.stringify([..._compositeDefinitions])); return true; }
    catch (_) { return false; }
}

function defineCompositeData(name, data) {
    name = String(name).trim();
    if (!name || name === 'not-connected') throw new Error('Choose a name other than not-connected.');
    if (!data || !Array.isArray(data.objects) || !data.objects.length) throw new Error('A composite needs at least one object.');
    _compositeDefinitions.set(name, _compositeJSON(data));
    const persisted = _persistComposites();
    _renderCompositeLibrary();
    return persisted;
}

function defineComposite(name, items) {
    const objects = (Array.isArray(items) ? items : [items]).map(findIfRequired);
    if (!objects.length || objects.some(o => !isFabricObject(o))) throw new Error('Select existing canvas objects.');
    // ActiveSelection stores local coordinates. Snapshot each member in scene
    // coordinates, without grouping, moving, or deselecting the originals.
    const data = objects.map(o => Object.assign(o.toObject(),
        o.group ? _placeOnCanvas(o) : {}));
    // Connector bindings refer to the source scene, not the reusable snapshot.
    const clean = o => {
        delete o.uid; delete o.treeConnection;
        if (o.customData) {
            delete o.customData.uid; delete o.customData.connectorsIn; delete o.customData.connectorsOut;
            if (o.customData.type === 'connector') {
                delete o.customData.type; delete o.customData.source; delete o.customData.target;
            }
        }
        (o.objects || []).forEach(clean);
    };
    data.forEach(clean);
    return defineCompositeData(name, { objects: data });
}

function listComposites() { return ['not-connected', ..._compositeDefinitions.keys()]; }
function removeComposite(name) {
    if (!_compositeDefinitions.delete(name)) return false;
    _persistComposites(); _renderCompositeLibrary(); return true;
}

async function addComposite(name, x, y, opts = {}) {
    if (name === 'not-connected') {
        const group = addNotConnected(x - 80, y, x + 80, y, opts);
        if (opts.angle !== undefined) group.set('angle', opts.angle);
        group.setCoords();
        return group;
    }
    const definition = _compositeDefinitions.get(name);
    if (!definition) throw new Error('Unknown composite: ' + name);
    const objects = await fabric.util.enlivenObjects(_compositeJSON(definition.objects));
    const group = new fabric.Group(objects, Object.assign({}, opts, {
        originX: 'center', originY: 'center', left: x, top: y,
    }));
    _detachClone(group);
    _compositeChildUids(group);
    if (opts.uid) group.uid = opts.uid;
    pc.add(group);
    if (opts.uid) _trackUid(group);
    group.setCoords(); pc.requestRenderAll();
    return group;
}

try {
    const entries = JSON.parse(localStorage.getItem(_compositeKey) || '[]');
    for (const [name, data] of entries) {
        if (name !== 'not-connected' && data && Array.isArray(data.objects) && data.objects.length) _compositeDefinitions.set(name, data);
    }
} catch (_) { /* A broken saved library must not prevent opening the board. */ }

// The panel uses the same functions as scripts. Only UI actions record steps.
const _compositePanel = document.createElement('div');
_compositePanel.id = 'composite-library';
_compositePanel.style.cssText = 'display:none;position:fixed;left:66px;top:70px;z-index:1000002;width:280px;max-height:70vh;overflow:auto;padding:12px;background:#fff;color:#333;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 16px #0003;font:13px sans-serif';
_compositePanel.innerHTML = '<div style="display:flex;justify-content:space-between"><b>Reusable objects</b><button type="button" data-close aria-label="Close">×</button></div>' +
    '<p>Select shapes or a group, name it, then save a reusable copy.</p>' +
    '<div style="display:flex;gap:4px"><input aria-label="Composite name" placeholder="Object name" style="min-width:0;flex:1"><button type="button" data-save>Save selection</button></div>' +
    '<p role="status" data-status></p><div data-list></div>';
// Keep typing and deleting names away from canvas shortcuts.
['keydown', 'keyup', 'keypress'].forEach(type => _compositePanel.addEventListener(type, e => e.stopPropagation()));
document.body.appendChild(_compositePanel);
_compositePanel.querySelector('[data-close]').onclick = () => toggleCompositeLibrary(false);
function toggleCompositeLibrary(open) {
    const show = open === undefined ? _compositePanel.style.display === 'none' : open;
    _compositePanel.style.display = show ? 'block' : 'none';
    if (show) _renderCompositeLibrary();
}
_compositePanel.querySelector('[data-save]').onclick = () => {
    const name = _compositePanel.querySelector('input').value.trim();
    const status = _compositePanel.querySelector('[data-status]');
    if (_compositeDefinitions.has(name) && !confirm('Replace reusable object “' + name + '”?')) return;
    try {
        const saved = defineComposite(name, pc.getActiveObjects());
        status.textContent = saved ? 'Saved. Insert a copy below.' : 'Available for this session; browser storage is full or unavailable.';
    } catch (e) { status.textContent = e.message; }
};
function _renderCompositeLibrary() {
    // defineCompositeData can also be called before the UI is attached.
    const panel = document.getElementById('composite-library');
    if (!panel) return;
    const list = panel.querySelector('[data-list]');
    list.innerHTML = '';
    for (const name of listComposites()) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;margin-top:8px';
        const insert = document.createElement('button');
        insert.type = 'button'; insert.style.flex = '1'; insert.textContent = name === 'not-connected' ? '—×—  Not connected to' : name;
        insert.onclick = async () => {
            insert.disabled = true;
            try {
                const point = fabric.util.transformPoint(new fabric.Point(pc.width / 2, pc.height / 2), fabric.util.invertTransform(pc.viewportTransform));
                const group = await addComposite(name, point.x, point.y);
                pc.discardActiveObject(); pc.setActiveObject(group); pc.requestRenderAll();
                // Fully materialized data makes exported scripts independent of localStorage.
                recordScript(`Promise.resolve(addClones(${JSON.stringify([group.toObject()])}))`);
                if (window.undoManager) undoManager.push(Commands.addObject(pc, group));
            } catch (e) { panel.querySelector('[data-status]').textContent = e.message; }
            finally { insert.disabled = false; }
        };
        row.appendChild(insert);
        if (name !== 'not-connected') {
            const remove = document.createElement('button');
            remove.type = 'button'; remove.textContent = '×'; remove.title = 'Remove saved object';
            remove.onclick = () => removeComposite(name);
            row.appendChild(remove);
        }
        list.appendChild(row);
    }
}
