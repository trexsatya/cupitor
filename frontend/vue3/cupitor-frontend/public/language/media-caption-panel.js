// One subtitle view for native local media and the YouTube IFrame adapter.
// The injected page bundle consumes this same caption-sidebar.js source.
import './caption-sidebar.js';
import { srtToJson } from './srt-parser.js';

export function createMediaCaptionPanel({onOpenSubtitles, onClearCues, onWord, onCapture, translateText, onSplitChange}) {
  const ui = window.__cupShared.createSubtitleUI({
    bodyClass: 'cup-local-sub-split',
    shrinkSelectors: [],
    onOpenSubtitles, onClearCues, onWord, onCapture, translateText, onSplitChange,
  });
  function open(media, youtube = false) {
    ui.buildSidebar();
    ui.element.id = youtube ? 'youtubeCaptionPanel' : 'localCaptionPanel';
    ui.element.querySelector('[data-act=split]').classList.add('cup-on');
    ui.element.querySelector('[data-act=open-srt]').style.display = youtube ? 'none' : '';
    ui.setVideoElement(media);
    ui.setSplit(true);
    {
      let saved;
      try { saved = localStorage.getItem('cupSubVidH'); } catch (_) {}
      if (!(parseFloat(saved) > 0)) {
        document.body.style.setProperty('--cup-vid-h', media?.tagName === 'AUDIO' ? '180px' : '50vh');
        window.dispatchEvent(new Event('resize'));
      }
    }
    const bar = document.getElementById('localSpeakOverBar');
    if (bar) { bar.style.display = youtube ? 'none' : bar.style.display; ui.element.insertBefore(bar, ui.element.querySelector('.cup-sub-list')); }
  }
  function load(sv, en, language) {
    const translations = srtToJson(en || '');
    const cues = srtToJson(sv || '').map(cue => {
      const translation = translations.find(t => t.start.ordinal === cue.start.ordinal);
      return {start:cue.start.ordinal, end:cue.end.ordinal, text:cue.text.trim(),
        ...(translation && en !== sv ? {translation:translation.text.trim()} : {})};
    });
    ui.replaceCues(cues, language);
    ui.showNotice(cues.length ? '' : (ui.element.id === 'youtubeCaptionPanel'
      ? 'No subtitles available for this video.'
      : 'Open an SRT file to see subtitles. Select lines with ☑ and send them with ⤴.'));
    return cues.length;
  }
  function close() { ui.setSplit(false); ui.setVideoElement(null); }
  return {open, load, close};
}
