// Native play() resolves only after playback has started. A deliberate pause
// or source switch before then rejects it with AbortError; that cancellation
// must not become an unhandled rejection on the page.
export async function playLocalMedia(player, onError = error => console.warn('Local media playback failed', error)) {
  try {
    await player.play();
    return true;
  } catch (error) {
    if (!error || error.name !== 'AbortError') onError(error);
    return false;
  }
}
