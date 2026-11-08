// Opt-in speech for *manual cards with no recorded or linked playable media*.
// Never overwrite the original card's audio fields and never synthesize over a
// YouTube/Spotify clip. The player uses this only when Settings enables it.

export function cardTtsText(value, doc = typeof document === 'undefined' ? null : document) {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  // Rich-card HTML is text for speech, not literal markup. Use an inert node
  // so entities and line breaks are pronounced naturally.
  if (doc && /<[^>]+>|&(?:\w+|#\d+);/.test(raw)) {
    const el = doc.createElement('div');
    el.innerHTML = raw.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(?:p|div|li|h[1-6])>/gi, ' ');
    el.querySelectorAll('script,style,iframe').forEach(node => node.remove());
    return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  }
  return raw.replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export function cardCanUseTts(item, { enabled = false, hasLinked = false, canSpeak = true } = {}) {
  if (!enabled || !canSpeak || !item || !item.manual || hasLinked) return false;
  // Both faces must be missing saved recordings. A legacy mediaUrl recording
  // also counts; TTS is strictly a fallback for an otherwise silent card.
  if (['sourceAudioUrl', 'targetAudioUrl', 'mediaUrl'].some(key =>
    typeof item[key] === 'string' && item[key].startsWith('file://'))) return false;
  return !!(cardTtsText(item.source) || cardTtsText(item.target));
}

export function ttsFaceSequence(faces, { enabled = false } = {}) {
  if (!enabled) return [];
  return (faces || []).filter(f => cardTtsText(f.text)).map(f => ({
    ...f, text: cardTtsText(f.text), tts: true,
  }));
}

// Promise-based wrapper around the Web Speech API (or the Cupitor native
// TtsBridge polyfill). Cancelling settles immediately so navigation cannot
// leave Player waiting on an utterance whose onend never fires.
export function speakTts(text, {
  synth, Utterance, lang = 'en-US', rate = 0.9, isCurrent = () => true,
  onBegin = () => {}, onFinish = () => {},
} = {}) {
  const words = cardTtsText(text);
  if (!words || !synth || typeof Utterance !== 'function' || !isCurrent()) {
    return { promise: Promise.resolve(false), cancel() {} };
  }
  let finish;
  const promise = new Promise(resolve => {
    let done = false;
    let timeout, poll;
    const u = new Utterance(words);
    u.lang = lang;
    u.rate = rate;
    u.volume = 1;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout); clearInterval(poll);
      u.onend = null; u.onerror = null;
      try { onFinish() } catch (_) {}
      resolve(true);
    };
    finish = end;
    u.onend = end;
    u.onerror = end;
    onBegin(u);
    // Native browsers and embedded engines can omit terminal events.
    const maxMs = Math.min(180000, Math.max(12000, words.length * 155));
    timeout = setTimeout(end, maxMs);
    poll = setInterval(() => { if (!isCurrent()) { try { synth.cancel() } catch (_) {}; end(); } }, 160);
    try { synth.speak(u) } catch (_) { end(); }
  });
  return {
    promise,
    cancel() {
      try { synth.cancel() } catch (_) {}
      finish?.();
    },
  };
}
