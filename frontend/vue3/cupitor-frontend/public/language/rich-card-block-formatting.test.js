import {
  installRichCardBlockFormatting, setRichCardAlignment, changeRichCardIndent,
} from './rich-card-block-formatting.js';

function fixture() {
  const writes = [], conversions = [], listeners = {};
  const block1 = {
    name: 'paragraph', attrs: {},
    is: type => type === 'element',
    getAttribute(key) { return this.attrs[key]; },
  };
  const block2 = {
    name: 'heading1', attrs: {},
    is: type => type === 'element',
    getAttribute(key) { return this.attrs[key]; },
  };
  const blocks = [block1, block2];
  const selection = { getSelectedBlocks: () => blocks, on: (name, fn) => { listeners[name] = fn; } };
  const schema = {
    isRegistered: name => ['paragraph', 'heading1'].includes(name),
    checkAttribute: () => true,
    extend: (...args) => writes.push(['extend', ...args]),
  };
  const writer = {
    setAttribute: (key, val, block) => {
      block.attrs[key] = val;
      writes.push(['set', key, val, block.name]);
    },
    removeAttribute: (key, block) => {
      delete block.attrs[key];
      writes.push(['remove', key, block.name]);
    },
  };
  const toolbar = document.createElement('div');
  toolbar.innerHTML = '<div class="ck-toolbar__items"></div>';
  const editor = {
    model: { document: { selection, on: (name, fn) => { listeners[name] = fn; } }, schema,
      change: cb => { cb(writer); listeners['change:data']?.(); } },
    commands: { get: () => null },
    conversion: { attributeToAttribute: config => conversions.push(config) },
    editing: { view: { focus() { writes.push(['focus']); } } },
    ui: { view: { toolbar: { element: toolbar } } },
  };
  return { editor, writes, conversions, toolbar, block1, block2 };
}

test('alignment applies to all selected paragraph and heading blocks', () => {
  const { editor, block1, block2, writes } = fixture();
  installRichCardBlockFormatting(editor);
  expect(setRichCardAlignment(editor, 'center')).toBe(true);
  expect(block1.getAttribute('cupCardAlignment')).toBe('center');
  expect(block2.getAttribute('cupCardAlignment')).toBe('center');
  expect(writes.some(w => w[0] === 'focus')).toBe(true);
  expect(setRichCardAlignment(editor, 'garbage')).toBe(false);
});

test('indent/outdent step is bounded and removes the attribute at zero', () => {
  const { editor, block1, block2 } = fixture();
  installRichCardBlockFormatting(editor);
  for (let i = 0; i < 9; ++i) changeRichCardIndent(editor, 1);
  expect(block1.getAttribute('cupCardIndent')).toBe(6);
  expect(block2.getAttribute('cupCardIndent')).toBe(6);
  for (let i = 0; i < 8; ++i) changeRichCardIndent(editor, -1);
  expect(block1.getAttribute('cupCardIndent')).toBeUndefined();
  expect(block2.getAttribute('cupCardIndent')).toBeUndefined();
});

test('style converters support persisted alignment and indentation', () => {
  const { editor, conversions, toolbar } = fixture();
  installRichCardBlockFormatting(editor);
  expect(conversions).toHaveLength(4);
  const alignment = conversions.find(c => c.model.name === 'paragraph' && c.model.key === 'cupCardAlignment');
  const indent = conversions.find(c => c.model.name === 'paragraph' && c.model.key === 'cupCardIndent');
  expect(alignment.view.center).toEqual({ name: 'p', key: 'style', value: { 'text-align': 'center' } });
  expect(indent.view[2]).toEqual({ name: 'p', key: 'style', value: { 'margin-left': '80px' } });
  const labels = [...toolbar.querySelectorAll('button')].map(el => el.getAttribute('aria-label'));
  expect(labels).toEqual(['Decrease indent', 'Increase indent', 'Align left', 'Align center',
    'Align right', 'Align justify']);
  toolbar.querySelector('button[aria-label="Align right"]').click();
  expect(toolbar.querySelector('button[aria-label="Align right"]').getAttribute('aria-pressed')).toBe('true');
});
