import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { createWordMapIndex, withWordMapRecords, MAP_RECORDS_FORMAT } from './word-map-library.js'
import { openUserDataStore } from './user-data-store.js'
import { readSearchMaps } from './word-map-search.js'

const map = (id,word='Gräl') => ({version:1,id,name:id,folder:'Words/'+id,nodes:[{id:'node-'+id,word,x:200,y:200}],edges:[]})
test('word index agrees with the reference scan, updates words and retains all repeated nodes',()=>{
  const maps=Array.from({length:500},(_,i)=>map('m'+i,i%3?'Gräl':'Bråk'))
  maps[1].nodes.push({id:'again',word:' GRÄL ',x:400,y:200})
  const index=createWordMapIndex(maps)
  for(const word of ['gräl','BRÅK','missing']) {
    const expected=maps.filter(m=>m.id!=='m1'&&m.nodes.some(node=>node.word.trim().toLocaleLowerCase()===word.toLocaleLowerCase())).map(m=>m.id)
    assert.deepEqual(index.related(word,'m1').map(m=>m.id),expected)
  }
  assert.deepEqual(index.nodes('gräl','m1'),['node-m1','again'])
  index.update({...maps[1],name:'Renamed'})
  assert.deepEqual(index.related('gräl').map(m=>m.id),maps.filter(m=>m.nodes.some(node=>node.word.trim().toLocaleLowerCase()==='gräl')).map(m=>m.id))
  index.update({...maps[1],nodes:[{id:'new',word:'Lugn',x:200,y:200}]})
  assert.deepEqual(index.nodes('gräl','m1'),[])
  assert.deepEqual(index.related('lugn').map(m=>m.id),['m1'])
  index.remove('m1');assert.deepEqual(index.related('lugn'),[])
})

test('restoring independent map records invalidates the parsed collection even when its directory is unchanged',async()=>{
  const indexedDB=new IDBFactory(),key='maps',raw=await openUserDataStore({scope:'restore',indexedDB})
  const store=withWordMapRecords(raw,[key])
  try{
    store.saveMaps(key,[map('one')]);await store.flush()
    assert.equal(store.readMaps(key)[0].name,'one')
    const backup=store.exportData(),record=JSON.parse(backup.values['maps:map:one'])
    backup.values['maps:map:one']=JSON.stringify({...record,name:'Restored name'})
    await store.importData(backup,()=>{})
    assert.equal(store.readMaps(key)[0].name,'Restored name')
  }finally{store.close()}
})

test('legacy map arrays split once; a later edit changes only its record, with stable order, folders and reload',async()=>{
  const indexedDB=new IDBFactory(),key='maps',initial=[map('one'),map('two')]
  const options={scope:'alice/swedish/main',indexedDB,legacyStorage:{getItem:()=>JSON.stringify(initial)},legacyKeys:[{key}]}
  let raw=await openUserDataStore(options),store=withWordMapRecords(raw,[key])
  const edited=structuredClone(store.readMaps(key));edited[0].name='First edit'
  store.saveMaps(key,edited,'one');await store.flush()
  const split=store.exportData().values
  assert.equal(JSON.parse(split.maps).format,MAP_RECORDS_FORMAT)
  const untouched=split['maps:map:two']
  const revision=raw.status.revision
  edited[0].nodes[0].word='Lugn';store.saveMaps(key,edited,'one');await store.flush()
  assert.equal(store.exportData().values['maps:map:two'],untouched)
  assert.equal(raw.status.revision,revision+1)
  assert.equal(readSearchMaps(key,store)[0].nodes[0].word,'Lugn')
  store.close()
  raw=await openUserDataStore(options);store=withWordMapRecords(raw,[key])
  assert.deepEqual(store.readMaps(key).map(m=>[m.id,m.folder]),[['one','Words/one'],['two','Words/two']])
  assert.equal(JSON.parse(store.getItem(key))[0].nodes[0].word,'Lugn')
  store.saveMaps(key,[store.readMaps(key)[1]],'two');await store.flush()
  assert.equal(store.exportData().values['maps:map:one'],undefined)
  assert.equal(store.readMaps(key)[0].id,'two');store.close()
})

test('missing map records fail the whole read rather than becoming deleted maps',async()=>{
  const raw=await openUserDataStore({scope:'test',indexedDB:new IDBFactory()})
  raw.setItem('maps',JSON.stringify({format:MAP_RECORDS_FORMAT,ids:['missing']}));await raw.flush()
  const store=withWordMapRecords(raw,['maps'])
  assert.throws(()=>readSearchMaps('maps',store),/missing/)
  assert.equal(JSON.parse(store.exportData().values.maps).ids.length,1);store.close()
})
