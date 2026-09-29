/**
 * whiteboard.undo.js - UndoManager with command pattern
 *
 * A command may carry script: {undo, redo}: the script line (or a function
 * returning it) that repeats what undo()/redo() did, so the recorded script
 * replays to the board the user sees after undoing.
 */

class UndoManager {
  constructor(maxSize) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize || 100;
    this.isPerformingAction = false;
    this.enabled = true;
  }

  push(command) {
    if (!this.enabled || this.isPerformingAction) return;
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.isPerformingAction = true;
    const command = this.undoStack.pop();
    command.undo();
    _recordUndoStep(command, 'undo');
    this.redoStack.push(command);
    this.isPerformingAction = false;
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.isPerformingAction = true;
    const command = this.redoStack.pop();
    command.redo();
    _recordUndoStep(command, 'redo');
    this.undoStack.push(command);
    this.isPerformingAction = false;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

function _recordUndoStep(command, which) {
  const s = command.script && command.script[which];
  const line = typeof s === 'function' ? s() : s;
  if (line && typeof recordScript === 'function') recordScript(line);
}

// Script lines for objects with a uid on the main or overlay canvas.
const _scripted = (canvas, obj, fn) => () => (obj && obj.uid && (canvas === window.pc || canvas === window.oc) ? fn(JSON.stringify(obj.uid)) : null);

// JSON for a state to put back; a property that was unset comes back as null
// (JSON would drop it and leave the new value in place).
const _stateJSON = state => JSON.stringify(state, (k, v) => (v === undefined ? null : v));

// Lines drawn to an object (tree, connectors) follow it after undo/redo moves it.
function _syncLines(obj) {
  if (typeof updateTreeItem === 'function' && obj.canvas) updateTreeItem(obj);
}

function _setState(canvas, obj, state) {
  // An object in a multi-selection has coordinates relative to it.
  if (obj.group && obj.group.type === 'activeselection') canvas.discardActiveObject();
  obj.set(state);
  obj.setCoords();
  _syncLines(obj);
  canvas.requestRenderAll();
}

const Commands = {
  addObject(canvas, obj) {
    return {
      redo() { canvas.add(obj); canvas.requestRenderAll(); },
      undo() { canvas.remove(obj); canvas.requestRenderAll(); },
      script: {
        undo: _scripted(canvas, obj, u => `removeByUid(${u})`),
        redo: _scripted(canvas, obj, u => `restoreObject(${u})`)
      }
    };
  },
  removeObject(canvas, obj) {
    return {
      redo() { canvas.remove(obj); canvas.requestRenderAll(); },
      undo() { canvas.add(obj); canvas.requestRenderAll(); },
      script: {
        undo: _scripted(canvas, obj, u => `restoreObject(${u})`),
        redo: _scripted(canvas, obj, u => `removeByUid(${u})`)
      }
    };
  },
  moveObject(canvas, obj, fromState, toState) {
    return Commands.modifyObject(canvas, obj, fromState, toState);
  },
  modifyObject(canvas, obj, prevState, newState) {
    return {
      redo() { _setState(canvas, obj, newState); },
      undo() { _setState(canvas, obj, prevState); },
      script: {
        undo: _scripted(canvas, obj, u => `setObjectProps(${u}, ${_stateJSON(prevState)})`),
        redo: _scripted(canvas, obj, u => `setObjectProps(${u}, ${_stateJSON(newState)})`)
      }
    };
  },
  // Several commands as one undo step (undone last-first).
  group(commands) {
    const line = (c, which) => { const s = c.script && c.script[which]; return typeof s === 'function' ? s() : s; };
    const lines = list => list.filter(Boolean).join('; ') || null;
    return {
      redo() { commands.forEach(c => c.redo()); },
      undo() { commands.slice().reverse().forEach(c => c.undo()); },
      script: {
        undo: () => lines(commands.slice().reverse().map(c => line(c, 'undo'))),
        redo: () => lines(commands.map(c => line(c, 'redo')))
      }
    };
  },
  // Add support for freehand paths (overlay canvas)
  addPath(canvas, pathObj) {
    return Commands.addObject(canvas, pathObj);
  },
  removePath(canvas, pathObj) {
    return Commands.removeObject(canvas, pathObj);
  }
};

function initUndoRedo(canvas, undoManager, overlayCanvas) {
  // Initialize for main canvas
  initCanvasUndoRedo(canvas, undoManager);

  // Initialize for overlay canvas (freehand drawings) if provided
  if (overlayCanvas) {
    initCanvasUndoRedo(overlayCanvas, undoManager);
  }
}

function initCanvasUndoRedo(canvas, undoManager) {
  // Track object state before modification
  let objectBeforeState = null;
  let autoFitBefore;

  // Where each object of a multi-selection is on the canvas.
  const placeOf = o => {
    const d = fabric.util.qrDecompose(o.calcTransformMatrix());
    // The decomposed matrix already holds any flip (as angle and scale).
    const p = { scaleX: d.scaleX, scaleY: d.scaleY, angle: d.angle, skewX: d.skewX, skewY: d.skewY, flipX: false, flipY: false };
    // left/top for the object's own origin, worked out with its canvas
    // scale and angle (inside the selection they are relative to it).
    const own = { scaleX: o.scaleX, scaleY: o.scaleY, angle: o.angle, skewX: o.skewX, skewY: o.skewY, flipX: o.flipX, flipY: o.flipY };
    Object.assign(o, p);
    const at = o.translateToOriginPoint(new fabric.Point(d.translateX, d.translateY), o.originX, o.originY);
    Object.assign(o, own);
    return Object.assign(p, { left: at.x, top: at.y });
  };
  let selectionBefore = null;

  canvas.on('before:transform', function(e) {
    if (undoManager.isPerformingAction) return;
    const target = e.transform?.target;
    selectionBefore = target && target.type === 'activeselection'
      ? target.getObjects().map(o => ({ o, place: placeOf(o) })) : null;
    if (target) {
      autoFitBefore = target.customData && target.customData.autoFit;
      objectBeforeState = {
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
        width: target.width,
        height: target.height
      };
    }
  });

  canvas.on('object:modified', function(e) {
    if (undoManager.isPerformingAction || !objectBeforeState) return;
    const target = e.target;
    if (!target) return;
    // A multi-selection moves, scales or turns its objects: one undo step
    // that puts each object back where it was on the canvas.
    if (target.type === 'activeselection' && selectionBefore) {
      undoManager.push(Commands.group(selectionBefore.map(({ o, place }) => Commands.modifyObject(canvas, o, place, placeOf(o)))));
      selectionBefore = null;
      objectBeforeState = null;
      return;
    }
    const newState = {
      left: target.left,
      top: target.top,
      scaleX: target.scaleX,
      scaleY: target.scaleY,
      angle: target.angle,
      width: target.width,
      height: target.height
    };

    // Use appropriate command based on canvas type
    const commandType = canvas.isDrawingMode ? Commands.modifyObject : Commands.modifyObject;
    const command = commandType(canvas, target, objectBeforeState, newState);
    // Resizing a text box by its side handles stops it fitting its text
    // (customData.autoFit); undo/redo put that back along with the width.
    const autoFitAfter = target.customData && target.customData.autoFit;
    if (autoFitBefore !== autoFitAfter) {
      const setFit = v => { target.customData = target.customData || {}; target.customData.autoFit = v; };
      const { undo, redo, script } = command;
      command.undo = () => { setFit(autoFitBefore); undo(); };
      command.redo = () => { setFit(autoFitAfter); redo(); };
      const fitLine = (v, line) => () => {
        const l = line();
        return l && target.uid ? `setCustomData(${JSON.stringify(target.uid)}, {autoFit: ${JSON.stringify(v)}}); ${l}` : l;
      };
      command.script = { undo: fitLine(autoFitBefore, script.undo), redo: fitLine(autoFitAfter, script.redo) };
    }
    undoManager.push(command);
    objectBeforeState = null;
  });

  // Handle object deletion
  canvas.on('before:object:removed', function(e) {
    if (undoManager.isPerformingAction) return;
    const target = e.target;
    if (target) {
      // Use appropriate command based on canvas type or object type
      const commandType = (canvas.isDrawingMode || target.type === 'path') ? Commands.removePath : Commands.removeObject;
      undoManager.push(commandType(canvas, target));
    }
  });
}
