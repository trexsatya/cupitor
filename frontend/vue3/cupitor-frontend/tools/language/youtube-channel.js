// Resolve videoId -> channel name via YouTube's public oembed endpoint (filmot
// pages carry no channel name). Cached to disk so channel exclusion is cheap
// across runs. Pure parse/URL helpers are unit-tested; the fetch is a thin shell.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function buildOembedUrl(videoId) {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`;
}

export function parseOembedChannel(json) {
  return json && json.author_name ? String(json.author_name) : "";
}

export function loadChannelCache(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8")) || {};
  } catch (e) {
    return {};
  }
}

export function saveChannelCache(path, cache) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2));
}

// Resolve one video's channel, consulting/updating `cache` (a plain object).
// Returns '' when the lookup fails (video private/deleted). Never throws.
export async function resolveChannel(videoId, opts = {}) {
  const { cache = {}, fetchFn = fetch } = opts;
  if (Object.prototype.hasOwnProperty.call(cache, videoId)) return cache[videoId];
  try {
    const res = await fetchFn(buildOembedUrl(videoId), {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) {
      cache[videoId] = "";
      return "";
    }
    const channel = parseOembedChannel(await res.json());
    cache[videoId] = channel;
    return channel;
  } catch (e) {
    cache[videoId] = "";
    return "";
  }
}
