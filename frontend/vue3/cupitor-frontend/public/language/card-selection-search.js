// Keep the existing Search action available for a selection in either study
// card. The browser owns the selected text; the normal search handlers read it.
export function installCardSelectionSearch({doc = document, onChange = () => {}} = {}) {
  let activeButton = null;
  let selectedText = '';
  let originalLabels = null;
  let selecting = false;

  const elementOf = node => node?.nodeType === 1 ? node : node?.parentElement;
  function selectedButton() {
    const selection = doc.defaultView.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const anchor = elementOf(selection.anchorNode);
    const focus = elementOf(selection.focusNode);
    if (!anchor?.isConnected || !focus?.isConnected) return null;
    const editable = 'input, textarea, [contenteditable="true"], .practice-edit-box';
    if (anchor.closest(editable) || focus.closest(editable)) return null;

    let root, button;
    if (doc.body.classList.contains('practice-mode')) {
      root = anchor.closest('#practiceMode:not(.minimized) .practice-card');
      if (root && root.contains(focus)) button = doc.querySelector('#practiceMode .practice-search');
    } else if (doc.body.classList.contains('rec-playing') &&
               !doc.body.classList.contains('rec-playing-minimized')) {
      root = anchor.closest('#recPlayingSubs, #recPlayingWord');
      if (root && root.contains(focus)) button = doc.getElementById('recPlayingSearchBtn');
    }
    return button && !button.disabled ? {button, text} : null;
  }

  function clearButton() {
    if (!activeButton) return;
    activeButton.classList.remove('study-selection-search');
    for (const [name, value] of Object.entries(originalLabels)) {
      if (value == null) activeButton.removeAttribute(name);
      else activeButton.setAttribute(name, value);
    }
    activeButton = null;
    originalLabels = null;
  }

  function update() {
    // A mouse drag may briefly select text before the card's swipe handler
    // replaces it. Wait for that handler to finish before waking Search.
    if (selecting) return;
    const next = selectedButton();
    if ((next?.button || null) === activeButton && (next?.text || '') === selectedText) return;
    clearButton();
    selectedText = next?.text || '';
    if (next) {
      activeButton = next.button;
      originalLabels = {
        'aria-label': activeButton.getAttribute('aria-label'),
        title: activeButton.getAttribute('title'),
      };
      activeButton.classList.add('study-selection-search');
      activeButton.setAttribute('aria-label', 'Search selected text');
      activeButton.setAttribute('title', 'Search selected text (minimizes)');
    }
    onChange(!!activeButton);
  }

  // Focusing a button can collapse the browser selection before its click
  // handler runs. Preserve it for mouse clicks and touch/pen pointer taps.
  function preserveSelection(event) {
    if (event.button !== 0) return;
    update();
    if (activeButton?.contains(event.target)) event.preventDefault();
  }

  function startSelection(event) {
    preserveSelection(event);
    if (event.button === 0 && !event.defaultPrevented) selecting = true;
  }
  function finishSelection() {
    selecting = false;
    update();
  }

  const events = ['selectionchange', 'keyup'];
  for (const name of events) doc.addEventListener(name, update);
  doc.addEventListener('pointerdown', startSelection, true);
  doc.addEventListener('pointerup', finishSelection);
  doc.addEventListener('pointercancel', finishSelection);
  doc.addEventListener('mousedown', preserveSelection, true);
  const observer = new doc.defaultView.MutationObserver(update);
  observer.observe(doc.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  update();
  return {
    hasSelection: () => !!activeButton,
    dispose() {
      observer.disconnect();
      for (const name of events) doc.removeEventListener(name, update);
      doc.removeEventListener('pointerdown', startSelection, true);
      doc.removeEventListener('pointerup', finishSelection);
      doc.removeEventListener('pointercancel', finishSelection);
      doc.removeEventListener('mousedown', preserveSelection, true);
      clearButton();
      selectedText = '';
    },
  };
}
