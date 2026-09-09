import { parseScript, splitArgs, parseCalls, tempoForPass, describeStep, COMMANDS, renameTagInScript, proseCut,
  renamePhraseInScript, formatCall, formatLine, ARG_UI } from './music-script.js';

// The motif names in this app are literally things like "1,5,8b" — a comma is DATA here, not
// punctuation. That is why `|` separates arguments; commas survive only where they cannot be a name.
describe('splitArgs', () => {
  test('a motif name keeps its commas', () => {
    expect(splitArgs('1,5,8b')).toEqual(['1,5,8b']);
    expect(splitArgs('1,2,3,2,1')).toEqual(['1,2,3,2,1']);
  });

  test('the pipe separates several motif names', () => {
    expect(splitArgs('1,5,8b | 1,5,8')).toEqual(['1,5,8b', '1,5,8']);
    expect(splitArgs('1,5,8b|1,5,8|1,2,3,2,1')).toEqual(['1,5,8b', '1,5,8', '1,2,3,2,1']);
  });

  test('commas separate only where the command takes NUMBERS', () => {
    expect(splitArgs('12,16', true)).toEqual(['12', '16']);
    expect(splitArgs('60, 100', true)).toEqual(['60', '100']);
  });

  test('an all-numeric MOTIF name is still one name — this is the trap', () => {
    // "1,5,8" is a real motif in this library. Deciding by the look of the string would tear it up.
    expect(splitArgs('1,5,8')).toEqual(['1,5,8']);
    expect(splitArgs('1,5,8 | 1,3,5')).toEqual(['1,5,8', '1,3,5']);
  });

  test('quotes are optional and stripped', () => {
    expect(splitArgs('"1,5,8b" | "1,5,8"')).toEqual(['1,5,8b', '1,5,8']);
  });

  test('empty and whitespace-only argument lists', () => {
    expect(splitArgs('')).toEqual([]);
    expect(splitArgs('   ')).toEqual([]);
    expect(splitArgs('a | | b')).toEqual(['a', 'b']);
  });
});

describe('parseCalls', () => {
  test('several calls on one line, in order', () => {
    const { calls, errors } = parseCalls('tempo(60) playBars(12,16)', 1);
    expect(errors).toEqual([]);
    expect(calls).toEqual([
      { name: 'tempo', args: ['60'] },
      { name: 'playBars', args: ['12', '16'] },
    ]);
  });

  test('an unknown verb is reported, not silently dropped', () => {
    const { calls, errors } = parseCalls('playTag(1,5,8) frobnicate(2)', 3);
    expect(calls).toEqual([{ name: 'playTag', args: ['1,5,8'] }]);
    expect(errors).toEqual([{ line: 3, message: 'unknown command "frobnicate"' }]);
  });

  test('the wrong number of arguments is reported', () => {
    expect(parseCalls('playBars(12)', 2).errors).toEqual([{ line: 2, message: '"playBars" got 1 argument' }]);
    expect(parseCalls('full(1)', 2).errors).toEqual([{ line: 2, message: '"full" got 1 argument' }]);
  });

  test('a mistyped call that never became a call is reported', () => {
    const { errors } = parseCalls('playTag 1,5,8', 4);
    expect(errors[0].message).toMatch(/don’t understand/);
  });

  test('trailing commas between calls are tolerated', () => {
    expect(parseCalls('playTag(1,5,8b | 1,5,8),', 1).errors).toEqual([]);
  });
});

describe('parseScript', () => {
  const SCRIPT = [
    '# a lesson',
    '',
    'Notice this arpeggio   > playTag(1,5,8b | 1,5,8)',
    'Notice the melody      > playTagAll(1,2,3,2,1)',
    'Now combine them       > playTagAll(1,5,8b | 1,5,8 | 1,2,3,2,1)',
    'Just read this line.',
    '                       > full()',
  ].join('\n');

  test('one step per line, prose and commands split at the >', () => {
    const { steps, errors } = parseScript(SCRIPT);
    expect(errors).toEqual([]);
    expect(steps.map((s) => s.prose)).toEqual([
      'Notice this arpeggio', 'Notice the melody', 'Now combine them', 'Just read this line.', '',
    ]);
    expect(steps[0].actions).toEqual([{ name: 'playTag', args: ['1,5,8b', '1,5,8'] }]);
    expect(steps[2].actions[0].args).toEqual(['1,5,8b', '1,5,8', '1,2,3,2,1']);
  });

  test('a prose-only line is a step with nothing to do', () => {
    const { steps } = parseScript(SCRIPT);
    expect(steps[3]).toMatchObject({ prose: 'Just read this line.', actions: [], repeat: 1 });
  });

  test('a command-only line runs silently', () => {
    const { steps } = parseScript(SCRIPT);
    expect(steps[4]).toMatchObject({ prose: '', actions: [{ name: 'full', args: [] }] });
  });

  test('blank lines and # comments are skipped', () => {
    expect(parseScript('# just a note\n\n   \n').steps).toEqual([]);
  });

  test('repeat and tempo describe the step, wherever they sit on the line', () => {
    const { steps } = parseScript('Work the jump > tempo(60 | 100) repeat(4) playBars(12,16)');
    expect(steps[0]).toMatchObject({
      repeat: 4, tempoFrom: 60, tempoTo: 100,
      actions: [{ name: 'playBars', args: ['12', '16'] }],
    });
    const other = parseScript('Work it > playBars(12,16) repeat(3)').steps[0];
    expect(other).toMatchObject({ repeat: 3, actions: [{ name: 'playBars', args: ['12', '16'] }] });
  });

  // `inPhrase` scopes the whole line, so it is lifted off the action list the same way repeat/tempo
  // are — the runner shouldn't have to care that it was typed last.
  test('inPhrase is lifted onto the step, wherever it sits on the line', () => {
    const a = parseScript('Only in A > inPhrase(A) playTagAll(1,2,3,2,1)').steps[0];
    expect(a).toMatchObject({ phrase: 'A', actions: [{ name: 'playTagAll', args: ['1,2,3,2,1'] }] });
    const b = parseScript('Only in A > playTagAll(1,2,3,2,1) inPhrase(A) repeat(2)').steps[0];
    expect(b).toMatchObject({ phrase: 'A', repeat: 2, actions: [{ name: 'playTagAll', args: ['1,2,3,2,1'] }] });
  });

  test('no inPhrase means no scope', () => {
    expect(parseScript('x > playTagAll(a)').steps[0].phrase).toBeNull();
  });

  test('a line that is only inPhrase is still a step', () => {
    // It changes what the sheet shows, so it is something the runner must do — not an empty line.
    expect(parseScript('> inPhrase(A)').steps).toHaveLength(1);
  });

  test('a phrase name may contain commas, like a motif name', () => {
    expect(parseScript('x > inPhrase(theme, second half)').steps[0].phrase).toBe('theme, second half');
  });

  // gap describes the quiet AFTER a step, so it belongs to the step rather than being an action —
  // unlike wait, which pauses where it sits among the other commands.
  test('gap is lifted onto the step; wait stays an action', () => {
    const g = parseScript('x > playTag(a) gap(2.5)').steps[0];
    expect(g).toMatchObject({ gap: 2.5, actions: [{ name: 'playTag', args: ['a'] }] });
    const s = parseScript('x > playTag(a) wait(3) playTag(b)').steps[0];
    expect(s.gap).toBeNull();
    expect(s.actions.map((a) => a.name)).toEqual(['playTag', 'wait', 'playTag']);
  });

  test('no gap on the step means the panel decides', () => {
    expect(parseScript('x > playTag(a)').steps[0].gap).toBeNull();
  });

  test('gap(0) is a real answer, not a missing one', () => {
    expect(parseScript('x > playTag(a) gap(0)').steps[0].gap).toBe(0);
  });

  test('a bad gap is reported rather than guessed at', () => {
    expect(parseScript('x > gap(soon) playTag(a)').errors[0].message).toMatch(/gap needs a number of seconds/);
  });

  // inBars says outright what inPhrase says by name, so it is lifted onto the step the same way.
  test('inBars reads a dash range, a pipe pair, or a single bar', () => {
    expect(parseScript('x > inBars(9-16) playTagAll(a)').steps[0].measures).toEqual([9, 16]);
    expect(parseScript('x > inBars(9 | 16) playTagAll(a)').steps[0].measures).toEqual([9, 16]);
    expect(parseScript('x > inBars(12) playTagAll(a)').steps[0].measures).toEqual([12, 12]);
  });

  test('inBars puts a backwards range in order', () => {
    expect(parseScript('x > inBars(16-9) playTagAll(a)').steps[0].measures).toEqual([9, 16]);
  });

  test('no inBars means no bars', () => {
    expect(parseScript('x > playTagAll(a)').steps[0].measures).toBeNull();
  });

  test('a bad inBars is reported rather than guessed at', () => {
    expect(parseScript('x > inBars(soon) playTagAll(a)').errors[0].message).toMatch(/inBars needs bars like 9-16/);
  });

  test('a line that is only inBars is still a step', () => {
    expect(parseScript('> inBars(9-16)').steps).toHaveLength(1);
  });

  test('errors carry the line number and do not stop the rest parsing', () => {
    const { steps, errors } = parseScript('Good > playTag(a)\nBad  > nope(1)\nAlso good > full()');
    expect(steps).toHaveLength(3);
    expect(steps[2].actions).toEqual([{ name: 'full', args: [] }]);
    expect(errors).toEqual([{ line: 2, message: 'unknown command "nope"' }]);
  });

  test('a bad repeat / tempo value is reported rather than guessed at', () => {
    expect(parseScript('x > repeat(fast) playBars(1,2)').errors[0].message).toMatch(/repeat needs a whole number/);
    expect(parseScript('x > tempo(quick) playBars(1,2)').errors[0].message).toMatch(/tempo needs a number/);
  });

  test('empty / missing input is not an error', () => {
    expect(parseScript('')).toEqual({ steps: [], errors: [] });
    expect(parseScript(null)).toEqual({ steps: [], errors: [] });
  });

  test('every documented command parses at its stated arity', () => {
    const sample = {
      playTag: 'a', playTagAll: 'a', playPhrase: 'A', playBars: '1,2', playGroup: 'g',
      compare: 'a | b', show: '1,2', full: '', tempo: '60', repeat: '2', wait: '1',
      ask: '', originalView: '', inPhrase: 'A', playPhraseWith: 'a', gap: '2', inBars: '9-16',
    };
    Object.keys(COMMANDS).forEach((name) => {
      const { errors } = parseScript(`x > ${name}(${sample[name]})`);
      expect(errors).toEqual([]);
    });
  });
});

// `tempo(60 | 100) repeat(4)` is a practice loop that speeds up: four passes, evenly spaced from the
// first tempo to the last, ending exactly on the target rather than short of it.
describe('tempoForPass', () => {
  const ramp = parseScript('x > tempo(60 | 100) repeat(4) playBars(1,2)').steps[0];

  test('ramps evenly and lands on the target', () => {
    expect([0, 1, 2, 3].map((p) => tempoForPass(ramp, p))).toEqual([60, 73, 87, 100]);
  });

  test('a single tempo holds for every pass', () => {
    const flat = parseScript('x > tempo(72) repeat(3) playBars(1,2)').steps[0];
    expect([0, 1, 2].map((p) => tempoForPass(flat, p))).toEqual([72, 72, 72]);
  });

  test('a ramp with no repeats just uses the first value', () => {
    const once = parseScript('x > tempo(60 | 100) playBars(1,2)').steps[0];
    expect(tempoForPass(once, 0)).toBe(60);
  });

  test('no tempo on the step means leave the tempo alone', () => {
    expect(tempoForPass(parseScript('x > playBars(1,2)').steps[0], 0)).toBeNull();
    expect(tempoForPass(null, 0)).toBeNull();
  });

  test('a pass index outside the range is clamped, not extrapolated', () => {
    expect(tempoForPass(ramp, -5)).toBe(60);
    expect(tempoForPass(ramp, 99)).toBe(100);
  });
});

describe('describeStep', () => {
  test('reads as a plan before it runs', () => {
    const s = parseScript('Work the jump > tempo(60 | 100) repeat(4) playBars(12,16)').steps[0];
    expect(describeStep(s)).toBe('tempo 60→100 · playBars(12 | 16) · ×4');
  });

  test('a bar scope reads as part of the plan', () => {
    const s = parseScript('Just here > inBars(9-16) playTagAll(a)').steps[0];
    expect(describeStep(s)).toBe('in m9–16 · playTagAll(a)');
  });

  test('the phrase scope reads as part of the plan', () => {
    const s = parseScript('Only in A > inPhrase(A) playTagAll(1,2,3,2,1)').steps[0];
    expect(describeStep(s)).toBe('in A · playTagAll(1,2,3,2,1)');
  });

  test('prose-only steps describe nothing', () => {
    expect(describeStep(parseScript('Just read this.').steps[0])).toBe('');
  });
});

describe('renameTagInScript', () => {
  test('rewrites the motif in every command that names one, counting the lines', () => {
    const src = 'Notice it > playTag(1,5,8)\nAnd again  > playTagAll(1,5,8 | 1,3,5)\nIn place   > inPhrase(A) playPhraseWith(1,5,8)';
    const { text, lines } = renameTagInScript(src, '1,5,8', 'arpeggio');
    expect(lines).toBe(3);
    expect(text).toBe('Notice it > playTag(arpeggio)\nAnd again  > playTagAll(arpeggio | 1,3,5)\nIn place   > inPhrase(A) playPhraseWith(arpeggio)');
  });

  test('only a WHOLE argument is replaced — "1,5,8b" is a different motif', () => {
    const { text, lines } = renameTagInScript('x > playTagAll(1,5,8b | 1,5,8)', '1,5,8', 'up');
    expect(text).toBe('x > playTagAll(1,5,8b | up)');
    expect(lines).toBe(1);
  });

  test('leaves prose, other commands and unrelated lines untouched', () => {
    const src = 'Play 1,5,8 slowly > playBars(1,4)\nplain prose about 1,5,8\n# 1,5,8 comment';
    expect(renameTagInScript(src, '1,5,8', 'up')).toEqual({ text: src, lines: 0 });
  });

  test('a blank or unchanged name is a no-op', () => {
    const src = 'x > playTag(1,5,8)';
    expect(renameTagInScript(src, '1,5,8', '  ').lines).toBe(0);
    expect(renameTagInScript(src, '1,5,8', '1,5,8').lines).toBe(0);
  });
});

// playPhrase carries the phrase it plays, so a scope on the same line can only name a SECOND place —
// and the line then shades one and sounds the other. Caught while it is written, not mid-run.
describe('a scope and playPhrase do not mix', () => {
  test('inPhrase alongside playPhrase is reported, and the scope is the half that goes', () => {
    const res = parseScript('Hear it > inPhrase(A) playPhrase(B)');
    expect(res.errors).toEqual([{ line: 1,
      message: 'inPhrase(A) and playPhrase(B) name two different places — say the phrase once' }]);
    // The verb survives: a line that says "play B" must play B, not fall quiet over a contradiction.
    expect(res.steps[0].actions.map((c) => c.name)).toEqual(['playPhrase']);
    expect(res.steps[0].phrase).toBeNull();
  });

  test('saying the same phrase twice is still reported — but as the redundancy it is', () => {
    const res = parseScript('Hear it > inPhrase(B2) playPhrase(B2)');
    expect(res.errors[0].message).toBe('inPhrase(B2) says the same thing as playPhrase(B2) — drop the inPhrase');
    expect(res.steps[0].phrase).toBeNull();
  });

  test('inBars alongside playPhrase points at playBars, which is what it meant', () => {
    const res = parseScript('Hear it > inBars(9-16) playPhrase(A)');
    expect(res.errors[0].message)
      .toBe('inBars(9-16) and playPhrase(A) name two different places — use playBars(9,16) for the bars');
    expect(res.steps[0].measures).toBeNull();
  });

  test('a scope with the motif verbs is untouched — that is what it is for', () => {
    const res = parseScript('Look > inPhrase(B) playTagAll(x)\nAlso > inBars(9-16) playTag(x)');
    expect(res.errors).toEqual([]);
    expect(res.steps[0].phrase).toBe('B');
    expect(res.steps[1].measures).toEqual([9, 16]);
  });

  test('playPhrase on its own is fine, and so is a bare scope', () => {
    expect(parseScript('Hear it > playPhrase(B2)').errors).toEqual([]);
    expect(parseScript('Look > inPhrase(B)').errors).toEqual([]);
  });
});

describe('renamePhraseInScript', () => {
  test('rewrites the phrase in the commands that name one', () => {
    const src = 'Look   > inPhrase(A) playTagAll(x)\nHear it > playPhrase(A)\nBoth    > compare(A | B)';
    const { text, lines } = renamePhraseInScript(src, 'A', 'Chorus');
    expect(lines).toBe(3);
    expect(text).toBe('Look   > inPhrase(Chorus) playTagAll(x)\nHear it > playPhrase(Chorus)\nBoth    > compare(Chorus | B)');
  });

  test('playPhraseWith is left alone — its arguments are motifs, not the phrase', () => {
    // The phrase on that line comes from inPhrase; rewriting playPhraseWith would rename a motif.
    const src = 'x > inPhrase(A) playPhraseWith(A)';
    expect(renamePhraseInScript(src, 'A', 'Chorus').text).toBe('x > inPhrase(Chorus) playPhraseWith(A)');
  });

  test('a motif of the same name in a motif-only command is not touched', () => {
    expect(renamePhraseInScript('x > playTag(A)', 'A', 'Chorus')).toEqual({ text: 'x > playTag(A)', lines: 0 });
  });
});

describe('renamed spellings still parse', () => {
  test('inMeasures is read as inBars, so a script saved before the rename keeps running', () => {
    const res = parseScript('x > inMeasures(9-16) playTagAll(a)');
    expect(res.errors).toEqual([]);
    expect(res.steps[0].measures).toEqual([9, 16]);
  });

  test('the old name is not offered in the command list', () => {
    expect(Object.keys(COMMANDS)).toContain('inBars');
    expect(Object.keys(COMMANDS)).not.toContain('inMeasures');
  });
});

describe('markup in the words', () => {
  test('a > inside a tag does not end the prose', () => {
    const s = parseScript('Play <b>softly</b> > playBars(12,16)').steps[0];
    expect(s.prose).toBe('Play <b>softly</b>');
    expect(s.actions).toEqual([{ name: 'playBars', args: ['12', '16'] }]);
  });

  test('prose-only markup stays prose, with no phantom command half', () => {
    const s = parseScript('Just <i>listen</i>').steps[0];
    expect(s.prose).toBe('Just <i>listen</i>');
    expect(s.actions).toEqual([]);
  });

  test('a styled span survives — its quotes and colons are not separators', () => {
    const s = parseScript('go <span style="color:#c00">loud</span> > wait(2)').steps[0];
    expect(s.prose).toBe('go <span style="color:#c00">loud</span>');
    expect(s.actions[0].name).toBe('wait');
  });

  test('proseCut: plain text, tags, a bare < and an unclosed tag', () => {
    expect(proseCut('words > cmd()')).toBe(6);
    expect(proseCut('no commands here')).toBe(-1);
    expect(proseCut('a < b > cmd()')).toBe(6);            // a bare < is text, not a tag
    expect(proseCut('<b>x</b> > cmd()')).toBe(9);
    expect(proseCut('half a <b tag with no close')).toBe(-1);
  });

  test('renameTagInScript splits the same way, so markup lines still get rewritten', () => {
    const { text, lines } = renameTagInScript('Hear <b>this</b> > playTag(1,5,8)', '1,5,8', 'up');
    expect(text).toBe('Hear <b>this</b> > playTag(up)');
    expect(lines).toBe(1);
  });
});

// The builder writes lines back out, so the two directions have to agree — a menu that produces text the
// parser reads differently is worse than typing it by hand.
describe('formatCall / formatLine', () => {
  test('inBars gets a DASH, because inBars(9,16) parses as bar 9 alone', () => {
    expect(formatCall('inBars', ['9', '16'])).toBe('inBars(9-16)');
    expect(parseScript('> inBars(9-16)').steps[0].measures).toEqual([9, 16]);
    // The trap this avoids, pinned so it stays visible:
    expect(parseScript('> inBars(9,16)').steps[0].measures).toEqual([9, 9]);
  });

  test('numeric commands join with a comma, name commands with a pipe', () => {
    expect(formatCall('playBars', ['12', '16'])).toBe('playBars(12,16)');
    expect(formatCall('playTagAll', ['1,5,8b', '1,2,3,2,1'])).toBe('playTagAll(1,5,8b | 1,2,3,2,1)');
    // and a motif name's own commas survive the round trip
    expect(parseCalls(formatCall('playTagAll', ['1,5,8b', '1,2,3,2,1']), 1).calls[0].args)
      .toEqual(['1,5,8b', '1,2,3,2,1']);
  });

  test('blank arguments are dropped, so a half-filled control writes ask() not ask( )', () => {
    expect(formatCall('ask', [''])).toBe('ask()');
    expect(formatCall('tempo', ['60', ''])).toBe('tempo(60)');
    expect(formatCall('full', [])).toBe('full()');
  });

  test('a whole line round-trips through the parser', () => {
    const line = formatLine('Work the jump', [
      { name: 'tempo', args: ['60', '100'] },
      { name: 'repeat', args: ['4'] },
      { name: 'playBars', args: ['12', '16'] },
    ]);
    expect(line).toBe('Work the jump > tempo(60,100) repeat(4) playBars(12,16)');
    const s = parseScript(line).steps[0];
    expect([s.prose, s.tempoFrom, s.tempoTo, s.repeat]).toEqual(['Work the jump', 60, 100, 4]);
    expect(s.actions).toEqual([{ name: 'playBars', args: ['12', '16'] }]);
  });

  test('commands with no words, and words with no commands', () => {
    expect(formatLine('', [{ name: 'full', args: [] }])).toBe('> full()');
    expect(parseScript('> full()').steps[0].actions[0].name).toBe('full');
    expect(formatLine('Just saying', [])).toBe('Just saying');
  });

  test('the > is held at its old column, so editing one argument keeps a script aligned', () => {
    expect(formatLine('Hear it', [{ name: 'wait', args: ['2'] }], { column: 20 }))
      .toBe('Hear it             > wait(2)');
    // never truncates: prose longer than the column just gets its single space
    expect(formatLine('Hear it', [{ name: 'wait', args: ['2'] }], { column: 3 })).toBe('Hear it > wait(2)');
  });

  test('markup in the words survives being written back', () => {
    const line = formatLine('Play <b>softly</b>', [{ name: 'wait', args: ['3'] }]);
    expect(parseScript(line).steps[0].prose).toBe('Play <b>softly</b>');
  });

  test('every command the panel offers has argument slots for its arity', () => {
    Object.entries(COMMANDS).forEach(([name, spec]) => {
      const ui = ARG_UI[name];
      expect(ui).toBeDefined();
      const most = { '0': 0, '1': 1, '2': 2, '0-1': 1, '1-2': 2, '1+': 1, '2+': 1 }[spec.args];
      expect(ui.labels.length).toBeGreaterThanOrEqual(most);
      if (spec.args.endsWith('+')) expect(ui.variadic).toBe(true);
    });
  });
});
