import {createMediaCaptionPanel} from './media-caption-panel';

const srt = '1\n00:00:00,000 --> 00:00:02,000\nEn mening\n\n2\n00:00:03,250 --> 00:00:06,750\nSista meningen\n';

test('the shared panel keeps the webapp translation callback and sends exact selected cue bounds', async () => {
  document.body.innerHTML = '<audio></audio><div id="localSpeakOverBar"></div>';
  const native = document.querySelector('audio');
  const bridgeReply = jest.fn();
  window.__cupTranslated = bridgeReply;
  const onCapture = jest.fn(), onWord = jest.fn(), onOpenSubtitles = jest.fn();
  const translateText = jest.fn(() => Promise.resolve('A sentence'));
  const panel = createMediaCaptionPanel({onCapture,onWord,onOpenSubtitles,translateText});
  panel.open(native);
  panel.load(srt, '', 'sv');
  const root = document.getElementById('localCaptionPanel');
  expect(root.querySelectorAll('.cup-sub-cue')).toHaveLength(2);
  root.querySelector('[data-act=open-srt]').click();
  expect(onOpenSubtitles).toHaveBeenCalledTimes(1);
  root.querySelector('.cup-w').click();
  expect(onWord).toHaveBeenCalledWith('En');
  root.querySelector('[data-act=pick]').click();
  root.querySelector('[data-act=all]').click();
  root.querySelector('[data-act=send]').click();
  expect(onCapture.mock.calls[0][0].lines[1]).toMatchObject({start:3.25,end:6.75,text:'Sista meningen'});
  root.querySelector('[data-act=translate]').click();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(translateText).toHaveBeenCalledWith('En mening','sv','en');
  expect(window.__cupTranslated).toBe(bridgeReply);
  panel.close();
  expect(document.body.classList.contains('cup-local-sub-split')).toBe(false);
});

test('the media panel shows Hindi first and labels the English fallback for each cue', () => {
  document.body.innerHTML = '<audio></audio>';
  const panel = createMediaCaptionPanel({});
  panel.open(document.querySelector('audio'));
  const english = srt.replace('En mening', 'One sentence').replace('Sista meningen', 'The last sentence');
  const preferred = { language: 'hi', cues: [
    { index: 99, start: {ordinal: 0.1}, end: {ordinal: 2}, text: 'एक वाक्य' },
    { index: 2, start: {ordinal: 3.25}, end: {ordinal: 6.75}, text: ' ' },
  ] };
  const translations = () => Array.from(document.querySelectorAll('#localCaptionPanel .cup-sub-tr'))
    .map(line => [line.textContent, line.lang, line.dataset.subtitleLanguage]);
  panel.load(srt, english, 'sv', preferred);
  expect(translations()).toEqual([['एक वाक्य', 'hi', 'HI'], ['The last sentence', 'en', 'EN']]);
  panel.load(srt, english, 'sv', { language: 'hi', cues: [] });
  expect(translations()).toEqual([['One sentence', 'en', 'EN'], ['The last sentence', 'en', 'EN']]);
  panel.load(srt, '', 'sv', preferred);
  expect(translations()).toEqual([['एक वाक्य', 'hi', 'HI']]);
  panel.close();
});

test('the subtitle Translate action defaults to the familiar language', async () => {
  document.body.innerHTML = '<audio></audio>';
  localStorage.removeItem('cupSubPrefs');
  const translateText = jest.fn(async () => 'एक वाक्य');
  const panel = createMediaCaptionPanel({translateText, familiarLanguage: () => 'hi'});
  panel.open(document.querySelector('audio'));
  panel.load(srt, '', 'sv');
  document.querySelector('#localCaptionPanel [data-act=translate]').click();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(translateText).toHaveBeenCalledWith('En mening', 'sv', 'hi');
  panel.close();
});
