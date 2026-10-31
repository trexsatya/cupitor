import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {recordingsHaveChanges} from './recordings-sync-state.js';
import {persistableRecordings} from './recordings-merge.js';
import {sameJson, threeWayRecordings} from './recordings-3way.js';
import {mergeFolderCatalog} from './playlist-folders.js';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('./language.js');
const copy = value => JSON.parse(JSON.stringify(value));
const original = () => ({
  One: {createdAt: 1, updatedAt: 1, items: {Manual: {Card: [{id: 'a', manual: true, source: 'First', enabled: true}]}}},
  Two: {createdAt: 2, updatedAt: 2, items: {}},
});
const buttonHtml = '<button id="recRecSync"><span class="rec-rec-lbl">Sync</span></button>';

// Exercise the actual save, refresh, and async sync entry points. The remote
// transport is controlled so failures and edits during a request are repeatable.
const runtimeRequire = createRequire(require.resolve(process.env.CUPITOR_JSDOM || 'jsdom'));
const {parse} = runtimeRequire('@babel/parser');
const ast = parse(app, {sourceType: 'module'});
function appFunction(name) {
  const node = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.ok(node, name + ' exists in the application');
  return app.slice(node.start, node.end);
}

function fixture(baseline = original()) {
  const dom = new JSDOM('<!doctype html><body>' + buttonHtml + '</body>', {
    url: 'https://cupitor.test/language.html', runScripts: 'outside-only',
  });
  const w = dom.window;
  w.eval(read('../vendor/jquery.js'));
  w._recordings = original();
  w._recording = {currentName: 'One', state: 'idle', items: w._recordings.One.items};
  w._recordingsDirty = false;
  if (baseline) w.localStorage.setItem("baseline", JSON.stringify(baseline));
  w.localStorage.setItem('recordings', JSON.stringify(w._recordings));
  let calls = 0, fail = false, release = null, remoteFolders = {};
  Object.assign(w, {
    $: w.jQuery, recordingsHaveChanges, mergeFolderCatalog,
    _scopedKey: key => key, getLangFromUrl: () => ({fullName:"swedish"}), _sameJson: sameJson, _threeWayRecordings: threeWayRecordings,
    REC_COLLECTION_KEY: 'recordings', REC_CURRENT_KEY: 'currentName', REC_CURRENT_EXT_KEY: 'extId', REC_STATE_KEY: 'recordingState',
    REC_KEY: 'legacy', REC_DIRTY_KEY: 'dirty', SYNC_CANCELLED: 'sync cancelled',
    _persistableRecordings: () => persistableRecordings(w._recordings),
    _recordingsBaseKey: () => "baseline",
    _isReadOnlyPlaylist: name => !!w._recordings[name]?.readOnly,
    _haveNotifBridge: () => false, _notifScheduleResync() {}, _requireSelf: () => true, _updateRecordingUI() {}, _reportRecordingCollisions() {},
    _adoptRecordings(value) {
      w._recordings = value;
      w._recording.items = value[w._recording.currentName]?.items || {};
    },
    alert() {},
    async syncRecordingsFiles({mergeFolders}) {
      calls++;
      const sent = copy(persistableRecordings(w._recordings));
      const folders = copy(mergeFolders(remoteFolders));
      if (release) await new Promise(resolve => {release = resolve;});
      if (fail) throw new Error('network unavailable');
      remoteFolders = folders;
      return sent;
    },
  });
  w.console.error = () => {};
  w.eval('const _playlistFolderStates = new Map();\n' + [
    ...['_playlistFolderKey','_playlistFolderState','_persistPlaylistFolders','_playlistFoldersDirty'].map(appFunction),
    appFunction('_loadRecordingsBase'), appFunction('_saveRecordingsBase'), appFunction('_saveRecording'), appFunction('syncRecordingsToGithub'), appFunction('_refreshRecordingSyncBtn')].join('\n') +
    '\nwindow.saveRecording=_saveRecording;window.refreshSync=_refreshRecordingSyncBtn;window.syncRecordings=syncRecordingsToGithub;');
  return {w, get button() {return w.document.getElementById('recRecSync');},
    get calls() {return calls;}, get remoteFolders() {return copy(remoteFolders);}, fail() {fail = true;},
    editFolder(name, deleted=false) {
      const folders=w._playlistFolderState();
      folders.catalog=mergeFolderCatalog(folders.catalog,{[name]:{updatedAt:Date.now(),deleted}});
      w._persistPlaylistFolders();w.refreshSync();
    },
    hold() {release = true;}, release() {const resolve = release; release = null; resolve();},
    edit(text = 'Edited') {w._recording.items.Manual.Card[0].source = text; w.saveRecording();},
    close() {dom.window.close();}};
}

test('content comparison detects playlist/card/settings/order changes but ignores save timestamps and session playlists', () => {
  const base = original(), changed = copy(base);
  changed.One.updatedAt = Date.now();
  changed.Shared = {readOnly: true, items: {anything: {word: [{id: 'foreign'}]}}};
  changed.Bridge = {external: true, items: {}};
  assert.equal(recordingsHaveChanges(changed, base), false);
  for (const edit of [
    x => {x.One.items.Manual.Card[0].source = 'Edited';},
    x => {x.One.items.Manual.Card[0].enabled = false;},
    x => {x.One.items.Manual.Card.push({id: 'new', source: 'New'});},
    x => {x.One.items.Manual.Card = [];},
    x => {delete x.Two;},
    x => {x.New = {items: {}};},
    x => {x.Combined = {virtual: true, members: ['One', 'Two']};},
    x => {x.One.notifKey = 'scheduled';},
  ]) {
    const local = copy(base); edit(local);
    assert.equal(recordingsHaveChanges(local, base), true);
  }
  const ordered = copy(base); ordered.One.items.Manual.Card.push({id: 'b', source: 'Second'});
  const reordered = copy(ordered); reordered.One.items.Manual.Card.reverse();
  assert.equal(recordingsHaveChanges(reordered, ordered), true);
});

test('a stale dirty flag is cleared and a clean sync makes no network request', async () => {
  const p = fixture();
  try {
    p.w._recordingsDirty = true; p.w.refreshSync();
    assert.equal(p.button.disabled, true);
    assert.equal(p.w.localStorage.getItem('dirty'), null);
    await p.w.syncRecordings(); assert.equal(p.calls, 0);
  } finally {p.close();}
});

test('switching playlists and recording state does not enable Sync, with or without a remote baseline', () => {
  for (const baseline of [original(), null]) {
    const p = fixture(baseline);
    try {
      p.w._recording.currentName = 'Two'; p.w._recording.items = p.w._recordings.Two.items;
      p.w._recording.state = 'paused'; p.w.saveRecording();
      assert.equal(p.button.disabled, true);
      p.w._recording.items.Manual = {Card: [{id: 'new', source: 'New'}]}; p.w.saveRecording();
      assert.equal(p.button.disabled, false);
    } finally {p.close();}
  }
});

test('editing enables Sync and reverting the content disables it again', () => {
  const p = fixture();
  try {
    p.edit(); assert.equal(p.button.disabled, false);
    assert.equal(p.w.localStorage.getItem('dirty'), '1');
    p.edit('First'); assert.equal(p.button.disabled, true);
  } finally {p.close();}
});

test('a successful sync disables Sync; a failed sync leaves it available to retry', async () => {
  for (const failure of [false, true]) {
    const p = fixture();
    try {
      p.edit(); if (failure) p.fail();
      if (failure) await assert.rejects(p.w.syncRecordings(), /network unavailable/);
      else await p.w.syncRecordings();
      assert.equal(p.button.disabled, !failure);
      assert.equal(p.button.classList.contains('syncing'), false);
      assert.equal(p.w._recordingsDirty, failure);
    } finally {p.close();}
  }
});

test('Sync stays disabled during a request, including after rerender, and preserves later edits', async () => {
  const p = fixture();
  try {
    p.edit(); p.hold();
    const pending = p.w.syncRecordings();
    assert.equal(p.button.disabled, true);
    p.button.outerHTML = buttonHtml; p.w.refreshSync();
    assert.equal(p.button.disabled, true);
    await p.w.syncRecordings(); assert.equal(p.calls, 1, 'no duplicate request');
    p.edit('Changed while syncing'); assert.equal(p.button.disabled, true);
    p.release(); await pending;
    assert.equal(p.button.disabled, false);
    assert.equal(p.w._recording.items.Manual.Card[0].source, 'Changed while syncing');
    assert.equal(p.w._recordingsDirty, true);
  } finally {p.close();}
});

test('a successful sync stays clean if baseline storage is full, and later edits cannot mutate that baseline', async () => {
  const p = fixture();
  const setItem = p.w.Storage.prototype.setItem;
  try {
    p.edit();
    p.w.Storage.prototype.setItem = function(key, value) {
      if (key === 'baseline') throw new p.w.DOMException('Storage full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
    await p.w.syncRecordings();
    assert.equal(p.button.disabled, true, 'successful sync is clean even when storage cannot cache its baseline');
    p.edit('Later edit');
    assert.equal(p.button.disabled, false, 'baseline is an independent snapshot');
  } finally {p.w.Storage.prototype.setItem = setItem;p.close();}
});


test('empty-folder edits alone enable Sync and a successful upload saves their confirmed baseline', async()=>{
  const p=fixture();
  try {
    p.w.refreshSync();assert.equal(p.button.disabled,true);
    p.editFolder('Language/Empty');
    assert.equal(p.button.disabled,false);
    assert.equal(p.w.localStorage.getItem('dirty'),'1');
    await p.w.syncRecordings();
    assert.equal(p.remoteFolders['Language/Empty'].deleted,false);
    assert.equal(p.button.disabled,true);
    assert.equal(p.w.localStorage.getItem('dirty'),null);
    assert.equal(p.w._playlistFoldersDirty(),false);
  }finally{p.close();}
});

test('a failed folder-only sync leaves the folder pending for retry', async()=>{
  const p=fixture();
  try {
    p.editFolder('Pending');p.fail();
    await assert.rejects(p.w.syncRecordings(),/network unavailable/);
    assert.equal(p.button.disabled,false);
    assert.equal(p.w._playlistFoldersDirty(),true);
    assert.deepEqual(p.remoteFolders,{});
  }finally{p.close();}
});

test('folders added during an upload stay pending and are included in the next sync', async()=>{
  const p=fixture();
  try {
    p.editFolder('Before');p.hold();
    const pending=p.w.syncRecordings();
    p.editFolder('During');
    assert.equal(p.button.disabled,true);
    p.release();await pending;
    assert.equal(p.remoteFolders.Before.deleted,false);
    assert.equal(p.remoteFolders.During,undefined);
    assert.equal(p.button.disabled,false);
    assert.equal(p.w._playlistFolderState().catalog.During.deleted,false);
    await p.w.syncRecordings();
    assert.equal(p.remoteFolders.During.deleted,false);
    assert.equal(p.button.disabled,true);
  }finally{p.close();}
});
