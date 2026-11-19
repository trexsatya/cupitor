import { wireMobileSearch } from './mobile-search.js'
import { attributeSubtitleMatches } from './subtitle-search-engine.js';
import { createSubtitleSearchClient, observeSubtitleCorpus } from './subtitle-search-client.js';
import { userDataReady } from './user-data.js';
const _userData = await userDataReady();
import { LANGUAGES, languageFromLocation, requireStudyLanguage, speechLocale } from './language-config.js';
import {folderPath, folderPaths, folderChange, mergeFolderCatalog} from './playlist-folders.js';
import {mountPlaylistBrowser, playlistBrowserState} from './playlist-browser.js';
import { retainCaptionEnds } from './caption-capture.js';
import { matchingCompanionSubtitle, openLocalSubtitlePicker, readLocalSubtitleText } from './local-file-picker.js';
import { createLocalSpeakOver, localSpeakOverIdentity } from './local-speakover.js';
import { browserRecordingAvailable, createBrowserSpeakOverRecorder } from './browser-speakover.js';
import { createMediaCaptionPanel } from './media-caption-panel.js';
import { createSubtitleTranslationLookup } from './subtitle-translation.js';
import { createYoutubeMediaAdapter } from './youtube-media-adapter.js';
import { playLocalMedia } from './local-playback.js';
import { spotifyClipSegments as spotifyClips } from './spotify-clips.js';
import { youtubeClipForItem, manualPlaybackPlan, clipFallbackSeconds } from './card-playback.js';
import { createSpotifyStudyPlayer } from './spotify-player.js';
import { installDialogScrolling } from './dialog-scrolling.js';
import { createFullSrtDialog } from './full-srt-dialog.js';
import { createBundleLoader, createSubtitleBundleAdapter } from './subtitle-bundles.js';
import { loadSubtitlePacks } from './subtitle-pack-loading.js';
import { SUBTITLE_BATCH_DOCUMENTS, SUBTITLE_BATCH_BYTES } from './subtitle-batches.js'
import { recordingsHaveChanges } from './recordings-sync-state.js';
import { mountPracticeReminders, practiceDate } from './practice-reminders.js';
import { installStudyCalls } from './study-calls.js';
import { createVocabularyMatcher } from './vocabulary-matcher.js';
import {
  assertVocabularyRow, changeVocabularyCatalog, createVocabularyHintIndex, mergeVocabularyCatalogs,
  GENERATED_HINDI_HINTS_FILE, normalizeHint, parseVocabularyCatalog, parseVocabularyHintLanguages,
  parseVocabularyHintTranslations, replaceEnglishVocabularyHints, reviseVocabularyGroup, sharedVocabularyHints, SHARED_HINTS_DIRECTORY,
  vocabularyFormKey, vocabularyHintGroupId, vocabularyLineParts, VOCABULARY_CATALOG_FILE, VOCABULARY_CATALOG_PATH,
} from './vocabulary-hints.js';
import { vocabularyHintSeed } from './vocabulary-hint-seed.js';
import { openVocabularyEditor } from './vocabulary-meaning-editor.js';
import { installRichCardStrikethrough } from './rich-card-strikethrough.js';
import { installRichCardUnderline } from './rich-card-underline.js';
import { installRichCardParagraphTools } from './rich-card-paragraph.js';
import { installRichCardShortcuts } from './rich-card-shortcuts.js';
import { sizeRichCardEditingArea, observeRichCardEditingArea } from './rich-card-layout.js';
import { arrangeRichCardDialog } from './rich-card-modal.js';
import { installRichCardFormatting } from './rich-card-formatting.js';
import { installRichCardPasteControl } from './rich-card-paste.js';
import { installMobileRichToolbar } from './rich-card-mobile-toolbar.js';
import { cardCanUseTts, cardTtsText, ttsFaceSequence, speakTts } from './card-tts.js';
import { createPracticeVideoCues } from './practice-video.js';
import { createRecordingVideoAttempt, confirmRecordingSeek, getYoutubeVideoId, VIDEO_RECOVERY_MS, VIDEO_STALL_RETRY_MS } from './recording-video.js';
import { createAppLifecycleClock } from './app-lifecycle.js';
import { DEFAULT_STUDY_TIMEOUT_MINUTES, createStudySessionTimeout, studyTimeoutMinutes } from './study-session-timeout.js';
import { installStudyDivider } from './study-divider.js';
import { installStudyChrome } from './study-chrome.js';
import { keyboardShortcut, KEYBOARD_SHORTCUTS, studyShortcutView } from './keyboard-shortcuts.js';
import { isPracticeTouchGesture, isPracticeTouchDoubleTap } from './practice-gestures.js';
import { parsePracticeSpeeds, practiceSpeeds, nextPracticeSpeed, supportedPracticeSpeed } from './practice-speed.js';
import { loadRecordingsFiles, syncRecordingsFiles } from './recordings-store.js';
import { listRecordingsParts } from './recordings-gc.js';
import { rememberCache, listSubtitleCaches, cacheSources, removeCacheSource, deleteSubtitleCache } from './cache-manager.js';
import { filterSearchChannels, searchChannelOptions } from './search-channels.js';
import { SUBTITLE_CONTENT_VERSION, reusableSubtitleCache, subtitleSnapshot } from './subtitle-state.js';
import {computeIfAbsent, range, schedule, uuid} from '../data-structures.js';
import {conjugateTableSpanish} from './spanish.js';
import {
  VOCAB_OVERLAP_STOP_WORDS,
  commonWordsToIgnore,
  vocabSuffixOverlapLen,
  stripExpansionMarkers as _stripExpansionMarkers,
} from './vocab-search.js';
import { STEM_RULES, guessStems } from './stemming.js';
import {
  COMMON_PREFIXES,
  _stripPrefix,
  findDifferentPrefixMatches as _coreFindDifferentPrefixMatches,
} from './different-prefix.js';
import {
  highlightWordInLine as _coreHighlightWordInLine,
  highlightSearchInVocabLine as _coreHighlightSearchInVocabLine,
  highlightStemInPrefixMatch as _coreHighlightStemInPrefixMatch,
} from './highlight.js';
import {
  PRACTICE_LOG_DEFAULT_RETAIN,
  defaultPracticeLog as _defaultPracticeLog,
  normalizePracticeLog,
  isoWeekLabel as _isoWeekLabel,
  addDays as _addDays,
  prunePracticeLogWeeks as _corePrunePracticeLogWeeks,
  hasPracticeLogEntry,
  practiceLogMeasure,
  practiceLogWeekNote,
  updatePracticeGoal,
  updatePracticeProgress,
  mergePracticeLog as _mergePracticeLog,
} from './practice-log.js';
import {
  SIMILARITY_VOWELS,
  isVowel as _isVowel,
  classifyCharDiffs as _classifyCharDiffs,
  levenshtein as _levenshtein,
  phoneticKey as _phoneticKey,
  compoundOverlap as _compoundOverlap,
  scoreSimilarity as _scoreSimilarity,
} from './similarity.js';
import { toSeconds, fromSeconds } from './time-format.js';
// Shared pure logic, also consumed by the Node "Manage" CLI (tools/language).
// These modules are the single source of truth; the functions below are thin
// window-aware wrappers over them.
import {
  removeHintsInBrackets as _sharedRemoveHints,
  buildExpansionMap as _buildExpansionMap,
  expandWords as _sharedExpandWords,
} from './vocab-expand.js';
import {
  sanitizeFilenameSegment as _sharedSanitizeFilename,
  buildCapturedSubtitleBaseName as _sharedBuildBaseName,
} from './subtitle-naming.js';
import {
  EVERYTHING_ELSE as _EVERYTHING_ELSE,
  guessCorrespondingWords as _guessCorrespondingWords,
  groupResultsByWord as _groupResultsByWord,
  MAX_GROUPS as _MAX_GROUPS,
  capGroups as _capGroups,
  sinkUnevidencedGroups as _sinkUnevidencedGroups,
  confirmByBackTranslation as _confirmByBackTranslation,
  translationConfidences as _translationConfidences,
  lineContainsWord as _lineContainsWord,
  tokenizeLine as _tokenizeLine,
  wordMatches as _wordMatches,
} from './corresponding-words.js';
import {
  flattenVocabEntries as _flattenVocabEntries,
  buildRareWordRegex as _buildRareWordRegex,
  buildRareWordPrefilter as _buildRareWordPrefilter,
  prefilterHit as _prefilterHit,
} from './rare-words.js';
import {
  srtError as _srtError,
  srtToJson,
  toStringSubtitle,
  srtTimeFromValue,
  srtTimeToSeconds,
  parseSrtEntries,
  entriesToSrtText,
  linesToSrtText,
  mergeSrtWithNewEntries,
  mergeSrtWithResolution,
  detectSrtConflicts,
  upsertSrtEntry,
  applyQueuedEditsToText,
  applyQueuedCompanionEdits,
} from './srt-parser.js';
import { translateLines } from './translate-lines.js';
import { numberRows as _numberRows, plainRows as _plainRows, parseNumbered as _parseNumbered } from './translate-block.js';
import {
  splitSentences,
  chunkifySentence,
  getWords,
  expandRegex,
  withWordBoundaries,
  relaxSpaces as _relaxSpaces,
  isRegExp,
  getSurrounding,
  cleanSrtForMatch as _cleanSrtForMatch,
  getSearchedTerms as _coreGetSearchedTerms,
  getWordsOrdered as _coreGetWordsOrdered,
  searchSubtitleText as _coreSearchSubtitleText,
  filterByLanguage as _coreFilterByLanguage,
  wordIsExactInVocabularyLine,
  vocabHasExactWord as _coreVocabHasExactWord,
  pickVocabOptionForWord,
} from './search-text.js';
import {
  withTimeout as _withTimeout,
  nfc as _nfc,
  runInBatches as _runInBatches,
  fetchWithRetry,
  commitWithMerge as _coreCommitWithMerge,
  parseRemoteList,
} from './net.js';
import {
  readUrl as _dsReadUrl,
  dataRoot as _dsDataRoot,
  sourceIdentity as _dsSourceIdentity,
  captureSourceContext as _dsCaptureSourceContext,
  writeTarget as _dsWriteTarget,
  hasSelf as _dsHasSelf,
  hasOther as _dsHasOther,
  langFromLocation as _dsLangFromLocation,
  readLayers as _dsReadLayers,
  mergeIndexLayers as _dsMergeIndexLayers,
  mergeCategorisationLayers as _dsMergeCategorisationLayers,
  otherListProblem as _dsOtherListProblem,
  checkOtherRepo as _dsCheckOtherRepo,
  cacheRecordMatches as _dsCacheRecordMatches,
  source as _dsSource,
  vocabularyFromLayers as _dsVocabularyFromLayers,
  mergeVocabularyLayers as _dsMergeVocabularyLayers,
  withoutReadOnlyLines as _dsWithoutReadOnlyLines,
  pendingVocabCategories as _dsPendingVocabCategories,
  relayerVocabulary as _dsRelayerVocabulary,
  mergeRecordingLayers as _dsMergeRecordingLayers,
  claimVocabularyLines as _dsClaimVocabularyLines,
  fetchSelfJson as _dsFetchSelfJson,
  NoSelfRepoError as _DsNoSelfRepoError,
} from './data-source.js';

// The account panel (account-panel.js) owns sign-in; the legacy in-page PAT
// prompt in github-utils.js never fires.
window._suppressGHTokenPrompt = true

// Notices about the other user's (read-only) layer, e.g. "alice/cupitor-data
// could not be found". Kept for the account panel, logged, and shown
// briefly as a toast.
window._otherLayerNotices = []
function _dsNotice(msg) {
  window._otherLayerNotices.push(msg)
  console.warn('[layer]', msg)
  try { _cpBuildToast(msg) } catch (_) {}
}
// The other layer gets one retry: a repo that is down or gone must not hold
// up startup the way four slow attempts would.
const _OTHER_LAYER_RETRY = { tries: 2 }

// True when the index entry for this video comes from the other user's
// library (read-only): its lines cannot be edited and it cannot be deleted.
function _isReadOnlyLink(link) {
  const s = (window.srts || []).find(it => it && it.link === link)
  return !!(s && s.readOnly)
}

function _sourceOwner(who) {
  try { const s = _dsSource(who); return (s && s.owner) || null } catch (_) { return null }
}
// The login whose repo holds this video's files: its index entry's owner, or
// the primary repo's for an entry added this session.
function _ownerOfLink(link) {
  const s = (window.srts || []).find(it => it && it.link === link)
  return (s && s.owner) || _sourceOwner('primary')
}

// After a capture of a video that only the other user's library had has been
// written to the own repo: the video is now the user's own, so its entry is
// replaced by a self one (editable, its files read from the own repo).
function _adoptAsSelfEntry(link, name, source) {
  const owner = _sourceOwner('self')
  if (!owner || !Array.isArray(window.srts)) return
  let adopted = false
  const out = []
  for (const s of window.srts) {
    if (s && s.link === link && s.readOnly) {
      if (!adopted) out.push({ link, name, source, src: 'self', owner, readOnly: false })
      adopted = true
      continue
    }
    out.push(s)
  }
  if (!adopted) return
  window.srts = out
  const sub = window.allSubtitles && window.allSubtitles[link]
  if (sub) { sub.readOnly = false; delete sub._parsedSv; delete sub._parsedEn }
}
import { scopedKey as _scopedKey, loadAccount as _loadAccount } from './account-state.js';
import { cachedUsers as _cachedUsers } from './account.js';
import { ownerLabel as _ownerLabel, withOwnerLabel as _withOwnerLabel } from './owner-label.js';

// Display-only owner labels ("ðŸ”’ Satya") for items of the other user's
// library; '' for own items and when there is no other layer. The account
// and users list are read once per call, so a list renders with one read.
// Never put a label into a value, key or anything that is saved.
function _ownerLabeller() {
  let account = null, users = null
  try { account = _loadAccount() } catch (_) {}
  try { users = _cachedUsers() } catch (_) {}
  const label = item => _ownerLabel(item, account, users)
  label.prefix = (text, item) => _withOwnerLabel(text, item, account, users)
  return label
}
function _srtEntryOf(link) {
  return (window.srts || []).find(it => it && it.link === link) || null
}
function _ownerLabelOfLink(link) { return _ownerLabeller()(_srtEntryOf(link)) }
function _ownerLabelOfPlaylist(name) {
  const r = window._recordings && Object.prototype.hasOwnProperty.call(window._recordings, name) ? window._recordings[name] : null
  return _ownerLabeller()(r)
}
import { initAccountPanel as _initAccountPanel, bootAccount as _bootAccount } from './account-panel.js';
import {
  isVirtual as _coreIsVirtual,
  isManualItem as _isManualItem,
  newManualId as _coreNewManualId,
  parseMediaUrl as _parseMediaUrl,
  virtualMembers as _coreVirtualMembers,
  resolveVirtualItems as _coreResolveVirtualItems,
  itemsForRecording as _coreItemsForRecording,
  recordingItemCountIn as _recordingItemCountIn,
  rowPositionIn as _rowPositionIn,
  youtubeStartSeconds as _youtubeStartSeconds,
  recordingItemCountByName as _coreRecordingItemCountByName,
  mergeRecordingCollections as _coreMergeRecordingCollections,
  mergeRecordingsLocalAuthoritative as _coreMergeRecordingsLocalAuthoritative,
  bridgePlaylistsToRecordings as _coreBridgePlaylistsToRecordings,
  isReadOnlyPlaylist as _coreIsReadOnlyPlaylist,
  persistableRecordings as _corePersistableRecordings,
  withoutReadOnlyPlaylists as _coreWithoutReadOnlyPlaylists,
  withSessionPlaylists as _coreWithSessionPlaylists,
  tidyReadOnlyPlaylists as _coreTidyReadOnlyPlaylists,
} from './recordings-merge.js';
import {
  threeWayRecordings as _threeWayRecordings,
  mergePlaylist3 as _mergePlaylist3,
  summarizePlaylistChange as _summarizePlaylistChange,
  sameJson as _sameJson,
} from './recordings-3way.js';
import {
  CAPTION_NO_TRANSLATION,
  captionLinesFrom as _captionLinesFrom,
  captionKey as _captionKey,
  captionMediaLink as _captionMediaLink,
  captionPageKey as _captionPageKey,
  captionWords as _captionWords,
  captionFaces as _captionFaces,
  captionRowCounts as _captionRowCounts,
  captionKeysInItem as _captionKeysInItem,
  appendCaptionBlock as _appendCaptionBlock,
  captionFieldOf as _captionFieldOf,
  cardTranslateDirection as _cardTranslateDirection,
} from './caption-capture.js';
import { cardHtml as _cardHtml, cardPlainText as _cardPlainText, driveImageUrl as _driveImageUrl } from './card-html.js';
import { openImageViewer } from './image-viewer.js';
import {
  findManualCards as _findManualCards,
  renderManualResultsHtml as _renderManualResultsHtml,
} from './manual-search.js';
import { wordMapStorageKey, readSearchMaps, findWordMaps, renderWordMapResultsHtml } from './word-map-search.js';
import {
  MUSIC_MODES as REC_MUSIC_MODES,
  MUSIC_VOL_WITH_AUDIO,
  MUSIC_VOL_IN_GAPS,
  musicVideoIdFromUrl as _musicVideoIdFromUrl,
  musicMode as _musicModeOf,
  musicSettingsFor as _musicSettingsFor,
  musicTracks as _musicTracksOf,
  musicSelectedId as _musicSelectedIdOf,
  musicSelectedTrack as _musicSelectedTrackOf,
  resolveMusicTrack as _resolveMusicTrack,
  MUSIC_NONE as _MUSIC_NONE,
  musicVolumeFor as _musicVolumeForPhase,
  musicVolumeFieldsFor as _musicVolumeFieldsFor,
  musicShouldPlay as _musicShouldPlay,
  addMusicTrack as _addMusicTrack,
  removeMusicTrack as _removeMusicTrack,
  musicTrackKind as _musicTrackKind,
  musicEngineFor as _musicEngineFor,
  musicServedUrl as _musicServedUrl,
  addLocalMusicTrack as _addLocalMusicTrack,
  pruneMissingLocalTracks as _pruneMissingLocalTracks,
  musicNeedsReload as _musicNeedsReload,
} from './music-bed.js';
import {
  clipRange as _clipRange,
  contiguousLineWindow as _contiguousLineWindow,
  wordContextLineWindow as _wordContextLineWindow,
  formatGap as _formatGap,
} from './practice-clip.js';
import {
  addTake as _addTake,
  takeAt as _takeAt,
  removeTake as _removeTake,
  TAKE_SAME_SPOT as TAKE_SAME_SPOT_S,
  rewindPointFor as _rewindPointFor,
  takeDueForPass as _takeDueForPass,
  TAKE_MAX_STEP as _TAKE_MAX_STEP,
  TAKE_SAME_SPOT as _TAKE_SAME_SPOT,
  takesDuration as _takesDuration,
  takeOffsetLabel as _takeOffsetLabel,
} from './practice-rec.js';
import {
  nextRandomPlaylistName as _nextRandomPlaylistName,
  collectManualItems as _collectManualItems,
  wordsForCategories as _wordsForCategories,
  matchingPositions as _matchingPositions,
  buildAutoItemsForWord as _buildAutoItemsForWord,
  sampleAndGroup as _sampleAndGroup,
  fisherYates as _fisherYates,
} from './random-playlist.js';
import {
  makeNotifKey as _makeNotifKey,
  buildNotifItems as _buildNotifItems,
  webpageNotifLists as _webpageNotifLists,
  buildUnreadNotifQueue as _buildUnreadNotifQueue,
} from './notif-bridge.js';
import {
  buildLibraryQuery as _buildLibraryQuery,
  normalizeLibraryPayload as _normalizeLibraryPayload,
  mergeLibraryHits as _mergeLibraryHits,
  renderLibraryResultsHtml as _renderLibraryResultsHtml,
} from './library-search.js';
import {
  buildPlayQueue as _coreBuildPlayQueue,
  shuffleQueue as _coreShuffleQueue,
  migrateLegacyLastPlayedMap,
  setLastPlayedEntry,
  getNewestEntry,
  saveQueueOrderInto,
  computeResumePoint,
  recPlayExternalPauseAction,
} from './play-queue.js';
import { createReturnGuard } from './return-guard.js';
import {
  parseVocabularyFile,
  vocabularyToText,
  isProperlyBracketed,
  mergeVocabulary,
  ownLines,
  removeVocabularyLine,
  vocabPendingHintText,
} from './vocab-merge.js';
import {
  escapeHtml,
  decodeHtmlEntities,
  removeHtmlTags,
  encodeHtmlTags as _coreEncodeHtmlTags,
  decodeHtmlTags,
  subtitleText as _subtitleText,
  safeSubtitleTag as _safeSubtitleTag,
  safeSubtitleHtml as _safeSubtitleHtml,
} from './html-utils.js';
import {
  LOG_BUFFER_MAX,
  pushLog,
  installConsoleTap,
  makeWindowErrorEntry,
  makeUnhandledRejectionEntry,
} from './log-buffer.js';
import { filterLogs, formatLogsAsText } from './renderer/log-viewer-vm.js';
import { renderLogViewerBody } from './renderer/log-viewer-render.js';
import {
  RARE_WORDS_PAGE_SIZE,
  buildCategoryOptions,
  buildRareWordsPageVM,
} from './renderer/rare-words-vm.js';
import {
  renderRareWordsList,
  renderRareWordsPager,
  renderRareWordsCategorySelect,
} from './renderer/rare-words-render.js';
import {
  pendingSrtEditCount as _pendingSrtEditCountCore,
  buildSrtEditsReviewVM,
} from './renderer/srt-edits-review-vm.js';
import {
  renderSrtEditsReviewList,
  collectSrtEditsByCheckbox,
  setSrtEditsGroupChecked,
  syncSrtEditsGroupBoxes,
} from './renderer/srt-edits-review-render.js';
import {
  buildPracticeLogPlanVM,
  buildPracticeLogHistoryVM,
} from './renderer/practice-log-render-vm.js';
import {
  renderPracticeLogPlan,
  renderPracticeLogHistory,
  openPracticeLogActivityPicker,
  openPracticeLogGoalEditor,
  openPracticeLogProgressEditor,
  openPracticeLogWeekNoteEditor,
} from './renderer/practice-log-render.js';
import {
  tierLabel as _tierLabel,
  tierClass as _tierClass,
  diffPrefixRowBadge,
} from './renderer/similar-matches-vm.js';
import {
  buildBoundedWordRe as _buildBoundedWordRe,
  phraseFoundInTexts as _phraseFoundInTexts,
  highlightWordHtml as _highlightWordHtml,
  findLineByTime as _findLineByTime,
  locateItemCue as _locateItemCue,
  contiguousPlayWindow as _contiguousPlayWindow,
  buildPlayingBannerVM,
  buildPlayingSubsVM,
} from './renderer/playing-ui-vm.js';
import {
  renderPlayingSubsList,
  subtitleTimestampButton,
  updatePlayingBanner,
} from './renderer/playing-ui-render.js';
import {
  renderCapturedReviewList,
  applyCapturedRowStatus,
} from './renderer/captured-review-render.js';
import {
  channelOfItem as _coreChannelOfItem,
  applyBlockedChannelFallback as _coreApplyBlockedChannelFallback,
  groupAndArrangeResults as _coreGroupAndArrangeResults,
  searchPageBounds,
} from './renderer/search-results-vm.js';
import {
  buildHighlightSpans as _buildHighlightSpans,
  sliceByHighlightSpans as _sliceByHighlightSpans,
} from './renderer/highlight-spans-vm.js';
import { compileRegex, splitRegexAlternatives, hasPhraseWhitespace, isTypedRegex } from './regex-pattern.js';
import { buildSelectedSearchPlaylist } from './search-playlist.js';
import { renderAccordions as _coreRenderAccordions } from './renderer/accordion-render.js';
import { recordingReviewPage, recordingReviewOrder } from './recording-review-page.js';
import { organizeSettingsPanel } from './settings-panel.js';
import { orderedRecordingEntries, insertionIndex, insertRecordingItem, reorderRecordingBucket } from './recordings-order.js';
import { knownVideos as _knownVideos } from './known-videos.js';

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

// Console-tap + uncaught-error capture. Pure helpers live in ./log-buffer.js;
// this block just wires the singleton window.__logBuffer to the global
// console and to the window error/unhandledrejection events.
window.__logBuffer = window.__logBuffer || []
installConsoleTap(window.__logBuffer, console, { max: LOG_BUFFER_MAX })
window.addEventListener('error', (e) => {
  try { pushLog(window.__logBuffer, makeWindowErrorEntry(e), LOG_BUFFER_MAX) }
  catch (_) {}
})
window.addEventListener('unhandledrejection', (e) => {
  try { pushLog(window.__logBuffer, makeUnhandledRejectionEntry(e), LOG_BUFFER_MAX) }
  catch (_) {}
})

const SEPARATOR_PIPE = '|'
window.onbeforeunload = function (event) {
  if (window.dontConfirmOnRefresh) {
    return null
  }
  return confirm("Confirm refresh");
};

// Flutter may send a lookup before the search controls have been wired. Keep
// only the latest word and dispatch it once the actual change handler exists.
function _applyIncomingLookup(rawText) {
  const term = String(rawText == null ? '' : rawText).trim()
  if (!term) return
  window.__cupitorLookupWantsSearch = true
  // A native word lookup hands the foreground to Search, retaining the study
  // sessions and their positions behind their restore pills.
  if (window._playingRecording && !window._recPlayMinimized) window.minimizePlayingRecording()
  if (window._practiceActive && !window._practiceMinimized) window.minimizePracticeMode()
  _minimizeMainMedia()
  $('#saveRevisionBtn').show()
  window.unprocessedSearchText = null
  window.preSelectedSearchedWord = null
  $('#searchedWords').val('').trigger('change.select2')
  $('#searchText').val(term).trigger('change')
}
function _flushPendingLookup() {
  if (!window.__cupitorSearchReady || window.__cupitorPendingLookup == null) return
  const term = window.__cupitorPendingLookup
  window.__cupitorPendingLookup = null
  _applyIncomingLookup(term)
}
window.addEventListener('filterData', e => {
  const term = e.detail && e.detail.text
  if (!term) return
  if (!window.__cupitorSearchReady) {
    window.__cupitorPendingLookup = term
    return
  }
  _applyIncomingLookup(term)
})
window.__cupitorLookupHandlerReady = true

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

window.addEventListener('cupitorDialog1Closed', () => {
  _cancelSpeakOverCapture()
  // Close all dialogs â€” except one marked to wait for the user's return: the
  // playlist a capture was just filed in (see _keepFiledPlaylistOpen).
  $('.ui-dialog-content').each(function () {
    if (this.getAttribute('data-keep-on-host-close') === '1') return
    try { $(this).dialog('close') } catch (_) {}
  })
});

// Native app pushes the user's book/EPUB playlists here (each card = a manual
// flashcard whose text is the front, plus book_key/chapter_idx for an
// "Open in EPUB" deep-link). We request them on boot via PlaylistBridge and
// rebuild the external playlists whenever a fresh payload arrives.
//
window.addEventListener('cupitorPlaylists', (ev) => {
  try { buildPlaylistsWithManualCards(ev.detail) }
  catch (e) { console.warn('cupitorPlaylists handler failed', e) }
});

function getExpansionForWords() {
  // Expansion map is derived from the vocabulary file's `expansions` category.
  // The pure builder lives in ./vocab-expand.js (shared with the Node CLI).
  return _buildExpansionMap(window.vocabulary)
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
      playLocalMedia(audioPlayer)
    } else {
      audioPlayer.pause()
    }
  } else if (window.playingVideo) {
    if (videoPlayer.paused) {
      playLocalMedia(videoPlayer)
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
    playLocalMedia(audioPlayer)
  } else if (window.playingVideo) {
    playLocalMedia(videoPlayer)
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

// Android plays a paused video again when the app comes back to the front â€”
// see ./return-guard.js. Anything that asks for playback on purpose stands the
// guard down: the page's own play calls (wrapped below), a tap or key on the
// page, a tap inside the player (which takes focus from the page), a headset.
const _ytReturnGuard = createReturnGuard({
  getState: () => window.ytPlayer.getPlayerState(),
  pause: () => window.ytPlayer.pauseVideo(),
})
function _youtubePlaybackViewOpen() {
  return ['rec-playing', 'practice-mode', 'youtube-media-mode'].some(name => document.body?.classList.contains(name))
}
// A browser/host resume or a late iframe message cannot start a parked clip.
// This rule outlives the short return guard and is never cancelled by typing
// or tapping on Search. A visible media view owns intentional playback.
function _enforceYoutubePlaybackView(state) {
  _hookYtForReturnGuard()
  if (_youtubePlaybackViewOpen()) return true
  try {
    const current = state ?? window.ytPlayer?.getPlayerState?.()
    if (current === 1 || current === 3) window.ytPlayer?.pauseVideo?.()
  } catch (_) {}
  window.ytPlaying = false
  return false
}
window.enforceYoutubePlaybackView = _enforceYoutubePlaybackView
function _hookYtForReturnGuard() {
  const p = window.ytPlayer
  if (!p || p.__returnGuardHooked || typeof p.playVideo !== 'function') return
  p.__returnGuardHooked = true
  ;['playVideo', 'loadVideoById', 'loadVideoByUrl', 'seekTo'].forEach(m => {
    const orig = p[m]
    if (typeof orig !== 'function') return
    p[m] = function (...args) {
      if (!_youtubePlaybackViewOpen()) { _enforceYoutubePlaybackView(); return }
      _ytReturnGuard.cancel()
      return orig.apply(this, args)
    }
  })
  try { p.addEventListener('onStateChange', e => {
    _ytReturnGuard.onStateChange(e && e.data)
    _enforceYoutubePlaybackView(e && e.data)
  }) } catch (_) {}
}
const _playerSessionTimeout = createStudySessionTimeout(() => {
  if (!window._playingRecording) return
  if (!window._recPlayPaused) _applyRecPlayPause(true, true)
  _recPlayToast('Player session timed out', { sessionTimeout: true })
})

const _practiceSessionTimeout = createStudySessionTimeout(() => {
  if (!window._practiceActive) return
  if (['starting', 'recording', 'stopping'].includes(_pracRec?.phase)) return false
  if (window._practiceMinimized) {
    _stopPracticeTts()
  } else {
    _pracRecTakeOverPlayhead()
    _newPracticeVideoRequest({ keepSpotify: true })
    window._practicePlayPending = null
    _stopPracticeAudio()
    if (window._manualAudioPreview?.$btn?.is('#practiceMode .practice-media-link')) _stopManualAudioPreview()
    if (spotifyClips(window._practiceCards?.[window._practiceIdx]).length) {
      spotifyPlayer.media?.pause()
    } else {
      _pracRecPauseVideo()
    }
    if (_pracRec) {
      _pracRec.token++
      _pracRec.watchPos = null
      _pracRec.loopSuspended = _pracRec.loop
      _pracRecLoopClearAudio(_pracRec)
      _pracRec.audio?.pause()
      _pracRec.audio = null
      if (_pracRec.phase === 'playback') {
        _pracRec.phase = 'idle'
        _renderPracticeRecBar()
      }
    }
  }
  _recPlayToast('Practice session timed out', { sessionTimeout: true })
})

function _checkStudySessionTimeouts() {
  _playerSessionTimeout.check()
  _practiceSessionTimeout.check()
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _cancelSpeakOverCapture()
    _hookYtForReturnGuard()
    _ytReturnGuard.onHidden()
  }
  else { _enforceYoutubePlaybackView(); _ytReturnGuard.onVisible(); _checkStudySessionTimeouts() }
})
;['pageshow', 'focus'].forEach(event => window.addEventListener(event, () => _enforceYoutubePlaybackView()))
window.addEventListener('cupitorAppLifecycle', event => {
  if (event.detail?.isForeground) {
    _enforceYoutubePlaybackView()
    _checkStudySessionTimeouts()
  }
  else if (event.detail?.state === 'hidden' || event.detail?.state === 'paused') _cancelSpeakOverCapture()
})
;['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => _ytReturnGuard.cancel(), true))
window.addEventListener('blur', () => { if (!document.hidden) _ytReturnGuard.cancel() })
window.addEventListener('cupitorMediaKey', () => _ytReturnGuard.cancel(), true)

// Start playback of the currently selected media (used by the "Play" button).
// Selecting media via #mp3Choice intentionally does NOT load subtitles â€” the
// user only sees Play Starred / Practice Starred (which lazy-load on demand)
// until they explicitly press Play. At that point we run the full load:
// playNewMedia fetches the SRT, parses it via storeSubtitles, and starts the
// video. clearSubtitles inside playNewMedia wipes window.starredLines, so we
// re-fetch them afterwards to keep the Save / Play Starred buttons accurate.
async function playSelectedMedia() {
  const sel = window.mediaSelected || {}
  if (!sel.link) { playMedia(); return }
  const $status = $('#mediaPlaybackStatus').empty()
  const playback = playNewMedia(sel.link, sel.source || 'link', null, true)
  const loadSeq = _mainMediaLoadSeq
  try {
    await playback
  } catch (e) {
    console.warn('playSelectedMedia: playNewMedia failed', e)
    if (loadSeq === _mainMediaLoadSeq && sel === window.mediaSelected) {
      _minimizeMainMedia()
      $('#mediaControlPanel').show()
      $status.text('Could not open the player. Tap Play to retry.')
      showResultContainer()
    }
    return
  }
  if (loadSeq !== _mainMediaLoadSeq || sel !== window.mediaSelected) return
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
    const v = JSON.parse(localStorage.getItem(_searchesKey()) || '[]')
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') return Object.keys(v)
    return []
  } catch (_) {
    return []
  }
}

function saveSearchesIntoStorage(searches) {
  localStorage.setItem(_searchesKey(), JSON.stringify(searches))
}

// Saved searches are personal: one list per account on this device.
function _searchesKey() { return _scopedKey('searches') }

function exportSearches() {
  const searches = getSearchesFromStorage()
  export2txt(searches.join("\n"), "searches.txt");
  $('#toggleSearchesControlCheckbox').click()
}

function importSearches() {
  $("#import-dialog").dialog()
}

// --- Minimized dialogs ----------------------------------------------------
// Study views cover existing page dialogs. Dialogs opened while studying
// (editors, queue, settings) are explicitly lifted above the view.
// Match the media-mode dialog layer: this inline !important value wins
// over CSS, including the caption sidebar and its modal backdrop.
const DIALOG_ABOVE_OVERLAY_Z = 2147483647
const _coveredStudyModals = new Set()

function _screenOverlayOpen() {
  const $p = $('#practiceMode')
  return $('body').hasClass('rec-playing') || !!($p.length && $p.is(':visible') && !$p.hasClass('minimized'))
}

function _liftDialogAboveOverlay($wrap) {
  if (!$wrap || !$wrap.length) return
  // Last in <body> as well as highest: inside a nested stacking context a
  // z-index cannot outrank that context's own siblings, however large it is.
  // Being last also settles the order between two lifted dialogs.
  $wrap.appendTo('body').removeClass('behind-study-view').addClass('above-practice-mode')
  const el = $wrap[0]
  // Inline and important too, in case the stylesheet has not arrived yet.
  if (el) el.style.setProperty('z-index', String(DIALOG_ABOVE_OVERLAY_Z), 'important')
  $('body').addClass('dialog-above-practice')
}

// Keep drafts open underneath, so leaving a study view restores the page.
function _coverOpenDialogsForStudy() {
  $('.ui-dialog:visible').addClass('behind-study-view').removeClass('above-practice-mode')
    .each(function () {
      // Some dialogs have ID-specific !important rules above the backdrop.
      // Override those too; closing/minimizing study restores their CSS.
      this.style.setProperty('z-index', '99999', 'important')
      const $content = $(this).children('.ui-dialog-content')
      if ($content.dialog('option', 'modal')) {
        _coveredStudyModals.add($content[0])
        // A covered modal must also release its focus trap. Keep its draft
        // and open state; restore modality when the page is visible again.
        $content.dialog('option', 'modal', false)
      }
    })
  $('.select2-hidden-accessible').each(function () {
    if ($(this).data('select2')?.isOpen()) $(this).select2('close')
  })
  _notifCloseBell()
  if ($(document.activeElement).closest('.behind-study-view').length) document.activeElement.blur()
  $('body').removeClass('dialog-above-practice')
}

function _restoreCoveredStudyDialogs() {
  if (_screenOverlayOpen()) return
  $('.ui-dialog.behind-study-view').removeClass('behind-study-view')
    .each(function () { this.style.removeProperty('z-index') })
  for (const element of _coveredStudyModals) {
    const $content = $(element)
    if ($content.dialog('instance') && $content.dialog('isOpen')) $content.dialog('option', 'modal', true)
  }
  _coveredStudyModals.clear()
}

$(function () {
  new MutationObserver(_restoreCoveredStudyDialogs).observe(document.body, { attributes: true, attributeFilter: ['class'] })
  $(document).on('dialogopen dialogfocus', function (e) {
    if (!_screenOverlayOpen()) return
    _liftDialogAboveOverlay($(e.target).closest('.ui-dialog'))
  })
  $(document).on('dialogclose', function () {
    // The backdrop is only lifted while a lifted dialog is still up.
    if (!$('.ui-dialog.above-practice-mode:visible').length) {
      $('body').removeClass('dialog-above-practice')
    }
  })
})

// Minimizing takes a dialog off the screen without closing it. Closing is
// destructive for the dialogs that offer it â€” the card editor rebuilds its
// body and tears down its recorders, the vocabulary dialog clears the words
// being typed â€” so the widget is left open and only its window is hidden. A
// pill in the bottom-right corner brings it back exactly as it was.

// Dialog element id -> { $wrap, $pill } for every dialog currently minimized.
const _minimizedDialogs = new Map()

// The column the pills live in. Several dialogs can be parked at once, so they
// stack instead of landing on the same corner.
function _minimizedDialogsBar() {
  let $bar = $('#minimizedDialogs')
  if (!$bar.length) $bar = $('<div id="minimizedDialogs"></div>').appendTo('body')
  return $bar
}

// A restore pill. `onPick` runs on tap, Enter and Space.
function _makeDialogPill(icon, label, title, onPick) {
  const $pill = $('<div class="dlg-pill" role="button" tabindex="0"></div>')
    .attr('title', title)
    .append($('<span class="dlg-pill-icon" aria-hidden="true"></span>').text(icon))
    .append($('<span class="dlg-pill-label"></span>').text(label))
  const go = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onPick()
  }
  $pill.on('click', go)
  $pill.on('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(e) })
  return $pill
}

function _isDialogMinimized(id) { return _minimizedDialogs.has(id) }

function _minimizeDialog(id, icon, label) {
  const $d = $('#' + id)
  const $wrap = $d.closest('.ui-dialog')
  if (!$wrap.length || _minimizedDialogs.has(id)) return
  let inst = null
  try { inst = $d.dialog('instance') } catch (_) {}
  // jQuery UI leaves the wrapper in the DOM after a close, so "there is a
  // wrapper" is not "there is a dialog to park". Parking a closed one would
  // put a pill on screen that shows a window the widget believes is shut.
  if (!inst || !inst.isOpen()) return
  // A modal dialog holds a document-wide focusin trap that drags focus back
  // into it, and jQuery UI has no supported way to turn modality off while a
  // dialog is open â€” so the overlay goes through the widget's own teardown,
  // which also keeps the shared overlay count right when another modal is up.
  // If that fails, don't park at all: a hidden dialog still holding the trap
  // leaves the page unusable with nothing on screen to explain why.
  if (inst.options.modal) {
    try { inst._destroyOverlay() } catch (_) { return }
  }
  // Closing is what normally takes a dialog out of the focus-tracking list. A
  // parked one never closes, and an invisible instance at the head of that list
  // is exactly where the next modal's focus trap would send focus.
  try { inst._untrackInstance() } catch (_) {}
  $wrap.hide()
  const $pill = _makeDialogPill(icon, label, 'Restore ' + label, () => _restoreMinimizedDialog(id))
  _minimizedDialogsBar().append($pill)
  _minimizedDialogs.set(id, { $wrap, $pill })
  // The dialog can still be closed from elsewhere while it is parked. Drop the
  // pill then, rather than leave one pointing at a window that is gone.
  $d.off('dialogclose.minimize').on('dialogclose.minimize', () => _dropMinimizedDialog(id))
}

// Forget a minimized dialog without putting it back on screen.
function _dropMinimizedDialog(id) {
  const st = _minimizedDialogs.get(id)
  if (!st) return
  _minimizedDialogs.delete(id)
  st.$pill.remove()
}

// Put a minimized dialog back. Returns false when there was nothing parked
// under that id, so callers can use it as "resume if there is one".
function _restoreMinimizedDialog(id) {
  const st = _minimizedDialogs.get(id)
  if (!st) return false
  _dropMinimizedDialog(id)
  const $d = $('#' + id)
  let inst = null
  try { inst = $d.dialog('instance') } catch (_) {}
  st.$wrap.show()
  // Only an instance that is still open owns an overlay. Re-creating one for a
  // widget that has been closed or destroyed since would inflate the shared
  // count for good and strand the focus trap with no dialog behind it.
  const live = !!(inst && inst.isOpen && inst.isOpen())
  if (live && inst.options.modal) {
    try { inst._createOverlay() } catch (_) {}
  }
  // Back on screen, so back at the head of the focus-tracking list.
  if (live) { try { inst._makeFocusTarget() } catch (_) {} }
  try { $d.dialog('moveToTop') } catch (_) {}
  return true
}
window._restoreMinimizedDialog = _restoreMinimizedDialog

// Put a minimize control in a dialog's titlebar, just left of its close
// button. Call it after the widget exists â€” the titlebar is jQuery UI's, not
// part of the dialog's own markup.
// `busy` is optional: called on each click, it returns a reason string when
// the dialog must not be parked right now (and the reason is shown instead).
function _addDialogMinimizeButton(id, icon, label, busy) {
  const $bar = $('#' + id).closest('.ui-dialog').find('.ui-dialog-titlebar')
  if (!$bar.length) return
  // jQuery UI keeps one titlebar across opens, so a button left from a previous
  // open would still carry that open's label ("Add manual card" on a dialog now
  // editing a card). Replace it rather than keep the stale one.
  $bar.find('.dlg-minimize').remove()
  const $btn = $('<button type="button" class="dlg-minimize" aria-label="Minimize"' +
    ' title="Minimize â€” nothing is lost; a pill in the corner brings it back">âˆ’</button>')
  // The titlebar is jQuery UI's drag handle, and only its own close button is
  // excluded from it. Without this, a press that drifts a few pixels â€” normal
  // on a touchscreen â€” drags the dialog instead of minimizing it.
  $btn.on('mousedown touchstart', (e) => { e.stopPropagation() })
  $btn.on('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const why = busy && busy()
    if (why) { alert(why); return }
    _minimizeDialog(id, icon, label)
  })
  $btn.insertBefore($bar.find('.ui-dialog-titlebar-close'))
}

// --- Rare / unused vocabulary finder -------------------------------------
// Scans every vocabulary line against all loaded subtitles and lists the
// ones that appear in fewer than the chosen number of subtitles (a threshold
// of 1 means "never matched anywhere"). Results are paginated; clicking a
// word runs it through the main search box.
window._rareWords = window._rareWords || []
window._rareWordsPage = 0
window._rareWordsScanToken = 0
// RARE_WORDS_PAGE_SIZE imported from ./renderer/rare-words-vm.js

function openRareWordsDialog() {
  // Hide the minimize-restore pill if it's lingering â€” opening the dialog
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
  // after the first â€” including a restore-from-pill), `.dialog({options})`
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
    $('#rareWordsStatus').text('Subtitles/vocabulary still loadingâ€¦')
    return
  }
  const threshold = Math.max(1, parseInt($('#rareWordsThreshold').val(), 10) || 1)
  const token = ++window._rareWordsScanToken

  const entries = _flattenVocabEntries(window.vocabulary).map(entry => {
    try {
      const re = _buildRareWordRegex(expandWords(entry.line, getLangFromUrl().code))
      return {...entry,pattern:re?.source,flags:re?.flags}
    } catch (_) { return entry }
  })
  $('#rareWordsProgress').show()
  $('#rareWordsProgressFill').css('width', '0%')
  $('#rareWordsScanBtn').prop('disabled', true)
  $('#rareWordsStatus').text(`Scanning ${entries.length} wordsâ€¦`)
  let found
  try {
    const result = await _subtitleSearch.run('vocabScan', {ids:_subtitleDocumentIds(),entries,threshold},
      {isCurrent:()=>token===window._rareWordsScanToken})
    if (token !== window._rareWordsScanToken) return
    found = result.filter(entry=>entry.valid&&entry.count<threshold)
  } catch (error) {
    $('#rareWordsStatus').text('Scan incomplete: ' + error.message)
    return
  } finally {
    $('#rareWordsProgress').hide()
    $('#rareWordsScanBtn').prop('disabled',false)
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

// Thin shim â€” option list comes from buildCategoryOptions; renderer emits
// the <option> children; we then restore the previous selection if it
// still matches one of the new options.
function _populateRareWordsCategoryFilter(found) {
  const $sel = $('#rareWordsCategory')
  if (!$sel.length) return
  const prev = $sel.val() || ''
  const options = buildCategoryOptions(found)
  renderRareWordsCategorySelect(options, $sel[0])
  $sel.val(options.some(o => o.value === prev) ? prev : '')
}
// Re-render the list when the category filter changes.
$(function () {
  $(document).on('change', '#rareWordsCategory', function () {
    window._rareWordsPage = 0
    _renderRareWordsPage()
  })
})

// Thin shim â€” VM lives in ./renderer/rare-words-vm.js, DOM emit in
// ./renderer/rare-words-render.js. Restores the clamped page back into
// the global cursor so the pager and re-renders agree.
function _renderRareWordsPage() {
  const vm = buildRareWordsPageVM(window._rareWords || [], {
    categoryFilter: ($('#rareWordsCategory').val() || '').trim(),
    page: window._rareWordsPage || 0,
    pageSize: RARE_WORDS_PAGE_SIZE,
  })
  window._rareWordsPage = vm.page
  renderRareWordsList(vm, $('#rareWordsResults')[0], rareWordSearch)
  renderRareWordsPager(vm, $('#rareWordsPager')[0], {
    onPrev: () => { window._rareWordsPage = vm.page - 1; _renderRareWordsPage() },
    onNext: () => { window._rareWordsPage = vm.page + 1; _renderRareWordsPage() },
  })
}

// Run a rare-word click through the main search box (mirrors vocabularyLineSelected).
// The dialog is minimized (not closed) so the user can keep scanning more rare
// words after seeing this one's results â€” the pager position, category filter,
// and the whole result list are preserved, and a small restore pill brings
// the full dialog back in one click.
function rareWordSearch(line) {
  window.forceMainLangForNextSearch = true
  // A rare word is a studied-language word, so the switch says so â€” otherwise
  // it claims these results are English, and every later reading of it (the
  // context-window buttons, the playback helpers) takes the wrong side of the
  // subtitle pair.
  _setLangToggle(false)
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
    $pill = $(`<div id="rareWordsRestorePill" class="dlg-pill" role="button" tabindex="0" title="Restore rare words dialog">
      <span class="dlg-pill-icon" aria-hidden="true">ðŸ”Ž</span>
      <span class="dlg-pill-label">Rare words</span>
      <button type="button" class="rare-pill-close" aria-label="Close">âœ•</button>
    </div>`).appendTo(_minimizedDialogsBar())
    $pill.on('click', function (e) {
      if ($(e.target).closest('.rare-pill-close').length) return
      e.stopPropagation()
      _restoreRareWordsDialog()
    })
    $pill.on('keydown', function (e) {
      // The dismiss button lives inside the pill, so its own Enter/Space
      // bubbles up here first â€” without this guard, dismissing the pill from
      // the keyboard would reopen the dialog it was meant to put away.
      if ($(e.target).closest('.rare-pill-close').length) return
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

// Categories whose entries are NOT actual searchable vocabulary â€” they
// configure how word expansion works (used by getExpansionForWords()).
// Hidden from both the search picker and the add-to-vocab reference
// picker so they don't pollute the user-facing word list.
const VOCAB_HIDDEN_CATEGORIES = new Set(['expansions', 'Expansions', '_expansions'])

// How many loadWholeVocabulary runs are refilling the selects right now.
let _vocabSelectRebuilds = 0
function _refreshVocabCategories() {
  const $picker = $('#vocabNewCategory')
  const selected = $picker.val() || ''
  const categories = Object.keys(window.vocabulary || {}).filter(name => name && name !== '__empty__')
  if (selected && !categories.includes(selected)) categories.push(selected)
  categories.sort((a, b) => a.localeCompare(b))
  $picker.empty().append(new Option('', ''))
  for (const name of categories) $picker.append(new Option(name, name))
  $picker.val(selected).trigger('change.select2')
}

function loadWholeVocabulary(onDone) {
  _refreshVocabCategories()
  $('#searchedWords').html('')
  $('#addToVocabularyDialogSelect').html('')
  // Empty leading option so select2's allowClear (X) has something to reset
  // the selection to. The placeholder text on each select2 fills the visual.
  $('#searchedWords').append(new Option('', '', false, false))
  $('#addToVocabularyDialogSelect').append(new Option('', '', false, false))
  $('#addToVocabBtn, #headerAddToVocabBtn').prop('disabled', true)
  // The dialog's reference list is being refilled: no line to delete yet.
  _vocabSelectRebuilds++
  _refreshVocabDeleteBtn()

  const vocabCategoriesToPopulate = new Set()

  // Search must not offer expansion definitions as words, but the
  // Add to Vocab dialog must allow editing them (the entries contain '=').
  // Build both selectors from the full category set and filter only the
  // search selector below.
  Object.keys(vocabulary).forEach(cat => {
    vocabCategoriesToPopulate.add(cat)
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
    if (!VOCAB_HIDDEN_CATEGORIES.has(category)) $('#searchedWords').append(searchHeading)
    // addToVocabularyDialogSelect: keep the heading as a non-selectable label.
    const dialogHeading = new Option(`${category}`, category, false, false)
    dialogHeading.disabled = true
    // Marks the heading so "Delete line" can tell which category a line is in.
    dialogHeading.dataset.vocabCategory = category
    $('#addToVocabularyDialogSelect').append(dialogHeading)
    vocabLines.forEach(line => {
      if (!VOCAB_HIDDEN_CATEGORIES.has(category)) {
        $('#searchedWords').append(createOptionElement(line, window.preSelectedSearchedWord && window.preSelectedSearchedWord === line))
      }
      $('#addToVocabularyDialogSelect').append(createOptionElement(line, window.preSelectedSearchedWord && window.preSelectedSearchedWord === line))
    })
    done += 1
    $('#vocabLoadingBarFill').css('width', `${(done / total) * 100}%`)
  };
  schedule(categories, .005 , it => {
    // A category gone from window.vocabulary meanwhile (a save swapping the
    // map mid-rebuild) must not stop the run: the completion below re-enables
    // the dialog buttons.
    try { populateLines(it) } catch (e) { console.warn('loadWholeVocabulary: skipped category', it, e) }
  }, () => {
    $('#addToVocabBtn, #headerAddToVocabBtn').prop('disabled', false)
    $('#vocabLoadingBar').hide()
    _vocabSelectRebuilds = Math.max(0, _vocabSelectRebuilds - 1)
    _refreshVocabDeleteBtn()
    if (typeof onDone === 'function') {
      try { onDone() } catch (e) { console.warn('loadWholeVocabulary onDone failed', e) }
    }
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
  localStorage.removeItem(_searchesKey())
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
  // Without an own repo nothing typed here could be saved.
  if (!_requireSelf()) return
  const width = Math.min(500, Math.floor(window.innerWidth * 0.94))
  const maxHeight = Math.floor(window.innerHeight * 0.85)

  // The dialog was minimized, not closed, so the words half-typed in it are
  // still there. Pick it up where it was left instead of starting over â€” only
  // the reference word is refreshed below, to follow whatever was searched in
  // the meantime.
  const resuming = _isDialogMinimized('addToVocabularyDialog')

  // Discard any in-progress text so the new dialog starts blank â€” saves only
  // happen on the Save button via addToVocab(); closing the dialog (via the
  // X or Escape) must NOT carry over typed words.
  const discardSegment = () => {
    $('#vocabularySegmentTextarea').val('')
    $('#vocabNewCategory').val('').trigger('change.select2')
  };
  if (!resuming) discardSegment();
  _refreshVocabCategories()
  // Restore the pending-hint when reopening â€” staged-but-uncommitted
  // edits survive a dialog close (we no longer auto-commit on close).
  _refreshVocabPendingHint()

  // Mirror the main select's current line into the dialog's reference select
  // so the user starts on the line they were already inspecting. Skip
  // category headings (`__cat__:foo`) â€” those aren't valid reference words.
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
        } catch (_) { /* heading or unparseable â€” skip */ }
      })
    }
    if (dialogVal) {
      $('#addToVocabularyDialogSelect').val(dialogVal).trigger('change.select2')
    }
  } catch (_) { /* leave dialog selection as-is */ }
  // 'change.select2' above reaches select2 only, not the change handler.
  _refreshVocabDeleteBtn()

  // If Insert position is sticky on "inline" (e.g. from a prior session),
  // pre-fill the textarea with the chosen reference word so the user can
  // edit in place â€” matches the behaviour of switching to inline manually.
  // Skipped when resuming: it would overwrite the text being typed.
  if (!resuming && _vocabInsertPosition() === 'inline') _syncVocabInsertText('inline')

  // Closing the dialog does NOT commit to GitHub â€” only the explicit save
  // buttons do. Staged edits remain in window.vocabulary; reopening the
  // dialog restores the pending-hint and a later save commits them.
  const onDialogClose = () => {
    $('#vocabNewCategory').select2('close')
    discardSegment()
    $('#vocabPendingHint').hide()
  }

  setTimeout(() => {
    if (_restoreMinimizedDialog('addToVocabularyDialog')) return
    const $dialog = $("#addToVocabularyDialog")
    $dialog.dialog({
      width, maxHeight, title: 'Add to vocab', close: onDialogClose,
      classes: { 'ui-dialog': 'vocab-dialog-window' },
    }).dialog('open')
    _addDialogMinimizeButton('addToVocabularyDialog', 'âž•', 'Add to vocab')
    _wireVocabKeyboardScroll()
  }, 0)
}

// On mobile, the soft keyboard slides up from the bottom and shrinks the
// visible (visualViewport) area, so the textarea â€” which sits in the lower
// half of the dialog â€” ends up hidden under the keyboard. Re-anchor it on
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
// "y)" â€” unbalanced parts, which break downstream pipe-separated processing.
// Nested parens within a single segment, like "(x(a))", are fine.
// isProperlyBracketed lives in ./vocab-merge.js (imported at the top).
window.isProperlyBracketed = isProperlyBracketed;

function addToVocab(commitAndClose) {
  // Backwards-compat: legacy onclick="addToVocab()" calls land with no arg â€”
  // treat that as the old single-shot Save behaviour.
  if (commitAndClose === undefined) commitAndClose = true

  // No own repo (a guest): an edit could never be saved, so say so instead
  // of keeping it in memory and in the unsaved-edits buffer.
  if (!_requireSelf()) return

  const newText = $("#vocabularySegmentTextarea").val().trim()
  if (!newText) {
    // "Save & Close" pressed with an empty textarea: if there are already
    // staged additions from earlier rounds, refresh the selects (we held
    // off during "Add another"), then commit and close.
    if (commitAndClose && window._vocabHasPendingChanges) {
      const $addAnother = $('#addVocabAddAnotherBtn')
      const $saveClose  = $('#addVocabSaveCloseBtn')
      $addAnother.prop('disabled', true)
      $saveClose.prop('disabled', true)
      loadWholeVocabulary(() => {
        $addAnother.prop('disabled', false)
        $saveClose.prop('disabled', false)
      })
      commitVocabularyToGithub()
      window._vocabHasPendingChanges = false
      window._vocabPendingCount = 0
      window._vocabPendingDeleteCount = 0
      _refreshVocabPendingHint()
      $("#addToVocabularyDialog").dialog("close")
      autoHideSettingsPanel()
    }
    return
  }

  // If the user selected a category, append to that
  // category â€” creating it if missing â€” and skip the reference-word/Insert
  // path entirely. This is the way to add a brand-new entry (e.g. seed
  // the `expansions` category for the first time).
  const selectedCategory = $("#vocabNewCategory").val()
  let category, refWord
  if (selectedCategory) {
    category = selectedCategory
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

  const position = _vocabInsertPosition()
  const newWords = newText.split("\n").map(w => w.trim()).filter(w => w.length > 0)

  const invalidLine = newWords.find(w => !isProperlyBracketed(w));
  if (invalidLine) {
    alert(
      'Invalid line â€” brackets must be balanced within each pipe-separated word.\n\n' +
      'Offending line:\n' + invalidLine + '\n\n' +
      'Note: a pipe `|` cannot appear inside parentheses/brackets/braces, since that ' +
      'splits the bracket pair across two separate words.'
    );
    return;
  }

  // The other user's lines can't be edited in place: an inline edit would
  // replace their line, which is never saved.
  const readOnlyLines = window._vocabularyReadOnly || new Set()
  if (refWord && position === 'inline' && readOnlyLines.has(refWord)) {
    alert("This line is from the other user's vocabulary and can't be edited here. Choose Above or Below to add your own line.")
    return
  }
  // A line the user adds is theirs, even when the other user has the same
  // text: their copy is dropped so the user's is the one shown and saved.
  // When that copy is the reference line itself, the new lines go where it
  // was: `refSlot` is its position among the lines that stay.
  const wordsBefore = ownLines(window.vocabulary, category)
  const refAt = refWord ? wordsBefore.indexOf(refWord) : -1
  const claimed = _dsClaimVocabularyLines(window.vocabulary, readOnlyLines,
    window._vocabularyOtherCategories || new Set(), newWords)
  let refSlot = -1
  if (claimed.readOnly !== readOnlyLines) {
    window.vocabulary = claimed.vocab
    window._vocabularyReadOnly = claimed.readOnly
    if (refAt >= 0 && !claimed.readOnly.has(refWord) && readOnlyLines.has(refWord)) {
      refSlot = wordsBefore.slice(0, refAt).filter(l => !(readOnlyLines.has(l) && !claimed.readOnly.has(l))).length
    }
  }

  const categoryWords = ownLines(window.vocabulary, category)
  if (!refWord) {
    // No reference word â€” just append to the (possibly new) category.
    categoryWords.push(...newWords)
  } else if (refSlot >= 0 && categoryWords.indexOf(refWord) < 0) {
    categoryWords.splice(refSlot, 0, ...newWords)
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
  Object.defineProperty(window.vocabulary, category, {
    value: categoryWords, writable: true, enumerable: true, configurable: true,
  })

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
  if (!window._vocabDirtyCategories) window._vocabDirtyCategories = Object.create(null)
  window._vocabDirtyCategories[category] = true
  _savePendingVocab()

  // Rebuild the selects so the in-dialog dropdowns reflect what's already
  // been staged this session â€” otherwise "Add another" leaves the picker
  // showing pre-edit state, which makes it look as if the entry didn't
  // land. GitHub push is still deferred until Save & Close.
  //
  // The rebuild is async (loadWholeVocabulary uses schedule()), so the
  // dialog buttons get disabled while it runs to (a) give the user visual
  // feedback that the picker is refreshing and (b) prevent a double-click
  // from racing the rebuild. Re-enabled in the onDone callback.
  const $addAnother = $('#addVocabAddAnotherBtn')
  const $saveClose  = $('#addVocabSaveCloseBtn')
  const origAddLabel = $addAnother.text()
  $addAnother.prop('disabled', true).text('Updatingâ€¦')
  $saveClose.prop('disabled', true)
  loadWholeVocabulary(() => {
    $addAnother.prop('disabled', false).text(origAddLabel)
    $saveClose.prop('disabled', false)
  })
  if (commitAndClose) {
    commitVocabularyToGithub()
    window._vocabHasPendingChanges = false
    window._vocabPendingCount = 0
    window._vocabPendingDeleteCount = 0
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

// The line chosen in the dialog's reference select, as
// { line, category, occurrence } (occurrence: which copy of that text within
// the category, 0 = first), or null when no line is chosen (nothing, a
// heading or a blank-line separator).
function _selectedVocabDialogLine() {
  const opt = $('#addToVocabularyDialogSelect option:selected')[0]
  if (!opt || opt.disabled || !opt.value) return null
  let line
  try {
    const parsed = JSON.parse(opt.value)
    line = parsed && typeof parsed.o === 'string' ? parsed.o : null
  } catch (_) { return null }
  if (!line || !line.trim()) return null
  let category = null
  let occurrence = 0
  for (let o = opt.previousElementSibling; o; o = o.previousElementSibling) {
    if (o.dataset && o.dataset.vocabCategory !== undefined) { category = o.dataset.vocabCategory; break }
    if (o.value === opt.value) occurrence++
  }
  if (category === null) return null
  return { line, category, occurrence }
}

// "Delete line" is usable only for a chosen line of the user's own, with an
// own repo, while the reference list isn't being refilled.
function _refreshVocabDeleteBtn() {
  const btn = document.getElementById('addVocabDeleteBtn')
  if (!btn) return
  let title = 'Delete the selected line. Nothing is committed until you Save & Close.'
  let enabled = false
  const sel = _vocabSelectRebuilds > 0 ? null : _selectedVocabDialogLine()
  if (!_dsHasSelf()) title = SETUP_REPO_MSG
  else if (_vocabSelectRebuilds > 0) title = 'Updating the listâ€¦'
  else if (!sel) title = 'Select a line to delete.'
  else if ((window._vocabularyReadOnly || new Set()).has(sel.line)) {
    title = "This line is from the other user's vocabulary and can't be deleted here."
  } else enabled = true
  btn.disabled = !enabled
  btn.title = title
}

function deleteVocabLine() {
  if (!_requireSelf()) return
  if (_vocabSelectRebuilds > 0) return
  const sel = _selectedVocabDialogLine()
  if (!sel) return
  const readOnly = window._vocabularyReadOnly || new Set()
  if (readOnly.has(sel.line)) {
    alert("This line is from the other user's vocabulary and can't be deleted here.")
    return
  }
  if (!confirm(`Delete this line from "${sel.category}"?\n\n${sel.line}\n\nIt is removed from GitHub when you Save & Close.`)) return
  const res = removeVocabularyLine(window.vocabulary || {}, readOnly, sel.category, sel.line, sel.occurrence)
  if (!res.vocab) {
    alert(`Couldn't delete this line (${res.reason}).`)
    return
  }
  // A line staged earlier and not yet saved just drops out of the "new"
  // count; a saved one counts as a deletion.
  const wasSaved = ownLines(parseVocabularyFile(window._vocabularyBaselineText || ''), sel.category).includes(sel.line)
  window.vocabulary = res.vocab

  // Keep the main select's chosen line across the rebuild, as addToVocab does.
  try {
    const rawVal = $('#searchedWords').val()
    if (typeof rawVal === 'string' && rawVal && !rawVal.startsWith('__cat__:')) {
      const parsed = JSON.parse(rawVal)
      if (parsed && typeof parsed.o === 'string') window.preSelectedSearchedWord = parsed.o
    }
  } catch (_) {}
  // In "inline" mode the textarea holds the deleted line; leaving it would
  // add the line back on Save & Close.
  const $ta = $('#vocabularySegmentTextarea')
  if (($ta.val() || '').trim() === sel.line.trim()) $ta.val('')

  window._vocabHasPendingChanges = true
  if (wasSaved) {
    window._vocabPendingDeleteCount = (parseInt(window._vocabPendingDeleteCount, 10) || 0) + 1
  } else {
    window._vocabPendingCount = Math.max(0, (parseInt(window._vocabPendingCount, 10) || 0) - 1)
  }
  if (!window._vocabDirtyCategories) window._vocabDirtyCategories = Object.create(null)
  window._vocabDirtyCategories[sel.category] = true
  _savePendingVocab()
  _refreshVocabPendingHint()

  const $addAnother = $('#addVocabAddAnotherBtn')
  const $saveClose  = $('#addVocabSaveCloseBtn')
  $addAnother.prop('disabled', true)
  $saveClose.prop('disabled', true)
  loadWholeVocabulary(() => {
    $addAnother.prop('disabled', false)
    $saveClose.prop('disabled', false)
  })
}

function _vocabInsertPosition() {
  return $('#vocabInsertPosition input:checked').val()
}

function _syncVocabInsertText(position) {
  try {
    const parsed = JSON.parse($('#addToVocabularyDialogSelect').val())
    const refWord = parsed.o || parsed.word
    const $textarea = $('#vocabularySegmentTextarea')
    if (position === 'inline') $textarea.val(refWord)
    else if ($textarea.val().trim() === (refWord || '').trim()) $textarea.val('')
  } catch (_) {}
}

// vocabularyToText lives in ./vocab-merge.js (imported at the top).

// Open the settings panel as a jQuery UI dialog. Reusing the existing
// #settingsPanel div lets us keep the inputs and their wiring intact â€”
// jQuery UI just relocates the element into a dialog wrapper on first
// open. Clicking the gear again closes the dialog (toggle).
function openSettingsDialog() {
  const $panel = $('#settingsPanel')
  organizeSettingsPanel($panel[0])
  $('#practiceRevealMode').val(window._appSettings.practiceRevealMode || 'flip')
  if ($panel.hasClass('ui-dialog-content') && $panel.dialog('isOpen')) {
    $panel.dialog('close')
    return
  }
  // Don't clear the original `display:none` inline style here â€” jQuery
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
    // jQuery UI auto-focuses the first tabbable element â€” on mobile that's
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
  if ($panel.hasClass('ui-dialog-content')) {
    $panel.dialog('option', opts).dialog('open')
  } else {
    $panel.dialog(opts)
  }
}
window.openSettingsDialog = openSettingsDialog

// A dialog opened from Settings takes its place: Settings closes. Done once
// here rather than in each opener so a new button in the panel gets it too.
// "Opened from" = a dialog that opens shortly after a click inside the panel;
// some openers fetch first, hence the window rather than the same tick.
const SETTINGS_HANDOFF_MS = 3000
let _settingsClickAt = 0
document.addEventListener('click', e => {
  const t = e.target
  if (t && t.closest && t.closest('#settingsPanel')) {
    const action = t.closest('button, a')
    _settingsClickAt = action && !action.closest('.settings-nav, .settings-done') ? Date.now() : 0
  }
}, true)
$(document).on('dialogopen', e => {
  if (!e.target || e.target.id === 'settingsPanel') return
  if (Date.now() - _settingsClickAt > SETTINGS_HANDOFF_MS) return
  _settingsClickAt = 0
  autoHideSettingsPanel()
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Build info + in-app Log Viewer
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Show when /language/language.js was last modified on the server (HEAD
// request) plus the HTML's document.lastModified as a fallback /
// cross-check. Lets the user confirm a deploy actually shipped without
// opening DevTools.
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
    const r = await fetch('/language/language.js', { method: 'HEAD', cache: 'no-cache' })
    const h = r.headers.get('Last-Modified')
    if (h) jsLM = new Date(h)
  } catch (_) {}
  const jsTxt   = jsLM   ? `js ${_fmtLocal(jsLM)}`   : null
  const htmlTxt = htmlLM ? `html ${_fmtLocal(htmlLM)}` : null
  const parts = [jsTxt, htmlTxt].filter(Boolean)
  $el.text(parts.length ? 'Built: ' + parts.join(' Â· ') : 'Built: unknown')
}
window.populateBuildInfo = populateBuildInfo

// Thin shim â€” reads filter inputs, delegates to the pure VM + DOM emitter
// in ./renderer/log-viewer-*.js.
function _renderLogViewer() {
  const $body = $('#logViewerBody')
  if (!$body.length) return
  const rows = filterLogs(window.__logBuffer || [], {
    level: $('#logViewerLevel').val() || 'all',
    query: $('#logViewerSearch').val() || '',
  })
  renderLogViewerBody(rows, $body[0])
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
    // Wire toolbar once â€” jQuery UI keeps the same DOM across opens.
    $('#logViewerLevel, #logViewerSearch').on('input change', _renderLogViewer)
    $('#logViewerCopy').on('click', async () => {
      const text = formatLogsAsText(window.__logBuffer || [])
      try {
        await navigator.clipboard.writeText(text)
        $('#logViewerCopy').text('Copied').delay(900).queue(function (n) { $(this).text('Copy'); n() })
      } catch (_) {
        // Clipboard API blocked (no HTTPS / no gesture chain): fall back to
        // selecting the body so the user can long-press â†’ copy on mobile.
        const el = $('#logViewerBody')[0]
        if (el) {
          const r = document.createRange(); r.selectNodeContents(el)
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
          alert('Clipboard blocked â€” text is selected, long-press to copy.')
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

// Every single-file write goes to self. Throws NoSelfRepoError (the "set up
// your repo" message) when there is no self; callers surface e.message.
function commitWithMerge(opts) {
  requireStudyLanguage(window.location)
  const context = _dsCaptureSourceContext()
  const t = _dsWriteTarget()
  return _coreCommitWithMerge({ ...opts, branch: t.branch },
    { githubUtils: window.GitHubUtils, owner: t.owner, repo: t.repo, assertCurrent: context.assertCurrent })
}

// A GitHub-API (uncached) read of a file in self.
async function _selfGetFile(filePath) {
  const context = _dsCaptureSourceContext()
  const t = _dsWriteTarget()
  const file = await window.GitHubUtils.getFile(t.owner, t.repo, filePath, '', t.branch)
  context.assertCurrent()
  return file
}

let _committedSubtitleIndex = new Map()
// Keep virtual single-SRT edits compatible with the bundled repository.
window.GitHubUtils?.setSubtitleAdapter?.(createSubtitleBundleAdapter({
  onCommitted({ index }) {
    _subtitleBundleLoader.clear()
    const byLink = new Map(index.map(entry => [entry.link, entry]))
    _committedSubtitleIndex = byLink
    window.srts = (window.srts || []).map(entry => {
      if (entry.readOnly) return entry
      const next = byLink.get(entry.link)
      return next ? { ...entry, ...next } : entry
    })
    for (const entry of index) if (!(window.srts || []).some(e => e.link === entry.link)) {
      window.srts.push({ ...entry, src: 'self', owner: _sourceOwner('self'), readOnly: false })
    }
  },
}))

// Writes need a self repo. Without one, shows the set-up prompt
// (window.cupitorShowSetupPrompt when present, else an alert with the same
// text) and returns false.
// Called first in every user-facing write action, before any confirm,
// prompt or network call, so nothing is half done and nothing is queued.
const SETUP_REPO_MSG = 'Set up your repo to save changes.'
function _requireSelf() {
  if (_dsHasSelf()) return true
  const show = window.cupitorShowSetupPrompt
  if (typeof show === 'function') show(SETUP_REPO_MSG)
  else alert(SETUP_REPO_MSG)
  return false
}

// The repo folder writes go to: db/language/<lang>, with the same lowercased,
// validated language the reads use (_dsLangFromLocation), so a mixed-case
// ?lang= cannot write somewhere the app never reads from.
function _langRepoDir() {
  return _dsDataRoot()
}

// 3-way merge of categorised vocab files. base = text we loaded, localVocab =
// in-memory current state, remoteText = latest from api.github.com. Lines
// added locally are kept; lines removed locally (in base, absent in local)
// are dropped; remote-only additions are appended; remote-only deletions
// (in base, absent in remote, unchanged locally) are also dropped.
// mergeVocabulary lives in ./vocab-merge.js (imported at the top).

// The vocabulary layer state next to window.vocabulary: which lines and
// categories are the other user's (read-only, never saved) and their file,
// kept to add their lines again after a save or a replayed buffer.
window._vocabularyReadOnly = new Set()
window._vocabularyOtherCategories = new Set()
window._vocabularyOtherText = null
function _setVocabularyLayers({ vocab, readOnly, otherCategories, otherText }) {
  window.vocabulary = vocab
  window._vocabularyReadOnly = readOnly
  window._vocabularyOtherCategories = otherCategories
  if (otherText !== undefined) window._vocabularyOtherText = otherText
}
// window.vocabulary without the other user's lines: all a save may hold.
function _ownVocabulary() {
  return _dsWithoutReadOnlyLines(window.vocabulary || {},
    window._vocabularyReadOnly || new Set(), window._vocabularyOtherCategories || new Set())
}

async function commitVocabularyToGithub() {
  if (!_requireSelf()) return
  const filePath = `${_langRepoDir()}/vocabulary.txt`
  const baselineText = window._vocabularyBaselineText || ''
  const localVocab = _ownVocabulary()
  const pendingSnapshot = _userData.getItem(PENDING_VOCAB_KEY)
  const context = _dsCaptureSourceContext()
  try {
    await _userData.flush()
    context.assertCurrent()
    const finalText = await commitWithMerge({
      filePath,
      commitMessage: 'vocab: update vocabulary via language tool',
      merge: (remoteText) => {
        const merged = mergeVocabulary(baselineText, localVocab, remoteText || '')
        return vocabularyToText(merged)
      }
    })
    context.assertCurrent()
    const concurrent = _userData.getItem(PENDING_VOCAB_KEY) !== pendingSnapshot
    const nextText = concurrent
      ? vocabularyToText(mergeVocabulary(baselineText, _ownVocabulary(), finalText))
      : finalText
    _setVocabularyLayers(_dsMergeVocabularyLayers(nextText, window._vocabularyOtherText))
    window._vocabularyBaselineText = finalText
    if (concurrent) _savePendingVocab()
    else _clearPendingVocab()
    await _userData.flush()
    console.log('Vocabulary committed to GitHub')
  } catch (e) {
    console.error('Failed to commit vocabulary to GitHub:', e)
    alert('Saved in memory but GitHub commit failed: ' + e.message)
  }
}

// â”€â”€â”€ Unpushed vocab buffer (parallel to pendingSrtEdits) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Captures every locally-modified category so the user doesn't lose
// uncommitted edits if they close the tab before the next sync. On boot
// we replay the buffer onto the freshly-fetched remote vocabulary; on a
// successful commit we drop it. The buffer is keyed by language so opening
// a different language tab doesn't replay foreign categories.
const PENDING_VOCAB_KEY = _scopedKey('cupitor:pendingVocab')
function _loadPendingVocab() {
  try {
    const raw = _userData.getItem(PENDING_VOCAB_KEY)
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
      _userData.removeItem(PENDING_VOCAB_KEY)
      return
    }
    // Own lines only: the other user's lines never enter the buffer, so a
    // replay can't carry them into a save.
    const categories = _dsPendingVocabCategories(window.vocabulary, dirtyNames,
      window._vocabularyReadOnly || new Set(), window._vocabularyOtherCategories || new Set())
    if (!Object.keys(categories).length) {
      _userData.removeItem(PENDING_VOCAB_KEY)
      return
    }
    const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || ''
    const pendingCount = parseInt(window._vocabPendingCount, 10) || 0
    const pendingDeleteCount = parseInt(window._vocabPendingDeleteCount, 10) || 0
    _userData.setItem(PENDING_VOCAB_KEY, JSON.stringify({ lang, categories, pendingCount, pendingDeleteCount, ts: Date.now() }))
  } catch (_) {}
}
function _clearPendingVocab() {
  try { _userData.removeItem(PENDING_VOCAB_KEY) } catch (_) {}
  window._vocabDirtyCategories = Object.create(null)
  window._vocabHasPendingChanges = false
  window._vocabPendingCount = 0
  window._vocabPendingDeleteCount = 0
  _refreshVocabPendingHint()
}

// Re-render the in-dialog "unsaved changes pending" hint with the current
// counts of lines added and deleted since the last commit (reset on Save &
// Close, kept in the unsaved-edits buffer). Falls back to a count-less
// message when no count is known (e.g. an older buffer replayed on boot).
function _refreshVocabPendingHint() {
  const $h = $('#vocabPendingHint')
  if (!$h.length) return
  if (!window._vocabHasPendingChanges) { $h.hide(); return }
  $h.text(vocabPendingHintText(window._vocabPendingCount, window._vocabPendingDeleteCount)).show()
}
// Called once after the initial vocabulary fetch parses into window.vocabulary.
// Replays any locally-cached category snapshots so the user's unpushed work
// is back in memory + visible in the UI ready for another Sync.
function _replayPendingVocab() {
  const buf = _loadPendingVocab()
  if (!buf || !buf.categories) return
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || ''
  if (buf.lang && buf.lang !== lang) return
  // No own repo: nothing could be saved, so nothing is replayed (the buffer
  // is left as it is).
  if (!_dsHasSelf()) return
  if (!window.vocabulary) window.vocabulary = Object.create(null)
  if (!window._vocabDirtyCategories) window._vocabDirtyCategories = Object.create(null)
  const cats = Object.keys(buf.categories)
  // The buffer holds own lines only. One the other user also has (claimed
  // in addToVocab, not yet saved) is read-only again after a reload; claim
  // it again so the relayer below keeps it.
  const bufLines = cats.flatMap(cat => Array.isArray(buf.categories[cat]) ? buf.categories[cat] : [])
  const roBefore = window._vocabularyReadOnly || new Set()
  const claimed = _dsClaimVocabularyLines(window.vocabulary, roBefore,
    window._vocabularyOtherCategories || new Set(), bufLines)
  if (claimed.readOnly !== roBefore) {
    window.vocabulary = claimed.vocab
    window._vocabularyReadOnly = claimed.readOnly
  }
  let any = 0
  cats.forEach(cat => {
    if (Array.isArray(buf.categories[cat])) {
      window.vocabulary[cat] = buf.categories[cat]
      window._vocabDirtyCategories[cat] = true
      any++
    }
  })
  if (any) {
    // A replayed category holds own lines only; add the other user's lines
    // to it again.
    if (window._vocabularyOtherText) {
      _setVocabularyLayers(_dsRelayerVocabulary(window.vocabulary, window._vocabularyReadOnly || new Set(),
        window._vocabularyOtherCategories || new Set(), window._vocabularyOtherText))
    }
    window._vocabHasPendingChanges = true
    // Restore the entry counter persisted alongside the buffer. Older payloads
    // didn't include it â€” fall back to 0 so the hint just says "unsaved
    // changes pending" without a misleading number.
    window._vocabPendingCount = parseInt(buf.pendingCount, 10) || 0
    window._vocabPendingDeleteCount = parseInt(buf.pendingDeleteCount, 10) || 0
    _refreshVocabPendingHint()
    console.log(`Replayed ${any} pending vocab categor${any === 1 ? 'y' : 'ies'} (${window._vocabPendingCount} new, ${window._vocabPendingDeleteCount} deleted) from local cache â€” push via Save & Close to sync.`)
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
  const own = _ownVocabulary()
  const data = Object.keys(own)
      .map(k => `#${k}\n${own[k].join("\n")}`).join("\n")
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

// Allocate the request token *before* waiting on app initialization.
// Otherwise an older search can become the newest after its late await.
async function doSearch(searchThis, el) {
  const query = typeof searchThis === 'string' ? searchThis : $('#searchText').val()
  window._requestedSearchText = query
  const token = (window._subtitleSearchToken || 0) + 1
  window._subtitleSearchToken = token
  window._vocabularyHintQuery = String(query || '')
  window.cupitorSubtitleSearch?.cancel()
  if (!String(query || '').trim()) {
    window.searchText = window._librarySearchText = window._vocabularySearchText = ''
    window.searchResult = []
    window.wordToItemsMap = window._shownWordToItemsMap = window._lastWordToItemsMap = {}
    window._subtitleSearchCompletion = null
    resetSearchResultIndex()
    _clearSearchLoading()
    _hideStaleTranslationPanel()
    _resetLibrarySearch()
    $('#result, #vocabularyResult').empty()
    $('#search-pagination').hide()
    return false
  }
  if (window._renderVocabularyHintsEarly && !window.unprocessedSearchText) {
    if (!window.vocabulary) await window._vocabularyReadyPromise
    if (token !== window._subtitleSearchToken) return false
    if (window._renderVocabularyHintsEarly(query)) return true
  }
  const searchSrts = window._appSettings?.includeSrtsInSearch !== false
  if (!window.vocabulary || (searchSrts && !window._subtitlesLoaded)) {
    console.log('[search] data not loaded yet, deferring until vocabulary + subtitles readyâ€¦')
    await Promise.all([window._vocabularyReadyPromise, ...(searchSrts ? [window._subtitlesReadyPromise] : [])])
  }
  if (token !== window._subtitleSearchToken) return false
  const completed = await fetchSRTs(query, token)
  if (!completed || token !== window._subtitleSearchToken) return false
  _maybeAutoLibrarySearch()
  if (el) {
    const newItem = saveSearch(query, null)
    if (newItem) el.append(new Option(`${query}`, query, false, false))
  }
  return true
}

const SEARCH_NAV_HISTORY_KEY = _scopedKey('searchNavHistory')
const SEARCH_NAV_HISTORY_MAX = 200

// Storage shape: Array<string | { t: string, l: 'en' | 'known' }>. Plain strings are
// main-language (sv) searches â€” keeping them as bare strings preserves
// backward compatibility with previously-saved history AND saves ~10 bytes
// per entry vs an object wrapper. Objects only appear for non-main langs.
function _normLangFor(lang) {
  return lang === 'en' || lang === 'known' ? lang : null
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
  _refreshSearchHistoryPanel()
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
  if (newIdx === cur) return
  replaySearchHistoryAt(newIdx)
}

// Run the search stored at one position in the history, and stand on it.
//
// The stepping buttons reach this one position at a time; the list behind a
// long press hands it any position at all, which is the whole point of the
// list â€” a search five back is five taps away otherwise.
function replaySearchHistoryAt(newIdx) {
  const list = window.sessionSearchHistory
  if (!list || !list.length) return
  if (!Number.isFinite(newIdx) || newIdx < 0 || newIdx > list.length - 1) return
  window.sessionHistoryIndex = newIdx
  _refreshSearchHistoryPanel()
  const entry = list[newIdx]
  const term = _historyEntryTerm(entry)
  const lang = _historyEntryLang(entry)
  if (typeof term !== 'string' || !term) return
  window._navigatingHistory = true
  // Replay in the language the search was originally in, regardless of the
  // current UI toggle. Cleared in fetchSRTs's finally block.
  window.forceLangForNextSearch = lang === 'known' ? null : lang === 'en' ? 'en' : 'sv'
  // Sync the toggle so the user can see which language the replayed search is
  // in. After forceLang is cleared, the next typed search will follow this
  // toggle position, which matches user intent.
  _setLangToggle(lang === 'en' || (lang === 'known' && _vocabularyLookupLanguage() === 'en'),
    lang === 'known' && _vocabularyLookupLanguage() !== 'en')
  // Trigger 'input' (not 'change') so the X-clear button visibility updates
  // without re-firing the typed-search flow on top of our explicit doSearch
  // call below.
  $('#searchText').val(term).trigger('input')
  // Set unprocessedSearchText to the term itself so render() can anchor on
  // the original line via renderVocabularyLineByText for history items
  // that were originally vocab-line clicks. Typed-term history items just
  // fall through (renderVocabularyLineByText returns false â†’ the regular
  // renderVocabularyFindings path runs).
  window.unprocessedSearchText = term
  Promise.resolve(doSearch(term, $('#searchedWords')))
      .finally(() => { window._navigatingHistory = false })
}

// â”€â”€â”€ The history behind the stepping buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Stepping is fine for the search before this one. It is not fine for the one
// before the five you have run since â€” that is five taps, each of them a real
// search that loads subtitles and redraws the page. A long press on either
// button opens the whole list instead, and any entry in it is one tap away.
//
// Both buttons open the same list. The history is a single line whichever end
// of it you happen to be walking from, so a long press on Next reaches
// something older just as a long press on Prev reaches something newer; where
// you are standing is marked, which is the only thing the two directions
// disagree about.
function _searchHistoryPanelEl() {
  let $p = $('#searchHistoryPanel')
  if (!$p.length) {
    $p = $('<div id="searchHistoryPanel" class="srch-hist-panel" style="display:none;"></div>')
    $p.appendTo('body')
    $p.on('click', '.srch-hist-row', function (e) {
      e.preventDefault(); e.stopPropagation()
      const idx = parseInt(this.getAttribute('data-idx'), 10)
      _closeSearchHistoryPanel()
      window._searchHistoryAnchor?.focus({ preventScroll: true })
      replaySearchHistoryAt(idx)
    })
  }
  // Reparent once so no clipping or stacking toolbar ancestor squashes it.
  if ($p.parent()[0] !== document.body) $p.appendTo(document.body)
  return $p
}

function _renderSearchHistoryPanel() {
  const $p = $('#searchHistoryPanel')
  if (!$p.length) return
  const list = window.sessionSearchHistory || []
  const cur = (typeof window.sessionHistoryIndex === 'number') ? window.sessionHistoryIndex : -1
  let html = '<div class="srch-hist-hd">Recent searches</div>'
  if (!list.length) {
    html += '<div class="srch-hist-empty">Nothing searched yet.</div>'
  } else {
    // Newest first, the way a browser's back button reads. The stored order is
    // the opposite, so the index each row carries is its place in the list and
    // not its place on screen.
    const rows = []
    for (let i = list.length - 1; i >= 0; i--) {
      const term = _historyEntryTerm(list[i])
      if (typeof term !== 'string' || !term) continue
      const choice = _historyEntryLang(list[i])
      const lang = choice === 'known' ? _vocabularyLanguageName(_vocabularyLookupLanguage()) : choice === 'en' ? 'EN' : ''
      rows.push(`<button type="button" class="srch-hist-row${i === cur ? ' is-current' : ''}" data-idx="${i}">`
        + `<span class="srch-hist-term">${_.escape(term)}</span>`
        + (lang ? `<span class="srch-hist-lang">${_.escape(lang)}</span>` : '')
        + (i === cur ? '<span class="srch-hist-here">here</span>' : '')
        + '</button>')
    }
    html += rows.join('')
  }
  $p.html(html)
}

// Anchored under whichever button was held, clamped to the viewport.
function _positionSearchHistoryPanel(btn) {
  const $p = $('#searchHistoryPanel')
  if (!btn || !$p.length || !$p.is(':visible')) return
  const r = btn.getBoundingClientRect()
  const vw = window.innerWidth
  const pw = Math.min(280, Math.floor(vw * 0.9))
  let left = Math.round(r.left + r.width / 2 - pw / 2)
  if (left + pw > vw - 8) left = vw - 8 - pw
  if (left < 8) left = 8
  const maxH = Math.max(160, window.innerHeight - r.bottom - 12)
  $p.css({ left: left + 'px', top: (r.bottom + 4) + 'px', width: pw + 'px', maxHeight: maxH + 'px' })
}

function _closeSearchHistoryPanel() {
  $('#searchHistoryPanel').hide()
  $('#searchHistoryBtn').attr('aria-expanded', 'false')
}

// The list is a picture of the history, and the history moves under it: a step
// with the buttons moves where "here" is, and a search recorded while the list
// is open shifts every entry along by one â€” which would leave a row replaying
// its neighbour. Cheap enough to simply redraw.
function _refreshSearchHistoryPanel() {
  const list = window.sessionSearchHistory || []
  const index = window.sessionHistoryIndex
  $('#prevSearchBtn').attr('aria-disabled', String(!list.length || index === 0))
  $('#nextSearchBtn').attr('aria-disabled', String(index < 0 || index >= list.length - 1))
  if ($('#searchHistoryPanel').is(':visible')) _renderSearchHistoryPanel()
}

function _openSearchHistoryPanel(btn) {
  const $p = _searchHistoryPanelEl()
  _renderSearchHistoryPanel()
  $p.show()
  _positionSearchHistoryPanel(btn)
  window._searchHistoryAnchor = btn
  if (btn.id === 'searchHistoryBtn') $(btn).attr('aria-expanded', 'true')
  // Put where you are standing in view â€” with a long history the current entry
  // is otherwise somewhere below the fold, and it is the one landmark the list
  // has.
  const here = $p.find('.srch-hist-row.is-current')[0]
  if (here && typeof here.scrollIntoView === 'function') {
    try { here.scrollIntoView({ block: 'nearest' }) } catch (_) {}
  }
}

function _toggleSearchHistoryPanel(btn) {
  if ($('#searchHistoryPanel').is(':visible')) { _closeSearchHistoryPanel(); return }
  _openSearchHistoryPanel(btn)
}

// A long press fires while the finger is still down, and the click that
// follows it on release would step the history under the list that just
// opened. Remembering when it fired is enough to tell the two apart.
function _searchHistoryWasLongPress() {
  return (Date.now() - (window._searchHistoryLongPressAt || 0)) < 700
}

function _wireSearchHistoryLongPress() {
  ;['prevSearchBtn', 'nextSearchBtn'].forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    // The library's own default is a second and a half, which reads as the page
    // having ignored you.
    el.setAttribute('data-long-press-delay', '450')
    el.addEventListener('long-press', e => {
      // Deliberately NOT preventDefault: the library reads that as "swallow the
      // next click" and installs a one-shot eater on the document, which goes
      // on waiting if the press ends in a drag and no click ever comes â€” and
      // then eats a tap the user meant for something else. The timestamp below
      // is what tells the two apart.
      window._searchHistoryLongPressAt = Date.now()
      _toggleSearchHistoryPanel(el)
    })
  })
  $(document).on('click.srchHist', e => {
    if ($(e.target).closest('#searchHistoryPanel, #prevSearchBtn, #nextSearchBtn, #searchHistoryBtn').length) return
    _closeSearchHistoryPanel()
  })
  $(document).on('keydown.srchHist', e => {
    if (e.key === 'Escape' && $('#searchHistoryPanel').is(':visible')) {
      _closeSearchHistoryPanel()
      window._searchHistoryAnchor?.focus({ preventScroll: true })
    }
  })
  $(window).on('resize.srchHist', () => _positionSearchHistoryPanel(window._searchHistoryAnchor))
}

const $searchText1 = $('#searchText');

// Automatic prefix suggestions are a single-word tool. Exact and related
// findings use the same matcher in both modes; phrase searches keep their
// full phrase semantics. The manual prefix action remains available.
function _shouldAutoPrefixSearch(term) {
  return typeof term === 'string' && term.trim().length > 0 && !/\s/.test(term.trim())
}

export async function searchTextChanged() {
  const term = $('#searchText').val()
  window.unprocessedSearchText = null
  return doSearch(term, $('#searchedWords'))
}

// parseVocabularyFile lives in ./vocab-merge.js (imported at the top).

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

// Resolves once loadAllSubtitles has finished â€” the parallel SRT fetches
// plus vocabulary / app-settings load. Hard-capped with a timeout so a
// hung network never freezes searches indefinitely.
window._subtitlesReadyPromise = Promise.race([
  new Promise(resolve => { window._subtitlesReadyResolve = resolve; }),
  new Promise(resolve => setTimeout(() => {
    if (!window._subtitlesLoaded) {
      console.warn('[search] subtitles ready promise timed out after 60s â€” proceeding with whatever loaded');
    }
    resolve();
  }, 60000))
]);

// _withTimeout lives in ./net.js (imported at the top).

// Apply `fn` to each item with a bounded concurrency window. Used for the
// initial SRT load so Chrome doesn't choke on hundreds of simultaneous
// fetches (net::ERR_INSUFFICIENT_RESOURCES). Each item's promise is fully
// settled (success or failure swallowed by the caller) before the slot is
// reused, so a single slow / hung fetch can't starve the rest if it has
// its own per-call timeout â€” which `_withTimeout` provides upstream.
// Boot-time SRT progress banner. With the index running into the hundreds,
// the parallel-but-bounded loader can take 10+ seconds; without UI the user
// thinks the page is frozen. Banner sits along the bottom of the viewport,
// updates as each SRT pair settles, and auto-hides on completion.
function _srtProgressShow(total) {
  let $b = $('#srtLoadingBanner')
  if (!$b.length) {
    $b = $(`<div id="srtLoadingBanner">
      <span id="srtLoadingText">Loading subtitles 0 / ${total}â€¦</span>
      <div class="srt-loading-track"><span id="srtLoadingFill"></span></div>
    </div>`).appendTo('body')
  }
  $('#srtLoadingText').text(`Loading subtitles 0 / ${total}â€¦`)
  $('#srtLoadingFill').css('width', '0%')
  $b.show()
}
function _srtProgressUpdate(done, total) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  $('#srtLoadingFill').css('width', pct + '%')
  $('#srtLoadingText').text(`Loading subtitles ${done} / ${total}â€¦ (${pct}%)`)
}
function _srtProgressHide() {
  // Briefly show 100% before hiding so the user gets a confirmation flash.
  $('#srtLoadingFill').css('width', '100%')
  $('#srtLoadingText').text('Subtitles loaded')
  setTimeout(() => $('#srtLoadingBanner').fadeOut(400), 600)
}

// _runInBatches lives in ./net.js (imported at the top).

// Retry a fetch up to `tries` times with exponential backoff and a per-attempt
// timeout. Used for the boot-critical fetches (srts/index.json, vocabulary.txt)
// because raw.githubusercontent.com occasionally returns 5xx / empty bodies on
// the very first hit after a deploy â€” a single failure currently strands the
// whole app with no data.
// Force NFC normalization on any string that goes into a GitHub SRT path or
// gets stored in window.srts / index.json. Without this, captured filenames
// can drift between NFC ("Ã¥" precomposed) and NFD ("a"+â—ŒÌŠ decomposed) â€” git
// treats them as different paths, so the same SRT ends up on remote twice
// and the local working tree fights with the index. macOS APFS is the usual
// culprit; YouTube metadata strings come in NFC, native filesystem ops can
// surface them as NFD on read. Normalizing to NFC at every boundary makes
// the storage layer monomorphic.
// _nfc and fetchWithRetry live in ./net.js (imported at the top).
// Local alias preserves the old name used at callsites in this file.
const _fetchWithRetry = fetchWithRetry

// In-memory copy of user preferences. Persisted to localStorage under
// `cupitor:appSettings:${lang}` (per-language, per-device). Mutated by the
// UI inputs in #settingsPanel and written via saveAppSettings. Defaults
// below apply when no localStorage entry exists yet.
window._appSettings = {
  contextLinesBefore: 2,
  contextLinesAfter: 2,
  showEditVocabulary: false,
  // Channel names whose subtitles are demoted to fallback â€” shown ONLY when
  // a word has no match from a non-blocked channel.
  blockedChannels: [],
  searchChannels: [],
  playbackSpeed: null,
  studySessionTimeoutMinutes: DEFAULT_STUDY_TIMEOUT_MINUTES,
  ttsReplacements: [{ from: "->", to: "could be" }, { from: "â†’", to: "could be" }],
  ttsNewlinePauseMs: 700,
  practicePlaybackRate: 1,
  practiceSpeedOptions: [1, 0.75, 0.5],
  // Seconds the recording-playback waits between items.
  recPlayGapSeconds: 30,
  recPlayYouTubeClipSeconds: 20,
  recManualPlaybackMode: 'both',
  // Opt-in speech only when a manual card has no playable saved audio/link.
  recPlayTtsFallback: false,
  // Background music hushed by hand from its panel. Kept with the settings
  // rather than in a variable that dies with the page: someone who silenced
  // the music did so for a reason, and having it start again on its own after
  // a reload is the more surprising of the two behaviours. The panel button
  // and the â™« tint both say which way it is.
  recMusicPaused: false,
  // Play and show every manual card the other way round â€” Target first, then
  // Source. A whole-session switch rather than a per-card one: practising a
  // deck backwards is a mode you are in for a while, and it leaves the cards
  // themselves untouched, so nothing has to be edited back afterwards.
  recPlayReverse: false,
  // Which face of a new card a caption capture's text lands on â€” 'source'
  // (caption is the prompt) or 'target' (caption is the answer). Remembered
  // between captures because collecting from one video means repeated sends.
  captionTextField: 'source',
  // The playlist the last capture was actually filed into. Offered first next
  // time, because the playlist you are collecting into is rarely the one you
  // happen to be practising. Only ever set from a destination that accepted a
  // block, so a refused one is never remembered. '' means nothing yet.
  captionPlaylist: '',
  cardPlaylist: '',
  // Last successful merge target within captionPlaylist. An empty ID means
  // the user chose New item; keep that choice on later sends as well.
  captionItemId: '',
  // Seconds to wait between a manual card's Source and Target recordings â€”
  // the "try to recall it" pause. null means unset, in which case the
  // inter-item gap above is used, so one control covers both until the user
  // wants a different (usually shorter) pause inside a card.
  recPlaySrcTgtGapSeconds: null,
  // Player-mode recordings keep the user's level when the element is rebuilt.
  recAudioVolume: 1,
  recAudioMuted: false,
  recAudioPlaybackRate: 1,
  // Saved background-music tracks: [{ id, url, name }]. Empty means the
  // feature is off and no extra player is ever built.
  recMusicTracks: [],
  // Video id of the chosen track. An id that is no longer in the list falls
  // back to the first one â€” see musicSelectedId.
  recMusicSelected: '',
  // When the music is allowed to sound:
  //   'item'    â€” only while a recording (or the spoken word) is sounding
  //   'gap'     â€” only during the pauses (the recall pause and the hold on
  //               the card's text), so it fills the silence without sitting
  //               on top of the pronunciation
  //   'nonstop' â€” throughout, standing aside only for video clips
  recMusicMode: 'gap',
  // Two levels, because 'nonstop' is in both situations. Under speech the
  // music is there to be felt rather than heard; in a silent gap it can carry.
  // Taken from music-bed.js so the stored default and the fallback that module
  // applies to a missing value can't drift apart.
  recMusicVolume: MUSIC_VOL_WITH_AUDIO,  // while a recording is playing
  recMusicGapVolume: MUSIC_VOL_IN_GAPS,  // during the pauses
  // Playlist-style playback modes for recordings.
  // recPlayShuffle: items are reordered with Fisher-Yates before playback.
  // recPlayLoop:    'off'      â€” play through once then stop (default)
  //                 'one'      â€” repeat the current item indefinitely
  //                 'playlist' â€” repeat the current playlist indefinitely
  //                 'all'      â€” cycle through every playlist's items indefinitely
  recPlayShuffle: false,
  recPlayLoop: 'off',
  // Practice flashcard reveal behaviour:
  //   'flip' â€” Reveal triggers a card-flip animation that replaces the source
  //            text with the target translation (click again to flip back) â€” default
  //   'both' â€” back shown alongside the front from the start, no Reveal button
  //   'hide' â€” back appears below the front when Reveal is clicked
  practiceRevealMode: 'flip',
  practiceSpeakOver: true,
  // Max rows shown upfront in the prefix-search vocabulary panel. The rest
  // (strongest matches that overflow this cap) move into the "Different
  // prefixes" dialog at the top so they're still reachable in one click.
  prefixResultsMax: 5,
  // Clip-window bounds for playlist playback. SRTs are sparse snippets (a video's
  // file stitches distant captures together), so a Â±context window can span a
  // multi-hour gap and play far past the word. Cues are treated as adjacent when
  // the gap between them is <= clipGapThresholdSec; auto-built clips are also hard
  // capped at clipMaxDurationSec. (Manual captures use the gap threshold but stay
  // uncapped.) See contiguousClipWindow in random-playlist.js.
  clipGapThresholdSec: 2.5,
  clipMaxDurationSec: 25,
  // Automatic-random capture: minimum words to have around the vocab word before
  // adding context sentences. If the matched subtitle line already has this many
  // words before AND after the word, no context lines are added; otherwise lines
  // are added on the deficient side up to the "Sentences around word" cap.
  minWordsAround: 10,
  // Show book search when the native app bridge is available.
  includeLibraryInSearch: false,
  includeSrtsInSearch: true,
  // Run the Cupitor library (EPUB full-text) search on every subtitle search.
  // Off by default: the host indexes each book the first time a search visits
  // it, so early searches cost seconds of native work (later ones hit the
  // index and are quick).
  autoLibrarySearch: false,
  // List matching manual cards (from every playlist) with the search results.
  includeManualInSearch: false,
  manualCardSearchMatch: 'exact',
  // Whether that block starts folded. Sticky, like libraryResultsCollapsed.
  manualResultsCollapsed: false,
  includeWordMapsInSearch: false,
  wordMapResultsCollapsed: false,
  // Whether the book-results block inside #result starts folded. Sticky so a
  // user who keeps the books out of the way isn't re-shown them every search.
  libraryResultsCollapsed: false,
  // Ask the host for substring-anywhere matching instead of word / prefix
  // (spec Â§5.6). Off by default, matching the host's own default.
  libraryPartialMatch: false
}

// Adjacency gap / max-duration accessors, guarding against a bad localStorage value.
function _clipGapThresholdSec() {
  const n = parseFloat(window._appSettings && window._appSettings.clipGapThresholdSec)
  return Number.isFinite(n) && n >= 0 ? n : 2.5
}
function _clipMaxDurationSec() {
  const n = parseFloat(window._appSettings && window._appSettings.clipMaxDurationSec)
  return Number.isFinite(n) && n > 0 ? n : 25
}
function _minWordsAround() {
  const n = parseInt(window._appSettings && window._appSettings.minWordsAround, 10)
  return Number.isFinite(n) && n >= 0 ? n : 10
}

// Pause between a manual card's Source and Target recordings, in seconds.
// Returns null when the user hasn't set one â€” callers then fall back to the
// inter-item gap. Blank/garbage in localStorage reads as unset, and 0 is a
// real value (play them truly back to back).
function _srcTgtGapSeconds() {
  const raw = window._appSettings && window._appSettings.recPlaySrcTgtGapSeconds
  if (raw == null || raw === '') return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? Math.max(0, Math.min(600, n)) : null
}

function _manualPlaybackPreference() {
  const mode = window._appSettings?.recManualPlaybackMode
  return ['linked', 'recordings', 'both'].includes(mode) ? mode : 'both'
}

function _playlistPlaybackPlan(it) { return manualPlaybackPlan(it, _manualPlaybackPreference()) }

function _runtimeYouTubeClip(it, queue, index) {
  if (!queue) {
    queue = window._practiceActive ? window._practiceCards : window._recPlayQueue
    queue = queue || []
    index = queue.indexOf(it)
    if (index < 0) index = queue.findIndex(q => q?.id === it?.id && q?.lineIndex === it?.lineIndex && q?.timeStart === it?.timeStart)
  }
  return youtubeClipForItem(it, queue, index, clipFallbackSeconds(window._appSettings?.recPlayYouTubeClipSeconds))
}

function _setManualPlaybackPreference(mode) {
  if (!['linked', 'recordings', 'both'].includes(mode)) return
  window._appSettings.recManualPlaybackMode = mode
  saveAppSettings()
  $('#recManualPlaybackMode, #recPlayingBanner .rec-pb-media-mode').val(mode)
  if (window._playingRecording && !window._practiceActive && _isManualItem(window._recPlayCurrentItem)) {
    window._recNavGotoIndex = window._recPlayIndex
    _interruptRecordingPlayback()
    _stopGapCountdown()
  }
}

// The wait between playlist items, in seconds. Read live so the Â± stepper in
// the playback overlay takes effect mid-playback.
function _interItemGapSeconds() {
  const raw = window._recPlayGapSeconds ?? window._appSettings?.recPlayGapSeconds
  const sec = parseInt(raw != null ? raw : $('#recPlayGapSeconds').val(), 10)
  // Same [0, 600] rails the setters enforce, so a hand-edited or legacy
  // localStorage value can't produce an uncappable wait â€” nor, by
  // inheritance, an uncappable sourceâ†’target pause.
  return Math.max(0, Math.min(600, Number.isFinite(sec) ? sec : 30))
}

// What the sourceâ†’target pause actually resolves to right now: the override
// when one is set, otherwise the inter-item gap.
function _effectiveSrcTgtGapSeconds() {
  const s = _srcTgtGapSeconds()
  return s == null ? _interItemGapSeconds() : s
}

// Write the inter-item gap and refresh both places it is shown. Anything
// unparseable is rejected outright rather than falling back to 0 â€” a typo in
// the "type a value" prompt must not silently mute the wait between items,
// nor collapse a sourceâ†’target pause that inherits from it.
function _setItemGap(v) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return
  const seconds = Math.max(0, Math.min(600, n))
  if (window._recPlayGapSeconds != null) window._recPlayGapSeconds = seconds
  else {
    window._appSettings.recPlayGapSeconds = seconds
    saveAppSettings()
  }
  _syncItemGapUI()
  _syncSrcTgtGapUI()
}

// A playlist override lives only in memory. Saving any other setting while it
// is open must never persist its gap; closing simply reveals the saved value.
function _setSessionItemGap(value) {
  const n = value == null ? NaN : parseInt(value, 10)
  window._recPlayGapSeconds = Number.isFinite(n) ? Math.max(0, Math.min(600, n)) : null
  _syncItemGapUI()
  _syncSrcTgtGapUI()
}

function _syncItemGapUI() {
  const v = _interItemGapSeconds()
  _setSettingsInput('#recPlayGapSeconds', v)
  const $val = $('#recPlayingBanner .rec-pb-gap-val')
  if ($val.length) $val.text(v + 's')
}

// Push a value into a settings input. These syncs fire on every keystroke of
// the very inputs they write to, so skip the write while the box is focused
// AND already says the same thing â€” writing then would only jump the caret.
// When the value was clamped or rejected the box is showing something that is
// no longer true (900 typed, 600 stored), so correct it even mid-edit rather
// than leave the two disagreeing until a reload.
function _setSettingsInput(sel, value) {
  try {
    const el = $(sel)[0]
    if (!el) return
    if (el === document.activeElement && String(el.value).trim() === String(value)) return
    $(el).val(value)
  } catch (_) {}
}

// Write the sourceâ†’target pause (null clears the override) and refresh both
// places it is shown.
function _setSrcTgtGap(v) {
  if (v == null || String(v).trim() === '') {
    window._appSettings.recPlaySrcTgtGapSeconds = null
  } else {
    const n = parseInt(v, 10)
    if (!Number.isFinite(n)) return
    window._appSettings.recPlaySrcTgtGapSeconds = Math.max(0, Math.min(600, n))
  }
  saveAppSettings()
  _syncSrcTgtGapUI()
}

// â”€â”€â”€ Background music settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reading helpers, kept beside the gap accessors because the music is driven
// by the same phases those gaps define.

// Thin bindings onto the live settings object; the rules themselves live in
// music-bed.js, where they can be tested without a player or a DOM.
function _musicKind() { return _isManualItem(window._recPlayCurrentItem) ? 'manual' : 'video' }
let _musicPanelKind = 'manual'
function _writeMusicProfile(changes) {
  const key = _musicPanelKind === 'video' ? 'recMusicVideo' : 'recMusicManual'
  window._appSettings[key] = { ...window._appSettings[key], ...changes }
}
function _musicSettings(kind = _musicKind()) { return _musicSettingsFor(window._appSettings, kind) }
function _musicHushed()    { return !!_musicSettings().recMusicPaused }
function _musicVideoId()   { return _musicSelectedIdOf(window._appSettings) }
function _musicTracks()    { return _musicTracksOf(window._appSettings) }
function _musicMode()      { return _musicModeOf(_musicSettings()) }

// The playlist record the item being played belongs to. An item carries the
// name of the playlist it came from when the queue was built from several.
function _recordOfPlaylist(name) {
  const n = name || (window._recording && window._recording.currentName)
  return (n && window._recordings && window._recordings[n]) || null
}

// What a card or its playlist asks for, and what plays when neither asks.
//
// _musicTrack above is the panel's chosen track â€” the default, and what the
// panel's own Track row is showing. This is the one that actually sounds, and
// on a card or a playlist that names its own they are different.
function _musicTrackNow() {
  const it = window._recPlayCurrentItem
  const rec = _recordOfPlaylist(it && it._recName)
  return _resolveMusicTrack(_musicSettings(), {
    cardTrackId: it && it.musicTrackId,
    playlistTrackId: rec && rec.musicTrackId,
  })
}
// The choices a card or a playlist has: say nothing and take whatever the level
// above it plays, name one of the saved tracks, or ask for silence outright.
// Same list in both places, because they are the same question asked of two
// different things.
function _musicChoiceOptions(selected, inheritLabel) {
  const sel = String(selected || '')
  const opt = (v, label) =>
    `<option value="${_.escape(v)}"${v === sel ? ' selected' : ''}>${_.escape(label)}</option>`
  return [opt('', inheritLabel)]
    .concat(_musicTracks().map(t => opt(t.id, `${_musicTrackKind(t) === 'local' ? 'â™ª' : 'â–¶'} ${t.name}`)))
    .concat([opt(_MUSIC_NONE, '(silence)')])
    .join('')
}

// The level for whatever the playlist is doing right now â€” the quiet one only
// while something else is sounding.
function _musicVolume() {
  const phase = window._recPlayPhase === 'video' ? 'clip' : (window._recPlayPhase || 'idle')
  return _musicVolumeForPhase(_musicSettings(), phase)
}

installStudyDivider({
  readRatio: view => window._appSettings[`studySplit_${view}`],
  saveRatio: (view, ratio) => { window._appSettings[`studySplit_${view}`] = ratio; saveAppSettings() }
})
const _studyChrome = installStudyChrome()

function _studyControlIcon(kind, label) {
  const paths = kind === 'replay'
    ? '<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>'
    : kind === 'player' ? '<path d="m9 5 11 7-11 7Z"/>'
      : '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'
  return `<span class="study-mobile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span><span class="study-desktop-label">${label}</span>`
}

// Keep the Settings input and the overlay stepper showing the same thing. An
// inherited value is marked with a trailing "Â·" so it reads differently from
// one the user pinned.
// Put every face-aware corner of the player in step with the switch: the
// button's own state, the card's two lines, the hand-play buttons under the
// player and the pause pill between the faces.
// Whether turning the deck over means anything here. Only a manual card has
// two faces; a playlist of captured clips has nothing to swap, so the button
// would be a control that does nothing.
//
// Asked of the whole queue rather than the item on screen, because the switch
// governs the session: on a deck holding both kinds, hiding it while a clip
// plays would make it come and go as the playlist moved.
function _queueHasManualCard() {
  const q = window._recPlayQueue
  return Array.isArray(q) && q.some(it => _isManualItem(it))
}

function _syncRecPlayReverseBtn() {
  const on = _recPlayReversed()
  $('#recPlayingBanner .rec-pb-swap-btn')
    .toggle(_queueHasManualCard())
    .toggleClass('rec-pb-swap-on', on)
    .attr('title', on
      ? 'Practising Target first â€” tap to go back to Source first'
      : 'Practise the other way round â€” Target first')
    .attr('aria-pressed', on ? 'true' : 'false')
}

function _syncRecPlayReverseUI() {
  _syncRecPlayReverseBtn()
  const args = window._recPlayBannerArgs
  if (args && args.it) _renderPlayingBanner(args.it, args.idx, args.total)
  if (window._recPlayCurrentItem && _isManualItem(window._recPlayCurrentItem)) {
    _renderPlayingManualText(window._recPlayCurrentItem)
  }
  const $pa = $('#recPlayingAudio')
  if ($pa.length && window._recPlayCurrentItem) _renderManualFaceButtons($pa, window._recPlayCurrentItem)
  _syncSrcTgtGapUI()
}

function _syncSrcTgtGapUI() {
  const set = _srcTgtGapSeconds()
  _setSettingsInput('#recPlaySrcTgtGapSeconds', set == null ? '' : set)
  const $val = $('#recPlayingBanner .rec-pb-sgap-val')
  if (!$val.length) return
  const eff = _effectiveSrcTgtGapSeconds()
  // Name the faces in the order the pause actually sits between them, so a
  // reversed session doesn't label its Targetâ†’Source pause "á”†áµ€".
  const [first, second] = _cardFacesInOrder(window._recPlayCurrentItem)
  $val.text(`${first.icon}${second.icon} ${eff}s${set == null ? 'Â·' : ''}`)
  const _pair = `${first.label} and ${second.label}`
  $val.attr('title', `Tap to set the ${first.label.toLowerCase()}â†’${second.label.toLowerCase()} pause`)
  $val.closest('.rec-pb-sgap').attr(
    'title',
    set == null
      ? `Pause between ${_pair}: ${eff}s, inherited from the gap between items. Click Â± or tap to pin your own.`
      : `Pause between ${_pair}: ${eff}s. Tap the value and clear it to go back to the gap between items.`
  )
}

function appSettingsLocalKey() {
  const lang = getLangFromUrl()
  return _scopedKey(`cupitor:appSettings:${lang.fullName}`)
}

function _applyVocabularyEditVisibility() {
  const visible = window._appSettings.showEditVocabulary === true
  $('#showEditVocabulary').prop('checked', visible)
  $('#vocabularyResult').toggleClass('show-vocab-edit', visible)
}

// A native launch can carry the choice across study languages. Read it
// before the ready handler strips the search-handoff parameters.
const _inheritedFamiliarLanguage = new URLSearchParams(window.location.search).get('vocabLookup')
function loadAppSettings() {
  // Settings are personal preferences â€” no cross-device sync. Live entirely
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
    console.warn('loadAppSettings: failed to read localStorage â€” using defaults', e)
  }
  if (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(_inheritedFamiliarLanguage || '')) {
    window._appSettings.vocabularyLookupLanguage = _inheritedFamiliarLanguage
  }
  _refreshVocabularyLookupSelect()
  _applyVocabularyEditVisibility()
  $('#contextLinesBefore').val(window._appSettings.contextLinesBefore)
  $('#contextLinesAfter').val(window._appSettings.contextLinesAfter)
  // 0 is a legitimate gap (items run straight into each other), so it must
  // survive the round trip instead of being read as "missing" and shown as 30.
  $('#recPlayGapSeconds').val(_interItemGapSeconds())
  $('#recPlayYouTubeClipSeconds').val(clipFallbackSeconds(window._appSettings.recPlayYouTubeClipSeconds))
  $('#recManualPlaybackMode').val(_manualPlaybackPreference())
  $('#playbackSpeed').val(_preferredRecordingAudioRate())
  $('#studySessionTimeoutMinutes').val(studyTimeoutMinutes(window._appSettings.studySessionTimeoutMinutes))
  $('#ttsReplacements').val((window._appSettings.ttsReplacements || []).map(r => `${r.from}=${r.to}`).join('\n'))
  $('#ttsNewlinePauseMs').val(window._appSettings.ttsNewlinePauseMs ?? 700)
  $('#recPlayTtsFallback').prop('checked', !!window._appSettings.recPlayTtsFallback)
  // Blank input = "no override", so an unset sourceâ†’target gap must render
  // empty rather than as a 0 the user never chose.
  const _stGap = _srcTgtGapSeconds()
  $('#recPlaySrcTgtGapSeconds').val(_stGap == null ? '' : _stGap)
  // Music settings live in their own panel (#musicPanelDialog), which reads
  // them when it opens â€” nothing to seed here.
  $('#practiceRevealMode').val(window._appSettings.practiceRevealMode || 'flip')
  $('#numberOfPrefixFindings').val(
    parseInt(window._appSettings.prefixResultsMax, 10) || 5
  )
  $('#clipGapThresholdSec').val(_clipGapThresholdSec())
  $('#clipMaxDurationSec').val(_clipMaxDurationSec())
  $('#minWordsAround').val(_minWordsAround())
  const autoLib = !!window._appSettings.autoLibrarySearch
  $('#toggleAutoLibrarySearchCheckbox').prop('checked', autoLib)
  $('#librarySearchAutoCb').prop('checked', autoLib)
  _syncSearchSourceSettings()
  _ensureLibrarySearchBar()
  return Promise.resolve()
}

function _getPrefixResultsMax() {
  const n = parseInt(window._appSettings && window._appSettings.prefixResultsMax, 10)
  return Number.isFinite(n) && n > 0 ? n : 5
}

function saveAppSettings() {
  try {
    localStorage.setItem(appSettingsLocalKey(), JSON.stringify(window._appSettings))
  } catch (e) {
    console.warn('saveAppSettings: localStorage write failed', e)
  }
}
window.saveAppSettings = saveAppSettings

// Numeric settings redraw results without opening/closing dialogs or taking
// focus. Debounce typing and give each redraw a token so stale work retires.
let _settingsRedrawTimer = null
function _redrawSearchSettings() {
  clearTimeout(_settingsRedrawTimer)
  if (!window.searchResult || !window.searchText) return
  const token = window._subtitleSearchToken = (window._subtitleSearchToken || 0) + 1
  _settingsRedrawTimer = setTimeout(() => {
    if (token !== window._subtitleSearchToken) return
    window._searchResultPage = 0
    render(window.searchResult, window.searchText, undefined, token)
      .catch(e => console.warn('settings redraw failed', e))
  }, 120)
}

function _filterSearchChannels(items) {
  return filterSearchChannels(items, window._appSettings.searchChannels, window.srts || [])
}
function _updateSearchChannelsButton() {
  const chosen = window._appSettings.searchChannels || []
  $('#searchChannelsBtn').text(chosen.length ? `Search channels: ${chosen.length} selected` : 'Search channels: all')
}
function openSearchChannelsDialog() {
  let $dlg = $('#searchChannelsDialog')
  if (!$dlg.length) $dlg = $('<div id="searchChannelsDialog"></div>').appendTo('body')
  const selected = new Set(window._appSettings.searchChannels || [])
  const channels = searchChannelOptions(window.srts || [], [...selected])
  $dlg.empty().append('<p>Search only these YouTube channels. Leave all unchecked to search every source.</p>')
  const $find = $('<input type="search" placeholder="Find a channelâ€¦" aria-label="Find a channel">').appendTo($dlg)
  const $list = $('<div class="channel-filter-list"></div>').appendTo($dlg)
  channels.forEach(channel => {
    const $row = $('<label></label>').appendTo($list)
    $('<input type="checkbox">').val(channel).prop('checked', selected.has(channel)).appendTo($row)
    $row.append(document.createTextNode(' ' + channel))
  })
  if (!channels.length) $list.text('No YouTube channels are loaded yet.')
  $find.on('input', () => {
    const query = String($find.val() || '').toLowerCase()
    $list.children('label').each(function () { $(this).toggle($(this).text().toLowerCase().includes(query)) })
  })
  const options = {
    title: 'Limit search by YouTube channel', width: Math.min(560, window.innerWidth - 24),
    maxHeight: window.innerHeight - 40, modal: false,
    buttons: {
      'Select all': () => $list.find('input').prop('checked', true),
      'Clear': () => $list.find('input').prop('checked', false),
      'Apply': () => {
        window._appSettings.searchChannels = $list.find('input:checked').map((i, e) => e.value).get()
        saveAppSettings()
        _updateSearchChannelsButton()
        $dlg.dialog('close')
        _redrawSearchSettings()
      },
      'Cancel': () => $dlg.dialog('close')
    },
    open: function () { $(this).closest('.ui-dialog').attr('tabindex', -1).trigger('focus') }
  }
  if ($dlg.hasClass('ui-dialog-content')) $dlg.dialog('option', options).dialog('open')
  else $dlg.dialog(options)
}
window.openSearchChannelsDialog = openSearchChannelsDialog

async function openSubtitleCacheDialog() {
  let $dlg = $('#subtitleCacheDialog')
  if (!$dlg.length) $dlg = $('<div id="subtitleCacheDialog"></div>').appendTo('body')
  $dlg.empty().append('<p>Remove downloaded subtitles by account or source. Your playlists and pending edits are kept. Enabled libraries download again on the next reload.</p>')
  const $body = $('<div>Loading cached dataâ€¦</div>').appendTo($dlg)
  const options = { title: 'Cached data on this device', width: Math.min(620, window.innerWidth - 24),
    maxHeight: window.innerHeight - 40, modal: false,
    buttons: { Close: () => $dlg.dialog('close') } }
  if ($dlg.hasClass('ui-dialog-content')) $dlg.dialog('option', options).dialog('open')
  else $dlg.dialog(options)
  if (typeof indexedDB === 'undefined') { $body.text('IndexedDB is unavailable.'); return }
  try {
    const current = _cacheDbName()
    const databases = await listSubtitleCaches(indexedDB, localStorage, current)
    const db = await _openSubtitlesCache()
    const sources = db ? await cacheSources(db, _sourceOwner('primary')) : []
    $body.empty()
    const row = (label, action) => {
      const $row = $('<div class="cache-manager-row"></div>').appendTo($body)
      $('<span></span>').text(label).appendTo($row)
      const $btn = $('<button type="button" class="lang-tool-btn">Remove</button>').appendTo($row)
      $btn.on('click', async () => {
        if (!confirm(`Remove cached subtitles for ${label}?`)) return
        $btn.prop('disabled', true)
        try { await action(); $row.remove() }
        catch (e) { alert(e.message || String(e)); $btn.prop('disabled', false) }
      })
    }
    databases.filter(d => d.name !== current).forEach(d => row(`${d.account} / ${d.language}`, () => deleteSubtitleCache(indexedDB, d.name)))
    sources.forEach(source => row(`${source.owner} / ${getLangFromUrl().fullName} (${source.count} subtitle pair${source.count === 1 ? '' : 's'}, current account)`, async () => {
      _cacheSuppressedOwners.add(source.owner)
      try { await removeCacheSource(db, source.owner, _sourceOwner('primary')) }
      catch (e) { _cacheSuppressedOwners.delete(source.owner); throw e }
    }))
    const derived=await _subtitleSearch.run('caches',{})
    for (const entry of derived) {
      let label=entry.baseScope
      try {
        const [user,shared]=JSON.parse(entry.baseScope),[account,language,source]=JSON.parse(user)
        label=`${account} / ${language} / ${source || shared || 'local'}`
      } catch (_) {}
      const size=((entry.bytes||0)/1024/1024).toFixed(1)
      const indexSize=((entry.indexBytes||0)/1024/1024).toFixed(1)
      const text=`Search cache: ${label} Â· ${entry.count||0} subtitles Â· about ${size} MiB of raw text + ${indexSize} MiB of index data`
      if (entry.baseScope===_subtitleSearchScope || entry.leaseUntil>Date.now()) {
        $('<p></p>').text(text+' (active session)').appendTo($body)
      } else row(text,()=>_subtitleSearch.run('clearCache',{scope:entry.scope}))
    }
    if (!$body.children().length) $body.text('No cached subtitles found.')
    if (typeof indexedDB.databases !== 'function') {
      $('<p></p>').text('This browser can list only caches opened since this update.').appendTo($body)
    }
  } catch (e) { $body.text('Could not read cached data: ' + (e.message || e)) }
}
window.openSubtitleCacheDialog = openSubtitleCacheDialog


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Practice Log / Schedule
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Per-language weekly goals. Records keep the goal, measurement and status
// together so a device never merges a count into the wrong unit.
const PRACTICE_LOG_OPENED_KEY = 'cupitor:practiceLog:openedOnce'

function _practiceLogLocalKey() {
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || 'default'
  return _scopedKey(`cupitor:practiceLog:${lang}`)
}

function _practiceLogGithubPath() {
  return `${_langRepoDir()}/practice-log.json`
}

function _currentWeekLabel() { return _isoWeekLabel(new Date()) }
function _nextWeekLabel() { return _isoWeekLabel(_addDays(new Date(), 7)) }

function _loadPracticeLogLocal() {
  try {
    const raw = _userData.getItem(_practiceLogLocalKey())
    if (!raw) return _defaultPracticeLog()
    return normalizePracticeLog(JSON.parse(raw)) || _defaultPracticeLog()
  } catch (_) { return _defaultPracticeLog() }
}

// Thin wrapper â€” pure pruner takes the labels so it stays testable.
function _prunePracticeLogWeeks(data) {
  return _corePrunePracticeLogWeeks(data, _currentWeekLabel(), _nextWeekLabel())
}

function _savePracticeLogLocal(data) {
  try { _userData.setItem(_practiceLogLocalKey(), JSON.stringify(data)) } catch (_) {}
}

// The user's own practice log only (never the other user's); null without
// a data repo, so the dialog stays local-only.
async function _fetchPracticeLogRemote() {
  try {
    const v = await _dsFetchSelfJson('practice-log.json', {
      lang: _dsLangFromLocation(), query: `?_=${Date.now()}`, init: { cache: 'no-cache' }, fallback: null,
    })
    return v == null ? null : normalizePracticeLog(v)
  } catch (_) { return null }
}

// In-memory state used by the dialog. _practiceLogPending tracks whether the
// user has unsaved edits since the last successful push.
window._practiceLog = null
window._practiceLogPending = false
window._practiceLogActiveTab = 'current'
let _practiceReminders

function _practiceLogActiveWeekLabel() {
  if (window._practiceLogActiveTab === 'next') return _nextWeekLabel()
  return _currentWeekLabel()
}

function _refreshPracticeLogPendingHint() {
  $('#practiceLogPendingHint').text(window._practiceLogPending ? 'Saved locally Â· changes to sync' : 'Saved on this device')
  _refreshPracticeLogBtnHighlight()
}

function _refreshPracticeLogBtnHighlight() {
  const data = window._practiceLog || _loadPracticeLogLocal()
  const current = Object.values(data.weeks[_currentWeekLabel()] || {}).filter(hasPracticeLogEntry)
  const next = Object.values(data.weeks[_nextWeekLabel()] || {}).some(hasPracticeLogEntry)
  const needs = !current.length || !next || current.some(item => item.status === 'not_started')
  $('#practiceLogFrontBtn, #practiceLogSettingsBtn, #headerPracticeLogBtn').toggleClass('practice-log-needs-attention', needs)
}

function _markPracticeLogEdited(data, weekLabel) {
  if (weekLabel === _currentWeekLabel()) {
    data.lastWeeklyUpdate = practiceDate()
    if (data.reminders?.enabled && window.CallBridge) {
      const reminders = mountPracticeReminders({ $, data: () => data, language: getLangFromUrl().fullName })
      reminders.sync().catch(() => $('#practiceLogStatus').text('Could not sync reminders')).finally(reminders.dispose)
    }
  }
  window._practiceLogPending = true
  _savePracticeLogLocal(data)
  _refreshPracticeLogPendingHint()
}

function _renderPracticeLogPlan() {
  const data = window._practiceLog
  if (!data) return
  const weekLabel = _practiceLogActiveWeekLabel()
  const week = data.weeks[weekLabel]
  const vm = buildPracticeLogPlanVM(data.customItems, week, weekLabel,
    window._practiceLogActiveTab === 'next', practiceLogWeekNote(data, weekLabel))
  const overview = $('#practiceLogWeekLabel')[0]
  const mount = $('#practiceLogItems')[0]
  const add = $('#practiceLogAddItemBtn')[0]
  const editor = $('#practiceLogEditor')[0]

  function restoreFocus(name, selector) {
    editor.addEventListener('close', () => {
      const card = Array.from(mount.children).find(card => card.dataset.itemName === name)
      ;(card?.querySelector(selector) || add).focus()
    }, { once: true })
  }
  function saveRecord(name, update, selector) {
    if (window._practiceLog !== data) return false
    const currentWeek = data.weeks[weekLabel] || {}
    const existing = Object.hasOwn(currentWeek, name) ? currentWeek[name] : {}
    const record = update(existing)
    data.weeks[weekLabel] = { ...currentWeek, [name]: record }
    _markPracticeLogEdited(data, weekLabel)
    restoreFocus(name, selector)
    _renderPracticeLogPlan()
    return true
  }
  const editGoal = item => openPracticeLogGoalEditor(editor, item, weekLabel, goal =>
    saveRecord(item.name, current => {
      if (!data.customItems.includes(item.name) && !hasPracticeLogEntry(current)) {
        data.customItems = [...data.customItems, item.name]
        data.activityEdits = { ...data.activityEdits, [item.name]: { available: true, updatedAt: Date.now() } }
      }
      return updatePracticeGoal(current, goal)
    }, '.practice-log-item-goal'), name => {
    if (window._practiceLog !== data || !confirm(`Remove "${name}" from available activities? Its saved goals and history will be kept.`)) return false
    data.customItems = data.customItems.filter(item => item !== name)
    data.activityEdits = { ...data.activityEdits, [name]: { available: false, updatedAt: Date.now() } }
    _markPracticeLogEdited(data)
    restoreFocus(name, '.practice-log-item-goal')
    _renderPracticeLogPlan()
    return true
  }, item.measure ? () => {
    if (!confirm(`Remove the ${item.name} goal for this week?`)) return false
    return saveRecord(item.name, () => ({ deleted: true, updatedAt: Date.now() }), '.practice-log-item-goal')
  } : null)
  add.onclick = () => {
    const usedNames = [...data.customItems, ...vm.items.map(item => item.name)]
    openPracticeLogActivityPicker(editor, vm.available, usedNames, name => editGoal({ name }))
  }
  renderPracticeLogPlan(vm, mount, {
    editGoal,
    editWeekNote: () => openPracticeLogWeekNoteEditor(editor, weekLabel, vm.note, text => {
      if (window._practiceLog !== data) return false
      if (text === vm.note) return true
      data.weekNotes[weekLabel] = { text, updatedAt: Date.now() }
      _markPracticeLogEdited(data)
      editor.addEventListener('close', () => overview.querySelector('.practice-log-note-action')?.focus(), { once: true })
      _renderPracticeLogPlan()
      return true
    }),
    update: item => openPracticeLogProgressEditor(editor, item, (value, skip) => {
      const current = data.weeks[weekLabel]?.[item.name] || {}
      if (practiceLogMeasure(current).unit !== item.measure.unit) {
        $('#practiceLogStatus').text('The goal unit changed. Open Update again.')
        editor.close()
        return false
      }
      return saveRecord(item.name, record => updatePracticeProgress(record, value, { skip }), '.practice-log-update')
    }),
  }, overview)
}

function _renderPracticeLogHistory() {
  const data = window._practiceLog
  if (!data) return
  const $ret = $('#practiceLogHistoryWeeks')
  if (!$ret.is(':focus')) $ret.val(data.historyRetainWeeks || PRACTICE_LOG_DEFAULT_RETAIN)
  const vm = buildPracticeLogHistoryVM(data, _currentWeekLabel())
  renderPracticeLogHistory(vm, $('#practiceLogHistoryList')[0])
}

function _setPracticeLogTab(tab) {
  window._practiceLogActiveTab = tab
  $('#practiceLogDialog .practice-log-tab').removeAttr('aria-current')
  $(`#practiceLogDialog .practice-log-tab[data-tab="${tab}"]`).attr('aria-current', 'page')
  $('#practiceReminderSettings').prop('hidden', true)
  _practiceReminders?.dispose()
  _practiceReminders = undefined
  if (tab === 'history') {
    $('#practiceLogPlanView').hide()
    $('#practiceLogHistoryView').show()
    _renderPracticeLogHistory()
  } else {
    $('#practiceLogHistoryView').hide()
    $('#practiceLogPlanView').show()
    _renderPracticeLogPlan()
  }
}

async function openPracticeLogDialog(forceCurrent = false) {
  // Mark first-open before any await â€” if the network fetch fails the user
  // still gets the front-page banner removed because they made the choice to
  // open it. Same flag is checked at boot in _initPracticeLogFrontBanner.
  try { localStorage.setItem(PRACTICE_LOG_OPENED_KEY, '1') } catch (_) {}
  $('#practiceLogFrontBanner').hide()

  const $dlg = $('#practiceLogDialog')
  if ($dlg.hasClass('ui-dialog-content') && $dlg.dialog('isOpen')) {
    if (forceCurrent === true) _setPracticeLogTab('current')
    else $dlg.dialog('close')
    return
  }

  const local = _loadPracticeLogLocal()
  window._practiceLog = local

  const _vh = (window.visualViewport && window.visualViewport.height)
           || window.innerHeight
           || $(window).height()
  const dialogMaxH = Math.max(240, _vh - 80)
  if (!$dlg.hasClass('ui-dialog-content')) {
    $dlg.dialog({
      title: 'Practice Log',
      width: Math.min(820, $(window).width() - 20),
      dialogClass: 'practice-log-window',
      maxHeight: dialogMaxH,
      modal: false,
      autoOpen: false,
      // Dragging steals touchmove on mobile â€” without this the content
      // can't be scrolled because jQuery UI's drag handler captures the
      // gesture as a drag-the-dialog operation.
      draggable: false,
      resizable: false,
      position: { my: 'center top', at: 'center top+30', of: window },
      close() {
        const editor = $('#practiceLogEditor')[0]
        if (editor.open) editor.close()
        _practiceReminders?.dispose()
      },
    })
    $('#practiceLogReminders').insertBefore($dlg.dialog('widget').find('.ui-dialog-titlebar-close'))
    $('#practiceLogEditor').on('keydown', event => {
      if (event.key === 'Escape') event.stopPropagation()
    })
    $dlg.on('click', '.practice-log-tab', function () { _setPracticeLogTab($(this).data('tab')) })
    $('#practiceLogReminders').on('click', () => {
      $('#practiceLogPlanView, #practiceLogHistoryView').hide()
      $('#practiceReminderSettings').prop('hidden', false)
      _practiceReminders?.dispose()
      _practiceReminders = mountPracticeReminders({
        $, root: $('#practiceReminderSettings')[0], data: () => window._practiceLog,
        language: getLangFromUrl().fullName,
        close: () => _setPracticeLogTab(window._practiceLogActiveTab),
        save() {
          window._practiceLogPending = true
          _savePracticeLogLocal(window._practiceLog)
          _refreshPracticeLogPendingHint()
        },
      })
      _practiceReminders.open()
    })
    $('#practiceLogHistoryWeeks').on('change', function () {
      const data = window._practiceLog
      if (!data) return
      const n = Math.min(9999, Math.max(1, this.valueAsNumber || PRACTICE_LOG_DEFAULT_RETAIN))
      this.value = n
      if (data.historyRetainWeeks !== n) {
        data.historyRetainWeeks = Math.round(n)
        data.historyUpdatedAt = Date.now()
        _markPracticeLogEdited(data)
      }
      _renderPracticeLogHistory()
    })
    $('#practiceLogSaveBtn').on('click', _commitPracticeLogToGithub)
  }
  $dlg.dialog('option', { width: Math.min(820, $(window).width() - 20), maxHeight: dialogMaxH })
  $dlg.dialog('open')

  _setPracticeLogTab(forceCurrent === true ? 'current' : window._practiceLogActiveTab)
  _refreshPracticeLogPendingHint()

  // Background-fetch latest remote and merge in. Skips silently if offline.
  const $status = $('#practiceLogStatus').text('fetching remoteâ€¦')
  const remote = await _fetchPracticeLogRemote()
  if (window._practiceLog !== local) return
  if (remote) {
    const merged = _mergePracticeLog(remote, local)
    Object.assign(local, merged)
    _savePracticeLogLocal(local)
    if (window._practiceLogActiveTab === 'history') _renderPracticeLogHistory()
    else _renderPracticeLogPlan()
    $status.empty()
  } else {
    $status.text(_dsHasSelf() ? 'Offline' : '')
  }
}
window.openPracticeLogDialog = openPracticeLogDialog
function _openPracticeReminder(detail) {
  if (detail?.language !== getLangFromUrl().fullName) return
  window.__cupitorPracticeReminderOpened = null
  openPracticeLogDialog(true)
}
window.addEventListener('cupitorPracticeReminderOpened', event => _openPracticeReminder(event.detail))
$(function () { _openPracticeReminder(window.__cupitorPracticeReminderOpened) })

async function _commitPracticeLogToGithub() {
  const $button = $('#practiceLogSaveBtn')
  const data = window._practiceLog
  if (!data || $button.prop('disabled') || !_requireSelf()) return
  const $status = $('#practiceLogStatus').text('Syncingâ€¦')
  const filePath = _practiceLogGithubPath()
  const baseline = JSON.stringify(data)
  $button.prop('disabled', true)
  try {
    await _userData.flush()
    const syncedText = await commitWithMerge({
      filePath,
      commitMessage: 'practice-log: update weekly practice log',
      merge: remoteText => {
        // Invalid remote data must not be overwritten.
        const remote = remoteText?.trim() ? normalizePracticeLog(JSON.parse(remoteText)) : null
        if (remoteText?.trim() && !remote) throw new Error('Practice Log on GitHub is invalid.')
        const merged = _prunePracticeLogWeeks(_mergePracticeLog(remote, JSON.parse(baseline)))
        return JSON.stringify(merged, null, 2) + '\n'
      }
    })
    if (window._practiceLog !== data) return
    const changed = JSON.stringify(data) !== baseline
    const synced = JSON.parse(syncedText)
    const merged = changed ? _prunePracticeLogWeeks(_mergePracticeLog(synced, data)) : synced
    Object.assign(data, merged)
    _savePracticeLogLocal(data)
    window._practiceLogPending = changed
    _refreshPracticeLogPendingHint()
    if (window._practiceLogActiveTab === 'history') _renderPracticeLogHistory()
    else _renderPracticeLogPlan()
    $status.text('Synced ' + new Date().toLocaleTimeString())
    await _userData.flush()
  } catch (e) {
    console.error('practice-log sync failed:', e)
    $status.text('Could not sync')
  } finally {
    $button.prop('disabled', false)
  }
}

function _initPracticeLogFrontBanner() {
  try {
    const opened = localStorage.getItem(PRACTICE_LOG_OPENED_KEY)
    if (!opened) $('#practiceLogFrontBanner').show()
    else $('#practiceLogFrontBanner').hide()
  } catch (_) { /* ignore */ }
  try { _refreshPracticeLogBtnHighlight() } catch (_) {}
}

let _vocabularyCatalogSelf = parseVocabularyCatalog(null)
let _vocabularyCatalogOther = parseVocabularyCatalog(null)
let _generatedVocabularyHints = parseVocabularyCatalog(null)
let _vocabularyCatalog = vocabularyHintSeed
let _vocabularyLookupChoices = ['en', 'hi']
let _sharedHintLanguages = ['hi']
const _sharedHintTranslations = new Map()
const _sharedHintLoads = new Map()
let _vocabularyCatalogReady
const _vocabularyHintIndexes = new Map()

const _vocabularyLanguageNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'language' }) : null
function _vocabularyLanguageName(code) {
  return _vocabularyLanguageNames?.of(code) || code
}

function _vocabularyLookupLanguage() {
  const choice = window._appSettings.vocabularyLookupLanguage
  return _vocabularyLookupChoices.includes(choice) ? choice : 'en'
}

function _refreshVocabularyLookupSelect() {
  $('#vocabularyLookupLanguage').empty()
    .append(_vocabularyLookupChoices.map(code => new Option(_vocabularyLanguageName(code), code)))
    .val(_vocabularyLookupLanguage())
  _refreshSearchLanguageChoices()
}

function _refreshSearchLanguageChoices() {
  const familiar = _vocabularyLookupLanguage()
  const studied = getLangFromUrl().code
  const $select = $('#searchLanguageSelect')
  const wasFamiliar = $select.val() === 'known'
  const hasFamiliar = familiar !== 'en' && familiar !== studied
  $select.find('option[value="known"]').text(_vocabularyLanguageName(familiar))
    .prop('hidden', !hasFamiliar)
  if (wasFamiliar && !hasFamiliar) _setLangToggle(true)
}

function _installVocabularyCatalog() {
  _vocabularyCatalog = mergeVocabularyCatalogs(_generatedVocabularyHints, vocabularyHintSeed, _vocabularyCatalogOther, _vocabularyCatalogSelf)
  _vocabularyLookupChoices = [...new Set(['en', ..._sharedHintLanguages,
    ...Object.keys(_vocabularyCatalog.sharedHints),
    ...Object.values(_vocabularyCatalog.meanings).flatMap(meaning => Object.keys(meaning.hints))])]
  _refreshVocabularyLookupSelect()
  _renderVocabularyForHintLanguage()
}

function _renderVocabularyForHintLanguage() {
  $('#searchedWords').trigger('change.select2')
  if (!window.vocabulary || window.unprocessedSearchText) return
  const requested = window._requestedSearchText?.trim()
  if (requested && requested.length < 3 && window._renderVocabularyHintsEarly?.(requested)) return
  if (window._vocabularySearchText) renderVocabularyFindings(window._vocabularySearchText)
}

function _loadSharedHintTranslations(language) {
  if (!_sharedHintLanguages.includes(language) || _sharedHintTranslations.has(language)) return Promise.resolve()
  if (_sharedHintLoads.has(language)) return _sharedHintLoads.get(language)
  const context = _dsCaptureSourceContext()
  const request = _dsReadLayers(SHARED_HINTS_DIRECTORY + '/' + language + '.txt', {
    lang: 'shared', retry: { tries: 1, timeoutMs: 8000 },
  }).then(layers => {
    context.assertCurrent()
    const entries = [...layers].reverse().flatMap(layer =>
      [...parseVocabularyHintTranslations(layer.text || '', language)])
    _sharedHintTranslations.set(language, new Map(entries))
  }).catch(error => console.warn('Shared vocabulary translations unavailable:', error))
    .finally(() => _sharedHintLoads.delete(language))
  _sharedHintLoads.set(language, request)
  return request
}

async function _loadVocabularyCatalog() {
  const context = _dsCaptureSourceContext()
  const cacheKey = which => _scopedKey('vocabulary-catalog:' + _dsSourceIdentity(which, 'shared'))
  const readSaved = which => {
    try { return parseVocabularyCatalog(localStorage.getItem(cacheKey(which))) }
    catch (_) { return parseVocabularyCatalog(null) }
  }
  _vocabularyCatalogSelf = _dsHasSelf() ? readSaved('self') : parseVocabularyCatalog(null)
  _vocabularyCatalogOther = _dsHasOther() ? readSaved('other') : parseVocabularyCatalog(null)
  _installVocabularyCatalog()
  const languagesReady = _dsReadLayers(SHARED_HINTS_DIRECTORY + '/languages.txt', {
    lang: 'shared', retry: { tries: 1, timeoutMs: 4000 },
  }).then(layers => {
    context.assertCurrent()
    _sharedHintLanguages = [...new Set(['hi', ...layers.flatMap(layer => parseVocabularyHintLanguages(layer.text || ''))])]
      .filter(language => language !== 'en')
  }).catch(error => console.warn('Shared vocabulary languages unavailable:', error))
  const generatedReady = _dsReadLayers(GENERATED_HINDI_HINTS_FILE, {
    lang: _dsLangFromLocation(), retry: { tries: 1, timeoutMs: 12000 },
  }).then(layers => {
    context.assertCurrent()
    const catalogs = []
    for (const layer of [...layers].reverse()) {
      try { catalogs.push(parseVocabularyCatalog(layer.text)) }
      catch (error) { console.warn('Ignoring an invalid Hindi vocabulary pack:', error) }
    }
    _generatedVocabularyHints = mergeVocabularyCatalogs(...catalogs)
  }).catch(error => console.warn('Generated Hindi vocabulary hints unavailable:', error))
  try {
    const layers = await _dsReadLayers(VOCABULARY_CATALOG_FILE, {
      lang: 'shared', retry: { tries: 1, timeoutMs: 4000, init: { cache: 'no-cache' } },
    })
    context.assertCurrent()
    for (const layer of layers) {
      const parsed = parseVocabularyCatalog(layer.text)
      if (layer.src === 'self') _vocabularyCatalogSelf = parsed
      else _vocabularyCatalogOther = parsed
      try {
        if (layer.text == null) localStorage.removeItem(cacheKey(layer.src))
        else localStorage.setItem(cacheKey(layer.src), layer.text)
      } catch (_) { /* keep the in-memory revision */ }
    }
  } catch (error) {
    console.warn('Vocabulary meanings unavailable; using the last loaded copy.', error)
  }
  await Promise.all([generatedReady, languagesReady])
  try { context.assertCurrent() } catch (_) { return }
  _installVocabularyCatalog()
  if (window._appSettings.vocabularyLookupLanguage) _reportFamiliarLanguage()
  await _loadSharedHintTranslations(_vocabularyLookupLanguage())
  try { context.assertCurrent() } catch (_) { return }
  _renderVocabularyForHintLanguage()
}

function _getVocabularyHintIndex(matcher = _getVocabularyMatcher(), lookup = _vocabularyLookupLanguage()) {
  const target = getLangFromUrl().code
  const translations = _sharedHintTranslations.get(lookup)
  let cached = _vocabularyHintIndexes.get(lookup)
  if (cached?.matcher !== matcher || cached.catalog !== _vocabularyCatalog || cached.translations !== translations) {
    cached = { matcher, catalog: _vocabularyCatalog, translations,
      index: createVocabularyHintIndex(matcher.rows, target, _vocabularyCatalog, lookup, translations) }
    _vocabularyHintIndexes.set(lookup, cached)
  }
  return cached.index
}

function _searchVocabularyHints(query, matcher = _getVocabularyMatcher(), lookup = _vocabularyLookupLanguage()) {
  const index = _getVocabularyHintIndex(matcher, lookup)
  const hits = index.search(query)
  if (lookup === 'en') return hits

  const untranslated = hits.length ? query.split('|').filter(term => !index.search(term).length).join('|') : query
  if (!untranslated.trim()) return hits
  const seen = new Set(hits.map(hit => hit.index))
  const fallback = _getVocabularyHintIndex(matcher, 'en').search(untranslated)
  return [...hits, ...fallback.filter(hit => !seen.has(hit.index))]
}

async function _editVocabularyMatch(match) {
  if (!_requireSelf()) return
  const context = _dsCaptureSourceContext()
  await _vocabularyCatalogReady
  const lookup = _vocabularyLookupLanguage()
  await _loadSharedHintTranslations(lookup)
  context.assertCurrent()
  const language = getLangFromUrl().code
  if (!ownLines(_ownVocabulary(), match.category).includes(match.line)) return
  const catalogBaseline = _vocabularyCatalogSelf
  const matcher = _getVocabularyMatcher()
  const row = matcher.rows.find(item => item.category === match.category && item.line === match.line)
  if (!row) return
  const index = _getVocabularyHintIndex(matcher, lookup)
  const group = index.groupFor(row.index)
  const english = lookup === 'en'
  const cues = vocabularyLineParts(row.line).hints
  const hints = english ? cues : index.hintsFor(row.line, row.index)
  const translations = _sharedHintTranslations.get(lookup)
  const sharedHints = english ? [] : [...new Map(cues.map(cue => [normalizeHint(cue, 'en'), cue])).values()]
    .map(cue => ({ cue, hints: sharedVocabularyHints(_vocabularyCatalog, lookup, translations, cue) }))
  openVocabularyEditor({
    row, language, lookup, hints, sharedHints, hasOverride: !!group?.hintOverrides?.[lookup],
    languageName: _vocabularyLanguageName,
    async save(nextHints, sharedChanges) {
      context.assertCurrent()
      const { category } = row
      const local = _ownVocabulary()
      const lines = ownLines(local, category)
      const at = lines.indexOf(row.line)
      if (at < 0) throw new Error('This line changed. Reopen the editor to see the latest version.')
      const line = english ? replaceEnglishVocabularyHints(row.line, nextHints) : row.line
      if (english) {
        local[category] = [...lines]
        local[category][at] = line
      }
      const baseline = window._vocabularyBaselineText || ''
      const pending = _userData.getItem(PENDING_VOCAB_KEY)
      let nextText, nextCatalog
      const files = [{
        path: _langRepoDir() + '/vocabulary.txt',
        getContent(remote) {
          context.assertCurrent()
          assertVocabularyRow(remote, baseline, category, row.line)
          if (!english) return null
          nextText = vocabularyToText(mergeVocabulary(baseline, local, remote || ''))
          return nextText
        },
      }]
      const patch = {}
      if (sharedChanges.length) {
        patch.sharedHints = { [lookup]: Object.fromEntries(sharedChanges.map(([cue, aliases]) => [normalizeHint(cue, 'en'), aliases])) }
      }
      if (english ? !!group : nextHints !== undefined) {
        const id = group?.id || await vocabularyHintGroupId(language, row)
        const current = group || { language, category, line, forms: [] }
        const updated = reviseVocabularyGroup(current, row.line, { category, line })
        if (!english) {
          updated.hintOverrides = { ...current.hintOverrides }
          if (nextHints === null) delete updated.hintOverrides[lookup]
          else updated.hintOverrides[lookup] = nextHints
          if (!Object.keys(updated.hintOverrides).length) delete updated.hintOverrides
        }
        patch.groups = { [id]: updated }
      }
      if (patch.groups || patch.sharedHints) {
        files.push({
          path: VOCABULARY_CATALOG_PATH,
          getContent(remote) {
            context.assertCurrent()
            nextCatalog = changeVocabularyCatalog(remote, catalogBaseline, patch)
            return JSON.stringify(nextCatalog, null, 2) + '\n'
          },
        })
      }
      await _userData.flush()
      context.assertCurrent()
      const { owner, repo, branch } = _dsWriteTarget()
      await window.GitHubUtils.commitMultipleFiles({ owner, repo, branch, commitMessage: 'vocab: update ' + lookup + ' hints', files })
      context.assertCurrent()
      if (english) {
        const concurrent = _userData.getItem(PENDING_VOCAB_KEY) !== pending
        const shown = concurrent ? vocabularyToText(mergeVocabulary(baseline, _ownVocabulary(), nextText)) : nextText
        _setVocabularyLayers(_dsMergeVocabularyLayers(shown, window._vocabularyOtherText))
        window._vocabularyBaselineText = nextText
        if (concurrent) _savePendingVocab()
        else _clearPendingVocab()
        await _userData.flush()
        context.assertCurrent()
        loadWholeVocabulary()
      }
      if (nextCatalog) {
        _vocabularyCatalogSelf = nextCatalog
        try {
          localStorage.setItem(_scopedKey('vocabulary-catalog:' + _dsSourceIdentity('self', 'shared')), JSON.stringify(nextCatalog))
        } catch (_) { /* keep the in-memory revision */ }
      }
      _installVocabularyCatalog()
      if (_familiarSearchLanguage() && window._requestedSearchText) {
        doSearch(window._requestedSearchText).catch(error => console.warn('Could not refresh the search after saving hints:', error))
      }
    },
  })
}

async function fetchVocabulary() {
  _vocabularyCatalogReady = _loadVocabularyCatalog()
  const context = _dsCaptureSourceContext()
  try {
    let res;
    if (isLocalhost()) {
      res = await fetch("http://localhost:5000/vocabulary?lang=" + getLangFromUrl().fullName)
      res = await res.json()
      if (res) res = res.text
    } else {
      // Own file with the usual retries â€” raw.githubusercontent.com sometimes
      // returns transient 5xx right after a deploy, and a single failed read
      // leaves vocabulary empty for the whole session. The other user's
      // lines are added read-only (they never go into a save).
      const layers = await _dsReadLayers('vocabulary.txt', {
        lang: _dsLangFromLocation(), onNotice: _dsNotice, otherRetry: _OTHER_LAYER_RETRY,
      })
      context.assertCurrent()
      const v = _dsVocabularyFromLayers(layers)
      _setVocabularyLayers(v)
      window._vocabularyBaselineText = v.baselineText
      res = null // already applied
    }
    if (typeof res === 'string' && res) {
      context.assertCurrent()
      window.vocabulary = parseVocabularyFile(res)
      // Baseline of the file as it was when we loaded it. Used by
      // commitVocabularyToGithub for a 3-way merge against the live remote
      // so concurrent edits on GitHub aren't clobbered by our push.
      window._vocabularyBaselineText = res
    }
  } catch (e) {
    console.warn('Vocabulary fetch failed', e);
  } finally {
    try { context.assertCurrent() } catch (_) { return }
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
    // Cleared via select2's X â€” drop tracking state and stop here.
    window.preSelectedSearchedWord = null
    return
  }
  if (typeof rawVal === 'string' && rawVal.startsWith('__cat__:')) {
    renderVocabularyCategory(rawVal.substring('__cat__:'.length));
    return;
  }
  // $('#searchText').val($('#searchedWords').val()).trigger('change')
  // Not every option here is a vocabulary line: doSearch adds a bare term to
  // this list for every search made through the history, and they look the
  // same in the dropdown. Such a term has no studied-language side to pin and
  // nothing to expand, so it runs like anything typed into the box.
  let vocabOptionVal = null
  try { vocabOptionVal = JSON.parse(rawVal) } catch (_) {}
  if (!vocabOptionVal || typeof vocabOptionVal.e !== 'string') {
    window.unprocessedSearchText = null
    $('#searchText').val(rawVal).trigger('input')
    await doSearch(String(rawVal), null)
    return
  }
  // A vocabulary line is always searched in the studied language. Pinned here
  // rather than where the dropdown is wired up, because the branches above
  // never search â€” and nothing but a search clears this again, so pinning for
  // them would hijack whatever the user did next.
  window.forceMainLangForNextSearch = true
  _setLangToggle(false)
  window.unprocessedSearchText = vocabOptionVal.o
  window.searchText = vocabOptionVal.e //expandWords(window.unprocessedSearchText, getLangFromUrl().code)
  // render() now branches on window.unprocessedSearchText â€” when set, it
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
  $header.addClass('highlighted similar-segment-header')
    .attr({ role: 'button', tabindex: '0', 'aria-expanded': 'false' });
  $header.find('.vocab-entry-search').remove();
  $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>');
  $header.append($('<span class="search-vocabulary-category"></span>').text('[' + category + ']'));
  vocabItemContent.append($header);
  const $body = $('<div class="similar-segment-body" hidden></div>');
  // Keep the matched line at its original position inside the body so the
  // surrounding-context ordering is preserved when expanded.
  surroundings.forEach(it => {
    const $line = _buildVocabLine(it, undefined, it.index === idx ? undefined : '');
    if (it.index === idx) $line.addClass('highlighted');
    $body.append($line);
  });
  vocabItemContent.append($body);
  vocabItem.append(vocabItemContent);
  vocab.append('<h2 class="mobile-vocab-title">Vocabulary match</h2>', vocabItem);

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
    `<div class="vocabulary-category-header" style="color:grey;font-style:italic;font-weight:bold;padding:6px 0;">${_.escape(category)}</div>`
  );

  const vocabItem = $('<div class="vocabulary-segment"></div>');
  const vocabItemContent = $('<div class="vocabulary-segment-content"></div>');
  lines.forEach(line => {
    let txt = line;
    const $line = $(`<div class="vocabulary-line"></div>`);
    if (txt.trim().length) {
      $('<button type="button" class="vocab-entry-search" aria-label="Search this vocabulary entry"><i class="fas fa-search" aria-hidden="true"></i></button>')
        .on('click', selectSearchedWord).appendTo($line)
    } else {
      txt = "------------------";
    }
    $line.append($('<span></span>').text(txt.replaceAll(SEPARATOR_PIPE, " | ")));
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

// toSeconds / fromSeconds live in ./time-format.js (imported at the top).

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

  markIntervalPlayDone(ct);
  setCurrentSub(ct)
  renderSubtitles()

  // Local replay speeds belong to the shared subtitle panel's strategy.
  if (window.mediaBeingPlayed?.source !== 'local' && !document.body.classList.contains('youtube-media-mode')) setSpeed();
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
const _subtitleSearchContext = _dsCaptureSourceContext()
const _subtitleSearchScope = JSON.stringify([_userData.scope, _dsHasOther() ? _dsSourceIdentity('other') : null])
const _subtitleSearch = createSubtitleSearchClient({
  scope: _subtitleSearchScope,
  storage: new URLSearchParams(window.location.search).get('subtitleSearch') === 'indexeddb' ? 'indexeddb' : 'memory',
  // Import the complete corpus before optional posting writes compete with
  // downloads and cache restoration. Queries can always scan pending rows.
  indexingPaused: true,
  assertCurrent: () => _subtitleSearchContext.assertCurrent(),
  onProgress: progress => _setSubtitleSearchStatus(`Searching subtitles: ${progress.visited} / ${progress.total}`, true),
  onMode: mode => { window._subtitleSearchMode = mode },
  onCommitted: documents => _subtitleCorpusView.committed(documents),
})
window.cupitorSubtitleSearch = _subtitleSearch
window._subtitleSearchEngine = _subtitleSearch.storage
let _observedSubtitleIds = new Set()
let _subtitleFlushTimer = null
const _subtitleCorpusView = observeSubtitleCorpus(window, (id,document) => {
  if (document) _observedSubtitleIds.add(id)
  else _observedSubtitleIds.delete(id)
  _subtitleSearch.update(id,document)
  clearTimeout(_subtitleFlushTimer)
  _subtitleFlushTimer = setTimeout(() => _subtitleSearch.flush().catch(error => {
    window._subtitleSearchStorageError = error.message
    _setSubtitleSearchStatus('Subtitle search storage is incomplete: '+error.message,false)
  }), _subtitleSearch.pendingSize >= SUBTITLE_BATCH_DOCUMENTS ? 0 : 50)
}, () => {
  _subtitleSearch.cancel()
  for (const id of _observedSubtitleIds) _subtitleSearch.update(id,null)
  _observedSubtitleIds = new Set()
})
window._subtitleCoverageIndexReady = false
window.cupitorSubtitleMemoryStats = () => _subtitleCorpusView.stats
// Safety default â€” set early so a flaky boot (failed srts/index.json fetch)
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
  button.filter('[aria-controls]').attr('aria-expanded', String(newState === 'expanded'))

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
// reappear â€” so a plain slideToggle would slide it shut on the first click.
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
  // the Wiktionary URL). Result header shortcuts are regular anchors.
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
    const lookupWord = $(e.target).attr('data-lookup-word') || word

    if($(e.target).hasClass('link-special')) {
        stopMedia()
        _showSubtitleWordPopover(e.pageX, e.pageY, word, href, $(e.target).attr('data-index'), wordLang, lookupWord, e.target)
    } else if($(e.target).hasClass('link')) {
        stopMedia() //otherswise the popover might open and close immediately due to the click bubbling to the document listener below
        _showSubtitleWordPopover(e.pageX, e.pageY, word, href, null, wordLang, lookupWord, e.target)
    }
  });

  const closePopover = (popoverId, e) => {
    const $pop = $('#' + popoverId)
    if ($pop.length === 0) return
    if ($pop.attr('hidden') !== undefined) return
    if ($(e.target).closest('#' + popoverId + ', .link, .link-special').length) return
    $pop.attr('hidden', '')
  }
  // Close the subtitle-word popover when the user clicks anywhere outside
  // it (and outside another `.link` that would just reopen it).
  $(document).on('click', function (e) {
    closePopover('subtitleWordPopover', e)
    closePopover('subtitleWordPopoverSpecial', e)
  });

  // Dialogs use their own X / Escape / action controls. Closing every dialog
  // on a document click races the opening click and loses staged input when
  // a click handler replaces its own DOM. Outside-click dismissal belongs to
  // the individual popovers above, never to a global list of dialog IDs.

  $searchText1.change(function (e) {
    searchTextChanged(e).then(r => {})
  })
  window.__cupitorSearchReady = true
  _flushPendingLookup()

  // X-clear button on the search input â€” show only when there's text;
  // clicking clears the input and re-fires the search-changed flow.
  const $searchTextClearBtn = $('#searchTextClearBtn')
  const updateSearchTextClearBtn = () => {
    if (($searchText1.val() || '').length > 0) $searchTextClearBtn.show()
    else $searchTextClearBtn.hide()
  }
  $searchText1.on('input change', updateSearchTextClearBtn)
  $searchText1.on('input', () => {
    if (!String($searchText1.val() || '').trim()) searchTextChanged()
  })
  $searchTextClearBtn.click(() => {
    $searchText1.val('').trigger('change')
    $searchText1.focus()
    updateSearchTextClearBtn()
  })
  updateSearchTextClearBtn()

  // X-clear button injected into the typeahead input of every open select2
  // dropdown. The dropdown is appended to body on open and torn down on
  // close, so we re-inject (idempotently) on each `select2:open`.
  $(document).on('select2:open', '#searchedWords, #addToVocabularyDialogSelect, #vocabularySelect, #vocabNewCategory', () => {
    setTimeout(() => {
      const $field = $('.select2-container--open .select2-search__field')
      if (!$field.length) return
      const $wrap = $field.parent()
      let $clear = $wrap.find('.select2-search-clear')
      if (!$clear.length) {
        $clear = $('<button type="button" class="select2-search-clear" title="Clear" aria-label="Clear">Ã—</button>')
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
    vocabularyLineSelected()
  })

  $('#prevSearchBtn').click(() => { if (_searchHistoryWasLongPress()) return; navigateSearchHistory(-1) })
  $('#nextSearchBtn').click(() => { if (_searchHistoryWasLongPress()) return; navigateSearchHistory(1) })
  // Desktop-only search history keys, deliberately not the browser's native
  // Alt+Left/Right and never inside editable fields or modal editors.
  $(document).on('keydown.searchHistoryKeys', e => {
    if (!(e.altKey && e.shiftKey) || e.ctrlKey || e.metaKey || e.repeat) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (window.matchMedia('(pointer: coarse)').matches) return
    if ($(e.target).closest('input,textarea,select,[contenteditable],.ck,.ui-dialog').length) return
    e.preventDefault()
    navigateSearchHistory(e.key === 'ArrowLeft' ? -1 : 1)
  })
  _wireSearchHistoryLongPress()
  _refreshSearchHistoryPanel()
  $('#searchHistoryBtn').on('click', function () {
    _toggleSearchHistoryPanel(this)
    $('#searchHistoryPanel .srch-hist-row:visible').first().trigger('focus')
  })
  wireMobileSearch()
  _renderKeyboardShortcuts($('#searchHelpShortcuts'))

  $('#showEditVocabulary').on('change', function () {
    window._appSettings.showEditVocabulary = this.checked
    _applyVocabularyEditVisibility()
    saveAppSettings()
  })

  const $searchOptionsButton = $('#searchVocabularyByPrefixBtn')
  const setSearchOptionsOpen = open => {
    $('#searchVocabularyMenu').toggle(open)
    $searchOptionsButton.attr('aria-expanded', String(open))
  }
  $searchOptionsButton.click(e => {
    e.stopPropagation()
    setSearchOptionsOpen($searchOptionsButton.attr('aria-expanded') !== 'true')
  })
  $('#searchVocabularyMenu').on('click', '.search-vocab-menu-item', e => {
    const mode = $(e.currentTarget).data('mode')
    setSearchOptionsOpen(false)
    if ($searchOptionsButton.is(':visible')) $searchOptionsButton.trigger('focus')
    if (mode === 'prefix') searchVocabularyByPrefix()
    else if (mode === 'similar') searchVocabularyBySimilarity()
    else if (mode === 'rerun') searchTextChanged()
  })
  $(document).on('click', e => {
    if (!$(e.target).closest('#searchVocabularyMenu, #searchVocabularyByPrefixBtn').length) {
      setSearchOptionsOpen(false)
    }
  })
  $('.search-vocab-popover-wrap').on('keydown', e => {
    if (e.key !== 'Escape' || $searchOptionsButton.attr('aria-expanded') !== 'true') return
    e.stopPropagation()
    setSearchOptionsOpen(false)
    $searchOptionsButton.trigger('focus')
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
    $('#mediaPlaybackStatus').empty()
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
      // Practice and playlist playback handle keydown themselves. Running the
      // old transport again on keyup resumes a just-paused clip or seeks a
      // newly cued card, which can start it playing.
      if (window._practiceActive || window._playingRecording || e.defaultPrevented || e.isComposing ||
          e.ctrlKey || e.altKey || e.metaKey || $('.ui-dialog:visible, dialog[open]').length ||
          e.target?.isContentEditable || $(e.target).closest('button,summary,input,textarea,select,audio,video,[role="button"],[role="textbox"],[role="combobox"],[role="slider"],.ck').length) return
      if (e.which === 32) { //Space
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

  $('#numberOfFindingsToShow').change(_redrawSearchSettings)

  // Context-lines settings: update the in-memory copy, re-render the
  // current results so the new window takes effect, and debounce-save to
  // GitHub. Clamped to a reasonable [0..20] range; bad input falls back
  // to the existing value.
  const _onContextChange = () => {
    const before = parseInt($('#contextLinesBefore').val(), 10)
    const after = parseInt($('#contextLinesAfter').val(), 10)
    if (Number.isFinite(before)) window._appSettings.contextLinesBefore = Math.max(0, Math.min(20, before))
    if (Number.isFinite(after)) window._appSettings.contextLinesAfter = Math.max(0, Math.min(20, after))
    _redrawSearchSettings()
    saveAppSettings()
  }
  $('#contextLinesBefore').on('change input', _onContextChange)
  $('#contextLinesAfter').on('change input', _onContextChange)
  $('#searchChannelsBtn').on('click', openSearchChannelsDialog)
  _updateSearchChannelsButton()

  // Clip-window bounds (see contiguousClipWindow). Gap threshold applies to both
  // auto-built and captured clips; max duration caps auto-built clips only.
  $('#clipGapThresholdSec').on('change input', e => {
    const v = parseFloat($(e.target).val())
    if (Number.isFinite(v) && v >= 0) {
      window._appSettings.clipGapThresholdSec = Math.min(30, v)
      saveAppSettings()
    }
  })
  $('#clipMaxDurationSec').on('change input', e => {
    const v = parseFloat($(e.target).val())
    if (Number.isFinite(v) && v > 0) {
      window._appSettings.clipMaxDurationSec = Math.max(5, Math.min(120, v))
      saveAppSettings()
    }
  })
  $('#minWordsAround').on('change input', e => {
    const v = parseInt($(e.target).val(), 10)
    if (Number.isFinite(v) && v >= 0) {
      window._appSettings.minWordsAround = Math.min(100, v)
      saveAppSettings()
    }
  })

  $('#recPlayGapSeconds').on('change input', e => { _setItemGap($(e.target).val()) })
  $('#recPlayYouTubeClipSeconds').on('change', e => {
    const value = clipFallbackSeconds($(e.target).val())
    window._appSettings.recPlayYouTubeClipSeconds = value
    $(e.target).val(value)
    saveAppSettings()
  })
  $('#studySessionTimeoutMinutes').on('change', function () {
    const minutes = studyTimeoutMinutes(this.value)
    this.value = minutes
    window._appSettings.studySessionTimeoutMinutes = minutes
    saveAppSettings()
  })
  $('#playbackSpeed').on('change', function () {
    const rate = Number(this.value)
    if (!Number.isFinite(rate) || rate < 0.1 || rate > 4) { this.value = _preferredRecordingAudioRate(); return }
    window._appSettings.playbackSpeed = rate
    window._appSettings.recAudioPlaybackRate = rate
    window._appSettings.practicePlaybackRate = rate
    window._practicePlaybackRate = rate
    _restoreRecordingReplaySpeed()
    for (const audio of [window._recPlayManualAudio, document.querySelector('#practiceAudio audio')]) {
      if (audio) _applyRecordingAudioRate(audio, rate)
    }
    try { window.ytPlayer?.setPlaybackRate(_recordingVideoRate()) } catch (_) {}
    saveAppSettings()
    _updatePracticeSpeedBtn()
  })
  $('#ttsReplacements').on('change', function () {
    window._appSettings.ttsReplacements = this.value.split(/\r?\n/).flatMap(line => {
      const at = line.indexOf('=')
      return at > 0 ? [{ from: line.slice(0, at), to: line.slice(at + 1) }] : []
    })
    saveAppSettings()
  })
  $('#ttsNewlinePauseMs').on('change', function () {
    const ms = Number(this.value)
    if (Number.isFinite(ms) && ms >= 0 && ms <= 10000) {
      window._appSettings.ttsNewlinePauseMs = ms
      saveAppSettings()
    }
  })
  $('#recManualPlaybackMode').on('change', e => _setManualPlaybackPreference($(e.target).val()))
  $('#recPlayTtsFallback').on('change', function () {
    window._appSettings.recPlayTtsFallback = this.checked
    saveAppSettings()
    if (window._practiceActive) _renderPracticeCard()
    if (window._playingRecording && !window._practiceActive) {
      window._recNavGotoIndex = window._recPlayIndex
      _interruptRecordingPlayback()
    }
  })

  // Leaving either box empty or half-typed ("-") is rejected by the setters,
  // which would otherwise strand the field showing something the setting
  // doesn't hold. On blur, snap the display back to what is actually stored â€”
  // for the item gap that is always a number, and for the override a blank
  // legitimately means "use the item gap".
  $('#recPlayGapSeconds').on('blur', () => _syncItemGapUI())
  $('#recPlaySrcTgtGapSeconds').on('blur', () => _syncSrcTgtGapUI())

  // Clearing the field is a meaningful edit here â€” it drops the override and
  // hands the sourceâ†’target pause back to the inter-item gap â€” so unlike the
  // other numeric inputs an empty value is saved rather than ignored.
  $('#recPlaySrcTgtGapSeconds').on('change input', e => {
    const raw = String($(e.target).val() || '').trim()
    _setSrcTgtGap(raw === '' ? null : raw)
  })

  $('#openMusicPanel').on('click', e => { e.preventDefault(); _openMusicPanel() })

  $('#practiceRevealMode').on('change', e => {
    const v = String($(e.target).val() || 'hide')
    if (['hide', 'both', 'flip'].indexOf(v) >= 0) {
      window._appSettings.practiceRevealMode = v
      saveAppSettings()
      // Re-render the current card so the change is felt immediately.
      if (window._practiceActive) _renderPracticeCard()
    }
  })

  $('#toggleAutoPrefixSearchCheckbox').on('change', () => {
    if (window.searchText) renderVocabularyFindings(window._vocabularySearchText || window.searchText)
  })

  $('#numberOfPrefixFindings').on('change input', e => {
    const v = parseInt($(e.target).val(), 10)
    if (Number.isFinite(v) && v > 0) {
      window._appSettings.prefixResultsMax = Math.min(200, v)
      saveAppSettings()
      // Re-run the prefix search so the new cap takes effect immediately.
      if ($('#toggleAutoPrefixSearchCheckbox').is(':checked') && window.searchText) {
        try { renderVocabularyFindings(window._vocabularySearchText || window.searchText) } catch (_) {}
      }
    }
  })

  // Auto library search â€” mirrored by the compact "auto" checkbox on the
  // results bar (#librarySearchAutoCb); both write the same setting.
  $('#toggleAutoLibrarySearchCheckbox').change(e => {
    const on = $(e.target).is(':checked')
    window._appSettings.autoLibrarySearch = on
    saveAppSettings()
    $('#librarySearchAutoCb').prop('checked', on)
    if (on && window.searchText) librarySearch(_librarySearchTerm())
  })

  const $learningLanguage = $('#vocabularyLearningLanguage')
  $learningLanguage.append(Object.values(LANGUAGES).filter(item => item.capabilities.study)
    .map(item => new Option(_vocabularyLanguageName(item.code), item.name)))
    .val(getLangFromUrl().definition?.name || '')
    .on('change', function () {
      const url = new URL(window.location.href)
      url.searchParams.set('lang', this.value)
      const query = String($('#searchText').val() || '').trim()
      if (query) {
        url.searchParams.set('vocabQuery', query)
        if (_familiarSearchLanguage()) url.searchParams.set('searchLanguage', 'known')
        else if (getSelectedLang() === 'en') url.searchParams.set('searchLanguage', 'en')
      }
      url.searchParams.set('vocabLookup', _vocabularyLookupLanguage())
      window.location.assign(url)
    })
  _refreshVocabularyLookupSelect()
  $('#vocabularyLookupLanguage').on('change', async function () {
    const lookup = this.value
    window._appSettings.vocabularyLookupLanguage = lookup
    saveAppSettings()
    _refreshSearchLanguageChoices()
    _reportFamiliarLanguage()
    _refreshMediaSubtitleLanguage().catch(error => console.warn('Could not update companion subtitles:', error))
    for (const container of document.querySelectorAll('#result .lines-cntnr')) {
      const link = container.querySelector('.play-btn-container')?.dataset.url
      if (link && !container.querySelector('.editing')) {
        renderLines(container.id, link).catch(error => console.warn('Could not update result subtitles:', error))
      }
    }
    await _loadSharedHintTranslations(lookup)
    if (_vocabularyLookupLanguage() !== lookup) return
    if (window._requestedSearchText && (window._resultsFamiliarSearchLanguage || _familiarSearchLanguage())) {
      await doSearch(window._requestedSearchText)
      return
    }
    $('#searchedWords').trigger('change.select2')
    _renderTranslationPanel(window._subtitleSearchToken).catch(error => console.warn('Could not refresh translations:', error))
    if (window.unprocessedSearchText && window._vocabularySearchText) {
      renderVocabularyFindings(window._vocabularySearchText)
      return
    }
    const query = String($('#searchText').val() || '').trim()
    if (query && window.vocabulary) {
      window.unprocessedSearchText = null
      window._vocabularyHintQuery = query
      renderVocabularyFindings(query)
      showResultContainer()
    }
  })
  const vocabularyUrl = new URL(window.location.href)
  if ((vocabularyUrl.searchParams.has('vocabQuery') || vocabularyUrl.searchParams.has('vocabLookup')) && getLangFromUrl().supported) {
    const query = vocabularyUrl.searchParams.get('vocabQuery')
    const lookup = vocabularyUrl.searchParams.get('vocabLookup')
    const searchLanguage = vocabularyUrl.searchParams.get('searchLanguage')
    vocabularyUrl.searchParams.delete('vocabQuery')
    vocabularyUrl.searchParams.delete('vocabLookup')
    vocabularyUrl.searchParams.delete('searchLanguage')
    window.history.replaceState(window.history.state, '', vocabularyUrl)
    window._vocabularyReadyPromise.then(async () => {
      await _vocabularyCatalogReady
      if (_vocabularyLookupChoices.includes(lookup) && _vocabularyLookupLanguage() === lookup) {
        saveAppSettings()
        await _loadSharedHintTranslations(lookup)
      }
      if (!query || $('#searchText').val()) return
      if (searchLanguage === 'known' && !$('#searchLanguageSelect option[value="known"]').prop('hidden')) _setLangToggle(false, true)
      else if (searchLanguage === 'known' || searchLanguage === 'en') _setLangToggle(true)
      $('#searchText').val(query).trigger('input')
      await searchTextChanged()
    }).catch(error => console.warn('Vocabulary lookup could not resume', error))
  }

  const $searchLanguage = $('#searchLanguageSelect')
  const studyLanguage = getLangFromUrl().definition
  if (studyLanguage) {
    const name = studyLanguage.name
    $searchLanguage.find('option[value="sv"]').text(name[0].toUpperCase() + name.slice(1))
  }
  $searchLanguage.val(getSelectedLang())
  $searchLanguage.on('change', function () {
    window.forceLangForNextSearch = null
    window.forceMainLangForNextSearch = false
    _setLangToggle(this.value === 'en', this.value === 'known')
    if (window._requestedSearchText) doSearch(window._requestedSearchText)
  })
  $('#toggleLangCb').change(e => {
    _setLangToggle(e.target.checked)
    if (window.searchText) fetchSRTs(window.searchText)
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
  window.subtitles = []
  window.currentSub = null
  window.currentSubIndex = 0
  lastSub = null
  $('#sv-sub').html('')
  $('#en-sub').html('')
  $('#subtitle-timestamp').text('')
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
  // `word` is subtitle / vocabulary text (possibly another user's): text only.
  return `<span> <span data-index="${_.escape(String(index))}" data-lookup-word="${_.escape(uriComponent)}" class="${cls}" href="https://${getLangFromUrl().code}.wiktionary.org/wiki/${encodeURIComponent(uriComponent)}">${_subtitleText(word)}</span></span>`;
}

function getWikiShortcut(word) {
  const term = word.trim()
  if (!term) return ''
  const wiki = `https://${getLangFromUrl().code}.wiktionary.org`
  const path = /\s/.test(term)
    ? `w/index.php?search=${encodeURIComponent(term).replace(/%20/g, '+')}`
    : `wiki/${encodeURIComponent(term.toLowerCase())}`
  return `<a href="${wiki}/${path}" target="_blank" rel="noopener noreferrer">${_.escape(word)}</a>`
}

function getSwedishDictionaryUrl(word, language = getLangFromUrl().code) {
  const term = String(word || '').trim().toLowerCase().normalize('NFC').replace(/\s+/g, ' ')
  if (language !== 'sv' || !term) return ''
  return `https://spraakbanken.gu.se/resurser/data/karp/so-2009-webbversion/${encodeURIComponent(term)}.html`
}

function getSwedishDictionaryLink(word, language = getLangFromUrl().code) {
  const href = getSwedishDictionaryUrl(word, language)
  return href ? ` ä¸¨ <a href="${_.escape(href)}" target="_blank" rel="noopener noreferrer">Svensk ordbok</a>` : ''
}

// Lazy-create + show the small popover that lets the user choose between
// "Search here" (populate the search box) and "Search on wiki" (open the
// stored Wiktionary URL), plus Svensk ordbok for Swedish words.
function _showSubtitleWordPopover(pageX, pageY, word, href, index = null, wordLang = null, lookupWord = word, anchor = null) {
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
      <button type="button" data-action="search-so">Svensk ordbok</button>
      <button type="button" data-action="google-translate">Google Translate</button>
      ${index !== null ? `<button type="button" id="${popoverId}-add-favorite" data-action="add-favorite"></button>` : ''}
    </div>`)
    $pop.find('[data-action="add-favorite"]').text(`Mark (${word})`)
    $('body').append($pop)
  }
  if(index != null) {
    if(addStaredLine) {
      $(`#${popoverId}-add-favorite`).attr('data-action', 'add-favorite').text(`Mark (${word})`)
    } else {
      $(`#${popoverId}-add-favorite`).attr('data-action', 'remove-favorite').text(`Unmark (${word})`)
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
      if (wordLang === 'sv' || wordLang === 'en') {
        window.forceLangForNextSearch = wordLang
        // And move the switch with it, as replaying from the history does: the
        // pin lasts one search, so a switch left pointing the other way both
        // describes these results wrongly and sends the next typed search back
        // to the language the user has just left.
        _setLangToggle(wordLang === 'en')
      }
      $('#searchText').val(word).trigger('change')
    }
  })
  $pop.find('[data-action="search-wiki"]').on('click.swp', e => {
    fn(e)
    if (href) window.open(href, '_blank').focus()
  })
  // The URL language is the studied language; #en-sub words always stay English.
  const soHref = getSwedishDictionaryUrl(lookupWord, wordLang === 'en' ? 'en' : getLangFromUrl().code)
  $pop.find('[data-action="search-so"]').toggle(!!soHref).on('click.swp', e => {
    fn(e)
    if (soHref) window.open(soHref, '_blank', 'noopener,noreferrer')
  })
  $pop.find('[data-action="google-translate"]').on('click.swp', e => {
    fn(e)
    const source = wordLang === 'en' ? 'en' : getLangFromUrl().code
    const target = source === 'en' && _vocabularyLookupLanguage() === 'en'
      ? getLangFromUrl().code : _translationTargetLanguage(source)
    if (word) window.open(_googleTranslateUrl(word, source, target), '_blank', 'noopener,noreferrer')
  })
  $pop.find('[data-action="add-favorite"]').on('click.swp', e => {
    fn(e)
    addStarredLine(index)
  })
  $pop.find('[data-action="remove-favorite"]').on('click.swp', e => {
    fn(e)
    removeStarredLine(index)
  })
  // Keep the panel outside the tapped word, including a touch-safe gap.
  // A panel starting four pixels from the tap overlaps the word's hit area:
  // Chromium can retarget a second tap to its larger "Search here" button.
  $pop.removeAttr('hidden').css({ position: 'absolute', left: 0, top: 0, visibility: 'hidden' })
  const pw = $pop.outerWidth(), ph = $pop.outerHeight()
  const ww = window.innerWidth, wh = window.innerHeight
  const rect = anchor?.getBoundingClientRect()
  const gap = 12
  const anchorTop = rect ? rect.top + window.scrollY : pageY
  const anchorBottom = rect ? rect.bottom + window.scrollY : pageY
  let left = rect ? rect.left + window.scrollX : pageX + gap
  let top = anchorBottom + gap
  if (left + pw > window.scrollX + ww) left = window.scrollX + ww - pw - 6
  if (top + ph > window.scrollY + wh - 6) top = anchorTop - ph - gap
  $pop.css({ left: Math.max(window.scrollX + 2, left),
    top: Math.max(window.scrollY + 2, top), visibility: 'visible' })
}

function getWikiLinkSpecial(word, uri = null, index = null) {
  return getWikiLink(word, uri, 'link-special', index)
}

// decodeHtmlEntities / removeHtmlTags / decodeHtmlTags live in ./html-utils.js
// (imported at the top). encodeHtmlTags is wrapped here so we can pass the
// project's `uuid` generator (from data-structures.js) for sturdier ids.
function encodeHtmlTags(text) {
  return _coreEncodeHtmlTags(text, uuid)
}

function populateWikiLinks(text, $el, index = null) {
  $el && $el.html('')
  const [encoded, encodings] = encodeHtmlTags(text)

  // Words become text-only links; the subtitle's own tags come back only as
  // the formatting tags safeSubtitleTag keeps.
  const fn = (it, second) => {
    if (Object.values(encodings).map(it => it.trim()).includes(it)) return it
    if (it.trim().length < 2) return _.escape(it)
    return getWikiLinkSpecial(it, second, index)
  }
  const withLinks = encoded.split(/[ \n]/).flatMap(it => {
    const ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => fn(_w))
    }
    return fn(it, ws[0])
  }).join(' ');

  const finalHtml = decodeHtmlTags(withLinks, encodings, _safeSubtitleTag);
  $el && $el.append(finalHtml)

  
  return finalHtml
}

function populateSearchWords(sub, $el) {
  $el.html('')

  const wordLink = (word, uri = null) => {
    return $('<span style="cursor: pointer;"></span>').attr('data-uri', uri || word).text(` ${word}`)
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

function changeMediaIfNeededTo(media, options) {
  const alreadyBeingPlayed = window.playingYoutubeVideo && _.isEqual(window.mediaBeingPlayed, media);
  if ((!alreadyBeingPlayed || options?.forceLoad) && media.source === 'link') {
    return loadYoutubeVideo(media.link, options)
  }
  return new Promise(resolve => resolve())
}

function starredLineSelected(el, index, ts) {
  return async e => {
    // ts may be null at render time (mp3Choice loads starred indices before
    // any subtitle SRT is fetched). Resolve it lazily on click â€” first from
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
// already saved (the baseline captured on load / after a save) â€” so it
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
// mode) â€” neither persists anything. Async because subtitles for the
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
  // Otherwise lazy-fetch the SRT for this link and parse it â€” buttons show
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

  // window.subtitles isn't always loaded when this runs â€” loadStarredLines
  // fires from app init before any subtitle SRT is fetched. Fall back to an
  // empty list so the starred index round-trips even without timestamps;
  // a later renderStarredLines() (post-subtitle-load) will pick up the ts.
  const subs = Array.isArray(window.subtitles) ? window.subtitles : []
  window.starredLines.forEach(index => {
    const hit = subs.find(it => it && it.index === index)
    const ts = hit ? hit.ts : null
    const x = $('<span></span>').attr('data-index', index).text(index)
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

  if (currentSub && currentSub !== lastSub) {
    populateWikiLinks(currentSub.sv, $('#sv-sub'), currentSub.index);
    populateSearchWords(currentSub, $('#sv-sub-mirror'));

    const translation = currentSub.translation
    $('#en-sub').html(_safeSubtitleHtml(currentSub.showTranslationLanguage ? translation?.text : currentSub.en))
      .attr('lang', translation?.language || (currentSub.showTranslationLanguage ? null : 'en'))
      .attr('data-subtitle-language', currentSub.showTranslationLanguage && translation ? translation.language.toUpperCase() : null)
    $('#currentTime').text(currentSub.index)
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

async function seekToYoutubeTime(t, { isCurrent = () => true, confirmVideoId, requirePlaying = false, now, isForeground } = {}) {
  if (!isCurrent()) return
  if (!window.ytPlayer || typeof window.ytPlayer.seekTo !== 'function') return
  const target = Number(t) || 0
  let beforeCt = 0
  try { beforeCt = window.ytPlayer.getCurrentTime() || 0 } catch (_) {}
  console.log('Seek request, target=', fromSeconds(target), 'currentTime=', fromSeconds(beforeCt))
  window.seekRequestProcessing = true
  const request = window._youtubeSeekToken = (window._youtubeSeekToken || 0) + 1
  const finish = () => { if (request === window._youtubeSeekToken) window.seekRequestProcessing = false }
  if (confirmVideoId) {
    try {
      const landed = await confirmRecordingSeek({ player: window.ytPlayer, videoId: confirmVideoId,
        start: t, requirePlaying, now, isForeground,
        isCurrent: () => isCurrent() && request === window._youtubeSeekToken })
      if (landed) window.proxyYoutubeCurrentTime = target
      return landed
    } finally { finish() }
  }
  try { window.ytPlayer.seekTo(target, true) } catch (_) {}

  // Bounded poll: every 100ms for up to 3s, looking for the playhead to land
  // within TOLERANCE of the target. The old code used `Math.max(6, |gap|)`
  // for tolerance â€” when the initial gap was huge that made the "close
  // enough" check pass instantly (apparent success, no actual seek). Also
  // dropped the "delta nudge" loop that walked the seek target backwards by
  // 1s per tick; YouTube's own seek is reliable enough without it. On
  // timeout these ordinary seek callers resolve. Player uses the confirmed
  // branch above and never treats this best-effort timeout as success.
  const TICK_MS = 100
  const MAX_TICKS = 30        // 3s overall budget
  const TOLERANCE = 1.5       // seconds â€” close enough that playback will be visibly at the right spot
  const REISSUE_AT = 10       // ticks (~1s): if still far, re-issue the seek once
  return new Promise(resolve => {
    let ticks = 0
    const id = setInterval(() => {
      if (!isCurrent() || request !== window._youtubeSeekToken) { clearInterval(id); finish(); resolve(); return }
      ticks++
      let ct = 0
      try { ct = window.ytPlayer.getCurrentTime() || 0 } catch (_) {}
      if (Math.abs(ct - target) <= TOLERANCE) {
        clearInterval(id)
        finish()
        window.proxyYoutubeCurrentTime = target
        console.log('Seek request completed', fromSeconds(target), 'currentTime=', fromSeconds(ct))
        return resolve()
      }
      if (ticks === REISSUE_AT) {
        try { window.ytPlayer.seekTo(target, true) } catch (_) {}
      }
      if (ticks >= MAX_TICKS) {
        clearInterval(id)
        finish()
        console.warn('seekToYoutubeTime: timed out without converging â€” proceeding anyway', { target, currentTime: ct })
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
  try { _initPracticeLogFrontBanner() } catch (_) {}
  // Globally pin every jQuery UI dialog to the top of the viewport with
  // position:fixed. jQuery UI defaults to position:absolute anchored on the
  // current scroll position, so a dialog opened after the user scrolled
  // lands offscreen. Fixed + a small top offset keeps every dialog
  // consistent without per-call _pinDialogToViewport sprinkles.
  installDialogScrolling($)
  // Default select2 matcher strips diacritics, so typing "a" matches "Ã¤"
  // and vice-versa â€” wrong for Swedish vocab where Ã¤/Ã¶/Ã¥ are distinct
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
  // Track the current select2 search term so templateResult can highlight the
  // matched substring. select2's templateResult only receives the option
  // (no term); peek the search field's value instead. One global is enough
  // because at most one select2 dropdown can be open at a time.
  $(document).on('input', '.select2-search__field', function () {
    window._lastSelect2Term = $(this).val() || ''
  })
  $(document).on('select2:close', function () {
    window._lastSelect2Term = ''
  })
  // #searchedWords is pre-initialised in language.html (inline script) so the
  // dropdown is interactive before this module loads â€” but that init does NOT
  // pass the matcher, so a search for "a" still matched "Ã¤/Ã¥" via select2's
  // default diacritic-stripping. Tear down and re-init here with the matcher
  // bolted on, keeping the same styleCategory templates the inline init used.
  const _escapeHtmlForVocab = (s) => String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ))
  const _highlightMatchInText = (text) => {
    const term = (window._lastSelect2Term || '').trim()
    if (!term || !text) return _escapeHtmlForVocab(text || '')
    const lower = String(text).toLowerCase()
    const idx = lower.indexOf(term.toLowerCase())
    if (idx < 0) return _escapeHtmlForVocab(text)
    return _escapeHtmlForVocab(text.slice(0, idx)) +
           '<mark class="vocab-hl">' + _escapeHtmlForVocab(text.slice(idx, idx + term.length)) + '</mark>' +
           _escapeHtmlForVocab(text.slice(idx + term.length))
  }
  const _searchedWordsStyleCategory = (option) => {
    if (!option || !option.id) return option && _escapeHtmlForVocab(option.text || '')
    if (typeof option.id === 'string' && option.id.indexOf('__cat__:') === 0) {
      // Category heading â€” italic grey + highlight match.
      return $(`<span style="color:#888;font-style:italic;">${_highlightMatchInText(option.text)}</span>`)
    }
    return $('<span>').html(_highlightMatchInText(_displayVocabularyLine(option.text)))
  }
  // Selection (closed-state) doesn't need highlighting â€” the search term is gone.
  // escapeMarkup below passes strings through as HTML, so every string
  // returned here is escaped (vocabulary text may be another user's).
  const _searchedWordsStyleSelection = (option) => {
    if (!option || !option.id) return option && _escapeHtmlForVocab(option.text || '')
    if (typeof option.id === 'string' && option.id.indexOf('__cat__:') === 0) {
      return $('<span style="color:#888;font-style:italic;"></span>').text(option.text)
    }
    return _escapeHtmlForVocab(_displayVocabularyLine(option.text || ''))
  }
  const $sw = $('#searchedWords')
  if ($sw.length) {
    if ($sw.hasClass('select2-hidden-accessible')) $sw.select2('destroy')
    $sw.select2({
      placeholder: 'Vocabulary',
      allowClear: true,
      templateResult: _searchedWordsStyleCategory,
      templateSelection: _searchedWordsStyleSelection,
      matcher: (params, data) => {
        if (diacriticAwareMatcher(params, data)) return data
        if (!data?.id || data.id.startsWith('__cat__:')) return null
        return _displayVocabularyLine(data.text).toLowerCase().includes(params.term.trim().toLowerCase()) ? data : null
      },
      escapeMarkup: m => m
    })
  }
  const $categoryPicker = $('#vocabNewCategory').select2({
    placeholder: 'Choose or type a category',
    width: '100%',
    allowClear: true,
    tags: true,
    matcher: diacriticAwareMatcher,
    createTag({ term }) {
      const name = term.trim()
      if (!name || name === '__empty__' || /[\r\n]/.test(name)) return null
      return { id: name, text: name, newCategory: true }
    },
    templateResult(category) {
      return category.newCategory ? 'Create â€œ' + category.text + 'â€' : category.text
    },
  })
  $categoryPicker.next('.select2').find('[role="combobox"]')
    .attr('aria-labelledby', (_, current) => 'vocabCategoryLabel ' + current)
  $("#addToVocabularyDialogSelect").select2({
    placeholder: 'Reference word',
    width: '100%',
    allowClear: true,
    matcher: diacriticAwareMatcher
  }).change(() => {
    _refreshVocabDeleteBtn()
    if (_vocabInsertPosition() === 'inline') _syncVocabInsertText('inline')
  })
  $('#vocabInsertPosition').on('change', 'input', function () {
    // Each edit needs one position. Re-clicking the current choice keeps it selected.
    if (!this.checked) {
      this.checked = true
      return
    }
    $('#vocabInsertPosition input').not(this).prop('checked', false)
    _syncVocabInsertText(this.value)
  })
  audioPlayer && hidePlayer(audioPlayer)
  videoPlayer && hidePlayer(videoPlayer)
});

// { link: category } from srts/categorisation.txt, own file first, the other
// user's under it. Own file: one plain request (tries: 1, default cache), as
// before layering. With no own repo (a guest) the other user's file is the
// only source and gets the usual retries. A failed own read leaves every
// video uncategorised instead of stopping the boot.
async function fetchCategorisation() {
  try {
    const layers = await _dsReadLayers('srts/categorisation.txt', {
      lang: _dsLangFromLocation(), onNotice: _dsNotice,
      retry: _dsHasSelf() ? { tries: 1, init: { cache: 'default' } } : {},
      otherRetry: _OTHER_LAYER_RETRY,
    })
    return _dsMergeCategorisationLayers(layers)
  } catch (e) {
    console.warn('fetchCategorisation failed', e)
    return {}
  }
}

function populateAllLinks() {
  // let $mp3Choice = $('#mp3Choice');
  const $mp3Choice = $('#mp3Choice');
  $mp3Choice.html('').append($(`<option>-</option>`).attr('value', ''))
  const srts = window.srts
  if ($mp3Choice.data('select2')) $mp3Choice.select2('destroy')
  if (srts.length > 200) {
    const owner = _ownerLabeller()
    const entries = srts.map(item=>({id:item.link,text:owner.prefix(String(item.name),item),category:getCategory(item)}))
    $mp3Choice.select2({ajax:{delay:100,transport:(params,success)=>{
      const term=String(params.data.term || '').toLocaleLowerCase(),page=Number(params.data.page)||1
      const matches=entries.filter(item=>(item.text+' '+item.category).toLocaleLowerCase().includes(term))
      success({results:matches.slice((page-1)*50,page*50),pagination:{more:page*50<matches.length}})
      return {abort(){}}
    },processResults:data=>data}})
    // Select2 keeps selected options; discard old unselected options so a
    // long session does not gradually recreate the full subtitle index DOM.
    $mp3Choice.off('select2:select.bounded').on('select2:select.bounded',()=>{
      $mp3Choice.find('option').filter(function(){return this.value&&!this.selected}).remove()
    })
    return srts
  }
  $mp3Choice.select2()
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
      ogs[category] = $('<optgroup>').attr('label', label)
    }
    return ogs[category]
  }
  const owner = _ownerLabeller()
  srtLinks.forEach(link => {
    const item = srts.find(it => it.link === link)
    // Index names and categories may be another user's: text and attributes only.
    const shown = String(item.name).replace(".en.srt", "").replace(getTargetLangSrtSuffix(), "")
    const $opt = $('<option>').text(owner.prefix(shown, item)).attr('value', item.link)
    getOptgroup(getCategory(item)).append($opt)
  })

  Object.values(ogs).forEach(it => $mp3Choice.append(it))
  return srts;
}

function _loadSubtitleGroups(items, context, {onFailure, onProgress} = {}) {
  return loadSubtitlePacks(items, {
    loader: _subtitleBundleLoader,
    baseUrl: entry => {
      context.assertCurrent()
      if (entry.sourceIdentity && entry.sourceIdentity !== _dsSourceIdentity(entry.src || 'primary'))
        throw Object.assign(new Error('The subtitle index belongs to another source. Reload before opening it.'), {code: 'stale-data-source'})
      return _dsReadUrl(entry.src || 'primary', 'srts', _dsLangFromLocation())
    },
    code: getLangFromUrl().code,
    assertCurrent: () => context.assertCurrent(),
    onFailure, onProgress,
    loadLoose: entry => _withTimeout(getSubtitlesForLink(entry.link, entry.source, {prepareOnly:true}), 15000, entry.link),
    commitBatch: async rows => {
      context.assertCurrent()
      const records = []
      for (const {entry, sv, en} of rows) {
        if (entry.sourceIdentity && entry.sourceIdentity !== _dsSourceIdentity(entry.src || 'primary'))
          throw Object.assign(new Error('The subtitle index belongs to another source. Reload before opening it.'), {code: 'stale-data-source'})
        // Playback, an edit or a capture push may already have installed a
        // newer complete pair while this pack was downloading.
        const current = window.allSubtitles[entry.link]
        if (current?._remoteComplete && !current._partial) continue
        const snapshot = _applySubtitleSnapshot(entry.link, {sv, en, source:entry.source, fileName:entry.name,
          readOnly:!!entry.readOnly, bundle:entry.bundle, bundleRevision:entry.bundleRevision})
        // Use the merged snapshot so unsynced captures are preserved in both
        // the download cache and the worker's observable corpus.
        records.push({link:entry.link, name:snapshot.fileName, sv:snapshot.sv, en:snapshot.en, source:snapshot.source,
          owner:entry.owner || _sourceOwner('primary'), complete:snapshot._remoteComplete === true,
          sourceIdentity:entry.sourceIdentity || _dsSourceIdentity(entry.src || 'primary'),
          bundle:entry.bundle, bundleRevision:entry.bundleRevision})
      }
      // Stage all rows synchronously, then commit bounded batches rather than
      // opening a download-cache and search transaction for every clip.
      try { await Promise.all([_cacheWriteMany(records), _subtitleSearch.flush()]) }
      catch (error) {
        window._subtitleSearchStorageError = error.message
        _setSubtitleSearchStatus('Subtitle search storage is incomplete: '+error.message,false)
        throw error
      }
      context.assertCurrent()
    },
  })
}

async function loadAllSubtitles() {
  const context = _dsCaptureSourceContext()
  try {
    requireStudyLanguage(window.location)
    // Kick the vocabulary fetch off in parallel so a flaky srts/index.json
    // can't strand it. Used to live inside this try-block, where any earlier
    // throw skipped over it and left window.vocabulary undefined for the
    // rest of the session.
    const vocabReady = fetchVocabulary()
    const settingsReady = loadAppSettings()
    // Own index first, the other user's under it (self wins per link). A
    // missing file on either side is an empty layer, so a fresh data repo
    // boots clean; the other layer's problems are reported, never fatal.
    const indexLayers = await _dsReadLayers('srts/index.json', {
      lang: _dsLangFromLocation(), onNotice: _dsNotice, otherRetry: _OTHER_LAYER_RETRY,
    })
    const otherIndexProblem = _dsOtherListProblem(indexLayers, 'srts/index.json')
    if (otherIndexProblem) _dsNotice(otherIndexProblem)
    let srts = _dsMergeIndexLayers(indexLayers)
    // Normalize names to NFC on read so every downstream consumer sees a
    // single canonical encoding regardless of how the entry was committed.
    if (Array.isArray(srts)) srts = srts.map(it => it ? { ...it, name: _nfc(it.name) } : it)
    window.srts = srts
    // The index is in: window.cupitorKnownVideos can answer from here on.
    window._srtsIndexLoaded = true
    window._subtitleCoverageIndexReady = true

    // Cache pass: populate window.allSubtitles from IndexedDB before queuing
    // any network fetches. Hits are searchable instantly; only entries that
    // aren't in the cache go to the SRT fetch pool below. Entries cached but
    // no longer in index.json are evicted in the background. The cache layer
    // silently no-ops if IDB is unavailable (private mode, quota, etc.), so
    // a first boot or a degraded environment falls back to the old behavior.
    context.assertCurrent()
    const cacheHits = []
    const deadLinks = []
    {
      const indexLinks = new Set(srts.map(s => s.link))
      const indexByLink = new Map(srts.map(s => [s.link, s]))
      const primaryOwner = _sourceOwner('primary')
      for await (const cached of _cachedSubtitleBatches()) {
      context.assertCurrent()
      for (const [link, entry] of cached) {
        if (!indexLinks.has(link)) { deadLinks.push(link); continue }
        // Cached from another repo than the one the index now names (the
        // other user changed, or the video moved between libraries): a miss,
        // so it is fetched again and the record overwritten.
        if (!_dsCacheRecordMatches(entry, indexByLink.get(link), primaryOwner)) continue
        if (reusableSubtitleCache(entry) && window.allSubtitles[link]?._remoteComplete !== true) {
          _applySubtitleSnapshot(link, {
            sv: entry.sv,
            en: entry.en || null,
            source: entry.source,
            fileName: entry.name,
            fetchedFrom: 'cache',
            bundle: entry.bundle, bundleRevision: entry.bundleRevision,
            readOnly: !!(indexByLink.get(link) || {}).readOnly,
          })
          cacheHits.push(link)
        }
      }
      await _subtitleSearch.flush()
      }
      if (deadLinks.length) {
        // Evict in the background â€” never block subtitle readiness on this.
        _cacheDeleteMany(deadLinks).catch(e => console.warn('[cache] evict failed', e))
      }
    }

    // 404s â€” the file genuinely isn't there, so never retried.
    const notFound = []
    // Transient failures (rate limiting / 5xx / network blip / timeout) â€” these
    // are queued for a background retry after subtitles are declared ready, so
    // a flaky load doesn't permanently leave gaps in window.allSubtitles.
    const transientFailures = []
    // Only fetch what the cache didn't satisfy. On a steady-state boot this
    // is typically empty (everything came from IDB); on first boot it's the
    // whole corpus; on a deploy that added videos it's just the new ones.
    const toFetch = srts.filter(it => !window.allSubtitles[it.link] || window.allSubtitles[it.link]._partial)
    if (cacheHits.length || deadLinks.length || toFetch.length !== srts.length) {
      console.log(`[cache] boot: ${cacheHits.length} hits, ${toFetch.length} to fetch, ${deadLinks.length} evicted`)
    }
    _srtProgressShow(toFetch.length)
    // Four pack jobs at a time. Each pack is downloaded/parsed once, then
    // imported in bounded batches before more are staged.
    const srtLoadingDone = _loadSubtitleGroups(toFetch, context, {
      onFailure: (entry, error) => {
        if (error?.kind === 'notfound') notFound.push(entry.link)
        else transientFailures.push(entry)
      },
      onProgress: (done, total) => _srtProgressUpdate(done, total),
    })
      .finally(() => _srtProgressHide())
    srtLoadingDone.catch(() => {}) // Observed below after vocabulary/settings.

    const categories = await fetchCategorisation()
    context.assertCurrent()
    window.categories = categories

    populateAllLinks();

    await vocabReady
    await settingsReady
    context.assertCurrent()

    populateVocabularyHeadings($('#vocabularySelect'))

    // Now make sure any still-in-flight SRT fetches have settled before we
    // declare subtitles ready â€” searches deferred in doSearch will fire here.
    await srtLoadingDone
    context.assertCurrent()
    if (srts.every(item=>window.allSubtitles[item.link]?._remoteComplete&&!window.allSubtitles[item.link]?._partial)) {
      await _subtitleSearch.run('retain',{ids:Object.keys(window.allSubtitles)}).catch(error=>console.warn('Search cache cleanup will retry on reload',error))
      context.assertCurrent()
    }
    if (notFound.length > 0) {
      console.log("Not found", notFound.join('\n'))
    }
    if (transientFailures.length > 0) {
      console.warn(`[srt] ${transientFailures.length} subtitle(s) failed transiently â€” retrying in background`)
      // Intentionally not awaited: search becomes available immediately with
      // whatever loaded, and the retry tops up window.allSubtitles behind it.
      _retrySrtsInBackground(transientFailures)
    }
  } catch (e) {
    console.warn('loadAllSubtitles error', e);
  } finally {
    try { context.assertCurrent() } catch (_) { return }
    if (!getLangFromUrl().supported) {
      window.srts = []; window.vocabulary = {}
      window._vocabularyReadyResolve?.()
    }
    window._subtitlesLoaded = true;
    window._subtitlesReadyResolve();
    _subtitleSearch.setIndexingPaused(false).catch(error=>console.warn('Subtitle index preparation will retry on reload',error))
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
  const context = _dsCaptureSourceContext()
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
      context.assertCurrent()

      const stillFailing = []
      await _loadSubtitleGroups(pending.filter(entry => !window.allSubtitles[entry.link] || window.allSubtitles[entry.link]._partial), context, {
        onFailure: (entry, error) => { if (error?.kind !== 'notfound') stillFailing.push(entry) },
      })

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
  } catch (e) {
    if (e?.code !== 'stale-data-source') throw e
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
// the line text on `item.text` â€” that's the canonical field every reader
// should use. When a `lang` argument is supplied (e.g. 'sv', 'en'), the same
// text is ALSO mirrored under `item[lang]` so the few legacy consumers that
// read item.sv / item.en (the combined sv+en merge in loadSubtitlesForLink;
// the search-result `sv_subs.data` / `en_subs.data` per-row rendering) keep
// working. Previously the lang variant stored text ONLY under item[lang],
// which is what caused practice edits to render as "(empty)" â€” the practice
// renderer reads item.text exclusively.
// srtToJson lives in ./srt-parser.js (imported at the top).

function getCategory(item) {
  const link = item.link;
  let category = window.categories[link];
  category = category && category.trim()
  return category || 'Okategoriserad';
}

function storeSubtitles(subs) {
  const strategy = "Normal-Slow"

  let originalSubs = subs.map(it => ({...it}))


  for (let i = 0; i < originalSubs.length; i++) {
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

  if (window.currentSub) console.log("set currentSub", toStringSubtitle(window.currentSub))
  return originalSubs;
}

// toStringSubtitle + srtError live in ./srt-parser.js (imported at the top).

// â”€â”€â”€ IndexedDB cache for SRT subtitle pairs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stores `{link, name, sv, en, source, owner, cachedAt, contentVersion, complete}` records keyed by
// `link`. `sourceIdentity` names the repository, branch, language and root.
// Boot refetches owner-only legacy records once, and ignores records from a
// different source even when the owner and video link still match.
//
// Only complete, current-version SRT snapshots are reusable. Older records
// can contain a partial capture and are automatically fetched again. Boot
// reads the cache, populates window.allSubtitles for
// hits, fetches the remaining entries from GitHub, and evicts cache entries
// whose link no longer appears in srts/index.json. To pull fresh server-side
// content, the user clicks "Refresh subtitles" in the Manage menu (which
// clears the store and reloads).
//
// All failure modes (IDB unavailable, open errored, quota exceeded, tx
// aborted) silently fall back to no-cache mode â€” the cache is purely a
// performance optimization, never a correctness dependency. A flaky IDB
// layer must NOT keep the app from booting.
const CUPITOR_CACHE_DB_PREFIX = 'cupitor-cache-v1'
const CUPITOR_CACHE_STORE = 'subtitles'
const CUPITOR_CACHE_SCHEMA = 1

let _cacheDbPromise = null
let _cacheDbDisabled = false
const _cacheSuppressedOwners = new Set()

function _cacheDbName() {
  // Per-language DB so swedish/spanish caches don't trample each other.
  const lang = (typeof getLangFromUrl === 'function' && getLangFromUrl().fullName) || 'default'
  return _scopedKey(`${CUPITOR_CACHE_DB_PREFIX}-${lang}`)
}

function _openSubtitlesCache() {
  if (_cacheDbDisabled) return Promise.resolve(null)
  if (_cacheDbPromise) return _cacheDbPromise
  if (typeof indexedDB === 'undefined') {
    console.warn('[cache] IndexedDB unavailable â€” running in no-cache mode')
    _cacheDbDisabled = true
    return Promise.resolve(null)
  }
  _cacheDbPromise = new Promise((resolve) => {
    let req
    try { req = indexedDB.open(_cacheDbName(), CUPITOR_CACHE_SCHEMA) }
    catch (e) {
      console.warn('[cache] indexedDB.open threw â€” running in no-cache mode', e)
      _cacheDbDisabled = true
      resolve(null); return
    }
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(CUPITOR_CACHE_STORE)) {
        db.createObjectStore(CUPITOR_CACHE_STORE, { keyPath: 'link' })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { db.close(); _cacheDbPromise = null }
      try { rememberCache(db.name, localStorage) } catch (_) {}
      resolve(db)
    }
    req.onerror = () => {
      console.warn('[cache] indexedDB.open errored â€” running in no-cache mode', req.error)
      _cacheDbDisabled = true
      resolve(null)
    }
    // onblocked fires when another tab holds an older-version connection
    // open. We don't need to act â€” the success/error handler will still
    // resolve once the other tab releases.
    req.onblocked = () => console.warn('[cache] indexedDB.open blocked (another tab is holding an older version)')
  })
  return _cacheDbPromise
}

function _cacheStore(db, mode) {
  return db.transaction(CUPITOR_CACHE_STORE, mode).objectStore(CUPITOR_CACHE_STORE)
}

async function* _cachedSubtitleBatches() {
  const db = await _openSubtitlesCache()
  if (!db) return
  let after = null
  for (;;) {
    const {rows,last} = await new Promise((resolve,reject) => {
      const rows=[];let last=null,bytes=0
      const range=after==null?undefined:IDBKeyRange.lowerBound(after,true)
      const req=_cacheStore(db,'readonly').openCursor(range)
      req.onerror=()=>reject(req.error)
      req.onsuccess=()=>{
        const cursor=req.result
        if(!cursor){resolve({rows,last});return}
        const value=cursor.value;last=cursor.key
        if(value?.link){rows.push([value.link,value]);bytes+=2*((value.sv?.length||0)+(value.en?.length||0))}
        if(rows.length>=SUBTITLE_BATCH_DOCUMENTS||bytes>=SUBTITLE_BATCH_BYTES)resolve({rows,last})
        else cursor.continue()
      }
    })
    if(last==null)return
    yield rows
    after=last
  }
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
        if (!e || !e.link || _cacheSuppressedOwners.has(e.owner || _sourceOwner('primary'))) continue
        try { store.put({ link: e.link, name: e.name, sv: e.sv, en: e.en, source: e.source, owner: e.owner,
          sourceIdentity: e.sourceIdentity,
          bundle: e.bundle, bundleRevision: e.bundleRevision,
          cachedAt: now, contentVersion: SUBTITLE_CONTENT_VERSION, complete: e.complete === true }) } catch (_) {}
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (ev) => {
        console.warn('[cache] writeMany tx error', ev.target && ev.target.error)
        resolve()
      }
      tx.onabort = (ev) => {
        const err = ev.target && ev.target.error
        if (err && err.name === 'QuotaExceededError') {
          console.warn('[cache] quota exceeded â€” disabling cache for the rest of this session')
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

// Mirror the current in-memory subtitle pair for `link` into the persistent
// IndexedDB cache. Called right after a capture / inline edit / translation is
// pushed to GitHub, so a reload (or another view) sees the new content
// immediately â€” no waiting for GitHub's CDN to catch up, and no re-fetch.
// Capture pushes install the exact complete API merge before calling this.
// A partial/unverified record is tagged so boot will fetch the full SRT. A
// concurrent remote change from another device is reconciled on an explicit
// "Refresh subtitles".
async function _cacheWriteSubtitleFromMemory(link) {
  if (window.allSubtitles[link]?._evicted) await _restoreSubtitleDocument(link)
  const s = link && window.allSubtitles && window.allSubtitles[link]
  if (!s || (s.sv == null && s.en == null)) return Promise.resolve()
  const entry = (window.srts || []).find(entry => entry.link === link)
  return _cacheWriteOne({ link, name: s.fileName, sv: s.sv, en: s.en, source: s.source, owner: _ownerOfLink(link), complete: s._remoteComplete === true,
    sourceIdentity: entry?.sourceIdentity || _dsSourceIdentity(entry?.src || 'primary'),
    bundle: entry?.bundle, bundleRevision: entry?.bundleRevision })
    .catch(e => console.warn('[cache] post-push write failed for', link, e))
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
// option-D versioning is that the cache is otherwise trusted forever â€”
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
    // Network error / DNS / connection reset â€” all worth retrying.
    throw _srtError('transient', 'network: ' + (e && e.message))
  }
  if (res.status === 404) throw _srtError('notfound', 'HTTP 404 ' + url)
  if (!res.ok) throw _srtError('transient', 'HTTP ' + res.status + ' ' + url)
  return res.text()
}

const _subtitleBundleLoader = createBundleLoader(url => _withTimeout(_fetchSrtFile(url), 15000, url))
async function _fetchIndexedSrt(entry, code, who) {
  const base = _dsReadUrl(who || entry.src || 'primary', 'srts', _dsLangFromLocation())
  if (entry.bundle) {
    const text = await _subtitleBundleLoader.track(entry, code, base)
    if (text == null) throw _srtError('notfound', 'Subtitle track is absent from bundle')
    return text
  }
  return _fetchSrtFile(`${base}/${encodeURIComponent(_nfc(entry.name) + '.' + code + '.srt')}`)
}

// Fetch optional companions on demand. Keep a small cache so multiple
// clips from the same media can reuse the request.
const _preferredSubtitleTracks = new Map()
function _companionSubtitleKey(entry, language) {
  const base = _dsReadUrl(entry.src || 'primary', 'srts', _dsLangFromLocation())
  return JSON.stringify([base, entry.name, entry.bundle, entry.bundleKey, entry.bundleRevision, language])
}

function _cacheCompanionSubtitles(key, request) {
  _preferredSubtitleTracks.set(key, request)
  if (_preferredSubtitleTracks.size > 12) _preferredSubtitleTracks.delete(_preferredSubtitleTracks.keys().next().value)
}

function _pendingCompanionCues(link, language) {
  const path = _srtPathFor(link, language)
  const edits = path && _loadPendingSrtEdits()[path]
  if (!edits) return []
  return srtToJson(Object.entries(edits).map(([index, edit]) =>
    `${index}\n${edit.start} --> ${edit.end}\n${edit.newText}\n\n`).join(''))
}

async function _loadPreferredSubtitleTrack(link) {
  const language = _vocabularyLookupLanguage()
  if (!link || language === 'en' || language === getLangFromUrl().code) return undefined
  const entry = window.srts?.find(item => item.link === link)
  const context = _dsCaptureSourceContext()
  let text = '', cues = []
  if (link.startsWith('local:')) {
    const local = _localMediaSelection
    if ('local:' + local?.mediaFile.name === link) {
      const track = matchingCompanionSubtitle(local.mediaFile.name, local.files, local.subtitleFile, language)
      if (track) {
        try { text = await readLocalSubtitleText(track); cues = srtToJson(text) }
        catch (error) { console.warn('Could not read companion subtitles:', error) }
      }
    }
  } else if (entry && (!entry.sourceIdentity || entry.sourceIdentity === _dsSourceIdentity(entry.src || 'primary'))) {
    const key = _companionSubtitleKey(entry, language)
    let request = _preferredSubtitleTracks.get(key)
    if (!request) {
      request = _withTimeout(_fetchIndexedSrt(entry, language), 3000, 'companion subtitles')
        .then(text => ({text, cues: srtToJson(text)}))
        .catch(error => {
          if (error?.kind !== 'notfound' && _preferredSubtitleTracks.get(key) === request) _preferredSubtitleTracks.delete(key)
          return {text: '', cues: []}
        })
      _cacheCompanionSubtitles(key, request)
    }
    const stored = await request
    text = stored.text
    cues = stored.cues
  }
  context.assertCurrent()
  if (language !== _vocabularyLookupLanguage()) return _loadPreferredSubtitleTrack(link)
  const path = _srtPathFor(link, language)
  const edits = path && _loadPendingSrtEdits()[path]
  if (edits) {
    text = applyQueuedCompanionEdits(text, edits)
    cues = srtToJson(text)
  }
  return { language, cues, text }
}

const _subtitleRestores = new Map()
async function _restoreSubtitleDocument(id) {
  if (!window.allSubtitles[id]?._evicted) return window.allSubtitles[id]
  if (_subtitleRestores.has(id)) return _subtitleRestores.get(id)
  const pending = (async () => {
    const document = await _subtitleSearch.run('document', {id})
    if (!window.allSubtitles[id]?._evicted) return window.allSubtitles[id]
    return _subtitleCorpusView.hydrate(id,document)
  })()
  _subtitleRestores.set(id,pending)
  try {return await pending} finally {_subtitleRestores.delete(id)}
}

async function getSubtitlesForLink(link, source, {prepareOnly=false}={}) {
  const context = _dsCaptureSourceContext()
  let before = window.allSubtitles[link]
  if (before?._evicted) before = await _restoreSubtitleDocument(link)
  if (before && !before._partial) {
    return window.allSubtitles[link]
  }
  const srt = window.srts.find(it => it.link === link);
  if (!srt) return
  if (srt.sourceIdentity && srt.sourceIdentity !== _dsSourceIdentity(srt.src || 'primary'))
    throw Object.assign(new Error('The subtitle index belongs to another source. Reload before opening it.'),
      { code: 'stale-data-source' })

  const name = _nfc(srt.name)
  // The files live in the repo the index entry came from (self or other);
  // an entry added this session (no src) is in the primary repo.
  const sv = await _fetchIndexedSrt(srt, getLangFromUrl().code)
  // The .en.srt is optional â€” source-only snippets (CLI `srt --no-translate`,
  // or lines still awaiting the in-app ðŸŒ translate) have none. A genuine 404
  // must NOT discard the source we just fetched; only a transient failure
  // propagates so the boot retry pool tops it up later.
  let en = null
  try {
    context.assertCurrent()
    en = await _fetchIndexedSrt(srt, 'en')
  } catch (e) {
    if (!(e && e.kind === 'notfound')) throw e
  }
  context.assertCurrent()

  // A push/edit may have installed a fresher complete snapshot during this
  // fetch. Do not replace it with an older CDN response.
  const current = window.allSubtitles[link]
  if (current !== before && current?._remoteComplete) return current
  _applySubtitleSnapshot(link, {sv, en, source, fileName: name, readOnly: !!srt.readOnly,
    bundle: srt.bundle, bundleRevision: srt.bundleRevision})
  // Write the freshly-fetched pair to IndexedDB so the next boot can skip
  // this network round-trip. Fire-and-forget â€” failures are swallowed inside
  // the cache layer; a flaky cache must never break this critical path.
  _cacheWriteSubtitleFromMemory(link)
  if (prepareOnly) await _subtitleSearch.flush()
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

// File handles stay in this tab so subtitles can be attached after opening
// media. Changing the SRT must not restart playback or discard speaking takes.
let _mainMediaLoadSeq = 0
let _localMediaSelection = null
let _localCaptionPanel = null

function _localMediaElement(file) {
  const audio = file ? /\.(mp3|wav)$/i.test(file.name) : window.playingAudio
  // MediaElement replaces the original id with a proxy wrapper. Timed cue
  // listeners and Speak Over need the real native audio/video underneath it.
  return document.querySelector('#localMedia ' + (audio ? 'audio' : 'video'))
}

function _getLocalCaptionPanel() {
  if (!_localCaptionPanel) _localCaptionPanel = createMediaCaptionPanel({
    onOpenSubtitles: () => $('#localSubtitleFiles').trigger('click'),
    onSplitChange: on => { if (!on) _minimizeMainMedia() },
    onClearCues: () => {
      if (document.body.classList.contains('youtube-media-mode')) { clearSubtitles(); return }
      if (!_localMediaSelection) return
      _localMediaSelection.subtitleFile = null
      _localMediaSelection.englishFile = null
      delete window.allSubtitles['local:' + _localMediaSelection.mediaFile.name]
      clearSubtitles()
      _renderLocalSubtitleStatus()
    },
    onWord: word => {
      _minimizeMainMedia()
      $('#searchText').val(word).trigger('change')
    },
    onCapture: payload => {
      if (document.body.classList.contains('youtube-media-mode')) {
        _youtubeCaptionMedia.pause()
        const link = window.mediaBeingPlayed?.link
        if (link) _handleCaptionCapture({...payload, source:'caption', title:window.srts?.find(it => it.link === link)?.name || link, url:'https://www.youtube.com/watch?v=' + link})
        return
      }
      const selection = _localMediaSelection
      if (!selection) return
      const media = _localMediaElement()
      media.pause()
      _handleCaptionCapture({...payload, source:'caption', title:selection.mediaFile.name,
        url:'local:' + localSpeakOverIdentity(selection.mediaFile)})
    },
    familiarLanguage: source => _translationTargetLanguage(source),
    translateText: _requestTranslation,
  })
  return _localCaptionPanel
}

async function _refreshMediaSubtitleLanguage() {
  const media = window.mediaBeingPlayed
  if (!_localCaptionPanel || !['link', 'local'].includes(media?.source)) return
  const [pair, preferred] = await Promise.all([
    getSubtitlesForLink(media.link, media.source), _loadPreferredSubtitleTrack(media.link),
  ])
  if (window.mediaBeingPlayed === media) {
    _localCaptionPanel.load(pair?.sv, pair?.en, getLangFromUrl().code, preferred)
  }
}

const _youtubeCaptionMedia = createYoutubeMediaAdapter(() => window.ytPlayer, () => { window.youtubePlayInterval = null })

function _updateMediaReturnButton() {
  const classes = document.body.classList
  $('#returnToMediaPlayer').toggle(!!window.mediaBeingPlayed &&
    !classes.contains('youtube-media-mode') && !classes.contains('local-media-mode'))
}

function _youtubeMediaLayout(on) {
  document.body.classList.toggle('youtube-media-mode', on)
  if (on) {
    $('#mediaControlPanel').stop(true, true).hide()
    _youtubeCaptionMedia.start()
    _getLocalCaptionPanel().open(_youtubeCaptionMedia, true)
  } else {
    _youtubeCaptionMedia.stop()
    if (!document.body.classList.contains('local-media-mode')) _localCaptionPanel?.close()
  }
  $('#youtubeMediaHeader').toggle(on)
  _updateMediaReturnButton()
}

function _minimizeMainMedia() {
  const classes = document.body.classList
  if (classes.contains('youtube-media-mode')) {
    _youtubeCaptionMedia.pause()
    _youtubeMediaLayout(false)
    hideMediaContainer()
  } else if (classes.contains('local-media-mode')) {
    _localMediaElement()?.pause()
    _localMediaLayout(false)
  } else return
  showResultContainer()
}
$(document).on('click', '#youtubeClosePlayer, #localClosePlayer', _minimizeMainMedia)
$(document).on('click', '#returnToMediaPlayer', () => {
  const source = window.mediaBeingPlayed?.source
  if (!source) return
  hideResultContainer()
  if (source === 'link') {
    showMediaContainer()
    _youtubeMediaLayout(true)
  } else if (source === 'local') {
    _localMediaLayout(true)
  }
})

function _localMediaLayout(local) {
  document.body.classList.toggle('local-media-mode', local)
  if (local) {
    $('#mediaControlPanel').stop(true, true).hide()
    _getLocalCaptionPanel().open(_localMediaElement())
  } else if (_localCaptionPanel) _localCaptionPanel.close()
  $('#localMedia').toggle(local)
  $('#localMediaHeader').toggle(local)
  _updateMediaReturnButton()
}

function _renderLocalSubtitleStatus(preferred) {
  const selection = _localMediaSelection
  if (!selection) return
  $('#localMediaName').text(selection.mediaFile.name)
  const count = (window.subtitles || []).length
  $('#localSubtitleStatus').text(selection.subtitleFile
    ? selection.subtitleFile.name + ' Â· ' + count + ' subtitle' + (count === 1 ? '' : 's')
    : 'No subtitles attached. Add an SRT file to see captions.')
  const pair = window.allSubtitles['local:' + selection.mediaFile.name]
  _getLocalCaptionPanel().load(pair?.sv, pair?.en, getLangFromUrl().code, preferred)
  if (window.playingAudio) showAudioPlayer()
  else if (window.playingVideo) showVideoPlayer()
}

async function _chooseLocalSubtitles(files, mediaFile) {
  const current = _localMediaSelection
  const sameMedia = current && current.mediaFile === mediaFile
  const available = sameMedia ? current.files.slice() : []
  // New selections replace old handles with the same name (including revised
  // SRTs whose size and modification date happen to be unchanged).
  for (const file of files) {
    const index = available.findIndex(old => old.name === file.name)
    if (index >= 0) available[index] = file
    else available.push(file)
  }
  openLocalSubtitlePicker({
    files: available, mediaFile,
    targetLanguage: getLangFromUrl().code,
    attachOnly: sameMedia,
    onPlay: async ({ mediaFile, subtitleFile, englishFile, files }) => {
      const baseName = mediaFile.name.replace(/\.(mp3|wav|mp4)$/i, '')
      const link = 'local:' + mediaFile.name
      let sv = '', en = ''
      if (subtitleFile) {
        sv = await readLocalSubtitleText(subtitleFile)
        if (!srtToJson(sv).length) throw new Error('This SRT has no readable timestamped subtitles. Choose another file.')
        en = englishFile ? await readLocalSubtitleText(englishFile) : sv
      }
      if (sv) window.allSubtitles[link] = {sv, en, source:'local', fileName:baseName}
      else delete window.allSubtitles[link]
      _localMediaSelection = {mediaFile, subtitleFile, englishFile, files}
      if (sameMedia && window.mediaBeingPlayed?.source === 'local' && window.mediaBeingPlayed.link === link) {
        const preferred = await _loadPreferredSubtitleTrack(link)
        clearSubtitles()
        window.syncSubtitle = true
        if (sv) {
          loadSubtitlesForLink(sv, en, preferred)
          setCurrentSub(getCurrentTime() || 0)
          renderSubtitles()
        }
        _renderLocalSubtitleStatus(preferred)
      } else {
        await playNewMedia(link, 'local', mediaFile)
      }
    },
  })
}

async function loadLocalFiles() {
  const input = document.getElementById('localFiles');
  const files = Array.from((input && input.files) || []);
  const combinedJson = files.find(it => /combined\.json$/i.test(it.name));

  // Preserve the existing bulk subtitle import format.
  if (combinedJson) {
    await loadCombinedSrts(combinedJson);
    const indexJson = files.find(it => /index\.json$/i.test(it.name));
    if (indexJson) {
      const index = await new Response(indexJson).json();
      index.forEach(it => {
        if (!window.allSubtitles[it.link]) return;
        window.allSubtitles[it.link].source = it.source;
        window.allSubtitles[it.link].fileName = it.name;
      });
    }
    input.value = '';
    return;
  }

  if (!files.length) return;
  const mediaFile = files.find(file => /\.(mp3|wav|mp4)$/i.test(file.name))
    || (window.mediaBeingPlayed?.source === 'local' && _localMediaSelection?.mediaFile)
  await _chooseLocalSubtitles(files, mediaFile)
}

$(document).on('change', '#localSubtitleFiles', async function () {
  const files = Array.from(this.files || [])
  this.value = ''
  if (files.length && _localMediaSelection) await _chooseLocalSubtitles(files, _localMediaSelection.mediaFile)
})

function loadSubtitlesForLink(sv, en, preferred) {
  if (!sv) {
    alert("SV subtitle not found")
    return
  }

  window.srtLoaded = sv
  const source = srtToJson(sv, 'sv')
  const english = srtToJson(en || sv)
  const translate = createSubtitleTranslationLookup({
    preferred: preferred?.cues, language: preferred?.language,
    english: !preferred || (en && en !== sv) ? english : [],
  })
  const combined = source.map(cue => {
    const translation = translate(cue)
    return { ...cue, en: translation?.language === 'en' ? translation.text : undefined,
      translation, showTranslationLanguage: !!preferred }
  })
  storeSubtitles(combined)
  lastSub = null
  renderSubtitles()

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
  const width = $('#localMedia').width() || 300
  window.audioPlayer.setPlayerSize(width, 50)
  $('#localAudio').closest('.mejs__container').show().find('.mejs__controls').show()
  $('#localVideo').closest('.mejs__container').hide()
}

function showVideoPlayer() {
  const ytVideoWidth = $('#localMedia').width() || 300
  const availableHeight = $('#localMedia').height() - $('#localMediaHeader').outerHeight(true)
  const ytHeight = Math.max(60, Math.min(ytVideoWidth * 9 / 16, availableHeight))
  window.videoPlayer.setPlayerSize(ytVideoWidth, ytHeight)
  $('#localVideo').css({'width': ytVideoWidth, 'height': ytHeight})
    .closest('.mejs__container').show().find('.mejs__controls, .mejs__overlay-button').show()
  $('#localAudio').closest('.mejs__container').hide()
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
  // Shared playback helpers must not open main-page controls behind either
  // study overlay. Main-page playback can open them again when it is visible.
  if ((window._playingRecording && !window._recPlayMinimized) ||
    (window._practiceActive && !window._practiceMinimized)) {
    hideMediaRelatedContainer()
    return
  }
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
  const loadSeq = ++_mainMediaLoadSeq
  const isCurrent = () => loadSeq === _mainMediaLoadSeq
  _localSpeakOver.detach()
  clearSubtitles()
  stopMedia(source)
  _youtubeMediaLayout(false)
  _localMediaLayout(false)
  if (source === 'local') window.syncSubtitle = true

  //Load subtitle

  async function _playMedia() {
    if (source === 'link') {
      window.youtubePlayInterval = null
      await loadYoutubeVideo(link, {isCurrent, mainMedia: true, loadCaptions: false})
      if (!isCurrent()) return
      if (!autoPlay) _suppressYoutubeAutoplay()
    } else if (source === 'local') {
      hideMediaContainer()
      $('#localVideoContainer').toggle(/\.mp4$/i.test(mediaFile.name))
      window.playingYoutubeVideo = false;
      if (/\.(mp3|wav)$/i.test(mediaFile.name)) {
        audioPlayer.setSrc(URL.createObjectURL(mediaFile))
        if (autoPlay) playLocalMedia(audioPlayer)
        window.playingAudio = true;
        window.playingVideo = false;
        hidePlayer(window.videoPlayer)
      } else if (/\.mp4$/i.test(mediaFile.name)) {
        videoPlayer.setSrc(URL.createObjectURL(mediaFile))
        window.playingAudio = false;
        window.playingVideo = true;
        if (autoPlay) playLocalMedia(videoPlayer)
        hidePlayer(window.audioPlayer)
      }
      window.mediaBeingPlayed = {link, source}
      _localMediaLayout(true)
      _getLocalCaptionPanel().load(null, null, getLangFromUrl().code)
      if (window.playingAudio) showAudioPlayer()
      else if (window.playingVideo) showVideoPlayer()
      // The existing local <audio>/<video> is the source of truth for the
      // recording timestamp, pause/resume and playback-crossing watcher.
      if (_haveSpeakOverRecorder() && mediaFile) {
        _localSpeakOver.attach(mediaFile, _localMediaElement(mediaFile))
      }
    }
  }

  hideResultContainer();
  if ($('#onlySubsCheckbox').is(':checked')) {
    showOnlySubtitle();
    $('#sv-sub-mirror').show()
    $('#toggleEnSubBtn').show()
  } else {
    await _playMedia();
    if (!isCurrent()) return
    if (source === 'local' || source === 'link') hideMediaRelatedContainer()
    else showMediaRelatedContainer()
    $('#sv-sub-mirror').show()
    $('#toggleEnSubBtn').show()
  }

  // getSubtitlesForLink now throws a classified error on a failed fetch
  // (missing file / rate-limited / network). Degrade gracefully so playback
  // isn't aborted by an unavailable subtitle; a transient miss will be topped
  // up by the background retry and the next selection will pick it up.
  let pair, preferred
  try {
    [pair, preferred] = await Promise.all([getSubtitlesForLink(link, source), _loadPreferredSubtitleTrack(link)])
  } catch (e) {
    console.warn('subtitles unavailable for', link, e && e.message)
  }
  if (!isCurrent()) return
  // A local media file can be played without an SRT. Do not show the remote
  // missing-subtitle alert for that deliberate choice.
  const { sv = '', en = '' } = pair || {}
  if (sv || $('#onlySubsCheckbox').is(':checked')) loadSubtitlesForLink(sv, en, preferred)
  if (source === 'local') _renderLocalSubtitleStatus(preferred)
  else if (window.mediaBeingPlayed?.link === link && source === 'link') {
    _getLocalCaptionPanel().load(sv, en, getLangFromUrl().code, preferred)
    $('#youtubeMediaName').text(window.srts?.find(it => it.link === link)?.name || link)
  }

  $('#currentMedia').text(`${source === 'local' && mediaFile ? mediaFile.name : link}, ${source}`)
  $('#toggleSearchBtn').show()
}

function getLangFromUrl() {
  return languageFromLocation(window.location)
}

// Unsupported URLs retain their own data key, but cannot silently run the
// Swedish study pipeline or send edits to an unsupported dataset.
$(function () {
  const language = getLangFromUrl()
  if (language.supported) return
  const notice = document.createElement('p')
  notice.id = 'unsupportedStudyLanguage'
  notice.setAttribute('role', 'alert')
  notice.textContent = `The study app does not support â€œ${language.fullName}â€ yet. Choose Swedish or Spanish.`
  document.getElementById('mainControlInputs')?.prepend(notice)
  $('#searchText').prop('disabled', true).attr('title', notice.textContent)
})

// Publish the page's language pair where the host app can read it without
// running any of our code â€” it only has to parse the document it already
// loaded. The names follow this page's own convention, which is the opposite
// of the everyday reading: TARGET is the language being studied (the one
// `?lang=` selects, and the one getTargetLangSrtSuffix names its SRTs after),
// SOURCE is the English side those subtitles are paired with.
//
// Written from script rather than sitting in the HTML, because the studied
// language is decided by the URL â€” a fixed tag would be wrong the moment
// someone opened ?lang=spanish. This runs while the module loads, which is
// before the host finishes the page, so the host never reads a stale value.
// The full name goes out too: the two-letter code is only known for the
// languages in the shared registry, and is left empty rather than guessed.
function _publishLanguageMeta() {
  try {
    const lang = getLangFromUrl()
    const tags = {
      'cupitor-target-lang': lang.code || '',
      'cupitor-target-lang-name': lang.fullName || '',
      'cupitor-source-lang': 'en',
      'cupitor-study-supported': String(lang.supported),
    }
    Object.keys(tags).forEach(name => {
      let el = document.head && document.head.querySelector(`meta[name="${name}"]`)
      if (!el) {
        if (!document.head) return
        el = document.createElement('meta')
        el.setAttribute('name', name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', tags[name])
    })
  } catch (e) { console.warn('publishing language meta failed', e) }
}
_publishLanguageMeta()

// Raw base for the primary source (own repo when set up, else the layered
// other). Single-source readers use it; layered readers go through
// data-source directly. The language is the lowercased, validated ?lang=
// (falling back to swedish), so an odd value cannot make readUrl throw.
function getResourceUrl() {
  return _dsReadUrl('primary', '', _dsLangFromLocation())
}

function getTargetLangSrtSuffix() {
  return requireStudyLanguage(window.location).definition.subtitleSuffix
}

async function loadStarredLines(link, source) {
  // Reset first â€” addStarredLine dedupes by index value but doesn't know
  // which video an index belongs to, so without this, switching media via
  // #mp3Choice would leave the previous video's starred indices in place
  // and the Play/Practice Starred buttons would lie about what's actually
  // available for the new video.
  window.starredLines = []
  $('#starredLines').html('')
  $('#starredLinesSelect').html('')

  // The user's own stars only. No data repo, a missing file (a fresh repo)
  // or a failed read all mean no stars; picking media never fails on it.
  const favs = await _dsFetchSelfJson('srts/srt_favorites.json', { lang: _dsLangFromLocation(), fallback: [] })
  const d = Array.isArray(favs) ? favs.find(it => it && it.link === link) : null
  console.log(d)
  d && d.lines && d.lines.forEach(it => addStarredLine(it))
  // Snapshot the loaded set as the saved baseline â€” Save stays hidden until
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
          const $picker=$('#mp3Choice')
          if (!$picker.find('option').toArray().some(option=>option.value===link))
            $picker.append(new Option(window.srts.find(item=>item.link===link)?.name || link,link))
          $picker.val(link).trigger('change')
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
  if (!window._recVideoAttempt && !window._practiceClipTimer && !window._practicePlayPending &&
      !window.seekRequestProcessing && window.youtubePlayInterval && window.playingYoutubeVideo) {
    const s = window.youtubePlayInterval.start
    const e = window.youtubePlayInterval.end
    const want = window.youtubePlayInterval.videoId || null
    let loadedId = null
    try { loadedId = window.ytPlayer && window.ytPlayer.getVideoData && window.ytPlayer.getVideoData().video_id } catch (_) {}
    // Gate on videoId so a stale ct from the PREVIOUS clip (which would
    // typically be loaded under the OLD videoId) can't pause the new clip.
    // Also bound how far past `e` we'll act on, so a wildly stale reading
    // doesn't fire pauseVideo() either. _waitYTUntilEnd's hardPause()
    // already handles the genuine end-of-clip case â€” this is just a
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

// splitSentences + chunkifySentence live in ./search-text.js.

function getTimesForSubtitleChunk(el, fl) {
  const lines = $(el).find(".line").map((i, e) => $(e).data()).toArray()
      .map(it => it.index).map(idx => fl.data.find(it => it.index + '' === idx + ''))

  return {
    start: lines[0].start.ordinal, end: lines[lines.length - 1].end.ordinal
  }
}

function getWikiLinks(text) {
  // Tags (and their attributes) go before the split, so only words show.
  text = removeHtmlTags(String(text == null ? '' : text).replace(/<br\s*\/?>/gi, ' '))
  // getWords omits vocabulary separators, but a pipe in a subtitle is literal.
  if (text.includes('|')) return text.split(/(\|)/).map(part => part === '|' ? '|' : getWikiLinks(part)).join('')
  return text.split(/[ \n]/).flatMap(it => {
    const ws = getWords(it)
    if (ws.length > 1) {
      return ws.map(_w => getWikiLink(_w))
    }
    return getWikiLink(it, ws[0])
  }).join(" ")
}

function highlightedText(text, populateWikiLinks = false) {
  // Match regexes against the original cue body; normalise display whitespace
  // only after computing spans, so anchors and escaped newlines retain meaning.
  if (!window._resultsSearchRegex) {
    text = _.trim(text, "-:_")
    text = text.replaceAll("\n", " ")
  }
  // Pure span computation lives in renderer/highlight-spans-vm.js â€” see
  // there for the multi-word-priority + bounded-sub-word rules. We add the
  // search-result-specific HTML emit here: wrap matches in
  // <span class='highlight'>, run getWikiLinks over both halves, and
  // trim each segment so stray boundary spaces don't produce empty spans.
  const spans = _buildHighlightSpans(text, window.searchText || '', window._resultsSearchRegex)
  if (!spans.length) return getWikiLinks(text)

  const wikiSeg = (s) => {
    const t = s.replace(/\s+/g, ' ').trim()
    return t ? getWikiLinks(t) : ''
  }
  return _sliceByHighlightSpans(text, spans).map(chunk => {
    const inner = wikiSeg(chunk.text)
    if (!inner) return ''
    return chunk.kind === 'match'
      ? "<span class='highlight'>" + inner + '</span>'
      : inner
  }).filter(Boolean).join(' ')
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

// getWords lives in ./search-text.js.

class MatchResult {
  constructor(word, line, url, source) {
    this.url = url;
    this.line = line;
    this.word = word;
    this.source = source;
  }
}

// expandRegex, withWordBoundaries, _relaxSpaces live in ./search-text.js.

async function getMatchingWords(list, search, token) {
  const isCurrent = () => token === undefined || token === window._subtitleSearchToken
  const options = { regexMode: !!window._resultsSearchRegex, exactWordsOnly: getSelectedLang() === 'en' }
  if (!list.length || list.some(file => file.nonSrt || !file.url || !window.allSubtitles[file.url]))
    return attributeSubtitleMatches(list, search, { ...options, check: () => { if (!isCurrent()) throw Object.assign(new Error('Search cancelled.'), {code:'subtitle-search-cancelled'}) } })
  const compact = list.some(file => file._contextOnly)
  const result = await _subtitleSearch.run('attribute', {
    files: list.map(file => ({id:file.url, language:file.path.endsWith('.en.srt')?'en':'sv', suffix:getTargetLangSrtSuffix()})),
    query:search, ...options, compact,
    englishParts: compact && getSelectedLang() === 'en' && (!options.regexMode || !/[()[\]{}?*+\\]/.test(search))
      ? String(window.unprocessedSearchText || search).split(SEPARATOR_PIPE).map(part => removeHintsInBrackets(_stripExpansionMarkers(part)).trim().toLowerCase()).filter(Boolean) : [],
  }, {isCurrent})
  window._compactEnglishWord = compact ? result.englishWord : null
  window._compactSubtitleResults = compact
  return compact ? result.map : result
}

// Copy `text` to the clipboard, best-effort and silent. Tries the async
// Clipboard API first (needs a secure context + user gesture â€” both hold when
// the user taps a button on https), then falls back to a hidden-textarea
// execCommand('copy') for older Android WebViews where navigator.clipboard is
// unavailable or rejects. Never throws.
function _copyTextToClipboard(text) {
  const s = (text == null ? '' : String(text))
  if (!s) return
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).catch(() => _copyViaTextarea(s))
      return
    }
  } catch (_) {}
  _copyViaTextarea(s)
}
function _copyViaTextarea(s) {
  try {
    const ta = document.createElement('textarea')
    ta.value = s
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch (_) {}
    document.body.removeChild(ta)
  } catch (_) {}
}

// Cached map of vocab-line text â†’ its category, so the picker mirror can tell
// which category each candidate option belongs to. Rebuilt whenever
// window.vocabulary is reassigned (load / edit / commit all replace it
// wholesale). Hidden categories (expansions) are excluded.
function _vocabLineCategoryMap() {
  const vocab = window.vocabulary || {}
  const cache = window._vocabLineCatCache
  if (cache && cache.src === vocab) return cache.map
  const map = new Map()
  Object.keys(vocab).forEach(cat => {
    if (VOCAB_HIDDEN_CATEGORIES.has(cat)) return
    const lines = vocab[cat]
    if (!Array.isArray(lines)) return
    lines.forEach(line => { if (typeof line === 'string' && !map.has(line)) map.set(line, cat) })
  })
  window._vocabLineCatCache = { src: vocab, map }
  return map
}

// Best-effort "which vocabulary category is this Player/Practice item from?"
// Used to disambiguate a searched word that exactly matches several vocab
// lines. Reads the source playlist's stored vocabCategory (set when the
// playlist was built From Category); falls back to the playlist NAME when it
// happens to be a real category (covers category playlists built before the
// tag existed). Returns null when no real category can be determined.
function _detectItemCategory(it) {
  const vocab = window.vocabulary || {}
  const isCat = c => !!(c && Object.prototype.hasOwnProperty.call(vocab, c) && !VOCAB_HIDDEN_CATEGORIES.has(c))
  const recName = (it && it._recName) || (window._recording && window._recording.currentName)
  const rec = recName && window._recordings && window._recordings[recName]
  if (rec && isCat(rec.vocabCategory)) return rec.vocabCategory
  if (isCat(recName)) return recName
  return null
}

// Programmatic version of selectSearchedWord that takes the word directly
// rather than reading it from a clicked DOM node. Used by Player/Practice's
// "send to search" buttons. `opts.category` (optional) is the context category
// to prefer when the word exactly matches several vocab lines.
//
// Drives BOTH paths:
//   1. #searchText input + 'input' trigger â€” runs the real search pipeline
//      (doSearch) so SRT findings appear in #result. This is the canonical
//      path; rareWordSearch uses the same.
//   2. #searchedWords picker â€” mirrors the word so the dropdown stays in sync.
//      When the word maps to a single (or category-disambiguated) vocab line we
//      SELECT it, which narrows the search to that line. When it maps to several
//      lines we can't pin down, we DON'T narrow â€” the broad #searchText search
//      above already shows every matching line ("show all").
function sendWordToSearchBox(word, opts = {}) {
  const w = (word || '').toString().trim()
  if (!w) return false
  // Drive the real search box first so the search actually runs. The
  // input listens for `change` (searchTextChanged â†’ doSearch); `input`
  // only updates the clear-X button. Trigger both so the clear-X also
  // appears.
  const $st = $('#searchText')
  if ($st.length) $st.val(w).trigger('input').trigger('change')
  // Candidate picker options: real vocab lines only (skip the blank option and
  // the category headings, whose values are '' or start with '__cat__:').
  const $realOpts = $('#searchedWords option').filter(function () {
    const v = $(this).val()
    return v && !(typeof v === 'string' && v.startsWith('__cat__:'))
  })
  const catMap = _vocabLineCategoryMap()
  const options = $realOpts.map(function () {
    const text = $(this).text()
    return { text, category: catMap.get(text) || null }
  }).get()
  // Only honour a context category that is a real (currently-loaded) category.
  const context = (opts && opts.category && window.vocabulary && window.vocabulary[opts.category]) ? opts.category : null
  // A partial-text match is not evidence that the user's selected word is
  // that vocabulary entry. Preserve literal searches (e.g. "giva") instead
  // of narrowing to an unrelated entry containing the same characters.
  const hasExactVocabForm = options.some(o => wordIsExactInVocabularyLine(o.text, w, true))
  const decision = hasExactVocabForm
    ? pickVocabOptionForWord(w, options, context)
    : { index: -1, showAll: true }
  if (decision.showAll) {
    // Several matches we won't narrow to one â†’ leave the broad #searchText
    // search (run above; shows every matching line). Clear any stale picker
    // selection via the select2-namespaced event so the widget updates WITHOUT
    // firing vocabularyLineSelected (which would re-narrow the search).
    try { $('#searchedWords').val(null).trigger('change.select2') } catch (_) {}
  } else if (decision.index >= 0) {
    $('#searchedWords').val($realOpts.eq(decision.index).val()).trigger('change')
  }
  window.preSelectedSearchedWord = w
  return true
}
window.sendWordToSearchBox = sendWordToSearchBox

function selectSearchedWord(event) {
  const textToMatch = $(event.currentTarget).parent().data('text').replaceAll("\n", "")
  // Find the option with text containing the textToMatch string
  const $option = $('#searchedWords option').filter(function() {
    return $(this).text().toLowerCase().includes(textToMatch.toLowerCase());
  }).first();

  if ($option.length) {
    $('#searchedWords').val($option.val()).trigger('change');
  } else {
    // No matching dropdown option (e.g. the line came from a category that
    // hasn't been populated yet) â€” render the clicked line directly so the
    // arrow button always produces visible feedback.
    renderVocabularyLineByText(textToMatch);
  }

  window.preSelectedSearchedWord = textToMatch
}

function populateNonSRTFindings(wordToItemsMap, $result) {
  let numberOfResults = 0

  Object.keys(wordToItemsMap).toSorted().filter(word => wordToItemsMap[word].length).forEach(word => {
    const items = wordToItemsMap[word]
    const wordBlock = $(`<div><h5 class="l-accordion non-srt" style="background-color: #b6d4fe">${_.escape(word)}</h5></div>`)

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

function getMainSubAndSecondarySub(file, line, pair = null) {
  let mainSub = {text: ""}, secondarySub = {text: ""};
  if (file.path.endsWith(getTargetLangSrtSuffix())) {
    mainSub = {...line};
    mainSub.text = highlightedText(mainSub.text, true)
    const found = pair || window.searchResult.find(it => it['en_subs'] && it['en_subs'].path === file.path.replaceAll(getTargetLangSrtSuffix(), ".en.srt"));
    const counterpart = found?.en_subs?.data?.find(it => it.index === line.index)
    if (counterpart) {
      // Match parity with the other branch: wrap the secondary EN text via
      // highlightedText so every word is a clickable .link. Without this the
      // EN side of an SV search renders as plain text â€” inconsistent with
      // the SV side, which is fully clickable.
      secondarySub = {...counterpart}
      secondarySub.text = highlightedText(secondarySub.text)
    }
  } else {
    mainSub = (pair || window.searchResult.find(it => it['sv_subs'] && it['sv_subs'].path === file.path.replaceAll(".en.srt", getTargetLangSrtSuffix())))
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
      playLocalMedia(videoPlayer)
    } else if (window.playingAudio) {
      audioPlayer.setCurrentTime(times.start)
      playLocalMedia(audioPlayer)
    }
  }

  window.youtubePlayInterval = {...times}
  console.log(`Playing from ${fromSeconds(times.start)} to ${fromSeconds(times.end)}`)
}

function getInfoAboutMedia(mediaId, source, time_start) {
  const fileName = window.allSubtitles[mediaId].fileName
  // Mobile browsers force-mute autoplay when a tab is opened via
  // target="_blank" â€” the new tab has no user gesture so YouTube's
  // autoplay starts silently. Desktop browsers are lenient enough that
  // `&autoplay=1` plays with sound, so keep it there.
  const autoplay = isDesktop() ? '&autoplay=1' : ''
  let url = `https://www.youtube.com/watch?v=${mediaId}&t=${time_start}${autoplay}`
  if (source?.toLowerCase() == 'svt') {
    url = `https://www.svtplay.se/video/${mediaId}?position=${time_start}`
  }
  return {fileName, url};
}

const openFullSrtDialog = createFullSrtDialog($, {
  loadSubtitle: async (id, source) => {
    const [subtitle, preferred] = await Promise.all([
      getSubtitlesForLink(id, source), _loadPreferredSubtitleTrack(id)
    ])
    return { ...(subtitle || window.allSubtitles[id]), preferred }
  },
  getLanguage: getLangFromUrl,
})

function showInfo(id, source, time_start, time_end) {
  const $dlg = $('#info-dialog-content')
  const clipKey = JSON.stringify([id, source, Number(time_start), Number(time_end)])
  // Repeating a result's info action closes it; a different clip replaces
  // the details in the shared panel. A closed panel always opens again.
  if ($dlg.hasClass('ui-dialog-content') && $dlg.dialog('isOpen') &&
      $dlg.data('clipKey') === clipKey) {
    $dlg.dialog('close')
    return
  }
  const {fileName, url} = getInfoAboutMedia(id, source, time_start);

  const owner = _ownerLabelOfLink(id)
  $dlg.data('clipKey', clipKey).html(`
    <h3><a href="${_.escape(url)}" target="_blank">${_.escape(fileName)}</a></h3>
    ${owner ? `<h4 class="owner-label">${_.escape(owner)}</h4>` : ''}
    <h4>${_.escape(source)}</h4>
    <h4>${fromSeconds(time_start)} - ${fromSeconds(time_end)}</h4>
    <button type="button" class="full-srt-open lang-tool-btn" title="Show complete SRT" aria-label="Show complete SRT">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h8"/>
      </svg>
      Full SRT
    </button>
  `)
  $dlg.find('.full-srt-open').on('click', () => openFullSrtDialog(id, source, fileName))
  // Pin to the top of the viewport â€” by default jQuery UI centers in the
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
  const $button = $(evt.currentTarget)
  const expanded = $button.attr('aria-expanded') !== 'true'
  $button.attr('aria-expanded', String(expanded))
  $button.find('i').toggleClass('fa-chevron-down', expanded).toggleClass('fa-chevron-right', !expanded)
  const $lines = $button.closest('.lines-cntnr').find('.sub-lines-cntnr').stop(true, true)
  if (expanded) $lines.slideDown('slow')
  else $lines.slideUp('slow')
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

// Path in the repo for a given (link, langCode) â€” `code` is 'en' or the
// current target language (sv / es). Falls back to allSubtitles[link].fileName
// if the srts index lookup misses (e.g. local-loaded files).
function _srtPathFor(link, langCode) {
  const lang = getLangFromUrl()
  const srt = window.srts && window.srts.find(it => it.link === link)
  const baseName = _nfc((srt && srt.name) || (window.allSubtitles[link] && window.allSubtitles[link].fileName))
  if (!baseName) return null
  const suffix = '.' + (langCode || lang.code) + '.srt'
  return `${_langRepoDir()}/srts/${baseName}${suffix}`
}

// Replace the text body of the SRT block whose first line is `lineIndex`.
// Block surgery instead of parse/rebuild so timestamp formatting (comma vs
// dot, trailing newlines) survives the round-trip verbatim. Returns null
// if the index isn't found so the caller can surface a clear error.
//
// When `opts.start`/`opts.end` are supplied (the translation path), the line
// is inserted â€” creating the block or the whole file if absent â€” via
// upsertSrtEntry, so a source-only snippet can grow its .en.srt on demand.
function _replaceSrtLine(rawSrt, lineIndex, newText, opts = null) {
  if (opts && opts.start != null && opts.end != null) {
    return upsertSrtEntry(rawSrt || '', { index: lineIndex, start: opts.start, end: opts.end, text: newText })
  }
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
async function _saveSubtitleEdit(link, langCode, lineIndex, newText, opts = null) {
  // No own repo: the edit could never be pushed, so it is not queued. The
  // editors check _requireSelf before opening; this is the backstop.
  if (!_dsHasSelf()) throw new _DsNoSelfRepoError()
  if (_isReadOnlyLink(link)) throw new Error("This video is from the other user's library and is read-only.")
  const filePath = _srtPathFor(link, langCode)
  if (!filePath) throw new Error('No SRT path for ' + link)
  if (_isCompanionSubtitleLanguage(langCode)) {
    if (opts?.start == null || opts.end == null) throw new Error('Translated subtitle needs timestamps.')
    _queueSubtitleEdit(filePath, lineIndex, newText, opts)
    return true
  }
  const key = langCode === 'en' ? 'en' : 'sv'
  const stored = await _restoreSubtitleDocument(link)
  if (!stored) throw new Error('SRT not loaded for ' + link)
  // A translation insert (opts carries the source line's timestamp) may target
  // a line â€” or a whole .en.srt â€” that doesn't exist yet; treat a missing body
  // as empty so _replaceSrtLine/upsertSrtEntry can create it.
  const canInsert = !!(opts && opts.start != null && opts.end != null)
  if (!stored[key] && !canInsert) throw new Error('SRT not loaded for ' + link)

  const updated = _replaceSrtLine(stored[key] || '', lineIndex, newText, opts)
  if (!updated) throw new Error(`Line ${lineIndex} not found in ${filePath}`)

  // Optimistic local update â€” render immediately and let the network catch up.
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
  _queueSubtitleEdit(filePath, lineIndex, newText, opts)
  return true
}

// â”€â”€ Batched inline SRT edits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Each save buffers a (filePath, lineIndex, newText) entry to localStorage.
// A debounced timer (or an explicit `Sync Edits` button) flushes the whole
// buffer in one commit using GitHubUtils.commitMultipleFiles. This stops
// per-line edits from racking up dozens of commits when the user fixes
// translations in bulk.
const SRT_EDITS_KEY = _scopedKey('cupitor:pendingSrtEdits')
const SRT_EDITS_FLUSH_MS = 10000  // 10s after the last edit
let _srtEditsFlushTimer = null

function _loadPendingSrtEdits() {
  try {
    const raw = _userData.getItem(SRT_EDITS_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch (_) { return {} }
}
function _savePendingSrtEdits(edits) {
  try {
    if (!edits || !Object.keys(edits).length) _userData.removeItem(SRT_EDITS_KEY)
    else _userData.setItem(SRT_EDITS_KEY, JSON.stringify(edits))
  } catch (_) {}
}
function _pendingSrtEditCount(edits) {
  return _pendingSrtEditCountCore(edits || _loadPendingSrtEdits())
}
function _queueSubtitleEdit(filePath, lineIndex, newText, opts = null) {
  const edits = _loadPendingSrtEdits()
  if (!edits[filePath]) edits[filePath] = {}
  const entry = { newText, ts: Date.now() }
  // Carry the source line's timestamp for inserts (translation of a line the
  // remote .en.srt doesn't have yet) so the flush can create it. `ts` above is
  // the edit's wall-clock time (ms); `start`/`end` are SRT time strings.
  if (opts && opts.start != null && opts.end != null) {
    entry.start = opts.start
    entry.end = opts.end
  }
  edits[filePath][String(lineIndex)] = entry
  _savePendingSrtEdits(edits)
  _updateSrtEditsUi()
  // Auto-flush was previously firing 10s after the last edit. Now that the
  // Sync button opens a Review dialog instead of pushing directly, we wait
  // for explicit user action â€” no silent pushes.
}
function _isCompanionSubtitleLanguage(language) {
  return language !== 'en' && language !== getLangFromUrl().code
}

// Map an SRT file path back to its index.json `link` (videoId). The file
// naming convention is `<basename>.<langCode>.srt` and `srts/index.json`
// stores `{link, name=basename}`. Used by flushPendingSrtEdits below to
// invalidate the IndexedDB cache for any video whose SRT just got rewritten.
function _filePathToLink(filePath) {
  if (!filePath) return null
  try {
    const m = String(filePath).match(/\/srts\/(.+?)\.[a-z]{2,3}(?:-[a-z0-9]{2,8})*\.srt$/i)
    if (!m) return null
    const baseName = _nfc(decodeURIComponent(m[1]))
    const srt = (window.srts || []).find(s => s && _nfc(s.name) === baseName)
    return srt ? srt.link : null
  } catch (_) { return null }
}

async function flushPendingSrtEdits(selected = null) {
  if (!_requireSelf()) return { committed: false, reason: 'no-repo' }
  const context = _dsCaptureSourceContext()
  await _userData.flush()
  context.assertCurrent()
  const edits = selected || _loadPendingSrtEdits()
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
  // Capture the exact text committed per file (the merge of the freshly-fetched
  // remote + our queued edits) so we can write it straight into the IndexedDB
  // cache afterwards â€” correct even if memory drifted (e.g. a reload between the
  // edit and this flush). getContent may run several times on a 422 retry; the
  // last call reflects what actually landed.
  const committedByPath = new Map()
  const files = paths.map(filePath => ({
    path: filePath,
    getContent: (current) => {
      context.assertCurrent()
      // Replaces existing lines; inserts lines that carry a timestamp (a
      // translation of a line the remote doesn't have yet); when there's no
      // remote file and no timestamped edits, returns null so we don't create
      // a fresh SRT from plain âœŽ edits alone.
      const language = filePath.match(/\.([^.]+)\.srt$/i)?.[1]
      const apply = language && _isCompanionSubtitleLanguage(language)
        ? applyQueuedCompanionEdits : applyQueuedEditsToText
      const updated = apply(current || '', edits[filePath])
      if (updated == null) {
        console.warn(`flushPendingSrtEdits: ${filePath} has no committable content; skipping`)
      } else {
        committedByPath.set(filePath, updated)
      }
      return updated
    }
  }))
  const msg = `srt: batch edit â€” ${paths.length} file${paths.length === 1 ? '' : 's'}, ${totalLines} line${totalLines === 1 ? '' : 's'}`
  const result = await window.GitHubUtils.commitMultipleFiles({
    ..._dsWriteTarget(),
    commitMessage: msg,
    files
  })
  context.assertCurrent()
  // Clear the buffer if the commit landed OR if nothing actually changed
  // (every queued edit already matched remote â€” buffer is stale, drop it).
  if (!result || result.committed !== false || result.reason === 'no-changes') {
    const remaining = _loadPendingSrtEdits()
    for (const [path, lines] of Object.entries(edits)) {
      for (const [line, sent] of Object.entries(lines)) {
        if (_sameJson(remaining[path]?.[line], sent)) delete remaining[path][line]
      }
      if (remaining[path] && !Object.keys(remaining[path]).length) delete remaining[path]
    }
    _savePendingSrtEdits(remaining)
    await _userData.flush()
    context.assertCurrent()
    // The commit just rewrote one or more server-side SRTs. Rather than evict
    // and force a re-fetch (which races GitHub's CDN lag), fold the exact
    // committed text back into memory + IndexedDB so a reload sees it at once.
    for (const [textPath, text] of committedByPath) {
      const filePath = textPath
      const link = _filePathToLink(filePath)
      if (!link) continue
      const language = filePath.match(/\.([^.]+)\.srt$/i)?.[1]
      if (language && _isCompanionSubtitleLanguage(language)) {
        const entry = window.srts?.find(item => item.link === link)
        if (entry) _cacheCompanionSubtitles(_companionSubtitleKey(entry, language), Promise.resolve({text, cues: srtToJson(text)}))
        continue
      }
      await _restoreSubtitleDocument(link)
      const key = language === 'en' ? 'en' : 'sv'
      window.allSubtitles[link] = { ...(window.allSubtitles[link] || {}), [key]: text }
      // Drop stale parsed caches for the language we just rewrote.
      if (key === 'sv') delete window.allSubtitles[link]._parsedSv
      else delete window.allSubtitles[link]._parsedEn
    }
    await Promise.all(Array.from(editedLinks, link => _cacheWriteSubtitleFromMemory(link)))
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
  // then explicitly pushes â€” far less scary for bulk fixes.
  $(document).on('click', '#syncSrtEditsBtn', function () {
    if (!_requireSelf()) return
    const n = _pendingSrtEditCount()
    if (!n) { alert('No pending subtitle edits to push.'); return }
    openSrtEditsReviewDialog()
  })
  // In-dialog actions: select all / none, discard checked, push checked.
  $(document).on('click', '#srtEditsSelectAll',  function () {
    $('#srtEditsReviewList .srt-review-keep').prop('checked', true)
    _syncSrtEditsGroupBoxes()
  })
  $(document).on('click', '#srtEditsSelectNone', function () {
    $('#srtEditsReviewList .srt-review-keep').prop('checked', false)
    _syncSrtEditsGroupBoxes()
  })
  // A file's header box takes or leaves that whole file in one go; ticking
  // rows by hand reports back up so the header shows all / none / part-way.
  $(document).on('change', '#srtEditsReviewList .srt-review-file-keep', function () {
    setSrtEditsGroupChecked($(this).closest('.srt-review-file')[0], this.checked)
    _syncSrtEditsGroupBoxes()
  })
  $(document).on('change', '#srtEditsReviewList .srt-review-keep', _syncSrtEditsGroupBoxes)
  $(document).on('click', '#srtEditsDiscardSelected', _onSrtEditsDiscardSelected)
  $(document).on('click', '#srtEditsPushSelected',    _onSrtEditsPushSelected)
  try { _updateSrtEditsUi() } catch (_) {}
  try { _updatePlayUnavailableBadge() } catch (_) {}
})

// Thin shims â€” VM in ./renderer/srt-edits-review-vm.js, DOM emit/read in
// ./renderer/srt-edits-review-render.js.
function _renderSrtEditsReviewList() {
  const vm = buildSrtEditsReviewVM(_loadPendingSrtEdits())
  renderSrtEditsReviewList(vm, $('#srtEditsReviewList')[0])
}

function _collectSrtEditsByCheckbox(checked) {
  return collectSrtEditsByCheckbox($('#srtEditsReviewList')[0], checked)
}

function _syncSrtEditsGroupBoxes() {
  syncSrtEditsGroupBoxes($('#srtEditsReviewList')[0])
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
      // up immediately â€” mirrors the rare-words dialog fix.
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
  if (!_requireSelf()) return
  const keep = _collectSrtEditsByCheckbox(true)
  if (!keep.length) { alert('Select at least one edit to push.'); return }
  const buf = _loadPendingSrtEdits()
  const push = {}
  keep.forEach(({ filePath, lineIndex, newText }) => {
    const li = String(lineIndex), prev = (buf[filePath] || {})[li] || {}
    if (!push[filePath]) push[filePath] = {}
    push[filePath][li] = { ...prev, newText, ts: Date.now() }
    if (!buf[filePath]) buf[filePath] = {}
    buf[filePath][li] = push[filePath][li]
  })
  _savePendingSrtEdits(buf)
  _updateSrtEditsUi()
  const $btn = $('#srtEditsPushSelected').prop('disabled', true).text('Pushingâ€¦')
  try {
    const r = await flushPendingSrtEdits(push)
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

// Fetch companion files when a result reaches the viewport, so search can
// paint from the indexed tracks without waiting on optional network reads.
const _resultCompanionLoads = new WeakMap()
let _resultCompanionObserver
function _loadVisibleResultCompanion(element, load) {
  if (typeof IntersectionObserver !== 'function') { load(); return }
  _resultCompanionObserver ||= new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting && target.isConnected) continue
      _resultCompanionObserver.unobserve(target)
      const run = _resultCompanionLoads.get(target)
      _resultCompanionLoads.delete(target)
      if (isIntersecting && target.isConnected) run?.()
    }
  })
  _resultCompanionLoads.set(element, load)
  _resultCompanionObserver.observe(element)
}

async function renderLines(id, url, preferred = null) {
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
  const original = window.searchResult.find(it => it.url === url)
  if (!original) throw new Error('Search result is no longer available.')
  const key = lang === 'sv' ? 'sv_subs' : 'en_subs'
  const lastIndex = original[key].lastIndex
  if (lastIndex) { toLineIndex = Math.min(toLineIndex, lastIndex); fromLineIndex = Math.min(fromLineIndex, lastIndex) }
  let pair = original
  if (original[key]._contextOnly) {
    // Request a bounded reservoir of nearby cues once, then choose a window
    // by word count. Packed SRTs only retain match metadata until this fetch.
    const minWords = $container.data('autoWordContext') ? _minWordsAround() : 0
    const contextFrom = minWords && Number.isFinite(matchLineIndex)
      ? Math.max(1, Math.min(fromLineIndex, matchLineIndex - 12)) : fromLineIndex
    const contextTo = minWords && Number.isFinite(matchLineIndex)
      ? Math.max(toLineIndex, matchLineIndex + 12) : toLineIndex
    const context = await _subtitleSearch.run('context', {id:url,from:contextFrom,to:contextTo,regexMode:!!window._resultsSearchRegex})
    if (!document.getElementById(id)) return
    pair = {...original,sv_subs:{...original.sv_subs,...context.sv_subs},en_subs:{...original.en_subs,...context.en_subs}}
  }
  const subtitleFile = pair[key]

  // Clamp toLineIndex to the file's last index so a default-context window
  // (or repeated "+" clicks) that overshoots doesn't crash on getSub() â†’
  // undefined.end.ordinal.
  if (subtitleFile && subtitleFile.data && subtitleFile.data.length) {
    const lastIdx = subtitleFile.data.reduce((m, it) => Math.max(m, it.index), 0)
    if (toLineIndex > lastIdx) toLineIndex = lastIdx
    if (fromLineIndex > lastIdx) fromLineIndex = lastIdx
  }

  // Expand initial search-result snippets until there are enough words on
  // either side of the match, sharing Practice's contiguous subtitle limits.
  // +/- adjustments are manual and therefore skip auto-extension.
  if ($container.data('autoWordContext') && Number.isFinite(matchLineIndex)) {
    $container.data('autoWordContext', false)
    const sorted = (subtitleFile.data || []).slice().sort((a,b) => Number(a.index) - Number(b.index))
    const anchor = sorted.findIndex(line => Number(line.index) === matchLineIndex)
    const matchWord = String($container.data('matchWord') || '')
    if (anchor >= 0 && matchWord) {
      const bounds = _wordContextLineWindow(sorted, anchor,
        Math.max(0, matchLineIndex - fromLineIndex),
        Math.max(0, toLineIndex - matchLineIndex),
        { word: matchWord, minWordsAround: _minWordsAround(), gapThreshold: _clipGapThresholdSec() })
      if (bounds.to >= bounds.from) {
        fromLineIndex = Number(sorted[bounds.from].index)
        toLineIndex = Number(sorted[bounds.to].index)
        $container.data({fromIndex: fromLineIndex, toIndex: toLineIndex})
      }
    }
  }
  const getSub = x => subtitleFile.data.find(it => it.index + '' === x + '');
  const st = getSub(fromLineIndex);
  const end = getSub(toLineIndex)
  if (!st || !end) throw Object.assign(new Error('The requested subtitle context is unavailable. Search again after downloading the full file.'),{code:'subtitle-search-incomplete'})
  // Contract the play-bounds to the contiguous temporal segment that
  // contains matchLineIndex. SRTs in this app are SPARSE â€” multiple captures
  // across distant moments of the same video get stitched into one file, so
  // a context window (matchIdx Â± N) can straddle a multi-hour gap (e.g.
  // line 5 at 38:17 followed by line 6 at 4:20:52). Spanning that gap with
  // {timeStart=segA.start, timeEnd=segB.end} produces a 3.7h "clip" that
  // never terminates in playback. Detection: any consecutive-line gap
  // larger than `MAX_GAP_S` is a discontinuity; stop walking outward when
  // we encounter one. Display still shows the full window â€” only the
  // play-button's time bounds get contracted. Threshold is user-configurable
  // (clipGapThresholdSec, default 2.5s); captures stay uncapped in duration.
  const MAX_GAP_S = _clipGapThresholdSec()
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


  // Escaped: names and links come from index.json (possibly another user's).
  function truncate(str, n) {
    str = String(str == null ? '' : str)
    return (str.length > n) ? _.escape(str.slice(0, n - 1)) + '&hellip;' : _.escape(str);
  };

  const infoButton = () => {
    if (window.showInfoWithoutPopup) {
      const {fileName, url} = getInfoAboutMedia(subtitleFile.url, subtitleFile.source, timeStart);
      return `<a href="${_.escape(url)}" target="_blank" title="${_.escape(fileName)}">${truncate(fileName, 20)}</a>`
    }
    return showInfoBtn;
  };
  const eId = _.escape(id), eUrl = _.escape(url)
  const translationLanguage = _translationTargetLanguage()
  const pendingCues = preferred?.cues || (translationLanguage === 'en' ? [] : _pendingCompanionCues(url, translationLanguage))
  const pendingTranslation = createSubtitleTranslationLookup({ preferred: pendingCues, language: translationLanguage })

  // A video from the other user's library is read-only: no âœŽ and no ðŸŒ
  // (both write to the subtitle files).
  const readOnly = _isReadOnlyLink(url)
  const ownerLabel = readOnly ? _ownerLabelOfLink(url) : ''
  const ownerTag = ownerLabel
    ? `<span class="info owner-label" style="font-size:12px;color:#666;white-space:nowrap;" title="From ${_.escape(ownerLabel.replace(/^ðŸ”’ /, ''))}'s library (read-only)">${_.escape(ownerLabel)}</span>`
    : ''

  let html = `
<hr>
<div class="buttons" style="text-align: center;">
  <span class="add-prev-btn btn" > + </span>
  <span class="remove-next-btn btn"> - </span>

  <span class="play-btn-container" style="text-align: center;" data-id="${eId}" data-url="${eUrl}" data-source="${_.escape(subtitleFile.source || '')}" data-time-start="${timeStart}" data-time-end="${timeEnd}" data-match-line-index="${Number.isFinite(matchLineIndex) ? matchLineIndex : ''}">
     <button type="button" class="info btn collapse-sub-lines" aria-label="Toggle subtitle lines" aria-expanded="true" title="Show or hide subtitle lines"><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
     <span class="info source-tag" data-source="${_.escape(String(subtitleFile.source || '').toLowerCase())}" title="${_.escape(subtitleFile.source || '')}">${_sourceBadgeHtml(subtitleFile.source)}</span>
     ${infoButton()}
     ${ownerTag}
  </span>
  <span class="capture-btn btn" title="Add this match to the current recording">â—</span>
  ${readOnly ? '' : `<span class="translate-lines-btn btn" data-id="${eId}" data-url="${eUrl}" title="Translate the visible lines to ${_.escape(_vocabularyLanguageName(translationLanguage))}">ðŸŒ</span>`}
  <span style="float: right;">
    <span class="remove-prev-btn btn" > - </span>
    <span class="add-next-btn btn"> + </span>
  </span>
</div>

`

  let subForLines = ''
  const mainSubPanel = $('<div>')
  const secondarySubPanel = $('<div>')


  const mainLangCode = getLangFromUrl().code  // sv / es / â€¦
  const editBtn = readOnly ? '' : '<span class="edit-line-btn" title="Edit translation">âœŽ</span>'
  // These files stitch captures from distant moments together, so two lines
  // shown one under the other can be minutes apart in the video. The play
  // bounds above already stop at the break; this marks where it is, so the
  // lines past it are not read as following on from the ones before.
  let _prevEnd = null
  range(fromLineIndex, toLineIndex - fromLineIndex + 1).forEach(idx => {
    const sub = getSub(idx)
    if (!sub) return
    const {mainSub, secondarySub} = getMainSubAndSecondarySub(subtitleFile, ({...sub}), pair);
    const subIdx = (sub && sub.index != null) ? String(sub.index) : ''
    const _thisStart = (sub && sub.start && typeof sub.start.ordinal === 'number') ? sub.start.ordinal : null
    const _gap = (_prevEnd != null && _thisStart != null && (_thisStart - _prevEnd) > MAX_GAP_S)
      ? (_thisStart - _prevEnd) : 0
    _prevEnd = (sub && sub.end && typeof sub.end.ordinal === 'number') ? sub.end.ordinal : _prevEnd
    if (_gap) {
      // Says only what the timestamps show: a stretch of video with nothing
      // on it, and how long. Whether that is a seam between two captures or a
      // silence inside one, the clip stops either way.
      const _mark = `<div class="line line-gap" title="${_formatGap(_gap)} of video with no subtitle â€” playback stops here">.....</div>`
      subForLines += _mark
      mainSubPanel.append(_mark)
      if (secondarySub && secondarySub.text) secondarySubPanel.append(_mark)
    }
    const lineMain = `<div class="line main-line" data-url="${eUrl}" data-line-index="${_.escape(subIdx)}" data-lang-code="${mainLangCode}"><span class="line-text">${mainSub.text}</span>${editBtn}</div>`;
    subForLines += lineMain
    mainSubPanel.append(lineMain)
    const translated = pendingTranslation(sub)
    if (translated || secondarySub?.text) {
      const language = translated?.language || 'en'
      const text = translated ? _safeSubtitleHtml(translated.text) : secondarySub.text
      const secondaryEdit = translated ? '' : editBtn
      const lineSec = `<div class="line secondary-line" data-url="${eUrl}" data-line-index="${_.escape(subIdx)}" data-lang-code="${language}" lang="${language}"><span class="line-text">${text}</span>${secondaryEdit}</div>`;
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

  const collapsed = $container.find('.collapse-sub-lines').attr('aria-expanded') === 'false'
  $container.html(html)
  if (collapsed) collapseSubLines({currentTarget: $container.find('.collapse-sub-lines')[0]})
  if (!preferred && translationLanguage !== 'en') {
    const lines = $container.find('.sub-lines-cntnr')[0]
    _loadVisibleResultCompanion(lines, async () => {
      try {
        const track = await _loadPreferredSubtitleTrack(url)
        if (!track?.cues.length || !lines.isConnected ||
            $container.find('.editing').length || track.language !== _translationTargetLanguage()) return
        await renderLines(id, url, track)
      } catch (error) {
        console.warn('Could not display companion subtitles:', error)
      }
    })
  }
  $($container).find('.play-btn').click(() => playMediaSlice(url + '', timeStart+'', timeEnd+'', subtitleFile.source+''))
  $($container).find('.media-info').click(e => showInfo(subtitleFile.url + '', subtitleFile.source+'', timeStart+'', timeEnd+''))
  $($container).find('.collapse-sub-lines').click(collapseSubLines)

  // After +/- shifts the visible window, the displayed time range changes.
  // If this match is already in the recording, mutate the stored entry's
  // timeStart/timeEnd to follow the new window â€” otherwise the recording
  // would replay the original (stale) range. Also re-mark the capture
  // button (already done inside renderLines, but harmless to repeat).
  const _syncOnWindowChange = () => {
    try {
      _syncCapturedItemTimes('' + id, '' + url)
      _markCapturedButtons()
    } catch (_) {}
  }
  $($container).find('.add-prev-btn').click(e => {
    changeIndices(''+id, fromLineIndex - 1, toLineIndex); renderLines(''+id, ''+url).then(_syncOnWindowChange).catch(error => $container.append($('<p role="alert"></p>').text('Context could not be loaded: ' + error.message)));
  })
  $($container).find('.remove-next-btn').click(e => {
    changeIndices(''+id, fromLineIndex + 1, toLineIndex); renderLines(''+id, ''+url).then(_syncOnWindowChange).catch(error => $container.append($('<p role="alert"></p>').text('Context could not be loaded: ' + error.message)));
  })
  $($container).find('.remove-prev-btn').click(e => {
    changeIndices(''+id, fromLineIndex, toLineIndex - 1); renderLines(''+id, ''+url).then(_syncOnWindowChange).catch(error => $container.append($('<p role="alert"></p>').text('Context could not be loaded: ' + error.message)));
  })
  $($container).find('.add-next-btn').click(e => {
    changeIndices(''+id, fromLineIndex, toLineIndex + 1); renderLines(''+id, ''+url).then(_syncOnWindowChange).catch(error => $container.append($('<p role="alert"></p>').text('Context could not be loaded: ' + error.message)));
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
  if (_isReadOnlyPlaylist(window._recording && window._recording.currentName)) return
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

// Thin wrappers â€” pure cores in ./search-text.js take searchText + bracket
// stripper as args; here we fall back to window.searchText if omitted.
function getSearchedTerms(search) {
  const s = (search === null || search === undefined) ? window.searchText : search
  return window._resultsSearchRegex ? splitRegexAlternatives(s).map(t => t.trim()).filter(Boolean) : _coreGetSearchedTerms(s, removeHintsInBrackets)
}

function getWordsOrdered(words) {
  return _coreGetWordsOrdered(words, window.searchText, window._resultsSearchRegex ? s => s : removeHintsInBrackets)
}

// commonWordsToIgnore is now imported from ./vocab-search.js

// Extract the channel name from an SRT base name. Capture/upload paths
// stamp the file as `${channel} || ${title} || ${id}`, so split on " || "
// and take the first segment. Falls back to "(unknown)" so the channel
// dialog has a sensible bucket for legacy entries that lack the channel
// prefix.
function _channelOfItem(item) {
  return _coreChannelOfItem(item, window.srts || [])
}

function _isChannelBlocked(channel) {
  if (!channel) return false
  const blocked = (window._appSettings && window._appSettings.blockedChannels) || []
  return blocked.includes(channel)
}

function _applyBlockedChannelFallback(items) {
  return _coreApplyBlockedChannelFallback(items, {
    blockedChannels: (window._appSettings && window._appSettings.blockedChannels) || [],
    srts: window.srts || [],
  })
}

function groupAndArrangeResults(items) {
  return _coreGroupAndArrangeResults(_filterSearchChannels(items), {
    lodash: _,
    categories: window.categories || {},
    mediaFileNames: window.allMediaFileNames || [],
    blockedChannels: (window._appSettings && window._appSettings.blockedChannels) || [],
    srts: window.srts || [],
  })
}

function getSearchResultPageSize() {
  return window.SEARCH_RESULT_PAGE_SIZE || 50
}

// Keep selection across result pages, but never carry it into another search.
let _searchPlaylistSelection = null
const _searchPlaylistIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h12v2H3zm0 5h12v2H3zm0 5h7v2H3zm11-1 8 5-8 5z"/></svg>'

function _selectedSearchGroups(state) {
  return state.groups.map(group => {
    const picks = state.individual.get(group.word)
    return { ...group, items: picks
      ? group.items.filter((_, index) => picks.has(index))
      : state.selected.has(group.word) ? group.items : [] }
  }).filter(group => group.items.length)
}

function _syncSearchPlaylistSelection(state) {
  $('#result .search-playlist-choice, #result .search-playlist-item-choice').prop('hidden', !state.selecting)
  $('#result .search-playlist-item-checkbox').each((_, input) => {
    const word = $(input).data('word'), index = $(input).data('index')
    const picks = state.individual.get(word)
    input.checked = picks ? picks.has(index) : state.selected.has(word)
  })
  $('#result .search-playlist-checkbox').each((_, input) => {
    const word = $(input).data('word')
    const picks = state.individual.get(word)
    const total = state.groups.find(group => group.word === word)?.items.length || 0
    input.checked = state.selected.has(word) || !!(picks && picks.size === total)
    input.indeterminate = !!(picks && picks.size > 0 && picks.size < total)
  })
  $('#searchPlaylistSelectBtn').attr('aria-pressed', String(state.selecting))
  const selectedGroups = _selectedSearchGroups(state)
  const count = selectedGroups.length
  const clipCount = selectedGroups.reduce((sum, group) => sum + group.items.length, 0)
  $('#searchPlaylistActions').prop('hidden', !state.selecting || !clipCount)
  $('#searchPlaylistSelectedCount').text(count || '').attr('aria-label', `${count} headings, ${clipCount} clips selected`)
  _refreshAccordionStickyHeight()
}

function _renderSearchPlaylistToolbar(state, $result) {
  if (!state.groups.some(group => group.items.length)) return
  const $options = $result.children('#manualSearchBar')
  const $toolbar = $(`<form id="searchPlaylistToolbar" aria-label="Playlist from search results">
    <h2 class="mobile-subtitle-title">Subtitle results</h2>
    <button id="searchPlaylistSelectBtn" type="button" title="Select headings for a temporary playlist" aria-label="Select clips for a playlist" aria-pressed="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m2 5 2 2 4-4m-6 10 2 2 4-4m2-6h12M10 13h12M2 21h20"/></svg><span class="mobile-select-clips-label">Select clips</span><span id="searchPlaylistSelectedCount" aria-live="polite"></span></button>
    <span id="searchPlaylistActions" hidden>
      <label title="Maximum clips from each selected heading; leave blank to include all">Max per heading <input id="searchPlaylistMaxClips" type="number" min="1" max="9007199254740991" step="1" inputmode="numeric" placeholder="All" aria-label="Max clips per heading"></label>
      <button id="searchPlaylistCreateBtn" type="submit" title="Create a temporary playlist and open Player with a 5-second gap" aria-label="Create playlist from selected headings">${_searchPlaylistIcon}</button>
    </span>
  </form>`).appendTo($options.length ? $options : $result)
  const $limit = $toolbar.find('#searchPlaylistMaxClips').val(state.maxPerHeader)
  $toolbar.find('#searchPlaylistSelectBtn').on('click', () => {
    state.selecting = !state.selecting
    if (!state.selecting) {
      state.selected.clear()
      state.individual.clear()
      $('#result .search-playlist-checkbox, #result .search-playlist-item-checkbox').prop('checked', false)
    }
    _syncSearchPlaylistSelection(state)
  })
  $limit.on('input', () => { state.maxPerHeader = $limit.val() })
  $toolbar.on('submit', async e => {
    e.preventDefault()
    if (!state.selecting || !_selectedSearchGroups(state).length || !$limit[0].reportValidity()) return
    const raw = String($limit.val()).trim()
    if (raw && (!Number.isSafeInteger(Number(raw)) || Number(raw) < 1)) return
    const options = {
      files: state.files, lang: state.lang, searchText: state.searchText, maxPerHeader: raw,
      contextBefore: parseInt(window._appSettings?.contextLinesBefore, 10) || 0,
      contextAfter: parseInt(window._appSettings?.contextLinesAfter, 10) || 0,
      minWordsAround: _minWordsAround(),
      gapThreshold: _clipGapThresholdSec() }
    const selectedGroups = _selectedSearchGroups(state)
    let queue
    const $button = $toolbar.find('#searchPlaylistCreateBtn').prop('disabled',true)
    try {
      queue = state.files.some(file => file.sv_subs?._contextOnly)
        ? await _subtitleSearch.run('playlist',{groups:selectedGroups,selected:selectedGroups.map(group => group.word),options:{...options,files:[]}})
        : buildSelectedSearchPlaylist(selectedGroups,selectedGroups.map(group => group.word),options)
    } catch (error) { alert('Playlist could not be prepared: ' + error.message); return }
    finally { $button.prop('disabled',false) }
    if (!queue.length) { alert('No playable clips for the selected headings.'); return }
    if (window._practiceActive) closePracticeMode()
    if (window._playingRecording) stopPlayingRecording()
    playRecording({ queue, temporary: true, gapSeconds: 5 })
  })
  _syncSearchPlaylistSelection(state)
}

// Queries and pagination can redraw the same element while an older render
// yields for context or the UI. Only the newest render may append headings.
let _srtRenderVersion = 0
async function populateSRTFindings(wordToItemsMap, $result, token, renderVersion = _srtRenderVersion) {
  const isCurrent = () => renderVersion === _srtRenderVersion &&
    (token === undefined || token === window._subtitleSearchToken)
  if (!isCurrent()) return
  const startTime = new Date()
  // Expose for debugging: inspect via `window._lastWordToItemsMap` in console.
  window._lastWordToItemsMap = wordToItemsMap
  // When the keys are guessed corresponding words rather than searched terms,
  // they arrive already ranked by how good the guess is, and none of them is
  // one of the searched terms â€” so neither the usual ordering nor the
  // pipe-expansion filter below has anything to say about them.
  const grouped = !!window._srtGroupedByCorresponding
  let words = grouped ? Object.keys(wordToItemsMap) : getWordsOrdered(Object.keys(wordToItemsMap))
  if (!grouped && window.searchText.includes(SEPARATOR_PIPE)) {
    const filtered = words.filter(it => it.trim() !== window.searchText.trim())
    // If the filter strips the only key (no per-line matches AND the
    // expansion contained regex-syntax terms that getMatchingWords skipped
    // as placeholders), fall back to the individual expanded terms so the
    // user still gets a "no-result" header per form instead of a blank pane.
    words = filtered.length > 0 ? filtered : getSearchedTerms(window.searchText)
  }
  window._lastRenderedWords = words

  if (_searchPlaylistSelection?.map !== wordToItemsMap) {
    _searchPlaylistSelection = { map: wordToItemsMap, selected: new Set(), individual: new Map(), selecting: false, maxPerHeader: '', headingPages:new Map() }
  }
  const selection = _searchPlaylistSelection
  selection.files = window.searchResult
  selection.lang = getSelectedLang()
  selection.searchText = window.searchText
  selection.groups = words.map(word => {
    const key = Object.hasOwn(wordToItemsMap, word) ? word : Object.keys(wordToItemsMap).find(it => it.trim() === word.trim())
    const items = (wordToItemsMap[key] || []).toSorted((x, y) => x.path === window.preferredFile ? -1 : 1)
    return { word, items: groupAndArrangeResults(items) }
  })
  const available = new Set(selection.groups.filter(group => group.items.length).map(group => group.word))
  for (const word of selection.selected) if (!available.has(word)) selection.selected.delete(word)
  for (const word of selection.individual.keys()) if (!available.has(word)) selection.individual.delete(word)
  _renderSearchPlaylistToolbar(selection, $result)

  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0))
  const WORD_CHUNK = 1

  const pg = searchPageBounds(words.length, getSearchResultPageSize(), window._searchResultPage)
  window._searchResultPage = pg.page
  _renderSearchPagination(pg)

  for (let wStart = pg.start; wStart < pg.end; wStart += WORD_CHUNK) {
    if (!isCurrent()) return
    const wEnd = Math.min(wStart + WORD_CHUNK, pg.end)
    const slice = words.slice(wStart, wEnd)
    for (const word of slice) {
      try {
        const items = selection.groups.find(group => group.word === word).items
        const isSweepUp = grouped && word === _EVERYTHING_ELSE
        let title = word
        if (isSweepUp) {
          // The lines the guesses could not account for. Named for what it is
          // rather than left under a marker nobody typed.
          title = 'everything else'
        } else if (word.trim().length !== word.length) {
          title = `"${word}"`
        }

        // Nothing under this heading was found by the search itself â€” every line
        // came in through the guess. Dimmed, so the eye goes to the headings that
        // answer what was actually asked.
        const viaGuessOnly = grouped && !isSweepUp && items.length > 0 && items.every(it => it && it._viaGuess)
        const wordBlock = $(`<div class="subtitle-result-group"><h5 class="l-accordion ${items.length ? '' : 'no-result'}${viaGuessOnly ? ' srt-guess-only' : ''}"${viaGuessOnly ? ' title="No English line here contains the search word â€” these are lines whose ' + _.escape(getLangFromUrl().fullName || 'studied-language') + ' side uses this guess"' : ''}><button type="button" class="subtitle-result-toggle" aria-expanded="false"><i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i> <span class="subtitle-result-word">${_.escape(title)}</span> <span class="match-count"></span></button></h5></div>`)
        const $choice = $('<label class="search-playlist-choice"><input type="checkbox" class="search-playlist-checkbox"></label>')
          .prop('hidden', !selection.selecting)
          .on('click', e => e.stopPropagation())
          .appendTo(wordBlock.find('.l-accordion'))
        if (!isSweepUp) wordBlock.find('.subtitle-result-word').attr('lang', selection.lang === 'en' && !grouped ? 'en' : getLangFromUrl().code)
        $choice.find('input').attr('aria-label', `Select clips for ${title}`).data('word', word)
          .prop({ checked: selection.selected.has(word), disabled: !items.length })
          .on('change', e => {
            selection.individual.delete(word)
            if (e.target.checked) selection.selected.add(word)
            else selection.selected.delete(word)
            _syncSearchPlaylistSelection(selection)
          })

        // The sweep-up heading is not a word, so there is nothing to look it up
        // in â€” a Wiktionary link for "_everything_else" would be a dead end.
        if (!isSweepUp) {
          wordBlock.append(`<div style=""> Wiki: ${getWikiShortcut(word)}${getSwedishDictionaryLink(word)} ä¸¨
            <a href="https://www.google.com/search?q=${_.escape(encodeURIComponent(word))}&udm=2" target="_blank">Images</a> ä¸¨
            <a href="https://filmot.com/search/%22${_.escape(encodeURIComponent(word))}%22/1?lang=${getLangFromUrl().code}" target="_blank">YouTube (Filmot)</a> </div> <br>`)
        }

        $result.append(wordBlock)

        // Total available matches after source-filter / dedup grouping. Shown
        // in the accordion header so the user knows how many hits a word has,
        // even when only `numberOfItemsToShow()` are rendered below.
        const totalMatches = items.length

        // (Previously: when toggle=EN, dedup items whose parallel-index SV text
        // shared any non-common word with an already-rendered item's SV side.
        // That was designed for "viewing EN translations of SV searches", but the
        // search pipeline always runs *in* the selected language â€” for a direct
        // EN search every hit's parallel SV line shares a form of the searched
        // word, so item #2..N all looked like duplicates and got dropped. The
        // header count showed the true total, the body showed only one row.
        // Removing the dedup; the per-result list is short enough that genuine
        // duplicates aren't a real UX problem.)
        const batchSize = Math.min(100, numberOfItemsToShow())
        const pageCount = Math.max(1, Math.ceil(items.length / batchSize))
        // Dedicated match container: clear only these rows when this heading
        // changes page. The heading, search links and pager remain mounted.
        const $matches = $('<div class="subtitle-heading-matches"></div>').appendTo(wordBlock)
        // Keep the per-heading pager mounted even while a new match is loading.
        const $pager = pageCount > 1
          ? $('<div class="subtitle-heading-pages"></div>').appendTo(wordBlock)
          : $()
        if ($pager.length) {
          $('<button type="button" class="heading-page-prev" aria-label="Previous matches" title="Previous matches"><span class="heading-page-label">Previous matches</span><span class="heading-page-icon" aria-hidden="true">â€¹</span></button>')
            .on('click', () => { void renderHeadingPage((selection.headingPages.get(word) || 0) - 1) }).appendTo($pager)
          $('<span class="heading-page-range"></span>').appendTo($pager)
          $('<button type="button" class="heading-page-next" aria-label="Next matches" title="Next matches"><span class="heading-page-label">Next matches</span><span class="heading-page-icon" aria-hidden="true">â€º</span></button>')
            .on('click', () => { void renderHeadingPage((selection.headingPages.get(word) || 0) + 1) }).appendTo($pager)
        }
        let headingRenderId = 0
        async function renderHeadingPage(requestedPage) {
          const run = ++headingRenderId
          const headingPage = Math.max(0, Math.min(requestedPage, pageCount - 1))
          selection.headingPages.set(word, headingPage)
          // Keep the heading, its options, the toolbar, other headings and
          // their live DOM untouched. Only replace this heading's match rows.
          $matches.empty()
          if ($pager.length) {
            $pager.find('.heading-page-prev').prop('disabled', headingPage === 0)
            $pager.find('.heading-page-next').prop('disabled', headingPage >= pageCount - 1)
            $pager.find('.heading-page-range').text(
              ` ${headingPage * batchSize + 1}â€“${Math.min(items.length, (headingPage + 1) * batchSize)} of ${items.length} `)
          }
          const rendered = []
          for (let i = headingPage * batchSize; i < items.length; i++) {
          if (rendered.length >= batchSize) {
            break;
          }

          const item = items[i];

          try {
            // The capture path reads this heading back as the playlist word, so it
            // has to be the word this line actually matched â€” not the block it was
            // filed under. They are the same thing for an ordinary search; under a
            // guessed grouping the heading is a guess, and one of them is the
            // sweep-up marker, which nobody typed and nothing should be saved as.
            const $fileBlock = $(`<div class="srt-file" title="${_.escape(item['name'])}">
                                  <h4 data-file="${_.escape(item.url)}" style="display: none;"> ${_.escape(item.word || word)} </h4>
                              </div>`)
            if (item._viaGuess) {
              $fileBlock.append(
                `<span class="srt-via-guess" title="Found through the ${_.escape(item._viaGuess)} in this line, not through the English search">via ${_.escape(item._viaGuess)}</span>`)
            }

            const $itemChoice = $('<label class="search-playlist-item-choice"><input type="checkbox" class="search-playlist-item-checkbox"><span>Select clip</span></label>')
              .prop('hidden', !selection.selecting)
              .prependTo($fileBlock)
            $itemChoice.find('input').attr('aria-label', `Select match ${i + 1} under ${title}`)
              .data({ word, index: i })
              .prop('checked', selection.individual.has(word)
                ? selection.individual.get(word).has(i) : selection.selected.has(word))
              .on('change', e => {
                let picks = selection.individual.get(word)
                if (!picks) {
                  picks = new Set(selection.selected.has(word) ? items.map((_, index) => index) : [])
                  selection.individual.set(word, picks)
                  selection.selected.delete(word)
                }
                if (e.target.checked) picks.add(i)
                else picks.delete(i)
                if (!picks.size) selection.individual.delete(word)
                else if (picks.size === items.length) {
                  selection.individual.delete(word)
                  selection.selected.add(word)
                }
                _syncSearchPlaylistSelection(selection)
              })
            $matches.append($fileBlock)

            const id = uuid()
            const $lines = $(`<div id="${id}" style="padding-top: 4px; padding-bottom: 8px;"></div>`)
            // Expand the visible window by the user-configured context. renderLines
            // clamps fromIndex to >= 1 and (with the new clamp below) toIndex to
            // the file's last index, so passing out-of-range values is safe.
            // Coerce everything to Number: the SRT parser stores `line.index` as a
            // string, so `index + _after` would concatenate ("103" + 2 â†’ "1032"),
            // ballooning toIndex so the renderLines file-end clamp shows every line
            // from the match to EOF â€” i.e. "more than configured lines after match".
            // Subtraction (used for fromIndex) always coerces numerically, which is
            // why _before never tripped this. Also defensively coerce the settings.
            const _before = parseInt((window._appSettings && window._appSettings.contextLinesBefore), 10) || 0
            const _after = parseInt((window._appSettings && window._appSettings.contextLinesAfter), 10) || 0
            const matchIdx = parseInt(item.line.index, 10) || 0
            // Stash the matched line's SRT index so renderLines can expose it
            // to the capture button (the +/- buttons mutate from/toIndex, but
            // the underlying matched line never changes).
            $lines.data({fromIndex: matchIdx - _before, toIndex: matchIdx + _after,
               matchLineIndex: matchIdx, matchWord: item.word || word,
               // Explicitly selecting zero context lines disables automatic
               // surrounding-word expansion for this search result.
               autoWordContext: _before > 0 || _after > 0})
            $fileBlock.append($lines)

            await renderLines(id, item.url)
            if (!isCurrent() || run !== headingRenderId || !wordBlock[0].isConnected) return
            rendered.push(item)
          } catch (perItemErr) {
            if (!isCurrent() || run !== headingRenderId || !wordBlock[0].isConnected) return
            if (perItemErr.code?.startsWith('subtitle-search')) throw perItemErr
            // One bad item shouldn't kill the whole word block. Log and move on.
            console.error('populateSRTFindings: failed to render item for', word, item, perItemErr)
          }
          }//end for
          if (!isCurrent() || run !== headingRenderId || !wordBlock[0].isConnected) return
          wordBlock.find('.l-accordion').toggleClass('no-result', rendered.length === 0)
        }
        await renderHeadingPage(selection.headingPages.get(word) || 0)

        // Header bookkeeping: show a match count, and grey the header out if
        // the post-filter pipeline produced nothing (sources disabled, all
        // duplicates, etc.) so the user can tell apart "no hits" from
        // "hits, just collapsed".
        if (totalMatches > 0) {
          wordBlock.find('.match-count').text(`(${totalMatches})`)
        }
      } catch (perWordErr) {
        if (!isCurrent()) return
        if (perWordErr.code?.startsWith('subtitle-search')) throw perWordErr
        // Per-word failures (missing categories, bad item shape, â€¦) used to
        // break the entire results render. Log and continue so the user
        // still sees results for the other words.
        console.error('populateSRTFindings: failed for word', word, perWordErr)
      }
    } //end word slice
    await yieldToUI()
    if (!isCurrent()) return
    // Measure the sticky accordion height once we've rendered enough chunks
    // for one to be on the page, and feed it back as a CSS variable so
    // `.lines-cntnr .buttons`' sticky `top` parks flush against it (instead
    // of the previous 2.5rem gap that revealed scrolling content). Re-measure
    // on resize via a one-time listener.
    try { _refreshAccordionStickyHeight() } catch (_) {}
  }
  console.log(`Populate SRT findings (page ${pg.page + 1}/${pg.pageCount}) completed in ${(new Date() - startTime)/1000} s`)
}

// The bar under the results: Prev / page picker / Next. Hidden when everything
// fits on one page.
function _renderSearchPagination(pg) {
  const $bar = $('#search-pagination')
  if (pg.pageCount <= 1) { $bar.hide(); return }
  const $sel = $('#searchPageSelect')
  $sel.empty()
  const pages = new Set([0, pg.pageCount - 1])
  for (let i = Math.max(0, pg.page - 10); i <= Math.min(pg.pageCount - 1, pg.page + 10); i++) pages.add(i)
  for (const i of [...pages].sort((a,b) => a-b)) $sel.append(new Option(String(i + 1), String(i)))
  $sel.val(String(pg.page))
  $('#searchPageCount').text(pg.pageCount)
  $('#searchPrevPageButton').toggleClass('disabled', pg.page <= 0)
  $('#searchNextPageButton').toggleClass('disabled', pg.page >= pg.pageCount - 1)
  $bar.show()
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
<h3>No results found for ${_.escape(search)}</h3>
Try Wiki ${getWikiShortcut(search)}${getSwedishDictionaryLink(search, getSelectedLang() === 'en' ? 'en' : getLangFromUrl().code)}
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

// Move the language switch â€” both halves of it. The checkbox is what the page
// reads; the switch the user reads is drawn by bootstrap-toggle from its own
// state, and it does not watch the property. Setting the property alone leaves
// the page searching one language while the switch says the other.
//
// Silently: the switch's own handler starts a fresh search, and every caller
// here is about to start one itself.
function _setLangToggle(isEn, familiar = false) {
  const $cb = $('#toggleLangCb')
  $cb.prop('checked', !!isEn)
  $('#searchLanguageSelect').val(familiar ? 'known' : isEn ? 'en' : 'sv')
  try {
    const widget = $cb.data('bs.toggle')
    if (widget) { if (isEn) widget.on(true); else widget.off(true) }
  } catch (e) { console.warn('lang toggle sync failed', e) }
}

function _familiarSearchLanguage() {
  if (window.forceLangForNextSearch || window.forceMainLangForNextSearch ||
      $('#searchLanguageSelect').val() !== 'known') return null
  const familiar = _vocabularyLookupLanguage()
  return familiar === 'en' || familiar === getLangFromUrl().code ? null : familiar
}

function getSelectedLang() {
  // forceLangForNextSearch overrides the UI toggle for one search â€” used by
  // "Search here" on a clicked subtitle word (search in whichever language
  // the word was in, regardless of the toggle) and by rare-word / vocab
  // searches (always main lang).
  if (window.forceLangForNextSearch === 'sv' || window.forceLangForNextSearch === 'en') {
    return window.forceLangForNextSearch
  }
  if (window.forceMainLangForNextSearch) return 'sv';
  return $('#toggleLangCb').prop('checked') ? 'en' : 'sv';
}

// Thin wrappers â€” pure cores in ./search-text.js take the subtitle map
// and selected language as args.
function searchSubtitleText(text, key) {
  return _coreSearchSubtitleText(typeof allSubtitles !== 'undefined' ? allSubtitles : {}, text, key || 'sv')
}

function filterByLanguage(searchResults) {
  return _coreFilterByLanguage(searchResults, getSelectedLang())
}

// getSurrounding is imported directly from ./search-text.js.

// wordIsExactInVocabularyLine lives in ./search-text.js.

let _vocabularyMatcherCache = null
function _getVocabularyMatcher() {
  const lang = getSelectedLang() === 'en' ? 'en' : getLangFromUrl().code
  // Include the full contents: edits often replace a line without changing
  // the number of categories/lines. The previous count-only caches missed it.
  const signature = lang + ':' + JSON.stringify(window.vocabulary || {})
  if (!_vocabularyMatcherCache || _vocabularyMatcherCache.signature !== signature) {
    const expansions = getExpansionForWords()
    const matcher = createVocabularyMatcher(window.vocabulary, {
      lang, expansions, hiddenCategories: VOCAB_HIDDEN_CATEGORIES,
      expandLine: line => _sharedExpandWords(line, lang, expansions, lang === 'es' ? conjugateTableSpanish : null)
    })
    _vocabularyMatcherCache = { signature, matcher }
  }
  return _vocabularyMatcherCache.matcher
}

export function wordIsInVocabularyLine(vocabLine, search) {
  return !!_getVocabularyMatcher().matchLine(vocabLine, search)
}

// Does any pipe-segment in the vocabulary corpus contain `word` as an exact
// (case-insensitive) word? Used to gate weak (overlap < 3) prefix matches:
// they're shown only when there's a strong anchor â€” i.e. the vocab actually
// has the user's typed term as a word â€” so noisy 2-char overlaps like
// "grÃ¥t" â†’ "Ã¥t" don't leak through when there's nothing real to anchor on.
// Thin wrapper â€” pure core in ./search-text.js takes the bracket stripper.
function vocabHasExactWord(allWords, word) {
  return _coreVocabHasExactWord(allWords, word, removeHintsInBrackets)
}

// Common derivational prefixes per language. Sorted longest-first so that
// stripping picks `under` before `un`, `genom` before `ge`, `pÃ¥` before
// `pÃ¥`-vs-`Ã¥`, etc.
// COMMON_PREFIXES and _stripPrefix are now imported from ./different-prefix.js.
// _findDifferentPrefixMatches stays here as a thin wrapper that walks the
// live window.vocabulary and delegates to the pure core.
function _findDifferentPrefixMatches(searchText, lang) {
  const allWords = []
  const lineCategory = []
  Object.entries(window.vocabulary || {}).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return
    if (VOCAB_HIDDEN_CATEGORIES.has(cat)) return
    lines.forEach(l => { allWords.push(l); lineCategory.push(cat) })
  })
  const { stem, origPrefix, results } = _coreFindDifferentPrefixMatches(
    searchText, lang, allWords, lineCategory, vocabSuffixOverlapLen
  )
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

  const headerLine = `Stem: <b>${_.escape(stem || '?')}</b>${origPrefix ? `, original prefix <b>${_.escape(origPrefix)}-</b>` : ''} â€” search "${_.escape(searchText || '')}"`
  $dlg.append(`<div style="font-size:0.85em;color:#666;margin-bottom:6px;">${headerLine}</div>`)

  const $list = $('<div class="diff-prefix-list"></div>')
  $dlg.append($list)

  // Overflow from the main prefix panel â€” same strong matches that were
  // capped off by `prefixResultsMax`. Rendered as the same kind of
  // per-search-part collapsible groups so the dialog mirrors the main
  // panel's layout.
  const overflow = window._prefixOverflow
  const hasOverflow = overflow && overflow.searchText === searchText && overflow.groups && overflow.groups.size > 0
  if (hasOverflow) {
    $list.append(`<div style="font-size:0.85em;color:#666;margin:4px 0;">More prefix matches (capped at upfront limit):</div>`)
    for (const part of overflow.partOrder) {
      const idxs = overflow.groups.get(part)
      if (!idxs || idxs.length === 0) continue
      const $group = $('<div class="prefix-group"></div>')
      const $gh = $(`<div class="prefix-group-header"><i class="fa fa-chevron-right prefix-group-chevron" aria-hidden="true"></i><span class="prefix-group-part">${_.escape(part)}</span><span class="prefix-group-count">(${idxs.length})</span></div>`)
      const $gb = $('<div class="prefix-group-body" hidden></div>')
      idxs.forEach(idx => {
        const line = overflow.allWords[idx]
        const cat = overflow.lineCategory[idx] || '?'
        const ov = overflow.overlapByIdx && overflow.overlapByIdx.get
          ? overflow.overlapByIdx.get(idx)
          : null
        const surroundings = getSurrounding(idx, overflow.allWords)
        const matchEntry = surroundings.find(it => it.index === idx) || { item: line, index: idx }
        const vocabItem = $('<div class="vocabulary-segment"></div>')
        const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')
        const $header = _buildVocabLine(matchEntry)
        $header.addClass('highlighted similar-segment-header')
        $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>')
        const ovBadge = ov != null ? ` (overlap ${ov})` : ''
        $header.append(`<span style="font-size:0.75em;color:#666;margin-left:6px;">[${_.escape(cat)}]${ovBadge}</span>`)
        vocabItemContent.append($header)
        const $body = $('<div class="similar-segment-body" hidden></div>')
        surroundings.forEach(it => {
          const $line = _buildVocabLine(it, undefined, it.index === idx ? undefined : '')
          if (it.index === idx) $line.addClass('highlighted')
          $body.append($line)
        })
        vocabItemContent.append($body)
        vocabItem.append(vocabItemContent)
        $gb.append(vocabItem)
      })
      $gh.on('click', () => {
        const open = $gh.hasClass('is-open')
        if (open) { $gb.attr('hidden', ''); $gh.removeClass('is-open') }
        else { $gb.removeAttr('hidden'); $gh.addClass('is-open') }
      })
      $group.append($gh)
      $group.append($gb)
      $list.append($group)
    }
    if (results && results.length > 0) {
      $list.append(`<div style="font-size:0.85em;color:#666;margin:10px 0 4px 0;border-top:1px solid #eee;padding-top:8px;">Different-prefix / weak-overlap matches:</div>`)
    }
    _attachAccordionDelegate($list)
  }

  if (!stem || stem.length < 3) {
    if (!hasOverflow) $list.append(`<div style="color:grey;padding:4px;">Search term is too short to derive a stem.</div>`)
  } else if (!results || results.length === 0) {
    if (!hasOverflow) $list.append(`<div style="color:grey;padding:4px;">No different-prefix or suffix-overlap matches for "${_.escape(searchText)}".</div>`)
  } else {
    results.forEach(({ kind, prefix, candidate, lineIdx, category }) => {
      const surroundings = getSurrounding(lineIdx, allWords)
      const matchEntry = surroundings.find(it => it.index === lineIdx) || { item: allWords[lineIdx], index: lineIdx }
      const vocabItem = $('<div class="vocabulary-segment"></div>')
      const vocabItemContent = $('<div class="vocabulary-segment-content"></div>')
      // Prefix matches: build the line normally (default highlight is a
      // no-op here because the typed stem usually doesn't overlap the
      // candidate-matched segment) then override the rendered span with
      // _highlightStemInPrefixMatch so only the stem portion is marked
      // (e.g. "fÃ¶r<mark>rÃ¥t</mark>a") instead of the synthetic candidate.
      // Overlap matches: default mode picks up the matched short segment
      // (e.g. "Ã¥t" for "grÃ¥t") via the live window.searchText.
      const $header = _buildVocabLine(matchEntry)
      if (kind === 'prefix') {
        const customHtml = _highlightStemInPrefixMatch(matchEntry.item, candidate, stem)
        $header.children('span').first().html(customHtml)
      }
      $header.addClass('highlighted similar-segment-header')
      $header.prepend('<i class="fa fa-chevron-right similar-chevron" aria-hidden="true"></i>')
      const { category: cat, badge } = diffPrefixRowBadge({ kind, prefix, category })
      $header.append(`<span style="font-size:0.75em;color:#666;margin-left:6px;">[${_.escape(cat)}] ${_.escape(badge)}</span>`)
      vocabItemContent.append($header)
      const $body = $('<div class="similar-segment-body" hidden></div>')
      surroundings.forEach(it => {
        const $line = _buildVocabLine(it, undefined, it.index === lineIdx ? undefined : '')
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

// Similarity helpers extracted to ./similarity.js â€” see the imports at the
// top of this file.

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
    if (VOCAB_HIDDEN_CATEGORIES.has(cat)) return
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
  $vocab.html(`<div style="color:grey;padding:4px;">Searching similar wordsâ€¦</div>`)
  const $rc = $('#resultContainer')
  if ($rc.is(':hidden')) {
    $rc.show()
    updateToggleButtonView('resultContainer')
  }

  // Reuse a single Intl.Segmenter â€” re-creating it per line is expensive.
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
      // before extracting words â€” those are annotations, not part of the
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
          // needs edit distance â‰¤ 2 (length diff â‰¤ 2). Tier 0 (homophone)
          // can have any length, so skip the filter when phonetic keys
          // already match.
          if (Math.abs(cwLen - swLens[si]) > 2 && cwKey !== swPhonetic[si]) {
            // Length differs too much for vowel/consonant/edit-distance tiers,
            // and phonetic keys don't match â€” but a compound match (one word
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

  console.log('[similar] search words:', searchWords, 'â€” total scored matches:', matches.length)
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
  // lineIdx â€” same line shouldn't appear twice for the same candidate even
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

  // Insertion order = score order of each group's best match â†’ that's how
  // we want groups ordered globally too.
  const allGroups = Array.from(groupMap.values())
  const tier1Groups = allGroups.filter(g => g.bestMatch.tier <= 1)
  const otherGroupsFull = allGroups.filter(g => g.bestMatch.tier > 1)
  const tier1Top = tier1Groups.slice(0, limit)

  console.log(`[similar] tier-1 groups ${tier1Top.length}/${tier1Groups.length}, other groups ${otherGroupsFull.length}, limit=${limit}`)

  _renderSimilarMatches($vocab, tier1Top, otherGroupsFull, limit, allLines, raw)
}

// Thin wrapper delegating to highlight.js. See module docstring there.
function _highlightWordInLine(text, word) {
  return _coreHighlightWordInLine(text, word)
}

// Thin wrapper â€” delegates to highlight.js, injecting removeHintsInBrackets
// so the pure module never reaches back into language.js globals.
function _highlightSearchInVocabLine(rawText, searchText, opts = {}) {
  return _coreHighlightSearchInVocabLine(rawText, searchText, {
    exactPrefix: opts.exactPrefix === true,
    wholeToken: opts.wholeToken === true,
    stripBracketHints: removeHintsInBrackets,
  })
}

// Thin wrapper â€” delegates to highlight.js.
function _highlightStemInPrefixMatch(rawText, candidate, stem) {
  return _coreHighlightStemInPrefixMatch(rawText, candidate, stem, {
    stripBracketHints: removeHintsInBrackets,
  })
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

let _vocabularyDisplayIndex
function _displayVocabularyLine(line, index, matches = []) {
  if (_vocabularyLookupLanguage() === 'en' || getSelectedLang() === 'en' || !line) return line
  if (!_vocabularyDisplayIndex) {
    _vocabularyDisplayIndex = _getVocabularyHintIndex()
    // One index lookup per render or picker query. The matcher checks the
    // whole vocabulary for edits, so looking it up per option is expensive.
    queueMicrotask(() => { _vocabularyDisplayIndex = null })
  }
  const hints = [...new Set([...matches, ..._vocabularyDisplayIndex.hintsFor(line, index)])]
  if (!hints.length) return line
  const parts = ['(' + hints.join(', ') + ')', ...vocabularyLineParts(line).forms]
  if (line.trimEnd().endsWith(SEPARATOR_PIPE)) parts.push('')
  return parts.join(SEPARATOR_PIPE)
}

// Build a single `<div class="vocabulary-line">` for a getSurrounding entry.
// Centralised so renderVocabularyFindings, renderVocabularyLineByText, and
// _buildSimilarSegment aç®6óÆòµë(š+myÖvVÖVçB6æ6†÷C²GWÆ–6FR&VÖ–æFW'26öÆÆ6R&VÆ÷rà¢öF—7Æ”æ÷F–d—FVÒ‡ÂÂ†–BÂfVVBæ6öæ6B…öæ÷F–dfVVB‚’’¢ÒVÇ6R–b„FFRææ÷r‚’Ò7F'BÂ#’°¢6WEF–ÖV÷WB‡F–6²Â#S¢ÒVÇ6R°¢6öç6öÆRçv&â‚u¶æ÷F–eÒvfRWv—F–ærf÷"Æ–Æ—7C¢rÂÂ¢Ð¢Ð¢F–6²‚§Ð ¢òòÖ&²öæÇ’&VÖ–æFW'27GVÆÇ’f—6—FVBÂÆVf–ærF†R&W7BVç&VBöâV&Ç’W†—Bà¦gVæ7F–öâö6µf—6—FVDæ÷F–f–6F–öâ†—B’°¢–b†—Bbb—Båöæ÷F–d¶W’bb—Båöæ÷F–d—FVÔ–Bbb—Båöæ÷F–d6¶æ÷vÆVFvVB’°¢—Båöæ÷F–d6¶æ÷vÆVFvVBÒG'VP¢öæ÷F–d6´—FVÒ†—Båöæ÷F–d¶W’Â—Båöæ÷F–d—FVÔ–B¢Ð§Ð ¢òò6öÆB×7F'BFƒ¢F†R÷Vç2F†—2vRg&W6‚BF†R—FVÒw2÷Vå÷W&À¢òòƒöæ÷F–eÃÒfæ÷F–d—FVÓÒ’âv—Bf÷"gVÆÂÆöB‡6òF†R&ö÷BFöW6âwBFV"F÷vâF†P¢òò&7F–6Rf–WrvR÷Vâ’æB7G&—F†R&×26ò&R×&VæFW"÷&Vg&W6‚FöW6âw@¢òò&R×G&–vvW"æBF†RU$Â7F—26ÆVâà£²†gVæ7F–öâöæ÷F–d6öÆE7F'B‚’°¢ÆWBÂÂ†–@¢G'’°¢6öç7BRÒæWrU$Â‡v–æF÷ræÆö6F–öâæ‡&Vb¢ÂÒRç6V&6…&×2ævWB‚væ÷F–eÂr¢†–BÒRç6V&6…&×2ævWB‚væ÷F–d—FVÒr¢Ò6F6‚…ò’²&WGW&âÐ¢–b‚ÂÇÂ†–B’&WGW&à¢6öç6öÆRæÆör‚u¶æ÷F–eÒ6öÆB×7F'BFVWÆ–æ²rÂ²ÂÂ†–BÒ¢òò&—6VB&Vf÷&RF†R&×2&R7G&—VB&VÆ÷rÂ&V6W6RF†B7G&—†Vç0¢òò7–æ6‡&öæ÷W6Ç’GW&–ærÖöGVÆRWfÇVF–öâ(	B'’F†RF–ÖRç—F†–ær'Vææ–æröà¢òòÆöFÆöö·2BF†RU$Â—B—2Ç&VG’6ÆVââF†Rf–Wr&W7F÷&R&VG2F†—0¢òòFò¶æ÷r—B6†÷VÆB7FæBF÷vâf÷"F†RFVWÆ–æ²à¢v–æF÷råö7Wæ÷F–dFVWÆ–æ²ÒG'VP¢G'’°¢6öç7BS"ÒæWrU$Â‡v–æF÷ræÆö6F–öâæ‡&Vb¢S"ç6V&6…&×2æFVÆWFR‚væ÷F–eÂr“²S"ç6V&6…&×2æFVÆWFR‚væ÷F–d—FVÒr¢v–æF÷ræ†—7F÷'’ç&WÆ6U7FFR†çVÆÂÂrrÂS"çFõ7G&–ær‚’¢Ò6F6‚…ò’·Ð¢6öç7BvòÒ‚’Óâ6WEF–ÖV÷WB‚‚’Óâöæ÷F–d÷Våv†Vå&VG’‡ÂÂ†–B’ÂC¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒv6ö×ÆWFRr’vò‚¢VÇ6Rv–æF÷ræFDWfVçDÆ—7FVæW"‚vÆöBrÂvò§Ò’‚ ¢òò&V÷Vâv†FWfW"v2öâ67&VVâv†VâF†RÆ7BvVçBv’â6ÖRv—B2F†P¢òòFVWÆ–æ²&÷fRÂf÷"F†R6ÖR&V6öâà¢òð¢òòF†Rv÷&²—2FVfW'&VB&F†W"F†âFöæR†W&S¢÷&W7F÷&T÷Våf–Wr&VG2ÖöGVÆP¢òò6öç7FçG2FV6Æ&VBgW'F†W"F÷vâF†—2f–ÆRÂv†–6‚Fòæ÷BW†—7B–WBv†–ÆRF†—0¢òòÆ–æR—2&V–ærWfÇVFVBâ†ö—7F–ærÖ¶W2F†R6ÆÂÆVvÃ²F†RFVÆ’Ö¶W2—@¢òò6÷'&V7Bà£²†gVæ7F–öâ÷&W7F÷&T÷Våf–WtöäÆöB‚’°¢6öç7BvòÒ‚’Óâ6WEF–ÖV÷WB‚‚’Óâ°¢G'’²÷&W7F÷&T÷Våf–Wr‚’Ò6F6‚†R’²6öç6öÆRçv&â‚u·&W7F÷&UÒf–ÆVBrÂR’Ð¢ÒÂC¢–b†Fö7VÖVçBç&VG•7FFRÓÓÒv6ö×ÆWFRr’vò‚¢VÇ6Rv–æF÷ræFDWfVçDÆ—7FVæW"‚vÆöBrÂvò§Ò’‚ ¦gVæ7F–öâöæ÷F–e66†VGVÆT¶–æB†¶W’’°¢6öç7B2Òöæ÷F–e66†VGVÆW2‚’æf–æB‡‚Óâ‚æ¶W’ÓÓÒ¶W’¢&WGW&â2ò2æ¶–æB¢çVÆÀ§Ð ¦gVæ7F–öâöæ÷F–e÷VÆFU66†VGVÆW2‚’°¢6öç7BG6VÂÒB‚r6æ÷F–e66†VGVÆRr¢–b‚G6VÂæÆVæwF‚’&WGW&à¢6öç7B66†VGVÆW2Òöæ÷F–e66†VGVÆW2‚¢6öç7B7W"ÒG6VÂçfÂ‚¢G6VÂæV×G’‚¢66†VGVÆW2æf÷$V6‚‡2Óâ°¢G6VÂæVæB†Æ÷F–öâfÇVSÒ"GµòæW66R‡2æ¶W’—Ò#âGµòæW66R‡2ææÖR—Ò‚GµòæW66R‡2æ¶–æB—Ò“Âö÷F–öãæ¢Ò¢–b†7W"bb66†VGVÆW2ç6öÖR‡2Óâ2æ¶W’ÓÓÒ7W"’’G6VÂçfÂ†7W"¢òò–çG&ò6FVæ6S¢&V7W'&–ær66†VGVÆW2öæÇ’ÂÇW2"†æöæR’"÷F–öâà¢6öç7BF–çG&òÒB‚r6æ÷F–d–çG&õ66†VGVÆRr¢–b‚F–çG&òæÆVæwF‚’°¢6öç7B7W$’ÒF–çG&òçfÂ‚¢F–çG&òæV×G’‚’æVæB‚sÆ÷F–öâfÇVSÒ"#â†æöæR“Âö÷F–öãâr¢66†VGVÆW2æf–ÇFW"‡2Óâ2æ¶–æBÓÓÒw&V7W'&–ærr’æf÷$V6‚‡2Óà¢F–çG&òæVæB†Æ÷F–öâfÇVSÒ"GµòæW66R‡2æ¶W’—Ò#âGµòæW66R‡2ææÖR—ÓÂö÷F–öãæ’¢–b†7W$’bb66†VGVÆW2ç6öÖR‡2Óâ2æ¶W’ÓÓÒ7W$’’’F–çG&òçfÂ†7W$’¢Ð¢öæ÷F–e7–æ4–çG&ôf–Æ&–Æ—G’‚§Ð ¢òòF†R–çG&öGV7F–öâ6FVæ6R—2fÆ–BöæÇ’v†VâF†RÖ–â66†VGVÆR—26W&–W0¢òò‡F†R6öçG&7B6·2&Eö–çG&ò÷F†W'v—6R’(	Bw&W’÷WBò6ÆV"—Bv†Vâ—B—6âwBà¦gVæ7F–öâöæ÷F–e7–æ4–çG&ôf–Æ&–Æ—G’‚’°¢6öç7BF–çG&òÒB‚r6æ÷F–d–çG&õ66†VGVÆRr¢–b‚F–çG&òæÆVæwF‚’&WGW&à¢6öç7B—56W&–W2Òöæ÷F–e66†VGVÆT¶–æB‚B‚r6æ÷F–e66†VGVÆRr’çfÂ‚’’ÓÓÒw6W&–W2p¢F–çG&òç&÷‚vF—6&ÆVBrÂ—56W&–W2¢–b‚—56W&–W2’F–çG&òçfÂ‚rr¢B‚r6æ÷F–d–çG&õ&÷rr’æ772‚v÷6—G’rÂ—56W&–W2òsr¢sãSRr§Ð ¢òò'V–ÆB—FV×2f÷"Æ–Æ—7B‡&W6öÇf–ærf—'GVÂÆ–Æ—7Bw2ÖVÖ&W'2’à¦gVæ7F–öâöæ÷F–d—FV×4f÷%Æ–Æ—7B†æÖR’°¢6öç7B&V2Ò‡v–æF÷rå÷&V6÷&F–æw2ÇÂ·Ò•¶æÖUÐ¢–b‚&V2’&WGW&âµÐ¢6öç7B—FV×2Òö—5f—'GVÂ†æÖR’ò÷&W6öÇfUf—'GVÄ—FV×2†æÖR’¢&V2æ—FV×0¢&WGW&âö'V–ÆDæ÷F–d—FV×2†—FV×2§Ð ¢òò'V–ÇBæ÷F–f–6F–öâ—FV×2FV6÷&FVBv—F‚–ÆöB–FVçF–g––ærF†R—FVÒâvP¢òòFVÆ–&W&FVÇ’DôâuB6WB÷Vå÷W&Ã¢W"F†R6öçG&7BÂâ÷Vå÷W&ÂÖ¶W2F†RF ¢òòäd”tDR÷&VÆöBF†RvR‡v†B6†÷vVBF†R6V&6‚67&VVâ’âv—F‚æò÷Vå÷W&ÂF†P¢òòFf—&W27W—F÷$æ÷F–f–6F–öä÷VæVB–çFòF†RÇ&VG’ÖÆöFVBvRÂv†–6‚vP¢òò†æFÆR–âÆ6R'’÷Væ–ær&7F–6R(	Bæòæf–vF–öâÂæò&VÆöBâF†R–Æö@¢òò‡Â²†–B’&–FW2Æöær–âF†RWfVçB6òvR6â&W6öÇfRF†R—FVÒà¦gVæ7F–öâöæ÷F–d'V–ÆDFV6÷&FVB†æÖR’°¢&WGW&âöæ÷F–d—FV×4f÷%Æ–Æ—7B†æÖR’æÖ†—BÓâ‡°¢ââæ—BÀ¢–ÆöC¢²Ã¢æÖRÂ†–C¢—BæW‡FW&æÅö–BÒÀ¢Ò’§Ð ¢òòFV&÷Væ6VBWFò×&W7–æ3¢v†VæWfW"Æ–Æ—7G26†ævR†—FVÒVæ&ÆRöF—6&ÆRÂFBÀ¢òò&VÖ÷fRÂ6GW&^(
b’ÂW6‚F†Rg&W6‚—FV×2öbWfW'’æ÷F–f–6F–öâÖVæ&ÆV@¢òòÆ–Æ—7B6òF†R66†VGVÆR&VfÆV7G2F†RÆ–Æ—7Bâ7–æ4—FV×2w&WÆ6Rr¶VW25%0¢òò&öw&W72f÷"¶WB—FV×2Â–ç6W'G2æWröæW2ÂæB6æ6VÇ2&VÖ÷fVBöæW2à¦ÆWBöæ÷F–e&W7–æ5F–ÖW"ÒçVÆÀ¦gVæ7F–öâöæ÷F–e66†VGVÆU&W7–æ2‚’°¢–b‚ö†fTæ÷F–d'&–FvR‚’’&WGW&à¢–b…öæ÷F–e&W7–æ5F–ÖW"’6ÆV%F–ÖV÷WB…öæ÷F–e&W7–æ5F–ÖW"¢öæ÷F–e&W7–æ5F–ÖW"Ò6WEF–ÖV÷WB…öæ÷F–e&W7–æ4ÆÂÂS§Ð¦gVæ7F–öâöæ÷F–e&W7–æ4ÆÂ‚’°¢öæ÷F–e&W7–æ5F–ÖW"ÒçVÆÀ¢–b‚ö†fTæ÷F–d'&–FvR‚’’&WGW&à¢6öç7Böä'&–FvRÒæWr6WB…÷vV'vTæ÷F–dÆ—7G2…öæ÷F–dÆ—7G2‚’’æÖ†ÂÓâÂæW‡FW&æÅö¶W’’¢6öç7B6öÆÂÒv–æF÷rå÷&V6÷&F–æw2ÇÂ·Ð¢ö&¦V7Bæ¶W—2†6öÆÂ’æf÷$V6‚†æÖRÓâ°¢6öç7B¶W’Ò6öÆÅ¶æÖUÒbb6öÆÅ¶æÖUÒææ÷F–d¶W¢–b‚¶W’ÇÂöä'&–FvRæ†2†¶W’’’&WGW&à¢6öç7B—FV×2Òöæ÷F–d'V–ÆDFV6÷&FVB†æÖR¢òòFöâwBWFò×v—RFòV×G’(	BâÆÂÖF—6&ÆVBöV×F–VBÆ–Æ—7B¶VW2—G2Æ7@¢òò—FV×2VçF–ÂF†RW6W"W‡Æ–6—FÇ’F—6&ÆW2—B–âF†RF–Æörà¢–b‚—FV×2æÆVæwF‚’&WGW&à¢æ÷F–e'2‚w7–æ4—FV×2rÂ²W‡FW&æÅö¶W“¢¶W’Â—FV×2ÂÖöFS¢w&WÆ6RrÒ’æ6F6‚‚‚’Óâ·Ò¢Ò§Ð ¦7–æ2gVæ7F–öâöæ÷F–dVæ&ÆUÆ–Æ—7B†æÖRÂ66†VGVÆT¶W’Â–çG&ô¶W’’°¢6öç7B&V2Ò‡v–æF÷rå÷&V6÷&F–æw2ÇÂ·Ò•¶æÖUÐ¢–b‚&V2’&WGW&à¢–b…÷&VgW6U&VDöæÇ•Æ–Æ—7B†æÖR’’&WGW&à¢6öç7B'V–ÇBÒöæ÷F–d—FV×4f÷%Æ–Æ—7B†æÖR¢–b‚'V–ÇBæÆVæwF‚’²ÆW'B‚uF†—2Æ–Æ—7B†2æò—FV×2v—F‚FW‡BFòæ÷F–g’&÷WBâr“²&WGW&âÐ¢6öç7B—FV×2Òöæ÷F–d'V–ÆDFV6÷&FVB†æÖR¢6öç7BW†—7F–æt¶W’Ò&V2ææ÷F–d¶W¢6öç7BÇ&VG”öä'&–FvRÒW†—7F–æt¶W’bb÷vV'vTæ÷F–dÆ—7G2…öæ÷F–dÆ—7G2‚’’ç6öÖR†ÂÓâÂæW‡FW&æÅö¶W’ÓÓÒW†—7F–æt¶W’¢6öç7B¶W’ÒW†—7F–æt¶W’ÇÂöÖ¶Tæ÷F–d¶W’‚¢òò–çG&ò6FVæ6RöæÇ’Æ–W2Fò6W&–W2Ö–â66†VGVÆR†&Eö–çG&ò÷F†W'v—6R’à¢6öç7BW6T–çG&òÒ–çG&ô¶W’bböæ÷F–e66†VGVÆT¶–æB‡66†VGVÆT¶W’’ÓÓÒw6W&–W2p¢6öç7BG7BÒB‚r6æ÷F–dVæ&ÆU7FGW2r’çFW‡B‚tVæ&Æ–æ~(
br’æ772‚v6öÆ÷"rÂr3ccbr¢G'’°¢–b†Ç&VG”öä'&–FvR’°¢òòÆ–Æ—7B—2F†R6÷W&6RöbG'WF‚(	B&WÆ6R6ò&VÖ÷fVB—FV×2&R6æ6VÆÆVBà¢v—Bæ÷F–e'2‚w7–æ4—FV×2rÂ²W‡FW&æÅö¶W“¢¶W’Â—FV×2ÂÖöFS¢w&WÆ6RrÒ¢òò6WE66†VGVÆR6WG2eTÄÂ66†VGVÆ–ær(	BöÖ—GF–ær–çG&õ÷66†VGVÆUö¶W’6ÆV'2—Bà¢6öç7B66†VBÒ²W‡FW&æÅö¶W“¢¶W’Â66†VGVÆUö¶W“¢66†VGVÆT¶W’Ð¢–b‡W6T–çG&ò’66†VBæ–çG&õ÷66†VGVÆUö¶W’Ò–çG&ô¶W¢v—Bæ÷F–e'2‚w6WE66†VGVÆRrÂ66†VB¢ÒVÇ6R°¢6öç7B7&VFRÒ²W‡FW&æÅö¶W“¢¶W’ÂæÖRÂ66†VGVÆUö¶W“¢66†VGVÆT¶W’Â—FV×2Ð¢–b‡W6T–çG&ò’7&VFRæ–çG&õ÷66†VGVÆUö¶W’Ò–çG&ô¶W¢v—Bæ÷F–e'2‚v7&VFTÆ—7BrÂ7&VFR¢Ð¢&V2ææ÷F–d¶W’Ò¶W¢÷6fU&V6÷&F–ær‚¢G7BçFW‡B†Væ&ÆVB(	BG¶'V–ÇBæÆVæwF‡Ò—FVÒG¶'V–ÇBæÆVæwF‚ÓÓÒòrr¢w2wÖ’æ772‚v6öÆ÷"rÂr3sr¢öæ÷F–e&VæFW$Væ&ÆVB‚¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚u¶æ÷F–eÒVæ&ÆRf–ÆVBrÂW'"¢G7BçFW‡B‚tf–ÆVC¢r²†W'"bbW'"æÖW76vRÇÂW'"’’æ772‚v6öÆ÷"rÂr6r¢Ð§Ð ¢òò&VæFW"F†R$Væ&ÆVBæ÷F–f–6F–öç2"6V7F–öâg&öÒF†Rv&Ò×W6†VBÆ—7G2à¦gVæ7F–öâöæ÷F–e&VæFW$Væ&ÆVB‚’°¢6öç7BGw&ÒB‚r6æ÷F–dVæ&ÆVDÆ—7Br¢–b‚Gw&æÆVæwF‚’&WGW&à¢6öç7BÆ—7G2Ò÷vV'vTæ÷F–dÆ—7G2…öæ÷F–dÆ—7G2‚’¢–b‚Æ—7G2æÆVæwF‚’²Gw&æ‡FÖÂ‚sÆF—b7G–ÆSÒ&6öÆ÷#¢3ƒƒƒ¶föçB×6—¦S£'ƒ²#äæöæR–WBãÂöF—câr“²&WGW&âÐ¢6öç7B66†VGVÆW2Òöæ÷F–e66†VGVÆW2‚¢ÆWB‡FÖÂÒrp¢Æ—7G2æf÷$V6‚†ÂÓâ°¢6öç7BÄæÖRÒ÷Æ–Æ—7Df÷$æ÷F–d¶W’†ÂæW‡FW&æÅö¶W’’ÇÂÂææÖP¢6öç7B6÷VçBÒ'&’æ—4'&’†Âæ—FV×2’òÂæ—FV×2æÆVæwF‚¢ ¢6öç7BW6VBÒÂç7FGW2ÓÓÒwW6VBp¢6öç7BÖ–ä—56W&–W2Òöæ÷F–e66†VGVÆT¶–æB†Âç66†VGVÆUö¶W’’ÓÓÒw6W&–W2p¢6öç7B66†VD÷G2Ò66†VGVÆW2æÖ‡2Óà¢Æ÷F–öâfÇVSÒ"GµòæW66R‡2æ¶W’—Ò"G·2æ¶W’ÓÓÒÂç66†VGVÆUö¶W’òr6VÆV7FVBr¢rwÓâGµòæW66R‡2ææÖR—ÓÂö÷F–öãæ’æ¦ö–â‚rr¢6öç7B–çG&ô÷G2Ò²sÆ÷F–öâfÇVSÒ"#â†æò–çG&ò“Âö÷F–öãâuÒæ6öæ6B€¢66†VGVÆW2æf–ÇFW"‡2Óâ2æ¶–æBÓÓÒw&V7W'&–ærr’æÖ‡2Óà¢Æ÷F–öâfÇVSÒ"GµòæW66R‡2æ¶W’—Ò"G·2æ¶W’ÓÓÒÂæ–çG&õ÷66†VGVÆUö¶W’òr6VÆV7FVBr¢rwÓâGµòæW66R‡2ææÖR—ÓÂö÷F–öãæ¢’æ¦ö–â‚rr¢‡FÖÂ³ÒÆF—b6Æ73Ò&æ÷F–b×&÷r"FFÖ¶W“Ò"GµòæW66R†ÂæW‡FW&æÅö¶W’—Ò"7G–ÆSÒ&F—7Æ“¦fÆWƒ¶v£gƒ¶Æ–vâÖ—FV×3¦6VçFW#¶fÆW‚×w&§w&·FF–æs£g‚¶&÷&FW"Ö&÷GFöÓ£‚6öÆ–B6ccc²#à¢Ç7â7G–ÆSÒ&fÆWƒ£¶Ö–â×v–GFƒ£#ƒ¶föçB×6—¦S£7ƒ²#ãÆ#âGµòæW66R‡ÄæÖR—ÓÂö#âÇ7â7G–ÆSÒ&6öÆ÷#¢3ƒƒƒ²#â‚G¶6÷VçGÒ“Â÷7ãâG·W6VBòrÇ7â7G–ÆSÒ&6öÆ÷#¢6c²#çW6VCÂ÷7ãâr¢rwÓÂ÷7ãà¢Ç6VÆV7B6Æ73Ò&æ÷F–b×66†VB"F—FÆSÒ%66†VGVÆR"7G–ÆSÒ&Ö‚×v–GFƒ£Cƒ²#âG·66†VD÷G7ÓÂ÷6VÆV7Cà¢Ç6VÆV7B6Æ73Ò&æ÷F–bÖ–çG&ò"F—FÆSÒ$–çG&öGV7F–öâ6FVæ6R‡6W&–W266†VGVÆRöæÇ’’"7G–ÆSÒ&Ö‚×v–GFƒ£#ƒ²"G¶Ö–ä—56W&–W2òrr¢rF—6&ÆVBwÓâG¶–çG&ô÷G7ÓÂ÷6VÆV7Cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'Fâæ÷F–b×f–Wr×66†VGVÆR#åf–Wr66†VGVÆSÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'Fâæ÷F–b×FövvÆR#âG·W6VBò~)kb&W7VÖRr¢~(û‚W6RwÓÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'Fâæ÷F–bÖF—6&ÆR"7G–ÆSÒ&6öÆ÷#¢6²#äF—6&ÆSÂö'WGFöãà¢ÂöF—cæ ¢Ò¢Gw&æ‡FÖÂ†‡FÖÂ§Ð ¢òò6†÷rF†RæF—fR&Ö–ærÆã²æWfW"W7F–ÖFRgWGW&RFFW2–âF†R'&÷w6W"à¦7–æ2gVæ7F–öâöæ÷F–e6†÷u66†VGVÆR†¶W’’°¢ÆWBG&Wf–WrÒB‚r6æ÷F–e66†VGVÆU&Wf–Wrr¢–b‚G&Wf–WræÆVæwF‚’G&Wf–WrÒB‚sÆF—b–CÒ&æ÷F–e66†VGVÆU&Wf–Wr#ãÂöF—câr’æVæEFò‚v&öG’r¢G&Wf–WræV×G’‚¢6öç7BFæf–vF–öâÒB‚sÆF—b6Æ73Ò&æ÷F–b×66†VGVÆRÖæf–vF–öâ#âr’æVæEFò‚G&Wf–Wr¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'Fâæ÷F–b×66†VGVÆRÖ&6²#âr’çFW‡B‚~(i&6²Fò7GVG’&VÖ–æFW'2r’æVæEFò‚Fæf–vF–öâ’æöâ‚v6Æ–6²rÂ‚’ÓâG&Wf–WræF–Æör‚v6Æ÷6Rr’¢6öç7BF6öçFVçBÒB‚sÆF—câr’æVæEFò‚G&Wf–Wr’æVæB‚B‚sÇ&öÆSÒ'7FGW2#âr’çFW‡B‚tÆöF–ær66†VGVÆ^(
br’¢G&Wf–WræF–Æör‡²F—FÆS¢tæ÷F–f–6F–öâ66†VGVÆRrÂF–Æöt6Æ73¢v7W—F÷"×æVÂ×v–æF÷rrÂv–GFƒ¢ÖF‚æÖ–âƒcƒÂB‡v–æF÷r’çv–GF‚‚’Ò3’ÂÖöFÃ¢G'VRÂWFô÷Vã¢G'VRÒ¢G&Wf–Wræ6Æ÷6W7B‚rçV’ÖF–Æörr’æf–æB‚rçV’ÖF–Æör×F—FÆV&"Ö6Æ÷6Rr’æV×G’‚’çFW‡B‚|9rr’æGG"‚v&–ÖÆ&VÂrÂt6Æ÷6Ræ÷F–f–6F–öâ66†VGVÆRr¢G'’°¢6öç7BFFÒv—Bæ÷F–e'2‚vvWE66†VGVÆU&Wf–WrrÂ²W‡FW&æÅö¶W“¢¶W’Ò¢F6öçFVçBæV×G’‚’æVæB‚B‚sÆƒ3âr’çFW‡B†FFææÖRÇÂu66†VGVÆRr’¢B‚sÇâr’çFW‡B‚t7W'&VçBÆâf÷"F†RæW‡BC‚†÷W'2âF–ÖW2W6RF†—2FWf–6^(	—2F–ÖW¦öæRæBÖ’&R&÷†–ÖFRâÆFW"&÷FF–öâæB–çG&öGV7F–öâF–ÖW2V"gFW"F†RæW‡BFVÆ—fW'’âr’æVæEFò‚F6öçFVçB¢–b†FFç7FGW2ÓÓÒwW6VBr’B‚sÇâr’çFW‡B‚uF†—2Æ—7B—2W6VBâæòæ÷F–f–6F–öç2&R66†VGVÆVBâr’æVæEFò‚F6öçFVçB¢6öç7B&÷w2ÒFFç&÷w2ÇÂµÐ¢–b‚&÷w2æÆVæwF‚’B‚sÇâr’çFW‡B‚tæò—FV×2–âF†—2Æ—7Bâr’æVæEFò‚F6öçFVçB¢VÇ6R°¢6öç7BGF&ÆRÒB‚sÇF&ÆR6Æ73Ò&æ÷F–b×66†VGVÆR×F&ÆR#âr’æVæEFò‚F6öçFVçB¢B‚sÇF†VCãÇG#ãÇFƒä—FVÒçVÖ&W#Â÷FƒãÇFƒä—FVÓÂ÷FƒãÇFƒåv†VãÂ÷FƒãÇFƒå7FGW3Â÷FƒãÂ÷G#ãÂ÷F†VCâr’æVæEFò‚GF&ÆR¢6öç7BF&öG’ÒB‚sÇF&öG“âr’æVæEFò‚GF&ÆR¢&÷w2æf÷$V6‚‡&÷rÓâ°¢6öç7BG&÷rÒB‚sÇG#âr’æVæEFò‚F&öG’¢B‚sÇFCâr’çFW‡B‡&÷ræ—FVÕöçVÖ&W"’æVæEFò‚G&÷r¢B‚sÇFCâr’çFW‡B‡&÷rçF—FÆR’æVæEFò‚G&÷r¢B‚sÇFCâr’çFW‡B‡&÷rçv†Våö×2òæWrFFR‡&÷rçv†Våö×2’çFôÆö6ÆU7G&–ær‚’ ¢&÷rç7FFRÓÓÒt÷WG6–FRF†RæW‡BC‚†÷W'2rbb&÷rææW‡EöGVUöBòæWrFFR‡&÷rææW‡EöGVUöB’çFôÆö6ÆU7G&–ær‚’¢~(	Br’æVæEFò‚G&÷r¢B‚sÇFCâr’çFW‡B‡&÷rç7FFR’æVæEFò‚G&÷r¢Ò¢–b†FFæ—FVÕö6÷VçBâ&÷w2æÆVæwF‚’B‚sÇâr’çFW‡B†6†÷v–ærG·&÷w2æÆVæwF‡ÒöbG¶FFæ—FVÕö6÷VçGÒ—FV×2æ’æVæEFò‚F6öçFVçB¢Ð¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'Fâ#âr’çFW‡B‚u&Vg&W6‚66†VGVÆRr’æVæEFò‚F6öçFVçB’æöâ‚v6Æ–6²rÂ‚’Óâöæ÷F–e6†÷u66†VGVÆR†¶W’’¢Ò6F6‚†W'&÷"’°¢F6öçFVçBæV×G’‚’æVæB‚B‚sÇ&öÆSÒ'7FGW2#âr’çFW‡B†W'&÷"æÖW76vRÓÓÒwVæ¶æ÷våö÷rÇÂW'&÷"æÖW76vRÓÓÒwVç7W÷'FVBp¢òuWFFRF†R7W—F÷"Fòf–WrF†Ræ÷F–f–6F–öâ66†VGVÆRâr¢t6÷VÆBæ÷BÆöB66†VGVÆS¢r²W'&÷"æÖW76vR’¢Ð¢B‡v–æF÷r’çG&–vvW"‚w&W6—¦Rr§Ð ¢òòW6‚&÷rw2gVÆÂ66†VGVÆ–ær†Ö–â²÷F–öæÂ–çG&ò’âöÖ—GF–ærF†R–çG&ò¶W¢òò6ÆV'2ç’W†—7F–ær–çG&òÂW"F†R6öçG&7Bw26WE66†VGVÆR6VÖçF–72à¦gVæ7F–öâöæ÷F–dÇ•&÷u66†VGVÆR‚G&÷r’°¢6öç7B¶W’ÒG&÷ræFF‚v¶W’r¢6öç7B66†VGVÆT¶W’ÒG&÷ræf–æB‚rææ÷F–b×66†VBr’çfÂ‚¢6öç7B–çG&ô¶W’ÒG&÷ræf–æB‚rææ÷F–bÖ–çG&òr’çfÂ‚¢6öç7B–ÆöBÒ²W‡FW&æÅö¶W“¢¶W’Â66†VGVÆUö¶W“¢66†VGVÆT¶W’Ð¢–b†–çG&ô¶W’bböæ÷F–e66†VGVÆT¶–æB‡66†VGVÆT¶W’’ÓÓÒw6W&–W2r’–ÆöBæ–çG&õ÷66†VGVÆUö¶W’Ò–çG&ô¶W¢æ÷F–e'2‚w6WE66†VGVÆRrÂ–ÆöB’æ6F6‚†W'"ÓâÆW'B‚t6÷VÆBæ÷B6†ævR66†VGVÆS¢r²†W'"æÖW76vRÇÂW'"’’§Ð ¢òòFV'Vrö'&÷w6W"W66R†F6ƒ¢&WfVÂF†RfVGW&Rv—F†÷WBF†R'&–FvRÂf÷ ¢òòFW7F–ærF†RF–Æör²F(i&F—7Æ’F‚â6WBÆö6Å7F÷&vRææ÷F–dFV'VsÒsr÷"F@¢òòöæ÷F–fFV'VsÓFòF†RU$Âà¦gVæ7F–öâöæ÷F–dFV'Vr‚’°¢G'’²&WGW&âÆö6Å7F÷&vRævWD—FVÒ‚væ÷F–dFV'Vrr’ÓÓÒsrÇÂõ³òeÖæ÷F–fFV'VsÓƒó¢gÂB’òçFW7B‡v–æF÷ræÆö6F–öâç6V&6‚’Ð¢6F6‚…ò’²&WGW&âfÇ6RÐ§Ð ¦7–æ2gVæ7F–öâöæ÷F–d&ö÷D6&–Æ—F–W2‚’°¢6öç7BGVç2ÒB‚r6æ÷F–eVç7W÷'FVBr’ÂGW&ÒÒB‚r6æ÷F–eW&Õ&÷rr’ÂF&öG’ÒB‚r6æ÷F–d&öG’r¢–b‚ö†fTæ÷F–d'&–FvR‚’’°¢–b‚öæ÷F–dFV'Vr‚’’²GVç2ç6†÷r‚“²GW&Òæ†–FR‚“²F&öG’æ†–FR‚“²&WGW&âÐ¢òò'&÷w6W"&Wf–Ws¢6†÷rF†RT’v—F‚7GV"66†VGVÆRÖVçS²Væ&ÆRv–ÆÂ&W÷'@¢òòæòÖ'&–FvR‡&VÂ66†VGVÆ–æræVVG2F†R7W—F÷"’à¢GVç2æ†–FR‚“²GW&Òæ†–FR‚“²F&öG’ç6†÷r‚¢B‚r6æ÷F–dVæ&ÆU7FGW2r’çFW‡B‚u&Wf–Wr(	BVæ&Æ–æræVVG2F†R7W—F÷"r’æ772‚v6öÆ÷"rÂr6cr¢–b‚öæ÷F–e66†VGVÆW2‚’æÆVæwF‚’°¢v–æF÷råõö7W—F÷$æ÷F–e66†VGVÆW2Ò²fW'6–öã¢Â66†VGVÆW3¢°¢²¶W“¢vV&&–æv†W2rÂæÖS¢tV&&–æv†W2Öæ6†÷&VBrÂ¶–æC¢w6W&–W2rÒÀ¢²¶W“¢vF–Ç•ó“rÂæÖS¢tF–Ç’“£rÂ¶–æC¢w&V7W'&–ærrÒÀ¢ÒÐ¢öæ÷F–e÷VÆFU66†VGVÆW2‚¢Ð¢&WGW&à¢Ð¢ÆWB62ÒçVÆÀ¢G'’²62Òv—Bæ÷F–e'2‚vvWD6&–Æ—F–W2r’Ò6F6‚…ò’·Ð¢–b‚62ÇÂ62ç7W÷'FVBÓÓÒfÇ6R’²GVç2ç6†÷r‚“²GW&Òæ†–FR‚“²F&öG’æ†–FR‚“²&WGW&âÐ¢GVç2æ†–FR‚¢–b†62çW&Ö—76–öâÓÒvw&çFVBr’²GW&Òç6†÷r‚“²F&öG’æ†–FR‚’Ð¢VÇ6R²GW&Òæ†–FR‚“²F&öG’ç6†÷r‚’Ð§Ð ¦gVæ7F–öâö÷Väæ÷F–dF–Æör‚’°¢ÆWBFBÒB‚r6æ÷F–dF–Æörr¢–b‚FBæÆVæwF‚’FBÒB‚sÆF—b–CÒ&æ÷F–dF–Æör#ãÂöF—câr’æVæEFò‚v&öG’r¢FBæ‡FÖÂ† ¢ÆF—b–CÒ&æ÷F–eVç7W÷'FVB"7G–ÆSÒ&F—7Æ“¦æöæS¶6öÆ÷#¢6¶föçB×6—¦S£7ƒ²#äæ÷F–f–6F–öç2&VâwBf–Æ&ÆRöâF†—2FWf–6RãÂöF—cà¢ÆF—b–CÒ&æ÷F–eW&Õ&÷r"7G–ÆSÒ&F—7Æ“¦æöæS¶Ö&v–âÖ&÷GFöÓ£ƒ²#à¢Ç7â7G–ÆSÒ&föçB×6—¦S£7ƒ¶6öÆ÷#¢6c²#äæ÷F–f–6F–öç2æVVBW&Ö—76–öâf—'7BãÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ&æ÷F–eW&Ô'Fâ"6Æ73Ò&'Fâ"7G–ÆSÒ&Ö&v–âÖÆVgC£gƒ²#äVæ&ÆRæ÷F–f–6F–öç3Âö'WGFöãà¢ÂöF—cà¢ÆF—b–CÒ&æ÷F–d&öG’"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢ÆF—b6Æ73Ò&ÖVR×&÷r#ãÆÆ&VÂ6Æ73Ò&ÖVRÖÆ&Â#åÆ–Æ—7CÂöÆ&VÃà¢Ç6VÆV7B–CÒ&æ÷F–eÆ–Æ—7B"7G–ÆSÒ'v–GFƒ£S²#ãÂ÷6VÆV7CãÂöF—cà¢ÆF—b6Æ73Ò&ÖVR×&÷r#ãÆÆ&VÂ6Æ73Ò&ÖVRÖÆ&Â#å66†VGVÆSÂöÆ&VÃà¢Ç6VÆV7B–CÒ&æ÷F–e66†VGVÆR"7G–ÆSÒ'v–GFƒ£S²#ãÂ÷6VÆV7CãÂöF—cà¢ÆF—b6Æ73Ò&ÖVR×&÷r"–CÒ&æ÷F–d–çG&õ&÷r#ãÆÆ&VÂ6Æ73Ò&ÖVRÖÆ&Â#ä–çG&öGV6SÂöÆ&VÃà¢Ç6VÆV7B–CÒ&æ÷F–d–çG&õ66†VGVÆR"7G–ÆSÒ'v–GFƒ£S²#ãÂ÷6VÆV7CãÂöF—cà¢ÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢3ƒƒƒ¶Ö&v–ã¢ÓG‚Gƒ²#ä÷F–öæÃ¢G&—æWr—FV×2–âöâ&V7W'&–ær6FVæ6R†æVVG26W&–W266†VGVÆR&÷fR’ãÂöF—cà¢ÆF—b7G–ÆSÒ&Ö&v–â×F÷£‡ƒ²#à¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ&æ÷F–dVæ&ÆT'Fâ"6Æ73Ò&'Fâ#äVæ&ÆRf÷"F†—2Æ–Æ—7CÂö'WGFöãà¢Ç7â–CÒ&æ÷F–dVæ&ÆU7FGW2"7G–ÆSÒ&föçB×6—¦S£'ƒ¶Ö&v–âÖÆVgC£gƒ²#ãÂ÷7ãà¢ÂöF—cà¢ÆF—b7G–ÆSÒ&Ö&v–â×F÷£Gƒ¶&÷&FW"×F÷£‚6öÆ–B6VVS·FF–ær×F÷£‡ƒ²#à¢ÆF—b7G–ÆSÒ&föçB×vV–v‡C¦&öÆC¶föçB×6—¦S£7ƒ¶Ö&v–âÖ&÷GFöÓ£gƒ²#äVæ&ÆVBæ÷F–f–6F–öç3ÂöF—cà¢ÆF—b–CÒ&æ÷F–dVæ&ÆVDÆ—7B#ãÆF—b7G–ÆSÒ&6öÆ÷#¢3ƒƒƒ¶föçB×6—¦S£'ƒ²#äæöæR–WBãÂöF—cãÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ ¢òòÆ–Æ—7B6VÆV7C"(	B&VÂ†æöâ×f—'GVÂ’Æ–Æ—7G2à¢6öç7BGÂÒFBæf–æB‚r6æ÷F–eÆ–Æ—7Br¢6öç7B÷væW"Òö÷væW$Æ&VÆÆW"‚¢Æ—7E&V6÷&F–æw2‚’æf–ÇFW"†âÓâö—5f—'GVÂ†â’’æf÷$V6‚†âÓâ°¢GÂæVæB†Æ÷F–öâfÇVSÒ"GµòæW66R†â—Ò#âGµòæW66R†÷væW"ç&Vf—‚†âÂv–æF÷rå÷&V6÷&F–æw5¶åÒ’—Ò‚Gµ÷&V6÷&F–æt—FVÔ6÷VçD'”æÖR†â—Ò“Âö÷F–öãæ¢Ò¢6öç7B7W$æÖRÒv–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢–b†7W$æÖRbbö—5f—'GVÂ†7W$æÖR’’GÂçfÂ†7W$æÖR ¢öæ÷F–e÷VÆFU66†VGVÆW2‚¢öæ÷F–e&VæFW$Væ&ÆVB‚ ¢òò6²f÷"g&W6‚7FFR‡v&Ò×W6‚Ö’&VFFRF†RF–Æör“²†æFÆW'2&R×&VæFW"à¢æ÷F–e'2‚vvWE66†VGVÆW2r’æ6F6‚‚‚’Óâ·Ò¢æ÷F–e'2‚vvWDÆ—7G2r’æ6F6‚‚‚’Óâ·Ò ¢FBæöfb‚v6Æ–6²rÂr6æ÷F–eW&Ô'Fâr’æöâ‚v6Æ–6²rÂr6æ÷F–eW&Ô'FârÂ7–æ2‚’Óâ°¢G'’²v—Bæ÷F–e'2‚w&WVW7EW&Ö—76–öâr’Ò6F6‚…ò’·Ð¢öæ÷F–d&ö÷D6&–Æ—F–W2‚¢Ò¢FBæöfb‚v6†ævRrÂr6æ÷F–e66†VGVÆRr’æöâ‚v6†ævRrÂr6æ÷F–e66†VGVÆRrÂöæ÷F–e7–æ4–çG&ôf–Æ&–Æ—G’¢FBæöfb‚v6Æ–6²rÂr6æ÷F–dVæ&ÆT'Fâr’æöâ‚v6Æ–6²rÂr6æ÷F–dVæ&ÆT'FârÂ‚’Óâ°¢6öç7BæÖRÒGÂçfÂ‚¢6öç7B66†VBÒFBæf–æB‚r6æ÷F–e66†VGVÆRr’çfÂ‚¢6öç7B–çG&òÒFBæf–æB‚r6æ÷F–d–çG&õ66†VGVÆRr’çfÂ‚¢–b‚æÖR’²ÆW'B‚t6†ö÷6RÆ–Æ—7Bâr“²&WGW&âÐ¢–b‚66†VB’²ÆW'B‚t6†ö÷6R66†VGVÆRâr“²&WGW&âÐ¢öæ÷F–dVæ&ÆUÆ–Æ—7B†æÖRÂ66†VBÂ–çG&òÇÂçVÆÂ¢Ò¢òò6†æv–ærV—F†W"F†R66†VGVÆR÷"F†R–çG&ò6FVæ6RW6†W2F†R&÷rw2gVÆÀ¢òò66†VGVÆ–ærâ7v—F6†–ærF†RÖ–âFò&V7W'&–ær66†VGVÆR6ÆV'2F†R–çG&ð¢òò†&Eö–çG&ò÷F†W'v—6R’à¢FBæöfb‚v6†ævRrÂrææ÷F–b×66†VBr’æöâ‚v6†ævRrÂrææ÷F–b×66†VBrÂgVæ7F–öâ‚’°¢6öç7BG&÷rÒB‡F†—2’æ6Æ÷6W7B‚rææ÷F–b×&÷rr¢6öç7B—56W&–W2Òöæ÷F–e66†VGVÆT¶–æB‚B‡F†—2’çfÂ‚’’ÓÓÒw6W&–W2p¢6öç7BF–çG&òÒG&÷ræf–æB‚rææ÷F–bÖ–çG&òr¢F–çG&òç&÷‚vF—6&ÆVBrÂ—56W&–W2¢–b‚—56W&–W2’F–çG&òçfÂ‚rr¢öæ÷F–dÇ•&÷u66†VGVÆR‚G&÷r¢Ò¢FBæöfb‚v6†ævRrÂrææ÷F–bÖ–çG&òr’æöâ‚v6†ævRrÂrææ÷F–bÖ–çG&òrÂgVæ7F–öâ‚’°¢öæ÷F–dÇ•&÷u66†VGVÆR‚B‡F†—2’æ6Æ÷6W7B‚rææ÷F–b×&÷rr’¢Ò¢FBæöfb‚v6Æ–6²rÂrææ÷F–b×f–Wr×66†VGVÆRr’æöâ‚v6Æ–6²rÂrææ÷F–b×f–Wr×66†VGVÆRrÂgVæ7F–öâ‚’°¢öæ÷F–e6†÷u66†VGVÆR‚B‡F†—2’æ6Æ÷6W7B‚rææ÷F–b×&÷rr’æFF‚v¶W’r’¢Ò¢FBæöfb‚v6Æ–6²rÂrææ÷F–b×FövvÆRr’æöâ‚v6Æ–6²rÂrææ÷F–b×FövvÆRrÂgVæ7F–öâ‚’°¢6öç7BG&÷rÒB‡F†—2’æ6Æ÷6W7B‚rææ÷F–b×&÷rr¢6öç7B¶W’ÒG&÷ræFF‚v¶W’r¢6öç7BÆ—7BÒ÷vV'vTæ÷F–dÆ—7G2…öæ÷F–dÆ—7G2‚’’æf–æB†ÂÓâÂæW‡FW&æÅö¶W’ÓÓÒ¶W’¢6öç7BæW‡BÒ†Æ—7BbbÆ—7Bç7FGW2ÓÓÒwW6VBr’òv7F—fRr¢wW6VBp¢æ÷F–e'2‚w6WE7FGW2rÂ²W‡FW&æÅö¶W“¢¶W’Â7FGW3¢æW‡BÒ’æ6F6‚†W'"ÓâÆW'B‚t6÷VÆBæ÷BWFFS¢r²†W'"æÖW76vRÇÂW'"’’¢Ò¢FBæöfb‚v6Æ–6²rÂrææ÷F–bÖF—6&ÆRr’æöâ‚v6Æ–6²rÂrææ÷F–bÖF—6&ÆRrÂgVæ7F–öâ‚’°¢6öç7B¶W’ÒB‡F†—2’æ6Æ÷6W7B‚rææ÷F–b×&÷rr’æFF‚v¶W’r¢–b‚6öæf—&Ò‚uGW&âöfbæ÷F–f–6F–öç2f÷"F†—2Æ–Æ—7Còr’’&WGW&à¢æ÷F–e'2‚vFVÆWFTÆ—7BrÂ²W‡FW&æÅö¶W“¢¶W’Ò’çF†Vâ‚‚’Óâ°¢6öç7BÂÒ÷Æ–Æ—7Df÷$æ÷F–d¶W’†¶W’¢–b‡Âbbv–æF÷rå÷&V6÷&F–æw5·ÅÒ’²FVÆWFRv–æF÷rå÷&V6÷&F–æw5·ÅÒææ÷F–d¶W“²÷6fU&V6÷&F–ær‚’Ð¢Ò’æ6F6‚†W'"ÓâÆW'B‚t6÷VÆBæ÷BF—6&ÆS¢r²†W'"æÖW76vRÇÂW'"’’¢Ò ¢FBæF–Æör‡°¢F—FÆS¢u7GVG’&VÖ–æFW'2(	Bæ÷F–f–6F–öç2rÀ¢F–Æöt6Æ73¢v7W—F÷"×æVÂ×v–æF÷rrÀ¢Ö„†V–v‡C¢ÖF‚æÖ‚ƒƒÂv–æF÷ræ–ææW$†V–v‡BÒC’À¢v–GFƒ¢ÖF‚æÖ–âƒCcÂB‡v–æF÷r’çv–GF‚‚’ÒC’À¢ÖöFÃ¢G'VRÀ¢WFô÷Vã¢G'VRÀ¢6Æ÷6S¢‚’Óâ²G'’²GÂç6VÆV7C"‚vFW7G&÷’r’Ò6F6‚…ò’·ÒÐ¢Ò¢FBæ6Æ÷6W7B‚rçV’ÖF–Æörr’æf–æB‚rçV’ÖF–Æör×F—FÆV&"Ö6Æ÷6Rr’æV×G’‚’çFW‡B‚|9rr’æGG"‚v&–ÖÆ&VÂrÂt6Æ÷6R7GVG’&VÖ–æFW'2r¢G'’²GÂç6VÆV7C"‡²v–GFƒ¢sRrÂG&÷F÷vå&VçC¢FBÂÖ–æ–×VÕ&W7VÇG4f÷%6V&6ƒ¢‚Ò’Ò6F6‚…ò’·Ð¢öæ÷F–d&ö÷D6&–Æ—F–W2‚’æf–æÆÇ’‚‚’ÓâB‡v–æF÷r’çG&–vvW"‚w&W6—¦Rr’§Ð§v–æF÷råö÷Väæ÷F–dF–ÆörÒö÷Väæ÷F–dF–Æöp¦–ç7FÆÅ7GVG”6ÆÇ2‡v–æF÷rÂB ¢òò'&÷w6W"FW7B†VÇW"†æòæ÷F–d'&–FvRæVVFVB“¢6–×VÆFRæ÷F–f–6F–öâFf÷ ¢òòÆ–Æ—7B—FVÒ'’F—7F6†–ærF†R&VÂ7W—F÷$æ÷F–f–6F–öä÷VæVBWfVçBÂ6ð¢òòF†R7GVÂÆ—7FVæW"(i"öF—7Æ”æ÷F–d—FVÒF‚'Vç2âW6vR–âF†R6öç6öÆS ¢òòöæ÷F–e6–×VÆFT÷Vâ‚’(i"7W'&VçBÆ–Æ—7BÂf—'7B—FVÐ¢òòöæ÷F–e6–×VÆFT÷Vâ‚t×’Æ—7BrÂ"ž(i"æÖVBÆ–Æ—7BÂ7&Bæ÷F–b—FVÐ§v–æF÷råöæ÷F–e6–×VÆFT÷VâÒgVæ7F–öâ‡Æ–Æ—7DæÖRÂ–æFW‚Ò’°¢6öç7BæÖRÒÆ–Æ—7DæÖRÇÂ‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR¢6öç7B—FV×2Òöæ÷F–d—FV×4f÷%Æ–Æ—7B†æÖR¢–b‚—FV×2ÇÂ—FV×2æÆVæwF‚’²6öç6öÆRçv&â‚u¶æ÷F–eÒæòæ÷F–f–&ÆR—FV×2–ârÂæÖR“²&WGW&âÐ¢6öç7B—BÒ—FV×5´ÖF‚æÖ‚ƒÂÖF‚æÖ–â†–æFW‚ÂÂ—FV×2æÆVæwF‚Ò’•Ð¢6öç6öÆRæÆör‚u¶æ÷F–eÒ6–×VÆFRF(i"rÂæÖRÂ|+rrÂ—BæW‡FW&æÅö–BÂ|+rrÂ¥4ôâç7G&–æv–g’†—B’¢v–æF÷ræF—7F6„WfVçB†æWr7W7FöÔWfVçB‚v7W—F÷$æ÷F–f–6F–öä÷VæVBrÂ°¢FWF–Ã¢°¢W‡FW&æÅö¶W“¢‡v–æF÷rå÷&V6÷&F–æw5¶æÖUÒÇÂ·Ò’ææ÷F–d¶W’ÇÂçVÆÂÀ¢—FVÕöW‡FW&æÅö–C¢—BæW‡FW&æÅö–BÀ¢–ÆöC¢²Ã¢æÖRÂ†–C¢—BæW‡FW&æÅö–BÒÀ¢ÒÀ¢Ò’§Ð ¢òò)H)Hæ÷F–f–6F–öâ&VÆÂ–æ&÷‚)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òò–÷UGV&R×7G–ÆR–æ&÷‚öb7GVG’&VÖ–æFW'2F†B†fRf—&VBÂG&—fVâ'’F†P¢òò6öçG&7Bw2æ÷F–f–6F–öâfVVB†vWDæ÷F–f–6F–öç2ò7W—F÷$æ÷F–dfVVB’âF†RfVV@¢òò—2fÆBÂæWvW7BÖf—'7B7G&VÒöbf—&RWfVçG3²F†Rv&Ò×W6†W2—BöâÆö@¢òòæB&R×W6†W2gFW"WfW'’7vVWÂ6òF†R&FvR7F—2Æ—fRv—F†÷WBöÆÆ–ærà¢òòVç&VBÒ&W7öæFVEöBÓÒçVÆÃ²F–ær&÷r÷Vç2F†R—FVÒ–â&7F–6Ræ@¢òò6·2—B†6´—FVÒ’ÂæBF†W&Rw2Ö&²ÖÆÂ×&VBà¦gVæ7F–öâöæ÷F–dfVVB‚’°¢6öç7BbÒv–æF÷råõö7W—F÷$æ÷F–dfVV@¢&WGW&â†bbb'&’æ—4'&’†bææ÷F–f–6F–öç2’’òbææ÷F–f–6F–öç2¢µÐ§Ð¦gVæ7F–öâöæ÷F–eVç&VD6÷VçB‚’°¢&WGW&âöæ÷F–dfVVB‚’ç&VGV6R‚†âÂR’Óââ²‚†RbbRç&W7öæFVEöBÓÒçVÆÂ’ò¢’Â§Ð¢òò6ö×7B&VÆF—fRF–ÖRf÷"f—&VEöBWö6‚Ö×2(	B&æ÷r"Â#VÒ"Â#6‚"Â#&B"Â÷"¢òòFFRf÷"ç—F†–æröÆFW"F†âvVV²à¦gVæ7F–öâöæ÷F–e&VÅF–ÖR†×2’°¢–b‚×2’&WGW&ârp¢6öç7B2ÒÖF‚æÖ‚ƒÂÖF‚æfÆö÷"‚„FFRææ÷r‚’Ò×2’ò’¢–b‡2ÂCR’&WGW&âvæ÷rp¢–b‡2Â3c’&WGW&âÖF‚ç&÷VæB‡2òc’²vÒp¢–b‡2ÂƒcC’&WGW&âÖF‚ç&÷VæB‡2ò3c’²v‚p¢–b‡2ÂcCƒ’&WGW&âÖF‚ç&÷VæB‡2òƒcC’²vBp¢G'’²&WGW&âæWrFFR†×2’çFôÆö6ÆTFFU7G&–ær‚’Ò6F6‚…ò’²&WGW&ârrÐ§Ð¢òò&FvR²'WGFöâf—6–&–Æ—G’â&VÆÂ6†÷w2v†VæWfW"F†RfVGW&R—2f–Æ&ÆRà¦gVæ7F–öâöæ÷F–eWFFT&VÆÂ‚’°¢6öç7BöâÒö†fTæ÷F–d'&–FvR‚’ÇÂöæ÷F–dFV'Vr‚¢B‚r6æ÷F–d&VÆÅw&r’çFövvÆR‚öâ¢–b‚öâ’&WGW&à¢6öç7BâÒöæ÷F–eVç&VD6÷VçB‚¢B‚r6æ÷F–d&VÆÄ&FvRr’çFW‡B†ââ“’òs“’²r¢7G&–ær†â’’çFövvÆR†ââ§Ð¦gVæ7F–öâöæ÷F–e&VæFW$fVVB‚’°¢6öç7BGæVÂÒB‚r6æ÷F–d&VÆÅæVÂr¢–b‚GæVÂæÆVæwF‚’&WGW&à¢6öç7BfVVBÒöæ÷F–dfVVB‚’ç6Æ–6R‚’ç6÷'B‚†Â"’Óâ†"æf—&VEöBÇÂ’Ò†æf—&VEöBÇÂ’¢6öç7BVç&VBÒöæ÷F–eVç&VD6÷VçB‚¢ÆWB‡FÖÂÒÆF—b6Æ73Ò&æ÷F–bÖ&VÆÂÖ†B#ãÇ7ãäæ÷F–f–6F–öç3Â÷7ãæ ¢²Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&æ÷F–bÖ&VÆÂ×&VFÆÂ"G·Vç&VBòrr¢rF—6&ÆVBwÓäÖ&²ÆÂ&VCÂö'WGFöããÂöF—cæ ¢–b‚fVVBæÆVæwF‚’°¢‡FÖÂ³ÒÆF—b6Æ73Ò&æ÷F–bÖ&VÆÂÖV×G’#äæò&VÖ–æFW'2–WBãÂöF—cæ ¢ÒVÇ6R°¢‡FÖÂ³ÒfVVBæÖ†RÓâ°¢6öç7B—5Vç&VBÒRç&W7öæFVEöBÓÒçVÆÀ¢òòöæÇ’vV'vRÖ÷væVBÆ—7G2‡v—F‚âW‡FW&æÅö¶W’’6â&R÷VæVBö6¶VC°¢òòÖWF†÷&VBVçG&–W2&RF—7Æ’ÖöæÇ’à¢6öç7B÷Væ&ÆRÒ†RæW‡FW&æÅö¶W’bbRæ—FVÕöW‡FW&æÅö–B¢6öç7BÖ—76VBÒRç6÷W&6RÓÓÒvWFòp¢6öç7BÖWFÒµòæW66R†RæÆ—7EöæÖRÇÂrr’Âöæ÷F–e&VÅF–ÖR†Ræf—&VEöB’ÂÖ—76VBòsÇ7â6Æ73Ò&æ÷F–bÖ&VÆÂÖÖ—76VB#æÖ—76VCÂ÷7ãâr¢ruÐ¢æf–ÇFW"„&ööÆVâ’æ¦ö–â‚r+rr¢&WGW&âÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&æ÷F–bÖ&VÆÂ×&÷rG¶—5Vç&VBòrVç&VBr¢rwÒ& ¢²FFÖ÷VãÒ"G¶÷Væ&ÆRò¢Ò"FFÖ¶W“Ò"GµòæW66R†RæW‡FW&æÅö¶W’ÇÂrr—Ò& ¢²FF×†–CÒ"GµòæW66R†Ræ—FVÕöW‡FW&æÅö–BÇÂrr—Ò#æ ¢²Ç7â6Æ73Ò&æ÷F–bÖ&VÆÂÖF÷B#ãÂ÷7ããÇ7â6Æ73Ò&æ÷F–bÖ&VÆÂÖÖ–â#æ ¢²Ç7â6Æ73Ò&æ÷F–bÖ&VÆÂ×F—FÆR#âGµòæW66R†RçF—FÆRÇÂr‡VçF—FÆVB’r—ÓÂ÷7ãæ ¢²†Ræ&öG’òÇ7â6Æ73Ò&æ÷F–bÖ&VÆÂÖ&öG’#âGµòæW66R†Ræ&öG’—ÓÂ÷7ãæ¢rr¢²Ç7â6Æ73Ò&æ÷F–bÖ&VÆÂÖÖWF#âG¶ÖWFÓÂ÷7ããÂ÷7ããÂö'WGFöãæ ¢Ò’æ¦ö–â‚rr¢Ð¢GæVÂæ‡FÖÂ†‡FÖÂ§Ð¦gVæ7F–öâöæ÷F–d6Æ÷6T&VÆÂ‚’²B‚r6æ÷F–d&VÆÅæVÂr’æ†–FR‚’Ð¢òòæ6†÷"F†Rf—†VBæVÂVæFW"F†R&VÆÂÂ&–v‡BÖÆ–væVBFò—BÂ6Æ×VBFòF†P¢òòf–Ww÷'Bâ6ÆÆVBöâ÷VâæBöâ&W6—¦Rv†–ÆR÷Vâà¦gVæ7F–öâ÷÷6—F–öä&VÆÅæVÂ‚’°¢6öç7B'FâÒFö7VÖVçBævWDVÆVÖVçD'”–B‚væ÷F–d&VÆÄ'Fâr¢6öç7BGæVÂÒB‚r6æ÷F–d&VÆÅæVÂr¢–b‚'FâÇÂGæVÂæÆVæwF‚ÇÂGæVÂæ—2‚s§f—6–&ÆRr’’&WGW&à¢6öç7B"Ò'FâævWD&÷VæF–æt6Æ–VçE&V7B‚¢6öç7BgrÒv–æF÷ræ–ææW%v–GF€¢6öç7BrÒÖF‚æÖ–âƒ3CÂÖF‚æfÆö÷"‡gr¢ã’’¢ÆWBÆVgBÒ"ç&–v‡BÒp¢–b†ÆVgB²râgrÒ‚’ÆVgBÒgrÒ‚Òp¢–b†ÆVgBÂ‚’ÆVgBÒ€¢òò6†V–v‡BFòF†R76R&VÆ÷rF†R&VÆÂ6òÆöærfVVB67&öÆÇ2–ç6–FRF†P¢òòæVÂ–ç7FVBöb'Vææ–æröfb×67&VVâ††VFW"7F—27F–6·’’à¢6öç7BÖ„‚ÒÖF‚æÖ‚ƒcÂv–æF÷ræ–ææW$†V–v‡BÒ"æ&÷GFöÒÒ"¢GæVÂæ772‡²ÆVgC¢ÆVgB²w‚rÂF÷¢‡"æ&÷GFöÒ²B’²w‚rÂÖ„†V–v‡C¢Ö„‚²w‚rÒ§Ð¦gVæ7F–öâ÷FövvÆTæ÷F–d&VÆÂ‚’°¢6öç7BGæVÂÒB‚r6æ÷F–d&VÆÅæVÂr¢–b‚GæVÂæ—2‚s§f—6–&ÆRr’’²GæVÂæ†–FR‚“²&WGW&âÐ¢òò&W&VçBFòÆ&öG“âöæ6R6òæò6Æ—–ær÷7F6¶–ærFööÆ&"æ6W7F÷"7V6†W2—Bà¢–b‚GæVÂç&VçB‚•³ÒÓÒFö7VÖVçBæ&öG’’GæVÂæVæEFò†Fö7VÖVçBæ&öG’¢öæ÷F–e&VæFW$fVVB‚¢GæVÂç6†÷r‚¢÷÷6—F–öä&VÆÅæVÂ‚¢òòVÆÂF†Rg&W6†W7BfVVBöâ÷Vâ‡v&Ò×W6‚Ö’&VFFRF†—2“²F†RÆ—7FVæW ¢òò&R×&VæFW'2v†Vâ—BÆæG2à¢–b…ö†fTæ÷F–d'&–FvR‚’’æ÷F–e'2‚vvWDæ÷F–f–6F–öç2rÂ²Æ–Ö—C¢#Ò’æ6F6‚‚‚’Óâ·Ò§Ð¢òò÷F–Ö—7F–6ÆÇ’7F×&W7öæFVEöB6òF†R&FvR÷&÷rWFFR–ç7FçFÇ’ÂF†VâÆW@¢òòF†RæW‡BfVVBW6‚&V6öæ6–ÆRà¦gVæ7F–öâöæ÷F–dÖ&µ&VDÆö6Â‡&VB’°¢6öç7BfVVBÒöæ÷F–dfVVB‚¢ÆWB6†ævVBÒfÇ6P¢fVVBæf÷$V6‚†RÓâ²–b†RbbRç&W7öæFVEöBÓÒçVÆÂbb&VB†R’’²Rç&W7öæFVEöBÒFFRææ÷r‚“²6†ævVBÒG'VRÒÒ¢–b†6†ævVB’²öæ÷F–eWFFT&VÆÂ‚“²–b‚B‚r6æ÷F–d&VÆÅæVÂr’æ—2‚s§f—6–&ÆRr’’öæ÷F–e&VæFW$fVVB‚’Ð§Ð¦gVæ7F–öâöæ÷F–d6´—FVÒ†¶W’Â†–B’°¢–b‚¶W’ÇÂ†–B’&WGW&à¢òò÷F–Ö—7F–2Æö6ÂÖ&²×&VBf—'7BÂ6òF†RT’WFFW2–ç7FçFÇ’(	BæB6ò—@¢òò7F–ÆÂv÷&·2–â'&÷w6W"†æò'&–FvR’f÷"FW7F–ærâF†R%2öæÇ’vöW2÷W@¢òòv†VâF†R'&–FvR—2&W6VçBà¢öæ÷F–dÖ&µ&VDÆö6Â†RÓâRæW‡FW&æÅö¶W’ÓÓÒ¶W’bbRæ—FVÕöW‡FW&æÅö–BÓÓÒ†–B¢–b‚ö†fTæ÷F–d'&–FvR‚’’&WGW&à¢æ÷F–e'2‚v6´—FVÒrÂ²W‡FW&æÅö¶W“¢¶W’Â—FVÕöW‡FW&æÅö–C¢†–BÒ¢çF†Vâ‚‚’Óâæ÷F–e'2‚vvWDæ÷F–f–6F–öç2rÂ²Æ–Ö—C¢#Ò’¢æ6F6‚‚‚’Óâ·Ò§Ð ¢òòF†R76–vç2v–æF÷råõö7W—F÷$æ÷F–dfVVB&Vf÷&RF—7F6‚Â6òÆFRÆ—7FVæW'0¢òò&VB7W'&VçB7FFS²&Vg&W6‚F†R&FvRæBç’÷VâæVÂöâWfW'’W6‚à§v–æF÷ræFDWfVçDÆ—7FVæW"‚v7W—F÷$æ÷F–dfVVBrÂ‚’Óâ°¢öæ÷F–eWFFT&VÆÂ‚¢–b‚B‚r6æ÷F–d&VÆÅæVÂr’æ—2‚s§f—6–&ÆRr’’öæ÷F–e&VæFW$fVVB‚§Ò ¢B†gVæ7F–öâ‚’°¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr6æ÷F–d&VÆÄ'FârÂgVæ7F–öâ†R’²Rç7F÷&÷vF–öâ‚“²÷FövvÆTæ÷F–d&VÆÂ‚’Ò¢òò÷WG6–FRÖ6Æ–6²6Æ÷6W2F†RæVÂâF†RæVÂ—2&W&VçFVBFòÆ&öG“âÂ6òG&V@¢òò&÷F‚F†R&VÆÂw&æBF†RæVÂ—G6VÆb2&–ç6–FR"à¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂgVæ7F–öâ†R’°¢–b‚B†RçF&vWB’æ6Æ÷6W7B‚r6æ÷F–d&VÆÅw&Â6æ÷F–d&VÆÅæVÂr’æÆVæwF‚’öæ÷F–d6Æ÷6T&VÆÂ‚¢Ò¢B‡v–æF÷r’æöâ‚w&W6—¦RrÂ÷÷6—F–öä&VÆÅæVÂ¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂrææ÷F–bÖ&VÆÂ×&VFÆÂrÂgVæ7F–öâ†R’°¢Rç7F÷&÷vF–öâ‚¢òò6²WfW'’Vç&VBvV'vRÖ÷væVB—FVÓ²ÖWF†÷&VBöæW26âwB&R6¶VBà¢6öç7BF&vWG2Òöæ÷F–dfVVB‚’æf–ÇFW"‡‚Óâ‚bb‚ç&W7öæFVEöBÓÒçVÆÂbb‚æW‡FW&æÅö¶W’bb‚æ—FVÕöW‡FW&æÅö–B¢6öç7B6VVâÒæWr6WB‚¢F&vWG2æf÷$V6‚‡‚Óâ°¢6öç7B²Ò‚æW‡FW&æÅö¶W’²uÇSr²‚æ—FVÕöW‡FW&æÅö–@¢–b‡6VVâæ†2†²’’&WGW&à¢6VVâæFB†²¢öæ÷F–d6´—FVÒ‡‚æW‡FW&æÅö¶W’Â‚æ—FVÕöW‡FW&æÅö–B¢Ò¢Ò¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂrææ÷F–bÖ&VÆÂ×&÷rrÂgVæ7F–öâ†R’°¢Rç7F÷&÷vF–öâ‚¢6öç7BG&÷rÒB‡F†—2¢–b‚G&÷ræGG"‚vFFÖ÷Vâr’ÓÒsr’&WGW&à¢6öç7B¶W’ÒG&÷ræGG"‚vFFÖ¶W’r’Â†–BÒG&÷ræGG"‚vFF×†–Br¢öæ÷F–d6Æ÷6T&VÆÂ‚¢6öç7BÂÒ÷Æ–Æ—7Df÷$æ÷F–d¶W’†¶W’¢–b‡Â’öæ÷F–d÷Våv†Vå&VG’‡ÂÂ†–B¢VÇ6R6öç6öÆRçv&â‚u¶æ÷F–eÒ–æ&÷‚&÷s¢æòÆ–Æ—7Bf÷"¶W’rÂ¶W’¢Ò§Ò ¢òò'&÷w6W"FW7B†VÇW"†æòæ÷F–d'&–FvR“¢6VVB6×ÆRfVVBæB&Vg&W6‚F†R&VÆÂà¢òòöæ÷F–e6–×VÆFTfVVB‚’(i"F‡&VR6×ÆRf—&W2ÂöæRVç&VB²öæR&Ö—76VB §v–æF÷råöæ÷F–e6–×VÆFTfVVBÒgVæ7F–öâ†Æ—7B’°¢6öç7Bæ÷rÒFFRææ÷r‚¢v–æF÷råõö7W—F÷$æ÷F–dfVVBÒ²fW'6–öã¢Âæ÷F–f–6F–öç3¢Æ—7BÇÂ°¢²W‡FW&æÅö¶W“¢w&V6Æ—7BÖFVÖòrÂÆ—7EöæÖS¢tFVÖòÆ–Æ—7BrÂ—FVÕöW‡FW&æÅö–C¢ws¦†V§Æ†V¢rÀ¢F—FÆS¢v†V¢rÂ&öG“¢v†VÆÆòrÂ7FW¢Â—FVÕ÷7FGW3¢v7F—fRrÂf—&VEöC¢æ÷rÒcÀ¢&W7öæFVEöC¢çVÆÂÂw&FS¢çVÆÂÂ6÷W&6S¢çVÆÂÒÀ¢²W‡FW&æÅö¶W“¢w&V6Æ—7BÖFVÖòrÂÆ—7EöæÖS¢tFVÖòÆ–Æ—7BrÂ—FVÕöW‡FW&æÅö–C¢ws§F6·ÇF6²rÀ¢F—FÆS¢wF6²rÂ&öG“¢wF†æ·2rÂ7FW¢Â—FVÕ÷7FGW3¢v7F—fRrÂf—&VEöC¢æ÷rÒ2¢3c¢À¢&W7öæFVEöC¢çVÆÂÂw&FS¢çVÆÂÂ6÷W&6S¢vWFòrÒÀ¢²W‡FW&æÅö¶W“¢w&V6Æ—7BÖFVÖòrÂÆ—7EöæÖS¢tFVÖòÆ–Æ—7BrÂ—FVÕöW‡FW&æÅö–C¢v6&C¦ÓrÀ¢F—FÆS¢vvöBÖ÷&vöârÂ&öG“¢vvööBÖ÷&æ–ærrÂ7FW¢"Â—FVÕ÷7FGW3¢v7F—fRrÂf—&VEöC¢æ÷rÒ"¢ƒcC¢À¢&W7öæFVEöC¢æ÷rÒƒcC¢Âw&FS¢2Â6÷W&6S¢wvV'vRrÒÀ¢ÒÐ¢öæ÷F–eWFFT&VÆÂ‚¢–b‚B‚r6æ÷F–d&VÆÅæVÂr’æ—2‚s§f—6–&ÆRr’’öæ÷F–e&VæFW$fVVB‚§Ð ¢òò7W&f6RF†R6WGF–æw2'WGFöâ–ç6–FRF†R7W—F÷"‡v†W&Ræ÷F–d'&–FvR—0¢òò–æ¦V7FVB’Â÷"–â'&÷w6W"v†VâF†Ræ÷F–dFV'VrfÆr—26WBf÷"FW7F–ærà¢B†gVæ7F–öâ‚’°¢–b…ö†fTæ÷F–d'&–FvR‚’ÇÂöæ÷F–dFV'Vr‚’’B‚r6æ÷F–e6WGF–æw4'Fâr’ç6†÷r‚¢öæ÷F–eWFFT&VÆÂ‚¢òò&–ÖRF†R–æ&÷ƒ¢&WVW7BF†RfVVB‡F†RÇ6òv&Ò×W6†W2—BöâÆöB’à¢–b…ö†fTæ÷F–d'&–FvR‚’’æ÷F–e'2‚vvWDæ÷F–f–6F–öç2rÂ²Æ–Ö—C¢#Ò’æ6F6‚‚‚’Óâ·Ò§Ò ¢òòçVÖ&W"WfW'’&÷r–âF†RF–ÆörÂF÷Fò&÷GFöÒÂ6òâ—FVÒ6â&RæÖVB'¢òò÷6—F–öâæBF†RÆVæwF‚öbÆ–Æ—7B—2f—6–&ÆRBvÆæ6Rà¢òð¢òòF†RçVÖ&W'2föÆÆ÷rv†B—2öâ67&VVâÂæ÷BF†RÆ’VWVRâÖ÷7BÆ–Æ—7G2&P¢òòÆ—7FVBÇ†&WF–6ÆÇ’v†–ÆRÆ–&6²föÆÆ÷w2–ç6W'F–öâ÷&FW"ÂæBF—6&ÆV@¢òò—FV×2¶VWF†V—"&÷r'WBæWfW"Æ’(	B6ò6öÇVÖâF†BG&–VBFò6†÷rÆ¢òò÷6—F–öâv÷VÆB§V×&÷VæBæB6¶—Âv†–6‚—2v÷'6RF†âæ÷BçVÖ&W&–ær@¢òòÆÂâf–ÆÆVB–âgFW"F†R&VæFW"&F†W"F†â'V–ÇB–çFòF†RÖ&·WÂ6ò¢òòG&r×&V÷&FW"6â&VçVÖ&W"v—F†÷WB&V'V–ÆF–ærF†Rv†öÆRF–Æörà¦gVæ7F–öâ÷&VçVÖ&W%&V4—FV×2‚FFÆr’°¢6öç7B7F'BÒçVÖ&W"‚FFÆræGG"‚vFF×&V2×7F'Br’’ÇÂ ¢FFÆræf–æB‚rç&V2Ö—FVÒr’æV6‚†gVæ7F–öâ†’’°¢B‡F†—2’æ6†–ÆG&Vâ‚rç&V2Ö—FVÒ×&÷sr’æ6†–ÆG&Vâ‚rç&V2Ö—FVÒÖæòr’çFW‡B‡7F'B²’²¢Ò§Ð ¢òòföÆFW"ÖWFFF—27–æ6VB–âF†R&V6÷&F–æw2Öæ–fW7BÂ6W&FVÇ’g&öÒ6&G2à¦6öç7B÷Æ–Æ—7DföÆFW%7FFW2ÒæWrÖ‚¦gVæ7F–öâ÷Æ–Æ—7DföÆFW$¶W’‚’²&WGW&â÷66÷VD¶W’‚v7W—F÷#§Æ–Æ—7DföÆFW'3¢r²vWDÆætg&öÕW&Â‚’ægVÆÄæÖR’Ð¦gVæ7F–öâ÷Æ–Æ—7DföÆFW%7FFR‚’°¢6öç7B¶W’Ò÷Æ–Æ—7DföÆFW$¶W’‚¢–b‚÷Æ–Æ—7DföÆFW%7FFW2æ†2†¶W’’’°¢6öç7B&VBÒ7Vff—‚Óâ²G'’²&WGW&âÖW&vTföÆFW$6FÆör„¥4ôâç'6R…÷W6W$FFævWD—FVÒ†¶W’²7Vff—‚’ÇÂw·Òr’’Ò6F6‚…ò’²&WGW&â·ÒÒÐ¢÷Æ–Æ—7DföÆFW%7FFW2ç6WB†¶W’Â¶6FÆös§&VB‚rr’Æ&6S§&VB‚s¦&6Rr—Ò¢Ð¢&WGW&â÷Æ–Æ—7DföÆFW%7FFW2ævWB†¶W’§Ð¦gVæ7F–öâ÷W'6—7EÆ–Æ—7DföÆFW'2‚’°¢6öç7B7FFRÒ÷Æ–Æ—7DföÆFW%7FFR‚’Â¶W’Ò÷Æ–Æ—7DföÆFW$¶W’‚¢G'’°¢÷W6W$FFç6WD—FVÒ†¶W’Â¥4ôâç7G&–æv–g’‡7FFRæ6FÆör’¢÷W6W$FFç6WD—FVÒ†¶W’²s¦&6RrÂ¥4ôâç7G&–æv–g’‡7FFRæ&6R’¢Ò6F6‚†R’²6öç6öÆRçv&â‚t6÷VÆBæ÷BW'6—7BÆ–Æ—7BföÆFW'2rÂR’Ð§Ð¦gVæ7F–öâ÷Æ–Æ—7DföÆFW'4F—'G’‚’°¢6öç7B7FFRÒ÷Æ–Æ—7DföÆFW%7FFR‚¢&WGW&â÷6ÖT§6öâ‡7FFRæ6FÆörÇ7FFRæ&6R§Ð¦gVæ7F–öâöföÆFW%6VÆV7B‡fÇVRÒrr’°¢6öç7BG6VÆV7BÒB‚sÇ6VÆV7B&–ÖÆ&VÃÒ%&VçBföÆFW"#âr’æVæB‚B‚sÆ÷F–öâfÇVSÒ"#âr’çFW‡B‚uVæf–ÆVBò&ö÷Br’¢föÆFW%F‡2‡v–æF÷rå÷&V6÷&F–æw2Å÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆör’æf÷$V6‚‡F‚ÓâG6VÆV7BæVæB‚B‚sÆ÷F–öãâr’çfÂ‡F‚’çFW‡B‡F‚’’¢&WGW&âG6VÆV7BçfÂ‡fÇVR§Ð¦gVæ7F–öâö÷VåÆ–Æ—7DföÆFW$VF—F÷"†g&öÒÒçVÆÂÂ&VçBÒrr’°¢6öç7BFF–ÆörÒB‚sÆF—b6Æ73Ò'ÂÖföÆFW"ÖVF—F÷"#âr’æVæEFò‚v&öG’r¢6öç7BFæÖRÒB‚sÆ–çWBG—SÒ'FW‡B"&–ÖÆ&VÃÒ$föÆFW"æÖR"WFö6ö×ÆWFSÒ&öfb#âr’çfÂ†g&öÒòg&öÒç7Æ—B‚ròr’æB‚Ó’¢rr¢6öç7BG&VçBÒöföÆFW%6VÆV7B†g&öÒòg&öÒç7Æ—B‚ròr’ç6Æ–6RƒÂÓ’æ¦ö–â‚ròr’¢&VçB¢FF–ÆöræVæB‚B‚sÆÆ&VÃâr’çFW‡B‚tföÆFW"æÖRr’æVæB‚FæÖR’ÂB‚sÆÆ&VÃâr’çFW‡B‚u&VçBföÆFW"r’æVæB‚G&VçB’¢6öç7BFW'&÷"ÒB‚sÇ6Æ73Ò'ÂÖf÷&ÒÖW'&÷""&öÆSÒ&ÆW'B#âr’æVæEFò‚FF–Æör¢6öç7B6fRÒ‚’Óâ°¢G'’°¢6öç7B&W7VÇBÒföÆFW$6†ævR‡v–æF÷rå÷&V6÷&F–æw2Å÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆörÇ¶g&öÒÆæÖS¢FæÖRçfÂ‚’Ç&VçC¢G&VçBçfÂ‚—Ò¢v–æF÷rå÷&V6÷&F–æw2Ò&W7VÇBçÆ–Æ—7G0¢÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆörÒ&W7VÇBæ6FÆöp¢Æ–Æ—7D'&÷w6W%7FFR…÷Æ–Æ—7DföÆFW$¶W’‚’’æföÆFW"Ò&W7VÇBçF€¢÷W'6—7EÆ–Æ—7DföÆFW'2‚“²÷6fU&V6÷&F–ær‚¢FF–ÆöræF–Æör‚v6Æ÷6Rr“²÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò6F6‚†R’²FW'&÷"çFW‡B†RæÖW76vR’Ð¢Ð¢FæÖRæöâ‚v¶W–F÷vârÆSÓç¶–b†Ræ¶W“ÓÓÒtVçFW"r—¶Rç&WfVçDFVfVÇB‚“·6fR‚—×Ò¢FF–ÆöræF–Æör‡·F—FÆS¦g&öÓòu&VæÖR÷"Ö÷fRföÆFW"s¢tæWrföÆFW"rÆÖöFÃ§G'VRÇv–GFƒ¤ÖF‚æÖ–âƒCCÆ–ææW%v–GF‚Ó#B’À¢'WGFöç3¥··FW‡C¦g&öÓòu6fRföÆFW"s¢t7&VFRföÆFW"rÆ6Æ–6³§6fWÒÇ·FW‡C¢t6æ6VÂrÆ6Æ–6³¢‚“ÓâFF–ÆöræF–Æör‚v6Æ÷6Rr—ÕÒÀ¢6Æ÷6S¢‚“ÓâFF–ÆöræF–Æör‚vFW7G&÷’r’ç&VÖ÷fR‚—Ò¢FæÖRçG&–vvW"‚vfö7W2r§Ð¦gVæ7F–öâö÷VåÆ–Æ—7DÖ÷fR†æÖR’°¢6öç7BÆ–Æ—7C×v–æF÷rå÷&V6÷&F–æw5¶æÖUÐ¢–b‚Æ–Æ—7BÇÂÆ–Æ—7BæW‡FW&æÂÇÂ÷&VgW6U&VDöæÇ•Æ–Æ—7B†æÖR’’&WGW&à¢6öç7BFF–ÆösÒB‚sÆF—b6Æ73Ò'ÂÖföÆFW"ÖVF—F÷"#âr’æVæEFò‚v&öG’r¢6öç7BFföÆFW#ÕöföÆFW%6VÆV7B†föÆFW%F‚‡Æ–Æ—7BæföÆFW"’’æGG"‚v&–ÖÆ&VÂrÂtFW7F–æF–öâföÆFW"r¢FF–ÆöræVæB‚B‚sÇâr’çFW‡B‚tÖ÷fR(	Âr¶æÖR²~(	Ò–çFòföÆFW"âr’ÂB‚sÆÆ&VÃâr’çFW‡B‚tFW7F–æF–öâföÆFW"r’æVæB‚FföÆFW"’¢FF–ÆöræF–Æör‡·F—FÆS¢tÖ÷fRÆ–Æ—7BrÆÖöFÃ§G'VRÇv–GFƒ¤ÖF‚æÖ–âƒCCÆ–ææW%v–GF‚Ó#B’Æ'WGFöç3§°¢Ö÷fS¢‚“Óç°¢6öç7BF&vWCÕ7G&–ær‚FföÆFW"çfÂ‚’ÇÂrr¢–b‡F&vWBbbföÆFW%F‡2‡v–æF÷rå÷&V6÷&F–æw2Å÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆör’æ–æ6ÇVFW2‡F&vWB’—&WGW&à¢Æ–Æ—7BæföÆFW#×F&vWC·Æ–Æ—7BçWFFVDCÔFFRææ÷r‚“µ÷6fU&V6÷&F–ær‚¢Æ–Æ—7D'&÷w6W%7FFR…÷Æ–Æ—7DföÆFW$¶W’‚’’æföÆFW#×F&vW@¢FF–ÆöræF–Æör‚v6Æ÷6Rr“¶÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢ÒÄ6æ6VÃ¢‚“ÓâFF–ÆöræF–Æör‚v6Æ÷6Rr—ÒÆ6Æ÷6S¢‚“ÓâFF–ÆöræF–Æör‚vFW7G&÷’r’ç&VÖ÷fR‚—Ò§Ð¦gVæ7F–öâö6öÆÆ6UÆ–Æ—7D'&÷w6W"‚’°¢Æ–Æ—7D'&÷w6W%7FFR…÷Æ–Æ—7DföÆFW$¶W’‚’’æFWF–Ç4÷VãÖfÇ6P¢6öç7BæVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚wÆ–Æ—7D'&÷w6W%æVÂr¢–b‡æVÂ—æVÂæ÷VãÖfÇ6P§Ð¦gVæ7F–öâöÖ÷VçEÆ–Æ—7DÆ–'&'’‚FF–Æör’°¢FF–Æöræf–æB‚r7Æ–Æ—7D'&÷w6W%æVÂr’æöâ‚wFövvÆRrÂgVæ7F–öâ‚’²–b‡F†—2æ—46öææV7FVB—Æ–Æ—7D'&÷w6W%7FFR…÷Æ–Æ—7DföÆFW$¶W’‚’’æFWF–Ç4÷Vã×F†—2æ÷VâÒ¢Ö÷VçEÆ–Æ—7D'&÷w6W"‚FF–Æöræf–æB‚r7Æ–Æ—7D'&÷w6W"r•³ÒÇ°¢Æ–Æ—7G3§v–æF÷rå÷&V6÷&F–æw2Æ6FÆös¥÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆörÆ7W'&VçDæÖS§v–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖRÀ¢66÷S¥÷Æ–Æ—7DföÆFW$¶W’‚’Æ6÷VçC¥÷&V6÷&F–æt—FVÔ6÷VçD'”æÖRÀ¢öå6VÆV7C¦æÖSÓçµö6öÆÆ6UÆ–Æ—7D'&÷w6W"‚“¶–b‡6VÆV7E&V6÷&F–ær†æÖR’–÷Vå&V6÷&F–æu&Wf–WtF–Æör‚—ÒÀ¢öäæWs¢‚“Óç¶6öç7BæÖS×&ö×B‚tæÖRf÷"F†RæWrÆ–Æ—7C¢r“¶–b†æÖRbf7&VFU&V6÷&F–ær†æÖR’—µö6öÆÆ6UÆ–Æ—7D'&÷w6W"‚“¶÷Vå&V6÷&F–æu&Wf–WtF–Æör‚—×ÒÀ¢öä7&VFS§&VçCÓåö÷VåÆ–Æ—7DföÆFW$VF—F÷"†çVÆÂÇ&VçB’ÆöäVF—C¦g&öÓÓåö÷VåÆ–Æ—7DföÆFW$VF—F÷"†g&öÒ’À¢öäFVÆWFS¦g&öÓÓç°¢G'’°¢6öç7B&W7VÇCÖföÆFW$6†ævR‡v–æF÷rå÷&V6÷&F–æw2Å÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆörÇ¶g&öÒÇ&VÖ÷fS§G'VWÒ¢÷Æ–Æ—7DföÆFW%7FFR‚’æ6FÆös×&W7VÇBæ6FÆöp¢Æ–Æ—7D'&÷w6W%7FFR…÷Æ–Æ—7DföÆFW$¶W’‚’’æföÆFW#×&W7VÇBçF€¢÷W'6—7EÆ–Æ—7DföÆFW'2‚“µ÷6fU&V6÷&F–ær‚“¶÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ö6F6‚†R—¶ÆW'B†RæÖW76vR—Ð¢Ð¢Ò¢FF–Æöræöfb‚v6Æ–6²rÂr7Æ–Æ—7DÖ÷fRr’æöâ‚v6Æ–6²rÂr7Æ–Æ—7DÖ÷fRrÂ‚“Óåö÷VåÆ–Æ—7DÖ÷fR‡v–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’§Ð ¦gVæ7F–öâ÷Vå&V6÷&F–æu&Wf–WtF–Æör‚’°¢ÆWBFFÆrÒB‚r7&V6÷&F–æu&Wf–WtF–Æörr¢–b‚FFÆræÆVæwF‚’°¢FFÆrÒB‚sÆF—b–CÒ'&V6÷&F–æu&Wf–WtF–Æör#ãÂöF—câr’æVæEFò‚v&öG’r¢Ð¢6öç7B—FV×2Òv–æF÷rå÷&V6÷&F–æræ—FV×2ÇÂ·Ð¢6öç7B7W'&VçDæÖRÒv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖRÇÂ$T5ôDTdTÅEôäÔP¢òòF†R÷&FW"F†RÆ–Æ—7B—2–âÂv†–6‚—2F†R÷&FW"Æ’æB&7F–6RF¶R—@¢òò–âv—F‚6‡VffÆRöfb(	B'V–ÆEÆ•VWVRvÆ·2F†W6R6ÖR¶W—2â6÷'F–ær†W&P¢òò–ç7FVBÆ—7FVBÆ–Æ—7BÇ†&WF–6ÆÇ’v†–ÆR—BÆ–VB–âæ÷F†W"÷&FW"À¢òò6òF†RÆ—7B6–Bæ÷F†–ær&÷WBv†Bv26öÖ–æræW‡Bà¢6öç7B—5f—'GVÄ7W'&VçBÒö—5f—'GVÂ†7W'&VçDæÖR¢òòF†R÷F†W"W6W"w2Æ–Æ—7C¢Æ’—BÂ&7F—6R—BÂ6÷’6&G2÷WBöb—Bà¢6öç7B—5&VDöæÇ”7W'&VçBÒö—5&VDöæÇ•Æ–Æ—7B†7W'&VçDæÖR¢òòæò—FVÒöbF†RÆ—7B6â&R6†ævVB†W&Rà¢6öç7B—FV×4Æö6¶VBÒ—5f—'GVÄ7W'&VçBÇÂ—5&VDöæÇ”7W'&Vç@¢6öç7BÆÄæÖW2ÒÆ—7E&V6÷&F–æw2‚¢òòÆ7B×Æ–VB—FVÒ†f÷"†–v†Æ–v‡F–ær’âöæÇ’†–v†Æ–v‡Bv†VâF†RF—7Æ–V@¢òòÆ–Æ—7BÖF6†W2v†W&RF†R—FVÒ6ÖRg&öÒà¢6öç7BöÇÒöÆöDÆ7EÆ–VB‚¢6öç7BöÇ†W&RÒöÇbböÇç&V4æÖRÓÓÒ7W'&VçDæÖRòöÇ¢çVÆÀ¢òò&W6W'fRF†RW6W"w267&öÆÂ÷6—F–öâ7&÷72&Vg&W6‚âF†—2gVæ7F–öâ—2¢òògVÆÂ&R×&VæFW"‚FFÆræ‡FÖÂ&VÆ÷rv—W2F†R6öçFVçBæB&W6WG267&öÆÅF÷Fð¢òò’ÂæB—Bw26ÆÆVBæ÷B§W7BöâW6W"7F–öç2'WBv†VæWfW"F†RæF—fR ¢òòW6†W2g&W6‚Æ–Æ—7B–ÆöB†7W—F÷%Æ–Æ—7G2(i"'V–ÆEÆ–Æ—7G5v—F„ÖçVÄ6&G2’à¢òò&6¶w&÷VæB&Vg&W6‚v†–ÆRF†RW6W"—267&öÆÆ–ær×W7Bæ÷B6æF†RÆ—7@¢òò&6²FòF†RF÷âF†—2Æ–W2Fò'&÷w6W"æBæF—fRÖWFFW2Æ–¶Rà¢6öç7B÷v4÷VâÒFFÆræ†46Æ72‚wV’ÖF–ÆörÖ6öçFVçBr’bbFFÆræ—2‚s§f—6–&ÆRr¢6öç7B÷&WdF–Æöu÷6—F–öâÒ÷v4÷Vâò°¢÷6—F–öã¢vf—†VBrÂF÷¢FFÆræ6Æ÷6W7B‚rçV’ÖF–Æörr’æ772‚wF÷r’ÂÆVgC¢FFÆræ6Æ÷6W7B‚rçV’ÖF–Æörr’æ772‚vÆVgBr¢Ò¢çVÆÀ¢òò÷6—F–öâ&VÆöæw2FòF†RÆ—7B—Bv2F¶Vâg&öÒâ–6¶–ærF–ffW&Vç@¢òòÆ–Æ—7B&R×&VæFW'2F‡&÷Vv‚†W&RFöòÂæB6''––ærF†RöÆBöfg6WB÷fW ¢òò÷Vç2F†RæWrÆ—7B'B×v’F÷vâÂ÷"B—G2VæB–b—B—2F†R6†÷'FW"ö`¢òòF†RGvò(	B6òöæÇ’&Vg&W6‚öbF†R6ÖRÆ—7BvWG2—G2Æ6R¶WBà¢6öç7B÷6ÖTÆ—7BÒ‚FFÆu³ÒbbFFÆu³Òå÷&V56†÷v–ærÓÓÒ7W'&VçDæÖR¢6öç7B&Wf–WrÒ&V6÷&F–æu&Wf–WuvR†—FV×2Â÷6ÖTÆ—7BòFFÆu³Òå÷&V5vR¢¢6öç7B÷6ÖUvRÒFFÆu³Òå÷&V5&VæFW&VEvRÓÓÒ&Wf–WrçvP¢6öç7B÷&We67&öÆÅF÷Ò÷v4÷Vâbb÷6ÖTÆ—7Bbb÷6ÖUvRòFFÆu³Òç67&öÆÅF÷¢ ¢ö&¦V7Bæ76–vâ‚FFÆu³ÒÂ²÷&V56†÷v–æs¢7W'&VçDæÖRÂ÷&V5vS¢&Wf–WrçvRÂ÷&V5&VæFW&VEvS¢&Wf–WrçvRÒ¢FFÆræGG"‚vFF×&V2×7F'BrÂ&Wf–Wrç7F'B¢6öç7B6V&6…FW‡G2Òö&¦V7Bæ¶W—2‡&Wf–Wræw&÷W2¢òò¶VWV6‚vRw2æF—fR67&öÆÂ7W&f6R&÷VæFVBà¢6öç7BvTæbÒ&Wf–WrçvT6÷VçBâòÆæb6Æ73Ò'&V2×vRÖæb"&–ÖÆ&VÃÒ%Æ–Æ—7BvW2#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×vR×7FW"FF×vSÒ"G·&Wf–WrçvRÒÒ"&–ÖÆ&VÃÒ%&Wf–÷W2Æ–Æ—7BvR"G·&Wf–WrçvRÓÓÒòrF—6&ÆVBr¢rwÓî(“Âö'WGFöãà¢ÆÆ&VÃåvRÆ–çWB6Æ73Ò'&V2×vRÖ–çWB"G—SÒ&çVÖ&W""Ö–ãÒ#"ÖƒÒ"G·&Wf–WrçvT6÷VçGÒ"fÇVSÒ"G·&Wf–WrçvR²Ò"&–ÖÆ&VÃÒ%Æ–Æ—7BvR#âòG·&Wf–WrçvT6÷VçGÓÂöÆ&VÃà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×vR×7FW"FF×vSÒ"G·&Wf–WrçvR²Ò"&–ÖÆ&VÃÒ$æW‡BÆ–Æ—7BvR"G·&Wf–WrçvR²ÓÓÒ&Wf–WrçvT6÷VçBòrF—6&ÆVBr¢rwÓî(£Âö'WGFöãà¢Ç7â6Æ73Ò'&V2×vR×&ævR#âG·&Wf–Wrç7F'B²Þ(	2G·&Wf–WræVæGÒöbG·&Wf–WrçF÷FÇÓÂ÷7ãà¢Âöæcæ¢rp¢6öç7B'&÷w6W%7FFRÒÆ–Æ—7D'&÷w6W%7FFR…÷Æ–Æ—7DföÆFW$¶W’‚’¢–b‚÷v4÷Vâ’'&÷w6W%7FFRæFWF–Ç4÷VâÒG'VP¢VÇ6R°¢6öç7B&Wf–÷W4'&÷w6W#ÒFFÆræf–æB‚r7Æ–Æ—7D'&÷w6W%æVÂr•³ÒÂ&Wf–÷W4föÆFW'3ÒFFÆræf–æB‚rçÂÖföÆFW"×æRr•³Ð¢–b‡&Wf–÷W4'&÷w6W"–'&÷w6W%7FFRæFWF–Ç4÷Vã×&Wf–÷W4'&÷w6W"æ÷Và¢–b‡&Wf–÷W4föÆFW'2–'&÷w6W%7FFRæföÆFW'4÷Vã×&Wf–÷W4föÆFW'2æ÷Và¢Ð¢ÆWB‡FÖÂÒsÆFWF–Ç2–CÒ'Æ–Æ—7D'&÷w6W%æVÂ"r²†'&÷w6W%7FFRæFWF–Ç4÷VâÓÓÒfÇ6Ròrr¢r÷Vâr’²sãÇ7VÖÖ'“ä'&÷w6RÆ–Æ—7G3Â÷7VÖÖ'“ãÆF—b–CÒ'Æ–Æ—7D'&÷w6W"#ãÂöF—cãÂöFWF–Ç3ãÆF—b6Æ73Ò'ÂÖFWF–Ç2Ö†VF–ær#ãÇ7ãå6VÆV7FVBÆ–Æ—7CÂ÷7ããÇ7G&öæsâr²òæW66R†7W'&VçDæÖR’²sÂ÷7G&öæsãÇ6ÖÆÃâr²òæW66R†föÆFW%F‚‡v–æF÷rå÷&V6÷&F–æw5¶7W'&VçDæÖUÓòæföÆFW"’ÇÂuVæf–ÆVBr’²sÂ÷6ÖÆÃãÂöF—câp¢òò)H)H†VFW#¢7v—F6‚ò7&VFRòæWr×f—'GVÂò&VæÖRòGWÆ–6FRòFVÆWFR)H)H ¢‡FÖÂ³ÒÆF—b6Æ73Ò'&V2×&V2Ö†VFW""7G–ÆSÒ&Ö&v–âÖ&÷GFöÓ£ƒ·FF–æs£g‚g‚‡ƒ¶&÷&FW"Ö&÷GFöÓ£‚6öÆ–B6FFC¶F—7Æ“¦fÆWƒ¶fÆW‚×w&§w&¶v£gƒ¶Æ–vâÖ—FV×3¦6VçFW#²#à¢ÆÆ&VÂ7G–ÆSÒ&föçB×6—¦S£'ƒ¶6öÆ÷#¢3SSS²#åÆ–Æ—7C£ÂöÆ&VÃà¢Ç6VÆV7B–CÒ'&V5&V56VÆV7B"7G–ÆSÒ&fÆWƒ£¶Ö–â×v–GFƒ£Cƒ¶Ö‚×v–GFƒ£#cƒ²#æ ¢6öç7B÷væW"Òö÷væW$Æ&VÆÆW"‚¢ÆÄæÖW2æf÷$V6‚†âÓâ°¢6öç7B6÷VçBÒ÷&V6÷&F–æt—FVÔ6÷VçD'”æÖR†â¢òòF—7Æ’öæÇ“¢F†RfÇVR7F—2F†RÆ–âÆ–Æ—7BæÖRà¢6öç7B÷væW%FrÒö—5&VDöæÇ•Æ–Æ—7B†â’ò÷væW"‡v–æF÷rå÷&V6÷&F–æw5¶åÒ’¢rp¢6öç7BÖ&¶W"Ò…ö—5f—'GVÂ†â’ò	ùIrr¢rr’°¢†÷væW%FròG¶÷væW%FwÒ+r¢‚ö—5f—'GVÂ†â’bbö—5&VDöæÇ•Æ–Æ—7B†â’ò	ùI"r¢rr’¢‡FÖÂ³ÒÆ÷F–öâfÇVSÒ"GµòæW66R†â—Ò"G¶âÓÓÒ7W'&VçDæÖRòr6VÆV7FVBr¢rwÓâGµòæW66R†Ö&¶W"—ÒGµòæW66R†â—Ò‚G¶6÷VçGÒ“Âö÷F–öãæ ¢Ò¢‡FÖÂ³ÒÂ÷6VÆV7Cà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V4æWr"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ$7&VFRæWrÆ–Æ—7B"&–ÖÆ&VÃÒ$7&VFRæWrÆ–Æ—7B#ãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#îûÈ³Â÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#äæWsÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V4æWuf—'GVÂ"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ$7&VFRf—'GVÂÆ–Æ—7B†6öÖ&–æRW†—7F–ærÆ–Æ—7G2’"&–ÖÆ&VÃÒ$7&VFRf—'GVÂÆ–Æ—7B#ãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#ï	ùIsÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#åf—'GVÃÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V5&æFöÒ"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ$'V–ÆB&æFöÒ×6×ÆRÆ–Æ—7Bg&öÒÆÂ&VÂÆ–Æ—7G2"&–ÖÆ&VÃÒ%&7F–6R&æFöÒ#ãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#ï	øë#Â÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#å&7F–6R&æFöÓÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V4g&öÔ6FVv÷'’"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ$'V–ÆBÆ–Æ—7Böb7V'F—FÆRW†×ÆW2f÷"WfW'’v÷&B–âöæRfö6'VÆ'’6FVv÷'’"&–ÖÆ&VÃÒ$'V–ÆBÆ–Æ—7Bg&öÒ6FVv÷'’#ãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#ï	ù9£Â÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#äg&öÒ6FVv÷'“Â÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V4FDÖçVÂ"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ$FBÖçVÂfÆ6†6&BVçG'’‡6÷W&6R÷F&vWB²÷F–öæÂÖVF–Æ–æ²’"&–ÖÆ&VÃÒ$FBÖçVÂVçG'’"G¶—FV×4Æö6¶VBòrF—6&ÆVBr¢rwÓãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#ï	ù9ÓÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#äFB6&CÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V5G&ç6ÆFR"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ%G&ç6ÆFRV6‚v÷&B÷‡&6R†öæÇ’v†W&RG&ç6ÆF–öâ—2Ö—76–ær’æB7F÷&R—B2Æ6V†öÆFW"G&ç6ÆF–öâ"&–ÖÆ&VÃÒ%G&ç6ÆFR‡&6W2"G¶—FV×4Æö6¶VBòrF—6&ÆVBr¢rwÓãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#ï	øÉÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#åG&ç6ÆFSÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'Æ–Æ—7DÖ÷fR"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"&–ÖÆ&VÃÒ$Ö÷fRÆ–Æ—7BFòföÆFW""G¶—5&VDöæÇ”7W'&VçBÇÂv–æF÷rå÷&V6÷&F–æw5¶7W'&VçDæÖUÓòæW‡FW&æÂòrF—6&ÆVBr¢rwÓî)kÖ÷fRFòföÆFW#Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V5&VæÖR"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ%&VæÖRF†—2Æ–Æ—7B"&–ÖÆ&VÃÒ%&VæÖRF†—2Æ–Æ—7B"G¶—5&VDöæÇ”7W'&VçBòrF—6&ÆVBr¢rwÓãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#î)ÈãÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#å&VæÖSÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V4GWÆ–6FR"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ$GWÆ–6FRF†—2Æ–Æ—7B"&–ÖÆ&VÃÒ$GWÆ–6FRF†—2Æ–Æ—7B#ãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#î(éƒÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#äGWÆ–6FSÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V4FVÆWFR"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ&V2×&V2ÖFævW""F—FÆSÒ$FVÆWFRF†—2Æ–Æ—7B"&–ÖÆ&VÃÒ$FVÆWFRF†—2Æ–Æ—7B"G¶—5&VDöæÇ”7W'&VçBòrF—6&ÆVBr¢rwÓãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#ï	ùyÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#äFVÆWFSÂ÷7ããÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5&V57–æ2"F—6&ÆVB6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"F—FÆSÒ%W6‚Æö6ÂÆ–Æ—7G2Fòv—D‡V""&–ÖÆ&VÃÒ%7–æ2Fòv—D‡V"#ãÇ7â6Æ73Ò'&V2×&V2Ö–6ò#î*KCÂ÷7ããÇ7â6Æ73Ò'&V2×&V2ÖÆ&Â#å7–æ3Â÷7ããÂö'WGFöãà¢ÂöF—cæ ¢òòf—'GVÂÆ–Æ—7B&ææW#¢6†÷w2ÖVÖ&W'2²â$VF—BÖVÖ&W'2"ff÷&Fæ6RÀ¢òòæB6–væÇ2F†BF†R—FVÒÆ—7B&VÆ÷r—2&VBÖöæÇ’à¢–b†—5f—'GVÄ7W'&VçB’°¢6öç7BÖVÖ&W'2Ò÷f—'GVÄÖVÖ&W'2†7W'&VçDæÖR¢‡FÖÂ³ÒÆF—b6Æ73Ò'&V2×f—'GVÂÖ&ææW"#à¢	ùIrÆ#åf—'GVÂÆ–Æ—7CÂö#â(	BÆ—fR6öÖ&–æF–öâöc ¢G¶ÖVÖ&W'2æÆVæwF‚òÖVÖ&W'2æÖ†ÒÓâÇ7â6Æ73Ò'&V2×f—'GVÂÖÖVÖ&W"#âGµòæW66R†÷væW"ç&Vf—‚†ÒÂv–æF÷rå÷&V6÷&F–æw5¶ÕÒ’—ÓÂ÷7ãæ’æ¦ö–â‚rr’¢sÇ7â7G–ÆSÒ&6öÆ÷#¢6²#â†æòfÆ–BÖVÖ&W'2“Â÷7ãâwÐ¢G¶—5&VDöæÇ”7W'&VçBòrr¢sÆ'WGFöâG—SÒ&'WGFöâ"–CÒ'&V5f—'GVÄVF—B"6Æ73Ò&'Fâ&V2×&V2Ö'Fâ"7G–ÆSÒ&Ö&v–âÖÆVgC£‡ƒ²#äVF—BÖVÖ&W'3Âö'WGFöãâwÐ¢ÆF—b6Æ73Ò'&V2×f—'GVÂÖæ÷FR#ä—FV×2&R&VBÖöæÇ’†W&RâVF—BF†VÒ–âF†V—"6÷W&6RÆ–Æ—7G2ãÂöF—cà¢ÂöF—cæ ¢Ð¢–b†—5&VDöæÇ”7W'&VçB’°¢6öç7B÷væW%6†÷vâÒö÷væW$Æ&VÄöeÆ–Æ—7B†7W'&VçDæÖR’ç&WÆ6R‚õï	ùI"òÂrr’ÇÂ÷6÷W&6T÷væW"‚v÷F†W"r¢‡FÖÂ³ÒÆF—b6Æ73Ò'&V2×f—'GVÂÖ&ææW"#à¢	ùI"Æ#å&VBÖöæÇ’Æ–Æ—7CÂö#âG¶÷væW%6†÷vâòg&öÒGµòæW66R†÷væW%6†÷vâ—Ö¢rwÒà¢ÆF—b6Æ73Ò'&V2×f—'GVÂÖæ÷FR#å–÷R6âÆ’æB&7F—6R—BÂæB6÷’6&G2–çFò–÷W"÷vâÆ–Æ—7G2ãÂöF—cà¢ÂöF—cæ ¢Ð¢‡FÖÂ³ÒvTæ`¢–b‚6V&6…FW‡G2æÆVæwF‚’°¢‡FÖÂ³Ò—5f—'GVÄ7W'&Vç@¢òsÇ7G–ÆSÒ&6öÆ÷#¢3ƒƒƒ²#åF†—2f—'GVÂÆ–Æ—7B&W6öÇfW2Fòæò—FV×2(	B—G2ÖVÖ&W'2Ö’&RV×G’ãÂ÷âp¢¢sÇ7G–ÆSÒ&6öÆ÷#¢3ƒƒƒ²#äæò&V6÷&FVB—FV×2–WBâ6Æ–6²)xò&V6÷&BÂF†VâF†R6GW&R'WGFöâæW‡BFòÖF6‚ãÂ÷âp¢ÒVÇ6R°¢&Wf–Wrç'Vç2æf÷$V6‚‚‡'VâÂ'Vä–æFW‚’Óâ°¢6öç7B7BÒ'Vâç7@¢–b‡'Vä–æFW‚ÓÓÒÇÂ&Wf–Wrç'Vç5·'Vä–æFW‚ÒÒç7BÓÒ7B’‡FÖÂ³ÒÆF—b6Æ73Ò'&V2Öw'"7G–ÆSÒ&Ö&v–âÖ&÷GFöÓ£ƒ·FF–æs£gƒ¶&÷&FW#£‚6öÆ–B6VVS¶&÷&FW"×&F—W3£Gƒ²#à¢ÆF—b7G–ÆSÒ&föçB×vV–v‡C¦&öÆC¶föçB×6—¦S£Gƒ²#ï	ùHâGµòæW66R‡7B—ÓÂöF—cæ ¢µ·'VâçuÒæf÷$V6‚‡rÓâ°¢6öç7BtW62ÒòæW66R‡r¢6öç7B7DW62ÒòæW66R‡7B¢‡FÖÂ³ÒÆF—b7G–ÆSÒ&Ö&v–âÖÆVgC£ƒ¶Ö&v–â×F÷£Gƒ²#à¢ÆF—b7G–ÆSÒ&6öÆ÷#¢3SSS¶föçB×7G–ÆS¦—FÆ–3¶föçB×6—¦S£7ƒ²#âG·tW67ÓÂöF—cà¢ÆF—b6Æ73Ò'&V2Ö—FVÒÖÆ—7B"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"7G–ÆSÒ&Ö&v–âÖÆVgC£gƒ²#æ ¢'VâæVçG&–W2æf÷$V6‚‚‡²—FVÓ¢—BÂ–G‚Ò’Óâ°¢6öç7B6†V6¶VBÒ†—BæVæ&ÆVBÓÒfÇ6R’òv6†V6¶VBr¢rp¢òò$6÷’Fþ(
b"–6¶W"(	BÆ—7G2WfW'’÷F†W"$TÂ&V6÷&F–ær†6âwB6÷¢òò–çFòf—'GVÂöæR’â†–FFVâv†Vâ7W'&VçBÆ–Æ—7B—2f—'GVÀ¢òò‡&VBÖöæÇ’’÷"F†W&R&RæòVÆ–v–&ÆRF&vWG2à¢6öç7B÷F†W$æÖW2Òö6F–öäFW7F–æF–öç2‚’æf–ÇFW"†âÓââÓÒ7W'&VçDæÖR¢6öç7B6÷”÷F–öç2Ò‚—5f—'GVÄ7W'&VçBbb÷F†W$æÖW2æÆVæwF‚¢òÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö6÷’×Fò"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"F—FÆSÒ$6÷’F†—2—FVÒFòæ÷F†W"Æ–Æ—7B#ä6÷ž(
cÂö'WGFöãæ ¢¢rp¢òò7V'F—FÆR&Wf–Wr(	BG'’7–æ2f—'7B‡7V'2Ç&VG’–âÖVÖ÷'’’ÂVÇ6P¢òòÖ&²VæF–æræBÆWBöÆ§”ÆöE&V4—FVÕ&Wf–Ww2f–ÆÂ—B–âgFW ¢òòF†RF–Æör&VæFW'2à¢6öç7Bö–æ—F–Å&Wf–WrÒ÷&Wf–WuFW‡Df÷%&V4—FVÒ†—B¢6öç7B÷&Wf–WuFW‡BÒö–æ—F–Å&Wf–Wrò÷G'Væ6FU&Wf–Wr…ö–æ—F–Å&Wf–WrÂ$T5ô•DTÕõDU…EôÔ‚’¢~(
bp¢6öç7B÷VæF–ætGG"Òö–æ—F–Å&Wf–Wròrr¢rFF×VæF–æsÒ#"p¢òòöâf—'GVÂÆ–Æ—7BF†RÆ—7B—2&VBÖöæÇ“¢öæÇ’)kbÆ’Ög&öÒ—0¢òòöffW&VC²G&ròFövvÆRòGWÆ–6FRò6÷’òFVÆWFR&RöÖ—GFVBà¢6öç7BVF—D6öçG&öÇ2Ò—FV×4Æö6¶VBòrr¢ ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2ÖG&r"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò ¢F—FÆSÒ$Ö÷fRF†—2—FVÒ(	BG&r—BÂ÷"FFòG—R÷6—F–öâ#î(ºî(ºãÂö'WGFöãà¢ÆÆ&VÂ6Æ73Ò'&V2×FövvÆR"F—FÆSÒ$–æ6ÇVFR–âÆ’ÆÂ#à¢Æ–çWBG—SÒ&6†V6¶&÷‚"6Æ73Ò'&V2ÖVæ&ÆR"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"G¶6†V6¶VGÓà¢Ç7â6Æ73Ò'&V2×FövvÆR×G&6²#ãÇ7â6Æ73Ò'&V2×FövvÆRÖ¶æö"#ãÂ÷7ããÂ÷7ãà¢ÂöÆ&VÃæ ¢6öç7BGW'FâÒ—FV×4Æö6¶VBòrr¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2ÖGW"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"F—FÆSÒ$GWÆ–6FRF†—2—FVÒ#î(éƒÂö'WGFöãæ ¢òò&WÆ6RâWFòÖ6GW&VB6Æ—v—F‚F–ffW&VçB5%BW†×ÆRöbF†P¢òò6ÖRv÷&B‡–6¶W"’âÖçVÂ6&G2†fRæò5%B6÷W&6RÂ6òæò	øë"à¢6öç7B&WÄ'FâÒ†—FV×4Æö6¶VBÇÂö—4ÖçVÄ—FVÒ†—B’’òrr¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×&WÆ6R"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"F—FÆSÒ%&WÆ6Rv—F‚F–ffW&VçBWFòÖ6GW&VBW†×ÆR#ï	øë#Âö'WGFöãæ ¢6öç7BFVÄ'FâÒ—FV×4Æö6¶VBòrr¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2ÖFVÂ"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"F—FÆSÒ%&VÖ÷fRF†—2—FVÒ#î)ÉSÂö'WGFöãæ ¢6öç7Bö—4Æ7BÒöÇ†W&RbböÇ†W&Rç7BÓÓÒ7BbböÇ†W&RçrÓÓÒrbböÇ†W&Ræ–G‚ÓÓÒ–G€¢òòÖçVÂVçG&–W3¢&VæFW"F†R6÷W&6R÷F&vWBFW‡BöâF†RÖ–â&÷p¢òòæBF†R÷F–öæÂÖVF–Æ–æ²26ÖÆÂ&FvR–ç7FVBöbF†P¢òò•B–B+rF–ÖW7F×2F†B6GW&VB—FV×26†÷rà¢ÆWBö—FVÕFW‡D‡FÖÀ¢–b…ö—4ÖçVÄ—FVÒ†—B’’°¢òòG'Væ6FR$Tdõ$RW66–ærâF†R÷F†W"v’&÷VæBÂ7WB6âÆæ@¢òò–ç6–FRâVçF—G’(	Bf×¶&V6öÖW2fÖ(	BæBF†R&÷rVÖ—G0¢òò'&ö¶VâÖ&·Wà¢6öç7B÷7&56†÷vâÒ÷G'Væ6FU&Wf–Wr…ö6&EÆ–åFW‡B†—Bç6÷W&6R’Â$T5ô•DTÕõDU…EôÔ‚¢6öç7B÷FwE6†÷vâÒ÷G'Væ6FU&Wf–Wr…ö6&EÆ–åFW‡B†—BçF&vWB’Â$T5ô•DTÕõDU…EôÔ‚¢6öç7B7&2ÒòæW66R…÷7&56†÷vâ¢6öç7BFwBÒòæW66R…÷FwE6†÷vâ¢òò6''’Ö÷&RöbF†R6&Böâ†÷fW"(	B'WBöæÇ’v†VâF†R&÷r—0¢òò7GVÆÇ’†–F–ær6öÖWF†–ærâFööÇF—&WVF–ærv†B—2Ç&VG¢òòöâ67&VVâ—2æö—6RÂæBF—FÆSÒ""öâ6&Bv—F‚æòFW‡BBÆÀ¢òò7W&W76W2v†FWfW"FööÇF—âæ6W7F÷"v÷VÆB†fR6†÷vâà¢òò6VBFöó¢æF—fRFööÇF—†öÆF–ærv†öÆR6F–öâ&Æö6²—0¢òò—G2÷vâ¶–æBöbVçW6&ÆRà¢6öç7B÷7&4gVÆÂÒ÷G'Væ6FU&Wf–Wr…ö6&EÆ–åFW‡B†—Bç6÷W&6R’Â$T5ô•DTÕõD•DÄUôÔ‚¢6öç7B÷FwDgVÆÂÒ÷G'Væ6FU&Wf–Wr…ö6&EÆ–åFW‡B†—BçF&vWB’Â$T5ô•DTÕõD•DÄUôÔ‚¢6öç7Bö6&E6†÷vâÒGµ÷7&56†÷vçÒGµ÷FwE6†÷vâò(i"Gµ÷FwE6†÷vçÖ¢rwÖ ¢6öç7Bö6&DgVÆÂÒGµ÷7&4gVÆÇÒGµ÷FwDgVÆÂò(i"Gµ÷FwDgVÆÇÖ¢rwÖ ¢6öç7B÷F—FÆTGG"Ò…ö6&DgVÆÂbbö6&DgVÆÂÓÒö6&E6†÷vâ¢òF—FÆSÒ"GµòæW66R…ö6&DgVÆÂ—Ò& ¢¢rp¢6öç7Bö—4VF–òÒ—BæÖVF–¶–æBÓÓÒvVF–òrÇÂö—4VF–ôÖVF–W&Â†—BæÖVF–W&Â¢òòW"Öf6R&V6÷&F–æw2V6‚vWBF†V—"÷vâÆ’&FvRâÆ’–âÆ6P¢òòf–VF–ô'&–FvR(	Bf–ÆS¢òò6âwB&R÷VæVB2æ÷&ÖÂÆ–æ²à¢òòFFÖVF–ò×W&Â—2&VB'’FVÆVvFVB6Æ–6²†æFÆW"–ç7FÆÆV@¢òòöæ6RöâF†R&Wf–WrF–Æörà¢òòF—FÆV—2W66VBÆ–¶RWfW'—F†–ærVÇ6S¢WfW'’6ÆÆW"76W2¢òòÆ—FW&ÂFöF’Â'WBF†RæW‡BöæRFò726&BÖFW&—fVBFW‡@¢òò6†÷VÆFâwB†fRFòæ÷F–6RF†BF†—2v2F†RöæRF†BF–FâwBà¢6öç7BVF–ô&FvRÒ‡W&ÂÂÆ&VÂÂF—FÆR’ÓâW&À¢òÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö—FVÒÖÖVF–&V2Ö—FVÒÖVF–ò"FFÖVF–ò×W&ÃÒ"GµòæW66R‡W&Â—Ò"F—FÆSÒ"GµòæW66R‡F—FÆR—Ò#âG¶Æ&VÇÓÂö'WGFöãæ ¢¢rp¢6öç7Bf6T&FvW2ÒVF–ô&FvR…ö6&E6÷W&6TVF–ò†—B’Â	øéžHbrÂuÆ’F†R6÷W&6R&V6÷&F–ærr¢²VF–ô&FvR…ö6&EF&vWDVF–ò†—B’Â	øéžXrÂuÆ’F†RF&vWB&V6÷&F–ærr¢òòÆ–æ²g&öÒÆ–Æ—7Bf–ÆR÷Vç2öæÇ’2‡GG‡2’†æò¦f67&—C¢WF2â’à¢6öç7BÖVF–&FvRÒ—BæÖVF–W&Âbb…ö—4VF–òÇÂö—5vV%W&Â†—BæÖVF–W&Â’¢ò…ö—4VF–ð¢òòÆVv7’6&C¢—G26–ævÆR&V6÷&F–ær7F–ÆÂÆ—fW2–âÖVF–W&Âà¢òVF–ô&FvR†—BæÖVF–W&ÂÂ	øé’rÂuÆ’&V6÷&FVBVF–òr¢¢Æ6Æ73Ò'&V2Ö—FVÒÖÖVF–"‡&VcÒ"GµòæW66R†—BæÖVF–W&Â—Ò"F&vWCÒ%ö&Ææ²"&VÃÒ&æö÷VæW""F—FÆSÒ$÷VâÖVF–‚GµòæW66R†—BæÖVF–¶–æBÇÂvÆ–æ²r—Ò’#âG¶—BæÖVF–¶–æBÓÓÒw–÷WGV&Rrò~)knûˆâr¢	ùIrwÓÂöæ¢¢rp¢òò$÷Vâ–âUT""f÷"6&G2v—F‚&öö²ö6†FW"ÖWFFF†6†FW%ö–G€¢òòÖ’&RÂ6òFW7Bv–ç7BçVÆÂ’â†æFÆVB'’FVÆVvFVB6Æ–6²à¢6öç7BWV$&FvRÒ†—Bæ&ööµö¶W’bb—Bæ6†FW%ö–G‚ÒçVÆÂ¢òÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö—FVÒÖÖVF–&V2Ö—FVÒÖWV""FFÖ&öö²Ö¶W“Ò"GµòæW66R…7G&–ær†—Bæ&ööµö¶W’’—Ò"FFÖ6†FW"Ö–GƒÒ"GµòæW66R…7G&–ær†—Bæ6†FW%ö–G‚’—Ò"F—FÆSÒ$÷Vâ–âGµòæW66R…7G&–ær†—Bæ6†FW%÷F—FÆRÇÂ—Bæ&ööµ÷F—FÆRÇÂwF†R&öö²r’—Ò#ï	ù9cÂö'WGFöãæ ¢¢rp¢ö—FVÕFW‡D‡FÖÂÒÇ7â6Æ73Ò'&V2Ö—FVÒ×FW‡B&V2Ö—FVÒÖÖçVÂG¶—BæVæ&ÆVBÓÓÒfÇ6Ròr&V2Ö—FVÒÖöfbr¢rwÒ"Gµ÷F—FÆTGG'Óï	ù9ÒG·7&7ÒG·FwBò(i"G·FwGÖ¢rwÓÂ÷7ãâG¶f6T&FvW7ÒG¶ÖVF–&FvWÒG¶WV$&FvWÖ°¢†—FV×4Æö6¶VBòrr¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2ÖÖçVÂÖVF—B"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"F—FÆSÒ$VF—BF†—26&B#î)ÈãÂö'WGFöãæ¢ÒVÇ6R°¢òò6GW&VB—FVÒw2vÆ÷72—2W7VÆÇ’6†÷'B‡&6RÂ'WBæ÷F†–æp¢òòVæf÷&6W2F†B(	BG&ç6ÆFVBÆöærÆ–æRÆæG2†W&R–âgVÆÂæ@¢òò7G&WF6†W2F†R&÷rW†7FÇ’2âVçG'Væ6FVB6&BFöW2à¢6öç7BövÆ÷74gVÆÂÒ7G&–ær†—BçF&vWBÇÂrr’ç&WÆ6R‚õÇ2²örÂrr’çG&–Ò‚¢6öç7BövÆ÷756†÷vâÒ÷G'Væ6FU&Wf–Wr…övÆ÷74gVÆÂÂ$T5ô•DTÕõDU…EôÔ‚¢6öç7BövÆ÷75F—FÆRÒ°¢—BçF&vWDWFòòtWFòÆ6V†öÆFW"G&ç6ÆF–öâr¢rrÀ¢övÆ÷756†÷vâÓÓÒövÆ÷74gVÆÂòrr¢÷G'Væ6FU&Wf–Wr…övÆ÷74gVÆÂÂ$T5ô•DTÕõD•DÄUôÔ‚’À¢Òæf–ÇFW"„&ööÆVâ’æ¦ö–â‚r(	Br¢6öç7BvÆ÷74‡FÖÂÒövÆ÷74gVÆÀ¢òÇ7â6Æ73Ò'&V2Ö—FVÒÖvÆ÷72"GµövÆ÷75F—FÆRòF—FÆSÒ"GµòæW66R…övÆ÷75F—FÆR—Ò&¢rwÓî(i"GµòæW66R…övÆ÷756†÷vâ—ÓÂ÷7ãæ ¢¢rp¢ö—FVÕFW‡D‡FÖÂÒÇ7â6Æ73Ò'&V2Ö—FVÒ×FW‡BG¶—BæVæ&ÆVBÓÓÒfÇ6Ròr&V2Ö—FVÒÖöfbr¢rwÒ#âGµòæW66R†—Bæ–B—Ò+rGµòæW66R†—BçF–ÖU7F'B—×>(	2GµòæW66R†—BçF–ÖTVæB—×2G¶vÆ÷74‡FÖÇÓÂ÷7ãæ ¢Ð¢‡FÖÂ³ÒÆF—b6Æ73Ò'&V2Ö—FVÒG¶—FV×4Æö6¶VBòr&V2Ö—FVÒ×&VFöæÇ’r¢rwÒGµö—4Æ7Bòr&V2Ö—FVÒÖÆ7GÆ–VBr¢rwÒ"FFÖ–GƒÒ"G¶–G‡Ò#à¢ÆF—b6Æ73Ò'&V2Ö—FVÒ×&÷s#à¢Ç7â6Æ73Ò'&V2Ö—FVÒÖæò#ãÂ÷7ãà¢G¶VF—D6öçG&öÇ7Ð¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×Æ’Ög&öÒ"FF×7CÒ"G·7DW67Ò"FF×sÒ"G·tW67Ò"FFÖ–GƒÒ"G¶–G‡Ò"F—FÆSÒ%Æ’g&öÒF†—2—FVÒ#î)kcÂö'WGFöãà¢G¶GW'FçÐ¢G·&WÄ'FçÐ¢Gµö—FVÕFW‡D‡FÖÇÐ¢G¶6÷”÷F–öç7Ð¢G¶FVÄ'FçÐ¢ÂöF—cà¢Gµö—4ÖçVÄ—FVÒ†—B’òrr¢ÆF—b6Æ73Ò'&V2Ö—FVÒ×&Wf–Wr"Gµ÷VæF–ætGG'ÒFFÖ–CÒ"GµòæW66R†—Bæ–B—Ò"FFÖÆ–æSÒ"GµòæW66R…7G&–ær†—BæÆ–æT–æFW‚ÓÒçVÆÂòrr¢—BæÆ–æT–æFW‚’—Ò"FF×G3Ò"GµòæW66R…7G&–ær†—BçF–ÖU7F'BÓÒçVÆÂòrr¢—BçF–ÖU7F'B’—Ò"FF×FSÒ"GµòæW66R…7G&–ær†—BçF–ÖTVæBÓÒçVÆÂòrr¢—BçF–ÖTVæB’—Ò"FF×v÷&CÒ"GµòæW66R†—Bçv÷&BÇÂrr—Ò"F—FÆSÒ%6÷W&6R7V'F—FÆRÆ–æR#âGµòæW66R…÷&Wf–WuFW‡B—ÓÂöF—cæÐ¢ÂöF—cæ ¢Ò¢‡FÖÂ³ÒÂöF—cãÂöF—cæ ¢Ò¢–b‡&Wf–Wrç'Vç5·'Vä–æFW‚²Óòç7BÓÒ7B’‡FÖÂ³ÒÂöF—cæ ¢Ò¢Ð¢òò6Æ÷6Rv†–ÆRF†RöÆB–6¶W"—27F–ÆÂGF6†VBâ6VÆV7C"Æö6·267&öÆÆ&ÆP¢òòæ6W7F÷'2v†–ÆR÷VâæBf–æG2F†÷6Ræ6W7F÷'2v–âv†Vâ6Æ÷6–ærà¢òò&VÖ÷f–ær—G26öçF–æW"f—'7B7G&æG2F†B†æFÆW"öâF†—2F–ÆörÂ6ð¢òòWfW'’7V'6WVVçB67&öÆÂ—2f÷&6VB&6²FòF†RG&÷F÷vâw2öÆBöfg6WBà¢6öç7BFöÆE–6¶W"ÒFFÆræf–æB‚r7&V5&V56VÆV7Bç6VÆV7C"Ö†–FFVâÖ66W76–&ÆRr¢–b‚FöÆE–6¶W"æÆVæwF‚’°¢FöÆE–6¶W"ç6VÆV7C"‚v6Æ÷6Rr¢FöÆE–6¶W"ç6VÆV7C"‚vFW7G&÷’r¢Ð¢6öç7Bf–ÇFW$fö7W2ÒFö7VÖVçBæ7F—fTVÆVÖVçCòæ–BÓÓÒwÆ–Æ—7Df–ÇFW"rò·7F'C¦Fö7VÖVçBæ7F—fTVÆVÖVçBç6VÆV7F–öå7F'BÆVæC¦Fö7VÖVçBæ7F—fTVÆVÖVçBç6VÆV7F–öäVæGÒ¢çVÆÀ¢FFÆræ‡FÖÂ†‡FÖÂ²vTæb¢öÖ÷VçEÆ–Æ—7DÆ–'&'’‚FFÆr¢÷&VçVÖ&W%&V4—FV×2‚FFÆr ¢FFÆræöfb‚v6Æ–6²rÂrç&V2×vR×7FWr’æöâ‚v6Æ–6²rÂrç&V2×vR×7FWrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢FFÆu³Òå÷&V5vRÒçVÖ&W"‚B‡F†—2’æGG"‚vFF×vRr’¢÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò¢FFÆræöfb‚v6†ævRrÂrç&V2×vRÖ–çWBr’æöâ‚v6†ævRrÂrç&V2×vRÖ–çWBrÂgVæ7F–öâ†R’°¢Rç7F÷&÷vF–öâ‚¢FFÆu³Òå÷&V5vRÒçVÖ&W"‚B‡F†—2’çfÂ‚’’Ò¢÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò ¢FFÆræöfb‚v6Æ–6²rÂrç&V2ÖFVÂr’æöâ‚v6Æ–6²rÂrç&V2ÖFVÂrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚¢Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢&VÖ÷fU&V6÷&FVD—FVÒ‡7BÂrÂ–G‚¢÷Vå&V6÷&F–æu&Wf–WtF–Æör‚’òò&Vg&W6€¢Ò ¢òòÖ÷fRâ—FVÒ'’G—–ær—G2æWr÷6—F–öââF†—2—2F†RôäÅ’&V÷&FW"F†@¢òòv÷&·2öâ†öæR(	BF†RG&r†æFÆR—2–æW'BF†W&R‡6VRF†R6÷'F&ÆR–æ—@¢òò&VÆ÷r’(	BæBöâFW6·F÷—B6—G2Æöæw6–FRG&vv–ærf÷"ÆöærÆ—7G2v†W&P¢òòG&vv–ær7&÷7267&öÆÂ—2–ægVÂà¢FFÆræöfb‚v6Æ–6²rÂrç&V2ÖG&rr’æöâ‚v6Æ–6²rÂrç&V2ÖG&rrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚¢Rç7F÷&÷vF–öâ‚¢òò6ö×ÆWFVBG&rÇ6òf—&W26Æ–6²öâF†R†æFÆS²F†B6Æ–6²×W7Bæ÷@¢òòF†Vâ6²f÷"÷6—F–öâöâF÷öbF†RÖ÷fRF†RW6W"§W7BÖFRà¢–b…÷&V4G&t§W7E6÷'FVB’&WGW&à¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢6öç7B'"Ò‚‡v–æF÷rå÷&V6÷&F–æræ—FV×2ÇÂ·Ò•·7EÒÇÂ·Ò•·uÐ¢6öç7BÆVâÒ'&’æ—4'&’†'"’ò'"æÆVæwF‚¢ ¢–b†ÆVâÂ"’²ö7'V–ÆEFö7B‚tæ÷F†–ærFò&V÷&FW"(	BF†—2w&÷W†2öæR—FVÒâr“²&WGW&âÐ¢òò6—2&–âF†—2w&÷W"&V6W6RF†RçVÖ&W"öâF†R&÷r6÷VçG2F†Rv†öÆP¢òòÆ–Æ—7BÂv†–ÆRF†—2Ö÷fR—26öæf–æVBFòF†Rw&÷WF†R—FVÒ6—G2–âà¢6öç7B&rÒ&ö×B†Ö÷fRFò÷6—F–öâ–âF†—2w&÷Wƒ(	2G¶ÆVçÒ“¦Â7G&–ær†–G‚²’¢–b‡&rÓÒçVÆÂ’&WGW&à¢6öç7B÷2Ò'6T–çB…7G&–ær‡&r’çG&–Ò‚’Â¢–b‚çVÖ&W"æ—4f–æ—FR‡÷2’’&WGW&à¢–b‡÷2ÂÇÂ÷2âÆVâ’²ÆW'B†VçFW"÷6—F–öâ&WGvVVâæBG¶ÆVçÒæ“²&WGW&âÐ¢–b†Ö÷fU&V6÷&FVD—FVÒ‡7BÂrÂ–G‚Â÷2Ò’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚’òò&Vg&W6€¢Ò ¢FFÆræöfb‚v6†ævRrÂrç&V2ÖVæ&ÆRr’æöâ‚v6†ævRrÂrç&V2ÖVæ&ÆRrÂgVæ7F–öâ†R’°¢Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢6öç7BöâÒB‡F†—2’æ—2‚s¦6†V6¶VBr¢÷6WE&V6÷&FVD—FVÔVæ&ÆVB‡7BÂrÂ–G‚Âöâ¢òòf—7VÆÇ’F–ÒF†R&÷rv—F†÷WB&R×&VæFW&–ærÂFò¶VW67&öÆÂöfö7W2à¢B‡F†—2’æ6Æ÷6W7B‚rç&V2Ö—FVÒr’æf–æB‚rç&V2Ö—FVÒ×FW‡Br’çFövvÆT6Æ72‚w&V2Ö—FVÒÖöfbrÂöâ¢Ò ¢òòÆ’g&öÒ7V6–f–2—FVÒ(	B'V–ÆG2F†R6ÖRVWVRæB&÷FFW26òF†—0¢òò—FVÒ—2–æFW‚â†öæ÷W'2F†RW6W"w27W'&VçB6‡VffÆRöÆö÷6WGF–æw2à¢FFÆræöfb‚v6Æ–6²rÂrç&V2×Æ’Ög&öÒr’æöâ‚v6Æ–6²rÂrç&V2×Æ’Ög&öÒrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢6öç7B&V4æÖRÒv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢G'’²FFÆræF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢Æ•&V6÷&F–ær‡²7F'D—FVÓ¢²&V4æÖRÂ7BÂrÂ–G‚ÒÒ¢Ò ¢òòGWÆ–6FR6–ævÆR—FVÒ(	B–ç6W'G26÷’&–v‡BgFW"F†R÷&–v–æÂà¢FFÆræöfb‚v6Æ–6²rÂrç&V2ÖGWr’æöâ‚v6Æ–6²rÂrç&V2ÖGWrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢–b†GWÆ–6FU&V6÷&FVD—FVÒ‡7BÂrÂ–G‚’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò ¢òò&WÆ6RâWFòÖ6GW&VB—FVÒv—F‚F–ffW&VçB5%BW†×ÆR‡–6¶W"F–Æör’à¢FFÆræöfb‚v6Æ–6²rÂrç&V2×&WÆ6Rr’æöâ‚v6Æ–6²rÂrç&V2×&WÆ6RrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢ö÷Vå&WÆ6T—FVÔF–Æör‡7BÂrÂ–G‚¢Ò ¢òò6†ö÷6RF†RFW7F–æF–öâæB–ç6W'F–öâ–æFW‚&Vf÷&R6÷––ær6&Bà¢FFÆræöfb‚v6Æ–6²rÂrç&V2Ö6÷’×Fòr’æöâ‚v6Æ–6²rÂrç&V2Ö6÷’×FòrÂgVæ7F–öâ†R’°¢Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢6öç7B7&2Òv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢ö÷Vä6&DFW7F–æF–öäF–Æör‚t6÷’6&BrÂ÷&VfW'&VD6&EÆ–Æ—7B…ö6F–öäFW7F–æF–öç2‚’Ârr’ÂBÓâ°¢6öç7Bö²Ò6÷”—FVÕFõÆ–Æ—7B‡7&2Â7BÂrÂ–G‚ÂBææÖRÂBæ–æFW‚¢–b‚ö²’²ÆW'B‚t6÷’f–ÆVB(	B6†ö÷6Ræ÷F†W"w&—F&ÆRÆ–Æ—7Bâr“²&WGW&âfÇ6RÐ¢÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢&WGW&âG'VP¢ÒÂö6F–öäFW7F–æF–öç2‚’æf–ÇFW"†âÓââÓÒ7&2’¢Ò ¢òò)H)H&V6÷&F–æw2Ö†VFW"5%TB†æFÆW'2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢FFÆræöfb‚v6†ævRrÂr7&V5&V56VÆV7Br’æöâ‚v6†ævRrÂr7&V5&V56VÆV7BrÂgVæ7F–öâ†R’°¢Rç7F÷&÷vF–öâ‚¢6öç7BæÖRÒ7G&–ær‚B‡F†—2’çfÂ‚’ÇÂrr¢ö6öÆÆ6UÆ–Æ—7D'&÷w6W"‚¢–b‡6VÆV7E&V6÷&F–ær†æÖR’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V4æWrr’æöâ‚v6Æ–6²rÂr7&V5&V4æWrrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BæÖRÒ&ö×B‚tæÖRf÷"F†RæWrÆ–Æ—7C¢r¢–b†æÖRbb7&VFU&V6÷&F–ær†æÖR’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V4æWuf—'GVÂr’æöâ‚v6Æ–6²rÂr7&V5&V4æWuf—'GVÂrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢ö÷Våf—'GVÅÆ–Æ—7DVF—F÷"†çVÆÂ¢Ò¢òò&7F–6R&æFöÓ¢÷VâF†R'V–ÆFW"F–ÆörFò6ö×÷6R&æFöÒÆ–Æ—7Bg&öÐ¢òòF†RWFöÖF–2‡fö6'VÆ'’7V'F—FÆR66â’æBö÷"ÖçVÂ†6GW&VB’6÷W&6W2à¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V5&æFöÒr’æöâ‚v6Æ–6²rÂr7&V5&V5&æFöÒrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢ö÷Vå&æFöÔ'V–ÆFW$F–Æör‚¢Ò¢òòg&öÒ6FVv÷'“¢'V–ÆB¶WBÆ–Æ—7Böb7V'F—FÆRW†×ÆW2f÷"WfW'’v÷&B–à¢òòöæR6†÷6Vâfö6'VÆ'’6FVv÷'’‡6–ævÆRÖ6FVv÷'’Âæò&æFöÒ6×Æ–ær’à¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V4g&öÔ6FVv÷'’r’æöâ‚v6Æ–6²rÂr7&V5&V4g&öÔ6FVv÷'’rÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢ö÷Vä6FVv÷'•Æ–Æ—7DF–Æör‚¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V4FDÖçVÂr’æöâ‚v6Æ–6²rÂr7&V5&V4FDÖçVÂrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢ö÷VäÖçVÄVçG'”VF—F÷"‡v–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖRÂçVÆÂ¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V5G&ç6ÆFRr’æöâ‚v6Æ–6²rÂr7&V5&V5G&ç6ÆFRrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢÷G&ç6ÆFUÆ–Æ—7E‡&6W2‚B‡F†—2’¢Ò¢FFÆræöfb‚v6Æ–6²rÂrç&V2Ö—FVÒÖWV"r’æöâ‚v6Æ–6²rÂrç&V2Ö—FVÒÖWV"rÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B&öö´¶W’Ò7G&–ær‚B‡F†—2’æGG"‚vFFÖ&öö²Ö¶W’r’ÇÂrr¢6öç7B6’Ò'6T–çB‚B‡F†—2’æGG"‚vFFÖ6†FW"Ö–G‚r’Â¢ö÷VäWV$f÷$6&B†&öö´¶W’ÂçVÖ&W"æ—4f–æ—FR†6’’ò6’¢B‡F†—2’æGG"‚vFFÖ6†FW"Ö–G‚r’¢Ò¢FFÆræöfb‚v6Æ–6²rÂrç&V2ÖÖçVÂÖVF—Br’æöâ‚v6Æ–6²rÂrç&V2ÖÖçVÂÖVF—BrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7BÒ7G&–ær‚B‡F†—2’æFF‚w7Br’¢6öç7BrÒ7G&–ær‚B‡F†—2’æFF‚wrr’¢6öç7B–G‚Ò'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â¢6öç7B—FV×2Òv–æF÷rå÷&V6÷&F–æræ—FV×2ÇÂ·Ð¢6öç7B'"Ò†—FV×5·7EÒbb—FV×5·7EÕ·uÒ’ÇÂµÐ¢6öç7B—BÒ'%¶–G…Ð¢–b‚—BÇÂö—4ÖçVÄ—FVÒ†—B’’&WGW&à¢ö÷VäÖçVÄVçG'”VF—F÷"‡v–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖRÂ—B¢Ò¢òò–æÆ–æRÆ–&6²f÷"F†R	øé’&FvR(	Bf–ÆS¢òòU$Ç26âwB&R÷VæVB0¢òòæ÷&ÖÂÆ–æ·26òvR&÷VæB×G&—F‡&÷Vv‚F†RVF–ô'&–FvRâW6W2F†R6†&V@¢òò&Wf–Wr6–ævÆWFöâ6òF†R'WGFöâFövvÆW2	øé’(iB)j’ÂW'&÷'2FöâwBf–À¢òò6–ÆVçFÇ’ÂæB7F'F–æræ÷F†W"&÷rw2VF–ò7F÷2F†—2öæRf—'7Bà¢FFÆræöfb‚v6Æ–6²rÂrç&V2Ö—FVÒÖVF–òr’æöâ‚v6Æ–6²rÂrç&V2Ö—FVÒÖVF–òrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BW&ÂÒB‡F†—2’æGG"‚vFFÖVF–ò×W&Âr’ÇÂrp¢–b‚W&Â’&WGW&à¢÷7F'DÖçVÄVF–õ&Wf–Wr‡W&ÂÂB‡F†—2’¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5f—'GVÄVF—Br’æöâ‚v6Æ–6²rÂr7&V5f—'GVÄVF—BrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢ö÷Våf—'GVÅÆ–Æ—7DVF—F÷"‡v–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V5&VæÖRr’æöâ‚v6Æ–6²rÂr7&V5&V5&VæÖRrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BöÆDâÒv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢–b…÷&VgW6U&VDöæÇ•Æ–Æ—7B†öÆDâ’’&WGW&à¢6öç7BæWtâÒ&ö×B‚u&VæÖR&V6÷&F–æs¢rÂöÆDâ¢–b†æWtâbb&VæÖU&V6÷&F–ær†öÆDâÂæWtâ’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V4GWÆ–6FRr’æöâ‚v6Æ–6²rÂr7&V5&V4GWÆ–6FRrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7&2Òv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢6öç7BæWtâÒ&ö×B‚tæÖRf÷"F†RGWÆ–6FS¢rÂ7&2²r†6÷’’r¢–b†æWtâbbGWÆ–6FU&V6÷&F–ær‡7&2ÂæWtâ’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V4FVÆWFRr’æöâ‚v6Æ–6²rÂr7&V5&V4FVÆWFRrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢–b†FVÆWFU&V6÷&F–ær‡v–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’’÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò¢FFÆræöfb‚v6Æ–6²rÂr7&V5&V57–æ2r’æöâ‚v6Æ–6²rÂr7&V5&V57–æ2rÂ7–æ2gVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢–b‚÷&WV—&U6VÆb‚’’&WGW&à¢G'’°¢v—B7–æ5&V6÷&F–æw5Fôv—F‡V"‚¢òò&R×&VæFW"6òF†R6÷VçB–âF†R6VÆV7F÷"&VfÆV7G2F†RÖW&vVB&VÖ÷FRà¢÷Vå&V6÷&F–æu&Wf–WtF–Æör‚¢Ò6F6‚…ò’²ò¢Ç&VG’ÆW'FVB¢òÐ¢Ò¢òò&VfÆV7BF—'G’7FFRöâF†R'WGFöâ26ööâ2F†R†VFW"—2–âF†RDôÒà¢÷&Vg&W6…&V6÷&F–æu7–æ4'Fâ‚ ¢òòG&r×Fò×&V÷&FW"v—F†–âV6‚v÷&Bw&÷WâfÆÇ2&6²w&6VgVÆÇ’–b¥VW'¢òòT’—6âwBÆöFVB(	BF†R6†V6¶&÷‚²FVÆWFR7F–öç27F–ÆÂv÷&²â6¶—VBf÷ ¢òòf—'GVÂÆ–Æ—7G2Âv†÷6R—FVÒÆ—7B—2&VBÖöæÇ’à¢òð¢òòÇ6ò6¶—VBöâ6ö'6R×ö–çFW"‡F÷V6‚’FWf–6W3¢F†—2¥VW'’T’'V–ÆB&–æG0¢òò¤U$òF÷V6‚WfVçG2Â6òF÷V6‚G&r×&V÷&FW"æWfW"v÷&¶VBöâÖö&–ÆRç—v’Âæ@¢òòF†W&Rw2æòö–çB–æ—F–Æ—6–ærv–FvWBF†B6âwBgVæ7F–öâF†W&RâFW6·F÷ ¢òò†f–æRö–çFW"’¶VW2G&r×&V÷&FW"â…F†RÖö&–ÆR67&öÆÂ×&W6WB'Vr†B¢òò6W&FR6W6R(	BF†RF–Æör&V–ær&R×&VæFW&VB'’æF—fRÆ–Æ—7BW6†W2À¢òòv†–6‚æ÷r&W6W'fW267&öÆÂ(	Bæ÷B6÷'F&ÆRâ¢6öç7Bö6ö'6Uö–çFW"Ò‚vöçF÷V6‡7F'Br–âv–æF÷r¢ÇÂ†æf–vF÷"æÖ…F÷V6…ö–çG2â¢ÇÂ‡v–æF÷ræÖF6„ÖVF–bbv–æF÷ræÖF6„ÖVF–‚r‡ö–çFW#¢6ö'6R’r’æÖF6†W2¢–b‚Bæfâç6÷'F&ÆRbb—FV×4Æö6¶VBbbö6ö'6Uö–çFW"’°¢–b‚Bæ7W—F÷"ÇÂBæ7W—F÷"ç&V6÷&F–æu6÷'F&ÆR’°¢òò¥VW'’T’&Vv—7FW'2V6‚†æFÆRv—F‚öFD6Æ726W&FVÇ’â—G0¢òòG&6¶VB6öÆÆV7F–öâ—2ÖW&vVB÷6÷'FVBöâWfW'’6ÆÂÂÖ¶–ær‡VvP¢òòÆ–Æ—7BF¶RÖ–çWFW2Fò–æ—F–Æ—6Râ&Vv—7FW"F†R6ÖR†æFÆW20¢òòöæR6öÆÆV7F–öâÂ¶VW–æræ÷&ÖÂv–FvWB6ÆVçWæBG&r&V†f–÷"à¢Bçv–FvWB‚v7W—F÷"ç&V6÷&F–æu6÷'F&ÆRrÂBçV’ç6÷'F&ÆRÂ°¢÷6WD†æFÆT6Æ74æÖS¢gVæ7F–öâ‚’°¢F†—2å÷&VÖ÷fT6Æ72‡F†—2æVÆVÖVçBæf–æB‚rçV’×6÷'F&ÆRÖ†æFÆRr’ÂwV’×6÷'F&ÆRÖ†æFÆRr¢6öç7B†æFÆW2ÒF†—2æ—FV×2æfÆDÖ†VçG'’Óà¢†VçG'’æ–ç7Fæ6Ræ÷F–öç2æ†æFÆRòVçG'’æ—FVÒæf–æB†VçG'’æ–ç7Fæ6Ræ÷F–öç2æ†æFÆR’¢VçG'’æ—FVÒ’ævWB‚’¢F†—2åöFD6Æ72‚B††æFÆW2’ÂwV’×6÷'F&ÆRÖ†æFÆRr¢Ð¢Ò¢Ð¢FFÆræf–æB‚rç&V2Ö—FVÒÖÆ—7Br’æV6‚†gVæ7F–öâ‚’°¢6öç7BFÆ—7BÒB‡F†—2¢G'’²FÆ—7Bç&V6÷&F–æu6÷'F&ÆR‚vFW7G&÷’r’Ò6F6‚…ò’·Ð¢FÆ—7Bç&V6÷&F–æu6÷'F&ÆR‡°¢—FV×3¢sâç&V2Ö—FVÒrÀ¢†æFÆS¢rç&V2ÖG&rrÀ¢6æ6VÃ¢v–çWBÇFW‡F&VÇ6VÆV7BÆ÷F–öârÀ¢†—3¢w’rÀ¢FöÆW&æ6S¢wö–çFW"rÀ¢f÷&6UÆ6V†öÆFW%6—¦S¢G'VRÀ¢Æ6V†öÆFW#¢w&V2Ö—FVÒ×Æ6V†öÆFW"rÀ¢òòF†R†æFÆR—2Ç6ò'WGFöâF†B&ö×G2f÷"÷6—F–öââ7W&W70¢òòF†B&ö×B&÷VæB&VÂG&s¢Ö÷W6WWBF†RVæBöbG&r7F–ÆÀ¢òòf—&W26Æ–6²öâF†R†æFÆRÂv†–6‚v÷VÆB÷F†W'v—6R6²F†RW6W"Fð¢òòÆ6Râ—FVÒF†W’§W7BÆ6VBà¢7F'C¢gVæ7F–öâ‚’²÷&V4G&t§W7E6÷'FVBÒG'VRÒÀ¢7F÷¢gVæ7F–öâ‚’²6WEF–ÖV÷WB‚‚’Óâ²÷&V4G&t§W7E6÷'FVBÒfÇ6RÒÂ#S’ÒÀ¢WFFS¢gVæ7F–öâ‚’°¢6öç7B7BÒ7G&–ær‚FÆ—7BæFF‚w7Br’¢6öç7BrÒ7G&–ær‚FÆ—7BæFF‚wrr’¢òò&VBF†RGG&–'WFRÂæ÷BæFF‚“¢¥VW'’66†W2FFfÇVRöà¢òòf—'7B&VBæBw&—F–ærF†RGG&–'WFR&VÆ÷rFöW2æ÷B–çfÆ–FFP¢òòF†B66†RÂ6ò6V6öæBG&r–âF†R6ÖR&VæFW"v÷VÆBÖg&öÐ¢òòF†R÷6—F–öç2öbF†Rf—'7BöæRæB6fR67&Ö&ÆVB÷&FW"à¢6öç7B÷&FW"ÒFÆ—7Bæf–æB‚sâç&V2Ö—FVÒr’æÖ†gVæ7F–öâ‚’°¢&WGW&â'6T–çB‚B‡F†—2’æGG"‚vFFÖ–G‚r’Â¢Ò’ævWB‚¢6öç7BgVÆÄ÷&FW"Ò&V6÷&F–æu&Wf–Wt÷&FW"†÷&FW"Â—FV×5·7EÕ·uÒæÆVæwF‚¢–b‚gVÆÄ÷&FW"’&WGW&à¢÷&V÷&FW%v÷&D—FV×2‡7BÂrÂgVÆÄ÷&FW"¢6öç7B÷6—F–öç2Ò÷&FW"ç6Æ–6R‚’ç6÷'B‚†Â"’ÓâÒ"¢òò&Vg&W6‚FFÖ–G‚GG'26ò7V'6WVVçB&VÖ÷fW2öVF—G2†—BF†R&–v‡@¢òòVçG&–W2v—F†÷WBgVÆÂ&R×&VæFW"(	BæBG&÷F†R66†VB6÷–W2v—F€¢òòF†VÒÂ6–æ6RF†RFVÆWFRÂGWÆ–6FRÂFövvÆRæB6÷’†æFÆW'2ÆÀ¢òò&VBF‡&÷Vv‚æFF‚’æBv÷VÆB÷F†W'v—6R7BöâF†RöÆB÷6—F–öâà¢FÆ—7Bæf–æB‚sâç&V2Ö—FVÒr’æV6‚†gVæ7F–öâ†’’°¢B‡F†—2’æGG"‚vFFÖ–G‚rÂ÷6—F–öç5¶•Ò’ç&VÖ÷fTFF‚v–G‚r¢æf–æB‚u¶FFÖ–G…Òr’æGG"‚vFFÖ–G‚rÂ÷6—F–öç5¶•Ò’ç&VÖ÷fTFF‚v–G‚r¢Ò¢÷&VçVÖ&W%&V4—FV×2‚FFÆr¢Ð¢Ò¢Ò¢Ð ¢òò–ç7V7BF†RVçF—&RÆ–Æ—7BÂ–æ6ÇVF–ærVçG&–W2&W–öæBF†R7W'&VçBvRà¢òòÖçVÂ6&Bv—F‚f6R&V6÷&F–ær†÷"ÆVv7’VF–ò–âÖVF–W&Â’6à¢òòÇ&VG’Æ’–âF†RFV6²w2æF—fRVF–òVÆVÖVçBâVæ&ÆRÆ–W"f÷"—BÀ¢òòv†–ÆR¶VW–ærFW‡BÖöæÇ’ò&VfW&Væ6RÖÆ–æ²ÖöæÇ’ÖçVÂÆ–Æ—7G2–â&7F–6Rà¢6öç7B†5Æ–W$—FV×2Òö&¦V7BçfÇVW2†—FV×2’ç6öÖR‡v÷&G2Óâö&¦V7BçfÇVW2‡v÷&G2ÇÂ·Ò’ç6öÖR†'"Óà¢'&’æ—4'&’†'"’bb'"ç6öÖR†—BÓâ—Bbb€¢ö—4ÖçVÄ—FVÒ†—B’ÇÂ7÷F–g”6Æ—2†—B’æÆVæwF‚âÇÀ¢ö6&D†4VF–ò†—B’ÇÂö—4VF–ôÖVF–W&Â†—BæÖVF–W&Â¢’’’¢6öç7B÷G2Ò°¢F—FÆS¢uÆ–Æ—7G2rÀ¢F–Æöt6Æ73¢wÆ–Æ—7BÖÆ–'&'’ÖF–ÆörrÀ¢v–GFƒ¢ÖF‚æÖ–âƒÂB‡v–æF÷r’çv–GF‚‚’Ò#B’À¢†V–v‡C¢ÖF‚æÖ–âƒƒ#ÂB‡v–æF÷r’æ†V–v‡B‚’ÒC‚’À¢ÖöFÃ¢fÇ6RÀ¢WFô÷Vã¢G'VRÀ¢òòæòG&r÷&W6—¦S¢F†RvÆö&ÂF–Æöv÷Vâ†æFÆW"–ç2F†R÷6—F–öâç—v’À¢òò6òG&r×FòÖÖ÷fR—6âwBW6VgVÂ†W&RÂæBF†R&W6—¦R†æFÆW2FBw&W ¢òò6‡&öÖRvRFöâwBvçBâ…F†W6RFöâwBffV7B67&öÆÆ–ær(	BF†R&7F–6RÆöp¢òòF–ÆörÇ6òW6W2G&vv&ÆS¦fÇ6RæB67&öÆÇ2f–æRöâÖö&–ÆRâ¢G&vv&ÆS¢fÇ6RÀ¢&W6—¦&ÆS¢fÇ6RÀ¢'WGFöç3¢°¢òò&VÇBÖæB×7W7VæFW'26Æ÷6S¢¥VW'’T’w2F–Æör‚v6Æ÷6Rr’6öÖWF–ÖW0¢òò&6W2v—F‚fö7W2ò7–æ2&VæFW"v÷&²æBÆVfW2F†Rw&W"f—6–&ÆP¢òò&V†–æBF†RæW‡Bf–Wrâf÷&6RÖ†–FRF†Rw&W"2&6·W6òF†P¢òòW6W"FöW6âwB6VRF†R&V6÷&FVB6V&6†W2æVÂfÆöF–ær÷fW"F†P¢òò&7F–6R6&B÷"F†RÆ––ær&V6÷&F–ærà¢òð¢òò&÷F‚7F–öâ'WGFöç2&ö×BFò&W7VÖRÖ÷"×&W7F'Bv†VâF†W&Rw2¢òò&V6÷fW&&ÆRÆ7B×Æ–VB—FVÒöâD„•2Æ–Æ—7B‡6VP¢òòöÖ–&U&W7VÖU7F'D—FVÒ’â6æ6VÂ–âF†R6öæf—&ÒÒ7F'Bg&W6‚à¢uÆ’ÆÂs¢²FW‡C¢uÆ’ÆÂrÂF—6&ÆVC¢†5Æ–W$—FV×2Â6Æ–6³¢gVæ7F–öâ‚’°¢6öç7BGrÒB‡F†—2’æ6Æ÷6W7B‚rçV’ÖF–Æörr¢G'’²B‡F†—2’æF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢Græ†–FR‚¢G'’²WFô†–FU6WGF–æw5æVÂ‚’Ò6F6‚…ò’·Ð¢6öç7B&W7VÖUVWVRÒöÖ–&U&W7VÖU7F'D—FVÒ‚wÆ’r¢Æ•&V6÷&F–ær‡&W7VÖUVWVRò²&W7VÖUVWVRÒ¢VæFVf–æVB¢ÒÒÀ¢u&7F–6Rs¢gVæ7F–öâ‚’°¢6öç7BGrÒB‡F†—2’æ6Æ÷6W7B‚rçV’ÖF–Æörr¢G'’²B‡F†—2’æF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢Græ†–FR‚¢G'’²WFô†–FU6WGF–æw5æVÂ‚’Ò6F6‚…ò’·Ð¢6öç7B&W7VÖUVWVRÒöÖ–&U&W7VÖU7F'D—FVÒ‚w&7F–6Rr¢÷Vå&7F–6TÖöFR‡&W7VÖUVWVRò²&W7VÖUVWVRÒ¢VæFVf–æVB¢ÒÀ¢t6Æ÷6Rs¢gVæ7F–öâ‚’°¢6öç7BGrÒB‡F†—2’æ6Æ÷6W7B‚rçV’ÖF–Æörr¢G'’²B‡F†—2’æF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢Græ†–FR‚¢Ð¢Ð¢Ð¢–b‚FFÆræ†46Æ72‚wV’ÖF–ÆörÖ6öçFVçBr’’°¢FFÆræF–Æör‚v÷F–öârÂ÷G2’æF–Æör‚v÷Vâr¢ÒVÇ6R°¢FFÆræF–Æör†÷G2¢Ð¢òò&Wf–Ww2WFFR–âÆ6S²æF—fR67&öÆÆ–æræB67&öÆÂæ6†÷&–ær†æFÆP¢òòF†V—"Æ–÷WB6†ævW2v—F†÷WB&ö&–ær÷"&Ww&—F–ærF†R67&öÆÂ÷6—F–öâà¢öÆ§”ÆöE&V4—FVÕ&Wf–Ww2‚FFÆr¢æ6F6‚†RÓâ6öç6öÆRçv&â‚w&Wf–WrÆ§’ÖÆöBf–ÆVBrÂR’¢òòF–Æör‚v÷F–öârÂ÷G2’&RÖ6VçG&W2WfVââÇ&VG’Ö÷Vâv–FvWBÂv—F†÷W@¢òòf—&–ærF–Æöv÷Vâ‡v†–6‚æ÷&ÖÆÇ’–ç2—B’â¶VWF†Rf–Ww÷'B÷6—F–öà¢òòF‡&÷Vv‚&Vg&W6†W22vVÆÂ2F†RæF—fR67&öÆÂöfg6WBà¢–b…÷&WdF–Æöu÷6—F–öâ’FFÆræ6Æ÷6W7B‚rçV’ÖF–Æörr’æ772…÷&WdF–Æöu÷6—F–öâ¢òò&W7F÷&R7–æ6‡&öæ÷W6Ç’âÆFW"6ÆÆ&6·2×W7Bæ÷B÷fW'w&—FRæWvW"67&öÆÂà¢òò7v—F6†–ærÆ–Æ—7G2÷"vW27F'G2Bà¢–b†f–ÇFW$fö7W2’°¢6öç7B–çWCÒFFÆræf–æB‚r7Æ–Æ—7Df–ÇFW"r•³Ð¢–çWBæfö7W2‡·&WfVçE67&öÆÃ§G'VWÒ“¶–çWBç6WE6VÆV7F–öå&ævR†f–ÇFW$fö7W2ç7F'BÆf–ÇFW$fö7W2æVæB¢Ð¢–b…÷v4÷Vâ’FFÆu³Òç67&öÆÅF÷Ò÷&We67&öÆÅF÷ §Ð ¢òòöÆÂ6GW&VB6Æ—Fò—G2VæBâF†R7W'&÷VæF–ærGFV×B&÷VæG2WfW'¢òò&W&F–öâ÷Æ–&6²v—BæB6æ6VÇ27FÆR6öÖÖæG2öâæf–vF–öâà¢òòÖÆf÷&ÖVBv–æF÷w2&R&W—&VB&Vf÷&RÆ–&6²v†W&R÷76–&ÆRÂ÷F†W'v—6P¢òò6¶—VB&F†W"F†âv—F–æröââVç&V6†&ÆRF–ÖW7F×à¦6öç7BÔ…õ$T4ôä$ÄUô4Ä•õ2Òc ¦6öç7B÷Æ–W$Æ–fV7–6ÆRÒ7&VFTÆ–fV7–6ÆT6Æö6²‡v–æF÷r¦6öç7B7÷F–g•Æ–W"Ò7&VFU7÷F–g•7GVG•Æ–W"‡°¢v–ã¢v–æF÷rÂ—4f÷&Vw&÷VæC¢‚’Óâ÷Æ–W$Æ–fV7–6ÆRæ—4f÷&Vw&÷VæB‚’À¢æ÷s¢‚’Óâ÷Æ–W$Æ–fV7–6ÆRææ÷r‚’Âöå7FGW3¢ÖW76vRÓâö7'V–ÆEFö7B†ÖW76vR§Ò§v–æF÷rævWE7÷F–g•Æ–&6´ÆörÒ‚’Óâ7÷F–g•Æ–W"ævWEÆ–&6´Æör‚§v–æF÷ræ6÷•7÷F–g•Æ–&6´ÆörÒ7–æ2‚’Óâ°¢6öç7BFW‡BÒ¥4ôâç7G&–æv–g’‡7÷F–g•Æ–W"ævWEÆ–&6´Æör‚’ÂçVÆÂÂ"¢G'’°¢v—Bæf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡FW‡B¢ö7'V–ÆEFö7B‚u7÷F–g’Æ–&6²Æör6÷–VBâr¢Ò6F6‚…ò’°¢B‚r6Æöuf–WvW$WFõ&Vg&W6‚r’ç&÷‚v6†V6¶VBrÂfÇ6R¢–b…öÆöuf–WvW$–çFW'fÂ’²6ÆV$–çFW'fÂ…öÆöuf–WvW$–çFW'fÂ“²öÆöuf–WvW$–çFW'fÂÒçVÆÂÐ¢6öç7B&öG’ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚vÆöuf–WvW$&öG’r¢–b‚&öG’’&WGW&à¢&öG’çFW‡D6öçFVçBÒFW‡@¢6öç7B&ævRÒFö7VÖVçBæ7&VFU&ævR‚“²&ævRç6VÆV7DæöFT6öçFVçG2†&öG’¢6öç7B6VÆV7F–öâÒv–æF÷rævWE6VÆV7F–öâ‚“²6VÆV7F–öâç&VÖ÷fTÆÅ&ævW2‚“²6VÆV7F–öâæFE&ævR‡&ævR¢ö7'V–ÆEFö7B‚u7÷F–g’Æör6VÆV7FVBâÆöær×&W72F†R6VÆV7F–öâFò6÷’âr¢Ð§Ð ¦gVæ7F–öâ÷v—E•EVçF–ÄVæB‡F–ÖU7F'BÂF–ÖTVæBÂöåF–6²ÂW‡V7FVEf–FVô–BÂGFV×BÂ&V6÷fW"’°¢6öç7B—FVÕFö¶VâÒv–æF÷rå÷&V5Æ”—FVÕFö¶Và¢6öç7B7F'BÒçVÖ&W"‡F–ÖU7F'B¢ÆWBVæBÒçVÖ&W"‡F–ÖTVæB¢–b‚çVÖ&W"æ—4f–æ—FR‡7F'B’ÇÂçVÖ&W"æ—4f–æ—FR†VæB’ÇÂVæBÃÒ7F'BÇÂVæBÒ7F'BâÔ…õ$T4ôä$ÄUô4Ä•õ2’°¢GFV×Bæf–Â‚v–çfÆ–BÖ6Æ—r¢&WGW&â&öÖ—6Rç&W6öÇfR‚¢Ð¢6öç7B7W'&VçBÒ‚’Óâv–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶VâbbGFV×Bæ7F—fR‚¢6öç7B†&EW6RÒ‚’Óâ°¢–b‚7W'&VçB‚’’&WGW&à¢G'’²v–æF÷rç—EÆ–W#òçW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢6WEF–ÖV÷WB‚‚’Óâ°¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶Vâbbv–æF÷rå÷&7F–6T7F—fR’°¢G'’²v–æF÷rç—EÆ–W#òçW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢Ð¢ÒÂS¢Ð¢&WGW&âæWr&öÖ—6R‚‡&W6öÇfRÂ&V¦V7B’Óâ°¢ÆWBö'6W'fVD&VÆ÷tVæBÒfÇ6P¢ÆWBÆ7E÷6—F–öâÒ7F'BÂÆ7E&öw&W72Ò÷Æ–W$Æ–fV7–6ÆRææ÷r‚’Â&WG&–VBÒfÇ6P¢6öç7BF–6²Ò‚’Óâ°¢–b‚7W'&VçB‚’’&WGW&â&W6öÇfR‚¢òò†÷7B×W6VB–g&ÖR—2æ÷B†VG6WBW6R÷"7FÆÆVB6Æ—v†–ÆP¢òòF†R—2–âF†R&6¶w&÷VæBâÆVfR&öw&W72öVæB6†V6·2&¶VBFöòà¢–b‚÷Æ–W$Æ–fV7–6ÆRæ—4f÷&Vw&÷VæB‚’’&WGW&â6WEF–ÖV÷WB‡F–6²Â¢ÆWBÆ–W%7FFRÒÓ¢G'’²Æ–W%7FFRÒv–æF÷rç—EÆ–W#òævWEÆ–W%7FFR‚’Ò6F6‚…ò’·Ð¢òòöæÇ’Ö÷f–ærÄ””ärÆ–†VB&÷fW2F†—26Æ—7F'FVBâf–ÆV@¢òòÆöBögFVâ&WF–ç2ÆW6–&ÆRF–ÖW7F×v†–ÆR&W÷'F–ærU4TC°¢òòG&VF–ærF†B2†VG6WBW6RF—6&ÆVBWfW'’&V6÷fW'’FVFÆ–æRà¢6öç7B7F–öâÒ&V5Æ”W‡FW&æÅW6T7F–öâ‡°¢W6VC¢v–æF÷rå÷&V5Æ•W6VBÂÆ–W%7FFRÂWfW%Æ–VC¢GFV×BçÆ–VBbbGFV×Bç&V6÷fW&–ærÀ¢6–æ6T6ÖD×3¢FFRææ÷r‚’Ò‡v–æF÷rå÷&V5Æ•W6T6ÖDBÇÂ’À¢Ò¢–b†7F–öâÓÓÒwW6Rr’öÇ•&V5Æ•W6R‡G'VRÂfÇ6R¢VÇ6R–b†7F–öâÓÓÒw&W7VÖRr’öÇ•&V5Æ•W6R†fÇ6RÂfÇ6R¢–b‡v–æF÷rå÷&V5Æ•W6VB’°¢Æ7E&öw&W72Ò÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢&WGW&â6WEF–ÖV÷WB‡F–6²Â¢Ð¢G'’°¢6öç7BÆ–W"Òv–æF÷rç—EÆ–W ¢6öç7BÆöFVD–BÒvWE–÷WGV&Uf–FVô–B‡Æ–W"¢6öç7B7BÒçVÖ&W"‡Æ–W#òævWD7W'&VçEF–ÖSòâ‚’¢6öç7B–Dö²ÒÆöFVD–BÓÓÒW‡V7FVEf–FVô–@¢–b†–Dö²’°¢6öç7BGW&F–öâÒÆ–W"ævWDGW&F–öãòâ‚¢–b„çVÖ&W"æ—4f–æ—FR†GW&F–öâ’bbGW&F–öââ7F'BbbVæBâGW&F–öâ’VæBÒGW&F–öà¢Ð¢6öç7B–åv–æF÷rÒ–Dö²bbçVÖ&W"æ—4f–æ—FR†7B’bb7BãÒ7F'BÒãRbb7BÃÒVæB²P¢–b†–åv–æF÷rbb7BÂVæB’ö'6W'fVD&VÆ÷tVæBÒG'VP¢–b†–åv–æF÷rbbö'6W'fVD&VÆ÷tVæBbb7BãÒVæB’°¢G'’²Æ–W"ç6VVµFò†VæBÂG'VR’Ò6F6‚…ò’·Ð¢†&EW6R‚¢&WGW&â&W6öÇfR‚¢Ð¢–b†–åv–æF÷rbbÆ–W%7FFRÓÓÒbb7BâÆ7E÷6—F–öâ²ãR’°¢Æ7E÷6—F–öâÒ7@¢Æ7E&öw&W72Ò÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢Ð¢GFV×Bæö'6W'fR†–åv–æF÷rò7B¢æâÂÆ–W%7FFRÂÆöFVD–B¢Ò6F6‚…ò’·Ð¢òòâ–g&ÖR6â&W÷'BÄ””äræBF†R&–v‡BF–ÖW7F×v†–ÆR—G26Æö6°¢òò7F—2g&÷¦Vââ&VÆöBöæ6RÂ7F–ÆÂ–ç6–FRF†—26Æ—w2&V6÷fW'’'VFvWBà¢–b‡&V6÷fW"bb&WG&–VBbb÷Æ–W$Æ–fV7–6ÆRææ÷r‚’ÒÆ7E&öw&W72ãÒd”DTõõ5DÄÅõ$UE%•ôÕ2’°¢&WG&–VBÒG'VP¢ö'6W'fVD&VÆ÷tVæBÒfÇ6P¢&öÖ—6Rç&W6öÇfR‚’çF†Vâ‚‚’Óâ&V6÷fW"†Æ7E÷6—F–öâ’’çF†Vâ‡F–6²Â&V¦V7B¢&WGW&à¢Ð¢–b‡G—VöböåF–6²ÓÓÒvgVæ7F–öâr’²G'’²öåF–6²‚’Ò6F6‚…ò’·ÒÐ¢òòF†RGFV×Bw2vF6†För6÷fW'2&VF–æW72ÂÆöBæB6VV²FöòâVæÆ–¶P¢òòF†RöÆB'VffW&–ærW†6ÇW6–öç2Â—BwV&çFVW2#2&V6÷fW'’&÷VæBà¢6WEF–ÖV÷WB‡F–6²Â¢Ð¢F–6²‚¢Ò§Ð ¢òò7V²FW‡FÆ÷VBÂ&W6öÇf–ærv†VâÆ–&6²VæG2âG&–W2vöövÆRw0¢òòG&ç6ÆFU÷GG2VæGö–çBf—'7B‡6÷VæG2×V6‚&WGFW"F†âF†Rõ2fö–6W2’À¢òòæBfÆÇ2&6²FòF†R'&÷w6W"w27VV6…7–çF†W6—2öâf–ÇW&RâF†R7W'&Vç@¢òòVF–ò÷WGFW&æ6R—2W‡÷6VBöâv–æF÷rå÷&V5EE26òF†RW6R'WGFöâ6à¢òòW6R÷&W7VÖR—BÆöæw6–FRF†R–÷UGV&RÆ–W"à¢òò&WÆ6Rfö6"Öf÷&ÖGF–ærvÇ—‡2F†BF†REE2Væv–æW2ÖævÆR‚"â¢"Æ6V†öÆFW"À¢òò%²âÕâ"ææ÷FF–öâÂ#Âââãâ"Fw2’â—Rf÷&×2vWB7ö¶Vâ2'‚Â’Â¢"à¦gVæ7F–öâ÷6æ—F—¦Uv÷&Df÷%EE2‡FW‡B’°¢–b‡FW‡BÓÒçVÆÂ’&WGW&ârp¢ÆWB2Ò7G&–ær‡FW‡B¢2Ò2ç&WÆ6R‚óÅµãåÒ£âörÂrr’òò7G&—Æææ÷FF–öãâÖ&¶W'0¢2Ò2ç&WÆ6R‚õÅµÅåµåÅÕÒ¥ÅÕ²¢³õÓòörÂrì:WBr’òòæVvFVB6†"Ö6Æ72%µåÒ¢"Â%µâÒ¢"Â%µæÒ²"(i"&ì:WB ¢2Ò2ç&WÆ6R‚õÂå²¢µÒörÂrì:WBr’òò"â¢"ò"â²"(i"&ì:WB ¢2Ò2ç&WÆ6R‚õÇ2¥ÇÅÇ2¢örÂrÂr’òò—R(i"6öÖÖÂ6òf÷&×2vWBW6W0¢2Ò2ç&WÆ6R‚õÇ2²örÂrr’çG&–Ò‚¢&WGW&â0§Ð ¦gVæ7F–öâ÷7Vµv÷&B‡FW‡B’°¢6öç7B6ÆVâÒ÷6æ—F—¦Uv÷&Df÷%EE2‡FW‡B¢–b‚6ÆVâ’&WGW&â&öÖ—6Rç&W6öÇfR‚¢&WGW&â÷7Vµv÷&DvöövÆR†6ÆVâ’æ6F6‚‚‚’Óâ÷7Vµv÷&D'&÷w6W"†6ÆVâ’§Ð ¦gVæ7F–öâ÷GG4Ææt6öFR‚’°¢6öç7B6öFRÒ‡G—VöbvWDÆætg&öÕW&ÂÓÓÒvgVæ7F–öârbbvWDÆætg&öÕW&Â‚’æ6öFR’ÇÂw7bp¢&WGW&â6öFRÓÓÒw7bròw7br¢6öFRÓÓÒvW2ròvW2r¢vVâp§Ð ¦gVæ7F–öâ÷7Vµv÷&DvöövÆR‡FW‡B’°¢&WGW&âæWr&öÖ—6R‚‡&W6öÇfRÂ&V¦V7B’Óâ°¢G'’°¢6öç7BÒ7G&–ær‡FW‡B’çG&–Ò‚¢–b‚’&WGW&â&W6öÇfR‚¢òòvöövÆRG&ç6ÆFRw2EE2VæGö–çBâv÷&·22âÆVF–óâ6÷W&6Rg&öÒ¢òò&VwVÆ"'&÷w6W"F"„4õ%2FöW6âwBÇ’FòÖVF–Æ–&6²’â†2¢òòã#6†"Æ–Ö—BW"6ÆÂv†–6‚—2vVÆÂv—F†–âF†R6–ævÆR×v÷&BW6Rà¢6öç7BW&ÂÒ‡GG3¢ò÷G&ç6ÆFRævöövÆRæ6öÒ÷G&ç6ÆFU÷GG3ö–SÕUDbÓ‚gFÃÒGµ÷GG4Ææt6öFR‚—Òf6Æ–VçC×GrÖö"gÒG¶Væ6öFUU$”6ö×öæVçB‡—Ö ¢6öç7BVF–òÒæWrVF–ò‚¢VF–òæ7&÷74÷&–v–âÒvæöç–Ö÷W2ròò&W7BÖVff÷'C²–væ÷&VB–b6W'fW"FöW6âwB6VæB4õ%0¢VF–òç7&2ÒW&À¢VF–òçföÇVÖRÒã ¢ÆWB6WGFÆVBÒfÇ6P¢6öç7BFöæRÒ†W'"’Óâ°¢–b‡6WGFÆVB’&WGW&ã²6WGFÆVBÒG'VP¢VF–òæöæVæFVBÒçVÆÃ²VF–òæöæW'&÷"ÒçVÆÀ¢–b‡v–æF÷rå÷&V5EE2bbv–æF÷rå÷&V5EE2æVF–òÓÓÒVF–ò’v–æF÷rå÷&V5EE2ÒçVÆÀ¢W'"ò&V¦V7B†W'"’¢&W6öÇfR‚¢Ð¢VF–òæöæVæFVBÒ‚’ÓâFöæR‚¢VF–òæöæW'&÷"Ò‚’ÓâFöæR†æWrW'&÷"‚tvöövÆREE2VF–òW'&÷"r’¢v–æF÷rå÷&V5EE2Ò²¶–æC¢vVF–òrÂVF–òÂ6æ6VÃ¢‚’ÓâFöæR‚’Ð¢6öç7BÒVF–òçÆ’‚¢–b‡bbG—VöbçF†VâÓÓÒvgVæ7F–öâr’æ6F6‚†W'"ÓâFöæR†W'"’¢òò&–Â÷WB–bF†R&WVW7B†æw2†æòVF–ò&öw&W72v—F†–â‡2’à¢6WEF–ÖV÷WB‚‚’Óâ²–b‚6WGFÆVBbb†VF–òçW6VBÇÂVF–òæGW&F–öâ’’FöæR†æWrW'&÷"‚tvöövÆREE2F–ÖV÷WBr’’ÒÂƒ¢Ò6F6‚†R’²&V¦V7B†R’Ð¢Ò§Ð ¦gVæ7F–öâ÷7Vµv÷&D'&÷w6W"‡FW‡B’°¢&WGW&âæWr&öÖ—6R‡&W6öÇfRÓâ°¢–b‡G—Vöbv–æF÷rç7VV6…7–çF†W6—2ÓÓÒwVæFVf–æVBrÇÀ¢G—Vöbv–æF÷rå7VV6…7–çF†W6—5WGFW&æ6RÓÓÒwVæFVf–æVBr’&WGW&â&W6öÇfR‚¢G'’°¢6öç7BRÒæWr7VV6…7–çF†W6—5WGFW&æ6R…7G&–ær‡FW‡B’çG&–Ò‚’¢6öç7B6öFRÒ÷GG4Ææt6öFR‚¢RæÆærÒ7VV6„Æö6ÆR†6öFRÂvVâÕU2r¢Rç&FRÒã¢RçföÇVÖRÒã ¢ÆWB6WGFÆVBÒfÇ6P¢6öç7BFöæRÒ‚’Óâ°¢–b‡6WGFÆVB’&WGW&ã²6WGFÆVBÒG'VP¢–b‡v–æF÷rå÷&V5EE2bbv–æF÷rå÷&V5EE2çWGFW&æ6RÓÓÒR’v–æF÷rå÷&V5EE2ÒçVÆÀ¢&W6öÇfR‚¢Ð¢RæöæVæBÒFöæP¢RæöæW'&÷"ÒFöæP¢v–æF÷rç7VV6…7–çF†W6—2æ6æ6VÂ‚¢v–æF÷rå÷&V5EE2Ò²¶–æC¢w7VV6‚rÂWGFW&æ6S¢RÂ6æ6VÃ¢FöæRÐ¢v–æF÷rç7VV6…7–çF†W6—2ç7V²‡R¢òò6öÖRVæv–æW2æWfW"f—&RöæVæB–bF†RWGFW&æ6R—26†÷'B÷"–çFW''WFVBà¢6WEF–ÖV÷WB†FöæRÂc¢Ò6F6‚…ò’²&W6öÇfR‚’Ð¢Ò§Ð ¢òò&VæFW"ò&Vg&W6‚F†RÆ’ÖÖöFR–æfò&ææW"v—F‚F†R7W'&VçB—FVÒw0¢òò6öçFW‡Bâ6–æ6R6V&6‚&W7VÇG2&VâwBFWFW&Ö–æ—7F–2‡&VÖ÷FRFFÂ&æ¶–ærÀ¢òòfö6"7FFR6â6†–gB’ÂvRFöâwBG'’FòÆö6FRF†RÖF6‚–âF†RÆ—fP¢òò7&W7VÇBDôÒ(	BvRG&r6VÆbÖ6öçF–æVB&ææW"g&öÒF†R&V6÷&FVBf–VÆG2à¦gVæ7F–öâ÷&VæFW%Æ––æt&ææW"†—BÂ–G‚ÂF÷FÂ’°¢òò¶WB6òF†R&WfW'6R7v—F6‚6â&VG&rF†R6&BF†B—2öâ67&VVâæ÷p¢òò&F†W"F†âÆVf–ær—BF†RöÆBv’&÷VæBVçF–ÂF†RæW‡B—FVÒ7F'G2à¢v–æF÷rå÷&V5Æ”&ææW$&w2Ò²—BÂ–G‚ÂF÷FÂÐ¢ÆWBF"ÒB‚r7&V5Æ––æt&ææW"r¢–b‚F"æÆVæwF‚’°¢òòF÷&÷r—2v†B—2Çv—2öâ67&VVã¢&öw&W72ÂF†RGvòÖöFR'WGFöç2æ@¢òòF†R(K’FövvÆRâ†VBÂÖWFæB&÷F‚F–ÖR7FWW'2Æ—fR–âF†RFWF–Ç0¢òò&Æö6²&VÆ÷r(	Bv—26öÖWF†–ær–÷R6WBæ÷ræBF†VâÂæ÷B6öÖWF†–æp¢òòv÷'F‚F†Rv–GF‚—B6÷7G2öâ†öæRWfW'’6V6öæBF†RFV6²—2'Vææ–ærà¢òòFW6·F÷552¶VW2F†RFWF–Ç2&Æö6²÷VâÂ6òæ÷F†–ær—2'W&–VBF†W&Rà¢F"ÒB†ÆF—b–CÒ'&V5Æ––æt&ææW"#à¢ÆF—b6Æ73Ò'&V2×"×F÷#à¢ÆF—b6Æ73Ò'&V2×"×&öw&W72#à¢Ç7â6Æ73Ò'&V2×"Ö&"#ãÂ÷7ãà¢Ç7â6Æ73Ò'&V2×"Ö6÷VçB#ãÂ÷7ãà¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"×&WÆ’Ö'Fâ"F—FÆSÒ%&WÆ’F†—2—FVÒBãs\9r"&–ÖÆ&VÃÒ%&WÆ’7W'&VçB—FVÒ#âGµ÷7GVG”6öçG&öÄ–6öâ‚w&WÆ’rÂ~(k²&WÆ’r—ÓÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"×7vÖ'Fâ"F—FÆSÒ%&7F—6RF†R÷F†W"v’&÷VæB(	BF&vWBf—'7B"&–ÖÆ&VÃÒ%7v6÷W&6RæBF&vWB#î(xCÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"Ö×W6–2Ö'Fâ"F—FÆSÒ$&6¶w&÷VæB×W6–2"&–ÖÆ&VÃÒ$&6¶w&÷VæB×W6–2#î)š³Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"Ö–æfòÖ'Fâ"F—FÆSÒ%6†÷rFWF–Ç2"&–ÖÆ&VÃÒ%6†÷rFWF–Ç2"&–ÖW‡æFVCÒ&fÇ6R#à¢Ç7fr†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ#‚"†V–v‡CÒ#‚"f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR#à¢ÇF‚CÒ$Ó‚Trr‚rrFÓ‚‚‚‚‚b"óà¢ÇF‚CÒ&Ó‚ã“2bãSƒ‚Ó"ã#’ã#ƒrÒãƒ"ã3‚ãCRãƒ62ã#“Bãrã3S"ãsbã#ƒ‚ãCc–ÂÒãs3‚2ãCc†2Òã“Bãƒ“rãRã3’ãƒ‚ã3’ãSCRãs‚Òã#S"ãCcRÒãS“†Âãƒ‚ÒãCf2Òã"ãsbÒãC“"ã#CbÒãcƒbã#CbÒã#sRÒã3sRÒã“2Òã3BÒãS37¤Ó’BãVÓ"""óà¢Â÷7fsà¢Âö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò'&V2×"ÖFWF–Ç2#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"×&7F–6RÖ'Fâ"F—FÆSÒ%&7F–6RF†—2—FVÒ"&–ÖÆ&VÃÒ%7v—F6‚Fò&7F–6R#âGµ÷7GVG”6öçG&öÄ–6öâ‚w&7F–6RrÂu&7F–6Rr—ÓÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&7W×vRÖf–æB×7GVG’×G&–vvW"&V2×"Öf–æBÖ'Fâ"F—FÆSÒ$f–æBf—6–&ÆRFW‡BöâvR„7G&Âô6ÖB´b’"&–ÖÆ&VÃÒ$f–æBöâvR"&–Ö6öçG&öÇ3Ò&7WvTf–æD&"#äf–æBöâvSÂö'WGFöãà¢ÆF—b6Æ73Ò'&V2×"Ö†VB#ãÂöF—cà¢ÆF—b6Æ73Ò'&V2×"ÖÖWF#ãÂöF—cà¢ÆF—b6Æ73Ò'&V2×"×F–ÖW2#à¢Ç7â6Æ73Ò'&V2×"Öv"F—FÆSÒ$–çFW"Ö—FVÒv‡6V6öæG2’(	B6Æ–6²+÷"FF†RfÇVRFòG—R#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"ÖvÖFV2"&–ÖÆ&VÃÒ$FV7&V6Rv#î(‰#Âö'WGFöãà¢Ç7â6Æ73Ò'&V2×"Öv×fÂ"F&–æFWƒÒ#"&öÆSÒ&'WGFöâ"F—FÆSÒ%FFò6WBv#ã33Â÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"ÖvÖ–æ2"&–ÖÆ&VÃÒ$–æ7&V6Rv#â³Âö'WGFöãà¢Â÷7ãà¢Ç7â6Æ73Ò'&V2×"Öv&V2×"×6v"7G–ÆSÒ&F—7Æ“¦æöæS²"F—FÆSÒ%W6R&WGvVVâF†—26&Bw26÷W&6RæBF&vWB&V6÷&F–æw2(	B6Æ–6²+÷"FF†RfÇVRFòG—R#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"×6vÖFV2"&–ÖÆ&VÃÒ$FV7&V6R6÷W&6R×Fò×F&vWBW6R#î(‰#Âö'WGFöãà¢Ç7â6Æ73Ò'&V2×"×6v×fÂ"F&–æFWƒÒ#"&öÆSÒ&'WGFöâ"F—FÆSÒ%FFò6WBF†R6÷W&6^(i'F&vWBW6R#îHnX(	3Â÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×"×6vÖ–æ2"&–ÖÆ&VÃÒ$–æ7&V6R6÷W&6R×Fò×F&vWBW6R#â³Âö'WGFöãà¢Â÷7ãà¢ÂöF—cà¢ÆÆ&VÂ6Æ73Ò'&V2×"ÖÖVF–Ö6†ö–6R"F—FÆSÒ%Æ–&6²&VfW&Væ6Rf÷"6&G2v—F‚Æ–æ²æB&V6÷&F–æw2â6†æv–ær—B&W7F'G2F†R7W'&VçB6&Bâ"7G–ÆSÒ&F—7Æ“¦æöæS²#åÆ¢Ç6VÆV7B6Æ73Ò'&V2×"ÖÖVF–ÖÖöFR"&–ÖÆ&VÃÒ%Æ–&6²f÷"F†—26&B#à¢Æ÷F–öâfÇVSÒ&Æ–æ¶VB#äÆ–æ¶VBÖVF–Âö÷F–öãà¢Æ÷F–öâfÇVSÒ'&V6÷&F–æw2#å&V6÷&FVBVF–óÂö÷F–öãà¢Æ÷F–öâfÇVSÒ&&÷F‚#ä&÷F‚†Æ–æ¶VBf—'7B“Âö÷F–öãà¢Â÷6VÆV7Cà¢ÂöÆ&VÃà¢ÆF—b6Æ73Ò'&V2×"Ö6Æ—×&ævR"7G–ÆSÒ&F—7Æ“¦æöæS²#ãÂöF—cà¢ÂöF—cà¢ÂöF—cæ’æVæEFò‚v&öG’r¢òò&V6†&ÆRv†–ÆRÆ–Æ—7B—2'Vææ–ærÂv†–6‚—2v†Vâ6öÖVöæR7GVÆÇ¢òòvçG2Fò6†ævRF†R×W6–2(	BF†R6ÖRæVÂ6WGF–æw2÷Vç2à¢òòGW&âF†Rv†öÆRFV6²÷fW"â6W76–öâ×v–FR7v—F6‚Â6ò—B7F—2WBg&öÐ¢òòöæR6&BFòF†RæW‡BæB7W'f—fW2&VÆöB(	B&7F—6–ær&6·v&G2—2¢òòÖöFRÂæ÷BöæRÖ6&BFWF÷W"âF†R6&G2&Ræ÷BF÷V6†VBà¢F"æöâ‚v6Æ–6²rÂrç&V2×"×&WÆ’Ö'FârÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢&WÆ”7W'&VçE&V6÷&F–æt—FVÒ‚¢Ò¢F"æöâ‚v6Æ–6²rÂrç&V2×"×7vÖ'FârÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢v–æF÷råö6WGF–æw2ç&V5Æ•&WfW'6RÒ÷&V5Æ•&WfW'6VB‚¢6fT6WGF–æw2‚¢÷7–æ5&V5Æ•&WfW'6UT’‚¢òò6&BÇ&VG’VæFW"v’¶VW2F†R÷&FW"—B7F'FVBv—F‚Â6ò6’6ð¢òò&F†W"F†âÆWGF–ærF†R7v—F6‚Æöö²Æ–¶R—BF–Bæ÷F†–ærà¢6öç7Bv—F–ærÒ÷&V5Æ”6&E&WfW'6VBÓÒçVÆÂbb÷&V5Æ”6&E&WfW'6VBÓÒ÷&V5Æ•&WfW'6VB‚¢6öç7Bv†–6‚Ò÷&V5Æ•&WfW'6VB‚’ò~(xBF&vWBf—'7Br¢~(xB6÷W&6Rf—'7Bp¢ö7'V–ÆEFö7B‡v—F–æròG·v†–6‡Ò(	Bg&öÒF†RæW‡B6&F¢v†–6‚¢Ò¢F"æöâ‚v6Æ–6²rÂrç&V2×"Ö×W6–2Ö'FârÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢ö÷Vä×W6–5æVÂ‚¢Ò¢F"æöâ‚v6Æ–6²rÂrç&V2×"Ö–æfòÖ'FârÂgVæ7F–öâ‚’°¢6öç7B÷VâÒF"æ†46Æ72‚w&V2×"ÖW‡æFVBr¢F"çFövvÆT6Æ72‚w&V2×"ÖW‡æFVBrÂ÷Vâ¢B‡F†—2’æGG"‚v&–ÖW‡æFVBrÂ÷VâòwG'VRr¢vfÇ6Rr¢Ò¢F"æöâ‚v6Æ–6²rÂrç&V2×"×&7F–6RÖ'FârÂ7v—F6…Æ–W%Fõ&7F–6R¢F"æöâ‚v6†ævRrÂrç&V2×"ÖÖVF–ÖÖöFRrÂRÓâ÷6WDÖçVÅÆ–&6µ&VfW&Væ6R‚B†RçF&vWB’çfÂ‚’’¢òò÷6WD—FVÔvWFFW2F†R7F—fRvæB&÷F‚&VF÷WG2â6W76–öâ÷fW'&–FP¢òò7F—2–âÖVÖ÷'“²÷&F–æ'’Æ–Æ—7Bv2&R6fVB2&VfW&Væ6Rà¢6öç7Btõ5DUÒP¢F"æöâ‚v6Æ–6²rÂrç&V2×"ÖvÖFV2Âç&V2×"ÖvÖ–æ2rÂ†R’Óâ°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BF—"ÒB†Ræ7W'&VçEF&vWB’æ†46Æ72‚w&V2×"ÖvÖ–æ2r’ò¢Ó¢÷6WD—FVÔv…ö–çFW$—FVÔv6V6öæG2‚’²F—"¢tõ5DU¢Ò¢F"æöâ‚v6Æ–6²rÂrç&V2×"Öv×fÂrÂ†R’Óâ°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B&rÒ&ö×B‚tv&WGvVVâ—FV×2‡6V6öæG2Â(	3c“¢rÂ7G&–ær…ö–çFW$—FVÔv6V6öæG2‚’’¢–b‡&rÓÒçVÆÂ’&WGW&à¢÷6WD—FVÔv‡&r¢Ò ¢òò6÷W&6^(i%F&vWBW6Râ7FW–ærg&öÒ'Vç6WB"7F'G2Bv†FWfW"—0¢òòVffV7F—fR&–v‡Bæ÷r‡F†R–çFW"Ö—FVÒv’Â6òF†Rf—'7B+FGW&ç2F†P¢òò–æ†W&—FVBfÇVR–çFòâW‡Æ–6—B÷fW'&–FR&F†W"F†â§V×–ærFòà¢òò&V6ÆÂW6W2&R6†÷'BÂ6ò7FWf–æVÇ’&VÆ÷r2æB6ö'6VÇ’&÷fRà¢F"æöâ‚v6Æ–6²rÂrç&V2×"×6vÖFV2Âç&V2×"×6vÖ–æ2rÂ†R’Óâ°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7W"ÒöVffV7F—fU7&5FwDv6V6öæG2‚¢6öç7B7FWÒ7W"ÃÒò¢P¢6öç7BF—"ÒB†Ræ7W'&VçEF&vWB’æ†46Æ72‚w&V2×"×6vÖ–æ2r’ò¢Ó¢÷6WE7&5FwDv†7W"²F—"¢7FW¢Ò¢F"æöâ‚v6Æ–6²rÂrç&V2×"×6v×fÂrÂ†R’Óâ°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7B7W"Ò÷7&5FwDv6V6öæG2‚¢6öç7B·f—'7BÂ6V6öæEÒÒö6&Df6W4–ä÷&FW"‡v–æF÷rå÷&V5Æ”7W'&VçD—FVÒ¢6öç7B&rÒ&ö×B€¢W6R&WGvVVâG·f—'7BæÆ&VÇÒæBG·6V6öæBæÆ&VÇÒ‡6V6öæG2Â(	3c’åÆäÆVfR&Ææ²FòW6RF†Rv&WGvVVâ—FV×2æÀ¢7W"ÓÒçVÆÂòrr¢7G&–ær†7W"¢¢–b‡&rÓÒçVÆÂ’&WGW&à¢÷6WE7&5FwDv…7G&–ær‡&r’çG&–Ò‚’ÓÓÒrròçVÆÂ¢&r¢Ò¢Ð¢òòW"Ö—FVÒWFFW2FVÆVvFVBFòF†RW&RdÒ²DôÒWFFW"âF†R7FF–0¢òò6¶VÆWFöâ†æB—G2öæR×6†÷B6Æ–6²v—&–ær&÷fR’7F—2–âF†—2f–ÆRà¢ÆWBGrÒB‚r7&V5Æ––æuv÷&Br¢–b‚GræÆVæwF‚’GrÒB‚sÆF—b–CÒ'&V5Æ––æuv÷&B#ãÂöF—câr’æVæEFò‚v&öG’r¢6öç7BvÒö–çFW$—FVÔv6V6öæG2‚¢WFFUÆ––æt&ææW"†'V–ÆEÆ––æt&ææW%dÒ†—BÂ–G‚ÂF÷FÂÂvÂö6&Df6W5&WfW'6VB‚’’ÂF%³ÒÂGu³Ò¢òòF†R6÷W&6^(i'F&vWBW6RöæÇ’&—FW2öâ6&BF†B6'&–W2&÷F€¢òò&V6÷&F–æw2Â6ò—G27FWW"öæÇ’6†÷w2F†W&R(	B¶æö"F†BFöW2æ÷F†–ærFð¢òòF†R6&B–âg&öçBöb–÷R—2v÷'6RF†âæò¶æö"à¢6öç7BGVÂÒ…ö6&E6÷W&6TVF–ò†—B’bbö6&EF&vWDVF–ò†—B’¢F"æf–æB‚rç&V2×"×6vr’çFövvÆR†GVÂ¢F"æf–æB‚rç&V2×"ÖÖVF–Ö6†ö–6Rr’çFövvÆR‚—BæÖçVÂbb÷Æ–Æ—7EÆ–&6µÆâ†—B’æ†4&÷F‚¢F"æf–æB‚rç&V2×"ÖÖVF–ÖÖöFRr’çfÂ…öÖçVÅÆ–&6µ&VfW&Væ6R‚’¢6öç7BÆ–æ¶VD6Æ—Ò—BæÖçVÂò÷'VçF–ÖU–÷UGV&T6Æ—†—B’¢çVÆÀ¢F"æf–æB‚rç&V2×"Ö6Æ—×&ævRr’çFövvÆR‚Æ–æ¶VD6Æ—’çFW‡B†Æ–æ¶VD6Æ— ¢ò–÷UGV&R6Æ—G¶g&öÕ6V6öæG2†Æ–æ¶VD6Æ—çF–ÖU7F'B—Ò(	2G¶g&öÕ6V6öæG2†Æ–æ¶VD6Æ—çF–ÖTVæB—ÒG¶Æ–æ¶VD6Æ—æ–æfW'&VDVæBòr+rWFöÖF–2VæBr¢rwÖ¢rr¢÷7–æ5&V5Æ•&WfW'6T'Fâ‚¢÷7–æ4—FVÔvT’‚¢–b†GVÂ’÷7–æ57&5FwDvT’‚§Ð ¢òòG&–âF†R&öw&W72&"g&öÒgVÆÂ(i"V×G’÷fW"×6Âf—7VÆÇ’6–væÆÆ–æp¢òòF†R&VÖ–æ–ær–çFW"Ö—FVÒvF–ÖRâF†R&"vWG2æv6Æ726ò—@¢òò6†÷w2–âv&Ò6öÆ÷"‡g2F†Rw&VVâ6Æ—×&öw&W72f–ÆÂ’æBF†R6÷Vç@¢òòVÆVÖVçB7v—F6†W2Fò&æW‡B×W"†–çBv†–ÆRF†Rv—2'Vææ–ærà¢òò†–çF÷F–öæÆÇ’&WÆ6W2F†R&æW‡B–âç2+r’öâ"&VF÷WB(	BF†RW6P¢òò–ç6–FR6&B—2v—F–ærf÷"F†B6&Bw2F&vWBÂæ÷Bf÷"F†RæW‡B—FVÒà¦ÆWBöv6÷VçFF÷våF–ÖW$–BÒçVÆÀ¦gVæ7F–öâ÷7F'Dv6÷VçFF÷vâ†×2Â†–çB’°¢÷7F÷v6÷VçFF÷vâ‚¢òòv—26–ÆVçBÂ6òF†R–÷UGV&RÆ–W"†2§W7B&W÷'FVB&æ÷BÆ––ær"æ@¢òòF†R†÷7Bw26†–Ò†2W6†VBF†BFòF†R7—7FVÒÖVF–6W76–öâ(	Bv†–6‚7F÷0¢òòF†R†VG6WB&V–ær&÷WFVB†W&Rf÷"F†Rv†öÆRvâ&RÖ76W'BF†BF†R6W76–öà¢òò—2'Vææ–ærÂVæÆW72F†RW6W"7GVÆÇ’W6VB—Bà¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ•W6VB’÷÷7DÖVF–7FFR‡G'VR¢òòWfW'’W6R–âÆ–&6²6öÖW2F‡&÷Vv‚†W&R(	BF†R&V6ÆÂW6R–ç6–FR¢òò6&BæBF†R†öÆB&WGvVVâ—FV×2Æ–¶R(	B6òF†—2—2F†RöæRÆ6Rvvp¢òòÖöFRæVVG2Fò¶æ÷r&÷WBà¢òð¢òòæ÷Bv†–ÆR&WböæW‡B—2Ç&VG’VWVVBÂF†÷Vvƒ¢F†Rv—2÷VæVB&Vf÷&P¢òòF†Ræb&WVW7B—2&VBÂæB&÷F‚F†—26÷VçFF÷vâæBF†R6ÆVW—B&VÆöæw0¢òòFò&–ÂöâF†V—"f—'7BF–6²âfÆ—–ærF†R†6Rf÷"F†BöæRF–6²Ö¶W0¢òòF†R×W6–27F'BæB7F÷v–âã#×2ÆFW"Â6ò†öÆF–ærF÷vâæW‡B7GWGFW'0¢òò—BâÆVf–ærF†R†6RÆöæRÆWG2F†RæW‡B—FVÒ6WBF†R&VÂöæRà¢–b‚v–æF÷rå÷&V4æe&WVW7BbbçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’°¢òòG&6¶VB6W&FVÇ’g&öÒF†R†6R&V6W6R†æB×7F'FVB&WÆ’Ö÷fW0¢òòF†R†6RFòv6Æ—rv†–ÆRF†Rv—G6VÆb—27F–ÆÂ6÷VçF–ærF÷vâ(	BF†—0¢òò—2v†BFVÆÇ2F†R&WÆ’w2vVæFVBrv†–6‚†6RFò†æB&6²Fòà¢v–æF÷rå÷&V5Æ”v7F—fRÒG'VP¢÷6WE&V5Æ•†6R‚vvr¢Ð¢6öç7BF&ææW"ÒB‚r7&V5Æ––æt&ææW"r¢–b‚F&ææW"æÆVæwF‚’&WGW&à¢6öç7BF&"ÒF&ææW"æf–æB‚rç&V2×"Ö&"r’æFD6Æ72‚vvr¢6öç7BF6÷VçBÒF&ææW"æf–æB‚rç&V2×"Ö6÷VçBr¢òò66†RF†R÷&–v–æÂ6÷VçBFW‡B6òvR6âWB—B&6²v†VâF†RvVæG2à¢–b‚F6÷VçBæÆVæwF‚’F6÷VçBæFF‚w&TvFW‡BrÂF6÷VçBçFW‡B‚’¢6öç7B&Vv–âÒ÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢ÆWBÆ7EF–6²Ò&Vv–à¢ÆWB&VÖ–æ–ærÒ×0¢F&"æ772‚wv–GF‚rÂsRr¢6öç7BVWVRÒv–æF÷rå÷&V5Æ•VWVRÇÂµÐ¢6öç7B’Ò‡v–æF÷rå÷&V5Æ”–æFW‚ÓÒçVÆÂ’ò¢v–æF÷rå÷&V5Æ”–æFW€¢6öç7BæW‡D–G‚Ò†’²ÂVWVRæÆVæwF‚’ò†’²’¢ ¢öv6÷VçFF÷våF–ÖW$–BÒ6WD–çFW'fÂ‚‚’Óâ°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’²÷7F÷v6÷VçFF÷vâ‚“²&WGW&âÐ¢–b‡v–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’²÷7F÷v6÷VçFF÷vâ‚“²&WGW&âÐ¢6öç7Bæ÷rÒ÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢6öç7BVÆ6VBÒæ÷rÒÆ7EF–6°¢Æ7EF–6²Òæ÷p¢–b‚v–æF÷rå÷&V5Æ•W6VB’&VÖ–æ–ærÓÒVÆ6V@¢6öç7B7BÒÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂ‡&VÖ–æ–ærò×2’¢’¢F&"æ772‚wv–GF‚rÂ7B²rRr¢6öç7B6V74ÆVgBÒÖF‚æÖ‚ƒÂÖF‚æ6V–Â‡&VÖ–æ–ærò’¢–b‚F6÷VçBæÆVæwF‚’°¢F6÷VçBçFW‡B††–çBò†–çB‡6V74ÆVgB’¢æW‡B–âG·6V74ÆVgG×2+rG¶æW‡D–G‚²ÒòG·VWVRæÆVæwF‡Ö¢Ð¢–b‡&VÖ–æ–ærÃÒ’÷7F÷v6÷VçFF÷vâ‚¢ÒÂ#§Ð¦gVæ7F–öâ÷7F÷v6÷VçFF÷vâ‚’°¢–b…öv6÷VçFF÷våF–ÖW$–B’²6ÆV$–çFW'fÂ…öv6÷VçFF÷våF–ÖW$–B“²öv6÷VçFF÷våF–ÖW$–BÒçVÆÂÐ¢òò6ÆV&VB&Vf÷&RF†RV&Ç’&WGW&â&VÆ÷s¢Ö—76–ær&ææW"×W7Bæ÷BÆVfP¢òòF†—27GV6²öâÂ÷"ÆFW"&WÆ’v÷VÆB†æBF†R†6R&6²FòvF†@¢òòf–æ—6†VBÆöærvòà¢v–æF÷rå÷&V5Æ”v7F—fRÒfÇ6P¢6öç7BF&ææW"ÒB‚r7&V5Æ––æt&ææW"r¢–b‚F&ææW"æÆVæwF‚’&WGW&à¢F&ææW"æf–æB‚rç&V2×"Ö&"r’ç&VÖ÷fT6Æ72‚vvr¢6öç7BF6÷VçBÒF&ææW"æf–æB‚rç&V2×"Ö6÷VçBr¢–b‚F6÷VçBæÆVæwF‚’°¢6öç7B&RÒF6÷VçBæFF‚w&TvFW‡Br¢–b‡&RÒçVÆÂ’F6÷VçBçFW‡B‡&R¢òòG&÷F†R66†Röæ6R—Bw2&VVâ7VçBâÆVf–ær—B&V†–æBÖ¶W2F†RäU…@¢òò6÷VçFF÷vâ&W7F÷&RF†—2—FVÒw26÷VçFW"÷fW"ÆFW"—FVÒw2(	B†&ÖÆW70¢òòv†VâF†RöæÇ’6÷VçFF÷vâ&âBâ—FVÒ&÷VæF'’Â'WBF†R6÷W&6^(i'F&vW@¢òòW6R'Vç2Ö–BÖ—FVÒÂ6ò7FÆR&W7F÷&Rv÷VÆB6—Böâ67&VVâf÷"F†P¢òòv†öÆRF&vWB&V6÷&F–ærà¢F6÷VçBç&VÖ÷fTFF‚w&TvFW‡Br¢Ð§Ð ¦gVæ7F–öâ÷WFFUÆ––æu&öw&W72‡F–ÖU7F'BÂF–ÖTVæBÂW‡V7FVEf–FVô–B’°¢6öç7BGW"ÒÖF‚æÖ‚ƒÂF–ÖTVæBÒF–ÖU7F'B¢ÆWB7BÒF–ÖU7F'@¢G'’²7BÒ‡v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖRbbv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖR‚’’ÇÂF–ÖU7F'BÒ6F6‚…ò’·Ð¢òò7FÆRÖ7BwV&BâVçF–ÂF†R&–v‡Bf–FVò—2ÆöFVBäB7BÆæG27G&–7FÇ¢òò–ç6–FR·F–ÖU7F'BÂF–ÖTVæEÒÂ†öÆBF†R&"BRâ÷F†W'v—6R7FÆR7@¢òòg&öÒF†R&Wf–÷W26Æ—F†B6ö–æ6–FVçFÆÇ’fÆÇ2–âF†—26Æ—w2v–æF÷p¢òò†Rærâ&WbVæFVBBSRÂæWr6Æ——2C^(i#SR’æ–ÖFW2F†R&"6Öö÷F†Ç¢òòFòRf–F†R552v–GF‚×G&ç6—F–öâ&Vf÷&RF†R6Æ—WfW"Æ—2à¢ÆWBÆöFVD–BÒçVÆÀ¢G'’²ÆöFVD–BÒv–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ævWEf–FVôFFbbv–æF÷rç—EÆ–W"ævWEf–FVôFF‚’çf–FVõö–BÒ6F6‚…ò’·Ð¢6öç7B–Dö²ÒW‡V7FVEf–FVô–BÇÂÆöFVD–BÇÂÆöFVD–BÓÓÒW‡V7FVEf–FVô–@¢–b‚–Dö²ÇÂ7BÂF–ÖU7F'BÇÂ7BâF–ÖTVæB’7BÒF–ÖU7F'@¢6öç7B7BÒÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂ‚†7BÒF–ÖU7F'B’òGW"’¢’¢B‚r7&V5Æ––æt&ææW"ç&V2×"Ö&"r’æ772‚wv–GF‚rÂ7BçFôf—†VBƒ’²rRr§Ð ¢òò–b&V6÷&FVB6Æ—w2·F–ÖU7F'BÂF–ÖTVæEÒÆöö·2ÖÆf÷&ÖVB†GW&F–öà¢òòâÔ…õ$T4ôä$ÄUô4Ä•õ2’ÂG'’Fò&V6÷fW"6æRã#2v–æF÷r'¢òòÆöö¶–ærWF†RÖF6†VBÆ–æR–âF†R5%BæBæ6†÷&–ærF†RÆ¢òòv–æF÷r&÷VæB—G2&VÂF–ÖW7F×2â&WGW&ç2²F–ÖU7F'BÂF–ÖTVæBÐ¢òòöâ7V66W72ÂçVÆÂ–b&V6÷fW'’—6âwB÷76–&ÆR†æòÆ–æT–æFW‚Âæò5%BÀ¢òòÖF6†VBÆ–æRÖ—76–ærÂ÷"Vç'6V&ÆRF–ÖW7F×2’à¢òð¢òòF†RÖÆf÷&ÖF–öâG—–6ÆÇ’†Vç2v†VââöÆFW"6GW&Rw26öçFW‡@¢òòv–æF÷r7G&FFÆVBFV×÷&ÂF—66öçF–çV—G’–â7'6R5%B†Rærà¢òòÆ–æRRB£3ƒ£rföÆÆ÷vVB'’Æ–æRbBC£#£S"(i"&V6÷&FV@¢òòF–ÖU7F'Bg&öÒ6VvÖVçBæBF–ÖTVæBg&öÒ6VvÖVçB"Â2ãv‚&6Æ— ¢òòF†Bw27GVÆÇ’GvòF—6¦ö–çB&Vv–öç2’â&VæFW$Æ–æW2æ÷r&WfVçG0¢òògWGW&R6GW&W2g&öÒFö–ærF†—2Â'WBW†—7F–ær&V6÷&F–æw27F–ÆÀ¢òò6''’F†R&B&÷VæG2(	BF†—2†VÇW"ÆWG2W2Æ’F†VÒ26†÷'@¢òò6Æ—&÷VæBF†RÖF6†VBÆ–æR–ç7FVBöb6¶—–ærF†VÒ÷WG&–v‡Bà¦7–æ2gVæ7F–öâ÷&W—$ÖÆf÷&ÖVD6Æ—†—FVÒ’°¢–b‚—FVÒ’&WGW&âçVÆÀ¢G'’°¢6öç7B'6VBÒv—BöÆöE7V'F—FÆW4f÷$—FVÒ†—FVÒ¢–b‚'6VB’&WGW&âçVÆÀ¢6öç7BÆærÒ‡G—VöbvWE6VÆV7FVDÆærÓÓÒvgVæ7F–öâr’òvWE6VÆV7FVDÆær‚’¢w7bp¢6öç7B&–Ö'’ÒÆærÓÓÒw7brò'6VBç7b¢'6VBæVà¢–b‚&–Ö'’ÇÂ&–Ö'’æÆVæwF‚’&WGW&âçVÆÀ¢6öç7B÷2ÒöÆö6FT—FVÔ7VR‡&–Ö'’Â—FVÒ¢6öç7BÆ–æRÒ÷2ãÒò&–Ö'•·÷5Ò¢çVÆÀ¢–b‚Æ–æRÇÂÆ–æRç7F'BÇÂÆ–æRæVæB’&WGW&âçVÆÀ¢6öç7BÆ–æU7F'BÒçVÖ&W"†Æ–æRç7F'Bæ÷&F–æÂ¢6öç7BÆ–æTVæBÒçVÖ&W"†Æ–æRæVæBæ÷&F–æÂ¢–b‚çVÖ&W"æ—4f–æ—FR†Æ–æU7F'B’ÇÂçVÖ&W"æ—4f–æ—FR†Æ–æTVæB’’&WGW&âçVÆÀ¢òòW2öb&R×&öÆÂÂF†VâVæ÷Vv‚÷7B×&öÆÂFò6÷fW"F†RÖF6†VBÆ–æRÇW0¢òòãW2öbG&–Æ–ær6öçFW‡B(	Bv—fW2F†RW6W"F–ÖRFò&V6övæ—6RF†P¢òòv÷&B–â6öçFW‡Bv—F†÷WBÖ¶–ærF†R6Æ—G&röâà¢6öç7BæWu7F'BÒÖF‚æÖ‚ƒÂÆ–æU7F'BÒR¢6öç7BæWtVæBÒÖF‚æÖ‚†Æ–æTVæB²RÂæWu7F'B²#¢&WGW&â²F–ÖU7F'C¢æWu7F'BÂF–ÖTVæC¢æWtVæBÐ¢Ò6F6‚†R’°¢6öç6öÆRçv&â‚uµ÷&W—$ÖÆf÷&ÖVD6Æ—Òf–ÆVBrÂ—FVÒÂR¢&WGW&âçVÆÀ¢Ð§Ð ¢òò&W6öÇfR7b¶Vâ'6VB7V'F—FÆRVçG&–W2f÷"F†R&V6÷&FVBf–FVô–BÂ&WW6–æp¢òòv†FWfW"w2Ç&VG’–âÖVÖ÷'’âF‡&VRF–W'2Â6†VW7Bf—'7C ¢òòâv–æF÷rç6V&6…&W7VÇB(	BÆ7B6V&6‚Ç&VG’'6VB7e÷7V'2æFFð¢òòVå÷7V'2æFFf–vWE7V'2‚“²W6R—B2Ö—2à¢òò"âv–æF÷ræÆÅ7V'F—FÆW5¶–EÒ(	B&rFW‡BÇ&VG’fWF6†VC²&WW6R66†V@¢òò÷'6VE7bò÷'6VDVâ÷"'6Röæ6RæB7F6‚F†W&Rà¢òò2âfÆÂ&6²FòvWE7V'F—FÆW4f÷$Æ–æ²†æWGv÷&²’æB'6Rà¦7–æ2gVæ7F–öâöÆöE7V'F—FÆW4f÷$—FVÒ†—FVÒ’°¢–b‚v–æF÷ræÆÅ7V'F—FÆW2’v–æF÷ræÆÅ7V'F—FÆW2Ò·Ð ¢òòƒ’Æ7B6V&6‚w2'6VBVçG&–W2à¢6öç7B7"Òv–æF÷rç6V&6…&W7VÇBÇÂµÐ¢6öç7B†—BÒ7"æf–æB†—BÓâ—Bbb—BçW&ÂÓÓÒ—FVÒæ–B¢–b††—Bbb†—Bç7e÷7V'3òåö6öçFW‡DöæÇ’bb‚††—Bç7e÷7V'2bb†—Bç7e÷7V'2æFFbb†—Bç7e÷7V'2æFFæÆVæwF‚’ÇÀ¢††—BæVå÷7V'2bb†—BæVå÷7V'2æFFbb†—BæVå÷7V'2æFFæÆVæwF‚’’’°¢&WGW&â°¢7c¢††—Bç7e÷7V'2bb†—Bç7e÷7V'2æFF’ÇÂµÒÀ¢Vã¢††—BæVå÷7V'2bb†—BæVå÷7V'2æFF’ÇÂµÐ¢Ð¢Ð ¢òòƒ"’–âÖÖVÖ÷'’&rFW‡BÂv—F‚öâÖFVÖæB'6R†66†VBöâF†RVçG'’’à¢ÆWB7F÷&VBÒv–æF÷ræÆÅ7V'F—FÆW5¶—FVÒæ–EÐ¢–b‚7F÷&VBÇÂ‚7F÷&VBç7bbb7F÷&VBæVâ’’°¢G'’²v—BvWE7V'F—FÆW4f÷$Æ–æ²†—FVÒæ–BÂ—FVÒç6÷W&6R’Ò6F6‚†R’°¢6öç6öÆRçv&â‚wÆ•&V6÷&F–æs¢vWE7V'F—FÆW4f÷$Æ–æ²f–ÆVBf÷"rÂ—FVÒæ–BÂR¢Ð¢7F÷&VBÒv–æF÷ræÆÅ7V'F—FÆW5¶—FVÒæ–EÐ¢Ð¢–b‚7F÷&VBÇÂ‚7F÷&VBç7bbb7F÷&VBæVâ’’&WGW&âçVÆÀ¢–b‡7F÷&VBç7bbb7F÷&VBå÷'6VE7b’7F÷&VBå÷'6VE7bÒ7'EFô§6öâ‡7F÷&VBç7b¢–b‡7F÷&VBæVâbb7F÷&VBå÷'6VDVâ’7F÷&VBå÷'6VDVâÒ7'EFô§6öâ‡7F÷&VBæVâ¢&WGW&â²7c¢7F÷&VBå÷'6VE7bÇÂµÒÂVã¢7F÷&VBå÷'6VDVâÇÂµÒÐ§Ð ¢òòöf–æDÆ–æT'•F–ÖRÆ—fW2–ââ÷&VæFW&W"÷Æ––ær×V’×fÒæ§2à ¢òò'V–ÆBF†R7V'F—FÆR6öçFW‡B÷fW&Æ’f÷"F†RÆ––ær—FVÒâF†–â6†–Ó ¢òòVÆÂ7V'F—FÆW2²6WGF–æw2²6VÆV7FVBÆærg&öÒ7FFRÂ†æBöfbFð¢òòF†RW&RdÒ²DôÒVÖ—GFW"–ââ÷&VæFW&W"÷Æ––ær×V’Ò¢æ§2âF†Ræöâ×W&P¢òò&—G2(	B7V'F—FÆRfWF6†–ærÂÆæwVvR6VÆV7F–öâÂ67&öÆÂ÷6—F–öæ–ær(	B7F¢òò†W&Râ&WGW&ç2ÖWFFFW6VB'’÷&Vg&W6…Æ––æu7V'F—FÆW2à¦7–æ2gVæ7F–öâ÷&VæFW%Æ––æu7V'F—FÆW2†—FVÒÂ²—47W'&VçBÒ‚’ÓâG'VRÒÒ·Ò’°¢ÆWBG7V"ÒB‚r7&V5Æ––æu7V'2r¢–b‚G7V"æÆVæwF‚’G7V"ÒB‚sÆF—b–CÒ'&V5Æ––æu7V'2#ãÂöF—câr’æVæEFò‚v&öG’r¢G7V"æ‡FÖÂ‚sÆF—b6Æ73Ò'&V2×2ÖÆöF–ær#äÆöF–ær7V'F—FÆW>(
cÂöF—câr ¢6öç7B·'6VBÂ&VfW'&VEÒÒv—B&öÖ—6RæÆÂ…µöÆöE7V'F—FÆW4f÷$—FVÒ†—FVÒ’ÂöÆöE&VfW'&VE7V'F—FÆUG&6²†—FVÒæ–B•Ò¢–b‚—47W'&VçB‚’ÇÂFö7VÖVçBæ&öG’æ6öçF–ç2‚G7V%³Ò’’&WGW&âçVÆÀ¢–b‚'6VBÇÂ‚'6VBç7bæÆVæwF‚bb'6VBæVâæÆVæwF‚’’°¢G7V"æ‡FÖÂ‚sÆF—b6Æ73Ò'&V2×2ÖW'"#å7V'F—FÆW2Væf–Æ&ÆRf÷"F†—2f–FVòãÂöF—câr¢&WGW&âçVÆÀ¢Ð ¢6öç7BÆærÒ‡G—VöbvWE6VÆV7FVDÆærÓÓÒvgVæ7F–öâr’òvWE6VÆV7FVDÆær‚’¢w7bp¢6öç7B&Vf÷&RÒ‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2æ6öçFW‡DÆ–æW4&Vf÷&R’ÇÂ ¢6öç7BgFW"Ò‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2æ6öçFW‡DÆ–æW4gFW"’ÇÂ ¢6öç7BfÒÒ'V–ÆEÆ––æu7V'5dÒ‡²'6VBÂÆærÂ—FVÒÂ&Vf÷&RÂgFW"Â&VfW'&VBÀ¢Ö–åv÷&G4&÷VæC¢öÖ–åv÷&G4&÷VæB‚’ÂvF‡&W6†öÆC¢ö6Æ—vF‡&W6†öÆE6V2‚’Ò ¢–b‡fÒç7FFRÓÓÒvæò×&–Ö'’r’°¢G7V"æ‡FÖÂ‚sÆF—b6Æ73Ò'&V2×2ÖW'"#å&–Ö'’7V'F—FÆRÖ—76–ærãÂöF—câr¢&WGW&âçVÆÀ¢Ð¢–b‡fÒç7FFRÓÓÒvæòÖÖF6‚r’°¢G7V"æ‡FÖÂ‚sÆF—b6Æ73Ò'&V2×2ÖW'"#äÖF6†VBÆ–æRæ÷Bf÷VæB–â7V'F—FÆRf–ÆRãÂöF—câr¢&WGW&âçVÆÀ¢Ð¢&VæFW%Æ––æu7V'4Æ—7B‡fÒÂG7V%³ÒÂ&ævRÓâ°¢–b†—47W'&VçB‚’bbv–æF÷rå÷&7F–6T7F—fR’&WÆ”7W'&VçE&V6÷&F–æt—FVÒ‡&ævR¢Ò¢6WEF–ÖV÷WB…÷67&öÆÄ7F—fU7V$–çFõf–WrÂ¢&WGW&â²&–Ö'“¢fÒç&–Ö'’Âg&öÓ¢fÒæg&öÒÂFó¢fÒçFòÐ§Ð ¢òò'V–ÆB…DÔÂf÷"7V'F—FÆRÆ–æRv†W&RWfW'’ö67W'&Væ6Röbv÷&F—2w&V@¢òò–âÆÖ&²6Æ73Ò&†Â×v÷&B#âf÷"F†R&öÆB·–VÆÆ÷r†–v†Æ–v‡BâfÆÇ2&6²FòF†P¢òòÆ–âFW‡B–bv÷&F—2V×G’÷"FöW6âwBÖF6‚(	B6ÆÆW'26†÷VÆB7F–ÆÂ6W@¢òòF†RVÆVÖVçBf–æ‡FÖÂ‚’6òF†Rw&VBÖ&·W&VæFW'2âVæ–6öFRÖv&Rv÷&@¢òò&÷VæF&–W2¶VW&FW6–vâ"g&öÒÖF6†–ær–ç6–FR&FW6–væ–ær"à¢òò'V–ÆBVæ–6öFRÖ&÷VæFVB&VvW‚g&öÒGFW&æ†Ç&VG’&VvW‚6÷W&6RÀ¢òò6ÆÆW"—2&W7öç6–&ÆRf÷"W66–ær’âfÆÇ2&6²FòVæ&÷VæFVBf÷"öÆ@¢òòVæv–æW2v—F†÷WBÆöö¶&V†–æBòÇâ6†&VB'’ö†–v†Æ–v‡Ev÷&D‡FÖÂæBF†P¢òò&R×66â–â÷‡&6Tf÷VæD–åFW‡G2à¢òòö'V–ÆD&÷VæFVEv÷&E&Rò÷‡&6Tf÷VæD–åFW‡G2òö†–v†Æ–v‡Ev÷&D‡FÖÂÆ—fR–à¢òòâ÷&VæFW&W"÷Æ––ær×V’×fÒæ§2†–×÷'FVBBF†RF÷’à ¢òòÖçVÂ6&G2†fRæò7V'F—FÆW2(	B6†÷rF†R6&Bw2÷vâFW‡B–âF†R6ÖP¢òò&öÖ–æVçB÷fW&Æ’‚7&V5Æ––æu7V'2’F†R7V'F—FÆR&÷w2W6RÂ6òF†RFW‡B—0¢òòf—6–&ÆRGW&–ærÆ–&6²WfVâv†VâF†R&ææW"FWF–Ç2&R6öÆÆ6VB†Öö&–ÆR’à¢òò6÷W&6R—2F†RÖ–âÆ–æS²F&vWB&–FW2Æöær2F†R6V6öæF'’Æ–æRà¦gVæ7F–öâ÷&VæFW%Æ––ætÖçVÅFW‡B†—FVÒ’°¢ÆWBG7V"ÒB‚r7&V5Æ––æu7V'2r¢–b‚G7V"æÆVæwF‚’G7V"ÒB‚sÆF—b–CÒ'&V5Æ––æu7V'2#ãÂöF—câr’æVæEFò‚v&öG’r¢òòF†—2—2F†R6&B2†öæR6VW2—B(	BF†R&ææW"w2GvòÆ–æW2Æ—fR–ç6–FP¢òòF†RFWF–Ç2&Æö6²Âv†–6‚æ'&÷rÆ–÷WG2¶VW6öÆÆ6VBâ6ò—B†2FòGW&à¢òò÷fW"v—F‚WfW'—F†–ærVÇ6RÂ÷"&WfW'6VB6W76–öâv÷VÆB6†÷rF†Rç7vW ¢òò&÷fRF†R&ö×Bf÷"F†Rv†öÆR6&Bà¢6öç7B¶f—'7BÂ6V6öæEÒÒö6&Df6W4–ä÷&FW"†—FVÒ¢6öç7B7&2Ò7G&–ær†f—'7BçFW‡BÇÂrr’çG&–Ò‚¢6öç7BFwBÒ7G&–ær‡6V6öæBçFW‡BÇÂrr’çG&–Ò‚¢–b‚7&2bbFwB’²G7V"æ‡FÖÂ‚rr“²&WGW&âÐ¢ÆWB‡FÖÂÒsÆF—b6Æ73Ò'&V2×2×&÷r&V2×2Ö7F—fR#âp¢6öç7Bf6RÒ†6Ç2ÂB’Óâ°¢6öç7B²‡FÖÃ¢‚Â—4‡FÖÂÒÒö6&D‡FÖÂ‡B¢&WGW&âÆF—b6Æ73Ò"G¶6Ç7ÒG¶—4‡FÖÂòr6&BÖ‡FÖÂr¢rwÒ#âG¶‡ÓÂöF—cæ ¢Ð¢–b‡7&2’‡FÖÂ³Òf6R‚w&V2×2ÖÖ–ârÂ7&2¢–b‡FwB’‡FÖÂ³Òf6R‚w&V2×2×6V2rÂFwB¢‡FÖÂ³ÒsÂöF—câp¢G7V"æ‡FÖÂ†‡FÖÂ§Ð ¢òò67&öÆÂF†R7F—fR&÷rFòF†RfW'F–6Â6VçFW"öbF†R7&V5Æ––æu7V'0¢òòæVÂâF§W7G2öæÇ’F†RæVÂw267&öÆÅF÷†æ÷BF†RvR’6òÖö&–ÆP¢òò67&öÆÂ&V†f–÷W"7F—2&VF–7F&ÆRâW6VBgFW"–æ—F–Â&VæFW"æBöà¢òòWfW'’7F—fR×&÷r6†ævRà¦gVæ7F–öâ÷67&öÆÄ7F—fU7V$–çFõf–Wr‚’°¢6öç7B7V$VÂÒFö7VÖVçBævWDVÆVÖVçD'”–B‚w&V5Æ––æu7V'2r¢–b‚7V$VÂ’&WGW&à¢6öç7B&÷tVÂÒ7V$VÂçVW'•6VÆV7F÷"‚rç&V2×2Ö7F—fRr¢–b‚&÷tVÂ’&WGW&à¢6öç7BF&vWBÒ&÷tVÂæöfg6WEF÷Ò‡7V$VÂæ6Æ–VçD†V–v‡Bò"’²‡&÷tVÂæ6Æ–VçD†V–v‡Bò"¢6öç7B6Æ×VBÒÖF‚æÖ‚ƒÂÖF‚æÖ–â‡7V$VÂç67&öÆÄ†V–v‡BÒ7V$VÂæ6Æ–VçD†V–v‡BÂF&vWB’¢–b‡G—Vöb7V$VÂç67&öÆÅFòÓÓÒvgVæ7F–öâr’°¢7V$VÂç67&öÆÅFò‡²F÷¢6Æ×VBÂ&V†f–÷#¢w6Öö÷F‚rÒ¢ÒVÇ6R°¢7V$VÂç67&öÆÅF÷Ò6Æ×V@¢Ð§Ð ¢òò¶VWç&V2×2Ö7F—fVöâv†–6†WfW"7V'F—FÆR&÷r'&6¶WG2F†R7W'&Vç@¢òòÆ–†VBâ6ÆÆVBg&öÒ÷v—E•EVçF–ÄVæBw2öåF–6²à¦gVæ7F–öâ÷&Vg&W6…Æ––æu7V'F—FÆW2†7G‚’°¢–b‚7G‚’&WGW&à¢ÆWB7BÒ ¢G'’²7BÒv–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖRòv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖR‚’¢Ò6F6‚…ò’·Ð¢6öç7B’Òöf–æDÆ–æT'•F–ÖR†7G‚ç&–Ö'’Â7B¢–b†’Â7G‚æg&öÒÇÂ’â7G‚çFò’&WGW&âòò÷WG6–FRF†R&VæFW&VBv–æF÷p¢6öç7BG7V"ÒB‚r7&V5Æ––æu7V'2r¢–b‚G7V"æÆVæwF‚’&WGW&à¢6öç7BG&÷w2ÒG7V"æf–æB‚rç&V2×2×&÷rr¢6öç7BF7W"ÒG&÷w2æf–ÇFW"‚u¶FFÖÆ–æRÖ“Ò"r²’²r%Òr¢–b‚F7W"æÆVæwF‚ÇÂF7W"æ†46Æ72‚w&V2×2Ö7F—fRr’’&WGW&à¢G&÷w2ç&VÖ÷fT6Æ72‚w&V2×2Ö7F—fRr¢F7W"æFD6Æ72‚w&V2×2Ö7F—fRr¢÷67&öÆÄ7F—fU7V$–çFõf–Wr‚§Ð ¢òò'V–ÆBF†RÆ–&6²VWVRg&öÒF†R7W'&VçB&V6÷&F–ær†÷"WfW'’&V6÷&F–æp¢òòv†VâÆö÷ÒvÆÂr’âV6‚VçG'’—2ææ÷FFVBv—F‚—G2÷&–v–â…÷&V4æÖRÂ÷7BÀ¢òò÷rÂö–G‚’6òW"Ö—FVÒ7F–öç2Æ–¶R'Æ’g&öÒ†W&R"6â&V'V–ÆBF†R6ÖP¢òòVWVRæBÆö6FRF†R7F'F–ær—FVÒà¢òòF†–âw&W'2(	BW&R6÷&W2–ââ÷Æ’×VWVRæ§2à¦gVæ7F–öâö'V–ÆEÆ•VWVR†Æö÷’°¢&WGW&âö6÷&T'V–ÆEÆ•VWVR‡°¢Æö÷À¢&V6÷&F–æw3¢v–æF÷rå÷&V6÷&F–æw2À¢7W'&VçDæÖS¢v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖRÀ¢7W'&VçD—FV×3¢v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ—FV×2À¢Ò§Ð¦gVæ7F–öâ÷6‡VffÆUVWVR‡’²ö6÷&U6‡VffÆUVWVR‡’Ð ¢òò&VÖVÖ&W"F†RÆ7BÆ’÷&7F–6R6W76–öâ6òföÆÆ÷r×WÆ’ÆÂò&7F–6P¢òòöâF†R6ÖRÆ–Æ—7B6âöffW"Fò&W7VÖRg&öÒW†7FÇ’v†W&RvR7F÷VB(	@¢òòæ÷B§W7BF†R6ÖR—FVÒÂ'WBF†R4ÔR÷&FW"‡6òÇ&VG’×Æ–VB—FV×2Föâw@¢òò&VV"&Vf÷&RVçÆ–VBöæW2’âW'6—7FVB6ò—B7W'f—fW2&VÆöBà¢òð¢òò6†S ¢òò&V4æÖRÂ7BÂrÂ–G‚Â–BÂÆ–æT–æFW‚(	BF†RW"Ö—FVÒ7W'6÷"†f÷"†–v†Æ–v‡B¢òòÖöFR(	BwÆ’rÂw&7F–6Rr‡&ö×BÆ&VÂ¢òòVWVT¶W—2(	B–FVçF—G’GWÆW2f÷"WfW'’—FVÒ–à¢òòF†R7F—fRVWVRÂ–â÷&FW ¢òòVWVU÷2(	B–æFW‚öbF†R7W'&VçB—FVÒ–â¶W—0¢òð¢òòvR¶W’—FV×2'’‡&V4æÖRÂ7BÂrÂ–BÂÆ–æT–æFW‚’&F†W"F†â'&’–æFW€¢òò6òÆ–Æ—7B&V÷&FW'2ò–ç6W'G2&WGvVVâ6W76–öç2FöâwBÖ—2×&W6öÇfRFòF†P¢òòw&öær—FVÒâ—FV×2FVÆWFVB÷"F—6&ÆVB6–æ6R&RG&÷VBöâ&V6öç7F—GWFRà¢òò7F÷&vRÆ–÷WC¢²·Æ–Æ—7DæÖUÓ¢²Æ“ó¢ÆVçG'“âÂ&7F–6Só¢ÆVçG'“âÒÐ¢òòV6‚VçG'“¢²&V4æÖRÂ7BÂrÂ–G‚Â–BÂÆ–æT–æFW‚ÂÖöFRÂVWVT¶W—2ÂVWVU÷2ÂG2Ð¢òòGvòVçG&–W2W"Æ–Æ—7B‡Æ’²&7F–6R’(	B6ò&W7VÖ–ærÆ’g2&7F–6P¢òòöâF†R6ÖRÆ–Æ—7BG&6·2–æFWVæFVçB÷6—F–öç2âÆVv7’‡6–ævÆRö&¦V7B¢òò6†R—2Ö–w&FVBöâf—'7BÆöBà¦6öç7B$T5ôÄ5EõÄ”TEô´U’Ò÷66÷VD¶W’‚v7W—F÷#§&V4Æ7EÆ–VBr¢òòF†–âw&W'2(	BW&R6÷&W2–ââ÷Æ’×VWVRæ§2âÆö6Å7F÷&vR’ôòæ@¢òò6öæf—&Ò‚’7F’†W&S²F†R6÷&W2F¶R÷&WGW&âÆ–â¥2ö&¦V7G2à¦gVæ7F–öâöÆöDÆ7EÆ–VDÖ‚’°¢–b‡v–æF÷rå÷&V4Æ7EÆ–VDÖ’&WGW&âv–æF÷rå÷&V4Æ7EÆ–VDÖ ¢ÆWBÖÒ·Ð¢G'’°¢6öç7B&rÒ÷W6W$FFævWD—FVÒ…$T5ôÄ5EõÄ”TEô´U’¢–b‡&r’°¢6öç7B'6VBÒ¥4ôâç'6R‡&r¢6öç7BÖ–w&FVBÒÖ–w&FTÆVv7”Æ7EÆ–VDÖ‡'6VB¢–b†Ö–w&FVB’°¢òò&R×W'6—7BÖ–w&FVBÆVv7’VçG&–W26òF†RæW‡BÆöB—26ÆVâà¢–b‡'6VBbb'6VBç&V4æÖR’°¢G'’²÷W6W$FFç6WD—FVÒ…$T5ôÄ5EõÄ”TEô´U’Â¥4ôâç7G&–æv–g’†Ö–w&FVB’’Ò6F6‚…ò’·Ð¢Ð¢ÖÒÖ–w&FV@¢Ð¢Ð¢Ò6F6‚…ò’·Ð¢v–æF÷rå÷&V4Æ7EÆ–VDÖÒÖ ¢&WGW&âÖ §Ð¦gVæ7F–öâ÷6fTÆ7EÆ–VDÖ†Ö’°¢G'’°¢–b‚ÖÇÂö&¦V7Bæ¶W—2†Ö’æÆVæwF‚’÷W6W$FFç&VÖ÷fT—FVÒ…$T5ôÄ5EõÄ”TEô´U’¢VÇ6R÷W6W$FFç6WD—FVÒ…$T5ôÄ5EõÄ”TEô´U’Â¥4ôâç7G&–æv–g’†Ö’¢Ò6F6‚…ò’·Ð§Ð¦gVæ7F–öâ÷6WDÆ7EÆ–VB†—BÂÖöFRÂ÷2’°¢–b†—Bbb—Bå÷FV×÷&'’’&WGW&à¢6öç7BÖÒöÆöDÆ7EÆ–VDÖ‚¢6öç7BæW‡BÒ6WDÆ7EÆ–VDVçG'’†ÖÂ—BÂÖöFRÂ÷2¢–b†æW‡BÓÒÖ’°¢v–æF÷rå÷&V4Æ7EÆ–VDÖÒæW‡@¢÷6fTÆ7EÆ–VDÖ†æW‡B¢Ð§Ð¦gVæ7F–öâöÆöDÆ7EÆ–VB‚’°¢&WGW&âvWDæWvW7DVçG'’…öÆöDÆ7EÆ–VDÖ‚’Âv–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR§Ð¦gVæ7F–öâ÷6fUVWVT÷&FW"‡VWVRÂÖöFR’°¢–b‚'&’æ—4'&’‡VWVR’ÇÂVWVRæÆVæwF‚ÇÂVWVRç6öÖR†—BÓâ—Bå÷FV×÷&'’’’&WGW&à¢6öç7B&V4æÖRÒ‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’ÇÂVWVU³Òå÷&V4æÖP¢6öç7BÖÒöÆöDÆ7EÆ–VDÖ‚¢6öç7BæW‡BÒ6fUVWVT÷&FW$–çFò†ÖÂVWVRÂÖöFRÂ&V4æÖR¢–b†æW‡BÓÒÖ’°¢v–æF÷rå÷&V4Æ7EÆ–VDÖÒæW‡@¢÷6fTÆ7EÆ–VDÖ†æW‡B¢Ð§Ð¢òò)H)Hv†–6‚f–Wrv2öâ67&VVâv†VâF†RvRÆ7B7F÷VB'Vææ–ær)H)H)H)H)H)H)H)H)H)H ¢òð¢òòw&—GFVâv†–ÆRÆ–W"÷"&7F–6R—2÷VâæBv—VBF†RÖöÖVçBV—F†W"—2W@¢òòv’(	B'’F†RW6W"Â÷"'’FV6²&V6†–ær—G2VæBâ6òF†RöæÇ’F†–ærF†@¢òòWfW"7W'f—fW2–çFòF†RæW‡BÆöB—2F†R66Ræ÷F†–ærVÇ6R6â6÷fW#¢F†R ¢òòv2¶–ÆÆVBv—F‚f–Wr7F–ÆÂ÷Vââ&V÷Væ–ær—BF†Vâ—2v†BÖ¶W2¢òò&VÆVæ6†VBfVVÂÆ–¶R—BæWfW"6Æ÷6VBÂv†–ÆRf–WrF†RW6W"FVÆ–&W&FVÇ¢òòÆVgB7F—26Æ÷6VBà¦6öç7BõTåõd”Uuô´U’Ò÷66÷VD¶W’‚v7W—F÷#¦÷Våf–Wrr ¢òòÖ—'&÷"F†RfÆrFòF†RæF—fR†÷7Bà¢òð¢òòÆö6Å7F÷&vRÆöæR—2æ÷BVæ÷Vv‚f÷"—C¢F†W6Rf–Ww2Æ—fR–ç6–FRF†R†÷7Bw0¢òò7GVG’F–ÆörÂæBF†BF–Æör—2æ÷B&V÷VæVBöâÆVæ6‚(	B6òF†—2vR—0¢òòæ÷B'Vææ–ærÂæBæ÷F†–ær†W&R6â&W7F÷&Rç—F†–ærâF†R†÷7B†2Fò¶æ÷r¢òòf–Wrv2÷Vâ–â÷&FW"Fò'&–ærF†RF–Æör&6²BÆÂâ6–ÆVçBÂæ@¢òò†&ÖÆW72Â–âÆ–â'&÷w6W"à¦gVæ7F–öâ÷÷7Ef–Wu7FFUFô†÷7B‡f–Wr’°¢–b‚v–æF÷råÆ–Æ—7D'&–FvRÇÀ¢G—Vöbv–æF÷råÆ–Æ—7D'&–FvRç÷7DÖW76vRÓÒvgVæ7F–öâr’&WGW&à¢G'’°¢v–æF÷råÆ–Æ—7D'&–FvRç÷7DÖW76vR„¥4ôâç7G&–æv–g’‡°¢÷¢wf–Wu7FFRrÀ¢f–Ws¢f–WrÇÂrrÀ¢Ò’¢Ò6F6‚†R’°¢6öç6öÆRçv&â‚wf–Wu7FFS¢'&–FvR÷7Bf–ÆVBrÂR¢Ð§Ð ¢òòF†R7F—fRÆ–Æ—7Bw27F&ÆR–BÂ÷"çVÆÂf÷"öæRF†—2vR÷vç2à¦gVæ7F–öâö7F—fTW‡D–B‚’°¢6öç7BâÒv–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢6öç7B&V2Òâbbv–æF÷rå÷&V6÷&F–æw2bbv–æF÷rå÷&V6÷&F–æw5¶åÐ¢&WGW&â‡&V2bb&V2æW‡D–BÒçVÆÂ’ò7G&–ær‡&V2æW‡D–B’¢çVÆÀ§Ð ¦gVæ7F–öâ÷6WD÷Våf–Wr‡f–Wr’°¢–b‚‡f–WrÓÓÒw&7F–6Rrbbv–æF÷rå÷&7F–6UFV×÷&'’’ÇÀ¢‡f–WrÓÓÒwÆ–W"rbbv–æF÷rå÷&V5Æ•FV×÷&'’’’°¢÷÷7Ef–Wu7FFUFô†÷7B‚rr¢G'’²÷W6W$FFç&VÖ÷fT—FVÒ„õTåõd”Uuô´U’’Ò6F6‚…ò’·Ð¢&WGW&à¢Ð¢òòÆöæR6&Bg&öÒF†R6V&6‚&W7VÇG2—2æ÷Bv÷'F‚&V÷Væ–ærgFW"¢òò&W7F'BÂæB&V÷Væ–ær&7F–6RF†W&Rv÷VÆBÆ–æRWF†Rv†öÆRÆ–Æ—7B(	@¢òò6ò&V6÷&Bv†B—2VæFW&æVF‚—B–ç7FVC¢FV6²7F–ÆÂÆ––ærÂ÷"æ÷F†–ærà¢–b‡f–WrÓÓÒw&7F–6Rrbbv–æF÷rå÷&7F–6U6–ævÆR’°¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ær’²÷6WD÷Våf–Wr‚wÆ–W"r“²&WGW&âÐ¢÷÷7Ef–Wu7FFUFô†÷7B‚rr¢G'’²÷W6W$FFç&VÖ÷fT—FVÒ„õTåõd”Uuô´U’’Ò6F6‚…ò’·Ð¢&WGW&à¢Ð¢÷÷7Ef–Wu7FFUFô†÷7B‡f–Wr¢G'’°¢÷W6W$FFç6WD—FVÒ„õTåõd”Uuô´U’Â¥4ôâç7G&–æv–g’‡°¢f–WrÀ¢òò–ææVB6ò&W7F÷&RæWfW"&V÷Vç2FV6²g&öÒÆ–Æ—7BF†RW6W"—0¢òòæòÆöævW"–ââF†R–B&–FW2Æöærv†W&RF†W&R—2öæRÂ6òÆ–Æ—7@¢òò&VæÖVB&Vf÷&RF†RæW‡BÆVæ6‚—27F–ÆÂ&V6övæ—6VBà¢Æ–Æ—7C¢‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’ÇÂrrÀ¢W‡D–C¢ö7F—fTW‡D–B‚’À¢C¢FFRææ÷r‚’À¢Ò’¢Ò6F6‚…ò’·Ð§Ð ¢òò6ÆÆVBg&öÒWfW'’FV&F÷vâÂæB—B—2v†–6†WfW"f–Wr—2ÆVgB7FæF–ærF†@¢òòFV6–FW2F†R÷WF6öÖR(	Bæ÷BF†RöæRF†B§W7BvVçBv’à¢òð¢òòF†RGvò÷fW&Æ¢&7F–6R÷Vç2÷fW"FV6²F†B¶VW2Æ––ærVæFW&æVF‚à¢òò6Æ÷6–ær&7F–6RF†W&R×W7Bæ÷BW&6RF†Rf7BF†BF†RFV6²—27F–ÆÂ÷VâÀ¢òò÷"¶–ÆÆ–ærF†RÖöÖVçBÆFW"v÷VÆB&W7F÷&Ræ÷F†–ærâWfW'’6ÆÆW"G&÷0¢òò—G2÷vâfÆr&Vf÷&R6ÆÆ–ær–âÂ6òF†R6†V6·2&VÆ÷r6VRF†R7FFR2—B—0¢òòöæ6RF†—2FV&F÷vâ—2FöæRà¦gVæ7F–öâö6ÆV$÷Våf–Wr‚’°¢–b‡v–æF÷rå÷&7F–6T7F—fR’²÷6WD÷Våf–Wr‚w&7F–6Rr“²&WGW&âÐ¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ær’²÷6WD÷Våf–Wr‚wÆ–W"r“²&WGW&âÐ¢÷÷7Ef–Wu7FFUFô†÷7B‚rr¢G'’²÷W6W$FFç&VÖ÷fT—FVÒ„õTåõd”Uuô´U’’Ò6F6‚…ò’·Ð§Ð ¢òò&VBöæ6RæBv—RÂv†FWfW"†Vç2æW‡Bà¢òð¢òò&W7F÷&RF†B6ææ÷B6ö×ÆWFR(	BÆ–Æ—7BFVÆWFVB6–æ6RÂVWVRF†Bæð¢òòÆöævW"'V–ÆG2Ââ÷WG&–v‡BF‡&÷r(	B×W7Bæ÷BÆVfRF†RfÆr&V†–æBFò&P¢òò&WG&–VBöâWfW'’ÆVæ6‚g&öÒ†W&Röââ&V÷Væ–ærF†Rf–Wr&×2—Bv–âÂ6ð¢òòæ÷F†–ær—2Æ÷7B'’6ÆV&–ærf—'7Bà¦gVæ7F–öâ÷F¶T÷Våf–Wr‚’°¢ÆWB&rÒçVÆÀ¢G'’°¢&rÒ÷W6W$FFævWD—FVÒ„õTåõd”Uuô´U’¢÷W6W$FFç&VÖ÷fT—FVÒ„õTåõd”Uuô´U’¢Ò6F6‚…ò’²&WGW&âçVÆÂÐ¢–b‚&r’&WGW&âçVÆÀ¢G'’°¢6öç7BbÒ¥4ôâç'6R‡&r¢–b‚bÇÂ‡bçf–WrÓÒwÆ–W"rbbbçf–WrÓÒw&7F–6Rr’’&WGW&âçVÆÀ¢&WGW&â`¢Ò6F6‚…ò’²&WGW&âçVÆÂÐ§Ð ¢òòWB&6²F†Rf–WrF†RF–VBv—F‚Â÷6—F–öâæBÆÂà¢òð¢òò&V6†VBöæÇ’F‡&÷Vv‚fÆrF†B7W'f—fVBv†öÆR'VâöbF†RvRÂ6òf–Wp¢òòF†RW6W"6Æ÷6VB(	B÷"FV6²F†Bf–æ—6†VB(	BæWfW"6öÖW2&6²âv—G2f÷"F†P¢òòÆ–Æ—7G2F†R6ÖRv’F†Ræ÷F–f–6F–öâFVWÆ–æ²FöW3¢F†W’'&—fRg&öÐ¢òòÆö6Å7F÷&vR÷"F†RæF—fR7W—F÷%Æ–Æ—7G2W6‚ÂV—F†W"öbv†–6‚6âÆæ@¢òògFW"F†RvRÂæB÷Væ–ær&Vf÷&RF†R&ö÷B†26WGFÆVBvWG2F†Rf–WrF÷&à¢òò7G&–v‡B&6²F÷vâà¦gVæ7F–öâ÷&W7F÷&T÷Våf–Wr‚’°¢òòÆöö·W6â'&—fRGW&–ær&ö÷BÂ&Vf÷&RF†—2FVÆ–VB&W7F÷&F–öâ'Vç2à¢–b‡v–æF÷råõö7W—F÷$Æöö·WvçG56V&6‚’&WGW&à¢6öç7B6fVBÒ÷F¶T÷Våf–Wr‚¢–b‚6fVB’&WGW&à¢òòv—F†÷WBç’&VfW&Væ6RFòF†RÆ–Æ—7BF†W&R—2æòv’FòFVÆÂv†WF†W"F†P¢òòFV6²7F–ÆÂ&VÆöæw2ç—v†W&RÂæB&V÷Væ–ærF†Rw&öæröæR—2v÷'6RF†âæ÷@¢òò&V÷Væ–ærâf–Wr6ææ÷Bæ÷&ÖÆÇ’&R÷Vâv—F†÷WBöæRÂ6òF†—2—2wV&@¢òò&F†W"F†â66Rà¢–b‚6fVBçÆ–Æ—7Bbb6fVBæW‡D–B’&WGW&à¢òòæ÷F–f–6F–öâFVWÆ–æ²÷Vç2f–Wröb—G2÷vã²Gvò÷Vç2&6–ærf÷"F†P¢òò6ÖRDôÒ—2æ÷Bv÷'F‚F†RG&÷V&ÆRÂæBF†RFVWÆ–æ²—2F†RÖ÷&R7V6–f–0¢òò–çFVçB(	BF†RW6W"FVB6öÖWF†–ærâF†RU$Â6ææ÷B&R6öç7VÇFVB†W&S¢F†P¢òò6öÆB×7F'B†æFÆW"7G&—2—G2&×2GW&–ærÖöGVÆRWfÇVF–öâÂÆöær&Vf÷&P¢òòF†—2'Vç2Â6ò—BÆVfW2fÆr&V†–æB–ç7FVBà¢–b‡v–æF÷råö7Wæ÷F–dFVWÆ–æ²’&WGW&à ¢6öç7B7F'BÒFFRææ÷r‚¢6öç7BF–6²Ò‚’Óâ°¢–b‡v–æF÷råõö7W—F÷$Æöö·WvçG56V&6‚’&WGW&à¢òò6öÖWF†–ær÷VæVBf–Wrv†–ÆRvRvW&Rv—F–æs²ÆVfR—BÆöæRà¢–b‡v–æF÷rå÷&7F–6T7F—fRÇÂv–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&à¢6öç7B7W"Ò‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’ÇÂrp¢òò&W6öÇfRWfW'’F–6²&F†W"F†âöæ6S¢F†R6öÆÆV7F–öâF†—2—2ÖF6†V@¢òòv–ç7B7F'G22öæRÖVçG'’&ö÷G7G&Æ6V†öÆFW"æB—2&WÆ6VBv†Và¢òòF†R&VÂ6WBÆæG2Âg&öÒÆö6Å7F÷&vR÷"F†RæF—fRW6‚âÖF6†–ær'’–@¢òòf—'7BÖVç2Æ–Æ—7B&VæÖVB6–æ6R—27F–ÆÂF†R6ÖRÆ–Æ—7Bà¢6öç7BæÖRÒ÷&W6öÇfU&VÖVÖ&W&VEÆ–Æ—7B€¢v–æF÷rå÷&V6÷&F–æw2Â6fVBçÆ–Æ—7BÂ6fVBæW‡D–B¢–b‚æÖR’°¢–b„FFRææ÷r‚’Ò7F'BÂ#’6WEF–ÖV÷WB‡F–6²Â#S¢VÇ6R6öç6öÆRçv&â‚u·&W7F÷&UÒÆ–Æ—7BæWfW"'&—fVC²æ÷B&V÷Væ–ærrÂ6fVB¢&WGW&à¢Ð¢òòöæÇ’F†RÆ–Æ—7Bw2W†—7FVæ6R—2v—FVBöââv†WF†W"—B—2F†R¦7F—fR ¢òòöæR—2F†—2gVæ7F–öâw2¦ö"Fò6WGFÆRÂæ÷B6öÖWF†–ærFò6—BæB†÷Rf÷# ¢òòF†Rw2÷vâÆ–Æ—7G2&RW6†VBgFW"ÆöBæBÆæBv—F‚F†R7F—fP¢òòö–çFW"v†W&WfW"F†RfÆÆ&6²ÆVgB—Bà¢–b†7W"ÓÒæÖR’°¢G'’°¢–b‚6VÆV7E&V6÷&F–ær†æÖR’’°¢6öç6öÆRçv&â‚u·&W7F÷&UÒ6÷VÆBæ÷B6VÆV7BÆ–Æ—7BrÂæÖR¢&WGW&à¢Ð¢Ò6F6‚†R’°¢6öç6öÆRçv&â‚u·&W7F÷&UÒ6VÆV7F–ærF†RÆ–Æ—7Bf–ÆVBrÂR¢&WGW&à¢Ð¢Ð¢ÆWB&W7VÖUVWVRÒçVÆÀ¢G'’°¢òòF†R&W6öÇfVBæÖRÂæ÷B7W&(	BF†Bv2&VB&Vf÷&RF†R6VÆV7B&÷fP¢òòæBv÷VÆB6²f÷"&W7VÖRö–çB–âv†FWfW"Æ–Æ—7BvR§W7BÆVgBà¢6öç7Bö–çBÒ6ö×WFU&W7VÖUö–çB€¢öÆöDÆ7EÆ–VDÖ‚’Âv–æF÷rå÷&V6÷&F–æw2ÂæÖRÀ¢6fVBçf–WrÓÓÒwÆ–W"ròwÆ’r¢w&7F–6Rr¢òòæò&W7VÖRö–çB§W7BÖVç27F'F–ærBF†RF÷(	B7F–ÆÂ&WGFW"F†à¢òòæ÷B6öÖ–ær&6²BÆÂà¢–b‡ö–çB’°¢òòÆ–Æ—7BÖ’†fRw&÷vâ6–æ6RF†RÆ7B6fVB6W76–öââ–âF†@¢òò66R6²&Vf÷&R&V÷Væ–ærv—F‚—G2æWr6&G2&F†W"F†âV–WFÇ¢òò6†æv–ær&Wf–÷W6Ç’'Vææ–ærFV6²à¢–b‡ö–çBæFFVD6÷VçBbb6öæf—&Ò‡ö–çBæÖW76vR’’&WGW&à¢&W7VÖUVWVRÒ²VWVS¢ö–çBçVWVRÂ÷3¢ö–çBç÷2Ð¢Ð¢Ò6F6‚†R’°¢6öç6öÆRçv&â‚u·&W7F÷&UÒ6÷VÆBæ÷B&V'V–ÆBF†RVWVRrÂR¢Ð¢G'’°¢–b‡6fVBçf–WrÓÓÒwÆ–W"r’°¢òò6–ÆVçBöâ'&—fÂ(	B6VRF†R7F'EW6VBæ÷FR–âÆ•&V6÷&F–ærà¢Æ•&V6÷&F–ær„ö&¦V7Bæ76–vâ‡²7F'EW6VC¢G'VRÒÀ¢&W7VÖUVWVRò²&W7VÖUVWVRÒ¢çVÆÂ’¢ÒVÇ6R°¢òò&7F–6R6†÷w26&BæBv—G2f÷"–÷RÂ6òF†W&R—2æ÷F†–ærFð¢òò†öÆB&6²(	B&V÷Væ–ær—BÖ¶W2æò6÷VæBöb—G2÷vâà¢÷Vå&7F–6TÖöFR‡&W7VÖUVWVRò²&W7VÖUVWVRÒ¢VæFVf–æVB¢Ð¢Ò6F6‚†R’°¢6öç6öÆRçv&â‚u·&W7F÷&UÒ&V÷Væ–ærf–ÆVBrÂR¢Ð¢Ð¢F–6²‚§Ð ¦gVæ7F–öâöÖ–&U&W7VÖU7F'D—FVÒ†ÖöFR’°¢6öç7B7W"Òv–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖP¢6öç7Bö–çBÒ6ö×WFU&W7VÖUö–çB…öÆöDÆ7EÆ–VDÖ‚’Âv–æF÷rå÷&V6÷&F–æw2Â7W"ÂÖöFR¢–b‚ö–çB’&WGW&âçVÆÀ¢òòF†R&ö×BæÖW2F†RÆ–Æ—7C²F†R÷F†W"W6W"w26'&–W2—G2÷væW"Æ&VÂà¢6öç7B6†÷vâÒö÷væW$Æ&VÆÆW"‚’ç&Vf—‚†7W"Âv–æF÷rå÷&V6÷&F–æw5¶7W%Ò¢6öç7BÖW76vRÒ6†÷vâÓÓÒ7W"òö–çBæÖW76vR¢ö–çBæÖW76vRç&WÆ6R†"G¶7W'Ò&Â‚’Óâ"G·6†÷vçÒ&¢–b‚6öæf—&Ò†ÖW76vR’’&WGW&âçVÆÀ¢&WGW&â²VWVS¢ö–çBçVWVRÂ÷3¢ö–çBç÷2Ð§Ð ¢òò–÷UGV&R”g&ÖR’W'&÷"6öFW2F†BÖVâF†Rf–FVò6âwB&RÆ–VC ¢òò"(	B–çfÆ–Bf–FVô–Bò&ÖWFW"†6âÇ6òf—&RöâÖöÖVçF'’vÆ—F6‚¢òòR(	B…DÔÃRÆ–W"W'&÷"òæ÷F†W"W'&÷"&VÆFVBFòF†R…DÔÃRÆ–W ¢òò†2ö67W'&VB(	Bg&WVVçFÇ’f—&W2G&ç6–VçFÇ’v†VââBf–Ç2Fð¢òòÆöB÷"F†RÆ–W"†26öFV2†–67WÂWfVâf÷"f–Æ&ÆRf–FV÷0¢òò(	Bf–FVò&VÖ÷fVB÷"Ö&¶VB&—fFR‚&æ÷Bf–Æ&ÆR"’(	B6æöæ–6À¢òòÂS(	B÷væW"F—6ÆÆ÷vVBVÖ&VFFVBÆ–&6²(	B6æöæ–6Â†–FVçF–6À¢òòW"F†R•BFö72¢òð¢òòöæÇ’óóS&R&V6÷&FVB2Væf–Æ&ÆRf–FV÷2â–çfÆ–B&WVW7G2æ@¢òò6Æ–VçBÖ–FVçF—G’W'&÷'26¶—v—F†÷WBÆ&VÆÆ–ærf–FVò&VÖ÷fVBâ÷F†W"W'&÷'0¢òòvWBF†R6ÖR&÷VæFVB&V6÷fW'’v–æF÷r26–ÆVçB'VffW&–ær÷6VV²f–ÇW&Rà¦6öç7B•EõTäd”Ä$ÄUô4äôä”4Åô4ôDU2ÒæWr6WB…³ÂÂSÒ ¢òòW'6—7FVçB&V6÷&Böbf–FV÷2F†B†fRf–ÆVBFòÆ’GW&–ær&V6÷&F–æp¢òòÆ–&6²âW6VBFò7W&f6R&'&ö¶Vâf–FV÷2"&Wf–WrT’–âF†R6WGF–æw0¢òòF–Æör6òF†RW6W"6â6ÆVâWBF†V—"÷vâ6RÂ–ç7FVBöbvWGF–æp¢òòævvVBv—F‚6öæf—&Ò‚’–âF†RÖ–FFÆRöbÆ’6W76–öâà¢òð¢òò6†S¢²·f–FVô–EÓ¢²f—'7E6VVäBÂÆ7E6VVäBÂ6÷VçBÂ6öFRÂÆ&VÃòÒÐ¦6öç7BÄ•õTäd”Ä$ÄUô´U’Ò÷66÷VD¶W’‚v7W—F÷#§Æ•Væf–Æ&ÆRr¦gVæ7F–öâöÆöEÆ•Væf–Æ&ÆR‚’°¢G'’°¢6öç7B&rÒ÷W6W$FFævWD—FVÒ…Ä•õTäd”Ä$ÄUô´U’¢–b‚&r’&WGW&â·Ð¢6öç7Bö&¢Ò¥4ôâç'6R‡&r¢&WGW&âö&¢bbG—Vöbö&¢ÓÓÒvö&¦V7Brbb'&’æ—4'&’†ö&¢’òö&¢¢·Ð¢Ò6F6‚…ò’²&WGW&â·ÒÐ§Ð¦gVæ7F–öâ÷6fUÆ•Væf–Æ&ÆR†Ö’°¢G'’°¢–b‚ÖÇÂö&¦V7Bæ¶W—2†Ö’æÆVæwF‚’÷W6W$FFç&VÖ÷fT—FVÒ…Ä•õTäd”Ä$ÄUô´U’¢VÇ6R÷W6W$FFç6WD—FVÒ…Ä•õTäd”Ä$ÄUô´U’Â¥4ôâç7G&–æv–g’†Ö’¢Ò6F6‚…ò’·Ð§Ð¦gVæ7F–öâ÷&V6÷&EÆ•Væf–Æ&ÆR‡f–FVô–BÂ6öFRÂÆ&VÂ’°¢–b‚f–FVô–B’&WGW&à¢6öç7BÒÒöÆöEÆ•Væf–Æ&ÆR‚¢6öç7Bæ÷rÒFFRææ÷r‚¢6öç7B&WbÒÕ·f–FVô–EÒÇÂ·Ð¢Õ·f–FVô–EÒÒ°¢f—'7E6VVäC¢&Wbæf—'7E6VVäBÇÂæ÷rÀ¢Æ7E6VVäC¢æ÷rÀ¢6÷VçC¢‡&Wbæ6÷VçBÇÂ’²À¢6öFS¢6öFRÒçVÆÂòçVÖ&W"†6öFR’¢&Wbæ6öFRÀ¢Æ&VÃ¢Æ&VÂÇÂ&WbæÆ&VÂÇÂçVÆÂÀ¢Ð¢÷6fUÆ•Væf–Æ&ÆR†Ò¢G'’²÷WFFUÆ•Væf–Æ&ÆT&FvR‚’Ò6F6‚…ò’·Ð§Ð¦gVæ7F–öâöf÷&vWEÆ•Væf–Æ&ÆR‡f–FVô–B’°¢6öç7BÒÒöÆöEÆ•Væf–Æ&ÆR‚¢–b†Õ·f–FVô–EÒ’°¢FVÆWFRÕ·f–FVô–EÐ¢÷6fUÆ•Væf–Æ&ÆR†Ò¢G'’²÷WFFUÆ•Væf–Æ&ÆT&FvR‚’Ò6F6‚…ò’·Ð¢Ð§Ð¦gVæ7F–öâö6ÆV%Æ•Væf–Æ&ÆR‚’°¢÷6fUÆ•Væf–Æ&ÆR‡·Ò¢G'’²÷WFFUÆ•Væf–Æ&ÆT&FvR‚’Ò6F6‚…ò’·Ð§Ð ¢òò¶VWF†R%Væf–Æ&ÆR„â’"'WGFöâÆ&VÂ–â7–æ2v—F‚F†R7F÷&VB6÷VçBà¢òò†–FW2F†R'WGFöâVçF—&VÇ’v†VâF†RÆ—7B—2V×G’(	Bæòö–çBF¶–ærW ¢òò6WGF–æw2Öfö÷FW"76R–bF†W&Rw2æ÷F†–ærFò&Wf–Wrà¦gVæ7F–öâ÷WFFUÆ•Væf–Æ&ÆT&FvR‚’°¢6öç7BÒÒöÆöEÆ•Væf–Æ&ÆR‚¢6öç7BâÒö&¦V7Bæ¶W—2†Ò’æÆVæwF€¢6öç7BF'FâÒB‚r7Æ•Væf–Æ&ÆT'Fâr¢–b‚F'FâæÆVæwF‚’&WGW&à¢F'FâçFW‡B†âòVæf–Æ&ÆR‚G¶çÒ–¢uVæf–Æ&ÆRr¢F'FâçFövvÆR†ââ§Ð ¢òòÆöö²W‡VÖâÖg&–VæFÇ’Æ&VÂf÷"f–FVô–Bg&öÒF†R5%B–æFW‚(	BfÆÇ0¢òò&6²FòF†R&V6÷&FVBÆ&VÂ‡F†R6V&6‚v÷&BF†B÷&–v–æÆÇ’7W&f6V@¢òòF†—2f–FVò’ÂF†VâFòF†R&&Rf–FVô–Bà¦gVæ7F–öâöÆ&VÄf÷%f–FVô–B‡f–FVô–BÂ&V6÷&FVDÆ&VÂ’°¢–b‚f–FVô–B’&WGW&ârp¢G'’°¢6öç7B7'BÒ‡v–æF÷rç7'G2ÇÂµÒ’æf–æB‡2Óâ2bb2æÆ–æ²ÓÓÒf–FVô–B¢–b‡7'Bbb7'BææÖR’°¢òò5%BæÖW2&R#Æ6†ææVÃâÇÂÇF—FÆSâÇÂÆ–Câ#²F†RF—FÆR6VvÖVçB—0¢òòF†RÖ÷7BW6VgVÂf÷"‡VÖâ&Wf–WrÆ—7Bà¢òòF—7Æ’öæÇ’‡FW‡BæB6öæf—&Ò&ö×G2“¢æWfW"7F÷&VBà¢6öç7B'G2Ò7G&–ær‡7'BææÖR’ç7Æ—B‚rÇÂr¢6öç7B6†÷vâÒ'G2æÆVæwF‚ãÒ"ò‡'G5³ÒÇÂ7'BææÖR’¢7'BææÖP¢&WGW&âö÷væW$Æ&VÆÆW"‚’ç&Vf—‚…7G&–ær‡6†÷vâ’Â7'B¢Ð¢Ò6F6‚…ò’·Ð¢–b‡&V6÷&FVDÆ&VÂ’&WGW&â&V6÷&FVDÆ&VÀ¢&WGW&âf–FVô–@§Ð ¢òò6WGF–æw2(i"%Væf–Æ&ÆR„âž(
b"(i"&Wf–WrF–ÆörâÆ—7G2WfW'’f–FVòF†@¢òò†2f–ÆVBFòÆ’GW&–ær&V6÷&F–ær6W76–öâÂv—F‚W"ÖVçG'’7F–öç3 ¢òòÒ÷Vâöâ–÷UGV&R‡6æ—G’Ö6†V6²¢òòÒ&VÖ÷fRg&öÒÆÂÆ–Æ—7G2†G&÷2&VfW&Væ6W3²FöW6âwBFVÆWFR5%G2¢òòÒf÷&vWB†§W7B6ÆV"—Bg&öÒF†—2Æ—7C²ÆVfW2Æ–Æ—7G2õ5%G2ÆöæR¢òòfö÷FW"$6ÆV"ÆÂ"v—W2F†RÆ—7B–âöæRvòv—F†÷WBF÷V6†–ærÆ–Æ—7G2à¦gVæ7F–öâ÷VåÆ•Væf–Æ&ÆTF–Æör‚’°¢ÆWBFFÆrÒB‚r7Æ•Væf–Æ&ÆTF–Æörr¢–b‚FFÆræÆVæwF‚’°¢FFÆrÒB†ÆF—b–CÒ'Æ•Væf–Æ&ÆTF–Æör"F—FÆSÒ%f–FV÷2F†Bf–ÆVBFòÆ’#à¢ÆF—b6Æ73Ò'VBÖ–æfò#åf–FV÷2F†BW'&÷&VB÷WBGW&–ærÆ–&6²â6ÆVæ–ærf–FVòW—2÷F–öæÂ(	BF†RÆ’Æö÷Ç&VG’6¶—27B—BWFöÖF–6ÆÇ’æW‡BF–ÖRãÂöF—cà¢ÆF—b–CÒ'Æ•Væf–Æ&ÆTÆ—7B"6Æ73Ò'VBÖÆ—7B#ãÂöF—cà¢ÆF—b6Æ73Ò'VBÖfö÷FW"#à¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ'Æ•Væf–Æ&ÆT6ÆV$ÆÂ"6Æ73Ò&Æær×FööÂÖ'Fâ#ä6ÆV"ÆÂ†f÷&vWB“Âö'WGFöãà¢ÂöF—cà¢ÂöF—cæ’æVæEFò‚v&öG’r¢FFÆræöâ‚v6Æ–6²rÂr7Æ•Væf–Æ&ÆT6ÆV$ÆÂrÂgVæ7F–öâ‚’°¢6öç7BÒÒöÆöEÆ•Væf–Æ&ÆR‚¢6öç7BâÒö&¦V7Bæ¶W—2†Ò’æÆVæwF€¢–b‚â’&WGW&à¢–b‚6öæf—&Ò†f÷&vWBÆÂG¶çÒVæf–Æ&ÆRf–FVòG¶âÓÓÒòrr¢w2wÓõÆåÆåF†—2öæÇ’6ÆV'2F†R&Wf–WrÆ—7C²—BFöW6âwBF÷V6‚Æ–Æ—7G2÷"5%G2æ’’&WGW&à¢ö6ÆV%Æ•Væf–Æ&ÆR‚¢÷&VæFW%Æ•Væf–Æ&ÆTÆ—7B‚¢Ò¢FFÆræöâ‚v6Æ–6²rÂrçVBÖf÷&vWBrÂgVæ7F–öâ‚’°¢6öç7B–BÒB‡F†—2’æFF‚v–Br¢–b‚–B’&WGW&à¢öf÷&vWEÆ•Væf–Æ&ÆR†–B¢÷&VæFW%Æ•Væf–Æ&ÆTÆ—7B‚¢Ò¢FFÆræöâ‚v6Æ–6²rÂrçVB×&VÖ÷fRrÂgVæ7F–öâ‚’°¢6öç7B–BÒB‡F†—2’æFF‚v–Br¢–b‚–B’&WGW&à¢6öç7BÆ&VÂÒöÆ&VÄf÷%f–FVô–B†–B¢–b‚6öæf—&Ò†&VÖ÷fR"G¶Æ&VÇÒ"g&öÒÆÂÆ–Æ—7G3õÆåÆåF†—2G&÷2WfW'’Æ–Æ—7B—FVÒF†B&VfW&Væ6W2F†—2f–FVòâ5%Bf–ÆW2æBF†R–æFW‚VçG'’&RäõBF÷V6†VBæ’’&WGW&à¢6öç7BâÒ&VÖ÷fUf–FVôg&öÔÆÅÆ–Æ—7G2†–B¢öf÷&vWEÆ•Væf–Æ&ÆR†–B¢÷&VæFW%Æ•Væf–Æ&ÆTÆ—7B‚¢ÆW'B†ââ ¢ò&VÖ÷fVBG¶çÒ—FVÒG¶âÓÓÒòrr¢w2wÒ&VfW&Væ6–ærF†—2f–FVòæ ¢¢tæòÆ–Æ—7B—FV×2&VfW&Væ6VBF†—2f–FVòâr¢Ò¢Ð¢÷&VæFW%Æ•Væf–Æ&ÆTÆ—7B‚¢6öç7B÷G2Ò°¢v–GFƒ¢ÖF‚æÖ–âƒcCÂB‡v–æF÷r’çv–GF‚‚’Ò3"’À¢†V–v‡C¢ÖF‚æÖ–âƒScÂB‡v–æF÷r’æ†V–v‡B‚’Òc’À¢ÖöFÃ¢fÇ6RÀ¢÷Vã¢gVæ7F–öâ‚’°¢B‡F†—2’æ6Æ÷6W7B‚rçV’ÖF–Æörr’æGG"‚wF&–æFW‚rÂÓ’çG&–vvW"‚vfö7W2r¢Ð¢Ð¢–b‚FFÆræ†46Æ72‚wV’ÖF–ÆörÖ6öçFVçBr’’FFÆræF–Æör‚v÷F–öârÂ÷G2’æF–Æör‚v÷Vâr¢VÇ6RFFÆræF–Æör†÷G2§Ð§v–æF÷ræ÷VåÆ•Væf–Æ&ÆTF–ÆörÒ÷VåÆ•Væf–Æ&ÆTF–Æöp ¦gVæ7F–öâ÷&VæFW%Æ•Væf–Æ&ÆTÆ—7B‚’°¢6öç7BFÆ—7BÒB‚r7Æ•Væf–Æ&ÆTÆ—7Br’æV×G’‚¢6öç7BÒÒöÆöEÆ•Væf–Æ&ÆR‚¢6öç7B–G2Òö&¦V7Bæ¶W—2†Ò¢–b‚–G2æÆVæwF‚’°¢FÆ—7BæVæB‚sÆF—b6Æ73Ò'VBÖV×G’#äæòVæf–Æ&ÆRf–FV÷2&V6÷&FVBãÂöF—câr¢&WGW&à¢Ð¢òòÖ÷7B×&V6VçFÇ’Ö'&ö¶Vâf—'7B6òF†RÆ—7B—27F–öæ&ÆRöâWfW'’f—6—Bà¢–G2ç6÷'B‚†Â"’Óâ†Õ¶%ÒæÆ7E6VVäBÇÂ’Ò†Õ¶ÒæÆ7E6VVäBÇÂ’¢6öç7Bf×EF–ÖRÒ‡B’Óâ°¢–b‚B’&WGW&ârp¢6öç7BBÒæWrFFR‡B¢&WGW&âBçFôÆö6ÆU7G&–ær‚¢Ð¢–G2æf÷$V6‚†–BÓâ°¢6öç7BVçG'’ÒÕ¶–EÐ¢6öç7BÆ&VÂÒöÆ&VÄf÷%f–FVô–B†–BÂVçG'’æÆ&VÂ¢6öç7B6öFUFW‡BÒVçG'’æ6öFRÒçVÆÂò•B6öFRG¶VçG'’æ6öFWÖ¢rp¢6öç7B6VVâÒVçG'’æ6÷VçBâòG¶VçG'’æ6÷VçGÜ9r(	BÆ7BG¶f×EF–ÖR†VçG'’æÆ7E6VVäB—Ö¢BG¶f×EF–ÖR†VçG'’æÆ7E6VVäB—Ö ¢6öç7BG&÷rÒB†ÆF—b6Æ73Ò'VB×&÷r#à¢ÆF—b6Æ73Ò'VBÖ&öG’#à¢ÆF—b6Æ73Ò'VBÖÆ&VÂ#ãÂöF—cà¢ÆF—b6Æ73Ò'VB×7V"#ãÂöF—cà¢ÂöF—cà¢ÆF—b6Æ73Ò'VBÖ7F–öç2#à¢Æ6Æ73Ò'VBÖ÷VâÆær×FööÂÖ'Fâ"F&vWCÒ%ö&Ææ²"&VÃÒ&æö÷VæW""‡&VcÒ&‡GG3¢ò÷wwrç–÷WGV&Ræ6öÒ÷vF6ƒ÷cÒG¶Væ6öFUU$”6ö×öæVçB†–B—Ò#ä÷VãÂöà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'VB×&VÖ÷fRÆær×FööÂÖ'Fâ"FFÖ–CÒ"GµòæW66R†–B—Ò"F—FÆSÒ%&VÖ÷fRF†—2f–FVòg&öÒWfW'’Æ–Æ—7B#å&VÖ÷fRg&öÒÆ–Æ—7G3Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'VBÖf÷&vWBÆær×FööÂÖ'Fâ"FFÖ–CÒ"GµòæW66R†–B—Ò"F—FÆSÒ$6ÆV"F†—2VçG'’g&öÒF†R&Wf–WrÆ—7B#äf÷&vWCÂö'WGFöãà¢ÂöF—cà¢ÂöF—cæ¢G&÷ræf–æB‚rçVBÖÆ&VÂr’çFW‡B†Æ&VÂ¢G&÷ræf–æB‚rçVB×7V"r’çFW‡B…¶–BÂ6öFUFW‡BÂ6VVåÒæf–ÇFW"„&ööÆVâ’æ¦ö–â‚r+rr’¢FÆ—7BæVæB‚G&÷r¢Ò§Ð ¢òòGG&–'WFRW'&÷'2öæÇ’FòF†R6GW&VB×f–FVòGFV×BF†B—77VVBF†RÆöBà¢òòâW'&÷"g&öÒ&¶VB&7F–6RöÖçVÂ&VfW&Væ6R÷"F†R&Wf–÷W2–g&ÖP¢òò&WVW7B×W7BæWfW"æf–vFRF†R7W'&VçBÆ–Æ—7B÷"÷fW'w&—FR'WGFöâ&W72à¦gVæ7F–öâ†æFÆU–÷WGV&UÆ–W$W'&÷"†6öFRÂÆ–W"Òv–æF÷rç—EÆ–W"’°¢6öç7BGFV×BÒv–æF÷rå÷&V5f–FVôGFV×@¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ærÇÂv–æF÷rå÷&7F–6T7F—fRÇÂGFV×Còç&WVW7FVBÇÂGFV×Bæ7F—fR‚’’&WGW&à¢ÆWB&W÷'FVD–BÒçVÆÀ¢G'’²&W÷'FVD–BÒÆ–W#òævWEf–FVôFFòâ‚’çf–FVõö–BÇÂçVÆÂÒ6F6‚…ò’·Ð¢–b‡&W÷'FVD–Bbb&W÷'FVD–BÓÒGFV×Bçf–FVô–B’&WGW&à¢6öç7BâÒçVÖ&W"†6öFR¢–b‚â’&WGW&à¢–b…•EõTäd”Ä$ÄUô4äôä”4Åô4ôDU2æ†2†â’’°¢6öç7B6VVâÒv–æF÷rå÷&V5Æ•Væf–Æ&ÆU6VVâÇÂ‡v–æF÷rå÷&V5Æ•Væf–Æ&ÆU6VVâÒæWr6WB‚’¢–b‚6VVâæ†2†GFV×Bçf–FVô–B’’°¢6VVâæFB†GFV×Bçf–FVô–B¢6öç7B—BÒv–æF÷rå÷&V5Æ”7W'&VçD—FVÐ¢÷&V6÷&EÆ•Væf–Æ&ÆR†GFV×Bçf–FVô–BÂâÂ—Bbb†—Bçv÷&BÇÂ—Bç6V&6…FW‡B’¢Ð¢òòFVGWÆ–6F–öâffV7G2&Wf–Wr&öö¶¶VW–æröæÇ’âWfW'’f–ÆVBGFV×BÀ¢òò–æ6ÇVF–ær&WÆ’æBæ÷F†W"6Æ—g&öÒF†R6ÖRf–FVòÂ×W7B6WGFÆRà¢GFV×Bæf–Â‚wVæf–Æ&ÆRrÂâ¢ÒVÇ6R–b†âÓÓÒ"ÇÂâÓÓÒS2’°¢òò–çfÆ–B&WVW7BòÖ—76–ær6Æ–VçB–FVçF—G“¢f–ÂF†—2GFV×Bv—F†÷W@¢òòÆ&VÆÆ–ærF†Rf–FVò—G6VÆb&VÖ÷fVB÷"FF–ær—BFòF†RW&ÖæVçBÆ—7Bà¢GFV×Bæf–Â‚w&WVW7BÖW'&÷"rÂâ¢ÒVÇ6R°¢òò6öFV2öBW'&÷"6â&V6÷fW#²F†R6ÖR#2æò×&öw&W72'VFvWB7F–ÆÀ¢òòÆ–W2æB6ææ÷B&RW‡FVæFVB'’F†RÆ–W"w2'VffW&–ær7FFRà¢GFV×Bææ÷FTW'&÷"‚¢6öç6öÆRçv&â†·Æ•Ò•BW'&÷"G¶çÓ²v—F–ærf÷"Æ–&6²&V6÷fW'–¢Ð§Ð§v–æF÷ræ†æFÆU–÷WGV&UÆ–W$W'&÷"Ò†æFÆU–÷WGV&UÆ–W$W'&÷  ¢òò÷G3 ¢òò7F'D—FVÓ¢²&V4æÖRÂ7BÂrÂ–G‚Ò(	BÆ’g&öÒF†—2—FVÒf—'7@¢òò6‡VffÆR¢&ööÆVâ(	B÷fW'&–FR6WGF–æw2ç&V5Æ•6‡VffÆP¢òòÆö÷¢vöfbrÂvöæRrÂwÆ–Æ—7BrÂvÆÂr(	B÷fW'&–FR6WGF–æw2ç&V5Æ”Æö÷ ¢òòVWVR¢&RÖ'V–ÇB—FVÒ'&’(	BÆ’F†W6R–ç7FVBöbF†R7W'&Vç@¢òòÆ–Æ—7B†Rærâ7F'&VBÆ–æW2¢òòÆ’ÖçVÂ6&Bw2&V6÷&FVBVF–òGW&–ærÆ–Æ—7BÆ–&6²æB&W6öÇfP¢òòv†Vâ—Bf–æ—6†W2†÷"F†RW6W"7F÷2òæf–vFW2v’’âÖ—'&÷'2F†RW6RÀ¢òò7F÷ÂæB&WböæW‡Böv÷Fòv&VæW72öb÷v—E•EVçF–ÄVæBò÷6ÆVW&W7V7F–æuW6P¢òò6òâVF–ò6&B&V†fW2Æ–¶Rf–FVò6Æ—–âF†RVWVRâW6R÷&W7VÖR—0¢òòG&—fVâöfbv–æF÷rå÷&V5Æ•W6VBG&ç6—F–öç2†æ÷BF†RVÆVÖVçBw2÷vâ7FFR¢òò6ò†VG6WB×G&–vvW&VBW6RöbF†RVÆVÖVçB—6âwBf÷Vv‡B'’öÆÂà¢òòF†Rf—6–&ÆRÆ–W"f÷"ÖçVÂ6&Bw2&V6÷&F–æw2âÖçVÂ6&B†2æð¢òòf–FVòÂ6òF†R–÷UGV&R6Æ÷B—2†–FFVâ†&öG’ç&V2×Æ––ærÖÖçVÂ’æBF†—2F¶W0¢òò—G2Æ6R(	Bv—F‚&VÂÆVF–ò6öçG&öÇ3âÂ6òF†R&V6÷&F–ær6â&R67'V&&VBÀ¢òòW6VBæB&WÆ–VB'’†æB&F†W"F†âöæÇ’'’F†RÆ–Æ—7Bw2÷vâF–Ö–ærà¢òò&WW6VB7&÷72—FV×2æBf6W3²7&VFVBöâf—'7BW6Rà¢òòFVÆÂF†R†÷7Bv†WF†W"F†—2Æ–Æ—7B6W76–öâ—2'Vææ–ærà¢òð¢òòF†R†÷7Bw2ÖVF–Ö¶W’6†–Ò&W÷'G2Æ–&6²7FFRg&öÒv–æF÷rç—EÆ––æv ¢òòÆöæRâÖçVÂ6&Bw2ÆVF–óâæWfW"6WG2F†BÂ6òF†R7—7FVÒÖVF–6W76–öà¢òò6—G2–â5DDUõU4TBf÷"F†Rv†öÆR6&B(	BæBæG&ö–B&÷WFW2†VG6WB'WGFöç0¢òòFòF†R6W76–öâ—B&VÆ–WfW2—2Æ––ærÂ6ò–âF†B7FFRF†R'WGFöç2æWfW ¢òò&V6‚F†—2vRBÆÃ¢7W—F÷$ÖVF–¶W–6–×Ç’æWfW"f—&W2à¢òð¢òò&W÷'FVBg&öÒF†R6W76–öâw2÷vâW6R7FFR&F†W"F†âg&öÒv†WF†W"6Æ— ¢òò†Vç2Fò&R6÷VæF–ærâF†Rv2(	BF†R&V6ÆÂW6R&WGvVVâ6÷W&6Ræ@¢òòF&vWBÂF†R†öÆBöâ6&Bw2FW‡BÂF†Rv—B&WGvVVâ—FV×2(	B&R6–ÆVçB'W@¢òò7F–ÆÂ'Æ––ær"2f"2F†RW6W"æBF†R†VG6WB&R6öæ6W&æVBÂæB&P¢òòW†7FÇ’v†Vâ6öÖVöæR&V6†W2f÷"F†R'WGFöç2à¦gVæ7F–öâ÷÷7DÖVF–7FFR‡Æ––ær’°¢G'’°¢òòF†R†÷7Bw26†–Òv÷&·2F†R6ÖR7FFR÷WBf÷"—G6VÆbÂg&öÐ¢òòv–æF÷rç—EÆ––ævÂæB÷7G2F†Böâ—G2÷vâ66†VGVÆRâæ÷F†–ær6WG0¢òòF†BfÆröâÖçVÂ6&BÂ6òF†÷6R÷7G2¶WB6––ær'W6VB"÷fW ¢òòF†RF÷öb÷W'2â¶VW—B–â7FW(	BF†RvR—2v†B¶æ÷w2v†WF†W"F†P¢òòvR—2Æ––ærà¢v–æF÷rç—EÆ––ærÒÆ––æp¢6öç7B"Òv–æF÷räÖVF–7FFP¢–b‚"ÇÂG—Vöb"ç÷7DÖW76vRÓÒvgVæ7F–öâr’&WGW&à¢òò6÷W&6VÖVç2GvòF–ffW&VçBF†–æw3¢F†Rg&öçBFW‡BöbÖçVÂ6&BÀ¢òò'WBF†R&÷f–FW"æÖR‚u–÷UGV&Rr’öâ6GW&VB6Æ—(	B6ò&VF–ær—@¢òò&Æ–æBv÷VÆBF—FÆRWfW'’f–FVò—FVÒ%–÷UGV&R"öâF†RÆö6·67&VVâà¢6öç7B—BÒv–æF÷rå÷&V5Æ”7W'&VçD—FVÐ¢6öç7B&rÒ—Bòrp¢¢ö—4ÖçVÄ—FVÒ†—B’ò…ö6&Df6W4–ä÷&FW"†—B’æÖ†bÓâö6&EÆ–åFW‡B†bçFW‡B’’æf–æB„&ööÆVâ’ÇÂrr¢¢†—Bçv÷&BÇÂ—Bç6V&6…FW‡BÇÂrr¢6öç7BF—FÆRÒ7G&–ær‡&r’ç7Æ—B‚uÆâr•³ÒçG&–Ò‚’ÇÂFö7VÖVçBçF—FÆRÇÂt7W—F÷"p¢"ç÷7DÖW76vR„¥4ôâç7G&–æv–g’‡²Æ––æs¢Æ––ærÂF—FÆS¢F—FÆRç6Æ–6RƒÂ#’Ò’¢Ò6F6‚…ò’·Ð§Ð ¢òò)H)H)H&6¶w&÷VæB×W6–2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òð¢òò4T4ôäB–÷UGV&RÆ–W"ÂV—FR6W&FRg&öÒv–æF÷rç—EÆ–W"Âv†÷6RöæÇ’¦ö ¢òò—2FòÖ¶R6÷VæBVæFW"6&Bâ6W&FR&V6W6R6†&–ærF†RÖ–âÆ–W ¢òòv÷VÆB'&V²–âF‡&VRv—2ÂV6‚öbF†VÒ6–ÆVçFÇ“ ¢òð¢òòÒF†RvwV&B–âÆ•&V6÷&F–ær&R×W6W2v–æF÷rç—EÆ–W"WfW'’#×0¢òòv†–ÆRv—2÷VâÂv†–6‚—2W†7FÇ’v†VâvvrÖöFRvçG2×W6–3°¢òòÒÖçVÂ6&B6â6''’—G2÷vâ–÷UGV&RÆ–æ²F†B—27VVB2&VfW&Væ6RÀ¢òòæBF†RGvòW6W2v÷VÆBf–v‡B÷fW"öæRÆ–W#°¢òòÒ6ÖVF–6öçF–æW"—2F—7Æ“¦æöæRöâÖçVÂ6&BÂæBVF–òg&öÒ¢òòF—7Æ“¦æöæR–g&ÖR—2æ÷BFWVæF&ÆR–ââæG&ö–BvV%f–Wrà¢òð¢òò6òF†—2öæRvWG2—G2÷vâ6öçF–æW"Â&¶VBöfb×67&VVâ'WB$TäDU$TB(	BæWfW ¢òòF—7Æ“¦æöæR÷"f—6–&–Æ—G“¦†–FFVâÂ&÷F‚öbv†–6‚WBÖVF–Æ–&6²BF†P¢òò'&÷w6W"w2F—67&WF–öâà¢òð¢òòv–æF÷rå÷&V5Æ•†6V6—2v†BF†RÆ–Æ—7B—2Fö–ær&–v‡Bæ÷r(	Bv6Æ—p¢òò†&V6÷&F–ær—26÷VæF–ær’Âvvr†W6R’Âwf–FVòr†6GW&VB6Æ—Âv†–6€¢òò†2—G2÷vâVF–ò’Â÷"v–FÆRrâF†RÖöFR6WGF–ærÖ2F†BFò6÷VæB÷ ¢òò6–ÆVæ6S²æ÷F†–ærVÇ6RFV6–FW2à¢òð¢òòGvò¶–æG2öbG&6²ÂöæRVæv–æRBF–ÖRâ–÷UGV&RG&6²&–FW2F†R6V6öæ@¢òò•BÆ–W"FW67&–&VB&÷fS²f–ÆRF†RW6W"–6¶VBg&öÒF†RFWf–6RÆ—0¢òòF‡&÷Vv‚Æ–âÆVF–óâVÆVÖVçB–âF†R6ÖRöfb×67&VVâ†÷7Bâ&÷F‚6—@¢òò&V†–æBF†R6ÖR6ÖÆÂ7W&f6R6òF†Bæ÷F†–ær&VÆ÷rF†—2&Æö6²(	BF†P¢òòÖöFR÷†6RFV6—6–öâÂF†RæVÂÂ7F÷æB&W6WB(	B¶æ÷w2÷"6&W2v†–6‚öæP¢òò—26÷VæF–æs ¢òð¢òò¶–æBw–÷WGV&RrÂvÆö6Âp¢òò&VG’G'VRöæ6RÆ’‚’v–ÆÂ&R†öæ÷W&V@¢òòÆöFVD–BF†RG&6²–BF†RVæv–æR7W'&VçFÇ’†öÆG0¢òò7VR‡G&6²’7vFòæ÷F†W"G&6²öbF†R4ÔR¶–æBv—F†÷WB7F'F–ær—@¢òòÆ’‚’òW6R‚’ò6WEföÇVÖRƒâã¢òò7F÷‚’&VÆV6RF†R6÷W&6RVçF—&VÇ’(	BF†RVæv–æR—2FöæP¦ÆWBö×W6–4Væv–æRÒçVÆÀ ¢òòF†Röfb×67&VVâ6öçF–æW"&÷F‚Væv–æW2Ö÷VçB–çFòâ&¶VBöfb×67&VVâ'W@¢òò$TäDU$TB(	BæWfW"F—7Æ“¦æöæR÷"f—6–&–Æ—G“¦†–FFVâÂ&÷F‚öbv†–6‚WBÖVF–¢òòÆ–&6²BF†R'&÷w6W"w2F—67&WF–öâà¦gVæ7F–öâö×W6–4†÷7DæöFR‚’°¢ÆWB†÷7BÒFö7VÖVçBævWDVÆVÖVçD'”–B‚w&V4×W6–4†÷7Br¢–b‚†÷7B’°¢†÷7BÒFö7VÖVçBæ7&VFTVÆVÖVçB‚vF—br¢†÷7Bæ–BÒw&V4×W6–4†÷7Bp¢†÷7Bç7G–ÆRæ775FW‡BÒw÷6—F–öã¦f—†VC¶ÆVgC¢Óƒ·F÷£·v–GFƒ£#ƒ¶†V–v‡C£#ƒ²r°¢v÷6—G“£·ö–çFW"ÖWfVçG3¦æöæS·¢Ö–æFWƒ¢Ó²p¢Fö7VÖVçBæ&öG’æVæD6†–ÆB††÷7B¢Ð¢&WGW&â†÷7@§Ð ¦gVæ7F–öâöÇ”×W6–5föÇVÖR‚’°¢–b‚ö×W6–4Væv–æRÇÂö×W6–4Væv–æRç&VG’’&WGW&à¢G'’²ö×W6–4Væv–æRç6WEföÇVÖR…ö×W6–5föÇVÖR‚’’Ò6F6‚…ò’·Ð§Ð ¢òòv‡’F†R7W'&VçBG&6²vöâwBÆ’(	B–÷UGV&RW'&÷"6öFRÂ÷"öæRöb÷W"÷và¢òò7G&–æw2f÷"Æö6Âf–ÆR(	BæBv†Vâ—Bw2f–æRâ¶WB'Bg&öÒF†P¢òòVæv–æRw2&VG–Âv†–6‚6—2öæÇ’v†WF†W"F†RÆ–W"ô$¤T5B—2Æ—fRà¢òò6öæfÆF–ærF†RGvò—2G&¢×W6–2WÆöBF†B&VgW6W2VÖ&VFF–æp¢òòƒóS’—2F†R6öÖÖöâ66RÂæ÷BF†R&&RöæRÂæB6–ævÆRfÆrv÷VÆ@¢òòF†VâF—6&ÆRF†RfVGW&Rf÷"F†R&W7BöbF†RvRw2Æ–fRÂ–æ6ÇVF–ærf÷ ¢òòF†Rv÷&¶–ærU$ÂF†RW6W"7FW2æW‡Bà¦ÆWBö×W6–4W'&÷"Ò  ¢òòF†R6öFW2v÷'F‚W‡Æ–æ–ærâç—F†–ærVÇ6RvWG2F†RvVæW&–2Æ–æRà¦gVæ7F–öâö×W6–4W'&÷%FW‡B†6öFR’°¢–b†6öFRÓÓÒvÆö6ÂÖFV6öFRr’&WGW&â'F†—2FWf–6R6âwBÆ’F†Bf–ÆR ¢–b†6öFRÓÓÒÇÂ6öFRÓÓÒS’&WGW&â'F†Bf–FVòw2÷væW"FöW6âwBÆÆ÷r—BFò&RÆ–VB–ç6–FR÷F†W"2 ¢–b†6öFRÓÓÒ’&WGW&âwF†Bf–FVò—2&—fFR÷"†2&VVâ&VÖ÷fVBp¢–b†6öFRÓÓÒ"’&WGW&â'F†BÆ–æ²FöW6âwBö–çBBÆ–&ÆRf–FVò ¢&WGW&âu–÷UGV&R&VgW6VBFòÆ’F†Bf–FVòp§Ð ¢òòv†–6‚G&6²F†Rf–ÇW&R&VÆöæw2FòÂ6òF†RæVÂ6âö–çBBF†RöffVæF–æp¢òò&÷r&F†W"F†âv&æ–ær&÷WBF†RÆ–'&'’2v†öÆRà¦ÆWBö×W6–4W'&÷$–BÒrp ¢òòVæv—2F†RVæv–æRF†Bf–ÆVBÂ76VB–â&F†W"F†â&VBg&öÐ¢òòö×W6–4Væv–æS¢Æ–W"W'&÷'2'&—fR27–æ2ÖW76vW2Â6ò'’F†RF–ÖRöæP¢òòÆæG2F†RVæv–æR—B&VÆöæw2FòÖ’Ç&VG’†fR&VVâ&WÆ6VBà¦gVæ7F–öâöæ÷FT×W6–4W'&÷"†6öFRÂVær’°¢òò7v—F6‚öb¶–æB7F÷2F†RöÆBVæv–æS²âW'&÷"—Bv2Ç&VG’&÷WBFð¢òò&W÷'B×W7Bæ÷B6–ÆVæ6RF†RæWröæRà¢–b†VærbbVærÓÒö×W6–4Væv–æR’&WGW&à¢ö×W6–4W'&÷"Ò6öFRÇÂ¢ö×W6–4W'&÷$–BÒVæròVæræÆöFVD–B¢…ö×W6–4Væv–æRòö×W6–4Væv–æRæÆöFVD–B¢rr¢òò6’—B÷WBÆ÷VBöæ6Râ6–ÆVæ6R†W&R—2v†BÖ¶W2F†—2fVGW&RÆöö²6–×Ç¢òò'&ö¶Vã¢F†RU$Â—2fÆ–BÆ–æ²Â6òæ÷F†–ærVÇ6RfÆw2—Bà¢ö7'V–ÆEFö7B†æò&6¶w&÷VæB×W6–2(	BGµö×W6–4W'&÷%FW‡B†6öFR—Òæ¢–b‚B‚r6×W6–5æVÄF–Æörr’æ—2‚s§f—6–&ÆRr’’÷&VæFW$×W6–5æVÂ‚§Ð ¢òò)H)H–÷UGV&RVæv–æR)H)H ¦gVæ7F–öâöÖ¶U—D×W6–4Væv–æR‡G&6²’°¢–b‚v–æF÷rå•BÇÂG—Vöbv–æF÷rå•BåÆ–W"ÓÒvgVæ7F–öâr’&WGW&âçVÆÀ¢6öç7BÖ÷VçBÒFö7VÖVçBæ7&VFTVÆVÖVçB‚vF—br¢ö×W6–4†÷7DæöFR‚’æVæD6†–ÆB†Ö÷VçB¢6öç7BVærÒ²¶–æC¢w–÷WGV&RrÂ&VG“¢fÇ6RÂÆöFVD–C¢G&6²æ–BÂÆ–W#¢çVÆÂÐ¢òò7VRÂæ÷BÆöC¢ÆöEf–FVô'”–B7F'G2Æ––ær–ÖÖVF–FVÇ’ÂæBv†WF†W"vP¢òò6†÷VÆB&R6÷VæF–ær—2÷7–æ4&6¶w&÷VæD×W6–2w2FV6—6–öâÂæ÷BF†—2öæRw2à¢òòæ÷BvFVBöâ&VG–¢Æ–W"v†÷6RÆ7Bf–FVòW'&÷&VB×W7B7F–ÆÀ¢òò66WBF†RæW‡BöæRÂ÷"öæR&BÆ–æ²ö—6öç2WfW'’ÆFW"vööBöæRà¢Væræ7VRÒ‡B’Óâ²G'’²VærçÆ–W"æ7VUf–FVô'”–B‡Bæ–B“²VæræÆöFVD–BÒBæ–BÒ6F6‚…ò’·ÒÐ¢VærçÆ’Ò‚’Óâ²G'’²VærçÆ–W"çÆ•f–FVò‚’Ò6F6‚…ò’·ÒÐ¢VærçW6RÒ‚’Óâ²G'’²VærçÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·ÒÐ¢Værç6WEföÇVÖRÒ‡b’Óâ²G'’²VærçÆ–W"ç6WEföÇVÖR‡b’Ò6F6‚…ò’·ÒÐ¢Værç7F÷Ò‚’Óâ°¢VærçW6R‚¢òòFW7G&÷’‚’F¶W2F†R–g&ÖRv—F‚—C²F†RÖ÷VçBF—b—2÷W'2Fò&VÖ÷fRà¢G'’²VærçÆ–W"æFW7G&÷’‚’Ò6F6‚…ò’·Ð¢G'’²Ö÷VçBç&VÖ÷fR‚’Ò6F6‚…ò’·Ð¢Værç&VG’ÒfÇ6P¢Ð¢G'’°¢VærçÆ–W"ÒæWrv–æF÷rå•BåÆ–W"†Ö÷VçBÂ°¢f–FVô–C¢G&6²æ–BÀ¢v–GFƒ¢#Â†V–v‡C¢#À¢Æ–W%f'3¢²WF÷Æ“¢Â6öçG&öÇ3¢ÂF—6&ÆV¶#¢Âg3¢ÂÖöFW7F'&æF–æs¢ÂÆ—6–æÆ–æS¢ÒÀ¢WfVçG3¢°¢öå&VG“¢‚’Óâ²Værç&VG’ÒG'VS²öÇ”×W6–5föÇVÖR‚“²÷7–æ4&6¶w&÷VæD×W6–2‚’ÒÀ¢öå7FFT6†ævS¢†R’Óâ°¢òòÆö÷'’†æBöâTäDTBâF†RÆö÷Æ–W%f"öæÇ’v÷&·2v–ç7B¢òò&VÂÆ–Æ—7BÂ6òf÷"6–ævÆRf–FVò—BFöW2æ÷F†–ærà¢òð¢òò&Wv–æBæBF†Vâ6²F†RW7VÂVW7F–öâ&F†W"F†â6ÆÆ–æp¢òòÆ•f–FVò‚’÷WG&–v‡C¢•B7FFR6†ævW2'&—fR27–æ2ÖW76vW0¢òòg&öÒF†R–g&ÖRÂ6òâTäDTB6âÆæBgFW"7F÷÷"†6P¢òòfÆ—ÂæB&W7F'F–ær&Æ–æBv÷VÆB7G&æBF†R×W6–2Æ––ærv—F‚æð¢òò6W76–öâFòGW&â—Böfbà¢–b†RbbRæFFÓÓÒ’°¢G'’²VærçÆ–W"ç6VVµFòƒÂG'VR’Ò6F6‚…ò’·Ð¢÷7–æ4&6¶w&÷VæD×W6–2‚¢&WGW&à¢Ð¢òò5TTBƒR’÷"Ä””ärƒ“¢F†RÆ–W"æ÷r¶æ÷w2F†R&VÂF—FÆRÂ6ð¢òòâVææÖVBG&6²6â7F÷6†÷v–ær2&&Rf–FVò–Bà¢–b†Rbb†RæFFÓÓÒRÇÂRæFFÓÓÒ’’öÖ–&TæÖUG&6´g&öÕÆ–W"‚¢ÒÀ¢öäW'&÷#¢†R’Óâöæ÷FT×W6–4W'&÷"†RbbRæFFÂVær’À¢ÒÀ¢Ò¢Ò6F6‚…ò’°¢G'’²Ö÷VçBç&VÖ÷fR‚’Ò6F6‚…ò’·Ð¢&WGW&âçVÆÀ¢Ð¢&WGW&âVæp§Ð ¢òòG&6²VæF–ærGv–6R–ç6–FRF†—2Öç’×2—2æ÷B×W6–2Æö÷–ærÂæBÆ––æp¢òòf÷"ÆöævW"F†â—B—2&ööbF†RG&6²—2f–æRà¦6öç7BÕU4”5ôÄôõôÔ”åôÕ2Ò ¢òò&WG&–W2–âV–6²7V66W76–öâ&Vf÷&RÆVf–ær—BÆöæRVçF–Â6öÖWF†–ær6†ævW2à¦6öç7BÕU4”5ôÄôõôt•dUõUÒ0 ¢òò)H)HÆö6ÂÖf–ÆRVæv–æR)H)H ¢òòF†RÆö÷—2G&—fVâ'’†æBÂF†Rv’F†R–÷UGV&RVæv–æRw2Çv—2†2&VVâà¢òòÆö÷öâF†RVÆVÖVçB—2FVÆ–&W&FVÇ’äõB6WC¢âVÆVÖVçB6''––ærÆö÷ ¢òòGG&–'WFRæWfW"&W÷'G2†f–ærVæFVB(	BæòVæFVFWfVçBÂæBVæFVF&VG0¢òòfÇ6Rf÷&WfW"(	B6ò—BF¶W2WfW'’ÖVç2öbæ÷F–6–ær&Wv–æBF†BF–Bæ÷@¢òò†Vâv—F‚—Bâ—B6·2F†RVÆVÖVçBFò6VV²&6²FòF†R7F'BÂæBF†W6P¢òòf–ÆW2&R6W'fVBg&öÒâ÷&–v–âF†Bç7vW'2æò&ævR&WVW7BÂ6òöâG&6°¢òòFöòÆöærFò7F’'VffW&VBF†B6VV²6âV–WFÇ’Fòæ÷F†–æræBÆVfRF†R&V@¢òò6–ÆVçBv—F‚æ÷F†–ærFò&W÷'Bà¢òð¢òòF†R7&2—2F†RU$ÂF†R6W'fW2F†Rf–ÆRBÂæWfW"f–ÆS¢òò(	BvRÆöFV@¢òò÷fW"‡GG26ææ÷B&VfW&Væ6Rf–ÆS¢òò7V'&W6÷W&6Rà¦gVæ7F–öâöÖ¶TÆö6Ä×W6–4Væv–æR‡G&6²’°¢6öç7BÒFö7VÖVçBæ7&VFTVÆVÖVçB‚vVF–òr¢ç&VÆöBÒvWFòp¢ç6WDGG&–'WFR‚wÆ—6–æÆ–æRrÂrr¢ö×W6–4†÷7DæöFR‚’æVæD6†–ÆB†¢6öç7BVærÒ²¶–æC¢vÆö6ÂrÂ&VG“¢fÇ6RÂÆöFVD–C¢G&6²æ–BÂVÃ¢Ð¢Væræ7VRÒ‡B’Óâ°¢VæræÆöFVD–BÒBæ–@¢ç7&2Òö×W6–56W'fVEW&Â‡B¢G'’²æÆöB‚’Ò6F6‚…ò’·Ð¢Ð¢òòÆ’‚’&WGW&ç2&öÖ—6RF†B&V¦V7G2v†VâF†R'&÷w6W"&VgW6W3²F†P¢òò&V¦V7F–öâ—2æ÷BâW'&÷"vR6â7BöâÂæBâVæ†æFÆVBöæR—2æö—6Rà¢òð¢òò6¶–ærâVÆVÖVçBF†B—2Ç&VG’BF†RVæBFòÆ’—26¶–ær—BFð¢òò&Wv–æBÂæBöââVç6VV¶&ÆR&W7öç6R—BÖ’æ÷B&R&ÆRFò(	BÆVf–ærF†P¢òò&VB6–ÆVçBv—F‚æ÷F†–ærFò&W÷'BÂ&V6W6R&VgW6–ærFò&Wv–æB—2æ÷Bà¢òòW'&÷"æBF†RVæBv2&V6†VBÆöærvòâ6ò&VÆöBf—'7C¢F†RöæR&Wv–æ@¢òòF†BÇv—2v÷&·2â6V6öæBv’&6²–â&W6–FRF†RVæFVF†æFÆW"Âf÷"¢òòG&6²F†B7F÷2v—F†÷WBWfW"ææ÷Væ6–ær—Bà¢VærçÆ’Ò‚’Óâ°¢G'’²–b…ö×W6–4æVVG5&VÆöB†’’æÆöB‚’Ò6F6‚…ò’·Ð¢G'’²6öç7BÒçÆ’‚“²–b‡bbæ6F6‚’æ6F6‚‚‚’Óâ·Ò’Ò6F6‚…ò’·Ð¢Ð¢VærçW6RÒ‚’Óâ²G'’²çW6R‚’Ò6F6‚…ò’·ÒÐ¢Værç6WEföÇVÖRÒ‡b’Óâ²çföÇVÖRÒÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂçVÖ&W"‡b’ÇÂ’’òÐ¢Værç7F÷Ò‚’Óâ°¢VærçW6R‚¢òòG&÷–ærF†R7&2æB&VÆöF–ær—2v†B7GVÆÇ’&VÆV6W2F†R7G&VÓ°¢òò&VÖ÷f–ærF†RVÆVÖVçBÆöæRÆVfW2F†RfWF6‚'Vææ–ærà¢G'’²ç&VÖ÷fTGG&–'WFR‚w7&2r“²æÆöB‚’Ò6F6‚…ò’·Ð¢G'’²ç&VÖ÷fR‚’Ò6F6‚…ò’·Ð¢Værç&VG’ÒfÇ6P¢Ð¢òò&VG–fÆ—2öæ6RæB7F—2WÂÆ–¶RF†R–÷UGV&RVæv–æRw2öå&VG“¢¢òòÆ’‚’—77VVB&Vf÷&RÆFW"7VR†2'VffW&VB—27F–ÆÂ†öæ÷W&VBöæ6RFF¢òò'&—fW2Â6òF†W&R—2æ÷F†–ærFòv—Bf÷"öâ7V'6WVVçBG&6·2à¢æFDWfVçDÆ—7FVæW"‚v6çÆ’rÂ‚’Óâ°¢–b†Værç&VG’’&WGW&à¢Værç&VG’ÒG'VP¢öÇ”×W6–5föÇVÖR‚¢÷7–æ4&6¶w&÷VæD×W6–2‚¢Ò¢òòÆö÷6·2F†R'&÷w6W"Fò&Wv–æBF†R7G&VÒ—G6VÆbÂæBF†R6W'fW0¢òòF†RG&6²&V6†VB—G2VæC¢7F'B—Bv–ââÆöB‚’&F†W"F†à¢òò7W'&VçEF–ÖRÒÂ&V6W6Rg&W6‚ÆöB—2F†RöæÇ’&Wv–æBF†BFöW2æ÷@¢òòFWVæBöâ6VV¶–ærÂæBF†W6Rf–ÆW2&R6W'fVBg&öÒâ÷&–v–âF†Bç7vW'0¢òòæò&ævR&WVW7Bà¢òð¢òòf–ÆRF†BVæG2F†RÖöÖVçB—B7F'G2v÷VÆB7–â2f7B2F†R'&÷w6W ¢òò6âF—7F6‚Â6òVæG2'&—f–æröâF÷öbV6‚÷F†W"7F÷&V–ærç7vW&VBà¢òòÖV7W&VB&WGvVVâöæRVæBæBF†RæW‡BÂv†–6‚—2†÷rÆöærF†RG&6²Æ–V@¢òòf÷"(	B–V6Röb×W6–2FöW2æ÷Bf–æ—6‚Gv–6R–ç6–FR6V6öæBââVæBF†@¢òò'&—fW2gFW"FV6VçB7G&WF6‚6ÆV'2F†R6÷VçBÂ6ò6W76–öâw2v÷'F‚ö`¢òò÷&F–æ'’Æö÷–æræWfW"&ö6†W2—BÂæBöæR&BG&ç6—F–öâ6ææ÷BÆVfP¢òòF†R&VB6–ÆVçBf÷"vööBà¢ÆWBÆ7DVæFVDBÒ ¢ÆWBV–6´VæG2Ò ¢æFDWfVçDÆ—7FVæW"‚vVæFVBrÂ‚’Óâ°¢–b†VærÓÒö×W6–4Væv–æR’&WGW&à¢6öç7Bæ÷rÒFFRææ÷r‚¢V–6´VæG2Ò†æ÷rÒÆ7DVæFVDBÂÕU4”5ôÄôõôÔ”åôÕ2’òV–6´VæG2²¢ ¢Æ7DVæFVDBÒæ÷p¢–b‡V–6´VæG2ãÒÕU4”5ôÄôõôt•dUõU’&WGW&à¢G'’²æÆöB‚’Ò6F6‚…ò’·Ð¢÷7–æ4&6¶w&÷VæD×W6–2‚¢Ò¢òòG&6²F†B—26÷VæF–ær†2æ÷F†–ærÆVgBFò&WG'’âv—F†÷WBF†—2F†RöæP¢òò&WG'’ööäÆö6Ä×W6–4W'&÷"ÆÆ÷w2—27VçBöæ6Rf÷"F†RÆ–fRöbF†RVæv–æP¢òò&F†W"F†âöæ6RW"7GVÖ&ÆRÂ6òÆFW"G&ç6–VçBf–ÇW&RvöW27G&–v‡@¢òòFòv—f–ærWæB6–ÆVæ6W2F†R&VBf÷"F†R&W7BöbF†R6W76–öââÆö÷–ær'¢òò†æB&RÖfWF6†W2F†Rf–ÆRöâWfW'’ÆÂv†–6‚—2F†B×V6‚Ö÷&R÷÷'GVæ—G¢òòf÷"7GVÖ&ÆRà¢æFDWfVçDÆ—7FVæW"‚wÆ––ærrÂ‚’Óâ²Værç&WG&–VD–BÒrrÒ¢æFDWfVçDÆ—7FVæW"‚vW'&÷"rÂ‚’ÓâööäÆö6Ä×W6–4W'&÷"†Vær’¢ç7&2Òö×W6–56W'fVEW&Â‡G&6²¢&WGW&âVæp§Ð ¢òòâÆVF–óâW'&÷"FöW2æ÷B6’v†WF†W"F†Rf–ÆR—2Ö—76–ær÷"ÖW&VÇ’öæRF†P¢òòvV%f–Wr6ææ÷BFV6öFR(	B&÷F‚'&—fR2F†R6ÖR6öFRâ6ò6³¢'VâF†R7vVWÀ¢òòæB–b—BFöö²F†—2G&6²F†Rf–ÆRv2vöæRæBF†RW6W"†2&VVâFöÆBâ–`¢òòæ÷BÂF†Rf–ÆR—2F†W&RæBVçÆ–&ÆRÂæBF†R&÷r—2Ö&¶VBà¦7–æ2gVæ7F–öâööäÆö6Ä×W6–4W'&÷"†Vær’°¢–b†VærÓÒö×W6–4Væv–æR’&WGW&à¢6öç7B–BÒVæræÆöFVD–@¢6öç7B&ö&RÒv—B÷&ö&TÆö6Ä×W6–2‚¢òòF†RW6W"Ö’†fRÖ÷fVBöâv†–ÆRvRvW&R6¶–ærââç7vW"&÷WBF†P¢òòôÄBG&6²×W7Bæ÷B&R–ææVBöâv†FWfW"—2ÆöFVBæ÷rà¢–b†VærÓÒö×W6–4Væv–æRÇÂVæræÆöFVD–BÓÒ–B’&WGW&à¢–b‡&ö&Rç7FFRÓÓÒw&VG’r’°¢6öç7B&VÖ÷fVBÒöÇ”×W6–57vVW‡&ö&RæöäF—6²¢–b‡&VÖ÷fVBç6öÖR‡BÓâBæ–BÓÓÒ–B’’&WGW&à¢Ð¢òòF†Rf–ÆR—2F†W&Râf—'7Bf–ÇW&R6âÇ6ò&RF†RvR6¶–ær&Vf÷&P¢òòF†R†Bv—&VB—G6VÆbWFòç7vW"Â6ò&VÆöBöæ6R&Vf÷&R&ÆÖ–ærF†P¢òòf–ÆS²6V6öæBf–ÇW&RöâF†R6ÖRG&6²—2F†Rf–ÆRw2à¢6öç7BG&6²Òö×W6–5G&6´æ÷r‚¢òòÖ÷fVBöâv†–ÆRvRvW&R6¶–ær(	BF†R6&B&V–ærÆ–VBæ÷rvçG2F–ffW&Vç@¢òòG&6²Â÷"æöæRâv†FWfW"vVçBw&öær&VÆöæw2FòG&6²æö&öG’—2v—F–æp¢òòf÷"ÂæBFö7B&÷WB—Bv÷VÆBæÖR6öÖWF†–æræòÆöævW"öâ67&VVâà¢–b‚G&6²ÇÂG&6²æ–BÓÒ–B’&WGW&à¢–b†Værç&WG&–VD–BÓÒ–B’°¢Værç&WG&–VD–BÒ–@¢Væræ7VR‡G&6²¢÷7–æ4&6¶w&÷VæD×W6–2‚¢&WGW&à¢Ð¢öæ÷FT×W6–4W'&÷"‚vÆö6ÂÖFV6öFRrÂVær§Ð ¢òò'V–ÇBöâf—'7B7GVÂæVVBÂ6òW6W"v†òæWfW"FG2G&6²æWfW"—0¢òòf÷"âW‡G&–g&ÖR÷"VÆVÖVçBà¦gVæ7F–öâöVç7W&T×W6–4Væv–æR‚’°¢6öç7BG&6²Òö×W6–5G&6´æ÷r‚¢6öç7B¶–æBÒö×W6–4Væv–æTf÷"‡G&6²¢–b†¶–æBÓÓÒvæöæRr’&WGW&âçVÆÀ¢–b…ö×W6–4Væv–æRbbö×W6–4Væv–æRæ¶–æBÓÒ¶–æB’°¢òòöæÇ’öæR6÷W&6R6÷VæG2BF–ÖRÂæB–÷UGV&R–g&ÖR¶WBÆ—fRf÷ ¢òòG&6²æö&öG’6†÷6R—2ÖVÖ÷'’F†R†öæRv÷VÆB&F†W"†fR&6²à¢ö×W6–4Væv–æRç7F÷‚¢ö×W6–4Væv–æRÒçVÆÀ¢Ð¢–b…ö×W6–4Væv–æR’°¢–b…ö×W6–4Væv–æRæÆöFVD–BÓÒG&6²æ–B’°¢ö×W6–4Væv–æRæ7VR‡G&6²¢ö×W6–4W'&÷"ÒòòæWrG&6²vWG26ÆVâ6ÆFP¢ö×W6–4W'&÷$–BÒrp¢öÇ”×W6–5föÇVÖR‚¢Ð¢&WGW&âö×W6–4Væv–æP¢Ð¢ö×W6–4Væv–æRÒ¶–æBÓÓÒw–÷WGV&RròöÖ¶U—D×W6–4Væv–æR‡G&6²’¢öÖ¶TÆö6Ä×W6–4Væv–æR‡G&6²¢–b…ö×W6–4Væv–æR’°¢ö×W6–4W'&÷"Ò ¢ö×W6–4W'&÷$–BÒrp¢Ð¢&WGW&âö×W6–4Væv–æP§Ð ¢òò)H)H)HÆö6Â×W6–2f–ÆW3¢v†BF†RFWf–6R†2)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òòF†RÆ–'&'’&VÖVÖ&W'2f–ÆS¢òòU$Ã²F†R÷vç2F†Rf–ÆRâF†W6R¶VWF†P¢òòGvò†öæW7Bv—F‚V6‚÷F†W"à ¢òòv†BF†RFWf–6R6âFòf÷"Æö6Â×W6–2Âg&öÒöæR×W6–4Æ—7F6ÆÃ ¢òòw&VG’r(	BF†R'&–FvRç7vW&VC²öäF—6¶—2v†B—B†öÆG0¢òòwVç7W÷'FVBr(	BF†R—2F†W&R'WB6ææ÷B6W'fRf–ÆW2„æG&ö–BÂ‚¢òòvW'&÷"r(	BF†R—2F†W&RæB6†÷VÆB&R&ÆRFòÂ'WBF†RÆ—7F–æp¢òòf–ÆVC²æ÷F†–ærÖ’&R7vWBöâF†—2ç7vW ¢òòvæöæRr(	Bæò'&–FvRBÆÃ¢Æ–â'&÷w6W ¦7–æ2gVæ7F–öâ÷&ö&TÆö6Ä×W6–2‚’°¢–b‚ö†fTVF–ô'&–FvR‚’’&WGW&â²7FFS¢væöæRrÂöäF—6³¢çVÆÂÐ¢G'’°¢6öç7B&rÒv—BöVF–õ'2‚v×W6–4Æ—7BrÂ·Ò¢6öç7BÆ—7BÒ¥4ôâç'6R‡&rÇÂuµÒr¢–b‚'&’æ—4'&’†Æ—7B’’&WGW&â²7FFS¢vW'&÷"rÂöäF—6³¢çVÆÂÐ¢&WGW&â²7FFS¢w&VG’rÂöäF—6³¢Æ—7BÐ¢Ò6F6‚†R’°¢6öç7B×6rÒ7G&–ær‚†RbbRæÖW76vR’ÇÂrr¢–b†×6rÓÓÒwVç7W÷'FVBr’&WGW&â²7FFS¢wVç7W÷'FVBrÂöäF—6³¢çVÆÂÐ¢–b†×6rÓÓÒvæòÖ'&–FvRr’&WGW&â²7FFS¢væöæRrÂöäF—6³¢çVÆÂÐ¢&WGW&â²7FFS¢vW'&÷"rÂöäF—6³¢çVÆÂÐ¢Ð§Ð ¢òòG&÷WfW'’Æö6ÂG&6²v†÷6Rf–ÆR—2æòÆöævW"öâF†RFWf–6RÂFVÆÂF†P¢òòW6W"ÂæBÆWBF†R&VB†æB÷fW"â&WGW&ç2F†RG&6·2&VÖ÷fVBâöæÇ’WfW ¢òò6ÆÆVBv—F‚&VÂÆ—7F–ær(	Bf–ÆVBÆ—7F–ær×W7BæWfW"Æöö²Æ–¶Rà¢òòV×G’F—6²Â÷"öæR&B'&–FvR6ÆÂv÷VÆBv—RF†RÆ–'&'’à¦gVæ7F–öâöÇ”×W6–57vVW†öäF—6²’°¢6öç7BW&Ç2Ò†öäF—6²ÇÂµÒ’æÖ‡‚Óâ‚bb‚çW&Â¢6öç7B&W2Ò÷'VæTÖ—76–ætÆö6ÅG&6·2…ö×W6–5G&6·2‚’ÂW&Ç2¢–b‚&W2ç&VÖ÷fVBæÆVæwF‚’&WGW&âµÐ¢v–æF÷råö6WGF–æw2ç&V4×W6–5G&6·2Ò&W2çG&6·0¢6fT6WGF–æw2‚¢6öç7BâÒ&W2ç&VÖ÷fVBæÆVæwF€¢ö7'V–ÆEFö7B†âÓÓÒ¢ò&VÖ÷fVB"G·&W2ç&VÖ÷fVE³ÒææÖWÒ"g&öÒF†R×W6–2Æ—7B(	BF†Rf–ÆR—2æòÆöævW"öâF†RFWf–6Ræ ¢¢&VÖ÷fVBG¶çÒG&6·2g&öÒF†R×W6–2Æ—7B(	BF†V—"f–ÆW2&RæòÆöævW"öâF†RFWf–6Ræ¢–b‚B‚r6×W6–5æVÄF–Æörr’æ—2‚s§f—6–&ÆRr’’÷&VæFW$×W6–5æVÂ‚¢òòF†R6VÆV7F–öâ—2&V6ö×WFVBg&öÒF†RÆ—7BÂ6ò7vWBG&6²6–×Ç¢òò†æG2÷fW"FòF†RæW‡BöæRà¢÷&W6WD&6¶w&÷VæD×W6–2‚¢&WGW&â&W2ç&VÖ÷fV@§Ð ¦gVæ7F–öâöf×D×W6–4'—FW2†â’°¢6öç7B"ÒçVÖ&W"†â’ÇÂ ¢–b†"ãÒ#B¢#B¢#B’&WGW&âG²†"òƒ#B¢#B¢#B’’çFôf—†VBƒ—Òt& ¢–b†"ãÒ#B¢#B’&WGW&âG²†"òƒ#B¢#B’’çFôf—†VBƒ—ÒÔ& ¢–b†"ãÒ#B’&WGW&âG´ÖF‚ç&÷VæB†"ò#B—Ò´& ¢&WGW&âG¶'Ò& §Ð ¢òò'&–ærF†RæVÂw2FWf–6R6öçG&öÇ2–âÆ–æRv—F‚v†BF†RFWf–6R6âFòÀ¢òòæB7vVWâ6ÆÆVBv†VâF†RæVÂ÷Vç2æBgFW"WfW'’–6²à¦7–æ2gVæ7F–öâ÷&Vg&W6„Æö6Ä×W6–2‚’°¢6öç7B&ö&RÒv—B÷&ö&TÆö6Ä×W6–2‚¢6öç7BFBÒB‚r6×W6–5æVÄF–Æörr¢–b‚FBæÆVæwF‚’&WGW&à¢òòF†R–6²'WGFöâ7F—2f–Æ&ÆRöâvW'&÷"s¢F†R—2F†W&RÂæB¢òòÆ—7F–ærF†Bf–ÆVBöæ6R6—2æ÷F†–ær&÷WBv†WF†W"–6²v÷VÆBà¢FBæf–æB‚r6×–6µ&÷rr’çFövvÆR‡&ö&Rç7FFRÓÓÒw&VG’rÇÂ&ö&Rç7FFRÓÓÒvW'&÷"r¢FBæf–æB‚r6×FWf–6T†–çBr’çFövvÆR‡&ö&Rç7FFRÓÓÒwVç7W÷'FVBr¢–b‡&ö&Rç7FFRÓÓÒvW'&÷"r’°¢FBæf–æB‚r6×F—6µW6Rr’çFW‡B‚$6÷VÆFâwB&VBF†RÆö6Â×W6–2f–ÆW2§W7Bæ÷râ"¢&WGW&à¢Ð¢–b‡&ö&Rç7FFRÓÒw&VG’r’²FBæf–æB‚r6×F—6µW6Rr’çFW‡B‚rr“²&WGW&âÐ¢6öç7BF÷FÂÒ&ö&RæöäF—6²ç&VGV6R‚‡2Â‚’Óâ2²„çVÖ&W"‡‚bb‚ç6—¦R’ÇÂ’Â¢FBæf–æB‚r6×F—6µW6Rr’çFW‡B‡F÷FÂòÆö6ÂG&6·2W6RGµöf×D×W6–4'—FW2‡F÷FÂ—Òöb7F÷&vRæ¢rr¢öÇ”×W6–57vVW‡&ö&RæöäF—6²§Ð ¢òò)H)H)H×W6–2æVÂ)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òòF†RÆ–'&'’æB—G26öçG&öÇ2Â&V6†&ÆRg&öÒ6WGF–æw2æBg&öÒF†RÆ–Æ—7@¢òòF–Æörâ&÷F‚VçG'’ö–çG2÷VâF†—26ÖRF–Æör&F†W"F†âGWÆ–6F–ærF†P¢òò6öçG&öÇ2–âGvòÆ6W2à ¢òò6²–÷UGV&Rv†Bf–FVò—26ÆÆVBÂ6òF†RW6W"FöW6âwB†fRFòæÖRWfW'¢òòG&6²'’†æBâF†RöVÖ&VBVæGö–çBæVVG2æò¶W’æB6VæG24õ%2†VFW'2à¢òòç’f–ÇW&R(	BöffÆ–æRÂ&Æö6¶VBÂ&FRÖÆ–Ö—FVB(	BfÆÇ2&6²FòF†R6ÆÆW"w0¢òò÷vâFVfVÇB&F†W"F†â&Æö6¶–ærF†RFBà¦7–æ2gVæ7F–öâöfWF6…–÷UGV&UF—FÆR‡W&Â’°¢G'’°¢6öç7B’Ò‡GG3¢ò÷wwrç–÷WGV&Ræ6öÒööVÖ&VC÷W&ÃÒG¶Væ6öFUU$”6ö×öæVçB‡W&Â—Òff÷&ÖCÖ§6öæ ¢6öç7B&W2Òv—B÷v—F…F–ÖV÷WB†fWF6‚†’’ÂcÂvöVÖ&VBr¢–b‚&W2ÇÂ&W2æö²’&WGW&ârp¢6öç7B¢Òv—B&W2æ§6öâ‚¢&WGW&â7G&–ær‚†¢bb¢çF—FÆR’ÇÂrr’çG&–Ò‚¢Ò6F6‚…ò’²&WGW&ârrÐ§Ð ¢òòG&6²F†RW6W"æWfW"æÖVB6†÷w22—G2&&Rf–FVò–Bâöæ6RF†RÆ–W ¢òò†27GVÆÇ’ÆöFVB—BvR6âFò&WGFW"Âf÷"g&VRà¦gVæ7F–öâöÖ–&TæÖUG&6´g&öÕÆ–W"‚’°¢G'’°¢6öç7BVærÒö×W6–4Væv–æP¢–b‚VærÇÂVæræ¶–æBÓÒw–÷WGV&RrÇÂVærçÆ–W"’&WGW&à¢–b‡G—VöbVærçÆ–W"ævWEf–FVôFFÓÒvgVæ7F–öâr’&WGW&à¢6öç7B–BÒVæræÆöFVD–@¢–b‚–B’&WGW&à¢6öç7BÆ—7BÒö×W6–5G&6·2‚¢6öç7BBÒÆ—7Bæf–æB‡‚Óâ‚æ–BÓÓÒ–B¢–b‚BÇÂBææÖRÓÒ–B’&WGW&âòòÇ&VG’†2&VÂæÖP¢6öç7BFFÒVærçÆ–W"ævWEf–FVôFF‚’ÇÂ·Ð¢òò7FFR6†ævRg&öÒF†RõUDtô”ärf–FVò6â'&—fRgFW"vRwfRÇ&VG¢òò7VVBF†RæW‡BöæRÂæBVæræÆöFVD–BÖ÷fVB7–æ6‡&öæ÷W6Ç’(	B6òG'W7BF†P¢òòÆ–W"w2÷vâ–B÷fW"÷W'2&Vf÷&Rw&—F–æræÖRà¢–b…7G&–ær†FFçf–FVõö–BÇÂrr’ÓÒ–B’&WGW&à¢6öç7BF—FÆRÒ7G&–ær†FFçF—FÆRÇÂrr’çG&–Ò‚¢–b‚F—FÆR’&WGW&à¢v–æF÷råö6WGF–æw2ç&V4×W6–5G&6·2ÒÆ—7BæÖ‡‚Óà¢‚æ–BÓÓÒ–Bò²ââç‚ÂæÖS¢F—FÆRÒ¢‚¢6fT6WGF–æw2‚¢–b‚B‚r6×W6–5æVÄF–Æörr’æ—2‚s§f—6–&ÆRr’’÷&VæFW$×W6–5æVÂ‚¢Ò6F6‚…ò’·Ð§Ð ¦gVæ7F–öâö×W6–5föÅ&÷r†¶W’ÂÆ&VÂÂfÇVR’°¢&WGW&âÆF—b6Æ73Ò&××&÷r××föÂ"FF×föÃÒ"G¶¶W—Ò#à¢ÆÆ&VÂ6Æ73Ò&×ÖÆ&Â"f÷#Ò&×föÅòG¶¶W—Ò#âG¶Æ&VÇÓÂöÆ&VÃà¢Æ–çWBG—SÒ'&ævR"–CÒ&×föÅòG¶¶W—Ò"6Æ73Ò&××6Æ–FW""Ö–ãÒ#"ÖƒÒ#"7FWÒ#R"fÇVSÒ"G·fÇVWÒ#à¢Ç7â6Æ73Ò&××föÂ×fÂ#âG·fÇVWÒSÂ÷7ãà¢ÂöF—cæ §Ð ¢òò&VG&rF†R'G2F†B6†ævS¢F†RG&6²Æ—7BÂæBv†–6‚föÇVÖR6Æ–FW'0¢òòÇ’FòF†R6†÷6VâÖöFRà¦gVæ7F–öâ÷&VæFW$×W6–5æVÂ‚’°¢6öç7BFBÒB‚r6×W6–5æVÄF–Æörr¢–b‚FBæÆVæwF‚’&WGW&à¢6öç7BG&6·2Òö×W6–5G&6·2‚¢6öç7B2Òö×W6–56WGF–æw2…ö×W6–5æVÄ¶–æB¢6öç7B6VÂÒö×W6–56VÆV7FVD–Döb‡2¢6öç7BÖöFRÒö×W6–4ÖöFTöb‡2¢FBæf–æB‚r6×66÷Rr’çfÂ…ö×W6–5æVÄ¶–æB¢FBæf–æB‚r6×Væ&ÆVBr’ç&÷‚v6†V6¶VBrÂ2ç&V4×W6–4Væ&ÆVB ¢òòV6‚&÷r6'&–W2—G2¶–æB(	B)š¢f÷"f–ÆRöâF†RFWf–6RÂ)kbf÷"–÷UGV&R(	@¢òò6òF†RGvò&RFöÆB'BBvÆæ6R–âÆ–âÇ6VÆV7Câà¢6öç7B÷G2ÒG&6·2æÆVæwF€¢òG&6·2æÖ‡BÓâ°¢6öç7B–6öâÒö×W6–5G&6´¶–æB‡B’ÓÓÒvÆö6Ârò~)š¢r¢~)kbp¢&WGW&âÆ÷F–öâfÇVSÒ"GµòæW66R‡Bæ–B—Ò"G·Bæ–BÓÓÒ6VÂòr6VÆV7FVBr¢rwÓâG¶–6öçÒGµòæW66R‡BææÖR—ÓÂö÷F–öãæ ¢Ò’æ¦ö–â‚rr¢¢sÆ÷F–öâfÇVSÒ"#â†æòG&6·2–WB“Âö÷F–öãâp¢FBæf–æB‚r6×G&6²r’æ‡FÖÂ†÷G2’ç&÷‚vF—6&ÆVBrÂG&6·2æÆVæwF‚¢FBæf–æB‚r6×FVÆWFRr’ç&÷‚vF—6&ÆVBrÂG&6·2æÆVæwF‚ ¢òòF†R7W'&VçBÆ–Æ—7B6â¶VWG&6²öb—G2÷vâÂæB6&B–ç6–FR—B6à¢òò¶VWöæRöb—G2÷vâv–ââ†–FFVâv†W&RF†W&R—2æ÷F†–ærFò6†ö÷6Rg&öÒÂæ@¢òòöâF†RÆ–Æ—7G2F†B6ææ÷B†öÆBF†R6WGF–æs¢f—'GVÂöæR÷vç2æò—FV×2À¢òòæBöæRW6†VB'’F†R—2&V'V–ÇBv†öÆW6ÆRöâ—G2æW‡BW6‚à¢6öç7BÆ—7DæÖRÒ‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’ÇÂrp¢6öç7BÆ—7E&V2Ò÷&V6÷&DöeÆ–Æ—7B†Æ—7DæÖR¢6öç7BÆ—7D6ä†öÆBÒ†Æ—7E&V2bbÆ—7E&V2çf—'GVÂbbÆ—7E&V2æW‡FW&æÂ¢6öç7B6†÷tÆ—7E&÷rÒG&6·2æÆVæwF‚bbÆ—7D6ä†öÆ@¢FBæf–æB‚r6×Æ—7E&÷rr’çFövvÆR‡6†÷tÆ—7E&÷r¢FBæf–æB‚r6×Æ—7D†–çBr’çFövvÆR‡6†÷tÆ—7E&÷r¢–b‡6†÷tÆ—7E&÷r’°¢FBæf–æB‚r6×Æ—7EG&6²r’æ‡FÖÂ…ö×W6–46†ö–6T÷F–öç2†Æ—7E&V2æ×W6–5G&6´–BÂr‡W6RF†RG&6²&÷fR’r’¢FBæf–æB‚r6×Æ—7D†–çBr’çFW‡B†Æ—2VæFW"WfW'—F†–ær–â"Gµö÷væW$Æ&VÆÆW"‚’ç&Vf—‚†Æ—7DæÖRÂÆ—7E&V2—Ò"ÂVæÆW726&BæÖW2—G2÷vâæ¢Ð ¢6öç7B‡W6†VBÒv–æF÷råö6WGF–æw2ç&V4×W6–5W6V@¢FBæf–æB‚r6×‡W6‚r¢çFW‡B†‡W6†VBò~)kb&W7VÖRÆÂ×W6–2r¢~(û‚W6RÆÂ×W6–2r¢çFövvÆT6Æ72‚v×Ö‡W6‚ÖöârÂ‡W6†VB¢æGG"‚v&–×&W76VBrÂ‡W6†VBòwG'VRr¢vfÇ6Rr¢ç&÷‚vF—6&ÆVBrÂG&6·2æÆVæwF‚¢FBæf–æB‚r6×‡W6„†–çBr’çFW‡B†‡W6†V@¢òu6–ÆVæ6VBVçF–Â–÷R&W7VÖR—BâF†RÆ–Æ—7B—2VæffV7FVBâp¢¢u7F÷2F†R×W6–2v—F†÷WB7F÷–ærF†RÆ–Æ—7Bâr ¢òòö–çBBF†RöffVæF–ær&÷râÆ–æ²–÷UGV&R&VgW6W2—27F–ÆÂfÆ–@¢òò–÷UGV&RÆ–æ²Â6òæ÷F†–ærVÇ6R&÷WBF†RæVÂv÷VÆBÆöö²w&öærà¢6öç7B&BÒö×W6–4W'&÷"bbö×W6–4W'&÷$–Bbbö×W6–4W'&÷$–BÓÓÒ6VÀ¢FBæf–æB‚r6×G&6µv&âr¢çFövvÆR‚&B¢çFW‡B†&Bò6âwBÆ’F†—2öæR(	BGµö×W6–4W'&÷%FW‡B…ö×W6–4W'&÷"—Òæ¢rr ¢FBæf–æB‚v–çWE¶æÖSÒ&×ÖöFR%Òr’æV6‚†gVæ7F–öâ‚’°¢B‡F†—2’ç&÷‚v6†V6¶VBrÂB‡F†—2’çfÂ‚’ÓÓÒÖöFR¢Ò ¢òò&V'V–ÇBöæÇ’v†VâF†R4UBöb6Æ–FW'26†ævW2â&R×&VæFW"6â&RG&–vvW&V@¢òò'’F—FÆR'&—f–ær÷"Æ–&6²W'&÷"v†–ÆRF†RW6W"—2Ö–BÖG&rÂæ@¢òò&WÆ6–ærF†R–çWBVæFW"F†V—"f–ævW"v÷VÆBG&÷F†RvW7GW&Rà¢6öç7Bf–VÆG2Òö×W6–5föÇVÖTf–VÆG4f÷"†ÖöFR¢6öç7BGföÂÒFBæf–æB‚r6×föÇVÖW2r¢6öç7B6–rÒö×W6–5æVÄ¶–æB²s¢r²f–VÆG2æ¦ö–â‚rÂr¢–b‚GföÂæGG"‚vFFÖf–VÆG2r’ÓÒ6–r’°¢6öç7B&÷w2ÒµÐ¢–b†f–VÆG2æ–æFW„öb‚wv—F„VF–òr’ãÒ’°¢&÷w2çW6‚…ö×W6–5föÅ&÷r‚wv—F„VF–òrÂuföÇVÖRv—F‚VF–òrÀ¢ö×W6–5föÇVÖTf÷%†6R‡2Âv6Æ—r’’¢Ð¢–b†f–VÆG2æ–æFW„öb‚v–äv2r’ãÒ’°¢&÷w2çW6‚…ö×W6–5föÅ&÷r‚v–äv2rÂuföÇVÖR–âv2rÀ¢ö×W6–5föÇVÖTf÷%†6R‡2Âvvr’’¢Ð¢GföÂæGG"‚vFFÖf–VÆG2rÂ6–r’æ‡FÖÂ‡&÷w2æ¦ö–â‚rr’¢Ð§Ð ¦gVæ7F–öâö÷Vä×W6–5æVÂ‚’°¢ö×W6–5æVÄ¶–æBÒv–æF÷rå÷Æ––æu&V6÷&F–æròö×W6–4¶–æB‚’¢vÖçVÂp¢ÆWBFBÒB‚r6×W6–5æVÄF–Æörr¢–b‚FBæÆVæwF‚’FBÒB‚sÆF—b–CÒ&×W6–5æVÄF–Æör#ãÂöF—câr’æVæEFò‚v&öG’r¢FBæ‡FÖÂ† ¢ÆF—b6Æ73Ò&××&÷r#à¢ÆÆ&VÂ6Æ73Ò&×ÖÆ&Â"f÷#Ò&×66÷R#ä×W6–2f÷#ÂöÆ&VÃà¢Ç6VÆV7B–CÒ&×66÷R"6Æ73Ò&×Öw&÷r#ãÆ÷F–öâfÇVSÒ&ÖçVÂ#äÖçVÂ6&G3Âö÷F–öããÆ÷F–öâfÇVSÒ'f–FVò#å–÷UGV&R6Æ—3Âö÷F–öããÂ÷6VÆV7Cà¢ÂöF—cà¢ÆÆ&VÂ6Æ73Ò&××&÷r#ãÆ–çWBG—SÒ&6†V6¶&÷‚"–CÒ&×Væ&ÆVB#âVæ&ÆR×W6–2f÷"F†W6R—FV×3ÂöÆ&VÃà¢ÆF—b6Æ73Ò&××&÷r#à¢ÆÆ&VÂ6Æ73Ò&×ÖÆ&Â"f÷#Ò&×G&6²#åG&6³ÂöÆ&VÃà¢Ç6VÆV7B–CÒ&×G&6²"6Æ73Ò&×Öw&÷r#ãÂ÷6VÆV7Cà¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ&×FVÆWFR"6Æ73Ò&'Fâ"F—FÆSÒ%&VÖ÷fRF†—2G&6²g&öÒF†RÆ—7B#ï	ùyÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò&××v&â"–CÒ&×G&6µv&â"7G–ÆSÒ&F—7Æ“¦æöæS²#ãÂöF—cà¢ÆF—b6Æ73Ò&××&÷r"–CÒ&×Æ—7E&÷r"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢ÆÆ&VÂ6Æ73Ò&×ÖÆ&Â"f÷#Ò&×Æ—7EG&6²#åF†—2Æ–Æ—7CÂöÆ&VÃà¢Ç6VÆV7B–CÒ&×Æ—7EG&6²"6Æ73Ò&×Öw&÷r#ãÂ÷6VÆV7Cà¢ÂöF—cà¢ÆF—b6Æ73Ò&×Ö†–çB"–CÒ&×Æ—7D†–çB"7G–ÆSÒ&F—7Æ“¦æöæS²#ãÂöF—cà¢ÆF—b6Æ73Ò&××&÷r#à¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ&×‡W6‚"6Æ73Ò&'Fâ×Ö‡W6‚#ãÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò&×Ö†–çB"–CÒ&×‡W6„†–çB#ãÂöF—cà¢ÆF—b6Æ73Ò&××&÷r×ÖFB#à¢Æ–çWBG—SÒ'FW‡B"–CÒ&×W&Â"6Æ73Ò&×Öw&÷r"Æ6V†öÆFW#Ò%–÷UGV&RU$Â#à¢Æ–çWBG—SÒ'FW‡B"–CÒ&×æÖR"Æ6V†öÆFW#Ò$æÖR†÷F–öæÂ’#à¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ&×FB"6Æ73Ò&'Fâ#îûÈ²FCÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò&×Ö†–çB#äÆVfRF†RæÖR&Ææ²æB—Bv–ÆÂ&RÆöö¶VBWãÂöF—cà¢ÆF—b6Æ73Ò&××&÷r×ÖFB"–CÒ&×–6µ&÷r"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢Æ'WGFöâG—SÒ&'WGFöâ"–CÒ&×–6²"6Æ73Ò&'Fâ×Öw&÷r#ï	øëRFBg&öÒFWf–6SÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò&×Ö†–çB"–CÒ&×FWf–6T†–çB"7G–ÆSÒ&F—7Æ“¦æöæS²#äÆö6Â×W6–2æVVG2F†R7W—F÷"öâæG&ö–B‚÷"æWvW"ãÂöF—cà¢ÆF—b6Æ73Ò&×Ö†–çB"–CÒ&×F—6µW6R#ãÂöF—cà¢ÆF—b6Æ73Ò&××&÷r×ÖÖöFW2#à¢Ç7â6Æ73Ò&×ÖÆ&Â#åÆ“Â÷7ãà¢ÆÆ&VÂ6Æ73Ò&××&F–ò#ãÆ–çWBG—SÒ'&F–ò"æÖSÒ&×ÖöFR"fÇVSÒ&—FVÒ#âv—F‚VF–óÂöÆ&VÃà¢ÆÆ&VÂ6Æ73Ò&××&F–ò#ãÆ–çWBG—SÒ'&F–ò"æÖSÒ&×ÖöFR"fÇVSÒ&v#â–âF†Rv3ÂöÆ&VÃà¢ÆÆ&VÂ6Æ73Ò&××&F–ò#ãÆ–çWBG—SÒ'&F–ò"æÖSÒ&×ÖöFR"fÇVSÒ&æöç7F÷#âæöâ×7F÷ÂöÆ&VÃà¢ÂöF—cà¢ÆF—b–CÒ&×föÇVÖW2#ãÂöF—cà¢¢÷&VæFW$×W6–5æVÂ‚¢òò6†÷w2F†RFWf–6R'WGFöâöæÇ’v†W&RF†R6â6W'fRf–ÆW2ÂæB7vVW0¢òòv’G&6·2v†÷6Rf–ÆW2&RvöæRâ7–æ2Â6òF†RæVÂ—2W6&ÆRBöæ6Rà¢÷&Vg&W6„Æö6Ä×W6–2‚ ¢FBæöfb‚ræ×r¢FBæöâ‚v6†ævRæ×rÂr6×66÷RrÂgVæ7F–öâ‚’°¢ö×W6–5æVÄ¶–æBÒB‡F†—2’çfÂ‚’ÓÓÒwf–FVòròwf–FVòr¢vÖçVÂp¢÷&VæFW$×W6–5æVÂ‚¢Ò¢FBæöâ‚v6†ævRæ×rÂr6×Væ&ÆVBrÂgVæ7F–öâ‚’°¢÷w&—FT×W6–5&öf–ÆR‡²Væ&ÆVC¢B‡F†—2’ç&÷‚v6†V6¶VBr’Ò¢6fT6WGF–æw2‚¢÷7–æ4&6¶w&÷VæD×W6–2‚¢Ò¢FBæöâ‚v6†ævRæ×rÂr6×G&6²rÂgVæ7F–öâ‚’°¢÷w&—FT×W6–5&öf–ÆR‡²6VÆV7FVC¢7G&–ær‚B‡F†—2’çfÂ‚’ÇÂrr’Ò¢6fT6WGF–æw2‚¢÷&W6WD&6¶w&÷VæD×W6–2‚¢òò&VG&s¢F†R&6âwBÆ’F†—2öæR"Æ–æR&VÆöæw2FòF†RG&6²F†Bf–ÆVBÀ¢òò6ò7v—F6†–ærv’g&öÒ—B†2FòF¶RF†Rv&æ–ærv—F‚—Bà¢÷&VæFW$×W6–5æVÂ‚¢Ò¢FBæöâ‚v6†ævRæ×rÂr6×Æ—7EG&6²rÂgVæ7F–öâ‚’°¢6öç7B&V2Ò÷&V6÷&DöeÆ–Æ—7B‚¢–b‚&V2ÇÂ&V2çf—'GVÂÇÂ&V2æW‡FW&æÂ’&WGW&à¢–b…÷&VgW6U&VDöæÇ•Æ–Æ—7B‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’’&WGW&à¢6öç7BbÒ7G&–ær‚B‡F†—2’çfÂ‚’ÇÂrr¢–b‡b’&V2æ×W6–5G&6´–BÒ`¢VÇ6RFVÆWFR&V2æ×W6–5G&6´–@¢÷6fU&V6÷&F–ær‚¢òòF¶W2VffV7BVæFW"F†R6&BÇ&VG’Æ––ærÂæ÷BBF†RæW‡BöæRà¢÷7–æ4&6¶w&÷VæD×W6–2‚¢Ò¢òò6–ÆVæ6RF†R&VBv—F†÷WBF÷V6†–ærF†RÖöFRÂF†RG&6²÷"F†RÆ–Æ—7B(	@¢òòF†RÆ–Æ—7BÆ—2öâÂF†—2öæÇ’7F÷2F†R×W6–2VæFW&æVF‚—Bà¢FBæöâ‚v6Æ–6²æ×rÂr6×‡W6‚rÂgVæ7F–öâ‚’°¢v–æF÷råö6WGF–æw2ç&V4×W6–5W6VBÒv–æF÷råö6WGF–æw2ç&V4×W6–5W6V@¢6fT6WGF–æw2‚¢÷7–æ4&6¶w&÷VæD×W6–2‚¢÷&VæFW$×W6–5æVÂ‚¢Ò¢FBæöâ‚v6Æ–6²æ×rÂr6×FVÆWFRrÂgVæ7F–öâ‚’°¢6öç7BBÒö×W6–56VÆV7FVEG&6´öb…ö×W6–56WGF–æw2…ö×W6–5æVÄ¶–æB’¢–b‚B’&WGW&à¢–b‚6öæf—&Ò†&VÖ÷fR"G·BææÖWÒ"g&öÒF†R×W6–2Æ—7Cö’’&WGW&à¢v–æF÷råö6WGF–æw2ç&V4×W6–5G&6·2Ò÷&VÖ÷fT×W6–5G&6²…ö×W6–5G&6·2‚’ÂBæ–B¢òòF†R6VÆV7F–öâ—2&V6ö×WFVBg&öÒF†RÆ—7BÂ6òFVÆWFVBG&6²6–×Ç¢òò†æG2÷fW"FòF†RæW‡BöæR&F†W"F†âÆVf–ærFævÆ–ær–Bà¢v–æF÷råö6WGF–æw2ç&V4×W6–56VÆV7FVBÒrp¢6fT6WGF–æw2‚¢÷&VæFW$×W6–5æVÂ‚¢÷&W6WD&6¶w&÷VæD×W6–2‚¢òòF†R6÷’—2&—fFRFòF†R²ÆVf–ær—Bv÷VÆB&R–çf—6–&ÆRF—6²à¢–b…ö×W6–5G&6´¶–æB‡B’ÓÓÒvÆö6Ârbbö†fTVF–ô'&–FvR‚’’°¢öVF–õ'2‚v×W6–4FVÆWFRrÂ²W&Ã¢BçW&ÂÒ¢çF†Vâ‚‚’Óâ÷&Vg&W6„Æö6Ä×W6–2‚’¢æ6F6‚‚‚’Óâ·Ò¢Ð¢Ò¢òò–6²f–ÆW2g&öÒF†RFWf–6RâF†R6÷–W2V6‚–çFò—G2÷vâ7F÷&vRæ@¢òòç7vW'2v—F‚F†Rf–ÆS¢òòU$Ç3²F†RÆ–'&'’öæÇ’WfW"6VW2F†÷6Rà¢FBæöâ‚v6Æ–6²æ×rÂr6×–6²rÂ7–æ2gVæ7F–öâ‚’°¢6öç7BF'FâÒB‡F†—2¢F'Fâç&÷‚vF—6&ÆVBrÂG'VR¢ÆWB–6¶VBÒµÐ¢ÆWBf–ÆVBÒ ¢G'’°¢6öç7B&WÇ’Ò¥4ôâç'6R†v—BöVF–õ'2‚v×W6–5–6²rÂ·Ò’ÇÂw·Òr’ÇÂ·Ð¢–6¶VBÒ'&’æ—4'&’‡&WÇ’ç–6¶VB’ò&WÇ’ç–6¶VB¢µÐ¢f–ÆVBÒçVÖ&W"‡&WÇ’æf–ÆVB’ÇÂ ¢Ò6F6‚…ò’²–6¶VBÒµÓ²f–ÆVBÒÐ¢F'Fâç&÷‚vF—6&ÆVBrÂfÇ6R¢òò6÷’F†Bf–ÆVB×W7Bæ÷BÆöö²Æ–¶R6æ6VÂà¢–b†f–ÆVB’°¢ö7'V–ÆEFö7B†f–ÆVBÓÓÒò$öæRf–ÆR6÷VÆFâwB&R6÷–VB–çFòF†Râ ¢¢G¶f–ÆVGÒf–ÆW26÷VÆFâwB&R6÷–VB–çFòF†Ræ¢Ð¢–b‚–6¶VBæÆVæwF‚’&WGW&à¢ÆWBÆ—7BÒö×W6–5G&6·2‚¢ÆWBÆ7D–BÒrp¢ÆWBFFVBÒ ¢6öç7B÷'†ç2ÒµÐ¢f÷"†6öç7Böb–6¶VB’°¢–b‚ÇÂçW&Â’6öçF–çVP¢6öç7B&W2ÒöFDÆö6Ä×W6–5G&6²†Æ—7BÂçW&ÂÂææÖR¢Æ—7BÒ&W2çG&6·0¢–b‡&W2ç&V6öâÓÓÒvgVÆÂr’°¢òòF†Rf–ÆR—2Ç&VG’6÷–VB'WB†2æò&÷s²FVÆWFR—B&F†W"F†à¢òòÆVfR7F÷&vRF†RæVÂ6÷VçG2æBF†RW6W"6ææ÷B6VRà¢÷'†ç2çW6‚‡çW&Â¢6öçF–çVP¢Ð¢–b‡&W2æ–B’Æ7D–BÒ&W2æ–@¢–b‡&W2æFFVB’FFVB²°¢Ð¢v–æF÷råö6WGF–æw2ç&V4×W6–5G&6·2ÒÆ—7@¢òòF†RÆ7Bf–ÆR–6¶VB&V6öÖW2F†R6VÆV7F–öâà¢–b†Æ7D–B’÷w&—FT×W6–5&öf–ÆR‡²6VÆV7FVC¢Æ7D–BÒ¢6fT6WGF–æw2‚¢÷&VæFW$×W6–5æVÂ‚¢÷&W6WD&6¶w&÷VæD×W6–2‚¢f÷"†6öç7BRöb÷'†ç2’öVF–õ'2‚v×W6–4FVÆWFRrÂ²W&Ã¢RÒ’æ6F6‚‚‚’Óâ·Ò¢÷&Vg&W6„Æö6Ä×W6–2‚¢–b†÷'†ç2æÆVæwF‚’ÆW'B‚uF†R×W6–2Æ—7B—2gVÆÂ(	B&VÖ÷fRG&6²f—'7Bâr¢VÇ6R–b‚FFVB’ö7'V–ÆEFö7B‡–6¶VBæÆVæwF‚ÓÓÒòtÇ&VG’–âF†RÆ—7B(	B6VÆV7FVB—Bâr¢tÇ&VG’–âF†RÆ—7Bâr¢Ò¢FBæöâ‚v6Æ–6²æ×rÂr6×FBrÂ7–æ2gVæ7F–öâ‚’°¢6öç7BW&ÂÒ7G&–ær‚FBæf–æB‚r6×W&Âr’çfÂ‚’ÇÂrr’çG&–Ò‚¢–b‚W&Â’&WGW&à¢ÆWBæÖRÒ7G&–ær‚FBæf–æB‚r6×æÖRr’çfÂ‚’ÇÂrr’çG&–Ò‚¢–b‚ö×W6–5f–FVô–Dg&öÕW&Â‡W&Â’’°¢ÆW'B‚FBæf–æB‚r6×–6µ&÷rr’æ—2‚s§f—6–&ÆRr¢ò%F†BFöW6âwBÆöö²Æ–¶R–÷UGV&RÆ–æ²â7FR–÷UGV&RU$Â†W&RÂ÷"W6R(	ÄFBg&öÒFWf–6^(	Òf÷"f–ÆRöâF†—2†öæRâ ¢¢%F†BFöW6âwBÆöö²Æ–¶R–÷UGV&RÆ–æ²â&6¶w&÷VæB×W6–2Æ—2F‡&÷Vv‚–÷UGV&RÂ6ò—BæVVG2öæRâ"¢&WGW&à¢Ð¢6öç7BF'FâÒB‡F†—2¢òòöæÇ’Æöö²F—FÆRWf÷"G&6²vRFöâwBÇ&VG’†fRâ&Ææ²æÖRöà¢òòG&6²F†Bw2Ç&VG’6fVBÖVç2&æò÷–æ–öâ"ÂæB76–ærfWF6†V@¢òòF—FÆRF‡&÷Vv‚v÷VÆBV–WFÇ’÷fW'w&—FRF†RæÖRF†RW6W"6†÷6Rf÷"—B(	@¢òòv†–ÆRF†RæVÂw2÷vâ†–çBFVÆÇ2F†VÒFòÆVfRF†R&÷‚V×G’à¢6öç7B¶æ÷vâÒö×W6–5G&6·2‚’ç6öÖR‡BÓâBæ–BÓÓÒö×W6–5f–FVô–Dg&öÕW&Â‡W&Â’¢–b‚æÖRbb¶æ÷vâ’°¢òòæWfW"ÆWB6Æ÷ræWGv÷&²†öÆBF†RFB†÷7FvR(	BöfWF6…–÷UGV&UF—FÆP¢òò&W6öÇfW2Fòrröâç’f–ÇW&RæBF†R–B—2W6VB–ç7FVBà¢F'Fâç&÷‚vF—6&ÆVBrÂG'VR’çFW‡B‚~(
br¢æÖRÒv—BöfWF6…–÷UGV&UF—FÆR‡W&Â¢F'Fâç&÷‚vF—6&ÆVBrÂfÇ6R’çFW‡B‚~ûÈ²FBr¢Ð¢6öç7B&W2ÒöFD×W6–5G&6²…ö×W6–5G&6·2‚’ÂW&ÂÂæÖR¢–b‡&W2ç&V6öâÓÓÒvgVÆÂr’²ÆW'B‚uF†R×W6–2Æ—7B—2gVÆÂ(	B&VÖ÷fRG&6²f—'7Bâr“²&WGW&âÐ¢v–æF÷råö6WGF–æw2ç&V4×W6–5G&6·2Ò&W2çG&6·0¢–b‡&W2æ–B’÷w&—FT×W6–5&öf–ÆR‡²6VÆV7FVC¢&W2æ–BÒ¢6fT6WGF–æw2‚¢FBæf–æB‚r6×W&Âr’çfÂ‚rr¢FBæf–æB‚r6×æÖRr’çfÂ‚rr¢÷&VæFW$×W6–5æVÂ‚¢÷&W6WD&6¶w&÷VæD×W6–2‚¢–b‚&W2æFFVBbb&W2ç&V6öâÓÓÒvGWÆ–6FRr’°¢ö7'V–ÆEFö7B†æÖRòtÇ&VG’–âF†RÆ—7B(	B&VæÖVBæB6VÆV7FVB—Bâp¢¢tÇ&VG’–âF†RÆ—7B(	B6VÆV7FVB—Bâr¢Ð¢Ò¢FBæöâ‚v6†ævRæ×rÂv–çWE¶æÖSÒ&×ÖöFR%ÒrÂgVæ7F–öâ‚’°¢6öç7BbÒ7G&–ær‚B‡F†—2’çfÂ‚’ÇÂvvr¢–b…$T5ôÕU4”5ôÔôDU2æ–æFW„öb‡b’Â’&WGW&à¢÷w&—FT×W6–5&öf–ÆR‡²ÖöFS¢bÒ¢6fT6WGF–æw2‚¢òòv†–6‚6Æ–FW'2Ç’FWVæG2öâF†RÖöFRÂ6òF†RæVÂ&VG&w2à¢÷&VæFW$×W6–5æVÂ‚¢÷7–æ4&6¶w&÷VæD×W6–2‚¢Ò¢òòv–çWBrÆöæS¢&ævRf—&W2—BF‡&÷Vv†÷WBF†RG&räBöâ&VÆV6RÂ6ð¢òòÇ6òÆ—7FVæ–ærf÷"v6†ævRr§W7BF÷V&ÆW2WfW'’6fR(	BæBV6‚6fP¢òò6W&–Æ—6W2F†Rv†öÆR6WGF–æw2ö&¦V7B–çFòÆö6Å7F÷&vRà¢FBæöâ‚v–çWBæ×rÂræ××6Æ–FW"rÂgVæ7F–öâ‚’°¢6öç7Bv†–6‚Ò7G&–ær‚B‡F†—2’æ6Æ÷6W7B‚ræ××föÂr’æGG"‚vFF×föÂr’ÇÂrr¢6öç7BâÒÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂ'6T–çB‚B‡F†—2’çfÂ‚’Â’ÇÂ’¢–b‡v†–6‚ÓÓÒwv—F„VF–òr’÷w&—FT×W6–5&öf–ÆR‡²föÇVÖS¢âÒ¢VÇ6R–b‡v†–6‚ÓÓÒv–äv2r’÷w&—FT×W6–5&öf–ÆR‡²vföÇVÖS¢âÒ¢VÇ6R&WGW&à¢B‡F†—2’ç6–&Æ–æw2‚ræ××föÂ×fÂr’çFW‡B†G¶çÒV¢6fT6WGF–æw2‚¢òò†V&B–ÖÖVF–FVÇ’Â'WBöæÇ’–bF†—26Æ–FW"v÷fW&ç2F†R5U%$TåB†6R(	@¢òòöÇ”×W6–5föÇVÖR&VG2F†R†6RÂ6òG&vv–ærF†Rv6Æ–FW"GW&–ær¢òò&V6÷&F–ær6÷'&V7FÇ’6†ævW2æ÷F†–ær–WBà¢öÇ”×W6–5föÇVÖR‚¢Ò ¢FBæF–Æör‡°¢F—FÆS¢~)š²&6¶w&÷VæB×W6–2rÀ¢ÖöFÃ¢G'VRÀ¢v–GFƒ¢ÖF‚æÖ–âƒCcÂB‡v–æF÷r’çv–GF‚‚’Ò#’À¢òòF†RÆ’÷fW&Æ’6—G2B"ÓBæBF†RÖöFÂ&6¶G&÷†2æð¢òò¢Ö–æFW‚öb—G2÷vâÂ6òv—F†÷WBF†—2&öG’6Æ72F†RF–Òv÷VÆBfÆÂ&V†–æ@¢òòF†R&ææW"v†–ÆRF†RF–ÆörfÆöFVB&÷fR—Bà¢÷Vã¢gVæ7F–öâ‚’²B‚v&öG’r’æFD6Æ72‚v×W6–2×æVÂÖ÷Vâr’ÒÀ¢6Æ÷6S¢gVæ7F–öâ‚’²B‚v&öG’r’ç&VÖ÷fT6Æ72‚v×W6–2×æVÂÖ÷Vâr’ÒÀ¢Ò§Ð§v–æF÷ræ÷Vä×W6–5æVÂÒö÷Vä×W6–5æVÀ ¢òò6†÷VÆBF†R×W6–2&R6÷VæF–ær&–v‡Bæ÷sòöæRÆ6RFV6–FW2ÂæBWfW'’†6P¢òò6†ævRæBW6R&÷WFW2F‡&÷Vv‚†W&Rà¦gVæ7F–öâ÷7–æ4&6¶w&÷VæD×W6–2‚’°¢6öç7BG&6²Òö×W6–5G&6´æ÷r‚¢òòf–ÇW&R&VÆöæw2FòF†RG&6²F†Bf–ÆVBâ—B—2&VÖVÖ&W&VB6ò'&ö¶Và¢òòÆ–æ²—2æ÷B&WG&–VBWfW'’fWr6V6öæG2(	B'WBF†R6&B&V–ærÆ–VB6âæÖP¢òòF–ffW&VçBG&6²ÂæBF†RVæv–æR—2öæÇ’&V'V–ÇBöâF†RF‚F†—2FV6—6–öà¢òòvFW2Â6ò&VÖVÖ&W&VBf–ÇW&Rv÷VÆB6–ÆVæ6RWfW'’6&BgFW"—BæBÆVfP¢òòæ÷F†–ærFò6ÆV"—Bà¢–b…ö×W6–4W'&÷"bb‚G&6²ÇÂG&6²æ–BÓÒö×W6–4W'&÷$–B’’°¢ö×W6–4W'&÷"Ò ¢ö×W6–4W'&÷$–BÒrp¢Ð¢6öç7BvçBÒö×W6–56†÷VÆEÆ’‡°¢¶–æC¢ö×W6–4¶–æB‚’À¢ÖöFS¢ö×W6–4ÖöFR‚’À¢†6S¢v–æF÷rå÷&V5Æ•†6RÇÂv–FÆRrÀ¢òòv†WF†W"ç—F†–ær—2vö–ærFò6÷VæBVæFW"D„•26&B(	B6&B÷"¢òòÆ–Æ—7B6â6²f÷"6–ÆVæ6Rv†W&RF†RæVÂ†2G&6²6†÷6Vâà¢†5G&6³¢G&6²À¢‡W6†VC¢ö×W6–4‡W6†VB‚’À¢W'&÷&VC¢ö×W6–4W'&÷"À¢Æ––æs¢v–æF÷rå÷Æ––æu&V6÷&F–ærÀ¢W6VC¢v–æF÷rå÷&V5Æ•W6VBÀ¢Ò¢6öç7BÒvçBòöVç7W&T×W6–4Væv–æR‚’¢ö×W6–4Væv–æP¢òòF–çG2F†R)š²'WGFöâv†–ÆRF†R&VB—27GVÆÇ’6÷VæF–ærâ¶W–VBöâF†RÆ–W ¢òò&VÆÇ’&V–ærF†W&RæB&VG’Âæ÷B§W7BöâvçF–ær—B(	BvÆ÷v–ær'WGFöà¢òò÷fW"6–ÆVæ6Rv÷VÆB&Rv÷'6RF†âæò–æF–6F÷"à¢B‚v&öG’r’çFövvÆT6Æ72‚v×W6–2ÖöârÂ‡vçBbbbbç&VG’’¢–b‚’&WGW&à¢òò7F'F–æræVVG2v÷&¶–ærÆ–W#²5Dõ”är×W7BÇv—2vòF‡&÷Vv‚ÂWfVâöà¢òòöæRvR6öç6–FW"'&ö¶Vâ(	BâW'&÷&VBÆ–W"6â7F–ÆÂ&RÖ¶–æræö—6RÂæ@¢òò&VgW6–ærFòW6R—Bv÷VÆBÆVfRF†RW6W"æ÷F†–ærF†B6‡WG2—BWà¢G'’°¢–b‚vçB’²çW6R‚“²&WGW&âÐ¢–b‚ç&VG’’&WGW&à¢öÇ”×W6–5föÇVÖR‚¢çÆ’‚¢Ò6F6‚…ò’·Ð§Ð ¦gVæ7F–öâ÷6WE&V5Æ•†6R‡†6R’°¢–b‡v–æF÷rå÷&V5Æ•†6RÓÓÒ†6R’&WGW&à¢v–æF÷rå÷&V5Æ•†6RÒ†6P¢÷7–æ4&6¶w&÷VæD×W6–2‚§Ð ¢òòVæBöb6W76–öââ÷6—F–öâ—2FVÆ–&W&FVÇ’¶WB(	B7F÷–æræB&W7F'F–ær¢òòÆ–Æ—7B6†÷VÆFâwBG&r–÷R&6²F‡&÷Vv‚F†R6ÖR–çG&òWfW'’F–ÖRà¦gVæ7F–öâ÷7F÷&6¶w&÷VæD×W6–2‚’°¢v–æF÷rå÷&V5Æ•†6RÒv–FÆRp¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚v×W6–2Ööâr¢òòFVÆ–&W&FVÇ’æ÷BvFVBöâ&VG–(	B6VR÷7–æ4&6¶w&÷VæD×W6–2â7F÷†2Fð¢òòv÷&²öâÆ–W"vRF†–æ²—2'&ö¶VâÂ&V6W6RF†B—2&V6—6VÇ’F†RöæP¢òòF†BÖ–v‡B7F–ÆÂ&R6÷VæF–ærà¢–b‚ö×W6–4Væv–æR’&WGW&à¢G'’²ö×W6–4Væv–æRçW6R‚’Ò6F6‚…ò’·Ð§Ð ¢òòF†RG&6²6†ævVB–âF†RæVÂâ7v–ærF†RG&6²Ö–B×6W76–öâ&VG2Ö¶–æp¢òòF†RW6W"7F÷æB7F'BF†RÆ–Æ—7BFò†V"—Bà¦gVæ7F–öâ÷&W6WD&6¶w&÷VæD×W6–2‚’°¢òòæòV&Ç’&WGW&âöâÖ—76–ærVæv–æS¢FF–ærG&6²f÷"F†Rd•%5BF–ÖP¢òòÖ–B×6W76–öâ—2W†7FÇ’v†VâF†W&R—6âwBöæR–WBÂæB÷7–æ4&6¶w&÷VæD×W6–0¢òò'V–ÆG2—Bv†VâF†R7W'&VçB†6R6ÆÇ2f÷"×W6–2à¢–b‚ö×W6–5f–FVô–B‚’’°¢–b…ö×W6–4Væv–æR’²G'’²ö×W6–4Væv–æRçW6R‚’Ò6F6‚…ò’·ÒÐ¢&WGW&à¢Ð¢öVç7W&T×W6–4Væv–æR‚¢÷7–æ4&6¶w&÷VæD×W6–2‚§Ð ¢òòW6–ærF†RVÆVÖVçB÷W'6VÇfW2(	B÷"7v–ær—G27&6v†–ÆR—BÆ—2(	BÖ¶W0¢òò—Bf—&RwW6RrÂv†–6‚F†RÆ—7FVæW"&VÆ÷rv÷VÆB÷F†W'v—6R&VB2F†RW6W ¢òòW6–ærF†Rv†öÆR6W76–öââÖVF–WfVçG2&RVWVVB&F†W"F†âF—7F6†V@¢òò7–æ6‡&öæ÷W6Ç’Â6òfÆr6ÆV&VBöâF†RæW‡BÆ–æRv÷VÆBÇ&VG’&RF÷vâà¢òð¢òò&ÖVBöæÇ’v†VâF†RVÆVÖVçB—27GVÆÇ’Æ––ær†W6VBVÆVÖVçBf—&W0¢òòæ÷F†–ærÂæB&Ö–ærF†Vâv÷VÆB7vÆÆ÷rF†RW6W"w2äU…B&VÂW6R’Â6öç7VÖV@¢òò'’F†Rf—'7BwW6RrF†B'&—fW2ÂæBW‡—&–æröâ—G2÷vâ–bæöæRFöW2âÆÀ¢òòF‡&VRÖGFW#¢&Ææ¶WBF–ÖRv–æF÷r7vÆÆ÷w2vVçV–æR†æB×W6RF†BÆæG0¢òò–ç6–FR—BÂv†–6‚vVFvW2F†R6Æ—(	BF†RöÆÂöæÇ’&V7G2Fò4„ätU2–âF†P¢òò6W76–öâw2W6R7FFRÂ6òW6R—BæWfW"ÆV&æVB&÷WB—2æWfW"VæFöæRà¦ÆWB÷&V5–væ÷&UW6UVçF–ÂÒ ¦6öç7B$T5õô”täõ$UôÕ2ÒS ¦gVæ7F–öâ÷&V5W‡V7EW6R†’°¢–b†bbçW6VB’÷&V5–væ÷&UW6UVçF–ÂÒFFRææ÷r‚’²$T5õô”täõ$UôÕ0§Ð ¦6öç7B÷&V4VF–ôÆ–VE&FW2ÒæWrvV´Ö‚¦gVæ7F–öâ÷&VfW'&VE&V6÷&F–ætVF–õ&FR‚’°¢6öç7B&FRÒçVÖ&W"‡v–æF÷råö6WGF–æw2çÆ–&6µ7VVBóòv–æF÷råö6WGF–æw2ç&V4VF–õÆ–&6µ&FR¢&WGW&âçVÖ&W"æ—4f–æ—FR‡&FR’bb&FRâò&FR¢§Ð¦gVæ7F–öâ÷&V6÷&F–æuf–FVõ&FR‚’°¢ÆWBf–Æ&ÆRÒµÐ¢G'’²f–Æ&ÆRÒv–æF÷rç—EÆ–W#òævWDf–Æ&ÆUÆ–&6µ&FW2‚’ÇÂµÒÒ6F6‚…ò’·Ð¢&WGW&â7W÷'FVE&7F–6U7VVB…÷&VfW'&VE&V6÷&F–ætVF–õ&FR‚’Âf–Æ&ÆR§Ð¦gVæ7F–öâö6&E7VV6„÷F–öç2‚’°¢&WGW&â²&WÆ6VÖVçG3¢v–æF÷råö6WGF–æw2çGG5&WÆ6VÖVçG2À¢æWvÆ–æUW6T×3¢v–æF÷råö6WGF–æw2çGG4æWvÆ–æUW6T×2óòsÐ§Ð¦gVæ7F–öâöÇ•&V6÷&F–ætVF–õ&FR†VF–òÂ&FRÒ÷&VfW'&VE&V6÷&F–ætVF–õ&FR‚’’°¢G'’²VF–òæFVfVÇEÆ–&6µ&FRÒ&FS²VF–òçÆ–&6µ&FRÒ&FRÐ¢6F6‚…ò’²VF–òæFVfVÇEÆ–&6µ&FRÒ²VF–òçÆ–&6µ&FRÒÐ¢÷&V4VF–ôÆ–VE&FW2ç6WB†VF–òÂVF–òçÆ–&6µ&FR§Ð¦gVæ7F–öâ÷&VÖVÖ&W%&V6÷&F–ætVF–õ&FR†VF–ò’°¢öÇ•&V6÷&F–ætVF–õ&FR†VF–ò¢VF–òæFDWfVçDÆ—7FVæW"‚w&FV6†ævRrÂ‚’Óâ°¢6öç7B&FRÒVF–òçÆ–&6µ&FP¢–b‡&FRÓÓÒ÷&V4VF–ôÆ–VE&FW2ævWB†VF–ò’ÇÂçVÖ&W"æ—4f–æ—FR‡&FR’ÇÂ&FRÃÒ’&WGW&à¢v–æF÷råö6WGF–æw2ç&V4VF–õÆ–&6µ&FRÒ&FP¢v–æF÷råö6WGF–æw2çÆ–&6µ7VVBÒ&FP¢B‚r7Æ–&6µ7VVBr’çfÂ‡&FR¢òòÖçVÂ7VVB6†ö–6RF¶W2&V6VFVæ6R÷fW"FV×÷&'’&WÆ’6Æ÷vF÷vâà¢÷&W7F÷&U&V6÷&F–æu&WÆ•7VVB‚¢öÇ•&V6÷&F–ætVF–õ&FR†VF–òÂ&FR¢6fT6WGF–æw2‚¢Ò§Ð ¦gVæ7F–öâ÷&V5Æ”VF–ôVÂ‚’°¢ÆWBGw&ÒB‚r7&V5Æ––ætVF–òr¢–b‚Gw&æÆVæwF‚’°¢Gw&ÒB†ÆF—b–CÒ'&V5Æ––ætVF–ò#à¢ÆF—b6Æ73Ò'&V2×Öf6R#ãÂöF—cà¢ÆVF–ò6Æ73Ò'&V2×ÖVÂ"6öçG&öÇ2&VÆöCÒ&WFò#ãÂöVF–óà¢ÆF—b6Æ73Ò'&V2×Öf6W2#ãÂöF—cà¢ÂöF—cæ’æVæEFò‚v&öG’r¢6öç7BVÂÒGw&æf–æB‚rç&V2×ÖVÂr•³Ð¢÷&VÖVÖ&W%&V6÷&F–ætVF–õ&FR†VÂ¢6öç7BföÇVÖRÒçVÖ&W"‡v–æF÷råö6WGF–æw2ç&V4VF–õföÇVÖR¢VÂçföÇVÖRÒçVÖ&W"æ—4f–æ—FR‡föÇVÖR’òÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂföÇVÖR’’¢¢VÂæ×WFVBÒv–æF÷råö6WGF–æw2ç&V4VF–ô×WFV@¢VÂæFDWfVçDÆ—7FVæW"‚wföÇVÖV6†ævRrÂ‚’Óâ°¢v–æF÷råö6WGF–æw2ç&V4VF–õföÇVÖRÒVÂçföÇVÖP¢v–æF÷råö6WGF–æw2ç&V4VF–ô×WFVBÒVÂæ×WFV@¢6fT6WGF–æw2‚¢Ò¢òò†æBÖG&—fVâÆ’÷W6RöâF†R6öçG&öÇ2†2Fò&V6öÖRF†R6W76–öâw0¢òòW6R7FFRÂ÷"F†RÆ–Æ—7Bw2öÆÂv÷VÆBf–v‡BF†RW6W"æBF†P¢òò÷fW&Æ’w2W6R'WGFöâv÷VÆB6†÷rF†Rw&öærF†–ærà¢òò6öçG&öÅ—C¦fÇ6R(	BF†RVÆVÖVçB†2Ç&VG’FöæRF†RF†–æs²vRöæÇ’æVV@¢òòF†R6W76–öâ7FFRæBF†R÷fW&Æ’'WGFöâFòw&VRv—F‚—Bà¢VÂæFDWfVçDÆ—7FVæW"‚wÆ’rÂ‚’Óâ°¢òòv†FWfW"7F'FVB—B(	BF†RÆ–Æ—7BÂf6R'WGFöâÂ÷"F†RVÆVÖVçBw0¢òò÷vâÆ’(	B&V6÷&F–ær—2æ÷r6÷VæF–ærÂæBF†R×W6–2&VB†2Fò†V ¢òò&÷WB—Bâv—F†÷WBF†—2&WÆ’7F'FVB'’†æBGW&–ærvvWG2F†P¢òòvw2Æ÷VFW"×W6–27G&–v‡B÷fW"F†RF÷öbF†R&öçVæ6–F–öâà¢÷6WE&V5Æ•†6R‚v6Æ—r¢÷7F÷&7F–6TVF–ò‚¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ•W6VB’öÇ•&V5Æ•W6R†fÇ6RÂfÇ6R¢Ò¢VÂæFDWfVçDÆ—7FVæW"‚wW6RrÂ‚’Óâ°¢òòwW6RrÇ6òf—&W2v†Vâ6Æ—VæG2ÂæBv†VæWfW"vRW6R÷"&R×7&0¢òòF†RVÆVÖVçB÷W'6VÇfW2(	BæöæRöbF†÷6R—2F†RW6W"W6–ærà¢–b„FFRææ÷r‚’Â÷&V5–væ÷&UW6UVçF–Â’²÷&V5–væ÷&UW6UVçF–ÂÒ²&WGW&âÐ¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ•W6VBbbVÂæVæFVB’öÇ•&V5Æ•W6R‡G'VRÂfÇ6R¢Ò¢òò†æB×7F'FVB&WÆ’VæG2–ç6–FRvF†B—27F–ÆÂ'Vææ–ærÂ6ò†æ@¢òòF†R†6R&6²&F†W"F†âÆVf–ær—Böâv6Æ—rf÷"F†R&W7Böb—Bà¢VÂæFDWfVçDÆ—7FVæW"‚vVæFVBrÂ‚’Óâ°¢–b‡v–æF÷rå÷&V5Æ”v7F—fR’÷6WE&V5Æ•†6R‚vvr¢Ò¢Ð¢&WGW&âGw&æf–æB‚rç&V2×ÖVÂr•³Ð§Ð ¢òòö–çBF†R6†&VBVÆVÖVçBB6Æ—v—F†÷WBF†R7&276–væÖVçB&V–ærÖ—7F¶Và¢òòf÷"W6W"W6Rà¦gVæ7F–öâ÷6WDÖçVÄVF–õ7&2†ÂFFW&Â’°¢÷&V5W‡V7EW6R†¢öÇ•&V6÷&F–ætVF–õ&FR†Âv–æF÷rå÷&V5&WÆ•7VVBòãsR¢÷&VfW'&VE&V6÷&F–ætVF–õ&FR‚’¢ç7&2ÒFFW&À§Ð ¢òò6†÷rö†–FRF†RVF–òÆ–W"ÂæBv—F‚—BF†R–÷UGV&R6Æ÷B—B&WÆ6W2à¢òð¢òòv†–ÆRF†RÆ–W"—2WÂ÷&V5Æ”ÖçVÄVF–öö–çG2BF†RVÆVÖVçBf÷"F†P¢òòt„ôÄR—FVÒÂæ÷B§W7Bv†–ÆR6Æ——26÷VæF–ærâW6RÂ6VV²æBF†R†VG6W@¢òòÆÂ&÷WFRF‡&÷Vv‚F†Bö–çFW"ÂæBF†R&V6ÆÂv&WGvVVâ6÷W&6RæBF&vW@¢òò(	BÇW2F†R†öÆBöâF†R6&Bw2FW‡BgFW'v&G2(	B—2W†7FÇ’v†VâF†RW6W ¢òò&V6†W2f÷"F†VÒâÆVf–ær—BçVÆÂF†W&R6VçBF†÷6R6öÖÖæG2FòF†R–÷UGV&P¢òòÆ–W"–ç7FVBÂv†–6‚öâ6&B6''––ær&VfW&Væ6RÆ–æ²ÖVçB&W7VÖP¢òò7F'FVBf–FVòæö&öG’6¶VBf÷"à¦gVæ7F–öâ÷6†÷tÖçVÄVF–õÆ–W"‡6†÷rÂf6TÆ&VÂ’°¢B‚v&öG’r’çFövvÆT6Æ72‚w&V2×Æ––ærÖÖçVÂrÂ6†÷r¢B‚v&öG’r’çFövvÆT6Æ72‚w&V2×Æ––ærÖÖçVÂ×f–FVòrÂ6†÷rbbö6&D†5f–FVôÆ–æ²‡v–æF÷rå÷&V5Æ”7W'&VçD—FVÒ’¢–b‚6†÷r’°¢òò†–F–ærâÆVF–óâFöW2æ÷B6–ÆVæ6R—Bâf6R'WGFöâ&W76VBGW&–ærF†P¢òò6&Bw2FW‡B†öÆB—27F–ÆÂ6÷VæF–ærv†VâF†RæW‡B—FVÒF¶W2F†R6Æ÷BÀ¢òòæBçVÆÆ–ærF†Rö–çFW"&VÆ÷rv÷VÆBÆVfRæ÷F†–ær&ÆRFò7F÷—Bà¢6öç7B&WbÒv–æF÷rå÷&V5Æ”ÖçVÄVF–ð¢–b‡&Wb’²÷&V5W‡V7EW6R‡&Wb“²G'’²&WbçW6R‚’Ò6F6‚…ò’·ÒÐ¢B‚r7&V5Æ––ætVF–òr’æ†–FR‚¢v–æF÷rå÷&V5Æ”ÖçVÄVF–òÒçVÆÀ¢&WGW&à¢Ð¢6öç7BVÂÒ÷&V5Æ”VF–ôVÂ‚¢v–æF÷rå÷&V5Æ”ÖçVÄVF–òÒVÀ¢6öç7BGrÒB‚r7&V5Æ––ætVF–òr’ç6†÷r‚¢Græf–æB‚rç&V2×Öf6Rr’çFW‡B†f6TÆ&VÂÇÂrr¢÷&VæFW$ÖçVÄf6T'WGFöç2‚GrÂv–æF÷rå÷&V5Æ”7W'&VçD—FVÒ¢&WGW&âVÀ§Ð ¢òò'WGFöç2Fò&WÆ’öæRf6RöâFVÖæBâF†RÆ–Æ—7BÆ—26÷W&6RÂF†Và¢òòF&vWBÂF†Vâ†öÆG2öâF†R6&Bw2FW‡C²GW&–ærF†B†öÆBF†W6R&RF†RöæÇ¢òòv’Fò†V"f6Rv–âv—F†÷WB&W7F'F–ærF†Rv†öÆR6&Bà¦gVæ7F–öâ÷&VæFW$ÖçVÄf6T'WGFöç2‚Gw&Â—B’°¢6öç7BG&÷rÒGw&æf–æB‚rç&V2×Öf6W2r’æV×G’‚¢6öç7Bf6W2Òö6&D6Æ—4–ä÷&FW"†—B¢–b‚f6W2æÆVæwF‚’²G&÷ræ†–FR‚“²&WGW&âÐ¢G&÷rç6†÷r‚¢f6W2æf÷$V6‚†bÓâ°¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×Öf6RÖ'Fâ#ãÂö'WGFöãâr¢æGG"‚wF—FÆRrÂÆ’F†RG¶bæÆ&VÇÒ&V6÷&F–æv¢çFW‡B†G¶bæ–6öçÒG¶bæÆ&VÇÖ¢æöâ‚v6Æ–6²rÂWbÓâ²Wbç&WfVçDFVfVÇB‚“²÷Æ”ÖçVÄf6R†bçW&ÂÂbæÆ&VÂ’Ò¢æVæEFò‚G&÷r¢Ò§Ð ¢òòÆ’öæRf6RöâFVÖæBÂF‡&÷Vv‚F†R6ÖRVÆVÖVçBF†RÆ–Æ—7BW6W26òF†@¢òòW6RÂ6VV²æBF†R†VG6WB¶VWFG&W76–ærv†FWfW"—27GVÆÇ’6÷VæF–ærà¢òð¢òòF†RÆ–Æ—7Bw2÷vâv—B—2Æ—7FVæ–ærf÷"vVæFVBröâF†—2VÆVÖVçBÂ6ò&WÆ¢òò7F'FVB†W&RVæG2F†B6Æ—w2v—Bv†Vâ—Bf–æ—6†W2æBF†R6&BÖ÷fW2öâFð¢òò—G2vâ&W76–ærF†Rf6RF†B—2Ç&VG’6÷VæF–ærF†W&Vf÷&R§W7B&W7F'G0¢òò—BÂv†–6‚—2F†Rö–çBâ&W76–ærF†RõD„U"f6RÖ–BÖ6Æ—7FæG2–âf÷"F†P¢òòöæRF†Bv2Æ––ærÂ6òF†R6&Bw2÷vâGW&âf÷"—B7F–ÆÂ6öÖW2&÷VæBgFW ¢òòF†R&V6ÆÂvæB—B6÷VæG26V6öæBF–ÖR(	Bf—"&VF–æröb'Æ’F†—0¢òòæ÷r"ÂæBF†RÇFW&æF—fR‡&Ww&—F–ærF†R6&Bw2&VÖ–æ–ær6WVVæ6Rg&öÒ¢òò'WGFöâ&W72’v÷VÆB&RvööBFVÂÖ÷&R7W'&—6–ærà¦7–æ2gVæ7F–öâ÷Æ”ÖçVÄf6R‡W&ÂÂÆ&VÂ’°¢6öç7B—FVÕFö¶VâÒv–æF÷rå÷&V5Æ”—FVÕFö¶Và¢ÆWBFFW&ÂÒçVÆÀ¢G'’²FFW&ÂÒv—BÆöDÖçVÄVF–ôFF‡W&Â’Ò6F6‚…ò’·Ð¢òòÆöF–ærvöW2F‡&÷Vv‚F†R†÷7B'&–FvRÂ6òF†R6W76–öâ6âVæBv†–ÆRvP¢òòv—Bâv—F†÷WBF†—26†V6²÷&V5Æ”VF–ôVÂv÷VÆB&V'V–ÆBF†RæVÂF†@¢òò7F÷Æ––æu&V6÷&F–ær†B§W7B&VÖ÷fVBæBÆ’–çFòf–æ—6†VB6W76–öâÀ¢òòv†W&Ræ÷F†–ær—2ÆVgBF†B6÷VÆBW6R—Bà¢–b‚FFW&ÂÇÂv–æF÷rå÷Æ––æu&V6÷&F–ærÇÂv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÒ—FVÕFö¶VâÇÂv–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’&WGW&à¢òòöæÇ’öæR&V6÷&F–ær6÷VæG2BF–ÖRÂv†–6†WfW"ÖöFR7F'FVB—Bà¢6öç7BÒ÷&V5Æ”VF–ôVÂ‚¢÷6–ÆVæ6T÷F†W$VF–ò‚vFV6²r¢B‚r7&V5Æ––ætVF–òr’æf–æB‚rç&V2×Öf6Rr’çFW‡B†Æ&VÂ¢÷6WDÖçVÄVF–õ7&2†ÂFFW&Â¢v–æF÷rå÷&V5Æ”ÖçVÄVF–òÒ¢å÷&V5Æ”—FVÕFö¶VâÒ—FVÕFö¶Và¢òò&W76–ærf6R'WGFöâ—2F†RW6W"6¶–ærf÷"6÷VæBâ–bF†R6W76–öâv0¢òòW6VBÂÆ–gBF†RW6R&F†W"F†â7F'B6Æ—F†R6W76–öâF†–æ·2—0¢òò7F÷VB(	B6öçG&öÅ—C¦fÇ6R&V6W6RvRFòF†RÆ––ær÷W'6VÇfW2Â&–v‡B†W&Rà¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ•W6VB’öÇ•&V5Æ•W6R†fÇ6RÂfÇ6R¢G'’²v—BçÆ’‚’Ò6F6‚†R’²6öç6öÆRçv&â‚u¶ÖçVÄVF–õÒf6R&WÆ’f–ÆVBrÂR’Ð§Ð ¢òò†÷rFÆÂv†FWfW"—26—GF–ær–âF†RÖVF–6Æ÷BGW&æVB÷WBFò&Râ6ÆV&VBFð¢òòæ÷F†–ærv†VâF†Rf–FVò†2F†R6Æ÷B&6²Â6òF†R6&B&WGW&ç2FòF†Rc£¢òòöfg6WB—G2÷vâ'VÆRFW67&–&W2à¦gVæ7F–öâ÷6WE&7F–6TÖVF–†V–v‡B‡‚’°¢G'’°¢–b‡‚â’Fö7VÖVçBæ&öG’ç7G–ÆRç6WE&÷W'G’‚rÒ×&7F–6RÖÖVF–Ö‚rÂ‚²w‚r¢VÇ6RFö7VÖVçBæ&öG’ç7G–ÆRç&VÖ÷fU&÷W'G’‚rÒ×&7F–6RÖÖVF–Ö‚r¢Ò6F6‚…ò’·Ð§Ð ¢òòF†R6&Bw2&V6÷&F–æw2–âF†R÷&FW"&7F–6R—26†÷v–ær—G2f6W2(	Bv†–6‚—0¢òò&7F–6Rw2÷vâF—&V7F–öâFövvÆRÂæ÷BF†RÆ–W"w2&WfW'6R7v—F6‚âF†RGvò&P¢òò6W&FR6WGF–æw2æB6&B6â&R&7F—6VBöæRv’v†–ÆRF†RFV6²—26W@¢òòFòÆ’F†R÷F†W"à¦gVæ7F–öâ÷&7F–6T6Æ—4–ä÷&FW"†—B’°¢6öç7B6÷W&6RÒ²¶W“¢w6÷W&6RrÂÆ&VÃ¢u6÷W&6RrÂ–6öã¢~HbrÂW&Ã¢ö6&E6÷W&6TVF–ò†—B’Ð¢6öç7BF&vWBÒ²¶W“¢wF&vWBrÂÆ&VÃ¢uF&vWBrÂ–6öã¢~XrÂW&Ã¢ö6&EF&vWDVF–ò†—B’Ð¢6öç7Bf6W2Òv–æF÷rå÷&7F–6Tg&öçD—56÷W&6RÓÓÒfÇ6Rò·F&vWBÂ6÷W&6UÒ¢·6÷W&6RÂF&vWEÐ¢&WGW&âf6W2æf–ÇFW"†bÓâbçW&Â§Ð ¢òò&7F–6Rw2÷vâVF–òæVÂÂæB—G2÷vâÆVF–óâVÆVÖVçBà¢òð¢òòFVÆ–&W&FVÇ’æ÷BF†RÆ–W"w2âÆ–Æ—7B6W76–öâFöW2æ÷BVæBv†Vâ&7F–6P¢òò÷Vç2(	BÖ–æ–Ö—6–ærF†RÆ–W"öæÇ’W6W2—BÂæBF†RFV6²6—G2&¶V@¢òòv—F–ærf÷"—G27W'&VçB6Æ—Fòf–æ—6‚(	B6òF†RGvòÖöFW2&RÆ—fRBF†P¢òò6ÖRF–ÖRÂæBöæRVÆVÖVçB&WGvVVâF†VÒÖVç2V6‚—2†öÆF–ær6öÖWF†–ærF†P¢òò÷F†W"—2VçF—FÆVBFò6†ævRâ&7F–6R7VV–ær6&Bv÷VÆB6–ÆVæ6RF†RFV6²w0¢òò6Æ—–âv’F†RFV6²æWfW"†V'2&÷WBÂÆVf–ær—Bv—F–ærf÷"âvVæFVBp¢òòF†B6âæòÆöævW"6öÖS²6Æ÷6–ær&7F–6Rv÷VÆB†–FRF†RæVÂF†RFV6²—0¢òò7F–ÆÂW6–ærâF†W’Æöö²Æ–¶RæB&V†fRÆ–¶S²F†W’&Ræ÷BF†R6ÖRF†–ærà¢òð¢òòv†BF†W’×W7B6†&R—2F†R6–ÆVæ6S¢öæÇ’öæR&V6÷&F–ær6÷VæG2BF–ÖRà¢òòF†B—2'&ævVBv†W&RÆ–&6²7F'G2Âæ÷B'’ööÆ–ærF†RVÆVÖVçG2à¦gVæ7F–öâ÷&7F–6TVF–ôVÂ‚’°¢ÆWBGw&ÒB‚r7&7F–6TVF–òr¢–b‚Gw&æÆVæwF‚’°¢Gw&ÒB†ÆF—b–CÒ'&7F–6TVF–ò#à¢ÆF—b6Æ73Ò'&V2×Öf6R#ãÂöF—cà¢ÆVF–ò6Æ73Ò'&V2×ÖVÂ"6öçG&öÇ2&VÆöCÒ&WFò#ãÂöVF–óà¢ÆF—b6Æ73Ò'&V2×Öf6W2#ãÂöF—cà¢ÂöF—cæ’æVæEFò‚v&öG’r¢òò&W76–ærÆ’öâF†R6öçG&öÇ2—22×V6‚&WVW7Bf÷"6÷VæB2&W76–æp¢òòf6R'WGFöâÂ6ò—B6–ÆVæ6W2F†R÷F†W"6÷W&6W2Föòà¢6öç7BVÂÒGw&æf–æB‚rç&V2×ÖVÂr•³Ð¢VÂæFDWfVçDÆ—7FVæW"‚wÆ’rÂ‚’Óâ°¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢öÇ•&V6÷&F–ætVF–õ&FR†VÂÂçVÖ&W"‡v–æF÷rå÷&7F–6UÆ–&6µ&FR’ÇÂ÷&VfW'&VE&V6÷&F–ætVF–õ&FR‚’¢÷6–ÆVæ6T÷F†W$VF–ò‚w&7F–6Rr¢G'’²v–æF÷rç—EÆ–W#òçW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢G'’²7÷F–g•Æ–W"æÖVF–òçW6R‚’Ò6F6‚…ò’·Ð¢Ò¢Ð¢&WGW&âGw&æf–æB‚rç&V2×ÖVÂr•³Ð§Ð ¢òòv†FWfW"VÇ6R—26÷VæF–ærÂ7F÷—BâF‡&VRF†–æw26âÖ¶R&V6÷&F–ærÆ’(	@¢òòF†RFV6²Â&FvR&Wf–WræB&7F–6R(	BæBç’GvòöbF†VÒBöæ6R—2§W7@¢òòæö—6Râ7F'F–æv6—2v†–6‚öbF†VÒ—2&÷WBFò6÷VæC¢vFV6²rÂw&7F–6Rr÷ ¢òòw&Wf–Wrrâ6–ÆVæ6–ærF†RFV6²—2F–ffW&VçB7Bg&öÒ6–ÆVæ6–ærF†R÷F†W ¢òòGvòÂv†–6‚—2v‡’—BæVVG26––ærà¦gVæ7F–öâ÷6–ÆVæ6T÷F†W$VF–ò‡7F'F–ær’°¢–b‡7F'F–ærÓÒvÆö6Âr’°¢öÖ–äÖVF–ÆöE6W²°¢öÆö6Å7V´÷fW"æFWF6‚‚¢–b†Fö7VÖVçBæ&öG’æ6Æ74Æ—7Bæ6öçF–ç2‚vÆö6ÂÖÖVF–ÖÖöFRr’’öÆö6ÄÖVF–Æ–÷WB†fÇ6R¢–b†Fö7VÖVçBæ&öG’æ6Æ74Æ—7Bæ6öçF–ç2‚w–÷WGV&RÖÖVF–ÖÖöFRr’’÷–÷WGV&TÖVF–Æ–÷WB†fÇ6R¢Ð¢–b‡7F'F–ærÓÒw&Wf–Wrr’²G'’²÷7F÷ÖçVÄVF–õ&Wf–Wr‚’Ò6F6‚…ò’·ÒÐ¢–b‡7F'F–ærÓÒw&7F–6Rr’÷7F÷&7F–6TVF–ò‚¢–b‡7F'F–ærÓÒvFV6²r’°¢òòW6–ærF†RFV6²w2ÆVF–óâ&V†–æB—G2&6²—2æ÷BVæ÷Vv‚(	B—B—2v÷'6P¢òòF†âæ÷F†–ærâF†RFV6²v—G2÷WBV6‚6Æ—'’Æ—7FVæ–ærf÷"vVæFVBrÂæ@¢òò6Æ—F†Bv2W6VBæWfW"VæG2Â6ò—Bv÷VÆB6—BöâF†B6&Bf÷"vöö@¢òòv—F‚F†R6W76–öâ7F–ÆÂæöÖ–æÆÇ’'Vææ–ærâW6RF†R4U54”ôâ–ç7FVC¢—G0¢òò÷vâÖ6†–æW'’7F÷2F†RVÆVÖVçBÂF†RG&ç7÷'BæBF†RÖVF–6W76–öà¢òòw&VR&÷WB—BÂæB&W7VÖR–6·2Wv†W&R—BÆVgBöfbà¢òð¢òòF†—2—2Ç6òv†B6–ÆVæ6W2f–FVò6&BÂv†÷6R6÷VæB—2F†R–÷UGV&P¢òòÆ–W"&F†W"F†âç’VÆVÖVçBöb÷W'2à¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ•W6VB’²öÇ•&V5Æ•W6R‡G'VRÂG'VR“²&WGW&âÐ¢6öç7BÆ–W"Òv–æF÷rå÷&V5Æ”ÖçVÄVF–ð¢–b‡Æ–W"’²÷&V5W‡V7EW6R‡Æ–W"“²G'’²Æ–W"çW6R‚’Ò6F6‚…ò’·ÒÐ¢Ð§Ð ¦gVæ7F–öâ÷7F÷&7F–6TVF–ò‚’°¢6öç7BVÂÒB‚r7&7F–6TVF–òç&V2×ÖVÂr•³Ð¢–b†VÂ’²G'’²VÂçW6R‚’Ò6F6‚…ò’·ÒÐ§Ð ¢òòÆ’öæRöbF†R6&Bw2f6W2F‡&÷Vv‚&7F–6Rw2VÆVÖVçBà¦7–æ2gVæ7F–öâ÷Æ•&7F–6Tf6R†f6R’°¢–b‚f6RÇÂf6RçW&Â’&WGW&à¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢6öç7BFö¶VâÒv–æF÷rå÷&7F–6T6Æ—Fö¶Và¢ÆWBFFW&ÂÒçVÆÀ¢G'’²FFW&ÂÒv—BÆöDÖçVÄVF–ôFF†f6RçW&Â’Ò6F6‚…ò’·Ð¢–b‚FFW&ÂÇÂv–æF÷rå÷&7F–6T7F—fRÇÂFö¶VâÓÒv–æF÷rå÷&7F–6T6Æ—Fö¶Vâ’&WGW&à¢6öç7BVÂÒ÷&7F–6TVF–ôVÂ‚¢B‚r7&7F–6TVF–òr’æf–æB‚rç&V2×Öf6Rr’çFW‡B†f6RæÆ&VÂ¢VÂç7&2ÒFFW&À¢VÂå÷&7F–6T6&BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢G'’²v—BVÂçÆ’‚’Ò6F6‚†R’²6öç6öÆRçv&â‚u·&7F–6TVF–õÒÆ’f–ÆVBrÂR’Ð§Ð ¢òò6†÷rF†RæVÂf÷"ÖçVÂ6&BÂæBv—F‚—B†–FRF†Rf–FVò6Æ÷B—BF¶W2à¢òð¢òòF†Rg&öçBf6R—27VVB'WBæ÷BÆ–VBâ&7F–6R—2f÷"&V6ÆÆ–ærÂæB6&@¢òòF†B6÷VæG2F†RÖöÖVçB—BV'2†2ç7vW&VB—G2÷vâVW7F–öâ(	B'WBv—F€¢òòæ÷F†–ærÆöFVBF†R6öçG&öÇ26—BF†W&RFVBÂ6òF†R7VR—2v†BÖ¶W2Æ¢òòÖVâ6öÖWF†–ærà¦7–æ2gVæ7F–öâ÷6†÷u&7F–6TVF–õæVÂ†—B’°¢6öç7B6Æ—2Òö—4ÖçVÄ—FVÒ†—B’ò÷&7F–6T6Æ—4–ä÷&FW"†—B’¢µÐ¢B‚v&öG’r’çFövvÆT6Æ72‚w&7F–6RÖÖçVÂrÂ6Æ—2æÆVæwF‚â¢òòF†Rf–FVò6Æ÷B&VÆöæw2Fò6&BF†B†2f–FVò–â—BâÖçVÂ6&@¢òòv—F†÷WB–÷UGV&RÆ–æ²†2æöæR(	Bv—F‚÷"v—F†÷WB&V6÷&F–æw2öb—G2÷vâ(	@¢òòæBÆVf–ærF†R6Æ÷BW&·2F†RÆ7Bf–FVò6&Bw2Æ–W"&÷fR6&B—@¢òò†2æ÷F†–ærFòFòv—F‚ÂW6†–ærF†RFW‡BF÷vâ7BâV×G’&Æ6²&÷‚à¢B‚v&öG’r’çFövvÆT6Æ72‚w&7F–6RÖæò×f–FVòrÂö—4ÖçVÄ—FVÒ†—B’bbö6&D†5f–FVôÆ–æ²†—B’¢òòf–FVòäB&V6÷&F–æw3¢F†Rf–FVò¶VW2—G26Æ÷BæBF†R&V6÷&F–æw2æVÀ¢òòvöW2VæFW"—BÂ6òV—F†W"6â&RÆ–VBà¢B‚v&öG’r’çFövvÆT6Æ72‚w&7F–6RÖÖçVÂ×f–FVòrÂ6Æ—2æÆVæwF‚âbbö6&D†5f–FVôÆ–æ²†—B’¢÷7F÷&7F–6TVF–ò‚¢òò†–FFVâ÷&WW6VBVÆVÖVçB×W7BæWfW"&WF–âæ÷F†W"6&Bw2&öçVæ6–F–öâà¢6öç7B&Wf–÷W2ÒB‚r7&7F–6TVF–òç&V2×ÖVÂr•³Ð¢–b‡&Wf–÷W2’°¢&Wf–÷W2å÷&7F–6T6&BÒçVÆÀ¢&Wf–÷W2ç&VÖ÷fTGG&–'WFR‚w7&2r¢&Wf–÷W2æÆöB‚¢Ð¢–b‚6Æ—2æÆVæwF‚’°¢B‚r7&7F–6TVF–òr’æ†–FR‚¢÷6WE&7F–6TÖVF–†V–v‡Bƒ¢&WGW&à¢Ð¢6öç7BVÂÒ÷&7F–6TVF–ôVÂ‚¢6öç7BGrÒB‚r7&7F–6TVF–òr’ç6†÷r‚¢6öç7Bg&öçBÒ6Æ—5³Ð¢Græf–æB‚rç&V2×Öf6Rr’çFW‡B†g&öçBæÆ&VÂ¢6öç7BG&÷rÒGræf–æB‚rç&V2×Öf6W2r’æV×G’‚’çFövvÆR†6Æ—2æÆVæwF‚â¢6Æ—2æf÷$V6‚†bÓâ°¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×Öf6RÖ'Fâ#ãÂö'WGFöãâr¢æGG"‚wF—FÆRrÂÆ’F†RG¶bæÆ&VÇÒ&V6÷&F–æv¢çFW‡B†G¶bæ–6öçÒG¶bæÆ&VÇÖ¢æöâ‚v6Æ–6²rÂWbÓâ²Wbç&WfVçDFVfVÇB‚“²÷Æ•&7F–6Tf6R†b’Ò¢æVæEFò‚G&÷r¢Ò¢òòF†R6&B—2Æ–B÷WBFò6ÆV"c£’f–FVòâF†—2æVÂ—2vööBFVÀ¢òò6†÷'FW"ÂæBÆVgBBF†Rf–FVòw2†V–v‡BF†R6&Bv÷VÆB7F'BF†—&Bö`¢òòF†Rv’F÷vââV×G’67&VVââÖV7W&VB&F†W"F†âwVW76VC¢F†RæVÀ¢òòw&÷w2v—F‚F†RçVÖ&W"öbf6W2F†R6&B6'&–W2à¢÷6WE&7F–6TÖVF–†V–v‡B‚Gu³ÒòGu³Òæöfg6WD†V–v‡B¢¢òò6&G26†ævRf7FW"F†âF†R'&–FvRç7vW'2Â6òF†R6&BF†B6¶VB†2Fð¢òò7F–ÆÂ&RF†R6&Böâ67&VVâv†VâF†R'—FW2'&—fRà¢6öç7BFö¶VâÒv–æF÷rå÷&7F–6T6Æ—Fö¶Và¢ÆWBFFW&ÂÒçVÆÀ¢G'’²FFW&ÂÒv—BÆöDÖçVÄVF–ôFF†g&öçBçW&Â’Ò6F6‚…ò’·Ð¢–b‚v–æF÷rå÷&7F–6T7F—fRÇÂFö¶VâÓÒv–æF÷rå÷&7F–6T6Æ—Fö¶Vâ’&WGW&à¢òò7VRF†B6÷VÆBæ÷B&RÆöFVB×W7B6ÆV"F†RVÆVÖVçBÂæ÷BÆVfR—BâF†P¢òòæVÂ—2æ÷rÆ&VÆÆVBv—F‚D„•26&Bw2f6RÂæBF†R&Wf–÷W26&Bw0¢òò&V6÷&F–ær—27F–ÆÂ–âF†W&R(	BÆ’v÷VÆB6÷VæBF†Rw&öær6&Bà¢–b‚FFW&Â’²G'’²VÂç&VÖ÷fTGG&–'WFR‚w7&2r“²VÂæÆöB‚’Ò6F6‚…ò’·Ó²&WGW&âÐ¢VÂç7&2ÒFFW&À¢VÂå÷&7F–6T6&BÒ—@§Ð ¢òò7V²öæRf6Röbâ÷F†W'v—6R6–ÆVçBÖçVÂ6&Bâæf–vF–öâÂ7F÷æ@¢òò†VG6WBW6R6†&RF†RW†—7F–ær÷&V5EE27FFRÂ6òæòöÆB6&B¶VW0¢òò7V¶–ær÷fW"F†RæW‡BöæRà¦7–æ2gVæ7F–öâ÷Æ•6–ÆVçD6&EGG4æEv—B†—FVÒÂf6RÂ—FVÕFö¶Vâ’°¢–b‚f6SòçGG2’&WGW&à¢6öç7B7W'&VçBÒ‚’Óâv–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&7F–6T7F—fRb`¢v–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶Vâbbv–æF÷rå÷&V4æe&WVW7Bb`¢çVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚¢–b‚7W'&VçB‚’’&WGW&à¢ÆWBWGFW&æ6RÒçVÆÀ¢÷6WE&V5Æ•†6R‚v6Æ—r¢ÆWBF6°¢F6²Ò7VµGG2†f6RçFW‡BÂ°¢ââåö6&E7VV6„÷F–öç2‚’À¢7–çFƒ¢v–æF÷rç7VV6…7–çF†W6—2ÂWGFW&æ6S¢v–æF÷rå7VV6…7–çF†W6—5WGFW&æ6RÀ¢Ææs¢ö6&EGG4Æö6ÆR†—FVÒÂf6Ræ¶W’’Â&FS¢÷&VfW'&VE&V6÷&F–ætVF–õ&FR‚’Â—47W'&VçC¢7W'&VçBÀ¢öä&Vv–â‡R’°¢WGFW&æ6RÒP¢v–æF÷rå÷&V5EE2Ò²¶–æC¢w7VV6‚rÂWGFW&æ6S¢RÀ¢6æ6VÃ¢‚’ÓâF6³òæ6æ6VÂ‚’ÂW6S¢‚’ÓâF6³òçW6R‚’Â&W7VÖS¢‚’ÓâF6³òç&W7VÖR‚’Ð¢ÒÀ¢öäf–æ—6‚‚’°¢–b‡v–æF÷rå÷&V5EE3òçWGFW&æ6RÓÓÒWGFW&æ6R’v–æF÷rå÷&V5EE2ÒçVÆÀ¢ÒÀ¢Ò¢–b‡v–æF÷rå÷&V5EE3òçWGFW&æ6RÓÓÒWGFW&æ6R’v–æF÷rå÷&V5EE2æ6æ6VÂÒF6²æ6æ6VÀ¢v—BF6²ç&öÖ—6P§Ð ¦7–æ2gVæ7F–öâ÷Æ”ÖçVÄVF–ôæEv—B‡W&ÂÂf6TÆ&VÂ’°¢6öç7B—FVÕFö¶VâÒv–æF÷rå÷&V5Æ”—FVÕFö¶Và¢ÆWBFFW&ÂÒçVÆÀ¢G'’²FFW&ÂÒv—BÆöDÖçVÄVF–ôFF‡W&Â’Ò6F6‚…ò’·Ð¢–b‚FFW&ÂÇÂv–æF÷rå÷Æ––æu&V6÷&F–ærÇÂv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÒ—FVÕFö¶VâÇÂv–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’&WGW&à¢òòöæÇ’öæR&V6÷&F–ær6÷VæG2BF–ÖRÂv†–6†WfW"ÖöFR7F'FVB—B(	Bæ@¢òò7F÷Æ––æu&V6÷&F–æròæf–vF–öâ6â6–ÆVæ6RF†—2öæRà¢÷6–ÆVæ6T÷F†W$VF–ò‚vFV6²r¢6öç7BÒ÷6†÷tÖçVÄVF–õÆ–W"‡G'VRÂf6TÆ&VÂ¢å÷&V5Æ”—FVÕFö¶VâÒ—FVÕFö¶Và¢÷6WDÖçVÄVF–õ7&2†ÂFFW&Â¢òò&V6÷&F–ær—2&÷WBFò6÷VæC¢v—FVÒrÖöFRÆ—2VæFW"—BÂvvrÖöFP¢òò7FæG26–FRf÷"—Bà¢÷6WE&V5Æ•†6R‚v6Æ—r¢–b‚v–æF÷rå÷&V5Æ•W6VB’²G'’²v—BçÆ’‚’Ò6F6‚†R’²6öç6öÆRçv&â‚u¶ÖçVÄVF–õÒÆ–Æ—7BÆ’f–ÆVBrÂR’ÒÐ¢v—BæWr&öÖ—6R‡&W6öÇfRÓâ°¢ÆWBFöæRÒfÇ6P¢ÆWBÆ–VEW6VBÒv–æF÷rå÷&V5Æ•W6V@¢6öç7Bf–æ—6‚Ò‚’Óâ°¢–b†FöæR’&WGW&à¢FöæRÒG'VP¢6ÆV$–çFW'fÂ†–B¢òòF†RVÆVÖVçB—26†&VB7&÷72WfW'’6Æ—æ÷rÂ6òF†W6R†fRFò6öÖP¢òòöfb(	B÷F†W'v—6R6Æ—â6'&–W2âÓ7FÆRf–æ—6†W'2F†B&W6öÇfRF†P¢òòw&öær&öÖ—6RF†RÖöÖVçB—BVæG2à¢ç&VÖ÷fTWfVçDÆ—7FVæW"‚vVæFVBrÂf–æ—6‚¢ç&VÖ÷fTWfVçDÆ—7FVæW"‚vW'&÷"rÂf–æ—6‚¢òò&WböæW‡Bv†–ÆRF†R6Æ——27F–ÆÂ6÷VæF–ærÆæG2†W&Rv—F‚F†P¢òòVÆVÖVçBÄ””ärâv—F†÷WBF†—2F†RW6R&VÆ÷r6öÖW2&6²F‡&÷Vv‚F†P¢òòÆ—7FVæW"2'F†RW6W"W6VB"ÂæBF†R—FVÒvRæf–vFRFò7F'G0¢òòW6VB(	BF†R†VG6WBw2÷vâæW‡B¶W’v÷VÆB7F÷F†RÆ–Æ—7BFVBà¢÷&V5W‡V7EW6R†¢G'’²çW6R‚’Ò6F6‚…ò’·Ð¢&W6öÇfR‚¢Ð¢6öç7B–BÒ6WD–çFW'fÂ‚‚’Óâ°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&âf–æ—6‚‚¢–b‡v–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’&WGW&âf–æ—6‚‚¢6öç7Bæ÷uW6VBÒv–æF÷rå÷&V5Æ•W6V@¢–b†æ÷uW6VBÓÒÆ–VEW6VB’°¢Æ–VEW6VBÒæ÷uW6V@¢òòÖ—'&÷&–ærW6RF†R6W76–öâÇ&VG’FV6–FVBöâ(	BFöâwBÆWB—@¢òò&÷Væ6R&6²F‡&÷Vv‚F†RÆ—7FVæW"2g&W6‚W6W"W6Rà¢–b†æ÷uW6VB’²÷&V5W‡V7EW6R†“²G'’²çW6R‚’Ò6F6‚…ò’·ÒÐ¢VÇ6R²çÆ’‚’æ6F6‚‚‚’Óâ·Ò’Ð¢Ð¢ÒÂS¢æFDWfVçDÆ—7FVæW"‚vVæFVBrÂf–æ—6‚¢æFDWfVçDÆ—7FVæW"‚vW'&÷"rÂf–æ—6‚¢Ò¢òò÷&V5Æ”ÖçVÄVF–òFVÆ–&W&FVÇ’7F—2ö–çFVBBF†RVÆVÖVçB(	B6VP¢òò÷6†÷tÖçVÄVF–õÆ–W"â—B—26ÆV&VBv†VâF†RÆ–W"—2†–FFVâà§Ð ¦7–æ2gVæ7F–öâÆ•&V6÷&F–ær†÷G2’°¢÷G2Ò÷G2ÇÂ·Ð¢6öç7B6WGF–æw2Òv–æF÷råö6WGF–æw2ÇÂ·Ð¢6öç7B6‡VffÆRÒ†÷G2ç6‡VffÆRÒçVÆÂ’ò÷G2ç6‡VffÆR¢6WGF–æw2ç&V5Æ•6‡VffÆP¢6öç7BÆö÷Ò÷G2æÆö÷ÇÂ6WGF–æw2ç&V5Æ”Æö÷ÇÂvöfbp¢ÆWBVWVP¢ÆWB7F'D–G‚Ò ¢–b†÷G2ç&W7VÖUVWVRbb'&’æ—4'&’†÷G2ç&W7VÖUVWVRçVWVR’bb÷G2ç&W7VÖUVWVRçVWVRæÆVæwF‚’°¢òò&W7VÖRF‚(	BW6RF†R6fVBVWVRfW&&F–Òâ6¶—6‡VffÆR‡F†R6fV@¢òò÷&FW"•2F†R÷&FW"vRÆVgBöfb–â’æBF†RVWVR×6æ6†÷B6fR†—@¢òòv÷VÆB§W7B&Ww&—FRF†R6ÖRFFv—F‚VWVU÷2&W6WBFò’à¢VWVRÒ÷G2ç&W7VÖUVWVRçVWVRç6Æ–6R‚¢7F'D–G‚ÒÖF‚æÖ–â„ÖF‚æÖ‚ƒÂ÷G2ç&W7VÖUVWVRç÷2ÇÂ’ÂVWVRæÆVæwF‚Ò¢ÒVÇ6R°¢VWVRÒ'&’æ—4'&’†÷G2çVWVR’ò÷G2çVWVRç6Æ–6R‚’¢ö'V–ÆEÆ•VWVR†Æö÷¢–b‚VWVRæÆVæwF‚’²ÆW'B‚tæò—FV×2FòÆ’†ÆÂW†6ÇVFVCò’âr“²&WGW&âÐ¢–b‡6‡VffÆR’÷6‡VffÆUVWVR‡VWVR¢òò&÷FFR6òF†R&WVW7FVB7F'B—FVÒ—2B–æFW‚‡&W6W'fW2F†P¢òò6‡VffÆVB÷&FW"gFW'v&G2’âfÆÇ2&6²FòæòÖ÷–bæ÷Bf÷VæBà¢–b†÷G2ç7F'D—FVÒ’°¢6öç7B2Ò÷G2ç7F'D—FVÐ¢6öç7B“ÒVWVRæf–æD–æFW‚‡Óà¢bbå÷7BÓÓÒ2ç7Bbbå÷rÓÓÒ2çrbbåö–G‚ÓÓÒ2æ–G‚b`¢‡2ç&V4æÖRÓÒçVÆÂÇÂå÷&V4æÖRÓÓÒ2ç&V4æÖR’¢–b†“â’VWVRÒVWVRç6Æ–6R†“’æ6öæ6B‡VWVRç6Æ–6RƒÂ“’¢Ð¢òò6æ6†÷Bf÷"gWGW&R&W7VÖR(	B×W7B'VâeDU"6‡VffÆR÷&÷FFR6òF†P¢òò6fVB÷&FW"ÖF6†W2v†BvRw&R&÷WBFòÆ’à¢÷6fUVWVT÷&FW"‡VWVRÂwÆ’r¢Ð¢v–æF÷rå÷&V5Æ•&7F–6U6–ævÆRÒ÷G2ç&7F–6U6–ævÆP¢v–æF÷rå÷&V5Æ•FV×÷&'’Ò÷G2çFV×÷&'’ÇÂVWVRç6öÖR†—BÓâ—Bå÷FV×÷&'’¢÷6WE6W76–öä—FVÔv†÷G2æv6V6öæG2¢v–æF÷rå÷&V5Æ•6–ÆVçD—FVÒÒ÷G2æ¶VW7W'&VçD—FVÒòVWVU·7F'D–G…Ò¢çVÆÀ¢òò7F÷VB÷&WÆ6VB6W76–öâ×W7Bæ÷B&W7VÖRÆFRÆöB÷"6ÆVâWF†P¢òòDôÒæBVWVR&VÆöæv–ærFò—G2&WÆ6VÖVçBà¢6öç7B6W76–öåFö¶VâÒv–æF÷rå÷&V5Æ•6W76–öåFö¶VâÒ·Ð¢6öç7B6W76–öä7W'&VçBÒ‚’Óâv–æF÷rå÷&V5Æ•6W76–öåFö¶VâÓÓÒ6W76–öåFö¶Và¢6öç7B6W76–öåÆ––ærÒ‚’Óâ6W76–öä7W'&VçB‚’bbv–æF÷rå÷Æ––æu&V6÷&F–æp¢ö–çFW''WE&V6÷&F–æuÆ–&6²‚¢òòW‡÷6Rf÷"&WböæW‡BöÆö÷Öv&RT’7FGW2à¢v–æF÷rå÷&V5Æ”Æö÷ÖöFRÒÆö÷  ¢òò&VBF†RvÄ•dRöâV6‚6ÆVW6òF†R–æÆ–æRvÖ6öçG&öÂ–âF†P¢òòÆ–&6²÷fW&Æ’6â6†ævRF†Rv—B&WGvVVâ—FV×2Ö–B×Æ–&6²à¢6öç7B7W'&VçDv×2Ò‚’Óâö–çFW$—FVÔv6V6öæG2‚’¢ ¢òòW6R–ç6–FRÖçVÂ6&BÂ&WGvVVâ—G26÷W&6RæBF&vWB&V6÷&F–æw2à¢òòÇ6ò&VBÆ—fRÂæBfÆÇ2&6²FòF†R–çFW"Ö—FVÒvv†VâF†RW6W"†0¢òòæ÷B–ææVBâ÷fW'&–FRà¢6öç7B7W'&VçE7&5FwDv×2Ò‚’ÓâöVffV7F—fU7&5FwDv6V6öæG2‚’¢  ¢òòVçFW"Æ’ÖöFS¢6Æ÷6RÆ–ævW&–ærF–Æöw2Â†–FRvR6‡&öÖRÂ7W&f6RF†P¢òòfÆöF–ær7F÷'WGFöââ7F÷'WGFöâ—27&VFVBÆ¦–Ç’6ò—BFöW6âw@¢òòöÆÇWFRF†RDôÒVçF–ÂæVVFVBà¢B‚rçV’ÖF–ÆörÖ6öçFVçC§f—6–&ÆRr’æV6‚†gVæ7F–öâ‚’°¢G'’²B‡F†—2’æF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢Ò¢òò6ÆV"F†RÖ–â×vRæVÂw2÷Vâ7FFRÂ&F†W"F†âöæÇ’6÷fW&–ær—@¢òòv—F‚÷fW&Æ’553¢—B×W7Bæ÷B&VV"v†VâÆ–W"—2Ö–æ–Ö—¦VBà¢†–FTÖVF–&VÆFVD6öçF–æW"‚¢–b‚B‚r7&V5Æ––æuVWVT'Fâr’æÆVæwF‚’°¢òò6—G2–âF†RÖ–FFÆRöbF†RG&ç7÷'B&÷rv†W&RF†RöÆB7F÷'WGFöà¢òòW6VBFòÆ—fRâF†R&VÂ6Æ÷6RŽ)ÉR’—2æ÷r–âF†RF÷×&–v‡B6÷&æW"à¢B†Æ'WGFöâ–CÒ'&V5Æ––æuVWVT'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ%6†÷rÆ–&6²VWVR"&–ÖÆ&VÃÒ%6†÷rÆ–&6²VWVR#à¢Ç7fr†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ##""†V–v‡CÒ##""f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR#à¢Ç&V7BƒÒ#""“Ò#2"v–GFƒÒ#"†V–v‡CÒ#""'ƒÒ#"óà¢Ç&V7BƒÒ#""“Ò#r"v–GFƒÒ#"†V–v‡CÒ#""'ƒÒ#"óà¢Ç&V7BƒÒ#""“Ò#"v–GFƒÒ#"†V–v‡CÒ#""'ƒÒ#"óà¢Â÷7fsà¢Âö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂ÷VåÆ––æuVWVTF–Æör¢Ð¢–b‚B‚r7&V5Æ––æt6Æ÷6T'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––æt6Æ÷6T'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ%7F÷Æ–&6²"&–ÖÆ&VÃÒ%7F÷Æ–&6²#à¢Ç7fr†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ##"†V–v‡CÒ##"f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR#à¢ÇF‚CÒ$Ó2ãR2ãVÃ’”Ó"ãR2ãVÂÓ’’"7G&ö¶SÒ&7W'&VçD6öÆ÷""7G&ö¶R×v–GFƒÒ#""7G&ö¶RÖÆ–æV6Ò'&÷VæB"f–ÆÃÒ&æöæR"óà¢Â÷7fsà¢Âö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂ7F÷Æ––æu&V6÷&F–ær¢Ð¢–b‚B‚r7&V5Æ––æuW6T'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––æuW6T'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ%W6Rò&W7VÖR"&–ÖÆ&VÃÒ%W6Rò&W7VÖR#à¢Ç7fr6Æ73Ò'&V2Ö–6öâ×W6R"†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ##""†V–v‡CÒ##""f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR#à¢Ç&V7BƒÒ#B"“Ò#2"v–GFƒÒ#2"†V–v‡CÒ#"'ƒÒ#"óà¢Ç&V7BƒÒ#’"“Ò#2"v–GFƒÒ#2"†V–v‡CÒ#"'ƒÒ#"óà¢Â÷7fsà¢Ç7fr6Æ73Ò'&V2Ö–6öâ×Æ’"†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ##""†V–v‡CÒ##""f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢ÇF‚CÒ$ÓB6Ã’RÓ’W¢"óà¢Â÷7fsà¢Âö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂFövvÆUÆ––æu&V6÷&F–æuW6R¢Ð¢–b‚B‚r7&V5Æ––æu&Wd'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––æu&Wd'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ%&Wf–÷W2Ž(i’"&–ÖÆ&VÃÒ%&Wf–÷W2—FVÒ#à¢Ç7fr†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ##""†V–v‡CÒ##""f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR#à¢ÇF‚CÒ$Ó2ãR6ãRãRãRãWc–ãRãRÓbÓ–ãRãRãRÒãW¢"óà¢ÇF‚CÒ$Ó"ãR2ãWc–ãRãRÒãs’ãCtÃRãR‚ãCuc"ãVãRãRÓbÓ–ãRãRcBã“6Ãbã#ÓBãTãRãR"ãR2ãW¢"óà¢Â÷7fsà¢Âö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂ‚’Óâæf–vFU&V6÷&F–æuÆ–&6²‚w&Wbr’¢Ð¢–b‚B‚r7&V5Æ––ætæW‡D'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––ætæW‡D'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ$æW‡BŽ(i"’"&–ÖÆ&VÃÒ$æW‡B—FVÒ#à¢Ç7fr†ÖÆç3Ò&‡GG¢ò÷wwrçs2æ÷&ró#÷7fr"v–GFƒÒ##""†V–v‡CÒ##""f–Wt&÷ƒÒ#bb"f–ÆÃÒ&7W'&VçD6öÆ÷""&–Ö†–FFVãÒ'G'VR#à¢ÇF‚CÒ$Ó"ãR6ãRãRÒãRãWc–ãRãRbÓ–ãRãRÒãRÒãW¢"óà¢ÇF‚CÒ$Ó2ãR2ãWc–ãRãRãs’ãCtÃãR‚ãCuc"ãVãRãRbÓ–ãRãRÓcBã“6ÂÓbã#ÓBãTãRãR2ãR2ãW¢"óà¢Â÷7fsà¢Âö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂ‚’Óâæf–vFU&V6÷&F–æuÆ–&6²‚væW‡Br’¢Ð¢òò6‡VffÆR²Æö÷&RÆ–&6²×7FFRFövvÆW2Â6òF†W’Æ—fR–âF†RÆ–W ¢òò÷fW&Æ’†æ÷BF†R&Wf–WrF–Æör’âF†R&Wf–WrF–Æör7F—22F†P¢òòWF†÷&—FF—fR—FVÒÆ—7C²F†W6R'WGFöç2§W7B6†ævR†÷rF†R7W'&Vç@¢òòÆ–&6²6W76–öâG&fW'6W2—Bà¢–b‚B‚r7&V5Æ––æu6‡VffÆT'Fâr’æÆVæwF‚’°¢6öç7BG6‚ÒB†Æ'WGFöâ–CÒ'&V5Æ––æu6‡VffÆT'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ%6‡VffÆR‡&R×&æFöÖ—6RF†RVWVR’"&–ÖÆ&VÃÒ%6‡VffÆR"&–×&W76VCÒ&fÇ6R#ï	ùHÂö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂFövvÆU&V5Æ•6‡VffÆR¢÷&Vg&W6…&V5Æ”ÖöFT'Fç2‚¢Ð¢–b‚B‚r7&V5Æ––ætÆö÷'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––ætÆö÷'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ$Æö÷ÖöFR"&–ÖÆ&VÃÒ$Æö÷ÖöFR#î(j£Âö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂ7–6ÆU&V5Æ”Æö÷ÖöFR¢÷&Vg&W6…&V5Æ”ÖöFT'Fç2‚¢Ð¢òò6VæB×Fò×6V&6ƒ¢G&÷F†R7W'&VçB—FVÒw2v÷&B–çFò76V&6†VEv÷&G2ÂF†Và¢òòÖ–æ–Ö—6R6òF†RW6W"6â&VBF†RgVÆÂ6V&6‚&W7VÇG2&V†–æBF†P¢òò÷fW&Æ’â6ÖR6VÖçF–226Æ–6¶–ærF†R&VBÖ÷W6R×ö–çFW"'&÷r–ç6–FP¢òò7V'F—FÆRÆ–æRÂ'WBÇv—2÷W&FW2öâF†R7W'&VçFÇ’×Æ––ær—FVÒà¢–b‚B‚r7&V5Æ––æu6V&6„'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––æu6V&6„'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ%6V&6‚F†—2v÷&B†Ö–æ–Ö—¦W2’"&–ÖÆ&VÃÒ%6V&6‚F†—2v÷&B#ï	ùHãÂö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂ÷6V&6„7W'&VçE&V5Æ•v÷&B¢Ð¢òòÖ–æ–Ö—¦R'WGFöâ(	B6öÆÆ6W2F†RÆ’T’6òF†RW6W"6â–çFW&7Bv—F€¢òòF†RÖ–âvRv†–ÆRF†R6W76–öâ—2W6VBâ&W7F÷&R&R×–ç2WfW'—F†–ærà¢–b‚B‚r7&V5Æ––ætÖ–æ–Ö—¦T'Fâr’æÆVæwF‚’°¢B†Æ'WGFöâ–CÒ'&V5Æ––ætÖ–æ–Ö—¦T'Fâ"G—SÒ&'WGFöâ"F—FÆSÒ$Ö–æ–Ö—¦R"&–ÖÆ&VÃÒ$Ö–æ–Ö—¦R#î(ÈCÂö'WGFöãæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂÖ–æ–Ö—¦UÆ––æu&V6÷&F–ær¢Ð¢–b‚B‚r7&V5Æ––æu&W7F÷&U–ÆÂr’æÆVæwF‚’°¢B†ÆF—b–CÒ'&V5Æ––æu&W7F÷&U–ÆÂ"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢Ç7â6Æ73Ò'&V2×–ÆÂÖ6÷VçB#ãÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×–ÆÂ×&W7F÷&R"&–ÖÆ&VÃÒ%&W7F÷&RÆ–&6²"F—FÆSÒ%&W7F÷&R#î(È3Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2×–ÆÂÖ6Æ÷6R"&–ÖÆ&VÃÒ%7F÷Æ–&6²"F—FÆSÒ%7F÷#î)ÉSÂö'WGFöãà¢ÂöF—cæ¢æVæEFò‚v&öG’r¢æöâ‚v6Æ–6²rÂrç&V2×–ÆÂ×&W7F÷&RrÂ&W7F÷&UÆ––æu&V6÷&F–ær¢æöâ‚v6Æ–6²rÂrç&V2×–ÆÂÖ6Æ÷6RrÂ7F÷Æ––æu&V6÷&F–ær¢Ð¢ÆWBGG&ç7÷'BÒB‚r7&V5Æ––æuG&ç7÷'Br¢–b‚GG&ç7÷'BæÆVæwF‚’GG&ç7÷'BÒB‚sÆF—b–CÒ'&V5Æ––æuG&ç7÷'B"&öÆSÒ&w&÷W"&–ÖÆ&VÃÒ%Æ–&6²6öçG&öÇ2#ãÂöF—câr’æVæEFò‚v&öG’r¢òò6†&VB&÷r¶VW2WfW'’6öçG&öÂ–ç6–FRF†Rf–Ww÷'BâÖ÷f–ærF†P¢òòW†—7F–ær'WGFöç2&W6W'fW2F†V—"†æFÆW'2æB7F&ÆR”G2à¢GG&ç7÷'BæVæB…²w&V5Æ––æu6‡VffÆT'FârÂw&V5Æ––æu&Wd'FârÂw&V5Æ––æuW6T'FârÂw&V5Æ––æuVWVT'FârÀ¢w&V5Æ––æu6V&6„'FârÂw&V5Æ––ætæW‡D'FârÂw&V5Æ––ætÆö÷'FâuÒæÖ†–BÓâFö7VÖVçBævWDVÆVÖVçD'”–B†–B’’¢÷&Vg&W6…&V5Æ”ÖöFT'Fç2‚¢òòæ÷&ÖÆÇ’fÇ6R(	B7F'F–ærF†RFV6²ÖVç27F'F–ærFò†V"—Bâ&W7F÷&P¢òò76W27F'EW6VC¢F†R6öÖ–ær&6²—2æ÷BF†RW6W"6¶–ærf÷"VF–òÀ¢òòæBvV%f–Wrv–ÆÂögFVâ&VgW6RFòÆ’v—F†÷WBFç—v’Âv†–6‚v÷VÆ@¢òòÆVfRF†RFV6²Æöö¶–ær7GV6²öâ—G2f—'7B—FVÒâF†R–ÆÂw2Æ’'WGFöà¢òò7F'G2—Bà¢v–æF÷rå÷&V5Æ•W6VBÒ÷G2ç7F'EW6V@¢v–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBÒfÇ6P¢òòvÖwV&C¢6–ævÆR6†&VB–çFW'fÂ'Vææ–ærf÷"F†Rv†öÆR6W76–öà¢òòF†B&R×W6W2F†R•BÆ–W"v†VæWfW"—B6Æ—2&6²FòÄ””ärGW&–æp¢òòvv–æF÷râF†RW"Ö—FVÒÆö÷&×2öF—6&×2f–v–æF÷rå÷&V5Æ”vwV&Bà¢òò'Vr&V–ærf—†VC¢v†Vâf–FVòf–ÆVBFò7F'Bv—F†–â÷v—E•EVçF–ÄVæBw0¢òòÆöBÖw&6RÂ÷v—E•EVçF–ÄVæB&W6öÇfVB'WBF†RÆ–W"¶WBÆöF–æs²v†Và¢òò—Bf–æÆÇ’&W6öÇfVBÂWF÷Æ’¶–6¶VB–âæBVF–ò&ÆVBF‡&÷Vv‚F†P¢òòVçF—&R–çFW"Ö—FVÒvVçF–ÂF†RæW‡BÆ”ÖVF–6Æ–6R‚’&W6WB—Bà¢–b‚v–æF÷rå÷&V5Æ”vwV&D–B’°¢v–æF÷rå÷&V5Æ”vwV&BÒfÇ6P¢v–æF÷rå÷&V5Æ”vwV&D–BÒ6WD–çFW'fÂ‚‚’Óâ°¢–b‚v–æF÷rå÷&V5Æ”vwV&B’&WGW&à¢–b‡v–æF÷rå÷&V5Æ•W6VB’&WGW&à¢G'’°¢6öç7BÒv–æF÷rç—EÆ–W ¢òò•BåÆ–W%7FFRåÄ””ärÓÓÒ¢–b‡bbG—VöbævWEÆ–W%7FFRÓÓÒvgVæ7F–öârbbævWEÆ–W%7FFR‚’ÓÓÒ’°¢çW6Uf–FVòbbçW6Uf–FVò‚¢Ð¢Ò6F6‚…ò’·Ð¢ÒÂ#¢Ð¢ö6÷fW$÷VäF–Æöw4f÷%7GVG’‚¢B‚v&öG’r’æFD6Æ72‚w&V2×Æ––ærr’ç&VÖ÷fT6Æ72‚w&V2×W6VB&V2×Æ––ærÖÖ–æ–Ö—¦VBr ¢v–æF÷rå÷Æ––æu&V6÷&F–ærÒG'VP¢÷Æ–W%6W76–öåF–ÖV÷WBç7F'B‡6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢÷6WD÷Våf–Wr‚wÆ–W"r¢òò–çBF†R–ÆÂ2W6VBv†VâvR7F'FVBF†Bv’Â÷"—B6†÷w2W6P¢òò'WGFöâ÷fW"FV6²F†B—2æ÷B'Vææ–ærâ6öçG&öÅ—B7F—2fÇ6S¢F†W&R—0¢òòæ÷F†–ærÆ––ær–WBFò&RFöÆBFò7F÷à¢–b†÷G2ç7F'EW6VB’öÇ•&V5Æ•W6R‡G'VRÂfÇ6R¢òò6Æ–ÒF†R7—7FVÒÖVF–6W76–öâWg&öçBÂ6òF†R†VG6WB—2&÷WFVB†W&Rg&öÐ¢òòF†Rf—'7B—FVÒ(	B–æ6ÇVF–ærÖçVÂ6&BÂv†–6‚æWfW"F÷V6†W2—EÆ––ærà¢÷÷7DÖVF–7FFR‡G'VR¢òòæò†6R–WC²F†Rf—'7B—FVÒ6WG2öæRâ76–væVB&F†W"F†â&÷WFVBF‡&÷Vv€¢òò÷6WE&V5Æ•†6RÂv†–6‚6¶—2F†R7–æ2v†VâF†R†6R—2Væ6†ævVB(	BF†P¢òò&Wf–÷W26W76–öâÆVgBF†—2Bv–FÆRrÂæBvæöç7F÷r†2Fò7F'Bv–âà¢v–æF÷rå÷&V5Æ•†6RÒv–FÆRp¢÷7–æ4&6¶w&÷VæD×W6–2‚¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢v–æF÷rå÷&V4ædv÷Fô–æFW‚ÒçVÆÀ¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢òòFVGWÆ–6FRVæf–Æ&ÆR×f–FVò&Wf–WrVçG&–W2v—F†–âF†—26W76–öâà¢v–æF÷rå÷&V5Æ•Væf–Æ&ÆU6VVâÒæWr6WB‚¢v–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆöBÒG'VP¢v–æF÷rå÷&V5Æ”7W'&VçD—FVÒÒçVÆÀ¢÷&V5Æ”6&E&WfW'6VBÒçVÆÀ¢òòW‡÷6RF†RVWVR6òF†RÆ–W"Ö÷fW&Æ’6‡VffÆR'WGFöâ6â&R×&æFöÖ—6P¢òòF†RVçÆ–VBF–Âv—F†÷WB&W7F'F–ærÆ–&6²à¢v–æF÷rå÷&V5Æ•VWVRÒVWVP¢òò&VBÆö÷ò—4Æö÷–ærÄ•dR6òF†R–â×Æ–W"Æö÷'WGFöâF¶W2VffV7@¢òòÖ–B×Æ–&6²‡v—F†÷WBF†W6R6Æ÷7W&W2F†R6GW&VBÆö÷v÷VÆBg&VW¦P¢òòB6W76–öâ7F'B’à¢6öç7Bö7W$Æö÷Ò‚’Óâ‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&V5Æ”Æö÷’ÇÂvöfbp¢6öç7Bö7W$Æö÷–ærÒ‚’Óâ²6öç7BÂÒö7W$Æö÷‚“²&WGW&âÂÓÓÒvöæRrÇÂÂÓÓÒwÆ–Æ—7BrÇÂÂÓÓÒvÆÂrÐ¢ÆWB&Wev÷&BÒçVÆÀ¢ÆWB’Ò7F'D–G€¢òòwV&Bv–ç7BVWVRv—F‚æ÷F†–ærÆ–&ÆR–â—C¢6÷VçBF†R6&G2vR6¶— ¢òòæB&–Âöæ6RvR†fR6—&6ÆVBF†Rv†öÆRVWVRv—F‚æ÷F†–ærFòÆ’à¢ÆWBVçÆ–&ÆU6¶—2Ò ¢òòv†W&RFòÆöö²æW‡BgFW"6¶—–ær6&BÂ–âF†RF—&V7F–öâF†RW6W"Æ7@¢òòæf–vFVB(	B'&Wf–÷W2"F†2Fò¶VWvö–ær&6·v&G27BF†R6&G2—@¢òò6ææ÷BÆ’Â÷"&WbÆæG2&6²öâF†R6&B—B7F'FVBg&öÒæBÆöö·0¢òò'&ö¶Vâà¢6öç7B÷7FW÷fW%6¶—VBÒ‚’Óâ°¢6öç7B&6·v&BÒv–æF÷rå÷&V5Æ•6Æ÷vF÷và¢–b†&6·v&Bbb’ÃÒbbö7W$Æö÷–ær‚’’°¢òòæ÷F†–ær&V†–æBF†—26&BæBæ÷v†W&RFòw&Fòâ6Æ×–ærFòv÷VÆ@¢òò6¶—F†R6ÖR6&B÷fW"æB÷fW"VçF–ÂF†R6÷VçFW"&â÷WBæB7F÷V@¢òò6W76–öâv†÷6RÆFW"—FV×2vW&RÆÂÆ–&ÆR(	B6òGW&â&÷VæBæB7vVW ¢òòf÷'v&G2–ç7FVBÂæBÆWBF†R6÷VçFW"7F'BF†B7vVWg&W6ƒ¢—B—0¢òòF†W&RFò6F6‚VWVRv—F‚æ÷F†–ær–â—BÂæ÷BFòVæ—6‚6†ævRö`¢òòF—&V7F–öâà¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢VçÆ–&ÆU6¶—2Ò ¢&WGW&â¢Ð¢–b†&6·v&B’&WGW&â’âò’Ò¢VWVRæÆVæwF‚Ò¢&WGW&â’²ÂVWVRæÆVæwF‚ò’²¢…ö7W$Æö÷–ær‚’ò¢VWVRæÆVæwF‚¢Ð¢v†–ÆR‡6W76–öåÆ––ær‚’’°¢òò&WÆ’÷VWVR§V×6â'&—fRGW&–ærF†RG&–Æ–ærvÂgFW"F†P¢òòW"Ö6Æ—æf–vF–öâ6†V6²âÇ’—B&Vf÷&R7F'F–æræ÷F†W"—FVÒà¢–b„çVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’°¢6öç7BF&vWBÒv–æF÷rå÷&V4ædv÷Fô–æFW€¢v–æF÷rå÷&V4ædv÷Fô–æFW‚ÒçVÆÀ¢–b‡F&vWBãÒbbF&vWBÂVWVRæÆVæwF‚’’ÒF&vW@¢Ð¢VÇ6R–b‡v–æF÷rå÷&V4æe&WVW7B’°¢òò6öÖÖæBÖ’–çFW''WBå’v—BÂ&Vf÷&RF†R6Æ—ÖVæB†æFÆW"—0¢òò&V6†VBâ6öç7VÖR—B†W&R2vVÆÃ²÷F†W'v—6RVæF–ærfÆrÖ¶W0¢òò÷vç5f–FVò‚’fÇ6RöâWfW'’—FW&F–öâæB7–ç2F†R6ÖR—FVÒf÷&WfW"à¢6öç7BF—&V7F–öâÒv–æF÷rå÷&V4æe&WVW7@¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢6öç7Bg&öÒÒçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V5Æ”–æFW‚’òv–æF÷rå÷&V5Æ”–æFW‚¢¢’ÒF—&V7F–öâÓÓÒw&Wbp¢ò†g&öÒâòg&öÒÒ¢…ö7W$Æö÷–ær‚’òVWVRæÆVæwF‚Ò¢’¢¢†g&öÒ²ÂVWVRæÆVæwF‚òg&öÒ²¢…ö7W$Æö÷–ær‚’ò¢VWVRæÆVæwF‚’¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒF—&V7F–öâÓÓÒw&Wbp¢Ð¢òò&÷VæF'’†æFÆ–æs¢v—F‚æòÆö÷vRW†—BBVWVRVæC²÷F†W'v—6Rw&à¢–b†’ãÒVWVRæÆVæwF‚’°¢–b…ö7W$Æö÷–ær‚’’’Ò ¢VÇ6R'&V°¢Ð¢–b†’Â’°¢’Òö7W$Æö÷–ær‚’òVWVRæÆVæwF‚Ò¢ ¢Ð¢v–æF÷rå÷&V5Æ”–æFW‚Ò¢6öç7B—FVÕFö¶VâÒv–æF÷rå÷&V5Æ”—FVÕFö¶VâÒ·Ð¢÷6†÷tÖçVÄVF–õÆ–W"†fÇ6R¢6öç7B÷vç5f–FVòÒ‚’Óâ6W76–öåÆ––ær‚’bbv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶Vâb`¢v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&V5Æ•W6VBbbv–æF÷rå÷&V4æe&WVW7BbbçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚¢v–æF÷rå÷&V5Æ•VWVTÆVâÒVWVRæÆVæwF€¢6öç7B—BÒVWVU¶•Ð¢6öç7B7VU&ævRÒv–æF÷rå÷&V5Æ•&WVW7FVD7VSòæ—FVÒÓÓÒ—Bbbv–æF÷rå÷&V5Æ•&WVW7FVD7VRç6W76–öâÓÓÒ6W76–öåFö¶Và¢òv–æF÷rå÷&V5Æ•&WVW7FVD7VRç&ævR¢çVÆÀ¢v–æF÷rå÷&V5Æ•&WVW7FVD7VRÒçVÆÀ¢7÷F–g•Æ–W"ç7F÷‡²†–FS¢7÷F–g”6Æ—2†—B’æÆVæwF‚Ò¢6öç7B&W7F÷&VE&FRÒv–æF÷rå÷&V5&WÆ•7VVBbb‡v–æF÷rå÷&V5&WÆ•7VVBæ—FVÒÓÒ—BÇÂv–æF÷rå÷&V5&WÆ•7VVBæ–æFW‚ÓÒ’¢ò÷&W7F÷&U&V6÷&F–æu&WÆ•7VVB‚’¢çVÆÀ¢òòÖçVÂ6&G26''’F†R6&Bw2g&öçBFW‡B–â6÷W&6VÂæ÷BÖVF–6÷W&6RÀ¢òò6òW†6ÇVFRF†VÒ†W&R(	BF†W’w&R†æFÆVB'’F†Rö—4ÖçVÄ—FVÒ'&æ6‚&VÆ÷rà¢òò†æBF†R–÷UGV&R6Æ÷B&6²VæÆW72D„•2—FVÒ—2vö–ærFò6÷VæBF‡&÷Vv€¢òòF†RVF–òÆ–W"â¶W–VBöâF†R—FVÒ7GVÆÇ’†f–ærVF–òÂæ÷BÖW&VÇ’öà¢òò—B&V–ærÖçVÃ¢ÖçVÂ6&B6''––æröæÇ’–÷UGV&RÆ–æ²7F–ÆÂvçG0¢òòF†Rf–FVòÂæBv÷VÆB÷F†W'v—6R–æ†W&—BF†R†–FFVâ6Æ÷Bg&öÒv†–6†WfW ¢òò&V6÷&FVB6&B6ÖR&Vf÷&R—Bà¢–b‚…ö—4ÖçVÄ—FVÒ†—B’bb…ö6&D†4VF–ò†—B’ÇÂö—4VF–ôÖVF–W&Â†—BæÖVF–W&Â’’’ÇÀ¢…ö—4ÖçVÄ—FVÒ†—B’bb÷Æ–Æ—7EÆ–&6µÆâ†—B’æÆ–æ¶VB’’°¢÷6†÷tÖçVÄVF–õÆ–W"†fÇ6R¢Ð¢–b‚ö—4ÖçVÄ—FVÒ†—B’bb—Bç6÷W&6Rbb—Bç6÷W&6RçFôÆ÷vW$66R‚’ÓÒw–÷WGV&Rr’°¢6öç6öÆRçv&â‚wÆ•&V6÷&F–æs¢6¶—–æræöâÕ–÷UGV&R—FVÒrÂ—B¢–b‚²·VçÆ–&ÆU6¶—2ãÒVWVRæÆVæwF‚’²7F÷Æ––æu&V6÷&F–ær‚“²'&V²Ð¢’Ò÷7FW÷fW%6¶—VB‚¢6öçF–çVP¢Ð¢òòÖçVÂ6&G2v—F‚æ÷F†–ærFò6÷VæB&R6¶—VBGW&–ærÆ–&6²(	BF†W¢òò&VÆöærFò&7F–6RÂæ÷BF†RÆ’VWVRâÖ÷fR–âF†RF—&V7F–öâF†RW6W ¢òòÆ7Bæf–vFVB†&6·v&BgFW"&WbF’6ò6¶—–ærfVVÇ2æGW&ÂÂæ@¢òò7F÷–bF†Rv†öÆRVWVRGW&ç2÷WBFò†fRæ÷F†–ærFòÆ’à¢–b…ö—4ÖçVÄ—FVÒ†—B’bbö6&D†5Æ–&ÆTÖVF–†—B’bbv–æF÷rå÷&V5Æ•6–ÆVçD—FVÒÓÒ—B’°¢–b‚²·VçÆ–&ÆU6¶—2ãÒVWVRæÆVæwF‚’²7F÷Æ––æu&V6÷&F–ær‚“²'&V²Ð¢’Ò÷7FW÷fW%6¶—VB‚¢6öçF–çVP¢Ð ¢òò&÷F‚öbF†W6R†fRFò&R–âÆ6R$Tdõ$RF†R&ææW"G&w3¢—B&VæFW'0¢òòF†RW6R–ÆÂg&öÒF†R7W'&VçB—FVÒæBF†R–ææVBF—&V7F–öâÂæ@¢òò6WGF–ærF†VÒgFW'v&G2ÆVgBF†R–ÆÂFW67&–&–ærF†R&Wf–÷W26&Bà¢òð¢òòW‡÷6RF†RÆ—fR—FVÒö&¦V7B6òF†R•BöäW'&÷"†æFÆW"¶æ÷w2v†–6‚f–FVð¢òòf–ÆVB†æB6âÆ&VÂF†RFVÆWFR&ö×B’ÂæB–âF†RF—&V7F–öâf÷"F†—0¢òò6&B(	B6VRö6&Df6W5&WfW'6VBà¢v–æF÷rå÷&V5Æ”7W'&VçD—FVÒÒ—@¢÷&V5Æ”6&E&WfW'6VBÒ÷&V5Æ•&WfW'6VB‚¢òò6&B6âæÖR—G2÷vâ&6¶w&÷VæB×W6–2Â6òF†Rç7vW"Fò'v†B6†÷VÆ@¢òò&R6÷VæF–ær"6†ævW2v—F‚F†R6&BæBæ÷BöæÇ’v—F‚F†R†6R(	BæBGvð¢òò6&G2–â&÷r6â&÷F‚&Rv6Æ—rÂv†–6‚—2æò†6R6†ævRBÆÂà¢÷7–æ4&6¶w&÷VæD×W6–2‚ ¢÷&VæFW%Æ––æt&ææW"†—BÂ’ÂVWVRæÆVæwF‚¢–b…ö—4ÖçVÄ—FVÒ†—B’’÷&VæFW%Æ––ætÖçVÅFW‡B†—B¢òò&VÖVÖ&W"F†R—FVÒ7W'&VçFÇ’Æ––ær6òF†R&Wf–WrF–Æör6â†–v†Æ–v‡@¢òò—BgFW"F†RÆ–W"—26Æ÷6VB†æB6òföÆÆ÷r×WÆ’ÆÂò&7F–6P¢òòöâF†—2Æ–Æ—7B6âöffW"Fò&W7VÖRg&öÒF†—2W†7B—FVÒÂ–âF†P¢òò6ÖRVWVR÷&FW"’âF†R–Gfæ6W2VWVU÷26ò&W7VÖR–6·2W†W&Rà¢ö6µf—6—FVDæ÷F–f–6F–öâ†—B¢÷6WDÆ7EÆ–VB†—BÂwÆ’rÂ’¢òò&Vg&W6‚F†R6W76–öâv—F‚F†—2—FVÒw2F—FÆRÂæB&RÖ76W'BF†BvR&P¢òòÆ––ær(	BF†R&Wf–÷W2—FVÒw2VæBv–ÆÂ†fRW6†VB&æ÷BÆ––ær"à¢÷÷7DÖVF–7FFR‚v–æF÷rå÷&V5Æ•W6VB¢òòW6VBFV6²×W7Bæ÷B$Tt”ââ—FVÒâV6‚6Æ—F‚†æFÆW2&V–æp¢òòW6VB'B×v’F‡&÷Vv‚Â'WBæöæRöbF†VÒ6†V6·2&Vf÷&R7F'F–æs¢F†P¢òòv÷&B—27ö¶VâF‡&÷Vv‚g&W6‚ÆVF–óâæBF†Rf–FVò—2FöÆBFòÆ¢òò&Vf÷&Rç—F†–ær6öç7VÇG2F†RfÆrâv÷'6RÂf–FVò7F'FVBv†–ÆRW6V@¢òòæWfW"&Vv—7FW'22†f–ærÆ–VB(	B÷v—E•EVçF–ÄVæB&WGW&ç2V&Ç’öà¢òòWfW'’F–6²Â6òWfW%Æ–VF7F—2fÇ6RæBæöæRöb—G2&–Ç26âf—&RÀ¢òòÆVf–ærF†R6Æ—'Vææ–ær7B—G2VæBv—F‚F†RVWVR7GV6²&V†–æB—Bà¢òò†öÆF–ær†W&R¶VW2F†R&ææW"WæBF†RFV6²6–ÆVçBVçF–ÂF†RÆ¢òò'WGFöâ—2&W76VBÂv†–6‚—2F†R7FFR&W7F÷&VB6W76–öâ÷Vç2–âà¢v†–ÆR‡6W76–öåÆ––ær‚’bbv–æF÷rå÷&V5Æ•W6VBbbv–æF÷rå÷&V4æe&WVW7BbbçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’°¢v—BæWr&öÖ—6R‡"Óâ6WEF–ÖV÷WB‡"Â#’¢Ð¢–b‚6W76–öåÆ––ær‚’’'&V°¢–b„çVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢òòÆ–æ¶VBÖVF–æBf6R&V6÷&F–æw26†&RöæRW"Ö6&BÆ–&6²Æâà¢òò–â&÷F‚ÖöFRF†RÆ–æ¶VB6Æ—f–æ—6†W2&Vf÷&RF†R&V6÷&F–æw2&Vv–âà¢–b…ö—4ÖçVÄ—FVÒ†—B’’°¢6öç7BÆ–&6²Ò÷Æ–Æ—7EÆ–&6µÆâ†—B¢–b‡Æ–&6²æÆ–æ¶VBbb7÷F–g”6Æ—2†—B’æÆVæwF‚’°¢÷6WE&V5Æ•†6R‚v6Æ—r¢G'’°¢v—B7÷F–g•Æ–W"çÆ”6&B†—BÂ°¢—47W'&VçC¢‚’Óâ6W76–öåÆ––ær‚’bbv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶Vâb`¢v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&V4æe&WVW7BbbçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’À¢—5W6VC¢‚’Óâv–æF÷rå÷&V5Æ•W6VBÀ¢öäW‡FW&æÅW6S¢W6VBÓâöÇ•&V5Æ•W6R‡W6VBÂfÇ6R’À¢öäÖVF–¢ÖVF–Óâ²v–æF÷rå÷&V5Æ”ÖçVÄVF–òÒÖVF–²–b†ÖVF–’ÖVF–å÷&V5Æ”—FVÕFö¶VâÒ—FVÕFö¶VâÐ¢Ò¢–b‚6W76–öåÆ––ær‚’’'&V°¢–b‡v–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢VçÆ–&ÆU6¶—2Ò ¢Ò6F6‚†W'&÷"’°¢–b‚6W76–öåÆ––ær‚’ÇÂv–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢÷&V5Æ•Fö7B‚u6¶—VB7÷F–g’6Æ—¢r²W'&÷"æÖW76vR¢–b‚Æ–&6²ç&V6÷&F–æw2’°¢–b‚²·VçÆ–&ÆU6¶—2ãÒVWVRæÆVæwF‚’°¢ö7'V–ÆEFö7B‚tæòÆ–&ÆR—FV×2f÷VæBâÆ–&6²7F÷VBâr¢'&V°¢Ð¢’Ò÷7FW÷fW%6¶—VB‚¢6öçF–çVP¢Ð¢Ð¢Ð¢–b‡Æ–&6²æÆ–æ¶VBbbö6&D†5f–FVôÆ–æ²†—B’’°¢G'’°¢v—B÷Æ•Æ–Æ—7DÆ–æ¶VEf–FVò†—BÂVWVRÂ’¢Ò6F6‚†W'&÷"’°¢–b‚6W76–öåÆ––ær‚’ÇÂv–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢÷&V5Æ•Fö7B‚u6¶—VB–÷UGV&R6Æ—¢r²W'&÷"æÖW76vR¢–b‚Æ–&6²ç&V6÷&F–æw2’°¢–b‚²·VçÆ–&ÆU6¶—2ãÒVWVRæÆVæwF‚’'&V°¢’Ò÷7FW÷fW%6¶—VB‚¢6öçF–çVP¢Ð¢Ð¢–b‚6W76–öåÆ––ær‚’’'&V°¢–b‡v–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢Ð¢òò&V6÷&FVBÖVF–ò6&C¢Æ’F†R6÷W&6R&V6÷&F–ærÂF†VâF†RF&vWBöæRÀ¢òò&6²Fò&6²(	BFövWF†W"F†W’Æ’F†R&öÆRF†Rf–FVò6Æ—Æ—2f÷ ¢òò–÷UGV&R—FV×2(	BF†VâfÆÂF‡&÷Vv‚FòF†R–çFW"Ö—FVÒv†öÆB&VÆ÷rà¢òò–â&÷F‚ÖöFRF†W6RföÆÆ÷rF†RÆ–æ¶VB6Æ—²&V6÷&FVBVF–ò6¶—2—Bà¢°¢6öç7B6Æ—2ÒÆ–&6²ç&V6÷&F–æw2òö6&D6Æ—4–ä÷&FW"†—B’¢µÐ¢òòFW‡BÖöæÇ’ÖçVÂ6&G2&R÷F†W'v—6R6¶—VB–âÆ–W"âv†VâF†P¢òòW6W"÷G2–âÂ7V²F†V—"Gvòf6W2–âF†R6†÷6Vâ6W76–öâ÷&FW"à¢–b‡G—Vöbö6å7Vµ6–ÆVçD6&BÓÓÒvgVæ7F–öârbbö6å7Vµ6–ÆVçD6&B†—B’’°¢6Æ—2çW6‚‚ââçGG4f6U6WVVæ6R…ö6&Df6W4–ä÷&FW"†—B’Â²Væ&ÆVC¢G'VRÒ’¢Ð¢òòÆVv7’6&G2¶WBF†V—"6–ævÆR&V6÷&F–ær–âÖVF–W&Âà¢–b‡Æ–&6²ç&V6÷&F–æw2bb6Æ—2æÆVæwF‚bb†—BæÖVF–¶–æBÓÓÒvVF–òrÇÂö—4VF–ôÖVF–W&Â†—BæÖVF–W&Â’’bb—BæÖVF–W&Â’°¢6Æ—2çW6‚‡²¶W“¢w6÷W&6RrÂÆ&VÃ¢u6÷W&6RrÂ–6öã¢~HbrÂFW‡C¢†—Bbb—Bç6÷W&6R’ÇÂrrÂW&Ã¢—BæÖVF–W&ÂÒ¢Ð¢6öç7BæeVæF–ærÒ‚’Óâv–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚¢f÷"†ÆWB6’Ò²6’Â6Æ—2æÆVæwFƒ²6’²²’°¢òò&V6ÆÂW6R&Vf÷&RF†RF&vWB6Æ—âW6W2F†R6÷W&6^(i'F&vW@¢òò÷fW'&–FRv†VâF†RW6W"†2–ææVBöæRÂ÷F†W'v—6RF†R6ÖRv ¢òòF†B6W&FW2—FV×2âW6Rò7F÷ò&WbòæW‡BÆÂ7WB—@¢òò6†÷'BÂW†7FÇ’2F†W’7WBF†R–çFW"Ö—FVÒv6†÷'Bà¢–b†6’â’°¢6öç7B7D×2Ò7W'&VçE7&5FwDv×2‚¢–b‡7D×2â’°¢6öç7BöæW‡DÆ&ÂÒ†6Æ—5¶6•ÒæÆ&VÂÇÂrr’çFôÆ÷vW$66R‚’ÇÂvæW‡Bp¢÷7F'Dv6÷VçFF÷vâ‡7D×2Â2ÓâGµöæW‡DÆ&ÇÒ–âG·7×6¢v—B÷6ÆVW&W7V7F–æuW6R‡7D×2¢÷7F÷v6÷VçFF÷vâ‚¢Ð¢–b‚6W76–öåÆ––ær‚’ÇÂæeVæF–ær‚’’'&V°¢Ð¢òòÆ&VÂF†RÆ–W"6ò—Bw2ö'f–÷W2v†–6‚f6R—26÷VæF–ærÂ6–æ6P¢òò&÷F‚f6W2öböæR6&BÆ’&6²Fò&6²v—F‚æòf—7VÂ'&V²à¢–b†6Æ—5¶6•ÒçGG2’v—B÷Æ•6–ÆVçD6&EGG4æEv—B†—BÂ6Æ—5¶6•ÒÂ—FVÕFö¶Vâ¢VÇ6Rv—B÷Æ”ÖçVÄVF–ôæEv—B†6Æ—5¶6•ÒçW&ÂÂ6Æ—2æÆVæwF‚âò6Æ—5¶6•ÒæÆ&VÂ¢rr¢òò7F÷ò&WbòæW‡BGW&–ær6Æ—×W7Bæ÷B7F'BF†RæW‡BöæRà¢–b‚6W76–öåÆ––ær‚’ÇÂæeVæF–ær‚’’'&V°¢Ð¢–b‚6W76–öåÆ––ær‚’’'&V°¢Ð¢òòÆ–&ÆRÖçVÂ6&Bv2&V6†VB(	B6ÆV"F†R&6·v&BÖæbfÆr‡F†P¢òò•BF‚FöW2F†—2gFW"—G26Æ—²F†RÖçVÂF‚×W7BFöò’6òF†P¢òòFW‡BÖöæÇ’6¶—&÷fR&W7VÖW2f÷'v&Böæ6RvRGfæ6R7B†W&Rà¢VçÆ–&ÆU6¶—2Ò ¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢òò†öÆBf÷"F†R–çFW"Ö—FVÒv6òF†RW6W"&VG2F†RFW‡BÂ†öæ÷&–æp¢òòW6Rò7F÷âF†RvÖ6÷VçFF÷vâ&öw&W72&"6†÷w2F–ÖR×VçF–ÂÖæW‡Bà¢òòF†Vâ†æFÆR&WböæW‡Böv÷FòöÆö÷F†R6ÖRv’f–FVò—FV×2FòÀ¢òòW†6WBvR6¶—F†RG&–Æ–ær÷6ÆVW&W7V7F–æuW6R‡F†R†öÆ@¢òòÇ&VG’6öç7VÖVBF†Rv’à¢–b‡6W76–öåÆ––ær‚’’°¢6öç7Böv×2Ò7W'&VçDv×2‚¢–b…öv×2â’÷7F'Dv6÷VçFF÷vâ…öv×2¢v—B÷6ÆVW&W7V7F–æuW6R…öv×2¢÷7F÷v6÷VçFF÷vâ‚¢Ð¢–b‡v–æF÷rå÷&V4æe&WVW7BÓÓÒw&Wbr’°¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢’Ò†’â’ò†’Ò’¢…ö7W$Æö÷–ær‚’òVWVRæÆVæwF‚Ò¢¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒG'VP¢6öçF–çVP¢Ð¢–b‡v–æF÷rå÷&V4æe&WVW7BÓÓÒvæW‡Br’°¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢’Ò†’²ÂVWVRæÆVæwF‚’ò†’²’¢…ö7W$Æö÷–ær‚’ò¢VWVRæÆVæwF‚¢6öçF–çVP¢Ð¢–b„çVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’°¢6öç7BrÒv–æF÷rå÷&V4ædv÷Fô–æFW€¢v–æF÷rå÷&V4ædv÷Fô–æFW‚ÒçVÆÀ¢–b†rãÒbbrÂVWVRæÆVæwF‚’²’Òs²6öçF–çVRÐ¢Ð¢–b…ö7W$Æö÷‚’ÓÓÒvöæRr’6öçF–çVP¢6öç7Bv–ÆÄ†fTæW‡BÒ†’²ÂVWVRæÆVæwF‚’ÇÂö7W$Æö÷–ær‚¢–b‚v–ÆÄ†fTæW‡B’²’²³²6öçF–çVRÐ¢’²°¢6öçF–çVP¢Ð¢–b†—Bçv÷&Bbb—Bçv÷&BÓÒ&Wev÷&B’°¢òò7V²F†Rv÷&Böæ6R&Vf÷&R—G2f—'7B—FVÒÆ—2â&R×'Vç2v†VæWfW ¢òòF†RVWVRÖ÷fW2öâFòæWrv÷&B(	B–æ6ÇVF–ærv†VâF†RW6W ¢òòæf–vFW2&WböæW‡BæBF†RæWr—FVÒ&VÆöæw2FòF–ffW&VçBv÷&Bà¢òð¢òò6÷VçG226Æ—¢—B—27VV6‚F†RW6W"—2ÖVçBFò6F6‚Â6òvvp¢òòÖöFR7FW26–FRf÷"—BW†7FÇ’2—BFöW2f÷"&V6÷&F–ærÂ–ç7FV@¢òòöbG&VF–ærF†Rææ÷Væ6VÖVçB26–ÆVæ6RFòf–ÆÂà¢÷6WE&V5Æ•†6R‚v6Æ—r¢v—B÷7Vµv÷&B†—Bçv÷&B¢–b‚6W76–öåÆ––ær‚’’'&V°¢&Wev÷&BÒ—Bçv÷&@¢–b„çVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢Ð¢6öç7BGFV×BÒ7&VFU&V6÷&F–æuf–FVôGFV×B‡²f–FVô–C¢—Bæ–BÀ¢—47W'&VçC¢‚’Óâ6W76–öåÆ––ær‚’bbv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶Vâbbv–æF÷rå÷&7F–6T7F—fRb`¢v–æF÷rå÷&V4æe&WVW7BbbçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’À¢—5W6VC¢‚’Óâv–æF÷rå÷&V5Æ•W6VBÂæ÷s¢÷Æ–W$Æ–fV7–6ÆRææ÷rÒ¢v–æF÷rå÷&V5f–FVôGFV×BÒGFV×@¢6öç7B6Æ÷vVEF†—5&÷VæBÒv–æF÷rå÷&V5Æ•6Æ÷vF÷và¢ÆWBf–FVôf–ÇW&RÒçVÆÀ¢G'’°¢òò&VæFW"F†R7V'F—FÆR÷fW&Æ’–â$ÄÄTÂv—F‚Æ–&6²âv—F–ær—@¢òò†W&Rv÷VÆB&Æö6²F†Rf–FVòöâ‡÷FVçF–ÆÇ’6Æ÷r’5%BfWF6‚f–¢òòvWE7V'F—FÆW4f÷$Æ–æ²â7F6‚F†R&öÖ—6Rw2&W6öÇfVBfÇVR–â†öÆFW ¢òò6ò÷&Vg&W6…Æ––æu7V'F—FÆW26â–6²—BWöæ6R—B'&—fW2à¢6öç7B7V$†öÆFW"Ò²7Gƒ¢çVÆÂÐ¢÷&VæFW%Æ––æu7V'F—FÆW2†—BÂ²—47W'&VçC¢‚’Óâ6W76–öåÆ––ær‚’bbv–æF÷rå÷&V5Æ”—FVÕFö¶VâÓÓÒ—FVÕFö¶VâÒ¢çF†Vâ†2Óâ²7V$†öÆFW"æ7G‚Ò2Ò¢æ6F6‚†RÓâ6öç6öÆRçv&â‚wÆ•&V6÷&F–æs¢7V'F—FÆR&VæFW"f–ÆVBrÂ—BÂR’ ¢òò&V6÷fW"6æRÆ’v–æF÷rf÷"ÖÆf÷&ÖVB6Æ—2‡&V6÷&FVBGW&F–öà¢òòâÔ…õ$T4ôä$ÄUô4Ä•õ2ÂÆÖ÷7BÇv—2g&öÒâöÆB6GW&Rv†÷6P¢òò6öçFW‡Bv–æF÷r7G&FFÆVB7'6RÕ5%BF—66öçF–çV—G’’âfÆÇ2F‡&÷Vv€¢òòFòF†R÷&–v–æÂ&÷VæG2v†VâF†W&Rw2æ÷F†–ærFò&W—"v–ç7B(	@¢òò÷v—E•EVçF–ÄVæBw2f–æÂ6fWG’ÖæWB6¶—7F–ÆÂ6F6†W2F†P¢òòVç&V6÷fW&&ÆR66Rà¢6öç7B'VçF–ÖT6Æ—Ò÷'VçF–ÖU–÷UGV&T6Æ—†—BÂVWVRÂ’¢ÆWB÷Æ•7F'BÒ'VçF–ÖT6Æ—òçF–ÖU7F'Bóò—BçF–ÖU7F'@¢ÆWB÷Æ”VæBÒ'VçF–ÖT6Æ—òçF–ÖTVæBóò—BçF–ÖTVæ@¢òò&WG&ö7F—fR6Æ—6Æ×¢&V6ö×WFRF†Rv–æF÷rg&öÒF†R5U%$TåB6æ—WB6ò¢òò7F÷&VB·F–ÖU7F'BÂF–ÖTVæEÒ'V–ÇB&Vf÷&RF†R7'6R×6æ—WBf—‚†÷"7&÷72¢òòFV×÷&Âv’FöW6âwB÷fW'6†ö÷Bâ6‡&–æ²ÖöæÇ’(	BæWfW"ÆVæwF†Vç2F†R6Æ—²æ@¢òò6¶—2ÖçVÂ÷VæÆö6F&ÆR—FV×2†6öçF–wV÷W5Æ•v–æF÷r&WGW&ç2çVÆÂ’â7V'F—FÆP¢òòÆöB—266†VB‡F†R÷fW&Æ’W6W2F†R6ÖR6ÆÂ’Â6òF†—2—2W7VÆÇ’–ç7FçBà¢G'’°¢6öç7B'6VBÒv—BGFV×Bçv—B…öÆöE7V'F—FÆW4f÷$—FVÒ†—B’¢6öç7BÆærÒ‡G—VöbvWE6VÆV7FVDÆærÓÓÒvgVæ7F–öâr’òvWE6VÆV7FVDÆær‚’¢w7bp¢ÆWB&–Ö'’Ò'6VBbb†ÆærÓÓÒw7brò'6VBç7b¢'6VBæVâ¢–b‚&–Ö'’ÇÂ&–Ö'’æÆVæwF‚’&–Ö'’Ò'6VBbb†ÆærÓÓÒw7brò'6VBæVâ¢'6VBç7b¢6öç7Bv–âÒö6öçF–wV÷W5Æ•v–æF÷r‡&–Ö'’Â²ââæ—BÂF–ÖU7F'C¢÷Æ•7F'BÂF–ÖTVæC¢÷Æ”VæBÒÂ²vF‡&W6†öÆC¢ö6Æ—vF‡&W6†öÆE6V2‚’Ò¢–b‡v–â’²÷Æ•7F'BÒv–âçF–ÖU7F'C²÷Æ”VæBÒv–âçF–ÖTVæBÐ¢Ò6F6‚†R’²–b‚GFV×Bæ7F—fR‚’’F‡&÷rS²6öç6öÆRçv&â‚wÆ•&V6÷&F–æs¢Æ’×v–æF÷r6Æ×f–ÆVBrÂ—Bbb—Bæ–BÂR’Ð¢6öç7B÷&tGW"Ò‡'6TfÆöB…÷Æ”VæB’ÇÂ’Ò‡'6TfÆöB…÷Æ•7F'B’ÇÂ¢–b„çVÖ&W"æ—4f–æ—FR…÷&tGW"’bb÷&tGW"âÔ…õ$T4ôä$ÄUô4Ä•õ2’°¢6öç7B&W—&VBÒv—BGFV×Bçv—B…÷&W—$ÖÆf÷&ÖVD6Æ—†—B’¢–b‡&W—&VB’°¢6öç6öÆRçv&â€¢·Æ•&V6÷&F–æuÒÖÆf÷&ÖVB6Æ—G¶—Bæ–GÒGW#ÒGµ÷&tGW"çFôf—†VBƒ—×2(	BÆ––ær°¢G²‡&W—&VBçF–ÖTVæBÒ&W—&VBçF–ÖU7F'B’çFôf—†VBƒ—×2&÷VæBÆ–æT–æFW‚G¶—BæÆ–æT–æFW‡Ò°¢‚G·&W—&VBçF–ÖU7F'BçFôf—†VBƒ—Þ(i"G·&W—&VBçF–ÖTVæBçFôf—†VBƒ—Ò– ¢¢÷Æ•7F'BÒ&W—&VBçF–ÖU7F'@¢÷Æ”VæBÒ&W—&VBçF–ÖTVæ@¢Ð¢Ð ¢–b†7VU&ævR’°¢÷Æ•7F'BÒ7VU&ævRç7F'@¢÷Æ”VæBÒ7VU&ævRç7F÷ ¢Ð ¢òòfÆ–FFR&Vf÷&RÆöF–ær÷"&W7F÷&–ær6÷VæBÂ6òâVç&W—&VB&ævP¢òò6ææ÷B7F'BÖVF–WfVâ'&–VfÇ’&Vf÷&RF†RVæB×vF6†W"&V¦V7G2—Bà¢–b‚çVÖ&W"æ—4f–æ—FR„çVÖ&W"…÷Æ•7F'B’’ÇÂçVÖ&W"…÷Æ•7F'B’ÂÇÀ¢çVÖ&W"æ—4f–æ—FR„çVÖ&W"…÷Æ”VæB’’ÇÂçVÖ&W"…÷Æ”VæB’ÃÒçVÖ&W"…÷Æ•7F'B’ÇÀ¢çVÖ&W"…÷Æ”VæB’ÒçVÖ&W"…÷Æ•7F'B’âÔ…õ$T4ôä$ÄUô4Ä•õ2’°¢F‡&÷rö&¦V7Bæ76–vâ†æWrW'&÷"‚t–çfÆ–B6Æ—&ævRr’Â²¶–æC¢v–çfÆ–BÖ6Æ—rÒ¢Ð ¢òò6WBF†RVæB&÷VæF'’f÷"F†RW†—7F–ærÖ&´–çFW'fÅÆ”FöæR‚’†öö°¢òò†FVfVç6—fR(	B÷v—E•EVçF–ÄVæBÇ6òW6W2’âf–FVô–BÆWG2F†R†öö°¢òò–væ÷&R7FÆR7B&VG2F†B&VÆöærFòF†R$Ud”õU26Æ—w2f–FVòà¢v–æF÷rç–÷WGV&UÆ”–çFW'fÂÒ²7F'C¢÷Æ•7F'BÂVæC¢÷Æ”VæBÂf–FVô–C¢—Bæ–BÐ¢v–æF÷rçÆ––æu–÷WGV&Uf–FVòÒG'VP¢òò&W6WBF†R&öw&W72&"v—F†÷WBF†Rv–GF‚×G&ç6—F–öâ6ò—BFöW6âw@¢òòf—6–&Ç’G&–âg&öÒR(i"R÷fW"C×2BWfW'’6Æ—&÷VæF'“²F†P¢òò&"6†÷VÆBÇ&VG’&VBv†VâF†RæW‡B6Æ—&Vv–ç2à¢B‚r7&V5Æ––æt&ææW"ç&V2×"Ö&"r¢æ772‚wG&ç6—F–öârÂvæöæRr’æ772‚wv–GF‚rÂsRr¢æV6‚†gVæ7F–öâ‚’²fö–BF†—2æöfg6WEv–GF‚Ò¢æ772‚wG&ç6—F–öârÂrr¢òòÆ’ÖVF–F—&V7FÇ’f–Æ”ÖVF–6Æ–6R(	B6V&6‚&W7VÇG2&Vâw@¢òòFWFW&Ö–æ—7F–26òvRFVÆ–&W&FVÇ’FöâwBG&—fRÆ–&6²f–F†RÆ—fP¢òòDôÒâÆ”ÖVF–6Æ–6RÆöG2÷6VV·2F†R–÷UGV&RÆ–W"v—F‚F†P¢òò&V6÷&FVBW&Â²F–ÖU7F'BÂv†–6‚—2ÆÂvRæVVBà¢òòÆ–gBF†RvÖwV&B&Vf÷&RÆ––ær(	Bv—F†÷WBF†—2F†RwV&Bv÷VÆ@¢òò–ÖÖVF–FVÇ’&R×W6RF†RÆ–W"vR§W7B6¶VBFò7F'Bà¢v–æF÷rå÷&V5Æ”vwV&BÒfÇ6P¢òò6GW&VB6Æ—6'&–W2—G2÷vâVF–òÂ6òF†R×W6–27FW26–FRf÷"F†P¢òòv†öÆRöb—BæB6öÖW2&6²öâF†RvF†BföÆÆ÷w2à¢÷6WE&V5Æ•†6R‚wf–FVòr¢6öç7B÷7&2Ò†—Bç6÷W&6RÇÂrr’çFôÆ÷vW$66R‚’ÓÓÒw–÷WGV&Rròu–÷UGV&Rr¢†—Bç6÷W&6RÇÂu–÷UGV&Rr¢–b‚GFV×Bæ7F—fR‚’’6öçF–çVP¢GFV×Bç&WVW7B‚¢6öç7Bf÷&6TÆöBÒv–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆö@¢v–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆöBÒfÇ6P¢6öç7BÆ”BÒ7–æ2‡7F'BÂ&VÆöB’Óâ°¢v—BGFV×Bçv—B‡Æ”ÖVF–6Æ–6R†—Bæ–BÂ7F'BÂ÷Æ”VæBÂ÷7&2Â°¢—47W'&VçC¢‚’ÓâGFV×Bæ7F—fR‚’bb÷vç5f–FVò‚’Âf÷&6TÆöC¢&VÆöBÂæ÷s¢÷Æ–W$Æ–fV7–6ÆRææ÷rÀ¢6öæf—&Õ6VV³¢G'VRÂ&WV—&UÆ––æs¢G'VRÂ—4f÷&Vw&÷VæC¢÷Æ–W$Æ–fV7–6ÆRæ—4f÷&Vw&÷VæBÀ¢&W&UÆ–W#¢Æ–W"ÓâGFV×Bç&W&UÆ–W"‡Æ–W"’Ò’¢–b‚GFV×Bæ7F—fR‚’ÇÂ÷vç5f–FVò‚’’&WGW&à¢6öç7B&FRÒ6Æ÷vVEF†—5&÷VæBÇÂv–æF÷rå÷&V5&WÆ•7VVBòãsR¢÷&V6÷&F–æuf–FVõ&FR‚¢G'’²v–æF÷rç—EÆ–W#òç6WEÆ–&6µ&FR‡&FR’Ò6F6‚…ò’·Ð¢GFV×Bç&VÆV6T×WFR‚¢G'’²v–æF÷rç—EÆ–W#òçÆ•f–FVò‚’Ò6F6‚…ò’·Ð¢Ð¢v—BÆ”B…÷Æ•7F'BÂf÷&6TÆöB¢–b‚6W76–öåÆ––ær‚’’'&V°¢–b‚÷vç5f–FVò‚’’6öçF–çVP¢v—BGFV×Bçv—B…÷v—E•EVçF–ÄVæB…÷Æ•7F'BÂ÷Æ”VæBÂ‚’Óâ°¢÷WFFUÆ––æu&öw&W72…÷Æ•7F'BÂ÷Æ”VæBÂ—Bæ–B¢÷&Vg&W6…Æ––æu7V'F—FÆW2‡7V$†öÆFW"æ7G‚¢ÒÂ—Bæ–BÂGFV×BÂ7F'BÓâÆ”B‡7F'BÂG'VR’’¢Ò6F6‚†R’°¢f–FVôf–ÇW&RÒP¢Òf–æÆÇ’°¢GFV×BæF—7÷6R‚¢–b‡v–æF÷rå÷&V5f–FVôGFV×BÓÓÒGFV×B’v–æF÷rå÷&V5f–FVôGFV×BÒçVÆÀ¢Ð¢–b‚6W76–öåÆ––ær‚’’'&V°¢–b‡f–FVôf–ÇW&R’°¢–b‡f–FVôf–ÇW&Ræ¶–æBÓÓÒv6æ6VÆÆVBrÇÂv–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’6öçF–çVP¢òòf–ÆVBf–FV÷2Fòæ÷B–æ7W"F†R÷&F–æ'’–çFW"Ö—FVÒv÷"Æö÷ÖöæRà¢òòÆFRÆöB6ææ÷B6÷VæBgFW"F†—2GFV×B†2Æ÷7B÷væW'6†—à¢G'’²v–æF÷rç—EÆ–W#òçW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢v–æF÷rå÷&V5Æ”vwV&BÒG'VP¢v–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆöBÒG'VP¢6öç7B&V6öâÒf–FVôf–ÇW&Ræ¶–æBÓÓÒwF–ÖV÷WBròvæòÆ–&6²&öw&W72f÷"#2p¢¢f–FVôf–ÇW&Ræ6öFRÓÓÒS2òu–÷UGV&RÆ–W"6öæf–wW&F–öâW'&÷"p¢¢f–FVôf–ÇW&Ræ6öFRÓÓÒ"òv–çfÆ–Bf–FVò&WVW7Bp¢¢f–FVôf–ÇW&Ræ¶–æBÓÓÒv–çfÆ–BÖ6Æ—ròv–çfÆ–B6Æ—&ævRr¢wf–FVòVæf–Æ&ÆRp¢÷7GVG”6‡&öÖRç6†÷r‚¢÷&V5Æ•Fö7B†6¶—VBG¶’²ÒòG·VWVRæÆVæwF‡Ó¢G·&V6öçÖ¢–b‚²·VçÆ–&ÆU6¶—2ãÒVWVRæÆVæwF‚’°¢ö7'V–ÆEFö7B‚tæòÆ–&ÆR—FV×2f÷VæBâÆ–&6²7F÷VBâr¢'&V°¢Ð¢’Ò÷7FW÷fW%6¶—VB‚¢6öçF–çVP¢Ð¢VçÆ–&ÆU6¶—2Ò ¢–b‡6Æ÷vVEF†—5&÷VæBbbv–æF÷rå÷&V5&WÆ•7VVB’°¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FRbbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FR…÷&V6÷&F–æuf–FVõ&FR‚’’Ò6F6‚…ò’·Ð¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢Ð¢òò6Æ——2FöæR(	B&ÒF†RvÖwV&B6ò6Æ÷rÖÆöFVB6Æ—F†Bf–æÆÇ¢òò&W6öÇfW2eDU"vR&–ÆVB†÷"ç’•BWF÷Æ’vV—&FæW72’FöW6âw@¢òò&ÆVVBVF–òF‡&÷Vv‚F†R–çFW"Ö—FVÒvâ6ÆV&VB&–v‡B&Vf÷&RF†P¢òòæW‡BÆ”ÖVF–6Æ–6R‚’&÷fRà¢v–æF÷rå÷&V5Æ”vwV&BÒG'VP ¢òò†öæ÷W"ç’&WböæW‡Böv÷Fò&WVW7BVWVVBv†–ÆRF†—2—FVÒv2Æ––ærà¢òò&Wb&R×Æ—2F†R&Wf–÷W2—FVÒv—F‚6Æ÷vF÷vã²æW‡BGfæ6W2f÷'v&C°¢òòv÷Fò§V×2Fòâ&&—G&'’–æFW‚‡6WB'’F†RVWVRF–Æör’à¢òòw&2&÷VæB–âç’Æö÷–ærÖöFS²7F—26Æ×VB÷F†W'v—6Rà¢–b‡v–æF÷rå÷&V4æe&WVW7BÓÓÒw&Wbr’°¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢’Ò†’â’ò†’Ò’¢…ö7W$Æö÷–ær‚’òVWVRæÆVæwF‚Ò¢¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒG'VP¢6öçF–çVP¢Ð¢–b‡v–æF÷rå÷&V4æe&WVW7BÓÓÒvæW‡Br’°¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢’Ò†’²ÂVWVRæÆVæwF‚’ò†’²’¢…ö7W$Æö÷–ær‚’ò¢VWVRæÆVæwF‚¢6öçF–çVP¢Ð¢–b„çVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’°¢6öç7BrÒv–æF÷rå÷&V4ædv÷Fô–æFW€¢v–æF÷rå÷&V4ædv÷Fô–æFW‚ÒçVÆÀ¢–b†rãÒbbrÂVWVRæÆVæwF‚’²’Òs²6öçF–çVRÐ¢Ð ¢òòÆö÷ÖöæS¢&WÆ’F†—26ÖR—FVÒ–æFVf–æ—FVÇ’‡VçF–Â&WböæW‡B÷7F÷’à¢–b…ö7W$Æö÷‚’ÓÓÒvöæRr’°¢–b‡6W76–öåÆ––ær‚’’°¢6öç7Böv×2Ò7W'&VçDv×2‚¢–b…öv×2â’÷7F'Dv6÷VçFF÷vâ…öv×2¢v—B÷6ÆVW&W7V7F–æuW6R…öv×2¢÷7F÷v6÷VçFF÷vâ‚¢Ð¢6öçF–çVP¢Ð¢òòæGW&ÂGfæ6R(	Bv&WGvVVâ—FV×2Â–æ6ÇVF–ær&Vf÷&Rw&à¢6öç7Bv–ÆÄ†fTæW‡BÒ†’²ÂVWVRæÆVæwF‚’ÇÂö7W$Æö÷–ær‚¢–b‡v–ÆÄ†fTæW‡Bbb6W76–öåÆ––ær‚’’°¢6öç7Böv×2Ò7W'&VçDv×2‚¢–b…öv×2â’÷7F'Dv6÷VçFF÷vâ…öv×2¢v—B÷6ÆVW&W7V7F–æuW6R…öv×2¢÷7F÷v6÷VçFF÷vâ‚¢Ð¢’²°¢Ð¢–b‚6W76–öä7W'&VçB‚’’&WGW&à¢òò–bvRW†—FVBF†RÆö÷&V6W6R’ãÒVWVRæÆVæwF‚äBÆö÷–ær—2öfbÀ¢òòF†R6W76–öâÆ–VBFòæGW&Â6ö×ÆWF–öââÖ&²VWVU÷27BF†RVæ@¢òò6òF†RæW‡BÆ’ÆÂFöW6âwB÷F†R#öbâ&VÖ–æ–ær"&W7VÖP¢òò&ö×Bf÷"v†Bv27GVÆÇ’f–æ—6†VB6W76–öâà¢G'’°¢–b‚VWVRç6öÖR†—BÓâ—Bå÷FV×÷&'’’bbö7W$Æö÷–ær‚’bbVWVRæÆVæwF‚bb’ãÒVWVRæÆVæwF‚’°¢6öç7B&V4æÖRÒ‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR’ÇÂ‡VWVU³ÒbbVWVU³Òå÷&V4æÖR¢–b‡&V4æÖR’°¢6öç7BÖÒöÆöDÆ7EÆ–VDÖ‚¢–b†Ö·&V4æÖUÒbbÖ·&V4æÖUÒçÆ’’°¢Ö·&V4æÖUÒçÆ’çVWVU÷2ÒVWVRæÆVæwF€¢÷6fTÆ7EÆ–VDÖ†Ö¢Ð¢Ð¢Ð¢Ò6F6‚…ò’·Ð¢÷&W7F÷&U&V6÷&F–æu&WÆ•7VVB‚¢v–æF÷rå÷&V5Æ•VWVRÒçVÆÀ¢v–æF÷rå÷&V5Æ•FV×÷&'’ÒfÇ6P¢v–æF÷rå÷Æ––æu&V6÷&F–ærÒfÇ6P¢÷Æ–W%6W76–öåF–ÖV÷WBæ6æ6VÂ‚¢÷6WE6W76–öä—FVÔv†çVÆÂ¢òòFV6²F†BÆ–VBFò—G2VæB—2f–æ—6†VBÂæ÷B–çFW''WFVB(	B6ò—B—2æ÷@¢òò6öÖWF†–ærFòWB&6²öâ67&VVâæW‡BÆVæ6‚à¢ö6ÆV$÷Våf–Wr‚¢òòÆ–Æ—7BF†B'Vç2Fò—G2æGW&ÂVæB†2FòÆWBvòöbF†R6ÖRF†–æw0¢òòâW‡Æ–6—B7F÷FöW2âÆVf–ærF†RÖVF–6W76–öâ6Æ–Ö–ærFòÆ’¶VW0¢òòæG&ö–B&÷WF–ærF†R†VG6WB†W&RÂv†W&RWfW'’†æFÆW"æ÷ræòÖ÷2öà¢òò÷Æ––æu&V6÷&F–ær(	B6òF†R'WGFöç2vòFVBäBæò÷F†W"6â†fP¢òòF†VÒâæBâÆVF–óâVÆVÖVçB—2æ÷B6–ÆVæ6VB'’&V–ær&VÖ÷fVBg&öÒF†P¢òòDôÒÂ6òf6R&WÆ’7F'FVBGW&–ærF†RÆ7B—FVÒv÷VÆBÆ’öâv—F€¢òòæ÷F†–ærÆVgB†öÆF–ær&VfW&Væ6RFò7F÷—Bà¢÷÷7DÖVF–7FFR†fÇ6R¢÷7F÷&6¶w&÷VæD×W6–2‚¢G'’°¢6öç7BöÖÒv–æF÷rå÷&V5Æ”ÖçVÄVF–ð¢–b…öÖ’²öÖçW6R‚“²öÖç7&2ÒrrÐ¢Ò6F6‚…ò’·Ð¢v–æF÷rå÷&V5Æ”ÖçVÄVF–òÒçVÆÀ¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢v–æF÷rå÷&V5Æ”7W'&VçD—FVÒÒçVÆÀ¢÷&V5Æ”6&E&WfW'6VBÒçVÆÀ¢v–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBÒfÇ6P¢v–æF÷rå÷&V5Æ”vwV&BÒfÇ6P¢–b‡v–æF÷rå÷&V5Æ”vwV&D–B’²6ÆV$–çFW'fÂ‡v–æF÷rå÷&V5Æ”vwV&D–B“²v–æF÷rå÷&V5Æ”vwV&D–BÒçVÆÂÐ¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚w&V2×Æ––ær&V2×W6VB&V2×Æ––ærÖÖ–æ–Ö—¦VB&V2×Æ––ærÖÖçVÂ&V2×Æ––ærÖÖçVÂ×f–FVòr¢B‚r7&V5Æ––ætVF–òr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æt&ææW"r’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu7V'2r’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuv÷&Br’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuW6T'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu&Wd'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––ætæW‡D'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuG&ç7÷'Br’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu6‡VffÆT'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––ætÆö÷'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––ætÖ–æ–Ö—¦T'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu6V&6„'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æt6Æ÷6T'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuVWVT'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu&W7F÷&U–ÆÂr’ç&VÖ÷fR‚¢B‚r7&V5Æ”æeFö7Br’ç&VÖ÷fR‚¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FRbbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FR…÷&V6÷&F–æuf–FVõ&FR‚’’Ò6F6‚…ò’·Ð¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð§Ð ¢òòfÆ6‚FV×÷&'’%v–ÆÂÆ’‚÷’æW‡B"Fö7Bv†VâF†RW6W"F2&WböæW‡Bà¢òòÖ—'&÷'2F†RÆ–&6²Æö÷w2w&Ö&÷VæBÆöv–2‡6VRäÃ“#“2’6òF†R–æFW€¢òò6†÷vâÖF6†W2v†W&RÆ–&6²v–ÆÂ7GVÆÇ’ÆæBÂÆö÷–ær–æ6ÇVFVBà¦ÆWB÷&V5Æ”æeFö7EF–ÖW"ÒçVÆÀ¦gVæ7F–öâ÷6†÷u&V5Æ”æeFö7B†F—&V7F–öâ’°¢6öç7BÒv–æF÷rå÷&V5Æ•VWVP¢6öç7BF÷FÂÒ'&’æ—4'&’‡’òæÆVæwF‚¢ ¢–b‚F÷FÂ’&WGW&à¢6öç7B’Òv–æF÷rå÷&V5Æ”–æFW‚ÇÂ ¢6öç7BÆö÷–ærÒ‚‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&V5Æ”Æö÷’ÇÂvöfbr’ÓÒvöfbp¢ÆWBF&vW@¢–b†F—&V7F–öâÓÓÒw&Wbr’°¢F&vWBÒ†’â’ò†’Ò’¢†Æö÷–æròF÷FÂÒ¢¢ÒVÇ6R°¢F&vWBÒ†’²ÂF÷FÂ’ò†’²’¢†Æö÷–ærò¢F÷FÂ¢Ð ¢ÆWB×6p¢–b‡F&vWBãÒF÷FÂ’°¢×6rÒtVæBöbVWVRròòæW‡BBF†RÆ7B—FVÒÂæ÷BÆö÷–ær(i"Æ–&6²VæG0¢ÒVÇ6R°¢6öç7Bv÷&BÒ·F&vWEÒbb·F&vWEÒçv÷&@¢×6rÒv–ÆÂÆ’G·F&vWB²ÒòG·F÷FÇÒæW‡F²‡v÷&Bò+r"G·v÷&GÒ&¢rr¢Ð ¢÷&V5Æ•Fö7B†×6r§Ð ¦gVæ7F–öâ÷&V5Æ•Fö7B†×6rÂ²6W76–öåF–ÖV÷WBÒfÇ6RÒÒ·Ò’°¢ÆWBGBÒB‚r7&V5Æ”æeFö7Br¢–b‚GBæÆVæwF‚’GBÒB‚sÆF—b–CÒ'&V5Æ”æeFö7B"&öÆSÒ'7FGW2"&–ÖÆ—fSÒ'öÆ—FR#ãÂöF—câr’æVæEFò‚v&öG’r¢GBçFW‡B†×6r’çFövvÆT6Æ72‚w6W76–öâ×F–ÖV÷WBrÂ6W76–öåF–ÖV÷WB’æFD6Æ72‚wf—6–&ÆRr¢–b…÷&V5Æ”æeFö7EF–ÖW"’6ÆV%F–ÖV÷WB…÷&V5Æ”æeFö7EF–ÖW"¢÷&V5Æ”æeFö7EF–ÖW"Ò6WEF–ÖV÷WB‚‚’Óâ²GBç&VÖ÷fT6Æ72‚wf—6–&ÆRr’ÒÂ6W76–öåF–ÖV÷WBòC¢c§Ð ¢òòVWVR&WböæW‡Bæf–vF–öâ&WVW7Bf÷"F†RÆ–&6²Æö÷âF†RÆö÷ ¢òò6†V6·2—BgFW"V6‚—FVÒf–æ—6†W2(	BV—F†W"æGW&ÆÇ’÷"–çFW''WFV@¢òòf–F†R6ÖRfÆr–ç6–FR÷v—E•EVçF–ÄVæBâv†VâW6VBÂÇ6òVçW6R6ð¢òòF†RæWr—FVÒ7GVÆÇ’7F'G2à¦gVæ7F–öâæf–vFU&V6÷&F–æuÆ–&6²†F—&V7F–öâ’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&âfÇ6P¢–b†F—&V7F–öâÓÒw&WbrbbF—&V7F–öâÓÒvæW‡Br’&WGW&âfÇ6P¢v–æF÷rå÷&V5Æ•&WVW7FVD7VRÒçVÆÀ¢v–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆöBÒfÇ6P¢v–æF÷rå÷&V4æe&WVW7BÒF—&V7F–öà¢v–æF÷rå÷&V4ædv÷Fô–æFW‚ÒçVÆÀ¢÷6†÷u&V5Æ”æeFö7B†F—&V7F–öâ¢ö–çFW''WE&V6÷&F–æuÆ–&6²‚¢–b‡v–æF÷rå÷&V5Æ•W6VB’FövvÆUÆ––æu&V6÷&F–æuW6R‚¢&WGW&âG'VP§Ð ¦gVæ7F–öâ&WÆ”7W'&VçE&V6÷&F–æt—FVÒ‡&ævRÒçVÆÂ’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ærÇÂv–æF÷rå÷&V5Æ”7W'&VçD—FVÒ’&WGW&âfÇ6P¢6öç7B–æFW‚Òv–æF÷rå÷&V5Æ”–æFW€¢–b‚çVÖ&W"æ—4–çFVvW"†–æFW‚’ÇÂv–æF÷rå÷&V5Æ•VWVSòå¶–æFW…Ò’&WGW&âfÇ6P¢v–æF÷rå÷&V5Æ•&WVW7FVD7VRÒ&ævRò²—FVÓ¢v–æF÷rå÷&V5Æ•VWVU¶–æFW…ÒÂ6W76–öã¢v–æF÷rå÷&V5Æ•6W76–öåFö¶VâÂ&ævRÒ¢çVÆÀ¢–b‚&ævRbbv–æF÷rå÷&V5&WÆ•7VVB’°¢ÆWB&FRÒ¢G'’²&FRÒv–æF÷rç—EÆ–W"ævWEÆ–&6µ&FR‚’ÇÂÒ6F6‚…ò’·Ð¢v–æF÷rå÷&V5&WÆ•7VVBÒ²—FVÓ¢v–æF÷rå÷&V5Æ•VWVU¶–æFW…ÒÂ–æFW‚Â&FRÐ¢Ð¢–b‚&ævR’²G'’²v–æF÷rç—EÆ–W#òç6WEÆ–&6µ&FRƒãsR’Ò6F6‚…ò’·ÒÐ¢òò6–ÆVçBöW'&÷"67&VVâ×W7B&RÆöFVBv–âÂæ÷BÖW&VÇ’6VV¶VBà¢v–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆöBÒv–æF÷rå÷&V5f–FVôGFV×Bbbv–æF÷rå÷&V5f–FVôGFV×BçÆ–V@¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢v–æF÷rå÷&V4ædv÷Fô–æFW‚Ò–æFW€¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢ö–çFW''WE&V6÷&F–æuÆ–&6²‚¢÷7F÷v6÷VçFF÷vâ‚¢òò&W7VÖRF†R6W76–öâv—F†÷WB&W7VÖ–ærF†RöÆB6Æ—B—G2öÆB÷6—F–öâà¢–b‡v–æF÷rå÷&V5Æ•W6VB’öÇ•&V5Æ•W6R†fÇ6RÂfÇ6R¢&WGW&âG'VP§Ð ¦gVæ7F–öâ÷&W7F÷&U&V6÷&F–æu&WÆ•7VVB‚’°¢6öç7B&WÆ’Òv–æF÷rå÷&V5&WÆ•7VV@¢–b‚&WÆ’’&WGW&à¢v–æF÷rå÷&V5&WÆ•7VVBÒçVÆÀ¢G'’²v–æF÷rç—EÆ–W#òç6WEÆ–&6µ&FR‡&WÆ’ç&FR’Ò6F6‚…ò’·Ð¢–b‡v–æF÷rå÷&V5Æ”ÖçVÄVF–ò’öÇ•&V6÷&F–ætVF–õ&FR‡v–æF÷rå÷&V5Æ”ÖçVÄVF–ò¢&WGW&â&WÆ’ç&FP§Ð ¦gVæ7F–öâö–çFW''WE&V6÷&F–æuÆ–&6²‚’°¢òòvWEf–FVõW&ÂövWEf–FVôFF6â7F–ÆÂæÖRâöÆFW"f–FVòv†–ÆR'&ö¶Và¢òòÆöB—2VæF–ærâæf–vF–öâ×W7B—77VRg&W6‚ÆöBÂWfVâv†Vâ—G0¢òòFW7F–æF–öâ†Vç2FòÖF6‚F†B7FÆRU$Âà¢–b‡v–æF÷rå÷&V5f–FVôGFV×Bbbv–æF÷rå÷&V5f–FVôGFV×BçÆ–VB’v–æF÷rå÷&V5Æ”f÷&6Uf–FVõ&VÆöBÒG'VP¢òò6æ6VÂFVÆ–VBW6W2ÆVgB'’F†R&Wf–÷W26Æ—ÂWfVâv†Vâ&WÆ––æp¢òòF†R6ÖR6&B÷f–FVó¢–FVçF—G’ÆöæR6ææ÷BF—7F–æwV—6‚F†÷6RGFV×G2à¢v–æF÷rå÷&V5Æ”—FVÕFö¶VâÒ·Ð¢v–æF÷rå÷&V5f–FVôGFV×Còæ6æ6VÂ‚¢òò7F÷F†R7W'&VçFÇ’×Æ––ærf–FVòæBç’–âÖfÆ–v‡BEE2$”t…Bäõr6òF†P¢òòG&ç6—F–öâ–çFòF†RæW‡B—FVÒ—26ÆVââF†RÆ–&6²Æö÷v–ÆÂ6VP¢òò÷&V4æe&WVW7BæB&÷WFRFòF†R&–v‡B–æFW‚(	B'WBv—F†÷WBF†—2F†P¢òòW6W"†V'2F†RöÆB6Æ—6öçF–çVRf÷"WFòöæRöÆÂ×F–6²‡ã×2’æBÀ¢òòv÷'6RÂç’7F—fREE2VF–ò÷fW&Æ2F†RæW‡B—FVÒà¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢6öç7BVF–òÒv–æF÷rå÷&V5Æ”ÖçVÄVF–ð¢–b†VF–ò’²÷&V5W‡V7EW6R†VF–ò“²G'’²VF–òçW6R‚’Ò6F6‚…ò’·ÒÐ¢G'’°¢6öç7BBÒv–æF÷rå÷&V5EE0¢–b‡BbbBæ¶–æBÓÓÒvVF–òrbbBæVF–ò’²BæVF–òçW6R‚“²BæVF–òç7&2ÒrrÐ¢–b‡BbbBæ6æ6VÂ’Bæ6æ6VÂ‚¢–b‡v–æF÷rç7VV6…7–çF†W6—2bbG—Vöbv–æF÷rç7VV6…7–çF†W6—2æ6æ6VÂÓÓÒvgVæ7F–öâr’°¢v–æF÷rç7VV6…7–çF†W6—2æ6æ6VÂ‚¢Ð¢Ò6F6‚…ò’·Ð¢v–æF÷rå÷&V5EE2ÒçVÆÀ§Ð ¢òòW6R÷&W7VÖR&÷F‚F†R–÷UGV&RÆ–W"æBF†R7F—fREE2„vöövÆRVF–ò÷ ¢òò'&÷w6W"7VV6‚’âFövvÆVB'’F†RfÆöF–ærW6R'WGFöââF†Rv—BÆö÷0¢òò…÷v—E•EVçF–ÄVæBÂ÷6ÆVW&W7V7F–æuW6R’6†V6²v–æF÷rå÷&V5Æ•W6VBæ@¢òòW‡FVæBF†V—"FVFÆ–æW26òW6VBF–ÖRFöW6âwB6÷VçBv–ç7B7FÆÂö6à¢òòÇ’&V2×Æ’W6R÷&W7VÖS¢7–æ2F†RfÆrÂ'WGFöâT’Â&öG’6Æ72æBEE2à¢òò6öçG&öÅ—F(	Bv†WF†W"FòÇ6ò6öÖÖæBF†R–÷UGV&RÆ–W"âE%TRv†VâF†R ¢òò–æ—F–FW2‡F†R(û‚'WGFöâ“²dÅ4Rv†VâvRw&RöæÇ’Ô•%$õ$”ärÆ–W"F†B¢òò†VG6WBòÖVF–¶W’Ç&VG’W6VB÷"&W7VÖVB†6ÆÆ–ærÆ’÷W6Uf–FVòF†Và¢òòv÷VÆBf–v‡BF†RW‡FW&æÂ6öÖÖæBæBÆö÷&6²F‡&÷Vv‚F†R7FFRöÆÂ’âv†Và¢òòvRFò6öÖÖæBF†RÆ–W"vR7F×÷&V5Æ•W6T6ÖDB6òF†RöÆÂw2w&6P¢òòv–æF÷r–væ÷&W2F†RG&ç6–VçB7FFRv†–ÆRF†RÆ–W"6WGFÆW2à¦gVæ7F–öâöÇ•&V5Æ•W6R‡W6VBÂ6öçG&öÅ—BÒG'VR’°¢–b‚W6VBbbv–æF÷rå÷Æ––æu&V6÷&F–ær’°¢÷Æ–W%6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢Ð¢v–æF÷rå÷&V5Æ•W6VBÒW6V@¢6öç7BBÒv–æF÷rå÷&V5EE0¢òòG&—fR–÷UGV&Rv†–ÆR—G2Æ–æ¶VB6Æ——27F—fS²GW&–ær&V6÷&F–æw2÷"F†P¢òò6&Bw2&V6ÆÂW6RÂ—G2&¶VBf–FVò×W7B7F’W6VBà¢6öç7BöÖçVÄ—FVÒÒö—4ÖçVÄ—FVÒ‡v–æF÷rå÷&V5Æ”7W'&VçD—FVÒ’bbv–æF÷rå÷&V5Æ”Æ–æ¶VEf–FVð¢–b‡W6VB’°¢B‚v&öG’r’æFD6Æ72‚w&V2×W6VBr¢B‚r7&V5Æ––æuW6T'Fâç&V2Ö–6öâ×W6Rr’æ†–FR‚¢B‚r7&V5Æ––æuW6T'Fâç&V2Ö–6öâ×Æ’r’ç6†÷r‚¢òòG&—fRv†FWfW"—27GVÆÇ’6÷VæF–ærâöâÖçVÂ6&BF†Bw2F†RÆVF–óà¢òòVÆVÖVçB(	BæBF†R–÷UGV&RÆ–W"×W7B&RÆVgBÆöæRF†W&S¢ÖçVÂ6&@¢òòÖ’6''’Æ–æ²F†Bv2öæÇ’WfW"5TTB2&VfW&Væ6RÂ6òÆ•f–FVò‚¢òòöâ&W7VÖRv÷VÆB7F'Bf–FVòæö&öG’6¶VBf÷"â¶W–VBöâF†R—FVÒ&V–æp¢òòÖçVÂ&F†W"F†âöâF†RVF–òö–çFW"&V–ær6WBÂ&V6W6RF†Bö–çFW ¢òò—2çVÆÂöâÖçVÂ6&Bv—F‚æò&V6÷&F–æw2ÂæBçVÆÂv–â–âF†P¢òòv–æF÷r&Vf÷&RF†Rf—'7B6Æ—w2'—FW2†fRÆöFVBà¢–b†6öçG&öÅ—B’°¢6öç7BöÖÒv–æF÷rå÷&V5Æ”ÖçVÄVF–óòå÷&V5Æ”—FVÕFö¶VâÓÓÒv–æF÷rå÷&V5Æ”—FVÕFö¶Vâòv–æF÷rå÷&V5Æ”ÖçVÄVF–ò¢çVÆÀ¢–b…öÖ’²G'’²öÖçW6R‚’Ò6F6‚…ò’·ÒÐ¢VÇ6R–b‚öÖçVÄ—FVÒ’²G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·ÒÐ¢Ð¢G'’°¢–b‡BbbBæ¶–æBÓÓÒvVF–òrbbBæVF–ò’BæVF–òçW6R‚¢VÇ6R–b‡BbbBæ¶–æBÓÓÒw7VV6‚r’²–b‡BçW6R’BçW6R‚“²VÇ6Rv–æF÷rç7VV6…7–çF†W6—3òçW6R‚’Ð¢Ò6F6‚…ò’·Ð¢ÒVÇ6R°¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚w&V2×W6VBr¢B‚r7&V5Æ––æuW6T'Fâç&V2Ö–6öâ×W6Rr’ç6†÷r‚¢B‚r7&V5Æ––æuW6T'Fâç&V2Ö–6öâ×Æ’r’æ†–FR‚¢òòÆ–gF–ærF†RW6R—2F†RFV6²7F'F–ærFò6÷VæBv–âÂæB—B—2&V6†&ÆP¢òòg&öÒF†R&W7F÷&R–ÆÂv†–ÆR&7F–6R—2÷VâæBÆ––ær(	B6ò—B6–ÆVæ6W0¢òòF†R÷F†W'2W†7FÇ’27F'F–ærg&W6‚6Æ—FöW2âf–FVò6&B&W7VÖW0¢òòF‡&÷Vv‚F†R–÷UGV&RÆ–W"Âv†–6‚æòVÆVÖVçBÆ—7FVæW"v÷VÆB6F6‚à¢–b†6öçG&öÅ—B’÷6–ÆVæ6T÷F†W$VF–ò‚vFV6²r¢–b†6öçG&öÅ—B’°¢6öç7BöÖÒv–æF÷rå÷&V5Æ”ÖçVÄVF–óòå÷&V5Æ”—FVÕFö¶VâÓÓÒv–æF÷rå÷&V5Æ”—FVÕFö¶Vâòv–æF÷rå÷&V5Æ”ÖçVÄVF–ò¢çVÆÀ¢òòâVæFVB6Æ—ÖVç2F†R6&B—2–âv(	BF†RW6R&V–ærÆ–gFVBv2¢òòW6Röb6–ÆVæ6RÂ6ò&W7VÖ–ær×W7Bæ÷B&WÆ’v†BÇ&VG’6÷VæFVBà¢–b…öÖ’²–b‚öÖæVæFVB’²G'’²öÖçÆ’‚’æ6F6‚‚‚’Óâ·Ò’Ò6F6‚…ò’·ÒÒÐ¢VÇ6R–b‚öÖçVÄ—FVÒ’²G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çÆ•f–FVòbbv–æF÷rç—EÆ–W"çÆ•f–FVò‚’Ò6F6‚…ò’·ÒÐ¢Ð¢G'’°¢–b‡BbbBæ¶–æBÓÓÒvVF–òrbbBæVF–ò’BæVF–òçÆ’‚’æ6F6‚‚‚’Óâ·Ò¢VÇ6R–b‡BbbBæ¶–æBÓÓÒw7VV6‚r’²–b‡Bç&W7VÖR’Bç&W7VÖR‚“²VÇ6Rv–æF÷rç7VV6…7–çF†W6—3òç&W7VÖR‚’Ð¢Ò6F6‚…ò’·Ð¢Ð¢–b†6öçG&öÅ—B’v–æF÷rå÷&V5Æ•W6T6ÖDBÒFFRææ÷r‚¢òò¶VWF†R7—7FVÒÖVF–6W76–öâ–â7FWÂv†FWfW"Ö÷fVBF†RW6R7FFR(	@¢òòF†R(û‚'WGFöâÂF†RVF–ò6öçG&öÇ2Â÷"âW‡FW&æÂ¶W’âv—F†÷WBF†—2F†P¢òò6W76–öâvöW2V–WBöâÖçVÂ6&G2æB7F÷2&V6V—f–ærF†R†VG6WBà¢÷÷7DÖVF–7FFR‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbW6VB¢òòF†R×W6–2ç7vW'2FòF†R6W76–öâw2W6R7FFRÆ–¶RWfW'—F†–ærVÇ6RÂ6ò¢òò†VG6WBW6R6–ÆVæ6W2F†R6&BäBF†R×W6–2&V†–æB—Bà¢÷7–æ4&6¶w&÷VæD×W6–2‚§Ð ¦gVæ7F–öâFövvÆUÆ––æu&V6÷&F–æuW6R‚’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&à¢öÇ•&V5Æ•W6R‚v–æF÷rå÷&V5Æ•W6VBÂG'VR§Ð ¢òò6VV²F†RF†–ærF†B—27GVÆÇ’6÷VæF–ærÂ'’FVÇF6V6öæG2âÖçVÂ6&@¢òòÆ—2F‡&÷Vv‚F†RÆVF–óâVÆVÖVçC²WfW'—F†–ærVÇ6RF‡&÷Vv‚F†R–÷UGV&P¢òòÆ–W"â&WGW&ç2G'VRv†Vâ6VV²†VæVBÂ6ò6ÆÆW'26âfÆÂ&6²à¢òð¢òòf÷"f–FVòF†R6VV²—26Æ×VBFòF†R6Æ—w2÷vâv–æF÷r(	B&V6÷&FVB—FVÐ¢òò—26Æ–6RöbÆöærf–FVòÂ6ò&Wv–æF–ær7BF–ÖU7F'Bv÷VÆBG&÷F†RW6W ¢òò–çFòVç&VÆFVBfö÷FvR&F†W"F†â&WÆ––ærv†BF†W’§W7B†V&Bà¢òò&WGW&ç2G'VRv†Vâ—B6VV¶VBÂ$T5õ4TTµõTäDU$dÄõrò$T5õ4TTµôõdU$dÄõrv†VâF†P¢òòÖ÷fRv÷VÆBÆæB÷WG6–FRF†R7W'&VçB6Æ—ÂæBfÇ6Rv†VâF†W&R—2æ÷F†–æp¢òò6VV¶&ÆRâæV—F†W"VæB—26Æ×VC¢6öÖVöæR6VV¶–ær7BF†R&Vv–ææ–ærvçG0¢òòv†B6ÖR$Tdõ$RF†—2—FVÒÂæB7BF†RVæBÂv†B6öÖW2gFW"(	Bæ÷B—G0¢òòf—'7B÷"Æ7B6V6öæB÷fW"v–âà¦6öç7B$T5õ4TTµõ5DUõ4T2ÒP¦6öç7B$T5õ4TTµõTäDU$dÄõrÒwVæFW&fÆ÷rp¦6öç7B$T5õ4TTµôõdU$dÄõrÒv÷fW&fÆ÷rp¦gVæ7F–öâ÷&V5Æ•6VVµ&VÆF—fR†FVÇF’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&âfÇ6P¢6öç7BÒv–æF÷rå÷&V5Æ”ÖçVÄVF–ð¢–b†’°¢6öç7BF&vWBÒ†æ7W'&VçEF–ÖRÇÂ’²FVÇF¢òò&V6÷&FVBf6R—2W7VÆÇ’6V6öæB÷"GvòÂ6òöâÖçVÂ6&BF†—2—0¢òòF†Ræ÷&ÖÂ÷WF6öÖRÂæ÷BâVFvR66S¢W2öb&Wv–æB†2æ÷v†W&RFòvð¢òòæB&&6²"6âöæÇ’ÖVâF†R—FVÒ&Vf÷&RâF†R6VV²&VÆ÷rFöW2&VÂv÷&°¢òòöæÇ’öâ&V6÷&F–ærÆöævW"F†âF†R7FWà¢–b‡F&vWBÂ’&WGW&â$T5õ4TTµõTäDU$dÄõp¢òò6ÖR&V6öæ–ærBF†R÷F†W"VæBÂæB—B—2F†Ræ÷&ÖÂ÷WF6öÖRF†W&RFöòà¢òò&¶–ærF†RVÆVÖVçBöâ—G2÷vâGW&F–öâv÷VÆBæ÷B6¶—ç—F†–æs¢Æ’‚¢òòg&öÒF†RVæB&Wv–æG2FòF†R7F'BÂ6ò—Bv÷VÆB&WÆ’F†Rf6R–ç7FVBà¢òð¢òòGW&F–öâ—2æâVçF–ÂF†R6Æ—w2ÖWFFF'&—fW2Âv†–6‚—2&VÀ¢òòv–æF÷r&F†W"F†â6÷&æW"(	BF†RVÆVÖVçB—2&R×ö–çFVBBæWrf–ÆP¢òò–ÖÖVF–FVÇ’&Vf÷&RWfW'’f6Râv—F‚æò¶æ÷vâVæBF†W&R—2æòv’FòFVÆÀ¢òò6VV²g&öÒ6¶—Â6òv—B&F†W"F†âwVW72à¢6öç7BGW"ÒæGW&F–öà¢–b‚çVÖ&W"æ—4f–æ—FR†GW"’’&WGW&âfÇ6P¢–b‡F&vWBâGW"’&WGW&â$T5õ4TTµôõdU$dÄõp¢G'’²æ7W'&VçEF–ÖRÒF&vWBÒ6F6‚…ò’²&WGW&âfÇ6RÐ¢òòF†R6Æ—Ö’Ç&VG’†fRf–æ—6†VB(	B&Wv–æF–ær–çFòÆöær&V6÷&F–æp¢òòGW&–ærF†R†öÆBF†BföÆÆ÷w2—B—2&WVW7BFò†V"—Bv–âÂæ÷B§W7@¢òòFòÖ÷fRÆ–†VBæö&öG’—2Æ—7FVæ–ærFòà¢–b‚v–æF÷rå÷&V5Æ•W6VB’²G'’²çÆ’‚’æ6F6‚‚‚’Óâ·Ò’Ò6F6‚…ò’·ÒÐ¢&WGW&âG'VP¢Ð¢6öç7B—BÒv–æF÷rå÷&V5Æ”7W'&VçD—FVÐ¢òò6VV²F†RÆ–æ¶VBf–FVòöæÇ’GW&–ær—G2Æ–&6²†6Râv†Vâ&V6÷&F–æw2÷ ¢òòF†R&V6ÆÂW6R÷vâÖçVÂ6&BÂ—G2&¶VBf–FVò7F—2WBà¢–b‚—BÇÂ…ö—4ÖçVÄ—FVÒ†—B’bbv–æF÷rå÷&V5Æ”Æ–æ¶VEf–FVò’’&WGW&âfÇ6P¢G'’°¢–b‚v–æF÷rç—EÆ–W"ÇÂG—Vöbv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖRÓÒvgVæ7F–öâr’&WGW&âfÇ6P¢6öç7B7W"Òv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖR‚’ÇÂ ¢òò&V6÷&FVB—FVÒ—26Æ–6RöbÆöævW"f–FVòÂ6ò—G2÷vâ7F'B—2F†P¢òòfÆö÷"(	B&Wv–æF–ær7B—Bv÷VÆBG&÷F†RW6W"–çFòVç&VÆFVBfö÷FvRà¢6öç7B6Æ—Ò÷'VçF–ÖU–÷UGV&T6Æ—†—B¢6öç7BÆòÒ6Æ—òçF–ÖU7F'Bóò‚†—BbbçVÖ&W"æ—4f–æ—FR‚¶—BçF–ÖU7F'B’’ò¶—BçF–ÖU7F'B¢¢6öç7B†’Ò6Æ—òçF–ÖTVæBóò‚†—BbbçVÖ&W"æ—4f–æ—FR‚¶—BçF–ÖTVæB’’ò¶—BçF–ÖTVæB¢–æf–æ—G’¢6öç7BF&vWBÒ7W"²FVÇF¢–b‡F&vWBÂÆò’&WGW&â$T5õ4TTµõTäDU$dÄõp¢–b‡F&vWBâ†’’&WGW&â$T5õ4TTµôõdU$dÄõp¢v–æF÷rç—EÆ–W"ç6VVµFò‡F&vWBÂG'VR¢&WGW&âG'VP¢Ò6F6‚…ò’²&WGW&âfÇ6RÐ§Ð ¢òò÷VâÖöFVÆW72F–ÆörÆ—7F–ærF†RVWVR–âÆ’÷&FW"v—F‚F†R7W'&Vç@¢òò—FVÒ†–v†Æ–v‡FVBâ6Æ–6²)kböâç’&÷rFò§V×F†W&RÖ–B×6W76–öâ(	BF†RÆö÷ ¢òò&VG2v–æF÷rå÷&V4ædv÷Fô–æFW‚öâ—G2æW‡B—FW&F–öâ&÷VæF'’æBF—7F6†W2à¦gVæ7F–öâ÷VåÆ––æuVWVTF–Æör‚’°¢6öç7BVWVRÒv–æF÷rå÷&V5Æ•VWVRÇÂµÐ¢–b‚VWVRæÆVæwF‚’²ÆW'B‚uVWVR—2V×G’âr“²&WGW&âÐ¢ÆWBFFÆrÒB‚r7Æ––æuVWVTF–Æörr¢–b‚FFÆræÆVæwF‚’FFÆrÒB‚sÆF—b–CÒ'Æ––æuVWVTF–Æör#ãÂöF—câr’æVæEFò‚v&öG’r¢6öç7B7W$–G‚Ò‡v–æF÷rå÷&V5Æ”–æFW‚ÓÒçVÆÂ’òÓ¢v–æF÷rå÷&V5Æ”–æFW€¢ÆWB‡FÖÂÒsÆF—b6Æ73Ò'BÖÆ—7B#âp¢VWVRæf÷$V6‚‚†—BÂ’’Óâ°¢6öç7B—47W"Ò’ÓÓÒ7W$–G€¢6öç7BÆ&VÂÒ—BæÖçVÀ¢ò	ù9ÒGµö6&EÆ–åFW‡B†—Bç6÷W&6R’çG&–Ò‚’ÇÂr†V×G’’wÖ ¢¢G¶—Bæ–GÒ+rG¶—BçF–ÖU7F'G×>(	2G¶—BçF–ÖTVæG×6 ¢6öç7B7V"Ò—BæÖçVÀ¢ò…ö6&EÆ–åFW‡B†—BçF&vWB’çG&–Ò‚’ÇÂrr¢¢†—Bå÷7Bbb—Bå÷rò"G¶—Bå÷7GÒ"(i"G¶—Bå÷wÖ¢rr¢‡FÖÂ³ÒÆF—b6Æ73Ò'B×&÷rG¶—47W"òrBÖ7W'&VçBr¢rwÒ"FFÖ–GƒÒ"G¶—Ò#à¢Ç7â6Æ73Ò'BÖçVÒ#âG¶’²ÓÂ÷7ãà¢ÆF—b6Æ73Ò'BÖ&öG’#à¢ÆF—b6Æ73Ò'B×FW‡B"F—FÆSÒ"GµòæW66R†Æ&VÂ—Ò#âGµòæW66R†Æ&VÂ—ÓÂöF—cà¢G·7V"òÆF—b6Æ73Ò'B×7V""F—FÆSÒ"GµòæW66R‡7V"—Ò#âGµòæW66R‡7V"—ÓÂöF—cæ¢rwÐ¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'B×Æ’"FFÖ–GƒÒ"G¶—Ò"F—FÆSÒ%Æ’g&öÒ†W&R"&–ÖÆ&VÃÒ%Æ’g&öÒ†W&R#î)kcÂö'WGFöãà¢ÂöF—cæ ¢Ò¢‡FÖÂ³ÒsÂöF—câp¢FFÆræ‡FÖÂ†‡FÖÂ ¢6öç7B§V×FòÒ†’’Óâ°¢–b‚çVÖ&W"æ—4–çFVvW"†’’ÇÂ’ÂÇÂ’ãÒVWVRæÆVæwF‚’&WGW&à¢v–æF÷rå÷&V4ædv÷Fô–æFW‚Ò¢ö–çFW''WE&V6÷&F–æuÆ–&6²‚¢G'’²FFÆræF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢Ð¢FFÆræöfb‚v6Æ–6²rÂrçB×Æ’r’æöâ‚v6Æ–6²rÂrçB×Æ’rÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢§V×Fò‡'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â’¢Ò¢FFÆræöfb‚v6Æ–6²rÂrçB×&÷rr’æöâ‚v6Æ–6²rÂrçB×&÷rrÂgVæ7F–öâ†R’°¢–b‚B†RçF&vWB’æ6Æ÷6W7B‚rçB×Æ’r’æÆVæwF‚’&WGW&à¢§V×Fò‡'6T–çB‚B‡F†—2’æFF‚v–G‚r’Â’¢Ò ¢6öç7B÷G2Ò°¢F—FÆS¢Æ–&6²VWVR‚G·VWVRæÆVæwF‡Ò—FVÒG·VWVRæÆVæwF‚ÓÓÒòrr¢w2wÒ–À¢v–GFƒ¢ÖF‚æÖ–âƒScÂB‡v–æF÷r’çv–GF‚‚’Ò3"’À¢†V–v‡C¢ÖF‚æÖ–âƒScÂB‡v–æF÷r’æ†V–v‡B‚’Òc’À¢ÖöFÃ¢fÇ6RÀ¢WFô÷Vã¢G'VP¢Ð¢–b‚FFÆræ†46Æ72‚wV’ÖF–ÆörÖ6öçFVçBr’’FFÆræF–Æör‚v÷F–öârÂ÷G2’æF–Æör‚v÷Vâr¢VÇ6RFFÆræF–Æör†÷G2¢òòf÷&6RF†Rw&W"&÷fRF†RÆ’÷fW&Æ’†&ææW"÷G&ç7÷'B6—B@¢òò.(	3B’â552†æFÆW2F†—2f–¦†2‚’'WBæ÷BWfW'’'&÷w6W ¢òò7W÷'G2—B–WBÂ6ò6WB–æÆ–æR2fÆÆ&6²à¢G'’²FFÆræF–Æör‚wv–FvWBr’æ772‚w¢Ö–æFW‚rÂ’Ò6F6‚…ò’·Ð¢òò67&öÆÂF†R7W'&VçB&÷r–çFòf–Wrà¢6WEF–ÖV÷WB‚‚’Óâ°¢6öç7BVÂÒFFÆræf–æB‚rçBÖ7W'&VçBr•³Ð¢–b†VÂbbVÂç67&öÆÄ–çFõf–Wr’G'’²VÂç67&öÆÄ–çFõf–Wr‡²&Æö6³¢v6VçFW"rÂ&V†f–÷#¢w6Öö÷F‚rÒ’Ò6F6‚…ò’·Ð¢ÒÂƒ§Ð§v–æF÷ræ÷VåÆ––æuVWVTF–ÆörÒ÷VåÆ––æuVWVTF–Æöp ¢òòÖ–æ–Ö—¦RF†RÆ’T’6òF†RW6W"6â–çFW&7Bv—F‚F†RÖ–âvRv†–ÆP¢òòF†R6W76–öâ—2W6VBâF†RÆ–&6²Æö÷¶VW2'Vææ–ær'W@¢òò÷6ÆVW&W7V7F–æuW6R²÷v—E•EVçF–ÄVæB&W7V7B÷&V5Æ•W6VBÂ6òF†W¢òòvöâwBGfæ6RVçF–Â&W7F÷&RâF†R&W7F÷&R–ÆÂ—2F†R6–ævÆRf—6–&ÆP¢òò†öö²&6²–çFòF†R6W76–öâà¢òòÆ–W"÷fW&Æ“¢F¶RF†R7W'&VçFÇ’×Æ––ær—FVÒw2v÷&BÂG&÷—B–çFòF†P¢òòÖ–â6V&6‚&÷‚ÂæBÖ–æ–Ö—6RF†R÷fW&Æ’6òF†R6V&6‚&W7VÇG2&P¢òòf—6–&ÆRâfÆÇ2&6²Fò—Bç6V&6…FW‡Bv†Vâ—FVÒçv÷&B—2'6VçB†öÆFW ¢òò6GW&W2Ö—76–ærF†Rf–VÆB’à¦gVæ7F–öâ÷6V&6„7W'&VçE&V5Æ•v÷&B‚’°¢6öç7B—BÒv–æF÷rå÷&V5Æ”7W'&VçD—FVÐ¢–b‚—B’&WGW&à¢6öç7BrÒvWE6VÆV7F–öåFW‡B‚’ÇÂ—Bçv÷&BÇÂ—Bç6V&6…FW‡BÇÂ—Bå÷p¢–b‚6VæEv÷&EFõ6V&6„&÷‚‡rÂ²6FVv÷'“¢öFWFV7D—FVÔ6FVv÷'’†—B’Ò’’&WGW&à¢ö6÷•FW‡EFô6Æ—&ö&B‡r’òòWFòÖ6÷’F†R6V&6†VBv÷&Bf÷"7F–ærVÇ6Wv†W&P¢G'’²Ö–æ–Ö—¦UÆ––æu&V6÷&F–ær‚’Ò6F6‚…ò’·Ð§Ð ¦gVæ7F–öâÖ–æ–Ö—¦UÆ––æu&V6÷&F–ær‚’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&à¢†–FTÖVF–&VÆFVD6öçF–æW"‚¢v–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBÒG'VP¢v–æF÷råöÆ7DÖ–æ–Ö—¦VE7GVG•f–WrÒwÆ–W"p¢òòW6RÆ–&6²6òVF–ò÷f–FVòFöW6âwB¶VWÆ––ærv†–ÆRF†RW6W"—0¢òòFö–ær6öÖWF†–ærVÇ6RöâF†RÖ–âvRà¢–b‚v–æF÷rå÷&V5Æ•W6VB’FövvÆUÆ––æu&V6÷&F–æuW6R‚¢–b‡7÷F–g”6Æ—2‡v–æF÷rå÷&V5Æ”7W'&VçD—FVÒ’æÆVæwF‚’7÷F–g•Æ–W"æ†–FR‚¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚w&V2×Æ––ærr’æFD6Æ72‚w&V2×Æ––ærÖÖ–æ–Ö—¦VBr¢6öç7B7W"Òv–æF÷rå÷&V5Æ”7W'&VçD—FVÐ¢6öç7BVWVRÒv–æF÷rå÷&V5Æ•VWVRÇÂµÐ¢6öç7B–G‚Ò‡v–æF÷rå÷&V5Æ”–æFW‚ÓÒçVÆÂ’ò¢v–æF÷rå÷&V5Æ”–æFW€¢B‚r7&V5Æ––æu&W7F÷&U–ÆÂç&V2×–ÆÂÖ6÷VçBr’çFW‡B†G¶–G‚²ÒòG·VWVRæÆVæwF‡Ö¢B‚r7&V5Æ––æu&W7F÷&U–ÆÂr’ç6†÷r‚§Ð¦gVæ7F–öâ&W7F÷&UÆ––æu&V6÷&F–ær‡²&W7VÖRÒG'VRÒÒ·Ò’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&à¢†–FTÖVF–&VÆFVD6öçF–æW"‚¢v–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBÒfÇ6P¢ö6÷fW$÷VäF–Æöw4f÷%7GVG’‚¢B‚v&öG’r’æFD6Æ72‚w&V2×Æ––ærr’ç&VÖ÷fT6Æ72‚w&V2×Æ––ærÖÖ–æ–Ö—¦VBr¢B‚r7&V5Æ––æu&W7F÷&U–ÆÂr’æ†–FR‚¢–b‡7÷F–g”6Æ—2‡v–æF÷rå÷&V5Æ”7W'&VçD—FVÒ’æÆVæwF‚’7÷F–g•Æ–W"ç6†÷r‡²fö7W3¢fÇ6RÒ¢òòWFò×&W7VÖRöâ&W7F÷&S¢Ö–æ–Ö—¦RW6VBÆ–&6²Â6ò&W7F÷&–ær6†÷VÆB–6²—@¢òò&6²W‡f–FVò²F†R–çFW"Ö—FVÒF–ÖW"Âv†–6‚F†Rv—BÆö÷2vFRöà¢òò÷&V5Æ•W6VB’â6ÖR6öFRF‚2F–ærF†R)kbþ(û‚'WGFöâÂÖF6†–ærF†P¢òò&7F–6RÖÖöFR&W7F÷&R&V†f–÷W"à¢–b‡&W7VÖRbbv–æF÷rå÷&V5Æ•W6VB’²G'’²FövvÆUÆ––æu&V6÷&F–æuW6R‚’Ò6F6‚…ò’·ÒÐ§Ð§v–æF÷ræÖ–æ–Ö—¦UÆ––æu&V6÷&F–ærÒÖ–æ–Ö—¦UÆ––æu&V6÷&F–æp§v–æF÷rç&W7F÷&UÆ––æu&V6÷&F–ærÒ&W7F÷&UÆ––æu&V6÷&F–æp ¦gVæ7F–öâ7v—F6…Æ–W%Fõ&7F–6R‚’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ærÇÂv–æF÷rå÷&7F–6T7F—fR’&WGW&à¢6öç7BVWVRÒv–æF÷rå÷&V5Æ•VWVP¢–b‚'&’æ—4'&’‡VWVR’ÇÂVWVRæÆVæwF‚’&WGW&à¢6öç7B÷2ÒçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’òv–æF÷rå÷&V4ædv÷Fô–æFW‚¢v–æF÷rå÷&V5Æ”–æFW€¢6öç7B6–ævÆRÒv–æF÷rå÷&V5Æ•&7F–6U6–ævÆP¢6öç7BFV×÷&'’Òv–æF÷rå÷&V5Æ•FV×÷&'¢÷&W7F÷&U&V6÷&F–æu&WÆ•7VVB‚¢Ö–æ–Ö—¦UÆ––æu&V6÷&F–ær‚¢ö–çFW''WE&V6÷&F–æuÆ–&6²‚¢–b‚6–ævÆR’÷6fUVWVT÷&FW"‡VWVRÂw&7F–6Rr¢÷Vå&7F–6TÖöFR‡²&W7VÖUVWVS¢²VWVRÂ÷2ÒÂ6–ævÆRÂFV×÷&'’Ò§Ð ¦gVæ7F–öâ7v—F6…&7F–6UFõÆ–W"‚’°¢–b‚v–æF÷rå÷&7F–6T7F—fR’&WGW&à¢6öç7BVWVRÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ’ç6Æ–6R‚¢6öç7B÷2Òv–æF÷rå÷&7F–6T–G€¢–b‚VWVU·÷5Ò’&WGW&à¢6öç7B6–ævÆRÒv–æF÷rå÷&7F–6U6–ævÆP¢6öç7BFV×÷&'’Òv–æF÷rå÷&7F–6UFV×÷&'¢6öç7B6ÖUFV×÷&'•VWVRÒFV×÷&'’bbv–æF÷rå÷&V5Æ•FV×÷&'’b`¢VWVRç6öÖR†—BÓâv–æF÷rå÷&V5Æ•VWVSòæ–æ6ÇVFW2†—B’¢6öç7Bv6V6öæG2Ò6ÖUFV×÷&'•VWVRòv–æF÷rå÷&V5Æ”v6V6öæG2¢çVÆÀ¢6öç7B6–ÆVçBÒö—4ÖçVÄ—FVÒ‡VWVU·÷5Ò’bbö6&D†5Æ–&ÆTÖVF–‡VWVU·÷5Ò¢6Æ÷6U&7F–6TÖöFR‚¢–b‚6–ævÆR’÷6fUVWVT÷&FW"‡VWVRÂwÆ’r¢–b‡v–æF÷rå÷Æ––æu&V6÷&F–ærbb'&’æ—4'&’‡v–æF÷rå÷&V5Æ•VWVR’’°¢òò¶VWF†R'Vææ–ærÆö÷w2'&’–FVçF—G’Â–æ6ÇVF–ær6†ævVB&7F–6P¢òò6‡VffÆR÷&FW"÷"VF—G3²†æB&6²W†7FÇ’F†R—FVÒæ÷röâ67&VVâà¢v–æF÷rå÷&V5Æ•VWVRæÆVæwF‚Ò ¢f÷"†6öç7B—FVÒöbVWVR’v–æF÷rå÷&V5Æ•VWVRçW6‚†—FVÒ¢v–æF÷rå÷&V5Æ•&7F–6U6–ævÆRÒ6–ævÆP¢v–æF÷rå÷&V5Æ•FV×÷&'’ÒFV×÷&'¢÷6WE6W76–öä—FVÔv†v6V6öæG2¢÷6WD÷Våf–Wr‚wÆ–W"r¢v–æF÷rå÷&V5Æ•6–ÆVçD—FVÒÒ6–ÆVçBòVWVU·÷5Ò¢çVÆÀ¢v–æF÷rå÷&V4æe&WVW7BÒçVÆÀ¢v–æF÷rå÷&V4ædv÷Fô–æFW‚Ò÷0¢v–æF÷rå÷&V5Æ•6Æ÷vF÷vâÒfÇ6P¢ö–çFW''WE&V6÷&F–æuÆ–&6²‚¢÷7F÷v6÷VçFF÷vâ‚¢öÇ•&V5Æ•W6R‡6–ÆVçBÂfÇ6R¢&W7F÷&UÆ––æu&V6÷&F–ær‡²&W7VÖS¢fÇ6RÒ¢ÒVÇ6R°¢Æ•&V6÷&F–ær‡²&W7VÖUVWVS¢²VWVRÂ÷2ÒÂ&7F–6U6–ævÆS¢6–ævÆRÂFV×÷&'’Âv6V6öæG2Â¶VW7W'&VçD—FVÓ¢G'VRÂ7F'EW6VC¢6–ÆVçBÒ¢Ð§Ð ¢òò6ÆVW×6Ö–ÆÆ—6V6öæG2Â'WB7G&WF6‚F†RvÆÂÖ6Æö6²v—Bv†VæWfW ¢òòF†RW6W"†2W6VBÆ–&6²6òF†R–çFW"Ö—FVÒvFöW6âwBF–6²F÷và¢òòv†–ÆRW6VBâ&–Ç2÷WB–bÆ–&6²—27F÷VBà¦gVæ7F–öâ÷6ÆVW&W7V7F–æuW6R†×2’°¢6öç7B6W76–öåFö¶VâÒv–æF÷rå÷&V5Æ•6W76–öåFö¶Và¢&WGW&âæWr&öÖ—6R‡&W6öÇfRÓâ°¢ÆWB&VÖ–æ–ærÒ×0¢ÆWBÆ7EF–6²Ò÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢6öç7B–BÒ6WD–çFW'fÂ‚‚’Óâ°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ærÇÂv–æF÷rå÷&V5Æ•6W76–öåFö¶VâÓÒ6W76–öåFö¶Vâ’²6ÆV$–çFW'fÂ†–B“²&WGW&â&W6öÇfR‚’Ð¢òò&–ÂF†Rv×6ÆVWöâç’æb&WVW7B6ò§V×–ærf–F†RVWVP¢òòF–Æör÷"&WböæW‡BfVVÇ2–ç7FçB&F†W"F†âv—F–ær÷WBF†Rvà¢–b‡v–æF÷rå÷&V4æe&WVW7BÇÂçVÖ&W"æ—4–çFVvW"‡v–æF÷rå÷&V4ædv÷Fô–æFW‚’’°¢6ÆV$–çFW'fÂ†–B“²&WGW&â&W6öÇfR‚¢Ð¢6öç7Bæ÷rÒ÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢6öç7BVÆ6VBÒæ÷rÒÆ7EF–6°¢Æ7EF–6²Òæ÷p¢–b‚v–æF÷rå÷&V5Æ•W6VB’&VÖ–æ–ærÓÒVÆ6V@¢–b‡&VÖ–æ–ærÃÒ’²6ÆV$–çFW'fÂ†–B“²&W6öÇfR‚’Ð¢ÒÂ#¢Ò§Ð ¦gVæ7F–öâ7F÷Æ––æu&V6÷&F–ær‚’°¢÷Æ–W%6W76–öåF–ÖV÷WBæ6æ6VÂ‚¢÷6WE6W76–öä—FVÔv†çVÆÂ¢7÷F–g•Æ–W"ç7F÷‚¢v–æF÷rå÷&V5f–FVôGFV×Còæ6æ6VÂ‚¢÷&W7F÷&U&V6÷&F–æu&WÆ•7VVB‚¢–b‡v–æF÷rå÷&V5Æ•FV×÷&'’’°¢v–æF÷rå÷&V5Æ•VWVRÒçVÆÀ¢v–æF÷rå÷&V5Æ”7W'&VçD—FVÒÒçVÆÀ¢v–æF÷rå÷&V5Æ•FV×÷&'’ÒfÇ6P¢Ð¢v–æF÷rå÷Æ––æu&V6÷&F–ærÒfÇ6P¢òò7F÷–ær•2WGF–ærF†Rf–Wrv’Â6òF†W&R—2æ÷F†–ærFò&W7F÷&Rà¢ö6ÆV$÷Våf–Wr‚¢÷÷7DÖVF–7FFR†fÇ6R¢÷7F÷&6¶w&÷VæD×W6–2‚¢v–æF÷rå÷&V5Æ•W6VBÒfÇ6P¢v–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBÒfÇ6P¢v–æF÷rå÷&V5Æ”vwV&BÒfÇ6P¢–b‡v–æF÷rå÷&V5Æ”vwV&D–B’²6ÆV$–çFW'fÂ‡v–æF÷rå÷&V5Æ”vwV&D–B“²v–æF÷rå÷&V5Æ”vwV&D–BÒçVÆÂÐ¢G'’²÷7F÷v6÷VçFF÷vâ‚’Ò6F6‚…ò’·Ð¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚w&V2×Æ––ær&V2×W6VB&V2×Æ––ærÖÖ–æ–Ö—¦VB&V2×Æ––ærÖÖçVÂ&V2×Æ––ærÖÖçVÂ×f–FVòr¢B‚r7&V5Æ––ætVF–òr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æt&ææW"r’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu7V'2r’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuv÷&Br’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuW6T'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu&Wd'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––ætæW‡D'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æuG&ç7÷'Br’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu6‡VffÆT'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––ætÆö÷'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––ætÖ–æ–Ö—¦T'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu6V&6„'Fâr’ç&VÖ÷fR‚¢B‚r7&V5Æ––æu&W7F÷&U–ÆÂr’ç&VÖ÷fR‚¢B‚r7&V5Æ”æeFö7Br’ç&VÖ÷fR‚¢G'’²v–æF÷rç7VV6…7–çF†W6—2bbv–æF÷rç7VV6…7–çF†W6—2æ6æ6VÂ‚’Ò6F6‚…ò’·Ð¢G'’°¢6öç7BBÒv–æF÷rå÷&V5EE0¢–b‡BbbBæ¶–æBÓÓÒvVF–òrbbBæVF–ò’²BæVF–òçW6R‚“²BæVF–òç7&2ÒrrÐ¢Ò6F6‚…ò’·Ð¢v–æF÷rå÷&V5EE2ÒçVÆÀ¢G'’²–b‡v–æF÷rå÷&V5Æ”ÖçVÄVF–ò’²v–æF÷rå÷&V5Æ”ÖçVÄVF–òçW6R‚“²v–æF÷rå÷&V5Æ”ÖçVÄVF–òç7&2ÒrrÒÒ6F6‚…ò’·Ð¢v–æF÷rå÷&V5Æ”ÖçVÄVF–òÒçVÆÀ¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢B‚r7FövvÆTÖVF–6öçF–æW"r’æ6Æ–6²‚’ ¢B‚r6ÖVF–&VÆFVD6öçF–æW"r’æ†–FR‚§Ð ¢òò)H)H)H&7F–6R†fÆ6†6&B’ÖöFR)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òò&7F–6RæWfW"WFò×7V·2öâ&WfVÃ¢Æ’&VG2F†Rf6R7W'&VçFÇ’öà¢òò67&VVâÂæB&W76–ærÆ’v–â7F÷2—Bâ6&B6†ævR6æ6VÇ27VV6ƒ°¢òòÖ–æ–Ö—¦–ærW6W2—BVçF–Â&W7F÷&Rà¦ÆWB÷&7F–6UGG2ÒçVÆÀ¦ÆWB÷&7F–6UGG4f6T¶W’ÒçVÆÀ¦gVæ7F–öâ÷7F÷&7F–6UGG2‚’°¢6öç7B7F—fRÒ÷&7F–6UGG0¢÷&7F–6UGG2ÒçVÆÀ¢÷&7F–6UGG4f6T¶W’ÒçVÆÀ¢–b†7F—fR’²G'’²7F—fRæ6æ6VÂ‚’Ò6F6‚…ò’·ÒÐ¢B‚r7&7F–6TÖöFRç&7F–6R×Æ’r’æGG"‚v&–×&W76VBrÂvfÇ6Rr§Ð¦gVæ7F–öâ÷FövvÆU&7F–6UGG2†—B’°¢–b‚ö6å7Vµ6–ÆVçD6&B†—B’’&WGW&à¢6öç7Bg&öçBÒv–æF÷rå÷&7F–6Tg&öçD—56÷W&6RÓÒfÇ6Ròw6÷W&6Rr¢wF&vWBp¢6öç7B¶W’Òv–æF÷rå÷&7F–6TfÆ—VBò†g&öçBÓÓÒw6÷W&6RròwF&vWBr¢w6÷W&6Rr’¢g&öç@¢–b…÷&7F–6UGG2’°¢òò6ÖRf6S¢Æ’FövvÆW27VV6‚öfbâF–ffW&VçBf6RgFW"&WfVÃ ¢òò6æ6VÂF†RöÆBf6RæB–ÖÖVF–FVÇ’7V²F†RæWvÇ’f—6–&ÆRç7vW"à¢6öç7B6ÖTf6RÒ÷&7F–6UGG4f6T¶W’ÓÓÒ¶W¢÷7F÷&7F–6UGG2‚¢–b‡6ÖTf6R’&WGW&à¢Ð¢6öç7BFW‡BÒ—E¶¶W•Ð¢–b‚FW‡B’&WGW&à¢6öç7B–G‚Òv–æF÷rå÷&7F–6T–G€¢6öç7BF6²Ò7VµGG2‡FW‡BÂ°¢ââåö6&E7VV6„÷F–öç2‚’À¢7–çFƒ¢v–æF÷rç7VV6…7–çF†W6—2ÂWGFW&æ6S¢v–æF÷rå7VV6…7–çF†W6—5WGFW&æ6RÀ¢Ææs¢ö6&EGG4Æö6ÆR†—BÂ¶W’’À¢&FS¢çVÖ&W"‡v–æF÷rå÷&7F–6UÆ–&6µ&FR’ÇÂ÷&VfW'&VE&7F–6U7VVB‚’À¢—47W'&VçC¢‚’Óâv–æF÷rå÷&7F–6T7F—fRb`¢v–æF÷rå÷&7F–6T–G‚ÓÓÒ–G‚b`¢v–æF÷rå÷&7F–6T6&G3òå¶–G…ÒÓÓÒ—BÀ¢Ò¢÷&7F–6UGG2ÒF6°¢÷&7F–6UGG4f6T¶W’Ò¶W¢B‚r7&7F–6TÖöFRç&7F–6R×Æ’r’æGG"‚v&–×&W76VBrÂwG'VRr¢F6²ç&öÖ—6Ræf–æÆÇ’‚‚’Óâ°¢–b…÷&7F–6UGG2ÓÓÒF6²’°¢÷&7F–6UGG2ÒçVÆÀ¢÷&7F–6UGG4f6T¶W’ÒçVÆÀ¢B‚r7&7F–6TÖöFRç&7F–6R×Æ’r’æGG"‚v&–×&W76VBrÂvfÇ6Rr¢Ð¢Ò§Ð ¦6öç7B÷&7F–6Uf–FVô7VW2Ò7&VFU&7F–6Uf–FVô7VW2‡°¢vWEÆ–W#¢‚’Óâv–æF÷rç—EÆ–W"À¢—5&VG“¢‚’Óâv–æF÷rç—EÆ–W%&VG’bbG—Vöbv–æF÷rç—EÆ–W#òæ7VUf–FVô'”–BÓÓÒvgVæ7F–öârÀ¢—47F—fS¢‚’Óâv–æF÷rå÷&7F–6T7F—fRÀ¢v—EVçF–À§Ò¦ÆWB÷&7F–6U&VæFW%Fö¶VâÒ ¦ÆWB÷&7F–6U6VV´GFV×BÒçVÆÀ¦gVæ7F–öâöæWu&7F–6Uf–FVõ&WVW7B‡²×WFRÒfÇ6RÂ¶VW7÷F–g’ÒfÇ6RÂ¶VWGG2ÒfÇ6RÒÒ·Ò’°¢÷&7F–6U6VV´GFV×Còæ6æ6VÂ‚¢–b‚¶VWGG2’÷7F÷&7F–6UGG2‚¢–b‚¶VW7÷F–g’’7÷F–g•Æ–W"ç7F÷‚¢v–æF÷råöÖçVÄ7VUFö¶VâÒ‡v–æF÷råöÖçVÄ7VUFö¶VâÇÂ’²¢–b‚v–æF÷rç—EÆ–W%&VG’’v–æF÷rå÷—E&VG”WF÷Æ•7W&W76VBÒG'VP¢&WGW&â÷&7F–6Uf–FVô7VW2æ–çfÆ–FFR‡²×WFRÒ§Ð¢òòV6‚6&B—26‡VffÆVBÆ–Æ—7B—FVÒ6†÷v–ærF†P¢òòÖF6†VB7V'F—FÆRÆ–æR–âF†R&g&öçB"ÆæwVvRÂ&WfVÂ'WGFöâf÷"F†P¢òò÷F†W"ÆæwVvRÂæBF†R–÷UGV&R6Æ—7VVB„äõBWFò×Æ–VB’BF†R—FVÒw0¢òòF–ÖU7F'Bâæf–vFR'’7v—RÂ'&÷r¶W—2Â÷"F†R&WböæW‡B'WGFöç2à¢òò÷G2çVWVS¢&RÖ'V–ÇB—FVÒ'&’†Rærâ7F'&VBÆ–æW2’Fò&7F–6R–ç7FVBö`¢òòF†R7W'&VçBÆ–Æ—7BâfÆÇ2&6²FòF†R7W'&VçBÆ–Æ—7Bv†VâöÖ—GFVBà¦gVæ7F–öâ÷Vå&7F–6TÖöFR†÷G2’°¢÷G2Ò÷G2ÇÂ·Ð¢òò'Vææ–ærFV6²—2æ÷B7F÷VB'’÷Væ–ær&7F–6R(	BF†R6W76–öâ7F—2Æ—fP¢òò6ò—B6â&R&W7VÖVB(	B'WB—B×W7Bæ÷B7F–ÆÂ&R6÷VæF–ærVæFW&æVF‚Âæ@¢òò&7F–6R6÷fW'2WfW'’6öçG&öÂF†B6÷VÆBW6R—BâW6–ærF‡&÷Vv‚F†P¢òò6W76–öâ†æ÷BF†RVÆVÖVçB’¶VW2F†RG&ç7÷'BÂF†RÖVF–6W76–öâæB&W7VÖP¢òòÆÂ–âw&VVÖVçBà¢G'’²÷6–ÆVæ6T÷F†W$VF–ò‚w&7F–6Rr’Ò6F6‚…ò’·Ð¢ÆWBVWVP¢ÆWB7F'D–G‚Ò ¢–b†÷G2ç&W7VÖUVWVRbb'&’æ—4'&’†÷G2ç&W7VÖUVWVRçVWVR’bb÷G2ç&W7VÖUVWVRçVWVRæÆVæwF‚’°¢òò&W7VÖRF‚(	BW6RF†R6fVBVWVRfW&&F–ÒÂ7F'BB6fVB–æFW‚à¢òò6¶—2F†R6‡VffÆR²7F'D—FVÒ&÷FF–öâ6–æ6RF†R6fVB÷&FW"•2F†P¢òò÷&FW"vRÆVgBöfb–âà¢VWVRÒ÷G2ç&W7VÖUVWVRçVWVRç6Æ–6R‚¢7F'D–G‚ÒÖF‚æÖ–â„ÖF‚æÖ‚ƒÂ÷G2ç&W7VÖUVWVRç÷2ÇÂ’ÂVWVRæÆVæwF‚Ò¢ÒVÇ6R°¢VWVRÒ'&’æ—4'&’†÷G2çVWVR’ò÷G2çVWVRç6Æ–6R‚’¢ö'V–ÆEÆ•VWVR‚vöfbr¢–b‚VWVRæÆVæwF‚’°¢ÆW'B†÷G2çVWVRòtæò7F'&VBÆ–æW2Fò&7F–6Râr¢tæò—FV×2Fò&7F–6R†ÆÂW†6ÇVFVCò’âr¢&WGW&à¢Ð¢òòÖF6‚Æ–W"w2÷&FW"6VÖçF–73¢&W7V7BF†R&V5Æ•6‡VffÆR6WGF–ærà¢òòFVfVÇBöfb(i"æGW&ÂÆ–Æ—7B÷&FW"Â6ÖR2Æ–W"v†Vâ6‡VffÆR—0¢òòöfbâF†R–â×&7F–6R6‡VffÆR'WGFöâ‡F÷&"’fÆ—2F†—26ÖR6WGF–ærà¢–b‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&V5Æ•6‡VffÆRbb÷G2ç6–ævÆRbb÷G2çFV×÷&'’’°¢÷6‡VffÆUVWVR‡VWVR¢Ð¢òò÷F–öæÂ7F'D—FVÒ&÷FF–öâ(	B&÷FFW2F†RVWVR6òF†R&WVW7FVB6&@¢òòÆæG2B–æFW‚âW6VB'’W"Ö—FVÒÆVæ6‚ö–çG2‡F†R&Wf–WrF–Æörw0¢òò%Æ’g&öÒF†—2—FVÒ"'WGFöâFöW6âwB–çfö¶R&7F–6RÂ'WB¶VW–ærF†P¢òòF‚7–ÖÖWG&–2v—F‚Æ•&V6÷&F–ær’à¢–b†÷G2ç7F'D—FVÒ’°¢6öç7B2Ò÷G2ç7F'D—FVÐ¢6öç7B“ÒVWVRæf–æD–æFW‚‡Óà¢bbå÷7BÓÓÒ2ç7Bbbå÷rÓÓÒ2çrbbåö–G‚ÓÓÒ2æ–G‚b`¢‡2ç&V4æÖRÓÒçVÆÂÇÂå÷&V4æÖRÓÓÒ2ç&V4æÖR’¢–b†“â’°¢6öç7B†VBÒVWVRç6Æ–6R†“’ÂF–ÂÒVWVRç6Æ–6RƒÂ“¢VWVRæÆVæwF‚Ò ¢'&’ç&÷F÷G—RçW6‚æÇ’‡VWVRÂ†VBæ6öæ6B‡F–Â’¢Ð¢Ð¢òò6æ6†÷Bf÷"gWGW&R&W7VÖR(	B6fVBgFW"6‡VffÆR÷&÷FFR6òF†P¢òò6fVB÷&FW"ÖF6†W2v†Bw2&÷WBFò&R&7F–6VBà¢–b‚÷G2ç6–ævÆR’÷6fUVWVT÷&FW"‡VWVRÂw&7F–6Rr¢Ð¢v–æF÷rå÷&7F–6T6&G2ÒVWVP¢v–æF÷rå÷&7F–6UFV×÷&'’Ò÷G2çFV×÷&'’ÇÂVWVRç6öÖR†—BÓâ—Bå÷FV×÷&'’¢v–æF÷rå÷&7F–6UFV×÷&'”÷&FW"Òv–æF÷rå÷&7F–6UFV×÷&'’òVWVRç6Æ–6R‚’¢çVÆÀ¢v–æF÷rå÷&7F–6T–G‚Ò7F'D–G€¢òò&W7F÷&RF—&V7F–öâFövvÆRg&öÒW'6—7FVB6WGF–æw2öâf—'7BVçG'’öbF†P¢òò6W76–öã²7V'6WVVçB&RÖ÷Vç2¶VWv†FWfW"F†RW6W"FövvÆVBFòà¢–b‡v–æF÷rå÷&7F–6Tg&öçD—56÷W&6RÓÒçVÆÂ’°¢6öç7B7F÷&VBÒv–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&7F–6Tg&öçD—56÷W&6P¢v–æF÷rå÷&7F–6Tg&öçD—56÷W&6RÒ‡7F÷&VBÓÒçVÆÂ’òG'VR¢7F÷&V@¢Ð¢v–æF÷rå÷&7F–6T7G„&Vf÷&RÒ ¢v–æF÷rå÷&7F–6T7G„gFW"Ò ¢v–æF÷rå÷&7F–6UÆ–&6µ&FRÒ÷&VfW'&VE&7F–6U7VVB‚¢v–æF÷rå÷&7F–6TfÆ—VBÒfÇ6P¢v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÒfÇ6P¢òòöæR6&Böâ—G2÷vâ†g&öÒF†R6V&6‚&W7VÇG2“¢æ÷B6W76–öââ—B—2æ÷@¢òò6‡VffÆVBÂæB—BÆVfW2F†RÆ–Æ—7Bw26fVB&W7VÖR÷&FW"æB÷6—F–öâ(	@¢òòæBF†R&V÷VâÖgFW"×&W7F'BÖ&¶W"(	BÆöæRâ6WB†W&RÂ7BWfW'’V&Ç¢òò&WGW&âÂ6ò&VgW6VB÷Vâ6ææ÷B6†ævRF†RfÆröbF†RöæRöâ67&VVâà¢v–æF÷rå÷&7F–6U6–ævÆRÒ÷G2ç6–ævÆP¢v–æF÷rå÷&7F–6T7F—fRÒG'VP¢÷&7F–6U6W76–öåF–ÖV÷WBç7F'B‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢÷6WD÷Våf–Wr‚w&7F–6Rr¢òòç’F–ÆörÆVgB÷Vâ&Vf÷&RF†—26÷fW&VBF†R67&VVâv÷VÆB&R&V†–æB—Bà¢ö6÷fW$÷VäF–Æöw4f÷%7GVG’‚¢òò&7F–6R÷vç2—G26öçG&öÇ2âF—66&BF†RÖ–â×vRæVÂw2÷Vâ7FFP¢òò6òÖ–æ–Ö—¦–ærö6Æ÷6–ær&7F–6R6ææ÷BVæ6÷fW"âVç&VÆFVB7VVBæVÂà¢†–FTÖVF–&VÆFVD6öçF–æW"‚ ¢ÆWBGÒB‚r7&7F–6TÖöFRr¢–b‚GæÆVæwF‚’°¢òòF†R6&B&V—25524B6&BÖfÆ—W#¢ç&7F–6RÖg&öçBÖf6R†öÆG2F†P¢òò6÷W&6R6–FR‡v÷&B²7G‚6öçG&öÇ2²6÷W&6RÆ–æW2²&WfVÂ'WGFöâ’Âæ@¢òòç&7F–6RÖ&6²Öf6R†öÆG2F†RF&vWBG&ç6ÆF–öââ–âvfÆ—r&WfVÂÖöFP¢òòvRFövvÆRæfÆ—VB6Æ72öâç&7F–6RÖfÆ—W"f÷"F†R&÷FFU’æ–Ó°¢òò–âv†–FRròv&÷F‚rÖöFW2F†R&6²Öf6R—2†–FFVâf–F—7Æ“¦æöæRæBF†P¢òòÆVv7’ç&7F–6RÖ&6²F—bVæFW"F†Rg&öçB†æFÆW2&WfVÂÖ&VÆ÷rÆ–÷WBà¢GÒB†ÆF—b–CÒ'&7F–6TÖöFR#à¢ÆF—b6Æ73Ò'&7F–6R×F÷&"#à¢Ç7â6Æ73Ò'&7F–6RÖ6÷VçB#ãÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖ–æfò"&–ÖÆ&VÃÒ%6†÷r—FVÒFWF–Ç2"F—FÆSÒ%6†÷r—FVÒFWF–Ç2"&–ÖW‡æFVCÒ&fÇ6R#î(K“Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×6‡VffÆR"&–ÖÆ&VÃÒ%6‡VffÆR"F—FÆSÒ%6‡VffÆR÷&FW""&–×&W76VCÒ&fÇ6R#ï	ùHÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×6WGF–æw2"&–ÖÆ&VÃÒ%&7F–6R6WGF–æw2"F—FÆSÒ%&WfVÂÖöFRòF—&V7F–öâòFVÆWFR"&–ÖW‡æFVCÒ&fÇ6R#î(ºóÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×6V&6‚"&–ÖÆ&VÃÒ%6V&6‚F†—2v÷&B"F—FÆSÒ%6V&6‚F†—2v÷&B†Ö–æ–Ö—¦W2’#ï	ùHãÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖÖ–æ–Ö—¦R"&–ÖÆ&VÃÒ$Ö–æ–Ö—¦R"F—FÆSÒ$Ö–æ–Ö—¦R#î(ÈCÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖ6Æ÷6R"&–ÖÆ&VÃÒ$6Æ÷6R&7F–6R"F—FÆSÒ$6Æ÷6R#î)ÉSÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×Æ–W"Ö'Fâ"&–ÖÆ&VÃÒ%7v—F6‚FòÆ–W""F—FÆSÒ%Æ’F†—2—FVÒ#âGµ÷7GVG”6öçG&öÄ–6öâ‚wÆ–W"rÂuÆ–W"r—ÓÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖ–æfò×æVÂ"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢ÆF—b6Æ73Ò'&7F–6RÖ–æfòÖ†VB#ãÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖ–æfòÖÖWF#ãÂöF—cà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6R×6WGF–æw2×æVÂ"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&¶W–&ö&B×6†÷'F7WG2Ö'Fâ#ä¶W–&ö&B6†÷'F7WG3Âö'WGFöãà¢ÆF—b6Æ73Ò'&7F–6R×6WGF–æw2×&÷r#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&7W×vRÖf–æB×7GVG’×G&–vvW"&7F–6RÖf–æB"&–ÖÆ&VÃÒ$f–æBöâvR"F—FÆSÒ$f–æBf—6–&ÆRFW‡BöâvR„7G&Âô6ÖB´b’"&–Ö6öçG&öÇ3Ò&7WvTf–æD&"#äf–æBöâvSÂö'WGFöãà¢ÂöF—cà¢ÆÆ&VÂ6Æ73Ò'&7F–6R×6WGF–æw2×&÷r#à¢Æ–çWBG—SÒ&6†V6¶&÷‚"6Æ73Ò'&7F–6R×7V¶÷fW"×FövvÆR#à¢Ç7ãå6†÷r7V¶÷fW#Â÷7ãà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ73Ò'&7F–6R×6WGF–æw2×&÷r#à¢Ç7â6Æ73Ò'&7F–6R×6WGF–æw2ÖÆ&Â#å7V¶÷fW"ÖöFSÂ÷7ãà¢Ç6VÆV7B6Æ73Ò'&7F–6R×7V¶÷fW"ÖÖöFR"&–ÖÆ&VÃÒ%7V¶÷fW"ÖöFR#à¢Æ÷F–öâfÇVSÒ'F¶W2#åF–ÖW7F×VBF¶W3Âö÷F–öãà¢Æ÷F–öâfÇVSÒ&Æö÷#äÆö÷6Æ—²ÆFW7BF¶SÂö÷F–öãà¢Â÷6VÆV7Cà¢ÂöÆ&VÃà¢ÆF—b6Æ73Ò'&7F–6R×6WGF–æw2×&÷r&7F–6R×7VVG2×&÷r#à¢ÆÆ&VÃãÇ7â6Æ73Ò'&7F–6R×6WGF–æw2ÖÆ&Â#å7VVB7–6ÆSÂ÷7ãà¢Æ–çWBG—SÒ'FW‡B"6Æ73Ò'&7F–6R×7VVG2Ö–çWB"&–ÖÆ&VÃÒ%7VVB7–6ÆR"Æ6V†öÆFW#Ò#ÂãsRÂãR#à¢ÂöÆ&VÃà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×7VVG2×6fR#å6fR7VVG3Âö'WGFöãà¢Ç6ÖÆÃä6öÖÖ×6W&FVB7VVG2Â–â6Æ–6²÷&FW"âW6RFV6–ÖÂö–çG2â–÷UGV&RW6W2F†R6Æ÷6W7B7VVB7W÷'FVB'’F†Rf–FVòãÂ÷6ÖÆÃà¢Ç7â6Æ73Ò'&7F–6R×7VVBÖ7GVÂ#ãÂ÷7ãà¢Ç7â6Æ73Ò'&7F–6R×7VVG2×7FGW2"&öÆSÒ'7FGW2#ãÂ÷7ãà¢ÂöF—cà¢ÆÆ&VÂ6Æ73Ò'&7F–6R×6WGF–æw2×&÷r#à¢Ç7â6Æ73Ò'&7F–6R×6WGF–æw2ÖÆ&Â#å&WfVÃÂ÷7ãà¢Ç6VÆV7B6Æ73Ò'&7F–6R×&WfVÂ×6VÆV7B#à¢Æ÷F–öâfÇVSÒ&fÆ—#äfÆ—FòF&vWCÂö÷F–öãà¢Æ÷F–öâfÇVSÒ&&÷F‚#å6†÷r&÷FƒÂö÷F–öãà¢Æ÷F–öâfÇVSÒ&†–FR#ä†–FRVçF–Â6Æ–6³Âö÷F–öãà¢Â÷6VÆV7Cà¢ÂöÆ&VÃà¢ÆF—b6Æ73Ò'&7F–6R×6WGF–æw2×&÷r#à¢Ç7â6Æ73Ò'&7F–6R×6WGF–æw2ÖÆ&Â#äF—&V7F–öãÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖF—""F—FÆSÒ$fÆ—v†–6‚ÆæwVvR—26†÷vâf—'7B#ãÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6R×6WGF–æw2×&÷r#à¢Ç7â6Æ73Ò'&7F–6R×6WGF–æw2ÖÆ&Â#ä—FVÓÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖVF—B"&–ÖÆ&VÃÒ$VF—BF†—26&B"F—FÆSÒ$VF—BF†—26&Bw2FW‡BÂ&V6÷&F–æw2æBÆ–æ²#î)ÈâVF—CÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×&WÆ6R"&–ÖÆ&VÃÒ%&WÆ6RF†—26&Bv—F‚F–ffW&VçBW†×ÆR"F—FÆSÒ%&WÆ6Rv—F‚F–ffW&VçBWFòÖ6GW&VBW†×ÆR#ï	øë"&WÆ6RW†×ÆSÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖFVÆWFR"&–ÖÆ&VÃÒ$FVÆWFRF†—2—FVÒg&öÒF†RÆ–Æ—7B"F—FÆSÒ$FVÆWFRF†—26&Bg&öÒF†RÆ–Æ—7B#ï	ùyFVÆWFRF†—26&CÂö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6R×&V2Ö&""7G–ÆSÒ&F—7Æ“¦æöæS²#ãÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖ6&B#à¢ÆF—b6Æ73Ò'&7F–6RÖfÆ—W"#à¢ÆF—b6Æ73Ò'&7F–6RÖf6R&7F–6RÖg&öçBÖf6R#à¢ÆF—b6Æ73Ò'&7F–6R×v÷&B#ãÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖ7G‚Ö7G&Â#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖ7G‚Ö&Vf÷&R"F—FÆSÒ%6†÷röæRÖ÷&RÆ–æR&Vf÷&R"&–ÖÆ&VÃÒ%6†÷röæRÖ÷&RÆ–æR&Vf÷&R#î(iûÈ³Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖ7G‚ÖgFW""F—FÆSÒ%6†÷röæRÖ÷&RÆ–æRgFW""&–ÖÆ&VÃÒ%6†÷röæRÖ÷&RÆ–æRgFW"#î(i>ûÈ³Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖ7G‚×&W6WB"F—FÆSÒ%&W6WBFòF†RÖF6†VBÆ–æRöæÇ’"&–ÖÆ&VÃÒ%&W6WB6öçFW‡B#î(k£Âö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖg&öçB#ãÂöF—cà¢ ¢ÆF—b6Æ73Ò'&7F–6RÖ&6²"7G–ÆSÒ&F—7Æ“¦æöæS²#ãÂöF—cà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖf6R&7F–6RÖ&6²Öf6R#à¢ÆF—b6Æ73Ò'&7F–6RÖ&6²×F&vWB#ãÂöF—cà¢ ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6RÖæb#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×&Wb"&–ÖÆ&VÃÒ%&Wf–÷W2Ž(i’"F—FÆSÒ%&Wf–÷W2Ž(i’#î(“Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×VæfÆ—"F—FÆSÒ$fÆ—6&B"&–ÖÆ&VÃÒ$fÆ—6&B#î(kcÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×Æ’"&–ÖÆ&VÃÒ%Æ’6Æ—"F—FÆSÒ%Æ’6Æ—#î)kcÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×7VVB"&–ÖÆ&VÃÒ$7–6ÆRÆ–&6²7VVB"F—FÆSÒ$7–6ÆRÆ–&6²7VVB#ã9sÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖæW‡B"&–ÖÆ&VÃÒ$æW‡BŽ(i"’"F—FÆSÒ$æW‡BŽ(i"’#î(£Âö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ73Ò'&7F–6R×&W7F÷&R#à¢Ç7â6Æ73Ò'&7F–6R×&W7F÷&RÖ6÷VçB#ãÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×&W7F÷&RÖ'Fâ"&–ÖÆ&VÃÒ%&W7F÷&R&7F–6R"F—FÆSÒ%&W7F÷&R#î(È3Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6R×&W7F÷&RÖ6Æ÷6R"&–ÖÆ&VÃÒ$6Æ÷6R&7F–6R"F—FÆSÒ$6Æ÷6R#î)ÉSÂö'WGFöãà¢ÂöF—cà¢ÂöF—cæ’æVæEFò‚v&öG’r ¢Gæöâ‚v6Æ–6²rÂrç&V2×FövvÆRrÂ÷&5&V5FövvÆR¢Gæöâ‚v6†ævRrÂrç&7F–6R×7V¶÷fW"ÖÖöFRrÂgVæ7F–öâ‚’°¢6öç7B&WVW7FVBÒF†—2çfÇVRÓÓÒvÆö÷p¢–b‚÷&5&V2ÇÂ÷&5&V2ç†6RÓÒv–FÆRr’°¢F†—2çfÇVRÒ÷&5&V3òæÆö÷òvÆö÷r¢wF¶W2p¢&WGW&à¢Ð¢–b‡&WVW7FVBÓÒ÷&5&V2æÆö÷’÷&5&V4Æö÷FövvÆR‚¢Ò¢Gæöâ‚v6Æ–6²rÂrç&V2ÖÆö÷×&WÆ’rÂ‚’Óâ²–b…÷&5&V3òæÆö÷bb÷&5&V2æÆö÷F¶R’÷&5&V4Æö÷6VV²…÷&5&V2’Ò¢Gæöâ‚v6Æ–6²rÂrç&V2Ö¶VWrÂ÷&5&V4¶VW¢Gæöâ‚v6Æ–6²rÂrç&V2ÖG&÷rÂ÷&5&V4F—66&B¢Gæöâ‚v6Æ–6²rÂrç&V2×F¶RrÂ÷&5&V4võFõF¶R¢Gæöâ‚wF÷V6‡7F'BÖ÷W6VF÷vârÂrç&V2×F¶RrÂ÷&5&V4†öÆE7F'B¢Gæöâ‚wF÷V6†Ö÷fRrÂrç&V2×F¶RrÂ÷&5&V4†öÆDÖ÷fR¢Gæöâ‚wF÷V6†VæBF÷V6†6æ6VÂÖ÷W6WWÖ÷W6VÆVfRrÂrç&V2×F¶RrÂ÷&5&V4†öÆDVæB¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖ6Æ÷6RrÂ6Æ÷6U&7F–6TÖöFR¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×&W7F÷&RÖ6Æ÷6RrÂ6Æ÷6U&7F–6TÖöFR¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖÖ–æ–Ö—¦RrÂÖ–æ–Ö—¦U&7F–6TÖöFR¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×6V&6‚rÂ÷6V&6„7W'&VçE&7F–6Uv÷&B¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×Æ–W"Ö'FârÂ7v—F6…&7F–6UFõÆ–W"¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×&W7F÷&RÖ'FârÂ&W7F÷&U&7F–6TÖöFR¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖFVÆWFRrÂöFVÆWFT7W'&VçE&7F–6T6&B¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×&WÆ6RrÂ÷&WÆ6T7W'&VçE&7F–6T6&B¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖVF—BrÂöVF—D7W'&VçE&7F–6T6&B¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖ–æfòrÂ÷FövvÆU&7F–6T–æfõæVÂ¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×6‡VffÆRrÂ÷FövvÆU&7F–6U6‡VffÆR¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×6WGF–æw2rÂ÷FövvÆU&7F–6U6WGF–æw5æVÂ¢Gæöâ‚v6†ævRrÂrç&7F–6R×7V¶÷fW"×FövvÆRrÂgVæ7F–öâ‚’°¢òò†–F–ær7V²÷fW"×W7BÇ6ò7F÷F†R7F—fRÆö÷–ær6÷W&6R÷F¶Rà¢òò÷F†W'v—6R†–FFVâÖöFR¶VW2Æ––ærWfVâF†÷Vv‚—G26öçG&öÇ2fæ—6‚à¢–b‚F†—2æ6†V6¶VBbb÷&5&V3òæÆö÷bb÷&5&V2ç†6RÓÓÒv–FÆRr’÷&5&V4Æö÷FövvÆR‚¢v–æF÷råö6WGF–æw2ç&7F–6U7V´÷fW"ÒF†—2æ6†V6¶V@¢6fT6WGF–æw2‚¢–b…÷&5&V2’²÷&5&V2çFö¶Vâ²³²÷&5&V2æv—F–ærÒçVÆÃ²÷&5&V2çvF6…÷2ÒçVÆÂÐ¢÷&VæFW%&7F–6U&V4&"‚¢Ò¢òòö–çFW"ÖF÷vâF—6Ö—76W2öâF÷V6‚2vVÆÂ2Ö÷W6RÂ–æ6ÇVF–ærF†R7F'@¢òòöb6&B67&öÆÂ÷7v—Râ¶VWF†RWfVçB–çF7Bf÷"F†R6&Bw2÷vâ7F–öã°¢òò6Æ–6²Ç6ò6÷fW'2¶W–&ö&B7F—fF–öâæB&öw&ÖÖF–26&B6Æ–6·2à¢Gæöâ‚wö–çFW&F÷vâ6Æ–6²rÂrç&7F–6RÖ6&BrÂö6Æ÷6U&7F–6UæVÇ2¢Gæöâ‚v6†ævRrÂrç&7F–6R×&WfVÂ×6VÆV7BrÂgVæ7F–öâ‚’°¢6öç7BbÒ7G&–ær‚B‡F†—2’çfÂ‚’ÇÂvfÆ—r¢–b…²vfÆ—rÂv&÷F‚rÂv†–FRuÒæ–æFW„öb‡b’Â’&WGW&à¢–b‚v–æF÷råö6WGF–æw2’v–æF÷råö6WGF–æw2Ò·Ð¢v–æF÷råö6WGF–æw2ç&7F–6U&WfVÄÖöFRÒ`¢G'’²6fT6WGF–æw2‚’Ò6F6‚…ò’·Ð¢òò&R×&VæFW"6òF†R&WfVÂÖÖöFR6†ævRF¶W2VffV7BöâF†Rf—6–&ÆR6&Bà¢÷&VæFW%&7F–6T6&B‚¢Ò¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×&WbrÂ‚’Óâ&7F–6Tæb‚Ó’¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖæW‡BrÂ‚’Óâ&7F–6Tæbƒ’¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×&WfVÂrÂ&WfVÅ&7F–6T6&B¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×VæfÆ—rÂ&WfVÅ&7F–6T6&B’òòFövvÆW2fÆ—&6°¢òòÖ÷W6RF÷V&ÆRÖ6Æ–6²×W7B6VÆV7Bv÷&BÂæ÷B&WÆ6RF†R6&Bf6Rà¢òòF÷V6‚F÷V&ÆR×F&VÖ–ç26öçfVæ–Væ6Röâ7W÷'FVBFWf–6W2à¢Gæöâ‚vF&Æ6Æ–6²rÂrç&7F–6RÖg&öçBÖf6RÂç&7F–6RÖ&6²Öf6RrÂgVæ7F–öâ†R’°¢–b†—5&7F–6UF÷V6„F÷V&ÆUF†Ræ÷&–v–æÄWfVçBÂÖF6„ÖVF–‚r‡ö–çFW#¢6ö'6R’r’æÖF6†W2’’&WfVÅ&7F–6T6&B‚¢Ò¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖF—"rÂFövvÆU&7F–6TF—"¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×Æ’rÂ‚’ÓâÆ•&7F–6T6Æ—‚’¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×7VVBrÂ7–6ÆU&7F–6UÆ–&6µ&FR¢Gæöâ‚v6Æ–6²rÂrç&7F–6R×7VVG2×6fRrÂ÷6fU&7F–6U7VVG2¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖ7G‚Ö&Vf÷&RrÂ‚’Óâ²v–æF÷rå÷&7F–6T7G„&Vf÷&R²³²÷&VæFW%&7F–6T6&B‚’Ò¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖ7G‚ÖgFW"rÂ‚’Óâ²v–æF÷rå÷&7F–6T7G„gFW"²³²÷&VæFW%&7F–6T6&B‚’Ò¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖ7G‚×&W6WBrÂ‚’Óâ²v–æF÷rå÷&7F–6T7G„&Vf÷&RÒ²v–æF÷rå÷&7F–6T7G„gFW"Ò²÷&VæFW%&7F–6T6&B‚’Ò¢òòVF—B7V'F—FÆRÆ–æRf–7&7F–6TÆ–æTVF—DF–Æör†¥VW'’T’F–Æör(	@¢òò6VR÷&7F–6T&Vv–äVF—B’â–æÆ–æRVF—F–ærv2&WÆ6VB&V6W6RF†P¢òòöâ×67&VVâ¶W–&ö&B6÷fW&VBF†R&÷GFöÒöbF†R6&BöâÖö&–ÆRà¢Gæöâ‚v6Æ–6²rÂrç&7F–6RÖÆ–æRÖVF—BrÂ÷&7F–6T&Vv–äVF—B ¢òò†÷&—¦öçFÂ7v—RòG&röâF†R6&C¢ÆVgB(i"æW‡BÂ&–v‡B(i"&WbâW6W0¢òòF÷V6‚ö–çFW"WfVçG2öæÇ“¢Ö÷W6RG&vv–ær×W7B6VÆV7Bv÷&G2–ç7FV@¢òòöbæf–vF–ærâF†R6&BföÆÆ÷w2F÷V6‚7v—RæBV—F†W"æf–vFW2÷"6æ0¢òò&6²â–væ÷&VBv†Vâ7F'F–æröââ–çFW&7F—fRVÆVÖVçB†VF—B&÷‚Â'WGFöâÀ¢òòFW‡F&V’6òF†÷6R¶VWv÷&¶–ærâF—&V7F–öâ—2Æö6¶VB–âöâf—'7BÖ÷fR6ð¢òòfW'F–6Â67&öÆÂ—6âwB†–¦6¶VBà¢6öç7B6&BÒGæf–æB‚rç&7F–6RÖ6&Br•³Ð¢–b†6&B’°¢ÆWB7‚ÒÂ7’ÒÂG&vv–ærÒfÇ6RÂFV6–FVBÒfÇ6RÂ†÷&—¦öçFÂÒfÇ6P¢6öç7BD…$U4‚ÒSP¢6öç7B6WGFÆRÒ†æ–ÖFR’Óâ°¢6&Bç7G–ÆRçG&ç6—F–öâÒæ–ÖFRòwG&ç6f÷&Òã‡2V6Rr¢væöæRp¢6&Bç7G–ÆRçG&ç6f÷&ÒÒrp¢–b†æ–ÖFR’6WEF–ÖV÷WB‚‚’Óâ²6&Bç7G–ÆRçG&ç6—F–öâÒrrÒÂ##¢Ð¢6&BæFDWfVçDÆ—7FVæW"‚wö–çFW&F÷vârÂ†R’Óâ°¢–b‚—5&7F–6UF÷V6„vW7GW&R†R’’&WGW&à¢–b‚B†RçF&vWB’æ6Æ÷6W7B‚rç&7F–6RÖVF—BÖ&÷‚Â'WGFöâÂFW‡F&VÂ–çWBÂr’æÆVæwF‚’²G&vv–ærÒfÇ6S²&WGW&âÐ¢7‚ÒRæ6Æ–VçEƒ²7’ÒRæ6Æ–VçE¢G&vv–ærÒG'VS²FV6–FVBÒfÇ6S²†÷&—¦öçFÂÒfÇ6P¢6&Bç7G–ÆRçG&ç6—F–öâÒvæöæRp¢Ò¢6&BæFDWfVçDÆ—7FVæW"‚wö–çFW&Ö÷fRrÂ†R’Óâ°¢–b‚G&vv–ær’&WGW&à¢6öç7BG‚ÒRæ6Æ–VçE‚Ò7‚ÂG’ÒRæ6Æ–VçE’Ò7¢–b‚FV6–FVB’°¢–b„ÖF‚æ'2†G‚’Â‚bbÖF‚æ'2†G’’Â‚’&WGW&à¢FV6–FVBÒG'VP¢†÷&—¦öçFÂÒÖF‚æ'2†G‚’âÖF‚æ'2†G’¢–b††÷&—¦öçFÂ’²G'’²6&Bç6WEö–çFW$6GW&R†Rçö–çFW$–B’Ò6F6‚…ò’·ÒÐ¢Ð¢–b††÷&—¦öçFÂ’°¢Rç&WfVçDFVfVÇB‚¢òòF†R6&B—26VçG&VBv—F‚G&ç6ÆFU‚‚ÓSR’–â552Â6òF†RG&p¢òòöfg6WB†2Fò&RÆ–W&VBöâF÷öbF†B&6Rà¢6&Bç7G–ÆRçG&ç6f÷&ÒÒG&ç6ÆFU‚†6Æ2‚ÓSR²G¶G‡×‚’– ¢Ð¢Ò¢6öç7BVæBÒ†R’Óâ°¢–b‚G&vv–ær’&WGW&à¢G&vv–ærÒfÇ6P¢6öç7BG‚ÒRæ6Æ–VçE‚Ò7‚ÂG’ÒRæ6Æ–VçE’Ò7¢–b††÷&—¦öçFÂbbÖF‚æ'2†G‚’âD…$U4‚bbÖF‚æ'2†G‚’âÖF‚æ'2†G’’¢ã"’°¢òò&7F–6Tæb&R×&VæFW'2F†R6&C²6ÆV"F†RG&ç6f÷&Ò6òF†RæWp¢òò6&B—26VçG&VB&F†W"F†â–æ†W&—F–ærF†RG&röfg6WBà¢&7F–6Tæb†G‚Âò¢Ó¢6WGFÆR†fÇ6R¢ÒVÇ6R°¢6WGFÆR‡G'VR¢Ð¢Ð¢6&BæFDWfVçDÆ—7FVæW"‚wö–çFW'WrÂVæB¢6&BæFDWfVçDÆ—7FVæW"‚wö–çFW&6æ6VÂrÂVæB¢Ð¢Ð¢B‚v&öG’r’æFD6Æ72‚w&7F–6RÖÖöFRr¢òòÇv—26ÆV"F†RÖ–æ–Ö—¦VB6Æ72öâ‡&RÒ–÷Vâ(	B&Wf–÷W26W76–öâÖ¢òò†fRÆVgBF†RæVÂ6öÆÆ6VBÂæBF†RDôÒ—2&WW6VB7&÷726W76–öç2à¢òòv—F†÷WBF†—2Â&RÖVçFW&–ær&7F–6RÖöFR†Rærâ&Wf–Wr(i"&7F–6R’v÷VÆ@¢òò&R×–âF†R•BÆ–W"'WBÆVfRF†RF÷&"ö6&Böæb†–FFVâà¢Gç&VÖ÷fT6Æ72‚vÖ–æ–Ö—¦VBr¢òò&VfÆV7B7W'&VçB6‡VffÆR7FFRöâF†RF÷Ö&"'WGFöâà¢÷&Vg&W6…&7F–6U6‡VffÆT'Fâ‚¢òòÆ—7FVâf÷"¶W–&ö&B6†÷rö†–FRöâÖö&–ÆR6òvR6âÆ–gBF†R6&B&÷fR—Bà¢–b‡v–æF÷rçf—7VÅf–Ww÷'Bbbv–æF÷rå÷&7F–6Uf–Ww÷'Ev—&VB’°¢v–æF÷rçf—7VÅf–Ww÷'BæFDWfVçDÆ—7FVæW"‚w&W6—¦RrÂööå&7F–6Uf–Ww÷'D6†ævR¢v–æF÷rçf—7VÅf–Ww÷'BæFDWfVçDÆ—7FVæW"‚w67&öÆÂrÂööå&7F–6Uf–Ww÷'D6†ævR¢v–æF÷rå÷&7F–6Uf–Ww÷'Ev—&VBÒG'VP¢Ð¢÷&VæFW%&7F–6T6&B‚§Ð§v–æF÷ræ÷Vå&7F–6TÖöFRÒ÷Vå&7F–6TÖöFP ¢òò–7GW&R–â6&B÷Vç2gVÆÂ67&VVâFò&R¦ööÖVC¢F†RvR—G6VÆb6ææ÷@¢òò&R–æ6‚×¦ööÖVBâ–â&7F–6RæB–âF†RÆ––ærf–WrÂv†–6‚&÷F‚6†÷r¢òò6&Bw2…DÔÂà¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr7&7F–6TÖöFRæ6&BÖ‡FÖÂ–ÖrÂ7&V5Æ––æu7V'2æ6&BÖ‡FÖÂ–ÖrrÂRÓâ°¢Rç&WfVçDFVfVÇB‚¢Rç7F÷&÷vF–öâ‚¢6öç7B–ÖrÒRæ7W'&VçEF&vW@¢÷Vä–ÖvUf–WvW"†–Öræ7W'&VçE7&2ÇÂ–Örç7&2Â–ÖræÇB§Ò ¦gVæ7F–öâ6Æ÷6U&7F–6TÖöFR‚’°¢÷&7F–6U6W76–öåF–ÖV÷WBæ6æ6VÂ‚¢–b‡v–æF÷rå÷&7F–6UFV×÷&'’’v–æF÷rå÷&7F–6T6&G2ÒµÐ¢6öç7BFV×÷&'’Òv–æF÷rå÷&7F–6UFV×÷&'¢v–æF÷rå÷&7F–6UFV×÷&'’ÒfÇ6P¢v–æF÷rå÷&7F–6UFV×÷&'”÷&FW"ÒçVÆÀ¢v–æF÷rå÷&7F–6T7F—fRÒfÇ6P¢–b‡FV×÷&'’bbv–æF÷rå÷&V5Æ•FV×÷&'’’7F÷Æ––æu&V6÷&F–ær‚¢÷&7F–6U&VæFW%Fö¶Vâ²°¢öæWu&7F–6Uf–FVõ&WVW7B‚¢òòF†R6&BÖ’†fR&VVâFVÆWFVB÷"6†ævVBv†–ÆR—Bv2÷Vâà¢–b‡v–æF÷rå÷&7F–6U6–ævÆR’°¢v–æF÷rå÷&7F–6U6–ævÆRÒfÇ6P¢G'’²÷&VæFW$ÖçVÅ6V&6…&W7VÇG2‚’Ò6F6‚…ò’·Ð¢Ð¢òòWfW'’v’÷WBöb&7F–6RÆæG2†W&R(	BF†R)ÉRÂW66RÂæBF†RFV6°¢òòV×G––ær(	BæBÆÂöbF†VÒÖVâF†Rf–Wrv2WBv’Â6òæöæRöbF†VÐ¢òò6†÷VÆB'&–ær—B&6²æW‡BÆVæ6‚à¢ö6ÆV$÷Våf–Wr‚¢v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÒfÇ6P¢v–æF÷rå÷&7F–6T6Æ—Fö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÇÂ’²¢–b‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"’²6ÆV$–çFW'fÂ‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"“²v–æF÷rå÷&7F–6T6Æ—F–ÖW"ÒçVÆÂÐ¢G'’²÷7F÷ÖçVÄVF–õ&Wf–Wr‚’Ò6F6‚…ò’·Ð¢òò6†F÷v–ær6W76–öâ&VÆöæw2FòF†R6&Böâ67&VVã²F†W&R—2æò6&Bæ÷rà¢G'’²÷&5&V4VæB‡G'VR’Ò6F6‚…ò’·Ð¢òò†–F–ærâÆVF–óâFöW2æ÷B6–ÆVæ6R—BÂæBF†RæVÂ—26†&VBv—F‚F†P¢òòÆ–W"(	BÆVfR—Bf—6–&ÆRæB6Æ÷6VB&7F–6R6W76–öâ¶VW26÷VæF–æp¢òò÷fW"F†RvRVæFW&æVF‚à¢G'’²÷6†÷u&7F–6TVF–õæVÂ†çVÆÂ’Ò6F6‚…ò’·Ð¢–b‡v–æF÷rçf—7VÅf–Ww÷'Bbbv–æF÷rå÷&7F–6Uf–Ww÷'Ev—&VB’°¢v–æF÷rçf—7VÅf–Ww÷'Bç&VÖ÷fTWfVçDÆ—7FVæW"‚w&W6—¦RrÂööå&7F–6Uf–Ww÷'D6†ævR¢v–æF÷rçf—7VÅf–Ww÷'Bç&VÖ÷fTWfVçDÆ—7FVæW"‚w67&öÆÂrÂööå&7F–6Uf–Ww÷'D6†ævR¢v–æF÷rå÷&7F–6Uf–Ww÷'Ev—&VBÒfÇ6P¢Ð¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚w&7F–6RÖÖöFRr¢B‚r7&7F–6TÖöFRr’ç&VÖ÷fR‚¢òò&W7F÷&Ræ÷&ÖÂÆ–&6²&FR(	B&7F–6R6Æ÷vF÷vâ6†÷VÆFâwB&ÆVVB–çFð¢òò&VwVÆ"6V&6‚×&W7VÇBò&V6÷&F–ærÆ–&6²gFW"F†R6W76–öâVæG2à¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FRbbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FR…÷&V6÷&F–æuf–FVõ&FR‚’’Ò6F6‚…ò’·Ð¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢÷&7F–6Uf–FVô7VW2ç&VÆV6T×WFR‚¢B‚r7FövvÆTÖVF–6öçF–æW"r’æ6Æ–6²‚’ §Ð§v–æF÷ræ6Æ÷6U&7F–6TÖöFRÒ6Æ÷6U&7F–6TÖöFP ¦gVæ7F–öâ&7F–6Tæb†F—"’°¢–b‚v–æF÷rå÷&7F–6T7F—fRÇÂv–æF÷rå÷&7F–6T6&G2ÇÂv–æF÷rå÷&7F–6T6&G2æÆVæwF‚’&WGW&à¢òòÆ—fR'&÷w6W"&ævW26âföÆÆ÷r&WÆ6VBFW‡B–çFòF†RæW‡B6&Bâ¢òò6ö×ÆWFVBæf–vF–öâF—66&G2F†RöÆB6&Bw26VÆV7F–öâ&Vf÷&R&VæFW&–ærà¢6öç7B6VÆV7F–öâÒv–æF÷rævWE6VÆV7F–öâ‚¢6öç7B6&BÒFö7VÖVçBçVW'•6VÆV7F÷"‚r7&7F–6TÖöFRç&7F–6RÖ6&Br¢–b†6&Bbb†6&Bæ6öçF–ç2‡6VÆV7F–öãòææ6†÷$æöFR’ÇÂ6&Bæ6öçF–ç2‡6VÆV7F–öãòæfö7W4æöFR’’’°¢6VÆV7F–öâç&VÖ÷fTÆÅ&ævW2‚¢Ð¢6öç7BâÒv–æF÷rå÷&7F–6T6&G2æÆVæwF€¢v–æF÷rå÷&7F–6T–G‚Ò‡v–æF÷rå÷&7F–6T–G‚²F—"²â’Rà¢òòæWr6&B7F'G2v—F†÷WBW‡G&6öçFW‡B÷"&WfVÆVBç7vW"âF†R6†÷6Và¢òò7VVB&VÆöæw2FòF†R6W76–öâæB—2¶WBà¢v–æF÷rå÷&7F–6T7G„&Vf÷&RÒ ¢v–æF÷rå÷&7F–6T7G„gFW"Ò ¢v–æF÷rå÷&7F–6UÆ–&6µ&FRÒ÷&VfW'&VE&7F–6U7VVB‚¢v–æF÷rå÷&7F–6TfÆ—VBÒfÇ6P¢÷&VæFW%&7F–6T6&B‚§Ð ¢òòF†R7VVB'WGFöâ7–6ÆW2öæÇ’F‡&÷Vv‚F†—2W'6öâw2÷&FW&VBÆ—7Bà¦gVæ7F–öâ÷&7F–6U7VVG2‚’²&WGW&â&7F–6U7VVG2‡v–æF÷råö6WGF–æw2ç&7F–6U7VVD÷F–öç2’Ð¦gVæ7F–öâ÷&VfW'&VE&7F–6U7VVB‚’°¢6öç7B÷F–öç2Ò÷&7F–6U7VVG2‚¢6öç7B&VfW'&VBÒçVÖ&W"‡v–æF÷råö6WGF–æw2çÆ–&6µ7VVBóòv–æF÷råö6WGF–æw2ç&7F–6UÆ–&6µ&FR¢&WGW&âçVÖ&W"æ—4f–æ—FR‡&VfW'&VB’bb&VfW'&VBãÒãbb&VfW'&VBÃÒBò&VfW'&VB¢÷F–öç5³Ð§Ð¦gVæ7F–öâ÷&7F–6Uf–FVõ&FR‚’°¢6öç7B&WVW7FVBÒçVÖ&W"‡v–æF÷rå÷&7F–6UÆ–&6µ&FR’ÇÂ÷&VfW'&VE&7F–6U7VVB‚¢ÆWBf–Æ&ÆRÒµÐ¢G'’²f–Æ&ÆRÒv–æF÷rç—EÆ–W"ævWDf–Æ&ÆUÆ–&6µ&FW2‚’Ò6F6‚…ò’·Ð¢&WGW&â7W÷'FVE&7F–6U7VVB‡&WVW7FVBÂf–Æ&ÆR§Ð¦gVæ7F–öâ÷6fU&7F–6U7VVG2‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢6öç7B÷F–öç2Ò'6U&7F–6U7VVG2‚Gæf–æB‚rç&7F–6R×7VVG2Ö–çWBr’çfÂ‚’¢–b‚÷F–öç2’°¢Gæf–æB‚rç&7F–6R×7VVG2×7FGW2r’çFW‡B‚tVçFW"7VVG2g&öÒãFòBÂ6W&FVB'’6öÖÖ2†RærâÂãsRÂãR’âr¢&WGW&à¢Ð¢v–æF÷råö6WGF–æw2ç&7F–6U7VVD÷F–öç2Ò÷F–öç0¢–b‚÷F–öç2æ–æ6ÇVFW2‡v–æF÷rå÷&7F–6UÆ–&6µ&FR’’v–æF÷rå÷&7F–6UÆ–&6µ&FRÒ÷F–öç5³Ð¢v–æF÷råö6WGF–æw2ç&7F–6UÆ–&6µ&FRÒv–æF÷rå÷&7F–6UÆ–&6µ&FP¢v–æF÷råö6WGF–æw2çÆ–&6µ7VVBÒv–æF÷rå÷&7F–6UÆ–&6µ&FP¢B‚r7Æ–&6µ7VVBr’çfÂ‡v–æF÷rå÷&7F–6UÆ–&6µ&FR¢6fT6WGF–æw2‚¢Gæf–æB‚rç&7F–6R×7VVG2Ö–çWBr’çfÂ†÷F–öç2æ¦ö–â‚rÂr’¢Gæf–æB‚rç&7F–6R×7VVG2×7FGW2r’çFW‡B‚u6fVBr¢öÇ•&7F–6U7VVB‚§Ð¦gVæ7F–öâ7–6ÆU&7F–6UÆ–&6µ&FR‚’°¢v–æF÷rå÷&7F–6UÆ–&6µ&FRÒæW‡E&7F–6U7VVB‡v–æF÷rå÷&7F–6UÆ–&6µ&FRÂ÷&7F–6U7VVG2‚’¢v–æF÷råö6WGF–æw2ç&7F–6UÆ–&6µ&FRÒv–æF÷rå÷&7F–6UÆ–&6µ&FP¢v–æF÷råö6WGF–æw2çÆ–&6µ7VVBÒv–æF÷rå÷&7F–6UÆ–&6µ&FP¢B‚r7Æ–&6µ7VVBr’çfÂ‡v–æF÷rå÷&7F–6UÆ–&6µ&FR¢6fT6WGF–æw2‚¢öÇ•&7F–6U7VVB‚§Ð¦gVæ7F–öâöÇ•&7F–6U7VVB‚’°¢÷WFFU&7F–6U7VVD'Fâ‚¢G'’°¢–b‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"bbv–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FR’°¢v–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FR…÷&7F–6Uf–FVõ&FR‚’¢Ð¢Ò6F6‚…ò’·Ð§Ð¦gVæ7F–öâ÷WFFU&7F–6U7VVD'Fâ‚’°¢6öç7B&WVW7FVBÒçVÖ&W"‡v–æF÷rå÷&7F–6UÆ–&6µ&FR’ÇÂ÷&VfW'&VE&7F–6U7VVB‚¢6öç7B7GVÂÒ÷&7F–6Uf–FVõ&FR‚¢6öç7BF—FÆRÒ7–6ÆR7VVG3¢Gµ÷&7F–6U7VVG2‚’æ¦ö–â‚r(i"r—Ü9v°¢†7GVÂÓÒ&WVW7FVBòâF†—2f–FVòW6W2G¶7GVÇÜ9rÂF†R6Æ÷6W7B7W÷'FVB7VVBFòG·&WVW7FVGÜ9ræ¢rr¢B‚r7&7F–6TÖöFRç&7F–6R×7VVBr’çFW‡B†G·&WVW7FVGÜ9v’æGG"‚wF—FÆRrÂF—FÆR¢B‚r7&7F–6TÖöFRç&7F–6R×7VVBÖ7GVÂr’çFW‡B†7GVÂÓÒ&WVW7FVBòF†—2f–FVó¢G¶7GVÇÜ9v¢rr§Ð ¦gVæ7F–öâvWE6VÆV7F–öåFW‡B‚’°¢ÆWBFW‡BÒ"#°¢–b‡v–æF÷rævWE6VÆV7F–öâ’°¢FW‡BÒv–æF÷rævWE6VÆV7F–öâ‚’çFõ7G&–ær‚“°¢ÒVÇ6R–b†Fö7VÖVçBç6VÆV7F–öâbbFö7VÖVçBç6VÆV7F–öâçG—RÒ$6öçG&öÂ"’°¢FW‡BÒFö7VÖVçBç6VÆV7F–öâæ7&VFU&ævR‚’çFW‡C°¢Ð¢&WGW&âFW‡C°§Ð ¢òò6öÆÆ6RF†R&7F–6RT’FòF–ç’–ÆÂ6òF†RW6W"6â–çFW&7Bv—F‚F†P¢òòvRVæFW&æVF‚v—F†÷WBÆ÷6–ær÷6—F–öââF†R&W7F÷&R–ÆÂ—26†÷vâ–â—G0¢òòÆ6S²WfW'—F†–ærVÇ6R‡F÷&"Â6&BÂæbÂ–ææVB•BÆ–W"Â†–FFVâÖ–à¢òòT’’—2F¶VâF÷vâVçF–Â&W7F÷&VBà¢òð¢òòG&÷–ær&öG’ç&7F–6RÖÖöFR—2v†Bv—fW2F†RÖ–âf–Wr&6²(	BF†B6Æ70¢òò—2v†B†’–ç2F†R•BÆ–W"FòF†RF÷öbF†Rf–Ww÷'BÂ†"’†–FW0¢òò6Ö–ä6öçG&öÄ–çWG2ò7fö6'VÆ'•&W7VÇBò7&W7VÇBò6ÖVF–&VÆFVD6öçF–æW"à¢òòW6RF†R6Æ—Föò6òVF–òFöW6âwB¶VWÆ––ærv†–ÆRF†RW6W"—2Fö–æp¢òò6öÖWF†–ærVÇ6Rà¢òò&7F–6R÷fW&Æ“¢F¶RF†R7W'&VçB6&Bw2v÷&BÂG&÷—B–çFòF†RÖ–à¢òò6V&6‚&÷‚ÂF†VâÖ–æ–Ö—6Râ6ÖR&V†f–÷W"2F†RÆ–W"w2	ùHâ'WGFöâà¦gVæ7F–öâ÷6V&6„7W'&VçE&7F–6Uv÷&B‚’°¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—B’&WGW&à¢6öç7BrÒvWE6VÆV7F–öåFW‡B‚’ÇÂ—Bçv÷&BÇÂ—Bç6V&6…FW‡BÇÂ—Bå÷p¢–b‚6VæEv÷&EFõ6V&6„&÷‚‡rÂ²6FVv÷'“¢öFWFV7D—FVÔ6FVv÷'’†—B’Ò’’&WGW&à¢ö6÷•FW‡EFô6Æ—&ö&B‡r’òòWFòÖ6÷’F†R6V&6†VBv÷&Bf÷"7F–ærVÇ6Wv†W&P¢G'’²Ö–æ–Ö—¦U&7F–6TÖöFR‚’Ò6F6‚…ò’·Ð§Ð ¦gVæ7F–öâÖ–æ–Ö—¦U&7F–6TÖöFR‚’°¢–b…÷&7F–6UGG2’÷&7F–6UGG2çW6R‚¢òò†–F–ærâÆVF–óâFöW2æ÷B6–ÆVæ6R—BÂæBÖ–æ–Ö—6–ær†–FW2F†RæVÂ'¢òòG&÷–ærF†R&öG’6Æ72(	BF†R6ÖRG&6Æ÷6–ærF†Rf–Wr†2Fòfö–Bà¢G'’²÷7F÷&7F–6TVF–ò‚’Ò6F6‚…ò’·Ð¢G'’²÷7F÷ÖçVÄVF–õ&Wf–Wr‚’Ò6F6‚…ò’·Ð¢–b‚v–æF÷rå÷&7F–6T7F—fR’&WGW&à¢v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÒG'VP¢v–æF÷råöÆ7DÖ–æ–Ö—¦VE7GVG•f–WrÒw&7F–6Rp¢†–FTÖVF–&VÆFVD6öçF–æW"‚¢B‚r7&7F–6TÖöFRr’æFD6Æ72‚vÖ–æ–Ö—¦VBr¢B‚v&öG’r’ç&VÖ÷fT6Æ72‚w&7F–6RÖÖöFRr¢òò6æ6VÂç’'Vææ–ær7F÷×vF6†W"6ò—BFöW6âwBf—&RöâF†R&W7F÷&VB6Æ— ¢òòv—F‚7FÆR7FFRÂæBW6RF†RÆ–W"à¢v–æF÷rå÷&7F–6T6Æ—Fö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÇÂ’²¢–b‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"’²6ÆV$–çFW'fÂ‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"“²v–æF÷rå÷&7F–6T6Æ—F–ÖW"ÒçVÆÂÐ¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢6öç7B7÷F–g’Ò7÷F–g”6Æ—2‡v–æF÷rå÷&7F–6T6&G3òå·v–æF÷rå÷&7F–6T–G…Ò’æÆVæwF‚â ¢–b‡7÷F–g’’7÷F–g•Æ–W"æ†–FR‚¢òò&²F¶R2vVÆÂ2—G26÷W&6R6Æ—â&V6÷&F–ærf–æ—6†W22à¢òòVæ¶WBF¶S²æV—F†W"—G2&WÆ’æ÷"F†RÖ–7&÷†öæR'Vç2&V†–æBF†RvRà¢–b…÷&5&V2’°¢–b…÷&5&V2ç†6RÓÓÒw7F'F–ærr’÷&5&V46æ6VÄ6GW&R…÷&5&V2¢÷&5&V2çFö¶Vâ²°¢–b…÷&5&V2æVF–ò’²G'’²÷&5&V2æVF–òçW6R‚’Ò6F6‚…ò’·Ò÷&5&V2æVF–òÒçVÆÂÐ¢–b…÷&5&V2ç†6RÓÓÒwÆ–&6²r’÷&5&V2ç†6RÒv–FÆRp¢–b…÷&5&V2ç†6RÓÓÒw&V6÷&F–ærr’°¢–b…÷&5&V2æÆö÷’÷&5&V4Æö÷7F÷‚¢VÇ6R÷&5&V57F÷‚¢Ð¢òòÖ–æ–Ö—¦VBf–Wr×W7Bæ÷B¶VWÆö÷–ær÷"FÆ¶–ær&V†–æBF†RÖ–âvRà¢÷&5&V2æÆö÷ÒfÇ6P¢÷&5&V4Æö÷6ÆV$VF–ò…÷&5&V2¢–b…÷&5&V2æÆö÷F¶R’öFVÆWFU7V´÷fW$VF–ò…÷&5&V2æÆö÷F¶RçW&Â¢÷&5&V2æÆö÷F¶RÒçVÆÀ¢–b…÷&5&V2æÆö÷6VVµF–ÖW"’6ÆV%F–ÖV÷WB…÷&5&V2æÆö÷6VVµF–ÖW"¢÷&5&V2æÆö÷6VV¶–ærÒfÇ6P¢÷&VæFW%&7F–6U&V4&"‚¢Ð¢öæWu&7F–6Uf–FVõ&WVW7B‡²¶VW7÷F–g“¢7÷F–g’Â¶VWGG3¢G'VRÒ¢÷&7F–6Uf–FVô7VW2ç&VÆV6T×WFR‚¢÷WFFU&7F–6U&W7F÷&T6÷VçB‚¢B‚r7FövvÆTÖVF–6öçF–æW"r’æ6Æ–6²‚’ §Ð¦gVæ7F–öâ&W7F÷&U&7F–6TÖöFR‚’°¢òòæ÷F†–ærFò&W7F÷&Röæ6R&7F–6R†2&VVâ6Æ÷6VB(	B7&7F–6TÖöFR—2vöæR'¢òòF†VâÂæB&RÖFF–ærF†R&öG’6Æ72v÷VÆB†–FRF†R6V&6‚T’&V†–æBf–Wp¢òòF†BæòÆöævW"W†—7G2Âv—F‚æòf—6–&ÆRv’&6²âW‡÷'FVBÂ6ò—B6â&P¢òò6ÆÆVBg&öÒ÷WG6–FRF†R'WGFöâF†Bæ÷&ÖÆÇ’wV&çFVW2F†—2à¢–b‚v–æF÷rå÷&7F–6T7F—fR’&WGW&à¢†–FTÖVF–&VÆFVD6öçF–æW"‚¢v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÒfÇ6P¢B‚r7&7F–6TÖöFRr’ç&VÖ÷fT6Æ72‚vÖ–æ–Ö—¦VBr¢B‚v&öG’r’æFD6Æ72‚w&7F–6RÖÖöFRr¢òòF†R÷fW&Æ’—2&6²÷fW"ç—F†–ærF†Bv2÷VæVBv†–ÆR—Bv2&¶VBà¢ö6÷fW$÷VäF–Æöw4f÷%7GVG’‚¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—B’&WGW&à¢–b…÷&7F–6UGG2’²÷&7F–6UGG2ç&W7VÖR‚“²&WGW&âÐ¢–b‡7÷F–g”6Æ—2†—B’æÆVæwF‚’²7÷F–g•Æ–W"ç6†÷r‡²fö7W3¢fÇ6RÒ“²&WGW&âÐ¢òòÖçVÂ6&Bw2Æ–æ¶VB–÷UGV&Rf–FVò×W7B&R&RÖ7VVBB—G2÷và¢òòF–ÖW7F×v†Vâ&7F–6R—2&W7F÷&VBâö7VTÖçVÄ6&Ef–FVòW6W2F†P¢òòvVæW&ÂÖVF–ÆöFW"‡v†–6‚Ö’&VÆöBöWF÷Æ’g&öÒ“²&7F–6R†0¢òòwV&FVBÂW6VB7VUf–FVô'”–BF‚FW6–væVBf÷"F†—2W†7BG&ç6—F–öâà¢–b…ö—4ÖçVÄ—FVÒ†—B’’°¢6öç7Bf–FVòÒöÖçVÄ6&Ef–FVò†—B¢–b‡f–FVò’°¢6öç7B&WVW7BÒöæWu&7F–6Uf–FVõ&WVW7B‡²×WFS¢G'VRÒ¢ö7VU&7F–6Uf–FVò‡f–FVòÂ&WVW7B’æ6F6‚†RÓâ6öç6öÆRçv&â‚w&7F–6S¢&W7F÷&RÖçVÂf–FVòf–ÆVBrÂR’¢Ð¢&WGW&à¢Ð§Ð¦gVæ7F–öâ÷WFFU&7F–6U&W7F÷&T6÷VçB‚’°¢6öç7B6&G2Òv–æF÷rå÷&7F–6T6&G2ÇÂµÐ¢B‚r7&7F–6TÖöFRç&7F–6R×&W7F÷&RÖ6÷VçBr’çFW‡B†G²‡v–æF÷rå÷&7F–6T–G‚ÇÂ’²ÒòG¶6&G2æÆVæwF‡Ö§Ð§v–æF÷ræÖ–æ–Ö—¦U&7F–6TÖöFRÒÖ–æ–Ö—¦U&7F–6TÖöFP§v–æF÷rç&W7F÷&U&7F–6TÖöFRÒ&W7F÷&U&7F–6TÖöFP§v–æF÷ræ7–6ÆU&7F–6UÆ–&6µ&FRÒ7–6ÆU&7F–6UÆ–&6µ&FP ¢òòW6‚F†R&7F–6R6&BæB&÷GFöÒæb&÷fRF†Röâ×67&VVâ¶W–&ö&Bv†–ÆR—@¢òò—2÷VââF†Rf—7VÅf–Ww÷'B’&W÷'G2F†Rf–Ww÷'B6—¦RÔ”åU2F†P¢òò¶W–&ö&BÂ6òF†RF–ffW&Væ6Rg2v–æF÷ræ–ææW$†V–v‡B—2F†R¶W–&ö&Bw0¢òò†V–v‡B(	BvRW6RF†BFò'V×F†R6&Bw2&÷GFöÖfÇVRà¦gVæ7F–öâööå&7F–6Uf–Ww÷'D6†ævR‚’°¢–b‚v–æF÷rå÷&7F–6T7F—fR’&WGW&à¢6öç7BgbÒv–æF÷rçf—7VÅf–Ww÷'@¢–b‚gb’&WGW&à¢6öç7B¶W–&ö&BÒÖF‚æÖ‚ƒÂÖF‚ç&÷VæB‡v–æF÷ræ–ææW$†V–v‡BÒgbæ†V–v‡BÒgbæöfg6WEF÷’¢6öç7BGÒB‚r7&7F–6TÖöFRr¢òòöæÇ’7Bv†VâF†R¶W–&ö&B—26ÆV&Ç’÷Vâ†'&÷w6W"6‡&öÖRÆöæRW7VÆÇ¢òò66÷VçG2f÷"(šBc‚öb–ç6WB’â÷F†W'v—6R&W7F÷&RF†RFVfVÇG2à¢6öç7B÷VâÒ¶W–&ö&Bâƒ ¢6öç7BÆ–gD6&BÒ÷Vâò†¶W–&ö&B²b’²w‚r¢rp¢6öç7BÆ–gDæbÒ÷Vâò†¶W–&ö&B²‚’²w‚r¢rp¢Gæf–æB‚rç&7F–6RÖ6&Br’æ772‚v&÷GFöÒrÂÆ–gD6&B¢Gæf–æB‚rç&7F–6RÖæbr’æ772‚v&÷GFöÒrÂÆ–gDæb§Ð§v–æF÷råööå&7F–6Uf–Ww÷'D6†ævRÒööå&7F–6Uf–Ww÷'D6†ævP¢òòFVÆWFRF†R6&B7W'&VçFÇ’6†÷vâ–â&7F–6Rg&öÒ—G26÷W&6RÆ–Æ—7Bà¢òò&VÖ÷fW2F†RÖF6†–ær—FVÒf–÷&VÖ÷fUVWVT—FVÒ‡6òf—'GVÂÆ–Æ—7G2æ@¢òòÆö÷ÒvÆÂr7&÷72×Æ–Æ—7BVWVW2ÆÂv÷&²’ÂG&÷2—Bg&öÒF†RÆ—fP¢òò&7F–6RVWVRÂæBGfæ6W2FòF†RæW‡B6&B†÷"6Æ÷6W2&7F–6R–bF†P¢òòVWVR—2æ÷rV×G’’âf÷"ÖçVÂ6&G2v—F‚âGF6†VBÆö6ÂVF–ð¢òò&V6÷&F–ær†ÖVF–W&ÃÖf–ÆS¢òþ(
b’ÂFVÆWFW2F†RVæFW&Ç––ærVF–òf–ÆRf–F†P¢òòVF–ô'&–FvR6ò—BFöW6âwBÆV²–âF†R†÷7Bw27F÷&vRâÆ–Æ—7B×6–FP¢òò5%Bö–æFW‚f–ÆW2&RäõBF÷V6†VB(	BF†÷6R&RÖævVBf–F†RÖævP¢òòF–Æöw2Âæ÷B'’6&B&VÖ÷fÂà¢òò&WÆ6RF†R7W'&VçB†WFòÖ6GW&VB’&7F–6R6&Bv—F‚F–ffW&VçB5%@¢òòW†×ÆRöbF†R6ÖRv÷&B(	B6ÖR–6¶W"2F†R&Wf–WrF–ÆörâÆ–W2FòF†P¢òò—FVÒw2÷vâÆ–Æ—7B†—Bå÷&V4æÖR’æB&Vg&W6†W2F†Rf—6–&ÆR6&B–âÆ6Rà¦gVæ7F–öâ÷&WÆ6T7W'&VçE&7F–6T6&B‚’°¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—B’&WGW&à¢–b…ö—4ÖçVÄ—FVÒ†—B’’²ÆW'B‚tÖçVÂ6&G2†fRæò7V'F—FÆR6÷W&6RFò7vâr“²&WGW&âÐ¢6öç7B&V4æÖRÒ—Bå÷&V4æÖRÇÂ‡v–æF÷rå÷&V6÷&F–ærbbv–æF÷rå÷&V6÷&F–æræ7W'&VçDæÖR¢–b‚&V4æÖRÇÂ—Bå÷7BÓÒçVÆÂÇÂ—Bå÷rÓÒçVÆÂ’°¢ÆW'B‚t6ææ÷BÆö6FRF†—26&B–â—G2Æ–Æ—7Bâr“²&WGW&à¢Ð¢òò&W6öÇfRF†R5U%$TåB–æFW‚'’–FVçF—G’(	Bö–G†—26æ6†÷Bg&öÒv†VâF†P¢òòVWVRv2'V–ÇBæBG&–gG226ööâ2æ÷F†W"6&B—2FVÆWFVBÂv†–6‚v÷VÆ@¢òò÷F†W'v—6R&Ww&—FRF–ffW&VçB6&B–âF†R6ÖR'V6¶WB‡6ÖRf—‚0¢òò÷&VÖ÷fUVWVT—FVÒ’à¢6öç7B÷&V2Òv–æF÷rå÷&V6÷&F–æw2bbv–æF÷rå÷&V6÷&F–æw5·&V4æÖUÐ¢6öç7Bö'"Ò÷&V2bb÷&V2æ—FV×2bb÷&V2æ—FV×5¶—Bå÷7EÒbb÷&V2æ—FV×5¶—Bå÷7EÕ¶—Bå÷uÐ¢–b‚'&’æ—4'&’…ö'"’’²ÆW'B‚t6ææ÷BÆö6FRF†—26&B–â—G2Æ–Æ—7Bâr“²&WGW&âÐ¢ÆWBö–G‚Òö'"æf–æD–æFW‚‡‚Óâ‚bb‚æ–BÓÓÒ—Bæ–Bbb‚æÆ–æT–æFW‚ÓÓÒ—BæÆ–æT–æFW‚¢–b…ö–G‚ÂbbG—Vöb—Båö–G‚ÓÓÒvçVÖ&W"rbb—Båö–G‚Âö'"æÆVæwF‚’ö–G‚Ò—Båö–G€¢–b…ö–G‚Â’²ÆW'B‚t6ææ÷BÆö6FRF†—26&B–â—G2Æ–Æ—7Bâr“²&WGW&âÐ¢ö÷Vå&WÆ6T—FVÔF–Æör†—Bå÷7BÂ—Bå÷rÂö–G‚Â°¢&V4æÖRÀ¢öå&WÆ6VC¢†2’Óâ°¢òòÖ—'&÷"F†RæWr6Æ—f–VÆG2öçFòF†RVWVR6÷’6òF†R6&B&R×&VæFW'0¢òòFòF†RæWrW†×ÆRv—F†÷WB&V'V–ÆF–ærF†Rv†öÆR&7F–6RVWVRà¢—Bæ–BÒ2æ–C²—Bç6÷W&6RÒ2ç6÷W&6P¢—BçF–ÖU7F'BÒ2çF–ÖU7F'C²—BçF–ÖTVæBÒ2çF–ÖTVæC²—BæÆ–æT–æFW‚Ò2æÆ–æT–æFW€¢÷&VæFW%&7F–6T6&B‚¢Ð¢Ò§Ð ¢òòF†R7F÷&VB6&B&V†–æB&7F–6R6&BâF†RVWVR†öÆG26÷–W2ÂæB¢òòf—'GVÂÆ–Æ—7Bw26&G2Æ—fR–â—G2ÖVÖ&W"Æ–Æ—7G2Â6ò—B—2f÷VæB'’–@¢òò(	Bö–G†G&–gG226ööâ2æ÷F†W"6&B—2FVÆWFVBà¦gVæ7F–öâ÷7F÷&VDÖçVÄ6&B†—B’°¢–b‚—BÇÂ—Bæ–B’&WGW&âçVÆÀ¢6öç7BæÖW2Òö—5f—'GVÂ†—Bå÷&V4æÖR’ò÷f—'GVÄÖVÖ&W'2†—Bå÷&V4æÖR’¢¶—Bå÷&V4æÖUÐ¢f÷"†6öç7BæÖRöbæÖW2’°¢6öç7B&V2Òv–æF÷rå÷&V6÷&F–æw2bbv–æF÷rå÷&V6÷&F–æw5¶æÖUÐ¢6öç7B'"Ò&V2bb&V2æ—FV×2bb&V2æ—FV×5¶—Bå÷7EÒbb&V2æ—FV×5¶—Bå÷7EÕ¶—Bå÷uÐ¢6öç7B—FVÒÒ'&’æ—4'&’†'"’bb'"æf–æB‡‚Óâ‚bb‚æ–BÓÓÒ—Bæ–B¢–b†—FVÒ’&WGW&â²æÖRÂ—FVÒÐ¢Ð¢&WGW&âçVÆÀ§Ð ¦gVæ7F–öâöVF—D7W'&VçE&7F–6T6&B‚’°¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—BÇÂö—4ÖçVÄ—FVÒ†—B’’&WGW&à¢6öç7Bf÷VæBÒ÷7F÷&VDÖçVÄ6&B†—B¢–b‚f÷VæB’²ÆW'B‚t6ææ÷BÆö6FRF†—26&B–â—G2Æ–Æ—7Bâr“²&WGW&âÐ¢–b…÷&VgW6U&VDöæÇ•Æ–Æ—7B†f÷VæBææÖR’’&WGW&à¢ö÷VäÖçVÄVçG'”VF—F÷"†f÷VæBææÖRÂf÷VæBæ—FVÒÂ²6†÷uÆ–Æ—7DgFW%6fS¢fÇ6RÒ¢òòv†VâF†RVF—F÷"vöW2Â'&–ærF†RVF—BöçFòF†R6&Böâ67&VVââ6f–ær6à¢òò&WÆ6RF†R7F÷&VBö&¦V7BÂ6òÆöö²—BWv–â&F†W"F†â&WW6R—Bà¢òòæÖW76VBæB&WÆ6VBV6‚F–ÖRÂ6ò&WVFVBVF—G2æWfW"7F6²W ¢òò†æFÆW'2f÷"6&G2æòÆöævW"öâ67&VVâà¢B‚r6ÖçVÄVçG'”VF—F÷"r’æöfb‚vF–Æöv6Æ÷6Rç&7F–6TVF—Br’æöæR‚vF–Æöv6Æ÷6Rç&7F–6TVF—BrÂ‚’Óâ°¢6öç7Bv–âÒ÷7F÷&VDÖçVÄ6&B†—B¢–b‚v–â’&WGW&à¢6öç7B¶VWÒ²÷&V4æÖS¢—Bå÷&V4æÖRÂ÷7C¢—Bå÷7BÂ÷s¢—Bå÷rÂö–Gƒ¢—Båö–G‚À¢÷FV×÷&'“¢—Bå÷FV×÷&'’Âöæ÷F–d¶W“¢—Båöæ÷F–d¶W’Âöæ÷F–d—FVÔ–C¢—Båöæ÷F–d—FVÔ–BÐ¢ö&¦V7Bæ¶W—2†—B’æf÷$V6‚†²Óâ²–b‚†²–â¶VW’’FVÆWFR—E¶µÒÒ¢ö&¦V7Bæ76–vâ†—BÂv–âæ—FVÒÂ¶VW¢G'’²÷&VæFW%&7F–6T6&B‚’Ò6F6‚…ò’·Ð¢Ò§Ð ¦gVæ7F–öâöFVÆWFT7W'&VçE&7F–6T6&B‚’°¢6öç7B6&G2Òv–æF÷rå÷&7F–6T6&G0¢6öç7B–G‚Òv–æF÷rå÷&7F–6T–G€¢–b‚'&’æ—4'&’†6&G2’ÇÂ–G‚ÂÇÂ–G‚ãÒ6&G2æÆVæwF‚’&WGW&à¢6öç7B—BÒ6&G5¶–G…Ð¢–b‚—BÇÂ—Bå÷&V4æÖR’&WGW&à¢–b…÷&VgW6U&VDöæÇ•Æ–Æ—7B†—Bå÷&V4æÖR’’&WGW&à¢6öç7B—4ÖçVÂÒ—BæÖçVÀ¢6öç7BÆ&VÂÒ—4ÖçVÀ¢ò"Gµö6&EÆ–åFW‡B†—Bç6÷W&6R’ç6Æ–6RƒÂC—ÒGµö6&EÆ–åFW‡B†—Bç6÷W&6R’æÆVæwF‚âCò~(
br¢rwÒ& ¢¢G¶—Bæ–GÒG¶—BçF–ÖU7F'G×>(	2G¶—BçF–ÖTVæG×6 ¢–b‚6öæf—&Ò†FVÆWFRF†—26&B‚G¶Æ&VÇÒ’g&öÒ"G¶—Bå÷&V4æÖWÒ#õÆåÆåF†—26ææ÷B&RVæFöæRg&öÒF†RT’æ’’&WGW&à¢òò6GW&RF†RÆö6ÂÖVF–òU$Â$Tdõ$R&VÖ÷f–ærF†R—FVÒ(	B÷&VÖ÷fUVWVT—FVÐ¢òò×WFFW2F†RÆ–Æ—7BÂgFW"v†–6‚vR6÷VÆFâwBFVÆÂv†WF†W"F†RFVÆWFV@¢òò6&B†B—G2÷vâVF–òâöæÇ’7Böâf–ÆS¢òòW&Ç3²–÷UGV&RòvVæW&–0¢òòÆ–æ·2FöâwB†fRÆö6Â×7F÷&vR6÷VçFW''BFò6ÆVâWà¢òò&÷F‚W"Öf6R&V6÷&F–æw2‡ÇW2ÆVv7’6–ævÆRöæR–âÖVF–W&Â’à¢6öç7BVF–õW&Ç2ÒæWr6WB‚¢–b†—4ÖçVÂ’°¢ö6&DVF–õW&Ç2†—B’æf÷$V6‚‡RÓâVF–õW&Ç2æFB‡R’¢–b…ö—4VF–ôÖVF–W&Â†—BæÖVF–W&Â’’VF–õW&Ç2æFB†—BæÖVF–W&Â¢Ð¢6öç7Bö²Ò÷&VÖ÷fUVWVT—FVÒ†—B¢–b‚ö²’²ÆW'B‚t6÷VÆBæ÷BFVÆWFR(	BF†R—FVÒ—2æòÆöævW"–âF†RÆ–Æ—7B†Ö–&RÇ&VG’&VÖ÷fVB’âr“²&WGW&âÐ¢òò÷'†âÖ6†V6¶VB6ò6÷’öbF†—26&B–âæ÷F†W"Æ–Æ—7B¶VW2—G2f–ÆRà¢÷'VæT÷'†äVF–ò†VF–õW&Ç2¢òòG&÷g&öÒF†R–âÖÖVÖ÷'’VWVRFöòÂF†Vâ&R×&VæFW"â–bvRFVÆWFVBF†P¢òòÆ7B6&BÂfÆÂ&6²öæR÷6—F–öâ6òvRFöâwB&VæFW"âV×G’6Æ÷Bà¢6&G2ç7Æ–6R†–G‚Â¢–b‚6&G2æÆVæwF‚’²6Æ÷6U&7F–6TÖöFR‚“²&WGW&âÐ¢–b‡v–æF÷rå÷&7F–6T–G‚ãÒ6&G2æÆVæwF‚’v–æF÷rå÷&7F–6T–G‚Ò6&G2æÆVæwF‚Ò¢òò&W6WBW"Ö6&B÷fW'&–FW2Æ–¶R&7F–6TæbFöW2Â6–æ6RvRw&RVffV7F—fVÇ¢òò6†÷v–ærg&W6‚6&Bà¢v–æF÷rå÷&7F–6T7G„&Vf÷&RÒ ¢v–æF÷rå÷&7F–6T7G„gFW"Ò ¢v–æF÷rå÷&7F–6UÆ–&6µ&FRÒ÷&VfW'&VE&7F–6U7VVB‚¢v–æF÷rå÷&7F–6TfÆ—VBÒfÇ6P¢÷&VæFW%&7F–6T6&B‚§Ð ¢òò&VfÆV7BF†R7W'&VçB&V5Æ•6‡VffÆR7FFRöâF†R&7F–6RF÷Ö&"'WGFöâà¦gVæ7F–öâ÷&Vg&W6…&7F–6U6‡VffÆT'Fâ‚’°¢6öç7BF'FâÒB‚r7&7F–6TÖöFRr’æf–æB‚rç&7F–6R×6‡VffÆRr¢–b‚F'FâæÆVæwF‚’&WGW&à¢òòæ÷F†–ærFò6‡VffÆRv†VâöæR6&Bv2÷VæVBöâ—G2÷vâà¢F'FâçFövvÆR‚v–æF÷rå÷&7F–6U6–ævÆR¢6öç7BöâÒ‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&V5Æ•6‡VffÆR¢F'FâçFövvÆT6Æ72‚v7F—fRrÂöâ’æGG"‚v&–×&W76VBrÂöâòwG'VRr¢vfÇ6Rr¢æGG"‚wF—FÆRrÂöâòu6‡VffÆS¢öâ‡FFò&W7F÷&R÷&FW"’r¢u6‡VffÆS¢öfb‡FFò&æFöÖ—6R’r§Ð ¢òòFövvÆR6‡VffÆRf÷"F†R&7F–6RVWVR(	BfÆ—2F†R6ÖR&V5Æ•6‡VffÆP¢òò6WGF–ærF†RÆ–W"÷fW&Æ’W6W2ÂF†Vâ&RÖFW&—fW2F†RVWVR–âF†RæWp¢òò÷&FW"â&W6W'fW2F†R7W'&VçFÇ’f—6–&ÆR6&Bw2–FVçF—G’6òF†RW6W ¢òòFöW6âwBvWBFVÆW÷'FVBFòF–ffW&VçBöæRv†VâFövvÆ–ærà¦gVæ7F–öâ÷FövvÆU&7F–6U6‡VffÆR‚’°¢–b‚v–æF÷råö6WGF–æw2’v–æF÷råö6WGF–æw2Ò·Ð¢6öç7BæW‡BÒv–æF÷råö6WGF–æw2ç&V5Æ•6‡VffÆP¢v–æF÷råö6WGF–æw2ç&V5Æ•6‡VffÆRÒæW‡@¢G'’²6fT6WGF–æw2‚’Ò6F6‚…ò’·Ð¢òòÆöæR6&B†2æòFV6²Fò&V÷&FW#²&V'V–ÆF–ærv÷VÆBÆ–æRWÆ–Æ—7Bà¢–b‡v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6U6–ævÆRb`¢'&’æ—4'&’‡v–æF÷rå÷&7F–6T6&G2’bbv–æF÷rå÷&7F–6T6&G2æÆVæwF‚’°¢6öç7B7W"Òv–æF÷rå÷&7F–6T6&G5·v–æF÷rå÷&7F–6T–G…ÒÇÂçVÆÀ¢òò&V'V–ÆBg&öÒF†RÆ–Æ—7B–âæGW&Â÷&FW"ÂF†Vâ6‡VffÆR–bVæ&ÆVBà¢òòF†—2&W7F÷&W2÷&FW"v†Vâ6‡VffÆR—2&V–ærGW&æVBôdbà¢6öç7Bg&W6‚Òv–æF÷rå÷&7F–6UFV×÷&'¢ò‡v–æF÷rå÷&7F–6UFV×÷&'”÷&FW"ÇÂv–æF÷rå÷&7F–6T6&G2’æf–ÇFW"†—FVÒÓâv–æF÷rå÷&7F–6T6&G2æ–æ6ÇVFW2†—FVÒ’¢¢ö'V–ÆEÆ•VWVR‚vöfbr¢–b†æW‡B’÷6‡VffÆUVWVR†g&W6‚¢–b†g&W6‚æÆVæwF‚’°¢6öç7BæWt–G‚Ò7W ¢òg&W6‚æf–æD–æFW‚‡Óâbbå÷&V4æÖRÓÓÒ7W"å÷&V4æÖRbbå÷7BÓÓÒ7W"å÷7Bbbå÷rÓÓÒ7W"å÷rbbåö–G‚ÓÓÒ7W"åö–G‚¢¢ ¢v–æF÷rå÷&7F–6T6&G2Òg&W6€¢v–æF÷rå÷&7F–6T–G‚ÒÖF‚æÖ‚ƒÂæWt–G‚¢G'’²÷6fUVWVT÷&FW"†g&W6‚Âw&7F–6Rr’Ò6F6‚…ò’·Ð¢G'’²÷&VæFW%&7F–6T6&B‚’Ò6F6‚…ò’·Ð¢Ð¢Ð¢÷&Vg&W6…&7F–6U6‡VffÆT'Fâ‚§Ð ¢òò&÷F‚6Æ–FRÖF÷vâæVÇ2Æ—fR–ç6–FR7&7F–6TÖöFRÂv†–6‚—27F6¶–æp¢òò6öçFW‡Böb—G2÷vâ(	B6òF†R¢Ö–æFW‚F†W’6''’öæÇ’&æ·2F†VÒv–ç7@¢òòF†V—"6–&Æ–æw2ÂæBF†RÖçVÂÖ6&BVF–òÆ–W"Âv†–6‚—26–&Æ–ærö`¢òò7&7F–6TÖöFR&F†W"F†âöbF†V—'2Â–çG2÷fW"F†VÒ†÷vWfW"†–v‚F†W¢òò6²Fò&RâÆ–gBF†Rv†öÆR÷fW&Æ’v†–ÆRæVÂ—2÷VâÂæBWB—B&6°¢òògFW'v&G26òF†RVF–ò6öçG&öÇ2&R&V6†&ÆRv–âà¦gVæ7F–öâ÷7–æ5&7F–6UæVÄ÷Vâ‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢–b‚GæÆVæwF‚’&WGW&à¢6öç7B÷VâÒGæf–æB‚rç&7F–6RÖ–æfò×æVÂÂç&7F–6R×6WGF–æw2×æVÂr’æ—2‚s§f—6–&ÆRr¢GçFövvÆT6Æ72‚wæVÂÖ÷VârÂ÷Vâ§Ð ¦gVæ7F–öâö6Æ÷6U&7F–6UæVÇ2‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢Gæf–æB‚rç&7F–6RÖ–æfò×æVÂÂç&7F–6R×6WGF–æw2×æVÂr’æ†–FR‚¢Gæf–æB‚rç&7F–6RÖ–æfòÂç&7F–6R×6WGF–æw2r¢æGG"‚v&–ÖW‡æFVBrÂvfÇ6Rr’ç&VÖ÷fT6Æ72‚v7F—fRr¢÷7–æ5&7F–6UæVÄ÷Vâ‚§Ð ¦gVæ7F–öâ÷FövvÆU&7F–6T–æfõæVÂ‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢6öç7BGæVÂÒGæf–æB‚rç&7F–6RÖ–æfò×æVÂr¢6öç7BF'FâÒGæf–æB‚rç&7F–6RÖ–æfòr¢6öç7B÷VâÒGæVÂæ—2‚s§f—6–&ÆRr¢GæVÂçFövvÆR†÷Vâ¢F'FâæGG"‚v&–ÖW‡æFVBrÂ÷VâòwG'VRr¢vfÇ6Rr’çFövvÆT6Æ72‚v7F—fRrÂ÷Vâ¢–b†÷Vâ’°¢òòGvò6Æ–FRÖF÷vâæVÇ26†&RF†R6ÖRF÷&"(	B6Æ÷6RF†R÷F†W"öæP¢òò6òF†W’FöâwB7F6²æBVBF†R6&B&Vöâ6ÖÆÂ67&VVç2à¢Gæf–æB‚rç&7F–6R×6WGF–æw2×æVÂr’æ†–FR‚¢Gæf–æB‚rç&7F–6R×6WGF–æw2r’æGG"‚v&–ÖW‡æFVBrÂvfÇ6Rr’ç&VÖ÷fT6Æ72‚v7F—fRr¢÷WFFU&7F–6T–æfò‚¢Ð¢÷7–æ5&7F–6UæVÄ÷Vâ‚§Ð¦gVæ7F–öâ÷FövvÆU&7F–6U6WGF–æw5æVÂ‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢6öç7BGæVÂÒGæf–æB‚rç&7F–6R×6WGF–æw2×æVÂr¢6öç7BF'FâÒGæf–æB‚rç&7F–6R×6WGF–æw2r¢6öç7B÷VâÒGæVÂæ—2‚s§f—6–&ÆRr¢GæVÂçFövvÆR†÷Vâ¢F'FâæGG"‚v&–ÖW‡æFVBrÂ÷VâòwG'VRr¢vfÇ6Rr’çFövvÆT6Æ72‚v7F—fRrÂ÷Vâ¢–b†÷Vâ’°¢òò6Æ÷6RF†R6–&Æ–ær–æfòæVÃ²6VVBF†R&WfVÂ6VÆV7Bv—F‚7W'&VçB6WGF–ærà¢Gæf–æB‚rç&7F–6RÖ–æfò×æVÂr’æ†–FR‚¢Gæf–æB‚rç&7F–6RÖ–æfòr’æGG"‚v&–ÖW‡æFVBrÂvfÇ6Rr’ç&VÖ÷fT6Æ72‚v7F—fRr¢6öç7BÖöFRÒ‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&7F–6U&WfVÄÖöFR’ÇÂvfÆ—p¢GæVÂæf–æB‚rç&7F–6R×&WfVÂ×6VÆV7Br’çfÂ†ÖöFR¢÷&VæFW%&7F–6U&V4&"‚¢GæVÂæf–æB‚rç&7F–6R×7VVG2Ö–çWBr’çfÂ…÷&7F–6U7VVG2‚’æ¦ö–â‚rÂr’¢GæVÂæf–æB‚rç&7F–6R×7VVG2×7FGW2r’çFW‡B‚rr¢÷WFFU&7F–6U7VVD'Fâ‚¢Ð¢÷7–æ5&7F–6UæVÄ÷Vâ‚§Ð ¢òò÷VÆFRF†R&7F–6R–æfòæVÂv—F‚F†R7W'&VçB6&Bw2ÖWFFF(	@¢òòÖ—'&÷'2v†BF†RÆ’ÖÖöFR&ææW"6†÷w26òF†RW6W"Çv—2¶æ÷w2v†W&P¢òòF†R7W'&VçB—FVÒ6ÖRg&öÒ‡&V6÷&F–æræÖRÂf–FVò–B²F–ÖW7F×2f÷ ¢òò6GW&VB6Æ—2Â6÷W&6R÷F&vWB²ÖVF–Æ–æ²f÷"ÖçVÂ6&G2’à¦gVæ7F–öâ÷WFFU&7F–6T–æfò‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢–b‚GæÆVæwF‚’&WGW&à¢6öç7B6&G2Òv–æF÷rå÷&7F–6T6&G2ÇÂµÐ¢6öç7B—BÒ6&G5·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—B’&WGW&à¢6öç7BF†VBÒGæf–æB‚rç&7F–6RÖ–æfòÖ†VBr¢6öç7BFÖWFÒGæf–æB‚rç&7F–6RÖ–æfòÖÖWFr¢òòv†–6‚&÷röb—G2Æ–Æ—7BF†—2—2ÂçVÖ&W&VB2F†R&V6÷&FVB6V&6†W0¢òòF–ÆörçVÖ&W'2F†VÒÂ6òF†R6&B6â&Rf÷VæBF†W&Rà¢6öç7BæÖRÒ—Bå÷&V4æÖRÇÂrp¢6öç7B—FV×2ÒæÖRòçVÆÂ¢ö—5f—'GVÂ†æÖR’ò÷&W6öÇfUf—'GVÄ—FV×2†æÖR¢¢‡v–æF÷rå÷&V6÷&F–æw5¶æÖUÒbbv–æF÷rå÷&V6÷&F–æw5¶æÖUÒæ—FV×2¢òòf÷VæB'’–FVçF—G“¢ö–G†—26æ6†÷Bg&öÒv†VâF†RVWVRv2'V–ÇBæ@¢òòG&–gG226ööâ2æ÷F†W"6&B—2FVÆWFVBà¢6öç7B'V6¶WBÒ—FV×2bb—FV×5¶—Bå÷7EÒbb—FV×5¶—Bå÷7EÕ¶—Bå÷uÐ¢ÆWB&÷t–G‚Ò'&’æ—4'&’†'V6¶WB’ò'V6¶WBæf–æD–æFW‚‡‚Óâ‚bb‚æ–BÓÓÒ—Bæ–Bbb‚æÆ–æT–æFW‚ÓÓÒ—BæÆ–æT–æFW‚’¢Ó¢–b‡&÷t–G‚Â’&÷t–G‚Ò—Båö–G€¢6öç7BBÒ÷&÷u÷6—F–öä–â†—FV×2Â—Bå÷7BÂ—Bå÷rÂ&÷t–G‚¢6öç7B6†÷väæÖRÒæÖRòö÷væW$Æ&VÆÆW"‚’ç&Vf—‚†æÖRÂv–æF÷rå÷&V6÷&F–æw2bbv–æF÷rå÷&V6÷&F–æw5¶æÖUÒ’¢sòp¢6öç7Bv†W&RÒG·6†÷väæÖWÒG¶Bò+r2G¶Bç÷7ÒöbG¶BçF÷FÇÖ¢rwÖ ¢òò&Wf–WrÂæ÷BF†R6&C¢F†R6&B—G6VÆb—2öâ67&VVâ&–v‡B&VÆ÷rà¢6öç7B”ädõôÔ‚ÒCP¢–b†—BæÖçVÂ’°¢6öç7Bf–FVòÒöÖçVÄ6&Ef–FVò†—B¢6öç7BÆ–æ´Æ&ÂÒf–FVòò+r)kb–÷UGV&R+rG¶g&öÕ6V6öæG2‡f–FVòçF–ÖU7F'B—Ö¢—BæÖVF–W&Âòr+r	ùIrÆ–æ²r¢rp¢F†VBçFW‡B†	ù9ÒG·v†W&WÖ¢FÖWFçFW‡B†Gµ÷G'Væ6FU&Wf–Wr…ö6&EÆ–åFW‡B†—Bç6÷W&6R’Â”ädõôÔ‚’ÇÂr†V×G’’wÒ(i"Gµ÷G'Væ6FU&Wf–Wr…ö6&EÆ–åFW‡B†—BçF&vWB’Â”ädõôÔ‚’ÇÂr†V×G’’wÒG¶Æ–æ´Æ&ÇÖ¢ÒVÇ6R°¢F†VBçFW‡B†G·v†W&WÒ(	B"Gµ÷G'Væ6FU&Wf–Wr†—Bå÷7BÇÂrrÂC—Ò"(i"Gµ÷G'Væ6FU&Wf–Wr†—Bå÷rÇÂrrÂ3—Ö¢FÖWFçFW‡B†G¶—Bæ–GÒ+rG¶—Bç6÷W&6RÇÂsòwÒ+rG¶g&öÕ6V6öæG2†—BçF–ÖU7F'B—Ò(	2G¶g&öÕ6V6öæG2†—BçF–ÖTVæB—Ö¢Ð§Ð ¦gVæ7F–öâFövvÆU&7F–6TF—"‚’°¢v–æF÷rå÷&7F–6Tg&öçD—56÷W&6RÒv–æF÷rå÷&7F–6Tg&öçD—56÷W&6P¢òòW'6—7B6òF†RæW‡B6W76–öâ÷Vç2v—F‚F†RW6W"w2&VfW'&VBF—&V7F–öâà¢–b‡v–æF÷råö6WGF–æw2’°¢v–æF÷råö6WGF–æw2ç&7F–6Tg&öçD—56÷W&6RÒv–æF÷rå÷&7F–6Tg&öçD—56÷W&6P¢G'’²6fT6WGF–æw2‚’Ò6F6‚…ò’·Ð¢Ð¢÷&VæFW%&7F–6T6&B‚§Ð¦gVæ7F–öâ&WfVÅ&7F–6T6&B‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢6öç7BÖöFRÒ‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&7F–6U&WfVÄÖöFR’ÇÂvfÆ—p¢òò–âF&vWN(i'6÷W&6RÖöFRF†Rv÷&B—G6VÆb—2F†Rç7vW"††–FFVâVçF–À¢òò&WfVÂ’âöæ6R&WfVÆVBÂ6†÷r—B(	Bf÷"ç’&WfVÂÖöFRà¢–b‚v–æF÷rå÷&7F–6Tg&öçD—56÷W&6R’Gæf–æB‚rç&7F–6R×v÷&Br’æ772‚wf—6–&–Æ—G’rÂwf—6–&ÆRr¢–b†ÖöFRÓÓÒvfÆ—r’°¢òòFövvÆRF†RfÆ—×7FFR(	B6ÖR†æFÆW"—2v—&VBFòç&7F–6R×VæfÆ—À¢òò6ò6Æ–6²öâV—F†W"6–FR&÷FFW2F†R6&B&6²öf÷'F‚à¢v–æF÷rå÷&7F–6TfÆ—VBÒv–æF÷rå÷&7F–6TfÆ—V@¢Gæf–æB‚rç&7F–6RÖfÆ—W"r’çFövvÆT6Æ72‚vfÆ—VBrÂv–æF÷rå÷&7F–6TfÆ—VB¢&WGW&à¢Ð¢òòv†–FRr†æBF†RÆVv7’fÆÆ&6²“¢&WfVÂÖ&VÆ÷r&V†f–÷W"à¢Gæf–æB‚rç&7F–6RÖ&6²r’ç6†÷r‚¢Gæf–æB‚rç&7F–6R×&WfVÂr’æ†–FR‚§Ð¢òòF†R7G&WF6‚öbf–FVò6&BÆ—3¢F†RÆ–æW2—B—26†÷v–ær‡6VP¢òòâ÷&7F–6RÖ6Æ—æ§2’âF†R(i²ò(i2²'WGFöç2v–FVâF†R6&B'’v†öÆR7V'F—FÆP¢òòÆ–æW2ÂæBÆ–&6²föÆÆ÷w2F†VÒâF†Rv–æF÷r—2F†R6ÖRöæP¢òò÷&7F–6T6&DÆ–æW2G&w2Â&W6öÇfVBF†R6ÖRv’Â6òv†BÆ—2—2v†B—2öà¢òòF†R6&Bà¦7–æ2gVæ7F–öâ÷&7F–6T6Æ—&ævR†—BÂ&Vf÷&RÂgFW"’°¢–b†—BæÖçVÂbbö6&D†5f–FVôÆ–æ²†—B’’°¢6öç7B6Æ—Ò÷'VçF–ÖU–÷UGV&T6Æ—†—B¢&WGW&â²7F'C¢6Æ—çF–ÖU7F'BÂ7F÷¢6Æ—çF–ÖTVæBÐ¢Ð¢6öç7B6VvÖVçG2Ò7÷F–g”6Æ—2†—B¢–b‡6VvÖVçG2æÆVæwF‚’&WGW&â²7F'C¢6VvÖVçG5³Òç7F'BÂ7F÷¢6VvÖVçG5·6VvÖVçG2æÆVæwF‚ÒÒæVæBÐ¢6öç7BfÆÆ&6²Ò°¢7F'C¢‡G—Vöb—BçF–ÖU7F'BÓÓÒvçVÖ&W"r’ò—BçF–ÖU7F'B¢À¢7F÷¢‡G—Vöb—BçF–ÖTVæBÓÓÒvçVÖ&W"r’ò—BçF–ÖTVæB¢çVÆÂÀ¢Ð¢–b†fÆÆ&6²ç7F÷ÓÒçVÆÂ’fÆÆ&6²ç7F÷ÒfÆÆ&6²ç7F'B²@¢G'’°¢6öç7B'6VBÒv—BöÆöE7V'F—FÆW4f÷$—FVÒ†—B¢6öç7B7&2Ò‡'6VBbb'6VBç7b’ÇÂµÐ¢òò7FÆRÆ–æT–æFW‚…5%B&VçVÖ&W&VB6–æ6R6GW&R’—26†V6¶VBv–ç7BF†P¢òò6Æ—v–æF÷ræB&V6÷fW&VB'’F–ÖRæBv÷&BÂ2F†R6&B—G6VÆbFöW2à¢6öç7B÷2ÒöÆö6FT—FVÔ7VR‡7&2Â—B¢&WGW&âö6Æ—&ævR‡7&2Â÷2Â&Vf÷&RÂgFW"ÂfÆÆ&6²À¢²v÷&C¢—Bçv÷&BÂÖ–åv÷&G4&÷VæC¢öÖ–åv÷&G4&÷VæB‚’ÂvF‡&W6†öÆC¢ö6Æ—vF‡&W6†öÆE6V2‚’Ò¢Ò6F6‚†W'"’²6öç6öÆRçv&â‚w&7F–6S¢6Æ—&ævR&W6öÇfRf–ÆVBrÂW'"’Ð¢&WGW&âö6Æ—&ævR…µÒÂÓÂ&Vf÷&RÂgFW"ÂfÆÆ&6²§Ð ¢òòöÆÂF†R–÷UGV&RÆ–†VBæBW6Röæ6R—B76W27F÷â&7F–6RÖöFR'Vç0¢òòv—F‚7–æ57V'F—FÆSÖfÇ6RÂ6òF†RvÆö&ÂöçF–ÖWWFFR–çFW'fÂ×7F÷W"—0¢òò–æ7F—fR(	BF†—2—2F†R&7F–6R×7V6–f–2WV—fÆVçBâ6æ6VÆÆVBv†VâæWvW ¢òò6Æ—7F'G2ÂF†R6&B6†ævW2Â÷"&7F–6R6Æ÷6W2‡f–F†RFö¶Vâ’à¦gVæ7F–öâ÷vF6…&7F–6T6Æ—VæB‡7F÷ÂFö¶VâÂ²f–FVô–BÂ7F'BÂ&V6÷fW"ÒÒ·Ò’°¢6ÆV$–çFW'fÂ‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"¢ÆWBÆ7E÷6—F–öâÒ7F'BÂÆ7E&öw&W72Ò÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢6öç7B6ÆV"Ò‚’Óâ°¢6ÆV$–çFW'fÂ‡F–ÖW"¢–b‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"ÓÓÒF–ÖW"’v–æF÷rå÷&7F–6T6Æ—F–ÖW"ÒçVÆÀ¢Ð¢6öç7BF–ÖW"Òv–æF÷rå÷&7F–6T6Æ—F–ÖW"Ò6WD–çFW'fÂ‚‚’Óâ°¢–b‚v–æF÷rå÷&7F–6T7F—fRÇÂFö¶VâÓÒv–æF÷rå÷&7F–6T6Æ—Fö¶Vâ’²6ÆV"‚“²&WGW&âÐ¢–b‚÷Æ–W$Æ–fV7–6ÆRæ—4f÷&Vw&÷VæB‚’’&WGW&à¢G'’°¢6öç7BÆ–W"Òv–æF÷rç—EÆ–W ¢–b‚Æ–W"ÇÂ‡f–FVô–BbbvWE–÷WGV&Uf–FVô–B‡Æ–W"’ÓÒf–FVô–B’’&WGW&à¢6öç7BF–ÖRÒÆ–W"ævWD7W'&VçEF–ÖR‚¢6öç7BGW&F–öâÒÆ–W"ævWDGW&F–öãòâ‚¢6öç7BVæBÒGW&F–öââòÖF‚æÖ–â‡7F÷ÂGW&F–öâ’¢7F÷ ¢–b‡F–ÖRãÒVæB’°¢Æ–W"çW6Uf–FVò‚¢6ÆV"‚¢&WGW&à¢Ð¢–b‚&V6÷fW"’&WGW&à¢6öç7B7FFRÒÆ–W"ævWEÆ–W%7FFR‚¢–b‡7FFRÓÓÒ"ÇÂ‡7FFRÓÓÒbbF–ÖRâÆ7E÷6—F–öâ²ãR’’°¢–b‡7FFRÓÓÒ’Æ7E÷6—F–öâÒF–ÖP¢Æ7E&öw&W72Ò÷Æ–W$Æ–fV7–6ÆRææ÷r‚¢Ð¢–b…³Â5Òæ–æ6ÇVFW2‡7FFR’bb÷Æ–W$Æ–fV7–6ÆRææ÷r‚’ÒÆ7E&öw&W72ãÒd”DTõõ5DÄÅõ$UE%•ôÕ2’°¢6ÆV"‚¢&V6÷fW"†Æ7E÷6—F–öâ¢Ð¢Ò6F6‚…ò’·Ð¢ÒÂS§Ð ¦7–æ2gVæ7F–öâÆ•&7F–6T6Æ—‡&ævRÒçVÆÂÂ²&WG'•7FÆÂÒG'VRÂf÷&6TÆöBÒfÇ6RÒÒ·Ò’°¢6öç7B–G‚Òv–æF÷rå÷&7F–6T–G€¢6öç7B—BÒv–æF÷rå÷&7F–6T6&G2bbv–æF÷rå÷&7F–6T6&G5¶–G…Ð¢–b‚—B’&WGW&à¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢–b…÷&5&V3òæÆö÷bb÷&5&V2æ¶W’ÓÓÒ÷&5&V4¶W’†—B’’°¢÷&5&V4Æö÷6VV²…÷&5&V2Â&ævRò²7F'C¢&ævRç7F'BÒ¢VæFVf–æVB¢&WGW&à¢Ð¢òòF†Rf—6–&ÆRÆ’'WGFöâW6W2F†—2VçG'’ö–çBâF—7F6‚&Vf÷&R7&VF–æp¢òò–÷UGV&R&WVW7BÂv†–6‚–çFVçF–öæÆÇ’7F÷2ö†–FW2F†R7÷F–g’6W76–öâà¢–b‡7÷F–g”6Æ—2†—B’æÆVæwF‚’&WGW&â÷FövvÆU&7F–6UÆ–&6²‚¢–b…ö6å7Vµ6–ÆVçD6&B†—B’’&WGW&â÷FövvÆU&7F–6UGG2†—B¢6öç7Bf–FVõ&WVW7BÒöæWu&7F–6Uf–FVõ&WVW7B‚¢òòV6‚6Æ—vWG2Fö¶Vâ6ò7FÆR7F÷×vF6†W"†÷"6&B7v—F6‚Ö–BÖÆöB¢òò6âwBW6RÆFW"6Æ—à¢6öç7BFö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÇÂ’²¢6öç7B—47W'&VçBÒ‚’Óâ÷&7F–6Uf–FVô7VW2æ—47W'&VçB‡f–FVõ&WVW7B’bbv–æF÷rå÷&7F–6T–G‚ÓÓÒ–G‚bbFö¶VâÓÓÒv–æF÷rå÷&7F–6T6Æ—Fö¶Và¢v–æF÷rå÷&7F–6UÆ•VæF–ærÒFö¶Và¢6öç7BGFV×BÒ7&VFU&V6÷&F–æuf–FVôGFV×B‡²f–FVô–C¢—Bæ–BÂ—47W'&VçBÂæ÷s¢÷Æ–W$Æ–fV7–6ÆRææ÷rÒ¢÷&7F–6U6VV´GFV×BÒGFV×@¢G'’°¢6öç7B²7F'BÂ7F÷ÒÒ&ævRÇÂv—BGFV×Bçv—B…÷&7F–6T6Æ—&ævR€¢—BÂv–æF÷rå÷&7F–6T7G„&Vf÷&RÇÂÂv–æF÷rå÷&7F–6T7G„gFW"ÇÂ’¢–b‚—47W'&VçB‚’’&WGW&à¢òò7V¶–ær÷fW"'Vç2öâF†R6ÖR6Æ—¢—G2f—'7B&Wv–æBÆæG2†W&RÂæ@¢òòF†R72gFW"F¶R7F÷2v†W&RF†R6&Bw2Æ–æW2VæBà¢–b…÷&5&V2bb÷&5&V2æ¶W’ÓÓÒ÷&5&V4¶W’†—B’’°¢÷&5&V2æ6Æ—7F'BÒ7F'@¢÷&5&V2æ6Æ—7F÷Ò7F÷ ¢Ð¢òòF¶R7ö¶VâgFW"F†R6&Bw2Æ–æW27F–ÆÂ†2Fò&R&V6†VBà¢6öç7B6Æ—VæBÒ÷&5&V46Æ—VæB‡7F÷¢–b‚÷&7F–6Uf–FVô7VW2æ&Vv–åÆ–&6²‡f–FVõ&WVW7B’’&WGW&à¢GFV×Bç&WVW7B‚¢v—BGFV×Bçv—B‡Æ”ÖVF–6Æ–6R†—Bæ–BÂ7F'BÂ6Æ—VæBÂu–÷UGV&RrÂ°¢—47W'&VçC¢GFV×Bæ7F—fRÂ6öæf—&Õ6VV³¢G'VRÂf÷&6TÆöBÀ¢æ÷s¢÷Æ–W$Æ–fV7–6ÆRææ÷rÂ—4f÷&Vw&÷VæC¢÷Æ–W$Æ–fV7–6ÆRæ—4f÷&Vw&÷VæBÀ¢&W&UÆ–W#¢Æ–W"ÓâGFV×Bç&W&UÆ–W"‡Æ–W"’À¢Ò’¢–b‚GFV×Bæ7F—fR‚’’&WGW&à¢òòÆ––ærF†R6Æ—v–â—2g&W6‚Æ—7FVâÂ6òWfW'’F¶R6÷VæG2B—G0¢òòÖ&²(	B–æ6ÇVF–ærç’F†R72gFW"&V6÷&F–ærv2†öÆF–ær&6²âF†P¢òòvF6†W"Ç6òÆWG2vòöâ&–rVæ÷Vv‚§V×Â'WB7F'F–ærg&öÒæV"F†P¢òò6Æ—7F'B—2æ÷BöæRâç—F†–ærF†R&Wf–÷W2727F–ÆÂ†B'Vææ–æp¢òò&VÆöæw2Fò—BæBæ÷BFòF†—2Æ—7FVã¢F¶R7F–ÆÂ6÷VæF–ærv÷VÆBÆ¢òò÷fW"F†R6Æ—ÂæB—G2÷vâVæF–ærv÷VÆB6WBF†Rf–FVòvö–ærv–âà¢–b…÷&5&V2’°¢6öç7B'2Ò÷&5&V0¢'2æv—F–ærÒçVÆÀ¢'2çFö¶Vâ²°¢–b‡'2æVF–ò’²G'’²'2æVF–òçW6R‚’Ò6F6‚…ò’·Ò'2æVF–òÒçVÆÂÐ¢–b‡'2ç†6RÓÓÒwÆ–&6²r’'2ç†6RÒv–FÆRp¢òòæò7&÷76–ærVçF–ÂF†RvF6†W"†2Gvò&VF–æw2g&öÒv†W&RvR&Ræ÷rà¢'2çvF6…÷2ÒçVÆÀ¢÷&VæFW%&7F–6U&V4&"‚¢Ð¢òòÇ’F†RW6W"w26†÷6VâÆ–&6²&FR§W7B&Vf÷&RÆ’(	B×W7B†Và¢òòeDU"F†Rf–FVò†2&VVâÆöFVB÷6VV¶VBÂVÇ6R•B6–ÆVçFÇ’6æ2—@¢òò&6²Fò9rv†VâF†RæWrf–FVò¶–6·2–âà¢6öç7B&FRÒ÷&7F–6Uf–FVõ&FR‚¢÷WFFU&7F–6U7VVD'Fâ‚¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FRbbv–æF÷rç—EÆ–W"ç6WEÆ–&6µ&FR‡&FR’Ò6F6‚…ò’·Ð¢GFV×Bç&VÆV6T×WFR‚¢G'’²v–æF÷rç—EÆ–W#òçÆ•f–FVò‚’Ò6F6‚…ò’·Ð¢v–æF÷rå÷&7F–6UÆ–&6´6&BÒ—@¢÷vF6…&7F–6T6Æ—VæB†6Æ—VæBÂFö¶VâÂ°¢f–FVô–C¢—Bæ–BÂ7F'BÀ¢&V6÷fW#¢&WG'•7FÆÂò&W7VÖRÓâÆ•&7F–6T6Æ—‡²7F'C¢&W7VÖRÂ7F÷ÒÂ²&WG'•7FÆÃ¢fÇ6RÂf÷&6TÆöC¢G'VRÒ’¢çVÆÂÀ¢Ò¢Ò6F6‚†R’°¢–b†Ræ¶–æBÓÒv6æ6VÆÆVBrbb—47W'&VçB‚’’°¢6öç6öÆRçv&â‚w&7F–6S¢Æ’f–ÆVBrÂR¢ö7'V–ÆEFö7B‚t6÷VÆBæ÷BÆ’F†—26Æ—âFÆ’Fò&WG'’âr¢Ð¢Òf–æÆÇ’°¢GFV×BæF—7÷6R‚¢–b…÷&7F–6U6VV´GFV×BÓÓÒGFV×B’÷&7F–6U6VV´GFV×BÒçVÆÀ¢–b‡v–æF÷rå÷&7F–6UÆ•VæF–ærÓÓÒFö¶Vâ’v–æF÷rå÷&7F–6UÆ•VæF–ærÒçVÆÀ¢Ð§Ð ¢òò)H)H)H6†F÷v–ærF¶W2–â&7F–6R)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òò7V²÷fW"6Æ—æB†V"–÷W'6VÆb–âÆ6Râ&V2–ç2F†RÖöÖVçBÂW6W0¢òòF†Rf–FVòæB÷Vç2F†RÖ–2âW6R6Æ÷6W2—BÂ&Wv–æG2FòF†RF¶R&Vf÷&P¢òòF†—2öæRÂ'Vç2WFòF†RÖ&²ÂÆ—2&6²v†Bv26–BF†W&RÂæBÆWG2F†P¢òòf–FVò6''’öâg&öÒF†R6ÖRö–çBà¢òð¢òòF¶W2&R67&F6‚(	BF†R6&B†öÆG2æöæRöbF†VÒVçF–Â¶VWâ÷&FW&–æræ@¢òòF†R&Wv–æB'VÆRÆ—fR–ââ÷&7F–6R×&V2æ§2à ¢òòF†R6W76–öâöâF†R6&B7W'&VçFÇ’öâ67&VVâÂ÷"çVÆÂâöæR6&BBF–ÖRà¦ÆWB÷&5&V2ÒçVÆÀ ¢òòv†–6‚6&B6W76–öâ&VÆöæw2Fòâ'’–FVçF—G’&F†W"F†âVWVR÷6—F–öã ¢òòF†R–æFW‚G&–gG226ööâ2æ÷F†W"6&B—2FVÆWFVBà¢òòv†W&R72÷fW"F†R6&B7F÷3¢F†RVæBöb—G2Æ–æW2Â÷"§W7B7BF†P¢òòÆ7BF¶Rv†VâöæRv27ö¶VâgFW"F†VÒà¦gVæ7F–öâ÷&5&V46Æ—VæB‡7F÷’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7BçF¶W2æÆVæwF‚’&WGW&â7F÷ ¢&WGW&âÖF‚æÖ‚‡7F÷Â7BçF¶W2ç&VGV6R‚†ÒÂB’ÓâÖF‚æÖ‚†ÒÂçVÖ&W"‡BçC’ÇÂ’Â’²ã2§Ð ¦7–æ2gVæ7F–öâ÷&5&V5&Vg&W6„6Æ—‡7B’°¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—BÇÂ÷&5&V4¶W’†—B’ÓÒ7Bæ¶W’’&WGW&à¢G'’°¢6öç7B²7F'BÂ7F÷ÒÒv—B÷&7F–6T6Æ—&ævR€¢—BÂv–æF÷rå÷&7F–6T7G„&Vf÷&RÇÂÂv–æF÷rå÷&7F–6T7G„gFW"ÇÂ¢7Bæ6Æ—7F'BÒ7F'@¢7Bæ6Æ—7F÷Ò7F÷ ¢Ò6F6‚…ò’·Ð§Ð ¦gVæ7F–öâ÷&5&V4¶W’†—B’°¢&WGW&â—Bò¶—Bå÷&V4æÖRÂ—Bå÷7BÂ—Bå÷rÂ—Bæ–BÂ—BæÆ–æT–æFW…Òæ¦ö–â‚wÂr’¢rp§Ð ¢òò6&B6â6''’F¶W2v†VâF†W&R—26Æ—Fò7V²÷fW"æB†÷7BF†@¢òò6â†öÆBF†R'—FW2âÖçVÂ6&BÇ&VG’†2—G2÷vâGvò&V6÷&F–æw2à¦gVæ7F–öâ÷&5&V4VÆ–v–&ÆR†—B’°¢&WGW&â†—Bbbö†fU7V´÷fW%&V6÷&FW"‚’b`¢‡7÷F–g”6Æ—2†—B’æÆVæwF‚ÇÂ‚—BæÖçVÂbbG—Vöb—BçF–ÖU7F'BÓÓÒvçVÖ&W"r’’§Ð ¦gVæ7F–öâ÷&7F–6U7V´÷fW%6†÷vâ‚’²&WGW&âv–æF÷råö6WGF–æw2ç&7F–6U7V´÷fW"ÓÒfÇ6RÐ ¢òòF¶W2F†R6&BÇ&VG’†öÆG2âF†W’÷VâF†R6W76–öâ&VBÖöæÇ“¢F†Rf–ÆW0¢òò&VÆöærFòF†R6&BÂ6òÆVf–ærv—F†÷WB¶VW–ær×W7Bæ÷BFVÆWFRF†VÒà¦gVæ7F–öâ÷&5&V56fVEF¶W2†—B’°¢6öç7BÆ—7BÒ†—Bbb'&’æ—4'&’†—Bç&7F–6UF¶W2’’ò—Bç&7F–6UF¶W2¢µÐ¢&WGW&âÆ—7@¢æf–ÇFW"‡BÓâBbbö—57V´÷fW$VF–õW&Â‡BçW&Â’bb—4f–æ—FR„çVÖ&W"‡BçC’’¢æÖ‡BÓâ‡²C¢çVÖ&W"‡BçC’ÂW&Ã¢BçW&ÂÂ×3¢çVÖ&W"‡Bæ×2’ÇÂÒ’§Ð ¦gVæ7F–öâ÷&5&V4&Vv–â†—B’°¢6öç7B6fVBÒ÷&5&V56fVEF¶W2†—B¢6öç7B6VvÖVçG2Ò7÷F–g”6Æ—2†—B¢÷&5&V2Ò°¢—FVÓ¢—BÀ¢¶W“¢÷&5&V4¶W’†—B’À¢òòF†R6&Bw26Æ—â7F÷&VB6GW&RF–ÖW2VçF–ÂÆ•&7F–6T6Æ—†2v÷&¶V@¢òò÷WBF†RÆ–æW2F†R6&B6†÷w3²F†VâF†÷6Rà¢6Æ—7F'C¢6VvÖVçG5³Óòç7F'Bóò„çVÖ&W"†—BçF–ÖU7F'B’ÇÂ’À¢6Æ—7F÷¢6VvÖVçG2æÆVæwF‚ò6VvÖVçG5·6VvÖVçG2æÆVæwF‚ÒÒæVæB¢çVÆÂÀ¢F¶W3¢6fVBç6Æ–6R‚’À¢òòf–ÆW2F†R6&Bö–çG2BâWfW'—F†–ærVÇ6R—2÷W'2FòFVÆWFRà¢¶WC¢æWr6WB‡6fVBæÖ‡BÓâBçW&Â’’À¢òò¶WBf–ÆW2F†B&R×&V6÷&F–ærF—7Æ6VBâF†R6&B7F–ÆÂö–çG2BF†VÐ¢òòVçF–Â¶VW&Ww&—FW2F†RÆ—7BÂ6òF†W’6ææ÷Bvò&Vf÷&RF†Bà¢÷'†ç3¢µÒÀ¢†6S¢v–FÆRrÀ¢C¢çVÆÂÀ¢W&Ã¢çVÆÂÀ¢òòv†W&RF†RÆ–†VBv2öâF†R&Wf–÷W2öÆÂâçVÆÂVçF–ÂF†Rf—'7BöæS ¢òòF†W&R—2æò7&÷76–ærv—F†÷WBGvò&VF–æw2à¢vF6…÷3¢çVÆÂÀ¢òòF†RÖ&²F†R72gFW"&V6÷&F–ær—2–ÖVBBÂv†–ÆR7V6‚72—0¢òò'Vææ–ærâçVÆÂF†R&W7BöbF†RF–ÖRÂv†VâWfW'’Ö&²6÷VæG2à¢v—F–æs¢çVÆÂÀ¢7F'FVD×3¢À¢Fö¶Vã¢À¢F–ÖW#¢çVÆÂÀ¢VF–ó¢çVÆÂÀ¢Æö÷¢fÇ6RÂÆö÷7W7VæFVC¢fÇ6RÂÆö÷F¶S¢çVÆÂÂÆö÷VF–ó¢çVÆÂÂÆö÷Fö¶Vã¢À¢Æö÷Æ–VC¢fÇ6RÂÆö÷6VV¶–æs¢fÇ6RÂÆö÷6VVµF–ÖW#¢çVÆÂÀ¢Ð¢òò&ÖVBf÷"F†Rv†öÆR6&BÂæ÷B§W7BgFW"&V6÷&F–ærà¢÷&5&V5vF6‚‚¢&WGW&â÷&5&V0§Ð ¢òòVæBF†R6W76–öââF—66&FG&÷2WfW'’f–ÆRF†R6&BFöW2æ÷Bö–çBBà¦gVæ7F–öâ÷&5&V4VæB†F—66&B’°¢6öç7B7BÒ÷&5&V0¢÷&5&V2ÒçVÆÀ¢–b‚7B’&WGW&à¢7BçFö¶Vâ²°¢–b‡7BçF–ÖW"’²6ÆV$–çFW'fÂ‡7BçF–ÖW"“²7BçF–ÖW"ÒçVÆÂÐ¢–b‡7BæVF–ò’²G'’²7BæVF–òçW6R‚’Ò6F6‚…ò’·Ò7BæVF–òÒçVÆÂÐ¢÷&5&V4Æö÷6ÆV$VF–ò‡7B¢–b‡7BæÆö÷6VVµF–ÖW"’6ÆV%F–ÖV÷WB‡7BæÆö÷6VVµF–ÖW"¢–b‡7BæÆö÷F¶R’öFVÆWFU7V´÷fW$VF–ò‡7BæÆö÷F¶RçW&Â¢òò&V6÷&F–ærÆVgB÷Vâ†öÆG2F†RÖ–7&÷†öæRæBw&—FW2–çFòf–ÆRæö&öG¢òò—2vö–ærFò6²f÷"à¢òòæ÷Bv—FVB(	BF†R6W76–öâ—2Ç&VG’vöæRâF†R6F6‚—2öâF†R&öÖ—6P¢òò&V6W6RF†R&V¦V7F–öâ'&—fW2ÆöærgFW"F†—2g&ÖR†2&WGW&æVBà¢–b‡7Bç†6RÓÓÒw&V6÷&F–ærrÇÂ7Bç†6RÓÓÒw7F'F–ærr’°¢G'’²&öÖ—6Rç&W6öÇfR…÷7V´÷fW$VF–õ'2‚w&V6÷&D6æ6VÂrÂ·Ò’’æ6F6‚‚‚’Óâ·Ò’Ò6F6‚…ò’·Ð¢Ð¢–b†F—66&B’7BçF¶W2æf÷$V6‚‡BÓâ²–b‚7Bæ¶WBæ†2‡BçW&Â’’öFVÆWFU7V´÷fW$VF–ò‡BçW&Â’Ò§Ð ¢òò7F÷F†R6Æ—w2÷vâVæB×vF6†W#¢v†–ÆRF†RÆö÷—2G&—f–ærF†RÆ–†VBÀ¢òòF†BvF6†W"v÷VÆBW6RF†Rf–FVò6öÖWv†W&Röb—G2÷vâ6†ö÷6–ærà¦gVæ7F–öâ÷&5&V5F¶T÷fW%Æ–†VB‚’°¢v–æF÷rå÷&7F–6T6Æ—Fö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÇÂ’²¢–b‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"’²6ÆV$–çFW'fÂ‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"“²v–æF÷rå÷&7F–6T6Æ—F–ÖW"ÒçVÆÂÐ§Ð ¦gVæ7F–öâ÷&5&V4æ÷r‚’°¢–b‡7÷F–g”6Æ—2…÷&5&V3òæ—FVÒ’æÆVæwF‚’°¢6öç7BF–ÖRÒ7÷F–g•Æ–W"æÖVF–òæ7W'&VçEF–ÖP¢&WGW&âçVÖ&W"æ—4f–æ—FR‡F–ÖR’òF–ÖR¢çVÆÀ¢Ð¢G'’²&WGW&â‡v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖRbbv–æF÷rç—EÆ–W"ævWD7W'&VçEF–ÖR‚’’ÇÂÐ¢6F6‚…ò’²&WGW&âÐ§Ð¦gVæ7F–öâ÷&5&V5W6Uf–FVò‚’°¢–b‡7÷F–g”6Æ—2…÷&5&V3òæ—FVÒ’æÆVæwF‚’²7÷F–g•Æ–W"æÖVF–òçW6R‚“²&WGW&âÐ¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çW6Uf–FVòbbv–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð§Ð¦gVæ7F–öâ÷&5&V5Æ•f–FVò‚’°¢–b‡7÷F–g”6Æ—2…÷&5&V3òæ—FVÒ’æÆVæwF‚’°¢–b‚v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’7÷F–g•Æ–W"æÖVF–òçÆ’‚’æ6F6‚‚‚’Óâ·Ò¢&WGW&à¢Ð¢÷&7F–6Uf–FVô7VW2æ&Vv–åÆ–&6²…öæWu&7F–6Uf–FVõ&WVW7B‚’¢G'’²v–æF÷rç—EÆ–W"bbv–æF÷rç—EÆ–W"çÆ•f–FVòbbv–æF÷rç—EÆ–W"çÆ•f–FVò‚’Ò6F6‚…ò’·Ð§Ð ¦gVæ7F–öâ÷&VæFW%&7F–6U&V4&"†æ÷FR’°¢6öç7BF&"ÒB‚r7&7F–6TÖöFRç&7F–6R×&V2Ö&"r¢–b‚F&"æÆVæwF‚’&WGW&à¢6öç7B7BÒ÷&5&V0¢B‚r7&7F–6TÖöFRç&7F–6R×Æ’r’çFövvÆT6Æ72‚w&7F–6RÖ¶VW×f—6–&ÆRrÂ÷&7F–6U7V´÷fW%6†÷vâ‚’¢B‚r7&7F–6TÖöFRç&7F–6R×7V¶÷fW"×FövvÆRr¢ç&÷‚v6†V6¶VBrÂ÷&7F–6U7V´÷fW%6†÷vâ‚’¢ç&÷‚vF—6&ÆVBrÂ7Bbb7Bç†6RÓÒv–FÆRr¢æGG"‚wF—FÆRrÂ7Bbb7Bç†6RÓÒv–FÆRròtf–æ—6‚&V6÷&F–ær÷"&WÆ’&Vf÷&R†–F–ær7V¶÷fW"r¢rr¢B‚r7&7F–6TÖöFRç&7F–6R×7V¶÷fW"ÖÖöFRr¢çfÂ‡7CòæÆö÷òvÆö÷r¢wF¶W2r¢ç&÷‚vF—6&ÆVBrÂ7BÇÂ7Bç†6RÓÒv–FÆRrÇÂ÷&7F–6U7V´÷fW%6†÷vâ‚’¢–b‚7BÇÂ÷&7F–6U7V´÷fW%6†÷vâ‚’’²F&"æ†–FR‚’æV×G’‚“²÷6WE&5&V4&$†V–v‡Bƒ“²&WGW&âÐ¢6öç7BâÒ7BçF¶W2æÆVæwF€¢6öç7BVæ¶WBÒ7BæÆö÷ò¢7BçF¶W2æf–ÇFW"‡BÓâ7Bæ¶WBæ†2‡BçW&Â’’æÆVæwF€¢6öç7B&V2Ò7Bç†6RÓÓÒw&V6÷&F–ærp¢6öç7B7F'F–ærÒ7Bç†6RÓÓÒw7F'F–ærp¢òòÖ–BÖÆö÷F†Rf–FVò—2&V–ærG&—fVâf÷"F†RW6W#²6V6öæB&V2öâF÷ö`¢òòF†Bv÷VÆB–âÖöÖVçBF†W’F–Bæ÷B6†ö÷6Rà¢6öç7B'W7’Ò7Bç†6RÓÓÒwÆ–&6²rÇÂ7Bç†6RÓÓÒw7F÷–ærp¢òò6†÷'BVæ÷Vv‚f÷"F†R6öÇVÖâ&W6–FRF†R'WGFöââv†BF†RÆöævW"v÷&F–æp¢òòW6VBFòW‡Æ–âÂF†R'WGFöâæ÷r6—2'’&V–ær&÷VæBÂ&VBæB–âF†P¢òòÖ–FFÆR(	BæB—G2FööÇF—7F–ÆÂ7VÆÇ2—B÷WBà¢6öç7B7FGW2Ò7BæÆö÷ ¢ò†æ÷FRÇÂ‡7F'F–æròu7F'F–ærÖ–7&÷†öæ^(
bp¢¢&V2òu&V6÷&F–ærv†–ÆR6Æ—Æö÷>(
bp¢¢7Bç†6RÓÓÒw7F÷–ærròtf–æ—6†–ærF¶^(
bp¢¢7BæÆö÷F¶RòtÆFW7BF¶R&WVG2÷fW"F†R6Æ—r¢t6Æ—Æö÷–ær+r6†–ÖR–âv†VæWfW"–÷RÆ–¶Rr’¢¢æ÷FRòæ÷FP¢¢7F'F–æròw7F'F–ærÖ–7&÷†öæ^(
bp¢¢&V2òw&V6÷&F–æ~(
bp¢¢7Bç†6RÓÓÒw7F÷–ærròu6f–ærF¶^(
bp¢¢7Bç†6RÓÓÒwÆ–&6²ròw–÷W"F¶Rp¢¢âòâ²†âÓÓÒòrF¶R+rr¢rF¶W2+rr’²ÖF‚ç&÷VæB…÷F¶W4GW&F–öâ‡7BçF¶W2’’²w2p¢¢u7V²÷fW"F†—26Æ—p¢òòF†R&V2'WGFöâ—2F¶Vâ÷WBöbF†R&÷rw2fÆ÷ræB–ææVBFò—G2Ö–FFÆRÂ6ð¢òòæ÷F†–ær&W6–FR—B6âW6‚—Böfb6VçG&R(	B6öÇVÖâF†B&VgW6W2Fò6‡&–æ°¢òòFò—G26†&RÆVfW2F†R'WGFöâv†W&WfW"F†RÆVgF÷fW'2WB—BÂæBv†–6€¢òòVæv–æRFöW2F†B—2æ÷Bv÷'F‚f–æF–ær÷WBöæRFWf–6RBF–ÖRà¢F&"æV×G’‚’æVæB€¢B‚sÆF—b6Æ73Ò'&V2×&÷r#ãÂöF—câr’æVæB€¢B‚sÇ7â6Æ73Ò'&V2×7FGW2#ãÂ÷7ãâr’çFW‡B‡7FGW2’À¢B‚sÇ7â6Æ73Ò'&V2×6–FR#ãÂ÷7ãâr’çFövvÆR‚7BæÆö÷’æVæB€¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö'Fâ&V2Ö¶VW#ãÂö'WGFöãâr¢çFW‡B‡Væ¶WBò~)ÉB¶VWr²Væ¶WB¢~)ÉB¶VWr¢ç&÷‚vF—6&ÆVBrÂVæ¶WBÇÂ&V2ÇÂ7F'F–ærÇÂ'W7’¢æGG"‚wF—FÆRrÂu6fRF†W6RF¶W2öâF†R6&Br’À¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö'Fâ&V2ÖG&÷#ï	ùyÂö'WGFöãâr¢ç&÷‚vF—6&ÆVBrÂVæ¶WBÇÂ&V2ÇÂ7F'F–ærÇÂ'W7’¢æGG"‚wF—FÆRrÂuF‡&÷rv’F†RF¶W2F†BvW&RæWfW"¶WBr¢’À¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö'Fâ&V2×FövvÆR#ãÂö'WGFöãâr¢çFW‡B‡7F'F–ærò~)ÉRr¢&V2ò~(û‚r¢~)xòr¢çFövvÆT6Æ72‚vöârÂ&V2¢ç&÷‚vF—6&ÆVBrÂ'W7’¢æGG"‚v&–ÖÆ&VÂrÂ7F'F–æròt6æ6VÂ&V6÷&F–ær7F'Br¢&V2òu7F÷&V6÷&F–ærr¢u&V2r¢æGG"‚wF—FÆRrÂ7F'F–æròt6æ6VÂÖ–7&÷†öæR7F'GWp¢¢&V2ò‡7BæÆö÷òu7F÷æB†V"ÆFW7BF¶R÷fW"Æö÷–ær6Æ—r¢u7F÷æB†V"—B&6²–âÆ6Rr¢¢‡7BæÆö÷òu&V6÷&Bv†–ÆR6Æ—6öçF–çVW2Æö÷–ærr¢u&V6÷&B÷fW"F†R6Æ—g&öÒ†W&Rr’¢¢¢òòöæR6ÖÆÂ'WGFöâW"F¶RÂçVÖ&W&VBF†Rv’F†W’6—B–âF†R6Æ—ÂFò†V ¢òòç’öbF†VÒ&6²v—F†÷WB†f–ærFòÆ’WFò—G2Ö&²âF†V—"÷vâ&÷r6ð¢òòF†W’vWBF†Rv†öÆRv–GF‚&F†W"F†â7VVW¦–ærF†R6öÇVÖâ&W6–FRF†R&V0¢òò'WGFöâÂæB&÷rF†B—2öæÇ’F†W&Rv†VâF†W&R—26öÖWF†–æröâ—Bà¢–b‡7BæÆö÷bb7BæÆö÷F¶R’°¢F&"æVæB‚B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö'Fâ&V2ÖÆö÷×&WÆ’#ãÂö'WGFöãâr¢çFW‡B‚~(k²Æ—7FVâFòÆFW7BF¶Rv–âr¢ç&÷‚vF—6&ÆVBrÂ7Bç†6RÓÒv–FÆRr’¢Ð¢–b†âbb7BæÆö÷’°¢6öç7BGF¶W2ÒB‚sÇ7â6Æ73Ò'&V2×F¶W2#ãÂ÷7ãâr¢7BçF¶W2æf÷$V6‚‚‡F²Â’’Óâ°¢GF¶W2æVæB€¢B‚sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&V2Ö'Fâ&V2×F¶R#ãÂö'WGFöãâr¢çFW‡B…7G&–ær†’²’¢æGG"‚vFF×CrÂ7G&–ær‡F²çC’¢çFövvÆT6Æ72‚wVæ¶WBrÂ7Bæ¶WBæ†2‡F²çW&Â’¢ç&÷‚vF—6&ÆVBrÂ&V2ÇÂ7F'F–ærÇÂ'W7’¢æGG"‚wF—FÆRrÂt&6²FòF¶Rr²†’²’²r‚r°¢÷F¶Töfg6WDÆ&VÂ‡F²Â7Bæ6Æ—7F'B’²r’æBÆ’—Br¢¢Ò¢F&"æVæB‚GF¶W2¢Ð¢F&"ç6†÷r‚¢÷6WE&5&V4&$†V–v‡B‚F&%³Òæöfg6WD†V–v‡B¢÷vF6…&5&V4&$†V–v‡B‚F&%³Ò§Ð ¢òòF†R&"Ç6ò6†ævW26—¦Rv—F†÷WB&V–ær&R×&VæFW&VC¢†–FFVâv†–ÆR&7F–6P¢òò—2Ö–æ–Ö—¦VBæB&6²öâ&W7F÷&RÂ&R×w&VB'’&÷FF–öââföÆÆ÷r—G26—¦Rà¦gVæ7F–öâ÷vF6…&5&V4&$†V–v‡B†&"’°¢–b‚&"ÇÂ&"å÷&V56—¦UvF6†VBÇÂG—Vöb&W6—¦Tö'6W'fW"ÓÒvgVæ7F–öâr’&WGW&à¢&"å÷&V56—¦UvF6†VBÒG'VP¢æWr&W6—¦Tö'6W'fW"‚‚’Óâ÷6WE&5&V4&$†V–v‡B†&"æöfg6WD†V–v‡B’’æö'6W'fR†&"§Ð ¢òòF†R&"—2–ææVB÷fW"F†Rfö÷BöbF†R67&VVã²F†R6&BVæG2&÷fR—B6ð¢òò—G2Æ7BÆ–æW26â7F–ÆÂ&R67&öÆÆVB–çFòf–WrâÖV7W&VBöâWfW'’&VæFW# ¢òòF†R&÷röbF¶W26öÖW2æBvöW2ÂæBF†R&"w&2öâæ'&÷r67&VVâà¦gVæ7F–öâ÷6WE&5&V4&$†V–v‡B‡‚’°¢6öç7BVÂÒFö7VÖVçBævWDVÆVÖVçD'”–B‚w&7F–6TÖöFRr¢–b‚VÂ’&WGW&à¢–b‡‚â’VÂç7G–ÆRç6WE&÷W'G’‚rÒ×&V2Ö&"Ö‚rÂ‚²w‚r¢VÇ6RVÂç7G–ÆRç&VÖ÷fU&÷W'G’‚rÒ×&V2Ö&"Ö‚r§Ð ¢òò&W72æB†öÆBF¶RFòFVÆWFR—BâF–ærÆ—2—BÂv†–6‚—2F†R6öÖÖöà¢òòF†–ærFòvçBÂ6òFVÆWF–ær—2F†RFVÆ–&W&FRvW7GW&R&F†W"F†â6V6öæ@¢òòF&vWB7&÷vF–ær'WGFöâF†Rv–GF‚öbf–ævW'F—à¦6öç7B$T5ô„ôÄEôÕ2ÒS ¦6öç7B$T5ô„ôÄEõ4ÄõÒ ¦ÆWB÷&V4†öÆBÒçVÆÀ ¦gVæ7F–öâ÷&V4†öÆD6ÆV"‚’°¢–b…÷&V4†öÆBbb÷&V4†öÆBçF–ÖW"’6ÆV%F–ÖV÷WB…÷&V4†öÆBçF–ÖW"¢B‚r7&7F–6TÖöFRç&V2×F¶Rr’ç&VÖ÷fT6Æ72‚w&V2×F¶RÖ†öÆF–ærr¢÷&V4†öÆBÒçVÆÀ§Ð ¦gVæ7F–öâ÷&V5ö–çB†R’°¢6öç7BöRÒRæ÷&–v–æÄWfVçBÇÂP¢6öç7BBÒöRçF÷V6†W2bböRçF÷V6†W5³Ð¢&WGW&âBò²ƒ¢Bæ6Æ–VçE‚Â“¢Bæ6Æ–VçE’Ò¢²ƒ¢öRæ6Æ–VçE‚Â“¢öRæ6Æ–VçE’Ð§Ð ¦gVæ7F–öâ÷&5&V4†öÆE7F'B†R’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7Bç†6RÓÒv–FÆRr’&WGW&à¢6öç7BVÂÒRæ7W'&VçEF&vW@¢6öç7BCÒçVÖ&W"‚B†VÂ’æGG"‚vFF×Cr’¢–b‚—4f–æ—FR‡C’’&WGW&à¢÷&V4†öÆD6ÆV"‚¢6öç7BBÒ÷&V5ö–çB†R¢6öç7B7F'FVBÒ²VÂÂCÂƒ¢Bç‚Â“¢Bç’Âf—&VC¢fÇ6RÂF–ÖW#¢çVÆÂÐ¢7F'FVBçF–ÖW"Ò6WEF–ÖV÷WB‚‚’Óâ°¢–b…÷&V4†öÆBÓÒ7F'FVB’&WGW&à¢7F'FVBæf—&VBÒG'VP¢B†VÂ’ç&VÖ÷fT6Æ72‚w&V2×F¶RÖ†öÆF–ærr¢÷&5&V4FVÆWFUF¶R‡C¢ÒÂ$T5ô„ôÄEôÕ2¢÷&V4†öÆBÒ7F'FV@¢B†VÂ’æFD6Æ72‚w&V2×F¶RÖ†öÆF–ærr§Ð ¢òòf–ævW"F†BG&fVÇ2v267&öÆÆ–ærÂæ÷B†öÆF–ærà¦gVæ7F–öâ÷&5&V4†öÆDÖ÷fR†R’°¢–b‚÷&V4†öÆB’&WGW&à¢6öç7BBÒ÷&V5ö–çB†R¢–b„ÖF‚æ'2†Bç‚Ò÷&V4†öÆBç‚’â$T5ô„ôÄEõ4ÄõÇÀ¢ÖF‚æ'2†Bç’Ò÷&V4†öÆBç’’â$T5ô„ôÄEõ4Äõ’÷&V4†öÆD6ÆV"‚§Ð ¦gVæ7F–öâ÷&5&V4†öÆDVæB‚’°¢òò†öÆBF†Bf—&VB†2Ç&VG’FöæR—G2v÷&³²F†R6Æ–6²F†BföÆÆ÷w2—@¢òò×W7Bæ÷BF†VâÆ’F†RF¶RF†B—2æòÆöævW"F†W&Rà¢–b…÷&V4†öÆBbb÷&V4†öÆBæf—&VB’²÷&V4†öÆBÒçVÆÃ²÷&V4†öÆE7vÆÆ÷t6Æ–6²ÒG'VS²&WGW&âÐ¢÷&V4†öÆD6ÆV"‚§Ð¦ÆWB÷&V4†öÆE7vÆÆ÷t6Æ–6²ÒfÇ6P ¦gVæ7F–öâ÷&5&V4FVÆWFUF¶R‡C’°¢6öç7B7BÒ÷&5&V0¢–b‚7B’&WGW&à¢6öç7BF²Ò÷F¶TB‡7BçF¶W2ÂC¢–b‚F²’&WGW&à¢6öç7BâÒ7BçF¶W2æ–æFW„öb‡F²’²¢–b‚6öæf—&Ò‚tFVÆWFRF¶Rr²â²r‚r²÷F¶Töfg6WDÆ&VÂ‡F²Â7Bæ6Æ—7F'B’²r“òr’’&WGW&à¢–b…÷&5&V2ÓÒ7B’&WGW&à¢6öç7B&W2Ò÷&VÖ÷fUF¶R‡7BçF¶W2ÂC¢7BçF¶W2Ò&W2çF¶W0¢–b‡&W2ç&VÖ÷fVB’°¢òòF¶RF†R6&BÇ&VG’ö–çG2B6ææ÷B&RFVÆWFVBVçF–Â¶VW†0¢òò&Ww&—GFVâF†RÆ—7C²öæRF†Bv2öæÇ’WfW"67&F6‚6âvòæ÷rà¢–b‡7Bæ¶WBæ†2‡&W2ç&VÖ÷fVBçW&Â’’²7Bæ÷'†ç2çW6‚‡&W2ç&VÖ÷fVBçW&Â“²7Bæ¶WBæFVÆWFR‡&W2ç&VÖ÷fVBçW&Â’Ð¢VÇ6RöFVÆWFU7V´÷fW$VF–ò‡&W2ç&VÖ÷fVBçW&Â¢Ð¢òòæ÷F†–ær—2v—F–ærf÷"Ö&²F†BæòÆöævW"W†—7G2à¢–b‡7Bæv—F–ærÒçVÆÂbbÖF‚æ'2„çVÖ&W"‡7Bæv—F–ær’ÒC’ÃÒD´Uõ4ÔUõ5õEõ2’7Bæv—F–ærÒçVÆÀ¢÷&VæFW%&7F–6U&V4&"‚wF¶Rr²â²rFVÆWFVBr§Ð ¢òòvòFòF¶RæB†V"—BâF†R6ÖRÆö÷f–æ—6†VB&V6÷&F–ær'Vç3¢&6²Fð¢òòF†RÖ&²&Vf÷&RF†—2öæRÂÆ’F†R7G&WF6‚—Bv27ö¶Vâ÷fW"ÂF†VâF†RF¶P¢òò—G6VÆb(	B6òF¶R6â&R&Wf–WvVBv—F†÷WBÆ––ærWFò—Bg&öÒv†W&WfW ¢òòF†Rf–FVò†Vç2Fò&Rà¦gVæ7F–öâ÷&5&V4võFõF¶R†R’°¢–b…÷&V4†öÆE7vÆÆ÷t6Æ–6²’²÷&V4†öÆE7vÆÆ÷t6Æ–6²ÒfÇ6S²&WGW&âÐ¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7Bç†6RÓÒv–FÆRr’&WGW&à¢6öç7BCÒçVÖ&W"‚B†Ræ7W'&VçEF&vWB’æGG"‚vFF×Cr’¢–b‚—4f–æ—FR‡C’’&WGW&à¢÷&5&V5F¶T÷fW%Æ–†VB‚¢÷&5&V5&WÆ’‡C§Ð ¦gVæ7F–öâ÷&5&V5FövvÆR‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ÷&7F–6U7V´÷fW%6†÷vâ‚’’&WGW&à¢–b‡7BæÆö÷’°¢–b‡7Bç†6RÓÓÒw7F'F–ærr’²÷&5&V46æ6VÄ6GW&R‡7B“²&WGW&âÐ¢–b‡7Bç†6RÓÓÒw&V6÷&F–ærr’²÷&5&V4Æö÷7F÷‚“²&WGW&âÐ¢–b‡7Bç†6RÓÓÒv–FÆRr’÷&5&V4Æö÷7F'B‚¢&WGW&à¢Ð¢–b‡7Bç†6RÓÓÒw7F'F–ærr’²÷&5&V46æ6VÄ6GW&R‡7B“²&WGW&âÐ¢–b‡7Bç†6RÓÓÒw&V6÷&F–ærr’²÷&5&V57F÷‚“²&WGW&âÐ¢–b‡7Bç†6RÓÒv–FÆRr’&WGW&à¢÷&5&V57F'B‚§Ð ¦gVæ7F–öâö6æ6VÅ7V´÷fW$6GW&R‚’°¢öÆö6Å7V´÷fW"æ6æ6VÂ‚¢–b…÷&5&V2’÷&5&V46æ6VÄ6GW&R…÷&5&V2§Ð ¦gVæ7F–öâ÷&5&V46æ6VÄ6GW&R‡7B’°¢–b…÷&5&V2ÓÒ7BÇÂ‡7Bç†6RÓÒw7F'F–ærrbb7Bç†6RÓÒw&V6÷&F–ærr’’&WGW&à¢7BçFö¶Vâ²°¢7Bç†6RÒv–FÆRs²7BçCÒçVÆÃ²7BçW&ÂÒçVÆÀ¢&öÖ—6Rç&W6öÇfR…÷7V´÷fW$VF–õ'2‚w&V6÷&D6æ6VÂrÂ·Ò’’æ6F6‚‚‚’Óâ·Ò¢÷&VæFW%&7F–6U&V4&"‚w&V6÷&F–ær6æ6VÆÆVBr§Ð ¦gVæ7F–öâ÷&5&V57F'DW'&÷"†W'&÷"’°¢6öç7BÖW76vRÒ7G&–ær†W'&÷#òæÖW76vRÇÂW'&÷"ÇÂrr¢–b‚÷W&Ö—76–öçÆFVæ–VBö’çFW7B†ÖW76vR’’&WGW&âtÖ–7&÷†öæRW&Ö—76–öâæVVFVBâÆÆ÷rÖ–7&÷†öæR66W72f÷"F†—26—FR÷"âp¢–b‚ö'W7’ö’çFW7B†ÖW76vR’’&WGW&âtÖ–7&÷†öæR—2'W7’â7F÷÷F†W"&V6÷&F–æræBG'’v–ââp¢–b‚ö6æ6VÂö’çFW7B†ÖW76vR’’&WGW&âw&V6÷&F–ær6æ6VÆÆVBp¢&WGW&âtÖ–7&÷†öæR6÷VÆBæ÷B7F'BâG'’&V6÷&F–ærv–ââp§Ð ¦7–æ2gVæ7F–öâ÷&5&V57F'B‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7Bç†6RÓÒv–FÆRr’&WGW&à¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢6öç7BCÒ÷&5&V4æ÷r‚’ÇÂ7Bæ6Æ—7F'@¢7Bæv—F–ærÒçVÆÀ¢6öç7BFö¶VâÒ²·7BçFö¶Và¢òò6Æ–Ò&Vf÷&RW&Ö—76–öç2÷"'&–FvRv—C¢6V6öæBF6æ6VÇ2F†—0¢òò7F'B–ç7FVBöbÆVæ6†–æræ÷F†W"&V6÷&FW"v–ç7BF†R6ÖRÖ–7&÷†öæRà¢7Bç†6RÒw7F'F–ærs²7BçCÒC²7BçW&ÂÒçVÆÀ¢6öç7B7W'&VçBÒ‚’Óâ÷&5&V2ÓÓÒ7Bbb7BçFö¶VâÓÓÒFö¶Vâbb7Bç†6RÓÓÒw7F'F–ærp¢÷&5&V5F¶T÷fW%Æ–†VB‚¢÷&5&V5W6Uf–FVò‚¢÷&VæFW%&7F–6U&V4&"‚¢ÆWBW&ÒÒwVæ¶æ÷vâp¢G'’²W&ÒÒv—BVç7W&TÖ–5W&Ö—76–öåf–'&–FvR‚’Ò6F6‚…ò’·Ð¢–b‚7W'&VçB‚’’&WGW&à¢–b‡W&ÒÓÓÒvFVæ–VBr’°¢7Bç†6RÒv–FÆRs²7BçCÒçVÆÀ¢÷&VæFW%&7F–6U&V4&"‚tÖ–7&÷†öæRW&Ö—76–öâæVVFVBâr¢ÆW'B‚tÖ–7&÷†öæRW&Ö—76–öâv2FVæ–VBâÆÆ÷rÖ–7&÷†öæR66W72–â–÷W"'&÷w6W"÷"6WGF–æw2âr¢&WGW&à¢Ð¢6öç7B–BÒw&V5òr²FFRææ÷r‚’çFõ7G&–ærƒ3b’²ÖF‚ç&æFöÒ‚’çFõ7G&–ærƒ3b’ç6Æ–6Rƒ"Âb¢ÆWBW&À¢G'’°¢W&ÂÒv—B÷7V´÷fW$VF–õ'2‚w&V6÷&E7F'BrÂ²–BÒ¢–b‚W&Â’F‡&÷ræWrW'&÷"‚w7F'BÖf–ÆVBr¢Ò6F6‚†R’°¢–b†7W'&VçB‚’’°¢7Bç†6RÒv–FÆRs²7BçCÒçVÆÀ¢÷&VæFW%&7F–6U&V4&"…÷&5&V57F'DW'&÷"†R’¢Ð¢6öç6öÆRçv&â‚u·&7F–6U&V5Ò&V6÷&E7F'Bf–ÆVBrÂR¢&WGW&à¢Ð¢–b‚7W'&VçB‚’’°¢òòVæBö6æ6VÂÇ&VG’6VçB&V6÷&D6æ6VÂâæWfW"6VæBÆFRvÆö&Â7F÷ ¢òòF†RW6W"Ö’æ÷r&R&V6÷&F–ærF–ffW&VçB6&Bà¢–b‡W&Â’öFVÆWFU7V´÷fW$VF–ò‡W&Â¢&WGW&à¢Ð¢7Bç†6RÒw&V6÷&F–ærp¢7Bç7F'FVD×2ÒFFRææ÷r‚¢7BçW&ÂÒW&À¢÷&VæFW%&7F–6U&V4&"‚§Ð ¦7–æ2gVæ7F–öâ÷&5&V57F÷‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7Bç†6RÓÒw&V6÷&F–ærr’&WGW&à¢6öç7BFö¶VâÒ²·7BçFö¶Và¢6öç7BCÒ7BçC¢6öç7B×2ÒFFRææ÷r‚’Ò7Bç7F'FVD×0¢òò'&÷w6W"7F÷&vRÖ’F¶RÖöÖVçBâ6Æ–ÒF†R7F÷7F–öâ&Vf÷&Rv—F–æp¢òò—B6òGvò&–BF2Fòæ÷B&6R÷fW"F†R6ÖR&V6÷&FW"æB—G2'—FW2à¢7Bç†6RÒw7F÷–ærp¢÷&VæFW%&7F–6U&V4&"‚¢ÆWBW&ÂÒçVÆÀ¢G'’²W&ÂÒv—B÷7V´÷fW$VF–õ'2‚w&V6÷&E7F÷rÂ·Ò’Ð¢6F6‚†R’²6öç6öÆRçv&â‚u·&7F–6U&V5Ò&V6÷&E7F÷f–ÆVBrÂR’Ð¢–b…÷&5&V2ÓÒ7BÇÂFö¶VâÓÒ7BçFö¶Vâ’²–b‡W&Â’öFVÆWFU7V´÷fW$VF–ò‡W&Â“²&WGW&âÐ¢7Bç†6RÒv–FÆRp¢7BçCÒçVÆÀ¢7BçW&ÂÒçVÆÀ¢òòF'Bç7vW'2çVÆÂv†VâF†W&Rv2æ÷BVæ÷Vv‚VF–òFò¶VWà¢–b‚W&Â’²÷&VæFW%&7F–6U&V4&"‚væ÷F†–ær&V6÷&FVB(	B†öÆB—BÆöævW"r“²&WGW&âÐ¢6öç7B&W2ÒöFEF¶R‡7BçF¶W2Â²CÂW&ÂÂ×2Ò¢7BçF¶W2Ò&W2çF¶W0¢–b‡&W2ç&WÆ6VB’°¢òòF¶RF†R6&BÇ&VG’ö–çG2B6ææ÷B&RFVÆWFVBVçF–Â¶VW†0¢òò&Ww&—GFVâF†RÆ—7C²öæRF†Bv2öæÇ’WfW"67&F6‚6âvòæ÷rà¢–b‡7Bæ¶WBæ†2‡&W2ç&WÆ6VBçW&Â’’²7Bæ÷'†ç2çW6‚‡&W2ç&WÆ6VBçW&Â“²7Bæ¶WBæFVÆWFR‡&W2ç&WÆ6VBçW&Â’Ð¢VÇ6RöFVÆWFU7V´÷fW$VF–ò‡&W2ç&WÆ6VBçW&Â¢Ð¢÷&VæFW%&7F–6U&V4&"‚¢÷&5&V5&WÆ’‡C§Ð ¢òò6öçF–çV÷W2Æö÷ÖöFR—2–çFVçF–öæÆÇ’6W&FRg&öÒF†RF–ÖW7F×VB×F¶W0¢òòv÷&¶fÆ÷râF†R6÷W&6R6öçF–çVW2Æ––ærv†–ÆRF†RÖ–2—2÷Vã²öæÇ’F†P¢òòÆFW7B67&F6‚&V6÷&F–ær—2VF–&ÆR÷fW"F†R6÷W&6Röâ7V'6WVVçBÆö÷2à¢òòæ÷F†–ær—26fVBFòF†RÆ–Æ—7BVçF–ÂF†RW6W"W‡Æ–6—FÇ’6†ö÷6W2F†P¢òòæ÷&ÖÂ¶VWv÷&¶fÆ÷rà¦gVæ7F–öâ÷&5&V4Æö÷6ÆV$VF–ò‡7B’°¢7BæÆö÷Fö¶VâÒ‡7BæÆö÷Fö¶VâÇÂ’²¢–b‡7BæÆö÷VF–ò’°¢G'’²7BæÆö÷VF–òçW6R‚’Ò6F6‚…ò’·Ð¢7BæÆö÷VF–òÒçVÆÀ¢Ð§Ð ¦gVæ7F–öâ÷&5&V4Æö÷6VV²‡7BÂ²&W6W'fTVF–òÒfÇ6RÂ7F'BÒçVÖ&W"‡7Bæ6Æ—7F'B’ÇÂÒÒ·Ò’°¢–b…÷&5&V2ÓÒ7BÇÂ7BæÆö÷ÇÂv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÇÂv–æF÷rå÷&7F–6T7F—fR’&WGW&à¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢7BæÆö÷7W7VæFVBÒfÇ6P¢÷&5&V5F¶T÷fW%Æ–†VB‚¢òòF¶R6â&RÆöævW"F†â6–ævÆRÆö÷â¶VWF†B&V6÷&F–ærVF–&ÆP¢òò7&÷726÷W&6R&Wv–æG2–ç7FVBöb7WGF–ær—B6†÷'BBF†R6Æ—&÷VæF'’à¢6öç7B7V¶–ærÒ&W6W'fTVF–òbb7BæÆö÷VF–òbb7BæÆö÷VF–òçW6VBbb7BæÆö÷VF–òæVæFV@¢–b‚7V¶–ær’÷&5&V4Æö÷6ÆV$VF–ò‡7B¢–b‡7BæÆö÷6VVµF–ÖW"’6ÆV%F–ÖV÷WB‡7BæÆö÷6VVµF–ÖW"¢7BæÆö÷6VV¶–ærÒG'VP¢7BæÆö÷Æ–VBÒ7V¶–æp¢7BçvF6…÷2ÒçVÆÀ¢–b‡7÷F–g”6Æ—2‡7Bæ—FVÒ’æÆVæwF‚’°¢G'’°¢–b‚7÷F–g•Æ–W"ç6VVµ&7F–6R‡7Bæ—FVÒÂ7F'B’’°¢7BæÆö÷6VV¶–ærÒfÇ6P¢÷&VæFW%&7F–6U&V4&"‚t6ææ÷BÆö÷F†—27÷F–g’6Æ—r¢&WGW&à¢Ð¢Ò6F6‚…ò’²7BæÆö÷6VV¶–ærÒfÇ6S²&WGW&âÐ¢ÒVÇ6R°¢G'’²v–æF÷rç—EÆ–W#òç6VVµFò‡7F'BÂG'VR’Ò6F6‚…ò’·Ð¢Ð¢7BæÆö÷6VVµF–ÖW"Ò6WEF–ÖV÷WB‚‚’Óâ²7BæÆö÷6VV¶–ærÒfÇ6S²7BæÆö÷6VVµF–ÖW"ÒçVÆÂÒÂ¢÷&5&V5Æ•f–FVò‚§Ð ¦gVæ7F–öâ÷&5&V4Æö÷FövvÆR‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7Bç†6RÓÒv–FÆRrÇÂ÷&7F–6U7V´÷fW%6†÷vâ‚’’&WGW&à¢–b‡7BæÆö÷’°¢7BæÆö÷ÒfÇ6P¢÷&5&V4Æö÷6ÆV$VF–ò‡7B¢–b‡7BæÆö÷6VVµF–ÖW"’6ÆV%F–ÖV÷WB‡7BæÆö÷6VVµF–ÖW"¢7BæÆö÷6VV¶–ærÒfÇ6P¢–b‡7BæÆö÷F¶R’öFVÆWFU7V´÷fW$VF–ò‡7BæÆö÷F¶RçW&Â¢7BæÆö÷F¶RÒçVÆÀ¢7BçvF6…÷2ÒçVÆÀ¢÷&5&V5W6Uf–FVò‚¢÷&VæFW%&7F–6U&V4&"‚¢&WGW&à¢Ð¢7BæÆö÷ÒG'VP¢7Bæv—F–ærÒçVÆÀ¢÷&VæFW%&7F–6U&V4&"‚tÆö÷–ærF†R6Æ—+r&V6÷&Bv†VæWfW"–÷RÆ–¶Rr¢÷&5&V5&Vg&W6„6Æ—‡7B’çF†Vâ‚‚’Óâ°¢–b…÷&5&V2ÓÒ7BÇÂ7BæÆö÷’&WGW&à¢–b‚çVÖ&W"æ—4f–æ—FR„çVÖ&W"‡7Bæ6Æ—7F÷’’ÇÀ¢çVÖ&W"‡7Bæ6Æ—7F÷’ÃÒçVÖ&W"‡7Bæ6Æ—7F'B’’°¢7Bæ6Æ—7F÷ÒçVÖ&W"‡7Bæ6Æ—7F'B’²P¢Ð¢÷&5&V4Æö÷6VV²‡7B¢Ò’æ6F6‚†W'&÷"Óâ÷&VæFW%&7F–6U&V4&"…7G&–ær†W'&÷#òæÖW76vRÇÂW'&÷"’’§Ð ¦7–æ2gVæ7F–öâ÷&5&V4Æö÷7F'B‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7BæÆö÷ÇÂ7Bç†6RÓÒv–FÆRr’&WGW&âfÇ6P¢–b‡7BæÆö÷7W7VæFVB’÷&5&V4Æö÷6VV²‡7B¢òòF†RÖ–7&÷†öæR×W7B6GW&RF†RW6W"w2æWrfö–6RÂæ÷BF†R&Wf–÷W0¢òòF¶R7F–ÆÂ6÷VæF–ær÷fW"F†R6Æ—à¢÷&5&V4Æö÷6ÆV$VF–ò‡7B¢6öç7BFö¶VâÒ²·7BçFö¶Và¢7Bç†6RÒw7F'F–ærp¢÷&VæFW%&7F–6U&V4&"‚¢6öç7B7W'&VçBÒ‚’Óâ÷&5&V2ÓÓÒ7Bbb7BçFö¶VâÓÓÒFö¶Vâb`¢7BæÆö÷bb7Bç†6RÓÓÒw7F'F–ærp¢G'’°¢6öç7BW&Ö—76–öâÒv—BVç7W&TÖ–5W&Ö—76–öåf–'&–FvR‚¢–b‚7W'&VçB‚’’&WGW&âfÇ6P¢–b‡W&Ö—76–öâÓÓÒvFVæ–VBr’F‡&÷ræWrW'&÷"‚tÖ–7&÷†öæRW&Ö—76–öâFVæ–VBr¢6öç7B–BÒw&V6Æö÷òr²FFRææ÷r‚’çFõ7G&–ærƒ3b’²uòr²Fö¶Và¢6öç7BW&ÂÒv—B÷7V´÷fW$VF–õ'2‚w&V6÷&E7F'BrÂ²–BÒ¢–b‚7W'&VçB‚’’°¢–b‡W&Â’öFVÆWFU7V´÷fW$VF–ò‡W&Â¢&WGW&âfÇ6P¢Ð¢–b‚W&Â’F‡&÷ræWrW'&÷"‚tÖ–7&÷†öæRF–Bæ÷B7F'Br¢òòF†R7F'BÖ&²—26×ÆVBeDU"W&Ö—76–öâ—2w&çFVBæBF†R&V6÷&FW ¢òò&Vv–ç2â&V6÷&F–ær7F'FVBv†–ÆRF†R6Æ——2BCÓ#×W7Bæ÷B&R&WÆ–V@¢òòBF†RF–ÖRF†RW6W"f—'7B6Æ–6¶VBv†–ÆRw&çF–ærW&Ö—76–öç2à¢6öç7Bæ÷rÒ÷&5&V4æ÷r‚¢7BçCÒçVÖ&W"æ—4f–æ—FR†æ÷r’bbæ÷rãÒ7Bæ6Æ—7F'Bbbæ÷rÂ7Bæ6Æ—7F÷ ¢òæ÷r¢7Bæ6Æ—7F'@¢7BçW&ÂÒW&À¢7Bç7F'FVD×2ÒFFRææ÷r‚¢7Bç†6RÒw&V6÷&F–ærp¢òò÷Væ–ærF†RÖ–7&÷†öæR6âW6RF†RÖVF–v†–ÆRF†R&V6÷&FW"F¶W0¢òòfö7W2â&V76W'BÆö÷Æ–&6²gFW"7F'GWv—F†÷WB&Wv–æF–ærF†R6Æ—à¢÷&5&V5Æ•f–FVò‚¢÷&VæFW%&7F–6U&V4&"‚¢&WGW&âG'VP¢Ò6F6‚†W'&÷"’°¢–b†7W'&VçB‚’’°¢7Bç†6RÒv–FÆRp¢7BçCÒçVÆÀ¢÷&VæFW%&7F–6U&V4&"…÷&5&V57F'DW'&÷"†W'&÷"’¢Ð¢&WGW&âfÇ6P¢Ð§Ð ¦7–æ2gVæ7F–öâ÷&5&V4Æö÷7F÷‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7BæÆö÷ÇÂ7Bç†6RÓÒw&V6÷&F–ærr’&WGW&âfÇ6P¢6öç7BFö¶VâÒ²·7BçFö¶Và¢6öç7BCÒ7BçC¢6öç7B×2ÒFFRææ÷r‚’Ò7Bç7F'FVD×0¢7Bç†6RÒw7F÷–ærp¢÷&VæFW%&7F–6U&V4&"‚¢ÆWBW&ÂÒçVÆÀ¢G'’²W&ÂÒv—B÷7V´÷fW$VF–õ'2‚w&V6÷&E7F÷rÂ·Ò’Ð¢6F6‚†W'&÷"’²6öç6öÆRçv&â‚u·&7F–6U&V5ÒÆö÷7F÷f–ÆVBrÂW'&÷"’Ð¢–b…÷&5&V2ÓÒ7BÇÂFö¶VâÓÒ7BçFö¶VâÇÂ7BæÆö÷ÇÂv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’°¢–b‡W&Â’öFVÆWFU7V´÷fW$VF–ò‡W&Â¢–b…÷&5&V2ÓÓÒ7B’²7Bç†6RÒv–FÆRs²7BçCÒçVÆÃ²7BçW&ÂÒçVÆÃ²÷&VæFW%&7F–6U&V4&"‚’Ð¢&WGW&âfÇ6P¢Ð¢7Bç†6RÒv–FÆRp¢7BçCÒçVÆÀ¢7BçW&ÂÒçVÆÀ¢–b‚W&Â’²÷&VæFW%&7F–6U&V4&"‚tæ÷F†–ær&V6÷&FVC²G'’ÆöævW"F¶Rr“²&WGW&âfÇ6RÐ¢6öç7B&Wf–÷W2Ò7BæÆö÷F¶P¢7BæÆö÷F¶RÒ²W&ÂÂCÂ×2Ð¢–b‡&Wf–÷W2bb&Wf–÷W2çW&ÂÓÒW&Â’öFVÆWFU7V´÷fW$VF–ò‡&Wf–÷W2çW&Â¢òò†V"F†RÆ7BF¶R–â6öçFW‡BÂv—F‚F†R6÷W&6R7F–ÆÂ6÷VæF–ærVæFW&æVF‚à¢òògWGW&RÆö÷2&WVBF†BöæRF¶RÂæWfW"F†RV&Æ–W"&V6÷&F–æw2à¢÷&5&V4Æö÷6VV²‡7B¢÷&VæFW%&7F–6U&V4&"‚tÆFW7BF¶R+rÆ––ær÷fW"F†R6Æ—r¢&WGW&âG'VP§Ð ¦7–æ2gVæ7F–öâ÷&5&V4Æö÷Æ•F¶R‡7BÂF¶R’°¢÷&5&V4Æö÷6ÆV$VF–ò‡7B¢6öç7BFö¶VâÒ7BæÆö÷Fö¶Và¢ÆWBFFÒçVÆÀ¢G'’²FFÒv—BöÆöE7V´÷fW$VF–ò‡F¶RçW&Â’Ò6F6‚…ò’·Ð¢–b‚FFÇÂ÷&5&V2ÓÒ7BÇÂ7BæÆö÷ÇÂFö¶VâÓÒ7BæÆö÷Fö¶VâÇÀ¢7Bç†6RÓÒv–FÆRrÇÂ7BæÆö÷F¶RÓÒF¶R’&WGW&à¢6öç7BVF–òÒæWrVF–ò†FF¢7BæÆö÷VF–òÒVF–ð¢VF–òæFDWfVçDÆ—7FVæW"‚vVæFVBrÂ‚’Óâ²–b‡7BæÆö÷VF–òÓÓÒVF–ò’7BæÆö÷VF–òÒçVÆÂÒÂ¶öæ6S§G'VWÒ¢VF–òæFDWfVçDÆ—7FVæW"‚vW'&÷"rÂ‚’Óâ²–b‡7BæÆö÷VF–òÓÓÒVF–ò’7BæÆö÷VF–òÒçVÆÂÒÂ¶öæ6S§G'VWÒ¢G'’°¢6öç7BÒVF–òçÆ’‚¢–b‡òæ6F6‚’æ6F6‚‚‚’Óâ°¢–b‡7BæÆö÷VF–òÓÓÒVF–ò’²7BæÆö÷VF–òÒçVÆÃ²÷&VæFW%&7F–6U&V4&"‚uF&WÆ’FòÆÆ÷rVF–òr’Ð¢Ò¢Ò6F6‚…ò’²7BæÆö÷VF–òÒçVÆÂÐ§Ð ¢òòvF6‚F†RÆ–†VBf÷"F†Rv†öÆRF–ÖRF†R6&B—2öâ67&VVâÂæBÆ’¢òòF¶Rv†VæWfW"Æ–&6²7&÷76W2—G2Ö&²âæ÷B§W7B–âF†R72F†B&V6÷&FV@¢òò—C¢&Wv–æF–ærÂ÷"&W76–ærÆ’v–âÂWG2F†RÖ&·2&6²†VBöbF†P¢òòÆ–†VBæBF†W’6÷VæBv–â(	Bv†–6‚—2F†RöæÇ’v’F¶R—2ç’W6Rf÷ ¢òòÆ—7FVæ–ær&6²Fòà¢òð¢òòöæRöÆÂf÷"F†R6&BÂ7F'FVBv†VâF†R6W76–öâ÷Vç2â—B6÷7G2æ÷F†–æp¢òòv†–ÆRF†Rf–FVò—27F–ÆÂÂ&V6W6RÆ–†VBF†B†2æ÷BÖ÷fVB†2æ÷@¢òò7&÷76VBç—F†–ærà¦gVæ7F–öâ÷&5&V5vF6‚‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7BÇÂ7BçF–ÖW"’&WGW&à¢7BçF–ÖW"Ò6WD–çFW'fÂ‚‚’Óâ°¢–b…÷&5&V2ÓÒ7B’²6ÆV$–çFW'fÂ‡7BçF–ÖW"“²7BçF–ÖW"ÒçVÆÃ²&WGW&âÐ¢–b‡v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’²7BçvF6…÷2ÒçVÆÃ²&WGW&âÐ¢6öç7B7BÒ÷&5&V4æ÷r‚¢–b‚çVÖ&W"æ—4f–æ—FR†7B’’&WGW&âòòæò6Æö6²v†–ÆR7÷F–g’—26VV¶–æp¢6öç7B&WbÒ7BçvF6…÷0¢òòG&6¶VBWfVâv†–ÆRF†Rf–FVò—2†VÆBÂ6ò&W7VÖ–ær6ö×&W2v–ç7@¢òòv†W&R—B7GVÆÇ’—2&F†W"F†âv–ç7Bv†W&R—Bv2Æöærvòà¢7BçvF6…÷2Ò7@¢–b‡7BæÆö÷’°¢–b‡7BæÆö÷7W7VæFVB’&WGW&à¢òòÆWBF†R6÷W&6R'Vâv†–ÆR&V6÷&F–ærâ6VV²BF†R6Æ—w27GVÂVæC°¢òòFòæ÷BÆWBF†Ræ÷&ÖÂ7F÷×vF6†W"÷"6fVBF–ÖW7F×VBF¶W2f—&Rà¢–b‡7BæÆö÷6VV¶–ær’°¢–b†7BãÒ7Bæ6Æ—7F'BÒãRbb7BÂÖF‚æÖ–â‡7Bæ6Æ—7F'B²ãRÂ7Bæ6Æ—7F÷ÒãR’’°¢7BæÆö÷6VV¶–ærÒfÇ6P¢–b‡7BæÆö÷6VVµF–ÖW"’²6ÆV%F–ÖV÷WB‡7BæÆö÷6VVµF–ÖW"“²7BæÆö÷6VVµF–ÖW"ÒçVÆÂÐ¢7BçvF6…÷2Ò7Bæ6Æ—7F'BÒã¢Ð¢&WGW&à¢Ð¢–b‡7Bæ6Æ—7F÷ÒçVÆÂbb7BãÒ7Bæ6Æ—7F÷Òãr’°¢÷&5&V4Æö÷6VV²‡7BÂ²&W6W'fTVF–ó¢G'VRÒ¢&WGW&à¢Ð¢6öç7BF²Ò7BæÆö÷F¶P¢–b‡F²bb7Bç†6RÓÓÒv–FÆRrbb7BæÆö÷Æ–VBbb&WbÒçVÆÂb`¢&WbÂF²çCbb7BãÒF²çCbb7BÒ&WbÂãR’°¢7BæÆö÷Æ–VBÒG'VP¢÷&5&V4Æö÷Æ•F¶R‡7BÂF²¢Ð¢&WGW&à¢Ð¢òò&V6÷&F–ær†öÆG2F†Rf–FVò7F–ÆÂÂæBF¶RÆ––ær†2Ç&VG’W6V@¢òò—BâæV—F†W"—2Æ–&6²7&÷76–ærÖ&²à¢–b‡7Bç†6RÓÓÒw7F'F–ærrÇÂ7Bç†6RÓÓÒw&V6÷&F–ærrÇÂ7Bç†6RÓÓÒwÆ–&6²r’&WGW&à¢–b‡&WbÓÒçVÆÂ’&WGW&à¢òòvö–ær6öÖWv†W&RVæG2F†R72F†BföÆÆ÷vVB&V6÷&F–ærÂæBWfW'’Ö&°¢òò—2Æ—fRv–â(	Bv†–6‚—2v†BÖ¶W2&Wv–æBÆ’F†RF¶W2&6²à¢–b„ÖF‚æ'2†7BÒ&Wb’âõD´UôÔ…õ5DU’7Bæv—F–ærÒçVÆÀ¢6öç7BGVRÒ÷&7F–6U7V´÷fW%6†÷vâ‚’bb÷F¶TGVTf÷%72‡7BçF¶W2Â&WbÂ7BÂ7Bæv—F–ær¢–b†GVR’°¢7Bæv—F–ærÒçVÆÀ¢÷&5&V5W6Uf–FVò‚¢÷&5&V5Æ•F¶R‡7BÂGVRÂ²·7BçFö¶Vâ¢&WGW&à¢Ð¢òòF¶Rw272F¶W2F†RÆ–†VBg&öÒF†R6Æ—w2÷vâVæB×vF6†W"Â6ò—@¢òò7F÷2†W&R–ç7FVC¢BF†RVæBöbF†R6&Bw2Æ–æW2Â÷"§W7B7BF†P¢òòÆ7BF¶Rv†VâöæRv27ö¶VâgFW"F†VÒà¢–b‡7Bæ6Æ—7F÷ÒçVÆÂbb&WbÂ7B’°¢6öç7BVæBÒ÷&5&V46Æ—VæB‡7Bæ6Æ—7F÷¢òò†ÆböÆÂV&Ç’öâfW&vR&F†W"F†â†ÆböÆÂÆFRÂ6òF†P¢òòW6RÆæG2BF†RVæB–ç7FVBöb–âF†RæW‡BÆ–æRw27VV6‚à¢–b‡&WbÂVæBbb7B²†7BÒ&Wb’ò"ãÒVæB’²÷&5&V5W6Uf–FVò‚“²&WGW&âÐ¢Ð¢òòF†RÖ&²F†—272v2–ÖVBB—2&V†–æBF†RÆ–†VBv—F†÷WB†f–æp¢òò&VVâ7&÷76VB(	BF†R&Wv–æBÆæFVB7B—BÂv†–6‚—B6âv†VâGvòF¶W0¢òò&R6Æ÷6W"FövWF†W"F†âF†R6VV²6WGFÆW2âv—F–ærf÷"—Bæ÷rv÷VÆ@¢òò¶VWWfW'’ÆFW"F¶RV–WBf÷"F†R&W7BöbF†R6Æ—à¢–b‡7Bæv—F–ærÒçVÆÂbb7BâçVÖ&W"‡7Bæv—F–ær’²õD´Uõ4ÔUõ5õB’7Bæv—F–ærÒçVÆÀ¢ÒÂ#§Ð ¢òò&Wv–æBFòF†RF¶R&Vf÷&RF†RöæR§W7B&V6÷&FVBæBÆ’g&öÒF†W&RÂ6òF†P¢òòW6W"†V'2F†R7G&WF6‚F†W’7ö¶R÷fW"æBF†VâF†V×6VÇfW27V¶–ær÷fW"—Bà¢òòF†RvF6†W"&÷fRÆ—2F†RF¶Rv†VâF†RÆ–†VB&V6†W2—G2Ö&²à¦gVæ7F–öâ÷&5&V5&WÆ’‡C’°¢6öç7B7BÒ÷&5&V0¢–b‚7B’&WGW&à¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢6öç7BFö¶VâÒ²·7BçFö¶Và¢6öç7B—47W'&VçBÒ‚’Óâv–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBbb÷&5&V2ÓÓÒ7BbbFö¶VâÓÓÒ7BçFö¶Và¢7Bæv—F–ærÒçVÆÀ¢÷&5&V5F¶T÷fW%Æ–†VB‚¢²†7–æ2‚’Óâ°¢òòF†R6&Bw2Æ–æW22F†W’&Ræ÷r(	BF†R6öçFW‡BÖ’†fR6†ævVB6–æ6P¢òòF†R6Æ—Æ7BÆ–VBÂ÷"—BÖ’æWfW"†fRÆ–VBà¢v—B÷&5&V5&Vg&W6„6Æ—‡7B¢–b‚—47W'&VçB‚’’&WGW&à¢6öç7Bg&öÒÒ÷&Wv–æEö–çDf÷"‡7BçF¶W2ÂCÂ7Bæ6Æ—7F'B¢–b‡7÷F–g”6Æ—2‡7Bæ—FVÒ’æÆVæwF‚’°¢–b‚7÷F–g•Æ–W"ç6VVµ&7F–6R‡7Bæ—FVÒÂg&öÒ’’&WGW&à¢ÒVÇ6R°¢G'’²v—B6VVµFõ–÷WGV&UF–ÖR†g&öÒÂ²—47W'&VçBÒ’Ò6F6‚…ò’·Ð¢Ð¢–b‚—47W'&VçB‚’’&WGW&à¢7BçvF6…÷2Ò7÷F–g”6Æ—2‡7Bæ—FVÒ’æÆVæwF‚òg&öÒÒã¢÷&5&V4æ÷r‚¢òòF†—272&VÆöæw2FòF†RF¶R§W7B&V6÷&FVBâ—B&Vv–ç26—GF–æröâF†P¢òòÖ&²öbF†RöæR&Vf÷&R—BÂv†–6‚F†RvF6†W"v÷VÆB÷F†W'v—6R6÷VæBà¢7Bæv—F–ærÒC¢÷&5&V5Æ•f–FVò‚¢÷&5&V5vF6‚‚¢Ò’‚§Ð ¦7–æ2gVæ7F–öâ÷&5&V5Æ•F¶R‡7BÂF²ÂFö¶Vâ’°¢7Bç†6RÒwÆ–&6²p¢÷&VæFW%&7F–6U&V4&"‚¢òòF†Rf–ÆRÆ—fW2÷WG6–FRF†RvRw2÷&–v–ã²F†R'&–FvR†æG2&6²F†R'—FW2à¢ÆWBFFW&ÂÒçVÆÀ¢G'’²FFW&ÂÒv—BöÆöE7V´÷fW$VF–ò‡F²çW&Â’Ò6F6‚…ò’·Ð¢–b…÷&5&V2ÓÒ7BÇÂFö¶VâÓÒ7BçFö¶Vâ’&WGW&à¢òòv†FWfW"†Vç2FòF†RÆ–&6²ÂF†Rf–FVò6'&–W2öâg&öÒF†RÖ&²(	@¢òòF¶RF†Bv–ÆÂæ÷B6÷VæB×W7Bæ÷B7G&æBF†RÆö÷à¢ÆWBFöæRÒfÇ6P¢6öç7B6''”öâÒ‚’Óâ°¢–b†FöæR’&WGW&à¢FöæRÒG'VP¢–b…÷&5&V2ÓÒ7BÇÂFö¶VâÓÒ7BçFö¶Vâ’&WGW&à¢7BæVF–òÒçVÆÀ¢7Bç†6RÒv–FÆRp¢òòF†RÖ&²—2&V†–æBF†RÆ–†VBæ÷s²v—F†÷WBF†—2F†RæW‡BöÆÂv÷VÆ@¢òò6ö×&Rv–ç7B&VF–ærg&öÒ&Vf÷&RF†RF¶RæBÆ’—Bv–âà¢7BçvF6…÷2Ò÷&5&V4æ÷r‚¢÷&VæFW%&7F–6U&V4&"‚¢÷&5&V5Æ•f–FVò‚¢Ð¢–b‚FFW&Â’²6''”öâ‚“²&WGW&âÐ¢6öç7BÒæWrVF–ò†FFW&Â¢7BæVF–òÒ¢æFDWfVçDÆ—7FVæW"‚vVæFVBrÂ6''”öâ¢æFDWfVçDÆ—7FVæW"‚vW'&÷"rÂ6''”öâ¢G'’²6öç7B"ÒçÆ’‚“²–b‡"bb"æ6F6‚’"æ6F6‚‚‚’Óâ6''”öâ‚’’Ð¢6F6‚…ò’²6''”öâ‚’Ð§Ð ¢òòw&—FRF†RF¶W2öçFòF†R6&BâÆö6FVB'’–FVçF—G’ÂF†R6ÖRv’F†P¢òò&WÆ6RæBFVÆWFR7F–öç2Fò—Bà¦gVæ7F–öâ÷&5&V4¶VW‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7B’&WGW&à¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—B’&WGW&à¢–b…÷&VgW6U&VDöæÇ•Æ–Æ—7B†—Bå÷&V4æÖR’’&WGW&à¢6öç7B&V2Òv–æF÷rå÷&V6÷&F–æw2bbv–æF÷rå÷&V6÷&F–æw5¶—Bå÷&V4æÖUÐ¢6öç7B'"Ò&V2bb&V2æ—FV×2bb&V2æ—FV×5¶—Bå÷7EÒbb&V2æ—FV×5¶—Bå÷7EÕ¶—Bå÷uÐ¢–b‚'&’æ—4'&’†'"’’²ÆW'B‚t6ææ÷BÆö6FRF†—26&B–â—G2Æ–Æ—7Bâr“²&WGW&âÐ¢ÆWB’Ò'"æf–æD–æFW‚‡‚Óâ‚bb‚æ–BÓÓÒ—Bæ–Bbb‚æÆ–æT–æFW‚ÓÓÒ—BæÆ–æT–æFW‚¢–b†’ÂbbG—Vöb—Båö–G‚ÓÓÒvçVÖ&W"rbb—Båö–G‚Â'"æÆVæwF‚’’Ò—Båö–G€¢–b†’Â’²ÆW'B‚t6ææ÷BÆö6FRF†—26&B–â—G2Æ–Æ—7Bâr“²&WGW&âÐ¢6öç7BF¶W2Ò7BçF¶W2æÖ‡BÓâ‡²C¢BçCÂW&Ã¢BçW&ÂÂ×3¢Bæ×2Ò’¢–b‡F¶W2æÆVæwF‚’'%¶•Òç&7F–6UF¶W2ÒF¶W0¢VÇ6RFVÆWFR'%¶•Òç&7F–6UF¶W0¢òòÖ—'&÷"öçFòF†RVWVR6÷’6òÆVf–æræB&WGW&æ–ær6†÷w2F†R6ÖRF†–ærà¢—Bç&7F–6UF¶W2Ò'%¶•Òç&7F–6UF¶W0¢&V2çWFFVDBÒFFRææ÷r‚¢÷6fU&V6÷&F–ær‚¢7Bæ¶WBÒæWr6WB‡F¶W2æÖ‡BÓâBçW&Â’¢òòæ÷rF†BF†R6&BæòÆöævW"ö–çG2BF†VÒÂF†RF—7Æ6VBf–ÆW26âvòà¢7Bæ÷'†ç2ç7Æ–6Rƒ’æf÷$V6‚‡RÓâöFVÆWFU7V´÷fW$VF–ò‡R’¢÷&VæFW%&7F–6U&V4&"‚v¶WBöâF†—26&Br§Ð ¢òòF‡&÷rv’v†Bv2æWfW"¶WBÂÆVf–ærF†R6&B2—Bv2à¦gVæ7F–öâ÷&5&V4F—66&B‚’°¢6öç7B7BÒ÷&5&V0¢–b‚7B’&WGW&à¢6öç7BÆö÷6RÒ7BçF¶W2æf–ÇFW"‡BÓâ7Bæ¶WBæ†2‡BçW&Â’¢–b‚Æö÷6RæÆVæwF‚’&WGW&à¢–b‚6öæf—&Ò‚uF‡&÷rv’r²Æö÷6RæÆVæwF‚²rF¶Rr²†Æö÷6RæÆVæwF‚ÓÓÒòrr¢w2r’°¢rF†Br²†Æö÷6RæÆVæwF‚ÓÓÒòwv2r¢wvW&Rr’²"æWfW"¶WCò"’’&WGW&à¢7BçF¶W2Ò7BçF¶W2æf–ÇFW"‡BÓâ7Bæ¶WBæ†2‡BçW&Â’¢Æö÷6Ræf÷$V6‚‡BÓâöFVÆWFU7V´÷fW$VF–ò‡BçW&Â’¢÷&VæFW%&7F–6U&V4&"‚vF—66&FVBr§Ð ¢òò&VæFW"F†Rg&öçBö&6²26öÇVÖâöb7V'F—FÆRÆ–æW2†ÖF6†VB+6öçFW‡B’à¢òòV6‚Æ–æR6'&–W2FF6òF†R–æÆ–æRVF—F÷"6âF&vWBF†R&–v‡B5%BÆ–æRà¢òò†–v†Æ–v‡Ev÷&F—2F†R6GW&VBv÷&Bf÷"F†—26&C²F†R6÷W&6R6–FR'Vç0¢òòF‡&÷Vv‚F†Rv÷&B†–v†Æ–v‡FW"öâUdU%’&÷r†æ÷B§W7BF†RÖF6‚’Â6ò¢òò‡&6R7Æ—B7&÷725%B&÷w27F–ÆÂÆ–v‡G2Wöâ&÷F‚†ÇfW2âF†RF&vW@¢òò6–FR7F—2Æ–â6–æ6R—Bw2G&ç6ÆF–öâæBvöâwBvVæW&ÆÇ’6öçF–âF†P¢òò6÷W&6Rv÷&BfW&&F–Òà¦gVæ7F–öâ÷&7F–6U&VæFW$Æ–æW2‚F6öçF–æW"Â&÷w2ÂÆæt¶W’Â†–v†Æ–v‡Ev÷&B’°¢F6öçF–æW"æV×G’‚¢òò&R×66â6÷W&6RFW‡G26òW"×Fö¶VâfÆÆ&6²—27W&W76VBv†VâF†P¢òòv†öÆR‡&6RV'2öâç’&÷r(	B¶VW2×VÇF’×v÷&B'‚’¢"g&öÐ¢òòÇ6òÆ–v‡F–ærW7FæFÆöæR'G2öâæV–v†&÷W&–ær&÷w2âFö¶Và¢òòfÆÆ&6²7F–ÆÂ¶–6·2–âv†VâF†R‡&6R—2vVçV–æVÇ’7Æ—B7&÷70¢òò&÷w2ƒÒ'6VçBg&öÒWfW'’6–ævÆR&÷r’à¢6öç7B6÷W&6UFW‡G2Ò†Ææt¶W’ÓÓÒw6÷W&6Rrbb†–v†Æ–v‡Ev÷&B¢ò&÷w2æÖ‡"Óâ‡"ç6÷W&6RÇÂrr’¢¢µÐ¢6öç7BÆÆ÷uFö¶Vç2Ò†Ææt¶W’ÓÓÒw6÷W&6Rrbb†–v†Æ–v‡Ev÷&B¢ò÷‡&6Tf÷VæD–åFW‡G2‡6÷W&6UFW‡G2Â†–v†Æ–v‡Ev÷&B¢¢fÇ6P¢òòæò)Èâöâf–FVòg&öÒF†R÷F†W"W6W"w2Æ–'&'’‡&VBÖöæÇ’’à¢6öç7B&7F–6T—FVÒÒB‚r7&7F–6TÖöFRr’æFF‚v—FVÒr¢6öç7B&VDöæÇ’Ò‡&7F–6T—FVÒbbö—5&VDöæÇ”Æ–æ²‡&7F–6T—FVÒæ–B’¢&÷w2æf÷$V6‚‡"Óâ°¢6öç7BFW‡BÒ†Ææt¶W’ÓÓÒw6÷W&6Rr’ò"ç6÷W&6R¢"çF&vW@¢6öç7BG&÷rÒB†ÆF—b6Æ73Ò'&7F–6RÖÆ–æRG·"æ—4ÖF6‚òr&7F–6RÖÆ–æRÖÖF6‚r¢rwÒ"FFÖÆ–æRÖ–æFWƒÒ"G·"æÆ–æT–æFW‡Ò#ãÂöF—cæ¢6öç7BGFW‡BÒB‚sÇ7â6Æ73Ò'&7F–6RÖÆ–æR×FW‡B#ãÂ÷7ãâr¢–b†Ææt¶W’ÓÓÒw6÷W&6Rrbb†–v†Æ–v‡Ev÷&B’°¢GFW‡Bæ‡FÖÂ…ö†–v†Æ–v‡Ev÷&D‡FÖÂ‡FW‡BÇÂr†V×G’’rÂ†–v†Æ–v‡Ev÷&BÂ²ÆÆ÷uFö¶Vç2Ò’¢ÒVÇ6R°¢GFW‡BçFW‡B‡FW‡BÇÂr†V×G’’r¢Ð¢6öç7BF–ÖW7F×Ò7V'F—FÆUF–ÖW7F×'WGFöâ‡"Â&ævRÓâ°¢–b‡v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6T6&G3òå·v–æF÷rå÷&7F–6T–G…ÒÓÓÒ&7F–6T—FVÒ’Æ•&7F–6T6Æ—‡&ævR¢Ò¢–b‡F–ÖW7F×’G&÷ræVæB‡F–ÖW7F×¢G&÷ræVæB‚GFW‡B¢–b‚&VDöæÇ’’G&÷ræVæB‚B†Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖÆ–æRÖVF—B"F—FÆSÒ$VF—BF†—2Æ–æR"FFÖÆæsÒ"G¶Ææt¶W’ÓÓÒw6÷W&6Rròw7&2r¢vVâwÒ"FFÖÆ–æRÖ–æFWƒÒ"G·"æÆ–æT–æFW‡Ò#î)ÈãÂö'WGFöãæ’¢F6öçF–æW"æVæB‚G&÷r¢Ò§Ð ¦7–æ2gVæ7F–öâ÷&VæFW%&7F–6T6&B‚’°¢6öç7BGÒB‚r7&7F–6TÖöFRr¢–b‚GæÆVæwF‚’&WGW&à¢6öç7B&VæFW%Fö¶VâÒ²µ÷&7F–6U&VæFW%Fö¶Và¢6öç7Bf–FVõ&WVW7BÒöæWu&7F–6Uf–FVõ&WVW7B‡²×WFS¢G'VRÒ¢v–æF÷rå÷&7F–6UÆ•VæF–ærÒçVÆÀ¢v–æF÷rå÷&7F–6UÆ–&6´6&BÒçVÆÀ¢òò7v—F6†–ær6&G2–çfÆ–FFW2ç’'Vææ–ær6Æ—7F÷×vF6†W"6ò—B6âwBW6P¢òòF†Rg&W6†Ç’Ö7VVB6Æ—à¢v–æF÷rå÷&7F–6T6Æ—Fö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÇÂ’²¢–b‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"’²6ÆV$–çFW'fÂ‡v–æF÷rå÷&7F–6T6Æ—F–ÖW"“²v–æF÷rå÷&7F–6T6Æ—F–ÖW"ÒçVÆÂÐ¢òòç’ÖçVÂÖVF–ò&Wf–Wr—2F–VBFòF†R§&Wf–÷W2¢6&Bw2ÖVF–ÖÆ–æ°¢òò'WGFöâ‡v†–6‚—2&÷WBFò&R&VÖ÷fVBæB&V'V–ÇB’â7F÷—B6òF†R6Æ— ¢òòFöW6âwB¶VWÆ––ærVæFW"F†RæWr6&Bà¢G'’²÷7F÷ÖçVÄVF–õ&Wf–Wr‚’Ò6F6‚…ò’·Ð¢6öç7B–G‚Òv–æF÷rå÷&7F–6T–G€¢6öç7B6&G2Òv–æF÷rå÷&7F–6T6&G2ÇÂµÐ¢6öç7B—BÒ6&G5¶–G…Ð¢–b‚—B’&WGW&à¢ö6µf—6—FVDæ÷F–f–6F–öâ†—B¢òòW'6—7B&W7VÖR×F&vWBöâWfW'’6&B6†ævRâÖöFSÒw&7F–6Rr6òF†P¢òòæW‡BÆ’ÆÂò&7F–6R6Æ–6²öâF†—2Æ–Æ—7BöffW'2Fò&W7VÖR†W&Rà¢òò–G†Gfæ6W2VWVU÷26òF†R6fVBVWVRG&6·2v†W&RvR&Rà¢–b‚v–æF÷rå÷&7F–6U6–ævÆR’°¢G'’²÷6WDÆ7EÆ–VB†—BÂw&7F–6RrÂ–G‚’Ò6F6‚…ò’·Ð¢Ð¢òò¶VWF†R–æfòæVÂ–â7–æ22F†RW6W"æf–vFW26&G2Â–b—Bw2÷Vâà¢–b‚Gæf–æB‚rç&7F–6RÖ–æfò×æVÂr’æ—2‚s§f—6–&ÆRr’’÷WFFU&7F–6T–æfò‚¢òò6†F÷v–ær6W76–öâ&VÆöæw2FòöæR6&BâÆæF–æröâF–ffW&VçBöæRVæG0¢òòF†RöÆB6W76–öâæBG&÷2v†FWfW"—Bv2æWfW"FöÆBFò¶VW²ÆæF–æp¢òò&6²öâF†R6ÖR6&B†fÆ—Â&R×&VæFW"’ÆVfW2—B'Vææ–ærà¢–b‚÷&5&V2ÇÂ÷&5&V2æ¶W’ÓÒ÷&5&V4¶W’†—B’’°¢G'’²÷&5&V4VæB‡G'VR’Ò6F6‚…ò’·Ð¢–b…÷&5&V4VÆ–v–&ÆR†—B’’÷&5&V4&Vv–â†—B¢Ð¢÷&VæFW%&7F–6U&V4&"‚¢6öç7B7&46öFRÒ‚‡G—VöbvWDÆætg&öÕW&ÂÓÓÒvgVæ7F–öârbbvWDÆætg&öÕW&Â‚’æ6öFR’ÇÂw7br’çFõWW$66R‚¢6öç7Bg&öçD—56÷W&6RÒv–æF÷rå÷&7F–6Tg&öçD—56÷W&6P¢6öç7BÖöFRÒ‡v–æF÷råö6WGF–æw2bbv–æF÷råö6WGF–æw2ç&7F–6U&WfVÄÖöFR’ÇÂvfÆ—p¢òòÖçVÂ6&B'&æ6ƒ¢æò5%BÂæò6Æ—(	B§W7B&VæFW"6÷W&6R÷F&vWBFW‡@¢òòæB7W&f6Râ÷F–öæÂÖVF–Æ–æ²â&WW6W2F†R6ÖRfÆ—ö†–FRö&÷F€¢òò&WfVÂÖöFW2æBF†R6ÖRç&7F–6RÖg&öçBòç&7F–6RÖ&6²f6W2à¢–b…ö—4ÖçVÄ—FVÒ†—B’’°¢÷&VæFW%&7F–6TÖçVÄ6&B‚GÂ—BÂ–G‚Â6&G2æÆVæwF‚Âg&öçD—56÷W&6RÂÖöFRÂ7&46öFRÂf–FVõ&WVW7B¢&WGW&à¢Ð¢òò6†÷rF†R6&BöæÇ’gFW"7V'F—FÆW2²fö6'VÆ'’&RÆöFVBÂ6òF†R7V'F—FÆP¢òòÆ–æW2æBF†Rv÷&B×G&ç6ÆF–öâfÆÆ&6²&VÆ÷r&R6ö×ÆWFR&F†W"F†âV×G’à¢G'’²v—B&öÖ—6RæÆÂ…·v–æF÷rå÷fö6'VÆ'•&VG•&öÖ—6RÂv–æF÷rå÷7V'F—FÆW5&VG•&öÖ—6UÒæÖ‡Óâ&öÖ—6Rç&W6öÇfR‡’æ6F6‚‚‚’Óâ·Ò’’’Ò6F6‚…ò’·Ð¢–b‚v–æF÷rå÷&7F–6T7F—fRÇÂ&VæFW%Fö¶VâÓÒ÷&7F–6U&VæFW%Fö¶Vâ’&WGW&à¢òòf–FVò6&BF‚föÆÆ÷w2(	Bf—'7B&W7F÷&Rç’6öçG&öÇ2F†RÖçVÂF‚†–FW2À¢òòæB†æBF†R6Æ÷B&6²FòF†Rf–FVòà¢÷6†÷u&7F–6TVF–õæVÂ†çVÆÂ¢Gæf–æB‚rç&7F–6R×&WÆ6Rr’ç6†÷r‚¢òòöæÇ’ÖçVÂ6&G2†fRâVF—F÷"à¢Gæf–æB‚rç&7F–6RÖVF—Br’æ†–FR‚¢òòF†R÷F†W"W6W"w26&G26ææ÷B&R6†ævVB‡F†R†æFÆW'2&VgW6RFöò’à¢Gæf–æB‚rç&7F–6R×&WÆ6RÂç&7F–6RÖFVÆWFRr’çFövvÆR‚ö—5&VDöæÇ•Æ–Æ—7B†—Bå÷&V4æÖR’¢Gæf–æB‚rç&7F–6RÖ7G‚Ö7G&Âr’ç6†÷r‚¢Gæf–æB‚rç&7F–6R×Æ’Âç&7F–6R×7VVBr’ç6†÷r‚¢Gæf–æB‚rç&7F–6RÖÖVF–ÖÆ–æ²r’ç&VÖ÷fR‚¢Gæf–æB‚rç&7F–6RÖ6÷VçBr’çFW‡B†G¶–G‚²ÒòG¶6&G2æÆVæwF‡Ö¢6öç7BfÖ–Æ–"Ò÷G&ç6ÆF–öåF&vWDÆæwVvR‚¢6öç7BfÖ–Æ–$6öFRÒfÖ–Æ–"çFõWW$66R‚¢Gæf–æB‚rç&7F–6RÖF—"r’çFW‡B†g&öçD—56÷W&6RòG·7&46öFWÒ(i"G¶fÖ–Æ–$6öFWÖ¢G¶fÖ–Æ–$6öFWÒ(i"G·7&46öFWÖ¢òòv÷&C¢6†÷vâWg&öçBöæÇ’v†VâF†Rg&öçB•2F†R6÷W&6R‡–÷R6VR6÷W&6P¢òòFW‡BæB&V6ÆÂ—G2ÖVæ–ær’â–âF&vWN(i'6÷W&6RÖöFRF†Rv÷&B—2F†P¢òòF†–ærFò&V6ÆÂÂ6ò†–FR—BVçF–Â&WfVÂà¢6öç7BGv÷&BÒGæf–æB‚rç&7F–6R×v÷&Br’çFW‡B†—Bçv÷&BÇÂrr¢Gv÷&Bæ772‚wf—6–&–Æ—G’rÂg&öçD—56÷W&6Ròwf—6–&ÆRr¢v†–FFVâr¢Gæf–æB‚rç&7F–6RÖg&öçBr’æ‡FÖÂ‚sÆF—b6Æ73Ò'&7F–6RÖÆöF–ær#äÆöF–æ~(
cÂöF—câr¢Gæf–æB‚rç&7F–6RÖ&6²r’æ†–FR‚’æV×G’‚¢Gæf–æB‚rç&7F–6RÖ&6²×F&vWBr’æV×G’‚¢Gæf–æB‚rç&7F–6R×&WfVÂr’ç6†÷r‚¢òò&W6WBF†RfÆ—×7FFRf÷"g&W6†Ç’&VæFW&VB6&B‡&7F–6TæbÇ6ð¢òò¦W&öW2÷&7F–6TfÆ—VBÂ'WBF—"×FövvÆRò6WGF–ær6†ævRÇ6ò&R×&VæFW'2’à¢Gæf–æB‚rç&7F–6RÖfÆ—W"r’çFövvÆT6Æ72‚vfÆ—VBrÂv–æF÷rå÷&7F–6TfÆ—VB¢òò&WfVÂÖöFR6†W2F†R6&C ¢òòv&÷F‚r(	Bæò&WfVÂ'WGFöâÂ&6²6†÷vâ&W6–FRg&öçBÇv—0¢òòvfÆ—r(	B&WfVÂ'WGFöâFövvÆW24B&÷FFU“²&6²Öf6R6öçFVçB—2F†RF&vW@¢òòv†–FRr(	BÆVv7’&V†f–÷W#¢&6²†–FFVâVçF–Â&WfVÂ6Æ–6°¢Gç&VÖ÷fT6Æ72‚w&WfVÂÖfÆ—&WfVÂÖ&÷F‚&WfVÂÖ†–FRr’æFD6Æ72†&WfVÂÒG¶ÖöFWÖ¢–b†ÖöFRÓÓÒv&÷F‚r’Gæf–æB‚rç&7F–6R×&WfVÂr’æ†–FR‚¢GæFF‚v—FVÒrÂ—B¢÷WFFU&7F–6U7VVD'Fâ‚¢÷WFFU&7F–6U&W7F÷&T6÷VçB‚ ¢òò7VRF†R6Æ—‡W6VB(	B—B×W7BäõBWFò×Æ’–â&7F–6RÖöFR’à¢ö7VU&7F–6Uf–FVò†—BÂf–FVõ&WVW7B ¢6öç7B&÷w2Òv—B÷&7F–6T6&DÆ–æW2†—BÂv–æF÷rå÷&7F–6T7G„&Vf÷&RÇÂÂv–æF÷rå÷&7F–6T7G„gFW"ÇÂ¢–b‚v–æF÷rå÷&7F–6T7F—fRÇÂ&VæFW%Fö¶VâÓÒ÷&7F–6U&VæFW%Fö¶Vâ’&WGW&à¢–b‚&÷w2ÇÂ&÷w2æÆVæwF‚’°¢Gæf–æB‚rç&7F–6RÖg&öçBr’æ‡FÖÂ‚sÆF—b6Æ73Ò'&7F–6RÖÆöF–ær#â‡7V'F—FÆRFW‡BVæf–Æ&ÆR“ÂöF—câr¢&WGW&à¢Ð¢÷&7F–6U&VæFW$Æ–æW2‚Gæf–æB‚rç&7F–6RÖg&öçBr’Â&÷w2Âg&öçD—56÷W&6Ròw6÷W&6Rr¢wF&vWBrÂ—Bçv÷&B¢òòv&÷F‚r&VæFW'2F†RF&vWB&–v‡B&VÆ÷rF†Rg&öçB†–ç6–FRF†Rg&öçBÖf6R“°¢òòv†–FRrW6W2F†R6ÖRç&7F–6RÖ&6²F—b'WB¶VW2—B†–FFVâVçF–Â&WfVÃ°¢òòvfÆ—rÇ6òf–ÆÇ2ç&7F–6RÖ&6²2fÆÆ&6²äBf–ÆÇ2F†R&6²Öf6Rà¢÷&7F–6U&VæFW$Æ–æW2‚Gæf–æB‚rç&7F–6RÖ&6²r’Â&÷w2Âg&öçD—56÷W&6RòwF&vWBr¢w6÷W&6RrÂ—Bçv÷&B¢÷&7F–6U&VæFW$Æ–æW2‚Gæf–æB‚rç&7F–6RÖ&6²×F&vWBr’Â&÷w2Âg&öçD—56÷W&6RòwF&vWBr¢w6÷W&6RrÂ—Bçv÷&B¢òò&VfW"F†R6fVB‡&6RvÆ÷72v†Vâæò7V'F—FÆRG&ç6ÆF–öâ—2f–Æ&ÆRÀ¢òò÷"v†VâF†RvÆ÷72ÖF6†W2F†R6†÷6VâÆæwVvRæBF†R7VW2öæÇ’†fRVævÆ—6‚à¢6öç7B†5G&ç6ÆF–öâÒ&÷w2ç6öÖR‡&÷rÓâ&÷rçF&vWBçG&–Ò‚’¢6öç7B†4fÖ–Æ–%G&6²Ò&÷w2ç6öÖR‡&÷rÓâ&÷rçF&vWDÆæwVvRÓÓÒfÖ–Æ–"¢6öç7BF&vWDÆæwVvW2ÒæWr6WB‡&÷w2æÖ‡&÷rÓâ&÷rçF&vWDÆæwVvR’æf–ÇFW"„&ööÆVâ’¢–b†—BçF&vWBbb7G&–ær†—BçF&vWB’çG&–Ò‚’b`¢‚†5G&ç6ÆF–öâÇÂ‚†4fÖ–Æ–%G&6²bb—BçF&vWDÆæwVvRÓÓÒfÖ–Æ–"’’’°¢–b†—BçF&vWDÆæwVvR’F&vWDÆæwVvW2æFB†—BçF&vWDÆæwVvR¢6öç7BG&ç2Ò7G&–ær†—BçF&vWB’çG&–Ò‚¢6öç7BWFòÒ—BçF&vWDWFòòrFFÖWFóÒ#"r¢rp¢6öç7BrÒÆF—b6Æ73Ò'&7F–6R×‡&6RÖvÆ÷72"G¶WF÷ÓâGµòæW66R‡G&ç2—ÓÂöF—cæ ¢òòWB—BöâF†RF&vWBÖÆæwVvR†ç7vW"’f6S¢F†R&6²v†VâF†Rg&öçB—0¢òòF†R6÷W&6RÂ÷F†W'v—6RF†Rg&öçBà¢–b†g&öçD—56÷W&6R’²Gæf–æB‚rç&7F–6RÖ&6²r’ç&WVæB†r“²Gæf–æB‚rç&7F–6RÖ&6²×F&vWBr’ç&WVæB†r’Ð¢VÇ6R²Gæf–æB‚rç&7F–6RÖg&öçBr’ç&WVæB†r’Ð¢Ð¢6öç7BF&vWD6öFRÒ²ââçF&vWDÆæwVvW5ÒæÖ†6öFRÓâ6öFRçFõWW$66R‚’’æ¦ö–â‚ròr’ÇÂfÖ–Æ–$6öFP¢Gæf–æB‚rç&7F–6RÖF—"r’çFW‡B†g&öçD—56÷W&6RòG·7&46öFWÒ(i"G·F&vWD6öFWÖ¢G·F&vWD6öFWÒ(i"G·7&46öFWÖ¢–b†ÖöFRÓÓÒv&÷F‚r’Gæf–æB‚rç&7F–6RÖ&6²r’ç6†÷r‚§Ð ¢òò&VæFW"ÖçVÂfÆ6†6&B–çFòF†RW†—7F–ær&7F–6RDôÒâ6ÖRfÆ—ö†–FP¢òòö&÷F‚&WfVÂÖöFW22f–FVò6&B(	BF†RF–ffW&Væ6R—2F†R6öçFVçB—0¢òòF†RW6W"×G—VB6÷W&6R÷F&vWBFW‡BæBF†W&Rw2æò6Æ—ò5%BÆöö·Wà¢òòöæRf6RöbÖçVÂ6&Bf÷"&7F–6S¢—G2…DÔÂÂ6ÆVæVBÂv†Vâ—Bv0¢òòw&—GFVâ2…DÔÂ†6&BÖ‡FÖÂæ§2“²÷F†W'v—6RF†RFW‡B2w&—GFVâà¦gVæ7F–öâö6&EFW‡DVÂ‡FW‡B’°¢6öç7BFVÂÒB‚sÆF—b6Æ73Ò'&7F–6RÖÖçVÂ×FW‡B#ãÂöF—câr¢–b‚7G&–ær‡FW‡BÇÂrr’çG&–Ò‚’’&WGW&âFVÂçFW‡B‚r†V×G’’r¢6öç7B²‡FÖÂÂ—4‡FÖÂÒÒö6&D‡FÖÂ‡FW‡B¢&WGW&âFVÂçFövvÆT6Æ72‚v6&BÖ‡FÖÂrÂ—4‡FÖÂ’æ‡FÖÂ†‡FÖÂ§Ð ¦7–æ2gVæ7F–öâ÷Æ•&7F–6TÖçVÅf–FVò†—B’°¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢6öç7Bf–FVòÒöÖçVÄ6&Ef–FVò†—B¢–b‚f–FVò’&WGW&à¢÷7F÷&7F–6TVF–ò‚¢6öç7B&WVW7BÒöæWu&7F–6Uf–FVõ&WVW7B‡²×WFS¢G'VRÒ¢6öç7B÷vç5&WVW7BÒ‚’Óâ÷&7F–6Uf–FVô7VW2æ—47W'&VçB‡&WVW7B¢6öç7BFVFÆ–æRÒFFRææ÷r‚’²d”DTõõ$T4õdU%•ôÕ0¢6öç7B—47W'&VçBÒ‚’Óâ÷vç5&WVW7B‚’bbFFRææ÷r‚’ÂFVFÆ–æP¢6öç7BVæF–ærÒ·Ð¢6öç7B6Æ—Fö¶VâÒv–æF÷rå÷&7F–6T6Æ—Fö¶VâÒ‡v–æF÷rå÷&7F–6T6Æ—Fö¶VâÇÂ’²¢v–æF÷rå÷&7F–6UÆ•VæF–ærÒVæF–æp¢G'’°¢v—Bv—EVçF–Â‚‚’Óâ—47W'&VçB‚’ÇÂv–æF÷rç—EÆ–W%&VG’¢–b‚÷vç5&WVW7B‚’’&WGW&à¢–b‚—47W'&VçB‚’’F‡&÷ræWrW'&÷"‚uF†RÆ–æ¶VBf–FVòÆ–W"F–Bæ÷B&V6öÖR&VG’r¢òò7VVB–g&ÖR6â&W÷'B¦W&òÂ÷"66†VBF–ÖRg&öÒF†R&Wf–÷W0¢òò6&Bâ6öæf—&ÒF†RÆ–æ¶VBÖöÖVçBv†–ÆRÄ””äræB7F–ÆÂ×WFVC²&WG'¢òò–væ÷&VB6VV·2'’ÆöF–ærB7F'E6V6öæG2Âv—F†–âöæR&÷VæFVB&WVW7Bà¢v—BÆ”ÖVF–6Æ–6R‡f–FVòæ–BÂf–FVòçF–ÖU7F'BÂf–FVòçF–ÖTVæBÂu–÷UGV&RrÂ°¢—47W'&VçBÂ6öæf—&Õ6VV³¢G'VRÂ&WV—&UÆ––æs¢G'VRÀ¢Ò¢–b‚÷vç5&WVW7B‚’’&WGW&à¢–b‚—47W'&VçB‚’’F‡&÷ræWrW'&÷"‚uF†RÆ–æ¶VBf–FVòF–Bæ÷B&V6‚—G2F–ÖW7F×r¢G'’²v–æF÷rç—EÆ–W#òç6WEÆ–&6µ&FR…÷&7F–6Uf–FVõ&FR‚’’Ò6F6‚…ò’·Ð¢÷&7F–6Uf–FVô7VW2æ&Vv–åÆ–&6²‡&WVW7B¢v–æF÷rå÷&7F–6UÆ–&6´6&BÒ—@¢÷vF6…&7F–6T6Æ—VæB‡f–FVòçF–ÖTVæBÂ6Æ—Fö¶VâÂ²f–FVô–C¢f–FVòæ–BÒ¢Ò6F6‚†R’°¢–b†÷vç5&WVW7B‚’’°¢G'’²v–æF÷rç—EÆ–W"çW6Uf–FVò‚’Ò6F6‚…ò’·Ð¢÷&7F–6Uf–FVô7VW2ç&VÆV6T×WFR‚¢6öç6öÆRçv&â‚w&7F–6S¢Æ–æ¶VBf–FVòf–ÆVBrÂR¢ö7'V–ÆEFö7B‚t6÷VÆBæ÷B7F'BF†RÆ–æ¶VBf–FVòB—G2F–ÖW7F×âG'’Æ’v–ââr¢Ð¢Òf–æÆÇ’°¢–b‡v–æF÷rå÷&7F–6UÆ•VæF–ærÓÓÒVæF–ær’v–æF÷rå÷&7F–6UÆ•VæF–ærÒçVÆÀ¢Ð§Ð ¦gVæ7F–öâ÷&VæFW%&7F–6TÖçVÄ6&B‚GÂ—BÂ–G‚ÂF÷FÂÂg&öçD—56÷W&6RÂÖöFRÂ7&46öFRÂf–FVõ&WVW7B’°¢òò†–FR6öçG&öÇ2F†BöæÇ’Ç’Fòf–FVò6Æ—2â&VÖ÷fVBv†VâF†RæW‡@¢òò‡f–FVò’6&B&VæFW'2'’F†R&W7F÷&RÖ&Æö6²BF†RF÷öb÷&VæFW%&7F–6T6&Bà¢Gæf–æB‚rç&7F–6RÖ7G‚Ö7G&Âr’æ†–FR‚¢Gæf–æB‚rç&7F–6R×Æ’Âç&7F–6R×7VVBr’æ†–FR‚¢òò7VV6‚fÆÆ&6²—2ÖçVÂÖ6&BÆ’7F–öã²&V6÷&F–æw2¶VWF†V— ¢òòW†—7F–ærVF–ò6öçG&öÇ2ÂæBÆ–æ¶VB6Æ—27F–ÆÂW6RF†V—"÷vâÆ–W"à¢Gæf–æB‚rç&7F–6R×Æ’r’çFövvÆR…ö6å7Vµ6–ÆVçD6&B†—B’¢æGG"‚wF—FÆRrÂu7V²6&BFW‡B…EE2’r¢æGG"‚v&–ÖÆ&VÂrÂu7V²6&BFW‡Br¢æGG"‚v&–×&W76VBrÂvfÇ6Rr¢òòÖçVÂ6&G2†fRæò5%B6÷W&6RFò7v(i"æò&WÆ6R÷F–öâà¢Gæf–æB‚rç&7F–6R×&WÆ6Rr’æ†–FR‚¢òòF†R÷F†W"W6W"w26&G26ææ÷B&R6†ævVB‡F†R†æFÆW'2&VgW6RFöò’à¢Gæf–æB‚rç&7F–6RÖVF—BÂç&7F–6RÖFVÆWFRr’çFövvÆR‚ö—5&VDöæÇ•Æ–Æ—7B†—Bå÷&V4æÖR’ ¢6öç7Bg&öçEFW‡BÒg&öçD—56÷W&6Rò†—Bç6÷W&6RÇÂrr’¢†—BçF&vWBÇÂrr¢6öç7B&6µFW‡BÒg&öçD—56÷W&6Rò†—BçF&vWBÇÂrr’¢†—Bç6÷W&6RÇÂrr¢Gæf–æB‚rç&7F–6RÖ6÷VçBr’çFW‡B†G¶–G‚²ÒòG·F÷FÇÖ¢Gæf–æB‚rç&7F–6RÖF—"r’çFW‡B†g&öçD—56÷W&6RòG·7&46öFWÒ(i"Tæ¢Tâ(i"G·7&46öFWÖ¢òòF†R'v÷&B"6Æ÷B&V6öÖW2ÖçVÂ&FvR6òF†RW6W"6â6VRBvÆæ6P¢òòF†BF†—2—2G—VB6&Bg26GW&VB6Æ—à¢Gæf–æB‚rç&7F–6R×v÷&Br’çFW‡B‡7÷F–g”6Æ—2†—B’æÆVæwF‚òu7÷F–g’6Æ—r¢	ù9ÒÖçVÂr’æ772‚wf—6–&–Æ—G’rÂwf—6–&ÆRr ¢6öç7BFg&öçBÒGæf–æB‚rç&7F–6RÖg&öçBr’æV×G’‚¢Fg&öçBæVæB…ö6&EFW‡DVÂ†g&öçEFW‡B’¢6öç7BF&6²ÒGæf–æB‚rç&7F–6RÖ&6²r’æ†–FR‚’æV×G’‚¢F&6²æVæB…ö6&EFW‡DVÂ†&6µFW‡B’¢6öç7BF&6´f6RÒGæf–æB‚rç&7F–6RÖ&6²×F&vWBr’æV×G’‚¢F&6´f6RæVæB…ö6&EFW‡DVÂ†&6µFW‡B’ ¢òò÷F–öæÂÖVF–Æ–æ²(	B–÷UGV&R7VW2–âF†RVÖ&VFFVBÆ–W"Âç—F†–æp¢òòVÇ6R÷Vç2–âæWrF"âVæFVBFòF†R&7F–6RÖæb&÷r6ò—B6—G0¢òòÆöæw6–FR&WböæW‡Bv†W&RF†R†–FFVâÆ’Ö6Æ—'WGFöâW6VBFò&Rà¢Gæf–æB‚rç&7F–6RÖÖVF–ÖÆ–æ²r’ç&VÖ÷fR‚¢òòF†R6&Bw2÷vâ&V6÷&F–æw2&RÆ–VBg&öÒF†RVF–òæVÂ&VÆ÷rÂv†–6€¢òòF¶W2F†Rf–FVòw26Æ÷B(	BgVÆÂ6öçG&öÇ2ÂæBöæRVÆVÖVçBFö–ærF†R6÷VæF–æp¢òò&F†W"F†âæb'WGFöâv—F‚—G2÷vâ&—fFRVF–ò&6–ær—Bà¢÷6†÷u&7F–6TVF–õæVÂ†—B ¢–b†—BæÖVF–W&Â’°¢6öç7B—5•BÒö6&D†5f–FVôÆ–æ²†—B¢6öç7B—4VF–òÒ—5•Bbb†—BæÖVF–¶–æBÓÓÒvVF–òrÇÂö—4VF–ôÖVF–W&Â†—BæÖVF–W&Â’¢6öç7B–6öâÒ—5•Bò~)kbr¢†—4VF–òò	øé’r¢	ùIrr¢6öç7BF—FÆRÒ—5•BòuÆ’F†RÆ–æ¶VB–÷UGV&Rf–FVòp¢¢—4VF–òòuÆ’F†R&V6÷&FVBVF–òp¢¢7÷F–g”6Æ—2†—B’æÆVæwF‚òu6†÷rF†R7÷F–g’Æ–W"p¢¢t÷VâF†RÆ–æ¶VBÖVF––âæWrF"p¢6öç7BF'FâÒB†Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖÖVF–ÖÆ–æ²"F—FÆSÒ"G·F—FÆWÒ"&–ÖÆ&VÃÒ"G·7÷F–g”6Æ—2†—B’æÆVæwF‚òu6†÷r7÷F–g’Æ–W"r¢t÷VâÆ–æ¶VBÖVF–wÒ#âG¶–6öçÓÂö'WGFöãæ¢F'Fâæöâ‚v6Æ–6²rÂ7–æ2†Wb’Óâ°¢Wbç&WfVçDFVfVÇB‚“²Wbç7F÷&÷vF–öâ‚¢–b‡7÷F–g”6Æ—2†—B’æÆVæwF‚’²7÷F–g•Æ–W"ç6†÷r‚“²&WGW&âÐ ¢–b†—5•B’°¢÷Æ•&7F–6TÖçVÅf–FVò†—B¢ÒVÇ6R–b†—4VF–ò’°¢òò'&–FvRÖÆöFVB&Wf–Wrv—F‚FövvÆS¢6Æ–6²v†–ÆRÆ––ær7F÷2—C°¢òòæf–vF–ærv’÷"6Æ÷6–ær&7F–6RÇ6ò7F÷2—Bà¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢6öç7BFö¶VâÒv–æF÷rå÷&7F–6T6Æ—Fö¶Và¢÷7F'DÖçVÄVF–õ&Wf–Wr†—BæÖVF–W&ÂÂF'FâÂ‚’Óâv–æF÷rå÷&7F–6T6Æ—Fö¶VâÓÓÒFö¶Vâ¢ÒVÇ6R–b…ö—5vV%W&Â†—BæÖVF–W&Â’’°¢v–æF÷ræ÷Vâ†—BæÖVF–W&ÂÂuö&Ææ²rÂvæö÷VæW"r¢Ð¢Ò¢Gæf–æB‚rç&7F–6RÖæbç&7F–6R×Æ’r’ægFW"‚F'Fâ¢òò&W&–ærV6‚6&B×W7BÇ6òWFFRF†R–g&ÖRw2÷vâÆ’'WGFöâà¢òò&WW6–ærF†R&Wf–÷W26&Bw2Æ–W"ÆVfW2—G2öÆB÷¦W&ò7F'B–âÆ6Rà¢–b†—5•B’ö7VU&7F–6Uf–FVò…öÖçVÄ6&Ef–FVò†—B’Âf–FVõ&WVW7B¢Ð ¢òò$÷Vâ–âUT""(	Bf÷"6&G2F†B6''’&öö²ö6†FW"ÖWFFF†g&öÒF†P¢òòæF—fRÆ–Æ—7D'&–FvR’â6†FW%ö–G‚Ö’&RÂ6òFW7Bv–ç7BçVÆÂà¢Gæf–æB‚rç&7F–6RÖWV"ÖÆ–æ²r’ç&VÖ÷fR‚¢–b†—Bæ&ööµö¶W’bb—Bæ6†FW%ö–G‚ÒçVÆÂ’°¢6öç7BÆ&VÂÒ—Bæ6†FW%÷F—FÆRÇÂ—Bæ&ööµ÷F—FÆRÇÂwF†R&öö²p¢6öç7BFWV"ÒB†Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'&7F–6RÖWV"ÖÆ–æ²"F—FÆSÒ$÷Vâ–âGµòæW66R†Æ&VÂ—Ò"&–ÖÆ&VÃÒ$÷Vâ–âUT"#ï	ù9cÂö'WGFöãæ¢FWV"æöâ‚v6Æ–6²rÂ†Wb’Óâ°¢Wbç&WfVçDFVfVÇB‚“²Wbç7F÷&÷vF–öâ‚¢ö÷VäWV$f÷$6&B†—Bæ&ööµö¶W’Â—Bæ6†FW%ö–G‚¢Ò¢Gæf–æB‚rç&7F–6RÖæbç&7F–6R×Æ’r’ægFW"‚FWV"¢Ð ¢Gæf–æB‚rç&7F–6R×&WfVÂr’ç6†÷r‚¢Gæf–æB‚rç&7F–6RÖfÆ—W"r’çFövvÆT6Æ72‚vfÆ—VBrÂv–æF÷rå÷&7F–6TfÆ—VB¢Gç&VÖ÷fT6Æ72‚w&WfVÂÖfÆ—&WfVÂÖ&÷F‚&WfVÂÖ†–FRr’æFD6Æ72†&WfVÂÒG¶ÖöFWÖ¢–b†ÖöFRÓÓÒv&÷F‚r’²Gæf–æB‚rç&7F–6RÖ&6²r’ç6†÷r‚“²Gæf–æB‚rç&7F–6R×&WfVÂr’æ†–FR‚’Ð¢GæFF‚v—FVÒrÂ—B¢÷WFFU&7F–6U7VVD'Fâ‚¢÷WFFU&7F–6U&W7F÷&T6÷VçB‚¢–b‡7÷F–g”6Æ—2†—B’æÆVæwF‚’7÷F–g•Æ–W"æ7VR†—BÂ÷&7F–6U7÷F–g”÷F–öç2†—B’§Ð ¢òò÷Vâ¥VW'’T’F–ÆörFòVF—B&7F–6RÆ–æRâ6VçG&VBöâF†Rf–Ww÷'@¢òò†æBÆ–gFVB'’6ÖÆÂ÷VâÖ6ÆÆ&6²6òF†Röâ×67&VVâ¶W–&ö&BÂv†Vâ—@¢òò÷2ÂÆVfW2F†RFW‡F&Vf—6–&ÆR’(	B&WÆ6W2F†R&Wf–÷W2–æÆ–æP¢òòVF—BÖ&÷‚F†Bv÷B6÷fW&VB'’F†R¶W–&ö&BöâÖö&–ÆRà¦gVæ7F–öâ÷&7F–6T&Vv–äVF—B†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢–b‚÷&WV—&U6VÆb‚’’&WGW&à¢6öç7BF'FâÒB‡F†—2¢6öç7BG&÷rÒF'Fâæ6Æ÷6W7B‚rç&7F–6RÖÆ–æRr¢6öç7B7W"ÒG&÷ræf–æB‚rç&7F–6RÖÆ–æR×FW‡Br’çFW‡B‚¢6öç7BÆærÒF'FâæGG"‚vFFÖÆærr’òòw7&2rÂvVâp¢6öç7BÆ–æT–æFW‚ÒF'FâæGG"‚vFFÖÆ–æRÖ–æFW‚r ¢òò'V–ÆB†÷"&WW6R’F†RF–ÆöræöFR(	B¥VW'’T’×WFFW2F†RVÆVÖVçB–çFð¢òòâV’ÖF–ÆörÖ6öçFVçFÂ6òvRvçBFò¶VWF†R6ÖRVÆVÖVçB7&÷72VF—G2à¢ÆWBFFÆrÒB‚r7&7F–6TÆ–æTVF—DF–Æörr¢–b‚FFÆræÆVæwF‚’°¢FFÆrÒB†ÆF—b–CÒ'&7F–6TÆ–æTVF—DF–Æör"F—FÆSÒ$VF—BÆ–æR"7G–ÆSÒ&F—7Æ“¦æöæS²#à¢ÆF—b6Æ73Ò'&7F–6RÖVF—BÖÖWF#ãÂöF—cà¢ÇFW‡F&V6Æ73Ò'&7F–6RÖVF—BÖ–çWB"&÷w3Ò#2#ãÂ÷FW‡F&Và¢ÂöF—cæ’æVæEFò‚v&öG’r¢Ð¢FFÆræFF‚vÆærrÂÆær’æFF‚vÆ–æT–æFW‚rÂÆ–æT–æFW‚¢FFÆræf–æB‚rç&7F–6RÖVF—BÖÖWFr’çFW‡B†2G¶Æ–æT–æFW‡Ò+rG¶ÆærÓÓÒvVâròtTâr¢w6÷W&6RwÖ¢FFÆræf–æB‚rç&7F–6RÖVF—BÖ–çWBr’çfÂ†7W"ÓÓÒr†V×G’’ròrr¢7W" ¢6öç7B÷G2Ò°¢v–GFƒ¢ÖF‚æÖ–âƒScÂÖF‚ç&÷VæB‡v–æF÷ræ–ææW%v–GF‚¢ã“R’’À¢ÖöFÃ¢fÇ6RÀ¢òòF÷Öæ6†÷&VB6òF†RF–Æör6—G2vVÆÂ&÷fRF†Röâ×67&VVâ¶W–&ö&@¢òòöâÖö&–ÆRâf—7VÅf–Ww÷'BF§W7G2–âööå&7F–6Uf–Ww÷'D6†ævRFöòÀ¢òò'WBF†RW‡Æ–6—B÷6—F–öâ&WfVçG2F†RF–Æörg&öÒ6VçG&–ær–çFð¢òòF†R¶W–&ö&Bw2fö÷G&–çB–âF†Rf—'7BÆ6Rà¢÷6—F–öã¢²×“¢v6VçFW"F÷rÂC¢v6VçFW"F÷³"RrÂöc¢v–æF÷rÒÀ¢'WGFöç3¢°¢u6fRs¢÷&7F–6T6öÖÖ—DVF—BÀ¢t6æ6VÂs¢gVæ7F–öâ‚’²G'’²B‡F†—2’æF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·ÒÐ¢ÒÀ¢÷Vã¢gVæ7F–öâ‚’°¢òò7&7F–6TÖöFR6—G2B¢Ö–æFW‚"†æB—G2F÷&"öæbBB“°¢òò¥VW'’T’F–Æöw2FVfVÇBFòãâG&—ÆRÖ&VÇBF†RÆ–gC ¢òòƒ’Ö÷fRF†Rw&W"FòF†RTäBöbÆ&öG“â6ò—Bw2Æ7B–â–ç@¢òò÷&FW"(	B6–FW7FW2ç’æW7FVB7F6¶–ærÖ6öçFW‡B6öægW6–öâà¢òòƒ"’FB6Æ72v—F‚–×÷'FçF¢Ö–æFW‚–â552‡v–ç2÷fW"–æÆ–æR’à¢òòƒ2’Ç6ò7F×–æÆ–æR¢Ö–æFW‚v—F‚6WE&÷W'G’‚âââÂv–×÷'FçBr’–à¢òò66RF†R7G–ÆW6†VWB—6âwBÆöFVB–WBöâf—'7B÷Vâà¢6öç7BGrÒB‡F†—2’æ6Æ÷6W7B‚rçV’ÖF–Æörr¢GræVæEFò‚v&öG’r’æFD6Æ72‚v&÷fR×&7F–6RÖÖöFRr¢6öç7BVÂÒGu³Ð¢–b†VÂ’VÂç7G–ÆRç6WE&÷W'G’‚w¢Ö–æFW‚rÂs#rÂv–×÷'FçBr¢òòfö7W2F†RFW‡F&VgFW"F†RF–Æör—2gVÆÇ’&VæFW&VB6òF†R¶W–&ö&@¢òò&—6W2&VF–7F&Ç“²Æ6RF†R7W'6÷"BVæBöbW†—7F–ærFW‡Bà¢6WEF–ÖV÷WB‚‚’Óâ°¢6öç7BFÒB‡F†—2’æf–æB‚rç&7F–6RÖVF—BÖ–çWBr’æfö7W2‚•³Ð¢–b‡F’G'’²Fç6WE6VÆV7F–öå&ævR‡FçfÇVRæÆVæwF‚ÂFçfÇVRæÆVæwF‚’Ò6F6‚…ò’·Ð¢ÒÂS¢Ð¢Ð¢–b‚FFÆræ†46Æ72‚wV’ÖF–ÆörÖ6öçFVçBr’’°¢FFÆræF–Æör‚v÷F–öârÂ÷G2’æF–Æör‚v÷Vâr¢ÒVÇ6R°¢FFÆræF–Æör†÷G2¢Ð§Ð ¢òò6öÖÖ—BF†RF–ÆörÖVF—FVBÆ–æR(	B'VffW'2f–÷6fU7V'F—FÆTVF—B‡VWVVBf÷ ¢òòF†RæW‡B7–æ2W6‚’æB&R×&VæFW'2F†R&7F–6R6&Bv—F‚F†RæWrFW‡Bà¦7–æ2gVæ7F–öâ÷&7F–6T6öÖÖ—DVF—B‚’°¢6öç7BFFÆrÒB‚r7&7F–6TÆ–æTVF—DF–Æörr¢–b‚FFÆræÆVæwF‚’&WGW&à¢6öç7BÆærÒFFÆræFF‚vÆærr’ÓÓÒvVâròvVâr¢†vWDÆætg&öÕW&Â‚’æ6öFRÇÂw7br¢6öç7BÆ–æT–æFW‚ÒFFÆræFF‚vÆ–æT–æFW‚r¢6öç7BæWuFW‡BÒ7G&–ær‚FFÆræf–æB‚rç&7F–6RÖVF—BÖ–çWBr’çfÂ‚’ÇÂrr’çG&–Ò‚¢6öç7B—BÒB‚r7&7F–6TÖöFRr’æFF‚v—FVÒr¢–b‚—BÇÂæWuFW‡B’²G'’²FFÆræF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ò²÷&VæFW%&7F–6T6&B‚“²&WGW&âÐ¢òòF—6&ÆRF†RF–Æörw26fR'WGFöâv†–ÆRF†R÷F–Ö—7F–2w&—FR'Vç2à¢6öç7BG6fT'FâÒFFÆræF–Æör‚wv–FvWBr’æf–æB‚rçV’ÖF–ÆörÖ'WGFöçæR'WGFöã¦6öçF–ç2‚%6fR"’r¢G6fT'Fâç&÷‚vF—6&ÆVBrÂG'VR’çFW‡B‚u6f–æ~(
br¢G'’°¢v—B÷6fU7V'F—FÆTVF—B†—Bæ–BÂÆærÂÆ–æT–æFW‚ÂæWuFW‡B¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚w&7F–6S¢6fRVF—Bf–ÆVBrÂW'"¢ÆW'B‚tf–ÆVBFò6fS¢r²†W'"bbW'"æÖW76vRÇÂW'"’¢Ð¢G6fT'Fâç&÷‚vF—6&ÆVBrÂfÇ6R’çFW‡B‚u6fRr¢G'’²FFÆræF–Æör‚v6Æ÷6Rr’Ò6F6‚…ò’·Ð¢÷&VæFW%&7F–6T6&B‚§Ð ¦7–æ2gVæ7F–öâö7VU&7F–6Uf–FVò†—BÂ&WVW7B’°¢G'’°¢–b‚÷&7F–6Uf–FVô7VW2æ—47W'&VçB‡&WVW7B’’&WGW&à¢6†÷tÖVF–6öçF–æW"‚¢v–æF÷ræÖVF–6VÆV7FVBÒ²Æ–æ³¢—Bæ–BÂ6÷W&6S¢vÆ–æ²rÐ¢v–æF÷rçÆ––æu–÷WGV&Uf–FVòÒG'VP¢v–æF÷rç7–æ57V'F—FÆRÒfÇ6P¢v—B÷&7F–6Uf–FVô7VW2æ7VR†—Bæ–BÂ—BçF–ÖU7F'BÂ&WVW7B¢Ò6F6‚†R’²6öç6öÆRçv&â‚w&7F–6S¢7VRf–FVòf–ÆVBrÂR’Ð§Ð ¢òòÖF6†VBÆ–æR+6öçFW‡BÂ–â&÷F‚ÆæwVvW2Â¶W–VBöfbF†R6÷W&6R5%@¢òò‡v†÷6RÆ–æR–æFW‚—2v†BF†R&V6÷&FW"7F×22—FVÒæÆ–æT–æFW‚’à¦7–æ2gVæ7F–öâ÷&7F–6T6&DÆ–æW2†—BÂ&Vf÷&RÂgFW"’°¢6öç7B·'6VBÂ&VfW'&VEÒÒv—B&öÖ—6RæÆÂ…°¢öÆöE7V'F—FÆW4f÷$—FVÒ†—B’ÂöÆöE&VfW'&VE7V'F—FÆUG&6²†—Bæ–B¢Ò¢–b‚'6VB’&WGW&âçVÆÀ¢6öç7B7&2Ò'6VBç7bÇÂµÐ¢6öç7BFwBÒ'6VBæVâÇÂµÐ¢6öç7BÆöö·WÒ7&VFU7V'F—FÆUG&ç6ÆF–öäÆöö·W‡°¢&VfW'&VC¢&VfW'&VCòæ7VW2À¢ÆæwVvS¢&VfW'&VCòæÆæwVvRÀ¢Ò¢6öç7BFwD'”–BÒæWrÖ‚¢FwBæf÷$V6‚‡2Óâ²–b‡2bb2æ–æFW‚ÒçVÆÂ’FwD'”–Bç6WB…7G&–ær‡2æ–æFW‚’Â2’Ò¢òò7FÆRÆ–æT–æFW‚…5%B&VçVÖ&W&VB6–æ6R6GW&R’(i"&V6÷fW"'’F–ÖR²v÷&Bà¢6öç7BÖF6…÷2ÒöÆö6FT—FVÔ7VR‡7&2Â—B¢–b†ÖF6…÷2Â’&WGW&âçVÆÀ¢òòöæÇ’F†RÆ–æW2F†R6Æ—6â7GVÆÇ’&V6‚âF†W6Rf–ÆW27F—F6‚6GW&W0¢òòg&öÒF—7FçBÖöÖVçG2FövWF†W"Â6òF†RÆ–æRæW‡BFòF†—2öæR–âF†Rf–ÆP¢òò6â&RÖ–çWFW2v’–âF†Rf–FVò(	BWGF–ær—BöâF†R6&Bv÷VÆB6†÷rFW‡@¢òòF†RÆ–&6²æWfW"vWG2Fòà¢6öç7B²g&öÒÂFòÒÒ÷v÷&D6öçFW‡DÆ–æUv–æF÷r‡7&2ÂÖF6…÷2Â&Vf÷&RÇÂÂgFW"ÇÂÀ¢²v÷&C¢—Bçv÷&BÂÖ–åv÷&G4&÷VæC¢öÖ–åv÷&G4&÷VæB‚’ÂvF‡&W6†öÆC¢ö6Æ—vF‡&W6†öÆE6V2‚’Ò¢6öç7B&÷w2ÒµÐ¢f÷"†ÆWB’Òg&öÓ²’ÃÒFó²’²²’°¢6öç7BÆ–æRÒ7&5¶•Ð¢6öç7BÆ’ÒÆ–æRæ–æFW€¢6öç7B6V2ÒFwD'”–BævWB…7G&–ær†Æ’’¢6öç7BG&ç6ÆF–öâÒÆöö·W†Æ–æR’ÇÂ‡6V3òçFW‡CòçG&–Ò‚’ò²FW‡C¢6V2çFW‡BçG&–Ò‚’ÂÆæwVvS¢vVârÒ¢çVÆÂ¢&÷w2çW6‚‡°¢Æ–æT–æFWƒ¢Æ’À¢7F'C¢Æ–æRç7F'Còæ÷&F–æÂÀ¢7F÷¢Æ–æRæVæCòæ÷&F–æÂÀ¢—4ÖF6ƒ¢’ÓÓÒÖF6…÷2À¢6÷W&6S¢7G&–ær†Æ–æRçFW‡BÇÂrr’çG&–Ò‚’À¢F&vWC¢G&ç6ÆF–öãòçFW‡BÇÂrrÀ¢F&vWDÆæwVvS¢G&ç6ÆF–öãòæÆæwVvP¢Ò¢Ð¢&WGW&â&÷w0§Ð ¦gVæ7F–öâ÷&VæFW$¶W–&ö&E6†÷'F7WG2‚F6öçF–æW"’°¢F6öçF–æW"æV×G’‚¢f÷"†6öç7B66÷Röb²ââææWr6WB„´U”$ô$Eõ4„õ%D5UE2æÖ‡6†÷'F7WBÓâ6†÷'F7WBç66÷R’•Ò’°¢F6öçF–æW"æVæB‚B‚sÆƒCãÂöƒCâr’çFW‡B‡66÷R’¢6öç7BGF&ÆRÒB‚sÇF&ÆR6Æ73Ò&¶W–&ö&B×6†÷'F7WG2×F&ÆR#ãÂ÷F&ÆSâr’æVæEFò‚F6öçF–æW"¢´U”$ô$Eõ4„õ%D5UE2æf–ÇFW"‡2Óâ2ç66÷RÓÓÒ66÷R’æf÷$V6‚‡2Óâ°¢6öç7BG&÷rÒB‚sÇG#ãÂ÷G#âr’æVæEFò‚GF&ÆR¢B‚sÇFCãÂ÷FCâr’æVæB‡2æ¶W—2æÖ†¶W’ÓâB‚sÆ¶&CãÂö¶&Câr’çFW‡B†¶W’’ævWBƒ’’’æVæEFò‚G&÷r¢B‚sÇFCãÂ÷FCâr’çFW‡B‡2æÆ&VÂ’æVæEFò‚G&÷r¢Ò¢Ð¢F6öçF–æW"ç&WVæB‚sÇåW6R6ÖBöâÖ4õ2æB7G&Âöâv–æF÷w2÷"Æ–çW‚â–b–÷UGV&R†2¶W–&ö&Bfö7W2Â6Æ–6²F†R6&B&Vf÷&RW6–ær7GVG’6†÷'F7WG2ãÂ÷âr§Ð ¢òòF†R&VfW&Væ6RæB6†÷'F7WG26†&RF†R6ÖRFVf–æ—F–öç2âF–Æöw2æBFW‡@¢òòVF—F–ær¶VWF†V—"÷vâ¶W–&ö&B&V†f–÷"Â–æ6ÇVF–ær”ÔR6ö×÷6—F–öâà¦gVæ7F–öâ÷Vä¶W–&ö&E6†÷'F7WG2‚’°¢G'’²WFô†–FU6WGF–æw5æVÂ‚’Ò6F6‚…ò’·Ð¢ÆWBFFÆrÒB‚r6¶W–&ö&E6†÷'F7WG4F–Æörr¢–b‚FFÆræÆVæwF‚’FFÆrÒB‚sÆF—b–CÒ&¶W–&ö&E6†÷'F7WG4F–Æör"F—FÆSÒ$¶W–&ö&B6†÷'F7WG2#ãÂöF—câr’æVæEFò‚v&öG’r¢÷&VæFW$¶W–&ö&E6†÷'F7WG2‚FFÆr¢6öç7B÷F–öç2Ò°¢v–GFƒ¢ÖF‚æÖ–âƒScÂv–æF÷ræ–ææW%v–GF‚Ò#B’ÂÖ„†V–v‡C¢v–æF÷ræ–ææW$†V–v‡BÒCÀ¢ÖöFÃ¢G'VRÂG&vv&ÆS¢fÇ6RÂ&W6—¦&ÆS¢fÇ6RÀ¢÷Vã¢gVæ7F–öâ‚’°¢B‡F†—2’æ6Æ÷6W7B‚rçV’ÖF–Æörr’æFD6Æ72‚v&÷fR×&7F–6RÖÖöFRr’æ772‚w¢Ö–æFW‚rÂ#¢æGG"‚wF&–æFW‚rÂrÓr’çG&–vvW"‚vfö7W2r¢Ð¢Ð¢–b‚FFÆræ†46Æ72‚wV’ÖF–ÆörÖ6öçFVçBr’’FFÆræF–Æör‚v÷F–öârÂ÷F–öç2’æF–Æör‚v÷Vâr¢VÇ6RFFÆræF–Æör†÷F–öç2§Ð§v–æF÷ræ÷Vä¶W–&ö&E6†÷'F7WG2Ò÷Vä¶W–&ö&E6†÷'F7WG0¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂræ¶W–&ö&B×6†÷'F7WG2Ö'FârÂ÷Vä¶W–&ö&E6†÷'F7WG2 ¦gVæ7F–öâ÷&7F–6U7÷F–g”÷F–öç2†—B’°¢&WGW&â°¢ÖöFS¢w&7F–6RrÀ¢—47W'&VçC¢‚’Óâv–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6T6&G3òå·v–æF÷rå÷&7F–6T–G…ÒÓÓÒ—BÀ¢—5W6VC¢‚’Óâv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÇÂ÷&7F–6U6W76–öåF–ÖV÷WBæW‡—&VBÇÂ…÷&5&V3òæ¶W’ÓÓÒ÷&5&V4¶W’†—B’b`¢…÷&5&V2æÆö÷ ¢ò÷&5&V2æÆö÷7W7VæFV@¢¢²w7F'F–ærrÂw&V6÷&F–ærrÂwÆ–&6²uÒæ–æ6ÇVFW2…÷&5&V2ç†6R’’¢Ð§Ð ¦gVæ7F–öâ÷FövvÆU&7F–6UÆ–&6²‚’°¢6öç7B—BÒ‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ð¢–b‚—B’&WGW&à¢÷&7F–6U6W76–öåF–ÖV÷WBæVç7W&R‡v–æF÷råö6WGF–æw2ç7GVG•6W76–öåF–ÖV÷WDÖ–çWFW2¢–b…÷&5&V3òæÆö÷7W7VæFVBbb÷&5&V2æÆö÷’°¢÷&5&V4Æö÷6VV²…÷&5&V2¢&WGW&à¢Ð¢–b…ö6å7Vµ6–ÆVçD6&B†—B’’&WGW&â÷FövvÆU&7F–6UGG2†—B¢–b‡7÷F–g”6Æ—2†—B’æÆVæwF‚’°¢6öç7B7BÒ÷&5&V0¢–b‡7Còç†6RÓÓÒw&V6÷&F–ærr’&WGW&à¢6öç7BÖVF–Ò7÷F–g•Æ–W"æÖVF–¢6öç7B&W7F'F–ærÒÖVF–ÇÂÖVF–æVæFVBÇÂçVÖ&W"æ—4f–æ—FR†ÖVF–æ7W'&VçEF–ÖR¢–b‡7B’°¢7Bæv—F–ærÒçVÆÃ²7BçFö¶Vâ²°¢7BçvF6…÷2Ò&W7F'F–ærò7÷F–g”6Æ—2†—B•³Òç7F'BÒã¢çVÆÀ¢–b‡7BæVF–ò’²G'’²7BæVF–òçW6R‚’Ò6F6‚…ò’·Ò7BæVF–òÒçVÆÂÐ¢–b‡7Bç†6RÓÓÒwÆ–&6²r’7Bç†6RÒv–FÆRp¢÷&VæFW%&7F–6U&V4&"‚¢Ð¢7÷F–g•Æ–W"çFövvÆU&7F–6R†—BÂ÷&7F–6U7÷F–g”÷F–öç2†—B’¢&WGW&à¢Ð¢–b…ö—4ÖçVÄ—FVÒ†—B’’°¢–b‡v–æF÷rå÷&7F–6UÆ•VæF–ær’²÷&VæFW%&7F–6T6&B‚“²&WGW&âÐ¢6öç7BVF–òÒB‚r7&7F–6TVF–òç&V2×ÖVÂr•³Ð¢–b…÷&7F–6T6Æ—4–ä÷&FW"†—B’æÆVæwF‚bbVF–òbbVF–òç7&2bbVF–òå÷&7F–6T6&BÓÓÒ—B’°¢–b‚VF–òçW6VB’VF–òçW6R‚¢VÇ6R²G'’²&öÖ—6Rç&W6öÇfR†VF–òçÆ’‚’’æ6F6‚‚‚’Óâ·Ò’Ò6F6‚…ò’·ÒÐ¢ÒVÇ6R–b…ö6&D†5f–FVôÆ–æ²†—B’’°¢G'’°¢–b…³Â5Òæ–æ6ÇVFW2‡v–æF÷rç—EÆ–W#òævWEÆ–W%7FFR‚’’’v–æF÷rç—EÆ–W"çW6Uf–FVò‚¢VÇ6RB‚r7&7F–6TÖöFRç&7F–6RÖÖVF–ÖÆ–æ²r’çG&–vvW"‚v6Æ–6²r¢Ò6F6‚…ò’·Ð¢Ð¢&WGW&à¢Ð¢6öç7BÆ–W"Òv–æF÷rç—EÆ–W ¢ÆWB7FFRÒÓ¢G'’²7FFRÒÆ–W#òævWEÆ–W%7FFR‚’Ò6F6‚…ò’·Ð¢–b‡v–æF÷rå÷&7F–6UÆ•VæF–ærÇÂ‡v–æF÷rå÷&7F–6UÆ–&6´6&BÓÓÒ—Bbb³Â5Òæ–æ6ÇVFW2‡7FFR’’’°¢öæWu&7F–6Uf–FVõ&WVW7B‚¢v–æF÷rå÷&7F–6UÆ•VæF–ærÒçVÆÀ¢ÒVÇ6R–b‡7FFRÓÓÒ"bbv–æF÷rå÷&7F–6UÆ–&6´6&BÓÓÒ—Bbbv–æF÷rå÷&7F–6T6Æ—F–ÖW"’°¢òò&W7VÖRW6VBÆ—7FVâÂ&WF–æ–ær—G2÷&–v–æÂ6Æ—ÖVæBvF6†W"à¢÷&7F–6Uf–FVô7VW2æ&Vv–åÆ–&6²…öæWu&7F–6Uf–FVõ&WVW7B‚’¢G'’²Æ–W"çÆ•f–FVò‚’Ò6F6‚…ò’·Ð¢ÒVÇ6RÆ•&7F–6T6Æ—‚§Ð ¢B†Fö7VÖVçB’æöâ‚v¶W–F÷vârÂgVæ7F–öâ†R’°¢6öç7BF&vWBÒRçF&vW@¢6öç7B7W'&VçE&7F–6T6&BÒv–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦V@¢ò‡v–æF÷rå÷&7F–6T6&G2ÇÂµÒ•·v–æF÷rå÷&7F–6T–G…Ò¢çVÆÀ¢6öç7B7F÷&VE&7F–6T6&BÒ7W'&VçE&7F–6T6&Bbbö—4ÖçVÄ—FVÒ†7W'&VçE&7F–6T6&B¢ò÷7F÷&VDÖçVÄ6&B†7W'&VçE&7F–6T6&B’¢çVÆÀ¢6öç7B7F–öâÒ¶W–&ö&E6†÷'F7WB†Ræ÷&–v–æÄWfVçBÇÂRÂ°¢&7F–6S¢v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÀ¢Æ–W%f—6–&ÆS¢v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBb`¢‡v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’À¢VF—Df–Æ&ÆS¢‡7F÷&VE&7F–6T6&Bbbö—5&VDöæÇ•Æ–Æ—7B‡7F÷&VE&7F–6T6&BææÖR’’À¢7GVG”7F—fS¢‡v–æF÷rå÷&7F–6T7F—fRÇÂv–æF÷rå÷Æ––æu&V6÷&F–ær’À¢7GVG•f—6–&ÆS¢‚‡v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’ÇÀ¢‡v–æF÷rå÷Æ––æu&V6÷&F–ærbbv–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VB’’À¢G—–æs¢‡F&vWBbb‡F&vWBæ—46öçFVçDVF—F&ÆRÇÂB‡F&vWB’æ6Æ÷6W7B‚v–çWBÇFW‡F&VÇ6VÆV7BÆVF–òÇf–FVòÅ·&öÆSÒ'FW‡F&÷‚%ÒÅ·&öÆSÒ&6öÖ&ö&÷‚%ÒÅ·&öÆSÒ'6Æ–FW"%ÒÅ·&öÆSÒ'6W&F÷"%ÒÂæ6²r’æÆVæwF‚’’À¢6V&6„fö7W6VC¢F&vWBÓÓÒB‚r76V&6…FW‡Br•³ÒÀ¢F–Æöt÷Vã¢B‚rçV’ÖF–Æös§f—6–&ÆRr’ææ÷B‚ræ&V†–æB×7GVG’×f–Wrr’æÆVæwF‚âÀ¢'WGFöäfö7W6VC¢‡F&vWBbbB‡F&vWB’æ6Æ÷6W7B‚v'WGFöâÆÅ·&öÆSÒ&'WGFöâ%Òr’æÆVæwF‚’À¢6V&6„f–Æ&ÆS¢B‚r76V&6…FW‡Br’æ—2‚s§f—6–&ÆRr¢Ò¢–b‚7F–öâ’&WGW&à¢Rç&WfVçDFVfVÇB‚¢6öç7B7F–öç2Ò°¢†VÇ¢÷Vä¶W–&ö&E6†÷'F7WG2À¢vFB×fö6'VÆ'’s¢÷VäFEFõfö6$F–ÆörÀ¢Æ–Æ—7G3¢÷Vå&V6÷&F–æu&Wf–WtF–ÆörÀ¢vVF—B×&7F–6RÖ6&Bs¢öVF—D7W'&VçE&7F–6T6&BÀ¢w&7F–6RÖFWF–Ç2s¢÷FövvÆU&7F–6T–æfõæVÂÀ¢w7v—F6‚×7GVG’×f–Wrs¢‚’Óâ°¢–b‡v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’7v—F6…&7F–6UFõÆ–W"‚¢VÇ6R–b‡v–æF÷rå÷&7F–6T7F—fRbbv–æF÷rå÷&7F–6TÖ–æ–Ö—¦VB’&W7F÷&U&7F–6TÖöFR‚¢VÇ6R7v—F6…Æ–W%Fõ&7F–6R‚¢ÒÀ¢w7GVG’×FövvÆRs¢‚’Óâ°¢6öç7Bf–WrÒ7GVG•6†÷'F7WEf–Wr‡°¢&7F–6T7F—fS¢v–æF÷rå÷&7F–6T7F—fRÀ¢&7F–6TÖ–æ–Ö—¦VC¢v–æF÷rå÷&7F–6TÖ–æ–Ö—¦VBÀ¢Æ–W$7F—fS¢v–æF÷rå÷Æ––æu&V6÷&F–ærÀ¢Æ–W$Ö–æ–Ö—¦VC¢v–æF÷rå÷&V5Æ”Ö–æ–Ö—¦VBÀ¢Æ7DÖ–æ–Ö—¦VC¢v–æF÷råöÆ7DÖ–æ–Ö—¦VE7GVG•f–WrÀ¢Ò¢–b‡f–WrÓÓÒvÖ–æ–Ö—¦R×&7F–6Rr’Ö–æ–Ö—¦U&7F–6TÖöFR‚¢VÇ6R–b‡f–WrÓÓÒw&W7F÷&R×&7F–6Rr’&W7F÷&U&7F–6TÖöFR‚¢VÇ6R–b‡f–WrÓÓÒvÖ–æ–Ö—¦R×Æ–W"r’Ö–æ–Ö—¦UÆ––æu&V6÷&F–ær‚¢VÇ6R–b‡f–WrÓÓÒw&W7F÷&R×Æ–W"r’&W7F÷&UÆ––æu&V6÷&F–ær‚¢ÒÀ¢6V&6ƒ¢‚’Óâ²6öç7B–çWBÒB‚r76V&6…FW‡Br•³Ó²–çWBæfö7W2‚“²–çWBç6VÆV7B‚’ÒÀ¢w&7F–6R×6V&6‚s¢‚’ÓâB‚r7&7F–6TÖöFRç&7F–6R×6V&6‚r’çG&–vvW"‚v6Æ–6²r’À¢&Wf–÷W3¢‚’Óâ&7F–6Tæb‚Ó’ÂæW‡C¢‚’Óâ&7F–6Tæbƒ’À¢Æ“¢÷FövvÆU&7F–6UÆ–&6²Â&WfVÃ¢&WfVÅ&7F–6T6&BÀ¢F—&V7F–öã¢FövvÆU&7F–6TF—"Â7VVC¢‚’Óâ²–b‚B‚r7&7F–6TÖöFRç&7F–6R×Æ’r’æ—2‚s¦†–FFVâr’’7–6ÆU&7F–6UÆ–&6µ&FR‚’ÒÀ¢6Æ÷6S¢6Æ÷6U&7F–6TÖöFP¢Ð¢7F–öç5¶7F–öåÒ‚§Ò ¢òòFVÆVvFVB†æFÆW'2(	Bv—&VBöæ6RBFö7VÖVçB&VG’&VÆ÷rà¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr7&V57F'D'FârÂ7F'E&V6÷&F–ær¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr7&V5W6T'FârÂW6U&V6÷&F–ær¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr7&V5&W7VÖT'FârÂ&W7VÖU&V6÷&F–ær¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr7&V57F÷'FârÂ7F÷&V6÷&F–ær¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂr7&V5&Wf–Wt'FâÂ6†VFW%Æ–Æ—7G4'FârÂ÷Vå&V6÷&F–æu&Wf–WtF–Æör¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂræ6GW&RÖ'FârÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚¢Rç7F÷&÷vF–öâ‚¢ö6GW&TÖF6„g&öÔ'WGFöâ‚B‡F†—2’§Ò ¢òòG&ç6ÆFRF†R6÷W&6RÆ–æW27W'&VçFÇ’f—6–&ÆR–âF†—2v–æF÷r–çFòVævÆ—6‚æ@¢òòw&—FRF†VÒ–çFòF†R—&VBæVâç7'B‡6VRG&ç6ÆFUf—6–&ÆTÆ–æW2’à¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂrçG&ç6ÆFRÖÆ–æW2Ö'FârÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚¢Rç7F÷&÷vF–öâ‚¢6öç7BF'FâÒB‡F†—2¢–b‚F'Fâæ†46Æ72‚v'W7’r’’&WGW&à¢G&ç6ÆFUf—6–&ÆTÆ–æW2‚F'FâæGG"‚vFFÖ–Br’ÂF'FâæGG"‚vFF×W&Âr’ÂF'Fâ§Ò ¢òò)H)H–æÆ–æR7V'F—FÆRÆ–æRVF—B)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òòVæ6–Â–6öâæW‡BFòV6‚Ö–â÷6V6öæF'’Æ–æR÷Vç2FW‡F&V²6fRô6æ6VÂà¢òò6fR6öÖÖ—G2F†RVF—FVBÆ–æR&6²FòF†RÖF6†–ær5%B–âF†R6–væVBÖ–âW6W"w2&Wòf–¢òò÷6fU7V'F—FÆTVF—BÂF†Vâ&R×&VæFW'2F†RæÆ–æR6öçFVçB–âÆ6Rà¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂræVF—BÖÆ–æRÖ'FârÂ7–æ2gVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BFÆ–æRÒB‡F†—2’æ6Æ÷6W7B‚ræÆ–æRr¢–b‚FÆ–æRæÆVæwF‚ÇÂFÆ–æRæ†46Æ72‚vVF—F–ærr’’&WGW&à¢–b‚÷&WV—&U6VÆb‚’’&WGW&à¢6öç7BÆ–æ²ÒFÆ–æRæGG"‚vFF×W&Âr’ÇÂrp¢6öç7BÆæt6öFRÒFÆ–æRæGG"‚vFFÖÆærÖ6öFRr’ÇÂw7bp¢6öç7BÆ–æT–æFW‚ÒFÆ–æRæGG"‚vFFÖÆ–æRÖ–æFW‚r’ÇÂrp¢–b‚Æ–æ²ÇÂÆ–æT–æFW‚’²ÆW'B‚t6ææ÷BVF—B(	BÖ—76–ærÆ–æRÖWFFFâr“²&WGW&âÐ¢G'’²v—B÷&W7F÷&U7V'F—FÆTFö7VÖVçB†Æ–æ²’Ò6F6‚†W'&÷"’²ÆW'B†W'&÷"æÖW76vR“²&WGW&âÐ¢6öç7B&rÒövWE&u7V'F—FÆTÆ–æUFW‡B†Æ–æ²ÂÆæt6öFRÂÆ–æT–æFW‚¢òò7F6‚F†RW†—7F–ær…DÔÂ6ò6æ6VÂ6â&W7F÷&R††–v†Æ–v‡G27W'f—fR’à¢6öç7BGFW‡E7âÒFÆ–æRæf–æB‚ræÆ–æR×FW‡Br¢FÆ–æRæFF‚w&Wd‡FÖÂrÂGFW‡E7âæ‡FÖÂ‚’¢FÆ–æRæFD6Æ72‚vVF—F–ærr¢6öç7BÆ–æW2Ò‡&ræÖF6‚‚õÆâör’ÇÂµÒ’æÆVæwF‚²¢GFW‡E7âæ‡FÖÂ€¢ÇFW‡F&V6Æ73Ò&VF—BÖÆ–æRÖ–çWB"&÷w3Ò"G´ÖF‚æÖ‚ƒ"ÂÖF‚æÖ–âƒbÂÆ–æW2’—Ò#âGµòæW66R‡&r—ÓÂ÷FW‡F&Væ°¢Ç7â6Æ73Ò&VF—BÖÆ–æRÖ7F–öç2#à¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'FâVF—BÖÆ–æR×6fR"F—FÆSÒ%6fR„7G&Â´VçFW"’#å6fSÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò&'FâVF—BÖÆ–æRÖ6æ6VÂ"F—FÆSÒ$6æ6VÂ„W62’#ä6æ6VÃÂö'WGFöãà¢Â÷7ãæ ¢¢6öç7BGFÒFÆ–æRæf–æB‚ræVF—BÖÆ–æRÖ–çWBr’æfö7W2‚¢òòÆ6R6&WBBF†RVæBöâfö7W0¢6öç7BFÆVâÒGFçfÂ‚’æÆVæwF€¢G'’²GF³Òç6WE6VÆV7F–öå&ævR‡FÆVâÂFÆVâ’Ò6F6‚…ò’·Ð§Ò ¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂræVF—BÖÆ–æRÖ6æ6VÂrÂgVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BFÆ–æRÒB‡F†—2’æ6Æ÷6W7B‚ræÆ–æRr¢6öç7B&WbÒFÆ–æRæFF‚w&Wd‡FÖÂr¢–b‡&WbÒçVÆÂ’FÆ–æRæf–æB‚ræÆ–æR×FW‡Br’æ‡FÖÂ‡&Wb¢FÆ–æRç&VÖ÷fT6Æ72‚vVF—F–ærr§Ò ¢B†Fö7VÖVçB’æöâ‚v6Æ–6²rÂræVF—BÖÆ–æR×6fRrÂ7–æ2gVæ7F–öâ†R’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢6öç7BF'FâÒB‡F†—2¢–b‚F'Fâç&÷‚vF—6&ÆVBr’’&WGW&à¢6öç7BFÆ–æRÒF'Fâæ6Æ÷6W7B‚ræÆ–æRr¢6öç7BÆ–æ²ÒFÆ–æRæGG"‚vFF×W&Âr’ÇÂrp¢6öç7BÆæt6öFRÒFÆ–æRæGG"‚vFFÖÆærÖ6öFRr’ÇÂw7bp¢6öç7BÆ–æT–æFW‚ÒFÆ–æRæGG"‚vFFÖÆ–æRÖ–æFW‚r’ÇÂrp¢6öç7BGFÒFÆ–æRæf–æB‚ræVF—BÖÆ–æRÖ–çWBr¢6öç7BæWuFW‡BÒ7G&–ær‚GFçfÂ‚’ÇÂrr’çG&–Ò‚¢–b‚æWuFW‡B’²ÆW'B‚uFW‡B6ææ÷B&RV×G’âr“²&WGW&âÐ¢F'Fâç&÷‚vF—6&ÆVBrÂG'VR’çFW‡B‚u6f–æ~(
br¢G'’°¢v—B÷6fU7V'F—FÆTVF—B†Æ–æ²ÂÆæt6öFRÂÆ–æT–æFW‚ÂæWuFW‡B¢òò&WÆ6RF†RVF—F÷"v—F‚F†R†W66VB’Æ–âFW‡Bâ†–v†Æ–v‡G2&RvöæP¢òòöâF†R§W7BÖVF—FVBÆ–æR(	BF†W’vÆÂ6öÖR&6²öâF†RæW‡B6V&6‚&VæFW"à¢FÆ–æRæf–æB‚ræÆ–æR×FW‡Br’çFW‡B†æWuFW‡B¢FÆ–æRç&VÖ÷fT6Æ72‚vVF—F–ærr¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚w6fR7V'F—FÆRVF—Bf–ÆVBrÂW'"¢ÆW'B‚tf–ÆVBFò6fS¢r²†W'"bbW'"æÖW76vRÇÂW'"’¢F'Fâç&÷‚vF—6&ÆVBrÂfÇ6R’çFW‡B‚u6fRr¢Ð§Ò ¢òò¶W–&ö&B6†÷'F7WG2–ç6–FRF†R–æÆ–æRVF—F÷"à¢B†Fö7VÖVçB’æöâ‚v¶W–F÷vârÂræVF—BÖÆ–æRÖ–çWBrÂgVæ7F–öâ†R’°¢–b†Ræ¶W’ÓÓÒtW66Rr’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢B‡F†—2’æ6Æ÷6W7B‚ræÆ–æRr’æf–æB‚ræVF—BÖÆ–æRÖ6æ6VÂr’æ6Æ–6²‚¢ÒVÇ6R–b‚†Ræ7G&Ä¶W’ÇÂRæÖWF¶W’’bbRæ¶W’ÓÓÒtVçFW"r’°¢Rç&WfVçDFVfVÇB‚“²Rç7F÷&÷vF–öâ‚¢B‡F†—2’æ6Æ÷6W7B‚ræÆ–æRr’æf–æB‚ræVF—BÖÆ–æR×6fRr’æ6Æ–6²‚¢Ð§Ò ¢òòU427F÷2Æ–&6³²76RFövvÆW2W6RâöæÇ’7F—fRv†VâÆ–&6²—2öâÀ¢òòæB76R—2–væ÷&VBv†–ÆRfö7W2—2–âFW‡B–çWB6òF†RW6W"6â7F–ÆÀ¢òòG—R–âF–Æöw2F†B†VâFò&R÷Vâà¢B†Fö7VÖVçB’æöâ‚v¶W–F÷vârÂgVæ7F–öâ†R’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&à¢–b†Ræ—4FVfVÇE&WfVçFVB‚’ÇÂRæ÷&–v–æÄWfVçCòæ—46ö×÷6–ærÇÂRæ7G&Ä¶W’ÇÂRæÇD¶W’ÇÂRæÖWF¶W’ÇÀ¢B‚rçV’ÖF–Æös§f—6–&ÆRr’æÆVæwF‚ÇÂRçF&vWCòæ—46öçFVçDVF—F&ÆRÇÀ¢B†RçF&vWB’æ6Æ÷6W7B‚v–çWBÇFW‡F&VÇ6VÆV7BÆVF–òÇf–FVòÅ·&öÆSÒ'FW‡F&÷‚%ÒÅ·&öÆSÒ&6öÖ&ö&÷‚%ÒÅ·&öÆSÒ'6Æ–FW"%ÒÂæ6²r’æÆVæwF‚’&WGW&à¢òòæ÷Bv†–ÆR&7F–6R—2Wâ6W76–öâFöW2æ÷BVæBv†Vâ&7F–6R÷Vç2(	B—@¢òò—2öæÇ’W6VB(	BæB&÷F‚f–Ww2&–æBF†RFö7VÖVçBÂ6òv—F†÷WBF†—2F†P¢òò'&÷r¶W—2GW&â&7F–6R6&BäBÖ÷fRF†RFV6²w2VWVR&V†–æB—BÂæ@¢òò76R&W7VÖW2FV6²v†÷6RWfW'’6öçG&öÂ&7F–6R—26÷fW&–ærâW66P¢òòv÷VÆB6Æ÷6R&÷F‚Böæ6Râ&7F–6R†2F†R¶W–&ö&Bf÷"2Æöær2—B—0¢òòF†RF†–æröâ67&VVâà¢–b‡v–æF÷rå÷&7F–6T7F—fR’&WGW&à¢–b†Ræ¶W’ÓÓÒtW66Rr’°¢Rç&WfVçDFVfVÇB‚¢7F÷Æ––æu&V6÷&F–ær‚¢&WGW&à¢Ð¢–b†Ræ¶W’ÓÓÒrrÇÂRæ6öFRÓÓÒu76Rr’°¢6öç7BFrÒ†RçF&vWBbbRçF&vWBçFtæÖRÇÂrr’çFôÆ÷vW$66R‚¢6öç7BVF—F&ÆRÒFrÓÓÒv–çWBrÇÂFrÓÓÒwFW‡F&VrÇÂ†RçF&vWBbbRçF&vWBæ—46öçFVçDVF—F&ÆR¢–b†VF—F&ÆR’&WGW&à¢Rç&WfVçDFVfVÇB‚¢FövvÆUÆ––æu&V6÷&F–æuW6R‚¢Ð¢òò'&÷r¶W—2Ç6òæf–vFRv†VâÆ–&6²—2öâ††æG’öâFW6·F÷’à¢–b†Ræ¶W’ÓÓÒt'&÷tÆVgBr’°¢6öç7BFrÒ†RçF&vWBbbRçF&vWBçFtæÖRÇÂrr’çFôÆ÷vW$66R‚¢–b‡FrÓÓÒv–çWBrÇÂFrÓÓÒwFW‡F&Vr’&WGW&à¢Rç&WfVçDFVfVÇB‚¢æf–vFU&V6÷&F–æuÆ–&6²‚w&Wbr¢ÒVÇ6R–b†Ræ¶W’ÓÓÒt'&÷u&–v‡Br’°¢6öç7BFrÒ†RçF&vWBbbRçF&vWBçFtæÖRÇÂrr’çFôÆ÷vW$66R‚¢–b‡FrÓÓÒv–çWBrÇÂFrÓÓÒwFW‡F&Vr’&WGW&à¢Rç&WfVçDFVfVÇB‚¢æf–vFU&V6÷&F–æuÆ–&6²‚væW‡Br¢Ð§Ò ¢òòW‡FW&æÂÖVF–¶W—2„&ÇVWFö÷F‚†VG6WBÂõ2ÖVF–6öçG&öÇ2ÂF†R†÷7@¢òòvV'f–Wrw2†&Gv&R¶W—2’F—7F6‚7W—F÷$ÖVF–¶W–7W7FöÔWfVçBv—F€¢òòFWF–Âæ¶W’(ˆ‚²wÆ’rÂwW6RrÂwÆ•÷W6RrÂw7F÷rÂvæW‡BrÂw&Wf–÷W2rÀ¢òòvf7Eöf÷'v&BrÂw&Wv–æBwÒâv—&–ærF†VÒF‡&÷Vv‚F†R6ÖRæf–vF–öâ÷W6P¢òòF‚¶VW2F†R–æÆ–æR×67&—B6öçG&7Bg&öÒÆæwVvRæ‡FÖÂ†öæ÷W&VBà¢òð¢òòv†–ÆRÆ–Æ—7B—2'Vææ–ærF†W’ÆÂ&VÆöærFòF†R6W76–öâÂæ÷B§W7BF†P¢òòFövvÆS¢v—&VB'WGFöâ6VæG2öæRDôttÄRÂ'WB&ÇVWFö÷F‚†VG6WB7V·0¢òòe$5æB6VæG2F—67&WFRÄ’æBU4Râ†æFÆ–æröæÇ’F†RFövvÆRÆVgBW6P¢òòæB&W7VÖRFVBöâW†7FÇ’F†R†VG6WG2V÷ÆRW6RÂv†–ÆRF†R†÷7BV–WFÇ¢òò&â—G2÷vâFVfVÇBöâF†R–÷UGV&RÆ–W"â÷WG6–FRÆ–Æ—7BF†W’&Ræ÷@¢òò÷W'2ÂæBF†R†÷7Bw2FVfVÇG2&Rv†BG&—fRÆ–âf–FVòà¢òòæG&ö–Bw2ÖVF–6W76–öâ6öÆÆ6W2†VG6WB6Æ–6·2&Vf÷&RvRWfW"6VRF†VÓ ¢òò6Æ–6²(i"Æ•÷W6RÂ"(i"æW‡BÂ2(i"&Wf–÷W2âF†W&R—2æòBÖ6Æ–6²¶W–6öFRÀ¢òò6òvVçV–æRVG'WÆR×F6âwB&RF—7F–æwV—6†VB†W&R(	BF†R6÷VçF–ærv÷VÆ@¢òò†fRFò†VâæF—fVÇ’Âöâ&r´U”4ôDUô„TE4UD„ôô²WfVçG2ÂæBWfVâF†Và¢òòöæÇ’f÷"†VG6WG2F†B6VæB&r6Æ–6·2&F†W"F†âe$56öÖÖæG2à¢òð¢òò6òw&Wf–÷W2r‡F†RG&—ÆR×F’&Wv–æG2â—B§V×2FòF†R&Wf–÷W2—FVÒ–âGvð¢òò66W2–ç7FVC¢v†VâF†R&Wv–æBv÷VÆBÆæB&Vf÷&RF†R7F'Böbv†B—0¢òòÆ––ær(	BæV"F†R&Vv–ææ–ærÂ&&6²"6âöæÇ’6Vç6–&Ç’ÖVâF†R—FVÒ&Vf÷&P¢òò(	BæBv†Vâ4T4ôäBG&—ÆR×FÆæG2v—F†–âF†Rv–æF÷r&VÆ÷rÂv†–6‚—2†÷p¢òò–÷RÆVfRâ—FVÒg&öÒF†RÖ–FFÆRöb—BâF†Bf—'7BFw2&Wv–æB—2Ç&VG¢òòÆ–VB'’F†VâÂv†–6‚6÷7G2æ÷F†–ærÂ6–æ6RvRw&RÆVf–ærF†R—FVÒç—v’à¦6öç7B$T5õ$UeôDõT$ÄUôÕ2Ò“ ¦ÆWB÷&V5&Wd¶W”BÒ ¢òòv†WF†W"F†R&Wf–÷W2F7GVÆÇ’&Wv÷VæBâF†RF÷V&ÆR×FÖVç2&6æ6VÂF†@¢òò&Wv–æBæBÆVfRF†R—FVÒ"Â6ò—BöæÇ’Æ–W2v†VâF†W&Rt2&Wv–æB(	Böà¢òò6†÷'BÖçVÂ&V6÷&F–ærWfW'’F§V×2Ç&VG’ÂæB—&–ærGvòöbF†÷6P¢òò–çFò6ö×÷VæBvW7GW&Rv÷VÆB6–ÆVçFÇ’6¶—Gvò6&G2à¦ÆWB÷&V5&Wev56VV²ÒfÇ6P ¢òò6Æ–Ò¶W’f÷"F†RÆ–Æ—7BÂ6òF†R†÷7Bw2÷vâ†æFÆW"FöW6âwB7Böâ—BFöòà¢òð¢òòF†R†÷7BF—7F6†W2Æ–â7W7FöÔWfVçBÂæB7W7FöÔWfVçB—2æ÷B6æ6VÆ&ÆP¢òòVæÆW72—B—2ÖFRF†Bv’(	B6ò&WfVçDFVfVÇB‚’†W&RFöW2æ÷F†–ærÂæBF†P¢òò†÷7Bw2FVfVÇB†æFÆW"'Vç2öâWfW'’&W72†÷vWfW"F†RvRç7vW'2—BâF†@¢òò†æFÆW"FövvÆW2v–æF÷rç—EÆ–W&†öâÖçVÂ6&BÂ7F'F–ærF†R&VfW&Væ6P¢òòf–FVòF†Bv2öæÇ’WfW"7VVB’æBF†Vâ&W÷'G2Æ–&6²7FFRg&öÐ¢òòv–æF÷rç—EÆ––ævÂv†–6‚ÖçVÂ6&BæWfW"6WG2(	B6òFVçF‚öb6V6öæ@¢òògFW"vRFöÆBF†R7—7FVÒvRvW&RÆ––ærÂF†R6W76–öâfÆ—VB&6²FòW6V@¢òòæBF†R†VG6WB7F÷VB&V6†–ærF†—2vRBÆÂà¢òð¢òò7F÷–ÖÖVF–FU&÷vF–öâFöW2v†B&WfVçDFVfVÇB6ææ÷BâF†R†÷7B–ç7FÆÇ0¢òò—G2Æ—7FVæW"öæ6RF†RvR†2f–æ—6†VBÆöF–ærÂv†–6‚—2gFW"F†—2ÖöGVÆP¢òò&âÂ6ò÷W'2—2&Vv—7FW&VBf—'7BæB6â7F÷F†RWfVçB&Vf÷&R—BvWG2F†W&Rà¢òð¢òòöæÇ’v†–ÆRÆ–Æ—7B—2'Vææ–æs¢÷WG6–FRöæRF†W6R¶W—2&Ræ÷B÷W'2Âæ@¢òòF†R†÷7Bw2FVfVÇG2&RW†7FÇ’v†B6†÷VÆBG&—fRÆ–âf–FVòà¦gVæ7F–öâ÷&V5F¶TÖVF–¶W’†Wb’°¢–b‚v–æF÷rå÷Æ––æu&V6÷&F–ær’&WGW&âfÇ6P¢òò&7F–6R—2öâF÷æBF†RFV6²—2W6VBVæFW&æVF‚v—F‚æòf—6–&ÆP¢òò6öçG&öÂ(	B†VG6WBÆ’v÷VÆB7F'B—B6÷VæF–ærv—F‚æ÷F†–æröâ67&VVà¢òò&ÆRFò7F÷—Bv–âà¢–b‡v–æF÷rå÷&7F–6T7F—fR’&WGW&âfÇ6P¢–b‡G—VöbWbç&WfVçDFVfVÇBÓÓÒvgVæ7F–öâr’Wbç&WfVçDFVfVÇB‚¢–b‡G—VöbWbç7F÷–ÖÖVF–FU&÷vF–öâÓÓÒvgVæ7F–öâr’Wbç7F÷–ÖÖVF–FU&÷vF–öâ‚¢&WGW&âG'VP§Ð §v–æF÷ræFDWfVçDÆ—7FVæW"‚v7W—F÷$ÖVF–¶W’rÂgVæ7F–öâ†Wb’°¢–b‚WbÇÂWbæFWF–Â’&WGW&à¢7v—F6‚†WbæFWF–Âæ¶W’’°¢66Rw&Wf–÷W2s¢°¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢6öç7Bæ÷rÒFFRææ÷r‚¢6öç7Bv–âÒ÷&V5&Wev56VV²bb†æ÷rÒ÷&V5&Wd¶W”B’Â$T5õ$UeôDõT$ÄUôÕ0¢÷&V5&Wd¶W”BÒv–âò¢æ÷ròò6öç7VÖRÂ6ò2F2—6âwB"§V×0¢–b†v–â’²÷&V5&Wev56VV²ÒfÇ6S²æf–vFU&V6÷&F–æuÆ–&6²‚w&Wbr“²'&V²Ð¢6öç7B6VV¶VBÒ÷&V5Æ•6VVµ&VÆF—fR‚Õ$T5õ4TTµõ5DUõ4T2’ÓÓÒG'VP¢÷&V5&Wev56VV²Ò6VV¶V@¢–b‡6VV¶VB’°¢ö7'V–ÆEFö7B†(ú¢Gµ$T5õ4TTµõ5DUõ4T7×6¢'&V°¢Ð¢òòV—F†W"F†R&Wv–æBv÷VÆB'VâöfbF†Rg&öçBöbF†—2—FVÒÂ÷"F†W&R—0¢òòæ÷F†–ær6VV¶&ÆRBÆÂ†&WGvVVâ—FV×2Â6’’(	B&÷F‚ÖVâ&&6²"à¢æf–vFU&V6÷&F–æuÆ–&6²‚w&Wbr¢'&V°¢Ð¢66RvæW‡Bs ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢æf–vFU&V6÷&F–æuÆ–&6²‚væW‡Br¢'&V°¢66RwÆ•÷W6Rs ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢FövvÆUÆ––æu&V6÷&F–æuW6R‚¢'&V°¢òòF—67&WFRÆ’÷W6RÂ&F†W"F†âFövvÆRâV6‚—2æòÖ÷v†VâF†P¢òò6W76–öâ—2Ç&VG’–âF†R7FFR6¶VBf÷"(	B†VG6WBF†B&WVG2Ä¢òò×W7Bæ÷BW6Rv†B—B§W7B&W7VÖVBâ—B7F–ÆÂç7vW'2ÂF†÷Vvƒ¢Ä¢òòF†B'&—fW2v†–ÆRvR&RÇ&VG’Æ––ærW7VÆÇ’ÖVç2F†R7—7FVÒw0¢òò–FVöbW2†2G&–gFVBÂæB6W76–öâ—BF†–æ·2—2–FÆR—2öæR—B7F÷0¢òò6VæF–ær'WGFöç2FòâF†RFövvÆR—G6VÆb÷7G27FFRöâ—G2÷vâà¢66RwÆ’s ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢–b‡v–æF÷rå÷&V5Æ•W6VB’FövvÆUÆ––æu&V6÷&F–æuW6R‚¢VÇ6R÷÷7DÖVF–7FFR‡G'VR¢'&V°¢66RwW6Rs ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢–b‚v–æF÷rå÷&V5Æ•W6VB’FövvÆUÆ––æu&V6÷&F–æuW6R‚¢VÇ6R÷÷7DÖVF–7FFR†fÇ6R¢'&V°¢òòFVÆ–&W&FVÇ’W6RÂæ÷BFV&F÷vââæG&ö–B6VæG25Dõf÷"F†–æw2F†P¢òòW6W"F–Bæ÷BÖVâ2&VæBF†—2"(	B6ÆÂ'&—f–ærÂæ÷F†W"F¶–æp¢òò÷fW"ÂF†Ræ÷F–f–6F–öâ&V–ær7v—VBv’(	BæBÆ÷6–ærF†Rv†öÆR6W76–öà¢òòFòöæRöbF†÷6R—2æ÷B&V6÷fW&&ÆR'’&W76–ærÆ’v–âà¢66Rw7F÷s ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢–b‚v–æF÷rå÷&V5Æ•W6VB’FövvÆUÆ––æu&V6÷&F–æuW6R‚¢VÇ6R÷÷7DÖVF–7FFR†fÇ6R¢'&V°¢òò6VV²F‡&÷Vv‚F†R6W76–öâ&F†W"F†âF†RÆ–W"â6GW&VB—FVÒ—2¢òò6Æ–6RöbÆöævW"f–FVòÂ6òF†R†÷7Bw2÷vâ6VV²(	Bv†–6‚¶æ÷w2æ÷F†–æp¢òò&÷WBv†W&RF†R6Æ–6R7F'G2÷"VæG2(	BG&÷2F†RW6W"–çFòVç&VÆFV@¢òòfö÷FvRÂæBöâÖçVÂ6&B—BÖ÷fW2Æ–W"F†B—6âwB6÷VæF–ærà¢òð¢òòF†W6R¶W—2öæÇ’6VV²âv†W&RF†W&R—2æò&ööÒFòÖ÷fR(	B&V6÷&FVBf6P¢òò—26V6öæB÷"GvòÂ6òF†B—2F†R÷&F–æ'’66RöâÖçVÂ6&B(	BF†W¢òòFòæ÷F†–ærÂ&F†W"F†âfÆÆ–ærF‡&÷Vv‚FòF†RæW‡B÷"&Wf–÷W2—FVÓ ¢òòF†Bv÷VÆB&W7VÖR6W76–öâF†RW6W"†BW6VBÂæBv÷VÆBF‡&÷rv¢òòF†R÷F†W"f6RöbF†R6&BF†W’&RöââÆVf–ærâ—FVÒ—2v†BF†P¢òòFVF–6FVBæW‡BæB&Wf–÷W2¶W—2&Rf÷"à¢66Rvf7Eöf÷'v&Bs ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢–b…÷&V5Æ•6VVµ&VÆF—fR…$T5õ4TTµõ5DUõ4T2’ÓÓÒG'VR’ö7'V–ÆEFö7B†(ú’Gµ$T5õ4TTµõ5DUõ4T7×6¢'&V°¢66Rw&Wv–æBs ¢–b‚÷&V5F¶TÖVF–¶W’†Wb’’'&V°¢–b…÷&V5Æ•6VVµ&VÆF—fR‚Õ$T5õ4TTµõ5DUõ4T2’ÓÓÒG'VR’ö7'V–ÆEFö7B†(ú¢Gµ$T5õ4TTµõ5DUõ4T7×6¢'&V°¢Ð§Ò ¢B†gVæ7F–öâ‚’°¢òòF†R66÷VçBæVÂæBF†R&ö÷B6–vâÖ–â6†V6²â&ö÷D66÷VçBWG27F÷&V@¢òò'&÷w6W"Fö¶Vâ–âv—D‡V%WF–Ç2&Vf÷&R—G2f—'7Bv—BÂ6òv—D‡V%WF–Ç0¢òò6ÆÇ2g&öÒ†W&Röâ6''’—Bâf–ÇW&R†W&R×W7Bæ÷B7F÷F†RvRà¢G'’²ö–æ—D66÷VçEæVÂ‚’Ò6F6‚†R’²6öç6öÆRçv&â‚u¶66÷VçEÒæVÂ–æ—Bf–ÆVBrÂR’Ð¢G'’°¢ö&ö÷D66÷VçB‚’æ6F6‚†RÓâ6öç6öÆRçv&â‚u¶66÷VçEÒ&ö÷B6†V6²f–ÆVBrÂR’¢Ò6F6‚†R’²6öç6öÆRçv&â‚u¶66÷VçEÒ&ö÷B6†V6²f–ÆVBrÂR’Ð¢öÆöE&V6÷&F–ær‚¢òò×W7BföÆÆ÷röÆöE&V6÷&F–ær(	B6GW&RF†B'&—fVB&Vf÷&RF†—2vP¢òòf–æ—6†VBÆöF–æræVVG2F†R&VÂÆ–Æ—7B6öÆÆV7F–öâFò6†ö÷6Rg&öÒà¢ö6F–öä6GW&U&VG’‚¢òò&W7F÷&RF—'G’Ö&¶W"6òvR&Vg&W6‚gFW"Æö6ÂVF—B7F–ÆÂ6†÷w0¢òòF†R7–æ2¢–æF–6F÷"VçF–ÂF†RW6W"7GVÆÇ’W6†W2à¢G'’²v–æF÷rå÷&V6÷&F–æw4F—'G’Ò÷W6W$FFævWD—FVÒ…$T5ôD•%E•ô´U’’ÓÓÒsrÒ6F6‚…ò’·Ð¢÷WFFU&V6÷&F–æuT’‚¢òòÖW&vRv†FWfW"w2öâv—D‡V"–çFòÆö6Â(	B'&–ær–âÆ–Æ—7G26GW&V@¢òòg&öÒæ÷F†W"FWf–6Râf—&RÖæBÖf÷&vWC²f–ÇW&W2&RÆövvVBà¢öÖW&vU&VÖ÷FU&V6÷&F–æw4–çFôÆö6Â‚’æ6F6‚†RÓâ6öç6öÆRçv&â‚vÖW&vR&VÖ÷FR&V6÷&F–æw2f–ÆVBrÂR’¢òò6²F†RæF—fRf÷"—G2&öö²ôUT"Æ–Æ—7G2â—B&WÆ–W27–æ6‡&öæ÷W6Ç¢òòf–F†Rv7W—F÷%Æ–Æ—7G2rWfVçB††æFÆVB&÷fR’âæòÖ÷–âÆ–â'&÷w6W"à¢G'’°¢–b‡v–æF÷råÆ–Æ—7D'&–FvRbbG—Vöbv–æF÷råÆ–Æ—7D'&–FvRç÷7DÖW76vRÓÓÒvgVæ7F–öâr’°¢v–æF÷råÆ–Æ—7D'&–FvRç÷7DÖW76vR„¥4ôâç7G&–æv–g’‡²÷¢vvWEÆ–Æ—7G2rÒ’¢Ð¢Ò6F6‚†R’²6öç6öÆRçv&â‚vvWEÆ–Æ—7G2÷7Bf–ÆVBrÂR’Ð¢òò&öö²×6V&6‚&"Æ—fW2–ç6–FR7&W7VÇC²WB—BF†W&Röæ6RB&ö÷B6ò—Bw0¢òòf–Æ&ÆR&Vf÷&RF†Rf—'7B6V&6‚Föòà¢öVç7W&TÆ–'&'•6V&6„&"‚¢òòvÆö&Å6V&6‚&F6‚F†BÆæFVB&Vf÷&RF†—2vRf–æ—6†VBÆöF–ær—0¢òòÖ—'&÷&VBöâF†Rv–æF÷r(	B&VæFW"—B&F†W"F†âÆ÷6–ær—Bâ—Bw2öæÇ’F†P¢òòÆ7B&F6‚öbF†B7G&VÒ†V&Æ–W"FVÇF2&RvöæR’Â6òG&VB—B2¢òòf–æ—6†VBÂ÷76–&Ç’×'F–Â&W7VÇB6WBà¢G'’°¢–b‡v–æF÷råõö7W—F÷$vÆö&Å6V&6…&W7VÇG2’°¢6öç7BÒöæ÷&ÖÆ—¦TÆ–'&'•–ÆöB‡v–æF÷råõö7W—F÷$vÆö&Å6V&6…&W7VÇG2¢–b‡æ†—G2æÆVæwF‚’°¢÷&VæFW$Æ–'&'•–ÆöB‡²VW'“¢çVW'’Â†—G3¢æ†—G2Â†—G46VC¢æ†—G46VBÒÂ²6æ6VÆÆVC¢æ6æ6VÆÆVBÒ¢Ð¢Ð¢Ò6F6‚†R’²6öç6öÆRçv&â‚w&WÆ––ær7W—F÷$vÆö&Å6V&6…&W7VÇG2f–ÆVBrÂR’Ð§Ò ¢òòW‡÷6RgVæ7F–öç2F†B&R6ÆÆVBg&öÒ–æÆ–æR…DÔÂöæ6Æ–6²ööæ6†ævR†æFÆW'2à¢òò&WV—&VB&V6W6RF†—2f–ÆR—2ÆöFVB2G—SÒ&ÖöGVÆR"v†–6‚—266÷VB'’FVfVÇBà¢òò–æÆ–æRÇ67&—Câ–âÆæwVvRæ‡FÖÂ†öåÆ–W%&VG’’6ÆÇ26VVµFõ–÷WGV&UF–ÖP¢òòv†Vâv–æF÷rç–÷WGV&UÆ”–çFW'fÂ—26WBBF†RÖöÖVçBF†R•BÆ–W ¢òò&V6öÖW2&VG’(	B'WBF†—2f–ÆR—2ÆöFVB2G—SÒ&ÖöGVÆR"Â6òÖöGVÆRÐ¢òò66÷VBgVæ7F–öâ&Vg2&R–çf—6–&ÆRFò–æÆ–æR†æFÆW'2â'&–FvR—B†W&Rà§v–æF÷rç6VVµFõ–÷WGV&UF–ÖRÒ6VVµFõ–÷WGV&UF–ÖP§v–æF÷rç7F'E&V6÷&F–ærÒ7F'E&V6÷&F–æp§v–æF÷rçW6U&V6÷&F–ærÒW6U&V6÷&F–æp§v–æF÷rç&W7VÖU&V6÷&F–ærÒ&W7VÖU&V6÷&F–æp§v–æF÷rç7F÷&V6÷&F–ærÒ7F÷&V6÷&F–æp§v–æF÷ræ6ÆV%&V6÷&F–ærÒ6ÆV%&V6÷&F–æp§v–æF÷ræ÷Vå&V6÷&F–æu&Wf–WtF–ÆösÒ÷Vå&V6÷&F–æu&Wf–WtF–Æöp§v–æF÷rçÆ•&V6÷&F–ærÒÆ•&V6÷&F–æp§v–æF÷rç7F÷Æ––æu&V6÷&F–ærÒ7F÷Æ––æu&V6÷&F–æp§v–æF÷rçFövvÆUÆ––æu&V6÷&F–æuW6RÒFövvÆUÆ––æu&V6÷&F–æuW6P§v–æF÷rææf–vFU&V6÷&F–æuÆ–&6²Òæf–vFU&V6÷&F–æuÆ–&6°§v–æF÷ræÆ—7E&V6÷&F–æw2ÒÆ—7E&V6÷&F–æw0§v–æF÷rç6VÆV7E&V6÷&F–ærÒ6VÆV7E&V6÷&F–æp§v–æF÷ræ7&VFU&V6÷&F–ærÒ7&VFU&V6÷&F–æp§v–æF÷rç&VæÖU&V6÷&F–ærÒ&VæÖU&V6÷&F–æp§v–æF÷ræFVÆWFU&V6÷&F–ærÒFVÆWFU&V6÷&F–æp§v–æF÷ræGWÆ–6FU&V6÷&F–ærÒGWÆ–6FU&V6÷&F–æp§v–æF÷rç7–æ5&V6÷&F–æw5Fôv—F‡V"Ò7–æ5&V6÷&F–æw5Fôv—F‡V §v–æF÷ræÆöE&V6÷&F–æw4g&öÔv—F‡V"ÒÆöE&V6÷&F–æw4g&öÔv—F‡V §v–æF÷ræ÷Vä6†ææVÄÖævW$F–ÆörÒ÷Vä6†ææVÄÖævW$F–Æöp§v–æF÷ræÆ—7D6†ææVÇ2ÒÆ—7D6†ææVÇ0§v–æF÷rç6WD6†ææVÄ&Æö6¶VBÒ6WD6†ææVÄ&Æö6¶V@§v–æF÷ræFVÆWFT6†ææVÂÒFVÆWFT6†ææVÀ§v–æF÷ræÖ–w&FU7'EF‡5Fôäd2ÒÖ–w&FU7'EF‡5Fôäd0 ¢òò6GW&VB×7V'F—FÆW2†VÇW'2(	BW‡÷6VB6òF†R–âÖ'&÷w6W"FW7B&V6—Ræ@¢òòF†RW‡FW&æÂ6GW&RW‡FVç6–öâ6â&÷F‚&V6‚F†VÒv—F†÷WB&RÖ–×÷'F–æp¢òòF†RÖöGVÆRà§v–æF÷rçWFFT6GW&VD'FâÒWFFT6GW&VD'Fà§v–æF÷ræÆöD6GW&VD'VffW"ÒÆöD6GW&VD'VffW §v–æF÷rç6fT6GW&VD'VffW"Ò6fT6GW&VD'VffW §v–æF÷ræ†æFÆT6GW&VE7V'F—FÆRÒ†æFÆT6GW&VE7V'F—FÆP§v–æF÷rçW6„6GW&VE7V'F—FÆW4&F6†VBÒW6„6GW&VE7V'F—FÆW4&F6†V@§v–æF÷ræFWFV7E7'D6öæfÆ–7G2ÒFWFV7E7'D6öæfÆ–7G0§v–æF÷rç&W6VçE7'DÖW&vTF–ÆörÒ&W6VçE7'DÖW&vTF–Æöp§v–æF÷ræÖW&vU7'Ev—F…&W6öÇWF–öâÒÖW&vU7'Ev—F…&W6öÇWF–öà §v–æF÷ræ÷VäFEFõfö6$F–ÆörÒ÷VäFEFõfö6$F–Æös°§v–æF÷ræFEFõfö6"ÒFEFõfö6#°§v–æF÷ræFVÆWFUfö6$Æ–æRÒFVÆWFUfö6$Æ–æS°§v–æF÷rç6V&6…fö6'VÆ'”'•&Vf—‚Ò6V&6…fö6'VÆ'”'•&Vf—ƒ°§v–æF÷ræ–×÷'E6V&6†W2Ò–×÷'E6V&6†W3°§v–æF÷ræ–×÷'E6V&6†W4g&öÕfö6"Ò–×÷'E6V&6†W4g&öÕfö6#°§v–æF÷ræ–×÷'E6V&6†W4g&öÔf–ÆRÒ–×÷'E6V&6†W4g&öÔf–ÆS°§v–æF÷ræÆöEv†öÆUfö6'VÆ'’ÒÆöEv†öÆUfö6'VÆ'“°§v–æF÷ræÆöDÆö6Äf–ÆW2ÒÆöDÆö6Äf–ÆW3°§v–æF÷rç6fU7F'&VDÆ–æW2Ò6fU7F'&VDÆ–æW3°§v–æF÷rç6fU&Wf—6–öâÒ6fU&Wf—6–öã° ¢òò÷Vä6GW&VE7V'F—FÆW5&Wf–Wr—2Ç&VG’76–væVBFòv–æF÷r&÷fS²&RÖff—&Ò†W&P¢òòÆöæw6–FRF†R÷F†W"–æÆ–æRÖ†æFÆW"W‡÷7W&W26òF†RGFW&â7F—2Væ–f÷&Òà¢B†gVæ7F–öâ‚’°¢G'’²WFFT6GW&VD'Fâ‚’Ò6F6‚…ò’·Ð¢òòFVfVç6—fS¢–bç—F†–ærV&Æ–W"f–ÆVB&Vf÷&RF†R76–væÖVçB&âÂFVf–æR¢òòÆ7B×&W6÷'B7GV"6òF†R–æÆ–æRöæ6Æ–6²BÆV7B&öGV6W2f—6–&ÆRW'&÷"à¢–b‡G—Vöbv–æF÷ræ÷Vä6GW&VE7V'F—FÆW5&Wf–WrÓÒvgVæ7F–öâr’°¢v–æF÷ræ÷Vä6GW&VE7V'F—FÆW5&Wf–WrÒgVæ7F–öâ‚’°¢6öç6öÆRæW'&÷"‚v÷Vä6GW&VE7V'F—FÆW5&Wf–Wrv2æWfW"FVf–æVB(	BÆæwVvRæ§2Ö’†fRf–ÆVBFòÆöBâr¢ÆW'B‚u&Wf–WrF–ÆörVæf–Æ&ÆR(	BÆæwVvRæ§2f–ÆVBFòÆöBâ6VR6öç6öÆRâr¢Ð¢Ð§Ò“°   §v–æF÷ræFDWfVçDÆ—7FVæW"‚v7W—F÷#§W6W"ÖFF×7FGW2rÂ‚’Óâ°¢–b…÷&V6÷&F–æw4ÆöFVB’÷&Vg&W6…&V6÷&F–æu7–æ4'Fâ‚§Ò“°