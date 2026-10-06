// The scene layer without a browser: sizes come from a fake measurer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyScene, parseScene, planActions, boxOf, validate, withoutLastAction, view, TAG, lineTime, timeline, captionsFile, narrationIssues } from '../scene.js';

const measure = async specs => specs.map(s => (s.kind === 'figure' ? [50, 130] : [String(s.text).length * 12 + 24, 50]));
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
  assert.deepEqual(model.objects.god.at, (await plan([{ op: 'introduce', id: 'k', text: 'I KNOW', kind: 'box' }, { op: 'introduce', id: 'n', text: 'NOTHING', place: { near: 'k' } }])).model.objects.n.at);
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
  await assert.rejects(plan([{ op: 'return_to', ids: ['k'] }], again.model), /"k" was not removed/);
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
