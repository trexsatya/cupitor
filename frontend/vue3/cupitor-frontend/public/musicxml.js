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
                  <divisions>1</divisions>
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
    if(data.name.endsWith("#")) {
      accidental = "sharp"
    } else if(data.name.endsWith("b")) {
      accidental = "flat"
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

    let $note = $(`
    <note>
        ${data.chord ? '<chord/>' : ''}
        <pitch>
            <step>${name}</step>
            <octave>${data.octave}</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        ${accidental ? '<accidental>' + accidental + '</accidental>' : ''}
        <type size="cue">${data.type}</type>
        ${data.dot ? '<dot/>': ''}
        <stem>up</stem>
        <notehead color="#8D0000">normal</notehead>
        ${lyrics}
    </note>
        `.replaceAll("\n", ""), self.xml)

    return $note
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
  }

  this.addMeasure = (notes) => {
    let $measure = null
    if(this.numberOfMeasures === 1) {
      $measure = self.xml.find('measure').last('measure')
    } else {
      $measure = $(`<measure number="${this.numberOfMeasures}"></measure>`, self.xml)
    }

    notes.forEach(note => {
      let $note = getMusicXmlNote({name: note.name, octave: note.octave, type: note.type, dot: note.dot})
      $measure.append($note)
    })
    self.xml.find('part').last('part').append($measure)
    this.numberOfMeasures += 1
    // console.log(self.toString())
  }

  this.reset = () => {
    this.xml = createXml()
    this.numberOfMeasures = 1
  }

  this.notes = () => {
    return this.xml.find("note").toArray()
  }

  this.measures = () => {
    return this.xml.find("measure").toArray()
  }
  return this
}


