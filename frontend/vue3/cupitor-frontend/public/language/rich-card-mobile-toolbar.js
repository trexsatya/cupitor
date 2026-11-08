// Mobile CKEditor toolbar expander. CKEditor Classic adds its toolbar after
// async editor creation and may re-create it when the dialog is reopened.
export function initMobileRichCardToolbar(root = document.getElementById('richCardEditor')) {
  if (!root || !root.querySelector('.ck-editor__top')) return null;
  const existing = root.querySelector('.rce-mobile-tools-toggle');
  if (existing) return existing;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rce-mobile-tools-toggle';
  button.setAttribute('aria-controls', 'richCardFormattingToolbar');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span aria-hidden="true">✎</span> Formatting tools <span class="rce-tools-chevron" aria-hidden="true">⌄</span>';
  const toolbar = root.querySelector('.ck-editor__top');
  toolbar.id = 'richCardFormattingToolbar';
  const editorShell = root.querySelector('.ck-editor');
  editorShell.parentElement.insertBefore(button, editorShell);
  root.classList.add('rce-tools-collapsed');
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', () => {
    const expanded = root.classList.toggle('rce-tools-collapsed') === false;
    button.setAttribute('aria-expanded', String(expanded));
    const editable = root.querySelector('.ck-editor__editable');
    if (editable) editable.focus({ preventScroll: true });
  });
  return button;
}

if (typeof document !== 'undefined') {
  const attach = () => initMobileRichCardToolbar();
  const observe = () => {
    attach();
    // Restrict work to additions inside the rich editor once it exists.
    // The page otherwise contains large, frequently changing search results.
    new MutationObserver(records => {
      if (!records.some(r => r.addedNodes.length)) return;
      const root = document.getElementById('richCardEditor');
      if (root && !root.querySelector('.rce-mobile-tools-toggle')) attach();
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
}
