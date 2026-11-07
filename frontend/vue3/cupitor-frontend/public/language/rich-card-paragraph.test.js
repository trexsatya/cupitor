import {
  setRichCardAlignment, indentRichCardParagraph, installRichCardParagraphTools,
  RICH_CARD_INDENT_MAX,
} from './rich-card-paragraph.js';

function fixture() {
  const calls = [];
  const converterCalls = [];
  const toolbar = document.createElement('div');
  toolbar.innerHTML = '<div class="ck-toolbar__items"></div>';
  const block = {
    attrs: {},
    is: type => type === 'element',
    getAttribute(name) { return this.attrs[name]; },
  };
  const selection = {
    getSelectedBlocks: () => [block],
    getFirstPosition: () => ({ parent: block }),
    on: () => {},
  };
  const writer = {
    setAttribute: (attribute, value, target) => {
      calls.push(['set', attribute, value, target]);
      target.attrs[attribute] = value;
    },
    removeAttribute: (attribute, target) => {
      calls.push(['remove', attribute, target]);
      delete target.attrs[attribute];
    },
  };
  const editor = {
    model: {
      document: { selection, on: () => {} },
      schema: {
        extend: (...args) => calls.push(['schema', ...args]),
        checkAttribute: () => true,
      },
      change: callback => callback(writer),
    },
    commands: { get: () => null },
    conversion: {
      for: direction => ({
        elementToAttribute: definition => converterCalls.push([direction, 'elementToAttribute', definition]),
        attributeToAttribute: definition => converterCalls.push([direction, 'attributeToAttribute', definition]),
      }),
    },
    ui: { view: { toolbar: { element: toolbar } } },
    editing: { view: { focus: () => calls.push(['focus']) } },
  };
  return { editor, calls, converterCalls, toolbar, block };
}

test('alignment changes selected paragraph and restores default left', () => {
  const { editor, calls, block } = fixture();
  expect(setRichCardAlignment(editor, 'center')).toBe(true);
  expect(block.attrs.cupCardParagraphAlign).toBe('center');
  expect(calls).toContainEqual(['set', 'cupCardParagraphAlign', 'center', block]);
  setRichCardAlignment(editor, 'left');
  expect(block.attrs.cupCardParagraphAlign).toBeUndefined();
  expect(setRichCardAlignment(editor, 'invalid')).toBe(false);
});

test('indent buttons clamp to zero and eight and preserve model attributes', () => {
  const { editor, block } = fixture();
  expect(indentRichCardParagraph(editor, -1)).toBe(true);
  expect(block.attrs.cupCardParagraphIndent).toBeUndefined();
  for (let i = 0; i < 12; i++) indentRichCardParagraph(editor, 1);
  expect(block.attrs.cupCardParagraphIndent).toBe(RICH_CARD_INDENT_MAX);
  for (let i = 0; i < 12; i++) indentRichCardParagraph(editor, -1);
  expect(block.attrs.cupCardParagraphIndent).toBeUndefined();
});

test('registers alignment and indent HTML converters and toolbar buttons', () => {
  const { editor, converterCalls, calls, toolbar } = fixture();
  installRichCardParagraphTools(editor);
  expect(calls).toContainEqual(['schema', '$block', {
    allowAttributes: ['cupCardParagraphAlign', 'cupCardParagraphIndent'],
  }]);
  const downcasts = converterCalls.filter(([direction]) => direction === 'downcast');
  expect(downcasts).toHaveLength(2);
  expect(downcasts[0][2].view('center')).toEqual({
    key: 'style', value: { 'text-align': 'center' },
  });
  expect(downcasts[1][2].view(2)).toEqual({
    key: 'style', value: { 'margin-left': '4em' },
  });
  const upcasts = converterCalls.filter(([direction]) => direction === 'upcast');
  expect(upcasts[0][2].model.value({ getStyle: () => 'right' })).toBe('right');
  expect(upcasts[1][2].model.value({ getStyle: () => '6em' })).toBe(3);
  expect(upcasts[1][2].model.value({ getStyle: () => '32px' })).toBe(1);
  expect([...toolbar.querySelectorAll('.cup-card-paragraph-tools button')].map(x => x.getAttribute('aria-label')))
    .toEqual(['Align left', 'Align center', 'Align right', 'Justify', 'Decrease indent', 'Increase indent']);
});

test('clicking alignment and indent controls updates selected block', () => {
  const { editor, block, toolbar } = fixture();
  installRichCardParagraphTools(editor);
  toolbar.querySelector('[aria-label="Align right"]').click();
  expect(block.attrs.cupCardParagraphAlign).toBe('right');
  toolbar.querySelector('[aria-label="Increase indent"]').click();
  expect(block.attrs.cupCardParagraphIndent).toBe(1);
  toolbar.querySelector('[aria-label="Decrease indent"]').click();
  expect(block.attrs.cupCardParagraphIndent).toBeUndefined();
});
