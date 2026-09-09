import { parseRepeatStructure, expandRepeats } from './music-repeats.js';

// Compact factory for a measure's repeat metadata (all flags default off).
const M = (o = {}) => ({
  startRepeat: false, endRepeat: false, endRepeatTimes: 2,
  endingStart: false, endingNumbers: [], endingStop: false,
  segno: false, coda: false, dacapo: false, dalsegno: false, tocoda: false, fine: false, ...o,
});

describe('expandRepeats', () => {
  test('no repeats → measures play once in order', () => {
    expect(expandRepeats([M(), M(), M(), M()])).toEqual([0, 1, 2, 3]);
  });

  test('forward/backward repeat plays the span twice', () => {
    const ms = [M({ startRepeat: true }), M(), M(), M({ endRepeat: true })];
    expect(expandRepeats(ms)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  test('times="3" plays the span three times', () => {
    const ms = [M({ startRepeat: true }), M({ endRepeat: true, endRepeatTimes: 3 })];
    expect(expandRepeats(ms)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  test('1st/2nd endings (voltas): first pass takes ending 1, second takes ending 2', () => {
    // m0 common (repeat start); m1 = ending 1 with the backward repeat; m2 = ending 2.
    const ms = [
      M({ startRepeat: true }),
      M({ endingStart: true, endingNumbers: [1], endRepeat: true }),
      M({ endingStart: true, endingNumbers: [2] }),
    ];
    expect(expandRepeats(ms)).toEqual([0, 1, 0, 2]);
  });

  test('D.C. al Fine: replay from the top, stop at Fine', () => {
    const ms = [M(), M({ fine: true }), M(), M({ dacapo: true })];
    expect(expandRepeats(ms)).toEqual([0, 1, 2, 3, 0, 1]);
  });

  test('D.S. al Coda: jump to segno, then at To Coda jump to the coda', () => {
    const ms = [
      M(), M({ segno: true }), M({ tocoda: true }), M({ dalsegno: true }), M({ coda: true }), M(),
    ];
    expect(expandRepeats(ms)).toEqual([0, 1, 2, 3, 1, 2, 4, 5]);
  });

  test('empty input → empty order', () => {
    expect(expandRepeats([])).toEqual([]);
  });
});

describe('parseRepeatStructure', () => {
  const parse = (inner) => new DOMParser().parseFromString(
    `<score-partwise><part id="P1">${inner}</part></score-partwise>`, 'application/xml');

  test('reads forward/backward repeat barlines and repeat count', () => {
    const doc = parse(
      `<measure number="1"><barline location="left"><repeat direction="forward"/></barline></measure>` +
      `<measure number="2"><barline location="right"><repeat direction="backward" times="3"/></barline></measure>`);
    const ms = parseRepeatStructure(doc);
    expect(ms[0].startRepeat).toBe(true);
    expect(ms[1].endRepeat).toBe(true);
    expect(ms[1].endRepeatTimes).toBe(3);
  });

  test('reads volta ending numbers', () => {
    const doc = parse(
      `<measure number="1"><barline location="left"><ending number="1, 2" type="start"/></barline></measure>`);
    const ms = parseRepeatStructure(doc);
    expect(ms[0].endingStart).toBe(true);
    expect(ms[0].endingNumbers).toEqual([1, 2]);
  });

  test('reads D.C./Fine/segno/coda/To-Coda/D.S. navigation marks', () => {
    const doc = parse(
      `<measure number="1"><direction><direction-type><segno/></direction-type></direction></measure>` +
      `<measure number="2"><direction><sound tocoda="coda"/></direction></measure>` +
      `<measure number="3"><direction><sound dalsegno="segno"/></direction></measure>` +
      `<measure number="4"><direction><direction-type><coda/></direction-type></direction></measure>` +
      `<measure number="5"><direction><sound fine="yes"/></direction><direction><sound dacapo="yes"/></direction></measure>`);
    const ms = parseRepeatStructure(doc);
    expect(ms[0].segno).toBe(true);
    expect(ms[1].tocoda).toBe(true);
    expect(ms[2].dalsegno).toBe(true);
    expect(ms[3].coda).toBe(true);
    expect(ms[4].fine).toBe(true);
    expect(ms[4].dacapo).toBe(true);
  });
});
