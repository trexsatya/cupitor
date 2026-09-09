// Pure normalisation for the host's `cupitorCaptionCapture` event.
//
// Two kinds of text arrive on that one event, told apart by `source`:
//
//   'caption' — subtitle cues ticked out of the video sidebar. Timed, and
//               each line may carry a translation that backfilled later.
//   'page'    — sentences picked by hand off a web page or a same-origin
//               reader iframe. Every `start` is 0 and nothing is translated.
//
// The wire contract lives in docs/caption-capture-integration-spec.md in the
// Cupitor repo. Everything here is a pure function of the event so it can be
// tested without a host, a DOM, or a playlist.

// Shown in the opposite face for a line with no translation, so every row
// stays occupied and keeps its alignment with the line it belongs to.
export const CAPTION_NO_TRANSLATION = '—';

// Normalise the event detail into the lines we'll actually use. Returns []
// for anything malformed, so callers can treat empty as "ignore this event".
//
// Deliberately does NOT reject an unrecognised `source`. The host normalises
// anything it doesn't recognise to 'caption', so a third value can only mean
// the host learned a new trick — and dropping the block would lose the user's
// text silently, the one failure mode with no way back.
export function captionLinesFrom(cap) {
  if (!cap || !Array.isArray(cap.lines)) return [];
  return cap.lines.map(l => {
    if (!l) return null;
    // A two-line on-screen cue — or a sentence that wrapped across a page's
    // markup — arrives with an embedded newline. Collapse it: one row of the
    // card must be exactly one line, because the de-dupe pairs the card's rows
    // with `captionStarts` by position.
    const text = String(l.text == null ? '' : l.text).replace(/\s*\n\s*/g, ' ').trim();
    if (!text) return null;
    const start = Number(l.start);
    const tr = l.translation == null
      ? ''
      : String(l.translation).replace(/\s*\n\s*/g, ' ').trim();
    return { start: Number.isFinite(start) ? start : 0, text, translation: tr };
  }).filter(Boolean);
}

// Identity of one captured line. Start is part of the key because subtitle
// tracks repeat short lines ("Ja.") constantly — keying on text alone would
// silently swallow every repeat after the first. Page blocks have no times, so
// every start is 0 and the key falls back to page + text, which is the right
// identity there: the same sentence off the same page is the same sentence.
export function captionKey(url, start, text) {
  return `${url}\u0000${Number(start).toFixed(2)}\u0000${text}`;
}

// What to call this block on screen. A block of subtitles from a video and a
// handful of sentences picked off a page are not the same thing to the person
// looking at the dialog, and `source` is the only field that tells them apart.
export function captionWords(cap) {
  return (cap && cap.source === 'page')
    ? { dialog: 'Captured sentences', untitled: '(untitled page)',
        fieldLbl: 'Sentence text goes to', unit: 'sentence', units: 'sentences' }
    : { dialog: 'Captured captions', untitled: '(untitled video)',
        fieldLbl: 'Caption text goes to', unit: 'line', units: 'lines' };
}

// Lay the block out across the card's two faces. `field` picks which face the
// captured text lands on; the other gets the translations.
//
// Translations backfill asynchronously, so one selection routinely mixes lines
// that have one with lines that don't. Row N of one face has to line up with
// row N of the other, which rules out leaving a missing translation as an empty
// row: the card writer trims both faces, so an untranslated FIRST line would
// lose its blank row and shift the whole column up by one, quietly pairing
// every line with its neighbour's translation. A visible placeholder keeps
// every row occupied and survives the trim.
//
// When nothing is translated at all the other face is left empty rather than
// filled with a column of placeholders, which would be noise rather than
// information.
export function captionFaces(lines, field, noTranslation = CAPTION_NO_TRANSLATION) {
  const textField = field === 'target' ? 'target' : 'source';
  const otherField = textField === 'target' ? 'source' : 'target';
  return {
    textField,
    otherField,
    [textField]: lines.map(l => l.text).join('\n'),
    [otherField]: lines.some(l => l.translation)
      ? lines.map(l => l.translation || noTranslation).join('\n')
      : '',
  };
}
