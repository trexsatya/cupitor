// function reqResponseListener(details) {
//     let url = details.url
//     if(url.indexOf("batchexecute") < 0) {
//         return
//     }
//
//     let filter = browser.webRequest.filterResponseData(details.requestId);
//     let decoder = new TextDecoder("utf-8");
//     let encoder = new TextEncoder();
//
//     filter.ondata = async event => {
//         let str = decoder.decode(event.data, {stream: true});
//
//         let fourthPart = str.split("\n")[3];
//         try {
//             let json = JSON.parse(fourthPart.substring(1).slice(0, -1))
//             let audioBase64 = JSON.parse(json[2])[0];
//             let audio = new Audio('data:audio/ogg;base64,' + audioBase64)
//             audio.play()
//             // console.log(browser.myGlobalData.srt, audioBase64)
//             //TODO: validate audioBase64
//             // console.log(storage.local.get('data'));
//
//             //TODO: Prevet race conditions
//             let idx = await browser.storage.local.get('currentIndex')
//             let srt = await browser.storage.local.get('srt')
//             srt.srt[idx.currentIndex].audio = audioBase64;
//             await browser.storage.local.set({audioSaved: true, srt: srt.srt})
//         } catch (e) {
//             // console.log(e)
//             // console.log(fourthPart)
//         }
//         filter.write(encoder.encode(str));
//         filter.disconnect();
//     }
//
//     return {};
// }
//
// browser.webRequest.onBeforeRequest.addListener(
//     reqResponseListener,
//     {
//         urls: ["<all_urls>"]
//         // , types: ["main_frame"]
//     },
//     ["blocking"]
// );
//
// // browser.runtime.onMessage.addListener((details) => {
// //     console.log('Message!', details)
// //     let {type, src, target} = details;
// //     if(type === 'translationLoaded') {
// //         console.log("translationLoaded", src, target)
// //     }
// // });
//
// browser.webNavigation.onCompleted.addListener(async evt => {
//         // Filter out any sub-frame related navigation event
//         // if (evt.frameId !== 0) {
//         //     return;
//         // }
//
//         const url = evt.url;
//         if (url.indexOf('op=translate') > 0) {
//             console.log("URL " + url)
//             await browser.tabs.executeScript({file: './srt-parser.js'})
//             browser.tabs.executeScript({
//                 code: `
//                 const waitUntil = (condition) => {
//                     return new Promise((resolve) => {
//                       let interval = setInterval(() => {
//                         if (!condition()) {
//                           return
//                         }
//                         clearInterval(interval)
//                         resolve()
//                       }, 100)
//                     })
//                 };
//
//                 function sleep (time) {
//                   return new Promise((resolve) => setTimeout(resolve, time));
//                 }
//
//                 window.clicked = false
//
//                 document.addEventListener('click', e => {
//                     if(e.isTrusted)
//                         window.clicked = true
//                 })
//
//                 async function audioSaved() {
//                     let d = await browser.storage.local.get('audioSaved')
//                     return d.audioSaved
//                 }
//
//                 async function saveOutput(srt) {
//                       let file = await browser.storage.local.get('file')
//                       let translatedSrtJson = []
//                       let audioJson = {}
//
//                       srt.forEach(it => {
//                         let item = {...it}
//                         item.text = it.translated;
//                         translatedSrtJson.push(item)
//                         audioJson[it.id] = it.audio
//                       })
//                       let data = {file: file.file, translated: SrtParser.toSrt(translatedSrtJson), lang: 'sv', audio: audioJson}
//                       const rawResponse = await fetch('http://localhost:5000/srt', {
//                         method: 'POST',
//                         headers: {
//                           'Accept': 'application/json',
//                           'Content-Type': 'application/json'
//                         },
//                         body: JSON.stringify(data)
//                       });
//                       const content = await rawResponse.json();
//                 }
//
//                 async function fn() {
//                     await waitUntil(() => document.querySelector('button[aria-label="Listen to translation"]') != null)
//                     await browser.storage.local.set({audioSaved: false})
//                     let listenBtn = document.querySelector('button[aria-label="Listen to translation"]')
//
//                     let copyBtn = document.querySelector('button[aria-label="Copy translation"]')
//
//                     await waitUntil(() => window.clicked)
//
//                     listenBtn.click();
//                     await sleep(1000)
//                     copyBtn.click();
//                     await sleep(1000)
//
//                     let translatedText = await navigator.clipboard.readText()
//
//                     const params = new Proxy(new URLSearchParams(window.location.search), {
//                       get: (searchParams, prop) => searchParams.get(prop),
//                     });
//
//                     let idx = await browser.storage.local.get('currentIndex')
//                     browser.runtime.sendMessage({type: 'translationLoaded', src: params.text, target: translatedText, index: idx.currentIndex });
//
//                     let tab = await browser.storage.local.get('tabId')
//                     let nextIndex = idx.currentIndex + 1;
//                     let srt = await browser.storage.local.get('srt')
//                     console.log(srt, idx)
//                     srt.srt[idx.currentIndex].translated = translatedText;
//                     await browser.storage.local.set({currentIndex: nextIndex, srt: srt.srt})
//
//                     await waitUntil(() => audioSaved())
//
//                     if(nextIndex >= srt.srt.length) {
//                        let d = await browser.storage.local.get('srt')
//                        saveOutput(d.srt)
//                        return;
//                     }
//                     location = "https://translate.google.com/?sl=en&tl=sv&text=" + srt.srt[nextIndex].text + "&op=translate"
//                 };
//                 fn()
//             `
//             });
//         }
//     }, {
//     url: [{schemes: ["http", "https"]}]
//    }
// );
