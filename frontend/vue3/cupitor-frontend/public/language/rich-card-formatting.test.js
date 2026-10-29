import {
  normalizeRichCardColor, applyRichCardColor, insertRichCardHorizontalRule,
  insertRichCardVerticalRule, installRichCardFormatting
} from './rich-card-formatting.js';

function editorFixture({ collapsed = false, nativeRule = false } = {}) {
  const calls = [];
  const converters = [];
  const range = { clone() { return this; }, start: 0, end: 3 };
  const selection = { isCollapsed: collapsed, getRanges: () => [range] };
  const writer = {
    setAttribute: (...args) => calls.push(['set', ...args]),
    removeAttribute: (...args) => calls.push(['remove', ...args]),
    setSelectionAttribute: (...args) => calls.push(['caretSet', ...args]),
    removeSelectionAttribute: (...args) => calls.push(['caretRemove', ...args]),
    setSelection: (...args) => calls.push(['restoreSelection', ...args]),
    createElement: name => ({ name }),
    createText: text => ({ text }),
  };
  const toolbar = document.createElement('div');
  toolbar.innerHTML = '<div class="ck-toolbar__items"><button aria-label="Italic">I</button></div>';
  const editor = {
    ui: { view: { toolbar: { element: toolbar } } },
    commands: { get: name => nativeRule && name === 'horizontalLine' ? {} : null },
    execute: name => calls.push(['execute', name]),
    conversion: { for: pipeline => ({
      attributeToElement: config => converters.push([pipeline, 'attributeToElement', config]),
      elementToAttribute: config => converters.push([pipeline, 'elementToAttribute', config]),
      elementToElement: config => converters.push([pipeline, 'elementToElement', config]),
    }) },
    model: {
      document: { selection },
      schema: {
        extend: (...args) => calls.push(['schemaExtend', ...args]),
        setAttributeProperties: (...args) => calls.push(['schemaProperties', ...args]),
        register: (...args) => calls.push(['schemaRegister', ...args]),
        getValidRanges: () => [range],
      },
      change: callback => callback(writer),
      insertObject: (...args) => calls.push(['insertObject', ...args]),
      insertContent: (...args) => calls.push(['insertContent', ...args]),
    },
    editing: { view: { focus: () => calls.push(['focus']) } },
  };
  return { editor, calls, converters, selection, range, toolbar };
}

test('accepts only safe opaque hex/RGB colors', () => {
  expect(normalizeRichCardColor('#F39')).toBe('#ff3399');
  expect(normalizeRichCardColor('#aabbcc')).toBe('#aabbcc');
  expect(normalizeRichCardColor('rgb(1, 2, 255)')).toBe('#0102ff');
  for (const bad of ['red;position:fixed', 'url(https://example.com)', '#12xz34', 'rgb(300,0,0)', 'rgba(0,0,0,0.1)', '']) {
    expect(normalizeRichCardColor(bad)).toBeNull();
  }
});

test('applies and clears foreground color on selected ranges', () => {
  const { editor, calls, range } = editorFixture();
  expect(applyRichCardColor(editor, 'text', '#F00')).toBe(true);
  expect(calls).toContainEqual(['set', 'cupCardTextColor', '#ff0000', range]);
  calls.length = 0;
  expect(applyRichCardColor(editor, 'text', null)).toBe(true);
  expect(calls).toContainEqual(['remove', 'cupCardTextColor', range]);
  expect(applyRichCardColor(editor, 'text', 'javascript:alert(1)')).toBe(false);
});

test('background formatting at caret affects subsequently typed text', () => {
  const { editor, calls } = editorFixture({ collapsed: true });
  applyRichCardColor(editor, 'background', '#ffff00');
  expect(calls).toContainEqual(['caretSet', 'cupCardBackgroundColor', '#ffff00']);
  applyRichCardColor(editor, 'background', null);
  expect(calls).toContainEqual(['caretRemove', 'cupCardBackgroundColor']);
});

test('registers round-trip converters for both colors and horizontal rules', () => {
  const { editor, calls, converters, toolbar } = editorFixture();
  installRichCardFormatting(editor);
  expect(calls).toContainEqual(['schemaRegister', 'cupCardHorizontalRule', { inheritAllFrom: '$blockObject' }]);
  const upcasts = converters.filter(c => c[0] === 'upcast' && c[1] === 'elementToAttribute');
  expect(upcasts).toHaveLength(2);
  expect(upcasts[0][2].model.value({ getStyle: () => 'rgb(255, 0, 0)' })).toBe('#ff0000');
  expect(upcasts[1][2].model.value({ getStyle: () => '#f5f' })).toBe('#ff55ff');
  const downcasts = converters.filter(c => c[0] === 'downcast' && c[1] === 'attributeToElement');
  expect(downcasts).toHaveLength(2);
  const viewWriter = { createAttributeElement: (...args) => args };
  expect(downcasts[0][2].view('#ff0000', { writer: viewWriter })[1]).toEqual({ style: 'color:#ff0000' });
  expect(downcasts[1][2].view('#ffffff', { writer: viewWriter })[1]).toEqual({ style: 'background-color:#ffffff' });
  expect(converters.some(c => c[0] === 'upcast' && c[2].view === 'hr')).toBe(true);
  expect(toolbar.querySelector('input[aria-label="Text color"]')).not.toBeNull();
  expect(toolbar.querySelector('input[aria-label="Background color"]')).not.toBeNull();
  expect(toolbar.querySelector('button[aria-label="Insert horizontal ruler"]')).not.toBeNull();
  expect(toolbar.querySelector('button[aria-label="Insert vertical ruler"]')).not.toBeNull();
  expect(toolbar.querySelector('button[aria-label="Remove text color"]')).not.toBeNull();
});

test('native picker preserves model selection even when focus moves away', () => {
  const { editor, calls, toolbar, range } = editorFixture();
  installRichCardFormatting(editor);
  const picker = toolbar.querySelector('input[aria-label="Text color"]');
  picker.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
  picker.value = '#993355';
  picker.dispatchEvent(new Event('change', { bubbles: true }));
  expect(calls).toContainEqual(['restoreSelection', [range]]);
  expect(calls).toContainEqual(['set', 'cupCardTextColor', '#993355', range]);
  toolbar.querySelector('button[aria-label="Remove text color"]').click();
  expect(calls).toContainEqual(['remove', 'cupCardTextColor', range]);
});

test('inserts horizontal block and vertical inline separators', () => {
  const { editor, calls } = editorFixture();
  insertRichCardHorizontalRule(editor);
  expect(calls.some(c => c[0] === 'insertObject' && c[1].name === 'cupCardHorizontalRule')).toBe(true);
  insertRichCardVerticalRule(editor);
  expect(calls).toContainEqual(['insertContent', { text: ' │ ' }]);
});

test.each([
  ['Text color', 'cupCardTextColor'],
  ['Background color', 'cupCardBackgroundColor'],
])('reuses %s on successive selections without a picker change', (title, attribute) => {
  const { editor, calls, toolbar, selection, range } = editorFixture();
  installRichCardFormatting(editor);
  const picker = toolbar.querySelector(`input[aria-label="${title}"]`);
  picker.dispatchEvent(new Event('pointerdown'));
  picker.value = '#993355';
  picker.dispatchEvent(new Event('change'));
  expect(calls).toContainEqual(['set', attribute, '#993355', range]);

  const apply = toolbar.querySelector(`button[aria-label="Apply ${title.toLowerCase()}"]`);
  for (const nextRange of [{ start: 4, end: 7 }, { start: 8, end: 12 }]) {
    selection.getRanges = () => [nextRange];
    editor.model.schema.getValidRanges = ranges => ranges;
    calls.length = 0;
    apply.click();
    expect(calls).toContainEqual(['set', attribute, '#993355', nextRange]);
    expect(calls.some(call => call[0] === 'restoreSelection')).toBe(false);
  }
});

test('keyboard picker focus refreshes selection after a cancelled picker', () => {
  const { editor, calls, toolbar, selection } = editorFixture();
  installRichCardFormatting(editor);
  const picker = toolbar.querySelector('input[aria-label="Text color"]');
  picker.dispatchEvent(new Event('focus'));
  // Closing without changing the color emits no change event.
  const nextRange = { clone() { return this; }, start: 4, end: 7 };
  selection.getRanges = () => [nextRange];
  picker.dispatchEvent(new Event('focus'));
  picker.value = '#993355';
  picker.dispatchEvent(new Event('change'));
  expect(calls).toContainEqual(['restoreSelection', [nextRange]]);
});

test('uses CKEditor native horizontalLine command when available', () => {
  const { editor, calls, converters } = editorFixture({ nativeRule: true });
  installRichCardFormatting(editor);
  expect(converters.some(c => c[1] === 'elementToElement')).toBe(false);
  insertRichCardHorizontalRule(editor);
  expect(calls).toContainEqual(['execute', 'horizontalLine']);
});
