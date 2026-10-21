// Captured text stays a card; its retained cue ranges determine whether the
// linked Spotify podcast can also be played by the playlist.
export function spotifyEpisode(value) {
  const text = String(value || '').trim();
  const uri = /^spotify:episode:([A-Za-z0-9]{22})$/.exec(text);
  let id = uri?.[1];
  if (!id) {
    try {
      const url = new URL(text);
      if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') return null;
      id = /^\/(?:intl-[\w-]+\/)?(?:embed\/)?episode\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname)?.[1];
    } catch (_) {return null;}
  }
  return id ? {id, uri: 'spotify:episode:' + id, url: 'https://open.spotify.com/episode/' + id} : null;
}

export function spotifyClipSegments(item) {
  if (!item) return [];
  const episode = spotifyEpisode(item.mediaUrl || item.captionUrl);
  if (!episode) return [];
  const blocks = Array.isArray(item.captionBlocks) ? item.captionBlocks : [{
    url: item.captionUrl, starts: item.captionStarts, ends: item.captionEnds,
  }];
  const ranges = [];
  for (const block of blocks) {
    if (spotifyEpisode(block?.url)?.id !== episode.id || !Array.isArray(block.starts) ||
        !Array.isArray(block.ends) || block.starts.length !== block.ends.length) continue;
    block.starts.forEach((value, i) => {
      if (value == null || block.ends[i] == null) return;
      const start = Number(value), end = Number(block.ends[i]);
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start) ranges.push({start, end});
    });
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const segments = [];
  for (const range of ranges) {
    const previous = segments.at(-1);
    if (previous && range.start <= previous.end + 0.5) previous.end = Math.max(previous.end, range.end);
    else segments.push({...episode, ...range});
  }
  return segments;
}
