import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSubtitleFeatures, planSubtitleCandidates, postingTerm, foldSearchText, indexCovers, SUBTITLE_INDEX_VERSION, SUBTITLE_INDEX_ENVIRONMENT } from './subtitle-search-index.js'
import { prepareSearchDocument, matchSearchDocument } from './subtitle-search-engine.js'

const srt=text=>`1\n00:00:01,000 --> 00:00:03,000\n${text}\n`
const accepts=(terms,plan)=>!plan||plan.clauses.some(clause=>clause.every(term=>terms.has(term)))
test('literal, substring, phrase and conservative regex plans never change the matcher',async()=>{
  const texts=['foo bar','foobar','food beyond bar','foooooobar','bar foo','foo\nbar','food bar!','färgsprakande','väljarkår','göra susen','make a difference','Kelvin ſong Σςσ ẞß','AB𐐀𐐨cd','Åå Ää Öö','fö<c.huvudpratare>r','double  space','123','abbbc','abc','a\nbc']
  const documents=texts.map((text,i)=>({id:String(i),sv:srt(text),en:srt(texts[texts.length-i-1])}))
  const queries=['foo','bar','foo bar','foo\\s+bar','foo.*bar','^foo','bar$','food|bar','foo|a','foo|','foo?bar','foo+bar','foo{0}bar','foo{1}bar','foo{1,2}?bar','foo[ab]bar','foo[^]bar','foo\\d+bar','foo\\p{L}*bar','foo(bar)?','(?=foo)','(foo|bar)','[åäö]+','åäö','färgsprakande','kår','år','göra susen','make a difference','kelvin','song','σσ','ßß','åå','förc','för','double space','123','abc{0}','abb{2}c','\\u0066oo','foo\\x20bar','foo\\nbar','AB𐐨𐐀cd','abc\\q','foo\\0bar','a|b']
  const features=await Promise.all(documents.map(doc=>buildSubtitleFeatures(doc,{yieldToUI:async()=>{}})))
  for(const query of queries)for(const regexMode of [false,true]){
    const plan=planSubtitleCandidates(query,{regexMode})
    const expected=documents.filter(doc=>matchSearchDocument(prepareSearchDocument(doc),query,{regexMode})).map(doc=>doc.id)
    const actual=documents.filter((doc,i)=>accepts(new Set(features[i].terms),plan)&&matchSearchDocument(prepareSearchDocument(doc),query,{regexMode})).map(doc=>doc.id)
    assert.deepEqual(actual,expected,JSON.stringify({query,regexMode}))
  }
  assert.equal(planSubtitleCandidates('(foo|bar)'),null)
  assert.equal(planSubtitleCandidates('foo|a'),null)
  assert.equal(planSubtitleCandidates('år'),null)
  assert.equal(planSubtitleCandidates('foo.*bar').kind,'trigram')
})

test('word postings include both matcher token boundaries and fallback boundaries',async()=>{
  const features=await buildSubtitleFeatures({sv:srt('Weſt don\'t foo-bar ÅÄÖ foo'),en:srt('thin thinking')})
  const terms=new Set(features.terms)
  for(const word of ['west','don','foo','bar','åäö'])assert.ok(terms.has(postingTerm('w','sv',foldSearchText(word))),word)
  assert.equal(planSubtitleCandidates('thin',{language:'en',exactWordsOnly:true}).kind,'word')
  assert.equal(planSubtitleCandidates(' thin',{language:'en',exactWordsOnly:true}).kind,'trigram')
  assert.equal(planSubtitleCandidates('thin',{language:'en',exactWordsOnly:true,regexMode:true}).kind,'trigram')
  assert.ok(terms.has(postingTerm('g','en','hin')))
  const limited=await buildSubtitleFeatures({sv:srt('many unique words here')},{maxTerms:2})
  assert.equal(limited.complete,false);assert.deepEqual(limited.terms,[])
  const plan=planSubtitleCandidates('needle'),info={indexVersion:SUBTITLE_INDEX_VERSION,indexEnvironment:SUBTITLE_INDEX_ENVIRONMENT,indexGeneration:1,generation:1,indexComplete:true}
  assert.equal(indexCovers(info,plan),true)
  assert.equal(indexCovers({...info,indexEnvironment:'older-engine-or-locale'},plan),false,'browser or locale changes cannot reuse older normalization data')
})

test('case folding preserves every native single-codepoint case mapping',()=>{
  let checked=0
  for(let n=0;n<=0x10ffff;n++){
    const c=String.fromCodePoint(n)
    for(const other of [c.toUpperCase(),c.toLowerCase()])if(other!==c&&[...other].length===1&&new RegExp('^'+c+'$','iu').test(other)){
      assert.equal(foldSearchText(c),foldSearchText(other),'U+'+n.toString(16));checked++
    }
  }
  assert.ok(checked>2500)
  assert.notEqual(foldSearchText('å'),foldSearchText('a'),'diacritics remain distinct')
})
