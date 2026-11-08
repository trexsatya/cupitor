import { plainTextPasteHtml, installRichCardPasteControl } from './rich-card-paste.js';

function fixture() {
  let handler, priority;
  const clipboard = { on(event, fn, opts) {
    expect(event).toBe('inputTransformation');
    handler = fn;
    priority = opts.priority;
  } };
  const editor = {
    plugins: { get: name => name === 'ClipboardPipeline' ? clipboard : null },
    data: { processor: { toView: html => ({ viewHtml: html }) } },
  };
  const checkbox = { checked: false };
  installRichCardPasteControl(editor, checkbox);
  return {
    checkbox, priority,
    paste: (text, content = { viewHtml: '<p><strong>Source</strong></p>' }, method = 'paste') => {
      const data = { dataTransfer: { getData: kind => kind === 'text/plain' ? text : '' }, content, method };
      handler({}, data);
      return data.content;
    },
  };
}

test('plain-text paste escapes HTML and preserves inline single-line content', () => {
  expect(plainTextPasteHtml('<b>Hello & "everyone"</b>'))
    .toBe('&lt;b&gt;Hello &amp; &quot;everyone&quot;&lt;/b&gt;');
});

test('plain-text paste preserves individual newlines without paragraph spacing', () => {
  expect(plainTextPasteHtml('first\r\nsecond'))
    .toBe('<p>first<br>second</p>');
  expect(plainTextPasteHtml('first\r\n\r\nsecond'))
    .toBe('<p>first<br><br>second</p>');
  expect(plainTextPasteHtml('first\n\n\nsecond'))
    .toBe('<p>first<br><br><br>second</p>');
  expect(plainTextPasteHtml('first\n')).toBe('<p>first<br></p>');
});

test('format-preservation toggle is off by default and updates the same editor', () => {
  const { checkbox, paste, priority } = fixture();
  const original = { viewHtml: '<p><strong>Source</strong></p>' };
  expect(priority).toBe('high');
  expect(checkbox.checked).toBe(false);
  expect(paste('Source', original)).toEqual({ viewHtml: 'Source' });
  checkbox.checked = true;
  expect(paste('Source', original)).toBe(original);
  checkbox.checked = false;
  expect(paste('Next', original)).toEqual({ viewHtml: 'Next' });
});

test('image-only paste and drag/drop remain handled by the normal pipeline', () => {
  const { paste } = fixture();
  const original = { viewHtml: '<figure class="image"><img src="data:image/png;base64,..."></figure>' };
  expect(paste('', original)).toBe(original);
  expect(paste('moved content', original, 'drop')).toBe(original);
});
