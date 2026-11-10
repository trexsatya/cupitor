import { initPageFind } from './page-find.js';

const ALL = 'cupitor-page-find-all';
const ACTIVE = 'cupitor-page-find-active';
let api;
let input;
let registry;
let oldRects;
let oldRect;

beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = '<button id="cupPageFindToggle">Find</button>' +
    '<div id="cupPageFindBar" hidden><input id="cupPageFindInput">' +
    '<span id="cupPageFindCount"></span><button id="cupPageFindPrevious"></button>' +
    '<button id="cupPageFindNext"></button><button id="cupPageFindClose"></button></div>' +
    '<p>i samband med tiden; i enlighet med det; i slutet.</p>';
  registry = new Map();
  window.CSS = expect.getState().currentTestName.startsWith('legacy') ? {} : { highlights: registry };
  window.Highlight = class extends Set {
    constructor(...ranges) { super(ranges); }
  };
  oldRects = Range.prototype.getClientRects;
  oldRect = Range.prototype.getBoundingClientRect;
  Range.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  Range.prototype.getBoundingClientRect = () => ({ width: 20, height: 20, top: 100, bottom: 120 });
  input = document.getElementById('cupPageFindInput');
  api = initPageFind();
  api.open();
});

afterEach(() => {
  api.close();
  jest.clearAllTimers();
  jest.useRealTimers();
  Range.prototype.getClientRects = oldRects;
  Range.prototype.getBoundingClientRect = oldRect;
  delete window.Highlight;
  delete window.CSS;
  document.body.innerHTML = '';
});

function type(value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('typing a longer phrase immediately clears every old single-letter highlight', () => {
  type('i');
  jest.advanceTimersByTime(140);
  const oldAll = registry.get(ALL);
  const oldActive = registry.get(ACTIVE);
  expect(oldAll.size).toBeGreaterThan(1);
  type('i enlighet');
  expect(oldAll.size).toBe(0);
  expect(oldActive.size).toBe(0);
  expect(registry.size).toBe(0);
  jest.advanceTimersByTime(140);
  expect([...registry.get(ALL)].map(range => range.toString())).toEqual(['i enlighet']);
  expect(document.getElementById('cupPageFindCount').textContent).toBe('1 of 1');
});

test.each(['Escape', 'close button'])('%s clears ranges, registrations and pending searches', method => {
  type('i');
  jest.advanceTimersByTime(140);
  const highlights = [...registry.values()];
  if (method === 'Escape') input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  else document.getElementById('cupPageFindClose').click();
  expect(highlights.every(highlight => highlight.size === 0)).toBe(true);
  expect(registry.size).toBe(0);
  expect(api.getState().open).toBe(false);
  api.open();
  type('i enlighet');
  api.close();
  jest.advanceTimersByTime(500);
  expect(registry.size).toBe(0);
  expect(api.getState().total).toBe(0);
});

test('legacy marks disappear on phrase changes and close without changing card text', () => {
  const text = document.querySelector('p').textContent;
  type('i');
  jest.advanceTimersByTime(140);
  expect(document.querySelectorAll('mark').length).toBeGreaterThan(1);
  type('i enlighet');
  expect(document.querySelectorAll('mark').length).toBe(0);
  jest.advanceTimersByTime(140);
  expect([...document.querySelectorAll('mark')].map(mark => mark.textContent)).toEqual(['i enlighet']);
  api.close();
  expect(document.querySelectorAll('mark').length).toBe(0);
  expect(document.querySelector('p').textContent).toBe(text);
});
