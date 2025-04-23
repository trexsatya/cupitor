window.globalVariableNames = {
  "matrices": 0,
  "arrays": 0,
  "texts": 0
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function it() { return pc.getActiveObject() }

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

window.animationScriptFunction = null

function speak(msg, name) {
  if (msg.endsWith('.mp3')) {
    const base_path = window.baseAudioPath || ""

    return new Promise((myResolve, myReject) => {
      const a = new Audio(base_path + "/" + msg);
      a.play()
      a.onended = e => myResolve(e)
    })
  }
  const speech = new SpeechSynthesisUtterance();
  const options = Object.assign({
    name: 'Samantha',
    volume: 0.9,
    rate: 1,
    pitch: 1
  }, window.speechOptions);
  if (name) options.name = name;

  //console.log(voice.name)
  speech.voice = speechSynthesis.getVoices().find(it => it.name === options.name);
  speech.text = msg;
  speech.volume = options.volume;
  speech.rate = options.rate;
  speech.pitch = options.pitch;

  window.speechSynthesis.speak(speech);

  return new Promise(function (myResolve) {
    speech.onend = e => {
      myResolve()
    }
  });
}

const pos = obj => {
  const c = obj.aCoords
  return {
    ...c,
    ml: {x: c.tl.x, y: c.tl.y + (c.bl.y - c.tl.y) / 2},
    mr: {x: c.tr.x, y: c.tr.y + (c.br.y - c.tr.y) / 2},
    mt: {y: c.tl.y, x: c.tl.x + (c.tr.x - c.tl.x) / 2},
    mb: {y: c.bl.y, x: c.bl.x + (c.br.x - c.bl.x) / 2},
  }
}

function resumeAnimationScript() {
  if (!window.animationScriptFunction) {
    console.log("No animation function!!!")
    return
  }
  window.animationScriptFunction()
  window.animationScriptFunction = null
  window.stopAnimationSignal = false;
  $('#btnResumeAnimation').hide();
  $('#btnStopAnimation').show();
}

function stopAnimationScript() {
  window.stopAnimationSignal = true;
  $('#btnStopAnimation').hide();
  $('#btnResumeAnimation').show();
}

function scanMatrix(name) {
  const _scann = []
  for (let i = 1; i <= 4; i++) {
    for (let j = 1; j <= 3; j++) {
      _scann.push([i, j])
    }
  }
  schedule(_scann, 0.5, (xy) => {
    globalVariableNames[name].at(xy[0], xy[1]).click();
  })
}

function playCode(code) {

  $('#editor').show();
  const lines = code.split("");
  const indices = [...Array(lines.length).keys()];
  schedule(indices, 0.1, (ln) => {
    editor.setValue(lines.slice(0, ln + 1).join(""));
    editor.getSelection().clearSelection();
  }, () => {
    resumeAnimationScript()
  })

}

function createTextBox(text, css) {
  css = Object.assign({}, css, {padding: 20})
  css.position = 'absolute'

  const item = $(`<div class="text"> ${text}</div>`).css(css)

  txt.append(item)
  $(item).draggable()

  return item;
}

function bringInText(text, opts) {
  opts = Object.assign({}, {
    mode: 'down-up',
    from: {
      top: 800,
      left: 600
    },
    to: {}
  }, opts || {})

  let css = {fontSize: 'x-large', color: 'blue', paddingRight: '1em'}

  if (opts.mode == 'down-up') {
    css = Object.assign(css, {left: opts.from.left, top: opts.from.top, position: 'fixed'}, opts)
  }

  if (opts.mode == 'right-left') {
    css = Object.assign(css, {left: opts.from.left, top: opts.from.top, position: 'fixed'}, opts)
  }

  const item = createTextBox(text, css)

  return new Promise((myResolve, myReject) => {
    const options = {duration: 1000};
    const fn = opts.complete || (() => {
    });
    options.complete = (it) => {
      fn(it);
      myResolve(item);
    }
    $(item).velocity(opts.to, options);

    window.globalVariableNames['texts'] += 1
    const varName = "T" + window.globalVariableNames['texts']
    logItem(varName, item, 'Text', {
      delete: (nm) => {
        globalVariableNames[nm].remove()
      }
    })
  })

}

function highlightByChangingColor(el) {

}

function highlightByGradientColor(el) {
  $(el).css({backgroundImage: 'radial-gradient(#ece8e8, green, blue)'})
}

/**
 * type => type of change, el => target element
 */
function changeTableCell(type, el, value, dataCells) {
  const applyChange = (target) => {
    if (type == 'data') {
      target.find('span.item').html(value)
    }
    if (type == 'css') {
      target.css(value)
    }
  }

  applyChange(el)

  //apply same change to all selected elements if there are more than one!
  if (dataCells) {
    const highlightedEls = dataCells.filter((i, x) => $(x).hasClass("highlighted"))
    if (highlightedEls.length > 1) {
      highlightedEls.each((i, e) => {
        applyChange($(e))
      })
    }
  }
  //..................
}

function resetTableCell(el) {
  const v = $(el).data("value")
  const change = changeTableCell;
  change('css', $(el), {color: 'black', backgroundColor: 'white', backgroundImage: 'none'})
  change('data', $(el), v);
}

function resetMatrix(name) {
  const dataCells = globalVariableNames[name].all.find('.data td');
  dataCells.each((i, e) => {
    resetTableCell($(e));
  });
}

function contextMenuListener(el, dataCells) {
  el.addEventListener("contextmenu", function (e) {
//      console.log(e, el);
    e.preventDefault()

    const change = (x, y, z) => changeTableCell(x, y, z, dataCells);

    $('#edit-table-cell-toolbar').show().css({left: e.x, top: e.y});
    $('#edit-table-cell-toolbar input[name="value"]').unbind('change').on('change', e => {
//        console.log(e.target.value)
      change('data', $(el), e.target.value);
    });
    $('#edit-table-cell-toolbar input[name="value"]').unbind('focusout').on('focusout', e => {
//          console.log(e.target.value)
      change('data', $(el), e.target.value);
    });

    $('#edit-table-cell-toolbar input[name="background"]').unbind('change').change(e => {
//        console.log(e.target.value)
      change('css', $(el), {backgroundColor: e.target.value})
    });
    $('#edit-table-cell-toolbar input[name="color"]').unbind('change').change(e => {
//        console.log(e.target.value)
      change('css', $(el), {color: e.target.value})
    });
    $('#edit-table-cell-toolbar button.reset').unbind('click').click(e => {
      resetTableCell($(el))
    });

  });
}


function highlightMatrixColumn(num, id) {
  globalVariableNames[id].all.find(`*[data-column=${num}]`).addClass('highlighted')
}

function unHighlightMatrixColumn(num, id) {
  globalVariableNames[id].all.find(`*[data-column=${num}]`).removeClass('highlighted')
}

function highlightMatrixRow(num, id) {
  globalVariableNames[id].all.find(`*[data-row=${num}]`).addClass('highlighted')
}

function unHighlightMatrixRow(num, id) {
  globalVariableNames[id].all.find(`*[data-row=${num}]`).removeClass('highlighted')
}


function addHighlightCapability(el, others) {
  $(el).click(e => {
    if (!e.ctrlKey)
      others.each((i, other) => {
        $(other).removeClass('highlighted')
      });
    if (e.ctrlKey && $(el).hasClass('highlighted'))
      $(el).removeClass('highlighted');
    else
      $(el).addClass('highlighted');
  });
}

function createMatrix(sel) {

  const data = $(sel).find('input[name="data"]').val()
  const location = $(sel).find('input[name="location"]').val()
  const size = $(sel).find('input[name="size"]').val()

  const xtitle = $(sel).find('input[name="xtitle"]').val()
  const ytitle = $(sel).find('input[name="ytitle"]').val()
  const xheaders = $(sel).find('input[name="xheaders"]').val()
  const yheaders = $(sel).find('input[name="yheaders"]').val()

  _createMatrix({sel, data, location, size, xtitle, ytitle, xheaders, yheaders})
}

function _createMatrix(vals) {
  let data = vals.data, location = vals.location || vals.position || '160,20',
    size = vals.size || '600,400',
    sel = vals.sel,
    xtitle = vals.xtitle || 'Columns',
    ytitle = vals.ytitle || 'Rows',
    _xheaders = vals.xheaders || 'indices',
    _yheaders = vals.yheaders || 'indices'
  width = vals.width, height = vals.height;

  let xheaders = null, yheaders = null

  let tableData = []
  try {
    const _data = eval("[" + data + "]")
    //TODO: Check data is in correct format

    tableData = _data;

    if (_xheaders === 'indices') {
      xheaders = [...Array(_data[0].length).keys()];
    } else {
      xheaders = eval("[" + _xheaders + "]")
    }

    if (_yheaders === 'indices') {
      yheaders = [...Array(_data.length).keys()];
      console.log(yheaders)
    } else {
      yheaders = eval("[" + _yheaders + "]")
    }

    size = eval("[" + size + "]")
    location = eval("[" + location + "]")
  } catch (e) {
    console.log(e);
  }

  if (width) size[0] = width;
  if (height) size[1] = height;

  const tableOpts = {
    ytitle: ytitle, xtitle: xtitle, xheaders: xheaders, yheaders: yheaders,
    width: size[0], height: size[1],
    top: location[0], left: location[1]
  }

  if (window.theme == 'black') {
    tableOpts.backgroundColor = 'black'
    tableOpts.color = 'white'
  } else {
    tableOpts.backgroundColor = 'white'
    tableOpts.color = 'black'
  }

  const table = appendTableInto(tableData, $('#textillateContainer'), tableOpts)

  const dataCells = table.all.find('.data td')

  table.all.find('table.data td').each((i, el) => {
    contextMenuListener(el, dataCells);
  });

  dataCells.each((i, el) => {
    addHighlightCapability(el, dataCells)
  });

  table.all.find("th:nth(0)").click(e => {
    dataCells.each((i, td) => {
      $(td).removeClass('highlighted')
    });
  })

  if (_xheaders == 'indices') {
    $(table.all.find('table tr')[0]).css({
      height: 40
    })
  }

  window.globalVariableNames['matrices'] += 1
  const varName = "M" + window.globalVariableNames['matrices']
  logItem(varName, table, 'Table', {delete: () => globalVariableNames[varName].all.remove()})

  $(sel).dialog('close');
  moveToFront('txt')

  return table
}

function createArray(sel) {

  const data = $(sel).find('input[name="data"]').val()
  const location = $(sel).find('input[name="location"]').val()
  let size = $(sel).find('input[name="size"]').val() || '600,400'

  const xtitle = $(sel).find('input[name="xtitle"]').val() || ''
  const ytitle = $(sel).find('input[name="ytitle"]').val() || ''
  const _xheaders = $(sel).find('input[name="xheaders"]').val() || 'indices'
  const _yheaders = $(sel).find('input[name="yheaders"]').val() || '"Values","Sorted","Reverse"'

  let xheaders = null, yheaders = null

  let tableData = []
  try {
    const _data = eval("[" + data + "]")
    //TODO: Check data is in correct format
    tableData = [_data, _data.map(x => x).sort(), _data.map(x => x).reverse()];
    if (_xheaders === 'indices') {
      xheaders = [...Array(_data.length).keys()];
    } else {
      xheaders = eval("[" + _xheaders + "]")
    }

    if (_yheaders === 'indices') {
      yheaders = [...Array(_data.length).keys()];
      console.log(yheaders)
    } else {
      yheaders = eval("[" + _yheaders + "]")
    }

    size = eval("[" + size + "]")
  } catch (e) {
    console.log(e)
  }

  const tableOpts = {
    ytitle: ytitle,
    xtitle: xtitle,
    xheaders: xheaders,
    yheaders: yheaders,
    width: size[0],
    height: size[1]
  }

  if (window.theme == 'black') {
    tableOpts.backgroundColor = 'black'
    tableOpts.color = 'white'
  } else {
    tableOpts.backgroundColor = 'white'
    tableOpts.color = 'black'
  }

  const table = appendTableInto(tableData, $('#textillateContainer'), tableOpts)

  const dataCells = table.all.find('.data td')

  table.all.find('table.data td').each((i, el) => {
    contextMenuListener(el, dataCells);
  });

  dataCells.each((i, el) => {
    addHighlightCapability(el, dataCells)
  });

  if (_xheaders == 'indices') {
    $(table.all.find('table tr')[0]).css({
      height: 40
    })
  }

  window.globalVariableNames['arrays'] += 1
  const varName = "A" + window.globalVariableNames['matrices']
  logItem(varName, table, 'Table', {
    delete: (nm) => {
      globalVariableNames[nm].all.remove()
    }
  })

  $(sel).dialog('close');
  moveToFront('txt')
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

function getScript(id) {
  $.ajax(`/api/${id}`).then(resp => {
    // console.log(resp)
    window.jsToExecute = {
      lines: resp,
      index: 0
    }
  })
}

const id = window.location.hash.replace("#", "")
if (id) getScript(id)

function executeNextLine() {
  if (window.jsToExecute) {
    eval(window.jsToExecute.lines[window.jsToExecute.index])
    window.jsToExecute.index = window.jsToExecute.index + 1
  }
}

function zoomSelectedObject(isPlus) {
  if (!pc.getActiveObject()) return;
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

function deleteSelectedObjects() {
  const activeObject = pc.getActiveObject();
  if (activeObject) {
    activeObject?.treeConnection?.incoming?.lines?.forEach((line) => { line.remove() })
    pc.remove(activeObject)
  }
  const activeGroup = pc.getActiveGroup();
  if (activeGroup) {
    activeGroup._objects.forEach(x => pc.remove(x))
  }
  pc.renderAll()
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
  obj?.visible = visibility;
  obj?.treeConnection?.incoming?.lines?.forEach((line) => {
    line.visible = visibility;
  });
  pc?.renderAll();
}

function hideObject(obj) {
  if(obj === undefined || obj === null) return;

  obj = findIfRequired(obj)
  setObjVisibility(obj, true);
}

function showObject(obj) {
  if(obj === undefined || obj === null) return;

  obj = findIfRequired(obj)
  setObjVisibility(obj, false);
}

function editFabricjsObject(txt, obj) {
  obj = findIfRequired(obj)

  const command = txt.split(":")[0]
  const data = txt.split(":")[1].trim()

  if (!obj._objects || obj._objects.length < 2) return;

  switch (command) {
    case 'bg':
      obj._objects[0].set({
        fill: data
      })
      break
    case 'fg':
      obj._objects[1].set({
        fill: data
      })
      break
    case 'text':
      obj._objects[1].set({
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
    point: 'mb'
  });
  node.treeConnection = node.treeConnection || {
    incoming: {},
    outgoing: defaultOutgoing()
  };

  if (node.oCoords && node.oCoords.mb) {
    const px = node.oCoords.mb.x,
        py = node.oCoords.mb.y;

    let mid = Math.ceil(values.length / 2)
    if (values.length === 1) mid = 0;

    const w = (options.width / 2) / values.length;

    let x = px,
        y = py + options.height;

    const addConnection = (x1, y1, x2, y2, text) => {
      const textNode = shape === 'none' ?
          textInRect(text, x2, y2, {fill: 'black'}, {fill: 'white'})
          : boundedText(shape)(text, x2, y2, {}, {})
      pc.add(textNode)
      const line = makeLine([x1, y1, textNode.oCoords.mt.x, textNode.oCoords.mt.y])
      pc.add(line)
      node.treeConnection.outgoing = node.treeConnection.outgoing || defaultOutgoing()
      node.treeConnection.outgoing.lines.push(line)

      textNode.treeConnection = {
        incoming: {
          lines: [line],
          point: 'mt'
        }
      }
      textNode.onAnimationChange = () => updateTreeItem(textNode)
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
let getActualProperties = (object) => {
  let mat = object.calcTransformMatrix(false);
  // Assuming objects origin x/y is 'left'/'top'; TODO for others
  return  {
    x: mat[4] - object.width/2,
    y: mat[5] - object.height/2,
    w: object.width,
    h: object.height,
    fill: object.fill,
    angle: object.angle,
    skewX: object.skewX,
    skewY: object.skewY,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    opacity: object.opacity
  }
};

function updateTreeItem(t) {
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
  };

  if (t.treeConnection) {
    const inward = t.treeConnection.incoming || {};
    const outward = t.treeConnection.outgoing || {};

    if (inward.lines && inward.point) {
      var p = getPointCoords(t, inward.point)
      inward.lines.forEach(l => {
        l.set('x2', p.x);
        l.set('y2', p.y);
        t.setCoords();
        l.setCoords();
        pc.renderAll();
      });
    }
    if (outward.lines && outward.point) {
      var p = getPointCoords(t, outward.point)
      outward.lines.forEach(l => {
        l.set('x1', p.x);
        l.set('y1', p.y);
        t.setCoords();
        l.setCoords();
        pc.renderAll();
      });
    }
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
  if (grp.type != 'group') return;
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

function moveToFront(whichOne) {
  switch (whichOne) {
    case 'pc':
      $('.canvas-container').css({zIndex: -2000})
      $('#textillateContainer').css({zIndex: -2000})
      $($('.canvas-container')[0]).css({zIndex: 2000})
      window.layerOnFront = 'pc'
      break;
    case 'oc':
      $('.canvas-container').css({zIndex: -2000})
      $('#textillateContainer').css({zIndex: -2000})
      $($('.canvas-container')[1]).css({zIndex: 2000})
      window.layerOnFront = 'oc'
      break;
    case 'txt':
      $('.canvas-container').css({zIndex: -2000})
      $('#textillateContainer').css({zIndex: 2000})
      window.layerOnFront = 'txt'
      break;
  }
  $('#layerInfo').html(window.layerOnFront)
}//end moveToFront

//play from files
const openFile = function (event) {
  const input = event.target;

  const readFile = (filename) => {
    if (!filename) return "{}"
    const promise = new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const text = reader.result;
        console.log(reader.result.substring(0, 200));
        resolve(text)
      };
      reader.readAsText(filename);
    });

    return promise
  } //

  const len = input.files.length

  const getFile = nm => {
    const x = range(0, len).find(i => input.files[i].name.indexOf(nm) > 0);
    return input.files[x]
  }

  Promise.all([
    readFile(getFile('_pc')),
    readFile(getFile('_oc')),
    readFile(getFile('_txt')),
  ]).then(data => {
    const pcData = JSON.parse(data[0])
    const ocData = JSON.parse(data[1])
    const txtData = JSON.parse(data[2])

    const frames = obj => Object.keys(obj).map(x => Number.parseInt(x)).sort((a, b) => a - b);

    playRecording(40, {
      pc: [pcData, frames(pcData)],
      oc: [ocData, frames(ocData)],
      txt: [txtData, frames(txtData)]
    });
    stopPlayback = true;

    moveToFront('pc')
    $('#toolbar1-buttons').hide()
    $('#drawing-mode-options').hide()
    $("#recordingFileChooserDialog").dialog('destroy')

  }).finally(data => {
    console.log(data)
  });

}; //end openFile

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

function handleFileDialogButtons(src) {
  if (src == "OK") {
    const url = $('#imageInputUrl').val()
    if (url) {
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
    } else {
      //Handle file selection
      const file = document.querySelector('#imageInputFile').files[0];
      const reader = new FileReader();
      reader.addEventListener("load", function () {
        fabric.Image.fromURL(reader.result, function (oImg) {
          oImg.set({
            'left': 100
          });
          oImg.set({
            'top': 100
          });
          pc.add(oImg);
        });
      }, false);
      if (file) {
        reader.readAsDataURL(file);
      }
    }
    $('#imageInputDialog').hide();
  } else {
    $('#imageInputDialog').hide();
  }
}


const dmp = new diff_match_patch();

function toggleRecording() {
  if (window.playingMode) {
    if (!window.stopPlayback) window.stopPlayback = true
    else window.stopPlayback = false;

    return;
  }
  ;
  window.recording = !window.recording
  if (!window.recording) {
    $('#recording-info').html('Stopped at: ' + recordingTimer)
  }
}

function initializeRecording() {
  //if(window.playingMode) return;
  if (window.playingMode) {
    const conf = confirm('You Are In Playing Mode. U Sure To Record?')
    if (!conf) return;

    Object.keys(localStorage).filter(x => x.startsWith(`recording_`)).forEach(x => {
      localStorage.removeItem('recording_pc_' + x);
      localStorage.removeItem('recording_oc_' + x);
      localStorage.removeItem('recording_txt_' + x);
    })

    localStorage.clear();
  }
  $('#toolbarToggle').click()
  $('#toolbarToggle1').click()

  window.playingMode = false
  window.recording = true;
  window.prevCanvasStates = {}
  window.recordingTimer = window.recordingTimer || 0;

  if (!window.recordingName) {
    window.recordingName = prompt('Name of recording?')
  }

  const changesInCanvas = (prevCanvasState, newCanvasState, name) => {
    const diff = dmp.diff_main(JSON.stringify(prevCanvasState), JSON.stringify(newCanvasState), true);

    if (diff.length > 0) {
      if (diff.length > 2) {
        dmp.diff_cleanupSemantic(diff);
      }

      const patch_list = dmp.patch_make(JSON.stringify(prevCanvasState), JSON.stringify(newCanvasState), diff);
      patch_text = dmp.patch_toText(patch_list);

      if (patch_text.length > 0) {
        return patch_text
      }

    }
    ;
    return null;
  }//changesInCanvas

  const zInices = () => {
    return [$($('.canvas-container')[0]).css('zIndex'), $($('.canvas-container')[1]).css('zIndex'), $('#textillateContainer').css('zIndex')];
  };

  window.recordingInterval = setInterval(x => {
    if (!window.recording) return;

    const postToServer = (data, part) => $.ajax({
      url: 'http://localhost:8081/api/recording/push?name=' + window.recordingName + "&component=" + part,
      method: 'post',
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json'
    })

    const newCanvasStates = {
      pc: pc.toDatalessJSON(),
      oc: oc.toDatalessJSON(),
      text: $('#textillateContainer').html()
    }
    try {

      const pcChanges = changesInCanvas(prevCanvasStates.pc || {}, newCanvasStates.pc)
      if (pcChanges) {
        var key = '' + recordingTimer
        var data = {}
        data[key] = {zIndex: zInices(), state: newCanvasStates.pc}
        postToServer(data, 'pc')
        prevCanvasStates.pc = newCanvasStates.pc
      }

      const ocChanges = changesInCanvas(prevCanvasStates.oc || {}, newCanvasStates.oc)
      if (ocChanges) {
        var key = '' + recordingTimer
        var data = {}
        data[key] = {zIndex: zInices(), state: newCanvasStates.oc}
        postToServer(data, 'oc')

        prevCanvasStates.oc = newCanvasStates.oc
      }

      const htmlChanges = changesInCanvas(prevCanvasStates.text || {}, newCanvasStates.text)
      if (htmlChanges.length && newCanvasStates.text) {
        var key = '' + recordingTimer
        var data = {}
        data[key] = {zIndex: zInices(), state: newCanvasStates.text};
        postToServer(data, 'txt')

        prevCanvasStates.text = newCanvasStates.text
      }
    } catch (e) {
      console.log('Probably quota of localStorage exceeded! Stopping Recording')
      //recording = false

    }


    $('#recording-info').html('Recording: ' + window.recordingTimer)
    recordingTimer++;
  }, 4) //40 milliseconds

}

function closest(num, arr) {
  let mid;
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    mid = Math.floor((lo + hi) / 2);
    if (arr[mid] < num) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (num - arr[lo] <= arr[hi] - num) {
    return arr[lo];
  }
  return arr[hi];
}

function snapValue(value, values) {
  adjustedValue = closest(value, values) || value;
  console.log(`${value} snapped to ${adjustedValue}`)

  $("#rollbackConfirmationDialog .slider").slider('value', adjustedValue)
  return adjustedValue
}

function launchRollbackRecording() {
  const saved = reconstructCanvasStates('pc')
  const savedTxt = reconstructCanvasStates('txt')
  const savedOc = reconstructCanvasStates('oc')

  const frames = saved[1] //sorted

  $("#rollbackConfirmationDialog").dialog({
    buttons: [
      {
        text: "Ok Rollback",
        click: function () {
          $(this).dialog("close");
          rollbackRecordingTo({
            pc: saved,
            oc: savedOc,
            txt: savedTxt
          }, Number.parseInt($('#rollbackConfirmationDialog span.info').html()))
        }
      }
    ]//buttons
  });

  moveToFront('txt')

  $("#rollbackConfirmationDialog .slider").slider({
    range: false,
    min: 0,
    max: frames[frames.length - 1] + 1,
    slide: (x, y) => {
      const val = snapValue(y.value, frames)
      $('#rollbackConfirmationDialog span.info').html(val)
    }

  }); //

}

function rollbackRecordingTo(saved, time) {
  if (!time) return;

  pc.loadFromDatalessJSON(saved['pc'][0][time])
  pc.renderAll()
  if (saved['oc']) {
    var x = closest(time, saved['oc'][1])
    oc.loadFromDatalessJSON(saved['oc'][0][x])
    oc.renderAll()
  }
  if (saved['txt']) {
    var x = closest(time, saved['txt'][1])
    $('#textillateContainer').html(saved['txt'][0][x])
  }
  let toRemove = Object.keys(localStorage).filter(x => x.startsWith(`recording_pc_`)).map(x => Number.parseInt(x.split("_")[2])).filter(x => x > time)

  toRemove.forEach(x => localStorage.removeItem('recording_pc_' + x))

  console.log('Removed ' + toRemove.length + ' frames of pc!')

  toRemove = Object.keys(localStorage).filter(x => x.startsWith(`recording_oc_`)).map(x => Number.parseInt(x.split("_")[2])).filter(x => x > time)

  toRemove.forEach(x => localStorage.removeItem('recording_oc_' + x))

  console.log('Removed ' + toRemove.length + ' frames of oc!')

  window.recordingTimer = time;
  $('#recording-info').html('Rollbacked To: ' + time);


}


function reconstructCanvasStates(name) {
  const frames = Object.keys(localStorage).filter(x => x.startsWith(`recording_${name}_`)).map(x => Number.parseInt(x.split("_")[2])).sort((a, b) => a - b);

  const reconstructedCanvasStates = {}
  const reducer = (initialOrAccumulator, currentValue) => {
    const patches = dmp.patch_fromText(localStorage[`recording_${name}_${currentValue}`]);
    const results = dmp.patch_apply(patches, initialOrAccumulator);
    reconstructedCanvasStates[currentValue] = JSON.parse(results[0]);
    return results[0]
  };
  frames.reduce(reducer, JSON.stringify({}))

  return [reconstructedCanvasStates, frames];
}


function launchRecordingDialog() {
  $("#recordingFileChooserDialog").dialog({
    buttons: [
      {
        text: "Play From LocalStorage",
        click: function () {
          $(this).dialog("close");
          playRecording(null)
        }
      }
    ]//buttons
  });
  moveToFront('txt')

}

function playRecording(speedInMilliseconds, data) {
  console.log('Playing')
  window.recordingMode = false;
  window.playingMode = true;
  $('#toolbar1-buttons').hide()
  $('#drawing-mode-options').hide()

  speedInMilliseconds = speedInMilliseconds || 4;
  let x = null;
  let y = null;
  let z = null;

  if (data) {
    x = data.pc
    y = data.oc
    z = data.txt
  } else {
    x = reconstructCanvasStates('pc')
    y = reconstructCanvasStates('oc')
    z = reconstructCanvasStates('txt')
  }


  const reconstructedCanvasStatesPc = x[0]
  const reconstructedCanvasStatesOc = y[0]
  const reconstructedCanvasStatesTxt = z[0]
  const framesPc = x[1]
  const framesOc = y[1]
  const framesTxt = z[1]

  console.log('PcFrames:' + `${framesPc[0]} ${framesPc[framesPc.length - 1]}`)
  console.log('OcFrames:' + `${framesOc[0]} ${framesOc[framesOc.length - 1]}`)
  console.log('TxtFrames:' + `${framesTxt[0]} ${framesTxt[framesTxt.length - 1]}`)

  let count = framesPc[framesPc.length - 1]
  if (framesOc[framesOc.length - 1] > count) count = framesOc[framesOc.length - 1]
  if (framesTxt[framesTxt.length - 1] > count) count = framesTxt[framesTxt.length - 1]

  window.playerTimerTotal = count;


  const source = Rx.Observable.interval(speedInMilliseconds).timeInterval().take(count);

  window.playerTimer = framesPc[0]
  if (framesOc[0] < window.playerTimer) window.playerTimer = framesOc[0]
  if (framesTxt[0] < window.playerTimer) window.playerTimer = framesTxt[0]

  window.playerTimerStart = playerTimer

  $('#playbackControls .slider').slider({
    min: playerTimer,
    max: count,
    step: 10,
    value: playerTimer,
    slide: (x, y) => {
      $('#playbackControls .slider').find(".ui-slider-handle").text(y.value);
      playerTimer = y.value
      stopPlayback = true;
      setTimeout(x => {
        stopPlayback = false;
      }, 2)
    }
  })
  $($('#playbackControls span.time')[0]).html(playerTimer)
  $($('#playbackControls span.time')[1]).html(count)

  $('#playbackControls').show().css({zIndex: 100000})

  let playerInterval = null;

  //This is so that I can add delays at frame points programmatically.
  let delayAmount = 0;
  let delayInterval = 0;

  playerInterval = setInterval(x => {
    if (playerTimer > count) {
      clearInterval(playerInterval)
      window.recordingTimer = playerTimer;
      return;
    }
    if (window.stopPlayback) return;

    $('#recording-info').html('Playing: ' + playerTimer);

    const f = playerTimer;
    const statesPc = reconstructedCanvasStatesPc[f] && reconstructedCanvasStatesPc[f].state
    if (statesPc) {
      $($('.canvas-container')[0]).css({zIndex: reconstructedCanvasStatesPc[f].zIndex[0]})
      $($('.canvas-container')[1]).css({zIndex: reconstructedCanvasStatesPc[f].zIndex[1]})
      $('#textillateContainer').css({zIndex: reconstructedCanvasStatesPc[f].zIndex[2]})
      pc.loadFromDatalessJSON(statesPc, () => pc.renderAll());
    }

    const statesOc = reconstructedCanvasStatesOc[f] && reconstructedCanvasStatesOc[f].state
    if (statesOc) {
      $($('.canvas-container')[0]).css({zIndex: reconstructedCanvasStatesOc[f].zIndex[0]})
      $($('.canvas-container')[1]).css({zIndex: reconstructedCanvasStatesOc[f].zIndex[1]})
      $('#textillateContainer').css({zIndex: reconstructedCanvasStatesOc[f].zIndex[2]})
      oc.loadFromDatalessJSON(statesOc, () => oc.renderAll());
    }

    const statesTxt = reconstructedCanvasStatesTxt[f] && reconstructedCanvasStatesTxt[f].state
    if (statesTxt) {
      $($('.canvas-container')[0]).css({zIndex: reconstructedCanvasStatesTxt[f].zIndex[0]})
      $($('.canvas-container')[1]).css({zIndex: reconstructedCanvasStatesTxt[f].zIndex[1]})
      $('#textillateContainer').css({zIndex: reconstructedCanvasStatesTxt[f].zIndex[2]})
      $('#textillateContainer').html(statesTxt);

    }
    $("#slider").val(playerTimer);
    $("#slider").slider("refresh");

    delayAmount = (window.delayPoints && window.delayPoints[playerTimer]) || 0

    if (delayInterval >= delayAmount) {
      delayAmount = 0;
      delayInterval = 0;
    }
    if (delayAmount == 0) {
      playerTimer++;
    } else {
      console.log('delaying')
      delayInterval++;
    }

  }, 1);

}//End playRecording

function saveRecording() {
  const saved = reconstructCanvasStates('pc')
  const savedTxt = reconstructCanvasStates('txt')
  const savedOc = reconstructCanvasStates('oc')

  if (!window.recordingName) {
    let name = prompt('Recording Name?')
    if (!name) name = new Date().toISOString();

  }

  const num = window.currentRecordingSliceNumber || 1
  download(JSON.stringify(saved[0]), `recording_pc.${num}.txt`, "plain/text")
  download(JSON.stringify(savedOc[0]), `recording_oc.${num}.txt`, "plain/text")
  download(JSON.stringify(savedTxt[0]), `recording_txt.${num}.txt`, "plain/text")

  window.currentRecordingSliceNumber++;

  localStorage.clear()
}

function download(data, filename, type) {
  const file = new Blob([data], {type: type});
  if (window.navigator.msSaveOrOpenBlob) // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  else { // Others
    const a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}

$(document).ready(function () {
  const icon = $('.play');
  icon.click(function () {
    icon.toggleClass('active');
    return false;
  });
});

document.onclick = e => {
  window.lastClickedX = e.clientX;
  window.lastClickedY = e.clientY;
}

window.canPasteImageFromClipboard = true;
document.onpaste = function (event) {

//		  console.log(event)
  // use event.originalEvent.clipboard for newer chrome versions
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  console.log(JSON.stringify(items)); // will give you the mime types
  // find pasted image among pasted items
  let blob = null;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") === 0) {
      blob = items[i].getAsFile();
    }
  }
  // load image if there is a pasted image
  if (blob !== null) {
    if (!canPasteImageFromClipboard) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const url = event.target.result; // data url!
      if (url.indexOf("data") >= 0) {

        if (window.insertPastedImageIntoFabric) {
          fabric.Image.fromURL(url, function (oImg) {
            oImg.set({
              'left': window.lastClickedX || 100
            });
            oImg.set({
              'top': window.lastClickedY || 100
            });
            oc.add(oImg);
          });
        } else {
          const id = prompt('Enter id')
          if (id) {
            const container = $('<div>').css({
              display: 'inline-block',
              position: 'absolute'
            }).attr({'id': id})
            window.pastedItems = window.pastedItems || {}
            window.pastedItems[id] = 1;

            const img = $('<img>').attr({src: url})
            img.css({
              left: window.lastClickedX || 100,
              top: window.lastClickedY || 100,
              width: '100%',
              height: '100%'
            })

            container.prepend(img)
            const i = new Image();

            i.onload = function () {
              console.log(i.width + ", " + i.height);
              $('#textillateContainer').append(container)
              container.css({width: i.width, height: i.height})
              container.resizable()
              container.draggable()
              moveToFront('txt')
            };

            i.src = url;
          }
        }

      }
    };
    reader.readAsDataURL(blob);
  }
}//onpaste


function scrollBackgroundInf() {
  let x = 0;
  window.bgScroll = setInterval(function () {
    x -= 1;
    $('body').css('background-position', x + 'px 0');
  }, 10);
}

function stopBackgroundScroll() {
  if (window.bgScroll) clearInterval(window.bgScroll)
}

const checkAndInject = function (name, url) {
  if (typeof window[name] != 'undefined') {
    return console.log(name + ' already present: v' + jQuery.fn.jquery);
  }
  const script = document.createElement('script');
  script.src = url;
  let head = document.getElementsByTagName('head')[0],
    done = false;
  script.onload = script.onreadystatechange = function () {
    if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
      done = true;
      if (typeof jQuery == 'undefined') {
        console.log(name + ' not loaded');
      } else {
        console.log(name + ' loaded');
      }
      script.onload = script.onreadystatechange = null;
      head.removeChild(script);
    }
  };
  head.appendChild(script);
};
