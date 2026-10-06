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
  assert.deepEqual(names, ['apply_semantic_action', 'get_script', 'inspect_scene', 'list_functions', 'list_objects',
    'load_script_file', 'replace_script', 'replay_script', 'reset_page', 'run_script_lines', 'save_script_file',
    'screenshot', 'undo_last_action', 'validate_scene']);
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
  assert.match(script, /^1: \/\/ @sem \{"op":"scene","name":"why"\}/);
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

test('the opening-question example replays and rebuilds its scene', async () => {
  const file = path.resolve(path.dirname(server), 'examples/opening_question.txt');
  assert.match(textOf(await client.callTool({ name: 'load_script_file', arguments: { path: file } })), /No errors/);
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
