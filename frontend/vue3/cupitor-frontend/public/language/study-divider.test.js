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
