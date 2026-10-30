// Which players the caption capture understands, and how to find their cues.
//
// This is the configuration surface. It is served from gh-pages and fetched
// at runtime, so adding a player or repairing a layout that changed is an
// edit here — never an app release.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  // -----------------------------------------------------------------------
  // Caption capture module
  //
  // Three capture paths, all running together:
  //   1) Read existing video.textTracks. If any has cues populated (or we
  //      can force mode='hidden' to populate them), we get the full
  //      transcript with accurate timing — best case.
  //   2) XHR/fetch hook: any response body starting with `WEBVTT` is a
  //      subtitle file. Parse it and push every cue.
  //   3) DOM observer fallback: mirror the on-screen cue container if the
  //      first two miss. This is the only path that needs per-site knowledge.
  //
  // CAPTION_SITES is the configuration surface. This file is served from
  // gh-pages and fetched at runtime, so adding a player or repairing a
  // changed layout is an edit here — no app release.
  //
  //   host          match the site by domain
  //   domProbe      match the site by the presence of this element, whatever
  //                 the domain (players identifiable by their own markup)
  //   domSelector   where the on-screen cue text lives, once matched
  //   cueSelector   optional inner element inside domSelector holding the cue
  //   shrinkSelectors  player frame(s) to shrink for split view
  //   isWatchPage   optional — restrict the sidebar to real video pages
  //   timeParam     optional — the query parameter this player reads a start
  //                 offset from, in whole seconds. Set it and a block sent to
  //                 the webapp links back to the moment the passage starts
  //                 instead of to the top of the video. Leave it out for a
  //                 player with no deep link: a parameter the player ignores
  //                 is worse than none, because the link still looks like it
  //                 should work.
  //   timeLinkOn    optional — a predicate (or a plain false) for pages where
  //                 that link is worth making, for a site whose player is
  //                 timed on some and live on others. It decides the link
  //                 only: `timeParam` is still sent, because naming the
  //                 parameter is what keeps the offset out of the page's
  //                 identity, and an identity that moved with playback would
  //                 de-duplicate against nothing.
  //
  // An entry needs `host` or `domProbe` to match. `domSelector` is only
  // needed for path 3; entries without one still get paths 1 and 2.
  // -----------------------------------------------------------------------
  const CAPTION_SITES = [
    {
      id: 'svt',
      host: /(^|\.)svtplay\.se$|(^|\.)svt\.se$/,
      // SVT uses obfuscated CSS-in-JS class names ("vp_b", "css-dgqlcd")
      // but reliable data-rt attributes for everything important.
      // Outermost player frame is data-rt="video-player-fullscreen".
      shrinkSelectors: [
        '[data-rt="video-player-fullscreen"]',
        '[data-rt="video-player-container"]',
        '[data-rt="video-player-frame"]',
      ],
      domSelector: '[data-rt="subtitles-container"]',
      cueSelector: '.vtt-cue-teletext',
      timeParam: 'position',
      // SVT Play's own videos and clips, and nothing else. A number on a live
      // channel's timeline means nothing to whoever opens the link an hour
      // later, and the svt.se article player — which this entry also matches
      // — is not known to read this at all. Anchored at the start of the path
      // so a `/klipp/` deeper inside a news article's address does not pass
      // for one, and the host is checked because svt.se has its own /video/.
      timeLinkOn: () =>
        /(^|\.)svtplay\.se$/.test(location.host) &&
        /^\/(video|klipp)\//.test(location.pathname),
      isWatchPage: () =>
        /\/video\//.test(location.pathname) ||
        /\/(klipp|kanaler)\//.test(location.pathname),
    },
    {
      id: 'urplay',
      host: /(^|\.)urplay\.se$/,
      domSelector: '.jw-text-track-display',
      shrinkSelectors: ['.jwplayer', '.jw-wrapper'],
    },
    {
      // Any JW Player page, whatever the domain — the markup identifies it.
      id: 'jwplayer',
      domProbe: '.jw-text-track-display',
      domSelector: '.jw-text-track-display',
      shrinkSelectors: ['.jwplayer', '.jw-wrapper'],
    },
    {
      id: 'youtube',
      host: /(^|\.)youtube(?:-nocookie)?\.com$|^youtu\.be$/,
      isWatchPage: () => {
        const url = new URL(location.href);
        return /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '') ||
          /^\/(?:shorts|embed|live|v)\/[A-Za-z0-9_-]{11}(?:\/|$)/.test(url.pathname) ||
          (url.hostname === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}(?:\/|$)/.test(url.pathname));
      },
      domSelector: '.ytp-caption-window-container',
      cueSelector: '.ytp-caption-segment',
      // Arrive at a video through a timed link and the address keeps `t`.
      // Naming it here is what stops that becoming a second identity for a
      // video already captured from its plain address.
      timeParam: 't',
      // Every video plays at /watch; the query names which one. Moving on to
      // another `v` is another video, and the caption list starts over.
      videoParams: ['v'],
      shrinkSelectors: ['#movie_player', '.html5-video-player'],
    },
    {
      id: 'spotify',
      host: /^open\.spotify\.com$/,
      timeParam: 't',
      // Podcast sharing supports a start time; music tracks do not. The
      // playing episode can differ from the Spotify page being browsed.
      timeLinkOn: () => /^https:\/\/open\.spotify\.com\/episode\//.test(shared.spotifyMediaUrl()),
      shrinkSelectors: [],
      mediaUrl: shared.spotifyMediaUrl,
      mediaKey: shared.spotifyMediaUrl,
      createPlayer: shared.createSpotifyPlayer,
      isWatchPage: () => !!shared.spotifyMediaUrl(),
    },
    {
      // Fallback: no DOM knowledge, but native TextTracks and sidecar WebVTT
      // still work, which covers most standard HTML5 players.
      id: 'native',
      domProbe: 'video',
    },
  ];

  function resolveCaptionSite() {
    const host = (location && location.host) || '';
    for (const s of CAPTION_SITES) {
      if (s.host && s.host.test(host)) return s;
    }
    // Host didn't match — fall back to identifying the player by its markup.
    for (const s of CAPTION_SITES) {
      if (s.domProbe) {
        try {
          if (document.querySelector(s.domProbe)) return s;
        } catch (_) {}
      }
    }
    return null;
  }
  shared.CAPTION_SITES = CAPTION_SITES;
  shared.resolveCaptionSite = resolveCaptionSite;
})();
