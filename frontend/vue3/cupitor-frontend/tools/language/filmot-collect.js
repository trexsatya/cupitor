// Blacklist-path candidate collection for step 2. Gathers filmot result cards
// across a word's alternative terms, paging a term only while non-blacklisted
// candidates are still short of the quota (capped by maxSearchPages), resolves
// each card's channel so the final ranking can tier by blacklist, and returns
// the ranked candidate pool.
//
// Fetch/parse/channel-resolution are injected (defaults wire the real ones) so
// the paging logic is unit-testable without live filmot or the network.
import { buildSearchUrl, selectCandidates, nonBlacklistedCount } from "./filmot-fetch.js";
import { parseSearchResults } from "../../public/language/filmot-parse.js";
import { resolveChannel } from "./youtube-channel.js";

export async function collectRankedPool({
  terms,
  cfg,
  getPage,
  channelCache,
  excludeChannels = [],
  blacklistChannels = [],
  resolveChannelFn = resolveChannel,
  parseSearchResultsFn = parseSearchResults,
  log = () => {},
}) {
  const poolCards = [];
  const poolSeen = new Set();
  const channelOf = (id) => channelCache[id];
  const countOpts = { blacklistChannels, excludeChannels, channelOf };
  const enough = () => nonBlacklistedCount(poolCards, countOpts) >= cfg.maxItemsPerWord;
  const maxPages = Math.max(1, cfg.maxSearchPages || 1);

  for (const term of terms) {
    if (enough()) break;
    for (let p = 1; p <= maxPages; p++) {
      let cards;
      try {
        cards = parseSearchResultsFn(await getPage(buildSearchUrl(term, cfg.lang, p)));
      } catch (e) {
        if (e && e.captcha) throw e; // captcha aborts the whole word (progress kept)
        if (!poolCards.length) throw e; // nothing pooled yet → fail word, retry next run
        log(`  ! page ${p} fetch failed (${e.message}); using ${poolCards.length} pooled candidate(s)`);
        break;
      }
      const fresh = cards.filter((c) => !poolSeen.has(c.videoId));
      for (const c of fresh) poolSeen.add(c.videoId);
      poolCards.push(...fresh);
      for (const c of fresh) await resolveChannelFn(c.videoId, { cache: channelCache });
      log(
        `  "${term}" p${p}: +${fresh.length} candidate(s) ` +
          `(pool ${poolCards.length}, non-blacklisted ${nonBlacklistedCount(poolCards, countOpts)})`
      );
      if (!fresh.length) break; // no new results on this page → stop paging this term
      if (enough()) break;
    }
  }

  return selectCandidates(poolCards, {
    max: cfg.maxItemsPerWord,
    excludeChannels,
    blacklistChannels,
    channelOf,
    preferManual: cfg.preferManualCaptions,
  });
}
