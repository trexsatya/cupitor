// Shared reference/fallback/worker semantics. Normalization and attribution
// are independent of the DOM, account state and rendering.
import { getWords, withWordBoundaries, relaxSpaces as _relaxSpaces, getSearchedTerms, isRegExp, cleanSrtForMatch } from './search-text.js'
import { compileRegex, splitRegexAlternatives, hasPhraseWhitespace } from './regex-pattern.js'
import { srtToJson } from './srt-parser.js'
import { tokenizeLine } from './corresponding-words.js'
const SEPARATOR_PIPE = '|'
const computeIfAbsent = (map,key,create) => Object.hasOwn(map,key) ? map[key] : (Object.defineProperty(map,key,{value:create(key),writable:true,enumerable:true,configurable:true}),map[key])
class MatchResult { constructor(word,line,url,source) { Object.assign(this,{word,line,url,source}) } }

export const SUBTITLE_NORMALIZATION_VERSION = 1
export function compactSearchFile(file) {
  const compact=subs=>({...subs,data:[],lastIndex:subs.data.reduce((max,line)=>Math.max(max,Number(line.index)||0),0),_contextOnly:true})
  return {...file,sv_subs:compact(file.sv_subs),en_subs:compact(file.en_subs)}
}
export function compactSubtitleMatches(map,parts=[]) {
  const uses=new Map(),seen=new Set(),lines=new WeakMap(),result=Object.create(null)
  for(const [word,items]of Object.entries(map))result[word]=items.map(item=>{
    const key=item.url+'|'+item.line.index
    if(parts.length>1&&!seen.has(key)) {
      const tokens=new Set(tokenizeLine(item.line.text));seen.add(key)
      for(const part of parts){const words=tokenizeLine(part);if(item.line._englishParts?.includes(part)||(words.length&&words.every(word=>tokens.has(word))))uses.set(part,(uses.get(part)||0)+1)}
    }
    if(!lines.has(item.line)){const {text,_englishParts,...line}=item.line;lines.set(item.line,line)}
    return {...item,line:lines.get(item.line)}
  })
  let englishWord=parts.length===1?parts[0]:''
  for(const [word,count]of uses)if(!englishWord||count>uses.get(englishWord))englishWord=word
  return {map:result,englishWord}
}
export function prepareSearchDocument(document) {
  return { ...document, svClean:cleanSrtForMatch(document.sv), enClean:cleanSrtForMatch(document.en), version:SUBTITLE_NORMALIZATION_VERSION }
}
export function matchSearchDocument(document, query, {regexMode=false, suffix='.sv.srt'}={}) {
  const re=compileRegex(_relaxSpaces(query),'i')
  let svMatch=!!(document.sv && re.test(document.svClean)),enMatch=!!(document.en && re.test(document.enClean))
  if(regexMode) {
    if(!svMatch&&document.sv)svMatch=srtToJson(document.sv).some(line=>re.test(line.text.trimEnd()))
    if(!enMatch&&document.en)enMatch=srtToJson(document.en).some(line=>re.test(line.text.trimEnd()))
  }
  if(!svMatch&&!enMatch)return null
  const subs=(key,extension)=>({data:srtToJson(document[key]).map(line=>regexMode?{...line,text:line.text.trimEnd()}:line),path:document.id+extension,url:document.id,source:document.source,fetchedFrom:document.fetchedFrom})
  return {source:document.source,url:document.id,sv_match:svMatch,en_match:enMatch,sv_subs:subs('sv',suffix),en_subs:subs('en','.en.srt')}
}

export function createSubtitleMatchCollector(search, {regexMode=false,exactWordsOnly=false,projectLine=line=>line}={}) {
  const map={},fallback={}
  const transformed=compileRegex(_relaxSpaces(search),'i')
  const bounded=pattern=>regexMode?pattern:withWordBoundaries(pattern)
  const long=word=>word.trim().length>2
  const finalSearch=long(search)?search.trim():search
  const perWord=compileRegex('^(?:'+splitRegexAlternatives(search).map(word=>word.trim()).filter(Boolean).join('|')+')$','i')
  const phrases=(regexMode?[]:splitRegexAlternatives(search)).map(term=>term.trim()).filter(term=>term.length>1&&hasPhraseWhitespace(term))
    .map(term=>({term,re:compileRegex(_relaxSpaces(bounded(term)),'i')}))
  const wholeWord=search.trim()
  const wholeRe=hasPhraseWhitespace(wholeWord)?compileRegex(_relaxSpaces(bounded(wholeWord)),'i'):null
  const fallbackRe=compileRegex(_relaxSpaces(bounded(finalSearch)),'i')
  let included=false
  const add=(target,word,line,item)=>{
    const values=computeIfAbsent(target,word,()=>[])
    values.push(new MatchResult(word,projectLine(line),item.url,item.source))
    if(target===map&&word.toLowerCase().includes(finalSearch.toLowerCase()))included=true
  }
  return {
    add(item,check=()=>{}) {
      const lines=item.data
      for(const line of lines) {
        check()
        if(regexMode) {
          // Explicit regexes match spans of transcript text, not a
          // loosely tokenised word. In particular, do not trim a trailing
          // space from "[^ ]+Stå " and then report unrelated suffix hits.
          const re=compileRegex(_relaxSpaces(search),'gi')
          for(const hit of line.text.matchAll(re)) {
            const matched=hit[0].trim().toLowerCase()
            if(matched) add(map,matched,line,item)
          }
          continue
        }
        if(transformed.test(line.text)) {
          const words=getWords(line.text).map(word=>word.trim().toLowerCase())
          for(const word of words) {
            const ends=long(search)&&search.endsWith(' ')&&!search.startsWith(' ')&&word.endsWith(search.trim())
            const starts=long(search)&&search.startsWith(' ')&&!search.endsWith(' ')&&word.startsWith(search.trim())
            if(perWord.test(word)||(!exactWordsOnly&&transformed.test(word))||ends||starts)add(map,word,line,item)
          }
          if(wholeRe&&wholeRe.test(line.text))add(map,wholeWord,line,item)
          for(const {term,re}of phrases)if(re.test(line.text))add(map,term,line,item)
        }
        // The old second pass uses one global condition: whether any exact
        // or related heading already accounts for this query. Accumulate
        // fallback references now and decide once all documents were visited.
        if(!included) {
          const matches=line.text.match(fallbackRe)
          if(matches)add(fallback,matches[0].toLowerCase(),line,item)
        }
      }
      for(let i=0;i+1<lines.length;i++) {
        const a=lines[i],b=lines[i+1]
        if(!a?.text||!b?.text)continue
        const combined=a.text+'\n'+b.text
        for(const {term,re}of phrases)if(re.test(combined)&&!re.test(a.text)&&!re.test(b.text))add(map,term,a,item)
        if(wholeRe&&wholeRe.test(combined)&&!wholeRe.test(a.text)&&!wholeRe.test(b.text))add(map,wholeWord,a,item)
      }
    },
    finish(){
      if(regexMode) return map
      if(map[search.trim()]===undefined)Object.defineProperty(map,search,{value:[],writable:true,enumerable:true,configurable:true})
      if(!included&&(!map[finalSearch.trim()]||!map[finalSearch.trim()].length))Object.assign(map,fallback)
      if(!regexMode)getSearchedTerms(search).forEach(term=>{
        if(!Object.hasOwn(map,term)&&!isRegExp(term))Object.defineProperty(map,term,{value:[],writable:true,enumerable:true,configurable:true})
      })
      return map
    },
  }
}
export async function attributeSubtitleMatches(list,search,{check=()=>{},yieldToUI=()=>new Promise(resolve=>setTimeout(resolve,0)),...options}={}) {
  const collector=createSubtitleMatchCollector(search,options)
  for(let offset=0;offset<list.length;offset+=25) {
    check()
    for(const item of list.slice(offset,offset+25))collector.add(item,check)
    await yieldToUI()
  }
  return collector.finish()
}
