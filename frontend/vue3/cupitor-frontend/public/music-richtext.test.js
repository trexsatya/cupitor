import { safeHtml, ALLOWED_TAGS } from './music-richtext.js';

describe('safeHtml', () => {
  test('keeps the inline tags a script would actually use', () => {
    expect(safeHtml('play <b>softly</b> then <i>louder</i><br>again'))
      .toBe('play <b>softly</b> then <i>louder</i><br>again');
  });

  test('keeps colour, which is the point of the feature', () => {
    expect(safeHtml('<span style="color:#c00">forte</span>'))
      .toBe('<span style="color:#c00">forte</span>');
  });

  test('plain text is escaped, so prose about a < b still reads as written', () => {
    expect(safeHtml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
  });

  test('an unknown tag loses the tag and keeps the words', () => {
    expect(safeHtml('<div>keep <blink>these</blink> words</div>')).toBe('keep these words');
  });

  test('script and style are dropped whole — their body is code, not prose', () => {
    expect(safeHtml('before<script>alert(1)</script>after')).toBe('beforeafter');
    expect(safeHtml('<style>body{display:none}</style>hi')).toBe('hi');
  });

  test('event handlers and URL attributes cannot survive', () => {
    expect(safeHtml('<b onclick="alert(1)" onmouseover="x()">hi</b>')).toBe('<b>hi</b>');
    expect(safeHtml('<img src=x onerror="alert(1)">')).toBe('');
    expect(safeHtml('<span style="background:url(http://x/y)">hi</span>')).toBe('<span>hi</span>');
  });

  test('a malformed tag costs the emphasis, never the sentence', () => {
    expect(safeHtml('<b>unclosed emphasis')).toBe('<b>unclosed emphasis</b>');
    // "<b tag" parses as a <b> carrying a `tag` attribute, which the allowlist strips: an empty element
    // and no lost words. What matters is that the prose survives whatever the typo was.
    expect(safeHtml('half a <b tag')).toBe('half a <b></b>');
    expect(safeHtml('words <em>then a typo <em> and more')).toContain('and more');
  });

  test('empty and nullish input', () => {
    expect(safeHtml('')).toBe('');
    expect(safeHtml(null)).toBe('');
    expect(safeHtml(undefined)).toBe('');
  });

  test('the allowlist is inline-only — no block layout, nowhere for it to go', () => {
    ['div', 'table', 'h1', 'p', 'img', 'a', 'script'].forEach((t) => expect(ALLOWED_TAGS.has(t)).toBe(false));
  });
});
