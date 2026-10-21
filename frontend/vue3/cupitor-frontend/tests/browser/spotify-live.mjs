import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile, mkdir, stat, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spotifyClipSegments} from '../../public/language/spotify-clips.js';

// Opt-in live diagnostic: the real application and Spotify iframe, with no
// mocked SDK, playback events, clock, or autoplay-policy flags.
const root = process.cwd();
const assets = resolve(root, process.env.CUPITOR_TEST_ASSETS || 'public');
const output = resolve(root, 'spotify-browser-results');
await mkdir(output, {recursive: true});
const playlistPath = process.env.SPOTIFY_PLAYLIST_PATH ||
  'tests/browser/fixtures/spotify-captured-playlist.json';
const playlistFile = resolve(root, playlistPath);
if (!playlistFile.startsWith(root + sep)) throw new Error('Playlist must be inside the checkout.');
const rows = JSON.parse(await readFile(playlistFile, 'utf8'));
const controlEpisode = process.env.SPOTIFY_CONTROL_EPISODE || '';
if (controlEpisode && !/^[a-zA-Z0-9]{22}$/.test(controlEpisode)) throw new Error('Invalid control episode ID');
const sourceCards = rows.filter(row => row?.[2] && spotifyClipSegments(row[2]).length);
const cardLimit = Number(process.env.SPOTIFY_CONTROL_CARD_LIMIT || 0);
if (!Number.isSafeInteger(cardLimit) || cardLimit < 0) throw new Error('Invalid control card limit');
// Controls retain the original timestamps and durations. Only episode links
// change, including links inside merged caption blocks; saved data is untouched.
const selectedRows = controlEpisode && cardLimit ? sourceCards.slice(0, cardLimit) : sourceCards;
const cards = selectedRows.map(([category, word, item], index) => ({...item,
  ...(controlEpisode ? {mediaUrl: 'spotify:episode:' + controlEpisode,
    captionUrl: 'spotify:episode:' + controlEpisode,
    ...(Array.isArray(item.captionBlocks) ? {captionBlocks: item.captionBlocks.map(block => ({
      ...block, url: 'spotify:episode:' + controlEpisode}))} : {})} : {}),
  _st: category, _w: word, _idx: index}));
const sourceTimings = selectedRows.flatMap(row => spotifyClipSegments(row[2]))
  .map(({start, end}) => [start, end]);
const controlTimings = cards.flatMap(card => spotifyClipSegments(card))
  .map(({start, end}) => [start, end]);
if (JSON.stringify(sourceTimings) !== JSON.stringify(controlTimings)) {
  throw new Error('The browser test must preserve every supplied cue boundary.');
}
const ranges = cards.flatMap((card, cardIndex) => spotifyClipSegments(card)
  .map((range, segmentIndex) => ({cardIndex, segmentIndex, id: card.id, ...range})));
if (!cards.length) throw new Error('No playable Spotify cards in the supplied playlist.');

const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(assets, '.' + pathname);
    if (!file.startsWith(assets + sep) || !(await stat(file)).isFile()) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'});
    createReadStream(file).pipe(response);
  } catch {response.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const {chromium} = await import(pathToFileURL(process.env.CUPITOR_PLAYWRIGHT).href);
const browser = await chromium.launch({channel: 'chrome', headless: false,
  args: ['--disable-dev-shm-usage']});
const context = await browser.newContext({viewport: {width: 412, height: 915},
  locale: 'sv-SE', serviceWorkers: 'block', recordVideo: {dir: output}});
const page = await context.newPage();
const consoleErrors = [], networkErrors = [], embedResponses = [], providerErrors = [];
const safeUrl = value => {const url = new URL(value); return url.origin + url.pathname;};
page.on('pageerror', error => consoleErrors.push(error.stack || String(error)));
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 1200) + ' @ ' + message.location().url);
});
page.on('requestfailed', request => {
  if (/spotify|scdn|language\.js/.test(request.url())) {
    networkErrors.push({url: safeUrl(request.url()), failure: request.failure()});
  }
});
page.on('response', response => {
  if (response.status() >= 400 && /spotify|scdn/.test(response.url())) {
    providerErrors.push({url: safeUrl(response.url()), status: response.status()});
  }
  if (/open\.spotify\.com\/embed\//.test(response.url())) {
    embedResponses.push({url: response.url(), status: response.status()});
  }
});
await page.addInitScript(() => {
  if (window.top !== window) return;
  const events = window.__spotifyLiveEvents = [];
  const record = (kind, data) => events.push({ms: performance.now(), kind,
    cardIndex: window._recPlayIndex ?? null, cardId: window._recPlayCurrentItem?.id ?? null, data});
  let callback;
  Object.defineProperty(window, 'onSpotifyIframeApiReady', {
    configurable: true,
    get: () => callback,
    set(value) {
      callback = typeof value !== 'function' ? value : function(api) {
        if (!api.__liveDiagnosticWrapped) {
          api.__liveDiagnosticWrapped = true;
          const create = api.createController;
          api.createController = function(element, options, done) {
            record('createController', options);
            return create.call(this, element, options, controller => {
              for (const name of ['loadEntity', 'loadUri', 'play', 'resume', 'pause', 'seek']) {
                if (typeof controller[name] !== 'function') continue;
                const original = controller[name];
                if (name === 'seek' || name === 'loadEntity') record('sdk:' + name + '-implementation', String(original));
                controller[name] = function(...args) {
                  record('command:' + name, args);
                  return original.apply(this, args);
                };
              }
              for (const name of ['ready', 'playback_update', 'playback_started', 'error']) {
                controller.addListener(name, event => record(name, event?.data || null));
              }
              done(controller);
            });
          };
        }
        return value(api);
      };
    },
  });
});

let result = {status: 'failed', playlistPath, cardCount: cards.length, controlEpisode: controlEpisode || null,
  passageCount: ranges.length, browser: browser.version()};
let lastState, startupClick = false, playbackStarted = false;
const frameDiagnostics = async () => {
  const result = [];
  for (const frame of page.frames().filter(frame => /open\.spotify\.com\/embed/.test(frame.url()))) {
    result.push(await frame.evaluate(() => {
      let data;
      try {data = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || 'null');} catch {}
      const props = data?.props?.pageProps;
      const body = document.body?.cloneNode(true);
      body?.querySelectorAll('script,style,noscript').forEach(node => node.remove());
      return {url: location.href, text: body?.textContent?.slice(0, 3000),
        props: props ? {status: props.status, title: props.title,
          forbiddenReason: props.forbiddenReason} : null,
        media: [...document.querySelectorAll('audio,video')].map(media => ({
          currentTime: media.currentTime, duration: media.duration, paused: media.paused,
          readyState: media.readyState, networkState: media.networkState,
          error: media.error ? {code: media.error.code, message: media.error.message} : null})),
        buttons: [...document.querySelectorAll('button')].map(button => ({
          label: button.getAttribute('aria-label'), testId: button.getAttribute('data-testid'),
          text: button.textContent?.slice(0, 100)}))};
    }).catch(error => ({url: frame.url(), error: String(error)})));
  }
  return result;
};
try {
  await page.goto(base + '/language.html?lang=swedish', {waitUntil: 'load', timeout: 60000});
  await page.waitForFunction(() => typeof window.playRecording === 'function', null, {timeout: 60000});
  await page.evaluate(cards => {
    window.__livePlaylist = cards;
    const button = document.createElement('button');
    button.id = 'startLiveSpotifyDiagnostic';
    button.textContent = 'Start live Spotify playlist diagnostic';
    Object.assign(button.style, {position: 'fixed', top: '0', left: '0', zIndex: '2147483647'});
    button.onclick = () => {
      button.remove();
      Object.assign(window._appSettings, {recPlayGapSeconds: 0, recPlaySrcTgtGapSeconds: 0,
        recPlayShuffle: false, recPlayLoop: 'off', recMusicPaused: true});
      window.__livePlaylistRun = {done: false, error: null};
      window.playRecording({queue: window.__livePlaylist, shuffle: false, loop: 'off'})
        .then(() => {window.__livePlaylistRun.done = true;},
          error => {window.__livePlaylistRun.error = String(error);});
    };
    document.body.append(button);
  }, cards);
  // One genuine click starts the queue. A single initial iframe Play is allowed
  // for the browser's media policy; later clips must advance without clicks.
  await page.locator('#startLiveSpotifyDiagnostic').click();
  const deadline = Date.now() + 12 * 60 * 1000;
  let lastProgress = Date.now(), previousPosition = null, previousSignature = '', iframeSeenAt = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const events = window.__spotifyLiveEvents || [];
      const updates = events.filter(event => event.kind === 'playback_update');
      return {run: window.__livePlaylistRun, playing: window._playingRecording,
        paused: window._recPlayPaused, index: window._recPlayIndex,
        item: window._recPlayCurrentItem?.id,
        status: document.querySelector('.spotify-clip-status')?.textContent,
        updateCount: updates.length, lastUpdate: updates.at(-1),
        commandCount: events.filter(event => event.kind.startsWith('command:')).length};
    });
    lastState = state;
    const signature = JSON.stringify([state.index, state.paused, state.status]);
    if (signature !== previousSignature) {
      console.log('APP_STATE ' + JSON.stringify(state)); previousSignature = signature;
    }
    const lastUpdate = state.lastUpdate?.data;
    if (lastUpdate && !lastUpdate.isPaused && !lastUpdate.isBuffering && lastUpdate.position > 0) playbackStarted = true;
    if (lastUpdate && !lastUpdate.isPaused && !lastUpdate.isBuffering &&
        lastUpdate.position !== previousPosition) lastProgress = Date.now();
    previousPosition = lastUpdate?.position;
    const frame = page.frames().find(frame => /open\.spotify\.com\/embed/.test(frame.url()));
    if (frame && iframeSeenAt === null) iframeSeenAt = Date.now();
    if (frame && Date.now() - iframeSeenAt > 8000 && !startupClick && !playbackStarted &&
        !(lastUpdate && !lastUpdate.isPaused && !lastUpdate.isBuffering && lastUpdate.position > 0)) {
      const diagnostics = await frameDiagnostics();
      console.log('SPOTIFY_STARTUP ' + JSON.stringify(diagnostics));
      const blocked = diagnostics.find(value => value.props?.status >= 400 ||
        value.props?.forbiddenReason ||
        /not currently available|not available in your (country|region)/i.test(value.text || ''));
      if (blocked) {
        result.status = 'blocked'; result.reason = 'Spotify rejected the live embed';
        result.block = blocked; break;
      }
      const play = frame.locator('button[data-testid="play-pause-button"]:visible').first();
      if (await play.isVisible().catch(() => false)) {
        console.log('INITIAL_IFRAME_PLAY_CLICK');
        await play.click({timeout: 5000}); startupClick = true; lastProgress = Date.now();
      }
    }
    if (state.run?.error) throw new Error(state.run.error);
    if (state.run?.done) {result.status = 'completed'; break;}
    if (Date.now() - lastProgress > 45000) {
      result.reason = 'No unpaused, non-buffering position progress for 45 seconds'; break;
    }
    if (state.index > 0 && state.paused) {
      result.reason = 'Playlist became paused after the initial item'; break;
    }
  }
  if (result.status === 'failed' && !result.reason) result.reason = 'Live playback timed out';
} catch (error) {result.reason = String(error);}

const events = await page.evaluate(() => window.__spotifyLiveEvents || []).catch(() => []);
const observed = ranges.map(range => {
  const positions = events.filter(event => event.kind === 'playback_update' &&
    event.cardIndex === range.cardIndex && !event.data?.isPaused && !event.data?.isBuffering)
    .map(event => ({seconds: Number(event.data.position) / 1000, ms: event.ms}))
    .filter(position => Number.isFinite(position.seconds) &&
      position.seconds >= range.start - 0.25 && position.seconds <= range.end + 1.5);
  const min = positions.length ? Math.min(...positions.map(value => value.seconds)) : null;
  const max = positions.length ? Math.max(...positions.map(value => value.seconds)) : null;
  const endedPositions = events.filter(event => event.kind === 'playback_update' &&
    event.cardIndex === range.cardIndex && event.data?.isPaused && !event.data?.isBuffering)
    .map(event => Number(event.data.position) / 1000)
    .filter(position => Number.isFinite(position) && Math.abs(position - range.end) <= 0.4);
  // A passage transition can immediately Seek after Pause, so Spotify may
  // publish the next position without a separate paused sample at the old end.
  // Check the real Pause command time against the last fresh playing clock too.
  const pauseEstimates = events.filter(event => event.kind === 'command:pause' &&
    event.cardIndex === range.cardIndex).map(pause => {
      const previous = events.filter(event => event.kind === 'playback_update' &&
        event.cardIndex === range.cardIndex && event.ms <= pause.ms).at(-1);
      if (!previous || previous.data?.isPaused || previous.data?.isBuffering) return null;
      const elapsed = (pause.ms - previous.ms) / 1000;
      if (elapsed < 0 || elapsed > 1.5) return null;
      return Number(previous.data.position) / 1000 + elapsed;
    }).filter(position => position !== null && Number.isFinite(position) &&
      Math.abs(position - range.end) <= 0.2);
  const endObserved = endedPositions.length > 0 || pauseEstimates.length > 0 ||
    (max !== null && max >= range.end - 0.4);
  const covered = positions.length >= 2 && min <= range.start + 1.5 &&
    endObserved && max - min >= Math.min(0.5, (range.end - range.start) / 2);
  return {...range, updates: positions.length, min, max,
    pausePositions: endedPositions, pauseEstimates, covered};
});
if (result.status === 'completed') {
  result.status = observed.every(range => range.covered) ? 'passed' : 'failed';
  if (result.status === 'failed') result.reason = 'The queue ended without playing every expected passage';
}
result = {...result, initialIframePlayClick: startupClick, finalState: lastState,
  coveredPassages: observed.filter(range => range.covered).length, passages: observed,
  embedResponses, frames: await frameDiagnostics(),
  consoleErrors: [...new Set(consoleErrors)].slice(0, 40), networkErrors, providerErrors,
  applicationLog: await page.evaluate(() => window.getSpotifyPlaybackLog?.() || null)};
await page.screenshot({path: resolve(output, 'final.png'), fullPage: true}).catch(() => {});
if (await page.evaluate(() => typeof window.copySpotifyPlaybackLog === 'function')) {
  // Exercise the user-facing export separately after the playback attempt.
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => {window.stopPlayingRecording(); window.openLogViewer();});
    await page.locator('#logViewerSpotifyCopy').click();
    await page.waitForTimeout(300);
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    if (!Array.isArray(copied.events)) throw new Error('Copied log has no events');
    const fallback = await page.evaluate(async () => {
      const clipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
        writeText: async () => {throw new Error('Clipboard denied');}
      }});
      try {
        await window.copySpotifyPlaybackLog();
        const body = document.getElementById('logViewerBody');
        return !document.getElementById('logViewerAutoRefresh').checked &&
          JSON.parse(body.textContent).version === 1 &&
          window.getSelection().toString() === body.textContent;
      } finally {Object.defineProperty(navigator, 'clipboard', {configurable: true, value: clipboard});}
    });
    if (!fallback) throw new Error('Clipboard fallback did not preserve a selectable log');
    result.logExport = {passed: true, copiedEvents: copied.events.length, fallback};
    await page.screenshot({path: resolve(output, 'log-export.png'), fullPage: true});
  } catch (error) {
    result.logExport = {passed: false, reason: String(error)};
    if (result.status === 'passed') {result.status = 'failed'; result.reason = 'Playback log export failed';}
  }
  console.log('SPOTIFY_LOG_EXPORT ' + JSON.stringify(result.logExport));
}
// Exercise the visible Practice button against the same real iframe. This
// catches a YouTube-only click handler even when keyboard/Play All works.
if (result.status === 'passed') {
  try {
    const first = spotifyClipSegments(cards[0])[0];
    await page.evaluate(card => {
      window.stopPlayingRecording();
      window.openPracticeMode({queue: [card], single: true});
    }, cards[0]);
    await page.locator('#spotifyClipPlayer iframe').waitFor({state: 'visible'});
    await page.keyboard.press('Shift');
    await page.locator('#practiceMode .practice-play').click();
    await page.waitForFunction(({start, end}) => {
      const state = window.__spotifyLiveEvents.filter(e => e.kind === 'playback_update').at(-1)?.data;
      return document.body.classList.contains('study-spotify') && state &&
        !state.isPaused && !state.isBuffering && state.position / 1000 >= start + 0.2 && state.position / 1000 < end;
    }, first, {timeout: 25000});
    await page.keyboard.press('Shift');
    await page.locator('#practiceMode .practice-play').click();
    await page.waitForFunction(() => window.__spotifyLiveEvents.filter(e => e.kind === 'playback_update').at(-1)?.data?.isPaused, null, {timeout: 10000});
    if (!await page.locator('#spotifyClipPlayer iframe').isVisible()) throw new Error('Practice Play hid the Spotify iframe');
    result.practicePlayback = {passed: true};
    await page.screenshot({path: resolve(output, 'practice-play.png')});
    const click = async selector => {await page.keyboard.press('Shift'); await page.locator(selector).click();};
    const freshPlayback = async after => page.waitForFunction(({start, end, after}) => {
      const event = window.__spotifyLiveEvents.filter(e => e.kind === 'playback_update').at(-1);
      return event?.ms >= after && !event.data.isPaused && !event.data.isBuffering &&
        event.data.position / 1000 >= start && event.data.position / 1000 < end;
    }, {...first, after}, {timeout: 25000});
    const snapshot = () => page.evaluate(() => ({
      loads: window.__spotifyLiveEvents.filter(e => ['command:loadEntity', 'command:loadUri', 'command:seek'].includes(e.kind)).length,
      index: window._recPlayIndex
    }));
    await page.evaluate(() => {window.__restoreSpotifyIframe = document.querySelector('#spotifyClipPlayer iframe');});
    const practiceBefore = await snapshot();
    await click('.practice-minimize');
    await page.waitForTimeout(350);
    if (await page.locator('#spotifyClipPlayer iframe').isVisible()) throw new Error('Minimized Practice left Spotify visible');
    await click('.practice-restore-btn');
    await page.locator('#spotifyClipPlayer iframe').waitFor({state: 'visible'});
    if ((await snapshot()).loads !== practiceBefore.loads) throw new Error('Practice restore reloaded or sought the clip');
    const practiceResumeAt = await page.evaluate(() => performance.now());
    await click('.practice-play'); await freshPlayback(practiceResumeAt);
    await click('.practice-player-btn');
    await page.waitForFunction(() => window._playingRecording && !window._practiceActive);
    const playerStartAt = await page.evaluate(() => performance.now());
    await freshPlayback(playerStartAt);
    const playerBefore = await snapshot();
    await click('#recPlayingMinimizeBtn');
    await page.waitForTimeout(350);
    if (await page.locator('#spotifyClipPlayer iframe').isVisible()) throw new Error('Minimized Player left Spotify visible');
    const playerResumeAt = await page.evaluate(() => performance.now());
    await click('.rec-pill-restore'); await freshPlayback(playerResumeAt);
    await page.locator('#spotifyClipPlayer iframe').waitFor({state: 'visible'});
    const playerAfter = await snapshot();
    if (playerAfter.loads !== playerBefore.loads || playerAfter.index !== playerBefore.index) throw new Error('Player restore changed the clip or position');
    if (!await page.evaluate(() => document.querySelector('#spotifyClipPlayer iframe') === window.__restoreSpotifyIframe)) throw new Error('Restoring replaced the Spotify iframe');
    result.restorePlayback = {practice: true, player: true};
    await page.screenshot({path: resolve(output, 'restored-player.png')});
  } catch (error) {
    result.practicePlayback = {passed: false, reason: String(error)};
    result.status = 'failed'; result.reason = 'Spotify Practice/Player controls or minimize/restore failed';
  }
}
await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
await writeFile(resolve(output, 'events.json'), JSON.stringify(events, null, 2));
console.log('LIVE_SPOTIFY_RESULT ' + JSON.stringify(result));
if (result.status !== 'passed') console.log('FINAL_EVENTS ' + JSON.stringify(events.slice(-100)));
await context.close();
await browser.close();
await new Promise(resolve => server.close(resolve));
if (result.status !== 'passed') process.exitCode = 1;
