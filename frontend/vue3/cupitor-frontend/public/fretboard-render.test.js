/**
 * @jest-environment jsdom
 */
import { renderFretboard } from './fretboard-render.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function makeSvg() { return document.createElementNS(SVG_NS, 'svg'); }

describe('renderFretboard', () => {
  test('draws six string lines', () => {
    const svg = makeSvg();
    renderFretboard(svg, { trail: [] });
    expect(svg.querySelectorAll('.fb-string').length).toBe(6);
  });

  test('draws one dot per position across the trail', () => {
    const svg = makeSvg();
    const trail = [
      { voicing: [{ string: 1, fret: 0 }, { string: 2, fret: 1 }], age: 0 },
      { voicing: [{ string: 6, fret: 3 }], age: 1 },
    ];
    renderFretboard(svg, { trail });
    expect(svg.querySelectorAll('.fb-dot').length).toBe(3);
  });

  test('older dots are more transparent than the current step', () => {
    const svg = makeSvg();
    const trail = [
      { voicing: [{ string: 1, fret: 0 }], age: 0 },
      { voicing: [{ string: 2, fret: 1 }], age: 3 },
    ];
    renderFretboard(svg, { trail });
    const dots = [...svg.querySelectorAll('.fb-dot')];
    const op = (d) => parseFloat(d.getAttribute('opacity'));
    const current = dots.find((d) => d.getAttribute('data-age') === '0');
    const old = dots.find((d) => d.getAttribute('data-age') === '3');
    expect(op(current)).toBeGreaterThan(op(old));
  });

  test('is idempotent — re-rendering does not accumulate elements', () => {
    const svg = makeSvg();
    const trail = [{ voicing: [{ string: 1, fret: 0 }], age: 0 }];
    renderFretboard(svg, { trail });
    renderFretboard(svg, { trail });
    expect(svg.querySelectorAll('.fb-dot').length).toBe(1);
    expect(svg.querySelectorAll('.fb-string').length).toBe(6);
  });

  test('a null voicing in the trail draws no dots and does not throw', () => {
    const svg = makeSvg();
    renderFretboard(svg, { trail: [{ voicing: null, age: 0 }] });
    expect(svg.querySelectorAll('.fb-dot').length).toBe(0);
  });
});
