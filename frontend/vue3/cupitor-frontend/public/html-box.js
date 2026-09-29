// public/html-box.js
// HTML boxes: a Fabric rectangle (HtmlBox) holding HTML content (rich text,
// lists, links) in customData.html. The rectangle carries the uid, position,
// size, background and border, and is what gets selected, dragged, recorded,
// grouped and connected. On the canvas the HTML is drawn as a picture inside
// the rectangle, so it stacks with other objects like any shape. While a box is
// being edited (double-click; click outside or Escape to finish) a live HTML
// element is shown exactly over it instead.

// Text styling shared by the live element and the picture, so both look the same.
const _HTML_BOX_CSS = '.html-box-content{width:100%;height:100%;box-sizing:border-box;overflow:hidden;outline:none;' +
  'font:16px/1.4 Arial,sans-serif;color:#222;word-wrap:break-word;}' +
  '.html-box-content ul,.html-box-content ol{margin:0.2em 0;padding-left:1.4em;}' +
  '.html-box-content p{margin:0.2em 0;}';

class HtmlBox extends fabric.Rect {
  static type = 'HtmlBox';

  _render(ctx) {
    super._render(ctx);
    // Only a picture of the current content: until a new one is ready the
    // live element shows instead (see syncHtmlBoxes).
    const picture = this._htmlPicture;
    if (!picture || _isEditingHtmlBox(this) || this._htmlPictureContent !== _htmlPictureContent(this)) return;
    const w = this.width, h = this.height, r = Math.min(this.rx || 0, w / 2, h / 2);
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r); else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    ctx.drawImage(picture, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
fabric.HtmlBox = HtmlBox;
fabric.classRegistry.setClass(HtmlBox);
fabric.classRegistry.setClass(HtmlBox, 'HtmlBox');

function isHtmlBox(obj) {
  return !!(obj && obj.customData && obj.customData.type === 'htmlBox');
}

// Script form: addHtmlBox(x, y, w, h, html, {uid, fill, stroke, ...}).
function addHtmlBox(x, y, w, h, html, opts) {
  opts = Object.assign({}, opts);
  const padding = opts.padding != null ? opts.padding : 8;
  const uid = opts.uid;
  delete opts.padding; delete opts.uid;
  const box = new HtmlBox(Object.assign({
    left: x, top: y, width: w, height: h,
    fill: 'transparent', stroke: '#999', strokeWidth: 1, rx: 4, ry: 4
  }, opts));
  box.customData = { type: 'htmlBox', html: html == null ? '' : String(html), padding };
  if (uid) box.uid = uid;
  pc.add(box);
  box.setCoords();
  pc.requestRenderAll();
  return box;
}

// Script form: setHtml(uid, html).
function setHtml(uidOrObj, html) {
  const box = findIfRequired(uidOrObj);
  if (!isFabricObject(box) || !isHtmlBox(box)) return;
  box.customData.html = html == null ? '' : String(html);
  box.set('dirty', true); // its cached drawing still shows the old picture
  if (box.canvas) box.canvas.requestRenderAll();
}

function _isEditingHtmlBox(box) {
  return !!(window._htmlBoxEditing && window._htmlBoxEditing.box === box);
}

// ---- The picture drawn on the canvas ------------------------------------

// What the picture shows; a change means it has to be drawn again.
function _htmlPictureContent(box) {
  const cd = box.customData;
  return [cd.html, box.width, box.height, cd.padding || 0].join('\u0000');
}

// Draws the box's HTML into a picture at `scale` times its size (sharp when
// zoomed in). html-to-image (vendor/html-to-image.js) lays the HTML out with
// the page's own CSS and copies its styles, web fonts and images into the
// picture, which a plain SVG image can't load by itself. Images and fonts from
// another site only come through if that site allows it (CORS).
function _drawHtmlPicture(box, scale) {
  const content = _htmlPictureContent(box), key = content + '\u0000' + scale;
  if (box._htmlPictureKey === key || box._htmlPicturePending === key) return;
  box._htmlPicturePending = key;
  const w = box.width, h = box.height;
  const node = document.createElement('div');
  node.className = 'html-box-content';
  node.style.cssText = `width:${w}px;height:${h}px;padding:${box.customData.padding || 0}px;`;
  node.innerHTML = box.customData.html;
  _htmlPictureStage().appendChild(node);
  const picture = window.htmlToImage
    ? _htmlFontCSS(node)
      // An image that can't be fetched becomes a blank placeholder instead of
      // failing the whole picture.
      .then(fontEmbedCSS => htmlToImage.toCanvas(node, { width: w, height: h, pixelRatio: scale, skipAutoScale: true, fontEmbedCSS, imagePlaceholder: _BLANK_IMAGE }))
      .catch(() => _plainHtmlPicture(node, w, h, scale))
    : _plainHtmlPicture(node, w, h, scale);
  picture.then(img => {
    if (box._htmlPicturePending !== key) return;
    box._htmlPicturePending = null;
    box._htmlPicture = img;
    box._htmlPictureKey = key;
    box._htmlPictureContent = content;
    box.set('dirty', true); // also marks any group it sits in
    if (box.canvas) box.canvas.requestRenderAll();
  }).catch(() => {
    if (box._htmlPicturePending === key) box._htmlPicturePending = null;
  }).finally(() => node.remove());
}

const _BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// The web-font CSS for the fonts `node` uses, kept per set of fonts: reading
// the page's stylesheets and fetching font files happens once per set, not on
// every picture. Like html-to-image, only elements' own fonts count (not
// ::before/::after); a newly loaded stylesheet starts afresh; at most 50 sets.
const _htmlFontCSSCache = new Map();
function _htmlFontCSS(node) {
  const families = new Set([node, ...node.querySelectorAll('*')].map(el => getComputedStyle(el).fontFamily));
  const key = document.styleSheets.length + '|' + [...families].sort().join('|');
  if (!_htmlFontCSSCache.has(key)) {
    if (_htmlFontCSSCache.size >= 50) _htmlFontCSSCache.delete(_htmlFontCSSCache.keys().next().value);
    const css = htmlToImage.getFontEmbedCSS(node);
    css.catch(() => _htmlFontCSSCache.delete(key));
    _htmlFontCSSCache.set(key, css);
  }
  return _htmlFontCSSCache.get(key);
}

// Off-screen place where a box's HTML is laid out before it is pictured.
function _htmlPictureStage() {
  let stage = document.getElementById('htmlPictureStage');
  if (!stage) {
    stage = document.createElement('div');
    stage.id = 'htmlPictureStage';
    stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
    document.body.appendChild(stage);
  }
  return stage;
}

// Fallback without html-to-image: the HTML with only the box's own text
// styling (no page CSS, web fonts or images), as an SVG data URL so the
// canvas stays readable.
function _plainHtmlPicture(node, w, h, scale) {
  // Images from elsewhere wouldn't load in the picture anyway, and some
  // browsers would then refuse to let the canvas be read.
  node.querySelectorAll('img').forEach(img => { if (!/^data:/.test(img.getAttribute('src') || '')) img.setAttribute('src', _BLANK_IMAGE); });
  const xhtml = new XMLSerializer().serializeToString(node);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}"><style xmlns="http://www.w3.org/1999/xhtml">${_HTML_BOX_CSS}</style>${xhtml}</foreignObject></svg>`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// Picture resolution: the box's on-screen scale (its own and its groups', the
// zoom and the screen's pixel density), rounded up, at most 4x, and small
// enough that the picture stays within 8192px (browsers cap canvas size).
function _htmlPictureScale(box) {
  const s = box.getTotalObjectScaling();
  const fit = Math.floor(8192 / Math.max(box.width, box.height, 1));
  return Math.max(1, Math.min(4, fit, Math.ceil(Math.max(s.x, s.y))));
}

// ---- The live HTML element (while editing) --------------------------------

window._htmlBoxEls = new Map(); // uid -> element (not saved)

function _htmlBoxLayer() {
  let layer = document.getElementById('htmlBoxLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'htmlBoxLayer';
    // Above whichever canvas is in front (moveToFront uses z-index 2000), but
    // letting clicks through to it; only a box being edited takes the pointer.
    layer.style.cssText = 'position:absolute;width:0;height:0;overflow:visible;z-index:2001;pointer-events:none;';
    document.body.appendChild(layer);
    const style = document.createElement('style');
    style.textContent = _HTML_BOX_CSS;
    document.head.appendChild(style);
  }
  const r = pc.wrapperEl.getBoundingClientRect();
  layer.style.left = (r.left + window.scrollX) + 'px';
  layer.style.top = (r.top + window.scrollY) + 'px';
  return layer;
}

function _htmlBoxElement(box) {
  let el = window._htmlBoxEls.get(box.uid);
  if (el && el._box !== box) { el.remove(); el = null; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'html-box';
    // Not data-uid / id: findById falls back to those and would return this element.
    el.setAttribute('data-html-box', box.uid);
    const content = document.createElement('div');
    content.className = 'html-box-content';
    el.appendChild(content);
    ['keydown', 'keyup', 'keypress'].forEach(type => el.addEventListener(type, e => {
      // Keep typing away from the canvas shortcuts (Delete, undo, space pan, ...).
      e.stopPropagation();
      if (type !== 'keydown' || !window._htmlBoxEditing) return;
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        exitHtmlBoxEdit(true);
      }
    }));
    el._box = box;
    el._content = content;
    window._htmlBoxEls.set(box.uid, el);
    _htmlBoxLayer().appendChild(el);
  }
  return el;
}

// Every box reachable on pc, with the groups it sits in.
function _reachableHtmlBoxes() {
  const found = [];
  const walk = (objs, ancestors) => objs.forEach(o => {
    if (isHtmlBox(o)) found.push({ box: o, ancestors });
    if (o._objects) walk(o._objects, ancestors.concat(o));
  });
  walk(pc.getObjects(), []);
  return found;
}

// Keeps each box's picture up to date, and its live HTML element over it
// (position, size, rotation, scale, zoom and pan, visibility, opacity, a
// reveal's clip). The element shows only while the box is edited, or until a
// picture of the current content is ready. Runs after every render.
function syncHtmlBoxes() {
  if (!window.pc) return;
  _htmlBoxLayer();
  const alive = new Set();
  _reachableHtmlBoxes().forEach(({ box, ancestors }) => {
    if (!box.uid) return;
    alive.add(box.uid);
    const el = _htmlBoxElement(box), content = el._content, cd = box.customData;
    const editing = _isEditingHtmlBox(box);
    _drawHtmlPicture(box, _htmlPictureScale(box));
    const live = editing || box._htmlPictureContent !== _htmlPictureContent(box);
    if (!editing && el._html !== cd.html) { content.innerHTML = cd.html; el._html = cd.html; }
    const w = box.width, h = box.height;
    const m = fabric.util.multiplyTransformMatrices(pc.viewportTransform, box.calcTransformMatrix());
    const transform = `matrix(${m.join(',')}) translate(${-w / 2}px, ${-h / 2}px)`;
    if (el._transform !== transform || el._w !== w || el._h !== h) {
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.transform = transform;
      el._transform = transform; el._w = w; el._h = h;
    }
    const shown = box.visible !== false && ancestors.every(a => a.visible !== false);
    el.style.display = shown && live ? '' : 'none';
    el.style.opacity = [box, ...ancestors].reduce((o, a) => o * (a.opacity == null ? 1 : a.opacity), 1);
    content.style.padding = (cd.padding || 0) + 'px';
    content.style.borderRadius = (box.rx || 0) + 'px';
    content.style.clipPath = _htmlBoxClip(box, w, h);
  });
  window._htmlBoxEls.forEach((el, uid) => {
    if (alive.has(uid)) return;
    if (window._htmlBoxEditing && window._htmlBoxEditing.el === el) exitHtmlBoxEdit(false);
    el.remove();
    window._htmlBoxEls.delete(uid);
  });
  if (window._htmlBoxEditing && document.body.classList.contains('play-mode')) exitHtmlBoxEdit(true);
}

// A reveal clips the box with a rectangle in the box's own coordinates
// (centred on it); the HTML gets the same clip as a CSS inset.
function _htmlBoxClip(box, w, h) {
  const c = box.clipPath;
  if (!c || c.absolutePositioned) return '';
  const l = Math.max(0, c.left + w / 2), t = Math.max(0, c.top + h / 2);
  const r = Math.max(0, w - (l + c.width)), b = Math.max(0, h - (t + c.height));
  return `inset(${t}px ${r}px ${b}px ${l}px)`;
}

// ---- Editing --------------------------------------------------------------

window._htmlBoxEditing = null;

function editHtmlBox(uidOrObj) {
  const box = findIfRequired(uidOrObj);
  if (!isFabricObject(box) || !isHtmlBox(box)) return;
  if (window._htmlBoxEditing) exitHtmlBoxEdit(true);
  const el = _htmlBoxElement(box);
  window._htmlBoxEditing = { box, el, before: box.customData.html };
  el.classList.add('editing');
  el._content.contentEditable = 'true';
  box.set('dirty', true);
  pc.requestRenderAll();
  setTimeout(() => el._content.focus(), 0);
  if (typeof _syncHtmlEditButton === 'function') _syncHtmlEditButton();
}

// Leaves edit mode; with commit the new HTML is kept, recorded and undoable.
function exitHtmlBoxEdit(commit) {
  const state = window._htmlBoxEditing;
  if (!state) return;
  window._htmlBoxEditing = null;
  const { box, el, before } = state;
  const html = el._content.innerHTML;
  el._content.contentEditable = 'false';
  el.classList.remove('editing');
  if (commit && html !== before) {
    setHtml(box, html);
    el._html = html;
    if (box.uid) recordScript(`setHtml(${JSON.stringify(box.uid)}, ${JSON.stringify(html)})`);
    if (window.undoManager) {
      undoManager.push({ undo() { setHtml(box, before); }, redo() { setHtml(box, html); } });
    }
  } else {
    el._content.innerHTML = before;
    el._html = before;
  }
  if (typeof _syncHtmlEditButton === 'function') _syncHtmlEditButton();
  box.set('dirty', true);
  pc.requestRenderAll();
}

// The selection inside the box being edited, kept so panel controls that take
// focus (colour, size) still format what was selected.
let _htmlBoxRange = null;
document.addEventListener('selectionchange', () => {
  const state = window._htmlBoxEditing;
  const sel = document.getSelection();
  if (state && sel.rangeCount && state.el._content.contains(sel.anchorNode)) {
    _htmlBoxRange = sel.getRangeAt(0).cloneRange();
  }
});

// Applies a formatting command to the selection in the box being edited.
function htmlBoxFormat(command, value) {
  const state = window._htmlBoxEditing;
  if (!state) return;
  const content = state.el._content;
  content.focus();
  if (_htmlBoxRange && content.contains(_htmlBoxRange.startContainer)) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(_htmlBoxRange);
  }
  if (command === 'createLink' && !value) return;
  document.execCommand(command, false, value);
}

function initHtmlBoxes(canvas) {
  canvas.on('after:render', syncHtmlBoxes);
  canvas.on('object:removed', () => canvas.requestRenderAll());
  window.addEventListener('resize', syncHtmlBoxes);
  canvas.on('mouse:dblclick', e => { if (e.target && isHtmlBox(e.target)) editHtmlBox(e.target); });
  // A press anywhere outside the box being edited (and outside the Properties
  // panel, whose buttons format it, and the link popup) finishes editing.
  document.addEventListener('mousedown', e => {
    if (!window._htmlBoxEditing) return;
    if (e.target.closest && e.target.closest('.html-box.editing, #property-panel, #askTextPopup')) return;
    exitHtmlBoxEdit(true);
  }, true);
}
