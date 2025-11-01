import {expect} from "chai";
import sinon from 'sinon'
import _ from 'lodash'
import {computeIfAbsent}  from '../../public/data-structures.js'
import  {expandWords, renderVocabularyFindings} from '../../public/language.js'
import {conjugateTableSpanish} from "../../public/spanish";

let conjugateTableSpanishStub;
beforeAll(() => {
  sinon.stub(window, 'alert').callsFake(() => {});
  global.conjugateTableSpanish = conjugateTableSpanish
  global.computeIfAbsent = computeIfAbsent
  window.HTMLElement.prototype.scrollIntoView = function() {};
});

describe('expandWords', () => {
  beforeEach(() => {})

  it('expands words using getExpansionForWords for Swedish - middle', () => {
    const result = expandWords('det <*gå inte an')
    expect(result).contains('det gå inte an ')
    expect(result).contains('det går inte an ')
    expect(result).contains('det gick inte an ')

    expect(expandWords('(nedsättande)patrask|slödder|avskum|avskrap|pöbel|mobb|rötägg|')).contains('pöbel')
  })

  it('expands words using getExpansionForWords for Swedish - beginning', () => {
    const result = expandWords('<*gå inte an')
    expect(result).contains('gå inte an ')
    expect(result).contains('går inte an ')
    expect(result).contains('gick inte an ')
  })

  it('expands words using getExpansionForWords for Swedish - end', () => {
    const result = expandWords('det <*gå')
    expect(result).contains('det gå')
    expect(result).contains('det går')
    expect(result).contains('det gick')
  })

  it('expands words using conjugateTableSpanish for Spanish', () => {
    let result = expandWords('<*{sentir}requerir', 'es')
    'requerir\trequiere\trequiera\trequiramos\trequerid\trequieran'.split('\t').forEach(it=> {
      expect(result).contains(it)
    })

    expect(expandWords('(sit)|<*{pensar}sentar|sentarse|estar sentado|', 'es').split('|').map(it => it.trim())).includes('sentar')
    expect(expandWords('gritarle', 'es').split('|').map(it => it.trim())).includes('gritar', 'gritarle')

    window.vocabulary = {
      'Phases, Motion': ['(sit)|<*{pensar}sentar|sentarse|estar sentado|']
    }
    document.body.innerHTML = `<div id="vocabularyResult"> </div>`
    global.getLangFromUrl = () => ({fullName: 'spanish', code: 'es'})
    renderVocabularyFindings('sentar')
    expect(document.body.innerHTML).contains('(sit) | &lt;*{pensar}sentar | sentarse | estar sentado | ')
  })

  it('returns original if expansion not found', () => {
    const result = expandWords('Try <*unknown word')
    expect(result).contains('try unknown word')
  })

  it('handles multiple terms separated by SEPARATOR_PIPE', () => {
    const result = expandWords('A <*run fast|B <*run slow')

  })
})

describe('conjugateTableSpanish', () => {

})

afterAll(() => {
  window.alert.restore();
  conjugateTableSpanishStub.restore();
  document.body.innerHTML = ''
});
