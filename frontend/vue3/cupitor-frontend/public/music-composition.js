let selectedMeter = null
let currentRhythm = null

let onGenerateRhythmClick = e => {
  let meterStr = $('#meterSelect').val()
  let meter = Meter.from(meterStr);
  selectedMeter = meter
  let mel = meter.generateRandomRhythm()

  fretboard.melodyBeingPlayed = mel
  // let mxml = new MusicXml()
  mxml.reset().setKey(fretboard.activeKey).setTime(meter.x, meter.y)

  let melnInKey = melodyInContextOfKey(mel, fretboard.activeKey)
  fretboard.melodyBeingPlayedInKey = melnInKey
  currentRhythm = melnInKey
  mxml.loadMelody(melnInKey, fretboard.activeKey, meter)
  loadMainOSMD(mxml.toString());

  $('#generateChordMelodyBtn').show()
}

function controlHarmonicChange(measures, notes) {
  //Max number of chords in measure = 3
  let MAX = 3
  let hasMoreThanAllowed = () => range(measures.length).some(mi => measures[mi].length > MAX || measures[mi].length > notes[mi].length)
  let cursor = new CircularCursor(measures)

  until(not(hasMoreThanAllowed), 200, () => {
    let [prev, current, next] = cursor.triplet()
    if(current.length > MAX) {
        if(MAX - prev.length > 0) {
          nTimes(MAX - prev.length, () => current.shift()).forEach(it => prev.push(it))
        }
    }
  })
  return measures
}

function breakMonotonyOfChords(measures) {

  return measures
}


function distributeChords(chords, numMeasures, notes) {
  //SimpleStrategy: Keep single chord in last measure
  let measures = range(numMeasures).map(_ => [])
  measures[measures.length-1] = []

  let howManyForLastMeasure = chords.length/numMeasures
  if(howManyForLastMeasure < 1) howManyForLastMeasure = 1
  if(howManyForLastMeasure > 2) howManyForLastMeasure = 2
  nTimes(howManyForLastMeasure, () => measures[measures.length-1].unshift(chords.pop()))

  let mel = fretboard.melodyBeingPlayedInKey;
  mel.map((it, i) => it.notes.forEach(n => n.measure = i))
  let min = 2
  let ns = mel.slice(0, mel.length-1).map(it => it.notes).flat();
  if(!(chords.length * min <= ns.length)) min -= 1
  let groups = randomGroupingPreservingOrder(ns, chords.length, min)
  groups.forEach((g, i) => g.forEach(n => n.chord = i))

  groups.flat().forEach(n => {
    let chord = chords[n.chord]
    if(!measures[n.measure].includes(chord)) {
      measures[n.measure].push(chord)
    }
  })
  measures = controlHarmonicChange(measures, measures)
  measures = breakMonotonyOfChords(measures)
  return measures
}

function assignOctaveRandomly(note) {
  if(['G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'].includes(note.name)) {
    note.octave = randomFromArray([3, 4])
  }  else {
    note.octave = 4
  }
  note.fullName = note.name + note.octave
}

/**
 *
 * @param chordMeasures {[[]]}
 * @param melody {[[]]} melody in context of key
 * @param key {Key}
 */
function distributeChordNotes(chordMeasures, melody, key) {
  assert(chordMeasures.length === melody.length, "Not equal in length")
  let NULL = 'C'
  for (let i = 0; i < melody.length; i++) {
    let measure = melody[i].notes
    let cadentialMeasure = false
    let preCadentialMeasure = false
    let cadentialNote = false
    if(i === melody.length - 1) cadentialMeasure = true
    if(i === melody.length - 2) preCadentialMeasure = true
    for (let j = 0; j < measure.length; j++) {
      let note = measure[j]
      note.name = NULL
      note.measureIndex = i
      note.noteIndex = j
      if(cadentialMeasure && j === measure.length -1) cadentialNote = true

      note.preCadentialMeasure = preCadentialMeasure
      note.cadentialMeasure = cadentialMeasure
      note.cadentialNote = cadentialNote
    }
  }

  for (let i = 0; i < chordMeasures.length; i++) {
    let cm = chordMeasures[i]
    let cc = new CircularCursor(cm)
    let firstChord = cc.next()
    melody[i].notes[0].name = randomFromArray(key.chordTonesForRomanNumeral(firstChord))
    melody[i].notes[0].chordSymbol = firstChord
    assignOctaveRandomly(melody[i].notes[0])
    //Octave
  }

  for (let i = 0; i < melody.length; i++) {
    let melodyNotes = melody[i].notes
    let availableChords = chordMeasures[i]
    let min =  randomFromArray(range(Math.ceil(melodyNotes.length / availableChords.length) - 1))//0 to avg
    if (min <= 0) min = 1
    let groups = randomGroupingPreservingOrder(melodyNotes, availableChords.length, min)

    for (let j = 0; j < groups.length; j++) {
      let chordForThisGroup = availableChords[j]
      groups[j].filter(n=> n).forEach(n => {
        n['chordSymbol'] = chordForThisGroup
        n.name = randomFromArray(key.chordTonesForRomanNumeral(chordForThisGroup).slice(0, 3))
        assignOctaveRandomly(n)
      })
    }
    // logJson(groups)
  }

  //Make tied notes same pitch
  let notes = melody.flatMap(it => it.notes)
  for (let i = 1; i < notes.length; i++) {
    if(notes[i].tie === "stop") {
      //Assuming that previous note is tie=start
      notes[i].name = notes[i-1].name
      // notes[i].chordSymbol = ''
      notes[i].fullName = notes[i].name + notes[i].octave
    }
  }
}

let undoList = []
let onGenerateChordMelodyClick = e => {
  //Assume rhythm is generated
  //Chord progression is selected
  //Melody will be based on chord progression

  //SimpleStrategy: If similarity in rhythm is "too" low, compensate it by similarity in notes
  //SimpleStrategy: Choose level/degree of mixture from neighboring chords for melody notes
  //Add arpeggio randomly
  //Leap strategy: One leap at max, Avoid Leap in last measure
  //Phrase-Ending: Drop in number of pitches, octaves

  undoList.push([fretboard.melodyBeingPlayed, fretboard.melodyBeingPlayedInKey])
  let selectedChordProgression = $("select.progressions").val().split("-").map(it => it.trim())
  let chordMeasures = distributeChords(selectedChordProgression, fretboard.melodyBeingPlayed.length, fretboard.melodyBeingPlayed.map(it => it.notes))

  logJson(chordMeasures, fretboard.melodyBeingPlayedInKey)
  distributeChordNotes(chordMeasures, fretboard.melodyBeingPlayedInKey, fretboard.activeKey)

  fretboard.melodyBeingPlayed = melodyWithoutContextOfKey(fretboard.melodyBeingPlayedInKey, fretboard.activeKey)
  mxml.loadMelody(fretboard.melodyBeingPlayedInKey, fretboard.activeKey, selectedMeter)
  loadMainOSMD(mxml.toString());
}

$(document).ready(e => {
  $('#meterSelect').select2({tags: true, theme: "classic"}).hide();
  $('#generateRhythmBtn').click(onGenerateRhythmClick)
  $('#generateChordMelodyBtn').click(onGenerateChordMelodyClick)

})


