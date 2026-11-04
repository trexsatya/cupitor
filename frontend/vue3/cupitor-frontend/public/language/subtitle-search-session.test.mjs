import test from 'node:test'
import assert from 'node:assert/strict'
import { reserveSubtitleSession } from './subtitle-search-session.js'

const storage=values=>({getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)})
test('reload reuses a tab scope, copied tabs rotate it, and sources remain separate',async()=>{
  const occupied=new Set(),values=new Map()
  const locks={async request(name,options,callback){if(occupied.has(name))return callback(null);occupied.add(name);try{return await callback({name})}finally{occupied.delete(name)}}}
  let next=0;const random=()=>String(++next)
  const first=await reserveSubtitleSession('alice/swedish',{storage:storage(values),locks,random})
  const copiedValues=new Map(values)
  const copied=await reserveSubtitleSession('alice/swedish',{storage:storage(copiedValues),locks,random})
  assert.notEqual(first.scope,copied.scope)
  first.release();await new Promise(resolve=>setImmediate(resolve))
  const reloaded=await reserveSubtitleSession('alice/swedish',{storage:storage(values),locks,random})
  assert.equal(first.scope,reloaded.scope)
  const otherSource=await reserveSubtitleSession('alice/spanish',{storage:storage(values),locks,random})
  assert.notEqual(otherSource.scope,reloaded.scope)
  copied.release();reloaded.release();otherSource.release()
})
test('hosts without usable tab storage or Web Locks get isolated disposable sessions',async()=>{
  let next=0;const random=()=>String(++next)
  const values=new Map(),locks={}
  const one=await reserveSubtitleSession('same',{storage:storage(values),locks,random})
  const two=await reserveSubtitleSession('same',{storage:storage(values),locks,random})
  assert.notEqual(one.scope,two.scope);assert.equal(values.size,0)
  const denied=await reserveSubtitleSession('same',{storage:{getItem(){throw new Error('Denied')}},locks:{request(){}},random})
  assert.notEqual(denied.scope,two.scope)
})
