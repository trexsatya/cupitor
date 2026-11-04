import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { createSubtitleSearchRuntime } from './subtitle-search-runtime.js'
import { openSubtitleCorpus } from './subtitle-corpus-store.js'
import { buildSelectedSearchPlaylist } from './search-playlist.js'
import { guessCorrespondingWords, documentFrequencies } from './corresponding-words.js'
import { attributeSubtitleMatches } from './subtitle-search-engine.js'

const srt=lines=>lines.map((text,i)=>`${i+1}\n00:00:${String(i+1).padStart(2,'0')},000 --> 00:00:${String(i+2).padStart(2,'0')},000\n${text}`).join('\n\n')+'\n'
const documents=[
  {id:'one',sv:srt(['tunn skiva','smal väg','tunn igen','smal igen']),en:srt(['thin slice','thin road','another thin slice','another road']),source:'YouTube',revision:1},
  {id:'two',sv:srt(['smal bro','tunn tråd','annan smal bro']),en:srt(['thin bridge','thin thread','another bridge']),source:'YouTube',revision:1},
]
test('indexed file and cue results agree with full scanning for both tracks and search modes',async()=>{
  const runtime=await createSubtitleSearchRuntime('parity',{indexedDB:new IDBFactory()})
  const extra=[
    {id:'unicode',sv:srt(['En färgsprakande kväll.','göra','susen i kväll','kår väljarkår år','fö<c.huvudpratare>r','Kelvin ſong Σςσ ẞß',' a b ','alpha\nbeta']),en:srt(['A colorful evening.','make','a difference tonight','thin thinking thing','Weſt and west','don\'t know','AB𐐀𐐨cd','alpha\nbeta']),revision:1},
  ]
  const ids=[...documents,...extra].map(doc=>doc.id)
  const queries=['thin','tunn','smal','thin|road','thin road',' thin','thin ',' thin ','göra susen','make a difference','kår','år','123','åäö','fö.*','^alpha','beta$','alpha beta','alpha\\s+beta','(?=a)','[åäö]+','kelvin','song','west','don','a b','thin?','thin*','thin{0}','thin{1}','thin.*road','AB𐐨𐐀cd','missing']
  try{
    await runtime.update([...documents,...extra]);assert.equal((await runtime.indexStatus({ids,wait:true})).ready,3)
    for(const regexMode of [false,true])for(const query of queries){
      const expected=await runtime.files({ids,query,regexMode,useIndex:false}),actual=await runtime.files({ids,query,regexMode})
      assert.deepEqual(actual,expected,JSON.stringify({query,regexMode}))
      for(const language of ['sv','en']){
        const hits=expected.filter(file=>file[language+'_match']),options={regexMode,exactWordsOnly:language==='en'}
        const attributed=await runtime.attribute({files:hits.map(file=>({id:file.url,language,suffix:'.sv.srt'})),query,...options})
        const reference=await attributeSubtitleMatches(hits.map(file=>file[language+'_subs']),query,{...options,yieldToUI:async()=>{}})
        assert.deepEqual(JSON.parse(JSON.stringify(attributed)),JSON.parse(JSON.stringify(reference)),JSON.stringify({query,regexMode,language}))
      }
    }
  }finally{runtime.close()}
})
test('compact search, streamed grouping, context and playlist preserve full-corpus results',async()=>{
  const runtime=await createSubtitleSearchRuntime('scope',{indexedDB:new IDBFactory(),cacheBytes:10})
  try{
    await runtime.update(documents)
    const ids=documents.map(doc=>doc.id),files=await runtime.files({ids,query:'thin',suffix:'.sv.srt'})
    const full=await runtime.attribute({files:ids.map(id=>({id,language:'en',suffix:'.sv.srt'})),query:'thin',exactWordsOnly:true})
    const compactFiles=await runtime.files({ids,query:'thin',suffix:'.sv.srt',compact:true})
    assert.ok(compactFiles.every(file=>file.en_subs.data.length===0&&file.en_subs._contextOnly))
    const compact=await runtime.attribute({files:ids.map(id=>({id,language:'en',suffix:'.sv.srt'})),query:'thin',exactWordsOnly:true,compact:true,englishParts:['thin']})
    assert.equal(compact.englishWord,'thin')
    for(const word of Object.keys(full))assert.deepEqual(compact.map[word].map(it=>[it.url,it.line.index]),full[word].map(it=>[it.url,it.line.index]))
    assert.ok(Object.values(compact.map).flat().every(it=>!('text' in it.line)))
    const items=[...new Map(Object.values(full).flat().map(it=>[it.url+'|'+it.line.index,it])).values()]
    const refs=items.map(({line,...item})=>({...item,line:{index:line.index}}))
    const stats=await runtime.statistics({ids,matches:refs})
    const byUrl=new Map(files.map(file=>[file.url,new Map(file.sv_subs.data.map(line=>[String(line.index),line.text]))]))
    const lines=items.map(it=>byUrl.get(it.url).get(String(it.line.index)))
    const options={searchWord:'thin',vocabWords:['tunn','smal'],background:new Map(stats.background),backgroundLines:stats.backgroundLines,max:18}
    assert.deepEqual(new Map(stats.frequencies),documentFrequencies(lines))
    assert.deepEqual(guessCorrespondingWords({...options,lines}),guessCorrespondingWords({...options,frequencies:new Map(stats.frequencies),matchedLineCount:stats.matchedLineCount}))
    const candidates=guessCorrespondingWords({...options,lines})
    const grouped=await runtime.regroup({ids,items:refs,candidates,max:6})
    assert.deepEqual(Object.keys(grouped),['tunn','smal'])
    assert.ok(Object.values(grouped).flat().some(it=>it._viaGuess),'vocabulary-only extra matches are retained')
    const context=await runtime.context({id:'one',from:2,to:3})
    assert.equal(context.sv_subs.lastIndex,4);assert.deepEqual(context.sv_subs.data.map(line=>line.index),['2','3'])
    const groups=[{word:'thin',items}],selected=['thin'],playlistOptions={lang:'en',searchText:'thin',contextBefore:1,contextAfter:1,maxPerHeader:'',gapThreshold:2.5}
    assert.deepEqual(await runtime.playlist({groups,selected,options:playlistOptions}),buildSelectedSearchPlaylist(groups,selected,{...playlistOptions,files}))
    const vocabulary=await runtime.vocabScan({ids,entries:[{line:'thin',pattern:'thin'},{line:'absent',pattern:'absent'}],threshold:2})
    assert.deepEqual(vocabulary.map(entry=>entry.count),[2,0])
    const automatic=await runtime.automatic({ids,expanded:'tunn',pattern:'tunn',options:{matchesPerWord:3,contextLines:1}})
    assert.equal(automatic.length,3);assert.ok(automatic.some(tuple=>tuple.it.id==='two'))
    assert.ok(runtime.cacheBytes<=10)
    await runtime.update([{id:'one',sv:srt(['changed']),revision:2,_evicted:true}])
    assert.equal((await runtime.document({id:'one'})).en,documents[0].en,'metadata updates preserve evicted counterpart')
    await assert.rejects(runtime.files({ids:['missing'],query:'thin'}),/missing/)
  }finally{runtime.close()}
})

test('corpus metadata limits raw batches, updates counters and protects live caches',async()=>{
  const indexedDB=new IDBFactory(),store=await openSubtitleCorpus('current',indexedDB,{baseScope:'alice/swedish'})
  const other=await openSubtitleCorpus('other',indexedDB,{baseScope:'bob/spanish'})
  try{
    const large='x'.repeat(600000)
    await store.put(Array.from({length:4},(_,i)=>({id:String(i),sv:large,revision:1})))
    const batches=[]
    for await(const batch of store.iterate(['0','1','2','3']))batches.push(batch.length)
    assert.deepEqual(batches,[1,1,1,1])
    let meta=(await store.list()).find(meta=>meta.scope==='current')
    assert.equal(meta.count,4);assert.equal(meta.bytes,large.length*8)
    await store.put([{id:'0',remove:true},{id:'1',sv:'small',revision:2}])
    meta=(await store.list()).find(meta=>meta.scope==='current')
    assert.equal(meta.count,3);assert.equal(meta.bytes,large.length*4+10)
    await other.put([{id:'other',sv:'hola'}]);await store.prune()
    assert.ok((await store.list()).some(meta=>meta.scope==='other'))
    await assert.rejects(store.removeScope('current'),/protected/)
    await store.removeScope('other');assert.ok(!(await store.list()).some(meta=>meta.scope==='other'))
  }finally{store.close();other.close()}
})

test('expired derived sessions are pruned without touching active leases or authoritative user data',async()=>{
  const indexedDB=new IDBFactory(),stores=[]
  try{
    for(const scope of ['current','oldest','older','newer','live']){
      const store=await openSubtitleCorpus(scope,indexedDB,{baseScope:scope==='current'?'current':'other-source'})
      stores.push(store);await store.put([{id:scope,sv:'durable transcript',revision:1}])
    }
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('cupitor-search-corpus-v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
    const tx=db.transaction('scopes','readwrite'),complete=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
    for(const [scope,age]of [['oldest',8],['older',2],['newer',1]]){
      const req=tx.objectStore('scopes').get(scope)
      req.onsuccess=()=>tx.objectStore('scopes').put({...req.result,leaseUntil:0,touchedAt:Date.now()-age*86400000})
    }
    await complete;db.close()
    await stores[0].prune()
    assert.deepEqual((await stores[0].list()).map(meta=>meta.scope).sort(),['current','live','newer'])
    assert.equal((await stores[0].get(['current']))[0].sv,'durable transcript')
    stores[0].close()
    const reopened=await openSubtitleCorpus('current',indexedDB,{baseScope:'current'})
    stores[0]=reopened
    assert.equal((await reopened.get(['current']))[0].sv,'durable transcript','worker restart reads the same persisted corpus')
  }finally{stores.forEach(store=>store.close())}
})
