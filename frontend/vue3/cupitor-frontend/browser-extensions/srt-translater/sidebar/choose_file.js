/*
Listens for a file being selected, creates a ObjectURL for the chosen file, injects a
content script into the active tab then passes the image URL through a message to the
active tab ID.
*/

// Listen for a file being selected through the file picker
const inputElement = document.getElementById("input");
inputElement.addEventListener("change", handlePicked, false);

// Listen for a file being dropped into the drop zone
const dropbox = document.getElementById("drop_zone");
dropbox.addEventListener("dragenter", dragenter, false);
dropbox.addEventListener("dragover", dragover, false);
dropbox.addEventListener("drop", drop, false);

// Get the image file if it was chosen from the pick list
function handlePicked() {
  displayFile(this.files);
}

// Get the image file if it was dragged into the sidebar drop zone
function drop(e) {
  e.stopPropagation();
  e.preventDefault();
  displayFile(e.dataTransfer.files);
}

/* 
Insert the content script and send the image file ObjectURL to the content script using a 
message.
*/ 
function displayFile(fileList) {
  const url = window.URL.createObjectURL(fileList[0]);
  console.log(fileList)
  browser.storage.local.set({'file': fileList[0].name})

  browser.tabs.executeScript({
    code: `
         async function listener(request, sender, sendResponse) {
            console.log('Message!', request)
            if(request.type !== 'translationRequest') return;
            
            let idx = await browser.storage.local.get('currentIndex')
            let srt = await browser.storage.local.get('srt')
            console.log(srt, idx)
            location = "https://translate.google.com/?sl=en&tl=sv&text=" + srt.srt[idx.currentIndex].text + "&op=translate"
          }
          browser.runtime.onMessage.addListener(listener);
    `
    }).then(messageContent)
      .catch(reportError);

  browser.runtime.onMessage.addListener(async detail => {
    console.log('Message!', detail)

  });

  const waitUntil = (condition) => {
    return new Promise((resolve) => {
      let interval = setInterval(() => {
        if (!condition()) {
          return
        }
        clearInterval(interval)
        resolve()
      }, 100)
    })
  };

  function messageContent() {
    const gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
    gettingActiveTab.then(async (tabs) => {
      let b = await fetch(url).then(r => r.blob());
      let txt = await b.text()

      let srt = SrtParser.fromSrt(txt);
      let idx = 0
      let tabId = tabs[0].id;

      browser.storage.local.set({srt: srt, currentIndex: idx, tabId: tabId})
      browser.tabs.sendMessage(tabId, {index: idx, type: 'translationRequest', tabId: tabId});
    });
  }

  function reportError(error) {
    console.error(`Could not inject content script: ${error}`);
  }
}

// Ignore the drag enter event - not used in this extension
function dragenter(e) {
  e.stopPropagation();
  e.preventDefault();
}

// Ignore the drag over event - not used in this extension
function dragover(e) {
  e.stopPropagation();
  e.preventDefault();
}