// Guessing which word in the studied language corresponds to an English one,
// and grouping search results by that guess.
//
// The problem: searching in English finds English subtitle lines, and every
// one of them is paired with a line in the studied language. Those paired
// lines are the interesting half — but they arrive as an undifferentiated
// list, when in truth they are several different words. "precisely" turns up
// as "just" in most lines and "precis" in others, and seeing those apart is
// the whole point of looking.
//
// Nothing here knows about the DOM, the vocabulary store or the host app. The
// caller collects the lines and whatever extra guesses it can get hold of, and
// passes them in.

export const EVERYTHING_ELSE = '_everything_else';

// A word seen in only one line tells you nothing — every line contains plenty
// of words exactly once. Repetition across independent lines is the whole
// signal, so two is the floor for frequency alone. A word reaching us from the
// vocabulary, the translator or a cognate match is admitted on that evidence
// instead and does not need to repeat.
export const MIN_DOC_COUNT = 2;

// One and two-letter tokens are almost all grammar, and the stop-word list
// cannot name every inflected clitic.
export const MIN_TOKEN_LEN = 3;

// Enough groups to separate the real senses, few enough to stay readable.
export const MAX_GROUPS = 6;

// How much of a word two languages must share before it reads as the same
// word rather than a coincidence. Four is long enough to rule out chance
// among short function words and short enough to catch precis/precisely,
// exakt/exactly, natur/nature.
export const COGNATE_MIN_PREFIX = 4;

// What each signal is worth. Deliberately far apart rather than finely tuned:
// these decide the ORDER groups are offered in, and a near-tie between two
// signals is not a distinction worth defending.
const SCORE_TRANSLATION = 12;
const SCORE_VOCABULARY = 10;
const SCORE_COGNATE = 6;

// Repetition is scored as a SHARE of the lines, not a count. A word in two of
// three lines is the answer; the same two out of two hundred is noise, and a
// raw count cannot tell those apart — it would also let a long result set
// outvote the translator simply by being long.
const SCORE_REPEATED_MAX = 10;

// Below this many lines there is no such thing as a share. With two lines
// every word they happen to have in common scores full marks, and the
// headings come out as whatever those two sentences share — which on a pair
// of subtitles is usually a pronoun and a verb.
export const MIN_LINES_FOR_FREQUENCY = 3;

// Letters, not bytes: the studied languages carry åäöéüñ and the apostrophe
// inside a word ("it's") should not split it.
const WORD_SPLIT_RE = /[^\p{L}\p{M}'’-]+/u;

export function tokenizeLine(text) {
  if (typeof text !== 'string' || !text) return [];
  return text
    .toLowerCase()
    .split(WORD_SPLIT_RE)
    .map(w => w.replace(/^['’-]+|['’-]+$/g, ''))
    .filter(Boolean);
}

// How many lines each word appears in — lines, not occurrences. A word said
// three times in one excited line is one piece of evidence, not three.
export function documentFrequencies(lines) {
  const freq = new Map();
  (lines || []).forEach(line => {
    new Set(tokenizeLine(line)).forEach(tok => {
      freq.set(tok, (freq.get(tok) || 0) + 1);
    });
  });
  return freq;
}

// Whether two words look like the same word borrowed across the two
// languages. Compares from the front because that is where a shared root
// lives; endings are exactly what differs between languages.
export function isCognate(a, b, minPrefix = COGNATE_MIN_PREFIX) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  if (x.length < minPrefix || y.length < minPrefix) return false;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i >= minPrefix;
}

// Whether a line's word counts as an occurrence of a candidate. Exact first;
// failing that, the line's word may carry an ending the candidate does not
// ("precis" in "precisa").
//
// How much ending is allowed scales with the candidate, because a fixed
// allowance means something quite different at each length: three spare
// letters on a four-letter word is half as much word again, and "hand" would
// swallow handel, handla and handske — different words, not inflections. A
// third of the candidate's length keeps the allowance proportionate.
export function wordMatches(token, candidate) {
  const t = String(token || '').toLowerCase();
  const c = String(candidate || '').toLowerCase();
  if (!t || !c) return false;
  if (t === c) return true;
  if (c.length < COGNATE_MIN_PREFIX) return false;
  const slack = Math.min(3, Math.floor(c.length / 3));
  return t.startsWith(c) && t.length - c.length <= slack;
}

export function lineContainsWord(line, candidate) {
  return tokenizeLine(line).some(tok => wordMatches(tok, candidate));
}

// Rank the words that might be the counterpart of `searchWord`.
//
//   lines           — the studied-language line paired with each result
//   searchWord      — what was typed, in English
//   vocabWords      — studied-language headwords whose English gloss matches
//   translatedWords — what the host's translator made of `searchWord`
//   stopWords       — a Set of words that never anchor a group
//
// A candidate reaching us from the vocabulary or the translator is kept even
// when it appears in none of the lines: that is precisely the word worth
// searching for separately, and its group fills up once the caller does.
export function guessCorrespondingWords({
  lines = [],
  searchWord = '',
  vocabWords = [],
  translatedWords = [],
  stopWords = new Set(),
  max = MAX_GROUPS,
} = {}) {
  const freq = documentFrequencies(lines);
  const isStop = w => stopWords instanceof Set ? stopWords.has(w) : false;
  const usable = w => typeof w === 'string' && w.length >= MIN_TOKEN_LEN && !isStop(w);

  const cand = new Map();
  const note = (word, points, reason) => {
    const w = String(word || '').toLowerCase().trim();
    if (!usable(w)) return;
    const at = cand.get(w) || { word: w, score: 0, reasons: [], docCount: freq.get(w) || 0 };
    at.score += points;
    if (!at.reasons.includes(reason)) at.reasons.push(reason);
    cand.set(w, at);
  };

  // Repetition across the lines.
  const lineCount = (lines || []).length;
  if (lineCount >= MIN_LINES_FOR_FREQUENCY) {
    freq.forEach((count, word) => {
      if (count >= MIN_DOC_COUNT) note(word, SCORE_REPEATED_MAX * count / lineCount, 'repeated');
    });
  }

  // The dictionary the user has been building all along.
  (vocabWords || []).forEach(w => note(w, SCORE_VOCABULARY, 'vocabulary'));

  // What the host app makes of the word.
  (translatedWords || []).forEach(w => note(w, SCORE_TRANSLATION, 'translated'));

  // Words that simply look like the English one.
  const search = String(searchWord || '').toLowerCase().trim();
  if (search) {
    freq.forEach((_count, word) => {
      if (isCognate(word, search)) note(word, SCORE_COGNATE, 'cognate');
    });
  }

  return [...cand.values()]
    .sort((a, b) =>
      b.score - a.score ||
      b.docCount - a.docCount ||
      a.word.localeCompare(b.word))
    .slice(0, Math.max(0, max));
}

// Put each result under the first candidate its line uses, and everything the
// candidates do not account for under one last group.
//
//   lineOf — pulls the studied-language line out of a result
//
// First match rather than every match, so a line mentioning two candidates
// lands once, under the stronger of the two. An item appearing in two places
// reads as two findings when it is one.
export function groupResultsByWord(items, candidates, lineOf) {
  const ranked = (candidates || []).map(c => (typeof c === 'string' ? { word: c } : c)).filter(c => c && c.word);
  const buckets = new Map(ranked.map(c => [c.word, []]));
  const rest = [];

  (items || []).forEach(item => {
    const line = typeof lineOf === 'function' ? lineOf(item) : '';
    const tokens = tokenizeLine(line);
    const hit = ranked.find(c => tokens.some(tok => wordMatches(tok, c.word)));
    if (hit) buckets.get(hit.word).push(item);
    else rest.push(item);
  });

  const groups = ranked
    .map(c => ({ word: c.word, reasons: c.reasons || [], items: buckets.get(c.word) }))
    .filter(g => g.items.length);
  if (rest.length) groups.push({ word: EVERYTHING_ELSE, reasons: [], items: rest });
  return groups;
}

// Keep at most `max` headings — without losing a single finding.
//
// Capping the headings and capping the results are different things, and
// conflating them is silently destructive: the groups that miss the cut hold
// real hits, and dropping them leaves no trace that they were ever found. They
// move to the sweep-up instead, which is exactly what it is for.
export function capGroups(groups, max = MAX_GROUPS) {
  const all = groups || [];
  const sweep = all.find(g => g && g.word === EVERYTHING_ELSE);
  const named = all.filter(g => g && g.word !== EVERYTHING_ELSE);
  const keep = Math.max(0, max);
  const leftOver = (sweep ? sweep.items : []).concat(named.slice(keep).flatMap(g => g.items || []));
  const out = named.slice(0, keep);
  if (leftOver.length) out.push({ word: EVERYTHING_ELSE, reasons: [], items: leftOver });
  return out;
}
