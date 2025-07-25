window.globalVariableNames = {
  "matrices": 0,
  "arrays": 0,
  "texts": 0
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function it() { return pc.getActiveObject() }

fabric.Object.prototype.getZIndex = function() {
  return this.canvas.getObjects().indexOf(this);
}

// Extended fabric line class
fabric.Image.filters.WhiteToTransparent = fabric.util.createClass({

  type: 'whiteToTransparent',

  applyTo: function(canvasEl) {
    const context = canvasEl.getContext('2d'),
        imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
        pix = imageData.data;

    const newColor = {r:0,g:0,b:0, a:0};
    for (let i = 0, n = pix.length; i <n; i += 4) {
      const r = pix[i],
          g = pix[i+1],
          b = pix[i+2];

      if(r == 255&& g == 255 && b == 255){
        // Change the white to the new color.
        pix[i] = newColor.r;
        pix[i+1] = newColor.g;
        pix[i+2] = newColor.b;
        pix[i+3] = newColor.a;
      }
    }


    context.putImageData(imageData, 0, 0);
  }
});

fabric.LineArrow = fabric.util.createClass(fabric.Line, {

  type: 'lineArrow',

  initialize: function(element, options) {
    options || (options = {});
    this.callSuper('initialize', element, options);
  },

  toObject: function() {
    return fabric.util.object.extend(this.callSuper('toObject'));
  },

  _render: function(ctx) {
    this.callSuper('_render', ctx);

    // do not render if width/height are zeros or object is not visible
    if (this.width === 0 || this.height === 0 || !this.visible) return;

    ctx.save();

    const xDiff = this.x2 - this.x1;
    const yDiff = this.y2 - this.y1;
    const angle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1) * 180 / Math.PI;

    ctx.translate(this.x2,this.y2)

    //ctx.rotate(angle);
    ctx.beginPath();
    //move 10px in front of line to start the arrow so it does not have the square line end showing in front (0,0)
    //ctx.moveTo(10, 0);

    ctx.lineTo(10*Math.cos(angle), 10*Math.sin(angle))
    ctx.translate(this.x2,this.y2)

    ctx.lineTo(-10*Math.cos(angle), -10*Math.sin(angle))
    ctx.closePath();
    ctx.fillStyle = this.stroke;
    //ctx.fill();

    ctx.restore();

  }
});

fabric.LineArrow.fromObject = function(object, callback) {
  callback && callback(new fabric.LineArrow([object.x1, object.y1, object.x2, object.y2], object));
};

fabric.LineArrow.async = true;

fabric.Canvas.prototype.add = (function (originalFn) {
  return function (...args) {
    originalFn.call(this, ...args);
    if(!args[0].uid) {
      const uid = uuid();
      args[0].uid = uid;
      customData(args[0]).uid = uid;
      console.log('added obj ' + uid);
      const type = ' ' + customData(args[0]).type || ''
      window.objectIds.add({uid: uid, type: 'fabric.js' + type});
      updateObjectIdsUi()
    } else {
      console.log('Id already exist');
    }

    return this
  };
})(fabric.Canvas.prototype.add);

fabric.Sprite = fabric.util.createClass(fabric.Image, {

  type: 'sprite',

  spriteWidth: 50,
  spriteHeight: 72,
  spriteIndex: 0,
  frameTime: 100,

  initialize: function (element, options) {
    options || (options = {});

    options.width = this.spriteWidth;
    options.height = this.spriteHeight;

    this.callSuper('initialize', element, options);

    this.createTmpCanvas();
    this.createSpriteImages();
  },

  createTmpCanvas: function () {
    this.tmpCanvasEl = fabric.util.createCanvasElement();
    this.tmpCanvasEl.width = this.spriteWidth || this.width;
    this.tmpCanvasEl.height = this.spriteHeight || this.height;
  },

  createSpriteImages: function () {
    this.spriteImages = [];

    const steps = this._element.width / this.spriteWidth;
    for (let i = 0; i < steps; i++) {
      this.createSpriteImage(i);
    }
  },

  createSpriteImage: function (i) {
    const tmpCtx = this.tmpCanvasEl.getContext('2d');
    tmpCtx.clearRect(0, 0, this.tmpCanvasEl.width, this.tmpCanvasEl.height);
    tmpCtx.drawImage(this._element, -i * this.spriteWidth, 0);

    const dataURL = this.tmpCanvasEl.toDataURL('image/png');
    const tmpImg = fabric.util.createImage();

    tmpImg.src = dataURL;
    tmpImg.crossOrigin = 'anonymous'

    this.spriteImages.push(tmpImg);
  },

  _render: function (ctx) {
    ctx.drawImage(
        this.spriteImages[this.spriteIndex],
        -this.width / 2,
        -this.height / 2
    );
  },

  play: function () {
    const _this = this;
    this.animInterval = setInterval(function () {

      _this.onPlay && _this.onPlay();
      _this.dirty = true;
      _this.spriteIndex++;
      if (_this.spriteIndex === _this.spriteImages.length) {
        _this.spriteIndex = 0;
      }
    }, this.frameTime);
  },

  stop: function () {
    clearInterval(this.animInterval);
  }
});

fabric.Sprite.fromURL = function (url, callback, imgOptions) {
  fabric.util.loadImage(url, function (img) {
    img.crossOrigin = 'anonymous'
    callback(new fabric.Sprite(img, imgOptions));
  });
};

fabric.Sprite.async = true;

fabric.Object.prototype.toObject = (function (toObject) {
  return function () {
    let props = {
    };
    if(this.customData)
      props.customData = this.customData
    if(this.uid)
      props.uid = this.uid
    if(this.treeConnection)
      props.treeConnection = this.treeConnection
    if(this.text)
      props.text = this.text
    return fabric.util.object.extend(toObject.call(this), props);
  };
})(fabric.Object.prototype.toObject);

fabric.Object.prototype.stateProperties = fabric.Object.prototype.stateProperties.concat('customData', 'uid', 'treeConnection');

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
    const _objs = objs || pc.getActiveGroup()._objects
    _objs.forEach(o => o._objects[0].setFill(c))

  } catch (e) {
    try {
      pc.getActiveObject().setFill(c)
    } catch (e) {
      console.log(e);
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
    line.remove()
  })
  obj.treeConnection?.outgoing?.lines?.map(findIfRequired)?.forEach((line) => {
    line.remove()
  })

  pc.remove(obj)
  pc.renderAll()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deleteSelectedObjects() {
  const activeObject = pc.getActiveObject();
  if(activeObject) {
    deleteFabricObject(activeObject);
    recordScript(`deleteFabricObject('${activeObject.uid}')`)
  } else {
    const activeGroup = pc.getActiveGroup();
    if (activeGroup) {
      activeGroup._objects.forEach(x => {
        deleteFabricObject(x)
        recordScript(`deleteFabricObject('${x.uid}')`)
      })
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

  return new Promise((done, error) => {
    obj.clone(cloned => {
      done(cloned)
    });
  }).then(x => {
    pc.add(x);
    return x
  });
}

function copy(canvas, obj) {
  // clone what are you copying since you
  // may want copy and paste on different moment.
  // and you do not want the changes happened
  // later to reflect on the copy.
  const target = obj || canvas.getActiveObject() || canvas.getActiveGroup();
  if (!target) return;

  target.clone(function (cloned) {
    _clipboard = cloned;
  });
  window.canPasteImageFromClipboard = false;
}

function paste(canvas) {
  if (!window._clipboard) return;

  window.canPasteImageFromClipboard = true;
  // clone again, so you can do multiple copies.
  _clipboard.clone(function (clonedObj) {
    canvas.discardActiveObject();
    canvas.discardActiveGroup();

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


    //canvas.setActiveObject(clonedObj);
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
  let obj = pc.getActiveObject()

  const promptStr = prompt('Enter command')
  if (!promptStr || promptStr.split(":").length !== 2) return

  editFabricjsObject(promptStr, obj);
  recordScript(`editFabricjsObject(${JSON.stringify(promptStr)}, '${obj.uid}');`)
}

function makeLine(coords) {
  let line = new fabric.Line(coords, {
    fill: 'red',
    stroke: 'red',
    strokeWidth: 2,
    selectable: false
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
  if (split.length === 2) {
    cmds = split[0]
    values = split[1]
  } else if (split.length === 1) {
    cmds = 'none';
    values = split[0]
  }

  values = values.split(',')
  if (values.length === 0) {
    return
  }

  const shape = cmds.trim()

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

    let mid = Math.ceil(values.length / 2)
    if (values.length === 1) mid = 0;

    const w = (options.width / 2) / values.length;

    let x = px,
        y = py + options.height;

    const addConnection = (x1, y1, x2, y2, text, valuesIndex) => {
      const targetNode = shape === 'none' ?
          textInRect(text, x2, y2, {fill: 'black'}, {fill: 'white'})
          : boundedText(shape)(text, x2, y2, {}, {})
      if(idMappings[valuesIndex]) {
        targetNode.uid = idMappings[valuesIndex]
      }
      pc.add(targetNode)
      const line = makeLine([x1, y1, targetNode.getCenterPoint().x, targetNode.getCenterPoint().y])
      customData(line).source = node.uid ? node.uid: node
      customData(line).target = targetNode.uid ? targetNode.uid : targetNode
      pc.add(line)
      pc.sendToBack(line)
      node.treeConnection.outgoing = node.treeConnection.outgoing || defaultOutgoing()
      node.treeConnection.outgoing.lines.push(line.uid)

      targetNode.treeConnection = {
        incoming: {
          lines: [line],
          point: 'centre'
        }
      }
      targetNode.onAnimationChange = () => updateTreeItem(targetNode)

      if(options.overlapOnRoot) {
        pc.bringToFront(targetNode)
      }
      return targetNode
    }

    if(options.overlapOnRoot) {
      x = px; y = py;
    }
    let t = addConnection(px, py, x, y, values[mid], mid)
    idMappings[mid] = t.uid

    for (let i = mid - 1; i >= 0; i--) {
      x = x - w;
      if(options.overlapOnRoot) {
        x = px; y = py;
      }
      t = addConnection(px, py, x, y, values[i], i)
      idMappings[i] = t.uid
    }

    x = px;
    y = py;

    for (let i = mid + 1; i < values.length; i++) {
      x = x + w;
      if(options.overlapOnRoot) {
        x = px; y = py;
      }
      t = addConnection(px, py, x, y, values[i], i)
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
    let prevProps = customData(target).prevProps
    animate(target, {top: prevProps.top, left: prevProps.left}, {onComplete: e => {
        //pc.moveTo(target, prevProps.zIndex)
        pc.bringToFront(target)
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
          pc.sendToBack(target)
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
  values
    ex. "child1, child2, child3",
        "rect; child1, child2"
        "shape:rect,bg:red,fg:white; child1, child2" --TODO
 */
function makeSubtree(node, values, opts) {
  opts = opts || {}
  opts.overlapOnRoot = true
  opts.idMappings = renderSubtree(values, opts, node)
  //TODO: Find the closest obj which was recorded so we know its uid,
  // and find the relation to that i.e (level, index, data); And use that in the record script
  recordScript(`renderSubtree(${JSON.stringify(values)}, ${JSON.stringify(opts)}, '${node.uid}')`)
}

//Returns calculated top(y), left(x) which works even if the object is in group
let getActualProperties = (object, round) => {
  object = findIfRequired(object)
  let roundFn = x => x
  if(round) {
    roundFn = x => Math.round(x * 100) / 100
  }
  let mat = object.calcTransformMatrix(false);
  // Assuming objects origin x/y is 'left'/'top'; TODO for others
  let props =  {
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
    let p = getActualProperties(obj)
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
      fabric.Image.fromURL(svg, function (img) {
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
  const promptStr = prompt('Enter command. E.g. child1, child2, child3 OR rect; child1, child2')
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
  const grp = pc.getActiveObject()
  if (grp.type !== 'group') return;
  const items = grp.getObjects() || []
  grp.destroy();
  pc.remove(grp);
  items.forEach(item => pc.add(item));
  items.forEach(item => item.hasControls = false);
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

  localStorage.setItem('pc_' + idx, JSON.stringify(pc.toDatalessJSON()))
  localStorage.setItem('oc_' + idx, JSON.stringify(oc.toDatalessJSON()))

}

function restoreCanvas() {
  const idx = Number.parseInt($('#savePoints').val())
  saveCanvas()
  window.savePoint = idx;
  pc.clear();
  oc.clear();
  const data = JSON.parse(localStorage.getItem('pc_' + idx))
  pc.loadFromDatalessJSON(data)

  pc.renderAll();
  const data1 = JSON.parse(localStorage.getItem('oc_' + idx))
  oc.loadFromDatalessJSON(data1)
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
  let executables = window.recordedScriptLines.map(line => {
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
function addFromJSON(obj, top, left) {
  if (!obj) return Promise.resolve();
  const canvas = pc;

  const items = [obj]

  return new Promise((myResolve, myReject) => {
    fabric.util.enlivenObjects(items, function (objects) {
      const origRenderOnAddRemove = canvas.renderOnAddRemove;
      canvas.renderOnAddRemove = false;

      const res = []
      let i = 0;
      objects.forEach(function (o) {
        o.set({top: top || obj.top, left: left || obj.left});
        canvas.add(o);
        res.push(o);
      });
      canvas.renderOnAddRemove = origRenderOnAddRemove;
      canvas.renderAll();
      myResolve(res[0]);
    });
  })
}

function importIntoCanvas(txt) {
  const json = JSON.parse(txt);
  json.objects?.forEach((obj) => {
    addFromJSON(obj)
  })
}

function loadFabricImage(url) {
  fabric.Image.fromURL(url, function (oImg) {
    oImg.set({
      'left': 100
    });
    oImg.set({
      'top': 100
    });
    pc.add(oImg);
    $('#imageInputUrl').val('')
  });
}
