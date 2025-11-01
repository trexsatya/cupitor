(function() {
  function getWords(text) {
    const segmentor = new Intl.Segmenter([], {granularity: 'word'});
    return Array.from(segmentor.segment(text), ({segment}) => segment);
  }

  function wrapWordsInNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentNode;
      if (parent && parent.closest('a')) return; // Skip if inside <a>
      const words = getWords(node.textContent);
      const frag = document.createDocumentFragment();
      words.forEach(word => {
        if (word.trim().length < 2) {
          frag.appendChild(document.createTextNode(word));
        } else {
          const span = document.createElement('span');
          span.className = 'clickable-word';
          span.dataset.word = word;
          span.textContent = word;
          frag.appendChild(span);
        }
      });
      parent.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() !== 'a') {
      Array.from(node.childNodes).forEach(wrapWordsInNode);
    }
  }

  wrapWordsInNode(document.body);

  document.addEventListener('click', (e) => {
    let t = e.target.closest('.clickable-word');
    if (t) {
      console.log(t.getAttribute('data-word'));
    }
  });
})();
