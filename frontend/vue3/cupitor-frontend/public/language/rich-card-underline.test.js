import { installRichCardUnderline, toggleRichCardUnderline } from './rich-card-underline.js';

function fixture({ collapsed = false, active = false, native = false } = {}) {
  const calls = [];
  const converters = [];
  const range = { id: 'selected' };
  const toolbar = document.createElement('div');
  toolbar.innerHTML = '<div class="ck-toolbar__items"><button aria-label="Italic">I</button><button aria-label="Strikethrough">S</button></div>';
  const selection = {
    isCollapsed: collapsed,
    getAttribute: () => active,
    getRanges: () => [range],
    on() {},
  };
  const writer = {
    setAttribute: (...args) => calls.push(['set', ...args]),
    removeAttribute: (...args) => calls.push(['remove', ...args]),
    setSelectionAttribute: (...args) => calls.push(['caretSet', ...args]),
    removeSelectionAttribute: (...args) => calls.push(['caretRemove', ...args]),
  };
  const command = native ? { value: active, isEnabled: true, on() {} } : null;
  const editor = {
    commands: { get: name => name === 'underline' ? command : null },
    execute: name => calls.push(['execute', name]),
    model: {
      document: { selection },
      change: fn => fn(writer),
      schema: {
        extend: (...args) => calls.push(['schemaExtend', ...args]),
        setAttributeProperties: (...args) => calls.push(['schemaProperties', ...args]),
        getValidRanges: () => [range],
      },
    },
    conversion: { for: pipeline => ({
      attributeToElement: config => converters.push([pipeline, 'downcast', config]),
      elementToAttribute: config => converters.push([pipeline, 'upcast', config]),
    }) },
    editing: { view: { focus: () => calls.push(['focus']) } },
    ui: { view: { toolbar: { element: toolbar } } },
  };
  return { editor, calls, converters, toolbar, range };
}

test('registers persistent <u> converters and positions underline next to italic', () => {
  const { editor, calls, converters, toolbar } = fixture();
  installRichCardUnderline(editor);
  expect(calls).toContainEqual(['schemaExtend', '$text', { allowAttributes: 'cupCardUnderline' }]);
  expect(converters).toContainEqual(['downcast', 'downcast', { model: 'cupCardUnderline', view: 'u' }]);
  expect(converters).toContainEqual(['upcast', 'upcast', { view: 'u', model: 'cupCardUnderline' }]);
  expect([...toolbar.querySelectorAll('button')].map(b => b.getAttribute('aria-label')))
    .toEqual(['Italic', 'Underline', 'Strikethrough']);
});

test('toggles underline on selected text and on the caret', () => {
  const { editor, calls, range } = fixture();
  toggleRichCardUnderline(editor);
  expect(calls).toEqual([['set', 'cupCardUnderline', true, range], ['focus']]);
  const x = fixture({ active: true });
  toggleRichCardUnderline(x.editor);
  expect(x.calls).toEqual([['remove', 'cupCardUnderline', x.range], ['focus']]);
  const y = fixture({ collapsed: true });
  toggleRichCardUnderline(y.editor);
  expect(y.calls).toEqual([['caretSet', 'cupCardUnderline', true], ['focus']]);
  const z = fixture({ collapsed: true, active: true });
  toggleRichCardUnderline(z.editor);
  expect(z.calls).toEqual([['caretRemove', 'cupCardUnderline'], ['focus']]);
});

test('uses built-in underline command when available', () => {
  const { editor, calls, converters } = fixture({ native: true });
  installRichCardUnderline(editor);
  expect(converters).toEqual([]);
  toggleRichCardUnderline(editor);
  expect(calls).toEqual([['execute', 'underline'], ['focus']]);
});
