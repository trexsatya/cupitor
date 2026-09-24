// public/play-layers.js
// Stack of canvas objects sitting under the current selection, so the
// Properties panel can offer a way to pick objects hidden behind others.

function rectsOverlap(a, b) {
  return a.left <= b.left + b.width && b.left <= a.left + a.width &&
         a.top <= b.top + b.height && b.top <= a.top + a.height;
}

function isPickable(obj) {
  return obj.visible !== false && obj.selectable !== false && obj.evented !== false;
}

// Pickable objects for which `hit(obj)` is true (e.g. under the pointer), topmost first.
export function stackAt(objects, hit) {
  const out = [];
  for (let i = objects.length - 1; i >= 0; i--) {
    if (isPickable(objects[i]) && hit(objects[i])) out.push(objects[i]);
  }
  return out;
}

// `objects` is in canvas stacking order (bottom → top). Returns the selected
// objects plus every pickable object whose box overlaps any of `selRects`, topmost first.
export function overlappingStack(objects, selRects, rectOf, isSelected) {
  const out = [];
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (isSelected(obj)) { out.push(obj); continue; }
    if (!isPickable(obj)) continue;
    const r = rectOf(obj);
    if (selRects.some(sel => rectsOverlap(r, sel))) out.push(obj);
  }
  return out;
}

function textOf(obj) {
  if (typeof obj.text === 'string') return obj.text;
  if (obj.customData && typeof obj.customData.text === 'string') return obj.customData.text;
  const inner = typeof obj.getObjects === 'function'
    ? obj.getObjects().find(o => typeof o.text === 'string')
    : null;
  return inner ? inner.text : '';
}

export function layerLabel(obj) {
  const kind = (obj.customData && obj.customData.type) || obj.type || 'object';
  const text = textOf(obj).replace(/\s+/g, ' ').trim();
  if (text) return `${kind}: ${text.length > 24 ? text.slice(0, 24) + '…' : text}`;
  return obj.uid ? `${kind} …${String(obj.uid).slice(-5)}` : kind;
}

// "Layer 3 of 5 · top" for one selected object; a count for a multi-selection.
export function layerPosition(objects, selected) {
  if (selected.length !== 1) return `${selected.length} selected`;
  const i = objects.indexOf(selected[0]);
  if (i < 0) return '';
  const n = objects.length;
  const edge = n < 2 ? '' : i === n - 1 ? ' · top' : i === 0 ? ' · bottom' : '';
  return `Layer ${i + 1} of ${n}${edge}`;
}
