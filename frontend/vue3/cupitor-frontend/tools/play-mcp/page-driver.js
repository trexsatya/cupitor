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

export class PlayPage {
  constructor({ publicDir, headless = false }) {
    this.publicDir = path.resolve(publicDir);
    this.headless = headless;
    this.page = null;
    this._queue = Promise.resolve();
    // One page is shared by every client and request, so its operations run
    // one at a time, in the order they were asked for.
    for (const name of ['reset', 'play', 'script', 'setScript', 'objects', 'screenshot', 'evaluate', 'measure']) {
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
  async play(lines, { record = true, clearFirst = false, timeoutMs = 120000 } = {}) {
    const page = await this.open();
    const errorsBefore = this.pageErrors.length;
    const started = Date.now();
    await page.evaluate(({ lines, record, clearFirst }) => {
      window.__mcpLineErrors = [];
      if (clearFirst && typeof clear === 'function') clear();
      if (lines && record) window.recordedScriptLines = (window.recordedScriptLines || []).concat(lines);
      playScript(lines || undefined);
    }, { lines, record, clearFirst });
    await page.waitForFunction(() => !document.body.classList.contains('play-mode') && !window.isRecordingPlayback,
      null, { timeout: timeoutMs, polling: 100 });
    const lineErrors = await page.evaluate(() => window.__mcpLineErrors.slice());
    return {
      // Lines that ran: comments and blank lines don't count.
      played: await page.evaluate(l => scriptCommentLines(l || window.recordedScriptLines).filter(c => !c).length, lines),
      ms: Date.now() - started,
      lineErrors,
      pageErrors: this.pageErrors.slice(errorsBefore)
    };
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
        if (o instanceof fabric.Line) item.ends = [o.x1, o.y1, o.x2, o.y2].map(r);
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
  // figures, pictures), without adding them: [{kind, text, fontSize, boundary, src, width}].
  async measure(specs) {
    const page = await this.open();
    return page.evaluate(async list => Promise.all(list.map(async s => {
      const o = s.kind === 'figure' ? makeFigure(0, 0, { uid: '__measure', label: s.text, fontSize: s.fontSize })
        : s.kind === 'picture' ? await makePicture(s.src, 0, 0, { uid: '__measure', label: s.text, width: s.width, fontSize: s.fontSize })
        : makeLabel(s.text, 0, 0, { uid: '__measure', fontSize: s.fontSize, boundary: s.boundary });
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
