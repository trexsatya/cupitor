import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const selectionSource = read('./card-selection-search.js').replace(/^export /gm, '');
const chromeSource = read('./study-chrome.js').replace(/^import .*;\n/, '').replace(/export /g, '');
const css = read('../language.css');
const runtimeRequire = createRequire(require.resolve(process.env.CUPITOR_JSDOM || 'jsdom'));
const {parse} = runtimeRequire('@babel/parser');
const app = read('./language.js');
const navigation = parse(app, {sourceType: 'module'}).program.body.find(node =>
  node.type === 'FunctionDeclaration' && node.id.name === 'practiceNav');

function boot(mode = 'player') {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div id="mediaContainer"></div>
    <p id="outside">Outside text</p>
    <div id="recPlayingSubs"><div class="rec-ps-main">Selected <mark>card</mark> text</div></div>
    <div id="recPlayingTransport"><button id="recPlayingSearchBtn" aria-label="Search this word" title="Original search">Search</button></div>
    <div id="practiceMode"><div class="practice-topbar"><button class="practice-search" aria-label="Search this word" title="Original search">Search</button></div>
      <div class="practice-card"><div class="practice-front">Selected <mark>card</mark> text</div></div>
      <div class="practice-nav"><button class="practice-prev">Previous</button><button class="practice-unflip" aria-label="Flip card">Flip</button><button class="practice-next">Next</button></div>
    </div>
  </body></html>`, {runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom, doc = window.document;
  const observers = [], errors = [];
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {super(callback); observers.push(this);}
  };
  window.addEventListener('error', event => errors.push(event.error));
  doc.body.classList.add(mode === 'practice' ? 'practice-mode' : 'rec-playing');
  const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
  let now = 0, serial = 0;
  const timers = new Map();
  window.Date.now = () => now;
  window.setTimeout = (fn, ms) => {const id = ++serial; timers.set(id, {fn, due: now + ms}); return id;};
  window.clearTimeout = id => timers.delete(id);
  const advance = ms => {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, job]) => job.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  };
  window.eval(selectionSource + '\n' + chromeSource + '\nwindow.testChrome = installStudyChrome();');
  const root = doc.querySelector(mode === 'practice' ? '.practice-card' : '#recPlayingSubs');
  const button = doc.querySelector(mode === 'practice' ? '.practice-search' : '#recPlayingSearchBtn');
  const fireSelection = () => doc.dispatchEvent(new window.Event('selectionchange'));
  function select(node = root, text = true) {
    const range = doc.createRange(); range.selectNodeContents(node);
    if (!text) range.collapse(true);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); fireSelection();
  }
  const clear = () => {window.getSelection().removeAllRanges(); fireSelection();};
  const flush = async () => {await Promise.resolve(); await Promise.resolve();};
  return {window, doc, root, button, advance, select, clear, fireSelection, flush, close() {
    observers.forEach(observer => observer.disconnect());
    window.close();
    assert.deepEqual(errors, [], 'no uncaught UI errors');
  }};
}

for (const mode of ['player', 'practice']) {
  test(`${mode}: selected card text reveals and highlights Search until selection is cleared`, async () => {
    const p = boot(mode);
    try {
      p.advance(3100);
      assert.equal(p.doc.body.classList.contains('study-controls-hidden'), true);
      p.select(); await p.flush();
      assert.equal(p.doc.body.classList.contains('study-controls-hidden'), false);
      assert.equal(p.button.classList.contains('study-selection-search'), true);
      assert.equal(p.button.getAttribute('aria-label'), 'Search selected text');
      assert.equal(p.window.getComputedStyle(p.button).backgroundColor, 'rgb(255, 213, 79)');
      p.advance(12000);
      assert.equal(p.window.testChrome.isVisible(), true, 'selection blocks idle hiding');
      p.clear(); await p.flush();
      assert.equal(p.button.classList.contains('study-selection-search'), false);
      assert.equal(p.button.getAttribute('aria-label'), 'Search this word');
      assert.equal(p.button.title, 'Original search');
      p.advance(3100);
      assert.equal(p.window.testChrome.isVisible(), false, 'idle hiding resumes after deselection');
    } finally {p.close();}
  });

  test(`${mode}: a mouse or touch pointer press preserves the selected search text`, () => {
    const p = boot(mode);
    try {
      p.select();
      for (const type of ['pointerdown', 'mousedown']) {
        const event = new p.window.MouseEvent(type, {button: 0, bubbles: true, cancelable: true});
        p.button.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true, type + ' keeps selection instead of focusing the button');
      }
      let searched;
      p.button.addEventListener('click', () => {searched = p.window.getSelection().toString();});
      p.button.click();
      assert.equal(searched, 'Selected card text');
    } finally {p.close();}
  });

  test(`${mode}: dragging only reveals Search for the selection left after the gesture`, async () => {
    const p = boot(mode);
    try {
      p.advance(3100);
      const pointer = type => p.root.dispatchEvent(new p.window.MouseEvent(type, {button: 0, bubbles: true, clientX: type === 'pointerdown' ? 200 : 100}));
      pointer('pointerdown');
      pointer('pointermove');
      p.select(); await p.flush();
      assert.equal(p.window.testChrome.isVisible(), false, 'transient drag selections do not wake controls');
      p.root.replaceChildren(p.doc.createTextNode('Next card')); await p.flush();
      pointer('pointerup');
      assert.equal(p.window.testChrome.isVisible(), false, 'a navigation gesture leaves controls hidden');
      pointer('pointerdown'); p.select(); pointer('pointerup');
      assert.equal(p.window.testChrome.isVisible(), true, 'completed text selection reveals Search');
      assert.equal(p.button.classList.contains('study-selection-search'), true);
    } finally {p.close();}
  });

  test(`${mode}: collapsed, whitespace and out-of-card selections do not reveal Search`, async () => {
    const p = boot(mode);
    try {
      p.advance(3100);
      p.select(p.root, false); p.select(p.doc.getElementById('outside'));
      const blank = p.doc.createElement('span'); blank.textContent = '  '; p.root.append(blank);
      p.select(blank); await p.flush();
      assert.equal(p.button.classList.contains('study-selection-search'), false);
      assert.equal(p.window.testChrome.isVisible(), false);
      // Playback changes text regularly. Such DOM updates must not wake controls.
      p.root.append(p.doc.createTextNode(' updated playback text')); await p.flush();
      assert.equal(p.window.testChrome.isVisible(), false);
    } finally {p.close();}
  });

  test(`${mode}: leaving the view or replacing its card clears the selection highlight`, async () => {
    const p = boot(mode);
    try {
      p.select();
      p.root.replaceChildren(p.doc.createTextNode('Next card')); await p.flush();
      assert.equal(p.button.classList.contains('study-selection-search'), false);
      p.select(); assert.equal(p.button.classList.contains('study-selection-search'), true);
      if (mode === 'practice') p.doc.getElementById('practiceMode').classList.add('minimized');
      else p.doc.body.classList.replace('rec-playing', 'rec-playing-minimized');
      await p.flush();
      assert.equal(p.button.classList.contains('study-selection-search'), false);
    } finally {p.close();}
  });
}

test('Practice keeps Flip visible and interactive when the other controls auto-hide', () => {
  const p = boot('practice');
  try {
    p.advance(3100);
    const flip = p.doc.querySelector('.practice-unflip');
    const prev = p.doc.querySelector('.practice-prev');
    assert.equal(p.window.testChrome.isVisible(), false);
    assert.equal(p.window.getComputedStyle(flip).visibility, 'visible');
    assert.notEqual(p.window.getComputedStyle(flip).pointerEvents, 'none');
    assert.equal(p.window.getComputedStyle(prev).visibility, 'hidden');
    let flips = 0; flip.addEventListener('click', () => flips++);
    flip.dispatchEvent(new p.window.MouseEvent('pointerdown', {button: 0, bubbles: true, cancelable: true}));
    assert.equal(p.window.testChrome.isVisible(), true, 'visible Flip acts on the first tap');
    flip.dispatchEvent(new p.window.MouseEvent('pointerup', {button: 0, bubbles: true}));
    flip.click(); assert.equal(flips, 1);
    p.doc.getElementById('practiceMode').classList.add('minimized');
    assert.equal(p.window.getComputedStyle(p.doc.querySelector('.practice-nav')).display, 'none');
  } finally {p.close();}
});

test('actual Practice navigation clears only the previous card selection', () => {
  const p = boot('practice');
  try {
    Object.assign(p.window, {_practiceActive: true, _practiceCards: [{}, {}], _practiceIdx: 0});
    p.window.eval('const _preferredPracticeSpeed = () => 1; const _renderPracticeCard = () => {};\n' + app.slice(navigation.start, navigation.end));
    p.select(); p.window.practiceNav(1);
    assert.equal(p.window.getSelection().toString(), '');
    assert.equal(p.window._practiceIdx, 1);
    p.select(p.doc.getElementById('outside')); p.window.practiceNav(1);
    assert.equal(p.window.getSelection().toString(), 'Outside text', 'other page selections remain intact');
  } finally {p.close();}
});
