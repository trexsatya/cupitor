window.globalVariableNames = {
    "matrices": 0,
    "arrays": 0,
    "texts": 0
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

function float(x){
  return Number.parseFloat(x)
}

function range(...arr){
  if(arr.length == 1){
    return [...Array(arr[0]).keys()]
  }
  return [...Array(arr[1] - arr[0]).keys()].map(x => x + arr[0]);
}


function createArrow(){
  let arr = $(`<div class="arrow"/>`),
    line = $(`<div class="line"></div>`),
    point = $(`<div class="point"></div>`);

  arr.css({width:'120px',
      margin: '50px auto'});
  line.css({
      'margin-top':'14px',
      width: '90px',
      background: 'blue',
      height: '10px',
      float: 'left'
  });

  point.css({width: 0,
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

function typeQuote(text, _options) {
  let options = Object.assign({}, {
    wait: 0,
    theme: 'black',
    onComplete: () => {},
    css: {  }}, _options);

  if(Object.keys(options.css).length > 0) {
    options.css.position = 'absolute'
    options.css.marginTop = 0
  }

  let textillateContainer = $('#textillateContainer');
  let savedCssTC = {
      zIndex: textillateContainer.css('z-index'),
      color: textillateContainer.css('color'),
      backgroundColor:  textillateContainer.css('backgroundColor'),
      font: textillateContainer.css('font'),
      top: textillateContainer.css('top'),
      left: textillateContainer.css('left')
    }

  let cinemaText = $('#cinemaText');
  let savedCssCT = {
      zIndex: cinemaText.css('z-index'),
      color: cinemaText.css('color'),
      backgroundColor:  cinemaText.css('backgroundColor'),
      font: cinemaText.css('font'),
      top: cinemaText.css('top'),
      left: cinemaText.css('left'),
      marginTop: cinemaText.css('marginTop')
    }

    let cinemaHtml = cinemaText.html()

    if(options.theme === 'black') {
        textillateContainer.css({ backgroundColor: '#1a1a1a', zIndex: 900000})
        cinemaText.css({ color: 'white'})
    }
    cinemaText.css(options.css)

    let start = new Date().getTime();

    type(text, '#cinemaText', { onComplete: (self) => {
        setTimeout(()=> {
          console.log("typed in " + (new Date().getTime() - start)/1000 + "secs")
          textillateContainer.css(savedCssTC);
          cinemaText.css(savedCssCT);
          cinemaText.html(cinemaHtml);
          self.destroy();
          options.onComplete();
        }, options.wait * 1000)
    }})
}

function typeAndDisappear(text, opts) {
  let options = Object.assign({}, {wait: 100}, opts);

  let id = "T"+new Date().getTime();
  // id = "cinemaText"
  let T = createTextBox('', opts).attr('id', id)

  window.id = id
  return id
}

function resetTextillateContainer() {
    $('#textillateContainer').css({ backgroundColor: 'white'})
    $('#cinemaText').css({ color: 'black'})
    $('#cinemaText').html('')
}

function type(strings, elSelector, opts) {
  var options = Object.assign({}, {
    strings: [strings].flat(),
    onComplete: (self) => {}
  }, opts);

  $('#typed-strings').html("<p>"+strings+ "</p>")

  let prettyLog = (x) => console.log(x);

  var typed = new Typed(elSelector, {
    stringsElement: '#typed-strings',
    typeSpeed: 40,
    backSpeed: 0,
    backDelay: 500,
    startDelay: 1000,
    loop: false,
    onComplete: function(self) {
        // prettyLog('onCmplete ' + self); self.destroy();
       options.onComplete(self);
    },
    onDestroy: function(self) {
      console.log("destroyed")
    }

  });
  return typed;
}

//Accessor for matrix
function at(matrix, i,j) { return $(matrix.all.find(`table.data td[data-row='${i}']`)[j]); }

window.animationScriptFunction = null
/**
* taskRunner => a function that will use data items.
* data => array of data items or array of functions. If data item is a function it will be used as taskRunner for that interval.
*     taskRunner can return false to stop the further invocations. taskRunner can return time delay in seconds before next invocation occurs.
*     taskRunner can return 'WAIT_FOR_SIGNAL' which means that next invocation will occur only when signal is received.
*/
function schedule(data, timeInSeconds, taskRunner, onComplete) {
  data = data.map(x => x); //clone
  let fn = null;
  fn = (x) => setTimeout(() => {
     let first = data.splice(0,1);
     if(first.length) {
       let task = typeof(first[0]) == 'function' ? first[0] : () => taskRunner(first[0])
       let result = task()

       if(result !== false) {
          let delay = timeInSeconds*1000
          if(typeof(result) == 'number') delay = result * 1000

          if(result ===  -1) {
            if(window.animationScriptFunction) {
              console.log('There is already a function for animation script!!!')
            } else {
              window.animationScriptFunction = () => fn(delay) //Store function
              console.log("Waiting for signal. Call resumeAnimationScript()")
              $('#btnResumeAnimation').show();
            }
          } else {
            fn(delay)
          }
       } else {
          console.log("Ended because function returned false!")
       }
     } else {
       if(onComplete) onComplete();
     }
  }, x);
  fn(0);
}

function resumeAnimationScript() {
  if(!window.animationScriptFunction) {
    console.log("No animation function!!!")
    return
  }
  window.animationScriptFunction()
  window.animationScriptFunction = null
  $('#btnResumeAnimation').hide();
}

function scanMatrix(name) {
  let _scann = []
  for(var i=1; i <= 4; i++) {
    for(var j=1; j <= 3; j++) {
      _scann.push([i,j])
    }
  }
  schedule(_scann, 0.5, (xy) => { globalVariableNames[name].at(xy[0], xy[1]).click(); })
}

function playCode(code) {

  $('#editor').show();
  let lines = code.split("");
  let indices = [...Array(lines.length).keys()];
  schedule(indices, 0.1, (ln)=> {
    editor.setValue(lines.slice(0, ln+1).join(""));
    editor.getSelection().clearSelection();
  }, () => {
    resumeAnimationScript()
  })

}

function createTextBox(text, css) {
  css = Object.assign({}, css, { padding: 20 })
  css.position = 'absolute'

  let item = $(`<div class="text"> ${text}</div>`).css(css)

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
    to: {

    }
  }, opts || {})

  let css = { fontSize: 'x-large', color: 'blue', paddingRight: '1em'}

  if(opts.mode == 'down-up') {
    css = Object.assign(css, {left: opts.from.left, top: opts.from.top, position: 'fixed'}, opts)
  }

  if(opts.mode == 'right-left') {
    css = Object.assign(css, {left: opts.from.left, top: opts.from.top, position: 'fixed' }, opts)
  }

  var item = createTextBox(text, css)

  $(item).velocity(opts.to, {duration: 1000});

  window.globalVariableNames['texts'] += 1
  var varName = "T"+ window.globalVariableNames['texts']
  logItem(varName, item, 'Text', {delete: (nm) => {
      globalVariableNames[nm].remove()
  }})

  return item;
}

function highlightByChangingColor(el) {

}

function highlightByGradientColor(el){
  $(el).css({ backgroundImage: 'radial-gradient(#ece8e8, green, blue)' })
}

/**
 * type => type of change, el => target element
*/
function changeTableCell(type, el, value, dataCells) {
   let applyChange = (target) => {
     if(type == 'data') {
       target.find('span.item').html(value)
     }
     if(type == 'css') {
       target.css(value)
     }
   }

   applyChange(el)

   //apply same change to all selected elements if there are more than one!
   if(dataCells) {
     let highlightedEls = dataCells.filter((i,x) => $(x).hasClass("highlighted"))
     if(highlightedEls.length > 1) {
         highlightedEls.each((i,e) => {
             applyChange($(e))
         })
     }
   }
   //..................
}

function resetTableCell(el) {
  let v = $(el).data("value")
  let change = changeTableCell;
  change('css', $(el), { color: 'black', backgroundColor: 'white', backgroundImage: 'none'})
  change('data', $(el), v);
}

function resetMatrix(name) {
  var dataCells = globalVariableNames[name].all.find('.data td');
  dataCells.each((i, e) => {
    resetTableCell($(e));
  });
}

function contextMenuListener(el, dataCells) {
    el.addEventListener( "contextmenu", function(e) {
//      console.log(e, el);
      e.preventDefault()

      let change = (x,y,z) => changeTableCell(x,y,z, dataCells);

      $('#edit-table-cell-toolbar').show().css({ left: e.x, top: e.y});
      $('#edit-table-cell-toolbar input[name="value"]').unbind('change').on('change',e => {
//        console.log(e.target.value)
          change('data', $(el), e.target.value);
      });
      $('#edit-table-cell-toolbar input[name="value"]').unbind('focusout').on('focusout',e => {
//          console.log(e.target.value)
          change('data', $(el), e.target.value);
      });

      $('#edit-table-cell-toolbar input[name="background"]').unbind('change').change(e => {
//        console.log(e.target.value)
          change('css', $(el), { backgroundColor: e.target.value})
      });
      $('#edit-table-cell-toolbar input[name="color"]').unbind('change').change(e => {
//        console.log(e.target.value)
          change('css', $(el), { color: e.target.value})
      });
      $('#edit-table-cell-toolbar button.reset').unbind('click').click(e => {
          resetTableCell($(el))
       });

    });
}


function highlightMatrixColumn(num, id){
  globalVariableNames[id].all.find(`*[data-column=${num}]`).addClass('highlighted')
}

function unHighlightMatrixColumn(num, id){
  globalVariableNames[id].all.find(`*[data-column=${num}]`).removeClass('highlighted')
}

function highlightMatrixRow(num, id){
  globalVariableNames[id].all.find(`*[data-row=${num}]`).addClass('highlighted')
}

function unHighlightMatrixRow(num, id){
  globalVariableNames[id].all.find(`*[data-row=${num}]`).removeClass('highlighted')
}


function addHighlightCapability(el, others){
    $(el).click(e => {
       if(!e.ctrlKey)
        others.each((i,other) => {
            $(other).removeClass('highlighted')
        });
        if(e.ctrlKey && $(el).hasClass('highlighted'))
          $(el).removeClass('highlighted');
        else
          $(el).addClass('highlighted');
    });
}

function createMatrix(sel) {

    var data = $(sel).find('input[name="data"]').val()
    var location = $(sel).find('input[name="location"]').val()
    var size = $(sel).find('input[name="size"]').val()

    var xtitle = $(sel).find('input[name="xtitle"]').val()
    var ytitle = $(sel).find('input[name="ytitle"]').val()
    var xheaders = $(sel).find('input[name="xheaders"]').val()
    var yheaders = $(sel).find('input[name="yheaders"]').val()

    _createMatrix({sel, data, location, size, xtitle, ytitle, xheaders, yheaders})
}

function _createMatrix(vals){
  let data = vals.data, location = vals.location || vals.position || '160,20',
      size = vals.size || '600,400',
      sel = vals.sel,
      xtitle = vals.xtitle || 'Columns',
      ytitle = vals.ytitle || 'Rows',
      _xheaders = vals.xheaders || 'indices',
      _yheaders = vals.yheaders || 'indices'
      width = vals.width, height = vals.height;

     var xheaders = null, yheaders = null

      var tableData = []
      try {
          var _data = eval("["+ data + "]")
          //TODO: Check data is in correct format

          tableData = _data;

          if(_xheaders === 'indices') {
              xheaders = [...Array(_data[0].length).keys()];
          } else {
              xheaders = eval("[" + _xheaders + "]")
          }

          if(_yheaders === 'indices') {
              yheaders = [...Array(_data.length).keys()];
              console.log(yheaders)
          } else {
              yheaders = eval("[" + _yheaders + "]")
          }

          size = eval("[" + size + "]")
          location = eval("[" + location + "]")
      } catch(e) {
          console.log(e);
      }

      if(width) size[0] = width;
      if(height) size[1] = height;

      var tableOpts = { ytitle: ytitle, xtitle: xtitle, xheaders: xheaders, yheaders: yheaders,
                        width: size[0], height: size[1],
                        top: location[0], left: location[1]
                      }

      if(window.theme == 'black') {
          tableOpts.backgroundColor = 'black'
          tableOpts.color = 'white'
      } else {
          tableOpts.backgroundColor = 'white'
          tableOpts.color = 'black'
      }

      var table = appendTableInto(tableData, $('#textillateContainer'), tableOpts)

      var dataCells = table.all.find('.data td')

      table.all.find('table.data td').each((i,el) => {
          contextMenuListener(el, dataCells);
      });

      dataCells.each((i,el) => {
          addHighlightCapability(el, dataCells)
      });

      table.all.find("th:nth(0)").click(e => {
          dataCells.each((i, td) => {
               $(td).removeClass('highlighted')
          });
      })

      if(_xheaders == 'indices'){
          $(table.all.find('table tr')[0]).css({
              height: 40
          })
      }

      window.globalVariableNames['matrices'] += 1
      var varName = "M"+ window.globalVariableNames['matrices']
      logItem(varName, table, 'Table', {delete: () => globalVariableNames[varName].all.remove() })

      $(sel).dialog('close');
      moveToFront('txt')

      return table
}

function createArray(sel) {

    var data = $(sel).find('input[name="data"]').val()
    var location = $(sel).find('input[name="location"]').val()
    var size = $(sel).find('input[name="size"]').val() || '600,400'

    var xtitle = $(sel).find('input[name="xtitle"]').val() || ''
    var ytitle = $(sel).find('input[name="ytitle"]').val() || ''
    var _xheaders = $(sel).find('input[name="xheaders"]').val() || 'indices'
    var _yheaders = $(sel).find('input[name="yheaders"]').val() || '"Values","Sorted","Reverse"'

    var xheaders = null, yheaders = null

    var tableData = []
    try {
        var _data = eval("["+ data + "]")
        //TODO: Check data is in correct format
        tableData = [_data, _data.map(x => x).sort(), _data.map(x => x).reverse()];
        if(_xheaders === 'indices') {
            xheaders = [...Array(_data.length).keys()];
        } else {
            xheaders = eval("[" + _xheaders + "]")
        }

        if(_yheaders === 'indices') {
            yheaders = [...Array(_data.length).keys()];
            console.log(yheaders)
        } else {
            yheaders = eval("[" + _yheaders + "]")
        }

        size = eval("[" + size + "]")
    } catch(e) {
        console.log(e)
    }

    var tableOpts = { ytitle: ytitle, xtitle: xtitle, xheaders: xheaders, yheaders: yheaders, width: size[0], height: size[1]}

    if(window.theme == 'black') {
        tableOpts.backgroundColor = 'black'
        tableOpts.color = 'white'
    } else {
        tableOpts.backgroundColor = 'white'
        tableOpts.color = 'black'
    }

    var table = appendTableInto(tableData, $('#textillateContainer'), tableOpts)

    var dataCells = table.all.find('.data td')

    table.all.find('table.data td').each((i,el) => {
        contextMenuListener(el, dataCells);
    });

    dataCells.each((i,el) => {
        addHighlightCapability(el, dataCells)
    });

    if(_xheaders == 'indices'){
        $(table.all.find('table tr')[0]).css({
            height: 40
        })
    }

    window.globalVariableNames['arrays'] += 1
    var varName = "A"+ window.globalVariableNames['matrices']
    logItem(varName, table, 'Table', {delete: (nm) => {
        globalVariableNames[nm].all.remove()
    } })

    $(sel).dialog('close');
    moveToFront('txt')
}

function superimposeOverlayCanvas() {
    var pos = $('#playerCanvas').position()
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


function ArrayPlusDelay(array, delegate, delay) {
  var i = 0

   // seed first call and store interval (to clear later)
  var interval = setInterval(function() {
        // each loop, call passed in function
      delegate(array[i]);

        // increment, and if we're past array, clear interval
      if (i++ >= array.length - 1)
          clearInterval(interval);
  }, delay)

  return interval
}

function changeCircleColor(c, objs) {
    try {
        var _objs = objs || pc.getActiveGroup()._objects
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
    var connectionModeOn = window.connectionMode || false;

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
        console.log(resp)
        window.jsToExecute = {
            lines: resp,
            index: 0
        }
    })
}
var id = window.location.hash.replace("#", "")
if (id) getScript(id)

function executeNextLine() {
    if (window.jsToExecute) {
        eval(window.jsToExecute.lines[window.jsToExecute.index])
        window.jsToExecute.index = window.jsToExecute.index + 1
    }
}

function zoomSelectedObject(isPlus) {
    if (!pc.getActiveObject()) return;
    var amount = 1.5

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
}

function moveActiveObject(prop, amount) {
    var activeObject = pc.getActiveObject()
    if(!activeObject) return;
    activeObject[prop] = activeObject[prop] + amount
    activeObject.setCoords();
    pc.renderAll()
}

function deleteSelectedObjects() {
    if(pc.getActiveObject())
        pc.remove(pc.getActiveObject())
    if (pc.getActiveGroup()) {
        pc.getActiveGroup()._objects.forEach(x => pc.remove(x))
    }
    pc.renderAll()
}

function applyBlackTheme(){
    $("#textillateContainer").css({ backgroundColor: 'black', color: 'white'});
    window.theme = 'black';

}

function mergeDuplicateOfSrcIntoDest(src, dest, onComplete, opts) {
  let options = Object.assign({}, opts, { delay: 1000})
  duplicate(src).then(x => {
    $(x).animate({
      top: dest.offset().top,
      left: dest.offset().left
    }, options.delay, ()=> {
      $(x).remove();
      onComplete(src, dest)
    })
  })
}

function duplicate(obj) {
  if(!obj) return

  if(obj instanceof jQuery) {
    return new Promise((done, error) => {
      let clone = $(obj).clone();
      txt.append(clone);
      $(clone).draggable()
      done(clone);
    })
  }

  return new Promise((done, error) => {
    obj.clone(cloned => {
      done(cloned)
    });
  }).then(x => { pc.add(x); return x});
}

function Copy(canvas) {
    // clone what are you copying since you
    // may want copy and paste on different moment.
    // and you do not want the changes happened
    // later to reflect on the copy.
    var target = canvas.getActiveObject() || canvas.getActiveGroup();
    if(!target) return;

    target.clone(function(cloned) {
        _clipboard = cloned;
    });
    window.canPasteImageFromClipboard = false;
}

function Paste(canvas) {
    if (!window._clipboard) return;

    window.canPasteImageFromClipboard = true;
    // clone again, so you can do multiple copies.
    _clipboard.clone(function(clonedObj) {
        canvas.discardActiveObject();
        canvas.discardActiveGroup();

        var options = {
            left: clonedObj.left + 10,
            top: clonedObj.top + 10,
            evented: true,
        };

        clonedObj.set(options);

        if (clonedObj.type === 'activeSelection') {
            // active selection needs a reference to the canvas.
            clonedObj.canvas = canvas;
            clonedObj.forEachObject(function(obj) {
                canvas.add(obj);
                var tr = obj.calcTransformMatrix()
                options.left = obj.left + 10 + tr[4]
                options.top = obj.top + 10 + tr[5]
                obj.set(options)
                obj.setCoords();
            });

        } else {
            canvas.add(clonedObj);
        }
        _clipboard.top += 10;
        _clipboard.left += 10;
        //canvas.setActiveObject(clonedObj);
        canvas.renderAll();
    });
}

function editSelectedObject() {
    if (!pc.getActiveObject()) return;
    var obj = pc.getActiveObject()

    var p = prompt('Enter command')
    if (!p || !p.split(":").length == 2) return

    var command = p.split(":")[0]
    var data = p.split(":")[1].trim()

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
        case 'stop'	:
            stopAnimation(obj, pc)
            break
        case 'controls':
            obj.hasControls = data === 'on' ? true: false
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

function makeLine(coords) {
    return new fabric.Line(coords, {
        fill: 'red',
        stroke: 'red',
        strokeWidth: 2,
        selectable: false
    });
}

function makeSubtree(node, values, pc, opts) {
    var options = opts || {
        width: 150,
        height: 50
    };

    node.treeConnection = node.treeConnection || {
        incoming: {},
        outgoing: {}
    };

    if (node.oCoords && node.oCoords.mb) {
        var px = node.oCoords.mb.x,
            py = node.oCoords.mb.y;
        node.treeConnection.outgoing = {
            lines: [],
            point: 'mb'
        }

        var mid = Math.ceil(values.length / 2)
        if (values.length == 1) mid = 0;

        var w = (options.width / 2) / values.length;

        var x = px,
            y = py + options.height;

        var addConnection = (x1, y1, x2, y2, text) => {
            var circ = textInEllipse(text, x2, y2, {}, {})
            pc.add(circ)
            var line = makeLine([x1, y1, circ.oCoords.mt.x, circ.oCoords.mt.y])
            pc.add(line)
            node.treeConnection.outgoing.lines.push(line)

            circ.treeConnection = {
                incoming: {
                    lines: [line],
                    point: 'mt'
                }
            }
        }

        addConnection(px, py, x, y, values[mid])

        for (var i = mid - 1; i >= 0; i--) {
            x = x - w;
            addConnection(px, py, x, y, values[i])
        }

        x = px, y = py;

        for (var i = mid + 1; i < values.length; i++) {
            x = x + w;
            addConnection(px, py, x, y, values[i])
        }
    }
}

function drawMathSymbols(text, canvas) {
    matex(text, function(svg, width, height) {
        // Here you have a data url for a svg file
        // Draw using FabricJS:
        fabric.Image.fromURL(svg, function(img) {
            img.height = height;
            img.width = width;
            img.left = matexInsertionPoint.left
            img.top = matexInsertionPoint.top
            canvas.add(img);
        });
    });
}

function onMakeTreeClick() {
    if (!pc.getActiveObject()) {
        alert('Select an object first');
        return;
    }
    var p = prompt('Enter command')
    if (!p) return;
    makeSubtree(pc.getActiveObject(), p.split(','), pc)
}


function onRemoveTreeClick() {
    if (!pc.getActiveObject()) {
        alert('Select an object first');
        return;
    }
    var obj = pc.getActiveObject()

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
    var grp = pc.getActiveObject()
    if (grp.type != 'group') return;
    var items = grp.getObjects() || []
    grp.destroy();
    pc.remove(grp);
    items.forEach(item => pc.add(item));
    items.forEach(item => item.hasControls = false);
}

window.drawingStack = []
function undoDrawing(){
    var last = oc.getObjects().pop()
    oc.remove(last)
    drawingStack.push(last)
    oc.renderAll();
}
function redoDrawing(){
    var last = drawingStack.pop()
    oc.add(last)
    oc.renderAll();
}

function moveToFront(whichOne){
    switch(whichOne){
        case 'pc':
            $('.canvas-container').css({ zIndex: -2000 })
            $('#textillateContainer').css({ zIndex: -2000 })
            $($('.canvas-container')[0]).css({ zIndex: 2000 })
            window.layerOnFront = 'pc'
            break;
        case 'oc':
            $('.canvas-container').css({ zIndex: -2000 })
            $('#textillateContainer').css({ zIndex: -2000 })
            $($('.canvas-container')[1]).css({ zIndex: 2000 })
            window.layerOnFront = 'oc'
            break;
        case 'txt':
            $('.canvas-container').css({ zIndex: -2000 })
            $('#textillateContainer').css({ zIndex: 2000 })
            window.layerOnFront = 'txt'
            break;
    }
}//end moveToFront

//play from files
var openFile = function(event) {
    var input = event.target;

    var readFile = (filename) => {
        if(!filename) return "{}"
        var promise = new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(){
              var text = reader.result;
              console.log(reader.result.substring(0, 200));
              resolve(text)
            };
            reader.readAsText(filename);
        });

        return promise
    } //

    var len = input.files.length

    var getFile = nm => {
        var x = range(0,len).find(i => input.files[i].name.indexOf(nm) > 0);
        return input.files[x]
    }

    Promise.all([
        readFile(getFile('_pc')),
        readFile(getFile('_oc')),
        readFile(getFile('_txt')),
    ]).then(data => {
        var pcData = JSON.parse(data[0])
        var ocData = JSON.parse(data[1])
        var txtData = JSON.parse(data[2])

        var frames = obj => Object.keys(obj).map(x => Number.parseInt(x)).sort((a,b)=> a-b);

        playRecording(40, {
            pc: [pcData, frames(pcData)],
            oc: [ocData, frames(ocData)],
            txt: [txtData, frames(txtData)]
        });
        stopPlayback = true;

        moveToFront('pc')
        $('#toolbar1-buttons').hide()
        $('#drawing-mode-options').hide()
        $("#recordingFileChooserDialog" ).dialog('destroy')

    }).finally(data => {
        console.log(data)
    });

  }; //end openFile

function saveCanvas() {
            var idx = window.savePoint || 0;

            localStorage.setItem('pc_' + idx, JSON.stringify(pc.toDatalessJSON()))
            localStorage.setItem('oc_' + idx, JSON.stringify(oc.toDatalessJSON()))

        }

        function restoreCanvas() {
            var idx = Number.parseInt($('#savePoints').val())
            saveCanvas()
            window.savePoint = idx;
            pc.clear();
            oc.clear();
            var data = JSON.parse(localStorage.getItem('pc_' + idx))
            pc.loadFromDatalessJSON(data)

            pc.renderAll();
            var data1 = JSON.parse(localStorage.getItem('oc_' + idx))
            oc.loadFromDatalessJSON(data1)
            oc.renderAll();
        }

        function newCanvas() {
            saveCanvas()
            var idx = $('#savePoints option').length
            pc.clear();
            oc.clear();
            $('#savePoints').append('<option>' + idx + '</option>')
            $('#savePoints').val(idx + '')

            window.savePoint = idx;
        }

function handleFileDialogButtons(src) {
            if (src == "OK") {
                var url = $('#imageInputUrl').val()
                if (url) {
                    fabric.Image.fromURL(url, function(oImg) {
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
                    var file = document.querySelector('#imageInputFile').files[0];
                    var reader = new FileReader();
                    reader.addEventListener("load", function() {
                        fabric.Image.fromURL(reader.result, function(oImg) {
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



	var dmp = new diff_match_patch();

	function toggleRecording(){
		if(window.playingMode) {
			if(!window.stopPlayback) window.stopPlayback = true
			else window.stopPlayback = false;

			return;
		};
		window.recording = !window.recording
		if(!window.recording){
			$('#recording-info').html('Stopped at: '+recordingTimer)
		}
	}

	function initializeRecording(){
		//if(window.playingMode) return;
		if(window.playingMode){
			var conf = confirm('You Are In Playing Mode. U Sure To Record?')
			if(!conf) return;

			Object.keys(localStorage).filter(x => x.startsWith(`recording_`)).forEach(x => {
				localStorage.removeItem('recording_pc_'+x);
				localStorage.removeItem('recording_oc_'+x);
				localStorage.removeItem('recording_txt_'+x);
			})

			localStorage.clear();
		}
		$('#toolbarToggle').click()
		$('#toolbarToggle1').click()

		window.playingMode = false
		window.recording = true;
		window.prevCanvasStates = {}
		window.recordingTimer = window.recordingTimer || 0;

		if(!window.recordingName){
			window.recordingName = prompt('Name of recording?')
		}

		const changesInCanvas = (prevCanvasState,newCanvasState,name)=> {
			var diff = dmp.diff_main(JSON.stringify(prevCanvasState), JSON.stringify(newCanvasState), true);

			if(diff.length > 0){
				if (diff.length > 2) {
					dmp.diff_cleanupSemantic(diff);
				}

				var patch_list = dmp.patch_make(JSON.stringify(prevCanvasState), JSON.stringify(newCanvasState), diff);
				patch_text = dmp.patch_toText(patch_list);

				if(patch_text.length > 0){
					return patch_text
				}

			};
			return null;
		}//changesInCanvas

		var zInices = ()=> {
			return [$($('.canvas-container')[0]).css('zIndex'), $($('.canvas-container')[1]).css('zIndex'), $('#textillateContainer').css('zIndex')];
		};

		window.recordingInterval = setInterval(x => {
			if(!window.recording) return;

			var postToServer = (data, part) => $.ajax({
			   url: 'http://localhost:8081/api/recording/push?name='+window.recordingName+"&component="+part,
			   method: 'post',
			   data: JSON.stringify(data),
			   dataType: 'json',
			   contentType: 'application/json'
			})

			var newCanvasStates = {
				pc: pc.toDatalessJSON(),
				oc: oc.toDatalessJSON(),
				text: $('#textillateContainer').html()
			}
			try {

				var pcChanges = changesInCanvas(prevCanvasStates.pc || {}, newCanvasStates.pc)
				if(pcChanges){
					var key = ''+recordingTimer
					var data = {}
					data[key] = { zIndex: zInices(), state: newCanvasStates.pc }
					postToServer(data, 'pc')
					prevCanvasStates.pc = newCanvasStates.pc
				}

				var ocChanges = changesInCanvas(prevCanvasStates.oc || {}, newCanvasStates.oc)
				if(ocChanges){
					var key = ''+recordingTimer
					var data = {}
					data[key] = { zIndex: zInices(), state: newCanvasStates.oc }
					postToServer(data, 'oc')

					prevCanvasStates.oc = newCanvasStates.oc
				}

				var htmlChanges = changesInCanvas(prevCanvasStates.text || {}, newCanvasStates.text)
				if(htmlChanges.length && newCanvasStates.text){
					var key = ''+recordingTimer
					var data = {}
					data[key] = { zIndex: zInices(), state: newCanvasStates.text };
					postToServer(data, 'txt')

					prevCanvasStates.text = newCanvasStates.text
				}
			} catch(e){
				console.log('Probably quota of localStorage exceeded! Stopping Recording')
				//recording = false

			}


			$('#recording-info').html('Recording: '+window.recordingTimer)
			recordingTimer++;
		}, 4) //40 milliseconds

	}

	function closest (num, arr) {
		var mid;
		var lo = 0;
		var hi = arr.length - 1;
		while (hi - lo > 1) {
			mid = Math.floor ((lo + hi) / 2);
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

	function snapValue(value, values){
		adjustedValue = closest(value, values) || value;
		console.log(`${value} snapped to ${adjustedValue}`)

		$( "#rollbackConfirmationDialog .slider" ).slider('value', adjustedValue)
		return adjustedValue
	}

	function launchRollbackRecording(){
		var saved = reconstructCanvasStates('pc')
		var savedTxt = reconstructCanvasStates('txt')
		var savedOc = reconstructCanvasStates('oc')

		var frames = saved[1] //sorted

		$( "#rollbackConfirmationDialog" ).dialog({
			buttons: [
				{
				  text: "Ok Rollback",
				  click: function() {
					$( this ).dialog( "close" );
					rollbackRecordingTo({pc: saved, oc: savedOc, txt: savedTxt}, Number.parseInt($('#rollbackConfirmationDialog span.info').html()))
				  }
				}
			]//buttons
		});

		moveToFront('txt')

		$("#rollbackConfirmationDialog .slider").slider({
			range: false,
			min: 0,
			max: frames[frames.length-1]+1,
			slide: (x,y) => {
				var val = snapValue(y.value, frames)
				$('#rollbackConfirmationDialog span.info').html(val)
			}

		}); //

	}

	function rollbackRecordingTo(saved,time){
			if(!time) return;

			pc.loadFromDatalessJSON(saved['pc'][0][time])
			pc.renderAll()
			if(saved['oc']){
				var x = closest(time, saved['oc'][1])
				oc.loadFromDatalessJSON(saved['oc'][0][x])
				oc.renderAll()
			}
			if(saved['txt']){
				var x = closest(time, saved['txt'][1])
				$('#textillateContainer').html(saved['txt'][0][x])
			}
			var toRemove = Object.keys(localStorage).filter(x => x.startsWith(`recording_pc_`)).map(x => Number.parseInt(x.split("_")[2])).filter(x => x > time)

			toRemove.forEach(x => localStorage.removeItem('recording_pc_'+x))

			console.log('Removed '+toRemove.length+' frames of pc!')

			toRemove = Object.keys(localStorage).filter(x => x.startsWith(`recording_oc_`)).map(x => Number.parseInt(x.split("_")[2])).filter(x => x > time)

			toRemove.forEach(x => localStorage.removeItem('recording_oc_'+x))

			console.log('Removed '+toRemove.length+' frames of oc!')

			window.recordingTimer = time;
			$('#recording-info').html('Rollbacked To: '+time);


	}



	function reconstructCanvasStates(name){
		    var frames = Object.keys(localStorage).filter(x => x.startsWith(`recording_${name}_`)).map(x => Number.parseInt(x.split("_")[2])).sort((a,b)=> a-b);

			var reconstructedCanvasStates = {}
			var reducer = (initialOrAccumulator, currentValue) => {
				var patches = dmp.patch_fromText(localStorage[`recording_${name}_${currentValue}`]);
				var results = dmp.patch_apply(patches, initialOrAccumulator);
				reconstructedCanvasStates[currentValue] = JSON.parse(results[0]);
				return results[0]
			};
			frames.reduce(reducer, JSON.stringify({}))

			return [reconstructedCanvasStates, frames];
	}



	function launchRecordingDialog(){
		$( "#recordingFileChooserDialog" ).dialog({
			buttons: [
				{
				  text: "Play From LocalStorage",
				  click: function() {
					$( this ).dialog( "close" );
					playRecording(null)
				  }
				}
			]//buttons
		});
		moveToFront('txt')

	}

	function playRecording(speedInMilliseconds, data){
			console.log('Playing')
			window.recordingMode = false;
			window.playingMode = true;
			$('#toolbar1-buttons').hide()
			$('#drawing-mode-options').hide()

			speedInMilliseconds = speedInMilliseconds || 4;
			var x = null;
			var y = null;
			var z = null;

			if(data){
				x = data.pc
				y = data.oc
				z = data.txt
			} else {
				x = reconstructCanvasStates('pc')
				y = reconstructCanvasStates('oc')
				z = reconstructCanvasStates('txt')
			}


			var reconstructedCanvasStatesPc = x[0]
			var reconstructedCanvasStatesOc = y[0]
			var reconstructedCanvasStatesTxt = z[0]
			var framesPc = x[1]
			var framesOc = y[1]
			var framesTxt = z[1]

			console.log('PcFrames:' + `${framesPc[0]} ${framesPc[framesPc.length-1]}`)
			console.log('OcFrames:' + `${framesOc[0]} ${framesOc[framesOc.length-1]}`)
			console.log('TxtFrames:' + `${framesTxt[0]} ${framesTxt[framesTxt.length-1]}`)

			var count = framesPc[framesPc.length-1]
			if(framesOc[framesOc.length-1] > count ) count = framesOc[framesOc.length-1]
			if(framesTxt[framesTxt.length-1] > count ) count = framesTxt[framesTxt.length-1]

			window.playerTimerTotal = count;


			var source = Rx.Observable.interval(speedInMilliseconds).timeInterval().take(count);

			window.playerTimer = framesPc[0]
			if(framesOc[0] < window.playerTimer ) window.playerTimer = framesOc[0]
			if(framesTxt[0] < window.playerTimer) window.playerTimer = framesTxt[0]

			window.playerTimerStart = playerTimer

			$('#playbackControls .slider').slider({
				min: playerTimer,
				max: count,
				step: 10,
				value: playerTimer,
				slide: (x,y) => {
					$('#playbackControls .slider').find(".ui-slider-handle").text(y.value);
					playerTimer = y.value
					stopPlayback = true;
					setTimeout(x => { stopPlayback = false; },2)
				}
			})
			$($('#playbackControls span.time')[0]).html(playerTimer)
			$($('#playbackControls span.time')[1]).html(count)

			$('#playbackControls').show().css({ zIndex: 100000 })

			var playerInterval = null;

			//This is so that I can add delays at frame points programmatically.
			var delayAmount = 0;
			var delayInterval = 0;

			playerInterval = setInterval(x => {
				if(playerTimer > count){
					clearInterval(playerInterval)
					window.recordingTimer = playerTimer;
					return;
				}
				if(window.stopPlayback) return;

				$('#recording-info').html('Playing: '+playerTimer);

				var f = playerTimer;
				var statesPc = reconstructedCanvasStatesPc[f] && reconstructedCanvasStatesPc[f].state
				if(statesPc){
					$($('.canvas-container')[0]).css({ zIndex: reconstructedCanvasStatesPc[f].zIndex[0] })
					$($('.canvas-container')[1]).css({ zIndex: reconstructedCanvasStatesPc[f].zIndex[1] })
					$('#textillateContainer').css({ zIndex: reconstructedCanvasStatesPc[f].zIndex[2] })
					pc.loadFromDatalessJSON(statesPc, ()=> pc.renderAll());
				}

				var statesOc = reconstructedCanvasStatesOc[f] && reconstructedCanvasStatesOc[f].state
				if(statesOc){
					$($('.canvas-container')[0]).css({ zIndex: reconstructedCanvasStatesOc[f].zIndex[0] })
					$($('.canvas-container')[1]).css({ zIndex: reconstructedCanvasStatesOc[f].zIndex[1] })
					$('#textillateContainer').css({ zIndex: reconstructedCanvasStatesOc[f].zIndex[2] })
					oc.loadFromDatalessJSON(statesOc, ()=> oc.renderAll());
				}

				var statesTxt = reconstructedCanvasStatesTxt[f] && reconstructedCanvasStatesTxt[f].state
				if(statesTxt){
					$($('.canvas-container')[0]).css({ zIndex: reconstructedCanvasStatesTxt[f].zIndex[0] })
					$($('.canvas-container')[1]).css({ zIndex: reconstructedCanvasStatesTxt[f].zIndex[1] })
					$('#textillateContainer').css({ zIndex: reconstructedCanvasStatesTxt[f].zIndex[2] })
					$('#textillateContainer').html(statesTxt);

				}
				$("#slider").val(playerTimer);
				$("#slider").slider("refresh");

				delayAmount = (window.delayPoints && window.delayPoints[playerTimer]) || 0

				if(delayInterval >= delayAmount) {
					delayAmount = 0;
					delayInterval = 0;
				}
				if(delayAmount == 0){
				    playerTimer++;
				} else {
					console.log('delaying')
					delayInterval++;
				}

			}, 1);

		}//End playRecording

		function saveRecording(){
			var saved = reconstructCanvasStates('pc')
			var savedTxt = reconstructCanvasStates('txt')
			var savedOc = reconstructCanvasStates('oc')

			if(!window.recordingName){
				var name = prompt('Recording Name?')
				if(!name) name = new Date().toISOString();

			}

			var num = window.currentRecordingSliceNumber || 1
			download(JSON.stringify(saved[0]), `recording_pc.${num}.txt`,"plain/text")
			download(JSON.stringify(savedOc[0]), `recording_oc.${num}.txt`,"plain/text")
			download(JSON.stringify(savedTxt[0]), `recording_txt.${num}.txt`,"plain/text")

			window.currentRecordingSliceNumber++;

			localStorage.clear()
		}

		function download(data, filename, type) {
			var file = new Blob([data], {type: type});
			if (window.navigator.msSaveOrOpenBlob) // IE10+
				window.navigator.msSaveOrOpenBlob(file, filename);
			else { // Others
				var a = document.createElement("a"),
						url = URL.createObjectURL(file);
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				setTimeout(function() {
					document.body.removeChild(a);
					window.URL.revokeObjectURL(url);
				}, 0);
			}
		}

		$(document).ready(function() {
		  var icon = $('.play');
		  icon.click(function() {
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
		  var items = (event.clipboardData  || event.originalEvent.clipboardData).items;
		  console.log(JSON.stringify(items)); // will give you the mime types
		  // find pasted image among pasted items
		  var blob = null;
		  for (var i = 0; i < items.length; i++) {
			if (items[i].type.indexOf("image") === 0) {
			  blob = items[i].getAsFile();
			}
		  }
		  // load image if there is a pasted image
		  if (blob !== null) {
		    if(!canPasteImageFromClipboard) return;

			var reader = new FileReader();
			reader.onload = function(event) {
			  var url = event.target.result; // data url!
			  if(url.indexOf("data") >= 0){

				if(window.insertPastedImageIntoFabric){
					fabric.Image.fromURL(url, function(oImg) {
							oImg.set({
								'left': window.lastClickedX || 100
							});
							oImg.set({
								'top': window.lastClickedY || 100
							});
							oc.add(oImg);
					});
				} else {
				    var id = prompt('Enter id')
					if(id){
						var container = $('<div>').css({ display: 'inline-block', position: 'absolute'}).attr({'id': id})
						window.pastedItems = window.pastedItems || {}
						window.pastedItems[id] = 1;

						var img = $('<img>').attr({src: url})
						img.css({ left: window.lastClickedX || 100, top: window.lastClickedY || 100, width: '100%', height: '100%'})

						container.prepend(img)
						var i = new Image();

						i.onload = function(){
							console.log( i.width+", "+i.height );
							$('#textillateContainer').append(container)
							container.css({ width: i.width, height: i.height })
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


