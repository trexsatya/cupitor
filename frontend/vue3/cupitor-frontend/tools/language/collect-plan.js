// Plan on-demand caption collection against the actual local SRT library.
// Counts one distinct subtitle/video entry per word, not every occurrence.
import { findRareWords, buildRareWordRegex } from '../../public/language/rare-words.js';

export function planCollection(entries, subtitles, threshold, options = {}) {
  if (!Number.isSafeInteger(threshold) || threshold < 1) {
    throw new Error('Collection threshold must be a positive integer');
  }
  const rare = findRareWords(entries, subtitles, threshold, { ...options, perAlternative: true });
  return rare.map(entry => {
    const regex = buildRareWordRegex(entry.expanded);
    const existingVideoIds = [...new Set((subtitles || [])
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
