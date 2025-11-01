const basePitches = {
  "C": 0, "C#": 1, "Db": 1,
  "D": 2, "D#": 3, "Eb": 3,
  "E": 4,
  "F": 5, "F#": 6, "Gb": 6,
  "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10,
  "B": 11
};

function midiToNoteName(midi) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const note = noteNames[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function parseNotes(noteString) {
  const notePattern = /\b([A-Ga-g](?:#|b)?)(\d*)\b/g;
  const notes = [];

  for (const match of noteString.matchAll(notePattern)) {
    const note = match[1].toUpperCase();
    const octave = match[2] ? parseInt(match[2], 10) : 4; // default to octave 4
    if (basePitches.hasOwnProperty(note)) {
      const midi = 12 * (octave + 1) + basePitches[note];
      notes.push(midi);
    }
  }
  return notes;
}

function getIntervals(notes) {
  const intervals = [];
  for (let i = 1; i < notes.length; i++) {
    intervals.push(notes[i] - notes[i - 1]);
  }
  return intervals;
}

export function extractPitchesFromText(text, { defaultOctave = (null | number) } = {}) {
  // Keys use uppercase letter + accidental exactly as produced below (accidental '#' or 'b')
  const basePitches = {
    "C": 0, "C#": 1, "Db": 1,
    "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "E#": 5, "Fb": 4,
    "F": 5, "F#": 6, "Gb": 6,
    "G": 7, "G#": 8, "Ab": 8,
    "A": 9, "A#": 10, "Bb": 10,
    "B": 11, "B#": 0, "Cb": 11
  };

  // Split into lines preserving empty lines
  const lines = text.split(/\r?\n/);
  const out = [];

  // Regex: capture letter (A-G), optional accidental (# or b), optional octave digits
  const tokenRe = /^([A-Ga-g])([#b]?)(\d*)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      // preserve blank line as empty string (you can change to [] or null if preferred)
      out.push("");
      continue;
    }

    const tokens = line.split(/\s+/);
    const linePitches = [];

    for (const tok of tokens) {
      const m = tok.match(tokenRe);
      if (!m) continue; // not a note token

      const letter = m[1].toUpperCase();    // 'D' from 'd' or 'D'
      const accidental = m[2] || "";        // '#' or 'b' or ''
      const octaveStr = m[3] || "";         // digits or ''

      const noteKey = letter + accidental;  // e.g. 'Db', 'C#', 'E', 'Cb'

      if (!(noteKey in basePitches)) {
        // not a recognized note name (shouldn't happen with valid tokens)
        continue;
      }

      const semitone = basePitches[noteKey];

      if (octaveStr) {
        const octave = parseInt(octaveStr, 10);
        if (!Number.isNaN(octave)) {
          // MIDI: C4 = 60 => midi = 12 * (octave + 1) + semitone
          linePitches.push(12 * (octave + 1) + semitone);
        }
      } else if (defaultOctave !== null) {
        // if caller wants MIDI even without octaves, use defaultOctave
        const oct = parseInt(defaultOctave, 10);
        if (!Number.isNaN(oct)) {
          linePitches.push(12 * (oct + 1) + semitone);
        } else {
          linePitches.push(semitone);
        }
      } else {
        // no octave -> push 0..11 semitone
        linePitches.push(semitone);
      }
    }

    if (linePitches.length > 0) {
      out.push(linePitches);
    } else {
      // no notes found in this line -> preserve original raw line
      out.push(rawLine);
    }
  }

  return out;
}

export function findIntervalMatches(melody, patternNotes) {
  if(typeof melody === "string") {
    melody = extractPitchesFromText(melody, { defaultOctave: 4 });
  }
  if (typeof patternNotes === 'string') {
    patternNotes = extractPitchesFromText(patternNotes, { defaultOctave: 4 });
  }
  const patternIntervals = getIntervals(patternNotes);
  const matches = [];

  for (let start = 0; start <= melody.length - 1; start++) {
    // Build a window dynamically to match the length of the pattern (including repeats)
    for (let end = start + 1; end <= melody.length; end++) {
      const window = melody.slice(start, end);
      const windowIntervals = getIntervals(window);

      // Check repeated notes: compare only the **first n-1 intervals** with patternIntervals
      // Allow repeated notes (interval=0) in window
      let patternIdx = 0;
      for (let i = 0; i < windowIntervals.length && patternIdx < patternIntervals.length; i++) {
        if (windowIntervals[i] === patternIntervals[patternIdx]) {
          patternIdx++;
        } else if (windowIntervals[i] === 0) {
          // repeated note in melody, skip interval
          continue;
        } else {
          // mismatch
          patternIdx = -1;
          break;
        }
      }

      if (patternIdx === patternIntervals.length) {
        matches.push({
          start,
          notes: window,
          noteNames: window.map(midiToNoteName),
          transposition: window[0] - patternNotes[0],
        });
        break; // no need to extend window further
      }
    }
  }

  return matches;
}

export function highlightMatchesInText(text, matches) {
  // Split text into tokens (keep spacing)
  const tokens = text.trim().split(/\s+/);

  // Clone tokens for highlighting
  const highlighted = [...tokens];

  for (const match of matches) {
    const matchLength = match.noteNames.length;
    const start = match.start;

    // Wrap each note in brackets or a highlight marker
    for (let i = 0; i < matchLength; i++) {
      const idx = start + i;
      if (idx < highlighted.length) {
        highlighted[idx] = `<span style="background:yellow">${highlighted[idx]}</span>`;
      }
    }
  }

  return highlighted.join(" ");
}

