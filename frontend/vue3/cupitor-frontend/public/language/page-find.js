// Browser-style Find on page for the standalone webapp and Cupitor WebViews.
// Keep this separate from the library/SRT search: Find only searches text
// currently visible in the DOM and never changes the search query or results.
const ALL_HIGHLIGHT = 'cupitor-page-find-all';
const ACTIVE_HIGHLIGHT = 'cupitor-page-find-active';

export function initPageFind(doc = document) {
  const toggle = doc.getElementById('cupPageFindToggle');
  const bar = doc.getElementById('cupPageFindBar');
  if (!toggle || !bar) return null;
  if (bar.__cupPageFind) return bar.__cupPageFind;

  const input = bar.querySelector('#cupPageFindInput');
  const status = bar.querySelector('#cupPageFindCount');
  const previous = bar.querySelector('#cupPageFindPrevious');
  const next = bar.querySelector('#cupPageFindNext');
  const closeButton = bar.querySelector('#cupPageFindClose');
  if (!input || !status || !previous || !next || !closeButton) return null;

  let query = '';
  let ranges = [];
  let marks = [];
  let index = -1;
  let timer = null;
  let priorFocus = null;
  let usingCssHighlights = false;

  const supportsHighlights = !!(doc.defaultView?.CSS?.highlights &&
    typeof doc.defaultView.Highlight === 'function');

  function clearHighlights() {
    if (usingCssHighlights) {
      doc.defaultView.CSS.highlights.delete(ALL_HIGHLIGHT);
      doc.defaultView.CSS.highlights.delete(ACTIVE_HIGHLIGHT);
      usingCssHighlights = false;
    }
    // Legacy Android WebViews may not implement CSS Custom Highlight.
    // Remove only nodes Find created, never arbitrary page <mark> elements.
    for (const mark of marks) {
      if (!mark.isConnected) continue;
      const parent = mark.parentNode;
      parent.replaceChild(doc.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
    marks = [];
    ranges = [];
    index = -1;
    query = '';
  }

  function showCount() {
    const count = ranges.length;
    status.textContent = !query ? '' : count ? (index + 1) + ' of ' + count : 'No matches';
    previous.disabled = next.disabled = !count;
    bar.dataset.matchCount = String(count);
  }

  function visibleText(node) {
    const el = node.parentElement;
    if (!el || !el.isConnected) return false;
    if (el.closest('#cupPageFindBar,script,style,noscript,template,textarea,input,select,option,button,svg,[hidden],[inert],[aria-hidden="true"],[contenteditable],.ck-editor__editable')) return false;
    // Layout reads are expensive on very large result lists. Perform them
    // only for text nodes already containing the requested word.
    for (let parent = el; parent && parent !== doc.documentElement; parent = parent.parentElement) {
      const css = doc.defaultView.getComputedStyle(parent);
      if (css.display === 'none' || css.visibility === 'hidden') return false;
    }
    return true;
  }

  function collectMatches(needle) {
    const found = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node;
    const lower = needle.toLocaleLowerCase();
    while ((node = walker.nextNode())) {
      const raw = node.textContent || '';
      const text = raw.toLocaleLowerCase();
      if (!text || !text.includes(lower) || !visibleText(node)) continue;
      let start = 0, at;
      while ((at = text.indexOf(lower, start)) !== -1) {
        const range = doc.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        // getClientRects excludes display:none, including collapsed results.
        if (Array.from(range.getClientRects()).some(r => r.width > 0 && r.height > 0)) found.push(range);
        start = at + Math.max(1, needle.length);
      }
    }
    return found;
  }

  function highlightMatches() {
    if (!ranges.length) return;
    if (supportsHighlights) {
      try {
        doc.defaultView.CSS.highlights.set(ALL_HIGHLIGHT, new doc.defaultView.Highlight(...ranges));
        usingCssHighlights = true;
        return;
      } catch (_) {
        // Fall through for old/partially implemented WebViews.
      }
    }
    // Preserve offsets by wrapping from the end of each text node backwards.
    const fallbackMarks = new Array(ranges.length);
    for (let i = ranges.length - 1; i >= 0; i--) {
      const el = doc.createElement('mark');
      el.className = 'cup-page-find-fallback';
      try {
        ranges[i].surroundContents(el);
        fallbackMarks[i] = el;
      } catch (_) { /* skip a node replaced by app rendering */ }
    }
    marks = fallbackMarks;
  }

  function scrollActiveIntoView() {
    const mark = marks[index];
    const range = ranges[index];
    const rect = mark?.isConnected ? mark.getBoundingClientRect() : range?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const initial = mark?.isConnected ? mark : range.startContainer.parentElement;
    // First scroll nested result panes, then the window. Do not call focus()
    // on a match or modify Selection: typing remains in Find on mobile too.
    for (let el = initial; el && el !== doc.documentElement; el = el.parentElement) {
      const css = doc.defaultView.getComputedStyle(el);
      if (!/(auto|scroll)/.test(css.overflowY) || el.scrollHeight <= el.clientHeight + 2) continue;
      const box = el.getBoundingClientRect();
      const target = (mark?.isConnected ? mark : range).getBoundingClientRect();
      if (target.top < box.top + 12 || target.bottom > box.bottom - 12) {
        el.scrollTop += target.top - (box.top + box.height * 0.42);
      }
    }
    const current = (mark?.isConnected ? mark : range).getBoundingClientRect();
    const viewport = doc.defaultView;
    if (current.top < 68 || current.bottom > viewport.innerHeight - 24) {
      viewport.scrollBy({ top: current.top - Math.max(80, viewport.innerHeight * 0.38), behavior: 'instant' });
    }
  }

  function renderActive() {
    if (!ranges.length) { showCount(); return; }
    if (usingCssHighlights) {
      doc.defaultView.CSS.highlights.set(ACTIVE_HIGHLIGHT, new doc.defaultView.Highlight(ranges[index]));
    } else {
      for (const [n, mark] of marks.entries()) {
        mark?.classList.toggle('cup-page-find-current', n === index);
      }
    }
    scrollActiveIntoView();
    showCount();
  }

  function search(value, direction = 0) {
    const needle = String(value || '').trim();
    const stale = ranges.some((r, i) => !(marks[i]?.isConnected || r.startContainer?.isConnected));
    if (needle !== query || stale) {
      clearHighlights();
      query = needle;
      if (query) {
        ranges = collectMatches(query);
        index = direction < 0 ? ranges.length - 1 : 0;
        highlightMatches();
      }
    } else if (ranges.length && direction) {
      index = (index + direction + ranges.length) % ranges.length;
    }
    if (ranges.length) renderActive();
    else showCount();
    return { current: ranges.length ? index + 1 : 0, total: ranges.length };
  }

  function findNext(direction = 1) {
    if (timer) { clearTimeout(timer); timer = null; }
    const wasFresh = input.value.trim() !== query;
    const result = search(input.value, wasFresh ? (direction < 0 ? -1 : 0) : direction);
    input.focus({ preventScroll: true });
    return result;
  }

  function open() {
    if (bar.hidden) {
      priorFocus = doc.activeElement;
      bar.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      const selected = doc.defaultView.getSelection()?.toString().trim() || '';
      if (selected && selected.length <= 100 && !selected.includes('\n')) input.value = selected;
      search(input.value);
    }
    input.focus({ preventScroll: true });
    input.select();
  }

  function close() {
    if (timer) { clearTimeout(timer); timer = null; }
    bar.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    clearHighlights();
    showCount();
    input.blur();
    if (priorFocus?.isConnected && priorFocus !== doc.body) {
      priorFocus.focus({ preventScroll: true });
    } else {
      toggle.focus({ preventScroll: true });
    }
    priorFocus = null;
  }

  toggle.addEventListener('click', () => bar.hidden ? open() : close());
  closeButton.addEventListener('click', close);
  previous.addEventListener('click', () => findNext(-1));
  next.addEventListener('click', () => findNext(1));
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; search(input.value); }, 140);
  });
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      findNext(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  doc.addEventListener('keydown', e => {
    if (e.isComposing) return;
    const key = e.key.toLowerCase();
    const find = key === 'f' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
    if (find) {
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
      return;
    }
    if (bar.hidden) return;
    const direction = ((e.metaKey || e.ctrlKey) && key === 'g') ||
      (key === 'f3' && !e.metaKey && !e.ctrlKey)
      ? (e.shiftKey ? -1 : 1) : 0;
    if (direction) {
      e.preventDefault();
      e.stopImmediatePropagation();
      findNext(direction);
    } else if (key === 'escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }, true);

  // Expose only for regression tests; no native app dependency.
  const api = { open, close, search, findNext, getState: () => ({
    open: !bar.hidden, current: index + 1, total: ranges.length,
    focused: doc.activeElement === input, usingCssHighlights,
  }) };
  bar.__cupPageFind = api;
  return api;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPageFind(), { once: true });
  } else {
    initPageFind();
  }
}
