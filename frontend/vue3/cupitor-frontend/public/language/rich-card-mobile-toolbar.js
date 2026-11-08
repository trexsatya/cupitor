// Compact CKEditor toolbar for narrow/mobile rich-card dialogs.
// The editor remains full-featured; users can expand the formatting controls
// without giving up most of the screen to toolbar rows while typing.
export function installMobileRichToolbar(editor, root, { mobile = true } = {}) {
  if (!mobile || !root || !editor?.ui?.view?.toolbar?.element) return null;
  const toolbar = editor.ui.view.toolbar.element;
  if (!root.contains(toolbar) || toolbar.dataset.mobileToggleWired) return null;
  const parent = toolbar.parentNode;
  if (!parent) return null;
  const button = root.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'rce-toolbar-toggle';
  button.setAttribute('aria-label', 'Show formatting controls');
  button.setAttribute('aria-expanded', 'false');
  toolbar.id ||= 'rce-formatting-toolbar';
  button.setAttribute('aria-controls', toolbar.id);
  button.textContent = 'Formatting tools ▾';
  parent.insertBefore(button, toolbar);
  toolbar.dataset.mobileToggleWired = '1';

  function setExpanded(expanded) {
    toolbar.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Hide formatting controls' : 'Show formatting controls');
    button.textContent = expanded ? 'Formatting tools ▴' : 'Formatting tools ▾';
    root.classList.toggle('rce-toolbar-collapsed', !expanded);
  }
  button.addEventListener('click', () => setExpanded(toolbar.hidden));
  setExpanded(false); // Mobile starts compact; desktop remains untouched.
  return {
    button,
    toolbar,
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    dispose: () => { button.remove(); toolbar.hidden = false; delete toolbar.dataset.mobileToggleWired;
      root.classList.remove('rce-toolbar-collapsed'); }
  };
}
