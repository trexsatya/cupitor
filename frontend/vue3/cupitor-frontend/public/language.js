let $, alert, _, fetch;
if (typeof window !== 'undefined' && window.$) {
  $ = window.$; // Use global jQuery in HTML
  alert = window.alert;
  _ = window._;
  fetch = window.fetch;
} else {
  $ = require('jquery'); // Use jQuery from npm in Node.js/testing
  alert = () => {};
  _ = require('lodash');
  fetch = require('node-fetch');
}


Array.prototype.max = function () {
  return Math.max.apply(null, this);
};
Array.prototype.last = function () {
  return _.last(this)
};

function isDesktop() {
  const ww = $(window).width()
  return ww >= 1000
}

const SEPARATOR_PIPE = '|'
window.onbeforeunload = function (event) {
  if (window.dontConfirmOnRefresh) {
    return null
  }
  return confirm("Confirm refresh");
};

window.addEventListener('filterData', (e) => {
  const text = e.detail;
  fetchSRTs(text)
});

function getExpansionForWords() {
  const list = `ta=ta,tar,tog,tagit
as=as,ades,ats
en=en,et,na,ne
sig=sig,dig,mig,oss,honom,henne,er,sig
få=få,får,fick,fått
lägga=lägga,lägger,lade,lagtpa
ha=ha,har,hade,haft
slappna=slappna,slappnar,slappnade,slappnat
koppla=koppla,kopplar,kopplade,kopplat
röra=röra,rör,rörde,rört
syfta=syfta,syftar,syftade,syftat
utgå=utgå,utgår,utgick,utgått
föreställa=föreställa,föreställer,föreställde,föreställt
ilskna=ilskna,ilsknar,ilsknade,ilsknat
ge=ge,ger,gav,gett
bemöda=bemöda,bemödar,bemödade,bemödat
plats=upp,ner,fram,bak,bort
se=se,ser,såg,sett
gå=gå,går,gick,gått
sätta=sätta,sätter,satte,satt
slå=slå,slår,slog,slagit
stiga=stiga,stiger,steg,stigit
dyka=dyka,dyker,dök,dykt
befinna=befinna,befinner,befann,befunnit
riva=riva,river,rev,rivit
bestå=bestå,består,bestod,bestått
stänga=stänga,stänger,stängde,stängt
ställa=ställa,ställer,ställde,ställt
etsa=etsa,etsar,etsade,etsat
resa=resa,reser,reste,rest,res
lyfta=lyfta,lyfter,lyfte,lyft
förhålla=förhålla,förhåller,förhöll,förhållit
bete=bete,beter,betedde,betett
uppföra=uppföra,uppför,uppförde,uppfört
komma=komma,kommer,kom,kommit
hinna=hinna,hinner,hann,hunnit
hålla=hålla,håller,höll,hållit
infinna=infinna,infinner,infann,infunnit
slänga=slänga,slänger,slängde,slängt
göra=göra,gör,gjorde,gjort
gripa=gripa,griper,grep,gripit
leda=leda,leder,ledde,lett
skjuta=skjuta,skjuter,sköt,skjutit
bli=bli,blir,blev,blivit
dra=dra,drar,drog,dragit
trivas=trivas,trivs,trivdes,trivts
passa=passa,passar,passade,passat`

  const wordsMap = {}
  list.split("\n").filter(it => it.trim().length > 2).forEach(it => {
    const splits = it.split("=")
    wordsMap[splits[0]] = splits[1].split(",")
  })
  return wordsMap
}

async function loadJokes() {
  let response = await fetch(`${getResourceUrl()}/jokes/1.txt`)
  response = await response.text()
  response = response.split(/[0-9]+\.jpg\n {5}------------\n/).map(it => it.trim()).filter(it => it.length > 20)
  window.jokes = response
}

async function loadBookExtracts() {
  let response = await fetch(`${getResourceUrl()}/book-extracts/1.txt`)
  response = await response.text()
  response = response.split("---------------").map(it => it.trim()).filter(it => it.length > 20)
  window.bookExtracts = response
}

async function loadFromArticle(articleIds) {
  let response = await fetch(`https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/article/${articleIds[getLangFromUrl().code]}`)
  //let response = await fetch("http://localhost:5000/static?name=1.html")
  response = await response.json()
  response = await response.content
  return response.split("---------------").map(it => it.trim()).filter(it => it.length > 20)
}

async function loadSnippets() {
  const articleIds = {
    'sv': 14,
    'es': 23
  }
  window.snippets = await loadFromArticle(articleIds)
}

async function loadPoems() {
  const articleIds = {
    'sv': 141,
    'es': 76
  }
  window.poems = await loadFromArticle(articleIds)
}

function _populateData(where, response) {
  response.split("---------------").map(it => it.trim()).forEach(it => {
    const splits = it.split("\n")
    where.push({
      name: _.trim(splits[0]),
      text: _.drop(splits, 1).join("\n")
    })
  })
}

async function loadSayings() {
  let response = await fetch(`${getResourceUrl()}/sayings/1.txt`)
  response = await response.text()
  window.sayings = []
  _populateData(window.sayings, response)
}

async function loadMetaphors() {
  let response = await fetch(`${getResourceUrl()}/metaphors/1.txt`)
  response = await response.text()
  window.metaphors = []
  _populateData(window.metaphors, response)
}

async function loadIdioms() {
  let response = await fetch(`${getResourceUrl()}/idioms/1.txt`)
  response = await response.text()
  window.idioms = []
  _populateData(window.idioms, response)
}

function togglePlay(el) {
  if (window.playingYoutubeVideo) {
    if (ytPlayer.getPlayerState() === 2) {
      ytPlayer.playVideo()
    } else if (ytPlayer.getPlayerState() === 1) {
      ytPlayer.pauseVideo()
    }
  } else if (window.playingAudio) {
    if (audioPlayer.paused) {
      audioPlayer.play()
    } else {
      audioPlayer.pause()
    }
  } else if (window.playingVideo) {
    if (videoPlayer.paused) {
      videoPlayer.play()
      // $('#result').hide()
    } else {
      videoPlayer.pause()
    }
  }
}

function playMedia() {
  if (window.playingYoutubeVideo) {
    ytPlayer.playVideo()
  } else if (window.playingAudio) {
    audioPlayer.play()
  } else if (window.playingVideo) {
    videoPlayer.play()
  }
}

function createOptionElement(searchTerms, selected = false) {
  let displayText = searchTerms
  let isSeparator = false
  if (searchTerms.trim().length === 0) {
    displayText = "-------"
    searchTerms = displayText
    isSeparator = true
  }
  const op = new Option(`${displayText}`, searchTerms, false, selected)
  if (isSeparator) {
    op.disabled = true
  }
  op.title = searchTerms
  return op
}

function loadSearches() {
  const searches = getSearchesFromStorage()
  $('#searchedWords').html('')

  schedule(searches, .0001, searchTerms => {
    $('#searchedWords').append(createOptionElement(searchTerms))
  })

  $('#toggleSearchesControlCheckbox').click()
}

function getSearchesFromStorage() {
  return JSON.parse(localStorage.getItem('searches') || '{}');
}

function saveSearchesIntoStorage(searches) {
  localStorage.setItem('searches', JSON.stringify(searches))
}

function exportSearches() {
  const searches = getSearchesFromStorage()
  export2txt(Object.keys(searches).join("\n"), "searches.txt");
  $('#toggleSearchesControlCheckbox').click()
}

function importSearches() {
  $("#import-dialog").dialog()
}

function importSearchesFromVocab() {
  const category = $("#vocabularySelect").val()
  const searches = window.vocabulary[category]

  saveSearchesIntoStorage(searches)
  loadSearches()
}

function loadWholeVocabulary() {
  $('#searchedWords').html('')

  const vocabCategoriesToPopulate = new Set()

  Object.entries(vocabulary).forEach(it => {
    vocabCategoriesToPopulate.add(it[0])
  })

  const populateLines = it => {
    const vocabLines = window.vocabulary[it]
    const heading = new Option(`${it}`, it, false, false)
    heading.disabled = true
    $('#searchedWords').append(heading)
    vocabLines.forEach(line => {
      $('#searchedWords').append(createOptionElement(line, window.preSelectedSearchedWord && window.preSelectedSearchedWord === line))
    })
  };
  schedule(Array.from(vocabCategoriesToPopulate), .1, it => {
    populateLines(it)
  })
}

function importSearchesFromFile() {
  const file = document.createElement('input')
  file.type = 'file'
  file.accept = '.txt'
  file.onchange = e => {
    const reader = new FileReader()
    reader.onload = e => {
      const searches = {}
      saveSearchesIntoStorage(reader.result.split("\n"));
      loadSearches()
    }
    reader.readAsText(file.files[0])
  }
  file.click()
}

function clearSearches() {
  localStorage.removeItem('searches')
  $('#toggleSearchesControlCheckbox').click()
}

function saveSearch(word, count) {
  if (!word) return
  count = count || 0
  const searches = getSearchesFromStorage()
  let newItem = true
  if (searches.includes(word)) {
    newItem = false
  }
  if (newItem) {
    searches.push(word)
  }

  saveSearchesIntoStorage(searches)
  return newItem
}

function populateVocabText() {
  const category = $("#addToVocabularyDialogSelect").val()
  const text = window.vocabulary[category].join("\n")
  $("#vocabularySegmentTextarea").val(text)
}

function openAddToVocabDialog() {
  const w = window.innerWidth * 0.9
  const h = window.innerHeight * 0.8
  $("#addToVocabularyDialog").dialog({width: w, height: h}).show()
  populateVocabularyHeadings($('#addToVocabularyDialogSelect'))
}

function addToVocab() {
  const text = $("#vocabularySegmentTextarea").val()
  const category = $("#addToVocabularyDialogSelect").val()
  window.vocabulary[category] = text.split("\n")
  populateVocabularyHeadings($('#vocabularySelect'))
  makeHttpCallToUpdateVocab()
}

function getXXX() {
  let xxx = localStorage.getItem("xxx")
  if (!xxx) {
    xxx = prompt("Enter the XXX")
    localStorage.setItem("xxx", xxx)
  }
  return xxx
}

window.AWS_API = "https://api.satyendra.website/api"

async function makeHttpCallToUpdateVocab() {
  const data = Object.keys(window.vocabulary)
      .map(k => `#${k}\n${window.vocabulary[k].join("\n")}`).join("\n")
  try {
    let res = await fetch(`${window.AWS_API}/save-vocab`, {
      method: 'POST',
      body: data,
      headers: {
        'Content-Type': 'text/plain',
        'X-Auth': getXXX()
      }
    })
    res = await res.text()
  } catch (e) {
    localStorage.setItem("xxx", null)
  }
}

async function doSearch(searchThis, el) {
  if ((typeof searchThis) !== 'string') {
    searchThis = null
  }
  await fetchSRTs(searchThis);
  // let count = wordsToItems[searchThis] && wordsToItems[searchThis].length
  // count = count || 0
  if (!el) return

  const newItem = saveSearch(searchThis, null)
  if (newItem) {
    el.append(new Option(`${searchThis}`, searchThis, false, false))
  }
}

async function searchTextChanged(e) {
  const el = $('#searchedWords')
  const w = $('#searchText').val()
  window.unprocessedSearchText = null
  await doSearch(this, el);
}

function parseVocabularyFile(text) {
  const lines = text.split("\n")
  const categories = {}
  let currentCategory = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith("#")) {
      currentCategory = line.replace("#", "").trim()
      categories[currentCategory] = []
    } else {
      categories[currentCategory].push(line)
    }
  }

  return categories
}

function populateVocabularyHeadings(target) {
  const $vocabularySelect = target
  $vocabularySelect.html('<option>-</option>')
  Object.keys(window.vocabulary).forEach(it => {
    const op = new Option(it, it)
    $vocabularySelect.append(op)
  })
}

async function fetchVocabulary() {
  let res;
  if (isLocalhost()) {
    res = await fetch("http://localhost:5000/vocabulary")
    res = await res.json()
    if (res) res = res.text
  } else {
    res = await fetch(`${getResourceUrl()}/vocabulary.txt`)
    res = await res.text()
  }
  if (res)
    window.vocabulary = parseVocabularyFile(res)
  loadWholeVocabulary()
}

async function searchedWordSelected() {
  if (window.searchedWordsSelectedProgrammatically) {
    window.searchedWordsSelectedProgrammatically = false;
    return
  }
  // $('#searchText').val($('#searchedWords').val()).trigger('change')
  window.unprocessedSearchText = $('#searchedWords').val()
  window.searchText = expandWords(window.unprocessedSearchText, getLangFromUrl().code)
  await doSearch(window.searchText, null)
}

window.playingYoutubeVideo = false;

function toSeconds(str) {
  str = str + ""
  let hour = 0, mins = 0, secs = 0, millis = 0
  if (str.split(/[,.]/).length === 2) {
    const splits = str.split(/[,.]/)
    str = splits[0]
    millis = splits[1]
  }
  const splits = str.split(":")

  if (splits.length === 2) {
    mins = splits[0]
    secs = splits[1]
  }
  if (splits.length === 3) {
    hour = splits[0]
    mins = splits[1]
    secs = splits[2]
  }
  return parseInt(hour) * 3600 + parseInt(mins) * 60 + parseInt(secs) + parseInt(millis) / 1000
}

function fromSeconds(number) {
  const _pad = x => x.length < 2 ? '0' + x : x;
  const hrs = Math.floor(number / 3600) + ''
  const mins = Math.floor((number % 3600) / 60) + ''
  const secs = Math.floor((number % 3600) % 60) + ''


  return `${_pad(hrs)}:${_pad(mins)}:${_pad(secs)}`
}

const URL = window.URL || window.webkitURL
const displayMessage = function (message, isError) {
  const element = document.querySelector('#message')
  element.innerHTML = message
  element.className = isError ? 'error' : 'info'
}


const ontimeupdate = e => {
  updatePlayBtn()

  if (isNotPlaying() || !window.syncSubtitle) {
    return
  }
  // console.log(currentSub, player.currentTime)


  if (window.seekRequestProcessing) {
    return
  }

  const ct = getCurrentTime()

  // if (window.rewindData) {
  //   if (ct >= window.rewindData.from) {
  //     window.rewindData = null
  //     console.log("Resetting speed", ct)
  //     // audioPlayer.setDuration(window.currentSub.speed)
  //   } else {
  //     // return
  //   }
  // }

  if (window.currentSub && ct > window.currentSub.te + window.marginStartSubtitle) {
    window.currentSubIndex += 1;
    window.currentSub = window.subtitles[window.currentSubIndex]
    debugLog("Current player time", ct, "Changed to subtitle", toStringSubtitle(window.currentSub))
  }

  markIntervalPlayDone(ct);

  renderSubtitles()

  setCurrentSub(ct)
  renderSubtitles()

  setSpeed();
}

const addListeners = it => {
  // it.addEventListener('timeupdate', ontimeupdate)
  it.addEventListener('pause', updatePlayBtn)
  it.addEventListener('ended', updatePlayBtn)
  it.addEventListener('playing', updatePlayBtn)
}

const isIOS = () => {
  const iosQuirkPresent = function () {
    const audio = new Audio();

    audio.volume = 0.5;
    return audio.volume === 1;   // volume cannot be changed from "1" on iOS 12 and below
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAppleDevice = navigator.userAgent.includes('Macintosh');
  const isTouchScreen = navigator.maxTouchPoints >= 1;   // true for iOS 13 (and hopefully beyond)

  return isIOS || (isAppleDevice && (isTouchScreen || iosQuirkPresent()));
};

if (isIOS()) {
  window.marginStartSubtitle = -1
  window.marginEndSubtitle = 0
}

window.marginStartSubtitle = -0.1
window.marginEndSubtitle = 1

window.starredLines = []
window.allSubtitles = {}
window.srts = []
window.showDuplicates = false
window.youtubePlayInterval = null

function fixMobileView() {
  if (isDesktop()) {
    return
  }
  window.showInfoWithoutPopup = false;
  $(".fl-left").css({width: '100%', clear: 'both'})
  $(".fl-right").css({left: 0, width: '100%', marginTop: '0.3em', clear: 'both'})
  const $starredLines = $('#starredLines');
  $starredLines.parent().css({
    marginTop: 0,
    bottom: 0
  })
  $('#toggleEnSubBtn').parent().css({
    textAlign: 'center'
  })

  $('.play-btn-container').css({marginLeft: '22%'})
  $('#player-info').css({marginTop: 0, left: '40%'})

  $('#btns-2 .select2').css({width: '210px'})
  $('#mp3ChoiceContainer .select2').css({width: '78%'})
  $('#btns-2').css({marginBottom: '1em'})

  // $('#result').parent().css({marginTop: '3.8em'})

  $('#mediaControls').css({position: 'fixed', bottom: 0, right: 0, width: '100%', zIndex: 1000})
  $starredLines.hide()
  const $starredLinesSelect = $('#starredLinesSelect');
  if ($starredLinesSelect.find("option").length > 0) {
    $starredLinesSelect.show()
  }

  const downSymbol = '&#x25BC;'
  const upSymbol = '&#x25B2;'
  const scrollButton = $("#scrollButton")
  scrollButton.show()
  window.onscroll = () => {
    if (document.body.scrollTop < document.body.scrollHeight / 2) {
      scrollButton.html(downSymbol).data({'direction': 'down'})
    } else {
      scrollButton.html(upSymbol).data({'direction': 'up'})
    }
  } //onscroll

}

const scrollButtonClicked = e => {
  const direction = $("#scrollButton").data('direction')
  if (direction === 'down') {
    window.scrollTo(0, document.body.scrollHeight)
  } else {
    window.scrollTo(0, 0)
  }
}

function removeHash() {
  window.location = window.location.href.split('#')[0]
}

function getTopOffsetForCollapseButton() {
  if (isDesktop()) {
    return '8em'
  } else {
    return '11.5em'
  }
}

function updateToggleButton(button, newState) {
  const targetView = $('#' + button.data('viewId'));

  if (newState === 'expanded') {
    button.find('svg[data-role="collapseUpSign"]').show()
    button.find('svg[data-role="expandDownSign"]').hide()
  } else {
    button.find('svg[data-role="collapseUpSign"]').hide()
    button.find('svg[data-role="expandDownSign"]').show()
  }
}

function updateToggleButtonView(viewId) {
  const $button = $(`button[data-view-id="${viewId}"]`)
  let newState = ''
  if ($('#' + viewId).is(':hidden')) {
    newState = 'collapsed'
    $button.data('toggleState', newState);
  } else {
    newState = 'expanded'
    $button.data('toggleState', newState);
  }
  updateToggleButton($button, newState)
}

$('document').ready(e => {
  document.addEventListener('long-press', function (e) {
    if ($(e.target).hasClass("link")) {
      e.preventDefault()
      e.stopPropagation()
      const w = $(e.target).text()
      window.open(`https://www.google.com/search?q=${encodeURI(w)}&udm=2`, '_blank').focus();
    }
  });

  document.addEventListener('click', function (e) {
    if ($(e.target).hasClass("link")) {
      e.preventDefault()
      const link = $(e.target).attr('href')
      window.open(link, '_blank').focus();
    }
  });

  $('#mp3Choice').change(async e => {
    const link = $('#mp3Choice').val();
    if (link) {
      window.location.hash = link
      window.mediaSelected = {link: link, source: 'link'}
      window.syncSubtitle = true
      playNewMedia(link, 'link')
    } else {
      removeHash()
    }
  })

  $('#onlySubsCheckbox').change(e => {
    if ($('#onlySubsCheckbox').is(':checked')) {
      showOnlySubtitle()
    } else {
      // $('#playerControls').show()
      // $('#subControls').hide()
    }
  })

  try {
    document.onkeyup = result.onkeyup = e => {
      if (e.which === 32 && !$(e.target).is('input')) { //Space
        togglePlay()
        e.preventDefault()
        e.stopPropagation()
      }
      if (e.key === "ArrowLeft" || e.which === 37) {
        rewind()
      }
      if (e.key === "ArrowRight" || e.which === 39) {
        fastForward()
      }
    }
  } catch (e) {
    console.error(e)
  }

  $('#speed-control input').checkboxradio().change(e => {
    setSpeed()
  })

  $('#numberOfFindingsToShow').change(e => {
    render(window.searchResult, window.searchText)
  })

  $('#toggleLangCb').change(e => {
    fetchSRTs(window.searchText)
  })

  try {
    const audioPlayer = new MediaElementPlayer('localAudio', {
      iconSprite: '/img/icons/mejs-controls.svg',
      defaultSpeed: 0.75,
      speeds: ['0.50', '0.75', '1.00', '0.75'],
      features: ['playpause', 'speed', 'current', 'progress', 'duration', 'loop'],
      success: function (mediaElement, originalNode, instance) {
        addListeners(mediaElement)
      }
    })
    const videoWidth = isDesktop() ? -1 : $(window).width();
    const videoPlayer = new MediaElementPlayer('localVideo', {
      videoWidth: videoWidth,
      iconSprite: '/img/icons/mejs-controls.svg',
      defaultSpeed: 0.75,
      speeds: ['0.50', '0.75', '1.00', '0.75'],
      features: ['playpause', 'speed', 'current', 'progress', 'duration', 'loop'],
      success: function (mediaElement, originalNode, instance) {
        addListeners(mediaElement)
      }
    })

    window.audioPlayer = audioPlayer
    window.videoPlayer = videoPlayer
  } catch (e) {
    console.error(e)
    window.audioPlayer = $('#localAudio')[0]
    window.videoPlayer = $('#localVideo')[0]
  }

  const $searchText = $('#searchText');
  $searchText.on(`focus`, () => {
    if ($("#toggleClearTextOnClickCheckbox").is(":checked")) {
      $searchText.val('')
    }
  });

  $('button[data-toggle-state]').click(e => {
    const button = $(e.target).is('button') ? $(e.target) : $(e.target).parents('button').first();
    const targetView = $('#' + button.data('viewId'));
    const state = button.data('toggleState');
    const newState = state === 'expanded' ? 'collapsed' : 'expanded';
    button.data('toggleState', newState);
    if (newState === 'expanded') {
      targetView.show()
    } else {
      targetView.hide()
    }
    updateToggleButton(button, newState);
  })

  fixMobileView()

  $('#starredLinesSelect').change(e => {
    const index = $('#starredLinesSelect').val()
    const ts = window.subtitles.find(it => it.index === index).ts
    const el = $(`.starred-sub[data-index="${index}"]`)
    starredLineSelected(el, index, ts)()
  })
})

function pauseVideo() {
  window.audioPlayer.pause()
  $('#playBtn').html('Play')
}

const currentMediaTime = () => {
  let ct = audioPlayer.getCurrentTime();
  if (window.playingYoutubeVideo) {
    ct = window.ytPlayer.getCurrentTime()
  } else if (window.playingVideo) {
    ct = videoPlayer.getCurrentTime()
  }
  return parseFloat(parseFloat(ct + '').toFixed(2))
}

const clearSubtitles = () => {
  $('#sv-sub').html('')
  $('#en-sub').html('')
  $('#en-sub-mirror').html('')
  $('#starredLines').html('')
  $('#starredLinesSelect').html('')
  window.starredLines = []
}

function getWikiLink(word, uri = null, cls = 'link') {
  let uriComponent = uri || word;
  uriComponent = uriComponent.toLowerCase()
  return `<span> <span class="${cls}" href="https://${getLangFromUrl().code}.wiktionary.org/wiki/${encodeURIComponent(uriComponent)}">${word}</span></span>`;
}

function getWikiLinkSpecial(word, uri = null) {
  return getWikiLink(word, uri, 'link-special')
}

function decodeHtmlEntities(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent;
}

function removeHtmlTags(text) {
  return decodeHtmlEntities(text.replace(/<\/?[^>]+>/g, ''));
}

function encodeHtmlTags(text) {
  const m = text.matchAll(/<[^<>]+>/g)
  const encodings = {}
  Array.from(new Set(m.toArray().filter(it => it.length > 0).map(it => it[0]))).forEach(it => {
    encodings[it] = ` _${uuid().replaceAll('-', '_')}_ `
  })
  Object.keys(encodings).forEach(key => {
    const enc = encodings[key]
    text = text.replaceAll(key, enc)
  })
  return [decodeHtmlEntities(text), encodings]
}

function decodeHtmlTags(text, encodings) {
  Object.keys(encodings).forEach(key => {
    const enc = encodings[key]
    text = text.replaceAll(enc.trim(), key)
  })
  return text
}

function populateWikiLinks(text, $el) {
  $el && $el.html('')
  const [encoded, encodings] = encodeHtmlTags(text)

  const fn = (it, second) => {
    if (it.trim().length < 2) return it
    if (Object.values(encodings).map(it => it.trim()).includes(it)) return it
    return getWikiLinkSpecial(it, second)
  }
  const withLinks = encoded.split(/[ \n]/).flatMap(it => {
    const ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => fn(_w))
    }
    return fn(it, ws[0])
  }).join(' ');

  const finalHtml = decodeHtmlTags(withLinks, encodings);
  $el && $el.append(finalHtml)

  $el && $el.find(".link-special").click(e => {
    pauseVideo()
    let $target = $(e.target);
    if ($target.attr('data-clicked') === 'yes') {
      window.open($target.attr('href'), '_blank');
      $target.removeAttr('data-clicked')
    } else {
      const word = $target.text()
      $('#searchText').val(word).trigger('change')
      expandSearchResults()
      $target.attr('data-clicked', 'yes')
    }
  })
  return finalHtml
}

function populateSearchWords(sub, $el) {
  $el.html('')

  const wordLink = (word, uri = null) => {
    return $(`<span style="cursor: pointer;" data-uri="${uri || word}"> ${word}</span>`)
  };

  removeHtmlTags(sub.sv).split(/[ \n]/).flatMap(it => {
    const ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => wordLink(_w))
    }
    return wordLink(it, ws[0])
  }).forEach(it => {
    const wordLink = $(it);
    wordLink.click(e => {
      pauseVideo()
      const word = $(e.target).data('uri')
      if (window.location.toString().includes("wordbuilder")) {
        if (word.length > 2)
          window.location.hash = word
      } else {
        $('#searchText').val(word).trigger('change')
        expandSearchResults()
      }
      addStarredLine(sub.index, sub.ts)
    })
    $el.append(wordLink)
  });
}

function changeMediaIfNeededTo(media) {
  const alreadyBeingPlayed = window.playingYoutubeVideo && _.isEqual(window.mediaBeingPlayed, media);
  if (!alreadyBeingPlayed && media.source === 'link') {
    return loadYoutubeVideo(media.link)
  }
  return new Promise(resolve => resolve())
}

function starredLineSelected(el, index, ts) {
  if (!ts) {
    ts = window.subtitles.find(it => it.index === index).ts
  }
  return async e => {
    $('.starred-sub').removeClass('active')
    el.addClass('active')
    await changeMediaIfNeededTo(window.mediaSelected)
    await setMediaTime(ts, true)
  };
}

function addStarredLine(index, ts) {
  if (window.starredLines.indexOf(index) >= 0) return

  window.starredLines.push(index)

  const x = $(`<span data-index="${index}">${index}</span>`)
      .addClass('starred-sub')

  x.click(starredLineSelected(x, index, ts))

  $('#starredLines').append(x)

  $('#starredLinesSelect').append(new Option(index, index)).show()
}

function expandSearchResults() {

}

let lastSub = null
const renderSubtitles = () => {
  const currentSub = window.currentSub

  if (lastSub && currentSub !== lastSub) {
    populateWikiLinks(currentSub.sv, $('#sv-sub'));
    populateSearchWords(currentSub, $('#sv-sub-mirror'));

    $('#en-sub').html(currentSub.en)
    $('#currentTime').html(currentSub.index)
  }
  renderAccordions($('#sv-sub')[0])
  lastSub = currentSub
}

async function seekToYoutubeTime(t) {
  console.log("Seek request, target=", fromSeconds(t), "currentTime=", fromSeconds(window.ytPlayer.getCurrentTime()))
  window.ytPlayer.seekTo(t)
  window.seekRequestProcessing = true
  const leeway = Math.max(6, Math.abs(window.ytPlayer.getCurrentTime() - t))
  window.ytPlayer.seekTo(t - 4)

  return new Promise((resolve, reject) => {
    let interval = null
    interval = setInterval(() => {
      let delta = 0
      if (Math.abs(window.ytPlayer.getCurrentTime() - t) < leeway) {
        clearInterval(interval)
        console.log("Seek request completed", fromSeconds(t), "currentTime=", fromSeconds(window.ytPlayer.getCurrentTime()))
        window.ytPlayer.seekTo(t)
        resolve()
        window.seekRequestProcessing = false
        window.proxyYoutubeCurrentTime = t
      } else {
        window.ytPlayer.seekTo(t - delta)
        delta += 1
      }
    }, 10)
  })
}

function setCurrentSub(newTime) {
  if (!window.subtitles) return

  for (let i = 0; i < window.subtitles.length; i++) {
    const it = window.subtitles[i]
    if (it.ts <= newTime && newTime < it.te) {
      window.currentSub = it;
      window.currentSubIndex = i;
      break;
    }
  }
}

async function setMediaTime(newTime, manualHandling = false) {
  if (window.playingYoutubeVideo) {
    // Hackish for youtube
    await seekToYoutubeTime(newTime - (manualHandling ? 2 : 0))
    if (manualHandling) {
      ytPlayer.seekTo(newTime)
    }
  } else if (window.playingAudio) {
    audioPlayer.setCurrentTime(newTime)
  } else if (window.playingVideo) {
    videoPlayer.setCurrentTime(newTime)
  }

  setCurrentSub(newTime)
  renderSubtitles()
}

function fixSectionBox() {
  const $mp3Choice = $('#mp3Choice');

  const optgroupState = {};

  $("body").on('click', '.select2-container--open .select2-results__group', function () {
    $(this).siblings().toggle();
    const id = $(this).closest('.select2-results__options').attr('id');
    const index = $('.select2-results__group').index(this);
    optgroupState[id][index] = !optgroupState[id][index];
  })

  $mp3Choice.on('select2:open', function () {
    $('.select2-dropdown--below').css('opacity', 0);
    setTimeout(() => {
      const groups = $('.select2-container--open .select2-results__group');
      const id = $('.select2-results__options').attr('id');
      if (!optgroupState[id]) {
        optgroupState[id] = {};
      }
      $.each(groups, (index, v) => {
        optgroupState[id][index] = optgroupState[id][index] || false;
        optgroupState[id][index] ? $(v).siblings().show() : $(v).siblings().hide();
      })
      $('.select2-dropdown--below').css('opacity', 1);
    }, 0);
  })
}

$(document).ready(function () {
  fixSectionBox()
  $("#vocabularySelect").select2()
  $("#addToVocabularyDialogSelect").select2().change(e => {
    populateVocabText()
  })
  audioPlayer && hidePlayer(audioPlayer)
  videoPlayer && hidePlayer(videoPlayer)
});

async function fetchCategorisation() {
  let categorisation = await fetch(`${getResourceUrl()}/srts/categorisation.txt`)
  categorisation = await categorisation.text()
  categorisation = categorisation.split("\n")
  const categories = {}
  categorisation.forEach(it => {
    const l = it.split(" || ")
    let c = '        '
    if (l.length === 4) {
      c = l[0]
    }
    categories[l[l.length - 1]] = c
  })
  return categories
}

function populateAllLinks() {
  // let $mp3Choice = $('#mp3Choice');
  const $mp3Choice = $('#mp3Choice');
  $mp3Choice.html('').append($(`<option>-</option>`).attr('value', ''))
  const srts = window.srts
  let srtLinks = Array.from(new Set(window.srts.map(it => it.link)));

  srtLinks = _(srtLinks).chain()
      .sortBy(link => getCategory({link}))
      // .sortBy(function(link) {
      //     let srt = srts.find(it => it.link === link)
      //     return srt.name.split(" || ")[0];
      // })
      .reverse()
      .value()

  const ogs = {}
  const getOptgroup = category => {
    if (!ogs[category]) {
      let label = category
      let filter = it => it === category

      if (category === 'Okategoriserad') {
        filter = it => it.trim().length === 0
      }

      const cnt = Object.values(window.categories).filter(filter).length
      label += " (" + cnt + ")"
      ogs[category] = $(`<optgroup label="${label}">`)
    }
    return ogs[category]
  }
  srtLinks.forEach(link => {
    const item = srts.find(it => it.link === link)
    const $opt = $(`<option>${item.name.replace(".en.srt", "").replace(getTargetLangSrtSuffix(), "")}</option>`).attr('value', item.link)
    getOptgroup(getCategory(item)).append($opt)
  })

  getOptgroup('Uncategorized').append($(`<option>JOKES</option>`).attr('value', 'jokes'))
  getOptgroup('Uncategorized').append($(`<option>Snippets</option>`).attr('value', 'snippets'))
  getOptgroup('Uncategorized').append($(`<option>Poems</option>`).attr('value', 'poems'))

  Object.values(ogs).forEach(it => $mp3Choice.append(it))
  return srts;
}

async function loadAllSubtitles() {
  let srts = await fetch(`${getResourceUrl()}/srts/index.json`)
  srts = await srts.json()
  window.srts = srts

  let notFound = []
  srts.forEach(async function x(it) {
    try {
      let res = await getSubtitlesForLink(it['link'], it['source'])
    } catch (e) {
      notFound.push(it['link'])
    }
  })

  if (notFound.length > 0) {
    console.log("Not found", notFound.join('\n'))
  }

  window.categories = await fetchCategorisation()

  await loadJokes()
  loadAsSubtitles(window.jokes, 'jokes')

  await loadBookExtracts()
  loadAsSubtitles(window.bookExtracts, 'book-extracts')

  await loadSnippets()
  loadAsSubtitles(window.snippets, 'snippets')

  await loadSayings()
  loadAsSubtitles(window.sayings, 'sayings')

  await loadMetaphors()
  loadAsSubtitles(window.metaphors, 'metaphors')

  await loadIdioms()
  loadAsSubtitles(window.idioms, 'idioms')

  await loadPoems()
  loadAsSubtitles(window.poems, 'poems')

  populateAllLinks();

  await fetchVocabulary()

  window.vocabulary['Sayings'] = window.sayings.map(it => it.name)
  window.vocabulary['Metaphors'] = window.metaphors.map(it => it.name)
  window.vocabulary['Idioms'] = window.idioms.map(it => it.name)

  populateVocabularyHeadings($('#vocabularySelect'))
}

const specialLinks = ['jokes', 'idioms', 'sayings', 'metaphors', 'book-extracts', 'snippets', 'poems']

function loadAsSubtitles(data, tag) {
  try {
    data.forEach((item, i) => {
      const sv = `1\n00:00:00.001 --> 00:03:00.000\n${item.text || item}`
      const en = '1\n00:00:00.001 --> 00:03:00.000\n'
      const link = `${tag}-${i}`
      window.allSubtitles[link] = {sv, en, source: tag, fileName: link}
    })
  } catch (e) {
    console.error(e)
  }
  if (!specialLinks.includes(tag)) {
    return
  }
  try {
    let sv = ''
    let n = 0
    data.forEach((item, i) => {
      sv += `${n + 1}\n${fromSeconds(n * 60)},000 --> ${fromSeconds(n * 60 + 50)},000\n${item.text || item}\n\n`
      n += 1
    })
    window.allSubtitles[tag] = {
      sv,
      en: '1\n00:00:00.000 --> 00:00:50.000\n',
      source: tag,
      fileName: tag
    }
  } catch (e) {
    console.error(e)
  }
}

try {
  loadAllSubtitles()
  $('.controlgroup').controlgroup()
} catch (e) {
}

function srtToJson(text, lang) {
  if (!lang) lang = 'text'
  text = text.replaceAll('<c.huvudpratare>', '')
  const items = []
  let currentItem = {}
  currentItem[lang] = ''
  text.split("\n").forEach(line => {
    line = line.trim()
    const matchTime = line.match(/(\d\d:\d\d:\d\d[,.]\d\d\d) --> (\d\d:\d\d:\d\d[,.]\d\d\d)/m)
    const matchId = line.match(/^\d+$/m)
    if (matchId) {
      items.push(currentItem)
      currentItem = {index: line, id: line}
      currentItem[lang] = ''
    } else if (matchTime) {
      currentItem['start'] = {ordinal: toSeconds(matchTime[1])}
      currentItem['end'] = {ordinal: toSeconds(matchTime[2])}
      currentItem['ts'] = matchTime[1]
      currentItem['te'] = matchTime[2]
    } else {
      currentItem[lang] += (line + "\n")
    }
  })

  items.push(currentItem)
  return items.filter(it => it.start && it.start.ordinal != null)
}

function getCategory(item) {
  const link = item.link;
  let category = window.categories[link];
  category = category && category.trim()
  return category || 'Okategoriserad';
}

function storeSubtitles(subs) {
  const strategy = "Normal-Slow"

  let originalSubs = subs.map(it => ({...it}))


  for (let i = 0; i < originalSubs.length - 1; i++) {
    const it = originalSubs[i];
    it['ts_o'] = it['ts']
    it['ts'] = toSeconds(it['ts'])
    it['te_o'] = it['te']
    it['te'] = toSeconds(it['te'])
    it['number'] = i + 1;
  }

  originalSubs = _.sortBy(originalSubs, it => it.ts)

  for (let i = 0; i < originalSubs.length - 1; i++) {
    originalSubs[i]['te_o'] = originalSubs[i + 1]['ts_o']
    originalSubs[i]['te'] = originalSubs[i + 1]['ts']
    // originalSubs[i]['number'] = i + 1
  }

  window.subtitles = originalSubs
  window.currentSubIndex = 0;
  window.currentSub = window.subtitles[0];

  console.log("set currentSub", toStringSubtitle(window.currentSub))
  return originalSubs;
}

function toStringSubtitle(sub) {
  return `${sub.number}\n${sub.ts_o} --> ${sub.te_o}\n${sub.sv.substring(0, 30)}...`
}

async function getSubtitlesForLink(link, source) {
  if (window.allSubtitles[link]) {
    return window.allSubtitles[link]
  }
  const srt = window.srts.find(it => it.link === link);
  if (!srt) return

  const name = srt.name
  const svName = name + getTargetLangSrtSuffix()
  const enName = name + ".en.srt"
  let sv = await fetch(`${getResourceUrl()}/srts/${encodeURIComponent(svName)}`)
  sv = await sv.text()
  let en = await fetch(`${getResourceUrl()}/srts/${encodeURIComponent(enName)}`)
  en = await en.text()

  window.allSubtitles[link] = {sv, en, source, fileName: name}
  return window.allSubtitles[link]
}


async function loadCombinedSrts(combinedJson) {
  const json = await new Response(combinedJson).json()
  json.forEach(it => {
    const link = it.link
    const sv = it.sv
    const en = it.en
    window.allSubtitles[link] = {sv, en, fetchedFrom: 'local'}
  })
}

async function loadLocalFiles() {
  const files = Array.from(localFiles.files);
  const combinedJson = files.find(it => it.name.match(/combined.json$/))


  if (combinedJson) {
    await loadCombinedSrts(combinedJson);
    const indexJson = files.find(it => it.name.match(/index.json$/))
    if (indexJson) {
      const index = await new Response(indexJson).json()
      index.forEach(it => {
        window.allSubtitles[it.link].source = it.source
        window.allSubtitles[it.link].fileName = it.name
      })
    }
    return
  }

  let sv = null, en = null;
  const audioFile = files.find(it => it.name.match(/.mp3$/) || it.name.match(/.wav$/))
  const videoFile = files.find(it => it.name.match(/.mp4$/))
  const svSrtFile = files.find(it => it.name.match(new RegExp(getTargetLangSrtSuffix() + "$")))
  const enSrtFile = files.find(it => it.name.match(/.en.srt$/))

  sv = svSrtFile && await new Response(svSrtFile).text()
  en = enSrtFile && await new Response(enSrtFile).text()

  if (videoFile) {
    videoPlayer.setSrc(URL.createObjectURL(videoFile))
  }

  const mediaNameWithoutExtension = (audioFile || videoFile).name.replace(".mp3", "").replaceAll(".mp4", "").replaceAll(".wav", "");
  const link = _.last(mediaNameWithoutExtension.split(/ [|-]{2} /)).trim()

  if (sv && en) {
    window.allSubtitles[link] = {
      sv,
      en,
      source: 'local',
      fileName: mediaNameWithoutExtension
    }
  }

  await playNewMedia(link, 'local', videoFile || audioFile)
}

async function loadSubtitlesForLink(sv, en) {
  if (!sv) {
    alert("SV subtitle not found")
    return
  }

  if (!en) {
    en = sv
  }

  window.srtLoaded = sv
  sv = srtToJson(sv, 'sv')

  en = srtToJson(en, 'en')
  const combined = sv.map(svItem => {
    const enItem = en.find(eni => eni.ts === svItem.ts)
    const combinedItem = {...svItem, ...enItem};
    combinedItem['id'] = svItem.id //Give priority to SV subtitle
    return combinedItem
  })
  // console.log(sv)
  // console.log(en)
  console.log(combined)
  storeSubtitles(combined)

  try {
    $('#subtitlePagination').pagination('destroy')
  } catch (e) {
    // Maybe not initialized
  }
  $('#subtitlePagination').pagination({
    dataSource: range(1, window.subtitles.length),
    pageSize: 1,
    showGoInput: true,
    showGoButton: true,
    callback: function (data, pagination) {
      const pageNum = data[0]
      window.currentSub = window.subtitles[pageNum - 1]
      renderSubtitles()
    }
  }) //End pagination
}

function hidePlayer(player) {
  player.setPlayerSize(0, 0)
  $('.mejs__controls').hide()
  $('.mejs__overlay-button').hide()
}

function showAudioPlayer() {
  window.audioPlayer.setPlayerSize(600, 50)
  $('.mejs__controls').show()
}

function showVideoPlayer() {
  const {ytVideoWidth, ytHeight, subWidth} = getDimensionsForPlayer();
  window.videoPlayer.setPlayerSize(ytVideoWidth, ytHeight)
  $('video').css({'width': ytVideoWidth, 'height': ytHeight})

  $('.mejs__controls').show()
  $('.mejs__overlay-button').show()
  $('#subtitle-container').css({
    left: ytVideoWidth,
    marginLeft: '1em',
    width: subWidth,
    maxHeight: '85%',
    overflow: 'scroll',
    paddingRight: '1em'
  })
}

function showOnlySubtitle() {
  stopMedia()
  hideMediaContainer()
  $('#localVideoContainer').hide()
  $('#localMediaContainer').hide()
  window.playingYoutubeVideo = false;
  window.playingVideo = false;
  window.playingAudio = false;
  $('#subControls').show()
}

function togglePlayerControls() {
  $('#playerControls').toggle()
}


function showResultContainer() {
  $('#resultContainer').show();
  updateToggleButtonView('resultContainer')
}

function hideResultContainer() {
  $('#resultContainer').hide()
  updateToggleButtonView('resultContainer')
}

function showMediaRelatedContainer() {
  $('#mediaRelatedContainer').show()
  updateToggleButtonView('mediaRelatedContainer')
}

function hideMediaRelatedContainer() {
  $('#mediaRelatedContainer').hide()
  updateToggleButtonView('mediaRelatedContainer')
}

function showMediaContainer() {
  $('#mediaContainer').show()
  updateToggleButtonView('mediaContainer')
}

function hideMediaContainer() {
  $('#mediaContainer').hide()
  updateToggleButtonView('mediaContainer')
}

async function playNewMedia(link, source, mediaFile) {
  clearSubtitles()
  stopMedia(source)

  //Load subtitle

  function _playMedia() {
    if (source === 'link') {
      showMediaContainer()
      $('#localVideoContainer').hide()
      showMediaRelatedContainer()
      loadYoutubeVideo(link)
      window.playingYoutubeVideo = true;
    } else if (source === 'local') {
      hideMediaContainer()
      $('#localVideoContainer').show()
      window.playingYoutubeVideo = false;
      if (mediaFile.name.endsWith(".mp3") || mediaFile.name.endsWith(".wav")) {
        audioPlayer.setSrc(URL.createObjectURL(mediaFile))
        audioPlayer.play()
        window.playingAudio = true;
        window.playingVideo = false;
        hidePlayer(window.videoPlayer)
        showAudioPlayer()
      } else if (mediaFile.name.endsWith(".mp4")) {
        videoPlayer.setSrc(URL.createObjectURL(mediaFile))
        window.playingAudio = false;
        window.playingVideo = true;
        videoPlayer.play()
        hidePlayer(window.audioPlayer)
        showVideoPlayer()
      }
    }
    window.mediaBeingPlayed = {link, source}
    //$('#subControls').hide()
  }

  hideResultContainer();
  if ($('#onlySubsCheckbox').is(':checked') || specialLinks.includes(link)) {
    showOnlySubtitle();
    if (specialLinks.includes(link)) {
      $('#sv-sub-mirror').hide()
      $('#toggleEnSubBtn').hide()
    } else {
      $('#sv-sub-mirror').show()
      $('#toggleEnSubBtn').show()
    }
  } else {
    _playMedia();
    showMediaRelatedContainer()
    $('#sv-sub-mirror').show()
    $('#toggleEnSubBtn').show()
  }

  const {sv, en} = await getSubtitlesForLink(link, source)
  loadSubtitlesForLink(sv, en);

  $('#currentMedia').html(`${link}, ${source}`)

  loadStarredLines(link, source)

  $('#toggleSearchBtn').show()
}

function getLangFromUrl() {
  function alpha2Code(lang) {
    switch (lang) {
      case 'swedish':
        return 'sv'
      case 'spanish':
        return 'es'
      default:
        return null
    }
  }

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  let value = params.get('lang');
  if (!value) {
    value = 'swedish'
  }
  return {fullName: value, code: alpha2Code(value)};
}

function getResourceUrl() {
  const value = getLangFromUrl();
  return `https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/${value.fullName}`
}

function getTargetLangSrtSuffix() {
  return "." + getLangFromUrl().code + ".srt"
}

async function loadStarredLines(link, source) {
  let res = await fetch(`${getResourceUrl()}/srts/srt_favorites.json`)
  res = await res.json()

  const d = res.find(it => it.link === link)
  console.log(d)
  d && d.lines && d.lines.forEach(it => addStarredLine(it))
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

window.onload = e => {
  const link = window.location.hash.replace("#", "")
  if (link.length > 2) {
    waitUntil(() => window.ytPlayerReady)
        .then(() => {
          console.log("Playing video", link)
          $('#mp3Choice').val(link).trigger('change')
        })
  }
}

function setSpeed() {
  let newRate = $("#speed-control input[type='radio']:checked").data('speed')
  newRate = parseFloat(newRate);

  if (window.playingYoutubeVideo) {
    ytPlayer.setPlaybackRate(newRate)
  } else if (window.playingAudio) {
    localAudio.playbackRate = newRate
  } else if (window.playingVideo) {
    localVideo.playbackRate = newRate
  }
}

window.audioCurrentTimeMargin = 0;

function getCurrentTime() {
  if (window.playingAudio) {
    return audioPlayer.getCurrentTime() + window.audioCurrentTimeMargin
  } else if (window.playingVideo) {
    return videoPlayer.getCurrentTime()
  } else if (window.playingYoutubeVideo) {
    return ytPlayer.getCurrentTime()
  }
}

function isNotPlaying() {
  if (window.playingAudio) {
    return audioPlayer.paused
  } else if (window.playingVideo) {
    return videoPlayer.paused
  } else if (window.playingYoutubeVideo) {
    return ytPlayer.getPlayerState() !== 1;
  }
}

function markIntervalPlayDone(ct) {
  if (window.youtubePlayInterval && window.playingYoutubeVideo) {
    const s = window.youtubePlayInterval.start
    const e = window.youtubePlayInterval.end
    if (ct > e) {
      ytPlayer.pauseVideo()
      window.youtubePlayInterval = null
    }
  }
}

function updatePlayBtn() {
  const el = $('#playBtn')[0]
  let isPaused, isPlaying;
  if (window.playingYoutubeVideo) {
    isPaused = ytPlayer.getPlayerState() === 2;
    isPlaying = ytPlayer.getPlayerState() === 1;
  } else if (window.playingAudio) {
    isPaused = audioPlayer.paused
    isPlaying = !audioPlayer.paused
  } else if (window.playingVideo) {
    isPaused = videoPlayer.paused
    isPlaying = !videoPlayer.paused
  }

  if (isPaused) {
    $(el).html("Play").removeClass('pause-btn').addClass('play-btn')
  } else if (isPlaying) {
    $(el).html("Pause").removeClass('play-btn').addClass('pause-btn')
  }
}

function changePlaybackTimestamp(amount) {
  if (window.playingYoutubeVideo) {
    ytPlayer.seekTo(ytPlayer.getCurrentTime() + amount)
  } else if (window.playingAudio) {
    audioPlayer.setCurrentTime(audioPlayer.currentTime + amount)
  } else if (window.playingVideo) {
    videoPlayer.setCurrentTime(videoPlayer.currentTime + amount)
  }
  renderSubtitles()
}

function rewind() {
  changePlaybackTimestamp(-3);
}

function fastForward() {
  changePlaybackTimestamp(3);
}

window.addEventListener('keydown', e => {
  if (e.which === 32 && e.target === document.body) {
    e.preventDefault()
  }
})

function splitSentences(text) {
  const segmentor = new Intl.Segmenter([], {granularity: 'sentence'});
  const segmentedText = segmentor.segment(text);
  return Array.from(segmentedText, ({segment}) => segment).filter(it => it.trim().length > 1);
}

function chunkifySentence(text, max_chars) {
  const words = text.split(" ")
  const res = []
  let current = ""
  const sentences = splitSentences(text).filter(it => it.type === 'Sentence')
  for (let i = 0; i < sentences.length; i++) {
    const w = sentences[i].raw
    if (current.length + w.length >= max_chars) {
      res.push(current)
      current = w + " "
    } else {
      current += (w + " ")
    }
  }
  res.push(current)
  return res
}

function getTimesForSubtitleChunk(el, fl) {
  const lines = $(el).find(".line").map((i, e) => $(e).data()).toArray()
      .map(it => it.index).map(idx => fl.data.find(it => it.index + '' === idx + ''))

  return {
    start: lines[0].start.ordinal, end: lines[lines.length - 1].end.ordinal
  }
}

function getWikiLinks(text) {
  return text.split(/[ \n]/).flatMap(it => {
    const ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => getWikiLink(_w))
    }
    return getWikiLink(it, ws[0])
  }).join(" ")
}

function highlightedText(text, populateWikiLinks = false) {
  text = _.trim(text, "-:_")
  text = text.replaceAll("\n", " ")
  let hText = text

  try {
    let i;
    const match = text.match(new RegExp(window.searchText, "i"))
    const index = match.index

    let x = -1, y = -1;
    for (i = index - 1; i >= 0; i--) {
      const c = text[i]
      if (c === " " || c === "\n") {
        x = i;
        break;
      }
    }


    for (i = index + 1; i < text.length; i++) {
      const c = text[i]
      if (c === " " || c === "\n") {
        y = i;
        break;
      }
    }

    const firstPart = text.substring(0, x);
    const secondPart = text.substring(y);
    const highlightedPart = text.substring(x, y);

    hText = (getWikiLinks(firstPart) + ' ') + "<span class='highlight'>" + getWikiLinks(highlightedPart) + "</span>" + (' ' + getWikiLinks(secondPart));
  } catch (e) {
    // console.log(e)
    hText = getWikiLinks(hText);
  }
  return hText;
}

function playSelectedText(e) {
  const selTxt = getSelectionText() || ''

  function playChunk(_txt) {
    return new Promise(function (resolve, reject) {
      const a = new Audio()
      a.src = "http://localhost:5000/tts-proxy?q=" + _txt
      a.preload = "auto";
      a.onerror = reject;                      // on error, reject
      a.onended = resolve;                     // when done, resolve
      a.playbackRate = 1.2
      a.play()
    });
  }

  const play = () => {
    const txt = selTxt.length > 1 ? selTxt : $(e.target).parent().data('text')

    const chunks = chunkifySentence(txt)

    const first = chunks.shift()
    const promise = playChunk(first)

    promise.then(x => restoreBgMusic())
  }
  // dampenBgMusic().promise.then(x => play())
  play()
}

function numberOfItemsToShow() {
  const n = 10;
  try {
    parseInt($('#numberOfFindingsToShow').val());
  } catch (e) {
    console.log(e)
  }
  if (n === -1) {
    return 100000
  }
  return n
}

function getWords(text) {
  const segmentor = new Intl.Segmenter([], {granularity: 'word'});
  const segmentedText = segmentor.segment(text);
  return Array.from(segmentedText, ({segment}) => segment).filter(it => it.trim() !== "|");
}

class MatchResult {
  constructor(word, line, url, source) {
    this.url = url;
    this.line = line;
    this.word = word;
    this.source = source;
  }
}

function expandRegex(txt) {
  txt = txt.replaceAll("*ngn", "(jag|du|han|hon|ni|de|vi|dom)")
  txt = txt.replaceAll("*sig", "(mig|dig|honom|henne|er|sig)")
  return txt
}

function getMatchingWords(list, search) {
  const startTime = new Date().getTime()
  let wordToItemsMap = {}
  let searchText = search
  const transformedSearchText = search

  const isNotTooShort = w => w.trim().length > 2

  list.forEach(item => {
    const lines = item.data;
    lines.forEach(line => {
      if (new Date().getTime() - startTime > 20000) {
        return wordToItemsMap;
      }
      const words = getWords(line.text, search).map(it => it.trim().toLowerCase())
      const endsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.endsWith(" ") && !transformedSearchText.startsWith(" ") && word.endsWith(transformedSearchText.trim());
      const startsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.startsWith(" ") && !transformedSearchText.endsWith(" ") && word.startsWith(transformedSearchText.trim());
      words.filter(word => word.match(new RegExp(transformedSearchText, "i")) || endsWith(word) || startsWith(word))
          .forEach(word => {
            wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
          })
      // Whole search text as a word
      const word = searchText.toLowerCase().trim()
      if (word.indexOf(" ") > 0 && line.text.toLowerCase().indexOf(word) >= 0) {
        wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
      }
    })
  })

  if (wordToItemsMap[searchText.trim()] === undefined) {
    wordToItemsMap[searchText] = []
  }

  const wordToItemsMap2 = {}
  if (isNotTooShort(searchText)) {
    searchText = searchText.trim()
  }

  list.forEach(item => {
    const lines = item.data;
    lines.forEach(line => {
      const matches = line.text.match(new RegExp(searchText, "i"))
      const alreadyIncludedInResults = it => it.toLowerCase().indexOf(searchText.toLowerCase()) >= 0
          && wordToItemsMap[it.toLowerCase()].length > 0;

      if (matches && !Object.keys(wordToItemsMap).some(alreadyIncludedInResults)) {
        const matchedPart = matches[0].toLowerCase()
        wordToItemsMap2[matchedPart] = computeIfAbsent(wordToItemsMap2, matchedPart, it => []).concat(new MatchResult(matchedPart, line, item.url, item.source))
      }
    })
  })

  if (!wordToItemsMap[searchText.trim()] || wordToItemsMap[searchText.trim()].length === 0) {
    wordToItemsMap = Object.assign(wordToItemsMap, wordToItemsMap2)
  }

  const matchingWords = Object.keys(wordToItemsMap)
  matchingWords.sort((a, b) => b.length - a.length)

  const _matchResultId = it => ` ${it.url} ${it.source} ${it.line.index}`
  for (let i = 0; i < matchingWords.length; i++) {
    const prevMatches = matchingWords.slice(0, i).map(it => wordToItemsMap[it]).flat().map(_matchResultId)
    const word = matchingWords[i]
    wordToItemsMap[word] = wordToItemsMap[word].filter(it => {
      return !prevMatches.includes(_matchResultId(it))
    })
  }

  getSearchedTerms(transformedSearchText).forEach(it => {
    if (!wordToItemsMap[it] && !isRegExp(it)) {
      wordToItemsMap[it] = []
    }
  })

  return wordToItemsMap;
}

function selectSearchedWord(event) {
  const text = $(event.target).parent().data('text').replaceAll("\n", "")
  $('#searchedWords').val(text)
  //window.searchedWordsSelectedProgrammatically = true
  $('#searchedWords').trigger('change')
  window.preSelectedSearchedWord = text
}

function populateNonSRTFindings(wordToItemsMap, $result) {
  let numberOfResults = 0

  Object.keys(wordToItemsMap).toSorted().filter(word => wordToItemsMap[word].length).forEach(word => {
    const items = wordToItemsMap[word]
    const wordBlock = $(`<div><h5 class="l-accordion non-srt" style="background-color: #b6d4fe">${word}</h5></div>`)

    _.take(items, numberOfItemsToShow()).forEach(item => {
      // let parts = item.file.split("/")
      // let fileName = parts[parts.length - 1]
      const $line = $(`<div class="normal-line" title=""></div>`)

      const chunk = item.line.text

      const div = $(`
  <div class="line-part">
      <i class="fa fa-mouse-pointer" style="color: red; cursor: pointer;" onclick="selectSearchedWord(event)"></i>
      ${highlightedText(chunk.replaceAll("|", " | "))}
      <img src="/img/icons/play_icon.png" alt="" style="width: 20px;height: 20px;cursor: pointer;" class="play-btn">
  </div>`);
      div.data({text: chunk})
      $line.append(div)

      numberOfResults += 1
      wordBlock.append($line).append('<br>')
    })
    $result.prepend(wordBlock)
  })
  return numberOfResults
}

function getMainSubAndSecondarySub(file, line) {
  let mainSub = {text: ""}, secondarySub = {text: ""};
  if (file.path.endsWith(getTargetLangSrtSuffix())) {
    mainSub = {...line};
    mainSub.text = highlightedText(mainSub.text, true)
    const found = window.searchResult.find(it => it['en_subs'] && it['en_subs'].path === file.path.replaceAll(getTargetLangSrtSuffix(), ".en.srt"));
    if (found) secondarySub = found.en_subs.data.find(it => it.index === line.index)
  } else {
    mainSub = window.searchResult.find(it => it['sv_subs'] && it['sv_subs'].path === file.path.replaceAll(".en.srt", getTargetLangSrtSuffix()))
        .sv_subs.data.find(it => it.index === line.index)
    mainSub = {...mainSub}
    mainSub.text = getWikiLinks(mainSub.text)
    secondarySub = {...line};
    secondarySub.text = highlightedText(secondarySub.text)
  }

  return {mainSub, secondarySub};
}

const playClickedMedia = (url, times, source) => {
  if (!window.playingAudio && !window.playingVideo) {
    if (source !== 'YouTube') {
      window.open(`https://www.svtplay.se/video/${url}?position=${times.start}`, '_newtab')
      return
    }
    loadYoutubeVideo(url)
  } else {
    if (window.playingVideo) {
      videoPlayer.setCurrentTime(times.start)
      videoPlayer.play()
    } else if (window.playingAudio) {
      audioPlayer.setCurrentTime(times.start)
      audioPlayer.play()
    }
  }

  window.youtubePlayInterval = {...times}
  console.log(`Playing from ${fromSeconds(times.start)} to ${fromSeconds(times.end)}`)
}

function getInfoAboutMedia(mediaId, source, time_start) {
  const fileName = window.allSubtitles[mediaId].fileName
  let url = `https://www.svtplay.se/video/${mediaId}?position=${time_start}`
  if (source === 'YouTube') {
    url = `https://www.youtube.com/watch?v=${mediaId}&t=${time_start}&autoplay=1`
  }
  return {fileName, url};
}

function showInfo(id, source, time_start, time_end) {
  const {fileName, url} = getInfoAboutMedia(id, source, time_start);

  $('#info-dialog-content').html(`
    <h3><a href="${url}" target="_blank">${fileName}</a></h3>
    <h4>${source}</h4>
    <h4>${fromSeconds(time_start)} - ${fromSeconds(time_end)}</h4>
  `).dialog()
}

const changeIndices = (id, from, to) => {
  $('#' + id).data({fromIndex: from, toIndex: to})
}

function collapseSubLines(el) {
  $(el).parents('.lines-cntnr').find('.sub-lines-cntnr').slideToggle('slow')
}

function renderLines(id, url) {
  const $container = $('#' + id).addClass('lines-cntnr');
  let fromLineIndex = parseInt($container.data('fromIndex'))
  let toLineIndex = parseInt($container.data('toIndex'))

  if (fromLineIndex < 1) {
    fromLineIndex = 1
  }

  if (toLineIndex < fromLineIndex) {
    toLineIndex = fromLineIndex;
  }

  const lang = getSelectedLang()
  const subtitleFile = window.searchResult.find(it => it.url === url)[lang === 'sv' ? 'sv_subs' : 'en_subs']

  const getSub = x => subtitleFile.data.find(it => it.index + '' === x + '');
  const st = getSub(fromLineIndex);
  const end = getSub(toLineIndex)
  const time_start = parseInt(Math.floor(st.start.ordinal)); //fromSeconds(line.start.ordinal);
  const time_end = parseInt(Math.ceil(end.end.ordinal)); //fromSeconds(line.end.ordinal);

  const showInfoBtn = `<span>
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" onclick="showInfo('${subtitleFile.url}', '${subtitleFile.source}', '${time_start}', '${time_end}')" class="bi bi-info-circle media-info" viewBox="0 0 16 16" style="cursor: pointer;">
           <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
           <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
     </svg>
     <span class="info" style="display: none;">
            <span class="info times"> ${time_start}-${time_end} </span>
     </span>
    </span>`

  const isNotALink = url.startsWith('jokes-') || url.startsWith('sayings-') || url.startsWith('metaphors-') || url.startsWith('idioms-');
  const playMediaBtn =
      `<img src="/img/icons/play_icon.png" alt="" style="width: 20px;height: 20px;cursor: pointer;" class="play-btn" onclick="playMediaSlice('${url}', '${time_start}', '${time_end}', '${subtitleFile.source}')">`

  function truncate(str, n) {
    return (str.length > n) ? str.slice(0, n - 1) + '&hellip;' : str;
  };

  const infoButton = () => {
    if (isNotALink) return '';
    if (window.showInfoWithoutPopup) {
      const {fileName, url} = getInfoAboutMedia(subtitleFile.url, subtitleFile.source, time_start);
      return `<a href="${url}" target="_blank" title="${fileName}">${truncate(fileName, 20)}</a>`
    }
    return showInfoBtn;
  };

  let html = `
<hr>
<div class="buttons" style="text-align: center;">
  <span class="add-prev-btn btn" onclick="changeIndices('${id}', ${fromLineIndex - 1}, ${toLineIndex}); renderLines('${id}', '${url}')"> + </span>
  <span class="remove-next-btn btn" onclick="changeIndices('${id}', ${fromLineIndex + 1}, ${toLineIndex}); renderLines('${id}', '${url}')"> - </span>

  <span class="play-btn-container" style="text-align: center;" data-id="${id}" data-url="${url}" data-time-start="${time_start}" data-time-end="${time_end}">
     <span class="info btn" onclick="collapseSubLines(this)"> 🗖 </span>
     <span class="info">${subtitleFile.source}</span>
     ${infoButton()}
     ${playMediaBtn}
  </span>
  <span style="float: right;">
    <span class="remove-prev-btn btn" onclick="changeIndices('${id}', ${fromLineIndex}, ${toLineIndex - 1}); renderLines('${id}', '${url}')"> - </span>
    <span class="add-next-btn btn" onclick="changeIndices('${id}', ${fromLineIndex}, ${toLineIndex + 1}); renderLines('${id}', '${url}')"> + </span>
  </span>
</div>

`

  let subForLines = ''
  const mainSubPanel = $('<div>')
  const secondarySubPanel = $('<div>')


  range(fromLineIndex, toLineIndex - fromLineIndex + 1).forEach(idx => {
    const sub = getSub(idx)
    const {mainSub, secondarySub} = getMainSubAndSecondarySub(subtitleFile, ({...sub}));
    const lineMain = `<div class="line main-line" >${mainSub.text}</div>`;
    subForLines += lineMain
    mainSubPanel.append(lineMain)
    if (secondarySub && secondarySub.text) {
      const lineSec = `<div class="line secondary-line" >${secondarySub.text}</div>`;
      subForLines += lineSec
      secondarySubPanel.append(lineSec)
    }
  })

  if (isDesktop()) {
    subForLines = `<div style="display: flex; margin-top: 5px;" class="sub-lines-cntnr">
                      <div style="border-right: 2px solid #000; padding-right: 5px; margin-right: 5px;">${mainSubPanel.html()}</div>
                      <div>${secondarySubPanel.html()}</div>
                    </div>`
  } else {
    subForLines = `<div class="sub-lines-cntnr"> ${subForLines} </div>`
  }

  html += `${subForLines}<br>`

  $container.html(html)

  if (!isDesktop()) {
    $('.play-btn-container').css({marginLeft: '3%'})
  }
}

function getSearchedTerms(search) {
  if (search === null || search === undefined) {
    search = window.searchText
  }
  if (!search) return []
  const terms = _.trim(search.toLowerCase(), SEPARATOR_PIPE)
      .split(SEPARATOR_PIPE)
      .filter(it => it.trim().length > 0)
      .map(removeHintsInBrackets)
      .map(it => {
        const leftSpace = it.startsWith(" "), rightSpace = it.endsWith(" ");
        const w = it.trim()
        return (leftSpace ? " " : "") + w + (rightSpace ? " " : "")
      });
  return _.uniq(terms.filter(it => it));
}

function getWordsOrdered(words) {
  let ordered = [window.searchText]

  _.remove(words, it => it === window.searchText)

  getSearchedTerms().forEach(w => {
    if (_.remove(words, it => it.trim() === w.trim()).length) {
      ordered.push(w.trim())
    }
  })

  const relatedWords = (w, predicate) => {
    let found = words.filter(predicate)
    if (found) {
      found = _.sortBy(found, it => it.length)
      ordered = ordered.concat(found)
      _.remove(words, it => _.includes(found, it))
    }
  }

  getSearchedTerms().forEach(w => {
    relatedWords(w, it => it.trim().startsWith(w.trim()))
    relatedWords(w, it => it.trim().endsWith(w.trim()))
  })

  words.filter(it => !_.includes(ordered, it)).forEach(it => ordered.push(it))
  return _.uniq(ordered)
}

const commonWordsToIgnore = [
  'den', 'det', 'är', 'och', 'att', 'i', 'en', 'jag', 'hon', 'som', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 'så',
  'var', 'vart', 'vem', 'vilken', 'vilka', 'åt', 'heller', 'eller', 'när', 'in', 'inne', 'up', 'uppe', 'ner', 'nere',
  'här', 'där', 'var', 'dit', 'där', 'ditt', 'mitt', 'sitt', 'vårt', 'vem', 'vad', 'vilken', 'vilket', 'vilka', 'någon',
  'något', 'några', 'ingen', 'inget', 'inga', 'både', 'all', 'allt', 'alla', 'många', 'mycket', 'lite', 'få', 'färre',
  'flera', 'mest', 'minst', 'någon', 'något', 'några', 'ingen', 'inget', 'inga', 'både', 'all', 'allt', 'alla', 'många'
]

function groupAndArrangeResults(items) {
  const gpBySpl = _.groupBy(items, it => specialLinks.includes(it.source) ? it.source : 'other')
  items = gpBySpl['other'] || []
  const mediaFileNames = window.allMediaFileNames || []
  // So that at least one item for each type (e.g. idiom, joke etc.) is included
  let grouped = _.groupBy(items, it => {
    let c = categories[it.url];
    c = c || '';
    c = c.trim();
    return specialLinks.includes(it.source) ? it.source : c
  })
  grouped = _.zip(...Object.values(grouped));
  grouped = _.sortBy(grouped, it => it.filter(it => it).length).reverse()
  items = grouped.flat().filter(it => it)
  items = items.toSorted((x, y) => {
    if (mediaFileNames.some(it => _.includes(it, x.url))) return -1
  })
  return [randomFromArray(gpBySpl['jokes'] || [])].concat(items).filter(it => it)
}

function populateSRTFindings(wordToItemsMap, $result) {
  let words = getWordsOrdered(Object.keys(wordToItemsMap))
  if (window.searchText.includes(SEPARATOR_PIPE)) {
    words = words.filter(it => it.trim() !== window.searchText.trim())
  }

  words.forEach(word => {
    let items = wordToItemsMap[word] || []
    if (!items.length) {
      const w = Object.keys(wordToItemsMap).find(it => it.trim() === word.trim())
      if (w) items = wordToItemsMap[w]
    }
    let title = word
    if (word.trim().length !== word.length) {
      title = `"${word}"`
    }

    const wordBlock = $(`<div ><h5 class="l-accordion ${items.length ? '' : 'no-result'}">${title}</h5></div>`)
    items = items.toSorted((x, y) => x.path === window.preferredFile ? -1 : 1)

    wordBlock.append(`<div style=""> Wiki: ${getWikiLinks(word)} 丨
        <a href="https://www.google.com/search?q=${word}&udm=2" target="_blank">Images</a> </div> <br>`)

    $result.append(wordBlock)

    items = groupAndArrangeResults(items)

    const getEnTranslation = (item) => {
      const d = window.searchResult.find(it => it.url === item.url)['sv_subs'].data[item.line.index - 1]
      return d && d.text
    }

    const rendered = [];
    const _getWords = (it) => getWords(it.text).map(it => it.trim().toLowerCase()).filter(it => it.length > 2)
    const duplicateTranslation = (item) => {
      const enTranslation = _getWords(getEnTranslation(item))
      return rendered.map(it => _getWords(it)).find(it => _.difference(_.intersection(it, enTranslation), commonWordsToIgnore).length > 0)
    }

    for (let i = 0; i < items.length; i++) {
      if (rendered.length >= numberOfItemsToShow()) {
        break;
      }

      const remainingToRender = numberOfItemsToShow() - rendered.length;

      const item = items[i];

      if (i < remainingToRender && getSelectedLang() === 'en' && duplicateTranslation(item)) {
        continue;
      }

      const $fileBlock = $(`<div class="srt-file" title="${item['name']}">
                            <h4 data-file="${item.url}" style="display: none;"> ${word} </h4>
                        </div>`)

      wordBlock.append($fileBlock)

      const id = uuid()
      const $lines = $(`<div id="${id}" style="padding-top: 4px; padding-bottom: 8px;"></div>`)
      $lines.data({fromIndex: item.line.index, toIndex: item.line.index})
      $fileBlock.append($lines)

      renderLines(id, item.url)
      rendered.push(getEnTranslation(item))
    }//end for
  })
}

function resultNotFound(search) {
  return `
<h3>No results found for ${search}</h3>
Try Wiki ${getWikiLinks(search)}
`;
}

function combinedKeys(zEvent) {
  const keyStr = ["Control", "Shift", "Alt", "Meta"].includes(zEvent.key) ? "" : zEvent.key + "";
  return (zEvent.ctrlKey ? "Control " : "") +
      (zEvent.shiftKey ? "Shift " : "") +
      (zEvent.altKey ? "Alt " : "") +
      (zEvent.metaKey ? "Meta " : "") +
      keyStr
}

function enablePasteForHashChange() {
  $(document).keydown(function (zEvent) {
    if (combinedKeys(zEvent) === "Meta v") {
      navigator.clipboard.readText().then(text => window.location.hash = text)
    }
  })
}

function getSelectedLang() {
  return $('#toggleLangCb').prop('checked') ? 'en' : 'sv';
}

function searchSubtitleText(text, key) {
  key = key || 'sv'
  return Object.values(allSubtitles).map(it => it[key]).filter(it => it.includes(text))
}

function filterByLanguage(searchResults) {
  const selectedLang = getSelectedLang()
  return searchResults.map(it => {
    if (selectedLang === 'sv' && it.sv_match) return it.sv_subs
    if (selectedLang === 'en' && it.en_match) return it.en_subs
    return null
  }).filter(it => it);
}

function getSurrounding(index, list, size = 5) {
  list = list.map((item, index) => ({item, index}))
  const idx = list.findIndex(it => it.index === index)
  if (idx < 0) return []
  return list.slice(Math.max(0, idx - size), Math.min(list.length, idx + (size + 1)))
}

function renderVocabularyFindings(search) {
  search = search.toLowerCase().trim()

  function wordIsInVocabularyLine(vocabLine) {
    try {
      return getWords(expandWords(vocabLine)).filter(it => it.trim().length > 2).map(it => it.toLowerCase().trim()).includes(search);
    } catch (e) {
      console.log(vocabLine, e)
      return false
    }
  }

  const categories = Object.keys(window.vocabulary)
      .filter(cat => window.vocabulary[cat].find(wordIsInVocabularyLine))

  const words = categories.map(it => window.vocabulary[it]).flat()

  const indexesOfAppearance = words.map((vocabLine, i) =>
      wordIsInVocabularyLine(vocabLine) ? i : null)
      .filter(it => it)

  const vocab = $('#vocabularyResult')
  vocab.html('')
  indexesOfAppearance.forEach(idx => {
    const vocabItem = $('<div class="vocabulary-segment"></div>')
    const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')
    getSurrounding(idx, words).forEach(it => {
      let txt = it.item
      const $line = $(`<div class="vocabulary-line"></div>`);
      if (txt.trim().length) {
        $line.append(`<i class="fa fa-mouse-pointer" style="color: red; cursor: pointer;margin-right: 3px;" onclick="selectSearchedWord(event)"></i>`)
      } else {
        txt = "------------------"
      }
      $line.append(`<span>${txt.replaceAll(SEPARATOR_PIPE, " | ")}</span>`)
      $line.data({text: txt})

      if (it.index === idx) {
        $line.addClass('highlighted')
      }
      vocabItemContent.append($line)
    })
    vocabItem.append(vocabItemContent)
    vocab.append(vocabItem)
  })
  $('.vocabulary-segment').each((i, e) => $(e).find('.highlighted')[0].scrollIntoView())
}

function render(searchResults, search, className) {
  renderVocabularyFindings(search)
  if (!searchResults) return {}

  const $result = $('#result');
  $result.html('')

  if (className === "secondary") {
    $result.css({backgroundColor: '#e3cece'})
  } else {
    $result.css({backgroundColor: 'white'})
  }

  if (window.unprocessedSearchText) {
    $result.append(`<p class="search-text-info">${
        unprocessedSearchText.split(SEPARATOR_PIPE).map(it => getWikiLink(it)).join(" | ")
    }</p>`)
  }

  const searchResultsFiltered = filterByLanguage(searchResults);

  const wordToItemsMap = getMatchingWords(searchResultsFiltered, search);
  populateSRTFindings(wordToItemsMap, $result);

  if (Object.keys(wordToItemsMap).length === 0) {
    $result.html(resultNotFound(window.searchText))
  }

  $result.append("<hr>")

  let wordToItemsMapNonSrt = {}
  if (window.location.pathname.includes("wordbuilder")) {
    wordToItemsMapNonSrt = getMatchingWords(searchResults.filter(it => it.nonSrt), search, item => [item]);
    populateNonSRTFindings(wordToItemsMapNonSrt, $result);
  }

  renderAccordions($result[0])

  $(".srt-file h4").dblclick(e => {
    window.preferredFile = $(e.target).data().file
  })

  $(".srt-line .play-btn").click(e => {
    if ($(e.target).hasClass('disabled')) return

    $('.srt-line').removeClass('selected')
    $(e.target).parents('.srt-line').addClass('selected')

    const url = $(e.target).data("url")
    const dt = $(e.target).parents('.srt-line').data()

    const times = getTimesForSubtitleChunk($(e.target).parents('.srt-line'), dt.file)

    // dampenBgMusic().promise.then(x => play())
    playClickedMedia(url, times, dt.file.source)
    // $( "#audioPlayerPopup" ).dialog('open')
    // $('#audioPlayerPopup').css({width: '100%'})
  })

  $(".normal-line .play-btn").click(e => {
    playSelectedText(e);
  })

  showResultContainer();

  // return Object.assign({}, wordToItemsMap, wordToItemsMapNonSrt);
  return wordToItemsMap;
} // end render

function getSubs(text, file, url, source, fetchedFrom) {
  return {data: srtToJson(text), path: file, url, source, fetchedFrom: fetchedFrom}
}

class SearchResult {
  constructor(source, url, en_subs, sv_subs, en_match, sv_match) {
    this.source = source
    this.url = url
    this.en_subs = en_subs;
    this.sv_subs = sv_subs;
    this.sv_match = sv_match;
    this.en_match = en_match;
  }
}

function fetchFromDownloadedFiles(lookingFor) {
  lookingFor = expandWords(lookingFor)

  return Object.keys(window.allSubtitles)
      .filter(it => window.allSubtitles[it].sv && window.allSubtitles[it].en)
      .map(it => {
        const svText = window.allSubtitles[it].sv;
        const enText = window.allSubtitles[it].en;

        const svMatch = svText && svText.match(new RegExp(lookingFor, "i"))
        const enMatch = enText && enText.match(new RegExp(lookingFor, "i"))
        if (svMatch || enMatch) {
          return new SearchResult(
              window.allSubtitles[it].source,
              it,
              getSubs(enText, it + ".en.srt", it, window.allSubtitles[it].source, window.allSubtitles[it].fetchedFrom),
              getSubs(svText, it + getTargetLangSrtSuffix(), it, window.allSubtitles[it].source, window.allSubtitles[it].fetchedFrom),
              !!enMatch,
              !!svMatch,
          )
        }
      }).filter(it => it);
}

export function removeHintsInBrackets(txt) {
  const original = txt;
  txt = txt.replaceAll("(sl-pl)", "")
      .replaceAll("(pl)", "")
      .replaceAll(" (ngt) ", " .*")
      .replaceAll(" (ngn) ", " .*")
      .replaceAll(" (ngn)", " [^ ]*")
      .replaceAll(" (ngt)", " [^ ]*")

  const fn = () => {
    if (txt.indexOf("(") < 0) return
    if (txt.indexOf("(") >= 0 && txt.indexOf(")") < 0) {
      alert("Invalid brackets in" + original)
      txt = txt.replaceAll("(", "")
      return
    }
    const matches = txt.match(/.*(\(.*\)).*/)
    if (matches && matches.length === 2) {
      txt = txt.replaceAll(matches[1], "")
    }
  }

  while (txt.indexOf("(") >= 0) {
    fn()
  }

  return txt
}

/**
 * `<*gå an (something)|göra` becomes `gå an |går an |gick an |gått an |göra`
 * Extra info in brackets () is removed
 * and if there is mapping available for word with `<*` then it is replaced with mappings
 * @returns{string} expanded text
 * @param{string} txt
 */
export function expandWords(txt, lang='sv') {
  txt = getSearchedTerms(txt).join(SEPARATOR_PIPE)
  const startTime = new Date().getTime()

  const t = _expandWords(txt, lang)
  if (!t || t.trim() === '') { //Fallback
    return txt.replaceAll("<*", "")
  }

  return t
}

function _expandWords(txt, lang) {
  if (txt.indexOf("<*") < 0) {
    return removeHintsInBrackets(txt)
  }

  const expansions = getExpansionForWords()
  const terms = txt.split(SEPARATOR_PIPE).map(it => _.includes(it, "<*") && !it.endsWith(" ") ? it + " " : it)
  const fn = () => {
    const w = terms.shift()
    if (!w) return
    const match = w.match(/<\*(?:\(([^)]+)\))?([^\s>]*) .*/)
    if (match && match.length === 3) {
      const ref = match[1]
      const wordToExpand = match[2]
      let expandedWords = [];
      if(lang === 'es') {
        expandedWords = conjugateTableSpanish(wordToExpand).flat()
      } else {
        expandedWords = expansions[wordToExpand] || [wordToExpand]
      }
      expandedWords.forEach(it => terms.push(w.replace("<*" + wordToExpand, it)))
    } else if (w.indexOf("<*") < 0) {
      terms.push(w)
    }
  }

  const cnt = 0
  while (cnt < 5 && terms.some(t => t.indexOf("<*") >= 0)) {
    fn()
  }

  return terms
      .filter(it => it.trim().length > 1)
      .map(it => {
        if (it.length < 3) return ` ${it} `
        return it
      }).join(SEPARATOR_PIPE)
}

async function fetchSRTs(searchText) {
  if ((typeof searchText) !== 'string') {
    searchText = null
  }
  const $searchText = $("#searchText");
  const txt = searchText || $searchText.val().toLowerCase()
  // $searchText.val(txt)

  if (txt.length < 3) return

  window.searchText = txt;
  window.searchText = expandWords(window.searchText)
  window.searchText = _.trim(window.searchText, SEPARATOR_PIPE)

  //To fix the mistakes in vocabulary list with double spaces
  window.searchText = window.searchText.split(" ").map(it => it.trim()).join(" ")

  window.allSubtitles = window.allSubtitles || {}

  console.log("Loading from local")
  window.searchResult = fetchFromDownloadedFiles(window.searchText.trim());
  const words = render(window.searchResult, window.searchText, "primary")
  if (!window.searchText.includes(SEPARATOR_PIPE) && window.searchText.trim().length > 4 && Object.values(words).flat().length === 0) {
    window.searchText = window.searchText + "|" + window.searchText.trim().slice(0, -2)
    window.searchResult = fetchFromDownloadedFiles(window.searchText);
    render(window.searchResult, window.searchText, "secondary")
  }
}

function isRegExp(text) {
  let isRegex = false;
  if ([".", "*", "?"].some(it => _.includes(text, it))) {
    isRegex = true;
  }
  return isRegex;
}

function renderAccordions(el) {
  console.log('Rendering accordions')
  el = el || document
  const isAccordion = it => Array.from(it.classList.values()).indexOf('accordion') >= 0
  const isAccordionEnd = it => Array.from(it.classList.values()).indexOf('accordion-end') >= 0

  function fixAccordionPanel(accordionEl) {
    if (accordionEl.hasAttribute("accordion-rendered")) {
      return
    }
    let el = accordionEl.nextElementSibling
    const siblings = []
    while (el) {
      if (isAccordion(el) || isAccordionEnd(el)) break

      siblings.push(el)
      el = el.nextElementSibling
    }

    if (siblings.length > 1) {
      const newEl = document.createElement('div')
      newEl.classList.add('autocreated-panel')
      siblings.forEach(it => newEl.appendChild(it))

      accordionEl.insertAdjacentElement('afterend', newEl)
    }
    accordionEl.setAttribute('accordion-rendered', 'true')
  }

  $(el).find('td').each((i, e) => $(e).css({verticalAlign: 'top'}))

  let acc = el.getElementsByClassName("l-accordion");
  if (acc.length === 0) {
    acc = el.getElementsByClassName("accordion");
  }
  let i;

  for (i = 0; i < acc.length; i++) {
    acc[i].classList.add(i % 2 === 0 ? 'even' : 'odd')

    if (acc[i].dataset.accordion_rendered === "true") continue;

    fixAccordionPanel(acc[i])
    acc[i].addEventListener("click", function () {
      /* Toggle between adding and removing the "active" class,
      to highlight the button that controls the panel */
      this.classList.toggle("active");

      /* Toggle between hiding and showing the active panel */
      const panel = this.nextElementSibling;
      if (panel && panel.style.display === "block") {
        panel.style.display = "none";
      } else if (panel) {
        panel.style.display = "block";
      }
    });
  }

  $(".l-accordion").filter((i, it) => !$(it).hasClass("no-result") && !$(it).hasClass("non-srt")).first().click()
}

// 2. This code loads the IFrame Player API code asynchronously.
const tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.

function loadYoutubeVideo(videoId) {
  const iframe = ytPlayer.getIframe()
  showMediaContainer()
  showMediaRelatedContainer()
  return new Promise((resolve, reject) => {
    try {
      const currentVideoId = iframe.src.split("embed/")[1].split("?")[0]
      iframe.src = `${iframe.src}`.replaceAll(currentVideoId, videoId)
      iframe.onload = () => {
        setSpeed();
        resolve()
      }
    } catch (e) {
      console.log(e)
      reject(e)
    }
  })
}

function getDimensionsForPlayer() {
  const wh = window.innerHeight, ww = window.innerWidth;

  let ytVideoWidth = 940, ytHeight = 590;
  let subWidth = 0;

  if (isDesktop()) {
    ytVideoWidth = ww * 0.6;
    subWidth = $(window).width() - (ytVideoWidth + 40)
  } else {
    ytVideoWidth = ww - 15;
    subWidth = ww - 10;
    ytHeight = wh / 2 - 150;
    // $('#mediaControls').css({width: '100%', bottom: '-15em', right: 0})
    $('#youtubePlayer-info').hide()
    // $('#speed-control').parent().hide()

    $('#mp3Choice').parent().css({width: ww - 20})
  }
  return {ytVideoWidth, ytHeight, subWidth};
}

const {ytVideoWidth, ytHeight, subWidth} = getDimensionsForPlayer();

function onYouTubeIframeAPIReady() {
  window.ytPlayer = new YT.Player("youtubePlayer", {
    height: ytHeight,
    width: ytVideoWidth,
    videoId: 'K8P_USOppfs',
    playerVars: {
      'playsinline': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
  $('#subtitle-container').css({
    left: ytVideoWidth,
    marginLeft: '1em',
    width: subWidth,
    maxHeight: '85%',
    overflow: 'scroll',
    paddingRight: '1em'
  })
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
  event.target.playVideo();
  window.ytPlayerReady = true

  if (window.youtubePlayInterval) {
    seekToYoutubeTime(window.youtubePlayInterval.start)
  }
}


function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    window.ytPlaying = true
  } else {
    window.ytPlaying = false;
  }
}

function stopMedia(source) {
  if (window.playingYoutubeVideo) {
    window.ytPlayer.pauseVideo();
  } else if (window.playingAudio) {
    audioPlayer.pause()
  } else if (window.playingVideo) {
    videoPlayer.pause()
  }
}

setInterval(() => {
  //Check time
  if (window.playingYoutubeVideo || window.playingAudio || window.playingVideo) {
    ontimeupdate()
  }
}, 100)


function export2txt(data, fileName) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], {
    type: "text/plain"
  }));
  a.setAttribute("download", fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function saveStarredLines() {
  let nm = window.allSubtitles[window.mediaBeingPlayed.link].fileName
  nm += ".starred.json"
  const lines = $('.starred-sub').map((i, e) => $(e).text()).toArray()

  const _ms = window.mediaBeingPlayed.source

  if (_ms === 'local') {
    const s = prompt('Source of media:')
    if (!s || !s.trim()) return
    window.mediaBeingPlayed['source'] = s.trim()
  }

  const data = JSON.stringify({...window.mediaBeingPlayed, lines})

  try {
    const r = await fetch('http://localhost:5000/srt-favorites', {
      method: 'POST',
      body: data,
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'}
    })
    // console.log(await r.json())
    // export2txt(data, nm)
    if (r.status != 200) {
      alert("Failed to save. Status=" + r.status)
    }
  } catch (e) {
    console.log(e)
    alert("Failed to save")
  }

}

async function saveRevision() {
  let nm = window.allSubtitles[window.mediaBeingPlayed.link].fileName
  nm += ".starred.json"
  const dates = []

  const _ms = window.mediaBeingPlayed.source

  if (_ms === 'local') {
    const s = prompt('Source of media:')
    if (!s || !s.trim()) return
    window.mediaBeingPlayed['source'] = s.trim()
  }

  const data = JSON.stringify({...window.mediaBeingPlayed, dates})

  try {
    const r = await fetch('http://localhost:5000/srt-revision', {
      method: 'POST',
      body: data,
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'}
    })
    if (r.status != 200) {
      alert("Failed to save. Status=" + r.status)
    }
  } catch (e) {
    console.log(e)
    alert("Failed to save")
  }
}

function isLocalhost() {
  return window.location.hostname === 'localhost'
}

if (isLocalhost()) {
  $('#saveRevisionBtn').show()
  $('#saveStarredLinesBtn').show()

  setInterval(() => {
    fetch("http://localhost:5000/vocabulary")
        .then(it => it.json())
        .then(it => {
          window.vocabularyLines = it.text.split("\n")
          window.vocabulary = parseVocabularyFile(it.text)
        })
  }, 5000)
}


function test_data() {
  let idx = 0

  function data(txt) {
    const i = idx++
    return {
      index: i,
      id: i,
      start: {ordinal: 0},
      end: {ordinal: 1},
      text: txt
    }
  }

  const enSubs = {
    data: [
      {
        index: 1,
        id: 1,
        start: {ordinal: 0},
        end: {ordinal: 1},
        text: "XYZ!"
      },
      {
        index: 2,
        id: 2,
        start: {ordinal: 1},
        end: {ordinal: 2},
        text: "abc"
      }
    ],
    path: "path1.en.srt",
    source: "source1",
    url: "url1"
  }

  const svSubs1 = {
    data: [
      data("I grund och botten, är det enkelt!"),
      data("Nånstans i världen, finns det en plats!"),
      data("Som du var inne på"),
      data("bara bott"),
      data("bara bott, ingeting annan!"),
      data("här har vi prefixedbott")
    ],
    path: "path1.sv.srt",
    source: "source1",
    url: "url1"
  }

  const svSubs2 = {
    data: [
      data("Grund och botten, ja!"),
      data("Ja, det är sant. Grund och botten!"),
      data("Som han var inne på")
    ],
    path: "path2.sv.srt",
    source: "source1",
    url: "url2"
  }
  return [svSubs1, svSubs2];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function playMediaSlice(url, start, end, source) {
  if (source === 'YouTube') {
    showMediaContainer()
    showMediaRelatedContainer();
    if (ytPlayer.getVideoUrl().indexOf(url) < 0) {
      window.mediaSelected = {link: url, source: 'link'}
      window.playingYoutubeVideo = true
      window.syncSubtitle = false
      await changeMediaIfNeededTo(window.mediaSelected)
    }
    await seekToYoutubeTime(start)
    return
  }
  if (location.href.indexOf('localhost') < 0) {
    return
  }
  const mp3Url = 'http://localhost:5000/mp3_slice?' + new URLSearchParams({url, start, end});
  const a = new Audio()
  a.src = mp3Url
  a.volume = 1.0
  try {
    await dampenBgMusic().promise
  } catch (e) {
    console.log(e)
  }
  a.onended = e => restoreBgMusic()
  await a.play()
}


