$('#toggleFretboardBtn').click()

function getNotesFromHtml() {
  return $('.vf-notehead').toArray().map(it => $(it).data()).filter(it => Object.keys(it).length > 0);
}

/**
 * Returns syllables based on note duration. Takes care of ties.
 * @param measures
 * @returns {*}
 */
function getRhythmCounting(measures) {
  let durations = []

  let tieStarted = false, durationsForMeasure = [], runningTieDuration = 0
  for (let i = 0; i < measures.length; i++) {
    let measureNotes = measures[i].notes
    let howManyTiedInBeginningOfMeasure = 0
    for (let j = 0; j < measureNotes.length; j++) {
      let note = measureNotes[j];
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

let measures = [
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
  let lowestPitch = notesScanned[0].name
  return chordNotes.indexOf(lowestPitch)
}

/**
 *
 * @param notes
 * @param chordsToScan
 */
function matchingChords(notes, chordsToScan) {
  //TODO: Block vs Broken chords
  let matches = []

  let noteNames = notes.map(it => it.name)

  Object.keys(chordsToScan).forEach(name => {
    let chordNotes = chordsToScan[name].notes
    if(chordNotes.length === 4) chordNotes.splice(2, 1)

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
function guessChordsForMeasure(measureNumber, notes) {
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

  let steps = Object.values(groupBy(notes, 'step'))
  let possibleChords = []

  let start = 0, notesScanned = []
  while (start < steps.length) {
    notesScanned = notesScanned.concat(steps.slice(start, start + 2)).flat()
    let matches = matchingChords(notesScanned, allChords)
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
    let [currentStart, currentEnd] = fn(items[i])
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

function guessChords() {
  let noteheadData = getNotesFromHtml()
  if(!noteheadData.length) {
    populateNoteheadData(osmds[0], mxml.xml);
    noteheadData = getNotesFromHtml()
  }
  let measures = groupBy(noteheadData, 'measure')

  Object.keys(measures).forEach(mIdx => {
    let chords = guessChordsForMeasure(i, measures[mIdx]).map(it => it.chords).flat()

    chords.forEach(c => {
      c.notes.sort((a, b) => a.step - b.step)
      let x2 = c.notes[c.notes.length - 1].left
      c.x1 = c.notes[0].left;
      c.x2 = x2
    })

    // Remove duplicates: if there's A, A continuously, the result will be single A
    chords = groupBy(chords, 'name', (name, cs) => {
      let yy = merge(cs, it => [it.x1, it.x2]).flat()
      let unified = yy[0]
      unified.x2 = yy.last().x2
      return unified
    })

    let resetAllNotesInMeasure = () => {
      chords.map(c => c.notes).flat().forEach(n => {
        let x = noteheadCache[n['cacheIndex']]
        x.el.find("path").attr("fill", x.color)
      })
    }

    //Remove redundant chords e.g. if there's A7 and A, remove A
    let final = []
    merge(chords, it => [it.x1, it.x2]).forEach(range => {
      let res = groupBy(range, chord => chord.chordTones[0], (scaleNote, variations) => {
        return variations.sort((a, b) => b.chordTones.length - a.chordTones.length)[0]
      })
      final.push(res)
    })

    final = final.flat()

    let measureBottom = Math.max(...chords.flatMap(c => c.notes.map(n => n.offsetTop)))
    let $osmdContainer1 = $('#osmdContainer1');

    let occupied = []
    final.forEach(c => {
      let m = mIdx
      let mp = $osmdContainer1.offset()
      let inv = findInversion(c.notes, c.chordTones)
      c.inversion = inv
      let x2 = Math.max(...chords.flatMap(c => c.notes.map(n => n.left))) - mp.left

      let left = c.x1 - mp.left;
      let y = measureBottom - mp.top + 35;

      occupied.forEach(o => {
        let topCollides = y >= o.t && y < o.t + o.h
        let leftCollides = left <= o.l + o.w
        if (topCollides && leftCollides) {
          y = o.t + o.h
          // left = o.l + o.w + 15
        }
      })

      let w = Math.min(c.x2 - c.x1);

      let name = normaliseChordName(c.name)
      if (inv !== undefined) {
        inv = {0: "", 1: "a", 2: "b", 3: "c"}[inv] || ""
      }
      let box = $(`<div>${name} <sup>${inv}</sup></div>`).css({
        position: 'absolute',
        background: 'cyan',
        left: left,
        top: y + 10,
        height: 28,
        cursor: 'pointer'
      })
      $osmdContainer1.append(box)
      box.click(e => {
        resetAllNotesInMeasure()
        let notes = c.notes.map(n => noteheadCache[n['cacheIndex']].el)
        notes.forEach(n => n.find("path").attr("fill", "blue"))
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
  let osmdPageOffset = $('#osmdContainer1').offset();
  if (measureBackgrounds[measureNumber]) {
    return measureBackgrounds[measureNumber]
  }

  let convertToSyllables = durations => {
    return durations.map(it => DURATION_TO_SYLLABLE[it] || '').join(" ")
  }

  let bb = $(`<div class="measure-background"> <span ></span></div>`).css({
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
function analyseRhythmSimilarity(measures) {
  measureBackgrounds = {}
  let durations = getRhythmCounting(measures)

  let encodeDuration = it => {
    let keys = Object.keys(DURATION_TO_SYLLABLE);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === it) {
        return i + 1
      }
    }
    return 0
  }

  let decodeDuration = it => {
    let keys = Object.keys(DURATION_TO_SYLLABLE);
    for (let i = 0; i < keys.length; i++) {
      if (DURATION_TO_SYLLABLE[keys[i]] === it) {
        return i + 1
      }
    }
    return 0
  }

  let rhythmToMeasuresMap = {}
  for (let i = 0; i < durations.length; i++) {
    let it = durations[i]
    let rhythm = it.map(encodeDuration).join("")
    let ms = rhythmToMeasuresMap[rhythm] || []
    ms.push(i)
    rhythmToMeasuresMap[rhythm] = ms
  }

  let rhythmsInDecreasingOrderOfOccurrence = Object.keys(rhythmToMeasuresMap)
    .sort((a, b) => rhythmToMeasuresMap[b].length - rhythmToMeasuresMap[a].length)

  let similarities = generatePairs(rhythmsInDecreasingOrderOfOccurrence).map(pair => {
    let [rhythm1, rhythm2] = pair.map(it => it.item)

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
    let bb = getBoundingBox(i, getMeasurePosition(i), 'yellow')
    $("#osmdCanvasPage1").append(bb)
  })

  let rhythm = rhythmsInDecreasingOrderOfOccurrence[i]
  let nodes = new vis.DataSet(Object.keys(rhythmToMeasuresMap).map(it => ({id: it, label: it})))

  let edges = new vis.DataSet(similarities.filter(it => it.similarity > 0.4).map(it => ({
    from: it.rhythm1,
    to: it.rhythm2
  })))

  let $rhythmAnalysisDialog = $('#rhythmAnalysisDialog');
  window.rhythmNetwork = new vis.Network($rhythmAnalysisDialog.find(".content")[0], {nodes, edges}, {
    interaction: {hover: true},
  });

  $(".measure-background").removeClass("highlighted").hide()
  window.rhythmNetwork.on("click", e => {
    let clickedRhythm = e.nodes[0]
    $(".measure-background").removeClass("highlighted").hide()
    rhythmToMeasuresMap[clickedRhythm].forEach(mi => {
      let bb = getBoundingBox(mi, getMeasurePosition(mi))
      bb.addClass("highlighted").show()
    })
    log(1)
  })
  $rhythmAnalysisDialog.dialog({width: 400,height: 300}).show()

  return {
    similarities: similarities
  }
}

