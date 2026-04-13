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
        fabric.Image.fromURL(reader.result).then(function (oImg) {
          oImg.set({ left: 100, top: 100 });
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

function snapValue(value, values) {
  adjustedValue = closest(value, values) || value;
  console.log(`${value} snapped to ${adjustedValue}`)

  $("#rollbackConfirmationDialog .slider").slider('value', adjustedValue)
  return adjustedValue
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
          fabric.Image.fromURL(url).then(function (oImg) {
            oImg.set({ left: window.lastClickedX || 100, top: window.lastClickedY || 100 });
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

function updateNodeContentAsPerCheckbox(el) {
  if (el.checked) {
    $('#node-content-editor-container').show()
    $('#node-content').hide()
  } else {
    $('#node-content-editor-container').hide()
    const content = CKEDITOR.instances['node-content-editor'].getData()
    $('#node-content').html(content).show()
  }
}

function handleEditContentCheckbox(el) {
  updateNodeContentAsPerCheckbox(el);
}

function saveNodeContent() {
  const obj = pc.getActiveObject()
  if(!obj) return;
  const content = CKEDITOR.instances['node-content-editor'].getData()
  window.nodeContents = window.nodeContents || {};
  window.nodeContents[obj.uid] = content
}
