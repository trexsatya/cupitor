import { orderedRecordingEntries } from './recordings-order.js';
import { cardHtml } from './card-html.js';
const fs = require('node:fs');
const vm = require('node:vm');
const $ = require('jquery');
const source = fs.readFileSync(require('node:path').join(__dirname, 'language.js'), 'utf8');

test('opening a manual search result leaves the existing minimized Practice session intact', () => {
  const code = source.slice(source.indexOf("$(document).on('click', '#manualResults .manual-hit'"),
    source.indexOf('// Fold the block. Sticky across searches'));
  const queue = [{ id: 'original', source: 'Keep this session' }];
  const state = { _recordings: { Deck: { items: { Manual: { Card: [
    { id: 'result', source: '<b>Hello</b>', target: 'Hej' },
  ] } } } }, _practiceCards: queue, _practiceIdx: 0, _practiceMinimized: true, innerWidth: 1000, innerHeight: 800 };
  let options;
  $.fn.dialog = function (value) { options = value; return this; };
  vm.runInNewContext(code, { $, document, window: state, MANUAL_ST: 'Manual', MANUAL_W: 'Card', _cardHtml: cardHtml, orderedRecordingEntries });
  document.body.innerHTML = '<div id="manualResults"><button class="manual-hit" data-playlist="Deck" data-id="result"></button></div>';
  $('#manualResults .manual-hit').trigger('click');
  expect(state._practiceCards).toBe(queue);
  expect(state._practiceMinimized).toBe(true);
  expect(state._practiceIdx).toBe(0);
  expect($('.manual-result-preview').text()).toContain('Hello');
  expect($('.manual-result-preview').text()).toContain('Hej');
  expect(options.title).toBe('Deck · #1');
  $(document).off('click', '#manualResults .manual-hit');
  document.body.innerHTML = '';
});
