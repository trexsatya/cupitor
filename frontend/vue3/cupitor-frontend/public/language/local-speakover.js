// Shadowing/speak-over for a locally opened MP3, WAV or MP4.
// Unlike a Practice card, a File handle cannot survive reload. Persist only
// *kept* takes against the file's name/size/modified-date fingerprint and load
// them again when that exact file is selected. The source media is never saved.
import { addTake, takeAt, removeTake, takeDueForPass, takesDuration } from './practice-rec.js';

export function localSpeakOverIdentity(file) {
  if (!file || !file.name) return '';
  return [String(file.name).normalize('NFC'), Number(file.size) || 0, Number(file.lastModified) || 0]
    .map(encodeURIComponent).join('|');
}

export function createLocalSpeakOver({
  startRecording, stopRecording, cancelRecording, permission,
  loadAudio, deleteAudio, readSaved, writeSaved,
  makeAudio = url => new Audio(url), onChange = () => {},
  now = () => Date.now(),
} = {}) {
  let session = null;
  let generation = 0;

  function snapshot() {
    if (!session) return null;
    const st = session;
    return {
      identity: st.identity, filename: st.file.name, phase: st.phase,
      takes: st.takes.slice(), dirty: st.takes.some(t => !st.kept.has(t.url)) ||
        st.orphans.length > 0, error: st.error,
      duration: takesDuration(st.takes),
    };
  }
  function render() { onChange(snapshot()); }
  function removeFile(url) { if (url) Promise.resolve(deleteAudio(url)).catch(() => {}); }
  function stopTake(st) {
    if (st.audio) { try { st.audio.pause() } catch (_) {} st.audio = null; }
    st.playToken++;
  }
  function pauseMedia(st) {
    try { st.element.pause(); } catch (_) {}
  }
  function closeCurrent() {
    const st = session;
    session = null;
    generation++;
    if (!st) { render(); return; }
    st.element.removeEventListener('timeupdate', st.tick);
    st.element.removeEventListener('play', st.preventOverlap);
    st.element.removeEventListener('seeking', st.resetPosition);
    st.element.removeEventListener('seeked', st.resetPosition);
    st.element.removeEventListener('ended', st.resetPosition);
    stopTake(st);
    // Do not leave a microphone open when changing media, even if a bridge
    // command is still in flight. Late recorder replies are discarded below.
    if (['starting', 'recording', 'stopping'].includes(st.phase)) {
      Promise.resolve(cancelRecording()).catch(() => {});
    }
    st.takes.forEach(t => { if (!st.kept.has(t.url)) removeFile(t.url); });
    render();
  }

  function attach(file, element) {
    closeCurrent();
    const identity = localSpeakOverIdentity(file);
    if (!identity || !element) return null;
    let saved = [];
    try {
      const records = readSaved(identity);
      if (Array.isArray(records)) saved = records.filter(t =>
        t && /^file:\/\//.test(t.url || '') && Number.isFinite(Number(t.t1)) &&
        Number(t.t1) >= 0).map(t => ({url:t.url, t1:Number(t.t1), ms:Number(t.ms)||0}));
    } catch (_) {}
    const st = {
      identity, file, element, saved: saved.slice(), takes:saved.slice(),
      kept: new Set(saved.map(t => t.url)), orphans: [],
      phase:'idle', error:'', startedAt:0, startAt:0, playToken:0,
      watchPos:null, awaiting:null, audio:null, tick:null, resetPosition:null,
      preventOverlap:null,
    };
    session = st;
    // Seek jumps re-baseline the crossing watcher. Keep the awaited mark
    // through our automatic post-recording rewind, then clear it once reached.
    st.resetPosition = () => { st.watchPos = null; };
    st.preventOverlap = () => {
      if (['starting','recording','stopping','playback'].includes(st.phase)) pauseMedia(st);
    };
    st.tick = () => {
      if (session !== st) return;
      const pos = Number(st.element.currentTime);
      if (!Number.isFinite(pos)) return;
      const prev = st.watchPos;
      st.watchPos = pos;
      if (st.phase !== 'idle' || st.element.paused || prev == null) return;
      const due = takeDueForPass(st.takes, prev, pos, st.awaiting);
      if (due) {
        st.awaiting = null;
        pauseMedia(st);
        playTake(st, due, true);
      } else if (st.awaiting != null && pos > st.awaiting + 0.25) st.awaiting = null;
    };
    element.addEventListener('timeupdate', st.tick);
    element.addEventListener('play', st.preventOverlap);
    for (const name of ['seeking','seeked','ended']) element.addEventListener(name, st.resetPosition);
    render();
    return snapshot();
  }

  async function start() {
    const st = session;
    if (!st || st.phase !== 'idle') return false;
    const token = ++generation;
    st.startAt = Number(st.element.currentTime) || 0;
    st.phase = 'starting'; st.error = '';
    st.awaiting = null;
    stopTake(st);
    pauseMedia(st);
    render();
    try {
      const perm = await permission();
      if (session !== st || generation !== token || st.phase !== 'starting') return false;
      if (perm === 'denied') throw new Error('Microphone permission denied');
      const id = 'localprec_' + now().toString(36) + '_' + token;
      const url = await startRecording(id);
      if (session !== st || generation !== token || st.phase !== 'starting') {
        if (url) removeFile(url);
        return false;
      }
      if (!url) throw new Error('The microphone did not start');
      st.phase = 'recording'; st.startedAt = now();
      render();
      return true;
    } catch (err) {
      if (session === st && generation === token && st.phase === 'starting') {
        st.error = err && err.message || 'Could not start microphone';
        st.phase = 'idle'; render();
      }
      return false;
    }
  }

  function cancel() {
    const st = session;
    if (!st || st.phase !== 'starting') return false;
    generation++;
    st.phase = 'idle'; st.error = 'Recording cancelled';
    Promise.resolve(cancelRecording()).catch(() => {});
    render();
    return true;
  }

  async function stop() {
    const st = session;
    if (!st || st.phase !== 'recording') return false;
    const token = ++generation;
    st.phase = 'stopping'; render();
    const ms = Math.max(0, now() - st.startedAt);
    let url = null;
    try { url = await stopRecording(); }
    catch (error) {
      if (session === st && generation === token) {
        st.error = String(error && error.message || error); st.phase = 'idle'; render();
      }
      return false;
    }
    if (session !== st || generation !== token) { removeFile(url); return false; }
    st.phase = 'idle';
    if (!url) { st.error = 'No audio recorded. Try a longer take.'; render(); return false; }
    const result = addTake(st.takes, {t1:st.startAt,url,ms});
    st.takes = result.takes;
    if (result.replaced) {
      if (st.kept.has(result.replaced.url)) st.orphans.push(result.replaced.url);
      else removeFile(result.replaced.url);
    }
    st.error = '';
    render();
    // Replay the original preceding two seconds then insert the take.
    const from = Math.max(0, st.startAt - 2);
    if (from < st.startAt - 0.05) {
      st.awaiting = st.startAt;
      st.watchPos = null;
      try {
        st.element.currentTime = from;
        const playback = st.element.play();
        if (playback && playback.catch) playback.catch(() => playTake(st, {t1:st.startAt,url,ms}, false));
      } catch (_) { playTake(st, {t1:st.startAt,url,ms}, false); }
    } else {
      playTake(st, {t1:st.startAt,url,ms}, false);
    }
    return true;
  }

  async function playTake(st, take, resume) {
    if (session !== st || st.phase !== 'idle') return;
    const token = ++st.playToken;
    st.phase = 'playback';
    pauseMedia(st);
    render();
    let data = null;
    try { data = await loadAudio(take.url); } catch (_) {}
    if (session !== st || token !== st.playToken) return;
    const finish = () => {
      if (session !== st || token !== st.playToken) return;
      st.audio = null; st.phase = 'idle'; st.watchPos = Number(st.element.currentTime); render();
      if (resume) {
        try { const p = st.element.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
      }
    };
    if (!data) { st.error = 'Could not load the recorded take'; finish(); return; }
    const a = makeAudio(data);
    st.audio = a;
    a.addEventListener('ended', finish, {once:true});
    a.addEventListener('error', finish, {once:true});
    try {
      const p = a.play();
      if (p && p.catch) p.catch(finish);
    } catch (_) { finish(); }
  }

  function replay(t1) {
    const st = session;
    if (!st || st.phase !== 'idle') return false;
    const take = takeAt(st.takes, t1);
    if (!take) return false;
    playTake(st, take, false);
    return true;
  }

  function keep() {
    const st = session;
    if (!st || st.phase !== 'idle') return false;
    try {
      writeSaved(st.identity, st.takes.map(({t1,url,ms}) => ({t1,url,ms})));
    } catch (e) { st.error = 'Could not keep takes: ' + (e && e.message || e); render(); return false; }
    st.saved = st.takes.slice();
    st.kept = new Set(st.takes.map(t => t.url));
    st.orphans.splice(0).forEach(removeFile);
    st.error = 'Takes kept for this local file';
    render();
    return true;
  }

  function discard() {
    const st = session;
    if (!st || st.phase !== 'idle') return false;
    st.takes.filter(t => !st.kept.has(t.url)).forEach(t => removeFile(t.url));
    st.takes = st.saved.slice();
    st.orphans = [];
    st.awaiting = null; st.watchPos = null; st.error = 'Unkept takes discarded';
    render();
    return true;
  }

  function remove(t1) {
    const st = session;
    if (!st || st.phase !== 'idle') return false;
    const { takes, removed } = removeTake(st.takes, t1);
    if (!removed) return false;
    st.takes = takes;
    if (st.kept.has(removed.url)) st.orphans.push(removed.url);
    else removeFile(removed.url);
    st.awaiting = null;
    render();
    return true;
  }

  return { attach, detach:closeCurrent, start, cancel, stop, replay, keep, discard, remove, getState:snapshot };
}
