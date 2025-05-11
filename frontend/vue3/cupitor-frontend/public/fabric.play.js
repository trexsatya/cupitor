window.globalVariableNames = {
  "matrices": 0,
  "arrays": 0,
  "texts": 0
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function it() { return pc.getActiveObject() }

function customData(obj) {
  return obj.customData || {}
}

fabric.Object.prototype.getZIndex = function() {
  return this.canvas.getObjects().indexOf(this);
}

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

function executeNextLine() {
  if (window.jsToExecute) {
    eval(window.jsToExecute.lines[window.jsToExecute.index])
    window.jsToExecute.index = window.jsToExecute.index + 1
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
  if (obj) {
    obj?.treeConnection?.incoming?.lines?.forEach((line) => {
      line.remove()
    })
    obj?.treeConnection?.outgoing?.lines?.forEach((line) => {
      line.remove()
    })
    pc.remove(obj)
  }
  pc.renderAll()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deleteSelectedObjects() {
  const activeObject = pc.getActiveObject();
  if(activeObject) {
    deleteFabricObject(activeObject);
    recordScript(`deleteFabricObject(${activeObject.uid})`)
  } else {
    const activeGroup = pc.getActiveGroup();
    if (activeGroup) {
      activeGroup._objects.forEach(x => {
        deleteFabricObject(x)
        recordScript(`deleteFabricObject(${x.uid})`)
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

function setObjVisibility(obj, visibility) {
  obj && (obj.visible = visibility);
  obj?.treeConnection?.incoming?.lines?.forEach((line) => {
    line.visible = visibility;
  });
  obj?.treeConnection?.outgoing?.lines?.forEach((line) => {
    line.visible = visibility;
  });
  pc?.renderAll();
}

function hideObject(obj) {
  if(obj === undefined || obj === null) return;

  obj = findIfRequired(obj)
  setObjVisibility(obj, false);
}

function showObject(obj) {
  if(obj === undefined || obj === null) return;

  obj = findIfRequired(obj)
  setObjVisibility(obj, true);
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
  recordScript(`editFabricjsObject(${JSON.stringify(promptStr)}, ${obj.uid});`)
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

  const options = opts || {
    width: 150,
    height: 60
  };

  let defaultOutgoing = () => ({
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

    const addConnection = (x1, y1, x2, y2, text) => {
      const targetNode = shape === 'none' ?
          textInRect(text, x2, y2, {fill: 'black'}, {fill: 'white'})
          : boundedText(shape)(text, x2, y2, {}, {})
      pc.add(targetNode)
      const line = makeLine([x1, y1, targetNode.getCenterPoint().x, targetNode.getCenterPoint().y])
      customData(line).source = node
      customData(line).target = targetNode
      pc.add(line)
      pc.sendToBack(line)
      node.treeConnection.outgoing = node.treeConnection.outgoing || defaultOutgoing()
      node.treeConnection.outgoing.lines.push(line)

      targetNode.treeConnection = {
        incoming: {
          lines: [line],
          point: 'centre'
        }
      }
      targetNode.onAnimationChange = () => updateTreeItem(targetNode)
    }

    addConnection(px, py, x, y, values[mid])

    for (let i = mid - 1; i >= 0; i--) {
      x = x - w;
      addConnection(px, py, x, y, values[i])
    }

    x = px;
    y = py;

    for (let i = mid + 1; i < values.length; i++) {
      x = x + w;
      addConnection(px, py, x, y, values[i])
    }
  }
}

function getAllOutgoingTargets(obj) {
  obj = findIfRequired(obj)
  if(!obj) return []
  const res = []
  _getAllOutgoingTargets(obj, res)
  return res.flat()
}

function _getAllOutgoingTargets(obj, out) {
    const lines = obj?.treeConnection?.outgoing?.lines;
    if(!lines) {
      return;
    }
    const targets = lines?.map(it => customData(it).target)
    out.push(targets)
    targets.forEach(it => {
      _getAllOutgoingTargets(it, out)
    })
}

function expandTreeItems(obj) {
  obj = findIfRequired(obj)
  if(!obj) return;

  getAllOutgoingTargets(obj).forEach(target => {
    showObject(target)
    let prevProps = customData(target).prevProps
    animate(target, {top: prevProps.top, left: prevProps.left}, {onComplete: e => {
        //pc.moveTo(target, prevProps.zIndex)
        pc.bringToFront(target)
      }})
  })
}

function collapseTreeItems(obj) {
  obj = findIfRequired(obj)
  if(!obj) return;
  getAllOutgoingTargets(obj).forEach(target => {
    customData(target).prevProps = getActualProperties(target)
    animate(target, {top: obj.top, left: obj.left}, {onComplete: e => {
        hideObject(target)
      }})
    pc.sendToBack(target)
  })
}

/***
  values
    ex. "child1, child2, child3",
        "rect; child1, child2"
        "shape:rect,bg:red,fg:white; child1, child2" --TODO
 */
function makeSubtree(node, values, opts) {
  renderSubtree(values, opts, node);
  recordScript(`renderSubtree(${JSON.stringify(values)}, ${JSON.stringify(opts)}, ${node.uid})`)
}

//Returns calculated top(y), left(x) works even if object is in group
let getActualProperties = (object, round) => {
  obj = findIfRequired(object)
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
    inward.lines.forEach(l => {
      l.set('x2', p.x);
      l.set('y2', p.y);
      obj.setCoords();
      l.setCoords();
      pc.renderAll();
    });
  }
  if (outward.lines && outward.point) {
    p = getPointCoords(obj, null);
    outward.lines.forEach(l => {
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
    obj.treeConnection.outgoing.lines.forEach(l => {
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
