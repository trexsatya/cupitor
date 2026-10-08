#!/usr/bin/env node
// MCP server for writing play.html animations. It opens play.html in a
// Chromium window and lets an MCP client (Claude, Cursor, VS Code, ...) run
// script lines there, look at the result and save the script.
//
//   node server.js                 stdio (what most MCP clients launch)
//   node server.js --http 3337     Streamable HTTP at http://127.0.0.1:3337/mcp
//   --headless                     no visible browser window
//   --public <dir>                 the folder holding play.html (default: ../../public)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PlayPage, parseScriptFile } from './page-driver.js';
import { reviewStops, buildReviewHtml, beatSummaries } from './review.js';
import { ACTIONS, parseScene, planActions, inspect, validate, withoutLastAction, describeTimeline, captionsFile, narrationIssues, timeline } from './scene.js';
import { planBeats, planSpec } from './plan.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const opts = { http: null, headless: false, publicDir: path.resolve(here, '../../public') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--http') opts.http = Number(argv[++i]) || 3337;
    else if (argv[i] === '--headless') opts.headless = true;
    else if (argv[i] === '--public') opts.publicDir = path.resolve(argv[++i]);
  }
  if (process.env.PLAY_MCP_HEADLESS === '1') opts.headless = true;
  return opts;
}

// The function reference the page's "? Functions" popup shows
// (public/script-functions.js), as [group, [[signature, description, options], ...]].
export function loadFunctions(publicDir) {
  const code = fs.readFileSync(path.join(publicDir, 'script-functions.js'), 'utf8');
  return vm.runInNewContext(code + '\n;SCRIPT_FUNCTIONS', {});
}

export function formatFunctions(groups, filter) {
  const q = (filter || '').trim().toLowerCase();
  const out = [];
  groups.forEach(([group, items]) => {
    const shown = items.filter(([sig, desc, opts]) => !q ||
      [sig, desc, ...(opts || []).flat()].join(' ').toLowerCase().includes(q));
    if (!shown.length) return;
    out.push(`## ${group}`);
    shown.forEach(([sig, desc, opts]) => {
      out.push(`- ${sig} — ${desc}`);
      (opts || []).forEach(([key, meaning]) => out.push(`    - ${key}: ${meaning}`));
    });
  });
  return out.join('\n') || 'No function matches.';
}

// A picture's src: URLs and paths under public/ are used as they are; a local
// file elsewhere is copied into public/play-assets/ so the script (and the
// page's Import) can load it by a path under public/.
export function resolvePictureSrc(src, publicDir) {
  if (/^(https?:|data:)/i.test(src)) return src;
  const inPublic = path.resolve(publicDir, src.replace(/^\/+/, ''));
  if (!path.isAbsolute(src) && fs.existsSync(inPublic)) return path.relative(publicDir, inPublic).split(path.sep).join('/');
  const file = path.resolve(src);
  if (!fs.existsSync(file)) throw new Error(`picture not found: ${src}`);
  const rel = path.relative(publicDir, file);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel.split(path.sep).join('/');
  const data = fs.readFileSync(file);
  const hash = crypto.createHash('sha1').update(data).digest('hex').slice(0, 8);
  const name = `${path.basename(file, path.extname(file))}-${hash}${path.extname(file)}`;
  const dir = path.join(publicDir, 'play-assets');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, name))) fs.writeFileSync(path.join(dir, name), data);
  return `play-assets/${name}`;
}

function resolvePictures(actions, publicDir) {
  const fix = o => { if (o && typeof o === 'object' && typeof o.src === 'string') o.src = resolvePictureSrc(o.src, publicDir); };
  actions.forEach(a => { fix(a); fix(a && a.with); [...((a && a.items) || []), ...((a && a.arriving) || [])].forEach(fix); });
  return actions;
}

const INSTRUCTIONS = `Writes animations for play.html, a Fabric.js whiteboard with a script player.

Guided visual reasoning (preferred): design at the level of meaning, not pixels.
For each passage: name the narrator's move, set a viewer_task (notice/compare/predict/infer/remember/question/integrate),
reuse concepts already on screen, use the smallest visual model, reveal progressively, and treat pauses as real states.
apply_semantic_action takes actions like {op: "introduce", id: "culture", text: "CULTURE", place: {near: "person", side: "left"}};
the server places things, writes the script lines, and keeps each action as a "// @sem {...}" comment in the script,
so the scene model always comes from the script itself. Narration is {op: "narrate", text}: a caption timed to reading pace;
check_plan replays a plan fast and says beat by beat what is on screen and where; scene_timeline shows narration and moves with their times; export_captions writes a caption track. inspect_scene shows the model; validate_scene checks overlaps,
off-canvas objects, small text and missing objects; undo_last_action takes the last action back.

Low-level scripting:
A script is a list of JavaScript lines run in order in the page. Each line runs after the previous one:
lines starting with animate, Promise, connectObjects, reveal, drawOutline, revertState, markStep or timelineStep are waited for; other lines are followed by a ~1 s pause.
Lines starting with // are comments (a /* ... */ can span lines): kept in the script, skipped when it plays; use them to label scenes.
Objects have uids (e.g. "R1", "T2"); pass {uid: "..."} when creating objects so later lines can refer to them.
Coordinates are canvas pixels (top-left 0,0; the visible canvas is about 1400x800 at zoom 1).
Workflow: list_functions to see what is available and its options; run_script_lines to add and play lines;
list_objects / screenshot to check the result; replay_script to watch the whole thing from the start;
save_script_file to keep it (the page's Import button loads such files).`;

// Reading the script, planning against it and playing the result happen as
// one step, so two clients can't plan from the same script and both append.
let sceneQueue = Promise.resolve();
const exclusive = fn => { const run = sceneQueue.then(fn); sceneQueue = run.catch(() => {}); return run; };

// The request a tool call is serving, so playback can report progress on it.
const currentRequest = new AsyncLocalStorage();
const HEARTBEAT_MS = 5000;

export function createServer(page, publicDir) {
  const server = new McpServer({ name: 'play-animations', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  const tool = (name, config, handler) => server.registerTool(name, config, (...args) => currentRequest.run(args[args.length - 1], () => handler(...args)));
  // Playing a narrated scene takes minutes. While it plays, a client that asked
  // for progress hears every few seconds, so it can keep waiting.
  const withProgress = async work => {
    const extra = currentRequest.getStore();
    const token = extra && extra._meta && extra._meta.progressToken;
    if (token === undefined) return work();
    const started = Date.now();
    const beat = setInterval(() => {
      extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: Math.round((Date.now() - started) / 1000), message: 'playing' } }).catch(() => {});
    }, HEARTBEAT_MS);
    try { return await work(); } finally { clearInterval(beat); }
  };
  const play = (lines, opts) => withProgress(() => page.play(lines, opts));
  const text = t => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
  const report = r => {
    const lines = [`Played ${r.played} line(s) in ${r.ms} ms.`];
    r.lineErrors.forEach(e => lines.push(`Line ${e.line} failed: ${e.message}`));
    r.pageErrors.forEach(e => lines.push(`Page error: ${e}`));
    if (!r.lineErrors.length && !r.pageErrors.length) lines.push('No errors.');
    return lines.join('\n');
  };

  tool('list_functions', {
    description: 'Functions a play.html script can call, with their options. Optionally filter by a word (e.g. "tree", "text", "reveal").',
    inputSchema: { filter: z.string().optional() }
  }, async ({ filter }) => text(formatFunctions(loadFunctions(publicDir), filter)));

  tool('run_script_lines', {
    description: 'Add script lines to the recorded script and play them in the page (each line waits as the player does). Returns failures per line.',
    inputSchema: {
      lines: z.array(z.string()).min(1).describe('JavaScript lines, one statement each, e.g. addRect(100,100,120,60,{"uid":"R1","fill":"#90caf9"})'),
      record: z.boolean().optional().describe('Add them to the recorded script (default true). False just tries them.')
    }
  }, async ({ lines, record }) => text(report(await play(lines, { record: record !== false }))));

  tool('list_objects', {
    description: 'Objects on the canvas (including inside groups): uid, type, bounding box, angle, visibility, colours, text, tree children and connectors.',
    inputSchema: { uid: z.string().optional().describe('Only this object') }
  }, async ({ uid }) => text(await page.objects(uid)));

  tool('screenshot', {
    description: 'PNG of the canvas, or of one object with a margin around it.',
    inputSchema: { uid: z.string().optional(), margin: z.number().optional() }
  }, async ({ uid, margin }) => {
    const png = await page.screenshot(uid, margin);
    return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] };
  });

  tool('get_script', {
    description: 'The recorded script: every line so far, in order (1-based line numbers).'
  }, async () => {
    const lines = await page.script();
    return text(lines.map((l, i) => `${i + 1}: ${l}`).join('\n') || '(empty)');
  });

  tool('replace_script', {
    description: 'Replace the whole recorded script (e.g. to edit or delete lines). Use replay_script to see the result.',
    inputSchema: { lines: z.array(z.string()) }
  }, async ({ lines }) => { await page.setScript(lines); return text(`Script has ${lines.length} line(s).`); });

  tool('replay_script', {
    description: 'Clear the canvas and play the whole recorded script from the start. Returns failures per line.',
    inputSchema: { clear: z.boolean().optional().describe('Clear the canvas first (default true)') }
  }, async ({ clear }) => text(report(await play(null, { clearFirst: clear !== false }))));

  tool('load_script_file', {
    description: 'Load a script file (plain lines, or a play.html Export) as the recorded script and replay it.',
    inputSchema: { path: z.string() }
  }, async ({ path: file }) => {
    const lines = parseScriptFile(fs.readFileSync(path.resolve(file), 'utf8'));
    await page.setScript(lines);
    return text(report(await play(null, { clearFirst: true })));
  });

  tool('save_script_file', {
    description: "Save the recorded script to a file: 'lines' (one line per row, as the script editor shows) or 'export' (what the page's Export button writes). Both load with the page's Import button.",
    inputSchema: { path: z.string(), format: z.enum(['lines', 'export']).optional() }
  }, async ({ path: file, format }) => {
    const lines = await page.script();
    const body = format === 'export'
      ? JSON.stringify(await page.evaluate(() => buildScriptExecutables()))
      : lines.join('\n') + '\n';
    fs.writeFileSync(path.resolve(file), body);
    return text(`Saved ${lines.length} line(s) to ${path.resolve(file)}.`);
  });

  tool('apply_semantic_action', {
    description: 'Apply semantic actions in order (one beat, usually): the server lays them out, adds them to the script (each after a "// @sem" comment that records it) and plays them. If any action is invalid, none is applied. Actions:\n'
      + Object.entries(ACTIONS).map(([op, d]) => `- ${op}: ${d}`).join('\n')
      + '\npace (optional on most): instant | short | deliberate, or ms.',
    inputSchema: { actions: z.array(z.object({ op: z.enum(Object.keys(ACTIONS)) }).passthrough()).min(1) }
  }, async ({ actions }) => exclusive(async () => {
    const model = parseScene(await page.script());
    const { lines, records } = await planActions(model, resolvePictures(actions, publicDir), specs => page.measure(specs));
    const result = report(await play(lines, { record: true }));
    const placed = records.flatMap(r => (r.at ? [`${r.id} at ${r.at.join(',')}`] : []).concat((r.items || r.arriving || []).map(i => `${i.id} at ${i.at.join(',')}`)));
    return text([result, placed.length ? `Placed: ${placed.join('; ')}` : ''].filter(Boolean).join('\n'));
  }));

  tool('inspect_scene', {
    description: 'The scene model rebuilt from the script: scenes, beats, viewer tasks, concepts (role, text and its revisions, emphasis, boundary, groups, enclosures) and relationships, with each one\'s live box on the canvas.'
  }, async () => text(inspect(parseScene(await page.script()), await page.objects())));

  tool('validate_scene', {
    description: 'Checks the scene: overlapping concepts, things off the canvas, text too small to read, concepts or relationships missing from the canvas, enclosures that miss members or catch others, a scene with no viewer_task.'
  }, async () => {
    const lines = await page.script();
    const issues = validate(parseScene(lines), await page.objects(), lines);
    return text(issues.length ? issues.map(i => `${i.level}: ${i.message}`).join('\n') : 'No issues found.');
  });

  tool('scene_timeline', {
    description: 'The script as it will play: each beat with its start time and length, its viewer task, the narration lines (with how long each is held) and the visual moves in order, with estimated times.'
  }, async () => text(describeTimeline(await page.script())));

  tool('export_captions', {
    description: "Write the narration as a caption track timed to the script: 'vtt' (WebVTT, default; cue ids are the narration ids) or 'srt'.",
    inputSchema: { path: z.string(), format: z.enum(['vtt', 'srt']).optional() }
  }, async ({ path: file, format }) => {
    const body = captionsFile(await page.script(), format || 'vtt');
    fs.writeFileSync(path.resolve(file), body);
    return text(`Wrote ${(body.match(/-->/g) || []).length} caption(s) to ${path.resolve(file)}.`);
  });

  tool('review_scene', {
    description: "Write a review page (one self-contained HTML file) for the script: per beat, the narrator's move, the viewer task, the narration with times, the visual moves in plain words, a checklist, the issues found at the end of the beat, and screenshots before the first reveal (when the beat holds one back) and at the end. The script is replayed fast for the screenshots, leaving the canvas at its end.",
    inputSchema: { path: z.string().describe('the HTML file to write'), script: z.string().optional().describe('a script file to review (loaded as the recorded script first); default: the recorded script') }
  }, async ({ path: file, script }) => exclusive(async () => {
    let lines;
    if (script) { lines = parseScriptFile(fs.readFileSync(path.resolve(script), 'utf8')); await page.setScript(lines); }
    else lines = await page.script();
    const stops = reviewStops(lines);
    if (!stops.length) return text('The script has no beats to review (add {op: "beat", name} actions).');
    const at = []; // what each walk stop is: [key, line index, beat number or null]
    stops.forEach((s, i) => {
      if (s.beforeIndex != null) at.push([`${i}:before`, s.beforeIndex, null]);
      at.push([`${i}:end`, s.endIndex, i]);
    });
    const frames = {}, issues = {};
    const walked = await withProgress(() => page.walk(lines, at.map(a => a[1]), async (k, look) => {
      if (k >= at.length) return;
      const [key, index, beat] = at[k];
      frames[key] = (await look.screenshot()).toString('base64');
      if (beat != null) issues[beat] = validate(parseScene(lines.slice(0, index)), await look.objects(), lines.slice(0, index));
    }));
    const title = script ? path.basename(script) : 'Recorded script';
    fs.writeFileSync(path.resolve(file), buildReviewHtml({ title: `Review: ${title}`, lines, stops, frames, issues }));
    const failed = walked.lineErrors.length ? `\n${walked.lineErrors.length} line(s) failed while replaying.` : '';
    return text(`Wrote a review of ${stops.length} beat(s) with ${Object.keys(frames).length} screenshot(s) to ${path.resolve(file)}.${failed}`);
  }));

  tool('plan_spec', {
    description: 'Instructions (with a worked example) for writing a plan: a JSON scene document another assistant can produce from a text, for build_from_plan.'
  }, async () => text(planSpec(JSON.parse(fs.readFileSync(path.join(here, 'examples/spectrum.plan.json'), 'utf8')))));

  // A plan file planned beat by beat (nothing plays): its lines, or the error
  // that stops it, named by scene, beat and action.
  const planFile = async (file, fresh) => {
    let plan;
    // Assistants often wrap their answer in a ```json fence.
    try { plan = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, '$1')); } catch (e) { return { error: `Could not read the plan: ${e.message}` }; }
    const { errors, warnings, beats } = planBeats(plan);
    if (errors.length) return { error: ['The plan cannot be built:', ...errors.map(e => `- ${e}`)].join('\n') };
    const start = fresh === false ? await page.script() : [];
    const model = parseScene(start);
    const lines = [];
    for (const b of beats) {
      try {
        lines.push(...(await planActions(model, resolvePictures([...b.head, ...b.actions], publicDir), specs => page.measure(specs))).lines);
      } catch (e) {
        // planActions counts the beat's own scene/beat entries first.
        const m = /^Action (\d+) \(([^)]*)\): ([\s\S]*)$/.exec(e.message);
        const n = m ? +m[1] - b.head.length : 0;
        const what = !m ? e.message : n > 0 ? `action ${n} (${m[2]}): ${m[3]}` : `the beat itself: ${m[3]}`;
        return { error: `The plan cannot be built:\n- ${b.where}, ${what}\n(Later beats were not checked: they may rely on this one.)` };
      }
    }
    return { plan, beats, warnings, start, lines };
  };

  // A planned plan replayed fast from an empty page, stopping at the end of
  // each beat: the beat-by-beat text, how many warnings are new in a beat, and
  // how many lines failed. The plan is left as the recorded script.
  const checkPlanned = async (file, { plan, beats, warnings, lines }) => {
    await page.reset();
    await page.setScript(lines);
    const stops = reviewStops(lines);
    const issues = {};
    const walked = await withProgress(() => page.walk(lines, stops.map(s => s.endIndex), async (k, look) => {
      if (k < stops.length) issues[k] = validate(parseScene(lines.slice(0, stops[k].endIndex)), await look.objects(), lines.slice(0, stops[k].endIndex));
    }));
    // Each beat's issues are how the canvas stood at its end (narration ones say which beat they start in).
    const tbs = timeline(lines).beats.filter(b => b.isBeat);
    const count = stops.reduce((n, _, i) => n + (issues[i] || []).filter(x => x.level === 'warning' && (x.at == null || x.at === (tbs[i] || {}).start)
      && !(issues[i - 1] || []).some(y => y.message === x.message)).length, 0);
    const head = [
      `Plan ${path.basename(file)}: ${plan.scenes.length} scene(s), ${beats.length} beat(s), about ${Math.round(timeline(lines).total / 1000)} s.`,
      ...(walked.lineErrors.length ? [`${walked.lineErrors.length} line(s) failed while replaying: ${walked.lineErrors.slice(0, 3).map(e => e.message || e).join('; ')}`] : []),
      ...warnings.map(w => `note: ${w}`),
      'Places are ninths of the screen (top-left … bottom-right, middle). Warnings are listed in the beat where they first appear.',
      ''
    ];
    return { body: head.join('\n') + beatSummaries({ lines, stops, issues }), count, failed: walked.lineErrors.length };
  };

  tool('check_plan', {
    description: 'Check a plan file fast: plan it as build_from_plan does, replay it with every animation instant (seconds, not the film\'s length) and say, beat by beat, what is on screen and where (a ninth of the screen), the frames and arrows, what came and went, and the warnings new in that beat. The text is meant to be pasted back to whoever writes the plan. The plan is left as the recorded script (review_scene can follow).',
    inputSchema: {
      path: z.string().describe('the plan (JSON)'),
      out: z.string().optional().describe('also write the text to this file')
    }
  }, async ({ path: file, out }) => exclusive(async () => {
    const planned = await planFile(file, true);
    if (planned.error) return text(planned.error);
    const { body, count, failed } = await checkPlanned(file, planned);
    if (out) fs.writeFileSync(path.resolve(out), body + '\n');
    return text(`${body}\n\n${count ? `${count} warning(s) in all` : 'No warnings'}${failed ? `, ${failed} line(s) failed` : ''}${out ? `; written to ${path.resolve(out)}` : ''}.`);
  }));

  tool('build_from_plan', {
    description: 'Build a scene from a plan file (the format plan_spec describes). Every beat is planned before anything plays, so a mistake anywhere builds nothing and is reported by scene, beat and action. Then the plan is checked fast first (as check_plan, about a minute): if that finds warnings, nothing is built and the beat-by-beat check is returned instead, unless build_anyway. dry_run only plans it (and estimates its length and narration timing).',
    inputSchema: {
      path: z.string().describe('the plan (JSON)'),
      dry_run: z.boolean().optional().describe('plan it without building it (no fast check either)'),
      fresh: z.boolean().optional().describe('start from an empty page (default true); false adds the plan to the current script (no fast check)'),
      build_anyway: z.boolean().optional().describe('build even when the fast check finds warnings (it still runs and its warnings are reported)')
    }
  }, async ({ path: file, dry_run, fresh, build_anyway }) => exclusive(async () => {
    const planned = await planFile(file, fresh);
    if (planned.error) return text(planned.error);
    const { plan, beats, warnings, start, lines } = planned;
    const notes = [...warnings, ...narrationIssues([...start, ...lines]).map(i => `${i.level}: ${i.message}`)];
    const size = `${plan.scenes.length} scene(s), ${beats.length} beat(s), ${beats.reduce((n, b) => n + b.actions.length, 0)} action(s), about ${Math.round(timeline([...start, ...lines]).total / 1000)} s`;
    if (dry_run) return text([`The plan can be built: ${size}.`, ...(notes.length ? ['Notes:', ...notes.map(n => `- ${n}`)] : [])].join('\n'));
    // The fast check first: a minute now saves a full-length build that would show the same warnings.
    let checked = null;
    if (fresh !== false) {
      checked = await checkPlanned(file, planned);
      if ((checked.count || checked.failed) && !build_anyway) {
        return text([`Not built: the fast check found ${checked.count} warning(s)${checked.failed ? ` and ${checked.failed} failed line(s)` : ''}. Fix the plan, or build with build_anyway to watch it as it is.`, '', checked.body].join('\n'));
      }
    }
    if (fresh !== false) await page.reset();
    const result = report(await play(lines, { record: true }));
    const after = await page.script();
    const issues = validate(parseScene(after), await page.objects(), after).map(i => `${i.level}: ${i.message}`);
    return text([`Built the plan: ${size}.`, ...(checked ? [`Fast check first: ${checked.count ? `${checked.count} warning(s), built anyway` : 'no warnings'}.`] : []), result, ...(warnings.length ? ['Notes:', ...warnings.map(n => `- ${n}`)] : []), ...(issues.length ? ['validate_scene:', ...issues.map(n => `- ${n}`)] : ['validate_scene: no issues.'])].join('\n'));
  }));

  tool('undo_last_action', {
    description: 'Remove the last semantic action (its "// @sem" comment and every line after it, and the enclosure drawn for it when it was an arrow to a group) from the script and replay the script.'
  }, async () => exclusive(async () => {
    const cut = withoutLastAction(await page.script());
    if (!cut) return text('No semantic action in the script.');
    await page.setScript(cut.lines);
    const result = report(await play(null, { clearFirst: true }));
    return text(`Removed ${cut.removed.length} line(s), starting with: ${cut.removed[0]}\n${result}`);
  }));

  tool('reset_page', {
    description: 'Reload play.html: empty canvas and empty recorded script.'
  }, async () => { await page.reset(); return text('Page reloaded.'); });

  return server;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const page = new PlayPage({ publicDir: opts.publicDir, headless: opts.headless });
  const shutdown = async () => { await page.close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (!opts.http) {
    await createServer(page, opts.publicDir).connect(new StdioServerTransport());
    return;
  }
  // Stateless Streamable HTTP: a fresh server per request, one shared page.
  http.createServer(async (req, res) => {
    if (!req.url.startsWith('/mcp')) { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const server = createServer(page, opts.publicDir);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => { transport.close(); server.close(); });
        await server.connect(transport);
        await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      } catch (e) {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(e.message || e) }, id: null }));
      }
    });
  }).listen(opts.http, '127.0.0.1', () => {
    console.error(`play-animations MCP server on http://127.0.0.1:${opts.http}/mcp`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
