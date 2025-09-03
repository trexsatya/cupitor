import {expect} from "chai";
import sinon from 'sinon'
import _ from 'lodash'
import {computeIfAbsent}  from '../../public/data-structures.js'
import  {expandWords} from '../../public/language'
import {conjugateTableSpanish} from "../../public/spanish";

let conjugateTableSpanishStub;
beforeAll(() => {
  sinon.stub(window, 'alert').callsFake(() => {});
  global.conjugateTableSpanish = conjugateTableSpanish
  global.computeIfAbsent = computeIfAbsent
  conjugateTableSpanishStub = sinon.stub(global, 'conjugateTableSpanish').returns([]);
});

describe('expandWords', () => {
  beforeEach(() => {})

  it('expands words using getExpansionForWords for Swedish - middle', () => {
    const result = expandWords('det <*gå inte an')
    expect(result).contains('det gå inte an ')
    expect(result).contains('det går inte an ')
    expect(result).contains('det gick inte an ')
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
    const result = expandWords('det <*gå', 'es')
    expect(conjugateTableSpanishStub.calledOnce).to.be.true;
  })

  it('returns original if expansion not found', () => {
    const result = expandWords('Try <*unknown word')
    expect(result).contains('try unknown word')
  })

  it('handles multiple terms separated by SEPARATOR_PIPE', () => {
    const result = expandWords('A <*run fast|B <*run slow')

  })
})

afterAll(() => {
  window.alert.restore();
  conjugateTableSpanishStub.restore();
});
