import { cardCanUseTts, cardTtsText, ttsFaceSequence, speakTts } from './card-tts.js';

test('TTS is opt-in only for manual cards with no saved/linked media', () => {
  const item = {manual:true, source:'Hej världen', target:'Hello world'};
  expect(cardCanUseTts(item)).toBe(false);
  expect(cardCanUseTts(item, {enabled:true})).toBe(true);
  expect(cardCanUseTts(item, {enabled:true,hasLinked:true})).toBe(false);
  expect(cardCanUseTts(item, {enabled:true,canSpeak:false})).toBe(false);
  expect(cardCanUseTts({...item, sourceAudioUrl:'file:///hello.wav'}, {enabled:true})).toBe(false);
  expect(cardCanUseTts({...item, targetAudioUrl:'file:///hello.wav'}, {enabled:true})).toBe(false);
  expect(cardCanUseTts({...item, mediaUrl:'file:///legacy.wav'}, {enabled:true})).toBe(false);
  expect(cardCanUseTts({...item, source:'',target:''}, {enabled:true})).toBe(false);
  expect(cardCanUseTts({...item,manual:false}, {enabled:true})).toBe(false);
});

test('speaks text rather than HTML with the requested face order', () => {
  const faces = [
    {key:'target',label:'Target',text:'<p>Hello <strong>world</strong> &amp; friends</p>',url:null},
    {key:'source',label:'Source',text:'Hej',url:null},
  ];
  expect(cardTtsText(faces[0].text)).toBe('Hello world & friends');
  expect(ttsFaceSequence(faces, {enabled:false})).toEqual([]);
  const seq = ttsFaceSequence(faces, {enabled:true});
  expect(seq.map(x=>x.key)).toEqual(['target','source']);
  expect(seq[0].text).toBe('Hello world & friends');
  expect(seq.every(x=>x.tts)).toBe(true);
});

test('speech resolves on completion and can be interrupted on navigation', async () => {
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const synth = {
    cancel: jest.fn(),
    speak: jest.fn(u => { spoken.push(u); queueMicrotask(() => u.onend?.()) }),
  };
  const handle = speakTts('Hej', {
    synth, Utterance, lang:'sv-SE',
    onBegin: () => {},
  });
  await expect(handle.promise).resolves.toBe(true);
  expect(spoken[0].lang).toBe('sv-SE');
  let started;
  const stalled = speakTts('Another sentence', {
    synth: {cancel: () => {started = 'cancelled'}, speak:()=>{}},
    Utterance,
  });
  stalled.cancel();
  await expect(stalled.promise).resolves.toBe(true);
  expect(started).toBe('cancelled');
});

test('replaces symbols literally and preserves HTML line breaks for timed silence', async () => {
  jest.useFakeTimers();
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const task = speakTts('<p>A -&gt; B</p><p>C → D</p>', {
    synth: { speak: u => spoken.push(u), cancel() {} }, Utterance,
    replacements: [{ from: '->', to: 'could be' }, { from: '→', to: 'means' }], newlinePauseMs: 900,
  });
  expect(spoken[0].text).toBe('A could be B');
  spoken[0].onend();
  jest.advanceTimersByTime(899);
  expect(spoken).toHaveLength(1);
  jest.advanceTimersByTime(1);
  expect(spoken[1].text).toBe('C means D');
  spoken[1].onend();
  await task.promise;
  jest.useRealTimers();
});

test('restoring after a long pause restarts only the unfinished line, even without engine resume', async () => {
  jest.useFakeTimers();
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const synth = { speak: u => spoken.push(u), cancel: jest.fn() };
  const task = speakTts('First\nSecond', { synth, Utterance, newlinePauseMs: 500 });
  spoken[0].onend();
  jest.advanceTimersByTime(500);
  expect(spoken[1].text).toBe('Second');
  task.pause();
  jest.advanceTimersByTime(200000);
  expect(spoken).toHaveLength(2);
  task.resume();
  expect(spoken.map(u => u.text)).toEqual(['First', 'Second', 'Second']);
  spoken[2].onend();
  await task.promise;
  jest.useRealTimers();
});

test('a paused newline gap resumes its remaining silence and cancellation stops it', async () => {
  jest.useFakeTimers();
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const task = speakTts('First\nSecond', {
    synth: { speak: u => spoken.push(u), cancel() {} }, Utterance, newlinePauseMs: 1000,
  });
  spoken[0].onend();
  jest.advanceTimersByTime(400);
  task.pause();
  jest.advanceTimersByTime(5000);
  task.resume();
  jest.advanceTimersByTime(599);
  expect(spoken).toHaveLength(1);
  task.cancel();
  jest.advanceTimersByTime(2000);
  expect(spoken).toHaveLength(1);
  await task.promise;
  jest.useRealTimers();
});
