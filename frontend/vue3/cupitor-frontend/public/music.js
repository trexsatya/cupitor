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

let keyChart = {
  "C": ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  "G": ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  "D": ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  "A": ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  "E": ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  "B": ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
  "F#": ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
  "Gb": ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
  "Am": ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'],
  "A#m": ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#', 'A#'],
  "Bbm": ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb'],
  "Bm": ['B', 'C#', 'D', 'E', 'F#', 'G', 'A', 'B'],
  "Cm": ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb', 'C'],
  "C#m": ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B', 'C#'],
  "Dbm": ['Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bbb', 'Cb', 'Db'],
  "Dm": ['D', 'E', 'F', 'G', 'A', 'Bb', 'C', 'D'],
  "D#m": ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#', 'D#'],
  "Ebm": ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb'],
  "Em": ['E', 'F#', 'G', 'A', 'B', 'C', 'D', 'E'],
  "Fm": ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb', 'F'],
  "F#m": ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E', 'F#'],
  "Gbm": ['Gb', 'Ab', 'Bbb', 'Cb', 'Db', 'Ebb', 'Fb', 'Gb'],
  "Gm": ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F', 'G'],
  "G#m": ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#', 'G#'],
  "Abm": ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab']
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
  'D#': 'D# - E# -F# - G# - A# - B - C#',
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

function constructMeasureFive() {

}

function constructMeasureEight() {

}

function constructMeasureSix() {

}

function constructMeasureSeven() {

}

let Cadences = {
  Half: 0,
  IAC: 1,
  PAC: 2,
  Plagal: 3,
  Deceptive: 4
}

let melodyNotesForCadence = (cadence) => {
  switch (cadence) {
    case Cadences.Half:
      return [randomFromArray([1, 2, 3, 4, 5, 6, 7]), randomFromArray([5, 7, 2])]
    case Cadences.Plagal:
      return [randomFromArray([4, 6, 1]), randomFromArray([1, 3, 5])]
    case Cadences.IAC:
      return [randomFromArray([5, 7, 2, 7, 2, 4]), randomFromArray([1, 3, 5])]
    case Cadences.PAC:
      return [randomFromArray([5, 7, 2]), randomFromArray([1])]
  }
}
let motions = [[0, +1, -1], [+2, -2, +4, -4, +7, -7]]
let motionTypes = [0, 1] //step, leap
let ascendingStepwiseMotion = x => x + randomFromArray(motions[0].filter(it => it > 0))
let descendingStepwiseMotion = x => x + randomFromArray(motions[0].filter(it => it <= 0))
let ascendingLeap = x => x + randomFromArray(motions[1].filter(it => it > 0))
let descendingLeap = x => x + randomFromArray(motions[1].filter(it => it <= 0))
let canLeapFromFirstToSecond = (x, y) => motions[1].find(it => x + it === y)

function constructPhraseOne() {
  let extremePitch = null
  let extremeType = null
  let phraseExtremeReached = false
  let phraseLevelLeapsApplied = 0

  function constructMeasureOne() {
    let rhythmLevel = randomFromArray([1, 2])
    let startingNote = randomFromArray([1, 2, 3, 4, 5, 6])
    let containsExtremePitch = false
    let canStepUp = true, canStepDown = true, canLeapUp = true, canLeapDown = true
    let shouldStepUp = false, shouldStepDown = false, shouldLeapUp = false, shouldLeapDown = false

    if (!extremePitch) {
      extremePitch = startingNote + randomFromArray([plus, minus])(randomFromArray([4, 5, 6, 7]))
    }

    let leapApplied = 0
    let previousNotePitch = startingNote
    let lastMotion = null

    let getNewNote = () => {
      if (lastMotion === ascendingLeap) {
        shouldStepDown = true
      }
      if (lastMotion === descendingLeap) {
        shouldStepUp = true
      }

      let motions = []
      if (shouldStepUp) {
        motions = [ascendingStepwiseMotion]
      } else if (shouldStepDown) {
        motions = [descendingStepwiseMotion]
      } else if (shouldLeapUp) {
        motions = [ascendingLeap]
      } else if (shouldLeapDown) {
        motions = [descendingLeap]
      } else {
        if (canStepUp) motions.push(ascendingStepwiseMotion)
        if (canLeapUp) motions.push(ascendingLeap)
        if (canStepDown) motions.push(descendingStepwiseMotion)
        if (canLeapDown) motions.push(descendingLeap)
      }

      let fn = randomFromArray(motions)
      console.log(`Measure-1: ${fn.name} from ${previousNotePitch} `)
      lastMotion = fn
      if (fn === ascendingLeap || fn === descendingLeap) {
        leapApplied += 1
        phraseLevelLeapsApplied += 1
        //Strategy MaxOneLeapAllowedPerMeasure
        canLeapDown = false;
        canLeapUp = false;
      }
      let newRelativePitch = fn(previousNotePitch)

      if (newRelativePitch === extremePitch) {
        containsExtremePitch = true
        phraseExtremeReached = true
        extremeType = newRelativePitch < startingNote ? "lowest" : "highest"
        if (extremeType === "lowest") {
          shouldStepUp = true
        } else if (extremeType === "highest") {
          shouldStepDown = true
        }
      }

      return newRelativePitch
    }

    let rhythm = randomFromArray(Rhythms[rhythmLevel])
    let notes = [{pitch: startingNote, duration: rhythm[0]}]
    for (let i = 1; i < rhythm.length; i++) {
      notes[i] = {pitch: getNewNote(), duration: rhythm[i]}
      previousNotePitch = notes[i].pitch
    }

    return {
      rhythmLevel: rhythmLevel,
      rhythm: rhythm,
      startingNote: startingNote,
      notes: notes,
      containsExtremePitch: containsExtremePitch,
      extremeType: extremeType,
      lastMotion: lastMotion,
      previousNotePitch: previousNotePitch,
      extremePitch: extremePitch
    }
  }

  function constructMeasureFour(measureOne, recursionDepth) {
    recursionDepth = recursionDepth || 1
    if (recursionDepth > 20) {
      console.log(`${this.name} tried ${recursionDepth} times. Giving up!`)
      return []
    }
    let rhythmLevel = randomFromArray([1, 2])
    let cadence = randomFromArray([Cadences.Half, Cadences.IAC, Cadences.Plagal])
    let cadenceNotes = melodyNotesForCadence(cadence)

    let endingNote = cadenceNotes[1]
    let containsExtremePitch = false
    let canStepUp = true, canStepDown = true, canLeapUp = true, canLeapDown = true
    let shouldStepUp = false, shouldStepDown = false, shouldLeapUp = false, shouldLeapDown = false

    if (!extremePitch) {
      extremePitch = endingNote + randomFromArray([plus, minus])(randomFromArray([4, 5, 6, 7]))
    }

    let leapsApplied = 0
    let nextNotePitch = endingNote
    let nextMotion = null

    let getNewNote = () => {

      if (nextMotion === descendingStepwiseMotion) {
        canLeapUp = true
      }
      if (nextMotion === ascendingStepwiseMotion) {
        canLeapDown = true
      }

      if (phraseLevelLeapsApplied > 0) {
        canLeapUp = false
        canLeapDown = false
      }

      let motions = []
      if (shouldStepUp) {
        motions = [ascendingStepwiseMotion]
      } else if (shouldStepDown) {
        motions = [descendingStepwiseMotion]
      } else if (shouldLeapUp) {
        motions = [ascendingLeap]
      } else if (shouldLeapDown) {
        motions = [descendingLeap]
      } else {
        if (canStepUp) motions.push(ascendingStepwiseMotion)
        if (canLeapUp) motions.push(ascendingLeap)
        if (canStepDown) motions.push(descendingStepwiseMotion)
        if (canLeapDown) motions.push(descendingLeap)
      }

      let fn = randomFromArray(motions)
      console.log(`Measure-4: ${fn.name} from ${nextNotePitch} `)
      nextMotion = fn
      if (fn === ascendingLeap || fn === descendingLeap) {
        leapsApplied += 1
        //Strategy MaxOneLeapAllowedPerMeasure
        canLeapDown = false;
        canLeapUp = false;
      }
      let newRelativePitch = fn(nextNotePitch)

      if (measureOne.containsExtremePitch &&
        (newRelativePitch === extremePitch
          || (extremeType === "highest" && newRelativePitch > measureOne.extremePitch)
          || (extremeType === "lowest" && newRelativePitch < measureOne.extremePitch)
        )
      ) {
        //Already reached extreme point in this phrase
        return getNewNote()
      } else if (newRelativePitch === extremePitch) {
        containsExtremePitch = true
        phraseExtremeReached = true
        extremeType = newRelativePitch < endingNote ? "lowest" : "highest"
        if (extremeType === "lowest") {
          shouldStepUp = true
        } else if (extremeType === "highest") {
          shouldStepDown = true
        }
      }

      return newRelativePitch
    }

    let rhythm = randomFromArray(Rhythms[rhythmLevel])
    if (rhythm.length === 1) {
      // To keep it simple it's required to have cadence in last measure itself
      console.log("This rhythm is too much for cadential measure! Trying again")
      return constructMeasureFour(recursionDepth + 1)
    }

    let notes = new Array(rhythm.length)
    notes[notes.length - 1] = {pitch: nthLast(cadenceNotes), duration: nthLast(rhythm)}
    notes[notes.length - 2] = {pitch: nthLast(cadenceNotes, 2), duration: nthLast(rhythm, 2)}

    if (rhythm.length > 2) {
      nextNotePitch = notes[notes.length - 2].pitch
      for (let i = rhythm.length - 3; i >= 0; i--) {
        notes[i] = {pitch: getNewNote(), duration: rhythm[i]}
        nextNotePitch = notes[i].pitch
      }
    }

    return {
      rhythmLevel: rhythmLevel,
      rhythm: rhythm,
      startingNote: notes[0],
      notes: notes,
      containsExtremePitch: containsExtremePitch,
      extremeType: extremeType,
      lastMotion: nextMotion,
      previousNotePitch: nextNotePitch,
      leapsApplied: leapsApplied
    }
  }

  function constructMeasureTwo(measureOne, measureFour) {
    let rhythmLevel = randomFromArray([0, 1, 2, 3])

    let containsExtremePitch = false
    let canStepUp = true, canStepDown = true, canLeapUp = true, canLeapDown = true
    let shouldStepUp = false, shouldStepDown = false, shouldLeapUp = false, shouldLeapDown = false

    if (!extremePitch) {
      extremePitch = nthLast(measureOne.notes).pitch + randomFromArray([plus, minus])(randomFromArray([4, 5, 6, 7]))
    }

    let leapsApplied = 0
    let previousNotePitch = nthLast(measureOne.notes).pitch
    let lastMotion = measureOne.lastMotion

    if (phraseLevelLeapsApplied > 0) {
      canLeapUp = false
      canLeapDown = false
    }

    let getNewNote = () => {
      if (lastMotion === ascendingLeap) {
        shouldStepDown = true
      }
      if (lastMotion === descendingLeap) {
        shouldStepUp = true
      }

      let motions = []
      if (shouldStepUp) {
        motions = [ascendingStepwiseMotion]
      } else if (shouldStepDown) {
        motions = [descendingStepwiseMotion]
      } else if (shouldLeapUp) {
        motions = [ascendingLeap]
      } else if (shouldLeapDown) {
        motions = [descendingLeap]
      } else {
        if (canStepUp) motions.push(ascendingStepwiseMotion)
        if (canLeapUp) motions.push(ascendingLeap)
        if (canStepDown) motions.push(descendingStepwiseMotion)
        if (canLeapDown) motions.push(descendingLeap)
      }

      let fn = randomFromArray(motions)
      console.log(`Measure-2: ${fn.name} from ${previousNotePitch} `)
      lastMotion = fn
      if (fn === ascendingLeap || fn === descendingLeap) {
        leapsApplied += 1
        //Strategy MaxOneLeapAllowedPerMeasure
        canLeapDown = false;
        canLeapUp = false;
      }
      return fn(previousNotePitch)
    }

    let rhythm = randomFromArray(Rhythms[rhythmLevel])
    let notes = []
    for (let i = 0; i < rhythm.length; i++) {
      let newRelativePitch = getNewNote()
      if (newRelativePitch === extremePitch) {
        containsExtremePitch = true
        phraseExtremeReached = true
        extremeType = newRelativePitch < notes.concat(measureOne.notes.map(it => it.pitch)).every(it => it > extremePitch) ? "lowest" : "highest"
        if (extremeType === "lowest") {
          shouldStepUp = true
        } else if (extremeType === "highest") {
          shouldStepDown = true
        }
      }
      notes[i] = {pitch: newRelativePitch, duration: rhythm[i]}
      previousNotePitch = notes[i].pitch
    }

    return {
      rhythmLevel: rhythmLevel,
      rhythm: rhythm,
      startingNote: notes[0],
      notes: notes,
      containsExtremePitch: containsExtremePitch,
      extremeType: extremeType,
      lastMotion: lastMotion,
      previousNotePitch: previousNotePitch,
      extremePitch: extremePitch,
      leapsApplied: leapsApplied
    }
  }

  function constructMeasureThree(measureTwo, measureFour, recursionDepth) {
    recursionDepth = recursionDepth || 1
    if (recursionDepth > 20) {
      console.log(`${this.name} tried ${recursionDepth} times. Giving up!`)
      return []
    }
    let rhythmLevel = randomFromArray([0, 1, 2, 3])

    let containsExtremePitch = false
    let canStepUp = true, canStepDown = true, canLeapUp = true, canLeapDown = true
    let shouldStepUp = false, shouldStepDown = false, shouldLeapUp = false, shouldLeapDown = false

    if (!extremePitch) {
      extremePitch = nthLast(measureTwo.notes).pitch + randomFromArray([plus, minus])(randomFromArray([4, 5, 6, 7]))
    }

    let leapsApplied = 0
    let previousNotePitch = nthLast(measureTwo.notes).pitch
    let lastMotion = measureTwo.lastMotion

    if (phraseLevelLeapsApplied > 0) {
      canLeapUp = false
      canLeapDown = false
    }

    let getNewNote = () => {
      if (lastMotion === ascendingLeap) {
        shouldStepDown = true
      }
      if (lastMotion === descendingLeap) {
        shouldStepUp = true
      }

      let motions = []
      if (shouldStepUp) {
        motions = [ascendingStepwiseMotion]
      } else if (shouldStepDown) {
        motions = [descendingStepwiseMotion]
      } else if (shouldLeapUp) {
        motions = [ascendingLeap]
      } else if (shouldLeapDown) {
        motions = [descendingLeap]
      } else {
        if (canStepUp) motions.push(ascendingStepwiseMotion)
        if (canLeapUp) motions.push(ascendingLeap)
        if (canStepDown) motions.push(descendingStepwiseMotion)
        if (canLeapDown) motions.push(descendingLeap)
      }

      let fn = randomFromArray(motions)
      console.log(`Measure-3: ${fn.name} from ${previousNotePitch} `)
      lastMotion = fn
      if (fn === ascendingLeap || fn === descendingLeap) {
        leapsApplied += 1
        //Strategy MaxOneLeapAllowedPerMeasure
        canLeapDown = false;
        canLeapUp = false;
      }
      return fn(previousNotePitch)
    }

    let rhythm = randomFromArray(Rhythms[rhythmLevel])
    let notes = []
    for (let i = 0; i < rhythm.length; i++) {
      let newRelativePitch = getNewNote()
      if (newRelativePitch === extremePitch) {
        containsExtremePitch = true
        phraseExtremeReached = true
        extremeType = newRelativePitch < notes.concat(measureOne.notes.map(it => it.pitch)).every(it => it > extremePitch) ? "lowest" : "highest"
        if (extremeType === "lowest") {
          shouldStepUp = true
        } else if (extremeType === "highest") {
          shouldStepDown = true
        }
      }
      notes[i] = {pitch: newRelativePitch, duration: rhythm[i]}
      previousNotePitch = notes[i].pitch
    }

    let requiresLeapToNextNote = Math.abs(Math.abs(measureFour.notes[0].pitch) - Math.abs(nthLast(notes).pitch)) !== 1
    if (requiresLeapToNextNote && !canLeapFromFirstToSecond(measureFour.notes[0].pitch, nthLast(notes).pitch)) {
      console.log("Next note requires a leap and leap not allowed, trying again!")
      return constructMeasureThree(measureTwo, measureFour, recursionDepth + 1)
    }

    return {
      rhythmLevel: rhythmLevel,
      rhythm: rhythm,
      startingNote: notes[0],
      notes: notes,
      containsExtremePitch: containsExtremePitch,
      extremeType: extremeType,
      lastMotion: lastMotion,
      previousNotePitch: previousNotePitch,
      extremePitch: extremePitch,
      leapsApplied: leapsApplied
    }
  }

  let measureOne = constructMeasureOne()
  let measureFour = constructMeasureFour(measureOne)
  let measureTwo = constructMeasureTwo(measureOne, measureFour);
  let measureThree = constructMeasureThree(measureTwo, measureFour);

  let phrase = [measureOne, measureTwo, measureThree, measureFour];
  console.log("Phrase-1", phrase)
  return phrase
}

function constructPhraseTwo() {
  constructMeasureFive()
  constructMeasureEight()
  constructMeasureSix()
  constructMeasureSeven()

  return []
}

let DURATION_TO_NAME = {
    '1': 'whole',
    '1/2': 'half',
    '1/4': 'quarter',
    '1/8': 'eighth',
    '1/16': 'sixteenth',
    '3/4': 'dotted-half',
    '3/8': 'dotted-quarter',
    '3/2': 'dotted-whole'
}

function durationType(numericForm) {
  return DURATION_TO_NAME[numericForm]
}

function OctaveMapper() {
  // Restricted range for melody key!
  let referenceOctaves = {
    '3': ['G','G#','Ab','A', 'A#', 'Bb', 'B', 'Cb'],
    '4': ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'E#', 'Fb', 'F', 'F#', 'Gb']
  }

  this.getOctave = key => {
      return parseInt(Object.keys(referenceOctaves).find(k => referenceOctaves[k].indexOf(key) >= 0))
  }

  this.isSecondAfterFirst = (x, y, octave) => {
     let map = referenceOctaves[octave + ""]
     if(octave + "" === "4") {
        map = referenceOctaves['4'].concat(referenceOctaves['3'])
     }
     return map.indexOf(y) > map.indexOf(x)
  }
}

let octaveMapper = new OctaveMapper()

/**
 * Returns list of measures/bars. Pitches are relative to 1.
 * 1 => First scale degree, 0 => 7th scale degree, ...
 * @returns list of measures
 */
function randomMelody() {
  let measures = 8;

  // 4/4 Time only
  // No accidental yet!
  // Fixed voice range

  let phrase1 = constructPhraseOne()
  let phrase2 = constructPhraseTwo(phrase1)

  return phrase1
}

/**
 * Returns list of measures/bars. Pitches are converted to note names in given key.
 * @param melody
 * @param key
 * @returns {*}
 */
function melodyInContextOfKey(melody, key) {
  let scale = null
  if (key.endsWith("m")) {
    scale = minorScales[key.replace("m", "")]
  } else {
    scale = majorScales[key]
  }

  key = key.replace("m", "")

  let startingOctave = octaveMapper.getOctave(key)
  let FORWARD = 0, BACKWARDS = 1
  let geq = (x, y) => x >= y
  let gt = (x, y) => x > y

  let cmpr = startingOctave === 4 ? geq : gt;

  let pitchNumberToNote = x => {
    // Go up by step if it's C increase octave
    // Go down by step, if it's B decrease octave

    let octave = startingOctave
    let number = 1
    let cursor = new CircularCursor(scale.split(' - '))
    let movement = null

    if (x === 1) {
      return {
        name: cursor.next(),
        octave: octave
      }
    }
    cursor.next() //at first scale degree
    for (let i = 0; i < 200; i++) {
      let note = null
      if (x < 1) {
        number--
        note = cursor.previous()
        movement = BACKWARDS
      } else {
        number++
        note = cursor.next()
        movement = FORWARD
      }

      if ((movement === BACKWARDS) && (note === 'B' || note === 'Cb' || note === 'Bb')) {
        octave--
      } else if ((movement === FORWARD) && (note === 'C' || note === 'B#' || note === 'C#')) {
        octave++
      }

      if (number === x) {
        return {
          name: note,
          octave: octave
        }
      }
    }
  }
  return melody.filter(it => it.notes).map(measure => {
    let notes = measure.notes.filter(it => it)
      .map(note => {
        // console.log("note", note)
        let pn = pitchNumberToNote(note.pitch)
        let type = durationType(note.duration)
        return {
          name: pn.name,
          octave: pn.octave,
          fullName: pn.name + pn.octave,
          type: type.replace("dotted-", ""),
          dot: type.indexOf("dotted-") >= 0
        }
      })
      return {notes: notes}
  })

}

function melodyWithoutContextOfKey(melody, key) {
    let scale = null
    if (key.endsWith("m")) {
      scale = minorScales[key.replace("m", "")]
    } else {
      scale = majorScales[key]
    }
    scale = scale.split(' - ')
    key = key.replace("m", "")

    let startingOctave = octaveMapper.getOctave(key)
    let geq = (x, y) => x >= y
    let gt = (x, y) => x > y

    let cmpr = startingOctave === 4 ? geq : gt;

    let FORWARD = 0, BACKWARDS = 1

    let noteToPitchNumber = note => {
        // Go up by step if it's C increase octave
        // Go down by step, if it's B decrease octave

        let octave = startingOctave
        let number = 1
        let cursor = new CircularCursor(scale)
        let movement = null

        if(note.name === key) {
            if(startingOctave === note.octave) {
              return {
                pitch: 1
              }
            }
        }

        cursor.next() //at first scale degree
        for (let i = 0; i < 200; i++) {
          let x = null

          if(note.octave === startingOctave) {
            //Corner cases for B, C
            if(octaveMapper.isSecondAfterFirst(key, note.name, startingOctave)) {
                movement = FORWARD
            } else {
                movement = BACKWARDS
            }
          } else if (note.octave > startingOctave) {
            movement = FORWARD
          } else {
            movement = BACKWARDS
          }

          if(movement === FORWARD) {
            number++
            x = cursor.next()
          } else if(movement == BACKWARDS) {
            number--
            x = cursor.previous()
          }

          if (movement === FORWARD && (x === 'C' || x === 'B#' || x === 'C#')) {
            octave++
          } else if (movement === BACKWARDS && (x === 'B' || x === 'Cb' || x === 'Bb')) {
            octave--
          }

          if (x === note.name && octave === note.octave) {
            return {
              pitch: number
            }
          }

        }
    }

    return melody.map(measure => {
        let notes = measure.notes.filter(it => it)
          .map(note => {
            // console.log("note", note)
            let pn = noteToPitchNumber(note)
            let duration = Object.keys(DURATION_TO_NAME).find(k => DURATION_TO_NAME[k] === note.type)
            return {
              pitch: pn && pn.pitch,
              duration: duration
            }
          })
        return {notes: notes}
    })//end return block
}

/**
 *
 * @param melody : list of measures: [[{name, octave, type, dot}], [{}]]
 */
function diatonicMelodicInversion(melody) {
  let copy = simpleClone(melody)
  let melodyNotes = melody.flatMap(it => it.notes)

  let referenceNote = melodyNotes[0]
  let inverted = [referenceNote]
  let lastNote = referenceNote

  for(let i= 1; i < melodyNotes.length; i++) {
    let diff = melodyNotes[i].pitch - melodyNotes[i-1].pitch
    let newNote = simpleClone(melodyNotes[i])
    newNote.pitch = lastNote.pitch - diff
    inverted.push(newNote)
    lastNote = newNote
  }


  copy.forEach(measure => {
    measure.notes = inverted.slice(0, measure.notes.length)
    inverted = inverted.slice(measure.notes.length)
  })

  return copy
}

let melodyToSimpleString = (melody) => {
  return melody.flatMap(it => it.notes).map(it => it.fullName || it.pitch).join(",")
}

// TESTING
let melody = [{
              notes: [{pitch: 1, duration: '1/8'}, {pitch: 3, duration: '1/8'},
                      {pitch: 7, duration: '1/8'},
                      {pitch: 8, duration: '1/8'},
                      {pitch: 0, duration: '1/8'},  {pitch: -3, duration: '1/8'},
                      {pitch: -7, duration: '1/8'},
                      {pitch: -8, duration: '1/8'}]
              }]
logJson("Tested on melody", melody.flatMap(it => it.notes).map(it => it.pitch))

let keys = ['Am', 'Bm', "Dm", "Cm", "Gm", "C", "G", "A", "F", "Bb", "Eb", "Ab", "E", "Em"]
for(i in keys) {
  let key = keys[i]
  let x = melodyInContextOfKey(melody, key)
  let y = melodyWithoutContextOfKey(x, key)

  if(!equals(y , melody)) {
    log(key)
    logJson('melodyInContextOfKey', x.flatMap(it => it.notes).map(it => it.name + it.octave))

    logJson('melodyWithoutContextOfKey', y.flatMap(it => it.notes).map(it => it.pitch))
  }

}

/**
 * Are enharmonically equal
 */
let equalNotes = (x, y) => {
  if(x === y) return true;
  return [['A#', 'Bb'], ['B', 'Cb'], ['B#', 'C'], ['C#', 'Db'], ['D#', 'Eb'], ['E', 'Fb'], ['E#', 'F'], ['F#', 'Gb'], ['G#', 'Ab']].find(it => it.includes(x) && it.includes(y))
}

/**
 * chord = [..notes], melody = [..notes]
 */
let findAppropriateChords = (chords, melody, key) => {
   let scale = null
    if (key.endsWith("m")) {
      scale = minorScales[key.replace("m", "")]
    } else {
      scale = majorScales[key]
    }
    scale = scale.split(' - ')
    key = key.replace("m", "")

    let buildTriad = note => {
        let cursor = new CircularCursor(scale)
        cursor.goTo(note)
        let third = cursor.next(3-1), fifth = cursor.next(3-1), seventh = cursor.next(3-1)
        return [note, third, fifth]
    }

    let isChordAppropriate = (chord, melodyNote) => {
        let triad = buildTriad(melodyNote)

        return new Set(intersection(triad, chord)).size >= 2
    }

    return chords.filter(it => isChordAppropriate(it, melody[0]))
}

//note.name+note.octave
