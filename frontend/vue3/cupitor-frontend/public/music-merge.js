// public/music-merge.js
//
// Merge several MusicXML <part>s into ONE single-staff part, so a multi-instrument arrangement can be
// read (and played / chord-analysed / fretboard-captured) as a single combined line. Each source part
// keeps its own rhythm by becoming a distinct VOICE on the shared staff (separated by <backup>), rather
// than being force-stacked into chords.
//
// The merge is done in concert pitch: each part's <transpose> (e.g. a Bb trumpet, an octave-down bass)
// is folded into its notes so every merged pitch sounds and reads consistently, and the transpose is
// dropped. Differing <divisions> are unified to their LCM (durations rescaled) so onsets line up. The
// combined staff gets a single clef auto-picked from the merged pitch range.
//
// DOMParser + XMLSerializer only — no app coupling — so it unit-tests in jsdom and the caller can swap
// the source and re-render (sheet, playback, chord detection, fretboard all follow), exactly like the
// transpose flow.

import { STEP_PC, SHARP, FLAT, PC_KEY } from './music-transpose.js';

function parseXml(xml) {
  let doc;
  try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch (_) { return null; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return null;
  return doc;
}
const childrenTagged = (el, tag) => [...el.children].filter((c) => c.tagName === tag);
const intOf = (el, def = 0) => (el ? (parseInt(el.textContent, 10) || 0) : def);
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }

// Written→sounding shift in semitones from a part's <transpose> (chromatic steps + whole octaves).
function partSemitones(partEl) {
  const t = partEl.querySelector('transpose');
  if (!t) return 0;
  return intOf(t.querySelector('chromatic')) + 12 * intOf(t.querySelector('octave-change'));
}
// A part's notating divisions-per-quarter (first <divisions>; MusicXML default 1).
function partDivisions(partEl) {
  const d = partEl.querySelector('divisions');
  return d ? (parseInt(d.textContent, 10) || 1) : 1;
}

// Rewrite a <pitch> to concert pitch (shift by `semis`) respelled with `table` (sharp/flat spelling).
function toConcert(pitchEl, semis, table, doc) {
  const stepEl = pitchEl.querySelector('step');
  const octEl = pitchEl.querySelector('octave');
  if (!stepEl || !octEl) return;
  const alterEl = pitchEl.querySelector('alter');
  const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
  const oct = parseInt(octEl.textContent, 10);
  const midi = 12 * (oct + 1) + (STEP_PC[stepEl.textContent.trim()] || 0) + alter + semis;
  const pc = ((midi % 12) + 12) % 12;
  const [ns, na] = table[pc];
  stepEl.textContent = ns;
  octEl.textContent = String(Math.floor(midi / 12) - 1);
  if (na === 0) { if (alterEl) alterEl.remove(); }
  else if (alterEl) { alterEl.textContent = String(na); }
  else { const a = doc.createElement('alter'); a.textContent = String(na); pitchEl.insertBefore(a, octEl); }
}

// Concert MIDI of a written <pitch> under a semitone shift (for range/clef decisions).
function concertMidi(pitchEl, semis) {
  const stepEl = pitchEl.querySelector('step');
  const octEl = pitchEl.querySelector('octave');
  if (!stepEl || !octEl) return null;
  const alter = intOf(pitchEl.querySelector('alter'));
  return 12 * (parseInt(octEl.textContent, 10) + 1) + (STEP_PC[stepEl.textContent.trim()] || 0) + alter + semis;
}

// Whole-octave shift (multiple of 12 semitones) that best drops a part's notes into [lo, hi], keeping the
// part's internal contour. Picks the octave with the most notes inside the range; ties → smallest move.
function octaveShiftToFit(midis, lo, hi) {
  if (!midis.length) return 0;
  let best = 0, bestIn = -1;
  for (let k = -5; k <= 5; k++) {
    const inRange = midis.reduce((n, m) => n + ((m + 12 * k) >= lo && (m + 12 * k) <= hi ? 1 : 0), 0);
    if (inRange > bestIn || (inRange === bestIn && Math.abs(k) < Math.abs(best))) { bestIn = inRange; best = k; }
  }
  return best * 12;
}

// Net time the measure's cursor advances (notes + forwards − backups; chord/grace notes don't advance).
function measureNet(measureEl) {
  let cur = 0;
  for (const el of measureEl.children) {
    if (el.tagName === 'note') {
      if (el.querySelector('chord') || el.querySelector('grace')) continue;
      cur += intOf(el.querySelector('duration'));
    } else if (el.tagName === 'forward') {
      cur += intOf(el.querySelector('duration'));
    } else if (el.tagName === 'backup') {
      cur -= intOf(el.querySelector('duration'));
    }
  }
  return cur;
}

// The parts of a score, as { id, name, unpitched }. `unpitched` flags drum/percussion parts (they can't
// live on a pitched staff) so the UI can leave them out of the merge picker.
export function listParts(xml) {
  const doc = parseXml(xml);
  if (!doc) return [];
  const byId = {};
  doc.querySelectorAll('part').forEach((p) => { byId[p.getAttribute('id')] = p; });
  return [...doc.querySelectorAll('part-list > score-part')].map((sp) => {
    const id = sp.getAttribute('id');
    const nameEl = sp.querySelector('part-name');
    const name = nameEl && nameEl.textContent.trim() ? nameEl.textContent.trim() : id;
    const pEl = byId[id];
    const unpitched = !!pEl && !!pEl.querySelector('unpitched') && !pEl.querySelector('pitch');
    return { id, name, unpitched };
  });
}

// Merge the parts named in `partIds` into one single-staff, concert-pitch part; other parts are left
// as-is. Returns a new MusicXML string, or the input unchanged when fewer than two of the ids resolve.
export function mergeParts(xml, partIds, opts = {}) {
  if (!xml || typeof xml !== 'string' || !Array.isArray(partIds) || partIds.length < 2) return xml;
  const doc = parseXml(xml);
  if (!doc) return xml;

  const allParts = [...doc.querySelectorAll('part')];
  const idSet = new Set(partIds);
  const selected = allParts.filter((p) => idSet.has(p.getAttribute('id')));   // document order
  if (selected.length < 2) return xml;

  const div = selected.map(partDivisions);
  const semis = selected.map(partSemitones);            // written→concert (transpose)
  const D = div.reduce((acc, d) => lcm(acc, d), 1);

  // Optional: fold each part into a target range (e.g. a guitar's E2–E5) by whole octaves, after concert
  // conversion, so the combined staff is playable/readable. `shift[i]` is each part's total semitone move.
  const perPartMidis = selected.map((pEl, i) => {
    const arr = [];
    pEl.querySelectorAll('note > pitch').forEach((pit) => { const m = concertMidi(pit, semis[i]); if (m != null) arr.push(m); });
    return arr;
  });
  const fit = (opts.fitRange && Number.isFinite(opts.fitRange.lo) && Number.isFinite(opts.fitRange.hi)) ? opts.fitRange : null;
  const octShift = selected.map((_, i) => (fit ? octaveShiftToFit(perPartMidis[i], fit.lo, fit.hi) : 0));
  const shift = selected.map((_, i) => semis[i] + octShift[i]);

  // Spelling + key signature: concert key of the FIRST selected part.
  const writtenFifths = intOf(selected[0].querySelector('fifths'));
  const writtenTonicPc = (((writtenFifths * 7) % 12) + 12) % 12;
  const concertTonicPc = (((writtenTonicPc + semis[0]) % 12) + 12) % 12;
  const spec = PC_KEY[concertTonicPc] || PC_KEY[0];
  const table = spec.sharp ? SHARP : FLAT;

  // Time signature from the first selected part (mid-piece meter changes aren't tracked in v1).
  const timeEl = selected[0].querySelector('time');
  const beats = timeEl ? intOf(timeEl.querySelector('beats'), 4) : 4;
  const beatType = timeEl ? intOf(timeEl.querySelector('beat-type'), 4) : 4;

  // Clef: guitar convention when fitting to a range — a treble clef sounding an octave down (treble-8),
  // so the guitar's E2–E5 sounding range sits ON the staff instead of hanging below a plain treble clef
  // (bottom line E4). Otherwise pick treble/bass from the merged range median, no octave shift.
  let clefSign, clefLine, clefOctave = 0;
  if (fit) {
    [clefSign, clefLine, clefOctave] = ['G', 2, -1];
  } else {
    const midis = perPartMidis.flat().sort((a, b) => a - b);
    const median = midis.length ? midis[Math.floor(midis.length / 2)] : 71;
    [clefSign, clefLine] = median < 57 ? ['F', 4] : ['G', 2];
  }

  // Distinct new voice number per (part, original-voice) pair.
  const voiceMap = new Map();
  let vCounter = 0;
  const voiceFor = (pIdx, ov) => {
    const key = pIdx + ':' + ov;
    if (!voiceMap.has(key)) voiceMap.set(key, ++vCounter);
    return voiceMap.get(key);
  };

  const measuresOf = (pEl) => childrenTagged(pEl, 'measure');
  const totalMeasures = Math.max(...selected.map((p) => measuresOf(p).length));

  function buildAttributes() {
    const a = doc.createElement('attributes');
    const dv = doc.createElement('divisions'); dv.textContent = String(D); a.appendChild(dv);
    const k = doc.createElement('key'); const f = doc.createElement('fifths'); f.textContent = String(spec.fifths); k.appendChild(f); a.appendChild(k);
    const tm = doc.createElement('time');
    const bts = doc.createElement('beats'); bts.textContent = String(beats);
    const bt = doc.createElement('beat-type'); bt.textContent = String(beatType);
    tm.appendChild(bts); tm.appendChild(bt); a.appendChild(tm);
    const cl = doc.createElement('clef');
    const sg = doc.createElement('sign'); sg.textContent = clefSign;
    const ln = doc.createElement('line'); ln.textContent = String(clefLine);
    cl.appendChild(sg); cl.appendChild(ln);
    if (clefOctave) { const oc = doc.createElement('clef-octave-change'); oc.textContent = String(clefOctave); cl.appendChild(oc); }
    a.appendChild(cl);
    return a;
  }

  // Elements that would duplicate across voices — keep only from the first contributing part.
  const DEDUPE = new Set(['direction', 'harmony', 'barline', 'sound', 'grouping', 'print']);

  const mergedPart = doc.createElement('part');
  mergedPart.setAttribute('id', 'PMERGED');

  for (let i = 0; i < totalMeasures; i++) {
    const contributing = selected
      .map((pEl, idx) => ({ idx, meas: measuresOf(pEl)[i] }))
      .filter((c) => c.meas);
    const mMeas = doc.createElement('measure');
    const numAttr = contributing[0] && contributing[0].meas.getAttribute('number');
    mMeas.setAttribute('number', numAttr || String(i + 1));
    if (i === 0) mMeas.appendChild(buildAttributes());

    contributing.forEach((c, ci) => {
      const factor = D / div[c.idx];
      const net = measureNet(c.meas) * factor;                       // before rescaling (original units)
      const first = ci === 0;
      [...c.meas.children].forEach((child) => {
        const tag = child.tagName;
        if (tag === 'attributes') return;                            // synthesized once, above
        if (!first && DEDUPE.has(tag)) return;                       // avoid duplicate directions/harmony/barlines
        if (first && tag === 'print') return;                        // drop layout — OSMD relays out
        if (tag === 'note' || tag === 'forward' || tag === 'backup') {
          const d = child.querySelector('duration');
          if (d) d.textContent = String(intOf(d) * factor);
        }
        if (tag === 'note') {
          const v = child.querySelector('voice');
          const ov = v ? v.textContent.trim() : '1';
          const nv = voiceFor(c.idx, ov);
          if (v) v.textContent = String(nv);
          else { const nv2 = doc.createElement('voice'); nv2.textContent = String(nv); child.appendChild(nv2); }
          const st = child.querySelector('staff'); if (st) st.remove();     // single staff
          const pit = child.querySelector('pitch'); if (pit) toConcert(pit, shift[c.idx], table, doc);
          const acc = child.querySelector('accidental'); if (acc) acc.remove();   // OSMD redraws from pitch+key
        }
        mMeas.appendChild(child);                                    // moves the node out of the old measure
      });
      if (ci < contributing.length - 1 && net > 0) {                 // rewind to the barline for the next voice
        const b = doc.createElement('backup');
        const bd = doc.createElement('duration'); bd.textContent = String(net);
        b.appendChild(bd); mMeas.appendChild(b);
      }
    });
    mergedPart.appendChild(mMeas);
  }

  // Splice into the score: merged part replaces the first selected part's position; drop the rest.
  const firstSel = selected[0];
  firstSel.parentNode.insertBefore(mergedPart, firstSel);
  selected.forEach((p) => p.remove());

  // Rebuild the part-list the same way.
  const partList = doc.querySelector('part-list');
  if (partList) {
    const scoreParts = [...partList.querySelectorAll('score-part')];
    const selScoreParts = scoreParts.filter((sp) => idSet.has(sp.getAttribute('id')));
    if (selScoreParts.length) {
      const merged = doc.createElement('score-part');
      merged.setAttribute('id', 'PMERGED');
      const nm = doc.createElement('part-name'); nm.textContent = opts.name || 'Combined';
      merged.appendChild(nm);
      partList.insertBefore(merged, selScoreParts[0]);
      selScoreParts.forEach((sp) => sp.remove());
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

// ── explodeStaves ──────────────────────────────────────────────────────────────────────────────
// A solo-piano piece is ONE <part> spread across two staves (right hand / left hand), so the Combine
// picker — which merges separate <part>s — has nothing to grab. explodeStaves rewrites every multi-staff
// part into one single-staff <part> per staff, so the piece then looks like a multi-part score and can be
// combined (and guitar-fitted) with the existing mergeParts. A piece with no multi-staff part is returned
// unchanged. Pure DOM in / string out, like the rest of this module.

// The staff numbers a part actually uses: the declared <staves> count, unioned with any <staff> on a note.
function staffNumbersOf(partEl) {
  const set = new Set();
  partEl.querySelectorAll('note > staff').forEach((s) => { const n = parseInt(s.textContent, 10); if (n > 0) set.add(n); });
  const stavesEl = partEl.querySelector('attributes > staves') || partEl.querySelector('staves');
  const declared = stavesEl ? (parseInt(stavesEl.textContent, 10) || 0) : 0;
  for (let k = 1; k <= declared; k++) set.add(k);
  return [...set].sort((a, b) => a - b);
}

const staffLabels = (base, count) => (count === 2
  ? [`${base} — Right hand`, `${base} — Left hand`]
  : Array.from({ length: count }, (_, i) => `${base} — staff ${i + 1}`));

const durElem = (doc, tag, d) => {
  const e = doc.createElement(tag); const dd = doc.createElement('duration'); dd.textContent = String(d); e.appendChild(dd); return e;
};

// One staff's <attributes>: single-staff (drop <staves>), keeping only this staff's clef and stripping any
// per-staff `number` attribute from key/time/clef.
function staffAttributes(doc, attrEl, k) {
  const na = doc.createElement('attributes');
  [...attrEl.children].forEach((c) => {
    if (c.tagName === 'staves') return;
    if (c.tagName === 'clef') {
      const num = c.getAttribute('number');
      if (num != null && parseInt(num, 10) !== k) return;      // keep only this staff's clef
    }
    const cc = c.cloneNode(true);
    if (cc.getAttribute && cc.getAttribute('number') != null) cc.removeAttribute('number');
    na.appendChild(cc);
  });
  return na;
}

// Rebuild one staff's version of a measure: its attributes (filtered), the score-wide extras (only for the
// first staff, so repeats/directions survive without duplicating), then this staff's notes placed at their
// simulated onsets — resolving the cross-staff <backup>/<forward> into plain gaps.
const STAFF_EXTRAS = new Set(['direction', 'harmony', 'barline', 'print', 'sound', 'grouping']);
function rebuildStaffMeasure(doc, meas, k, isFirstStaff, out, defaultStaff) {
  const attrEl = childrenTagged(meas, 'attributes')[0];
  if (attrEl) out.appendChild(staffAttributes(doc, attrEl, k));
  if (isFirstStaff) [...meas.children].forEach((c) => { if (STAFF_EXTRAS.has(c.tagName)) out.appendChild(c.cloneNode(true)); });

  // Simulate the measure timeline to give every note an onset, then collect the ones on staff k.
  let pos = 0, lastStart = 0;
  const items = [];
  const staffOf = (n) => { const s = n.querySelector('staff'); return s ? (parseInt(s.textContent, 10) || defaultStaff) : defaultStaff; };
  [...meas.children].forEach((c) => {
    if (c.tagName === 'note') {
      const isChord = !!c.querySelector('chord');
      const isGrace = !!c.querySelector('grace');
      const dur = isGrace ? 0 : intOf(c.querySelector('duration'));
      const onset = isChord ? lastStart : pos;
      if (staffOf(c) === k) items.push({ onset, isChord, dur, node: c });
      if (!isChord && !isGrace) { lastStart = onset; pos += dur; }
    } else if (c.tagName === 'backup') { pos -= intOf(c.querySelector('duration')); }
    else if (c.tagName === 'forward') { pos += intOf(c.querySelector('duration')); }
  });

  let cur = 0;
  items.forEach(({ onset, isChord, dur, node }) => {
    const clone = node.cloneNode(true);
    const st = clone.querySelector('staff'); if (st) st.remove();               // single staff now
    if (!isChord) {
      const gap = onset - cur;
      if (gap > 0) out.appendChild(durElem(doc, 'forward', gap));
      else if (gap < 0) out.appendChild(durElem(doc, 'backup', -gap));
      cur = onset + dur;
    }
    out.appendChild(clone);                                                     // chord notes ride the principal's onset
  });
}

export function explodeStaves(xml) {
  if (!xml || typeof xml !== 'string') return xml;
  const doc = parseXml(xml);
  if (!doc) return xml;

  const partList = doc.querySelector('part-list');
  const scorePartById = {};
  if (partList) partList.querySelectorAll('score-part').forEach((sp) => { scorePartById[sp.getAttribute('id')] = sp; });

  let changed = false;
  [...doc.querySelectorAll('part')].forEach((partEl) => {
    const id = partEl.getAttribute('id');
    const staffNums = staffNumbersOf(partEl);
    if (staffNums.length < 2) return;                                           // already single-staff
    changed = true;
    const defaultStaff = staffNums[0];
    const measures = childrenTagged(partEl, 'measure');

    const newParts = staffNums.map((k) => {
      const np = doc.createElement('part'); np.setAttribute('id', `${id}_s${k}`); return np;
    });
    measures.forEach((meas) => {
      staffNums.forEach((k, ki) => {
        const pm = doc.createElement('measure');
        const numAttr = meas.getAttribute('number'); if (numAttr != null) pm.setAttribute('number', numAttr);
        rebuildStaffMeasure(doc, meas, k, ki === 0, pm, defaultStaff);
        newParts[ki].appendChild(pm);
      });
    });
    newParts.forEach((np) => partEl.parentNode.insertBefore(np, partEl));
    partEl.remove();

    const sp = scorePartById[id];
    if (sp && partList) {
      const nmEl = sp.querySelector('part-name');
      const base = (nmEl && nmEl.textContent.trim()) || id;
      const labels = staffLabels(base, staffNums.length);
      staffNums.forEach((k, ki) => {
        const nsp = doc.createElement('score-part'); nsp.setAttribute('id', `${id}_s${k}`);
        const nm = doc.createElement('part-name'); nm.textContent = labels[ki]; nsp.appendChild(nm);
        partList.insertBefore(nsp, sp);
      });
      sp.remove();
    }
  });

  return changed ? new XMLSerializer().serializeToString(doc) : xml;
}

// ── shiftOctaves ───────────────────────────────────────────────────────────────────────────────
// Move EVERY note by `octaves` whole octaves (may be negative). Used by the combined view's octave nudge:
// a two-hand piano piece folded onto one guitar staff sits low (its bass is the guitar's low register,
// notated on ledger lines below the treble staff), and transposing down drops it further. Where the whole
// arrangement should sit is a readability-vs-playability judgement, so the user places it by whole octaves.
// Octave-only, so pitch classes / spelling / key signature are untouched.
export function shiftOctaves(xml, octaves) {
  if (!xml || typeof xml !== 'string' || !octaves) return xml;
  const doc = parseXml(xml);
  if (!doc) return xml;
  doc.querySelectorAll('note > pitch > octave').forEach((o) => { o.textContent = String((parseInt(o.textContent, 10) || 0) + octaves); });
  return new XMLSerializer().serializeToString(doc);
}
