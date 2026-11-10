import { supportedPracticeSpeed } from './practice-speed.js';
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'language.js'), 'utf8');
const functionCode = name => source.match(new RegExp('function ' + name + '\\([^]*?\\n\\}'))[0];

test('saved Speed drives successive audio items and uses the closest supported video rate', () => {
  const window = { _appSettings: { playbackSpeed: 1.2, recAudioPlaybackRate: 0.75 },
    ytPlayer: { getAvailablePlaybackRates: () => [0.5, 0.75, 1, 1.25, 1.5, 2] } };
  const context = { window, Number, supportedPracticeSpeed, _recAudioAppliedRates: new WeakMap() };
  vm.createContext(context);
  vm.runInContext(['_preferredRecordingAudioRate', '_recordingVideoRate', '_applyRecordingAudioRate']
    .map(functionCode).join('\n'), context);
  const first = {}, next = {};
  context._applyRecordingAudioRate(first);
  context._applyRecordingAudioRate(next);
  expect(first.playbackRate).toBe(1.2);
  expect(next.playbackRate).toBe(1.2);
  expect(context._recordingVideoRate()).toBe(1.25);
});

test('minimize pauses Practice speech and restore resumes the same task', () => {
  const card = { manual: true, source: 'First\nSecond' };
  const speech = { pause: jest.fn(), resume: jest.fn() };
  const chain = { addClass() { return this; }, removeClass() { return this; }, click() {} };
  const context = { window: { _practiceActive: true, _practiceCards: [card], _practiceIdx: 0 },
    _practiceTts: speech, $: () => chain, hideMediaRelatedContainer() {},
    _stopPracticeAudio() {}, _stopManualAudioPreview() {}, spotifyClips: () => [],
    _newPracticeVideoRequest: jest.fn(), _practiceVideoCues: { releaseMute() {} },
    _updatePracticeRestoreCount() {}, _coverOpenDialogsForStudy() {}, _pracRec: null,
  };
  vm.createContext(context);
  vm.runInContext(['minimizePracticeMode', 'restorePracticeMode'].map(functionCode).join('\n'), context);
  context.minimizePracticeMode();
  expect(speech.pause).toHaveBeenCalledTimes(1);
  expect(context._newPracticeVideoRequest).toHaveBeenCalledWith({ keepSpotify: false, keepTts: true });
  context.restorePracticeMode();
  expect(speech.resume).toHaveBeenCalledTimes(1);
  expect(context._practiceTts).toBe(speech);
});
