#!/usr/bin/env node
// Records a narrated video of each whiteboard feature: drives play.html the
// way a person does (toolbar, mouse, keys, panels) with a caption per step
// and a visible cursor, then (with ffmpeg) converts each clip to mp4 and
// joins them into whiteboard-features.mp4.
//
//   node tools/whiteboard-demo/record.mjs            all clips
//   node tools/whiteboard-demo/record.mjs 04-presenting 07-scripts
//   --out <dir>   where the videos go (default tools/whiteboard-demo/out)
//   --no-mp4      keep only the recorded .webm files
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const { Board, fixture } = await import(pathToFileURL(path.join(ROOT, 'tests/whiteboard/board.mjs')));
const { serveStatic } = await import(pathToFileURL(path.join(ROOT, 'tools/play-mcp/page-driver.js')));
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? null : (args.splice(i, 1), true); };
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const OUT = path.resolve(option('--out') || path.join(here, 'out'));
const MP4 = !flag('--no-mp4');
const SIZE = { width: 1400, height: 850 };
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'; // the ⌘ / Ctrl key
const wait = ms => new Promise(r => setTimeout(r, ms));

// Slower, visible versions of the test board's actions.
class DemoBoard extends Board {
  async dragCanvas(x1, y1, x2, y2) {
    const [a, b] = await this.screen(x1, y1), [c, d] = await this.screen(x2, y2);
    await this.page.mouse.move(a, b, { steps: 12 }); await wait(250);
    await this.page.mouse.down();
    await this.page.mouse.move(c, d, { steps: 30 });
    await this.page.mouse.up(); await wait(500);
  }
  async dragHandle(key, dx, dy) {
    const [x, y] = await this.eval(k => { const o = pc.getActiveObject(); o.setCoords(); const r = pc.upperCanvasEl.getBoundingClientRect(); return [r.left + o.oCoords[k].x, r.top + o.oCoords[k].y]; }, key);
    await this.page.mouse.move(x, y, { steps: 12 }); await wait(250);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 30 });
    await this.page.mouse.up(); await wait(500);
  }
  async click(x, y, opts) { const [sx, sy] = await this.screen(x, y); await this.page.mouse.move(sx, sy, { steps: 12 }); await wait(150); await this.page.mouse.click(sx, sy, opts); await wait(400); }
  async select(uid) { const [x, y] = await this.centerOf(uid); await this.click(x, y); }
  async key(k) { await this.page.keyboard.press(k); await wait(500); }
  async type(text) { await this.page.keyboard.type(text, { delay: 70 }); }
  async typeInPopup(text) {
    await this.page.waitForSelector('#askTextPopup textarea');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) { if (i) await this.page.keyboard.press('Enter'); await this.type(lines[i]); }
    await wait(400); await this.page.keyboard.press(`${mod}+Enter`); await wait(600);
  }
  async press(selector) {
    const r = await this.page.locator(selector).first().boundingBox();
    await this.page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 12 }); await wait(200);
    await this.page.locator(selector).first().click(); await wait(600);
  }
  // Marks a stretch of the clip to play faster in the mp4 (e.g. a long import).
  fast(on) {
    const t = (Date.now() - this.t0) / 1000;
    if (on) this.fastFrom = t; else if (this.fastFrom != null) { this.fastParts.push([this.fastFrom, t]); this.fastFrom = null; }
  }
  async caption(text) {
    this.lastCaption = text;
    await this.eval(t => {
      let el = document.getElementById('demo-caption');
      if (!el) {
        el = document.createElement('div'); el.id = 'demo-caption';
        el.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:2147483647;background:rgba(20,20,30,.82);color:#fff;font:600 20px/1.35 -apple-system,Segoe UI,Arial;padding:10px 18px;border-radius:10px;max-width:80%;text-align:center;pointer-events:none;';
        document.body.appendChild(el);
      }
      el.textContent = t; el.style.display = t ? '' : 'none';
    }, text);
    await wait(1400);
  }
  async title(text, sub) {
    await this.eval(([t, s]) => {
      const el = document.createElement('div'); el.id = 'demo-title';
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#1b2330;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 44px -apple-system,Segoe UI,Arial;gap:14px;';
      el.innerHTML = '<div></div><div style="font-weight:400;font-size:22px;opacity:.8"></div>';
      el.children[0].textContent = t; el.children[1].textContent = s || '';
      document.body.appendChild(el);
    }, [text, sub]);
    await wait(2200);
    await this.eval(() => document.getElementById('demo-title').remove());
  }
}

// A dot that follows the mouse (videos don't show the real pointer); it flashes on click.
const CURSOR = () => {
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,64,64,.55);border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.5);z-index:2147483647;pointer-events:none;transition:transform .08s;';
    document.body.appendChild(dot);
    const move = e => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; };
    addEventListener('mousemove', move, true);
    addEventListener('mousedown', e => { move(e); dot.style.transform = 'scale(1.6)'; }, true);
    addEventListener('mouseup', () => { dot.style.transform = ''; }, true);
  });
};

let http, browser;
async function clip(name, fn) {
  const dir = `${OUT}/raw/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const b = new DemoBoard(page);
  b.t0 = Date.now(); b.fastParts = [];
  await page.goto(`${http.url}/play.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.pc && window.playScript && window.undoManager, null, { timeout: 60000 });
  await wait(500);
  try { await fn(b); } catch (e) { console.error(name, 'FAILED after caption:', JSON.stringify(b.lastCaption), e.message); }
  await b.caption(''); await wait(600);
  const video = page.video();
  await context.close();
  fs.renameSync(await video.path(), `${OUT}/raw/${name}.webm`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(`${OUT}/raw/${name}.fast.json`, JSON.stringify(b.fastParts));
  console.log('recorded', name, b.errors.length ? 'errors: ' + b.errors.join(' | ') : '');
}

async function rect(b, x1, y1, x2, y2) {
  await b.shapeTool(0);
  const before = await b.uids();
  await b.dragCanvas(x1, y1, x2, y2);
  const [u] = await b.newUids(before);
  await b.deselect();
  return u;
}
async function replay(b, text) {
  await b.caption(text || 'Replaying the recorded script on a cleared board…');
  const lines = await b.script();
  await b.eval(() => clear());
  await wait(600);
  await b.play(lines);
  await b.caption('The replay ends exactly where the lesson did'); await wait(1200);
}
async function showTreeChildren(b, root) {
  await b.select(root);
  await b.page.waitForSelector('#tree-node-panel.visible');
  await b.caption('Tree panel: tick the children, then Show/Hide');
  for (const chk of await b.page.$$('#tree-children-list .tree-child-row input[type=checkbox]')) { await chk.check(); await wait(250); }
  await b.press('#tree-node-panel button:has-text("Show/Hide")');
}

const CLIPS = {
  async '01-mind-map'(b) {
    await b.title('Mind maps', 'trees, connectors, groups — and replay');
    await b.caption('Draw a shape with the rectangle tool');
    const root = await rect(b, 540, 110, 700, 180);
    await b.caption('Press T on it and type the branches: "Joy, Fear, Anger"');
    await b.select(root);
    b.promptAnswers.push('Joy, Fear, Anger');
    await b.key('t');
    const kids = await b.eval(r => findIfRequired(r).treeConnection.outgoing.lines.map(findIfRequired).map(l => l.customData.target), root);
    await showTreeChildren(b, root);
    await b.deselect();
    await b.caption('Drag the children out — lines follow and join the facing edges');
    const stack = await b.centerOf(kids[0]);
    for (const [dx, dy] of [[-280, 230], [0, 270], [280, 230]]) { await b.dragObject(null, dx, dy, stack); await b.deselect(); }
    await b.caption('Connector tool: click one shape, then another');
    const now = await b.eval(k => k.map(u => { const o = findIfRequired(u); o.setCoords(); const c = o.getCenterPoint(); return [u, c.x]; }).sort((p, q) => p[1] - q[1]).map(p => p[0]), kids);
    await b.tool('connector'); await wait(300);
    await b.select(now[0]); await b.select(now[2]);
    await b.key('Escape'); await b.eval(() => toolManager.activate('select')); await b.deselect();
    await b.caption('Shift-click two children, ⌘G to group them');
    await b.selectMany([now[0], now[2]]); await wait(400);
    await b.key(`${mod}+g`); await b.deselect();
    const [g] = await b.eval(() => pc.getObjects().filter(o => o.type === 'group' && o._objects.some(k => k.treeConnection)).map(o => o.uid));
    await b.caption('Move, scale and rotate the group — every line stays attached');
    await b.dragObject(null, 0, 110, await b.centerOf(now[0]));
    await b.select(g);
    await b.dragHandle('br', 30, 20);
    await b.dragHandle('mtr', 25, 0);
    await b.deselect(); await wait(800);
    await replay(b);
  },

  async '02-text'(b) {
    await b.title('Text', 'boxes that fit, multi-line text in shapes');
    await b.caption('Text tool: click, double-click, type — the box hugs its text');
    await b.textMenu('Text');
    let before = await b.uids();
    await b.click(200, 110);
    const [h] = await b.newUids(before);
    const [hx, hy] = await b.centerOf(h); const [sx, sy] = await b.screen(hx, hy);
    await b.page.mouse.dblclick(sx, sy); await wait(300);
    await b.page.keyboard.press(`${mod}+a`);
    await b.type('How feelings help us');
    await b.click(900, 650); await wait(600);
    await b.caption('Widen it by the side handle…');
    await b.select(h); await b.dragHandle('mr', 180, 0); await b.deselect();
    await b.caption('…and ⌘Z puts it back; ⌘⇧Z again');
    await b.key(`${mod}+z`); await wait(500); await b.key(`${mod}+Shift+z`); await wait(500); await b.key(`${mod}+z`);
    await b.caption('Text in a shape: Enter makes new lines, ⌘Enter adds it');
    await b.textMenu('Text in rectangle');
    await b.click(260, 280);
    await b.typeInPopup('Joy lifts us\nFear warns us\nSadness slows us');
    await b.textMenu('Text in circle');
    await b.click(620, 300);
    await b.typeInPopup('Anger\nprotects');
    await b.textMenu('Text in cloud');
    await b.click(900, 300);
    await b.typeInPopup('Calm');
    await b.deselect(); await wait(800);
    await replay(b);
  },

  async '03-html-box'(b) {
    await b.title('HTML boxes', 'rich text, CSS and a full editor');
    await b.caption('HTML box tool: click to place it, then type');
    await b.tool('htmlBox');
    const before = await b.uids();
    await b.click(160, 160);
    const [box] = await b.newUids(before);
    await b.page.waitForSelector('.html-box.editing');
    await b.page.keyboard.press(`${mod}+a`);
    await b.type('Breathe in slowly'); await b.page.keyboard.press('Enter'); await b.type('Hold, then breathe out');
    await b.caption('Bold and a bulleted list from the Properties panel');
    await b.page.keyboard.press(`${mod}+a`);
    await b.press('#prop-html-section button[title="Bold"]');
    await b.press('#prop-html-section button[title="Bulleted list"]');
    await b.page.keyboard.press('Escape'); await wait(900);
    await b.caption('Editor… opens it in CKEditor — Source takes HTML and CSS');
    await b.select(box);
    await b.press('#prop-html-source');
    await b.page.waitForFunction(() => _htmlBoxEditor && !_htmlBoxEditor.loading, null, { timeout: 30000 }); await wait(900);
    await b.press('#htmlBoxEditorDialog .cke_button__source');
    const ta = b.page.locator('#htmlBoxEditorDialog textarea.cke_source');
    await ta.fill('');
    await ta.focus();
    await b.page.keyboard.type('<div style="font:bold 54px Arial;color:#fff;text-shadow:0 1px 0 #ccc,0 2px 0 #c9c9c9,0 3px 0 #bbb,0 4px 0 #b9b9b9,0 5px 0 #aaa,0 6px 1px rgba(0,0,0,.1),0 5px 10px rgba(0,0,0,.25),0 10px 10px rgba(0,0,0,.2),0 20px 20px rgba(0,0,0,.15)">Feelings</div>', { delay: 8 });
    await ta.dispatchEvent('input');
    await b.caption('The box on the board follows as you type — Apply keeps it'); await wait(800);
    await b.press('#htmlBoxEditorDialog button:text-is("Apply")');
    await b.deselect(); await wait(1200);
    await b.caption('Shapes can sit on top of it; zooming in redraws it sharp');
    const cover = await rect(b, 380, 250, 520, 330);
    await b.select(cover); await b.page.locator('#prop-fill').fill('#ffcc80'); await b.page.locator('#prop-fill').dispatchEvent('change'); await b.deselect();
    await b.press('button[title="Zoom In"]'); await b.press('button[title="Zoom In"]'); await wait(1200);
    await b.eval(() => viewportManager.resetView()); await wait(600);
    await replay(b);
  },

  async '04-presenting'(b) {
    await b.title('Presenting', 'draw outline, reveal, spotlight');
    const cards = [];
    for (const x of [150, 420, 690]) cards.push(await rect(b, x, 180, x + 190, 290));
    await b.select(cards[1]); await b.page.locator('#prop-fill').fill('#90caf9'); await b.page.locator('#prop-fill').dispatchEvent('change'); await b.deselect();
    await b.textMenu('Text in rectangle'); await b.click(960, 200); await b.typeInPopup('Joy');
    await b.textMenu('Text in diamond'); await b.click(560, 420); await b.typeInPopup('Decide');
    await b.caption('Select them, Animate → Draw outline, Start: edges are traced like a pen');
    await b.dragCanvas(120, 150, 1180, 520);
    await b.page.selectOption('#prop-anim-type', 'drawOutline'); await wait(400);
    await b.press('#prop-anim-toggle'); await wait(2400);
    await b.caption('Reveal wipes objects into view from a side');
    await b.dragCanvas(120, 150, 1180, 320);
    await b.page.selectOption('#prop-anim-type', 'reveal:left'); await wait(400);
    await b.press('#prop-anim-toggle'); await wait(1500);
    await b.caption('Zoom in, then spotlight one card; Esc ends it');
    await b.press('button[title="Zoom In"]');
    await b.select(cards[1]);
    await b.page.selectOption('#prop-anim-type', 'spotlight:circle'); await wait(300);
    await b.press('#prop-anim-toggle'); await wait(2200);
    await b.key('Escape'); await b.deselect();
    await b.eval(() => viewportManager.resetView()); await wait(500);
    await replay(b, 'Replaying — each animation waits before the next line');
  },

  async '05-editing'(b) {
    await b.title('Editing and undo', 'every undo and redo is part of the recording');
    const a = await rect(b, 150, 150, 290, 230);
    const c = await rect(b, 480, 150, 620, 230);
    await b.tool('connector'); await wait(300); await b.select(a); await b.select(c);
    await b.key('Escape'); await b.eval(() => toolManager.activate('select')); await b.deselect();
    await b.caption('Right-click → Delete: the shape goes with its line');
    await b.select(a); await b.contextMenu(a, 'Delete'); await wait(700);
    await b.caption('⌘Z: both come back, and the line still follows');
    await b.key(`${mod}+z`); await b.deselect();
    await b.dragObject(a, 0, 160); await b.deselect();
    await b.caption('The Delete key can be undone too');
    await b.select(c); await b.key('Delete'); await wait(500); await b.key(`${mod}+z`); await b.deselect();
    await b.caption('Drag around the pair, ⌘C, ⌘V: the copies come connected');
    await b.dragCanvas(120, 120, 660, 420);
    await b.key(`${mod}+c`); await b.key(`${mod}+v`); await b.deselect();
    await b.caption('Right-click → Duplicate works the same way');
    await b.dragCanvas(120, 120, 680, 440);
    await b.contextMenu(c, 'Duplicate'); await b.deselect();
    await b.caption('Undo a move: it goes back, lines and all');
    await b.dragObject(null, 250, 60, await b.centerOf(c)); await b.deselect(); await wait(500); await b.key(`${mod}+z`);
    await replay(b, 'Replaying — undo and redo replay as they happened');
  },

  async '06-arranging'(b) {
    await b.title('Arranging', 'snap to align, resize and turn several at once');
    const a = await rect(b, 150, 150, 290, 230);
    const c = await rect(b, 430, 320, 560, 400);
    await b.caption('Drag near another shape: guides appear and it snaps level');
    const [al] = await b.eval(u => { const o = findIfRequired(u); o.setCoords(); return [o.getBoundingRect().left]; }, a);
    const [cl] = await b.eval(u => { const o = findIfRequired(u); o.setCoords(); return [o.getBoundingRect().left]; }, c);
    await b.dragObject(null, al + 3 - cl, 0, await b.centerOf(c)); await b.deselect();
    await b.caption('Select both: pull a corner, then turn them');
    await b.selectMany([a, c]);
    await b.dragHandle('br', 90, 60);
    await b.dragHandle('mtr', 70, 0);
    await b.caption('⌘Z undoes the turn, then the resize');
    await b.key(`${mod}+z`); await wait(400); await b.key(`${mod}+z`); await b.deselect();
    await b.caption('Keys typed in a panel field stay text (no shortcuts fire)');
    await b.select(a);
    await b.press('#prop-media-url');
    await b.type('https://thesite.org/video'); await wait(600);
    await b.page.keyboard.press('Backspace'); await wait(600);
    await b.deselect();
    await replay(b);
  },

  async '07-scripts'(b) {
    await b.title('Scripts', 'see, edit, share — and every function explained');
    await b.eval(() => { playScript(window.recordedScriptLines = [
      'addRect(120,120,160,80,{"uid":"R1","fill":"#90caf9","stroke":"#1565c0","strokeWidth":3})',
      'drawOutline(["R1"], {"duration":1000})',
      'addEllipse(420,120,70,45,{"uid":"E1","fill":"#ffcc80","stroke":"#e65100","strokeWidth":3})',
      'connectObjects("R1", "E1", {"animate": true})'
    ]); });
    await b.page.waitForFunction(() => !window.isRecordingPlayback, null, { timeout: 60000 }); await wait(600);
    await b.caption('Script editor: the recorded lines, editable');
    await b.press('.wb-tool[title^="Script editor"]'); await wait(1200);
    await b.caption('? Functions: every function with its options — filter by a word');
    await b.press('#scriptViewerDialog button[onclick="toggleScriptHelp()"]');
    await b.press('#scriptHelpFilter');
    await b.type('outline'); await wait(1800);
    await b.page.fill('#scriptHelpFilter', ''); await b.type('tree'); await wait(1800);
    await b.page.evaluate(() => toggleScriptHelp(false)); await wait(300);
    await b.caption('Import a lesson file: here, one with nested groups');
    await b.eval(() => { clear(); window.recordedScriptLines = []; });
    await b.press('#scriptViewerDialog button:text-is("Import")');
    await b.page.setInputFiles('#importInputFile', fixture('nested-groups.txt'));
    await b.press('#importDialog button:has-text("OK")');
    await b.page.click('#scriptViewerDialog button[onclick="closeScriptDialog()"]');
    b.fast(true); // 133 lines at a second each: shown at 4x
    await b.page.waitForFunction(() => !window.isRecordingPlayback, null, { timeout: 400000, polling: 500 }); await wait(800);
    b.fast(false);
    await b.caption('Every line stays attached as groups are dragged');
    await b.dragObject(null, 120, 60, await b.centerOf('G3')); await b.deselect();
    await b.dragObject(null, -100, 80, await b.centerOf('G4')); await b.deselect(); await wait(800);
  }
};

// webm -> mp4 per clip (marked stretches at 4x), then all clips joined.
function encode(names) {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.log('ffmpeg not found: kept the .webm files'); return; }
  const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30', '-an'];
  const run = a => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };
  fs.mkdirSync(`${OUT}/mp4`, { recursive: true });
  names.forEach(n => {
    const fast = JSON.parse(fs.readFileSync(`${OUT}/raw/${n}.fast.json`, 'utf8'));
    if (!fast.length) return run(['-i', `${OUT}/raw/${n}.webm`, ...enc, `${OUT}/mp4/${n}.mp4`]);
    const parts = []; let at = 0, filters = '';
    fast.forEach(([a, b]) => { parts.push([at, a, 1], [a, b, 4]); at = b; });
    parts.push([at, null, 1]);
    parts.forEach(([a, b, speed], i) => {
      filters += `[0:v]trim=${a}${b == null ? '' : ':' + b},setpts=(PTS-STARTPTS)/${speed}[p${i}];`;
    });
    filters += parts.map((_, i) => `[p${i}]`).join('') + `concat=n=${parts.length}:v=1:a=0[v]`;
    run(['-i', `${OUT}/raw/${n}.webm`, '-filter_complex', filters, '-map', '[v]', ...enc, `${OUT}/mp4/${n}.mp4`]);
  });
  const all = Object.keys(CLIPS).filter(n => fs.existsSync(`${OUT}/mp4/${n}.mp4`));
  fs.writeFileSync(`${OUT}/list.txt`, all.map(n => `file '${OUT}/mp4/${n}.mp4'`).join('\n'));
  run(['-f', 'concat', '-safe', '0', '-i', `${OUT}/list.txt`, '-c', 'copy', `${OUT}/whiteboard-features.mp4`]);
  console.log(`videos in ${OUT}/mp4, all together in ${OUT}/whiteboard-features.mp4`);
}

const names = args.length ? args : Object.keys(CLIPS);
const unknown = names.filter(n => !CLIPS[n]);
if (unknown.length) { console.error(`unknown clip(s): ${unknown.join(', ')}; clips: ${Object.keys(CLIPS).join(', ')}`); process.exit(1); }
fs.mkdirSync(OUT + '/raw', { recursive: true });
http = await serveStatic(path.join(ROOT, 'public'));
browser = await chromium.launch({ headless: true });
for (const n of names) await clip(n, CLIPS[n]);
await browser.close(); http.server.close();
if (MP4) encode(names);
