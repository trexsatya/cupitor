// public/play-recorder.js
// Records a playback session: an export canvas composed every frame from the
// scene canvases, DOM layers a `rasterize` hook can draw, the caption and
// `exportFrame` hooks, plus the narration through Web Audio, with MediaRecorder.
// See reusable_animation_runtime_handoff.md, sections 6–7.
//
// Composition: `scene` is a region of the preview canvas in its CSS pixels
// (default: the whole canvas as it is when recording starts, so resizing the
// browser changes later recordings, not one in progress). It is fitted, centred
// and scaled, into the output above a caption band. The camera is recorded as
// it is previewed, because the canvases are copied as drawn.
//
// env (default: the page's globals): document, MediaRecorder, MediaStream,
// AudioContext (or env.audioContext, owned by the application), createCanvas(w, h).

const MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const VIDEO_ONLY = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export const RECORD_DEFAULTS = {
  width: 1920, height: 1080, fps: 30,
  background: '#ffffff',
  captions: true,          // false: no captions in the film
  captionBand: 0.12,       // share of the height kept for captions under the scene; 0 draws them over it
  captionFont: 'system-ui, sans-serif',
  captionSize: 0.034,      // share of the height
  audio: true,
  monitor: true,           // the narration is heard while recording
  scene: null,             // {x, y, width, height} of the preview canvas, CSS pixels
  domLayers: ['#textillateContainer > *'],
  filename: 'animation.webm'
};

export function pickMimeType(MR, withAudio) {
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  return (withAudio ? MIME_TYPES : VIDEO_ONLY).find(t => MR.isTypeSupported(t)) || '';
}

// The scene region fitted into the output, and where the caption goes.
export function exportLayout(o, sceneRect) {
  const band = o.captions ? Math.round(o.height * (o.captionBand || 0)) : 0;
  const area = { x: 0, y: 0, width: o.width, height: o.height - band };
  const k = Math.min(area.width / sceneRect.width, area.height / sceneRect.height);
  const w = sceneRect.width * k, h = sceneRect.height * k;
  const dest = { x: Math.round((area.width - w) / 2), y: Math.round((area.height - h) / 2), width: Math.round(w), height: Math.round(h) };
  const fontSize = Math.round(o.height * o.captionSize);
  const caption = o.captions ? {
    fontSize, font: `600 ${fontSize}px/1.35 ${o.captionFont}`, lineHeight: Math.round(fontSize * 1.35),
    maxWidth: Math.round(o.width * 0.68),
    // In the band: centred in it. Over the scene: near the bottom.
    centreY: band ? o.height - band / 2 : o.height - fontSize * 2.4
  } : null;
  return { width: o.width, height: o.height, fps: o.fps, background: o.background, scene: { ...sceneRect }, dest, scale: k, caption };
}

// Explicit line breaks are kept; longer lines wrap at spaces. A word longer
// than the width is broken by characters (so text without spaces wraps too).
export function wrapCaption(measure, text, maxWidth) {
  const out = [];
  const pieces = word => {
    if (measure(word) <= maxWidth) return [word];
    const parts = []; let cur = '';
    for (const ch of word) { if (cur && measure(cur + ch) > maxWidth) { parts.push(cur); cur = ch; } else cur += ch; }
    return cur ? [...parts, cur] : parts;
  };
  for (const para of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/ +/).flatMap(pieces)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

function drawCaption(ctx, layout, text) {
  const c = layout.caption;
  ctx.save();
  ctx.font = c.font;
  const lines = wrapCaption(s => ctx.measureText(s).width, text, c.maxWidth);
  const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
  const padX = c.fontSize * 0.9, padY = c.fontSize * 0.5;
  const boxW = widest + padX * 2, boxH = lines.length * c.lineHeight + padY * 2;
  const x = (layout.width - boxW) / 2, y = c.centreY - boxH / 2;
  ctx.fillStyle = 'rgba(20,20,30,0.82)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, c.fontSize * 0.5); else ctx.rect(x, y, boxW, boxH);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, layout.width / 2, y + padY + c.lineHeight * (i + 0.5)));
  ctx.restore();
}

// Visible DOM elements in the scene that the canvases do not hold. Zero-size,
// hidden or transparent ones (or inside a hidden or transparent parent) are left out.
export function findDomLayers(doc, selectors) {
  const view = doc.defaultView;
  const shown = el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const style = view && view.getComputedStyle(e);
      if (style && (style.display === 'none' || style.visibility === 'hidden' || (style.opacity !== '' && Number(style.opacity) === 0))) return false;
    }
    return true;
  };
  const found = [];
  for (const sel of selectors || []) {
    for (const el of doc.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && shown(el)) found.push({ element: el, selector: sel, name: el.id || `${sel} (${(el.textContent || '').trim().slice(0, 30)})` });
    }
  }
  return found;
}

// Images that would make the export canvas unreadable (cross-origin without
// CORS). Each gets its own probe: one tainted image taints the canvas it is drawn on.
export function crossOriginImages(canvases, makeCanvas) {
  const bad = [];
  const check = (el, name) => {
    if (!el || typeof el !== 'object') return;
    const probe = makeCanvas(1, 1).getContext('2d');
    try { probe.drawImage(el, 0, 0, 1, 1); probe.getImageData(0, 0, 1, 1); }
    catch (e) { if (e && e.name === 'SecurityError') bad.push(name || el.currentSrc || el.src || 'an image'); }
  };
  const visit = o => {
    if (o.getObjects) o.getObjects().forEach(visit);
    if (o.getElement) check(o.getElement(), o.uid);
    for (const k of ['fill', 'stroke']) if (o[k] && o[k].source) check(o[k].source, o.uid && `${o.uid} (${k} pattern)`);
  };
  canvases.forEach(c => {
    c.getObjects().forEach(visit);
    for (const k of ['backgroundImage', 'overlayImage']) if (c[k]) visit(c[k]);
  });
  return bad;
}

// One Web Audio source per media element, kept for the page's life: an element
// can be given to createMediaElementSource only once, and from then on it is
// heard only through the graph. The context is the application's when it
// gives one (env.audioContext); the shared one here is never closed.
// `silenced` counts recordings that took the narration off the speakers.
const graphs = new WeakMap();
let sharedContext = null;
export function audioGraph(env, audio) {
  let g = graphs.get(audio);
  if (!g) {
    const context = env.audioContext || sharedContext || (sharedContext = new env.AudioContext());
    const source = context.createMediaElementSource(audio);
    source.connect(context.destination);
    g = { context, source, silenced: 0 };
    graphs.set(audio, g);
  }
  return g;
}

export class RecordingError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'RecordingError'; Object.assign(this, details); }
}
// What a hook threw, as an Error that names the hook and stage.
function hookError(thrown, hook, stage) {
  const error = thrown instanceof Error ? thrown : new Error(String(thrown));
  return Object.assign(error, { hook, stage });
}

// canvases: the scene's fabric canvases, bottom first. caption(): the text on
// screen or null. hooks(): the session's hook entries. onError(error): a
// failure while recording (error.stage, and error.hook when a hook failed).
export function createRecorder({ env = globalThis, options = {}, canvases, caption, hooks, audio = null, time = () => 0, onError }) {
  const o = { ...RECORD_DEFAULTS, ...options };
  const doc = env.document;
  const makeCanvas = env.createCanvas || ((w, h) => Object.assign(doc.createElement('canvas'), { width: w, height: h }));
  const timer = env.setTimeout || setTimeout;
  let layout, out, ctx, stream, recorder, mimeType = '', graph = null, recordingDest = null, silenced = false;
  let rasterLayers = [];
  let frame = null, frames = 0, stopped = false, failed = null, stopFired = false;
  const chunks = [];

  const sourceEl = c => c.lowerCanvasEl || c.getElement && c.getElement() || c;
  const cssSize = el => ({ width: el.clientWidth || parseFloat(el.style && el.style.width) || el.width, height: el.clientHeight || parseFloat(el.style && el.style.height) || el.height });

  // The checks that need the scene as it starts (run after it is rebuilt,
  // before the recorder or the narration starts).
  async function prepare() {
    if (!env.MediaRecorder || !env.MediaStream) throw new RecordingError('this browser cannot record (no MediaRecorder)', { stage: 'record' });
    for (const k of ['width', 'height', 'fps']) if (!(Number.isFinite(o[k]) && o[k] > 0)) throw new RecordingError(`record.${k} must be a positive number`, { stage: 'record' });
    if (!canvases.length) throw new RecordingError('there is no scene canvas to record', { stage: 'record' });
    const size = cssSize(sourceEl(canvases[0]));
    const scene = o.scene || { x: 0, y: 0, width: size.width, height: size.height };
    if (!(scene.width > 0 && scene.height > 0)) throw new RecordingError('the scene region is empty', { stage: 'record' });
    layout = exportLayout(o, scene);
    const withAudio = !!(o.audio && audio);
    mimeType = pickMimeType(env.MediaRecorder, withAudio);
    scanLayers();
    const tainted = crossOriginImages(canvases, makeCanvas);
    if (tainted.length) throw new RecordingError(`these images come from another site without permission to record them: ${tainted.join(', ')}`, { stage: 'images', tainted });
    if (doc.fonts) {
      if (o.captions && doc.fonts.load) await doc.fonts.load(layout.caption.font);
      if (doc.fonts.ready) await doc.fonts.ready;
    }
    if (withAudio) graph = audioGraph(env, audio);
  }

  // Each visible DOM layer needs a rasterize hook that draws it; one that
  // shows up later while recording, with no hook, stops the recording.
  function scanLayers() {
    const known = new Map(rasterLayers.map(l => [l.layer.element, l]));
    rasterLayers = findDomLayers(doc, o.domLayers).map(layer => known.get(layer.element) || { layer, hook: hooks().find(h => typeof h.rasterize === 'function' && canRaster(h, layer)) });
    const unsupported = rasterLayers.filter(l => !l.hook).map(l => l.layer.name);
    if (unsupported.length) throw new RecordingError(`the scene shows content the recorder cannot draw (add a rasterize hook): ${unsupported.join(', ')}`, { stage: 'layers', unsupported });
  }
  function canRaster(h, layer) {
    try { const img = h.rasterize(layer); return img != null && typeof img.then !== 'function'; } catch (_) { return false; }
  }

  function drawFrame() {
    if (frames++ % 15 === 0 && frames > 1) scanLayers();
    const { scene, dest, scale } = layout;
    ctx.save();
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.beginPath();
    ctx.rect(dest.x, dest.y, dest.width, dest.height);
    ctx.clip();
    for (const c of canvases) {
      const el = sourceEl(c);
      const size = cssSize(el);
      const sx = el.width / size.width, sy = el.height / size.height; // backing pixels per CSS pixel
      ctx.drawImage(el, scene.x * sx, scene.y * sy, scene.width * sx, scene.height * sy, dest.x, dest.y, dest.width, dest.height);
    }
    if (rasterLayers.length) {
      const origin = sourceEl(canvases[0]).getBoundingClientRect();
      for (const { layer, hook } of rasterLayers) {
        let img;
        try { img = hook.rasterize(layer); } catch (thrown) { throw hookError(thrown, hook.name, 'rasterize'); }
        if (!img) continue; // the layer has nothing to show this frame
        const r = layer.element.getBoundingClientRect();
        ctx.drawImage(img, dest.x + (r.left - origin.left - scene.x) * scale, dest.y + (r.top - origin.top - scene.y) * scale, r.width * scale, r.height * scale);
      }
    }
    ctx.restore();
    const text = o.captions ? caption() : null;
    if (text) drawCaption(ctx, layout, text);
    for (const h of hooks()) {
      if (typeof h.exportFrame !== 'function') continue;
      ctx.save();
      try { h.exportFrame(ctx, time(), layout); } catch (thrown) { throw hookError(thrown, h.name, 'exportFrame'); } finally { ctx.restore(); }
    }
  }
  function loop() {
    frame = null;
    if (stopped) return;
    if (!recorder || recorder.state !== 'paused') {
      try { drawFrame(); } catch (error) { return failWith(error); }
    }
    frame = env.requestAnimationFrame(loop);
  }
  function failWith(error) {
    if (failed || stopped) return;
    failed = error;
    onError && onError(error);
  }

  // Draws the first frame and resolves once the recorder is running, so the
  // narration can be released.
  async function start() {
    out = makeCanvas(layout.width, layout.height);
    ctx = out.getContext('2d');
    drawFrame();
    const video = out.captureStream(layout.fps);
    const tracks = [...video.getVideoTracks()];
    try {
      if (graph) {
        recordingDest = graph.context.createMediaStreamDestination();
        graph.source.connect(recordingDest);
        if (!o.monitor) { silenced = true; if (graph.silenced++ === 0) graph.source.disconnect(graph.context.destination); }
        tracks.push(...recordingDest.stream.getAudioTracks());
      }
      stream = new env.MediaStream(tracks);
      recorder = new env.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      tracks.forEach(t => t.stop());
      release();
      throw new RecordingError(`the recorder could not be set up: ${error.message}`, { stage: 'recorder' });
    }
    recorder.addEventListener('dataavailable', e => { if (e.data && e.data.size) chunks.push(e.data); });
    recorder.addEventListener('stop', () => { stopFired = true; }, { once: true });
    recorder.addEventListener('error', e => failWith(new RecordingError(`the recorder failed: ${(e.error && e.error.message) || 'unknown error'}`, { stage: 'recorder' })));
    // Frames flow first: with an audio track, Chrome sends 'start' only once
    // data arrives. Its state says 'recording' at once; that is enough to go on.
    frame = env.requestAnimationFrame(loop);
    await new Promise((resolve, reject) => {
      let done = false;
      const go = () => { if (!done) { done = true; resolve(); } };
      recorder.addEventListener('start', go, { once: true });
      try { recorder.start(1000); } catch (error) { done = true; return reject(new RecordingError(`the recorder did not start: ${error.message}`, { stage: 'recorder' })); }
      timer(() => { if (done) return; if (recorder.state === 'recording') go(); else { done = true; reject(new RecordingError('the recorder did not start', { stage: 'recorder' })); } }, 300);
    });
  }

  const pause = () => { if (recorder && recorder.state === 'recording') recorder.pause(); };
  const resume = () => { if (recorder && recorder.state === 'paused') recorder.resume(); };

  function release() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (graph && recordingDest) { try { graph.source.disconnect(recordingDest); } catch (_) {} recordingDest = null; }
    if (graph && silenced) { silenced = false; if (--graph.silenced === 0) graph.source.connect(graph.context.destination); }
  }

  // Stops and gives the film (null when nothing was recorded, or `discard`).
  // `tail` (ms) keeps recording a moment so the last frame and sound are in.
  // Safe to call twice: later calls get the first one's result.
  let finishing = null;
  function finish({ discard = false, tail = 0 } = {}) {
    if (finishing) return finishing;
    const ended = new Promise(resolve => {
      // A recorder that stopped itself still sends its last data before 'stop'.
      if (!recorder || stopFired) return resolve();
      recorder.addEventListener('stop', () => resolve(), { once: true });
      timer(resolve, tail + 3000); // a recorder that never says 'stop' does not hang this
      const halt = () => { stopped = true; if (frame != null) { env.cancelAnimationFrame(frame); frame = null; } if (recorder.state !== 'inactive') recorder.stop(); };
      if (tail > 0 && !discard && recorder.state === 'recording') timer(halt, tail); else halt();
    });
    if (!recorder) { stopped = true; if (frame != null) { env.cancelAnimationFrame(frame); frame = null; } }
    finishing = ended.then(() => {
      release();
      if (discard || !chunks.length) return null;
      const type = ((recorder && recorder.mimeType) || mimeType || 'video/webm').split(';')[0];
      return new Blob(chunks, { type });
    });
    return finishing;
  }

  // The file name follows what was actually recorded (MP4 where the browser records that).
  const filename = () => {
    const type = (recorder && recorder.mimeType) || mimeType || '';
    return /mp4/.test(type) ? o.filename.replace(/\.webm$/i, '.mp4') : o.filename;
  };

  return {
    prepare, start, pause, resume, finish,
    get layout() { return layout; },
    get canvas() { return out; },
    get filename() { return filename(); },
    get error() { return failed; }
  };
}

export function downloadBlob(doc, blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
