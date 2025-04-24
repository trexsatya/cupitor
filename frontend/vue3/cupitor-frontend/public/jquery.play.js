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
