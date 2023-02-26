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
    6: ['2','2','2','2','2','2','2','2','3','3','3','3','3','3','3','3','3'],
    5: ['2','2','2','3','3','3','3','3','3','3','3','3','3','3','3','4','4'],
    4: ['3','3','3','3','3','3','3','3','3','3','4','4','4','4','4','4','4'],
    3: ['3','3','3','3','3','4','4','4','4','4','4','4','4','4','4','4','4'],
    2: ['3','4','4','4','4','4','4','4','4','4','4','4','4','5','5','5','5'],
    1: ['4','4','4','4','4','4','4','4','5','5','5','5','5','5','5','5','5']
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

let tips = [
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

function randomFromArray(cc) {
  return cc[Math.floor(Math.random() * cc.length)]
}

const Fretboard = function () {
  this.init = function (defaults) {
    this.active = defaults.active;
    this.notes = defaults.notes;
    this.options = defaults.options;
    this.messageBox = defaults.messageBox;
    this.controls = defaults.controls;
    this.guitarNeck = defaults.guitarNeck;
    this.strings = defaults.strings;
    this.message = defaults.message;
    this.activeNote = defaults.activeNote;
    this.noteMarkers = defaults.noteMarkers;
    this.activeKey = 'C'
    this.setHeader(this.message);
    this.keyChart = keyChart
  };
  this.getActiveKeyChords = () => {
    let chords = []
    let itsMinorKey = this.activeKey.endsWith("m")
    let itsMajorKey = !itsMinorKey
    let primaryChords = [1, 4, 5];
    let primaryChordQuality = itsMajorKey ? "maj" : "min"
    let secondaryChords = [2, 3, 6]
    let secondaryChordQuality = itsMajorKey ? "min" : "maj"
    let activeKeyNotes = this.keyChart[this.activeKey]

    for (let i = 0; i < 7; i++) {
      if (primaryChords.indexOf(i + 1) >= 0) {
        chords.push(activeKeyNotes[i] + primaryChordQuality)
      } else if (secondaryChords.indexOf(i + 1) >= 0) {
        chords.push(activeKeyNotes[i] + secondaryChordQuality)
      } else if (i === 6) {
        chords.push(activeKeyNotes[i] + "dim")
      }
    }

    return chords
  }

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
    'min': pattern([1, '3b', 5]),
    'aug': pattern([1, 3, '5#']),
    'dim': pattern([1, '3b', '5b']),
    'dim7': pattern([1, '3b', '5b', 6]),
    'sus4': pattern([1, 4, 5]),
    '+9': pattern([1, 3, 5, 9]),
    'min+9': pattern([1, '3b', 5, 9]),
    '5': pattern([1, 5]),
    '6': pattern([1, 3, 5, 6]),
    'min6': pattern([1, '3b', 5, 6]),
    '6+9': pattern([1, 3, 5, 6, 9]),
    'min6+9': pattern([1, '3b', 5, 6, 9]),
    '7': pattern([1, '3', 5, '7b']), //a.k.a majMin7 a.k.a. dom7
    'maj7': pattern([1, '3', 5, 7]),
    'min7': pattern([1, '3b', 5, '7b']),
    'minMaj7': pattern([1, '3b', 5, 7]),
    '7Sus4': pattern([1, '4', '5', '7b']),
    '9': pattern([1, 3, 5, '7b', 9]),
    'maj9': pattern([1, 3, 5, 7, 9]),
    'min9': pattern([1, '3b', 5, '7b', 9])
  }
  this.chordPatterns = chordPatterns
  this.chords = {}

  const sortByLength = (a, b) => b.length - a.length
  this.notesInChord = (fullName) => {
    let type = Object.keys(chordPatterns).sort(sortByLength).find(it => fullName.endsWith(it))
    if (!type) type = "maj"
    const chordSymbol = fullName.replace(type, "")
    return fretboard.chordPatterns[type](notesInScale(majorScales, chordSymbol))
  }

  this.getChord = (romanNumeral, musicKey) => {
    let chordNumber = Object.keys(romanHash).sort(sortByLength).find(it => romanNumeral.startsWith(it) || romanNumeral.startsWith(it.toLowerCase()));

    let everythingAfterChordNumber = romanNumeral.substr(chordNumber.length)
    chordNumber = romanNumeral.substr(0, chordNumber.length)

    let isMinor = chordNumber.toLowerCase() === chordNumber
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
    return {
      symbol: this.keyChart[musicKey][romanToInt(chordNumber) - 1],
      romanNumeral: romanNumeral,
      quality: quality,
      inversion: 0
    }
  }

  this.randomFretNumber = () => randomFromArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

  this.findChordNotesOnFretboard = (notes, position) => {
    const bassNote = notes[0]
    let bassString = null
    let maxStretch = 4

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

    const findDuplicates = arry => arry.filter((item, index) => arry.indexOf(item) !== index)

    let removeSomeNotes = (notes, duplicates, canBeRemoved) => {
      let res = notes.filter(it => {
        const random_boolean = Math.random() < 0.5;
        if(random_boolean && canBeRemoved[it.name]) {
          canBeRemoved[it.name] = false
          console.log("Removing ", it)
          return null
        }
        return it
      }).filter(it => it != null)

      return res
    }

    let others = notesOnOtherStrings()

    let canBeRemoved = {}
    let duplicates = findDuplicates(others.map(it => it.name).concat(bassNote))
    duplicates.forEach(d => canBeRemoved[d] = true)

    notesInChord = notesInChord.concat(removeSomeNotes(others, duplicates, canBeRemoved))
    return {
      position: position,
      notesInChord: notesInChord
    }
  }

  this.getChords = (progression, musicKey) => {
    return progression.split("-").map(it => it.trim()).map(it => this.getChord(it, musicKey)).map(it => ({
      chord: it,
      chordNotes: this.notesInChord(it.symbol + it.quality)
    }))
  }

  function cartesian(...args) {
    const r = [], max = args.length - 1;

    function helper(arr, i) {
      for (let j = 0, l = args[i].length; j < l; j++) {
        const a = arr.slice(0); // clone arr
        a.push(args[i][j]);
        if (i === max)
          r.push(a);
        else
          helper(a, i + 1);
      }
    }

    helper([], 0);
    return r;
  }

  this.chordsToPlay = []
  let position = null

  this.showChordBeingPlayed = () => {
    $('.note').hide()
    if( this.chordBeingPlayed < 0) return

    let chord = this.chordsToPlay[this.chordBeingPlayed]

    chord.fretboardNotes.notesInChord.forEach(it => {
      this.showNote(it.string, it.fret)
    })

    $(`#diatonic-chords li`).html(chord.name);
  }

  this.showChordNotes = (chordNotes) => {
    $('.note').hide()

    if(!chordNotes) return
    chordNotes.forEach(it => {
      this.showNote(it.string, it.fret)
    })
  }

  this.showRandomTip = () => {
    $("#tips").html(randomFromArray(tips))
  }

  this.playProgression = (progression) => {
    let prev = []
    const self = this;
    this.chordBeingPlayed = 0

    if (window.osmds[0] && window.osmds[0].cursor) {
      window.osmds[0].cursor.reset()
      window.osmds[0].cursor.show()
    }

    this.chordsToPlay = this.getChords(progression, this.activeKey)
    this.chordsToPlay.forEach(it => {
      it['fretboardNotes'] = this.findChordNotesOnFretboard(it.chordNotes)
      // Show chords on sheet music
      // it['fretboardNotes'].notesInChord.forEach(n => window.mxml.addNoteToLastMeasure(n))
      // window.mxml.addNoteToLastMeasure(it['fretboardNotes'].notesInChord[0])
      // it['fretboardNotes'].notesInChord.slice(1).forEach(n => window.mxml.addNoteToLastMeasure(n, 'chord', it.chord.symbol, it.chord.romanNumeral))
      // window.mxml.addRestToLastMeasure('half')
    })

    this.showRandomTip()

    let findMelodyNotesOnFretboard = (note) => {
      let strings = Object.keys(defaultSet.notes).reverse() //1-6
      let out = []
      for (let i = 0; i < strings.length; i++) {
        let string = strings[i]
        let frets = defaultSet.notes[string]
        for (let j = 0; j < frets.length; j++) {
            if(equalNotes(frets[j], note.name) && defaultSet.octaves[string][j]+"" === note.octave+"") {
              out.push({string: string, fret: j})
            }
        }
      }
      return out
    }

    let stopThisSchedule = false
    let lastMeasure = -1
    schedule(window.mxml.notes(), 2, (note, idx) => {
      let newMeasure = osmds[0].cursors[0].iterator.currentMeasureIndex
      let currentMelodyNote = this.melodyBeingPlayedInKey.map(it => it.notes).flat()[idx]

      log(findMelodyNotesOnFretboard(currentMelodyNote))

      if(newMeasure > lastMeasure) {
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
    $(this.guitarNeck).fadeOut(500);
  }

  this.setHeader = function (m) {
    $(this.messageBox).text(this.message);
  }

  this.showNote = function (string, fret) {
    const note = this.notes[string][fret];

    string = 7 - string;
    let leftDist, bottomDist;
    if (fret === 0) {
      leftDist = -42.5;
    } else {
      leftDist = ((fret - 1) * 80) + 15;
    }
    if ((string - 1) === 0) {
      bottomDist = 0;
    } else {
      //var leftDist = left * 45;
      bottomDist = (string - 1) * 42.5;
    }

    if (this.noteMarkers[string][fret] == null) {
      this.noteMarkers[string][fret] = $('<div>' + note + '</div>').addClass("note");
      $('.guitar-neck').append(this.noteMarkers[string][fret]);
    }

    let noteMarker = this.noteMarkers[string][fret]

    $(noteMarker).css('left', leftDist);
    $(noteMarker).css('bottom', bottomDist);


    $(noteMarker).css({opacity: 1}).show();
  }
};

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



/*** Contollers ***/
$(function () {
  //Initiate obj
  const fretboard = new Fretboard;

  fretboard.init(defaultSet)
  window.fretboard = fretboard;

  function populateChordProgressions() {
    $("select.progressions").html("")

    let isMinor = fretboard.activeKey.endsWith("m")
    let progressions = isMinor ? minorChordProgressions : majorChordProgressions
    Object.keys(progressions).forEach(key => {
      const $group = $('<optgroup></optgroup>').attr("label", key)
      progressions[key].forEach(it => {
        const displayHtml = it.displayHtml || it.displayText || it.data
        $group.append($(`<option>${displayHtml}</option>`).attr("value", it.data))
      })
      $("select.progressions").append($group)
    })
    $('.progressions').select2({tags: true, theme: "classic"});
  }

  function populateKeyDetail() {
    populateChordProgressions()
  }

  let $app = $('#app');

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
    let $frets = $(".fret");
    let fret = n => $($frets[n - 1])
    let fretOffset = n => fret(n).offset()

    let $dots = $("ul.dots li").css({position: 'absolute'});
    let dot = n => $($dots[n - 1])
    let dotOffset = n => dot(n).offset()

    dot(1).offset($.extend(dotOffset(1), {left: fretOffset(3).left + 30}))
    dot(2).offset($.extend(dotOffset(2), {left: fretOffset(5).left + 30}))
    dot(3).offset($.extend(dotOffset(3), {left: fretOffset(7).left + 30}))
    dot(4).offset($.extend(dotOffset(4), {left: fretOffset(9).left + 30}))
    dot(5).offset($.extend(dotOffset(5), {left: fretOffset(12).left + 30}))
    dot(6).offset($.extend(dotOffset(6), {left: fretOffset(12).left + 30}))

  }

  function showKeyDetail(target) {

    $("path.active").removeClass("active");

    $(target).addClass("active");

    let $keyDetail = $("#key-detail");
    $keyDetail.animate({opacity: 1}, 3000, c => {
    });

    populateKeyDetail()
    minimizeCircleOfFifth()
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
      console.log(`Lay out chords of key: ${wanted}`)
      fretboard.activeKey = wanted

      showKeyDetail(e.target)
    });
    $($(el).find("path")[2]).click(e => {
      if ($app.hasClass("minimized")) {
        restoreCircleOfFifth()
        e.stopPropagation()
        e.preventDefault()
        return
      }
      let wanted = $(e.target).parent().next().next("text").next("text").text();
      fretboard.activeKey = wanted
      console.log(`Lay out chords of key: ${wanted}`)
      showKeyDetail(e.target)
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
  createOsmd("osmdContainer2")
  createOsmd("osmdContainer3")

  $('.chord-multiselect li').click(e => {
    $(e.target).toggleClass("active")
  });

  populateKeyDetail()

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


  let playMp3 = () => $.ajax({
    type: "POST",
    url: "http://localhost:5000/musicxml",
    // The key needs to match your method's input parameter (case-sensitive).
    data: JSON.stringify({ key: fretboard.activeKey, musicxml: window.mxml.toString() }),
    contentType: "application/json; charset=utf-8",
    dataType: "json",
    success: function(data){
      log(data);
      let $audio = $('#melody-audio')
      $audio.html('').append($(`<source></source>`).attr("src", "http://localhost:5000/mp3/"+data.name).attr('type','audio/mpeg'))
      $audio[0].load();
      $audio[0].play();
    },
    error: function(errMsg) {
        log(errMsg);
    }
  });

  $('#generateMelodyBtn').click(e => {
    let melody = randomMelody()
    window.mxml.reset()
    fretboard.melodyBeingPlayed = melody;
    log(melodyToSimpleString(fretboard.melodyBeingPlayed))

    let melodyInKey = melodyInContextOfKey(melody, fretboard.activeKey)
    melodyInKey.forEach(measure => mxml.addMeasure(measure.notes))
    log(melodyToSimpleString(melodyInKey))
    fretboard.melodyBeingPlayedInKey = melodyInKey;

    let inversion = diatonicMelodicInversion(melody)
    let inversionInKey = melodyInContextOfKey(inversion, fretboard.activeKey)
    inversionInKey.forEach(measure => mxml.addMeasure(measure.notes))
    log(melodyToSimpleString(inversion))
    log(melodyToSimpleString(inversionInKey))

    playMp3()
    window.osmds[0].load(window.mxml.toString())
      .then(it => {
        window.osmds[0].render();
        window.osmds[0].cursor.show()
    });
    $('#playProgressionBtn').fadeTo('slow', 1)
  })

  setTimeout(() => minimizeCircleOfFifth(), 3000)

  $app.click(e => {
    if ($app.hasClass("minimized")) {
      restoreCircleOfFifth()
      e.stopPropagation()
    }
  });

  fixUI();
  window.mxml = new MusicXml()
});

