// Block-level formatting for manual cards. The packaged CKEditor Classic build
// does not include the optional Alignment and IndentBlock features, so register
// narrow paragraph/heading converters that survive saving card HTML.
const ALIGNMENTS = ['left', 'center', 'right', 'justify'];
const MAX_INDENT = 6;
const INDENT_STEP = 40;
const BLOCK_TAGS = [
  ['paragraph', 'p'],
  ['heading1', 'h2'],
  ['heading2', 'h3'],
  ['heading3', 'h4'],
  ['heading4', 'h5'],
  ['heading5', 'h6'],
];

function selectedBlocks(editor) {
  return [...editor.model.document.selection.getSelectedBlocks()]
    .filter(block => block && block.is('element') && editor.model.schema.checkAttribute(block, 'cupCardAlignment'));
}

export function setRichCardAlignment(editor, alignment) {
  if (!ALIGNMENTS.includes(alignment)) return false;
  const native = editor.commands.get('alignment');
  if (native) {
    if (!native.isEnabled) return false;
    editor.execute('alignment', { value: alignment });
  } else {
    const blocks = selectedBlocks(editor);
    editor.model.change(writer => {
      for (const block of blocks) writer.setAttribute('cupCardAlignment', alignment, block);
    });
  }
  editor.editing.view.focus();
  return true;
}

export function changeRichCardIndent(editor, direction) {
  if (direction !== 1 && direction !== -1) return false;
  const native = editor.commands.get(direction > 0 ? 'indentBlock' : 'outdentBlock');
  if (native && native.isEnabled) {
    editor.execute(direction > 0 ? 'indentBlock' : 'outdentBlock');
  } else {
    const blocks = selectedBlocks(editor);
    editor.model.change(writer => {
      for (const block of blocks) {
        const level = Number(block.getAttribute('cupCardIndent')) || 0;
        const next = Math.min(MAX_INDENT, Math.max(0, level + direction));
        if (next) writer.setAttribute('cupCardIndent', next, block);
        else writer.removeAttribute('cupCardIndent', block);
      }
    });
  }
  editor.editing.view.focus();
  return true;
}

function button(label, text, action) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ck ck-button ck-off cup-card-block-button';
  el.title = label;
  el.setAttribute('aria-label', label);
  el.textContent = text;
  el.style.cssText = 'min-width:29px;padding:4px 5px;font-size:15px;line-height:1.2';
  el.addEventListener('pointerdown', e => e.preventDefault());
  el.addEventListener('click', action);
  return el;
}

export function installRichCardBlockFormatting(editor) {
  const schema = editor.model.schema;
  for (const [name, tag] of BLOCK_TAGS) {
    if (!schema.isRegistered(name)) continue;
    if (!editor.commands.get('alignment')) {
      schema.extend(name, { allowAttributes: ['cupCardAlignment'] });
      editor.conversion.attributeToAttribute({
        model: { name, key: 'cupCardAlignment', values: ALIGNMENTS },
        view: Object.fromEntries(ALIGNMENTS.map(value =>
          [value, { name: tag, key: 'style', value: { 'text-align': value } }])),
      });
    }
    if (!editor.commands.get('indentBlock')) {
      schema.extend(name, { allowAttributes: ['cupCardIndent'] });
      editor.conversion.attributeToAttribute({
        model: { name, key: 'cupCardIndent', values: [1, 2, 3, 4, 5, 6] },
        view: Object.fromEntries(Array.from({ length: MAX_INDENT }, (_, index) => {
          const level = index + 1;
          return [level, { name: tag, key: 'style',
            value: { 'margin-left': (level * INDENT_STEP) + 'px' } }];
        })),
      });
    }
  }

  const toolbar = editor.ui.view.toolbar.element;
  const items = toolbar.querySelector('.ck-toolbar__items') || toolbar;
  const group = document.createElement('span');
  group.className = 'cup-card-block-controls';
  group.style.cssText = 'display:inline-flex;align-items:center;flex-wrap:wrap;gap:1px;padding:0 3px;';
  group.append(
    button('Decrease indent', '⇤', () => changeRichCardIndent(editor, -1)),
    button('Increase indent', '⇥', () => changeRichCardIndent(editor, 1)),
  );
  const alignmentButtons = [];
  for (const [value, text] of [
    ['left', '☰'], ['center', '≡'], ['right', '☷'], ['justify', '▤'],
  ]) {
    const el = button('Align ' + value, text, () => setRichCardAlignment(editor, value));
    el.setAttribute('aria-pressed', 'false');
    alignmentButtons.push([value, el]);
    group.append(el);
  }
  const update = () => {
    const blocks = selectedBlocks(editor);
    const value = blocks.length && blocks.every(block =>
      (block.getAttribute('cupCardAlignment') || 'left') ===
      (blocks[0].getAttribute('cupCardAlignment') || 'left'))
      ? (blocks[0].getAttribute('cupCardAlignment') || 'left') : null;
    for (const [alignment, el] of alignmentButtons) {
      const active = value === alignment;
      el.setAttribute('aria-pressed', String(active));
      el.classList.toggle('ck-on', active);
      el.classList.toggle('ck-off', !active);
    }
  };
  editor.model.document.selection.on('change:range', update);
  editor.model.document.on('change:data', update);
  items.append(group);
  update();
  return group;
}
