// Browser microphone backend for Speak Over when the Cupitor native
// AudioBridge is not present. Audio bytes live in IndexedDB on this device,
// never in playlist JSON (which holds only a webrec:// reference).
// Requires a secure origin and user-granted microphone permission.
export function browserRecordingAvailable(env = window) {
  return !!(env.navigator?.mediaDevices?.getUserMedia &&
    env.MediaRecorder && env.indexedDB);
}

export function createBrowserSpeakOverRecorder(env = window) {
  let active = null;
  let pendingStart = 0;
  let sequence = 0;
  const database = () => new Promise((resolve, reject) => {
    if (!env.indexedDB) return reject(new Error('Browser audio storage is unavailable'));
    const request = env.indexedDB.open('cupitor-speakover-audio-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('takes');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Audio storage could not open'));
  });
  async function transact(mode, operation) {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('takes', mode);
        const request = operation(tx.objectStore('takes'));
        request.onerror = () => reject(request.error || new Error('Audio storage failed'));
        tx.onerror = () => reject(tx.error || new Error('Audio storage transaction failed'));
        tx.oncomplete = () => resolve(request.result);
      });
    } finally { db.close(); }
  }
  const keyOf = url => String(url).replace(/^webrec:\/\//, '');
  const cleanup = st => {
    st.stream?.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
    st.stream = null;
  };
  const format = () => {
    const formats = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
    return formats.find(type => env.MediaRecorder.isTypeSupported?.(type)) || '';
  };
  async function start(id) {
    if (!browserRecordingAvailable(env)) throw new Error('Browser microphone recording requires HTTPS and MediaRecorder');
    if (active) throw new Error('Microphone is already recording');
    const token = ++pendingStart;
    const stream = await env.navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true, noiseSuppression: true,
    } });
    if (token !== pendingStart || active) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Recording cancelled');
    }
    const key = String(id || 'take') + '_' + (++sequence) + '_' + Date.now().toString(36);
    const url = 'webrec://' + encodeURIComponent(key);
    try {
      const type = format();
      const recorder = type ? new env.MediaRecorder(stream, { mimeType: type }) : new env.MediaRecorder(stream);
      const st = { recorder, stream, url, chunks: [], cancelled: false };
      recorder.addEventListener('dataavailable', event => {
        if (event.data?.size) st.chunks.push(event.data);
      });
      recorder.start(250);
      active = st;
      return url;
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      throw error;
    }
  }
  async function stop() {
    const st = active;
    if (!st) return null;
    active = null;
    try {
      const blob = await new Promise((resolve, reject) => {
        st.recorder.addEventListener('stop', () => resolve(new Blob(st.chunks, {
          type: st.recorder.mimeType || st.chunks[0]?.type || 'audio/webm',
        })), { once:true });
        st.recorder.addEventListener('error', event =>
          reject(event.error || new Error('Browser recording failed')), { once:true });
        try { st.recorder.stop(); } catch (error) { reject(error); }
      });
      if (!blob.size || st.cancelled) return null;
      await transact('readwrite', store => store.put(blob, keyOf(st.url)));
      return st.url;
    } finally { cleanup(st); }
  }
  async function cancel() {
    pendingStart++;
    const st = active;
    active = null;
    if (st) {
      st.cancelled = true;
      // Keep the stop event harmless; there is no file written by cancel.
      try { if (st.recorder.state !== 'inactive') st.recorder.stop(); } catch (_) {}
      cleanup(st);
    }
    return true;
  }
  async function load(url) {
    const blob = await transact('readonly', store => store.get(keyOf(url)));
    if (!blob) return null;
    return new Promise((resolve, reject) => {
      const reader = new env.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  async function remove(url) {
    await transact('readwrite', store => store.delete(keyOf(url)));
    return true;
  }
  return { start, stop, cancel, load, remove };
}
