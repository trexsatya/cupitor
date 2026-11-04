import test from 'node:test'
import assert from 'node:assert/strict'
import { attributeSubtitleMatches, prepareSearchDocument, matchSearchDocument } from './subtitle-search-engine.js'
import { attributeSubtitleMatches as reference } from '../../tests/fixtures/subtitle-search-reference.mjs'
import { createDocumentCache } from './subtitle-corpus-store.js'

const srt=lines=>lines.map((text,i)=>`${i+1}\n00:00:${String(i+1).padStart(2,'0')},000 --> 00:00:${String(i+2).padStart(2,'0')},000\n${text}`).join('\n\n')+'\n'
const documents=[
  {id:'first',source:'YouTube',sv:srt(['En färgsprakande kväll.','Jag går an, jag går.','göra','susen i kväll','förvärvat och förvärva','åäö ÅÄÖ 123']),en:srt(['A colorful evening.','I walk, I walk.','make','a difference tonight','thin thinking thing','ÅÄÖ 123'])},
  {id:'second',source:'local',sv:srt(['söka sökandet sökte',' a b ','fråga? svar!','alpha\nbeta','röst röster','kår väljarkår år']),en:srt(['search searching searched',' a b ','question? answer!','alpha\nbeta','voice voices','corps corpsman year'])},
].map(prepareSearchDocument)
const queries=['kväll','göra susen','går an|göra susen','göra|gör|gjorde',' sök','sök ',' sök ','a b','alpha beta','åäö','kår','123','missing','thin','^alpha','beta$','för.*','[åäö]+','a|b','\\d+','fråga\\?','(?=a)','^En färgsprakande kväll\\.$','^A colorful evening\\.$','alpha\\s+beta','går (an|hem)','\\p{L}+','röst|röster']
for(const language of ['sv','en'])for(const regexMode of [false,true]) {
  test(`attribution matches the pre-worker reference: ${language}, regex=${regexMode}`,async()=>{
    for(const query of queries) {
      const files=documents.map(doc=>matchSearchDocument(doc,query,{regexMode})).filter(Boolean)
      const selected=files.filter(file=>file[language==='en'?'en_match':'sv_match']).map(file=>file[language==='en'?'en_subs':'sv_subs'])
      const options={regexMode,exactWordsOnly:language==='en',yieldToUI:async()=>{}}
      assert.deepEqual(JSON.parse(JSON.stringify(await attributeSubtitleMatches(selected,query,options))),JSON.parse(JSON.stringify(await reference(selected,query,options))),query)
    }
  })
}
test('file inclusion preserves cross-cue phrases, cue anchors and transcript boundaries',()=>{
  assert.equal(matchSearchDocument(documents[0],'göra susen').sv_match,true)
  assert.equal(matchSearchDocument(documents[0],'^Jag går an, jag går\\.$',{regexMode:true}).sv_match,true)
  assert.equal(matchSearchDocument(documents[0],'123 söka'),null)
})
test('normalization cache obeys a byte budget and invalidates same-id content revisions',()=>{
  const cache=createDocumentCache(100)
  cache.put('a',1,{sv:'a'.repeat(20),svClean:'a'.repeat(20)})
  assert.ok(cache.get('a',1));assert.equal(cache.get('a',2),null)
  cache.put('b',1,{en:'b'.repeat(20),enClean:'b'.repeat(20)})
  assert.equal(cache.get('a',1),null);assert.ok(cache.bytes<=100)
  cache.put('large',1,{sv:'x'.repeat(100)})
  assert.equal(cache.get('large',1),null);assert.ok(cache.bytes<=100)
})

test('typed regex preserves trailing-space constraints and groups only matched spans', async () => {
  const lines = [
    {index: 1, text: 'Jag förStå här'},
    {index: 2, text: 'Jag förStå!'},
    {index: 3, text: 'Vi måste förStå saker'},
  ]
  const hits = await attributeSubtitleMatches(
    [{url: 'regression', source: 'local', data: lines}],
    '[^ ]+Stå ',
    {regexMode: true, yieldToUI: async () => {}},
  )
  assert.deepEqual(Object.keys(hits), ['förstå'])
  assert.deepEqual(hits.förstå.map(hit => hit.line.index), [1, 3])
})

test('broad regexes group each matching word, not greedy multi-word spans', async () => {
  const lines = [
    {index: 1, text: 'Vi måste förhålla oss till förutsättningarna och förhålla oss lugna.'},
    {index: 2, text: 'Hellre för många än för få; men utan att förringa problemen.'},
  ]
  const options = {regexMode: true, yieldToUI: async () => {}}
  const files = [{url: 'regression', source: 'local', data: lines}]
  const groups = await attributeSubtitleMatches(files, 'För.*', options)
  assert.deepEqual(Object.keys(groups).sort(), ['för', 'förhålla', 'förutsättningarna', 'förringa'])
  assert.deepEqual([...new Set(groups.förhålla.map(item => item.line.index))], [1])
  const bounded = await attributeSubtitleMatches(files, 'för[^ ]+', options)
  assert.ok(bounded.förringa?.some(item => item.line.index === 2))
  assert.equal(bounded.för, undefined)
})
