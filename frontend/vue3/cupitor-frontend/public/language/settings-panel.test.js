import { ensurePlaybackControls, organizeSettingsPanel } from './settings-panel.js';
const fs = require('fs');
const path = require('path');
const $ = require('jquery');
const html = fs.readFileSync(path.join(__dirname, '../language.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8');
const ids = ['playbackSpeed', 'ttsReplacements', 'ttsNewlinePauseMs'];
function oldPanel() {
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').getElementById('settingsPanel').outerHTML;
  const panel = document.getElementById('settingsPanel');
  ids.forEach(id => panel.querySelector('#' + id).closest('label').remove());
  return panel;
}
afterEach(() => { document.body.innerHTML = ''; delete window._appSettings; });

test('the older Playback layout gains all missing controls with saved values', () => {
  const panel = oldPanel();
  window._appSettings = { playbackSpeed: 1.25, ttsNewlinePauseMs: 1200, ttsReplacements: [{from:'->',to:'means'}] };
  organizeSettingsPanel(panel);
  panel.querySelector('[data-settings-section="playback"]').click();
  const playback = panel.querySelector('#settings-section-playback');
  expect(playback.hidden).toBe(false);
  ids.forEach(id => expect(playback.querySelector('#' + id)).not.toBeNull());
  expect(playback.querySelector('#playbackSpeed').value).toBe('1.25');
  expect(playback.querySelector('#ttsReplacements').value).toBe('->=means');
  expect(playback.querySelector('#ttsNewlinePauseMs').value).toBe('1200');
  organizeSettingsPanel(panel);
  ids.forEach(id => expect(panel.querySelectorAll('#' + id).length).toBe(1));
});

test('the current HTML keeps its original controls and values', () => {
  const panel = oldPanel();
  ensurePlaybackControls(panel);
  const input = panel.querySelector('#ttsNewlinePauseMs');
  input.value = 900;
  ensurePlaybackControls(panel);
  expect(panel.querySelector('#ttsNewlinePauseMs')).toBe(input);
  expect(input.value).toBe('900');
});

test('recovered TTS inputs bind to the real preference handlers and persist edits', () => {
  const panel = oldPanel();
  ensurePlaybackControls(panel);
  window._appSettings = {};
  const save = jest.fn();
  const handlers = source.slice(source.indexOf("  $('#ttsReplacements').on('change'"),
    source.indexOf("  $('#recManualPlaybackMode').on('change'"));
  new Function('$', 'window', 'saveAppSettings', handlers)($, window, save);
  $('#ttsReplacements').val('->=could be\n/=or').trigger('change');
  $('#ttsNewlinePauseMs').val('1400').trigger('change');
  expect(window._appSettings.ttsReplacements).toEqual([{from:'->',to:'could be'}, {from:'/',to:'or'}]);
  expect(window._appSettings.ttsNewlinePauseMs).toBe(1400);
  expect(save).toHaveBeenCalledTimes(2);
});
