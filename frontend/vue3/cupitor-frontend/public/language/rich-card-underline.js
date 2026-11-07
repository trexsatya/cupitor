// Underline for the manual-card CKEditor, including Classic builds without
// the optional Underline plugin. Persisted as <u> in card HTML.
const ATTRIBUTE = 'cupCardUnderline';

export function toggleRichCardUnderline(editor) {
  const command = editor.commands.get('underline');
  if (command) {
    if (command.isEnabled !== false) editor.execute('underline');
    editor.editing.view.focus();
    return;
  }

  const model = editor.model;
  const selection = model.document.selection;
  const enable = selection.getAttribute(ATTRIBUTE) !== true;
  model.change(writer => {
    if (selection.isCollapsed) {
      if (enable) writer.setSelectionAttribute(ATTRIBUTE, true);
      else writer.removeSelectionAttribute(ATTRIBUTE);
      return;
    }
    for (const range of model.schema.getValidRanges(selection.getRanges(), ATTRIBUTE)) {
      if (enable) writer.setAttribute(ATTRIBUTE, true, range);
      else writer.removeAttribute(ATTRIBUTE, range);
    }
  });
  editor.editing.view.focus();
}

export function installRichCardUnderline(editor) {
  const command = editor.commands.get('underline');
  if (!command) {
    editor.model.schema.extend('$text', { allowAttributes: ATTRIBUTE });
    editor.model.schema.setAttributeProperties(ATTRIBUTE, {
      isFormatting: true, copyOnEnter: true,
    });
    editor.conversion.for('downcast').attributeToElement({ model: ATTRIBUTE, view: 'u' });
    editor.conversion.for('upcast').elementToAttribute({ view: 'u', model: ATTRIBUTE });
  }

  const toolbar = editor.ui.view.toolbar.element;
  const items = toolbar.querySelector('.ck-toolbar__items') || toolbar;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ck ck-button ck-off';
  button.title = 'Underline (Ctrl/Cmd+U)';
  button.setAttribute('aria-label', 'Underline');
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span class="ck ck-button__label" style="display:inline;text-decoration:underline;font-weight:bold;font-size:16px">U</span>';

  const update = () => {
    const active = command
      ? !!command.value
      : editor.model.document.selection.getAttribute(ATTRIBUTE) === true;
    button.classList.toggle('ck-on', active);
    button.classList.toggle('ck-off', !active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = command ? !command.isEnabled : false;
  };
  button.addEventListener('pointerdown', e => e.preventDefault());
  button.addEventListener('click', () => {
    toggleRichCardUnderline(editor);
    update();
  });
  editor.model.document.selection.on('change:range', update);
  editor.model.document.selection.on('change:attribute', update);
  if (command) {
    command.on('change:value', update);
    command.on('change:isEnabled', update);
  }

  // Keep formatting actions together in the toolbar.
  const italic = [...items.querySelectorAll('button')].find(el =>
    /italic/i.test(el.getAttribute('aria-label') || el.title || '')
  );
  if (italic) italic.after(button);
  else items.prepend(button);
  update();
  return button;
}
