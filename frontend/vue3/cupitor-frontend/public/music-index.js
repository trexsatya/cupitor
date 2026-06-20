// public/music-index.js
import { primaryVoice, packContour } from './music-encoding.js';

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

function channelsOf(doc) {
  const v = primaryVoice(doc);
  const present = ['pitch', 'interval', 'sargam'];
  if (v.duration.some(d => d !== null)) present.push('duration');
  if (v.chordSymbol.some(c => c !== null)) present.push('chordSymbol');
  if (v.lyric.some(l => l !== null)) present.push('lyric');
  return present;
}

const PC_NAMES = ["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"];

export function buildIndexEntry(doc, source) {
  const v = primaryVoice(doc);
  const noteCount = doc.voices.reduce((n, vv) => n + vv.pitch.length, 0);
  const chords = [];
  doc.voices.forEach(vv => vv.chordSymbol.forEach(c => { if (c && chords[chords.length - 1] !== c) chords.push(c); }));
  return {
    id: doc.meta.id,
    title: doc.meta.title,
    system: doc.meta.system,
    format: doc.meta.format,
    sourceUrl: doc.meta.sourceUrl,
    youtube: doc.meta.youtube,
    key: doc.meta.key,
    time: doc.meta.time,
    tempo: doc.meta.tempo,
    instrument: doc.meta.instrument,
    voiceCount: doc.voices.length,
    noteCount,
    channels: channelsOf(doc),
    search: {
      contour: packContour(v.interval),
      pitchClasses: v.pitch.map(m => PC_NAMES[((m % 12) + 12) % 12]).join(' '),
      sargam: v.sargam.filter(Boolean).join(' '),
      chords: chords.join(' ')
    },
    detailPath: `details/${doc.meta.id}.json`,
    contentHash: fnv1a(source),
    updatedAt: null   // stamped by the caller (Date is unavailable in some contexts)
  };
}

export function splitTiers(doc, source) {
  const entry = buildIndexEntry(doc, source);
  const detail = { meta: doc.meta, voices: doc.voices, format: doc.meta.format, source };
  return { entry, detail };
}

export function getSystemFromUrl(href) {
  const url = new URL(href || (typeof window !== 'undefined' ? window.location.href : 'https://x/'));
  let value = new URLSearchParams(url.search).get('system');
  if (value !== 'sargam') value = 'western';   // default western, mirrors lang default 'swedish'
  return { name: value };
}

export function getMusicResourceUrl(system) {
  const name = system || getSystemFromUrl().name;
  return `https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/${name}`;
}
