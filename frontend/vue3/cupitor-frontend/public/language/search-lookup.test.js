// Regression tests for the real search entrypoints in language.js. The full
// module starts a large browser UI on import, so evaluate only the functions
// under test with mock dependencies instead of mounting the whole page.
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const html = fs.readFileSync(path.join(__dirname, '..', 'language.html'), 'utf8')

function bodyBetween(text, start, end) {
  const a = text.indexOf(start)
  const b = text.indexOf(end, a + start.length)
  if (a < 0 || b < 0) throw new Error('Source block missing: ' + start)
  return text.slice(a, b)
}

function makeDoSearch(win, fetcher) {
  const code = bodyBetween(source, 'async function doSearch(searchThis, el) {',
    'const SEARCH_NAV_HISTORY_KEY')
  return new Function('window', 'fetchSRTs', 'saveSearch', '$', 'console', 'Option',
    code + ';return doSearch')(win, fetcher, () => false, () => ({ val: () => '' }),
      { log: () => {} }, function Option() {})
}

describe('lookup search request isolation', () => {
  test('a new lookup supersedes an older query waiting for startup data', async () => {
    let release
    const ready = new Promise(resolve => { release = resolve })
    const win = {
      vocabulary: null, _subtitlesLoaded: false,
      _vocabularyReadyPromise: ready, _subtitlesReadyPromise: ready
    }
    const fetcher = jest.fn(async () => true)
    const run = makeDoSearch(win, fetcher)
    const stale = run('ovetande')
    const latest = run('gäll')
    win.vocabulary = {}
    win._subtitlesLoaded = true
    release()
    expect(await stale).toBe(false)
    expect(await latest).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('gäll', 2)
  })

  test('a slow older search cannot report completion after a newer lookup', async () => {
    const callbacks = {}
    const win = { vocabulary: {}, _subtitlesLoaded: true }
    const run = makeDoSearch(win, term => new Promise(resolve => {
      callbacks[term] = resolve
    }))
    const stale = run('ovetande')
    const latest = run('gäll')
    callbacks.gäll(true)
    expect(await latest).toBe(true)
    callbacks.ovetande(true)
    expect(await stale).toBe(false)
  })

  test('input handler searches the captured text rather than the DOM event', async () => {
    const snippet = bodyBetween(source,
      'export async function searchTextChanged() {', '// parseVocabularyFile')
      .replace('export async function', 'async function')
    const doSearch = jest.fn(async () => true)
    const win = { unprocessedSearchText: 'ovetande' }
    const fn = new Function('$searchText1', 'window', 'doSearch', '$',
      'searchVocabularyByPrefix', 'console', snippet + ';return searchTextChanged')(
      { val: () => 'gäll' }, win, doSearch,
      () => ({ is: () => false }), () => {}, { warn: () => {} })
    await fn({ type: 'change' })
    expect(doSearch.mock.calls[0][0]).toBe('gäll')
    expect(win.unprocessedSearchText).toBeNull()
  })
})

describe('native filterData handoff', () => {
  function mockUi() {
    const fields = {}
    const calls = []
    const $ = name => {
      if (!fields[name]) fields[name] = {
        value: null, val(v) { if (!arguments.length) return this.value; this.value = v; return this },
        trigger(event) { calls.push([name, event]); return this },
        show() { return this }
      }
      return fields[name]
    }
    const win = {
      unprocessedSearchText: 'ovetande', preSelectedSearchedWord: 'ovetande',
      listeners: {},
      addEventListener(name, fn) { this.listeners[name] = fn },
      dispatch(name, detail) { this.listeners[name]({ detail }) }
    }
    return { $, win, fields, calls }
  }

  function attachRealHandler(ui) {
    const code = bodyBetween(source, 'function _applyIncomingLookup(rawText) {',
      "window.addEventListener('capturedSubtitle',")
    return new Function('window', '
  }

  test('native lookup clears the stale dropdown and searches the input term', () => {
    const ui = mockUi()
    attachRealHandler(ui)
    ui.win.__cupitorSearchReady = true
    ui.win.dispatch('filterData', { text: 'gäll' })
    expect(ui.fields['#searchText'].value).toBe('gäll')
    expect(ui.fields['#searchedWords'].value).toBe('')
    expect(ui.win.unprocessedSearchText).toBeNull()
    expect(ui.calls).toContainEqual(['#searchedWords', 'change.select2'])
    expect(ui.calls).toContainEqual(['#searchText', 'change'])
  })

  test('lookup arriving before deferred module initialization is replayed', () => {
    const ui = mockUi()
    const early = bodyBetween(html, '// Flutter can send a lookup from onPageFinished',
      '</script>')
    new Function('window', early)(ui.win)
    ui.win.dispatch('filterData', { text: 'ovetande' })
    ui.win.dispatch('filterData', { text: 'gäll' })
    expect(ui.win.__cupitorPendingLookup).toBe('gäll')
    const flush = attachRealHandler(ui)
    // Even after the module loads, wait for $(document).ready to bind change.
    ui.win.dispatch('filterData', { text: 'gäll' })
    expect(ui.fields['#searchText']).toBe(undefined)
    ui.win.__cupitorSearchReady = true
    flush()
    expect(ui.win.__cupitorPendingLookup).toBeNull()
    expect(ui.fields['#searchText'].value).toBe('gäll')
  })
})
, code + ';return _flushPendingLookup')(ui.win, ui.$)
  }

  test('native lookup clears the stale dropdown and searches the input term', () => {
    const ui = mockUi()
    attachRealHandler(ui)
    ui.win.dispatch('filterData', { text: 'gäll' })
    expect(ui.fields['#searchText'].value).toBe('gäll')
    expect(ui.fields['#searchedWords'].value).toBe('')
    expect(ui.win.unprocessedSearchText).toBeNull()
    expect(ui.calls).toContainEqual(['#searchedWords', 'change.select2'])
    expect(ui.calls).toContainEqual(['#searchText', 'change'])
  })

  test('lookup arriving before deferred module initialization is replayed', () => {
    const ui = mockUi()
    const early = bodyBetween(html, '// Flutter can send a lookup from onPageFinished',
      '</script>')
    new Function('window', early)(ui.win)
    ui.win.dispatch('filterData', { text: 'ovetande' })
    ui.win.dispatch('filterData', { text: 'gäll' })
    expect(ui.win.__cupitorPendingLookup).toBe('gäll')
    attachRealHandler(ui)
    expect(ui.win.__cupitorPendingLookup).toBeNull()
    expect(ui.fields['#searchText'].value).toBe('gäll')
  })
})
