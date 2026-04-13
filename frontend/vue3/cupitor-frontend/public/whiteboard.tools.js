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

  group.uid = typeof uuid === 'function' ? uuid() : Math.random().toString(36).slice(2);
  group.customData = { type: 'stickyNote', color: opts.fill };

  return group;
}

function enableStickyNoteEditing(canvas) {
  canvas.on('mouse:dblclick', function(e) {
    const target = e.target;
    if (!target || !target.customData || target.customData.type !== 'stickyNote') return;

    // Find the textbox inside the group
    const objects = target.getObjects();
    const textObj = objects.find(o => o.type === 'textbox');
    if (!textObj) return;

    // Store group position
    const groupLeft = target.left;
    const groupTop = target.top;
    const groupWidth = target.width * target.scaleX;
    const groupHeight = target.height * target.scaleY;

    // Remove group, add individual items
    const rectObj = objects.find(o => o.type === 'rect');
    canvas.remove(target);

    rectObj.set({
      left: groupLeft,
      top: groupTop,
      width: groupWidth,
      height: groupHeight,
      selectable: false,
      evented: false
    });
    canvas.add(rectObj);

    textObj.set({
      left: groupLeft + 10,
      top: groupTop + 10,
      width: groupWidth - 20,
      editable: true,
      selectable: true
    });
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    textObj.enterEditing();

    // When editing ends, regroup
    const finishEditing = function() {
      textObj.exitEditing();
      canvas.remove(rectObj);
      canvas.remove(textObj);

      const newRect = new fabric.Rect({
        width: groupWidth,
        height: groupHeight,
        fill: target.customData.color,
        rx: 4,
        ry: 4,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.2)', blur: 8, offsetX: 2, offsetY: 2 }),
        originX: 'center',
        originY: 'center'
      });
      const newText = new fabric.Textbox(textObj.text, {
        width: groupWidth - 20,
        fontSize: textObj.fontSize,
        originX: 'center',
        originY: 'center',
        textAlign: 'left',
        fill: '#333',
        fontFamily: 'Arial, sans-serif',
        editable: false
      });
      const newGroup = new fabric.Group([newRect, newText], {
        left: groupLeft,
        top: groupTop,
        subTargetCheck: true
      });
      newGroup.uid = target.uid;
      newGroup.customData = target.customData;
      canvas.add(newGroup);
      canvas.setActiveObject(newGroup);
      canvas.requestRenderAll();

      textObj.off('editing:exited', finishEditing);
    };

    textObj.on('editing:exited', finishEditing);
    canvas.requestRenderAll();
  });
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

  canvas.on('mouse:down', function(e) {
    const tool = toolManager.getActive();
    if (tool !== 'rect' && tool !== 'circle' && tool !== 'diamond') return;
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
    }
    canvas.requestRenderAll();
  });

  canvas.on('mouse:up', function() {
    if (!isDrawingShape) return;
    isDrawingShape = false;
    const tool = toolManager.getActive();
    if (tool !== 'rect' && tool !== 'circle' && tool !== 'diamond') {
      // Tool switched mid-draw (e.g. Escape pressed while dragging) — discard shape
      if (currentShape) { canvas.remove(currentShape); currentShape = null; }
      shapeStartPoint = null;
      return;
    }
    if (currentShape) {
      currentShape.setCoords();
      // If too small, remove it
      if ((currentShape.width || 0) < 5 && (currentShape.height || 0) < 5 &&
          (currentShape.rx || 0) < 5) {
        canvas.remove(currentShape);
        currentShape = null;
      } else {
        currentShape.selectable = true;
        currentShape.evented = true;
        if (window.undoManager) {
          window.undoManager.push(Commands.addObject(canvas, currentShape));
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
  ['rect', 'circle', 'diamond'].forEach(shape => {
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

  addLabel(shape, position, text) {
    const pos = this.getLabelPosition(shape, position);
    const isOutside = position.startsWith('outside-');
    const label = new fabric.Textbox(text || 'Label', {
      left: pos.x,
      top: pos.y,
      originX: 'center',
      originY: 'center',
      fontSize: 13,
      fontFamily: 'Arial, sans-serif',
      fill: '#222',
      textAlign: 'center',
      width: 80,
      editable: true,
      selectable: true,
      backgroundColor: isOutside ? 'rgba(255,255,255,0.85)' : '',
      padding: 2
    });
    label.uid = typeof uuid === 'function' ? uuid() : Math.random().toString(36).slice(2);
    label.customData = { type: 'shapeLabel', shapeUid: shape.uid, position };

    if (!this._labels.has(shape.uid)) this._labels.set(shape.uid, []);
    this._labels.get(shape.uid).push(label);
    this.canvas.add(label);
    this.canvas.setActiveObject(label);
    this.canvas.requestRenderAll();
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
    if (window._insertStickyNote && e.e) {
      const pointer = canvas.getPointer(e.e);
      const note = createStickyNote(pointer.x - 100, pointer.y - 100);
      canvas.add(note);
      if (undoManager) undoManager.push(Commands.addObject(canvas, note));
      canvas.requestRenderAll();
      // Stay in sticky mode for rapid placement, user can switch tool when done
    }
    if (window._eraserMode && e.target) {
      if (undoManager) undoManager.push(Commands.removeObject(canvas, e.target));
      canvas.remove(e.target);
      canvas.requestRenderAll();
    }
  });
}
