// Plan on-demand caption collection against the actual local SRT library.
// Counts one distinct subtitle/video entry per word, not every occurrence.
import { findRareWords, buildRareWordRegex } from '../../public/language/rare-words.js';

export function planCollection(entries, subtitles, threshold, options = {}) {
  if (!Number.isSafeInteger(threshold) || threshold < 1) {
    throw new Error('Collection threshold must be a positive integer');
  }
  // Count each video only once even when a legacy directory has multiple
  // differently named subtitle bases referring to the same indexed video.
  const unique = new Map();
  for (const [i, sub] of (subtitles || []).entries()) {
    const key = sub.videoId || 'unindexed:' + i;
    const current = unique.get(key);
    if (current) {
      current.sv += ' ' + (sub.sv || '');
      current.en += ' ' + (sub.en || '');
    } else unique.set(key, { ...sub, sv: sub.sv || '', en: sub.en || '' });
  }
  // Count coverage in the requested source language only. A Swedish-looking
  // string in an English translation must not satisfy a Swedish SRT target.
  const sources = [...unique.values()].map(sub => ({
    ...sub,
    sv: options.sourceLang === 'en' ? '' : sub.sv,
    en: options.sourceLang === 'sv' ? '' : sub.en,
  }));
  const rare = findRareWords(entries, sources, threshold, { ...options, perAlternative: true });
  return rare.map(entry => {
    const regex = buildRareWordRegex(entry.expanded, { minAltLen: options.minAltLen ?? 3 });
    const existingVideoIds = [...new Set(sources
      .filter(sub => regex && (regex.test(sub.sv || '') || regex.test(sub.en || '')))
      .map(sub => sub.videoId)
      .filter(Boolean))];
    return { ...entry, missing: threshold - entry.count, existingVideoIds };
  });
}

export function selectedCollectionWords(words = [], fileText = '') {
  // --words accepts a comma-separated list; --wordsFile has one entry per line.
  // Do not split file entries on commas: commas can belong to a phrase.
  const fileWords = String(fileText || '').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  return [...new Set([...(words || []), ...fileWords].map(word => String(word).trim()).filter(Boolean))];
}
