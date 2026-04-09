/**
 * whiteboard.undo.js - UndoManager with command pattern
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
    this.redoStack.push(command);
    this.isPerformingAction = false;
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.isPerformingAction = true;
    const command = this.redoStack.pop();
    command.redo();
    this.undoStack.push(command);
    this.isPerformingAction = false;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

const Commands = {
  addObject(canvas, obj) {
    return {
      redo() { canvas.add(obj); canvas.requestRenderAll(); },
      undo() { canvas.remove(obj); canvas.requestRenderAll(); }
    };
  },
  removeObject(canvas, obj) {
    return {
      redo() { canvas.remove(obj); canvas.requestRenderAll(); },
      undo() { canvas.add(obj); canvas.requestRenderAll(); }
    };
  },
  moveObject(canvas, obj, fromState, toState) {
    return {
      redo() { obj.set(toState); obj.setCoords(); canvas.requestRenderAll(); },
      undo() { obj.set(fromState); obj.setCoords(); canvas.requestRenderAll(); }
    };
  },
  modifyObject(canvas, obj, prevState, newState) {
    return {
      redo() { obj.set(newState); obj.setCoords(); canvas.requestRenderAll(); },
      undo() { obj.set(prevState); obj.setCoords(); canvas.requestRenderAll(); }
    };
  }
};

function initUndoRedo(canvas, undoManager) {
  // Track object state before modification
  let objectBeforeState = null;

  canvas.on('before:transform', function(e) {
    if (undoManager.isPerformingAction) return;
    const target = e.transform?.target;
    if (target) {
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
    const newState = {
      left: target.left,
      top: target.top,
      scaleX: target.scaleX,
      scaleY: target.scaleY,
      angle: target.angle,
      width: target.width,
      height: target.height
    };
    undoManager.push(Commands.modifyObject(canvas, target, objectBeforeState, newState));
    objectBeforeState = null;
  });
}
