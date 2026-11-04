import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import {configure, captureSourceContext, sourceIdentity, mergeIndexLayers} from './data-source.js'
import {loadSubtitlePacks} from './subtitle-pack-loading.js'

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
  let release, releasePacks, reads = 0, ready = 0
  const categories = new Promise(resolve => {release = resolve})
  const packs = new Promise(resolve => {releasePacks = resolve})
  const entries = Array.from({length:5}, (_, i) => ({...entry,link:'video'+i,bundle:`packs/pack-${String(i+1).padStart(6,'0')}.json`}))
  w._subtitlesReadyResolve = () => {ready++}
  const context = vm.createContext({
    window:w, console:{warn() {}, log() {}},
    _dsCaptureSourceContext:captureSourceContext, _dsSourceIdentity:sourceIdentity, requireStudyLanguage() {},
    fetchVocabulary:async () => {}, loadAppSettings:async () => {},
    _dsReadLayers:async () => [{src:'self',owner:'alice',sourceIdentity:entry.sourceIdentity,text:JSON.stringify(entries)}],
    _dsLangFromLocation:() => 'swedish', _dsNotice() {}, _OTHER_LAYER_RETRY:{},
    _dsOtherListProblem:() => null, _dsMergeIndexLayers:mergeIndexLayers, _nfc:x => x,
    _cachedSubtitleBatches:async function* () {}, _sourceOwner:()=>'alice',
    _subtitleSearch:{flush:async()=>{}},
    _srtProgressShow() {}, _srtProgressHide() {},
    _srtProgressUpdate() {},
    loadSubtitlePacks, getLangFromUrl:() => ({code:'sv'}), _dsReadUrl:() => 'https://old-source/srts',
    _subtitleBundleLoader:{bundle:async () => {reads++; await packs; return {'Video.sv.srt':'Old source subtitle'}}},
    fetchCategorisation:() => categories,
  })
  vm.runInContext(appFunction('_loadSubtitleGroups'), context)
  vm.runInContext(appFunction('loadAllSubtitles'), context)
  const pending = context.loadAllSubtitles()
  while (reads < 4) await new Promise(resolve => setImmediate(resolve))
  configure({...self, branch:'next'})
  releasePacks(); release({})
  await pending
  assert.equal(reads, 4, 'the fifth queued pack never starts after the source changes')
  assert.equal(ready, 0)
  assert.equal(w._subtitlesLoaded, undefined)
})

test('an old bulk index cannot start downloading packs from the new repository', async () => {
  const {entry} = fixture()
  const old = {...entry,bundle:'packs/pack-000001.json'}
  configure({...self,repo:'another-data'})
  let reads = 0
  const context = vm.createContext({
    loadSubtitlePacks, getLangFromUrl:() => ({code:'sv'}),
    _dsSourceIdentity:sourceIdentity, _dsReadUrl:() => {reads++; return 'https://new-source/srts'},
    _subtitleBundleLoader:{},
  })
  vm.runInContext(appFunction('_loadSubtitleGroups'), context)
  await assert.rejects(context._loadSubtitleGroups([old],captureSourceContext()), {code:'stale-data-source'})
  assert.equal(reads,0)
})
