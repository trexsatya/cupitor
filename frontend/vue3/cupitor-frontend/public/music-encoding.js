// public/music-encoding.js
import { getScale } from './music-reference-data.js';

const BASE_PC = {
  "C":0,"C#":1,"Db":1,"D":2,"D#":3,"Eb":3,"E":4,"E#":5,"Fb":4,
  "F":5,"F#":6,"Gb":6,"G":7,"G#":8,"Ab":8,"A":9,"A#":10,"Bb":10,
  "B":11,"B#":0,"Cb":11
};

const SARGAM = ["Sa","Re","Ga","Ma","Pa","Dha","Ni"];

export function pitchClass(name) {
  return BASE_PC[name];
}

export function nameToMidi(name, octave) {
  const pc = BASE_PC[name];
  if (pc === undefined || octave === undefined || octave === '' || Number.isNaN(octave)) return null;
  return 12 * (parseInt(octave, 10) + 1) + pc;
}

export function intervalsOf(pitches) {
  const out = [];
  for (let i = 1; i < pitches.length; i++) out.push(pitches[i] - pitches[i - 1]);
  return out;
}

export function toSargam(name, keyName) {
  const pc = BASE_PC[name];
  if (pc === undefined) return null;
  const scale = getScale(keyName);            // e.g. ["C","D","E","F","G","A","B"]
  const idx = scale.findIndex(n => BASE_PC[n] === pc);
  return idx === -1 ? null : SARGAM[idx];
}
