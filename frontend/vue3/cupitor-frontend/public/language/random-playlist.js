// Pure building blocks for the "Build Random Playlist" (Practice Random)
// feature. Kept free of `window` / DOM so they can be unit-tested directly;
// language.js supplies the live globals and the subtitle matcher.
//
// Item / tuple shapes:
//   captured item  = { searchText, word, id, source, timeStart, timeEnd, lineIndex, enabled }
//   tuple          = { st, w, it }   (st/w are the items[st][w] bucket keys)
//   subtitle line  = { index, ts, te }   (index = SRT sequence number; ts/te seconds)

import { isVirtual, isManualItem } from "./recordings-merge.js";

// Fisher-Yates on a copy. `rng` is injectable so callers/tests can make the
// ordering deterministic; production leaves it as Math.random.
export function fisherYates(arr, rng = Math.random) {
  const a = (arr || []).slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// First free "Random-N" name given the existing playlist names.
export function nextRandomPlaylistName(existingNames = []) {
  const taken = new Set(existingNames);
  let n = 1;
  while (taken.has(`Random-${n}`)) n++;
  return `Random-${n}`;
}

// Flatten captured (non-manual) items from the selected real playlists.
// An empty/absent `playlists` list means "all real (non-virtual) playlists".
// Manual flashcards and virtual playlists are skipped. Returns {st,w,it} tuples.
export function collectManualItems(recordings, playlists) {
  const coll = recordings || {};
  const wanted = playlists && playlists.length ? new Set(playlists) : null;
  const out = [];
  Object.keys(coll).forEach((name) => {
    if (isVirtual(coll, name)) return;
    if (wanted && !wanted.has(name)) return;
    const items = (coll[name] && coll[name].items) || {};
    Object.keys(items).forEach((st) => {
      Object.keys(items[st] || {}).forEach((w) => {
        (items[st][w] || []).forEach((it) => {
          if (!it || isManualItem(it)) return;
          out.push({ st, w, it });
        });
      });
    });
  });
  return out;
}

// Vocabulary lines (search words) for the selected categories. An empty/absent
// `categories` list means "all categories". `hidden` categories are always
// skipped. De-duplicates lines across categories.
export function wordsForCategories(vocabulary, categories, hidden = new Set()) {
  const vocab = vocabulary || {};
  const cats = categories && categories.length ? categories : Object.keys(vocab);
  const seen = new Set();
  const out = [];
  cats.forEach((cat) => {
    if (hidden.has(cat)) return;
    (vocab[cat] || []).forEach((line) => {
      if (typeof line !== "string" || seen.has(line)) return;
      seen.add(line);
      out.push(line);
    });
  });
  return out;
}

// Array positions of subtitle lines whose text matches `re`.
// `re` must be a non-global RegExp (a /g/ flag makes .test() stateful).
export function matchingPositions(lines, re) {
  const out = [];
  (lines || []).forEach((ln, pos) => {
    if (ln && re.test(ln.text || "")) out.push(pos);
  });
  return out;
}

// Contract a clip window to the contiguous temporal run containing the matched
// cue. SRTs in this app are SPARSE snippets — a video's file stitches together
// captures from distant moments, so a ±context window can straddle a multi-hour
// gap and produce a clip that plays far past the word. `cues` is an array whose
// entries expose numeric `ts`/`te` seconds; `anchorPos` is the array index of
// the matched cue. Walk outward from the anchor while the gap to the neighbour
// cue is <= gapThreshold; stop at the first larger gap. `loBound`/`hiBound`
// (optional) cap the walk to the ±context window. Then, if the run exceeds
// maxDuration (pass Infinity to disable), clamp it — biased to keep a short lead
// before the anchor and fill trailing context, always covering the anchor cue.
// Returns { fromPos, toPos, timeStart, timeEnd }. Never throws.
export function contiguousClipWindow(cues, anchorPos, opts = {}) {
  const gapThreshold = opts.gapThreshold == null ? 1.5 : opts.gapThreshold;
  const maxDuration = opts.maxDuration == null ? 25 : opts.maxDuration;
  const arr = cues || [];
  const n = arr.length;
  const zero = { fromPos: 0, toPos: 0, timeStart: 0, timeEnd: 0 };
  if (!n || anchorPos < 0 || anchorPos >= n) return zero;
  const lo0 = Math.max(0, opts.loBound == null ? 0 : opts.loBound);
  const hi0 = Math.min(n - 1, opts.hiBound == null ? n - 1 : opts.hiBound);
  const anchor = arr[anchorPos];
  const aStart = Number(anchor && anchor.ts);
  const aEnd = Number(anchor && anchor.te);
  // Degenerate anchor times → anchor-only window with zero times (callers treat
  // it as a no-op / fall back to stored bounds).
  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) {
    return { fromPos: anchorPos, toPos: anchorPos, timeStart: 0, timeEnd: 0 };
  }
  let lo = anchorPos;
  let hi = anchorPos;
  for (let i = anchorPos - 1; i >= lo0; i--) {
    const s = arr[i];
    const se = Number(s && s.te);
    const cur = Number(arr[lo].ts);
    if (!Number.isFinite(se) || !Number.isFinite(cur)) break;
    if (cur - se > gapThreshold) break;
    lo = i;
  }
  for (let i = anchorPos + 1; i <= hi0; i++) {
    const s = arr[i];
    const ss = Number(s && s.ts);
    const cur = Number(arr[hi].te);
    if (!Number.isFinite(ss) || !Number.isFinite(cur)) break;
    if (ss - cur > gapThreshold) break;
    hi = i;
  }
  let timeStart = Number(arr[lo].ts);
  let timeEnd = Number(arr[hi].te);
  if (Number.isFinite(maxDuration) && timeEnd - timeStart > maxDuration) {
    const lead = Math.min(maxDuration * 0.25, aStart - timeStart);
    let newStart = aStart - lead;
    let newEnd = newStart + maxDuration;
    if (newEnd < aEnd) {
      newEnd = aEnd;
      newStart = Math.max(timeStart, newEnd - maxDuration);
    }
    timeStart = Math.max(timeStart, newStart);
    timeEnd = Math.min(timeEnd, newEnd);
  }
  return { fromPos: lo, toPos: hi, timeStart, timeEnd };
}

// Whitespace-delimited word count.
function countWords(text) {
  return String(text == null ? "" : text).trim().split(/\s+/).filter(Boolean).length;
}

// Count the words flanking the first whole-word occurrence of `word` in `text`,
// as { before, after }. Uses a Unicode letter boundary so Swedish å/ä/ö count as
// word characters (matches the app's search semantics) and "växa" does NOT match
// inside "växande". When the word isn't present as a whole word (or inputs are
// empty), returns { before: 0, after: 0 } so the caller errs toward adding context.
export function wordsAroundInLine(text, word) {
  const t = String(text == null ? "" : text);
  const w = String(word == null ? "" : word).trim();
  if (!w || !t) return { before: 0, after: 0 };
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const re = new RegExp(`(?<!\\p{L})(?:${esc})(?!\\p{L})`, "iu");
    const m = re.exec(t);
    if (!m) return { before: 0, after: 0 };
    return { before: countWords(t.slice(0, m.index)), after: countWords(t.slice(m.index + m[0].length)) };
  } catch (_) {
    // Engine without lookbehind / \p{L}: fall back to a plain index scan.
    const idx = t.toLowerCase().indexOf(w.toLowerCase());
    if (idx < 0) return { before: 0, after: 0 };
    return { before: countWords(t.slice(0, idx)), after: countWords(t.slice(idx + w.length)) };
  }
}

// Build up to `matchesPerWord` captured-shaped items for a single vocab word.
// matches: [{ link, source, lines, pos }] where `lines` is [{index, ts, te, text}]
// and `pos` is the array position of the matched line within `lines`.
//
// Context lines are added by WORD COUNT, not a fixed span: if the matched line
// already carries >= `minWordsAround` words before AND after the vocab word, no
// context is added; otherwise neighbouring lines are added one at a time on the
// deficient side(s), accumulating their words, until each side reaches the
// threshold — but never more than `contextLines` lines per side. The resulting
// window still passes through contiguousClipWindow so it can't span a temporal
// gap. `minWordsAround` defaults to Infinity (always grow to ±contextLines) so
// callers that don't pass it keep the old fixed-span behaviour. lineIndex points
// at the matched line's SRT index (what previews/playback use).
export function buildAutoItemsForWord(word, matches, opts = {}) {
  const matchesPerWord = opts.matchesPerWord == null ? 1 : opts.matchesPerWord;
  const contextLines = opts.contextLines == null ? 2 : opts.contextLines;
  const minWordsAround = opts.minWordsAround == null ? Infinity : opts.minWordsAround;
  const shuffle = opts.shuffle || fisherYates;
  const picked = shuffle(matches || []).slice(0, matchesPerWord);
  return picked.map(({ link, source, lines, pos, word: matchWord }) => {
    // Prefer the single surface word that actually matched this line over the
    // whole expanded alternation ("går|gick" → "gick"), so each item is a
    // real word. Fall back to the passed word when no surface word is given.
    const w = matchWord || word;
    const last = lines.length - 1;
    // Words already flanking the vocab word in the matched line; grow only the
    // side(s) short of minWordsAround, capped at contextLines lines per side.
    const flank = wordsAroundInLine(lines[pos] && lines[pos].text, w);
    let wb = flank.before;
    let wa = flank.after;
    let from = pos;
    let to = pos;
    for (let k = 1; k <= contextLines && wb < minWordsAround; k++) {
      const i = pos - k;
      if (i < 0) break;
      wb += countWords(lines[i] && lines[i].text);
      from = i;
    }
    for (let k = 1; k <= contextLines && wa < minWordsAround; k++) {
      const i = pos + k;
      if (i > last) break;
      wa += countWords(lines[i] && lines[i].text);
      to = i;
    }
    // Contract the play-bounds to the contiguous run around the matched cue so a
    // sparse-snippet window doesn't span a temporal gap (see contiguousClipWindow).
    const win = contiguousClipWindow(lines, pos, {
      loBound: from,
      hiBound: to,
      gapThreshold: opts.gapThreshold,
      maxDuration: opts.maxDuration,
    });
    return {
      st: w,
      w,
      it: {
        searchText: w,
        word: w,
        id: link,
        source,
        timeStart: win.timeStart,
        timeEnd: win.timeEnd,
        lineIndex: lines[pos].index,
        enabled: true,
      },
    };
  });
}

// Dedupe {st,w,it} tuples by (id, lineIndex), shuffle, slice to `count`, and
// group back into an items map { st: { w: [item, ...] } }. Items are deep-copied
// so the snapshot never aliases the source playlists.
export function sampleAndGroup(tuples, opts = {}) {
  const count = opts.count == null ? 50 : opts.count;
  const shuffle = opts.shuffle || fisherYates;
  const seen = new Set();
  const deduped = [];
  (tuples || []).forEach((t) => {
    if (!t || !t.it) return;
    const it = t.it;
    const key = `${it.id || ""}|${it.lineIndex == null ? "" : it.lineIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(t);
  });
  const pick = shuffle(deduped).slice(0, count);
  const grouped = {};
  pick.forEach(({ st, w, it }) => {
    if (!grouped[st]) grouped[st] = {};
    if (!grouped[st][w]) grouped[st][w] = [];
    grouped[st][w].push(JSON.parse(JSON.stringify(it)));
  });
  return grouped;
}
