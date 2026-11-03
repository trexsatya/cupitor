import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { legacyUserDataKeys } from './user-data.js'
import { openUserDataStore } from './user-data-store.js'

test('mixed-language pending edits and captures migrate independently without duplicating them into another repository',async()=>{
  const account={login:'alice',repo:'data',branch:'main'},indexedDB=new IDBFactory()
  const values=new Map(Object.entries({
    'cupitor:pendingVocab@alice':JSON.stringify({lang:'spanish',categories:{Words:['hola']}}),
    'cupitor:pendingSrtEdits@alice':JSON.stringify({
      'db/language/swedish/srts/a.sv.srt':{1:{newText:'Hej'}},
      'db/language/spanish/srts/b.es.srt':{1:{newText:'Hola'}},
    }),
    'cupitor:capturedSubtitles@alice':JSON.stringify([
      {id:'swedish',detail:{sourceLang:'sv'}},{id:'spanish',detail:{sourceLang:'es'}},
    ]),
    'cupitor:wordMaps:swedish@alice:base:["alice","data","main","swedish"]':'[]',
    'cupitor:wordMaps:swedish@alice:base:["alice","another","main","swedish"]':'[]',
  }))
  const storage={getItem:key=>values.get(key)??null,key:i=>[...values.keys()][i],get length(){return values.size}}
  const open=(language,repo='data')=>openUserDataStore({scope:JSON.stringify([language,repo]),indexedDB,legacyStorage:storage,
    legacyKeys:legacyUserDataKeys({...account,repo},language,storage)})
  const swedish=await open('swedish'),spanish=await open('spanish')
  assert.equal(swedish.getItem('cupitor:pendingVocab@alice'),null)
  assert.equal(JSON.parse(spanish.getItem('cupitor:pendingVocab@alice')).lang,'spanish')
  for (const [language,store,id] of [['swedish',swedish,'swedish'],['spanish',spanish,'spanish']]) {
    assert.ok(Object.keys(JSON.parse(store.getItem('cupitor:pendingSrtEdits@alice'))).every(path=>path.includes('/'+language+'/')))
    assert.deepEqual(JSON.parse(store.getItem('cupitor:capturedSubtitles@alice')).map(item=>item.id),[id])
    store.close()
  }
  const other=await open('swedish','another')
  assert.equal(other.getItem('cupitor:pendingSrtEdits@alice'),null)
  assert.equal(other.getItem('cupitor:wordMaps:swedish@alice:base:["alice","another","main","swedish"]'),'[]')
  other.close()
  assert.equal(JSON.parse(values.get('cupitor:capturedSubtitles@alice')).length,2)
})
