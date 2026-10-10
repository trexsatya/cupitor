// Drives play.html in a Chromium window: serves public/ locally, runs script
// lines through the page's own player (so they are recorded like hand-made
// ones), and reads back objects and screenshots.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright comes from the web app's own dependencies.
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.ico': 'image/x-icon', '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

// Serves `root` on 127.0.0.1 at a free port; resolves to the base URL.
export function serveStatic(root) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(root, urlPath);
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      const target = !err && st.isDirectory() ? path.join(file, 'index.html') : file;
      fs.readFile(target, (err2, data) => {
        if (err2) { res.writeHead(404).end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
  }));
}

// Waits until done() holds in the page. Time spent with playback paused (on
// the page, by a person) does not count against timeoutMs: a paused film
// waits as long as it stays paused.
async function untilDone(page, done, timeoutMs, polling) {
  let left = timeoutMs;
  for (;;) {
    const started = Date.now();
    const why = await page.waitForFunction(fn => (new Function(`return (${fn})()`))() ? 'done' : window._playPaused ? 'paused' : false,
      String(done), { timeout: Math.max(1, left), polling });
    if ((await why.jsonValue()) === 'done') return;
    left -= Date.now() - started;
    await page.waitForFunction(() => !window._playPaused, null, { timeout: 0, polling: 250 });
  }
}

export class PlayPage {
  constructor({ publicDir, headless = false }) {
    this.publicDir = path.resolve(publicDir);
    this.headless = headless;
    this.page = null;
    this._queue = Promise.resolve();
    // walk() looks at the page between steps of its own queued turn.
    this._unqueued = { screenshot: this.screenshot.bind(this), objects: this.objects.bind(this) };
    // One page is shared by every client and request, so its operations run
    // one at a time, in the order they were asked for.
    for (const name of ['reset', 'play', 'script', 'setScript', 'objects', 'screenshot', 'evaluate', 'measure', 'walk']) {
      const fn = this[name].bind(this);
      this[name] = (...args) => {
        const run = this._queue.then(() => fn(...args));
        this._queue = run.catch(() => {});
        return run;
      };
    }
  }

  // Runs `fn(arg)` in the page (e.g. to read something the tools don't cover).
  async evaluate(fn, arg) {
    const page = await this.open();
    return page.evaluate(fn, arg);
  }

  async open() {
    if (this.page && !this.page.isClosed()) return this.page;
    if (!this.http) this.http = await serveStatic(this.publicDir);
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: this.headless });
    }
    this.page = await this.browser.newPage({ viewport: { width: 1400, height: 850 } });
    this.page.on('dialog', d => d.accept().catch(() => {}));
    this.pageErrors = [];
    this.page.on('pageerror', e => this.pageErrors.push(e.message));
    await this.page.goto(`${this.http.url}/play.html`, { waitUntil: 'load', timeout: 60000 });
    await this.page.waitForFunction(() => window.pc && window.playScript && window.recordedScriptLines !== undefined, null, { timeout: 60000 });
    // Collect the player's per-line failures (it reports them through showPlayLine).
    await this.page.evaluate(() => {
      window.__mcpLineErrors = [];
      const show = window.showPlayLine;
      window.showPlayLine = function (n, total, err) {
        if (err) window.__mcpLineErrors.push({ line: n, message: String(err) });
        return show && show.apply(this, arguments);
      };
    });
    return this.page;
  }

  async reset() {
    if (this.page && !this.page.isClosed()) await this.page.close();
    this.page = null;
    return this.open();
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    if (this.http) this.http.server.close();
    this.browser = null; this.http = null; this.page = null;
  }

  // Plays `lines` (or the whole recorded script with `lines` null) and waits
  // until playback ends. With `record`, new lines are added to the recorded
  // script first. Returns the failures, numbered within what was played.
  // Narrated scenes run for minutes, so the wait is long.
  async play(lines, { record = true, clearFirst = false, timeoutMs = 20 * 60000 } = {}) {
    const page = await this.open();
    const errorsBefore = this.pageErrors.length;
    const started = Date.now();
    await page.evaluate(({ lines, record, clearFirst }) => {
      window.__mcpLineErrors = [];
      if (clearFirst && typeof clear === 'function') clear();
      if (clearFirst && window.viewportManager) viewportManager.resetView(); // a replay starts from the starting view
      if (lines && record) window.recordedScriptLines = (window.recordedScriptLines || []).concat(lines);
      playScript(lines || undefined);
    }, { lines, record, clearFirst });
    await untilDone(page, () => !document.body.classList.contains('play-mode') && !window.isRecordingPlayback, timeoutMs, 100);
    const lineErrors = await page.evaluate(() => window.__mcpLineErrors.slice());
    return {
      // Lines that ran: comments and blank lines don't count.
      played: await page.evaluate(l => scriptCommentLines(l || window.recordedScriptLines).filter(c => !c).length, lines),
      ms: Date.now() - started,
      lineErrors,
      pageErrors: this.pageErrors.slice(errorsBefore)
    };
  }

  // Plays `lines` once from a cleared canvas without recording them, stopping
  // before each line index in `stops` (and at the end, as stop stops.length)
  // to await onStop(k, {screenshot, objects}). With `fast`, waits and
  // animations take next to no time: only the states between them matter.
  async walk(lines, stops, onStop, { fast = true, timeoutMs = 10 * 60000 } = {}) {
    const page = await this.open();
    const marks = stops.map((index, k) => ({ index, k })).concat([{ index: lines.length, k: stops.length }]);
    const run = lines.slice();
    // Inserted from the end so earlier indexes stay right; same index keeps order.
    [...marks].sort((a, b) => b.index - a.index || b.k - a.k).forEach(m => run.splice(m.index, 0, `Promise.resolve(__mcpHold(${m.k}))`));
    // The script's own line number for each played line (0 for an inserted hold).
    const own = []; let n = 0;
    run.forEach(l => own.push(/^Promise\.resolve\(__mcpHold\(\d+\)\)$/.test(l) ? 0 : ++n));
    const deadline = Date.now() + timeoutMs;
    let finished = false;
    try {
    await page.evaluate(({ run, fast }) => {
      window.__mcpLineErrors = [];
      window.__mcpHeld = null;
      window.__mcpHold = k => new Promise(release => { window.__mcpHeld = { k, release }; });
      window.__mcpRestore = [];
      if (fast) {
        const swap = (name, fn) => { const orig = window[name]; if (typeof orig !== 'function') return; window.__mcpRestore.push([name, orig]); window[name] = fn(orig); };
        swap('sleep', () => () => Promise.resolve());
        // [function, index of its options argument]
        [['animate', 2], ['drawOutline', 1], ['connectObjects', 3], ['animateViewport', 1], ['revertState', 1], ['reveal', 2], ['typeIn', 1], ['writeIn', 1], ['emanate', 3], ['markStep', 2], ['setPictureSource', 2]].forEach(([name, at]) =>
          swap(name, orig => function (...args) { args[at] = Object.assign({}, args[at], { duration: 1 }); return orig.apply(this, args); }));
      }
      if (typeof clear === 'function') clear();
      if (window.viewportManager) viewportManager.resetView(); // from the starting view, as a replay is
      playScript(run);
    }, { run, fast });
      for (;;) {
        await untilDone(page, () => window.__mcpHeld || (!document.body.classList.contains('play-mode') && !window.isRecordingPlayback),
          Math.max(1, deadline - Date.now()), 50);
        const held = await page.evaluate(() => window.__mcpHeld && window.__mcpHeld.k);
        if (held == null) break;
        await page.waitForTimeout(250); // a caption fading in, an HTML box's picture
        await onStop(held, this._unqueued);
        await page.evaluate(() => { const h = window.__mcpHeld; window.__mcpHeld = null; h.release(); });
      }
      finished = true;
    } finally {
      // Whatever happened, the page gets its own functions back, and a walk
      // cut short stops playing instead of waiting on a hold for ever.
      await page.evaluate(stop => {
        (window.__mcpRestore || []).forEach(([name, orig]) => { window[name] = orig; });
        window.__mcpRestore = [];
        if (stop) {
          window._stopPlayback = true;
          const h = window.__mcpHeld; window.__mcpHeld = null;
          if (h) h.release();
          if (window.exitPlayMode) exitPlayMode();
          window.isRecordingPlayback = false;
        }
      }, !finished).catch(() => {});
    }
    const errors = await page.evaluate(() => window.__mcpLineErrors.slice());
    return { lineErrors: errors.map(e => ({ ...e, line: own[e.line - 1] || e.line })) };
  }

  async script() {
    const page = await this.open();
    return page.evaluate(() => (window.recordedScriptLines || []).slice());
  }

  async setScript(lines) {
    const page = await this.open();
    await page.evaluate(l => { window.recordedScriptLines = l.slice(); }, lines);
  }

  // Objects on the main canvas (and inside groups), with where they are.
  async objects(uid) {
    const page = await this.open();
    return page.evaluate(only => {
      const r = n => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);
      const textOf = o => {
        if (typeof o.text === 'string') return o.text;
        const cd = o.customData || {};
        if (typeof cd.html === 'string') { const d = document.createElement('div'); d.innerHTML = cd.html; return d.textContent; }
        if (typeof cd.text === 'string') return cd.text;
        const inner = o._objects && o._objects.find(k => typeof k.text === 'string');
        return inner ? inner.text : undefined;
      };
      const out = [];
      const walk = (objs, parent) => objs.forEach(o => {
        o.setCoords();
        const b = o.getBoundingRect(), cd = o.customData || {}, tc = o.treeConnection || {};
        const item = {
          uid: o.uid, type: o.type, kind: cd.type, parent,
          box: { left: r(b.left), top: r(b.top), width: r(b.width), height: r(b.height) },
          angle: r(o.angle), visible: o.visible !== false, opacity: r(o.opacity),
          fill: typeof o.fill === 'string' ? o.fill : undefined, stroke: o.stroke || undefined
        };
        const text = textOf(o);
        if (text) item.text = text.length > 120 ? text.slice(0, 120) + '…' : text;
        if (o instanceof fabric.Line || (typeof o.rebuild === 'function' && o.x1 != null)) item.ends = [o.x1, o.y1, o.x2, o.y2].map(r);
        if (typeof o.rebuild === 'function' && o.cx != null) item.bend = [o.cx, o.cy].map(r);
        if (cd.source || cd.target) Object.assign(item, { source: cd.source, target: cd.target });
        const kids = (tc.outgoing && tc.outgoing.lines || []).map(l => (typeof l === 'object' ? l : findIfRequired(l)))
          .filter(isFabricObject).map(l => l.customData && l.customData.target);
        if (kids.length) item.treeChildren = kids;
        if (cd.connectorsOut || cd.connectorsIn) item.connectors = [...(cd.connectorsOut || []), ...(cd.connectorsIn || [])];
        if (o._objects && o.type !== 'activeselection') item.items = o._objects.map(k => k.uid);
        if (!only || o.uid === only) out.push(item);
        if (o._objects) walk(o._objects, o.uid);
      });
      walk(pc.getObjects(), undefined);
      return out;
    }, uid || null);
  }

  // Sizes [width, height] of objects as the page would build them (labels,
  // figures, pictures, step lists), without adding them: [{kind, text, fontSize, boundary, src, width, items, direction, gap}].
  // A step list's has two more numbers: where its first bullet sits from its centre.
  async measure(specs) {
    const page = await this.open();
    return page.evaluate(async list => Promise.all(list.map(async s => {
      if (s.kind === 'steps') {
        // Also where its first bullet sits from its centre.
        const g = makeStepList('__measure', s.items, 0, 0, { group: true, direction: s.direction, fontSize: s.fontSize, gap: s.gap });
        const c = g.getCenterPoint();
        return [Math.round(g.width), Math.round(g.height), Math.round(-c.x), Math.round(-c.y)];
      }
      const o = s.kind === 'figure' ? makeFigure(0, 0, { uid: '__measure', label: s.text, fontSize: s.fontSize, boundary: s.boundary })
        : s.kind === 'picture' ? await makePicture(s.src, 0, 0, { uid: '__measure', label: s.text, width: s.width, fontSize: s.fontSize })
        : (s.hand && await handFont(), makeLabel(s.text, 0, 0, { uid: '__measure', fontSize: s.fontSize, boundary: s.boundary, hand: s.hand }));
      return [Math.round(o.width), Math.round(o.height)];
    })), specs);
  }

  // PNG of the canvas, or of one object with some margin around it.
  async screenshot(uid, margin = 30) {
    const page = await this.open();
    const clip = await page.evaluate(({ uid, margin }) => {
      pc.discardActiveObject();
      pc.renderAll();
      const el = pc.upperCanvasEl.getBoundingClientRect();
      if (!uid) return { x: el.left, y: el.top, width: el.width, height: el.height };
      const o = findIfRequired(uid);
      if (!isFabricObject(o)) return null;
      o.setCoords();
      const b = o.getBoundingRect(), v = pc.viewportTransform;
      const x = el.left + b.left * v[0] + v[4] - margin, y = el.top + b.top * v[3] + v[5] - margin;
      const clamp = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
      if (x + b.width * v[0] + 2 * margin < 0 || y + b.height * v[3] + 2 * margin < 0 || x > innerWidth || y > innerHeight) return 'offscreen';
      const x0 = clamp(x, 0, innerWidth - 1), y0 = clamp(y, 0, innerHeight - 1);
      return { x: x0, y: y0, width: clamp(x + b.width * v[0] + 2 * margin, x0 + 1, innerWidth) - x0, height: clamp(y + b.height * v[3] + 2 * margin, y0 + 1, innerHeight) - y0 };
    }, { uid, margin });
    if (!clip) throw new Error(`No object with uid ${uid}`);
    if (clip === 'offscreen') throw new Error(`${uid} is outside the visible canvas; move it or take a screenshot of the whole canvas`);
    await page.waitForTimeout(150); // let a new HTML-box picture land
    return page.screenshot({ clip });
  }
}

// Script files: plain text, one line per script line (what the script
// editor shows), or an Export (JSON list of "() => { line }").
export function parseScriptFile(text) {
  let list = null;
  try { list = JSON.parse(text); } catch (e) { /* plain text */ }
  // Lines as written: indentation and blank lines kept (comments and blank
  // lines are skipped when playing), blank lines at the end dropped.
  const trimEnd = ls => { while (ls.length && !ls[ls.length - 1].trim()) ls.pop(); return ls; };
  if (!Array.isArray(list)) return trimEnd(text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')));
  return trimEnd(list.filter(l => typeof l === 'string').map(l => {
    const body = l.trim().match(/^\(\)\s*=>\s*\{ ?([\s\S]*?)\s*\}$/);
    if (!body) return l.trim();
    const ret = body[1].match(/^return\s+([\s\S]*?);?$/);
    return ret ? ret[1] : body[1];
  }));
}
