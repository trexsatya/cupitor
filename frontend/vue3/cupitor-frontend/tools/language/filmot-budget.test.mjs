import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createFilmotApiClient, collectFilmotApiWord} from './filmot-api.js';

const channel = 'UCXuqSBlHAE6Xw-yeJA0Tunw';
const params = {channelID:channel,query:'"svaja"'};
test('global budget guards live searches and never sends key in URL', async t => {
  const dir=mkdtempSync(join(tmpdir(),'filmot-budget-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const urls=[];
  const api=createFilmotApiClient({
    key:'dummy-test-key',cacheDir:dir,delayMs:0,maxCredits:2,
    fetchFn:async (url,opts)=>{
      urls.push({url,headers:opts.headers});
      return {status:200,ok:true,json:async()=>({result:[]}),headers:{
        get:header=>header==='X-API-Credit-Cost'?'1':null}};
    },
  });
  await api.get('getsubtitlesearch',params);
  assert.equal(api.spentCredits,1);
  assert.equal(api.budgetRemaining,1);
  assert.equal(api.canSpend('getsubtitlesearch',params),true);
  assert.equal(api.canSpend('getsubtitlesearch',{query:'"other"',channelID:channel}),true);
  assert.equal(api.canSpend('getsubtitlesearch',{query:'"other"'}),false);
  await api.get('getsubtitlesearch',params);
  assert.equal(urls.length,1,'cached searches spend zero additional credits');
  await api.get('getsubtitlesearch',{...params,query:'"other"'});
  assert.equal(api.spentCredits,2);
  await assert.rejects(api.get('getsubtitlesearch',{...params,query:'"more"'}),{budget:true});
  assert.equal(urls.length,2);
  assert(urls.every(item=>!item.url.includes('dummy-test-key')));
  assert(urls.every(item=>item.headers['X-API-Key']==='dummy-test-key'));
});
test('missing cost response header uses the conservative credit estimate', async () => {
  const api=createFilmotApiClient({
    key:'x',delayMs:0,maxCredits:10,
    fetchFn:async()=>({status:200,ok:true,json:async()=>({result:[]}),headers:{get:()=>null}}),
  });
  await api.get('getsubtitlesearch',{query:'"word"'});
  assert.equal(api.spentCredits,10);
  assert.equal(api.budgetRemaining,0);
});
test('collector gracefully stops before a search that would exceed remaining credits', async () => {
  let calls=0;
  const client={
    hasCached:()=>false,
    canSpend:()=>false,
    get:async()=>{calls++;return {result:[]}},
  };
  const result=await collectFilmotApiWord({
    word:'svaja',terms:['svaja'],regex:/svaja/,
    cfg:{lang:'sv',maxItemsPerWord:5,preferManualCaptions:true,
      apiChannelGroups:1,apiMaxCreditsPerWord:15,apiUnrestrictedFallback:true},
    channels:[{channelid:channel}],client,
  });
  assert.equal(calls,0);
  assert.equal(result.budgetExhausted,true);
  assert.equal(result.complete,false);
  assert.deepEqual(result.hits,[]);
});
