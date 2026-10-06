// The meaning layer over play.html scripts. A semantic action ("introduce
// CULTURE near PERSON", "revise knowledge to I THINK I KNOW") becomes
//   1. one annotation comment, `// @sem {...}`, holding the action and every
//      position/size it settled on, and
//   2. the ordinary script lines that draw it.
// The scene model is never stored anywhere else: it is rebuilt by folding the
// annotations of the script in order (parseScene), so a saved script carries
// its own intent and editing or deleting lines edits the scene.

export const TAG = '// @sem ';
export const CANVAS = { width: 1400, height: 800, margin: 40 };
// Semantic duration classes, in ms.
export const PACE = { instant: 200, short: 700, deliberate: 1500 };
// Pauses, in seconds.
export const PAUSE = { short: 1, prediction: 2, thinking: 4 };
export const TEXT_SIZE = { small: 16, normal: 22, large: 30, title: 38 };
export const VIEWER_TASKS = ['notice', 'compare', 'predict', 'infer', 'remember', 'question', 'integrate'];
const OPACITY = { faint: 0.2, dim: 0.4 };
const GAP = 60;       // room between an anchor and what is placed next to it
const CLEARANCE = 24; // the least room kept between objects
const KINDS = ['text', 'box', 'figure', 'picture'];
// Page controls drawn over the canvas (play.html at 1400x850, zoom 1): nothing is placed under them.
export const RESERVED = [{ name: 'minimap', x: 1180, y: 640, w: 220, h: 160 }];

export const ACTIONS = {
  scene: 'Start a scene: {name}. Objects from earlier scenes stay and can be reused.',
  beat: 'Start a beat (one conceptual move): {name, viewer_task?: {type, target}}.',
  viewer_task: `What the viewer should do mentally: {type: ${VIEWER_TASKS.join('|')}, target, constraint?}. Attaches to the current beat (or scene).`,
  introduce: "Add one concept: {id, text?, kind?: text|box|figure|picture, size?: small|normal|large|title, role?, place?, pace?}. A figure is a minimal person; a picture needs src (an http(s) URL, a path under public/, or a local file, which is copied to public/play-assets/) and takes width (px, default 160); text is the label under a figure or picture. place: {near: id, side?: around|left|right|above|below}, {between: [id, id]}, {region: center|top|bottom|left|right|top-left|top-right|bottom-left|bottom-right} or {x, y}.",
  introduce_group: 'Add several concepts as a row or column: {id, items: [{id, text}] or ["TEXT", ...], layout?: row|column, kind?, size?, role?, place?, pace?}.',
  branch: 'Add children of a concept and connect them: {from, items, side?: below|above|left|right, kind?, size?, pace?}.',
  connect: "Relationship from one concept to another (an arrow that follows both): {from, to, id?, kind?, bend?, pace?}. bend: 'auto' (default: straight unless that runs through another concept or onto a reverse arrow, then curved), a number (px the middle stands off the straight line), or 0. from = to draws a loop.",
  disconnect: 'Remove a relationship: {id} or {from, to}.',
  enclose: 'Draw a boundary round concepts: {id, members: [ids] | group: id, style?: solid|dashed, pace?}.',
  revise: 'Change the text of the same concept (identity kept): {id, text, pace?}.',
  question: 'Make a concept uncertain: dashed boundary and a question mark: {id, text?, pace?}.',
  weaken_boundary: "Dash (or remove) a concept's or enclosure's boundary: {id, style?: dashed|none, pace?}.",
  replace: 'Fade one concept out and another in at its place: {id, with: {id, text, kind?, size?}, pace?}.',
  deemphasize: 'Fade concepts back but keep them where they are: {ids, level?: dim|faint, pace?}.',
  focus: 'Bring concepts to full strength and dim the rest: {ids, dim_others?: true, pace?}.',
  move_into: 'Move a concept into another (e.g. a question into a person), smaller: {id, into, scale?, pace?}.',
  widen_context: "Pull the camera back so concepts sit small inside a much larger frame: {ids?: [ids] (default all), scale?: 0.45, region? (where they end up on screen), mode?: camera (default) | objects (shrink the concepts themselves, leaving the rest as it is), pace?}.",
  narrow_context: 'Bring the camera in on concepts: {ids, fill?: 0.7 (share of the screen they fill)} or {reset: true} (back to the starting view), pace?.',
  dissolve_boundary: "Turn categories into a continuum: the boxes of concepts (in order, e.g. two categories with in-between cases already placed between them) lose their boundaries while a colour band appears under them: {ids, id (the band), colors?: [from, to], pace?}.",
  checkpoint: 'Remember how every concept, relationship and the camera are now: {name}.',
  return_to: 'Go back: {name} puts the concepts of a checkpoint back as they were (positions, text, emphasis, ones removed since) and the camera; {ids} brings back removed concepts where they were.',
  turnover: "Some members of a group leave while new ones arrive, the group's identity holding: {group, leaving: [ids], arriving: [{id, text}] or [\"TEXT\"], direction?: right|left|down|up (where leavers go; arrivals come in at the other end), pace?}.",
  pause: `Hold still: {kind?: ${Object.keys(PAUSE).join('|')}, seconds?}.`,
  remove: 'Fade concepts out and delete them: {ids, pace?}.'
};

export function emptyScene() {
  return { camera: { zoom: 1, pan: [0, 0] }, retired: {}, retiredRelations: {}, checkpoints: {}, scene: null, scenes: [], beat: null, beats: [], viewerTasks: [], objects: {}, relations: {}, groups: {}, log: [] };
}

// ---- reading a script -------------------------------------------------------

export function annotations(lines) {
  const out = [], problems = [];
  (lines || []).forEach((raw, i) => {
    const line = String(raw).trim();
    if (!line.startsWith(TAG.trim())) return;
    try { out.push({ line: i + 1, record: JSON.parse(line.slice(TAG.trim().length)) }); }
    catch (e) { problems.push(`Line ${i + 1}: unreadable annotation (${e.message})`); }
  });
  return { list: out, problems };
}

export function parseScene(lines) {
  const model = emptyScene();
  const { list, problems } = annotations(lines);
  list.forEach(({ line, record }) => {
    try { applyRecord(model, record); }
    catch (e) { problems.push(`Line ${line}: ${e.message}`); }
  });
  model.problems = problems;
  return model;
}

// ---- folding records into the model ----------------------------------------

function addObject(model, rec, o) {
  model.objects[o.id] = {
    id: o.id, kind: o.kind || 'text', text: o.text, role: o.role || null, at: o.at, size: o.size,
    fontSize: o.fontSize, src: o.src, width: o.width, scale: 1, opacity: 1, boundary: o.boundary || 'none',
    history: o.text != null ? [o.text] : [], scene: model.scene, beat: model.beat
  };
  delete model.retired[o.id]; // its id now names something else
}

function addRelation(model, r) {
  delete model.retiredRelations[r.id]; // its id now names something else
  model.relations[r.id] = { id: r.id, from: r.from, to: r.to, kind: r.kind || null, bend: r.bend || 0, opacity: 1, scene: model.scene, beat: model.beat };
}

const clone = v => JSON.parse(JSON.stringify(v));

// A removed concept is kept (with the relationships that went with it) so
// return_to can bring it back.
function dropObject(model, id) {
  const gone = Object.values(model.relations).filter(r => r.from === id || r.to === id);
  model.retired[id] = {
    object: clone(model.objects[id]),
    groups: Object.values(model.groups).filter(g => g.members.includes(id)).map(g => g.id),
    enclosures: Object.values(model.objects).filter(o => o.members && o.members.includes(id)).map(o => o.id)
  };
  delete model.objects[id];
  // Its connectors go with it on the canvas; they wait until both ends are back.
  gone.forEach(r => { model.retiredRelations[r.id] = clone(r); delete model.relations[r.id]; });
  Object.values(model.objects).forEach(o => { if (o.members) o.members = o.members.filter(m => m !== id); });
  Object.values(model.groups).forEach(g => {
    g.members = g.members.filter(m => m !== id);
    if (g.enclosure === id) g.enclosure = null;
    if (!g.members.length && !g.enclosure) delete model.groups[g.id];
  });
}

export function applyRecord(model, rec) {
  const obj = id => {
    const o = model.objects[id];
    if (!o) throw new Error(`${rec.op}: no concept "${id}"`);
    return o;
  };
  switch (rec.op) {
    case 'scene':
      if (rec.reset) model.camera = { zoom: 1, pan: [0, 0] };
      model.scene = rec.name; model.beat = null;
      model.scenes.push({ name: rec.name });
      break;
    case 'beat':
      model.beat = rec.name;
      model.beats.push({ name: rec.name, scene: model.scene });
      if (rec.viewer_task) model.viewerTasks.push({ ...rec.viewer_task, scene: model.scene, beat: rec.name });
      break;
    case 'viewer_task':
      model.viewerTasks.push({ type: rec.type, target: rec.target, constraint: rec.constraint, scene: model.scene, beat: model.beat });
      break;
    case 'introduce':
      addObject(model, rec, rec);
      break;
    case 'introduce_group':
    case 'branch':
      rec.items.forEach(it => addObject(model, rec, { role: rec.role, ...it }));
      if (rec.op === 'introduce_group') model.groups[rec.id] = { id: rec.id, members: rec.items.map(it => it.id), enclosure: null };
      (rec.relations || []).forEach(r => addRelation(model, r));
      break;
    case 'connect':
      addRelation(model, rec);
      break;
    case 'disconnect':
      delete model.relations[rec.id];
      break;
    case 'enclose':
      model.objects[rec.id] = {
        id: rec.id, kind: 'enclosure', members: rec.members, at: rec.at, size: rec.size, scale: 1, opacity: 1,
        boundary: rec.style || 'solid', history: [], scene: model.scene, beat: model.beat
      };
      delete model.retired[rec.id];
      if (rec.group && model.groups[rec.group]) model.groups[rec.group].enclosure = rec.id;
      break;
    case 'revise':
    case 'question': {
      const o = obj(rec.id);
      o.text = rec.text; o.size = rec.size; o.history.push(rec.text);
      if (rec.op === 'question') { o.boundary = 'dashed'; o.questioned = true; }
      break;
    }
    case 'weaken_boundary':
      obj(rec.id).boundary = rec.style;
      break;
    case 'replace':
      obj(rec.id);
      dropObject(model, rec.id);
      addObject(model, rec, rec.with);
      break;
    case 'deemphasize':
    case 'focus':
      Object.entries(rec.opacity).forEach(([id, v]) => {
        if (model.objects[id]) model.objects[id].opacity = v;
        else if (model.relations[id]) model.relations[id].opacity = v;
      });
      break;
    case 'move_into': {
      const o = obj(rec.id);
      o.at = rec.at; o.scale = rec.scale; o.inside = rec.into;
      break;
    }
    case 'widen_context':
    case 'narrow_context':
      if (rec.camera) { model.camera = rec.camera; break; }
      Object.entries(rec.bends || {}).forEach(([id, b]) => { model.relations[id].bend = b; });
      Object.entries(rec.moves).forEach(([id, m]) => { const o = obj(id); o.at = m.at; o.scale = m.scale; });
      break;
    case 'dissolve_boundary':
      rec.ids.forEach(id => { obj(id).boundary = 'none'; });
      model.objects[rec.id] = {
        id: rec.id, kind: 'spectrum', members: rec.ids, colors: rec.colors, at: rec.at, size: rec.size, scale: 1, opacity: 1,
        boundary: 'none', history: [], scene: model.scene, beat: model.beat
      };
      delete model.retired[rec.id];
      break;
    case 'checkpoint':
      model.checkpoints[rec.name] = rec.state;
      break;
    case 'return_to':
      if (rec.name) {
        const st = model.checkpoints[rec.name];
        if (!st) throw new Error(`return_to: no checkpoint "${rec.name}"`);
        // What came after the checkpoint goes (and can be brought back by id).
        rec.removed.forEach(id => dropObject(model, id));
        rec.unlinked.forEach(id => { model.retiredRelations[id] = clone(model.relations[id]); delete model.relations[id]; });
        Object.values(st.objects).forEach(o => { model.objects[o.id] = clone(o); delete model.retired[o.id]; });
        Object.values(st.relations).forEach(r => { model.relations[r.id] = clone(r); delete model.retiredRelations[r.id]; });
        Object.values(st.groups).forEach(g => { model.groups[g.id] = clone(g); });
        model.camera = clone(st.camera);
      } else {
        rec.ids.forEach(id => {
          const r = model.retired[id];
          if (!r) throw new Error(`return_to: "${id}" was not removed`);
          model.objects[id] = clone(r.object);
          delete model.retired[id];
          // Back into its groups and enclosures.
          (r.groups || []).forEach(gid => {
            const g = model.groups[gid] = model.groups[gid] || { id: gid, members: [], enclosure: null };
            if (!g.members.includes(id)) g.members.push(id);
          });
          (r.enclosures || []).forEach(eid => {
            const e = model.objects[eid];
            if (e && !e.members.includes(id)) e.members.push(id);
          });
        });
        rec.relations.forEach(r => { model.relations[r.id] = clone(r); delete model.retiredRelations[r.id]; });
      }
      break;
    case 'turnover': {
      const before = model.groups[rec.group];
      if (!before) throw new Error(`turnover: no group "${rec.group}"`);
      rec.leaving.forEach(id => dropObject(model, id));
      Object.entries(rec.moves).forEach(([id, at]) => { obj(id).at = at; });
      rec.arriving.forEach(it => addObject(model, rec, it));
      // dropObject deletes a group left empty for a moment; it is the same group.
      const group = model.groups[rec.group] = { ...before, id: rec.group, members: rec.members };
      const enc = group.enclosure && model.objects[group.enclosure];
      if (enc) {
        enc.members = [...enc.members, ...rec.arriving.map(it => it.id)];
        if (rec.enclosure) { enc.at = rec.enclosure.at; enc.size = rec.enclosure.size; }
      }
      break;
    }
    case 'pause':
      break;
    case 'remove':
      rec.ids.forEach(id => dropObject(model, id));
      break;
    default:
      throw new Error(`unknown action "${rec.op}"`);
  }
  model.log.push(describe(rec, model));
}

function describe(rec, model) {
  const where = [model.scene, model.beat].filter(Boolean).join(' / ');
  const what = rec.id ? `${rec.op} ${rec.id}` : rec.op === 'connect' ? `connect ${rec.from} -> ${rec.to}`
    : rec.ids ? `${rec.op} ${rec.ids.join(', ')}` : rec.name ? `${rec.op} ${rec.name}` : rec.op;
  return where ? `[${where}] ${what}` : what;
}

// ---- geometry ----------------------------------------------------------------

export function boxOf(o) {
  const s = o.scale == null ? 1 : o.scale, w = o.size[0] * s, h = o.size[1] * s;
  return { x: o.at[0] - w / 2, y: o.at[1] - h / 2, w, h };
}

const overlaps = (a, b, room = 0) =>
  a.x < b.x + b.w + room && b.x < a.x + a.w + room && a.y < b.y + b.h + room && b.y < a.y + a.h + room;

// The camera: the viewport transform's zoom and pan. Positions in the model
// are scene coordinates; regions, the minimap and font sizes are on screen.
const zoomOf = model => (model.camera ? model.camera.zoom : 1);
export function toScene(model, [sx, sy]) {
  const c = model.camera || { zoom: 1, pan: [0, 0] };
  return [(sx - c.pan[0]) / c.zoom, (sy - c.pan[1]) / c.zoom];
}
const screenRect = (model, r) => {
  const [x, y] = toScene(model, [r.x, r.y]), z = zoomOf(model);
  return { ...r, x, y, w: r.w / z, h: r.h / z };
};
// The part of the scene the camera shows.
export const view = model => screenRect(model, { x: 0, y: 0, w: CANVAS.width, h: CANVAS.height });

const onCanvas = (model, b) => {
  const v = view(model), m = CANVAS.margin / zoomOf(model);
  return b.x >= v.x + m && b.y >= v.y + m && b.x + b.w <= v.x + v.w - m && b.y + b.h <= v.y + v.h - m;
};

function occupied(model) {
  return Object.values(model.objects).filter(o => o.opacity > 0).map(boxOf).concat(RESERVED.map(r => screenRect(model, r)));
}

export const REGIONS = {
  center: [700, 400], top: [700, 130], bottom: [700, 670], left: [260, 400], right: [1140, 400],
  'top-left': [260, 130], 'top-right': [1140, 130], 'bottom-left': [260, 670], 'bottom-right': [1000, 670]
};
const SIDES = { right: [1, 0], left: [-1, 0], below: [0, 1], above: [0, -1] };

// Where a box of `size` (centred) can go: the first free spot by `place`,
// else the least crowded of those tried.
export function placeBox(model, size, place = {}, taken = occupied(model)) {
  const [w, h] = size;
  const cands = [];
  const k = 1 / zoomOf(model), gap = GAP * k, clearance = CLEARANCE * k;
  if (place.x != null || place.y != null) return [num(place.x, 'place.x', -5000, 5000), num(place.y, 'place.y', -5000, 5000)];
  if (place.near) {
    const anchor = model.objects[place.near];
    if (!anchor) throw new Error(`place: no concept "${place.near}"`);
    const a = boxOf(anchor), ac = [a.x + a.w / 2, a.y + a.h / 2];
    const sides = !place.side || place.side === 'around' ? ['right', 'left', 'below', 'above'] : [place.side];
    if (!sides.every(s => SIDES[s])) throw new Error(`place: side must be around, left, right, above or below`);
    for (let step = 0; step < 5; step++) {
      sides.forEach(side => {
        const [dx, dy] = SIDES[side];
        const along = dx ? (a.w + w) / 2 : (a.h + h) / 2;
        const across = dx ? h + clearance : w + clearance;
        for (const j of [0, 1, -1, 2, -2, 3, -3]) {
          const d = along + gap + step * (dx ? w : h) * 0.75;
          cands.push([ac[0] + dx * d + (dx ? 0 : j * across), ac[1] + dy * d + (dy ? 0 : j * across)]);
        }
      });
    }
  } else {
    let c;
    if (place.between) {
      if (!Array.isArray(place.between) || place.between.length !== 2) throw new Error('place: between takes two ids');
      const [p, q] = place.between.map(id => { const o = model.objects[id]; if (!o) throw new Error(`place: no concept "${id}"`); return o.at; });
      c = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    } else {
      const region = place.region || 'center';
      if (!REGIONS[region]) throw new Error(`place: region must be one of ${Object.keys(REGIONS).join(', ')}`);
      c = toScene(model, REGIONS[region]);
    }
    cands.push(c);
    for (let r = 80 * k; r <= 640 * k; r += 80 * k) {
      for (let k = 0; k < 12; k++) cands.push([c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * 0.6 * Math.sin(k * Math.PI / 6)]);
    }
  }
  const boxAt = ([x, y]) => ({ x: x - w / 2, y: y - h / 2, w, h });
  const free = cands.find(c => onCanvas(model, boxAt(c)) && !taken.some(t => overlaps(boxAt(c), t, clearance)));
  if (free) return free.map(Math.round);
  // Nothing free: the on-canvas spot touching the fewest others.
  const score = c => taken.filter(t => overlaps(boxAt(c), t, clearance)).length + (onCanvas(model, boxAt(c)) ? 0 : 100);
  return cands.reduce((best, c) => (score(c) < score(best) ? c : best)).map(Math.round);
}

// Centres for items laid out in a row or column, the whole set placed as one box.
function layoutRun(model, sizes, layout, place, gap) {
  const row = layout !== 'column';
  gap /= zoomOf(model);
  const total = sizes.reduce((s, [w, h]) => s + (row ? w : h), 0) + gap * (sizes.length - 1);
  const thick = Math.max(...sizes.map(([w, h]) => (row ? h : w)));
  const [cx, cy] = placeBox(model, row ? [total, thick] : [thick, total], place);
  let pos = (row ? cx : cy) - total / 2;
  return sizes.map(([w, h]) => {
    const len = row ? w : h, c = pos + len / 2;
    pos += len + gap;
    return row ? [Math.round(c), cy] : [cx, Math.round(c)];
  });
}

// ---- planning: action -> {record, lines} -------------------------------------

const J = v => JSON.stringify(v);
const pace = (a, fallback = 'short') => {
  const p = a.pace || fallback;
  if (typeof p === 'number') return num(p, 'pace', 0, 60000);
  if (!PACE[p]) throw new Error(`pace must be ${Object.keys(PACE).join(', ')} or ms`);
  return PACE[p];
};
const ID = /^[A-Za-z][\w-]*$/;
// A number for a script line: anything else is refused rather than pasted in.
function num(v, name, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`${name} must be a number from ${min} to ${max}`);
  return v;
}
const idFor = (id, text) => {
  if (id != null) return id;
  if (text == null || text === '') throw new Error('give an id (there is no text to make one from)');
  return slug(text);
};
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';

function checkNewId(model, id, taken = new Set()) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error(`id "${id}" must start with a letter and use letters, digits, _ or -`);
  if (model.objects[id] || model.relations[id] || model.groups[id] || taken.has(id)) throw new Error(`id "${id}" is already used`);
}

function need(model, id, op) {
  if (!model.objects[id]) throw new Error(`${op}: no concept "${id}"`);
  return model.objects[id];
}

// Everything a checkpoint needs to put the scene back.
const snapshot = model => clone({ objects: model.objects, relations: model.relations, groups: model.groups, camera: model.camera });

// Concepts named directly or through a group (its members and its enclosure).
function expand(model, ids, op) {
  if (!Array.isArray(ids) || !ids.length) throw new Error(`${op}: ids must be a non-empty list`);
  const out = [];
  ids.forEach(id => {
    const g = model.groups[id];
    if (g) { out.push(...g.members); if (g.enclosure) out.push(g.enclosure); }
    else { need(model, id, op); out.push(id); }
  });
  return [...new Set(out)];
}

// What a concept is made of. Sizes are on screen: under a zoomed-out camera
// the font (or picture) is made bigger in the scene to look the same size.
function objectSpec(model, a, text) {
  const kind = a.kind || 'text';
  if (!KINDS.includes(kind)) throw new Error(`kind must be ${KINDS.join(', ')}`);
  const pictured = kind === 'figure' || kind === 'picture';
  const size = a.size || (pictured ? 'small' : 'normal');
  const screenFont = typeof size === 'number' ? size : TEXT_SIZE[size];
  if (!screenFont) throw new Error(`size must be ${Object.keys(TEXT_SIZE).join(', ')} or a font size`);
  if (!pictured && (text == null || text === '')) throw new Error('text is required');
  const fontSize = Math.round(screenFont / zoomOf(model) * 10) / 10;
  const spec = { kind, text: text == null || text === '' ? undefined : String(text), fontSize, boundary: kind === 'box' ? 'solid' : 'none' };
  if (kind === 'picture') {
    if (!a.src) throw new Error('a picture needs src');
    spec.src = a.src;
    spec.width = Math.round((a.width == null ? 160 : num(a.width, 'width', 8, 1400)) / zoomOf(model));
  }
  return spec;
}

function createLine(o, ms) {
  if (o.kind === 'picture') {
    return `Promise.resolve(addPicture(${J(o.src)}, ${o.at[0]}, ${o.at[1]}, ${J({ uid: o.id, label: o.text, width: o.width, fontSize: o.fontSize })})).then(g => drawOutline(g, {duration: ${ms}}))`;
  }
  if (o.kind === 'figure') {
    return `drawOutline(addFigure(${o.at[0]}, ${o.at[1]}, ${J({ uid: o.id, label: o.text, fontSize: o.fontSize })}), {duration: ${ms}})`;
  }
  return `drawOutline(addLabel(${J(o.text)}, ${o.at[0]}, ${o.at[1]}, ${J({ uid: o.id, fontSize: o.fontSize, boundary: o.boundary })}), {duration: ${ms}})`;
}

const cameraLine = (c, ms) => `animateViewport({zoom: ${c.zoom}, pan: [${c.pan[0]}, ${c.pan[1]}]}, {duration: ${ms}})`;

// Centre and size of a box round boxes `bs`, `pad` px (on screen) outside them.
function boxAround(model, bs, pad) {
  const m = pad / zoomOf(model);
  const x0 = Math.min(...bs.map(b => b.x)) - m, y0 = Math.min(...bs.map(b => b.y)) - m;
  const x1 = Math.max(...bs.map(b => b.x + b.w)) + m, y1 = Math.max(...bs.map(b => b.y + b.h)) + m;
  return { at: [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)], size: [Math.round(x1 - x0), Math.round(y1 - y0)] };
}

// Centre of the box round these concepts.
function centreOf(model, ids) {
  const bs = ids.map(id => boxOf(model.objects[id]));
  return [(Math.min(...bs.map(b => b.x)) + Math.max(...bs.map(b => b.x + b.w))) / 2,
    (Math.min(...bs.map(b => b.y)) + Math.max(...bs.map(b => b.y + b.h))) / 2];
}

const fadeAll = (pairs, ms) => `Promise.all([${pairs.map(([id, v]) => `animate(${J(id)}, {opacity: ${v}}, {duration: ${ms}})`).join(', ')}])`;

// Relations whose both ends are among `ids`.
const relationsWithin = (model, ids) => Object.values(model.relations).filter(r => ids.includes(r.from) && ids.includes(r.to)).map(r => r.id);

// measure([{kind, text, fontSize, boundary}]) -> [[w, h]] in canvas px, from the page.
export async function planAction(model, a, measure) {
  if (!a || typeof a.op !== 'string') throw new Error('each action needs an op');
  if (!ACTIONS[a.op]) throw new Error(`unknown op "${a.op}"; one of ${Object.keys(ACTIONS).join(', ')}`);
  const op = a.op;
  switch (op) {
    case 'scene':
      if (!a.name) throw new Error('scene: name is required');
      // The first scene starts from the starting view, so a replay does too.
      if (!model.scenes.length) return { record: { op, name: a.name, reset: true }, lines: [cameraLine({ zoom: 1, pan: [0, 0] }, 0)] };
      return { record: { op, name: a.name }, lines: [] };
    case 'beat':
      if (!a.name) throw new Error('beat: name is required');
      if (a.viewer_task) checkTask(a.viewer_task);
      return { record: { op, name: a.name, viewer_task: a.viewer_task }, lines: [] };
    case 'viewer_task':
      checkTask(a);
      return { record: { op, type: a.type, target: a.target, constraint: a.constraint }, lines: [] };

    case 'introduce': {
      const id = idFor(a.id, a.text);
      checkNewId(model, id);
      const spec = objectSpec(model, a, a.text);
      const [size] = await measure([spec]);
      const at = placeBox(model, size, a.place);
      const rec = { op, id, ...spec, role: a.role, at, size };
      return { record: rec, lines: [createLine(rec, pace(a, spec.kind === 'text' || spec.kind === 'box' ? 'short' : 'deliberate'))] };
    }

    case 'introduce_group':
    case 'branch': {
      if (!Array.isArray(a.items) || !a.items.length) throw new Error(`${op}: items must be a non-empty list`);
      if (op === 'introduce_group') checkNewId(model, a.id);
      const from = op === 'branch' ? need(model, a.from, op) : null;
      const taken = new Set(op === 'introduce_group' ? [a.id] : []);
      const items = a.items.map(it => {
        const item = typeof it === 'string' ? { text: it } : it;
        const id = idFor(item.id, item.text);
        checkNewId(model, id, taken);
        taken.add(id);
        return { id, ...objectSpec(model, { ...a, ...item }, item.text), ...(item.role ? { role: item.role } : {}) };
      });
      const sizes = await measure(items);
      const side = a.side || 'below';
      const layout = a.layout || (op === 'branch' ? (side === 'left' || side === 'right' ? 'column' : 'row') : 'row');
      const place = op === 'branch' ? { near: a.from, side } : a.place;
      const centres = layoutRun(model, sizes, layout, place, op === 'branch' ? 48 : 32);
      const placed = items.map((it, i) => ({ ...it, at: centres[i], size: sizes[i] }));
      const ms = pace(a);
      const lines = [];
      const relations = [];
      if (op === 'introduce_group') {
        lines.push(`Promise.all([${placed.map(p => createLine(p, ms)).join(', ')}])`);
      } else {
        placed.forEach(p => {
          const rid = `${from.id}__${p.id}`;
          checkNewId(model, rid, taken);
          taken.add(rid);
          relations.push({ id: rid, from: from.id, to: p.id, kind: a.relation || null });
          lines.push(createLine(p, ms), `connectObjects(${J(from.id)}, ${J(p.id)}, ${J(rid)}, {animate: true, duration: ${ms}})`);
        });
      }
      return { record: { op, id: a.id, from: a.from, kind: a.kind, role: a.role, items: placed, relations }, lines };
    }

    case 'connect': {
      need(model, a.from, op); need(model, a.to, op);
      const id = a.id || `${a.from}__${a.to}`;
      checkNewId(model, id);
      const bend = a.from === a.to ? 'loop' : chooseBend(model, a.from, a.to, a.bend == null ? 'auto' : a.bend);
      const rec = { op, id, from: a.from, to: a.to, kind: a.kind || null, ...(bend ? { bend } : {}) };
      const opts = bend ? `{bend: ${J(bend)}, animate: true, duration: ${pace(a)}}` : `{animate: true, duration: ${pace(a)}}`;
      return { record: rec, lines: [`connectObjects(${J(a.from)}, ${J(a.to)}, ${J(id)}, ${opts})`] };
    }

    case 'disconnect': {
      const id = a.id || (a.from && a.to && `${a.from}__${a.to}`);
      if (!model.relations[id]) throw new Error(`disconnect: no relationship "${id}"`);
      return { record: { op, id }, lines: [`animate(${J(id)}, {opacity: 0}, {duration: ${pace(a)}}).then(() => removeByUid(${J(id)}))`] };
    }

    case 'enclose': {
      checkNewId(model, a.id);
      const members = a.group ? (model.groups[a.group] || {}).members : a.members;
      if (!Array.isArray(members) || !members.length) throw new Error(`enclose: give members or an existing group`);
      members.forEach(m => need(model, m, op));
      const style = a.style || 'solid';
      if (!['solid', 'dashed'].includes(style)) throw new Error('enclose: style must be solid or dashed');
      const { at, size } = boxAround(model, members.map(m => boxOf(model.objects[m])), 20);
      const opts = { uid: a.id, originX: 'center', originY: 'center', rx: 18, ry: 18, stroke: '#666', strokeWidth: 2 };
      if (style === 'dashed') opts.strokeDashArray = [10, 7];
      return {
        record: { op, id: a.id, group: a.group, members, style, at, size },
        lines: [`drawOutline(addRect(${at[0]}, ${at[1]}, ${size[0]}, ${size[1]}, ${J(opts)}), {duration: ${pace(a, 'deliberate')}})`]
      };
    }

    case 'revise':
    case 'question': {
      const o = need(model, a.id, op);
      if (o.kind !== 'text' && o.kind !== 'box') throw new Error(`${op}: "${a.id}" is a ${o.kind}; only text and box concepts have text to change`);
      const text = a.text != null ? String(a.text) : op === 'question' ? (o.text.endsWith('?') ? o.text : o.text + '?') : null;
      if (text == null) throw new Error('revise: text is required');
      const [size] = await measure([{ kind: o.kind, text, fontSize: o.fontSize, boundary: o.boundary }]);
      const ms = pace(a, 'deliberate');
      const change = op === 'question'
        ? `(setLabelText(${J(a.id)}, ${J(text)}), setLabelBoundary(${J(a.id)}, "dashed"))`
        : `setLabelText(${J(a.id)}, ${J(text)})`;
      return {
        record: { op, id: a.id, text, size },
        lines: [`animate(${J(a.id)}, {opacity: 0.15}, {duration: ${Math.round(ms * 0.3)}}).then(() => ${change}).then(() => animate(${J(a.id)}, {opacity: ${o.opacity}}, {duration: ${Math.round(ms * 0.7)}}))`]
      };
    }

    case 'weaken_boundary': {
      const o = need(model, a.id, op);
      const style = a.style || 'dashed';
      if (!['dashed', 'none'].includes(style)) throw new Error('weaken_boundary: style must be dashed or none');
      let change;
      if (o.kind === 'enclosure') change = style === 'none' ? `setProp(${J(a.id)}, "strokeWidth", 0)` : `(setProp(${J(a.id)}, "strokeWidth", 2), setProp(${J(a.id)}, "strokeDashArray", [10, 7]))`;
      else if (o.kind === 'text' || o.kind === 'box') change = `setLabelBoundary(${J(a.id)}, ${J(style)})`;
      else throw new Error(`weaken_boundary: "${a.id}" has no boundary`);
      const ms = pace(a, 'deliberate');
      return {
        record: { op, id: a.id, style },
        lines: [`animate(${J(a.id)}, {opacity: 0.3}, {duration: ${Math.round(ms / 2)}}).then(() => ${change}).then(() => animate(${J(a.id)}, {opacity: ${o.opacity}}, {duration: ${Math.round(ms / 2)}}))`]
      };
    }

    case 'replace': {
      const old = need(model, a.id, op);
      const w = a.with || {};
      const id = idFor(w.id, w.text);
      checkNewId(model, id);
      const spec = objectSpec(model, { kind: old.kind === 'enclosure' ? 'text' : old.kind, size: old.fontSize * zoomOf(model), ...w }, w.text);
      const [size] = await measure([spec]);
      const neu = { id, ...spec, role: w.role || old.role, at: old.at, size };
      const ms = pace(a);
      return {
        record: { op, id: a.id, with: neu },
        lines: [`animate(${J(a.id)}, {opacity: 0}, {duration: ${ms}}).then(() => removeByUid(${J(a.id)}))`, createLine(neu, ms)]
      };
    }

    case 'deemphasize':
    case 'focus': {
      const ids = expand(model, a.ids, op);
      const opacity = {};
      if (op === 'deemphasize') {
        const level = a.level || 'dim';
        if (!OPACITY[level]) throw new Error('deemphasize: level must be dim or faint');
        [...ids, ...relationsWithin(model, ids)].forEach(id => { opacity[id] = OPACITY[level]; });
      } else {
        const lit = [...ids, ...relationsWithin(model, ids)];
        lit.forEach(id => { opacity[id] = 1; });
        if (a.dim_others !== false) {
          Object.values(model.objects).concat(Object.values(model.relations))
            .filter(x => !lit.includes(x.id) && x.opacity > OPACITY.dim).forEach(x => { opacity[x.id] = OPACITY.dim; });
        }
      }
      return { record: { op, ids: a.ids, opacity }, lines: [fadeAll(Object.entries(opacity), pace(a))] };
    }

    case 'move_into': {
      const o = need(model, a.id, op), t = need(model, a.into, op);
      if (a.id === a.into) throw new Error('move_into: a concept cannot move into itself');
      const tb = boxOf(t);
      const scale = a.scale != null ? num(a.scale, 'move_into: scale', 0.05, 3) : Math.max(0.5, Math.min(1, (tb.w * 1.6) / o.size[0]));
      const h = o.size[1] * scale;
      // Over a figure's head; in the middle of anything else.
      const at = t.kind === 'figure' ? [Math.round(tb.x + tb.w / 2), Math.round(tb.y - h / 2 - 6)] : [Math.round(tb.x + tb.w / 2), Math.round(tb.y + tb.h / 2)];
      return {
        record: { op, id: a.id, into: a.into, at, scale },
        lines: [`animate(${J(a.id)}, {left: ${at[0]}, top: ${at[1]}, scaleX: ${scale}, scaleY: ${scale}}, {duration: ${pace(a, 'deliberate')}})`]
      };
    }

    case 'widen_context': {
      const ids = a.ids ? expand(model, a.ids, op) : Object.keys(model.objects);
      // An enclosure goes with its members.
      Object.values(model.objects).forEach(o => {
        if (o.members && !ids.includes(o.id) && o.members.every(m => ids.includes(m))) ids.push(o.id);
      });
      if (!ids.length) throw new Error('widen_context: nothing to widen');
      const k = a.scale == null ? 0.45 : num(a.scale, 'widen_context: scale', 0.01, 1);
      const [cx, cy] = centreOf(model, ids);
      if (!REGIONS[a.region || 'center']) throw new Error(`widen_context: region must be one of ${Object.keys(REGIONS).join(', ')}`);
      const mode = a.mode || 'camera';
      if (mode === 'camera') {
        const zoom = +(zoomOf(model) * k).toFixed(4);
        if (zoom < 0.05) throw new Error('widen_context: the camera cannot pull back that far');
        const [sx, sy] = REGIONS[a.region || 'center'];
        const camera = { zoom, pan: [Math.round(sx - cx * zoom), Math.round(sy - cy * zoom)] };
        return { record: { op, mode, ids: a.ids, scale: k, camera }, lines: [cameraLine(camera, pace(a, 'deliberate'))] };
      }
      if (mode !== 'objects') throw new Error('widen_context: mode must be camera or objects');
      const [tx, ty] = toScene(model, REGIONS[a.region || 'center']);
      const moves = {};
      ids.forEach(id => {
        const o = model.objects[id];
        moves[id] = { at: [Math.round(tx + (o.at[0] - cx) * k), Math.round(ty + (o.at[1] - cy) * k)], scale: +((o.scale || 1) * k).toFixed(3) };
      });
      const ms = pace(a, 'deliberate');
      // Curved arrows between shrinking concepts curve less, in proportion.
      const bends = {};
      Object.values(model.relations).forEach(r => {
        if (typeof r.bend === 'number' && r.bend && moves[r.from] && moves[r.to]) bends[r.id] = Math.round(r.bend * k) || Math.sign(r.bend);
      });
      const rebend = Object.entries(bends).map(([id, b]) => `setCustomData(${J(id)}, {bend: ${b}}), `).join('');
      return {
        record: { op, ids: a.ids, scale: k, moves, ...(Object.keys(bends).length ? { bends } : {}) },
        lines: [`Promise.all([${rebend}${Object.entries(moves).map(([id, m]) => `animate(${J(id)}, {left: ${m.at[0]}, top: ${m.at[1]}, scaleX: ${m.scale}, scaleY: ${m.scale}}, {duration: ${ms}})`).join(', ')}])`]
      };
    }

    case 'dissolve_boundary': {
      if (!Array.isArray(a.ids) || a.ids.length < 2) throw new Error('dissolve_boundary: ids needs two or more concepts');
      a.ids.forEach(id => {
        const o = need(model, id, op);
        if (o.kind !== 'text' && o.kind !== 'box') throw new Error(`dissolve_boundary: "${id}" is a ${o.kind}; only text and box concepts`);
      });
      checkNewId(model, a.id);
      const colors = a.colors || ['#90caf9', '#ffcc80'];
      if (!Array.isArray(colors) || colors.length < 2 || !colors.every(c => typeof c === 'string' && /^[#\w(),.\s%]+$/.test(c))) throw new Error('dissolve_boundary: colors takes two or more CSS colours');
      const { at, size } = boxAround(model, a.ids.map(id => boxOf(model.objects[id])), 24);
      const ms = pace(a, 'deliberate');
      const stops = colors.map((c, i) => `{offset: ${+(i / (colors.length - 1)).toFixed(3)}, color: ${J(c)}}`).join(', ');
      const ids = J(a.ids);
      return {
        record: { op, id: a.id, ids: a.ids, colors, at, size },
        lines: [
          // The boundaries weaken first, so the binary fails before the continuum shows.
          `Promise.all(${ids}.map(id => animate(id, {opacity: 0.55}, {duration: ${Math.round(ms / 3)}}))).then(() => ${ids}.forEach(id => setLabelBoundary(id, "dashed")))`,
          `Promise.resolve(addRect(${at[0]}, ${at[1]}, ${size[0]}, ${size[1]}, {uid: ${J(a.id)}, originX: "center", originY: "center", rx: 18, ry: 18, strokeWidth: 0, opacity: 0, fill: new fabric.Gradient({type: "linear", gradientUnits: "percentage", coords: {x1: 0, y1: 0, x2: 1, y2: 0}, colorStops: [${stops}]})})).then(r => (sendToBack(r), animate(r, {opacity: 1}, {duration: ${ms}})))`,
          `Promise.all([${a.ids.map(id => `(setLabelBoundary(${J(id)}, "none"), animate(${J(id)}, {opacity: ${model.objects[id].opacity}}, {duration: ${Math.round(ms / 3)}}))`).join(', ')}])`
        ]
      };
    }

    case 'checkpoint': {
      if (!a.name || typeof a.name !== 'string') throw new Error('checkpoint: name is required');
      const uids = [...Object.keys(model.objects), ...Object.keys(model.relations)];
      return { record: { op, name: a.name, state: snapshot(model) }, lines: [`tagState(${J(a.name)}, ${J(uids)})`] };
    }

    case 'return_to': {
      const ms = pace(a, 'deliberate');
      if (a.name) {
        const st = model.checkpoints[a.name];
        if (!st) throw new Error(`return_to: no checkpoint "${a.name}"`);
        const lines = [];
        // What came after the checkpoint fades out (its arrows go with it).
        const removed = Object.keys(model.objects).filter(id => !st.objects[id]);
        const unlinked = Object.values(model.relations)
          .filter(r => !st.relations[r.id] && !removed.includes(r.from) && !removed.includes(r.to)).map(r => r.id);
        if (removed.length || unlinked.length) {
          const gone = [...removed, ...unlinked];
          lines.push(`${fadeAll(gone.map(id => [id, 0]), Math.round(ms / 2))}.then(() => ${J(gone)}.forEach(removeByUid))`);
        }
        // revertState puts back places and looks but not how arrows curve, so
        // that is set first (it redraws them at the end).
        const known = id => model.relations[id] || model.retiredRelations[id] || {};
        const rebend = Object.values(st.relations).filter(r => r.bend && known(r.id).bend !== r.bend)
          .map(r => `setCustomData(${J(r.id)}, {bend: ${J(r.bend)}})`);
        lines.push(rebend.length ? `Promise.resolve().then(() => { ${rebend.join('; ')}; }).then(() => revertState(${J(a.name)}, {duration: ${ms}}))`
          : `revertState(${J(a.name)}, {duration: ${ms}})`);
        // Label text and boundaries are not part of a tag either.
        const fixes = Object.values(st.objects).filter(o => o.kind === 'text' || o.kind === 'box').flatMap(o => {
          const now = model.objects[o.id] || (model.retired[o.id] || {}).object || {};
          return [...(now.text !== o.text ? [`setLabelText(${J(o.id)}, ${J(o.text)})`] : []),
            ...(now.boundary !== o.boundary ? [`setLabelBoundary(${J(o.id)}, ${J(o.boundary)})`] : [])];
        });
        if (fixes.length) lines.push(`Promise.resolve().then(() => { ${fixes.join('; ')}; })`);
        const c = model.camera;
        if (c.zoom !== st.camera.zoom || c.pan[0] !== st.camera.pan[0] || c.pan[1] !== st.camera.pan[1]) lines.push(cameraLine(st.camera, ms));
        return { record: { op, name: a.name, removed, unlinked }, lines };
      }
      if (!Array.isArray(a.ids) || !a.ids.length) throw new Error('return_to: give a checkpoint name or ids of removed concepts');
      a.ids.forEach(id => {
        if (!model.retired[id]) throw new Error(`return_to: "${id}" was not removed`);
        if (model.objects[id] || model.relations[id]) throw new Error(`return_to: "${id}" is in use again`);
      });
      // Relationships come back once both their ends are back.
      const back = new Set([...Object.keys(model.objects), ...a.ids]);
      const pending = Object.values(model.retiredRelations);
      const relations = pending.filter(r => back.has(r.from) && back.has(r.to) && !model.relations[r.id]);
      // restoreObject puts back the arrows that went with a concept, whether
      // or not the other end is there: they are taken off and drawn afresh.
      const touching = pending.filter(r => a.ids.includes(r.from) || a.ids.includes(r.to) || relations.includes(r)).map(r => r.id);
      const restore = [...a.ids.map(id => `restoreObject(${J(id)})`), ...touching.map(id => `removeByUid(${J(id)})`)];
      const fades = a.ids.map(id => {
        const o = model.retired[id].object, sc = o.scale == null ? 1 : o.scale;
        return `animate(${J(id)}, {left: ${o.at[0]}, top: ${o.at[1]}, scaleX: ${sc}, scaleY: ${sc}, opacity: ${o.opacity}}, {duration: ${ms}})`;
      });
      const lines = [`Promise.resolve().then(() => { ${restore.join('; ')}; }).then(() => Promise.all([${fades.join(', ')}]))`];
      if (relations.length) {
        lines.push(`Promise.all([${relations.map(r => `connectObjects(${J(r.from)}, ${J(r.to)}, ${J(r.id)}, {${r.bend ? `bend: ${J(r.bend)}, ` : ''}animate: true, duration: ${pace(a)}})`).join(', ')}])`);
      }
      return { record: { op, ids: a.ids, relations }, lines };
    }

    case 'turnover': {
      const g = model.groups[a.group];
      if (!g) throw new Error(`turnover: no group "${a.group}"`);
      const leaving = a.leaving || [];
      if (!Array.isArray(leaving)) throw new Error('turnover: leaving must be a list');
      leaving.forEach(id => { if (!g.members.includes(id)) throw new Error(`turnover: "${id}" is not in group "${a.group}"`); });
      const incoming = a.arriving || [];
      if (!Array.isArray(incoming) || (!leaving.length && !incoming.length)) throw new Error('turnover: give leaving and/or arriving members');
      const dir = a.direction || 'right';
      const step = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[dir];
      if (!step) throw new Error('turnover: direction must be right, left, down or up');
      const taken = new Set();
      const sample = model.objects[g.members[0]] || {};
      const arriving = incoming.map(it => {
        const item = typeof it === 'string' ? { text: it } : it;
        const id = idFor(item.id, item.text);
        checkNewId(model, id, taken); taken.add(id);
        const kind = sample.kind === 'box' ? 'box' : 'text';
        return { id, ...objectSpec(model, { kind, size: sample.fontSize ? sample.fontSize * zoomOf(model) : undefined, ...item }, item.text) };
      });
      const sizes = arriving.length ? await measure(arriving) : [];
      const staying = g.members.filter(m => !leaving.includes(m));
      if (!staying.length && !arriving.length) throw new Error('turnover: that would leave the group empty');
      // Arrivals come in at the end opposite to where leavers go.
      const order = step[0] + step[1] > 0 ? [...arriving.map(x => x.id), ...staying] : [...staying, ...arriving.map(x => x.id)];
      const sizeOf = id => (model.objects[id] ? model.objects[id].size.map(v => v * (model.objects[id].scale || 1)) : sizes[arriving.findIndex(x => x.id === id)]);
      const [cx, cy] = centreOf(model, g.members);
      const centres = layoutRun(model, order.map(sizeOf), step[0] !== 0 ? 'row' : 'column', { x: cx, y: cy }, 32);
      const at = Object.fromEntries(order.map((id, i) => [id, centres[i]]));
      const moves = Object.fromEntries(staying.map(id => [id, at[id]]));
      const placed = arriving.map((x, i) => ({ ...x, at: at[x.id], size: sizes[i] }));
      const ms = pace(a, 'deliberate'), d = 80 / zoomOf(model);
      const lines = [];
      if (leaving.length) {
        lines.push(`Promise.all([${leaving.map(id => { const o = model.objects[id]; return `animate(${J(id)}, {left: ${Math.round(o.at[0] + step[0] * d)}, top: ${Math.round(o.at[1] + step[1] * d)}, opacity: 0}, {duration: ${ms}})`; }).join(', ')}]).then(() => ${J(leaving)}.forEach(removeByUid))`);
      }
      const shifts = staying.map(id => `animate(${J(id)}, {left: ${moves[id][0]}, top: ${moves[id][1]}}, {duration: ${ms}})`);
      // The group's enclosure is refitted round its new members.
      let enclosure;
      if (g.enclosure && model.objects[g.enclosure]) {
        const boxes = order.map(id => { const [w, h] = sizeOf(id); return { x: at[id][0] - w / 2, y: at[id][1] - h / 2, w, h }; });
        enclosure = { id: g.enclosure, ...boxAround(model, boxes, 20) };
        shifts.push(`animate(${J(g.enclosure)}, {left: ${enclosure.at[0]}, top: ${enclosure.at[1]}, width: ${enclosure.size[0]}, height: ${enclosure.size[1]}}, {duration: ${ms}})`);
      }
      if (shifts.length) lines.push(`Promise.all([${shifts.join(', ')}])`);
      if (placed.length) lines.push(`Promise.all([${placed.map(q => createLine(q, ms)).join(', ')}])`);
      return { record: { op, group: a.group, leaving, moves, arriving: placed, members: order, ...(enclosure ? { enclosure } : {}) }, lines };
    }

    case 'narrow_context': {
      let camera;
      if (a.reset) camera = { zoom: 1, pan: [0, 0] };
      else {
        const ids = expand(model, a.ids, op);
        const fill = a.fill == null ? 0.7 : num(a.fill, 'narrow_context: fill', 0.1, 1);
        const bs = ids.map(id => boxOf(model.objects[id]));
        const w = Math.max(...bs.map(b => b.x + b.w)) - Math.min(...bs.map(b => b.x));
        const h = Math.max(...bs.map(b => b.y + b.h)) - Math.min(...bs.map(b => b.y));
        const zoom = +Math.min(2, Math.max(0.05, Math.min(CANVAS.width * fill / w, CANVAS.height * fill / h))).toFixed(4);
        const [cx, cy] = centreOf(model, ids);
        camera = { zoom, pan: [Math.round(CANVAS.width / 2 - cx * zoom), Math.round(CANVAS.height / 2 - cy * zoom)] };
      }
      return { record: { op, ids: a.ids, reset: a.reset || undefined, camera }, lines: [cameraLine(camera, pace(a, 'deliberate'))] };
    }

    case 'pause': {
      const kind = a.kind || 'short';
      const seconds = a.seconds != null ? num(a.seconds, 'pause: seconds', 0, 600) : PAUSE[kind];
      if (seconds == null) throw new Error(`pause: kind must be ${Object.keys(PAUSE).join(', ')} (or give seconds)`);
      return { record: { op, kind, seconds }, lines: [`Promise.resolve(sleep(${seconds}))`] };
    }

    case 'remove': {
      const ids = expand(model, a.ids, op);
      const ms = pace(a);
      return { record: { op, ids }, lines: [`${fadeAll(ids.map(id => [id, 0]), ms)}.then(() => ${J(ids)}.forEach(removeByUid))`] };
    }
  }
  throw new Error(`unhandled op ${op}`);
}

function checkTask(t) {
  if (!VIEWER_TASKS.includes(t.type)) throw new Error(`viewer_task: type must be ${VIEWER_TASKS.join(', ')}`);
  if (!t.target) throw new Error('viewer_task: target is required (what the viewer should arrive at)');
}

// Plans every action in order against the evolving model. Nothing is returned
// for a list with a failing action: the caller plays all of it or none.
export async function planActions(model, actions, measure) {
  const lines = [], records = [];
  for (let i = 0; i < actions.length; i++) {
    let planned;
    try { planned = await planAction(model, actions[i], measure); }
    catch (e) { throw new Error(`Action ${i + 1} (${actions[i] && actions[i].op}): ${e.message}`); }
    applyRecord(model, planned.record);
    records.push(planned.record);
    lines.push(TAG + JSON.stringify(planned.record), ...planned.lines);
  }
  return { lines, records };
}

// The last action's annotation and the lines after it, removed.
export function withoutLastAction(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (String(lines[i]).trim().startsWith(TAG.trim())) return { lines: lines.slice(0, i), removed: lines.slice(i) };
  }
  return null;
}

// ---- inspecting and validating -----------------------------------------------

// The model in a form for reading, with live boxes (from list_objects) where given.
export function inspect(model, live) {
  const liveBy = new Map((live || []).filter(o => o.uid && !o.parent).map(o => [o.uid, o]));
  const objects = Object.values(model.objects).map(o => {
    const out = { id: o.id, kind: o.kind, text: o.text, role: o.role || undefined, scene: o.scene || undefined, beat: o.beat || undefined };
    if (o.history.length > 1) out.revisions = o.history;
    if (o.members) out.members = o.members;
    if (o.inside) out.inside = o.inside;
    if (o.boundary !== 'none') out.boundary = o.boundary;
    if (o.questioned) out.questioned = true;
    if (o.opacity !== 1) out.emphasis = o.opacity <= OPACITY.faint ? 'faint' : o.opacity <= OPACITY.dim ? 'dim' : 'partial';
    if (o.scale !== 1) out.scale = o.scale;
    out.at = o.at;
    const l = liveBy.get(o.id);
    if (live) out.live = l ? { box: l.box, visible: l.visible, opacity: l.opacity } : 'missing from canvas';
    return out;
  });
  const relations = Object.values(model.relations).map(r => ({ id: r.id, from: r.from, to: r.to, kind: r.kind || undefined, ...(r.opacity !== 1 ? { emphasis: 'dim' } : {}) }));
  const extra = live ? [...liveBy.keys()].filter(uid => !model.objects[uid] && !model.relations[uid]) : [];
  return {
    camera: model.camera, scene: model.scene, beat: model.beat, scenes: model.scenes.map(s => s.name), beats: model.beats,
    viewerTasks: model.viewerTasks, groups: Object.values(model.groups), objects, relations,
    checkpoints: Object.keys(model.checkpoints), removed: Object.keys(model.retired),
    ...(extra.length ? { notInModel: extra } : {}),
    actions: model.log, ...(model.problems && model.problems.length ? { problems: model.problems } : {})
  };
}

// Straight ends of a connector between two model boxes: facing edges where
// the boxes are apart, centres where they overlap (as the page's connectorEnds).
function connectorEnds(a, b) {
  let x1, x2, y1, y2;
  if (b.x > a.x + a.w) { x1 = a.x + a.w; x2 = b.x; } else if (b.x + b.w < a.x) { x1 = a.x; x2 = b.x + b.w; } else { x1 = a.x + a.w / 2; x2 = b.x + b.w / 2; }
  if (b.y > a.y + a.h) { y1 = a.y + a.h; y2 = b.y; } else if (b.y + b.h < a.y) { y1 = a.y; y2 = b.y + b.h; } else { y1 = a.y + a.h / 2; y2 = b.y + b.h / 2; }
  return [x1, y1, x2, y2];
}

// The pieces of a connector to test for crossings: the straight line, or two
// chords through the middle of a curve. `mid` is the curve's middle point.
export function connectorChords([x1, y1, x2, y2], mid) {
  return mid ? [[x1, y1, mid[0], mid[1]], [mid[0], mid[1], x2, y2]] : [[x1, y1, x2, y2]];
}

const bendMiddle = ([x1, y1, x2, y2], bend) => {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  return [(x1 + x2) / 2 + (y2 - y1) / len * bend, (y1 + y2) / 2 - (x2 - x1) / len * bend];
};

// 'auto': straight if that is clear of other concepts and not on top of a
// straight reverse arrow; else the smallest bend, either way, that is clear.
function chooseBend(model, from, to, bend) {
  if (bend !== 'auto') return num(bend, 'connect: bend', -600, 600);
  const ends = connectorEnds(boxOf(model.objects[from]), boxOf(model.objects[to]));
  const others = Object.values(model.objects)
    .filter(o => o.id !== from && o.id !== to && o.kind !== 'enclosure' && o.kind !== 'spectrum' && o.opacity > 0)
    .map(o => { const b = boxOf(o); return { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 8 }; });
  const reverse = Object.values(model.relations).some(r => r.from === to && r.to === from && !r.bend);
  // Bends grow with the arrow: a short arrow only needs a slight curve.
  const len = Math.hypot(ends[2] - ends[0], ends[3] - ends[1]);
  const k = Math.min(1 / zoomOf(model), Math.max(0.25, len / 260));
  for (const c of [0, 50, -50, 100, -100, 160, -160]) {
    if (c === 0 && reverse) continue;
    const chords = connectorChords(ends, c ? bendMiddle(ends, c * k) : null);
    if (!others.some(b => chords.some(ch => segmentHitsBox(ch, b)))) return c && Math.round(c * k);
  }
  return reverse ? Math.round(50 * k) : 0;
}

// Whether the segment [x1, y1, x2, y2] crosses the box (Liang-Barsky clipping).
export function segmentHitsBox([x1, y1, x2, y2], b) {
  if (b.w <= 0 || b.h <= 0) return false;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x1 - b.x], [dx, b.x + b.w - x1], [-dy, y1 - b.y], [dy, b.y + b.h - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

// Problems a reviewer would catch at a glance. `live` is list_objects output.
export function validate(model, live) {
  const issues = [];
  const liveBy = new Map((live || []).filter(o => o.uid && !o.parent).map(o => [o.uid, o]));
  (model.problems || []).forEach(p => issues.push({ level: 'error', message: p }));
  const objs = Object.values(model.objects);
  const shown = objs.filter(o => {
    const l = liveBy.get(o.id);
    if (!l) { issues.push({ level: 'error', id: o.id, message: `"${o.id}" is in the scene model but not on the canvas (lines edited by hand?)` }); return false; }
    return l.visible && l.opacity > 0;
  });
  Object.values(model.relations).forEach(r => {
    if (!model.objects[r.from] || !model.objects[r.to]) issues.push({ level: 'error', id: r.id, message: `relationship "${r.id}" points at a concept that no longer exists` });
    else if (!liveBy.get(r.id)) issues.push({ level: 'error', id: r.id, message: `relationship "${r.id}" is not on the canvas` });
  });
  const v = view(model);
  shown.forEach(o => {
    const b = liveBy.get(o.id).box;
    if (b.left < v.x || b.top < v.y || b.left + b.width > v.x + v.w || b.top + b.height > v.y + v.h) {
      issues.push({ level: 'warning', id: o.id, message: `"${o.id}" is partly out of view` });
    }
    RESERVED.forEach(r => {
      if (overlaps({ x: b.left, y: b.top, w: b.width, h: b.height }, screenRect(model, r))) issues.push({ level: 'warning', id: o.id, message: `"${o.id}" is under the page's ${r.name}` });
    });
    const px = o.fontSize * o.scale * zoomOf(model);
    if (o.fontSize && px < 13) {
      issues.push({ level: o.opacity < 1 ? 'info' : 'warning', id: o.id, message: `"${o.id}" text shows at about ${Math.round(px)} px: hard to read (fine if it was made small on purpose, e.g. by widen_context)` });
    }
  });
  const liveBox = o => { const b = liveBy.get(o.id).box; return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const p = shown[i], q = shown[j];
      if (p.inside === q.id || q.inside === p.id) continue;
      const bp = liveBox(p), bq = liveBox(q);
      const isBox = o => o.kind === 'enclosure' || o.kind === 'spectrum';
      const enc = isBox(p) ? p : isBox(q) ? q : null;
      if (enc && isBox(p) !== isBox(q)) {
        const other = enc === p ? q : p, be = liveBox(enc), bo = liveBox(other);
        if (enc.members.includes(other.id)) {
          if (!contains(be, bo)) issues.push({ level: 'warning', id: enc.id, message: `"${other.id}" belongs in enclosure "${enc.id}" but sticks out of it` });
        } else if (overlaps(be, bo, -2)) {
          issues.push({ level: 'warning', id: enc.id, message: `"${other.id}" is ${contains(be, bo) ? 'inside' : 'across'} enclosure "${enc.id}" but is not one of its members` });
        }
        continue;
      }
      if (isBox(p) && isBox(q) && (contains(bp, bq) || contains(bq, bp))) continue;
      if (overlaps(bp, bq, -2)) issues.push({ level: 'warning', id: p.id, message: `"${p.id}" and "${q.id}" overlap` });
    }
  }
  Object.values(model.relations).forEach(r => {
    const l = liveBy.get(r.id);
    if (!l || !l.ends || !l.visible || !(l.opacity > 0)) return;
    shown.filter(o => !o.members && o.id !== r.from && o.id !== r.to && o.inside !== r.from && o.inside !== r.to)
      .forEach(o => {
        const b = liveBox(o);
        const inner = { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 8 };
        if (connectorChords(l.ends, l.bend).some(ch => segmentHitsBox(ch, inner))) {
          issues.push({ level: 'warning', id: r.id, message: `relationship "${r.id}" runs through "${o.id}"` });
        }
      });
  });
  if (model.scene && !model.viewerTasks.some(t => t.scene === model.scene)) {
    issues.push({ level: 'info', message: `scene "${model.scene}" has no viewer_task: what should the viewer be doing?` });
  }
  return issues;
}
