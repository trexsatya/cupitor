// Local SRT file store for step 3: turn captured/translated context lines into
// SRT entries, write/merge the paired .<lang>.srt files, and keep srts/index.json
// in sync. Text logic is delegated to the shared srt-parser; this module owns the
// fs + naming glue.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  linesToSrtText,
  mergeSrtWithResolution,
  parseSrtEntries,
  srtTimeFromValue,
} from "../../public/language/srt-parser.js";
import { buildCapturedSubtitleBaseName } from "../../public/language/subtitle-naming.js";
import { commitLocalSubtitleFiles } from './bundle-store.js';

// Convert captured lines [{ts, text}] into SRT entries [{start, end, text}].
// The end of each entry is the next line's start; the last line gets defaultDur.
// `opts.texts` (optional) overrides the text per line (used for translations).
export function contextLinesToEntries(lines, opts = {}) {
  const { defaultDurSec = 3, texts = null } = opts;
  const arr = lines || [];
  return arr.map((l, i) => {
    const start = l.ts;
    const end = i + 1 < arr.length ? arr[i + 1].ts : l.ts + defaultDurSec;
    const text = texts && texts[i] != null ? texts[i] : l.text;
    return { start, end, text };
  });
}

// Upsert an index.json entry by video id (link). Returns a new array; the input
// is not mutated. Entry shape: { link, name, source }.
export function upsertIndexEntry(indexArray, { videoId, name, source = "YouTube" }) {
  const out = (indexArray || []).map((e) => ({ ...e }));
  const at = out.findIndex((e) => e.link === videoId);
  const entry = { ...(at >= 0 ? out[at] : {}), link: videoId, name, source };
  if (at >= 0) out[at] = entry;
  else out.push(entry);
  return out;
}

// Capture-specific merge: one subtitle cue per start timestamp. Overlapping
// word-context windows are common. Keep the existing line on a collision by
// default (including its translation), rather than creating two competing cues.
// An explicit 'replace' policy updates that cue; 'error' aborts the capture.
export function mergeCapturedEntries(existingText, entries, conflict = "keep") {
  if (!["keep", "replace", "error"].includes(conflict)) {
    throw new Error("srtConflict must be keep, replace, or error");
  }
  const oldByStart = new Map();
  for (const cue of parseSrtEntries(existingText)) {
    if (!oldByStart.has(cue.start)) oldByStart.set(cue.start, cue.text);
  }

  // Also deduplicate cues within the incoming context itself.
  const freshByStart = new Map();
  for (const cue of entries || []) {
    const start = srtTimeFromValue(cue.start);
    const normalized = { ...cue, start, text: String(cue.text ?? "").replace(/\r\n/g, "\n") };
    const previous = freshByStart.get(start);
    if (previous && previous.text !== normalized.text) {
      if (conflict === "error") throw new Error("Conflicting captured subtitles at " + start);
      if (conflict === "replace") freshByStart.set(start, normalized);
    } else if (!previous) freshByStart.set(start, normalized);
  }

  const resolution = new Map(), additions = [];
  for (const [start, cue] of freshByStart) {
    if (!oldByStart.has(start)) {
      additions.push(cue);
    } else if (oldByStart.get(start) !== cue.text) {
      if (conflict === "error") throw new Error("Conflicting captured subtitles at " + start);
      if (conflict === "replace") {
        resolution.set(start, { action: "use-new" });
        additions.push(cue);
      }
    }
  }
  if (!additions.length) return existingText || "";
  return existingText
    ? mergeSrtWithResolution(existingText, additions, resolution)
    : linesToSrtText(additions);
}

// --- fs glue ---------------------------------------------------------------

// Write or merge one .<langCode>.srt file for a video. Returns the path written.
export function writeSrtFile(srtsDir, baseName, langCode, entries, conflict = "keep") {
  mkdirSync(srtsDir, { recursive: true });
  const path = join(srtsDir, `${baseName}.${langCode}.srt`);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const text = mergeCapturedEntries(existing, entries, conflict);
  if (text !== existing) writeFileSync(path, text);
  return path;
}

// Missing index is valid for new stores; corrupt indexes must never be
// treated as empty because doing so would orphan existing media.
export function readIndex(srtsDir) {
  const path = join(srtsDir, "index.json");
  if (!existsSync(path)) return [];
  const arr = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(arr) || arr.some(e => !e || typeof e.link !== "string" || !e.link || typeof e.name !== "string")) {
    throw new Error("Invalid subtitle index: " + path);
  }
  return arr;
}

export function writeIndex(srtsDir, indexArray) {
  writeFileSync(join(srtsDir, "index.json"), JSON.stringify(indexArray, null, 2));
}

// High-level: persist one video hit's SV SRT (and, unless writeTarget is false,
// the translated target SRT) and update the index.
// hit: { videoId, title, channel, lines:[{ts,text}] }; translations: string[]
// aligned to hit.lines. With writeTarget:false only the source snippet is written
// (no translation) and targetPath is null. Returns { baseName, svPath, targetPath }.
export async function saveHit(srtsDir, hit, translations, {
  sourceLang, targetLang, defaultDurSec = 3, writeTarget = true, srtConflict = "keep",
} = {}) {
  if (!hit?.videoId || !Array.isArray(hit.lines) || !hit.lines.length) {
    throw new Error("A captured video must have an ID and subtitle lines");
  }
  if (writeTarget && (!Array.isArray(translations) || translations.length !== hit.lines.length)) {
    throw new Error("Each captured subtitle line needs an aligned translation");
  }
  const currentIndex = readIndex(srtsDir);
  const indexed = currentIndex.find(entry => entry.link === hit.videoId);
  const baseName = indexed?.name || buildCapturedSubtitleBaseName({
    videoId: hit.videoId,
    videoTitle: hit.title,
    channel: hit.channel,
  });
  const tracks = [{ code: sourceLang, entries: contextLinesToEntries(hit.lines, { defaultDurSec }) }];
  if (writeTarget) {
    tracks.push({ code: targetLang, entries: contextLinesToEntries(hit.lines, { defaultDurSec, texts: translations }) });
  }
  const index = upsertIndexEntry(currentIndex, { videoId: hit.videoId, name: baseName, source: "YouTube" });

  if (existsSync(join(srtsDir, "storage.json"))) {
    await commitLocalSubtitleFiles(srtsDir, [
      ...tracks.map(track => ({
        path: `${baseName}.${track.code}.srt`,
        getContent: current => mergeCapturedEntries(current, track.entries, srtConflict),
      })),
      { path: "index.json", getContent: () => JSON.stringify(index, null, 2) + "\n" },
    ]);
    const entry = readIndex(srtsDir).find(e => e.link === hit.videoId);
    return { baseName, svPath: join(srtsDir, entry.bundle), targetPath: writeTarget ? join(srtsDir, entry.bundle) : null };
  }

  // Plan *both* tracks before writing. A conflict in the translation must not
  // leave a partially updated source file behind.
  const staged = tracks.map(track => {
    const path = join(srtsDir, `${baseName}.${track.code}.srt`);
    const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
    return { path, existing, text: mergeCapturedEntries(existing, track.entries, srtConflict) };
  });
  mkdirSync(srtsDir, { recursive: true });
  for (const { path, existing, text } of staged) {
    if (existing !== text) writeFileSync(path, text);
  }
  const indexPath = join(srtsDir, "index.json");
  const nextIndexText = JSON.stringify(index, null, 2);
  if (!existsSync(indexPath) || readFileSync(indexPath, "utf8") !== nextIndexText) writeIndex(srtsDir, index);

  return { baseName, svPath: staged[0].path, targetPath: writeTarget ? staged[1].path : null };
}
