/**
 * whiteboard.js - ViewportManager for infinite canvas pan/zoom/minimap
 * Synchronizes viewport transforms across pc, oc canvases and txt DOM layer.
 */

class ViewportManager {
  constructor(canvases, domLayer) {
    this.canvases = canvases; // [pc, oc]
    this.domLayer = domLayer; // $('#textillateContainer')
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.05;
    this.maxZoom = 20;
    this.isPanning = false;
    this.lastPanPoint = null;
  }

  getViewportTransform() {
    return [this.zoom, 0, 0, this.zoom, this.panX, this.panY];
  }

  applyTransform() {
    const vpt = this.getViewportTransform();
    this.canvases.forEach(c => {
      c.setViewportTransform(vpt);
      c.requestRenderAll();
    });
    // Sync DOM layer
    if (this.domLayer && this.domLayer.length) {
      this.domLayer.css({
        transform: 'matrix(' + vpt.join(',') + ')',
        transformOrigin: '0 0'
      });
    }
    this.updateZoomDisplay();
    this.updateMinimap();
  }

  zoomToPoint(point, newZoom) {
    newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, newZoom));
    const zoomFactor = newZoom / this.zoom;
    this.panX = point.x - (point.x - this.panX) * zoomFactor;
    this.panY = point.y - (point.y - this.panY) * zoomFactor;
    this.zoom = newZoom;
    this.applyTransform();
  }

  pan(deltaX, deltaY) {
    this.panX += deltaX;
    this.panY += deltaY;
    this.applyTransform();
  }

  fitToContent() {
    const allObjects = [];
    this.canvases.forEach(c => {
      c.getObjects().forEach(o => allObjects.push(o));
    });
    if (allObjects.length === 0) {
      this.resetView();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allObjects.forEach(obj => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    const padding = 50;
    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    this.zoom = Math.min(scaleX, scaleY, 1);
    this.panX = (canvasWidth - contentWidth * this.zoom) / 2 - minX * this.zoom;
    this.panY = (canvasHeight - contentHeight * this.zoom) / 2 - minY * this.zoom;
    this.applyTransform();
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = Math.round(this.zoom * 100) + '%';
  }

  // --- Minimap ---
  initMinimap(minimapCanvasId) {
    this.minimapCanvas = document.getElementById(minimapCanvasId);
    if (!this.minimapCanvas) return;
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.minimapCanvas.addEventListener('click', (e) => this.onMinimapClick(e));
    this.updateMinimap();
  }

  updateMinimap() {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    ctx.clearRect(0, 0, mw, mh);

    // Gather all objects to determine world bounds
    const allObjects = [];
    this.canvases.forEach(c => {
      c.getObjects().forEach(o => allObjects.push(o));
    });

    if (allObjects.length === 0) {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, mw, mh);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allObjects.forEach(obj => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });

    // Add padding around content
    const pad = 200;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scale = Math.min(mw / worldW, mh / worldH);

    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, mw, mh);

    // Draw objects as small rectangles
    ctx.fillStyle = '#666';
    allObjects.forEach(obj => {
      const bound = obj.getBoundingRect();
      const x = (bound.left - minX) * scale;
      const y = (bound.top - minY) * scale;
      const w = Math.max(bound.width * scale, 2);
      const h = Math.max(bound.height * scale, 2);
      ctx.fillRect(x, y, w, h);
    });

    // Draw viewport rectangle
    const vpLeft = (-this.panX / this.zoom - minX) * scale;
    const vpTop = (-this.panY / this.zoom - minY) * scale;
    const vpWidth = (window.innerWidth / this.zoom) * scale;
    const vpHeight = (window.innerHeight / this.zoom) * scale;
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.strokeRect(vpLeft, vpTop, vpWidth, vpHeight);
  }

  onMinimapClick(e) {
    if (!this.minimapCanvas) return;
    const rect = this.minimapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert minimap coords to world coords and center viewport there
    // (simplified: just pan proportionally)
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    const ratioX = mx / mw;
    const ratioY = my / mh;
    // Estimate world bounds from objects
    const allObjects = [];
    this.canvases.forEach(c => {
      c.getObjects().forEach(o => allObjects.push(o));
    });
    if (allObjects.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allObjects.forEach(obj => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });
    const pad = 200;
    const worldX = (minX - pad) + ratioX * (maxX - minX + pad * 2);
    const worldY = (minY - pad) + ratioY * (maxY - minY + pad * 2);
    this.panX = -worldX * this.zoom + window.innerWidth / 2;
    this.panY = -worldY * this.zoom + window.innerHeight / 2;
    this.applyTransform();
  }
}

// --- Pan/Zoom Event Setup ---
function initWhiteboardPanZoom(viewportManager, primaryCanvas) {
  let spaceDown = false;

  // Mouse wheel zoom (Ctrl/Cmd + scroll, or just scroll)
  document.addEventListener('wheel', function(e) {
    // Only zoom when over canvas area
    if (e.target.closest && !e.target.closest('.canvas-container, #textillateContainer, #whiteboard-toolbar, #zoom-controls')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const point = { x: e.clientX, y: e.clientY };
    viewportManager.zoomToPoint(point, viewportManager.zoom * delta);
  }, { passive: false });

  // Space + drag pan
  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !e.target.matches('input, textarea, [contenteditable]')) {
      if (!spaceDown) {
        spaceDown = true;
        primaryCanvas.defaultCursor = 'grab';
        primaryCanvas.selection = false;
        e.preventDefault();
      }
    }
  });
  document.addEventListener('keyup', function(e) {
    if (e.code === 'Space') {
      spaceDown = false;
      primaryCanvas.defaultCursor = 'default';
      primaryCanvas.selection = true;
    }
  });

  primaryCanvas.on('mouse:down', function(e) {
    if (spaceDown || (e.e && e.e.button === 1)) { // space or middle-click
      viewportManager.isPanning = true;
      viewportManager.lastPanPoint = { x: e.e.clientX, y: e.e.clientY };
      primaryCanvas.defaultCursor = 'grabbing';
      primaryCanvas.selection = false;
    }
  });
  primaryCanvas.on('mouse:move', function(e) {
    if (viewportManager.isPanning && e.e) {
      const dx = e.e.clientX - viewportManager.lastPanPoint.x;
      const dy = e.e.clientY - viewportManager.lastPanPoint.y;
      viewportManager.pan(dx, dy);
      viewportManager.lastPanPoint = { x: e.e.clientX, y: e.e.clientY };
    }
  });
  primaryCanvas.on('mouse:up', function() {
    if (viewportManager.isPanning) {
      viewportManager.isPanning = false;
      if (!spaceDown) {
        primaryCanvas.defaultCursor = 'default';
        primaryCanvas.selection = true;
      } else {
        primaryCanvas.defaultCursor = 'grab';
      }
    }
  });

  // Touch: pinch-to-zoom
  let initialPinchDistance = null;
  let initialZoom = 1;

  function getDistance(t1, t2) {
    return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
  }
  function getMidpoint(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }

  const canvasEl = primaryCanvas.upperCanvasEl || primaryCanvas.getElement();
  canvasEl.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
      initialZoom = viewportManager.zoom;
      e.preventDefault();
    }
  }, { passive: false });
  canvasEl.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2 && initialPinchDistance) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistance;
      const midpoint = getMidpoint(e.touches[0], e.touches[1]);
      viewportManager.zoomToPoint(midpoint, initialZoom * scale);
      e.preventDefault();
    }
  }, { passive: false });
  canvasEl.addEventListener('touchend', function() {
    initialPinchDistance = null;
  });
}

// --- Grid ---
class GridManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;
    this.size = 20;
    this.gridCanvas = window.gridCanvas;
    this.gridCtx = window.gridCtx;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.draw();
    } else {
      this.clear();
    }
    return this.enabled;
  }

  draw() {
    if (!this.gridCanvas || !this.gridCtx) return;

    this.clear();

    // Get canvas dimensions and viewport transform
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const vt = this.canvas.viewportTransform;

    // Set grid canvas size to match main canvas
    this.gridCanvas.width = canvasWidth;
    this.gridCanvas.height = canvasHeight;

    // Calculate visible area bounds accounting for zoom and pan
    const zoom = vt[0]; // scale
    const panX = vt[4];  // translate X
    const panY = vt[5];  // translate Y

    // Calculate the world coordinate bounds of what's visible
    const startX = Math.floor((-panX) / zoom / this.size) * this.size;
    const startY = Math.floor((-panY) / zoom / this.size) * this.size;
    const endX = startX + Math.ceil(canvasWidth / zoom / this.size) * this.size + this.size;
    const endY = startY + Math.ceil(canvasHeight / zoom / this.size) * this.size + this.size;

    // Set drawing style
    this.gridCtx.strokeStyle = '#e0e0e0';
    this.gridCtx.lineWidth = 0.5 / zoom; // Adjust line width for zoom
    this.gridCtx.globalAlpha = Math.max(0.3, Math.min(1, zoom)); // Fade out when zoomed out

    // Apply the same transform as the main canvas
    this.gridCtx.setTransform(zoom, 0, 0, zoom, panX, panY);

    this.gridCtx.beginPath();

    // Draw vertical lines
    for (let x = startX; x <= endX; x += this.size) {
      this.gridCtx.moveTo(x, startY);
      this.gridCtx.lineTo(x, endY);
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += this.size) {
      this.gridCtx.moveTo(startX, y);
      this.gridCtx.lineTo(endX, y);
    }

    this.gridCtx.stroke();
  }

  clear() {
    if (!this.gridCanvas || !this.gridCtx) return;
    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
  }

  snapObject(obj) {
    if (!this.enabled) return;
    obj.set({
      left: Math.round(obj.left / this.size) * this.size,
      top: Math.round(obj.top / this.size) * this.size
    });
  }

  // Add method to update grid when viewport changes
  updateGrid() {
    if (this.enabled) {
      this.draw();
    }
  }
}
