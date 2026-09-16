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

// …but repetition on its own is worthless, because the words that repeat most
// are the ones that repeat everywhere. Counting alone, an English search for
// "thin" proposed "ska" and "den" as its Swedish counterparts — they were in
// more of the matched lines than "tunna" was, as they are in more of ANY
// lines. What marks a translation is not that it is frequent here but that it
// is frequent HERE AND NOWHERE ELSE.
//
// So each word is measured against how often it appears in the same subtitles
// generally. Lift is that ratio: a grammar word scores about 1 whatever you
// search for, while the word the search is really about scores in the tens or
// hundreds.
//
// Two things to know about where it bites. The everyday-word ceiling below is
// what actually throws out the grammar words — by the time a word has passed
// that and the share floor, lift only decides the narrow band between them, so
// these three are one test and not three. And because the background is drawn
// from the very files the matches came from, lift cannot exceed the number of
// background lines divided by the number of matched ones: a search whose hits
// fill more than an eighth of the files it pulled down leaves no word able to
// clear this bar, and the subtitles contribute nothing. That is the right
// answer for the searches it happens to — "the", matching 13,938 lines, has no
// counterpart to find — but it is a ceiling on the evidence, not a judgement.
export const MIN_LIFT = 8;

// And a word has to account for a fair share of the matches, not just clear
// the lift bar. Lift alone promotes rare accidents: two subtitles out of 193
// that happen to mention "hönshuset" score enormous lift and mean nothing,
// while "huset" — in 76 of them — is the answer.
export const MIN_HIT_SHARE = 0.15;

// A word this ordinary is grammar, whatever the numbers say about it here.
// Measured rather than listed, because a list is one language's opinion and
// this runs over whichever language is being studied. In 13,000 lines of
// Swedish subtitles the split is unmistakable: inte 8.7%, har 9.3%, men 7.7%,
// ska 4.5%, kan 4.3%, bara 2.7% — against tror 1.4%, blir 1.6%, vatten 0.2%,
// tunna 0.01%. Nothing real lives between them.
export const MAX_BACKGROUND_SHARE = 0.025;

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

// A dictionary entry is a ranked list, not a set. Asked about "lake" the host
// offers sjö first, then insjö, göl, träsk — all true, steadily rarer. So each
// step down the list is worth a little less, the first sense keeping the full
// weight a lone translation has always had, and the tail never falling below
// what a mere resemblance is worth. Position is what the ranking rests on
// rather than the score that sometimes accompanies a term, because that score
// is absent more often than it is present.
const SCORE_TRANSLATION_RANK_STEP = 2;
const SCORE_TRANSLATION_MIN = SCORE_COGNATE;

// What a confirmed guess is worth: exactly what the translator's own answer is
// worth, because it is the same claim reached from the other end — there the
// translator named this word, here it is handed this word and names the search.
// Worth no more than that, or a word only the subtitles point at would outrank
// one both the subtitles and the dictionary agree on, which cannot be right.
const SCORE_CONFIRMED = SCORE_TRANSLATION;

// What surviving the corpus tests is worth. A word that clears the lift bar,
// the share bar and the everyday-word ceiling has been checked three times
// against the subtitles in hand, which is why it is worth more than a
// dictionary sense that appears in none of them. The dictionary offers every
// sense a word has ever had; these lines show which one is actually in front
// of the reader.
const SCORE_DISTINCTIVE = 14;

// And among the words that survive, the one used in most of the matched lines
// leads. Scored as a share so it stays comparable however many results there
// are.
const SCORE_REPEATED_MAX = 10;

// Below this many lines there is no such thing as a share.
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

// Whether two words in the SAME language are the same word, one of them
// possibly inflected: thin/thinner, house/houses.
//
// A different question from the cognate rule above, and it must not borrow it.
// Across languages a shared opening is worth something because the endings are
// exactly what differ. Between two English words a shared opening of four
// letters is commonplace and means nothing: start/starve, police/policy,
// plan/plant, read/ready. One word has to BE the other with an ending on it,
// which is the only way a back-translation legitimately differs from the word
// that was searched for.
const SAME_WORD_SUFFIX_SLACK = 3;
export function sameWord(a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  if (short.length < MIN_TOKEN_LEN) return false;
  return long.startsWith(short) && long.length - short.length <= SAME_WORD_SUFFIX_SLACK;
}

// Rank the words that might be the counterpart of `searchWord`.
//
//   lines           — the studied-language line paired with each result
//   searchWord      — what was typed, in English
//   vocabWords      — studied-language headwords whose English gloss matches
//   translatedWords — what the host's translator made of `searchWord`: plain
//                     words, or `{ word, rank }` when the host's dictionary
//                     answered with ranked senses
//   stopWords       — a Set of words that never anchor a group
//   background      — Map of word → how many lines of the SAME subtitles
//                     contain it, matched or not; the yardstick for lift
//   backgroundLines — how many lines that Map was built from
//
// Without a background nothing is read from repetition at all. There is no
// safe way to tell a translation from a preposition by counting alone, and
// guessing produces headings that are actively misleading — worse than the
// plain list the caller falls back to.
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
  background = null,
  backgroundLines = 0,
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

  // Words that stand out from these subtitles' ordinary vocabulary.
  const lineCount = (lines || []).length;
  const bgTotal = Number(backgroundLines) || 0;
  const haveBackground = background instanceof Map && bgTotal > 0;
  if (lineCount >= MIN_LINES_FOR_FREQUENCY && haveBackground) {
    // Has to account for a real share of the matches, and at least two of
    // them however small the search.
    const floor = Math.max(MIN_DOC_COUNT, Math.ceil(MIN_HIT_SHARE * lineCount));
    freq.forEach((count, word) => {
      if (count < floor) return;
      const bgCount = background.get(word) || 0;
      // The background is drawn from the same subtitles as the matches, so a
      // word found here is found there. Treat an absent one as unremarkable
      // rather than as infinitely distinctive.
      if (bgCount <= 0) return;
      // Everyday words are out before the arithmetic starts. On a small
      // search the background is small too, and lift measured over a few
      // hundred lines is noisy enough to let one through.
      if (bgCount / bgTotal > MAX_BACKGROUND_SHARE) return;
      const lift = (count / lineCount) / (bgCount / bgTotal);
      if (lift < MIN_LIFT) return;
      note(word, SCORE_DISTINCTIVE + SCORE_REPEATED_MAX * count / lineCount, 'distinctive');
    });
  }

  // The dictionary the user has been building all along.
  (vocabWords || []).forEach(w => note(w, SCORE_VOCABULARY, 'vocabulary'));

  // What the host app makes of the word. Either a bare word — all a plain
  // translation gives — or one of the ranked senses the host's dictionary
  // answered with.
  (translatedWords || []).forEach((entry, i) => {
    const word = typeof entry === 'string' ? entry : (entry && entry.word);
    const rank = (entry && Number.isFinite(entry.rank)) ? entry.rank : i;
    note(word, Math.max(SCORE_TRANSLATION_MIN, SCORE_TRANSLATION - rank * SCORE_TRANSLATION_RANK_STEP), 'translated');
  });

  // Looking like the English word promotes a candidate; it does not make one.
  //
  // As an admission route it earned its keep only in false positives: an
  // English search for "house" found the untranslated word "house" in three of
  // 193 lines and put it above "huset", and "angry" turned up "angrep" —
  // Swedish for "attacked" — sharing four letters and nothing else. A word
  // used in too few of the matches to qualify on its own evidence is not made
  // trustworthy by resembling the search term. Where the resemblance IS
  // meaningful the word is already here on its distribution, and this lifts it
  // over its rivals.
  const search = String(searchWord || '').toLowerCase().trim();
  if (search) {
    cand.forEach((entry, word) => {
      if (!isCognate(word, search)) return;
      entry.score += SCORE_COGNATE;
      if (!entry.reasons.includes('cognate')) entry.reasons.push('cognate');
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

// How sure the host's dictionary is about one of its terms.
//
// Its `score` is the honest answer where there is one, but there usually is
// not: of the six senses it gives for "sjö" only two carry a score, and the
// four without are the rarer ones. So a term with no score is placed by where
// the dictionary put it — which is the same information, less precisely.
//
// The thresholds come from what real answers look like: the primary sense of a
// common word scores around 0.5 and its runner-up around 0.03, so anything past
// a tenth is the word you were looking for and anything under a fiftieth is a
// sense you will meet once a year.
export const CONFIDENCE_HIGH = 0.1;
export const CONFIDENCE_LOW = 0.02;

export function translationConfidence(term) {
  const score = term && term.score;
  if (Number.isFinite(score)) {
    if (score >= CONFIDENCE_HIGH) return 'high';
    if (score >= CONFIDENCE_LOW) return 'medium';
    return 'low';
  }
  const rank = term && term.rank;
  if (!Number.isFinite(rank)) return 'low';
  if (rank === 0) return 'high';
  return rank <= 2 ? 'medium' : 'low';
}

// Grade a whole answer, which is the only way the two measures can be read
// side by side.
//
// Scores and places are different scales, and colouring one term by each puts
// them in the same row as if they meant the same thing: a first sense scoring
// 0.015 would be the palest chip on screen while the unscored sense beside it —
// rarer, by the dictionary's own ordering — looks surer than it. So an answer
// carrying any score is read by score throughout, and one carrying none is read
// by where the dictionary put each term.
//
// Places are counted in the list as given, so terms dropped before display
// (the answer that merely echoes the word asked about) don't leave a gap that
// pushes everything after them down a grade.
export function translationConfidences(terms) {
  const list = terms || [];
  const scored = list.some(t => t && Number.isFinite(t.score));
  return list.map((t, i) => scored
    ? translationConfidence({ score: (t && Number.isFinite(t.score)) ? t.score : 0 })
    : translationConfidence({ rank: i }));
}

// Sink the groups that nothing the search itself found landed in.
//
//   foundBySearch — whether a result came from the search rather than from a
//                   sweep made on the strength of a guess
//
// A guess can collect a whole group in which not one line was found by the
// search: an English search for "thin" offers fin, smal and mager, and each
// gathers lines whose studied-language side uses it while their English side
// never says "thin". Worth keeping — they are the uses a straight English
// search cannot reach — but not worth ranking above the words the search did
// land on, which is where a good dictionary rank would otherwise carry them.
//
// Stable, so the ranking still decides the order within each half, and the
// sweep-up stays last wherever it was.
export function sinkUnevidencedGroups(groups, foundBySearch) {
  const all = groups || [];
  if (typeof foundBySearch !== 'function') return all;
  const named = all.filter(g => g && g.word !== EVERYTHING_ELSE);
  const unevidenced = g => g.items && g.items.length > 0 && !g.items.some(foundBySearch);
  return named.filter(g => !unevidenced(g))
    .concat(named.filter(unevidenced))
    .concat(all.filter(g => g && g.word === EVERYTHING_ELSE));
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

// Promote the candidates whose back-translation says they mean what was
// searched for.
//
//   backTranslations — Map of candidate word → what it translates back to,
//                      either the one answer a plain translation gives or
//                      every English sense the host's dictionary listed
//
// Only ever promotes. A translator asked for one word gives one answer, and a
// real sense often is not that answer — "kör" back-translates to "drives",
// which is a true sense of "run" and not a reason to throw the group away. So
// a confirmation lifts a candidate and a non-confirmation leaves it exactly
// where the evidence already put it.
export function confirmByBackTranslation(candidates, searchWord, backTranslations) {
  const search = String(searchWord || '').toLowerCase().trim();
  if (!search || !(backTranslations instanceof Map)) return candidates || [];
  return (candidates || []).map(c => {
    const back = backTranslations.get(c.word);
    if (!back) return c;
    // A dictionary answer is a list of senses, and the sense that matters is
    // rarely the first: asked what "kör" means a translator says "drives",
    // while its list says drive, run, operate. Checking the whole list is what
    // lets a real sense confirm.
    const hit = (Array.isArray(back) ? back : [back])
      .flatMap(b => tokenizeLine(String(b)))
      .some(w => sameWord(w, search));
    if (!hit) return c;
    return { ...c, score: c.score + SCORE_CONFIRMED, reasons: [...(c.reasons || []), 'confirmed'] };
  }).sort((a, b) =>
    b.score - a.score ||
    b.docCount - a.docCount ||
    a.word.localeCompare(b.word));
}
