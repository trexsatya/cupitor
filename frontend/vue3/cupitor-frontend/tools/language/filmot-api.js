// Filmot's documented API, for the "filmot" step of the language CLI.
// Never send the key in a URL, save it to disk, or expose it in logs.
// Cupitor's indexed video names provide channel candidates; getvideos resolves
// their actual UC IDs much more cheaply than a lookup for every channel name.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { findMatchWithContext } from '../../public/language/filmot-parse.js';
import { selectCandidates } from './filmot-fetch.js';

const BASE = 'https://apiv1.filmot.com/api/v1';
export const UC_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
// The primary server documentation lists 10 credits for unrestricted search;
// using the higher figure as a preflight estimate avoids unexpectedly
// exhausting an allowance if deployed API instances differ in price.
export const API_COST = { restricted: 1, unrestricted: 10, getvideos: 2 };

function json(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}
function normalized(s) { return String(s || '').trim().normalize('NFC').toLocaleLowerCase(); }

// Index names use "Channel || Title || VIDEO_ID". Count *distinct videos*
// per channel rather than records, so bilingual tracks don't double its rank.
export function channelsFromCupitorIndex(index, limit = 10, samplesPerChannel = 3) {
  const channels = new Map();
  for (const row of Array.isArray(index) ? index : []) {
    if (!/youtube/i.test(row?.source || '')) continue;
    const videoId = String(row.link || '').trim();
    const name = String(row.name || '').split(' || ')[0].trim();
    if (!VIDEO_ID.test(videoId) || name.length < 3 || name === '↗') continue;
    const key = normalized(name);
    if (!channels.has(key)) channels.set(key, { name, count: 0, videoIds: [], seen: new Set() });
    const ch = channels.get(key);
    if (ch.seen.has(videoId)) continue;
    ch.seen.add(videoId);
    ch.count++;
    if (ch.videoIds.length < samplesPerChannel) ch.videoIds.push(videoId);
  }
  return [...channels.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit))
    .map(({ name, count, videoIds }) => ({ name, count, videoIds }));
}

export function restrictedChannelGroups(channels, groupCount = 2) {
  const ids = [...new Set((channels || []).map(ch => ch.channelid || ch.channelId).filter(id => UC_ID.test(id)))];
  const out = [];
  for (let i = 0; i < ids.length && out.length < groupCount; i += 5) {
    out.push(ids.slice(i, i + 5));
  }
  return out;
}

export function apiSearchParams(term, lang, channelIds = []) {
  const params = {
    query: '"' + String(term).replace(/"/g, '').trim() + '"',
    lang,
    format: 'json',
    page: 1,
    // Raw subtitles have a lower per-page maximum; these lines provide real
    // context instead of relying on brief match snippets.
    perPageCount: 10,
    columns: 'id,title,channelid,channelname,autosubs,manualsubs,lang,hits,subtitles',
    getSnippets: 1,
    sortField: 'bm25match',
  };
  if (channelIds.length) {
    if (channelIds.length > 5 || channelIds.some(id => !UC_ID.test(id))) {
      throw new Error('Discounted searches require 1-5 valid UC channel IDs');
    }
    params.channelID = channelIds.join(',');
  }
  return params;
}

export function apiRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.result)) return response.result;
  throw new Error('Unexpected Filmot API response shape');
}

export function apiTranscriptLines(row, lang) {
  // Subtitle searches export [{s,t}], whereas getvideos returns subtitle
  // tracks [{lang,isauto,transcript:[{s,t}]}].
  let tracks = row?.subtitles;
  if (!Array.isArray(tracks)) return [];
  if (tracks.some(x => Array.isArray(x?.transcript))) {
    const relevant = tracks.filter(x => String(x.lang || '').split('-')[0] === lang);
    const first = relevant.find(x => x.isauto === 0) || relevant[0];
    tracks = first?.transcript || [];
  }
  return tracks
    .map((line, idx) => ({ idx, ts: Number(line.s ?? line.start), text: String(line.t ?? line.text ?? '').trim() }))
    .filter(line => Number.isFinite(line.ts) && line.ts >= 0 && line.text)
    .sort((a, b) => a.ts - b.ts)
    .map((line, idx) => ({ ...line, idx }));
}

function autoTrack(row, lang) {
  const langs = value => String(value || '').trim().split(/\s+/);
  if (langs(row.manualsubs).some(l => l.split('-')[0] === lang)) return false;
  return langs(row.autosubs).some(l => l.split('-')[0] === lang);
}

export function apiHit(row, word, regex, cfg) {
  const lines = apiTranscriptLines(row, cfg.lang);
  const matched = regex && findMatchWithContext(lines, regex, cfg.linesBefore, cfg.linesAfter);
  if (!matched || !VIDEO_ID.test(String(row.id || ''))) return null;
  return {
    word,
    videoId: row.id,
    title: row.title || '',
    channel: row.channelname || '',
    isAutoGenerated: autoTrack(row, cfg.lang),
    transcriptUrl: 'https://filmot.com/video/' + row.id,
    tsStart: matched.tsStart,
    tsEnd: matched.tsEnd,
    matchIdx: matched.idx,
    lines: matched.contextLines,
  };
}

export function createFilmotApiClient({
  key, cacheDir, fetchFn = fetch, delayMs = 1500,
  log = () => {},
} = {}) {
  if (!key || !String(key).trim()) throw new Error('Set FILMOT_API_KEY before running filmot --api.');
  let lastRequest = 0;
  let credits = null;
  const urlFor = (endpoint, params) => {
    const u = new URL(BASE + '/' + endpoint);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
    return u.toString();
  };
  const cachedPath = url => join(cacheDir, createHash('sha256').update(url).digest('hex') + '.json');
  const hasCached = (endpoint, params) => !!cacheDir && existsSync(cachedPath(urlFor(endpoint, params)));
  async function get(endpoint, params, { maxTries = 2 } = {}) {
    const url = urlFor(endpoint, params);
    const path = cacheDir ? cachedPath(url) : null;
    if (path && existsSync(path)) {
      const cached = json(path, null);
      if (cached != null) return cached;
    }
    for (let attempt = 0; attempt < maxTries; attempt++) {
      const wait = Math.max(0, lastRequest + delayMs - Date.now());
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      lastRequest = Date.now();
      let response;
      try {
        response = await fetchFn(url, { headers: { 'X-API-Key': key, Accept: 'application/json' } });
      } catch (e) {
        if (attempt + 1 < maxTries) continue;
        throw e;
      }
      if (response.status === 429) {
        const error = new Error('Filmot API monthly credits exhausted or rate limited (429); remaining words will be retried');
        error.quota = true;
        throw error;
      }
      if (response.status === 401 || response.status === 403) throw new Error('Filmot API key was rejected (' + response.status + ')');
      if (!response.ok) {
        if (response.status >= 500 && attempt + 1 < maxTries) continue;
        throw new Error('Filmot API ' + endpoint + ' returned HTTP ' + response.status);
      }
      const data = await response.json();
      const remaining = response.headers?.get?.('X-API-Credits-Remaining');
      if (remaining != null) credits = Number(remaining);
      log('    API ' + endpoint + ': ' + (response.headers?.get?.('X-API-Credit-Cost') || '?') +
        ' credit(s); ' + (credits == null ? 'remaining unknown' : credits + ' remaining'));
      if (path) save(path, data);
      return data;
    }
  }
  return { get, hasCached, get creditsRemaining() { return credits; } };
}

export async function resolveCupitorChannels(index, client, cachePath, { channelLimit = 10 } = {}) {
  const candidates = channelsFromCupitorIndex(index, channelLimit);
  const remembered = json(cachePath, {});
  const cache = remembered && typeof remembered === 'object' ? remembered : {};
  const unresolved = candidates.filter(ch => !UC_ID.test(cache[normalized(ch.name)]));
  const byVideo = new Map();
  for (const ch of unresolved) for (const id of ch.videoIds) byVideo.set(id, ch.name);
  const allIds = [...byVideo.keys()];
  // getvideos base mode returns channel IDs for up to 200 known video IDs,
  // at one credit. Cache the mapping for later words and runs.
  for (let i = 0; i < allIds.length; i += 200) {
    const records = apiRows(await client.get('getvideos', { id: allIds.slice(i, i + 200).join(',') }));
    for (const row of records) {
      if (!UC_ID.test(row.channelid)) continue;
      const original = byVideo.get(row.id);
      if (original && normalized(row.channelname) === normalized(original)) {
        cache[normalized(original)] = row.channelid;
      }
    }
  }
  save(cachePath, cache);
  return candidates.map(ch => ({ ...ch, channelid: cache[normalized(ch.name)] || null }));
}

// Run cheap channel-limited searches FIRST, then unrestricted queries only
// for remaining quota. A fixed per-word request budget protects API credits.
// All hits match the old filmot-hits.json structure for the existing SRT step.
export async function collectFilmotApiWord({
  word, terms, regex, cfg, channels, client, log = () => {},
}) {
  const hits = [];
  const seen = new Set();
  const groups = restrictedChannelGroups(channels, cfg.apiChannelGroups ?? 2);
  const budget = Number(cfg.apiMaxCreditsPerWord ?? 30);
  let planned = 0;
  let complete = true;

  async function scan(term, channelIds) {
    const params = apiSearchParams(term, cfg.lang, channelIds);
    const cost = client.hasCached('getsubtitlesearch', params) ? 0 :
      channelIds.length ? API_COST.restricted : API_COST.unrestricted;
    if (planned + cost > budget) { complete = false; return false; }
    planned += cost;
    const rows = apiRows(await client.get('getsubtitlesearch', params));
    const candidates = rows.map(row => ({
      row, videoId: row.id, isAutoGenerated: autoTrack(row, cfg.lang),
    }));
    const ordered = selectCandidates(candidates, {
      max: 0,
      preferManual: cfg.preferManualCaptions,
      // Discard excluded channels, but do not count any false matches.
      excludeChannels: cfg.excludeChannels || [],
      blacklistChannels: cfg.blacklistChannels || [],
      channelOf: id => rows.find(row => row.id === id)?.channelname,
    });
    for (const { row } of ordered) {
      if (hits.length >= cfg.maxItemsPerWord) break;
      if (seen.has(row.id)) continue;
      let result = apiHit(row, word, regex, cfg);
      if (!result) {
        // Some search rows have snippets but no full track; getvideos returns
        // that track when indexed. Avoid a second request when no ID exists.
        if (!VIDEO_ID.test(String(row.id || ''))) continue;
        const detailParams = { id: row.id, columns: 'subtitles', lang: cfg.lang };
        const detailCost = client.hasCached('getvideos', detailParams) ? 0 : API_COST.getvideos;
        if (planned + detailCost > budget) { complete = false; continue; }
        planned += detailCost;
        const records = apiRows(await client.get('getvideos', detailParams));
        const full = records.find(x => x.id === row.id);
        if (full) result = apiHit({ ...row, subtitles: full.subtitles }, word, regex, cfg);
      }
      if (result) {
        seen.add(result.videoId);
        hits.push(result);
        log('  ✓ ' + result.videoId + ' @ ' + result.tsStart + 's (' + (channelIds.length ? 'Cupitor channel' : 'unrestricted') + ')');
      }
    }
    return true;
  }

  // Prefer common Cupitor channels, while restricting each request to at most
  // five IDs to qualify for Filmot's discounted price.
  for (const term of terms) {
    for (const group of groups) {
      if (hits.length >= cfg.maxItemsPerWord) break;
      if (!await scan(term, group)) break;
    }
    if (hits.length >= cfg.maxItemsPerWord || !complete) break;
  }
  if (hits.length < cfg.maxItemsPerWord && cfg.apiUnrestrictedFallback !== false && complete) {
    for (const term of terms) {
      if (hits.length >= cfg.maxItemsPerWord) break;
      if (!await scan(term, [])) break;
    }
  }
  return { hits, complete, plannedCredits: planned, restrictedGroups: groups.length };
}
