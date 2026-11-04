import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import {configure, captureSourceContext, sourceIdentity, mergeIndexLayers} from './data-source.js'

const require = createRequire(import.meta.url)
const runtimeRequire = createRequire(require.resolve(process.env.CUPITOR_JSDOM || 'jsdom'))
const {parse} = runtimeRequire('@babel/parser')
const source = fs.readFileSync(new URL('./language.js', import.meta.url), 'utf8')
const ast = parse(source, {sourceType:'module'})
const appFunction = name => {
  const node = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  assert.ok(node, name)
  return source.slice(node.start, node.end)
}
const self = {login:'alice', repo:'data', branch:'main', other:null}
function fixture() {
  const w = {location:{href:'https://cupitor.test/language.html?lang=swedish'}, allSubtitles:{}}
  globalThis.window = w
  configure(self)
  const entry = {link:'video', name:'Video', source:'YouTube', src:'self', sourceIdentity:sourceIdentity('self')}
  w.srts = [entry]
  return {w, entry}
}

test('an old index and a delayed subtitle download cannot populate a different source', async () => {
  const {w, entry} = fixture()
  let release, fetches = 0, applied = 0
  const download = new Promise(resolve => {release = resolve})
  const context = vm.createContext({
    window:w, _dsCaptureSourceContext:captureSourceContext, _dsSourceIdentity:sourceIdentity,
    _nfc:x => x, getLangFromUrl:() => ({code:'sv'}),
    _fetchIndexedSrt:async () => {fetches++; return download},
    _applySubtitleSnapshot:() => {applied++}, _cacheWriteSubtitleFromMemory:() => {},
  })
  vm.runInContext(appFunction('getSubtitlesForLink'), context)
  const pending = context.getSubtitlesForLink('video', 'YouTube')
  configure({...self, repo:'other-data'})
  release('A subtitle from the previous source')
  await assert.rejects(pending, {code:'stale-data-source'})
  assert.equal(fetches, 1, 'the English side is not requested from the new repository')
  assert.equal(applied, 0)
  assert.equal(Object.keys(w.allSubtitles).length, 0)
  assert.equal(w.srts[0], entry)
  await assert.rejects(context.getSubtitlesForLink('video', 'YouTube'), {code:'stale-data-source'})
  assert.equal(fetches, 1, 'an old index cannot start a request against a new destination')
})

test('subtitle batches queued before a switch do not start or declare the new source ready', async () => {
  const {w, entry} = fixture()
  let queued, release, reads = 0, ready = 0
  const categories = new Promise(resolve => {release = resolve})
  w._subtitlesReadyResolve = () => {ready++}
  const context = vm.createContext({
    window:w, console:{warn() {}, log() {}},
    _dsCaptureSourceContext:captureSourceContext, requireStudyLanguage() {},
    fetchVocabulary:async () => {}, loadAppSettings:async () => {},
    _dsReadLayers:async () => [{src:'self',owner:'alice',sourceIdentity:entry.sourceIdentity,text:JSON.stringify([entry])}],
    _dsLangFromLocation:() => 'swedish', _dsNotice() {}, _OTHER_LAYER_RETRY:{},
    _dsOtherListProblem:() => null, _dsMergeIndexLayers:mergeIndexLayers, _nfc:x => x,
    _cachedSubtitleBatches:async function* () {}, _sourceOwner:()=>'alice',
    _subtitleSearch:{flush:async()=>{}},
    _srtProgressShow() {}, _srtProgressHide() {},
    _srtProgressUpdate() {},
    _runInBatches:async (items, callback) => {queued = () => callback(items[0])},
    _withTimeout:promise => promise, getSubtitlesForLink:async () => {reads++},
    fetchCategorisation:() => categories,
  })
  vm.runInContext(appFunction('loadAllSubtitles'), context)
  const pending = context.loadAllSubtitles()
  while (!queued) await new Promise(resolve => setImmediate(resolve))
  configure({...self, branch:'next'})
  await queued()
  release({})
  await pending
  assert.equal(reads, 0)
  assert.equal(ready, 0)
  assert.equal(w._subtitlesLoaded, undefined)
})
