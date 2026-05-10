window.globalFabricObjId = 0;

function combined(){
  return Object.assign(...arguments)
}

function recordScript(str) {
  // isRecordingPlayback is flipped on by schedule() during import. Helpers
  // that self-record (addImage, addMath, etc.) need to stay quiet then.
  if (window.recordScriptFn && !window.isRecordingPlayback) {
    window.recordScriptFn(str);
  }
}

// Semantic UID generator — e.g. T1, T2 for textboxes; R1, R2 for rects etc.
const _SEMANTIC_PREFIXES = {
  textbox: 'T', text: 'T', 'i-text': 'T',
  textrect: 'R', rect: 'R',
  textcircle: 'C', circle: 'C',
  textellipse: 'E', ellipse: 'E',
  diamond: 'D',
  quad: 'Q', textinquad: 'Q',
  hexagon: 'H',
  star: 'ST',
  cloud: 'CL',
  polygon: 'P',
  triangle: 'TR',
  arrow: 'A', linearrow: 'A',
  biarrow: 'BA', bilinearrow: 'BA',
  path: 'PH',
  image: 'IMG',
  group: 'G',
  line: 'L', curvableline: 'L',
  stickynote: 'SN',
  ellipse: 'E',
};

// Collect every name that's already "taken" — both canvas object uids and
// names the user's imported script may have claimed via `_.T1 = ...`, so a
// freshly-generated uid never shadows or gets shadowed by script references.
function _collectTakenUids() {
  const taken = new Set();
  if (window._ && typeof window._ === 'object') {
    Object.keys(window._).forEach(k => taken.add(k));
  }
  [window.pc, window.oc].forEach(c => {
    if (c && typeof c.getObjects === 'function') {
      c.getObjects().forEach(o => { if (o && o.uid) taken.add(o.uid); });
    }
  });
  return taken;
}

function semanticUid(type) {
  const prefix = _SEMANTIC_PREFIXES[(type || '').toLowerCase()] || 'OBJ';
  window._uidCounters = window._uidCounters || {};
  const taken = _collectTakenUids();
  let candidate;
  do {
    window._uidCounters[prefix] = (window._uidCounters[prefix] || 0) + 1;
    candidate = prefix + window._uidCounters[prefix];
  } while (taken.has(candidate));
  return candidate;
}

// After loading canvas JSON, sync counters so new IDs don't collide with loaded ones
function syncUidCounters() {
  const _pattern = /^([A-Za-z]+)(\d+)$/;
  const canvases = [window.pc, window.oc].filter(Boolean);
  canvases.forEach(canvas => {
    (canvas._objects || []).forEach(obj => {
      const uid = obj.uid;
      if (!uid) return;
      const m = uid.match(_pattern);
      if (!m) return;
      const prefix = m[1];
      const num = parseInt(m[2], 10);
      window._uidCounters = window._uidCounters || {};
      if (!(prefix in window._uidCounters) || window._uidCounters[prefix] < num) {
        window._uidCounters[prefix] = num;
      }
    });
  });
}

// Helper for script playback: set a property on an object by uid
function setProp(uid, prop, value) {
  const obj = findById(uid);
  if (obj && typeof obj.set === 'function') {
    obj.set(prop, value);
    if (window.pc) window.pc.requestRenderAll();
  }
}

function findById(id, canvas) {
  if (!canvas) canvas = pc
  const fabricObj = canvas._objects.find(it => it.uid + '' === id + '' || it.customData?.uid + '' === id + '');
  if(!fabricObj) {
    let obj = $(`*[data-uid='${id}']`)
    if(!obj.length) obj = $(`#${id}`)
    return obj
  }
  return fabricObj;
}

function isFabricObject(obj) {
  return obj instanceof fabric.Object;
}

function findIfRequired(idOrObj) {
  if(typeof idOrObj !== 'object') {
    return  findById(idOrObj);
  }
  const obj = idOrObj
  if(obj.uid && !isFabricObject(obj)) {
    return findById(obj.uid)
  }
  return obj
}

const Arrow = (function() {
    function Arrow(canvas) {
        this.canvas = canvas;
        this.className = 'Arrow';
        this.isDrawing = false;
        this.bindEvents();
    }

    Arrow.prototype.bindEvents = function() {
        const inst = this;
        inst.canvas.on('mouse:down', function(o) {
            inst.onMouseDown(o);
        });
        inst.canvas.on('mouse:move', function(o) {
            inst.onMouseMove(o);
        });
        inst.canvas.on('mouse:up', function(o) {
            inst.onMouseUp(o);
        });
        inst.canvas.on('object:moving', function(o) {
            inst.disable();
        })
    }

    Arrow.prototype.onMouseUp = function(o) {
        const inst = this;
        inst.disable();
    };

    Arrow.prototype.onMouseMove = function(o) {
        const inst = this;
        if (!inst.isEnable()) {
            return;
        }

        const pointer = inst.canvas.getPointer(o.e);
        const activeObj = inst.canvas.getActiveObject();
        activeObj.set({
            x2: pointer.x,
            y2: pointer.y
        });
        activeObj.setCoords();
        inst.canvas.renderAll();
    };

    Arrow.prototype.onMouseDown = function(o) {
        const inst = this;
        inst.enable();
        const pointer = inst.canvas.getPointer(o.e);

        const points = [pointer.x, pointer.y, pointer.x, pointer.y];
        const line = new fabric.LineArrow(points, {
            strokeWidth: 1.5,
            fill: '',
            stroke: '#555',
            padding: 4,
            hasBorders: false,
            hasControls: false
        });

        inst.canvas.add(line).setActiveObject(line);
    };

    Arrow.prototype.isEnable = function() {
        return this.isDrawing;
    }

    Arrow.prototype.enable = function() {
        this.isDrawing = true;
    }

    Arrow.prototype.disable = function() {
        this.isDrawing = false;
    }

    return Arrow;
}());

function changeText(obj, data) {
    if(!obj) return
    obj?._objects?.find(it => it.text !== null && it.text !== undefined)?.set({
        text: data
    });

    pc?.renderAll()
}

function textbox(opts){
    opts = combined({ top: 100, left: 400, angle: 0, color: 'blue', text: '', width: 300 }, opts);

    const textSample = new fabric.Textbox(opts.text, {
        fontSize: 20,
        left: opts.left,
        top: opts.top,
        fontFamily: 'helvetica',
        angle: opts.angle,
        fill: opts.color,
        fontWeight: '',
        originX: 'left',
        width: opts.width,
        hasRotatingPoint: true,
        centerTransform: true
    });
    textSample.uid = opts.uid || semanticUid('textbox');
    return textSample
}

function textInRect(textStr, x, y, optsText, optsRect, uid){
    if(!arguments.length) console.log('textInRect(text, x,y, optsText, optsRect)')
    if(!textStr) return null;

    const op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    const text = new fabric.Text(" " + textStr + " ", {
      fontSize: 20,
      originX: 'center',
      originY: 'center',
      fill: op.fill
    });

    let dwidth = 20, dheight = 20
    if(optsRect && optsRect.padx) dwidth = optsRect.padx;
    if(optsRect && optsRect.pady) dheight = optsRect.pady;

    const options = Object.assign({},{
        width: text.width + dwidth,
        height: text.height + dheight,
        fill: 'red',
        originX: 'center',
        originY: 'center',
        rx: 10, ry: 10
    },optsRect);

    if(optsRect.rectColor) options.fill = optsRect.rectColor;

    const rect = new fabric.Rect(options);

    const group = new fabric.Group([ rect, text ], {
        left: x,
        top: y
    });

    group.customData = {
        type: "textInRect",
        text: textStr,
        foreground: function(color) {
            if(!color) {

            }
        },
        background: function(color) {
            if(!color) {

            }
        }
    };

    group.uid = uid || semanticUid('textrect');
    return group;
}

function textInCircle(textStr, x,y, optsText, optsCirc){
    if(!arguments.length) console.log('textInCircle(text, x,y, optsText, optsCirc)')
    if(!textStr) return null;

    const op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    const text = new fabric.Text( textStr, op);

    const options = Object.assign({},{
        radius: text.width,
        fill: 'red',
        originX: 'center',
        originY: 'center'
    },optsCirc);

    if(optsCirc.circleColor) options.fill = optsCirc.circleColor;

    const circle = new fabric.Circle(options);

    const group = new fabric.Group([ circle, text ], {
        left: x,
        top: y
    });

    group.customData = {
      type: "textInCircle",
      text: textStr
    }
    group.uid = semanticUid('textcircle');
    return group;
}

function textInEllipse(textStr, x, y, optsText, optsCirc){
  if(!arguments.length) console.log('textInEllipse(text, x,y, optsText, optsCirc)')
  if(!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);
  if(optsText.textColor) op.fill = optsText.textColor;

  const text = new fabric.Text( textStr, op);

  const options = Object.assign({},{
    rx: text.width,
    ry: text.height,
    fill: 'red',
    originX: 'center',
    originY: 'center'
  },optsCirc);

  if(optsCirc.circleColor) options.fill = optsCirc.circleColor;

  const circle = new fabric.Ellipse(options);

  const group = new fabric.Group([ circle, text ], {
    left: x,
    top: y
  });

  group.customData = {
    type: "textInEllipse",
    text: textStr
  }
  group.uid = semanticUid('textellipse');
  return group;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function boundedText(type) {
  switch (type) {
    case 'rect': return textInRect;
    case 'circ': return textInCircle;
    case 'elli': return textInEllipse;
    case 'diamond': return textInDiamond;
    case 'hexagon': return textInHexagon;
    case 'star': return textInStar;
    case 'cloud': return textInCloud;
  }
}

// Miro-like shape functions
function textInDiamond(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  const size = Math.max(text.width + 40, text.height + 40);
  const points = [
    { x: size/2, y: 0 },      // top
    { x: size, y: size/2 },   // right
    { x: size/2, y: size },   // bottom
    { x: 0, y: size/2 }       // left
  ];

  const options = Object.assign({}, {
    points: points,
    fill: 'orange',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  const diamond = new fabric.Polygon(points, options);

  const group = new fabric.Group([diamond, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInDiamond", text: textStr };
  group.uid = semanticUid('diamond');
  return group;
}

function textInHexagon(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  const radius = Math.max(text.width, text.height) / 2 + 20;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    points.push({
      x: radius + radius * Math.cos(angle),
      y: radius + radius * Math.sin(angle)
    });
  }

  const options = Object.assign({}, {
    points: points,
    fill: 'purple',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  const hexagon = new fabric.Polygon(points, options);

  const group = new fabric.Group([hexagon, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInHexagon", text: textStr };
  group.uid = semanticUid('hexagon');
  return group;
}

// Tiltable quadrilateral with a centered text label. Returned as {quad, text}
// where both must be added to the canvas. Dragging any of the 4 corner handles
// reshapes the polygon (producing a perspective-looking tilt); the label
// re-centers on the polygon's centroid automatically. Double-click on the
// quad to edit the label inline.
function textInQuad(textStr, x, y, width, height, optsText, optsShape) {
  const w = width || 160, h = height || 100;
  const points = (optsShape && optsShape.points) || [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];
  const shapeOpts = Object.assign({}, {
    left: x, top: y,
    fill: 'rgba(100, 150, 220, 0.35)',
    stroke: '#1976D2',
    strokeWidth: 2,
    objectCaching: false
  }, optsShape);
  delete shapeOpts.points;

  const quad = new fabric.Polygon(points, shapeOpts);

  const text = new fabric.IText(textStr || '', Object.assign({}, {
    fontSize: 18,
    fill: '#111',
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
    editable: true
  }, optsText));

  attachQuadBehavior(quad, text);
  quad.uid = semanticUid('quad');
  quad.customData = { type: 'textInQuad', text: textStr };
  // Inner label is recorded via setQuadLabel against the polygon's uid; flag
  // it so the canvas-level text:editing:exited handler skips a duplicate
  // (and uid-incorrect) setText recording.
  text.customData = Object.assign({}, text.customData, { skipSetTextRecording: true });
  return { quad, text };
}

function attachQuadBehavior(polygon, labelText) {
  const positionText = () => {
    const pts = polygon.points;
    if (!pts || pts.length < 1) return;
    let cx = 0, cy = 0;
    pts.forEach(p => { cx += p.x; cy += p.y; });
    cx = cx / pts.length - polygon.pathOffset.x;
    cy = cy / pts.length - polygon.pathOffset.y;
    const world = fabric.util.transformPoint({ x: cx, y: cy }, polygon.calcTransformMatrix());
    labelText.set({ left: world.x, top: world.y });
    labelText.setCoords();
    if (polygon.canvas) polygon.canvas.requestRenderAll();
  };

  polygon.on('moving', positionText);
  polygon.on('scaling', positionText);
  polygon.on('rotating', positionText);
  polygon.on('modified', positionText);
  // So replay through animate() (which calls obj.onAnimationChange each frame)
  // also keeps the label glued to the polygon's centroid.
  polygon.onAnimationChange = positionText;

  // Double-click the polygon → inline IText edit mode.
  polygon.on('mousedblclick', () => {
    const canvas = polygon.canvas;
    if (!canvas) return;
    labelText.set({ selectable: true, evented: true });
    canvas.setActiveObject(labelText);
    labelText.enterEditing();
    labelText.selectAll();
    canvas.requestRenderAll();
  });

  labelText.on('editing:exited', () => {
    labelText.set({ selectable: false, evented: false });
    const newText = labelText.text;
    const changed = polygon.customData.text !== newText;
    polygon.customData.text = newText;
    if (polygon.canvas) {
      polygon.canvas.setActiveObject(polygon);
      polygon.canvas.requestRenderAll();
    }
    if (changed && typeof recordScript === 'function') {
      recordScript(`setQuadLabel('${polygon.uid}', ${JSON.stringify(newText)})`);
    }
  });

  // Linked lifecycle — removing either takes the other with it. Each handler
  // is guarded by `.canvas` because fabric nulls it on removal, so the
  // reciprocal remove becomes a no-op and we avoid a loop.
  polygon.on('removed', () => {
    if (labelText.canvas) labelText.canvas.remove(labelText);
  });
  labelText.on('removed', () => {
    if (polygon.canvas) polygon.canvas.remove(polygon);
  });

  attachVertexControls(polygon, positionText);

  polygon._labelText = labelText;
  labelText._parentQuad = polygon;

  // Re-center label once initial transform is known (after add()).
  setTimeout(positionText, 0);
}

function setQuadLabel(uidOrObj, text) {
  const quad = findIfRequired(uidOrObj);
  if (!quad || !quad._labelText) return;
  quad._labelText.set({ text: text == null ? '' : String(text) });
  if (quad.customData) quad.customData.text = quad._labelText.text;
  quad._labelText.setCoords();
  if (quad.canvas) quad.canvas.requestRenderAll();
}

// Replay helper — resets a quad's vertices (and any transform props) and
// re-centers its label. Recorded on vertex-drag; see play.html object:modified.
function reshapeQuad(uidOrObj, points, transformProps) {
  const quad = findIfRequired(uidOrObj);
  if (!quad || !points) return;
  quad.set({ points: points });
  if (typeof quad.setDimensions === 'function') quad.setDimensions();
  if (transformProps) quad.set(transformProps);
  quad.setCoords();
  quad.fire('modified'); // triggers our positionText handler
  if (quad.canvas) quad.canvas.requestRenderAll();
}

function attachVertexControls(polygon, onChange) {
  // Fabric v6 ships a polygon-editor utility that builds per-vertex controls
  // with the correct world↔local math and keeps the polygon anchored. We just
  // piggy-back on the 'modifyPoly' event it fires during the drag.
  polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
  if (onChange) polygon.on('modifyPoly', onChange);
}

// Replace a fabric.Line's default bbox-scaling controls with two endpoint
// handles. Dragging either handle moves just that endpoint along the cursor
// — no more "messy" diagonal scaling when the line is tilted inside its bbox.
function attachLineEndpointControls(line) {
  const endpointPositionHandler = (which) => function (dim, finalMatrix, fabricObject) {
    const sx = which === 'start' ? fabricObject.x1 : fabricObject.x2;
    const sy = which === 'start' ? fabricObject.y1 : fabricObject.y2;
    return new fabric.Point(sx, sy).transform(fabricObject.getViewportTransform());
  };

  const endpointActionHandler = (which) => function (eventData, transform, x, y) {
    const ln = transform.target;
    if (which === 'start') { ln.x1 = x; ln.y1 = y; }
    else { ln.x2 = x; ln.y2 = y; }
    ln._setWidthHeight();
    ln.setCoords();
    ln.fire('modifyLine');
    return true;
  };

  line.controls = {
    p1: new fabric.Control({
      actionName: 'modifyLine',
      positionHandler: endpointPositionHandler('start'),
      actionHandler: endpointActionHandler('start'),
      render: fabric.controlsUtils.renderCircleControl,
      cornerSize: 12
    }),
    p2: new fabric.Control({
      actionName: 'modifyLine',
      positionHandler: endpointPositionHandler('end'),
      actionHandler: endpointActionHandler('end'),
      render: fabric.controlsUtils.renderCircleControl,
      cornerSize: 12
    })
  };
  // Hide rotation; rotation doesn't mean much for a two-point line.
  line.hasRotatingPoint = false;
}

// Convenience constructors used by recorded scripts. Each creates the shape,
// applies the supplied uid (if any), adds it to the primary canvas, and
// returns the object so chained calls in scripts work naturally.
function addLine(points, opts) {
  opts = opts || {};
  const line = new fabric.CurvableLine(points, opts);
  if (opts.uid) line.uid = opts.uid;
  pc.add(line);
  return line;
}

function addRect(left, top, width, height, opts) {
  opts = opts || {};
  const rect = new fabric.Rect(Object.assign({
    fill: 'transparent', stroke: '#333', strokeWidth: 2
  }, opts, { left, top, width, height }));
  if (opts.uid) rect.uid = opts.uid;
  pc.add(rect);
  return rect;
}

function addEllipse(left, top, rx, ry, opts) {
  opts = opts || {};
  const ell = new fabric.Ellipse(Object.assign({
    fill: 'transparent', stroke: '#333', strokeWidth: 2
  }, opts, { left, top, rx, ry }));
  if (opts.uid) ell.uid = opts.uid;
  pc.add(ell);
  return ell;
}

function addDiamond(left, top, width, height, opts) {
  opts = opts || {};
  const rect = new fabric.Rect(Object.assign({
    fill: 'transparent', stroke: '#333', strokeWidth: 2, angle: 45
  }, opts, { left, top, width, height }));
  if (opts.uid) rect.uid = opts.uid;
  pc.add(rect);
  return rect;
}

function addStickyNote(x, y, opts) {
  opts = opts || {};
  // createStickyNote lives in whiteboard.tools.js and takes (x, y, options).
  const note = typeof createStickyNote === 'function'
    ? createStickyNote(x, y, opts)
    : null;
  if (!note) return null;
  if (opts.uid) note.uid = opts.uid;
  pc.add(note);
  return note;
}

// Replay helper — resets the endpoints of a fabric.Line / LineArrow (the
// connector lines used in trees). x1..y2 are the same scene-ish coords the
// constructor takes. _setWidthHeight rebuilds the bbox + repositions left/top
// so the rendered line lands exactly where the user dragged it.
function reshapeLineXY(uidOrObj, x1, y1, x2, y2) {
  const ln = findIfRequired(uidOrObj);
  if (!ln) return;
  ln.x1 = x1; ln.y1 = y1;
  ln.x2 = x2; ln.y2 = y2;
  if (typeof ln._setWidthHeight === 'function') ln._setWidthHeight();
  ln.setCoords();
  if (ln.canvas) ln.canvas.requestRenderAll();
}

// Replay helper — resets the endpoints/bend of a CurvableLine. Coords are
// stored in absolute scene space so this is a drop-in refresh regardless of
// any prior body-drag that shifted left/top.
function reshapeLine(uidOrObj, points, cx, cy) {
  const line = findIfRequired(uidOrObj);
  if (!line || typeof line.rebuild !== 'function') return;
  line.x1 = points[0]; line.y1 = points[1];
  line.x2 = points[2]; line.y2 = points[3];
  line.cx = cx; line.cy = cy;
  line.rebuild(); // uses setBoundingBox(true) → left/top aligns to new bbox center
  line.fire('modifyLine');
}

// Async — resolves to the added image. Records itself so callers don't need to.
function addImage(url, left, top, opts) {
  opts = opts || {};
  return fabric.Image.fromURL(url).then(function (img) {
    img.set({ left: left == null ? 100 : left, top: top == null ? 100 : top });
    if (opts.uid) img.uid = opts.uid;
    pc.add(img);
    const r2 = n => Math.round(n * 100) / 100;
    recordScript(
      `addImage(${JSON.stringify(url)},${r2(img.left)},${r2(img.top)},${JSON.stringify({uid: img.uid})})`
    );
    return img;
  });
}

// Async — resolves to the added math image. Uses drawMathSymbols under the hood.
function addMath(text, left, top, opts) {
  opts = opts || {};
  window.matexInsertionPoint = { left: left == null ? 100 : left, top: top == null ? 100 : top };
  return drawMathSymbols(text, top, left, opts.uid).then(function (img) {
    if (opts.uid) img.uid = opts.uid;
    const r2 = n => Math.round(n * 100) / 100;
    recordScript(
      `addMath(${JSON.stringify(text)},${r2(img.left)},${r2(img.top)},${JSON.stringify({uid: img.uid})})`
    );
    return img;
  });
}

function setText(uidOrObj, text) {
  const obj = findIfRequired(uidOrObj);
  // findById falls back to a jQuery selection when no fabric object matches;
  // an empty/jQuery result means there's nothing to update — bail loudly so
  // playback continues instead of crashing on `obj.set is not a function`.
  if (!obj || !isFabricObject(obj)) {
    console.warn('setText: no fabric object found for', uidOrObj);
    return;
  }
  const newText = text == null ? '' : String(text);
  // Sticky-note groups carry the stable semantic uid (SN<n>); the editable
  // text lives as a child of the group, so route the update there.
  const isStickyGroup = obj.customData && obj.customData.type === 'stickyNote'
    && typeof obj.getObjects === 'function';
  if (isStickyGroup) {
    const inner = obj.getObjects().find(o =>
      o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
    if (inner) {
      inner.set({ text: newText });
      obj.dirty = true;
    }
  } else {
    obj.set({ text: newText });
  }
  obj.setCoords();
  if (obj.canvas) obj.canvas.requestRenderAll();
}

// Sticky-note property helper used by the Properties panel and replay.
// A sticky note is a Group(rect + textbox); each prop targets the right
// child so e.g. "fill" updates the paper colour (inner rect) rather than
// no-op'ing on the group itself, and font props update the inner textbox.
//
// Recognised props: 'fill' (paper), 'textFill' (text colour), 'fontSize',
// 'fontFamily', 'fontWeight', 'fontStyle', 'underline', 'textAlign',
// 'width', 'height', 'opacity'.
function setStickyProp(uidOrObj, prop, value) {
  const obj = findIfRequired(uidOrObj);
  if (!obj || !isFabricObject(obj)) return;
  if (!(obj.customData && obj.customData.type === 'stickyNote')) return;
  if (typeof obj.getObjects !== 'function') return;
  const children = obj.getObjects();
  const innerRect = children.find(o => o.type === 'rect');
  const innerText = children.find(o => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');

  switch (prop) {
    case 'fill': // paper colour
      if (innerRect) innerRect.set({ fill: value });
      obj.customData.color = value;
      break;
    case 'opacity':
      obj.set({ opacity: value });
      break;
    case 'width':
    case 'height':
      // Update the underlying group dimension; rect/textbox child
      // dimensions are recomputed on next regroup.
      obj.set(prop, value);
      if (innerRect) innerRect.set(prop, value);
      if (innerText && prop === 'width') innerText.set('width', Math.max(20, value - 20));
      break;
    case 'textFill':
      if (innerText) innerText.set({ fill: value });
      break;
    case 'fontSize':
    case 'fontFamily':
    case 'fontWeight':
    case 'fontStyle':
    case 'underline':
    case 'textAlign':
      if (innerText) innerText.set(prop, value);
      break;
    default:
      return;
  }
  obj.dirty = true;
  if (innerRect) innerRect.dirty = true;
  if (innerText) innerText.dirty = true;
  if (obj.canvas) obj.canvas.requestRenderAll();
}

// Replay-side helper: recreate a shape label that was added via the label
// picker. The shape must already exist on the canvas (its addRect / addEllipse
// line should run earlier in the script).
function addShapeLabel(shapeUid, position, text, opts) {
  const shape = findIfRequired(shapeUid);
  if (!shape || !isFabricObject(shape)) {
    console.warn('addShapeLabel: shape not found for uid', shapeUid);
    return;
  }
  if (!window.shapeTextManager || typeof window.shapeTextManager.addLabel !== 'function') {
    console.warn('addShapeLabel: shapeTextManager not initialized');
    return;
  }
  return window.shapeTextManager.addLabel(shape, position, text, opts || {});
}

function bringToFront(uidOrObj) {
  const obj = findIfRequired(uidOrObj);
  if (!obj || !obj.canvas) return;
  obj.canvas.bringObjectToFront(obj);
  obj.canvas.requestRenderAll();
}

function sendToBack(uidOrObj) {
  const obj = findIfRequired(uidOrObj);
  if (!obj || !obj.canvas) return;
  obj.canvas.sendObjectToBack(obj);
  obj.canvas.requestRenderAll();
}

function removeByUid(uidOrObj) {
  const obj = findIfRequired(uidOrObj);
  if (!obj || !obj.canvas) return;
  obj.canvas.remove(obj);
  obj.canvas.requestRenderAll();
}

function setObjectProps(uidOrObj, props) {
  const obj = findIfRequired(uidOrObj);
  if (!obj) return;
  obj.set(props);
  obj.setCoords();
  if (obj.canvas) obj.canvas.requestRenderAll();
}

function setCustomData(uidOrObj, data) {
  const obj = findIfRequired(uidOrObj);
  if (!obj || !data) return;
  if (!obj.customData) obj.customData = {};
  Object.assign(obj.customData, data);
}

// Miro-style: 2 endpoint handles + 1 midpoint "bend" handle. Path coords
// (x1,y1,x2,y2,cx,cy) live in the object's path-coord space (relative to
// pathOffset) — so position handlers transform through (viewport × object
// matrix), and action handlers translate pointer→local→pathSpace and then
// re-anchor an unchanged point so setBoundingBox doesn't snap the line.
function attachCurvableLineControls(line) {
  const pathSpaceToScreen = (fabricObject, px, py) =>
    new fabric.Point(px - fabricObject.pathOffset.x, py - fabricObject.pathOffset.y)
      .transform(fabric.util.multiplyTransformMatrices(
        fabricObject.getViewportTransform(),
        fabricObject.calcTransformMatrix()
      ));

  // Applies a mutation (endpoint/midpoint change), rebuilds the path, and
  // shifts left/top to preserve the given anchor's scene position — same
  // recipe fabric uses for polygon vertex drags.
  const applyAnchored = (ln, anchorX, anchorY, mutate) => {
    const anchor = new fabric.Point(anchorX, anchorY);
    const anchorInParent = anchor.subtract(ln.pathOffset).transform(ln.calcOwnMatrix());
    mutate();
    const cpx = 2 * ln.cx - (ln.x1 + ln.x2) / 2;
    const cpy = 2 * ln.cy - (ln.y1 + ln.y2) / 2;
    ln.path = fabric.util.parsePath(
      `M ${ln.x1} ${ln.y1} Q ${cpx} ${cpy} ${ln.x2} ${ln.y2}`
    );
    ln.setBoundingBox(false);
    const newAnchorInParent = anchor.subtract(ln.pathOffset).transform(ln.calcOwnMatrix());
    const diff = newAnchorInParent.subtract(anchorInParent);
    ln.left -= diff.x;
    ln.top -= diff.y;
    ln.setCoords();
    ln.fire('modifyLine');
    if (ln.canvas) ln.canvas.requestRenderAll();
  };

  const endpointPos = (which) => function (dim, finalMatrix, fabricObject) {
    const px = which === 'start' ? fabricObject.x1 : fabricObject.x2;
    const py = which === 'start' ? fabricObject.y1 : fabricObject.y2;
    return pathSpaceToScreen(fabricObject, px, py);
  };
  const midPos = function (dim, finalMatrix, fabricObject) {
    return pathSpaceToScreen(fabricObject, fabricObject.cx, fabricObject.cy);
  };
  const endpointAction = (which) => function (eventData, transform, x, y) {
    const ln = transform.target;
    const anchorX = which === 'start' ? ln.x2 : ln.x1;
    const anchorY = which === 'start' ? ln.y2 : ln.y1;
    applyAnchored(ln, anchorX, anchorY, () => {
      const mouseLocal = fabric.util.sendPointToPlane(
        new fabric.Point(x, y), undefined, ln.calcOwnMatrix()
      );
      const newPx = mouseLocal.x + ln.pathOffset.x;
      const newPy = mouseLocal.y + ln.pathOffset.y;
      const oldMidX = (ln.x1 + ln.x2) / 2, oldMidY = (ln.y1 + ln.y2) / 2;
      if (which === 'start') { ln.x1 = newPx; ln.y1 = newPy; }
      else { ln.x2 = newPx; ln.y2 = newPy; }
      const newMidX = (ln.x1 + ln.x2) / 2, newMidY = (ln.y1 + ln.y2) / 2;
      ln.cx += (newMidX - oldMidX);
      ln.cy += (newMidY - oldMidY);
    });
    return true;
  };
  const midAction = function (eventData, transform, x, y) {
    const ln = transform.target;
    applyAnchored(ln, ln.x1, ln.y1, () => {
      const mouseLocal = fabric.util.sendPointToPlane(
        new fabric.Point(x, y), undefined, ln.calcOwnMatrix()
      );
      ln.cx = mouseLocal.x + ln.pathOffset.x;
      ln.cy = mouseLocal.y + ln.pathOffset.y;
    });
    return true;
  };

  line.controls = {
    p1: new fabric.Control({
      actionName: 'modifyLine',
      positionHandler: endpointPos('start'),
      actionHandler: endpointAction('start'),
      render: fabric.controlsUtils.renderCircleControl,
      cornerSize: 12
    }),
    p2: new fabric.Control({
      actionName: 'modifyLine',
      positionHandler: endpointPos('end'),
      actionHandler: endpointAction('end'),
      render: fabric.controlsUtils.renderCircleControl,
      cornerSize: 12
    }),
    pm: new fabric.Control({
      actionName: 'modifyLine',
      positionHandler: midPos,
      actionHandler: midAction,
      render: fabric.controlsUtils.renderCircleControl,
      cornerSize: 10
    })
  };
  line.hasRotatingPoint = false;
}

function textInStar(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  const outerRadius = Math.max(text.width, text.height) / 2 + 25;
  const innerRadius = outerRadius * 0.5;
  const points = [];

  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    points.push({
      x: outerRadius + radius * Math.cos(angle - Math.PI/2),
      y: outerRadius + radius * Math.sin(angle - Math.PI/2)
    });
  }

  const options = Object.assign({}, {
    points: points,
    fill: 'gold',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  const star = new fabric.Polygon(points, options);

  const group = new fabric.Group([star, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInStar", text: textStr };
  group.uid = semanticUid('star');
  return group;
}

function textInCloud(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'black'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  // Create cloud shape using multiple circles
  const baseWidth = text.width + 60;
  const baseHeight = text.height + 40;

  const circles = [
    new fabric.Circle({ radius: baseHeight/3, left: -baseWidth/4, top: 0 }),
    new fabric.Circle({ radius: baseHeight/2.5, left: -baseWidth/6, top: -baseHeight/4 }),
    new fabric.Circle({ radius: baseHeight/2, left: baseWidth/6, top: -baseHeight/3 }),
    new fabric.Circle({ radius: baseHeight/3, left: baseWidth/3, top: -baseHeight/6 }),
    new fabric.Circle({ radius: baseHeight/4, left: baseWidth/2, top: baseHeight/6 })
  ];

  const options = Object.assign({}, {
    fill: 'lightblue',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  circles.forEach(circle => {
    circle.fill = options.fill;
    circle.originX = 'center';
    circle.originY = 'center';
  });

  const group = new fabric.Group([...circles, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInCloud", text: textStr };
  group.uid = semanticUid('cloud');
  return group;
}

function addRectangle(opts){
    opts = opts || {}
    const rect = new fabric.Rect({
        left: 100,
        top: 100,
        fill: opts.fill || '',
        strokeWidth: 1,
        stroke: 'red',
        width: opts.width || 20,
        height: opts.height || 20
    });

    rect.uid = semanticUid('rect');
    pc.add(rect)
    pc.renderAll()
    return rect
}

function groupFabricObjects (objs, opts){
    if(!objs) return
    objs.forEach(o => { pc.remove(o) });

    const G = new fabric.Group(objs, {left: opts.left || 100, top: opts.top || 100 })
    pc.add(G);
    G.setCoords()
    pc.renderAll();

    return G
}

function arrow(x1, y1, x2, y2, opts) {
    const options = combined({}, { strokeWidth: 1.5, stroke: '#555', arrowSize: 8 }, opts);
    const line = new fabric.LineArrow([x1, y1, x2, y2], {
        stroke: options.stroke,
        strokeWidth: options.strokeWidth,
        fill: '',
        arrowSize: options.arrowSize,
        padding: 4,
        selectable: true
    });
    line.uid = (opts && opts.uid) || semanticUid('arrow');
    return line;
}

function bidirectionalArrow(x1, y1, x2, y2, opts) {
    const options = combined({}, { strokeWidth: 1.5, stroke: '#555', arrowSize: 8 }, opts);

    // Use a custom Line that renders arrowheads at both ends
    const line = new BiLineArrow([x1, y1, x2, y2], {
        stroke: options.stroke,
        strokeWidth: options.strokeWidth,
        fill: '',
        arrowSize: options.arrowSize,
        padding: 4,
        selectable: true
    });

    line.uid = (opts && opts.uid) || semanticUid('biarrow');
    return line;
}

// Bidirectional arrow: arrowheads at both ends
class BiLineArrow extends fabric.Line {
  static type = 'BiLineArrow';

  constructor(points, options) {
    const opts = Object.assign({ arrowSize: 8 }, options || {});
    super(points, opts);
    this.arrowSize = opts.arrowSize;
  }

  toObject(propertiesToInclude) {
    const obj = super.toObject(propertiesToInclude);
    obj.arrowSize = this.arrowSize;
    return obj;
  }

  _render(ctx) {
    super._render(ctx);
    if ((this.width === 0 && this.height === 0) || !this.visible) return;

    const xDiff = this.x2 - this.x1;
    const yDiff = this.y2 - this.y1;
    const angle = Math.atan2(yDiff, xDiff);
    const sz = this.arrowSize || 8;

    ctx.save();
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';

    // Arrowhead at end (x2,y2)
    ctx.translate((this.x2 - this.x1) / 2, (this.y2 - this.y1) / 2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, -sz * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, sz * 0.5);
    ctx.stroke();

    // Reset and draw arrowhead at start (x1,y1)
    ctx.rotate(-angle);
    ctx.translate(-(this.x2 - this.x1), -(this.y2 - this.y1));
    ctx.rotate(angle + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, -sz * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, sz * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  static fromObject(object) {
    return Promise.resolve(new BiLineArrow([object.x1, object.y1, object.x2, object.y2], object));
  }
}
fabric.BiLineArrow = BiLineArrow;
fabric.classRegistry.setClass(BiLineArrow);
fabric.classRegistry.setClass(BiLineArrow, 'BiLineArrow');

function text(text){
    const txt = new fabric.Text( text+"", {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    });
    txt.customData = {
      type: "text",
      text: text
    }

    return txt
}

/**
 * TODO: Support other shapes like rect, ellipse
 *
 **/
function arrayOfCircledTextsAt(x,y, canvas, opts){
    if(!arguments.length) console.log('arrayOfCircledTextsAt(x,y, canvas, opts)')

    recordScript(`arrayOfCircledTextsAt(${x}, ${y}, pc, ${JSON.stringify(opts)});`)
    let nextx = x, nexty = y;
    let addedObjects = []
    const options = Object.assign({},{ gapx: 3/2, gapy: 3/2 }, opts)
    const texts = []

    function Item(item){
        this.stopAnimation = false;
        this.stopRightNow = false;

        this.circle = item.item(0)
        this.all = item
        this.text = item.item(1)
        this.animating = false

        this.originalProps = { fill: item.item(0).fill, radius: item.item(0).radius}

        const me = this;
        this.animateCircleInLoop = function(x,y,z){

            me.circle.animate(x,y(), Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {
                    //callback code goes here
                    me.animateCircleInLoop(x,y,z)
                },
                abort: function(){
                    return me.stopAnimation;
                }
            },z));

            return me;
        } //end animateCircleInLoop

        this.animateCircle = function(x,y,z){
            const secArg = typeof(y) == 'function' ? y() : y

            me.circle.animate(x, secArg, Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {

                }
            },z));

            return me;
        } //end animateCircle

        this.animate = function(x,y,z){
            const secArg = typeof(y) == 'function' ? y() : y

            item.animate(x, secArg, Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {}
            },z));
        }

        this.moveToPoint = function (x,y, opts){
            const options = Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {}
            },opts);

            item.animate('left',x, options);
            item.animate('top', y, options);
        }

        this.moveBy = function (fn, opts){
            const pxy = fn(this)
            this.moveToPoint(pxy[0], pxy[1], opts)
        }

        this.move = function(where, other, opts){
            const options = combined({}, { gap: 0, dx: 0, dy: 0}, opts)

            cases = ['toLeftOf', 'below', 'above', 'toRightOf']

            switch(cases.indexOf(where)){
                case 0 : this.moveToPoint(other.left - item.width - options.gap + options.dx, other.top + options.dy, opts)
                    break;
                case 1 : this.moveToPoint(other.left + options.dx, other.top + other.height + options.gap + options.dy, opts)
                    break;
                case 2 : this.moveToPoint(other.left + options.dx, other.top - item.height - options.gap + options.dy, opts)
                    break;
                case 3 : this.moveToPoint(other.left + other.width + options.gap + options.dx, other.top + options.dy, opts)
                    break;
            }
        }

        this.changeCircle = function(changes){
            this.circle.set(changes)
            canvas.renderAll();
        }

        this.stop = function(){
            me.stopAnimation = true; animating = false;

            me.changeCircle(me.originalProps)
        }

        this.stopRightNow = function(){ me.stopRightNow = true; }

        this.highlightByZooming = function(opts){
            const size = 'original';

            me.stopAnimation = false;

            let fn = null;
            fn = () => {
                me.animateCircle('radius',
                    (me.circle.radius == me.originalProps.radius ? '-=8' : '+=8'),
                    {
                        onComplete: ()=> fn(),
                        abort: () => me.stopAnimation
                    }
                )
            }

            fn();

            me.animating = true
            if(opts){
                me.changeCircle(opts)
            }
            return me
        }
        this.connections = []
        this.connectTo = function (other, opts){
            let line = null;

            var opts = opts || { dx:0, dy: 0 }
            const options = combined({
                fill: '',
                stroke: '#888',
                strokeWidth: 1.5,
                padding: 4
            }, opts);

            if(typeof other == 'function'){
                other = other(this)
            }

            if(!other.all){
                line = new fabric.Line([ this.all.left+this.all.width/2-5,this.all.top+this.all.height,
                    other[0], other[1] ], options);
            } else {
                line = new fabric.Line([ this.all.left+this.all.width/2-5,this.all.top+this.all.height,
                    other.all.left+other.all.width/2 + opts.dx, other.all.top-5 + opts.dy], options);
            }
            canvas.add(line)
            this.connections.push(line)
            return line
        }

        this.methods = function(){
            return [
                'connectTo', 'highlightByZooming(options e.g. { fill: \'green\'})', 'stop',
                'changeCircle(options)', 'animate(e.g. \'left\', \'+=10\', options)',
                'moveToPoint(x,y,opts)'
            ]
        }

        this.pos = function(){
            return {
                x: this.all.left,
                y: this.all.top,
                midx: this.all.left+ this.all.width/2,
                midy: this.all.top + this.all.height /2
            }
        }

    } //end Item

    this.adjust = function(){

        addedObjects.forEach(obj => obj.animate('top', '-='+obj.all.height/2));

        return this;
    }

    this.add = function(text){
        texts.push(text)
    }

    this.and = function(text){

    }

    this.swap =  function(x,y, opts1, opts2){
        opts1 = combined({},{dx: 0, dy: 0}, opts1)
        opts2 = combined({},{dx: 0, dy: 0}, opts2)

        const tmp = [this.at(x).all.left, this.at(x).all.top]
        this.at(x).moveToPoint(this.at(y).all.left + opts1.dx, this.at(y).all.top + opts1.dy)

        this.at(y).moveToPoint(tmp[0] + opts2.dx, tmp[1] + opts2.dy)
    }

    this.at = function(i){
        if(i < 0){ return addedObjects[addedObjects.length+i]; }
        return addedObjects[i-1]
    }

    this.reset = function(){
        nextx = x, nexty = y;
        addedObjects.forEach( v => canvas.remove(v.all) )
        addedObjects = []
    }

    this.normalize = function(){
        let max = 0;
        texts.forEach(t => {
            const txt = text(t);
            if(txt.width > max) max = txt.width;
        });
        const radius = options.radius || max

        this.reset();
        const specificSizes = options.specificSizes || {}

        texts.forEach((t,i )=> {
            const group = textInCircle(t, nextx,nexty, options, combined({ radius: specificSizes[i] || radius}, options));
            canvas.add(group);

            nextx = nextx + group.width*options.gapx
            addedObjects.push(new Item(group))
        });
    }

    this.methods = function(){
        return [
            'normalize',
            'reset', 'at(indx)', 'add(text)', 'adjust'
        ]
    }
}

window.itemRecordCounter = {'A': 0, '': 0}
window.itemRecord = {}

function showArray(items, x, y, canvas, opts){
    if(!arguments.length) console.log('showArray(items,x,y,canvas, opts)')

    recordScript(`showArray(${items}, ${x}, ${y}, pc, ${JSON.stringify(opts)});`)
    const arr = new arrayOfCircledTextsAt(x,y,canvas, opts)
    items.forEach(item => arr.add( item+''))
    arr.normalize()

    window.itemRecordCounter['A'] = window.itemRecordCounter['A']
    window.itemRecord['_AR_'+ window.itemRecordCounter['A']] = arr;
    return arr
}

function showMatrix(arryOfItems, x,y,canvas, opts){
    if(!arguments.length) console.log('showMatrix(arryOfItems, x,y,canvas, opts)')

    const rad = arryOfItems.reduce((a,b) => a.concat(b)).reduce( (mx,a) => Math.max(mx, text(a).width) )
    const options = Object.assign({}, { gapx: 3/2, gapy: 3/2, radius: rad}, opts)

    const matrix = []
    arryOfItems.forEach( items => {
        const arr = showArray(items,x,y, canvas, options)
        matrix.push(arr)
        y += arr.at(1).all.height*options.gapy
    });

    return matrix;
}


function fabricUpdate(canvas, obj, changes){
    obj.set(changes)
    canvas.renderAll()
}

function visualAlgoMethods(){
    return [
        'range(start, count)',
        'fabricUpdate(canvas, obj, changes)',
        'showMatrix(arryOfItems, x,y,canvas, opts)',
        'showArray(items,x,y,canvas, opts)',
        'textInRect(text, x,y, optsText, optsRect)'
    ]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function animate(obj, props, opts){
    if(!obj) return
    obj = findIfRequired(obj)

    const canvas = pc;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
    const objSpecificUpdate = obj?.onAnimationChange || (() => {});
    const options = Object.assign({}, {
        duration: 1000,
        onChange: () => { canvas.renderAll.bind(canvas); objSpecificUpdate(); canvas.renderAll(); },
        onComplete: function() {}
    }, opts);

    const fn = options.onComplete;

    return new Promise(function(myResolve) {
        options.onComplete = (e) => {
            fn(e);
            myResolve()
        }
        obj.animate(props, options);
    });
}

// Replay a recorded curved drag. `samples` is [{left, top, t}, ...] captured
// during object:moving. Segments animate at their captured pace unless
// `opts.duration` is given, in which case the whole path is rescaled to fit.
async function animatePath(uidOrObj, samples, opts) {
    if (!uidOrObj || !samples || samples.length < 2) return
    const obj = findIfRequired(uidOrObj)
    if (!obj) return
    opts = opts || {}
    const capturedTotal = Math.max(1, samples[samples.length - 1].t - samples[0].t)
    const scale = opts.duration ? opts.duration / capturedTotal : 1
    const onComplete = opts.onComplete
    const perStepOpts = {...opts}
    delete perStepOpts.onComplete
    delete perStepOpts.duration
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i]
        const dt = Math.max(1, (b.t - a.t) * scale)
        await animate(obj, {left: b.left, top: b.top}, {...perStepOpts, duration: dt})
    }
    if (onComplete) onComplete()
}

function centerOf(obj){
    return {
        x: obj.left + obj.width/2,
        y: obj.top + obj.height/2
    }
}

function positionTogether(first, second){
    return {
        ytop: second.top - first.height,
        ybottom: second.top + second.height,
        xleft: second.left - first.width,
        xright: second.left + second.width
    }
}

function appendTableInto(table, target, opts){
    const options = combined({}, {
        xtitle: '', ytitle: '',
        xheaders: [], yheaders: [],
        width: 100, height: 60,
        backgroundColor: 'white', color: 'white',
        xheaderColor: '#73738c',
        yheaderColor: '#73738c',
        id: `table-autogen-${new Date().getTime()}`
    }, opts)

    if(table.length === 0 && options.xheaders.length !== 0){
        table = range(0,options.yheaders.length).map(i => range(0, options.xheaders.length).map(j => ' '))
    }

    const css = `
.verticalTableHeader {
    text-align:center;
    white-space:nowrap;
    g-origin:50% 50%;
    -webkit-transform: rotate(90deg);
    -moz-transform: rotate(90deg);
    -ms-transform: rotate(90deg);
    -o-transform: rotate(90deg);
    transform: rotate(90deg);
    color: #8888c1;
    padding: 0;
    margin: 0;
    width: 53px;
	}
	.verticalTableHeader p {
	    margin:0 -100% ;
	    display:inline-block;
	}
	.verticalTableHeader p:before{
	    content:'';
	    width:0;
	    padding-top:110%;/* takes width as reference, + 10% for faking some extra padding */
	    display:inline-block;
	    vertical-align:middle;
	}

.data td::before {

}
	`;

    if(!$('#verticalTableHeader').length){
        $('body').append($('<style>').attr({id : 'verticalTableHeader'}).html(css))
    }


    const tableHtml = `<table id="${options.id}" style="position: absolute; " class="main-container">
  <tr>
    <td>
	  	<tr width="100%" style="color: blue; height: 20px;">
	      	<td></td>
	        <td colspan="${table[0].length}" style="padding: 5px; text-align: center" >
	        	${options.xtitle}
	        </td>
	      </tr>
	  </td>
  </tr>
  <tr>

 	<td class="verticalTableHeader">
 		<p>
	     ${options.ytitle}
	  </p>
 	</td>

    <td>
      <table class="data" border="1" style="border-collapse: collapse; width: 100%; margin-left: -15px; margin-top: 0px; text-align: center; height: 100%">

	      <tr>
	          <th style="text-align: center" ></th>
	          ${options.xheaders.map((x, col) => `<th style="text-align: center; color: blue" data-column="${col}" class="xheader"> <span class="item"> ${x}</span></th>`).join('')}
	      </tr>

	      ${range(0, table.length).map(row =>
        `<tr class="data"> <th style="text-align: center; color: #8888c1" data-row="${row}" class="yheader"> <span class="item"> ${options.yheaders[row]} </span></th>`
        + table[row].map((y,col) => `<td style="" data-row="${row}" data-column="${col}" data-value="${y}"> <span class="item"> ${y} </span></td>`).join('') +'</tr>'
    ).join('')}
    </table>
    </td>
  </tr>
</table>`

    table = $(tableHtml)
    $(target).append(table)

    table.find('table').css({ backgroundColor: options.backgroundColor, color: options.color })
    table.css({ backgroundColor: options.backgroundColor, color: options.color, width: options.width, height: options.height, position: 'absolute',
        left: options.left,
        top: options.top })

    table.draggable()
    table.resizable();

//  $(table).find("tr:nth(1)").remove()

    $(function() {
        const thHeight = table.find("th:first").height();
        table.find("th").resizable({
            handles: "e",
            minHeight: thHeight,
            maxHeight: thHeight,
            minWidth: 40,
            resize: function (event, ui) {
                const sizerID = "#" + $(event.target).attr("id") + "-sizer";
                $(sizerID).width(ui.size.width);
            }
        });
        table.find('td').resizable({
            handles: "s"
        });
    });

//	table.find('table.data').css(opts)
//	setTimeout(()=> table.find('.yheader').css({'padding-left': '4%','padding-right': '4%'}), 500);

    const each = fn => {
        for(let i = 0; i < opts.yheaders.length; i++) {
            for(let j = 0; j < opts.xheaders.length; j++) {
                const el = $($(table.find('tr.data')[i]).find('td')[j]);
                fn(i, j, el)
            }
        }
    }

    if(opts.cellClicked) {
        each( (i, j, el) => el.click(e => opts.cellClicked(i, j, el)) )
    }

    return {
        all: table,
        xheader: function(i){
            return $(table.find('th.xheader')[i-1])
        },
        yheader : function(i){
            return $(table.find('th.yheader')[i-1])
        },
        at : function(i,j){
            return $($(table.find('tr.data')[i-1]).find('td')[j-1])
        },
        each: function (fn) {
            each(fn)
        }
    }
}

/**
 * TODO: Make it work for both fabrics js and html
 * @param obj
 * @returns {*[]}
 */
function midOf(obj){
    const rect = {x: null, y: null,w: null, h: null}

    if(!obj.left) {
        try {
            const tl = $(obj).position();
            rect.x = tl.left; rect.y = tl.top;
        } catch(e){ console.log(e); }
    } else {
        rect.x = obj.left; rect.y = obj.top;
    }

    if(obj.width && (typeof obj.width != 'function')){
        rect.w = obj.width; rect.h = obj.height;
    } else {
        rect.w = obj.width(); rect.h = obj.height();
    }


    return [rect.x + rect.w/2, rect.y + rect.h/2]
}

function centerFirstToSecond(obj, obj2){
    const c2 = midOf(obj2);

    const rect = {x: null, y: null,w: null, h: null}

    if(!obj.left) {
        try {
            const tl = $(obj).position();
            rect.x = tl.left; rect.y = tl.top;
        } catch(e){ console.log(e); }
    } else {
        rect.x = obj.left; rect.y = obj.top;
    }

    if(obj.width && (typeof obj.width != 'function')){
        rect.w = obj.width; rect.h = obj.height;
    }
    else { rect.w = obj.width(); rect.h = obj.height();}

    return [c2[0] - rect.w/2, c2[1] - rect.h /2]
}

window.curry = fn => { // (1)

    const arity = fn.length; //(2) number of arguments fn expects
    return (...args) => { // (3)
        const firstArgs = args.length; // (4)
        if (firstArgs >= arity) { //correct number of arguments

            return fn(...args); // (5)
        } else {
            return (...secondArgs) => { // (6)

                return fn(...[...args, ...secondArgs]); // (7)
            }
        }
    }
}

window.Accordion = {
    createAll: function(className){
        const titles = [];
        $("."+ className +" .title").each((i,e) => titles.push(e))

        const clickHandler = (target) => {
            $(target).toggleClass('active');
            if($(target).hasClass('active')){
                $(target).next('.content').addClass('active')

                titles.filter( t => t != target).forEach(t => {
                    $(t).removeClass('active')
                    $(t).next('.content').removeClass('active')
                })
            } else {
                $(target).next('.content').removeClass('active')
            }
        };

        titles.forEach( (t,i) => $(t).click(e => clickHandler(t) ))
    }
}

function bounds(obj){

    const rect = {x: null, y: null,w: null, h: null, right: null, bottom: null}

    if(!obj.left) {
        try {
            const tl = $(obj).position();
            rect.x = tl.left; rect.y = tl.top;
        } catch(e){ console.log(e); }
    } else {
        rect.x = obj.left; rect.y = obj.top;
    }

    if(obj.width && (typeof obj.width != 'function')){
        rect.w = obj.width; rect.h = obj.height;
    } else {
        rect.w = obj.width(); rect.h = obj.height();
    }

    rect.right = rect.x + rect.w;
    rect.bottom = rect.y + rect.h;

    return rect;

}

/**
 * Connect using a line.
 * TODO: Make it sticky just like treeConnections
 * @param canvas
 * @param it
 * @param other
 * @param opts
 * @returns {*}
 */
function connect(canvas, it, other, opts){

    var line = null;

    var opts = opts || { dx:0, dy: 0 }
    const options = combined({
        stroke: '#555',
        strokeWidth: 1.5
    }, opts);

    if(typeof other == 'function'){
        other = other(this)
    }

    let x1,y1,x2,y2;
    const midx1 = it.left+it.width/2, midy1 = it.top+it.height/2, midx2 = other.left+other.width/2, midy2 = other.top + other.height/2
    if(other.left > it.left + it.width){
        x1 = it.left+it.width; x2 = other.left;
    } else if(other.left + other.width < it.left) {
        x1 = it.left; x2 = other.left+other.width;
    } else {
        x1 = midx1; x2 = midx2;
    }

    if(other.top > it.top + it.height){
        y1 = it.top + it.height; y2 = other.top;
    } else if(other.top + other.height < it.top) {
        y1 = it.top; y2 = other.top + other.height;
    } else {
        y1 = midy1; y2 = midy2;
    }

    var line = new fabric.LineArrow([x1, y1, x2, y2], {
        strokeWidth: 1.5,
        fill: '',
        stroke: '#555',
        padding: 4
    });

    attachLineEndpointControls(line);
    canvas.add(line)

    return line

}

// This function does the actual work
function matex(text, callback) {
    // Create a script element with the LaTeX code
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.left = "-1000px";
    document.body.appendChild(div);
    const se = document.createElement("script");
    se.setAttribute("type", "math/tex");
    se.innerHTML = text;
    div.appendChild(se);


    MathJax.Hub.Process(se, function() {
        // When processing is done, remove from the DOM
        // Wait some time before doing tht because MathJax calls this function before
        // actually displaying the output
        var display = function() {
            // Get the frame where the current Math is displayed
            const frame = document.getElementById(se.id + "-Frame");
            if(!frame) {
                setTimeout(display, 500);
                return;
            }

            // Load the SVG
            const svg = frame.getElementsByTagName("svg")[0];
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svg.setAttribute("version", "1.1");
            const height = svg.parentNode.offsetHeight;
            const width = svg.parentNode.offsetWidth;
            svg.setAttribute("height", height);
            svg.setAttribute("width", width);
            svg.removeAttribute("style");

            // Embed the global MathJAX elements to it
            const mathJaxGlobal = document.getElementById("MathJax_SVG_glyphs");
            svg.appendChild(mathJaxGlobal.cloneNode(true));

            // Create a data URL
            const svgSource = '<?xml version="1.0" encoding="UTF-8"?>' + "\n" + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + "\n" + svg.outerHTML;
            const retval = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgSource)));

            // Remove the temporary elements
            document.body.removeChild(div);

            // Invoke the user callback
            callback(retval, width, height);
        };
        setTimeout(display, 1000);
    });
}

const highlightByZooming = function(object, canvas, opts){
    // Pulse the object's scale up and down so it draws the eye. Uses
    // scaleX/scaleY (universal fabric.Object props) — the previous version
    // used zoomX/zoomY which only exist on fabric.Image and were undefined
    // for rect/ellipse/group/textbox, so the animation silently no-op'd.
    opts = opts || {};
    const me = object.externalData || {};
    me.stopAnimation = false;

    const origScaleX = object.scaleX != null ? object.scaleX : 1;
    const origScaleY = object.scaleY != null ? object.scaleY : 1;
    me.originalProps = me.originalProps || {};
    me.originalProps.scaleX = origScaleX;
    me.originalProps.scaleY = origScaleY;

    const factor = opts.factor || 1.18;
    const duration = opts.duration || 600;
    const targets = [
        { scaleX: origScaleX * factor, scaleY: origScaleY * factor },
        { scaleX: origScaleX,          scaleY: origScaleY          }
    ];

    let phase = 0;
    const tick = () => {
        if (me.stopAnimation || !object) return;
        const target = targets[phase];
        // fabric v6 only exposes the object form of animate; passing two
        // keys fans out into two animations, so onComplete fires twice. Wait
        // for both before advancing phase or we'd skip the rest cycle.
        const totalKeys = Object.keys(target).length;
        let done = 0;
        object.animate(target, {
            duration: duration,
            onChange: () => { canvas.renderAll(); },
            abort: () => !object || me.stopAnimation,
            onComplete: () => {
                if (++done < totalKeys) return;
                object.setCoords && object.setCoords();
                phase = (phase + 1) % targets.length;
                if (!me.stopAnimation) tick();
            }
        });
    };

    me.animating = true;
    tick();
    object.externalData = me;
    return me;
}

// ---- Spotlight effect ----------------------------------------------------
// A DOM/SVG overlay positioned over the lower fabric canvas. The veil fills
// the canvas with a translucent dark fill; one ellipse per target is masked
// out so the underlying object reads as "lit" while everything else dims.
// Animation = fade-in + a gentle veil pulse driven by CSS keyframes.

const _SPOTLIGHT_NS = 'http://www.w3.org/2000/svg';
const _SPOTLIGHT_STYLE_ID = 'spotlight-style';
const _SPOTLIGHT_OVERLAY_ID = 'spotlight-overlay';

function _spotlightInjectStyle() {
  if (document.getElementById(_SPOTLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = _SPOTLIGHT_STYLE_ID;
  style.textContent =
    '#' + _SPOTLIGHT_OVERLAY_ID + '{position:fixed;pointer-events:none;z-index:99998;opacity:0;transition:opacity .35s ease;}' +
    '#' + _SPOTLIGHT_OVERLAY_ID + '.on{opacity:1;}' +
    '#' + _SPOTLIGHT_OVERLAY_ID + ' .veil{animation:spotlightPulse 1.6s ease-in-out infinite;}' +
    '@keyframes spotlightPulse{0%,100%{fill-opacity:.62;}50%{fill-opacity:.82;}}';
  document.head.appendChild(style);
}

function _spotlightTargets(t) {
  return (t && t.type === 'activeSelection' && Array.isArray(t._objects))
    ? t._objects.slice()
    : [t];
}

function _spotlightWorldBox(obj, canvas) {
  // Compute bounding box on the lower canvas in pixel coords, accounting for
  // viewportTransform (so spotlight tracks pan/zoom).
  const ac = obj.aCoords || (typeof obj.calcACoords === 'function' ? obj.calcACoords() : null);
  if (!ac) return null;
  const corners = [ac.tl, ac.tr, ac.br, ac.bl];
  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const tx = corners.map(p => fabric.util.transformPoint({ x: p.x, y: p.y }, vpt));
  const xs = tx.map(p => p.x), ys = tx.map(p => p.y);
  return {
    minX: Math.min.apply(null, xs),
    maxX: Math.max.apply(null, xs),
    minY: Math.min.apply(null, ys),
    maxY: Math.max.apply(null, ys)
  };
}

function spotlight(uidOrObjOrList, opts) {
  opts = opts || {};
  const padding = opts.padding != null ? opts.padding : 30;

  // Resolve to a flat list of fabric objects (handles a single uid/object,
  // an array of uids/objects, and an activeSelection — flattened to its
  // children so per-child cutouts work in the same code path).
  const inputs = Array.isArray(uidOrObjOrList) ? uidOrObjOrList : [uidOrObjOrList];
  const targets = [];
  inputs.forEach(inp => {
    const obj = findIfRequired(inp);
    if (!obj || !isFabricObject(obj)) return;
    if (obj.type === 'activeSelection' && Array.isArray(obj._objects)) {
      obj._objects.forEach(c => targets.push(c));
    } else {
      targets.push(obj);
    }
  });
  if (!targets.length) return null;

  const canvas = targets[0].canvas || window.pc;
  if (!canvas) return null;

  _spotlightInjectStyle();

  const canvasEl = canvas.lowerCanvasEl || canvas.upperCanvasEl;
  const rect = canvasEl.getBoundingClientRect();
  const cssW = canvas.getWidth();
  const cssH = canvas.getHeight();

  let overlay = document.getElementById(_SPOTLIGHT_OVERLAY_ID);
  if (overlay) overlay.remove();
  overlay = document.createElementNS(_SPOTLIGHT_NS, 'svg');
  overlay.setAttribute('id', _SPOTLIGHT_OVERLAY_ID);
  // viewBox locks the SVG's internal coord system to canvas-internal units
  // so cx/cy values computed in fabric pixels land in the correct screen
  // spot regardless of any CSS scaling between fabric units and DOM size.
  overlay.setAttribute('viewBox', '0 0 ' + cssW + ' ' + cssH);
  overlay.setAttribute('preserveAspectRatio', 'none');
  overlay.setAttribute('width', rect.width);
  overlay.setAttribute('height', rect.height);
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  const defs = document.createElementNS(_SPOTLIGHT_NS, 'defs');
  const mask = document.createElementNS(_SPOTLIGHT_NS, 'mask');
  mask.setAttribute('id', 'spotlight-cutout');
  const maskBg = document.createElementNS(_SPOTLIGHT_NS, 'rect');
  maskBg.setAttribute('width', '100%');
  maskBg.setAttribute('height', '100%');
  maskBg.setAttribute('fill', 'white');
  mask.appendChild(maskBg);

  // Use the rendered AABB (post-viewportTransform) as both the size *and*
  // the position source. Its midpoint is the true visual centre — which
  // matches what the user sees — even for rotated objects, groups whose
  // origin point is offset, or shapes with strokes/shadows. This avoids
  // the upward-bias seen when using getCenterPoint() (the transform-origin
  // centre, not the visible centre).
  // Shape: 'circle' | 'rect' | 'auto' (default). Auto picks circle for
  // roughly-square bboxes and rect for elongated ones.
  const requestedShape = (opts.shape || 'auto') + '';
  const cornerRadius = opts.cornerRadius != null ? opts.cornerRadius : 12;
  targets.forEach(t => {
    if (!t || typeof t.getBoundingRect !== 'function') return;
    // absolute=false → coords are already viewport-transformed (canvas
    // pixel space, which the SVG viewBox is locked to).
    const br = t.getBoundingRect(false, true);
    if (!br || !br.width || !br.height) return;
    const w = br.width, h = br.height;
    const cx = br.left + w / 2;
    const cy = br.top  + h / 2;
    const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
    const shape = requestedShape === 'auto'
      ? (aspect < 1.4 ? 'circle' : 'rect')
      : requestedShape;
    if (shape === 'rect') {
      const r = document.createElementNS(_SPOTLIGHT_NS, 'rect');
      r.setAttribute('x', cx - w / 2 - padding);
      r.setAttribute('y', cy - h / 2 - padding);
      r.setAttribute('width',  w + padding * 2);
      r.setAttribute('height', h + padding * 2);
      r.setAttribute('rx', cornerRadius);
      r.setAttribute('ry', cornerRadius);
      r.setAttribute('fill', 'black');
      mask.appendChild(r);
    } else {
      // True circle, radius = half the longer side + padding, centred on
      // the AABB midpoint so the object sits dead centre.
      const radius = Math.max(w, h) / 2 + padding;
      const ell = document.createElementNS(_SPOTLIGHT_NS, 'circle');
      ell.setAttribute('cx', cx);
      ell.setAttribute('cy', cy);
      ell.setAttribute('r', radius);
      ell.setAttribute('fill', 'black');
      mask.appendChild(ell);
    }
  });
  defs.appendChild(mask);
  overlay.appendChild(defs);

  const veil = document.createElementNS(_SPOTLIGHT_NS, 'rect');
  veil.setAttribute('class', 'veil');
  veil.setAttribute('width', '100%');
  veil.setAttribute('height', '100%');
  veil.setAttribute('fill', opts.color || '#000');
  veil.setAttribute('mask', 'url(#spotlight-cutout)');
  overlay.appendChild(veil);

  document.body.appendChild(overlay);
  // Force layout, then add the .on class to trigger fade-in.
  overlay.getBoundingClientRect();
  overlay.classList.add('on');

  // Tag every target so stopSpotlight() can find any of them and tear down
  // the shared overlay. Use the same overlay/startedAt object so a single
  // entry in window.pc tracks the whole batch.
  const sharedState = { overlay: overlay, startedAt: Date.now() };
  targets.forEach(t => {
    t.externalData = t.externalData || {};
    t.externalData.spotlight = sharedState;
    t.externalData.spotlightActive = true;
    t.externalData.animating = true;
  });
  return sharedState;
}

function stopSpotlight(uidOrObjOrList) {
  // Accept array / activeSelection / single uid / single object.
  const candidates = [];
  const collect = (input) => {
    if (input == null) {
      if (!window.pc) return;
      window.pc.getObjects().forEach(o => {
        if (o.externalData && o.externalData.spotlightActive) candidates.push(o);
      });
      return;
    }
    const obj = findIfRequired(input);
    if (!obj) return;
    if (obj.type === 'activeSelection' && Array.isArray(obj._objects)) {
      obj._objects.forEach(c => {
        if (c.externalData && c.externalData.spotlightActive) candidates.push(c);
      });
    } else if (obj.externalData && obj.externalData.spotlightActive) {
      candidates.push(obj);
    }
  };
  if (Array.isArray(uidOrObjOrList)) uidOrObjOrList.forEach(collect);
  else collect(uidOrObjOrList);
  candidates.forEach(t => {
    const sp = t.externalData && t.externalData.spotlight;
    if (!sp) return;
    if (sp.overlay) {
      sp.overlay.classList.remove('on');
      const el = sp.overlay;
      setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400);
    }
    delete t.externalData.spotlight;
    t.externalData.spotlightActive = false;
    t.externalData.animating = false;
  });
  // Belt-and-braces: if we somehow lost the per-object reference, kill any
  // stray overlay still in the DOM.
  if (!candidates.length) {
    const stray = document.getElementById(_SPOTLIGHT_OVERLAY_ID);
    if (stray) stray.parentNode && stray.parentNode.removeChild(stray);
  }
}

// Unified entry point used by recordings and the Properties panel button.
// Accepts a single uid/object, an array, or an activeSelection — flattens
// to a list of fabric objects internally.
// type defaults to 'highlight' (highlightByZooming); 'spotlight' uses the
// SVG overlay defined above.
function _animResolveList(input) {
  const inputs = Array.isArray(input) ? input : [input];
  const list = [];
  inputs.forEach(inp => {
    const obj = findIfRequired(inp);
    if (!obj || !isFabricObject(obj)) return;
    if (obj.type === 'activeSelection' && Array.isArray(obj._objects)) {
      obj._objects.forEach(c => list.push(c));
    } else {
      list.push(obj);
    }
  });
  return list;
}

function anim(uidOrObjOrList, type, opts) {
  const list = _animResolveList(uidOrObjOrList);
  if (!list.length) return null;
  type = (type || 'highlight') + '';
  if (type === 'spotlight') return spotlight(list, opts);
  // Highlight: animate each object independently. Animating an
  // activeSelection's scale doesn't always render reliably across all
  // children in fabric v6, so we operate per-child.
  list.forEach(o => highlightByZooming(o, o.canvas || window.pc, opts));
  return list;
}

function stopAnim(uidOrObjOrList) {
  if (uidOrObjOrList == null) {
    // Stop everything.
    stopSpotlight();
    if (window.pc) {
      window.pc.getObjects().forEach(o => {
        if (o.externalData && o.externalData.animating) stopAnimation(o, window.pc);
      });
    }
    return;
  }
  const list = _animResolveList(uidOrObjOrList);
  if (!list.length) return;
  // One stopSpotlight call drops the shared overlay for every spotlit
  // object in the list.
  stopSpotlight(list);
  list.forEach(obj => {
    if (obj.externalData && obj.externalData.animating) {
      stopAnimation(obj, obj.canvas || window.pc);
    }
  });
}

function stopAnimation(object, canvas){

    if(object.externalData) {
        const me = object.externalData
        me.stopAnimation = true;
        if(!me.animating) return null;

        const orig = me.originalProps || {};
        if (orig.scaleX != null) object.scaleX = orig.scaleX;
        if (orig.scaleY != null) object.scaleY = orig.scaleY;
        // Legacy zoom props (in case some older recordings still set them).
        if (orig.zoomX != null) object.zoomX = orig.zoomX;
        if (orig.zoomY != null) object.zoomY = orig.zoomY;
        object.setCoords && object.setCoords();

        canvas.renderAll()
        me.animating = false;
        return me;
    }
    return null
}

function makeLine(coords, opts) {
    opts = Object.assign({}, {stroke: '#888', strokeWidth: 1.5}, opts);
    return new fabric.Line(coords, {
        fill: '',
        stroke: opts.stroke,
        strokeWidth: opts.strokeWidth,
        selectable: false,
        evented: false,
        padding: 4
    });
}

function hide() {
  const items = Array.prototype.slice.apply(arguments);
  items.forEach(it => {
    if (it instanceof fabric.Object) {
      it.set({ opacity: 0 });
      update();
    } else if (it instanceof jQuery) {
      it.hide()
    }
  });
}

function Clone(object, id, top, left) {
  return object.clone().then(function (clone) {
    pc.add(clone.set({
      left: left || (object.left + 1),
      top: top || (object.top + 1)
    }));
    update();
    if (window._ && id) _[id] = clone;
    return clone;
  });
}

function waitUntil(condition) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval)
        resolve()
      }
    }, 100)
  })
}

function type(strings, elSelector, opts) {
  const options = Object.assign({}, {
    strings: [strings].flat(),
    onComplete: (self) => {
    }
  }, opts);

  $(elSelector).css(options);

  $('#typed-strings').html("<p>" + strings + "</p>");
  $('#textillateContainer .typed-cursor').remove()

  const prettyLog = (x) => console.log(x);

  $(elSelector).html('');

  return new Promise((myResolve) => {
    const typed = new Typed(elSelector, {
      stringsElement: '#typed-strings',
      typeSpeed: 40,
      backSpeed: 0,
      backDelay: 500,
      startDelay: 1000,
      loop: false,
      onComplete: function (self) {
        // prettyLog('onCmplete ' + self); self.destroy();
        options.onComplete(self);
        myResolve(self);
      },
      onDestroy: function (self) {
        console.log("destroyed");
        myResolve(self);
      }

    });
  });//promise
}

//Accessor for matrix
function at(matrix, i, j) {
  return $(matrix.all.find(`table.data td[data-row='${i}']`)[j]);
}

