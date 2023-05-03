let evalSharpsFlats = x => {
  x = "" + x
  if (x.length <= 2) return x;
  if (x.endsWith("#b")) return x.replaceAll("#b", "")
  if (x.endsWith("b#")) return x.replaceAll("b#", "")
  return x
}

let roundAt = (lim, x) => x === lim ? x : x % lim;

let pattern = nums => {
  nums = nums.map(it => '' + it).map(it => it.split(''))
  return notesInScale => nums.map(xx => evalSharpsFlats(notesInScale[roundAt(7, xx[0] - 1)] + (xx[1] || ''))).filter(x => x);
}

let chordPatterns = {
  'maj': pattern([1, 3, 5]),
  // 'maj(-5)': pattern([1, 3]),
  'min': pattern([1, '3b', 5]),
  // 'min(-5)': pattern([1, '3b']),
  'aug': pattern([1, 3, '5#']),
  'dim': pattern([1, '3b', '5b']),
  'dim7': pattern([1, '3b', '5b', 6]),
  // 'sus4': pattern([1, 4, 5]),
  '+9': pattern([1, 3, 5, 9]),
  // 'min+9': pattern([1, '3b', 5, 9]),
  // '5': pattern([1, 5]),
  // '6': pattern([1, 3, 5, 6]),
  'min6': pattern([1, '3b', 5, 6]),
  // '6+9': pattern([1, 3, 5, 6, 9]),
  // 'min6+9': pattern([1, '3b', 5, 6, 9]),
  '7': pattern([1, '3', '5','7b']), //a.k.a majMin7 a.k.a. dom7
  'maj7': pattern([1, '3', '5', 7]),
  'min7': pattern([1, '3b', '5','7b']),
  'minMaj7': pattern([1, '3b', '5',7]),
  // '7Sus4': pattern([1, '4', '5', '7b']),
  // '9': pattern([1, 3, 5, '7b', 9]),
  // 'maj9': pattern([1, 3, 5, 7, 9]),
  // 'min9': pattern([1, '3b', 5, '7b', 9])
}

const romanHash = {
  'I': 1,
  'II': 2,
  'III': 3,
  'IV': 4,
  'V': 5,
  'VI': 6,
  'VII': 7
};

function romanToInt(s) {
  return romanHash[s.toUpperCase()]
}

let Rhythms = [
//  Level-1
  [
    ['1'],
    ['1/2', '1/2'],
    ['1/2', '1/4', '1/4'],
    ['3/4', '1/4']
  ].map(it => permutate(it)).flat().filter(uniqueByJsonRepresentation),

//  Level-2
  [
    ['3/8', '1/8', '1/2']
  ],
//  Level-3
  [
    ['3/8', '1/8', '1/4', '1/4'],
    ['3/8', '1/8', '1/4', '1/8', '1/8'],
    ['3/8', '1/8', '3/4', '1/8']
  ].map(it => permutate(it)).flat().filter(uniqueByJsonRepresentation),
//  Level-4
  [
    ['1/4', '1/4', '1/8', '1/8', '1/8', '1/8'],
    ['1/2', '1/8', '1/8', '1/8', '1/8'],
    ['1/4', '1/8', '1/8', '1/4', '1/4']
  ].map(it => permutate(it)).flat().filter(uniqueByJsonRepresentation)
]

let DURATION_TO_NAME = {
  '1': 'whole',
  '1/2': 'half',
  '1/4': 'quarter',
  '1/8': 'eighth',
  '1/16': '16th',
  '3/4': 'dotted-half',
  '3/8': 'dotted-quarter',
  '3/2': 'dotted-whole',
  '3/16': 'dotted-eighth'
}

let DURATION_TO_SYLLABLE = {
  '16th': 'b',
  'eighth': 'ba',
  'quarter': 'bum',
  'dotted-eighth': 'ba-m',
  'dotted-quarter': 'bum-m',
  'half': 'bu-u-um',
  'dotted-half': 'bu-u-u-um',
  'whole': 'bu-u-u-u-m',
  'dotted-whole': 'bu-u-u-u-u-m'
}

function durationTypeToNumber(type) {
  return number(Object.keys(DURATION_TO_NAME).find(it => DURATION_TO_NAME[it] === type))
}

function durationType(numericForm) {
  let k = Object.keys(DURATION_TO_NAME).find(it => number(it) === number(numericForm))
  return DURATION_TO_NAME[k]
}

let majorScales = {
  'G': 'G - A - B - C - D - E - F#',
  'Gb': 'Gb - Ab - Bb - Cb - Db - Eb - F',
  'G#': 'G# - A# - B# - C# - D# - E# - F#',
  'F': 'F - G - A - Bb - C - D - E',
  'F#': 'F# - G# - A# - B - C# - D# - E#',
  'E': 'E - F# - G# - A - B - C# - D#',
  'Eb': 'Eb - F - G - Ab - Bb - C - D',
  'D': 'D - E - F# - G - A - B - C#',
  'Db': 'Db - Eb - F - Gb - Ab - Bb - C',
  'D#': 'D# - E# - F# - G# - A# - B# - C#',
  'C': 'C - D - E - F - G - A - B',
  'C#': 'C# - D# - E# - F# - G# - A# - B#',
  'B': 'B - C# - D# - E - F# - G# - A#',
  'Bb': 'Bb - C - D - Eb - F - G - A',
  'A': 'A - B - C# - D - E - F# - G#',
  'Ab': 'Ab - Bb - C - Db - Eb - F - G',
  'A#': 'A# - B# - C# - D# - E# - F# - G#',
};

let minorScales = {
  'C': 'C - D - Eb - F - G - Ab - Bb',
  'C#': 'C# - D# - E - F# - G# - A - B',
  'D': 'D - E - F - G - A - Bb - C',
  'Db': 'Db - Eb - Fb - Gb - Ab - Bb - Cb',
  'D#': 'D# - E# - F# - G# - A# - B - C#',
  'E': 'E - F# - G - A - B - C - D',
  'Eb': 'Eb - F - Gb - Ab - Bb - Cb - Db',
  'F': 'F - G - Ab - Bb - C - Db - Eb',
  'F#': 'F# - G# - A - B - C# - D - E',
  'G': 'G - A - Bb - C - D - Eb - F',
  'Gb': 'Gb - Ab - bb - Cb - Db - Eb - Fb',
  'G#': 'G# - A# - B - C# - D# - E - F#',
  'A': 'A - B - C - D - E - F - G',
  'Ab': 'Ab - Bb - Cb - Db - Eb - Fb - Gb',
  'A#': 'A# - B# - C# - D# - E# - F# - G#',
  'B': 'B - C# - D - E - F# - G - A',
  'Bb': 'Bb - C - Db - Eb - F - Gb - Ab'
}

let notesInScale = (scales, k) => scales[k].split(' - ');

let Cadences = {
  Half: 0,
  IAC: 1,
  PAC: 2,
  Plagal: 3,
  Deceptive: 4
}

/**
 * Are enharmonically equal
 */
let equalNotes = (x, y) => {
  if (x === y) return true;
  return [['A#', 'Bb'], ['B', 'Cb'], ['B#', 'C'], ['C#', 'Db'], ['D#', 'Eb'], ['E', 'Fb'], ['E#', 'F'], ['F#', 'Gb'], ['G#', 'Ab']].find(it => it.includes(x) && it.includes(y))
}

function getScale(key) {
  key = key.replaceAll("\n", "").replaceAll(" ", "")
  let scale = null
  if (key.endsWith("m")) {
    scale = minorScales[key.replace("m", "")]
  } else {
    scale = majorScales[key]
  }
  scale = scale.split(' - ').map(it => it.trim())
  return scale;
}

let majorChordProgressions = {
  "Primary": [{
    data: 'I-IV-V-I'
  }],
  "Popular": [{
    data: 'I-V-vi-iii-IV-I-IV-V'
  }]
}

let minorChordProgressions = {
  "Primary": [{
    data: 'i-iv-v-i'
  }],
  "Popular": [{
    data: 'i-iv-i-V7-i'
  }, {
    data: 'vi-ii-V-V7-I'
  }, {
    data: 'i-iv-Vsus-V7-i'
  }, {
    data: 'i-ii-i-V7-i'
  }]
}

let getTritoneNote = (note) => {
  let {cc1, cc2} = chromaticScales();

  let nIdx = cc1.goTo(note);
  let found = nIdx >= 0 && cc1.next(6)
  if(!found) {
    cc2.goTo(note)
    found = cc2.next(6)
  }
  return found
}


let allChords = {}
Object.keys(majorScales).forEach(k => {
  Object.keys(chordPatterns).forEach(cpk => {
    allChords[k + cpk] = {
      root: k,
      notes: chordPatterns[cpk](getScale(k))
    }
  })
})

function normaliseChordName(name) {
 return name.replaceAll("maj7", "M7").replaceAll("maj", "").replaceAll("dim", "o").replaceAll("min", "m").replaceAll("aug", "+")
}

function deNormaliseChordName(name) {
  if(!["M7", "o", "m", "+"].some(it => name.indexOf(it) > 0)) {
    return name + "maj"
  }
  return name.replaceAll("M7", "maj7").replaceAll("o", "dim").replaceAll("m", "min").replaceAll( "+", "aug")
}


function chromaticScales() {
  let chromaticScale1 = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab']
  let chromaticScale2 = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

  let cc1 = new CircularCursor(chromaticScale1)
  let cc2 = new CircularCursor(chromaticScale2)
  return {cc1, cc2};
}

let findChordsWithAChromaticNote = chordTones => {
  let {cc1, cc2} = chromaticScales();

  let neighboringNotes = new Set()
  chordTones.forEach(n => {
    let i = cc1.goTo(n)
    if(i >= 0) {
      let [a, b, c] = cc1.triplet()
      neighboringNotes.add(a)
      neighboringNotes.add(c)
    }

    i = cc2.goTo(n)
    if(i >= 0) {
      let [a, b, c] = cc2.triplet()
      neighboringNotes.add(a)
      neighboringNotes.add(c)
    }
  })

  neighboringNotes = Array.from(neighboringNotes)
  let out = []
  Object.keys(allChords).forEach(c => {
    let hasSomethingCommon = allChords[c].notes.some(n => neighboringNotes.find(nt => equalNotes(nt, n)))
    if(hasSomethingCommon) out.push(c)
  })

  return out
}

let raiseNote = n => {
  let {cc1, cc2} = chromaticScales();
  let i = cc1.goTo(n)
  if(i >= 0) {
    return cc1.next()
  }
  i = cc2.goTo(n)
  if(i >= 0) {
    return cc2.next()
  }
}

let flattenNote = n => {
  let {cc1, cc2} = chromaticScales();
  let i = cc1.goTo(n)
  if(i >= 0) {
    return cc1.previous()
  }
  i = cc2.goTo(n)
  if(i >= 0) {
    return cc2.previous()
  }
}

let keyList = ['C', 'Am', 'F', 'Dm', 'Bb', 'Gm', 'Eb', 'Cm', 'Ab', 'Fm', 'Db', 'Bbm', 'Gb', 'D#m', 'B', 'G#m', 'E', 'C#m', 'A', 'F#m', 'D', 'Bm', 'G', 'Em']

function possibleOctaves(noteName) {
  if(['C', 'D'].includes(noteName)) return [3, 4, 5]
  return [2, 3, 4, 5]
}

function allVersionsOfChord(chordName) {
  let out = []
  let chordNotesInOrder = allChords[chordName].notes;
  permutate(chordNotesInOrder).forEach(notes => {
    cartesian(...notes.map(it => cartesian([it], possibleOctaves(it)))).forEach(_notes => {
      let inv = ''
      if(_notes.length === 3) {
        if(_notes[0][0] === chordNotesInOrder[1]) inv = '(6)'
        else if(_notes[0][0] === chordNotesInOrder[2]) inv = '(6, 4)'
      }
      if(_notes.length === 4) {
        if(_notes[0][0] === chordNotesInOrder[0]) inv = '(7)'
        else if(_notes[0][0] === chordNotesInOrder[1]) inv = '(6, 5)'
        else if(_notes[0][0] === chordNotesInOrder[2]) inv = '(4, 3)'
        else if(_notes[0][0] === chordNotesInOrder[3]) inv = '(4, 2)'
      }
      out.push({name: normaliseChordName(chordName) + inv, notesWithOctave: _notes})
    })
  })
  return _.uniqBy(out, e => Array.from(new Set(e.notesWithOctave.map(it => it.join(',')))).toSorted().join(";"))
}

