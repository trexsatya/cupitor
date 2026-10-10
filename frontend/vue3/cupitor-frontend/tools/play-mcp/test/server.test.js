// End-to-end: a real MCP client talks to the server, which drives a headless
// play.html. Run with `npm test` (needs Chromium from Playwright).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseScriptFile } from '../page-driver.js';

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server.js');
const textOf = r => r.content.map(c => c.text || '').join('\n');
let client;

before(async () => {
  client = new Client({ name: 'test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server, '--headless'] }));
});
after(async () => { await client.close(); });

test('lists its tools', async () => {
  const names = (await client.listTools()).tools.map(t => t.name).sort();
  assert.deepEqual(names, ['apply_semantic_action', 'export_captions', 'get_script', 'inspect_scene', 'list_functions',
    'list_objects', 'load_script_file', 'plan_spec', 'replace_script', 'replay_script', 'reset_page', 'review_scene', 'run_script_lines',
    'save_script_file', 'scene_timeline', 'screenshot', 'undo_last_action', 'validate_scene', 'build_from_plan', 'check_plan'].sort());
});

test('function reference includes options', async () => {
  const t = textOf(await client.callTool({ name: 'list_functions', arguments: { filter: 'reveal' } }));
  assert.match(t, /reveal\(uid, from, opts\)/);
  assert.match(t, /opts\.duration: ms \(default 800\)/);
});

test('runs lines, reports failures, shows objects and a screenshot', async () => {
  const run = textOf(await client.callTool({ name: 'run_script_lines', arguments: { lines: [
    'addRect(100,100,160,90,{"uid":"R1","fill":"#90caf9"})',
    'animate("R1", {left: 300}, {duration: 200})',
    'noSuchFunction()'
  ] } }));
  assert.match(run, /Played 3 line\(s\)/);
  assert.match(run, /Line 3 failed: .*noSuchFunction/);
  const objs = JSON.parse(textOf(await client.callTool({ name: 'list_objects', arguments: { uid: 'R1' } })));
  assert.equal(objs.length, 1);
  assert.equal(Math.round(objs[0].box.left), 300);
  const shot = await client.callTool({ name: 'screenshot', arguments: { uid: 'R1' } });
  assert.equal(shot.content[0].type, 'image');
  assert.ok(Buffer.from(shot.content[0].data, 'base64').length > 500);
});

test('saves, edits, loads and replays the script', async () => {
  const file = path.join(os.tmpdir(), `play-mcp-${process.pid}.txt`);
  await client.callTool({ name: 'save_script_file', arguments: { path: file } });
  const saved = fs.readFileSync(file, 'utf8').trim().split('\n');
  assert.equal(saved.length, 3);
  await client.callTool({ name: 'replace_script', arguments: { lines: saved.slice(0, 2) } });
  assert.match(textOf(await client.callTool({ name: 'replay_script', arguments: {} })), /Played 2 line\(s\).*\n?No errors/s);
  const exported = file + '.json';
  await client.callTool({ name: 'save_script_file', arguments: { path: exported, format: 'export' } });
  await client.callTool({ name: 'reset_page', arguments: {} });
  assert.match(textOf(await client.callTool({ name: 'get_script', arguments: {} })), /\(empty\)/);
  assert.match(textOf(await client.callTool({ name: 'load_script_file', arguments: { path: exported } })), /Played 2 line\(s\)/);
  assert.match(textOf(await client.callTool({ name: 'get_script', arguments: {} })), /^1: addRect/);
  fs.rmSync(file); fs.rmSync(exported);
});

test('semantic actions: placed, drawn, recorded with their intent, undone', async () => {
  await client.callTool({ name: 'reset_page', arguments: {} });
  const run = textOf(await client.callTool({ name: 'apply_semantic_action', arguments: { actions: [
    { op: 'scene', name: 'why' },
    { op: 'viewer_task', type: 'infer', target: 'many causes' },
    { op: 'introduce', id: 'person', kind: 'figure', text: 'PERSON' },
    { op: 'introduce', id: 'food', kind: 'picture', src: 'img/placeholder.png', width: 80, place: { near: 'person', side: 'right' } },
    { op: 'introduce', id: 'culture', text: 'CULTURE', place: { near: 'person', side: 'left' } },
    { op: 'connect', from: 'culture', to: 'person' }
  ] } }));
  assert.match(run, /No errors/);
  const script = textOf(await client.callTool({ name: 'get_script', arguments: {} }));
  assert.match(script, /^1: \/\/ @sem \{"op":"scene","name":"why"/);
  const objs = JSON.parse(textOf(await client.callTool({ name: 'list_objects', arguments: {} })));
  const arrow = objs.find(o => o.uid === 'culture__person');
  assert.ok(arrow.box.width > 10, 'the grown arrow has a size (and so is drawn)');
  const scene = JSON.parse(textOf(await client.callTool({ name: 'inspect_scene', arguments: {} })));
  assert.deepEqual(scene.objects.map(o => o.id), ['person', 'food', 'culture']);
  assert.ok(scene.objects.every(o => o.live && o.live.visible));
  assert.match(textOf(await client.callTool({ name: 'validate_scene', arguments: {} })), /No issues found/);
  const bad = await client.callTool({ name: 'apply_semantic_action', arguments: { actions: [
    { op: 'introduce', id: 'habit', text: 'HABIT' }, { op: 'connect', from: 'habit', to: 'nobody' }] } });
  assert.ok(bad.isError);
  assert.equal(textOf(await client.callTool({ name: 'get_script', arguments: {} })), script, 'a failing list changes nothing');
  assert.match(textOf(await client.callTool({ name: 'undo_last_action', arguments: {} })), /No errors/);
  const after = JSON.parse(textOf(await client.callTool({ name: 'inspect_scene', arguments: {} })));
  assert.deepEqual(after.relations, []);
});

test('camera, curved arrows that follow, and bringing back a removed concept, on the page', async () => {
  await client.callTool({ name: 'reset_page', arguments: {} });
  const act = actions => client.callTool({ name: 'apply_semantic_action', arguments: { actions } });
  assert.match(textOf(await act([
    { op: 'scene', name: 'm2' },
    { op: 'introduce', id: 'a', text: 'A', place: { x: 300, y: 300 } },
    { op: 'introduce', id: 'b', text: 'B', place: { x: 700, y: 300 } },
    { op: 'connect', from: 'a', to: 'b' }, { op: 'connect', from: 'b', to: 'a' }, { op: 'connect', from: 'a', to: 'a' },
    { op: 'widen_context', scale: 0.5 }
  ])), /No errors/);
  const objs = () => client.callTool({ name: 'list_objects', arguments: {} }).then(r => JSON.parse(textOf(r)));
  let list = await objs();
  const ba = list.find(o => o.uid === 'b__a');
  assert.equal(ba.type, 'arrowpath');
  assert.ok(list.find(o => o.uid === 'a__a').box.width > 10, 'the loop is drawn');
  assert.equal((await client.callTool({ name: 'inspect_scene', arguments: {} }).then(r => JSON.parse(textOf(r)))).camera.zoom, 0.5);
  await client.callTool({ name: 'run_script_lines', arguments: { lines: ['animate("b", {top: 500}, {duration: 50})'], record: false } });
  list = await objs();
  assert.ok(list.find(o => o.uid === 'b__a').ends[1] > ba.ends[1] + 100, 'the curved arrow followed b');
  assert.match(textOf(await act([{ op: 'remove', ids: ['b'] }, { op: 'return_to', ids: ['b'] }])), /No errors/);
  list = await objs();
  const b = list.find(o => o.uid === 'b');
  assert.ok(b && b.visible && b.opacity === 1 && list.some(o => o.uid === 'a__b'), 'b is back with its arrows');
});

test('narration: a caption on the page, a timeline to read, a caption track to export', async () => {
  await client.callTool({ name: 'reset_page', arguments: {} });
  assert.match(textOf(await client.callTool({ name: 'apply_semantic_action', arguments: { actions: [
    { op: 'scene', name: 'n' }, { op: 'beat', name: 'ask' },
    { op: 'narrate', id: 'q1', text: 'Which box does it belong in?', seconds: 0.5 },
    { op: 'introduce', id: 'a', text: 'A' }
  ] } })), /No errors/);
  // A line that fails unless the caption shows the narration, tagged with its id.
  const check = 'Promise.resolve().then(() => { const c = document.getElementById("play-caption"); '
    + 'if (c.textContent !== "Which box does it belong in?" || c.dataset.id !== "q1" || c.style.opacity !== "1") throw new Error("caption: " + c.textContent + " " + c.dataset.id + " " + c.style.opacity); })';
  assert.match(textOf(await client.callTool({ name: 'run_script_lines', arguments: { record: false, lines: [check] } })), /No errors/);
  assert.match(textOf(await client.callTool({ name: 'scene_timeline', arguments: {} })), /q1 \(before, 0\.5s\): "Which box does it belong in\?"/);
  const file = path.join(os.tmpdir(), `play-mcp-${process.pid}.vtt`);
  assert.match(textOf(await client.callTool({ name: 'export_captions', arguments: { path: file } })), /Wrote 1 caption/);
  assert.match(fs.readFileSync(file, 'utf8'), /^WEBVTT\n\nq1\n00:00:00\.\d{3} --> /);
  fs.rmSync(file);
});

test('review_scene: a page per script, a section and frames per beat, made by a fast replay', async () => {
  const script = path.resolve(path.dirname(server), 'examples/river.txt');
  const out = path.join(os.tmpdir(), `play-mcp-review-${process.pid}.html`);
  const started = Date.now();
  const r = textOf(await client.callTool({ name: 'review_scene', arguments: { path: out, script } }, undefined,
    { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} }));
  assert.match(r, /Wrote a review of 4 beat\(s\)/);
  assert.ok(Date.now() - started < 40000, 'much faster than playing the scene');
  const html = fs.readFileSync(out, 'utf8');
  const beats = (fs.readFileSync(script, 'utf8').match(/"op":"beat"/g) || []).length;
  assert.equal(html.match(/<section class="beat"/g).length, beats);
  assert.ok(html.match(/data:image\/png;base64,/g).length >= beats);
  fs.rmSync(out);
});

test('check_plan: a plan replayed fast, told beat by beat, left as the script to review', async () => {
  const dir = path.resolve(path.dirname(server), 'examples');
  const out = path.join(os.tmpdir(), `play-mcp-check-${process.pid}.txt`);
  const t = textOf(await client.callTool({ name: 'check_plan', arguments: { path: path.join(dir, 'spectrum.plan.json'), out } }, undefined, { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} }));
  assert.equal((t.match(/^Beat \d+ "/gm) || []).length, 4);
  assert.match(t, /on screen: .+ (top|middle|bottom|left|right|centre)/);
  assert.match(t, /No warnings; written to /);
  assert.equal(fs.readFileSync(out, 'utf8').trim(), t.slice(0, t.lastIndexOf('\n\n')).trim());
  fs.rmSync(out);
  const script = textOf(await client.callTool({ name: 'get_script', arguments: {} }));
  assert.match(script, /"op":"beat"/);
});

test('review_scene takes a plan: planned on an empty page, reviewed in one go, left as the script', async () => {
  const dir = path.resolve(path.dirname(server), 'examples');
  await client.callTool({ name: 'run_script_lines', arguments: { lines: ['addRect(10, 10, 20, 20, {uid: "stray"})'] } });
  const out = path.join(os.tmpdir(), `play-mcp-review-${process.pid}.html`);
  const t = textOf(await client.callTool({ name: 'review_scene', arguments: { path: out, plan: path.join(dir, 'spectrum.plan.json') } }, undefined, { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} }));
  assert.match(t, /Wrote a review of 4 beat\(s\)/);
  assert.match(fs.readFileSync(out, 'utf8'), /Review: spectrum\.plan\.json/);
  fs.rmSync(out);
  const script = textOf(await client.callTool({ name: 'get_script', arguments: {} }));
  assert.match(script, /"op":"beat"/);
  assert.doesNotMatch(script, /stray/, 'from an empty page');
  assert.match(textOf(await client.callTool({ name: 'review_scene', arguments: { path: out, plan: path.join(dir, 'nope.json') } })), /Could not read the plan/);
});

test('revise src on the page: the picture keeps its place and size, a checkpoint brings the first image back, a missing image fails the check', async () => {
  await client.callTool({ name: 'reset_page', arguments: {} });
  const run = async actions => textOf(await client.callTool({ name: 'apply_semantic_action', arguments: { actions } }, undefined, { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} }));
  const live = async () => JSON.parse(textOf(await client.callTool({ name: 'list_objects', arguments: { uid: 'kid' } })))[0];
  assert.match(await run([
    { op: 'introduce', id: 'kid', kind: 'picture', src: 'img/placeholder.png', text: 'CHILD', width: 120, place: { region: 'left' } },
    { op: 'introduce', id: 'tree', text: 'TREE', place: { region: 'right' } },
    { op: 'connect', from: 'kid', to: 'tree' },
    { op: 'checkpoint', name: 'start' }
  ]), /No errors/);
  const before = await live();
  assert.match(await run([{ op: 'revise', id: 'kid', src: 'img/vertical.png' }]), /No errors/);
  const after = await live();
  assert.deepEqual(after.box, before.box, 'same place and size');
  assert.match(textOf(await client.callTool({ name: 'validate_scene', arguments: {} })), /No issues found/);
  assert.match(await run([{ op: 'revise', id: 'kid', text: 'CHILD LOOKING UP', src: 'img/placeholder.svg' }]), /No errors/);
  const mid = b => Math.round(b.left + b.width / 2);
  assert.equal(mid((await live()).box), mid(before.box), 'a longer label widens it round the same centre');
  assert.match(await run([{ op: 'return_to', name: 'start' }]), /No errors/);
  const back = await live();
  assert.deepEqual(back.box, before.box, 'back in place, same size');
  assert.match(JSON.stringify(back), /"CHILD"/, 'and its label as it was');
  assert.doesNotMatch(JSON.stringify(back), /LOOKING UP/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'play-mcp-pic-'));
  const planFile = path.join(dir, 'plan.json');
  const check = async src => {
    fs.writeFileSync(planFile, JSON.stringify({ title: 't', scenes: [{ name: 's', beats: [
      { name: 'a', move: 'a picture', viewer_task: { type: 'notice', target: 'it' }, actions: [{ op: 'introduce', id: 'kid', kind: 'picture', src: 'img/placeholder.png', text: 'CHILD' }] },
      { name: 'b', move: 'it changes', viewer_task: { type: 'notice', target: 'it changed' }, actions: [{ op: 'revise', id: 'kid', src }] }
    ] }] }));
    return textOf(await client.callTool({ name: 'check_plan', arguments: { path: planFile } }, undefined, { timeout: 60000, resetTimeoutOnProgress: true, onprogress: () => {} }));
  };
  // A missing file is refused before anything plays; one that cannot load while playing fails the check, naming it.
  assert.match(await check('img/missing.png'), /scene 1 "s", beat 2 "b", picture not found: img\/missing\.png/);
  assert.match(await check('http://127.0.0.1:9/missing.png'), /line\(s\) failed while replaying: picture "kid": could not load http:\/\/127\.0\.0\.1:9\/missing\.png/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('build_from_plan checks fast first: a plan with warnings is not built unless build_anyway', async () => {
  const opts = [undefined, { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} }];
  const file = path.join(os.tmpdir(), `play-mcp-overlap-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({ title: 't', scenes: [{ name: 's', beats: [{ name: 'b', actions: [
    { op: 'introduce', id: 'a', text: 'ONE', place: { x: 700, y: 400 } }, { op: 'introduce', id: 'c', text: 'TWO', place: { x: 705, y: 400 } }] }] }] }));
  const refused = textOf(await client.callTool({ name: 'build_from_plan', arguments: { path: file } }, ...opts));
  assert.match(refused, /^Not built: the fast check found [1-9]\d* warning\(s\)\./);
  assert.match(refused, /Beat 1 "b"[\s\S]*warning: .*overlap/);
  const built = textOf(await client.callTool({ name: 'build_from_plan', arguments: { path: file, build_anyway: true } }, ...opts));
  assert.match(built, /^Built the plan: [\s\S]*Fast check first: [1-9]\d* warning\(s\), built anyway\./);
  fs.rmSync(file);
});

test('build_from_plan: a plan builds the same scene the actions do; a wrong id is named by place and builds nothing', async () => {
  const dir = path.resolve(path.dirname(server), 'examples');
  const opts = [undefined, { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} }];
  assert.match(textOf(await client.callTool({ name: 'build_from_plan', arguments: { path: path.join(dir, 'spectrum.plan.json'), dry_run: true } })),
    /^The plan can be built: 1 scene\(s\), 4 beat\(s\), 17 action\(s\), about \d+ s\.$/);
  const built = textOf(await client.callTool({ name: 'build_from_plan', arguments: { path: path.join(dir, 'spectrum.plan.json') } }, ...opts));
  assert.match(built, /Fast check first: no warnings\.[\s\S]*No errors[\s\S]*validate_scene: no issues/);
  const script = textOf(await client.callTool({ name: 'get_script', arguments: {} })).split('\n').map(l => l.replace(/^\d+: /, ''));
  assert.deepEqual(script, parseScriptFile(fs.readFileSync(path.join(dir, 'spectrum.txt'), 'utf8')));
  const bad = path.join(os.tmpdir(), `play-mcp-plan-${process.pid}.json`);
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'spectrum.plan.json'), 'utf8'));
  plan.scenes[0].beats[2].actions[1].id = 'dayy';
  fs.writeFileSync(bad, '```json\n' + JSON.stringify(plan) + '\n```\n');  // as an assistant often answers
  assert.equal(textOf(await client.callTool({ name: 'build_from_plan', arguments: { path: bad } })),
    'The plan cannot be built:\n- scene 1 "spectrum", beat 3 "the line fails", action 2 (weaken_boundary): weaken_boundary: no concept "dayy"\n(Later beats were not checked: they may rely on this one.)');
  assert.deepEqual(textOf(await client.callTool({ name: 'get_script', arguments: {} })).split('\n').map(l => l.replace(/^\d+: /, '')), script, 'nothing was built');
  fs.rmSync(bad);
});

test('every example replays without errors and validates clean', async () => {
  const dir = path.resolve(path.dirname(server), 'examples');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
    await client.callTool({ name: 'reset_page', arguments: {} });
    // Narrated scenes play for minutes: the server's progress heartbeat keeps a 30 s timeout from running out.
    let beats = 0;
    const loaded = await client.callTool({ name: 'load_script_file', arguments: { path: path.join(dir, file) } }, undefined,
      { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => { beats++; } });
    assert.match(textOf(loaded), /No errors/, file);
    if (file === 'opening_question.txt') assert.ok(beats > 5, `progress was reported (${beats})`);
    const issues = textOf(await client.callTool({ name: 'validate_scene', arguments: {} }));
    // Small text is allowed: widening makes it small on purpose.
    assert.ok(!issues.split('\n').some(l => /^(error|warning):/.test(l) && !/hard to read/.test(l)), `${file}: ${issues}`);
  }
});

test('the opening-question example replays and rebuilds its scene', async () => {
  const file = path.resolve(path.dirname(server), 'examples/opening_question.txt');
  assert.match(textOf(await client.callTool({ name: 'load_script_file', arguments: { path: file } }, undefined,
    { timeout: 30000, resetTimeoutOnProgress: true, onprogress: () => {} })), /No errors/);
  const scene = JSON.parse(textOf(await client.callTool({ name: 'inspect_scene', arguments: {} })));
  assert.equal(scene.beats.length, 7);
  assert.ok(scene.objects.every(o => o.live && o.live !== 'missing from canvas'));
  assert.deepEqual(scene.objects.find(o => o.id === 'knowledge').revisions, ['I KNOW', 'I THINK I KNOW', 'I THINK I MIGHT KNOW', "I DON'T KNOW"]);
});

test('also works over HTTP', async () => {
  const port = 3400 + (process.pid % 500);
  const child = spawn(process.execPath, [server, '--headless', '--http', String(port)], { stdio: ['ignore', 'ignore', 'pipe'] });
  await new Promise(resolve => child.stderr.on('data', d => { if (String(d).includes('/mcp')) resolve(); }));
  const http = new Client({ name: 'test-http', version: '1' });
  await http.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  const run = textOf(await http.callTool({ name: 'run_script_lines', arguments: { lines: ['addRect(10,10,40,40,{"uid":"H1"})'] } }));
  assert.match(run, /No errors/);
  const objs = JSON.parse(textOf(await http.callTool({ name: 'list_objects', arguments: {} })));
  assert.ok(objs.some(o => o.uid === 'H1'));
  await http.close();
  child.kill('SIGTERM');
});

test('reports a connector to a missing object, and overlapping calls run in order', async () => {
  await client.callTool({ name: 'reset_page', arguments: {} });
  const [a, b] = await Promise.all([
    client.callTool({ name: 'run_script_lines', arguments: { lines: ['addRect(50,50,60,40,{"uid":"A1"})', 'animate("A1", {left: 200}, {duration: 400})'] } }),
    client.callTool({ name: 'run_script_lines', arguments: { lines: ['connectObjects("A1", "NOPE", "L1")'] } })
  ]);
  assert.match(textOf(a), /No errors/);
  assert.match(textOf(b), /Line 1 failed: .*no object "NOPE"/);
  const script = textOf(await client.callTool({ name: 'get_script', arguments: {} }));
  assert.match(script, /^1: addRect.*\n2: animate.*\n3: connectObjects/);
});
