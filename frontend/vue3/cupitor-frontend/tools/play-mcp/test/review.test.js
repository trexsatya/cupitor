// The review page without a browser: frames are stand-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyScene, planActions } from '../scene.js';
import { reviewStops, buildReviewHtml, beatSummaries } from '../review.js';

const measure = async specs => specs.map(s => [String(s.text || 'x').length * 12 + 24, 50]);

test('review: a stop per beat, a held-back frame only where the beat makes the viewer wait, a page that tells it', async () => {
  const { lines } = await planActions(emptyScene(), [
    { op: 'scene', name: 's' },
    { op: 'beat', name: 'ask', move: 'the question comes before its answer', viewer_task: { type: 'predict', target: 'what is <inside>' } },
    { op: 'introduce', id: 'box', text: 'BOX', kind: 'box' },
    { op: 'narrate', text: 'What is inside?' },
    { op: 'pause', kind: 'prediction' },
    { op: 'introduce', id: 'inside', text: '<nothing>', place: { near: 'box' } },
    { op: 'beat', name: 'look again' },
    { op: 'replace', id: 'inside', with: { id: 'all', text: 'EVERYTHING' } }
  ], measure);
  const stops = reviewStops(lines);
  assert.deepEqual(stops.map(s => [s.beat, s.beforeIndex != null]), [['ask', true], ['look again', false]]);
  assert.ok(lines[stops[0].beforeIndex].includes('"id":"inside"'), 'held back until the reveal of "inside"');
  const frames = { '0:before': 'AAAA', '0:end': 'BBBB', '1:end': 'CCCC' };
  const html = buildReviewHtml({ title: 'T', lines, stops, frames, issues: { 0: [], 1: [{ level: 'warning', message: '"x" and "y" overlap' }] } });
  assert.equal(html.match(/<section class="beat"/g).length, 2);
  assert.equal(html.match(/data:image\/png;base64,/g).length, 3);
  assert.match(html, /the question comes before its answer/);
  assert.match(html, /held back until here: introduce “&lt;nothing&gt;” as inside/);
  assert.match(html, /<span class="no">not stated<\/span>/, 'the second beat has no move');
  assert.match(html, /replace inside with “EVERYTHING” as all \(a new identity\)/);
  assert.match(html, /what is &lt;inside&gt;/);
  assert.ok(!/<script|https?:/.test(html), 'self-contained, nothing to load');
});

test('review: beats pair with their sections by position, issues by beat, whatever the names', async () => {
  const { lines } = await planActions(emptyScene(), [
    { op: 'beat', name: 'x' }, { op: 'introduce', id: 'a', text: 'A' },
    { op: 'beat', name: 'x' }, { op: 'narrate', text: 'Words here.' }, { op: 'introduce', id: 'b', text: 'B', place: { near: 'a' } }
  ], measure);
  const first = lines.findIndex(l => l.includes('{"op":"beat","name":"x"'));
  const edited = lines.map((l, i) => (i === first ? l.replace('"name":"x"', '"name":""') : l)); // first beat's name blanked by hand
  const issues = { 0: [], 1: [] };
  const { narrationIssues } = await import('../scene.js');
  narrationIssues(edited).forEach(i => { issues[0].push(i); issues[1].push(i); });
  const html = buildReviewHtml({ title: 'T', lines: edited, stops: reviewStops(edited), issues });
  const [one, two] = html.split('<section class="beat"').slice(1);
  assert.match(one, /introduce “A” as a/);
  assert.match(two, /introduce “B” as b/);
  assert.match(two, /Words here/);
  assert.ok(one.includes('moves without narration') && !two.includes('moves without narration'));
});

test('beat summaries: what is on screen and where, what came and went, arrows and frames, and only the warnings new in a beat', async () => {
  const { lines } = await planActions(emptyScene(), [
    { op: 'scene', name: 's' },
    { op: 'beat', name: 'one' },
    { op: 'introduce', id: 'a', text: 'A', place: { region: 'top-left' } },
    { op: 'introduce', id: 'b', text: 'B', place: { region: 'bottom-right' } },
    { op: 'connect', from: 'a', to: 'b' },
    { op: 'beat', name: 'two' },
    { op: 'deemphasize', ids: ['a'] },
    { op: 'enclose', id: 'f', members: ['b'] },
    { op: 'remove', ids: ['a'] }
  ], measure);
  const stops = reviewStops(lines);
  const w = { level: 'warning', message: 'something overlaps' };
  const text = beatSummaries({ lines, stops, issues: { 0: [w], 1: [w, { level: 'warning', message: 'new one' }] } });
  const [one, two] = text.split(/\n(?=Beat )/);
  assert.match(one, /^Beat 1 "one"/);
  assert.match(one, /on screen: a “A” top-left; b “B” bottom-right/);
  assert.match(one, /arrows: a → b/);
  assert.match(one, /new: a, b/);
  assert.match(one, /warning: something overlaps/);
  assert.match(two, /on screen: b “B” bottom-right\n/);
  assert.match(two, /frames: f round b/);
  assert.match(two, /removed: a/);
  assert.doesNotMatch(two, /something overlaps/);
  assert.match(two, /warning: new one/);
  assert.match(two, /still: 1 warning\(s\) from before/);
});

