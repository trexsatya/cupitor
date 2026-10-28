import { createLocalSpeakOver, localSpeakOverIdentity } from './local-speakover';

class Media {
  constructor(time = 0) {
    this.currentTime = time;
    this.paused = false;
    this.listeners = {};
    this.playCount = 0;
    this.pauseCount = 0;
  }
  addEventListener(name, cb) {
    if (!this.listeners[name]) this.listeners[name] = new Set();
    this.listeners[name].add(cb);
  }
  removeEventListener(name, cb) { if (this.listeners[name]) this.listeners[name].delete(cb); }
  emit(name) { for (const cb of this.listeners[name] || []) cb(); }
  pause() { this.paused = true; this.pauseCount++; }
  play() { this.paused = false; this.playCount++; return Promise.resolve(); }
}

const file = (name = 'lesson.mp3', size = 4096, lastModified = 9000) =>
  ({name, size, lastModified});

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function harness() {
  const saved = {};
  const deleted = [];
  const recorded = [];
  const recordings = ['file:///local-take-1.m4a','file:///local-take-2.m4a'];
  const audios = [];
  let now = 10000;
  let permission = 'granted';
  let cancelCalls = 0;
  let resolveStart;
  let deferStart = false;
  const controller = createLocalSpeakOver({
    permission: async () => permission,
    startRecording: async id => {
      recorded.push(id);
      if (deferStart) return new Promise(resolve => { resolveStart = resolve; });
      return recordings[recorded.length - 1];
    },
    stopRecording: async () => recordings[recorded.length - 1],
    cancelRecording: async () => { cancelCalls++; },
    loadAudio: async () => 'data:audio/mp4;base64,AAAA',
    deleteAudio: async url => { deleted.push(url); },
    readSaved: id => saved[id] || [],
    writeSaved: (id, takes) => { saved[id] = takes; },
    makeAudio: () => {
      const audio = new Media();
      audios.push(audio);
      return audio;
    },
    now: () => now,
  });
  return {
    controller, saved, deleted, recorded, audios,
    setNow: n => { now = n; },
    deny: () => { permission = 'denied'; },
    defer: () => { deferStart = true; },
    resolve: url => resolveStart(url),
    cancelled: () => cancelCalls,
  };
}

describe('Speak Over for local media', () => {
  test('identity requires the same file, not merely a matching basename', () => {
    expect(localSpeakOverIdentity(file())).toBe(localSpeakOverIdentity(file()));
    expect(localSpeakOverIdentity(file('lesson.mp3', 9))).not.toBe(localSpeakOverIdentity(file()));
    expect(localSpeakOverIdentity(file('other.mp3'))).not.toBe(localSpeakOverIdentity(file()));
    expect(localSpeakOverIdentity(null)).toBe('');
  });

  test('pauses MP3, records at its timestamp, replays original and take, then resumes', async () => {
    const h = harness();
    const media = new Media(8);
    h.controller.attach(file(), media);
    expect(await h.controller.start()).toBe(true);
    expect(media.paused).toBe(true);
    expect(h.controller.getState().phase).toBe('recording');
    h.setNow(11500);
    expect(await h.controller.stop()).toBe(true);
    expect(h.controller.getState().takes).toEqual([
      {t1:8, url:'file:///local-take-1.m4a', ms:1500},
    ]);
    expect(media.currentTime).toBe(6);
    expect(media.paused).toBe(false);
    media.currentTime = 7.8; media.emit('timeupdate');
    media.currentTime = 8.1; media.emit('timeupdate');
    await flush();
    expect(h.controller.getState().phase).toBe('playback');
    expect(media.paused).toBe(true);
    expect(h.audios).toHaveLength(1);
    h.audios[0].emit('ended');
    expect(h.controller.getState().phase).toBe('idle');
    expect(media.paused).toBe(false);
    expect(media.playCount).toBe(2);
  });

  test('a take stamped at zero replays when the file is played again', async () => {
    const h = harness();
    const media = new Media(0);
    const id = localSpeakOverIdentity(file());
    h.saved[id] = [{t1:0,url:'file:///beginning.m4a',ms:500}];
    h.controller.attach(file(), media);
    media.play();
    media.emit('play');
    media.currentTime = 0.2;
    media.emit('timeupdate');
    await flush();
    expect(h.controller.getState().phase).toBe('playback');
    expect(h.audios).toHaveLength(1);
    h.audios[0].emit('ended');
    expect(media.paused).toBe(false);
  });

  test('saved takes return when re-selecting the exact same local file', async () => {
    const h = harness();
    const media = new Media(5);
    h.controller.attach(file(), media);
    await h.controller.start();
    h.setNow(11000);
    await h.controller.stop();
    await flush();
    expect(h.controller.getState().dirty).toBe(true);
    expect(h.controller.keep()).toBe(true);
    expect(h.controller.getState().dirty).toBe(false);
    h.controller.detach();
    h.controller.attach(file(), new Media());
    expect(h.controller.getState().takes).toHaveLength(1);
    h.controller.attach(file('lesson.mp3', 4097), new Media());
    expect(h.controller.getState().takes).toHaveLength(0);
    expect(h.deleted).toHaveLength(0);
  });

  test('discarding unkept takes preserves already kept ones', async () => {
    const h = harness();
    h.saved[localSpeakOverIdentity(file())] = [{t1:2,url:'file:///saved.m4a',ms:500}];
    const media = new Media(8);
    h.controller.attach(file(), media);
    await h.controller.start(); h.setNow(11300); await h.controller.stop(); await flush();
    expect(h.controller.getState().takes).toHaveLength(2);
    expect(h.controller.discard()).toBe(true);
    expect(h.controller.getState().takes).toEqual([{t1:2,url:'file:///saved.m4a',ms:500}]);
    expect(h.deleted).toContain('file:///local-take-1.m4a');
    expect(h.deleted).not.toContain('file:///saved.m4a');
  });

  test('denied permission never starts recording', async () => {
    const h = harness();
    const media = new Media(4);
    h.controller.attach(file(), media);
    h.deny();
    expect(await h.controller.start()).toBe(false);
    expect(h.recorded).toHaveLength(0);
    expect(h.controller.getState().phase).toBe('idle');
    expect(h.controller.getState().error).toMatch(/permission/i);
  });

  test('changing media during microphone start cancels and drops stale recording', async () => {
    const h = harness();
    const media = new Media(1);
    h.defer();
    h.controller.attach(file(), media);
    const starting = h.controller.start();
    await flush();
    expect(h.controller.getState().phase).toBe('starting');
    h.controller.attach(file('other.mp3'), new Media());
    expect(h.cancelled()).toBe(1);
    h.resolve('file:///stale.m4a');
    expect(await starting).toBe(false);
    await flush();
    expect(h.deleted).toContain('file:///stale.m4a');
    expect(h.controller.getState().filename).toBe('other.mp3');
    expect(h.controller.getState().takes).toHaveLength(0);
  });

  test('deleting a kept take needs Keep to permanently remove the backing audio', async () => {
    const h = harness();
    const id = localSpeakOverIdentity(file());
    h.saved[id] = [{t1:2,url:'file:///saved.m4a',ms:500}];
    h.controller.attach(file(), new Media());
    expect(h.controller.remove(2)).toBe(true);
    expect(h.controller.getState().dirty).toBe(true);
    expect(h.deleted).not.toContain('file:///saved.m4a');
    expect(h.controller.keep()).toBe(true);
    await flush();
    expect(h.saved[id]).toEqual([]);
    expect(h.deleted).toContain('file:///saved.m4a');
  });
});
