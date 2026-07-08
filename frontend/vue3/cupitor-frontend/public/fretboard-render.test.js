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

  test('draws the chord-name title when `label` is given, and none when empty', () => {
    const trail = [{ voicing: [{ string: 1, fret: 0 }], age: 0 }];

    const withLabel = makeSvg();
    renderFretboard(withLabel, { trail, label: 'Am' });
    const titles = [...withLabel.querySelectorAll('.fb-title div')].map((d) => d.textContent);
    expect(titles).toEqual(['Am']);

    const noLabel = makeSvg();
    renderFretboard(noLabel, { trail });
    expect(noLabel.querySelectorAll('.fb-title').length).toBe(0);
  });

  test('a title strip makes the svg taller (headroom) but keeps all six strings', () => {
    const trail = [{ voicing: [{ string: 1, fret: 0 }], age: 0 }];
    const a = makeSvg(); renderFretboard(a, { trail });
    const b = makeSvg(); renderFretboard(b, { trail, label: 'G7' });
    const h = (svg) => parseFloat(svg.getAttribute('height'));
    expect(h(b)).toBeGreaterThan(h(a));
    expect(b.querySelectorAll('.fb-string').length).toBe(6);
  });

  test('labelMode "fret" labels the dot with the fret number; "note" with the note name', () => {
    // string 5, fret 3 = C (STANDARD_TUNING); string 1, fret 0 = open high E.
    const trail = [{ voicing: [{ string: 5, fret: 3 }, { string: 1, fret: 0 }], age: 0 }];
    const labels = (svg) => [...svg.querySelectorAll('.fb-dot-label div')].map((d) => d.textContent).sort();

    const fret = makeSvg();
    renderFretboard(fret, { trail, labelMode: 'fret' });
    expect(labels(fret)).toEqual(['0', '3']);

    const note = makeSvg();
    renderFretboard(note, { trail, labelMode: 'note' });
    expect(labels(note)).toEqual(['C', 'E']);
  });
});
