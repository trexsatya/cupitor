// The scene layer without a browser: sizes come from a fake measurer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyScene, parseScene, planActions, boxOf, validate, withoutLastAction, view, TAG, lineTime, timeline, captionsFile, narrationIssues, connectorEnds, connectorChords, segmentHitsBox } from '../scene.js';

const measure = async specs => specs.map(s => (s.kind === 'steps' ? [300, s.items.length * 60, -130, -(s.items.length - 1) * 30] : s.kind === 'figure' ? [50, 130] : [String(s.text).length * 12 + 24, 50]));
const plan = async (actions, model = emptyScene()) => ({ model, ...(await planActions(model, actions, measure)) });
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const WHY_ACTION = [
  { op: 'scene', name: 'why_action' },
  { op: 'viewer_task', type: 'infer', target: 'behaviour has many interacting causes' },
  { op: 'introduce', id: 'person', kind: 'figure', text: 'PERSON' },
  { op: 'introduce', id: 'action', text: 'ACTION', place: { near: 'person', side: 'right' } },
  { op: 'connect', from: 'person', to: 'action' },
  { op: 'pause', kind: 'prediction' },
  ...['CULTURE', 'BIOLOGY', 'HABIT', 'CHILDHOOD', 'UNKNOWN'].flatMap(t => [
    { op: 'introduce', text: t, role: 'cause', place: { near: 'person', side: 'left' } },
    { op: 'connect', from: t.toLowerCase(), to: 'person' }
  ])
];

test('the script alone rebuilds the same scene', async () => {
  const { model, lines } = await plan(WHY_ACTION);
  const rebuilt = parseScene(['addRect(1,1,2,2)', ...lines]);
  assert.deepEqual(rebuilt.objects, model.objects);
  assert.deepEqual(rebuilt.relations, model.relations);
  assert.equal(rebuilt.viewerTasks[0].type, 'infer');
  assert.equal(Object.values(rebuilt.objects).filter(o => o.role === 'cause').length, 5);
});

test('placed concepts stay on the canvas without overlapping', async () => {
  const { model } = await plan(WHY_ACTION);
  const boxes = Object.values(model.objects).map(boxOf);
  boxes.forEach(b => assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1400 && b.y + b.h <= 800, JSON.stringify(b)));
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => assert.ok(!hit(a, b), `${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`)));
  // "left of person" means left of it.
  assert.ok(model.objects.culture.at[0] < model.objects.person.at[0]);
});

test('one bad action applies none of the list', async () => {
  await assert.rejects(plan([{ op: 'introduce', text: 'A' }, { op: 'connect', from: 'a', to: 'nobody' }]), /Action 2 \(connect\): .*nobody/);
});

test('revise and question keep the concept, replace swaps it and its relationships', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'k', text: 'I KNOW', kind: 'box' },
    { op: 'introduce', id: 'n', text: 'NOTHING', place: { near: 'k' } },
    { op: 'connect', from: 'k', to: 'n' },
    { op: 'revise', id: 'k', text: 'I THINK I KNOW' },
    { op: 'question', id: 'k' },
    { op: 'replace', id: 'n', with: { id: 'god', text: 'GOD?' } }
  ]);
  assert.deepEqual(model.objects.k.history, ['I KNOW', 'I THINK I KNOW', 'I THINK I KNOW?']);
  assert.equal(model.objects.k.boundary, 'dashed');
  assert.equal(model.objects.n, undefined);
  // The replacement takes the place NOTHING was pushed to as I KNOW grew.
  const start = (await plan([{ op: 'introduce', id: 'k', text: 'I KNOW', kind: 'box' }, { op: 'introduce', id: 'n', text: 'NOTHING', place: { near: 'k' } }])).model.objects.n.at;
  assert.ok(model.objects.god.at[0] > start[0] && model.objects.god.at[1] === start[1]);
  assert.ok(!hit(boxOf(model.objects.god), boxOf(model.objects.k)));
  assert.deepEqual(model.relations, {});
});

test('widening takes an enclosure along with its members', async () => {
  const { model, lines } = await plan([
    { op: 'introduce_group', id: 'practical', items: ['EAT', 'STUDY', 'LIVE'] },
    { op: 'enclose', id: 'practical_box', group: 'practical' },
    { op: 'widen_context', ids: ['eat', 'study', 'live'], scale: 0.5, mode: 'objects' }
  ]);
  assert.equal(model.objects.practical_box.scale, 0.5);
  assert.match(lines.at(-1), /animate\("practical_box"/);
});

test('undo cuts the last action and its lines', async () => {
  const { lines } = await plan([{ op: 'introduce', text: 'A' }, { op: 'introduce', text: 'B' }]);
  const cut = withoutLastAction(lines);
  assert.ok(cut.removed[0].startsWith(TAG));
  assert.deepEqual(Object.keys(parseScene(cut.lines).objects), ['a']);
});

test('validation: hand-deleted objects, enclosures catching outsiders, no viewer task', async () => {
  const { model } = await plan([
    { op: 'scene', name: 's' },
    { op: 'introduce_group', id: 'g', items: ['EAT', 'STUDY'] },
    { op: 'enclose', id: 'box', group: 'g' },
    { op: 'introduce', id: 'q', text: 'WHY?', place: { region: 'top' } }
  ]);
  const live = Object.values(model.objects).map(o => {
    const b = boxOf(o);
    return { uid: o.id, visible: true, opacity: 1, box: { left: b.x, top: b.y, width: b.w, height: b.h } };
  });
  // q dragged into the enclosure; study deleted by hand.
  const box = live.find(l => l.uid === 'box').box;
  Object.assign(live.find(l => l.uid === 'q').box, { left: box.left + 4, top: box.top + 4 });
  const issues = validate(model, live.filter(l => l.uid !== 'study')).map(i => i.message).join('\n');
  assert.match(issues, /"study" is in the scene model but not on the canvas/);
  assert.match(issues, /"q" is (inside|across) enclosure "box" but is not one of its members/);
  assert.match(issues, /no viewer_task/);
});

test('validation: an arrow running through another concept', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'a', text: 'A', place: { x: 200, y: 300 } },
    { op: 'introduce', id: 'b', text: 'B', place: { x: 400, y: 300 } },
    { op: 'introduce', id: 'c', text: 'C', place: { x: 600, y: 300 } },
    { op: 'connect', from: 'a', to: 'c' }
  ]);
  const live = Object.values(model.objects).map(o => {
    const b = boxOf(o);
    return { uid: o.id, visible: true, opacity: 1, box: { left: b.x, top: b.y, width: b.w, height: b.h } };
  });
  live.push({ uid: 'a__c', visible: true, opacity: 1, ends: [236, 300, 564, 300], box: { left: 236, top: 300, width: 328, height: 0 } });
  const issues = validate(model, live).map(i => i.message);
  assert.deepEqual(issues.filter(m => /runs through/.test(m)), ['relationship "a__c" runs through "b"']);
});

test('group items keep their own kind and role', async () => {
  const { model } = await plan([{ op: 'introduce_group', id: 'g', role: 'option', items: [{ id: 'a', text: 'A', kind: 'box', role: 'claim' }, { id: 'f', kind: 'figure' }] }]);
  assert.deepEqual([model.objects.a.kind, model.objects.a.role, model.objects.f.kind, model.objects.f.role], ['box', 'claim', 'figure', 'option']);
  await assert.rejects(plan([{ op: 'question', id: 'f' }], model), /is a figure/);
});

test('removing tidies groups and enclosures', async () => {
  const { model } = await plan([
    { op: 'introduce_group', id: 'g', items: ['A', 'B'] },
    { op: 'enclose', id: 'e', group: 'g' },
    { op: 'remove', ids: ['b'] },
    { op: 'widen_context', ids: ['a'], scale: 0.5, mode: 'objects' },
    { op: 'remove', ids: ['e'] },
    { op: 'deemphasize', ids: ['g'] },
    { op: 'remove', ids: ['g'] }
  ]);
  assert.deepEqual(model.groups, {});
  await plan([{ op: 'introduce', id: 'g', text: 'G' }], model); // the id is free again
});

test('enclosures move with their remaining members', async () => {
  const { lines } = await plan([
    { op: 'introduce_group', id: 'g', items: ['A', 'B'] },
    { op: 'enclose', id: 'e', group: 'g' },
    { op: 'remove', ids: ['b'] },
    { op: 'widen_context', ids: ['a'], scale: 0.5, mode: 'objects' }
  ]);
  assert.match(lines.at(-1), /animate\("e"/);
});

test('refused: clashing branch arrow ids, no id or text, non-numbers bound for script lines', async () => {
  const { model } = await plan([{ op: 'introduce', id: 'a', text: 'A' }, { op: 'introduce', id: 'b', text: 'B', place: { near: 'a' } },
    { op: 'connect', from: 'a', to: 'b', id: 'a__c' }]);
  await assert.rejects(plan([{ op: 'branch', from: 'a', items: [{ id: 'c', text: 'C' }] }], model), /"a__c" is already used/);
  await assert.rejects(plan([{ op: 'introduce', kind: 'figure' }]), /give an id/);
  await assert.rejects(plan([{ op: 'introduce', text: 'A', place: { x: '0)); boom(); ((0', y: 5 } }]), /place.x must be a number/);
  await assert.rejects(plan([{ op: 'pause', seconds: '  ' }]), /seconds must be a number/);
});

test('dashing a removed enclosure outline brings it back', async () => {
  const { lines } = await plan([{ op: 'introduce', id: 'a', text: 'A' }, { op: 'enclose', id: 'e', members: ['a'] },
    { op: 'weaken_boundary', id: 'e', style: 'none' }, { op: 'weaken_boundary', id: 'e', style: 'dashed' }]);
  assert.match(lines.at(-1), /setProp\("e", "strokeWidth", 2\)/);
});

// ---- Milestone 2

test('camera: widening pulls the view back; new concepts land in view at the same on-screen size; reset comes back', async () => {
  const { model, lines } = await plan([
    { op: 'scene', name: 's' },
    { op: 'introduce', id: 'a', text: 'A' },
    { op: 'widen_context', scale: 0.5 },
    { op: 'introduce', id: 'b', text: 'B', place: { region: 'top-left' } }
  ]);
  assert.match(lines[1], /^animateViewport\(\{zoom: 1, pan: \[0, 0\]\}, \{duration: 0\}\)$/, 'a script starts from the starting view');
  assert.equal(model.camera.zoom, 0.5);
  assert.equal(model.objects.b.fontSize, 44);
  const v = view(model), b = boxOf(model.objects.b);
  assert.ok(b.x >= v.x && b.y >= v.y && b.x + b.w <= v.x + v.w && b.y + b.h <= v.y + v.h);
  assert.deepEqual(parseScene(lines).camera, model.camera);
  await plan([{ op: 'narrow_context', reset: true }], model);
  assert.deepEqual(model.camera, { zoom: 1, pan: [0, 0] });
});

test('connect bends round a concept in the way, off a straight reverse arrow, and loops on itself', async () => {
  const { model, lines } = await plan([
    { op: 'introduce', id: 'a', text: 'A', place: { x: 200, y: 300 } },
    { op: 'introduce', id: 'b', text: 'B', place: { x: 450, y: 300 } },
    { op: 'introduce', id: 'c', text: 'C', place: { x: 700, y: 300 } },
    { op: 'connect', from: 'a', to: 'b' },
    { op: 'connect', from: 'a', to: 'c' },
    { op: 'connect', from: 'b', to: 'a' },
    { op: 'connect', from: 'c', to: 'c' }
  ]);
  assert.equal(model.relations.a__b.bend, 0);
  assert.notEqual(model.relations.a__c.bend, 0);
  assert.notEqual(model.relations.b__a.bend, 0);
  assert.equal(model.relations.c__c.bend, 'loop');
  assert.match(lines.at(-1), /connectObjects\("c", "c", "c__c", \{bend: "loop"/);
});

test('arrows leave from the middle of an edge, not a corner, unless a side is named', async () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };
  assert.deepEqual(connectorEnds(a, { x: 300, y: 200, w: 100, h: 50 }), [50, 50, 350, 200]); // mostly below: bottom to top
  assert.deepEqual(connectorEnds(a, { x: 300, y: 60, w: 100, h: 50 }), [100, 25, 300, 85]); // mostly beside: right to left
  assert.deepEqual(connectorEnds(a, { x: 300, y: 200, w: 100, h: 50 }, { from: 'bottom-right', to: 'left' }), [100, 50, 300, 225]);
  // One side named: the other end faces it when the other box lies that way, else keeps its own choice.
  const far = { x: -200, y: -300, w: 100, h: 50 }; // mostly above, a little left: on its own the arrow would end on its bottom
  assert.deepEqual(connectorEnds(a, far), [50, 0, -150, -250]);
  assert.deepEqual(connectorEnds(a, far, { from: 'left' }), [0, 25, -100, -275]);
  assert.deepEqual(connectorEnds(far, a, { to: 'left' }), [-100, -275, 0, 25]);
  assert.deepEqual(connectorEnds(a, { x: 300, y: 200, w: 100, h: 50 }, { from: 'left' }), [0, 25, 350, 200]); // target not to the left
  const { model, lines } = await plan([
    { op: 'introduce', id: 'a', text: 'A', place: { x: 100, y: 100 } },
    { op: 'introduce', id: 'b', text: 'B', place: { x: 500, y: 400 } },
    { op: 'connect', from: 'a', to: 'b', from_side: 'top-right' }
  ]);
  assert.deepEqual(model.relations.a__b.sides, { from: 'top-right' });
  assert.match(lines.at(-1), /connectObjects\("a", "b", "a__b", \{sides: \{"from":"top-right"\}, animate: true/);
  assert.deepEqual(parseScene(lines).relations.a__b.sides, { from: 'top-right' });
  await assert.rejects(plan([...WHY_ACTION.slice(2, 4), { op: 'connect', from: 'person', to: 'action', to_side: 'middle' }]), /to_side is one of top, bottom/);
});

test('type and write: a concept formulated in front of the viewer, timed by its characters; written ones stay in handwriting', async () => {
  const seen = [];
  const measuring = async specs => { seen.push(...specs); return measure(specs); };
  const { model, lines } = await planActions(emptyScene(), [
    { op: 'type', id: 'q', text: 'WHO SETS THE FRAME?', role: 'power', place: { region: 'top' } },
    { op: 'write', id: 'h', text: 'VEM SÄTTER RAMEN?', kind: 'box', pace: 'deliberate' },
    { op: 'type', id: 'p', text: 'ABC', caret: false, characters_per_second: 3, place: { region: 'bottom' } },
    { op: 'revise', id: 'h', text: 'VEM?' }
  ], measuring).then(r => ({ ...r, model: parseScene(r.lines) }));
  const code = lines.filter(l => !l.startsWith('//'));
  assert.match(code[0], /^Promise\.resolve\(typeIn\(addLabel\("WHO SETS THE FRAME\?", .*"color":"#F59E0B".*\), \{duration: 633\}\)\)$/); // 19 characters at 30 a second
  assert.match(code[1], /^Promise\.resolve\(handFont\(\)\)\.then\(\(\) => writeIn\(addLabel\("VEM SÄTTER RAMEN\?", .*"boundary":"solid".*"hand":true\}\), \{duration: 2833\}\)\)$/); // 17 at 6
  assert.match(code[2], /\{duration: 1000, caret: false\}/);
  assert.equal(model.objects.h.hand, true);
  assert.equal(model.objects.q.hand, undefined);
  const revised = seen.filter(s => s.text === 'VEM?');
  assert.ok(revised.length && revised.every(s => s.hand), 'a revision is measured in handwriting');
  assert.ok(lineTime(code[1]) >= 2833, 'the timeline counts the writing');
  await assert.rejects(plan([{ op: 'write', text: 'X', kind: 'figure' }]), /write: kind must be text or box/);
});

test('colour by role: own colour first, groups pass theirs on, kept through changes and back in the script; replace and turnover keep it unless given one', async () => {
  const { model, lines } = await plan([
    { op: 'introduce', id: 'people', text: 'PEOPLE', role: 'citizen' },
    { op: 'introduce', id: 'odd', text: 'ODD', role: 'citizen', color: 'rebeccapurple', place: { near: 'people', side: 'right' } },
    { op: 'introduce', id: 'plain', text: 'PLAIN', role: 'cause', place: { near: 'people', side: 'left' } },
    { op: 'introduce_group', id: 'risks', role: 'risk', place: { region: 'bottom' }, items: ['CRISIS', { id: 'facts', text: 'FACTS', role: 'knowledge' }, { id: 'mine', text: 'MINE', color: '#123456' }] },
    { op: 'revise', id: 'people', text: 'CITIZENS' },
    { op: 'question', id: 'people' },
    { op: 'deemphasize', ids: ['people'] },
    { op: 'replace', id: 'odd', with: { id: 'odder', text: 'ODDER' } },
    { op: 'turnover', group: 'risks', leaving: ['crisis'], arriving: ['FRAUD'] }
  ]);
  const color = id => model.objects[id].color;
  assert.equal(color('people'), '#3B82F6');
  assert.equal(color('odder'), 'rebeccapurple', 'replace keeps the old colour');
  assert.equal(color('plain'), undefined, 'a role outside the palette leaves the normal ink');
  assert.deepEqual([color('facts'), color('mine'), color('fraud')], ['#14B8A6', '#123456', '#EF4444']);
  assert.match(lines.find(l => l.startsWith("drawOutline(addLabel(\"PEOPLE\"")), /addLabel\("PEOPLE", .*"color":"#3B82F6"/);
  assert.equal(parseScene(lines).objects.people.color, '#3B82F6');
  await assert.rejects(plan([{ op: 'introduce', text: 'X', color: 'red; alert(1)' }]), /must be a CSS colour/);
  const tinted = await plan([
    { op: 'introduce_group', id: 'g', background: '#FEE2E2', role: 'risk', items: ['ONE', { id: 'two', text: 'TWO', background: '#DBEAFE' }] },
    { op: 'replace', id: 'one', with: { id: 'uno', text: 'UNO' } },
    { op: 'turnover', group: 'g', leaving: ['two'], arriving: ['THREE'] }
  ]);
  assert.deepEqual(['uno', 'three'].map(id => tinted.model.objects[id].background), ['#FEE2E2', '#FEE2E2'], 'arrivals look like a member that stays');
  assert.match(tinted.lines.find(l => l.startsWith('drawOutline(addLabel("UNO"')), /"background":"#FEE2E2"/);
  assert.equal(parseScene(tinted.lines).objects.uno.background, '#FEE2E2');
  await assert.rejects(plan([{ op: 'introduce', id: 'p', kind: 'figure', background: '#eee' }]), /background is for text and box/);
  const onlyTint = await plan([
    { op: 'introduce_group', id: 'h', background: '#eee', items: [{ id: 'k', text: 'K', role: 'power' }] },
    { op: 'turnover', group: 'h', leaving: [], arriving: ['L'] }
  ]);
  assert.deepEqual([onlyTint.model.objects.l.color, onlyTint.model.objects.l.background], ['#F59E0B', '#eee'], 'a group with only a background: colour from a staying member');
});

test('between, then dissolving the boundaries into one band', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'day', text: 'DAY', kind: 'box', place: { region: 'left' } },
    { op: 'introduce', id: 'night', text: 'NIGHT', kind: 'box', place: { region: 'right' } },
    { op: 'introduce', id: 'dusk', text: 'DUSK?', place: { between: ['day', 'night'] } },
    { op: 'dissolve_boundary', id: 'band', ids: ['day', 'dusk', 'night'] }
  ]);
  assert.ok(model.objects.day.at[0] < model.objects.dusk.at[0] && model.objects.dusk.at[0] < model.objects.night.at[0]);
  assert.deepEqual(['day', 'night'].map(id => model.objects[id].boundary), ['none', 'none']);
  const band = boxOf(model.objects.band);
  ['day', 'dusk', 'night'].map(id => boxOf(model.objects[id])).forEach(b => assert.ok(b.x > band.x && b.x + b.w < band.x + band.w));
});

test('return_to a checkpoint puts text, places and camera back; return_to ids revives a removed concept with its arrows', async () => {
  const { model, lines } = await plan([
    { op: 'introduce', id: 'k', text: 'I KNOW', kind: 'box' },
    { op: 'introduce', id: 'x', text: 'X', place: { near: 'k' } },
    { op: 'connect', from: 'k', to: 'x' },
    { op: 'checkpoint', name: 'start' },
    { op: 'revise', id: 'k', text: "I DON'T KNOW" },
    { op: 'widen_context', scale: 0.5 },
    { op: 'remove', ids: ['x'] },
    { op: 'return_to', name: 'start' }
  ]);
  assert.equal(model.objects.k.text, 'I KNOW');
  assert.ok(model.objects.x && model.relations.k__x);
  assert.deepEqual(model.camera, { zoom: 1, pan: [0, 0] });
  assert.ok(lines.some(l => l.includes('setLabelText("k", "I KNOW")')));
  assert.deepEqual(parseScene(lines).objects, model.objects);

  const again = await plan([{ op: 'introduce', id: 'k', text: 'K' }, { op: 'introduce', id: 'x', text: 'X', place: { near: 'k' } },
    { op: 'connect', from: 'k', to: 'x' }, { op: 'remove', ids: ['x'] }, { op: 'return_to', ids: ['x'] }]);
  assert.ok(again.model.objects.x && again.model.relations.k__x);
  assert.ok(again.lines.some(l => /restoreObject\("x"\)/.test(l)));
  // Still on screen, only dimmed: brought back to full strength; an unknown id is refused.
  const dimmed = await plan([{ op: 'deemphasize', ids: ['k'], level: 'faint' }, { op: 'return_to', ids: ['k'] }], again.model);
  assert.equal(dimmed.model.objects.k.opacity, 1);
  assert.match(dimmed.lines.at(-1), /^Promise\.all\(\[animate\("k", \{opacity: 1\}/);
  assert.equal(parseScene([...again.lines, ...dimmed.lines]).objects.k.opacity, 1);
  const both = await plan([{ op: 'deemphasize', ids: ['k', 'x'] }, { op: 'return_to', ids: ['k', 'x'] }], again.model);
  assert.equal(both.model.relations.k__x.opacity, 1, 'their arrow comes back with them');
  assert.equal(parseScene([...again.lines, ...both.lines]).relations.k__x.opacity, 1);
  await assert.rejects(plan([{ op: 'return_to', ids: ['nobody'] }], again.model), /no concept "nobody" to bring back/);
});

test('branch arrows curve round concepts in their way; nothing is placed under the narration caption', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'root', text: 'ROOT', place: { x: 700, y: 150 } },
    { op: 'introduce', id: 'wall', text: 'WALL WALL WALL', place: { x: 700, y: 300 } },
    // Out of ROOT's right side into each child's left one: straight, the arrows to the far children would cross the near ones.
    { op: 'branch', from: 'root', items: ['ONE', 'TWO', 'THREE'], side: 'below', from_side: 'right', to_side: 'left' }
  ]);
  const bends = ['one', 'two', 'three'].map(id => model.relations[`root__${id}`].bend || 0);
  assert.ok(bends.some(b => b !== 0), `some arrow curves: ${bends}`);
  const caption = { x: 342, y: 697, w: 700, h: 103 };
  const low = await plan([{ op: 'narrate', text: 'Words.' }, { op: 'introduce', id: 'low', text: 'A LONG QUESTION AT THE BOTTOM?', size: 'large', place: { region: 'bottom' } }]);
  assert.ok(!hit(boxOf(low.model.objects.low), caption), 'clear of the caption');
});

test('a new concept keeps off an arrow already drawn when a spot nearby is free; with none, it takes the usual one', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'a', text: 'A', place: { x: 300, y: 400 } },
    { op: 'introduce', id: 'b', text: 'B', place: { x: 1100, y: 400 } },
    { op: 'connect', from: 'a', to: 'b' },
    { op: 'introduce', id: 'c', text: 'MIDDLE', place: { region: 'center' } }
  ]);
  const c = boxOf(model.objects.c);
  assert.ok(c.y > 400 + 2 || c.y + c.h < 400 - 2, `clear of the arrow along y 400: ${JSON.stringify(c)}`);
  assert.ok(Math.hypot(c.x + c.w / 2 - 700, c.y + c.h / 2 - 400) <= 160 + 80, 'still near where it was asked for');
  // An exact place is kept, arrow or not.
  const { model: m2 } = await plan([{ op: 'introduce', id: 'd', text: 'D', place: { x: 700, y: 400 } }], model);
  assert.deepEqual(m2.objects.d.at, [700, 400]);
});

test('an arrow that cannot clear everything takes the curve crossing the fewest concepts, not the straight line', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'a', text: 'A', place: { x: 100, y: 400 } },
    { op: 'introduce', id: 'b', text: 'B', place: { x: 1300, y: 400 } },
    // A wall every curve crosses, and three concepts on the straight line.
    { op: 'introduce', id: 'wall', text: 'W', place: { x: 700, y: 400 } },
    { op: 'introduce', id: 'p', text: 'P', place: { x: 400, y: 400 } },
    { op: 'introduce', id: 'q', text: 'Q', place: { x: 1000, y: 400 } }
  ]);
  model.objects.wall.size = [60, 1600]; // as tall as the view: no curve gets round it
  const { model: m } = await plan([{ op: 'connect', from: 'a', to: 'b' }], model);
  assert.notEqual(m.relations.a__b.bend || 0, 0, 'curved: crossing only the wall beats crossing all three');
});

test('an arrow along the bottom never curves out of view; branch arrows take from_side / to_side', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'a', text: 'VAD BLEV DET?', place: { x: 1000, y: 760 } },
    { op: 'introduce', id: 'b', text: 'NÄSTA VAL', place: { x: 250, y: 760 } },
    { op: 'introduce', id: 'w', text: 'IN THE WAY', place: { x: 620, y: 760 } },
    { op: 'connect', from: 'a', to: 'b' }
  ]);
  const r = model.relations.a__b, A = boxOf(model.objects.a), B = boxOf(model.objects.b);
  const ends = connectorEnds(A, B), len = Math.hypot(ends[2] - ends[0], ends[3] - ends[1]);
  const midY = (ends[1] + ends[3]) / 2 - (ends[2] - ends[0]) / len * (r.bend || 0);
  assert.ok(midY <= 800 - 20, `the curve's middle stays on screen: y ${Math.round(midY)} (bend ${r.bend})`);
  const { model: m2, lines } = await plan([{ op: 'branch', from: 'a', items: ['X'], side: 'above', from_side: 'top-left', to_side: 'bottom' }], model);
  assert.deepEqual(m2.relations.a__x.sides, { from: 'top-left', to: 'bottom' });
  // The child grows out of its source along the arrow; asked, it is drawn and then connected.
  assert.match(lines.join('\n'), /^Promise\.resolve\(emanate\("a", addLabel\("X", .*\), "a__x", \{(bend: -?\d+, )?sides: \{"from":"top-left","to":"bottom"\}, duration: \d+\}\)\)$/m);
  // Unnamed, they leave the side the children grow towards and arrive at the facing one.
  const fan = await plan([{ op: 'branch', from: 'a', items: ['P', 'Q', 'R', 'S'], side: 'above' }, { op: 'branch', from: 'b', items: ['T'], side: 'right', to_side: 'top' }], model);
  assert.deepEqual(['p', 'q', 'r', 's'].map(id => fan.model.relations[`a__${id}`].sides), Array(4).fill({ from: 'top', to: 'bottom' }));
  assert.deepEqual(fan.model.relations.b__t.sides, { from: 'right', to: 'top' });
  // With no room on the side asked for, the arrows leave the side the children landed on.
  for (const [y, side, sides] of [[700, 'below', { from: 'top', to: 'bottom' }], [60, 'above', { from: 'bottom', to: 'top' }]]) {
    const { model: m } = await plan([{ op: 'introduce', id: 'root', text: 'ROOT', place: { x: 700, y } }, { op: 'branch', from: 'root', items: ['ONE', 'TWO', 'THREE'], side }]);
    assert.deepEqual(m.relations.root__one.sides, sides, `asked ${side} at y ${y}`);
  }
  const apart = await plan([{ op: 'branch', from: 'a', items: ['Y'], emanate: false }], model);
  assert.ok(apart.lines.some(l => l.startsWith('drawOutline(addLabel("Y"')));
  assert.ok(apart.lines.some(l => l.startsWith('connectObjects("a", "y", "a__y", {')));
});

test('a group can be an arrow end (through its enclosure, a dashed one drawn if it has none) and a place anchor', async () => {
  const { model, lines } = await plan([
    { op: 'introduce', id: 'vote', text: 'VOTE', place: { region: 'left' } },
    { op: 'introduce_group', id: 'pros', items: ['POLITICIANS', 'EXPERTS'], layout: 'column', place: { region: 'right' } },
    { op: 'introduce', id: 'mid', text: 'MID', place: { between: ['vote', 'pros'] } },
    { op: 'introduce', id: 'over', text: 'OVER', place: { near: 'pros', side: 'above' } },
    { op: 'connect', from: 'pros', to: 'vote' },
    { op: 'connect', from: 'vote', to: 'pros', id: 'back' }
  ]);
  assert.equal(model.groups.pros.enclosure, 'pros_boundary');
  assert.equal(model.objects.pros_boundary.boundary, 'dashed');
  assert.deepEqual([model.relations.pros__vote.from, model.relations.back.to], ['pros_boundary', 'pros_boundary']);
  assert.equal(lines.filter(l => l.includes('"op":"enclose"')).length, 1, 'drawn once');
  assert.deepEqual(parseScene(lines).relations, model.relations);
  const [mid, over, box] = ['mid', 'over', 'pros_boundary'].map(id => boxOf(model.objects[id]));
  assert.ok(mid.x + mid.w < box.x && over.y + over.h < box.y, 'between and above the group');
  await plan([{ op: 'disconnect', from: 'pros', to: 'vote' }], model);
  await plan([{ op: 'disconnect', from: 'vote', to: 'pros_boundary' }], model);
  // An arrow between two groups without enclosures draws both; undo takes all three.
  const two = await plan([
    { op: 'introduce_group', id: 'g1', items: ['ONE'], place: { region: 'top-left' } },
    { op: 'introduce_group', id: 'g2', items: ['TWO'], place: { region: 'bottom-right' } },
    { op: 'connect', from: 'g1', to: 'g2' }
  ]);
  const undone = withoutLastAction(two.lines);
  assert.equal(undone.removed.filter(l => l.startsWith(TAG)).length, 3);
  assert.deepEqual(Object.keys(parseScene(undone.lines).objects).sort(), ['one', 'two']);
  // Undo takes the enclosure drawn for the arrow with it.
  const cut = withoutLastAction(lines.slice(0, lines.findIndex(l => l.includes('"id":"back"'))));
  assert.equal(cut.removed.filter(l => l.startsWith(TAG)).length, 2);
  assert.equal(parseScene(cut.lines).groups.pros.enclosure, null);
  // A removed enclosure brought back is the group's again.
  await plan([{ op: 'remove', ids: ['pros_boundary'] }, { op: 'return_to', ids: ['pros_boundary'] }, { op: 'connect', from: 'pros', to: 'mid' }], model);
  assert.equal(model.relations.pros__mid.from, 'pros_boundary');
});

test('revise changes the label under a figure; one without a label, or a question, is refused', async () => {
  const { model, lines } = await plan([
    { op: 'introduce', id: 'p', kind: 'figure', text: 'VOTER' },
    { op: 'introduce', id: 'q', kind: 'figure' },
    { op: 'revise', id: 'p', text: 'CITIZEN' }
  ]);
  assert.deepEqual(model.objects.p.history, ['VOTER', 'CITIZEN']);
  assert.match(lines.at(-1), /setLabelText\("p", "CITIZEN"\)/);
  await assert.rejects(plan([{ op: 'revise', id: 'q', text: 'X' }], model), /without a label/);
  await assert.rejects(plan([{ op: 'question', id: 'p' }], model), /only text and box/);
});

test('a longer text pushes the neighbours it would cover aside and refits the enclosure round them', async () => {
  const { model, lines } = await plan([
    { op: 'introduce_group', id: 'plans', items: ['PLAN A', 'PLAN B', 'PLAN C'], place: { region: 'center' } },
    { op: 'enclose', id: 'frame', group: 'plans' },
    { op: 'introduce', id: 'far', text: 'FAR', place: { region: 'top-left' } }
  ]);
  const [a0, c0, f0] = ['plan_a', 'plan_c', 'far'].map(id => [...model.objects[id].at]);
  const { records } = await planActions(model, [{ op: 'revise', id: 'plan_b', text: 'PLAN B, THE FINAL CHOICE?' }], measure);
  const b = boxOf(model.objects.plan_b);
  assert.ok(model.objects.plan_a.at[0] < a0[0] && model.objects.plan_c.at[0] > c0[0], 'pushed outward');
  assert.ok(!['plan_a', 'plan_c'].some(id => hit(boxOf(model.objects[id]), b)), 'no longer covered');
  assert.deepEqual(model.objects.far.at, f0, 'others stay');
  const frame = boxOf(model.objects.frame), outer = boxOf(model.objects.plan_c);
  assert.ok(frame.x + frame.w > outer.x + outer.w, 'enclosure refitted');
  assert.deepEqual(parseScene([...lines, TAG + JSON.stringify(records[0])]).objects, model.objects);
  // As in a real plan: questioned (C pushed to just the gap), then, with the camera moved, a much longer text.
  const sizes = { 'PLAN A': [100, 50], 'PLAN B': [100, 50], 'PLAN C': [100, 50], 'PLAN B?': [112, 50], 'PLAN B — FINAL CHOICE?': [287, 50] };
  const m2 = emptyScene();
  m2.camera = { zoom: 1.445, pan: [0, 0] };
  const sized = async specs => specs.map(sp => sizes[sp.text]);
  await planActions(m2, [
    { op: 'introduce', id: 'a', kind: 'box', text: 'PLAN A', place: { x: 583, y: 190 } },
    { op: 'introduce', id: 'b', kind: 'box', text: 'PLAN B', place: { x: 706, y: 190 } },
    { op: 'introduce', id: 'c', kind: 'box', text: 'PLAN C', place: { x: 829, y: 190 } },
    { op: 'question', id: 'b' }
  ], sized);
  // The camera comes in a little: the least room kept between concepts (on screen) is now more than they have.
  m2.camera = { zoom: 1, pan: [0, 0] };
  await planActions(m2, [{ op: 'revise', id: 'b', text: 'PLAN B — FINAL CHOICE?' }], sized);
  const row = ['a', 'b', 'c'].map(id => boxOf(m2.objects[id]));
  assert.ok(!hit(row[0], row[1]) && !hit(row[1], row[2]), 'no neighbours covered');
  // A push passes along the row: A grows into B, which moves into C, which moves too.
  sizes['PLAN A, AND MUCH MORE THAN THAT'] = [420, 50];
  await planActions(m2, [{ op: 'revise', id: 'a', text: 'PLAN A, AND MUCH MORE THAN THAT' }], sized);
  const row2 = ['a', 'b', 'c'].map(id => boxOf(m2.objects[id]));
  assert.ok(!hit(row2[0], row2[1]) && !hit(row2[1], row2[2]) && !hit(row2[0], row2[2]), 'the push passed along');
  // Only what sits beside it moves; a shorter text moves nothing; a longer replacement makes room too.
  sizes['UNDER'] = [100, 50]; sizes['X'] = [60, 50]; sizes['PLAN C, REPLACED BY SOMETHING LONG'] = [400, 50];
  await planActions(m2, [{ op: 'introduce', id: 'u', kind: 'box', text: 'UNDER', place: { x: m2.objects.b.at[0], y: 280 } }], sized);
  const [u0, cAt] = [[...m2.objects.u.at], [...m2.objects.c.at]];
  await planActions(m2, [{ op: 'revise', id: 'b', text: 'X' }], sized);
  assert.deepEqual([m2.objects.u.at, m2.objects.c.at], [u0, cAt]);
  await planActions(m2, [{ op: 'revise', id: 'b', text: 'PLAN B — FINAL CHOICE?' }, { op: 'replace', id: 'c', with: { id: 'c2', text: 'PLAN C, REPLACED BY SOMETHING LONG' } }], sized);
  assert.deepEqual(m2.objects.u.at, u0, 'the one below stays');
  assert.ok(!hit(boxOf(m2.objects.b), boxOf(m2.objects.c2)), 'the replacement made room');
});

test('with the camera in close and a boundary filling most of the view, a branch still lands in view', async () => {
  const sizes = { CITIZEN: [218, 145], POWER: [68, 43], KNOWLEDGE: [98, 43], TIME: [50, 43] };
  const sized = async specs => specs.map(s => sizes[s.text] || [80, 38]);
  const model = emptyScene();
  await planActions(model, [
    { op: 'introduce', id: 'person', kind: 'figure', text: 'CITIZEN', place: { x: 700, y: 400 } },
    { op: 'introduce', id: 'power', kind: 'box', text: 'POWER', place: { x: 873, y: 400 } },
    { op: 'introduce', id: 'know', kind: 'box', text: 'KNOWLEDGE', place: { x: 700, y: 276 } },
    { op: 'introduce', id: 'time', kind: 'box', text: 'TIME', place: { x: 536, y: 400 } },
    { op: 'enclose', id: 'cap', members: ['person', 'power', 'know', 'time'] }
  ], sized);
  model.camera = { zoom: 2, pan: [-700, -400] };
  await planActions(model, [{ op: 'branch', from: 'know', side: 'right', items: ['ECONOMY', 'STATISTICS', 'LAW', 'SCIENCE'] }], sized);
  const v = view(model);
  ['economy', 'statistics', 'law', 'science'].forEach(id => {
    const b = boxOf(model.objects[id]);
    assert.ok(b.x >= v.x && b.y >= v.y && b.x + b.w <= v.x + v.w && b.y + b.h <= v.y + v.h, `${id} in view`);
  });
});

test('with no room left in view, the camera first pulls back just enough; undo takes that with it', async () => {
  const sizes = { CITIZEN: [218, 145], POWER: [68, 43], KNOWLEDGE: [98, 43], TIME: [50, 43] };
  const sized = async specs => specs.map(s => sizes[s.text] || [String(s.text).length * 8 * s.fontSize / 11 + 24, 38 * s.fontSize / 11]);
  const model = emptyScene();
  const { lines } = await planActions(model, [
    { op: 'introduce', id: 'person', kind: 'figure', text: 'CITIZEN', place: { x: 700, y: 400 } },
    { op: 'introduce', id: 'power', kind: 'box', text: 'POWER', place: { x: 873, y: 400 } },
    { op: 'introduce', id: 'know', kind: 'box', text: 'KNOWLEDGE', place: { x: 700, y: 276 } },
    { op: 'introduce', id: 'time', kind: 'box', text: 'TIME', place: { x: 536, y: 400 } },
    { op: 'enclose', id: 'cap', members: ['person', 'power', 'know', 'time'] },
    { op: 'narrow_context', ids: ['cap'], fill: 1 }
  ], sized);
  const zoom = model.camera.zoom;
  const items = ['LABOUR MARKET', 'HOUSING', 'RIGHTS', 'INTEGRATION', 'PUBLIC FINANCES', 'SCHOOLS'];
  const more = await planActions(model, [{ op: 'branch', from: 'know', side: 'below', items }], sized);
  assert.deepEqual(more.records.map(r => r.op), ['widen_context', 'branch']);
  assert.ok(more.records[0].auto && model.camera.zoom < zoom && model.camera.zoom >= zoom * 0.85 ** 6);
  const v = view(model), others = ['person', 'power', 'know', 'time', 'cap'].map(id => boxOf(model.objects[id]));
  more.records[1].items.forEach(it => {
    const b = boxOf(model.objects[it.id]);
    assert.ok(b.x >= v.x && b.y >= v.y && b.x + b.w <= v.x + v.w && b.y + b.h <= v.y + v.h, `${it.id} in view`);
    assert.ok(!others.some(o => hit(b, o)), `${it.id} covers nothing`);
  });
  const all = [...lines, ...more.lines];
  assert.equal(parseScene(all).camera.zoom, model.camera.zoom);
  assert.deepEqual(parseScene(withoutLastAction(all).lines).camera, parseScene(lines).camera);
  // A plan cannot ask for the shortcut.
  const own = await planActions(model, [{ op: 'widen_context', auto: true, camera: { zoom: '1); evil(' } }], sized);
  assert.ok(!own.lines.join('\n').includes('evil') && !own.records[0].auto);
});

test('a longer text that would push its neighbours out of view pulls the camera back first', async () => {
  const sizes = { 'A': [100, 50], 'B': [100, 50], 'C': [236, 50], 'B, A MUCH LONGER TEXT NOW': [420, 50] };
  const sized = async specs => specs.map(sp => sizes[sp.text]);
  const model = emptyScene();
  await planActions(model, [
    { op: 'introduce', id: 'a', kind: 'box', text: 'A', place: { x: 900, y: 300 } },
    { op: 'introduce', id: 'b', kind: 'box', text: 'B', place: { x: 1030, y: 300 } },
    { op: 'introduce', id: 'c', kind: 'box', text: 'C', place: { x: 1230, y: 300 } }
  ], sized);
  const { records } = await planActions(model, [{ op: 'revise', id: 'b', text: 'B, A MUCH LONGER TEXT NOW' }], sized);
  assert.deepEqual(records.map(r => r.op), ['widen_context', 'revise']);
  const v = view(model);
  ['a', 'b', 'c'].forEach(id => { const x = boxOf(model.objects[id]); assert.ok(x.x >= v.x && x.x + x.w <= v.x + v.w, `${id} in view`); });
});

test('a pushed concept\'s arrows get the curve that suits where it now is; a curve given by hand stays', async () => {
  const sizes = { A: [80, 50], B: [80, 50], C: [80, 50], D: [80, 50], 'A, NOW A MUCH LONGER TEXT': [400, 50] };
  const sized = async specs => specs.map(sp => sizes[sp.text]);
  const model = emptyScene();
  // B→D first has to curve round C; once B is pushed right, past C, a straight arrow is clear.
  const { lines } = await planActions(model, [
    { op: 'introduce', id: 'a', kind: 'box', text: 'A', place: { x: 400, y: 300 } },
    { op: 'introduce', id: 'b', kind: 'box', text: 'B', place: { x: 520, y: 300 } },
    { op: 'introduce', id: 'c', kind: 'box', text: 'C', place: { x: 640, y: 380 } },
    { op: 'introduce', id: 'd', kind: 'box', text: 'D', place: { x: 1000, y: 520 } },
    { op: 'connect', from: 'b', to: 'd' },
    { op: 'connect', from: 'b', to: 'c', bend: 40 },
    { op: 'checkpoint', name: 'curved' }
  ], sized);
  const curved = model.relations.b__d.bend;
  assert.notEqual(curved, 0);
  const more = await planActions(model, [{ op: 'revise', id: 'a', text: 'A, NOW A MUCH LONGER TEXT' }], sized);
  assert.ok(model.objects.b.at[0] > 600);
  assert.equal(model.relations.b__d.bend, 0);
  assert.equal(model.relations.b__c.bend, 40);
  assert.match(more.lines.join('\n'), /removeByUid\("b__d"\); connectObjects\("b", "d", "b__d"\)/);
  // Going back to the checkpoint draws it curved again, once B is back.
  const back = await planActions(model, [{ op: 'return_to', name: 'curved' }], sized);
  assert.equal(model.relations.b__d.bend, curved);
  assert.match(back.lines.join('\n'), new RegExp(`revertState\\("curved".*removeByUid\\("b__d"\\); connectObjects\\("b", "d", "b__d", \\{bend: ${curved}\\}\\)`));
  more.lines.push(...back.lines);
  assert.deepEqual(parseScene([...lines, ...more.lines]).relations, model.relations);
});

test('turnover: a group that grows pushes what is beside it along its row', async () => {
  const { model, lines } = await plan([
    { op: 'introduce_group', id: 'w', items: ['D1', 'D2'], place: { region: 'center' } },
    { op: 'introduce', id: 'side', text: 'SIDE', place: { near: 'd2', side: 'right' } },
    { op: 'turnover', group: 'w', leaving: ['d1'], arriving: ['D3', 'D4', 'D5'] }
  ]);
  const side = boxOf(model.objects.side);
  ['d2', 'd3', 'd4', 'd5'].forEach(id => assert.ok(!hit(boxOf(model.objects[id]), side), `${id} clear of SIDE`));
  // A boundary drawn round the group and SIDE by hand is refitted round where they now are.
  const more = await planActions(model, [
    { op: 'enclose', id: 'all', members: ['d2', 'd3', 'd4', 'd5', 'side'] },
    { op: 'turnover', group: 'w', leaving: ['d2'], arriving: ['D6', 'D7'] }
  ], measure);
  const fence = boxOf(model.objects.all);
  ['d3', 'd4', 'd5', 'd6', 'd7', 'side'].forEach(id => { const b = boxOf(model.objects[id]); assert.ok(b.x >= fence.x && b.x + b.w <= fence.x + fence.w, `${id} inside`); });
  lines.push(...more.lines);
  assert.deepEqual(parseScene(lines).objects, model.objects);
});

test('turnover: members change, the group and its enclosure hold', async () => {
  const { model } = await plan([
    { op: 'introduce_group', id: 'w', items: ['D1', 'D2', 'D3'] },
    { op: 'enclose', id: 'bed', group: 'w' },
    { op: 'turnover', group: 'w', leaving: ['d3'], arriving: ['D4'] },
    { op: 'turnover', group: 'w', leaving: ['d1', 'd2', 'd4'], arriving: ['D5'] }
  ]);
  assert.deepEqual(model.groups.w.members, ['d5']);
  assert.equal(model.groups.w.enclosure, 'bed');
  assert.ok(model.objects.bed.members.includes('d5'));
  assert.ok(model.retired.d3 && model.retired.d4);
  await assert.rejects(plan([{ op: 'turnover', group: 'w', leaving: ['bed'] }], model), /not in group/);
});

test('review fixes: revived concepts go back to their place, group and arrows; dims and enclosures hold', async () => {
  // A turnover leaver comes back where it was, into its group.
  const t = await plan([
    { op: 'introduce_group', id: 'g', items: ['A', 'B', 'C'] },
    { op: 'turnover', group: 'g', leaving: ['a'], arriving: ['D'] },
    { op: 'return_to', ids: ['a'] }
  ]);
  const at = t.model.objects.a.at;
  assert.match(t.lines.at(-1), new RegExp(`animate\\("a", \\{left: ${at[0]}, top: ${at[1]}`));
  assert.ok(t.model.groups.g.members.includes('a'));

  // An arrow whose ends were removed one after the other comes back with the second.
  const r = await plan([
    { op: 'introduce', id: 'a', text: 'A' }, { op: 'introduce', id: 'b', text: 'B', place: { near: 'a' } },
    { op: 'connect', from: 'a', to: 'b' }, { op: 'remove', ids: ['a'] }, { op: 'remove', ids: ['b'] },
    { op: 'return_to', ids: ['a'] }, { op: 'return_to', ids: ['b'] }
  ]);
  assert.ok(r.model.relations.a__b);
  assert.deepEqual(parseScene(r.lines).relations, r.model.relations);

  // Dissolving keeps a dimmed concept dim.
  const d = await plan([
    { op: 'introduce', id: 'a', text: 'A', kind: 'box', place: { region: 'left' } },
    { op: 'introduce', id: 'b', text: 'B', kind: 'box', place: { region: 'right' } },
    { op: 'deemphasize', ids: ['a'] }, { op: 'dissolve_boundary', id: 'band', ids: ['a', 'b'] }
  ]);
  assert.match(d.lines.at(-1), /animate\("a", \{opacity: 0.4\}/);

  // Going back to a checkpoint takes away what came after it.
  const c = await plan([
    { op: 'introduce', id: 'a', text: 'A' }, { op: 'checkpoint', name: 'c1' },
    { op: 'replace', id: 'a', with: { id: 'a2', text: 'A2' } }, { op: 'return_to', name: 'c1' }
  ]);
  assert.deepEqual(Object.keys(c.model.objects), ['a']);
  assert.ok(c.model.retired.a2);

  // A turnover that grows the group refits its enclosure round it.
  const e = await plan([
    { op: 'introduce_group', id: 'g', items: ['A', 'B'] }, { op: 'enclose', id: 'bed', group: 'g' },
    { op: 'turnover', group: 'g', leaving: [], arriving: ['C', 'D'] }
  ]);
  const bed = boxOf(e.model.objects.bed);
  e.model.groups.g.members.map(id => boxOf(e.model.objects[id])).forEach(b => assert.ok(b.x > bed.x && b.x + b.w < bed.x + bed.w));
});

// ---- Milestone 3: narration

test('narration: held for reading pace, ids for later audio, caption cleared by the next beat only when one shows', async () => {
  const { model, lines, records } = await plan([
    { op: 'beat', name: 'one' },
    { op: 'narrate', text: 'Then the child asks something no dinner can answer.' },
    { op: 'narrate', text: 'Look.', sync: 'with' },
    { op: 'narrate', text: 'Slowly now.', seconds: 3 },
    { op: 'beat', name: 'two' },
    { op: 'beat', name: 'three' }
  ]);
  assert.deepEqual(records.filter(r => r.op === 'narrate').map(r => [r.id, r.words, r.hold, r.wait]),
    [['n1', 9, 4000, 4000], ['n2', 1, 1500, 300], ['n3', 2, 3000, 3000]]);
  assert.match(lines.find(l => l.includes('caption("Look."')), /^Promise\.resolve\(caption\("Look\.", \{id: "n2", wait: 300\}\)\)$/);
  assert.equal(lines.filter(l => l === 'Promise.resolve(caption(null))').length, 1, 'only the beat after a caption clears it');
  assert.deepEqual(parseScene(lines).narration, model.narration);
  await assert.rejects(plan([{ op: 'narrate', id: 'n1', text: 'again' }], model), /"n1" is already used/);
});

test('timeline and caption track: times from the lines, cues from the narration', async () => {
  assert.equal(lineTime('drawOutline(addLabel("duration: 9999", 1, 2, {}), {duration: 700})'), 975, 'text in quotes is not timing');
  assert.equal(lineTime('animate("a", {opacity: 0}, {duration: 500}).then(() => removeByUid("a"))'), 600);
  assert.equal(lineTime('pc.add(x)'), 1000);
  const { lines } = await plan([
    { op: 'scene', name: 's' },
    { op: 'beat', name: 'b1' },
    { op: 'narrate', text: 'One two three four five six seven eight nine.' },
    { op: 'introduce', id: 'a', text: 'A' },
    { op: 'narrate', text: 'And then.', sync: 'with' },
    { op: 'pause', seconds: 2 }
  ]);
  const tl = timeline(lines);
  const [n1, n2] = tl.narrations;
  assert.equal(n1.start, 100, 'after the camera reset line');
  assert.equal(n2.start, n1.start + 4100 + 975);
  assert.equal(n2.shown, 400 + 2100);
  assert.equal(captionsFile(lines), `WEBVTT\n\nn1\n00:00:00.100 --> 00:00:05.175\nOne two three four five six seven eight nine.\n\nn2\n00:00:05.175 --> 00:00:07.675\nAnd then.\n`);
  assert.match(captionsFile(lines, 'srt'), /^1\n00:00:00,100 --> 00:00:05,175\n/);
});

test('narration checks: too quick to read, a question answered at once, a beat without words; none without narration', async () => {
  const { lines } = await plan([
    { op: 'beat', name: 'b1' },
    { op: 'narrate', text: 'What is the point of this life?' },
    { op: 'introduce', id: 'q', text: 'WHY?' },
    { op: 'narrate', text: 'A long line of words that nobody could read in the time it is given here.', sync: 'with' },
    { op: 'beat', name: 'b2' },
    { op: 'introduce', id: 'r', text: 'R' }
  ]);
  const msgs = narrationIssues(lines).map(i => i.message).join('\n');
  assert.match(msgs, /n2 shows for 0\.4s/);
  assert.match(msgs, /n1 asks a question and the next move follows at once/);
  assert.match(msgs, /beat "b2" moves without narration/);
  assert.deepEqual(narrationIssues((await plan([{ op: 'beat', name: 'b' }, { op: 'introduce', id: 'a', text: 'A' }])).lines), []);
});

test('narration review fixes: comments add no time, cues end when their caption goes, quoted questions count', async () => {
  const { lines } = await plan([
    { op: 'beat', name: 'b1' },
    { op: 'narrate', text: 'One two three four five six seven eight.', sync: 'with' },
    { op: 'pause', seconds: 1 },
    { op: 'beat', name: 'b2' },
    { op: 'narrate', text: 'Why "now?"' },
    { op: 'introduce', id: 'a', text: 'A' }
  ]);
  const commented = [...lines.slice(0, 3), 'Promise.resolve(sleep(1)) // sleep(9) duration: 9000', '/* a note', 'pc.add(x)', '*/', ...lines.slice(3)];
  const [a, b] = [timeline(lines), timeline(commented)];
  assert.equal(b.total, a.total + 1100, 'only the added sleep(1) line counts');
  const cues = captionsFile(lines).split('\n\n').slice(1);
  const time = c => c.split('\n')[1].split(' --> ').map(x => +x.slice(6).replace('.', ''));
  assert.ok(time(cues[0])[1] <= time(cues[1])[0], 'cues do not overlap');
  assert.match(narrationIssues(lines).map(i => i.message).join('\n'), /n2 asks a question/);
});

test('a figure can have a frame round it, which weaken_boundary dashes; others are refused', async () => {
  const { model, lines } = await plan([{ op: 'introduce', id: 'kid', kind: 'figure', text: 'BARN', boundary: 'solid' }, { op: 'introduce', id: 'bare', kind: 'figure', text: 'VUXEN' }]);
  assert.match(lines.join('\n'), /addFigure\(\d+, \d+, \{"uid":"kid".*"boundary":"solid"\}\)/);
  assert.doesNotMatch(lines.find(l => l.includes('"uid":"bare"')), /boundary/);
  const { lines: w } = await plan([{ op: 'weaken_boundary', id: 'kid' }], model);
  assert.match(w.join('\n'), /setLabelBoundary\("kid", "dashed"\)/);
  assert.equal(model.objects.kid.boundary, 'dashed');
  await assert.rejects(plan([{ op: 'weaken_boundary', id: 'bare' }], model), /has no boundary \(give the figure boundary/);
  await assert.rejects(plan([{ op: 'introduce', id: 't', text: 'T', boundary: 'solid' }]), /boundary is for a figure/);
  // A replacement figure keeps the frame; going back brings the old label back.
  const { lines: r } = await plan([{ op: 'replace', id: 'kid', with: { id: 'teen', text: 'TONÅRING' } }], model);
  assert.match(r.join('\n'), /addFigure\(\d+, \d+, \{"uid":"teen".*"boundary":"dashed"/);
  const { lines: back } = await plan([{ op: 'checkpoint', name: 'c' }, { op: 'revise', id: 'bare', text: 'VUXEN B' }, { op: 'return_to', name: 'c' }], model);
  assert.match(back.join('\n'), /setLabelText\("bare", "VUXEN"\)/);
});

test('a step list is one concept, placed like any other; step marks progress through it; return_to goes back', async () => {
  const { model, lines } = await plan([
    { op: 'steps', id: 'plan', items: ['MÅL', 'ALTERNATIV', 'BESLUT'], place: { region: 'left' } },
    { op: 'introduce', id: 'next', text: 'NEXT', place: { near: 'plan', side: 'right' } },
    { op: 'checkpoint', name: 'start' },
    { op: 'step', id: 'plan', n: 2 }
  ]);
  const o = model.objects.plan, b = boxOf(o);
  assert.equal(o.kind, 'steps');
  assert.equal(o.step, 2);
  // The first bullet goes where the measured offset puts it from the centre.
  assert.match(lines.find(l => l.startsWith('drawOutline(stepList(')), new RegExp(`^drawOutline\\(stepList\\("plan", \\["MÅL","ALTERNATIV","BESLUT"\\], ${o.at[0] - 130}, ${o.at[1] - 60}, \\{group: true, direction: "vertical"`));
  assert.ok(lines.includes('markStep("plan", 2, {duration: 800})') || lines.some(l => /^markStep\("plan", 2, \{duration: \d+\}\)$/.test(l)));
  assert.ok(!hit(boxOf(model.objects.next), b), 'the next concept keeps clear of it');
  const back = await plan([{ op: 'return_to', name: 'start' }], model);
  assert.equal(back.model.objects.plan.step, 0);
  assert.ok(back.lines.some(l => l.includes('markStep("plan", 0, {duration: 1})')), 'its progress marked again');
  await assert.rejects(plan([{ op: 'step', id: 'next', n: 1 }], model), /not a step list/);
  await assert.rejects(plan([{ op: 'step', id: 'plan', n: 4 }], model), /step: n/);
  await assert.rejects(plan([{ op: 'steps', id: 'empty', items: [] }]), /non-empty list/);
  await assert.rejects(plan([{ op: 'replace', id: 'plan', with: { text: 'X' } }], model), /is a step list; give with.kind/);
  assert.deepEqual(o.size, [332, 212], 'measured size and room for the current step');
});

test('removing a concept removed earlier does nothing; an unknown one is still refused', async () => {
  const { model } = await plan([{ op: 'introduce', id: 'a', text: 'A' }, { op: 'introduce', id: 'b', text: 'B' }, { op: 'remove', ids: ['a'] }]);
  const { lines } = await plan([{ op: 'remove', ids: ['a', 'b'] }], model);
  assert.ok(lines.some(l => l.includes('["b"].forEach(removeByUid)')), 'only b goes');
  const again = await plan([{ op: 'remove', ids: ['a'] }], model);
  assert.ok(!again.lines.some(l => l.includes('removeByUid')));
  await assert.rejects(plan([{ op: 'remove', ids: ['nope'] }], model), /no concept "nope"/);
});

test('a group among the members of an enclosure stands for its members', async () => {
  const { model } = await plan([{ op: 'introduce_group', id: 'g', items: ['ONE', 'TWO'] }, { op: 'introduce', id: 'x', text: 'X' }, { op: 'enclose', id: 'frame', members: ['g', 'x'] }]);
  assert.deepEqual(model.objects.frame.members.sort(), ['one', 'two', 'x']);
});

test('a concept brought back whose old place is out of view now comes back at the nearest free spot in view', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'far', text: 'FAR LEFT', place: { region: 'left' } },
    { op: 'introduce', id: 'mid', text: 'MIDDLE', place: { region: 'right' } },
    { op: 'remove', ids: ['far'] },
    { op: 'narrow_context', ids: ['mid'], fill: 0.5 }
  ]);
  const old = model.retired.far.object.at;
  const { model: m, lines } = await plan([{ op: 'return_to', ids: ['far'] }], model);
  const v = view(m), b = boxOf(m.objects.far);
  assert.notDeepEqual(m.objects.far.at, old);
  assert.ok(b.x >= v.x && b.y >= v.y && b.x + b.w <= v.x + v.w && b.y + b.h <= v.y + v.h, `in view: ${JSON.stringify(b)} in ${JSON.stringify(v)}`);
  assert.ok(lines.some(l => l.includes(`animate("far", {left: ${m.objects.far.at[0]}, top: ${m.objects.far.at[1]}`)));
  // One still in view comes back where it was.
  const { model: m2 } = await plan([{ op: 'remove', ids: ['mid'] }, { op: 'return_to', ids: ['mid'] }], model);
  assert.deepEqual(m2.objects.mid.at, model.objects.mid.at);
});

test('an arrow does not curve round through its own end to reach the facing edge', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'gov', text: 'REGERING', kind: 'box', place: { x: 1140, y: 303 } },
    { op: 'introduce', id: 'party', text: 'PARTI', kind: 'box', place: { x: 1140, y: 400 } },
    { op: 'introduce', id: 'promise', text: 'VI SKA FÖRBÄTTRA X', kind: 'box', place: { x: 700, y: 400 } },
    { op: 'introduce', id: 'res', text: 'VAD BLEV DET?', kind: 'box', place: { x: 360, y: 630 } },
    { op: 'connect', from: 'gov', to: 'res', from_side: 'left' }
  ]);
  const r = model.relations.gov__res, A = boxOf(model.objects.gov), B = boxOf(model.objects.res);
  const ends = connectorEnds(A, B, r.sides), len = Math.hypot(ends[2] - ends[0], ends[3] - ends[1]);
  const mid = r.bend ? [(ends[0] + ends[2]) / 2 + (ends[3] - ends[1]) / len * r.bend, (ends[1] + ends[3]) / 2 - (ends[2] - ends[0]) / len * r.bend] : null;
  const inner = b => ({ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16 });
  assert.ok(!connectorChords(ends, mid).some(ch => segmentHitsBox(ch, inner(B)) || segmentHitsBox(ch, inner(A))), `bend ${r.bend} keeps out of both ends`);
});

test('move: a concept goes to a new place with its frame and arrows; a concept framed alone sends its arrows from the frame', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'kid', kind: 'figure', text: 'BARN', place: { region: 'left' } },
    { op: 'introduce', id: 'rep', kind: 'figure', text: 'REPRESENTANT', place: { region: 'center' } },
    { op: 'enclose', id: 'frame', members: ['rep'] },
    { op: 'connect', from: 'kid', to: 'rep' }
  ]);
  assert.equal(model.relations.kid__rep.to, 'frame', 'the arrow meets the frame round it');
  const { model: m, lines } = await plan([{ op: 'move', id: 'rep', place: { region: 'right' } }], model);
  const at = m.objects.rep.at;
  assert.ok(at[0] > 1000, `moved right: ${at}`);
  assert.deepEqual(m.objects.frame.at, at, 'the frame came with it');
  assert.match(lines.find(l => l.startsWith('Promise.all([animate("rep"')), /animate\("frame", \{left: \d+, top: \d+, width/);
  const { model: b } = await plan([{ op: 'branch', from: 'rep', items: ['RULE'] }], m);
  assert.equal(b.relations.rep__rule.from, 'frame', 'a branch leaves from the frame too');
  await assert.rejects(plan([{ op: 'move', id: 'frame', place: { region: 'top' } }], m), /is a frame; move what it is round/);
  await assert.rejects(plan([{ op: 'move', id: 'kid' }], m), /place is required/);
  // Joined to its own frame, an arrow stays on the concept rather than looping on the frame.
  const { model: own } = await plan([{ op: 'connect', from: 'rep', to: 'frame' }], m);
  assert.deepEqual([own.relations.rep__frame.from, own.relations.rep__frame.to], ['rep', 'frame']);
  // The frame removed, its arrows go back to the concept it was round, on the page too.
  const { model: gone, lines: rl } = await plan([{ op: 'remove', ids: ['frame'] }], m);
  assert.deepEqual([gone.relations.kid__rep.from, gone.relations.kid__rep.to], ['kid', 'rep']);
  assert.match(rl.at(-1), /removeByUid\)\)\.then\(\(\) => \{ \["kid__rep",.*\]\.forEach\(removeByUid\); return Promise\.all\(\[connectObjects\("kid", "rep", "kid__rep"/);
});

test('move refuses a concept inside another, and one holding others', async () => {
  const { model } = await plan([
    { op: 'introduce', id: 'box', text: 'BOX', size: 'large', place: { region: 'center' } },
    { op: 'introduce', id: 'dot', text: 'DOT', size: 'small', place: { region: 'left' } },
    { op: 'move_into', id: 'dot', into: 'box' }
  ]);
  await assert.rejects(plan([{ op: 'move', id: 'box', place: { region: 'right' } }], model), /"box" holds "dot"/);
  await assert.rejects(plan([{ op: 'move', id: 'dot', place: { region: 'right' } }], model), /"dot" is inside "box"/);
});

