// Opt-in speech for *manual cards with no recorded or linked playable media*.
// Never overwrite the original card's audio fields and never synthesize over a
// YouTube/Spotify clip. The player uses this only when Settings enables it.

export function cardTtsText(value, doc = typeof document === 'undefined' ? null : document, { preserveLines = false } = {}) {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  // Rich-card HTML is text for speech, not literal markup. Use an inert node
  // so entities and line breaks are pronounced naturally.
  if (doc && /<[^>]+>|&(?:\w+|#\d+);/.test(raw)) {
    const el = doc.createElement('div');
    el.innerHTML = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n');
    el.querySelectorAll('script,style,iframe').forEach(node => node.remove());
    return cleanCardText(el.textContent || '', preserveLines);
  }
  return cleanCardText(raw, preserveLines);
}

function cleanCardText(text, preserveLines) {
  return text.replace(/\r\n?/g, '\n').replace(preserveLines ? /[^\S\n]+/g : /\s+/g, ' ').trim().slice(0, 4000);
}

export const DEFAULT_TTS_REPLACEMENTS = [{ from: '->', to: 'could be' }, { from: '→', to: 'could be' }];
export function cardSpeechSegments(text, { replacements = DEFAULT_TTS_REPLACEMENTS, newlinePauseMs = 700 } = {}) {
  let words = cardTtsText(text, typeof document === 'undefined' ? null : document, { preserveLines: true });
  for (const rule of Array.isArray(replacements) ? replacements : DEFAULT_TTS_REPLACEMENTS) {
    if (typeof rule?.from === 'string' && rule.from) words = words.split(rule.from).join(String(rule.to ?? ''));
  }
  const pause = Math.max(0, Math.min(10000, Number(newlinePauseMs) || 0));
  return words.split('\n').map((line, i, lines) => ({ text: line.trim(), pauseMs: i < lines.length - 1 ? pause : 0 }));
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
    ...f, text: cardTtsText(f.text, typeof document === 'undefined' ? null : document, { preserveLines: true }), tts: true,
  }));
}

// Promise-based wrapper around the Web Speech API (or the Cupitor native
// TtsBridge polyfill). Cancelling settles immediately so navigation cannot
// leave Player waiting on an utterance whose onend never fires.
export function speakTts(text, {
  synth, Utterance, lang = 'en-US', rate = 0.9, isCurrent = () => true,
  onBegin = () => {}, onFinish = () => {}, replacements, newlinePauseMs = 700,
} = {}) {
  const segments = cardSpeechSegments(text, { replacements, newlinePauseMs });
  if (!segments.some(s => s.text) || !synth || typeof Utterance !== 'function' || !isCurrent()) {
    return { promise: Promise.resolve(false), cancel() {}, pause() {}, resume() {} };
  }
  let resolve, done = false, paused = false, index = 0, utterance = null;
  let timeout = null, gapTimer = null, gapUntil = 0, gapRemaining = null;
  const promise = new Promise(r => { resolve = r; });
  const detach = () => {
    clearTimeout(timeout);
    if (utterance) { utterance.onend = null; utterance.onerror = null; utterance = null; }
  };
  const end = () => {
    if (done) return;
    done = true;
    detach(); clearTimeout(gapTimer); clearInterval(poll);
    try { onFinish() } catch (_) {}
    resolve(true);
  };
  const gap = ms => {
    gapRemaining = ms; gapUntil = Date.now() + ms;
    gapTimer = setTimeout(() => { gapRemaining = null; index++; next(); }, ms);
  };
  const next = () => {
    if (done || paused) return;
    if (!isCurrent()) { cancel(); return; }
    if (index >= segments.length) { end(); return; }
    const segment = segments[index];
    const complete = () => {
      if (done || paused) return;
      detach();
      if (segment.pauseMs) gap(segment.pauseMs);
      else { index++; next(); }
    };
    if (!segment.text) { complete(); return; }
    const u = new Utterance(segment.text);
    utterance = u;
    u.lang = lang; u.rate = rate; u.volume = 1;
    u.onend = complete; u.onerror = complete;
    onBegin(u);
    timeout = setTimeout(complete, Math.min(180000, Math.max(12000, segment.text.length * 155)));
    try { synth.speak(u) } catch (_) { complete(); }
  };
  function cancel() {
    if (done) return;
    detach();
    try { synth.cancel() } catch (_) {}
    end();
  }
  const poll = setInterval(() => { if (!isCurrent()) cancel(); }, 160);
  const task = {
    promise, cancel,
    pause() {
      if (done || paused) return;
      paused = true;
      if (gapRemaining !== null) {
        gapRemaining = Math.max(0, gapUntil - Date.now()); clearTimeout(gapTimer);
      }
      // Embedded speech engines do not reliably resume a paused utterance.
      // Restart only the current line on restore; completed lines stay done.
      detach();
      try { synth.cancel() } catch (_) {}
    },
    resume() {
      if (done || !paused) return;
      paused = false;
      if (gapRemaining !== null) gap(gapRemaining);
      else next();
    },
  };
  next();
  return task;
}
