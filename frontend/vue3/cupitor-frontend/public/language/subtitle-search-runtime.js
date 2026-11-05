import { openSubtitleCorpus, createDocumentCache } from './subtitle-corpus-store.js'
import { prepareSearchDocument, matchSearchDocument, createSubtitleMatchCollector, compactSearchFile, compactSubtitleMatches } from './subtitle-search-engine.js'
import { srtToJson } from './srt-parser.js'
import { tokenizeLine, wordMatches, EVERYTHING_ELSE, sinkUnevidencedGroups, capGroups } from './corresponding-words.js'
import { matchingPositions, buildAutoItemsForWord } from './random-playlist.js'
import { buildSearchPlaylist } from './search-playlist.js'

export const searchError = (message,code='subtitle-search-incomplete')=>Object.assign(new Error(message),{code})
// Used by both the dedicated worker and the cooperative fallback. A complete
// transcript remains the regex search unit; it is never split into guessed
// overlapping text chunks.
export async function createSubtitleSearchRuntime(scope,{indexedDB=globalThis.indexedDB,cacheBytes,baseScope=scope,indexing=true,indexingPaused=false,keyRange=globalThis.IDBKeyRange,legacyScope,onStorageProgress}={}) {
  const corpus=await openSubtitleCorpus(scope,indexedDB,{baseScope,keyRange,legacyScope,onStorageProgress}),cache=createDocumentCache(cacheBytes)
  const queue=new Set()
  let closed=false,indexWork=null,indexDocumentWork=null,indexPaused=0,indexError=null,lastQuery=null
  function enqueue(ids){
    if(!indexing||closed)return
    ids.forEach(id=>queue.add(id))
    if(indexWork||indexPaused||indexingPaused)return
    indexWork=(async()=>{
      while(queue.size&&!closed&&!indexPaused&&!indexingPaused){
        const id=queue.values().next().value;queue.delete(id)
        try{indexDocumentWork=corpus.indexDocument(id,{check:()=>{
          if(closed)throw searchError('Search session closed.')
          if(indexPaused||indexingPaused)throw searchError('Index preparation paused.','subtitle-index-paused')
        }});await indexDocumentWork}
        catch(error){
          if(error.code==='subtitle-index-paused'){if(!closed)queue.add(id)}
          else if(!closed)indexError=error.message||error.name||'Optional subtitle indexing failed.'
          // Indexes are disposable accelerators. A full disk must not turn
          // the remaining library into an endless stream of failed writes.
          if(error.name==='QuotaExceededError'||error.code===22){indexingPaused=true;queue.clear()}
        }
        finally{indexDocumentWork=null}
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      if(!closed)await corpus.prune().catch(()=>{})
    })().finally(()=>{indexWork=null;if(queue.size&&!closed&&!indexPaused&&!indexingPaused)enqueue([])})
  }
  const resumed=corpus.pendingIndexIds().then(enqueue).catch(error=>{if(!closed)indexError=error.message})
  async function candidates(ids,query,options,check){
    if(indexing)try{return await corpus.candidates(ids,query,options,check)}catch(error){check();indexError=error.message}
    return {ids,strategy:'scan',indexed:0,pending:ids.length}
  }
  const api={
    async setIndexingPaused({paused}){indexingPaused=!!paused;if(!indexingPaused)enqueue([]);return true},
    async update(documents){
      const missing=documents.filter(doc=>doc._evicted&&!doc.remove),incoming=new Map(missing.map(doc=>[doc.id,doc]))
      for await(const batch of corpus.iterate(missing.map(doc=>doc.id))) {
        const complete=batch.map(before=>{
          if(!before)throw searchError('A downloaded subtitle must be restored before editing its metadata.')
          const doc=incoming.get(before.id)
          return {...before,...doc,sv:doc.sv===undefined?before.sv:doc.sv,en:doc.en===undefined?before.en:doc.en,_evicted:false}
        })
        await corpus.put(complete)
      }
      const normal=documents.filter(doc=>!doc._evicted||doc.remove)
      if(normal.length)await corpus.put(normal)
      documents.forEach(doc=>cache.remove(doc.id))
      enqueue(documents.map(doc=>doc.id))
    },
    async document({id}){const [doc]=await corpus.get([id]);if(!doc)throw searchError('This subtitle is not downloaded for offline use.');return doc},
    async files({ids,query,regexMode,suffix,compact=false,useIndex=true},check=()=>{},progress=()=>{}) {
      const result=[]
      const selection=useIndex?await candidates(ids,query,{regexMode},check):{ids,strategy:'scan',pending:0}
      lastQuery={total:ids.length,candidates:selection.ids.length,inspected:0,strategy:selection.strategy,pending:selection.pending}
      let visited=0
      for await(const batch of corpus.iterate(selection.ids,{unordered:true,check})) {
        check()
        for(let i=0;i<batch.length;i++) {
          check()
          const raw=batch[i]
          if(!raw)throw searchError('Some subtitles are missing from search storage. Reload to prepare complete coverage.')
          let document=cache.get(raw.id,raw.revision)
          if(!document){document=prepareSearchDocument(raw);cache.put(raw.id,raw.revision,document)}
          const hit=matchSearchDocument(document,query,{regexMode,suffix})
          if(hit)result.push(compact?compactSearchFile(hit):hit)
        }
        visited+=batch.length
        lastQuery.inspected=visited
        progress({visited:ids.length-selection.ids.length+visited,total:ids.length})
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      const order=new Map(ids.map((id,i)=>[id,i]))
      result.sort((a,b)=>order.get(a.url)-order.get(b.url))
      check();progress({visited:ids.length,total:ids.length});return result
    },
    async attribute({files,query,regexMode,exactWordsOnly,compact=false,englishParts=[]},check=()=>{}) {
      const projected=new WeakMap()
      const projectLine=line=>{
        if(!compact)return line
        if(!projected.has(line)){
          const tokens=new Set(tokenizeLine(line.text)),{text,...cue}=line
          cue._englishParts=englishParts.filter(part=>{const words=tokenizeLine(part);return words.length&&words.every(word=>tokens.has(word))})
          projected.set(line,cue)
        }
        return projected.get(line)
      }
      const collector=createSubtitleMatchCollector(query,{regexMode,exactWordsOnly,projectLine})
      const language=files.length&&files.every(file=>file.language===files[0].language)?files[0].language:null
      const selection=await candidates(files.map(file=>file.id),query,{language,regexMode,exactWordsOnly},check)
      const selected=new Set(selection.ids)
      files=files.filter(file=>selected.has(file.id))
      // Input contains identities, not another copy of the subtitle corpus.
      let offset=0
      for await(const batch of corpus.iterate(files.map(file=>file.id))) {
        check()
        for(let i=0;i<batch.length;i++) {
          check();const doc=batch[i],file=files[offset+i]
          if(!doc)throw searchError('Subtitle coverage changed during search. Run the search again.')
          let prepared=cache.get(doc.id,doc.revision)
          if(!prepared){prepared=prepareSearchDocument(doc);cache.put(doc.id,doc.revision,prepared)}
          const hit=matchSearchDocument(prepared,query,{regexMode,suffix:file.suffix})
          if(hit)collector.add(file.language==='en'?hit.en_subs:hit.sv_subs,check)
        }
        offset+=batch.length
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      const result=collector.finish()
      return compact?compactSubtitleMatches(result,englishParts):result
    },
    async context({id,from=1,to=1,regexMode=false}) {
      const [doc]=await corpus.get([id]);if(!doc)throw searchError('This subtitle is not available offline.')
      const cues=key=>srtToJson(doc[key]).map(line=>regexMode?{...line,text:line.text.trimEnd()}:line)
      const sv=cues('sv'),en=cues('en')
      const choose=lines=>({data:lines.filter(line=>Number(line.index)>=from&&Number(line.index)<=to),lastIndex:lines.reduce((max,line)=>Math.max(max,Number(line.index)||0),0)})
      return {sv_subs:choose(sv),en_subs:choose(en)}
    },
    async vocabScan({ids,entries,threshold=null},check=()=>{},progress=()=>{}) {
      const compiled=entries.map(entry=>({...entry,re:entry.pattern?new RegExp(entry.pattern,entry.flags||'i'):null,count:0,ids:[]}))
      let visited=0
      for await(const batch of corpus.iterate(ids)) {
        for(const doc of batch){
          check();if(!doc)throw searchError('Subtitle coverage changed during vocabulary scanning.')
          const prepared=prepareSearchDocument(doc)
          for(const entry of compiled){
            check();if(!entry.re||(threshold!==null&&entry.count>=threshold))continue
            if((prepared.svClean&&entry.re.test(prepared.svClean))||(prepared.enClean&&entry.re.test(prepared.enClean))){entry.count++;if(threshold===null)entry.ids.push(doc.id)}
          }
        }
        visited+=batch.length;progress({visited,total:ids.length})
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      return compiled.map(({line,category,count,ids,re})=>({line,category,count,ids,valid:!!re}))
    },
    async automatic({ids,expanded,pattern,options},check=()=>{}) {
      const re=new RegExp(pattern,'i'),matches=[]
      for await(const batch of corpus.iterate(ids)){
        for(const doc of batch){
          check();if(!doc)throw searchError('Subtitle coverage changed during playlist preparation.')
          const raw=doc.sv||doc.en;if(!raw||!re.test(raw))continue
          const lines=srtToJson(raw).map(line=>({index:parseInt(line.index,10),ts:line.start?.ordinal,te:line.end?.ordinal,text:line.text||''}))
          for(const pos of matchingPositions(lines,re)){
            const surface=lines[pos].text.match(re)?.[0]?.trim()||expanded
            // Retain only the requested context for each match, never a full
            // transcript for every matching word in a generated playlist.
            const from=Math.max(0,pos-options.contextLines),to=Math.min(lines.length,pos+options.contextLines+1)
            matches.push({link:doc.id,source:doc.source,lines:lines.slice(from,to),pos:pos-from,word:surface})
            if(matches.length>=options.matchesPerWord)return buildAutoItemsForWord(expanded,matches,options)
          }
        }
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      return buildAutoItemsForWord(expanded,matches,options)
    },
    async playlist({groups,selected,options},check=()=>{}) {
      const selectedGroups=groups.filter(group=>selected.includes(group.word)),ids=[...new Set(selectedGroups.flatMap(group=>group.items.map(item=>item.url)))],queues=selectedGroups.map(()=>new Map())
      for await(const batch of corpus.iterate(ids))for(const doc of batch){
        check();if(!doc)throw searchError('Subtitle coverage changed during playlist preparation.')
        const file={url:doc.id,sv_subs:{data:srtToJson(doc.sv)},en_subs:{data:srtToJson(doc.en)}}
        selectedGroups.forEach((group,i)=>{for(const item of buildSearchPlaylist(group.items.filter(item=>item.url===doc.id),{...options,files:[file],word:group.word}))queues[i].set(item.id+'|'+item.lineIndex,item)})
      }
      const limit=options.maxPerHeader===''?Infinity:Number(options.maxPerHeader)
      if(options.maxPerHeader!==''&&(!Number.isSafeInteger(limit)||limit<1))throw searchError('Max clips per heading must be a positive whole number.')
      return selectedGroups.flatMap((group,i)=>{const seen=new Set();return group.items.map(item=>queues[i].get(item.url+'|'+item.line.index)).filter(item=>{if(!item||seen.has(item))return false;seen.add(item);return true}).slice(0,limit)})
    },
    async statistics({ids,matches,regexMode=false},check=()=>{}) {
      const wanted=new Map(),background=new Map(),frequencies=new Map();let backgroundLines=0,matchedLineCount=0
      for(const item of matches){if(!wanted.has(item.url))wanted.set(item.url,new Set());wanted.get(item.url).add(String(item.line.index))}
      for await(const batch of corpus.iterate(ids))for(const doc of batch){
        check();if(!doc)throw searchError('Subtitle coverage changed during grouping.')
        const lines=srtToJson(doc.sv).map(line=>regexMode?{...line,text:line.text.trimEnd()}:line)
        const byIndex=new Map(lines.map(line=>[String(line.index),line.text]))
        for(const line of lines)if(line.text){backgroundLines++;for(const word of new Set(tokenizeLine(line.text)))background.set(word,(background.get(word)||0)+1)}
        for(const id of wanted.get(doc.id)||[]){const text=byIndex.get(id);if(!text)continue;matchedLineCount++;for(const word of new Set(tokenizeLine(text)))frequencies.set(word,(frequencies.get(word)||0)+1)}
      }
      return {background:[...background],frequencies:[...frequencies],backgroundLines,matchedLineCount}
    },
    async regroup({ids,items,candidates,max,regexMode=false},check=()=>{}) {
      const wanted=candidates.filter(candidate=>(candidate.reasons||[]).some(reason=>reason==='translated'||reason==='vocabulary'))
      const existing=new Map(),assigned=new Map(),extra=[]
      for(const item of items){if(!existing.has(item.url))existing.set(item.url,new Map());existing.get(item.url).set(String(item.line.index),item)}
      const have=new Set(items.map(item=>item.url+'|'+item.line.index))
      const heading=text=>{const tokens=tokenizeLine(text);return candidates.find(candidate=>tokens.some(word=>wordMatches(word,candidate.word)))?.word||EVERYTHING_ELSE}
      for await(const batch of corpus.iterate(ids))for(const doc of batch){
        check();if(!doc)throw searchError('Subtitle coverage changed during grouping.')
        const parse=key=>srtToJson(doc[key]).map(line=>regexMode?{...line,text:line.text.trimEnd()}:line)
        const sv=parse('sv'),en=new Map(parse('en').map(line=>[String(line.index),line]))
        const studied=new Map(sv.map(line=>[String(line.index),line.text]))
        for(const [index]of existing.get(doc.id)||[])assigned.set(doc.id+'|'+index,heading(studied.get(index)||''))
        for(const line of sv){
          const key=doc.id+'|'+line.index;if(have.has(key)||!line.text)continue
          const lower=line.text.toLowerCase();if(!wanted.some(candidate=>lower.includes(candidate.word)))continue
          const tokens=tokenizeLine(line.text),candidate=wanted.find(candidate=>tokens.some(word=>wordMatches(word,candidate.word)))
          const english=en.get(String(line.index));if(!candidate||!english)continue
          have.add(key)
          const {text,...cue}=english
          extra.push({word:candidate.word,line:cue,url:doc.id,source:doc.source,_viaGuess:candidate.word})
          assigned.set(key,heading(studied.get(String(line.index))||''))
        }
      }
      const buckets=new Map(candidates.map(candidate=>[candidate.word,[]])),rest=[]
      for(const item of [...items,...extra]){const word=assigned.get(item.url+'|'+item.line.index);(buckets.get(word)||rest).push(item)}
      let groups=candidates.map(candidate=>({word:candidate.word,reasons:candidate.reasons||[],items:buckets.get(candidate.word)})).filter(group=>group.items.length)
      if(rest.length)groups.push({word:EVERYTHING_ELSE,reasons:[],items:rest})
      groups=capGroups(sinkUnevidencedGroups(groups,item=>!item._viaGuess),max)
      if(groups.length<2)return null
      const result={}
      for(const group of groups){if(group.word!==EVERYTHING_ELSE)for(const item of group.items)if(item._viaGuess)item._viaGuess=group.word;result[group.word]=group.items}
      return result
    },
    async caches(){return corpus.list()},
    async retain({ids}){
      const wanted=new Set(ids),removed=(await corpus.documentIds()).filter(id=>!wanted.has(id))
      for(let offset=0;offset<removed.length;offset+=32)await corpus.put(removed.slice(offset,offset+32).map(id=>({id,remove:true})))
      enqueue(removed);return removed.length
    },
    async indexStatus({ids=[],wait=false}={}){
      if(wait){await resumed;while(indexWork)await indexWork}
      return {...await corpus.indexStatus(ids),building:!!indexWork,queued:queue.size,error:indexError,lastQuery}
    },
    async clearCache({scope:target}){const entries=await corpus.list();if(entries.some(meta=>meta.scope===target&&(meta.baseScope===baseScope||meta.leaseUntil>Date.now())))throw searchError('The active language/source search data is protected.');await corpus.removeScope(target);return true},
    close(){closed=true;queue.clear();corpus.close()},
    get cacheBytes(){return cache.bytes},
  }
  // Queries preempt optional indexing at its next bounded checkpoint. Its
  // recovery manifest keeps interrupted rows safely on the full-scan path.
  for(const type of ['files','attribute','statistics','regroup','vocabScan','automatic','playlist']){
    const run=api[type]
    api[type]=async(...args)=>{
      indexPaused++
      try{
        if(indexDocumentWork)await indexDocumentWork.catch(()=>{})
        args[1]?.();return await run(...args)
      }
      finally{indexPaused--;if(!indexPaused&&queue.size&&!closed)enqueue([])}
    }
  }
  return api
}
