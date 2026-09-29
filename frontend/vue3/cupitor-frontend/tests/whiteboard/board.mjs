// Drives play.html the way a person does: toolbar, mouse, keyboard, menus.
// Each scenario gets a fresh page; a fresh page is also used to replay what
// was recorded, so "replay matches" compares two independent runs.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { serveStatic } from '../../tools/play-mcp/page-driver.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
// WB_PUBLIC_DIR=dist runs the scenarios against a production build.
export const PUBLIC_DIR = path.resolve(process.env.WB_PUBLIC_DIR || path.resolve(here, '../../public'));
export const fixture = name => path.join(here, 'fixtures', name);

let shared = null;
// One browser and file server per test file.
export async function startBrowser() {
  if (!shared) {
    const http = await serveStatic(PUBLIC_DIR);
    const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
    shared = { http, browser };
  }
  return shared;
}
export async function stopBrowser() {
  if (!shared) return;
  await shared.browser.close();
  shared.http.server.close();
  shared = null;
}

export async function openBoard() {
  const { http, browser } = await startBrowser();
  const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
  const board = new Board(page);
  await page.goto(`${http.url}/play.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.pc && window.playScript && window.undoManager, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  return board;
}

export class Board {
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.promptAnswers = [];
    page.on('pageerror', e => this.errors.push(e.message));
    // The player catches a failing line and only logs it.
    page.on('console', m => { if (m.type() === 'error' && /^Script line \d+ failed/.test(m.text())) this.errors.push(m.text()); });
    // Browser prompts (e.g. the tree command after pressing t) get the next queued answer.
    page.on('dialog', d => (d.type() === 'prompt' && this.promptAnswers.length ? d.accept(this.promptAnswers.shift()) : d.accept()).catch(() => {}));
  }

  close() { return this.page.close(); }
  eval(fn, arg) { return this.page.evaluate(fn, arg); }

  // Screen position of a canvas point.
  async screen(x, y) {
    return this.eval(([x, y]) => {
      const r = pc.upperCanvasEl.getBoundingClientRect(), v = pc.viewportTransform;
      return [r.left + x * v[0] + v[4], r.top + y * v[3] + v[5]];
    }, [x, y]);
  }

  async centerOf(uid) {
    return this.eval(u => { const o = findIfRequired(u); o.setCoords(); const c = o.getCenterPoint(); return [c.x, c.y]; }, uid);
  }

  async click(x, y, opts) { const [sx, sy] = await this.screen(x, y); await this.page.mouse.click(sx, sy, opts); await this.page.waitForTimeout(120); }

  async dragCanvas(x1, y1, x2, y2) {
    const [a, b] = await this.screen(x1, y1), [c, d] = await this.screen(x2, y2);
    await this.page.mouse.move(a, b); await this.page.mouse.down();
    await this.page.mouse.move((a + c) / 2, (b + d) / 2, { steps: 6 });
    await this.page.mouse.move(c, d, { steps: 6 }); await this.page.mouse.up();
    await this.page.waitForTimeout(150);
  }

  // Drags an object by its centre (or by `at`, a canvas point on it); with a
  // uid, checks that object is the one that moved.
  async dragObject(uid, dx, dy, at) {
    const from = uid && await this.centerOf(uid);
    const [x, y] = at || from;
    await this.dragCanvas(x, y, x + dx, y + dy);
    if (uid) {
      const [nx, ny] = await this.centerOf(uid);
      assert.ok(Math.abs(nx - from[0] - dx) < 3 && Math.abs(ny - from[1] - dy) < 3, `${uid} moved by ${[nx - from[0], ny - from[1]].map(Math.round)}, not ${[dx, dy]}`);
    }
  }

  // Drags a control handle ('br', 'mr', 'mtr', ...) of the current selection.
  async dragHandle(key, dx, dy) {
    const [x, y] = await this.eval(k => { const o = pc.getActiveObject(); o.setCoords(); const r = pc.upperCanvasEl.getBoundingClientRect(); return [r.left + o.oCoords[k].x, r.top + o.oCoords[k].y]; }, key);
    await this.page.mouse.move(x, y); await this.page.mouse.down();
    await this.page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 });
    await this.page.mouse.move(x + dx, y + dy, { steps: 6 }); await this.page.mouse.up();
    await this.page.waitForTimeout(150);
  }

  async select(uid) { const [x, y] = await this.centerOf(uid); await this.click(x, y); }
  async selectMany(uids) {
    for (let i = 0; i < uids.length; i++) {
      const [x, y] = await this.centerOf(uids[i]);
      const [sx, sy] = await this.screen(x, y);
      if (i) await this.page.keyboard.down('Shift');
      await this.page.mouse.click(sx, sy);
      if (i) await this.page.keyboard.up('Shift');
    }
    await this.page.waitForTimeout(120);
  }
  async deselect() { await this.eval(() => { pc.discardActiveObject(); pc.requestRenderAll(); }); }

  async tool(name) { await this.page.click(`.wb-tool[data-tool="${name}"]`); }
  async shapeTool(index) { await this.page.click('.wb-tool[data-tool="shape"]'); await this.page.click(`#shape-menu button >> nth=${index}`); }
  async textMenu(label) {
    await this.page.click('.wb-tool[data-tool="text"]');
    await this.page.locator('#text-menu button').filter({ hasText: new RegExp(`(^|\\s)${label}\\s*$`) }).click();
  }

  async contextMenu(uid, item) {
    const [x, y] = await this.centerOf(uid); const [sx, sy] = await this.screen(x, y);
    await this.page.mouse.click(sx, sy, { button: 'right' });
    await this.page.click(`#wb-context-menu .ctx-item:has-text("${item}")`);
    await this.page.waitForTimeout(200);
  }

  // Types into the multi-line text popup and confirms with Ctrl/Cmd+Enter.
  async typeInPopup(text) {
    await this.page.waitForSelector('#askTextPopup textarea');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i) await this.page.keyboard.press('Enter');
      await this.page.keyboard.type(lines[i]);
    }
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    await this.page.waitForTimeout(200);
  }

  async key(k) { await this.page.keyboard.press(k); await this.page.waitForTimeout(150); }

  // uids added since `before` (a Set of uids).
  async newUids(before) { return this.eval(b => pc.getObjects().map(o => o.uid).filter(u => !b.includes(u)), [...before]); }
  async uids() { return new Set(await this.eval(() => pc.getObjects().map(o => o.uid))); }

  async script() { return this.eval(() => recordedScriptLines.slice()); }

  // Plays lines in the page's own player and waits for the end.
  async play(lines) {
    await this.eval(l => { if (l) window.recordedScriptLines = l; playScript(); }, lines || null);
    await this.page.waitForFunction(() => !document.body.classList.contains('play-mode') && !window.isRecordingPlayback,
      null, { timeout: 300000, polling: 250 });
    await this.page.waitForTimeout(300);
  }

  // Everything a viewer would notice about each object, rounded to 1 px:
  // kind, depth in groups, stacking position, visibility, box, angle, fill, a running clip, text.
  async snapshot() {
    return this.eval(() => {
      const r = Math.round, out = [];
      const walk = (objs, depth) => objs.forEach((o, z) => {
        o.setCoords();
        const b = o.getBoundingRect(), cd = o.customData || {};
        const item = [o.uid, o.type, depth, o.visible !== false, r(b.left), r(b.top), r(b.width), r(b.height), r(o.angle || 0),
          z, typeof o.fill === 'string' ? new fabric.Color(o.fill).toHexa() : '', !!o.clipPath, r(o.opacity == null ? 1 : o.opacity)];
        if (typeof o.text === 'string') item.push(o.text);
        if (typeof cd.html === 'string') item.push(cd.html);
        if (o._objects) walk(o._objects, depth + 1);
        out.push(item);
      });
      walk(pc.getObjects(), 0);
      return out;
    });
  }

  // Worst distance (px) between a tree/connector line end and the object it
  // belongs to, per line; 0 means touching.
  async lineGaps() {
    return this.eval(() => {
      const gap = (p, r) => Math.hypot(Math.max(r.left - p.x, 0, p.x - r.left - r.width), Math.max(r.top - p.y, 0, p.y - r.top - r.height));
      const out = {};
      pc.getObjects().filter(o => o instanceof fabric.Line && o.customData && o.customData.target && o.visible !== false).forEach(l => {
        const s = findIfRequired(l.customData.source), t = findIfRequired(l.customData.target);
        if (!isFabricObject(s) || !isFabricObject(t)) { out[l.uid] = 'missing end'; return; }
        const m = l.calcTransformMatrix(), q = l.calcLinePoints();
        const a = fabric.util.transformPoint(new fabric.Point(q.x1, q.y1), m), z = fabric.util.transformPoint(new fabric.Point(q.x2, q.y2), m);
        const [ps, pt] = l.customData.direction === 'in' ? [z, a] : [a, z];
        s.setCoords(); t.setCoords();
        out[l.uid] = Math.round(Math.max(gap(ps, s.getBoundingRect()), gap(pt, t.getBoundingRect())));
      });
      return out;
    });
  }
}

// Lines further than `tolerance` px from their objects.
export function detached(gaps, tolerance = 2) {
  return Object.fromEntries(Object.entries(gaps).filter(([, g]) => g === 'missing end' || g > tolerance));
}

// Replays `lines` in a fresh page and returns its snapshot; `then(board)`
// can go on using the replayed board before it closes.
export async function replayElsewhere(lines, then) {
  const b = await openBoard();
  try {
    await b.play(lines);
    const result = { snapshot: await b.snapshot(), gaps: await b.lineGaps(), errors: b.errors };
    if (then) await then(b);
    return result;
  } finally { await b.close(); }
}

// Same objects in the same stacking order, visibility, fill and text; boxes within `tol` px.
export function assertSameScene(got, want, tol) {
  const key = s => new Map(s.map(i => [i[0], i]));
  const g = key(got), w = key(want);
  assert.deepEqual([...g.keys()].sort(), [...w.keys()].sort(), 'same objects');
  for (const [uid, wi] of w) {
    const gi = g.get(uid);
    assert.deepEqual([gi[1], gi[2], gi[3], ...gi.slice(9)], [wi[1], wi[2], wi[3], ...wi.slice(9)], `${uid} kind/visibility/text`);
    for (let k = 4; k < 9; k++) assert.ok(Math.abs(gi[k] - wi[k]) <= tol, `${uid} box ${gi.slice(4, 9)} vs ${wi.slice(4, 9)}`);
  }
}
