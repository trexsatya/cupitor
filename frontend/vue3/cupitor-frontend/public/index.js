function makeLinksOpenInNewTab() {
  document.querySelectorAll('.article-container a').forEach((e,i) => {
     e.setAttribute('target', '_blank');
  })
}


function renderAccordions() {
  console.log('Rendering accordions')

  let isAccordion = it => Array.from(it.classList.values()).indexOf('accordion') >= 0

  function fixAccordionPanel(accordionEl) {
    var el = accordionEl.nextElementSibling
    var siblings = []
    while(el) {
      if(isAccordion(el)) break

      siblings.push(el)
      el = el.nextElementSibling
    }

    if(siblings.length > 1) {
      let newEl = document.createElement('div')
      newEl.classList.add('autocreated-panel')
      siblings.forEach(it => newEl.appendChild(it))

      accordionEl.insertAdjacentElement('afterend', newEl)
    }
  }

  var acc = document.getElementsByClassName("accordion");
  var i;

  for (i = 0; i < acc.length; i++) {
    acc[i].classList.add(i % 2 === 0 ? 'even' : 'odd')

    if(acc[i].dataset.accordion_rendered === "true") continue;

    fixAccordionPanel(acc[i])
    acc[i].addEventListener("click", function() {
      /* Toggle between adding and removing the "active" class,
      to highlight the button that controls the panel */
      this.classList.toggle("active");

      /* Toggle between hiding and showing the active panel */
      var panel = this.nextElementSibling;
      if (panel.style.display === "block") {
        panel.style.display = "none";
      } else {
        panel.style.display = "block";
      }
    });
  }
}

window.transformers = [makeLinksOpenInNewTab, renderAccordions]
