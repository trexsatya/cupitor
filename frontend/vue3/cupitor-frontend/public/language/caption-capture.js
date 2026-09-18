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
  // The two sources mean different things by a newline. A subtitle cue is
  // broken to fit the screen, so its break is presentation and collapsing it
  // restores the one utterance the cue is. A page sentence is broken where
  // the document breaks it — a verse, a line of dialogue — and that break is
  // the text, so it is kept and the line simply occupies more than one row.
  const keepBreaks = cap.source === 'page';
  return cap.lines.map(l => {
    if (!l) return null;
    const raw = String(l.text == null ? '' : l.text).replace(/\r\n?/g, '\n');
    const text = keepBreaks
      ? raw.split('\n').map(r => r.replace(/[ \t]+/g, ' ').trim())
          .filter(Boolean).join('\n')
      : raw.replace(/\s*\n\s*/g, ' ').trim();
    if (!text) return null;
    const start = Number(l.start);
    const tr = l.translation == null
      ? ''
      : String(l.translation).replace(/\s*\n\s*/g, ' ').trim();
    return { start: Number.isFinite(start) ? start : 0, text, translation: tr };
  }).filter(Boolean);
}

// The address a captured card links back to.
//
// `cap.url` is the page: the block's identity, and what the de-dupe matches
// on, so it carries no start offset and means the same thing for every send
// from one video. `cap.timeParam` is what this player calls a start offset,
// or '' for one that cannot be deep-linked.
//
// `lines` is what actually lands on the card, which is not always everything
// the user picked — lines already captured from this video are dropped first.
// The link follows the lowest time among the lines it is put on: pointing at
// a passage that ended up on some other card is worse than not pointing at a
// passage at all.
//
// Comes back as the plain page whenever there is no moment to name: no
// parameter, a page block (every time is 0), unreadable times, or a passage
// that starts at the very beginning, which the plain address already is.
export function captionMediaLink(cap, lines) {
  const url = String((cap && cap.url) || '').trim();
  // Anything that is not an ordinary web page carries no link at all. The
  // channel this arrives on is reachable from any script on any page the user
  // visits, and this address ends up in an href and in window.open — a
  // `javascript:` or `data:` one has no business being either.
  if (!isWebPage(url)) return '';
  const name = String((cap && cap.timeParam) || '').trim();
  // The name is sent even where a moment is not worth pointing at — a live
  // channel names it so the address can be cleaned for identity, and says no
  // to the link separately. Only an explicit no counts, so a block that says
  // nothing keeps its link.
  if (!name || (cap && cap.timeLink === false)) return url;
  const at = Math.floor(earliestStart(lines));
  // An offset no player would read is not worth writing. The upper bound is
  // what keeps a nonsense cue time out of exponent notation, which is what
  // a number this large stringifies to.
  if (!Number.isFinite(at) || at <= 0 || at >= 1e9) return url;
  return withParam(url, name, at);
}

// The page a captured block belongs to, with no start offset on it.
//
// This is identity: which video the lines came from, not where the viewer was
// in it. The page sends its address already in this shape, but a card filed
// earlier holds whatever the address bar said at the time, so the stored one
// is put through here before the two are compared.
export function captionPageKey(url, timeParam) {
  const clean = String(url || '').trim();
  const name = String(timeParam || '').trim();
  if (!clean || !name || !isWebPage(clean)) return clean;
  return withoutParam(clean, name);
}

// The earliest moment among these lines. A line whose time cannot be read is
// passed over rather than allowed to poison the answer — one unreadable cue
// should cost its own precision, not the whole card's link.
function earliestStart(lines) {
  let best = Infinity;
  for (const l of lines || []) {
    const t = Number(l && l.start);
    if (Number.isFinite(t) && t < best) best = t;
  }
  return best;
}

// Only an ordinary web page is rewritten. A relative address resolved against
// whatever page the webapp is on would become a link to somewhere else
// entirely, and a blob: or about: address is not somewhere to be sent back to.
function isWebPage(url) {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:';
  } catch (_) {
    return false;
  }
}

// Query surgery by hand, on purpose. Reading the query into URLSearchParams
// and writing it back re-encodes every OTHER parameter — a bare `?flag` comes
// back as `?flag=`, and characters it escapes differently change shape — so
// the link would differ from the page in ways nobody asked for. Splitting the
// string touches only the parameter named.
//
// These rules have a twin in `db/js/src/20-caption-sidebar.js`, which removes
// the same parameter on its way out of the page. The two have to agree about
// what counts as the same key, or a link ends up carrying two offsets — both
// sides' tests run the same table of addresses for that reason.
function splitUrl(url) {
  const h = url.indexOf('#');
  const head = h >= 0 ? url.slice(0, h) : url;
  const q = head.indexOf('?');
  return {
    base: q >= 0 ? head.slice(0, q) : head,
    // A page writes the name either way round, so both spellings match.
    parts: (q >= 0 ? head.slice(q + 1).split('&') : []).filter(Boolean),
    hash: h >= 0 ? url.slice(h) : '',
  };
}

function isParam(part, name) {
  const key = part.split('=')[0];
  return key === name || key === encodeURIComponent(name);
}

function joinUrl(u) {
  return u.base + (u.parts.length ? `?${u.parts.join('&')}` : '') + u.hash;
}

function withoutParam(url, name) {
  const u = splitUrl(url);
  u.parts = u.parts.filter(p => !isParam(p, name));
  return joinUrl(u);
}

function withParam(url, name, value) {
  const u = splitUrl(url);
  u.parts = u.parts.filter(p => !isParam(p, name));
  u.parts.push(`${encodeURIComponent(name)}=${value}`);
  return joinUrl(u);
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
// A line that kept its own breaks fills more than one row, and the opposite
// face has to grow with it or every row below would pair with the wrong line.
// The extra rows carry the same placeholder a missing translation does: the
// row belongs to the line above it and holds nothing of its own.
export function captionFaces(lines, field, noTranslation = CAPTION_NO_TRANSLATION) {
  const textField = field === 'target' ? 'target' : 'source';
  const otherField = textField === 'target' ? 'source' : 'target';
  const counts = captionRowCounts(lines);
  return {
    textField,
    otherField,
    [textField]: lines.map(l => l.text).join('\n'),
    [otherField]: lines.some(l => l.translation)
      ? lines.map((l, i) => {
          // A translation is one utterance for the whole line, so it occupies
          // the line's first row whatever it arrived looking like. Letting a
          // newline through here would add a row the text face has no twin
          // for, which is the very shift the placeholder exists to prevent.
          const one = String(l.translation || '').replace(/\s*\n\s*/g, ' ').trim();
          const rows = [one || noTranslation];
          while (rows.length < counts[i]) rows.push(noTranslation);
          return rows.join('\n');
        }).join('\n')
      : '',
  };
}

// How many rows of the card each line occupies. Stored with the card as
// `captionRows` so the de-dupe can put the rows back together into the lines
// they came from.
export function captionRowCounts(lines) {
  return (lines || []).map(l => String((l && l.text) || '').split('\n').length);
}

// The inverse: regroup a face's rows into one string per captured line.
// Returns null when the rows and the counts disagree — a card whose text has
// been edited since — which the caller reads as "don't trust this card's
// provenance" rather than as an error.
export function captionRowGroups(rows, counts) {
  if (!Array.isArray(rows) || !Array.isArray(counts)) return null;
  const out = [];
  let at = 0;
  for (const c of counts) {
    // Only a real number counts. This is the one place that distrusts what a
    // card stored about itself, so a "2" that came back from JSON as a string
    // — or a true, or a [1] — is a card to walk away from, not to coerce.
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 1 ||
        at + c > rows.length) return null;
    out.push(rows.slice(at, at + c).join('\n'));
    at += c;
  }
  return at === rows.length ? out : null;
}

// Which face of a card holds the text in the language being studied.
//
// A captured card records that in `captionField`; anything else (a card typed
// by hand, or one captured before the choice existed) keeps the page's default
// reading, where Source is the studied language and Target the English side.
export function captionFieldOf(item) {
  return (item && item.captionField === 'target') ? 'target' : 'source';
}

// Which way a "fill this face from the other one" translation runs.
//
// `face` is the face being filled; the text comes from the opposite one. The
// languages follow whichever face holds the studied language, so a card
// captured with the caption text in Target translates the other way round from
// one captured the usual way — otherwise the button would hand English to the
// host as if it were Swedish and write the answer over the captured original.
//
// Returns null when the direction can't be named: `studiedCode` is null for a
// `?lang=` the page has no code for, and naming the language wrongly is worse
// than not offering the button.
export function cardTranslateDirection(item, face, studiedCode) {
  if (face !== 'source' && face !== 'target') return null;
  if (!studiedCode) return null;
  const studied = captionFieldOf(item);
  const from = face === 'source' ? 'target' : 'source';
  return {
    from,
    to: face,
    fromLang: from === studied ? studiedCode : 'en',
    toLang: face === studied ? studiedCode : 'en',
  };
}
