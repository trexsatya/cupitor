window.globalVariableNames = {
    "matrices": 0,
    "arrays": 0
}

function contextMenuListener(el) {
    el.addEventListener( "contextmenu", function(e) {
      console.log(e, el);
      e.preventDefault()

      $('#edit-table-cell-toolbar').show().css({ left: e.x, top: e.y});
      $('#edit-table-cell-toolbar input[name="value"]').unbind('change').on('change',e => {
        console.log(e.target.value)
        $(el).find('span.item').html(e.target.value)
      });
      $('#edit-table-cell-toolbar input[name="value"]').unbind('focusout').on('focusout',e => {
          console.log(e.target.value)
          $(el).find('span.item').html(e.target.value)
      });

      $('#edit-table-cell-toolbar input[name="background"]').unbind('change').change(e => {
        console.log(e.target.value)
        $(el).css({ backgroundColor: e.target.value})
      });
      $('#edit-table-cell-toolbar input[name="color"]').unbind('change').change(e => {
        console.log(e.target.value)
        $(el).css({ color: e.target.value})
      });
    });
}

function addHighlightCapability(el, others){
    $(el).click(e => {
        others.each((i,other) => {
            $(other).removeClass('highlighted')
        });
        $(el).addClass('highlighted');
    });
}

function createMatrix(sel) {

    var data = $(sel).find('input[name="data"]').val()
    var location = $(sel).find('input[name="location"]').val()
    var size = $(sel).find('input[name="size"]').val() || '600,400'

    var xtitle = $(sel).find('input[name="xtitle"]').val() || 'Columns'
    var ytitle = $(sel).find('input[name="ytitle"]').val() || 'Rows'
    var _xheaders = $(sel).find('input[name="xheaders"]').val() || 'indices'
    var _yheaders = $(sel).find('input[name="yheaders"]').val() || 'indices'

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
    } catch(e) {
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

    table.all.find('table.data td').each((i,el) => {
        contextMenuListener(el);
    });

    var dataCells = table.all.find('.data td')

    dataCells.each((i,el) => {
        addHighlightCapability(el, dataCells)
    });

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
    var table = appendTableInto(tableData, $('#textillateContainer'),
                    { ytitle: ytitle, xtitle: xtitle, xheaders: xheaders, yheaders: yheaders, width: size[0], height: size[1]})

    table.all.find('table.data td').each((i,el) => {
        contextMenuListener(el);
    });

    var dataCells = table.all.find('.data td')

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

function Copy(canvas) {
    // clone what are you copying since you
    // may want copy and paste on different moment.
    // and you do not want the changes happened
    // later to reflect on the copy.
    var target = canvas.getActiveObject() || canvas.getActiveGroup();
    target.clone(function(cloned) {
        _clipboard = cloned;
    });
    window.canPasteImageFromClipboard = false;
}

function Paste(canvas) {
    if (!_clipboard) return;

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
