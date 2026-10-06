// The scene layer without a browser: sizes come from a fake measurer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyScene, parseScene, planActions, boxOf, validate, withoutLastAction, TAG } from '../scene.js';

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
    { op: 'widen_context', ids: ['eat', 'study', 'live'], scale: 0.5 }
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
    { op: 'widen_context', ids: ['a'], scale: 0.5 },
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
    { op: 'widen_context', ids: ['a'], scale: 0.5 }
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
