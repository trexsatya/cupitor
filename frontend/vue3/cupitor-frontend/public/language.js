import {computeIfAbsent, randomFromArray, range, schedule, uuid} from './data-structures.js';
import {conjugateTableSpanish} from './spanish.js';

function debugLog(x) {
  if (window.DEBUG) {
    console.log(x)
  }
}

/* eslint-disable @typescript-eslint/no-use-before-define */

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

const SEPARATOR_PIPE = '|'
window.onbeforeunload = function (event) {
  if (window.dontConfirmOnRefresh) {
    return null
  }
  return confirm("Confirm refresh");
};

window.addEventListener('filterData', (e) => {
  $('#saveRevisionBtn').show();
  $('#saveStarredLinesBtn').show();
  const text = e.detail?.text;
  // The native app can pass a GitHub token alongside the search text.
  // It is stored in memory only (never persisted) and used for vocab commits.
  if (e.detail?.token) {
    //window.GitHubUtils?.setGHToken(e.detail.token)
  }
  if (text) {
    // Trigger 'change' so we go through searchTextChanged → doSearch →
    // fetchSRTs, which clears window.unprocessedSearchText first. Calling
    // fetchSRTs directly would leak any stale unprocessedSearchText from a
    // previous dropdown click and route vocab rendering through
    // renderVocabularyLineByText with the wrong line, leaving the panel
    // empty (or showing the old line) for the new search term.
    $("#searchText").val(text).trigger('change');
  }
});

window.addEventListener('capturedSubtitle', (e) => {
  if (!e.detail) return
  console.log('capturedSubtitle event buffered', e.detail);
  try {
    bufferCapturedSubtitle(e.detail)
  } catch (err) {
    console.error('Failed to buffer capturedSubtitle', err)
  }
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
passa=passa,passar,passade,passat
äga=äga,äger,ägde,ägt
bära=bära,bär,bar,burit
be=be,ber,bad,bett
bita=bita,biter,bet,bitit
bjuda=bjuda,bjuder,bjöd,bjudit
blomma=blomma,blommar,blommade,blommat
bry=bry,bryr,brydde,brytt
bryta=bryta,bryter,bröt,brutit
delta=delta,deltar,deltog,deltagit
driva=driva,driver,drev,drivit
falla=falla,faller,föll,fallit
finna=finna,finner,fann,funnit
föra=föra,för,förde,fört
förklä=förklä,förkläder,förklädde,förklätt
fylla=fylla,fyller,fyllde,fyllt
ga=ga,gar,gade,gat
gifta=gifta,gifter,gifte,gift
glida=glida,glider,gled,glidit
gnugga=gnugga,gnuggar,gnuggade,gnuggat
grippa=gripa,griper,grep,gripit
handla=handla,handlar,handlade,handlat
känna=känna,känner,kände,känt
kasta=kasta,kastar,kastade,kastat
kikna=kikna,kiknar,kiknade,kiknat
klämma=klämma,klämmer,klämde,klämt
knyta=knyta,knyter,knöt,knutit
köra=köra,kör,körde,kört
läsa=läsa,läser,läste,läst
leva=leva,lever,levde,levt
ligga=ligga,ligger,låg,legat
lista=lista,listar,listade,listat
lösa=lösa,löser,löste,löst
lysa=lysa,lyser,lyste,lyst
mala=mala,mal,malde,malt
öka=öka,ökar,ökade,ökat
prata=prata,pratar,pratade,pratat
rå=rå,rår,rådde,rått
såga=såga,sågar,sågade,sågat
säga=säga,säger,sade,sa,sagt
sitta=sitta,sitter,satt,suttit
skriva=skriva,skriver,skrev,skrivit
släppa=släppa,släpper,släppte,släppt
släta=släta,slätar,slätade,slätat
sluta=sluta,slutar,slutade,slutat
söka=söka,söker,sökte,sökt
sopa=sopa,sopar,sopade,sopat
sova=sova,sover,sov,sovit
spilla=spilla,spiller,spillde,spillt
springa=springa,springer,sprang,sprungit
stå=stå,står,stod,stått
stämma=stämma,stämmer,stämde,stämt
sticka=sticka,sticker,stack,stuckit
stödja=stödja,stödjer,stödde,stött
stöta=stöta,stöter,stötte,stött
stryka=stryka,stryker,strök,strukit
tala=tala,talar,talade,talat
tränga=tränga,tränger,trängde,trängt
trycka=trycka,trycker,tryckte,tryckt
tycka=tycka,tycker,tyckte,tyckt
utbilda=utbilda,utbildar,utbildade,utbildat
vända=vända,vänder,vände,vänt
vara=vara,är,var,varit
växa=växa,växer,växte,vuxit
vetta=vetta,vetter,vette,vettat
visa=visa,visar,visade,visat`

  const wordsMap = {}
  list.split("\n").filter(it => it.trim().length > 2).forEach(it => {
    const splits = it.split("=")
    wordsMap[splits[0]] = splits[1].split(",")
  })

  // Merge user-defined expansions from the vocabulary file. Any line in a
  // category named "expansions" / "Expansions" / "_expansions" that follows
  // the `key=val1,val2,...` shape contributes to (or overrides) the
  // hardcoded map above. Other lines in that category (including comments
  // or stray content) are ignored.
  try {
    const userLines = (window.vocabulary && (
      window.vocabulary['expansions']
      || window.vocabulary['Expansions']
      || window.vocabulary['_expansions']
    )) || []
    userLines.forEach(line => {
      if (typeof line !== 'string') return
      const t = line.trim()
      if (!t || t.indexOf('=') < 1) return
      const eq = t.indexOf('=')
      const key = t.substring(0, eq).trim()
      const valStr = t.substring(eq + 1).trim()
      if (!key || !valStr) return
      const vals = valStr.split(',').map(v => v.trim()).filter(Boolean)
      if (vals.length) wordsMap[key] = vals
    })
  } catch (e) { console.warn('[expansions] failed to merge user-defined expansions', e) }

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
  const ytPlayer = window.ytPlayer
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
    window.ytPlayer.playVideo()
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
  const optValue = JSON.stringify({o: searchTerms, e: expandWords(searchTerms, getLangFromUrl().code) })
  const op = new Option(`${displayText}`, optValue, false, selected)
  if (isSeparator) {
    op.disabled = true
  }
  op.title = searchTerms
  return op
}

function loadSearches() {
  const searches = getSearchesFromStorage()
  $('#searchedWords').html('')
  $('addToVocabularyDialogSelect').html('')

  schedule(searches, .0001, searchTerms => {
    $('#searchedWords').append(createOptionElement(searchTerms));
    $('#addToVocabularyDialogSelect').append(createOptionElement(searchTerms));
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
  $('#addToVocabularyDialogSelect').html('')
  // Empty leading option so select2's allowClear (X) has something to reset
  // the selection to. The placeholder text on each select2 fills the visual.
  $('#searchedWords').append(new Option('', '', false, false))
  $('#addToVocabularyDialogSelect').append(new Option('', '', false, false))
  $('#addToVocabBtn').prop('disabled', true)

  const vocabCategoriesToPopulate = new Set()

  Object.entries(vocabulary).forEach(it => {
    vocabCategoriesToPopulate.add(it[0])
  })

  const categories = Array.from(vocabCategoriesToPopulate)
  const total = categories.length
  let done = 0
  $('#vocabLoadingBarFill').css('width', '0%')
  $('#vocabLoadingBar').show()

  const populateLines = category => {
    const vocabLines = window.vocabulary[category]
    // searchedWords: category is selectable (value prefixed with __cat__:) and
    // styled via the .vocab-category-option class so select2 can render it
    // grey + italic.
    const searchHeading = new Option(`${category}`, '__cat__:' + category, false, false)
    searchHeading.className = 'vocab-category-option'
    $('#searchedWords').append(searchHeading)
    // addToVocabularyDialogSelect: keep the heading as a non-selectable label.
    const dialogHeading = new Option(`${category}`, category, false, false)
    dialogHeading.disabled = true
    $('#addToVocabularyDialogSelect').append(dialogHeading)
    vocabLines.forEach(line => {
      $('#searchedWords').append(createOptionElement(line, window.preSelectedSearchedWord && window.preSelectedSearchedWord === line))
      $('#addToVocabularyDialogSelect').append(createOptionElement(line, window.preSelectedSearchedWord && window.preSelectedSearchedWord === line))
    })
    done += 1
    $('#vocabLoadingBarFill').css('width', `${(done / total) * 100}%`)
  };
  schedule(categories, .4, it => {
    populateLines(it)
  }, () => {
    $('#addToVocabBtn').prop('disabled', false)
    $('#vocabLoadingBar').hide()
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


function openAddToVocabDialog() {
  const w = window.innerWidth * 0.9
  const h = window.innerHeight * 0.8

  // Discard any in-progress text so the new dialog starts blank — saves only
  // happen on the Save button via addToVocab(); closing the dialog (via the
  // X, Escape, or click-outside) must NOT carry over typed words.
  const discardSegment = () => {
    $('#vocabularySegmentTextarea').val('')
    $('#vocabNewCategory').val('')
  };
  discardSegment();
  $('#vocabPendingHint').hide();

  // Mirror the main select's current line into the dialog's reference select
  // so the user starts on the line they were already inspecting. Skip
  // category headings (`__cat__:foo`) — those aren't valid reference words.
  try {
    const mainVal = $('#searchedWords').val()
    let dialogVal = null
    if (typeof mainVal === 'string' && mainVal && !mainVal.startsWith('__cat__:')) {
      dialogVal = mainVal
    } else if (window.preSelectedSearchedWord) {
      // Fallback: scan the dialog select for a matching {o:line} value.
      $('#addToVocabularyDialogSelect option').each(function () {
        if (dialogVal) return
        try {
          const parsed = JSON.parse(this.value)
          if (parsed && parsed.o === window.preSelectedSearchedWord) dialogVal = this.value
        } catch (_) { /* heading or unparseable — skip */ }
      })
    }
    if (dialogVal) {
      $('#addToVocabularyDialogSelect').val(dialogVal).trigger('change.select2')
    }
  } catch (_) { /* leave dialog selection as-is */ }

  // If the user closes the dialog while there are staged-but-uncommitted
  // changes, commit them before tearing the dialog down so multi-add
  // sessions never silently lose work.
  const onDialogClose = () => {
    discardSegment()
    if (window._vocabHasPendingChanges) {
      commitVocabularyToGithub()
      window._vocabHasPendingChanges = false
    }
    $('#vocabPendingHint').hide()
  }

  // Defer opening until after the current click event has finished bubbling.
  // Without this, the document-level "close on outside click" handler fires
  // on the same click and immediately closes the dialog.
  setTimeout(() => {
    const $dialog = $("#addToVocabularyDialog")
    if ($dialog.hasClass('ui-dialog-content')) {
      $dialog.dialog('option', { width: w, height: h, close: onDialogClose }).dialog('open')
    } else {
      $dialog.dialog({
        width: w,
        height: h,
        modal: false,
        close: onDialogClose
      })
    }
  }, 0)
}

// Insert `before` (optionally wrapping the selection with `after`) at the
// caret of the vocab-segment input. Lets the dialog buttons drop |, (), []
// without forcing the user to hunt for those keys on a virtual keyboard.
function insertIntoVocabSegment(before, after) {
  after = after || '';
  const el = document.getElementById('vocabularySegmentTextarea');
  if (!el) return;
  const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
  const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
  const value = el.value;
  const selected = value.slice(start, end);
  el.value = value.slice(0, start) + before + selected + after + value.slice(end);
  el.focus();
  // Place the caret right after the inserted opener (and inside the pair when
  // there's a closer) so the next keystroke continues naturally.
  const caret = after ? start + before.length + selected.length : start + before.length;
  el.selectionStart = el.selectionEnd = caret;
}
window.insertIntoVocabSegment = insertIntoVocabSegment;

// Validate that each pipe-separated part of a vocab line has balanced
// brackets. Reject e.g. "(x|y)" because splitting on `|` produces "(x" and
// "y)" — unbalanced parts, which break downstream pipe-separated processing.
// Nested parens within a single segment, like "(x(a))", are fine.
function isProperlyBracketed(line) {
  const parts = line.split('|');
  const closeToOpen = { ')': '(', ']': '[', '}': '{' };
  return parts.every(part => {
    const stack = [];
    for (const ch of part) {
      if ('([{'.includes(ch)) stack.push(ch);
      else if (')]}'.includes(ch)) {
        if (stack.pop() !== closeToOpen[ch]) return false;
      }
    }
    return stack.length === 0;
  });
}
window.isProperlyBracketed = isProperlyBracketed;

function addToVocab(commitAndClose) {
  // Backwards-compat: legacy onclick="addToVocab()" calls land with no arg —
  // treat that as the old single-shot Save behaviour.
  if (commitAndClose === undefined) commitAndClose = true

  const newText = $("#vocabularySegmentTextarea").val().trim()
  if (!newText) {
    // "Save & Close" pressed with an empty textarea: if there are already
    // staged additions from earlier rounds, commit them and close.
    if (commitAndClose && window._vocabHasPendingChanges) {
      commitVocabularyToGithub()
      window._vocabHasPendingChanges = false
      $('#vocabPendingHint').hide()
      $("#addToVocabularyDialog").dialog("close")
    }
    return
  }

  // If the user filled the "new/existing category" input, append to that
  // category — creating it if missing — and skip the reference-word/Insert
  // path entirely. This is the way to add a brand-new entry (e.g. seed
  // the `expansions` category for the first time).
  const newCategoryInput = ($("#vocabNewCategory").val() || '').trim()
  let category, refWord
  if (newCategoryInput) {
    category = newCategoryInput
    refWord = null
  } else {
    const selectedVal = $("#addToVocabularyDialogSelect").val()
    if (!selectedVal) return
    try {
      const parsed = JSON.parse(selectedVal)
      // createOptionElement stores {o, e}; openAddToVocabDialog stored {category, word}
      refWord = parsed.o || parsed.word
      category = parsed.category
      // If no category in the value, find it by scanning vocabulary
      if (!category && refWord) {
        for (const [cat, words] of Object.entries(window.vocabulary || {})) {
          if (words.includes(refWord)) { category = cat; break }
        }
      }
    } catch (_) {
      return
    }
  }

  const position = $("#vocabInsertPosition").val() // 'above', 'below', or 'inline'
  const newWords = newText.split("\n").map(w => w.trim()).filter(w => w.length > 0)

  const invalidLine = newWords.find(w => !isProperlyBracketed(w));
  if (invalidLine) {
    alert(
      'Invalid line — brackets must be balanced within each pipe-separated word.\n\n' +
      'Offending line:\n' + invalidLine + '\n\n' +
      'Note: a pipe `|` cannot appear inside parentheses/brackets/braces, since that ' +
      'splits the bracket pair across two separate words.'
    );
    return;
  }

  const categoryWords = window.vocabulary[category] || []
  if (!refWord) {
    // No reference word — just append to the (possibly new) category.
    categoryWords.push(...newWords)
  } else {
    const idx = categoryWords.indexOf(refWord)
    if (position === 'inline') {
      if (idx >= 0) categoryWords.splice(idx, 1, ...newWords)
      else categoryWords.push(...newWords)
    } else {
      const insertAt = position === 'above'
        ? (idx >= 0 ? idx : 0)
        : (idx >= 0 ? idx + 1 : categoryWords.length)
      categoryWords.splice(insertAt, 0, ...newWords)
    }
  }
  window.vocabulary[category] = categoryWords

  // Preserve the currently-selected line across the rebuild. Both selects
  // honour window.preSelectedSearchedWord in createOptionElement.
  try {
    const rawVal = $('#searchedWords').val()
    if (typeof rawVal === 'string' && rawVal && !rawVal.startsWith('__cat__:')) {
      const parsed = JSON.parse(rawVal)
      if (parsed && typeof parsed.o === 'string') {
        window.preSelectedSearchedWord = parsed.o
      }
    }
  } catch (_) { /* leave preSelectedSearchedWord untouched */ }

  // Refresh both select boxes with updated vocabulary so the just-added
  // line is reachable as a reference word for the next round.
  loadWholeVocabulary()

  window._vocabHasPendingChanges = true

  if (commitAndClose) {
    commitVocabularyToGithub()
    window._vocabHasPendingChanges = false
    $('#vocabPendingHint').hide()
    $("#addToVocabularyDialog").dialog("close")
  } else {
    // Stage-only: clear textarea, surface the pending-changes hint, and
    // leave the dialog open so the user can add more entries.
    $("#vocabularySegmentTextarea").val('')
    $('#vocabPendingHint').show()
  }
}

function onVocabInsertPositionChange(select) {
  const $textarea = $('#vocabularySegmentTextarea')
  if (select.value === 'inline') {
    // Pre-populate with the reference word so the user can edit it in place
    try {
      const parsed = JSON.parse($('#addToVocabularyDialogSelect').val())
      $textarea.val(parsed.o || parsed.word)
    } catch (_) {}
  } else {
    // Clear only if the textarea still contains the auto-filled reference word
    try {
      const parsed = JSON.parse($('#addToVocabularyDialogSelect').val())
      const refWord = parsed.o || parsed.word
      if ($textarea.val().trim() === (refWord || '').trim()) {
        $textarea.val('')
      }
    } catch (_) {}
  }
}

async function commitVocabularyToGithub() {
  const vocabText = Object.keys(window.vocabulary)
    .map(k => `#${k}\n${window.vocabulary[k].join("\n")}`).join("\n")

  const lang = getLangFromUrl()
  const filePath = `db/language/${lang.fullName}/vocabulary.txt`

  try {
    await window.GitHubUtils.putFileWithContent({
      owner: 'trexsatya',
      repo: 'trexsatya.github.io',
      filePath,
      content: vocabText,
      commitMessage: 'vocab: update vocabulary via language tool',
      branch: 'gh-pages'
    })
    console.log('Vocabulary committed to GitHub')
  } catch (e) {
    console.error('Failed to commit vocabulary to GitHub:', e)
    alert('Saved in memory but GitHub commit failed: ' + e.message)
  }
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
  if (!window.vocabulary || !window._subtitlesLoaded) {
    console.log('[search] data not loaded yet, deferring until vocabulary + subtitles ready…');
    await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]);
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

const SEARCH_NAV_HISTORY_KEY = 'searchNavHistory'
const SEARCH_NAV_HISTORY_MAX = 200

function loadNavHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(SEARCH_NAV_HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(it => typeof it === 'string') : []
  } catch (e) { return [] }
}

function saveNavHistoryToStorage(list) {
  try { localStorage.setItem(SEARCH_NAV_HISTORY_KEY, JSON.stringify(list)) } catch (e) {}
}

window.sessionSearchHistory = window.sessionSearchHistory || loadNavHistoryFromStorage()
// Always start at -1 on a fresh page load: the user isn't "on" any past
// entry, so the first Prev should go to the most recent entry.
if (typeof window.sessionHistoryIndex !== 'number') window.sessionHistoryIndex = -1

function recordSessionSearch(term) {
  if (window._navigatingHistory) return
  if (typeof term !== 'string') return
  term = term.trim()
  if (!term) return
  const list = window.sessionSearchHistory
  if (list[list.length - 1] === term) return
  list.push(term)
  if (list.length > SEARCH_NAV_HISTORY_MAX) {
    list.splice(0, list.length - SEARCH_NAV_HISTORY_MAX)
  }
  window.sessionHistoryIndex = list.length - 1
  saveNavHistoryToStorage(list)
}

function navigateSearchHistory(direction) {
  const list = window.sessionSearchHistory
  if (!list || list.length === 0) return
  const cur = (typeof window.sessionHistoryIndex === 'number') ? window.sessionHistoryIndex : -1
  let newIdx
  if (cur === -1) {
    // Fresh load / not on any entry. Prev jumps to the most recent; Next is a no-op.
    if (direction < 0) newIdx = list.length - 1
    else return
  } else {
    newIdx = cur + direction
  }
  if (newIdx < 0 || newIdx > list.length - 1) return
  if (newIdx === cur) return
  window.sessionHistoryIndex = newIdx
  const term = list[newIdx]
  if (typeof term !== 'string' || !term) return
  window._navigatingHistory = true
  // Trigger 'input' (not 'change') so the X-clear button visibility updates
  // without re-firing the typed-search flow on top of our explicit doSearch
  // call below.
  $('#searchText').val(term).trigger('input')
  // Set unprocessedSearchText to the term itself so render() can anchor on
  // the original line via renderVocabularyLineByText for history items
  // that were originally vocab-line clicks. Typed-term history items just
  // fall through (renderVocabularyLineByText returns false → the regular
  // renderVocabularyFindings path runs).
  window.unprocessedSearchText = term
  Promise.resolve(doSearch(term, $('#searchedWords')))
      .finally(() => { window._navigatingHistory = false })
}

const $searchText1 = $('#searchText');

export async function searchTextChanged() {
  const el = $('#searchedWords')
  const w = $searchText1.val()
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

// Promise that resolves once window.vocabulary is set (or the fetch fails and
// we fall back to an empty vocabulary). Searches that fire before this
// resolves get awaited in doSearch so they run as soon as the vocabulary is
// available, rather than crashing renderVocabularyFindings on an undefined
// window.vocabulary.
window._vocabularyReadyPromise = new Promise(resolve => {
  window._vocabularyReadyResolve = resolve;
});

// Resolves once loadAllSubtitles has finished — both the parallel SRT fetches
// and the sequential (jokes/sayings/idioms/etc.) loads. Hard-capped with a
// timeout so a hung network never freezes searches indefinitely.
window._subtitlesReadyPromise = Promise.race([
  new Promise(resolve => { window._subtitlesReadyResolve = resolve; }),
  new Promise(resolve => setTimeout(() => {
    if (!window._subtitlesLoaded) {
      console.warn('[search] subtitles ready promise timed out after 60s — proceeding with whatever loaded');
    }
    resolve();
  }, 60000))
]);

// Wraps a promise in a per-call timeout so one hung fetch doesn't stall the
// entire Promise.allSettled batch.
function _withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: ' + label)), ms))
  ]);
}

async function fetchVocabulary() {
  try {
    let res;
    if (isLocalhost()) {
      res = await fetch("http://localhost:5000/vocabulary?lang=" + getLangFromUrl().fullName)
      res = await res.json()
      if (res) res = res.text
    } else {
      res = await fetch(`${getResourceUrl()}/vocabulary.txt`)
      res = await res.text()
    }
    if (res)
      window.vocabulary = parseVocabularyFile(res)
  } catch (e) {
    console.warn('Vocabulary fetch failed', e);
  } finally {
    if (!window.vocabulary) window.vocabulary = {};
    loadWholeVocabulary()
    window._vocabularyReadyResolve();
  }
}

async function vocabularyLineSelected() {
  if (window.searchedWordsSelectedProgrammatically) {
    window.searchedWordsSelectedProgrammatically = false;
    return
  }
  const rawVal = $('#searchedWords').val();
  if (!rawVal) {
    // Cleared via select2's X — drop tracking state and stop here.
    window.preSelectedSearchedWord = null
    return
  }
  if (typeof rawVal === 'string' && rawVal.startsWith('__cat__:')) {
    renderVocabularyCategory(rawVal.substring('__cat__:'.length));
    return;
  }
  // $('#searchText').val($('#searchedWords').val()).trigger('change')
  const vocabOptionVal = JSON.parse(rawVal);
  window.unprocessedSearchText = vocabOptionVal.o
  window.searchText = vocabOptionVal.e //expandWords(window.unprocessedSearchText, getLangFromUrl().code)
  // render() now branches on window.unprocessedSearchText — when set, it
  // anchors the vocab list on the original line instead of the expanded
  // pipe form. So no need to render anything here ourselves.
  await doSearch(window.searchText, null)
}

// Render the vocabulary list anchored on a specific line (the user's exact
// click). Avoids `renderVocabularyFindings`' word-equality matcher, which
// misses for expanded pipe-separated forms like "ge|gav|ger|...".
export function renderVocabularyLineByText(lineText) {
  if (!window.vocabulary || !lineText) return false;
  // Walk vocabulary preserving category info so we can show which category
  // the matched line came from in the collapsible header.
  const allLines = [];
  const lineCategory = [];
  Object.entries(window.vocabulary).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return;
    lines.forEach(line => { allLines.push(line); lineCategory.push(cat); });
  });
  const idx = allLines.findIndex(l => l === lineText);
  if (idx < 0) return false;
  const category = lineCategory[idx] || '?';

  const vocab = $('#vocabularyResult');
  vocab.html('');
  const vocabItem = $('<div class="vocabulary-segment"></div>');
  const vocabItemContent = $('<div class="vocabulary-segment-content"></div>');
  const surroundings = getSurrounding(idx, allLines);
  const matchEntry = surroundings.find(it => it.index === idx) || { item: allLines[idx], index: idx };
  const $header = _buildVocabLine(matchEntry);
  $header.addClass('highlighted similar-segment-header');
  $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>');
  $header.append(`<span style="font-size:0.75em;color:#666;margin-left:6px;">[${_.escape(category)}]</span>`);
  vocabItemContent.append($header);
  const $body = $('<div class="similar-segment-body" hidden></div>');
  // Keep the matched line at its original position inside the body so the
  // surrounding-context ordering is preserved when expanded.
  surroundings.forEach(it => {
    const $line = _buildVocabLine(it);
    if (it.index === idx) $line.addClass('highlighted');
    $body.append($line);
  });
  vocabItemContent.append($body);
  vocabItem.append(vocabItemContent);
  vocab.append(vocabItem);

  _attachAccordionDelegate(vocab);

  const $rc = $('#resultContainer');
  if ($rc.is(':hidden')) {
    $rc.show();
    if (typeof updateToggleButtonView === 'function') updateToggleButtonView('resultContainer');
  }
  return true;
}

export function renderVocabularyCategory(category) {
  const lines = window.vocabulary && window.vocabulary[category];
  if (!lines) return;
  const vocab = $('#vocabularyResult');
  vocab.html('');

  vocab.append(
    `<div class="vocabulary-category-header" style="color:grey;font-style:italic;font-weight:bold;padding:6px 0;">${category}</div>`
  );

  const vocabItem = $('<div class="vocabulary-segment"></div>');
  const vocabItemContent = $('<div class="vocabulary-segment-content"></div>');
  lines.forEach(line => {
    let txt = line;
    const $line = $(`<div class="vocabulary-line"></div>`);
    if (txt.trim().length) {
      $line.append(`<i class="fa fa-mouse-pointer" style="color: red; cursor: pointer;margin-right: 3px;"></i>`);
      $line.find("i.fa").click(selectSearchedWord);
    } else {
      txt = "------------------";
    }
    $line.append(`<span>${txt.replaceAll(SEPARATOR_PIPE, " | ")}</span>`);
    $line.data({ text: txt });
    vocabItemContent.append($line);
  });
  vocabItem.append(vocabItemContent);
  vocab.append(vocabItem);

  const $rc = $('#resultContainer');
  if ($rc.is(':hidden')) {
    $rc.show();
    if (typeof updateToggleButtonView === 'function') updateToggleButtonView('resultContainer');
  }
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
window.updateToggleButtonView = updateToggleButtonView

// Shared handler for the Settings / Media toolbar buttons. If mainControlBody
// is collapsed, expanding it can also make a panel with a stale display:block
// reappear — so a plain slideToggle would slide it shut on the first click.
function toggleControlPanel(panelId) {
  const $main = $('#mainControlBody')
  const $panel = $('#' + panelId)
  const mainWasHidden = $main.is(':hidden')
  if (mainWasHidden) {
    $main.show()
    updateToggleButtonView('mainControlBody')
    if ($panel.css('display') === 'none') $panel.slideDown(120)
  } else {
    $panel.slideToggle(120)
  }
}
window.toggleControlPanel = toggleControlPanel

$('document').ready(e => {
  // Click on a subtitle-word `.link` opens a small option popover with
  // "Search here" (populates the search box) and "Search on wiki" (opens
  // the Wiktionary URL). Real `<a class="link">` anchors keep the
  // direct-open behaviour for the header "Wiki:" / "Images" / "Filmot"
  // shortcut links, since the popover doesn't make sense there.
  document.addEventListener('click', function (e) {
    if (!$(e.target).hasClass("link") && !$(e.target).hasClass('link-special')) return
    e.preventDefault()
    if (e.target.tagName === 'A') {
      const link = $(e.target).attr('href')
      if (link) window.open(link, '_blank').focus();
      return
    }
    const word = ($(e.target).text() || '').trim()
    const href = $(e.target).attr('href') || ''

    if($(e.target).hasClass('link-special')) {
        stopMedia()
        _showSubtitleWordPopover(e.pageX, e.pageY, word, href, $(e.target).attr('data-index'))
    } else if($(e.target).hasClass('link')) {
        stopMedia() //otherswise the popover might open and close immediately due to the click bubbling to the document listener below
        _showSubtitleWordPopover(e.pageX, e.pageY, word, href)
    }
  });

  let closePopover = (popoverId) => {
    const $pop = $('#' + popoverId)
    if ($pop.length === 0) return
    if ($pop.attr('hidden') !== undefined) return
    if ($(e.target).closest('#' + popoverId + ', .link').length) return
    $pop.attr('hidden', '')
  }
  // Close the subtitle-word popover when the user clicks anywhere outside
  // it (and outside another `.link` that would just reopen it).
  $(document).on('click', function (e) {
    closePopover('subtitleWordPopover')
    closePopover('subtitleWordPopoverSpecial')
  });

  $(document).on("click", function(e) {
    if ($(".ui-dialog:visible").length && !$(e.target).closest(".ui-dialog,.show-info-btn,#reviewCapturedBtn").length) {
      // The add-vocabulary dialog stages user input (typed words, picked
      // category) that's easy to lose to a stray outside click — keep it
      // open and require an explicit X / Escape / Save to dismiss. Same
      // for the captured-subtitles review: each row has a Delete / Push
      // action we don't want clobbered, plus the trigger button click
      // itself shouldn't immediately re-close the dialog it just opened.
      $(".ui-dialog-content:visible").not("#addToVocabularyDialog,#captured-subtitles-dialog").dialog("close");
    }
  });

  $searchText1.change(function (e) {
    searchTextChanged(e).then(r => {})
  })

  // X-clear button on the search input — show only when there's text;
  // clicking clears the input and re-fires the search-changed flow.
  const $searchTextClearBtn = $('#searchTextClearBtn')
  const updateSearchTextClearBtn = () => {
    if (($searchText1.val() || '').length > 0) $searchTextClearBtn.show()
    else $searchTextClearBtn.hide()
  }
  $searchText1.on('input change', updateSearchTextClearBtn)
  $searchTextClearBtn.click(() => {
    $searchText1.val('').trigger('change')
    $searchText1.focus()
    updateSearchTextClearBtn()
  })
  updateSearchTextClearBtn()

  // X-clear button injected into the typeahead input of every open select2
  // dropdown. The dropdown is appended to body on open and torn down on
  // close, so we re-inject (idempotently) on each `select2:open`.
  $(document).on('select2:open', '#searchedWords, #addToVocabularyDialogSelect, #vocabularySelect', () => {
    setTimeout(() => {
      const $field = $('.select2-container--open .select2-search__field')
      if (!$field.length) return
      const $wrap = $field.parent()
      let $clear = $wrap.find('.select2-search-clear')
      if (!$clear.length) {
        $clear = $('<button type="button" class="select2-search-clear" title="Clear" aria-label="Clear">×</button>')
        $wrap.append($clear)
        $clear.on('mousedown', e => {
          // mousedown fires before blur, so the dropdown stays open.
          e.preventDefault()
          e.stopPropagation()
          $field.val('').trigger('input').focus()
        })
      }
      const update = () => $clear.toggleClass('is-visible', ($field.val() || '').length > 0)
      $field.off('input.s2x').on('input.s2x', update)
      update()
    }, 0)
  })

  $('#searchedWords').change(e => {
    window.forceMainLangForNextSearch = true;
    vocabularyLineSelected()
  })

  $('#prevSearchBtn').click(() => navigateSearchHistory(-1))
  $('#nextSearchBtn').click(() => navigateSearchHistory(1))

  $('#searchVocabularyByPrefixBtn').click(e => {
    e.stopPropagation()
    $('#searchVocabularyMenu').toggle()
  })
  $('#searchVocabularyMenu').on('click', '.search-vocab-menu-item', e => {
    const mode = $(e.currentTarget).data('mode')
    $('#searchVocabularyMenu').hide()
    if (mode === 'prefix') searchVocabularyByPrefix()
    else if (mode === 'similar') searchVocabularyBySimilarity()
  })
  $(document).on('click', e => {
    if (!$(e.target).closest('#searchVocabularyMenu, #searchVocabularyByPrefixBtn').length) {
      $('#searchVocabularyMenu').hide()
    }
  })

  $('#rewindBtn').click(rewind)
  $('#hideMediaRelatedContainer').click(hideMediaRelatedContainer)
  $('#hidePlayer').click(() => {
    hideMediaContainer();
    hideMediaRelatedContainer()
  })
  $('#scrollButton').click(scrollButtonClicked)
  $('#togglePlayerControlsBtn').click(showMediaRelatedContainer)

  $('#mp3Choice').change(async e => {
    const link = $('#mp3Choice').val();
    if (link) {
      window.location.hash = link
      window.mediaSelected = {link: link, source: 'link'}
      window.syncSubtitle = true
      $('#toggleMainControl').click()
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

  $('#playBtn').click(togglePlay)

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

  const $searchText = $searchText1;
  $searchText.on(`focus`, () => {
    if ($("#toggleClearTextOnClickCheckbox").is(":checked")) {
      $searchText.val('').trigger('input')
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

  // Swipe-down on #mediaControls acts as a tap on #toggleMediaRelatedContainer.
  const mediaControlsEl = document.getElementById('mediaControls')
  if (mediaControlsEl) {
    let swipeStartX = 0, swipeStartY = 0, swipeActive = false
    mediaControlsEl.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { swipeActive = false; return }
      swipeStartX = e.touches[0].clientX
      swipeStartY = e.touches[0].clientY
      swipeActive = true
    }, { passive: true })
    mediaControlsEl.addEventListener('touchend', e => {
      if (!swipeActive) return
      swipeActive = false
      const t = e.changedTouches[0]
      const dy = t.clientY - swipeStartY
      const dx = Math.abs(t.clientX - swipeStartX)
      if (dy > 50 && dy > dx) $('#toggleMediaRelatedContainer').click()
    })
  }

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

function getWikiLink(word, uri = null, cls = 'link', index = null) {
  let uriComponent = uri || word;
  uriComponent = uriComponent.toLowerCase()
  return `<span> <span data-index="${index}" class="${cls}" href="https://${getLangFromUrl().code}.wiktionary.org/wiki/${encodeURIComponent(uriComponent)}">${word}</span></span>`;
}

// Lazy-create + show the small popover that lets the user choose between
// "Search here" (populate the search box) and "Search on wiki" (open the
// stored Wiktionary URL) for a clicked subtitle word.
function _showSubtitleWordPopover(pageX, pageY, word, href, index = null) {
  let popoverId = 'subtitleWordPopover'
  if(index != null) {
    popoverId = 'subtitleWordPopoverSpecial'
  }
  let $pop = $('#' + popoverId)
  let addStaredLine = true
  if(window.starredLines.find(it => it === index)) {
      addStaredLine = false
  }

  if ($pop.length === 0) {
    $pop = $(`<div id="${popoverId}" class="subtitle-word-popover" hidden>
      <button type="button" data-action="search-here">Search here</button>
      <button type="button" data-action="search-wiki">Search on wiki</button>
      ${index !== null ? `<button type="button" id="${popoverId}-add-favorite" data-action="add-favorite">Mark (${word})</button>` : ''}
    </div>`)
    $('body').append($pop)
  }
  if(index != null) {
    if(addStaredLine) {
      $(`#${popoverId}-add-favorite`).attr('data-action', 'add-favorite').html(`Mark (${word})`)
    } else {
      $(`#${popoverId}-add-favorite`).attr('data-action', 'remove-favorite').html(`Unmark (${word})`)
    }
  }

  let fn = (e) => {
    e.preventDefault(); e.stopPropagation()
    $pop.attr('hidden', '')
  }
  $pop.find('button').off('click.swp')
  $pop.find('[data-action="search-here"]').on('click.swp', e => {
    fn(e)
    if (word) $('#searchText').val(word).trigger('change')
  })
  $pop.find('[data-action="search-wiki"]').on('click.swp', e => {
    fn(e)
    if (href) window.open(href, '_blank').focus()
  })
  $pop.find('[data-action="add-favorite"]').on('click.swp', e => {
    fn(e)
    addStarredLine(index)
  })
  $pop.find('[data-action="remove-favorite"]').on('click.swp', e => {
    fn(e)
    removeStarredLine(index)
  })
  // Position next to the click, then clamp to the viewport.
  $pop.removeAttr('hidden').css({ position: 'absolute', left: 0, top: 0, visibility: 'hidden' })
  const pw = $pop.outerWidth(), ph = $pop.outerHeight()
  const ww = window.innerWidth, wh = window.innerHeight
  let left = pageX + 4
  let top = pageY + 4
  if (left + pw > window.scrollX + ww) left = window.scrollX + ww - pw - 6
  if (top + ph > window.scrollY + wh) top = pageY - ph - 6
  $pop.css({ left: Math.max(2, left), top: Math.max(2, top), visibility: 'visible' })
}

function getWikiLinkSpecial(word, uri = null, index = null) {
  return getWikiLink(word, uri, 'link-special', index)
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

function populateWikiLinks(text, $el, index = null) {
  $el && $el.html('')
  const [encoded, encodings] = encodeHtmlTags(text)

  const fn = (it, second) => {
    if (it.trim().length < 2) return it
    if (Object.values(encodings).map(it => it.trim()).includes(it)) return it
    return getWikiLinkSpecial(it, second, index)
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
        $searchText1.val(word).trigger('change')
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

  renderStarredLines()
}

function removeStarredLine(index) {
  window.starredLines = window.starredLines.filter(i => i !== index)
  renderStarredLines()
}

function renderStarredLines() {
  $('#starredLines').html('')
  $('#starredLinesSelect').html('')

  window.starredLines.forEach(index => {
    const ts = window.subtitles.find(it => it.index === index).ts
    const x = $(`<span data-index="${index}">${index}</span>`)
      .addClass('starred-sub')

    x.click(starredLineSelected(x, index, ts))

    $('#starredLines').append(x)

    $('#starredLinesSelect').append(new Option(index, index)).show()
  })
}

function expandSearchResults() {

}

let lastSub = null
const renderSubtitles = () => {
  const currentSub = window.currentSub

  if (lastSub && currentSub !== lastSub) {
    populateWikiLinks(currentSub.sv, $('#sv-sub'), currentSub.index);
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
      window.ytPlayer.seekTo(newTime)
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
  $("#addToVocabularyDialogSelect").select2({
    placeholder: 'Reference word',
    allowClear: true
  }).change(e => {
    // When inline is selected, keep the textarea in sync with the chosen reference word
    if ($('#vocabInsertPosition').val() === 'inline') {
      try {
        const parsed = JSON.parse($(e.target).val())
        $('#vocabularySegmentTextarea').val(parsed.o || parsed.word)
      } catch (_) {}
    }
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
  try {
    let srts = await fetch(`${getResourceUrl()}/srts/index.json`)
    srts = await srts.json()
    window.srts = srts

    const notFound = []
    // Kick off SRT fetches in parallel; capture the aggregate promise so we
    // can wait on them at the end without blocking the sequential loads
    // below (they don't depend on srt content). Each fetch is bounded by a
    // 15s timeout so a hung connection counts as "not found" instead of
    // freezing the readiness promise.
    const srtLoadingDone = Promise.allSettled(srts.map(async (it) => {
      try {
        await _withTimeout(getSubtitlesForLink(it['link'], it['source']), 15000, it['link'])
      } catch (e) {
        notFound.push(it['link'])
      }
    }))

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

    // Now make sure any still-in-flight SRT fetches have settled before we
    // declare subtitles ready — searches deferred in doSearch will fire here.
    await srtLoadingDone
    if (notFound.length > 0) {
      console.log("Not found", notFound.join('\n'))
    }
  } catch (e) {
    console.warn('loadAllSubtitles error', e);
  } finally {
    window._subtitlesLoaded = true;
    window._subtitlesReadyResolve();
  }
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
    window.ytPlayer.setPlaybackRate(newRate)
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
    return window.ytPlayer.getCurrentTime()
  }
}

function isNotPlaying() {
  if (window.playingAudio) {
    return audioPlayer.paused
  } else if (window.playingVideo) {
    return videoPlayer.paused
  } else if (window.playingYoutubeVideo) {
    if(!window.ytPlayer.getPlayerState) {
      return true
    }
    return window.ytPlayer.getPlayerState() !== 1;
  }
}

function markIntervalPlayDone(ct) {
  if (window.youtubePlayInterval && window.playingYoutubeVideo) {
    const s = window.youtubePlayInterval.start
    const e = window.youtubePlayInterval.end
    if (ct > e) {
      window.ytPlayer.pauseVideo()
      window.youtubePlayInterval = null
    }
  }
}

function updatePlayBtn() {
  const el = $('#playBtn')[0]
  let isPaused, isPlaying;
  if (window.playingYoutubeVideo) {
    if(!window.ytPlayer.getPlayerState) {
      return
    }
    isPaused = window.ytPlayer.getPlayerState() === 2;
    isPlaying = window.ytPlayer.getPlayerState() === 1;
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
    window.ytPlayer.seekTo(window.ytPlayer.getCurrentTime() + amount)
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
  let n = 10
  try {
    const parsed = parseInt($('#numberOfFindingsToShow').val(), 10)
    if (!Number.isNaN(parsed)) n = parsed
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

// Wrap a search pattern in regex word boundaries so a multi-word phrase like
// "ta efter" doesn't match inside "tänkta efter" / "leta efter". Uses
// lookarounds (\w on either side) rather than \b because Swedish letters like
// å/ä/ö are non-\w in JS — \b would put a boundary inside a Swedish word and
// cause spurious mismatches there too. Patterns the user explicitly padded
// with whitespace (their convention for literal-space prefix/suffix matching)
// are left alone.
function withWordBoundaries(pattern) {
  if (!pattern) return pattern
  if (/^\s|\s$/.test(pattern)) return pattern
  return `(?<!\\w)(?:${pattern})(?!\\w)`
}

async function getMatchingWords(list, search, token) {
  const startTime = new Date().getTime()
  let wordToItemsMap = {}
  let searchText = search
  const transformedSearchText = search

  const isNotTooShort = w => w.trim().length > 2
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))
  const ITEM_CHUNK = 25

  const transformedRe = new RegExp(transformedSearchText, "i")
  // Per-word matching test: alternatives like " ber ", " be ", " bad " (the
  // user's convention for forcing word-boundary semantics) can never match a
  // bare segmented word like "ber" because the literal spaces have to be in
  // the test string. Build a parallel regex with each alternative trimmed so
  // those individual words still produce per-word accordions. The whole-line
  // regex below keeps the spaced form for phrase-level matching.
  const perWordRe = new RegExp(
    '^(?:' +
    transformedSearchText
      .split(SEPARATOR_PIPE)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .join(SEPARATOR_PIPE) +
    ')$',
    "i"
  )

  // Multi-word phrase terms (e.g. expansion of "<*göra susen" produces
  // "göra susen|gör susen|gjorde susen|gjort susen"). The per-word filter
  // above can't match these (segmenter gives single words), and the
  // combined whole-pipe key would later be filtered out at render. So we
  // tag each phrase term independently here.
  const phraseTerms = (transformedSearchText || '')
    .split(SEPARATOR_PIPE)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1 && s.indexOf(' ') > 0)
  const phraseRes = phraseTerms.map(t => ({ term: t, re: new RegExp(withWordBoundaries(t), "i") }))

  for (let start = 0; start < list.length; start += ITEM_CHUNK) {
    if (token !== undefined && token !== window._subtitleSearchToken) return wordToItemsMap
    const end = Math.min(start + ITEM_CHUNK, list.length)
    for (let ix = start; ix < end; ix++) {
      const item = list[ix]
      const lines = item.data;
      for (const line of lines) {
        if (new Date().getTime() - startTime > 20000) {
          return wordToItemsMap;
        }
        const words = getWords(line.text, search).map(it => it.trim().toLowerCase())
        const endsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.endsWith(" ") && !transformedSearchText.startsWith(" ") && word.endsWith(transformedSearchText.trim());
        const startsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.startsWith(" ") && !transformedSearchText.endsWith(" ") && word.startsWith(transformedSearchText.trim());
        words.filter(word => word.match(perWordRe) || word.match(transformedRe) || endsWith(word) || startsWith(word))
            .forEach(word => {
              wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
            })
        // Whole search text as a word
        const word = searchText.toLowerCase().trim()
        if (word.indexOf(" ") > 0 && new RegExp(withWordBoundaries(word), "i").test(line.text)) {
          wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
        }
        // Per-phrase terms (so each expansion of "<*göra susen" gets its
        // own accordion key, instead of all collapsing into the whole-pipe
        // key that populateSRTFindings drops).
        for (const { term, re } of phraseRes) {
          if (re.test(line.text)) {
            wordToItemsMap[term] = computeIfAbsent(wordToItemsMap, term, it => []).concat(new MatchResult(term, line, item.url, item.source))
          }
        }
      }
    }
    await yieldToUI()
  }

  if (wordToItemsMap[searchText.trim()] === undefined) {
    wordToItemsMap[searchText] = []
  }

  const wordToItemsMap2 = {}
  if (isNotTooShort(searchText)) {
    searchText = searchText.trim()
  }

  const searchRe = new RegExp(withWordBoundaries(searchText), "i")
  for (let start = 0; start < list.length; start += ITEM_CHUNK) {
    if (token !== undefined && token !== window._subtitleSearchToken) return wordToItemsMap
    const end = Math.min(start + ITEM_CHUNK, list.length)
    for (let ix = start; ix < end; ix++) {
      const item = list[ix]
      const lines = item.data;
      for (const line of lines) {
        const matches = line.text.match(searchRe)
        const alreadyIncludedInResults = it => it.toLowerCase().indexOf(searchText.toLowerCase()) >= 0
            && wordToItemsMap[it.toLowerCase()].length > 0;

        if (matches && !Object.keys(wordToItemsMap).some(alreadyIncludedInResults)) {
          const matchedPart = matches[0].toLowerCase()
          wordToItemsMap2[matchedPart] = computeIfAbsent(wordToItemsMap2, matchedPart, it => []).concat(new MatchResult(matchedPart, line, item.url, item.source))
        }
      }
    }
    await yieldToUI()
  }

  if (!wordToItemsMap[searchText.trim()] || wordToItemsMap[searchText.trim()].length === 0) {
    wordToItemsMap = Object.assign(wordToItemsMap, wordToItemsMap2)
  }

  // The dedup pass below removes lines that already appeared under a longer
  // word-key, so we keep the most specific match per line. But the synthetic
  // "whole search text" key — added above when the entire pipe / multi-word
  // search matches a line — is by far the longest key, so without exclusion it
  // would absorb every line and then get filtered out at render time
  // (populateSRTFindings drops the exact-window.searchText key), leaving every
  // per-word accordion empty. Skip it here so per-word keys keep their items.
  const wholeSearchKey = (searchText || '').toLowerCase().trim()
  const matchingWords = Object.keys(wordToItemsMap).filter(w => w !== wholeSearchKey)
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
  const textToMatch = $(event.target).parent().data('text').replaceAll("\n", "")
  // Find the option with text containing the textToMatch string
  const $option = $('#searchedWords option').filter(function() {
    return $(this).text().toLowerCase().includes(textToMatch.toLowerCase());
  }).first();

  if ($option.length) {
    $('#searchedWords').val($option.val()).trigger('change');
  } else {
    // No matching dropdown option (e.g. the line came from a category that
    // hasn't been populated yet) — render the clicked line directly so the
    // arrow button always produces visible feedback.
    renderVocabularyLineByText(textToMatch);
  }

  window.preSelectedSearchedWord = textToMatch
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
      <i class="fa fa-mouse-pointer" style="color: red; cursor: pointer;"></i>
      ${highlightedText(chunk.replaceAll("|", " | "))}
  </div>`);
      $(div).find("i.fa").click(selectSearchedWord)
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
    if (source?.toLowerCase() == 'svt') {
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
  let url = `https://www.youtube.com/watch?v=${mediaId}&t=${time_start}&autoplay=1`
  if (source?.toLowerCase() == 'svt') {
    url = `https://www.svtplay.se/video/${mediaId}?position=${time_start}`
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

function collapseSubLines(evt) {
  $(evt.target).parents('.lines-cntnr').find('.sub-lines-cntnr').slideToggle('slow')
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
  const timeStart = parseInt(Math.floor(st.start.ordinal)); //fromSeconds(line.start.ordinal);
  const timeEnd = parseInt(Math.ceil(end.end.ordinal)); //fromSeconds(line.end.ordinal);

  const showInfoBtn = `<span class="show-info-btn">
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-info-circle media-info" viewBox="0 0 16 16" style="cursor: pointer;">
           <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
           <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
     </svg>
     <span class="info" style="display: none;">
            <span class="info times"> ${timeStart}-${timeEnd} </span>
     </span>
    </span>`

  const isNotALink = url.startsWith('jokes-') || url.startsWith('sayings-') || url.startsWith('metaphors-') || url.startsWith('idioms-');
  const playMediaBtn =
      `<img src="/img/icons/play_icon.png" alt="" style="width: 20px;height: 20px;cursor: pointer;" class="play-btn">`


  function truncate(str, n) {
    return (str.length > n) ? str.slice(0, n - 1) + '&hellip;' : str;
  };

  const infoButton = () => {
    if (isNotALink) return '';
    if (window.showInfoWithoutPopup) {
      const {fileName, url} = getInfoAboutMedia(subtitleFile.url, subtitleFile.source, timeStart);
      return `<a href="${url}" target="_blank" title="${fileName}">${truncate(fileName, 20)}</a>`
    }
    return showInfoBtn;
  };

  let html = `
<hr>
<div class="buttons" style="text-align: center;">
  <span class="add-prev-btn btn" > + </span>
  <span class="remove-next-btn btn"> - </span>

  <span class="play-btn-container" style="text-align: center;" data-id="${id}" data-url="${url}" data-time-start="${timeStart}" data-time-end="${timeEnd}">
     <span class="info btn collapse-sub-lines"> 🗖 </span>
     <span class="info">${subtitleFile.source}</span>
     ${infoButton()}
     ${playMediaBtn}
  </span>
  <span style="float: right;">
    <span class="remove-prev-btn btn" > - </span>
    <span class="add-next-btn btn"> + </span>
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
  $($container).find('.play-btn').click(() => playMediaSlice(url + '', timeStart+'', timeEnd+'', subtitleFile.source+''))
  $($container).find('.media-info').click(e => showInfo(subtitleFile.url + '', subtitleFile.source+'', timeStart+'', timeEnd+''))
  $($container).find('.collapse-sub-lines').click(collapseSubLines)

  $($container).find('.add-prev-btn').click(e => {
    changeIndices(''+id, fromLineIndex - 1, toLineIndex); renderLines(''+id, ''+url);
  })
  $($container).find('.remove-next-btn').click(e => {
    changeIndices(''+id, fromLineIndex + 1, toLineIndex); renderLines(''+id, ''+url);
  })
  $($container).find('.remove-prev-btn').click(e => {
    changeIndices(''+id, fromLineIndex, toLineIndex - 1); renderLines(''+id, ''+url);
  })
  $($container).find('.add-next-btn').click(e => {
    changeIndices(''+id, fromLineIndex, toLineIndex + 1); renderLines(''+id, ''+url);
  })

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
  'flera', 'mest', 'minst', 'någon', 'något', 'några', 'ingen', 'inget', 'inga', 'både', 'all', 'allt', 'alla', 'många',
  'dig', 'mig', 'oss', 'er', 'dem', 'honom', 'henne'
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

async function populateSRTFindings(wordToItemsMap, $result, token) {
  // Expose for debugging: inspect via `window._lastWordToItemsMap` in console.
  window._lastWordToItemsMap = wordToItemsMap
  let words = getWordsOrdered(Object.keys(wordToItemsMap))
  if (window.searchText.includes(SEPARATOR_PIPE)) {
    const filtered = words.filter(it => it.trim() !== window.searchText.trim())
    // If the filter strips the only key (no per-line matches AND the
    // expansion contained regex-syntax terms that getMatchingWords skipped
    // as placeholders), fall back to the individual expanded terms so the
    // user still gets a "no-result" header per form instead of a blank pane.
    words = filtered.length > 0 ? filtered : getSearchedTerms(window.searchText)
  }
  window._lastRenderedWords = words

  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))
  const WORD_CHUNK = 5

  for (let wStart = 0; wStart < words.length; wStart += WORD_CHUNK) {
    if (token !== undefined && token !== window._subtitleSearchToken) return
    const wEnd = Math.min(wStart + WORD_CHUNK, words.length)
    const slice = words.slice(wStart, wEnd)
    slice.forEach(word => {
    let items = wordToItemsMap[word] || []
    if (!items.length) {
      const w = Object.keys(wordToItemsMap).find(it => it.trim() === word.trim())
      if (w) items = wordToItemsMap[w]
    }
    let title = word
    if (word.trim().length !== word.length) {
      title = `"${word}"`
    }

    const wordBlock = $(`<div ><h5 class="l-accordion ${items.length ? '' : 'no-result'}"><i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i> ${title}</h5></div>`)
    items = items.toSorted((x, y) => x.path === window.preferredFile ? -1 : 1)

    const isMultiWord = word.trim().split(/\s+/).length > 1
    const wikiPart = isMultiWord
        ? `<a class="link" href="https://${getLangFromUrl().code}.wiktionary.org/w/index.php?search=${encodeURIComponent(word.trim()).replace(/%20/g, '+')}" target="_blank">${word}</a>`
        : getWikiLinks(word)
    wordBlock.append(`<div style=""> Wiki: ${wikiPart} 丨
        <a href="https://www.google.com/search?q=${word}&udm=2" target="_blank">Images</a> 丨
        <a href="https://filmot.com/search/%22${word}%22/1?lang=${getLangFromUrl().code}" target="_blank">Filmot</a> </div> <br>`)

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
    await yieldToUI()
  }
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
  if (window.forceMainLangForNextSearch) return 'sv';
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

function wordIsExactInVocabularyLine(vocabLine, search) {
  try {
    const vocabLineLower = (vocabLine || '').toLowerCase();
    const vocabWords = getWords(vocabLine)
        .filter(it => it.trim().length > 2)
        .map(it => it.toLowerCase().trim());
    const s = (search || '').toLowerCase().trim();
    if (!s) return false;
    if (vocabWords.includes(s)) return true;
    // Pipe-expanded search: try each term. Multi-word phrases get a
    // substring check against the un-expanded vocab line so a vocab line
    // like "(x)|<*göra susen|<*ta skruv" still matches "göra susen".
    const terms = s.split(SEPARATOR_PIPE).map(t => t.trim()).filter(Boolean);
    for (const t of terms) {
      if (t.indexOf(' ') > 0) {
        if (vocabLineLower.includes(t)) return true;
      } else if (vocabWords.includes(t)) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function wordIsInVocabularyLine(vocabLine, search) {
  try {
    const lang = getLangFromUrl().code;
    const expandedVocab = expandWords(vocabLine, lang);
    const expandedVocabLower = expandedVocab.toLowerCase();
    const vocabWords = getWords(expandedVocab)
        .filter(it => it.trim().length > 2)
        .map(it => it.toLowerCase().trim());
    const s = (search || '').toLowerCase().trim();
    if (!s) return false;
    if (vocabWords.includes(s)) return true;

    // The search can be a pipe-expanded form (e.g. "<*göra susen" becomes
    // "göra susen|gör susen|gjorde susen|gjort susen"). Try each alternative
    // independently — a single-token equality on the joined string will
    // never match, and multi-word phrases need a substring check against
    // the expanded vocab line.
    const terms = s.split(SEPARATOR_PIPE).map(t => t.trim()).filter(Boolean);
    for (const t of terms) {
      if (t.indexOf(' ') > 0) {
        if (expandedVocabLower.includes(t)) return true;
      } else if (vocabWords.includes(t)) {
        return true;
      }
    }

    // Stem-aware match (bidirectional). E.g. vocab "förvärva" + search
    // "förvärvat" should match — and vice versa — by reducing both sides
    // to a common stem. Run per single-word term so a pipe-expanded query
    // still gets stem coverage.
    const fn = typeof guessStems === 'function' ? guessStems : null;
    if (!fn) return false;
    const singleTerms = terms.length ? terms.filter(t => t.indexOf(' ') < 0) : [s];
    for (const t of singleTerms) {
      const searchVariants = new Set([t, ...fn(t, lang)]);
      for (const w of vocabWords) {
        if (searchVariants.has(w)) return true;
        const wStems = fn(w, lang);
        for (const ws of wStems) if (searchVariants.has(ws) || ws === t) return true;
      }
    }
    return false;
  } catch (e) {
    console.log(vocabLine, e)
    return false
  }
}

/**
 * Returns true if any pipe-separated word in vocabLine is a prefix of searchText
 * e.g. vocabLine="xyz|abc", searchText="xyzw" → true ("xyzw".startsWith("xyz"))
 */
function vocabLineMatchesPrefix(vocabLine, searchText) {
  const stRaw = (searchText || '').toLowerCase().trim()
  if (!stRaw) return false
  // Split BOTH sides on `|` so a search like "ångra|säkra" hits lines
  // containing "ångra…" OR "säkra…", and each pipe-separated alternative
  // in the vocab line is tested independently.
  const searchParts = stRaw.split(SEPARATOR_PIPE).map(s => s.trim()).filter(s => s.length >= 4)
  if (searchParts.length === 0) return false
  const vocabParts = vocabLine.split(SEPARATOR_PIPE).map(p => p.toLowerCase().trim()).filter(p => p.length >= 4)
  return vocabParts.some(p => searchParts.some(s => s.startsWith(p) || p.startsWith(s)))
}

// Common derivational prefixes per language. Sorted longest-first so that
// stripping picks `under` before `un`, `genom` before `ge`, `på` before
// `på`-vs-`å`, etc.
const COMMON_PREFIXES = {
  sv: ['tillbaka', 'genom', 'efter', 'under', 'över', 'fram', 'före', 'kvar', 'fast', 'sam', 'för', 'upp', 'miss', 'till', 'mot', 'ned', 'an', 'om', 'be', 'er', 'bi', 'av', 'ut', 'in', 'på', 'å'],
  en: ['under', 'over', 'after', 'fore', 'with', 'pre', 'pro', 'sub', 'super', 'mis', 'mid', 'dis', 'non', 'out', 'off', 'in', 're', 'un', 'de', 'be'],
  es: ['contra', 'extra', 'inter', 'entre', 'sobre', 'bajo', 'des', 'pre', 'sub', 'sin', 'con', 'mal', 're', 'in']
}

// Strip the longest matching prefix from `word` using the supplied list.
// Requires the residual stem to be ≥ 3 chars so we don't reduce e.g. "be"
// to "" or "bevis" to "vis".
function _stripPrefix(word, prefixList) {
  for (const p of prefixList) {
    if (word.length - p.length >= 3 && word.startsWith(p)) {
      return { prefix: p, stem: word.substring(p.length) }
    }
  }
  return { prefix: '', stem: word }
}

// For a search like "bevara" (sv), strip the leading prefix to get the stem
// "vara" and then look across the vocabulary for lines that contain words
// formed by attaching a DIFFERENT prefix to the same stem (e.g. "förvara",
// "anvara", "bevara"…). Returns { stem, origPrefix, results: [{prefix,
// candidate, lineIdx, category}, …] }.
function _findDifferentPrefixMatches(searchText, lang) {
  const lc = (searchText || '').toLowerCase().trim()
  if (!lc) return { stem: '', origPrefix: '', results: [] }
  const prefixes = (COMMON_PREFIXES[lang] || COMMON_PREFIXES.sv).slice().sort((a, b) => b.length - a.length)
  const { prefix: origPrefix, stem } = _stripPrefix(lc, prefixes)
  if (!stem || stem.length < 3) return { stem, origPrefix, results: [] }

  const allWords = []
  const lineCategory = []
  Object.entries(window.vocabulary || {}).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return
    lines.forEach(l => { allWords.push(l); lineCategory.push(cat) })
  })

  const seen = new Set()
  const results = []
  for (const p of prefixes) {
    if (p === origPrefix) continue
    const candidate = p + stem
    if (candidate.length < 4) continue
    allWords.forEach((vocabLine, idx) => {
      if (seen.has(idx)) return
      if (typeof vocabLine !== 'string') return
      const parts = vocabLine.split(SEPARATOR_PIPE).map(s => s.toLowerCase().trim()).filter(s => s.length >= candidate.length)
      // Strict: a vocab word starts with the candidate (so derived forms
      // like "förvarar"/"förvarade" still hit, but a random short word
      // doesn't get spuriously included).
      if (parts.some(part => part.startsWith(candidate))) {
        seen.add(idx)
        results.push({ prefix: p, candidate, lineIdx: idx, category: lineCategory[idx] || '?' })
      }
    })
  }
  return { stem, origPrefix, results, allWords }
}

function _openDifferentPrefixDialog(searchText, lang) {
  const { stem, origPrefix, results, allWords } = _findDifferentPrefixMatches(searchText, lang)

  let $dlg = $('#diffPrefixDialog')
  if ($dlg.length === 0) {
    $dlg = $('<div id="diffPrefixDialog" title="Different-prefix matches"></div>')
    $('body').append($dlg)
  }
  $dlg.empty()

  const headerLine = `Stem: <b>${_.escape(stem || '?')}</b>${origPrefix ? `, original prefix <b>${_.escape(origPrefix)}-</b>` : ''} — search "${_.escape(searchText || '')}"`
  $dlg.append(`<div style="font-size:0.85em;color:#666;margin-bottom:6px;">${headerLine}</div>`)

  const $list = $('<div class="diff-prefix-list"></div>')
  $dlg.append($list)

  if (!stem || stem.length < 3) {
    $list.append(`<div style="color:grey;padding:4px;">Search term is too short to derive a stem.</div>`)
  } else if (!results || results.length === 0) {
    $list.append(`<div style="color:grey;padding:4px;">No different-prefix matches for stem "${_.escape(stem)}".</div>`)
  } else {
    results.forEach(({ prefix, candidate, lineIdx, category }) => {
      const surroundings = getSurrounding(lineIdx, allWords)
      const matchEntry = surroundings.find(it => it.index === lineIdx) || { item: allWords[lineIdx], index: lineIdx }
      const vocabItem = $('<div class="vocabulary-segment"></div>')
      const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')
      // Highlight the prefix-swapped candidate inside the matched line.
      const $header = _buildVocabLine(matchEntry, candidate)
      $header.addClass('highlighted similar-segment-header')
      $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>')
      $header.append(`<span style="font-size:0.75em;color:#666;margin-left:6px;">[${_.escape(category)}] (${_.escape(prefix)}-)</span>`)
      vocabItemContent.append($header)
      const $body = $('<div class="similar-segment-body" hidden></div>')
      surroundings.forEach(it => {
        const $line = _buildVocabLine(it)
        if (it.index === lineIdx) $line.addClass('highlighted')
        $body.append($line)
      })
      vocabItemContent.append($body)
      vocabItem.append(vocabItemContent)
      $list.append(vocabItem)
    })
    _attachAccordionDelegate($list)
  }

  const w = Math.round(window.innerWidth * 0.95)
  const h = Math.round(window.innerHeight * 0.90)
  const position = { my: 'left top', at: 'left+2.5% top+5%', of: window }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', { width: w, height: h, position }).dialog('open')
  } else {
    $dlg.dialog({ width: w, height: h, position, modal: false, autoOpen: true })
  }
  _pinDialogToViewport($dlg)
}

const SIMILARITY_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'å', 'ä', 'ö'])

function _isVowel(ch) {
  return SIMILARITY_VOWELS.has((ch || '').toLowerCase())
}

// Compares two equal-length strings: returns {count, allVowel, allConsonant}
// where flags are true only when ALL differing positions are of that class.
function _classifyCharDiffs(a, b) {
  let count = 0, allVowel = true, allConsonant = true
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue
    count++
    const aV = _isVowel(a[i]), bV = _isVowel(b[i])
    if (!aV || !bV) allVowel = false
    if (aV || bV) allConsonant = false
  }
  return { count, allVowel: allVowel && count > 0, allConsonant: allConsonant && count > 0 }
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array(n + 1)
  let curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n]
}

// Map a word to a coarse phonetic key for the given language. Two words are
// candidate homophones (in this app's sense) when they reduce to the same
// key. Rules are intentionally conservative — false positives only show up
// in tier 0, which is the most prominent in the UI, so the substitutions
// stick to spellings that genuinely overlap in pronunciation.
function _phoneticKey(word, lang) {
  if (!word) return ''
  let w = word.toLowerCase()
  try { w = w.normalize('NFC') } catch (_) {}

  if (lang === 'sv') {
    // /ɧ/ family — sj-sound. Order matters: longer patterns first.
    w = w.replace(/skj|stj|ssj|sch/g, 'Ç')
    w = w.replace(/sj/g, 'Ç')
    w = w.replace(/sk(?=[eiyäö])/g, 'Ç')
    // /ɕ/ family — tj-sound.
    w = w.replace(/tj|kj/g, 'C')
    w = w.replace(/k(?=[eiyäö])/g, 'C')
    // /j/ family — silent-letter onsets, soft g, plain j.
    // hjul/jul, gjuta/juta etc. all collapse to a leading J.
    w = w.replace(/gj|hj|lj|dj/g, 'J')
    w = w.replace(/g(?=[eiyäö])/g, 'J')
    w = w.replace(/j/g, 'J')
    // c before front vowels = /s/, otherwise = /k/.
    w = w.replace(/c(?=[eiyäö])/g, 's')
    w = w.replace(/c/g, 'k')
    // Misc.
    w = w.replace(/w/g, 'v')
    w = w.replace(/ng/g, 'N')
    w = w.replace(/ck/g, 'k')
    w = w.replace(/qu/g, 'kv')
    w = w.replace(/x/g, 'ks')
    w = w.replace(/z/g, 's')
  } else if (lang === 'en') {
    w = w.replace(/ph/g, 'f')
    w = w.replace(/^(kn|gn|pn|wr)/g, m => m[1])  // silent leading letter
    w = w.replace(/ck/g, 'k')
    w = w.replace(/qu/g, 'kw')
    w = w.replace(/c(?=[eiy])/g, 's')
    w = w.replace(/c/g, 'k')
    w = w.replace(/^x/g, 'z')
    w = w.replace(/x/g, 'ks')
  } else if (lang === 'es') {
    w = w.replace(/ll/g, 'y')
    w = w.replace(/h/g, '')
    w = w.replace(/v/g, 'b')
    w = w.replace(/qu(?=[ei])/g, 'k')
    w = w.replace(/qu/g, 'kw')
    w = w.replace(/c(?=[ei])/g, 's')
    w = w.replace(/z/g, 's')
    w = w.replace(/c/g, 'k')
    w = w.replace(/g(?=[ei])/g, 'x')
    w = w.replace(/j/g, 'x')
  }
  return w
}

// Compound match: shorter word appears at the start or end of the longer
// one. Minimum 4-char shorter avoids spurious 2/3-letter substring noise
// ("is" inside dozens of unrelated words). Returns the length gap so we
// can rank tight compounds above sprawling ones.
function _compoundOverlap(a, b) {
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length < 4 || longer.length === shorter.length) return 0
  if (longer.startsWith(shorter) || longer.endsWith(shorter)) {
    return longer.length - shorter.length
  }
  return 0
}

// Tier 0: phonetic key match (language-aware homophone).
// Tier 1: same length, exactly one differing char that's vowel-vs-vowel,
//         OR compound match (e.g. "gnista" ⊂ "livsgnista").
// Tier 2: same length, exactly one differing char that's consonant-vs-consonant.
// Tier 3: edit distance ≤ 2 (and > 0). Returns null if not similar enough.
function _scoreSimilarity(searchWord, candidate, lang) {
  if (!searchWord || !candidate || searchWord === candidate) return null
  // Phonetic homophone — strongest signal. Cheap O(len) substitution.
  const sk = _phoneticKey(searchWord, lang)
  const ck = _phoneticKey(candidate, lang)
  if (sk && sk === ck) return { tier: 0, distance: 0 }
  if (searchWord.length === candidate.length) {
    const diff = _classifyCharDiffs(searchWord, candidate)
    if (diff.count === 1 && diff.allVowel) return { tier: 1, distance: 1 }
    if (diff.count === 1 && diff.allConsonant) return { tier: 2, distance: 1 }
  }
  const gap = _compoundOverlap(searchWord, candidate)
  if (gap > 0) return { tier: 1, distance: gap }
  const d = _levenshtein(searchWord, candidate)
  if (d > 0 && d <= 2) return { tier: 3, distance: d }
  return null
}

async function searchVocabularyBySimilarity() {
  const raw = window.searchText || ''
  if (!raw || !window.vocabulary) return

  const searchWords = raw.toLowerCase()
      .split(SEPARATOR_PIPE)
      .map(w => w.trim())
      .filter(w => w.length >= 2)
  if (!searchWords.length) return

  // Build flat-line array along with each line's category so we can group
  // matches by category later for round-robin selection.
  const allLines = []
  const lineCategory = []
  Object.entries(window.vocabulary).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return
    lines.forEach(line => {
      allLines.push(line)
      lineCategory.push(cat)
    })
  })
  const matches = []
  const swLens = searchWords.map(w => w.length)
  const lang = (typeof getLangFromUrl === 'function' ? getLangFromUrl().code : null) || 'sv'
  // Pre-compute phonetic keys for every search word so the per-candidate
  // loop reuses the result instead of recomputing on each comparison.
  const swPhonetic = searchWords.map(w => _phoneticKey(w, lang))

  // Cancellation: each invocation gets a fresh token; older runs bail when
  // they see a newer token.
  window._similarityRunToken = (window._similarityRunToken || 0) + 1
  const myToken = window._similarityRunToken

  const $vocab = $('#vocabularyResult')
  $vocab.html(`<div style="color:grey;padding:4px;">Searching similar words…</div>`)
  const $rc = $('#resultContainer')
  if ($rc.is(':hidden')) {
    $rc.show()
    updateToggleButtonView('resultContainer')
  }

  // Reuse a single Intl.Segmenter — re-creating it per line is expensive.
  const segmenter = new Intl.Segmenter([], { granularity: 'word' })
  const extractWords = text => {
    const seen = new Set()
    for (const seg of segmenter.segment(text)) {
      const w = seg.segment.toLowerCase().trim()
      if (w.length >= 2 && /\p{L}/u.test(w)) seen.add(w)
    }
    return seen
  }

  const CHUNK = 250
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))

  for (let start = 0; start < allLines.length; start += CHUNK) {
    if (myToken !== window._similarityRunToken) return  // newer run took over
    const end = Math.min(start + CHUNK, allLines.length)
    for (let lineIdx = start; lineIdx < end; lineIdx++) {
      const line = allLines[lineIdx]
      if (typeof line !== 'string' || !line.trim()) continue
      // Strip parenthesised hints/notes ("(ngn)", "(pl)", "(sl-pl)", etc.)
      // before extracting words — those are annotations, not part of the
      // vocabulary token, so they shouldn't be candidates for similarity.
      const cleaned = line.replace(/\([^)]*\)/g, ' ')
      const wordsInLine = extractWords(cleaned)
      for (const cw of wordsInLine) {
        const cwLen = cw.length
        const cwKey = _phoneticKey(cw, lang)
        for (let si = 0; si < searchWords.length; si++) {
          const sw = searchWords[si]
          if (cw === sw) continue
          // Cheap O(1) length filter: tiers 1/2 need equal length; tier 3
          // needs edit distance ≤ 2 (length diff ≤ 2). Tier 0 (homophone)
          // can have any length, so skip the filter when phonetic keys
          // already match.
          if (Math.abs(cwLen - swLens[si]) > 2 && cwKey !== swPhonetic[si]) {
            // Length differs too much for vowel/consonant/edit-distance tiers,
            // and phonetic keys don't match — but a compound match (one word
            // starts/ends with the other) might still apply.
            if (_compoundOverlap(sw, cw) === 0) continue
          }
          const score = _scoreSimilarity(sw, cw, lang)
          if (score) matches.push({ lineIdx, candidate: cw, searchWord: sw, ...score })
        }
      }
    }
    await yieldToUI()
  }

  if (myToken !== window._similarityRunToken) return

  matches.sort((a, b) =>
      a.tier - b.tier
      || a.distance - b.distance
      || Math.abs(a.candidate.length - a.searchWord.length) - Math.abs(b.candidate.length - b.searchWord.length)
      || a.candidate.localeCompare(b.candidate))

  console.log('[similar] search words:', searchWords, '— total scored matches:', matches.length)
  // console.table(matches.slice(0, 25).map(m => ({
  //   searchWord: m.searchWord,
  //   candidate: m.candidate,
  //   tier: m.tier,
  //   tierLabel: m.tier === 1 ? 'vowel' : m.tier === 2 ? 'consonant' : 'edit-dist',
  //   distance: m.distance,
  //   line: allLines[m.lineIdx]
  // })))

  const limitRaw = parseInt($('#numberOfSimilarFindings').val(), 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10

  // Group matches by candidate (matched word). Within a group, dedupe by
  // lineIdx — same line shouldn't appear twice for the same candidate even
  // if multiple search words hit it. The first time a candidate is seen
  // (in score-sorted order) defines that group's "bestMatch", which drives
  // ordering across groups.
  const groupMap = new Map()
  const seenLinesPerGroup = new Map()
  for (const m of matches) {
    if (!groupMap.has(m.candidate)) {
      groupMap.set(m.candidate, { bestMatch: m, lines: [], candidate: m.candidate })
      seenLinesPerGroup.set(m.candidate, new Set())
    }
    const seen = seenLinesPerGroup.get(m.candidate)
    if (seen.has(m.lineIdx)) continue
    seen.add(m.lineIdx)
    const enriched = { ...m, category: lineCategory[m.lineIdx] || '?' }
    groupMap.get(m.candidate).lines.push(enriched)
  }

  // Insertion order = score order of each group's best match → that's how
  // we want groups ordered globally too.
  const allGroups = Array.from(groupMap.values())
  const tier1Groups = allGroups.filter(g => g.bestMatch.tier <= 1)
  const otherGroupsFull = allGroups.filter(g => g.bestMatch.tier > 1)
  const tier1Top = tier1Groups.slice(0, limit)

  console.log(`[similar] tier-1 groups ${tier1Top.length}/${tier1Groups.length}, other groups ${otherGroupsFull.length}, limit=${limit}`)

  _renderSimilarMatches($vocab, tier1Top, otherGroupsFull, limit, allLines, raw)
}

// Wrap every (case-insensitive) occurrence of `word` in `text` with a bold
// blue `<b>` tag. Caller must have already escaped any HTML in `text`. The
// regex special chars in `word` are escaped so candidates like ".*" or
// "knäböja(d)" don't blow up.
function _highlightWordInLine(text, word) {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // \b doesn't behave nicely with Unicode (Swedish å/ä/ö); use lookarounds
  // around \p{L} so a candidate "växa" only highlights the whole word, not
  // a substring inside e.g. "växande". Falls back to plain match if the
  // engine doesn't support it.
  let re
  try {
    re = new RegExp(`(?<![\\p{L}])(${escaped})(?![\\p{L}])`, 'giu')
  } catch (_) {
    re = new RegExp(`(${escaped})`, 'gi')
  }
  return text.replace(re, '<b style="color:#1565c0">$1</b>')
}

// Group items so entries that share the same key end up adjacent. The
// relative order across keys is determined by the first occurrence of each
// key in the input, and the relative order within a key is preserved
// (stable sort). Used to cluster vocab matches that share a "word" (first
// pipe-segment) but happen to live in different categories.
function _clusterByKey(items, getKey) {
  const order = new Map()
  items.forEach(it => {
    const k = getKey(it)
    if (!order.has(k)) order.set(k, order.size)
  })
  return [...items].sort((a, b) => (order.get(getKey(a)) ?? 0) - (order.get(getKey(b)) ?? 0))
}

// First pipe-separated word of a vocabulary line, lowercased and trimmed.
// Used as the clustering key so duplicates of the same head-word across
// different categories show up next to each other in search results.
function _vocabLineFirstWord(line) {
  if (!line) return ''
  const parts = (line + '').split(SEPARATOR_PIPE).map(p => p.toLowerCase().trim()).filter(p => p)
  return parts[0] || ''
}

// Build a single `<div class="vocabulary-line">` for a getSurrounding entry.
// Centralised so renderVocabularyFindings, renderVocabularyLineByText, and
// _buildSimilarSegment all share the same line shape (icon + escaped text +
// data-text). `highlight` may be a candidate word to bold-blue inside the
// matched line.
function _buildVocabLine(it, highlight) {
  let txt = it.item
  const $line = $('<div class="vocabulary-line"></div>')
  if (txt.trim().length) {
    $line.append('<i class="fa fa-mouse-pointer" style="color: red; cursor: pointer;margin-right: 3px;"></i>')
    $line.find('i.fa').click(selectSearchedWord)
  } else {
    txt = '------------------'
  }
  let displayTxt = _.escape(txt).replaceAll(SEPARATOR_PIPE, ' | ')
  if (highlight) displayTxt = _highlightWordInLine(displayTxt, highlight)
  $line.append(`<span>${displayTxt}</span>`)
  $line.data({ text: txt })
  return $line
}

// Idempotently attach an accordion delegate to a container holding
// `.similar-segment-header` / `.similar-segment-body` pairs. Single-open:
// clicking a header collapses any other open one and toggles the clicked
// segment. Clicks that originate on the `i.fa` arrow inside a header pass
// through to selectSearchedWord without triggering the toggle.
function _attachAccordionDelegate($container) {
  if (!$container || !$container.length) return
  if ($container.data('accordionBound')) return
  $container.data('accordionBound', true)
  $container.on('click', '.similar-segment-header', function (e) {
    // The matched-line header may also contain a red `<i class="fa-mouse-pointer">`
    // arrow that re-anchors the search via selectSearchedWord — let those
    // clicks pass through. Other icons inside the header (e.g. the
    // `.similar-chevron` itself) should still toggle the accordion.
    if ($(e.target).closest('.fa-mouse-pointer').length) return
    const $this = $(this)
    const $body = $this.siblings('.similar-segment-body')
    const wasOpen = !$body.is('[hidden]')
    $container.find('.similar-segment-body').not($body).attr('hidden', '')
    $container.find('.similar-segment-header').not(this).removeClass('is-open')
    if (wasOpen) {
      $body.attr('hidden', '')
      $this.removeClass('is-open')
    } else {
      $body.removeAttr('hidden')
      $this.addClass('is-open')
    }
  })
}

function _buildSimilarSegment({ lineIdx, candidate, searchWord, tier, distance, category }, allLines, opts = {}) {
  const tierLabel = tier === 0 ? 'homophone'
      : tier === 1 ? 'vowel diff'
      : tier === 2 ? 'consonant diff'
      : `edit dist ${distance}`
  const tierClass = tier === 0 ? 'similar-tier-0'
      : tier === 1 ? 'similar-tier-1'
      : tier === 2 ? 'similar-tier-2'
      : `similar-tier-3-d${distance}`
  const collapsible = !!opts.collapsible
  const vocabItem = $(`<div class="vocabulary-segment ${tierClass}"></div>`)
  const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')

  const headerInner = `[${_.escape(category || '?')}] ≈ <b>${_.escape(candidate)}</b> ↔ ${_.escape(searchWord)} (${tierLabel})`
  const $header = collapsible
      ? $(`<div class="similar-segment-header" style="font-size:0.75em;color:#666;padding:2px 4px;"><i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i><span>${headerInner}</span></div>`)
      : $(`<div style="font-size:0.75em;color:#666;padding:2px 4px;">${headerInner}</div>`)
  vocabItemContent.append($header)

  // Body container: the surrounding-line context. In collapsible mode it
  // sits in its own wrapper so the click handler can hide/show it without
  // touching the header.
  const $body = collapsible
      ? $('<div class="similar-segment-body" hidden></div>')
      : vocabItemContent

  getSurrounding(lineIdx, allLines).forEach(it => {
    let txt = it.item
    const $line = $(`<div class="vocabulary-line"></div>`)
    if (txt.trim().length) {
      $line.append(`<i class="fa fa-mouse-pointer" style="color: red; cursor: pointer;margin-right: 3px;"></i>`)
      $line.find('i.fa').click(selectSearchedWord)
    } else {
      txt = '------------------'
    }
    let displayTxt = _.escape(txt).replaceAll(SEPARATOR_PIPE, ' | ')
    if (it.index === lineIdx) {
      displayTxt = _highlightWordInLine(displayTxt, candidate)
    }
    $line.append(`<span>${displayTxt}</span>`)
    $line.data({ text: txt })
    if (it.index === lineIdx) $line.addClass('highlighted')
    $body.append($line)
  })
  if (collapsible) vocabItemContent.append($body)
  vocabItem.append(vocabItemContent)
  return vocabItem
}

// Build a candidate-grouped block: a header announcing the matched word
// plus one collapsible per-line segment for every vocab line that hit it.
function _buildSimilarGroup(group, allLines) {
  const { bestMatch, lines, candidate } = group
  const tierLabel = bestMatch.tier === 0 ? 'homophone'
      : bestMatch.tier === 1 ? 'vowel diff'
      : bestMatch.tier === 2 ? 'consonant diff'
      : `edit dist ${bestMatch.distance}`
  const tierClass = bestMatch.tier === 0 ? 'similar-tier-0'
      : bestMatch.tier === 1 ? 'similar-tier-1'
      : bestMatch.tier === 2 ? 'similar-tier-2'
      : `similar-tier-3-d${bestMatch.distance}`
  const $group = $(`<div class="similar-group ${tierClass}"></div>`)
  $group.append(
      `<div class="similar-group-header" style="font-size:0.85em;font-weight:600;padding:4px 6px;border-top:1px solid #ddd;margin-top:6px;">≈ <b style="color:#1565c0">${_.escape(candidate)}</b> ↔ ${_.escape(bestMatch.searchWord)} (${tierLabel}) — ${lines.length} line${lines.length === 1 ? '' : 's'}</div>`)
  lines.forEach(m => $group.append(_buildSimilarSegment(m, allLines, { collapsible: true })))
  return $group
}

function _renderSimilarMatches($vocab, tier1Top, otherFull, limit, allLines, raw) {
  $vocab.html('')

  if (tier1Top.length === 0 && otherFull.length === 0) {
    $vocab.html(`<div style="color:grey;padding:4px;">No similar matches for "${_.escape(raw)}"</div>`)
    return
  }

  if (tier1Top.length === 0) {
    $vocab.append(`<div style="color:grey;padding:4px;">No homophone / vowel-diff matches for "${_.escape(raw)}"</div>`)
  } else {
    tier1Top.forEach(g => $vocab.append(_buildSimilarGroup(g, allLines)))
    _attachAccordionDelegate($vocab)
  }

  if (otherFull.length > 0) {
    const initialBatch = Math.min(limit, otherFull.length)
    const $more = $(`<button type="button" class="lang-tool-btn" id="showMoreSimilarBtn" style="margin-top:6px;">Show ${initialBatch} more groups (consonant diff / edit dist) →</button>`)
    // Stop propagation: a document-level click handler in the search-vocab
    // setup closes any visible jQuery-UI dialog when the click target is
    // outside `.ui-dialog`. Without this, the dialog opens and is closed
    // by the same click event on the very next bubbling step.
    $more.on('click', e => {
      e.preventDefault()
      e.stopPropagation()
      _openSimilarMoreDialog(otherFull, limit, allLines, raw)
    })
    $vocab.append($more)
  }

}

function _openSimilarMoreDialog(otherFull, limit, allLines, raw) {
  let $dlg = $('#similarMoreDialog')
  if ($dlg.length === 0) {
    $dlg = $('<div id="similarMoreDialog" title="Other similar matches"></div>')
    $('body').append($dlg)
  }
  $dlg.empty()
  const $header = $(`<div style="font-size:0.85em;color:#666;margin-bottom:6px;">Tier 2 / 3 groups for "${_.escape(raw)}" — <span class="similar-shown-count">0</span> of ${otherFull.length} shown:</div>`)
  $dlg.append($header)
  const $list = $('<div class="similar-more-list"></div>')
  $dlg.append($list)
  const $loadMore = $(`<button type="button" class="lang-tool-btn" style="margin-top:8px;display:none;"></button>`)
  $dlg.append($loadMore)

  // Single-open accordion: clicking a header collapses any other open one
  // and toggles the clicked segment. Delegated, so future "Show N more"
  // batches inherit the behaviour without rebinding.
  _attachAccordionDelegate($list)

  let shown = 0
  const updateLoadMore = () => {
    const remaining = otherFull.length - shown
    $header.find('.similar-shown-count').text(shown)
    if (remaining > 0) {
      const next = Math.min(limit, remaining)
      $loadMore.text(`Show ${next} more groups (${remaining} remaining) →`).show()
    } else {
      $loadMore.hide()
    }
  }
  const renderMore = () => {
    const slice = otherFull.slice(shown, shown + limit)
    slice.forEach(g => $list.append(_buildSimilarGroup(g, allLines)))
    shown += slice.length
    updateLoadMore()
  }
  $loadMore.on('click', e => {
    // Match the outer button's stop-propagation logic: the document-level
    // click handler closes any visible dialog when the click target is
    // outside `.ui-dialog`. The button is inside `.ui-dialog`, so this is
    // belt-and-suspenders, but consistent.
    e.preventDefault()
    e.stopPropagation()
    renderMore()
  })

  renderMore()  // initial batch

  const w = Math.round(window.innerWidth * 0.95)
  const h = Math.round(window.innerHeight * 0.90)
  // top ≈ 5% of viewport
  const position = { my: 'left top', at: 'left+2.5% top+5%', of: window }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', { width: w, height: h, position }).dialog('open')
  } else {
    $dlg.dialog({ width: w, height: h, position, modal: false, autoOpen: true })
  }
  _pinDialogToViewport($dlg)
}

// jQuery UI computes dialog position with `of: window` as absolute document
// coordinates (scrollY-included). Forcing position:fixed afterwards would
// reinterpret those pixels as viewport-relative, pushing the dialog off-screen
// on a scrolled page. So we explicitly set position:fixed AND replace top/left
// with viewport-relative values so the dialog actually shows up at the
// intended spot regardless of scroll.
function _pinDialogToViewport($dlg) {
  const $wrap = $dlg.closest('.ui-dialog')
  if (!$wrap.length) return
  const top = Math.round(window.innerHeight * 0.05)
  const left = Math.round(window.innerWidth * 0.025)
  $wrap.css({ position: 'fixed', top: top + 'px', left: left + 'px' })
}

function searchVocabularyByPrefix() {
  const searchText = window.searchText ? window.searchText.toLowerCase().trim() : ''
  if (!searchText || !window.vocabulary) return

  // Build flat-line array along with each line's category so we can group
  // matches by category later for round-robin ordering (mirrors similarity search).
  const allWords = []
  const lineCategory = []
  Object.entries(window.vocabulary).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return
    lines.forEach(line => {
      allWords.push(line)
      lineCategory.push(cat)
    })
  })

  const indexesOfAppearance = allWords
    .map((vocabLine, i) => vocabLineMatchesPrefix(vocabLine, searchText) ? i : null)
    .filter(it => it !== null)

  // Group matches by category, preserving first-seen order; then round-robin
  // so each category contributes its first hit before any contributes its second.
  const byCategory = new Map()
  for (const idx of indexesOfAppearance) {
    const cat = lineCategory[idx] || '(uncategorized)'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat).push(idx)
  }
  const categoryLists = Array.from(byCategory.values())
  const roundRobin = []
  for (let round = 0; ; round++) {
    let added = false
    for (const list of categoryLists) {
      if (round < list.length) {
        roundRobin.push(list[round])
        added = true
      }
    }
    if (!added) break
  }
  // After round-robin across categories, cluster by the line's first word
  // so the same head-word appearing in multiple categories ends up shown
  // back-to-back instead of scattered through the result list.
  const ordered = _clusterByKey(roundRobin, idx => _vocabLineFirstWord(allWords[idx]))

  console.log(`[prefix] ${ordered.length} matches across ${categoryLists.length} categories (round-robin + word-clustering)`)

  const $vocab = $('#vocabularyResult')
  $vocab.html('')

  if (ordered.length === 0) {
    $vocab.html(`<div style="color:grey;padding:4px;">No prefix matches for "${_.escape(searchText)}"</div>`)
  } else {
    ordered.forEach(idx => {
      const category = lineCategory[idx] || '?'
      const vocabItem = $('<div class="vocabulary-segment"></div>')
      const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')

      const surroundings = getSurrounding(idx, allWords)
      const matchEntry = surroundings.find(it => it.index === idx) || { item: allWords[idx], index: idx }
      // Matched line as collapsible header. The category badge is appended
      // to the right of the matched-line text so the header keeps its
      // original look while still showing the category.
      const $header = _buildVocabLine(matchEntry)
      $header.addClass('highlighted similar-segment-header')
      $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>')
      $header.append(`<span style="font-size:0.75em;color:#666;margin-left:6px;">[${_.escape(category)}]</span>`)
      vocabItemContent.append($header)

      // Body keeps every surrounding line (including the matched one at its
      // original index) so the user sees the full context with original
      // ordering when they expand.
      const $body = $('<div class="similar-segment-body" hidden></div>')
      surroundings.forEach(it => {
        const $line = _buildVocabLine(it)
        if (it.index === idx) $line.addClass('highlighted')
        $body.append($line)
      })
      vocabItemContent.append($body)

      vocabItem.append(vocabItemContent)
      $vocab.append(vocabItem)
    })
    _attachAccordionDelegate($vocab)
  }

  // "Different prefixes" button — strips the leading prefix from the
  // search term and looks for vocabulary lines containing words formed by
  // attaching a different prefix to the same stem (e.g. "bevara" → stem
  // "vara" → matches "förvara"). Shown regardless of whether the primary
  // prefix search produced hits, since the user might want suggestions
  // even when there are zero direct matches.
  const lang = (typeof getLangFromUrl === 'function' ? getLangFromUrl().code : null) || 'sv'
  const $diffBtn = $(`<button type="button" class="lang-tool-btn" id="showDiffPrefixesBtn" style="margin-top:6px;">Different prefixes →</button>`)
  $diffBtn.on('click', e => {
    e.preventDefault()
    e.stopPropagation()
    _openDifferentPrefixDialog(searchText, lang)
  })
  $vocab.append($diffBtn)

  // Ensure the result container is visible
  const $rc = $('#resultContainer')
  if ($rc.is(':hidden')) {
    $rc.show()
    updateToggleButtonView('resultContainer')
  }
}

export function renderVocabularyFindings(search) {
  search = search.toLowerCase().trim()

  if (commonWordsToIgnore.includes(search)) {
    $('#vocabularyResult').html('')
    return
  }

  let matcher = (ln) => wordIsExactInVocabularyLine(ln, search)
  let categories = Object.keys(window.vocabulary)
      .filter(cat => window.vocabulary[cat].find(matcher))

  if (categories.length === 0) {
    matcher = (ln) => wordIsInVocabularyLine(ln, search)
    categories = Object.keys(window.vocabulary)
        .filter(cat => window.vocabulary[cat].find(matcher))
  }

  // Build words alongside per-line category so the collapsible header can
  // show which category the matched line came from.
  const words = []
  const lineCategory = []
  categories.forEach(cat => {
    (window.vocabulary[cat] || []).forEach(line => {
      words.push(line)
      lineCategory.push(cat)
    })
  })

  const indexesOfAppearance = _clusterByKey(
      words.map((vocabLine, i) => matcher(vocabLine) ? i : null).filter(it => it !== null),
      idx => _vocabLineFirstWord(words[idx]))

  const vocab = $('#vocabularyResult')
  vocab.html('')
  indexesOfAppearance.forEach(idx => {
    const category = lineCategory[idx] || '?'
    const vocabItem = $('<div class="vocabulary-segment"></div>')
    const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')
    const surroundings = getSurrounding(idx, words)
    const matchEntry = surroundings.find(it => it.index === idx) || { item: words[idx], index: idx }
    // Matched line acts as the collapsible header.
    const $header = _buildVocabLine(matchEntry)
    $header.addClass('highlighted similar-segment-header')
    $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>')
    $header.append(`<span style="font-size:0.75em;color:#666;margin-left:6px;">[${_.escape(category)}]</span>`)
    vocabItemContent.append($header)
    // Surrounding context (including the matched line at its original
    // position so ordering is preserved) goes into the collapsible body.
    const $body = $('<div class="similar-segment-body" hidden></div>')
    surroundings.forEach(it => {
      const $line = _buildVocabLine(it)
      if (it.index === idx) $line.addClass('highlighted')
      $body.append($line)
    })
    vocabItemContent.append($body)
    vocabItem.append(vocabItemContent)
    vocab.append(vocabItem)
  })
  _attachAccordionDelegate(vocab)
}

async function render(searchResults, search, className, token) {
  // The vocab list is rendered once on the primary pass. The secondary pass
  // (fired by fetchSRTs' stem fallback) gets a multi-pipe `search` like
  // "förvärvad|förvärva|förvärv" which never satisfies word-equality and
  // would clear the vocab list — skip it here so the primary's matches stay.
  if (className !== "secondary") {
    $('#vocabularyResult').html('');

    // For dropdown-driven searches, `search` is the expanded pipe form which
    // never satisfies word-equality in renderVocabularyFindings — anchor on
    // the original line instead. For typed searches (unprocessedSearchText is
    // null) the regular finder is the right tool.
    if (window.unprocessedSearchText && renderVocabularyLineByText(window.unprocessedSearchText)) {
      // rendered
    } else {
      renderVocabularyFindings(search)
    }
  }
  if (!searchResults) return {}

  const $result = $('#result');
  // Keep a "Loading…" placeholder visible during the slow getMatchingWords /
  // populate phase so the result area never goes blank mid-search.
  $result.html('<div style="color:grey;padding:6px;">Loading…</div>')

  if (className === "secondary") {
    $result.css({backgroundColor: '#e3cece'})
  } else {
    $result.css({backgroundColor: 'white'})
  }

  const searchResultsFiltered = filterByLanguage(searchResults);

  const wordToItemsMap = await getMatchingWords(searchResultsFiltered, search, token);
  if (token !== undefined && token !== window._subtitleSearchToken) return wordToItemsMap

  // Matches are ready — swap out the loader for the real content.
  $result.html('')
  if (window.unprocessedSearchText) {
    $result.append(`<p class="search-text-info">${
        unprocessedSearchText.split(SEPARATOR_PIPE).map(it => getWikiLink(it)).join(" | ")
    }</p>`)
  }

  await populateSRTFindings(wordToItemsMap, $result, token);
  if (token !== undefined && token !== window._subtitleSearchToken) return wordToItemsMap

  if (Object.keys(wordToItemsMap).length === 0) {
    $result.html(resultNotFound(window.searchText))
  }

  $result.append("<hr>")

  let wordToItemsMapNonSrt = {}
  if (window.location.pathname.includes("wordbuilder")) {
    wordToItemsMapNonSrt = await getMatchingWords(searchResults.filter(it => it.nonSrt), search, token);
    if (token !== undefined && token !== window._subtitleSearchToken) return wordToItemsMap
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

async function fetchFromDownloadedFiles(lookingFor, token) {
  lookingFor = expandWords(lookingFor)

  const keys = Object.keys(window.allSubtitles)
      .filter(it => window.allSubtitles[it].sv && window.allSubtitles[it].en)
  const out = []
  const re = new RegExp(lookingFor, "i")
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))
  const CHUNK = 100

  for (let start = 0; start < keys.length; start += CHUNK) {
    if (token !== undefined && token !== window._subtitleSearchToken) return out
    const end = Math.min(start + CHUNK, keys.length)
    for (let i = start; i < end; i++) {
      const it = keys[i]
      const svText = window.allSubtitles[it].sv
      const enText = window.allSubtitles[it].en
      const svMatch = svText && svText.match(re)
      const enMatch = enText && enText.match(re)
      if (svMatch || enMatch) {
        out.push(new SearchResult(
            window.allSubtitles[it].source,
            it,
            getSubs(enText, it + ".en.srt", it, window.allSubtitles[it].source, window.allSubtitles[it].fetchedFrom),
            getSubs(svText, it + getTargetLangSrtSuffix(), it, window.allSubtitles[it].source, window.allSubtitles[it].fetchedFrom),
            !!enMatch,
            !!svMatch,
        ))
      }
    }
    await yieldToUI()
  }
  return out
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
    // Match the innermost balanced pair (no nested parens inside) and strip
    // it by position. Greedy matching previously over-consumed for nested
    // pairs like "(was i so (vajaså))", trimming "(vajaså))" — leaving an
    // orphan "(" that triggered a false "Invalid brackets" alert.
    const m = txt.match(/\([^()]*\)/)
    if (m) {
      txt = txt.slice(0, m.index) + txt.slice(m.index + m[0].length)
    } else {
      // No innermost pair exists despite both '(' and ')' being present —
      // structurally broken (e.g. ")foo("). Bail to avoid an infinite loop.
      txt = txt.replace(/[()]/g, "")
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
  const terms = getSearchedTerms(txt)
  const final = []
  terms.forEach(term => {
    if (lang === 'es' && ['lo', 'le', 'la'].some(it => term.trim().endsWith(it))) {
      final.push(term.substring(0, term.length - 2))
    }
    final.push(term)
  })
  txt = final.join(SEPARATOR_PIPE)
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
  const terms = txt.split(SEPARATOR_PIPE)
  const fn = () => {
    const w = terms.shift()
    if (!w) return
    // Trailing whitespace is optional so the synthetic space we used to add
    // doesn't end up baked into the expanded term — that space made
    // "<*gå rätt till" miss subtitles like "gå rätt till." (punctuation, no space).
    const match = w.match(/<\*(?:\{([^)]+)})?([^\s>]*)(?:\s.*)?$/)
    if (match && match.length === 3) {
      const ref = match[1]
      const wordToExpand = match[2]
      let expandedWords = [];
      if(lang === 'es') {
        expandedWords = conjugateTableSpanish(wordToExpand, ref).flat()
      } else {
        expandedWords = expansions[wordToExpand] || [wordToExpand]
      }
      expandedWords.forEach(it => terms.push(w.replace(`<*${ref ? '{' + ref + '}' : ''}` + wordToExpand, it)))
    } else if (w.indexOf("<*") < 0) {
      terms.push(w)
    }
  }

  const cnt = 0
  while (cnt < 5 && terms.some(t => t.indexOf("<*") >= 0)) {
    fn()
  }

  return _.uniq(terms)
      .filter(it => it.trim().length > 1)
      .map(it => {
        if (it.length < 3) return ` ${it} `
        return it
      }).join(SEPARATOR_PIPE)
}

const STEM_RULES = {
  sv: [
    ['ningarna', ['']],
    ['ningar', ['']],
    ['ningen', ['']],
    ['ning', ['']],
    ['ande', ['a']],
    ['ende', ['a']],
    ['arna', ['a', '']],
    ['erna', ['']],
    ['orna', ['a']],
    ['ades', ['a']],
    ['ade', ['a']],
    ['ats', ['a']],
    ['at', ['a']],
    // Past participle: "förvärvad" → "förvärva" (group 1/4) or root "förvärv".
    ['ad', ['a', '']],
    ['ång', ['å']],
    ['else', ['a']],
    ['elser', ['a']],
    // Group-3 supinum ("köpit" → "köpa") and past participle "köpt" → "köpa".
    ['it', ['a']],
    ['arn', ['are']],
    ['ar', ['a', '']],
    ['na', ['en', 'et']],
    ['or', ['a']],
    ['er', ['', 'a']],
    ['en', ['']],
    ['et', ['']],
    ['de', ['']],
    ['te', ['']],
    ['ts', ['']],
    ['s', ['']],
    ['et', ['en']],
    ['en', ['et']],
    ['t', ['a', 'd', '']], // "köpt" → "köpa" or root "köp"; "förvärvat" → "förvärva" or root "förvärv".
    ['a', ['']], // edge case: "knassiga" → "knassig" (adj declension) or root "knass" (noun)
  ],
  es: [
    ['iendo', ['er', 'ir']],
    ['yendo', ['er', 'ir']],
    ['ando', ['ar']],
    ['ieron', ['er', 'ir']],
    ['aron', ['ar']],
    ['aban', ['ar']],
    ['aba', ['ar']],
    ['amos', ['ar']],
    ['emos', ['er']],
    ['imos', ['ir']],
    ['aste', ['ar']],
    ['iste', ['er', 'ir']],
    ['ado', ['ar']],
    ['ido', ['er', 'ir']],
    ['ías', ['er', 'ir']],
    ['ía', ['er', 'ir']],
    ['es', ['']],
    ['as', ['a']],
    ['os', ['o']],
    ['s', ['']],
  ],
  en: [
    ['ational', ['ate']],
    ['tional', ['tion']],
    ['ization', ['ize']],
    ['ations', ['ate']],
    ['ation', ['ate', '']],
    ['ments', ['ment']],
    ['ment', ['']],
    ['ness', ['']],
    ['ously', ['ous']],
    ['fully', ['ful']],
    ['sses', ['ss']],
    ['ies', ['y']],
    ['ied', ['y']],
    ['ying', ['y']],
    ['ing', ['', 'e']],
    ['edly', ['', 'e']],
    ['ed', ['', 'e']],
    ['ly', ['']],
    ['est', ['', 'e']],
    ['er', ['', 'e']],
    ['es', ['e', '']],
    ['s', ['']],
  ],
}

function guessStems(word, lang) {
  if (!word) return []
  word = word.toLowerCase().trim()
  if (word.length < 4) return []
  const langRules = STEM_RULES[lang]
  if (!langRules) return []
  const stems = []
  for (const [suffix, repls] of langRules) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, word.length - suffix.length)
      repls.forEach(r => {
        const s = base + r
        if (s !== word) stems.push(s)
      })
      break
    }
  }
  return _.uniq(stems)
}

function findUnknownExpansionRefs() {
  const expansions = getExpansionForWords()
  const known = new Set(Object.keys(expansions))
  const unknown = new Map()
  // Only Unicode letters count as the expansion key — stop at pipes, parens,
  // brackets, punctuation, whitespace, etc.
  const re = /<\*(?:\{[^}]*\})?(\p{L}+)/gu
  Object.values(window.vocabulary || {}).flat().forEach(line => {
    if (typeof line !== 'string') return
    let m
    re.lastIndex = 0
    while ((m = re.exec(line)) !== null) {
      const word = m[1] && m[1].toLowerCase()
      if (!word || known.has(word)) continue
      if (!unknown.has(word)) unknown.set(word, new Set())
      unknown.get(word).add(line)
    }
  })
  return Array.from(unknown.entries())
      .map(([word, lines]) => ({ word, lines: Array.from(lines) }))
      .sort((a, b) => a.word.localeCompare(b.word))
}

// Expose for console debugging — module-scoped functions aren't on window otherwise.
window.guessStems = guessStems;
window.wordIsInVocabularyLine = wordIsInVocabularyLine;
window.renderVocabularyFindings = renderVocabularyFindings;
window.findUnknownExpansionRefs = findUnknownExpansionRefs;
window.searchVocabularyBySimilarity = searchVocabularyBySimilarity;

async function fetchSRTs(searchText) {
  try {
    if ((typeof searchText) !== 'string') {
      searchText = null
    }
    const $searchText = $("#searchText");
    const txt = searchText || $searchText.val().toLowerCase()
    // $searchText.val(txt)

    if (txt.length < 3) return

    const _historyTerm = (window.unprocessedSearchText && window.unprocessedSearchText.trim()) || txt.trim()
    recordSessionSearch(_historyTerm)

    window.searchText = txt;
    window.searchText = expandWords(window.searchText)
    window.searchText = _.trim(window.searchText, SEPARATOR_PIPE)

    //To fix the mistakes in vocabulary list with double spaces
    window.searchText = window.searchText.split(" ").map(it => it.trim()).join(" ")

    window.allSubtitles = window.allSubtitles || {}

    // Cancellation: each fetchSRTs invocation gets a fresh token; older runs
    // bail out as soon as they observe a newer token, so the UI stays responsive
    // when the user types quickly.
    window._subtitleSearchToken = (window._subtitleSearchToken || 0) + 1
    const myToken = window._subtitleSearchToken

    $('#result').html('<div style="color:grey;padding:6px;">Loading…</div>')

    console.log("Loading from local")
    window.searchResult = await fetchFromDownloadedFiles(window.searchText.trim(), myToken);
    if (myToken !== window._subtitleSearchToken) return
    const words = await render(window.searchResult, window.searchText, "primary", myToken)
    if (myToken !== window._subtitleSearchToken) return
    const primaryHits = Object.values(words).flat().length
    console.log("[stem-fallback] primary hits:", primaryHits, "searchText:", window.searchText)
    if (!window.searchText.includes(SEPARATOR_PIPE) && window.searchText.trim().length > 4 && primaryHits === 0) {
      const stemLang = $('#toggleLangCb').prop('checked') ? 'en' : getLangFromUrl().code
      const stems = guessStems(window.searchText.trim(), stemLang)
      console.log("[stem-fallback] stems:", stems)
      if (stems.length) {
        window.searchText = [window.searchText, ...stems].join(SEPARATOR_PIPE)
        window.searchResult = await fetchFromDownloadedFiles(window.searchText, myToken);
        if (myToken !== window._subtitleSearchToken) return
        console.log("[stem-fallback] secondary results:", window.searchResult.length)
        await render(window.searchResult, window.searchText, "secondary", myToken)
        // Removed: searchVocabularyByPrefix() — it would overwrite the
        // primary's stem-aware vocab matches with prefix-only matches,
        // dropping rows like "förvärvat" that don't share a prefix with
        // the typed search term. Stem matching in renderVocabularyFindings
        // already subsumes the useful cases.
      }
    }
  } finally {
    window.forceMainLangForNextSearch = false
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
  //console.log('Rendering accordions')
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
      // Single-open: collapse any other expanded sibling in this accordion
      // group before toggling the clicked one.
      const group = (el.getElementsByClassName("l-accordion").length
          ? el.getElementsByClassName("l-accordion")
          : el.getElementsByClassName("accordion"))
      for (const other of group) {
        if (other === this) continue
        other.classList.remove("active")
        const op = other.nextElementSibling
        if (op && op.classList && op.classList.contains('autocreated-panel')) op.style.display = "none"
      }

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

async function loadYoutubeVideo(videoId) {
  await waitUntil(() => window.ytPlayerReady && window.ytPlayer.getIframe())
  const iframe = window.ytPlayer.getIframe()
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
  const lines = $('.starred-sub').map((i, e) => $(e).text()).toArray()

  if (window.mediaBeingPlayed.source === 'local') {
    const s = prompt('Source of media:')
    if (!s || !s.trim()) return
    window.mediaBeingPlayed.source = s.trim()
  }

  const lang = getLangFromUrl()
  const filePath = `db/language/${lang.fullName}/srts/srt_favorites.json`

  // Read the existing array (if any) and upsert this video's record by link.
  let existing = []
  try {
    const r = await fetch(`${getResourceUrl()}/srts/srt_favorites.json`, { cache: 'no-cache' })
    if (r.ok) existing = await r.json()
  } catch (_) { /* file may not exist yet */ }
  if (!Array.isArray(existing)) existing = []

  const record = { ...window.mediaBeingPlayed, lines }
  const idx = existing.findIndex(it => it.link === window.mediaBeingPlayed.link)
  if (idx >= 0) existing[idx] = record
  else existing.push(record)

  try {
    await window.GitHubUtils.putFileWithContent({
      owner: 'trexsatya',
      repo: 'trexsatya.github.io',
      filePath,
      content: JSON.stringify(existing, null, 2),
      commitMessage: `srt: update starred lines for ${window.mediaBeingPlayed.link}`,
      branch: 'gh-pages'
    })
    console.log('Starred lines committed to GitHub')
  } catch (e) {
    console.error('Failed to commit starred lines to GitHub:', e)
    alert('Failed to save starred lines: ' + e.message)
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

function srtTimeFromValue(v) {
  if (v == null) return '00:00:00,000'
  if (typeof v === 'object') {
    if (v.ordinal != null) return srtTimeFromValue(v.ordinal)
    if (v.seconds != null) return srtTimeFromValue(v.seconds)
    return '00:00:00,000'
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/)
    if (m) {
      const ms = (m[4] + '000').slice(0, 3)
      return `${m[1].padStart(2, '0')}:${m[2]}:${m[3]},${ms}`
    }
    const n = Number(v)
    if (!Number.isNaN(n)) return srtTimeFromValue(n)
    return '00:00:00,000'
  }
  const total = Math.max(0, Number(v) || 0)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = Math.floor(total % 60)
  const ms = Math.round((total - Math.floor(total)) * 1000)
  const pad = (n, w) => String(n).padStart(w, '0')
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`
}

function srtTimeToSeconds(ts) {
  // Accepts "HH:MM:SS,mmm" or "HH:MM:SS.mmm"
  const m = String(ts).match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/)
  if (!m) return 0
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt((m[4] + '000').slice(0, 3), 10) / 1000
}

function parseSrtEntries(text) {
  if (!text || typeof text !== 'string') return []
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/)
  const entries = []
  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    let startIdx = 0
    if (/^\d+$/.test(lines[0])) startIdx = 1
    const timeLine = lines[startIdx]
    const m = timeLine && timeLine.match(/(\d\d:\d\d:\d\d[,.]\d{1,3})\s*-->\s*(\d\d:\d\d:\d\d[,.]\d{1,3})/)
    if (!m) return
    const textLines = lines.slice(startIdx + 1)
    entries.push({
      start: srtTimeFromValue(m[1]),
      end: srtTimeFromValue(m[2]),
      text: textLines.join('\n')
    })
  })
  return entries
}

function entriesToSrtText(entries) {
  return entries.map((it, i) => {
    return `${i + 1}\n${it.start} --> ${it.end}\n${it.text}`
  }).join('\n\n') + '\n'
}

function linesToSrtText(items) {
  const entries = (items || []).map(it => ({
    start: srtTimeFromValue(it.start),
    end: srtTimeFromValue(it.end),
    text: (it.text || '').replace(/\r\n/g, '\n')
  }))
  entries.sort((a, b) => srtTimeToSeconds(a.start) - srtTimeToSeconds(b.start))
  return entriesToSrtText(entries)
}

function mergeSrtWithNewEntries(existingText, newItems) {
  const existing = parseSrtEntries(existingText)
  const incoming = (newItems || []).map(it => ({
    start: srtTimeFromValue(it.start),
    end: srtTimeFromValue(it.end),
    text: (it.text || '').replace(/\r\n/g, '\n')
  }))
  const all = existing.concat(incoming)
  // Dedupe by start+text in case the same captured chunk is sent twice.
  const seen = new Set()
  const deduped = []
  all.forEach(e => {
    const key = `${e.start}|${e.text}`
    if (seen.has(key)) return
    seen.add(key)
    deduped.push(e)
  })
  deduped.sort((a, b) => srtTimeToSeconds(a.start) - srtTimeToSeconds(b.start))
  return entriesToSrtText(deduped)
}

// Strip characters that make filenames URL-unfriendly: filesystem-reserved
// chars (\ / : * ? " < > |), the fullwidth colon U+FF1A that sneaks in from
// SVT/YouTube metadata, whitespace, and control chars. Swedish å/ä/ö are
// retained — they encode fine via encodeURIComponent.
function sanitizeFilenameSegment(s, maxLen) {
  if (!s) return ''
  // Strip filesystem/URL-reserved chars and the fullwidth colon U+FF1A
  // (which slips in from SVT/YouTube metadata and is ugly when URL-encoded).
  // Preserve ordinary spaces and Swedish letters — the existing " || "
  // naming convention has spaces inside each piece, and they encode fine.
  let out = String(s)
    .replace(/[\\/:*?"<>|：]/g, '_')
    .replace(/[\r\n\t\f\v]+/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/_+/g, '_')
    .replace(/^[\s_]+|[\s_]+$/g, '')
  if (maxLen && out.length > maxLen) out = out.slice(0, maxLen).replace(/[\s_]+$/, '')
  return out
}

function buildCapturedSubtitleBaseName(detail) {
  const id = detail.videoId
  const title = detail.videoTitle || id
  const channel = detail.channel || detail.channelTitle || detail.videoChannel || detail.uploader || title
  // Keep the established `channel || title || id` convention — other code
  // (fetchCategorisation, local-file media-name parsing) and downstream
  // tooling expects this separator. Each piece is sanitized (no FS/URL
  // reserved chars, no fullwidth colon, no internal pipe) and capped so the
  // full filename stays well under FS / URL limits.
  const safeChannel = sanitizeFilenameSegment(channel, 40)
  const safeTitle = sanitizeFilenameSegment(title, 60)
  return [safeChannel, safeTitle, id].filter(Boolean).join(' || ')
}

// Look up an entry in the deployed index.json by videoId. Uses
// api.github.com (real-time, uncached) instead of raw.githubusercontent.com
// so we get the latest state even right after a previous push.
async function fetchSrtIndexEntry(videoId) {
  const lang = getLangFromUrl()
  const filePath = `db/language/${lang.fullName}/srts/index.json`
  try {
    const file = await window.GitHubUtils.getFile(
      'trexsatya', 'trexsatya.github.io', filePath, '', 'gh-pages'
    )
    const arr = JSON.parse(file.content)
    if (Array.isArray(arr)) {
      return arr.find(it => it.link === videoId) || null
    }
  } catch (e) {
    console.warn('fetchSrtIndexEntry failed', e)
  }
  return null
}

function inferSubtitleSource(detail) {
  if (detail.source) return detail.source
  const url = detail.videoUrl || ''
  if (/youtu\.?be/.test(url)) return 'youtube'
  if (/svtplay\.se/.test(url)) return 'SVT'
  return 'captured'
}

async function uploadSrtToGithub(baseName, langCode, content, commitMessage) {
  const lang = getLangFromUrl()
  const fileName = `${baseName}.${langCode}.srt`
  const filePath = `db/language/${lang.fullName}/srts/${encodeURIComponent(fileName)}`
  await window.GitHubUtils.putFileWithContent({
    owner: 'trexsatya',
    repo: 'trexsatya.github.io',
    filePath,
    content,
    commitMessage,
    branch: 'gh-pages'
  })
}

async function upsertSrtIndexEntry(videoId, baseName, source) {
  const lang = getLangFromUrl()
  const filePath = `db/language/${lang.fullName}/srts/index.json`

  // Read via api.github.com (real-time) instead of raw.githubusercontent.com,
  // which has a ~5-minute CDN cache — two captures in quick succession would
  // otherwise read a stale index and clobber each other's entries.
  let existing = []
  let sha
  try {
    const file = await window.GitHubUtils.getFile(
      'trexsatya', 'trexsatya.github.io', filePath, '', 'gh-pages'
    )
    existing = JSON.parse(file.content)
    sha = file.sha
  } catch (e) {
    console.warn('upsertSrtIndexEntry: failed to read index.json — assuming empty', e)
  }
  if (!Array.isArray(existing)) existing = []

  const record = { link: videoId, name: baseName, source }
  const idx = existing.findIndex(it => it.link === videoId)
  if (idx >= 0) existing[idx] = { ...existing[idx], ...record }
  else existing.push(record)

  await window.GitHubUtils.putFile(
    'trexsatya',
    'trexsatya.github.io',
    filePath,
    JSON.stringify(existing, null, 2),
    `srts: upsert index entry for ${videoId}`,
    sha,
    '',
    'gh-pages'
  )
}

// --- Captured subtitle buffer (localStorage) ---
const CAPTURED_SUBTITLES_KEY = 'cupitor:capturedSubtitles'

function loadCapturedBuffer() {
  try {
    const raw = localStorage.getItem(CAPTURED_SUBTITLES_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch (_) { return [] }
}

function saveCapturedBuffer(buf) {
  try {
    localStorage.setItem(CAPTURED_SUBTITLES_KEY, JSON.stringify(buf))
  } catch (e) {
    console.error('Failed to persist captured subtitles', e)
  }
}

function updateCapturedBtn() {
  const $btn = $('#reviewCapturedBtn')
  if (!$btn.length) return
  const n = loadCapturedBuffer().length
  if (n === 0) $btn.hide()
  else $btn.text(`Review Captured (${n})`).show()
}

function bufferCapturedSubtitle(detail) {
  const buf = loadCapturedBuffer()
  buf.push({ id: uuid(), capturedAt: Date.now(), detail })
  saveCapturedBuffer(buf)
  updateCapturedBtn()
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderCapturedReviewBody() {
  const buf = loadCapturedBuffer()
  const $body = $('#captured-subtitles-dialog-content').empty()
  if (buf.length === 0) {
    $body.append('<p>No captured subtitles pending.</p>')
    return
  }
  buf.forEach(item => {
    const d = item.detail || {}
    const exists = !!(window.allSubtitles && window.allSubtitles[d.videoId])
    const status = exists
      ? '<span style="color:#a60;">merge into existing</span>'
      : '<span style="color:#070;">new file</span>'
    const $row = $(`
      <div class="captured-item" data-id="${escapeHtml(item.id)}" style="border:1px solid #ccc;border-radius:4px;padding:8px;margin-bottom:8px;">
        <div style="font-weight:bold;">${escapeHtml(d.videoTitle || d.videoId || 'unknown')}</div>
        <div style="font-size:12px;color:#555;">
          ${escapeHtml(d.videoId || '')} ·
          ${escapeHtml(d.sourceLang || '?')}→${escapeHtml(d.targetLang || '?')} ·
          ${(d.lines || []).length} src / ${(d.translation || []).length} tgt lines ·
          ${status}
        </div>
        ${d.query ? `<div style="font-size:12px;">query: <code>${escapeHtml(d.query)}</code> @${escapeHtml(d.matchIndex)}</div>` : ''}
        <div style="margin-top:4px;">
          <button data-action="preview" class="cap-btn">Preview SRT</button>
          <button data-action="push" class="cap-btn">Push This</button>
          <button data-action="delete" class="cap-btn" style="color:#a00;">Delete</button>
        </div>
        <pre data-role="preview" style="display:none;max-height:240px;overflow:auto;background:#f7f7f7;padding:6px;font-size:11px;white-space:pre-wrap;"></pre>
      </div>
    `)
    $body.append($row)
  })
}

function ensureCapturedDialogDom() {
  let $dlg = $('#captured-subtitles-dialog')
  if (!$dlg.length) {
    $dlg = $('<div id="captured-subtitles-dialog" title="Captured Subtitles"><div id="captured-subtitles-dialog-content"></div></div>')
    $('body').append($dlg)
  } else if (!$dlg.hasClass('ui-dialog-content') && $dlg.parent('body').length === 0) {
    // Not yet initialized and not directly under <body>: move it so the dialog
    // wrapper isn't buried inside a parent that's display:none.
    $dlg.appendTo('body')
  }
  // Strip any inline display:none left over from the static HTML so jQuery UI
  // can manage visibility cleanly.
  $dlg.css('display', '')
  return $dlg
}

window.openCapturedSubtitlesReview = function () {
  try {
    ensureCapturedDialogDom()
  } catch (e) {
    console.error('openCapturedSubtitlesReview: ensureCapturedDialogDom failed', e)
  }
  console.log('openCapturedSubtitlesReview invoked; buffer size =', loadCapturedBuffer().length)
  renderCapturedReviewBody()
  const $body = $('#captured-subtitles-dialog-content')
  if (!$body.data('handlers-bound')) {
    $body.on('click', '.cap-btn', async function () {
      const $row = $(this).closest('.captured-item')
      const id = $row.data('id')
      const action = $(this).data('action')
      const buf = loadCapturedBuffer()
      const idx = buf.findIndex(b => b.id === id)
      if (idx < 0) return
      const d = buf[idx].detail || {}

      if (action === 'delete') {
        buf.splice(idx, 1)
        saveCapturedBuffer(buf)
        $row.remove()
        updateCapturedBtn()
        return
      }

      if (action === 'preview') {
        const existing = window.allSubtitles[d.videoId]
        const src = existing && existing.sv
          ? mergeSrtWithNewEntries(existing.sv, d.lines || [])
          : linesToSrtText(d.lines || [])
        const tgt = existing && existing.en
          ? mergeSrtWithNewEntries(existing.en, d.translation || [])
          : linesToSrtText(d.translation || [])
        const $pre = $row.find('[data-role=preview]')
        if ($pre.is(':visible')) {
          $pre.hide()
        } else {
          $pre.text(
            `# ${d.sourceLang || 'source'}\n${src}\n\n# ${d.targetLang || 'target'}\n${tgt}`
          ).show()
        }
        return
      }

      if (action === 'push') {
        const $btn = $(this)
        $btn.prop('disabled', true).text('Pushing…')
        try {
          await handleCapturedSubtitle(d)
          const buf2 = loadCapturedBuffer()
          const idx2 = buf2.findIndex(b => b.id === id)
          if (idx2 >= 0) {
            buf2.splice(idx2, 1)
            saveCapturedBuffer(buf2)
          }
          $row.remove()
          updateCapturedBtn()
        } catch (err) {
          console.error('Push failed', err)
          alert('Push failed: ' + err.message)
          $btn.prop('disabled', false).text('Push This')
        }
      }
    })
    $body.data('handlers-bound', true)
  }

  const $dlg = $('#captured-subtitles-dialog')
  if (!$dlg.length) {
    console.error('#captured-subtitles-dialog not found in DOM after ensure')
    alert('Captured-subtitles dialog div missing; check console.')
    return
  }

  const winW = $(window).width()
  const winH = $(window).height()
  const opts = {
    title: 'Captured Subtitles',
    width: Math.min(720, winW - 40),
    height: Math.min(620, winH - 40),
    modal: false,
    autoOpen: true,
    appendTo: 'body',
    position: { my: 'center top', at: 'center top+20', of: window },
    buttons: {
      'Push All': async function () {
        const startBuf = loadCapturedBuffer()
        if (!startBuf.length) { $(this).dialog('close'); return }
        if (!confirm(`Push ${startBuf.length} captured subtitle(s) to GitHub?`)) return
        const $self = $(this)
        let pushedCount = 0
        const failed = []
        for (const item of startBuf) {
          try {
            await handleCapturedSubtitle(item.detail)
            // Drop just this item from the live buffer so concurrent captures aren't clobbered.
            saveCapturedBuffer(loadCapturedBuffer().filter(b => b.id !== item.id))
            $('#captured-subtitles-dialog-content').find(`.captured-item[data-id="${item.id}"]`).remove()
            updateCapturedBtn()
            pushedCount += 1
          } catch (err) {
            console.error('Push failed for', item.detail && item.detail.videoId, err)
            failed.push(item)
          }
        }
        if (failed.length) {
          alert(`${pushedCount} pushed, ${failed.length} failed (see console).`)
        } else {
          $self.dialog('close')
        }
      },
      'Close': function () { $(this).dialog('close') }
    }
  }

  try {
    if ($dlg.hasClass('ui-dialog-content')) {
      $dlg.dialog('option', opts).dialog('open')
    } else {
      $dlg.dialog(opts)
    }
    // Defensive: force the wrapper visible + viewport-anchored + on top.
    // Pin to the top of the viewport (user prefers it doesn't drift mid-page).
    const $wrap = $dlg.closest('.ui-dialog')
    const targetLeft = Math.max(20, ($(window).width() - $wrap.outerWidth()) / 2)
    $wrap.css({
      display: 'block',
      visibility: 'visible',
      position: 'fixed',
      top: '20px',
      left: targetLeft + 'px',
      zIndex: 100000
    })
    $dlg.css({ display: 'block', visibility: 'visible' })
    try { $dlg.dialog('moveToTop') } catch (_) {}
    // Log ancestor visibility chain so we can spot a display:none parent.
    const chain = []
    let el = $wrap[0] && $wrap[0].parentNode
    while (el && el !== document) {
      const cs = getComputedStyle(el)
      chain.push({
        tag: el.tagName,
        id: el.id || null,
        cls: el.className || null,
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity
      })
      el = el.parentNode
    }
    console.log('wrapper :visible=', $wrap.is(':visible'),
      'ancestorChain=', chain,
      'wrapperOpacity=', $wrap.css('opacity'),
      'wrapperTransform=', $wrap.css('transform'))
    console.log('Captured-subtitles dialog opened',
      'wrapper=', $wrap.length,
      'wrapperDisplay=', $wrap.css('display'),
      'wrapperVisibility=', $wrap.css('visibility'),
      'wrapperPos=', $wrap.offset(),
      'wrapperSize=', { w: $wrap.outerWidth(), h: $wrap.outerHeight() },
      'zIndex=', $wrap.css('z-index')
    )
  } catch (e) {
    console.error('Failed to open captured-subtitles dialog', e)
    alert('Could not open Review dialog: ' + (e && e.message))
  }
}

async function handleCapturedSubtitle(detail) {
  if (!detail || !detail.videoId) {
    console.warn('capturedSubtitle: missing videoId', detail)
    return
  }
  const { videoId, sourceLang, targetLang, lines = [], translation = [] } = detail

  // Authoritative: check index.json on github. window.allSubtitles can be
  // misleading — it gets populated even by purely-local files / re-pushes —
  // whereas the index is the single source of truth for what's deployed.
  const indexEntry = await fetchSrtIndexEntry(videoId)
  const isNew = !indexEntry

  // For existing entries, reuse the deployed filename (existing .sv.srt /
  // .en.srt on gh-pages already use it). For new entries, build a fresh,
  // URL-safe, length-capped name. Both languages use the same baseName so
  // the .sv / .en pair share a filesystem-friendly prefix.
  const baseName = indexEntry
    ? indexEntry.name
    : buildCapturedSubtitleBaseName(detail)
  const source = indexEntry && indexEntry.source
    ? indexEntry.source
    : inferSubtitleSource(detail)

  // Existing SRT content for merging: prefer in-memory if loaded; otherwise
  // fetch from gh-pages. Skip the fetch entirely for new entries.
  let existingSourceText = null
  let existingTargetText = null
  if (!isNew) {
    const cached = window.allSubtitles[videoId]
    if (cached && cached.sv) existingSourceText = cached.sv
    if (cached && cached.en) existingTargetText = cached.en
    if ((!existingSourceText && sourceLang) || (!existingTargetText && targetLang)) {
      try {
        if (!existingSourceText && sourceLang) {
          const srcName = `${baseName}.${sourceLang}.srt`
          const r = await fetch(`${getResourceUrl()}/srts/${encodeURIComponent(srcName)}`, { cache: 'no-cache' })
          if (r.ok) existingSourceText = await r.text()
        }
        if (!existingTargetText && targetLang) {
          const tgtName = `${baseName}.${targetLang}.srt`
          const r = await fetch(`${getResourceUrl()}/srts/${encodeURIComponent(tgtName)}`, { cache: 'no-cache' })
          if (r.ok) existingTargetText = await r.text()
        }
      } catch (e) { console.warn('failed to fetch existing srt for merge', e) }
    }
  }

  // sourceLang corresponds to the language being studied (stored under `sv` in allSubtitles),
  // targetLang corresponds to the translation (stored under `en`).
  const sourceText = existingSourceText
    ? mergeSrtWithNewEntries(existingSourceText, lines)
    : linesToSrtText(lines)
  const targetText = existingTargetText
    ? mergeSrtWithNewEntries(existingTargetText, translation)
    : linesToSrtText(translation)

  window.allSubtitles[videoId] = {
    ...(window.allSubtitles[videoId] || {}),
    sv: sourceText,
    en: targetText,
    source,
    fileName: baseName
  }

  if (sourceLang) {
    await uploadSrtToGithub(baseName, sourceLang, sourceText,
      `srt: ${isNew ? 'add' : 'merge'} ${sourceLang} subtitle for ${videoId}`)
  }
  if (targetLang) {
    await uploadSrtToGithub(baseName, targetLang, targetText,
      `srt: ${isNew ? 'add' : 'merge'} ${targetLang} subtitle for ${videoId}`)
  }

  // Only touch index.json when the entry actually needs to be added.
  if (isNew) {
    await upsertSrtIndexEntry(videoId, baseName, source)
    if (Array.isArray(window.srts) && !window.srts.find(it => it.link === videoId)) {
      window.srts.push({ link: videoId, name: baseName, source })
    }
  }
}

function isLocalhost() {
  return window.location.hostname === 'localhost'
}

if (isLocalhost()) {
  $('#saveRevisionBtn').show()
  $('#saveStarredLinesBtn').show()

  setInterval(() => {
    fetch("http://localhost:5000/vocabulary?lang=" + getLangFromUrl().fullName)
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
    if (window.ytPlayer.getVideoUrl().indexOf(url) < 0) {
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

// Expose functions that are called from inline HTML onclick/onchange handlers.
// Required because this file is loaded as type="module" which is scoped by default.
window.openAddToVocabDialog = openAddToVocabDialog;
window.addToVocab = addToVocab;
window.onVocabInsertPositionChange = onVocabInsertPositionChange;
window.searchVocabularyByPrefix = searchVocabularyByPrefix;
window.importSearches = importSearches;
window.importSearchesFromVocab = importSearchesFromVocab;
window.importSearchesFromFile = importSearchesFromFile;
window.loadWholeVocabulary = loadWholeVocabulary;
window.loadLocalFiles = loadLocalFiles;
window.saveStarredLines = saveStarredLines;
window.saveRevision = saveRevision;

// openCapturedSubtitlesReview is already assigned to window above; re-affirm here
// alongside the other inline-handler exposures so the pattern stays uniform.
$(function () {
  try { updateCapturedBtn() } catch (_) {}
  // Defensive: if anything earlier failed before the assignment ran, define a
  // last-resort stub so the inline onclick at least produces a visible error.
  if (typeof window.openCapturedSubtitlesReview !== 'function') {
    window.openCapturedSubtitlesReview = function () {
      console.error('openCapturedSubtitlesReview was never defined — language.js may have failed to load.')
      alert('Review dialog unavailable — language.js failed to load. See console.')
    }
  }
});


