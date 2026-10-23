// Local SRT file store for step 3: turn captured/translated context lines into
// SRT entries, write/merge the paired .<lang>.srt files, and keep srts/index.json
// in sync. Text logic is delegated to the shared srt-parser; this module owns the
// fs + naming glue.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  linesToSrtText,
  mergeSrtWithNewEntries,
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

// --- fs glue ---------------------------------------------------------------

function readTextOr(path, fallback = "") {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    return fallback;
  }
}

// Write or merge one .<langCode>.srt file for a video. Returns the path written.
export function writeSrtFile(srtsDir, baseName, langCode, entries) {
  mkdirSync(srtsDir, { recursive: true });
  const path = join(srtsDir, `${baseName}.${langCode}.srt`);
  const existing = existsSync(path) ? readTextOr(path) : "";
  const text = existing
    ? mergeSrtWithNewEntries(existing, entries)
    : linesToSrtText(entries);
  writeFileSync(path, text);
  return path;
}

// Read the srts/index.json array (empty array if missing/broken).
export function readIndex(srtsDir) {
  try {
    const arr = JSON.parse(readTextOr(join(srtsDir, "index.json"), "[]"));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

export function writeIndex(srtsDir, indexArray) {
  writeFileSync(join(srtsDir, "index.json"), JSON.stringify(indexArray, null, 2));
}

// High-level: persist one video hit's SV SRT (and, unless writeTarget is false,
// the translated target SRT) and update the index.
// hit: { videoId, title, channel, lines:[{ts,text}] }; translations: string[]
// aligned to hit.lines. With writeTarget:false only the source snippet is written
// (no translation) and targetPath is null. Returns { baseName, svPath, targetPath }.
export async function saveHit(srtsDir, hit, translations, { sourceLang, targetLang, defaultDurSec = 3, writeTarget = true } = {}) {
  const currentIndex = readIndex(srtsDir);
  const indexed = currentIndex.find(entry => entry.link === hit.videoId);
  const baseName = indexed?.name || buildCapturedSubtitleBaseName({
    videoId: hit.videoId,
    videoTitle: hit.title,
    channel: hit.channel,
  });
  const svEntries = contextLinesToEntries(hit.lines, { defaultDurSec });
  if (existsSync(join(srtsDir, 'storage.json'))) {
    const tracks = [{ code: sourceLang, entries: svEntries }];
    if (writeTarget) tracks.push({ code: targetLang, entries: contextLinesToEntries(hit.lines, { defaultDurSec, texts: translations }) });
    await commitLocalSubtitleFiles(srtsDir, [
      ...tracks.map(track => ({ path: `${baseName}.${track.code}.srt`, getContent: current => current ? mergeSrtWithNewEntries(current, track.entries) : linesToSrtText(track.entries) })),
      { path: 'index.json', getContent: current => JSON.stringify(upsertIndexEntry(JSON.parse(current || '[]'), { videoId: hit.videoId, name: baseName, source: 'YouTube' }), null, 2) + '\n' },
    ]);
    const entry = readIndex(srtsDir).find(entry => entry.link === hit.videoId);
    return { baseName, svPath: join(srtsDir, entry.bundle), targetPath: writeTarget ? join(srtsDir, entry.bundle) : null };
  }
  const svPath = writeSrtFile(srtsDir, baseName, sourceLang, svEntries);
  let targetPath = null;
  if (writeTarget) {
    const tgtEntries = contextLinesToEntries(hit.lines, { defaultDurSec, texts: translations });
    targetPath = writeSrtFile(srtsDir, baseName, targetLang, tgtEntries);
  }

  const index = upsertIndexEntry(readIndex(srtsDir), {
    videoId: hit.videoId,
    name: baseName,
    source: "YouTube",
  });
  writeIndex(srtsDir, index);

  return { baseName, svPath, targetPath };
}
