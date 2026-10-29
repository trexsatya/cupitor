// Use the main WebView's subtitle component for local media too.
// caption-sidebar.js is mirrored verbatim from the publishing repository's
// db/js/src/20-caption-sidebar.js; see docs/local-media-subtitles.md.
import './caption-sidebar.js';
import { srtToJson } from './srt-parser.js';

export function createLocalCaptionPanel({onOpenSubtitles, onClearCues, onWord, onCapture, translateText}) {
  const ui = window.__cupShared.createSubtitleUI({
    bodyClass: 'cup-local-sub-split',
    shrinkSelectors: [],
    onOpenSubtitles, onClearCues, onWord, onCapture, translateText,
  });
  let lastMedia = null;
  function open(media) {
    ui.buildSidebar();
    ui.element.id = 'localCaptionPanel';
    ui.setVideoElement(media);
    ui.setSplit(true);
    if (lastMedia !== media) {
      lastMedia = media;
      let saved;
      try { saved = localStorage.getItem('cupSubVidH'); } catch (_) {}
      if (!saved) {
        document.body.style.setProperty('--cup-vid-h', media?.tagName === 'AUDIO' ? '180px' : '50vh');
        window.dispatchEvent(new Event('resize'));
      }
    }
    const bar = document.getElementById('localSpeakOverBar');
    if (bar) ui.element.insertBefore(bar, ui.element.querySelector('.cup-sub-list'));
  }
  function load(sv, en, language) {
    const translations = srtToJson(en || '');
    const cues = srtToJson(sv || '').map(cue => {
      const translation = translations.find(t => t.start.ordinal === cue.start.ordinal);
      return {start:cue.start.ordinal, end:cue.end.ordinal, text:cue.text.trim(),
        ...(translation && en !== sv ? {translation:translation.text.trim()} : {})};
    });
    ui.replaceCues(cues, language);
    ui.showNotice(cues.length ? '' : 'Open an SRT file to see subtitles. Select lines with ☑ and send them with ⤴.');
    return cues.length;
  }
  function close() { ui.setSplit(false); ui.setVideoElement(null); }
  return {open, load, close};
}
