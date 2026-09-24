import { flowEnds, pointAlong } from './play-flow.js';

const A = { x: 0, y: 0 }, B = { x: 100, y: 50 };

describe('flowEnds', () => {
  test('an arrow flows towards its head', () => {
    expect(flowEnds('arrow', A, B, null)).toEqual([A, B]);
  });

  test('a plain line flows away from whichever end is at the source', () => {
    expect(flowEnds('line', A, B, { x: 95, y: 48 })).toEqual([B, A]);
    expect(flowEnds('line', A, B, { x: 3, y: 1 })).toEqual([A, B]);
  });

  test('no single direction: double-headed arrow, or a line with no known source', () => {
    expect(flowEnds('bi', A, B, null)).toBeNull();
    expect(flowEnds('line', A, B, null)).toBeNull();
  });
});

test('pointAlong interpolates between the ends', () => {
  expect(pointAlong(A, B, 0.5)).toEqual({ x: 50, y: 25 });
});
