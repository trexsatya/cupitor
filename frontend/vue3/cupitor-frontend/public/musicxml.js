function createXml() {
  let template = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
    <identification>
        <creator type="arranger">Satyendra</creator>
        <rights>Arr. (c) 2023</rights>
        <encoding>
            <software>MuseScore 4.0.1</software>
            <encoding-date>2023-02-26</encoding-date>
            <supports element="accidental" type="yes"/>
            <supports element="beam" type="yes"/>
            <supports element="print" attribute="new-page" type="no"/>
            <supports element="print" attribute="new-system" type="no"/>
            <supports element="stem" type="yes"/>
        </encoding>
    </identification>
    <part-list>
        <score-part id="P1">
            <part-name print-object="no">Classical Guitar</part-name>
            <part-abbreviation>Guit.</part-abbreviation>
            <score-instrument id="P1-I1">
                <instrument-name>Classical Guitar</instrument-name>
            </score-instrument>
            <midi-device id="P1-I1" port="1"></midi-device>
            <midi-instrument id="P1-I1">
                <midi-channel>1</midi-channel>
                <midi-program>25</midi-program>
                <volume>78.7402</volume>
                <pan>0</pan>
            </midi-instrument>
        </score-part>
    </part-list>
    <part id="P1">
        <measure number="1">
              <attributes>
                  <divisions>4</divisions>
                  <key>
                      <fifths>0</fifths>
                  </key>
                  <time>
                      <beats>4</beats>
                      <beat-type>4</beat-type>
                  </time>
                  <clef>
                      <sign>G</sign>
                      <line>2</line>
                      <clef-octave-change>-1</clef-octave-change>
                  </clef>
              </attributes>
        </measure>
    </part>
</score-partwise>
`
  return $($.parseXML(template))
}

function findOctave(note) {
  let predicate = (string, fretX, fretY) => {
    return n => {
      return (n.string + '' === string+'') && (n.fret >= fretX && n.fret <= fretY)
    };
  }

  let predicates = [
    {
      condition: predicate(6, 0, 7),
      result: 2
    },
    {
      condition: predicate(6, 8, 19),
      result: 3
    },
    {
      condition: predicate(5, 0, 2),
      result: 2
    },
    {
      condition: predicate(5, 3, 14),
      result: 3
    },
    {
      condition: predicate(5, 15, 19),
      result: 4
    },
    {
      condition: predicate(4, 0, 9),
      result: 3
    },
    {
      condition: predicate(4, 10, 19),
      result: 4
    },
    {
      condition: predicate(3, 0, 4),
      result: 3
    },
    {
      condition: predicate(3, 5, 16),
      result: 4
    },
    {
      condition: predicate(3, 17, 19),
      result: 5
    },
    {
      condition: predicate(2, 0, 12),
      result: 4
    },
    {
      condition: predicate(2, 13, 19),
      result: 5
    },
    {
      condition: predicate(1, 0, 7),
      result: 4
    },
    {
      condition: predicate(1, 8, 19),
      result: 5
    }
  ]

  return predicates.find(it => it.condition(note) === true).result
}

/**
 *
 * @param key {Key}
 * @returns {string}
 */
function sharpsOrFlats(key) {
  let scale = getScale(key.name());
  let sharps = scale.filter(it => it.endsWith("#")).length
  if(sharps > 0) {
    return sharps
  }
  return scale.filter(it => it.endsWith("b")).length * -1
}

function MusicXml() {
  this.xml = createXml()
  let self = this;
  this.serialiser = new XMLSerializer()
  this.numberOfMeasures = 1
  this.toString = () => {
    return this.serialiser.serializeToString(this.xml[0])
  }

  function getMusicXmlNote(data) {
    let accidental = null
    let alter = 0
    if(data.name.endsWith("#")) {
      accidental = "sharp"
      alter = 1
    } else if(data.name.endsWith("b")) {
      accidental = "flat"
      alter = -1
    }
    let name = data.name
    if(accidental) {
      name = name.replaceAll("#", "").replaceAll("b", "")
    }

    let lyrics = ""
    let number = 1
    if(data.chordSymbol) {
      lyrics += `
        <lyric number="${number}">
            <syllabic>single</syllabic>
            <text>${data.chordSymbol}</text>
        </lyric>`
      number += 1
    }

    if(data.text) {
      lyrics += `
        <lyric number="${number}">
            <syllabic>single</syllabic>
            <text>${data.text}</text>
        </lyric>
      `
      number += 1
    }

    let notations = []
    if(data.notations) {

    }

    let tie = ''
    if(data.tie) {
      tie = `<tie type="${data.tie}"/>`
      notations.push(`<tied type="${data.tie}"/>`)
    }

    let pitch = `<pitch>
            <step>${name}</step>
            ${accidental ? '<alter>' + alter + '</alter>' : ''}
            <octave>${data.octave}</octave>
        </pitch>`

    if(name.trim().length === 0) {
      pitch = '<rest/>'
    }
    return $(`
    <note>
        ${data.chord ? '<chord/>' : ''}
        ${pitch}
        <duration>1</duration>
        ${tie}
        <voice>1</voice>
        ${accidental ? '<accidental>' + accidental + '</accidental>' : ''}
        <type>${data.type}</type>
        ${data.dot ? '<dot/>' : ''}
        <stem>up</stem>
        <notehead-text>
          <display-text>${name}</display-text>
          ${accidental ? '<accidental-text>' + accidental + '</accidental-text>' : ''}
        </notehead-text>
        <notations>
            ${notations.join("\n")}
        </notations>
        ${lyrics}
    </note>
        `.replaceAll("\n", ""), self.xml)
  }

  this.addRestToLastMeasure = (type) => {
    if(!type) type = 'quarter'
    let $note = $(`<note>
                <rest/>
                <duration>1</duration>
                <voice>1</voice>
                <type>${type}</type>
            </note>`, self.xml)
    self.xml.find('measure').last('measure').append($note)
    return this
  }

  this.addMeasure = (notes) => {
    let $measure = null
    if(this.numberOfMeasures === 1) {
      $measure = self.xml.find('measure').last('measure')
    } else {
      $measure = $(`<measure number="${this.numberOfMeasures}"></measure>`, self.xml)
    }

    notes.forEach(note => {
      let $note = getMusicXmlNote({name: note.name, octave: note.octave, type: note.type, dot: note.dot, tie: note.tie, chordSymbol: note.chordSymbol, chord: note.chord})
      $measure.append($note)
    })
    self.xml.find('part').last('part').append($measure)
    this.numberOfMeasures += 1
    // console.log(self.toString())
    return this
  }

  this.reset = () => {
    this.xml = createXml()
    this.numberOfMeasures = 1
    return this
  }

  this.notes = () => {
    return this.xml.find("note").toArray()
  }

  this.measures = () => {
    return this.xml.find("measure").toArray()
  }

  this.transpose = (newNotes) => {
    //Just change the pitch and octave
    newNotes.forEach((m, i) => {
      m.notes.forEach((n, j) => {
        let newXmlNote = getMusicXmlNote(n)
        let $note = $($(this.xml.find("measure")[i]).find("note")[j])
        $note.find("pitch").replaceWith(
          this.serialiser.serializeToString(newXmlNote.find("pitch")[0])
        )

        if(newXmlNote.find("accidental").length)
        $note.find("accidental").replaceWith(
          this.serialiser.serializeToString(newXmlNote.find("accidental")[0])
        )
      })
    })
  }

  this.toArray = () => {
    return this.xml.find("measure").toArray().map(measure => {
      return $(measure).find("note").toArray().map(note => {
        let pitch = $(note).find("pitch")
        let octave = parseInt(pitch.find("octave").text());
        let step = pitch.find("step").text();
        let type = $(note).find("type").text();
        let dot = $(note).find("dot");
        let voice = $(note).find("voice").text()
        let tie = $(note).find("notations").find("tied")

        if(pitch.find("alter").text() === '1') {
          step += "#"
        } else if(pitch.find("alter").text() === '-1') {
          step += "b"
        }
        return {
          name: step,
          octave: octave,
          fullName: step + octave,
          type: type,
          dot: dot.length > 0,
          voice: voice,
          tie: tie.attr("type")
        }
      })
    })
  }

  this.setKey = (key) => {
    this.xml.find('fifths').first().text(sharpsOrFlats(key))
    return this
  }

  this.setTime = (x, y) => {
    this.xml.find('time > beats').first().text(x)
    this.xml.find('time > beat-type').first().text(y)
    return this
  }

  this.loadXml = (xml) => {
    this.xml = $($.parseXML(xml))
    this.numberOfMeasures = this.xml.find("measure").length
    return this
  }

  this.loadMelody = (melody, key, meter) => {
    this.reset().setKey(key).setTime(meter.x, meter.y)
    melody.forEach(m => this.addMeasure(m.notes))
  }
  return this
}


