// Paragraph alignment and indentation for the manual-card Classic CKEditor.
// Classic builds do not include the optional Alignment / Indent plugins.
// Use safe, bounded model attributes and regular paragraph HTML styles so
// formatting survives card save, browser refresh, and re-opening the editor.
const ALIGNMENT = 'cupCardParagraphAlign';
const INDENT = 'cupCardParagraphIndent';
export const RICH_CARD_INDENT_MAX = 8;
const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify']);

function selectedBlocks(editor) {
  const selection = editor.model.document.selection;
  const blocks = [...selection.getSelectedBlocks()];
  if (!blocks.length && selection.getFirstPosition()) {
    const parent = selection.getFirstPosition().parent;
    if (parent?.is('element')) blocks.push(parent);
  }
  return blocks;
}

export function setRichCardAlignment(editor, align) {
  if (!ALIGN_VALUES.has(align)) return false;
  const native = editor.commands.get('alignment');
  if (native) {
    if (native.isEnabled === false) return false;
    editor.execute('alignment', { value: align });
  } else {
    const blocks = selectedBlocks(editor);
    editor.model.change(writer => {
      for (const block of blocks) {
        if (!editor.model.schema.checkAttribute(block, ALIGNMENT)) continue;
        if (align === 'left') writer.removeAttribute(ALIGNMENT, block);
        else writer.setAttribute(ALIGNMENT, align, block);
      }
    });
  }
  editor.editing.view.focus();
  return true;
}

export function indentRichCardParagraph(editor, delta) {
  if (delta !== -1 && delta !== 1) return false;
  const blocks = selectedBlocks(editor);
  if (!blocks.length) return false;
  editor.model.change(writer => {
    for (const block of blocks) {
      if (!editor.model.schema.checkAttribute(block, INDENT)) continue;
      const previous = Number(block.getAttribute(INDENT)) || 0;
      const next = Math.max(0, Math.min(RICH_CARD_INDENT_MAX, previous + delta));
      if (!next) writer.removeAttribute(INDENT, block);
      else writer.setAttribute(INDENT, next, block);
    }
  });
  editor.editing.view.focus();
  return true;
}

function makeButton(label, glyph, fn) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ck ck-button ck-off cup-card-paragraph-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.textContent = glyph;
  button.addEventListener('pointerdown', e => e.preventDefault());
  button.addEventListener('click', fn);
  return button;
}

export function installRichCardParagraphTools(editor) {
  const model = editor.model;
  model.schema.extend('$block', { allowAttributes: [ALIGNMENT, INDENT] });

  // A native alignment plugin would already own its own conversions.
  if (!editor.commands.get('alignment')) {
    editor.conversion.for('upcast').elementToAttribute({
      view: { name: /^(p|h[1-6])$/, styles: { 'text-align': /^(left|center|right|justify)$/ } },
      model: {
        key: ALIGNMENT,
        value: view => ALIGN_VALUES.has(view.getStyle('text-align')) ? view.getStyle('text-align') : null,
      },
    });
    editor.conversion.for('downcast').attributeToAttribute({
      model: ALIGNMENT,
      view: value => ({ key: 'style', value: { 'text-align': value } }),
    });
  }
  editor.conversion.for('upcast').elementToAttribute({
    view: { name: /^(p|h[1-6])$/, styles: { 'margin-left': /^[0-9.]+(?:em|px)$/ } },
    model: {
      key: INDENT,
      value: view => {
        const raw = view.getStyle('margin-left') || '';
        const number = parseFloat(raw);
        const em = raw.endsWith('px') ? number / 16 : number;
        if (!Number.isFinite(em) || em <= 0) return null;
        return Math.max(1, Math.min(RICH_CARD_INDENT_MAX, Math.round(em / 2)));
      },
    },
  });
  editor.conversion.for('downcast').attributeToAttribute({
    model: INDENT,
    view: value => ({ key: 'style', value: { 'margin-left': (Number(value) * 2) + 'em' } }),
  });

  const toolbar = editor.ui.view.toolbar.element;
  const items = toolbar.querySelector('.ck-toolbar__items') || toolbar;
  const wrapper = document.createElement('span');
  wrapper.className = 'cup-card-paragraph-tools';
  wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:2px;flex-wrap:wrap;';
  const aligns = [
    ['left', 'Align left', '≡'],
    ['center', 'Align center', '≡'],
    ['right', 'Align right', '≡'],
    ['justify', 'Justify', '☷'],
  ];
  for (const [value, label, glyph] of aligns) {
    const button = makeButton(label, glyph, () => setRichCardAlignment(editor, value));
    button.classList.add('cup-card-align-' + value);
    const update = () => {
      const blocks = selectedBlocks(editor);
      const active = blocks.length && blocks.every(block =>
        (block.getAttribute(ALIGNMENT) || 'left') === value);
      button.classList.toggle('ck-on', !!active);
      button.classList.toggle('ck-off', !active);
      button.setAttribute('aria-pressed', String(!!active));
    };
    editor.model.document.selection.on('change:range', update);
    editor.model.document.selection.on('change:attribute', update);
    editor.model.document.on('change:data', update);
    wrapper.appendChild(button);
    update();
  }
  wrapper.appendChild(makeButton('Decrease indent', '⇤', () => indentRichCardParagraph(editor, -1)));
  wrapper.appendChild(makeButton('Increase indent', '⇥', () => indentRichCardParagraph(editor, 1)));
  items.appendChild(wrapper);
  return wrapper;
}
