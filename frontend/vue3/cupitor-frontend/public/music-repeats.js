// public/music-repeats.js
//
// Turn a MusicXML score's repeat notation into the actual PLAY ORDER of measures, so playback follows
// the written form. Handles: forward/backward repeat barlines (:||) with counts, 1st/2nd/Nth endings
// (voltas), and the jump marks D.C. (da capo), D.S. (dal segno), To Coda / Coda, Fine, Segno.
//
// Two pure functions: parseRepeatStructure(doc) reads the per-measure markup; expandRepeats(measures)
// unrolls it into a list of measure indices. DOM in, plain data out — unit-tested in jsdom.

// Per-measure repeat metadata from the FIRST part (barlines/marks are mirrored across parts).
export function parseRepeatStructure(doc) {
  const part = doc && doc.querySelector('part');
  if (!part) return [];
  const measures = [...part.children].filter((c) => c.tagName === 'measure');
  return measures.map((m) => {
    const meta = {
      startRepeat: false, endRepeat: false, endRepeatTimes: 2,
      endingStart: false, endingNumbers: [], endingStop: false,
      segno: false, coda: false, dacapo: false, dalsegno: false, tocoda: false, fine: false,
    };
    m.querySelectorAll('barline').forEach((b) => {
      const rep = b.querySelector('repeat');
      if (rep) {
        const dir = rep.getAttribute('direction');
        if (dir === 'forward') meta.startRepeat = true;
        if (dir === 'backward') {
          meta.endRepeat = true;
          const t = parseInt(rep.getAttribute('times'), 10);
          if (t > 1) meta.endRepeatTimes = t;
        }
      }
      const end = b.querySelector('ending');
      if (end) {
        const type = end.getAttribute('type');
        if (type === 'start') {
          meta.endingStart = true;
          meta.endingNumbers = (end.getAttribute('number') || '')
            .split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
        } else if (type === 'stop' || type === 'discontinue') {
          meta.endingStop = true;
        }
      }
    });
    if (m.querySelector('segno')) meta.segno = true;
    if (m.querySelector('coda')) meta.coda = true;
    m.querySelectorAll('sound').forEach((s) => {
      if (s.getAttribute('dacapo') === 'yes') meta.dacapo = true;
      if (s.getAttribute('dalsegno')) meta.dalsegno = true;
      if (s.getAttribute('tocoda')) meta.tocoda = true;
      if (s.getAttribute('fine') === 'yes') meta.fine = true;
      if (s.getAttribute('segno')) meta.segno = true;
      if (s.getAttribute('coda')) meta.coda = true;
    });
    return meta;
  });
}

// Unroll the measures into the order they're actually played. `measures` is the array from
// parseRepeatStructure (or any array of the same shape). Returns 0-based measure indices.
//
// Model: a linear walk with two phases. In the STRUCTURAL phase repeat barlines loop the span and
// voltas pick the ending that matches the current pass. A D.C./D.S. flips into the JUMP phase, where
// repeats/voltas are no longer taken and Fine / To-Coda become active (the standard convention).
export function expandRepeats(measures) {
  const n = measures ? measures.length : 0;
  if (!n) return [];
  const order = [];
  const segnoIdx = measures.findIndex((m) => m.segno);
  const codaIdx = measures.findIndex((m) => m.coda);
  const endCount = {};             // backward-repeat index → times already taken
  let i = 0, repeatStart = 0, pass = 1, jumped = false, guard = 0;

  while (i < n && guard++ < 100000) {
    const m = measures[i];
    if (!jumped && m.startRepeat && i !== repeatStart) { repeatStart = i; pass = 1; }

    // Volta: during the structural phase, skip an ending that doesn't match the current pass.
    if (!jumped && m.endingStart && m.endingNumbers.length && !m.endingNumbers.includes(pass)) {
      let j = i + 1;
      while (j < n && !measures[j].endingStart) j++;
      if (j < n) { i = j; continue; }   // jump to the next ending and re-check
    }

    order.push(i);

    if (jumped && m.fine) break;                                   // D.C./D.S. al Fine → stop here
    if (jumped && m.tocoda && codaIdx >= 0) { i = codaIdx; continue; }   // …al Coda → jump to the coda

    if (!jumped && m.endRepeat) {
      const played = (endCount[i] || 0) + 1;
      if (played < m.endRepeatTimes) { endCount[i] = played; i = repeatStart; pass = played + 1; continue; }
    }
    if (!jumped && (m.dacapo || m.dalsegno)) {                     // enter the jump phase
      jumped = true; pass = 1;
      i = m.dalsegno ? (segnoIdx >= 0 ? segnoIdx : 0) : 0;
      continue;
    }
    i++;
  }
  return order;
}
