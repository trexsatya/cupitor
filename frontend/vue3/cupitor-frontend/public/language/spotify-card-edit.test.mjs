import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {spotifyClipSegments} from './spotify-clips.js';
import {captionFieldOf, captionKeysInItem, appendCaptionBlock} from './caption-capture.js';
import {parseMediaUrl} from './recordings-merge.js';
import {speechLocale} from './language-config.js';

const require = createRequire(import.meta.url);
const runtimeRequire = createRequire(require.resolve(process.env.CUPITOR_JSDOM || 'jsdom'));
const {parse} = runtimeRequire('@babel/parser');
const source = fs.readFileSync(new URL('./language.js', import.meta.url), 'utf8');
const ast = parse(source, {sourceType: 'module'});
const handlers = ['_applyCardTtsLocales', 'updateManualEntry'].map(name => {
  const node = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.ok(node, 'the real card save handler must be present');
  return source.slice(node.start, node.end);
}).join('\n');
const episode = 'https://open.spotify.com/episode/317TI86OHwkAxLtwi1VnXN';
const other = 'https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5';
const card = () => ({manual: true, id: 'captured', source: 'Original caption', target: 'Translation',
  mediaUrl: episode, mediaKind: 'spotify', captionUrl: episode, captionField: 'source',
  captionStarts: [12.52], captionEnds: [14.16], captionRows: [1]});
const ranges = item => spotifyClipSegments(item).map(({start, end}) => [start, end]);

function editor(item) {
  let saved;
  const window = {_recordings: {Deck: {items: {Manual: {Card: [item]}}}}};
  const scope = {window, _captionFieldOf: captionFieldOf, _parseMediaUrl: parseMediaUrl,
    spotifyClips: spotifyClipSegments, speechLocale, _isAudioMediaUrl: value => String(value || '').startsWith('file://'),
    _refuseReadOnlyPlaylist: () => false,
    _saveRecording: () => {saved = JSON.parse(JSON.stringify(item));}};
  const update = Function(...Object.keys(scope), handlers + '\nreturn updateManualEntry;')(...Object.values(scope));
  return {edit: patch => update('Deck', item.id, patch), saved: () => saved};
}

test('editing captured Spotify text preserves the playback bounds after saving', () => {
  const item = card(), e = editor(item);
  assert.equal(e.edit({source: '<b>Corrected caption</b>\nMy note', target: 'Updated translation'}), true);
  assert.deepEqual(ranges(item), [[12.52, 14.16]]);
  assert.deepEqual(ranges(e.saved()), [[12.52, 14.16]], 'saved/reloaded cards remain Spotify clips');
  assert.equal(item.id, 'captured');
  assert.equal(item.captionStarts, undefined, 'edited text no longer claims old row attribution');
  assert.equal(captionKeysInItem(item, episode, 't').size, 0);
  e.edit({source: 'Edited once more'});
  assert.deepEqual(ranges(e.saved()), [[12.52, 14.16]], 'later edits retain the same clip');
});

test('editing translations and captured Target text both retain Spotify playback', () => {
  const item = card(), e = editor(item);
  e.edit({target: 'A better translation'});
  assert.deepEqual(ranges(item), [[12.52, 14.16]]);
  assert.equal(captionKeysInItem(item, episode, 't').size, 1, 'unedited captions still prevent duplicates');
  item.captionField = 'target';
  e.edit({target: 'Corrected captured Target'});
  assert.deepEqual(ranges(e.saved()), [[12.52, 14.16]]);
  assert.equal(item.captionStarts, undefined);
});

test('merged passages survive edits and newly captured passages join their playback', () => {
  const item = appendCaptionBlock(card(), {url: episode, timeParam: 't'},
    [{start: 30, end: 32, text: 'Second passage'}], 'source');
  const e = editor(item);
  e.edit({source: 'Rewritten passage notes', target: 'Rewritten translation'});
  assert.deepEqual(item.captionBlocks, []);
  assert.deepEqual(ranges(e.saved()), [[12.52, 14.16], [30, 32]]);
  const appended = appendCaptionBlock(e.saved(), {url: episode, timeParam: 't'},
    [{start: 50, end: 52, text: 'Third passage'}], 'source');
  assert.deepEqual(ranges(appended), [[12.52, 14.16], [30, 32], [50, 52]]);
  assert.equal(captionKeysInItem(appended, episode, 't').size, 1, 'only the new unedited passage claims caption rows');
});

test('a source/target swap preserves the linked Spotify clip', () => {
  const item = card(), e = editor(item);
  e.edit({source: item.target, target: item.source, captionField: 'target'});
  assert.deepEqual(ranges(e.saved()), [[12.52, 14.16]]);
  assert.equal(item.captionField, 'target');
});

test('changing or clearing the media link cannot attach old ranges to another episode', () => {
  for (const mediaUrl of [other, 'https://example.org', '']) {
    const item = card(), e = editor(item);
    e.edit({source: 'Corrected caption'});
    e.edit({source: 'Another correction', mediaUrl});
    assert.deepEqual(ranges(e.saved()), []);
    assert.equal(item.spotifyClipRanges, undefined);
  }
  const item = card(), e = editor(item);
  e.edit({source: 'Correction', mediaUrl: 'spotify:episode:317TI86OHwkAxLtwi1VnXN'});
  assert.deepEqual(ranges(item), [[12.52, 14.16]], 'equivalent episode URLs keep their bounds');
});

test('invalid playback snapshots are rejected and plain cards do not gain clip metadata', () => {
  for (const range of [{url: other, start: 1, end: 2}, {url: episode, start: 2, end: 1},
    {url: episode, start: null, end: 2}, {url: episode, start: 1, end: null}]) {
    assert.deepEqual(ranges({mediaUrl: episode, spotifyClipRanges: [range]}), []);
  }
  const item = {manual: true, id: 'plain', source: 'My card', target: 'Translation'}, e = editor(item);
  e.edit({source: 'Edited card'});
  assert.equal(item.spotifyClipRanges, undefined);
});
