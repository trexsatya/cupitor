import { splitGeometry } from './study-divider'

test('clamps both sections into portrait, landscape and small viewports', () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 900]]) {
    for (const ratio of [null, -1, 0.5, 2]) for (const audio of [true, false]) {
      const g = splitGeometry({ width, height, bottom: 90, transport: 60, ratio, audio });
      expect(g.y).toBeGreaterThan(64);
      expect(g.y).toBeLessThan(height - 90);
      expect(g.media).toBeGreaterThan(0);
      expect(g.upper).toBeGreaterThanOrEqual(g.min);
      expect(g.upper).toBeLessThanOrEqual(g.max);
    }
  }
});

test('reserves video and audio together while retaining space to read the card', () => {
  for (const [width, height] of [[320, 640], [390, 900], [1280, 720]]) {
    for (const ratio of [null, 0.05, 0.95]) {
      const g = splitGeometry({ width, height, bottom: 64, audio: true, ratio,
        mediaMin: 140 + 90, naturalMedia: 140 + Math.min(width, 900) * 9 / 16 })
      expect(g.media).toBeGreaterThanOrEqual(230)
      expect(g.y + 10).toBeLessThan(height - 100)
    }
  }
})
