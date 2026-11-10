const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const $ = require('jquery');
const _ = require('lodash');
const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8');
const fn = name => source.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n\\}'))[0];

function fixture(query, { subtitles = true } = {}) {
  document.body.innerHTML = '<input id="searchText" value="stale input"><div id="result"></div><div id="vocabularyResult"></div>';
  const translate = jest.fn(async () => null);
  let finishSubtitles;
  const subtitleRequest = new Promise(resolve => { finishSubtitles = resolve; });
  const context = {
    window: { _requestedSearchText: query, unprocessedSearchText: null, vocabulary: {},
      _appSettings: { includeSrtsInSearch: subtitles }, _subtitleSearchToken: 1,
      _subtitleCoverageIndexReady: true, srts: [] },
    $, _, console, SEPARATOR_PIPE: '|', CORRESPONDING_TRANSLATE_MS: 2500,
    removeHintsInBrackets: text => text.replace(/\([^)]*\)/g, ''),
    _stripExpansionMarkers: text => text.replaceAll('<*', ''),
    _haveTranslateBridge: () => true,
    _translationPanelDirection: () => ({ from: 'sv', to: 'en' }),
    _hideStaleTranslationPanel() {}, _dictionaryTerms: () => [], _translateDetailed: translate,
    recordSessionSearch() {}, getSelectedLang: () => 'sv', isTypedRegex: () => false,
    expandWords: text => text, _relaxSpaces: text => text, compileRegex: text => new RegExp(text),
    _searchRunsInFlight: 0, _beginSearchLoading: () => () => {}, _resetLibrarySearch() {},
    resetSearchResultIndex() {}, _ensureLibrarySearchBar() {}, _setSubtitleSearchStatus() {},
    fetchFromDownloadedFiles: jest.fn(() => subtitleRequest), render: jest.fn(async () => ({})),
    getLangFromUrl: () => ({code:'sv'}), guessStems: () => [], showResultContainer() {},
  };
  vm.createContext(context);
  vm.runInContext(['_translationPanelWord', '_renderTranslationPanel', 'fetchSRTs'].map(fn).join('\n'), context);
  return { context, translate, finishSubtitles };
}

afterEach(() => { document.body.innerHTML = ''; });

test.each(['fantiserat ihop', 'jag har aldrig hört talas om detta', 'Det här är en helt ny mening!'])(
  'requests translation of %s with empty vocabulary before subtitle search finishes', async query => {
    const {context, translate, finishSubtitles} = fixture(query);
    const search = context.fetchSRTs(query, 1);
    expect(translate).toHaveBeenCalledWith(query, 'sv', 'en', 2500);
    expect(context.render).not.toHaveBeenCalled();
    finishSubtitles([]);
    expect(await search).toBe(true);
    expect(context.render).toHaveBeenCalledWith([], query.toLowerCase(), 'primary', 1);
  });

test('translation is requested when subtitle search is disabled and vocabulary is empty', async () => {
  const query = 'en fras som saknas i ordlistan';
  const {context, translate} = fixture(query, {subtitles:false});
  expect(await context.fetchSRTs(query, 1)).toBe(true);
  expect(translate).toHaveBeenCalledWith(query, 'sv', 'en', 2500);
  expect(context.fetchFromDownloadedFiles).not.toHaveBeenCalled();
});

test.each(['[^ ]+Stå ', 'hej|hello', 'word.*', 'x', 'hej\\s+du'])(
  'does not send regex or too-short queries to translation: %s', query => {
    const {context} = fixture(query);
    expect(context._translationPanelWord()).toBe('');
  });

test('vocabulary-line searches stay excluded and requested text takes precedence over stale input', () => {
  const {context} = fixture('helt ny fras');
  expect(context._translationPanelWord()).toBe('helt ny fras');
  context.window.unprocessedSearchText = 'ord|word';
  expect(context._translationPanelWord()).toBe('');
});
