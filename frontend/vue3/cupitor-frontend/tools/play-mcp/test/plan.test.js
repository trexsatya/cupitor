// Plans (scene documents another assistant writes) without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../scene.js';
import { planBeats, planSpec } from '../plan.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = JSON.parse(fs.readFileSync(path.join(dir, 'examples/spectrum.plan.json'), 'utf8'));

test('PLAN-SPEC.md is what plan_spec gives, and names every action', () => {
  const spec = planSpec(example);
  assert.equal(fs.readFileSync(path.join(dir, 'PLAN-SPEC.md'), 'utf8'), spec, 'regenerate PLAN-SPEC.md from plan.js');
  Object.keys(ACTIONS).filter(op => op !== 'scene' && op !== 'beat').forEach(op => assert.ok(spec.includes(`\`${op}\``), op));
});

test('a plan becomes beats of actions; mistakes in its shape are named by place', () => {
  const { errors, warnings, beats } = planBeats(example);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(beats.length, 4);
  assert.deepEqual(beats[0].head.map(a => a.op), ['scene', 'beat']);
  assert.deepEqual(beats[1].head.map(a => a.op), ['beat']);
  const bad = planBeats({ scenes: [{ name: 's', beats: [
    { name: 'a', actions: [{ op: 'introduce', text: 'A' }, { op: 'beat', name: 'x' }, { op: 'explode' }, { op: 'introduce', text: 'B', place: 'left' }] },
    { name: 'b', actions: [] }
  ] }] });
  assert.deepEqual(bad.errors, [
    'scene 1 "s", beat 1 "a", action 2: "beat" comes from the plan\'s structure; leave it out of "actions".',
    'scene 1 "s", beat 1 "a", action 3: unknown op "explode".',
    'scene 1 "s", beat 1 "a", action 4: "place" is an object such as {"region": "left"} or {"near": id, "side": "below"}.',
    'scene 1 "s", beat 2 "b": "actions" must be a non-empty list.'
  ]);
  assert.match(bad.warnings.join('\n'), /beat 1 "a": no "move"/);
});
