import {permutate, logJson, number, schedule, uuid, CircularCursor, equals} from './data-structures.js';
import {getScale, durationType, DURATION_TO_NAME} from './music-reference-data.js';

/**
 * Triads and Seventh chords
 */
const getTriadsForNote = (noteName, key) => {
  const scale = getScale(key);

  const buildTriad = note => {
    const cursor = new CircularCursor(scale)
    cursor.goTo(note)
    const third = cursor.next(3 - 1), fifth = cursor.next(3 - 1), seventh = cursor.next(3 - 1)
    return [note, third, fifth]
  }

  return buildTriad(noteName)
}

const getChordForRomanNumeral = (romanNumeral, musicKey) => {
  let chordNumber = Object.keys(romanHash).sort(sortByLength).find(it => romanNumeral.startsWith(it) || romanNumeral.startsWith(it.toLowerCase()));

  const everythingAfterChordNumber = romanNumeral.substr(chordNumber.length)
  chordNumber = romanNumeral.substr(0, chordNumber.length)

  const isMinor = chordNumber.toLowerCase() === chordNumber
  let quality = null

  if (everythingAfterChordNumber.startsWith("o7")) {
    quality = "dim7"
  } else if (everythingAfterChordNumber.startsWith("o")) {
    quality = "dim"
  } else if (everythingAfterChordNumber.startsWith("7")) {
    quality = isMinor ? "min7" : "7"
  } else if (everythingAfterChordNumber.startsWith("M7") || everythingAfterChordNumber.startsWith("maj7")) {
    quality = isMinor ? "minMaj7" : "maj7"
  } else if (everythingAfterChordNumber.startsWith("sus")) {
    quality = "sus4"
  } else if (isMinor) {
    quality = "min"
  } else {
    quality = "maj"
  }
  const scaleDegree = romanToInt(chordNumber)
  const scaleNotes = new Key(musicKey).scale()
  return {
    symbol: scaleNotes[scaleDegree - 1],
    romanNumeral: romanNumeral,
    quality: quality,
    inversion: 0,
    scaleDegree: scaleDegree
  }
}

/**
 * Representation of X/Y meter.
 * Simple - beat is divided into two x in {2, 3, 4} vs Compound - beat is divided into three  x in {6, 9, 12}
 * Organisation into 2 or 3 is just for visual assistance!
 * Duple - bar is divided into two vs Triple - bar is divided into three
 */
class Meter {
  static Cache = {}
  x = 0
  y = 0

  static from(name) {
    const [x, y] = name.split("/").map(it => number(it.trim()))
    return new Meter(x, y)
  }

  constructor(x, y) {
    this.x = x
    this.y = y
  }

  name() {
    return this.x + "/" + this.y
  }

  /**
   *
   * @param numBars {Number}
   * @param minRhythmValue {Number}
   * @param maxRhythmValue {Number}
   */
  generateRandomRhythm(numBars = 4, minRhythmValue = 1 / 16, maxRhythmValue = 1) {
    const maxNotesPossible = (1 / minRhythmValue) / this.y * numBars * this.x

    const rhythmValues = {
      '1/16': '16th',
      '1/8': '8th',
      '3/16': 'dotted-16th',
      '1/4': 'quarter',
      '3/8': 'dotted-quarter',
      '1/2': 'half',
      '3/4': 'dotted-half',
      '1': 'whole',
      '3/2': 'dotted-whole'
    } //sorted
    const limit = numBars * this.x / this.y

    const value = numBars * this.x / this.y

    const allLevels = [0, 1, 2, 3];

    let r = []
    let maxLevelUsed = 0
    for (let i = 0; i < numBars - 1; i++) {
      const level = randomFromArray(allLevels)
      r = r.concat(randomFromArray(Rhythms[level]))
      if (level > maxLevelUsed) maxLevelUsed = level
    }

    const levelForLastMeasure = randomFromArray(allLevels.filter(i => i < maxLevelUsed))
    r = r.concat(randomFromArray(Rhythms[levelForLastMeasure]))

    const required = this.x / this.y;

    const measures = []
    let currentMeasure = [], currentSum = 0
    for (let i = 0; i < r.length; i++) {
      const it = number(r[i])

      if (currentSum + it <= required) {
        currentMeasure.push({pitch: 1, duration: it})
        currentSum += it
      } else {
        //it cannot be added
        const stillUnfilled = required - currentSum
        let carryOn = null
        if (stillUnfilled > 0) {
          const canBeBroken = Object.keys(rhythmValues).map(number).some(x => x === it - stillUnfilled)

          if (canBeBroken) {
            currentMeasure.push({pitch: 1, duration: stillUnfilled, tie: 'start'})
            carryOn = it - stillUnfilled
          }
        }

        //Reset
        measures.push(currentMeasure)
        currentMeasure = (carryOn ? [{pitch: 1, duration: carryOn, tie: 'stop'}] : [])
        currentSum = (carryOn ? number(carryOn) : 0)
      }
    }

    log("Generated rhythm: ", measures, "sum=" + sum(r), "maxLevelUsed=" + maxLevelUsed, "levelForLastMeasure=" + levelForLastMeasure)
    return measures.map(m => ({notes: m}))
  }
}

// log(new Meter(3, 4).generateRandomRhythm())

export function Key(keyName) {
  const scale = getScale(keyName)
  this.key = keyName
  const chords = []
  this.scale = () => scale

  scale.forEach(note => {
    chords.push(getTriadsForNote(note, keyName))
  })

  this.chords = () => {
    let i = 0
    return chords.map(it => {
      let chordName = it[0]

      if (!this.isMinor()) {
        if ([1, 2, 5].includes(i)) chordName += "min"
        else if (i === 6) chordName += "dim"
        else chordName += "maj"
      } else {
        if ([0, 3, 4].includes(i)) chordName += "min"
        else if (i === 1) chordName += "dim"
        else chordName += "maj"
      }

      i++
      return chordName
    }) //end
  }

  this.chordTonesForRomanNumeral = (number) => {
    const c = getChordForRomanNumeral(number, this.key)
    return chords[c.scaleDegree - 1]
  }

  this.chordTonesForNote = (note, i) => {
    if(i === undefined) i =0
    return chords.filter(it => it[i] === note);
  }

  this.isMinor = () => this.key.endsWith("m");

  this.name = () => this.key;

  this.contains = (noteName) => {
    return scale.includes(noteName)
  }
}

function getAllChordsInKey(key) {
  key = key || fretboard.activeKey
  const allChordsInKey = {}
  key.scale().forEach(scaleNote => {
    Object.keys(chordPatterns).forEach(name => {
      allChordsInKey[scaleNote + name] = {
        notes: chordPatterns[name](getScale(scaleNote)),
        root: scaleNote
      }
    })
  })
  return allChordsInKey;
}

function constructMeasureFive() {

}

function constructMeasureEight() {

}

function constructMeasureSix() {

}

function constructMeasureSeven() {

}

const melodyNotesForCadence = (cadence) => {
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
const motions = [[0, +1, -1], [+2, -2, +4, -4, +7, -7]]
const motionTypes = [0, 1] //step, leap
const ascendingStepwiseMotion = x => x + randomFromArray(motions[0].filter(it => it > 0))
const descendingStepwiseMotion = x => x + randomFromArray(motions[0].filter(it => it <= 0))
const ascendingLeap = x => x + randomFromArray(motions[1].filter(it => it > 0))
const descendingLeap = x => x + randomFromArray(motions[1].filter(it => it <= 0))
const canLeapFromFirstToSecond = (x, y) => motions[1].find(it => x + it === y)

function constructPhraseOne() {
  let extremePitch = null
  let extremeType = null
  let phraseExtremeReached = false
  let phraseLevelLeapsApplied = 0

  function constructMeasureOne() {
    const rhythmLevel = randomFromArray([1, 2])
    const startingNote = randomFromArray([1, 2, 3, 4, 5, 6])
    let containsExtremePitch = false
    let canStepUp = true, canStepDown = true, canLeapUp = true, canLeapDown = true
    let shouldStepUp = false, shouldStepDown = false, shouldLeapUp = false, shouldLeapDown = false

    if (!extremePitch) {
      extremePitch = startingNote + randomFromArray([plus, minus])(randomFromArray([4, 5, 6, 7]))
    }

    let leapApplied = 0
    let previousNotePitch = startingNote
    let lastMotion = null

    const getNewNote = () => {
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

      const fn = randomFromArray(motions)
      console.log(`Measure-1: ${fn.name} from ${previousNotePitch} `)
      lastMotion = fn
      if (fn === ascendingLeap || fn === descendingLeap) {
        leapApplied += 1
        phraseLevelLeapsApplied += 1
        //Strategy MaxOneLeapAllowedPerMeasure
        canLeapDown = false;
        canLeapUp = false;
      }
      const newRelativePitch = fn(previousNotePitch)

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

    const rhythm = randomFromArray(Rhythms[rhythmLevel])
    const notes = [{pitch: startingNote, duration: rhythm[0]}]
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
    const rhythmLevel = randomFromArray([1, 2])
    const cadence = randomFromArray([Cadences.Half, Cadences.IAC, Cadences.Plagal])
    const cadenceNotes = melodyNotesForCadence(cadence)

    const endingNote = cadenceNotes[1]
    let containsExtremePitch = false
    let canStepUp = true, canStepDown = true, canLeapUp = true, canLeapDown = true
    let shouldStepUp = false, shouldStepDown = false, shouldLeapUp = false, shouldLeapDown = false

    if (!extremePitch) {
      extremePitch = endingNote + randomFromArray([plus, minus])(randomFromArray([4, 5, 6, 7]))
    }

    let leapsApplied = 0
    let nextNotePitch = endingNote
    let nextMotion = null

    const getNewNote = () => {

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

      const fn = randomFromArray(motions)
      console.log(`Measure-4: ${fn.name} from ${nextNotePitch} `)
      nextMotion = fn
      if (fn === ascendingLeap || fn === descendingLeap) {
        leapsApplied += 1
        //Strategy MaxOneLeapAllowedPerMeasure
        canLeapDown = false;
        canLeapUp = false;
      }
      const newRelativePitch = fn(nextNotePitch)

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

    const rhythm = randomFromArray(Rhythms[rhythmLevel])
    if (rhythm.length === 1) {
      // To keep it simple it's required to have cadence in last measure itself
      console.log("This rhythm is too much for cadential measure! Trying again")
      return constructMeasureFour(recursionDepth + 1)
    }

    const notes = new Array(rhythm.length)
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
    const rhythmLevel = randomFromArray([0, 1, 2, 3])

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

    const getNewNote = () => {
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

      const fn = randomFromArray(motions)
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

    const rhythm = randomFromArray(Rhythms[rhythmLevel])
    const notes = []
    for (let i = 0; i < rhythm.length; i++) {
      const newRelativePitch = getNewNote()
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
    const rhythmLevel = randomFromArray([0, 1, 2, 3])

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

    const getNewNote = () => {
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

      const fn = randomFromArray(motions)
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

    const rhythm = randomFromArray(Rhythms[rhythmLevel])
    const notes = []
    for (let i = 0; i < rhythm.length; i++) {
      const newRelativePitch = getNewNote()
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

    const requiresLeapToNextNote = Math.abs(Math.abs(measureFour.notes[0].pitch) - Math.abs(nthLast(notes).pitch)) !== 1
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

  const measureOne = constructMeasureOne()
  const measureFour = constructMeasureFour(measureOne)
  const measureTwo = constructMeasureTwo(measureOne, measureFour);
  const measureThree = constructMeasureThree(measureTwo, measureFour);

  const phrase = [measureOne, measureTwo, measureThree, measureFour];
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

function OctaveMapper() {
  // Restricted range for melody key!
  const referenceOctaves = {
    '3': ['G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'],
    '4': ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'E#', 'Fb', 'F', 'F#', 'Gb']
  }

  this.getOctave = key => {
    return parseInt(Object.keys(referenceOctaves).find(k => referenceOctaves[k].indexOf(key) >= 0))
  }

  this.isSecondAfterFirst = (x, y, octave) => {
    let map = referenceOctaves[octave + ""]
    if (octave + "" === "4") {
      map = referenceOctaves['4'].concat(referenceOctaves['3'])
    }
    return map.indexOf(y) > map.indexOf(x)
  }
}

const octaveMapper = new OctaveMapper()

/**
 * Returns list of measures/bars. Pitches are relative to 1.
 * 1 => First scale degree, 0 => 7th scale degree, ...
 * @returns list of measures
 */
export function randomMelody() {
  const measures = 8;

  // 4/4 Time only
  // No accidental yet!
  // Fixed voice range

  const phrase1 = constructPhraseOne()
  const phrase2 = constructPhraseTwo(phrase1)

  return phrase1
}

/**
 * Returns list of measures/bars. Pitches are converted to note names in given key.
 * @param melody
 * @param key of type Key
 * @returns {*}
 */
export function melodyInContextOfKey(melody, key) {
  const scale = key.scale()

  key = key.name().replace("m", "")

  const startingOctave = octaveMapper.getOctave(key)
  const FORWARD = 0, BACKWARDS = 1
  const pitchNumberToNote = x => {
    // Go up by step if it's C increase octave
    // Go down by step, if it's B decrease octave

    let octave = startingOctave
    let number = 1
    const cursor = new CircularCursor(scale)
    let movement = null

    if (x === 1) {
      return {
        name: cursor.next(),
        octave: octave
      }
    }
    cursor.next() //at first scale degree
    for (let i = 0; i < 200; i++) {
      let note = ""
      if (x < 1) {
        number--
        note = cursor.previous()
        movement = BACKWARDS
      } else {
        number++
        note = cursor.next()
        movement = FORWARD
      }

      const equivalentOfC = scale.find(n => (n === 'C' || n === 'B#' || n === 'C#'))
      const equivalentOfB = scale.find(n => (n === 'B' || n === 'Cb' || n === 'Bb'))
      if ((movement === BACKWARDS) && (equivalentOfB === note)) {
        octave--
      } else if ((movement === FORWARD) && (equivalentOfC === note)) {
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
    const notes = measure.notes.filter(it => it)
      .map(note => {
        // console.log("note", note)
        const pn = pitchNumberToNote(note.pitch)

        let name = '', octave = ''
        if(pn) {
          name = pn.name
          octave = pn.octave
          if (note.alter === +1) name += "#"
          if (note.alter === -1) name += "b"
        }

        const type = durationType(note.duration) || ""
        return {
          name: name,
          octave: octave,
          fullName: name + octave,
          type: type.replace("dotted-", ""),
          dot: note.dot || type.indexOf("dotted-") >= 0,
          tie: note.tie //propagate as it is
        }
      })
    return {notes: notes}
  })

}

export function melodyWithoutContextOfKey(melody, key) {
  const scale = key.scale()
  key = key.name().replace("m", "")

  const startingOctave = octaveMapper.getOctave(key)
  const geq = (x, y) => x >= y
  const gt = (x, y) => x > y

  const FORWARD = 0, BACKWARDS = 1

  const noteToPitchNumber = note => {
    // Go up by step if it's C increase octave
    // Go down by step, if it's B decrease octave

    let octave = startingOctave
    let number = 1
    const cursor = new CircularCursor(scale)
    let movement = null

    if (startingOctave === note.octave) {
      if (note.name === key) {
        return {
          pitch: 1
        }
      } else if (note.name !== "B" && note.name === key + "#") {
        return {
          pitch: 1,
          alter: 1
        }
      } else if (note.name !== "C" && note.name === key + "b") {
        return {
          pitch: 1,
          alter: -1
        }
      }
    }

    cursor.next() //at first scale degree
    for (let i = 0; i < 200; i++) {
      let x = ""

      if (note.octave === startingOctave) {
        //Corner cases for B, C
        if (octaveMapper.isSecondAfterFirst(key, note.name, startingOctave)) {
          movement = FORWARD
        } else {
          movement = BACKWARDS
        }
      } else if (note.octave > startingOctave) {
        movement = FORWARD
      } else {
        movement = BACKWARDS
      }

      if (movement === FORWARD) {
        number++
        x = cursor.next()
      } else if (movement === BACKWARDS) {
        number--
        x = cursor.previous()
      }

      const equivalentOfC = scale.find(n => (n === 'C' || n === 'B#' || n === 'C#'))
      const equivalentOfB = scale.find(n => (n === 'B' || n === 'Cb' || n === 'Bb'))
      if (movement === FORWARD && (equivalentOfC === x)) {
        octave++
      } else if (movement === BACKWARDS && (equivalentOfB === x)) {
        octave--
      }

      if (octave === note.octave) {
        if (x === note.name) {
          return {
            pitch: number
          }
        } else if (x + "#" === note.name) {
          return {
            pitch: number,
            alter: +1
          }
        } else if (x + "b" === note.name) {
          return {
            pitch: number,
            alter: -1
          }
        }
      }
    }
  }

  return melody.map(measure => {
    const notes = measure.notes.filter(it => it)
      .map(note => {
        // console.log("note", note)
        const pn = noteToPitchNumber(note)
        const duration = Object.keys(DURATION_TO_NAME).find(k => DURATION_TO_NAME[k] === note.type)
        return {
          pitch: pn && pn.pitch,
          duration: duration,
          alter: pn && pn.alter,
          dot: note.dot || false
        }
      })
    return {notes: notes}
  })//end return block
}

/**
 *
 * @param melody : list of measures: ([{notes: [{pitch, ..}]}, ..])
 */
export function diatonicMelodicInversion(melody) {
  const copy = simpleClone(melody)
  const melodyNotes = melody.flatMap(it => it.notes)

  const referenceNote = melodyNotes[0]
  let inverted = [referenceNote]
  let lastNote = referenceNote

  for (let i = 1; i < melodyNotes.length; i++) {
    const diff = melodyNotes[i].pitch - melodyNotes[i - 1].pitch
    const newNote = simpleClone(melodyNotes[i])
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

export const melodyToSimpleString = (melody) => {
  return melody.flatMap(it => it.notes).map(it => it.fullName || it.pitch).join(",")
}

// TESTING
const melody = [{
  notes: [{pitch: 1, duration: '1/8', dot: false}, {pitch: 3, duration: '1/8', dot: false},
    {pitch: 7, duration: '1/8', dot: false},
    {pitch: 8, duration: '1/8', dot: false},
    {pitch: 0, duration: '1/8', dot: false}, {pitch: -3, duration: '1/8', dot: true},
    {pitch: -7, duration: '1/8', dot: false},
    {pitch: -8, duration: '1/8', dot: false}]
}]
logJson("Tested on melody", melody.flatMap(it => it.notes).map(it => it.pitch))

const keys = ['Am', 'Bm', "Dm", "Cm", "Gm", "C", "G", "A", "F", "Bb", "Eb", "Ab", "E", "Em"].map(it => new Key(it))
for (const i in keys) {
  const key = keys[i]
  const x = melodyInContextOfKey(melody, key)
  const y = melodyWithoutContextOfKey(x, key)

  if (!equals(y, melody)) {
    log(key)
    logJson('melodyInContextOfKey', x.flatMap(it => it.notes).map(it => it.name + it.octave))

    logJson('melodyWithoutContextOfKey', y.flatMap(it => it.notes).map(it => it.pitch))
  }

}


//note.name+note.octave
