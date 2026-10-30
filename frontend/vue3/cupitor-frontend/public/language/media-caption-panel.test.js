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
