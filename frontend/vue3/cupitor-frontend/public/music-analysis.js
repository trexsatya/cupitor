import {
  durationTypeToNumber,
  durationType,
  DURATION_TO_SYLLABLE,
  allChords, normaliseChordName
} from './music-reference-data.js';
import {nTimes, generatePairs, number, equals, groupBy, log} from './data-structures.js';

$('#toggleFretboardBtn').click()

/**
 *
 * @param osmd OSMD object
 * @returns {*[]}
 */
const getHtmlElementsForStaffNoteHeads = (osmd) => {
  const result = []
  const measureLists = osmd.graphic.measureList

  let vfNoteId = 0
  let prevKeySignature = undefined
  for (let a = 0; a < measureLists.length; a++) {
    const measures = measureLists[a]
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i]
      if(!measure) continue
      let ks = measure.stave.modifiers.find(it => it.attrs.type === "KeySignature")
      ks = ks && ks.keySpec
      if(!ks) ks = prevKeySignature
      else prevKeySignature = ks

      const staffEntries = measure.staffEntries
      for (let j = 0; j < staffEntries.length; j++) {
        const staff = staffEntries[j]
        const voices = staff.graphicalVoiceEntries
        for (let k = 0; k < voices.length; k++) {
          const voice = voices[k]
          const notes = voice.notes
          for (let l = 0; l < notes.length; l++) {
            const sourceNote = notes[l].sourceNote
            const vfnotes = notes[l].vfnote
            const vfnoteIndex = notes[l].vfnoteIndex
            const vfpitch = notes[l].vfpitch
            if(!vfnotes) continue
            const nhds = $(vfnotes[0].attrs.el).find(".vf-notehead").toArray();
            if(!nhds.length) continue
            const noteHeadEl = nhds[vfnoteIndex];
            const lyricEntryWithId = Object.values(sourceNote.voiceEntry.lyricsEntries.table).map(Object.values).flat().find(it => it.text && it.text.startsWith("id="));
            let id = null
            if(lyricEntryWithId) {
              id = lyricEntryWithId.text.slice(3)
              id = number(id)
              if (vfnotes[0].note_heads.length > 1) {
                id = id - vfnotes[0].note_heads.length + vfnoteIndex + 1
              }
            }

            result.push({
              staveNoteEl: vfnotes[0].attrs.el, // vfnotes[1] must be equal to vfnoteIndex
              noteHeadEl: noteHeadEl,
              key: vfnotes[0].keys[vfnoteIndex], //Assuming ordered from below to up
              pitch: vfpitch, //undefined for rests
              sourceNote: sourceNote, //From sourceNote everything else can be reached e.g.: osmd.rules.GNote(x[43].sourceNote)
              measureList: a,
              measure: i,
              voice: voice,
              id: id,
              keySignature: ks,
              vfNoteId: vfNoteId++
            })
          }
        }
      }
    }
  }
  return result
}

/**
 * Use OSMD internal details to find the screen position of measure. Position is relative to the OSMD page div
 * @param measureNumber
 * @param osmd
 * @returns {{top, left: (number|*), width: null, height}}
 */
function getMeasurePosition(measureNumber, osmd) {
  osmd = osmd || osmds[0]
  const st = osmd.graphic.measureList[measureNumber][0].stave
  const off = $(st.context.element).offset()
  let w = null
  if (st.end_x) w = st.end_x - st.start_x
  else w = st.width
  return {top: st.y, left: st.start_x, width: w, height: st.height}
}

export function populateNoteheadData(osmd, jqueryXml) {
  window.noteheadCache = {}
  const result = getHtmlElementsForStaffNoteHeads(osmd)
  let clefChange = jqueryXml.find("clef-octave-change").text()
  if (clefChange) clefChange = parseInt(clefChange)

  const accMap = {0: "#", 2: '', 1: 'b'}
  result.forEach(it => {
    let step = '', octave = ''
    if(it.pitch) {
      step = it.pitch[0].split("/")[0]
      octave = it.pitch[0].split("/")[1]
    }

    step = step.replace("n", "").toUpperCase()
    octave = parseInt(octave.trim())

    if (clefChange) octave += clefChange
    const accidental = (it.sourceNote.pitch && accMap[it.sourceNote.pitch.accidental]) || (it.pitch && it.pitch[1]) || ""
    const duration = it.sourceNote.length.numerator + "/" + it.sourceNote.length.denominator
    const voiceId = it.voice.parentVoiceEntry.parentVoice.voiceId
    const $noteheadEl = $(it.noteHeadEl);
    $noteheadEl.css({position: "absolute"})
    const offset = $noteheadEl.offset()
    const offtop = (offset && offset.top) || 0
    const offleft = (offset && offset.left) || 0
    const measurePos = getMeasurePosition(it.measureList, osmd)
    const mtop = measurePos && measurePos.top

    //TODO: use osmd.rules.NoteToGraphicalNoteMap for note data like name, octave, measure, voice etc, that will be more stable
    const left = offset && Math.floor(offset.left);
    $noteheadEl.data("name", step + accidental)
        .data("octave", octave)
        .data("duration", duration)
        .data("voice", voiceId)
        .data("measure", it.measureList)
        .data("top", Math.floor( offtop - (mtop || 0) ))
        .data("offsetTop", offtop)
        .data("offsetLeft", offleft)
        .data("left", left)
        .data("right", Math.ceil(left + $noteheadEl.width()))
        .data("id", it.id)
        .data("keySignature", it.keySignature)
  })

  //Add horizontal line info
  const yset = new Set()
  const noteheads = $('.vf-notehead');
  noteheads.toArray().map($).forEach(it => {
    yset.add(it.data("top"))
  })
  let map = {}
  const ylist = Array.from(yset)
  ylist.sort();
  ylist.forEach((e, i) => map[e] = i);
  noteheads.toArray().map($).forEach((it, i) => {
    noteheadCache[i] = {el: it, color: it.find("path").attr("fill")}
    it.data("line", map[it.data("top")]).data("cacheIndex", i)
  })

  //Add vertical line info
  const xset = new Set()
  noteheads.toArray().map($).forEach(it => {
    xset.add([it.data("left"), it.data("right"), it.data("measure")])
  })
  map = {}
  const xlist = Array.from(xset)
  xlist.sort((a, b) => a[0] - b[0]);
  xlist.forEach((e, i) => map[e] = i);
  noteheads.toArray().map($).forEach((it, i) => {
    const l = it.data("left"), r = it.data("right"), m = it.data("measure")
    let xId = -1
    for (let j = 0; j < xlist.length; j++) {
      const xn = xlist[j]
      if(xn[2] === m && xn[0] <= l && l <= xn[1]) {
        xId = j
        break
      }
    }
    if(xId >= 0) {
      it.data("x", xId)
    }
  })
}

export function getNotesFromHtml() {
  const fn = () => $('.vf-notehead').toArray().map(it => $(it).data()).filter(it => Object.keys(it).length > 0);
  let noteheadData =  fn();
  if(!noteheadData.length) {
    populateNoteheadData(osmds[0], mxml.xml);
    noteheadData =  fn()
  }
  return noteheadData
}

/**
 * Returns syllables based on note duration. Takes care of ties.
 * @param measures
 * @returns {*}
 */
function getRhythmCounting(measures) {
  const durations = []

  let tieStarted = false, durationsForMeasure = [], runningTieDuration = 0
  for (let i = 0; i < measures.length; i++) {
    const measureNotes = measures[i].notes
    let howManyTiedInBeginningOfMeasure = 0
    for (let j = 0; j < measureNotes.length; j++) {
      const note = measureNotes[j];
      if (note.tie === "start") {
        tieStarted = true
        runningTieDuration = durationTypeToNumber(note.type)
      } else if (note.tie === "stop") {
        runningTieDuration += durationTypeToNumber(note.type)
        durationsForMeasure.push(durationType(runningTieDuration))
        // durations[i] = durationsForMeasure
        durations.push(durationsForMeasure)
        durationsForMeasure = []
        howManyTiedInBeginningOfMeasure += 1
        nTimes(howManyTiedInBeginningOfMeasure, () => durationsForMeasure.push(" "))
        tieStarted = false
        howManyTiedInBeginningOfMeasure = 0
      } else if (tieStarted) {
        howManyTiedInBeginningOfMeasure += 1
        runningTieDuration += durationTypeToNumber(note.type)
      } else {
        durationsForMeasure.push((note.dot ? "dotted-" : "") + note.type)
      }
    }

    if (!tieStarted) {
      // durations[i] = durationsForMeasure
      durations.push(durationsForMeasure)
      durationsForMeasure = []
    }
  }
  return durations;
}

const measures = [
  {
    notes: [{name: "A", type: "quarter"}, {name: "A", type: "eighth"}, {
      name: "A",
      type: "quarter",
      tie: "start"
    }]
  },
  {
    notes: [{name: "A", type: "quarter", tie: "stop"}, {name: "A", type: "eighth"}, {
      name: "A",
      type: "quarter"
    }]
  },
  {
    notes: [{name: "A", type: "quarter"}, {name: "A", type: "eighth", tie: "start"}, {
      name: "A",
      type: "quarter"
    }]
  },
  {
    notes: [{name: "A", type: "quarter"}, {name: "A", type: "eighth", tie: "stop"}, {
      name: "A",
      type: "quarter"
    }]
  },
]

console.log(measures, getRhythmCounting(measures))

function findInversion(notesScanned, chordNotes) {
  notesScanned.sort((a, b) => b.line - a.line)
  const lowestPitch = notesScanned[0].name
  return chordNotes.indexOf(lowestPitch)
}

/**
 *
 * @param notes
 * @param chordsToScan
 */
function matchingChords(notes, chordsToScan) {
  //TODO: Block vs Broken chords
  const matches = []

  const noteNames = notes.map(it => it.name)

  Object.keys(chordsToScan).forEach(name => {
    const chordNotes = chordsToScan[name].notes
    //if(chordNotes.length === 4) chordNotes.splice(2, 1)

    if (chordNotes.every(n => noteNames.includes(n))) {
      matches.push({
        name: name,
        notes: notes.filter(it => chordNotes.includes(it.name)),
        chordTones: chordNotes,
        inversion: findInversion(notes, chordNotes)
      })
    }
  })

  return matches
}


/**
 *
 * @param measureNumber
 * @param notes notes in the measure
 * @returns {[]|*[]}
 */
export function guessChordsForMeasure(measureNumber, notes) {
  if (!notes || measureNumber === undefined) return []

  let xs = new Set()
  notes.forEach(n => {
    xs.add(n.left)
  })
  xs = Array.from(xs)
  xs.sort()
  notes.forEach(n => {
    n.step = xs.indexOf(n.left)
  })

  const steps = Object.values(groupBy(notes, 'step'))
  const possibleChords = []

  let start = 0, notesScanned = []
  while (start < steps.length) {
    notesScanned = notesScanned.concat(steps.slice(start, start + 2)).flat()
    const matches = matchingChords(notesScanned, allChords)
    // if(!matches.length) {
    //   matches = matchingChords(notesScanned, allChords)
    // }
    if (matches && matches.length) {
      possibleChords.push({range: [start, start + 2], notes: notesScanned, chords: matches})
      notesScanned = []
    }
    start += 1
  }

  return possibleChords
}

const merge = (items, fn) => {
  if (items.length < 2) return [items];

  items.sort((a, b) => fn(a)[0] - fn(b)[0]);

  const result = [];
  let previous = [items[0]];
  let [previousStart, previousEnd] = fn(items[0])

  for (let i = 1; i < items.length; i += 1) {
    const [currentStart, currentEnd] = fn(items[i])
    if (previousEnd >= currentStart) {
      previousEnd = Math.max(previousEnd, currentEnd)
      previous.push(items[i])
    } else {
      result.push(previous);
      previous = [items[i]];
      [previousStart, previousEnd] = fn(items[i])
    }
  }

  result.push(previous);

  return result;
};

let clickTimer = null;

export function guessChords() {
  const noteheadData = getNotesFromHtml()

  const measures = groupBy(noteheadData, 'measure')

  function markNotesInSheet(c) {
    const notes = c.notes.map(n => noteheadCache[n['cacheIndex']].el)
    notes.forEach(n => n.find("path").attr("fill", "blue").css({fill: 'blue'}))
  }

  Object.keys(measures).forEach(mIdx => {
    const notesInMeasure = measures[mIdx]
    let chords = guessChordsForMeasure(mIdx, notesInMeasure).map(it => it.chords).flat()

    chords.forEach(c => {
      c.notes.sort((a, b) => a.step - b.step)
      const x2 = c.notes[c.notes.length - 1].left
      c.x1 = c.notes[0].left;
      c.x2 = x2
    })

    // Remove duplicates: if there's A, A continuously, the result will be single A
    chords = groupBy(chords, 'name', (name, cs) => {
      const yy = merge(cs, it => [it.x1, it.x2]).flat()
      const unified = yy[0]
      unified.x2 = yy.last().x2
      return unified
    })

    const resetAllNotesInMeasure = () => {
      chords.map(c => c.notes).flat().forEach(n => {
        const x = noteheadCache[n['cacheIndex']]
        x.el.find("path").attr("fill", x.color).css({fill: x.color})
      })
    }

    //Remove redundant chords e.g. if there's A7 and A, remove A
    let final = []
    merge(chords, it => [it.x1, it.x2]).forEach(range => {
      const res = groupBy(range, chord => chord.chordTones[0], (scaleNote, variations) => {
        return variations.sort((a, b) => b.chordTones.length - a.chordTones.length)[0]
      })
      final.push(res)
    })

    final = final.flat()

    const measureBottom = Math.max(...chords.flatMap(c => c.notes.map(n => n.offsetTop)))
    const $osmdContainer1 = $('#osmdContainer1');

    const occupied = []
    final.forEach(c => {
      const mp = $osmdContainer1.offset()
      let inv = findInversion(c.notes, c.chordTones)
      c.inversion = inv
      const x2 = Math.max(...chords.flatMap(c => c.notes.map(n => n.left))) - mp.left

      const left = c.x1 - mp.left;
      let y = measureBottom - mp.top + 35;

      occupied.forEach(o => {
        const topCollides = y >= o.t && y < o.t + o.h
        const leftCollides = left <= o.l + o.w
        if (topCollides && leftCollides) {
          y = o.t + o.h
          // left = o.l + o.w + 15
        }
      })

      const w = Math.min(c.x2 - c.x1);

      const name = normaliseChordName(c.name)
      if (inv !== undefined) {
        inv = {0: "", 1: "a", 2: "b", 3: "c"}[inv] || ""
      }
      const box = $(`<div>${name} <sup>${inv}</sup></div>`).css({
        position: 'absolute',
        background: 'cyan',
        left: left,
        top: y + 10,
        height: 28,
        cursor: 'pointer'
      }).addClass('analysed-chord-name')

      $osmdContainer1.append(box)
      box.click(e => {
        if (clickTimer) return; // already waiting for potential double click
        clickTimer = setTimeout(() => {
          resetAllNotesInMeasure()
          markNotesInSheet(c);
          fretboard.showOnlyTheseNotes(notesInMeasure.filter(it => c.notes.map(x => x.name).contains(it.name)).map(_cn => fretboard.findNoteOnFretboard(_cn)).flat())
          clickTimer = null;
        }, 250); // wait a bit to see if dblclick happens
      })
      box.dblclick(e => {
        clearTimeout(clickTimer);
        clickTimer = null;

        markNotesInSheet(c)
        const notesToShow = notesInMeasure.filter(it => c.notes.map(x => x.name).contains(it.name)).map(_cn => fretboard.findNoteOnFretboard(_cn)).flat();
        notesToShow.forEach(it => {
          fretboard.showNote(it.string, it.fret, {opacity: 0.5}, it.note)
        })
      })
      occupied.push({t: y, l: left, w: box.width(), h: 28})
    })
  })
}

let measureBackgrounds = {}
/**
 * Creates an HTML div under the measure
 * @param measureNumber
 * @param pos
 * @param color
 * @param opacity
 * @returns {null|*}
 */
function getBoundingBox(measureNumber, pos, color, opacity) {
  const osmdPageOffset = $('#osmdContainer1').offset();
  if (measureBackgrounds[measureNumber]) {
    return measureBackgrounds[measureNumber]
  }

  const convertToSyllables = durations => {
    return durations.map(it => DURATION_TO_SYLLABLE[it] || '').join(" ")
  }

  const bb = $(`<div class="measure-background"> <span ></span></div>`).css({
    position: 'absolute',
    top:  pos.top,
    left: pos.left,
    background: color || 'white',
    width: pos.width,
    height: pos.height,
    zIndex: -90,
    opacity: opacity || 1,
    display: 'none'
  })
  measureBackgrounds[measureNumber] = bb
  // container.append(bb)

  return bb
}


// log(guessChord())

/**
 * Finds similarity among measures based on rhythm durations.
 * @param measures
 * @returns {{similarities: (null|{rhythm2: *, rhythm1: *, similarity: *})[]}}
 */
export function analyseRhythmSimilarity(measures) {
  measureBackgrounds = {}
  const durations = getRhythmCounting(measures)

  const encodeDuration = it => {
    const keys = Object.keys(DURATION_TO_SYLLABLE);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === it) {
        return i + 1
      }
    }
    return 0
  }

  const decodeDuration = it => {
    const keys = Object.keys(DURATION_TO_SYLLABLE);
    for (let i = 0; i < keys.length; i++) {
      if (DURATION_TO_SYLLABLE[keys[i]] === it) {
        return i + 1
      }
    }
    return 0
  }

  const rhythmToMeasuresMap = {}
  for (let i = 0; i < durations.length; i++) {
    const it = durations[i]
    const rhythm = it.map(encodeDuration).join("")
    const ms = rhythmToMeasuresMap[rhythm] || []
    ms.push(i)
    rhythmToMeasuresMap[rhythm] = ms
  }

  const rhythmsInDecreasingOrderOfOccurrence = Object.keys(rhythmToMeasuresMap)
    .sort((a, b) => rhythmToMeasuresMap[b].length - rhythmToMeasuresMap[a].length)

  const similarities = generatePairs(rhythmsInDecreasingOrderOfOccurrence).map(pair => {
    const [rhythm1, rhythm2] = pair.map(it => it.item)

    if (!(rhythm1 || rhythm1)) {
      log("Problem in measure", pair)
      return null
    }
    if (equals(rhythm1, rhythm2)) {
      return null
    }

    let sim = stringSimilarity.compareTwoStrings(rhythm1, rhythm2)
    sim = Math.round((sim + Number.EPSILON) * 100) / 100 //Rounded to 2 decimals

    return {
      rhythm1: rhythm1,
      rhythm2: rhythm2,
      similarity: sim
    }
  }).filter(it => it);

  measures.forEach((m, i) => {
    const bb = getBoundingBox(i, getMeasurePosition(i), 'yellow')
    $("#osmdCanvasPage1").append(bb)
  })

  //const rhythm = rhythmsInDecreasingOrderOfOccurrence[i]
  const nodes = new vis.DataSet(Object.keys(rhythmToMeasuresMap).map(it => ({id: it, label: it})))

  const edges = new vis.DataSet(similarities.filter(it => it.similarity > 0.4).map(it => ({
    from: it.rhythm1,
    to: it.rhythm2
  })))

  const $rhythmAnalysisDialog = $('#rhythmAnalysisDialog');
  window.rhythmNetwork = new vis.Network($rhythmAnalysisDialog.find(".content")[0], {nodes, edges}, {
    interaction: {hover: true},
  });

  $(".measure-background").removeClass("highlighted").hide()
  window.rhythmNetwork.on("click", e => {
    const clickedRhythm = e.nodes[0]
    $(".measure-background").removeClass("highlighted").hide()
    rhythmToMeasuresMap[clickedRhythm].forEach(mi => {
      const bb = getBoundingBox(mi, getMeasurePosition(mi))
      bb.addClass("highlighted").show()
    })
    log(1)
  })
  $rhythmAnalysisDialog.dialog({width: 400,height: 300}).show()

  return {
    similarities: similarities
  }
}

