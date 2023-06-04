function fixImageUrls() {
  document.querySelectorAll('img').forEach((e, i) => {
    let href = e.getAttribute('src');
    if (href.startsWith('/images/')) {
      href = href.replace('/images/', window.imageCdnUrl + "/images/");
      e.src = href;
    }
  })
}

const MathJax = window.MathJax;

function drawMathematics() {
  document.querySelectorAll('.math').forEach(x => {
    const input = x.innerHTML;
    x.innerHTML = '';
    MathJax.texReset();
    const options = MathJax.getMetricsFor(x);
    options.display = x.nodeName === 'DIV';
    MathJax.tex2chtmlPromise(input, options).then(function (node) {
      //
      //  The promise returns the typeset node, which we add to the output
      //  Then update the document to include the adjusted CSS for the
      //    content of the new equation.
      //
      x.appendChild(node);
      MathJax.startup.document.clear();
      MathJax.startup.document.updateDocument();
    }).catch(function (err) {
      //
      //  If there was an error, put the message into the output instead
      //
      x.appendChild(document.createElement('pre')).appendChild(document.createTextNode(err.message));
    }).then(function () {
      //
      //  Error or not, re-enable the display and render buttons
      //
      console.log('done rendering math')
    });

  });

};

function css(element, style) {
  for (const property in style)
    element.style[property] = style[property];
}

export function transformArticle(router) {
  const $ = document.querySelectorAll;
  try {
    document.querySelectorAll('.flex-card-listitem').forEach((e, i) => {
      const to = e.getAttribute('reactlink');
      e.style.cursor = 'pointer';
      e.onclick = () => {
        router.push(to).catch(error => {
          if (error.name !== "NavigationDuplicated") {
            throw error;
          }
        });
      };
    });

    document.querySelectorAll('a[reactlink]').forEach((e, i) => {
      const to = e.getAttribute('reactlink');
      e.style.cursor = 'pointer';
      e.onclick = () => {
        router.push(to).catch(error => {
          if (error.name !== "NavigationDuplicated") {
            throw error;
          }
        });
      };
    })

  } catch (e) {
    console.log(e)
  }

  try {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });
  } catch (e) {
    console.log(e);
  }
  try {
    fixImageUrls()
  } catch (e) {
    console.log(e);
  }
  try {
    drawMathematics()
  } catch (e) {
    console.log(e);
  }

  (window.transformers || []).forEach(transformer => {
    try {
      transformer()
    } catch (e) {
      console.log(e);
    }
  })

}


window.appendScripts = function (urls) {
  urls.forEach(url => {
    const script = document.createElement('script');
    script.src = url;
    document.body.appendChild(script);
  });
}
