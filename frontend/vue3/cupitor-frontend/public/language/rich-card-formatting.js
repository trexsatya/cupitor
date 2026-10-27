// Additional manual-card CKEditor formatting. This editor uses the prebuilt
// Classic 41.x bundle, which does not include its optional Font/HorizontalLine
// plugins. Register the missing schema/converters before setData() loads HTML.
const COLORS = {
  text: { attribute: 'cupCardTextColor', css: 'color', title: 'Text color', initial: '#ffffff' },
  background: { attribute: 'cupCardBackgroundColor', css: 'background-color', title: 'Background color', initial: '#fff59d' },
};
const RULE = 'cupCardHorizontalRule';

export function normalizeRichCardColor(value) {
  const color = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) return '#' + [...color.slice(1)].map(c => c + c).join('');
  const match = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*1(?:\.0+)?)?\s*\)$/);
  if (match) {
    const channels = match.slice(1, 4).map(Number);
    if (channels.every(c => c <= 255)) return '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('');
  }
  return null; // Never write arbitrary CSS from card content into a converter.
}

export function applyRichCardColor(editor, kind, value, preservedRanges = null) {
  const spec = COLORS[kind];
  if (!spec) return false;
  const color = value == null ? null : normalizeRichCardColor(value);
  if (value != null && !color) return false;
  const model = editor.model;
  model.change(writer => {
    if (preservedRanges && preservedRanges.length) writer.setSelection(preservedRanges);
    const selection = model.document.selection;
    if (selection.isCollapsed) {
      if (color) writer.setSelectionAttribute(spec.attribute, color);
      else writer.removeSelectionAttribute(spec.attribute);
    } else {
      for (const range of model.schema.getValidRanges(selection.getRanges(), spec.attribute)) {
        if (color) writer.setAttribute(spec.attribute, color, range);
        else writer.removeAttribute(spec.attribute, range);
      }
    }
  });
  editor.editing.view.focus();
  return true;
}

// A full-width block divider, stored as <hr> in HTML. We deliberately use
// the native HorizontalLine command if this build ever gains that plugin.
export function insertRichCardHorizontalRule(editor) {
  if (editor.commands.get('horizontalLine')) {
    editor.execute('horizontalLine');
  } else {
    editor.model.change(writer => {
      const rule = writer.createElement(RULE);
      editor.model.insertObject(rule, editor.model.document.selection, null, { setSelection: 'after' });
    });
  }
  editor.editing.view.focus();
}

// The vertical rule is an inline separator: a real U+2502 box-drawing line.
// It survives plain text, HTML sanitizing, copy/paste and CKEditor reloads
// without an HTML-only custom span that can collapse to zero width.
export function insertRichCardVerticalRule(editor) {
  editor.model.change(writer => editor.model.insertContent(writer.createText(' │ ')));
  editor.editing.view.focus();
}

function makeToolbarButton(label, text, callback) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ck ck-button ck-off';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = text;
  button.style.cssText = 'min-width:28px;padding:4px 6px;font-size:16px;';
  button.addEventListener('pointerdown', e => e.preventDefault());
  button.addEventListener('click', callback);
  return button;
}

export function installRichCardFormatting(editor) {
  for (const spec of Object.values(COLORS)) {
    editor.model.schema.extend('$text', { allowAttributes: spec.attribute });
    editor.model.schema.setAttributeProperties(spec.attribute, {
      isFormatting: true, copyOnEnter: true,
    });
    editor.conversion.for('upcast').elementToAttribute({
      view: { name: 'span', styles: { [spec.css]: /[\s\S]+/ } },
      model: {
        key: spec.attribute,
        value: element => normalizeRichCardColor(element.getStyle(spec.css)),
      },
    });
    editor.conversion.for('downcast').attributeToElement({
      model: spec.attribute,
      view: (color, { writer }) =>
        writer.createAttributeElement('span', { style: spec.css + ':' + color }, { priority: 7 }),
    });
  }
  if (!editor.commands.get('horizontalLine')) {
    editor.model.schema.register(RULE, { inheritAllFrom: '$blockObject' });
    editor.conversion.for('upcast').elementToElement({ view: 'hr', model: RULE });
    editor.conversion.for('downcast').elementToElement({
      model: RULE,
      view: (element, { writer }) => writer.createEmptyElement('hr'),
    });
  }

  const toolbar = editor.ui.view.toolbar.element;
  const items = toolbar.querySelector('.ck-toolbar__items') || toolbar;
  // The prebuilt toolbar has no registered overflow grouping for buttons
  // injected after creation. Wrap them instead of clipping colors on phones.
  items.style.flexWrap = 'wrap';

  for (const [kind, spec] of Object.entries(COLORS)) {
    const wrapper = document.createElement('span');
    wrapper.className = 'cup-card-color-control';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:2px;padding:0 2px;';
    const label = document.createElement('label');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:12px;white-space:nowrap;';
    label.textContent = kind === 'text' ? 'Text' : 'BG';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = spec.initial;
    input.title = spec.title;
    input.setAttribute('aria-label', spec.title);
    input.style.cssText = 'width:30px;height:27px;padding:1px;border:1px solid #aaa;cursor:pointer;';
    let saved = null;
    // The browser's native color picker moves DOM focus away from CKEditor.
    // Preserve model selection so formatting still targets highlighted text.
    const remember = () => {
      saved = Array.from(editor.model.document.selection.getRanges()).map(range => range.clone());
    };
    input.addEventListener('pointerdown', remember);
    input.addEventListener('focus', () => { if (!saved) remember(); });
    // Apply after the native picker closes: refocusing the editor on every
    // intermediate 'input' event can dismiss the OS color chooser.
    input.addEventListener('change', () => {
      applyRichCardColor(editor, kind, input.value, saved);
      saved = null;
    });
    label.appendChild(input);
    const clear = makeToolbarButton('Remove ' + spec.title.toLowerCase(), '×', () => {
      applyRichCardColor(editor, kind, null);
    });
    clear.style.cssText = 'min-width:22px;padding:2px 3px;';
    wrapper.append(label, clear);
    items.appendChild(wrapper);
  }
  items.appendChild(makeToolbarButton('Insert horizontal ruler', '─', () => insertRichCardHorizontalRule(editor)));
  items.appendChild(makeToolbarButton('Insert vertical ruler', '│', () => insertRichCardVerticalRule(editor)));
}
