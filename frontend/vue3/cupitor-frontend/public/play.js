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

function handleImageInputDialogButtons(src) {
  if (src === "OK") {
    const url = $('#imageInputUrl').val()
    if (url) {
      loadFabricImage(url);
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

function handleImportDialogButtons(src) {
  if (src === "OK") {
    //Handle file selection
    const file = document.querySelector('#importInputFile').files[0];
    const reader = new FileReader();
    reader.addEventListener("load", function () {
      //importIntoCanvas(reader.result)
      const script = eval(reader.result + '').map(eval)
      schedule(script, 1)
    }, false);
    if (file) {
      reader.readAsText(file);
    }
    $('#importDialog').hide();
  } else {
    $('#importDialog').hide();
  }
}

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

$(document).ready(function () {
  const icon = $('.play');
  icon.click(function () {
    icon.toggleClass('active');
    return false;
  });
});

window.canPasteImageFromClipboard = true;
document.onpaste = function (event) {
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

document.onclick = e => {
  window.lastClickedX = e.clientX;
  window.lastClickedY = e.clientY;
}

const dmp = new diff_match_patch();

function updateObjectIdsUi() {
  const $objectIdsSelect = $('#objectIdsSelect');

  $objectIdsSelect.html(`<option value="">-</option>`)
  window.objectIds.forEach(it => {
    $objectIdsSelect.append(`<option value="${it.uid}">${it.uid.substr(-5)}(${it.type})</option>`);
  })
}

function setObjVisibility(obj, visibility) {
  obj && (obj.visible = visibility);
  obj?.treeConnection?.incoming?.lines?.map(findIfRequired)?.forEach((line) => {
    line.visible = visibility;
  });
  obj?.treeConnection?.outgoing?.lines?.map(findIfRequired)?.forEach((line) => {
    line.visible = visibility;
  });
  pc?.renderAll();
}

function hideObject(obj) {
  obj = findIfRequired(obj)
  if(obj === undefined || obj === null) return;
  setObjVisibility(obj, false);
}

function showObject(obj) {
  obj = findIfRequired(obj)
  if(obj === undefined || obj === null) return;
  setObjVisibility(obj, true);
}

function deleteObject(obj) {
  obj = findIfRequired(obj)
  if(obj === undefined || obj === null) return;
  const uid = obj.uid || $(obj).attr('data-uid') || $(obj).attr('id') ;
  if(isFabricObject(obj)) {
    deleteFabricObject(obj)
  } else {
    $(obj).remove();
  }
  const item = [...window.objectIds].find(it => it.uid === uid)
  window.objectIds.delete(item);
  updateObjectIdsUi()
}

function selectedObjectId() {
  return $('#objectIdsSelect').val();
}

function selectObject(obj) {
  obj = findIfRequired(obj)
  if(obj === undefined || obj === null) return;
  if(isFabricObject(obj)) {
    pc.setActiveObject(obj)
  } else {
    highlightElementWithTransparentCircle($(obj));
  }

  function highlightElement(el) {
    //Assuming we get a jquery obj
    if(!el || el.length === 0) return;
    el = el[0]
    $('.highlight-target').removeClass('highlight-target');
    $(el).addClass('highlight-target');
    const overlay = document.getElementById('overlay');
    const rect = el.getBoundingClientRect();

    const padding = 10;
    const left = rect.left - padding;
    const top = rect.top - padding;
    const right = rect.right + padding;
    const bottom = rect.bottom + padding;

    $('#overlay').show()
    // Define the rectangle hole using clip-path polygon
    overlay.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%,
      0% 100%, 0% 0%,
      ${left}px ${top}px,
      ${left}px ${bottom}px,
      ${right}px ${bottom}px,
      ${right}px ${top}px,
      ${left}px ${top}px
    )`;

    setTimeout(function () { $('#overlay').hide() }, 5000)
  }
}

function highlightElementWithTransparentCircle(rect, padding = 20) {
  //$(el).addClass('highlight-target');

  //const rect = el.getBoundingClientRect();

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const left = rect.left;
  const top = rect.top;
  const width = rect.width;
  const height = rect.height;

  const mask = document.querySelector('#overlay');
  const {mapRange} = gsap.utils;

  // Calculate mouse position in %.
  let x = mapRange(
      0, window.innerWidth,
      0, 100,
      left
  );
  let y = mapRange(
      0, window.innerHeight,
      0, 100,
      top
  );

  // Update the custom property values.
  gsap.set(mask,{
    '--x': left,
    '--y': top,
    '--w': 0,
    '--h': height,
  })

  gsap.set(mask,{
    'display': 'block'
  })


  setTimeout(function () {
    gsap.set(mask,{
      'display': 'none'
    })
  }, 10000)
}

