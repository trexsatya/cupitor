// music-script.js — interactive practice scripts: prose + commands, one step per line.
//
//   Notice this arpeggio   > playTag(1,5,8b | 1,5,8)
//   Notice the melody      > playTagAll(1,2,3,2,1)
//   Work the jump          > tempo(60 | 100) repeat(4) playBars(12,16)
//   Only where A says it   > inPhrase(A) playTagAll(1,2,3,2,1)
//   Now hear it in place   > inPhrase(A) playPhraseWith(1,2,3,2,1)
//   Can you hear it?       > ask()
//
// Text before `>` is what the script SAYS; after it is what the script DOES. A line with no `>` is
// prose only; a line that is only commands runs silently. Blank lines and `#` comments are skipped.
//
// The words may carry a little inline markup — `Play <b>softly</b> > playBars(12,16)`. A `>` inside a
// tag therefore does NOT end the prose; see proseCut.
//
// No DOM and no playback here — this module turns text into a step list and back. The runner in
// music.html owns the actual highlighting and sound, so the whole grammar is testable without a
// browser, and a typo in a script produces a readable error instead of a dead panel.

// Arguments are separated by `|`, NOT commas — the motif names in this app are things like "1,5,8b"
// and "1,2,3,2,1", so a comma is DATA, not punctuation.
//
// Commas are accepted only for commands whose arguments are inherently numeric (playBars, show,
// tempo…). Deciding that from the TEXT instead — "it's all digits and commas, so split it" — is what
// a first cut did, and it tore the motif "1,5,8" into three arguments. What the command MEANS is
// knowable; what a string looks like is not. Quotes are stripped if present.
export function splitArgs(raw, numeric = false) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return [];
  const parts = s.includes('|') ? s.split('|') : (numeric ? s.split(',') : [s]);
  return parts.map((p) => p.trim().replace(/^(['"])(.*)\1$/, '$2')).filter((p) => p !== '');
}

// Every verb a script may use, with how many arguments it takes and what it means. Anything not
// listed is a parse error naming the line — a silent no-op would look like a broken feature.
// `numeric: true` means the arguments are numbers, so a comma may separate them. Everything else
// takes NAMES, where a comma belongs to the name and only `|` separates.
export const COMMANDS = {
  playTag:      { args: '1+', doc: 'Play these motifs’ own notes — or, with inPhrase, every time they occur inside that phrase' },
  playTagAll:   { args: '1+', doc: 'Play these motifs and every match found for them' },
  playPhrase:   { args: '1',  doc: 'Play a phrase — a detected letter (A, or B2 / B′ for one of its returns) or a phrase you named. It names its own phrase, so it takes no inPhrase / inBars' },
  inBars:       { args: '1-2', doc: 'Keep this line to these bars — inBars(9-16). Same idea as inPhrase, said outright' },
  inPhrase:     { args: '1',  doc: 'Keep this line to one phrase — B every place it occurs, B2 just the second, B′ only the modified returns. Its bars are shaded, and only what falls inside them sounds. Scopes the motif verbs; playPhrase names its own' },
  playPhraseWith: { args: '1+', doc: 'Play the whole phrase named by inPhrase(), with these motifs lit inside it' },
  playBars:     { args: '2',  numeric: true, doc: 'Play a range of bars, leaving the sheet as it is — use show() to narrow the view' },
  playGroup:    { args: '1',  doc: 'Play a rhythm group' },
  compare:      { args: '2+', doc: 'Play each of these in turn with a gap, to hear them against each other' },
  show:         { args: '2',  numeric: true, doc: 'Show only these measures' },
  full:         { args: '0',  doc: 'Show the whole piece' },
  tempo:        { args: '1-2', numeric: true, doc: 'Set the tempo; two values ramp across the repeats' },
  repeat:       { args: '1',  numeric: true, doc: 'Run this line’s other commands N times' },
  gap:          { args: '1',  numeric: true, doc: 'Seconds of quiet after this step, instead of the panel’s gap' },
  wait:         { args: '1',  numeric: true, doc: 'Pause for N seconds, where it sits in the line' },
  ask:          { args: '0-1', doc: 'Stop until you click Continue' },
  originalView: { args: '0',  doc: 'Clear every highlight — the piece as written' },
};

// Commands whose arguments are motif names, so a renamed motif can be followed into a saved script.
// `compare` is in the list because its arguments are resolved as a phrase first and a motif second —
// a stale motif name there fails at run time just the same.
const TAG_ARG_COMMANDS = ['playTag', 'playTagAll', 'playPhraseWith', 'compare'];
// …and the ones whose arguments are phrase names. `playPhraseWith` is deliberately NOT here: its
// arguments are the MOTIFS to light inside the phrase, and the phrase comes from inPhrase on the line.
const PHRASE_ARG_COMMANDS = ['inPhrase', 'playPhrase', 'compare'];

// Rewrite a script so every argument of `commands` naming `from` becomes `to`. Returns { text, lines } —
// `lines` is how many lines changed, so the caller can say what it touched instead of claiming a silent
// success.
//
// Only a WHOLE argument is replaced, never a substring: motif names in this app are things like "1,5,8"
// and "1,5,8b", so a plain text replace of "1,5,8" would corrupt "1,5,8b" on the same line into
// "<new>b". Prose (before `>`) is left alone — it is what the script SAYS, not a reference.
function renameArgInScript(text, from, to, commands) {
  const clean = (to || '').trim();
  const src = String(text == null ? '' : text);
  if (!clean || !from || clean === from) return { text: src, lines: 0 };
  let lines = 0;
  const out = src.split('\n').map((line) => {
    const cut = proseCut(line);
    if (cut < 0) return line;                       // prose only — no commands to rewrite
    const head = line.slice(0, cut + 1);
    const body = line.slice(cut + 1).replace(/([A-Za-z_][\w]*)\s*\(([^()]*)\)/g, (whole, name, args) => {
      if (!commands.includes(name)) return whole;
      const parts = args.split('|');
      if (!parts.some((p) => p.trim() === from)) return whole;
      return `${name}(${parts.map((p) => (p.trim() === from ? p.replace(from, clean) : p)).join('|')})`;
    });
    if (body !== line.slice(cut + 1)) lines++;
    return head + body;
  }).join('\n');
  return { text: out, lines };
}

export function renameTagInScript(text, from, to) { return renameArgInScript(text, from, to, TAG_ARG_COMMANDS); }
// A phrase rename has to reach the script for the same reason a motif rename does: the name IS the
// reference, so a script left pointing at the old one just stops finding it.
export function renamePhraseInScript(text, from, to) { return renameArgInScript(text, from, to, PHRASE_ARG_COMMANDS); }

// Spellings that were renamed. A script lives with its piece, so scripts written before a rename are
// still out there; reading the old name as the new one keeps them running instead of failing with
// "unknown command". Deliberately NOT in COMMANDS, so the panel's help lists one name per verb.
const ALIASES = { inMeasures: 'inBars' };

function arityOk(spec, n) {
  if (spec === '0') return n === 0;
  if (spec === '1') return n === 1;
  if (spec === '2') return n === 2;
  if (spec === '0-1') return n === 0 || n === 1;
  if (spec === '1-2') return n === 1 || n === 2;
  if (spec === '1+') return n >= 1;
  if (spec === '2+') return n >= 2;
  return true;
}

// Pull `name(args)` calls out of the command half of a line, in order. Tolerates the trailing commas
// and stray whitespace that come from typing a list by hand.
export function parseCalls(text, lineNo) {
  const out = [];
  const errors = [];
  const src = String(text || '');
  const re = /([A-Za-z_][\w]*)\s*\(([^()]*)\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = ALIASES[m[1]] || m[1];   // an old spelling is read as the name it was renamed to
    const spec = COMMANDS[name];
    if (!spec) { errors.push({ line: lineNo, message: `unknown command "${name}"` }); continue; }
    const args = splitArgs(m[2], !!spec.numeric);
    if (!arityOk(spec.args, args.length)) {
      errors.push({ line: lineNo, message: `"${name}" got ${args.length} argument${args.length === 1 ? '' : 's'}` });
      continue;
    }
    out.push({ name, args });
  }
  // Anything left over that looks like a bare word is almost certainly a mistyped call.
  const leftovers = src.replace(re, ' ').replace(/[,;\s]+/g, ' ').trim();
  if (leftovers) errors.push({ line: lineNo, message: `don’t understand "${leftovers}"` });
  return { calls: out, errors };
}

// Where the prose ends and the commands begin: the index of the first `>` that is NOT part of an HTML
// tag, or -1 when the line is prose only.
//
// It cannot simply be the first `>`. A step's words may carry markup, and `Play <b>softly</b> > wait(3)`
// has its first `>` closing the <b> — which cut the prose to "Play <b" and fed "softly</b> …" to the
// command parser. So a `<` that opens a tag (`<name`, `</name`) skips to that tag's `>`, and only a `>`
// reached outside a tag separates. A stray `<` that is not a tag ("a < b") is just text and is stepped
// over. Exported because the same rule has to hold anywhere a line is split.
export function proseCut(line) {
  const s = String(line == null ? '' : line);
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '<' && /[A-Za-z/]/.test(s[i + 1] || '')) {
      const close = s.indexOf('>', i + 1);
      if (close < 0) return -1;   // an unclosed tag swallows the rest of the line; no separator in it
      i = close;                  // resume just after this tag
      continue;
    }
    if (s[i] === '>') return i;
  }
  return -1;
}

// Parse a whole script into steps. Never throws: unparseable lines become errors carried alongside
// the steps, so the panel can show what is wrong AND still run what is right.
export function parseScript(text) {
  const steps = [];
  const errors = [];
  String(text == null ? '' : text).split('\n').forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || /^\s*#/.test(line)) return;         // blank line / comment
    const cut = proseCut(line);
    const prose = (cut >= 0 ? line.slice(0, cut) : line).trim();
    const cmdText = cut >= 0 ? line.slice(cut + 1) : '';
    const { calls, errors: errs } = cut >= 0 ? parseCalls(cmdText, lineNo) : { calls: [], errors: [] };
    errs.forEach((e) => errors.push(e));
    // `repeat`, `tempo` and `inPhrase` describe the STEP rather than being actions in their own
    // right; lift them out so the runner doesn't have to care where on the line they were written.
    let repeat = 1, tempoFrom = null, tempoTo = null, phrase = null, gap = null, measures = null;
    const actions = [];
    calls.forEach((c) => {
      if (c.name === 'inPhrase') { phrase = c.args[0]; return; }
      if (c.name === 'inBars') {
        // "9-16" is one argument with a dash in it; "9 | 16" is two. Both read naturally, so take both.
        const parts = c.args.length > 1 ? c.args : String(c.args[0]).split(/[-–—]/);
        const a = parseInt(parts[0], 10);
        const b = parseInt(parts[1] != null && String(parts[1]).trim() !== '' ? parts[1] : parts[0], 10);
        if (Number.isFinite(a) && Number.isFinite(b)) measures = [Math.min(a, b), Math.max(a, b)];
        else errors.push({ line: lineNo, message: `inBars needs bars like 9-16, got "${c.args.join(' | ')}"` });
        return;
      }
      if (c.name === 'gap') {
        const g = parseFloat(c.args[0]);
        if (Number.isFinite(g) && g >= 0) gap = g;
        else errors.push({ line: lineNo, message: `gap needs a number of seconds, got "${c.args[0]}"` });
        return;
      }
      if (c.name === 'repeat') {
        const n = parseInt(c.args[0], 10);
        if (Number.isFinite(n) && n > 0) repeat = n;
        else errors.push({ line: lineNo, message: `repeat needs a whole number, got "${c.args[0]}"` });
        return;
      }
      if (c.name === 'tempo') {
        const a = parseFloat(c.args[0]);
        const b = c.args.length > 1 ? parseFloat(c.args[1]) : null;
        if (!Number.isFinite(a) || (c.args.length > 1 && !Number.isFinite(b))) {
          errors.push({ line: lineNo, message: `tempo needs a number, got "${c.args.join(' | ')}"` });
          return;
        }
        tempoFrom = a; tempoTo = (b == null ? null : b);
        return;
      }
      actions.push(c);
    });
    // A scope and playPhrase name two different places on one line, and the line then does both: the
    // scope shades ITS bars and picks ITS occurrences, and playPhrase plays whatever IT was given. What
    // you see and what you hear come apart, silently. playPhrase already carries the phrase it plays, so
    // the scope has nothing left to say — it is dropped, and the line is reported. Dropping the scope
    // rather than the verb because the verb is the half that makes a sound: a line that says
    // "play B" must play B, not fall quiet because it also said something contradictory.
    const playsPhrase = actions.find((c) => c.name === 'playPhrase');
    if (playsPhrase && (phrase != null || measures != null)) {
      const said = phrase != null ? `inPhrase(${phrase})` : `inBars(${measures[0]}-${measures[1]})`;
      const name = playsPhrase.args[0];
      errors.push({ line: lineNo, message: phrase != null && phrase === name
        ? `${said} says the same thing as playPhrase(${name}) — drop the inPhrase`
        : `${said} and playPhrase(${name}) name two different places — ${measures != null
          ? `use playBars(${measures[0]},${measures[1]}) for the bars` : 'say the phrase once'}` });
      phrase = null; measures = null;
    }
    if (!prose && !actions.length && tempoFrom == null && repeat === 1
        && phrase == null && gap == null && measures == null) return;   // nothing on the line
    steps.push({ line: lineNo, prose, actions, repeat, tempoFrom, tempoTo, phrase, gap, measures });
  });
  return { steps, errors };
}

// The tempo for pass `pass` (0-based) of a step. One value holds; two ramp evenly across the
// repeats, so `tempo(60 | 100) repeat(4)` plays at 60, 73, 87, 100 — a practice loop that speeds up.
export function tempoForPass(step, pass) {
  if (!step || step.tempoFrom == null) return null;
  if (step.tempoTo == null || step.repeat <= 1) return step.tempoFrom;
  const t = Math.min(Math.max(pass, 0), step.repeat - 1) / (step.repeat - 1);
  return Math.round(step.tempoFrom + (step.tempoTo - step.tempoFrom) * t);
}

// ── Writing a line back out ─────────────────────────────────────────────────────────────────────────
// Parsing is only half of an editor: a builder that offers menus instead of typing has to turn the
// choices back into the one text that is still the script's source of truth. These are the inverse of
// parseCalls / parseScript, and the two are tested against each other.

// How each command's arguments are edited. `labels` name the slots in order, `kind` picks the control
// and where its suggestions come from, and `variadic` means "as many as you like" (the `1+` / `2+`
// arities). A command missing from here still gets plain text boxes, so this table can never make a
// verb un-editable.
export const ARG_UI = {
  playTag:        { kind: 'tag',    labels: ['motif'], variadic: true },
  playTagAll:     { kind: 'tag',    labels: ['motif'], variadic: true },
  playPhraseWith: { kind: 'tag',    labels: ['motif'], variadic: true },
  playPhrase:     { kind: 'phrase', labels: ['phrase'] },
  inPhrase:       { kind: 'phrase', labels: ['phrase'] },
  playGroup:      { kind: 'group',  labels: ['rhythm group'] },
  compare:        { kind: 'name',   labels: ['this'], variadic: true },
  inBars:         { kind: 'bar',    labels: ['from', 'to'] },
  playBars:       { kind: 'bar',    labels: ['from', 'to'] },
  show:           { kind: 'bar',    labels: ['from', 'to'] },
  tempo:          { kind: 'number', labels: ['bpm', 'to bpm'] },
  repeat:         { kind: 'number', labels: ['times'] },
  gap:            { kind: 'number', labels: ['seconds'] },
  wait:           { kind: 'number', labels: ['seconds'] },
  ask:            { kind: 'text',   labels: ['question'] },
  full:           { kind: 'none',   labels: [] },
  originalView:   { kind: 'none',   labels: [] },
};

// `name(args)` as a script would write it. The separator is not cosmetic — it is the difference between
// one argument and several, and each command decides it (see splitArgs).
//
// inBars is the special case, and the reason this function exists rather than being inlined: it is NOT
// declared numeric, so `inBars(9,16)` reads as the single argument "9,16" and parses to bar 9 alone —
// silently practising one bar instead of eight. Written with a dash it means what it says.
export function formatCall(name, args) {
  const spec = COMMANDS[name];
  const list = (args || []).map((a) => String(a == null ? '' : a).trim()).filter((a) => a !== '');
  if (!list.length) return `${name}()`;
  if (name === 'inBars') return `${name}(${list.length > 1 ? `${list[0]}-${list[1]}` : list[0]})`;
  return `${name}(${list.join(spec && spec.numeric ? ',' : ' | ')})`;
}

// Prose + calls → the whole line. `column` keeps the `>` where it already was, so editing one argument
// does not un-align a script someone lined up by hand; it is a minimum, never a truncation.
export function formatLine(prose, calls, { column = 0 } = {}) {
  const cmds = (calls || []).map((c) => formatCall(c.name, c.args)).join(' ').trim();
  const words = String(prose == null ? '' : prose).replace(/\s+$/, '');
  if (!cmds) return words;
  if (!words) return `> ${cmds}`;
  const pad = words.length < column ? ' '.repeat(column - words.length) : ' ';
  return `${words}${pad}> ${cmds}`;
}

// One-line summary of what a step will do — shown next to the prose so a script reads as a plan
// even before it runs.
export function describeStep(step) {
  if (!step) return '';
  const bits = step.actions.map((a) => `${a.name}(${a.args.join(' | ')})`);
  if (step.measures) bits.unshift(`in m${step.measures[0]}–${step.measures[1]}`);
  else if (step.phrase) bits.unshift(`in ${step.phrase}`);
  if (step.tempoFrom != null) {
    bits.unshift(step.tempoTo == null ? `tempo ${step.tempoFrom}` : `tempo ${step.tempoFrom}→${step.tempoTo}`);
  }
  if (step.repeat > 1) bits.push(`×${step.repeat}`);
  if (step.gap != null) bits.push(`gap ${step.gap}s`);
  return bits.join(' · ');
}
