import {computeIfAbsent, range, schedule, uuid} from './data-structures.js';
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

// Console-tap: mirror console.* into an in-memory ring buffer so the
// in-app Log Viewer can show what would otherwise only be visible in
// DevTools (which we can't open on mobile). Kept tiny — 500 entries —
// to bound memory. Each entry is { t, level, args } where args is the
// already-stringified message so we don't hold live references.
window.__logBuffer = window.__logBuffer || []
const LOG_BUFFER_MAX = 500
function _serializeLogArg(a) {
  if (a instanceof Error) return a.stack || (a.name + ': ' + a.message)
  if (typeof a === 'string') return a
  try { return JSON.stringify(a) } catch (_) { return String(a) }
}
;['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
  const orig = console[level] ? console[level].bind(console) : null
  console[level] = function (...args) {
    try {
      window.__logBuffer.push({
        t: Date.now(),
        level,
        msg: args.map(_serializeLogArg).join(' ')
      })
      if (window.__logBuffer.length > LOG_BUFFER_MAX) {
        window.__logBuffer.splice(0, window.__logBuffer.length - LOG_BUFFER_MAX)
      }
    } catch (_) {}
    if (orig) orig(...args)
  }
})
// Surface uncaught errors and unhandled promise rejections too —
// these are the ones a mobile user most needs to see and can't.
window.addEventListener('error', (e) => {
  try {
    window.__logBuffer.push({
      t: Date.now(),
      level: 'error',
      msg: '[window.error] ' + (e.message || e.type) +
        (e.filename ? ` @ ${e.filename}:${e.lineno}:${e.colno}` : '') +
        (e.error && e.error.stack ? '\n' + e.error.stack : '')
    })
  } catch (_) {}
})
window.addEventListener('unhandledrejection', (e) => {
  try {
    const r = e.reason
    window.__logBuffer.push({
      t: Date.now(),
      level: 'error',
      msg: '[unhandledrejection] ' + (r && r.stack ? r.stack : _serializeLogArg(r))
    })
  } catch (_) {}
})

const SEPARATOR_PIPE = '|'
window.onbeforeunload = function (event) {
  if (window.dontConfirmOnRefresh) {
    return null
  }
  return confirm("Confirm refresh");
};

window.addEventListener('filterData', (e) => {
  $('#saveRevisionBtn').show();
  // Save/Play-starred visibility is driven by whether any line is starred —
  // see _updateStarredLinesBtns(). Don't force them visible here.
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
  // Auth is handled out-of-band (e.g. Flutter GitHubProxy), so suppress the
  // in-page PAT prompt for the rest of this session.
  window._suppressGHTokenPrompt = true
  try {
    bufferCapturedSubtitle(e.detail)
  } catch (err) {
    console.error('Failed to buffer capturedSubtitle', err)
  }
});

function getExpansionForWords() {
  const list = ``

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
  showMediaRelatedContainer()
  showMediaContainer()
  if (window.playingYoutubeVideo) {
    window.ytPlayer.playVideo()
  } else if (window.playingAudio) {
    audioPlayer.play()
  } else if (window.playingVideo) {
    videoPlayer.play()
  }
}

// Swapping the YouTube iframe src often triggers autoplay. When we only want
// to *load* the video (user starts it manually via the Play button), poll the
// player for a short window and pause it as soon as it starts playing.
function _suppressYoutubeAutoplay() {
  const deadline = Date.now() + 3000
  const tick = () => {
    try {
      if (window.ytPlayer && typeof window.ytPlayer.getPlayerState === 'function') {
        // 1 = playing, 3 = buffering -> force back to paused
        const st = window.ytPlayer.getPlayerState()
        if (st === 1 || st === 3) window.ytPlayer.pauseVideo()
      }
    } catch (_) {}
    if (Date.now() < deadline) setTimeout(tick, 150)
  }
  setTimeout(tick, 150)
}

// Start playback of the currently selected media (used by the "Play" button).
// Selecting media via #mp3Choice intentionally does NOT load subtitles — the
// user only sees Play Starred / Practice Starred (which lazy-load on demand)
// until they explicitly press Play. At that point we run the full load:
// playNewMedia fetches the SRT, parses it via storeSubtitles, and starts the
// video. clearSubtitles inside playNewMedia wipes window.starredLines, so we
// re-fetch them afterwards to keep the Save / Play Starred buttons accurate.
async function playSelectedMedia() {
  const sel = window.mediaSelected || {}
  if (!sel.link) { playMedia(); return }
  try {
    await playNewMedia(sel.link, sel.source || 'link', null, true)
  } catch (e) {
    console.warn('playSelectedMedia: playNewMedia failed', e)
    playMedia()
  }
  try { await loadStarredLines(sel.link, 'youtube') } catch (_) {}
}
window.playSelectedMedia = playSelectedMedia

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
  // Canonical shape: array of search strings. An older code path defaulted
  // to `{}` here, which broke `saveSearch` (calls .includes / .push) every
  // time the user searched on a fresh device. Migrate any legacy object
  // shape on read so old localStorage values still load.
  try {
    const v = JSON.parse(localStorage.getItem('searches') || '[]')
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') return Object.keys(v)
    return []
  } catch (_) {
    return []
  }
}

function saveSearchesIntoStorage(searches) {
  localStorage.setItem('searches', JSON.stringify(searches))
}

function exportSearches() {
  const searches = getSearchesFromStorage()
  export2txt(searches.join("\n"), "searches.txt");
  $('#toggleSearchesControlCheckbox').click()
}

function importSearches() {
  $("#import-dialog").dialog()
}

// --- Rare / unused vocabulary finder -------------------------------------
// Scans every vocabulary line against all loaded subtitles and lists the
// ones that appear in fewer than the chosen number of subtitles (a threshold
// of 1 means "never matched anywhere"). Results are paginated; clicking a
// word runs it through the main search box.
window._rareWords = window._rareWords || []
window._rareWordsPage = 0
window._rareWordsScanToken = 0
const RARE_WORDS_PAGE_SIZE = 60

function openRareWordsDialog() {
  // Hide the minimize-restore pill if it's lingering — opening the dialog
  // implicitly restores it.
  $('#rareWordsRestorePill').css('display', 'none')
  const $dlg = $('#rareWordsDialog')
  const opts = {
    width: Math.min(560, $(window).width() - 24),
    modal: false,
    open: function () {
      // jQuery UI auto-focuses the first tabbable element (the threshold
      // number input), which pops up the on-screen keyboard on mobile.
      // Move focus to the dialog wrapper instead so no keyboard appears.
      $(this).closest('.ui-dialog').attr('tabindex', -1).trigger('focus')
    }
  }
  // If the dialog widget has already been initialized (true on every call
  // after the first — including a restore-from-pill), `.dialog({options})`
  // only updates options without opening. Explicitly call .dialog('open')
  // to bring it back. The first call has to use the {options} form to
  // initialize the widget; subsequent calls take the open() branch.
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', opts).dialog('open')
  } else {
    $dlg.dialog(opts)
  }
}
window.openRareWordsDialog = openRareWordsDialog

async function scanRareWords() {
  if (!window._subtitlesLoaded || !window.vocabulary) {
    $('#rareWordsStatus').text('Subtitles/vocabulary still loading…')
    return
  }
  const threshold = Math.max(1, parseInt($('#rareWordsThreshold').val(), 10) || 1)
  const token = ++window._rareWordsScanToken

  // Precompute cleaned subtitle text once per scan (sv + en kept separate so a
  // word counts as "present" when it appears in either, mirroring the main
  // search's file-level filter).
  const subs = Object.values(window.allSubtitles || {})
    .filter(s => s && (s.sv || s.en))
    .map(s => ({
      sv: s.sv ? _cleanSrtForMatch(s.sv) : '',
      en: s.en ? _cleanSrtForMatch(s.en) : ''
    }))

  // Flatten vocabulary into unique lines (keep first category seen).
  // Skip very short lines outright — single/double-char tokens are almost
  // always function words ("se", "ha", "be", "i") that appear everywhere
  // and bring no signal to the rare-words list.
  const MIN_LINE_LEN = 3
  const seen = new Map()
  Object.entries(window.vocabulary || {}).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return
    lines.forEach(line => {
      const l = (line || '').trim()
      if (l.length < MIN_LINE_LEN) return
      if (!seen.has(l)) seen.set(l, cat)
    })
  })
  const entries = Array.from(seen.entries()) // [line, category]

  const found = []
  const total = entries.length
  $('#rareWordsProgress').show()
  $('#rareWordsProgressFill').css('width', '0%')
  $('#rareWordsScanBtn').prop('disabled', true)
  $('#rareWordsStatus').text(`Scanning ${total} words…`)

  // Time-sliced so the main thread is never held longer than SLICE_MS at a
  // stretch — the scan stays fully non-blocking no matter how big the
  // vocabulary / subtitle set is. We yield on a time budget rather than a
  // fixed word count because per-word cost varies wildly (a rare word scans
  // every subtitle; a common one early-exits almost immediately).
  const yieldToUI = () => new Promise(r => setTimeout(r, 0))
  const SLICE_MS = 25
  const now = () => (window.performance && performance.now) ? performance.now() : Date.now()
  let lastYield = now()
  // Per-alternative minimum length. The vocab uses `|` to list alternatives
  // for a concept; some entries include very short forms ("lev" alongside
  // "leva|lever|levde", " be " alongside "lyssna|höra") that, when fed into
  // the alternation regex below, swallow the line by matching as substrings
  // of unrelated words (lev → "level", "love", "alleviate", …). Drop those
  // short alternatives from the regex so they don't drag the whole line out
  // of the rare list.
  const MIN_ALT_LEN = 3
  for (let i = 0; i < total; i++) {
    if (token !== window._rareWordsScanToken) { $('#rareWordsScanBtn').prop('disabled', false); return }
    const [line, cat] = entries[i]
    let re
    try {
      const expanded = expandWords(line, getLangFromUrl().code)
      // Drop alternatives shorter than MIN_ALT_LEN before composing the
      // final regex. Preserve the existing _relaxSpaces step (run on the
      // already-stripped string) so multi-word alternatives still match
      // across whitespace.
      const stripped = String(expanded || '')
        .split(SEPARATOR_PIPE)
        .filter(p => p.trim().length >= MIN_ALT_LEN)
        .join(SEPARATOR_PIPE)
      if (!stripped) { /* nothing left to test against; treat as absent */ continue }
      const relaxed = _relaxSpaces(stripped)
      // The original regex lacked word boundaries, so a normal-length form
      // like "fanatisk" matched every subtitle containing "fanatiskt" /
      // "fanatiska" — counted as covered when the exact form is absent.
      // Anchor with Unicode boundary lookarounds so a hit requires real
      // word edges. \b is ASCII-only (treats å/ä/ö as boundaries), so we
      // use [\p{L}\p{N}] lookarounds with /u instead.
      try {
        re = new RegExp('(?<![\\p{L}\\p{N}])(?:' + relaxed + ')(?![\\p{L}\\p{N}])', 'iu')
      } catch (eU) {
        // Pattern can't be promoted to Unicode mode (vocab line contains a
        // /u-unsafe construct). Fall back to the unanchored regex so we
        // still produce a signal for the line rather than zero-matching it.
        re = new RegExp(relaxed, 'i')
      }
    } catch (e) { re = null }
    if (re) {
      let count = 0
      for (const sub of subs) {
        if ((sub.sv && re.test(sub.sv)) || (sub.en && re.test(sub.en))) {
          count++
          if (count >= threshold) break // can't be "fewer than threshold" any more
        }
      }
      if (count < threshold) found.push({ line, category: cat, count })
    }
    if (now() - lastYield > SLICE_MS) {
      $('#rareWordsProgressFill').css('width', `${Math.round(((i + 1) / total) * 100)}%`)
      await yieldToUI()
      if (token !== window._rareWordsScanToken) { $('#rareWordsScanBtn').prop('disabled', false); return }
      lastYield = now()
    }
  }

  found.sort((a, b) => (a.count - b.count) || a.line.localeCompare(b.line))
  window._rareWords = found
  window._rareWordsPage = 0
  $('#rareWordsProgress').hide()
  $('#rareWordsScanBtn').prop('disabled', false)
  $('#rareWordsStatus').text(`${found.length} word(s) match in fewer than ${threshold} subtitle(s).`)
  // Refresh the per-category filter with the categories actually seen in
  // this scan's results. Keep the previous selection if it still applies.
  _populateRareWordsCategoryFilter(found)
  _renderRareWordsPage()
}
window.scanRareWords = scanRareWords

// Build the Category dropdown from the categories present in `found`. Items
// are grouped by category, so the user can drill into one slice at a time.
function _populateRareWordsCategoryFilter(found) {
  const $sel = $('#rareWordsCategory')
  if (!$sel.length) return
  const prev = $sel.val() || ''
  const counts = {}
  ;(found || []).forEach(it => { counts[it.category || ''] = (counts[it.category || ''] || 0) + 1 })
  const cats = Object.keys(counts).sort((a, b) => a.localeCompare(b))
  $sel.empty()
  $sel.append(`<option value="">All categories (${(found || []).length})</option>`)
  cats.forEach(c => {
    $sel.append(`<option value="${_.escape(c)}">${_.escape(c || '(uncategorised)')} — ${counts[c]}</option>`)
  })
  // Restore previous selection if still valid; else default to "all".
  if (cats.indexOf(prev) >= 0) $sel.val(prev); else $sel.val('')
}
// Re-render the list when the category filter changes.
$(function () {
  $(document).on('change', '#rareWordsCategory', function () {
    window._rareWordsPage = 0
    _renderRareWordsPage()
  })
})

function _renderRareWordsPage() {
  const raw = window._rareWords || []
  const catFilter = ($('#rareWordsCategory').val() || '').trim()
  // Filter to the selected category, if any. Empty value = no filter.
  const all = catFilter ? raw.filter(it => (it.category || '') === catFilter) : raw
  const pageSize = RARE_WORDS_PAGE_SIZE
  const pages = Math.max(1, Math.ceil(all.length / pageSize))
  const page = Math.min(window._rareWordsPage || 0, pages - 1)
  window._rareWordsPage = page
  const slice = all.slice(page * pageSize, page * pageSize + pageSize)

  const $list = $('#rareWordsResults').empty()
  if (!raw.length) {
    $list.html('<div class="rare-words-empty">Nothing to show yet — set a threshold and click Scan.</div>')
    $('#rareWordsPager').empty()
    return
  }
  if (!all.length) {
    $list.html('<div class="rare-words-empty">No matches in this category.</div>')
    $('#rareWordsPager').empty()
    return
  }
  // When no category filter, group by category with sticky-ish headers so
  // the user can scan groups even without filtering. With a filter active
  // the list is already homogenous — skip the headers for a flatter view.
  let currentCat = null
  slice.forEach(it => {
    if (!catFilter && it.category !== currentCat) {
      currentCat = it.category
      const $hdr = $('<div class="rare-words-cat-hdr"></div>')
        .text(currentCat || '(uncategorised)')
      $list.append($hdr)
    }
    const $row = $('<button type="button" class="rare-word-item"></button>')
    $row.attr('title', `${it.line} — ${it.count} match(es) · ${it.category}`)
    $row.append($('<span class="rare-word-text"></span>').text(it.line))
    $row.append($('<span class="rare-word-count"></span>').text(it.count))
    $row.on('click', () => rareWordSearch(it.line))
    $list.append($row)
  })

  const $pager = $('#rareWordsPager').empty()
  if (pages > 1) {
    // stopPropagation: this handler re-renders and detaches the clicked
    // button before the click bubbles to the document-level outside-click
    // handler (~L1877). Without it, the orphaned target reads as "outside
    // the dialog" and the dialog gets closed. Mirrors the $loadMore fix.
    const $prev = $('<button type="button" class="lang-tool-btn">‹ Prev</button>')
      .prop('disabled', page === 0)
      .on('click', e => { e.stopPropagation(); window._rareWordsPage = page - 1; _renderRareWordsPage() })
    const $next = $('<button type="button" class="lang-tool-btn">Next ›</button>')
      .prop('disabled', page >= pages - 1)
      .on('click', e => { e.stopPropagation(); window._rareWordsPage = page + 1; _renderRareWordsPage() })
    $pager.append($prev)
    $pager.append($(`<span class="rare-words-pageinfo">Page ${page + 1} / ${pages}</span>`))
    $pager.append($next)
  }
}

// Run a rare-word click through the main search box (mirrors vocabularyLineSelected).
// The dialog is minimized (not closed) so the user can keep scanning more rare
// words after seeing this one's results — the pager position, category filter,
// and the whole result list are preserved, and a small restore pill brings
// the full dialog back in one click.
function rareWordSearch(line) {
  window.forceMainLangForNextSearch = true
  window.unprocessedSearchText = line
  window.searchText = expandWords(line, getLangFromUrl().code)
  $('#searchText').val(line).trigger('input')
  try { _minimizeRareWordsDialog() } catch (_) {}
  doSearch(window.searchText, null)
}
window.rareWordSearch = rareWordSearch

// Hide the rare-words dialog (state preserved by jQuery UI's close) and show
// a compact restore pill so the user can resume scanning where they left off.
// Mirrors the pattern used by the play overlay's restore pill.
function _minimizeRareWordsDialog() {
  try { $('#rareWordsDialog').dialog('close') } catch (_) {}
  let $pill = $('#rareWordsRestorePill')
  if (!$pill.length) {
    $pill = $(`<div id="rareWordsRestorePill" role="button" tabindex="0" title="Restore rare words dialog">
      <span class="rare-pill-icon" aria-hidden="true">🔎</span>
      <span class="rare-pill-label">Rare words</span>
      <button type="button" class="rare-pill-close" aria-label="Close">✕</button>
    </div>`).appendTo('body')
    $pill.on('click', function (e) {
      if ($(e.target).closest('.rare-pill-close').length) return
      // Stop propagation — the document-level outside-click handler at
      // L2086 closes any visible non-whitelisted dialog, and the rare-words
      // dialog isn't on that list. Without this, the click would re-open
      // the dialog and then immediately close it back.
      e.stopPropagation()
      _restoreRareWordsDialog()
    })
    $pill.on('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        _restoreRareWordsDialog()
      }
    })
    $pill.on('click', '.rare-pill-close', function (e) {
      e.stopPropagation()
      $pill.css('display', 'none')
    })
  }
  // The pill is `display: none` by default in CSS; jQuery's .show() would
  // pick `block`, but the pill needs flex for its row layout. Set the
  // display value explicitly so the icon/label/close button align.
  $pill.css('display', 'inline-flex')
}

// Re-open the dialog and hide the pill. jQuery UI re-uses the underlying
// dialog instance, so result list, page, and category filter survive.
function _restoreRareWordsDialog() {
  $('#rareWordsRestorePill').css('display', 'none')
  try { openRareWordsDialog() } catch (_) {}
}
window._restoreRareWordsDialog = _restoreRareWordsDialog

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
  // Restore the pending-hint when reopening — staged-but-uncommitted
  // edits survive a dialog close (we no longer auto-commit on close).
  _refreshVocabPendingHint()

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

  // If Insert position is sticky on "inline" (e.g. from a prior session),
  // pre-fill the textarea with the chosen reference word so the user can
  // edit in place — matches the behaviour of switching to inline manually.
  try {
    const posSel = document.getElementById('vocabInsertPosition')
    if (posSel && posSel.value === 'inline') onVocabInsertPositionChange(posSel)
  } catch (_) {}

  // Closing the dialog does NOT commit to GitHub — only the explicit save
  // buttons do. Staged edits remain in window.vocabulary; reopening the
  // dialog restores the pending-hint and a later save commits them.
  const onDialogClose = () => {
    discardSegment()
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
    _wireVocabKeyboardScroll()
  }, 0)
}

// On mobile, the soft keyboard slides up from the bottom and shrinks the
// visible (visualViewport) area, so the textarea — which sits in the lower
// half of the dialog — ends up hidden under the keyboard. Re-anchor it on
// focus and again on visualViewport resize so the user can see what they're
// typing. Bound once per session; idempotent on repeated dialog opens.
let _vocabKeyboardScrollBound = false
function _wireVocabKeyboardScroll() {
  if (_vocabKeyboardScrollBound) return
  _vocabKeyboardScrollBound = true

  const scrollIntoView = () => {
    const el = document.getElementById('vocabularySegmentTextarea')
    if (!el || document.activeElement !== el) return
    // Slight delay so the visualViewport has finished resizing on iOS.
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch (_) {}
    }, 80)
  }

  $(document).on('focus', '#vocabularySegmentTextarea', scrollIntoView)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scrollIntoView)
  }
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
    // staged additions from earlier rounds, refresh the selects (we held
    // off during "Add another"), then commit and close.
    if (commitAndClose && window._vocabHasPendingChanges) {
      loadWholeVocabulary()
      commitVocabularyToGithub()
      window._vocabHasPendingChanges = false
      window._vocabPendingCount = 0
      _refreshVocabPendingHint()
      $("#addToVocabularyDialog").dialog("close")
      autoHideSettingsPanel()
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

  window._vocabHasPendingChanges = true
  // Bump the session-pending counter so the hint can show "N new entries".
  // Counts every newly-added word from THIS session (resets on commit).
  window._vocabPendingCount = (parseInt(window._vocabPendingCount, 10) || 0) + newWords.length
  // Buffer this category's post-edit snapshot to localStorage so an app
  // close/refresh before commit doesn't lose the user's work.
  if (!window._vocabDirtyCategories) window._vocabDirtyCategories = {}
  window._vocabDirtyCategories[category] = true
  _savePendingVocab()

  // Rebuild the selects so the in-dialog dropdowns reflect what's already
  // been staged this session — otherwise "Add another" leaves the picker
  // showing pre-edit state, which makes it look as if the entry didn't
  // land. GitHub push is still deferred until Save & Close.
  loadWholeVocabulary()
  if (commitAndClose) {
    commitVocabularyToGithub()
    window._vocabHasPendingChanges = false
    window._vocabPendingCount = 0
    _refreshVocabPendingHint()
    $("#addToVocabularyDialog").dialog("close")
    autoHideSettingsPanel()
  } else {
    // Stage-only: clear textarea and surface the pending-changes hint, but
    // leave the dialog open so the user can add more entries. The selects
    // were already refreshed above so the user sees their new entry in the
    // picker.
    $("#vocabularySegmentTextarea").val('')
    _refreshVocabPendingHint()
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

function vocabularyToText(vocab) {
  return Object.keys(vocab)
    .map(k => `#${k}\n${vocab[k].join("\n")}`).join("\n")
}

// Open the settings panel as a jQuery UI dialog. Reusing the existing
// #settingsPanel div lets us keep the inputs and their wiring intact —
// jQuery UI just relocates the element into a dialog wrapper on first
// open. Clicking the gear again closes the dialog (toggle).
function openSettingsDialog() {
  const $panel = $('#settingsPanel')
  if ($panel.hasClass('ui-dialog-content') && $panel.dialog('isOpen')) {
    $panel.dialog('close')
    return
  }
  // Don't clear the original `display:none` inline style here — jQuery
  // UI's .dialog() relocates the element into a wrapper and handles
  // visibility itself. Clearing it synchronously caused a one-frame
  // flash where the panel rendered inline before being moved.
  const w = Math.min(760, $(window).width() - 40)
  const opts = {
    title: 'Settings',
    width: w,
    modal: false,
    autoOpen: true,
    position: { my: 'center top', at: 'center top+20', of: window },
    // jQuery UI auto-focuses the first tabbable element — on mobile that's
    // typically the first <input> in the panel, which pops the on-screen
    // keyboard. Re-target focus to the dialog wrapper (non-editable) and
    // blur any input that already grabbed focus during the open sequence.
    open: function () {
      const $wrap = $(this).closest('.ui-dialog')
      const active = document.activeElement
      if (active && typeof active.blur === 'function') active.blur()
      if ($wrap.length) $wrap.attr('tabindex', '-1').focus()
    }
  }
  // Defer the open so the current click event finishes bubbling first.
  // Otherwise the document-level "close visible dialogs on outside click"
  // handler fires on this same click and immediately closes the dialog
  // we just opened. Same pattern as openAddToVocabDialog.
  setTimeout(() => {
    if ($panel.hasClass('ui-dialog-content')) {
      $panel.dialog('option', opts).dialog('open')
    } else {
      $panel.dialog(opts)
    }
  }, 0)
}
window.openSettingsDialog = openSettingsDialog

// ──────────────────────────────────────────────────────────────────────
// Build info + in-app Log Viewer
// ──────────────────────────────────────────────────────────────────────
// Show when /language.js was last modified on the server (HEAD request)
// plus the HTML's document.lastModified as a fallback / cross-check.
// Lets the user confirm a deploy actually shipped without opening DevTools.
function _fmtLocal(d) {
  try {
    return d.toLocaleString(undefined, { hour12: false })
  } catch (_) { return d.toISOString() }
}
async function populateBuildInfo() {
  const $el = $('#buildInfo')
  if (!$el.length) return
  const htmlLM = document.lastModified ? new Date(document.lastModified) : null
  let jsLM = null
  try {
    const r = await fetch('/language.js', { method: 'HEAD', cache: 'no-cache' })
    const h = r.headers.get('Last-Modified')
    if (h) jsLM = new Date(h)
  } catch (_) {}
  const jsTxt   = jsLM   ? `js ${_fmtLocal(jsLM)}`   : null
  const htmlTxt = htmlLM ? `html ${_fmtLocal(htmlLM)}` : null
  const parts = [jsTxt, htmlTxt].filter(Boolean)
  $el.text(parts.length ? 'Built: ' + parts.join(' · ') : 'Built: unknown')
}
window.populateBuildInfo = populateBuildInfo

function _renderLogViewer() {
  const $body  = $('#logViewerBody')
  if (!$body.length) return
  const level  = $('#logViewerLevel').val() || 'all'
  const q      = ($('#logViewerSearch').val() || '').toLowerCase()
  const order  = { error: 0, warn: 1, info: 2, log: 3, debug: 4 }
  const minOrd = level === 'all' ? 99 : order[level]
  const rows = (window.__logBuffer || []).filter(e => {
    if (level !== 'all' && (order[e.level] ?? 99) > minOrd) return false
    if (q && !e.msg.toLowerCase().includes(q)) return false
    return true
  })
  // Build with DOM rather than innerHTML to avoid an XSS-ish surprise
  // if a log message contains markup.
  $body.empty()
  rows.forEach(e => {
    const ts = new Date(e.t).toISOString().substring(11, 23)
    const line = document.createElement('span')
    line.className = 'log-line'
    line.setAttribute('data-level', e.level)
    const tsSpan = document.createElement('span')
    tsSpan.className = 'log-ts'
    tsSpan.textContent = ts
    const lvSpan = document.createElement('span')
    lvSpan.className = 'log-level'
    lvSpan.textContent = e.level
    const msgSpan = document.createElement('span')
    msgSpan.className = 'log-msg'
    msgSpan.textContent = e.msg
    line.appendChild(tsSpan)
    line.appendChild(lvSpan)
    line.appendChild(msgSpan)
    $body.append(line)
  })
  // Auto-scroll to bottom — newest entries are most relevant.
  const el = $body[0]
  if (el) el.scrollTop = el.scrollHeight
}

let _logViewerInterval = null
function openLogViewer() {
  // Close the settings dialog so the log viewer isn't competing for screen
  // real estate on mobile. The gear button re-opens settings.
  try { autoHideSettingsPanel() } catch (_) {}
  const $dlg = $('#logViewerDialog')
  if (!$dlg.length) { alert('Log viewer DOM is missing'); return }
  const winW = $(window).width(), winH = $(window).height()
  const opts = {
    title: 'Logs',
    width: Math.min(820, winW - 20),
    height: Math.min(640, winH - 20),
    modal: false,
    autoOpen: true,
    position: { my: 'center top', at: 'center top+10', of: window },
    close: function () {
      if (_logViewerInterval) { clearInterval(_logViewerInterval); _logViewerInterval = null }
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', opts).dialog('open')
  } else {
    $dlg.dialog(opts)
    // Wire toolbar once — jQuery UI keeps the same DOM across opens.
    $('#logViewerLevel, #logViewerSearch').on('input change', _renderLogViewer)
    $('#logViewerCopy').on('click', async () => {
      const text = (window.__logBuffer || []).map(e =>
        `${new Date(e.t).toISOString()} [${e.level}] ${e.msg}`
      ).join('\n')
      try {
        await navigator.clipboard.writeText(text)
        $('#logViewerCopy').text('Copied').delay(900).queue(function (n) { $(this).text('Copy'); n() })
      } catch (_) {
        // Clipboard API blocked (no HTTPS / no gesture chain): fall back to
        // selecting the body so the user can long-press → copy on mobile.
        const el = $('#logViewerBody')[0]
        if (el) {
          const r = document.createRange(); r.selectNodeContents(el)
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
          alert('Clipboard blocked — text is selected, long-press to copy.')
        }
      }
    })
    $('#logViewerClear').on('click', () => {
      window.__logBuffer.length = 0
      _renderLogViewer()
    })
  }
  _renderLogViewer()
  if ($('#logViewerAutoRefresh').is(':checked')) {
    if (_logViewerInterval) clearInterval(_logViewerInterval)
    _logViewerInterval = setInterval(_renderLogViewer, 1000)
  }
}
window.openLogViewer = openLogViewer

// Populate Built info once the DOM is ready (independent of any user
// action so the value is visible as soon as Settings is first opened).
$(function () { try { populateBuildInfo() } catch (_) {} })

// Close the settings dialog after a completed action (save dictionary,
// save starred lines, etc.) so it doesn't linger on top of the results.
// The gear button re-opens it on demand.
function autoHideSettingsPanel() {
  const $panel = $('#settingsPanel')
  if ($panel.hasClass('ui-dialog-content') && $panel.dialog('isOpen')) {
    $panel.dialog('close')
  }
}
window.autoHideSettingsPanel = autoHideSettingsPanel

// Generic read-merge-conditional-put-retry for any file on
// trexsatya/trexsatya.github.io@gh-pages. The merge callback receives the
// real-time remote content (or null if the file doesn't exist) and returns
// the text we want committed. If GitHub rejects the PUT because someone
// else updated the file between our read and write (409/422 on sha), we
// re-read and re-merge — so the caller's merge function MUST be safe to
// re-run with a different `remoteText`.
async function commitWithMerge({ filePath, branch = 'gh-pages', commitMessage, merge, maxAttempts = 5 }) {
  const owner = 'trexsatya'
  const repo = 'trexsatya.github.io'
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let remoteContent = null
    let sha
    try {
      const file = await window.GitHubUtils.getFile(owner, repo, filePath, '', branch)
      remoteContent = file.content
      sha = file.sha
    } catch (_) {
      // File doesn't exist on remote yet — we'll create it.
    }
    const merged = await merge(remoteContent)
    if (merged === null || merged === undefined) {
      throw new Error(`commitWithMerge: merge returned no content for ${filePath}`)
    }
    try {
      await window.GitHubUtils.putFile(owner, repo, filePath, merged, commitMessage, sha, '', branch)
      return merged
    } catch (e) {
      lastErr = e
      // GitHub returns 409 (sha mismatch / conflict) or 422 (stale sha)
      // when another writer beat us to it. Re-read and retry.
      if (attempt < maxAttempts - 1 && /GitHub API error (409|422)\b/.test(String(e && e.message))) {
        console.warn(`commitWithMerge: conflict on ${filePath}, retrying (${attempt + 2}/${maxAttempts})`)
        continue
      }
      throw e
    }
  }
  throw lastErr || new Error(`commitWithMerge: exhausted retries on ${filePath}`)
}

// 3-way merge of categorised vocab files. base = text we loaded, localVocab =
// in-memory current state, remoteText = latest from api.github.com. Lines
// added locally are kept; lines removed locally (in base, absent in local)
// are dropped; remote-only additions are appended; remote-only deletions
// (in base, absent in remote, unchanged locally) are also dropped.
function mergeVocabulary(baseText, localVocab, remoteText) {
  const base = parseVocabularyFile(baseText || '#__empty__\n')
  const remote = parseVocabularyFile(remoteText || '#__empty__\n')
  const local = localVocab || {}
  const merged = {}
  const allCats = new Set([
    ...Object.keys(base),
    ...Object.keys(remote),
    ...Object.keys(local)
  ])
  for (const cat of allCats) {
    if (cat === '__empty__') continue
    const baseLines = base[cat] || []
    const remoteLines = remote[cat] || []
    const localLines = local[cat] || []
    const baseSet = new Set(baseLines)
    const remoteSet = new Set(remoteLines)
    const localSet = new Set(localLines)

    const out = []
    const seen = new Set()
    // Local order first: keep user-added lines and base lines still on remote;
    // drop base lines the remote has removed (we didn't intentionally re-add them).
    for (const l of localLines) {
      const userAdded = !baseSet.has(l)
      const stillInRemote = remoteSet.has(l)
      if ((userAdded || stillInRemote) && !seen.has(l)) {
        seen.add(l); out.push(l)
      }
    }
    // Then append remote-only additions, skipping ones we intentionally removed.
    for (const l of remoteLines) {
      if (seen.has(l)) continue
      const removedLocally = baseSet.has(l) && !localSet.has(l)
      if (!removedLocally) { seen.add(l); out.push(l) }
    }
    merged[cat] = out
  }
  return merged
}

async function commitVocabularyToGithub() {
  const lang = getLangFromUrl()
  const filePath = `db/language/${lang.fullName}/vocabulary.txt`
  const baselineText = window._vocabularyBaselineText || ''
  const localVocab = window.vocabulary

  try {
    const finalText = await commitWithMerge({
      filePath,
      commitMessage: 'vocab: update vocabulary via language tool',
      merge: (remoteText) => {
        const merged = mergeVocabulary(baselineText, localVocab, remoteText || '')
        return vocabularyToText(merged)
      }
    })
    // Adopt what we just pushed as the new baseline + UI state. The
    // pending-edit buffer is now stale (everything we cached is on remote);
    // drop it so a future page-load doesn't re-apply the same edits.
    window.vocabulary = parseVocabularyFile(finalText)
    window._vocabularyBaselineText = finalText
    _clearPendingVocab()
    console.log('Vocabulary committed to GitHub')
  } catch (e) {
    console.error('Failed to commit vocabulary to GitHub:', e)
    alert('Saved in memory but GitHub commit failed: ' + e.message)
  }
}

// ─── Unpushed vocab buffer (parallel to pendingSrtEdits) ─────────────────
// Captures every locally-modified category so the user doesn't lose
// uncommitted edits if they close the tab before the next sync. On boot
// we replay the buffer onto the freshly-fetched remote vocabulary; on a
// successful commit we drop it. The buffer is keyed by language so opening
// a different language tab doesn't replay foreign categories.
const PENDING_VOCAB_KEY = 'cupitor:pendingVocab'
function _loadPendingVocab() {
  try {
    const raw = localStorage.getItem(PENDING_VOCAB_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object' || !obj.categories) return null
    return obj
  } catch (_) { return null }
}
function _savePendingVocab() {
  try {
    const dirty = window._vocabDirtyCategories || {}
    const dirtyNames = Object.keys(dirty)
    if (!dirtyNames.length || !window.vocabulary) {
      localStorage.removeItem(PENDING_VOCAB_KEY)
      return
    }
    const categories = {}
    dirtyNames.forEach(cat => {
      if (Array.isArray(window.vocabulary[cat])) {
        categories[cat] = window.vocabulary[cat].slice()
      }
    })
    if (!Object.keys(categories).length) {
      localStorage.removeItem(PENDING_VOCAB_KEY)
      return
    }
    const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || ''
    localStorage.setItem(PENDING_VOCAB_KEY, JSON.stringify({ lang, categories, ts: Date.now() }))
  } catch (_) {}
}
function _clearPendingVocab() {
  try { localStorage.removeItem(PENDING_VOCAB_KEY) } catch (_) {}
  window._vocabDirtyCategories = {}
  window._vocabHasPendingChanges = false
  window._vocabPendingCount = 0
  _refreshVocabPendingHint()
}

// Re-render the in-dialog "unsaved changes pending" hint with the current
// pending-entry count. Counter is in-session only — added-lines since the
// last commit, reset on Save & Close. Falls back to a count-less message
// when no count is known (e.g. categories replayed from localStorage on
// boot).
function _refreshVocabPendingHint() {
  const $h = $('#vocabPendingHint')
  if (!$h.length) return
  if (!window._vocabHasPendingChanges) { $h.hide(); return }
  const n = parseInt(window._vocabPendingCount, 10) || 0
  const countPart = n > 0 ? ` — ${n} new entr${n === 1 ? 'y' : 'ies'}` : ''
  $h.text(`unsaved changes pending${countPart} — Save & Close to commit`).show()
}
// Called once after the initial vocabulary fetch parses into window.vocabulary.
// Replays any locally-cached category snapshots so the user's unpushed work
// is back in memory + visible in the UI ready for another Sync.
function _replayPendingVocab() {
  const buf = _loadPendingVocab()
  if (!buf || !buf.categories) return
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || ''
  if (buf.lang && buf.lang !== lang) return
  if (!window.vocabulary) window.vocabulary = {}
  if (!window._vocabDirtyCategories) window._vocabDirtyCategories = {}
  const cats = Object.keys(buf.categories)
  let any = 0
  cats.forEach(cat => {
    if (Array.isArray(buf.categories[cat])) {
      window.vocabulary[cat] = buf.categories[cat]
      window._vocabDirtyCategories[cat] = true
      any++
    }
  })
  if (any) {
    window._vocabHasPendingChanges = true
    // The number of *added entries* isn't recoverable from a localStorage
    // snapshot (we'd need the pre-edit baseline to compute it). Leave the
    // count at 0 so the hint just says "unsaved changes pending" without
    // a misleading number.
    window._vocabPendingCount = 0
    _refreshVocabPendingHint()
    console.log(`Replayed ${any} pending vocab categor${any === 1 ? 'y' : 'ies'} from local cache — push via Save & Close to sync.`)
  }
}
window._replayPendingVocab = _replayPendingVocab

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

// Storage shape: Array<string | { t: string, l: 'en' }>. Plain strings are
// main-language (sv) searches — keeping them as bare strings preserves
// backward compatibility with previously-saved history AND saves ~10 bytes
// per entry vs an object wrapper. Objects only appear for non-main langs.
function _normLangFor(lang) {
  return lang === 'en' ? 'en' : null
}
function _historyEntryTerm(entry) {
  return (typeof entry === 'string') ? entry : (entry && entry.t) || null
}
function _historyEntryLang(entry) {
  return (typeof entry === 'string') ? null : ((entry && entry.l) || null)
}

function loadNavHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(SEARCH_NAV_HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(it =>
      typeof it === 'string' ||
      (it && typeof it === 'object' && typeof it.t === 'string')
    )
  } catch (e) { return [] }
}

function saveNavHistoryToStorage(list) {
  try { localStorage.setItem(SEARCH_NAV_HISTORY_KEY, JSON.stringify(list)) } catch (e) {}
}

window.sessionSearchHistory = window.sessionSearchHistory || loadNavHistoryFromStorage()
// Always start at -1 on a fresh page load: the user isn't "on" any past
// entry, so the first Prev should go to the most recent entry.
if (typeof window.sessionHistoryIndex !== 'number') window.sessionHistoryIndex = -1

function recordSessionSearch(term, lang) {
  if (window._navigatingHistory) return
  if (typeof term !== 'string') return
  term = term.trim()
  if (!term) return
  const normLang = _normLangFor(lang)
  const entry = normLang ? { t: term, l: normLang } : term
  const list = window.sessionSearchHistory
  const last = list[list.length - 1]
  if (_historyEntryTerm(last) === term && _historyEntryLang(last) === normLang) return
  list.push(entry)
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
  const entry = list[newIdx]
  const term = _historyEntryTerm(entry)
  const lang = _historyEntryLang(entry)
  if (typeof term !== 'string' || !term) return
  window._navigatingHistory = true
  // Replay in the language the search was originally in, regardless of the
  // current UI toggle. Cleared in fetchSRTs's finally block.
  window.forceLangForNextSearch = lang === 'en' ? 'en' : 'sv'
  // Sync the toggle visually so the user can see which language the replayed
  // search is in (prop() without trigger doesn't fire the change handler, so
  // no double-search). After forceLang is cleared, the next typed search
  // will follow this toggle position, which matches user intent.
  $('#toggleLangCb').prop('checked', lang === 'en')
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
  // Optional auto-prefix-search: when the toggle in the settings panel is
  // on (default), run a vocabulary prefix search on the same term so the
  // user doesn't have to click the "…" → "Search by prefix" menu item.
  if ($('#toggleAutoPrefixSearchCheckbox').is(':checked')) {
    try { searchVocabularyByPrefix() } catch (e) { console.warn('Auto prefix search failed', e) }
  }
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

// Resolves once loadAllSubtitles has finished — the parallel SRT fetches
// plus vocabulary / app-settings load. Hard-capped with a timeout so a
// hung network never freezes searches indefinitely.
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

// Apply `fn` to each item with a bounded concurrency window. Used for the
// initial SRT load so Chrome doesn't choke on hundreds of simultaneous
// fetches (net::ERR_INSUFFICIENT_RESOURCES). Each item's promise is fully
// settled (success or failure swallowed by the caller) before the slot is
// reused, so a single slow / hung fetch can't starve the rest if it has
// its own per-call timeout — which `_withTimeout` provides upstream.
// Boot-time SRT progress banner. With the index running into the hundreds,
// the parallel-but-bounded loader can take 10+ seconds; without UI the user
// thinks the page is frozen. Banner appears at the top of the viewport,
// updates as each SRT pair settles, and auto-hides on completion.
function _srtProgressShow(total) {
  let $b = $('#srtLoadingBanner')
  if (!$b.length) {
    $b = $(`<div id="srtLoadingBanner">
      <span id="srtLoadingText">Loading subtitles 0 / ${total}…</span>
      <div class="srt-loading-track"><span id="srtLoadingFill"></span></div>
    </div>`).appendTo('body')
  }
  $('#srtLoadingText').text(`Loading subtitles 0 / ${total}…`)
  $('#srtLoadingFill').css('width', '0%')
  $b.show()
}
function _srtProgressUpdate(done, total) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  $('#srtLoadingFill').css('width', pct + '%')
  $('#srtLoadingText').text(`Loading subtitles ${done} / ${total}… (${pct}%)`)
}
function _srtProgressHide() {
  // Briefly show 100% before hiding so the user gets a confirmation flash.
  $('#srtLoadingFill').css('width', '100%')
  $('#srtLoadingText').text('Subtitles loaded')
  setTimeout(() => $('#srtLoadingBanner').fadeOut(400), 600)
}

async function _runInBatches(items, fn, concurrency = 8, onProgress) {
  if (!Array.isArray(items) || !items.length) return []
  const total = items.length
  const results = new Array(total)
  let next = 0
  let done = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= total) return
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) }
      } catch (e) {
        results[i] = { status: 'rejected', reason: e }
      }
      done++
      if (typeof onProgress === 'function') {
        try { onProgress(done, total) } catch (_) {}
      }
    }
  }
  const lanes = Math.max(1, Math.min(concurrency, total))
  await Promise.all(Array.from({ length: lanes }, () => worker()))
  return results
}

// Retry a fetch up to `tries` times with exponential backoff and a per-attempt
// timeout. Used for the boot-critical fetches (srts/index.json, vocabulary.txt)
// because raw.githubusercontent.com occasionally returns 5xx / empty bodies on
// the very first hit after a deploy — a single failure currently strands the
// whole app with no data.
// Force NFC normalization on any string that goes into a GitHub SRT path or
// gets stored in window.srts / index.json. Without this, captured filenames
// can drift between NFC ("å" precomposed) and NFD ("a"+◌̊ decomposed) — git
// treats them as different paths, so the same SRT ends up on remote twice
// and the local working tree fights with the index. macOS APFS is the usual
// culprit; YouTube metadata strings come in NFC, native filesystem ops can
// surface them as NFD on read. Normalizing to NFC at every boundary makes
// the storage layer monomorphic.
function _nfc(s) {
  return String(s == null ? '' : s).normalize('NFC')
}

async function _fetchWithRetry(url, { tries = 4, timeoutMs = 12000, init = {} } = {}) {
  // raw.githubusercontent.com sends Cache-Control on error responses too, so
  // Chrome will cheerfully serve a stale 429 / 5xx from disk cache for the next
  // few minutes and never re-ask the server — fatal during boot. Two defenses:
  //   1) cache: 'no-store' on every attempt so the browser doesn't consult the
  //      disk cache in the first place.
  //   2) ?_cb=<random> appended on each retry as a belt-and-braces cache-buster
  //      in case an intermediary (CDN, service worker) ignores no-store.
  const baseInit = { cache: 'no-store', ...init };
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const reqUrl = i === 0
      ? url
      : url + (url.indexOf('?') === -1 ? '?' : '&') + '_cb=' + Date.now() + '-' + i;
    try {
      const res = await _withTimeout(fetch(reqUrl, baseInit), timeoutMs, reqUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + reqUrl);
      return res;
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      const backoff = 400 * Math.pow(2, i) + Math.random() * 200;  // 0.4s, 0.8s, 1.6s...
      console.warn('[boot] fetch failed (attempt', i + 1, 'of', tries, ')', reqUrl, e && e.message);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// In-memory copy of user preferences. Persisted to localStorage under
// `cupitor:appSettings:${lang}` (per-language, per-device). Mutated by the
// UI inputs in #settingsPanel and written via saveAppSettings. Defaults
// below apply when no localStorage entry exists yet.
window._appSettings = {
  contextLinesBefore: 2,
  contextLinesAfter: 2,
  // Channel names whose subtitles are demoted to fallback — shown ONLY when
  // a word has no match from a non-blocked channel.
  blockedChannels: [],
  // Seconds the recording-playback waits between items.
  recPlayGapSeconds: 30,
  // Playlist-style playback modes for recordings.
  // recPlayShuffle: items are reordered with Fisher-Yates before playback.
  // recPlayLoop:    'off'      — play through once then stop (default)
  //                 'one'      — repeat the current item indefinitely
  //                 'playlist' — repeat the current playlist indefinitely
  //                 'all'      — cycle through every playlist's items indefinitely
  recPlayShuffle: false,
  recPlayLoop: 'off',
  // Practice flashcard reveal behaviour:
  //   'flip' — Reveal triggers a card-flip animation that replaces the source
  //            text with the target translation (click again to flip back) — default
  //   'both' — back shown alongside the front from the start, no Reveal button
  //   'hide' — back appears below the front when Reveal is clicked
  practiceRevealMode: 'flip'
}

function appSettingsLocalKey() {
  const lang = getLangFromUrl()
  return `cupitor:appSettings:${lang.fullName}`
}

function loadAppSettings() {
  // Settings are personal preferences — no cross-device sync. Live entirely
  // in localStorage so changes don't generate a commit-per-keystroke on the
  // GitHub repo. (Returns a Promise so existing callers can await it.)
  try {
    const raw = localStorage.getItem(appSettingsLocalKey())
    if (raw) {
      const json = JSON.parse(raw)
      if (json && typeof json === 'object') {
        window._appSettings = { ...window._appSettings, ...json }
      }
    }
  } catch (e) {
    console.warn('loadAppSettings: failed to read localStorage — using defaults', e)
  }
  $('#contextLinesBefore').val(window._appSettings.contextLinesBefore)
  $('#contextLinesAfter').val(window._appSettings.contextLinesAfter)
  $('#recPlayGapSeconds').val(
    parseInt(window._appSettings.recPlayGapSeconds, 10) || 30
  )
  $('#practiceRevealMode').val(window._appSettings.practiceRevealMode || 'flip')
  return Promise.resolve()
}

function saveAppSettings() {
  try {
    localStorage.setItem(appSettingsLocalKey(), JSON.stringify(window._appSettings))
  } catch (e) {
    console.warn('saveAppSettings: localStorage write failed', e)
  }
}
window.saveAppSettings = saveAppSettings

async function fetchVocabulary() {
  try {
    let res;
    if (isLocalhost()) {
      res = await fetch("http://localhost:5000/vocabulary?lang=" + getLangFromUrl().fullName)
      res = await res.json()
      if (res) res = res.text
    } else {
      // Retry — raw.githubusercontent.com sometimes returns transient 5xx
      // right after a deploy, and a single failed read leaves vocabulary
      // empty for the whole session.
      res = await _fetchWithRetry(`${getResourceUrl()}/vocabulary.txt`)
      res = await res.text()
    }
    if (res) {
      window.vocabulary = parseVocabularyFile(res)
      // Baseline of the file as it was when we loaded it. Used by
      // commitVocabularyToGithub for a 3-way merge against the live remote
      // so concurrent edits on GitHub aren't clobbered by our push.
      window._vocabularyBaselineText = res
    }
  } catch (e) {
    console.warn('Vocabulary fetch failed', e);
  } finally {
    if (!window.vocabulary) window.vocabulary = {};
    // Re-apply any unpushed local edits cached from a previous session.
    // Must run BEFORE loadWholeVocabulary() so the rebuilt selects already
    // include the buffered categories.
    try { _replayPendingVocab() } catch (_) {}
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
// Safety default — set early so a flaky boot (failed srts/index.json fetch)
// doesn't leave us with `undefined` when groupAndArrangeResults runs.
// fetchCategorisation overwrites this in loadAllSubtitles when it succeeds.
if (!window.categories) window.categories = {}
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
    // Detect which language the clicked word belongs to, so "Search here"
    // can search in that language regardless of the UI toggle. Order:
    //   1. nearest ancestor .line[data-lang-code] (search results)
    //   2. #sv-sub / #en-sub container (subtitle overlay)
    //   3. fallback: main lang from the URL
    let wordLang = $(e.target).closest('.line[data-lang-code]').attr('data-lang-code') || ''
    if (!wordLang) {
      if ($(e.target).closest('#en-sub, #en-sub-mirror').length) wordLang = 'en'
      else if ($(e.target).closest('#sv-sub, #sv-sub-mirror').length) wordLang = 'sv'
    }
    if (!wordLang) wordLang = getLangFromUrl().code
    // Only sv / en are actually wired into the search path; anything else
    // would silently degrade to "sv-or-en via the toggle", so clamp here.
    if (wordLang !== 'sv' && wordLang !== 'en') wordLang = 'sv'

    if($(e.target).hasClass('link-special')) {
        stopMedia()
        _showSubtitleWordPopover(e.pageX, e.pageY, word, href, $(e.target).attr('data-index'), wordLang)
    } else if($(e.target).hasClass('link')) {
        stopMedia() //otherswise the popover might open and close immediately due to the click bubbling to the document listener below
        _showSubtitleWordPopover(e.pageX, e.pageY, word, href, null, wordLang)
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
      $(".ui-dialog-content:visible").not("#addToVocabularyDialog,#captured-subtitles-dialog,#recordingReviewDialog,#srt-merge-dialog,#channelManagerDialog,#srtEditsReviewDialog,#practiceLineEditDialog,#duplicateSrtsDialog,#unavailableVideosDialog,#manualEntryEditor,#playingQueueDialog,#rareWordsDialog,#playUnavailableDialog").dialog("close");
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
      //window.location.hash = link
      window.mediaSelected = {link: link, source: 'link'}
      window.syncSubtitle = true
      // Keep the media panel open: selecting a media only loads it now, and the
      // user still has to choose an action (Play / Play Starred / Practice
      // Starred), so collapsing the controls here would hide those buttons.
      // Load the media + subtitles but don't auto-start.
      // playNewMedia(link, 'link', null, false)
      loadStarredLines(link, 'youtube')
      $('#playSelectedMediaBtn').show()
    } else {
      removeHash()
      $('#playSelectedMediaBtn').hide()
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

  // Context-lines settings: update the in-memory copy, re-render the
  // current results so the new window takes effect, and debounce-save to
  // GitHub. Clamped to a reasonable [0..20] range; bad input falls back
  // to the existing value.
  const _onContextChange = () => {
    const before = parseInt($('#contextLinesBefore').val(), 10)
    const after = parseInt($('#contextLinesAfter').val(), 10)
    if (Number.isFinite(before)) window._appSettings.contextLinesBefore = Math.max(0, Math.min(20, before))
    if (Number.isFinite(after)) window._appSettings.contextLinesAfter = Math.max(0, Math.min(20, after))
    if (window.searchResult) render(window.searchResult, window.searchText)
    saveAppSettings()
  }
  $('#contextLinesBefore').on('change input', _onContextChange)
  $('#contextLinesAfter').on('change input', _onContextChange)

  $('#recPlayGapSeconds').on('change input', e => {
    const v = parseInt($(e.target).val(), 10)
    if (Number.isFinite(v)) {
      window._appSettings.recPlayGapSeconds = Math.max(0, Math.min(600, v))
      saveAppSettings()
    }
  })

  $('#practiceRevealMode').on('change', e => {
    const v = String($(e.target).val() || 'hide')
    if (['hide', 'both', 'flip'].indexOf(v) >= 0) {
      window._appSettings.practiceRevealMode = v
      saveAppSettings()
      // Re-render the current card so the change is felt immediately.
      if (window._practiceActive) _renderPracticeCard()
    }
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
  // New media: reset the "saved" baseline so Save only reappears once the
  // freshly-loaded favourites are actually changed.
  window._starredBaseline = ''
  try { _updateStarredLinesBtns() } catch (_) {}
}

function getWikiLink(word, uri = null, cls = 'link', index = null) {
  let uriComponent = uri || word;
  uriComponent = uriComponent.toLowerCase()
  return `<span> <span data-index="${index}" class="${cls}" href="https://${getLangFromUrl().code}.wiktionary.org/wiki/${encodeURIComponent(uriComponent)}">${word}</span></span>`;
}

// Lazy-create + show the small popover that lets the user choose between
// "Search here" (populate the search box) and "Search on wiki" (open the
// stored Wiktionary URL) for a clicked subtitle word.
function _showSubtitleWordPopover(pageX, pageY, word, href, index = null, wordLang = null) {
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
    if (word) {
      // Pin the search language to whichever the clicked word was in, so a
      // word from an EN subtitle is searched against EN SRTs even when the
      // toggle is on SV (and vice-versa). Cleared in searchTextChanged's
      // finally block.
      if (wordLang === 'sv' || wordLang === 'en') window.forceLangForNextSearch = wordLang
      $('#searchText').val(word).trigger('change')
    }
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
  return async e => {
    // ts may be null at render time (mp3Choice loads starred indices before
    // any subtitle SRT is fetched). Resolve it lazily on click — first from
    // window.subtitles if it's already there, otherwise by fetching+parsing
    // the per-link SRT via getSubtitlesForLink.
    let resolvedTs = ts
    if (resolvedTs == null && Array.isArray(window.subtitles)) {
      const s = window.subtitles.find(it => it && it.index === index)
      if (s && typeof s.ts === 'number') resolvedTs = s.ts
    }
    if (resolvedTs == null) {
      try {
        const media = window.mediaSelected || {}
        if (media.link) {
          const stored = await getSubtitlesForLink(media.link, media.source)
          if (stored) {
            if (!stored._parsedSv && stored.sv) stored._parsedSv = srtToJson(stored.sv)
            const hit = (stored._parsedSv || []).find(it => it && it.index === index)
            if (hit && hit.start && typeof hit.start.ordinal === 'number') {
              resolvedTs = hit.start.ordinal
            }
          }
        }
      } catch (err) { console.warn('starredLineSelected: lazy ts resolve failed', err) }
    }
    $('.starred-sub').removeClass('active')
    el.addClass('active')
    await changeMediaIfNeededTo(window.mediaSelected)
    if (resolvedTs != null) await setMediaTime(resolvedTs, true)
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

// Order-independent signature of the current starred set, for diffing
// against the last-saved baseline.
function _starredSignature() {
  return (window.starredLines || []).map(String).sort().join('|')
}

// "Save Starred Lines" appears ONLY when the current set differs from what's
// already saved (the baseline captured on load / after a save) — so it
// doesn't nag when the loaded favourites are untouched. "Play Starred"
// appears whenever there's at least one starred line.
function _updateStarredLinesBtns() {
  const n = (window.starredLines || []).length
  const changed = _starredSignature() !== (window._starredBaseline || '')
  $('#saveStarredLinesBtn').toggle(changed)
  $('#playStarredLinesBtn').toggle(n > 0)
  $('#practiceStarredLinesBtn').toggle(n > 0)
}
window._updateStarredLinesBtns = _updateStarredLinesBtns

// Build a transient queue from the currently-starred lines of the active
// media. Shared by Play Starred (play mode) and Practice Starred (practice
// mode) — neither persists anything. Async because subtitles for the
// selected media may not be in memory yet (Play/Practice Starred is reachable
// straight from the media picker, before any subtitle load); the queue
// needs timestamps, so we lazy-fetch+parse the SRT on demand. Returns null
// (after alerting) if the media isn't a supported YouTube source or there's
// nothing playable.
async function _buildStarredQueue() {
  const media = window.mediaBeingPlayed || window.mediaSelected || {}
  const id = media.link
  const source = (media.source || '').toLowerCase()
  // A live YouTube video is played with source 'link' (and playingYoutubeVideo=true);
  // captured/recording items use source 'youtube'. Anything else (local files) isn't supported.
  const isYouTube = window.playingYoutubeVideo || source === 'link' || source === 'youtube'
  if (!id) { alert('No media loaded to use starred lines from.'); return null }
  if (!isYouTube) { alert('Starred-line playback currently supports YouTube media only.'); return null }

  // Prefer the in-memory window.subtitles (numeric ts/te from storeSubtitles).
  // Otherwise lazy-fetch the SRT for this link and parse it — buttons show
  // before any playback happens, so this is often the first time the SRT is
  // touched. Field shape differs (string ts vs number) so we read seconds via
  // start.ordinal / end.ordinal which both code paths expose.
  let subs = window.subtitles || []
  if (!subs.length) {
    try {
      const stored = await getSubtitlesForLink(id, source)
      if (stored) {
        if (!stored._parsedSv && stored.sv) stored._parsedSv = srtToJson(stored.sv)
        subs = stored._parsedSv || []
      }
    } catch (err) {
      console.warn('_buildStarredQueue: subtitle lazy-load failed', err)
    }
  }

  const queue = []
  ;(window.starredLines || []).forEach(index => {
    const sub = subs.find(it => it && it.index === index)
    if (!sub) return
    const startSec = (sub.start && typeof sub.start.ordinal === 'number') ? sub.start.ordinal
                   : (typeof sub.ts === 'number' ? sub.ts : null)
    const endSec   = (sub.end && typeof sub.end.ordinal === 'number') ? sub.end.ordinal
                   : (typeof sub.te === 'number' ? sub.te : null)
    if (startSec == null) return
    queue.push({
      id, source: 'YouTube',
      timeStart: Math.floor(startSec),
      timeEnd: Math.ceil(endSec != null ? endSec : startSec + 4),
      lineIndex: index,
      word: '',
      searchText: 'Starred',
      enabled: true
    })
  })
  if (!queue.length) { alert('No playable starred lines.'); return null }
  return queue
}

// Play the currently-starred lines as an ad-hoc playlist in play mode.
async function playStarredLines() {
  const queue = await _buildStarredQueue()
  if (queue) playRecording({ queue })
}
window.playStarredLines = playStarredLines

// Practice the currently-starred lines as ad-hoc cards in practice mode.
async function practiceStarredLines() {
  const queue = await _buildStarredQueue()
  if (queue) openPracticeMode({ queue })
}
window.practiceStarredLines = practiceStarredLines

function renderStarredLines() {
  $('#starredLines').html('')
  $('#starredLinesSelect').html('')

  // window.subtitles isn't always loaded when this runs — loadStarredLines
  // fires from app init before any subtitle SRT is fetched. Fall back to an
  // empty list so the starred index round-trips even without timestamps;
  // a later renderStarredLines() (post-subtitle-load) will pick up the ts.
  const subs = Array.isArray(window.subtitles) ? window.subtitles : []
  window.starredLines.forEach(index => {
    const hit = subs.find(it => it && it.index === index)
    const ts = hit ? hit.ts : null
    const x = $(`<span data-index="${index}">${index}</span>`)
      .addClass('starred-sub')

    x.click(starredLineSelected(x, index, ts))

    $('#starredLines').append(x)

    $('#starredLinesSelect').append(new Option(index, index)).show()
  })
  _updateStarredLinesBtns()
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
    // Show the subtitle's start-end timestamp above the line so the
    // user can see where in the media they are without checking the player.
    if (typeof currentSub.ts === 'number' && typeof currentSub.te === 'number') {
      $('#subtitle-timestamp').text(`${fromSeconds(currentSub.ts)} - ${fromSeconds(currentSub.te)}`)
    } else {
      $('#subtitle-timestamp').text('')
    }
  }
  renderAccordions($('#sv-sub')[0])
  lastSub = currentSub
}

async function seekToYoutubeTime(t) {
  if (!window.ytPlayer || typeof window.ytPlayer.seekTo !== 'function') return
  const target = Number(t) || 0
  let beforeCt = 0
  try { beforeCt = window.ytPlayer.getCurrentTime() || 0 } catch (_) {}
  console.log('Seek request, target=', fromSeconds(target), 'currentTime=', fromSeconds(beforeCt))
  window.seekRequestProcessing = true
  try { window.ytPlayer.seekTo(target, true) } catch (_) {}

  // Bounded poll: every 100ms for up to 3s, looking for the playhead to land
  // within TOLERANCE of the target. The old code used `Math.max(6, |gap|)`
  // for tolerance — when the initial gap was huge that made the "close
  // enough" check pass instantly (apparent success, no actual seek). Also
  // dropped the "delta nudge" loop that walked the seek target backwards by
  // 1s per tick; YouTube's own seek is reliable enough without it. On
  // timeout we RESOLVE (not reject) so callers like playMediaSlice keep
  // moving — better to proceed slightly off-target than to throw and abort
  // the whole playback.
  const TICK_MS = 100
  const MAX_TICKS = 30        // 3s overall budget
  const TOLERANCE = 1.5       // seconds — close enough that playback will be visibly at the right spot
  const REISSUE_AT = 10       // ticks (~1s): if still far, re-issue the seek once
  return new Promise(resolve => {
    let ticks = 0
    const id = setInterval(() => {
      ticks++
      let ct = 0
      try { ct = window.ytPlayer.getCurrentTime() || 0 } catch (_) {}
      if (Math.abs(ct - target) <= TOLERANCE) {
        clearInterval(id)
        window.seekRequestProcessing = false
        window.proxyYoutubeCurrentTime = target
        console.log('Seek request completed', fromSeconds(target), 'currentTime=', fromSeconds(ct))
        return resolve()
      }
      if (ticks === REISSUE_AT) {
        try { window.ytPlayer.seekTo(target, true) } catch (_) {}
      }
      if (ticks >= MAX_TICKS) {
        clearInterval(id)
        window.seekRequestProcessing = false
        console.warn('seekToYoutubeTime: timed out without converging — proceeding anyway', { target, currentTime: ct })
        return resolve()
      }
    }, TICK_MS)
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
  // Globally pin every jQuery UI dialog to the top of the viewport with
  // position:fixed. jQuery UI defaults to position:absolute anchored on the
  // current scroll position, so a dialog opened after the user scrolled
  // lands offscreen. Fixed + a small top offset keeps every dialog
  // consistent without per-call _pinDialogToViewport sprinkles.
  $(document).on('dialogopen', function (e) {
    const $wrap = $(e.target).closest('.ui-dialog')
    if (!$wrap.length) return
    const w = $wrap.outerWidth() || 0
    const left = Math.max(10, Math.round((window.innerWidth - w) / 2))
    $wrap.css({
      position: 'fixed',
      top: '20px',
      left: left + 'px',
      margin: '0'
    })
  })
  // Default select2 matcher strips diacritics, so typing "a" matches "ä"
  // and vice-versa — wrong for Swedish vocab where ä/ö/å are distinct
  // letters. This matcher does a plain case-insensitive substring match
  // on the raw text, and preserves the optgroup-children traversal.
  // Defined before any select2() call below so both #vocabularySelect and
  // #addToVocabularyDialogSelect can pass it in.
  const diacriticAwareMatcher = (params, data) => {
    if ($.trim(params.term) === '') return data
    if (data.children && data.children.length) {
      const filtered = []
      for (const child of data.children) {
        const m = diacriticAwareMatcher(params, child)
        if (m) filtered.push(m)
      }
      if (filtered.length) return $.extend({}, data, { children: filtered })
      return null
    }
    if (typeof data.text === 'undefined') return null
    if (data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) return data
    return null
  }
  $("#vocabularySelect").select2({ matcher: diacriticAwareMatcher })
  // #searchedWords is pre-initialised in language.html (inline script) so the
  // dropdown is interactive before this module loads — but that init does NOT
  // pass the matcher, so a search for "a" still matched "ä/å" via select2's
  // default diacritic-stripping. Tear down and re-init here with the matcher
  // bolted on, keeping the same styleCategory templates the inline init used.
  const _searchedWordsStyleCategory = (option) => {
    if (!option || !option.id) return option && option.text
    if (typeof option.id === 'string' && option.id.indexOf('__cat__:') === 0) {
      return $(`<span style="color:#888;font-style:italic;">${option.text}</span>`)
    }
    return option.text
  }
  const $sw = $('#searchedWords')
  if ($sw.length) {
    if ($sw.hasClass('select2-hidden-accessible')) $sw.select2('destroy')
    $sw.select2({
      placeholder: 'Vocabulary',
      allowClear: true,
      templateResult: _searchedWordsStyleCategory,
      templateSelection: _searchedWordsStyleCategory,
      matcher: diacriticAwareMatcher
    })
  }
  $("#addToVocabularyDialogSelect").select2({
    placeholder: 'Reference word',
    allowClear: true,
    matcher: diacriticAwareMatcher
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

  Object.values(ogs).forEach(it => $mp3Choice.append(it))
  return srts;
}

async function loadAllSubtitles() {
  try {
    // Kick the vocabulary fetch off in parallel so a flaky srts/index.json
    // can't strand it. Used to live inside this try-block, where any earlier
    // throw skipped over it and left window.vocabulary undefined for the
    // rest of the session.
    const vocabReady = fetchVocabulary()
    const settingsReady = loadAppSettings()
    let srtsRes = await _fetchWithRetry(`${getResourceUrl()}/srts/index.json`)
    let srts = await srtsRes.json()
    // Normalize names to NFC on read so every downstream consumer sees a
    // single canonical encoding regardless of how the entry was committed.
    if (Array.isArray(srts)) srts = srts.map(it => it ? { ...it, name: _nfc(it.name) } : it)
    window.srts = srts

    // Cache pass: populate window.allSubtitles from IndexedDB before queuing
    // any network fetches. Hits are searchable instantly; only entries that
    // aren't in the cache go to the SRT fetch pool below. Entries cached but
    // no longer in index.json are evicted in the background. The cache layer
    // silently no-ops if IDB is unavailable (private mode, quota, etc.), so
    // a first boot or a degraded environment falls back to the old behavior.
    const cached = await _cacheReadAll().catch(() => new Map())
    const cacheHits = []
    const deadLinks = []
    if (cached.size) {
      const indexLinks = new Set(srts.map(s => s.link))
      for (const [link, entry] of cached) {
        if (!indexLinks.has(link)) { deadLinks.push(link); continue }
        if (entry && entry.sv && entry.en && !window.allSubtitles[link]) {
          window.allSubtitles[link] = {
            sv: entry.sv,
            en: entry.en,
            source: entry.source,
            fileName: entry.name,
            fetchedFrom: 'cache',
          }
          cacheHits.push(link)
        }
      }
      if (deadLinks.length) {
        // Evict in the background — never block subtitle readiness on this.
        _cacheDeleteMany(deadLinks).catch(e => console.warn('[cache] evict failed', e))
      }
    }

    // 404s — the file genuinely isn't there, so never retried.
    const notFound = []
    // Transient failures (rate limiting / 5xx / network blip / timeout) — these
    // are queued for a background retry after subtitles are declared ready, so
    // a flaky load doesn't permanently leave gaps in window.allSubtitles.
    const transientFailures = []
    // Cap concurrent SRT fetches at SRT_FETCH_CONCURRENCY. Earlier we kicked
    // off every pair in parallel via srts.map(async …), which on bigger
    // indexes (hundreds of entries × 2 files each) flooded Chrome with
    // requests and triggered net::ERR_INSUFFICIENT_RESOURCES. The pool keeps
    // the in-flight count bounded so the browser doesn't bail out. The host
    // (raw.githubusercontent.com) is HTTP/2, so this isn't the old 6-per-host
    // cap — the practical ceiling is the host's rate limiter.
    const SRT_FETCH_CONCURRENCY = 15
    // Only fetch what the cache didn't satisfy. On a steady-state boot this
    // is typically empty (everything came from IDB); on first boot it's the
    // whole corpus; on a deploy that added videos it's just the new ones.
    const toFetch = srts.filter(it => !window.allSubtitles[it.link])
    if (cacheHits.length || deadLinks.length || toFetch.length !== srts.length) {
      console.log(`[cache] boot: ${cacheHits.length} hits, ${toFetch.length} to fetch, ${deadLinks.length} evicted`)
    }
    _srtProgressShow(toFetch.length)
    const srtLoadingDone = _runInBatches(toFetch, async (it) => {
      try {
        await _withTimeout(getSubtitlesForLink(it['link'], it['source']), 15000, it['link'])
      } catch (e) {
        // A timeout from _withTimeout carries no .kind — treat it as transient.
        if (e && e.kind === 'notfound') notFound.push(it['link'])
        else transientFailures.push(it)
      }
    }, SRT_FETCH_CONCURRENCY, (done, total) => _srtProgressUpdate(done, total))
      .finally(() => _srtProgressHide())

    window.categories = await fetchCategorisation()

    populateAllLinks();

    await vocabReady
    await settingsReady

    populateVocabularyHeadings($('#vocabularySelect'))

    // Now make sure any still-in-flight SRT fetches have settled before we
    // declare subtitles ready — searches deferred in doSearch will fire here.
    await srtLoadingDone
    if (notFound.length > 0) {
      console.log("Not found", notFound.join('\n'))
    }
    if (transientFailures.length > 0) {
      console.warn(`[srt] ${transientFailures.length} subtitle(s) failed transiently — retrying in background`)
      // Intentionally not awaited: search becomes available immediately with
      // whatever loaded, and the retry tops up window.allSubtitles behind it.
      _retrySrtsInBackground(transientFailures)
    }
  } catch (e) {
    console.warn('loadAllSubtitles error', e);
  } finally {
    window._subtitlesLoaded = true;
    window._subtitlesReadyResolve();
  }
}

// Background top-up for SRTs that failed transiently during the initial bulk
// load (rate limiting, 5xx, network blips, timeouts). Genuine 404s are never
// passed here. Runs *after* subtitles are declared ready, so it never blocks
// search. Each round uses a gentler concurrency window and a growing delay to
// stay under raw.githubusercontent.com's rate limiter; anything that recovers
// lands in window.allSubtitles and becomes searchable immediately. Re-entrancy
// is guarded so overlapping invocations don't double-fetch.
async function _retrySrtsInBackground(items, maxRounds = 4) {
  if (window._srtRetryRunning) {
    // Fold new items into the in-flight retry set and let it pick them up.
    window._srtRetryPending = (window._srtRetryPending || []).concat(items || [])
    return
  }
  window._srtRetryRunning = true
  try {
    let pending = (items || []).slice()
    for (let round = 1; round <= maxRounds; round++) {
      // Absorb anything queued by a concurrent caller.
      if (window._srtRetryPending && window._srtRetryPending.length) {
        pending = pending.concat(window._srtRetryPending)
        window._srtRetryPending = []
      }
      if (!pending.length) break
      // Backoff before each round, growing: 2s, 4s, 8s, 16s.
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, round - 1)))

      const stillFailing = []
      await _runInBatches(pending, async (it) => {
        // Skip ones a prior round (or a normal search) already recovered.
        if (window.allSubtitles[it['link']]) return
        try {
          // A touch more patience per attempt than the initial 15s.
          await _withTimeout(getSubtitlesForLink(it['link'], it['source']), 20000, it['link'])
        } catch (e) {
          // A 404 surfacing on retry means the file truly isn't there — drop it.
          if (!(e && e.kind === 'notfound')) stillFailing.push(it)
        }
      }, 4 /* gentle concurrency to avoid re-tripping rate limits */)

      const recovered = pending.length - stillFailing.length
      if (recovered > 0) {
        console.log(`[srt] background retry round ${round}: recovered ${recovered}, ${stillFailing.length} still pending`)
      }
      pending = stillFailing
    }
    if (pending.length) {
      console.warn(`[srt] background retry gave up on ${pending.length} subtitle(s) after ${maxRounds} rounds:`,
        pending.map(it => it.link).join(', '))
    } else if (items && items.length) {
      console.log('[srt] background retry: all transient failures recovered')
    }
  } finally {
    window._srtRetryRunning = false
  }
}

try {
  loadAllSubtitles()
  $('.controlgroup').controlgroup()
} catch (e) {
}

// Parse an SRT into an array of subtitle objects. Each object always carries
// the line text on `item.text` — that's the canonical field every reader
// should use. When a `lang` argument is supplied (e.g. 'sv', 'en'), the same
// text is ALSO mirrored under `item[lang]` so the few legacy consumers that
// read item.sv / item.en (the combined sv+en merge in loadSubtitlesForLink;
// the search-result `sv_subs.data` / `en_subs.data` per-row rendering) keep
// working. Previously the lang variant stored text ONLY under item[lang],
// which is what caused practice edits to render as "(empty)" — the practice
// renderer reads item.text exclusively.
function srtToJson(text, lang) {
  const mirror = lang && lang !== 'text'   // legacy callers that read item[lang]
  text = text.replaceAll('<c.huvudpratare>', '')
  const items = []
  let currentItem = { text: '' }
  if (mirror) currentItem[lang] = ''
  text.split("\n").forEach(line => {
    line = line.trim()
    const matchTime = line.match(/(\d\d:\d\d:\d\d[,.]\d\d\d) --> (\d\d:\d\d:\d\d[,.]\d\d\d)/m)
    const matchId = line.match(/^\d+$/m)
    if (matchId) {
      items.push(currentItem)
      currentItem = { index: line, id: line, text: '' }
      if (mirror) currentItem[lang] = ''
    } else if (matchTime) {
      currentItem['start'] = {ordinal: toSeconds(matchTime[1])}
      currentItem['end'] = {ordinal: toSeconds(matchTime[2])}
      currentItem['ts'] = matchTime[1]
      currentItem['te'] = matchTime[2]
    } else {
      currentItem.text += (line + "\n")
      if (mirror) currentItem[lang] += (line + "\n")
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

// Tag a failed SRT fetch so the loader can tell a genuine miss from a
// recoverable one:
//   'notfound'  — HTTP 404: the file really isn't there, never retry.
//   'transient' — rate limiting (429), 5xx, network blip, or timeout: retry.
function _srtError(kind, message) {
  const e = new Error(message || kind)
  e.kind = kind
  e.isSrtError = true
  return e
}

// ─── IndexedDB cache for SRT subtitle pairs ─────────────────────────────────
// Stores `{link, name, sv, en, source, cachedAt}` records keyed by `link`.
//
// Versioning model is intentionally opaque: once an SRT is cached, the app
// trusts it forever. Boot reads the cache, populates window.allSubtitles for
// hits, fetches the remaining entries from GitHub, and evicts cache entries
// whose link no longer appears in srts/index.json. To pull fresh server-side
// content, the user clicks "Refresh subtitles" in the Manage menu (which
// clears the store and reloads).
//
// All failure modes (IDB unavailable, open errored, quota exceeded, tx
// aborted) silently fall back to no-cache mode — the cache is purely a
// performance optimization, never a correctness dependency. A flaky IDB
// layer must NOT keep the app from booting.
const CUPITOR_CACHE_DB_PREFIX = 'cupitor-cache-v1'
const CUPITOR_CACHE_STORE = 'subtitles'
const CUPITOR_CACHE_SCHEMA = 1

let _cacheDbPromise = null
let _cacheDbDisabled = false

function _cacheDbName() {
  // Per-language DB so swedish/spanish caches don't trample each other.
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || 'default'
  return `${CUPITOR_CACHE_DB_PREFIX}-${lang}`
}

function _openSubtitlesCache() {
  if (_cacheDbDisabled) return Promise.resolve(null)
  if (_cacheDbPromise) return _cacheDbPromise
  if (typeof indexedDB === 'undefined') {
    console.warn('[cache] IndexedDB unavailable — running in no-cache mode')
    _cacheDbDisabled = true
    return Promise.resolve(null)
  }
  _cacheDbPromise = new Promise((resolve) => {
    let req
    try { req = indexedDB.open(_cacheDbName(), CUPITOR_CACHE_SCHEMA) }
    catch (e) {
      console.warn('[cache] indexedDB.open threw — running in no-cache mode', e)
      _cacheDbDisabled = true
      resolve(null); return
    }
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(CUPITOR_CACHE_STORE)) {
        db.createObjectStore(CUPITOR_CACHE_STORE, { keyPath: 'link' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      console.warn('[cache] indexedDB.open errored — running in no-cache mode', req.error)
      _cacheDbDisabled = true
      resolve(null)
    }
    // onblocked fires when another tab holds an older-version connection
    // open. We don't need to act — the success/error handler will still
    // resolve once the other tab releases.
    req.onblocked = () => console.warn('[cache] indexedDB.open blocked (another tab is holding an older version)')
  })
  return _cacheDbPromise
}

function _cacheStore(db, mode) {
  return db.transaction(CUPITOR_CACHE_STORE, mode).objectStore(CUPITOR_CACHE_STORE)
}

async function _cacheReadAll() {
  const db = await _openSubtitlesCache()
  if (!db) return new Map()
  return new Promise((resolve) => {
    const map = new Map()
    try {
      const req = _cacheStore(db, 'readonly').openCursor()
      req.onsuccess = (e) => {
        const cur = e.target.result
        if (!cur) { resolve(map); return }
        const v = cur.value
        if (v && v.link) map.set(v.link, v)
        cur.continue()
      }
      req.onerror = () => resolve(map)
    } catch (e) { resolve(map) }
  })
}

async function _cacheWriteMany(entries) {
  if (!entries || !entries.length) return
  const db = await _openSubtitlesCache()
  if (!db) return
  await new Promise((resolve) => {
    try {
      const store = _cacheStore(db, 'readwrite')
      const tx = store.transaction
      const now = Date.now()
      for (const e of entries) {
        if (!e || !e.link) continue
        try { store.put({ link: e.link, name: e.name, sv: e.sv, en: e.en, source: e.source, cachedAt: now }) } catch (_) {}
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (ev) => {
        console.warn('[cache] writeMany tx error', ev.target && ev.target.error)
        resolve()
      }
      tx.onabort = (ev) => {
        const err = ev.target && ev.target.error
        if (err && err.name === 'QuotaExceededError') {
          console.warn('[cache] quota exceeded — disabling cache for the rest of this session')
          _cacheDbDisabled = true
        } else {
          console.warn('[cache] writeMany tx aborted', err)
        }
        resolve()
      }
    } catch (e) {
      console.warn('[cache] writeMany threw', e)
      resolve()
    }
  })
}

async function _cacheWriteOne(entry) {
  return _cacheWriteMany([entry])
}

async function _cacheDeleteMany(links) {
  if (!links || !links.length) return
  const db = await _openSubtitlesCache()
  if (!db) return
  await new Promise((resolve) => {
    try {
      const store = _cacheStore(db, 'readwrite')
      const tx = store.transaction
      for (const link of links) {
        try { store.delete(link) } catch (_) {}
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch (e) { resolve() }
  })
}

async function _cacheDeleteOne(link) {
  return _cacheDeleteMany([link])
}

async function _cacheClear() {
  const db = await _openSubtitlesCache()
  if (!db) return
  await new Promise((resolve) => {
    try {
      const req = _cacheStore(db, 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch (e) { resolve() }
  })
}

async function _cacheStats() {
  const db = await _openSubtitlesCache()
  if (!db) return { count: 0, approxBytes: 0 }
  return new Promise((resolve) => {
    try {
      const countReq = _cacheStore(db, 'readonly').count()
      countReq.onsuccess = () => {
        let approxBytes = 0
        const curReq = _cacheStore(db, 'readonly').openCursor()
        curReq.onsuccess = (e) => {
          const cur = e.target.result
          if (!cur) { resolve({ count: countReq.result, approxBytes }); return }
          const v = cur.value
          approxBytes += (v.sv ? v.sv.length : 0) + (v.en ? v.en.length : 0)
          cur.continue()
        }
        curReq.onerror = () => resolve({ count: countReq.result, approxBytes })
      }
      countReq.onerror = () => resolve({ count: 0, approxBytes: 0 })
    } catch (e) { resolve({ count: 0, approxBytes: 0 }) }
  })
}

// Expose debug helpers so a user (or this dev) can inspect / clear via
// the browser console: cupitorCacheStats(), cupitorClearCache().
window.cupitorCacheStats = _cacheStats
window.cupitorClearCache = _cacheClear

// User-facing "Refresh subtitles" entry in the Manage menu. Clears the
// IndexedDB store and reloads the page, which forces the next boot to
// refetch every SRT from raw.githubusercontent.com. The whole point of
// option-D versioning is that the cache is otherwise trusted forever —
// this button is the escape hatch for "I edited subtitles on GitHub
// directly and want the local app to see the changes."
async function refreshSubtitlesCache() {
  const stats = await _cacheStats().catch(() => ({ count: 0, approxBytes: 0 }))
  const mb = (stats.approxBytes / (1024 * 1024)).toFixed(1)
  const detail = stats.count
    ? `Clear ${stats.count} cached subtitle pair${stats.count === 1 ? '' : 's'} (~${mb} MB) and re-fetch from GitHub?\n\nThe page will reload.`
    : 'The cache is empty. Reload anyway to re-fetch from GitHub?'
  if (!confirm(detail)) return
  await _cacheClear().catch(e => console.warn('[cache] clear failed', e))
  // Reload so the freshly-empty cache forces a full network refetch.
  location.reload()
}
window.refreshSubtitlesCache = refreshSubtitlesCache

// Fetch one SRT file, checking the HTTP status so a 404/429/5xx body never
// gets silently stored as subtitle text (the old code did `await res.text()`
// unconditionally, persisting "404: Not Found" as content). Throws a
// classified _srtError on failure.
async function _fetchSrtFile(url) {
  let res
  try {
    res = await fetch(url)
  } catch (e) {
    // Network error / DNS / connection reset — all worth retrying.
    throw _srtError('transient', 'network: ' + (e && e.message))
  }
  if (res.status === 404) throw _srtError('notfound', 'HTTP 404 ' + url)
  if (!res.ok) throw _srtError('transient', 'HTTP ' + res.status + ' ' + url)
  return res.text()
}

async function getSubtitlesForLink(link, source) {
  if (window.allSubtitles[link]) {
    return window.allSubtitles[link]
  }
  const srt = window.srts.find(it => it.link === link);
  if (!srt) return

  const name = _nfc(srt.name)
  const svName = name + getTargetLangSrtSuffix()
  const enName = name + ".en.srt"
  const sv = await _fetchSrtFile(`${getResourceUrl()}/srts/${encodeURIComponent(svName)}`)
  const en = await _fetchSrtFile(`${getResourceUrl()}/srts/${encodeURIComponent(enName)}`)

  window.allSubtitles[link] = {sv, en, source, fileName: name}
  // Write the freshly-fetched pair to IndexedDB so the next boot can skip
  // this network round-trip. Fire-and-forget — failures are swallowed inside
  // the cache layer; a flaky cache must never break this critical path.
  _cacheWriteOne({ link, name, sv, en, source }).catch(e => console.warn('[cache] write failed for', link, e))
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

async function playNewMedia(link, source, mediaFile, autoPlay = true) {
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
      if (!autoPlay) _suppressYoutubeAutoplay()
    } else if (source === 'local') {
      hideMediaContainer()
      $('#localVideoContainer').show()
      window.playingYoutubeVideo = false;
      if (mediaFile.name.endsWith(".mp3") || mediaFile.name.endsWith(".wav")) {
        audioPlayer.setSrc(URL.createObjectURL(mediaFile))
        if (autoPlay) audioPlayer.play()
        window.playingAudio = true;
        window.playingVideo = false;
        hidePlayer(window.videoPlayer)
        showAudioPlayer()
      } else if (mediaFile.name.endsWith(".mp4")) {
        videoPlayer.setSrc(URL.createObjectURL(mediaFile))
        window.playingAudio = false;
        window.playingVideo = true;
        if (autoPlay) videoPlayer.play()
        hidePlayer(window.audioPlayer)
        showVideoPlayer()
      }
    }
    window.mediaBeingPlayed = {link, source}
    //$('#subControls').hide()
  }

  hideResultContainer();
  if ($('#onlySubsCheckbox').is(':checked')) {
    showOnlySubtitle();
    $('#sv-sub-mirror').show()
    $('#toggleEnSubBtn').show()
  } else {
    _playMedia();
    showMediaRelatedContainer()
    $('#sv-sub-mirror').show()
    $('#toggleEnSubBtn').show()
  }

  // getSubtitlesForLink now throws a classified error on a failed fetch
  // (missing file / rate-limited / network). Degrade gracefully so playback
  // isn't aborted by an unavailable subtitle; a transient miss will be topped
  // up by the background retry and the next selection will pick it up.
  let sv = '', en = ''
  try {
    ({sv = '', en = ''} = (await getSubtitlesForLink(link, source)) || {})
  } catch (e) {
    console.warn('subtitles unavailable for', link, e && e.message)
  }
  loadSubtitlesForLink(sv, en);

  $('#currentMedia').html(`${link}, ${source}`)
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
  // Reset first — addStarredLine dedupes by index value but doesn't know
  // which video an index belongs to, so without this, switching media via
  // #mp3Choice would leave the previous video's starred indices in place
  // and the Play/Practice Starred buttons would lie about what's actually
  // available for the new video.
  window.starredLines = []
  $('#starredLines').html('')
  $('#starredLinesSelect').html('')

  let res = await fetch(`${getResourceUrl()}/srts/srt_favorites.json`)
  res = await res.json()

  const d = res.find(it => it.link === link)
  console.log(d)
  d && d.lines && d.lines.forEach(it => addStarredLine(it))
  // Snapshot the loaded set as the saved baseline — Save stays hidden until
  // the user adds/removes a star.
  window._starredBaseline = _starredSignature()
  try { _updateStarredLinesBtns() } catch (_) {}
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
    const want = window.youtubePlayInterval.videoId || null
    let loadedId = null
    try { loadedId = window.ytPlayer && window.ytPlayer.getVideoData && window.ytPlayer.getVideoData().video_id } catch (_) {}
    // Gate on videoId so a stale ct from the PREVIOUS clip (which would
    // typically be loaded under the OLD videoId) can't pause the new clip.
    // Also bound how far past `e` we'll act on, so a wildly stale reading
    // doesn't fire pauseVideo() either. _waitYTUntilEnd's hardPause()
    // already handles the genuine end-of-clip case — this is just a
    // safety net.
    const idOk = !want || !loadedId || loadedId === want
    if (idOk && ct > e && ct <= e + 5) {
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
  // Same structure as _highlightWordHtml (Player/Practice): try the whole
  // pattern first, fall back to per-token; collect ALL occurrences and
  // merge overlapping spans. The previous single-match implementation
  // missed cases where (a) the line had more than one matching variant,
  // (b) the regex threw on an exotic input and the whole highlight got
  // dropped, or (c) a multi-word phrase got split across SRT rows. The
  // search-result-specific bits live here: window.searchText is already
  // a |-alternation regex source (no escaping); each match expands to
  // its enclosing whitespace boundaries so a stem match like "design"
  // still highlights the whole word "designing".
  const pattern = window.searchText || ''
  const tokens = pattern.split(SEPARATOR_PIPE).map(s => s.trim()).filter(Boolean)
  if (!tokens.length) return getWikiLinks(text)

  const tryRe = (src) => { try { return new RegExp(src, 'gi') } catch (_) { return null } }
  const tryBoundedRe = (src) => {
    try { return new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'giu') }
    catch (_) { return tryRe(src) }
  }
  const collect = (re) => {
    const spans = []
    if (!re) return spans
    let m
    re.lastIndex = 0
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      // Expand to enclosing whitespace so a stem match like "design"
      // highlights the whole word "designing".
      let x = m.index
      while (x > 0 && text[x - 1] !== ' ' && text[x - 1] !== '\n') x--
      let y = m.index + m[0].length
      while (y < text.length && text[y] !== ' ' && text[y] !== '\n') y++
      spans.push({ start: x, end: y })
      if (m.index === re.lastIndex) re.lastIndex++
    }
    return spans
  }

  // Split alternatives by shape — multi-word "phrases" have priority over
  // their constituent single words. If any phrase matches we use ONLY the
  // phrase spans; otherwise we fall back to single-word matching. This
  // prevents the pathological "x y z|x|y|z" pattern from lighting up both
  // the whole phrase AND every standalone "x"/"y"/"z" on the line.
  const multiWord  = tokens.filter(t => /\s/.test(t))
  const singleWord = tokens.filter(t => !/\s/.test(t))

  // 1) Multi-word phrases. Each one's internal spaces are relaxed to \s+.
  let spans = multiWord.length
    ? collect(tryRe(multiWord.map(_relaxSpaces).join('|')))
    : []
  // 2) Fall back to single-word matches when no phrase was found. Two
  //    rule-sets, merged:
  //      • original-single-word alts (typically stem expansions from
  //        expandWords) — UNBOUNDED so a stem like "design" still
  //        highlights its derived form "designing".
  //      • sub-words SPLIT from multi-word phrases (e.g. "i" + "förväg"
  //        from "i förväg") — BOUNDED via Unicode lookaround so short
  //        tokens like "i" don't light up inside "vi"/"vilk".
  if (!spans.length) {
    if (singleWord.length) {
      spans = spans.concat(collect(tryRe(singleWord.join('|'))))
    }
    const subFromMulti = multiWord
      .flatMap(t => t.split(/\s+/))
      .map(s => s.trim())
      .filter(Boolean)
    if (subFromMulti.length) {
      spans = spans.concat(collect(tryBoundedRe(subFromMulti.join('|'))))
    }
  }
  if (!spans.length) return getWikiLinks(text)

  spans.sort((a, b) => a.start - b.start)
  const merged = []
  for (const sp of spans) {
    const last = merged[merged.length - 1]
    if (last && sp.start <= last.end) last.end = Math.max(last.end, sp.end)
    else merged.push({ ...sp })
  }

  // Trim each segment so getWikiLinks doesn't emit empty <span> wrappers
  // for the stray spaces produced by slice() at segment boundaries.
  const wikiSeg = (s) => {
    const t = s.replace(/\s+/g, ' ').trim()
    return t ? getWikiLinks(t) : ''
  }
  const parts = []
  let last = 0
  for (const sp of merged) {
    if (sp.start > last) parts.push(wikiSeg(text.slice(last, sp.start)))
    parts.push("<span class='highlight'>" + wikiSeg(text.slice(sp.start, sp.end)) + "</span>")
    last = sp.end
  }
  if (last < text.length) parts.push(wikiSeg(text.slice(last)))
  return parts.filter(Boolean).join(' ')
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

// Treat any run of literal spaces in a user-supplied pattern as `\s+`, so
// the search is whitespace-insensitive — "a b", "a  b" and "a\nb" all
// match the user's "a b" query. Applied to every RegExp we build from
// search input downstream (file filter, per-word, phrase, whole-text).
function _relaxSpaces(pattern) {
  return String(pattern || '').replace(/ +/g, '\\s+')
}

async function getMatchingWords(list, search, token) {
  const startTime = new Date().getTime()
  let wordToItemsMap = {}
  let searchText = search
  const transformedSearchText = search

  const isNotTooShort = w => w.trim().length > 2
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))
  const ITEM_CHUNK = 25

  const transformedRe = new RegExp(_relaxSpaces(transformedSearchText), "i")
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
  const phraseRes = phraseTerms.map(t => ({ term: t, re: new RegExp(_relaxSpaces(withWordBoundaries(t)), "i") }))

  for (let start = 0; start < list.length; start += ITEM_CHUNK) {
    if (token !== undefined && token !== window._subtitleSearchToken) return wordToItemsMap
    const end = Math.min(start + ITEM_CHUNK, list.length)
    for (let ix = start; ix < end; ix++) {
      const item = list[ix]
      const lines = item.data;
      for (const line of lines) {
        if (new Date().getTime() - startTime > 60000) {
          return wordToItemsMap;
        }
        // Fast-skip lines that can't contain a match. getWords() runs
        // Intl.Segmenter on every line, which is the single most expensive
        // step in this loop — for a search that file-matches in 180 SRTs
        // with ~100 lines each, the bulk of the 18k segmentations are on
        // lines that never had a chance of matching. Every downstream
        // matcher (perWordRe, withWordBoundaries(searchText), phraseRes)
        // is strictly more restrictive than transformedRe, so if
        // transformedRe doesn't match this line, none of them can either.
        // Skipping here lets the loop finish in a small fraction of the
        // old wall-clock budget, so the timeout below never fires under
        // realistic search loads. (Was hitting the 20s ceiling and
        // returning before reaching files later in the iteration order —
        // user-visible symptom: a search for a rare word that genuinely
        // appears in some file but the file doesn't show up because the
        // loop bailed before processing it.)
        if (!transformedRe.test(line.text)) continue
        const words = getWords(line.text, search).map(it => it.trim().toLowerCase())
        const endsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.endsWith(" ") && !transformedSearchText.startsWith(" ") && word.endsWith(transformedSearchText.trim());
        const startsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.startsWith(" ") && !transformedSearchText.endsWith(" ") && word.startsWith(transformedSearchText.trim());
        words.filter(word => word.match(perWordRe) || word.match(transformedRe) || endsWith(word) || startsWith(word))
            .forEach(word => {
              wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
            })
        // Whole search text as a word
        const word = searchText.toLowerCase().trim()
        if (word.indexOf(" ") > 0 && new RegExp(_relaxSpaces(withWordBoundaries(word)), "i").test(line.text)) {
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
      // Cross-line phrase match: catch phrases like "a b" where "a" sits
      // at the end of line N and "b" at the start of line N+1. The regex
      // already treats spaces as \s+ (via _relaxSpaces), so joining with a
      // newline preserves intent. Only register when neither line alone
      // matched, so we don't double-count the easy single-line case.
      const wholeWord = searchText.toLowerCase().trim()
      const wholeRe = wholeWord.indexOf(" ") > 0
          ? new RegExp(_relaxSpaces(withWordBoundaries(wholeWord)), "i")
          : null
      for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i], b = lines[i + 1]
        if (!a || !b || !a.text || !b.text) continue
        const combined = a.text + '\n' + b.text
        for (const { term, re } of phraseRes) {
          if (re.test(combined) && !re.test(a.text) && !re.test(b.text)) {
            wordToItemsMap[term] = computeIfAbsent(wordToItemsMap, term, it => []).concat(new MatchResult(term, a, item.url, item.source))
          }
        }
        if (wholeRe && wholeRe.test(combined) && !wholeRe.test(a.text) && !wholeRe.test(b.text)) {
          wordToItemsMap[wholeWord] = computeIfAbsent(wordToItemsMap, wholeWord, it => []).concat(new MatchResult(wholeWord, a, item.url, item.source))
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

  const searchRe = new RegExp(_relaxSpaces(withWordBoundaries(searchText)), "i")
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
    const counterpart = found && found.en_subs.data.find(it => it.index === line.index)
    if (counterpart) {
      // Match parity with the other branch: wrap the secondary EN text via
      // highlightedText so every word is a clickable .link. Without this the
      // EN side of an SV search renders as plain text — inconsistent with
      // the SV side, which is fully clickable.
      secondarySub = {...counterpart}
      secondarySub.text = highlightedText(secondarySub.text)
    }
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
  // Mobile browsers force-mute autoplay when a tab is opened via
  // target="_blank" — the new tab has no user gesture so YouTube's
  // autoplay starts silently. Desktop browsers are lenient enough that
  // `&autoplay=1` plays with sound, so keep it there.
  const autoplay = isDesktop() ? '&autoplay=1' : ''
  let url = `https://www.youtube.com/watch?v=${mediaId}&t=${time_start}${autoplay}`
  if (source?.toLowerCase() == 'svt') {
    url = `https://www.svtplay.se/video/${mediaId}?position=${time_start}`
  }
  return {fileName, url};
}

function showInfo(id, source, time_start, time_end) {
  const {fileName, url} = getInfoAboutMedia(id, source, time_start);

  const $dlg = $('#info-dialog-content').html(`
    <h3><a href="${url}" target="_blank">${fileName}</a></h3>
    <h4>${source}</h4>
    <h4>${fromSeconds(time_start)} - ${fromSeconds(time_end)}</h4>
  `)
  // Pin to the top of the viewport — by default jQuery UI centers in the
  // window, which on a scrolled page can land it below the fold.
  const position = { my: 'center top', at: 'center top+20', of: window }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', 'position', position).dialog('open')
  } else {
    $dlg.dialog({ position })
  }
}

const changeIndices = (id, from, to) => {
  $('#' + id).data({fromIndex: from, toIndex: to})
}

function collapseSubLines(evt) {
  $(evt.target).parents('.lines-cntnr').find('.sub-lines-cntnr').slideToggle('slow')
}

// Inline SVG/glyph for the media source. Falls back to the literal name
// for unknown sources so we never silently drop a source label.
function _sourceBadgeHtml(source) {
  const s = (source || '').toLowerCase()
  if (s === 'youtube') {
    return `<svg class="src-ico src-ico-yt" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="14" aria-label="YouTube" fill="#FF0000">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-5.8 31 31 0 0 0-.5-5.8z"/>
      <path d="M9.6 15.6 15.8 12 9.6 8.4z" fill="#fff"/>
    </svg>`
  }
  if (s === 'svt') {
    return `<span class="src-ico src-ico-svt" aria-label="SVT">SVT</span>`
  }
  return _.escape(source || '')
}

// Path on gh-pages for a given (link, langCode) — `code` is 'en' or the
// current target language (sv / es). Falls back to allSubtitles[link].fileName
// if the srts index lookup misses (e.g. local-loaded files).
function _srtPathFor(link, langCode) {
  const lang = getLangFromUrl()
  const srt = window.srts && window.srts.find(it => it.link === link)
  const baseName = _nfc((srt && srt.name) || (window.allSubtitles[link] && window.allSubtitles[link].fileName))
  if (!baseName) return null
  const suffix = langCode === 'en' ? '.en.srt' : ('.' + lang.code + '.srt')
  return `db/language/${lang.fullName}/srts/${baseName}${suffix}`
}

// Replace the text body of the SRT block whose first line is `lineIndex`.
// Block surgery instead of parse/rebuild so timestamp formatting (comma vs
// dot, trailing newlines) survives the round-trip verbatim. Returns null
// if the index isn't found so the caller can surface a clear error.
function _replaceSrtLine(rawSrt, lineIndex, newText) {
  if (!rawSrt) return null
  const target = String(lineIndex).trim()
  const blocks = rawSrt.split(/\r?\n\r?\n/)
  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split(/\r?\n/)
    if (lines[0] && lines[0].trim() === target && lines[1] && /-->/.test(lines[1])) {
      const cleaned = String(newText || '').replace(/\r?\n+$/, '')
      blocks[i] = [lines[0], lines[1], cleaned].join('\n')
      return blocks.join('\n\n')
    }
  }
  return null
}

// Persist an edited subtitle line back to GitHub and refresh in-memory caches
// so the UI updates without a re-search. Concurrent-safe: commitWithMerge
// re-runs `merge` on a 409/422, so the line-edit is re-applied against the
// latest remote text.
async function _saveSubtitleEdit(link, langCode, lineIndex, newText) {
  const filePath = _srtPathFor(link, langCode)
  if (!filePath) throw new Error('No SRT path for ' + link)
  const key = langCode === 'en' ? 'en' : 'sv'
  const stored = window.allSubtitles[link]
  if (!stored || !stored[key]) throw new Error('SRT not loaded for ' + link)

  const updated = _replaceSrtLine(stored[key], lineIndex, newText)
  if (!updated) throw new Error(`Line ${lineIndex} not found in ${filePath}`)

  // Optimistic local update — render immediately and let the network catch up.
  // srtToJson now populates item.text on every parse (and mirrors to
  // item[lang] when lang is given), so the lang argument is safe here.
  stored[key] = updated
  if (key === 'sv' && stored._parsedSv) stored._parsedSv = srtToJson(updated, 'sv')
  if (key === 'en' && stored._parsedEn) stored._parsedEn = srtToJson(updated, 'en')
  if (window.searchResult) {
    const hit = window.searchResult.find(it => it && it.url === link)
    if (hit) {
      const sk = key === 'sv' ? 'sv_subs' : 'en_subs'
      if (hit[sk]) hit[sk].data = srtToJson(updated, key)
    }
  }

  // Queue this edit instead of pushing a per-line commit. A debounced
  // background flush (or the manual Sync-Edits button in Settings) groups
  // multiple edits across files into a single commit via commitMultipleFiles.
  _queueSubtitleEdit(filePath, lineIndex, newText)
  return true
}

// ── Batched inline SRT edits ─────────────────────────────────────────────
// Each save buffers a (filePath, lineIndex, newText) entry to localStorage.
// A debounced timer (or an explicit `Sync Edits` button) flushes the whole
// buffer in one commit using GitHubUtils.commitMultipleFiles. This stops
// per-line edits from racking up dozens of commits when the user fixes
// translations in bulk.
const SRT_EDITS_KEY = 'cupitor:pendingSrtEdits'
const SRT_EDITS_FLUSH_MS = 10000  // 10s after the last edit
let _srtEditsFlushTimer = null

function _loadPendingSrtEdits() {
  try {
    const raw = localStorage.getItem(SRT_EDITS_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch (_) { return {} }
}
function _savePendingSrtEdits(edits) {
  try {
    if (!edits || !Object.keys(edits).length) localStorage.removeItem(SRT_EDITS_KEY)
    else localStorage.setItem(SRT_EDITS_KEY, JSON.stringify(edits))
  } catch (_) {}
}
function _pendingSrtEditCount(edits) {
  edits = edits || _loadPendingSrtEdits()
  return Object.values(edits).reduce((n, perFile) => n + Object.keys(perFile || {}).length, 0)
}
function _queueSubtitleEdit(filePath, lineIndex, newText) {
  const edits = _loadPendingSrtEdits()
  if (!edits[filePath]) edits[filePath] = {}
  edits[filePath][String(lineIndex)] = { newText, ts: Date.now() }
  _savePendingSrtEdits(edits)
  _updateSrtEditsUi()
  // Auto-flush was previously firing 10s after the last edit. Now that the
  // Sync button opens a Review dialog instead of pushing directly, we wait
  // for explicit user action — no silent pushes.
}
// Map an SRT file path back to its index.json `link` (videoId). The file
// naming convention is `<basename>.<langCode>.srt` and `srts/index.json`
// stores `{link, name=basename}`. Used by flushPendingSrtEdits below to
// invalidate the IndexedDB cache for any video whose SRT just got rewritten.
function _filePathToLink(filePath) {
  if (!filePath) return null
  try {
    const m = String(filePath).match(/\/srts\/(.+?)\.[a-z]{2,3}\.srt$/i)
    if (!m) return null
    const baseName = _nfc(decodeURIComponent(m[1]))
    const srt = (window.srts || []).find(s => s && _nfc(s.name) === baseName)
    return srt ? srt.link : null
  } catch (_) { return null }
}

async function flushPendingSrtEdits() {
  const edits = _loadPendingSrtEdits()
  const paths = Object.keys(edits)
  if (!paths.length) return { committed: false, reason: 'empty' }
  const totalLines = _pendingSrtEditCount(edits)
  // Pre-derive links so we can invalidate the cache after a successful
  // commit, even if the commit re-fetches the merged content lazily inside
  // getContent (we want to invalidate by link, not by filePath).
  const editedLinks = new Set()
  for (const filePath of paths) {
    const link = _filePathToLink(filePath)
    if (link) editedLinks.add(link)
  }
  const files = paths.map(filePath => ({
    path: filePath,
    getContent: (current) => {
      // No remote file → skip (don't create a fresh SRT from edits alone).
      if (!current) {
        console.warn(`flushPendingSrtEdits: ${filePath} not on remote; skipping`)
        return null
      }
      let updated = current
      Object.entries(edits[filePath]).forEach(([lineIndex, entry]) => {
        const next = _replaceSrtLine(updated, lineIndex, entry.newText)
        if (next) updated = next
        else console.warn(`flushPendingSrtEdits: line ${lineIndex} not in ${filePath}; edit dropped`)
      })
      return updated
    }
  }))
  const msg = `srt: batch edit — ${paths.length} file${paths.length === 1 ? '' : 's'}, ${totalLines} line${totalLines === 1 ? '' : 's'}`
  const result = await window.GitHubUtils.commitMultipleFiles({
    owner: 'trexsatya',
    repo: 'trexsatya.github.io',
    branch: 'gh-pages',
    commitMessage: msg,
    files
  })
  // Clear the buffer if the commit landed OR if nothing actually changed
  // (every queued edit already matched remote — buffer is stale, drop it).
  if (!result || result.committed !== false || result.reason === 'no-changes') {
    _savePendingSrtEdits({})
    // The commit just rewrote one or more server-side SRTs; any cached
    // pair for those links is now stale. Drop them so a subsequent
    // getSubtitlesForLink (or the next boot's cache pass) refetches.
    if (editedLinks.size) {
      _cacheDeleteMany([...editedLinks]).catch(e => console.warn('[cache] post-edit evict failed', e))
    }
  }
  _updateSrtEditsUi()
  return result
}
window.flushPendingSrtEdits = flushPendingSrtEdits

function _updateSrtEditsUi() {
  const n = _pendingSrtEditCount()
  const $btn = $('#syncSrtEditsBtn')
  if (!$btn.length) return
  $btn.attr('data-count', n)
  $btn.text(n ? `Sync edits (${n})` : 'Sync edits')
  $btn.toggleClass('has-pending', n > 0)
}
window._updateSrtEditsUi = _updateSrtEditsUi

// Wire the Settings "Sync edits" button (rendered in language.html) and
// surface the initial pending count once the DOM is ready.
$(function () {
  // The Sync button now opens a Review dialog instead of pushing straight to
  // GitHub. The user picks which edits to keep, tweaks any text they want,
  // then explicitly pushes — far less scary for bulk fixes.
  $(document).on('click', '#syncSrtEditsBtn', function () {
    const n = _pendingSrtEditCount()
    if (!n) { alert('No pending subtitle edits to push.'); return }
    openSrtEditsReviewDialog()
  })
  // In-dialog actions: select all / none, discard checked, push checked.
  $(document).on('click', '#srtEditsSelectAll',  function () { $('#srtEditsReviewList .srt-review-keep').prop('checked', true) })
  $(document).on('click', '#srtEditsSelectNone', function () { $('#srtEditsReviewList .srt-review-keep').prop('checked', false) })
  $(document).on('click', '#srtEditsDiscardSelected', _onSrtEditsDiscardSelected)
  $(document).on('click', '#srtEditsPushSelected',    _onSrtEditsPushSelected)
  try { _updateSrtEditsUi() } catch (_) {}
  try { _updatePlayUnavailableBadge() } catch (_) {}
})

// Build a per-(file,line) row inside the review list. The textarea is
// editable so the user can refine the text right before pushing.
function _renderSrtEditsReviewList() {
  const $list = $('#srtEditsReviewList').empty()
  const edits = _loadPendingSrtEdits()
  const paths = Object.keys(edits).sort()
  if (!paths.length) {
    $list.append('<div class="srt-review-empty">No pending edits.</div>')
    return
  }
  paths.forEach(filePath => {
    const lines = edits[filePath] || {}
    const lineKeys = Object.keys(lines).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    if (!lineKeys.length) return
    const $group = $(`<div class="srt-review-file"></div>`)
    // Trim the long `db/language/<Lang>/srts/` prefix to keep the header
    // readable; full path lives in the title attribute for hover.
    const shortName = filePath.replace(/^db\/language\/[^/]+\/srts\//, '')
    $group.append($('<div class="srt-review-file-head"></div>')
      .attr('title', filePath)
      .text(`${shortName} — ${lineKeys.length} edit${lineKeys.length === 1 ? '' : 's'}`))
    lineKeys.forEach(li => {
      const entry = lines[li] || {}
      const ageMs = Math.max(0, Date.now() - (entry.ts || 0))
      const ageMin = Math.round(ageMs / 60000)
      const $row = $(`<div class="srt-review-row" data-file="${escapeHtml(filePath)}" data-line="${escapeHtml(li)}">
          <label class="srt-review-keep-wrap">
            <input type="checkbox" class="srt-review-keep" checked>
            <span class="srt-review-meta">#${escapeHtml(li)} <span class="srt-review-age">${ageMin < 1 ? 'just now' : ageMin + 'm ago'}</span></span>
          </label>
          <textarea class="srt-review-text" rows="2"></textarea>
        </div>`)
      $row.find('.srt-review-text').val(String(entry.newText || ''))
      $group.append($row)
    })
    $list.append($group)
  })
}

// Collect (filePath, lineIndex, newText) tuples from rows whose checkbox is
// in `state`. Reading values from the textareas means the user's in-dialog
// tweaks come along for the ride.
function _collectSrtEditsByCheckbox(checked) {
  const out = []
  $('#srtEditsReviewList .srt-review-row').each(function () {
    const $row = $(this)
    if ($row.find('.srt-review-keep').is(':checked') !== !!checked) return
    out.push({
      filePath: $row.attr('data-file'),
      lineIndex: $row.attr('data-line'),
      newText: String($row.find('.srt-review-text').val() || '')
    })
  })
  return out
}

function openSrtEditsReviewDialog() {
  _renderSrtEditsReviewList()
  const $dlg = $('#srtEditsReviewDialog')
  const opts = {
    width: Math.min(680, Math.round(window.innerWidth * 0.95)),
    height: Math.min(640, Math.round(window.innerHeight * 0.85)),
    modal: false,
    open: function () {
      // Keep focus off the first textarea so the soft keyboard doesn't pop
      // up immediately — mirrors the rare-words dialog fix.
      $(this).closest('.ui-dialog').attr('tabindex', -1).trigger('focus')
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', opts).dialog('open')
  } else {
    $dlg.dialog(opts)
  }
}
window.openSrtEditsReviewDialog = openSrtEditsReviewDialog

async function _onSrtEditsPushSelected() {
  const keep = _collectSrtEditsByCheckbox(true)
  if (!keep.length) { alert('Select at least one edit to push.'); return }
  // Persist the user's in-dialog text tweaks back into the buffer first —
  // discard everything that's unchecked, then flush.
  const next = {}
  keep.forEach(({ filePath, lineIndex, newText }) => {
    if (!next[filePath]) next[filePath] = {}
    next[filePath][String(lineIndex)] = { newText, ts: Date.now() }
  })
  _savePendingSrtEdits(next)
  _updateSrtEditsUi()
  const $btn = $('#srtEditsPushSelected').prop('disabled', true).text('Pushing…')
  try {
    const r = await flushPendingSrtEdits()
    if (r && r.committed === false) {
      alert('No commit produced: ' + (r.reason || 'remote already matches'))
    }
    try { $('#srtEditsReviewDialog').dialog('close') } catch (_) {}
  } catch (e) {
    alert('Push failed: ' + (e && e.message || e))
  } finally {
    $btn.prop('disabled', false).text('Push selected')
    _updateSrtEditsUi()
  }
}

function _onSrtEditsDiscardSelected() {
  const drop = _collectSrtEditsByCheckbox(true)
  if (!drop.length) { alert('Select at least one edit to discard.'); return }
  if (!confirm(`Discard ${drop.length} edit${drop.length === 1 ? '' : 's'}? This can't be undone.`)) return
  const buf = _loadPendingSrtEdits()
  drop.forEach(({ filePath, lineIndex }) => {
    if (buf[filePath]) {
      delete buf[filePath][String(lineIndex)]
      if (!Object.keys(buf[filePath]).length) delete buf[filePath]
    }
  })
  _savePendingSrtEdits(buf)
  _updateSrtEditsUi()
  _renderSrtEditsReviewList()
  if (!_pendingSrtEditCount()) {
    try { $('#srtEditsReviewDialog').dialog('close') } catch (_) {}
  }
}

// Get the current plain text for a given (link, langCode, lineIndex) by
// parsing the raw SRT we have in memory. Used to seed the textarea so
// the editor starts with the actual stored text (not the highlight-marked
// HTML version).
function _getRawSubtitleLineText(link, langCode, lineIndex) {
  const key = langCode === 'en' ? 'en' : 'sv'
  const stored = window.allSubtitles[link]
  if (!stored || !stored[key]) return ''
  const target = String(lineIndex).trim()
  const blocks = stored[key].split(/\r?\n\r?\n/)
  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    if (lines[0] && lines[0].trim() === target && lines[1] && /-->/.test(lines[1])) {
      return lines.slice(2).join('\n').trim()
    }
  }
  return ''
}

function renderLines(id, url) {
  const $container = $('#' + id).addClass('lines-cntnr');
  let fromLineIndex = parseInt($container.data('fromIndex'))
  let toLineIndex = parseInt($container.data('toIndex'))
  // Set by populateSRTFindings; survives +/- adjustments. May be NaN for
  // legacy paths that don't supply it.
  const matchLineIndex = parseInt($container.data('matchLineIndex'))

  if (fromLineIndex < 1) {
    fromLineIndex = 1
  }

  if (toLineIndex < fromLineIndex) {
    toLineIndex = fromLineIndex;
  }

  const lang = getSelectedLang()
  const subtitleFile = window.searchResult.find(it => it.url === url)[lang === 'sv' ? 'sv_subs' : 'en_subs']

  // Clamp toLineIndex to the file's last index so a default-context window
  // (or repeated "+" clicks) that overshoots doesn't crash on getSub() →
  // undefined.end.ordinal.
  if (subtitleFile && subtitleFile.data && subtitleFile.data.length) {
    const lastIdx = subtitleFile.data.reduce((m, it) => Math.max(m, it.index), 0)
    if (toLineIndex > lastIdx) toLineIndex = lastIdx
    if (fromLineIndex > lastIdx) fromLineIndex = lastIdx
  }

  const getSub = x => subtitleFile.data.find(it => it.index + '' === x + '');
  const st = getSub(fromLineIndex);
  const end = getSub(toLineIndex)
  // Contract the play-bounds to the contiguous temporal segment that
  // contains matchLineIndex. SRTs in this app are SPARSE — multiple captures
  // across distant moments of the same video get stitched into one file, so
  // a context window (matchIdx ± N) can straddle a multi-hour gap (e.g.
  // line 5 at 38:17 followed by line 6 at 4:20:52). Spanning that gap with
  // {timeStart=segA.start, timeEnd=segB.end} produces a 3.7h "clip" that
  // never terminates in playback. Detection: any consecutive-line gap
  // larger than `MAX_GAP_S` is a discontinuity; stop walking outward when
  // we encounter one. Display still shows the full window — only the
  // play-button's time bounds get contracted.
  const MAX_GAP_S = 60
  let _playFromIdx = fromLineIndex
  let _playToIdx   = toLineIndex
  if (Number.isFinite(matchLineIndex) && matchLineIndex >= fromLineIndex && matchLineIndex <= toLineIndex) {
    let cur = getSub(matchLineIndex)
    if (cur && cur.start && cur.end) {
      // Walk backward while adjacent lines are temporally contiguous.
      let prev = cur
      for (let i = matchLineIndex - 1; i >= fromLineIndex; i--) {
        const s = getSub(i)
        if (!s || !s.end || !s.start) break
        if ((prev.start.ordinal - s.end.ordinal) > MAX_GAP_S) break
        _playFromIdx = i
        prev = s
      }
      // Walk forward similarly.
      let next = cur
      for (let i = matchLineIndex + 1; i <= toLineIndex; i++) {
        const s = getSub(i)
        if (!s || !s.start || !s.end) break
        if ((s.start.ordinal - next.end.ordinal) > MAX_GAP_S) break
        _playToIdx = i
        next = s
      }
    }
  }
  const _playSt  = getSub(_playFromIdx) || st
  const _playEnd = getSub(_playToIdx)   || end
  const timeStart = parseInt(Math.floor(_playSt.start.ordinal));
  const timeEnd   = parseInt(Math.ceil(_playEnd.end.ordinal));

  const showInfoBtn = `<span class="show-info-btn">
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-info-circle media-info" viewBox="0 0 16 16" style="cursor: pointer;">
           <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
           <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
     </svg>
     <span class="info" style="display: none;">
            <span class="info times"> ${timeStart}-${timeEnd} </span>
     </span>
    </span>`

  const playMediaBtn =
      `<img src="/img/icons/play_icon.png" alt="" style="display:none; width: 20px;height: 20px;cursor: pointer;" class="play-btn">`


  function truncate(str, n) {
    return (str.length > n) ? str.slice(0, n - 1) + '&hellip;' : str;
  };

  const infoButton = () => {
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

  <span class="play-btn-container" style="text-align: center;" data-id="${id}" data-url="${url}" data-source="${subtitleFile.source || ''}" data-time-start="${timeStart}" data-time-end="${timeEnd}" data-match-line-index="${Number.isFinite(matchLineIndex) ? matchLineIndex : ''}">
     <span class="info btn collapse-sub-lines"> 🗖 </span>
     <span class="info source-tag" data-source="${(subtitleFile.source || '').toLowerCase()}" title="${_.escape(subtitleFile.source || '')}">${_sourceBadgeHtml(subtitleFile.source)}</span>
     ${infoButton()}
  </span>
  <span class="capture-btn btn" title="Add this match to the current recording">●</span>
  <span style="float: right;">
    <span class="remove-prev-btn btn" > - </span>
    <span class="add-next-btn btn"> + </span>
  </span>
</div>

`

  let subForLines = ''
  const mainSubPanel = $('<div>')
  const secondarySubPanel = $('<div>')


  const mainLangCode = getLangFromUrl().code  // sv / es / …
  range(fromLineIndex, toLineIndex - fromLineIndex + 1).forEach(idx => {
    const sub = getSub(idx)
    const {mainSub, secondarySub} = getMainSubAndSecondarySub(subtitleFile, ({...sub}));
    const subIdx = (sub && sub.index != null) ? String(sub.index) : ''
    const lineMain = `<div class="line main-line" data-url="${url}" data-line-index="${subIdx}" data-lang-code="${mainLangCode}"><span class="line-text">${mainSub.text}</span><span class="edit-line-btn" title="Edit translation">✎</span></div>`;
    subForLines += lineMain
    mainSubPanel.append(lineMain)
    if (secondarySub && secondarySub.text) {
      const lineSec = `<div class="line secondary-line" data-url="${url}" data-line-index="${subIdx}" data-lang-code="en"><span class="line-text">${secondarySub.text}</span><span class="edit-line-btn" title="Edit translation">✎</span></div>`;
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

  // After +/- shifts the visible window, the displayed time range changes.
  // If this match is already in the recording, mutate the stored entry's
  // timeStart/timeEnd to follow the new window — otherwise the recording
  // would replay the original (stale) range. Also re-mark the capture
  // button (already done inside renderLines, but harmless to repeat).
  const _syncOnWindowChange = () => {
    try {
      _syncCapturedItemTimes('' + id, '' + url)
      _markCapturedButtons()
    } catch (_) {}
  }
  $($container).find('.add-prev-btn').click(e => {
    changeIndices(''+id, fromLineIndex - 1, toLineIndex); renderLines(''+id, ''+url); _syncOnWindowChange();
  })
  $($container).find('.remove-next-btn').click(e => {
    changeIndices(''+id, fromLineIndex + 1, toLineIndex); renderLines(''+id, ''+url); _syncOnWindowChange();
  })
  $($container).find('.remove-prev-btn').click(e => {
    changeIndices(''+id, fromLineIndex, toLineIndex - 1); renderLines(''+id, ''+url); _syncOnWindowChange();
  })
  $($container).find('.add-next-btn').click(e => {
    changeIndices(''+id, fromLineIndex, toLineIndex + 1); renderLines(''+id, ''+url); _syncOnWindowChange();
  })

  if (!isDesktop()) {
    $('.play-btn-container').css({marginLeft: '3%'})
  }
  // Reflect already-captured state on the newly rendered capture button.
  try { _markCapturedButtons() } catch (_) {}
}

// After a window shift via +/-, mirror the new (timeStart, timeEnd) into
// any recording entry that matches (searchText, word, id, lineIndex) for
// the given .lines-cntnr. No-op when nothing in the recording matches.
function _syncCapturedItemTimes(containerId, url) {
  const $container = $('#' + containerId)
  if (!$container.length) return
  const $pbc = $container.find('.play-btn-container').first()
  const newTimeStart = parseInt($pbc.attr('data-time-start'), 10)
  const newTimeEnd   = parseInt($pbc.attr('data-time-end'),   10)
  const lineIndex    = parseInt($pbc.attr('data-match-line-index'), 10)
  if (!Number.isFinite(newTimeStart) || !Number.isFinite(newTimeEnd) || !Number.isFinite(lineIndex)) return
  const word       = ($container.closest('.srt-file').find('h4[data-file]').first().text() || '').trim()
  const searchText = (window.searchText || '').trim()
  if (!word || !searchText) return
  const items = window._recording && window._recording.items
  const arr = items && items[searchText] && items[searchText][word]
  if (!arr || !arr.length) return
  let modified = false
  arr.forEach(it => {
    if (it && it.id === url && parseInt(it.lineIndex, 10) === lineIndex) {
      if (it.timeStart !== newTimeStart || it.timeEnd !== newTimeEnd) {
        it.timeStart = newTimeStart
        it.timeEnd   = newTimeEnd
        modified = true
      }
    }
  })
  if (modified) {
    try { _saveRecording() } catch (_) {}
    try { _updateRecordingUI() } catch (_) {}
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

// Extract the channel name from an SRT base name. Capture/upload paths
// stamp the file as `${channel} || ${title} || ${id}`, so split on " || "
// and take the first segment. Falls back to "(unknown)" so the channel
// dialog has a sensible bucket for legacy entries that lack the channel
// prefix.
function _channelOfItem(item) {
  if (!item) return null
  const link = item.url || item.id || item.link
  if (!link) return null
  const srt = window.srts && window.srts.find(s => s && s.link === link)
  if (!srt) return null
  const name = String(srt.name || '')
  const idx = name.indexOf(' || ')
  return (idx > 0 ? name.slice(0, idx) : name).trim() || null
}

function _isChannelBlocked(channel) {
  if (!channel) return false
  const blocked = (window._appSettings && window._appSettings.blockedChannels) || []
  return blocked.includes(channel)
}

// Demote items from blocked channels to fallback: keep them only when no
// non-blocked items survive the rest of the filter pipeline for this word.
function _applyBlockedChannelFallback(items) {
  const blocked = new Set((window._appSettings && window._appSettings.blockedChannels) || [])
  if (!blocked.size) return items
  const allowed = items.filter(it => !blocked.has(_channelOfItem(it)))
  return allowed.length ? allowed : items
}

function groupAndArrangeResults(items) {
  // Source filtering was removed — only YouTube is supported now, so every
  // result is kept. Blocked-channel demotion still applies: if every
  // surviving item is from a blocked channel, we fall back to showing them
  // so the word doesn't render empty.
  items = _applyBlockedChannelFallback(items)
  const mediaFileNames = window.allMediaFileNames || []
  // Use a defensive read on window.categories: it's set by fetchCategorisation
  // late in loadAllSubtitles, so a flaky boot (failed srts/index.json fetch,
  // for example) can leave it undefined. Touching it as a free variable
  // would ReferenceError in module strict mode and kill the whole render.
  const _cats = window.categories || {}
  let grouped = _.groupBy(items, it => {
    let c = _cats[it.url];
    c = c || '';
    c = c.trim();
    return c
  })
  grouped = _.zip(...Object.values(grouped));
  grouped = _.sortBy(grouped, it => it.filter(it => it).length).reverse()
  items = grouped.flat().filter(it => it)
  items = items.toSorted((x, y) => {
    if (mediaFileNames.some(it => _.includes(it, x.url))) return -1
  })
  return items.filter(it => it)
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
    try {
    let items = wordToItemsMap[word] || []
    if (!items.length) {
      const w = Object.keys(wordToItemsMap).find(it => it.trim() === word.trim())
      if (w) items = wordToItemsMap[w]
    }
    let title = word
    if (word.trim().length !== word.length) {
      title = `"${word}"`
    }

    const wordBlock = $(`<div ><h5 class="l-accordion ${items.length ? '' : 'no-result'}"><i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i> ${title} <span class="match-count"></span></h5></div>`)
    items = items.toSorted((x, y) => x.path === window.preferredFile ? -1 : 1)

    const isMultiWord = word.trim().split(/\s+/).length > 1
    const wikiPart = isMultiWord
        ? `<a class="link" href="https://${getLangFromUrl().code}.wiktionary.org/w/index.php?search=${encodeURIComponent(word.trim()).replace(/%20/g, '+')}" target="_blank">${word}</a>`
        : getWikiLinks(word)
    wordBlock.append(`<div style=""> Wiki: ${wikiPart} 丨
        <a href="https://www.google.com/search?q=${word}&udm=2" target="_blank">Images</a> 丨
        <a href="https://filmot.com/search/%22${word}%22/1?lang=${getLangFromUrl().code}" target="_blank">YouTube (Filmot)</a> </div> <br>`)

    $result.append(wordBlock)

    items = groupAndArrangeResults(items)
    // Total available matches after source-filter / dedup grouping. Shown
    // in the accordion header so the user knows how many hits a word has,
    // even when only `numberOfItemsToShow()` are rendered below.
    const totalMatches = items.length

    // (Previously: when toggle=EN, dedup items whose parallel-index SV text
    // shared any non-common word with an already-rendered item's SV side.
    // That was designed for "viewing EN translations of SV searches", but the
    // search pipeline always runs *in* the selected language — for a direct
    // EN search every hit's parallel SV line shares a form of the searched
    // word, so item #2..N all looked like duplicates and got dropped. The
    // header count showed the true total, the body showed only one row.
    // Removing the dedup; the per-result list is short enough that genuine
    // duplicates aren't a real UX problem.)
    const rendered = [];

    for (let i = 0; i < items.length; i++) {
      if (rendered.length >= numberOfItemsToShow()) {
        break;
      }

      const item = items[i];

      try {
        const $fileBlock = $(`<div class="srt-file" title="${item['name']}">
                              <h4 data-file="${item.url}" style="display: none;"> ${word} </h4>
                          </div>`)

        wordBlock.append($fileBlock)

        const id = uuid()
        const $lines = $(`<div id="${id}" style="padding-top: 4px; padding-bottom: 8px;"></div>`)
        // Expand the visible window by the user-configured context. renderLines
        // clamps fromIndex to >= 1 and (with the new clamp below) toIndex to
        // the file's last index, so passing out-of-range values is safe.
        // Coerce everything to Number: the SRT parser stores `line.index` as a
        // string, so `index + _after` would concatenate ("103" + 2 → "1032"),
        // ballooning toIndex so the renderLines file-end clamp shows every line
        // from the match to EOF — i.e. "more than configured lines after match".
        // Subtraction (used for fromIndex) always coerces numerically, which is
        // why _before never tripped this. Also defensively coerce the settings.
        const _before = parseInt((window._appSettings && window._appSettings.contextLinesBefore), 10) || 0
        const _after = parseInt((window._appSettings && window._appSettings.contextLinesAfter), 10) || 0
        const matchIdx = parseInt(item.line.index, 10) || 0
        // Stash the matched line's SRT index so renderLines can expose it
        // to the capture button (the +/- buttons mutate from/toIndex, but
        // the underlying matched line never changes).
        $lines.data({fromIndex: matchIdx - _before, toIndex: matchIdx + _after, matchLineIndex: matchIdx})
        $fileBlock.append($lines)

        renderLines(id, item.url)
        rendered.push(item)
      } catch (perItemErr) {
        // One bad item shouldn't kill the whole word block. Log and move on.
        console.error('populateSRTFindings: failed to render item for', word, item, perItemErr)
      }
    }//end for

    // Header bookkeeping: show a match count, and grey the header out if
    // the post-filter pipeline produced nothing (sources disabled, all
    // duplicates, etc.) so the user can tell apart "no hits" from
    // "hits, just collapsed".
    if (totalMatches > 0) {
      wordBlock.find('.match-count').text(`(${totalMatches})`)
    }
    if (rendered.length === 0) {
      wordBlock.find('.l-accordion').addClass('no-result')
    }
    } catch (perWordErr) {
      // Per-word failures (missing categories, bad item shape, …) used to
      // break the entire results render. Log and continue so the user
      // still sees results for the other words.
      console.error('populateSRTFindings: failed for word', word, perWordErr)
    }
  })
    await yieldToUI()
    // Measure the sticky accordion height once we've rendered enough chunks
    // for one to be on the page, and feed it back as a CSS variable so
    // `.lines-cntnr .buttons`' sticky `top` parks flush against it (instead
    // of the previous 2.5rem gap that revealed scrolling content). Re-measure
    // on resize via a one-time listener.
    try { _refreshAccordionStickyHeight() } catch (_) {}
  }
}

let _accordionResizeBound = false
function _refreshAccordionStickyHeight() {
  const el = document.querySelector('#result .l-accordion:not(.no-result)') ||
             document.querySelector('#result .l-accordion')
  if (!el) return
  const h = el.getBoundingClientRect().height
  if (h > 0) {
    document.documentElement.style.setProperty('--accordion-h', h + 'px')
  }
  if (!_accordionResizeBound) {
    _accordionResizeBound = true
    window.addEventListener('resize', () => {
      // Debounce: only re-measure after the resize settles.
      clearTimeout(window._accordionMeasureT)
      window._accordionMeasureT = setTimeout(_refreshAccordionStickyHeight, 150)
    })
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
  // forceLangForNextSearch overrides the UI toggle for one search — used by
  // "Search here" on a clicked subtitle word (search in whichever language
  // the word was in, regardless of the toggle) and by rare-word / vocab
  // searches (always main lang).
  if (window.forceLangForNextSearch === 'sv' || window.forceLangForNextSearch === 'en') {
    return window.forceLangForNextSearch
  }
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
 * Returns true if any pipe-separated word in vocabLine shares a prefix OR
 * suffix with any pipe-separated alternative in searchText, in either
 * direction. So `cd` matches `bcd` (bcd ends with cd), and conversely
 * `bcd` matches `cd` for the same reason. `xyz` matches `xyzw` (prefix)
 * and `xyzw` matches `xyz` (also prefix) — the four combinations cover
 * every "one is a prefix/suffix of the other" relationship.
 */
function vocabLineMatchesPrefix(vocabLine, searchText) {
  const stRaw = (searchText || '').toLowerCase().trim()
  if (!stRaw) return false
  // Split BOTH sides on `|`. Length floor is 3: anything shorter is noise
  // (a 1- or 2-letter term would match nearly every line).
  const searchParts = stRaw.split(SEPARATOR_PIPE).map(s => s.trim()).filter(s => s.length >= 3)
  if (searchParts.length === 0) return false
  const vocabParts = vocabLine.split(SEPARATOR_PIPE).map(p => p.toLowerCase().trim()).filter(p => p.length >= 2)
  return vocabParts.some(p => searchParts.some(s =>
    s.startsWith(p) || p.startsWith(s) || s.endsWith(p) || p.endsWith(s)
  ))
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

// Strip SRT framing (block indices, timestamp lines) and collapse all
// whitespace so phrase regexes like /a b/i can match across consecutive
// subtitle lines. Without this, an "a" at the end of one entry and a "b"
// at the start of the next would be split by an index + timestamp block
// and never match. The cleaned text only feeds the file-inclusion filter
// here; per-line attribution still uses the parsed entries below.
function _cleanSrtForMatch(rawSrt) {
  if (!rawSrt) return ''
  return rawSrt
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\d\d:\d\d:\d\d[,.]\d{3} --> \d\d:\d\d:\d\d[,.]\d{3}.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchFromDownloadedFiles(lookingFor, token) {
  lookingFor = expandWords(lookingFor)

  const keys = Object.keys(window.allSubtitles)
      .filter(it => window.allSubtitles[it].sv && window.allSubtitles[it].en)
  const out = []
  const re = new RegExp(_relaxSpaces(lookingFor), "i")
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))
  const CHUNK = 100

  for (let start = 0; start < keys.length; start += CHUNK) {
    if (token !== undefined && token !== window._subtitleSearchToken) return out
    const end = Math.min(start + CHUNK, keys.length)
    for (let i = start; i < end; i++) {
      const it = keys[i]
      const svText = window.allSubtitles[it].sv
      const enText = window.allSubtitles[it].en
      // Match on the cleaned-text variants so multi-word phrases that
      // straddle two consecutive subtitle lines are kept (e.g. "a b"
      // across ".... a" then "b ....").
      const svMatch = svText && _cleanSrtForMatch(svText).match(re)
      const enMatch = enText && _cleanSrtForMatch(enText).match(re)
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
    // Capture the lang at record time so Prev/Next can replay the search in
    // the same language the user originally ran it (independent of the
    // current UI toggle). getSelectedLang() already honors any
    // forceLangForNextSearch override from "Search here".
    recordSessionSearch(_historyTerm, getSelectedLang())

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
      // Honor forceLangForNextSearch via getSelectedLang() so a "Search here"
      // on an EN word stems against English even when the UI toggle is on SV
      // (and vice-versa). Non-en uses the URL's lang for language-specific
      // stemmers.
      const sel = getSelectedLang()
      const stemLang = sel === 'en' ? 'en' : getLangFromUrl().code
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
    window.forceLangForNextSearch = null
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
  // Play / practice modes drive everything through their own floating overlay,
  // so the side player panel (speed controls, starred lines, etc.) just gets in
  // the way — keep it hidden while either mode is active.
  if (!window._playingRecording && !window._practiceActive) showMediaRelatedContainer()
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
  const record = { ...window.mediaBeingPlayed, lines }

  try {
    await commitWithMerge({
      filePath,
      commitMessage: `srt: update starred lines for ${window.mediaBeingPlayed.link}`,
      merge: (remoteText) => {
        let arr = []
        try { arr = remoteText ? JSON.parse(remoteText) : [] } catch (_) {}
        if (!Array.isArray(arr)) arr = []
        const idx = arr.findIndex(it => it.link === window.mediaBeingPlayed.link)
        if (idx >= 0) arr[idx] = record
        else arr.push(record)
        return JSON.stringify(arr, null, 2)
      }
    })
    console.log('Starred lines committed to GitHub')
    // The current set is now the saved baseline → hide Save until next change.
    window._starredBaseline = _starredSignature()
    try { _updateStarredLinesBtns() } catch (_) {}
    autoHideSettingsPanel()
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
  return mergeSrtWithResolution(existingText, newItems, null)
}

// Conflict-aware merge. `resolution` is a Map<startTimeStr, {action, text}>
// where action is 'keep' | 'use-new' | 'edit'. For every existing entry
// whose start matches a 'use-new' / 'edit' decision, the existing entry
// is dropped so the incoming one takes its place. For 'keep' decisions
// the incoming entry is dropped instead. Re-applied verbatim on every
// commit retry so the user's resolution survives 409/422 retries even if
// the remote text drifted between attempts.
function mergeSrtWithResolution(existingText, newItems, resolution) {
  const existing = parseSrtEntries(existingText)
  let incoming = (newItems || []).map(it => ({
    start: srtTimeFromValue(it.start),
    end: srtTimeFromValue(it.end),
    text: (it.text || '').replace(/\r\n/g, '\n')
  }))
  let filteredExisting = existing
  if (resolution && resolution.size) {
    filteredExisting = existing.filter(e => {
      const r = resolution.get(e.start)
      return !r || r.action === 'keep'
    })
    incoming = incoming.flatMap(e => {
      const r = resolution.get(e.start)
      if (!r) return [e]
      if (r.action === 'keep') return []
      if (r.action === 'edit') return [{ ...e, text: r.text }]
      return [e]   // 'use-new': keep as-is, existing already filtered out
    })
  }
  const all = filteredExisting.concat(incoming)
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

// Show the merge dialog for the given conflicts. Resolves with a
// Map<startTime, {action: 'keep' | 'use-new' | 'edit', text?}> picked by
// the user, or `null` if they cancel. Modal so any caller (e.g. Push All
// loop in the captured-subtitles dialog) pauses until the user decides.
function presentSrtMergeDialog(label, conflicts) {
  return new Promise((resolve) => {
    let $dlg = $('#srt-merge-dialog')
    if (!$dlg.length) {
      $dlg = $('<div id="srt-merge-dialog"></div>').appendTo('body')
    }
    const escId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_')
    const rows = conflicts.map((c, i) => {
      const rid = escId(c.start) + '-' + i
      return `
        <div class="srt-conflict" data-start="${_.escape(c.start)}" data-rid="${rid}">
          <div class="srt-conflict-time">${_.escape(c.start)} → ${_.escape(c.end)}</div>
          <div class="srt-conflict-cols">
            <div class="srt-conflict-side srt-conflict-existing">
              <div class="srt-conflict-head">Existing</div>
              <div class="srt-conflict-text">${_.escape(c.existingText)}</div>
            </div>
            <div class="srt-conflict-side srt-conflict-incoming">
              <div class="srt-conflict-head">New (captured)</div>
              <div class="srt-conflict-text">${_.escape(c.incomingText)}</div>
            </div>
          </div>
          <div class="srt-conflict-actions">
            <label><input type="radio" name="rsl-${rid}" value="keep" checked> ← Keep existing</label>
            <label><input type="radio" name="rsl-${rid}" value="use-new"> Use new →</label>
            <label><input type="radio" name="rsl-${rid}" value="edit"> Edit ✎</label>
          </div>
          <textarea class="srt-conflict-edit" rows="3" hidden>${_.escape(c.incomingText)}</textarea>
        </div>`
    }).join('')

    $dlg.html(`
      <p class="srt-merge-intro">The captured subtitle conflicts with <b>${_.escape(label)}</b> at ${conflicts.length} timestamp${conflicts.length === 1 ? '' : 's'}. Pick what to keep for each, then Apply.</p>
      <div class="srt-merge-list">${rows}</div>
    `)

    // Toggle the textarea when "Edit" is picked.
    $dlg.off('change', '.srt-conflict-actions input').on('change', '.srt-conflict-actions input', function () {
      const $c = $(this).closest('.srt-conflict')
      const isEdit = $(this).val() === 'edit'
      $c.find('.srt-conflict-edit').prop('hidden', !isEdit)
      if (isEdit) $c.find('.srt-conflict-edit').focus()
    })

    let settled = false
    const finalize = (result) => {
      if (settled) return; settled = true
      try { $dlg.dialog('close') } catch (_) {}
      resolve(result)
    }

    const opts = {
      title: 'Resolve subtitle conflicts',
      width: Math.min(720, $(window).width() - 40),
      height: Math.min(560, $(window).height() - 40),
      modal: true,
      autoOpen: true,
      position: { my: 'center top', at: 'center top+20', of: window },
      buttons: {
        'Apply': function () {
          const resolution = new Map()
          $dlg.find('.srt-conflict').each(function () {
            const $c = $(this)
            const start = $c.data('start')
            const action = $c.find('input[type=radio]:checked').val() || 'keep'
            const entry = { action }
            if (action === 'edit') {
              entry.text = String($c.find('.srt-conflict-edit').val() || '').trim()
            }
            resolution.set(start, entry)
          })
          finalize(resolution)
        },
        'Cancel': function () { finalize(null) }
      },
      close: function () { finalize(null) }   // covers ESC / X-button
    }
    if ($dlg.hasClass('ui-dialog-content')) {
      $dlg.dialog('option', opts).dialog('open')
    } else {
      $dlg.dialog(opts)
    }
  })
}

// Find entries where existing and incoming disagree on the same start time.
// Returns an array of {start, end, existingText, incomingText} — empty if
// the merge would be a clean union with no conflict resolution needed.
function detectSrtConflicts(existingText, newItems) {
  if (!existingText) return []
  const existing = parseSrtEntries(existingText)
  const byStart = new Map(existing.map(e => [e.start, e]))
  const conflicts = []
  ;(newItems || []).forEach(it => {
    const start = srtTimeFromValue(it.start)
    const end   = srtTimeFromValue(it.end)
    const incomingText = String(it.text || '').replace(/\r\n/g, '\n').trim()
    const ex = byStart.get(start)
    if (!ex) return
    if ((ex.text || '').trim() === incomingText) return
    conflicts.push({
      start,
      end,
      existingText: (ex.text || ''),
      incomingText
    })
  })
  return conflicts
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
  return _nfc([safeChannel, safeTitle, id].filter(Boolean).join(' || '))
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
      const hit = arr.find(it => it.link === videoId)
      return hit ? { ...hit, name: _nfc(hit.name) } : null
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

// Upload new SRT entries, merging them into whatever is currently on remote
// (read real-time via api.github.com). This is the only writer; concurrent
// captures from another client are preserved because we re-read + re-merge
// + re-PUT on sha conflict via commitWithMerge.
async function uploadSrtToGithub(baseName, langCode, newEntries, commitMessage, conflictResolution) {
  const lang = getLangFromUrl()
  baseName = _nfc(baseName)
  const fileName = `${baseName}.${langCode}.srt`
  const filePath = `db/language/${lang.fullName}/srts/${encodeURIComponent(fileName)}`
  const entries = newEntries || []
  await commitWithMerge({
    filePath,
    commitMessage,
    merge: (remoteText) => {
      return remoteText
        ? mergeSrtWithResolution(remoteText, entries, conflictResolution || null)
        : linesToSrtText(entries)
    }
  })
}

// Delete the media currently selected in #mp3Choice: drops both source-lang
// and en SRT files from gh-pages and removes the entry from index.json.
// In-memory state (window.srts, #mp3Choice options, window.allSubtitles) is
// pruned too so the UI reflects the deletion immediately.
async function deleteSelectedMedia() {
  const link = $('#mp3Choice').val()
  if (!link) { alert('Pick a media to delete first.'); return }
  const srt = (window.srts || []).find(it => it.link === link)
  const baseName = _nfc(srt && srt.name)
  if (!baseName) {
    alert('No index entry found for the selected media — nothing to delete on GitHub.')
    return
  }
  const label = baseName.replace(/\.(en|sv|es|de|fr)\.srt$/i, '')
  if (!confirm(`Delete "${label}" from GitHub?\n\nThis removes both SRT files and the index.json entry. The deletion cannot be undone from the UI.`)) return

  const lang = getLangFromUrl()
  const srtsDir = `db/language/${lang.fullName}/srts`
  const srcCode = lang.code
  // Most files are stored as `${baseName}.${langCode}.srt`. Try the source
  // language and English (target translation). 404 is treated as "already gone".
  const candidates = [`${baseName}.${srcCode}.srt`]
  if (srcCode !== 'en') candidates.push(`${baseName}.en.srt`)
  const owner = 'trexsatya', repo = 'trexsatya.github.io'
  for (const fileName of candidates) {
    const filePath = `${srtsDir}/${encodeURIComponent(fileName)}`
    try {
      await window.GitHubUtils.deleteFileWithLookup({
        owner, repo, filePath,
        commitMessage: `srt: delete ${fileName}`,
        branch: 'gh-pages'
      })
    } catch (e) {
      console.warn(`Failed to delete ${fileName}:`, e)
    }
  }

  // Remove the entry from index.json with the conflict-safe merge helper.
  try {
    await commitWithMerge({
      filePath: `${srtsDir}/index.json`,
      commitMessage: `srts: remove index entry for ${link}`,
      merge: (remoteText) => {
        let arr = []
        try { arr = remoteText ? JSON.parse(remoteText) : [] } catch (_) {}
        if (!Array.isArray(arr)) arr = []
        const filtered = arr.filter(it => it.link !== link)
        return JSON.stringify(filtered, null, 2)
      }
    })
  } catch (e) {
    console.error('Failed to update index.json:', e)
    alert('SRTs may have been deleted but index.json update failed: ' + e.message)
  }

  // Local-state cleanup so the UI matches GitHub.
  window.srts = (window.srts || []).filter(it => it.link !== link)
  if (window.allSubtitles && window.allSubtitles[link]) delete window.allSubtitles[link]
  // Drop the cached pair too so a future boot doesn't resurrect the deleted
  // entry's subtitles into window.allSubtitles. (Boot would also evict it
  // since it's no longer in srts/index.json, but cleaning up here keeps the
  // cache and in-memory state in sync this session.)
  _cacheDeleteOne(link).catch(e => console.warn('[cache] delete failed for', link, e))
  $(`#mp3Choice option[value="${link}"]`).remove()
  $('#mp3Choice').val('').trigger('change')

  // The video is gone — drop every playlist item that still points at it so
  // playback never tries to load a deleted video. (`link` is the videoId,
  // which is exactly what recorded items store in `id`.)
  try {
    const removed = removeVideoFromAllPlaylists(link)
    if (removed > 0) {
      alert(`Also removed ${removed} item(s) referencing this video from your playlists.`)
    }
  } catch (e) { console.warn('playlist cleanup after media delete failed', e) }

  autoHideSettingsPanel()
}
window.deleteSelectedMedia = deleteSelectedMedia

// ─── Manage menu (Channels / Rare words / Duplicate SRTs) ───────────────
// Tiny dropdown launcher hidden behind a single "Manage…" button to keep the
// settings panel chrome lean. Open on click; close on outside-click or
// after a menu item runs.
function toggleManageMenu() {
  const $m = $('#manageMenu')
  if (!$m.length) return
  $m.toggle()
}
function closeManageMenu() { $('#manageMenu').hide() }
window.toggleManageMenu = toggleManageMenu
window.closeManageMenu  = closeManageMenu
$(function () {
  $(document).on('click', '#manageBtn', function (e) {
    e.stopPropagation()
    toggleManageMenu()
  })
  $(document).on('click', function (e) {
    if (!$(e.target).closest('.manage-wrap').length) closeManageMenu()
  })
})

// ─── Duplicate SRT cleanup ──────────────────────────────────────────────
// Groups window.srts by `link` (videoId). Index entries should normally be
// 1:1 with videoId — duplicates only show up when the writes raced or the
// JSON was edited by hand. The dialog lists each group and lets the user
// delete the extras one by one (the first row in each group is treated as
// the canonical "keep" entry and has no Delete button).
function _findDuplicateSrtGroups() {
  const groups = new Map()
  ;(window.srts || []).forEach(it => {
    if (!it || !it.link) return
    if (!groups.has(it.link)) groups.set(it.link, [])
    groups.get(it.link).push({ name: _nfc(it.name), source: it.source || '' })
  })
  return Array.from(groups.entries())
    .filter(([, names]) => names.length > 1)
    .map(([link, entries]) => ({ link, entries }))
}

function openDuplicateSrtsDialog() {
  const $dlg = $('#duplicateSrtsDialog')
  _renderDuplicateSrtsList()
  const opts = {
    width: Math.min(720, Math.round(window.innerWidth * 0.95)),
    height: Math.min(560, Math.round(window.innerHeight * 0.85)),
    modal: false,
    open: function () {
      $(this).closest('.ui-dialog').attr('tabindex', -1).trigger('focus')
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) $dlg.dialog('option', opts).dialog('open')
  else $dlg.dialog(opts)
}
window.openDuplicateSrtsDialog = openDuplicateSrtsDialog

function _renderDuplicateSrtsList() {
  const $list = $('#duplicateSrtsList').empty()
  const groups = _findDuplicateSrtGroups()
  if (!groups.length) {
    $list.append('<div class="dup-srts-empty">No duplicate index entries found.</div>')
    return
  }
  groups.forEach(g => {
    const $g = $('<div class="dup-srts-group"></div>')
    $g.append($('<div class="dup-srts-head"></div>').text(`${g.link} — ${g.entries.length} entries`))
    g.entries.forEach((e, idx) => {
      const $row = $('<div class="dup-srts-row"></div>')
      const tag  = idx === 0 ? '<span class="dup-srts-keep">keep</span>' : ''
      $row.append($(`<span class="dup-srts-name">${tag}${_.escape(e.name)}</span>`))
      if (idx > 0) {
        const $btn = $('<button type="button" class="lang-tool-btn dup-srts-del">Delete</button>')
          .on('click', async () => {
            if (!confirm(`Delete "${e.name}" (${g.link})?\n\nThis removes both SRT files and the index entry on GitHub.`)) return
            $btn.prop('disabled', true).text('Deleting…')
            try {
              await _deleteDuplicateSrtEntry(g.link, e.name)
              _renderDuplicateSrtsList()
            } catch (err) {
              console.error('dup-srt delete failed', err)
              alert('Failed to delete: ' + (err && err.message || err))
              $btn.prop('disabled', false).text('Delete')
            }
          })
        $row.append($btn)
      }
      $g.append($row)
    })
    $list.append($g)
  })
}

// Like deleteSelectedMedia but scoped to ONE (link, baseName) tuple — used
// by the duplicate cleanup so unrelated entries for the same link are
// preserved. Also skips removeVideoFromAllPlaylists: if other srt entries
// for this link survive, playlist items pointing at the videoId are still
// valid.
async function _deleteDuplicateSrtEntry(link, baseName) {
  baseName = _nfc(baseName)
  const lang = getLangFromUrl()
  const srtsDir = `db/language/${lang.fullName}/srts`
  const srcCode = lang.code
  const candidates = [`${baseName}.${srcCode}.srt`]
  if (srcCode !== 'en') candidates.push(`${baseName}.en.srt`)
  const owner = 'trexsatya', repo = 'trexsatya.github.io'
  for (const fileName of candidates) {
    const filePath = `${srtsDir}/${encodeURIComponent(fileName)}`
    try {
      await window.GitHubUtils.deleteFileWithLookup({
        owner, repo, filePath,
        commitMessage: `srt: delete duplicate ${fileName}`,
        branch: 'gh-pages'
      })
    } catch (e) { console.warn(`Failed to delete ${fileName}:`, e) }
  }
  // Remove only the FIRST matching (link, name) so other duplicates remain
  // for explicit deletion (otherwise a single click would wipe the group).
  await commitWithMerge({
    filePath: `${srtsDir}/index.json`,
    commitMessage: `srts: remove duplicate index entry for ${link} / ${baseName}`,
    merge: (remoteText) => {
      let arr = []
      try { arr = remoteText ? JSON.parse(remoteText) : [] } catch (_) {}
      if (!Array.isArray(arr)) arr = []
      const idx = arr.findIndex(it => it && it.link === link && _nfc(it.name) === baseName)
      if (idx >= 0) arr.splice(idx, 1)
      return JSON.stringify(arr, null, 2)
    }
  })
  // Local-state cleanup: drop the first matching entry only.
  if (Array.isArray(window.srts)) {
    const i = window.srts.findIndex(it => it && it.link === link && _nfc(it.name) === baseName)
    if (i >= 0) window.srts.splice(i, 1)
  }
}
$(function () {
  $(document).on('click', '#duplicateSrtsRescan', _renderDuplicateSrtsList)
})

// ─── Unavailable YouTube videos cleanup ────────────────────────────────
// Two-stage detection so YouTube changing internal behavior doesn't silently
// break us:
//  1) Fast thumbnail pre-filter — mqdefault.jpg returns a 120×90 placeholder
//     for removed/private/embedding-disabled videos. Cheap (~200ms per id,
//     CORS-friendly, no API key). But it's an undocumented quirk that could
//     change anytime.
//  2) IFrame Player API confirmation — for each thumbnail-suspect, actually
//     try to instantiate a YT.Player and read its onError code (100, 101,
//     150 = canonical unavailability signals). Slow per-id (~2–4s) but it's
//     the documented contract YouTube itself depends on, so it's the source
//     of truth. If the player confirms "available", we drop the candidate.
// Per confirmed-unavailable video we then compute the "uniquely covered"
// vocabulary words — those that would lose ALL their SRT matches if the
// user deletes the video.
function _checkYoutubeAvailable(videoId) {
  return new Promise(resolve => {
    if (!videoId) return resolve(true)
    const img = new Image()
    let done = false
    const finish = (ok) => { if (!done) { done = true; resolve(ok) } }
    img.onload  = () => finish(img.naturalWidth !== 120)
    img.onerror = () => finish(false)
    img.src = `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`
    // Safety timeout — if YouTube is slow / network drops, don't hang.
    setTimeout(() => finish(true), 7000)
  })
}

// Resolves to:
//   'unavailable' — player reported error 100/101/150 (canonical signals)
//   'available'   — player onReady fired (video plays)
//   'unknown'     — API missing, timeout, or ambiguous error code (2, 5, …)
// Caller treats 'available' as a refutation of the thumbnail verdict; the
// other two keep the candidate in the unavailable list (conservative: don't
// silently drop suspects when we can't get a definitive signal).
function _confirmUnavailableViaPlayer(videoId) {
  return new Promise(resolve => {
    if (!videoId)                       return resolve('unknown')
    if (!window.YT || !window.YT.Player) return resolve('unknown')
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;'
    document.body.appendChild(host)
    const node = document.createElement('div')
    host.appendChild(node)
    let done = false, player = null
    const cleanup = () => {
      try { if (player && typeof player.destroy === 'function') player.destroy() } catch (_) {}
      try { host.remove() } catch (_) {}
    }
    const finish = (verdict) => {
      if (done) return
      done = true
      cleanup()
      resolve(verdict)
    }
    try {
      player = new YT.Player(node, {
        videoId,
        width: 1, height: 1,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1 },
        events: {
          onReady: () => finish('available'),
          onError: (e) => {
            const code = e && e.data
            if (code === 100 || code === 101 || code === 150) finish('unavailable')
            else finish('unknown')
          }
        }
      })
    } catch (_) {
      finish('unknown')
    }
    // Each iframe is expensive; cap wall-clock per probe so a stuck player
    // doesn't block the whole scan. 'unknown' on timeout keeps the candidate.
    setTimeout(() => finish('unknown'), 6000)
  })
}

// Build {word -> Set<videoId>} for every vocabulary entry that matches at
// least one in-memory SRT. Re-uses _cleanSrtForMatch + expandWords +
// _relaxSpaces from the rare-words pipeline so the matching rules stay
// consistent. Time-sliced to keep the UI responsive on large vocabularies.
async function _buildVocabToVideosMap(progressFn) {
  const subs = Object.entries(window.allSubtitles || {})
    .filter(([, s]) => s && (s.sv || s.en))
    .map(([link, s]) => ({
      link,
      sv: s.sv ? _cleanSrtForMatch(s.sv) : '',
      en: s.en ? _cleanSrtForMatch(s.en) : ''
    }))
  const seen = new Map()
  Object.entries(window.vocabulary || {}).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return
    lines.forEach(line => {
      const l = (line || '').trim()
      if (l.length < 2) return
      if (!seen.has(l)) seen.set(l, cat)
    })
  })
  const entries = Array.from(seen.keys())
  const out = new Map()  // word -> Set<videoId>
  const yieldToUI = () => new Promise(r => setTimeout(r, 0))
  const SLICE_MS = 25
  const now = () => (window.performance && performance.now) ? performance.now() : Date.now()
  let lastYield = now()
  for (let i = 0; i < entries.length; i++) {
    const line = entries[i]
    let re = null
    try {
      const expanded = expandWords(line, getLangFromUrl().code)
      re = new RegExp(_relaxSpaces(expanded), 'i')
    } catch (_) {}
    if (re) {
      const set = new Set()
      for (const sub of subs) {
        if ((sub.sv && re.test(sub.sv)) || (sub.en && re.test(sub.en))) set.add(sub.link)
      }
      if (set.size) out.set(line, set)
    }
    if (now() - lastYield > SLICE_MS) {
      if (progressFn) progressFn((i + 1) / entries.length)
      await yieldToUI()
      lastYield = now()
    }
  }
  if (progressFn) progressFn(1)
  return out
}

function _uniqueWordsForVideo(videoId, wordMap) {
  const out = []
  wordMap.forEach((set, word) => {
    if (set.size === 1 && set.has(videoId)) out.push(word)
  })
  return out.sort((a, b) => a.localeCompare(b))
}

async function openUnavailableVideosDialog() {
  const $dlg = $('#unavailableVideosDialog')
  $('#unavailableVideosList').empty()
  $('#unavailableVideosStatus').text('')
  const opts = {
    width:  Math.min(720, Math.round(window.innerWidth * 0.95)),
    height: Math.min(620, Math.round(window.innerHeight * 0.85)),
    modal:  false,
    open: function () {
      $(this).closest('.ui-dialog').attr('tabindex', -1).trigger('focus')
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) $dlg.dialog('option', opts).dialog('open')
  else $dlg.dialog(opts)
  await _scanUnavailableVideos()
}
window.openUnavailableVideosDialog = openUnavailableVideosDialog

async function _scanUnavailableVideos() {
  const $list   = $('#unavailableVideosList').empty()
  const $status = $('#unavailableVideosStatus').text('Loading…')
  const $prog   = $('#unavailableVideosProgress').show()
  const $fill   = $('#unavailableVideosProgressFill').css('width', '0%')

  // Gather unique YouTube videoIds. window.srts only has video metadata for
  // already-known entries; that's exactly the set we can delete.
  const ids = Array.from(new Set((window.srts || []).map(it => it && it.link).filter(Boolean)))
  if (!ids.length) {
    $status.text('No videos to scan.')
    $prog.hide()
    return
  }

  // Probe availability with bounded concurrency so we don't kick off 200
  // image loads at once on a slow connection.
  $status.text(`Probing ${ids.length} video(s)…`)
  const unavailable = []
  const POOL = 6
  let i = 0
  let done = 0
  await Promise.all(Array.from({length: POOL}, async () => {
    while (true) {
      const my = i++
      if (my >= ids.length) return
      const id = ids[my]
      const ok = await _checkYoutubeAvailable(id)
      if (!ok) unavailable.push(id)
      done++
      $fill.css('width', `${Math.round((done / ids.length) * 100)}%`)
    }
  }))

  if (!unavailable.length) {
    $prog.hide()
    $status.text(`All ${ids.length} video(s) are reachable.`)
    return
  }

  // Stage 2: confirm each thumbnail-suspect with the IFrame Player API. If
  // YouTube ever changes the thumbnail-placeholder behavior we'd start
  // getting false positives from the cheap probe; the player step rejects
  // those before they appear in the list. Concurrency stays low because
  // each probe spawns a real iframe.
  $status.text(`Confirming ${unavailable.length} candidate(s) via player…`)
  $fill.css('width', '0%')
  const confirmed = []
  {
    const POOL2 = 3
    let j = 0, cdone = 0
    await Promise.all(Array.from({length: POOL2}, async () => {
      while (true) {
        const my = j++
        if (my >= unavailable.length) return
        const id = unavailable[my]
        const verdict = await _confirmUnavailableViaPlayer(id)
        // 'available' refutes the thumbnail; anything else keeps the
        // candidate (conservative: better to show a false-positive that
        // the user can dismiss than silently drop a real unavailable).
        if (verdict !== 'available') confirmed.push(id)
        cdone++
        $fill.css('width', `${Math.round((cdone / unavailable.length) * 100)}%`)
      }
    }))
  }

  if (!confirmed.length) {
    $prog.hide()
    $status.text(`All ${ids.length} video(s) appear reachable after player confirmation.`)
    return
  }
  // From here on, `unavailable` refers to the confirmed set only.
  unavailable.length = 0
  Array.prototype.push.apply(unavailable, confirmed)

  // Build the orphan-word map only when we actually have unavailable videos.
  $status.text(`${unavailable.length} unavailable. Computing unique vocabulary…`)
  $fill.css('width', '0%')
  const wordMap = await _buildVocabToVideosMap(p => $fill.css('width', `${Math.round(p * 100)}%`))
  $prog.hide()
  $status.text(`${unavailable.length} unavailable video(s).`)

  // Render rows: checkbox + id + baseName + list of uniquely-covered words.
  unavailable.sort()
  unavailable.forEach(id => {
    const baseName = (((window.srts || []).find(s => s && s.link === id) || {}).name) || '(unknown)'
    const uniqWords = _uniqueWordsForVideo(id, wordMap)
    const $row = $(`
      <div class="dup-srts-group" data-id="${_.escape(id)}">
        <label class="dup-srts-head" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" class="unavail-pick">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${_.escape(id)} — ${_.escape(baseName)}</span>
        </label>
        <div class="unavail-uniq-hdr">${uniqWords.length} vocab word${uniqWords.length === 1 ? '' : 's'} uniquely covered by this video:</div>
        <div class="unavail-uniq-list">${
          uniqWords.length
            ? uniqWords.map(w => `<span class="unavail-uniq-word">${_.escape(w)}</span>`).join('')
            : '<span class="dup-srts-empty" style="padding:4px 0;">none — safe to delete</span>'
        }</div>
      </div>
    `)
    $list.append($row)
  })
}

async function _onUnavailableVideosDelete() {
  const ids = $('#unavailableVideosList .dup-srts-group').toArray()
    .filter(g => $(g).find('.unavail-pick').is(':checked'))
    .map(g => $(g).attr('data-id'))
  if (!ids.length) { alert('Select at least one video to delete.'); return }
  // Surface orphaned-word counts in the confirm so the user isn't surprised
  // by suddenly losing vocab coverage they were relying on.
  const orphanCount = ids.reduce((n, id) => {
    return n + $(`#unavailableVideosList .dup-srts-group[data-id="${$.escapeSelector ? $.escapeSelector(id) : id}"] .unavail-uniq-word`).length
  }, 0)
  if (!confirm(
    `Delete ${ids.length} video(s) from GitHub?\n\n` +
    `${orphanCount} vocabulary word(s) will be left without any matching SRT after deletion. ` +
    `This removes the SRT files and the index entries; the deletion can't be undone from the UI.`
  )) return
  const $btn = $('#unavailableVideosDelete').prop('disabled', true).text('Deleting…')
  let okCount = 0, failCount = 0
  for (const id of ids) {
    try {
      await _deleteVideoByLink(id)
      okCount++
      $(`#unavailableVideosList .dup-srts-group[data-id="${$.escapeSelector ? $.escapeSelector(id) : id}"]`).remove()
    } catch (e) {
      failCount++
      console.error('Failed to delete', id, e)
    }
  }
  $btn.prop('disabled', false).text('Delete selected')
  alert(`Deleted ${okCount}${failCount ? ` — ${failCount} failed (see console)` : ''}.`)
}

// Library-style sibling of deleteSelectedMedia: deletes by videoId without
// reading from the #mp3Choice picker and without per-call user confirmation.
// Used by the bulk "Unavailable" cleanup which batches confirmations into
// a single prompt before looping.
async function _deleteVideoByLink(link) {
  const srt = (window.srts || []).find(it => it && it.link === link)
  const baseName = _nfc(srt && srt.name)
  if (!baseName) throw new Error(`No index entry for ${link}`)
  const lang = getLangFromUrl()
  const srtsDir = `db/language/${lang.fullName}/srts`
  const srcCode = lang.code
  const candidates = [`${baseName}.${srcCode}.srt`]
  if (srcCode !== 'en') candidates.push(`${baseName}.en.srt`)
  const owner = 'trexsatya', repo = 'trexsatya.github.io'
  for (const fileName of candidates) {
    const filePath = `${srtsDir}/${encodeURIComponent(fileName)}`
    try {
      await window.GitHubUtils.deleteFileWithLookup({
        owner, repo, filePath,
        commitMessage: `srt: delete ${fileName} (unavailable)`,
        branch: 'gh-pages'
      })
    } catch (e) { console.warn(`Failed to delete ${fileName}:`, e) }
  }
  await commitWithMerge({
    filePath: `${srtsDir}/index.json`,
    commitMessage: `srts: remove index entry for ${link} (unavailable)`,
    merge: (remoteText) => {
      let arr = []
      try { arr = remoteText ? JSON.parse(remoteText) : [] } catch (_) {}
      if (!Array.isArray(arr)) arr = []
      const filtered = arr.filter(it => it.link !== link)
      return JSON.stringify(filtered, null, 2)
    }
  })
  // Local-state mirror.
  window.srts = (window.srts || []).filter(it => it.link !== link)
  if (window.allSubtitles && window.allSubtitles[link]) delete window.allSubtitles[link]
  _cacheDeleteOne(link).catch(e => console.warn('[cache] delete failed for', link, e))
  $(`#mp3Choice option[value="${link}"]`).remove()
  try { removeVideoFromAllPlaylists(link) } catch (_) {}
}

$(function () {
  $(document).on('click', '#unavailableVideosRescan',     _scanUnavailableVideos)
  $(document).on('click', '#unavailableVideosDelete',     _onUnavailableVideosDelete)
  $(document).on('click', '#unavailableVideosSelectAll',  () => $('#unavailableVideosList .unavail-pick').prop('checked', true))
  $(document).on('click', '#unavailableVideosSelectNone', () => $('#unavailableVideosList .unavail-pick').prop('checked', false))
})

async function upsertSrtIndexEntry(videoId, baseName, source) {
  const lang = getLangFromUrl()
  const filePath = `db/language/${lang.fullName}/srts/index.json`
  const record = { link: videoId, name: _nfc(baseName), source }

  await commitWithMerge({
    filePath,
    commitMessage: `srts: upsert index entry for ${videoId}`,
    merge: (remoteText) => {
      let arr = []
      try { arr = remoteText ? JSON.parse(remoteText) : [] } catch (_) {}
      if (!Array.isArray(arr)) arr = []
      const idx = arr.findIndex(it => it.link === videoId)
      if (idx >= 0) arr[idx] = { ...arr[idx], ...record }
      else arr.push(record)
      return JSON.stringify(arr, null, 2)
    }
  })
}

// ── One-shot NFC migration ──────────────────────────────────────────────
// Some legacy SRT entries were committed with NFD-encoded å / ä / ö in
// their filenames (typical macOS APFS artifact). The app now always writes
// NFC, so over time the two encodings drift apart on remote and end up
// stored as DUPLICATE files. This walks index.json, renames every NFD
// file to its NFC equivalent, drops the NFD copies (and any pre-existing
// NFC dupes' content is kept), and rewrites index.json — all in a single
// batched commit. Idempotent: re-running on an already-normalized index
// reports "nothing to do" and exits without committing.
async function migrateSrtPathsToNFC() {
  const lang = getLangFromUrl()
  const srtsDir = `db/language/${lang.fullName}/srts`
  const indexPath = `${srtsDir}/index.json`

  // Pull the live index from GitHub (uncached real-time read).
  const file = await window.GitHubUtils.getFile('trexsatya', 'trexsatya.github.io', indexPath, '', 'gh-pages')
  let entries
  try { entries = JSON.parse(file.content) } catch (e) { throw new Error('index.json is not valid JSON: ' + e.message) }
  if (!Array.isArray(entries)) throw new Error('index.json is not an array')

  // Find entries whose name is not already NFC.
  const drift = entries
    .map((e, i) => ({ e, i, nfd: e.name || '', nfc: _nfc(e.name || '') }))
    .filter(x => x.nfd !== x.nfc)

  if (!drift.length) {
    console.log('migrateSrtPathsToNFC: index.json already fully NFC — nothing to do.')
    return { migrated: 0 }
  }

  // For each drifted entry, prepare a (delete NFD path, write NFC path) pair
  // per language. We fetch the canonical content from raw.github — prefer
  // NFD (matches the current index) and fall back to NFC if the file was
  // already renamed manually. If neither exists we just skip that lang.
  const files = []
  let renamed = 0
  for (const x of drift) {
    for (const langCode of ['sv', 'en']) {
      const baseNfd = x.nfd, baseNfc = x.nfc
      const fileNameNfd = `${baseNfd}.${langCode}.srt`
      const fileNameNfc = `${baseNfc}.${langCode}.srt`
      const url = (n) => `${getResourceUrl()}/srts/${encodeURIComponent(n)}`
      let content = null
      try {
        const r = await fetch(url(fileNameNfd), { cache: 'no-cache' })
        if (r.ok) content = await r.text()
      } catch (_) {}
      if (content === null) {
        try {
          const r = await fetch(url(fileNameNfc), { cache: 'no-cache' })
          if (r.ok) content = await r.text()
        } catch (_) {}
      }
      if (content === null) continue   // file missing entirely
      files.push({ path: `${srtsDir}/${fileNameNfc}`, getContent: () => content })
      files.push({ path: `${srtsDir}/${fileNameNfd}`, delete: true })
      renamed++
    }
  }

  // Always rewrite the index, even if no file content was successfully fetched,
  // so the name fields are canonicalized.
  files.push({
    path: indexPath,
    getContent: (current) => {
      let arr
      try { arr = JSON.parse(current || '[]') } catch (_) { arr = entries }
      if (!Array.isArray(arr)) arr = entries
      const normalized = arr.map(it => it ? { ...it, name: _nfc(it.name) } : it)
      return JSON.stringify(normalized, null, 2) + '\n'
    }
  })

  await window.GitHubUtils.commitMultipleFiles({
    owner: 'trexsatya',
    repo: 'trexsatya.github.io',
    branch: 'gh-pages',
    commitMessage: `srts: normalize ${drift.length} index entr${drift.length === 1 ? 'y' : 'ies'} + ${renamed} file rename(s) to NFC`,
    files
  })

  // Refresh window.srts so subsequent reads see canonical NFC names.
  if (Array.isArray(window.srts)) {
    window.srts = window.srts.map(it => it ? { ...it, name: _nfc(it.name) } : it)
  }

  console.log(`migrateSrtPathsToNFC: migrated ${drift.length} index entries, renamed ${renamed} files`)
  return { migrated: drift.length, renamed }
}

// ── Channel management ──────────────────────────────────────────────────
// Channels are extracted from window.srts entries: the `name` field is
// "${channel} || ${title} || ${id}" (set by buildCapturedSubtitleBaseName).
// The user can block a channel (subtitles from it only show as fallback)
// or delete it (all SRT files + the index.json entries are removed in one
// batched commit via commitMultipleFiles).

function listChannels() {
  const counts = new Map()
  ;(window.srts || []).forEach(s => {
    if (!s || !s.name) return
    const idx = s.name.indexOf(' || ')
    const ch = (idx > 0 ? s.name.slice(0, idx) : s.name).trim() || '(unknown)'
    if (!counts.has(ch)) counts.set(ch, { videos: 0, source: s.source || '' })
    counts.get(ch).videos += 1
  })
  return [...counts.entries()]
    .map(([channel, meta]) => ({ channel, videos: meta.videos, source: meta.source }))
    .sort((a, b) => b.videos - a.videos || a.channel.localeCompare(b.channel))
}

function setChannelBlocked(channel, blocked) {
  if (!channel) return
  const list = (window._appSettings.blockedChannels || []).slice()
  const idx = list.indexOf(channel)
  if (blocked && idx < 0) list.push(channel)
  if (!blocked && idx >= 0) list.splice(idx, 1)
  window._appSettings.blockedChannels = list
  saveAppSettings()
  // Re-render any active result so the new block takes effect immediately.
  if (window.searchResult && typeof render === 'function') {
    try { render(window.searchResult, window.searchText) } catch (_) {}
  }
}

// Delete every SRT file belonging to the given channel and prune the
// matching index.json entries — all in a single GitHub commit via the
// new commitMultipleFiles helper.
async function deleteChannel(channel) {
  if (!channel) return
  const videos = (window.srts || []).filter(s => {
    if (!s || !s.name) return false
    const i = s.name.indexOf(' || ')
    return (i > 0 ? s.name.slice(0, i) : s.name).trim() === channel
  })
  if (!videos.length) { alert(`No videos found for channel "${channel}".`); return }
  if (!confirm(`Delete channel "${channel}" — ${videos.length} video${videos.length === 1 ? '' : 's'}?\n\nThis removes every .sv.srt and .en.srt file from gh-pages and updates index.json. Cannot be undone from the UI.`)) return

  const lang = getLangFromUrl()
  const srtsDir = `db/language/${lang.fullName}/srts`
  const code = lang.code
  const files = []
  videos.forEach(v => {
    const n = _nfc(v.name)
    files.push({ path: `${srtsDir}/${n}.${code}.srt`, delete: true })
    if (code !== 'en') files.push({ path: `${srtsDir}/${n}.en.srt`, delete: true })
  })
  files.push({
    path: `${srtsDir}/index.json`,
    getContent: (current) => {
      let arr = []
      try { arr = current ? JSON.parse(current) : [] } catch (_) {}
      if (!Array.isArray(arr)) arr = []
      const linksToDrop = new Set(videos.map(v => v.link))
      const filtered = arr.filter(it => !linksToDrop.has(it.link))
      return JSON.stringify(filtered, null, 2) + '\n'
    }
  })

  await window.GitHubUtils.commitMultipleFiles({
    owner: 'trexsatya',
    repo: 'trexsatya.github.io',
    branch: 'gh-pages',
    commitMessage: `channel: delete "${channel}" (${videos.length} video${videos.length === 1 ? '' : 's'})`,
    files
  })

  // Local cleanup so the UI matches gh-pages without a reload.
  videos.forEach(v => {
    try { delete window.allSubtitles[v.link] } catch (_) {}
  })
  window.srts = (window.srts || []).filter(s => !videos.includes(s))
  // Drop cached pairs for every deleted video in one batched IDB tx.
  const deletedLinks = videos.map(v => v && v.link).filter(Boolean)
  if (deletedLinks.length) {
    _cacheDeleteMany(deletedLinks).catch(e => console.warn('[cache] batch delete failed', e))
  }
  // Also drop from the optional block-list (deleted channel can't be matched).
  setChannelBlocked(channel, false)
}

function openChannelManagerDialog() {
  let $dlg = $('#channelManagerDialog')
  if (!$dlg.length) {
    $dlg = $('<div id="channelManagerDialog"></div>').appendTo('body')
  }
  const channels = listChannels()
  const blocked = new Set((window._appSettings.blockedChannels || []))
  let html = `<p class="ch-mgr-intro">Block a channel to demote its subtitles to fallback (used only when a word has no other match). Delete removes every SRT for the channel and updates index.json in a single commit.</p>`
  if (!channels.length) {
    html += '<p style="color:#888;">No channels found in this language.</p>'
  } else {
    html += '<div class="ch-mgr-list">'
    channels.forEach(c => {
      const id = 'ch-' + encodeURIComponent(c.channel).replace(/[^A-Za-z0-9_-]/g, '_')
      const isBlocked = blocked.has(c.channel)
      html += `
        <div class="ch-row" data-channel="${_.escape(c.channel)}">
          <label class="rec-toggle ch-block" title="Block channel">
            <input type="checkbox" class="ch-block-cb" ${isBlocked ? 'checked' : ''}>
            <span class="rec-toggle-track"><span class="rec-toggle-knob"></span></span>
          </label>
          <span class="ch-name${isBlocked ? ' ch-name-blocked' : ''}">${_.escape(c.channel)}</span>
          <span class="ch-count">${c.videos}</span>
          <button type="button" class="btn ch-delete rec-rec-danger" title="Delete channel"><span class="rec-rec-ico">🗑</span><span class="rec-rec-lbl">Delete</span></button>
        </div>`
    })
    html += '</div>'
  }
  $dlg.html(html)

  $dlg.off('change', '.ch-block-cb').on('change', '.ch-block-cb', function () {
    const $row = $(this).closest('.ch-row')
    const ch = String($row.data('channel') || '')
    setChannelBlocked(ch, $(this).is(':checked'))
    $row.find('.ch-name').toggleClass('ch-name-blocked', $(this).is(':checked'))
  })
  $dlg.off('click', '.ch-delete').on('click', '.ch-delete', async function (e) {
    e.preventDefault(); e.stopPropagation()
    const $btn = $(this)
    const ch = String($btn.closest('.ch-row').data('channel') || '')
    $btn.prop('disabled', true).find('.rec-rec-lbl').text('Deleting…')
    try {
      await deleteChannel(ch)
      openChannelManagerDialog()   // refresh list
    } catch (err) {
      console.error('deleteChannel failed', err)
      alert('Delete failed: ' + (err && err.message || err))
      $btn.prop('disabled', false).find('.rec-rec-lbl').text('Delete')
    }
  })

  const opts = {
    title: `Manage channels (${channels.length})`,
    width: Math.min(640, $(window).width() - 40),
    height: Math.min(560, $(window).height() - 40),
    modal: false,
    autoOpen: true,
    position: { my: 'center top', at: 'center top+20', of: window },
    buttons: { 'Close': function () { $(this).dialog('close') } }
  }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', opts).dialog('open')
  } else {
    $dlg.dialog(opts)
  }
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

async function renderCapturedReviewBody() {
  const buf = loadCapturedBuffer()
  const $body = $('#captured-subtitles-dialog-content').empty()
  if (buf.length === 0) {
    $body.append('<p>No captured subtitles pending.</p>')
    return
  }
  // Render rows immediately with a "checking…" status so the dialog opens
  // fast, then resolve each row's true status against the authoritative
  // index.json. window.allSubtitles can be a false positive (purely-local
  // entries / re-pushes), so it's not enough on its own.
  buf.forEach(item => {
    const d = item.detail || {}
    const $row = $(`
      <div class="captured-item" data-id="${escapeHtml(item.id)}" style="border:1px solid #ccc;border-radius:4px;padding:8px;margin-bottom:8px;">
        <div style="font-weight:bold;">${escapeHtml(d.videoTitle || d.videoId || 'unknown')}</div>
        <div style="font-size:12px;color:#555;">
          ${escapeHtml(d.videoId || '')} ·
          ${escapeHtml(d.sourceLang || '?')}→${escapeHtml(d.targetLang || '?')} ·
          ${(d.lines || []).length} src / ${(d.translation || []).length} tgt lines ·
          <span data-role="srt-status" style="color:#888;">checking…</span>
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

  // Resolve each row's status against index.json. Cache per videoId so
  // duplicate captures of the same video only fetch once.
  const cache = new Map()
  for (const item of buf) {
    const d = item.detail || {}
    if (!d.videoId) continue
    const $row = $body.find(`.captured-item[data-id="${$.escapeSelector ? $.escapeSelector(item.id) : item.id}"]`)
    const $status = $row.find('[data-role=srt-status]')
    if (!$status.length) continue
    try {
      if (!cache.has(d.videoId)) {
        cache.set(d.videoId, fetchSrtIndexEntry(d.videoId))
      }
      const entry = await cache.get(d.videoId)
      if (entry) {
        $row.attr('data-srt-state', 'modify')
        $status.html(`<span style="color:#a60;font-weight:bold;">modifying existing SRT</span> <span style="color:#777;">(${escapeHtml(entry.name || '')})</span>`)
        $row.find('button[data-action="push"]').text('Push (merge)')
      } else {
        $row.attr('data-srt-state', 'new')
        $status.html('<span style="color:#070;font-weight:bold;">new SRT</span>')
      }
    } catch (e) {
      $status.html('<span style="color:#a00;">status unknown</span>')
    }
  }
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
          // Route through the batched path with a single-item array so all
          // captures go through the same code (one commit, same conflict
          // handling). Cheaper than the legacy per-file commitWithMerge path.
          const result = await pushCapturedSubtitlesBatched([{ id, detail: d }])
          if (result && result.committed === false) {
            // Nothing to update (already on remote, or no SRT to write) is
            // effectively success — the buffer is stale, just clear the row
            // without nagging the user with an alert.
            console.log('[push-this] no commit needed', result.reason)
            const buf2 = loadCapturedBuffer().filter(b => b.id !== id)
            saveCapturedBuffer(buf2)
            $row.remove()
            updateCapturedBtn()
            return
          }
          const buf2 = loadCapturedBuffer().filter(b => b.id !== id)
          saveCapturedBuffer(buf2)
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
        if (!confirm(`Push ${startBuf.length} captured subtitle(s) to GitHub in a single commit?`)) return
        const $self = $(this)
        const $rows = $('#captured-subtitles-dialog-content').find('.captured-item')
        $rows.find('button[data-action="push"]').prop('disabled', true).text('Pushing…')
        const $pushAllBtn = $self.dialog('widget').find('.ui-dialog-buttonpane button:contains("Push All")')
        const setStatus = (s) => { try { $pushAllBtn.text(s) } catch (_) {} }
        setStatus('Preparing…')
        try {
          const result = await pushCapturedSubtitlesBatched(startBuf, (p) => {
            if (p.stage === 'fetching-index')    setStatus('Reading index…')
            else if (p.stage === 'prefetching-srts') setStatus(`Fetching SRTs ${p.done}/${p.total}`)
            else if (p.stage === 'committing')   setStatus(`Committing ${p.files} files…`)
          })
          // No commit produced (captures already on remote, or no SRT files
          // to push) is effectively success — silently clear the buffer and
          // close the dialog, same as a real commit. Logging only so the
          // diagnostic isn't lost.
          if (result && result.committed === false) {
            console.log('[push-all] no commit needed', result.reason)
            const pushedIds = new Set(result.pushedIds || startBuf.map(b => b.id))
            saveCapturedBuffer(loadCapturedBuffer().filter(b => !pushedIds.has(b.id)))
            pushedIds.forEach(id => {
              $(`#captured-subtitles-dialog-content .captured-item[data-id="${id}"]`).remove()
            })
            updateCapturedBtn()
            $self.dialog('close')
            return
          }
          // Drop pushed items from the buffer (concurrent captures preserved).
          const pushedIds = new Set(result.pushedIds || startBuf.map(b => b.id))
          saveCapturedBuffer(loadCapturedBuffer().filter(b => !pushedIds.has(b.id)))
          pushedIds.forEach(id => {
            $(`#captured-subtitles-dialog-content .captured-item[data-id="${id}"]`).remove()
          })
          updateCapturedBtn()
          $self.dialog('close')
        } catch (err) {
          console.error('Batch push failed', err)
          setStatus('Push All')
          alert('Batch push failed: ' + (err && err.message || err))
          $rows.find('button[data-action="push"]').prop('disabled', false).text('Push This')
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

// Batch-push every captured-subtitle item in `items` as a single git commit.
// Groups captures by videoId so multiple chunks of the same video collapse
// into one merged .sv.srt and .en.srt update. Conflicts are resolved up-front
// via the merge dialog; the resolution is then re-applied inside the
// commitMultipleFiles retry loop, so a 422 (someone else pushed) doesn't lose
// the user's decisions.
//
// Returns { pushedIds }. Throws if the user cancels a conflict dialog or the
// commit ultimately fails after retries.
async function pushCapturedSubtitlesBatched(items, onProgress) {
  const _report = (stage, extra) => {
    try { if (typeof onProgress === 'function') onProgress({ stage, ...(extra || {}) }) } catch (_) {}
  }
  if (!items || !items.length) return { pushedIds: [] }
  const lang = getLangFromUrl()
  const srtsDir = `db/language/${lang.fullName}/srts`
  const indexPath = `${srtsDir}/index.json`

  // Group by videoId so multiple captures on the same video collapse into a
  // single merged update per language file.
  const byVideo = new Map()
  for (const it of items) {
    const vid = it && it.detail && it.detail.videoId
    if (!vid) continue
    if (!byVideo.has(vid)) byVideo.set(vid, { details: [], ids: [] })
    const slot = byVideo.get(vid)
    slot.details.push(it.detail)
    slot.ids.push(it.id)
  }
  if (!byVideo.size) return { pushedIds: [] }

  // ──────────────────────────────────────────────────────────────────────
  // Fetch index.json ONCE up-front instead of per-video — for 55 captures
  // across many videos this was firing 55+ GitHub API calls each pulling
  // the full index, which caused the timeouts the user hit on Push All.
  // ──────────────────────────────────────────────────────────────────────
  _report('fetching-index')
  let indexArr = []
  try {
    const file = await window.GitHubUtils.getFile(
      'trexsatya', 'trexsatya.github.io', indexPath, '', 'gh-pages'
    )
    indexArr = JSON.parse(file.content)
    if (!Array.isArray(indexArr)) indexArr = []
  } catch (e) {
    console.warn('pushCapturedSubtitlesBatched: index.json fetch failed', e)
  }
  const indexByLink = new Map(indexArr.map(it => [it.link, it]))

  // Per (videoId, langCode): collect aggregate entries, pick a baseName +
  // source, prompt for conflict resolution if needed. The resolution
  // surfaces here (once) and is reused on every retry inside commitMultipleFiles.
  const fileSpecs = []          // [{path, getContent}]
  const indexAdditions = []     // [{link, name, source}] for index.json
  const allIds = []             // ids to drop from the buffer on success
  const inMemoryUpdates = []    // [{videoId, baseName, source, sv, en}] for window.allSubtitles

  // Pre-compute per-video specs (everything needed before remote prefetch).
  const videoSpecs = []
  for (const [videoId, slot] of byVideo.entries()) {
    allIds.push(...slot.ids)
    const indexEntry = indexByLink.get(videoId)
      ? { ...indexByLink.get(videoId), name: _nfc(indexByLink.get(videoId).name) }
      : null
    const baseName = _nfc(indexEntry ? indexEntry.name : buildCapturedSubtitleBaseName(slot.details[0]))
    const source = indexEntry && indexEntry.source ? indexEntry.source : inferSubtitleSource(slot.details[0])
    if (!indexEntry) indexAdditions.push({ link: videoId, name: baseName, source })

    const allLines = []
    const allTranslations = []
    const sourceLang = slot.details[0].sourceLang
    const targetLang = slot.details[0].targetLang
    slot.details.forEach(d => {
      if (Array.isArray(d.lines))       allLines.push(...d.lines)
      if (Array.isArray(d.translation)) allTranslations.push(...d.translation)
    })

    videoSpecs.push({ videoId, slot, baseName, source, sourceLang, targetLang, allLines, allTranslations })
  }

  // Prefetch existing remote text for every (video × lang) in parallel via
  // raw.githubusercontent.com. Bounded concurrency so a 55-capture push
  // doesn't blow Chrome's `ERR_INSUFFICIENT_RESOURCES` ceiling. We use the
  // raw CDN because index.json's name is the only authority we need — no PAT.
  const prefetchTargets = []
  for (const v of videoSpecs) {
    if (v.sourceLang) prefetchTargets.push({ key: `${v.videoId}|src`, baseName: v.baseName, suffix: v.sourceLang })
    if (v.targetLang) prefetchTargets.push({ key: `${v.videoId}|tgt`, baseName: v.baseName, suffix: v.targetLang })
  }
  const prefetchMap = new Map()
  const concurrency = Math.min(8, prefetchTargets.length || 1)
  let prefetchDone = 0
  _report('prefetching-srts', { done: 0, total: prefetchTargets.length })
  await _runInBatches(prefetchTargets, async (t) => {
    try {
      const r = await fetch(`${getResourceUrl()}/srts/${encodeURIComponent(t.baseName + '.' + t.suffix + '.srt')}`, { cache: 'no-cache' })
      if (r.ok) prefetchMap.set(t.key, await r.text())
      else prefetchMap.set(t.key, null)
    } catch (_) {
      prefetchMap.set(t.key, null)
    }
    prefetchDone++
    _report('prefetching-srts', { done: prefetchDone, total: prefetchTargets.length })
  }, concurrency)

  // Now resolve conflicts serially (each dialog is modal) and build fileSpecs.
  for (const v of videoSpecs) {
    let srcResolution = null
    let tgtResolution = null
    const { videoId, baseName, source, sourceLang, targetLang, allLines, allTranslations } = v

    if (sourceLang) {
      const existingSrc = prefetchMap.get(`${videoId}|src`)
      if (existingSrc) {
        const conflicts = detectSrtConflicts(existingSrc, allLines)
        if (conflicts.length) {
          srcResolution = await presentSrtMergeDialog(`${sourceLang.toUpperCase()} subtitle (${baseName})`, conflicts)
          if (srcResolution === null) throw new Error('Merge cancelled by user')
        }
      }
      fileSpecs.push({
        path: `${srtsDir}/${baseName}.${sourceLang}.srt`,
        getContent: (current) => current
          ? mergeSrtWithResolution(current, allLines, srcResolution)
          : linesToSrtText(allLines)
      })
    }
    if (targetLang) {
      const existingTgt = prefetchMap.get(`${videoId}|tgt`)
      if (existingTgt) {
        const conflicts = detectSrtConflicts(existingTgt, allTranslations)
        if (conflicts.length) {
          tgtResolution = await presentSrtMergeDialog(`${targetLang.toUpperCase()} translation (${baseName})`, conflicts)
          if (tgtResolution === null) throw new Error('Merge cancelled by user')
        }
      }
      fileSpecs.push({
        path: `${srtsDir}/${baseName}.${targetLang}.srt`,
        getContent: (current) => current
          ? mergeSrtWithResolution(current, allTranslations, tgtResolution)
          : linesToSrtText(allTranslations)
      })
    }

    inMemoryUpdates.push({ videoId, baseName, source, sourceLang, targetLang, allLines, allTranslations, srcResolution, tgtResolution })
  }

  // Diagnostic: log everything we'll send to commitMultipleFiles so we can
  // see why a "no commit" outcome happened (often: every file's merged text
  // equals the current remote text → tree entries empty → no commit).
  console.log('[pushCapturedSubtitlesBatched] preparing commit',
    'videos=', byVideo.size,
    'items=', items.length,
    'fileSpecs=', fileSpecs.map(f => f.path),
    'indexAdditions=', indexAdditions.length)

  // Add a single index.json update if any new entries.
  if (indexAdditions.length) {
    fileSpecs.push({
      path: indexPath,
      getContent: (current) => {
        let arr = []
        try { arr = current ? JSON.parse(current) : [] } catch (_) {}
        if (!Array.isArray(arr)) arr = []
        indexAdditions.forEach(ne => {
          if (!arr.find(it => it.link === ne.link)) arr.push(ne)
        })
        return JSON.stringify(arr, null, 2) + '\n'
      }
    })
  }

  if (!fileSpecs.length) {
    console.warn('pushCapturedSubtitlesBatched: no files to commit — captures had no sourceLang/targetLang and indexEntry already exists')
    return { pushedIds: allIds, committed: false, reason: 'no-files' }
  }

  const commitMessage = `srt: batch update — ${byVideo.size} video${byVideo.size === 1 ? '' : 's'}, ${items.length} capture${items.length === 1 ? '' : 's'}`

  // Chunk into batches so a huge push doesn't trip GitHub's secondary
  // rate limit (≈ 180 writes/min) or stall in one super-long commit.
  // index.json gets attached to the LAST chunk only — if an earlier chunk
  // fails, the index doesn't claim ownership of files that aren't there
  // yet, and a retry will re-merge correctly.
  const CHUNK_SIZE = 300
  const INTER_CHUNK_SLEEP_MS = 2000
  const indexSpecIdx = fileSpecs.findIndex(f => f.path === indexPath)
  const indexSpec = indexSpecIdx >= 0 ? fileSpecs[indexSpecIdx] : null
  const dataSpecs = indexSpec ? fileSpecs.filter((_, i) => i !== indexSpecIdx) : fileSpecs
  const chunks = []
  for (let i = 0; i < dataSpecs.length; i += CHUNK_SIZE) {
    chunks.push(dataSpecs.slice(i, i + CHUNK_SIZE))
  }
  if (!chunks.length) chunks.push([])
  if (indexSpec) chunks[chunks.length - 1].push(indexSpec)
  const nonEmpty = chunks.filter(c => c.length)

  let anyCommitted = false
  let lastNoCommitReason = null
  for (let ci = 0; ci < nonEmpty.length; ci++) {
    const chunk = nonEmpty[ci]
    const chunkMsg = nonEmpty.length === 1
      ? commitMessage
      : `${commitMessage} [chunk ${ci + 1}/${nonEmpty.length}]`
    _report('committing', { files: chunk.length, chunk: ci + 1, totalChunks: nonEmpty.length })
    const r = await window.GitHubUtils.commitMultipleFiles({
      owner: 'trexsatya',
      repo: 'trexsatya.github.io',
      branch: 'gh-pages',
      commitMessage: chunkMsg,
      files: chunk
    })
    if (r && r.committed === false) {
      console.warn(`pushCapturedSubtitlesBatched: chunk ${ci + 1}/${nonEmpty.length} produced no commit`, r)
      lastNoCommitReason = r.reason || 'no-changes'
    } else {
      anyCommitted = true
    }
    // Space out chunks so the per-minute secondary rate limit (writes) has
    // time to drain before the next blob barrage starts.
    if (ci < nonEmpty.length - 1) {
      await new Promise(res => setTimeout(res, INTER_CHUNK_SLEEP_MS))
    }
  }
  // If every chunk was a no-op, surface that so the caller doesn't silently
  // clear the buffer thinking the commit happened.
  if (!anyCommitted) {
    return { pushedIds: allIds, committed: false, reason: lastNoCommitReason || 'no-changes' }
  }

  // Best-effort in-memory updates so the UI reflects the new state without
  // a reload. Mirrors what the per-item handleCapturedSubtitle used to do.
  for (const u of inMemoryUpdates) {
    const cached = window.allSubtitles[u.videoId] || {}
    const sv = cached.sv ? mergeSrtWithResolution(cached.sv, u.allLines, u.srcResolution)        : linesToSrtText(u.allLines)
    const en = cached.en ? mergeSrtWithResolution(cached.en, u.allTranslations, u.tgtResolution) : linesToSrtText(u.allTranslations)
    window.allSubtitles[u.videoId] = { ...cached, sv, en, source: u.source, fileName: u.baseName }
    if (Array.isArray(window.srts) && !window.srts.find(it => it.link === u.videoId)) {
      window.srts.push({ link: u.videoId, name: u.baseName, source: u.source })
    }
  }

  return { pushedIds: allIds }
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
  const baseName = _nfc(indexEntry
    ? indexEntry.name
    : buildCapturedSubtitleBaseName(detail))
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

  // Detect conflicting entries (same start, different text) before merging
  // anything. If any exist, show the merge dialog so the user picks per
  // timestamp; we thread the resolution into uploadSrtToGithub so it's
  // re-applied on every retry of the commit (in case of 409/422).
  let sourceResolution = null
  let targetResolution = null
  if (existingSourceText) {
    const conflicts = detectSrtConflicts(existingSourceText, lines)
    if (conflicts.length) {
      sourceResolution = await presentSrtMergeDialog(`${(sourceLang || 'source').toUpperCase()} subtitle`, conflicts)
      if (sourceResolution === null) throw new Error('Merge cancelled by user')
    }
  }
  if (existingTargetText) {
    const conflicts = detectSrtConflicts(existingTargetText, translation)
    if (conflicts.length) {
      targetResolution = await presentSrtMergeDialog(`${(targetLang || 'target').toUpperCase()} translation`, conflicts)
      if (targetResolution === null) throw new Error('Merge cancelled by user')
    }
  }

  // sourceLang corresponds to the language being studied (stored under `sv` in allSubtitles),
  // targetLang corresponds to the translation (stored under `en`).
  const sourceText = existingSourceText
    ? mergeSrtWithResolution(existingSourceText, lines, sourceResolution)
    : linesToSrtText(lines)
  const targetText = existingTargetText
    ? mergeSrtWithResolution(existingTargetText, translation, targetResolution)
    : linesToSrtText(translation)

  window.allSubtitles[videoId] = {
    ...(window.allSubtitles[videoId] || {}),
    sv: sourceText,
    en: targetText,
    source,
    fileName: baseName
  }

  // Push only the new entries; uploadSrtToGithub re-fetches the real-time
  // remote and merges them in (with the user's conflict resolution
  // re-applied), so concurrent captures on another client are preserved.
  if (sourceLang) {
    await uploadSrtToGithub(baseName, sourceLang, lines,
      `srt: ${isNew ? 'add' : 'merge'} ${sourceLang} subtitle for ${videoId}`,
      sourceResolution)
  }
  if (targetLang) {
    await uploadSrtToGithub(baseName, targetLang, translation,
      `srt: ${isNew ? 'add' : 'merge'} ${targetLang} subtitle for ${videoId}`,
      targetResolution)
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

// ─── Search-recording feature ────────────────────────────────────────────
//
// Lets the user collect a playlist of subtitle matches across multiple
// searches, then replay them back-to-back as a YouTube reel. Storage
// lives in localStorage (per-browser, no GitHub round-trip on every
// capture) under the shape:
//   { [searchText]: { [word]: [ { searchText, word, id, source, timeStart, timeEnd } ] } }
// where `id` is the video URL/id (matches `play-btn-container[data-url]`).
//
// State machine: idle → recording ⇄ paused → idle. Stop drops back to idle
// but keeps the buffer. "Clear All" wipes the buffer.

// Storage for the multi-playlist model:
//   cupitor:recordings        — { [name]: { items, createdAt, updatedAt } }
//   cupitor:recording:current — name of the currently-active recording
//   cupitor:recording:state   — idle | recording | paused
//   cupitor:recording (legacy)— single buffer; migrated to "Default" on load
const REC_KEY            = 'cupitor:recording'           // legacy
const REC_STATE_KEY      = 'cupitor:recording:state'
const REC_COLLECTION_KEY = 'cupitor:recordings'
const REC_CURRENT_KEY    = 'cupitor:recording:current'
const REC_DEFAULT_NAME   = 'Default'

window._recordings = { [REC_DEFAULT_NAME]: { items: {}, createdAt: Date.now(), updatedAt: Date.now() } }
window._recording  = { state: 'idle', currentName: REC_DEFAULT_NAME, items: window._recordings[REC_DEFAULT_NAME].items }

// Make sure every item has `enabled` defined. Used during load + after any
// data import.
function _backfillEnabled(items) {
  Object.values(items || {}).forEach(byWord => {
    Object.values(byWord).forEach(arr => arr.forEach(it => {
      if (it && typeof it === 'object' && it.enabled == null) it.enabled = true
    }))
  })
}

function _loadRecording() {
  try {
    const state = localStorage.getItem(REC_STATE_KEY) || 'idle'
    let coll = {}
    let raw = localStorage.getItem(REC_COLLECTION_KEY)
    if (raw) {
      try { coll = JSON.parse(raw) } catch (_) { coll = {} }
    }
    // Migrate from the legacy single-buffer key if the collection key is empty.
    if (!coll || typeof coll !== 'object' || !Object.keys(coll).length) {
      try {
        const legacy = JSON.parse(localStorage.getItem(REC_KEY) || '{}')
        if (legacy && typeof legacy === 'object' && Object.keys(legacy).length) {
          coll = { [REC_DEFAULT_NAME]: { items: legacy, createdAt: Date.now(), updatedAt: Date.now() } }
        }
      } catch (_) {}
    }
    if (!coll || typeof coll !== 'object') coll = {}
    if (!Object.keys(coll).length) {
      coll[REC_DEFAULT_NAME] = { items: {}, createdAt: Date.now(), updatedAt: Date.now() }
    }
    // Normalise each entry: ensure shape and backfill `enabled`. Virtual
    // playlists carry only a `members` array, no items.
    Object.keys(coll).forEach(name => {
      const r = coll[name]
      if (!r || typeof r !== 'object') { coll[name] = { items: {}, createdAt: Date.now(), updatedAt: Date.now() }; return }
      if (r.virtual) {
        if (!Array.isArray(r.members)) r.members = []
        delete r.items   // ensure no stale materialised items linger
        return
      }
      if (!r.items || typeof r.items !== 'object') r.items = {}
      _backfillEnabled(r.items)
    })

    const currentName = localStorage.getItem(REC_CURRENT_KEY)
    const activeName = (currentName && coll[currentName]) ? currentName : Object.keys(coll)[0]

    window._recordings = coll
    const activeVirtual = !!(coll[activeName] && coll[activeName].virtual)
    window._recording = {
      state: ['idle','recording','paused'].includes(state) ? state : 'idle',
      currentName: activeName,
      virtual: activeVirtual,
      items: activeVirtual ? _resolveVirtualItems(activeName) : coll[activeName].items
    }
  } catch (_) {
    window._recordings = { [REC_DEFAULT_NAME]: { items: {}, createdAt: Date.now(), updatedAt: Date.now() } }
    window._recording = { state: 'idle', currentName: REC_DEFAULT_NAME, items: window._recordings[REC_DEFAULT_NAME].items }
  }
}

// True if at least one entry for (searchText, word, id, lineIndex) exists
// in the recording. Items can be added multiple times (repetition, different
// timestamps); the capture-btn stays marked as long as any entry for this
// specific line remains, and only unmarks when the last duplicate is gone.
function _isCaptured(searchText, word, url, lineIndex) {
  const items = window._recording && window._recording.items
  const arr = items && items[searchText] && items[searchText][word]
  if (!arr || !arr.length) return false
  const li = parseInt(lineIndex, 10)
  return arr.some(it => it && it.id === url && parseInt(it.lineIndex, 10) === li)
}

// Walk every `.capture-btn` in the document and add/remove the persistent
// `.is-captured` class based on the current recording buffer. Call after
// renderLines, after capture/remove, and after clearRecording.
function _markCapturedButtons() {
  $('.capture-btn').each(function () {
    const $btn = $(this)
    const $linesCntnr = $btn.closest('.lines-cntnr')
    const $pbc = $linesCntnr.find('.play-btn-container').first()
    const url       = ($pbc.attr('data-url') || '').toString()
    const lineIndex = parseInt($pbc.attr('data-match-line-index'), 10)
    const word      = ($linesCntnr.closest('.srt-file').find('h4[data-file]').first().text() || '').trim()
    const searchText= (window.searchText || '').trim()
    const yes = url && Number.isFinite(lineIndex) && _isCaptured(searchText, word, url, lineIndex)
    $btn.toggleClass('is-captured', !!yes)
  })
}
window._markCapturedButtons = _markCapturedButtons

const REC_DIRTY_KEY = 'cupitor:recordings:dirty'

function _saveRecording() {
  try {
    // Keep the active recording's items pointer in sync with the collection
    // entry — capture/remove/reorder mutate window._recording.items by
    // reference, and the collection entry is the same object, so this just
    // bumps updatedAt and serialises.
    const name = window._recording.currentName
    if (window._recordings[name]) {
      // Never write resolved items back into a virtual playlist — that would
      // materialise (and duplicate) the union, defeating the whole point.
      if (!window._recordings[name].virtual) {
        window._recordings[name].items = window._recording.items
      }
      window._recordings[name].updatedAt = Date.now()
    }
    localStorage.setItem(REC_COLLECTION_KEY, JSON.stringify(window._recordings))
    localStorage.setItem(REC_CURRENT_KEY, name)
    localStorage.setItem(REC_STATE_KEY, window._recording.state)
    // Best-effort cleanup of the legacy single-buffer key once we've fully
    // moved to the collection model.
    try { localStorage.removeItem(REC_KEY) } catch (_) {}
    // Mark dirty so the Sync button in the review dialog lights up. Cleared
    // on a successful sync to GitHub.
    window._recordingsDirty = true
    try { localStorage.setItem(REC_DIRTY_KEY, '1') } catch (_) {}
    _refreshRecordingSyncBtn()
  } catch (e) { console.warn('saveRecording failed', e) }
}

// ── GitHub sync for recordings ───────────────────────────────────────────
// Recordings live primarily in localStorage so they're free and instant.
// The Sync button in the review dialog pushes the local collection to
// db/language/${lang}/recordings.json so the same playlists show up on
// other devices. Conflict resolution is union-by-item: on commit, the
// merge callback unions remote+local per (recordingName, searchText, word)
// keyed by (id, lineIndex), so concurrent captures from another device
// are preserved.

function recordingsFilePath() {
  const lang = getLangFromUrl()
  return `db/language/${lang.fullName}/recordings.json`
}

function mergeRecordingCollections(localColl, remoteColl) {
  const out = {}
  const allNames = new Set([...Object.keys(localColl || {}), ...Object.keys(remoteColl || {})])
  allNames.forEach(name => {
    const a = (localColl && localColl[name]) || null
    const b = (remoteColl && remoteColl[name]) || null
    if (!a) { out[name] = b; return }
    if (!b) { out[name] = a; return }
    // Virtual playlists carry no items — merge them by unioning members
    // (newer's order first). If only one side is virtual, prefer the newer.
    if (a.virtual || b.virtual) {
      const aNewerV = (a.updatedAt || 0) >= (b.updatedAt || 0)
      const newer = aNewerV ? a : b
      const older = aNewerV ? b : a
      if (newer.virtual) {
        const members = []
        const seen = new Set()
        ;[].concat(newer.members || [], older.virtual ? (older.members || []) : []).forEach(m => {
          if (m && !seen.has(m)) { seen.add(m); members.push(m) }
        })
        out[name] = {
          virtual: true,
          members,
          createdAt: Math.min(a.createdAt || Date.now(), b.createdAt || Date.now()),
          updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0)
        }
      } else {
        out[name] = newer   // newer side is a real playlist — it wins
      }
      return
    }
    // Merge items: union by (id, lineIndex) within each (searchText, word).
    const mergedItems = {}
    const stKeys = new Set([...Object.keys(a.items || {}), ...Object.keys(b.items || {})])
    const aNewer = (a.updatedAt || 0) >= (b.updatedAt || 0)
    const first = aNewer ? a : b
    const second = aNewer ? b : a
    stKeys.forEach(st => {
      mergedItems[st] = {}
      const fByW = (first.items && first.items[st]) || {}
      const sByW = (second.items && second.items[st]) || {}
      const wKeys = new Set([...Object.keys(fByW), ...Object.keys(sByW)])
      wKeys.forEach(w => {
        const seen = new Set()
        const dest = []
        const push = (arr) => (arr || []).forEach(it => {
          if (!it) return
          const k = `${it.id}|${it.lineIndex}`
          if (seen.has(k)) return
          seen.add(k)
          dest.push(it)
        })
        push(fByW[w])    // newer wins on order
        push(sByW[w])
        mergedItems[st][w] = dest
      })
    })
    out[name] = {
      items: mergedItems,
      createdAt: Math.min(a.createdAt || Date.now(), b.createdAt || Date.now()),
      updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0)
    }
  })
  return out
}

async function loadRecordingsFromGithub() {
  try {
    const r = await fetch(`${getResourceUrl()}/recordings.json`, { cache: 'no-cache' })
    if (!r.ok) return null
    const text = await r.text()
    if (!text || !text.trim()) return null
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (e) {
    console.warn('loadRecordingsFromGithub failed', e)
    return null
  }
}

// Merge whatever's currently on github into the local in-memory collection.
// Called once during boot so the user's other-device captures show up. Does
// NOT clear the dirty flag — local captures since last sync stay dirty.
async function _mergeRemoteRecordingsIntoLocal() {
  const remote = await loadRecordingsFromGithub()
  if (!remote) return
  const merged = mergeRecordingCollections(window._recordings || {}, remote)
  window._recordings = merged
  // Keep the active recording's items pointer in sync with the merged entry.
  const cur = window._recording.currentName
  if (merged[cur]) window._recording.items = merged[cur].items
  // Persist without bumping dirty.
  try {
    localStorage.setItem(REC_COLLECTION_KEY, JSON.stringify(window._recordings))
  } catch (_) {}
  _updateRecordingUI()
  _markCapturedButtons()
}

async function syncRecordingsToGithub() {
  const filePath = recordingsFilePath()
  const $btn = $('#recRecSync')
  $btn.prop('disabled', true).addClass('syncing')
  try {
    await commitWithMerge({
      filePath,
      commitMessage: 'recordings: sync via language tool',
      merge: (remoteText) => {
        let remote = {}
        try { remote = remoteText ? JSON.parse(remoteText) : {} } catch (_) {}
        if (!remote || typeof remote !== 'object') remote = {}
        const merged = mergeRecordingCollections(window._recordings || {}, remote)
        // Adopt the merge result so subsequent local edits start from the
        // post-sync baseline, and a 409/422 retry sees fresh state.
        window._recordings = merged
        const cur = window._recording.currentName
        if (merged[cur]) window._recording.items = merged[cur].items
        try { localStorage.setItem(REC_COLLECTION_KEY, JSON.stringify(merged)) } catch (_) {}
        return JSON.stringify(merged, null, 2) + '\n'
      }
    })
    window._recordingsDirty = false
    try { localStorage.removeItem(REC_DIRTY_KEY) } catch (_) {}
  } catch (e) {
    console.error('syncRecordingsToGithub failed', e)
    alert('Sync failed: ' + (e && e.message || e))
    throw e
  } finally {
    $btn.prop('disabled', false).removeClass('syncing')
    _refreshRecordingSyncBtn()
    _updateRecordingUI()
  }
}

function _refreshRecordingSyncBtn() {
  const $btn = $('#recRecSync')
  if (!$btn.length) return
  $btn.toggleClass('rec-rec-dirty', !!window._recordingsDirty)
  $btn.find('.rec-rec-lbl').text(window._recordingsDirty ? 'Sync*' : 'Sync')
  $btn.attr('title', window._recordingsDirty
    ? 'Push local recordings to GitHub (unsynced changes)'
    : 'Push local recordings to GitHub (in sync)')
}

// ── Multi-recording CRUD ────────────────────────────────────────────────
// `recordings` here means named playlists. The currently active one is the
// target of all capture / remove / play / reorder operations.

function listRecordings() {
  return Object.keys(window._recordings || {}).sort((a, b) => a.localeCompare(b))
}

// A virtual playlist stores no items of its own — only a `members` list of
// real-playlist names. Its items are resolved on demand (select / play /
// review) as the union of its members'. This keeps combinations free in
// storage. `members` is filtered to existing, non-virtual playlists so a
// deleted/renamed member silently drops out.
function _isVirtual(name) {
  const r = window._recordings && window._recordings[name]
  return !!(r && r.virtual)
}
// Stable id for a manual entry — identity used for resume reconstitution
// (must survive playlist reorder / sync merge). Prefixed `mc-` to keep it
// distinct from YouTube videoIds (which are 11 chars, no dashes).
function _newManualId() {
  return 'mc-' + Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5)
}
function _isManualItem(it) { return !!(it && it.manual) }
// Parse a media URL into a discriminator + an extractable id where one
// applies. Returns null for blank input; otherwise:
//   { kind: 'youtube', id: '<videoId>', url }
//   { kind: 'link',    url }
// Falls back to 'link' for anything we don't recognise as YouTube so a
// user can paste any URL (Vimeo, an article, an mp3) and the Practice
// view will open it in a new tab.
function _parseMediaUrl(raw) {
  const url = String(raw == null ? '' : raw).trim()
  if (!url) return null
  // file:// — a Cupitor-saved audio recording (mediaUrl doubles as the audio
  // reference; playback routes through AudioBridge instead of opening it).
  if (url.startsWith('file://')) return { kind: 'audio', url }
  // youtu.be/<id> or youtube.com/watch?v=<id> or /embed/<id> or /shorts/<id>
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (yt && yt[1]) return { kind: 'youtube', id: yt[1], url }
  return { kind: 'link', url }
}
function _virtualMembers(name) {
  const r = window._recordings && window._recordings[name]
  if (!r || !r.virtual || !Array.isArray(r.members)) return []
  return r.members.filter(m => window._recordings[m] && !window._recordings[m].virtual)
}

// Resolve a virtual playlist's items to a single items-map (the same
// { [searchText]: { [word]: [items] } } shape as a real playlist). Item
// objects are REFERENCED, not copied, so this stays memory-cheap. Order
// follows the members list, then each member's own order, unioned by
// (id, lineIndex) within each (searchText, word).
function _resolveVirtualItems(name) {
  const out = {}
  _virtualMembers(name).forEach(m => {
    const items = (window._recordings[m] && window._recordings[m].items) || {}
    Object.keys(items).forEach(st => {
      if (!out[st]) out[st] = {}
      Object.keys(items[st]).forEach(w => {
        if (!out[st][w]) out[st][w] = []
        const seen = new Set(out[st][w].map(it => `${it.id}|${it.lineIndex}`))
        ;(items[st][w] || []).forEach(it => {
          if (!it) return
          const k = `${it.id}|${it.lineIndex}`
          if (seen.has(k)) return
          seen.add(k)
          out[st][w].push(it)
        })
      })
    })
  })
  return out
}

// Items-map for any playlist by name — resolves virtual ones.
function _itemsForRecording(name) {
  if (_isVirtual(name)) return _resolveVirtualItems(name)
  return (window._recordings[name] && window._recordings[name].items) || {}
}

function _recordingItemCountIn(items) {
  return Object.values(items || {}).reduce(
    (sum, words) => sum + Object.values(words).reduce((s2, arr) => s2 + arr.length, 0), 0)
}
function _recordingItemCountByName(name) {
  return _recordingItemCountIn(_itemsForRecording(name))
}

function selectRecording(name) {
  if (!window._recordings[name]) return false
  window._recording.currentName = name
  window._recording.virtual = _isVirtual(name)
  // For a virtual playlist, items is a freshly-resolved union (read-only —
  // capture/edit is blocked while a virtual playlist is active). For a real
  // one, we point at the live items object so captures mutate it in place.
  window._recording.items = window._recording.virtual
    ? _resolveVirtualItems(name)
    : window._recordings[name].items
  _saveRecording()
  _updateRecordingUI()
  _markCapturedButtons()
  return true
}

function createRecording(name) {
  name = String(name || '').trim()
  if (!name) return false
  if (window._recordings[name]) {
    alert(`A recording named "${name}" already exists.`)
    return false
  }
  window._recordings[name] = { items: {}, createdAt: Date.now(), updatedAt: Date.now() }
  selectRecording(name)
  return true
}

// Reserved playlist name for the random-sample playlist — only ever one
// of these in the collection. Re-running the action regenerates it (with
// a confirm prompt when it already exists).
const RANDOM_REC_NAME = 'Random From All'

// Build a fresh "Random From All" playlist by sampling items across every
// real, non-virtual playlist (excluding the random one itself to avoid
// recursion). Items are deep-copied so subsequent edits / deletes in the
// source playlists don't quietly mutate this snapshot.
//
// `count` — max items in the resulting playlist. Defaults to 50; bumped
// down if the union has fewer than that.
// Returns true on success, false if there's nothing to sample.
function createRandomFromAllPlaylist({ count = 50 } = {}) {
  const sourceNames = Object.keys(window._recordings || {}).filter(n =>
    n !== RANDOM_REC_NAME && !_isVirtual(n)
  )
  const flat = []
  const seen = new Set()
  sourceNames.forEach(name => {
    const items = (window._recordings[name] && window._recordings[name].items) || {}
    Object.keys(items).forEach(st => {
      Object.keys(items[st] || {}).forEach(w => {
        ;(items[st][w] || []).forEach(it => {
          if (!it) return
          // Dedupe across playlists by (id, lineIndex, manual-tag).
          const k = `${it.id || ''}|${it.lineIndex == null ? '' : it.lineIndex}|${it.manual ? 'm' : ''}`
          if (seen.has(k)) return
          seen.add(k)
          flat.push({ st, w, it })
        })
      })
    })
  })
  if (!flat.length) {
    alert('No items in any playlist to sample from.')
    return false
  }
  // Fisher-Yates shuffle.
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[flat[i], flat[j]] = [flat[j], flat[i]]
  }
  const pick = flat.slice(0, Math.min(count, flat.length))

  const grouped = {}
  pick.forEach(({ st, w, it }) => {
    if (!grouped[st]) grouped[st] = {}
    if (!grouped[st][w]) grouped[st][w] = []
    // Deep copy so source-playlist mutations don't bleed through.
    grouped[st][w].push(JSON.parse(JSON.stringify(it)))
  })

  const prev = window._recordings[RANDOM_REC_NAME]
  window._recordings[RANDOM_REC_NAME] = {
    items: grouped,
    createdAt: (prev && prev.createdAt) || Date.now(),
    updatedAt: Date.now(),
    random: true
  }
  selectRecording(RANDOM_REC_NAME)
  return true
}
window.createRandomFromAllPlaylist = createRandomFromAllPlaylist

// Add a manual entry to a real playlist. Manual entries live in the same
// `items[st][w]` map as captured items so they mix freely; they're put
// under a dedicated bucket `items['Manual']['Card']` (created lazily) so
// the existing st/w grouping in the Review dialog still applies. Media is
// optional — when present, Practice cues YouTube videos via the player
// and opens generic web links in a new tab.
const MANUAL_ST = 'Manual'
const MANUAL_W  = 'Card'
function addManualEntry(playlistName, opts) {
  opts = opts || {}
  const rec = window._recordings && window._recordings[playlistName]
  if (!rec || rec.virtual) {
    alert(`"${playlistName}" is a virtual playlist (or doesn't exist). Switch to a real playlist to add manual entries.`)
    return null
  }
  const source = String(opts.source == null ? '' : opts.source).trim()
  const target = String(opts.target == null ? '' : opts.target).trim()
  if (!source && !target) { alert('At least one of Source / Target must be filled in.'); return null }
  const media = _parseMediaUrl(opts.mediaUrl)
  const it = {
    manual: true,
    id: _newManualId(),
    source,
    target,
    enabled: true
  }
  if (media) {
    it.mediaUrl = media.url
    it.mediaKind = media.kind                // 'youtube' | 'link' | 'audio'
    if (media.kind === 'youtube') it.mediaVideoId = media.id
  }
  if (!rec.items)                          rec.items = {}
  if (!rec.items[MANUAL_ST])               rec.items[MANUAL_ST] = {}
  if (!Array.isArray(rec.items[MANUAL_ST][MANUAL_W])) rec.items[MANUAL_ST][MANUAL_W] = []
  rec.items[MANUAL_ST][MANUAL_W].push(it)
  rec.updatedAt = Date.now()
  _saveRecording()
  // Refresh the live items pointer if this is the active playlist (so the
  // Review dialog and play-queue builder see the new entry immediately).
  if (window._recording && window._recording.currentName === playlistName && !window._recording.virtual) {
    window._recording.items = rec.items
  }
  return it
}
function updateManualEntry(playlistName, manualId, patch) {
  const rec = window._recordings && window._recordings[playlistName]
  if (!rec || !rec.items) return false
  for (const st of Object.keys(rec.items)) {
    for (const w of Object.keys(rec.items[st] || {})) {
      const arr = rec.items[st][w] || []
      const it = arr.find(x => x && x.manual && x.id === manualId)
      if (!it) continue
      if (Object.prototype.hasOwnProperty.call(patch, 'source')) it.source = String(patch.source || '').trim()
      if (Object.prototype.hasOwnProperty.call(patch, 'target')) it.target = String(patch.target || '').trim()
      if (Object.prototype.hasOwnProperty.call(patch, 'mediaUrl')) {
        const m = _parseMediaUrl(patch.mediaUrl)
        if (m) { it.mediaUrl = m.url; it.mediaKind = m.kind; if (m.kind === 'youtube') it.mediaVideoId = m.id; else delete it.mediaVideoId }
        else   { delete it.mediaUrl; delete it.mediaKind; delete it.mediaVideoId }
      }
      rec.updatedAt = Date.now()
      _saveRecording()
      return true
    }
  }
  return false
}

// Create a virtual playlist that combines the given real-playlist members.
function createVirtualRecording(name, members) {
  name = String(name || '').trim()
  if (!name) return false
  if (window._recordings[name]) {
    alert(`A recording named "${name}" already exists.`)
    return false
  }
  const valid = (members || []).filter(m => window._recordings[m] && !window._recordings[m].virtual)
  if (!valid.length) {
    alert('Pick at least one real playlist to combine.')
    return false
  }
  window._recordings[name] = {
    virtual: true,
    members: valid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  selectRecording(name)
  return true
}
window.createVirtualRecording = createVirtualRecording

// Update an existing virtual playlist's member list.
function setVirtualMembers(name, members) {
  const r = window._recordings && window._recordings[name]
  if (!r || !r.virtual) return false
  const valid = (members || []).filter(m => window._recordings[m] && !window._recordings[m].virtual)
  if (!valid.length) { alert('A virtual playlist needs at least one member.'); return false }
  r.members = valid
  r.updatedAt = Date.now()
  // Re-resolve if it's the active one.
  if (window._recording.currentName === name) {
    window._recording.items = _resolveVirtualItems(name)
  }
  _saveRecording()
  return true
}
window.setVirtualMembers = setVirtualMembers

function renameRecording(oldName, newName) {
  oldName = String(oldName || '')
  newName = String(newName || '').trim()
  if (!newName || !window._recordings[oldName]) return false
  if (newName === oldName) return true
  if (window._recordings[newName]) {
    alert(`A recording named "${newName}" already exists.`)
    return false
  }
  window._recordings[newName] = window._recordings[oldName]
  delete window._recordings[oldName]
  if (window._recording.currentName === oldName) {
    window._recording.currentName = newName
  }
  _saveRecording()
  return true
}

function deleteRecording(name) {
  if (!window._recordings[name]) return false
  const isV = _isVirtual(name)
  const count = isV ? _recordingItemCountByName(name) : _recordingItemCountIn(window._recordings[name].items)
  const kind = isV ? 'virtual playlist' : 'recording'
  if (!confirm(`Delete ${kind} "${name}"${count ? ` (${count} item${count === 1 ? '' : 's'})` : ''}? This cannot be undone.`)) return false
  delete window._recordings[name]
  if (!Object.keys(window._recordings).length) {
    window._recordings[REC_DEFAULT_NAME] = { items: {}, createdAt: Date.now(), updatedAt: Date.now() }
  }
  // If we deleted the active one, switch to the first remaining (resolving
  // virtual items if that happens to be a virtual playlist).
  if (window._recording.currentName === name) {
    const next = Object.keys(window._recordings)[0]
    window._recording.currentName = next
    window._recording.virtual = _isVirtual(next)
    window._recording.items = window._recording.virtual
      ? _resolveVirtualItems(next)
      : window._recordings[next].items
  }
  _saveRecording()
  _updateRecordingUI()
  _markCapturedButtons()
  return true
}

function duplicateRecording(name, newName) {
  if (!window._recordings[name]) return false
  newName = String(newName || (name + ' (copy)')).trim()
  if (window._recordings[newName]) {
    alert(`A recording named "${newName}" already exists.`)
    return false
  }
  if (window._recordings[name].virtual) {
    // Duplicating a virtual playlist copies its member list, not items.
    window._recordings[newName] = {
      virtual: true,
      members: (window._recordings[name].members || []).slice(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  } else {
    // Deep clone so the copy doesn't share array refs with the source.
    const copy = JSON.parse(JSON.stringify(window._recordings[name].items || {}))
    window._recordings[newName] = { items: copy, createdAt: Date.now(), updatedAt: Date.now() }
  }
  selectRecording(newName)
  return true
}

function _recordingItemCount() {
  return Object.values(window._recording.items || {}).reduce(
    (sum, words) => sum + Object.values(words).reduce((s2, arr) => s2 + arr.length, 0), 0)
}

function _updateRecordingUI() {
  const s = window._recording.state
  $('#recStartBtn').toggle(s === 'idle').toggleClass('is-recording', false)
  $('#recPauseBtn').toggle(s === 'recording')
  $('#recResumeBtn').toggle(s === 'paused')
  $('#recStopBtn').toggle(s !== 'idle')
  $('body').toggleClass('rec-active', s !== 'idle')
  $('body').toggleClass('rec-paused', s === 'paused')
  const n = _recordingItemCount()
  const name = window._recording.currentName || REC_DEFAULT_NAME
  $('#recStatus').text(
    s === 'idle'      ? (n ? `[${name}] · ${n} item${n===1?'':'s'} saved` : `[${name}]`)
    : s === 'paused'  ? `[${name}] · paused · ${n} item${n===1?'':'s'}`
    :                   `[${name}] · recording · ${n} item${n===1?'':'s'}`
  )
}

function startRecording()  {
  // Can't capture into a virtual playlist — it's just a view over real ones.
  if (window._recording.virtual) {
    alert(`"${window._recording.currentName}" is a virtual playlist (a combination of others). Switch to a real playlist to record into.`)
    return
  }
  window._recording.state = 'recording'
  _saveRecording()
  _updateRecordingUI()
  // Close the settings dialog so the user can see the capture buttons
  // appear next to each match on the results page (especially relevant
  // on mobile where the dialog covers the whole viewport).
  try { autoHideSettingsPanel() } catch (_) {}
}
function pauseRecording()  { if (window._recording.state === 'recording') { window._recording.state = 'paused';    _saveRecording(); _updateRecordingUI() } }
function resumeRecording() { if (window._recording.state === 'paused')    { window._recording.state = 'recording'; _saveRecording(); _updateRecordingUI() } }
function stopRecording()   { window._recording.state = 'idle'; _saveRecording(); _updateRecordingUI() }
function clearRecording()  {
  if (window._recording.virtual) {
    alert('A virtual playlist has no items of its own — clear its member playlists instead.')
    return
  }
  if (!confirm(`Discard all items in "${window._recording.currentName}"?`)) return
  // Clear in place — items is a live reference to the active recording's
  // bucket inside window._recordings, so replacing with {} would orphan it.
  Object.keys(window._recording.items).forEach(k => delete window._recording.items[k])
  _saveRecording()
  _updateRecordingUI()
  _markCapturedButtons()
}

// Click handler for `.capture-btn` next to a match's .buttons row. Walks
// up to the surrounding .lines-cntnr to pull out url / source / times,
// then up to .srt-file > h4[data-file] to recover the `word` heading.
// Toggles: if no matching (id, lineIndex) entry exists for this (st, w),
// it adds one; if any do, it removes them all. Duplicating the same line
// is now an explicit action (the rec-dup icon in the review dialog).
function _captureMatchFromButton($capBtn) {
  if (window._recording.state !== 'recording') return
  const $linesCntnr = $capBtn.closest('.lines-cntnr')
  if (!$linesCntnr.length) return
  const $pbc = $linesCntnr.find('.play-btn-container').first()
  if (!$pbc.length) return
  const url       = ($pbc.attr('data-url')        || '').toString()
  const source    = ($pbc.attr('data-source')     || '').toString()
  const timeStart = parseInt($pbc.attr('data-time-start'), 10)
  const timeEnd   = parseInt($pbc.attr('data-time-end'),   10)
  const lineIndex = parseInt($pbc.attr('data-match-line-index'), 10)
  const word      = ($linesCntnr.closest('.srt-file').find('h4[data-file]').first().text() || '').trim()
  const searchText= (window.searchText || '').trim()
  if (!searchText || !word || !url || !Number.isFinite(timeStart) || !Number.isFinite(lineIndex)) {
    console.warn('captureMatch: missing required field', { searchText, word, url, timeStart, lineIndex })
    return
  }

  const items = window._recording.items
  if (!items[searchText])       items[searchText]       = {}
  if (!items[searchText][word]) items[searchText][word] = []
  const arr = items[searchText][word]
  const before = arr.length
  // Toggle: remove every existing entry that matches (id, lineIndex), or
  // add a fresh one if there were none.
  const filtered = arr.filter(it => !(it && it.id === url && parseInt(it.lineIndex, 10) === lineIndex))
  if (filtered.length < before) {
    // Was captured — strip it.
    items[searchText][word] = filtered
    if (!filtered.length) delete items[searchText][word]
    if (!Object.keys(items[searchText]).length) delete items[searchText]
  } else {
    arr.push({ searchText, word, id: url, source, timeStart, timeEnd, lineIndex, enabled: true })
  }
  _saveRecording()
  _updateRecordingUI()
  // Brief flash on the clicked button, then rewalk everything so any other
  // capture-btn for the same (st, w, id) also picks up the new captured
  // state (e.g. other line-matches of the same video for this search).
  $capBtn.addClass('captured')
  setTimeout(() => {
    $capBtn.removeClass('captured')
    _markCapturedButtons()
  }, 500)
}

function removeRecordedItem(searchText, word, idx) {
  const items = window._recording.items
  if (!items[searchText] || !items[searchText][word]) return
  items[searchText][word].splice(idx, 1)
  if (items[searchText][word].length === 0) delete items[searchText][word]
  if (Object.keys(items[searchText]).length === 0) delete items[searchText]
  _saveRecording()
  _updateRecordingUI()
  _markCapturedButtons()
}

// Remove an item by its queue-row identity (origin recName/st/w + id/lineIndex).
// Used by the Practice view's delete button — the active recording may not be
// the row's source (loop='all' crosses recordings), so we resolve the right
// playlist via _recName and match by identity tuple, not by stored _idx
// (which may have drifted if other items were removed since).
function _removeQueueItem(it) {
  if (!it || !it._recName) return false
  const rec = window._recordings && window._recordings[it._recName]
  if (!rec || rec.virtual || !rec.items) return false
  const st = it._st, w = it._w
  const arr = rec.items[st] && rec.items[st][w]
  if (!Array.isArray(arr)) return false
  let i = arr.findIndex(x => x && x.id === it.id && x.lineIndex === it.lineIndex)
  if (i < 0) i = (typeof it._idx === 'number') ? it._idx : -1
  if (i < 0 || i >= arr.length) return false
  arr.splice(i, 1)
  if (arr.length === 0) delete rec.items[st][w]
  if (rec.items[st] && Object.keys(rec.items[st]).length === 0) delete rec.items[st]
  rec.updatedAt = Date.now()
  _saveRecording()
  // If the active recording is the one we just mutated, sync the live
  // pointer + repaint capture buttons; otherwise just save and move on.
  if (window._recording && window._recording.currentName === it._recName && !window._recording.virtual) {
    window._recording.items = rec.items
    _markCapturedButtons()
  }
  _updateRecordingUI()
  return true
}

// Purge every recorded item that references `videoId` (item.id) from ALL
// real playlists. Called when a video is deleted from the media library, or
// when the user confirms deletion of an unavailable video during playback.
// Virtual playlists hold no items of their own (they resolve their members
// on demand), so cleaning the real playlists is sufficient — but we refresh
// the active playlist's live items pointer afterwards so the open UI matches.
// Returns the number of items removed.
function removeVideoFromAllPlaylists(videoId) {
  if (!videoId || !window._recordings) return 0
  let removed = 0
  Object.keys(window._recordings).forEach(name => {
    const pl = window._recordings[name]
    if (!pl || pl.virtual || !pl.items) return
    const items = pl.items
    Object.keys(items).forEach(st => {
      Object.keys(items[st]).forEach(w => {
        const before = items[st][w].length
        items[st][w] = items[st][w].filter(it => it && it.id !== videoId)
        removed += before - items[st][w].length
        if (items[st][w].length === 0) delete items[st][w]
      })
      if (Object.keys(items[st]).length === 0) delete items[st]
    })
  })
  if (removed > 0) {
    // Re-sync the active recording's items view (real → same object ref;
    // virtual → re-resolve the union now that a member changed).
    const cur = window._recording && window._recording.currentName
    if (cur && window._recordings[cur]) {
      window._recording.items = _isVirtual(cur)
        ? _resolveVirtualItems(cur)
        : window._recordings[cur].items
    }
    _saveRecording()
    try { _updateRecordingUI() } catch (_) {}
    try { _markCapturedButtons() } catch (_) {}
  }
  return removed
}
window.removeVideoFromAllPlaylists = removeVideoFromAllPlaylists

// Toggle include/exclude on a single recorded item (used by review-dialog
// checkboxes). Doesn't refresh the dialog — the checkbox state is already
// reflected in the DOM by the user's click.
function _setRecordedItemEnabled(searchText, word, idx, enabled) {
  const items = window._recording.items
  const arr = items && items[searchText] && items[searchText][word]
  if (!arr || !arr[idx]) return
  arr[idx].enabled = !!enabled
  _saveRecording()
}

// Reorder helpers — Sortable lets the user drag rows within a word group.
// We rewrite the (searchText, word) array in the order the DOM presents,
// keyed by data-idx so the original indices stay intact regardless of order.
function _reorderWordItems(searchText, word, newOrderIdxs) {
  const items = window._recording.items
  const arr = items && items[searchText] && items[searchText][word]
  if (!arr) return
  const next = newOrderIdxs.map(i => arr[i]).filter(Boolean)
  items[searchText][word] = next
  _saveRecording()
}

// Insert a duplicate of the item at (st, w, idx) immediately AFTER the
// original. Useful for repetition without leaving the review dialog.
// Returns true on success.
function duplicateRecordedItem(st, w, idx) {
  const items = window._recording && window._recording.items
  const arr = items && items[st] && items[st][w]
  if (!arr || !arr[idx]) return false
  const copy = { ...arr[idx] }
  arr.splice(idx + 1, 0, copy)
  _saveRecording()
  _updateRecordingUI()
  try { _markCapturedButtons() } catch (_) {}
  return true
}
window.duplicateRecordedItem = duplicateRecordedItem

// Truncate a single-line preview string. Collapses internal whitespace so
// multi-line SRT entries render as one line in the review dialog.
function _truncatePreview(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// Resolve the source-language line text for an item. Returns '' if the
// subtitles aren't in memory yet — the caller can either show a
// placeholder or trigger an async fetch via _lazyLoadRecItemPreviews.
function _previewTextForRecItem(it) {
  if (!it || it.lineIndex == null) return ''
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().code) || 'sv'
  try { return _getRawSubtitleLineText(it.id, lang, it.lineIndex) || '' } catch (_) { return '' }
}

// After the review dialog renders, lazy-fetch subtitles for any items
// whose source SRT wasn't already in window.allSubtitles. We dedupe by
// videoId so 20 items pointing at the same video make one fetch.
async function _lazyLoadRecItemPreviews($dlg) {
  const $pending = $dlg.find('.rec-item-preview[data-pending="1"]')
  if (!$pending.length) return
  const ids = new Set()
  $pending.each(function () {
    const id = String($(this).attr('data-id') || '')
    if (id) ids.add(id)
  })
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().code) || 'sv'
  await Promise.all(Array.from(ids).map(async id => {
    try { await getSubtitlesForLink(id) } catch (_) {}
  }))
  $pending.each(function () {
    const $p = $(this)
    const id   = String($p.attr('data-id') || '')
    const line = String($p.attr('data-line') || '')
    const text = _getRawSubtitleLineText(id, lang, line)
    $p.removeAttr('data-pending')
    if (text) {
      $p.text(_truncatePreview(text, 80))
    } else {
      $p.text('(no preview available)').addClass('rec-item-preview-missing')
    }
  })
}

// Copy a single recorded item from one playlist (recording) to another.
// The source entry is left intact — useful for sharing a clip across
// playlists without losing the original. Returns true on success.
function copyItemToPlaylist(srcRecName, st, w, idx, destRecName) {
  if (!srcRecName || !destRecName || srcRecName === destRecName) return false
  const src = window._recordings && window._recordings[srcRecName]
  const dst = window._recordings && window._recordings[destRecName]
  if (!src || !dst) return false
  if (dst.virtual) { alert('Cannot copy into a virtual playlist — add the source playlist as a member instead.'); return false }
  const it = src.items && src.items[st] && src.items[st][w] && src.items[st][w][idx]
  if (!it) return false
  if (!dst.items[st])       dst.items[st]       = {}
  if (!dst.items[st][w])    dst.items[st][w]    = []
  dst.items[st][w].push({ ...it })
  dst.updatedAt = Date.now()
  try {
    localStorage.setItem(REC_COLLECTION_KEY, JSON.stringify(window._recordings))
    window._recordingsDirty = true
    localStorage.setItem(REC_DIRTY_KEY, '1')
    try { _refreshRecordingSyncBtn() } catch (_) {}
  } catch (_) {}
  return true
}
window.copyItemToPlaylist = copyItemToPlaylist

// Cycle helper for the loop button: off → one → playlist → all → off.
const REC_LOOP_ORDER = ['off', 'one', 'playlist', 'all']
function _nextLoopMode(cur) {
  const i = REC_LOOP_ORDER.indexOf(cur || 'off')
  return REC_LOOP_ORDER[(i + 1) % REC_LOOP_ORDER.length]
}

// Player-overlay toggles for shuffle and loop. They mutate _appSettings so
// the choices persist across sessions, and they update the LIVE queue when
// possible so the change is felt without restarting playback.
function toggleRecPlayShuffle() {
  const cur = !!(window._appSettings && window._appSettings.recPlayShuffle)
  window._appSettings.recPlayShuffle = !cur
  try { saveAppSettings() } catch (_) {}
  // If we're already playing, re-shuffle the queue tail (everything AFTER
  // the currently-playing item) so the change is heard immediately. We
  // don't touch the item the user is hearing right now. Turning shuffle
  // off mid-playback doesn't try to "unshuffle" — that history isn't
  // recoverable cheaply; the next play session will reflect the new flag.
  if (!cur && window._playingRecording && Array.isArray(window._recPlayQueue)) {
    const q = window._recPlayQueue
    const i = window._recPlayIndex || 0
    const tail = q.slice(i + 1)
    _shuffleQueue(tail)
    tail.forEach((it, k) => { q[i + 1 + k] = it })
  }
  _refreshRecPlayModeBtns()
}
function cycleRecPlayLoopMode() {
  const next = _nextLoopMode((window._appSettings && window._appSettings.recPlayLoop) || 'off')
  window._appSettings.recPlayLoop = next
  try { saveAppSettings() } catch (_) {}
  _refreshRecPlayModeBtns()
}
function _refreshRecPlayModeBtns() {
  const sh = !!(window._appSettings && window._appSettings.recPlayShuffle)
  const lm = (window._appSettings && window._appSettings.recPlayLoop) || 'off'
  const $sh = $('#recPlayingShuffleBtn')
  if ($sh.length) {
    $sh.toggleClass('active', sh).attr('aria-pressed', sh)
      .attr('title', sh ? 'Shuffle: on (tap to turn off)' : 'Shuffle: off (tap to shuffle the queue)')
  }
  const $lp = $('#recPlayingLoopBtn')
  if ($lp.length) {
    let icon = '↪', label = 'no loop'
    if      (lm === 'one')      { icon = '🔂'; label = 'one' }
    else if (lm === 'playlist') { icon = '🔁'; label = 'list' }
    else if (lm === 'all')      { icon = '∞';  label = 'all' }
    $lp.attr('data-loop', lm).attr('title', `Loop: ${label} (tap to cycle)`).text(icon)
    $lp.toggleClass('active', lm !== 'off')
  }
}
window.toggleRecPlayShuffle = toggleRecPlayShuffle
window.cycleRecPlayLoopMode = cycleRecPlayLoopMode

// Member-picker for creating / editing a virtual playlist. `existingName`
// null → create mode (asks for a name); otherwise edit that virtual
// playlist's members. Only REAL playlists are offered as members.
function _openVirtualPlaylistEditor(existingName) {
  const realNames = listRecordings().filter(n => !_isVirtual(n))
  if (!realNames.length) { alert('Create at least one real playlist first.'); return }
  const current = existingName ? _virtualMembers(existingName) : []
  const currentSet = new Set(current)

  let $d = $('#virtualPlaylistEditor')
  if ($d.length) { try { $d.dialog('destroy') } catch (_) {} $d.remove() }
  $d = $('<div id="virtualPlaylistEditor"></div>').appendTo('body')

  let inner = ''
  if (!existingName) {
    inner += `<label class="vpe-name-label">Name
      <input type="text" id="vpeName" placeholder="e.g. Week 1 + Week 2" />
    </label>`
  }
  inner += `<div class="vpe-hint">Pick the playlists to combine:</div><div class="vpe-list">`
  realNames.forEach(n => {
    const cnt = _recordingItemCountByName(n)
    const chk = currentSet.has(n) ? 'checked' : ''
    inner += `<label class="vpe-row">
      <input type="checkbox" class="vpe-member" value="${_.escape(n)}" ${chk}>
      <span class="vpe-row-name">${_.escape(n)}</span>
      <span class="vpe-row-count">${cnt}</span>
    </label>`
  })
  inner += `</div>`
  $d.html(inner)

  const finish = () => {
    const members = $d.find('.vpe-member:checked').map(function () { return String($(this).val()) }).get()
    if (!members.length) { alert('Pick at least one playlist.'); return false }
    if (existingName) {
      if (setVirtualMembers(existingName, members)) { selectRecording(existingName); return true }
      return false
    }
    const name = String($d.find('#vpeName').val() || '').trim()
    if (!name) { alert('Enter a name for the virtual playlist.'); return false }
    return createVirtualRecording(name, members)
  }

  $d.dialog({
    title: existingName ? `Edit "${existingName}"` : 'New Virtual Playlist',
    width: Math.min(420, $(window).width() - 40),
    modal: true,
    autoOpen: true,
    buttons: {
      'Save': function () { if (finish()) { try { $(this).dialog('close') } catch (_) {} openRecordingReviewDialog() } },
      'Cancel': function () { try { $(this).dialog('close') } catch (_) {} }
    }
  })
}
window._openVirtualPlaylistEditor = _openVirtualPlaylistEditor

// Add or edit a manual flashcard entry inside the named real playlist.
// `existing` is the live item object (mutated in place via updateManualEntry)
// when editing, or null when adding a new card. Modal so the user finishes
// the form before returning to the review dialog.
// Per-entry audio recordings.
//
// Audio is persisted on the device file system via the Cupitor app's
// AudioBridge JS channel. The entry stores just the resulting `file://...`
// URL in its `mediaUrl` field (with `mediaKind: 'audio'`); the bytes
// themselves never live inside the _recordings JSON. The recorder UI is
// only shown when the bridge is present — there is no browser fallback.
//
// JS API (Promise-based, all resolve to null on failure rather than throw):
//   const url      = await saveManualAudioBlob(id, dataUrl)   // → file://...
//   const dataUrl  = await loadManualAudioData(fileUrl)       // → data:...
//   await deleteManualAudio(fileUrl)
//
// The file:// URL is opaque to JS — never feed it directly to new Audio(),
// always round-trip through loadManualAudioData().

const _AUDIO_PENDING = Object.create(null)
let _audioReqSeq = 1
function _nextAudioRid() { return 'a' + (_audioReqSeq++) + '_' + Date.now().toString(36) }
function _haveAudioBridge() { return !!(window.AudioBridge && typeof window.AudioBridge.postMessage === 'function') }

// Dart calls this with {op, rid, result?, error?}. Resolves the matching
// Promise we registered when we sent the request.
window.__cupAudio = function (envelope) {
  if (!envelope || !envelope.rid) return
  const pending = _AUDIO_PENDING[envelope.rid]
  if (!pending) return
  delete _AUDIO_PENDING[envelope.rid]
  if (envelope.error) pending.reject(new Error(envelope.error))
  else                pending.resolve(envelope.result)
}

function _audioRpc(op, payload) {
  if (!_haveAudioBridge()) return Promise.reject(new Error('no-bridge'))
  return new Promise((resolve, reject) => {
    const rid = _nextAudioRid()
    _AUDIO_PENDING[rid] = { resolve, reject }
    try {
      window.AudioBridge.postMessage(JSON.stringify(Object.assign({ op, rid }, payload || {})))
    } catch (e) {
      delete _AUDIO_PENDING[rid]
      reject(e)
    }
  })
}

async function saveManualAudioBlob(id, dataUrl) {
  if (!id || !dataUrl || !_haveAudioBridge()) return null
  try { return await _audioRpc('save', { id, dataUrl }) }
  catch (e) { console.warn('[manualAudio] bridge save failed', e); alert('Could not save audio: ' + (e && e.message || e)); return null }
}

async function loadManualAudioData(url) {
  if (!url || !url.startsWith('file://') || !_haveAudioBridge()) return null
  try { return await _audioRpc('load', { url }) }
  catch (e) { console.warn('[manualAudio] bridge load failed', e); return null }
}

async function deleteManualAudio(url) {
  if (!url || !url.startsWith('file://') || !_haveAudioBridge()) return
  try { await _audioRpc('delete', { url }) }
  catch (e) { console.warn('[manualAudio] delete failed', e) }
}

// Ask Dart to make sure the host app holds Android's RECORD_AUDIO runtime
// permission, prompting the user if needed. Returns one of:
//   'granted'   — RECORD_AUDIO is now held (or was already)
//   'denied'    — user said no (or denied permanently)
//   'unknown'   — bridge call failed / op not recognised (older app build)
// The recorder treats 'unknown' the same as 'granted' for the purpose of
// blocking — we fall through to getUserMedia, which will fire WebView's
// own onPermissionRequest path. That keeps users on a partial upgrade
// (new JS, old APK) from being locked out.
async function ensureMicPermissionViaBridge() {
  if (!_haveAudioBridge()) return 'unknown'   // plain browser — let getUserMedia prompt
  try {
    const r = await _audioRpc('ensureMicPerm', {})
    return r === 'granted' ? 'granted' : 'denied'
  } catch (e) {
    console.warn('[manualAudio] ensureMicPerm bridge call failed, falling through', e)
    return 'unknown'
  }
}

// True when a mediaUrl is one of our recorded audio files.
function _isAudioMediaUrl(u) { return typeof u === 'string' && u.startsWith('file://') }

// ─── Native recording (via AudioBridge / Android MediaRecorder) ──────────
// The editor's $rec/$stop handlers call `_audioRpc('recordStart' | 'recordStop')`
// directly so they can inspect the PlatformException code (in particular
// 'permission-denied'). `nativeRecordCancel()` is exposed as a wrapper
// because the cleanup path wants to fire-and-forget without caring about
// outcome — it just needs the in-progress MediaRecorder torn down on
// dialog dismissal.
async function nativeRecordCancel() {
  if (!_haveAudioBridge()) return
  try { await _audioRpc('recordCancel', {}) }
  catch (e) { console.warn('[manualAudio] nativeRecordCancel failed', e) }
}

// ─── Manual-audio preview singleton ──────────────────────────────────────
// Only one clip plays at a time across the page (recording-review badge,
// practice media-link button). Clicking the same button while playing
// stops it; clicking a different button stops the first and starts the
// second. Practice navigation/close also stop playback via
// _stopManualAudioPreview() so audio doesn't outlive the card on screen.
//
// State on window so it survives function-scope re-renders (the practice
// card DOM is rebuilt on every navigation).
//   window._manualAudioPreview = { audio, $btn, restoreLabel, restoreTitle }
window._manualAudioPreview = window._manualAudioPreview || null

function _stopManualAudioPreview() {
  const p = window._manualAudioPreview
  if (!p) return
  window._manualAudioPreview = null
  try { p.audio.pause() } catch (_) {}
  try { p.audio.currentTime = 0 } catch (_) {}
  if (p.$btn && p.$btn.length) {
    try { p.$btn.html(p.restoreLabel) } catch (_) {}
    if (p.restoreTitle != null) { try { p.$btn.attr('title', p.restoreTitle) } catch (_) {} }
  }
}

// Toggle-style entry point used by every "play this audio mediaUrl" button
// outside the manual-entry editor. Returns immediately; logs+gives up on
// failure rather than alerting (these are casual previews, not saves).
async function _startManualAudioPreview(url, $btn) {
  if (!url) return
  // Same button clicked again → stop.
  const cur = window._manualAudioPreview
  if (cur && cur.$btn && $btn && cur.$btn.is($btn)) { _stopManualAudioPreview(); return }
  // Different button: stop the old clip first so we don't double-play.
  _stopManualAudioPreview()
  const dataUrl = await loadManualAudioData(url)
  if (!dataUrl) { console.warn('[manualAudio] could not load', url); return }
  const a = new Audio(dataUrl)
  const restoreLabel = $btn ? $btn.html() : null
  const restoreTitle = $btn ? $btn.attr('title') : null
  if ($btn && $btn.length) {
    $btn.html('■')
    $btn.attr('title', 'Stop playback')
  }
  const state = { audio: a, $btn, restoreLabel, restoreTitle }
  window._manualAudioPreview = state
  const settle = () => { if (window._manualAudioPreview === state) _stopManualAudioPreview() }
  a.addEventListener('ended', settle)
  a.addEventListener('error', settle)
  try { await a.play() } catch (e) { console.warn('[manualAudio] play failed', e); settle() }
}
window._stopManualAudioPreview = _stopManualAudioPreview

function _openManualEntryEditor(playlistName, existing) {
  let $d = $('#manualEntryEditor')
  if (!$d.length) $d = $('<div id="manualEntryEditor"></div>').appendTo('body')
  const isEdit = !!existing
  // Audio recording requires the Cupitor app's AudioBridge so we can persist
  // the bytes on the device file system. In a plain browser there's no such
  // bridge, and we deliberately don't fall back to localStorage here — audio
  // is too big for it and users would silently lose recordings on quota
  // errors. Just hide the section instead.
  const showAudio = _haveAudioBridge()
  $d.html(`
    <div class="mee-row"><label class="mee-lbl">Source</label>
      <textarea id="meeSource" class="mee-input" rows="2" placeholder="Question, source text, prompt…"></textarea></div>
    <div class="mee-row"><label class="mee-lbl">Target</label>
      <textarea id="meeTarget" class="mee-input" rows="2" placeholder="Answer, target text, translation…"></textarea></div>
    <div class="mee-row"><label class="mee-lbl">Media URL <span class="mee-lbl-hint">(optional — YouTube link or any web link)</span></label>
      <input id="meeMedia" class="mee-input" type="url" placeholder="https://…"></div>
    <div class="mee-hint" style="font-size:12px;color:#666;">YouTube URLs are recognised automatically and will play in the embedded player during Practice / Play. Other URLs open in a new tab.</div>
    ${showAudio ? `
    <div class="mee-row" style="margin-top:10px;border-top:1px solid #eee;padding-top:8px;">
      <label class="mee-lbl">Audio <span class="mee-lbl-hint">(optional — recorded pronunciation, saved on device)</span></label>
      <div id="meeAudioBar" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <button type="button" id="meeAudioRec"    class="btn" title="Start recording">● Record</button>
        <button type="button" id="meeAudioStop"   class="btn" title="Stop recording" disabled>■ Stop</button>
        <button type="button" id="meeAudioPlay"   class="btn" title="Play recording" disabled>▶ Play</button>
        <button type="button" id="meeAudioDel"    class="btn" title="Delete recording" disabled style="color:#a00;">🗑</button>
        <span id="meeAudioStatus" style="font-size:12px;color:#666;margin-left:4px;">(no audio)</span>
      </div>
    </div>` : ''}
  `)
  $d.find('#meeSource').val(existing ? existing.source || '' : '')
  $d.find('#meeTarget').val(existing ? existing.target || '' : '')
  // Don't surface a file:// URL in the Media URL text input — the audio
  // recorder section below represents it instead. Showing the raw file://
  // path would let the user accidentally edit it into nonsense.
  {
    const mu = existing ? existing.mediaUrl || '' : ''
    $d.find('#meeMedia').val(_isAudioMediaUrl(mu) ? '' : mu)
  }

  // ── Audio recorder state (scoped to this dialog instance) ──
  // Only wired up when `showAudio` is true (i.e. we're inside the Cupitor
  // app's WebView, where AudioBridge can persist to the device file system).
  // In a plain browser the audio UI isn't rendered and these stay unused.
  let audioUrl = null
  // True when `audioUrl` points to a just-recorded native file that hasn't
  // been committed to the entry yet — used by cleanup()/del to know whether
  // to delete it on cancel. Existing-entry audio left in place has this
  // false: the file belongs to the saved entry, not to this dialog.
  let audioUrlIsNew = false
  // Recording state for the native MediaRecorder path (via AudioBridge).
  // We don't keep a MediaRecorder/getUserMedia stream around any more — the
  // Android side owns those. We just track whether a recording is in flight
  // and tick the visible duration off the wall clock.
  let nativeRecording = false
  let recStartMs = 0
  let recTimerId = null
  // Active <Audio> element during preview playback. Tracked so a second Play
  // click stops the current playback (toggle), and so syncAudioUI can flip
  // the button label between ▶ Play / ■ Stop.
  let playbackAudio = null

  if (showAudio) {
    audioUrl = _isAudioMediaUrl(existing && existing.mediaUrl) ? existing.mediaUrl : null

    const $rec  = $d.find('#meeAudioRec')
    const $stop = $d.find('#meeAudioStop')
    const $play = $d.find('#meeAudioPlay')
    const $del  = $d.find('#meeAudioDel')
    const $stat = $d.find('#meeAudioStatus')
    function _hasAudio() { return !!audioUrl }
    function _isPlaying() { return !!(playbackAudio && !playbackAudio.paused && !playbackAudio.ended) }
    function _stopPlayback() {
      if (playbackAudio) {
        try { playbackAudio.pause() } catch (_) {}
        try { playbackAudio.currentTime = 0 } catch (_) {}
        playbackAudio = null
      }
    }
    function syncAudioUI(extra) {
      const recording = nativeRecording
      const playing = _isPlaying()
      $rec.prop('disabled',  recording || playing)
      $stop.prop('disabled', !recording)
      $play.prop('disabled', recording || !_hasAudio())
      $play.text(playing ? '■ Stop' : '▶ Play')
      $del.prop('disabled',  recording || playing || !_hasAudio())
      if (recording) {
        const secs = Math.floor((Date.now() - recStartMs) / 1000)
        $stat.text(`recording… ${secs}s`).css('color', '#a00')
      } else if (playing) {
        $stat.text('playing…').css('color', '#06a')
      } else if (extra) {
        $stat.text(extra).css('color', '#070')
      } else if (audioUrl && audioUrlIsNew) {
        $stat.text('recorded (unsaved)').css('color', '#a60')
      } else if (audioUrl) {
        $stat.text('saved on device').css('color', '#070')
      } else {
        $stat.text('(no audio)').css('color', '#666')
      }
    }
    syncAudioUI()

    $rec.on('click', async () => {
      // Native recording path: ask Dart to open Android's MediaRecorder
      // and write directly to <docs>/manual_audio/<id>.m4a. Bypasses the
      // WebView's getUserMedia entirely — that path races with
      // speech_to_text on Android and surfaces NotReadableError.
      if (nativeRecording) return
      // If there's an unsaved just-recorded file from an earlier attempt
      // this dialog, throw it away — we're about to overwrite it.
      if (audioUrl && audioUrlIsNew) {
        const stale = audioUrl
        audioUrl = null
        audioUrlIsNew = false
        deleteManualAudio(stale)   // fire-and-forget
      }
      const id = 'rec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      let result
      try { result = await _audioRpc('recordStart', { id }) }
      catch (e) {
        console.warn('[manualAudio] recordStart failed', e)
        const msg = (e && e.message) || String(e)
        // Dart surfaces 'permission-denied' separately so we can show the
        // settings hint.
        if (/permission/i.test(msg)) {
          alert('Microphone permission was denied. Enable it in Settings → Apps → Cupitor → Permissions.')
        } else {
          alert('Could not start audio recording.\n' + msg)
        }
        return
      }
      // Dart returns the file:// URL the recording is being written to.
      audioUrl = result
      audioUrlIsNew = true
      nativeRecording = true
      recStartMs = Date.now()
      syncAudioUI()
      recTimerId = setInterval(syncAudioUI, 1000)
    })
    $stop.on('click', async () => {
      if (!nativeRecording) return
      let result
      try { result = await _audioRpc('recordStop', {}) }
      catch (e) {
        console.warn('[manualAudio] recordStop failed', e)
        // Whatever happened, we're no longer recording — clear UI state.
        nativeRecording = false
        if (recTimerId) { clearInterval(recTimerId); recTimerId = null }
        // Drop any half-written file we can't trust.
        if (audioUrl && audioUrlIsNew) {
          deleteManualAudio(audioUrl)
          audioUrl = null; audioUrlIsNew = false
        }
        syncAudioUI('(recording failed)')
        return
      }
      nativeRecording = false
      if (recTimerId) { clearInterval(recTimerId); recTimerId = null }
      // Dart returns null if the recording was too short to keep (MediaRecorder
      // refuses to stop cleanly before any audio was captured); treat that as
      // a cancelled recording.
      if (!result) {
        if (audioUrl && audioUrlIsNew) {
          deleteManualAudio(audioUrl)
          audioUrl = null; audioUrlIsNew = false
        }
        syncAudioUI('(too short to keep — hold longer)')
        return
      }
      audioUrl = result
      audioUrlIsNew = true
      syncAudioUI()
    })
    $play.on('click', async () => {
      // Toggle: click while playing stops playback (so the user can quickly
      // re-record without waiting for the clip to finish).
      if (_isPlaying()) { _stopPlayback(); syncAudioUI(); return }
      let dataUrl
      try {
        dataUrl = audioUrl ? await loadManualAudioData(audioUrl) : null
      } catch (e) {
        console.warn('[manualAudio] load failed', e)
      }
      if (!dataUrl) { syncAudioUI('(could not load audio)'); return }
      const a = new Audio(dataUrl)
      playbackAudio = a
      a.addEventListener('ended', () => { if (playbackAudio === a) { playbackAudio = null; syncAudioUI() } })
      a.addEventListener('error', () => { if (playbackAudio === a) { playbackAudio = null; syncAudioUI('(playback failed)') } })
      try {
        await a.play()
        syncAudioUI()
      } catch (e) {
        console.warn('[manualAudio] play failed', e)
        if (playbackAudio === a) playbackAudio = null
        syncAudioUI('(playback failed)')
      }
    })
    $del.on('click', () => {
      if (!_hasAudio()) return
      if (!confirm('Delete this recording?')) return
      _stopPlayback()
      // If this is a newly-recorded native file (uncommitted), drop the
      // file from disk now — it has no parent entry to clean it up later.
      // For an existing-entry audio file, just clear the local reference;
      // finish() will delete the original on disk when the user saves.
      if (audioUrl && audioUrlIsNew) deleteManualAudio(audioUrl)
      audioUrl = null
      audioUrlIsNew = false
      syncAudioUI()
    })
  }

  const finish = async () => {
    const source       = $d.find('#meeSource').val()
    const target       = $d.find('#meeTarget').val()
    const typedMediaUrl = $d.find('#meeMedia').val()

    // Audio-and-media write order, when the audio UI is on:
    //  1. The recording (if any) is already on disk via the native
    //     MediaRecorder path — `audioUrl` is the file:// URL.
    //  2. If we have an audio URL it becomes the entry's mediaUrl,
    //     overriding whatever the user typed in the Media URL box.
    //     Recording is the more recent, explicit declaration of media.
    //  3. Otherwise the entry takes the typed Media URL.
    let finalMediaUrl = audioUrl ? audioUrl : typedMediaUrl
    // Original audio file we may need to delete (replaced or removed).
    const originalAudioUrl = _isAudioMediaUrl(existing && existing.mediaUrl) ? existing.mediaUrl : null

    let saved
    if (isEdit) {
      saved = updateManualEntry(playlistName, existing.id, { source, target, mediaUrl: finalMediaUrl })
    } else {
      const it = addManualEntry(playlistName, { source, target, mediaUrl: finalMediaUrl })
      saved = !!it
    }

    if (showAudio) {
      if (saved) {
        // Audio is now committed to the entry — disarm the cancel-cleanup.
        audioUrlIsNew = false
        // Clean up the replaced/removed original audio file.
        if (originalAudioUrl && originalAudioUrl !== finalMediaUrl) {
          await deleteManualAudio(originalAudioUrl)
        }
      } else if (audioUrl && audioUrlIsNew) {
        // Entry save failed — don't leak the just-written audio file.
        await deleteManualAudio(audioUrl)
        audioUrl = null; audioUrlIsNew = false
      }
    }
    return saved
  }

  function cleanup() {
    if (recTimerId) { clearInterval(recTimerId); recTimerId = null }
    // If the user closes the dialog mid-recording, tell Dart to throw
    // away the partial recording (stop the MediaRecorder, delete file).
    if (nativeRecording) {
      nativeRecording = false
      nativeRecordCancel()  // fire-and-forget
      // The file may have been written; mark for deletion below.
      audioUrlIsNew = true
    }
    // Delete any newly-recorded native file that was never committed via
    // Save — uncommitted recordings shouldn't survive dialog dismissal.
    if (audioUrl && audioUrlIsNew) {
      deleteManualAudio(audioUrl)   // fire-and-forget
      audioUrl = null; audioUrlIsNew = false
    }
    // Also stop any in-progress preview playback — otherwise the <Audio>
    // element keeps playing after the dialog closes.
    try {
      if (playbackAudio) {
        try { playbackAudio.pause() } catch (_) {}
        playbackAudio = null
      }
    } catch (_) {}
  }

  $d.dialog({
    title: isEdit ? 'Edit card' : 'Add manual card',
    width: Math.min(480, $(window).width() - 40),
    modal: true,
    autoOpen: true,
    close: cleanup,
    buttons: {
      // The Save button is async — `finish()` may need to round-trip through
      // the AudioBridge to write the recording before the entry is saved.
      [isEdit ? 'Save' : 'Add']: async function () {
        const $btn = $(this)
        const ok = await finish()
        if (ok) { try { $btn.dialog('close') } catch (_) {} openRecordingReviewDialog() }
      },
      'Cancel': function () { try { $(this).dialog('close') } catch (_) {} }
    }
  })
}
window._openManualEntryEditor = _openManualEntryEditor
// Exposed so the recording-review row and other UI can play/refresh audio
// without re-implementing the bridge plumbing.
window.saveManualAudioBlob = saveManualAudioBlob
window.loadManualAudioData = loadManualAudioData
window.deleteManualAudio   = deleteManualAudio

function openRecordingReviewDialog() {
  let $dlg = $('#recordingReviewDialog')
  if (!$dlg.length) {
    $dlg = $('<div id="recordingReviewDialog"></div>').appendTo('body')
  }
  const items = window._recording.items || {}
  const searchTexts = Object.keys(items).sort()
  const currentName = window._recording.currentName || REC_DEFAULT_NAME
  const isVirtualCurrent = _isVirtual(currentName)
  const allNames = listRecordings()
  // Last-played item (for highlighting). Only highlight when the displayed
  // playlist matches where the item came from.
  const _lp = _loadLastPlayed()
  const _lpHere = _lp && _lp.recName === currentName ? _lp : null
  let html = ''
  // ── Header: switch / create / new-virtual / rename / duplicate / delete ──
  html += `<div class="rec-rec-header" style="margin-bottom:10px;padding:6px 6px 8px;border-bottom:1px solid #ddd;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
    <label style="font-size:12px;color:#555;">Playlist:</label>
    <select id="recRecSelect" style="flex:1;min-width:140px;max-width:260px;">`
  allNames.forEach(n => {
    const count = _recordingItemCountByName(n)
    const marker = _isVirtual(n) ? '🔗 ' : ''
    html += `<option value="${_.escape(n)}"${n === currentName ? ' selected' : ''}>${marker}${_.escape(n)} (${count})</option>`
  })
  html += `</select>
    <button type="button" id="recRecNew"       class="btn rec-rec-btn" title="Create a new playlist" aria-label="Create a new playlist"><span class="rec-rec-ico">＋</span><span class="rec-rec-lbl">New</span></button>
    <button type="button" id="recRecNewVirtual" class="btn rec-rec-btn" title="Create a virtual playlist (combine existing playlists)" aria-label="Create a virtual playlist"><span class="rec-rec-ico">🔗</span><span class="rec-rec-lbl">Virtual</span></button>
    <button type="button" id="recRecRandom"     class="btn rec-rec-btn" title="Build a random-sample playlist from all real playlists" aria-label="Practice Random"><span class="rec-rec-ico">🎲</span><span class="rec-rec-lbl">Practice Random</span></button>
    <button type="button" id="recRecAddManual"  class="btn rec-rec-btn" title="Add a manual flashcard entry (source/target + optional media link)" aria-label="Add manual entry"${isVirtualCurrent ? ' disabled' : ''}><span class="rec-rec-ico">📝</span><span class="rec-rec-lbl">Add card</span></button>
    <button type="button" id="recRecRename"    class="btn rec-rec-btn" title="Rename this playlist" aria-label="Rename this playlist"><span class="rec-rec-ico">✎</span><span class="rec-rec-lbl">Rename</span></button>
    <button type="button" id="recRecDuplicate" class="btn rec-rec-btn" title="Duplicate this playlist" aria-label="Duplicate this playlist"><span class="rec-rec-ico">⎘</span><span class="rec-rec-lbl">Duplicate</span></button>
    <button type="button" id="recRecDelete"    class="btn rec-rec-btn rec-rec-danger" title="Delete this playlist" aria-label="Delete this playlist"><span class="rec-rec-ico">🗑</span><span class="rec-rec-lbl">Delete</span></button>
    <button type="button" id="recRecSync"      class="btn rec-rec-btn" title="Push local playlists to GitHub" aria-label="Sync to GitHub"><span class="rec-rec-ico">⤴</span><span class="rec-rec-lbl">Sync</span></button>
  </div>`
  // Virtual playlist banner: shows members + an "Edit members" affordance,
  // and signals that the item list below is read-only.
  if (isVirtualCurrent) {
    const members = _virtualMembers(currentName)
    html += `<div class="rec-virtual-banner">
      🔗 <b>Virtual playlist</b> — a live combination of:
      ${members.length ? members.map(m => `<span class="rec-virtual-member">${_.escape(m)}</span>`).join(' ') : '<span style="color:#a00;">(no valid members)</span>'}
      <button type="button" id="recVirtualEdit" class="btn rec-rec-btn" style="margin-left:8px;">Edit members</button>
      <div class="rec-virtual-note">Items are read-only here. Edit them in their source playlists.</div>
    </div>`
  }
  if (!searchTexts.length) {
    html += isVirtualCurrent
      ? '<p style="color:#888;">This virtual playlist resolves to no items — its members may be empty.</p>'
      : '<p style="color:#888;">No recorded items yet. Click ● Record, then the capture button next to a match.</p>'
  } else {
    searchTexts.forEach(st => {
      html += `<div class="rec-grp" style="margin-bottom:10px;padding:6px;border:1px solid #eee;border-radius:4px;">
        <div style="font-weight:bold;font-size:14px;">🔎 ${_.escape(st)}</div>`
      Object.keys(items[st]).sort().forEach(w => {
        const wEsc = _.escape(w)
        const stEsc = _.escape(st)
        html += `<div style="margin-left:10px;margin-top:4px;">
          <div style="color:#555;font-style:italic;font-size:13px;">${wEsc}</div>
          <div class="rec-item-list" data-st="${stEsc}" data-w="${wEsc}" style="margin-left:6px;">`
        items[st][w].forEach((it, idx) => {
          const checked = (it.enabled !== false) ? 'checked' : ''
          // "Copy to…" picker — lists every other REAL recording (can't copy
          // into a virtual one). Hidden when current playlist is virtual
          // (read-only) or there are no eligible targets.
          const otherNames = allNames.filter(n => n !== currentName && !_isVirtual(n))
          const copyOptions = (!isVirtualCurrent && otherNames.length)
            ? `<select class="rec-copy-to" data-st="${stEsc}" data-w="${wEsc}" data-idx="${idx}" title="Copy this item to another playlist">
                <option value="">Copy to…</option>
                ${otherNames.map(n => `<option value="${_.escape(n)}">${_.escape(n)}</option>`).join('')}
              </select>`
            : ''
          // Subtitle preview — try sync first (subs already in memory), else
          // mark pending and let _lazyLoadRecItemPreviews fill it in after
          // the dialog renders.
          const _initialPreview = _previewTextForRecItem(it)
          const _previewText = _initialPreview ? _truncatePreview(_initialPreview, 80) : '…'
          const _pendingAttr = _initialPreview ? '' : ' data-pending="1"'
          // On a virtual playlist the list is read-only: only ▶ Play-from is
          // offered; drag / toggle / duplicate / copy / delete are omitted.
          const editControls = isVirtualCurrent ? '' : `
              <span class="rec-drag" title="Drag to reorder">⋮⋮</span>
              <label class="rec-toggle" title="Include in Play All">
                <input type="checkbox" class="rec-enable" data-st="${stEsc}" data-w="${wEsc}" data-idx="${idx}" ${checked}>
                <span class="rec-toggle-track"><span class="rec-toggle-knob"></span></span>
              </label>`
          const dupBtn = isVirtualCurrent ? '' : `<button type="button" class="rec-dup" data-st="${stEsc}" data-w="${wEsc}" data-idx="${idx}" title="Duplicate this item">⎘</button>`
          const delBtn = isVirtualCurrent ? '' : `<button type="button" class="rec-del" data-st="${stEsc}" data-w="${wEsc}" data-idx="${idx}" title="Remove this item">✕</button>`
          const _isLast = _lpHere && _lpHere.st === st && _lpHere.w === w && _lpHere.idx === idx
          // Manual entries: render the source/target text on the main row
          // and the optional media link as a small badge instead of the
          // YT id · timestamps that captured items show.
          let _itemTextHtml
          if (_isManualItem(it)) {
            const src = _.escape(it.source || '')
            const tgt = _.escape(it.target || '')
            const _isAudio = it.mediaKind === 'audio' || _isAudioMediaUrl(it.mediaUrl)
            const mediaBadge = it.mediaUrl
              ? (_isAudio
                  // Play in place via AudioBridge — file:// can't be opened
                  // as a normal link. data-audio-url is read by a delegated
                  // click handler installed once on the review dialog.
                  ? ` <button type="button" class="rec-item-media rec-item-audio" data-audio-url="${_.escape(it.mediaUrl)}" title="Play recorded audio">🎙</button>`
                  : ` <a class="rec-item-media" href="${_.escape(it.mediaUrl)}" target="_blank" rel="noopener" title="Open media (${_.escape(it.mediaKind || 'link')})">${it.mediaKind === 'youtube' ? '▶︎' : '🔗'}</a>`)
              : ''
            _itemTextHtml = `<span class="rec-item-text rec-item-manual${it.enabled === false ? ' rec-item-off' : ''}">📝 ${src}${tgt ? ` → ${tgt}` : ''}</span>${mediaBadge}` +
                            `<button type="button" class="rec-manual-edit" data-st="${stEsc}" data-w="${wEsc}" data-idx="${idx}" title="Edit this card">✎</button>`
          } else {
            _itemTextHtml = `<span class="rec-item-text${it.enabled === false ? ' rec-item-off' : ''}">${_.escape(it.id)} · ${it.timeStart}s–${it.timeEnd}s</span>`
          }
          html += `<div class="rec-item${isVirtualCurrent ? ' rec-item-readonly' : ''}${_isLast ? ' rec-item-lastplayed' : ''}" data-idx="${idx}">
            <div class="rec-item-row1">
              ${editControls}
              <button type="button" class="rec-play-from" data-st="${stEsc}" data-w="${wEsc}" data-idx="${idx}" title="Play from this item">▶</button>
              ${dupBtn}
              ${_itemTextHtml}
              ${copyOptions}
              ${delBtn}
            </div>
            ${_isManualItem(it) ? '' : `<div class="rec-item-preview"${_pendingAttr} data-id="${_.escape(it.id)}" data-line="${_.escape(String(it.lineIndex == null ? '' : it.lineIndex))}" title="Source subtitle line">${_.escape(_previewText)}</div>`}
          </div>`
        })
        html += `</div></div>`
      })
      html += `</div>`
    })
  }
  $dlg.html(html)

  $dlg.off('click', '.rec-del').on('click', '.rec-del', function (e) {
    // Stop the click from bubbling to the document-level outside-click
    // handler, which would otherwise see a detached e.target (we replace
    // $dlg's HTML below) and close every visible dialog.
    e.preventDefault()
    e.stopPropagation()
    const st  = String($(this).data('st'))
    const w   = String($(this).data('w'))
    const idx = parseInt($(this).data('idx'), 10)
    removeRecordedItem(st, w, idx)
    openRecordingReviewDialog()  // refresh
  })

  $dlg.off('change', '.rec-enable').on('change', '.rec-enable', function (e) {
    e.stopPropagation()
    const st  = String($(this).data('st'))
    const w   = String($(this).data('w'))
    const idx = parseInt($(this).data('idx'), 10)
    const on  = $(this).is(':checked')
    _setRecordedItemEnabled(st, w, idx, on)
    // Visually dim the row without re-rendering, to keep scroll/focus.
    $(this).closest('.rec-item').find('.rec-item-text').toggleClass('rec-item-off', !on)
  })

  // Play from a specific item — builds the same queue and rotates so this
  // item is index 0. Honours the user's current shuffle/loop settings.
  $dlg.off('click', '.rec-play-from').on('click', '.rec-play-from', function (e) {
    e.preventDefault(); e.stopPropagation()
    const st  = String($(this).data('st'))
    const w   = String($(this).data('w'))
    const idx = parseInt($(this).data('idx'), 10)
    const recName = window._recording.currentName
    try { $dlg.dialog('close') } catch (_) {}
    playRecording({ startItem: { recName, st, w, idx } })
  })

  // Duplicate a single item — inserts a copy right after the original.
  $dlg.off('click', '.rec-dup').on('click', '.rec-dup', function (e) {
    e.preventDefault(); e.stopPropagation()
    const st  = String($(this).data('st'))
    const w   = String($(this).data('w'))
    const idx = parseInt($(this).data('idx'), 10)
    if (duplicateRecordedItem(st, w, idx)) openRecordingReviewDialog()
  })

  // Copy a single item to another playlist via the inline select.
  $dlg.off('change', '.rec-copy-to').on('change', '.rec-copy-to', function (e) {
    e.stopPropagation()
    const dest = String($(this).val() || '')
    if (!dest) return
    const st  = String($(this).data('st'))
    const w   = String($(this).data('w'))
    const idx = parseInt($(this).data('idx'), 10)
    const src = window._recording.currentName
    const ok = copyItemToPlaylist(src, st, w, idx, dest)
    // Reset the select either way so the same target can be reused.
    $(this).val('')
    if (!ok) { alert('Copy failed — destination playlist not found.'); return }
    // Refresh dialog so the destination's item count in the dropdown is current.
    openRecordingReviewDialog()
  })

  // ── Recordings-header CRUD handlers ──────────────────────────────────
  $dlg.off('change', '#recRecSelect').on('change', '#recRecSelect', function (e) {
    e.stopPropagation()
    const name = String($(this).val() || '')
    if (selectRecording(name)) openRecordingReviewDialog()
  })
  $dlg.off('click', '#recRecNew').on('click', '#recRecNew', function (e) {
    e.preventDefault(); e.stopPropagation()
    const name = prompt('Name for the new recording:')
    if (name && createRecording(name)) openRecordingReviewDialog()
  })
  $dlg.off('click', '#recRecNewVirtual').on('click', '#recRecNewVirtual', function (e) {
    e.preventDefault(); e.stopPropagation()
    _openVirtualPlaylistEditor(null)
  })
  // Practice Random: build a fresh "Random From All" playlist. Confirm
  // overwrite if one already exists so the user doesn't accidentally lose
  // a curated random session.
  $dlg.off('click', '#recRecRandom').on('click', '#recRecRandom', function (e) {
    e.preventDefault(); e.stopPropagation()
    const exists = !!(window._recordings && window._recordings[RANDOM_REC_NAME])
    if (exists) {
      const ok = confirm(`"${RANDOM_REC_NAME}" already exists. Replace it with a fresh random sample?`)
      if (!ok) return
    }
    if (createRandomFromAllPlaylist()) openRecordingReviewDialog()
  })
  $dlg.off('click', '#recRecAddManual').on('click', '#recRecAddManual', function (e) {
    e.preventDefault(); e.stopPropagation()
    _openManualEntryEditor(window._recording.currentName, null)
  })
  $dlg.off('click', '.rec-manual-edit').on('click', '.rec-manual-edit', function (e) {
    e.preventDefault(); e.stopPropagation()
    const st  = String($(this).data('st'))
    const w   = String($(this).data('w'))
    const idx = parseInt($(this).data('idx'), 10)
    const items = window._recording.items || {}
    const arr = (items[st] && items[st][w]) || []
    const it = arr[idx]
    if (!it || !_isManualItem(it)) return
    _openManualEntryEditor(window._recording.currentName, it)
  })
  // Inline playback for the 🎙 badge — file:// URLs can't be opened as
  // normal links so we round-trip through the AudioBridge. Uses the shared
  // preview singleton so the button toggles (🎙 ↔ ■), errors don't fail
  // silently, and starting another row's audio stops this one first.
  $dlg.off('click', '.rec-item-audio').on('click', '.rec-item-audio', function (e) {
    e.preventDefault(); e.stopPropagation()
    const url = $(this).attr('data-audio-url') || ''
    if (!url) return
    _startManualAudioPreview(url, $(this))
  })
  $dlg.off('click', '#recVirtualEdit').on('click', '#recVirtualEdit', function (e) {
    e.preventDefault(); e.stopPropagation()
    _openVirtualPlaylistEditor(window._recording.currentName)
  })
  $dlg.off('click', '#recRecRename').on('click', '#recRecRename', function (e) {
    e.preventDefault(); e.stopPropagation()
    const oldN = window._recording.currentName
    const newN = prompt('Rename recording:', oldN)
    if (newN && renameRecording(oldN, newN)) openRecordingReviewDialog()
  })
  $dlg.off('click', '#recRecDuplicate').on('click', '#recRecDuplicate', function (e) {
    e.preventDefault(); e.stopPropagation()
    const src = window._recording.currentName
    const newN = prompt('Name for the duplicate:', src + ' (copy)')
    if (newN && duplicateRecording(src, newN)) openRecordingReviewDialog()
  })
  $dlg.off('click', '#recRecDelete').on('click', '#recRecDelete', function (e) {
    e.preventDefault(); e.stopPropagation()
    if (deleteRecording(window._recording.currentName)) openRecordingReviewDialog()
  })
  $dlg.off('click', '#recRecSync').on('click', '#recRecSync', async function (e) {
    e.preventDefault(); e.stopPropagation()
    try {
      await syncRecordingsToGithub()
      // Re-render so the count in the selector reflects the merged remote.
      openRecordingReviewDialog()
    } catch (_) { /* already alerted */ }
  })
  // Reflect dirty state on the button as soon as the header is in the DOM.
  _refreshRecordingSyncBtn()

  // Drag-to-reorder within each word group. Falls back gracefully if jQuery
  // UI isn't loaded — the checkbox + delete actions still work. Skipped for
  // virtual playlists, whose item list is read-only.
  if ($.fn.sortable && !isVirtualCurrent) {
    $dlg.find('.rec-item-list').each(function () {
      const $list = $(this)
      try { $list.sortable('destroy') } catch (_) {}
      $list.sortable({
        items: '> .rec-item',
        handle: '.rec-drag',
        axis: 'y',
        tolerance: 'pointer',
        forcePlaceholderSize: true,
        placeholder: 'rec-item-placeholder',
        update: function () {
          const st = String($list.data('st'))
          const w  = String($list.data('w'))
          const order = $list.find('> .rec-item').map(function () {
            return parseInt($(this).data('idx'), 10)
          }).get()
          _reorderWordItems(st, w, order)
          // Refresh data-idx attrs so subsequent removes/edits hit the right
          // entries without a full re-render.
          $list.find('> .rec-item').each(function (i) {
            $(this).attr('data-idx', i).find('[data-idx]').attr('data-idx', i)
          })
        }
      })
    })
  }

  const opts = {
    title: 'Recorded Searches',
    width: Math.min(720, $(window).width() - 40),
    height: Math.min(560, $(window).height() - 60),
    modal: false,
    autoOpen: true,
    buttons: {
      // Belt-and-suspenders close: jQuery UI's dialog('close') sometimes
      // races with focus / async render work and leaves the wrapper visible
      // behind the next view. Force-hide the wrapper as a backup so the
      // user doesn't see the Recorded Searches panel floating over the
      // Practice card or the playing recording.
      //
      // Both action buttons prompt to resume-or-restart when there's a
      // recoverable last-played item on THIS playlist (see
      // _maybeResumeStartItem). Cancel in the confirm = start fresh.
      'Play All':  function () {
        const $w = $(this).closest('.ui-dialog')
        try { $(this).dialog('close') } catch (_) {}
        $w.hide()
        try { autoHideSettingsPanel() } catch (_) {}
        const resumeQueue = _maybeResumeStartItem('play')
        playRecording(resumeQueue ? { resumeQueue } : undefined)
      },
      'Practice':  function () {
        const $w = $(this).closest('.ui-dialog')
        try { $(this).dialog('close') } catch (_) {}
        $w.hide()
        try { autoHideSettingsPanel() } catch (_) {}
        const resumeQueue = _maybeResumeStartItem('practice')
        openPracticeMode(resumeQueue ? { resumeQueue } : undefined)
      },
      'Close':     function () {
        const $w = $(this).closest('.ui-dialog')
        try { $(this).dialog('close') } catch (_) {}
        $w.hide()
      }
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', opts).dialog('open')
  } else {
    $dlg.dialog(opts)
  }
  // After the dialog renders, fetch any missing subtitles in the background
  // and populate the per-row preview spans. Fire-and-forget — if it fails
  // the row just shows "(no preview available)".
  _lazyLoadRecItemPreviews($dlg).catch(e => console.warn('preview lazy-load failed', e))
}

// Wait until YouTube's currentTime crosses `timeEnd`, then pause it. Bails
// out early if:
//   • the user stopped playback,
//   • the playhead never started moving within the load-grace window
//     (video failed to load — typical when the video is private/removed
//     or the embed errors silently),
//   • the playhead stopped advancing for `stallMs` after it had been
//     advancing (paused mid-clip due to network / 403 / ads bailout),
//   • or a generous overall cap of (clip-dur + 15s) elapses.
// Optional `onTick` is invoked every ~500ms so the caller can refresh UI.
// `expectedVideoId` (optional) gates ct-reads on the player actually having
// the right video loaded — without it, a slow-loading transition can let the
// previous clip's playhead satisfy this clip's end-check.
// Threshold (seconds) above which a clip's recorded [timeStart, timeEnd]
// is considered malformed — typically the result of a context window
// straddling a temporal discontinuity in a sparse SRT. Anything longer
// is either skipped (in _waitYTUntilEnd) or repaired to a ~20s window
// around the matched line (in playRecording via _repairMalformedClip).
const MAX_REASONABLE_CLIP_S = 600

function _waitYTUntilEnd(timeStart, timeEnd, onTick, expectedVideoId) {
  let _effectiveTimeEnd = parseFloat(timeEnd) || 0
  const _timeStartNum   = parseFloat(timeStart) || 0
  // Malformed-clip safety net. playRecording tries to repair these into a
  // 20s window first (see _repairMalformedClip); we only reach this skip
  // when the repair couldn't find a matched-line anchor in the SRT.
  if ((_effectiveTimeEnd - _timeStartNum) > MAX_REASONABLE_CLIP_S) {
    console.warn(
      `[_waitYTUntilEnd] skipping malformed clip: dur=${(_effectiveTimeEnd - _timeStartNum).toFixed(0)}s > ${MAX_REASONABLE_CLIP_S}s ` +
      `(start=${_timeStartNum} end=${_effectiveTimeEnd}). Likely a bad capture — manually fix the recorded times or re-capture.`
    )
    try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
    return Promise.resolve()
  }
  const dur          = Math.max(2, _effectiveTimeEnd - _timeStartNum)
  const maxWaitMs    = (dur + 15) * 1000     // clip length + buffer
  const loadGraceMs  = 12000                  // time we give the player to actually start
  const stallMs      = 6000                   // post-start, how long a frozen playhead means dead
  // Pause fast & insistently — YT pauseVideo is best-effort and a single
  // call sometimes loses to a buffering / state transition. Two paired
  // calls (immediate + a 50ms follow-up) virtually always sticks.
  const hardPause = () => {
    try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
    setTimeout(() => {
      try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
    }, 50)
  }
  return new Promise(resolve => {
    const begin = Date.now()
    let lastCt = -1
    let lastChangeAt = begin
    let everPlayed = false
    let observedBelowEnd = false  // seen ct STRICTLY below timeEnd while videoId matches — proves playhead entered the clip
    let pausedAccum = 0          // ms accumulated while user-paused
    let bufferingAccum = 0       // ms accumulated while YT player reported BUFFERING (state 3)
    let lastTickAt = begin
    const tick = () => {
      if (!window._playingRecording) return resolve()
      // Bail immediately on a prev/next/goto request so the navigation
      // feels responsive — the outer loop in playRecording reads the
      // flag and routes to the right index.
      if (window._recNavRequest || Number.isInteger(window._recNavGotoIndex)) {
        hardPause()
        return resolve()
      }
      const now = Date.now()
      // While the user has paused, don't accrue stall/load/max time. Just
      // bookkeep how long we've been paused so we can subtract it below.
      if (window._recPlayPaused) {
        pausedAccum += (now - lastTickAt)
        lastTickAt = now
        return setTimeout(tick, 300)
      }
      // Same accounting for any non-playing state — YT often sits in
      // BUFFERING (3), UNSTARTED (-1) or CUED (5) for many seconds on a
      // slow connection while it fetches segments. Without this the
      // stall detector would skip the clip the moment playback pauses
      // to refill the buffer. PLAYING (1) is the only state in which
      // the playhead is supposed to be advancing.
      let playerState = 1
      try { if (window.ytPlayer && window.ytPlayer.getPlayerState) playerState = window.ytPlayer.getPlayerState() } catch (_) {}
      const NON_PLAYING = (playerState === -1 || playerState === 3 || playerState === 5)
      if (NON_PLAYING) {
        bufferingAccum += (now - lastTickAt)
        lastChangeAt = now    // don't let buffering count against the stall window either
      }
      lastTickAt = now
      try {
        if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
          // Stale-ct guard. Until the player reports the expected videoId
          // AND ct has been seen strictly below timeEnd inside this clip,
          // refuse to trust ct for end/progress. Without this, a slow load
          // leaves getCurrentTime() returning the PREVIOUS clip's playhead,
          // which can fall inside the new window (e.g. prev ended at 55,
          // new clip is 45→55 — stale ct=55 satisfies ct≥timeEnd on the
          // first tick and fires a bogus natural-end. The progress bar
          // animates to 100% via its CSS width-transition and the clip
          // never plays.) The load-grace timer below still skips for-real
          // unplayable clips.
          const loadedId = (window.ytPlayer.getVideoData && window.ytPlayer.getVideoData().video_id) || null
          const idOk = !expectedVideoId || !loadedId || loadedId === expectedVideoId
          const ct = window.ytPlayer.getCurrentTime() || 0
          // Once the video has loaded and reports a duration, clamp the
          // effective end to it. Otherwise a clip whose recorded timeEnd
          // overshoots the video's natural end (e.g. SRT timestamps
          // extending past EOF) would wait forever for ct≥timeEnd.
          if (idOk && loadedId === expectedVideoId) {
            try {
              const vDur = window.ytPlayer.getDuration && window.ytPlayer.getDuration()
              if (vDur && Number.isFinite(vDur) && vDur > 0 && _effectiveTimeEnd > vDur + 1) {
                console.warn(`[_waitYTUntilEnd] clamping timeEnd ${_effectiveTimeEnd}s → video duration ${vDur}s for ${expectedVideoId}`)
                _effectiveTimeEnd = vDur
              }
            } catch (_) {}
          }
          if (idOk && ct >= 0 && ct < _effectiveTimeEnd - 0.05 && ct <= _effectiveTimeEnd + 5) {
            observedBelowEnd = true
          }
          if (idOk && observedBelowEnd && ct >= _effectiveTimeEnd && ct <= _effectiveTimeEnd + 5) {
            // Snap the playhead to timeEnd so a slow pause doesn't bleed an
            // extra few frames of audio after the clip's nominal end.
            try { window.ytPlayer.seekTo && window.ytPlayer.seekTo(_effectiveTimeEnd, true) } catch (_) {}
            hardPause()
            return resolve()
          }
          // Also gate the everPlayed tracker — a stale reading wildly past
          // the clip's end shouldn't satisfy the load-grace check, otherwise
          // a permanently-stuck stale ct would never get skipped.
          if (idOk && observedBelowEnd && ct > 0.1 && Math.abs(ct - lastCt) > 0.05) {
            lastCt = ct
            lastChangeAt = now
            everPlayed = true
          }
        }
      } catch (_) {}
      if (typeof onTick === 'function') { try { onTick() } catch (_) {} }
      // Active elapsed excludes user-pause AND buffering — used by the
      // load-grace check so a slow CDN can finish prebuffering without
      // tripping the "video failed to start" skip.
      const activeElapsed = (now - begin) - pausedAccum - bufferingAccum
      // Raw elapsed only excludes user-pause — used by maxWaitMs as a
      // true hard ceiling so a dead-stuck buffering state can't keep us
      // here forever.
      const rawElapsed = (now - begin) - pausedAccum
      // hardPause() on every bail — without it a video that finally starts
      // AFTER we've decided to skip (e.g. load-grace expired but the player
      // resolves a few seconds later) keeps playing audio through the gap
      // period until the next item's playMediaSlice() resets it.
      if (!everPlayed && activeElapsed > loadGraceMs) {
        console.warn('playRecording: video failed to start within', loadGraceMs, 'ms — skipping')
        hardPause()
        return resolve()
      }
      if (everPlayed && (now - lastChangeAt) > stallMs) {
        console.warn('playRecording: playhead stalled — skipping')
        hardPause()
        return resolve()
      }
      // maxWait uses raw elapsed PLUS a buffering ceiling — even an
      // ever-buffering clip eventually gives up.
      if (rawElapsed > maxWaitMs + 30000) {
        console.warn('playRecording: max wait exceeded — skipping')
        hardPause()
        return resolve()
      }
      // 100ms keeps the playhead-overrun ≤ 100ms in the steady state, which
      // is well below the perceptual threshold for "video kept playing past
      // the end". Cost is ~10 ticks/sec vs ~2/sec — negligible.
      setTimeout(tick, 100)
    }
    tick()
  })
}

// Speak `text` aloud, resolving when playback ends. Tries Google's
// translate_tts endpoint first (sounds much better than the OS voices),
// and falls back to the browser's SpeechSynthesis on failure. The current
// audio/utterance is exposed on window._recTTS so the pause button can
// pause/resume it alongside the YouTube player.
// Replace vocab-formatting glyphs that the TTS engines mangle (".*" placeholder,
// "[. ]^" annotation, "<...>" tags). Pipe forms get spoken as "x, y, z".
function _sanitizeWordForTTS(text) {
  if (text == null) return ''
  let s = String(text)
  s = s.replace(/<[^>]*>/g, '')           // strip <annotation> markers
  s = s.replace(/\[\^[^\]]*\][*+?]?/g, ' nåt ') // negated char-class "[^]*", "[^ ]*", "[^a]+" → "nåt"
  s = s.replace(/\.[*+]/g, ' nåt ')        // ".*" / ".+" → "nåt"
  s = s.replace(/\s*\|\s*/g, ', ')         // pipe → comma, so forms get pauses
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function _speakWord(text) {
  const clean = _sanitizeWordForTTS(text)
  if (!clean) return Promise.resolve()
  return _speakWordGoogle(clean).catch(() => _speakWordBrowser(clean))
}

function _ttsLangCode() {
  const code = (typeof getLangFromUrl === 'function' && getLangFromUrl().code) || 'sv'
  return code === 'sv' ? 'sv' : code === 'es' ? 'es' : 'en'
}

function _speakWordGoogle(text) {
  return new Promise((resolve, reject) => {
    try {
      const q = String(text).trim()
      if (!q) return resolve()
      // Google Translate's TTS endpoint. Works as an <audio> source from a
      // regular browser tab (CORS doesn't apply to media playback). Has a
      // ~200 char limit per call which is well within the single-word use.
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${_ttsLangCode()}&client=tw-ob&q=${encodeURIComponent(q)}`
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'  // best-effort; ignored if server doesn't send CORS
      audio.src = url
      audio.volume = 1.0
      let settled = false
      const done = (err) => {
        if (settled) return; settled = true
        audio.onended = null; audio.onerror = null
        if (window._recTTS && window._recTTS.audio === audio) window._recTTS = null
        err ? reject(err) : resolve()
      }
      audio.onended = () => done()
      audio.onerror = () => done(new Error('Google TTS audio error'))
      window._recTTS = { kind: 'audio', audio }
      const p = audio.play()
      if (p && typeof p.then === 'function') p.catch(err => done(err))
      // Bail out if the request hangs (no audio progress within 8s).
      setTimeout(() => { if (!settled && (audio.paused || !audio.duration)) done(new Error('Google TTS timeout')) }, 8000)
    } catch (e) { reject(e) }
  })
}

function _speakWordBrowser(text) {
  return new Promise(resolve => {
    if (typeof window.speechSynthesis === 'undefined' ||
        typeof window.SpeechSynthesisUtterance === 'undefined') return resolve()
    try {
      const u = new SpeechSynthesisUtterance(String(text).trim())
      const code = _ttsLangCode()
      u.lang = code === 'sv' ? 'sv-SE' : code === 'es' ? 'es-ES' : 'en-US'
      u.rate = 0.9
      u.volume = 1.0
      let settled = false
      const done = () => {
        if (settled) return; settled = true
        if (window._recTTS && window._recTTS.utterance === u) window._recTTS = null
        resolve()
      }
      u.onend = done
      u.onerror = done
      window.speechSynthesis.cancel()
      window._recTTS = { kind: 'speech', utterance: u }
      window.speechSynthesis.speak(u)
      // Some engines never fire onend if the utterance is short or interrupted.
      setTimeout(done, 6000)
    } catch (_) { resolve() }
  })
}

// Render / refresh the play-mode info banner with the current item's
// context. Since search results aren't deterministic (remote data, ranking,
// vocab state can shift), we don't try to locate the match in the live
// #result DOM — we draw a self-contained banner from the recorded fields.
function _renderPlayingBanner(it, idx, total) {
  let $b = $('#recPlayingBanner')
  if (!$b.length) {
    // Top row is the compact mobile view: count, progress, gap stepper, info
    // toggle. Head + meta live below and are hidden on narrow viewports
    // until the user taps the ℹ button. Desktop CSS keeps everything visible.
    $b = $(`<div id="recPlayingBanner">
      <div class="rec-pb-top">
        <div class="rec-pb-progress">
          <span class="rec-pb-bar"></span>
          <span class="rec-pb-count"></span>
        </div>
        <span class="rec-pb-gap" title="Inter-item gap (seconds) — click ± or tap the value to type">
          <button type="button" class="rec-pb-gap-dec" aria-label="Decrease gap">−</button>
          <span class="rec-pb-gap-val" tabindex="0" role="button" title="Tap to set gap">30s</span>
          <button type="button" class="rec-pb-gap-inc" aria-label="Increase gap">+</button>
        </span>
        <button type="button" class="rec-pb-info-btn" title="Show details" aria-label="Show details" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
          </svg>
        </button>
      </div>
      <div class="rec-pb-details">
        <div class="rec-pb-head"></div>
        <div class="rec-pb-meta"></div>
      </div>
    </div>`).appendTo('body')
    $b.on('click', '.rec-pb-info-btn', function () {
      const open = !$b.hasClass('rec-pb-expanded')
      $b.toggleClass('rec-pb-expanded', open)
      $(this).attr('aria-expanded', open ? 'true' : 'false')
    })
    const GAP_STEP = 5
    const GAP_MIN  = 0
    const GAP_MAX  = 600
    const _setGap = (v) => {
      const next = Math.max(GAP_MIN, Math.min(GAP_MAX, parseInt(v, 10) || 0))
      window._appSettings.recPlayGapSeconds = next
      // Keep the Settings input in sync if it's mounted.
      try { $('#recPlayGapSeconds').val(next) } catch (_) {}
      saveAppSettings()
      $b.find('.rec-pb-gap-val').text(next + 's')
    }
    $b.on('click', '.rec-pb-gap-dec', (e) => {
      e.preventDefault(); e.stopPropagation()
      const cur = parseInt(window._appSettings.recPlayGapSeconds, 10) || 0
      _setGap(cur - GAP_STEP)
    })
    $b.on('click', '.rec-pb-gap-inc', (e) => {
      e.preventDefault(); e.stopPropagation()
      const cur = parseInt(window._appSettings.recPlayGapSeconds, 10) || 0
      _setGap(cur + GAP_STEP)
    })
    $b.on('click', '.rec-pb-gap-val', (e) => {
      e.preventDefault(); e.stopPropagation()
      const cur = parseInt(window._appSettings.recPlayGapSeconds, 10) || 0
      const raw = prompt('Gap between items (seconds, 0–600):', String(cur))
      if (raw == null) return
      _setGap(raw)
    })
  }
  $b.find('.rec-pb-count').text(`${idx + 1}/${total}`)
  if (_isManualItem(it)) {
    // Manual card — show the typed source/target plus an optional media
    // hint. There's no clip metadata to put on the meta line.
    const linkLbl = it.mediaUrl ? ` · ${it.mediaKind === 'youtube' ? '▶ YouTube' : '🔗 link'}` : ''
    $b.find('.rec-pb-head').text(`📝 ${it.source || '(empty)'}`)
    $b.find('.rec-pb-meta').text(`${it.target || '(empty)'}${linkLbl}`)
  } else {
    $b.find('.rec-pb-head').text(`▶ "${it.searchText}" → ${it.word}`)
    $b.find('.rec-pb-meta').text(`${it.id} · ${it.source || '?'} · ${it.timeStart}s – ${it.timeEnd}s`)
  }
  $b.find('.rec-pb-bar').css('width', '0%')
  // Reflect the current gap setting every time we render the banner — covers
  // changes made via the Settings panel between items.
  const _gap = parseInt(window._appSettings && window._appSettings.recPlayGapSeconds, 10)
  $b.find('.rec-pb-gap-val').text((Number.isFinite(_gap) ? _gap : 30) + 's')

  // Big prominent word display so the user always sees what word the
  // current item belongs to. Lazily created; reused across iterations.
  let $w = $('#recPlayingWord')
  if (!$w.length) $w = $('<div id="recPlayingWord"></div>').appendTo('body')
  $w.text(it.word || '')
}

// Drain the progress bar from full → empty over `ms`, visually signalling
// the remaining inter-item gap time. The bar gets a `.gap` class so it
// shows in a warm color (vs the green clip-progress fill) and the count
// element switches to a "next-up" hint while the gap is running.
let _gapCountdownTimerId = null
function _startGapCountdown(ms) {
  _stopGapCountdown()
  const $banner = $('#recPlayingBanner')
  if (!$banner.length) return
  const $bar   = $banner.find('.rec-pb-bar').addClass('gap')
  const $count = $banner.find('.rec-pb-count')
  // Cache the original count text so we can put it back when the gap ends.
  if ($count.length) $count.data('preGapText', $count.text())
  const begin = Date.now()
  let lastTick = begin
  let remaining = ms
  $bar.css('width', '100%')
  const queue = window._recPlayQueue || []
  const i = (window._recPlayIndex == null) ? 0 : window._recPlayIndex
  const nextIdx = (i + 1 < queue.length) ? (i + 1) : 0
  _gapCountdownTimerId = setInterval(() => {
    if (!window._playingRecording) { _stopGapCountdown(); return }
    if (window._recNavRequest || Number.isInteger(window._recNavGotoIndex)) { _stopGapCountdown(); return }
    const now = Date.now()
    const elapsed = now - lastTick
    lastTick = now
    if (!window._recPlayPaused) remaining -= elapsed
    const pct = Math.max(0, Math.min(100, (remaining / ms) * 100))
    $bar.css('width', pct + '%')
    const secsLeft = Math.max(0, Math.ceil(remaining / 1000))
    if ($count.length) $count.text(`next in ${secsLeft}s · ${nextIdx + 1}/${queue.length}`)
    if (remaining <= 0) _stopGapCountdown()
  }, 200)
}
function _stopGapCountdown() {
  if (_gapCountdownTimerId) { clearInterval(_gapCountdownTimerId); _gapCountdownTimerId = null }
  const $banner = $('#recPlayingBanner')
  if (!$banner.length) return
  $banner.find('.rec-pb-bar').removeClass('gap')
  const $count = $banner.find('.rec-pb-count')
  if ($count.length) {
    const pre = $count.data('preGapText')
    if (pre != null) $count.text(pre)
  }
}

function _updatePlayingProgress(timeStart, timeEnd, expectedVideoId) {
  const dur = Math.max(1, timeEnd - timeStart)
  let ct = timeStart
  try { ct = (window.ytPlayer && window.ytPlayer.getCurrentTime && window.ytPlayer.getCurrentTime()) || timeStart } catch (_) {}
  // Stale-ct guard. Until the right video is loaded AND ct lands strictly
  // inside [timeStart, timeEnd], hold the bar at 0%. Otherwise a stale ct
  // from the previous clip that coincidentally falls in this clip's window
  // (e.g. prev ended at 55, new clip is 45→55) animates the bar smoothly
  // to 100% via the CSS width-transition before the clip ever plays.
  let loadedId = null
  try { loadedId = window.ytPlayer && window.ytPlayer.getVideoData && window.ytPlayer.getVideoData().video_id } catch (_) {}
  const idOk = !expectedVideoId || !loadedId || loadedId === expectedVideoId
  if (!idOk || ct < timeStart || ct > timeEnd) ct = timeStart
  const pct = Math.max(0, Math.min(100, ((ct - timeStart) / dur) * 100))
  $('#recPlayingBanner .rec-pb-bar').css('width', pct.toFixed(1) + '%')
}

// If a recorded clip's [timeStart, timeEnd] looks malformed (duration
// > MAX_REASONABLE_CLIP_S), try to recover a sane ~20s window by
// looking up the matched line in the SRT and anchoring the play
// window around its real timestamps. Returns { timeStart, timeEnd }
// on success, null if recovery isn't possible (no lineIndex, no SRT,
// matched line missing, or unparseable timestamps).
//
// The malformation typically happens when an older capture's context
// window straddled a temporal discontinuity in a sparse SRT (e.g.
// line 5 at 00:38:17 followed by line 6 at 04:20:52 → recorded
// timeStart from segment A and timeEnd from segment B, a 3.7h "clip"
// that's actually two disjoint regions). renderLines now prevents
// future captures from doing this, but existing recordings still
// carry the bad bounds — this helper lets us play them as a short
// clip around the matched line instead of skipping them outright.
async function _repairMalformedClip(item) {
  if (!item || item.lineIndex == null) return null
  try {
    const parsed = await _loadSubtitlesForItem(item)
    if (!parsed) return null
    const lang = (typeof getSelectedLang === 'function') ? getSelectedLang() : 'sv'
    const primary = lang === 'sv' ? parsed.sv : parsed.en
    if (!primary || !primary.length) return null
    const want = String(item.lineIndex)
    const line = primary.find(l => l && l.index != null && String(l.index) === want)
    if (!line || !line.start || !line.end) return null
    const lineStart = Number(line.start.ordinal)
    const lineEnd   = Number(line.end.ordinal)
    if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) return null
    // 5s of pre-roll, then enough post-roll to cover the matched line plus
    // ~15s of trailing context — gives the user time to recognise the
    // word in context without making the clip drag on.
    const newStart = Math.max(0, lineStart - 5)
    const newEnd   = Math.max(lineEnd + 5, newStart + 20)
    return { timeStart: newStart, timeEnd: newEnd }
  } catch (e) {
    console.warn('[_repairMalformedClip] failed', item, e)
    return null
  }
}

// Resolve sv+en parsed subtitle entries for the recorded videoId, reusing
// whatever's already in memory. Three tiers, cheapest first:
//   1. window.searchResult — last search already parsed `sv_subs.data` /
//      `en_subs.data` via getSubs(); use it as-is.
//   2. window.allSubtitles[id] — raw text already fetched; reuse cached
//      _parsedSv / _parsedEn or parse once and stash there.
//   3. fall back to getSubtitlesForLink (network) and parse.
async function _loadSubtitlesForItem(item) {
  if (!window.allSubtitles) window.allSubtitles = {}

  // (1) Last search's parsed entries.
  const sr = window.searchResult || []
  const hit = sr.find(it => it && it.url === item.id)
  if (hit && ((hit.sv_subs && hit.sv_subs.data && hit.sv_subs.data.length) ||
              (hit.en_subs && hit.en_subs.data && hit.en_subs.data.length))) {
    return {
      sv: (hit.sv_subs && hit.sv_subs.data) || [],
      en: (hit.en_subs && hit.en_subs.data) || []
    }
  }

  // (2) In-memory raw text, with on-demand parse (cached on the entry).
  let stored = window.allSubtitles[item.id]
  if (!stored || (!stored.sv && !stored.en)) {
    try { await getSubtitlesForLink(item.id, item.source) } catch (e) {
      console.warn('playRecording: getSubtitlesForLink failed for', item.id, e)
    }
    stored = window.allSubtitles[item.id]
  }
  if (!stored || (!stored.sv && !stored.en)) return null
  if (stored.sv && !stored._parsedSv) stored._parsedSv = srtToJson(stored.sv)
  if (stored.en && !stored._parsedEn) stored._parsedEn = srtToJson(stored.en)
  return { sv: stored._parsedSv || [], en: stored._parsedEn || [] }
}

// Find the line whose [start, end) brackets t; fall back to first line at-or-after t.
// Used for the live playhead refresh, where t is a precise float.
function _findLineByTime(lines, t) {
  if (!lines || !lines.length) return -1
  let i = lines.findIndex(l => l && l.start && l.end && l.start.ordinal <= t && l.end.ordinal > t)
  if (i < 0) i = lines.findIndex(l => l && l.start && l.start.ordinal >= t)
  return i
}

// Build the subtitle context overlay for the playing item — matched line
// plus configured before/after context, with the secondary-language pairing
// matched by SRT index. Returns metadata used by _refreshPlayingSubtitles
// to keep the highlighted row in sync with the playhead.
async function _renderPlayingSubtitles(item) {
  let $sub = $('#recPlayingSubs')
  if (!$sub.length) {
    $sub = $('<div id="recPlayingSubs"></div>').appendTo('body')
  }
  $sub.html('<div class="rec-ps-loading">Loading subtitles…</div>')

  const parsed = await _loadSubtitlesForItem(item)
  if (!parsed || (!parsed.sv.length && !parsed.en.length)) {
    $sub.html('<div class="rec-ps-err">Subtitles unavailable for this video.</div>')
    return null
  }

  const lang = (typeof getSelectedLang === 'function') ? getSelectedLang() : 'sv'
  const primary   = lang === 'sv' ? parsed.sv : parsed.en
  const secondary = lang === 'sv' ? parsed.en : parsed.sv
  if (!primary.length) {
    $sub.html('<div class="rec-ps-err">Primary subtitle missing.</div>')
    return null
  }

  // Locate the recorded match by its SRT line index — the recorder always
  // stamps this on capture, so we get exact centering with no time-math
  // off-by-one. _refreshPlayingSubtitles still handles the live playhead.
  const want = String(item.lineIndex)
  const matchIdx = primary.findIndex(l => l && l.index != null && String(l.index) === want)
  if (matchIdx < 0) {
    $sub.html('<div class="rec-ps-err">Matched line not found in subtitle file.</div>')
    return null
  }
  const before = parseInt(window._appSettings && window._appSettings.contextLinesBefore, 10) || 0
  const after  = parseInt(window._appSettings && window._appSettings.contextLinesAfter,  10) || 0
  const from = Math.max(0, matchIdx - before)
  const to   = Math.min(primary.length - 1, matchIdx + after)

  const secById = new Map()
  if (secondary) secondary.forEach(s => { if (s && s.index != null) secById.set(s.index + '', s) })

  // Pre-collect main texts so the highlighter can decide once whether to
  // allow per-token fallback: if the whole phrase is already present on at
  // least one row, the fallback would otherwise light up standalone parts
  // on neighbouring rows. Tokens only kick in when the phrase is truly
  // split across rows (= absent from every single row).
  const mainTexts = []
  for (let i = from; i <= to; i++) {
    const line = primary[i]
    mainTexts.push((line && (line.text || line[lang] || '')) || '')
  }
  const allowTokens = !!(item && item.word) && !_phraseFoundInTexts(mainTexts, item.word)

  const $list = $('<div class="rec-ps-list"></div>')
  for (let i = from; i <= to; i++) {
    const line = primary[i]
    const sec = line && line.index != null ? secById.get(line.index + '') : null
    const mainText = mainTexts[i - from]
    const secText  = sec  && (sec.text  || sec[lang === 'sv' ? 'en' : 'sv'] || '') || ''
    const $row = $('<div class="rec-ps-row" data-line-i="' + i + '"></div>')
    if (i === matchIdx) $row.addClass('rec-ps-active')
    if (item && item.word) {
      $row.append($('<div class="rec-ps-main"></div>').html(_highlightWordHtml(mainText, item.word, { allowTokens })))
    } else {
      $row.append($('<div class="rec-ps-main"></div>').text(String(mainText).trim()))
    }
    if (secText.trim()) $row.append($('<div class="rec-ps-sec"></div>').text(secText.trim()))
    $list.append($row)
  }
  $sub.html($list)
  // Defer one tick so the panel has its final layout before we measure.
  setTimeout(_scrollActiveSubIntoView, 0)
  return { primary, from, to }
}

// Build HTML for a subtitle line where every occurrence of `word` is wrapped
// in <mark class="hl-word"> for the bold+yellow highlight. Falls back to the
// plain text if `word` is empty or doesn't match — callers should still set
// the element via .html() so the wrapped markup renders. Unicode-aware word
// boundaries keep "design" from matching inside "designing".
// Build a Unicode-bounded regex from `pattern` (already a regex source,
// caller is responsible for escaping). Falls back to unbounded for old
// engines without lookbehind / \p. Shared by _highlightWordHtml and the
// pre-scan in _phraseFoundInTexts.
function _buildBoundedWordRe(pattern, flags = 'giu') {
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, flags)
  } catch (_) {
    return new RegExp(`(${pattern})`, flags.replace('u', ''))
  }
}

// True if `word` (treated as a literal phrase) appears in any of `texts`.
// Used by the multi-row highlight callers (Player + Practice) to decide
// whether to allow per-token fallback: when the WHOLE phrase is present
// on at least one rendered row, suppress fallback everywhere — otherwise
// a composite word like "x y z" would also light up its standalone parts
// on neighbouring rows.
function _phraseFoundInTexts(texts, word) {
  const w = String(word == null ? '' : word).trim()
  if (!w || !Array.isArray(texts) || !texts.length) return false
  const reEsc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = _buildBoundedWordRe(reEsc)
  for (const t of texts) {
    if (!t) continue
    re.lastIndex = 0
    if (re.test(String(t))) return true
  }
  return false
}

// opts.allowTokens (default true): when false, the per-token fallback is
// suppressed and only the whole-phrase match is highlighted. Callers that
// pre-scan a corpus (Player / Practice) pass `false` whenever the whole
// phrase was found on at least one row, so the standalone parts on other
// rows don't also light up.
function _highlightWordHtml(text, word, opts) {
  const t = (text == null ? '' : String(text)).trim()
  const w = (word == null ? '' : String(word)).trim()
  const allowTokens = !opts || opts.allowTokens !== false
  // Escape the input for use as an HTML text node — we'll splice markup in
  // around the match positions after, so we're never injecting user text.
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  if (!w) return esc(t)
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const buildRe = (pattern) => _buildBoundedWordRe(pattern)
  // Splice <mark> around every match position from a precomputed list of
  // {start, end} spans (assumed non-overlapping, ordered).
  const splice = (spans) => {
    if (!spans.length) return esc(t)
    let out = ''
    let lastIdx = 0
    for (const sp of spans) {
      out += esc(t.slice(lastIdx, sp.start))
      out += `<mark class="hl-word">${esc(t.slice(sp.start, sp.end))}</mark>`
      lastIdx = sp.end
    }
    out += esc(t.slice(lastIdx))
    return out
  }
  const collectSpans = (re) => {
    const spans = []
    let m
    re.lastIndex = 0
    while ((m = re.exec(t)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length })
      if (m.index === re.lastIndex) re.lastIndex++
    }
    return spans
  }
  // First try the whole phrase as a single match — preserves "i förväg"
  // highlight when both words sit on the same line.
  const fullSpans = collectSpans(buildRe(reEsc(w)))
  if (fullSpans.length) return splice(fullSpans)
  // Token fallback covers the case where the SRT split a phrase across
  // rows (".. man ser i" on row N, "förväg .." on row N+1). Callers that
  // already saw the whole phrase on some OTHER row pass allowTokens=false
  // to suppress this — otherwise a composite "x y z" would also light up
  // standalone "x" / "y" / "z" on neighbouring rows.
  if (!allowTokens) return esc(t)
  const tokens = w.split(/\s+/).map(s => s.trim()).filter(Boolean)
  if (tokens.length <= 1) return esc(t)
  const tokenRe = buildRe(tokens.map(reEsc).join('|'))
  const tokenSpans = collectSpans(tokenRe)
  // Merge overlapping/touching spans, just in case.
  tokenSpans.sort((a, b) => a.start - b.start)
  const merged = []
  for (const sp of tokenSpans) {
    const last = merged[merged.length - 1]
    if (last && sp.start <= last.end) last.end = Math.max(last.end, sp.end)
    else merged.push({ ...sp })
  }
  return splice(merged)
}

// Scroll the active row to the vertical center of the #recPlayingSubs
// panel. Adjusts only the panel's scrollTop (not the page) so mobile
// scroll behaviour stays predictable. Used after initial render and on
// every active-row change.
function _scrollActiveSubIntoView() {
  const subEl = document.getElementById('recPlayingSubs')
  if (!subEl) return
  const rowEl = subEl.querySelector('.rec-ps-active')
  if (!rowEl) return
  const target = rowEl.offsetTop - (subEl.clientHeight / 2) + (rowEl.clientHeight / 2)
  const clamped = Math.max(0, Math.min(subEl.scrollHeight - subEl.clientHeight, target))
  if (typeof subEl.scrollTo === 'function') {
    subEl.scrollTo({ top: clamped, behavior: 'smooth' })
  } else {
    subEl.scrollTop = clamped
  }
}

// Keep `.rec-ps-active` on whichever subtitle row brackets the current
// playhead. Called from _waitYTUntilEnd's onTick.
function _refreshPlayingSubtitles(ctx) {
  if (!ctx) return
  let ct = 0
  try { ct = window.ytPlayer && window.ytPlayer.getCurrentTime ? window.ytPlayer.getCurrentTime() : 0 } catch (_) {}
  const i = _findLineByTime(ctx.primary, ct)
  if (i < ctx.from || i > ctx.to) return  // outside the rendered window
  const $sub = $('#recPlayingSubs')
  if (!$sub.length) return
  const $rows = $sub.find('.rec-ps-row')
  const $cur = $rows.filter('[data-line-i="' + i + '"]')
  if (!$cur.length || $cur.hasClass('rec-ps-active')) return
  $rows.removeClass('rec-ps-active')
  $cur.addClass('rec-ps-active')
  _scrollActiveSubIntoView()
}

// Build the playback queue from the current recording (or every recording
// when loop='all'). Each entry is annotated with its origin (_recName, _st,
// _w, _idx) so per-item actions like "play from here" can rebuild the same
// queue and locate the starting item.
function _buildPlayQueue(loop) {
  const queue = []
  const pushFrom = (recName, items) => {
    if (!items) return
    for (const st of Object.keys(items)) {
      const byW = items[st] || {}
      for (const w of Object.keys(byW)) {
        const arr = byW[w] || []
        arr.forEach((it, idx) => {
          if (!it || it.enabled === false) return
          queue.push({ ...it, _recName: recName, _st: st, _w: w, _idx: idx })
        })
      }
    }
  }
  if (loop === 'all') {
    // Skip virtual playlists here — their items are duplicates of the real
    // members, which are already iterated, so including them would replay
    // the same clips twice.
    Object.keys(window._recordings || {}).sort().forEach(n => {
      const rec = window._recordings[n]
      if (!rec || rec.virtual) return
      pushFrom(n, rec.items)
    })
  } else {
    // window._recording.items is already the resolved union for a virtual
    // current playlist, so this works unchanged for both kinds.
    pushFrom(window._recording.currentName, window._recording.items || {})
  }
  return queue
}

// Fisher-Yates shuffle, in place.
function _shuffleQueue(q) {
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = q[i]; q[i] = q[j]; q[j] = tmp
  }
}

// Remember the last play/practice session so a follow-up Play All / Practice
// on the same playlist can offer to resume from exactly where we stopped —
// not just the same item, but the SAME order (so already-played items don't
// reappear before unplayed ones). Persisted so it survives a reload.
//
// Shape:
//   recName, st, w, idx, id, lineIndex — the per-item cursor (for highlight)
//   mode                                — 'play' | 'practice' (prompt label)
//   queueKeys                           — identity tuples for every item in
//                                         the active queue, in order
//   queuePos                            — index of the current item in keys
//
// We key items by (recName, st, w, id, lineIndex) rather than array index
// so playlist reorders / inserts between sessions don't mis-resolve to the
// wrong item. Items deleted or disabled since are dropped on reconstitute.
// Storage layout: { [playlistName]: { play?: <entry>, practice?: <entry> } }
// Each entry: { recName, st, w, idx, id, lineIndex, mode, queueKeys, queuePos, ts }
// Two entries per playlist (play + practice) — so resuming Play vs Practice
// on the same playlist tracks independent positions. Legacy (single object)
// shape is migrated on first load.
const REC_LAST_PLAYED_KEY = 'cupitor:recLastPlayed'
function _loadLastPlayedMap() {
  if (window._recLastPlayedMap) return window._recLastPlayedMap
  try {
    const raw = localStorage.getItem(REC_LAST_PLAYED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        // Legacy: a single cursor object with .recName at the top level.
        // Migrate into the new map shape, keyed by recName + mode.
        if (parsed.recName) {
          const m = {}
          const mode = parsed.mode === 'practice' ? 'practice' : 'play'
          m[parsed.recName] = {}
          m[parsed.recName][mode] = parsed
          window._recLastPlayedMap = m
          try { localStorage.setItem(REC_LAST_PLAYED_KEY, JSON.stringify(m)) } catch (_) {}
          return m
        }
        window._recLastPlayedMap = parsed
        return parsed
      }
    }
  } catch (_) {}
  window._recLastPlayedMap = {}
  return window._recLastPlayedMap
}
function _saveLastPlayedMap(map) {
  try {
    if (!map || !Object.keys(map).length) localStorage.removeItem(REC_LAST_PLAYED_KEY)
    else localStorage.setItem(REC_LAST_PLAYED_KEY, JSON.stringify(map))
  } catch (_) {}
}
function _setLastPlayed(it, mode, pos) {
  if (!it) return
  // Ad-hoc queues built from starred lines have no recording origin
  // (_recName/_st/_w/_idx are undefined). Skip those so they don't clobber a
  // resumable recording-session target — starred-lines sessions aren't
  // resumable as "playlists" by design.
  if (!it._recName) return
  const map = _loadLastPlayedMap()
  if (!map[it._recName]) map[it._recName] = {}
  const m = (mode === 'practice') ? 'practice' : 'play'
  const prev = map[it._recName][m] || {}
  map[it._recName][m] = {
    ...prev,
    recName: it._recName, st: it._st, w: it._w, idx: it._idx,
    id: it.id, lineIndex: it.lineIndex,
    mode: m,
    queuePos: (typeof pos === 'number') ? pos : prev.queuePos,
    ts: prev.ts || 0  // not bumped on per-item ticks; updated by _saveQueueOrder at session start
  }
  _saveLastPlayedMap(map)
}
// Compatibility shim — some callers (review-dialog highlight, YT-error
// handler) just want "any last-played cursor for the active playlist". Pick
// the newer of (play, practice) for that playlist.
function _loadLastPlayed() {
  const map = _loadLastPlayedMap()
  const cur = window._recording && window._recording.currentName
  if (!cur || !map[cur]) return null
  const p = map[cur].play, q = map[cur].practice
  if (p && q) return ((p.ts || 0) >= (q.ts || 0)) ? p : q
  return p || q || null
}

// Called once when a fresh play/practice session starts. Snapshots the
// queue order (as identity tuples) and resets queuePos to 0 so subsequent
// _setLastPlayed updates have a queue to anchor against. Stored under the
// ACTIVE playlist's name + the chosen mode, so the same playlist tracks
// independent positions in Play vs Practice.
function _saveQueueOrder(queue, mode) {
  if (!Array.isArray(queue) || !queue.length) return
  const keys = []
  for (const it of queue) {
    if (!it || !it._recName) continue
    keys.push({
      recName: it._recName, st: it._st, w: it._w,
      id: it.id, lineIndex: it.lineIndex
    })
  }
  if (!keys.length) return
  const recName = (window._recording && window._recording.currentName) || queue[0]._recName
  const map = _loadLastPlayedMap()
  if (!map[recName]) map[recName] = {}
  const m = (mode === 'practice') ? 'practice' : 'play'
  map[recName][m] = {
    ...(map[recName][m] || {}),
    mode: m,
    queueKeys: keys,
    queuePos: 0,
    ts: (map[recName][m] && map[recName][m].ts) || 1   // bumped below
  }
  // Hand-roll a monotonic timestamp so picking "newest" across modes works
  // without relying on Date.now (which is fine in browsers, but kept
  // deterministic-ish in case the harness ever blocks it).
  let maxTs = 0
  Object.values(map).forEach(byMode => {
    Object.values(byMode || {}).forEach(e => { if (e && e.ts > maxTs) maxTs = e.ts })
  })
  map[recName][m].ts = maxTs + 1
  _saveLastPlayedMap(map)
}

// Reverse of _saveQueueOrder: rebuild a live queue from the saved identity
// tuples. Skips keys whose item no longer exists or is now disabled.
function _reconstituteQueue(keys) {
  const out = []
  if (!Array.isArray(keys)) return out
  for (const k of keys) {
    if (!k || !k.recName) continue
    const rec = window._recordings && window._recordings[k.recName]
    if (!rec) continue
    const items = rec.virtual ? _resolveVirtualItems(k.recName) : rec.items
    const arr = items && items[k.st] && items[k.st][k.w]
    if (!Array.isArray(arr)) continue
    let liveIdx = -1, live = null
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i]
      if (it && it.id === k.id && it.lineIndex === k.lineIndex) {
        liveIdx = i; live = it; break
      }
    }
    if (!live || live.enabled === false) continue
    out.push({ ...live, _recName: k.recName, _st: k.st, _w: k.w, _idx: liveIdx })
  }
  return out
}

// If we have a recoverable last-played session on the CURRENT playlist,
// ask the user whether to resume (saved queue + position) or start fresh.
// Returns { queue, pos } when resuming, null otherwise. The prior session's
// mode only shapes the prompt label — the caller chooses which mode to
// dispatch (Play All / Practice), so the same queue can be resumed in
// either mode.
function _maybeResumeStartItem(mode) {
  const cur = window._recording && window._recording.currentName
  if (!cur) return null
  if (!window._recordings || !window._recordings[cur]) return null
  const m = (mode === 'practice') ? 'practice' : 'play'
  const map = _loadLastPlayedMap()
  const lp = map[cur] && map[cur][m]
  if (!lp || !Array.isArray(lp.queueKeys) || !lp.queueKeys.length) return null
  const live = _reconstituteQueue(lp.queueKeys)
  if (!live.length) return null
  // queuePos >= queueKeys.length means the previous session played the
  // whole queue to the end — no resume target, start fresh next time so
  // the user doesn't see a "1 of N remaining" prompt that just replays
  // the last item.
  const rawPos = lp.queuePos || 0
  if (rawPos >= lp.queueKeys.length) return null
  const pos = Math.min(Math.max(0, rawPos), live.length - 1)
  const remaining = live.length - pos
  const resume = confirm(
    `Resume your last ${m} session in "${cur}"?\n\n` +
    `${remaining} of ${live.length} item(s) remaining (same order).\n\n` +
    `OK = continue from where you left off\n` +
    `Cancel = start fresh (re-shuffles if shuffle is on)`
  )
  if (!resume) return null
  return { queue: live, pos }
}

// YouTube IFrame API error codes that mean the video can't be played:
//   2   — invalid videoId / parameter (can also fire on a momentary glitch)
//   5   — HTML5 player error / another error related to the HTML5 player
//          has occurred — frequently fires transiently when an ad fails to
//          load or the player has a codec hiccup, even for available videos
//   100 — video removed or marked private ("not available") — canonical
//   101, 150 — owner disallowed embedded playback — canonical (identical
//          per the YT docs)
//
// We only treat 100/101/150 as immediate skip+record. For 2/5 we let
// _waitYTUntilEnd's 12s load-grace decide: the player gets a chance to
// recover, and if it doesn't, the natural skip path still moves the loop
// forward without permanently marking the video as broken. Empirically a
// lot of "video didn't play but it's actually fine" reports trace back to
// a transient code 5 from an ad/codec issue.
const YT_UNAVAILABLE_CANONICAL_CODES = new Set([100, 101, 150])

// Persistent record of videos that have failed to play during recording
// playback. Used to surface a "broken videos" review UI in the Settings
// dialog so the user can clean up at their own pace, instead of getting
// nagged with a confirm() in the middle of a play session.
//
// Shape: { [videoId]: { firstSeenAt, lastSeenAt, count, code, label? } }
const PLAY_UNAVAILABLE_KEY = 'cupitor:playUnavailable'
function _loadPlayUnavailable() {
  try {
    const raw = localStorage.getItem(PLAY_UNAVAILABLE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch (_) { return {} }
}
function _savePlayUnavailable(map) {
  try {
    if (!map || !Object.keys(map).length) localStorage.removeItem(PLAY_UNAVAILABLE_KEY)
    else localStorage.setItem(PLAY_UNAVAILABLE_KEY, JSON.stringify(map))
  } catch (_) {}
}
function _recordPlayUnavailable(videoId, code, label) {
  if (!videoId) return
  const m = _loadPlayUnavailable()
  const now = Date.now()
  const prev = m[videoId] || {}
  m[videoId] = {
    firstSeenAt: prev.firstSeenAt || now,
    lastSeenAt: now,
    count: (prev.count || 0) + 1,
    code: code != null ? Number(code) : prev.code,
    label: label || prev.label || null,
  }
  _savePlayUnavailable(m)
  try { _updatePlayUnavailableBadge() } catch (_) {}
}
function _forgetPlayUnavailable(videoId) {
  const m = _loadPlayUnavailable()
  if (m[videoId]) {
    delete m[videoId]
    _savePlayUnavailable(m)
    try { _updatePlayUnavailableBadge() } catch (_) {}
  }
}
function _clearPlayUnavailable() {
  _savePlayUnavailable({})
  try { _updatePlayUnavailableBadge() } catch (_) {}
}

// Keep the "Unavailable (N)" button label in sync with the stored count.
// Hides the button entirely when the list is empty — no point taking up
// settings-footer space if there's nothing to review.
function _updatePlayUnavailableBadge() {
  const m = _loadPlayUnavailable()
  const n = Object.keys(m).length
  const $btn = $('#playUnavailableBtn')
  if (!$btn.length) return
  $btn.text(n ? `Unavailable (${n})` : 'Unavailable')
  $btn.toggle(n > 0)
}

// Look up a human-friendly label for a videoId from the SRT index — falls
// back to the recorded label (the search word that originally surfaced
// this video), then to the bare videoId.
function _labelForVideoId(videoId, recordedLabel) {
  if (!videoId) return ''
  try {
    const srt = (window.srts || []).find(s => s && s.link === videoId)
    if (srt && srt.name) {
      // SRT names are "<channel> || <title> || <id>"; the title segment is
      // the most useful for a human review list.
      const parts = String(srt.name).split(' || ')
      if (parts.length >= 2) return parts[1] || srt.name
      return srt.name
    }
  } catch (_) {}
  if (recordedLabel) return recordedLabel
  return videoId
}

// Settings → "Unavailable (N)…" → review dialog. Lists every video that
// has failed to play during a recording session, with per-entry actions:
//   - Open on YouTube (sanity-check)
//   - Remove from all playlists (drops references; doesn't delete SRTs)
//   - Forget (just clear it from this list; leaves playlists/SRTs alone)
// A footer "Clear all" wipes the list in one go without touching playlists.
function openPlayUnavailableDialog() {
  let $dlg = $('#playUnavailableDialog')
  if (!$dlg.length) {
    $dlg = $(`<div id="playUnavailableDialog" title="Videos that failed to play">
      <div class="pud-info">Videos that errored out during playback. Cleaning a video up is optional — the play loop already skips past it automatically next time.</div>
      <div id="playUnavailableList" class="pud-list"></div>
      <div class="pud-footer">
        <button type="button" id="playUnavailableClearAll" class="lang-tool-btn">Clear all (forget)</button>
      </div>
    </div>`).appendTo('body')
    $dlg.on('click', '#playUnavailableClearAll', function () {
      const m = _loadPlayUnavailable()
      const n = Object.keys(m).length
      if (!n) return
      if (!confirm(`Forget all ${n} unavailable video${n === 1 ? '' : 's'}?\n\nThis only clears the review list; it doesn't touch playlists or SRTs.`)) return
      _clearPlayUnavailable()
      _renderPlayUnavailableList()
    })
    $dlg.on('click', '.pud-forget', function () {
      const id = $(this).data('id')
      if (!id) return
      _forgetPlayUnavailable(id)
      _renderPlayUnavailableList()
    })
    $dlg.on('click', '.pud-remove', function () {
      const id = $(this).data('id')
      if (!id) return
      const label = _labelForVideoId(id)
      if (!confirm(`Remove "${label}" from all playlists?\n\nThis drops every playlist item that references this video. SRT files and the index entry are NOT touched.`)) return
      const n = removeVideoFromAllPlaylists(id)
      _forgetPlayUnavailable(id)
      _renderPlayUnavailableList()
      alert(n > 0
        ? `Removed ${n} item${n === 1 ? '' : 's'} referencing this video.`
        : 'No playlist items referenced this video.')
    })
  }
  _renderPlayUnavailableList()
  const opts = {
    width: Math.min(640, $(window).width() - 32),
    height: Math.min(560, $(window).height() - 60),
    modal: false,
    open: function () {
      $(this).closest('.ui-dialog').attr('tabindex', -1).trigger('focus')
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) $dlg.dialog('option', opts).dialog('open')
  else $dlg.dialog(opts)
}
window.openPlayUnavailableDialog = openPlayUnavailableDialog

function _renderPlayUnavailableList() {
  const $list = $('#playUnavailableList').empty()
  const m = _loadPlayUnavailable()
  const ids = Object.keys(m)
  if (!ids.length) {
    $list.append('<div class="pud-empty">No unavailable videos recorded.</div>')
    return
  }
  // Most-recently-broken first so the list is actionable on every visit.
  ids.sort((a, b) => (m[b].lastSeenAt || 0) - (m[a].lastSeenAt || 0))
  const fmtTime = (t) => {
    if (!t) return ''
    const d = new Date(t)
    return d.toLocaleString()
  }
  ids.forEach(id => {
    const entry = m[id]
    const label = _labelForVideoId(id, entry.label)
    const codeText = entry.code != null ? `YT code ${entry.code}` : ''
    const seen = entry.count > 1 ? `${entry.count}× — last ${fmtTime(entry.lastSeenAt)}` : `at ${fmtTime(entry.lastSeenAt)}`
    const $row = $(`<div class="pud-row">
      <div class="pud-body">
        <div class="pud-label"></div>
        <div class="pud-sub"></div>
      </div>
      <div class="pud-actions">
        <a class="pud-open lang-tool-btn" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}">Open</a>
        <button type="button" class="pud-remove lang-tool-btn" data-id="${id}" title="Remove this video from every playlist">Remove from playlists</button>
        <button type="button" class="pud-forget lang-tool-btn" data-id="${id}" title="Clear this entry from the review list">Forget</button>
      </div>
    </div>`)
    $row.find('.pud-label').text(label)
    $row.find('.pud-sub').text([id, codeText, seen].filter(Boolean).join(' · '))
    $list.append($row)
  })
}

// Wired to the YT player's onError event (see language.html). When a video
// fails to play DURING recording playback, silently log it to a persistent
// list and advance to the next item — no modal interruption. The user can
// review and clean up via Settings → "Unavailable (N)…" at a calm moment.
function handleYoutubePlayerError(code) {
  if (!window._playingRecording) return            // only record during playback
  const n = Number(code)
  if (!YT_UNAVAILABLE_CANONICAL_CODES.has(n)) {
    // Transient code (2 / 5 / anything else). Don't immediately skip and
    // don't record; the load-grace timeout in _waitYTUntilEnd will handle
    // it if the player genuinely can't recover. Logging only so the user
    // can trace "why didn't this video play?" via devtools.
    if (n) console.warn(`[play] non-canonical YT error code ${n} — letting load-grace handle it`)
    return
  }
  const it = window._recPlayCurrentItem
  const lp = _loadLastPlayed()
  const vid = (it && it.id) || (lp && lp.id)
  if (!vid) return
  // Record at most once per video per playback session.
  if (window._recPlayErrorPromptedFor === vid) return
  window._recPlayErrorPromptedFor = vid
  // Skip past the broken item right away so playback doesn't hang on it
  // (_waitYTUntilEnd bails on _recNavRequest).
  window._recNavRequest = 'next'
  const label = (it && (it.word || it.searchText)) || null
  _recordPlayUnavailable(vid, n, label)
  console.warn(`[play] video ${vid} unavailable (YT code ${n}) — recorded for review`)
}
window.handleYoutubePlayerError = handleYoutubePlayerError

// opts:
//   startItem: { recName, st, w, idx }  — play from this item first
//   shuffle  : boolean                  — override settings.recPlayShuffle
//   loop     : 'off' | 'one' | 'playlist' | 'all'  — override settings.recPlayLoop
//   queue    : pre-built item array      — play these instead of the current
//                                          playlist (e.g. starred lines)
async function playRecording(opts) {
  opts = opts || {}
  const settings = window._appSettings || {}
  const shuffle = (opts.shuffle != null) ? !!opts.shuffle : !!settings.recPlayShuffle
  const loop    = opts.loop || settings.recPlayLoop || 'off'
  let queue
  let startIdx = 0
  if (opts.resumeQueue && Array.isArray(opts.resumeQueue.queue) && opts.resumeQueue.queue.length) {
    // Resume path — use the saved queue verbatim. Skip shuffle (the saved
    // order IS the order we left off in) and the queue-snapshot save (it
    // would just rewrite the same data with queuePos reset to 0).
    queue = opts.resumeQueue.queue.slice()
    startIdx = Math.min(Math.max(0, opts.resumeQueue.pos || 0), queue.length - 1)
  } else {
    queue = Array.isArray(opts.queue) ? opts.queue.slice() : _buildPlayQueue(loop)
    if (!queue.length) { alert('No items to play (all excluded?).'); return }
    if (shuffle) _shuffleQueue(queue)
    // Rotate so the requested start item is at index 0 (preserves the
    // shuffled order afterwards). Falls back to no-op if not found.
    if (opts.startItem) {
      const s = opts.startItem
      const i0 = queue.findIndex(q =>
        q && q._st === s.st && q._w === s.w && q._idx === s.idx &&
        (s.recName == null || q._recName === s.recName))
      if (i0 > 0) queue = queue.slice(i0).concat(queue.slice(0, i0))
    }
    // Snapshot for a future Resume — must run AFTER shuffle/rotate so the
    // saved order matches what we're about to play.
    _saveQueueOrder(queue, 'play')
  }
  // Expose for prev/next/loop-aware UI status.
  window._recPlayLoopMode = loop

  // Read the gap LIVE on each sleep so the inline gap-control in the
  // playback overlay can change the wait between items mid-playback.
  const currentGapMs = () => {
    const raw = (window._appSettings && window._appSettings.recPlayGapSeconds)
    const sec = parseInt(raw != null ? raw : $('#recPlayGapSeconds').val(), 10)
    return Math.max(0, Number.isFinite(sec) ? sec : 30) * 1000
  }

  // Enter play mode: close lingering dialogs, hide page chrome, surface the
  // floating Stop button. Stop button is created lazily so it doesn't
  // pollute the DOM until needed.
  $('.ui-dialog-content:visible').each(function () {
    try { $(this).dialog('close') } catch (_) {}
  })
  // The side player panel is redundant in play mode (the floating overlay owns
  // the controls). `body.rec-playing #mediaRelatedContainer { display:none
  // !important }` already hides it for the duration — no need to set inline
  // display:none here. Doing so would leave the panel stuck-hidden after the
  // user closes playback, since the inline style outlives the body class.
  // (loadYoutubeVideo's re-show is already guarded by _playingRecording.)
  if (!$('#recPlayingQueueBtn').length) {
    // Sits in the middle of the transport row where the old Stop button
    // used to live. The real Close (✕) is now in the top-right corner.
    $(`<button id="recPlayingQueueBtn" type="button" title="Show playback queue" aria-label="Show playback queue">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="3"  width="10" height="2" rx="1"/>
          <rect x="2" y="7"  width="10" height="2" rx="1"/>
          <rect x="2" y="11" width="10" height="2" rx="1"/>
        </svg>
      </button>`)
      .appendTo('body')
      .on('click', openPlayingQueueDialog)
  }
  if (!$('#recPlayingCloseBtn').length) {
    $(`<button id="recPlayingCloseBtn" type="button" title="Stop playback" aria-label="Stop playback">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      </button>`)
      .appendTo('body')
      .on('click', stopPlayingRecording)
  }
  if (!$('#recPlayingPauseBtn').length) {
    $(`<button id="recPlayingPauseBtn" type="button" title="Pause / Resume" aria-label="Pause / Resume">
        <svg class="rec-icon-pause" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="4" y="3" width="3" height="10" rx="1"/>
          <rect x="9" y="3" width="3" height="10" rx="1"/>
        </svg>
        <svg class="rec-icon-play" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="display:none;">
          <path d="M4 3l9 5-9 5z"/>
        </svg>
      </button>`)
      .appendTo('body')
      .on('click', togglePlayingRecordingPause)
  }
  if (!$('#recPlayingPrevBtn').length) {
    $(`<button id="recPlayingPrevBtn" type="button" title="Previous (←)" aria-label="Previous item">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M3.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-1 0v-9a.5.5 0 0 1 .5-.5z"/>
          <path d="M12.5 3.5v9a.5.5 0 0 1-.79.407L5.5 8.407V12.5a.5.5 0 0 1-1 0v-9a.5.5 0 0 1 1 0v4.093l6.21-4.5A.5.5 0 0 1 12.5 3.5z"/>
        </svg>
      </button>`)
      .appendTo('body')
      .on('click', () => navigateRecordingPlayback('prev'))
  }
  if (!$('#recPlayingNextBtn').length) {
    $(`<button id="recPlayingNextBtn" type="button" title="Next (→)" aria-label="Next item">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M12.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 1 0v-9a.5.5 0 0 0-.5-.5z"/>
          <path d="M3.5 3.5v9a.5.5 0 0 0 .79.407L10.5 8.407V12.5a.5.5 0 0 0 1 0v-9a.5.5 0 0 0-1 0v4.093l-6.21-4.5A.5.5 0 0 0 3.5 3.5z"/>
        </svg>
      </button>`)
      .appendTo('body')
      .on('click', () => navigateRecordingPlayback('next'))
  }
  // Shuffle + Loop are playback-state toggles, so they live in the player
  // overlay (not the review dialog). The review dialog stays as the
  // authoritative item list; these buttons just change how the current
  // playback session traverses it.
  if (!$('#recPlayingShuffleBtn').length) {
    const $sh = $(`<button id="recPlayingShuffleBtn" type="button" title="Shuffle (re-randomise the queue)" aria-label="Shuffle" aria-pressed="false">🔀</button>`)
      .appendTo('body')
      .on('click', toggleRecPlayShuffle)
    _refreshRecPlayModeBtns()
  }
  if (!$('#recPlayingLoopBtn').length) {
    $(`<button id="recPlayingLoopBtn" type="button" title="Loop mode" aria-label="Loop mode">↪</button>`)
      .appendTo('body')
      .on('click', cycleRecPlayLoopMode)
    _refreshRecPlayModeBtns()
  }
  // Minimize button — collapses the play UI so the user can interact with
  // the main page while the session is paused. Restore re-pins everything.
  if (!$('#recPlayingMinimizeBtn').length) {
    $(`<button id="recPlayingMinimizeBtn" type="button" title="Minimize" aria-label="Minimize">⌄</button>`)
      .appendTo('body')
      .on('click', minimizePlayingRecording)
  }
  if (!$('#recPlayingRestorePill').length) {
    $(`<div id="recPlayingRestorePill" style="display:none;">
        <span class="rec-pill-count"></span>
        <button type="button" class="rec-pill-restore" aria-label="Restore playback" title="Restore">⌃</button>
        <button type="button" class="rec-pill-close" aria-label="Stop playback" title="Stop">✕</button>
      </div>`)
      .appendTo('body')
      .on('click', '.rec-pill-restore', restorePlayingRecording)
      .on('click', '.rec-pill-close', stopPlayingRecording)
  }
  _refreshRecPlayModeBtns()
  window._recPlayPaused = false
  window._recPlayMinimized = false
  // Gap-guard: a single shared interval running for the whole session
  // that re-pauses the YT player whenever it slips back to PLAYING during
  // a gap window. The per-item loop arms/disarms via window._recPlayGapGuard.
  // Bug being fixed: when a video failed to start within _waitYTUntilEnd's
  // load-grace, _waitYTUntilEnd resolved but the player kept loading; when
  // it finally resolved, autoplay kicked in and audio bled through the
  // entire inter-item gap until the next playMediaSlice() reset it.
  if (!window._recPlayGapGuardId) {
    window._recPlayGapGuard = false
    window._recPlayGapGuardId = setInterval(() => {
      if (!window._recPlayGapGuard) return
      if (window._recPlayPaused) return
      try {
        const p = window.ytPlayer
        // YT.PlayerState.PLAYING === 1
        if (p && typeof p.getPlayerState === 'function' && p.getPlayerState() === 1) {
          p.pauseVideo && p.pauseVideo()
        }
      } catch (_) {}
    }, 200)
  }
  $('body').addClass('rec-playing').removeClass('rec-paused rec-playing-minimized')

  window._playingRecording = true
  window._recNavRequest = null
  window._recNavGotoIndex = null
  window._recPlaySlowdown = false
  // Per-session "video unavailable" prompt tracking (see
  // handleYoutubePlayerError). Reset so a fresh session can re-prompt.
  window._recPlayErrorPromptedFor = null
  window._recPlayCurrentItem = null
  // Expose the queue so the player-overlay Shuffle button can re-randomise
  // the unplayed tail without restarting playback.
  window._recPlayQueue = queue
  // Read loop / isLooping LIVE so the in-player Loop button takes effect
  // mid-playback (without these closures the captured `loop` would freeze
  // at session start).
  const _curLoop     = () => (window._appSettings && window._appSettings.recPlayLoop) || 'off'
  const _curLooping  = () => { const l = _curLoop(); return l === 'one' || l === 'playlist' || l === 'all' }
  let prevWord = null
  let i = startIdx
  while (window._playingRecording) {
    // Boundary handling: with no loop we exit at queue end; otherwise wrap.
    if (i >= queue.length) {
      if (_curLooping()) i = 0
      else break
    }
    if (i < 0) {
      i = _curLooping() ? queue.length - 1 : 0
    }
    window._recPlayIndex = i
    window._recPlayQueueLen = queue.length
    const it = queue[i]
    if (it.source && it.source.toLowerCase() !== 'youtube') {
      console.warn('playRecording: skipping non-YouTube item', it)
      i++
      continue
    }

    _renderPlayingBanner(it, i, queue.length)
    // Remember the item currently playing so the review dialog can highlight
    // it after the player is closed (and so a follow-up Play All / Practice
    // on this playlist can offer to resume from this exact item, in the
    // same queue order). The `i` advances queuePos so Resume picks up here.
    _setLastPlayed(it, 'play', i)
    // Also expose the live item object so the YT onError handler knows which
    // video failed (and can label the delete prompt).
    window._recPlayCurrentItem = it
    // Manual entries: no clip to play. If the media is a YouTube link we
    // still cue it into the embedded player at t=0 (so the user can hit
    // play manually if they want) but never auto-play — the playlist's
    // own timing comes from the inter-item gap, which doubles as the
    // hold-on-text duration. Non-YT links are ignored here (opening them
    // in a new tab mid-playlist would break flow); the user can click
    // the link badge in the Review dialog instead.
    if (_isManualItem(it)) {
      if (it.mediaKind === 'youtube' && it.mediaVideoId) {
        try {
          window.mediaSelected = { link: it.mediaVideoId, source: 'link' }
          await changeMediaIfNeededTo(window.mediaSelected)
        } catch (e) { console.warn('playRecording: manual YT cue failed', it, e) }
      }
      // Hold for the inter-item gap so the user reads the text, honoring
      // pause / stop. The gap-countdown progress bar shows time-until-next.
      // Then handle prev/next/goto/loop the same way video items do,
      // except we skip the trailing _sleepRespectingPause (the hold
      // already consumed the gap).
      if (window._playingRecording) {
        const _gapMs = currentGapMs()
        if (_gapMs > 0) _startGapCountdown(_gapMs)
        await _sleepRespectingPause(_gapMs)
        _stopGapCountdown()
      }
      if (window._recNavRequest === 'prev') {
        window._recNavRequest = null
        i = (i > 0) ? (i - 1) : (_curLooping() ? queue.length - 1 : 0)
        window._recPlaySlowdown = true
        continue
      }
      if (window._recNavRequest === 'next') {
        window._recNavRequest = null
        i = (i + 1 < queue.length) ? (i + 1) : (_curLooping() ? 0 : queue.length)
        continue
      }
      if (Number.isInteger(window._recNavGotoIndex)) {
        const g = window._recNavGotoIndex
        window._recNavGotoIndex = null
        if (g >= 0 && g < queue.length) { i = g; continue }
      }
      if (_curLoop() === 'one') continue
      const willHaveNext = (i + 1 < queue.length) || _curLooping()
      if (!willHaveNext) { i++; continue }
      i++
      continue
    }
    if (it.word && it.word !== prevWord) {
      // Speak the word once before its first item plays. Re-runs whenever
      // the queue moves on to a new word — including when the user
      // navigates prev/next and the new item belongs to a different word.
      await _speakWord(it.word)
      if (!window._playingRecording) break
      prevWord = it.word
    }
    // Render the subtitle overlay in PARALLEL with playback. Awaiting it
    // here would block the video on a (potentially slow) SRT fetch via
    // getSubtitlesForLink. Stash the promise's resolved value in a holder
    // so _refreshPlayingSubtitles can pick it up once it arrives.
    const subHolder = { ctx: null }
    _renderPlayingSubtitles(it)
      .then(c => { subHolder.ctx = c })
      .catch(e => console.warn('playRecording: subtitle render failed', it, e))

    // Recover a sane play window for malformed clips (recorded duration
    // > MAX_REASONABLE_CLIP_S, almost always from an old capture whose
    // context window straddled a sparse-SRT discontinuity). Falls through
    // to the original bounds when there's nothing to repair against —
    // _waitYTUntilEnd's final safety-net skip still catches the
    // unrecoverable case.
    let _playStart = it.timeStart
    let _playEnd   = it.timeEnd
    const _rawDur = (parseFloat(_playEnd) || 0) - (parseFloat(_playStart) || 0)
    if (Number.isFinite(_rawDur) && _rawDur > MAX_REASONABLE_CLIP_S) {
      const repaired = await _repairMalformedClip(it)
      if (repaired) {
        console.warn(
          `[playRecording] malformed clip ${it.id} dur=${_rawDur.toFixed(0)}s — playing ` +
          `${(repaired.timeEnd - repaired.timeStart).toFixed(1)}s around lineIndex ${it.lineIndex} ` +
          `(${repaired.timeStart.toFixed(1)}→${repaired.timeEnd.toFixed(1)})`
        )
        _playStart = repaired.timeStart
        _playEnd   = repaired.timeEnd
      }
    }

    // Set the end boundary for the existing markIntervalPlayDone() hook
    // (defensive — _waitYTUntilEnd also pauses). videoId lets the hook
    // ignore stale ct reads that belong to the PREVIOUS clip's video.
    window.youtubePlayInterval = { start: _playStart, end: _playEnd, videoId: it.id }
    window.playingYoutubeVideo = true
    // Reset the progress bar without the width-transition so it doesn't
    // visibly drain from 100% → 0% over 400ms at every clip boundary; the
    // bar should already read 0 when the next clip begins.
    $('#recPlayingBanner .rec-pb-bar')
      .css('transition', 'none').css('width', '0%')
      .each(function () { void this.offsetWidth })
      .css('transition', '')
    // Play media directly via playMediaSlice — search results aren't
    // deterministic so we deliberately don't drive playback via the live
    // DOM. playMediaSlice loads/seeks the YouTube player with the
    // recorded url + timeStart, which is all we need.
    // Lift the gap-guard before playing — without this the guard would
    // immediately re-pause the player we just asked to start.
    window._recPlayGapGuard = false
    const _src = (it.source || '').toLowerCase() === 'youtube' ? 'YouTube' : (it.source || 'YouTube')
    try {
      await playMediaSlice(it.id, _playStart, _playEnd, _src)
    } catch (e) {
      console.warn('playRecording: playMediaSlice failed for', it, e)
      i++
      continue
    }
    // _waitYTUntilEnd pauses the player when ct >= timeEnd, so when the next
    // item reuses the same video, playMediaSlice short-circuits to just a
    // seek — leaving the player paused and the clip never starts. Kick it
    // back into play explicitly here so consecutive same-video items work.
    try { window.ytPlayer && window.ytPlayer.playVideo && window.ytPlayer.playVideo() } catch (_) {}
    // If the user navigated backwards, play this item at 0.75x so they can
    // catch what they missed. Restored to 1x as soon as the wait resolves.
    const slowedThisRound = !!window._recPlaySlowdown
    if (slowedThisRound) {
      try { window.ytPlayer && window.ytPlayer.setPlaybackRate && window.ytPlayer.setPlaybackRate(0.75) } catch (_) {}
    }
    await _waitYTUntilEnd(_playStart, _playEnd, () => {
      _updatePlayingProgress(_playStart, _playEnd, it.id)
      _refreshPlayingSubtitles(subHolder.ctx)
    }, it.id)
    if (slowedThisRound) {
      try { window.ytPlayer && window.ytPlayer.setPlaybackRate && window.ytPlayer.setPlaybackRate(1) } catch (_) {}
      window._recPlaySlowdown = false
    }
    // Clip is done — arm the gap-guard so a slow-loaded clip that finally
    // resolves AFTER we bailed (or any YT autoplay weirdness) doesn't
    // bleed audio through the inter-item gap. Cleared right before the
    // next playMediaSlice() above.
    window._recPlayGapGuard = true

    // Honour any prev/next/goto request queued while this item was playing.
    // Prev re-plays the previous item with slowdown; next advances forward;
    // goto jumps to an arbitrary index (set by the queue dialog).
    // Wraps around in any looping mode; stays clamped otherwise.
    if (window._recNavRequest === 'prev') {
      window._recNavRequest = null
      i = (i > 0) ? (i - 1) : (_curLooping() ? queue.length - 1 : 0)
      window._recPlaySlowdown = true
      continue
    }
    if (window._recNavRequest === 'next') {
      window._recNavRequest = null
      i = (i + 1 < queue.length) ? (i + 1) : (_curLooping() ? 0 : queue.length)
      continue
    }
    if (Number.isInteger(window._recNavGotoIndex)) {
      const g = window._recNavGotoIndex
      window._recNavGotoIndex = null
      if (g >= 0 && g < queue.length) { i = g; continue }
    }

    // Loop=one: replay this same item indefinitely (until prev/next/stop).
    if (_curLoop() === 'one') {
      if (window._playingRecording) {
        const _gapMs = currentGapMs()
        if (_gapMs > 0) _startGapCountdown(_gapMs)
        await _sleepRespectingPause(_gapMs)
        _stopGapCountdown()
      }
      continue
    }
    // Natural advance — gap between items, including before a wrap.
    const willHaveNext = (i + 1 < queue.length) || _curLooping()
    if (willHaveNext && window._playingRecording) {
      const _gapMs = currentGapMs()
      if (_gapMs > 0) _startGapCountdown(_gapMs)
      await _sleepRespectingPause(_gapMs)
      _stopGapCountdown()
    }
    i++
  }
  // If we exited the loop because i >= queue.length AND looping is off,
  // the session played to natural completion. Mark queuePos past the end
  // so the next Play All doesn't pop the "1 of N remaining" resume
  // prompt for what was actually a finished session.
  try {
    if (!_curLooping() && queue.length && i >= queue.length) {
      const recName = (window._recording && window._recording.currentName) || (queue[0] && queue[0]._recName)
      if (recName) {
        const map = _loadLastPlayedMap()
        if (map[recName] && map[recName].play) {
          map[recName].play.queuePos = queue.length
          _saveLastPlayedMap(map)
        }
      }
    }
  } catch (_) {}
  window._recPlayQueue = null
  window._playingRecording = false
  window._recPlaySlowdown = false
  window._recNavRequest = null
  window._recPlayCurrentItem = null
  window._recPlayMinimized = false
  window._recPlayGapGuard = false
  if (window._recPlayGapGuardId) { clearInterval(window._recPlayGapGuardId); window._recPlayGapGuardId = null }
  $('body').removeClass('rec-playing rec-paused rec-playing-minimized')
  $('#recPlayingBanner').remove()
  $('#recPlayingSubs').remove()
  $('#recPlayingWord').remove()
  $('#recPlayingPauseBtn').remove()
  $('#recPlayingPrevBtn').remove()
  $('#recPlayingNextBtn').remove()
  $('#recPlayingShuffleBtn').remove()
  $('#recPlayingLoopBtn').remove()
  $('#recPlayingMinimizeBtn').remove()
  $('#recPlayingCloseBtn').remove()
  $('#recPlayingQueueBtn').remove()
  $('#recPlayingRestorePill').remove()
  $('#recPlayNavToast').remove()
  try { window.ytPlayer && window.ytPlayer.setPlaybackRate && window.ytPlayer.setPlaybackRate(1) } catch (_) {}
  try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
}

// Flash a temporary "Will play x/y next" toast when the user taps prev/next.
// Mirrors the playback loop's wrap-around logic (see ~L9293) so the index
// shown matches where playback will actually land, looping included.
let _recPlayNavToastTimer = null
function _showRecPlayNavToast(direction) {
  const q = window._recPlayQueue
  const total = Array.isArray(q) ? q.length : 0
  if (!total) return
  const i = window._recPlayIndex || 0
  const looping = ((window._appSettings && window._appSettings.recPlayLoop) || 'off') !== 'off'
  let target
  if (direction === 'prev') {
    target = (i > 0) ? (i - 1) : (looping ? total - 1 : 0)
  } else {
    target = (i + 1 < total) ? (i + 1) : (looping ? 0 : total)
  }

  let msg
  if (target >= total) {
    msg = 'End of queue'   // next at the last item, not looping → playback ends
  } else {
    const word = q[target] && q[target].word
    msg = `Will play ${target + 1}/${total} next` + (word ? ` · "${word}"` : '')
  }

  let $t = $('#recPlayNavToast')
  if (!$t.length) $t = $('<div id="recPlayNavToast" role="status" aria-live="polite"></div>').appendTo('body')
  $t.text(msg).addClass('visible')
  if (_recPlayNavToastTimer) clearTimeout(_recPlayNavToastTimer)
  _recPlayNavToastTimer = setTimeout(() => { $t.removeClass('visible') }, 1600)
}

// Queue a prev/next navigation request for the playback loop. The loop
// checks it after each item finishes — either naturally or interrupted
// via the same flag inside _waitYTUntilEnd. When paused, also unpause so
// the new item actually starts.
function navigateRecordingPlayback(direction) {
  if (!window._playingRecording) return false
  if (direction !== 'prev' && direction !== 'next') return false
  window._recNavRequest = direction
  _showRecPlayNavToast(direction)
  // Stop the currently-playing video and any in-flight TTS RIGHT NOW so the
  // transition into the next item is clean. The playback loop will see
  // _recNavRequest and route to the right index — but without this the
  // user hears the old clip continue for up to one poll-tick (~100ms) and,
  // worse, any active TTS audio overlaps the next item.
  try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
  try {
    const t = window._recTTS
    if (t && t.kind === 'audio' && t.audio) { t.audio.pause(); t.audio.src = '' }
    if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel()
    }
  } catch (_) {}
  window._recTTS = null
  if (window._recPlayPaused) togglePlayingRecordingPause()
  return true
}

// Pause/resume both the YouTube player and the active TTS (Google audio or
// browser speech). Toggled by the floating pause button. The wait loops
// (_waitYTUntilEnd, _sleepRespectingPause) check window._recPlayPaused and
// extend their deadlines so paused time doesn't count against stall/cap.
function togglePlayingRecordingPause() {
  if (!window._playingRecording) return
  if (window._recPlayPaused) {
    window._recPlayPaused = false
    $('body').removeClass('rec-paused')
    $('#recPlayingPauseBtn .rec-icon-pause').show()
    $('#recPlayingPauseBtn .rec-icon-play').hide()
    try { window.ytPlayer && window.ytPlayer.playVideo && window.ytPlayer.playVideo() } catch (_) {}
    try {
      const t = window._recTTS
      if (t && t.kind === 'audio' && t.audio) t.audio.play().catch(() => {})
      else if (t && t.kind === 'speech') window.speechSynthesis && window.speechSynthesis.resume()
    } catch (_) {}
  } else {
    window._recPlayPaused = true
    $('body').addClass('rec-paused')
    $('#recPlayingPauseBtn .rec-icon-pause').hide()
    $('#recPlayingPauseBtn .rec-icon-play').show()
    try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
    try {
      const t = window._recTTS
      if (t && t.kind === 'audio' && t.audio) t.audio.pause()
      else if (t && t.kind === 'speech') window.speechSynthesis && window.speechSynthesis.pause()
    } catch (_) {}
  }
}

// Open a modeless dialog listing the queue in play order with the current
// item highlighted. Click ▶ on any row to jump there mid-session — the loop
// reads window._recNavGotoIndex on its next iteration boundary and dispatches.
function openPlayingQueueDialog() {
  const queue = window._recPlayQueue || []
  if (!queue.length) { alert('Queue is empty.'); return }
  let $dlg = $('#playingQueueDialog')
  if (!$dlg.length) $dlg = $('<div id="playingQueueDialog"></div>').appendTo('body')
  const curIdx = (window._recPlayIndex == null) ? -1 : window._recPlayIndex
  let html = '<div class="pqd-list">'
  queue.forEach((it, i) => {
    const isCur = i === curIdx
    const label = it.manual
      ? `📝 ${(it.source || '').trim() || '(empty)'}`
      : `${it.id} · ${it.timeStart}s–${it.timeEnd}s`
    const sub = it.manual
      ? ((it.target || '').trim() || '')
      : (it._st && it._w ? `"${it._st}" → ${it._w}` : '')
    html += `<div class="pqd-row${isCur ? ' pqd-current' : ''}" data-idx="${i}">
      <span class="pqd-num">${i + 1}</span>
      <div class="pqd-body">
        <div class="pqd-text">${_.escape(label)}</div>
        ${sub ? `<div class="pqd-sub">${_.escape(sub)}</div>` : ''}
      </div>
      <button type="button" class="pqd-play" data-idx="${i}" title="Play from here" aria-label="Play from here">▶</button>
    </div>`
  })
  html += '</div>'
  $dlg.html(html)

  const jumpTo = (i) => {
    if (!Number.isInteger(i) || i < 0 || i >= queue.length) return
    window._recNavGotoIndex = i
    try { $dlg.dialog('close') } catch (_) {}
  }
  $dlg.off('click', '.pqd-play').on('click', '.pqd-play', function (e) {
    e.preventDefault(); e.stopPropagation()
    jumpTo(parseInt($(this).data('idx'), 10))
  })
  $dlg.off('click', '.pqd-row').on('click', '.pqd-row', function (e) {
    if ($(e.target).closest('.pqd-play').length) return
    jumpTo(parseInt($(this).data('idx'), 10))
  })

  const opts = {
    title: `Playback queue (${queue.length} item${queue.length === 1 ? '' : 's'})`,
    width: Math.min(560, $(window).width() - 32),
    height: Math.min(560, $(window).height() - 60),
    modal: false,
    autoOpen: true
  }
  if ($dlg.hasClass('ui-dialog-content')) $dlg.dialog('option', opts).dialog('open')
  else $dlg.dialog(opts)
  // Force the wrapper above the play overlay (banner/transport sit at
  // 100002–100004). CSS handles this via :has() but not every browser
  // supports it yet, so set inline as a fallback.
  try { $dlg.dialog('widget').css('z-index', 100010) } catch (_) {}
  // Scroll the current row into view.
  setTimeout(() => {
    const el = $dlg.find('.pqd-current')[0]
    if (el && el.scrollIntoView) try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch (_) {}
  }, 80)
}
window.openPlayingQueueDialog = openPlayingQueueDialog

// Minimize the play UI so the user can interact with the main page while
// the session is paused. The playback loop keeps running but
// _sleepRespectingPause + _waitYTUntilEnd respect _recPlayPaused, so they
// won't advance until restore. The restore pill is the single visible
// hook back into the session.
function minimizePlayingRecording() {
  if (!window._playingRecording) return
  window._recPlayMinimized = true
  // Pause playback so audio/video doesn't keep playing while the user is
  // doing something else on the main page.
  if (!window._recPlayPaused) togglePlayingRecordingPause()
  $('body').removeClass('rec-playing').addClass('rec-playing-minimized')
  const cur = window._recPlayCurrentItem
  const queue = window._recPlayQueue || []
  const idx = (window._recPlayIndex == null) ? 0 : window._recPlayIndex
  $('#recPlayingRestorePill .rec-pill-count').text(`${idx + 1}/${queue.length}`)
  $('#recPlayingRestorePill').show()
}
function restorePlayingRecording() {
  if (!window._playingRecording) return
  window._recPlayMinimized = false
  $('body').addClass('rec-playing').removeClass('rec-playing-minimized')
  $('#recPlayingRestorePill').hide()
  // Don't auto-resume — leave it paused so the user can scrub / read before
  // continuing. They can hit Pause/Resume button (▶) to actually play.
}
window.minimizePlayingRecording = minimizePlayingRecording
window.restorePlayingRecording = restorePlayingRecording

// Sleep `ms` milliseconds, but stretch the wall-clock wait whenever
// the user has paused playback so the inter-item gap doesn't tick down
// while paused. Bails out if playback is stopped.
function _sleepRespectingPause(ms) {
  return new Promise(resolve => {
    let remaining = ms
    let lastTick = Date.now()
    const id = setInterval(() => {
      if (!window._playingRecording) { clearInterval(id); return resolve() }
      // Bail the gap-sleep on any nav request so jumping via the queue
      // dialog or prev/next feels instant rather than waiting out the gap.
      if (window._recNavRequest || Number.isInteger(window._recNavGotoIndex)) {
        clearInterval(id); return resolve()
      }
      const now = Date.now()
      const elapsed = now - lastTick
      lastTick = now
      if (!window._recPlayPaused) remaining -= elapsed
      if (remaining <= 0) { clearInterval(id); resolve() }
    }, 200)
  })
}

function stopPlayingRecording() {
  window._playingRecording = false
  window._recPlayPaused = false
  window._recPlayMinimized = false
  window._recPlayGapGuard = false
  if (window._recPlayGapGuardId) { clearInterval(window._recPlayGapGuardId); window._recPlayGapGuardId = null }
  try { _stopGapCountdown() } catch (_) {}
  $('body').removeClass('rec-playing rec-paused rec-playing-minimized')
  $('#recPlayingBanner').remove()
  $('#recPlayingSubs').remove()
  $('#recPlayingWord').remove()
  $('#recPlayingPauseBtn').remove()
  $('#recPlayingPrevBtn').remove()
  $('#recPlayingNextBtn').remove()
  $('#recPlayingShuffleBtn').remove()
  $('#recPlayingLoopBtn').remove()
  $('#recPlayingMinimizeBtn').remove()
  $('#recPlayingRestorePill').remove()
  $('#recPlayNavToast').remove()
  try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (_) {}
  try {
    const t = window._recTTS
    if (t && t.kind === 'audio' && t.audio) { t.audio.pause(); t.audio.src = '' }
  } catch (_) {}
  window._recTTS = null
  try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
  $('#toggleMediaContainer').click() 
  $('#mediaRelatedContainer').hide()
}

// ─── Practice (flashcard) mode ───────────────────────────────────────────
// Card-based, no timer. Each card is a shuffled playlist item showing the
// matched subtitle line in the "front" language, a Reveal button for the
// other language, and the YouTube clip cued (NOT auto-played) at the item's
// timeStart. Navigate by swipe, arrow keys, or the prev/next buttons.
// opts.queue: pre-built item array (e.g. starred lines) to practice instead of
// the current playlist. Falls back to the current playlist when omitted.
function openPracticeMode(opts) {
  opts = opts || {}
  let queue
  let startIdx = 0
  if (opts.resumeQueue && Array.isArray(opts.resumeQueue.queue) && opts.resumeQueue.queue.length) {
    // Resume path — use the saved queue verbatim, start at saved index.
    // Skips the shuffle + startItem rotation since the saved order IS the
    // order we left off in.
    queue = opts.resumeQueue.queue.slice()
    startIdx = Math.min(Math.max(0, opts.resumeQueue.pos || 0), queue.length - 1)
  } else {
    queue = Array.isArray(opts.queue) ? opts.queue.slice() : _buildPlayQueue('off')
    if (!queue.length) {
      alert(opts.queue ? 'No starred lines to practice.' : 'No items to practice (all excluded?).')
      return
    }
    // Match Player's order semantics: respect the recPlayShuffle setting.
    // Default off → natural playlist order, same as Player when shuffle is
    // off. The in-practice shuffle button (top bar) flips this same setting.
    if (window._appSettings && window._appSettings.recPlayShuffle) {
      _shuffleQueue(queue)
    }
    // Optional startItem rotation — rotates the queue so the requested card
    // lands at index 0. Used by per-item launch points (the review dialog's
    // "Play from this item" button doesn't invoke practice, but keeping the
    // path symmetric with playRecording).
    if (opts.startItem) {
      const s = opts.startItem
      const i0 = queue.findIndex(q =>
        q && q._st === s.st && q._w === s.w && q._idx === s.idx &&
        (s.recName == null || q._recName === s.recName))
      if (i0 > 0) {
        const head = queue.slice(i0), tail = queue.slice(0, i0)
        queue.length = 0
        Array.prototype.push.apply(queue, head.concat(tail))
      }
    }
    // Snapshot for a future Resume — saved after shuffle/rotate so the
    // saved order matches what's about to be practiced.
    _saveQueueOrder(queue, 'practice')
  }
  window._practiceCards = queue
  window._practiceIdx = startIdx
  // Restore direction toggle from persisted settings on first entry of the
  // session; subsequent re-opens keep whatever the user toggled to.
  if (window._practiceFrontIsSource == null) {
    const stored = window._appSettings && window._appSettings.practiceFrontIsSource
    window._practiceFrontIsSource = (stored == null) ? true : !!stored
  }
  window._practiceCtxBefore = 0
  window._practiceCtxAfter = 0
  window._practicePlaybackRate = 1
  window._practiceFlipped = false
  window._practiceMinimized = false
  window._practiceActive = true
  // `body.practice-mode #mediaRelatedContainer { display:none !important }`
  // already hides the side player panel while practice is open — no need to
  // set inline display:none here, which would otherwise outlive the body
  // class and leave the panel stuck-hidden after close.

  let $p = $('#practiceMode')
  if (!$p.length) {
    // The card area is a CSS 3D card-flipper: .practice-front-face holds the
    // source side (word + ctx controls + source lines + reveal button), and
    // .practice-back-face holds the target translation. In 'flip' reveal mode
    // we toggle a .flipped class on .practice-flipper for the rotateY anim;
    // in 'hide'/'both' modes the back-face is hidden via display:none and the
    // legacy .practice-back div under the front handles reveal-below layout.
    $p = $(`<div id="practiceMode">
      <div class="practice-topbar">
        <span class="practice-count"></span>
        <button type="button" class="practice-info" aria-label="Show item details" title="Show item details" aria-expanded="false">ℹ</button>
        <button type="button" class="practice-shuffle" aria-label="Shuffle" title="Shuffle order" aria-pressed="false">🔀</button>
        <button type="button" class="practice-settings" aria-label="Practice settings" title="Reveal mode / direction / delete" aria-expanded="false">⋯</button>
        <button type="button" class="practice-minimize" aria-label="Minimize" title="Minimize">⌄</button>
        <button type="button" class="practice-close" aria-label="Close practice" title="Close">✕</button>
      </div>
      <div class="practice-info-panel" style="display:none;">
        <div class="practice-info-head"></div>
        <div class="practice-info-meta"></div>
      </div>
      <div class="practice-settings-panel" style="display:none;">
        <label class="practice-settings-row">
          <span class="practice-settings-lbl">Reveal</span>
          <select class="practice-reveal-select">
            <option value="flip">Flip to target</option>
            <option value="both">Show both</option>
            <option value="hide">Hide until click</option>
          </select>
        </label>
        <div class="practice-settings-row">
          <span class="practice-settings-lbl">Direction</span>
          <button type="button" class="practice-dir" title="Flip which language is shown first"></button>
        </div>
        <div class="practice-settings-row">
          <span class="practice-settings-lbl">Item</span>
          <button type="button" class="practice-delete" aria-label="Delete this item from the playlist" title="Delete this card from the playlist">🗑 Delete this card</button>
        </div>
      </div>
      <div class="practice-card">
        <div class="practice-flipper">
          <div class="practice-face practice-front-face">
            <div class="practice-word"></div>
            <div class="practice-ctx-ctrl">
              <button type="button" class="practice-ctx-before" title="Show one more line before" aria-label="Show one more line before">↑＋</button>
              <button type="button" class="practice-ctx-after" title="Show one more line after" aria-label="Show one more line after">↓＋</button>
              <button type="button" class="practice-ctx-reset" title="Reset to the matched line only" aria-label="Reset context">↺</button>
            </div>
            <div class="practice-front"></div>
            <button type="button" class="practice-reveal" title="Reveal (R)" aria-label="Reveal">👁</button>
            <div class="practice-back" style="display:none;"></div>
          </div>
          <div class="practice-face practice-back-face">
            <div class="practice-back-target"></div>
            <button type="button" class="practice-unflip" title="Show source again" aria-label="Show source again">↶</button>
          </div>
        </div>
      </div>
      <div class="practice-nav">
        <button type="button" class="practice-prev" aria-label="Previous (←)" title="Previous (←)">‹</button>
        <button type="button" class="practice-play" aria-label="Play clip" title="Play clip">▶</button>
        <button type="button" class="practice-speed" aria-label="Playback speed" title="Cycle playback speed">1×</button>
        <button type="button" class="practice-next" aria-label="Next (→)" title="Next (→)">›</button>
      </div>
      <div class="practice-restore">
        <span class="practice-restore-count"></span>
        <button type="button" class="practice-restore-btn" aria-label="Restore practice" title="Restore">⌃</button>
        <button type="button" class="practice-restore-close" aria-label="Close practice" title="Close">✕</button>
      </div>
    </div>`).appendTo('body')

    $p.on('click', '.practice-close', closePracticeMode)
    $p.on('click', '.practice-restore-close', closePracticeMode)
    $p.on('click', '.practice-minimize', minimizePracticeMode)
    $p.on('click', '.practice-restore-btn', restorePracticeMode)
    $p.on('click', '.practice-delete', _deleteCurrentPracticeCard)
    $p.on('click', '.practice-info', _togglePracticeInfoPanel)
    $p.on('click', '.practice-shuffle', _togglePracticeShuffle)
    $p.on('click', '.practice-settings', _togglePracticeSettingsPanel)
    $p.on('change', '.practice-reveal-select', function () {
      const v = String($(this).val() || 'flip')
      if (['flip', 'both', 'hide'].indexOf(v) < 0) return
      if (!window._appSettings) window._appSettings = {}
      window._appSettings.practiceRevealMode = v
      try { saveAppSettings() } catch (_) {}
      // Re-render so the reveal-mode change takes effect on the visible card.
      _renderPracticeCard()
    })
    $p.on('click', '.practice-prev', () => practiceNav(-1))
    $p.on('click', '.practice-next', () => practiceNav(1))
    $p.on('click', '.practice-reveal', revealPracticeCard)
    $p.on('click', '.practice-unflip', revealPracticeCard)   // toggles flip back
    $p.on('click', '.practice-dir', togglePracticeDir)
    $p.on('click', '.practice-play', playPracticeClip)
    $p.on('click', '.practice-speed', cyclePracticePlaybackRate)
    $p.on('click', '.practice-ctx-before', () => { window._practiceCtxBefore++; _renderPracticeCard() })
    $p.on('click', '.practice-ctx-after',  () => { window._practiceCtxAfter++;  _renderPracticeCard() })
    $p.on('click', '.practice-ctx-reset',  () => { window._practiceCtxBefore = 0; window._practiceCtxAfter = 0; _renderPracticeCard() })
    // Edit a subtitle line via #practiceLineEditDialog (a jQuery UI dialog —
    // see _practiceBeginEdit). Inline editing was replaced because the
    // on-screen keyboard covered the bottom of the card on mobile.
    $p.on('click', '.practice-line-edit', _practiceBeginEdit)

    // Horizontal swipe / drag on the card: left → next, right → prev. Uses
    // Pointer Events so it covers touch, mouse and pen. The card follows the
    // pointer for feedback, then either navigates (past threshold) or snaps
    // back. Ignored when starting on an interactive element (edit box, button,
    // textarea) so those keep working. Direction is locked in on first move so
    // a vertical scroll isn't hijacked.
    const card = $p.find('.practice-card')[0]
    if (card) {
      let sx = 0, sy = 0, dragging = false, decided = false, horizontal = false
      const THRESH = 55
      const settle = (animate) => {
        card.style.transition = animate ? 'transform .18s ease' : 'none'
        card.style.transform = ''
        if (animate) setTimeout(() => { card.style.transition = '' }, 220)
      }
      card.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if ($(e.target).closest('.practice-edit-box, button, textarea, input, a').length) { dragging = false; return }
        sx = e.clientX; sy = e.clientY
        dragging = true; decided = false; horizontal = false
        card.style.transition = 'none'
      })
      card.addEventListener('pointermove', (e) => {
        if (!dragging) return
        const dx = e.clientX - sx, dy = e.clientY - sy
        if (!decided) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
          decided = true
          horizontal = Math.abs(dx) > Math.abs(dy)
          if (horizontal) { try { card.setPointerCapture(e.pointerId) } catch (_) {} }
        }
        if (horizontal) {
          e.preventDefault()
          // The card is centred with translateX(-50%) in CSS, so the drag
          // offset has to be layered on top of that base.
          card.style.transform = `translateX(calc(-50% + ${dx}px))`
        }
      })
      const end = (e) => {
        if (!dragging) return
        dragging = false
        const dx = e.clientX - sx, dy = e.clientY - sy
        if (horizontal && Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy) * 1.2) {
          // practiceNav re-renders the card; clear the transform so the new
          // card is centred rather than inheriting the drag offset.
          practiceNav(dx < 0 ? 1 : -1)
          settle(false)
        } else {
          settle(true)
        }
      }
      card.addEventListener('pointerup', end)
      card.addEventListener('pointercancel', end)
    }
  }
  $('body').addClass('practice-mode')
  // Always clear the minimized class on (re-)open — a previous session may
  // have left the panel collapsed, and the DOM is reused across sessions.
  // Without this, re-entering practice mode (e.g. Review → Practice) would
  // re-pin the YT player but leave the topbar/card/nav hidden.
  $p.removeClass('minimized')
  // Reflect current shuffle state on the top-bar button.
  _refreshPracticeShuffleBtn()
  // Listen for keyboard show/hide on mobile so we can lift the card above it.
  if (window.visualViewport && !window._practiceViewportWired) {
    window.visualViewport.addEventListener('resize', _onPracticeViewportChange)
    window.visualViewport.addEventListener('scroll', _onPracticeViewportChange)
    window._practiceViewportWired = true
  }
  _renderPracticeCard()
}
window.openPracticeMode = openPracticeMode

function closePracticeMode() {
  window._practiceActive = false
  window._practiceMinimized = false
  window._practiceClipToken = (window._practiceClipToken || 0) + 1
  if (window._practiceClipTimer) { clearInterval(window._practiceClipTimer); window._practiceClipTimer = null }
  try { _stopManualAudioPreview() } catch (_) {}
  if (window.visualViewport && window._practiceViewportWired) {
    window.visualViewport.removeEventListener('resize', _onPracticeViewportChange)
    window.visualViewport.removeEventListener('scroll', _onPracticeViewportChange)
    window._practiceViewportWired = false
  }
  $('body').removeClass('practice-mode')
  $('#practiceMode').remove()
  // Restore normal playback rate — a practice slowdown shouldn't bleed into
  // regular search-result / recording playback after the session ends.
  try { window.ytPlayer && window.ytPlayer.setPlaybackRate && window.ytPlayer.setPlaybackRate(1) } catch (_) {}
  try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
  $('#toggleMediaContainer').click() 
}
window.closePracticeMode = closePracticeMode

function practiceNav(dir) {
  if (!window._practiceActive || !window._practiceCards || !window._practiceCards.length) return
  const n = window._practiceCards.length
  window._practiceIdx = (window._practiceIdx + dir + n) % n
  // A new card is a fresh attempt — drop any per-card overrides so the user
  // isn't surprised by half-speed playback or extra context lines that were
  // meant for the previous card.
  window._practiceCtxBefore = 0
  window._practiceCtxAfter = 0
  window._practicePlaybackRate = 1
  window._practiceFlipped = false
  _renderPracticeCard()
}

// Cycle playback speed for the practice clip. The button label reflects the
// active rate; the rate is applied next time .practice-play is hit.
const PRACTICE_SPEED_OPTIONS = [0.75, 1]
function cyclePracticePlaybackRate() {
  const cur = parseFloat(window._practicePlaybackRate) || 1
  const i = PRACTICE_SPEED_OPTIONS.indexOf(cur)
  const next = PRACTICE_SPEED_OPTIONS[(i + 1) % PRACTICE_SPEED_OPTIONS.length]
  window._practicePlaybackRate = next
  _updatePracticeSpeedBtn()
  // If the clip is currently playing, apply the new rate immediately.
  try {
    if (window._practiceClipTimer && window.ytPlayer && window.ytPlayer.setPlaybackRate) {
      window.ytPlayer.setPlaybackRate(next)
    }
  } catch (_) {}
}
function _updatePracticeSpeedBtn() {
  const r = parseFloat(window._practicePlaybackRate) || 1
  $('#practiceMode .practice-speed').text(`${r}×`)
}

// Collapse the practice UI to a tiny pill so the user can interact with the
// page underneath without losing position. The restore pill is shown in its
// place; everything else (topbar, card, nav, pinned YT player, hidden main
// UI) is taken down until restored.
//
// Dropping body.practice-mode is what gives the main view back — that class
// is what (a) pins the YT player to the top of the viewport, (b) hides
// #mainControlInputs / #vocabularyResult / #result / #mediaRelatedContainer.
// Pause the clip too so audio doesn't keep playing while the user is doing
// something else.
function minimizePracticeMode() {
  if (!window._practiceActive) return
  window._practiceMinimized = true
  $('#practiceMode').addClass('minimized')
  $('body').removeClass('practice-mode')
  // Cancel any running stop-watcher so it doesn't fire on the restored clip
  // with stale state, and pause the player.
  window._practiceClipToken = (window._practiceClipToken || 0) + 1
  if (window._practiceClipTimer) { clearInterval(window._practiceClipTimer); window._practiceClipTimer = null }
  try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
  _updatePracticeRestoreCount()
  $('#toggleMediaContainer').click()  
}
function restorePracticeMode() {
  window._practiceMinimized = false
  $('#practiceMode').removeClass('minimized')
  $('body').addClass('practice-mode')
  // Re-cue the current card's video so playback is ready when the user hits
  // Play (the practice-mode class flip above re-pins the YT player; we want
  // it parked at the right timestamp again).
  const it = (window._practiceCards || [])[window._practiceIdx]
  if (it) { try { _cuePracticeVideo(it) } catch (_) {} }
}
function _updatePracticeRestoreCount() {
  const cards = window._practiceCards || []
  $('#practiceMode .practice-restore-count').text(`${(window._practiceIdx || 0) + 1}/${cards.length}`)
}
window.minimizePracticeMode = minimizePracticeMode
window.restorePracticeMode = restorePracticeMode
window.cyclePracticePlaybackRate = cyclePracticePlaybackRate

// Push the practice card and bottom nav above the on-screen keyboard while it
// is open. The visualViewport API reports the viewport size MINUS the
// keyboard, so the difference vs window.innerHeight is the keyboard's
// height — we use that to bump the card's `bottom` value.
function _onPracticeViewportChange() {
  if (!window._practiceActive) return
  const vv = window.visualViewport
  if (!vv) return
  const keyboard = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  const $p = $('#practiceMode')
  // Only act when the keyboard is clearly open (browser chrome alone usually
  // accounts for ≤ 60px of inset). Otherwise restore the defaults.
  const open = keyboard > 80
  const liftCard = open ? (keyboard + 16) + 'px' : ''
  const liftNav  = open ? (keyboard + 8)  + 'px' : ''
  $p.find('.practice-card').css('bottom', liftCard)
  $p.find('.practice-nav').css('bottom', liftNav)
}
window._onPracticeViewportChange = _onPracticeViewportChange
// Delete the card currently shown in practice from its source playlist.
// Removes the matching item via _removeQueueItem (so virtual playlists and
// loop='all' cross-playlist queues all work), drops it from the live
// practice queue, and advances to the next card (or closes practice if the
// queue is now empty). For manual cards with an attached local audio
// recording (mediaUrl=file://…), deletes the underlying audio file via the
// AudioBridge so it doesn't leak in the host app's storage. Playlist-side
// SRT/index files are NOT touched — those are managed via the Manage
// dialogs, not by card removal.
function _deleteCurrentPracticeCard() {
  const cards = window._practiceCards
  const idx = window._practiceIdx
  if (!Array.isArray(cards) || idx < 0 || idx >= cards.length) return
  const it = cards[idx]
  if (!it || !it._recName) return
  const isManual = !!it.manual
  const label = isManual
    ? `"${(it.source || '').slice(0, 40)}${(it.source || '').length > 40 ? '…' : ''}"`
    : `${it.id} @ ${it.timeStart}s–${it.timeEnd}s`
  if (!confirm(`Delete this card (${label}) from "${it._recName}"?\n\nThis cannot be undone from the UI.`)) return
  // Capture the local-audio URL BEFORE removing the item — _removeQueueItem
  // mutates the playlist, after which we couldn't tell whether the deleted
  // card had its own audio. Only act on file:// urls; YouTube / generic
  // links don't have a local-storage counterpart to clean up.
  const audioUrl = (isManual && it.mediaUrl && _isAudioMediaUrl(it.mediaUrl)) ? it.mediaUrl : null
  const ok = _removeQueueItem(it)
  if (!ok) { alert('Could not delete — the item is no longer in the playlist (maybe already removed).'); return }
  if (audioUrl) {
    deleteManualAudio(audioUrl).catch(e => console.warn('deleteManualAudio failed for', audioUrl, e))
  }
  // Drop from the in-memory queue too, then re-render. If we deleted the
  // last card, fall back one position so we don't render an empty slot.
  cards.splice(idx, 1)
  if (!cards.length) { closePracticeMode(); return }
  if (window._practiceIdx >= cards.length) window._practiceIdx = cards.length - 1
  // Reset per-card overrides like practiceNav does, since we're effectively
  // showing a fresh card.
  window._practiceCtxBefore = 0
  window._practiceCtxAfter = 0
  window._practicePlaybackRate = 1
  window._practiceFlipped = false
  _renderPracticeCard()
}

// Reflect the current recPlayShuffle state on the practice top-bar button.
function _refreshPracticeShuffleBtn() {
  const $btn = $('#practiceMode').find('.practice-shuffle')
  if (!$btn.length) return
  const on = !!(window._appSettings && window._appSettings.recPlayShuffle)
  $btn.toggleClass('active', on).attr('aria-pressed', on ? 'true' : 'false')
    .attr('title', on ? 'Shuffle: on (tap to restore order)' : 'Shuffle: off (tap to randomise)')
}

// Toggle shuffle for the practice queue — flips the same recPlayShuffle
// setting the player overlay uses, then re-derives the queue in the new
// order. Preserves the currently visible card's identity so the user
// doesn't get teleported to a different one when toggling.
function _togglePracticeShuffle() {
  if (!window._appSettings) window._appSettings = {}
  const next = !window._appSettings.recPlayShuffle
  window._appSettings.recPlayShuffle = next
  try { saveAppSettings() } catch (_) {}
  if (window._practiceActive && Array.isArray(window._practiceCards) && window._practiceCards.length) {
    const cur = window._practiceCards[window._practiceIdx] || null
    // Rebuild from the playlist in natural order, then shuffle if enabled.
    // This restores order when shuffle is being turned OFF.
    const fresh = _buildPlayQueue('off')
    if (next) _shuffleQueue(fresh)
    if (fresh.length) {
      const newIdx = cur
        ? fresh.findIndex(q => q && q._recName === cur._recName && q._st === cur._st && q._w === cur._w && q._idx === cur._idx)
        : 0
      window._practiceCards = fresh
      window._practiceIdx = Math.max(0, newIdx)
      try { _saveQueueOrder(fresh, 'practice') } catch (_) {}
      try { _renderPracticeCard() } catch (_) {}
    }
  }
  _refreshPracticeShuffleBtn()
}

function _togglePracticeInfoPanel() {
  const $p = $('#practiceMode')
  const $panel = $p.find('.practice-info-panel')
  const $btn = $p.find('.practice-info')
  const open = !$panel.is(':visible')
  $panel.toggle(open)
  $btn.attr('aria-expanded', open ? 'true' : 'false').toggleClass('active', open)
  if (open) {
    // Two slide-down panels share the same topbar — close the other one
    // so they don't stack and eat the card area on small screens.
    $p.find('.practice-settings-panel').hide()
    $p.find('.practice-settings').attr('aria-expanded', 'false').removeClass('active')
    _updatePracticeInfo()
  }
}
function _togglePracticeSettingsPanel() {
  const $p = $('#practiceMode')
  const $panel = $p.find('.practice-settings-panel')
  const $btn = $p.find('.practice-settings')
  const open = !$panel.is(':visible')
  $panel.toggle(open)
  $btn.attr('aria-expanded', open ? 'true' : 'false').toggleClass('active', open)
  if (open) {
    // Close the sibling info panel; seed the reveal select with current setting.
    $p.find('.practice-info-panel').hide()
    $p.find('.practice-info').attr('aria-expanded', 'false').removeClass('active')
    const mode = (window._appSettings && window._appSettings.practiceRevealMode) || 'flip'
    $panel.find('.practice-reveal-select').val(mode)
  }
}

// Populate the practice info panel with the current card's metadata —
// mirrors what the play-mode banner shows so the user always knows where
// the current item came from (recording name, video id + timestamps for
// captured clips, source/target + media link for manual cards).
function _updatePracticeInfo() {
  const $p = $('#practiceMode')
  if (!$p.length) return
  const cards = window._practiceCards || []
  const it = cards[window._practiceIdx]
  if (!it) return
  const $head = $p.find('.practice-info-head')
  const $meta = $p.find('.practice-info-meta')
  if (it.manual) {
    const linkLbl = it.mediaUrl ? ` · ${it.mediaKind === 'youtube' ? '▶ YouTube' : '🔗 link'}` : ''
    $head.text(`📝 Manual — ${it._recName || '?'}`)
    $meta.text(`${it.source || '(empty)'}  →  ${it.target || '(empty)'}${linkLbl}`)
  } else {
    $head.text(`${it._recName || '?'} — "${it._st || ''}" → ${it._w || ''}`)
    $meta.text(`${it.id} · ${it.source || '?'} · ${it.timeStart}s – ${it.timeEnd}s`)
  }
}

function togglePracticeDir() {
  window._practiceFrontIsSource = !window._practiceFrontIsSource
  // Persist so the next session opens with the user's preferred direction.
  if (window._appSettings) {
    window._appSettings.practiceFrontIsSource = window._practiceFrontIsSource
    try { saveAppSettings() } catch (_) {}
  }
  _renderPracticeCard()
}
function revealPracticeCard() {
  const $p = $('#practiceMode')
  const mode = (window._appSettings && window._appSettings.practiceRevealMode) || 'flip'
  // In target→source mode the word itself is the answer (hidden until
  // reveal). Once revealed, show it — for any reveal mode.
  if (!window._practiceFrontIsSource) $p.find('.practice-word').css('visibility', 'visible')
  if (mode === 'flip') {
    // Toggle the flip-state — same handler is wired to .practice-unflip,
    // so a click on either side rotates the card back/forth.
    window._practiceFlipped = !window._practiceFlipped
    $p.find('.practice-flipper').toggleClass('flipped', !!window._practiceFlipped)
    return
  }
  // 'hide' (and the legacy fallback): reveal-below behaviour.
  $p.find('.practice-back').show()
  $p.find('.practice-reveal').hide()
}
// Where the practice clip should stop: the END of the subtitle line *after*
// the shown one (i+1), so the clip plays one line past what's displayed. Falls
// back to the shown line's own end, then to the item's timeEnd. Times are in
// seconds (SRT ordinals).
async function _practiceClipStopTime(it) {
  let stop = (typeof it.timeEnd === 'number') ? it.timeEnd : (it.timeStart + 4)
  try {
    const parsed = await _loadSubtitlesForItem(it)
    const src = (parsed && parsed.sv) || []
    const want = String(it.lineIndex)
    const pos = src.findIndex(x => x && x.index != null && String(x.index) === want)
    if (pos >= 0) {
      const next = src[pos + 1]
      const endOf = l => (l && l.end && typeof l.end.ordinal === 'number') ? l.end.ordinal : null
      const e = endOf(next) != null ? endOf(next) : endOf(src[pos])
      if (e != null) stop = e
    }
  } catch (err) { console.warn('practice: stop-time resolve failed', err) }
  return stop
}

// Poll the YouTube playhead and pause once it passes `stop`. Practice mode runs
// with syncSubtitle=false, so the global ontimeupdate interval-stopper is
// inactive — this is the practice-specific equivalent. Cancelled when a newer
// clip starts, the card changes, or practice closes (via the token).
function _watchPracticeClipEnd(stop, token) {
  if (window._practiceClipTimer) { clearInterval(window._practiceClipTimer); window._practiceClipTimer = null }
  window._practiceClipTimer = setInterval(() => {
    if (!window._practiceActive || token !== window._practiceClipToken) {
      clearInterval(window._practiceClipTimer); window._practiceClipTimer = null
      return
    }
    let ct = 0
    try { ct = (window.ytPlayer && window.ytPlayer.getCurrentTime && window.ytPlayer.getCurrentTime()) || 0 } catch (_) {}
    if (ct >= stop) {
      try { window.ytPlayer && window.ytPlayer.pauseVideo && window.ytPlayer.pauseVideo() } catch (_) {}
      clearInterval(window._practiceClipTimer); window._practiceClipTimer = null
    }
  }, 150)
}

async function playPracticeClip() {
  const idx = window._practiceIdx
  const it = window._practiceCards && window._practiceCards[idx]
  if (!it) return
  // Each clip gets a token so a stale stop-watcher (or a card switch mid-load)
  // can't pause a later clip.
  const token = (window._practiceClipToken = (window._practiceClipToken || 0) + 1)
  try {
    const stop = await _practiceClipStopTime(it)
    if (window._practiceIdx !== idx || token !== window._practiceClipToken) return
    // The cue normally already loaded the right video; reload only if needed.
    let needLoad = true
    try { needLoad = !window.ytPlayer || (window.ytPlayer.getVideoUrl() || '').indexOf(it.id) < 0 } catch (_) {}
    if (needLoad) {
      window.mediaSelected = { link: it.id, source: 'link' }
      await changeMediaIfNeededTo(window.mediaSelected)
    }
    await seekToYoutubeTime(it.timeStart)
    if (window._practiceIdx !== idx || token !== window._practiceClipToken) return
    // Apply the user's chosen playback rate just before play — must happen
    // AFTER the video has been loaded/seeked, else YT silently snaps it
    // back to 1× when the new video kicks in.
    const rate = parseFloat(window._practicePlaybackRate) || 1
    try { window.ytPlayer && window.ytPlayer.setPlaybackRate && window.ytPlayer.setPlaybackRate(rate) } catch (_) {}
    try { window.ytPlayer && window.ytPlayer.playVideo && window.ytPlayer.playVideo() } catch (_) {}
    _watchPracticeClipEnd(stop, token)
  } catch (e) { console.warn('practice: play failed', e) }
}

// Render the front/back as a column of subtitle lines (matched ± context).
// Each line carries data so the inline editor can target the right SRT line.
// `highlightWord` is the captured word for this card; the source side runs
// through the word highlighter on EVERY row (not just the match), so a
// phrase split across SRT rows still lights up on both halves. The target
// side stays plain since it's a translation and won't generally contain the
// source word verbatim.
function _practiceRenderLines($container, rows, langKey, highlightWord) {
  $container.empty()
  // Pre-scan source texts so per-token fallback is suppressed when the
  // whole phrase appears on any row — keeps a multi-word "x y z" from
  // also lighting up standalone parts on neighbouring rows. Token
  // fallback still kicks in when the phrase is genuinely split across
  // rows (= absent from every single row).
  const sourceTexts = (langKey === 'source' && highlightWord)
    ? rows.map(r => (r.source || ''))
    : []
  const allowTokens = (langKey === 'source' && highlightWord)
    ? !_phraseFoundInTexts(sourceTexts, highlightWord)
    : false
  rows.forEach(r => {
    const text = (langKey === 'source') ? r.source : r.target
    const $row = $(`<div class="practice-line${r.isMatch ? ' practice-line-match' : ''}" data-line-index="${r.lineIndex}"></div>`)
    const $text = $('<span class="practice-line-text"></span>')
    if (langKey === 'source' && highlightWord) {
      $text.html(_highlightWordHtml(text || '(empty)', highlightWord, { allowTokens }))
    } else {
      $text.text(text || '(empty)')
    }
    $row.append($text)
    $row.append($(`<button type="button" class="practice-line-edit" title="Edit this line" data-lang="${langKey === 'source' ? 'src' : 'en'}" data-line-index="${r.lineIndex}">✎</button>`))
    $container.append($row)
  })
}

async function _renderPracticeCard() {
  const $p = $('#practiceMode')
  if (!$p.length) return
  // Switching cards invalidates any running clip stop-watcher so it can't pause
  // the freshly-cued clip.
  window._practiceClipToken = (window._practiceClipToken || 0) + 1
  if (window._practiceClipTimer) { clearInterval(window._practiceClipTimer); window._practiceClipTimer = null }
  // Any manual-audio preview is tied to the *previous* card's media-link
  // button (which is about to be removed and rebuilt). Stop it so the clip
  // doesn't keep playing under the new card.
  try { _stopManualAudioPreview() } catch (_) {}
  const idx = window._practiceIdx
  const cards = window._practiceCards || []
  const it = cards[idx]
  if (!it) return
  // Persist resume-target on every card change. Mode='practice' so the
  // next Play All / Practice click on this playlist offers to resume here.
  // `idx` advances queuePos so the saved queue tracks where we are.
  try { _setLastPlayed(it, 'practice', idx) } catch (_) {}
  // Keep the info panel in sync as the user navigates cards, if it's open.
  if ($p.find('.practice-info-panel').is(':visible')) _updatePracticeInfo()
  const srcCode = ((typeof getLangFromUrl === 'function' && getLangFromUrl().code) || 'sv').toUpperCase()
  const frontIsSource = window._practiceFrontIsSource
  const mode = (window._appSettings && window._appSettings.practiceRevealMode) || 'flip'
  // Manual card branch: no SRT, no clip — just render source/target text
  // and surface an optional media link. Reuses the same flip/hide/both
  // reveal modes and the same .practice-front / .practice-back faces.
  if (_isManualItem(it)) {
    _renderPracticeManualCard($p, it, idx, cards.length, frontIsSource, mode, srcCode)
    return
  }
  // Video card path follows — first restore any controls the manual path hides.
  $p.find('.practice-ctx-ctrl').show()
  $p.find('.practice-play, .practice-speed').show()
  $p.find('.practice-media-link').remove()
  $p.find('.practice-count').text(`${idx + 1}/${cards.length}`)
  $p.find('.practice-dir').text(frontIsSource ? `${srcCode} → EN` : `EN → ${srcCode}`)
  // Word: shown upfront only when the front IS the source (you see source
  // text and recall its meaning). In target→source mode the word is the
  // thing to recall, so hide it until Reveal.
  const $word = $p.find('.practice-word').text(it.word || '')
  $word.css('visibility', frontIsSource ? 'visible' : 'hidden')
  $p.find('.practice-front').html('<div class="practice-loading">Loading…</div>')
  $p.find('.practice-back').hide().empty()
  $p.find('.practice-back-target').empty()
  $p.find('.practice-reveal').show()
  // Reset the flip-state for a freshly rendered card (practiceNav also
  // zeroes _practiceFlipped, but a dir-toggle / setting change also re-renders).
  $p.find('.practice-flipper').toggleClass('flipped', !!window._practiceFlipped)
  // Reveal mode shapes the card:
  //   'both' — no Reveal button, back shown beside front always
  //   'flip' — Reveal button toggles a 3D rotateY; back-face content is the target
  //   'hide' — legacy behaviour: back hidden until Reveal click
  $p.removeClass('reveal-flip reveal-both reveal-hide').addClass(`reveal-${mode}`)
  if (mode === 'both') $p.find('.practice-reveal').hide()
  $p.data('item', it)
  _updatePracticeSpeedBtn()
  _updatePracticeRestoreCount()

  // Cue the clip (paused — it must NOT auto-play in practice mode).
  _cuePracticeVideo(it)

  const rows = await _practiceCardLines(it, window._practiceCtxBefore || 0, window._practiceCtxAfter || 0)
  if (window._practiceIdx !== idx) return   // user moved on while we awaited
  if (!rows || !rows.length) {
    $p.find('.practice-front').html('<div class="practice-loading">(subtitle text unavailable)</div>')
    return
  }
  _practiceRenderLines($p.find('.practice-front'), rows, frontIsSource ? 'source' : 'target', it.word)
  // 'both' renders the target right below the front (inside the front-face);
  // 'hide' uses the same .practice-back div but keeps it hidden until reveal;
  // 'flip' also fills .practice-back as a fallback AND fills the back-face.
  _practiceRenderLines($p.find('.practice-back'),  rows, frontIsSource ? 'target' : 'source', it.word)
  _practiceRenderLines($p.find('.practice-back-target'), rows, frontIsSource ? 'target' : 'source', it.word)
  if (mode === 'both') $p.find('.practice-back').show()
}

// Render a manual flashcard into the existing practice DOM. Same flip/hide
// /both reveal modes as a video card — the difference is the content is
// the user-typed source/target text and there's no clip / SRT lookup.
function _renderPracticeManualCard($p, it, idx, total, frontIsSource, mode, srcCode) {
  // Hide controls that only apply to video clips. Removed when the next
  // (video) card renders by the restore-block at the top of _renderPracticeCard.
  $p.find('.practice-ctx-ctrl').hide()
  $p.find('.practice-play, .practice-speed').hide()

  const frontText = frontIsSource ? (it.source || '') : (it.target || '')
  const backText  = frontIsSource ? (it.target || '') : (it.source || '')
  $p.find('.practice-count').text(`${idx + 1}/${total}`)
  $p.find('.practice-dir').text(frontIsSource ? `${srcCode} → EN` : `EN → ${srcCode}`)
  // The "word" slot becomes a manual badge so the user can see at a glance
  // that this is a typed card vs a captured clip.
  $p.find('.practice-word').text('📝 manual').css('visibility', 'visible')

  const $front = $p.find('.practice-front').empty()
  $front.append($('<div class="practice-manual-text"></div>').text(frontText || '(empty)'))
  const $back  = $p.find('.practice-back').hide().empty()
  $back.append($('<div class="practice-manual-text"></div>').text(backText || '(empty)'))
  const $backFace = $p.find('.practice-back-target').empty()
  $backFace.append($('<div class="practice-manual-text"></div>').text(backText || '(empty)'))

  // Optional media link — YouTube cues in the embedded player, anything
  // else opens in a new tab. Appended to the practice-nav row so it sits
  // alongside prev/next where the hidden play-clip button used to be.
  $p.find('.practice-media-link').remove()
  if (it.mediaUrl) {
    const isYT    = it.mediaKind === 'youtube' && it.mediaVideoId
    const isAudio = it.mediaKind === 'audio' || _isAudioMediaUrl(it.mediaUrl)
    const icon    = isYT ? '▶' : (isAudio ? '🎙' : '🔗')
    const title   = isYT    ? 'Play the linked YouTube video'
                  : isAudio ? 'Play the recorded audio'
                  : 'Open the linked media in a new tab'
    const $btn = $(`<button type="button" class="practice-media-link" title="${title}" aria-label="Open linked media">${icon}</button>`)
    $btn.on('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      if (isYT) {
        // Cue into the embedded player at t=0. Don't auto-play (Practice
        // mode is for studying — the user clicks again to play).
        window.mediaSelected = { link: it.mediaVideoId, source: 'link' }
        try { changeMediaIfNeededTo(window.mediaSelected) } catch (_) {}
      } else if (isAudio) {
        // Bridge-loaded preview with toggle: click while playing stops it;
        // navigating away or closing Practice also stops it.
        _startManualAudioPreview(it.mediaUrl, $btn)
      } else {
        window.open(it.mediaUrl, '_blank', 'noopener')
      }
    })
    $p.find('.practice-nav .practice-play').after($btn)
  }

  $p.find('.practice-reveal').show()
  $p.find('.practice-flipper').toggleClass('flipped', !!window._practiceFlipped)
  $p.removeClass('reveal-flip reveal-both reveal-hide').addClass(`reveal-${mode}`)
  if (mode === 'both') { $p.find('.practice-back').show(); $p.find('.practice-reveal').hide() }
  $p.data('item', it)
  _updatePracticeSpeedBtn()
  _updatePracticeRestoreCount()
}

// Open a jQuery UI dialog to edit a practice line. Centred on the viewport
// (and lifted by a small open-callback so the on-screen keyboard, when it
// pops, leaves the textarea visible) — replaces the previous inline
// edit-box that got covered by the keyboard on mobile.
function _practiceBeginEdit(e) {
  e.preventDefault(); e.stopPropagation()
  const $btn = $(this)
  const $row = $btn.closest('.practice-line')
  const cur = $row.find('.practice-line-text').text()
  const lang = $btn.attr('data-lang')          // 'src' | 'en'
  const lineIndex = $btn.attr('data-line-index')

  // Build (or reuse) the dialog node — jQuery UI mutates the element into
  // an `ui-dialog-content`, so we want to keep the same element across edits.
  let $dlg = $('#practiceLineEditDialog')
  if (!$dlg.length) {
    $dlg = $(`<div id="practiceLineEditDialog" title="Edit line" style="display:none;">
        <div class="practice-edit-meta"></div>
        <textarea class="practice-edit-input" rows="3"></textarea>
      </div>`).appendTo('body')
  }
  $dlg.data('lang', lang).data('lineIndex', lineIndex)
  $dlg.find('.practice-edit-meta').text(`#${lineIndex}  ·  ${lang === 'en' ? 'EN' : 'source'}`)
  $dlg.find('.practice-edit-input').val(cur === '(empty)' ? '' : cur)

  const opts = {
    width:  Math.min(560, Math.round(window.innerWidth * 0.95)),
    modal:  false,
    // Top-anchored so the dialog sits well above the on-screen keyboard
    // on mobile. visualViewport adjusts in _onPracticeViewportChange too,
    // but the explicit position prevents the dialog from centring into
    // the keyboard's footprint in the first place.
    position: { my: 'center top', at: 'center top+12%', of: window },
    buttons: {
      'Save':   _practiceCommitEdit,
      'Cancel': function () { try { $(this).dialog('close') } catch (_) {} }
    },
    open: function () {
      // #practiceMode sits at z-index 100002 (and its topbar/nav at 100004);
      // jQuery UI dialogs default to ~100. Triple-belt the lift:
      //   (1) move the wrapper to the END of <body> so it's last in paint
      //       order — sidesteps any nested stacking-context confusion.
      //   (2) add a class with `!important` z-index in CSS (wins over inline).
      //   (3) also stamp inline z-index with setProperty(..., 'important') in
      //       case the stylesheet isn't loaded yet on first open.
      const $w = $(this).closest('.ui-dialog')
      $w.appendTo('body').addClass('above-practice-mode')
      const el = $w[0]
      if (el) el.style.setProperty('z-index', '100020', 'important')
      // Focus the textarea after the dialog is fully rendered so the keyboard
      // raises predictably; place the cursor at end of existing text.
      setTimeout(() => {
        const ta = $(this).find('.practice-edit-input').focus()[0]
        if (ta) try { ta.setSelectionRange(ta.value.length, ta.value.length) } catch (_) {}
      }, 50)
    }
  }
  if ($dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog('option', opts).dialog('open')
  } else {
    $dlg.dialog(opts)
  }
}

// Commit the dialog-edited line — buffers via _saveSubtitleEdit (queued for
// the next Sync push) and re-renders the practice card with the new text.
async function _practiceCommitEdit() {
  const $dlg = $('#practiceLineEditDialog')
  if (!$dlg.length) return
  const lang = $dlg.data('lang') === 'en' ? 'en' : (getLangFromUrl().code || 'sv')
  const lineIndex = $dlg.data('lineIndex')
  const newText = String($dlg.find('.practice-edit-input').val() || '').trim()
  const it = $('#practiceMode').data('item')
  if (!it || !newText) { try { $dlg.dialog('close') } catch (_) {} ; _renderPracticeCard(); return }
  // Disable the dialog's Save button while the optimistic write runs.
  const $saveBtn = $dlg.dialog('widget').find('.ui-dialog-buttonpane button:contains("Save")')
  $saveBtn.prop('disabled', true).text('Saving…')
  try {
    await _saveSubtitleEdit(it.id, lang, lineIndex, newText)
  } catch (err) {
    console.error('practice: save edit failed', err)
    alert('Failed to save: ' + (err && err.message || err))
  }
  $saveBtn.prop('disabled', false).text('Save')
  try { $dlg.dialog('close') } catch (_) {}
  _renderPracticeCard()
}

async function _cuePracticeVideo(it) {
  try {
    showMediaContainer()
    window.mediaSelected = { link: it.id, source: 'link' }
    window.playingYoutubeVideo = true
    window.syncSubtitle = false
    let needLoad = true
    try { needLoad = !window.ytPlayer || (window.ytPlayer.getVideoUrl() || '').indexOf(it.id) < 0 } catch (_) {}
    if (needLoad) await changeMediaIfNeededTo(window.mediaSelected)
    await seekToYoutubeTime(it.timeStart)
    // Pause insistently so the cued clip doesn't run on its own.
    try { window.ytPlayer.pauseVideo() } catch (_) {}
    setTimeout(() => { try { window.ytPlayer.pauseVideo() } catch (_) {} }, 120)
  } catch (e) { console.warn('practice: cue video failed', e) }
}

// Matched line ± context, in both languages, keyed off the source SRT
// (whose line index is what the recorder stamps as item.lineIndex).
async function _practiceCardLines(it, before, after) {
  const parsed = await _loadSubtitlesForItem(it)
  if (!parsed) return null
  const src = parsed.sv || []
  const tgt = parsed.en || []
  const tgtById = new Map()
  tgt.forEach(s => { if (s && s.index != null) tgtById.set(String(s.index), s) })
  const want = String(it.lineIndex)
  const matchPos = src.findIndex(x => x && x.index != null && String(x.index) === want)
  if (matchPos < 0) return null
  const from = Math.max(0, matchPos - (before || 0))
  const to   = Math.min(src.length - 1, matchPos + (after || 0))
  const rows = []
  for (let i = from; i <= to; i++) {
    const line = src[i]
    const li = line.index
    const sec = tgtById.get(String(li))
    rows.push({
      lineIndex: li,
      isMatch: i === matchPos,
      source: String(line.text || '').trim(),
      target: sec ? String(sec.text || '').trim() : ''
    })
  }
  return rows
}

// Keyboard: arrows navigate, R reveals, Esc closes — only while practicing
// and not while typing in the inline editor.
$(document).on('keydown', function (e) {
  if (!window._practiceActive) return
  const tag = (e.target && e.target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  if (e.key === 'Escape')          { e.preventDefault(); closePracticeMode() }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); practiceNav(-1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); practiceNav(1) }
  else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); revealPracticeCard() }
})

// Delegated handlers — wired once at document ready below.
$(document).on('click', '#recStartBtn',  startRecording)
$(document).on('click', '#recPauseBtn',  pauseRecording)
$(document).on('click', '#recResumeBtn', resumeRecording)
$(document).on('click', '#recStopBtn',   stopRecording)
$(document).on('click', '#recReviewBtn', openRecordingReviewDialog)
$(document).on('click', '.capture-btn', function (e) {
  e.preventDefault()
  e.stopPropagation()
  _captureMatchFromButton($(this))
})

// ── Inline subtitle line edit ────────────────────────────────────────────
// Pencil icon next to each main/secondary line opens a textarea + Save/Cancel.
// Save commits the edited line back to the matching SRT on gh-pages via
// _saveSubtitleEdit, then re-renders the .line content in place.
$(document).on('click', '.edit-line-btn', function (e) {
  e.preventDefault(); e.stopPropagation()
  const $line = $(this).closest('.line')
  if (!$line.length || $line.hasClass('editing')) return
  const link      = $line.attr('data-url') || ''
  const langCode  = $line.attr('data-lang-code') || 'sv'
  const lineIndex = $line.attr('data-line-index') || ''
  if (!link || !lineIndex) { alert('Cannot edit — missing line metadata.'); return }
  const raw = _getRawSubtitleLineText(link, langCode, lineIndex)
  // Stash the existing HTML so Cancel can restore (highlights survive).
  const $textSpan = $line.find('.line-text')
  $line.data('prevHtml', $textSpan.html())
  $line.addClass('editing')
  const lines = (raw.match(/\n/g) || []).length + 1
  $textSpan.html(
    `<textarea class="edit-line-input" rows="${Math.max(2, Math.min(6, lines))}">${_.escape(raw)}</textarea>` +
    `<span class="edit-line-actions">
       <button type="button" class="btn edit-line-save"   title="Save (Ctrl+Enter)">Save</button>
       <button type="button" class="btn edit-line-cancel" title="Cancel (Esc)">Cancel</button>
     </span>`
  )
  const $ta = $line.find('.edit-line-input').focus()
  // Place caret at the end on focus
  const tlen = $ta.val().length
  try { $ta[0].setSelectionRange(tlen, tlen) } catch (_) {}
})

$(document).on('click', '.edit-line-cancel', function (e) {
  e.preventDefault(); e.stopPropagation()
  const $line = $(this).closest('.line')
  const prev = $line.data('prevHtml')
  if (prev != null) $line.find('.line-text').html(prev)
  $line.removeClass('editing')
})

$(document).on('click', '.edit-line-save', async function (e) {
  e.preventDefault(); e.stopPropagation()
  const $btn = $(this)
  if ($btn.prop('disabled')) return
  const $line = $btn.closest('.line')
  const link      = $line.attr('data-url') || ''
  const langCode  = $line.attr('data-lang-code') || 'sv'
  const lineIndex = $line.attr('data-line-index') || ''
  const $ta = $line.find('.edit-line-input')
  const newText = String($ta.val() || '').trim()
  if (!newText) { alert('Text cannot be empty.'); return }
  $btn.prop('disabled', true).text('Saving…')
  try {
    await _saveSubtitleEdit(link, langCode, lineIndex, newText)
    // Replace the editor with the (escaped) plain text. Highlights are gone
    // on the just-edited line — they'll come back on the next search render.
    $line.find('.line-text').text(newText)
    $line.removeClass('editing')
  } catch (err) {
    console.error('save subtitle edit failed', err)
    alert('Failed to save: ' + (err && err.message || err))
    $btn.prop('disabled', false).text('Save')
  }
})

// Keyboard shortcuts inside the inline editor.
$(document).on('keydown', '.edit-line-input', function (e) {
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation()
    $(this).closest('.line').find('.edit-line-cancel').click()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation()
    $(this).closest('.line').find('.edit-line-save').click()
  }
})

// ESC stops playback; Space toggles pause. Only active when playback is on,
// and Space is ignored while focus is in a text input so the user can still
// type in dialogs that happen to be open.
$(document).on('keydown', function (e) {
  if (!window._playingRecording) return
  if (e.key === 'Escape') {
    e.preventDefault()
    stopPlayingRecording()
    return
  }
  if (e.key === ' ' || e.code === 'Space') {
    const tag = (e.target && e.target.tagName || '').toLowerCase()
    const editable = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)
    if (editable) return
    e.preventDefault()
    togglePlayingRecordingPause()
  }
  // Arrow keys also navigate when playback is on (handy on desktop).
  if (e.key === 'ArrowLeft') {
    const tag = (e.target && e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea') return
    e.preventDefault()
    navigateRecordingPlayback('prev')
  } else if (e.key === 'ArrowRight') {
    const tag = (e.target && e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea') return
    e.preventDefault()
    navigateRecordingPlayback('next')
  }
})

// External media keys (Bluetooth headset, OS media controls, the host
// webview's hardware keys) dispatch a `cupitorMediaKey` CustomEvent with
// detail.key ∈ {'previous', 'next', 'play_pause'}. Wiring them through
// the same navigation/pause path keeps the inline-script contract from
// language.html honoured.
window.addEventListener('cupitorMediaKey', function (ev) {
  if (!ev || !ev.detail) return
  switch (ev.detail.key) {
    case 'previous':
      if (typeof ev.preventDefault === 'function') ev.preventDefault()
      navigateRecordingPlayback('prev')
      break
    case 'next':
      if (typeof ev.preventDefault === 'function') ev.preventDefault()
      navigateRecordingPlayback('next')
      break
    case 'play_pause':
      if (typeof ev.preventDefault === 'function') ev.preventDefault()
      togglePlayingRecordingPause()
      break
  }
})

$(function () {
  _loadRecording()
  // Restore dirty marker so a page refresh after a local edit still shows
  // the Sync* indicator until the user actually pushes.
  try { window._recordingsDirty = localStorage.getItem(REC_DIRTY_KEY) === '1' } catch (_) {}
  _updateRecordingUI()
  // Merge whatever's on GitHub into local — bring in playlists captured
  // from another device. Fire-and-forget; failures are logged.
  _mergeRemoteRecordingsIntoLocal().catch(e => console.warn('merge remote recordings failed', e))
})

// Expose functions that are called from inline HTML onclick/onchange handlers.
// Required because this file is loaded as type="module" which is scoped by default.
// Inline <script> in language.html (onPlayerReady) calls seekToYoutubeTime
// when window.youtubePlayInterval is set at the moment the YT player
// becomes ready — but this file is loaded as type="module", so module-
// scoped function refs are invisible to inline handlers. Bridge it here.
window.seekToYoutubeTime        = seekToYoutubeTime
window.startRecording           = startRecording
window.pauseRecording           = pauseRecording
window.resumeRecording          = resumeRecording
window.stopRecording            = stopRecording
window.clearRecording           = clearRecording
window.openRecordingReviewDialog= openRecordingReviewDialog
window.playRecording            = playRecording
window.stopPlayingRecording     = stopPlayingRecording
window.togglePlayingRecordingPause = togglePlayingRecordingPause
window.navigateRecordingPlayback = navigateRecordingPlayback
window.listRecordings           = listRecordings
window.selectRecording          = selectRecording
window.createRecording          = createRecording
window.renameRecording          = renameRecording
window.deleteRecording          = deleteRecording
window.duplicateRecording       = duplicateRecording
window.syncRecordingsToGithub   = syncRecordingsToGithub
window.loadRecordingsFromGithub = loadRecordingsFromGithub
window.openChannelManagerDialog = openChannelManagerDialog
window.listChannels             = listChannels
window.setChannelBlocked        = setChannelBlocked
window.deleteChannel            = deleteChannel
window.migrateSrtPathsToNFC     = migrateSrtPathsToNFC

// Captured-subtitles helpers — exposed so the in-browser test recipe and
// the external capture extension can both reach them without re-importing
// the module.
window.updateCapturedBtn        = updateCapturedBtn
window.loadCapturedBuffer       = loadCapturedBuffer
window.saveCapturedBuffer       = saveCapturedBuffer
window.handleCapturedSubtitle   = handleCapturedSubtitle
window.pushCapturedSubtitlesBatched = pushCapturedSubtitlesBatched
window.detectSrtConflicts       = detectSrtConflicts
window.presentSrtMergeDialog    = presentSrtMergeDialog
window.mergeSrtWithResolution   = mergeSrtWithResolution

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


