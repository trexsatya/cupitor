/**
 * whiteboard.tools.js - ToolManager, sticky notes, alignment guides, enhanced connectors
 */

// --- Tool Manager ---
class ToolManager {
  constructor() {
    this.activeTool = 'select';
    this.tools = {};
  }

  register(name, tool) {
    this.tools[name] = tool;
  }

  activate(name) {
    if (this.tools[this.activeTool] && this.tools[this.activeTool].deactivate) {
      this.tools[this.activeTool].deactivate();
    }
    this.activeTool = name;
    if (this.tools[name] && this.tools[name].activate) {
      this.tools[name].activate();
    }
    // Update toolbar UI
    document.querySelectorAll('.wb-tool').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector('.wb-tool[data-tool="' + name + '"]');
    if (activeBtn) activeBtn.classList.add('active');
  }

  getActive() {
    return this.activeTool;
  }
}

// --- Sticky Notes ---
const STICKY_COLORS = {
  yellow: '#FFEB3B',
  pink: '#F48FB1',
  blue: '#81D4FA',
  green: '#A5D6A7',
  orange: '#FFCC80',
  purple: '#CE93D8'
};

function createStickyNote(x, y, options) {
  const opts = Object.assign({
    width: 200,
    height: 200,
    fill: STICKY_COLORS.yellow,
    text: '',
    fontSize: 16
  }, options);

  const rect = new fabric.Rect({
    width: opts.width,
    height: opts.height,
    fill: opts.fill,
    rx: 4,
    ry: 4,
    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.2)', blur: 8, offsetX: 2, offsetY: 2 }),
    originX: 'center',
    originY: 'center'
  });

  const textbox = new fabric.Textbox(opts.text, {
    width: opts.width - 20,
    fontSize: opts.fontSize,
    originX: 'center',
    originY: 'center',
    textAlign: 'left',
    fill: '#333',
    fontFamily: 'Arial, sans-serif',
    editable: false // editing handled via double-click ungroup
  });

  const group = new fabric.Group([rect, textbox], {
    left: x,
    top: y,
    subTargetCheck: true
  });

  group.uid = typeof semanticUid === 'function'
    ? semanticUid('stickynote')
    : (typeof uuid === 'function' ? uuid() : Math.random().toString(36).slice(2));
  group.customData = { type: 'stickyNote', color: opts.fill };

  return group;
}

function enableStickyNoteEditing(canvas) {
  canvas.on('mouse:dblclick', function(e) {
    // With subTargetCheck:true on the sticky group, fabric may set
    // e.target to a child instead of the group. Walk up to find the
    // sticky-note group.
    let target = e.target;
    while (target && (!target.customData || target.customData.type !== 'stickyNote')) {
      target = target.group;
    }
    if (!target) return;
    _showStickyTextEditor(canvas, target);
  });
}

// Floating HTML <textarea> overlaid on top of the sticky note. We avoid
// ungroup-and-edit-in-fabric because fabric v6's group-child transforms
// don't cleanly survive being re-added to the canvas — children retain
// group-relative coords and end up far off / invisible. An HTML editor
// sidesteps that entirely. On commit we route the new text through
// `setText(uid, …)` so the existing replay path (and recording) is reused.
function _showStickyTextEditor(canvas, group) {
  if (!group || typeof group.getObjects !== 'function') return;
  const inner = group.getObjects().find(o =>
    o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  if (!inner) return;

  // Tear down any prior editor (rapid double-clicks).
  const existing = document.getElementById('_sticky-html-editor');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const c = group.getCenterPoint();
  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const screen = fabric.util.transformPoint({ x: c.x, y: c.y }, vpt);
  const canvasEl = canvas.lowerCanvasEl || canvas.upperCanvasEl;
  const rect = canvasEl.getBoundingClientRect();
  const w = group.width * group.scaleX * Math.abs(vpt[0]);
  const h = group.height * group.scaleY * Math.abs(vpt[3]);
  const inset = 10;

  const ta = document.createElement('textarea');
  ta.id = '_sticky-html-editor';
  ta.value = inner.text || '';
  ta.style.position = 'fixed';
  ta.style.left  = (rect.left + screen.x - w / 2 + inset) + 'px';
  ta.style.top   = (rect.top  + screen.y - h / 2 + inset) + 'px';
  ta.style.width  = Math.max(20, w - inset * 2) + 'px';
  ta.style.height = Math.max(20, h - inset * 2) + 'px';
  ta.style.background = 'transparent';
  ta.style.color = inner.fill || '#333';
  ta.style.fontSize = (inner.fontSize || 16) + 'px';
  ta.style.fontFamily = inner.fontFamily || 'Arial, sans-serif';
  ta.style.fontWeight = inner.fontWeight || 'normal';
  ta.style.fontStyle = inner.fontStyle || 'normal';
  ta.style.textAlign = inner.textAlign || 'left';
  ta.style.border = '2px solid #1976D2';
  ta.style.borderRadius = '4px';
  ta.style.padding = '2px 4px';
  ta.style.boxSizing = 'border-box';
  ta.style.zIndex = '999999';
  ta.style.resize = 'none';
  ta.style.outline = 'none';
  ta.style.lineHeight = '1.2';

  // Hide the inner textbox while editing so the overlay isn't doubled up.
  const prevVisible = inner.visible;
  inner.visible = false;
  group.dirty = true;
  canvas.requestRenderAll();

  document.body.appendChild(ta);
  // Defer focus so the dblclick's own focus shifts don't immediately blur it.
  setTimeout(() => { ta.focus(); ta.select(); }, 0);

  let done = false;
  const cleanup = (commit) => {
    if (done) return;
    done = true;
    inner.visible = prevVisible;
    if (commit) {
      const newText = ta.value;
      if (newText !== inner.text) {
        inner.set({ text: newText });
        group.dirty = true;
        if (typeof recordScript === 'function') {
          recordScript('setText(' + JSON.stringify(group.uid) + ', ' + JSON.stringify(newText) + ')');
        }
      }
    }
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    canvas.requestRenderAll();
  };

  ta.addEventListener('blur', () => cleanup(true));
  // Keep keystrokes inside the textarea: the page wires several document-
  // and window-level keydown handlers (undo/redo, Ctrl+A, Delete, space
  // for canvas pan, etc.). Without stopPropagation, typing 'a' or 'z' or
  // hitting Backspace/Delete in the editor would also fire those canvas
  // shortcuts. We still let Escape run our cancel before stopping it.
  ta.addEventListener('keydown', (ke) => {
    ke.stopPropagation();
    if (ke.key === 'Escape') {
      ke.preventDefault();
      cleanup(false);
    }
  });
  ta.addEventListener('keyup',    (ke) => ke.stopPropagation());
  ta.addEventListener('keypress', (ke) => ke.stopPropagation());
}

// --- Alignment Guides ---
class AlignmentGuideManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = true;
    this.threshold = 5;
    this.guideLines = [];
  }

  clearGuides() {
    this.guideLines.forEach(l => this.canvas.remove(l));
    this.guideLines = [];
  }

  showGuide(orientation, position) {
    const w = 6000;
    let line;
    if (orientation === 'horizontal') {
      line = new fabric.Line([-w, position, w, position], {
        stroke: '#F44336', strokeWidth: 0.5, strokeDashArray: [5, 5],
        selectable: false, evented: false, excludeFromExport: true
      });
    } else {
      line = new fabric.Line([position, -w, position, w], {
        stroke: '#F44336', strokeWidth: 0.5, strokeDashArray: [5, 5],
        selectable: false, evented: false, excludeFromExport: true
      });
    }
    this.guideLines.push(line);
    this.canvas.add(line);
  }

  checkAlignment(target) {
    if (!this.enabled) return;
    this.clearGuides();
    const allObjects = this.canvas.getObjects().filter(o =>
      o !== target && !o.excludeFromExport && o.selectable !== false
    );
    const targetCenter = target.getCenterPoint();
    const targetBound = target.getBoundingRect();

    allObjects.forEach(obj => {
      const objCenter = obj.getCenterPoint();
      const objBound = obj.getBoundingRect();

      // Horizontal center alignment
      if (Math.abs(targetCenter.y - objCenter.y) < this.threshold) {
        target.set({ top: objCenter.y - (targetBound.height / 2) });
        this.showGuide('horizontal', objCenter.y);
      }
      // Vertical center alignment
      if (Math.abs(targetCenter.x - objCenter.x) < this.threshold) {
        target.set({ left: objCenter.x - (targetBound.width / 2) });
        this.showGuide('vertical', objCenter.x);
      }
      // Top edge alignment
      if (Math.abs(targetBound.top - objBound.top) < this.threshold) {
        target.set({ top: objBound.top });
        this.showGuide('horizontal', objBound.top);
      }
      // Bottom edge alignment
      if (Math.abs(targetBound.top + targetBound.height - (objBound.top + objBound.height)) < this.threshold) {
        target.set({ top: objBound.top + objBound.height - targetBound.height });
        this.showGuide('horizontal', objBound.top + objBound.height);
      }
      // Left edge alignment
      if (Math.abs(targetBound.left - objBound.left) < this.threshold) {
        target.set({ left: objBound.left });
        this.showGuide('vertical', objBound.left);
      }
      // Right edge alignment
      if (Math.abs(targetBound.left + targetBound.width - (objBound.left + objBound.width)) < this.threshold) {
        target.set({ left: objBound.left + objBound.width - targetBound.width });
        this.showGuide('vertical', objBound.left + objBound.width);
      }
    });
  }
}

function initAlignmentGuides(canvas) {
  const guideManager = new AlignmentGuideManager(canvas);
  canvas.on('object:moving', function(e) {
    guideManager.checkAlignment(e.target);
  });
  canvas.on('object:modified', function() {
    guideManager.clearGuides();
  });
  canvas.on('before:transform', function() {
    guideManager.clearGuides();
  });
  return guideManager;
}

// --- Shape Drawing Tools ---
function initShapeDrawingTool(canvas, toolManager) {
  let isDrawingShape = false;
  let shapeStartPoint = null;
  let currentShape = null;

  const SHAPE_TOOLS = ['rect', 'circle', 'diamond', 'quad', 'line'];

  canvas.on('mouse:down', function(e) {
    const tool = toolManager.getActive();
    if (!SHAPE_TOOLS.includes(tool)) return;
    if (e.target) return; // clicked on an existing object

    isDrawingShape = true;
    const pointer = canvas.getPointer(e.e);
    shapeStartPoint = { x: pointer.x, y: pointer.y };

    if (tool === 'rect') {
      currentShape = new fabric.Rect({
        left: pointer.x, top: pointer.y, width: 0, height: 0,
        fill: 'transparent', stroke: '#333', strokeWidth: 2
      });
    } else if (tool === 'circle') {
      currentShape = new fabric.Ellipse({
        left: pointer.x, top: pointer.y, rx: 0, ry: 0,
        fill: 'transparent', stroke: '#333', strokeWidth: 2
      });
    } else if (tool === 'diamond') {
      currentShape = new fabric.Rect({
        left: pointer.x, top: pointer.y, width: 0, height: 0,
        fill: 'transparent', stroke: '#333', strokeWidth: 2, angle: 45
      });
    } else if (tool === 'quad') {
      currentShape = new fabric.Polygon(
        [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],
        {
          left: pointer.x, top: pointer.y,
          fill: 'rgba(100, 150, 220, 0.35)',
          stroke: '#1976D2', strokeWidth: 2,
          objectCaching: false
        }
      );
    } else if (tool === 'line') {
      currentShape = new fabric.CurvableLine(
        [pointer.x, pointer.y, pointer.x, pointer.y],
        { stroke: '#333', strokeWidth: 2, strokeLineCap: 'round',
          selectable: false, evented: false }
      );
    }

    if (currentShape) {
      canvas.add(currentShape);
      canvas.requestRenderAll();
    }
  });

  canvas.on('mouse:move', function(e) {
    if (!isDrawingShape || !currentShape || !shapeStartPoint) return;
    const pointer = canvas.getPointer(e.e);
    const tool = toolManager.getActive();

    if (tool === 'rect' || tool === 'diamond') {
      const w = Math.abs(pointer.x - shapeStartPoint.x);
      const h = Math.abs(pointer.y - shapeStartPoint.y);
      currentShape.set({
        left: Math.min(pointer.x, shapeStartPoint.x),
        top: Math.min(pointer.y, shapeStartPoint.y),
        width: w, height: h
      });
    } else if (tool === 'circle') {
      const rx = Math.abs(pointer.x - shapeStartPoint.x) / 2;
      const ry = Math.abs(pointer.y - shapeStartPoint.y) / 2;
      currentShape.set({
        left: Math.min(pointer.x, shapeStartPoint.x),
        top: Math.min(pointer.y, shapeStartPoint.y),
        rx: rx, ry: ry
      });
    } else if (tool === 'quad') {
      const w = Math.abs(pointer.x - shapeStartPoint.x);
      const h = Math.abs(pointer.y - shapeStartPoint.y);
      currentShape.set({
        left: Math.min(pointer.x, shapeStartPoint.x),
        top: Math.min(pointer.y, shapeStartPoint.y),
        points: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h }
        ],
        width: w,
        height: h,
        pathOffset: { x: w / 2, y: h / 2 },
        dirty: true
      });
    } else if (tool === 'line') {
      // During the initial drag the curve is straight; keep cx/cy at midpoint.
      currentShape.x2 = pointer.x;
      currentShape.y2 = pointer.y;
      currentShape.cx = (currentShape.x1 + currentShape.x2) / 2;
      currentShape.cy = (currentShape.y1 + currentShape.y2) / 2;
      currentShape.rebuild();
    }
    canvas.requestRenderAll();
  });

  canvas.on('mouse:up', function() {
    if (!isDrawingShape) return;
    isDrawingShape = false;
    const tool = toolManager.getActive();
    if (!SHAPE_TOOLS.includes(tool)) {
      // Tool switched mid-draw (e.g. Escape pressed while dragging) — discard shape
      if (currentShape) { canvas.remove(currentShape); currentShape = null; }
      shapeStartPoint = null;
      return;
    }
    if (currentShape) {
      currentShape.setCoords();
      const isQuad = tool === 'quad';
      const isLine = tool === 'line';
      const tooSmall = isLine
        ? (Math.hypot(currentShape.x2 - currentShape.x1, currentShape.y2 - currentShape.y1) < 5)
        : isQuad
        ? ((currentShape.width || 0) < 5 && (currentShape.height || 0) < 5)
        : ((currentShape.width || 0) < 5 && (currentShape.height || 0) < 5 && (currentShape.rx || 0) < 5);
      if (tooSmall) {
        canvas.remove(currentShape);
        currentShape = null;
      } else {
        currentShape.selectable = true;
        currentShape.evented = true;
        let labelText = null;
        const r2 = n => Math.round(n * 100) / 100;
        if (isLine && typeof recordScript === 'function') {
          const c = currentShape;
          const opts = {
            uid: c.uid, // already assigned by canvas add hook
            stroke: c.stroke, strokeWidth: c.strokeWidth, strokeLineCap: c.strokeLineCap,
            cx: r2(c.cx), cy: r2(c.cy)
          };
          recordScript(
            `addLine([${r2(c.x1)},${r2(c.y1)},${r2(c.x2)},${r2(c.y2)}],${JSON.stringify(opts)})`
          );
        } else if ((tool === 'rect' || tool === 'diamond') && typeof recordScript === 'function') {
          const c = currentShape;
          const opts = { uid: c.uid, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth };
          const fn = tool === 'diamond' ? 'addDiamond' : 'addRect';
          recordScript(
            `${fn}(${r2(c.left)},${r2(c.top)},${r2(c.width)},${r2(c.height)},${JSON.stringify(opts)})`
          );
        } else if (tool === 'circle' && typeof recordScript === 'function') {
          const c = currentShape;
          const opts = { uid: c.uid, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth };
          recordScript(
            `addEllipse(${r2(c.left)},${r2(c.top)},${r2(c.rx)},${r2(c.ry)},${JSON.stringify(opts)})`
          );
        }
        if (isQuad) {
          // Empty label by default; user double-clicks the quad to edit it.
          labelText = new fabric.IText('', {
            fontSize: 18, fill: '#111',
            originX: 'center', originY: 'center',
            selectable: false, evented: false,
            hasControls: false, hasBorders: false,
            lockMovementX: true, lockMovementY: true,
            editable: true
          });
          canvas.add(labelText);
          attachQuadBehavior(currentShape, labelText);
          currentShape.uid = semanticUid('quad');
          currentShape.customData = { type: 'textInQuad', text: '' };
          // Record creation so export/replay reproduces the quad. The tilt is
          // captured separately via object:modified → reshapeQuad.
          if (typeof recordScript === 'function') {
            const L = currentShape.left, T = currentShape.top;
            const W = currentShape.width, H = currentShape.height;
            const uid = currentShape.uid;
            recordScript(
              `{const r=textInQuad('',${L},${T},${W},${H});r.quad.uid=${JSON.stringify(uid)};pc.add(r.quad);pc.add(r.text);}`
            );
          }
        }
        if (window.undoManager) {
          if (labelText) {
            const shapeRef = currentShape;
            window.undoManager.push({
              redo() { canvas.add(shapeRef); canvas.add(labelText); canvas.requestRenderAll(); },
              undo() { canvas.remove(shapeRef); canvas.remove(labelText); canvas.requestRenderAll(); }
            });
          } else {
            window.undoManager.push(Commands.addObject(canvas, currentShape));
          }
        }
        const drawnShape = currentShape;
        currentShape = null;
        // Switch to select and activate the newly drawn shape
        if (window.toolManager) window.toolManager.activate('select');
        canvas.setActiveObject(drawnShape);
        canvas.requestRenderAll();
      }
    }
    shapeStartPoint = null;
  });
}

// --- Tool Registration ---
function registerTools(toolManager, primaryCanvas, overlayCanvas) {
  toolManager.register('select', {
    activate() {
      primaryCanvas.isDrawingMode = false;
      primaryCanvas.selection = true;
      primaryCanvas.defaultCursor = 'default';
      primaryCanvas.forEachObject(o => { o.selectable = true; o.evented = true; o.setCoords(); });
      primaryCanvas.requestRenderAll();
    },
    deactivate() {}
  });

  toolManager.register('hand', {
    activate() {
      primaryCanvas.isDrawingMode = false;
      primaryCanvas.selection = false;
      primaryCanvas.defaultCursor = 'grab';
      primaryCanvas.forEachObject(o => { o.selectable = false; o.evented = false; });
    },
    deactivate() {
      primaryCanvas.forEachObject(o => { o.selectable = true; o.evented = true; });
    }
  });

  toolManager.register('pen', {
    activate() {
      moveToFront('oc');
      overlayCanvas.isDrawingMode = true;
      if (overlayCanvas.freeDrawingBrush) {
        overlayCanvas.freeDrawingBrush.width = parseInt($('#drawing-line-width').val()) || 3;
        overlayCanvas.freeDrawingBrush.color = $('#drawing-color').val() || '#000';
      }
      // Store reference for layer checking
      window._penToolActive = true;
    },
    deactivate() {
      overlayCanvas.isDrawingMode = false;
      moveToFront('pc');
      window._penToolActive = false;
    }
  });

  toolManager.register('text', {
    activate() {
      primaryCanvas.defaultCursor = 'text';
      window.insertText = true;
    },
    deactivate() {
      primaryCanvas.defaultCursor = 'default';
      window.insertText = false;
    }
  });

  toolManager.register('sticky', {
    activate() {
      primaryCanvas.defaultCursor = 'crosshair';
      window._insertStickyNote = true;
    },
    deactivate() {
      primaryCanvas.defaultCursor = 'default';
      window._insertStickyNote = false;
    }
  });

  toolManager.register('connector', {
    activate() {
      flipConnectionMode();
    },
    deactivate() {
      if (window.connectionMode) flipConnectionMode();
    }
  });

  toolManager.register('eraser', {
    activate() {
      primaryCanvas.defaultCursor = 'crosshair';
      window._eraserMode = true;
    },
    deactivate() {
      primaryCanvas.defaultCursor = 'default';
      window._eraserMode = false;
    }
  });

  // Shape tools
  ['rect', 'circle', 'diamond', 'quad', 'line'].forEach(shape => {
    toolManager.register(shape, {
      activate() {
        primaryCanvas.isDrawingMode = false;
        primaryCanvas.selection = false;
        primaryCanvas.defaultCursor = 'crosshair';
      },
      deactivate() {
        primaryCanvas.selection = true;
        primaryCanvas.defaultCursor = 'default';
      }
    });
  });
}

// --- Shape Text Label Manager ---
class ShapeTextManager {
  constructor(canvas) {
    this.canvas = canvas;
    // Map<shapeUid, fabric.Textbox[]>
    this._labels = new Map();
  }

  // Returns {left, top} (world coords) for the label origin (center of label)
  getLabelPosition(shape, position) {
    const coords = shape.calcACoords(); // {tl, tr, bl, br} as Point objects
    const tl = coords.tl, tr = coords.tr, bl = coords.bl, br = coords.br;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const norm = (dx, dy) => {
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: dx / len, y: dy / len };
    };

    // Key reference points
    const n = mid(tl, tr);
    const s = mid(bl, br);
    const e = mid(tr, br);
    const w = mid(tl, bl);
    const center = shape.getCenterPoint();

    const INSIDE_MARGIN = 14; // px inset from corner toward center
    const OUTSIDE_OFFSET = 20; // px beyond edge

    // Direction from edge/corner toward center (for inset)
    const insetDir = (pt) => {
      const dx = center.x - pt.x, dy = center.y - pt.y;
      return norm(dx, dy);
    };
    const offsetPt = (pt, dir, dist) => ({ x: pt.x + dir.x * dist, y: pt.y + dir.y * dist });

    switch (position) {
      // --- Inside ---
      case 'inside-center': return { x: center.x, y: center.y };
      case 'inside-n':  return offsetPt(n,  insetDir(n),  INSIDE_MARGIN);
      case 'inside-s':  return offsetPt(s,  insetDir(s),  INSIDE_MARGIN);
      case 'inside-e':  return offsetPt(e,  insetDir(e),  INSIDE_MARGIN);
      case 'inside-w':  return offsetPt(w,  insetDir(w),  INSIDE_MARGIN);
      case 'inside-nw': return offsetPt(tl, insetDir(tl), INSIDE_MARGIN);
      case 'inside-ne': return offsetPt(tr, insetDir(tr), INSIDE_MARGIN);
      case 'inside-sw': return offsetPt(bl, insetDir(bl), INSIDE_MARGIN);
      case 'inside-se': return offsetPt(br, insetDir(br), INSIDE_MARGIN);
      // --- Outside ---
      case 'outside-n':  return offsetPt(n,  norm(n.x  - center.x, n.y  - center.y), OUTSIDE_OFFSET);
      case 'outside-s':  return offsetPt(s,  norm(s.x  - center.x, s.y  - center.y), OUTSIDE_OFFSET);
      case 'outside-e':  return offsetPt(e,  norm(e.x  - center.x, e.y  - center.y), OUTSIDE_OFFSET);
      case 'outside-w':  return offsetPt(w,  norm(w.x  - center.x, w.y  - center.y), OUTSIDE_OFFSET);
      case 'outside-nw': return offsetPt(tl, norm(tl.x - center.x, tl.y - center.y), OUTSIDE_OFFSET);
      case 'outside-ne': return offsetPt(tr, norm(tr.x - center.x, tr.y - center.y), OUTSIDE_OFFSET);
      case 'outside-sw': return offsetPt(bl, norm(bl.x - center.x, bl.y - center.y), OUTSIDE_OFFSET);
      case 'outside-se': return offsetPt(br, norm(br.x - center.x, br.y - center.y), OUTSIDE_OFFSET);
      default: return { x: center.x, y: center.y };
    }
  }

  addLabel(shape, position, text, style) {
    const pos = this.getLabelPosition(shape, position);
    const isOutside = position.startsWith('outside-');
    const opts = Object.assign({
      fontSize: 13,
      fill: '#222',
      fontWeight: 'normal',
      fontStyle: 'normal',
      fontFamily: 'Arial, sans-serif',
    }, style);
    const labelText = text || 'Label';
    const label = new fabric.Textbox(labelText, {
      left: pos.x,
      top: pos.y,
      originX: 'center',
      originY: 'center',
      fontSize: opts.fontSize,
      fontFamily: opts.fontFamily,
      fill: opts.fill,
      fontWeight: opts.fontWeight,
      fontStyle: opts.fontStyle,
      textAlign: 'center',
      width: 80,
      editable: true,
      selectable: true,
      backgroundColor: isOutside ? 'rgba(255,255,255,0.85)' : '',
      padding: 2
    });
    // Use a semantic uid (T<n>) so script recordings — including the global
    // text:editing:exited setText handler — reference a stable, replay-safe id.
    label.uid = (style && style.uid)
      || (typeof semanticUid === 'function' ? semanticUid('textbox')
          : (typeof uuid === 'function' ? uuid() : Math.random().toString(36).slice(2)));
    label.customData = { type: 'shapeLabel', shapeUid: shape.uid, position };

    if (!this._labels.has(shape.uid)) this._labels.set(shape.uid, []);
    this._labels.get(shape.uid).push(label);
    this.canvas.add(label);
    this.canvas.setActiveObject(label);
    this.canvas.requestRenderAll();

    if (typeof recordScript === 'function') {
      const recOpts = Object.assign({}, style || {}, { uid: label.uid });
      recordScript(
        `addShapeLabel(${JSON.stringify(shape.uid)},${JSON.stringify(position)},${JSON.stringify(labelText)},${JSON.stringify(recOpts)})`
      );
    }
    return label;
  }

  updateLabels(shape) {
    if (!shape || !shape.uid) return;
    const labels = this._labels.get(shape.uid);
    if (!labels || !labels.length) return;
    labels.forEach(label => {
      const position = label.customData && label.customData.position;
      if (!position) return;
      const pos = this.getLabelPosition(shape, position);
      label.set({ left: pos.x, top: pos.y });
      label.setCoords();
    });
    this.canvas.requestRenderAll();
  }

  removeLabels(shape) {
    if (!shape || !shape.uid) return;
    const labels = this._labels.get(shape.uid);
    if (!labels) return;
    labels.forEach(label => this.canvas.remove(label));
    this._labels.delete(shape.uid);
  }

  // Re-link labels to their shapes after canvas.loadFromJSON()
  rebuildIndex() {
    this._labels.clear();
    this.canvas.getObjects().forEach(obj => {
      if (obj.customData && obj.customData.type === 'shapeLabel') {
        const uid = obj.customData.shapeUid;
        if (!this._labels.has(uid)) this._labels.set(uid, []);
        this._labels.get(uid).push(obj);
      }
    });
  }

  attachToCanvas() {
    const canvas = this.canvas;
    const shapeTypes = ['rect', 'ellipse', 'polygon'];

    const isShape = (obj) =>
      obj && obj.customData && obj.customData.type !== 'shapeLabel' &&
      (shapeTypes.includes(obj.type) || (obj.customData && obj.customData.type !== 'stickyNote'));

    canvas.on('object:moving',   (e) => { if (isShape(e.target)) this.updateLabels(e.target); });
    canvas.on('object:scaling',  (e) => { if (isShape(e.target)) this.updateLabels(e.target); });
    canvas.on('object:rotating', (e) => { if (isShape(e.target)) this.updateLabels(e.target); });
    canvas.on('object:removed',  (e) => { this.removeLabels(e.target); });
  }
}

// --- Sticky note + eraser click handling ---
function initStickyAndEraserHandlers(canvas, toolManager, undoManager) {
  canvas.on('mouse:up', function(e) {
    // Only place a fresh sticky when the click landed on empty canvas. With
    // the tool sticky-active across clicks (rapid-placement UX), an
    // unguarded handler would also drop a duplicate every time the user
    // clicked or double-clicked an existing note to select/edit it.
    if (window._insertStickyNote && e.e && !e.target) {
      const pointer = canvas.getPointer(e.e);
      const x = pointer.x - 100, y = pointer.y - 100;
      const note = createStickyNote(x, y);
      canvas.add(note);
      if (undoManager) undoManager.push(Commands.addObject(canvas, note));
      if (typeof recordScript === 'function') {
        const r2 = n => Math.round(n * 100) / 100;
        // Capture the full creation state — paper colour, dimensions,
        // initial text, font props — so replay can reconstruct a
        // non-default-sized / pre-filled sticky exactly. Subsequent moves
        // and resizes are recorded via animate(), and customizations via
        // setStickyProp(), so this snapshot only needs to cover *initial*
        // properties.
        const innerKids = typeof note.getObjects === 'function' ? note.getObjects() : [];
        const innerRect = innerKids.find(o => o.type === 'rect');
        const innerText = innerKids.find(o => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
        const opts = {
          uid: note.uid,
          fill: (note.customData && note.customData.color) || (innerRect && innerRect.fill),
          width:  innerRect ? innerRect.width  : 200,
          height: innerRect ? innerRect.height : 200,
          text:     innerText ? (innerText.text || '') : '',
          fontSize: innerText ? innerText.fontSize : 16
        };
        recordScript(`addStickyNote(${r2(x)},${r2(y)},${JSON.stringify(opts)})`);
      }
      canvas.requestRenderAll();
      // Stay in sticky mode for rapid placement, user can switch tool when done
    }
    if (window._eraserMode && e.target) {
      if (undoManager) undoManager.push(Commands.removeObject(canvas, e.target));
      if (typeof recordScript === 'function' && e.target.uid) {
        recordScript(`pc.remove(findIfRequired(${JSON.stringify(e.target.uid)}))`);
      }
      canvas.remove(e.target);
      canvas.requestRenderAll();
    }
  });
}
