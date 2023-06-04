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

function showTitlePopup(title, el) {
  let p = document.querySelector("#title-popup")
  if (!p) {
    p = document.createElement("div")
    p.id = "title-popup"
    p.onclick = () => {
      css(p, { display: 'none'})
    }
    document.body.appendChild(p)
  }
  p.innerHTML = title;
  const top = el.offsetTop;
  const left = el.offsetLeft;

  css(p, {
    position: 'absolute',
    top: top + "px",
    left: left + "px",
    display: 'block',
    'z-index': 2000,
    background: '#2f9999',
    color: 'yellow',
    padding: '5px',
    cursor: 'pointer'
  })
}

function css(element, style) {
  for (const property in style)
    element.style[property] = style[property];
}

function enablePopups() {
  try {
    document.querySelectorAll('.article *[title]').forEach((div, i) => {
      const title = div.getAttribute('title');
      div.style.cursor = 'pointer';
      div.onclick = e => {
        showTitlePopup(title, e.target)
      }
    })

  } catch (e) {
    console.log(e)
  }
}
window.transformers = [makeLinksOpenInNewTab, renderAccordions, enablePopups]
