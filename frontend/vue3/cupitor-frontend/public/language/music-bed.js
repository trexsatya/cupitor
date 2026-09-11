// The background-music "bed" that plays under a playlist: which tracks are
// saved, which one is chosen, when it is allowed to sound, and how loud.
//
// Pure functions over the settings object — no player, no DOM — so the rules
// can be tested directly. The player itself lives in language.js.

import { parseMediaUrl } from './recordings-merge.js';

// When the music is allowed to sound:
//   'item'    — only while a recording (or the spoken word) is sounding
//   'gap'     — only during the pauses, so it fills silence instead of
//               sitting on top of the pronunciation
//   'nonstop' — throughout, standing aside only for a video clip
export const MUSIC_MODES = ['item', 'gap', 'nonstop'];

// A library, not an archive. The picker is a single select on a phone.
export const MUSIC_TRACKS_MAX = 50;

// Volume defaults differ by role on purpose: under speech the music is there
// to be felt rather than heard, while in a silent gap it can carry.
export const MUSIC_VOL_WITH_AUDIO = 15;
export const MUSIC_VOL_IN_GAPS = 40;

// Only YouTube: this rides the IFrame API, the one player that can be held
// invisible and still controlled.
export function musicVideoIdFromUrl(raw) {
  const m = parseMediaUrl(String(raw == null ? '' : raw).trim());
  return (m && m.kind === 'youtube' && m.id) ? m.id : '';
}

// Drop anything unusable and collapse duplicates, keyed on the video id — the
// same track pasted twice with different URL forms (youtu.be vs watch?v=) is
// one track. A track always ends up with a non-empty name so the picker can
// never render a blank row.
export function normalizeMusicTracks(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const t of raw) {
    if (!t) continue;
    const id = String(t.id == null ? '' : t.id).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      url: String(t.url == null ? '' : t.url).trim(),
      name: String(t.name == null ? '' : t.name).trim() || id,
    });
    if (out.length >= MUSIC_TRACKS_MAX) break;
  }
  return out;
}

export function musicMode(settings) {
  const v = String((settings && settings.recMusicMode) || 'gap');
  return MUSIC_MODES.indexOf(v) >= 0 ? v : 'gap';
}

export function musicTracks(settings) {
  return normalizeMusicTracks(settings && settings.recMusicTracks);
}

// The chosen track's id, or '' when nothing usable is chosen. Falls back to the
// first track rather than going silent when the stored selection has been
// deleted — a library with something in it should play something.
export function musicSelectedId(settings) {
  const list = musicTracks(settings);
  if (!list.length) return '';
  const want = String((settings && settings.recMusicSelected) || '').trim();
  return list.some(t => t.id === want) ? want : list[0].id;
}

export function musicSelectedTrack(settings) {
  const id = musicSelectedId(settings);
  return musicTracks(settings).find(t => t.id === id) || null;
}

// Which volume applies right now. 'clip' is the only phase where something
// else is sounding, so it is the only one that gets the quiet level.
export function musicVolumeFor(settings, phase) {
  const read = (v, dflt) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : dflt;
  };
  return phase === 'clip'
    ? read(settings && settings.recMusicVolume, MUSIC_VOL_WITH_AUDIO)
    : read(settings && settings.recMusicGapVolume, MUSIC_VOL_IN_GAPS);
}

// Which volume controls the panel should offer. Only 'nonstop' can be in both
// situations, so only 'nonstop' needs both sliders.
export function musicVolumeFieldsFor(mode) {
  if (mode === 'item') return ['withAudio'];
  if (mode === 'gap') return ['inGaps'];
  return ['withAudio', 'inGaps'];
}

// The one decision: should the bed be sounding right now?
export function musicShouldPlay(state) {
  const s = state || {};
  if (!s.hasTrack || s.errored) return false;
  // Hushed by hand from the panel. Deliberately above everything else: it is
  // the one answer that does not depend on the mode, the phase, or whether a
  // playlist is running — someone who asked for quiet wants quiet.
  if (s.hushed) return false;
  if (!s.playing || s.paused) return false;
  // A captured clip brings its own audio; the bed stands aside for it.
  if (s.phase === 'video') return false;
  const mode = MUSIC_MODES.indexOf(s.mode) >= 0 ? s.mode : 'gap';
  if (mode === 'nonstop') return true;
  if (mode === 'item') return s.phase === 'clip';
  return s.phase === 'gap';
}

// Add a URL to the library. Returns the new list plus what happened, so the
// caller can report "already saved" differently from "that isn't a YouTube
// link" without re-deriving either.
export function addMusicTrack(tracks, url, name) {
  const list = normalizeMusicTracks(tracks);
  const id = musicVideoIdFromUrl(url);
  if (!id) return { tracks: list, id: '', added: false, reason: 'not-youtube' };
  const existing = list.find(t => t.id === id);
  if (existing) {
    // A second paste with a name is how a track gets renamed, so honour it
    // rather than treating the whole call as a no-op.
    const nm = String(name == null ? '' : name).trim();
    if (nm) existing.name = nm;
    return { tracks: list, id, added: false, reason: 'duplicate' };
  }
  if (list.length >= MUSIC_TRACKS_MAX) {
    return { tracks: list, id: '', added: false, reason: 'full' };
  }
  list.push({
    id,
    url: String(url == null ? '' : url).trim(),
    name: String(name == null ? '' : name).trim() || id,
  });
  return { tracks: list, id, added: true, reason: '' };
}

export function removeMusicTrack(tracks, id) {
  const want = String(id == null ? '' : id);
  return normalizeMusicTracks(tracks).filter(t => t.id !== want);
}


