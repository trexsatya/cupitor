Array.prototype.max = function () {
  return Math.max.apply(null, this);
};
Array.prototype.last = function () {
  return _.last(this)
};

window.onbeforeunload = function (event) {
  return confirm("Confirm refresh");
};

async function loadJokes() {
  let response = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/jokes/1.txt")
  response = await response.text()
  response = response.split(/[0-9]+\.jpg\n     ------------\n/).map(it => it.trim()).filter(it => it.length > 20)
  window.jokes = response
}

function _poulateData(where, response) {
  response.split("---------------").map(it => it.trim()).forEach(it => {
    let splits = it.split("\n")
    where.push({
      name: _.trim(splits[0]),
      text: _.drop(splits, 1).join("\n")
    })
  })
}

async function loadSayings() {
  let response = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/sayings/1.txt")
  response = await response.text()
  window.sayings = []
  _poulateData(window.sayings, response)
}

async function loadMetaphors() {
  let response = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/metaphors/1.txt")
  response = await response.text()
  window.metaphors = []
  _poulateData(window.metaphors, response)
}

async function loadIdioms() {
  let response = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/idioms/1.txt")
  response = await response.text()
  window.idioms = []
  _poulateData(window.idioms, response)
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

function loadSearches() {
  let searches = getSearchesFromStorage()
  $('#searchedWords').html('')
  _.forEach(searches, (word) => {
    let displayText = word
    let isSeparator = false
    if (word.trim().length === 0) {
      displayText = "-------"
      word = displayText
      isSeparator = true
    }
    let op = new Option(`${displayText}`, word, false, false)
    if (isSeparator) {
      op.disabled = true
    }
    $('#searchedWords').append(op)
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
  let searches = getSearchesFromStorage()
  export2txt(Object.keys(searches).join("\n"), "searches.txt");
  $('#toggleSearchesControlCheckbox').click()
}

function importSearches() {
  $("#import-dialog").dialog()
}

function importSearchesFromVocab() {
  let category = $("#vocabularySelect").val()
  let searches = window.vocabulary[category]

  saveSearchesIntoStorage(searches)
  loadSearches()
}

function importSearchesFromFile() {
  let file = document.createElement('input')
  file.type = 'file'
  file.accept = '.txt'
  file.onchange = e => {
    let reader = new FileReader()
    reader.onload = e => {
      let searches = {}
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
  count = count || 0
  let searches = getSearchesFromStorage()
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

async function searchTextChanged(e) {
  let el = $('#searchedWords')
  let w = $('#searchText').val()

  await fetchSRTs(this);
  // let count = wordsToItems[w] && wordsToItems[w].length
  // count = count || 0
  let newItem = saveSearch(w, null)
  if (newItem) {
    el.append(new Option(`${w}`, w, false, false))
  }
}

function parseVocabularyFile(text) {
  let lines = text.split("\n")
  let categories = {}
  let currentCategory = null
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (line.startsWith("#")) {
      currentCategory = line.replace("#", "").trim()
      categories[currentCategory] = []
    } else {
      categories[currentCategory].push(line)
    }
  }

  return categories
}

function populateVocabulary() {
  let $vocabularySelect = $('#vocabularySelect')
  $vocabularySelect.html('<option>-</option>')
  Object.keys(window.vocabulary).forEach(it => {
    let op = new Option(it, it)
    $vocabularySelect.append(op)
  })
}

async function fetchVocabulary() {
  let res = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/vocabulary.txt")
  res = await res.text()
  window.vocabulary = parseVocabularyFile(res)
}

function searchedWordSelected() {
  $('#searchText').val($('#searchedWords').val()).trigger('change')
}

window.playingYoutubeVideo = false;

function toSeconds(str) {
  str = str + ""
  let hour = 0, mins = 0, secs = 0, millis = 0
  if (str.split(/[,.]/).length === 2) {
    let splits = str.split(/[,.]/)
    str = splits[0]
    millis = splits[1]
  }
  let splits = str.split(":")

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
  let _pad = x => x.length < 2 ? '0' + x : x;
  let hrs = Math.floor(number / 3600) + ''
  let mins = Math.floor((number % 3600) / 60) + ''
  let secs = Math.floor((number % 3600) % 60) + ''


  return `${_pad(hrs)}:${_pad(mins)}:${_pad(secs)}`
}

let URL = window.URL || window.webkitURL
let displayMessage = function (message, isError) {
  let element = document.querySelector('#message')
  element.innerHTML = message
  element.className = isError ? 'error' : 'info'
}


let ontimeupdate = e => {
  if (isNotPlaying()) {
    return
  }
  // console.log(currentSub, player.currentTime)


  if (window.seekRequestProcessing) {
    return
  }

  updatePlayBtn()

  let ct = getCurrentTime()

  // if (window.rewindData) {
  //   if (ct >= window.rewindData.from) {
  //     window.rewindData = null
  //     console.log("Resetting speed", ct)
  //     // audioPlayer.setDuration(window.currentSub.speed)
  //   } else {
  //     // return
  //   }
  // }

  if (window.currentSub && ct > window.currentSub.te) {
    window.currentSubIndex += 1;
    window.currentSub = window.subtitles[window.currentSubIndex]
  }

  markIntervalPlayDone(ct);

  renderSubtitles()

  setCurrentSub(ct)
  renderSubtitles()

  setSpeed();
}

let addListeners = it => {
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

window.marginStartSubtitle = 0
window.marginEndSubtitle = 0

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

  $(".fl-left").css({width: '100%', clear: 'both'})
  $(".fl-right").css({left: 0, width: '100%', marginTop: '0.3em', clear: 'both'})
  $('#starredLines').parent().css({
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

  $('#collapseMainControl').parent().css({top: getTopOffsetForCollapseButton(), left: '48%'})
  $('#result').parent().css({marginTop: '3.8em'})
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

$('document').ready(e => {

  $('#mp3Choice').change(async e => {
    let link = $('#mp3Choice').val();
    if (link) {
      window.location.hash = link
      window.mediaSelected = {link: link, source: 'link'}
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

  document.onkeyup = result.onkeyup = e => {
    if (e.which === 32 && !$(e.target).is('input')) { //Space
      togglePlay()
      e.preventDefault()
      e.stopPropagation()
    }
  }

  $('#speed-control').change(e => {
    setSpeed()
  })

  $('#numberOfFindingsToShow').change(e => {
    render(window.searchResult, window.searchText)
  })

  $('#toggleLangCb').change(e => {
    render(window.searchResult, window.searchText)
  })

  let audioPlayer = new MediaElementPlayer('localAudio', {
    iconSprite: '/img/icons/mejs-controls.svg',
    defaultSpeed: 0.75,
    speeds: ['0.50', '0.75', '1.00', '0.75'],
    features: ['playpause', 'speed', 'current', 'progress', 'duration', 'loop'],
    success: function (mediaElement, originalNode, instance) {
      addListeners(mediaElement)
    }
  })
  let videoWidth = isDesktop() ? -1 : $(window).width();
  let videoPlayer = new MediaElementPlayer('localVideo', {
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

  let $searchText = $('#searchText');
  $searchText.on(`focus`, () => {
    if ($("#toggleClearTextOnClickCheckbox").is(":checked")) {
      $searchText.val('')
    }
  });

  $('#collapseMainControl').click(e => {
    $('#mainControlInputs').toggle();

    let $collapseUpSign = $('#collapseUpSign');
    $collapseUpSign.toggle()
    $('#collapseDownSign').toggle()
    if ($collapseUpSign.is(':visible')) {
      $('#collapseMainControl').parent().css({top: getTopOffsetForCollapseButton()})
    } else {
      $('#collapseMainControl').parent().css({top: '0.1em'})
    }
  })

  fixMobileView()
})

function pauseVideo() {
  window.audioPlayer.pause()
  $('#playBtn').html('Play')
}

let currentMediaTime = () => {
  let ct = audioPlayer.getCurrentTime();
  if (window.playingYoutubeVideo) {
    ct = window.ytPlayer.getCurrentTime()
  } else if (window.playingVideo) {
    ct = videoPlayer.getCurrentTime()
  }
  return parseFloat(parseFloat(ct + '').toFixed(2))
}

let clearSubtitles = () => {
  $('#sv-sub').html('')
  $('#en-sub').html('')
  $('#en-sub-mirror').html('')
  $('#starredLines').html('')
  window.starredLines = []
}

function getWikiLink(word, uri = null) {
  let uriComponent = uri || word;
  uriComponent = uriComponent.toLowerCase()
  return `<span> <a href="https://sv.wiktionary.org/wiki/${encodeURIComponent(uriComponent)}" target="_blank">${word}</a></span>`;
}

function populateWikiLinks(text, $el) {
  $el.html('')

  text.split(/[ \n]/).flatMap(it => {
    let ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => getWikiLink(_w))
    }
    return getWikiLink(it, ws[0])
  }).forEach(it => {
    let wordLink = $(it);
    wordLink.click(e => {
      pauseVideo()
    })
    $el.append(wordLink)
  });
}

function changeMediaIfNeededTo(media) {
  let notAlradyBeingPlayed = window.playingYoutubeVideo && !_.isEqual(window.mediaBeingPlayed, media);
  let canBePlayed = window.playingYoutubeVideo && !_.isEqual(window.mediaBeingPlayed, media);
  if (notAlradyBeingPlayed && window.mediaBeingPlayed.source === 'link') {
    return loadYoutubeVideo(media.link)
  }
  return new Promise(resolve => resolve())
}

function addStarredLine(index, ts) {
  if (window.starredLines.indexOf(index) >= 0) return

  window.starredLines.push(index)

  let x = $(`<span data-index="${index}">${index}</span>`)
    .addClass('starred-sub')

  if (!ts) {
    ts = window.subtitles.find(it => it.index === index).ts
  }
  x.click(async e => {
    $('.starred-sub').removeClass('active')
    x.addClass('active')
    await changeMediaIfNeededTo(window.mediaSelected)
    await setMediaTime(ts, true)
  })

  $('#starredLines').append(x)
}

function populateSearchWords(sub, $el) {
  $el.html('')
  let n = 1;

  let wordLink = (word, uri = null) => $(`<span style="cursor: pointer;" data-uri="${uri || word}"> ${word}</span>`);

  sub.sv.split(/[ \n]/).flatMap(it => {
    let ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => wordLink(_w))
    }
    return wordLink(it, ws[0])
  }).forEach(it => {
    let wordLink = $(it);
    wordLink.click(e => {
      pauseVideo()
      $('#searchText').val($(e.target).data('uri')).trigger('change')
      addStarredLine(sub.index, sub.ts)
    })
    $el.append(wordLink)
    n++;
  });
}

let lastSub = null
let renderSubtitles = () => {
  let currentSub = window.currentSub

  if (lastSub && currentSub !== lastSub) {
    populateWikiLinks(currentSub.sv, $('#sv-sub'));
    populateSearchWords(currentSub, $('#sv-sub-mirror'));

    $('#en-sub').html(currentSub.en)
    $('#currentTime').html(currentSub.index)
  }
  lastSub = currentSub
}

async function seekToYoutubeTime(t) {
  console.log("Seek request, target=", fromSeconds(t), "currentTime=", fromSeconds(window.ytPlayer.getCurrentTime()))
  window.ytPlayer.seekTo(t)
  window.seekRequestProcessing = true
  let leeway = Math.max(6, Math.abs(window.ytPlayer.getCurrentTime() - t))
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
    let it = window.subtitles[i]
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
  let $mp3Choice = $('#mp3Choice');

  let optgroupState = {};

  $("body").on('click', '.select2-container--open .select2-results__group', function () {
    $(this).siblings().toggle();
    let id = $(this).closest('.select2-results__options').attr('id');
    let index = $('.select2-results__group').index(this);
    optgroupState[id][index] = !optgroupState[id][index];
  })

  $mp3Choice.on('select2:open', function () {
    $('.select2-dropdown--below').css('opacity', 0);
    setTimeout(() => {
      let groups = $('.select2-container--open .select2-results__group');
      let id = $('.select2-results__options').attr('id');
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
  hidePlayer(audioPlayer)
  hidePlayer(videoPlayer)
});

async function fetchCategorisation() {
  let categorisation = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/categorisation.txt")
  categorisation = await categorisation.text()
  categorisation = categorisation.split("\n")
  let categories = {}
  categorisation.forEach(it => {
    let l = it.split(" || ")
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
  let $mp3Choice = $('#mp3Choice');
  $mp3Choice.html('').append($(`<option>-</option>`).attr('value', ''))
  let srts = window.srts
  let srtLinks = Array.from(new Set(window.srts.map(it => it.link)));

  let categories = window.categories
  srtLinks = _(srtLinks).chain()
    .sortBy(link => getCategory({link}))
    // .sortBy(function(link) {
    //     let srt = srts.find(it => it.link === link)
    //     return srt.name.split(" || ")[0];
    // })
    .reverse()
    .value()

  let ogs = {}
  let getOptgroup = category => {
    if (!ogs[category]) {
      let label = category
      let filter = it => it === category

      if (category === 'Okategoriserad') {
        filter = it => it.trim().length === 0
      }

      let cnt = Object.values(window.categories).filter(filter).length
      label += " (" + cnt + ")"
      ogs[category] = $(`<optgroup label="${label}">`)
    }
    return ogs[category]
  }
  srtLinks.forEach(link => {
    let item = srts.find(it => it.link === link)
    let $opt = $(`<option>${item.name.replace(".en.srt", "").replace(".sv.srt", "")}</option>`).attr('value', item.link)
    getOptgroup(getCategory(item)).append($opt)
  })

  Object.values(ogs).forEach(it => $mp3Choice.append(it))
  return srts;
}

async function loadAllSubtitles() {
  let srts = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/index.json")
  srts = await srts.json()
  window.srts = srts

  srts.forEach(async function x(it) {
    await getSubtitlesForLink(it['link'], it['source'])
  })

  window.categories = await fetchCategorisation()

  await loadJokes()
  loadAsSubtitles(window.jokes, 'jokes')

  await loadSayings()
  loadAsSubtitles(window.sayings, 'sayings')

  await loadMetaphors()
  loadAsSubtitles(window.metaphors, 'metaphors')

  await loadIdioms()
  loadAsSubtitles(window.idioms, 'idioms')

  populateAllLinks();

  await fetchVocabulary()

  window.vocabulary['Sayings'] = window.sayings.map(it => it.name)
  window.vocabulary['Metaphors'] = window.metaphors.map(it => it.name)
  window.vocabulary['Idioms'] = window.idioms.map(it => it.name)

  populateVocabulary()
}

function loadAsSubtitles(data, tag) {
  try {
    data.forEach((item, i) => {
      let sv = `1\n00:00:00.001 --> 00:03:00.000\n${item.text || item}`
      let en = '1\n00:00:00.001 --> 00:03:00.000\n'
      let link = `${tag}-${i}`
      window.allSubtitles[link] = {sv, en, source: tag, fileName: link}
    })
  } catch (e) {
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
  let items = []
  let currentItem = {}
  currentItem[lang] = ''
  text.split("\n").forEach(line => {
    line = line.trim()
    let matchTime = line.match(/(\d\d:\d\d:\d\d[,.]\d\d\d) --> (\d\d:\d\d:\d\d[,.]\d\d\d)/m)
    let matchId = line.match(/^\d+$/m)
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
  return items.filter(it => it.start && it.start.ordinal)
}

function getCategory(item) {
  let link = item.link;
  let category = window.categories[link];
  category = category && category.trim()
  return category || 'Okategoriserad';
}

function searchText() {
  let searchText = $("#searchInput").val().trim()

  if (searchText.length < 3) {
    populateAllLinks()
    return
  }

  function getSrtObject(it) {
    return window.srts.find(srt => srt.link === it);
  }

  let items = Object.keys(window.allSubtitles).map(it => {
    let s = window.allSubtitles[it]
    let svMatch = s.sv.toLowerCase().indexOf(searchText) >= 0
    let enMatch = s.en.toLowerCase().indexOf(searchText) >= 0
    return {link: it, svMatch, enMatch}
  })
    .map(it => {
      let srt = getSrtObject(it.link)
      return {...it, ...srt}
    }).filter(it => it.svMatch || it.enMatch)

  let $mp3Choice = $('#mp3Choice');
  $mp3Choice.html('<option>--</option>')

  let ogs = {}
  let getOptgroup = category => {
    if (!ogs[category]) {
      ogs[category] = $(`<optgroup label="${category}">`)
    }
    return ogs[category]
  }

  items.map(item => {
    let subs = window.allSubtitles[item.link]
    let text = ''
    if (item.svMatch) {
      text = subs['sv']
    } else {
      text = subs['en']
    }

    let count = (text.toLowerCase().match(new RegExp(searchText, "gi")) || []).length;
    return ({...item, matches: count})
  }).toSorted((x, y) => y.matches - x.matches)
    .forEach(item => {
      let $opt = $(`<option>(${item.matches}) ${item.name.replace(".en.srt", "").replace(".sv.srt", "")}</option>`).attr('value', item.link)
      getOptgroup(getCategory(item)).append($opt)
    })

  Object.values(ogs).forEach(it => $mp3Choice.append(it))
}

function storeSubtitles(subs) {
  let strategy = "Normal-Slow"

  let originalSubs = subs.map(it => ({...it}))


  for (let i = 0; i < originalSubs.length - 1; i++) {
    let it = originalSubs[i];
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

  console.log("set currentSub")
  return originalSubs;
}

async function getSubtitlesForLink(link, source) {
  if (window.allSubtitles[link]) {
    return window.allSubtitles[link]
  }
  let srt = window.srts.find(it => it.link === link);
  if (!srt) return

  let name = srt.name
  let svName = name + ".sv.srt"
  let enName = name + ".en.srt"
  let sv = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/" + svName)
  sv = await sv.text()
  let en = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/" + enName)
  en = await en.text()

  window.allSubtitles[link] = {sv, en, source, fileName: name}
  return window.allSubtitles[link]
}


async function loadCombinedSrts(combinedJson) {
  let json = await new Response(combinedJson).json()
  json.forEach(it => {
    let link = it.link
    let sv = it.sv
    let en = it.en
    window.allSubtitles[link] = {sv, en, fetchedFrom: 'local'}
  })
}

async function loadLocalFiles() {
  let files = Array.from(localFiles.files);
  let combinedJson = files.find(it => it.name.match(/combined.json$/))


  if (combinedJson) {
    await loadCombinedSrts(combinedJson);
    let indexJson = files.find(it => it.name.match(/index.json$/))
    if (indexJson) {
      let index = await new Response(indexJson).json()
      index.forEach(it => {
        window.allSubtitles[it.link].source = it.source
        window.allSubtitles[it.link].fileName = it.name
      })
    }
    return
  }

  let sv = null, en = null;
  let audioFile = files.find(it => it.name.match(/.mp3$/))
  let videoFile = files.find(it => it.name.match(/.mp4$/))
  let svSrtFile = files.find(it => it.name.match(/.sv.srt$/))
  let enSrtFile = files.find(it => it.name.match(/.en.srt$/))

  sv = svSrtFile && await new Response(svSrtFile).text()
  en = enSrtFile && await new Response(enSrtFile).text()

  if (videoFile) {
    videoPlayer.setSrc(URL.createObjectURL(videoFile))
  }

  let mediaNameWithoutExtension = (audioFile || videoFile).name.replace(".mp3", "").replaceAll(".mp4", "");
  let link = _.last(mediaNameWithoutExtension.split(/ [|-]{2} /)).trim()

  if (sv && en) {
    window.allSubtitles[link] = {
      sv,
      en,
      source: 'local',
      fileName: mediaNameWithoutExtension
    }
  }

  playNewMedia(link, 'local', videoFile || audioFile)
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
  let combined = sv.map(svItem => {
    let enItem = en.find(eni => eni.ts === svItem.ts)
    let combinedItem = {...svItem, ...enItem};
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
    callback: function (data, pagination) {
      let pageNum = data[0]
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
  let {ytVideoWidth, ytHeight, subWidth} = getDimensionsForPlayer();
  window.videoPlayer.setPlayerSize(ytVideoWidth, ytHeight)
  $('video').css({'width': ytVideoWidth, 'height': ytHeight})

  $('.mejs__controls').show()
  $('.mejs__overlay-button').show()
  $('#subtitle-container').css({
    left: ytVideoWidth,
    marginLeft: '1em',
    width: subWidth,
    maxHeight: '300px',
    overflow: 'scroll',
    paddingRight: '1em'
  })
}

function showOnlySubtitle() {
  stopMedia()
  $('#youtubePlayer').hide()
  $('#localVideoContainer').hide()
  $('#localMediaContainer').hide()
  window.playingYoutubeVideo = false;
  window.playingVideo = false;
  window.playingAudio = false;
  $('#playerControls').hide()
  $('#subControls').show()

  $('#mediaRelatedContainer').css({minHeight: 530})
}

async function playNewMedia(link, source, mediaFile) {
  clearSubtitles()
  stopMedia(source)

  //Load subtitle

  function _playMedia() {
    if (source === 'link') {
      $('#youtubePlayer').show()
      $('#localVideoContainer').hide()
      loadYoutubeVideo(link)
      window.playingYoutubeVideo = true;
    } else if (source === 'local') {
      $('#youtubePlayer').hide()
      $('#localVideoContainer').show()
      window.playingYoutubeVideo = false;
      if (mediaFile.name.endsWith(".mp3")) {
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
    $('#playerControls').show()
    $('#subControls').hide()
  }

  $('#result').hide()
  if (!$('#onlySubsCheckbox').is(':checked')) {
    _playMedia();
  } else {
    showOnlySubtitle();
  }

  let {sv, en} = await getSubtitlesForLink(link, source)
  loadSubtitlesForLink(sv, en);

  $('#currentMedia').html(`${link}, ${source}`)

  loadStarredLines(link, source)

  $('#toggleEnSubBtn').show()
  $('#mediaRelatedContainer').show()
  $('#toggleSearchBtn').show()
}

async function loadStarredLines(link, source) {
  let res = await fetch("https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/swedish/srts/srt_favorites.json")
  res = await res.json()

  let d = res.find(it => it.link === link)
  console.log(d)
  d.lines && d.lines.forEach(it => addStarredLine(it))
}

function waitUntil(condition) {
  return new Promise((resolve, reject) => {
    let interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval)
        resolve()
      }
    }, 100)
  })
}

window.onload = e => {
  let link = window.location.hash.replace("#", "")
  if (link.length > 2) {
    waitUntil(() => window.ytPlayerReady)
      .then(() => {
        console.log("Playing video", link)
        $('#mp3Choice').val(link).trigger('change')
      })
  }
}

function setSpeed() {
  let newRate = $('.controlgroup input:checked').data('speed');
  newRate = parseFloat(newRate);

  if (window.playingYoutubeVideo) {
    ytPlayer.setPlaybackRate(newRate)
  } else if (window.playingAudio) {
    localAudio.playbackRate = newRate
  } else if (window.playingVideo) {
    localVideo.playbackRate = newRate
  }
}

window.audioCurrentTimeMargin = -5;

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
    let s = window.youtubePlayInterval.start
    let e = window.youtubePlayInterval.end
    if (ct > e) {
      ytPlayer.pauseVideo()
      window.youtubePlayInterval = null
    }
  }
}

function updatePlayBtn() {
  let el = $('#playBtn')[0]
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

function rewind() {
  if (window.playingYoutubeVideo) {
    ytPlayer.seekTo(ytPlayer.getCurrentTime() - 3)
  } else if (window.playingAudio) {
    audioPlayer.setCurrentTime(audioPlayer.currentTime - 3)
  } else if (window.playingVideo) {
    videoPlayer.setCurrentTime(videoPlayer.currentTime - 3)
  }
  renderSubtitles()
}

window.addEventListener('keydown', e => {
  if (e.which === 32 && e.target == document.body) {
    e.preventDefault()
  }
})

function splitSentences(text) {
  const segmentor = new Intl.Segmenter([], {granularity: 'sentence'});
  const segmentedText = segmentor.segment(text);
  return Array.from(segmentedText, ({segment}) => segment).filter(it => it.trim().length > 1);
}

function chunkifySentence(text, max_chars) {
  let words = text.split(" ")
  let res = []
  let current = ""
  let sentences = splitSentences(text).filter(it => it.type === 'Sentence')
  for (let i = 0; i < sentences.length; i++) {
    let w = sentences[i].raw
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
  let lines = $(el).find(".line").map((i, e) => $(e).data()).toArray()
    .map(it => it.index).map(idx => fl.data.find(it => it.index + '' === idx + ''))

  return {
    start: lines[0].start.ordinal, end: lines[lines.length - 1].end.ordinal
  }
}

function getWikiLinks(text) {
  return text.split(/[ \n]/).flatMap(it => {
    let ws = getWords(it)
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

  let fn = getWikiLinks;

  try {
    let i;
    let match = text.match(new RegExp(window.searchText, "i"))
    let index = match.index

    let x = -1, y = -1;
    for (i = index - 1; i >= 0; i--) {
      let c = text[i]
      if (c === " " || c === "\n") {
        x = i;
        break;
      }
    }


    for (i = index + 1; i < text.length; i++) {
      let c = text[i]
      if (c === " " || c === "\n") {
        y = i;
        break;
      }
    }

    let firstPart = text.substring(0, x);
    let secondPart = text.substring(y);
    let highlightedPart = text.substring(x, y);

    hText = (fn(firstPart) + ' ') + "<span class='highlight'>" + fn(highlightedPart) + "</span>" + (' ' + fn(secondPart));
  } catch (e) {
    // console.log(e)
    hText = getWikiLinks(hText);
  }
  return hText;
}

function playSelectedText(e) {
  let selTxt = getSelectionText() || ''

  function playChunk(_txt) {
    return new Promise(function (resolve, reject) {
      let a = new Audio()
      a.src = "http://localhost:5000/tts-proxy?q=" + _txt
      a.preload = "auto";
      a.onerror = reject;                      // on error, reject
      a.onended = resolve;                     // when done, resolve
      a.playbackRate = 1.2
      a.play()
    });
  }

  let play = () => {
    let txt = selTxt.length > 1 ? selTxt : $(e.target).parent().data('text')

    let chunks = chunkifySentence(txt)

    let first = chunks.shift()
    let promise = playChunk(first)

    promise.then(x => restoreBgMusic())
  }
  // dampenBgMusic().promise.then(x => play())
  play()
}

function numberOfItemsToShow() {
  let n = parseInt(numberOfFindingsToShow.value);
  if (n === -1) {
    return 100000
  }
  return n
}

function getWords(text) {
  const segmentor = new Intl.Segmenter([], {granularity: 'word'});
  const segmentedText = segmentor.segment(text);
  return Array.from(segmentedText, ({segment}) => segment);
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
  let wordToItemsMap = {}
  let searchText = _.trim(search.toLowerCase(), '|')
    .split("|").filter(it => it.length > 0).join("|")
  let transformedSearchText = expandRegex(searchText)

  list.forEach(item => {
    let lines = item.data;
    lines.forEach(line => {
      let words = getWords(line.text, search).map(it => it.trim().toLowerCase())
      let endsWith = word => transformedSearchText.endsWith(" ") && !transformedSearchText.startsWith(" ") && word.endsWith(transformedSearchText.trim());
      let startsWith = word => transformedSearchText.startsWith(" ") && !transformedSearchText.endsWith(" ") && word.startsWith(transformedSearchText.trim());
      words.filter(word => word.match(new RegExp(transformedSearchText, "i")) || endsWith(word) || startsWith(word))
        .forEach(word => {
          wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
        })
      // Whole search text as a word
      let word = searchText.toLowerCase().trim()
      if (word.indexOf(" ") > 0 && line.text.toLowerCase().indexOf(word) >= 0) {
        wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
      }
    })
  })

  if (wordToItemsMap[searchText.trim()] === undefined) {
    wordToItemsMap[searchText] = []
  }

  let wordToItemsMap2 = {}
  searchText = expandRegex(searchText)
  list.forEach(item => {
    let lines = item.data;
    lines.forEach(line => {
      let matches = line.text.match(new RegExp(searchText, "i"))
      let alreadyIncludedInResults = it => it.toLowerCase().indexOf(searchText.toLowerCase()) >= 0
        && wordToItemsMap[it.toLowerCase()].length > 0;

      if (matches && !Object.keys(wordToItemsMap).some(alreadyIncludedInResults)) {
        let matchedPart = matches[0].toLowerCase()
        wordToItemsMap2[matchedPart] = computeIfAbsent(wordToItemsMap2, matchedPart, it => []).concat(new MatchResult(matchedPart, line, item.url, item.source))
      }
    })
  })

  if (!wordToItemsMap[searchText.trim()] || wordToItemsMap[searchText.trim()].length === 0) {
    wordToItemsMap = Object.assign(wordToItemsMap, wordToItemsMap2)
  }

  let matchingWords = Object.keys(wordToItemsMap)
  matchingWords.sort((a, b) => b.length - a.length)

  let _matchResultId = it => ` ${it.url} ${it.source} ${it.line.index}`
  for (let i = 0; i < matchingWords.length; i++) {
    let prevMatches = matchingWords.slice(0, i).map(it => wordToItemsMap[it]).flat().map(_matchResultId)
    let word = matchingWords[i]
    wordToItemsMap[word] = wordToItemsMap[word].filter(it => {
      return !prevMatches.includes(_matchResultId(it))
    })
  }

  return wordToItemsMap;
}

function populateNonSRTFindings(wordToItemsMap, $result) {
  let numberOfResults = 0
  Object.keys(wordToItemsMap).toSorted().forEach(word => {
    let items = wordToItemsMap[word]
    let wordBlock = $(`<div><h5 class="accordion">${word}</h5></div>`)

    _.take(items, numberOfItemsToShow()).forEach(item => {
      let parts = item.file.split("/")
      let fileName = parts[parts.length - 1]
      let $line = $(`<div class="normal-line" title="${fileName}"></div>`)

      chunkifySentence(item.text, 190).forEach(chunk => {
        let div = $(`
    <div class="line-part"> ${highlightedText(chunk)} <img src="/img/icons/play_icon.png"
        alt="" style="width: 20px;height: 20px;cursor: pointer;" class="play-btn">
    </div>`);
        div.data({text: chunk})
        $line.append(div)
      })

      numberOfResults += 1
      wordBlock.append($line).append('<br>')
    })
    $result.append(wordBlock)
  })

  return numberOfResults
}

function getMainSubAndSecondarySub(file, line) {
  let mainSub = {text: ""}, secondarySub = {text: ""};
  if (file.path.endsWith(".sv.srt")) {
    mainSub = {...line};
    mainSub.text = highlightedText(mainSub.text, true)
    let found = window.searchResult.find(it => it['en_subs'] && it['en_subs'].path === file.path.replaceAll(".sv.srt", ".en.srt"));
    if (found) secondarySub = found.en_subs.data.find(it => it.index === line.index)
  } else {
    mainSub = window.searchResult.find(it => it['sv_subs'] && it['sv_subs'].path === file.path.replaceAll(".en.srt", ".sv.srt"))
      .sv_subs.data.find(it => it.index === line.index)
    mainSub = {...mainSub}
    mainSub.text = getWikiLinks(mainSub.text)
    secondarySub = {...line};
    secondarySub.text = highlightedText(secondarySub.text)
  }

  return {mainSub, secondarySub};
}

let playClickedMedia = (url, times, source) => {
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

function showInfo(id, source, time_start, time_end) {
  let fileName = window.allSubtitles[id].fileName
  let url = `https://www.svtplay.se/video/${id}?position=${time_start}`
  if (source === 'YouTube') {
    url = `https://www.youtube.com/watch?v=${id}&t=${time_start}&autoplay=1`
  }

  $('#info-dialog-content').html(`
    <h3><a href="${url}" target="_blank">${fileName}</a></h3>
    <h4>${source}</h4>
    <h4>${fromSeconds(time_start)} - ${fromSeconds(time_end)}</h4>
  `).dialog()
}

let changeIndices = (id, from, to) => {
  $('#' + id).data({fromIndex: from, toIndex: to})
}

function renderLines(id, url) {
  let $container = $('#' + id);
  let fromLineIndex = parseInt($container.data('fromIndex'))
  let toLineIndex = parseInt($container.data('toIndex'))

  if (fromLineIndex < 1) {
    fromLineIndex = 1
  }

  if (toLineIndex < fromLineIndex) {
    toLineIndex = fromLineIndex;
  }

  let lang = getSelectedLang()
  let file = window.searchResult.find(it => it.url === url)[lang === 'sv' ? 'sv_subs' : 'en_subs']

  let getSub = x => file.data.find(it => it.index + '' === x + '');
  let st = getSub(fromLineIndex);
  let end = getSub(toLineIndex)
  let time_start = parseInt(Math.floor(st.start.ordinal)); //fromSeconds(line.start.ordinal);
  let time_end = parseInt(Math.ceil(end.end.ordinal)); //fromSeconds(line.end.ordinal);

  let showInfoBtn = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" onclick="showInfo('${file.url}', '${file.source}', '${time_start}', '${time_end}')" class="bi bi-info-circle media-info" viewBox="0 0 16 16" style="cursor: pointer;">
           <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
           <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
     </svg>`

  let isNotALink = url.startsWith('jokes-') || url.startsWith('sayings-') || url.startsWith('metaphors-') || url.startsWith('idioms-');
  let html = `
<hr>
<div class="buttons">
  <span class="add-prev-btn btn" onclick="changeIndices('${id}', ${fromLineIndex - 1}, ${toLineIndex}); renderLines('${id}', '${url}')"> + </span>
  <span class="remove-next-btn btn" onclick="changeIndices('${id}', ${fromLineIndex + 1}, ${toLineIndex}); renderLines('${id}', '${url}')"> - </span>

  <span class="play-btn-container" style="text-align: center; margin-left: 46%;">
     <span class="info">${file.source}</span>
     ${isNotALink ? '' : showInfoBtn}
     <span class="info" style="display: none;">
            <span class="info times"> ${time_start}-${time_end} </span>
     </span>
  </span>
  <span style="float: right;">
    <span class="remove-prev-btn btn" onclick="changeIndices('${id}', ${fromLineIndex}, ${toLineIndex - 1}); renderLines('${id}', '${url}')"> - </span>
    <span class="add-next-btn btn" onclick="changeIndices('${id}', ${fromLineIndex}, ${toLineIndex + 1}); renderLines('${id}', '${url}')"> + </span>
  </span>
</div>

`

  let mainSubText = ''
  let secondarySubText = ''
  range(fromLineIndex, toLineIndex - fromLineIndex + 1).forEach(idx => {
    let sub = getSub(idx)
    let {mainSub, secondarySub} = getMainSubAndSecondarySub(file, ({...sub}));
    mainSubText += ` ${mainSub.text}`
    if (secondarySub) {
      secondarySubText += ` ${secondarySub.text}`
    }
  })

  html += `
        <br>
        <span class="line main-line" > ${mainSubText} </span> <br>
        <span class="line secondary-line" > ${secondarySubText} </span>
        `

  html += `
           <br>
  `

  $container.html(html)

  if (!isDesktop()) {
    $('.play-btn-container').css({marginLeft: '22%'})
  }
}

function getSearchedWords() {
  return window.searchText.toLowerCase().split("|").filter(it => it.trim().length);
}

function populateSRTFindings(wordToItemsMap, $result) {
  let similarity = (x) => {
    if (!x) return 0
    return getSearchedWords().map(word => stringSimilarity.compareTwoStrings(x, word)).reduce((a, b) => Math.max(a, b), 0)
  }
  let words = _(Object.keys(wordToItemsMap)).chain()
    .sortBy(function (word) {
      return word;
    }).sortBy((x, y) => {
      return similarity(y) - similarity(x)
    }).sortBy((x, y) => {
      let idxX = getSearchedWords().indexOf(x);
      let idxY = getSearchedWords().indexOf(y);
      if(idxX >= 0) return idxX - idxY
    }).sortBy(w => {
      if (w === window.searchText) return -1
    }).value();

  words.forEach(word => {
    let items = wordToItemsMap[word]
    let wordBlock = $(`<div ><h5 class="accordion">${word}</h5></div>`)
    items = items.toSorted((x, y) => x.path === window.preferredFile ? -1 : 1)

    wordBlock.append(`<div style=""> Wiki: ${getWikiLinks(word)} 丨
        <a href="https://www.google.com/search?q=${word}&udm=2" target="_blank">Images</a> </div> <br>`)

    $result.append(wordBlock)
    _.take(items, numberOfItemsToShow())
      .forEach(item => {
        let file = item
        let $fileBlock = $(`<div class="srt-file" title="${item['name']}">
                            <h4 data-file="${item.url}" style="display: none;"> ${word} </h4>
                        </div>`)

        wordBlock.append($fileBlock)

        let id = uuid()
        let $lines = $(`<div id="${id}" style="padding-top: 4px; padding-bottom: 8px;"></div>`)
        $lines.data({fromIndex: item.line.index, toIndex: item.line.index})
        $fileBlock.append($lines)

        renderLines(id, file.url)
      })
  })
}

function resultNotFound(search) {
  return `
<h3>No results found for ${search}</h3>
Try Wiki ${getWikiLinks(search)}
`;
}

function getSelectedLang() {
  return $('#toggleLangCb').prop('checked') ? 'sv' : 'en';
}

function render(searchResults, search) {
  if (!searchResults) return

  let $result = $('#result');
  $result.html('').show()

  let selectedLang = getSelectedLang()

  let searchResultsFiltered = searchResults.map(it => {
    if (selectedLang === 'sv' && it.sv_match) return it.sv_subs
    if (selectedLang === 'en' && it.en_match) return it.en_subs
    return null
  }).filter(it => it);

  let wordToItemsMap = getMatchingWords(searchResultsFiltered, search);
  populateSRTFindings(wordToItemsMap, $result);

  if (Object.keys(wordToItemsMap).length === 0) {
    $result.html(resultNotFound(window.searchText))
  }

  $result.append("<hr>")

  // wordToItemsMap = getMatchingWords(searchResults.filter(it => it.text), search, item => [item]);
  // resultSize += populateNonSRTFindings(wordToItemsMap, $result);

  renderAccordions()

  $(".srt-file h4").dblclick(e => {
    window.preferredFile = $(e.target).data().file
  })


  $(".srt-line .play-btn").click(e => {
    if ($(e.target).hasClass('disabled')) return

    $('.srt-line').removeClass('selected')
    $(e.target).parents('.srt-line').addClass('selected')

    let url = $(e.target).data("url")
    let dt = $(e.target).parents('.srt-line').data()

    let times = getTimesForSubtitleChunk($(e.target).parents('.srt-line'), dt.file)

    // dampenBgMusic().promise.then(x => play())
    playClickedMedia(url, times, dt.file.source)
    // $( "#audioPlayerPopup" ).dialog('open')
    // $('#audioPlayerPopup').css({width: '100%'})
  })

  $(".normal-line .play-btn").click(e => {
    playSelectedText(e);
  })

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

function fetchFromLocal() {
  return Object.keys(window.allSubtitles)
    .filter(it => window.allSubtitles[it].sv && window.allSubtitles[it].en)
    .map(it => {
      let svText = window.allSubtitles[it].sv;
      let enText = window.allSubtitles[it].en;

      let svMatch = svText && svText.match(new RegExp(expandRegex(window.searchText), "i"));
      let enMatch = enText && enText.match(new RegExp(expandRegex(window.searchText), "i"));
      if (svMatch || enMatch) {
        return new SearchResult(
          window.allSubtitles[it].source,
          it,
          getSubs(enText, it + ".en.srt", it, window.allSubtitles[it].source, window.allSubtitles[it].fetchedFrom),
          getSubs(svText, it + ".sv.srt", it, window.allSubtitles[it].source, window.allSubtitles[it].fetchedFrom),
          !!enMatch,
          !!svMatch,
        )
      }
    }).filter(it => it);
}

async function fetchSRTs(searchText) {
  if ((typeof searchText) !== 'string') {
    searchText = null
  }
  let $searchText = $("#searchText");
  let txt = searchText || $searchText.val().toLowerCase()
  // $searchText.val(txt)

  if (txt.length < 3) return

  window.searchText = txt;

  window.allSubtitles = window.allSubtitles || {}

  if (Object.keys(window.allSubtitles).length) {
    console.log("Loading from local")
    window.searchResult = fetchFromLocal()
  } else {
    let res = await fetch("http://localhost:5000/find?text=" + txt)
    window.searchResult = await res.json();
  }
  return render(window.searchResult, window.searchText)
}

function renderAccordions() {
  console.log('Rendering accordions')

  let isAccordion = it => Array.from(it.classList.values()).indexOf('accordion') >= 0

  function fixAccordionPanel(accordionEl) {
    let el = accordionEl.nextElementSibling
    let siblings = []
    while (el) {
      if (isAccordion(el)) break

      siblings.push(el)
      el = el.nextElementSibling
    }

    if (siblings.length > 1) {
      let newEl = document.createElement('div')
      newEl.classList.add('autocreated-panel')
      siblings.forEach(it => newEl.appendChild(it))

      accordionEl.insertAdjacentElement('afterend', newEl)
    }
  }

  let acc = document.getElementsByClassName("accordion");
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
      let panel = this.nextElementSibling;
      if (panel.style.display === "block") {
        panel.style.display = "none";
      } else {
        panel.style.display = "block";
      }
    });
  }

  let isRegex = false;
  if([".", "*", "|", "?"].some(it => _.includes(window.searchText, it))) {
    isRegex = true;
  }
  if(isRegex) {
    $('.accordion:nth(1)').click()
  } else {
    $('.accordion').first().click()
  }
}

// 2. This code loads the IFrame Player API code asynchronously.
var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.

function loadYoutubeVideo(videoId) {
  let iframe = ytPlayer.getIframe()
  $('#youtubePlayer').show()
  return new Promise((resolve, reject) => {
    try {
      let currentVideoId = iframe.src.split("embed/")[1].split("?")[0]
      iframe.src = `${iframe.src}`.replaceAll(currentVideoId, videoId)
    } catch (e) {
      console.log(e)
    }
  })
}

function isDesktop() {
  let ww = $(window).width()
  return ww >= 1000
}

function getDimensionsForPlayer() {
  let wh = window.innerHeight, ww = window.innerWidth;

  let ytVideoWidth = 940, ytHeight = 590;
  let subWidth = 0;

  if (isDesktop()) {
    ytVideoWidth = ww * 0.6;
    subWidth = $(window).width() - (ytVideoWidth + 40)
  } else {
    ytVideoWidth = ww - 15;
    subWidth = ww - 10;
    ytHeight = wh / 2 - 150;
    $('#mediaControls').css({width: '100%', bottom: '-15em', right: 0})
    $('#youtubePlayer-info').hide()
    $('#speed-control').parent().hide()

    $('#mp3Choice').parent().css({width: ww - 20})
  }
  return {ytVideoWidth, ytHeight, subWidth};
}

let {ytVideoWidth, ytHeight, subWidth} = getDimensionsForPlayer();

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
    maxHeight: '300px',
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
  let lines = $('.starred-sub').map((i, e) => $(e).text()).toArray()

  let _ms = window.mediaBeingPlayed.source

  if (_ms === 'local') {
    let s = prompt('Source of media:')
    if (!s || !s.trim()) return
    window.mediaBeingPlayed['source'] = s.trim()
  }

  let data = JSON.stringify({...window.mediaBeingPlayed, lines})

  try {
    let r = await fetch('http://localhost:5000/srt-favorites', {
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
  let dates = []

  let _ms = window.mediaBeingPlayed.source

  if (_ms === 'local') {
    let s = prompt('Source of media:')
    if (!s || !s.trim()) return
    window.mediaBeingPlayed['source'] = s.trim()
  }

  let data = JSON.stringify({...window.mediaBeingPlayed, dates})

  try {
    let r = await fetch('http://localhost:5000/srt-revision', {
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

if (window.location.hostname === 'localhost') {
  $('#saveRevisionBtn').show()
  $('#saveStarredLinesBtn').show()
}


function test_data() {
  let idx = 0

  function data(txt) {
    let i = idx++
    return {
      index: i,
      id: i,
      start: {ordinal: 0},
      end: {ordinal: 1},
      text: txt
    }
  }

  let enSubs = {
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

  let svSubs1 = {
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

  let svSubs2 = {
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

function tests() {
  let testData = test_data();

  let wordToItemsMap = getMatchingWords(testData, "grund och botten")
  log(wordToItemsMap["grund och botten"])
  assert(wordToItemsMap["grund och botten"].length === 3, "Words with spaces should be matched")

  wordToItemsMap = getMatchingWords(testData, "grund ")
  log(wordToItemsMap["grund"], wordToItemsMap["grund "])
  assert(wordToItemsMap["grund"].length === 3, "Words ending with spaces should be matched")

  wordToItemsMap = getMatchingWords(testData, "*ngn var inne på")
  log(wordToItemsMap)
  // assert(wordToItemsMap["*ngn var inne på"].length === 2, "Words with special regex should be matched")

  wordToItemsMap = getMatchingWords(testData, "grund .* botten")
  assert(wordToItemsMap["grund och botten"].length === 3, "Search by regex should be matched")

  wordToItemsMap = getMatchingWords(testData, "bott")
  assert(wordToItemsMap["bott"].length === 2
    && !wordToItemsMap["bott"].some(it => it.line.text.indexOf("botten") >= 0)
    && !wordToItemsMap["bott"].some(it => it.line.text.indexOf("prefixedbott") >= 0), "There should be no duplicates")
}


try {
  tests()
} catch (e) {
  alert("Error in tests: " + e)
}
