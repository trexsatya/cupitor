const debug = false; //Enable/disable debug
const defaultSet = { //vars}
  notes: { //1-based string, 1st string highest
    6: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'],
    5: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', "A"],
    4: ['D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D'],
    3: ['G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G'],
    2: ['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    1: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'],
  },
  noteMarkers: {
    6: [null, null, null, null, null, null, null, null, null, null, null, null, null],
    5: [null, null, null, null, null, null, null, null, null, null, null, null, null],
    4: [null, null, null, null, null, null, null, null, null, null, null, null, null],
    3: [null, null, null, null, null, null, null, null, null, null, null, null, null],
    2: [null, null, null, null, null, null, null, null, null, null, null, null, null],
    1: [null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  octaves: {
    6: ['2', '2', '2', '2', '2', '2', '2', '2', '3', '3', '3', '3', '3', '3', '3', '3', '3'],
    5: ['2', '2', '2', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '4', '4'],
    4: ['3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '4', '4', '4', '4', '4', '4', '4'],
    3: ['3', '3', '3', '3', '3', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4'],
    2: ['3', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '5', '5', '5', '5'],
    1: ['4', '4', '4', '4', '4', '4', '4', '4', '5', '5', '5', '5', '5', '5', '5', '5', '5']
  },
  options: '#options',
  messageBox: '#message',
  controls: '#controls',
  guitarNeck: '.guitar-neck',
  strings: ['E', 'a', 'd', 'g', 'b', 'e'],
  message: 'Guitar Fretboard Trainer',
  active: false,
  activeNote: ''
};

const tips = [
  "Melodic Phrasing: <span class='highlighted'>Question Answer Format</span>",
  "Melodic Line: <span class='highlighted'>Scale Fragment</span>",
  "Melodic Line: <span class='highlighted'>Sequencing</span>",
  "Melodic Embellishment: <span class='highlighted'>Add slurs</span>",
  "Melodic Embellishment: <span class='highlighted'>Add slides</span>",
  "Melodic Embellishment: <span class='highlighted'>Add trills</span>",
  "Melodic Embellishment: <span class='highlighted'>Add grace notes</span>",
  "Melodic Embellishment: <span class='highlighted'>Add vibrato</span>",
  "Harmonic Embellishment: <span class='highlighted'>Add <a href='https://musictheory.pugetsound.edu/mt21c/Suspension.html' target='_blank'> suspension</a></span>",
  "Harmonic Embellishment: <span class='highlighted'>Add <a href='https://www.harmony.org.uk/book/voice_leading/appoggiatura.htm' target='_blank'> appogiatura</a></span>",
  "Harmonic Embellishment: <span class='highlighted'>Add <a href='https://musictheory.pugetsound.edu/mt21c/Anticipation.html' target='_blank'> anticipation</a></span>",
  "Musicality: <span class='highlighted'>Play in Time!</span>",
  "Musicality: <span class='highlighted'>Apply dynamics</span>",
  "Musicality: <span class='highlighted'>Mix thick voice melody and thin voice melody</span>",
  "Accompaniment:<span class='highlighted'> Block Chords</span>",
  "Accompaniment: <span class='highlighted'>Rolled Chords</span>",
  "Accompaniment: <span class='highlighted'>Alberti Bass</span>",
  "Accompaniment: <span class='highlighted'>Break Chord partially</span>",
  "Accompaniment: <span class='highlighted'>Break Chord partially</span>",
  "Rhythmic Embellishment: <span class='highlighted'>Add smaller notes</span>",
  "Generic: <span class='highlighted'>Add strumming</span>",
  "Generic: <span class='highlighted'>Try Rest Stroke</span>",
  "Generic: <span class='highlighted'>R E L A X!</span>",
]

function chordTonesForHarmony(harmony, key) {
  if (!key) {
    const i = ['#', 'b'].includes(harmony.substr(1, 1)) ? 2 : 1
    const name = harmony.substr(0, i)
    const allAfterName = harmony.substr(i)
    return chordPatterns[allAfterName] && chordPatterns[allAfterName](notesInScale(majorScales, name))
  }
  let chordTones
  if (!romanToInt(harmony)) {
    harmony = harmony.replaceAll("m", "").replaceAll("o", "")
    chordTones = key.chordTonesForNote(harmony).flat()
  } else {
    chordTones = key.chordTonesForRomanNumeral(harmony)
  }
  return chordTones;
}

function deduplicateChords(chords) {
  chords = chords.map(c => _.sortBy(c, x => x.string))

  let deduplicated = []
  chords.forEach(c => {
    if(!deduplicated.find(d => _.isEqual(c, d))) deduplicated.push(c)
  })
  return deduplicated.filter(those => those.map(it => it.fret));
}

const Fretboard = function () {
  this.init = function (defaults) {
    this.active = defaults.active;
    this.notes = defaults.notes;
    this.octaves = defaults.octaves;
    this.options = defaults.options;
    this.messageBox = defaults.messageBox;
    this.controls = defaults.controls;
    this.guitarNeck = defaults.guitarNeck;
    this.strings = defaults.strings;
    this.message = defaults.message;
    this.activeNote = defaults.activeNote;
    this.noteMarkers = defaults.noteMarkers;
    this.activeKey = new Key('C')
    this.melodyBeingPlayedInKey = null
    this.melodyBeingPlayed = null
    this.setHeader(this.message);

    Object.keys(this.notes).forEach(str => {
      for (let i = 0; i < this.notes[str].length; i++) {
        this.showNote(str, i)
      }
      $(".note").css({opacity: 0}).hide()
    })
  };

  this.chordPatterns = chordPatterns

  this.notesInChord = (fullName) => {
    let type = Object.keys(chordPatterns).sort(sortByLength).find(it => fullName.endsWith(it))
    if (!type) type = "maj"
    const chordSymbol = fullName.replace(type, "")
    return fretboard.chordPatterns[type](notesInScale(majorScales, chordSymbol))
  }

  this.randomFretNumber = () => randomFromArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

  const removeSomeNotes = (notes, duplicates) => {
    const canBeRemoved = {}
    duplicates.forEach(d => canBeRemoved[d] = true)
    return notes.filter(it => {
      const random_boolean = Math.random() < 0.5;
      if (random_boolean && canBeRemoved[it.name]) {
        canBeRemoved[it.name] = false
        console.log("Removing ", it)
        return null
      }
      return it
    }).filter(it => it != null)
  }

  this.findChordNotesOnFretboard = (notes, position) => {
    const bassNote = notes[0]
    let bassString = null
    const maxStretch = 4

    const self = this;
    const selectedNotesOnString = (str) => {
      return self.notes[str].slice(position, position + maxStretch)
    }

    if (position === undefined || position === null) {
      position = this.randomFretNumber()
    }

    bassString = [6, 5, 4, 3, 2].find(str => {
      return selectedNotesOnString(str).indexOf(bassNote) >= 0
    })
    const noteIndexOnString = (noteName, str) => {
      const p = position || 0
      return self.notes[str].slice(p).indexOf(noteName) + position
    }
    let notesInChord = [{
      name: bassNote,
      string: bassString,
      fret: noteIndexOnString(bassNote, bassString)
    }]

    const otherNotes = notes
    const notesOnOtherStrings = () => {
      const notes = []
      let i = bassString - 1;
      while (i > 0) {
        const noteAvailableOnThisStr = otherNotes.find(it => selectedNotesOnString(i).indexOf(it) >= 0)
        if (noteAvailableOnThisStr) notes.push({
          name: noteAvailableOnThisStr,
          string: i,
          fret: noteIndexOnString(noteAvailableOnThisStr, i)
        })
        i = i - 1;
      }
      return notes
    }

    const others = notesOnOtherStrings()
    const duplicates = findDuplicates(others.map(it => it.name).concat(bassNote))

    notesInChord = notesInChord.concat(removeSomeNotes(others, duplicates))
    return {
      position: position,
      notesInChord: notesInChord
    }
  }

  const excludingLowerStrings = string => {
    const excluded = []
    for (let i = parseInt(string); i >= 1; i--) {
      excluded.push(i)
    }
    return excluded
  }

  /**
   * Harmony notes wil always be on strings above
   * @param melodyNote ({string, fret})
   * @param harmony e.g. I, IV etc
   * @param key ({...Key})
   */
  this.findHarmonyNotesForMelodyNote = (melodyNote, harmony, key) => {
    if (!harmony) return []
    key = key || this.activeKey
    const withinReach = (fretNote) => {
      if (fretNote.fret === 0) return true
      return Math.abs(fretNote.fret - melodyNote.fret) < 4;
    }
    let out = []

    let cts = chordTonesForHarmony(harmony, key);
    if (!cts.length) {
      cts = chordTonesForHarmony(harmony)
    }
    cts.forEach(tone => {
      out = out.concat(this.findNoteOnFretboard({name: tone}, excludingLowerStrings(melodyNote.string)).filter(it => withinReach(it)))
    })
    return out
  }

  this.getChords = (progression, musicKey) => {
    return progression.split("-").map(it => it.trim()).map(it => this.getChord(it, musicKey)).map(it => ({
      chord: it,
      chordNotes: this.notesInChord(it.symbol + it.quality)
    }))
  }

  this.chordsToPlay = []

  /**
   *
   * @param chordNotes
   * @returns e.g. [[{string: '6', fret: 12}]]
   */
  this.usefulChords = (chordNotes) => {
    return cartesian(...chordNotes.map(it => this.findNoteOnFretboard(it)).filter(it => it.length > 0)).filter(it => combinations(it, 2).every(this.isPlayable)).filter(notes => {
      const strs = notes.map(n => n.string)
      return _.uniq(strs).length === strs.length
    }).filter(it => it.length >= chordNotes.length)
      .filter(uniqueByJsonRepresentation);
  }

  function openStrings(notes) { return notes.filter(n => ['E', 'A', 'D', 'G', 'B'].includes(n) ) }

  this.isPlayable = it => it.map(x => x.fret).includes(0) || (Math.abs(it[0].fret - it[1].fret) <= 3)

  /**
   *
   * @param chordName e.g. Cmaj
   * @returns {T[]}
   */
  this.openChords = (chordName) => {
    const notes = allChords[chordName].notes

    const triadStringGroups = [
      [6, 4, 2], [5, 4, 2],
      [6, 4, 1], [5, 4, 1],
      [5, 3, 1], [4, 3, 1],
      [6, 3, 1], [5, 3, 1],
      [6, 3, 2], [5, 3, 2],
      [6, 5, 2], [6, 5, 1],
      [5, 4, 3], [3, 2, 1],
      [5, 2, 1], [4, 2, 1], [6, 2, 1], [4, 3, 2]
    ]

    const triadPermutations = permutate(notes)
    const matches = (strGroup, _notes) => {
      let positions = []
      for (let i = 0; i < _notes.length; i++) {
        const n = _notes[i]
        let found = this.findNoteOnFretboard({name: n}).filter(it => it.string + '' === strGroup[i] + '')
        if(found.length) positions.push(found)
      }
      return cartesian(...positions).filter(it => combinations(it, 2).every(this.isPlayable))
    }

    const ret = triadStringGroups.map(strs =>
        triadPermutations.map(tp => matches(strs, tp)).filter(_it => _it.length > 0)
    ).flat().flat()

    return ret
  }

  /**
   *
   * @param note ({name, octave})
   * @param excludedStrings
   * @returns [*{string, fret}]
   */
  this.findNoteOnFretboard = (note, excludedStrings) => {
    if (!note) return
    const givenOctave = note.octave
    excludedStrings = excludedStrings || []
    excludedStrings = excludedStrings.map(it => it + "")
    const strings = Object.keys(defaultSet.notes).reverse().filter(it => !excludedStrings.includes(it)) //1-6
    const out = []
    for (let i = 0; i < strings.length; i++) {
      const string = strings[i]
      const frets = defaultSet.notes[string]
      for (let j = 0; j < frets.length; j++) {
        let octaveMatches = true
        if (givenOctave) octaveMatches = (defaultSet.octaves[string][j] + "" === givenOctave + "")
        if (equalNotes(frets[j], note.name) && octaveMatches) {
          out.push({string: string, fret: j})
        }
      }
    }
    return out
  }

  /**
   *
   * @param notes [*{string, fret}]
   */
  this.showOnlyTheseNotes = (notes, cls) => {
    $('.note').hide().removeClass("highlight-as-harmony")

    if (!notes) return
    notes.forEach(it => {
      this.showNote(it.string, it.fret, cls)
    })
  }

  this.showRandomTip = () => {
    $("#tips").html(randomFromArray(tips))
  }

  this.playProgression = (progression) => {
    const prev = []
    const self = this;
    this.chordBeingPlayed = 0

    if (window.osmds[0] && window.osmds[0].cursor) {
      window.osmds[0].cursor.reset()
      window.osmds[0].cursor.show()
    }

    this.chordsToPlay = this.getChords(progression, this.activeKey.name())
    this.chordsToPlay.forEach(it => {
      it['fretboardNotes'] = this.findChordNotesOnFretboard(it.chordNotes)
      // Show chords on sheet music
      // it['fretboardNotes'].notesInChord.forEach(n => window.mxml.addNoteToLastMeasure(n))
      // window.mxml.addNoteToLastMeasure(it['fretboardNotes'].notesInChord[0])
      // it['fretboardNotes'].notesInChord.slice(1).forEach(n => window.mxml.addNoteToLastMeasure(n, 'chord', it.chord.symbol, it.chord.romanNumeral))
      // window.mxml.addRestToLastMeasure('half')
    })

    this.showRandomTip()

    const stopThisSchedule = false
    const lastMeasure = -1
    schedule(window.mxml.notes(), 2, (note, idx) => {
      const newMeasure = osmds[0].cursors[0].iterator.currentMeasureIndex
      const currentMelodyNote = this.melodyBeingPlayedInKey.map(it => it.notes).flat()[idx]

      log(this.findNoteOnFretboard(currentMelodyNote))

      if (newMeasure > lastMeasure) {
        // Get harmony notes

      }

      if (osmds[0].cursor.NotesUnderCursor().length > 0 && osmds[0].cursor.NotesUnderCursor()[0].isRest()) {
        // Rest note
      }
      window.osmds[0].cursor.next()
    }, x => {
      this.playFlag = true;
      // this.playProgression(progression)
    }, x => (self.playFlag === false || stopThisSchedule === true))
  }

  this.stopProgression = () => {
    this.playFlag = false
  }

  this.reset = function () {
    this.init(defaultSet);
    // $(this.guitarNeck).fadeOut(500);
  }

  this.setHeader = function (m) {
    $(this.messageBox).text(this.message);
  }

  this.noteClicked = (string, fret, note) => {
    const harmony = $("#diatonic-chords").find(".active").text().trim();
    if (harmony === '') {
      return
    }
    const notes = fretboard.findHarmonyNotesForMelodyNote({
      string: string,
      fret: fret,
      note: note
    }, harmony)
    $(".note.highlight-as-harmony").css({opacity: 0}).hide()
    $(".note").removeClass("highlight-as-harmony")

    notes.forEach(it => {
      const marker = fretboard.noteAt(it.string, it.fret).el
      if (marker) {
        $(marker).addClass("highlight-as-harmony").css({opacity: 1}).show()
      } else {
        log("Note not found for ", it)
      }
    })
  }

  this.noteAt = (str, fret) => {
    const name = this.notes[str][fret]
    const octave = this.octaves[str][fret]

    if(!this.noteMarkers[str][fret]) return null

    return {
      name: name, octave: octave, el: this.noteMarkers[str][fret]
    }
  }

  this.showNote = function (string, fret, cls) {
    const note = this.notes[string][fret];
    const ss = 7 - string;
    let leftDist, bottomDist;
    if (fret === 0) {
      leftDist = -42.5;
    } else {
      leftDist = ((fret - 1) * 80) + 15;
    }
    if ((ss - 1) === 0) {
      bottomDist = 0;
    } else {
      //var leftDist = left * 45;
      bottomDist = (ss - 1) * 42.5;
    }

    if (this.noteMarkers[string][fret] === null) {
      this.noteMarkers[string][fret] = $('<div>' + note + '</div>').addClass("note").data("string", string).data("fret", fret).data("note", note);
      $('.guitar-neck').append(this.noteMarkers[string][fret]);
      this.noteMarkers[string][fret].click(e => this.noteClicked(string, fret, note))
    }

    const noteMarker = this.noteMarkers[string][fret]

    $(noteMarker).css('left', leftDist);
    $(noteMarker).css('bottom', bottomDist);


    $(noteMarker).css({opacity: 1}).show();
  }

};

/**
 *
 * @param osmd OSMD object
 * @returns {*[]}
 */
const getHtmlElementsForStaffNoteHeads = (osmd) => {
  const result = []
  const measureLists = osmd.graphic.measureList

  let vfNoteId = 0
  for (let a = 0; a < measureLists.length; a++) {
    const measures = measureLists[a]
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i]
      if(!measure) continue
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
            let nhds = $(vfnotes[0].attrs.el).find(".vf-notehead").toArray();
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
              vfNoteId: vfNoteId++
            })
          }
        }
      }
    }
  }
  return result
}

function colorVoices(xml) {
  const colors = {
    "1": "#000000",
    "2": "#000000",
    "3": "#0d6efd",
    "4": "#000000"
  }
  xml.find("note").each((i, e) => {
    e = $(e)
    const voice = e.find("voice").text()
    if (voice)
      e.find("notehead").attr("color", colors[voice])

    if (e.find("notehead").length === 0) {
      e.append($(`<notehead>normal</notehead>`, xml).attr("color", colors[voice]))
    }
  })
}

function highlightNonChordTones(xml, key) {
  xml.find("note").each((i, e) => {
    e = $(e)
    let step = e.find("pitch>step").text()
    const pitch = e.find("pitch");

    if (pitch.find("alter").text() === '1') {
      step += "#"
    } else if (pitch.find("alter").text() === '-1') {
      step += "b"
    }

    if (!key.contains(step)) {
      e.find("notehead").text("diamond")
      if (e.find("notehead").length === 0) {
        e.append($(`<notehead>normal</notehead>`, xml).attr("color", colors[voice]))
      }
    }
  })
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

function removeTechnicalDetails(xml) {
  xml.find("technical").remove()
  xml.find("direction").remove()
}

window.noteheadCache = {}

function populateNoteheadData(osmd, jqueryXml) {
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

function hideIdTexts() {
  $('text:contains("id=")').parent().css({visibility: 'hidden'})
}

function populateNoteNames() {
  $('.note-name').remove()
  $('.vf-notehead path').css({fill: 'none', stroke: 'black', strokeWidth: 1})

  const poff = $('#osmdCanvasPage1').offset()
  getNotesFromHtml().forEach(n => {
    const $nn = $(`<span>${n.name}</span>`).addClass("note-name").css({position: 'absolute', left: n.offsetLeft - poff.left , top: n.offsetTop - poff.top -5, padding: 0})
    $('#osmdCanvasPage1').append($nn)
    if(!window.showNoteNames) $nn.hide()
  })
}

function loadMainOSMD(musicXml, height,) {
  const osmd = window.osmds[0];
  //TODO: Guess it based on the lowest octave
  // osmd.EngravingRules.StaffHeight = height || 25.0

  musicXml && mxml.loadXml(musicXml)
  const jqueryXml = mxml.xml
  // colorVoices(jqueryXml)
  removeTechnicalDetails(jqueryXml)
  // highlightNonChordTones(jqueryXml, fretboard.activeKey)

  return osmd.load(mxml.toString()).then(it => {
    osmd.render();
    populateNoteheadData(osmd, jqueryXml);
    hideIdTexts()
    populateNoteNames()
    return jqueryXml
  });
}


function chordExtensions(chordName) {
  // chordName = normaliseChordName(chordName)
  const sevenths =  ['7'].map(it => chordName + it).concat(chordName.endsWith("min") ? chordName + 'Maj7' : chordName.replace("maj", "") + '7');
  const ninths =  chordName + '+9'

  return sevenths.concat(ninths)
}

function usefulVersionsOfChord(chordName, fretboard) {
  return allVersionsOfChord(chordName).map(chord => {
    return chord.notesWithOctave.map((n, i) => ({
      name: n[0],
      octave: n[1],
      type: 'quarter',
      chord: i !== 0
    }))
  }).filter(it => fretboard.usefulChords(it).length > 0)
    .toSorted((a, b) => fretboard.usefulChords(b).length - fretboard.usefulChords(a).length);
}

/**
 *
 * @param chordsOnFretboard e.g. [[{string: '6', fret: 12}]]
 * @param fretboard
 */
function populateChordButtons(chordsOnFretboard, fretboard) {
  chordsOnFretboard = deduplicateChords(chordsOnFretboard)
  let cnt = 1
  const $chordNumbers = $('#chordNumbers');
  $chordNumbers.html('')
  chordsOnFretboard.forEach(it => {
    const $cnBtn = $(`<span>${cnt}</span>`).addClass("chord-number-btn").data("notes", it).click(e => {
      $('.chord-number-btn').removeClass("selected")
      $cnBtn.addClass("selected")
      fretboard.showOnlyTheseNotes(it)
    })
    if (it.find(x => x.fret === 0)) {
      $cnBtn.addClass("open-chord")
    }
    cnt += 1
    $chordNumbers.append($cnBtn)
  })

  fretboard.showOnlyTheseNotes(chordsOnFretboard[0])
}

/*** Contollers ***/
$(function () {
  //Initiate obj
  const fretboard = new Fretboard;

  fretboard.init(defaultSet)
  window.fretboard = fretboard;

  function populateChordProgressions() {
    $("select.progressions").html("")

    const isMinor = fretboard.activeKey.isMinor()
    const progressions = isMinor ? minorChordProgressions : majorChordProgressions
    Object.keys(progressions).forEach(key => {
      const $group = $('<optgroup></optgroup>').attr("label", key)
      progressions[key].forEach(it => {
        const displayHtml = it.displayHtml || it.displayText || it.data
        $group.append($(`<option>${displayHtml}</option>`).attr("value", it.data))
      })
      $("select.progressions").append($group)
    })
    $('.progressions').select2({tags: true, theme: "classic"}).hide();
  }

  const $diatonic = $('#diatonic-chords');
  const $neck = $('#guitar-neck')


  function showDiatonicChords() {
    $diatonic.html('').show()
    const i = 0
    const isMinor = fretboard.activeKey.isMinor()

    fretboard.activeKey.chords().forEach((it, idx) => {
      it = normaliseChordName(it)
      let fifth = ''
      const root = chordTonesForHarmony(it, fretboard.activeKey)[0]
      fifth = normaliseChordName(new Key(root).chords()[4])

      $diatonic.append($(`<li>
            ${idx === 4 ? `<span class="chord extra"> ${getTritoneNote(root)}7</span>` : ''}
            <span class="chord">${fifth} </span>
            <span class="chord">${it} </span>
        </li>`))
    })
    $($diatonic.find(".chord")[1]).addClass("active")
  }

  const $keyLabel = $('#keyLabel');

  function populateKeyDetail(keyName) {
    $keyLabel.text(keyName)
    populateChordProgressions()
    showDiatonicChords()
  }

  $keyLabel.click(e => {
    const keyName = fretboard.activeKey.name();
    const scale = getScale(keyName);

    $('#scaleContainer').html('')
    scale.forEach(n => {
      $('#scaleContainer').append(`<span>${n}</span>`)
    })

    if (fretboard.activeKey.isMinor()) {
      scale.slice(scale.length - 2).map(raiseNote).filter(it => it).forEach(n => {
        $('#scaleContainer').append(`<span class="extra">${n}</span>`)
      })
    }
  })

  const $app = $('#app');

  $diatonic.click(e => {
    if ($(e.target).hasClass("chord")) {
      $diatonic.find(".chord").removeClass("active")
      $(e.target).addClass("active")
    }
  })

  function minimizeCircleOfFifth() {
    $app.animate({
      width: 30,
      height: 30
    }, 2000, c => {
      // console.log("Minimised")
      $app.addClass("minimized")
    })
  }

  function restoreCircleOfFifth() {
    $app.animate({
      width: 300,
      height: 300
    }, 2000, c => {
      // console.log("Restored")
      $app.removeClass("minimized")
    })
  }

  function fixUI() {
    const $frets = $(".fret");
    const fret = n => $($frets[n - 1])
    const fretOffset = n => fret(n).offset()

    const $dots = $("ul.dots li").css({position: 'absolute'});
    const dot = n => $($dots[n - 1])
    const dotOffset = n => dot(n).offset()

    dot(1).offset($.extend(dotOffset(1), {left: fretOffset(3).left + 30}))
    dot(2).offset($.extend(dotOffset(2), {left: fretOffset(5).left + 30}))
    dot(3).offset($.extend(dotOffset(3), {left: fretOffset(7).left + 30}))
    dot(4).offset($.extend(dotOffset(4), {left: fretOffset(9).left + 30}))
    dot(5).offset($.extend(dotOffset(5), {left: fretOffset(12).left + 30}))
    dot(6).offset($.extend(dotOffset(6), {left: fretOffset(12).left + 30}))

  }

  function showKeyDetail(target, keyName) {
    $("path.active").removeClass("active");

    $(target).addClass("active");

    const $keyDetail = $("#key-detail");
    $keyDetail.animate({opacity: 1}, 3000, c => {
    });

    populateKeyDetail(keyName)
    minimizeCircleOfFifth()

    //Change key of melody
    if (fretboard.melodyBeingPlayed) {
      fretboard.melodyBeingPlayedInKey = melodyInContextOfKey(fretboard.melodyBeingPlayed, fretboard.activeKey)

      mxml.transpose(fretboard.melodyBeingPlayedInKey)
      loadMainOSMD(mxml.toString());
    }
  }

  $('.cf-arcs').each((i, el) => {
    $($(el).find("path")[1]).click(e => {
      if ($app.hasClass("minimized")) {
        restoreCircleOfFifth()
        e.stopPropagation()
        e.preventDefault()
        return
      }
      let wanted = $(e.target).parent().next().next("text").text();
      wanted = wanted.replaceAll("\n", "").replaceAll(" ", "")
      console.log(`Lay out chords of key: ${wanted}`)
      fretboard.activeKey = new Key(wanted)

      showKeyDetail(e.target, wanted)
    });
    $($(el).find("path")[2]).click(e => {
      if ($app.hasClass("minimized")) {
        restoreCircleOfFifth()
        e.stopPropagation()
        e.preventDefault()
        return
      }
      let wanted = $(e.target).parent().next().next("text").next("text").text();
      wanted = wanted.replaceAll("\n", "").replaceAll(" ", "")
      fretboard.activeKey = new Key(wanted)
      console.log(`Lay out chords of key: ${wanted}`)
      showKeyDetail(e.target, wanted)
    })
  })

  window.osmds = []

  function createOsmd(cntnr) {
    const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(cntnr);
    osmd.setOptions({
      backend: "svg",
      drawingParameters: "compacttight", // more compact spacing, less padding
      drawTitle: false, // included in "compacttight"
    });

    window.osmds.push(osmd)
  }

  createOsmd("osmdContainer1")
  // createOsmd("osmdContainer2")
  // createOsmd("osmdContainer3")

  function toggleFretboard() {
    const $collapse2 = $('#collapse2');
    $collapse2.toggle()
    if ($collapse2.is(":visible")) {
      $('#mainSheetMusic').removeClass('expanded')
      $("#diatonic-chords").show()
      $('#keyChartDialog').show()
    } else {
      $('#mainSheetMusic').addClass('expanded')
      $("#diatonic-chords").hide()
      $('#keyChartDialog').hide()
    }
  }

  $('#toggleFretboardBtn').click(toggleFretboard)
  $('#toggleKeyChartBtn').click(e => {
    $('#keyChartDialog').toggle()
  })

  $('.chord-multiselect li').click(e => {
    $(e.target).toggleClass("active")
  });

  populateKeyDetail('C')

  $('#playProgressionBtn').click(e => {
    fretboard.playFlag = true
    fretboard.playProgression($('.progressions').select2('data')[0].element.value)
    $('#playProgressionBtn').fadeTo('fast', 0)
    $('#stopProgressionBtn').fadeTo('slow', 1)
  })

  $('#stopProgressionBtn').hide().click(e => {
    fretboard.playFlag = false
    $('#playProgressionBtn').fadeTo('slow', 1)
    $('#stopProgressionBtn').fadeTo('fast', 0)
  })


  const playMp3 = (musicxml, key) => $.ajax({
    type: "POST",
    url: "http://localhost:5000/musicxml",
    // The key needs to match your method's input parameter (case-sensitive).
    data: JSON.stringify({key: key, musicxml: musicxml}),
    contentType: "application/json; charset=utf-8",
    dataType: "json",
    success: function (data) {
      log(data);
      const $audio = $('#melody-audio')
      $audio.html('').append($(`<source>`).attr("src", "http://localhost:5000/mp3/" + data.name).attr('type', 'audio/mpeg'))
      $audio[0].load();
      $audio[0].play();
    },
    error: function (errMsg) {
      log(errMsg);
    }
  });

  const $osmdContainer1 = $('#osmdContainer1')

  const sheetMusicClicked = e => {
    const data = $(e.target).parents(".vf-notehead").data();
    if (!data) return;
    if (!Object.keys(data).length) {
      populateNoteheadData(osmds[0], mxml.xml);
    }
    logJson("Notehead data", data)
    const info = `${data.name}${data.octave}, ${durationType(data.duration)}=${data.duration}, voice:${data.voice}`
    $('#note-information>.info').html(info)
    $('#note-information').show()

    if (data.id) {
      const found = mxml.xml.find("note").toArray().find(it => $(it).text().indexOf("id=" + data.id) >= 0)
      log(found)
    }

    const cursor = osmds[0].cursor;
    cursor.show();
    cursor.reset()

    nTimes(data.measure, () => cursor.next())

    const chordNotes = getNotesFromHtml().filter(it => it.measure === data.measure && it.x === data.x)

    const usefulChordsOnFretboard = fretboard.usefulChords(chordNotes);

    if (!usefulChordsOnFretboard.length) {
      return
    }

    populateChordButtons(usefulChordsOnFretboard, fretboard);
  }

  $osmdContainer1.click(sheetMusicClicked);

  $('#generateMelodyBtn').click(e => {
    const melody = randomMelody()
    window.mxml.reset()
    fretboard.melodyBeingPlayed = melody;
    log(melodyToSimpleString(fretboard.melodyBeingPlayed))

    const melodyInKey = melodyInContextOfKey(melody, fretboard.activeKey)
    melodyInKey.forEach(measure => mxml.addMeasure(measure.notes))
    log(melodyToSimpleString(melodyInKey))
    fretboard.melodyBeingPlayedInKey = melodyInKey;

    const inversion = diatonicMelodicInversion(melody)
    const inversionInKey = melodyInContextOfKey(inversion, fretboard.activeKey)
    inversionInKey.forEach(measure => mxml.addMeasure(measure.notes))
    log(melodyToSimpleString(inversion))
    log(melodyToSimpleString(inversionInKey))

    fretboard.melodyBeingPlayed = fretboard.melodyBeingPlayed.concat(inversion)
    fretboard.melodyBeingPlayedInKey = fretboard.melodyBeingPlayedInKey.concat(inversionInKey);

    playMp3(window.mxml.toString(), fretboard.activeKey.name())
    loadMainOSMD(mxml.toString(), 10);
    $('#playProgressionBtn').fadeTo('slow', 1)
  })

  function guessVoicesForMelody(xml) {
    // Strategy - Melody in higher octave
    // Strategy - Melody has most movement, and has most non-chord tones
    // Determine key;
  }

  const extractMelodyFromXml = (xmlStr) => {
    loadMusicFromXmlFile(xmlStr).then(xml => {
      const noteheadData = getNotesFromHtml()
      groupBy(noteheadData, it => it.measure + "-" + it.x, (k, v) => {
        const melNote = v.toSorted((a, b) => a.line - b.line).find(it => it.name.length > 0)
        if(melNote) {
          melNote.melodyNote = true
          if(melNote.id !== undefined) {
            v.filter(vi => vi.name.length > 0 && vi.id !== melNote.id && vi.voice === melNote.voice).forEach(vi => vi.remove = true)
            v.filter(vi => vi.name.length > 0 && vi.id !== melNote.id && vi.voice !== melNote.voice).forEach(vi => vi.convertToRest = true)
          }
        }
      })

      const notes = $(xml).find("note")
      noteheadData.filter(it => it.id !== undefined).forEach(nhd => {
        const $note = notes.filter((i, n) => $(n).find(`lyric>text`).text().trim() === 'id='+ nhd.id)
        $note.find("chord").remove()
        if(nhd.remove) {
          $note.remove()
          log(nhd.id, 'removed')
        }
        if(nhd.convertToRest) {
          $note.find("pitch").remove()
          $note.prepend($('<rest/>', xml))
          log(nhd.id, 'converted to rest')
        }
        console.log(nhd.id, $note[0])
      })

      xml = mxml.serialiser.serializeToString(xml[0])
      loadMainOSMD(xml)

      // let modified = $($.parseXML(xml)).find("lyrics:contains('id=')").remove()
      // log(mxml.serialiser.serializeToString(modified[0]))

      fretboard.melodyBeingPlayedInKey = mxml.toArray().map(it => ({notes: it}))
      fretboard.melodyBeingPlayed = melodyWithoutContextOfKey(fretboard.melodyBeingPlayedInKey, fretboard.activeKey)
    })
  }

  const extractOuterVoicesFromXml = (xmlStr) => {
    loadMusicFromXmlFile(xmlStr).then(xml => {
      const noteheadData = getNotesFromHtml()
      groupBy(noteheadData, it => it.measure + "-" + it.x, (k, v) => {
        const sortedByLine = v.toSorted((a, b) => a.line - b.line).filter(it => it.name.length > 0)
        sortedByLine.forEach((e, i) => {
          if(i !== 0 && i !== sortedByLine.length - 1) {
            e.remove = true
          }
        })
      })

      const notes = $(xml).find("note")
      noteheadData.filter(it => it.id !== undefined).forEach(nhd => {
        const $note = notes.filter((i, n) => $(n).find(`lyric>text`).text().trim() === 'id='+ nhd.id)
        if(nhd.remove) {
          $note.remove()
          log(nhd.id, 'removed')
        }
        console.log(nhd.id, $note[0])
      })

      xml = mxml.serialiser.serializeToString(xml[0])
      loadMainOSMD(xml)

      // let modified = $($.parseXML(xml)).find("lyrics:contains('id=')").remove()
      // log(mxml.serialiser.serializeToString(modified[0]))

      fretboard.melodyBeingPlayedInKey = mxml.toArray().map(it => ({notes: it}))
      fretboard.melodyBeingPlayed = melodyWithoutContextOfKey(fretboard.melodyBeingPlayedInKey, fretboard.activeKey)
    })
  }

  $('#loadMelodyBtn').click(e => {
    const [file] = document.querySelector("input[type=file]").files;
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        extractMelodyFromXml(reader.result)
      },
      false
    );
    if (file) {
      reader.readAsText(file);
    }
  })

  $('#extractOuterVoicesBtn').click(e => {
    const [file] = document.querySelector("input[type=file]").files;
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        extractOuterVoicesFromXml(reader.result)
      },
      false
    );
    if (file) {
      reader.readAsText(file);
    }
  })

  $('#playMelodyBtn').click(e => {
    playMp3(mxml.toString(), fretboard.activeKey.name())
  })

  const addIdsToNotes = xml => {
    xml.find("note").each((i, e) => {
      let lyric = $(e).find("lyric")
      const number = lyric.length + 1
      lyric = $(`<lyric number="${number}">
                      <syllabic>single</syllabic>
                      <text>id=${i}</text>
                  </lyric>`, xml)
      $(e).append(lyric)
    })
  }

  const addNoteNames = xml => {
    function extracted(e) {
      let el = $(e);
      const accidental = el.find("accidental").text()
      const name = el.find('pitch>step').text()
      const noteheadText = $(`<notehead-text>
          <display-text>${name}</display-text>
          ${accidental ? '<accidental-text>' + accidental + '</accidental-text>' : ''}
        </notehead-text>`, e);
      el.find('stem').after(noteheadText)
    }

    xml.find("note").each((i, e) => {
      if($(e).find('notehead-text').length === 0)
          extracted(e);
    })
  }

  const loadMusicFromXmlFile = (xml) => {
    const doc = $.parseXML(xml)
    addIdsToNotes($(doc))
    addNoteNames($(doc))
    const musicXml = mxml.serialiser.serializeToString(doc)
    mxml.loadXml(musicXml)

    fretboard.melodyBeingPlayedInKey = mxml.toArray().map(it => ({notes: it}))
    fretboard.melodyBeingPlayed = melodyWithoutContextOfKey(fretboard.melodyBeingPlayedInKey, fretboard.activeKey)

    return loadMainOSMD(musicXml);
  }

  $('#loadMusicBtn').click(e => {
    const [file] = document.querySelector("input[type=file]").files;
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        loadMusicFromXmlFile(reader.result)
      },
      false
    );
    if (file) {
      reader.readAsText(file);
    }
  })

  $("#invertAndLoadBtn").click(e => {
    let measures = $("#measuresEntered").val()
    if (!measures) return
    measures = parseRangeInput(measures)

    const toInvert = []
    measures.forEach(m => toInvert.push(fretboard.melodyBeingPlayed[m - 1]))
    const inversion = melodyInContextOfKey(diatonicMelodicInversion(toInvert), fretboard.activeKey)
    const _mxml = new MusicXml()
    inversion.forEach(measure => _mxml.addMeasure(measure.notes))

    $("#saveAlteredMelody").data("xml", _mxml.toString())

    const osmd = window.osmds[1];
    osmd.load(_mxml.toString())
      .then(it => {
        osmd.render();
      });
  })


  $('#analyseMusicBtn').click(e => {
    const noteheadsData = getNotesFromHtml()
    const notes = groupBy(noteheadsData, it => it.measure + "-" + it.x, (k, notes) => {
      const sortedByY = notes.toSorted((a, b) => a.line - b.line);
      let melNote = sortedByY.find(it => it.name.length > 0)
      if(!melNote) melNote = sortedByY[0]
      melNote.melodyNote = true
      $(noteheadCache[melNote.cacheIndex]).data("melodyNote", true)
      return notes
    })

    const measures = groupBy(notes.flat().filter(it => it.melodyNote).map(it => ({ name: it.name, type: durationType(it.duration), measure: it.measure})), 'measure', (m, ns) => ({notes: ns}))
    const similarities = analyseRhythmSimilarity(measures);
    log(similarities)
    // $('#analysisDialog').fadeIn()
    guessChords()
  })

  setTimeout(() => minimizeCircleOfFifth(), 4000)

  async function saveFile(data, name) {
    const blob = new Blob([data], {
      type: "application/xml",
    });

    // create a new handle
    const newHandle = await window.showSaveFilePicker({suggestedName: name});

    // create a FileSystemWritableFileStream to write to
    const writableStream = await newHandle.createWritable();

    // write our file
    await writableStream.write(blob);

    // close the file and write the contents to disk.
    await writableStream.close();
  }

  $app.click(e => {
    if ($app.hasClass("minimized")) {
      restoreCircleOfFifth()
      e.stopPropagation()
    }
  });

  $("#saveAlteredMelody").click(e => {
    const [file] = document.querySelector("input[type=file]").files;
    if (!file) return
    saveFile($("#saveAlteredMelody").data("xml"), file.name.split(".")[0] + "_mod_" + new Date().getTime() + ".xml").then(r => {
    })
  })

  $("#saveMusicXmlBtn").click(e => {
    const [file] = document.querySelector("input[type=file]").files;
    let name = null
    if (!file) {
      name = "unknown_" + new Date().getTime() + ".xml";
    } else name = file.name.split(".")[0] + "_melody_" + new Date().getTime() + ".xml";

    $(mxml.xml).find("lyric:contains('id=')").remove()

    saveFile(mxml.toString(), name).then(r => {
    })
  })

  fixUI();
  window.mxml = new MusicXml()

  $osmdContainer1[0].addEventListener("fullscreenchange", (event) => {
    if (document.fullscreenElement === null)
      $('.toolbar').show()
  });

  $('#enterFullScreenBtn').click(e => {
    $osmdContainer1[0].requestFullscreen().then(it => {
      log("entered")
      $('.toolbar').hide()
      $('.ui-dialog').hide()
      schedule([() => {
      }, () => $('#loadMusicBtn').click(), () => $('#analyseMusicBtn').click()], 2)
    })
  })

  window.showNoteNames = false

  $('#toggleNoteNamesBtn').click(e => {
    $('.note-name').toggle()
    window.showNoteNames = !window.showNoteNames
  })

  const $keyChartDialog = $('#keyChartDialog')
  keyList.forEach(k => {
    const key = new Key(k)
    const row = $(`<div class="chord-list" data-key="${k}"></div>`)
    key.chords().forEach(c => {
      const $cohrd = $(`<span class="chord" data-fullname="${c}"> ${normaliseChordName(c)}</span>`)
      if(!allChords[c]) {
        log(c)
      }
      if(allChords[c] && intersection(allChords[c].notes, ['E', 'A', 'D', 'G', 'B']).length > 0) {
        $cohrd.addClass('open-str')
      }
      row.append($cohrd)
    })
    $keyChartDialog.find(".content").append(row)
  })

  $keyChartDialog.find(".chord").click(e => {
    const chordName = e.target.dataset.fullname;
    $keyChartDialog.find(`.chord`).removeClass("highlighted").removeClass("highlighted-main")
    $keyChartDialog.find(`.chord[data-fullname='${chordName}']`).addClass("highlighted-main")
    findChordsWithAChromaticNote(allChords[chordName].notes).forEach(c => {
      $keyChartDialog.find(`.chord[data-fullname='${c}']`).addClass("highlighted")
    })

    const dominantKey = $($(e.target).parents(".chord-list").find(".chord")[4]).text().trim()
    $(".chord-list").removeClass("highlighted")
    $(e.target).parents(".chord-list").addClass("highlighted").addClass("selected")
    $(`.chord-list[data-key='${dominantKey}']`).addClass("highlighted").addClass("dominant")
  })

  mxml.setTime(4, 4)

  const $chordInput = $('#chordInput');
  const $chordVariationsCntnr = $('#chord-variations-container');

  function chordVariationClicked(chordName) {
    $chordInput.val($chordInput.val() + "\n" + chordName)
    mxml.reset()
    mxml.setKey(fretboard.activeKey)

    const allVersions = usefulVersionsOfChord(chordName, fretboard);
    // let extensions = chordExtensions(chordName);

    const ocs = fretboard.openChords(chordName)

    mxml.addMeasure([{name: '', type: 'quarter', octave: 4, chordSymbol: chordName}])

    allVersions.forEach(it => mxml.addMeasure(it))

    // extensions.forEach(it => {
    //   ocs = ocs.concat(fretboard.openChords(it))
    //   mxml.addMeasure([{name: '', type: 'quarter', octave: 4, chordSymbol: it}])
    //   usefulVersionsOfChord(it, fretboard).forEach(it => {
    //     mxml.addMeasure(it)
    //   })
    // })

    populateChordButtons(ocs, fretboard)

    const doc = mxml.xml[0]
    addIdsToNotes($(doc))
    const musicXml = mxml.serialiser.serializeToString(doc)
    mxml.loadXml(musicXml)
    loadMainOSMD(null, 10)
  }

  $keyChartDialog.find(".chord").dblclick(e => {
    $chordVariationsCntnr.html('')

    const chordName = e.target.dataset.fullname;
    [chordName, chordExtensions(chordName)].flat().forEach(it => {
      const $btn = $(`<span>${it}</span>`);
      $btn.addClass("chord-variation-btn").click(e => {
        chordVariationClicked(it)
        $('.chord-variation-btn').removeClass("selected")
        $btn.addClass("selected")
      })
      $chordVariationsCntnr.append($btn)
    })
  })

  $chordInput.change(e => {
    const chords = $chordInput.val().split("\n").map(it => ({
      chord: allChords[it],
      name: it
    })).filter(it => it.chord)
    mxml.reset()
    mxml.setKey(fretboard.activeKey)
    chords.forEach(c => {
      mxml.addMeasure(c.chord.notes.map((n, i) => ({
        name: n,
        octave: 3,
        type: 'quarter',
        chord: i !== 0,
        chordSymbol: normaliseChordName(c.name)
      })))
    })
    loadMainOSMD(null, 10)
  })

});

function _randomChords(names) {
  //Chords in a group will be close to each other on fretboard
  const chords = []
  names.forEach(chordName => {
    const ocs = fretboard.openChords(chordName)
    const  lastChord = chords[chords.length-1]

    let closeOnes = ocs.filter(it => {
      // Is close to chords collected so far?
      if(chords.length === 0) return true
      const spanOfLastChord = [Math.min(...lastChord.map(_lc => _lc.fret).filter(x => x!== 0)), Math.max(...lastChord.map(_lc => _lc.fret).filter(x => x!== 0))]
      const spanOfThisChord = [Math.min(...it.map(_lc => _lc.fret).filter(x => x!== 0)), Math.max(...lastChord.map(_lc => _lc.fret).filter(x => x!== 0))]

      const isClose = Math.abs(spanOfLastChord[0] - spanOfThisChord[0]) < 3 && Math.abs(spanOfLastChord[1] - spanOfThisChord[1]) < 3
      if(isClose) {
        log(spanOfLastChord, spanOfThisChord, 'spans', chordName)
      }

      return isClose
    })

    if(closeOnes.length === 0) closeOnes = ocs

    let voiceLeadingOptions = ['COMMON_NOTE_1', 'COMMON_NOTE_2', 'COMMON_NOTE_1']
    // let isSmoothVoiceLeading = false
    // let commonNote = _.intersectionBy(lastChord, it, (x) => x['string'] + '-' + x['fret']).length > 0
    // isSmoothVoiceLeading = commonNote

    const items = randomFromArray(closeOnes);
    chords.push(items)

    log(`${chordName}`, items)
  })

  return chords
}

function randomChords(chordGroups) {
  const groups = $('#chordInput').val().trim().split('-').filter(it => it.length)

  mxml.reset()
  mxml.setKey(fretboard.activeKey)

  let chords = []
  groups.forEach(group => {
    const ccs= _randomChords(group.split('\n').map(it => it.trim()).filter(it => it.length))

    const notes = ccs.map(cnotes => {
      const nns = cnotes.map(cn => ({...fretboard.noteAt(cn.string, cn.fret), chord: true, type: 'quarter'}))
      nns[0].chord = false;
      return nns
    }).flat()
    mxml.addMeasure(notes)

    chords = chords.concat(ccs)
  })

  populateChordButtons(chords, fretboard)

  const doc = mxml.xml[0]
  const musicXml = mxml.serialiser.serializeToString(doc)
  mxml.loadXml(musicXml)
  loadMainOSMD(null, 10)
}

function allOpenChordsInPos(pos) {
  let chords = []

  const chordName = $('.chord-variation-btn.selected').text()
  chords = chords.concat(fretboard.openChords(chordName))
  chords = chords.filter(those => those.map(it => it.fret).every(i => i <= 5))

  populateChordButtons(chords, fretboard)
}

$(window).resize(e => setTimeout(() => hideIdTexts(), 3000))

