window.globalVariableNames = {
  "matrices": 0,
  "arrays": 0,
  "texts": 0
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function it() { return pc.getActiveObject() }

// Create freehand path for recording playback
function createFreehandPath(pathString, opts = {}) {
  const path = new fabric.Path(pathString, {
    left: opts.left || 0,
    top: opts.top || 0,
    fill: opts.fill || '',
    stroke: opts.stroke || '#000000',
    strokeWidth: opts.strokeWidth || 1,
    strokeLineCap: opts.strokeLineCap || 'butt',
    strokeLineJoin: opts.strokeLineJoin || 'miter',
    strokeDashArray: opts.strokeDashArray || null,
    opacity: opts.opacity || 1,
    scaleX: opts.scaleX || 1,
    scaleY: opts.scaleY || 1,
    angle: opts.angle || 0
  });

  if (opts.uid) {
    path.uid = opts.uid;
  }

  // Add drawing animation during playback
  if (window.isRecordingPlayback) {
    animatePathDrawing(path);
  }

  return path;
}

function animatePathDrawing(path) {
  // Estimate path length for animation
  const pathLength = estimatePathLength(path.path);

  if (pathLength <= 0) return; // Skip animation for very short paths

  // Set up initial dash array to hide the entire path
  const originalDashArray = path.strokeDashArray;
  path.set({
    strokeDashArray: [pathLength, pathLength],
    strokeDashOffset: pathLength
  });

  // Animation duration based on path length (min 200ms, max 2000ms)
  const duration = Math.min(Math.max(pathLength / 2, 200), 2000);

  // Animate the path drawing
  const startTime = Date.now();

  function animateFrame() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out animation for smoother effect
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    const newOffset = pathLength * (1 - easeProgress);
    path.set({ strokeDashOffset: newOffset });

    if (path.canvas) {
      path.canvas.requestRenderAll();
    }

    if (progress < 1) {
      requestAnimationFrame(animateFrame);
    } else {
      // Animation complete - restore original dash array
      path.set({
        strokeDashArray: originalDashArray,
        strokeDashOffset: 0
      });
      if (path.canvas) {
        path.canvas.requestRenderAll();
      }
    }
  }

  // Start animation on next frame
  requestAnimationFrame(animateFrame);
}

function estimatePathLength(pathData) {
  // Simple path length estimation from path commands
  if (!pathData || typeof pathData !== 'string') return 0;

  let totalLength = 0;
  let currentX = 0, currentY = 0;

  // Parse path commands to estimate length
  const commands = pathData.match(/[MLCQTSZmlcqtsz][^MLCQTSZmlcqtsz]*/g) || [];

  for (const command of commands) {
    const type = command[0];
    const coords = command.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (type.toLowerCase()) {
      case 'm': // moveto
        if (coords.length >= 2) {
          if (type === 'm') { // relative
            currentX += coords[0];
            currentY += coords[1];
          } else { // absolute
            currentX = coords[0];
            currentY = coords[1];
          }
        }
        break;

      case 'l': // lineto
        if (coords.length >= 2) {
          const newX = type === 'l' ? currentX + coords[0] : coords[0];
          const newY = type === 'l' ? currentY + coords[1] : coords[1];
          totalLength += Math.sqrt(Math.pow(newX - currentX, 2) + Math.pow(newY - currentY, 2));
          currentX = newX;
          currentY = newY;
        }
        break;

      case 'c': // curveto (approximate as straight line for simplicity)
        if (coords.length >= 6) {
          const newX = type === 'c' ? currentX + coords[4] : coords[4];
          const newY = type === 'c' ? currentY + coords[5] : coords[5];
          totalLength += Math.sqrt(Math.pow(newX - currentX, 2) + Math.pow(newY - currentY, 2));
          currentX = newX;
          currentY = newY;
        }
        break;
    }
  }

  return totalLength;
}

fabric.Object.prototype.getZIndex = function() {
  return this.canvas.getObjects().indexOf(this);
}

// --- Fabric.js v6 custom filter: WhiteToTransparent ---
class WhiteToTransparent extends fabric.filters.BaseFilter {
  static type = 'WhiteToTransparent';

  applyTo2d({ imageData }) {
    const pix = imageData.data;
    for (let i = 0, n = pix.length; i < n; i += 4) {
      if (pix[i] === 255 && pix[i+1] === 255 && pix[i+2] === 255) {
        pix[i] = 0;
        pix[i+1] = 0;
        pix[i+2] = 0;
        pix[i+3] = 0;
      }
    }
  }
}
fabric.filters.WhiteToTransparent = WhiteToTransparent;
fabric.classRegistry.setClass(WhiteToTransparent, 'filters.WhiteToTransparent');

// --- Fabric.js v6 custom class: LineArrow (Miro-style) ---
class LineArrow extends fabric.Line {
  static type = 'LineArrow';

  // arrowSize: length of arrowhead wings (default 8)
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

    // Draw arrowhead at the end point (x2,y2)
    const xDiff = this.x2 - this.x1;
    const yDiff = this.y2 - this.y1;
    const angle = Math.atan2(yDiff, xDiff);
    const sz = this.arrowSize || 8;

    ctx.save();
    ctx.translate((this.x2 - this.x1) / 2, (this.y2 - this.y1) / 2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, -sz * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, sz * 0.5);
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  static fromObject(object) {
    return Promise.resolve(new LineArrow([object.x1, object.y1, object.x2, object.y2], object));
  }
}
fabric.LineArrow = LineArrow;
fabric.classRegistry.setClass(LineArrow);
fabric.classRegistry.setClass(LineArrow, 'LineArrow');

fabric.Canvas.prototype.add = (function (originalFn) {
  return function (...args) {
    const obj = args[0];
    // Skip tracking for internal re-adds (object already on this canvas)
    const alreadyOnCanvas = obj && obj.canvas === this;
    originalFn.call(this, ...args);
    if (!alreadyOnCanvas && obj) {
      if (!obj.uid) {
        const uid = uuid();
        obj.uid = uid;
        customData(obj).uid = uid;
        const type = ' ' + (customData(obj).type || '');
        window.objectIds.add({uid: uid, type: 'fabric.js' + type});
        updateObjectIdsUi()
      }
    }
    return this
  };
})(fabric.Canvas.prototype.add);

// --- Fabric.js v6 custom class: Sprite ---
class Sprite extends fabric.Image {
  static type = 'Sprite';
  spriteWidth = 50;
  spriteHeight = 72;
  spriteIndex = 0;
  frameTime = 100;

  constructor(element, options = {}) {
    options.width = options.spriteWidth || 50;
    options.height = options.spriteHeight || 72;
    super(element, options);
    this.spriteWidth = options.spriteWidth || this.spriteWidth;
    this.spriteHeight = options.spriteHeight || this.spriteHeight;
    this.createTmpCanvas();
    this.createSpriteImages();
  }

  createTmpCanvas() {
    this.tmpCanvasEl = document.createElement('canvas');
    this.tmpCanvasEl.width = this.spriteWidth || this.width;
    this.tmpCanvasEl.height = this.spriteHeight || this.height;
  }

  createSpriteImages() {
    this.spriteImages = [];
    const steps = this._element.width / this.spriteWidth;
    for (let i = 0; i < steps; i++) {
      this.createSpriteImage(i);
    }
  }

  createSpriteImage(i) {
    const tmpCtx = this.tmpCanvasEl.getContext('2d');
    tmpCtx.clearRect(0, 0, this.tmpCanvasEl.width, this.tmpCanvasEl.height);
    tmpCtx.drawImage(this._element, -i * this.spriteWidth, 0);
    const dataURL = this.tmpCanvasEl.toDataURL('image/png');
    const tmpImg = new Image();
    tmpImg.src = dataURL;
    tmpImg.crossOrigin = 'anonymous';
    this.spriteImages.push(tmpImg);
  }

  _render(ctx) {
    ctx.drawImage(
      this.spriteImages[this.spriteIndex],
      -this.width / 2,
      -this.height / 2
    );
  }

  play() {
    this.animInterval = setInterval(() => {
      this.onPlay && this.onPlay();
      this.dirty = true;
      this.spriteIndex++;
      if (this.spriteIndex === this.spriteImages.length) {
        this.spriteIndex = 0;
      }
    }, this.frameTime);
  }

  stop() {
    clearInterval(this.animInterval);
  }

  static async fromURL(url, imgOptions) {
    const img = await fabric.util.loadImage(url, { crossOrigin: 'anonymous' });
    return new Sprite(img, imgOptions);
  }
}
fabric.Sprite = Sprite;
fabric.classRegistry.setClass(Sprite);
fabric.classRegistry.setClass(Sprite, 'Sprite');

fabric.Object.prototype.toObject = (function (toObject) {
  return function (propertiesToInclude) {
    const obj = toObject.call(this, propertiesToInclude);
    if (this.customData) obj.customData = this.customData;
    if (this.uid) obj.uid = this.uid;
    if (this.treeConnection) obj.treeConnection = this.treeConnection;
    if (this.text) obj.text = this.text;
    return obj;
  };
})(fabric.Object.prototype.toObject);

fabric.Object.customProperties = ['customData', 'uid', 'treeConnection'];

function globalStore(key, obj) {
  if (!window.globalMapping) window.globalMapping = {}
  if (!globalMapping[key]) globalMapping[key] = 0

  const id = globalMapping[key] + 1;
  globalMapping[key] = id;
  _[key + id] = obj

  return key + id
}

// Update canvas, re-render everything
function update(canvas) {
  if (!canvas && window.pc === undefined) return
  if (!canvas) canvas = pc;
  if (canvas) {
    canvas._objects.forEach(o => o.setCoords());
    canvas.renderAll();
  }
}

/**
 * sleep(seconds).then(doSomething) where doSomething = () => {...}
 * or, await sleep(seconds)
 * @param x
 * @returns {Promise<unknown>}
 */
function sleep(x) {
  return new Promise((suc, fail) => {
    setTimeout(() => suc(), x * 1000)
  })
}

function record() {
  $("#btnStart").click()
}

function pause() {
  $("#btnPause").click()
}

function resume() {
  $("#btnResume").click()
}

function stop() {
  $("#btnStop").click()
}

/**
 * Creates horizontal arrow using html/css; TODO: Enahnce or delete
 */
function createArrow() {
  const arr = $(`<div class="arrow"/>`),
    line = $(`<div class="line"></div>`),
    point = $(`<div class="point"></div>`);

  arr.css({
    width: '120px',
    margin: '50px auto'
  });
  line.css({
    'margin-top': '14px',
    width: '90px',
    background: 'blue',
    height: '10px',
    float: 'left'
  });

  point.css({
    width: 0,
    height: 0,
    'border-top': '20px solid transparent',
    'border-bottom': '20px solid transparent',
    'border-left': '30px solid blue',
    float: 'right'
  });

  arr.append(line);
  arr.append(point);
  txt.append(arr);

  arr.draggable();

}

/**
 * To print on top of everything, like a cinema text.
 * typeQuote("Hi this will be typed as per css given or defaults", {css: {left: '10%', top: '5%'}, theme: 'white'})
 * @param text
 * @param _options
 * @returns {*}
 */
function typeQuote(text, _options) {
  const options = Object.assign({}, {
    wait: 0,
    theme: 'black',
    onComplete: () => {
    },
    css: {}
  }, _options);

  if (Object.keys(options.css).length > 0) {
    options.css.position = 'absolute'
    options.css.marginTop = 0
  }

  const textillateContainer = $('#textillateContainer');
  const savedCssTC = {
    zIndex: textillateContainer.css('z-index'),
    color: textillateContainer.css('color'),
    backgroundColor: textillateContainer.css('backgroundColor'),
    font: textillateContainer.css('font'),
    top: textillateContainer.css('top'),
    left: textillateContainer.css('left')
  }

  const $cinemaText = $('#cinemaText');
  const cinemaText = $cinemaText;
  const savedCssCT = {
    zIndex: cinemaText.css('z-index'),
    color: cinemaText.css('color'),
    backgroundColor: cinemaText.css('backgroundColor'),
    font: cinemaText.css('font'),
    top: cinemaText.css('top'),
    left: cinemaText.css('left'),
    marginTop: cinemaText.css('marginTop')
  }

  const cinemaHtml = cinemaText.html()

  if (options.theme === 'black') {
    textillateContainer.css({backgroundColor: '#1a1a1a', zIndex: 900000})
    cinemaText.css({color: 'white'})
  }
  cinemaText.css(options.css)

  const start = new Date().getTime();

  $cinemaText.html('').css({zIndex: 900010}).show();

  return type(text, '#cinemaText').then(it => sleep(options.delay || 1)).then(it => {
    console.log("typed in " + (new Date().getTime() - start) / 1000 + "secs")
    textillateContainer.css(savedCssTC);
    cinemaText.css(savedCssCT);
    cinemaText.html(cinemaHtml);
    $cinemaText.hide();
//         it.destroy();
    options.onComplete();
  })
}

function delayExecution(fn, delayInMillis) {
  return new Promise((myResolve, myReject) => {
    setTimeout(() => {
      fn();
      myResolve()
    }, delayInMillis)
  })
}

/**
 *
 * @param text
 * @param top
 * @param left
 * @param opts
 * @returns {*}
 */
function typeAndDisappear(text, top, left, opts) {
  const options = Object.assign({}, {wait: 100, top: top, left: left}, opts);

  const id = "T" + new Date().getTime();
  // id = "cinemaText"
  const T = createTextBox('', options).attr('id', id)

  return type(text, '#' + id, options).then(it => delayExecution(() => T.hide(), opts.delay))
}

function clear(layer) {
  const clearPc = !layer || (layer === 'pc')
  const clearOc = !layer || (layer === 'oc')
  const clearTxt = !layer || (layer === 'txt')

  if (clearPc) {
    pc.clear();
  }
  if (clearOc) {
    oc.clear()
  }
  if (clearTxt) {
    $('#textillateContainer').css({backgroundColor: 'white'})
    $('#cinemaText').css({color: 'black'})
    $('#cinemaText').html('')
  }
}

function superimposeOverlayCanvas() {
  const pos = $('#playerCanvas').position()
  $('#overlayCanvas').css({
    position: 'absolute',
    top: pos.top,
    left: pos.left,
    width: $('#playerCanvas').width(),
    height: $('#playerCanvas').height()
  });
}

function showToolbar() {
  $('#toolbar').show();
}

function hideToolbar() {
  $('#toolbar').show();
}

function changeCircleColor(c, objs) {
  try {
    const _objs = objs || pc.getActiveObjects()
    _objs.forEach(o => {
      if (o._objects && o._objects[0]) o._objects[0].set({ fill: c });
      else o.set({ fill: c });
    })
  } catch (e) {
    try {
      pc.getActiveObject().set({ fill: c })
    } catch (e2) {
      console.log(e2);
    }
  }

  pc.renderAll()
}

function flipConnectionMode() {
  const connectionModeOn = window.connectionMode || false;

  window.connectionMode = !connectionModeOn
  if (window.connectionMode) $('#flipConnectionMode').css({
    backgroundColor: 'blue'
  })
  else $('#flipConnectionMode').css({
    backgroundColor: ''
  })

  window.firstOfConnection = null
}

function selectFirstOfConnection(e) {
  window.firstOfConnection = pc.getActiveObject()
}

function makeConnection(e) {
  if (window.firstOfConnection) {
    connect(pc, firstOfConnection, pc.getActiveObject())
    window.firstOfConnection = null
  }
}

function zoomSelectedObject(obj, isPlus) {
  obj = findIfRequired(obj);
  if (!obj) return;
  const amount = 1.5

  if (isPlus) {
    var activeObject = pc.getActiveObject()
    activeObject.scaleX = activeObject.scaleX * amount
    activeObject.scaleY = activeObject.scaleY * amount

  } else {
    var activeObject = pc.getActiveObject()
    activeObject.scaleX = activeObject.scaleX / amount
    activeObject.scaleY = activeObject.scaleY / amount

  }
  activeObject.setCoords();
  pc.renderAll()
  updateTreeItem(activeObject)
}

function moveActiveObject(prop, amount) {
  const activeObject = pc.getActiveObject()
  if (!activeObject) return;
  activeObject[prop] = activeObject[prop] + amount
  activeObject.setCoords();
  updateTreeItem(activeObject)
  pc.renderAll()
}

/**
 * Delete object as well as its connector lines (both incoming and outgoing)
 * @param obj
 */
function deleteFabricObject(obj) {
  obj = findIfRequired(obj)
  if (!obj) {
    return
  }
  obj.treeConnection?.incoming?.lines?.map(findIfRequired)?.forEach((line) => {
    pc.remove(line)
  })
  obj.treeConnection?.outgoing?.lines?.map(findIfRequired)?.forEach((line) => {
    pc.remove(line)
  })

  pc.remove(obj)
  pc.renderAll()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deleteSelectedObjects() {
  const activeObjects = pc.getActiveObjects();
  if (activeObjects.length > 1) {
    activeObjects.forEach(x => {
      deleteFabricObject(x)
      recordScript(`deleteFabricObject('${x.uid}')`)
    })
    pc.discardActiveObject();
  } else {
    const activeObject = pc.getActiveObject();
    if (activeObject) {
      deleteFabricObject(activeObject);
      recordScript(`deleteFabricObject('${activeObject.uid}')`)
    }
  }
}

function applyBlackTheme() {
  $("#textillateContainer").css({backgroundColor: 'black', color: 'white'});
  window.theme = 'black';

}

function mergeDuplicateOfSrcIntoDest(src, dest, onComplete, opts) {
  const options = Object.assign({}, opts, {delay: 1000})
  duplicate(src).then(x => {
    $(x).animate({
      top: dest.offset().top,
      left: dest.offset().left
    }, options.delay, () => {
      $(x).remove();
      onComplete(src, dest)
    })
  })
}

function duplicate(obj) {
  if (!obj) return

  if (obj instanceof jQuery) {
    return new Promise((done, error) => {
      const clone = $(obj).clone();
      txt.append(clone);
      $(clone).draggable()
      done(clone);
    })
  }

  return obj.clone().then(cloned => {
    pc.add(cloned);
    return cloned;
  });
}

function copy(canvas, obj) {
  // clone what are you copying since you
  // may want copy and paste on different moment.
  // and you do not want the changes happened
  // later to reflect on the copy.
  const target = obj || canvas.getActiveObject();
  if (!target) return;

  target.clone().then(function (cloned) {
    _clipboard = cloned;
  });
  window.canPasteImageFromClipboard = false;
}

function paste(canvas) {
  if (!window._clipboard) return;

  window.canPasteImageFromClipboard = true;
  // clone again, so you can do multiple copies.
  _clipboard.clone().then(function (clonedObj) {
    canvas.discardActiveObject();

    const options = {
      left: clonedObj.left + 10,
      top: clonedObj.top + 10,
      evented: true,
    };

    clonedObj.set(options);

    if (clonedObj.type === 'activeSelection') {
      // active selection needs a reference to the canvas.
      clonedObj.canvas = canvas;
      clonedObj.forEachObject(function (obj) {
        const id = globalStore('clone', obj)
        console.log(`Cloned _.${id}`)
        canvas.add(obj);
        const tr = obj.calcTransformMatrix()
        options.left = obj.left + 10 + tr[4]
        options.top = obj.top + 10 + tr[5]
        obj.set(options)
        obj.setCoords();
      });

    } else {
      const id = globalStore('clone', clonedObj)
      console.log(`Cloned _.${id}`)
      canvas.add(clonedObj);
    }
    _clipboard.top += 10;
    _clipboard.left += 10;

    canvas.renderAll();
  });
}

function editFabricjsObject(txt, obj) {
  obj = findIfRequired(obj)

  //TODO: Support multiple commands
  const splits = txt.split(":");
  const command = splits[0]
  const data = splits[1].trim()

  const setFill = it => it.set({
    fill: data
  })

  let targetObj = obj
  switch (command) {
    case 'bg':
      if(obj?._objects?.length > 1) targetObj = obj._objects[0]
      setFill(targetObj)
      break
    case 'fg':
      if(obj?._objects?.length > 1) targetObj = obj._objects[1]
      setFill(targetObj)
      break
    case 'text':
      if(obj?._objects?.length > 1) targetObj = obj._objects[1]
      targetObj.set({
        text: data
      })
      break
    case 'anim':
      highlightByZooming(obj, pc)
      break
    case 'stop'  :
      stopAnimation(obj, pc)
      break
    case 'controls':
      obj.hasControls = data === 'on'
      break;
    case 'hide':

      break;
    case 'show':

      break;
    case 'rm':

      break;
  }
  pc.renderAll();
}

function editSelectedObject() {
  if (!pc.getActiveObject()) return;
  const obj = pc.getActiveObject()

  const promptStr = prompt('Enter command')
  if (!promptStr || promptStr.split(":").length !== 2) return

  editFabricjsObject(promptStr, obj);
  recordScript(`editFabricjsObject(${JSON.stringify(promptStr)}, '${obj.uid}');`)
}

function makeLine(coords, opts) {
  const options = Object.assign({ stroke: '#888', strokeWidth: 1.5 }, opts);
  const line = new fabric.Line(coords, {
    fill: '',
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    selectable: false,
    padding: 4
  });
  line.customData = {
    type: "makeLine",
  }
  return line;
}

function renderSubtree(values, opts, node) {
  node = findIfRequired(node)
  if(!node) return;

  const split = values.split(";")
  let cmds = ''
  let arrowDir = 'out' // default to outgoing arrows

  if (split.length === 2) {
    cmds = split[0]
    values = split[1]
  } else if (split.length === 1) {
    cmds = 'none';
    values = split[0]
  }

  // Parse arrow direction from commands (arrow:out, arrow:in, arrow:bi)
  if (cmds.includes('arrow:')) {
    const arrowMatch = cmds.match(/arrow:(out|in|bi)/);
    if (arrowMatch) {
      arrowDir = arrowMatch[1];
      cmds = cmds.replace(/arrow:(out|in|bi),?/, '').trim();
    }
  }

  // Parse individual child specifications
  const childSpecs = values.split(',').map(child => {
    const trimmed = child.trim();
    if (trimmed.includes(':')) {
      const [name, shape] = trimmed.split(':');
      return { name: name.trim(), shape: shape.trim() };
    }
    return { name: trimmed, shape: cmds.trim() || 'rect' };
  });

  if (childSpecs.length === 0) {
    return
  }

  const defaultShape = cmds.trim() || 'rect'

  opts = opts || {}
  const options = combined({
    width: 150,
    height: 60
  }, opts);

  const idMappings = options.idMappings || {}

  const defaultOutgoing = () => ({
    lines: [],
    point: 'centre'
  });
  node.treeConnection = node.treeConnection || {
    incoming: {},
    outgoing: defaultOutgoing()
  };

  if (node.oCoords && node.oCoords.mb) {
    // p => parent
    const px = node.getCenterPoint().x,
        py = node.getCenterPoint().y;

    let mid = Math.ceil(childSpecs.length / 2)
    if (childSpecs.length === 1) mid = 0;

    const w = (options.width / 2) / childSpecs.length;

    let x = px,
        y = py + options.height;

    const createArrowLine = (x1, y1, x2, y2, direction) => {
      switch (direction) {
        case 'out':
          return makeLine([x1, y1, x2, y2]);
        case 'in':
          return arrow(x2, y2, x1, y1, {});
        case 'bi':
          return bidirectionalArrow(x1, y1, x2, y2, {});
        default:
          return makeLine([x1, y1, x2, y2]);
      }
    };

    const addConnection = (x1, y1, x2, y2, childSpec, valuesIndex) => {
      const { name, shape } = childSpec;

      // Create target node with specified shape
      const targetNode = shape === 'none' ?
          textInRect(name, x2, y2, {fill: 'black'}, {fill: 'white'})
          : boundedText(shape)(name, x2, y2, {}, {})

      if(idMappings[valuesIndex]) {
        targetNode.uid = idMappings[valuesIndex]
      }
      pc.add(targetNode)

      // Create directional line/arrow
      const line = createArrowLine(x1, y1, targetNode.getCenterPoint().x, targetNode.getCenterPoint().y, arrowDir);

      customData(line).source = node.uid ? node.uid: node
      customData(line).target = targetNode.uid ? targetNode.uid : targetNode
      customData(line).direction = arrowDir

      pc.add(line)
      pc.sendObjectToBack(line)
      node.treeConnection.outgoing = node.treeConnection.outgoing || defaultOutgoing()
      node.treeConnection.outgoing.lines.push(line.uid || line)

      targetNode.treeConnection = {
        incoming: {
          lines: [line],
          point: 'centre'
        }
      }
      targetNode.onAnimationChange = () => updateTreeItem(targetNode)

      if(options.overlapOnRoot) {
        pc.bringObjectToFront(targetNode)
      }
      return targetNode
    }

    if(options.overlapOnRoot) {
      x = px; y = py;
    }
    let t = addConnection(px, py, x, y, childSpecs[mid], mid)
    idMappings[mid] = t.uid

    for (let i = mid - 1; i >= 0; i--) {
      x = x - w;
      if(options.overlapOnRoot) {
        x = px; y = py;
      }
      t = addConnection(px, py, x, y, childSpecs[i], i)
      idMappings[i] = t.uid
    }

    x = px;
    y = py;

    for (let i = mid + 1; i < childSpecs.length; i++) {
      x = x + w;
      if(options.overlapOnRoot) {
        x = px; y = py;
      }
      t = addConnection(px, py, x, y, childSpecs[i], i)
      idMappings[i] = t.uid
    }

    return idMappings;
  }
}

function getAllOutgoingTargets(obj, noFlat) {
  obj = findIfRequired(obj)
  if(!obj) return []
  const res = []
  _getAllOutgoingTargets(obj, res)
  if(noFlat) return res
  return res.flat()
}

function _getAllOutgoingTargets(obj, out) {
    const lines = obj?.treeConnection?.outgoing?.lines;
    if(!lines) {
      return;
    }
    const targets = lines?.map(findIfRequired)?.map(it => customData(it).target)?.map(findIfRequired)
    out.push(targets)
    targets.forEach(it => {
      _getAllOutgoingTargets(it, out)
    })
}

function expandTreeItems(obj) {
  obj = findIfRequired(obj)
  if(!obj) return;

  getAllOutgoingTargets(obj).filter(it => customData(it).collapsedInto === obj.uid).forEach(target => {
    showObject(target)
    const prevProps = customData(target).prevProps
    animate(target, {top: prevProps.top, left: prevProps.left}, {onComplete: e => {
        //pc.moveTo(target, prevProps.zIndex)
        pc.bringObjectToFront(target)
        customData(target).prevProps = null
        customData(target).collapsedInto = null
      }})
  })
}

function collapseTreeItems(obj) {
  obj = findIfRequired(obj)
  if(!obj) return;

  const nonCollapsedChildren = getAllOutgoingTargets(obj).filter(it => !customData(it).collapsedInto);
  nonCollapsedChildren
      .filter(it => it.uid !== obj.uid)
      .forEach(target => {
          customData(target).prevProps = getActualProperties(target)
          //Take note of which children were collapsed directly into this obj
          customData(target).collapsedInto = obj.uid
          animate(target, {top: obj.top, left: obj.left}, {onComplete: e => {
              hideObject(target)
            }})
          pc.sendObjectToBack(target)
  })

  if(!nonCollapsedChildren.length) {
    const parent = findIfRequired(obj.treeConnection?.incoming?.lines[0]?.customData?.source)
    if(parent) {
      customData(obj).prevProps = getActualProperties(obj)
      animate(obj, {top: parent.top, left: parent.left}, {
        onComplete: e => {
          hideObject(obj)
        }
      })
      customData(obj).collapsedInto = parent.uid
    }
  }
}

/***
 * Enhanced makeSubtree function that supports:
 * 1. Individual shape specifications: child1:rect, child2:circle, child3:diamond
 * 2. Directional arrows: arrow:out, arrow:in, arrow:bi
 * 3. Miro-like shapes: diamond, hexagon, star, cloud
 *
 * Examples:
 *    "child1, child2, child3"
 *    "rect; child1, child2"
 *    "arrow:bi; child1:diamond, child2:star"
 *    "arrow:out; Task:rect, Decision:diamond, Process:circ"
 */
function makeSubtree(node, values, opts) {
  opts = opts || {}
  opts.overlapOnRoot = true
  opts.idMappings = renderSubtree(values, opts, node)
  //TODO: Find the closest obj which was recorded so we know its uid,
  // and find the relation to that i.e (level, index, data); And use that in the record script
  recordScript(`renderSubtree(${JSON.stringify(values)}, ${JSON.stringify(opts)}, '${node.uid}')`)

  // Hide all immediate children and their connector lines, then show the Tree Node panel
  const outgoingLines = node.treeConnection?.outgoing?.lines || [];
  outgoingLines
    .map(findIfRequired)
    .filter(Boolean)
    .forEach(line => {
      hideObject(line);
      const child = findIfRequired(line.customData?.target);
      if (child) hideObject(child);
    });

  // Open the Tree Node panel focused on this node
  if (typeof showTreeNodePanel === 'function') {
    showTreeNodePanel(node);
  }
}

//Returns calculated top(y), left(x) which works even if the object is in group
const getActualProperties = (object, round) => {
  object = findIfRequired(object)
  let roundFn = x => x
  if(round) {
    roundFn = x => Math.round(x * 100) / 100
  }
  const mat = object.calcTransformMatrix(false);
  // Assuming objects origin x/y is 'left'/'top'; TODO for others
  const props =  {
    x: roundFn(mat[4] - object.width/2),
    y: roundFn(mat[5] - object.height/2),
    w: roundFn(object.width),
    h: roundFn(object.height),
    fill: object.fill,
    angle: roundFn(object.angle),
    skewX: roundFn(object.skewX),
    skewY: roundFn(object.skewY),
    scaleX: roundFn(object.scaleX),
    scaleY: roundFn(object.scaleY),
    opacity: object.opacity,
    center: object.getCenterPoint(),
  }
  if(object._objects && object._objects.length > 1) {
    //It's a group
    delete props['fill']
  }
  props.center.x = roundFn(props.center.x)
  props.center.y = roundFn(props.center.y)
  props.left = props.x;
  props.top = props.y;
  props.zIndex = object.getZIndex();
  return props;
};

function updateTreeItem(obj) {
  obj = findIfRequired(obj)
  if(!obj || !obj.treeConnection) return;

  let p;
  const getPointCoords = (obj, pt) => {
    if (pt === 'mt') {
      const c = getActualProperties(obj)
      return {
        y: c.y,
        x: c.x + obj.width / 2
      }
    }
    if (pt === 'mb') {
      const c = getActualProperties(obj)
      return {
        y: c.y + obj.height,
        x: c.x + obj.width / 2
      }
    }
    const p = getActualProperties(obj)
    p.x = p.x + obj.width / 2
    p.y = p.y + obj.height / 2
    return p
  };

  const inward = obj.treeConnection.incoming || {};
  const outward = obj.treeConnection.outgoing || {};
  if (inward.lines && inward.point) {
    p = getPointCoords(obj, null);
    inward.lines.map(findIfRequired).filter(it => it).forEach(l => {
      l.set('x2', p.x);
      l.set('y2', p.y);
      obj.setCoords();
      l.setCoords();
      pc.renderAll();
    });
  }
  if (outward.lines && outward.point) {
    p = getPointCoords(obj, null);
    outward.lines.map(findIfRequired).filter(it => it).forEach(l => {
      l.set('x1', p.x);
      l.set('y1', p.y);
      obj.setCoords();
      l.setCoords();
      pc.renderAll();
    });
  }
}

function drawMathSymbols(text, top, left, id) {
  const matexInsertionPoint = window.matexInsertionPoint || {left: left || 100, top: top || 100}
  return new Promise((myResolve, myReject) => {
    matex(text, function (svg, width, height) {
      // Here you have a data url for a svg file
      // Draw using FabricJS:
      fabric.Image.fromURL(svg).then(function (img) {
        img.height = height;
        img.width = width;
        img.left = matexInsertionPoint.left
        img.top = matexInsertionPoint.top
        pc.add(img);
        if (id && window._) {
          _[id] = img
        }
        myResolve(img);
        update()
      });
    });
  }); //promise
}

function onMakeTreeClick() {
  if (!pc.getActiveObject()) {
    alert('Select an object first');
    return;
  }
  const promptStr = prompt(`Enter command. Examples:

Basic shapes:
• child1, child2, child3
• rect; child1, child2

Individual shapes:
• child1:rect, child2:circ, child3:diamond
• Task:rect, Decision:diamond, Process:elli

Directional arrows:
• arrow:out; child1, child2 (outgoing arrows)
• arrow:in; child1, child2 (incoming arrows)
• arrow:bi; child1, child2 (bidirectional)

Miro shapes:
• child1:hexagon, child2:star, child3:cloud
• Ideas:cloud, Action:rect, Goal:star

Combined:
• arrow:bi; Idea:cloud, Plan:rect, Execute:diamond`);

  if (!promptStr) return;
  makeSubtree(pc.getActiveObject(), promptStr)
}

function onRemoveTreeClick() {
  if (!pc.getActiveObject()) {
    alert('Select an object first');
    return;
  }
  const obj = pc.getActiveObject()

  if (obj.treeConnection && obj.treeConnection.outgoing) {
    obj.treeConnection.outgoing.lines.map(findIfRequired).forEach(l => {
      pc.remove(l);
    })
  }
  obj.treeConnection = null
}

function arrowButton() {
  if (!window.arrowButtonClicked) {
    window.arrowButtonClicked = {}
  }
}

function degroup(pc) {
  const grp = pc.getActiveObject();
  if (!grp || (grp.type !== 'group' && grp.type !== 'activeselection')) return;
  const items = grp.getObjects() || [];

  // Snapshot absolute world-space transforms for every item BEFORE any mutation,
  // while the group is still on canvas and item.group references are intact.
  const groupMatrix = grp.calcTransformMatrix();
  const absDecomposed = items.map(item =>
    fabric.util.qrDecompose(
      fabric.util.multiplyTransformMatrices(groupMatrix, item.calcOwnMatrix())
    )
  );

  pc.remove(grp);

  items.forEach((item, i) => {
    const d = absDecomposed[i];

    // Clear ALL parent back-references. Fabric v6 uses both `group` and `parent`
    // in calcTransformMatrix(). Leaving either set causes wrong rendering/hit-testing.
    item.group = undefined;
    item.parent = undefined;

    // Re-enable interactivity — items inside a group have these disabled
    // so only the group itself is selectable/evented.
    item.selectable = true;
    item.evented = true;
    item.hasControls = true;

    item.set({
      originX: 'center',
      originY: 'center',
      left:   d.translateX,
      top:    d.translateY,
      angle:  d.angle,
      scaleX: d.scaleX,
      scaleY: d.scaleY,
      skewX:  d.skewX,
      skewY:  0,
    });

    pc.add(item);
    // setCoords AFTER add so the canvas viewportTransform is available
    item.setCoords();
  });

  const sel = new fabric.ActiveSelection(items, { canvas: pc });
  pc.setActiveObject(sel);
  pc.requestRenderAll();
}

function group(pc) {
  const sel = pc.getActiveObject();
  if (!sel || sel.type !== 'activeselection') return;

  // Create a new Group from the selected objects
  const objectsToGroup = [...sel._objects];
  const group = new fabric.Group(objectsToGroup);

  // Remove the individual objects and add the group
  objectsToGroup.forEach(obj => pc.remove(obj));
  pc.add(group);

  // Discard current selection and set the group as active
  pc.discardActiveObject();
  pc.setActiveObject(group);
  pc.requestRenderAll();
}

window.drawingStack = []

function undoDrawing() {
  const last = oc.getObjects().pop()
  oc.remove(last)
  drawingStack.push(last)
  oc.renderAll();
}

function redoDrawing() {
  const last = drawingStack.pop()
  oc.add(last)
  oc.renderAll();
}

function saveCanvas() {
  const idx = window.savePoint || 0;

  localStorage.setItem('pc_' + idx, JSON.stringify(pc.toJSON()))
  localStorage.setItem('oc_' + idx, JSON.stringify(oc.toJSON()))

}

async function restoreCanvas() {
  const idx = Number.parseInt($('#savePoints').val())
  saveCanvas()
  window.savePoint = idx;
  pc.clear();
  oc.clear();
  const data = JSON.parse(localStorage.getItem('pc_' + idx))
  await pc.loadFromJSON(data)
  pc.renderAll();
  const data1 = JSON.parse(localStorage.getItem('oc_' + idx))
  await oc.loadFromJSON(data1)
  oc.renderAll();
}

function newCanvas() {
  saveCanvas()
  const idx = $('#savePoints option').length
  pc.clear();
  oc.clear();
  $('#savePoints').append('<option>' + idx + '</option>')
  $('#savePoints').val(idx + '')

  window.savePoint = idx;
}

function exportCanvas() {
  const data = JSON.stringify(pc.toJSON());
  const blob = new Blob([data], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `canvas_${new Date().toLocaleString().replaceAll(/[/, :]/g, "")}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  window.URL.revokeObjectURL(url);
}

function exportScript() {
  const executables = window.recordedScriptLines.map(line => {
    line = line.trim()
    let executable = `${line}`;
    if(line.startsWith('animate') || line.startsWith('Promise')) {
      executable = `return ${line};`
    }
    return `() => { ${executable} }`
  })
  const data = JSON.stringify(executables);
  const blob = new Blob([data], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `script_${new Date().toLocaleString().replaceAll(/[/, :]/g, "")}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  window.URL.revokeObjectURL(url);
}

/**
 *
 * @param obj
 * @param id
 * @param top
 * @param left
 * @returns {Promise<unknown>}
 */
async function addFromJSON(obj, top, left) {
  if (!obj) return;
  const canvas = pc;

  const objects = await fabric.util.enlivenObjects([obj]);
  const origRenderOnAddRemove = canvas.renderOnAddRemove;
  canvas.renderOnAddRemove = false;

  const res = [];
  objects.forEach(function (o) {
    o.set({top: top || obj.top, left: left || obj.left});
    canvas.add(o);
    res.push(o);
  });
  canvas.renderOnAddRemove = origRenderOnAddRemove;
  canvas.renderAll();
  return res[0];
}

function importIntoCanvas(txt) {
  const json = JSON.parse(txt);
  json.objects?.forEach((obj) => {
    addFromJSON(obj)
  })
}

function loadFabricImage(url) {
  fabric.Image.fromURL(url).then(function (oImg) {
    oImg.set({ left: 100, top: 100 });
    pc.add(oImg);
    $('#imageInputUrl').val('')
  });
}
