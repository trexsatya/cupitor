#!/usr/bin/env node
// "Manage" CLI for the Swedish study data. Three independently-runnable,
// chunkable/resumable steps:
//   rare   : vocabulary.txt + local srts   -> out/rare-words.json
//   filmot : rare-words.json + live filmot -> out/filmot-hits.json     (chunk by word)
//   srt    : filmot-hits.json + translate  -> srts/*.srt + index.json   (chunk by video)
//
// Usage:
//   node tools/language/lang-manage.js rare       [--threshold N] [--category "<name>"] [--config path]
//   node tools/language/lang-manage.js categories                       (list vocab categories + counts)
//   node tools/language/lang-manage.js filmot     [--chunk N] [--max N] [--before N] [--after N] [--words a,b] [--category "<name>"] [--browser] [--reset]
//   node tools/language/lang-manage.js srt        [--chunk N] [--category "<name>"] [--no-translate] [--reset]
//   node tools/language/lang-manage.js prune       [--minSpan N] [--window N] [--apply]  (shrink full-video transcripts to windows around items found only there)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { parseVocabularyFile } from "../../public/language/vocab-merge.js";
import { buildExpansionMap, expandWords } from "../../public/language/vocab-expand.js";
import {
  flattenVocabEntries,
  findRareWords,
  buildRareWordRegex,
  expandedAlternatives,
} from "../../public/language/rare-words.js";
import { cleanSrtForMatch } from "../../public/language/search-text.js";
import { parseSearchResults, parseTranscript, findMatchWithContext } from "../../public/language/filmot-parse.js";

import { parseArgs, coerceFlags, matchCategory, mergeRareByCategory } from "./args.js";
import { loadConfig } from "./config.js";
import { selectChunk, progressSummary, loadProgress, markDone } from "./progress.js";
import {
  buildSearchUrl,
  selectCandidates,
  fetchPage,
  searchTermsForWord,
  isChallengePage,
} from "./filmot-fetch.js";
import { collectRankedPool } from "./filmot-collect.js";
import { resolveChannel, loadChannelCache, saveChannelCache } from "./youtube-channel.js";
import { translateBatch } from "./google-translate.js";
import { saveHit, readIndex, writeIndex } from "./srt-store.js";
import {
  isFullSrt,
  scanUncoveredOwners,
  greedyCover,
  srtKeepRanges,
  mergeRanges,
  applyRanges,
} from "./srt-prune.js";

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return fallback;
  }
}
function writeJson(path, data) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
const log = (...a) => console.log(...a);

// --- step 1: rare words ----------------------------------------------------

function loadLocalSubtitles(srtsDir) {
  const files = readdirSync(srtsDir).filter((f) => /\.(\w{2,3})\.srt$/.test(f));
  const byBase = new Map();
  for (const f of files) {
    const m = f.match(/^(.*)\.(\w{2,3})\.srt$/);
    if (!m) continue;
    const [, base, lang] = m;
    if (!byBase.has(base)) byBase.set(base, {});
    const raw = readFileSync(join(srtsDir, f), "utf8");
    byBase.get(base)[lang] = cleanSrtForMatch(raw);
  }
  return [...byBase.values()].map((s) => ({ sv: s.sv || "", en: s.en || "" }));
}

function cmdRare(cfg) {
  const vocabText = readFileSync(join(cfg.dataDir, "vocabulary.txt"), "utf8");
  const vocabulary = parseVocabularyFile(vocabText);
  const expansionMap = buildExpansionMap(vocabulary);
  let entries = flattenVocabEntries(vocabulary);
  // Optionally scan only one vocabulary category (fewer entries → faster). The
  // results are merged back into rare-words.json, not written over it.
  if (cfg.category) {
    entries = entries.filter((e) => matchCategory(e.category, cfg.category));
    log(`Category "${cfg.category}": ${entries.length} vocab line(s) in scope.`);
    if (!entries.length) {
      log(`No vocab lines match category "${cfg.category}".`);
      return;
    }
  }
  log(`Loaded ${entries.length} vocab lines; scanning local subtitles…`);
  const subs = loadLocalSubtitles(cfg.srtsDir);
  log(`Scanning against ${subs.length} subtitle files (threshold < ${cfg.rareThreshold})…`);
  const expand = (line) => expandWords(line, cfg.lang, expansionMap);
  // Per-alternative rarity: judge each expanded `|`-alternative on its own, so a
  // rare idiom bundled with common synonyms in one vocab line isn't masked.
  const fresh = findRareWords(entries, subs, cfg.rareThreshold, { expand, perAlternative: true });
  const outPath = join(cfg.outDir, "rare-words.json");
  const out = cfg.category
    ? mergeRareByCategory(readJson(outPath, []), fresh, cfg.category)
    : fresh;
  writeJson(outPath, out);
  const scope = cfg.category ? ` for "${cfg.category}" (${out.length} total in file)` : "";
  log(`Found ${fresh.length} rare word(s)${scope}. Wrote ${outPath}`);
}

// --- step 2: filmot --------------------------------------------------------

// Fetch transcripts for ordered candidates and push confirmed regex matches into
// ctx.wordHits until the per-word quota is reached. Shared by both capture paths.
async function captureCandidates(ordered, ctx) {
  const { word, regex, cfg, channelCache, getPage, wordHits, seen } = ctx;
  for (const card of ordered) {
    if (wordHits.length >= cfg.maxItemsPerWord) break;
    if (seen.has(card.videoId)) continue;
    seen.add(card.videoId);
    const channel =
      channelCache[card.videoId] != null
        ? channelCache[card.videoId]
        : await resolveChannel(card.videoId, { cache: channelCache });
    const tHtml = await getPage(card.transcriptUrl);
    const { lines } = parseTranscript(tHtml);
    const m = regex ? findMatchWithContext(lines, regex, cfg.linesBefore, cfg.linesAfter) : null;
    if (!m) {
      log(`  · ${card.videoId} (${card.isAutoGenerated ? "auto" : "manual"}) — no match`);
      continue;
    }
    wordHits.push({
      word,
      videoId: card.videoId,
      title: card.title,
      channel,
      isAutoGenerated: card.isAutoGenerated,
      transcriptUrl: card.transcriptUrl,
      tsStart: m.tsStart,
      tsEnd: m.tsEnd,
      matchIdx: m.idx,
      lines: m.contextLines,
    });
    log(`  ✓ ${card.videoId} (${card.isAutoGenerated ? "auto" : "manual"}) @ ${m.tsStart}s`);
  }
}

async function cmdFilmot(cfg) {
  const rare = readJson(join(cfg.outDir, "rare-words.json"), null);
  if (!rare) throw new Error("Run `rare` first — out/rare-words.json not found.");
  const byLine = new Map(rare.map((r) => [r.line, r]));
  // Optionally scope to a vocabulary category (progress stays global by word).
  const pool = rare.filter((r) => matchCategory(r.category, cfg.category));
  const allWords = pool.map((r) => r.line);
  if (cfg.category && !allWords.length) {
    log(`No rare words match category "${cfg.category}". Try: lang-manage categories`);
    return;
  }

  const progressPath = join(cfg.outDir, "filmot-progress.json");
  if (cfg.reset && existsSync(progressPath)) writeJson(progressPath, { doneKeys: [] });
  const done = loadProgress(progressPath).doneKeys;

  const words = cfg.words && cfg.words.length
    ? cfg.words
    : selectChunk(allWords, done, cfg.chunk || cfg.chunkFilmot);
  const summary = progressSummary(allWords, done);
  const scope = cfg.category ? ` [${cfg.category}]` : "";
  log(`filmot${scope}: ${summary.done}/${summary.total} done; processing ${words.length} this run.`);

  const hitsPath = join(cfg.outDir, "filmot-hits.json");
  const hits = readJson(hitsPath, {});
  const cacheDir = join(cfg.outDir, "filmot-cache");
  const channelCachePath = join(cfg.outDir, "channel-cache.json");
  const channelCache = loadChannelCache(channelCachePath);
  const excludeChannels = cfg.excludeChannels || [];
  const blacklistChannels = cfg.blacklistChannels || [];

  // Build a page fetcher: a real browser (recommended — filmot fingerprints
  // plain HTTP even with a login cookie) or raw HTTP with a pasted cookie.
  const useBrowser = cfg.filmotMode === "browser";
  let fetcher;
  if (useBrowser) {
    const { openFilmotSession } = await import("./filmot-browser.js");
    log(`Opening filmot in a browser (${cfg.browserHeadless ? "headless" : "headed"}, session in ${cfg.browserUserDataDir})…`);
    fetcher = await openFilmotSession({
      userDataDir: cfg.browserUserDataDir,
      headless: cfg.browserHeadless,
      delayMs: cfg.filmotDelayMs,
      cookie: cfg.filmotCookie || process.env.FILMOT_COOKIE || "",
      userAgent: cfg.userAgent || undefined,
    });
  } else {
    const cookie = cfg.filmotCookie || process.env.FILMOT_COOKIE || "";
    if (!cookie) log('  (http mode with no filmotCookie — filmot will show its captcha wall. Set filmotMode:"browser".)');
    fetcher = {
      getPage: (url) =>
        fetchPage(url, { cacheDir, delayMs: cfg.filmotDelayMs, cookie, userAgent: cfg.userAgent || undefined }),
      close: async () => {},
    };
  }
  // Fetch + fail fast on filmot's "Verify You're Human" page.
  const getPage = async (url) => {
    const html = await fetcher.getPage(url);
    if (isChallengePage(html)) {
      const e = new Error("filmot captcha wall");
      e.captcha = true;
      throw e;
    }
    return html;
  };

  try {
  for (const word of words) {
    const entry = byLine.get(word);
    const expanded = entry ? entry.expanded : expandWords(word, cfg.lang);
    const regex = buildRareWordRegex(expanded);
    const terms = searchTermsForWord(expanded);
    log(`\n▶ "${word}"  → search: ${terms.join(" | ")}`);
    try {
      const seen = new Set();
      const wordHits = [];
      const capCtx = { word, regex, cfg, channelCache, getPage, wordHits, seen };
      if (blacklistChannels.length) {
        // Blacklist set: pool candidates across alternatives/pages (paging only
        // while non-blacklisted ones are insufficient), rank once, then capture.
        const ranked = await collectRankedPool({
          terms,
          cfg,
          getPage,
          channelCache,
          excludeChannels,
          blacklistChannels,
          log,
        });
        await captureCandidates(ranked, capCtx);
      } else {
        // No blacklist: legacy interleaved per-term loop (page 1 only per
        // alternative), aggregating unique videos up to the per-word quota
        // (auto-generated only fills what manual didn't).
        for (const term of terms) {
          if (wordHits.length >= cfg.maxItemsPerWord) break;
          const searchHtml = await getPage(buildSearchUrl(term, cfg.lang));
          const cards = parseSearchResults(searchHtml).filter((c) => !seen.has(c.videoId));
          if (excludeChannels.length) {
            for (const c of cards) await resolveChannel(c.videoId, { cache: channelCache });
          }
          const chosen = selectCandidates(cards, {
            max: cfg.maxItemsPerWord - wordHits.length,
            excludeChannels,
            channelOf: (id) => channelCache[id],
            preferManual: cfg.preferManualCaptions,
          });
          log(`  "${term}": ${cards.length} new results → ${chosen.length} candidate(s)`);
          await captureCandidates(chosen, capCtx);
        }
      }
      hits[word] = wordHits;
      writeJson(hitsPath, hits);
      saveChannelCache(channelCachePath, channelCache);
      markDone(progressPath, word);
      log(`  → ${wordHits.length} hit(s)`);
    } catch (e) {
      if (e && e.captcha) {
        log(`\n⛔ filmot returned its "Verify You're Human" page.`);
        if (useBrowser) {
          log(`   Your filmotCookie looks missing/expired. Copy a FRESH Cookie header (and matching`);
          log(`   User-Agent) from a browser where you're logged into filmot into config.json, then re-run.`);
        } else {
          log(`   http mode can't pass filmot's bot check even with a cookie. Set filmotMode:"browser"`);
          log(`   (npm i playwright && npx playwright install chromium), then re-run.`);
        }
        log(`   Progress was NOT advanced for "${word}" (already-done words are kept).`);
        saveChannelCache(channelCachePath, channelCache);
        return;
      }
      log(`  ! failed for "${word}": ${e.message} (will retry next run)`);
    }
  }
  } finally {
    await fetcher.close();
  }
  const after = progressSummary(allWords, loadProgress(progressPath).doneKeys);
  log(`\nfilmot: ${after.done}/${after.total} done. Wrote ${hitsPath}`);
}

// --- step 3: srt -----------------------------------------------------------

async function cmdSrt(cfg) {
  const hits = readJson(join(cfg.outDir, "filmot-hits.json"), null);
  if (!hits) throw new Error("Run `filmot` first — out/filmot-hits.json not found.");
  // word -> category (for optional --category scoping).
  const catOf = new Map(
    (readJson(join(cfg.outDir, "rare-words.json"), []) || []).map((r) => [r.line, r.category])
  );
  const flat = [];
  for (const [word, arr] of Object.entries(hits)) {
    if (!matchCategory(catOf.get(word), cfg.category)) continue;
    for (const hit of arr || []) flat.push({ key: `${word}::${hit.videoId}`, hit });
  }
  const allKeys = flat.map((f) => f.key);

  const progressPath = join(cfg.outDir, "srt-progress.json");
  if (cfg.reset && existsSync(progressPath)) writeJson(progressPath, { doneKeys: [] });
  const done = loadProgress(progressPath).doneKeys;
  const keys = selectChunk(allKeys, done, cfg.chunk || cfg.chunkSrt);
  const summary = progressSummary(allKeys, done);
  log(`srt: ${summary.done}/${summary.total} done; processing ${keys.length} this run.`);

  const translate = !cfg.skipTranslate;
  if (!translate) log(`  (--no-translate: writing source .${cfg.lang}.srt snippets only)`);
  const chosen = flat.filter((f) => keys.includes(f.key));
  for (const { key, hit } of chosen) {
    try {
      const translations = translate
        ? await translateBatch(hit.lines.map((l) => l.text), cfg.lang, cfg.targetLang, {
            delayMs: cfg.translateDelayMs,
          })
        : null;
      const { baseName } = saveHit(cfg.srtsDir, hit, translations, {
        sourceLang: cfg.lang,
        targetLang: cfg.targetLang,
        defaultDurSec: cfg.defaultDurSec,
        writeTarget: translate,
      });
      markDone(progressPath, key);
      log(`  ✓ ${baseName}`);
    } catch (e) {
      log(`  ! failed for ${key}: ${e.message} (will retry next run)`);
    }
  }
  const after = progressSummary(allKeys, loadProgress(progressPath).doneKeys);
  log(`\nsrt: ${after.done}/${after.total} done. Updated ${join(cfg.srtsDir, "index.json")}`);
}

// --- categories: list vocab categories present in rare-words.json ----------

function cmdCategories(cfg) {
  const rare = readJson(join(cfg.outDir, "rare-words.json"), null);
  if (!rare) throw new Error("Run `rare` first — out/rare-words.json not found.");
  const counts = new Map();
  for (const r of rare) counts.set(r.category, (counts.get(r.category) || 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  log(`${rare.length} rare words across ${rows.length} categories (count  category):\n`);
  for (const [cat, n] of rows) log(`  ${String(n).padStart(4)}  ${cat}`);
  log(`\nScope a run with:  --category "<name or substring>"`);
}

// --- prune: drop redundant full-video transcripts -------------------------

// Load subtitle file-sets grouped by base name (channel || title || id), keeping
// the raw text (for the timespan test) and per-lang filenames (for deletion).
function loadSrtDocs(srtsDir) {
  const files = readdirSync(srtsDir).filter((f) => /\.(\w{2,3})\.srt$/.test(f));
  const byBase = new Map();
  for (const f of files) {
    const m = f.match(/^(.*)\.(\w{2,3})\.srt$/);
    if (!m) continue;
    const [, base, lang] = m;
    if (!byBase.has(base)) byBase.set(base, { name: base, raw: {}, files: {} });
    const rec = byBase.get(base);
    rec.raw[lang] = readFileSync(join(srtsDir, f), "utf8");
    rec.files[lang] = f;
  }
  return [...byBase.values()];
}

async function cmdPrune(cfg) {
  const vocabulary = parseVocabularyFile(readFileSync(join(cfg.dataDir, "vocabulary.txt"), "utf8"));
  const expansionMap = buildExpansionMap(vocabulary);
  const expand = (line) => expandWords(line, cfg.lang, expansionMap);
  const items = expandedAlternatives(flattenVocabEntries(vocabulary), { expand }).map((it) => ({
    key: it.alt,
    expanded: it.alt,
  }));
  log(`Dictionary items (expanded alternatives): ${items.length}`);

  const docs = loadSrtDocs(cfg.srtsDir);
  const minSpanSec = cfg.pruneMinSpanSec || 60;
  const windowLines = cfg.pruneWindowLines || 4;
  const isFull = (d) => isFullSrt(d.raw.sv || d.raw.en || "", { minSpanSec });
  const transcripts = docs.filter(isFull);
  const snippets = docs.filter((d) => !isFull(d));
  log(
    `${docs.length} subtitle file-sets in ${cfg.srtsDir}; ` +
      `${transcripts.length} full-video transcripts (span > ${minSpanSec}s), keeping ${snippets.length} snippets.`
  );
  if (!transcripts.length) return log("No full-video transcripts to shrink.");

  const clean = (d) => ({ name: d.name, sv: cleanSrtForMatch(d.raw.sv || ""), en: cleanSrtForMatch(d.raw.en || "") });
  log(`Scanning ${items.length} items to find those covered only by transcripts (may take a few minutes)…`);
  const uncoveredOwners = scanUncoveredOwners(items, snippets.map(clean), transcripts.map(clean));
  const assignment = greedyCover(uncoveredOwners); // transcriptName -> [item to preserve a window for]
  log(`${uncoveredOwners.size} dictionary item(s) live only in transcripts; assigned to ${assignment.size} transcript(s).`);

  const byName = new Map(docs.map((d) => [d.name, d]));
  const bytesOf = (t) => (t.raw.sv ? Buffer.byteLength(t.raw.sv) : 0) + (t.raw.en ? Buffer.byteLength(t.raw.en) : 0);

  // Build the plan: each transcript is either shrunk to windows around its
  // assigned items, or deleted outright (nothing unique to preserve).
  const plan = [];
  let bytesBefore = 0;
  let bytesAfter = 0;
  for (const t of transcripts) {
    const oldBytes = bytesOf(t);
    bytesBefore += oldBytes;
    const assigned = assignment.get(t.name) || [];
    if (!assigned.length) {
      plan.push({ name: t.name, action: "delete", files: Object.values(t.files), oldBytes, newBytes: 0 });
      continue;
    }
    const regexes = assigned.map((k) => buildRareWordRegex(k)).filter(Boolean);
    const wOpts = { before: windowLines, after: windowLines, firstPerRegex: true };
    const svRanges = t.raw.sv ? srtKeepRanges(t.raw.sv, regexes, wOpts) : [];
    const enRanges = t.raw.en ? srtKeepRanges(t.raw.en, regexes, wOpts) : [];
    const ranges = mergeRanges([...svRanges, ...enRanges]);
    if (!ranges.length) {
      // Assigned items didn't resolve to windows (matching quirk) — keep whole,
      // never silently drop coverage.
      bytesAfter += oldBytes;
      plan.push({ name: t.name, action: "keep-whole", files: Object.values(t.files), oldBytes, newBytes: oldBytes });
      continue;
    }
    const newSv = t.raw.sv ? applyRanges(t.raw.sv, ranges) : "";
    const newEn = t.raw.en ? applyRanges(t.raw.en, ranges) : "";
    const newBytes = Buffer.byteLength(newSv) + Buffer.byteLength(newEn);
    bytesAfter += newBytes;
    plan.push({
      name: t.name,
      action: "shrink",
      items: assigned.length,
      oldBytes,
      newBytes,
      write: { [t.files.sv]: newSv, [t.files.en]: newEn },
    });
  }

  const shrunk = plan.filter((p) => p.action === "shrink");
  const deleted = plan.filter((p) => p.action === "delete");
  const keptWhole = plan.filter((p) => p.action === "keep-whole");
  log(
    `\nShrink ${shrunk.length}, delete ${deleted.length}` +
      (keptWhole.length ? `, keep-whole ${keptWhole.length}` : "") +
      `.  ${(bytesBefore / 1e6).toFixed(1)} MB → ${(bytesAfter / 1e6).toFixed(1)} MB ` +
      `(~${((bytesBefore - bytesAfter) / 1e6).toFixed(1)} MB freed).`
  );

  const planPath = join(cfg.outDir, "prune-plan.json");
  writeJson(
    planPath,
    plan.map(({ write, ...rest }) => rest)
  );
  log(`Wrote the plan → ${planPath}`);

  if (!(cfg.apply || cfg.delete)) return log(`(dry run — re-run with --apply to rewrite/delete the files.)`);

  let wrote = 0;
  let removed = 0;
  for (const p of plan) {
    if (p.action === "delete") {
      for (const f of p.files) {
        try {
          unlinkSync(join(cfg.srtsDir, f));
          removed++;
        } catch (e) {
          log(`  ! could not delete ${f}: ${e.message}`);
        }
      }
    } else if (p.action === "shrink") {
      for (const [f, text] of Object.entries(p.write)) {
        if (!f) continue;
        if (text) {
          writeFileSync(join(cfg.srtsDir, f), text);
          wrote++;
        } else {
          try {
            unlinkSync(join(cfg.srtsDir, f));
          } catch (e) {
            /* one side may not exist */
          }
        }
      }
    }
  }
  const deletedNames = new Set(deleted.map((p) => p.name));
  const index = readIndex(cfg.srtsDir).filter((e) => !deletedNames.has(e.name));
  writeIndex(cfg.srtsDir, index);
  log(`Applied: rewrote ${wrote} shrunk file(s), deleted ${removed} file(s), updated index.json.`);
}

// --- main ------------------------------------------------------------------

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const overrides = coerceFlags(flags);
  const cfg = loadConfig(flags.config || "config.json", overrides);
  if (overrides.reset) cfg.reset = true;
  if (overrides.words) cfg.words = overrides.words;
  if (overrides.category) cfg.category = overrides.category;
  if (overrides.browser) cfg.filmotMode = "browser";
  if (overrides.headed) cfg.browserHeadless = false;
  if (overrides.headless) cfg.browserHeadless = true;
  if (flags["no-translate"] || flags.skipTranslate) cfg.skipTranslate = true;

  if (command === "rare") return cmdRare(cfg);
  if (command === "filmot") return cmdFilmot(cfg);
  if (command === "srt") return cmdSrt(cfg);
  if (command === "categories") return cmdCategories(cfg);
  if (command === "prune") return cmdPrune(cfg);

  log(`Unknown command "${command}". Use one of: rare | filmot | srt | categories | prune`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exitCode = 1;
});
