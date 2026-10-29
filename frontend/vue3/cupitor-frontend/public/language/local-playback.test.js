import {playLocalMedia} from './local-playback';

describe('local playback start', () => {
  test('waits for a successful start without changing playback', async () => {
    let resolve;
    const player = {play:jest.fn(() => new Promise(done => {resolve = done;}))};
    const onError = jest.fn();
    const result = playLocalMedia(player, onError);
    resolve();
    expect(await result).toBe(true);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  test('consumes a pending start cancelled by pause or source replacement', async () => {
    let reject;
    const player = {play:() => new Promise((_, fail) => {reject = fail;})};
    const onError = jest.fn();
    const result = playLocalMedia(player, onError);
    reject(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
    expect(await result).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  test.each(['NotAllowedError', 'NotSupportedError'])('reports %s rather than treating it as cancellation', async name => {
    const error = new DOMException('Cannot play media', name);
    const onError = jest.fn();
    expect(await playLocalMedia({play:() => Promise.reject(error)}, onError)).toBe(false);
    expect(onError).toHaveBeenCalledWith(error);
  });

  test('reports synchronous failures and accepts older players without a promise', async () => {
    const error = new Error('Player is unavailable');
    const onError = jest.fn();
    expect(await playLocalMedia({play:() => {throw error;}}, onError)).toBe(false);
    expect(onError).toHaveBeenCalledWith(error);
    expect(await playLocalMedia({play:() => {}}, onError)).toBe(true);
  });
});
