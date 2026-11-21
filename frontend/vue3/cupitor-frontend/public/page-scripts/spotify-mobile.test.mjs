import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const address = 'https://open.spotify.com/episode/317TI86OHwkAxLtwi1VnXN';
const lines = [
  {start: 0, end: 2.38, text: 'First cue'},
  {start: 12.52, end: 14.16, text: 'Second cue'},
  {start: 14.42, end: 17.96, text: 'Third cue'},
];
export function boot({session = false, url = address, launcherPosition} = {}) {
  const dom = new JSDOM('<html><head><title>Episode</title></head><body><main><h1>Episode</h1><button data-testid="play-button" aria-label="Pausa">Pause</button></main></body></html>', {
    url, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const {window} = dom, doc = window.document;
  if (launcherPosition !== undefined) window.localStorage.setItem('cupSrtLauncherPosition', launcherPosition);
  window.console = {log(){},warn(){},error(){}};
  let now = 10000; window.Date.now = () => now;
  const timers = new Map(); let id = 0;
  window.setInterval = fn => {timers.set(++id,fn); return id;};
  window.clearInterval = key => timers.delete(key);
  window.setTimeout = () => ++id;
  const media = window.HTMLMediaElement.prototype;
  Object.defineProperty(media,'duration',{configurable:true,get(){return this._duration ?? 3307.76;}});
  Object.defineProperty(media,'readyState',{configurable:true,get(){return 4;}});
  Object.defineProperty(media,'paused',{configurable:true,get(){return this._paused !== false;}});
  media.play = function(){this._paused=false;this.dispatchEvent(new window.Event('play'));return Promise.resolve();};
  media.pause = function(){this._paused=true;this.dispatchEvent(new window.Event('pause'));};
  media.load = function(){};
  let ms;
  if (session) {
    let state = 'none';
    ms = {setPositionState(){},setActionHandler(){}};
    Object.defineProperty(ms,'playbackState',{configurable:true,get(){return state;},set(value){state=value;}});
    Object.defineProperty(window.navigator,'mediaSession',{value:ms,configurable:true});
  }
  const requests=[];
  window.LocalSubtitles = {postMessage: value => requests.push(JSON.parse(value))};
  for(const file of ['20-caption-sidebar.js','24-spotify-playback-bridge.js','25-spotify-player.js','30-caption-sites.js','70-caption-capture.js']) {
    window.eval(fs.readFileSync((file === '20-caption-sidebar.js' ? path.join(here, '../language/caption-sidebar.js') : path.join(here,'src',file)),'utf8'));
  }
  const tick=()=>{for(const fn of timers.values())fn();};
  tick();
  return {
    window,doc,ms,tick,player:window.__cupCaptionPlayer,
    advance(ms){now+=ms;tick();},
    rows:()=>[...doc.querySelectorAll('.cup-sub-cue')],
    import(trackLines=lines){doc.querySelector('[data-act="open-srt"]').click();return window.__cupLocalSubtitlesResult({requestId:requests.at(-1).requestId,lang:'sv',lines:trackLines});},
    close(){window.close();},
  };
}
test('a paused mobile Spotify episode without a track URL can open a local SRT', () => {
  const p = boot({session: true, url: 'https://open.spotify.com/'});
  try {
    p.doc.getElementById('cup-spotify-srt-toggle').click();
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, false);
    assert.equal(p.import(), true);
    p.tick();
    assert.equal(p.rows().length, lines.length);
    assert.ok(p.doc.body.classList.contains('cup-sub-split'), 'import leaves the subtitle panel open');
    assert.equal(p.doc.querySelector('[data-act="pick"]').style.display, 'none', 'clips require an identified Spotify item');
    assert.equal(p.window.sessionStorage.getItem('cupitorLocalSubtitles'), null, 'unlinked subtitles are not cached');

    // Spotify can first expose the title and playback position after playback starts.
    p.ms.metadata = {title: 'Kropp & Själ', artist: 'Sveriges Radio'};
    p.ms.playbackState = 'playing';
    p.ms.setPositionState({duration: 3307.76, position: 12.8, playbackRate: 1});
    p.tick();
    assert.ok(p.rows()[1].classList.contains('cup-active'), 'the SRT syncs once playback is available');

    p.ms.metadata = {title: 'Next episode', artist: 'Sveriges Radio'};
    p.tick();
    assert.equal(p.rows().length, 0, 'a different item drops the unlinked transcript');
  } finally { p.close(); }
});

test('mobile Spotify follows detached audio and seeks a cue without desktop controls', async()=>{
  const p=boot();
  try{
    const audio=new p.window.Audio(); audio.currentTime=12.8; await audio.play();
    assert.equal(p.doc.querySelector('audio'),null);
    assert.equal(p.import(),true); p.tick();
    assert.ok(p.rows()[1].classList.contains('cup-active'));
    p.rows()[2].querySelector('.cup-sub-time').click();
    assert.equal(audio.currentTime,14.42);
    assert.equal(p.player.isConnected,true,'detached backing audio is an active player');
  }finally{p.close();}
});
test('mobile audio with an unbounded duration still provides a clock and supports seeking',async()=>{
  const p=boot();
  try{
    const audio=new p.window.Audio();audio._duration=Infinity;audio.currentTime=12.8;await audio.play();
    p.import();p.tick();assert.ok(p.rows()[1].classList.contains('cup-active'));
    p.rows()[2].querySelector('.cup-sub-time').click();assert.equal(audio.currentTime,14.42);
  }finally{p.close();}
});
test('mobile Media Session provides the clock and handles subtitle seek, pause and resume',async()=>{
  const p=boot({session:true}), seeks=[];
  try{
    p.ms.setActionHandler('seekto',detail=>{seeks.push(detail);p.ms.setPositionState({duration:3307.76,position:detail.seekTime,playbackRate:1});});
    p.ms.setActionHandler('play',()=>{p.ms.playbackState='playing';});
    p.ms.setActionHandler('pause',()=>{p.ms.playbackState='paused';});
    p.ms.playbackState='playing';p.ms.setPositionState({duration:3307.76,position:12.6,playbackRate:1});
    p.import();p.tick();assert.ok(p.rows()[1].classList.contains('cup-active'));
    p.advance(500);assert.equal(p.player.currentTime,13.1);
    p.player.pause();p.advance(2000);assert.equal(p.player.currentTime,13.1,'pause freezes the extrapolated clock');
    p.rows()[2].querySelector('.cup-sub-time').click();
    assert.equal(seeks.length,1);assert.equal(seeks[0].seekTime,14.42);assert.equal(seeks[0].action,'seekto');
    assert.equal(p.player.paused,false);
  }finally{p.close();}
});
test('missing playback access shows a useful message and never pretends to seek or highlight zero',()=>{
  const p=boot();
  try{
    p.import();p.tick();assert.equal(p.doc.querySelector('.cup-active'),null);
    assert.match(p.doc.querySelector('[data-r="notice"]').textContent,/pause and resume/i);
    p.rows()[2].querySelector('.cup-sub-time').click();
    assert.equal(p.doc.querySelector('.cup-active'),null,'a failed seek cannot focus the requested cue');
  }finally{p.close();}
});
test('removed Media Session seek handlers are not retained as stale controls',()=>{
  const p=boot({session:true});
  try{
    let first=0,second=0;
    p.ms.setActionHandler('seekto',()=>first++);p.ms.setActionHandler('seekto',()=>second++);
    p.ms.setPositionState({duration:3307.76,position:12.6,playbackRate:1});
    assert.equal(p.player.seekTo(14.42),true);assert.equal(first,0);assert.equal(second,1);
    p.ms.setActionHandler('seekto',null);assert.equal(p.player.seekTo(15),false);
  }finally{p.close();}
});

function launcher(p) {
  const button = p.doc.getElementById('cup-spotify-srt-toggle');
  Object.defineProperties(button, {offsetWidth: {value: 60}, offsetHeight: {value: 40}});
  button.getBoundingClientRect = () => ({left: parseFloat(button.style.left), top: parseFloat(button.style.top)});
  p.window.dispatchEvent(new p.window.Event('resize'));
  return {button,
    position: () => [parseFloat(button.style.left), parseFloat(button.style.top)],
    pointer(type, x, y, pointerType = 'mouse') {
      const event = new p.window.MouseEvent(type, {clientX: x, clientY: y, button: 0, bubbles: true});
      Object.defineProperty(event, 'pointerId', {value: 1});
      Object.defineProperty(event, 'pointerType', {value: pointerType});
      button.dispatchEvent(event);
    },
    click: () => button.dispatchEvent(new p.window.MouseEvent('click', {bubbles: true, detail: 1})),
  };
}

test('SRT dragging saves its position, suppresses release clicks and restores after reopening', () => {
  const p = boot(); let restored;
  try {
    const l = launcher(p), initial = l.button.getAttribute('aria-expanded');
    const [x, y] = l.position();
    l.pointer('pointerdown', x + 20, y + 20);
    l.pointer('pointermove', x - 80, y + 220);
    l.pointer('pointerup', x - 80, y + 220);
    l.click();
    assert.ok(Math.abs(l.position()[0] - (x - 100)) < 0.001);
    assert.ok(Math.abs(l.position()[1] - (y + 200)) < 0.001);
    assert.equal(l.button.getAttribute('aria-expanded'), initial, 'drag release is not a subtitle toggle');
    const saved = p.window.localStorage.getItem('cupSrtLauncherPosition');
    restored = boot({launcherPosition: saved});
    assert.deepEqual(launcher(restored).position(), l.position());
    l.pointer('pointerdown', x - 80, y + 220);
    l.pointer('pointerup', x - 80, y + 220);
    l.click();
    assert.notEqual(l.button.getAttribute('aria-expanded'), initial, 'a normal tap after dragging works');
  } finally { p.close(); restored?.close(); }
});

test('touch taps activate on release after a drag and ignore duplicate native clicks', () => {
  const p = boot();
  try {
    const l = launcher(p), initial = l.button.getAttribute('aria-expanded');
    const [x, y] = l.position();
    l.pointer('pointerdown', x + 20, y + 20, 'touch');
    l.pointer('pointermove', x - 80, y + 220, 'touch');
    l.pointer('pointerup', x - 80, y + 220, 'touch');
    assert.equal(l.button.getAttribute('aria-expanded'), initial);
    l.pointer('pointerdown', x - 80, y + 220, 'touch');
    l.pointer('pointerup', x - 80, y + 220, 'touch');
    const toggled = l.button.getAttribute('aria-expanded');
    assert.notEqual(toggled, initial, 'a tap works even when Chromium omits its click');
    l.click();
    assert.equal(l.button.getAttribute('aria-expanded'), toggled, 'a native click cannot toggle it twice');
  } finally { p.close(); }
});

test('SRT launcher ignores corrupt saved positions and clamps cancelled drags and resizes', () => {
  const p = boot({launcherPosition: '{"x":-10,"y":9999}'});
  try {
    const l = launcher(p);
    assert.deepEqual(l.position(), [p.window.innerWidth - 72, 12]);
    l.pointer('pointerdown', p.window.innerWidth - 42, 32);
    l.pointer('pointermove', 5000, 5000);
    l.pointer('pointercancel', 5000, 5000);
    assert.deepEqual(l.position(), [p.window.innerWidth - 72, p.window.innerHeight - 52]);
    p.window.innerWidth = 320; p.window.innerHeight = 240;
    p.window.dispatchEvent(new p.window.Event('resize'));
    assert.deepEqual(l.position(), [248, 188]);
    l.pointer('pointerdown', 270, 210);
    l.pointer('pointermove', -500, -500);
    l.pointer('pointerup', -500, -500);
    assert.deepEqual(l.position(), [12, 12]);
  } finally { p.close(); }
});
